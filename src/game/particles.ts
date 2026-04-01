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
      type: 'debris',
      rotation: randomAngle(),
      rotationSpeed: randomRange(-10, 10),
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
    '#e02020', '#00c040', '#2060e0', '#e0c000',
    '#e07020', '#e080a0', '#00e0e0', '#a020e0',
  ];
  for (let i = 0; i < 30; i++) {
    const angle = randomAngle();
    const speed = randomRange(60, 250);
    particles.push({
      x: x + randomRange(-20, 20),
      y: y + randomRange(-20, 20),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomRange(50, 150),
      life: randomRange(0.8, 1.5),
      maxLife: randomRange(0.8, 1.5),
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: randomRange(3, 7),
      rotation: randomAngle(),
      rotationSpeed: randomRange(-8, 8),
    });
  }
}

// ── Tire smoke ──────────────────────────────────────────────────────
export function emitTireSmoke(
  x: number,
  y: number,
  speedRatio: number,
  playerAngle: number,
  particles: Particle[],
): void {
  // Emit behind the vehicle
  const behindX = x - Math.cos(playerAngle) * 12;
  const behindY = y + Math.sin(playerAngle) * 12;
  const count = speedRatio > 0.8 ? 2 : 1;

  for (let i = 0; i < count; i++) {
    const spread = randomRange(-0.5, 0.5);
    particles.push({
      x: behindX + randomRange(-4, 4),
      y: behindY + randomRange(-4, 4),
      vx: spread * 20,
      vy: spread * 20,
      life: randomRange(0.3, 0.6),
      maxLife: 0.6,
      color: `rgba(180,180,200,${0.3 + speedRatio * 0.3})`,
      size: randomRange(3, 5 + speedRatio * 3),
      type: 'smoke',
    });
  }
}

// ── Spark shower (scraping road edges) ──────────────────────────────
export function emitSparks(
  x: number,
  y: number,
  particles: Particle[],
): void {
  const sparkColors = ['#ffff40', '#ff8020', '#ffffff', '#ffcc00'];
  for (let i = 0; i < 4; i++) {
    const angle = randomAngle();
    const speed = randomRange(80, 200);
    particles.push({
      x: x + randomRange(-3, 3),
      y: y + randomRange(-3, 3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.1, 0.3),
      maxLife: 0.3,
      color: sparkColors[i % sparkColors.length],
      size: randomRange(1, 3),
      type: 'spark',
    });
  }
}

// ── Lava splatter (near edges) ──────────────────────────────────────
export function emitLavaSplatter(
  x: number,
  y: number,
  particles: Particle[],
): void {
  const lavaColors = ['#ff8020', '#e06010', '#c0400a', '#ffcc00'];
  for (let i = 0; i < 3; i++) {
    const angle = randomRange(-Math.PI, 0); // spray upward
    const speed = randomRange(40, 100);
    particles.push({
      x: x + randomRange(-6, 6),
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: randomRange(0.3, 0.6),
      maxLife: 0.6,
      color: lavaColors[i % lavaColors.length],
      size: randomRange(2, 5),
      type: 'flame',
    });
  }
}

// ── Exhaust trail ───────────────────────────────────────────────────
export function emitExhaust(
  x: number,
  y: number,
  playerAngle: number,
  colors: string[],
  speedRatio: number,
  particles: Particle[],
): void {
  const behindX = x - Math.cos(playerAngle) * 16;
  const behindY = y + Math.sin(playerAngle) * 16;

  const color = colors[Math.floor(Math.random() * colors.length)];
  particles.push({
    x: behindX + randomRange(-2, 2),
    y: behindY + randomRange(-2, 2),
    vx: -Math.cos(playerAngle) * 20 + randomRange(-10, 10),
    vy: Math.sin(playerAngle) * 20 + randomRange(-10, 10),
    life: randomRange(0.2, 0.5),
    maxLife: 0.5,
    color,
    size: randomRange(2, 4 + speedRatio * 2),
    type: 'smoke',
  });
}

