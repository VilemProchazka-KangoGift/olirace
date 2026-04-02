import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameState, PlayerState, PlayerInput, RoadPoint } from '../../types';
import { createPlayer, updatePlayer } from '../player';
import {
  FRICTION_DECAY,
  REVERSE_SPEED_MULTIPLIER,
  BOOST_SPEED_MULTIPLIER,
  FIXED_TIMESTEP,
} from '../../utils/constants';

// Mock input and collision modules
vi.mock('../input', () => ({
  readPlayerInput: vi.fn(),
}));
vi.mock('../collision', () => ({
  findNearestRoadPoint: vi.fn(() => ({
    segIdx: 0,
    t: 0,
    centerPoint: { x: 0, y: 0 },
    distance: 0,
    roadWidth: 200,
  })),
}));
vi.mock('../audio', () => ({
  audioManager: { play: vi.fn(), init: vi.fn(), playLoop: vi.fn(), stop: vi.fn(), updateEngineSound: vi.fn() },
}));

import { readPlayerInput } from '../input';
const mockInput = vi.mocked(readPlayerInput);

const DT = FIXED_TIMESTEP; // 1/60

function makeState(players?: PlayerState[]): GameState {
  const road: RoadPoint[] = [
    { x: 240, y: 5000, width: 200 },
    { x: 240, y: 4000, width: 200 },
    { x: 240, y: 3000, width: 200 },
    { x: 240, y: 2000, width: 200 },
    { x: 240, y: 1000, width: 200 },
  ];
  const p = players ?? [createPlayer('formula', 240, 5000, Math.PI / 2, 'primary')];
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
      finishLine: 4,
      startPositions: {
        p1: { x: 220, y: 5000, angle: Math.PI / 2 },
        p2: { x: 260, y: 5000, angle: Math.PI / 2 },
      },
    },
    camera: { position: { x: 240, y: 5000 }, target: { x: 240, y: 5000 } },
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
    botCount: 0,
    aiStates: [],
  };
}

function input(overrides: Partial<PlayerInput> = {}): PlayerInput {
  return { accelerate: 0, brake: 0, steerX: 0, honk: false, ...overrides };
}

function runFrames(
  player: PlayerState,
  state: GameState,
  frames: number,
  inp: PlayerInput,
): void {
  mockInput.mockReturnValue(inp);
  for (let i = 0; i < frames; i++) {
    updatePlayer(player, DT, state);
  }
}

// ─── Input mapping ──────────────────────────────────────────────────────────
describe('Input mapping: P1=Arrows, P2=WASD', () => {
  beforeEach(() => vi.clearAllMocks());

  it('readPlayerInput is called with correct player index for P1', () => {
    mockInput.mockReturnValue(input());
    const p1 = createPlayer('formula', 0, 0, Math.PI / 2, 'primary');
    const state = makeState([p1]);
    updatePlayer(p1, DT, state);
    expect(mockInput).toHaveBeenCalledWith(0);
  });

  it('readPlayerInput is called with correct player index for P2', () => {
    mockInput.mockReturnValue(input());
    const p1 = createPlayer('formula', 0, 0, Math.PI / 2, 'primary');
    const p2 = createPlayer('cat', 20, 0, Math.PI / 2, 'rival');
    const state = makeState([p1, p2]);
    state.playerCount = 2;
    updatePlayer(p2, DT, state);
    expect(mockInput).toHaveBeenCalledWith(1);
  });
});

