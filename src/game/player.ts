import type { PlayerState, GameState, Vec2, RoadPoint } from '../types';
import {
  FRICTION_DECAY,
  REVERSE_SPEED_MULTIPLIER,
  BOOST_SPEED_MULTIPLIER,
  BOOST_DURATION,
  DEATH_ANIMATION_DURATION,
  INVINCIBILITY_DURATION,
  PLAYER_HITBOX_RADIUS,
} from '../utils/constants';
import {
  vec2,
  directionFromAngle,
  angleToDirectionIndex,
  clamp,
  distance,
  projectPointOnSegment,
  add,
  sub,
  scale,
  length,
} from '../utils/math';
import { getCharacter } from '../data/characters';
import { readPlayerInput } from './input';
import { findNearestRoadPoint } from './collision';
import { audioManager } from './audio';

export function createPlayer(
  characterId: string,
  x: number,
  y: number,
  angle: number,
  palette: 'primary' | 'rival',
): PlayerState {
  const char = getCharacter(characterId);
  return {
    characterId,
    position: vec2(x, y),
    prevPosition: vec2(x, y),
    velocity: vec2(0, 0),
    angle,
    speed: 0,
    maxSpeed: char.maxSpeed,
    acceleration: char.acceleration,
    handling: char.handling,
    weight: char.weight,
    brakeForce: char.brakeForce,
    boostTimer: 0,
    alive: true,
    deathTimer: 0,
    invincibleTimer: 0,
    stunTimer: 0,
    deaths: 0,
    finishTime: null,
    trackProgress: 0,
    input: { accelerate: 0, brake: 0, steerX: 0, honk: false },
    palette,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    directionIndex: angleToDirectionIndex(angle),
    boostParticleTimer: 0,
    honkTimer: 0,
    jumpTimer: 0,
    jumpHeight: 0,
  };
}

export function updatePlayer(
  player: PlayerState,
  dt: number,
  gameState: GameState,
): void {
  // Save previous position for interpolation
  player.prevPosition = { ...player.position };

  // If dead, only tick death timer
  if (!player.alive) {
    player.deathTimer -= dt;
    player.animState = 'death';
    return;
  }

  // If stunned, only tick stun timer (no input)
  if (player.stunTimer > 0) {
    player.stunTimer -= dt;
    // Still apply friction while stunned
    player.speed *= FRICTION_DECAY;
    updatePositionFromSpeed(player, dt);
    return;
  }

  // 1. Read input
  const playerIndex = gameState.players.indexOf(player);
  const input = readPlayerInput(playerIndex);
  player.input = input;

  // Don't allow movement during countdown
  if (gameState.phase === 'countdown') {
    player.animState = 'idle';
    return;
  }

  // Don't allow input after finishing - coast to stop with jump animation
  if (player.finishTime !== null) {
    player.speed *= FRICTION_DECAY;
    updatePositionFromSpeed(player, dt);
    player.jumpTimer += dt;
    const diminish = Math.max(0, 1 - player.jumpTimer * 0.5);
    player.jumpHeight = Math.abs(Math.sin(player.jumpTimer * 8)) * 20 * diminish;
    return;
  }

  // 2. Accelerate
  const currentMaxSpeed =
    player.boostTimer > 0
      ? player.maxSpeed * BOOST_SPEED_MULTIPLIER
      : player.maxSpeed;

  if (input.accelerate > 0) {
    player.speed += player.acceleration * input.accelerate * dt;
    if (player.speed > currentMaxSpeed) {
      player.speed = currentMaxSpeed;
    }
  }

  // 3. Brake
  if (input.brake > 0) {
    player.speed -= player.brakeForce * input.brake * dt;
    const reverseMax = -player.maxSpeed * REVERSE_SPEED_MULTIPLIER;
    if (player.speed < reverseMax) {
      player.speed = reverseMax;
    }
  }

  // 4. Friction: when neither accelerating nor braking
  if (input.accelerate === 0 && input.brake === 0) {
    player.speed *= FRICTION_DECAY;
    // Stop completely when very slow
    if (Math.abs(player.speed) < 1) {
      player.speed = 0;
    }
  }

  // 5. Steering: angle -= handling * steerX * (speed / maxSpeed) * dt
  // Negative because in our coordinate system (Y-down canvas, angle 0=right, π/2=up),
  // pressing right (steerX>0) should rotate clockwise = decrease angle.
  // When speed is negative (reversing), the sign flips naturally, so pressing
  // left while reversing turns the car right — matching real car behavior.
  if (input.steerX !== 0 && player.speed !== 0) {
    const speedRatio = player.speed / player.maxSpeed;
    player.angle -= player.handling * input.steerX * speedRatio * dt;
  }

  // 6. Update velocity and position
  updatePositionFromSpeed(player, dt);

  // 7. Update timers
  if (player.boostTimer > 0) {
    player.boostTimer -= dt;
    player.boostParticleTimer -= dt;
  }

  if (player.invincibleTimer > 0) {
    player.invincibleTimer -= dt;
  }

  if (player.honkTimer > 0) {
    player.honkTimer -= dt;
  }

  if (input.honk && player.honkTimer <= 0) {
    player.honkTimer = 0.5;
    audioManager.play('sfx_honk');
  }

  // 8. Update animation state and direction index
  if (Math.abs(player.speed) > 5) {
    player.animState = 'driving';
  } else {
    player.animState = 'idle';
  }

  player.directionIndex = angleToDirectionIndex(player.angle);

  // Tick animation timer
  player.animTimer += dt;
  const animSpeed = 0.15;
  if (player.animTimer >= animSpeed) {
    player.animTimer -= animSpeed;
    player.animFrame = (player.animFrame + 1) % 4;
  }
}

function updatePositionFromSpeed(player: PlayerState, dt: number): void {
  const dir = directionFromAngle(player.angle);
  player.velocity = scale(dir, player.speed);
  player.position = add(player.position, scale(player.velocity, dt));
}

export function computeTrackProgress(
  player: PlayerState,
  road: RoadPoint[],
): number {
  const nearest = findNearestRoadPoint(player.position, road);

  // Sum the lengths of all segments before the nearest segment
  let distanceAlong = 0;
  for (let i = 0; i < nearest.segIdx; i++) {
    const segStart: Vec2 = { x: road[i].x, y: road[i].y };
    const segEnd: Vec2 = { x: road[i + 1].x, y: road[i + 1].y };
    distanceAlong += distance(segStart, segEnd);
  }

  // Add the fractional distance within the current segment
  if (nearest.segIdx < road.length - 1) {
    const segStart: Vec2 = {
      x: road[nearest.segIdx].x,
      y: road[nearest.segIdx].y,
    };
    const segEnd: Vec2 = {
      x: road[nearest.segIdx + 1].x,
      y: road[nearest.segIdx + 1].y,
    };
    distanceAlong += distance(segStart, segEnd) * nearest.t;
  }

  return distanceAlong;
}
