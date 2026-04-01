import type { PlayerInput, PlayerState, GameState, Vec2, AIState } from '../types';
import { findNearestRoadPoint } from './collision';

// Personality per character
interface AIPersonality {
  cornerSkill: number;      // 0-1, affects look-ahead and cornering
  seekBoosts: number;       // 0-1, how strongly to pursue arrow_pads
  driftSkill: number;       // 0-1, likelihood of executing drifts
  steeringNoise: number;    // wobble amplitude for human-like feel
  rubberBandFactor: number; // multiplier on rubber-band effect
}

const PERSONALITIES: Record<string, AIPersonality> = {
  formula: { cornerSkill: 0.9, seekBoosts: 0.6, driftSkill: 0.8, steeringNoise: 0.02, rubberBandFactor: 0.8 },
  yeti:    { cornerSkill: 0.4, seekBoosts: 0.3, driftSkill: 0.2, steeringNoise: 0.08, rubberBandFactor: 1.4 },
  cat:     { cornerSkill: 0.95, seekBoosts: 0.8, driftSkill: 0.6, steeringNoise: 0.03, rubberBandFactor: 1.0 },
  pig:     { cornerSkill: 0.3, seekBoosts: 0.4, driftSkill: 0.4, steeringNoise: 0.05, rubberBandFactor: 1.1 },
  frog:    { cornerSkill: 0.6, seekBoosts: 0.5, driftSkill: 0.5, steeringNoise: 0.04, rubberBandFactor: 1.0 },
  toilet:  { cornerSkill: 0.5, seekBoosts: 0.4, driftSkill: 0.3, steeringNoise: 0.07, rubberBandFactor: 1.2 },
};

// Tuning constants
const BASE_LOOK_AHEAD = 100;
const SPEED_LOOK_AHEAD_FACTOR = 0.5;
const STEER_GAIN = 2.5;
const OBSTACLE_DETECT_AHEAD = 150;
const OBSTACLE_DETECT_SIDE = 60;
const CURVATURE_SAMPLE_DIST = 200;
const CURVATURE_BRAKE_THRESHOLD = 0.4;
const DRIFT_CURVATURE_THRESHOLD = 0.7;
const RUBBER_BAND_RANGE = 800;
const STUCK_THRESHOLD = 5;
const STUCK_TIME = 1.0;
const STUCK_REVERSE_TIME = 0.5;

function getPersonality(characterId: string): AIPersonality {
  return PERSONALITIES[characterId] ?? PERSONALITIES.frog;
}

// Walk forward along road polyline from a given segment+t by `distance` pixels
// Returns the point reached
function walkRoadForward(road: { x: number; y: number }[], segIdx: number, t: number, dist: number): Vec2 {
  let remaining = dist;
  let idx = segIdx;
  const curT = t;

  // First, walk the remainder of the current segment
  if (idx < road.length - 1) {
    const dx = road[idx + 1].x - road[idx].x;
    const dy = road[idx + 1].y - road[idx].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    const remainInSeg = segLen * (1 - curT);
    if (remaining <= remainInSeg) {
      const newT = curT + remaining / segLen;
      return {
        x: road[idx].x + dx * newT,
        y: road[idx].y + dy * newT,
      };
    }
    remaining -= remainInSeg;
    idx++;
  }

  // Walk subsequent segments
  while (idx < road.length - 1 && remaining > 0) {
    const dx = road[idx + 1].x - road[idx].x;
    const dy = road[idx + 1].y - road[idx].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (remaining <= segLen) {
      const newT = remaining / segLen;
      return {
        x: road[idx].x + dx * newT,
        y: road[idx].y + dy * newT,
      };
    }
    remaining -= segLen;
    idx++;
  }

  // Reached end of road
  return { x: road[road.length - 1].x, y: road[road.length - 1].y };
}