// ─── Steering direction ─────────────────────────────────────────────────────
describe('Steering direction correctness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('steer right from facing-up moves car rightward (positive X)', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 200;
    const state = makeState([player]);
    const startX = player.position.x;

    // Steer right for several frames
    runFrames(player, state, 30, input({ accelerate: 1, steerX: 1 }));

    // Car should have moved rightward (positive X direction)
    expect(player.position.x).toBeGreaterThan(startX);
  });

  it('steer left from facing-up moves car leftward (negative X)', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 200;
    const state = makeState([player]);
    const startX = player.position.x;

    runFrames(player, state, 30, input({ accelerate: 1, steerX: -1 }));

    expect(player.position.x).toBeLessThan(startX);
  });

  it('steer right from facing-right moves car downward (positive Y = south)', () => {
    const player = createPlayer('formula', 240, 3000, 0, 'primary');
    player.speed = 200;
    const state = makeState([player]);
    const startY = player.position.y;

    runFrames(player, state, 30, input({ accelerate: 1, steerX: 1 }));

    // Turning right from facing east → car curves south → Y increases
    expect(player.position.y).toBeGreaterThan(startY);
  });

  it('steer left from facing-right moves car upward (negative Y = north)', () => {
    const player = createPlayer('formula', 240, 3000, 0, 'primary');
    player.speed = 200;
    const state = makeState([player]);
    const startY = player.position.y;

    runFrames(player, state, 30, input({ accelerate: 1, steerX: -1 }));

    expect(player.position.y).toBeLessThan(startY);
  });

  it('steering right then left returns approximately to original heading', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 200;
    const state = makeState([player]);
    const startAngle = player.angle;

    runFrames(player, state, 20, input({ accelerate: 1, steerX: 1 }));
    const midAngle = player.angle;
    expect(midAngle).not.toBeCloseTo(startAngle, 1); // angle changed

    runFrames(player, state, 20, input({ accelerate: 1, steerX: -1 }));
    // Should roughly return (not exact due to speed changes)
    expect(player.angle).toBeCloseTo(startAngle, 0);
  });
});

// ─── Reverse steering ───────────────────────────────────────────────────────
describe('Reverse steering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('steering right while reversing turns the car LEFT (opposite)', () => {
    // Car faces up, has negative speed (reversing)
    const forwardPlayer = createPlayer('formula', 240, 3000, Math.PI / 2, 'primary');
    forwardPlayer.speed = 100;
    const reversePlayer = createPlayer('formula', 240, 3000, Math.PI / 2, 'primary');
    reversePlayer.speed = -50;

    const fState = makeState([forwardPlayer]);
    const rState = makeState([reversePlayer]);

    // Steer right in both
    mockInput.mockReturnValue(input({ steerX: 1 }));
    updatePlayer(forwardPlayer, DT, fState);
    mockInput.mockReturnValue(input({ steerX: 1 }));
    updatePlayer(reversePlayer, DT, rState);

    // Forward: steerRight decreases angle (turns CW on screen)
    // Reverse: steerRight should increase angle (turns CCW on screen — opposite)
    const forwardDelta = forwardPlayer.angle - Math.PI / 2;
    const reverseDelta = reversePlayer.angle - Math.PI / 2;
    expect(Math.sign(forwardDelta)).not.toBe(Math.sign(reverseDelta));
  });

  it('car can reverse in a straight line', () => {
    const player = createPlayer('formula', 240, 3000, Math.PI / 2, 'primary');
    const state = makeState([player]);
    const startY = player.position.y;

    // Brake to reverse
    runFrames(player, state, 60, input({ brake: 1 }));

    // Car facing up (PI/2) reversing means Y increases (going down/south)
    expect(player.speed).toBeLessThan(0);
    expect(player.position.y).toBeGreaterThan(startY);
  });
});

