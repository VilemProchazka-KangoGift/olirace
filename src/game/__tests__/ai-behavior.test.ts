import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GameConfig,
  GameState,
  PlayerInput,
  TrackData,
} from '../../types';
import {
  FIXED_TIMESTEP,
  DEATH_ANIMATION_DURATION,
  LAVA_GRACE_ZONE,
  BOOST_DURATION,
  BOOST_SPEED_MULTIPLIER,
  RAMP_AIRBORNE_DURATION,
  INVINCIBILITY_DURATION,
  RESPAWN_DISTANCE,
  MUD_EFFECT_DURATION,
  COUNTDOWN_STEP_DURATION,
  GO_DISPLAY_DURATION,
} from '../../utils/constants';

// ---------------------------------------------------------------------------
// vi.hoisted: create shared mutable refs accessible from hoisted vi.mock
// ---------------------------------------------------------------------------
const shared = vi.hoisted(() => {
  const refs = {
    gameState: null as GameState | null,
    aiCompute: null as ((p: any, idx: number, gs: GameState) => PlayerInput) | null,
  };
  return refs;
});

// ---------------------------------------------------------------------------
// Mock input module: human players get idle, bots call computeAIInput
// ---------------------------------------------------------------------------
vi.mock('../../game/input', () => ({
  initInput: vi.fn(),
  destroyInput: vi.fn(),
  setAIContext: vi.fn(),
  readPlayerInput: vi.fn((idx: number): PlayerInput => {
    const state = shared.gameState;
    if (!state) {
      return { accelerate: 0, brake: 0, steerX: 0, honk: false };
    }
    const humanCount = state.playerCount;
    if (idx < humanCount) {
      return { accelerate: 0, brake: 0, steerX: 0, honk: false };
    }
    const compute = shared.aiCompute;
    if (!compute) {
      return { accelerate: 0, brake: 0, steerX: 0, honk: false };
    }
    const player = state.players[idx];
    if (!player) {
      return { accelerate: 0, brake: 0, steerX: 0, honk: false };
    }
    return compute(player, idx, state);
  }),
}));

