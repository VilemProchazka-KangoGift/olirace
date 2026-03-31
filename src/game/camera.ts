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
  playerCount: 1 | 2 | 3 | 4,
  dt: number,
): void {
  let target = camera.target;

  if (playerCount === 1 || players.length === 1) {
    // 1P: target = player.position + 150px in facing direction
    const p = players[0];
    const lookDir = directionFromAngle(p.angle);
    target = add(p.position, scale(lookDir, CAMERA_LOOK_AHEAD));
  } else {
    // Multi-player: target = lerp(midpoint of all players, leader.position, 0.3)
    const midpoint = { x: 0, y: 0 };
    for (const p of players) {
      midpoint.x += p.position.x;
      midpoint.y += p.position.y;
    }
    midpoint.x /= players.length;
    midpoint.y /= players.length;

    // Leader is the player further along the track
    let leader = players[0];
    for (let i = 1; i < players.length; i++) {
      if (players[i].trackProgress > leader.trackProgress) {
        leader = players[i];
      }
    }

    target = lerpVec2(midpoint, leader.position, CAMERA_LEADER_BIAS);
  }

  camera.target = target;

  // Smooth follow
  camera.position = lerpVec2(camera.position, target, CAMERA_LERP);
}