// ─── Acceleration and speed ─────────────────────────────────────────────────
describe('Acceleration and speed physics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('car starts from zero speed and accelerates', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const state = makeState([player]);
    expect(player.speed).toBe(0);

    runFrames(player, state, 1, input({ accelerate: 1 }));
    expect(player.speed).toBeGreaterThan(0);
  });

  it('acceleration rate matches character stat', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const state = makeState([player]);

    // Formula accel = 200 px/s²
    mockInput.mockReturnValue(input({ accelerate: 1 }));
    updatePlayer(player, DT, state);

    const expectedSpeed = 200 * DT; // 200 * (1/60) ≈ 3.33
    expect(player.speed).toBeCloseTo(expectedSpeed, 2);
  });

  it('speed caps at maxSpeed', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const state = makeState([player]);

    // Run for 10 seconds worth of frames
    runFrames(player, state, 600, input({ accelerate: 1 }));

    expect(player.speed).toBe(player.maxSpeed); // 280
  });

  it('braking decelerates then reverses', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 50;
    const state = makeState([player]);

    runFrames(player, state, 5, input({ brake: 1 }));
    expect(player.speed).toBeLessThan(50); // Decelerating

    // Continue until reversed
    runFrames(player, state, 60, input({ brake: 1 }));
    expect(player.speed).toBeLessThan(0); // Reversed
  });

  it('reverse speed caps at -maxSpeed * 0.4', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const state = makeState([player]);
    const reverseMax = -player.maxSpeed * REVERSE_SPEED_MULTIPLIER;

    runFrames(player, state, 600, input({ brake: 1 }));

    expect(player.speed).toBeCloseTo(reverseMax, 0);
    expect(player.speed).toBeGreaterThanOrEqual(reverseMax);
  });

  it('friction decay stops the car when no input', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 200;
    const state = makeState([player]);

    runFrames(player, state, 600, input());

    expect(player.speed).toBe(0);
  });

  it('friction decay rate is FRICTION_DECAY per frame', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 100;
    const state = makeState([player]);

    mockInput.mockReturnValue(input());
    updatePlayer(player, DT, state);

    expect(player.speed).toBeCloseTo(100 * FRICTION_DECAY, 4);
  });

  it('half-throttle produces half the acceleration', () => {
    const fullPlayer = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const halfPlayer = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const fullState = makeState([fullPlayer]);
    const halfState = makeState([halfPlayer]);

    mockInput.mockReturnValue(input({ accelerate: 1 }));
    updatePlayer(fullPlayer, DT, fullState);

    mockInput.mockReturnValue(input({ accelerate: 0.5 }));
    updatePlayer(halfPlayer, DT, halfState);

    expect(halfPlayer.speed).toBeCloseTo(fullPlayer.speed / 2, 4);
  });
});

// ─── Position integration ───────────────────────────────────────────────────
describe('Position integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('facing up (PI/2) and accelerating moves in -Y direction', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const state = makeState([player]);
    const startY = player.position.y;

    runFrames(player, state, 10, input({ accelerate: 1 }));

    expect(player.position.y).toBeLessThan(startY); // Moving up = decreasing Y
    expect(player.position.x).toBeCloseTo(240, 0); // No lateral movement
  });

  it('facing right (0) and accelerating moves in +X direction', () => {
    const player = createPlayer('formula', 240, 3000, 0, 'primary');
    const state = makeState([player]);
    const startX = player.position.x;

    runFrames(player, state, 10, input({ accelerate: 1 }));

    expect(player.position.x).toBeGreaterThan(startX);
    expect(player.position.y).toBeCloseTo(3000, 0);
  });

  it('facing down (-PI/2) and accelerating moves in +Y direction', () => {
    const player = createPlayer('formula', 240, 3000, -Math.PI / 2, 'primary');
    const state = makeState([player]);
    const startY = player.position.y;

    runFrames(player, state, 10, input({ accelerate: 1 }));

    expect(player.position.y).toBeGreaterThan(startY);
  });

  it('velocity vector matches speed and angle', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const state = makeState([player]);

    runFrames(player, state, 10, input({ accelerate: 1 }));

    // Facing up → velocity.x ≈ 0, velocity.y < 0
    expect(Math.abs(player.velocity.x)).toBeLessThan(0.01);
    expect(player.velocity.y).toBeLessThan(0);
    // Velocity magnitude should match speed
    const velMag = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
    expect(velMag).toBeCloseTo(Math.abs(player.speed), 1);
  });

  it('prevPosition is saved before each update for interpolation', () => {
    const player = createPlayer('formula', 100, 200, Math.PI / 2, 'primary');
    const state = makeState([player]);

    runFrames(player, state, 1, input({ accelerate: 1 }));

    expect(player.prevPosition).toEqual({ x: 100, y: 200 });
    expect(player.position.y).toBeLessThan(200); // Moved
  });

  it('position integrates correctly over 1 second at constant speed', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const state = makeState([player]);

    // Run 60 frames (1 second) with constant acceleration
    // Set speed directly before position update via a simpler approach:
    // Just check that one frame at 60 px/s moves ~1px
    player.speed = 60; // 60 px/s → 1 px per frame at 60fps
    mockInput.mockReturnValue(input({ accelerate: 1 }));

    // Capture position, do one manual update
    const startY = player.position.y;
    player.prevPosition = { ...player.position };
    // velocity = dir * speed, position += velocity * dt
    // dir for PI/2 = (0, -1), so position.y -= 60 * (1/60) = -1
    updatePlayer(player, DT, state);

    // Speed changed (acceleration added), but first frame's position delta
    // should be based on initial speed + accel for that frame
    const dy = startY - player.position.y;
    expect(dy).toBeGreaterThan(0); // Moved upward
    expect(dy).toBeCloseTo(1, 0); // ~1px at 60px/s for 1/60s
  });
});

