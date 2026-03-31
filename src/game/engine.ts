import type {
  GameConfig,
  TrackData,
  GameResults,
  GameState,
  Vec2,
} from '../types';
import {
  FIXED_TIMESTEP,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEATH_ANIMATION_DURATION,
  RESPAWN_DISTANCE,
  INVINCIBILITY_DURATION,
  TETHER_TELEPORT_DISTANCE,
  TETHER_TELEPORT_BEHIND,
  PLAYER_HITBOX_RADIUS,
} from '../utils/constants';
import {
  distance,
  vec2,
  sub,
  add,
  scale,
  normalize,
} from '../utils/math';
import { initInput, destroyInput, readPlayerInput } from './input';
import { createGameState } from './state';
import { updatePlayer, computeTrackProgress } from './player';
import { updateCamera } from './camera';
import { updateObstacles, checkObstacleCollisions } from './obstacles';
import {
  updateParticles,
  emitDeathParticles,
  emitBoostParticles,
  emitRespawnParticles,
  emitConfetti,
} from './particles';
import { updateCountdown } from './countdown';
import { isPointOnRoad, findNearestRoadPoint } from './collision';
import { getCharacter } from '../data/characters';
import { render as renderGame } from './renderer';
import { audioManager } from './audio';

export function startGame(
  canvas: HTMLCanvasElement,
  config: GameConfig,
  track: TrackData,
  onFinish: (results: GameResults) => void,
): { stop: () => void } {
  const ctx = canvas.getContext('2d')!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const onResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', onResize);

  initInput();
  audioManager.init();
  audioManager.playLoop('sfx_engine');

  const state = createGameState(config, track);
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;
  let rafId = 0;

  function fixedUpdate(dt: number): void {
    state.time += dt;

    // 1. Update countdown
    if (state.phase === 'countdown') {
      updateCountdown(state, dt);
    }

    // 2. Race timer
    if (state.phase === 'racing') {
      state.raceTimer += dt;
    }

    // 3. Update players
    for (const player of state.players) {
      updatePlayer(player, dt, state);
    }

    // 4. Check road collision (lava death) for alive players
    if (state.phase === 'racing') {
      for (let i = 0; i < state.players.length; i++) {
        const player = state.players[i];
        if (!player.alive || player.finishTime !== null) continue;

        const roadCheck = isPointOnRoad(player.position, track.road);
        if (!roadCheck.onRoad) {
          killPlayer(player, i, state);
        }
      }
    }

    // 5. Check obstacle collisions
    if (state.phase === 'racing') {
      for (let i = 0; i < state.players.length; i++) {
        const player = state.players[i];
        if (!player.alive || player.finishTime !== null) continue;

        const result = checkObstacleCollisions(
          player,
          i,
          state.obstacles,
          state.particles,
        );

        if (result === 'death') {
          killPlayer(player, i, state);
        } else if (result === 'boost') {
          emitBoostParticles(
            player.position.x,
            player.position.y,
            state.particles,
          );
          audioManager.play('sfx_boost');
        } else if (result === 'knockback') {
          audioManager.play('sfx_log');
        }
      }
    }

    // 5b. Player-player collisions (bumper car physics)
    if (state.phase === 'racing' && state.players.length >= 2) {
      for (let i = 0; i < state.players.length; i++) {
        for (let j = i + 1; j < state.players.length; j++) {
          const a = state.players[i];
          const b = state.players[j];
          if (!a.alive || !b.alive) continue;
          if (a.finishTime !== null || b.finishTime !== null) continue;

          const dx = b.position.x - a.position.x;
          const dy = b.position.y - a.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = PLAYER_HITBOX_RADIUS * 2;

          if (dist < minDist && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            // Separate positions (immediate, no dt needed)
            const totalInvWeight = 1 / (a.weight + 0.1) + 1 / (b.weight + 0.1);
            const aRatio = (1 / (a.weight + 0.1)) / totalInvWeight;
            const bRatio = (1 / (b.weight + 0.1)) / totalInvWeight;

            a.position.x -= nx * overlap * aRatio;
            a.position.y -= ny * overlap * aRatio;
            b.position.x += nx * overlap * bRatio;
            b.position.y += ny * overlap * bRatio;

            // Relative velocity along collision normal
            const relVx = b.velocity.x - a.velocity.x;
            const relVy = b.velocity.y - a.velocity.y;
            const relVn = relVx * nx + relVy * ny;

            // Only resolve if cars are moving toward each other
            if (relVn < 0) {
              // Impulse magnitude (elastic collision with weight)
              const restitution = 0.8; // bouncy!
              const impulse = -(1 + restitution) * relVn / totalInvWeight;

              const impulseA = impulse / (a.weight + 0.1);
              const impulseB = impulse / (b.weight + 0.1);

              // Apply velocity impulse
              a.velocity.x -= nx * impulseA;
              a.velocity.y -= ny * impulseA;
              b.velocity.x += nx * impulseB;
              b.velocity.y += ny * impulseB;

              // Update scalar speeds from new velocities
              const aDirX = Math.cos(a.angle);
              const aDirY = -Math.sin(a.angle);
              a.speed = a.velocity.x * aDirX + a.velocity.y * aDirY;

              const bDirX = Math.cos(b.angle);
              const bDirY = -Math.sin(b.angle);
              b.speed = b.velocity.x * bDirX + b.velocity.y * bDirY;

              // Add a slight spin (angle perturbation) for visual fun
              const spinForce = 0.15;
              const crossA = nx * aDirY - ny * aDirX;
              a.angle += crossA * spinForce;
              const crossB = nx * bDirY - ny * bDirX;
              b.angle -= crossB * spinForce;
            }
          }
        }
      }
    }

    // 6. Handle death -> respawn flow
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (!player.alive && player.deathTimer <= 0) {
        respawnPlayer(player, state);
      }
    }

    // 7. Compute track progress for all alive players
    for (const player of state.players) {
      if (player.alive) {
        player.trackProgress = computeTrackProgress(player, track.road);
      }
    }

    // 8. Update obstacles
    updateObstacles(state.obstacles, state.time, dt);

    // 9. Update camera
    updateCamera(
      state.camera,
      state.players,
      state.playerCount,
      dt,
    );

    // 10. Update particles
    updateParticles(state.particles, dt);

    // 11. Update engine sound for P1
    if (state.players.length > 0 && state.players[0].alive) {
      audioManager.updateEngineSound(
        Math.abs(state.players[0].speed),
        state.players[0].maxSpeed,
      );
    }

    // 12. Emit boost particles for boosted players
    for (const player of state.players) {
      if (player.alive && player.boostTimer > 0) {
        player.boostParticleTimer -= dt;
        if (player.boostParticleTimer <= 0) {
          player.boostParticleTimer = 0.05;
          emitBoostParticles(
            player.position.x,
            player.position.y,
            state.particles,
          );
        }
      }
    }

    // 12. Check win condition
    if (state.phase === 'racing') {
      checkWinCondition(state);
    }

    // 13. Check tether in multi-player mode
    if (state.playerCount >= 2 && state.phase === 'racing') {
      checkTether(state);
    }
  }

  function killPlayer(
    player: (typeof state.players)[0],
    playerIndex: number,
    gs: GameState,
  ): void {
    player.alive = false;
    player.deathTimer = DEATH_ANIMATION_DURATION;
    player.deaths++;
    player.speed = 0;
    player.velocity = vec2(0, 0);

    const char = getCharacter(player.characterId);
    const color =
      player.palette === 'primary'
        ? char.primaryColor
        : char.rivalColor;
    emitDeathParticles(
      player.position.x,
      player.position.y,
      color,
      gs.particles,
    );
    audioManager.play('sfx_death');
  }

  function respawnPlayer(
    player: (typeof state.players)[0],
    gs: GameState,
  ): void {
    // Walk back RESPAWN_DISTANCE along road centerline
    const nearest = findNearestRoadPoint(player.position, track.road);
    let respawnPos = findRespawnPosition(
      nearest.segIdx,
      nearest.t,
      RESPAWN_DISTANCE,
      track.road,
    );

    player.position = { ...respawnPos };
    player.prevPosition = { ...respawnPos };
    player.speed = 0;
    player.velocity = vec2(0, 0);
    player.alive = true;
    player.invincibleTimer = INVINCIBILITY_DURATION;
    player.animState = 'idle';

    // Face along the road direction at respawn point
    const respawnNearest = findNearestRoadPoint(respawnPos, track.road);
    if (respawnNearest.segIdx < track.road.length - 1) {
      const segStart = track.road[respawnNearest.segIdx];
      const segEnd = track.road[respawnNearest.segIdx + 1];
      const dir = normalize(
        sub(vec2(segEnd.x, segEnd.y), vec2(segStart.x, segStart.y)),
      );
      player.angle = Math.atan2(-dir.y, dir.x);
    }

    emitRespawnParticles(
      player.position.x,
      player.position.y,
      gs.particles,
    );
    audioManager.play('sfx_respawn');
  }

  function findRespawnPosition(
    segIdx: number,
    t: number,
    distBack: number,
    road: typeof track.road,
  ): Vec2 {
    let remaining = distBack;

    // Walk backwards from the fractional position within the current segment
    let curIdx = segIdx;
    let curT = t;

    // First, consume distance within the current segment
    if (curIdx < road.length - 1) {
      const segStart = vec2(road[curIdx].x, road[curIdx].y);
      const segEnd = vec2(road[curIdx + 1].x, road[curIdx + 1].y);
      const segLen = distance(segStart, segEnd);
      const distInSeg = segLen * curT;
      if (distInSeg >= remaining) {
        // Respawn is within this segment
        const newT = curT - remaining / segLen;
        return add(segStart, scale(sub(segEnd, segStart), newT));
      }
      remaining -= distInSeg;
      curIdx--;
    }

    // Walk through previous segments
    while (curIdx >= 0 && remaining > 0) {
      const segStart = vec2(road[curIdx].x, road[curIdx].y);
      const segEnd = vec2(
        road[curIdx + 1].x,
        road[curIdx + 1].y,
      );
      const segLen = distance(segStart, segEnd);
      if (segLen >= remaining) {
        const newT = 1 - remaining / segLen;
        return add(segStart, scale(sub(segEnd, segStart), newT));
      }
      remaining -= segLen;
      curIdx--;
    }

    // Fallback: return start of road
    return vec2(road[0].x, road[0].y);
  }

  function checkWinCondition(gs: GameState): void {
    if (gs.phase !== 'racing') return;

    for (let i = 0; i < gs.players.length; i++) {
      const player = gs.players[i];
      if (!player.alive || player.finishTime !== null) continue;

      // Check if player crossed finish line
      const nearest = findNearestRoadPoint(player.position, track.road);
      if (nearest.segIdx >= track.finishLine) {
        player.finishTime = gs.raceTimer;

        if (gs.winner === null) {
          gs.winner = i;
          emitConfetti(
            player.position.x,
            player.position.y,
            gs.particles,
          );
          audioManager.play('sfx_finish');
        }
      }
    }

    // Check if all players have finished
    const allFinished = gs.players.every((p) => p.finishTime !== null);
    if (allFinished || (gs.winner !== null && gs.playerCount === 1)) {
      gs.phase = 'finished';
      onFinish(buildResults(gs));
    }

    // In multi-player mode, end after all finish or after a timeout
    if (
      gs.playerCount >= 2 &&
      gs.winner !== null &&
      gs.players.some((p) => p.finishTime === null)
    ) {
      // Give the other players some time to finish (10 seconds)
      const winnerTime = gs.players[gs.winner].finishTime!;
      if (gs.raceTimer - winnerTime > 10) {
        gs.phase = 'finished';
        onFinish(buildResults(gs));
      }
    }
  }

  function checkTether(gs: GameState): void {
    if (gs.players.length < 2) return;

    // Find the leader (max trackProgress among alive, unfinished players)
    let leader: typeof gs.players[0] | null = null;
    for (const p of gs.players) {
      if (!p.alive || p.finishTime !== null) continue;
      if (!leader || p.trackProgress > leader.trackProgress) {
        leader = p;
      }
    }
    if (!leader) return;

    // Teleport any trailer that is too far behind the leader
    for (const p of gs.players) {
      if (p === leader) continue;
      if (!p.alive || p.finishTime !== null) continue;

      const dist = distance(p.position, leader.position);
      if (dist > TETHER_TELEPORT_DISTANCE) {
        const leaderNearest = findNearestRoadPoint(
          leader.position,
          track.road,
        );
        const teleportPos = findRespawnPosition(
          leaderNearest.segIdx,
          leaderNearest.t,
          TETHER_TELEPORT_BEHIND,
          track.road,
        );

        p.position = { ...teleportPos };
        p.prevPosition = { ...teleportPos };
        p.speed = leader.speed * 0.5;

        emitRespawnParticles(
          p.position.x,
          p.position.y,
          gs.particles,
        );
      }
    }
  }

  function buildResults(gs: GameState): GameResults {
    return {
      playerCount: gs.playerCount,
      winner: gs.winner,
      players: gs.players.map((p) => ({
        characterId: p.characterId,
        finishTime: p.finishTime,
        deaths: p.deaths,
      })),
    };
  }

  function render(alpha: number): void {
    // Handle resize
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Non-uniform stretch: map virtual viewport directly to window dimensions.
    // This stretches slightly on non-9:16 screens but fills 100% with no bars.
    ctx.save();
    ctx.scale(canvas.width / CANVAS_WIDTH, canvas.height / CANVAS_HEIGHT);

    renderGame(ctx, state, alpha);

    ctx.restore();

    // Expose state to HUD overlay via custom canvas property
    (canvas as unknown as { __gameState: GameState }).__gameState = state;
  }

  function gameLoop(now: number): void {
    if (!running) return;

    const frameTime = Math.min((now - lastTime) / 1000, 0.1); // Cap at 100ms
    lastTime = now;
    accumulator += frameTime;

    while (accumulator >= FIXED_TIMESTEP) {
      fixedUpdate(FIXED_TIMESTEP);
      accumulator -= FIXED_TIMESTEP;
    }

    const alpha = accumulator / FIXED_TIMESTEP;
    render(alpha);

    rafId = requestAnimationFrame(gameLoop);
  }

  rafId = requestAnimationFrame(gameLoop);

  return {
    stop(): void {
      running = false;
      cancelAnimationFrame(rafId);
      destroyInput();
      window.removeEventListener('resize', onResize);
    },
  };
}