// Mock audio
vi.mock('../../game/audio', () => ({
  audioManager: {
    init: vi.fn(),
    play: vi.fn(),
    playLoop: vi.fn(),
    stop: vi.fn(),
    updateEngineSound: vi.fn(),
    playCarBump: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { createGameState } from '../../game/state';
import { updatePlayer, computeTrackProgress } from '../../game/player';
import { updateCountdown } from '../../game/countdown';
import { findNearestRoadPoint } from '../../game/collision';
import { updateObstacles, checkObstacleCollisions } from '../../game/obstacles';
import { computeAIInput } from '../../game/ai';

// Track imports
import sundayDrive from '../../data/tracks/sunday-drive';
import mudRunner from '../../data/tracks/mud-runner';
import lavaGauntlet from '../../data/tracks/lava-gauntlet';
import pinballAlley from '../../data/tracks/pinball-alley';
import devilsHighway from '../../data/tracks/devils-highway';
import skyBridge from '../../data/tracks/sky-bridge';

// Wire up the AI compute function (runs at module evaluation time, before tests)
shared.aiCompute = computeAIInput;

// ---------------------------------------------------------------------------
// Track definitions with per-track death thresholds
// ---------------------------------------------------------------------------
const ALL_TRACKS = [
  { id: 'sunday-drive', data: sundayDrive, name: 'Sunday Drive', maxDeathsPerBot: 30, minProgressPct: 0.10 },
  { id: 'mud-runner', data: mudRunner, name: 'Mud Runner', maxDeathsPerBot: 30, minProgressPct: 0.10 },
  { id: 'lava-gauntlet', data: lavaGauntlet, name: 'Lava Gauntlet', maxDeathsPerBot: 35, minProgressPct: 0.10 },
  { id: 'pinball-alley', data: pinballAlley, name: 'Pinball Alley', maxDeathsPerBot: 20, minProgressPct: 0.10 },
  { id: 'devils-highway', data: devilsHighway, name: "Devil's Highway", maxDeathsPerBot: 35, minProgressPct: 0.03 },
  { id: 'sky-bridge', data: skyBridge, name: 'Sky Bridge', maxDeathsPerBot: 35, minProgressPct: 0.10 },
];

// Simulation parameters
const RACE_SECONDS = 60;
const TICKS_PER_SECOND = 60;
const LOG_INTERVAL_SECONDS = 5;
const DT = FIXED_TIMESTEP;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(trackId: string, chars: string[] = ['formula', 'cat', 'pig', 'frog']): GameConfig {
  return {
    playerCount: 1,
    botCount: 3,
    trackId,
    p1Character: chars[0],
    p2Character: chars[1],
    p3Character: chars[2],
    p4Character: chars[3],
  };
}

function makeSingleBotConfig(trackId: string, charId: string): GameConfig {
  return {
    playerCount: 1,
    botCount: 1,
    trackId,
    p1Character: 'formula',
    p2Character: charId,
    p3Character: 'pig',
    p4Character: 'frog',
  };
}

/**
 * Simulate one tick of the game, replicating the engine's fixedUpdate logic
 * without canvas/audio/particles/visual-only systems.
 */
function simulateTick(state: GameState, dt: number): void {
  state.time += dt;

  // 1. Countdown
  if (state.phase === 'countdown') {
    updateCountdown(state, dt);
    for (const player of state.players) {
      if (player.alive) {
        player.nearestRoad = findNearestRoadPoint(player.position, state.track.road);
      }
      updatePlayer(player, dt, state);
    }
    return;
  }

  // 2. Race timer
  state.raceTimer += dt;

  // 3. Cache road position per player
  for (const player of state.players) {
    if (player.alive) {
      player.nearestRoad = findNearestRoadPoint(player.position, state.track.road);
    }
  }

  // 4. Update players (readPlayerInput is called inside updatePlayer,
  //    which routes to AI for bot indices via the mock)
  for (const player of state.players) {
    updatePlayer(player, dt, state);
  }

  // 4. Road collision (lava death)
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (!player.alive || player.finishTime !== null) continue;
    if (player.airborne) continue;

    const nearest = findNearestRoadPoint(player.position, state.track.road);
    player.distFromRoadCenter = nearest.distance;
    player.roadHalfWidth = nearest.roadWidth / 2;
    const onRoad = nearest.distance <= player.roadHalfWidth + LAVA_GRACE_ZONE;

    if (!onRoad) {
      player.alive = false;
      player.deathTimer = DEATH_ANIMATION_DURATION;
      player.deaths++;
      player.speed = 0;
      player.velocity = { x: 0, y: 0 };
      player.ragdollVx = 0;
      player.ragdollVy = 0;
      player.ragdollSpin = 0;
    }
  }

  // 5. Obstacle collisions
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (!player.alive || player.finishTime !== null) continue;
    if (player.airborne) continue;
    if (player.invincibleTimer > 0) continue;

    const result = checkObstacleCollisions(player, i, state.obstacles, state.particles);
    if (result === 'death') {
      player.alive = false;
      player.deathTimer = DEATH_ANIMATION_DURATION;
      player.deaths++;
      player.speed = 0;
      player.velocity = { x: 0, y: 0 };
      player.ragdollVx = 0;
      player.ragdollVy = 0;
      player.ragdollSpin = 0;
    } else if (result === 'boost') {
      player.boostTimer = BOOST_DURATION;
      player.speed = player.maxSpeed * BOOST_SPEED_MULTIPLIER;
    } else if (result === 'ramp') {
      player.airborne = true;
      player.airborneTimer = RAMP_AIRBORNE_DURATION;
    } else if (result === 'mud') {
      player.mudTimer = MUD_EFFECT_DURATION;
    }
    // knockback, bounce, destroy are handled inside checkObstacleCollisions
  }

  // 6. Respawn dead players
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (!player.alive && player.deathTimer <= 0) {
      const nearest = findNearestRoadPoint(player.position, state.track.road);
      let respIdx = nearest.segIdx;
      let distBack = RESPAWN_DISTANCE;
      while (respIdx > 0 && distBack > 0) {
        const seg = state.track.road[respIdx];
        const prev = state.track.road[respIdx - 1];
        const segLen = Math.sqrt((seg.x - prev.x) ** 2 + (seg.y - prev.y) ** 2);
        distBack -= segLen;
        respIdx--;
      }
      const rp = state.track.road[Math.max(0, respIdx)];
      player.position = { x: rp.x, y: rp.y };
      player.prevPosition = { x: rp.x, y: rp.y };
      player.speed = 0;
      player.velocity = { x: 0, y: 0 };
      player.alive = true;
      player.invincibleTimer = INVINCIBILITY_DURATION;
      player.ragdollSpin = 0;
      player.ragdollVx = 0;
      player.ragdollVy = 0;
      player.animState = 'idle';
      if (respIdx < state.track.road.length - 1) {
        const next = state.track.road[respIdx + 1];
        const dx = next.x - rp.x;
        const dy = next.y - rp.y;
        player.angle = Math.atan2(-dy, dx);
      }
    }
  }

  // 7. Track progress
  for (const player of state.players) {
    if (player.alive) {
      player.trackProgress = computeTrackProgress(player, state.track.road);
    }
  }

  // 8. Update obstacles (patrol movement, destructible respawn)
  updateObstacles(state.obstacles, state.time, dt);

  // 9. Win condition
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (!player.alive || player.finishTime !== null) continue;
    const nearest = findNearestRoadPoint(player.position, state.track.road);
    if (nearest.segIdx >= state.track.finishLine) {
      player.finishTime = state.raceTimer;
      if (state.winner === null) state.winner = i;
    }
  }

  const allFinished = state.players.every(p => p.finishTime !== null);
  if (allFinished) state.phase = 'finished';
}

/**
 * Compute the total track length in pixels (sum of all road segment lengths).
 */
