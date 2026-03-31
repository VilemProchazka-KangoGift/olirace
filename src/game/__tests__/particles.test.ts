import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  emitDeathParticles,
  emitBoostParticles,
  emitRespawnParticles,
  emitConfetti,
  updateParticles,
} from '../particles';
import type { Particle } from '../../types';

describe('emitDeathParticles', () => {
  it('creates exactly 12 particles', () => {
    const particles: Particle[] = [];
    emitDeathParticles(100, 200, '#ff0000', particles);
    expect(particles).toHaveLength(12);
  });

  it('particles start at specified position', () => {
    const particles: Particle[] = [];
    emitDeathParticles(50, 75, '#ff0000', particles);
    for (const p of particles) {
      expect(p.x).toBe(50);
      expect(p.y).toBe(75);
    }
  });

  it('particles have the specified color', () => {
    const particles: Particle[] = [];
    emitDeathParticles(0, 0, '#abcdef', particles);
    for (const p of particles) {
      expect(p.color).toBe('#abcdef');
    }
  });

  it('particles have positive life and size', () => {
    const particles: Particle[] = [];
    emitDeathParticles(0, 0, '#ff0000', particles);
    for (const p of particles) {
      expect(p.life).toBeGreaterThan(0);
      expect(p.maxLife).toBeGreaterThan(0);
      expect(p.size).toBeGreaterThan(0);
    }
  });

  it('particles have velocity (not all zero)', () => {
    const particles: Particle[] = [];
    emitDeathParticles(0, 0, '#ff0000', particles);
    const hasVelocity = particles.some(p => p.vx !== 0 || p.vy !== 0);
    expect(hasVelocity).toBe(true);
  });

  it('appends to existing particles array', () => {
    const particles: Particle[] = [{
      x: 0, y: 0, vx: 0, vy: 0,
      life: 1, maxLife: 1, color: '#000', size: 1,
    }];
    emitDeathParticles(0, 0, '#ff0000', particles);
    expect(particles).toHaveLength(13); // 1 existing + 12 new
  });
});

describe('emitBoostParticles', () => {
  it('creates exactly 3 particles', () => {
    const particles: Particle[] = [];
    emitBoostParticles(100, 200, particles);
    expect(particles).toHaveLength(3);
  });

  it('particles are cyan/white colored', () => {
    const particles: Particle[] = [];
    emitBoostParticles(0, 0, particles);
    const validColors = ['#00e0e0', '#ffffff'];
    for (const p of particles) {
      expect(validColors).toContain(p.color);
    }
  });

  it('particles are positioned near the given coordinates', () => {
    const particles: Particle[] = [];
    emitBoostParticles(100, 200, particles);
    for (const p of particles) {
      // Offset is randomRange(-4, 4) so within 4 pixels
      expect(p.x).toBeGreaterThanOrEqual(96);
      expect(p.x).toBeLessThanOrEqual(104);
      expect(p.y).toBeGreaterThanOrEqual(196);
      expect(p.y).toBeLessThanOrEqual(204);
    }
  });
});

describe('emitRespawnParticles', () => {
  it('creates exactly 8 particles', () => {
    const particles: Particle[] = [];
    emitRespawnParticles(50, 50, particles);
    expect(particles).toHaveLength(8);
  });

  it('particles alternate between white and cyan', () => {
    const particles: Particle[] = [];
    emitRespawnParticles(0, 0, particles);
    const validColors = ['#ffffff', '#00e0e0'];
    for (const p of particles) {
      expect(validColors).toContain(p.color);
    }
  });
});

describe('emitConfetti', () => {
  it('creates exactly 30 particles', () => {
    const particles: Particle[] = [];
    emitConfetti(100, 100, particles);
    expect(particles).toHaveLength(30);
  });

  it('uses variety of colors', () => {
    const particles: Particle[] = [];
    emitConfetti(0, 0, particles);
    const uniqueColors = new Set(particles.map(p => p.color));
    // Should have more than just 1 or 2 colors
    expect(uniqueColors.size).toBeGreaterThan(2);
  });

  it('particles have upward bias in velocity', () => {
    // Test with many particles - on average vy should be somewhat negative
    const particles: Particle[] = [];
    emitConfetti(0, 0, particles);
    // At least some particles should have negative vy due to upward bias
    const upwardParticles = particles.filter(p => p.vy < 0);
    expect(upwardParticles.length).toBeGreaterThan(0);
  });
});

