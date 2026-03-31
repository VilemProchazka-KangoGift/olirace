import type { GameState } from '../types';
import { COUNTDOWN_STEP_DURATION, GO_DISPLAY_DURATION } from '../utils/constants';
import { audioManager } from './audio';

let lastPlayedStep = -1;

export function updateCountdown(state: GameState, dt: number): void {
  if (state.phase !== 'countdown') return;

  const prevStep = state.countdownStep;
  state.countdownTimer -= dt;

  // Determine which step we're on based on remaining time
  // Total time: 3 * 0.8 + 0.5 = 2.9s
  // Step 3: 2.9 -> 2.1  (0.8s)
  // Step 2: 2.1 -> 1.3  (0.8s)
  // Step 1: 1.3 -> 0.5  (0.8s)
  // GO (0): 0.5 -> 0.0  (0.5s)
  const remaining = state.countdownTimer;

  if (remaining > COUNTDOWN_STEP_DURATION * 2 + GO_DISPLAY_DURATION) {
    state.countdownStep = 3;
  } else if (remaining > COUNTDOWN_STEP_DURATION + GO_DISPLAY_DURATION) {
    state.countdownStep = 2;
  } else if (remaining > GO_DISPLAY_DURATION) {
    state.countdownStep = 1;
  } else if (remaining > 0) {
    state.countdownStep = 0; // GO
  } else {
    // Countdown finished -> start racing
    state.phase = 'racing';
    state.countdownStep = -1;
    lastPlayedStep = -1;
  }

  // Play audio on step change
  if (state.countdownStep !== prevStep && state.countdownStep !== lastPlayedStep) {
    lastPlayedStep = state.countdownStep;
    if (state.countdownStep === 0) {
      audioManager.play('sfx_go');
    } else if (state.countdownStep > 0) {
      audioManager.play('sfx_countdown_beep');
    }
  }
}

export function resetCountdown(): void {
  lastPlayedStep = -1;
}