// ─── Boost physics ──────────────────────────────────────────────────────────
describe('Boost physics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('boost allows speed above normal maxSpeed', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = player.maxSpeed; // Already at max
    player.boostTimer = 2.0;
    const state = makeState([player]);

    // Accelerate with boost active
    runFrames(player, state, 60, input({ accelerate: 1 }));

    expect(player.speed).toBeGreaterThan(player.maxSpeed);
    expect(player.speed).toBeLessThanOrEqual(player.maxSpeed * BOOST_SPEED_MULTIPLIER);
  });

  it('speed clamps back to maxSpeed after boost expires', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = player.maxSpeed * BOOST_SPEED_MULTIPLIER;
    player.boostTimer = 0.02; // Expires after 1 frame
    const state = makeState([player]);

    // After boost expires, maxSpeed cap is normal again
    runFrames(player, state, 60, input({ accelerate: 1 }));

    expect(player.boostTimer).toBeLessThanOrEqual(0);
    expect(player.speed).toBe(player.maxSpeed);
  });
});

// ─── Stun and death ─────────────────────────────────────────────────────────
describe('Stun and death states', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stunned player slides with friction but cannot steer', () => {
    const player = createPlayer('formula', 240, 3000, Math.PI / 2, 'primary');
    player.speed = 100;
    player.stunTimer = 0.3;
    const state = makeState([player]);
    const startAngle = player.angle;

    // Even with steer input, angle shouldn't change while stunned
    mockInput.mockReturnValue(input({ accelerate: 1, steerX: 1 }));
    updatePlayer(player, DT, state);

    expect(player.angle).toBe(startAngle);
    expect(player.speed).toBeCloseTo(100 * FRICTION_DECAY);
    expect(mockInput).not.toHaveBeenCalled();
  });

  it('dead player does not move', () => {
    const player = createPlayer('formula', 240, 3000, Math.PI / 2, 'primary');
    player.alive = false;
    player.deathTimer = 0.42;
    const startPos = { ...player.position };
    const state = makeState([player]);

    runFrames(player, state, 10, input({ accelerate: 1 }));

    expect(player.position).toEqual(startPos);
  });

  it('finished player coasts to a stop', () => {
    const player = createPlayer('formula', 240, 3000, Math.PI / 2, 'primary');
    player.finishTime = 45.0;
    player.speed = 200;
    const state = makeState([player]);

    runFrames(player, state, 600, input({ accelerate: 1 }));

    // Speed should have decayed to near-zero despite accelerate input
    expect(player.speed).toBeLessThan(1);
  });
});

