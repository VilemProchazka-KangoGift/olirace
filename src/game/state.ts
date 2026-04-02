import type { GameState, GameConfig, TrackData, AIState } from '../types';
import { createPlayer } from './player';
import { createObstacleStates } from './obstacles';
import { createCamera } from './camera';
import { createInitialAIState } from './ai';
import { COUNTDOWN_STEP_DURATION, GO_DISPLAY_DURATION } from '../utils/constants';

export function createGameState(
  config: GameConfig,
  track: TrackData,
): GameState {
  const countdownTotal =
    3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION; // 2.9s

  const botCount = config.botCount ?? 0;
  const totalPlayers = config.playerCount + botCount;
  const palettes: Array<'primary' | 'rival'> = ['primary', 'rival', 'primary', 'rival'];

  // Compute start positions: all side by side on the start line
  const p1Pos = track.startPositions.p1;
  const p2Pos = track.startPositions.p2;
  const midX = (p1Pos.x + p2Pos.x) / 2;
  const spacing = Math.abs(p2Pos.x - p1Pos.x) || 50;
  const startY = p1Pos.y;
  const startAngle = p1Pos.angle;

  // Spread racers evenly across the road at the start line
  const positions4 = [
    { x: midX - spacing * 1.5, y: startY, angle: startAngle },
    { x: midX - spacing * 0.5, y: startY, angle: startAngle },
    { x: midX + spacing * 0.5, y: startY, angle: startAngle },
    { x: midX + spacing * 1.5, y: startY, angle: startAngle },
  ];
  // Use track-defined positions if available, otherwise computed side-by-side
  const allPositions = [
    track.startPositions.p1,
    track.startPositions.p2,
    track.startPositions.p3 ?? positions4[2],
    track.startPositions.p4 ?? positions4[3],
  ];
  const charIds = [config.p1Character, config.p2Character, config.p3Character, config.p4Character];

  const players = [
    createPlayer(
      charIds[0],
      allPositions[0].x,
      allPositions[0].y,
      allPositions[0].angle,
      palettes[0],
    ),
  ];

  for (let i = 1; i < totalPlayers; i++) {
    players.push(
      createPlayer(
        charIds[i],
        allPositions[i].x,
        allPositions[i].y,
        allPositions[i].angle,
        palettes[i],
      ),
    );
  }

  // Initialize AI states — only bot slots get real state, human slots are null-like
  const aiStates: AIState[] = Array.from({ length: totalPlayers }, (_, i) =>
    i >= config.playerCount ? createInitialAIState() : { stuckTimer: 0, stuckReverseTimer: 0, noisePhase: 0, blockedTimer: 0, reverseSteerDir: 0, honkCooldown: 0, lastHitTime: -10 },
  );

  const obstacles = createObstacleStates(track.obstacles);

  let camX = 0;
  let camY = 0;
  for (let i = 0; i < totalPlayers; i++) {
    camX += allPositions[i].x;
    camY += allPositions[i].y;
  }
  camX /= totalPlayers;
  camY /= totalPlayers;

  return {
    phase: 'countdown',
    countdownTimer: countdownTotal,
    countdownStep: 3,
    raceTimer: 0,
    players,
    track,
    camera: createCamera(camX, camY),
    obstacles,
    particles: [],
    winner: null,
    playerCount: config.playerCount,
    time: 0,

    // New visual systems
    skidMarks: [],
    screenShake: { intensity: 0, duration: 0, timer: 0, offsetX: 0, offsetY: 0 },
    comicTexts: [],
    randomEvents: [],
    flashTimer: 0,
    countdownParticles: [],

    // AI
    botCount,
    aiStates,
  };
}
