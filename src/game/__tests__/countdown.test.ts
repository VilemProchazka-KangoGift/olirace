import { describe, it, expect } from 'vitest';
import { updateCountdown } from '../countdown';
import type { GameState } from '../../types';
import {
  COUNTDOWN_STEP_DURATION,
  GO_DISPLAY_DURATION,
} from '../../utils/constants';

function createCountdownState(): GameState {
  const totalTime = 3 * COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION;
  return {
    phase: 'countdown',
    countdownTimer: totalTime,
    countdownStep: 3,
    raceTimer: 0,
    players: [],
    track: {
      name: 'test',
      difficulty: 'easy',
      road: [
        { x: 0, y: 0, width: 100 },
        { x: 0, y: 100, width: 100 },
      ],
      obstacles: [],
      startLine: 0,
      finishLine: 1,
      startPositions: {
        p1: { x: 0, y: 0, angle: 0 },
        p2: { x: 20, y: 0, angle: 0 },
      },
    },
    camera: { position: { x: 0, y: 0 }, target: { x: 0, y: 0 } },
    obstacles: [],
    particles: [],
    winner: null,
    playerCount: 1,
    time: 0,
  };
}

describe('updateCountdown', () => {
  // Total countdown: 3 * 0.8 + 0.5 = 2.9s
  // Step 3: 2.9 -> 2.1
  // Step 2: 2.1 -> 1.3
  // Step 1: 1.3 -> 0.5
  // GO (0): 0.5 -> 0.0

  it('starts at step 3', () => {
    const state = createCountdownState();
    expect(state.countdownStep).toBe(3);
    expect(state.countdownTimer).toBeCloseTo(2.9);
  });

  it('decrements timer', () => {
    const state = createCountdownState();
    const dt = 1 / 60;
    const timerBefore = state.countdownTimer;

    updateCountdown(state, dt);

    expect(state.countdownTimer).toBeCloseTo(timerBefore - dt);
  });

  it('stays at step 3 during first 0.8s', () => {
    const state = createCountdownState();
    const dt = 0.1;

    // After 0.7s, timer = 2.9 - 0.7 = 2.2, which is > 2.1
    for (let i = 0; i < 7; i++) {
      updateCountdown(state, dt);
    }

    expect(state.countdownStep).toBe(3);
    expect(state.countdownTimer).toBeCloseTo(2.2);
  });

  it('transitions to step 2 after 0.8s', () => {
    const state = createCountdownState();
    const dt = 0.1;

    // After 0.8s, timer = 2.9 - 0.8 = 2.1
    // Boundary: remaining > 2*0.8 + 0.5 = 2.1 -> step 3
    // remaining = 2.1 is NOT > 2.1, so it falls to step 2 check
    for (let i = 0; i < 8; i++) {
      updateCountdown(state, dt);
    }

    expect(state.countdownStep).toBe(2);
  });

  it('transitions to step 1 after 1.6s', () => {
    const state = createCountdownState();
    const dt = 0.1;

    // After 1.6s, timer = 2.9 - 1.6 = 1.3
    // remaining = 1.3 is NOT > 1.3, so it falls to step 1 check
    for (let i = 0; i < 16; i++) {
      updateCountdown(state, dt);
    }

    expect(state.countdownStep).toBe(1);
  });

  it('transitions to GO (step 0) after 2.4s', () => {
    const state = createCountdownState();
    const dt = 0.1;

    // After 2.4s, timer = 2.9 - 2.4 = 0.5
    // remaining = 0.5 is NOT > 0.5, so it falls to GO check: > 0 -> step 0
    for (let i = 0; i < 24; i++) {
      updateCountdown(state, dt);
    }

    expect(state.countdownStep).toBe(0);
  });

  it('transitions to racing after full countdown (2.9s)', () => {
    const state = createCountdownState();
    const dt = 0.1;

    // After 2.9s, timer = 0
    for (let i = 0; i < 29; i++) {
      updateCountdown(state, dt);
    }

    expect(state.phase).toBe('racing');
    expect(state.countdownStep).toBe(-1);
  });

  it('does not update if phase is not countdown', () => {
    const state = createCountdownState();
    state.phase = 'racing';
    const timerBefore = state.countdownTimer;
    const stepBefore = state.countdownStep;

    updateCountdown(state, 1 / 60);

    expect(state.countdownTimer).toBe(timerBefore);
    expect(state.countdownStep).toBe(stepBefore);
  });

  it('does not update if phase is finished', () => {
    const state = createCountdownState();
    state.phase = 'finished';
    const timerBefore = state.countdownTimer;

    updateCountdown(state, 1 / 60);

    expect(state.countdownTimer).toBe(timerBefore);
  });

  it('goes through full sequence 3 -> 2 -> 1 -> GO -> racing', () => {
    const state = createCountdownState();
    const steps: number[] = [];
    const dt = 0.01;

    let lastStep = state.countdownStep;
    steps.push(lastStep);

    while (state.phase === 'countdown') {
      updateCountdown(state, dt);
      if (state.countdownStep !== lastStep) {
        lastStep = state.countdownStep;
        steps.push(lastStep);
      }
    }

    expect(steps).toEqual([3, 2, 1, 0, -1]);
    expect(state.phase).toBe('racing');
  });

  it('each step lasts approximately COUNTDOWN_STEP_DURATION', () => {
    const state = createCountdownState();
    const dt = 0.001; // Small dt for precision
    let frames = 0;

    // Count frames for step 3
    while (state.countdownStep === 3 && state.phase === 'countdown') {
      updateCountdown(state, dt);
      frames++;
    }

    const step3Duration = frames * dt;
    expect(step3Duration).toBeCloseTo(COUNTDOWN_STEP_DURATION, 1);
  });

  it('GO step lasts approximately GO_DISPLAY_DURATION', () => {
    const state = createCountdownState();
    const dt = 0.001;

    // Advance to GO step
    while (state.countdownStep !== 0 && state.phase === 'countdown') {
      updateCountdown(state, dt);
    }

    // Count frames for GO step
    let frames = 0;
    while (state.countdownStep === 0 && state.phase === 'countdown') {
      updateCountdown(state, dt);
      frames++;
    }

    const goDuration = frames * dt;
    expect(goDuration).toBeCloseTo(GO_DISPLAY_DURATION, 1);
  });
});
