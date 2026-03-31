import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initInput, destroyInput, readPlayerInput } from '../input';

// Simulate key events
function pressKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}
function releaseKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

// Mock navigator.getGamepads to return null (no gamepads)
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [null, null, null, null],
  writable: true,
});

describe('Input system: key mappings', () => {
  beforeEach(() => {
    initInput();
  });
  afterEach(() => {
    destroyInput();
  });

  // ── P1 uses Arrow keys + Enter ──────────────────────────────────────────

  it('P1 accelerate = ArrowUp', () => {
    pressKey('ArrowUp');
    const inp = readPlayerInput(0);
    expect(inp.accelerate).toBe(1);
    releaseKey('ArrowUp');
  });

  it('P1 brake = ArrowDown', () => {
    pressKey('ArrowDown');
    const inp = readPlayerInput(0);
    expect(inp.brake).toBe(1);
    releaseKey('ArrowDown');
  });

  it('P1 steer left = ArrowLeft', () => {
    pressKey('ArrowLeft');
    const inp = readPlayerInput(0);
    expect(inp.steerX).toBe(-1);
    releaseKey('ArrowLeft');
  });

  it('P1 steer right = ArrowRight', () => {
    pressKey('ArrowRight');
    const inp = readPlayerInput(0);
    expect(inp.steerX).toBe(1);
    releaseKey('ArrowRight');
  });

  it('P1 honk = Enter', () => {
    pressKey('Enter');
    const inp = readPlayerInput(0);
    expect(inp.honk).toBe(true);
    releaseKey('Enter');
  });

  it('P1 does NOT respond to WASD', () => {
    pressKey('KeyW');
    pressKey('KeyA');
    pressKey('KeyS');
    pressKey('KeyD');
    const inp = readPlayerInput(0);
    expect(inp.accelerate).toBe(0);
    expect(inp.brake).toBe(0);
    expect(inp.steerX).toBe(0);
    releaseKey('KeyW');
    releaseKey('KeyA');
    releaseKey('KeyS');
    releaseKey('KeyD');
  });

  // ── P2 uses WASD + Space ────────────────────────────────────────────────

  it('P2 accelerate = KeyW', () => {
    pressKey('KeyW');
    const inp = readPlayerInput(1);
    expect(inp.accelerate).toBe(1);
    releaseKey('KeyW');
  });

  it('P2 brake = KeyS', () => {
    pressKey('KeyS');
    const inp = readPlayerInput(1);
    expect(inp.brake).toBe(1);
    releaseKey('KeyS');
  });

  it('P2 steer left = KeyA', () => {
    pressKey('KeyA');
    const inp = readPlayerInput(1);
    expect(inp.steerX).toBe(-1);
    releaseKey('KeyA');
  });

  it('P2 steer right = KeyD', () => {
    pressKey('KeyD');
    const inp = readPlayerInput(1);
    expect(inp.steerX).toBe(1);
    releaseKey('KeyD');
  });

  it('P2 honk = Space', () => {
    pressKey('Space');
    const inp = readPlayerInput(1);
    expect(inp.honk).toBe(true);
    releaseKey('Space');
  });

  it('P2 does NOT respond to Arrow keys', () => {
    pressKey('ArrowUp');
    pressKey('ArrowDown');
    pressKey('ArrowLeft');
    pressKey('ArrowRight');
    const inp = readPlayerInput(1);
    expect(inp.accelerate).toBe(0);
    expect(inp.brake).toBe(0);
    expect(inp.steerX).toBe(0);
    releaseKey('ArrowUp');
    releaseKey('ArrowDown');
    releaseKey('ArrowLeft');
    releaseKey('ArrowRight');
  });

  // ── Key release ─────────────────────────────────────────────────────────

  it('releasing a key resets the flag', () => {
    pressKey('ArrowUp');
    expect(readPlayerInput(0).accelerate).toBe(1);
    releaseKey('ArrowUp');
    expect(readPlayerInput(0).accelerate).toBe(0);
  });

  it('multiple simultaneous keys work', () => {
    pressKey('ArrowUp');
    pressKey('ArrowRight');
    const inp = readPlayerInput(0);
    expect(inp.accelerate).toBe(1);
    expect(inp.steerX).toBe(1);
    releaseKey('ArrowUp');
    releaseKey('ArrowRight');
  });

  it('left + right cancel out to steerX = 0', () => {
    pressKey('ArrowLeft');
    pressKey('ArrowRight');
    const inp = readPlayerInput(0);
    expect(inp.steerX).toBe(0);
    releaseKey('ArrowLeft');
    releaseKey('ArrowRight');
  });

  // ── Player isolation ────────────────────────────────────────────────────

  it('P1 keys do not affect P2 and vice versa', () => {
    pressKey('ArrowUp');   // P1 accel
    pressKey('KeyW');      // P2 accel

    const p1 = readPlayerInput(0);
    const p2 = readPlayerInput(1);

    expect(p1.accelerate).toBe(1);
    expect(p1.steerX).toBe(0); // P1 has no WASD steer

    expect(p2.accelerate).toBe(1);
    expect(p2.steerX).toBe(0); // P2 has no Arrow steer

    releaseKey('ArrowUp');
    releaseKey('KeyW');
  });

  // ── destroyInput clears state ──────────────────────────────────────────

  it('destroyInput clears all key state', () => {
    pressKey('ArrowUp');
    pressKey('KeyW');
    expect(readPlayerInput(0).accelerate).toBe(1);

    destroyInput();

    // Re-init to re-add listeners
    initInput();

    // Old keys should be cleared
    expect(readPlayerInput(0).accelerate).toBe(0);
    expect(readPlayerInput(1).accelerate).toBe(0);
  });
});
