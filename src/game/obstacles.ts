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
      width: p.width ?? defaults.width,
      height: defaults.height,
      patrolAxis: p.patrolAxis,
      patrolDistance: p.patrolDistance ?? 0,
      patrolSpeed: p.patrolSpeed ?? 0,
      animFrame: 0,
      animTimer: 0,
      triggeredBy: new Set<number>(),
    };
  });
}

export function updateObstacles(
  obstacles: ObstacleState[],
  time: number,
  dt: number,
): void {
  for (const obs of obstacles) {
    // Update patrol positions
    if (obs.patrolDistance > 0 && obs.patrolSpeed > 0) {
      const offset =
        Math.sin(time * obs.patrolSpeed) * obs.patrolDistance;
      if (obs.patrolAxis === 'x') {
        obs.x = obs.baseX + offset;
      } else {
        obs.y = obs.baseY + offset;
      }
    }

    // Rotating spikes spin continuously
    if (obs.type === 'rotating_spikes') {
      obs.angle += Math.PI * 0.5 * dt; // rotate at pi/2 rad/s (quarter rotation per second)
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

export function checkObstacleCollisions(
  player: PlayerState,
  playerIndex: number,
  obstacles: ObstacleState[],
  particles: Particle[],
): 'death' | 'boost' | 'knockback' | null {
  if (!player.alive) return null;

  const px = player.position.x;
  const py = player.position.y;
  const pr = PLAYER_HITBOX_RADIUS;

  for (const obs of obstacles) {
    switch (obs.type) {
      case 'rotating_spikes': {
        // Circle vs circle
        if (
          circleCircle(
            px,
            py,
            pr,
            obs.x,
            obs.y,
            ROTATING_SPIKE_HITBOX_RADIUS,
          )
        ) {
          if (player.invincibleTimer > 0) continue;
          return 'death';
        }
        break;
      }

      case 'spikes': {
        // Circle vs AABB
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        if (
          circleAABB(
            px,
            py,
            pr,
            obs.x - halfW,
            obs.y - halfH,
            obs.width,
            obs.height,
          )
        ) {
          if (player.invincibleTimer > 0) continue;
          return 'death';
        }
        break;
      }

      case 'log': {
        // Circle vs OBB (rotated rectangle)
        if (
          circleOBB(
            px,
            py,
            pr,
            obs.x,
            obs.y,
            obs.width,
            obs.height,
            obs.angle,
          )
        ) {
          // Logs always apply knockback even when invincible
          player.stunTimer = LOG_STUN_DURATION;
          // Knock the player back
          const knockDir = directionFromAngle(player.angle + Math.PI);
          const knockback = scale(knockDir, BASE_KNOCKBACK);
          player.position = add(player.position, knockback);
          player.speed *= -0.3;
          return 'knockback';
        }
        break;
      }

      case 'arrow_pad': {
        // Circle vs AABB
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        if (
          circleAABB(
            px,
            py,
            pr,
            obs.x - halfW,
            obs.y - halfH,
            obs.width,
            obs.height,
          )
        ) {
          // Check retrigger: only boost if player has moved far enough since last trigger
          if (obs.triggeredBy.has(playerIndex)) {
            continue;
          }
          obs.triggeredBy.add(playerIndex);
          player.boostTimer = BOOST_DURATION;
          // Boost in the direction the arrow pad points
          // pad angle 0 = "up" (north, -Y) = player angle Math.PI/2
          player.angle = Math.PI / 2 - obs.angle;
          player.speed = player.maxSpeed * 1.5;
          return 'boost';
        } else {
          // If player is far enough from pad, allow retrigger
          const dist = distance(
            player.position,
            vec2(obs.x, obs.y),
          );
          if (
            dist > ARROW_PAD_RETRIGGER_DISTANCE &&
            obs.triggeredBy.has(playerIndex)
          ) {
            obs.triggeredBy.delete(playerIndex);
          }
        }
        break;
      }
    }
  }

  return null;
}
