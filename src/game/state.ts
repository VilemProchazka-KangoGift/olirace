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

  const players = [
    createPlayer(
      config.p1Character,
      track.startPositions.p1.x,
      track.startPositions.p1.y,
      track.startPositions.p1.angle,
      'primary',
    ),
  ];

  if (config.playerCount === 2) {
    players.push(
      createPlayer(
        config.p2Character,
        track.startPositions.p2.x,
        track.startPositions.p2.y,
        track.startPositions.p2.angle,
        'rival',
      ),
    );
  }

  const obstacles = createObstacleStates(track.obstacles);

  // Camera starts at midpoint of player positions
  const camX =
    config.playerCount === 2
      ? (track.startPositions.p1.x + track.startPositions.p2.x) / 2
      : track.startPositions.p1.x;
  const camY =
    config.playerCount === 2
      ? (track.startPositions.p1.y + track.startPositions.p2.y) / 2
      : track.startPositions.p1.y;

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
  };
}
