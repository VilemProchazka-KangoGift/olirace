import { describe, it, expect } from 'vitest';
import { createGameState } from '../state';
import type { GameConfig, TrackData } from '../../types';
import {
  COUNTDOWN_STEP_DURATION,
  GO_DISPLAY_DURATION,
} from '../../utils/constants';

vi.mock('../input', () => ({
  readPlayerInput: vi.fn(),
}));

vi.mock('../collision', () => ({
  findNearestRoadPoint: vi.fn(() => ({
    segIdx: 0,
    t: 0,
    centerPoint: { x: 0, y: 0 },
    distance: 0,
    roadWidth: 100,
  })),
}));

function createTestTrack(): TrackData {
  return {
    name: 'test-track',
    difficulty: 'easy',
    road: [
      { x: 0, y: 0, width: 80 },
      { x: 0, y: 100, width: 80 },
      { x: 0, y: 200, width: 80 },
    ],
    obstacles: [
      { type: 'arrow_pad', x: 0, y: 50, angle: Math.PI / 2 },
      { type: 'spikes', x: 0, y: 150, angle: 0 },
      { type: 'log', x: 50, y: 100, angle: 0.5 },
    ],
    startLine: 0,
    finishLine: 2,
    startPositions: {
      p1: { x: -10, y: 10, angle: Math.PI / 2 },
      p2: { x: 10, y: 10, angle: Math.PI / 2 },
    },
  };
}

describe('createGameState - 1P mode', () => {
  it('creates exactly 1 player for 1P config', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.players).toHaveLength(1);
  });

  it('player is at p1 start position', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.players[0].position.x).toBe(-10);
    expect(state.players[0].position.y).toBe(10);
    expect(state.players[0].angle).toBe(Math.PI / 2);
  });

  it('player has correct character', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'cat',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.players[0].characterId).toBe('cat');
  });

  it('camera starts at p1 position in 1P mode', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.camera.position.x).toBe(track.startPositions.p1.x);
    expect(state.camera.position.y).toBe(track.startPositions.p1.y);
  });
});

describe('createGameState - 2P mode', () => {
  it('creates exactly 2 players for 2P config', () => {
    const config: GameConfig = {
      playerCount: 2,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.players).toHaveLength(2);
  });

  it('players are at correct start positions', () => {
    const config: GameConfig = {
      playerCount: 2,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.players[0].position.x).toBe(-10);
    expect(state.players[0].position.y).toBe(10);
    expect(state.players[1].position.x).toBe(10);
    expect(state.players[1].position.y).toBe(10);
  });

  it('players have correct characters', () => {
    const config: GameConfig = {
      playerCount: 2,
      trackId: 'test',
      p1Character: 'pig',
      p2Character: 'frog',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.players[0].characterId).toBe('pig');
    expect(state.players[1].characterId).toBe('frog');
  });

  it('players have correct palettes', () => {
    const config: GameConfig = {
      playerCount: 2,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.players[0].palette).toBe('primary');
    expect(state.players[1].palette).toBe('rival');
  });

  it('camera starts at midpoint of player positions in 2P', () => {
    const config: GameConfig = {
      playerCount: 2,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    const expectedX = (track.startPositions.p1.x + track.startPositions.p2.x) / 2;
    const expectedY = (track.startPositions.p1.y + track.startPositions.p2.y) / 2;
    expect(state.camera.position.x).toBe(expectedX);
    expect(state.camera.position.y).toBe(expectedY);
  });
});

describe('createGameState - countdown', () => {
  it('starts in countdown phase', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.phase).toBe('countdown');
  });

  it('initializes countdown timer to correct total', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    const expectedTotal = 3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION;
    expect(state.countdownTimer).toBeCloseTo(expectedTotal);
  });

  it('countdown step starts at 3', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.countdownStep).toBe(3);
  });
});

describe('createGameState - obstacles', () => {
  it('creates obstacle states from track placements', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.obstacles).toHaveLength(3);
  });

  it('obstacle types match track placements', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.obstacles[0].type).toBe('arrow_pad');
    expect(state.obstacles[1].type).toBe('spikes');
    expect(state.obstacles[2].type).toBe('log');
  });

  it('obstacle positions match track placements', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.obstacles[0].x).toBe(0);
    expect(state.obstacles[0].y).toBe(50);
    expect(state.obstacles[1].x).toBe(0);
    expect(state.obstacles[1].y).toBe(150);
    expect(state.obstacles[2].x).toBe(50);
    expect(state.obstacles[2].y).toBe(100);
  });
});

describe('createGameState - initial values', () => {
  it('race timer starts at 0', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.raceTimer).toBe(0);
  });

  it('no winner at start', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.winner).toBeNull();
  });

  it('particles array is empty', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.particles).toHaveLength(0);
  });

  it('time starts at 0', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.time).toBe(0);
  });

  it('stores track reference', () => {
    const config: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();
    const state = createGameState(config, track);

    expect(state.track).toBe(track);
  });

  it('playerCount matches config', () => {
    const config1p: GameConfig = {
      playerCount: 1,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const config2p: GameConfig = {
      playerCount: 2,
      trackId: 'test',
      p1Character: 'formula',
      p2Character: 'yeti',
      p3Character: 'muscle',
      p4Character: 'buggy',
    };
    const track = createTestTrack();

    expect(createGameState(config1p, track).playerCount).toBe(1);
    expect(createGameState(config2p, track).playerCount).toBe(2);
  });
});
