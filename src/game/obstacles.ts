import type {
  ObstaclePlacement,
  ObstacleState,
  PlayerState,
  Particle,
} from '../types';
import {
  PLAYER_HITBOX_RADIUS,
  ROTATING_SPIKE_HITBOX_RADIUS,
  BOOST_DURATION,
  BASE_KNOCKBACK,
  LOG_STUN_DURATION,
  ARROW_PAD_RETRIGGER_DISTANCE,
  RAMP_AIRBORNE_DURATION,
  MUD_EFFECT_DURATION,
  BOUNCY_WALL_RESTITUTION,
  DESTRUCTIBLE_RESPAWN_TIME,
  DESTRUCTIBLE_BOOST_FRACTION,
  DESTRUCTIBLE_BOOST_DURATION,
  DESTRUCTIBLE_HEAVY_SLOWDOWN,
  DESTRUCTIBLE_LIGHT_SLOWDOWN,
  SLINGSHOT_SPEED_THRESHOLD,
  SLINGSHOT_SPEED_MULTIPLIER,
  SLINGSHOT_DURATION,
  PATROL_PAUSE_THRESHOLD,
  PATROL_PAUSE_DURATION,
} from '../utils/constants';
import { distance, vec2, directionFromAngle, add, scale } from '../utils/math';
import { circleCircle, circleAABB, circleOBB } from './collision';

// Default dimensions for obstacle types
const OBSTACLE_DEFAULTS: Record<
  string,
  { width: number; height: number }
> = {
  arrow_pad: { width: 40, height: 40 },
  spikes: { width: 32, height: 16 },
  log: { width: 60, height: 20 },
  rotating_spikes: { width: 40, height: 40 },
  ramp: { width: 120, height: 30 },
  destructible: { width: 24, height: 24 },
  mud_zone: { width: 60, height: 60 },
  bouncy_wall: { width: 60, height: 12 },
};

export function createObstacleStates(
  placements: ObstaclePlacement[],
): ObstacleState[] {
  return placements.map((p) => {
    const defaults = OBSTACLE_DEFAULTS[p.type] ?? {
      width: 32,
      height: 32,
    };
    return {
      type: p.type,
      baseX: p.x,
      baseY: p.y,
      x: p.x,
      y: p.y,
      angle: p.angle,
      boostAngle: p.angle,
      width: p.width ?? defaults.width,
      height: defaults.height,
      patrolAxis: p.patrolAxis,
      patrolDistance: p.patrolDistance ?? 0,
      patrolSpeed: p.patrolSpeed ?? 0,
      animFrame: 0,
      animTimer: 0,
      triggeredBy: new Set<number>(),
      destroyed: false,
      destroyTimer: 0,
      respawnTimer: 0,
      bounceTimer: 0,
      patrolPauseTimer: 0,
      patrolFrozenOffset: 0,
    };
  });
}

export function updateObstacles(
  obstacles: ObstacleState[],
  time: number,
  dt: number,
): void {
  for (const obs of obstacles) {
    // Update patrol positions with windshield-wiper pause at extremes
    if (obs.patrolDistance > 0 && obs.patrolSpeed > 0) {
      const sinVal = Math.sin(time * obs.patrolSpeed);

      if (Math.abs(sinVal) > PATROL_PAUSE_THRESHOLD) {
        // Near extreme — pause briefly
        if (obs.patrolPauseTimer <= 0) {
          // Just entered pause zone — freeze at current offset
          obs.patrolFrozenOffset = sinVal > 0
            ? obs.patrolDistance
            : -obs.patrolDistance;
          obs.patrolPauseTimer = PATROL_PAUSE_DURATION;
        }
        obs.patrolPauseTimer -= dt;
        // Use frozen position during pause
        if (obs.patrolAxis === 'x') {
          obs.x = obs.baseX + obs.patrolFrozenOffset;
        } else {
          obs.y = obs.baseY + obs.patrolFrozenOffset;
        }
      } else {
        // Normal movement
        obs.patrolPauseTimer = 0;
        const offset = sinVal * obs.patrolDistance;
        if (obs.patrolAxis === 'x') {
          obs.x = obs.baseX + offset;
        } else {
          obs.y = obs.baseY + offset;
        }
      }
    }

    // Rotating spikes spin continuously
    if (obs.type === 'rotating_spikes') {
      obs.angle += Math.PI * 0.12 * dt; // very slow for readability
    }

    // Destructible respawn
    if (obs.destroyed) {
      obs.respawnTimer -= dt;
      if (obs.respawnTimer <= 0) {
        obs.destroyed = false;
      }
    }

    // Bouncy wall animation recovery
    if (obs.bounceTimer > 0) {
      obs.bounceTimer -= dt;
    }

    // Animation timer
    obs.animTimer += dt;
    const animSpeed = 0.2;
    if (obs.animTimer >= animSpeed) {
      obs.animTimer -= animSpeed;
      obs.animFrame = (obs.animFrame + 1) % 4;
    }
  }
}

