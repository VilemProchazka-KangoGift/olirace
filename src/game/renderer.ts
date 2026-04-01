import type { GameState, PlayerState, ObstacleState, RoadPoint, Particle, SkidMark, ComicText, RandomEvent } from '../types';
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
  EXHAUST_COLORS,
} from '../utils/constants';
import { lerp, lerpVec2 } from '../utils/math';
import { drawPlayerVector, drawObstacleVector, drawLavaTile } from './vector-sprites';
import { getCharacter } from '../data/characters';

// ── Asphalt texture cache ───────────────────────────────────────────

const asphaltCache = new Map<string, HTMLCanvasElement>();
const ASPHALT_TILE = 64;

function getAsphaltTexture(difficulty: string = 'medium'): HTMLCanvasElement {
  const cached = asphaltCache.get(difficulty);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = ASPHALT_TILE;
  c.height = ASPHALT_TILE;
  const ctx = c.getContext('2d')!;
  const S = ASPHALT_TILE;

  // Seeded RNG for deterministic texture
  let seed = 314159;
  const rng = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >>> 16) / 32768;
  };

  ctx.clearRect(0, 0, S, S);

  // Per-difficulty parameters
  const speckCount = difficulty === 'easy' ? 60 : difficulty === 'hard' ? 180 : 120;
  const crackCount = difficulty === 'easy' ? 0 : difficulty === 'hard' ? 6 : 3;
  const redTint = difficulty === 'hard';

  for (let i = 0; i < speckCount; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = 0.4 + rng() * 0.8;
    const brightness = rng();
    if (redTint) {
      // Hard track: reddish-brown aggregate
      if (brightness < 0.6) {
        ctx.fillStyle = `rgba(40, 10, 0, ${0.08 + rng() * 0.14})`;
      } else if (brightness < 0.85) {
        ctx.fillStyle = `rgba(60, 20, 5, ${0.05 + rng() * 0.08})`;
      } else {
        ctx.fillStyle = `rgba(200, 140, 80, ${0.03 + rng() * 0.04})`;
      }
    } else {
      if (brightness < 0.7) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + rng() * 0.12})`;
      } else if (brightness < 0.9) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.04 + rng() * 0.06})`;
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.03 + rng() * 0.05})`;
      }
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lighter patches (worn areas) — fewer on hard track
  const patchCount = difficulty === 'hard' ? 2 : 4;
  for (let i = 0; i < patchCount; i++) {
    const px = rng() * S;
    const py = rng() * S;
    const pr = 5 + rng() * 10;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.02 + rng() * 0.03})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
  }

  // Hairline cracks
  const crackWidth = difficulty === 'hard' ? 1.0 : 0.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < crackCount; i++) {
    ctx.beginPath();
    let cx = rng() * S;
    let cy = rng() * S;
    ctx.moveTo(cx, cy);
    const segments = 2 + Math.floor(rng() * 3);
    for (let j = 0; j < segments; j++) {
      cx += (rng() - 0.5) * 20;
      cy += (rng() - 0.5) * 20;
      ctx.lineTo(cx, cy);
    }
    const crackAlpha = difficulty === 'hard' ? 0.10 + rng() * 0.12 : 0.06 + rng() * 0.08;
    ctx.strokeStyle = redTint
      ? `rgba(30, 5, 0, ${crackAlpha})`
      : `rgba(0, 0, 0, ${crackAlpha})`;
    ctx.lineWidth = crackWidth + rng() * 0.5;
    ctx.stroke();
  }

  asphaltCache.set(difficulty, c);
  return c;
}

// ── Cached lava decorations ─────────────────────────────────────────

// Seeded pseudo-random for deterministic placement
function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Rock island shapes — cached canvases
let rockIslandsCache: HTMLCanvasElement[] | null = null;
const ROCK_COUNT = 9;
const ROCK_GRID_SPACING = 400;

function getRockIslands(): HTMLCanvasElement[] {
  if (rockIslandsCache) return rockIslandsCache;
  rockIslandsCache = [];

  for (let i = 0; i < ROCK_COUNT; i++) {
    const size = 40 + seededRand(i * 7 + 3) * 40; // 40-80px
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size + 8);
    canvas.height = Math.ceil(size + 8);
    const rc = canvas.getContext('2d')!;

    // Generate irregular polygon (5-7 vertices)
    const vertCount = 5 + Math.floor(seededRand(i * 13 + 1) * 3);
    const vertices: { x: number; y: number }[] = [];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseR = size / 2;

    for (let v = 0; v < vertCount; v++) {
      const angle = (v / vertCount) * Math.PI * 2;
      const r = baseR * (0.6 + seededRand(i * 31 + v * 17) * 0.4);
      vertices.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
    }

    // Dark rock fill
    const darkness = 0x0a + Math.floor(seededRand(i * 23 + 5) * 0x20);
    const rCol = Math.min(0x2a, darkness + 0x10);
    const gCol = Math.min(0x15, Math.floor(darkness * 0.5));
    const bCol = Math.min(0x05, Math.floor(darkness * 0.2));
    rc.fillStyle = `rgb(${rCol},${gCol},${bCol})`;

    rc.beginPath();
    rc.moveTo(vertices[0].x, vertices[0].y);
    for (let v = 1; v < vertices.length; v++) {
      rc.lineTo(vertices[v].x, vertices[v].y);
    }
    rc.closePath();
    rc.fill();

    // Slightly lighter top edge for 3D feel
    rc.strokeStyle = `rgba(60,30,10,0.5)`;
    rc.lineWidth = 1.5;
    rc.beginPath();
    // Draw only the top half of the outline
    const topStart = Math.floor(vertices.length * 0.6);
    const topEnd = vertices.length + Math.floor(vertices.length * 0.3);
    rc.moveTo(vertices[topStart % vertices.length].x, vertices[topStart % vertices.length].y);
    for (let v = topStart + 1; v <= topEnd; v++) {
      const idx = v % vertices.length;
      rc.lineTo(vertices[idx].x, vertices[idx].y);
    }
    rc.stroke();

    rockIslandsCache.push(canvas);
  }
  return rockIslandsCache;
}

// Volcano silhouettes — cached canvas
let volcanoCache: HTMLCanvasElement | null = null;
const VOLCANO_COUNT = 5;
const VOLCANO_SPACING_X = 320;
const VOLCANO_SPACING_Y = 500;

function getVolcanoCanvas(): HTMLCanvasElement {
  if (volcanoCache) return volcanoCache;

  // Large enough to hold all volcano shapes in a row
  const totalW = VOLCANO_COUNT * 200;
  const totalH = 120;
  volcanoCache = document.createElement('canvas');
  volcanoCache.width = totalW;
  volcanoCache.height = totalH;
  const vc = volcanoCache.getContext('2d')!;

  for (let i = 0; i < VOLCANO_COUNT; i++) {
    const baseW = 100 + seededRand(i * 41 + 7) * 100; // 100-200px wide
    const h = 50 + seededRand(i * 53 + 11) * 50; // 50-100px tall
    const cx = i * 200 + 100;
    const baseY = totalH;

    // Dark silhouette triangle/trapezoid
    vc.fillStyle = '#0a0505';
    vc.beginPath();
    // Slight trapezoid top
    const topW = 5 + seededRand(i * 67 + 3) * 15;
    vc.moveTo(cx - topW, baseY - h);
    vc.lineTo(cx + topW, baseY - h);
    vc.lineTo(cx + baseW / 2, baseY);
    vc.lineTo(cx - baseW / 2, baseY);
    vc.closePath();
    vc.fill();

    // Tiny orange glow at peak (volcano vent)
    vc.save();
    vc.globalAlpha = 0.15;
    vc.fillStyle = 'rgb(255,100,20)';
    vc.beginPath();
    vc.arc(cx, baseY - h + 3, 5, 0, Math.PI * 2);
    vc.fill();
    vc.restore();
  }
  return volcanoCache;
}

// ── World-to-screen transform ────────────────────────────────────────

function toScreenX(worldX: number, cameraX: number): number {
  return worldX - cameraX + CANVAS_WIDTH / 2;
}

function toScreenY(worldY: number, cameraY: number): number {
  return worldY - cameraY + CANVAS_HEIGHT / 2;
}

// ── Main render entry point ──────────────────────────────────────────

/**
 * Draw lava at RAW canvas size (no scale transform).
 * Parallax: scrolls at 30% of camera speed, so it feels far below
 * the road (like looking down from a high bridge).
 */
export function renderLavaFullscreen(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  time: number,
  camX: number,
  camY: number,
): void {
  const tile = drawLavaTile(0);
  const tileW = 128;
  const tileH = 128;

  // Parallax: lava scrolls at 30% of camera speed
  const parallax = 0.3;
  const px = camX * parallax;
  const py = camY * parallax;
  const offsetX = ((px % tileW) + tileW) % tileW;
  const offsetY = ((py % tileH) + tileH) % tileH;

  const tilesX = Math.ceil(canvasW / tileW) + 2;
  const tilesY = Math.ceil(canvasH / tileH) + 2;

  for (let ty = -1; ty < tilesY; ty++) {
    for (let tx = -1; tx < tilesX; tx++) {
      ctx.drawImage(
        tile, 0, 0, tileW, tileH,
        Math.floor(tx * tileW - offsetX),
        Math.floor(ty * tileH - offsetY),
        tileW + 1, tileH + 1,
      );
    }
  }

  // ── Volcano silhouettes (very distant, 10% parallax) ──
  const volcanoCanvas = getVolcanoCanvas();
  const volcParallax = 0.10;
  const volcOffX = camX * volcParallax;
  const volcOffY = camY * volcParallax;
  // Tile volcanos in a grid pattern
  const volcRepeatX = VOLCANO_COUNT * VOLCANO_SPACING_X;
  const volcRepeatY = VOLCANO_SPACING_Y;
  const volcBaseX = -((volcOffX % volcRepeatX) + volcRepeatX) % volcRepeatX;
  const volcBaseY = -((volcOffY % volcRepeatY) + volcRepeatY) % volcRepeatY;

  ctx.save();
  ctx.globalAlpha = 0.10;
  for (let gy = volcBaseY - volcRepeatY; gy < canvasH + volcRepeatY; gy += volcRepeatY) {
    for (let gx = volcBaseX - volcRepeatX; gx < canvasW + volcRepeatX; gx += volcRepeatX) {
      // Draw each volcano from the cached strip
      for (let vi = 0; vi < VOLCANO_COUNT; vi++) {
        const vx = gx + vi * VOLCANO_SPACING_X;
        const vy = gy;
        // Skip if completely off-screen
        if (vx + 200 < 0 || vx - 200 > canvasW || vy + 120 < 0 || vy - 120 > canvasH) continue;
        ctx.drawImage(volcanoCanvas, vi * 200, 0, 200, 120, vx - 100, vy - 60, 200, 120);
      }
    }
  }
  ctx.restore();

  // ── Rock islands (45% parallax, between lava and road) ──
  const rocks = getRockIslands();
  const rockParallax = 0.45;
  const rockOffX = camX * rockParallax;
  const rockOffY = camY * rockParallax;
  const rockGridW = ROCK_GRID_SPACING;
  const rockGridH = ROCK_GRID_SPACING;
  // How many grid cells fit on screen
  const rockStartGX = Math.floor((rockOffX - 100) / rockGridW);
  const rockEndGX = Math.floor((rockOffX + canvasW + 100) / rockGridW);
  const rockStartGY = Math.floor((rockOffY - 100) / rockGridH);
  const rockEndGY = Math.floor((rockOffY + canvasH + 100) / rockGridH);

  ctx.save();
  ctx.globalAlpha = 0.8;
  for (let gy = rockStartGY; gy <= rockEndGY; gy++) {
    for (let gx = rockStartGX; gx <= rockEndGX; gx++) {
      // Deterministic rock index and offset for this grid cell
      const cellSeed = gx * 997 + gy * 1013;
      const rockIdx = Math.abs(Math.floor(seededRand(cellSeed) * ROCK_COUNT)) % ROCK_COUNT;
      const jitterX = (seededRand(cellSeed + 1) - 0.5) * rockGridW * 0.6;
      const jitterY = (seededRand(cellSeed + 2) - 0.5) * rockGridH * 0.6;

      const worldX = gx * rockGridW + jitterX;
      const worldY = gy * rockGridH + jitterY;
      const screenX = worldX - rockOffX;
      const screenY = worldY - rockOffY;

      // Skip off-screen
      if (screenX < -80 || screenX > canvasW + 80 || screenY < -80 || screenY > canvasH + 80) continue;

      const rock = rocks[rockIdx];
      ctx.drawImage(rock, screenX - rock.width / 2, screenY - rock.height / 2);
    }
  }
  ctx.restore();

  // ── Lava flow lines (subtle directional streaks) ──
  const flowLineCount = 18;
  const flowRepeatY = 600; // vertical wrap distance in world units
  const flowRepeatX = 500;
  const flowDrift = time * 15; // slow downward drift

  ctx.save();
  ctx.strokeStyle = 'rgba(255,120,20,0.06)';
  ctx.lineCap = 'round';

  // Flow lines use same parallax as lava tiles (30%)
  const flowOffX = camX * 0.3;
  const flowOffY = camY * 0.3;

  for (let i = 0; i < flowLineCount; i++) {
    const baseX = seededRand(i * 71 + 13) * flowRepeatX;
    const baseY = seededRand(i * 89 + 29) * flowRepeatY;
    const lineLen = 60 + seededRand(i * 43 + 7) * 90; // 60-150px
    const lineW = 2 + seededRand(i * 61 + 3); // 2-3px
    const angle = (seededRand(i * 37 + 17) - 0.5) * 0.3; // slight angle variation

    // World position with drift
    const wy = baseY + flowDrift;
    // Wrap vertically
    const wrappedY = ((wy % flowRepeatY) + flowRepeatY) % flowRepeatY;

    // Tile across screen
    const tileStartX = Math.floor((flowOffX - lineLen) / flowRepeatX);
    const tileEndX = Math.floor((flowOffX + canvasW + lineLen) / flowRepeatX);
    const tileStartY = Math.floor((flowOffY + wrappedY - lineLen - flowRepeatY) / flowRepeatY);
    const tileEndY = Math.floor((flowOffY + wrappedY + canvasH + lineLen) / flowRepeatY);

    ctx.lineWidth = lineW;

    for (let fty = tileStartY; fty <= tileEndY; fty++) {
      for (let ftx = tileStartX; ftx <= tileEndX; ftx++) {
        const fsx = baseX + ftx * flowRepeatX - flowOffX;
        const fsy = wrappedY + fty * flowRepeatY - flowOffY;

        if (fsx < -lineLen || fsx > canvasW + lineLen || fsy < -lineLen || fsy > canvasH + lineLen) continue;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(fsx - cosA * lineLen * 0.5, fsy - sinA * lineLen * 0.5);
        ctx.lineTo(fsx + cosA * lineLen * 0.5, fsy + sinA * lineLen * 0.5);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
): void {
  ctx.save();

  const camX = lerp(state.camera.position.x, state.camera.target.x, alpha * 0.5);
  const camY = lerp(state.camera.position.y, state.camera.target.y, alpha * 0.5);

  // 1. Lava background — drawn fullscreen in engine.ts (parallax).
  //    No need to redraw here; the fullscreen pass already covers everything.

  // 2. Road
  drawRoad(ctx, state, camX, camY, state.time);

  // 2a. Road-side environmental details (rocks, lava bubbles)
  drawRoadSideDetails(ctx, state, camX, camY);

  // 2ab. Heat distortion at road edges
  drawHeatDistortion(ctx, state, camX, camY);

  // 2ac. Lighting posts along road edges
  drawLightingPosts(ctx, state, camX, camY);

  // 2b. Skid marks on road
  drawSkidMarks(ctx, state.skidMarks, camX, camY);

  // 3. Start/Finish lines
  drawStartFinishLines(ctx, state, camX, camY);

  // 3b. Grid boxes at starting positions
  drawGridBoxes(ctx, state, camX, camY);

  // 3c. Grandstand / Spectator Area
  drawGrandstand(ctx, state, camX, camY);

  // 3d. Finish arch
  drawFinishArch(ctx, state, camX, camY);

  // 4. Obstacles
  drawObstacles(ctx, state, camX, camY);

  // 4b. Warning signs before dangerous obstacles
  drawWarningSigns(ctx, state, camX, camY);

  // 5. Players
  drawPlayers(ctx, state, alpha, camX, camY);

  // 6. Particles
  drawParticles(ctx, state.particles, camX, camY);

  // 6b. Position indicators above players
  drawPositionIndicators(ctx, state, alpha, camX, camY);

  // 6c. Comic text popups
  drawComicTexts(ctx, state.comicTexts, camX, camY);

  // 6d. Random events
  drawRandomEvents(ctx, state.randomEvents, camX, camY, state.time);

  // 7. Countdown overlay
  if (state.phase === 'countdown') {
    drawCountdown(ctx, state);
    // Countdown explosion particles
    drawParticlesScreenSpace(ctx, state.countdownParticles);
  }

  // 8. Vignette overlay — darkens screen edges
  drawVignette(ctx);

  ctx.restore();
}

// ── 1. Lava background (handled by renderLavaFullscreen in engine) ──

// ── 2. Road drawing ─────────────────────────────────────────────────

interface SegmentEdge {
  lx: number; ly: number; rx: number; ry: number;
}

function computeEdges(road: RoadPoint[], index: number): SegmentEdge {
  const pt = road[index];
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

  const len = Math.sqrt(dirX * dirX + dirY * dirY);
  if (len > 0) { dirX /= len; dirY /= len; }
  else { dirX = 0; dirY = -1; }

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

// ── Helper: compute road direction at a point ───────────────────────

function getRoadDirection(road: RoadPoint[], i: number): { dx: number; dy: number } {
  let dx = 0, dy = 0;
  if (i < road.length - 1) {
    dx += road[i + 1].x - road[i].x;
    dy += road[i + 1].y - road[i].y;
  }
  if (i > 0) {
    dx += road[i].x - road[i - 1].x;
    dy += road[i].y - road[i - 1].y;
  }
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) { dx /= len; dy /= len; }
  else { dx = 0; dy = -1; }
  return { dx, dy };
}

// ── Helper: check if a screen-space quad is visible ─────────────────

function isQuadOnScreen(
  l0x: number, l0y: number, r0x: number, r0y: number,
  l1x: number, l1y: number, r1x: number, r1y: number,
): boolean {
  const minX = Math.min(l0x, r0x, l1x, r1x);
  const maxX = Math.max(l0x, r0x, l1x, r1x);
  const minY = Math.min(l0y, r0y, l1y, r1y);
  const maxY = Math.max(l0y, r0y, l1y, r1y);
  return !(maxX < -50 || minX > CANVAS_WIDTH + 50 || maxY < -50 || minY > CANVAS_HEIGHT + 50);
}

// ── Helper: compute curvature (cross product) at road point ─────────

function getCurvature(road: RoadPoint[], i: number): number {
  if (i <= 0 || i >= road.length - 1) return 0;
  const prev = road[i - 1];
  const cur = road[i];
  const next = road[i + 1];
  const ax = cur.x - prev.x;
  const ay = cur.y - prev.y;
  const bx = next.x - cur.x;
  const by = next.y - cur.y;
  const cross = ax * by - ay * bx;
  const lenA = Math.sqrt(ax * ax + ay * ay);
  const lenB = Math.sqrt(bx * bx + by * by);
  if (lenA < 0.001 || lenB < 0.001) return 0;
  return cross / (lenA * lenB);
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
  time: number,
): void {
  const road = state.track.road;
  if (road.length < 2) return;

  const edges: SegmentEdge[] = [];
  for (let i = 0; i < road.length; i++) {
    edges.push(computeEdges(road, i));
  }

  // ── Road shadow on lava (drop shadow for elevated bridge feel) ──
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < road.length - 1; i++) {
    const e0 = edges[i];
    const e1 = edges[i + 1];

    const l0x = toScreenX(e0.lx, camX) + 6;
    const l0y = toScreenY(e0.ly, camY) + 6;
    const r0x = toScreenX(e0.rx, camX) + 6;
    const r0y = toScreenY(e0.ry, camY) + 6;
    const l1x = toScreenX(e1.lx, camX) + 6;
    const l1y = toScreenY(e1.ly, camY) + 6;
    const r1x = toScreenX(e1.rx, camX) + 6;
    const r1y = toScreenY(e1.ry, camY) + 6;

    const minX = Math.min(l0x, r0x, l1x, r1x);
    const maxX = Math.max(l0x, r0x, l1x, r1x);
    const minY = Math.min(l0y, r0y, l1y, r1y);
    const maxY = Math.max(l0y, r0y, l1y, r1y);
    if (maxX < -50 || minX > CANVAS_WIDTH + 50 || maxY < -50 || minY > CANVAS_HEIGHT + 50) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(l0x, l0y);
    ctx.lineTo(l1x, l1y);
    ctx.lineTo(r1x, r1y);
    ctx.lineTo(r0x, r0y);
    ctx.closePath();
    ctx.fill();
  }

  // Draw filled road segments with asphalt texture
  const asphaltTex = getAsphaltTexture(state.track.difficulty);
  let asphaltPattern: CanvasPattern | null = null;
  try {
    asphaltPattern = ctx.createPattern(asphaltTex, 'repeat');
  } catch { /* fallback to no texture */ }

  // Per-track road surface color
  const roadColor = state.track.difficulty === 'easy' ? '#404858'
    : state.track.difficulty === 'hard' ? '#3a2a2a'
    : COLORS.midGray;

  ctx.fillStyle = roadColor;
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

    const minX = Math.min(l0x, r0x, l1x, r1x);
    const maxX = Math.max(l0x, r0x, l1x, r1x);
    const minY = Math.min(l0y, r0y, l1y, r1y);
    const maxY = Math.max(l0y, r0y, l1y, r1y);
    if (maxX < -50 || minX > CANVAS_WIDTH + 50 || maxY < -50 || minY > CANVAS_HEIGHT + 50) {
      continue;
    }

    // Road segment path
    ctx.beginPath();
    ctx.moveTo(l0x, l0y);
    ctx.lineTo(l1x, l1y);
    ctx.lineTo(r1x, r1y);
    ctx.lineTo(r0x, r0y);
    ctx.closePath();

    // Base road color fill
    ctx.fillStyle = roadColor;
    ctx.fill();

    // Overlay asphalt texture within the clipped segment shape
    if (asphaltPattern) {
      ctx.save();
      // Rebuild the path for clipping
      ctx.beginPath();
      ctx.moveTo(l0x, l0y);
      ctx.lineTo(l1x, l1y);
      ctx.lineTo(r1x, r1y);
      ctx.lineTo(r0x, r0y);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = asphaltPattern;
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
      ctx.restore();
    }

    drawShoulderLine(ctx, e0, e1, road[i], road[i + 1], camX, camY);
  }

  // ── Tire rubber darkening on racing line (inside of curves) ──
  for (let i = 1; i < road.length - 1; i++) {
    const curv = getCurvature(road, i);
    if (Math.abs(curv) < 0.03) continue;

    const re0 = edges[i];
    const re1 = edges[Math.min(i + 1, road.length - 1)];

    // Inside of curve: negative curv = turning left, inside is right; positive = turning right, inside is left
    const insideT0 = curv > 0 ? 0.15 : 0.85;
    const insideT1 = insideT0;

    const s0lx = toScreenX(lerp(re0.lx, re0.rx, insideT0 - 0.075), camX);
    const s0ly = toScreenY(lerp(re0.ly, re0.ry, insideT0 - 0.075), camY);
    const s0rx = toScreenX(lerp(re0.lx, re0.rx, insideT0 + 0.075), camX);
    const s0ry = toScreenY(lerp(re0.ly, re0.ry, insideT0 + 0.075), camY);
    const s1lx = toScreenX(lerp(re1.lx, re1.rx, insideT1 - 0.075), camX);
    const s1ly = toScreenY(lerp(re1.ly, re1.ry, insideT1 - 0.075), camY);
    const s1rx = toScreenX(lerp(re1.lx, re1.rx, insideT1 + 0.075), camX);
    const s1ry = toScreenY(lerp(re1.ly, re1.ry, insideT1 + 0.075), camY);

    if (!isQuadOnScreen(s0lx, s0ly, s0rx, s0ry, s1lx, s1ly, s1rx, s1ry)) continue;

    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.moveTo(s0lx, s0ly);
    ctx.lineTo(s1lx, s1ly);
    ctx.lineTo(s1rx, s1ry);
    ctx.lineTo(s0rx, s0ry);
    ctx.closePath();
    ctx.fill();
  }

  // ── Orange underglow along both road edges (lava light on bridge underside) ──
  for (let i = 0; i < road.length - 1; i++) {
    const e0 = edges[i];
    const e1 = edges[i + 1];

    // Left edge underglow
    const ll0x = toScreenX(e0.lx, camX);
    const ll0y = toScreenY(e0.ly, camY);
    const ll1x = toScreenX(e1.lx, camX);
    const ll1y = toScreenY(e1.ly, camY);

    // Right edge underglow
    const rr0x = toScreenX(e0.rx, camX);
    const rr0y = toScreenY(e0.ry, camY);
    const rr1x = toScreenX(e1.rx, camX);
    const rr1y = toScreenY(e1.ry, camY);

    // Compute perpendicular outward direction for left edge
    const pt0 = road[i];
    const pt1 = road[i + 1];
    let dirX = pt1.x - pt0.x;
    let dirY = pt1.y - pt0.y;
    const dLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dLen > 0) { dirX /= dLen; dirY /= dLen; }
    const perpX = -dirY;
    const perpY = dirX;

    // Left side: extend outward (perpX, perpY direction)
    const glowDist = 12;
    const ol0x = ll0x + perpX * glowDist;
    const ol0y = ll0y + perpY * glowDist;
    const ol1x = ll1x + perpX * glowDist;
    const ol1y = ll1y + perpY * glowDist;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(ll0x, ll0y);
    ctx.lineTo(ll1x, ll1y);
    ctx.lineTo(ol1x, ol1y);
    ctx.lineTo(ol0x, ol0y);
    ctx.closePath();

    // Create a gradient across this band
    const midX = (ll0x + ol0x) / 2;
    const midY = (ll0y + ol0y) / 2;
    const grad = ctx.createRadialGradient(ll0x, ll0y, 0, midX, midY, glowDist);
    grad.addColorStop(0, 'rgba(255,120,20,0.3)');
    grad.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Right side: extend outward (-perpX, -perpY direction)
    const or0x = rr0x - perpX * glowDist;
    const or0y = rr0y - perpY * glowDist;
    const or1x = rr1x - perpX * glowDist;
    const or1y = rr1y - perpY * glowDist;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(rr0x, rr0y);
    ctx.lineTo(rr1x, rr1y);
    ctx.lineTo(or1x, or1y);
    ctx.lineTo(or0x, or0y);
    ctx.closePath();

    const midRX = (rr0x + or0x) / 2;
    const midRY = (rr0y + or0y) / 2;
    const gradR = ctx.createRadialGradient(rr0x, rr0y, 0, midRX, midRY, glowDist);
    gradR.addColorStop(0, 'rgba(255,120,20,0.3)');
    gradR.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = gradR;
    ctx.fill();
    ctx.restore();
  }

  // ── Track-specific edge treatment ──
  drawTrackEdgeTreatment(ctx, state, edges, road, camX, camY, state.track.difficulty);

  // ── Rumble strips (F1-style kerbs) ──
  drawRumbleStrips(ctx, edges, road, camX, camY);

  // ── Guard rails ──
  drawGuardRails(ctx, edges, camX, camY);

  // ── Edge lines ──
  drawEdgeLines(ctx, edges, road, camX, camY, state.track.difficulty);

  drawCenterLine(ctx, road, camX, camY);

  // Animated chevrons on curves
  drawChevrons(ctx, road, edges, camX, camY, time);

  // ── Braking zone hash marks before sharp turns ──
  drawBrakingZones(ctx, road, edges, camX, camY);

  // ── Width transition gore areas ──
  drawGoreAreas(ctx, road, edges, camX, camY);

  // ── Distance markers ──
  drawDistanceMarkers(ctx, road, edges, camX, camY);
}

function drawShoulderLine(
  ctx: CanvasRenderingContext2D,
  e0: SegmentEdge, e1: SegmentEdge,
  p0: RoadPoint, p1: RoadPoint,
  camX: number, camY: number,
): void {
  const insetRatio0 = ROAD_SHOULDER_INSET / (p0.width / 2);
  const insetRatio1 = ROAD_SHOULDER_INSET / (p1.width / 2);

  const sl0lx = lerp(p0.x, e0.lx, 1 - insetRatio0);
  const sl0ly = lerp(p0.y, e0.ly, 1 - insetRatio0);
  const sl1lx = lerp(p1.x, e1.lx, 1 - insetRatio1);
  const sl1ly = lerp(p1.y, e1.ly, 1 - insetRatio1);
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
  camX: number, camY: number,
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

function drawChevrons(
  ctx: CanvasRenderingContext2D,
  road: RoadPoint[],
  edges: SegmentEdge[],
  camX: number, camY: number,
  time: number,
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(224,192,0,0.25)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  for (let i = 1; i < road.length - 1; i++) {
    const prev = road[i - 1];
    const curr = road[i];
    const next = road[i + 1];

    // Direction vectors
    const d0x = curr.x - prev.x;
    const d0y = curr.y - prev.y;
    const d1x = next.x - curr.x;
    const d1y = next.y - curr.y;

    const len0 = Math.sqrt(d0x * d0x + d0y * d0y);
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    if (len0 === 0 || len1 === 0) continue;

    // Cross product gives signed angle change
    const cross = (d0x / len0) * (d1y / len1) - (d0y / len0) * (d1x / len1);
    const absCross = Math.abs(cross);

    if (absCross < 0.05) continue; // not curvy enough

    // Only every 3rd qualifying point to avoid clutter
    if (i % 3 !== 0) continue;

    const sx = toScreenX(curr.x, camX);
    const sy = toScreenY(curr.y, camY);

    // Skip off-screen
    if (sx < -30 || sx > CANVAS_WIDTH + 30 || sy < -30 || sy > CANVAS_HEIGHT + 30) continue;

    // Direction perpendicular (points left of travel)
    const perpX = -(d1y / len1);
    const perpY = (d1x / len1);

    // Curve direction: cross > 0 means turning left in screen, < 0 means right
    // Place chevron on the inside of the curve
    const insideSign = cross > 0 ? -1 : 1;

    // Animate: scroll chevron along road direction based on time
    const scrollOffset = ((time * 40) % 20) - 10;
    const cx = sx + perpX * insideSign * (curr.width * 0.2) + (d1x / len1) * scrollOffset;
    const cy = sy + perpY * insideSign * (curr.width * 0.2) + (d1y / len1) * scrollOffset;

    // Draw chevron pointing in travel direction
    const chevSize = 5;
    const fwdX = d1x / len1;
    const fwdY = d1y / len1;

    ctx.beginPath();
    ctx.moveTo(cx - fwdX * chevSize + perpX * chevSize * 0.5, cy - fwdY * chevSize + perpY * chevSize * 0.5);
    ctx.lineTo(cx + fwdX * chevSize, cy + fwdY * chevSize);
    ctx.lineTo(cx - fwdX * chevSize - perpX * chevSize * 0.5, cy - fwdY * chevSize - perpY * chevSize * 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Rumble strips (F1-style kerbs) ──────────────────────────────────

function drawRumbleStrips(
  ctx: CanvasRenderingContext2D,
  edges: SegmentEdge[],
  road: RoadPoint[],
  camX: number,
  camY: number,
): void {
  let kerbIndex = 0;
  for (let i = 0; i < edges.length; i += 3) {
    const e = edges[i];
    const lx = toScreenX(e.lx, camX);
    const ly = toScreenY(e.ly, camY);
    const rx = toScreenX(e.rx, camX);
    const ry = toScreenY(e.ry, camY);

    // Skip off-screen
    if (Math.min(lx, rx) > CANVAS_WIDTH + 20 || Math.max(lx, rx) < -20 ||
        Math.min(ly, ry) > CANVAS_HEIGHT + 20 || Math.max(ly, ry) < -20) {
      kerbIndex++;
      continue;
    }

    const dir = getRoadDirection(road, i);
    const isRed = kerbIndex % 2 === 0;

    // Left kerb
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(Math.atan2(dir.dy, dir.dx));
    // Main kerb body
    ctx.fillStyle = isRed ? '#cc2020' : '#e8e8f0';
    ctx.fillRect(-4, -3, 8, 6);
    // 3D bottom edge
    ctx.fillStyle = isRed ? '#992020' : '#c0c0d0';
    ctx.fillRect(-4, 2, 8, 1);
    ctx.restore();

    // Right kerb
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(Math.atan2(dir.dy, dir.dx));
    ctx.fillStyle = isRed ? '#cc2020' : '#e8e8f0';
    ctx.fillRect(-4, -3, 8, 6);
    ctx.fillStyle = isRed ? '#992020' : '#c0c0d0';
    ctx.fillRect(-4, 2, 8, 1);
    ctx.restore();

    kerbIndex++;
  }
}

// ── 3D guard rails ─────────────────────────────────────────────────

function drawGuardRails(
  ctx: CanvasRenderingContext2D,
  edges: SegmentEdge[],
  camX: number,
  camY: number,
): void {
  // Draw horizontal rail bars as continuous lines connecting posts
  ctx.strokeStyle = '#a0a8b8';
  ctx.lineWidth = 1;

  // Left rail lines
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < edges.length; i += 6) {
    const lx = toScreenX(edges[i].lx, camX);
    const ly = toScreenY(edges[i].ly, camY);
    if (lx < -50 || lx > CANVAS_WIDTH + 50 || ly < -50 || ly > CANVAS_HEIGHT + 50) {
      started = false;
      continue;
    }
    if (!started) { ctx.moveTo(lx, ly - 1); started = true; }
    else ctx.lineTo(lx, ly - 1);
  }
  ctx.stroke();

  ctx.beginPath();
  started = false;
  for (let i = 0; i < edges.length; i += 6) {
    const lx = toScreenX(edges[i].lx, camX);
    const ly = toScreenY(edges[i].ly, camY);
    if (lx < -50 || lx > CANVAS_WIDTH + 50 || ly < -50 || ly > CANVAS_HEIGHT + 50) {
      started = false;
      continue;
    }
    if (!started) { ctx.moveTo(lx, ly + 1); started = true; }
    else ctx.lineTo(lx, ly + 1);
  }
  ctx.stroke();

  // Right rail lines
  ctx.beginPath();
  started = false;
  for (let i = 0; i < edges.length; i += 6) {
    const rx = toScreenX(edges[i].rx, camX);
    const ry = toScreenY(edges[i].ry, camY);
    if (rx < -50 || rx > CANVAS_WIDTH + 50 || ry < -50 || ry > CANVAS_HEIGHT + 50) {
      started = false;
      continue;
    }
    if (!started) { ctx.moveTo(rx, ry - 1); started = true; }
    else ctx.lineTo(rx, ry - 1);
  }
  ctx.stroke();

  ctx.beginPath();
  started = false;
  for (let i = 0; i < edges.length; i += 6) {
    const rx = toScreenX(edges[i].rx, camX);
    const ry = toScreenY(edges[i].ry, camY);
    if (rx < -50 || rx > CANVAS_WIDTH + 50 || ry < -50 || ry > CANVAS_HEIGHT + 50) {
      started = false;
      continue;
    }
    if (!started) { ctx.moveTo(rx, ry + 1); started = true; }
    else ctx.lineTo(rx, ry + 1);
  }
  ctx.stroke();

  // Draw posts at every 6th point
  for (let i = 0; i < edges.length; i += 6) {
    const e = edges[i];
    const lx = toScreenX(e.lx, camX);
    const ly = toScreenY(e.ly, camY);
    const rx = toScreenX(e.rx, camX);
    const ry = toScreenY(e.ry, camY);

    // Left post
    if (lx >= -20 && lx <= CANVAS_WIDTH + 20 && ly >= -20 && ly <= CANVAS_HEIGHT + 20) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(lx - 1, ly + 1, 3, 8);
      // Post body
      ctx.fillStyle = '#a0a8b8';
      ctx.fillRect(lx - 1, ly - 4, 3, 8);
      // 3D highlight top
      ctx.fillStyle = '#c0c8d8';
      ctx.fillRect(lx - 1, ly - 4, 3, 2);
    }

    // Right post
    if (rx >= -20 && rx <= CANVAS_WIDTH + 20 && ry >= -20 && ry <= CANVAS_HEIGHT + 20) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(rx - 1, ry + 1, 3, 8);
      ctx.fillStyle = '#a0a8b8';
      ctx.fillRect(rx - 1, ry - 4, 3, 8);
      ctx.fillStyle = '#c0c8d8';
      ctx.fillRect(rx - 1, ry - 4, 3, 2);
    }
  }
}

// ── Edge lines with optional gap support for hard track ─────────────

function drawEdgeLines(
  ctx: CanvasRenderingContext2D,
  edges: SegmentEdge[],
  road: RoadPoint[],
  camX: number,
  camY: number,
  difficulty: string,
): void {
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = ROAD_EDGE_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Hard track: compute gap positions (every ~10th edge point, 30% chance)
  const gapSet = new Set<number>();
  if (difficulty === 'hard') {
    for (let i = 0; i < edges.length; i += 10) {
      // Pseudo-random based on position to be deterministic
      const hash = (road[i].x * 7 + road[i].y * 13) | 0;
      if (hash % 3 === 0) {
        gapSet.add(i);
        gapSet.add(i + 1);
        gapSet.add(i + 2);
      }
    }
  }

  // Left edge — draw as segments to support gaps
  ctx.beginPath();
  let inGap = false;
  for (let i = 0; i < edges.length; i++) {
    const sx = toScreenX(edges[i].lx, camX);
    const sy = toScreenY(edges[i].ly, camY);
    const shouldGap = gapSet.has(i);
    if (shouldGap && !inGap) {
      ctx.stroke();
      ctx.beginPath();
      inGap = true;
    } else if (!shouldGap && inGap) {
      ctx.moveTo(sx, sy);
      inGap = false;
    } else if (!shouldGap) {
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
  }
  ctx.stroke();

  // Right edge
  ctx.beginPath();
  inGap = false;
  for (let i = 0; i < edges.length; i++) {
    const sx = toScreenX(edges[i].rx, camX);
    const sy = toScreenY(edges[i].ry, camY);
    const shouldGap = gapSet.has(i);
    if (shouldGap && !inGap) {
      ctx.stroke();
      ctx.beginPath();
      inGap = true;
    } else if (!shouldGap && inGap) {
      ctx.moveTo(sx, sy);
      inGap = false;
    } else if (!shouldGap) {
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
  }
  ctx.stroke();
}

// ── Track-specific edge treatment ───────────────────────────────────

function drawTrackEdgeTreatment(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  edges: SegmentEdge[],
  road: RoadPoint[],
  camX: number,
  camY: number,
  difficulty: string,
): void {
  if (difficulty === 'easy') {
    // Green grass strip between road edge and lava
    drawGrassEdge(ctx, edges, road, camX, camY);
  } else if (difficulty === 'medium') {
    // Glowing crack lines near edges
    drawLavaCracks(ctx, edges, road, camX, camY);
  } else if (difficulty === 'hard') {
    // Crumbling edge fragments
    drawCrumblingEdge(ctx, edges, road, camX, camY);
  }
}

function drawGrassEdge(
  ctx: CanvasRenderingContext2D,
  edges: SegmentEdge[],
  road: RoadPoint[],
  camX: number,
  camY: number,
): void {
  const grassWidth = 8;
  ctx.save();
  ctx.globalAlpha = 0.8;

  for (let i = 0; i < road.length - 1; i++) {
    const e0 = edges[i];
    const e1 = edges[i + 1];
    const dir0 = getRoadDirection(road, i);
    const dir1 = getRoadDirection(road, i + 1);
    const perp0x = -dir0.dy;
    const perp0y = dir0.dx;
    const perp1x = -dir1.dy;
    const perp1y = dir1.dx;

    // Left grass strip
    const gll0x = toScreenX(e0.lx, camX);
    const gll0y = toScreenY(e0.ly, camY);
    const gll1x = toScreenX(e1.lx, camX);
    const gll1y = toScreenY(e1.ly, camY);
    const glo0x = toScreenX(e0.lx + perp0x * grassWidth, camX);
    const glo0y = toScreenY(e0.ly + perp0y * grassWidth, camY);
    const glo1x = toScreenX(e1.lx + perp1x * grassWidth, camX);
    const glo1y = toScreenY(e1.ly + perp1y * grassWidth, camY);

    if (isQuadOnScreen(gll0x, gll0y, glo0x, glo0y, gll1x, gll1y, glo1x, glo1y)) {
      ctx.fillStyle = '#2a5a20';
      ctx.beginPath();
      ctx.moveTo(gll0x, gll0y);
      ctx.lineTo(gll1x, gll1y);
      ctx.lineTo(glo1x, glo1y);
      ctx.lineTo(glo0x, glo0y);
      ctx.closePath();
      ctx.fill();
      // Darker outer edge
      ctx.fillStyle = '#1a3a10';
      ctx.beginPath();
      ctx.moveTo(glo0x, glo0y);
      ctx.lineTo(glo1x, glo1y);
      const mid0x = (glo0x + gll0x) / 2;
      const mid0y = (glo0y + gll0y) / 2;
      const mid1x = (glo1x + gll1x) / 2;
      const mid1y = (glo1y + gll1y) / 2;
      ctx.lineTo(mid1x, mid1y);
      ctx.lineTo(mid0x, mid0y);
      ctx.closePath();
      ctx.fill();
    }

    // Right grass strip
    const grl0x = toScreenX(e0.rx, camX);
    const grl0y = toScreenY(e0.ry, camY);
    const grl1x = toScreenX(e1.rx, camX);
    const grl1y = toScreenY(e1.ry, camY);
    const gro0x = toScreenX(e0.rx - perp0x * grassWidth, camX);
    const gro0y = toScreenY(e0.ry - perp0y * grassWidth, camY);
    const gro1x = toScreenX(e1.rx - perp1x * grassWidth, camX);
    const gro1y = toScreenY(e1.ry - perp1y * grassWidth, camY);

    if (isQuadOnScreen(grl0x, grl0y, gro0x, gro0y, grl1x, grl1y, gro1x, gro1y)) {
      ctx.fillStyle = '#2a5a20';
      ctx.beginPath();
      ctx.moveTo(grl0x, grl0y);
      ctx.lineTo(grl1x, grl1y);
      ctx.lineTo(gro1x, gro1y);
      ctx.lineTo(gro0x, gro0y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a3a10';
      ctx.beginPath();
      ctx.moveTo(gro0x, gro0y);
      ctx.lineTo(gro1x, gro1y);
      const mid0x = (gro0x + grl0x) / 2;
      const mid0y = (gro0y + grl0y) / 2;
      const mid1x = (gro1x + grl1x) / 2;
      const mid1y = (gro1y + grl1y) / 2;
      ctx.lineTo(mid1x, mid1y);
      ctx.lineTo(mid0x, mid0y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawLavaCracks(
  ctx: CanvasRenderingContext2D,
  edges: SegmentEdge[],
  road: RoadPoint[],
  camX: number,
  camY: number,
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,100,20,0.15)';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < edges.length; i += 20) {
    const e = edges[i];
    const dir = getRoadDirection(road, i);
    const crackPerpX = -dir.dy;
    const crackPerpY = dir.dx;

    // Left side crack
    const lsx = toScreenX(e.lx, camX);
    const lsy = toScreenY(e.ly, camY);
    if (lsx >= -20 && lsx <= CANVAS_WIDTH + 20 && lsy >= -20 && lsy <= CANVAS_HEIGHT + 20) {
      ctx.beginPath();
      ctx.moveTo(lsx, lsy);
      const crackLen = 5 + ((road[i].x * 17 + road[i].y * 31) % 6);
      let cx = lsx;
      let cy = lsy;
      for (let j = 0; j < 3; j++) {
        cx -= crackPerpX * crackLen / 3 + ((j * 7 + i) % 5 - 2);
        cy -= crackPerpY * crackLen / 3 + ((j * 11 + i) % 5 - 2);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Right side crack
    const rsx = toScreenX(e.rx, camX);
    const rsy = toScreenY(e.ry, camY);
    if (rsx >= -20 && rsx <= CANVAS_WIDTH + 20 && rsy >= -20 && rsy <= CANVAS_HEIGHT + 20) {
      ctx.beginPath();
      ctx.moveTo(rsx, rsy);
      const crackLen = 5 + ((road[i].x * 23 + road[i].y * 37) % 6);
      let cx = rsx;
      let cy = rsy;
      for (let j = 0; j < 3; j++) {
        cx += crackPerpX * crackLen / 3 + ((j * 13 + i) % 5 - 2);
        cy += crackPerpY * crackLen / 3 + ((j * 17 + i) % 5 - 2);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCrumblingEdge(
  ctx: CanvasRenderingContext2D,
  edges: SegmentEdge[],
  road: RoadPoint[],
  camX: number,
  camY: number,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.midGray;
  ctx.globalAlpha = 0.6;

  for (let i = 0; i < edges.length; i += 10) {
    const e = edges[i];
    const dir = getRoadDirection(road, i);
    const crumblePerpX = -dir.dy;
    const crumblePerpY = dir.dx;

    // Pseudo-random seed from position
    const cseed = ((road[i].x * 7 + road[i].y * 13) | 0) & 0xffff;

    // Left side chunks
    const clsx = toScreenX(e.lx, camX);
    const clsy = toScreenY(e.ly, camY);
    if (clsx >= -30 && clsx <= CANVAS_WIDTH + 30 && clsy >= -30 && clsy <= CANVAS_HEIGHT + 30) {
      for (let c = 0; c < 2 + (cseed % 2); c++) {
        const offsetDist = 3 + (((cseed + c * 31) % 7));
        const offsetAlong = ((cseed + c * 17) % 9) - 4;
        const chunkX = clsx + crumblePerpX * offsetDist + dir.dx * offsetAlong;
        const chunkY = clsy + crumblePerpY * offsetDist + dir.dy * offsetAlong;
        const chunkSize = 2 + ((cseed + c * 23) % 3);
        const rot = ((cseed + c * 41) % 628) / 100;

        ctx.save();
        ctx.translate(chunkX, chunkY);
        ctx.rotate(rot);
        ctx.fillRect(-chunkSize / 2, -chunkSize / 2, chunkSize, chunkSize * 0.7);
        ctx.restore();
      }
    }

    // Right side chunks
    const crsx = toScreenX(e.rx, camX);
    const crsy = toScreenY(e.ry, camY);
    if (crsx >= -30 && crsx <= CANVAS_WIDTH + 30 && crsy >= -30 && crsy <= CANVAS_HEIGHT + 30) {
      for (let c = 0; c < 2 + ((cseed + 7) % 2); c++) {
        const offsetDist = 3 + (((cseed + c * 37 + 11) % 7));
        const offsetAlong = ((cseed + c * 19 + 5) % 9) - 4;
        const chunkX = crsx - crumblePerpX * offsetDist + dir.dx * offsetAlong;
        const chunkY = crsy - crumblePerpY * offsetDist + dir.dy * offsetAlong;
        const chunkSize = 2 + ((cseed + c * 29 + 3) % 3);
        const rot = ((cseed + c * 43 + 7) % 628) / 100;

        ctx.save();
        ctx.translate(chunkX, chunkY);
        ctx.rotate(rot);
        ctx.fillRect(-chunkSize / 2, -chunkSize / 2, chunkSize, chunkSize * 0.7);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

// ── Braking zone hash marks before sharp turns ─────────────────────

function drawBrakingZones(
  ctx: CanvasRenderingContext2D,
  road: RoadPoint[],
  edges: SegmentEdge[],
  camX: number,
  camY: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';

  for (let i = 2; i < road.length - 1; i++) {
    const curv = Math.abs(getCurvature(road, i));
    if (curv < 0.06) continue;

    // Draw 3-4 hash marks starting ~100px before this point
    const hashCount = curv > 0.1 ? 4 : 3;
    for (let h = 0; h < hashCount; h++) {
      const idx = i - 20 - h * 4;
      if (idx < 0 || idx >= road.length) continue;

      const e = edges[idx];
      const p = road[idx];
      const halfMarkW = p.width * 0.3;

      const dir = getRoadDirection(road, idx);
      const brakePerpX = -dir.dy;
      const brakePerpY = dir.dx;

      const bcx = toScreenX(p.x, camX);
      const bcy = toScreenY(p.y, camY);
      const mx1 = bcx + brakePerpX * halfMarkW;
      const my1 = bcy + brakePerpY * halfMarkW;
      const mx2 = bcx - brakePerpX * halfMarkW;
      const my2 = bcy - brakePerpY * halfMarkW;

      if (Math.min(mx1, mx2) > CANVAS_WIDTH + 20 || Math.max(mx1, mx2) < -20 ||
          Math.min(my1, my2) > CANVAS_HEIGHT + 20 || Math.max(my1, my2) < -20) continue;

      ctx.beginPath();
      ctx.moveTo(mx1 - dir.dx * 1.5, my1 - dir.dy * 1.5);
      ctx.lineTo(mx2 - dir.dx * 1.5, my2 - dir.dy * 1.5);
      ctx.lineTo(mx2 + dir.dx * 1.5, my2 + dir.dy * 1.5);
      ctx.lineTo(mx1 + dir.dx * 1.5, my1 + dir.dy * 1.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── Width transition gore areas ─────────────────────────────────────

function drawGoreAreas(
  ctx: CanvasRenderingContext2D,
  road: RoadPoint[],
  edges: SegmentEdge[],
  camX: number,
  camY: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.3;

  for (let i = 0; i < road.length - 1; i++) {
    const widthDiff = road[i + 1].width - road[i].width;
    if (Math.abs(widthDiff) < 5) continue;

    const ge0 = edges[i];
    const ge1 = edges[i + 1];

    const sides: Array<{
      tip: { x: number; y: number };
      base1: { x: number; y: number };
      base2: { x: number; y: number };
    }> = [];

    if (widthDiff < -5) {
      sides.push({
        tip: { x: toScreenX(ge1.lx, camX), y: toScreenY(ge1.ly, camY) },
        base1: { x: toScreenX(ge0.lx, camX), y: toScreenY(ge0.ly, camY) },
        base2: { x: toScreenX(lerp(ge0.lx, ge1.lx, 0.5), camX), y: toScreenY(lerp(ge0.ly, ge1.ly, 0.5), camY) },
      });
      sides.push({
        tip: { x: toScreenX(ge1.rx, camX), y: toScreenY(ge1.ry, camY) },
        base1: { x: toScreenX(ge0.rx, camX), y: toScreenY(ge0.ry, camY) },
        base2: { x: toScreenX(lerp(ge0.rx, ge1.rx, 0.5), camX), y: toScreenY(lerp(ge0.ry, ge1.ry, 0.5), camY) },
      });
    } else {
      sides.push({
        tip: { x: toScreenX(ge0.lx, camX), y: toScreenY(ge0.ly, camY) },
        base1: { x: toScreenX(ge1.lx, camX), y: toScreenY(ge1.ly, camY) },
        base2: { x: toScreenX(lerp(ge0.lx, ge1.lx, 0.5), camX), y: toScreenY(lerp(ge0.ly, ge1.ly, 0.5), camY) },
      });
      sides.push({
        tip: { x: toScreenX(ge0.rx, camX), y: toScreenY(ge0.ry, camY) },
        base1: { x: toScreenX(ge1.rx, camX), y: toScreenY(ge1.ry, camY) },
        base2: { x: toScreenX(lerp(ge0.rx, ge1.rx, 0.5), camX), y: toScreenY(lerp(ge0.ry, ge1.ry, 0.5), camY) },
      });
    }

    for (const tri of sides) {
      const allX = [tri.tip.x, tri.base1.x, tri.base2.x];
      const allY = [tri.tip.y, tri.base1.y, tri.base2.y];
      if (Math.min(...allX) > CANVAS_WIDTH + 20 || Math.max(...allX) < -20 ||
          Math.min(...allY) > CANVAS_HEIGHT + 20 || Math.max(...allY) < -20) continue;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tri.tip.x, tri.tip.y);
      ctx.lineTo(tri.base1.x, tri.base1.y);
      ctx.lineTo(tri.base2.x, tri.base2.y);
      ctx.closePath();
      ctx.clip();

      const bx = Math.min(tri.tip.x, tri.base1.x, tri.base2.x);
      const by = Math.min(tri.tip.y, tri.base1.y, tri.base2.y);
      const bw = Math.max(tri.tip.x, tri.base1.x, tri.base2.x) - bx;
      const bh = Math.max(tri.tip.y, tri.base1.y, tri.base2.y) - by;
      const stripeW = 4;
      const totalStripes = Math.ceil((bw + bh) / stripeW) + 2;

      for (let s = 0; s < totalStripes; s++) {
        const isRedStripe = s % 2 === 0;
        ctx.fillStyle = isRedStripe ? '#cc2020' : '#e8e8f0';
        const offset = s * stripeW;
        ctx.beginPath();
        ctx.moveTo(bx + offset, by);
        ctx.lineTo(bx + offset + stripeW, by);
        ctx.lineTo(bx + offset + stripeW - bh, by + bh);
        ctx.lineTo(bx + offset - bh, by + bh);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }
  ctx.restore();
}

// ── Distance markers (every ~200 road points) ──────────────────────

function drawDistanceMarkers(
  ctx: CanvasRenderingContext2D,
  road: RoadPoint[],
  edges: SegmentEdge[],
  camX: number,
  camY: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';

  for (let i = 200; i < road.length; i += 200) {
    const e = edges[i];
    const lx = toScreenX(e.lx, camX);
    const ly = toScreenY(e.ly, camY);
    const rx = toScreenX(e.rx, camX);
    const ry = toScreenY(e.ry, camY);

    if (Math.min(lx, rx) > CANVAS_WIDTH + 20 || Math.max(lx, rx) < -20 ||
        Math.min(ly, ry) > CANVAS_HEIGHT + 20 || Math.max(ly, ry) < -20) continue;

    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();
  }
  ctx.restore();
}

// ── 2a. Road-side environmental details ─────────────────────────────

function drawRoadSideDetails(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number, camY: number,
): void {
  const road = state.track.road;
  if (road.length < 2) return;

  // Deterministic RNG seeded by point index
  const seededRng = (seed: number): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >>> 16) / 32768;
  };

  for (let i = 0; i < road.length - 1; i += 8) {
    const pt = road[i];
    const next = road[Math.min(i + 1, road.length - 1)];

    // Direction & perpendicular
    let dirX = next.x - pt.x;
    let dirY = next.y - pt.y;
    const dLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dLen === 0) continue;
    dirX /= dLen;
    dirY /= dLen;
    const perpX = -dirY;
    const perpY = dirX;
    const halfW = pt.width / 2;

    // Left edge world position
    const lx = pt.x + perpX * halfW;
    const ly = pt.y + perpY * halfW;
    // Right edge world position
    const rx = pt.x - perpX * halfW;
    const ry = pt.y - perpY * halfW;

    // Screen positions for culling
    const slx = toScreenX(lx, camX);
    const sly = toScreenY(ly, camY);
    const srx = toScreenX(rx, camX);
    const sry = toScreenY(ry, camY);

    const onScreen = (sx: number, sy: number) =>
      sx >= -30 && sx <= CANVAS_WIDTH + 30 && sy >= -30 && sy <= CANVAS_HEIGHT + 30;

    // ── Small rocks on both sides ──
    const rockSeed = i * 7919;
    for (let side = 0; side < 2; side++) {
      const ex = side === 0 ? lx : rx;
      const ey = side === 0 ? ly : ry;
      const esx = side === 0 ? slx : srx;
      const esy = side === 0 ? sly : sry;
      const outSign = side === 0 ? 1 : -1;

      if (!onScreen(esx, esy)) continue;

      const rockCount = 1 + Math.floor(seededRng(rockSeed + side * 1000) * 2);
      for (let r = 0; r < rockCount; r++) {
        const rSeed = rockSeed + side * 1000 + r * 137;
        const offset = 8 + seededRng(rSeed) * 7; // 8-15px outward
        const along = (seededRng(rSeed + 1) - 0.5) * 6; // slight scatter along road

        const worldRx = ex + perpX * outSign * offset + dirX * along;
        const worldRy = ey + perpY * outSign * offset + dirY * along;
        const screenRx = toScreenX(worldRx, camX);
        const screenRy = toScreenY(worldRy, camY);

        // Draw irregular rock (3-5 vertex polygon)
        const verts = 3 + Math.floor(seededRng(rSeed + 2) * 3);
        const rockSize = 2 + seededRng(rSeed + 3) * 3;

        ctx.save();
        ctx.fillStyle = '#2a1a0a';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        for (let v = 0; v < verts; v++) {
          const a = (v / verts) * Math.PI * 2;
          const rr = rockSize * (0.6 + seededRng(rSeed + 10 + v) * 0.4);
          const px = screenRx + Math.cos(a) * rr;
          const py = screenRy + Math.sin(a) * rr;
          if (v === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Lava bubble pops along edges ──
    if (i % 32 === 0) { // every ~4 road points at step 8
      const bubbleSin = Math.sin(state.time * 2 + i * 0.7);
      if (bubbleSin > 0.85) {
        const bubbleAlpha = (bubbleSin - 0.85) / 0.15; // 0..1

        for (let side = 0; side < 2; side++) {
          const ex = side === 0 ? lx : rx;
          const ey = side === 0 ? ly : ry;
          const esx = side === 0 ? slx : srx;
          const esy = side === 0 ? sly : sry;
          const outSign = side === 0 ? 1 : -1;

          if (!onScreen(esx, esy)) continue;

          const bx = ex + perpX * outSign * (4 + seededRng(i * 31 + side) * 6);
          const by = ey + perpY * outSign * (4 + seededRng(i * 31 + side) * 6);
          const bsx = toScreenX(bx, camX);
          const bsy = toScreenY(by, camY);
          const bubbleR = 3 + seededRng(i * 17 + side) * 2;

          ctx.save();
          ctx.globalAlpha = bubbleAlpha * 0.7;
          ctx.fillStyle = '#ff8020';
          ctx.beginPath();
          ctx.arc(bsx, bsy, bubbleR, 0, Math.PI * 2);
          ctx.fill();
          // Bright center
          ctx.globalAlpha = bubbleAlpha * 0.5;
          ctx.fillStyle = '#ffcc40';
          ctx.beginPath();
          ctx.arc(bsx, bsy, bubbleR * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }
}

// ── 2ab. Heat distortion at road edges ─────────────────────────────

function drawHeatDistortion(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  const road = state.track.road;
  if (road.length < 2) return;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,150,40,0.12)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  const time = state.time;

  // Iterate every 4th road point for performance
  for (let i = 0; i < road.length - 1; i += 4) {
    const edges = computeEdges(road, i);

    // Left edge point
    const lsx = toScreenX(edges.lx, camX);
    const lsy = toScreenY(edges.ly, camY);
    // Right edge point
    const rsx = toScreenX(edges.rx, camX);
    const rsy = toScreenY(edges.ry, camY);

    // Skip off-screen points
    if (lsx < -20 || lsx > CANVAS_WIDTH + 20 || lsy < -20 || lsy > CANVAS_HEIGHT + 20) {
      if (rsx < -20 || rsx > CANVAS_WIDTH + 20 || rsy < -20 || rsy > CANVAS_HEIGHT + 20) {
        continue;
      }
    }

    // Road direction for perpendicular offset
    const pt = road[i];
    const nextIdx = Math.min(i + 4, road.length - 1);
    const next = road[nextIdx];
    const dx = next.x - pt.x;
    const dy = next.y - pt.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    // Perpendicular (outward from road center)
    const perpX = -dy / len;
    const perpY = dx / len;

    const waveOffset = Math.sin(time * 3 + i * 0.5) * 3;

    // Left edge — wave outward (left)
    const lWaveX = lsx + perpX * (4 + waveOffset);
    const lWaveY = lsy + perpY * (4 + waveOffset);

    // Right edge — wave outward (right, opposite perpendicular)
    const rWaveX = rsx - perpX * (4 + waveOffset);
    const rWaveY = rsy - perpY * (4 + waveOffset);

    // Get next edge point for a short segment
    const nextI = Math.min(i + 4, road.length - 1);
    if (nextI === i) continue;
    const nextEdges = computeEdges(road, nextI);

    const nlsx = toScreenX(nextEdges.lx, camX);
    const nlsy = toScreenY(nextEdges.ly, camY);
    const nrsx = toScreenX(nextEdges.rx, camX);
    const nrsy = toScreenY(nextEdges.ry, camY);

    const nextWave = Math.sin(time * 3 + nextI * 0.5) * 3;

    // Left edge line
    ctx.beginPath();
    ctx.moveTo(lWaveX, lWaveY);
    ctx.lineTo(nlsx + perpX * (4 + nextWave), nlsy + perpY * (4 + nextWave));
    ctx.stroke();

    // Right edge line
    ctx.beginPath();
    ctx.moveTo(rWaveX, rWaveY);
    ctx.lineTo(nrsx - perpX * (4 + nextWave), nrsy - perpY * (4 + nextWave));
    ctx.stroke();
  }

  ctx.restore();
}

// ── 2b. Skid marks ──────────────────────────────────────────────────

function drawSkidMarks(
  ctx: CanvasRenderingContext2D,
  skidMarks: SkidMark[],
  camX: number, camY: number,
): void {
  for (const mark of skidMarks) {
    const sx = toScreenX(mark.x, camX);
    const sy = toScreenY(mark.y, camY);

    if (sx < -20 || sx > CANVAS_WIDTH + 20 || sy < -20 || sy > CANVAS_HEIGHT + 20) continue;

    ctx.save();
    ctx.globalAlpha = mark.opacity * 0.6;
    ctx.translate(sx, sy);
    ctx.rotate(-(mark.angle - Math.PI / 2));
    ctx.fillStyle = mark.color;

    // Two tire tracks
    ctx.fillRect(-8, -1, mark.width, 3);
    ctx.fillRect(4, -1, mark.width, 3);

    ctx.restore();
  }
}

// ── 3. Start/Finish lines ───────────────────────────────────────────

function drawStartFinishLines(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number, camY: number,
): void {
  const road = state.track.road;
  drawCheckerLine(ctx, road, state.track.startLine, camX, camY);
  drawCheckerLine(ctx, road, state.track.finishLine, camX, camY);
}

function drawCheckerLine(
  ctx: CanvasRenderingContext2D,
  road: RoadPoint[],
  segIndex: number,
  camX: number, camY: number,
): void {
  if (segIndex < 0 || segIndex >= road.length) return;

  const edges = computeEdges(road, segIndex);
  const lx = toScreenX(edges.lx, camX);
  const ly = toScreenY(edges.ly, camY);
  const rx = toScreenX(edges.rx, camX);
  const ry = toScreenY(edges.ry, camY);

  const dx = rx - lx;
  const dy = ry - ly;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen === 0) return;

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

// ── 3b. Grid Boxes at starting positions ────────────────────────────

function drawGridBoxes(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  // Only show during countdown or first 3 seconds of race
  if (state.phase !== 'countdown' && !(state.phase === 'racing' && state.raceTimer < 3)) {
    return;
  }

  const positions = state.track.startPositions;
  const entries: Array<[string, { x: number; y: number; angle: number }]> = [];
  entries.push(['P1', positions.p1]);
  entries.push(['P2', positions.p2]);
  if (positions.p3) entries.push(['P3', positions.p3]);
  if (positions.p4) entries.push(['P4', positions.p4]);

  for (const [label, pos] of entries) {
    const sx = toScreenX(pos.x, camX);
    const sy = toScreenY(pos.y, camY);

    // Off-screen cull
    if (sx < -60 || sx > CANVAS_WIDTH + 60 || sy < -60 || sy > CANVAS_HEIGHT + 60) {
      continue;
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-(pos.angle - Math.PI / 2));

    // White rectangular outline (car-sized)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-20, -30, 40, 60);

    // Position label
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }
}

// ── 3c. Grandstand / Spectator Area ────────────────────────────────

function drawGrandstand(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  const road = state.track.road;
  const startIdx = state.track.startLine;
  if (startIdx < 0 || startIdx >= road.length) return;

  const edges = computeEdges(road, startIdx);

  // Position on the LEFT side, offset outward
  const leftX = edges.lx;
  const leftY = edges.ly;
  // Direction from center to left edge (outward)
  const pt = road[startIdx];
  const outDirX = leftX - pt.x;
  const outDirY = leftY - pt.y;
  const outLen = Math.sqrt(outDirX * outDirX + outDirY * outDirY);
  if (outLen === 0) return;
  const normOutX = outDirX / outLen;
  const normOutY = outDirY / outLen;

  // Grandstand center: 45px outward from left edge
  const gx = leftX + normOutX * 45;
  const gy = leftY + normOutY * 45;

  const sx = toScreenX(gx, camX);
  const sy = toScreenY(gy, camY);

  // Off-screen cull
  if (sx < -80 || sx > CANVAS_WIDTH + 80 || sy < -60 || sy > CANVAS_HEIGHT + 60) {
    return;
  }

  // Get road direction for rotation
  let dirX = 0;
  let dirY = -1;
  if (startIdx < road.length - 1) {
    const next = road[startIdx + 1];
    dirX = next.x - pt.x;
    dirY = next.y - pt.y;
    const dLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dLen > 0) { dirX /= dLen; dirY /= dLen; }
  }
  const roadAngle = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(roadAngle + Math.PI / 2);

  // Trapezoidal block (wider at base)
  ctx.fillStyle = '#2a2a3a';
  ctx.beginPath();
  ctx.moveTo(-40, 15);  // bottom-left
  ctx.lineTo(40, 15);   // bottom-right
  ctx.lineTo(30, -15);  // top-right
  ctx.lineTo(-30, -15); // top-left
  ctx.closePath();
  ctx.fill();

  // Roof overhang (darker line at top)
  ctx.strokeStyle = '#1a1a28';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-32, -15);
  ctx.lineTo(32, -15);
  ctx.stroke();

  // Spectator dots (deterministic pattern)
  const spectatorColors = ['#e02020', '#2060e0', '#00c040', '#e0c000', '#e080a0'];
  const rows = 3;
  const dotsPerRow = 9;
  for (let row = 0; row < rows; row++) {
    const rowY = -10 + row * 8;
    const rowWidth = 30 + (rows - row) * 6; // narrower toward top
    for (let d = 0; d < dotsPerRow; d++) {
      const dotX = -rowWidth / 2 + (d / (dotsPerRow - 1)) * rowWidth;
      // Deterministic "random" color
      const colorIdx = (row * dotsPerRow + d * 3 + 7) % spectatorColors.length;
      ctx.fillStyle = spectatorColors[colorIdx];
      ctx.beginPath();
      ctx.arc(dotX, rowY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ── 3d. Finish Line Arch ────────────────────────────────────────────

function drawFinishArch(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  const road = state.track.road;
  const finishIdx = state.track.finishLine;
  if (finishIdx < 0 || finishIdx >= road.length) return;

  const archEdges = computeEdges(road, finishIdx);

  const lx = toScreenX(archEdges.lx, camX);
  const ly = toScreenY(archEdges.ly, camY);
  const rx = toScreenX(archEdges.rx, camX);
  const ry = toScreenY(archEdges.ry, camY);

  // Off-screen cull
  const midX = (lx + rx) / 2;
  const midY = (ly + ry) / 2;
  if (midX < -100 || midX > CANVAS_WIDTH + 100 || midY < -60 || midY > CANVAS_HEIGHT + 60) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.7;

  const postWidth = 4;
  const postHeight = 20;

  // Direction normal to the finish line (along road)
  const dx = rx - lx;
  const dy = ry - ly;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen === 0) { ctx.restore(); return; }
  const nx = -dy / lineLen;
  const ny = dx / lineLen;

  // Posts extend "upward" from the road (in the road normal direction)
  // Left post
  ctx.fillStyle = '#333340';
  ctx.fillRect(lx - postWidth / 2, ly - postHeight, postWidth, postHeight);
  ctx.fillRect(rx - postWidth / 2, ry - postHeight, postWidth, postHeight);

  // Banner connecting the tops of the posts
  const bannerY_l = ly - postHeight;
  const bannerY_r = ry - postHeight;
  const bannerHeight = 8;
  const checkerSize = 6;
  const cols = Math.max(1, Math.floor(lineLen / checkerSize));

  for (let col = 0; col < cols; col++) {
    const t0 = col / cols;
    const t1 = (col + 1) / cols;
    for (let row = 0; row < 2; row++) {
      const isWhite = (row + col) % 2 === 0;
      ctx.fillStyle = isWhite ? '#ffffff' : '#111111';

      const x0 = lx + (rx - lx) * t0;
      const y0 = bannerY_l + (bannerY_r - bannerY_l) * t0 - bannerHeight + row * (bannerHeight / 2);
      const x1 = lx + (rx - lx) * t1;
      const y1 = bannerY_l + (bannerY_r - bannerY_l) * t1 - bannerHeight + row * (bannerHeight / 2);

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1, y1 + bannerHeight / 2);
      ctx.lineTo(x0, y0 + bannerHeight / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // "FINISH" text on the banner
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.5;
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textX = (lx + rx) / 2;
  const textY = (bannerY_l + bannerY_r) / 2 - bannerHeight / 2;
  ctx.fillText('FINISH', textX, textY);

  ctx.restore();
}

// ── 3e. Warning Signs ───────────────────────────────────────────────

function drawWarningSigns(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  for (const obs of state.obstacles) {
    if (obs.type !== 'spikes' && obs.type !== 'rotating_spikes') continue;

    // Find approximate road direction at obstacle position
    // Use obstacle's base position and angle to place sign "upstream"
    const signDist = 90; // 90px before the obstacle
    // Place sign upstream (opposite to road direction at that point)
    // Use the obstacle's boostAngle (original angle) as road direction hint
    const roadAngle = obs.boostAngle;
    // "Before" the obstacle = opposite of travel direction
    const signX = obs.baseX + Math.sin(roadAngle) * signDist;
    const signY = obs.baseY + Math.cos(roadAngle) * signDist;

    const sx = toScreenX(signX, camX);
    const sy = toScreenY(signY, camY);

    // Off-screen cull
    if (sx < -20 || sx > CANVAS_WIDTH + 20 || sy < -30 || sy > CANVAS_HEIGHT + 30) {
      continue;
    }

    // Find nearest road edge to position the sign
    const road = state.track.road;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let ri = 0; ri < road.length; ri++) {
      const rdx = road[ri].x - signX;
      const rdy = road[ri].y - signY;
      const d = rdx * rdx + rdy * rdy;
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = ri;
      }
    }

    const signEdges = computeEdges(road, nearestIdx);
    // Place at the right edge of the road
    const edgeSx = toScreenX(signEdges.rx, camX);
    const edgeSy = toScreenY(signEdges.ry, camY);

    // Post (2px gray line, 8px tall)
    ctx.strokeStyle = '#606878';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(edgeSx, edgeSy);
    ctx.lineTo(edgeSx, edgeSy - 8);
    ctx.stroke();

    // Diamond warning sign (rotated square, 10px side)
    ctx.save();
    ctx.translate(edgeSx, edgeSy - 14);
    ctx.rotate(Math.PI / 4);

    ctx.fillStyle = '#e0c000';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(-5, -5, 10, 10);

    ctx.restore();

    // Exclamation mark
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', edgeSx, edgeSy - 14);
  }
}

// ── 3f. Lighting Posts ──────────────────────────────────────────────

function drawLightingPosts(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number,
  camY: number,
): void {
  const road = state.track.road;
  if (road.length < 2) return;

  const difficulty = state.track.difficulty;

  // Glow color based on difficulty
  let glowColor: string;
  let glowRadius: number;
  let glowAlpha: number;
  switch (difficulty) {
    case 'easy':
      glowColor = '255,240,180';
      glowRadius = 4;
      glowAlpha = 0.3;
      break;
    case 'medium':
      glowColor = '255,140,40';
      glowRadius = 5;
      glowAlpha = 0.3;
      break;
    case 'hard':
    default:
      glowColor = '255,80,20';
      glowRadius = 5;
      glowAlpha = 0.35;
      break;
  }

  for (let i = 0; i < road.length; i += 18) {
    const postEdges = computeEdges(road, i);

    // Left edge post
    const lsx = toScreenX(postEdges.lx, camX);
    const lsy = toScreenY(postEdges.ly, camY);
    // Right edge post
    const rsx = toScreenX(postEdges.rx, camX);
    const rsy = toScreenY(postEdges.ry, camY);

    const posts = [
      { x: lsx, y: lsy },
      { x: rsx, y: rsy },
    ];

    for (const post of posts) {
      // Off-screen cull
      if (post.x < -10 || post.x > CANVAS_WIDTH + 10 || post.y < -20 || post.y > CANVAS_HEIGHT + 20) {
        continue;
      }

      // Post
      ctx.strokeStyle = '#606878';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(post.x, post.y);
      ctx.lineTo(post.x, post.y - 12);
      ctx.stroke();

      // Outer glow (bloom)
      ctx.fillStyle = `rgba(${glowColor},${glowAlpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(post.x, post.y - 12, glowRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Inner glow
      ctx.fillStyle = `rgba(${glowColor},${glowAlpha})`;
      ctx.beginPath();
      ctx.arc(post.x, post.y - 12, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── 4. Obstacles ────────────────────────────────────────────────────

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camX: number, camY: number,
): void {
  // Shadow color tinted by track difficulty
  let shadowTint: string;
  switch (state.track.difficulty) {
    case 'easy':
      shadowTint = '0,8,16'; // slight blue tint
      break;
    case 'hard':
      shadowTint = '24,8,0'; // warmer red tint
      break;
    default:
      shadowTint = '16,8,0'; // slight warm tint
      break;
  }

  for (const obs of state.obstacles) {
    // Skip destroyed obstacles (show rubble instead)
    if (obs.destroyed) {
      drawDestroyedRubble(ctx, obs, camX, camY, state.time);
      continue;
    }

    const sx = toScreenX(obs.x, camX);
    const sy = toScreenY(obs.y, camY);

    const halfSize = Math.max(obs.width, obs.height) / 2 + 10;
    if (sx + halfSize < 0 || sx - halfSize > CANVAS_WIDTH ||
        sy + halfSize < 0 || sy - halfSize > CANVAS_HEIGHT) continue;

    // ── Drop shadow under obstacle (radial gradient, difficulty-tinted) ──
    {
      const shadowRx = halfSize * 0.6;
      const shadowRy = halfSize * 0.25;
      const shadowCx = sx;
      const shadowCy = sy + 3;
      const shadowR = Math.max(shadowRx, shadowRy);
      const grad = ctx.createRadialGradient(shadowCx, shadowCy, 0, shadowCx, shadowCy, shadowR);
      grad.addColorStop(0, `rgba(${shadowTint},0.3)`);
      grad.addColorStop(1, `rgba(${shadowTint},0)`);
      ctx.save();
      ctx.translate(shadowCx, shadowCy);
      ctx.scale(shadowRx / shadowR, shadowRy / shadowR);
      ctx.fillStyle = grad;
      ctx.fillRect(-shadowR, -shadowR, shadowR * 2, shadowR * 2);
      ctx.restore();
    }

    // ── Red danger glow for spikes and rotating_spikes ──
    if (obs.type === 'spikes' || obs.type === 'rotating_spikes') {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#e02020';
      ctx.beginPath();
      ctx.arc(sx, sy, halfSize + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Scale up obstacles by 1.25x ──
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1.25, 1.25);
    ctx.translate(-sx, -sy);

    switch (obs.type) {
      case 'arrow_pad':
        drawArrowPad(ctx, obs, sx, sy, state.time);
        break;
      case 'spikes':
        drawSpikes(ctx, obs, sx, sy, state.time);
        break;
      case 'log':
        drawLog(ctx, obs, sx, sy);
        break;
      case 'rotating_spikes':
        drawRotatingSpikes(ctx, obs, sx, sy);
        break;
      case 'ramp':
        drawRamp(ctx, obs, sx, sy, state.time);
        break;
      case 'destructible':
        drawDestructible(ctx, obs, sx, sy);
        break;
      case 'mud_zone':
        drawMudZone(ctx, obs, sx, sy, state.time);
        break;
      case 'bouncy_wall':
        drawBouncyWall(ctx, obs, sx, sy, state.time);
        break;
    }

    ctx.restore(); // end 1.25x scale
  }
}

function drawArrowPad(ctx: CanvasRenderingContext2D, obs: ObstacleState, sx: number, sy: number, time: number): void {
  // Road markings around the arrow pad
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(sx, sy, obs.width * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Guide lines approaching from travel direction
  const guideAngle = -obs.boostAngle;
  for (let g = 1; g <= 3; g++) {
    const dist = obs.width * 0.8 + g * 10;
    const gx = sx + Math.sin(guideAngle) * dist;
    const gy = sy - Math.cos(guideAngle) * dist;
    ctx.beginPath();
    ctx.moveTo(gx - 3, gy);
    ctx.lineTo(gx + 3, gy);
    ctx.stroke();
  }
  ctx.restore();

  // Pulsing glow
  ctx.save();
  ctx.globalAlpha = Math.sin(time * 4) * 0.1 + 0.15;
  ctx.fillStyle = '#00e0e0';
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(obs.width, obs.height) * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-obs.boostAngle);
  drawObstacleVector(ctx, obs.type, obs.animFrame, obs.width, obs.height);
  ctx.restore();
}

function drawSpikes(ctx: CanvasRenderingContext2D, obs: ObstacleState, sx: number, sy: number, time: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(obs.angle);
  drawObstacleVector(ctx, obs.type, obs.animFrame, obs.width, obs.height);

  // Glint on spike tip
  if (Math.floor(time * 0.5) % 3 === 0) {
    const glintPhase = (time * 0.5) % 1;
    const glintAlpha = Math.sin(glintPhase * Math.PI);
    if (glintAlpha > 0.1) {
      ctx.globalAlpha = glintAlpha * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -obs.height * 0.35, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawLog(ctx: CanvasRenderingContext2D, obs: ObstacleState, sx: number, sy: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(obs.angle);
  drawObstacleVector(ctx, obs.type, obs.animFrame, obs.width, obs.height);
  ctx.restore();
}

function drawRotatingSpikes(ctx: CanvasRenderingContext2D, obs: ObstacleState, sx: number, sy: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  drawObstacleVector(ctx, obs.type, obs.animFrame, obs.width, obs.height);
  ctx.restore();
}

function drawRamp(ctx: CanvasRenderingContext2D, obs: ObstacleState, sx: number, sy: number, time: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(obs.angle);

  const w = obs.width / 2;
  const h = obs.height / 2;

  // Ramp base (dark)
  ctx.fillStyle = COLORS.brownLight;
  ctx.beginPath();
  ctx.moveTo(-w, h);
  ctx.lineTo(w, h);
  ctx.lineTo(w * 0.7, -h);
  ctx.lineTo(-w * 0.7, -h);
  ctx.closePath();
  ctx.fill();

  // Ramp top (lighter)
  ctx.fillStyle = COLORS.brown;
  ctx.beginPath();
  ctx.moveTo(-w * 0.7, -h);
  ctx.lineTo(w * 0.7, -h);
  ctx.lineTo(w * 0.5, -h - 4);
  ctx.lineTo(-w * 0.5, -h - 4);
  ctx.closePath();
  ctx.fill();

  // Arrow indicator
  ctx.fillStyle = COLORS.yellow;
  ctx.globalAlpha = 0.5 + Math.sin(time * 4) * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, -h + 2);
  ctx.lineTo(-5, h - 4);
  ctx.lineTo(5, h - 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDestructible(ctx: CanvasRenderingContext2D, obs: ObstacleState, sx: number, sy: number): void {
  ctx.save();
  ctx.translate(sx, sy);

  const s = obs.width / 2;

  // Barrel/crate
  ctx.fillStyle = COLORS.brown;
  ctx.fillRect(-s, -s, s * 2, s * 2);

  // Cross bands
  ctx.strokeStyle = COLORS.brownLight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s, -s);
  ctx.lineTo(s, s);
  ctx.moveTo(s, -s);
  ctx.lineTo(-s, s);
  ctx.stroke();

  // Border
  ctx.strokeStyle = '#4a3010';
  ctx.lineWidth = 1;
  ctx.strokeRect(-s, -s, s * 2, s * 2);

  ctx.restore();
}

function drawDestroyedRubble(ctx: CanvasRenderingContext2D, obs: ObstacleState, camX: number, camY: number, time: number): void {
  const sx = toScreenX(obs.x, camX);
  const sy = toScreenY(obs.y, camY);
  if (sx < -30 || sx > CANVAS_WIDTH + 30 || sy < -30 || sy > CANVAS_HEIGHT + 30) return;

  // Small rubble pieces
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = COLORS.brown;
  for (let i = 0; i < 4; i++) {
    const ox = Math.sin(i * 2.3 + 1) * 8;
    const oy = Math.cos(i * 1.7 + 2) * 8;
    ctx.fillRect(sx + ox - 2, sy + oy - 2, 4, 4);
  }
  ctx.restore();
}

function drawMudZone(ctx: CanvasRenderingContext2D, obs: ObstacleState, sx: number, sy: number, time: number): void {
  ctx.save();
  ctx.translate(sx, sy);

  const w = obs.width / 2;
  const h = obs.height / 2;

  // Mud puddle (brown circle)
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#5a3010';
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mud surface texture
  ctx.fillStyle = '#6a4020';
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 5; i++) {
    const bx = Math.sin(i * 1.5 + time * 0.3) * w * 0.6;
    const by = Math.cos(i * 2.1 + time * 0.2) * h * 0.6;
    ctx.beginPath();
    ctx.arc(bx, by, 4 + Math.sin(time + i) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Extra "pop" circles that appear and disappear
  for (let j = 0; j < 2; j++) {
    const popPhase = (time * 1.2 + j * 3.7) % 2.5;
    if (popPhase < 0.8) {
      const popAlpha = popPhase < 0.4 ? popPhase / 0.4 : 1 - (popPhase - 0.4) / 0.4;
      const popX = Math.sin(j * 4.1 + 2.3) * w * 0.4;
      const popY = Math.cos(j * 3.3 + 1.1) * h * 0.4;
      const popR = 2 + popPhase * 3;
      ctx.globalAlpha = popAlpha * 0.4;
      ctx.strokeStyle = '#8a6040';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(popX, popY, popR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── Tire ruts through the mud ──
  ctx.strokeStyle = '#3a2008';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.4;
  for (let t = 0; t < 2; t++) {
    const rutOffsetX = (t === 0 ? -0.2 : 0.2) * w;
    ctx.beginPath();
    for (let s = -1; s <= 1; s += 0.1) {
      const rx = rutOffsetX + Math.sin(s * 3 + 0.5) * 2;
      const ry = s * h * 0.8;
      if (s === -1) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.stroke();
  }

  // ── Small stones scattered in mud ──
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#8a7060';
  const stoneSeeds = [1.3, 2.7, 4.1, 5.5];
  for (const ss of stoneSeeds) {
    const stoneX = Math.sin(ss * 2.3) * w * 0.5;
    const stoneY = Math.cos(ss * 1.7) * h * 0.5;
    const stoneR = 1.5 + (ss % 1) * 0.5;
    ctx.beginPath();
    ctx.arc(stoneX, stoneY, stoneR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Puddle highlight (wet reflection) ──
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(w * 0.15, -h * 0.1, w * 0.45, h * 0.35, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBouncyWall(ctx: CanvasRenderingContext2D, obs: ObstacleState, sx: number, sy: number, time: number): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(obs.angle);

  const w = obs.width / 2;
  const h = obs.height / 2;

  // Bouncy squish when recently hit, idle breathing otherwise
  const squish = obs.bounceTimer > 0
    ? 1 + Math.sin(obs.bounceTimer * 30) * 0.3
    : 1 + Math.sin(time * 3) * 0.03;

  ctx.scale(1, squish);

  // Bumper wall (bright colored)
  ctx.fillStyle = '#ff6090';
  ctx.beginPath();
  ctx.roundRect(-w, -h, w * 2, h * 2, 4);
  ctx.fill();

  // Highlight
  ctx.fillStyle = '#ff90b0';
  ctx.fillRect(-w + 2, -h + 1, w * 2 - 4, h * 0.6);

  // Stripes
  ctx.strokeStyle = '#cc4070';
  ctx.lineWidth = 2;
  for (let i = -w + 8; i < w; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, -h);
    ctx.lineTo(i, h);
    ctx.stroke();
  }

  ctx.restore();
}

// ── 5. Players ──────────────────────────────────────────────────────

function drawPlayers(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  camX: number, camY: number,
): void {
  for (const player of state.players) {
    drawPlayer(ctx, player, alpha, camX, camY, state.time);
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  alpha: number,
  camX: number, camY: number,
  time: number,
): void {
  const pos = lerpVec2(player.prevPosition, player.position, alpha);
  const sx = toScreenX(pos.x, camX);
  const sy = toScreenY(pos.y, camY);

  if (sx < -60 || sx > CANVAS_WIDTH + 60 || sy < -60 || sy > CANVAS_HEIGHT + 60) return;

  ctx.save();

  // Invincibility blink
  if (player.invincibleTimer > 0) {
    const blinkPhase = Math.floor(time / INVINCIBILITY_BLINK_RATE);
    if (blinkPhase % 2 === 0) ctx.globalAlpha = 0.4;
  }

  // ── Drop shadow under car (radial gradient) ──
  {
    const shadowRx = 20;
    const shadowRy = 8;
    const shadowCx = sx;
    const shadowCy = sy + 4;
    const shadowR = shadowRx; // max radius for gradient
    const grad = ctx.createRadialGradient(shadowCx, shadowCy, 0, shadowCx, shadowCy, shadowR);
    grad.addColorStop(0, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(shadowCx, shadowCy);
    ctx.scale(1, shadowRy / shadowR);
    ctx.fillStyle = grad;
    ctx.fillRect(-shadowR, -shadowR, shadowR * 2, shadowR * 2);
    ctx.restore();
  }

  // Death animation (ragdoll tumble)
  if (!player.alive) {
    const deathProgress = 1 - Math.max(0, player.deathTimer / DEATH_ANIMATION_DURATION);
    ctx.globalAlpha = Math.max(0, 1 - deathProgress);

    ctx.save();
    ctx.translate(sx, sy);
    // Ragdoll spin (uses ragdollSpin accumulated angle)
    ctx.rotate(-(player.angle - Math.PI / 2));
    const tumbleScale = 1 - deathProgress * 0.8;
    ctx.scale(tumbleScale, tumbleScale);

    drawPlayerVector(ctx, player.characterId, player.palette, 64);
    ctx.restore();
    ctx.restore();
    return;
  }

  // Airborne shadow (radial gradient)
  if (player.airborne && player.airborneHeight > 1) {
    const abShadowRx = 18;
    const abShadowRy = 6;
    const abShadowCx = sx;
    const abShadowCy = sy + 2;
    const abShadowR = abShadowRx;
    const grad = ctx.createRadialGradient(abShadowCx, abShadowCy, 0, abShadowCx, abShadowCy, abShadowR);
    grad.addColorStop(0, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(abShadowCx, abShadowCy);
    ctx.scale(1, abShadowRy / abShadowR);
    ctx.fillStyle = grad;
    ctx.fillRect(-abShadowR, -abShadowR, abShadowR * 2, abShadowR * 2);
    ctx.restore();
  }

  // Jump height offset (finish celebration OR ramp jump)
  const jumpOffset = (player.jumpHeight ?? 0) + (player.airborneHeight ?? 0);

  // Wobbly idle animation
  let wobbleOffset = 0;
  if (player.animState === 'idle' && player.alive && player.finishTime === null) {
    wobbleOffset = Math.sin(player.wobblePhase) * 2;
  }

  // Normal rendering with squash/stretch and drift visual
  ctx.save();
  ctx.translate(sx, sy - jumpOffset + wobbleOffset);

  const visualAngle = -(player.angle - Math.PI / 2) + (player.driftAngle ?? 0);
  ctx.rotate(visualAngle);

  // Apply squash/stretch
  ctx.scale(player.squashX, player.squashY);

  drawPlayerVector(ctx, player.characterId, player.palette, 64);

  // Googly eyes (drawn on top of sprite, in rotated space)
  drawGooglyEyes(ctx, player, time);

  // Expression face
  drawExpression(ctx, player);

  // Damage indicators
  drawDamage(ctx, player);

  ctx.restore();

  // Effects drawn in screen-space (not rotated)
  ctx.save();
  ctx.translate(sx, sy - jumpOffset);

  // Draw shadow when jumping (radial gradient)
  if (jumpOffset > 1) {
    const jShadowRx = 16;
    const jShadowRy = 5;
    const jShadowR = jShadowRx;
    const jAlpha = 0.2 * Math.min(1, jumpOffset / 20);
    const jGrad = ctx.createRadialGradient(0, jumpOffset, 0, 0, jumpOffset, jShadowR);
    jGrad.addColorStop(0, `rgba(0,0,0,${jAlpha})`);
    jGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(0, jumpOffset);
    ctx.scale(1, jShadowRy / jShadowR);
    ctx.translate(0, -jumpOffset);
    ctx.fillStyle = jGrad;
    ctx.fillRect(-jShadowR, jumpOffset - jShadowR, jShadowR * 2, jShadowR * 2);
    ctx.restore();
  }

  // Boost glow effect (character-colored)
  if (player.boostTimer > 0) {
    ctx.globalAlpha = 0.3 + Math.sin(time * 20) * 0.15;
    const boostColors = EXHAUST_COLORS[player.characterId] ?? ['#00e0e0'];
    ctx.fillStyle = boostColors[0];
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Drift sparks
  if (player.drifting) {
    ctx.globalAlpha = 0.6;
    const driftCharge = player.driftBoostCharge ?? 0;
    const driftColor = driftCharge > 1.0 ? '#ff4040' : driftCharge > 0.5 ? '#ffcc00' : '#ffffff';
    for (let i = 0; i < 4; i++) {
      const sparkAngle = time * 12 + i * Math.PI / 2;
      const sparkR = 14 + Math.sin(time * 20 + i) * 4;
      const sparkX = Math.cos(sparkAngle) * sparkR;
      const sparkY = Math.sin(sparkAngle) * sparkR;
      ctx.fillStyle = driftColor;
      ctx.fillRect(sparkX - 1.5, sparkY - 1.5, 3, 3);
    }
  }

  // Stun indicator (enhanced dizzy stars)
  if (player.stunTimer > 0) {
    ctx.globalAlpha = 0.7;
    const starCount = 4;
    for (let i = 0; i < starCount; i++) {
      const starAngle = time * 6 + (i * Math.PI * 2) / starCount;
      const starR = 16 + Math.sin(time * 3 + i) * 3;
      const starX = Math.cos(starAngle) * starR;
      const starY = Math.sin(starAngle) * starR - 14;
      // Draw tiny star shape
      ctx.fillStyle = i % 2 === 0 ? COLORS.yellow : '#ffffff';
      drawTinyStar(ctx, starX, starY, 3);
    }
  }

  // Mud effect indicator
  if (player.mudTimer > 0) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = COLORS.brown;
    for (let i = 0; i < 3; i++) {
      const mx = Math.sin(time * 2 + i * 2) * 10;
      const my = Math.cos(time * 1.5 + i * 3) * 10;
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Headlight glow (small yellowish cone ahead of car when driving) ──
  if (player.speed > 10 && player.alive) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffee80';
    // player.angle is the facing direction; compute offset 15px ahead
    const headlightDx = Math.cos(player.angle) * 15;
    const headlightDy = Math.sin(player.angle) * 15;
    // Note: we are in screen-space translated to (0,0) = player position
    // player.angle: 0 = right, PI/2 = down in world, but screen Y is inverted
    // Use the raw angle components for screen space offset
    const hlx = Math.sin(player.angle) * 15;
    const hly = -Math.cos(player.angle) * 15;
    ctx.beginPath();
    ctx.arc(hlx, hly, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawGooglyEyes(ctx: CanvasRenderingContext2D, player: PlayerState, time: number): void {
  // Eyes look in the steering direction
  const lookX = (player.input?.steerX ?? 0) * 2;
  const lookY = -1; // slightly forward

  // Eye positions relative to sprite center (top area)
  const eyeSpacing = 6;
  const eyeY = -8;
  const eyeSize = 4;
  const pupilSize = 2;

  for (let side = -1; side <= 1; side += 2) {
    const ex = side * eyeSpacing;
    const ey = eyeY;

    // White
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Black outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Pupil (follows steering)
    const px = ex + lookX * 1.5;
    const py = ey + lookY;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(px, py, pupilSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExpression(ctx: CanvasRenderingContext2D, player: PlayerState): void {
  if (player.expression === 'neutral') return;

  const mouthY = 2;

  ctx.save();
  switch (player.expression) {
    case 'happy':
      // Smile
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, mouthY, 4, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      break;
    case 'angry':
      // Angry mouth (jagged line)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, mouthY);
      ctx.lineTo(-2, mouthY + 2);
      ctx.lineTo(0, mouthY - 1);
      ctx.lineTo(2, mouthY + 2);
      ctx.lineTo(4, mouthY);
      ctx.stroke();
      // Angry eyebrows (drawn above eyes)
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-9, -13);
      ctx.lineTo(-4, -11);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(9, -13);
      ctx.lineTo(4, -11);
      ctx.stroke();
      break;
    case 'scared':
      // O mouth
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(0, mouthY + 1, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function drawDamage(ctx: CanvasRenderingContext2D, player: PlayerState): void {
  if (player.damageCount === 0) return;

  ctx.save();
  ctx.globalAlpha = 0.6;

  // Bandages/dents based on damage level
  if (player.damageCount >= 1) {
    // Small dent mark
    ctx.strokeStyle = '#333340';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, -5);
    ctx.lineTo(14, -3);
    ctx.lineTo(11, 0);
    ctx.stroke();
  }
  if (player.damageCount >= 2) {
    // Bandage X
    ctx.strokeStyle = '#e8e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-8, 8);
    ctx.moveTo(-8, 4);
    ctx.lineTo(-12, 8);
    ctx.stroke();
  }
  if (player.damageCount >= 3) {
    // Crack lines
    ctx.strokeStyle = '#444450';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(5, 8);
    ctx.lineTo(8, 12);
    ctx.lineTo(6, 14);
    ctx.moveTo(8, 12);
    ctx.lineTo(11, 11);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTinyStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const outerX = cx + Math.cos(angle) * r;
    const outerY = cy + Math.sin(angle) * r;
    const innerAngle = angle + Math.PI / 5;
    const innerX = cx + Math.cos(innerAngle) * r * 0.4;
    const innerY = cy + Math.sin(innerAngle) * r * 0.4;
    if (i === 0) ctx.moveTo(outerX, outerY);
    else ctx.lineTo(outerX, outerY);
    ctx.lineTo(innerX, innerY);
  }
  ctx.closePath();
  ctx.fill();
}

// ── 6. Particles ────────────────────────────────────────────────────

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  camX: number, camY: number,
): void {
  if (particles.length === 0) return;

  for (const p of particles) {
    const sx = toScreenX(p.x, camX);
    const sy = toScreenY(p.y, camY);

    if (sx < -10 || sx > CANVAS_WIDTH + 10 || sy < -10 || sy > CANVAS_HEIGHT + 10) continue;

    const lifeRatio = p.life / p.maxLife;

    ctx.save();
    ctx.globalAlpha = lifeRatio;

    if (p.type === 'smoke') {
      // Smoke: circle with fade
      ctx.globalAlpha = lifeRatio * 0.4;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'spark') {
      // Spark: bright small dot with trail
      ctx.fillStyle = p.color;
      ctx.globalAlpha = lifeRatio;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
      // Trail
      ctx.globalAlpha = lifeRatio * 0.3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - p.vx * 0.02, sy - p.vy * 0.02);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (p.type === 'flame') {
      // Flame: glowing circle
      ctx.globalAlpha = lifeRatio * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.globalAlpha = lifeRatio * 0.2;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'debris' && p.rotation !== undefined) {
      // Debris: rotated rectangle
      ctx.translate(sx, sy);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    } else if (p.type === 'mud') {
      // Mud: blob
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Default: square
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }

    ctx.restore();
  }
}

// Screen-space particles (for countdown explosions)
function drawParticlesScreenSpace(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const lifeRatio = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = lifeRatio;
    ctx.fillStyle = p.color;
    if (p.type === 'spark') {
      ctx.fillRect(p.x - 1, p.y - 1, p.size, p.size);
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }
}

// ── 6b. Position indicators ─────────────────────────────────────────

function drawPositionIndicators(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  camX: number, camY: number,
): void {
  if (state.playerCount < 2) return;
  if (state.phase === 'countdown') return;

  for (const player of state.players) {
    if (!player.alive || player.finishTime !== null) continue;

    const pos = lerpVec2(player.prevPosition, player.position, alpha);
    const sx = toScreenX(pos.x, camX);
    const sy = toScreenY(pos.y, camY) - 35 - (player.jumpHeight ?? 0) - (player.airborneHeight ?? 0);

    if (sx < -30 || sx > CANVAS_WIDTH + 30 || sy < -30 || sy > CANVAS_HEIGHT + 30) continue;

    const posText = getPositionText(player.racePosition);
    const isLeader = player.racePosition === 1;

    ctx.save();
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background pill
    ctx.fillStyle = isLeader ? '#ff8020' : '#1a1a2e';
    ctx.globalAlpha = 0.8;
    const tw = ctx.measureText(posText).width + 8;
    ctx.beginPath();
    ctx.roundRect(sx - tw / 2, sy - 6, tw, 12, 3);
    ctx.fill();

    // Text
    ctx.globalAlpha = 1;
    ctx.fillStyle = isLeader ? '#ffffff' : '#a0a0b0';
    ctx.fillText(posText, sx, sy);

    // Crown for 1st place
    if (isLeader) {
      ctx.fillStyle = '#e0c000';
      ctx.font = '8px monospace';
      ctx.fillText('\u265B', sx, sy - 12);
    }

    ctx.restore();
  }
}

function getPositionText(pos: number): string {
  switch (pos) {
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    default: return `${pos}th`;
  }
}

// ── 6c. Comic text popups ───────────────────────────────────────────

function drawComicTexts(
  ctx: CanvasRenderingContext2D,
  texts: ComicText[],
  camX: number, camY: number,
): void {
  for (const ct of texts) {
    const sx = toScreenX(ct.x, camX);
    const sy = toScreenY(ct.y, camY);

    if (sx < -50 || sx > CANVAS_WIDTH + 50 || sy < -50 || sy > CANVAS_HEIGHT + 50) continue;

    const lifeRatio = ct.timer / ct.maxLife;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(ct.scale, ct.scale);

    // Fade out at end
    ctx.globalAlpha = lifeRatio < 0.3 ? lifeRatio / 0.3 : 1;

    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Black outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(ct.text, 0, 0);

    // Colored fill
    ctx.fillStyle = ct.color;
    ctx.fillText(ct.text, 0, 0);

    ctx.restore();
  }
}

// ── 6d. Random events ───────────────────────────────────────────────

function drawRandomEvents(
  ctx: CanvasRenderingContext2D,
  events: RandomEvent[],
  camX: number, camY: number,
  time: number,
): void {
  for (const evt of events) {
    const sx = toScreenX(evt.x, camX);
    const sy = toScreenY(evt.y, camY);

    if (sx < -50 || sx > CANVAS_WIDTH + 50 || sy < -50 || sy > CANVAS_HEIGHT + 50) continue;

    ctx.save();
    ctx.translate(sx, sy);

    if (evt.type === 'bird') {
      // Simple pixel bird
      const wingUp = Math.sin(time * 12) > 0;
      ctx.fillStyle = '#333340';
      // Body
      ctx.fillRect(-3, -1, 6, 3);
      // Wings
      if (wingUp) {
        ctx.fillRect(-5, -4, 3, 3);
        ctx.fillRect(2, -4, 3, 3);
      } else {
        ctx.fillRect(-5, 1, 3, 3);
        ctx.fillRect(2, 1, 3, 3);
      }
      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(evt.vx > 0 ? 2 : -3, -1, 1, 1);
    } else if (evt.type === 'ufo') {
      // UFO with beam
      const bob = Math.sin(time * 3) * 3;
      ctx.translate(0, bob);

      // Beam (if hovering)
      const lifeRatio = evt.timer / evt.maxLife;
      if (lifeRatio > 0.3 && lifeRatio < 0.7) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#80ff80';
        ctx.beginPath();
        ctx.moveTo(-5, 5);
        ctx.lineTo(5, 5);
        ctx.lineTo(15, 60);
        ctx.lineTo(-15, 60);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Saucer body
      ctx.fillStyle = '#a0a0b0';
      ctx.beginPath();
      ctx.ellipse(0, 2, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dome
      ctx.fillStyle = '#80ffff';
      ctx.beginPath();
      ctx.ellipse(0, -1, 6, 5, 0, Math.PI, 0);
      ctx.fill();
      // Lights
      ctx.fillStyle = Math.sin(time * 8) > 0 ? '#ff4040' : '#40ff40';
      ctx.beginPath();
      ctx.arc(-8, 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = Math.sin(time * 8 + 1) > 0 ? '#40ff40' : '#ffff40';
      ctx.beginPath();
      ctx.arc(8, 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ── 7. Countdown overlay ────────────────────────────────────────────

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  const step = state.countdownStep;
  if (step < 0 || step > 3) return;

  const text = step > 0 ? `${step}` : 'GO!';

  const stepProgress = 1 - (state.countdownTimer % COUNTDOWN_STEP_DURATION) / COUNTDOWN_STEP_DURATION;

  // ── Countdown spotlight: dark overlay with clear circle at center ──
  ctx.save();
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const spotlightGrad = ctx.createRadialGradient(centerX, centerY, 120, centerX, centerY, Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.7);
  spotlightGrad.addColorStop(0, 'rgba(0,0,0,0)');
  spotlightGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = spotlightGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  // ── Traffic light visual ──
  {
    const tlCx = CANVAS_WIDTH / 2;
    const tlCy = CANVAS_HEIGHT / 2 - 130;
    const circleR = 12;
    const spacing = 30;
    const bgW = 36;
    const bgH = spacing * 2 + circleR * 2 + 16;

    ctx.save();
    // Background housing
    ctx.fillStyle = 'rgba(26,26,46,0.8)';
    ctx.beginPath();
    ctx.roundRect(tlCx - bgW / 2, tlCy - bgH / 2, bgW, bgH, 6);
    ctx.fill();

    const lightColors: [string, string, string] = ['#2a2a3a', '#2a2a3a', '#2a2a3a'];
    const glowColors: [string | null, string | null, string | null] = [null, null, null];

    // step 3 = red, step 2 = amber, step 1 = green, step 0 = green pulsing
    if (step === 3) {
      lightColors[0] = '#e02020';
      glowColors[0] = '#e02020';
    } else if (step === 2) {
      lightColors[1] = '#e0c000';
      glowColors[1] = '#e0c000';
    } else if (step === 1) {
      lightColors[2] = '#00c040';
      glowColors[2] = '#00c040';
    } else if (step === 0) {
      lightColors[2] = '#00ff60';
      glowColors[2] = '#00ff60';
    }

    const goPulse = step === 0 ? 0.7 + Math.sin(stepProgress * Math.PI * 6) * 0.3 : 1;

    for (let i = 0; i < 3; i++) {
      const cy = tlCy - spacing + i * spacing;

      // Glow bloom (larger, lower alpha)
      if (glowColors[i]) {
        ctx.save();
        ctx.globalAlpha = 0.3 * goPulse;
        ctx.fillStyle = glowColors[i]!;
        ctx.beginPath();
        ctx.arc(tlCx, cy, circleR + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Circle
      ctx.globalAlpha = goPulse;
      ctx.fillStyle = lightColors[i];
      ctx.beginPath();
      ctx.arc(tlCx, cy, circleR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Enhanced bounce/rotate animation
  const scaleBase = 1.0;
  const scalePop = 0.5 * (1 - stepProgress);
  const totalScale = scaleBase + scalePop;

  // Rotation wobble on entry
  const rotationWobble = Math.sin(stepProgress * Math.PI * 4) * 0.05 * (1 - stepProgress);

  const fadeAlpha = stepProgress < 0.7 ? 1.0 : 1.0 - (stepProgress - 0.7) / 0.3;

  ctx.save();
  ctx.globalAlpha = Math.max(0, fadeAlpha);
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
  ctx.scale(totalScale, totalScale);
  ctx.rotate(rotationWobble);

  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = Math.max(0, fadeAlpha * 0.3);
  ctx.fillText(text, 3, 3);
  ctx.globalAlpha = Math.max(0, fadeAlpha);

  // Black outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, 0, 0);

  // Colored fill
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

// ── 8. Vignette overlay ─────────────────────────────────────────────

function drawVignette(ctx: CanvasRenderingContext2D): void {
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  const outerRadius = Math.sqrt(cx * cx + cy * cy);

  const grad = ctx.createRadialGradient(cx, cy, outerRadius * 0.4, cx, cy, outerRadius);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.4)');

  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();
}
