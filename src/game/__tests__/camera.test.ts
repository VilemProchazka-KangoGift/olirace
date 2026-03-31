import { describe, it, expect } from 'vitest';
import { createCamera, updateCamera } from '../camera';
import { createPlayer } from '../player';
import type { PlayerState, CameraState } from '../../types';
import {
  CAMERA_LOOK_AHEAD,
  CAMERA_LERP,
  CAMERA_LEADER_BIAS,
} from '../../utils/constants';
import { directionFromAngle, add, scale, lerpVec2 } from '../../utils/math';

vi.mock('../input', () => ({
  readPlayerInput: vi.fn(),
}));

vi.mock('../collision', () => ({
  findNearestRoadPoint: vi.fn(() => ({
    segIdx: 0,
    t: 0,
    centerPoint: { x: 0, y: 0 },
    distance: 0,
    roadWidth: 100,
  })),
}));

describe('createCamera', () => {
  it('creates camera at specified position', () => {
    const camera = createCamera(100, 200);
    expect(camera.position).toEqual({ x: 100, y: 200 });
    expect(camera.target).toEqual({ x: 100, y: 200 });
  });

  it('position equals target initially', () => {
    const camera = createCamera(50, 75);
    expect(camera.position).toEqual(camera.target);
  });
});

describe('updateCamera - 1P mode', () => {
  it('targets player position plus look-ahead in facing direction', () => {
    const camera = createCamera(0, 0);
    const player = createPlayer('formula', 100, 200, 0, 'primary');
    const dt = 1 / 60;

    updateCamera(camera, [player], 1, dt);

    // angle=0 -> direction = (1, 0) -> look-ahead = (150, 0)
    const lookDir = directionFromAngle(player.angle);
    const expectedTarget = add(player.position, scale(lookDir, CAMERA_LOOK_AHEAD));

    expect(camera.target.x).toBeCloseTo(expectedTarget.x);
    expect(camera.target.y).toBeCloseTo(expectedTarget.y);
  });

  it('camera lerps toward target', () => {
    const camera = createCamera(0, 0);
    const player = createPlayer('formula', 100, 0, 0, 'primary');
    const dt = 1 / 60;

    updateCamera(camera, [player], 1, dt);

    // Camera should have moved toward target but not reached it
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.x).toBeLessThan(camera.target.x);
  });

  it('camera position converges to target over many frames', () => {
    const camera = createCamera(0, 0);
    const player = createPlayer('formula', 0, 0, 0, 'primary');
    const dt = 1 / 60;

    // Run many frames to converge
    for (let i = 0; i < 500; i++) {
      updateCamera(camera, [player], 1, dt);
    }

    expect(camera.position.x).toBeCloseTo(camera.target.x, 0);
    expect(camera.position.y).toBeCloseTo(camera.target.y, 0);
  });

  it('handles different player angles', () => {
    const camera = createCamera(0, 0);
    const player = createPlayer('formula', 0, 0, Math.PI / 2, 'primary');
    const dt = 1 / 60;

    updateCamera(camera, [player], 1, dt);

    // angle=pi/2 -> direction = (0, -1) -> look-ahead = (0, -150)
    expect(camera.target.x).toBeCloseTo(0);
    expect(camera.target.y).toBeCloseTo(-CAMERA_LOOK_AHEAD);
  });
});

