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
  type: 'arrow_pad' | 'spikes' | 'log' | 'rotating_spikes';
  x: number;
  y: number;
  angle: number;
  width?: number; // For spikes
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
}

export interface ObstacleState {
  type: 'arrow_pad' | 'spikes' | 'log' | 'rotating_spikes';
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  angle: number;
  boostAngle: number; // original angle from placement, never modified
  width: number;
  height: number;
  patrolAxis?: 'x' | 'y';
  patrolDistance: number;
  patrolSpeed: number;
  animFrame: number;
  animTimer: number;
  triggeredBy: Set<number>; // player indices that triggered this pad
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
  time: number; // total elapsed time for animations
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
  }>;
}

// Road geometry helpers
export interface RoadSegmentEdges {
  leftStart: Vec2;
  rightStart: Vec2;
  leftEnd: Vec2;
  rightEnd: Vec2;
}
