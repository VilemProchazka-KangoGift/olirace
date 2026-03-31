import type { Particle } from '../types';
import { randomRange, randomAngle } from '../utils/math';

export function emitDeathParticles(
  x: number,
  y: number,
  color: string,
  particles: Particle[],
): void {
  for (let i = 0; i < 12; i++) {
    const angle = randomAngle();
    const speed = randomRange(80, 200);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.4, 0.8),
      maxLife: randomRange(0.4, 0.8),
      color,
      size: randomRange(3, 6),
    });
  }
}

export function emitBoostParticles(
  x: number,
  y: number,
  particles: Particle[],
): void {
  const colors = ['#00e0e0', '#ffffff', '#00e0e0'];
  for (let i = 0; i < 3; i++) {
    const angle = randomAngle();
    const speed = randomRange(30, 80);
    particles.push({
      x: x + randomRange(-4, 4),
      y: y + randomRange(-4, 4),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.2, 0.4),
      maxLife: randomRange(0.2, 0.4),
      color: colors[i],
      size: randomRange(2, 4),
    });
  }
}

export function emitRespawnParticles(
  x: number,
  y: number,
  particles: Particle[],
): void {
  const colors = ['#ffffff', '#00e0e0'];
  for (let i = 0; i < 8; i++) {
    const angle = randomAngle();
    const speed = randomRange(40, 120);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.3, 0.6),
      maxLife: randomRange(0.3, 0.6),
      color: colors[i % 2],
      size: randomRange(2, 5),
    });
  }
}

export function emitConfetti(
  x: number,
  y: number,
  particles: Particle[],
): void {
  const confettiColors = [
    '#e02020',
    '#00c040',
    '#2060e0',
    '#e0c000',
    '#e07020',
    '#e080a0',
    '#00e0e0',
    '#a020e0',
  ];
  for (let i = 0; i < 30; i++) {
    const angle = randomAngle();
    const speed = randomRange(60, 250);
    particles.push({
      x: x + randomRange(-20, 20),
      y: y + randomRange(-20, 20),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomRange(50, 150), // bias upward
      life: randomRange(0.8, 1.5),
      maxLife: randomRange(0.8, 1.5),
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: randomRange(3, 7),
    });
  }
}

export function updateParticles(
  particles: Particle[],
  dt: number,
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // Apply slight gravity to confetti-like particles
    p.vy += 120 * dt;
    // Friction
    p.vx *= 0.98;
    p.vy *= 0.98;
    // Age
    p.life -= dt;
    // Shrink as life depletes
    p.size *= 0.995;

    // Remove dead particles
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}