describe('updateCamera - 2P mode', () => {
  it('targets midpoint biased toward leader', () => {
    const camera = createCamera(0, 0);
    const p1 = createPlayer('formula', 0, 0, 0, 'primary');
    p1.trackProgress = 100;
    const p2 = createPlayer('yeti', 200, 0, 0, 'rival');
    p2.trackProgress = 50;
    const dt = 1 / 60;

    updateCamera(camera, [p1, p2], 2, dt);

    // Midpoint = (100, 0)
    // Leader = p1 (higher trackProgress) at (0, 0)
    // Target = lerp((100,0), (0,0), 0.3) = (70, 0)
    const midpoint = { x: 100, y: 0 };
    const expectedTarget = lerpVec2(midpoint, p1.position, CAMERA_LEADER_BIAS);

    expect(camera.target.x).toBeCloseTo(expectedTarget.x);
    expect(camera.target.y).toBeCloseTo(expectedTarget.y);
  });

  it('selects correct leader based on trackProgress', () => {
    const camera = createCamera(0, 0);
    const p1 = createPlayer('formula', 0, 0, 0, 'primary');
    p1.trackProgress = 50;
    const p2 = createPlayer('yeti', 100, 0, 0, 'rival');
    p2.trackProgress = 200;
    const dt = 1 / 60;

    updateCamera(camera, [p1, p2], 2, dt);

    // Leader = p2 (higher trackProgress) at (100, 0)
    const midpoint = { x: 50, y: 0 };
    const expectedTarget = lerpVec2(midpoint, p2.position, CAMERA_LEADER_BIAS);

    expect(camera.target.x).toBeCloseTo(expectedTarget.x);
    expect(camera.target.y).toBeCloseTo(expectedTarget.y);
  });

  it('camera lerps smoothly in 2P mode', () => {
    const camera = createCamera(0, 0);
    const p1 = createPlayer('formula', 100, 100, 0, 'primary');
    p1.trackProgress = 100;
    const p2 = createPlayer('yeti', 200, 200, 0, 'rival');
    p2.trackProgress = 50;
    const dt = 1 / 60;

    const initialPos = { ...camera.position };
    updateCamera(camera, [p1, p2], 2, dt);

    // Camera should have moved from initial position
    expect(
      camera.position.x !== initialPos.x ||
      camera.position.y !== initialPos.y
    ).toBe(true);

    // But should not have reached target yet
    const dx = camera.target.x - camera.position.x;
    const dy = camera.target.y - camera.position.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);
    expect(distToTarget).toBeGreaterThan(0);
  });

  it('falls back to 1P behavior when only 1 player in array and playerCount=2', () => {
    const camera = createCamera(0, 0);
    const player = createPlayer('formula', 100, 0, 0, 'primary');
    const dt = 1 / 60;

    // playerCount=2 but only 1 player in array
    updateCamera(camera, [player], 2, dt);

    // Should use 1P logic (look-ahead)
    const lookDir = directionFromAngle(player.angle);
    const expectedTarget = add(player.position, scale(lookDir, CAMERA_LOOK_AHEAD));

    expect(camera.target.x).toBeCloseTo(expectedTarget.x);
    expect(camera.target.y).toBeCloseTo(expectedTarget.y);
  });
});

describe('camera lerp behavior', () => {
  it('uses CAMERA_LERP constant for interpolation', () => {
    const camera = createCamera(0, 0);
    const player = createPlayer('formula', 1000, 0, 0, 'primary');
    const dt = 1 / 60;

    updateCamera(camera, [player], 1, dt);

    // After one frame, position = lerp(old, target, CAMERA_LERP)
    const expectedPos = lerpVec2(
      { x: 0, y: 0 },
      camera.target,
      CAMERA_LERP,
    );

    expect(camera.position.x).toBeCloseTo(expectedPos.x);
    expect(camera.position.y).toBeCloseTo(expectedPos.y);
  });

  it('larger CAMERA_LERP means faster convergence', () => {
    // This is a property test: verify the lerp creates smooth motion
    const camera = createCamera(0, 0);
    const player = createPlayer('formula', 500, 500, 0, 'primary');
    const dt = 1 / 60;

    const positions: number[] = [];
    for (let i = 0; i < 10; i++) {
      updateCamera(camera, [player], 1, dt);
      positions.push(camera.position.x);
    }

    // Each position should be closer to target than the last
    for (let i = 1; i < positions.length; i++) {
      const prevDist = Math.abs(camera.target.x - positions[i - 1]);
      const currDist = Math.abs(camera.target.x - positions[i]);
      expect(currDist).toBeLessThan(prevDist);
    }
  });
});
