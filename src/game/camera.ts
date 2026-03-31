import type { CameraState, PlayerState } from '../types';
import {
  vec2,
  lerpVec2,
  directionFromAngle,
  add,
  scale,
} from '../utils/math';
import {
  CAMERA_LERP,
  CAMERA_LOOK_AHEAD,
  CAMERA_LEADER_BIAS,
} from '../utils/constants';

export function createCamera(x: number, y: number): CameraState {
  return {
    position: vec2(x, y),
    target: vec2(x, y),
  };
}

export function updateCamera(
  camera: CameraState,
  players: PlayerState[],
  playerCount: 1 | 2,
  dt: number,
): void {
  let target = camera.target;

  if (playerCount === 1 || players.length === 1) {
    // 1P: target = player.position + 150px in facing direction
    const p = players[0];
    const lookDir = directionFromAngle(p.angle);
    target = add(p.position, scale(lookDir, CAMERA_LOOK_AHEAD));
  } else {
    // 2P: target = lerp(midpoint(p1, p2), leader.position, 0.3)
    const p1 = players[0];
    const p2 = players[1];

    const midpoint = {
      x: (p1.position.x + p2.position.x) / 2,
      y: (p1.position.y + p2.position.y) / 2,
    };

    // Leader is the player further along the track
    const leader =
      p1.trackProgress >= p2.trackProgress ? p1 : p2;

    target = lerpVec2(midpoint, leader.position, CAMERA_LEADER_BIAS);
  }

  camera.target = target;

  // Smooth follow
  camera.position = lerpVec2(camera.position, target, CAMERA_LERP);
}