// ── Boost flame jet ─────────────────────────────────────────────────
export function emitBoostFlame(
  x: number,
  y: number,
  playerAngle: number,
  particles: Particle[],
): void {
  const flameColors = ['#00e0e0', '#40ffff', '#ffffff', '#80ffff'];
  const behindX = x - Math.cos(playerAngle) * 18;
  const behindY = y + Math.sin(playerAngle) * 18;

  for (let i = 0; i < 3; i++) {
    const color = flameColors[Math.floor(Math.random() * flameColors.length)];
    const spread = randomRange(-0.3, 0.3);
    const speed = randomRange(60, 140);
    particles.push({
      x: behindX + randomRange(-3, 3),
      y: behindY + randomRange(-3, 3),
      vx: -Math.cos(playerAngle + spread) * speed,
      vy: Math.sin(playerAngle + spread) * speed,
      life: randomRange(0.1, 0.25),
      maxLife: 0.25,
      color,
      size: randomRange(3, 6),
      type: 'flame',
    });
  }
}

// ── Mud splatter ────────────────────────────────────────────────────
export function emitMudSplatter(
  x: number,
  y: number,
  particles: Particle[],
): void {
  const mudColors = ['#6a4020', '#8a6040', '#5a3010', '#7a5030'];
  for (let i = 0; i < 5; i++) {
    const angle = randomAngle();
    const speed = randomRange(30, 100);
    particles.push({
      x: x + randomRange(-6, 6),
      y: y + randomRange(-6, 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.3, 0.6),
      maxLife: 0.6,
      color: mudColors[i % mudColors.length],
      size: randomRange(2, 5),
      type: 'mud',
    });
  }
}

// ── Destructible debris ─────────────────────────────────────────────
export function emitDestructibleDebris(
  x: number,
  y: number,
  particles: Particle[],
): void {
  const woodColors = ['#8a6040', '#6a4020', '#a07050', '#5a3010'];
  for (let i = 0; i < 10; i++) {
    const angle = randomAngle();
    const speed = randomRange(60, 180);
    particles.push({
      x: x + randomRange(-8, 8),
      y: y + randomRange(-8, 8),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomRange(30, 80),
      life: randomRange(0.5, 1.0),
      maxLife: 1.0,
      color: woodColors[i % woodColors.length],
      size: randomRange(3, 7),
      type: 'debris',
      rotation: randomAngle(),
      rotationSpeed: randomRange(-12, 12),
    });
  }
}

// ── Countdown explosion ─────────────────────────────────────────────
export function emitCountdownParticles(
  x: number,
  y: number,
  color: string,
  particles: Particle[],
): void {
  for (let i = 0; i < 15; i++) {
    const angle = randomAngle();
    const speed = randomRange(100, 300);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.3, 0.6),
      maxLife: 0.6,
      color,
      size: randomRange(3, 8),
      type: 'spark',
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

    // Type-specific behavior
    if (p.type === 'smoke') {
      // Smoke rises and expands
      p.vy -= 30 * dt;
      p.size *= 1.01;
      p.vx *= 0.95;
      p.vy *= 0.95;
    } else if (p.type === 'spark') {
      // Sparks fall fast and shrink
      p.vy += 200 * dt;
      p.vx *= 0.96;
    } else if (p.type === 'flame') {
      // Flames flicker and rise slightly
      p.vy -= 20 * dt;
      p.vx += (Math.random() - 0.5) * 100 * dt;
      p.size *= 0.98;
    } else if (p.type === 'mud') {
      // Mud falls with gravity
      p.vy += 200 * dt;
      p.vx *= 0.97;
    } else if (p.type === 'debris') {
      // Debris tumbles
      p.vy += 180 * dt;
      p.vx *= 0.98;
      if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
        p.rotation += p.rotationSpeed * dt;
      }
    } else {
      // Default particles (confetti, death, boost, respawn)
      p.vy += 120 * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }

    // Age
    p.life -= dt;
    // Shrink as life depletes
    if (p.type !== 'smoke') {
      p.size *= 0.995;
    }

    // Rotation
    if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
      p.rotation += p.rotationSpeed * dt;
    }

    // Remove dead particles
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}
