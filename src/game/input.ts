import type { PlayerInput, GameState } from '../types';
import { computeAIInput } from './ai';

let activeGameState: GameState | null = null;
let humanPlayerCount = 0;

export function setAIContext(gameState: GameState | null, humanCount: number): void {
  activeGameState = gameState;
  humanPlayerCount = humanCount;
}

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

function readKeyboard(playerIndex: number): PlayerInput {
  if (playerIndex === 0) {
    // P1: Arrow keys + Enter
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
  } else if (playerIndex === 1) {
    // P2: WASD + Space
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
  } else if (playerIndex === 2) {
    // P3: IJKL + H
    const up = keyState['KeyI'] ? 1 : 0;
    const down = keyState['KeyK'] ? 1 : 0;
    const left = keyState['KeyJ'] ? 1 : 0;
    const right = keyState['KeyL'] ? 1 : 0;
    return {
      accelerate: up,
      brake: down,
      steerX: right - left,
      honk: !!keyState['KeyH'],
    };
  } else {
    // P4: Numpad 8456 + Numpad0
    const up = keyState['Numpad8'] ? 1 : 0;
    const down = keyState['Numpad5'] ? 1 : 0;
    const left = keyState['Numpad4'] ? 1 : 0;
    const right = keyState['Numpad6'] ? 1 : 0;
    return {
      accelerate: up,
      brake: down,
      steerX: right - left,
      honk: !!keyState['Numpad0'],
    };
  }
}

const GAMEPAD_DEADZONE = 0.15;

function applyDeadzone(value: number): number {
  return Math.abs(value) < GAMEPAD_DEADZONE ? 0 : value;
}

export function readPlayerInput(playerIndex: number): PlayerInput {
  // AI bots: generate input from AI brain instead of keyboard/gamepad
  if (activeGameState && playerIndex >= humanPlayerCount) {
    const player = activeGameState.players[playerIndex];
    if (player) {
      return computeAIInput(player, playerIndex, activeGameState);
    }
  }

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
