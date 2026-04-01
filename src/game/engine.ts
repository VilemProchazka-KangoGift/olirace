import type {
  GameConfig,
  TrackData,
  GameResults,
  GameState,
  Vec2,
  RaceAward,
  ComicText,
  RandomEvent,
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
  SKID_MARK_INTERVAL,
  MAX_SKID_MARKS,
  SKID_MARK_LIFETIME,
  COMIC_TEXT_DURATION,
  MAX_COMIC_TEXTS,
  FLASH_DURATION,
  TURBO_START_WINDOW,
  TURBO_START_BONUS,
  BUMP_RESTITUTION,
  BUMP_SPIN_FORCE,
  BUMP_WEIGHT_EXAGGERATION,
  RANDOM_EVENT_CHANCE,
  EXHAUST_INTERVAL,
  EXHAUST_COLORS,
  COMIC_TEXTS_DEATH,
  COMIC_TEXTS_COLLISION,
  COMIC_TEXTS_BOOST,
  COLORS,
  LAVA_GRACE_ZONE,
  MAX_PARTICLES,
} from '../utils/constants';
import {
  distance,
  vec2,
  sub,
  add,
  scale,
  normalize,
  randomRange,
  randomAngle,
} from '../utils/math';
import { initInput, destroyInput, readPlayerInput, setAIContext } from './input';
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
  emitTireSmoke,
  emitSparks,
  emitLavaSplatter,
  emitExhaust,
  emitBoostFlame,
  emitMudSplatter,
  emitDestructibleDebris,
  emitCountdownParticles,
} from './particles';
import { updateCountdown } from './countdown';
import { findNearestRoadPoint } from './collision';
import { getCharacter } from '../data/characters';
import { render as renderGame, renderLavaFullscreen } from './renderer';
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
  setAIContext(state, config.playerCount);
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;
  let rafId = 0;
  let turboStartReady = false;
  let nextRandomEventTimer = randomRange(10, 20);
  const tireScreechActive = new Set<number>();
  let rumbleStripTimer = 0;

  function addComicText(text: string, x: number, y: number, color: string): void {
    if (state.comicTexts.length >= MAX_COMIC_TEXTS) {
      state.comicTexts.shift();
    }
    state.comicTexts.push({
      text,
      x,
      y,
      timer: COMIC_TEXT_DURATION,
      maxLife: COMIC_TEXT_DURATION,
      color,
      scale: 0,
    });
  }

  function randomComicText(pool: string[]): string {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function triggerHaptic(playerIndex: number, intensity: number, duration: number): void {
    try {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[playerIndex];
      if (gp?.vibrationActuator) {
        (gp.vibrationActuator as any).playEffect('dual-rumble', {
          startDelay: 0,
          duration: duration * 1000,
          weakMagnitude: intensity * 0.5,
          strongMagnitude: intensity,
        });
      }
    } catch {
      // Haptic not available
    }
  }

  function fixedUpdate(dt: number): void {
    state.time += dt;

    // Update flash timer
    if (state.flashTimer > 0) {
      state.flashTimer -= dt;
    }

    // Update comic texts
    for (let i = state.comicTexts.length - 1; i >= 0; i--) {
      const ct = state.comicTexts[i];
      ct.timer -= dt;
      ct.y -= 40 * dt; // float upward
      // Scale pops in then settles
      const progress = 1 - ct.timer / ct.maxLife;
      ct.scale = progress < 0.2 ? progress / 0.2 : 1;
      if (ct.timer <= 0) {
        state.comicTexts[i] = state.comicTexts[state.comicTexts.length - 1];
        state.comicTexts.pop();
      }
    }

    // Update random events
    for (let i = state.randomEvents.length - 1; i >= 0; i--) {
      const evt = state.randomEvents[i];
      evt.x += evt.vx * dt;
      evt.y += evt.vy * dt;
      evt.timer -= dt;
      evt.frame = Math.floor(state.time * 4) % 4;
      if (evt.timer <= 0) {
        state.randomEvents[i] = state.randomEvents[state.randomEvents.length - 1];
        state.randomEvents.pop();
      }
    }

    // Update countdown particles
    updateParticles(state.countdownParticles, dt);

    // Fade skid marks
    for (let i = state.skidMarks.length - 1; i >= 0; i--) {
      state.skidMarks[i].life -= dt;
      state.skidMarks[i].opacity = Math.max(0, state.skidMarks[i].life / SKID_MARK_LIFETIME);
      if (state.skidMarks[i].life <= 0) {
        state.skidMarks[i] = state.skidMarks[state.skidMarks.length - 1];
        state.skidMarks.pop();
      }
    }

    // 1. Update countdown
    if (state.phase === 'countdown') {
      const prevStep = state.countdownStep;
      updateCountdown(state, dt);
      // Countdown number explodes into particles on step change
      if (state.countdownStep !== prevStep && prevStep > 0) {
        const color = prevStep === 0 ? COLORS.green : '#ffffff';
        emitCountdownParticles(
          CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40,
          color, state.countdownParticles,
        );
      }
      // Detect turbo start window
      if (prevStep === 0 && state.countdownStep === -1) {
        turboStartReady = true;
        setTimeout(() => { turboStartReady = false; }, TURBO_START_WINDOW * 1000);
      }
      // Engine rev during countdown — pitch increases as we approach GO
      if (state.countdownStep > 0) {
        const revIntensity = (4 - state.countdownStep) / 3; // 0.33, 0.67, 1.0
        audioManager.updateEngineSound(
          revIntensity * state.players[0].maxSpeed * 0.6,
          state.players[0].maxSpeed,
        );
      }
    }

    // Turbo start check
    if (turboStartReady && state.phase === 'racing') {
      for (let pIdx = 0; pIdx < state.players.length; pIdx++) {
        const player = state.players[pIdx];
        if (player.input.accelerate > 0 && player.turboStartBonus === 0) {
          player.turboStartBonus = player.maxSpeed * TURBO_START_BONUS;
          player.speed = player.turboStartBonus;
          player.squashX = 0.7;
          player.squashY = 1.3;
          player.expression = 'happy';
          player.expressionTimer = 1.0;
          addComicText('TURBO!', player.position.x, player.position.y - 30, COLORS.cyan);
          triggerHaptic(pIdx, 0.5, 0.2);
        }
      }
      turboStartReady = false;
    }

    // 2. Race timer
    if (state.phase === 'racing') {
      state.raceTimer += dt;
    }

    // 3. Cache road position for each player (used by AI, road collision, track progress, win check)
    for (const player of state.players) {
      if (player.alive) {
        player.nearestRoad = findNearestRoadPoint(player.position, track.road);
      }
    }

    // 4. Update players
    for (const player of state.players) {
      updatePlayer(player, dt, state);
    }

    // 5. Check road collision (lava death) for alive players + update road edge info
    if (state.phase === 'racing') {
      for (let i = 0; i < state.players.length; i++) {
        const player = state.players[i];
        if (!player.alive || player.finishTime !== null) continue;

        // Reuse cached nearestRoad from step 3
        const nearest = player.nearestRoad;
        player.distFromRoadCenter = nearest.distance;
        player.roadHalfWidth = nearest.roadWidth / 2;
        const onRoad = nearest.distance <= player.roadHalfWidth + LAVA_GRACE_ZONE;

        if (!onRoad) {
          killPlayer(player, i, state);
        } else {
          // Sparks when scraping edge
          const edgeRatio = player.distFromRoadCenter / player.roadHalfWidth;
          if (edgeRatio > 0.85 && Math.abs(player.speed) > 50) {
            emitSparks(player.position.x, player.position.y, state.particles);
            // Lava splatter near edge
            if (edgeRatio > 0.92) {
              emitLavaSplatter(player.position.x, player.position.y, state.particles);
            }
          }
          // Rumble strip buzz when near edge
          if (edgeRatio > 0.80 && Math.abs(player.speed) > 30) {
            rumbleStripTimer -= dt;
            if (rumbleStripTimer <= 0) {
              rumbleStripTimer = 0.08;
              audioManager.play('sfx_rumble_strip');
            }
          } else {
            rumbleStripTimer = 0;
          }
        }
      }
    }

    // 6. Check obstacle collisions
    if (state.phase === 'racing') {
      for (let i = 0; i < state.players.length; i++) {
        const player = state.players[i];
        if (!player.alive || player.finishTime !== null) continue;

        const result = checkObstacleCollisions(
          player, i, state.obstacles, state.particles,
        );

        if (result === 'death') {
          killPlayer(player, i, state);
        } else if (result === 'boost') {
          emitBoostParticles(player.position.x, player.position.y, state.particles);
          audioManager.play('sfx_boost');
          addComicText(
            randomComicText(COMIC_TEXTS_BOOST),
            player.position.x, player.position.y - 30,
            COLORS.cyan,
          );
          triggerHaptic(i, 0.3, 0.15);
        } else if (result === 'knockback') {
          audioManager.play('sfx_log');
          addComicText('BONK!', player.position.x, player.position.y - 30, COLORS.orange);
          triggerHaptic(i, 0.7, 0.2);
        } else if (result === 'ramp') {
          audioManager.play('sfx_ramp_launch');
          addComicText('JUMP!', player.position.x, player.position.y - 30, COLORS.green);
          triggerHaptic(i, 0.4, 0.1);
        } else if (result === 'destroy') {
          emitDestructibleDebris(player.position.x, player.position.y, state.particles);
          audioManager.play('sfx_barrel_break');
          addComicText('SMASH!', player.position.x, player.position.y - 30, COLORS.orange);
          triggerHaptic(i, 0.5, 0.15);
        } else if (result === 'mud') {
          emitMudSplatter(player.position.x, player.position.y, state.particles);
          audioManager.play('sfx_mud_splat');
        } else if (result === 'bounce') {
          audioManager.play('sfx_boing');
          addComicText('BOING!', player.position.x, player.position.y - 30, COLORS.yellow);
          triggerHaptic(i, 0.6, 0.15);
        }
      }
    }

    // 5b. Player-player collisions (exaggerated cartoon physics)
    if (state.phase === 'racing' && state.players.length >= 2) {
      for (let i = 0; i < state.players.length; i++) {
        for (let j = i + 1; j < state.players.length; j++) {
          const a = state.players[i];
          const b = state.players[j];
          if (!a.alive || !b.alive) continue;
          if (a.finishTime !== null || b.finishTime !== null) continue;
          if (a.airborne || b.airborne) continue;

          const dx = b.position.x - a.position.x;
          const dy = b.position.y - a.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = PLAYER_HITBOX_RADIUS * 2;

          if (dist < minDist && dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            // Weight-exaggerated separation
            const totalInvWeight = 1 / (a.weight + 0.1) + 1 / (b.weight + 0.1);
            const aRatio = (1 / (a.weight + 0.1)) / totalInvWeight;
            const bRatio = (1 / (b.weight + 0.1)) / totalInvWeight;

            // Exaggerate weight difference
            const weightDiff = Math.abs(a.weight - b.weight);
            const exaggeration = 1 + weightDiff * BUMP_WEIGHT_EXAGGERATION;

            a.position.x -= nx * overlap * aRatio * exaggeration;
            a.position.y -= ny * overlap * aRatio * exaggeration;
            b.position.x += nx * overlap * bRatio * exaggeration;
            b.position.y += ny * overlap * bRatio * exaggeration;

            const relVx = b.velocity.x - a.velocity.x;
            const relVy = b.velocity.y - a.velocity.y;
            const relVn = relVx * nx + relVy * ny;

            if (relVn < 0) {
              const impulse = -(1 + BUMP_RESTITUTION) * relVn / totalInvWeight;

              const impulseA = impulse / (a.weight + 0.1);
              const impulseB = impulse / (b.weight + 0.1);

              a.velocity.x -= nx * impulseA;
              a.velocity.y -= ny * impulseA;
              b.velocity.x += nx * impulseB;
              b.velocity.y += ny * impulseB;

              const aDirX = Math.cos(a.angle);
              const aDirY = -Math.sin(a.angle);
              a.speed = a.velocity.x * aDirX + a.velocity.y * aDirY;

              const bDirX = Math.cos(b.angle);
              const bDirY = -Math.sin(b.angle);
              b.speed = b.velocity.x * bDirX + b.velocity.y * bDirY;

              // Exaggerated spin
              const crossA = nx * aDirY - ny * aDirX;
              a.angle += crossA * BUMP_SPIN_FORCE;
              const crossB = nx * bDirY - ny * bDirX;
              b.angle -= crossB * BUMP_SPIN_FORCE;

              // Squash on impact
              a.squashX = 1.3;
              a.squashY = 0.7;
              b.squashX = 1.3;
              b.squashY = 0.7;

              // Expressions
              a.expression = 'angry';
              a.expressionTimer = 0.4;
              b.expression = 'angry';
              b.expressionTimer = 0.4;

              // Track collisions
              a.collisionCount++;
              b.collisionCount++;
              a.bumpsReceived++;
              b.bumpsReceived++;

              // Comic text
              addComicText(
                randomComicText(COMIC_TEXTS_COLLISION),
                (a.position.x + b.position.x) / 2,
                (a.position.y + b.position.y) / 2 - 20,
                COLORS.yellow,
              );

              // Audio and haptic
              audioManager.playCarBump(Math.min(1, Math.abs(relVn) / 200));
              triggerHaptic(i, 0.5, 0.1);
              triggerHaptic(j, 0.5, 0.1);
            }
          }
        }
      }
    }

    // 7. Handle death -> respawn flow
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (!player.alive && player.deathTimer <= 0) {
        respawnPlayer(player, state);
      }
    }

    // 8. Compute track progress and race positions
    const prevPositions = state.players.map(p => p.racePosition);
    for (const player of state.players) {
      if (player.alive) {
        player.trackProgress = computeTrackProgress(player, track.road);
      }
    }
    // Sort positions
    const sorted = [...state.players]
      .filter(p => p.alive && p.finishTime === null)
      .sort((a, b) => b.trackProgress - a.trackProgress);
    sorted.forEach((p, idx) => { p.racePosition = idx + 1; });
    // Finished players get their position based on finish time
    const finished = state.players
      .filter(p => p.finishTime !== null)
      .sort((a, b) => a.finishTime! - b.finishTime!);
    finished.forEach((p, idx) => { p.racePosition = idx + 1; });

    // Position change audio cues
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (!player.alive || player.finishTime !== null) continue;
      if (prevPositions[i] > 0 && player.racePosition < prevPositions[i]) {
        audioManager.play('sfx_position_up');
      } else if (prevPositions[i] > 0 && player.racePosition > prevPositions[i]) {
        audioManager.play('sfx_position_down');
      }
    }

    // 9. Update obstacles
    updateObstacles(state.obstacles, state.time, dt);

    // 10. Update camera (follow all players including bots)
    updateCamera(state.camera, state.players, state.players.length as 1 | 2 | 3 | 4, dt);

    // 11. Update particles
    updateParticles(state.particles, dt);

    // 12. Update engine sound for P1
    if (state.players.length > 0 && state.players[0].alive) {
      audioManager.updateEngineSound(
        Math.abs(state.players[0].speed),
        state.players[0].maxSpeed,
      );
    }

    // 13. Emit particles for players
    for (let pIdx = 0; pIdx < state.players.length; pIdx++) {
      const player = state.players[pIdx];
      if (!player.alive) continue;
      const speedRatio = Math.abs(player.speed) / player.maxSpeed;

      // Boost particles + flame jet
      if (player.boostTimer > 0) {
        player.boostParticleTimer -= dt;
        if (player.boostParticleTimer <= 0) {
          player.boostParticleTimer = 0.05;
          emitBoostParticles(player.position.x, player.position.y, state.particles);
          emitBoostFlame(player.position.x, player.position.y, player.angle, state.particles);
        }
      }

      // Tire smoke (continuous when driving fast)
      if (speedRatio > 0.3 && player.animState === 'driving') {
        player.skidTimer -= dt;
        if (player.skidTimer <= 0) {
          player.skidTimer = 0.08;
          emitTireSmoke(
            player.position.x, player.position.y,
            speedRatio, player.angle, state.particles,
          );
        }
      }

      // Drift smoke (thicker)
      if (player.drifting) {
        emitTireSmoke(
          player.position.x, player.position.y,
          1.0, player.angle, state.particles,
        );
        // Drift screech sound
        if (player.driftTimer < 0.1) {
          audioManager.play('sfx_drift');
        }
      }

      // Tire screech on sharp turns (not drifting)
      if (!player.drifting && speedRatio > 0.5 && Math.abs(player.input.steerX) > 0.8) {
        if (!tireScreechActive.has(pIdx)) {
          tireScreechActive.add(pIdx);
          audioManager.play('sfx_tire_screech');
        }
      } else {
        tireScreechActive.delete(pIdx);
      }

      // Exhaust trails
      if (speedRatio > 0.2 && player.animState === 'driving') {
        player.exhaustTimer -= dt;
        if (player.exhaustTimer <= 0) {
          player.exhaustTimer = EXHAUST_INTERVAL;
          const colors = EXHAUST_COLORS[player.characterId] ?? ['#808080', '#a0a0a0'];
          emitExhaust(
            player.position.x, player.position.y,
            player.angle, colors, speedRatio, state.particles,
          );
        }
      }

      // Skid marks on road (persist)
      if (
        (player.drifting || (player.input.brake > 0 && speedRatio > 0.3)) &&
        state.skidMarks.length < MAX_SKID_MARKS
      ) {
        state.skidMarks.push({
          x: player.position.x,
          y: player.position.y,
          angle: player.angle,
          width: player.drifting ? 6 : 4,
          opacity: 1,
          color: player.drifting ? '#333340' : '#2a2a35',
          life: SKID_MARK_LIFETIME,
        });
      }

      // Mud particles while in mud
      if (player.mudTimer > 0 && speedRatio > 0.1) {
        if (Math.random() < 0.3) {
          emitMudSplatter(player.position.x, player.position.y, state.particles);
        }
      }
    }

    // 14. Random events
    if (state.phase === 'racing') {
      nextRandomEventTimer -= dt;
      if (nextRandomEventTimer <= 0 && state.randomEvents.length === 0) {
        nextRandomEventTimer = randomRange(15, 30);
        spawnRandomEvent(state);
      }
      // Lava bursts
      updateLavaBursts(state, dt);
    }

    // 15. Check win condition
    if (state.phase === 'racing') {
      checkWinCondition(state);
    }

    // 16. Check tether in multi-player mode
    if (state.players.length >= 2 && state.phase === 'racing') {
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
    player.damageCount = Math.min(3, player.damageCount + 1);

    // Ragdoll: tumble in direction of travel + random spin
    player.ragdollVx = player.velocity.x * 0.5 + randomRange(-30, 30);
    player.ragdollVy = player.velocity.y * 0.5 + randomRange(-30, 30);
    player.ragdollSpin = randomRange(-15, 15);
    player.speed = 0;
    player.velocity = vec2(0, 0);

    const char = getCharacter(player.characterId);
    const color = player.palette === 'primary' ? char.primaryColor : char.rivalColor;
    emitDeathParticles(player.position.x, player.position.y, color, gs.particles);

    // Flash
    gs.flashTimer = FLASH_DURATION;

    // Comic text
    addComicText(
      randomComicText(COMIC_TEXTS_DEATH),
      player.position.x, player.position.y - 30,
      COLORS.red,
    );

    // Per-character death sound
    audioManager.play('sfx_death_' + player.characterId);
    triggerHaptic(playerIndex, 0.8, 0.3);
  }

  function respawnPlayer(
    player: (typeof state.players)[0],
    gs: GameState,
  ): void {
    const nearest = findNearestRoadPoint(player.position, track.road);
    const respawnPos = findRespawnPosition(
      nearest.segIdx, nearest.t, RESPAWN_DISTANCE, track.road,
    );

    player.position = { ...respawnPos };
    player.prevPosition = { ...respawnPos };
    player.speed = 0;
    player.velocity = vec2(0, 0);
    player.alive = true;
    player.invincibleTimer = INVINCIBILITY_DURATION;
    player.animState = 'idle';
    player.ragdollSpin = 0;
    player.ragdollVx = 0;
    player.ragdollVy = 0;

    const respawnNearest = findNearestRoadPoint(respawnPos, track.road);
    if (respawnNearest.segIdx < track.road.length - 1) {
      const segStart = track.road[respawnNearest.segIdx];
      const segEnd = track.road[respawnNearest.segIdx + 1];
      const dir = normalize(
        sub(vec2(segEnd.x, segEnd.y), vec2(segStart.x, segStart.y)),
      );
      player.angle = Math.atan2(-dir.y, dir.x);
    }

    emitRespawnParticles(player.position.x, player.position.y, gs.particles);
    audioManager.play('sfx_respawn');
  }

  function findRespawnPosition(
    segIdx: number, t: number, distBack: number, road: typeof track.road,
  ): Vec2 {
    let remaining = distBack;
    let curIdx = segIdx;
    const curT = t;

    if (curIdx < road.length - 1) {
      const segStart = vec2(road[curIdx].x, road[curIdx].y);
      const segEnd = vec2(road[curIdx + 1].x, road[curIdx + 1].y);
      const segLen = distance(segStart, segEnd);
      const distInSeg = segLen * curT;
      if (distInSeg >= remaining) {
        const newT = curT - remaining / segLen;
        return add(segStart, scale(sub(segEnd, segStart), newT));
      }
      remaining -= distInSeg;
      curIdx--;
    }

    while (curIdx >= 0 && remaining > 0) {
      const segStart = vec2(road[curIdx].x, road[curIdx].y);
      const segEnd = vec2(road[curIdx + 1].x, road[curIdx + 1].y);
      const segLen = distance(segStart, segEnd);
      if (segLen >= remaining) {
        const newT = 1 - remaining / segLen;
        return add(segStart, scale(sub(segEnd, segStart), newT));
      }
      remaining -= segLen;
      curIdx--;
    }

    return vec2(road[0].x, road[0].y);
  }

  // Lava burst timer
  let lavaBurstTimer = randomRange(5, 12);

  function spawnRandomEvent(gs: GameState): void {
    const camX = gs.camera.position.x;
    const camY = gs.camera.position.y;

    if (Math.random() < 0.5) {
      // Bird flying across
      const fromLeft = Math.random() < 0.5;
      gs.randomEvents.push({
        type: 'bird',
        x: fromLeft ? camX - CANVAS_WIDTH : camX + CANVAS_WIDTH,
        y: camY - CANVAS_HEIGHT / 3 + randomRange(-50, 50),
        vx: fromLeft ? randomRange(100, 200) : randomRange(-200, -100),
        vy: randomRange(-20, 20),
        timer: 5,
        maxLife: 5,
        frame: 0,
      });
    } else {
      // UFO appears, hovers, then flies away
      gs.randomEvents.push({
        type: 'ufo',
        x: camX + randomRange(-100, 100),
        y: camY - CANVAS_HEIGHT / 2 - 50,
        vx: randomRange(-10, 10),
        vy: randomRange(15, 30),
        timer: 4,
        maxLife: 4,
        frame: 0,
      });
    }
  }

  function updateLavaBursts(gs: GameState, dt: number): void {
    lavaBurstTimer -= dt;
    if (lavaBurstTimer <= 0 && gs.phase === 'racing') {
      lavaBurstTimer = randomRange(4, 10);
      // Find a spot near the road edge for a lava burst
      const camX = gs.camera.position.x;
      const camY = gs.camera.position.y;
      const burstX = camX + randomRange(-CANVAS_WIDTH / 2, CANVAS_WIDTH / 2);
      const burstY = camY + randomRange(-CANVAS_HEIGHT / 2, CANVAS_HEIGHT / 2);

      // Emit lava explosion particles
      if (gs.particles.length >= MAX_PARTICLES) return;
      const lavaColors = ['#ff8020', '#e06010', '#c0400a', '#ffcc00', '#ff4020'];
      for (let i = 0; i < 15; i++) {
        const angle = randomAngle();
        const speed = randomRange(60, 180);
        gs.particles.push({
          x: burstX + randomRange(-5, 5),
          y: burstY + randomRange(-5, 5),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - randomRange(40, 100),
          life: randomRange(0.4, 0.8),
          maxLife: 0.8,
          color: lavaColors[Math.floor(Math.random() * lavaColors.length)],
          size: randomRange(3, 7),
          type: 'flame',
        });
      }
    }
  }

  function checkWinCondition(gs: GameState): void {
    if (gs.phase !== 'racing') return;

    for (let i = 0; i < gs.players.length; i++) {
      const player = gs.players[i];
      if (!player.alive || player.finishTime !== null) continue;

      if (player.nearestRoad.segIdx >= track.finishLine) {
        player.finishTime = gs.raceTimer;

        if (gs.winner === null) {
          gs.winner = i;
          emitConfetti(player.position.x, player.position.y, gs.particles);
          audioManager.play('sfx_finish');
          // Play character-specific victory fanfare
          audioManager.play('sfx_victory_' + player.characterId);
          // Winner celebration: extra confetti bursts and bigger bounce
          player.jumpTimer = 0;
          player.expression = 'happy';
          player.expressionTimer = 10; // long happy face
        }
      }
    }

    const allFinished = gs.players.every((p) => p.finishTime !== null);
    if (allFinished || (gs.winner !== null && gs.players.length === 1)) {
      gs.phase = 'finished';
      onFinish(buildResults(gs));
    }

    if (
      gs.players.length >= 2 &&
      gs.winner !== null &&
      gs.players.some((p) => p.finishTime === null)
    ) {
      const winnerTime = gs.players[gs.winner].finishTime!;
      if (gs.raceTimer - winnerTime > 10) {
        gs.phase = 'finished';
        onFinish(buildResults(gs));
      }
    }
  }

  function checkTether(gs: GameState): void {
    if (gs.players.length < 2) return;

    let leader: typeof gs.players[0] | null = null;
    for (const p of gs.players) {
      if (!p.alive || p.finishTime !== null) continue;
      if (!leader || p.trackProgress > leader.trackProgress) {
        leader = p;
      }
    }
    if (!leader) return;

    for (const p of gs.players) {
      if (p === leader) continue;
      if (!p.alive || p.finishTime !== null) continue;

      const dist = distance(p.position, leader.position);
      if (dist > TETHER_TELEPORT_DISTANCE) {
        const leaderNearest = findNearestRoadPoint(leader.position, track.road);
        const teleportPos = findRespawnPosition(
          leaderNearest.segIdx, leaderNearest.t, TETHER_TELEPORT_BEHIND, track.road,
        );

        p.position = { ...teleportPos };
        p.prevPosition = { ...teleportPos };
        p.speed = leader.speed * 0.5;

        emitRespawnParticles(p.position.x, p.position.y, gs.particles);
      }
    }
  }

  function calculateAwards(gs: GameState): RaceAward[] {
    const awards: RaceAward[] = [];

    // Most Deaths
    let maxDeaths = 0;
    let deathPlayer = 0;
    gs.players.forEach((p, i) => {
      if (p.deaths > maxDeaths) { maxDeaths = p.deaths; deathPlayer = i; }
    });
    if (maxDeaths > 0) {
      awards.push({ key: 'award_most_deaths', playerIndex: deathPlayer, icon: '💀', value: maxDeaths });
    }

    // Biggest Bully (most collisions caused)
    let maxCollisions = 0;
    let bullyPlayer = 0;
    gs.players.forEach((p, i) => {
      if (p.collisionCount > maxCollisions) { maxCollisions = p.collisionCount; bullyPlayer = i; }
    });
    if (maxCollisions > 2) {
      awards.push({ key: 'award_biggest_bully', playerIndex: bullyPlayer, icon: '👊', value: maxCollisions });
    }

    // Slowpoke (last place, only in multiplayer)
    if (gs.players.length >= 2) {
      const unfinished = gs.players.filter(p => p.finishTime === null);
      const slowest = gs.players
        .filter(p => p.finishTime !== null)
        .sort((a, b) => b.finishTime! - a.finishTime!);
      const slowpokeIdx = unfinished.length > 0
        ? gs.players.indexOf(unfinished[0])
        : (slowest.length > 0 ? gs.players.indexOf(slowest[0]) : -1);
      if (slowpokeIdx >= 0 && slowpokeIdx !== gs.winner) {
        awards.push({ key: 'award_slowpoke', playerIndex: slowpokeIdx, icon: '🐌', value: '' });
      }
    }

    // Clean Racer (0 deaths)
    gs.players.forEach((p, i) => {
      if (p.deaths === 0 && p.finishTime !== null) {
        awards.push({ key: 'award_clean_racer', playerIndex: i, icon: '✨', value: '' });
      }
    });

    // Speed Demon (finished first by big margin)
    if (gs.players.length >= 2 && gs.winner !== null) {
      const winnerTime = gs.players[gs.winner].finishTime!;
      const others = gs.players.filter((p, i) => i !== gs.winner && p.finishTime !== null);
      if (others.length > 0) {
        const closest = Math.min(...others.map(p => p.finishTime!));
        if (closest - winnerTime > 5) {
          awards.push({ key: 'award_speed_demon', playerIndex: gs.winner, icon: '⚡', value: '' });
        }
      }
    }

    return awards;
  }

  function buildResults(gs: GameState): GameResults {
    return {
      playerCount: gs.playerCount,
      botCount: gs.botCount,
      winner: gs.winner,
      players: gs.players.map((p, i) => ({
        characterId: p.characterId,
        finishTime: p.finishTime,
        deaths: p.deaths,
        collisionCount: p.collisionCount,
        isBot: i >= gs.playerCount,
      })),
      awards: calculateAwards(gs),
    };
  }

  function render(alpha: number): void {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Use camera position directly — the camera already lerps smoothly at 0.08/tick.
    // Alpha-based interpolation between position and target caused visible jitter
    // (especially at race start when the gap is ~150px from look-ahead).
    const camX = state.camera.position.x;
    const camY = state.camera.position.y;

    // Phase 1: Draw lava at raw canvas resolution
    renderLavaFullscreen(ctx, canvas.width, canvas.height, state.time, camX, camY);

    // Phase 2: Draw game content with uniform scaling
    const scaleX = canvas.width / CANVAS_WIDTH;
    const scaleY = canvas.height / CANVAS_HEIGHT;
    const uniformScale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - CANVAS_WIDTH * uniformScale) / 2;
    const offsetY = (canvas.height - CANVAS_HEIGHT * uniformScale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(uniformScale, uniformScale);

    renderGame(ctx, state, alpha);

    ctx.restore();

    // Phase 3: Post-processing effects at raw resolution

    // White flash (spike death)
    if (state.flashTimer > 0) {
      const flashAlpha = state.flashTimer / FLASH_DURATION;
      ctx.save();
      ctx.globalAlpha = flashAlpha * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Expose state to HUD overlay
    (canvas as unknown as { __gameState: GameState }).__gameState = state;
  }

  function gameLoop(now: number): void {
    if (!running) return;

    const frameTime = Math.min((now - lastTime) / 1000, 0.1);
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
      setAIContext(null, 0);
      destroyInput();
      window.removeEventListener('resize', onResize);
    },
  };
}