describe('updateParticles', () => {
  it('decrements particle life', () => {
    const particles: Particle[] = [{
      x: 0, y: 0, vx: 10, vy: 10,
      life: 1.0, maxLife: 1.0, color: '#fff', size: 5,
    }];
    const dt = 1 / 60;

    updateParticles(particles, dt);

    expect(particles[0].life).toBeCloseTo(1.0 - dt);
  });

  it('moves particles by velocity * dt', () => {
    const particles: Particle[] = [{
      x: 100, y: 200, vx: 60, vy: -30,
      life: 1.0, maxLife: 1.0, color: '#fff', size: 5,
    }];
    const dt = 1 / 60;

    updateParticles(particles, dt);

    expect(particles[0].x).toBeCloseTo(100 + 60 * dt);
    // y includes gravity: vy += 120 * dt, then position update happened before gravity
    // Actually: x += vx*dt, y += vy*dt, THEN vy += 120*dt
    // So y = 200 + (-30)*dt = 199.5, then vy becomes -30 + 120*dt = -28
    expect(particles[0].y).toBeCloseTo(200 + (-30) * dt);
  });

  it('applies gravity to vy', () => {
    const particles: Particle[] = [{
      x: 0, y: 0, vx: 0, vy: 0,
      life: 1.0, maxLife: 1.0, color: '#fff', size: 5,
    }];
    const dt = 1 / 60;

    updateParticles(particles, dt);

    // vy should have increased due to gravity (120 * dt)
    expect(particles[0].vy).toBeGreaterThan(0);
  });

  it('applies friction to velocities', () => {
    const particles: Particle[] = [{
      x: 0, y: 0, vx: 100, vy: 100,
      life: 1.0, maxLife: 1.0, color: '#fff', size: 5,
    }];
    const dt = 1 / 60;

    updateParticles(particles, dt);

    // After friction (0.98), velocities should be reduced
    // vx after move: 100, then *= 0.98 = 98
    expect(particles[0].vx).toBeLessThan(100);
  });

  it('removes dead particles (life <= 0)', () => {
    const particles: Particle[] = [
      { x: 0, y: 0, vx: 0, vy: 0, life: 0.001, maxLife: 1, color: '#fff', size: 5 },
      { x: 0, y: 0, vx: 0, vy: 0, life: 1.0, maxLife: 1, color: '#fff', size: 5 },
      { x: 0, y: 0, vx: 0, vy: 0, life: 0.001, maxLife: 1, color: '#fff', size: 5 },
    ];
    const dt = 1 / 60; // ~0.0167, which is larger than 0.001

    updateParticles(particles, dt);

    // Only the particle with life=1.0 should survive
    expect(particles).toHaveLength(1);
    expect(particles[0].life).toBeCloseTo(1.0 - dt);
  });

  it('shrinks particle size over time', () => {
    const particles: Particle[] = [{
      x: 0, y: 0, vx: 0, vy: 0,
      life: 1.0, maxLife: 1.0, color: '#fff', size: 10,
    }];
    const dt = 1 / 60;

    updateParticles(particles, dt);

    expect(particles[0].size).toBeLessThan(10);
  });

  it('handles empty particle array', () => {
    const particles: Particle[] = [];
    updateParticles(particles, 1 / 60);
    expect(particles).toHaveLength(0);
  });

  it('removes all particles when all are dead', () => {
    const particles: Particle[] = [
      { x: 0, y: 0, vx: 0, vy: 0, life: 0.001, maxLife: 1, color: '#fff', size: 5 },
      { x: 0, y: 0, vx: 0, vy: 0, life: 0.005, maxLife: 1, color: '#fff', size: 5 },
    ];

    updateParticles(particles, 1 / 60);

    expect(particles).toHaveLength(0);
  });
});
