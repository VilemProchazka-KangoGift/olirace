import type { Vec2 } from '../types';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function lengthSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function distance(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

export function distanceSq(a: Vec2, b: Vec2): number {
  return lengthSq(sub(a, b));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function angleFromDirection(dir: Vec2): number {
  return Math.atan2(-dir.y, dir.x);
}

export function directionFromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: -Math.sin(angle) };
}

export function rotateVec2(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

export function perpendicular(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}

// Get direction index (0-7) from angle for sprite selection
// 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
export function angleToDirectionIndex(angle: number): number {
  // Convert from math angle (0=right, ccw) to compass (0=up/north, cw)
  // Math: 0=right, pi/2=up. Compass: 0=up, pi/2=right
  const compass = ((Math.PI / 2 - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const idx = Math.round(compass / (Math.PI / 4)) % 8;
  return idx;
}

// Project point onto a line segment, return parameter t (0-1) and closest point
export function projectPointOnSegment(
  point: Vec2,
  segStart: Vec2,
  segEnd: Vec2
): { t: number; closest: Vec2; distance: number } {
  const seg = sub(segEnd, segStart);
  const segLenSq = lengthSq(seg);
  if (segLenSq === 0) {
    return { t: 0, closest: segStart, distance: distance(point, segStart) };
  }
  const t = clamp(dot(sub(point, segStart), seg) / segLenSq, 0, 1);
  const closest = add(segStart, scale(seg, t));
  return { t, closest, distance: distance(point, closest) };
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomAngle(): number {
  return Math.random() * Math.PI * 2;
}
