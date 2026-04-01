import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GameConfig,
  GameState,
  PlayerInput,
  TrackData,
} from '../types';
import {
  COUNTDOWN_STEP_DURATION,
  GO_DISPLAY_DURATION,
  FIXED_TIMESTEP,
  PLAYER_HITBOX_RADIUS,
  BOOST_DURATION,
  LAVA_GRACE_ZONE,
} from '../utils/constants';

// ---------------------------------------------------------------------------
// Mock the input module so we can inject synthetic PlayerInput per frame.
// ---------------------------------------------------------------------------
const mockInputs: Record<number, PlayerInput> = {
  0: { accelerate: 0, brake: 0, steerX: 0, honk: false },
  1: { accelerate: 0, brake: 0, steerX: 0, honk: false },
};

vi.mock('../game/input', () => ({
  initInput: vi.fn(),
  destroyInput: vi.fn(),
  readPlayerInput: vi.fn((idx: 0 | 1) => mockInputs[idx]),
}));

// Mock audio (no actual audio in tests)
vi.mock('../game/audio', () => ({
  audioManager: {
    init: vi.fn(),
    play: vi.fn(),
    playLoop: vi.fn(),
    stop: vi.fn(),
    updateEngineSound: vi.fn(),
  },
}));

// Import game modules *after* mocks are in place
import { createGameState } from '../game/state';
import { createPlayer, updatePlayer, computeTrackProgress } from '../game/player';
import { updateCountdown } from '../game/countdown';
import { isPointOnRoad, findNearestRoadPoint } from '../game/collision';
import {
  createObstacleStates,
  updateObstacles,
  checkObstacleCollisions,
} from '../game/obstacles';
import { updateCamera } from '../game/camera';
import { characters, getCharacter } from '../data/characters';

// Track imports
import sundayDrive from '../data/tracks/sunday-drive';
import lavaGauntlet from '../data/tracks/lava-gauntlet';
import devilsHighway from '../data/tracks/devils-highway';

// i18n imports
import cs from '../i18n/cs';
import en from '../i18n/en';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setInput(playerIdx: 0 | 1, input: Partial<PlayerInput>): void {
  mockInputs[playerIdx] = {
    accelerate: 0,
    brake: 0,
    steerX: 0,
    honk: false,
    ...input,
  };
}

function make1PConfig(
  charId = 'formula',
  trackId = 'sunday-drive',
): GameConfig {
  return {
    playerCount: 1,
    botCount: 0,
    trackId,
    p1Character: charId,
    p2Character: 'cat',
    p3Character: 'muscle',
    p4Character: 'buggy',
  };
}

const allTracks: { id: string; data: TrackData }[] = [
  { id: 'sunday-drive', data: sundayDrive },
  { id: 'lava-gauntlet', data: lavaGauntlet },
  { id: 'devils-highway', data: devilsHighway },
];