export type CollisionResult = 'death' | 'boost' | 'knockback' | 'ramp' | 'mud' | 'bounce' | 'destroy' | null;

export function checkObstacleCollisions(
  player: PlayerState,
  playerIndex: number,
  obstacles: ObstacleState[],
  particles: Particle[],
): CollisionResult {
  if (!player.alive) return null;
  if (player.airborne) return null; // Can't hit obstacles while airborne

  const px = player.position.x;
  const py = player.position.y;
  const pr = PLAYER_HITBOX_RADIUS;

  for (const obs of obstacles) {
    // Skip destroyed obstacles
    if (obs.destroyed) continue;

    switch (obs.type) {
      case 'rotating_spikes': {
        if (
          circleCircle(px, py, pr, obs.x, obs.y, ROTATING_SPIKE_HITBOX_RADIUS)
        ) {
          if (player.invincibleTimer > 0) continue;
          return 'death';
        }
        break;
      }

      case 'spikes': {
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        if (
          circleAABB(px, py, pr, obs.x - halfW, obs.y - halfH, obs.width, obs.height)
        ) {
          if (player.invincibleTimer > 0) continue;
          return 'death';
        }
        break;
      }

      case 'log': {
        if (
          circleOBB(px, py, pr, obs.x, obs.y, obs.width, obs.height, obs.angle)
        ) {
          // Same log can't re-stun you until you move away (prevents infinite knockback loop)
          if (obs.triggeredBy.has(playerIndex)) continue;
          obs.triggeredBy.add(playerIndex);
          player.stunTimer = LOG_STUN_DURATION;
          // Knock opposite to movement direction (not facing direction)
          // so reversing into a log pushes you backward, not forward
          const knockAngle = player.speed >= 0 ? player.angle + Math.PI : player.angle;
          const knockDir = directionFromAngle(knockAngle);
          const knockback = scale(knockDir, BASE_KNOCKBACK);
          player.position = add(player.position, knockback);
          player.speed *= -0.1;
          // Squash on log hit
          player.squashX = 1.4;
          player.squashY = 0.6;
          player.expression = 'angry';
          player.expressionTimer = 0.5;
          return 'knockback';
        } else {
          // Reset when player moves far enough away
          const dist = distance(player.position, vec2(obs.x, obs.y));
          if (dist > 80 && obs.triggeredBy.has(playerIndex)) {
            obs.triggeredBy.delete(playerIndex);
          }
        }
        break;
      }

      case 'arrow_pad': {
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        if (
          circleAABB(px, py, pr, obs.x - halfW, obs.y - halfH, obs.width, obs.height)
        ) {
          if (obs.triggeredBy.has(playerIndex)) continue;
          obs.triggeredBy.add(playerIndex);
          player.boostTimer = BOOST_DURATION;
          player.angle = Math.PI / 2 - obs.boostAngle;
          player.speed = player.maxSpeed * 1.5;
          // Stretch on boost
          player.squashX = 0.7;
          player.squashY = 1.4;
          player.expression = 'happy';
          player.expressionTimer = 1.0;
          return 'boost';
        } else {
          const dist = distance(player.position, vec2(obs.x, obs.y));
          if (dist > ARROW_PAD_RETRIGGER_DISTANCE && obs.triggeredBy.has(playerIndex)) {
            obs.triggeredBy.delete(playerIndex);
          }
        }
        break;
      }

      case 'ramp': {
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        if (
          circleAABB(px, py, pr, obs.x - halfW, obs.y - halfH, obs.width, obs.height)
        ) {
          if (obs.triggeredBy.has(playerIndex)) continue;
          obs.triggeredBy.add(playerIndex);
          // Launch player airborne
          player.airborne = true;
          player.airborneTimer = RAMP_AIRBORNE_DURATION;
          player.airborneHeight = 0;
          // Keep current speed
          return 'ramp';
        } else {
          const dist = distance(player.position, vec2(obs.x, obs.y));
          if (dist > 100 && obs.triggeredBy.has(playerIndex)) {
            obs.triggeredBy.delete(playerIndex);
          }
        }
        break;
      }

      case 'destructible': {
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        if (
          circleAABB(px, py, pr, obs.x - halfW, obs.y - halfH, obs.width, obs.height)
        ) {
          // Destroy it!
          obs.destroyed = true;
          obs.respawnTimer = DESTRUCTIBLE_RESPAWN_TIME;
          // Weight-based slowdown: heavy chars smash through easier
          const slowdown = player.weight > 0.5
            ? DESTRUCTIBLE_HEAVY_SLOWDOWN
            : DESTRUCTIBLE_LIGHT_SLOWDOWN;
          player.speed *= slowdown;
          // Micro-boost reward for smashing!
          player.boostTimer = DESTRUCTIBLE_BOOST_DURATION;
          player.speed += player.maxSpeed * DESTRUCTIBLE_BOOST_FRACTION;
          // Squash + happy expression (smashing feels good!)
          player.squashX = 0.85;
          player.squashY = 1.2;
          player.expression = 'happy';
          player.expressionTimer = 0.4;
          return 'destroy';
        }
        break;
      }

      case 'mud_zone': {
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        if (
          circleAABB(px, py, pr, obs.x - halfW, obs.y - halfH, obs.width, obs.height)
        ) {
          player.mudTimer = MUD_EFFECT_DURATION;
          return 'mud';
        }
        break;
      }

      case 'bouncy_wall': {
        if (
          circleOBB(px, py, pr, obs.x, obs.y, obs.width, obs.height, obs.angle)
        ) {
          // Check speed BEFORE bounce for slingshot
          const speedRatio = Math.abs(player.speed) / player.maxSpeed;
          const isSlingshot = speedRatio > SLINGSHOT_SPEED_THRESHOLD;

          // Bounce the player away like a pinball
          const dx = px - obs.x;
          const dy = py - obs.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;

          // Reflect velocity
          const dotProduct = player.velocity.x * nx + player.velocity.y * ny;
          player.velocity.x -= 2 * dotProduct * nx;
          player.velocity.y -= 2 * dotProduct * ny;

          // Exaggerated bounce
          player.velocity.x *= BOUNCY_WALL_RESTITUTION;
          player.velocity.y *= BOUNCY_WALL_RESTITUTION;

          // Update speed from new velocity
          const dirX = Math.cos(player.angle);
          const dirY = -Math.sin(player.angle);
          player.speed = player.velocity.x * dirX + player.velocity.y * dirY;

          // Slingshot: high-speed bounce gives speed boost
          if (isSlingshot) {
            player.speed *= SLINGSHOT_SPEED_MULTIPLIER;
            player.boostTimer = SLINGSHOT_DURATION;
            player.expression = 'happy';
            player.expressionTimer = 0.5;
          } else {
            player.expression = 'angry';
            player.expressionTimer = 0.3;
          }

          // Push out
          player.position.x += nx * 5;
          player.position.y += ny * 5;

          // Visual feedback
          obs.bounceTimer = 0.3;
          player.squashX = 1.3;
          player.squashY = 0.7;

          return 'bounce';
        }
        break;
      }
    }
  }

  return null;
}
