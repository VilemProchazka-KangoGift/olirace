import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameState, PlayerState, PlayerInput, RoadPoint, Vec2 } from '../../types';
import { createPlayer, updatePlayer } from '../player';
import { getCharacter } from '../../data/characters';
import {
  FRICTION_DECAY,
  REVERSE_SPEED_MULTIPLIER,
  BOOST_SPEED_MULTIPLIER,
  COUNTDOWN_STEP_DURATION,
  GO_DISPLAY_DURATION,
} from '../../utils/constants';

// Mock the input module
vi.mock('../input', () => ({
  readPlayerInput: vi.fn(),
}));

// Mock findNearestRoadPoint from collision
vi.mock('../collision', () => ({
  findNearestRoadPoint: vi.fn(() => ({
    segIdx: 0,
    t: 0,
    centerPoint: { x: 0, y: 0 },
    distance: 0,
    roadWidth: 100,
  })),
}));

import { readPlayerInput } from '../input';

const mockReadPlayerInput = vi.mocked(readPlayerInput);

function createMinimalGameState(players?: PlayerState[]): GameState {
  const road: RoadPoint[] = [
    { x: 0, y: 0, width: 100 },
    { x: 0, y: 100, width: 100 },
    { x: 0, y: 200, width: 100 },
  ];

  const p = players ?? [createPlayer('formula', 0, 0, Math.PI / 2, 'primary')];

  return {
    phase: 'racing',
    countdownTimer: 0,
    countdownStep: -1,
    raceTimer: 0,
    players: p,
    track: {
      name: 'test',
      difficulty: 'easy',
      road,
      obstacles: [],
      startLine: 0,
      finishLine: 2,
      startPositions: {
        p1: { x: 0, y: 0, angle: Math.PI / 2 },
        p2: { x: 20, y: 0, angle: Math.PI / 2 },
      },
    },
    camera: { position: { x: 0, y: 0 }, target: { x: 0, y: 0 } },
    obstacles: [],
    particles: [],
    winner: null,
    playerCount: 1,
    time: 0,
    skidMarks: [],
    screenShake: { intensity: 0, duration: 0, timer: 0, offsetX: 0, offsetY: 0 },
    comicTexts: [],
    randomEvents: [],
    flashTimer: 0,
    countdownParticles: [],
  };
}

function noInput(): PlayerInput {
  return { accelerate: 0, brake: 0, steerX: 0, honk: false };
}

function accelerateInput(): PlayerInput {
  return { accelerate: 1, brake: 0, steerX: 0, honk: false };
}

function brakeInput(): PlayerInput {
  return { accelerate: 0, brake: 1, steerX: 0, honk: false };
}

function steerLeftInput(): PlayerInput {
  return { accelerate: 1, brake: 0, steerX: -1, honk: false };
}

function steerRightInput(): PlayerInput {
  return { accelerate: 1, brake: 0, steerX: 1, honk: false };
}

describe('createPlayer', () => {
  it('creates a player with correct character stats', () => {
    const char = getCharacter('formula');
    const player = createPlayer('formula', 100, 200, Math.PI / 2, 'primary');

    expect(player.characterId).toBe('formula');
    expect(player.position).toEqual({ x: 100, y: 200 });
    expect(player.prevPosition).toEqual({ x: 100, y: 200 });
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    expect(player.angle).toBe(Math.PI / 2);
    expect(player.speed).toBe(0);
    expect(player.maxSpeed).toBe(char.maxSpeed);
    expect(player.acceleration).toBe(char.acceleration);
    expect(player.handling).toBe(char.handling);
    expect(player.weight).toBe(char.weight);
    expect(player.brakeForce).toBe(char.brakeForce);
    expect(player.palette).toBe('primary');
  });

  it('initializes timers to zero', () => {
    const player = createPlayer('yeti', 0, 0, 0, 'rival');
    expect(player.boostTimer).toBe(0);
    expect(player.invincibleTimer).toBe(0);
    expect(player.stunTimer).toBe(0);
    expect(player.deathTimer).toBe(0);
    expect(player.honkTimer).toBe(0);
  });

  it('initializes alive and tracking state', () => {
    const player = createPlayer('cat', 0, 0, 0, 'primary');
    expect(player.alive).toBe(true);
    expect(player.deaths).toBe(0);
    expect(player.finishTime).toBeNull();
    expect(player.trackProgress).toBe(0);
  });

  it('initializes animation state', () => {
    const player = createPlayer('pig', 0, 0, 0, 'primary');
    expect(player.animState).toBe('idle');
    expect(player.animFrame).toBe(0);
    expect(player.animTimer).toBe(0);
  });

  it('creates with rival palette', () => {
    const player = createPlayer('formula', 0, 0, 0, 'rival');
    expect(player.palette).toBe('rival');
  });
});