// ─── Character differences ──────────────────────────────────────────────────
describe('Character stat differences in driving', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Formula reaches higher top speed than Yeti', () => {
    const formula = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const yeti = createPlayer('yeti', 240, 5000, Math.PI / 2, 'primary');
    const fState = makeState([formula]);
    const yState = makeState([yeti]);

    runFrames(formula, fState, 600, input({ accelerate: 1 }));
    runFrames(yeti, yState, 600, input({ accelerate: 1 }));

    expect(formula.speed).toBeGreaterThan(yeti.speed);
    expect(formula.speed).toBe(280); // Formula maxSpeed
    expect(yeti.speed).toBe(180); // Yeti maxSpeed
  });

  it('Cat turns tighter than Pig at same speed', () => {
    const cat = createPlayer('cat', 240, 3000, Math.PI / 2, 'primary');
    cat.speed = 150;
    const pig = createPlayer('pig', 240, 3000, Math.PI / 2, 'primary');
    pig.speed = 150;

    const cState = makeState([cat]);
    const pState = makeState([pig]);

    runFrames(cat, cState, 20, input({ steerX: 1 }));
    runFrames(pig, pState, 20, input({ steerX: 1 }));

    // Cat handling=4.5, Pig handling=2.2 → Cat turns more
    const catDelta = Math.abs(cat.angle - Math.PI / 2);
    const pigDelta = Math.abs(pig.angle - Math.PI / 2);
    expect(catDelta).toBeGreaterThan(pigDelta);
  });

  it('Yeti accelerates slower than Formula', () => {
    const formula = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    const yeti = createPlayer('yeti', 240, 5000, Math.PI / 2, 'primary');
    const fState = makeState([formula]);
    const yState = makeState([yeti]);

    runFrames(formula, fState, 10, input({ accelerate: 1 }));
    runFrames(yeti, yState, 10, input({ accelerate: 1 }));

    expect(formula.speed).toBeGreaterThan(yeti.speed);
  });
});

// ─── Two-player independence ────────────────────────────────────────────────
describe('Two-player independence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P1 and P2 move independently', () => {
    const p1 = createPlayer('formula', 220, 5000, Math.PI / 2, 'primary');
    const p2 = createPlayer('cat', 260, 5000, Math.PI / 2, 'rival');
    const state = makeState([p1, p2]);
    state.playerCount = 2;

    // P1 accelerates, P2 does nothing
    mockInput.mockImplementation((idx) =>
      idx === 0 ? input({ accelerate: 1 }) : input(),
    );

    for (let i = 0; i < 30; i++) {
      updatePlayer(p1, DT, state);
      updatePlayer(p2, DT, state);
    }

    expect(p1.speed).toBeGreaterThan(0);
    expect(p2.speed).toBe(0);
    expect(p1.position.y).toBeLessThan(5000);
    expect(p2.position.y).toBe(5000);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────
describe('Edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('simultaneous accelerate and brake favours neither (both apply)', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 100;
    const state = makeState([player]);

    mockInput.mockReturnValue(input({ accelerate: 1, brake: 1 }));
    updatePlayer(player, DT, state);

    // Accel adds (200 * 1/60 ≈ 3.33), brake subtracts (300 * 1/60 = 5)
    // Net ≈ -1.67, so speed should be slightly less than 100
    expect(player.speed).toBeLessThan(100);
    expect(player.speed).toBeGreaterThan(95);
  });

  it('turning at zero speed rotates slowly in place', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 0;
    const state = makeState([player]);

    runFrames(player, state, 30, input({ steerX: 1 }));

    // Angle should change (slow turn), but position stays the same
    expect(player.angle).not.toBe(Math.PI / 2);
    expect(player.position.x).toBe(240);
    expect(player.position.y).toBe(5000);
  });

  it('very small speed stops completely via friction threshold', () => {
    const player = createPlayer('formula', 240, 5000, Math.PI / 2, 'primary');
    player.speed = 0.5; // Below threshold of 1
    const state = makeState([player]);

    mockInput.mockReturnValue(input());
    updatePlayer(player, DT, state);

    expect(player.speed).toBe(0);
  });
});