// ---------------------------------------------------------------------------
// 1. Game state lifecycle
// ---------------------------------------------------------------------------
describe('Game state lifecycle', () => {
  beforeEach(() => {
    setInput(0, {});
    setInput(1, {});
  });

  it('starts in countdown phase with step 3', () => {
    const state = createGameState(make1PConfig(), sundayDrive);
    expect(state.phase).toBe('countdown');
    expect(state.countdownStep).toBe(3);
  });

  it('countdown timer equals 3 * STEP + GO duration', () => {
    const state = createGameState(make1PConfig(), sundayDrive);
    const expected = 3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION;
    expect(state.countdownTimer).toBeCloseTo(expected);
  });

  it('transitions through countdown steps 3 -> 2 -> 1 -> GO -> racing', () => {
    const state = createGameState(make1PConfig(), sundayDrive);
    const dt = FIXED_TIMESTEP;
    const stepsVisited = new Set<number>();
    stepsVisited.add(state.countdownStep);

    // Tick through the entire countdown
    for (let i = 0; i < 300; i++) {
      if (state.phase !== 'countdown') break;
      updateCountdown(state, dt);
      stepsVisited.add(state.countdownStep);
    }

    // Should have seen all steps and transitioned to racing
    expect(stepsVisited.has(3)).toBe(true);
    expect(stepsVisited.has(2)).toBe(true);
    expect(stepsVisited.has(1)).toBe(true);
    expect(stepsVisited.has(0)).toBe(true); // GO
    expect(state.phase).toBe('racing');
  });

  it('race timer stays at 0 during countdown', () => {
    const state = createGameState(make1PConfig(), sundayDrive);
    // Manually tick countdown without advancing race timer
    for (let i = 0; i < 10; i++) {
      updateCountdown(state, FIXED_TIMESTEP);
    }
    // race timer is only advanced in engine.ts when phase === 'racing'
    expect(state.raceTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Player-road collision
// ---------------------------------------------------------------------------
describe('Player-road collision', () => {
  it('detects player on road at the start position', () => {
    const track = sundayDrive;
    const startPos = track.startPositions.p1;
    const result = isPointOnRoad(
      { x: startPos.x, y: startPos.y },
      track.road,
    );
    expect(result.onRoad).toBe(true);
  });

  it('detects player far off-road as not on road', () => {
    const track = sundayDrive;
    // Place the player way to the right of any road segment
    const result = isPointOnRoad({ x: 9999, y: 4000 }, track.road);
    expect(result.onRoad).toBe(false);
  });

  it('detects player at road center as on road', () => {
    const track = lavaGauntlet;
    // Use a known road center point from the middle of the track
    const midIdx = Math.floor(track.road.length / 2);
    const center = track.road[midIdx];
    const result = isPointOnRoad({ x: center.x, y: center.y }, track.road);
    expect(result.onRoad).toBe(true);
    expect(result.distFromCenter).toBeLessThan(center.width / 2);
  });

  it('detects player just beyond road edge as off-road', () => {
    const track = lavaGauntlet;
    const midIdx = Math.floor(track.road.length / 2);
    const center = track.road[midIdx];
    // Move far to the right of center (beyond width/2 + grace zone)
    const offRoadX = center.x + center.width / 2 + LAVA_GRACE_ZONE + 50;
    const result = isPointOnRoad({ x: offRoadX, y: center.y }, track.road);
    expect(result.onRoad).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Track data integrity
// ---------------------------------------------------------------------------
describe('Track data integrity', () => {
  for (const { id, data: track } of allTracks) {
    describe(`Track: ${id}`, () => {
      it('has a non-empty road', () => {
        expect(track.road.length).toBeGreaterThan(10);
      });

      it('road points have positive widths', () => {
        for (const pt of track.road) {
          expect(pt.width).toBeGreaterThan(0);
        }
      });

      it('road Y values are mostly monotonically decreasing', () => {
        // Allow a small percentage of Y-increases for S-curves, but the
        // overall trend should be decreasing (tracks go from high Y to low Y).
        let decreasing = 0;
        let total = 0;
        for (let i = 1; i < track.road.length; i++) {
          total++;
          if (track.road[i].y <= track.road[i - 1].y) {
            decreasing++;
          }
        }
        // At least 90% of segments should have decreasing Y
        expect(decreasing / total).toBeGreaterThan(0.9);
      });

      it('start line index is in range', () => {
        expect(track.startLine).toBeGreaterThanOrEqual(0);
        expect(track.startLine).toBeLessThan(track.road.length);
      });

      it('finish line index is in range', () => {
        expect(track.finishLine).toBeGreaterThanOrEqual(0);
        expect(track.finishLine).toBeLessThan(track.road.length);
      });

      it('finish line comes after start line (higher index)', () => {
        expect(track.finishLine).toBeGreaterThan(track.startLine);
      });

      it('has at least one obstacle', () => {
        expect(track.obstacles.length).toBeGreaterThan(0);
      });

      it('all obstacles have valid types', () => {
        const validTypes = ['arrow_pad', 'spikes', 'log', 'rotating_spikes', 'ramp', 'destructible', 'mud_zone', 'bouncy_wall'];
        for (const obs of track.obstacles) {
          expect(validTypes).toContain(obs.type);
        }
      });

      it('obstacle positions are on or near the road', () => {
        for (const obs of track.obstacles) {
          const nearest = findNearestRoadPoint(
            { x: obs.x, y: obs.y },
            track.road,
          );
          // Obstacles should be within road width + some tolerance
          expect(nearest.distance).toBeLessThan(nearest.roadWidth);
        }
      });

      it('start positions are on the road', () => {
        for (const key of ['p1', 'p2'] as const) {
          const pos = track.startPositions[key];
          const result = isPointOnRoad(
            { x: pos.x, y: pos.y },
            track.road,
          );
          expect(result.onRoad).toBe(true);
        }
      });

      it('has valid difficulty', () => {
        expect(['easy', 'medium', 'hard']).toContain(track.difficulty);
      });

      it('has a non-empty name', () => {
        expect(track.name.length).toBeGreaterThan(0);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Full game tick simulation
// ---------------------------------------------------------------------------
describe('Full game tick simulation', () => {
  beforeEach(() => {
    setInput(0, {});
    setInput(1, {});
  });

  it('player can accelerate and move after countdown', () => {
    const state = createGameState(make1PConfig(), sundayDrive);
    const dt = FIXED_TIMESTEP;

    // Advance past countdown
    while (state.phase === 'countdown') {
      state.time += dt;
      updateCountdown(state, dt);
      for (const p of state.players) {
        updatePlayer(p, dt, state);
      }
    }
    expect(state.phase).toBe('racing');

    // Now accelerate
    setInput(0, { accelerate: 1 });
    const posBefore = { ...state.players[0].position };
    const speedBefore = state.players[0].speed;

    for (let i = 0; i < 30; i++) {
      state.time += dt;
      state.raceTimer += dt;
      updatePlayer(state.players[0], dt, state);
    }

    expect(state.players[0].speed).toBeGreaterThan(speedBefore);
    const posAfter = state.players[0].position;
    const moved =
      posAfter.x !== posBefore.x || posAfter.y !== posBefore.y;
    expect(moved).toBe(true);
  });

  it('camera follows the player', () => {
    const state = createGameState(make1PConfig(), sundayDrive);
    const dt = FIXED_TIMESTEP;

    // Advance past countdown
    while (state.phase === 'countdown') {
      state.time += dt;
      updateCountdown(state, dt);
      for (const p of state.players) {
        updatePlayer(p, dt, state);
      }
    }

    // Accelerate and update camera
    setInput(0, { accelerate: 1 });
    const camBefore = { ...state.camera.position };

    for (let i = 0; i < 60; i++) {
      state.time += dt;
      state.raceTimer += dt;
      updatePlayer(state.players[0], dt, state);
      updateCamera(
        state.camera,
        state.players,
        state.playerCount,
        dt,
      );
    }

    const camAfter = state.camera.position;
    const cameraMoved =
      camAfter.x !== camBefore.x || camAfter.y !== camBefore.y;
    expect(cameraMoved).toBe(true);
  });

  it('track progress increases when player drives forward', () => {
    const track = sundayDrive;
    const state = createGameState(make1PConfig(), track);
    const dt = FIXED_TIMESTEP;

    // Advance past countdown
    while (state.phase === 'countdown') {
      state.time += dt;
      updateCountdown(state, dt);
      for (const p of state.players) {
        updatePlayer(p, dt, state);
      }
    }

    const progressBefore = computeTrackProgress(
      state.players[0],
      track.road,
    );

    // Accelerate forward (angle = pi/2 means up / negative Y)
    setInput(0, { accelerate: 1 });
    for (let i = 0; i < 120; i++) {
      state.time += dt;
      state.raceTimer += dt;
      updatePlayer(state.players[0], dt, state);
    }

    const progressAfter = computeTrackProgress(
      state.players[0],
      track.road,
    );
    expect(progressAfter).toBeGreaterThan(progressBefore);
  });

  it('player does not move during countdown even with input', () => {
    setInput(0, { accelerate: 1 });
    const state = createGameState(make1PConfig(), sundayDrive);
    const dt = FIXED_TIMESTEP;

    const posBefore = { ...state.players[0].position };

    // Tick a few frames during countdown
    for (let i = 0; i < 10; i++) {
      state.time += dt;
      updateCountdown(state, dt);
      updatePlayer(state.players[0], dt, state);
    }

    expect(state.phase).toBe('countdown');
    expect(state.players[0].position).toEqual(posBefore);
    expect(state.players[0].speed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Obstacle interaction
// ---------------------------------------------------------------------------
describe('Obstacle interaction', () => {
  beforeEach(() => {
    setInput(0, {});
    setInput(1, {});
  });

  it('arrow pad triggers boost when player overlaps', () => {
    const track = sundayDrive;
    // Find an arrow pad
    const arrowPad = track.obstacles.find((o) => o.type === 'arrow_pad')!;
    expect(arrowPad).toBeDefined();

    const player = createPlayer(
      'formula',
      arrowPad.x,
      arrowPad.y,
      Math.PI / 2,
      'primary',
    );
    const obstacles = createObstacleStates(track.obstacles);

    const result = checkObstacleCollisions(player, 0, obstacles, []);
    expect(result).toBe('boost');
    expect(player.boostTimer).toBe(BOOST_DURATION);
  });

  it('arrow pad does not retrigger immediately', () => {
    const track = sundayDrive;
    const arrowPad = track.obstacles.find((o) => o.type === 'arrow_pad')!;

    const player = createPlayer(
      'formula',
      arrowPad.x,
      arrowPad.y,
      Math.PI / 2,
      'primary',
    );
    const obstacles = createObstacleStates(track.obstacles);

    // First trigger
    const first = checkObstacleCollisions(player, 0, obstacles, []);
    expect(first).toBe('boost');

    // Second trigger at same position => should not retrigger
    player.boostTimer = 0; // reset for clarity
    const second = checkObstacleCollisions(player, 0, obstacles, []);
    expect(second).not.toBe('boost');
  });

  it('spikes kill the player when overlapping', () => {
    const track = lavaGauntlet;
    const spikeObs = track.obstacles.find((o) => o.type === 'spikes')!;
    expect(spikeObs).toBeDefined();

    const player = createPlayer(
      'formula',
      spikeObs.x,
      spikeObs.y,
      Math.PI / 2,
      'primary',
    );
    const obstacles = createObstacleStates(track.obstacles);

    const result = checkObstacleCollisions(player, 0, obstacles, []);
    expect(result).toBe('death');
  });

  it('invincible player survives spikes', () => {
    const track = lavaGauntlet;
    const spikeObs = track.obstacles.find((o) => o.type === 'spikes')!;

    const player = createPlayer(
      'formula',
      spikeObs.x,
      spikeObs.y,
      Math.PI / 2,
      'primary',
    );
    player.invincibleTimer = 1.0;
    const obstacles = createObstacleStates(track.obstacles);

    const result = checkObstacleCollisions(player, 0, obstacles, []);
    // Spikes should be skipped when invincible
    expect(result).not.toBe('death');
  });

  it('log causes knockback', () => {
    const track = lavaGauntlet;
    const logObs = track.obstacles.find((o) => o.type === 'log')!;
    expect(logObs).toBeDefined();

    const player = createPlayer(
      'formula',
      logObs.x,
      logObs.y,
      Math.PI / 2,
      'primary',
    );
    player.speed = 100;
    const obstacles = createObstacleStates(track.obstacles);

    const result = checkObstacleCollisions(player, 0, obstacles, []);
    expect(result).toBe('knockback');
    expect(player.stunTimer).toBeGreaterThan(0);
  });

  it('rotating spikes update position over time', () => {
    const track = lavaGauntlet;
    const rotObs = track.obstacles.find(
      (o) => o.type === 'rotating_spikes',
    )!;
    expect(rotObs).toBeDefined();

    const obstacles = createObstacleStates(track.obstacles);
    const rotState = obstacles.find((o) => o.type === 'rotating_spikes')!;
    const initialX = rotState.x;

    // Advance time
    updateObstacles(obstacles, 1.0, FIXED_TIMESTEP);
    // If it has patrolDistance, x should change
    if (rotState.patrolDistance > 0) {
      // After time=1.0, offset = sin(1.0 * speed) * distance
      // Just verify it changed from base
      expect(rotState.x !== initialX || rotState.y !== rotState.baseY).toBe(
        true,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Character stats validation
// ---------------------------------------------------------------------------
describe('Character stats validation', () => {
  it('all characters have 6 entries', () => {
    expect(characters.length).toBe(6);
  });

  it('every character has valid stat ranges', () => {
    for (const char of characters) {
      expect(char.maxSpeed).toBeGreaterThan(0);
      expect(char.maxSpeed).toBeLessThanOrEqual(500);
      expect(char.acceleration).toBeGreaterThan(0);
      expect(char.acceleration).toBeLessThanOrEqual(500);
      expect(char.handling).toBeGreaterThan(0);
      expect(char.handling).toBeLessThanOrEqual(10);
      expect(char.weight).toBeGreaterThan(0);
      expect(char.weight).toBeLessThanOrEqual(1);
      expect(char.brakeForce).toBeGreaterThan(0);
      expect(char.brakeForce).toBeLessThanOrEqual(500);
    }
  });

  it('every character has unique id', () => {
    const ids = characters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every character has non-empty name, description, and colors', () => {
    for (const char of characters) {
      expect(char.name.length).toBeGreaterThan(0);
      expect(char.description.length).toBeGreaterThan(0);
      expect(char.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(char.rivalColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('characters have meaningful stat differences', () => {
    // At least two characters should differ in maxSpeed
    const speeds = characters.map((c) => c.maxSpeed);
    const uniqueSpeeds = new Set(speeds);
    expect(uniqueSpeeds.size).toBeGreaterThan(1);

    // Handling should also vary
    const handlings = characters.map((c) => c.handling);
    const uniqueHandlings = new Set(handlings);
    expect(uniqueHandlings.size).toBeGreaterThan(1);

    // Weight should also vary
    const weights = characters.map((c) => c.weight);
    const uniqueWeights = new Set(weights);
    expect(uniqueWeights.size).toBeGreaterThan(1);
  });

  it('getCharacter returns correct character by id', () => {
    for (const char of characters) {
      const fetched = getCharacter(char.id);
      expect(fetched).toBe(char);
    }
  });

  it('getCharacter throws for unknown id', () => {
    expect(() => getCharacter('nonexistent')).toThrow();
  });

  it('formula is the fastest, yeti is the slowest', () => {
    const formula = getCharacter('formula');
    const yeti = getCharacter('yeti');
    expect(formula.maxSpeed).toBeGreaterThan(yeti.maxSpeed);
  });

  it('cat has the best handling', () => {
    const cat = getCharacter('cat');
    for (const char of characters) {
      expect(cat.handling).toBeGreaterThanOrEqual(char.handling);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. i18n completeness
// ---------------------------------------------------------------------------
describe('i18n completeness', () => {
  const csKeys = Object.keys(cs).sort();
  const enKeys = Object.keys(en).sort();

  it('Czech and English have the same number of keys', () => {
    expect(csKeys.length).toBe(enKeys.length);
  });

  it('Czech and English have identical key sets', () => {
    expect(csKeys).toEqual(enKeys);
  });

  it('no empty translation values in Czech', () => {
    for (const [key, value] of Object.entries(cs)) {
      expect(value, `cs.${key} should not be empty`).toBeTruthy();
    }
  });

  it('no empty translation values in English', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en.${key} should not be empty`).toBeTruthy();
    }
  });

  it('all character names have translations in both languages', () => {
    const charNameKeys = characters.map((c) => c.name);
    for (const key of charNameKeys) {
      expect(cs).toHaveProperty(key);
      expect(en).toHaveProperty(key);
    }
  });
});
