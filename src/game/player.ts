import type { PlayerState, GameState, Vec2, RoadPoint } from '../types';
import {
  FRICTION_DECAY,
  REVERSE_SPEED_MULTIPLIER,
  BOOST_SPEED_MULTIPLIER,
  BOOST_DURATION,
  DEATH_ANIMATION_DURATION,
  INVINCIBILITY_DURATION,
  PLAYER_HITBOX_RADIUS,
  DRIFT_SPEED_THRESHOLD,
  DRIFT_FRICTION,
  DRIFT_HANDLING_BOOST,
  DRIFT_EXIT_SPEED_BONUS,
  DRIFT_MAX_CHARGE,
  MUD_SPEED_MULTIPLIER,
  SQUASH_RECOVERY_SPEED,
} from '../utils/constants';
import {
  vec2,
  directionFromAngle,
  clamp,
  distance,
  projectPointOnSegment,
  add,
  sub,
  scale,
  length,
  randomRange,
} from '../utils/math';
import { getCharacter } from '../data/characters';
import { readPlayerInput } from './input';
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
    boostParticleTimer: 0,
    honkTimer: 0,
    jumpTimer: 0,
    jumpHeight: 0,

    // Drift
    drifting: false,
    driftTimer: 0,
    driftAngle: 0,
    driftBoostCharge: 0,

    // Turbo start
    turboStartBonus: 0,

    // Visual juice
    squashX: 1,
    squashY: 1,
    wobblePhase: Math.random() * Math.PI * 2,
    expression: 'neutral',
    expressionTimer: 0,

    // Damage
    damageCount: 0,

    // Collision tracking
    collisionCount: 0,
    bumpsReceived: 0,

    // Ramp
    airborne: false,
    airborneTimer: 0,
    airborneHeight: 0,

    // Ragdoll
    ragdollSpin: 0,
    ragdollVx: 0,
    ragdollVy: 0,

    // Mud
    mudTimer: 0,

    // Road query cache
    nearestRoad: { segIdx: 0, t: 0, centerPoint: vec2(x, y), distance: 0, roadWidth: 280 },
    distFromRoadCenter: 0,
    roadHalfWidth: 140,

    // Position
    racePosition: 1,

    // Exhaust
    exhaustTimer: 0,

    // Skid
    skidTimer: 0,
  };
}