// Compute curvature over a distance ahead (sum of angle changes between segments)
function computeCurvatureAhead(road: { x: number; y: number }[], segIdx: number, dist: number): number {
  let totalAngleChange = 0;
  let distWalked = 0;

  for (let i = segIdx; i < road.length - 2 && distWalked < dist; i++) {
    const dx1 = road[i + 1].x - road[i].x;
    const dy1 = road[i + 1].y - road[i].y;
    const dx2 = road[i + 2].x - road[i + 1].x;
    const dy2 = road[i + 2].y - road[i + 1].y;

    const angle1 = Math.atan2(dy1, dx1);
    const angle2 = Math.atan2(dy2, dx2);
    let delta = angle2 - angle1;
    // Normalize to [-PI, PI]
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    totalAngleChange += Math.abs(delta);
    distWalked += Math.sqrt(dx1 * dx1 + dy1 * dy1);
  }

  return totalAngleChange;
}

// Normalize angle to [-PI, PI]
function normalizeAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= 2 * Math.PI;
  while (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function createInitialAIState(): AIState {
  return {
    stuckTimer: 0,
    stuckReverseTimer: 0,
    driftIntentTimer: 0,
    noisePhase: Math.random() * Math.PI * 2,
  };
}

export function computeAIInput(
  player: PlayerState,
  playerIndex: number,
  gameState: GameState,
): PlayerInput {
  const { track, time } = gameState;
  const road = track.road;
  const personality = getPersonality(player.characterId);
  const aiState = gameState.aiStates[playerIndex];

  // If dead or finished, no input needed
  if (!player.alive || player.finishTime !== null) {
    return { accelerate: 0, brake: 0, steerX: 0, honk: false };
  }

  // During countdown, just idle (turbo start: press accelerate near GO)
  if (gameState.phase === 'countdown') {
    // Try turbo start: accelerate when countdown is very close to 0
    if (gameState.countdownTimer < 0.35) {
      return { accelerate: 1, brake: 0, steerX: 0, honk: false };
    }
    return { accelerate: 0, brake: 0, steerX: 0, honk: false };
  }

  // Update stuck detection
  if (aiState) {
    if (aiState.stuckReverseTimer > 0) {
      aiState.stuckReverseTimer -= 1 / 60;
      return { accelerate: 0, brake: 1, steerX: Math.sin(time * 5 + playerIndex) > 0 ? 1 : -1, honk: false };
    }

    if (Math.abs(player.speed) < STUCK_THRESHOLD && player.stunTimer <= 0) {
      aiState.stuckTimer += 1 / 60;
      if (aiState.stuckTimer > STUCK_TIME) {
        aiState.stuckTimer = 0;
        aiState.stuckReverseTimer = STUCK_REVERSE_TIME;
        return { accelerate: 0, brake: 1, steerX: 0, honk: false };
      }
    } else {
      aiState.stuckTimer = 0;
    }
  }

  // 1. Find current road position
  const nearest = findNearestRoadPoint(player.position, road);

  // 2. Compute look-ahead target
  const lookAheadDist = BASE_LOOK_AHEAD + Math.abs(player.speed) * SPEED_LOOK_AHEAD_FACTOR * (0.5 + personality.cornerSkill * 0.5);
  const target = walkRoadForward(road, nearest.segIdx, nearest.t, lookAheadDist);

  // 3. Compute desired angle (game convention: atan2(-dy, dx))
  const dx = target.x - player.position.x;
  const dy = target.y - player.position.y;
  const desiredAngle = Math.atan2(-dy, dx);

  // 4. Compute steering
  const angleDelta = normalizeAngle(desiredAngle - player.angle);
  // In player.ts: angle -= handling * steerX * (speed/maxSpeed) * dt
  // Positive steerX = angle decreases = turn clockwise = turn right
  // If angleDelta < 0 (need to turn clockwise/right), steerX should be positive
  let steerX = clamp(-angleDelta * STEER_GAIN, -1, 1);

  // Add personality noise for human-like feel
  if (aiState) {
    aiState.noisePhase += 1 / 60 * 3;
    steerX += Math.sin(aiState.noisePhase + playerIndex * 7.3) * personality.steeringNoise;
  }

  // 5. Obstacle avoidance
  const cosA = Math.cos(player.angle);
  const sinA = -Math.sin(player.angle); // negative because Y is inverted in game

  for (const obs of gameState.obstacles) {
    if (obs.destroyed) continue;

    const odx = obs.x - player.position.x;
    const ody = obs.y - player.position.y;
    const dist = Math.sqrt(odx * odx + ody * ody);

    if (dist > OBSTACLE_DETECT_AHEAD) continue;

    // Transform to player-local coordinates (forward, right)
    const forward = odx * cosA + ody * sinA;
    const right = -odx * sinA + ody * cosA;

    if (forward < 0 || forward > OBSTACLE_DETECT_AHEAD) continue; // behind or too far ahead
    if (Math.abs(right) > OBSTACLE_DETECT_SIDE) continue; // too far to the side

    const isDangerous = obs.type === 'spikes' || obs.type === 'rotating_spikes';
    const isAnnoying = obs.type === 'log' || obs.type === 'bouncy_wall' || obs.type === 'mud_zone';
    const isBeneficial = obs.type === 'arrow_pad' || obs.type === 'ramp';

    const urgency = 1 - (dist / OBSTACLE_DETECT_AHEAD);

    if (isDangerous || isAnnoying) {
      // Steer away from obstacle
      const avoidDir = right > 0 ? -1 : 1; // steer away
      const avoidStrength = isDangerous ? 0.8 : 0.4;
      steerX += avoidDir * avoidStrength * urgency;
    } else if (isBeneficial && Math.abs(right) < 30) {
      // Steer toward beneficial obstacles
      const seekDir = right > 0 ? 0.3 : -0.3;
      steerX += seekDir * personality.seekBoosts * urgency * 0.5;
    }
  }

  steerX = clamp(steerX, -1, 1);

  // 6. Speed management
  let accelerate = 1.0;
  let brake = 0.0;

  const curvature = computeCurvatureAhead(road, nearest.segIdx, CURVATURE_SAMPLE_DIST);
  const speedRatio = Math.abs(player.speed) / player.maxSpeed;

  if (curvature > CURVATURE_BRAKE_THRESHOLD && speedRatio > 0.5) {
    const brakeFactor = (curvature - CURVATURE_BRAKE_THRESHOLD) * (1 - personality.cornerSkill * 0.5);
    brake = clamp(brakeFactor * 0.5, 0, 0.7);
    accelerate = clamp(1 - brakeFactor * 0.3, 0.3, 1);
  }

  // 7. Drift decision
  if (curvature > DRIFT_CURVATURE_THRESHOLD && speedRatio > 0.6 && personality.driftSkill > 0.4) {
    brake = 0.4;
    // Maintain strong steer for drift trigger (player.ts requires |steerX| > 0.3)
    if (Math.abs(steerX) < 0.4) {
      steerX = steerX >= 0 ? 0.5 : -0.5;
    }
  }

  // 8. Rubber-banding
  // humanCount is number of human players (before bots in the array)
  const humanCount = gameState.playerCount;
  let bestHumanProgress = 0;
  for (let i = 0; i < humanCount && i < gameState.players.length; i++) {
    if (gameState.players[i].trackProgress > bestHumanProgress) {
      bestHumanProgress = gameState.players[i].trackProgress;
    }
  }

  const progressDelta = player.trackProgress - bestHumanProgress;

  if (progressDelta < 0) {
    // Behind: boost
    const boost = Math.min(0.3, Math.abs(progressDelta) / RUBBER_BAND_RANGE) * personality.rubberBandFactor;
    accelerate = Math.min(1, accelerate + boost * 0.5);
    brake = Math.max(0, brake - boost);
  } else if (progressDelta > 0) {
    // Ahead: slow down
    const penalty = Math.min(0.25, progressDelta / RUBBER_BAND_RANGE);
    accelerate = Math.max(0.4, accelerate - penalty);
    if (progressDelta > RUBBER_BAND_RANGE * 0.5) {
      brake += 0.15;
    }
  }

  accelerate = clamp(accelerate, 0, 1);
  brake = clamp(brake, 0, 1);

  return { accelerate, brake, steerX, honk: false };
}
