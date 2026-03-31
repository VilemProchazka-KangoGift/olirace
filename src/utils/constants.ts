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