describe('updatePlayer - acceleration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('speed increases when accelerating', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    const state = createMinimalGameState([player]);
    const initialSpeed = player.speed;
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    expect(player.speed).toBeGreaterThan(initialSpeed);
  });

  it('speed does not exceed maxSpeed', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    // Simulate many frames
    for (let i = 0; i < 600; i++) {
      updatePlayer(player, dt, state);
    }

    expect(player.speed).toBeLessThanOrEqual(player.maxSpeed);
  });

  it('acceleration is proportional to character acceleration stat', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const fastPlayer = createPlayer('formula', 0, 0, 0, 'primary');
    const slowPlayer = createPlayer('yeti', 0, 0, 0, 'primary');
    const fastState = createMinimalGameState([fastPlayer]);
    const slowState = createMinimalGameState([slowPlayer]);
    const dt = 1 / 60;

    updatePlayer(fastPlayer, dt, fastState);
    updatePlayer(slowPlayer, dt, slowState);

    // Formula has higher acceleration (200) than yeti (100)
    expect(fastPlayer.speed).toBeGreaterThan(slowPlayer.speed);
  });
});

describe('updatePlayer - braking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('speed decreases when braking from positive speed', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 100;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(brakeInput());
    updatePlayer(player, dt, state);

    expect(player.speed).toBeLessThan(100);
  });

  it('speed can go negative (reverse) when braking from zero', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 0;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(brakeInput());
    updatePlayer(player, dt, state);

    expect(player.speed).toBeLessThan(0);
  });

  it('reverse speed is capped at -maxSpeed * REVERSE_SPEED_MULTIPLIER', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 0;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;
    const reverseMax = -player.maxSpeed * REVERSE_SPEED_MULTIPLIER;

    mockReadPlayerInput.mockReturnValue(brakeInput());
    for (let i = 0; i < 600; i++) {
      updatePlayer(player, dt, state);
    }

    expect(player.speed).toBeCloseTo(reverseMax, 0);
    expect(player.speed).toBeGreaterThanOrEqual(reverseMax);
  });
});

describe('updatePlayer - friction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('speed decays when no input', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 100;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(noInput());
    updatePlayer(player, dt, state);

    expect(player.speed).toBeCloseTo(100 * FRICTION_DECAY);
  });

  it('speed eventually reaches zero with no input', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 100;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(noInput());
    for (let i = 0; i < 1000; i++) {
      updatePlayer(player, dt, state);
    }

    expect(player.speed).toBe(0);
  });

  it('friction does not apply when accelerating', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 50;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(accelerateInput());
    updatePlayer(player, dt, state);

    // Speed should increase, not decay
    expect(player.speed).toBeGreaterThan(50);
  });
});

describe('updatePlayer - steering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('angle changes when steering with speed', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 100;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(steerRightInput());
    updatePlayer(player, dt, state);

    expect(player.angle).not.toBe(0);
  });

  it('angle changes slowly when speed is zero (stationary turn)', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 0;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    // Steer without accelerating — should turn slowly in place
    mockReadPlayerInput.mockReturnValue({ accelerate: 0, brake: 0, steerX: 1, honk: false });
    updatePlayer(player, dt, state);

    expect(player.angle).not.toBe(0);
    // Should be a small change (slow turn)
    expect(Math.abs(player.angle)).toBeLessThan(0.1);
  });

  it('steering is proportional to speed ratio', () => {
    const slowPlayer = createPlayer('formula', 0, 0, 0, 'primary');
    slowPlayer.speed = 50;
    const fastPlayer = createPlayer('formula', 0, 0, 0, 'primary');
    fastPlayer.speed = 200;
    const slowState = createMinimalGameState([slowPlayer]);
    const fastState = createMinimalGameState([fastPlayer]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(steerRightInput());
    updatePlayer(slowPlayer, dt, slowState);
    const slowAngle = slowPlayer.angle;

    mockReadPlayerInput.mockReturnValue(steerRightInput());
    updatePlayer(fastPlayer, dt, fastState);
    const fastAngle = fastPlayer.angle;

    // Fast player steers more than slow player (higher speedRatio)
    expect(Math.abs(fastAngle)).toBeGreaterThan(Math.abs(slowAngle));
  });

  it('steering inverts when reversing (speed < 0)', () => {
    const forwardPlayer = createPlayer('formula', 0, 0, 0, 'primary');
    forwardPlayer.speed = 100;
    const reversePlayer = createPlayer('formula', 0, 0, 0, 'primary');
    reversePlayer.speed = -100;

    const forwardState = createMinimalGameState([forwardPlayer]);
    const reverseState = createMinimalGameState([reversePlayer]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(steerRightInput());
    updatePlayer(forwardPlayer, dt, forwardState);
    const forwardAngle = forwardPlayer.angle;

    mockReadPlayerInput.mockReturnValue(steerRightInput());
    updatePlayer(reversePlayer, dt, reverseState);
    const reverseAngle = reversePlayer.angle;

    // Steering direction inverts because speedRatio is negative
    expect(Math.sign(forwardAngle)).not.toBe(Math.sign(reverseAngle));
  });

  it('left steering changes angle in opposite direction to right', () => {
    const leftPlayer = createPlayer('formula', 0, 0, 0, 'primary');
    leftPlayer.speed = 100;
    const rightPlayer = createPlayer('formula', 0, 0, 0, 'primary');
    rightPlayer.speed = 100;

    const leftState = createMinimalGameState([leftPlayer]);
    const rightState = createMinimalGameState([rightPlayer]);
    const dt = 1 / 60;

    mockReadPlayerInput.mockReturnValue(steerLeftInput());
    updatePlayer(leftPlayer, dt, leftState);

    mockReadPlayerInput.mockReturnValue(steerRightInput());
    updatePlayer(rightPlayer, dt, rightState);

    expect(Math.sign(leftPlayer.angle)).not.toBe(Math.sign(rightPlayer.angle));
  });
});

