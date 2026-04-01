export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerInput {
  accelerate: number; // 0 to 1
  brake: number; // 0 to 1
  steerX: number; // -1 to 1
  honk: boolean;
}

export interface RoadPoint {
  x: number;
  y: number;
  width: number;
}

export interface ObstaclePlacement {
  type: 'arrow_pad' | 'spikes' | 'log' | 'rotating_spikes' | 'ramp' | 'destructible' | 'mud_zone' | 'bouncy_wall';
  x: number;
  y: number;
  angle: number;
  width?: number;
  patrolAxis?: 'x' | 'y';
  patrolDistance?: number;
  patrolSpeed?: number;
}

export interface TrackData {
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  road: RoadPoint[];
  obstacles: ObstaclePlacement[];
  startLine: number;
  finishLine: number;
  startPositions: {
    p1: { x: number; y: number; angle: number };
    p2: { x: number; y: number; angle: number };
    p3?: { x: number; y: number; angle: number };
    p4?: { x: number; y: number; angle: number };
  };
}

// ── Skid marks ──────────────────────────────────────────────────────
export interface SkidMark {
  x: number;
  y: number;
  angle: number;
  width: number;    // tire width
  opacity: number;  // fades over time
  color: string;    // darker when braking
  life: number;
}

// ── Screen shake ────────────────────────────────────────────────────
export interface ScreenShake {
  intensity: number;
  duration: number;
  timer: number;
  offsetX: number;
  offsetY: number;
}

// ── Comic text popup ────────────────────────────────────────────────
export interface ComicText {
  text: string;
  x: number;
  y: number;
  timer: number;
  maxLife: number;
  color: string;
  scale: number;
}

// ── Random event ────────────────────────────────────────────────────
export interface RandomEvent {
  type: 'bird' | 'ufo';
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  maxLife: number;
  frame: number;
  targetObstacle?: number; // index for UFO abduction
}

// ── Post-race awards ────────────────────────────────────────────────
export interface RaceAward {
  key: string;       // translation key
  playerIndex: number;
  icon: string;
  value: number | string;
}

export interface PlayerState {
  characterId: string;
  position: Vec2;
  prevPosition: Vec2;
  velocity: Vec2;
  angle: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  handling: number;
  weight: number;
  brakeForce: number;
  boostTimer: number;
  alive: boolean;
  deathTimer: number;
  invincibleTimer: number;
  stunTimer: number;
  deaths: number;
  finishTime: number | null;
  trackProgress: number;
  input: PlayerInput;
  palette: 'primary' | 'rival';
  animState: 'idle' | 'driving' | 'death';
  animFrame: number;
  animTimer: number;
  directionIndex: number; // 0-7 for 8 directions
  boostParticleTimer: number;
  honkTimer: number;
  jumpTimer: number;
  jumpHeight: number;

  // ── Drift ─────────────────────────────────────────────────────────
  drifting: boolean;
  driftTimer: number;
  driftAngle: number;        // visual drift angle offset
  driftBoostCharge: number;  // builds up during drift, bonus speed on exit

  // ── Turbo start ───────────────────────────────────────────────────
  turboStartBonus: number;   // speed boost from timing GO

  // ── Visual juice ──────────────────────────────────────────────────
  squashX: number;           // 1.0 = normal, < 1 = squashed
  squashY: number;           // 1.0 = normal, > 1 = stretched
  wobblePhase: number;       // phase for idle wobble animation
  expression: 'neutral' | 'happy' | 'angry' | 'scared';
  expressionTimer: number;   // how long to show expression

  // ── Damage visual ─────────────────────────────────────────────────
  damageCount: number;       // cosmetic damage level (0-3)

  // ── Collision tracking ────────────────────────────────────────────
  collisionCount: number;    // for "biggest bully" award
  bumpsReceived: number;     // for various awards

  // ── Ramp jump ─────────────────────────────────────────────────────
  airborne: boolean;
  airborneTimer: number;
  airborneHeight: number;

  // ── Ragdoll death ─────────────────────────────────────────────────
  ragdollSpin: number;       // angular velocity on death
  ragdollVx: number;         // death tumble velocity
  ragdollVy: number;

  // ── Mud ───────────────────────────────────────────────────────────
  mudTimer: number;          // slow effect remaining

  // ── Road edge distance ────────────────────────────────────────────
  distFromRoadCenter: number;
  roadHalfWidth: number;

  // ── Position in race ──────────────────────────────────────────────
  racePosition: number;      // 1st, 2nd, 3rd, 4th

  // ── Exhaust trail timer ───────────────────────────────────────────
  exhaustTimer: number;

  // ── Skid mark timer ───────────────────────────────────────────────
  skidTimer: number;
}

export interface CameraState {
  position: Vec2;
  target: Vec2;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'default' | 'smoke' | 'spark' | 'flame' | 'mud' | 'debris';
  rotation?: number;
  rotationSpeed?: number;
}

export interface ObstacleState {
  type: 'arrow_pad' | 'spikes' | 'log' | 'rotating_spikes' | 'ramp' | 'destructible' | 'mud_zone' | 'bouncy_wall';
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  angle: number;
  boostAngle: number;
  width: number;
  height: number;
  patrolAxis?: 'x' | 'y';
  patrolDistance: number;
  patrolSpeed: number;
  animFrame: number;
  animTimer: number;
  triggeredBy: Set<number>;
  // Destructible state
  destroyed: boolean;
  destroyTimer: number;
  respawnTimer: number;
  // Bouncy wall
  bounceTimer: number;
}

export interface GameState {
  phase: 'countdown' | 'racing' | 'finished';
  countdownTimer: number;
  countdownStep: number; // 3, 2, 1, 0 (GO)
  raceTimer: number;
  players: PlayerState[];
  track: TrackData;
  camera: CameraState;
  obstacles: ObstacleState[];
  particles: Particle[];
  winner: number | null;
  playerCount: 1 | 2 | 3 | 4;
  time: number;

  // ── New visual systems ────────────────────────────────────────────
  skidMarks: SkidMark[];
  screenShake: ScreenShake;
  comicTexts: ComicText[];
  randomEvents: RandomEvent[];
  flashTimer: number;      // white flash on spike death
  countdownParticles: Particle[]; // countdown number explosion particles
}

export interface CharacterDef {
  id: string;
  name: string;
  maxSpeed: number;
  acceleration: number;
  handling: number;
  weight: number;
  brakeForce: number;
  description: string;
  primaryColor: string;
  rivalColor: string;
}

export type ScreenId =
  | 'title'
  | 'playerCount'
  | 'trackSelect'
  | 'characterSelect'
  | 'game'
  | 'results';

export interface GameConfig {
  playerCount: 1 | 2 | 3 | 4;
  trackId: string;
  p1Character: string;
  p2Character: string;
  p3Character: string;
  p4Character: string;
}

export interface GameResults {
  playerCount: 1 | 2 | 3 | 4;
  winner: number | null;
  players: Array<{
    characterId: string;
    finishTime: number | null;
    deaths: number;
    collisionCount: number;
  }>;
  awards: RaceAward[];
}

// Road geometry helpers
export interface RoadSegmentEdges {
  leftStart: Vec2;
  rightStart: Vec2;
  leftEnd: Vec2;
  rightEnd: Vec2;
}
