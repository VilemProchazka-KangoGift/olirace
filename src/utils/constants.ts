export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 854;
export const FIXED_TIMESTEP = 1 / 60;
export const FRICTION_DECAY = 0.97;
export const REVERSE_SPEED_MULTIPLIER = 0.4;
export const BOOST_SPEED_MULTIPLIER = 1.5;
export const BOOST_DURATION = 2.0;
export const BASE_KNOCKBACK = 60;
export const LOG_STUN_DURATION = 0.3;
export const DEATH_ANIMATION_DURATION = 0.42;
export const RESPAWN_DISTANCE = 200;
export const INVINCIBILITY_DURATION = 1.5;
export const INVINCIBILITY_BLINK_RATE = 0.1;
export const PLAYER_HITBOX_RADIUS = 16;
export const CAMERA_LERP = 0.08;
export const CAMERA_LOOK_AHEAD = 150;
export const CAMERA_LEADER_BIAS = 0.3;
export const TETHER_WARNING_DISTANCE = 400;
export const TETHER_TELEPORT_DISTANCE = 500;
export const TETHER_TELEPORT_BEHIND = 100;
export const PUSH_STRENGTH = 120;
export const COUNTDOWN_STEP_DURATION = 0.8;
export const GO_DISPLAY_DURATION = 0.5;
export const ARROW_PAD_RETRIGGER_DISTANCE = 200;
export const LAVA_GRACE_ZONE = 5;
export const ROTATING_SPIKE_HITBOX_RADIUS = 20;
export const ROAD_EDGE_LINE_WIDTH = 2;
export const ROAD_CENTER_LINE_WIDTH = 4;
export const ROAD_CENTER_DASH = 20;
export const ROAD_CENTER_GAP = 20;
export const ROAD_SHOULDER_INSET = 8;

// ── Drift ───────────────────────────────────────────────────────────
export const DRIFT_SPEED_THRESHOLD = 0.4;  // must be going > 40% maxSpeed to drift
export const DRIFT_FRICTION = 0.985;        // higher than normal friction during drift
export const DRIFT_HANDLING_BOOST = 1.6;    // steering multiplier while drifting
export const DRIFT_EXIT_SPEED_BONUS = 0.15; // % of maxSpeed bonus per second of drift
export const DRIFT_MAX_CHARGE = 1.5;        // max seconds of drift charge

// ── Turbo start ─────────────────────────────────────────────────────
export const TURBO_START_WINDOW = 0.3;      // seconds after GO to press accelerate
export const TURBO_START_BONUS = 0.5;       // fraction of maxSpeed as bonus

// ── Screen shake ────────────────────────────────────────────────────
export const SHAKE_DEATH_INTENSITY = 8;
export const SHAKE_DEATH_DURATION = 0.3;
export const SHAKE_COLLISION_INTENSITY = 4;
export const SHAKE_COLLISION_DURATION = 0.15;
export const SHAKE_LOG_INTENSITY = 6;
export const SHAKE_LOG_DURATION = 0.2;

// ── Skid marks ──────────────────────────────────────────────────────
export const SKID_MARK_LIFETIME = 8;         // seconds before full fade
export const SKID_MARK_INTERVAL = 0.02;      // seconds between skid mark points
export const MAX_SKID_MARKS = 500;

// ── Comic text ──────────────────────────────────────────────────────
export const COMIC_TEXT_DURATION = 0.8;
export const MAX_COMIC_TEXTS = 10;

// ── Speed lines ─────────────────────────────────────────────────────
export const SPEED_LINES_THRESHOLD = 0.7;   // show speed lines above 70% max speed

// ── Flash ───────────────────────────────────────────────────────────
export const FLASH_DURATION = 0.15;

// ── Ramp ────────────────────────────────────────────────────────────
export const RAMP_AIRBORNE_DURATION = 0.6;   // seconds airborne
export const RAMP_MAX_HEIGHT = 30;           // visual pixel height

// ── Mud zone ────────────────────────────────────────────────────────
export const MUD_SPEED_MULTIPLIER = 0.5;     // 50% speed in mud
export const MUD_EFFECT_DURATION = 0.5;      // lingers after leaving mud

// ── Bouncy wall ─────────────────────────────────────────────────────
export const BOUNCY_WALL_RESTITUTION = 1.5;  // exaggerated bounce

// ── Destructible ────────────────────────────────────────────────────
export const DESTRUCTIBLE_RESPAWN_TIME = 8;  // seconds to respawn

// ── Exaggerated bumping ─────────────────────────────────────────────
export const BUMP_RESTITUTION = 1.2;         // bouncy collisions!
export const BUMP_SPIN_FORCE = 0.3;          // more spin on hit
export const BUMP_WEIGHT_EXAGGERATION = 2.5; // amplify weight difference

// ── Random events ───────────────────────────────────────────────────
export const RANDOM_EVENT_INTERVAL = 15;     // average seconds between events
export const RANDOM_EVENT_CHANCE = 0.002;    // per-frame chance

// ── Exhaust ─────────────────────────────────────────────────────────
export const EXHAUST_INTERVAL = 0.06;        // seconds between exhaust puffs

// ── Squash/stretch ──────────────────────────────────────────────────
export const SQUASH_RECOVERY_SPEED = 5;      // how fast squash returns to normal

// Colors
export const COLORS = {
  black: '#1a1a2e',
  darkGray: '#2a2a3a',
  midGray: '#3a3a4a',
  lightGray: '#666680',
  white: '#e8e8f0',
  lavaDark: '#8a2000',
  lavaMid: '#c0400a',
  lavaBright: '#e06010',
  lavaGlow: '#ff8020',
  green: '#00c040',
  cyan: '#00e0e0',
  yellow: '#e0c000',
  red: '#e02020',
  orange: '#e07020',
  brown: '#6a4020',
  brownLight: '#8a6040',
  metal: '#808898',
  metalLight: '#a0a8b8',
} as const;

// ── Exhaust colors per character ────────────────────────────────────
export const EXHAUST_COLORS: Record<string, string[]> = {
  formula: ['#ff4040', '#ff8020', '#ffcc00'],  // flames
  yeti:    ['#a0a0b0', '#808090', '#c0c0d0'],  // gray smoke
  cat:     ['#e0a020', '#f0c040', '#c08010'],  // yarn-like puffs
  pig:     ['#8b6040', '#6a4020', '#a07050'],  // mud
  frog:    ['#40c040', '#60e060', '#80ff80'],  // green puffs
  toilet:  ['#80c0ff', '#a0d0ff', '#60b0ff'],  // bubbles
};

// ── Comic text options ──────────────────────────────────────────────
export const COMIC_TEXTS_DEATH = ['SPLAT!', 'WIPEOUT!', 'OUCH!', 'RIP!', 'BOOM!'];
export const COMIC_TEXTS_COLLISION = ['POW!', 'BONK!', 'CRASH!', 'BAM!', 'WHAM!'];
export const COMIC_TEXTS_BOOST = ['ZOOM!', 'WHOOSH!', 'TURBO!', 'FAST!'];
