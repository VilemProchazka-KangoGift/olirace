import type { GameState, GameConfig, TrackData } from '../types';
import { createPlayer } from './player';
import { createObstacleStates } from './obstacles';
import { createCamera } from './camera';
import { COUNTDOWN_STEP_DURATION, GO_DISPLAY_DURATION } from '../utils/constants';

export function createGameState(
  config: GameConfig,
  track: TrackData,
): GameState {
  const countdownTotal =
    3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION; // 2.9s

  const palettes: Array<'primary' | 'rival'> = ['primary', 'rival', 'primary', 'rival'];

  // Compute start positions: 2x2 grid
  const p1Pos = track.startPositions.p1;
  const p2Pos = track.startPositions.p2;
  const backOffset = 40;
  const p3Pos = track.startPositions.p3 ?? { x: p1Pos.x, y: p1Pos.y + backOffset, angle: p1Pos.angle };
  const p4Pos = track.startPositions.p4 ?? { x: p2Pos.x, y: p2Pos.y + backOffset, angle: p2Pos.angle };
  const allPositions = [p1Pos, p2Pos, p3Pos, p4Pos];
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

  for (let i = 1; i < config.playerCount; i++) {
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

  const obstacles = createObstacleStates(track.obstacles);

  let camX = 0;
  let camY = 0;
  for (let i = 0; i < config.playerCount; i++) {
    camX += allPositions[i].x;
    camY += allPositions[i].y;
  }
  camX /= config.playerCount;
  camY /= config.playerCount;

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
  };
}