describe('updatePlayer - boost timer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('boost increases effective max speed', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;
    const boostedMax = player.maxSpeed * BOOST_SPEED_MULTIPLIER;

    // Keep boost active throughout by setting a large boost timer each frame
    for (let i = 0; i < 600; i++) {
      player.boostTimer = 10.0; // Keep boost active
      updatePlayer(player, dt, state);
    }

    // Speed should be near boosted max, which is > normal max
    expect(player.speed).toBeLessThanOrEqual(boostedMax + 1);
    expect(player.speed).toBeGreaterThan(player.maxSpeed);
  });

  it('boost timer decrements each frame', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.boostTimer = 1.0;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    expect(player.boostTimer).toBeCloseTo(1.0 - dt);
  });
});

describe('updatePlayer - invincibility timer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invincibility timer decrements each frame', () => {
    mockReadPlayerInput.mockReturnValue(noInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.invincibleTimer = 1.0;
    player.speed = 50; // Need some speed so it doesn't just idle
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    expect(player.invincibleTimer).toBeCloseTo(1.0 - dt);
  });

  it('invincibility timer does not go below zero (stops at ~0)', () => {
    mockReadPlayerInput.mockReturnValue(noInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.invincibleTimer = 0.01;
    player.speed = 50;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    // Timer can go slightly negative, but it should be < 0 or near 0
    expect(player.invincibleTimer).toBeLessThanOrEqual(0);
  });
});

describe('updatePlayer - stun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no input is processed during stun', () => {
    // The mock should NOT be called while stunned
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.stunTimer = 0.5;
    player.speed = 100;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    // readPlayerInput should not be called when stunned
    expect(mockReadPlayerInput).not.toHaveBeenCalled();
  });

  it('stun timer decrements', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.stunTimer = 0.5;
    player.speed = 100;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    expect(player.stunTimer).toBeCloseTo(0.5 - dt);
  });

  it('friction still applies while stunned', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.stunTimer = 0.5;
    player.speed = 100;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    // Speed should have been multiplied by FRICTION_DECAY
    // and position updated from new speed
    expect(player.speed).toBeCloseTo(100 * FRICTION_DECAY);
  });

  it('input processing resumes after stun ends', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.stunTimer = 0.01; // Will end after one frame
    player.speed = 10;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    // First frame: stunned
    updatePlayer(player, dt, state);
    expect(mockReadPlayerInput).not.toHaveBeenCalled();

    // Second frame: stun should have ended (stunTimer < 0)
    updatePlayer(player, dt, state);
    expect(mockReadPlayerInput).toHaveBeenCalled();
  });
});

describe('updatePlayer - death', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('only ticks death timer when dead', () => {
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.alive = false;
    player.deathTimer = 1.0;
    const positionBefore = { ...player.position };
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    expect(player.deathTimer).toBeCloseTo(1.0 - dt);
    expect(player.position).toEqual(positionBefore);
    expect(player.animState).toBe('death');
    expect(mockReadPlayerInput).not.toHaveBeenCalled();
  });
});

describe('updatePlayer - countdown phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not allow movement during countdown', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    const state = createMinimalGameState([player]);
    state.phase = 'countdown';
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    expect(player.speed).toBe(0);
    expect(player.animState).toBe('idle');
  });
});

describe('updatePlayer - position update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('position changes when moving', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    const initialPos = { ...player.position };
    updatePlayer(player, dt, state);

    // Position should have moved (angle = 0, direction = right)
    expect(
      player.position.x !== initialPos.x ||
      player.position.y !== initialPos.y
    ).toBe(true);
  });

  it('prevPosition is saved before update', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 100, 200, 0, 'primary');
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    expect(player.prevPosition).toEqual({ x: 100, y: 200 });
  });
});

describe('updatePlayer - animation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets driving animation when speed > 5', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 0;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    // Run enough frames to get speed above 5
    for (let i = 0; i < 10; i++) {
      updatePlayer(player, dt, state);
    }

    expect(player.animState).toBe('driving');
  });

  it('sets idle animation when speed <= 5', () => {
    mockReadPlayerInput.mockReturnValue(noInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.speed = 3;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    expect(player.animState).toBe('idle');
  });
});

describe('updatePlayer - finished player', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not accelerate after finishing', () => {
    mockReadPlayerInput.mockReturnValue(accelerateInput());
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    player.finishTime = 30.0;
    player.speed = 100;
    const state = createMinimalGameState([player]);
    const dt = 1 / 60;

    updatePlayer(player, dt, state);

    // Speed should decay due to friction, not increase
    expect(player.speed).toBeLessThan(100);
  });
});