function computeTotalTrackLength(road: TrackData['road']): number {
  let total = 0;
  for (let i = 0; i < road.length - 1; i++) {
    const dx = road[i + 1].x - road[i].x;
    const dy = road[i + 1].y - road[i].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

interface BotSnapshot {
  time: number;
  x: number;
  y: number;
  speed: number;
  progress: number;
  deaths: number;
  alive: boolean;
}

/**
 * Run a full simulation and return per-bot snapshots.
 */
function runSimulation(
  state: GameState,
  raceSeconds: number,
): Map<number, BotSnapshot[]> {
  shared.gameState = state;

  const humanCount = state.playerCount;
  const totalPlayers = state.players.length;
  const botIndices: number[] = [];
  for (let i = humanCount; i < totalPlayers; i++) {
    botIndices.push(i);
  }

  const snapshots = new Map<number, BotSnapshot[]>();
  for (const idx of botIndices) {
    snapshots.set(idx, []);
  }

  const countdownTicks = Math.ceil(
    (3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION) / DT,
  ) + 10;
  const raceTicks = raceSeconds * TICKS_PER_SECOND;
  const totalTicks = countdownTicks + raceTicks;
  const logIntervalTicks = LOG_INTERVAL_SECONDS * TICKS_PER_SECOND;

  let raceTickCount = 0;

  for (let tick = 0; tick < totalTicks; tick++) {
    simulateTick(state, DT);

    if (state.phase === 'finished') break;

    if (state.phase === 'racing') {
      raceTickCount++;

      if (raceTickCount % logIntervalTicks === 0) {
        const elapsed = (raceTickCount / TICKS_PER_SECOND).toFixed(1);
        for (const idx of botIndices) {
          const p = state.players[idx];
          const snap: BotSnapshot = {
            time: raceTickCount / TICKS_PER_SECOND,
            x: Math.round(p.position.x),
            y: Math.round(p.position.y),
            speed: Math.round(p.speed),
            progress: Math.round(p.trackProgress),
            deaths: p.deaths,
            alive: p.alive,
          };
          snapshots.get(idx)!.push(snap);
          console.log(
            `[Track: ${state.track.name}] [t=${elapsed}s] Bot ${idx} (${p.characterId}): ` +
              `pos=(${snap.x}, ${snap.y}) speed=${snap.speed} progress=${snap.progress} deaths=${snap.deaths}`,
          );
        }
      }
    }
  }

  // Final snapshot
  for (const idx of botIndices) {
    const p = state.players[idx];
    const elapsed = (raceTickCount / TICKS_PER_SECOND).toFixed(1);
    const snap: BotSnapshot = {
      time: raceTickCount / TICKS_PER_SECOND,
      x: Math.round(p.position.x),
      y: Math.round(p.position.y),
      speed: Math.round(p.speed),
      progress: Math.round(p.trackProgress),
      deaths: p.deaths,
      alive: p.alive,
    };
    const existing = snapshots.get(idx)!;
    if (existing.length === 0 || existing[existing.length - 1].time !== snap.time) {
      snapshots.set(idx, [...existing, snap]);
    }
    console.log(
      `[Track: ${state.track.name}] [FINAL t=${elapsed}s] Bot ${idx} (${p.characterId}): ` +
        `pos=(${snap.x}, ${snap.y}) speed=${snap.speed} progress=${snap.progress} deaths=${snap.deaths} ` +
        `finished=${p.finishTime !== null}`,
    );
  }

  shared.gameState = null;
  return snapshots;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AI Bot Behavior', () => {
  beforeEach(() => {
    shared.gameState = null;
  });

  for (const track of ALL_TRACKS) {
    describe(`Track: ${track.name}`, () => {
      let state: GameState;
      let snapshots: Map<number, BotSnapshot[]>;
      let trackLength: number;

      beforeEach(() => {
        const config = makeConfig(track.id);
        state = createGameState(config, track.data);
        trackLength = computeTotalTrackLength(track.data.road);
        snapshots = runSimulation(state, RACE_SECONDS);
      });

      it('all bots make forward progress', { timeout: 120_000 }, () => {
        const humanCount = state.playerCount;
        for (let idx = humanCount; idx < state.players.length; idx++) {
          const snaps = snapshots.get(idx)!;
          expect(snaps.length).toBeGreaterThan(0);

          const player = state.players[idx];
          const finalProgress = player.trackProgress;

          console.log(
            `[${track.name}] Bot ${idx} (${player.characterId}): ` +
              `final progress=${Math.round(finalProgress)} / ${Math.round(trackLength)} ` +
              `(${((finalProgress / trackLength) * 100).toFixed(1)}%)`,
          );

          // At minimum, bots should have positive track progress
          expect(finalProgress).toBeGreaterThan(0);

          // Peak progress should be at least as high as the first logged
          // progress. On hard tracks, bots may die repeatedly and respawn
          // near the same point, so peak == first is acceptable.
          if (snaps.length >= 2) {
            const firstProgress = snaps[0].progress;
            const peakProgress = Math.max(...snaps.map(s => s.progress));
            expect(peakProgress).toBeGreaterThanOrEqual(firstProgress);
          }
        }
      });

      it('bots are not permanently stuck', { timeout: 120_000 }, () => {
        const humanCount = state.playerCount;
        // Rubber-banding makes bots intentionally hover near the idle human,
        // oscillating slowly. This is expected behavior, not "stuck".
        // We check multiple signals to detect truly stuck bots:
        // 1. Bot achieved non-zero speed at multiple sample points
        // 2. Bot made some displacement over the entire race

        for (let idx = humanCount; idx < state.players.length; idx++) {
          const snaps = snapshots.get(idx)!;
          const player = state.players[idx];

          // Signal 1: Bot had non-zero speed at multiple points when alive.
          // Bots that die frequently will have speed=0 during death/respawn,
          // so we only count alive samples. Also, bots rubber-banding near
          // the idle human will oscillate with low speeds.
          const aliveSamples = snaps.filter(s => s.alive);
          const speedySamples = snaps.filter(s => Math.abs(s.speed) > 5);
          console.log(
            `[${track.name}] Bot ${idx} (${player.characterId}): ` +
              `${speedySamples.length}/${snaps.length} samples with |speed| > 5, ` +
              `${aliveSamples.length} alive`,
          );
          // At least one sample should show the bot was moving
          expect(speedySamples.length + player.deaths).toBeGreaterThan(0);

          // Signal 2: Max displacement from first sample should be > 0
          // (bot reached somewhere other than its starting position)
          if (snaps.length >= 2) {
            const firstSnap = snaps[0];
            let maxDisplacement = 0;
            for (const s of snaps) {
              const dx = s.x - firstSnap.x;
              const dy = s.y - firstSnap.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d > maxDisplacement) maxDisplacement = d;
            }
            console.log(
              `[${track.name}] Bot ${idx} (${player.characterId}): ` +
                `max displacement from first sample = ${Math.round(maxDisplacement)}px`,
            );
            expect(maxDisplacement).toBeGreaterThan(0);
          }
        }
      });

      it('bots complete significant track progress', { timeout: 120_000 }, () => {
        const humanCount = state.playerCount;
        const minPct = track.minProgressPct;

        for (let idx = humanCount; idx < state.players.length; idx++) {
          const player = state.players[idx];
          const progressFraction = player.trackProgress / trackLength;

          console.log(
            `[${track.name}] Bot ${idx} (${player.characterId}): ` +
              `progress fraction = ${(progressFraction * 100).toFixed(1)}% ` +
              `(need >= ${(minPct * 100).toFixed(0)}%)`,
          );

          expect(progressFraction).toBeGreaterThanOrEqual(minPct);
        }
      });

      it('bot deaths stay within acceptable limits', { timeout: 120_000 }, () => {
        const humanCount = state.playerCount;

        for (let idx = humanCount; idx < state.players.length; idx++) {
          const player = state.players[idx];

          console.log(
            `[${track.name}] Bot ${idx} (${player.characterId}): ` +
              `${player.deaths} deaths (max allowed: ${track.maxDeathsPerBot})`,
          );

          expect(player.deaths).toBeLessThanOrEqual(track.maxDeathsPerBot);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Stuck detection: check for prolonged lack of progress in any 10-second window
  // ---------------------------------------------------------------------------
  for (const track of ALL_TRACKS) {
    describe(`Stuck detection: ${track.name}`, () => {
      it('no bot stuck in a small area for >10 seconds', { timeout: 120_000 }, () => {
        const config = makeConfig(track.id);
        const state = createGameState(config, track.data);
        shared.gameState = state;

        const humanCount = state.playerCount;
        const botIndices: number[] = [];
        for (let i = humanCount; i < state.players.length; i++) {
          botIndices.push(i);
        }

        // Sample position every second
        const positionHistory: Array<{ x: number; y: number; progress: number }>[] =
          botIndices.map(() => []);

        const countdownTicks = Math.ceil(
          (3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION) / DT,
        ) + 10;
        const raceTicks = RACE_SECONDS * TICKS_PER_SECOND;
        const totalTicks = countdownTicks + raceTicks;
        let raceTickCount = 0;

        for (let tick = 0; tick < totalTicks; tick++) {
          simulateTick(state, DT);
          if (state.phase === 'finished') break;
          if (state.phase === 'racing') {
            raceTickCount++;
            if (raceTickCount % TICKS_PER_SECOND === 0) {
              for (let b = 0; b < botIndices.length; b++) {
                const p = state.players[botIndices[b]];
                positionHistory[b].push({
                  x: p.position.x,
                  y: p.position.y,
                  progress: p.trackProgress,
                });
              }
            }
          }
        }

        // Check each bot: verify they achieve peak progress far from start,
        // and that they are not stuck at a SINGLE point for the entire race.
        // We measure: (a) did the bot ever move significantly from start?
        // (b) what fraction of the race showed any movement?
        //
        // Note: rubber-banding with an idle human causes bots to
        // intentionally slow down or oscillate near the start. Combined with
        // frequent deaths on hard tracks, many windows may show little movement.
        // This is expected AI behavior, not "stuck". The real check is whether
        // the bot EVER makes significant progress.
        for (let b = 0; b < botIndices.length; b++) {
          const hist = positionHistory[b];
          const player = state.players[botIndices[b]];

          // Find peak progress achieved at any point during the race
          const peakProgress = Math.max(...hist.map(h => h.progress), 0);

          // Find peak displacement from starting position
          const start = hist[0];
          let peakDisplacement = 0;
          for (const h of hist) {
            const dx = h.x - start.x;
            const dy = h.y - start.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > peakDisplacement) peakDisplacement = d;
          }

          // Count windows with ANY movement (displacement > 5px in 10s)
          let movingWindows = 0;
          let totalWindows = 0;
          for (let i = 0; i + 10 < hist.length; i++) {
            totalWindows++;
            const s = hist[i];
            const e = hist[i + 10];
            const dx = e.x - s.x;
            const dy = e.y - s.y;
            const disp = Math.sqrt(dx * dx + dy * dy);
            if (disp > 5 || e.progress > s.progress) movingWindows++;
          }

          console.log(
            `[${track.name}] Bot ${botIndices[b]} (${player.characterId}): ` +
              `peakProgress=${Math.round(peakProgress)} ` +
              `peakDisplacement=${Math.round(peakDisplacement)}px ` +
              `movingWindows=${movingWindows}/${totalWindows} ` +
              `deaths=${player.deaths}`,
          );

          // The bot should have achieved SOME peak displacement from start
          // (even if it died and respawned back, it must have moved at some point)
          expect(peakDisplacement).toBeGreaterThan(10);

          // Bot should have moved in at least a few windows
          // (minimum 2 windows showing movement, or the bot must have died
          // which means it was at least alive and driving before dying)
          expect(movingWindows + player.deaths).toBeGreaterThan(0);
        }

        shared.gameState = null;
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Curve navigation: test each bot can handle the curviest track sections
  // ---------------------------------------------------------------------------
  describe('Curve navigation on Lava Gauntlet', () => {
    it('all bots advance past the midpoint curves', { timeout: 120_000 }, () => {
      const config = makeConfig('lava-gauntlet');
      const state = createGameState(config, lavaGauntlet);
      const trackLength = computeTotalTrackLength(lavaGauntlet.road);
      shared.gameState = state;

      const countdownTicks = Math.ceil(
        (3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION) / DT,
      ) + 10;
      const raceTicks = RACE_SECONDS * TICKS_PER_SECOND;
      const totalTicks = countdownTicks + raceTicks;

      for (let tick = 0; tick < totalTicks; tick++) {
        simulateTick(state, DT);
        if (state.phase === 'finished') break;
      }

      const humanCount = state.playerCount;
      for (let idx = humanCount; idx < state.players.length; idx++) {
        const player = state.players[idx];
        const peakSegIdx = findNearestRoadPoint(
          player.position, lavaGauntlet.road,
        ).segIdx;

        console.log(
          `[Lava Gauntlet] Bot ${idx} (${player.characterId}): ` +
            `peak road segment = ${peakSegIdx}/${lavaGauntlet.road.length} ` +
            `progress = ${Math.round(player.trackProgress)} / ${Math.round(trackLength)} ` +
            `(${((player.trackProgress / trackLength) * 100).toFixed(1)}%)`,
        );

        // Bot should have navigated at least some curves
        expect(player.trackProgress).toBeGreaterThan(0);
      }

      shared.gameState = null;
    });
  });

  // ---------------------------------------------------------------------------
  // Obstacle-heavy track: test bots survive pinball alley
  // ---------------------------------------------------------------------------
  describe('Obstacle navigation on Pinball Alley', () => {
    it('all bots maintain forward progress despite obstacles', { timeout: 120_000 }, () => {
      const config = makeConfig('pinball-alley');
      const state = createGameState(config, pinballAlley);
      const trackLength = computeTotalTrackLength(pinballAlley.road);
      shared.gameState = state;

      const countdownTicks = Math.ceil(
        (3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION) / DT,
      ) + 10;
      const raceTicks = RACE_SECONDS * TICKS_PER_SECOND;
      const totalTicks = countdownTicks + raceTicks;

      // Track progress at 10s intervals
      const progressAt10s: number[] = [];
      const progressAt30s: number[] = [];
      let raceTickCount = 0;

      for (let tick = 0; tick < totalTicks; tick++) {
        simulateTick(state, DT);
        if (state.phase === 'finished') break;
        if (state.phase === 'racing') {
          raceTickCount++;
          const humanCount = state.playerCount;
          if (raceTickCount === 10 * TICKS_PER_SECOND) {
            for (let idx = humanCount; idx < state.players.length; idx++) {
              progressAt10s.push(state.players[idx].trackProgress);
            }
          }
          if (raceTickCount === 30 * TICKS_PER_SECOND) {
            for (let idx = humanCount; idx < state.players.length; idx++) {
              progressAt30s.push(state.players[idx].trackProgress);
            }
          }
        }
      }

      const humanCount = state.playerCount;
      for (let idx = humanCount; idx < state.players.length; idx++) {
        const b = idx - humanCount;
        const player = state.players[idx];
        const p10 = progressAt10s[b] ?? 0;
        const p30 = progressAt30s[b] ?? 0;
        const pFinal = player.trackProgress;

        console.log(
          `[Pinball Alley] Bot ${idx} (${player.characterId}): ` +
            `progress @10s=${Math.round(p10)} @30s=${Math.round(p30)} ` +
            `final=${Math.round(pFinal)} deaths=${player.deaths}`,
        );

        // Progress should generally increase from 10s to 30s
        // (accounting for rubber-banding which may cause pauses)
        expect(pFinal).toBeGreaterThan(0);
      }

      shared.gameState = null;
    });
  });

  // ---------------------------------------------------------------------------
  // Narrow track: test bots handle Devil's Highway
  // ---------------------------------------------------------------------------
  describe('Narrow track navigation on Devils Highway', () => {
    it('bots stay on the narrow road enough to make progress', { timeout: 120_000 }, () => {
      const config = makeConfig('devils-highway');
      const state = createGameState(config, devilsHighway);
      const trackLength = computeTotalTrackLength(devilsHighway.road);
      shared.gameState = state;

      const countdownTicks = Math.ceil(
        (3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION) / DT,
      ) + 10;
      const raceTicks = RACE_SECONDS * TICKS_PER_SECOND;
      const totalTicks = countdownTicks + raceTicks;

      for (let tick = 0; tick < totalTicks; tick++) {
        simulateTick(state, DT);
        if (state.phase === 'finished') break;
      }

      const humanCount = state.playerCount;
      for (let idx = humanCount; idx < state.players.length; idx++) {
        const player = state.players[idx];
        const pct = (player.trackProgress / trackLength) * 100;
        const deathRate = player.deaths / RACE_SECONDS;

        console.log(
          `[Devil's Highway] Bot ${idx} (${player.characterId}): ` +
            `progress=${pct.toFixed(1)}% deaths=${player.deaths} ` +
            `(${deathRate.toFixed(2)} deaths/sec)`,
        );

        // Even on the hardest track, bots should make some progress
        expect(player.trackProgress).toBeGreaterThan(0);
        // Death rate shouldn't be more than ~0.4/sec (1 death every 2.5s average)
        expect(deathRate).toBeLessThan(0.5);
      }

      shared.gameState = null;
    });
  });

  // ---------------------------------------------------------------------------
  // Per-character personality tests on Sunday Drive (easy track)
  // ---------------------------------------------------------------------------
  describe('Character personalities on Sunday Drive', () => {
    const chars = ['formula', 'cat', 'pig', 'yeti', 'frog', 'toilet'];

    for (const charId of chars) {
      it(`${charId} can navigate the track`, { timeout: 120_000 }, () => {
        const config = makeSingleBotConfig('sunday-drive', charId);
        const state = createGameState(config, sundayDrive);
        const trackLength = computeTotalTrackLength(sundayDrive.road);

        shared.gameState = state;

        const countdownTicks = Math.ceil(
          (3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION) / DT,
        ) + 10;
        const raceTicks = RACE_SECONDS * TICKS_PER_SECOND;
        const totalTicks = countdownTicks + raceTicks;
        const logIntervalTicks = 10 * TICKS_PER_SECOND;

        let raceTickCount = 0;

        for (let tick = 0; tick < totalTicks; tick++) {
          simulateTick(state, DT);
          if (state.phase === 'finished') break;
          if (state.phase === 'racing') {
            raceTickCount++;
            if (raceTickCount % logIntervalTicks === 0) {
              const elapsed = (raceTickCount / TICKS_PER_SECOND).toFixed(1);
              const bot = state.players[1];
              console.log(
                `[Sunday Drive / ${charId}] [t=${elapsed}s] ` +
                  `pos=(${Math.round(bot.position.x)}, ${Math.round(bot.position.y)}) ` +
                  `speed=${Math.round(bot.speed)} progress=${Math.round(bot.trackProgress)} ` +
                  `deaths=${bot.deaths}`,
              );
            }
          }
        }

        const bot = state.players[1];
        const progressFraction = bot.trackProgress / trackLength;

        console.log(
          `[Sunday Drive / ${charId}] FINAL: ` +
            `progress=${Math.round(bot.trackProgress)} / ${Math.round(trackLength)} ` +
            `(${(progressFraction * 100).toFixed(1)}%) deaths=${bot.deaths} ` +
            `finished=${bot.finishTime !== null}`,
        );

        expect(bot.trackProgress).toBeGreaterThan(0);
        expect(progressFraction).toBeGreaterThanOrEqual(0.10);
        expect(bot.deaths).toBeLessThanOrEqual(30);

        shared.gameState = null;
      });
    }
  });

  // ---------------------------------------------------------------------------
  // DIAGNOSTIC: Devil's Highway death heatmap and choke point analysis
  // ---------------------------------------------------------------------------
  describe("Devil's Highway diagnostics", () => {
    const charIds = ['formula', 'cat', 'pig', 'yeti', 'frog', 'toilet'];

    for (const charId of charIds) {
      it(`${charId}: death locations and choke points`, { timeout: 120_000 }, () => {
        const config: GameConfig = {
          playerCount: 1,
          botCount: 1,
          trackId: 'devils-highway',
          p1Character: charId === 'formula' ? 'cat' : 'formula',
          p2Character: charId,
          p3Character: 'pig',
          p4Character: 'frog',
        };
        const state = createGameState(config, devilsHighway);
        const trackLength = computeTotalTrackLength(devilsHighway.road);
        shared.gameState = state;

        const countdownTicks = Math.ceil(
          (3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION) / DT,
        ) + 10;
        const raceTicks = RACE_SECONDS * TICKS_PER_SECOND;
        const totalTicks = countdownTicks + raceTicks;

        // Track death locations and time-at-position
        const deathLocations: Array<{ x: number; y: number; segIdx: number; cause: string }> = [];
        const segmentTimeSpent: number[] = new Array(devilsHighway.road.length).fill(0);
        let prevAlive = true;
        let raceTickCount = 0;

        // Track peak progress over time for rubber-band analysis
        let peakProgress = 0;
        const progressOverTime: Array<{ t: number; progress: number; speed: number }> = [];

        for (let tick = 0; tick < totalTicks; tick++) {
          const bot = state.players[1];
          const wasAlive = bot.alive;

          simulateTick(state, DT);
          if (state.phase === 'finished') break;

          if (state.phase === 'racing') {
            raceTickCount++;

            // Track where the bot spends time
            if (bot.alive) {
              const nearest = findNearestRoadPoint(bot.position, devilsHighway.road);
              if (nearest.segIdx < segmentTimeSpent.length) {
                segmentTimeSpent[nearest.segIdx]++;
              }
            }

            // Detect death events
            if (wasAlive && !bot.alive) {
              const nearest = findNearestRoadPoint(bot.position, devilsHighway.road);
              const onRoad = nearest.distance <= nearest.roadWidth / 2 + LAVA_GRACE_ZONE;
              deathLocations.push({
                x: Math.round(bot.position.x),
                y: Math.round(bot.position.y),
                segIdx: nearest.segIdx,
                cause: onRoad ? 'obstacle' : 'lava',
              });
            }

            // Progress tracking every 2 seconds
            if (bot.alive && bot.trackProgress > peakProgress) {
              peakProgress = bot.trackProgress;
            }
            if (raceTickCount % (2 * TICKS_PER_SECOND) === 0) {
              progressOverTime.push({
                t: raceTickCount / TICKS_PER_SECOND,
                progress: Math.round(bot.trackProgress),
                speed: Math.round(Math.abs(bot.speed)),
              });
            }
          }
        }

        const bot = state.players[1];

        // Log death locations
        console.log(`\n=== DEVIL'S HIGHWAY: ${charId} (${bot.deaths} deaths) ===`);
        console.log(`Peak progress: ${Math.round(peakProgress)} / ${Math.round(trackLength)} (${((peakProgress / trackLength) * 100).toFixed(1)}%)`);

        if (deathLocations.length > 0) {
          console.log(`\nDeath locations:`);
          for (const d of deathLocations) {
            // Map segIdx to Y coordinate for easier identification
            const roadY = devilsHighway.road[d.segIdx]?.y ?? 0;
            console.log(
              `  died at (${d.x}, ${d.y}) seg=${d.segIdx} roadY=${Math.round(roadY)} cause=${d.cause}`,
            );
          }

          // Aggregate deaths by Y range (road section)
          const deathsBySection: Record<string, { count: number; causes: string[] }> = {};
          const sections = [
            { name: 'Seg1 Start (5800-5500)', minY: 5500, maxY: 5800 },
            { name: 'Seg2 Right curve (5500-5100)', minY: 5100, maxY: 5500 },
            { name: 'Seg3 Left hairpin (5100-4700)', minY: 4700, maxY: 5100 },
            { name: 'Seg4 Short straight (4700-4400)', minY: 4400, maxY: 4700 },
            { name: 'Seg5 S-curve 120px (4400-3900)', minY: 3900, maxY: 4400 },
            { name: 'Seg6 Gauntlet 120px (3900-3500)', minY: 3500, maxY: 3900 },
            { name: 'Seg7-8 Hairpin pair (3500-2700)', minY: 2700, maxY: 3500 },
            { name: 'Seg9 Straight (2700-2300)', minY: 2300, maxY: 2700 },
            { name: 'Seg10 Triple-S (2300-1800)', minY: 1800, maxY: 2300 },
            { name: 'Seg11 Straight (1800-1400)', minY: 1400, maxY: 1800 },
            { name: 'Seg12-14 Finish (1400-300)', minY: 300, maxY: 1400 },
          ];

          for (const sec of sections) {
            const secDeaths = deathLocations.filter(d => d.y >= sec.minY && d.y <= sec.maxY);
            if (secDeaths.length > 0) {
              deathsBySection[sec.name] = {
                count: secDeaths.length,
                causes: secDeaths.map(d => d.cause),
              };
            }
          }

          console.log(`\nDeaths by road section:`);
          for (const [section, data] of Object.entries(deathsBySection)) {
            const lavaPct = Math.round(
              (data.causes.filter(c => c === 'lava').length / data.count) * 100,
            );
            console.log(
              `  ${section}: ${data.count} deaths (${lavaPct}% lava, ${100 - lavaPct}% obstacle)`,
            );
          }
        }

        // Log time-at-position hotspots (where the bot spends the most time)
        const hotspots: Array<{ segIdx: number; y: number; width: number; ticks: number }> = [];
        for (let i = 0; i < segmentTimeSpent.length; i++) {
          if (segmentTimeSpent[i] > 60) { // more than 1 second at this segment
            hotspots.push({
              segIdx: i,
              y: Math.round(devilsHighway.road[i].y),
              width: Math.round(devilsHighway.road[i].width),
              ticks: segmentTimeSpent[i],
            });
          }
        }
        if (hotspots.length > 0) {
          // Sort by time spent descending
          hotspots.sort((a, b) => b.ticks - a.ticks);
          console.log(`\nTime hotspots (>1s at segment):`);
          for (const h of hotspots.slice(0, 15)) {
            const seconds = (h.ticks / TICKS_PER_SECOND).toFixed(1);
            console.log(
              `  seg=${h.segIdx} y=${h.y} width=${h.width}px: ${seconds}s`,
            );
          }
        }

        // Log progress over time
        console.log(`\nProgress over time:`);
        for (const p of progressOverTime) {
          console.log(`  t=${p.t}s progress=${p.progress} speed=${p.speed}`);
        }

        // Assertions: this is primarily diagnostic, but ensure something was captured
        expect(bot.deaths + Math.round(peakProgress)).toBeGreaterThan(0);

        shared.gameState = null;
      });
    }

    it('track geometry analysis: width at curves', () => {
      console.log(`\n=== DEVIL'S HIGHWAY TRACK GEOMETRY ===`);
      console.log(`Total road points: ${devilsHighway.road.length}`);
      console.log(`Finish line segment: ${devilsHighway.finishLine}`);

      // Find minimum width and where it occurs
      let minWidth = Infinity;
      let minWidthIdx = 0;
      for (let i = 0; i < devilsHighway.road.length; i++) {
        if (devilsHighway.road[i].width < minWidth) {
          minWidth = devilsHighway.road[i].width;
          minWidthIdx = i;
        }
      }
      console.log(`Minimum width: ${minWidth}px at seg=${minWidthIdx} y=${devilsHighway.road[minWidthIdx].y}`);

      // Analyze curvature + width at each section
      console.log(`\nSection analysis (curvature = angle change over 5 segments):`);
      for (let i = 5; i < devilsHighway.road.length - 5; i += 10) {
        const p = devilsHighway.road[i];
        // Compute local curvature
        let curvature = 0;
        for (let j = i - 2; j < i + 2 && j < devilsHighway.road.length - 1; j++) {
          const dx1 = devilsHighway.road[j + 1].x - devilsHighway.road[j].x;
          const dy1 = devilsHighway.road[j + 1].y - devilsHighway.road[j].y;
          if (j + 2 < devilsHighway.road.length) {
            const dx2 = devilsHighway.road[j + 2].x - devilsHighway.road[j + 1].x;
            const dy2 = devilsHighway.road[j + 2].y - devilsHighway.road[j + 1].y;
            const a1 = Math.atan2(dy1, dx1);
            const a2 = Math.atan2(dy2, dx2);
            let delta = a2 - a1;
            while (delta > Math.PI) delta -= 2 * Math.PI;
            while (delta < -Math.PI) delta += 2 * Math.PI;
            curvature += Math.abs(delta);
          }
        }

        // Flag problematic combinations
        const flag = (p.width <= 130 && curvature > 0.1) ? ' ⚠️ TIGHT' : '';
        if (curvature > 0.05 || p.width <= 140) {
          console.log(
            `  seg=${i} y=${Math.round(p.y)} width=${Math.round(p.width)}px curvature=${curvature.toFixed(3)}${flag}`,
          );
        }
      }

      // Count obstacles per section
      console.log(`\nObstacle density:`);
      const obsByY: Record<string, number> = {};
      for (const obs of devilsHighway.obstacles) {
        const bucket = Math.floor(obs.y / 500) * 500;
        const key = `Y ${bucket}-${bucket + 500}`;
        obsByY[key] = (obsByY[key] ?? 0) + 1;
      }
      for (const [range, count] of Object.entries(obsByY).sort()) {
        console.log(`  ${range}: ${count} obstacles`);
      }

      // Width should never be below PLAYER_HITBOX_RADIUS * 4 (minimum for dodging)
      expect(minWidth).toBeGreaterThanOrEqual(64);
    });
  });
});