export function updatePlayer(
  player: PlayerState,
  dt: number,
  gameState: GameState,
): void {
  // Save previous position for interpolation
  player.prevPosition = { ...player.position };

  // Recover squash/stretch toward 1.0
  player.squashX += (1 - player.squashX) * SQUASH_RECOVERY_SPEED * dt;
  player.squashY += (1 - player.squashY) * SQUASH_RECOVERY_SPEED * dt;

  // Expression timer
  if (player.expressionTimer > 0) {
    player.expressionTimer -= dt;
    if (player.expressionTimer <= 0) {
      player.expression = 'neutral';
    }
  }

  // Wobble phase always advances
  player.wobblePhase += dt * 3;

  // Mud timer
  if (player.mudTimer > 0) {
    player.mudTimer -= dt;
  }

  // Airborne physics
  if (player.airborne) {
    player.airborneTimer -= dt;
    const progress = 1 - Math.max(0, player.airborneTimer / 0.6);
    player.airborneHeight = Math.sin(progress * Math.PI) * 30;
    if (player.airborneTimer <= 0) {
      player.airborne = false;
      player.airborneHeight = 0;
      // Landing squash
      player.squashX = 1.3;
      player.squashY = 0.7;
      audioManager.play('sfx_ramp_land');
    }
    // While airborne, coast with no friction and no collisions
    updatePositionFromSpeed(player, dt);
    return;
  }

  // If dead, do ragdoll physics
  if (!player.alive) {
    player.deathTimer -= dt;
    player.animState = 'death';
    // Ragdoll movement
    player.position.x += player.ragdollVx * dt;
    player.position.y += player.ragdollVy * dt;
    player.ragdollVx *= 0.95;
    player.ragdollVy *= 0.95;
    player.angle += player.ragdollSpin * dt;
    player.ragdollSpin *= 0.97;
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

  // Apply turbo start bonus (decays quickly)
  if (player.turboStartBonus > 0) {
    player.turboStartBonus -= dt * 2; // decays over ~0.25s
    if (player.turboStartBonus < 0) player.turboStartBonus = 0;
  }

  // 2. Accelerate
  const mudMultiplier = player.mudTimer > 0 ? MUD_SPEED_MULTIPLIER : 1;
  const currentMaxSpeed =
    (player.boostTimer > 0
      ? player.maxSpeed * BOOST_SPEED_MULTIPLIER
      : player.maxSpeed) * mudMultiplier
    + player.turboStartBonus;

  if (input.accelerate > 0) {
    player.speed += player.acceleration * input.accelerate * dt * mudMultiplier;
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

  // 4. Drift mechanic: brake + steer while going fast
  const speedRatio = Math.abs(player.speed) / player.maxSpeed;
  const wasDrifting = player.drifting;

  if (
    input.brake > 0 &&
    Math.abs(input.steerX) > 0.3 &&
    speedRatio > DRIFT_SPEED_THRESHOLD &&
    player.speed > 0
  ) {
    // Enter/continue drift
    player.drifting = true;
    player.driftTimer += dt;
    player.driftBoostCharge = Math.min(
      player.driftBoostCharge + dt,
      DRIFT_MAX_CHARGE,
    );
    // Visual drift angle
    player.driftAngle = input.steerX * 0.4;
    // Drift uses less friction so you keep speed
    player.speed *= DRIFT_FRICTION;
  } else {
    player.drifting = false;
    player.driftAngle *= 0.8; // smooth recovery
    if (Math.abs(player.driftAngle) < 0.01) player.driftAngle = 0;
  }

  // Drift exit boost
  if (wasDrifting && !player.drifting && player.driftBoostCharge > 0.2) {
    const bonus = player.driftBoostCharge * DRIFT_EXIT_SPEED_BONUS * player.maxSpeed;
    player.speed = Math.min(player.speed + bonus, player.maxSpeed * 1.3);
    // Squash/stretch: stretch forward on drift exit
    player.squashX = 0.8;
    player.squashY = 1.25;
    player.expression = 'happy';
    player.expressionTimer = 0.5;
    audioManager.play('sfx_drift_exit');
  }
  if (!player.drifting) {
    player.driftTimer = 0;
    player.driftBoostCharge = 0;
  }

  // 5. Friction: when neither accelerating nor braking
  if (input.accelerate === 0 && input.brake === 0 && !player.drifting) {
    player.speed *= FRICTION_DECAY;
    if (Math.abs(player.speed) < 1) {
      player.speed = 0;
    }
  }

  // 6. Steering
  if (input.steerX !== 0) {
    if (player.speed !== 0) {
      const steerSpeedRatio = player.speed / player.maxSpeed;
      const driftBoost = player.drifting ? DRIFT_HANDLING_BOOST : 1;
      player.angle -= player.handling * input.steerX * steerSpeedRatio * dt * driftBoost;
    } else {
      // Slow turning while stationary
      player.angle -= player.handling * input.steerX * 0.15 * dt;
    }
  }

  // 7. Update velocity and position
  updatePositionFromSpeed(player, dt);

  // 8. Update timers
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

  // 9. Update animation state and direction index
  if (Math.abs(player.speed) > 5) {
    player.animState = 'driving';
  } else {
    player.animState = 'idle';
  }

  // Tick animation timer
  player.animTimer += dt;
  const animSpeed = 0.15;
  if (player.animTimer >= animSpeed) {
    player.animTimer -= animSpeed;
    player.animFrame = (player.animFrame + 1) % 4;
  }

  // Expression: scared when near lava edges
  if (player.distFromRoadCenter > player.roadHalfWidth * 0.85 && player.expressionTimer <= 0) {
    player.expression = 'scared';
    player.expressionTimer = 0.3;
  }

  // Expression: happy when boosting
  if (player.boostTimer > 0 && player.expressionTimer <= 0) {
    player.expression = 'happy';
    player.expressionTimer = 0.2;
  }

  // Exhaust timer
  player.exhaustTimer -= dt;

  // Skid timer
  player.skidTimer -= dt;
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
  // Use cached nearestRoad from the current frame (computed once in engine)
  const nearest = player.nearestRoad;

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
