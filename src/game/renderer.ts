import type { GameState, PlayerState, ObstacleState, RoadPoint } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  INVINCIBILITY_BLINK_RATE,
  ROAD_EDGE_LINE_WIDTH,
  ROAD_CENTER_LINE_WIDTH,
  ROAD_CENTER_DASH,
  ROAD_CENTER_GAP,
  ROAD_SHOULDER_INSET,
  COLORS,
  DEATH_ANIMATION_DURATION,
  COUNTDOWN_STEP_DURATION,
} from '../utils/constants';
import { lerp, lerpVec2 } from '../utils/math';
import { drawPlayerVector, drawObstacleVector, drawLavaTile } from './vector-sprites';

// ── World-to-screen transform ────────────────────────────────────────

function toScreenX(worldX: number, cameraX: number): number {
  return worldX - cameraX + CANVAS_WIDTH / 2;
}

function toScreenY(worldY: number, cameraY: number): number {
  return worldY - cameraY + CANVAS_HEIGHT / 2;
}

// ── Main render entry point ──────────────────────────────────────────

/**
 * Draw lava background at RAW canvas size (no scale transform).
 * Called before the viewport scale so lava fills the entire window.
 */
export function renderLavaFullscreen(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  time: number,
  camX: number,
  camY: number,
): void {
  const lavaFrame = Math.floor(time * 3) % 3;
  const tile = drawLavaTile(lavaFrame);
  const tileW = 128;
  const tileH = 128;

  const offsetX = ((camX % tileW) + tileW) % tileW;
  const offsetY = ((camY % tileH) + tileH) % tileH;

  const tilesX = Math.ceil(canvasW / tileW) + 2;
  const tilesY = Math.ceil(canvasH / tileH) + 2;

  for (let ty = -1; ty < tilesY; ty++) {
    for (let tx = -1; tx < tilesX; tx++) {
      // Draw slightly larger to avoid sub-pixel gaps between tiles
      ctx.drawImage(
        tile,
        0, 0, tileW, tileH,
        Math.floor(tx * tileW - offsetX),
        Math.floor(ty * tileH - offsetY),
        tileW + 1,
        tileH + 1,
      );
    }
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
): void {
  ctx.save();

  // Interpolated camera position for smooth rendering between physics steps
  const camX = lerp(state.camera.position.x, state.camera.target.x, alpha * 0.5);
  const camY = lerp(state.camera.position.y, state.camera.target.y, alpha * 0.5);

  // 1. Lava background (in virtual viewport coordinates — for the game area)
  drawLavaBackground(ctx, state, camX, camY);

  // 2. Road
  drawRoad(ctx, state, camX, camY);

  // 3. Start/Finish lines
  drawStartFinishLines(ctx, state, camX, camY);

  // 4. Obstacles
  drawObstacles(ctx, state, camX, camY);

  // 5. Players
  drawPlayers(ctx, state, alpha, camX, camY);

  // 6. Particles
  drawParticles(ctx, state, camX, camY);

  // 7. Countdown overlay
  if (state.phase === 'countdown') {
    drawCountdown(ctx, state);
  }

  ctx.restore();
}

// ── 1. Lava background ──────────────────────────────────────────────

function drawLavaBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  // 3 animation frames at 3 FPS
  const lavaFrame = Math.floor(state.time * 3) % 3;
  const tile = drawLavaTile(lavaFrame);
  const tileW = 128;
  const tileH = 128;

  // Calculate tile offset based on camera position for parallax scrolling
  const offsetX = ((camX % tileW) + tileW) % tileW;
  const offsetY = ((camY % tileH) + tileH) % tileH;

  // Tile the entire canvas
  const tilesX = Math.ceil(CANVAS_WIDTH / tileW) + 2;
  const tilesY = Math.ceil(CANVAS_HEIGHT / tileH) + 2;

  for (let ty = -1; ty < tilesY; ty++) {
    for (let tx = -1; tx < tilesX; tx++) {
      ctx.drawImage(
        tile,
        0, 0, tileW, tileH,
        Math.floor(tx * tileW - offsetX),
        Math.floor(ty * tileH - offsetY),
        tileW + 1,
        tileH + 1,
      );
    }
  }
}

