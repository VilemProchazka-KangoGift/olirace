import type { PlayerInput } from '../types';

const keyState: Record<string, boolean> = {};

function onKeyDown(e: KeyboardEvent): void {
  keyState[e.code] = true;
}

function onKeyUp(e: KeyboardEvent): void {
  keyState[e.code] = false;
}

export function initInput(): void {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

export function destroyInput(): void {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  // Clear state so stale keys don't persist across sessions
  for (const key of Object.keys(keyState)) {
    delete keyState[key];
  }
}

function readKeyboard(playerIndex: 0 | 1): PlayerInput {
  if (playerIndex === 0) {
    // P1: WASD + Space
    const up = keyState['KeyW'] ? 1 : 0;
    const down = keyState['KeyS'] ? 1 : 0;
    const left = keyState['KeyA'] ? 1 : 0;
    const right = keyState['KeyD'] ? 1 : 0;
    return {
      accelerate: up,
      brake: down,
      steerX: right - left,
      honk: !!keyState['Space'],
    };
  } else {
    // P2: Arrows + Enter
    const up = keyState['ArrowUp'] ? 1 : 0;
    const down = keyState['ArrowDown'] ? 1 : 0;
    const left = keyState['ArrowLeft'] ? 1 : 0;
    const right = keyState['ArrowRight'] ? 1 : 0;
    return {
      accelerate: up,
      brake: down,
      steerX: right - left,
      honk: !!keyState['Enter'],
    };
  }
}

const GAMEPAD_DEADZONE = 0.15;

function applyDeadzone(value: number): number {
  return Math.abs(value) < GAMEPAD_DEADZONE ? 0 : value;
}

export function readPlayerInput(playerIndex: 0 | 1): PlayerInput {
  const input = readKeyboard(playerIndex);

  // Override with gamepad if connected
  const gamepads = navigator.getGamepads();
  const gp = gamepads[playerIndex];
  if (gp) {
    const steerX = applyDeadzone(gp.axes[0]);
    const accel = gp.buttons[7]?.value ?? (gp.buttons[0]?.pressed ? 1 : 0);
    const brake = gp.buttons[6]?.value ?? (gp.buttons[1]?.pressed ? 1 : 0);
    const honk = gp.buttons[2]?.pressed ?? false;

    if (steerX !== 0) input.steerX = steerX;
    if (accel > 0) input.accelerate = accel;
    if (brake > 0) input.brake = brake;
    if (honk) input.honk = true;
  }

  return input;
}