// ── 2. Road drawing ─────────────────────────────────────────────────

interface SegmentEdge {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

function computeEdges(
  road: RoadPoint[],
  index: number,
): SegmentEdge {
  const pt = road[index];

  // Get direction: average of incoming and outgoing segment directions
  let dirX = 0;
  let dirY = 0;

  if (index < road.length - 1) {
    const next = road[index + 1];
    dirX += next.x - pt.x;
    dirY += next.y - pt.y;
  }
  if (index > 0) {
    const prev = road[index - 1];
    dirX += pt.x - prev.x;
    dirY += pt.y - prev.y;
  }

  // Normalize direction
  const len = Math.sqrt(dirX * dirX + dirY * dirY);
  if (len > 0) {
    dirX /= len;
    dirY /= len;
  } else {
    dirX = 0;
    dirY = -1;
  }

  // Perpendicular (left-hand normal)
  const perpX = -dirY;
  const perpY = dirX;

  const halfW = pt.width / 2;

  return {
    lx: pt.x + perpX * halfW,
    ly: pt.y + perpY * halfW,
    rx: pt.x - perpX * halfW,
    ry: pt.y - perpY * halfW,
  };
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  const road = state.track.road;
  if (road.length < 2) return;

  // Pre-compute edges for all road points
  const edges: SegmentEdge[] = [];
  for (let i = 0; i < road.length; i++) {
    edges.push(computeEdges(road, i));
  }

  // Draw filled road segments (trapezoids between adjacent points)
  ctx.fillStyle = COLORS.midGray;
  for (let i = 0; i < road.length - 1; i++) {
    const e0 = edges[i];
    const e1 = edges[i + 1];

    const l0x = toScreenX(e0.lx, camX);
    const l0y = toScreenY(e0.ly, camY);
    const r0x = toScreenX(e0.rx, camX);
    const r0y = toScreenY(e0.ry, camY);
    const l1x = toScreenX(e1.lx, camX);
    const l1y = toScreenY(e1.ly, camY);
    const r1x = toScreenX(e1.rx, camX);
    const r1y = toScreenY(e1.ry, camY);

    // Quick frustum culling: skip segments entirely off-screen
    const minX = Math.min(l0x, r0x, l1x, r1x);
    const maxX = Math.max(l0x, r0x, l1x, r1x);
    const minY = Math.min(l0y, r0y, l1y, r1y);
    const maxY = Math.max(l0y, r0y, l1y, r1y);
    if (maxX < -50 || minX > CANVAS_WIDTH + 50 || maxY < -50 || minY > CANVAS_HEIGHT + 50) {
      continue;
    }

    // Road surface quad
    ctx.beginPath();
    ctx.moveTo(l0x, l0y);
    ctx.lineTo(l1x, l1y);
    ctx.lineTo(r1x, r1y);
    ctx.lineTo(r0x, r0y);
    ctx.closePath();
    ctx.fill();

    // Shoulder (dark inset line on both sides)
    drawShoulderLine(ctx, e0, e1, road[i], road[i + 1], camX, camY);
  }

  // Edge markings (white lines at outer edges)
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = ROAD_EDGE_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Left edge
  ctx.beginPath();
  for (let i = 0; i < edges.length; i++) {
    const sx = toScreenX(edges[i].lx, camX);
    const sy = toScreenY(edges[i].ly, camY);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Right edge
  ctx.beginPath();
  for (let i = 0; i < edges.length; i++) {
    const sx = toScreenX(edges[i].rx, camX);
    const sy = toScreenY(edges[i].ry, camY);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Dashed center line
  drawCenterLine(ctx, road, camX, camY);
}

function drawShoulderLine(
  ctx: CanvasRenderingContext2D,
  e0: SegmentEdge,
  e1: SegmentEdge,
  p0: RoadPoint,
  p1: RoadPoint,
  camX: number,
  camY: number,
): void {
  const insetRatio0 = ROAD_SHOULDER_INSET / (p0.width / 2);
  const insetRatio1 = ROAD_SHOULDER_INSET / (p1.width / 2);

  // Left shoulder
  const sl0lx = lerp(p0.x, e0.lx, 1 - insetRatio0);
  const sl0ly = lerp(p0.y, e0.ly, 1 - insetRatio0);
  const sl1lx = lerp(p1.x, e1.lx, 1 - insetRatio1);
  const sl1ly = lerp(p1.y, e1.ly, 1 - insetRatio1);

  // Right shoulder
  const sl0rx = lerp(p0.x, e0.rx, 1 - insetRatio0);
  const sl0ry = lerp(p0.y, e0.ry, 1 - insetRatio0);
  const sl1rx = lerp(p1.x, e1.rx, 1 - insetRatio1);
  const sl1ry = lerp(p1.y, e1.ry, 1 - insetRatio1);

  ctx.strokeStyle = COLORS.darkGray;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(toScreenX(sl0lx, camX), toScreenY(sl0ly, camY));
  ctx.lineTo(toScreenX(sl1lx, camX), toScreenY(sl1ly, camY));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toScreenX(sl0rx, camX), toScreenY(sl0ry, camY));
  ctx.lineTo(toScreenX(sl1rx, camX), toScreenY(sl1ry, camY));
  ctx.stroke();
}

function drawCenterLine(
  ctx: CanvasRenderingContext2D,
  road: RoadPoint[],
  camX: number,
  camY: number,
): void {
  ctx.strokeStyle = COLORS.lightGray;
  ctx.lineWidth = ROAD_CENTER_LINE_WIDTH;
  ctx.setLineDash([ROAD_CENTER_DASH, ROAD_CENTER_GAP]);

  ctx.beginPath();
  for (let i = 0; i < road.length; i++) {
    const sx = toScreenX(road[i].x, camX);
    const sy = toScreenY(road[i].y, camY);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  ctx.setLineDash([]);
}

// ── 3. Start/Finish lines ───────────────────────────────────────────

function drawStartFinishLines(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  const road = state.track.road;
  drawCheckerLine(ctx, road, state.track.startLine, camX, camY);
  drawCheckerLine(ctx, road, state.track.finishLine, camX, camY);
}

function drawCheckerLine(
  ctx: CanvasRenderingContext2D,
  road: RoadPoint[],
  segIndex: number,
  camX: number,
  camY: number,
): void {
  if (segIndex < 0 || segIndex >= road.length) return;

  const pt = road[segIndex];
  const edges = computeEdges(road, segIndex);

  const lx = toScreenX(edges.lx, camX);
  const ly = toScreenY(edges.ly, camY);
  const rx = toScreenX(edges.rx, camX);
  const ry = toScreenY(edges.ry, camY);

  // Direction perpendicular to the line from left to right
  const dx = rx - lx;
  const dy = ry - ly;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen === 0) return;

  // Normal to the checker line (along road direction)
  const nx = -dy / lineLen;
  const ny = dx / lineLen;

  const checkerSize = 8;
  const checkerRows = 2;
  const checkerCols = Math.max(1, Math.floor(lineLen / checkerSize));

  for (let row = 0; row < checkerRows; row++) {
    for (let col = 0; col < checkerCols; col++) {
      const isWhite = (row + col) % 2 === 0;
      ctx.fillStyle = isWhite ? '#ffffff' : '#111111';

      const t0 = col / checkerCols;
      const t1 = (col + 1) / checkerCols;

      const x0 = lx + dx * t0 + nx * row * checkerSize;
      const y0 = ly + dy * t0 + ny * row * checkerSize;
      const x1 = lx + dx * t1 + nx * row * checkerSize;
      const y1 = ly + dy * t1 + ny * row * checkerSize;
      const x2 = lx + dx * t1 + nx * (row + 1) * checkerSize;
      const y2 = ly + dy * t1 + ny * (row + 1) * checkerSize;
      const x3 = lx + dx * t0 + nx * (row + 1) * checkerSize;
      const y3 = ly + dy * t0 + ny * (row + 1) * checkerSize;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ── 4. Obstacles ────────────────────────────────────────────────────

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  for (const obs of state.obstacles) {
    const sx = toScreenX(obs.x, camX);
    const sy = toScreenY(obs.y, camY);

    // Frustum cull
    const halfSize = Math.max(obs.width, obs.height) / 2 + 10;
    if (
      sx + halfSize < 0 ||
      sx - halfSize > CANVAS_WIDTH ||
      sy + halfSize < 0 ||
      sy - halfSize > CANVAS_HEIGHT
    ) {
      continue;
    }

    switch (obs.type) {
      case 'arrow_pad':
        drawArrowPad(ctx, obs, sx, sy);
        break;
      case 'spikes':
        drawSpikes(ctx, obs, sx, sy);
        break;
      case 'log':
        drawLog(ctx, obs, sx, sy);
        break;
      case 'rotating_spikes':
        drawRotatingSpikes(ctx, obs, sx, sy);
        break;
    }
  }
}

function drawArrowPad(
  ctx: CanvasRenderingContext2D,
  obs: ObstacleState,
  sx: number,
  sy: number,
): void {
  ctx.save();
  ctx.translate(sx, sy);
  // boostAngle 0 = arrows point up (sprite default), so rotate by -boostAngle
  ctx.rotate(-obs.boostAngle);
  drawObstacleVector(ctx, obs.type, obs.animFrame, obs.width, obs.height);
  ctx.restore();
}

function drawSpikes(
  ctx: CanvasRenderingContext2D,
  obs: ObstacleState,
  sx: number,
  sy: number,
): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(obs.angle);
  drawObstacleVector(ctx, obs.type, obs.animFrame, obs.width, obs.height);
  ctx.restore();
}

function drawLog(
  ctx: CanvasRenderingContext2D,
  obs: ObstacleState,
  sx: number,
  sy: number,
): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(obs.angle);
  drawObstacleVector(ctx, obs.type, obs.animFrame, obs.width, obs.height);
  ctx.restore();
}

function drawRotatingSpikes(
  ctx: CanvasRenderingContext2D,
  obs: ObstacleState,
  sx: number,
  sy: number,
): void {
  ctx.save();
  ctx.translate(sx, sy);
  drawObstacleVector(ctx, obs.type, obs.animFrame, obs.width, obs.height);
  ctx.restore();
}

// ── 5. Players ──────────────────────────────────────────────────────

function drawPlayers(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  camX: number,
  camY: number,
): void {
  for (const player of state.players) {
    drawPlayer(ctx, player, alpha, camX, camY, state.time);
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  alpha: number,
  camX: number,
  camY: number,
  time: number,
): void {
  // Interpolate position for smooth rendering
  const pos = lerpVec2(player.prevPosition, player.position, alpha);
  const sx = toScreenX(pos.x, camX);
  const sy = toScreenY(pos.y, camY);

  // Off-screen cull
  if (sx < -40 || sx > CANVAS_WIDTH + 40 || sy < -40 || sy > CANVAS_HEIGHT + 40) {
    return;
  }

  ctx.save();

  // Invincibility blink
  if (player.invincibleTimer > 0) {
    const blinkPhase = Math.floor(time / INVINCIBILITY_BLINK_RATE);
    if (blinkPhase % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
  }

  // Death animation
  if (!player.alive) {
    const deathProgress = 1 - Math.max(0, player.deathTimer / DEATH_ANIMATION_DURATION);
    ctx.globalAlpha = Math.max(0, 1 - deathProgress);

    // Spin and shrink
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-(player.angle - Math.PI / 2) + deathProgress * Math.PI * 4);
    ctx.scale(1 - deathProgress * 0.8, 1 - deathProgress * 0.8);

    drawPlayerVector(ctx, player.characterId, player.palette, 48);
    ctx.restore();
    ctx.restore();
    return;
  }

  // Apply jump height offset (visual only, for finish line celebration)
  const jumpOffset = player.jumpHeight ?? 0;

  // Normal rendering with continuous rotation
  ctx.save();
  ctx.translate(sx, sy - jumpOffset);
  ctx.rotate(-(player.angle - Math.PI / 2));
  drawPlayerVector(ctx, player.characterId, player.palette, 48);
  ctx.restore();

  // Effects drawn in screen-space (not rotated), centered on player
  ctx.save();
  ctx.translate(sx, sy - jumpOffset);

  // Draw shadow when jumping
  if (jumpOffset > 1) {
    ctx.globalAlpha = 0.2 * Math.min(1, jumpOffset / 20);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0, jumpOffset, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Boost glow effect
  if (player.boostTimer > 0) {
    ctx.globalAlpha = 0.3 + Math.sin(time * 20) * 0.15;
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stun indicator
  if (player.stunTimer > 0) {
    ctx.globalAlpha = 0.6;
    const starCount = 3;
    for (let i = 0; i < starCount; i++) {
      const starAngle = time * 5 + (i * Math.PI * 2) / starCount;
      const starX = Math.cos(starAngle) * 18;
      const starY = Math.sin(starAngle) * 18 - 12;
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(starX - 2, starY - 2, 4, 4);
    }
  }

  ctx.restore();

  ctx.restore();
}

// ── 6. Particles ────────────────────────────────────────────────────

function drawParticles(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  if (state.particles.length === 0) return;

  for (const p of state.particles) {
    const sx = toScreenX(p.x, camX);
    const sy = toScreenY(p.y, camY);

    // Off-screen cull
    if (sx < -10 || sx > CANVAS_WIDTH + 10 || sy < -10 || sy > CANVAS_HEIGHT + 10) {
      continue;
    }

    const lifeRatio = p.life / p.maxLife;
    ctx.globalAlpha = lifeRatio;
    ctx.fillStyle = p.color;
    ctx.fillRect(
      sx - p.size / 2,
      sy - p.size / 2,
      p.size,
      p.size,
    );
  }

  ctx.globalAlpha = 1;
}

// ── 7. Countdown overlay ────────────────────────────────────────────

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  const step = state.countdownStep;
  if (step < 0 || step > 3) return;

  const text = step > 0 ? `${step}` : 'GO!';

  // Progress within current step (0..1)
  const stepProgress = 1 - (state.countdownTimer % COUNTDOWN_STEP_DURATION) / COUNTDOWN_STEP_DURATION;

  // Scale-up animation: start large, settle to normal
  const scaleBase = 1.0;
  const scalePop = 0.5 * (1 - stepProgress);
  const totalScale = scaleBase + scalePop;

  // Alpha: fade out at end of each step
  const fadeAlpha = stepProgress < 0.7 ? 1.0 : 1.0 - (stepProgress - 0.7) / 0.3;

  ctx.save();
  ctx.globalAlpha = Math.max(0, fadeAlpha);
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
  ctx.scale(totalScale, totalScale);

  // Text style
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Black outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, 0, 0);

  // White fill
  ctx.fillStyle = step > 0 ? '#ffffff' : COLORS.green;
  ctx.fillText(text, 0, 0);

  // Inner glow for "GO!"
  if (step === 0) {
    ctx.globalAlpha = Math.max(0, fadeAlpha * 0.5);
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText(text, 0, 0);
  }

  ctx.restore();
}
