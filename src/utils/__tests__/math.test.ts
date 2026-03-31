import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  vec2,
  add,
  sub,
  scale,
  dot,
  length,
  lengthSq,
  normalize,
  distance,
  distanceSq,
  lerp,
  lerpVec2,
  clamp,
  angleFromDirection,
  directionFromAngle,
  rotateVec2,
  perpendicular,
  angleToDirectionIndex,
  projectPointOnSegment,
  randomRange,
  randomAngle,
} from '../math';

describe('vec2', () => {
  it('creates a vector with x and y', () => {
    const v = vec2(3, 4);
    expect(v).toEqual({ x: 3, y: 4 });
  });

  it('handles negative values', () => {
    const v = vec2(-1, -5);
    expect(v).toEqual({ x: -1, y: -5 });
  });

  it('handles zero', () => {
    const v = vec2(0, 0);
    expect(v).toEqual({ x: 0, y: 0 });
  });
});

describe('add', () => {
  it('adds two vectors', () => {
    expect(add(vec2(1, 2), vec2(3, 4))).toEqual({ x: 4, y: 6 });
  });

  it('handles negative values', () => {
    expect(add(vec2(-1, 2), vec2(3, -4))).toEqual({ x: 2, y: -2 });
  });

  it('adding zero vector is identity', () => {
    expect(add(vec2(5, 7), vec2(0, 0))).toEqual({ x: 5, y: 7 });
  });
});

describe('sub', () => {
  it('subtracts two vectors', () => {
    expect(sub(vec2(5, 7), vec2(3, 2))).toEqual({ x: 2, y: 5 });
  });

  it('subtracting itself yields zero', () => {
    expect(sub(vec2(3, 4), vec2(3, 4))).toEqual({ x: 0, y: 0 });
  });

  it('handles negative results', () => {
    expect(sub(vec2(1, 1), vec2(5, 5))).toEqual({ x: -4, y: -4 });
  });
});

describe('scale', () => {
  it('scales a vector by a scalar', () => {
    expect(scale(vec2(2, 3), 4)).toEqual({ x: 8, y: 12 });
  });

  it('scales by zero produces zero vector', () => {
    expect(scale(vec2(5, 10), 0)).toEqual({ x: 0, y: 0 });
  });

  it('scales by negative inverts direction', () => {
    expect(scale(vec2(1, -2), -3)).toEqual({ x: -3, y: 6 });
  });

  it('scales by 1 is identity', () => {
    expect(scale(vec2(7, 9), 1)).toEqual({ x: 7, y: 9 });
  });
});

describe('dot', () => {
  it('computes dot product', () => {
    expect(dot(vec2(1, 2), vec2(3, 4))).toBe(11);
  });

  it('perpendicular vectors have zero dot product', () => {
    expect(dot(vec2(1, 0), vec2(0, 1))).toBe(0);
  });

  it('parallel same-direction vectors have positive dot product', () => {
    expect(dot(vec2(2, 0), vec2(5, 0))).toBe(10);
  });

  it('anti-parallel vectors have negative dot product', () => {
    expect(dot(vec2(1, 0), vec2(-1, 0))).toBe(-1);
  });
});

describe('length', () => {
  it('computes length of 3-4-5 triangle', () => {
    expect(length(vec2(3, 4))).toBe(5);
  });

  it('zero vector has zero length', () => {
    expect(length(vec2(0, 0))).toBe(0);
  });

  it('unit vector along x has length 1', () => {
    expect(length(vec2(1, 0))).toBe(1);
  });

  it('unit vector along y has length 1', () => {
    expect(length(vec2(0, 1))).toBe(1);
  });
});

describe('lengthSq', () => {
  it('computes squared length', () => {
    expect(lengthSq(vec2(3, 4))).toBe(25);
  });

  it('zero vector has zero squared length', () => {
    expect(lengthSq(vec2(0, 0))).toBe(0);
  });
});

describe('normalize', () => {
  it('normalizes a vector to unit length', () => {
    const n = normalize(vec2(3, 4));
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
    expect(length(n)).toBeCloseTo(1);
  });

  it('normalizing a unit vector returns unit vector', () => {
    const n = normalize(vec2(1, 0));
    expect(n).toEqual({ x: 1, y: 0 });
  });

  it('normalizing zero vector returns zero vector', () => {
    const n = normalize(vec2(0, 0));
    expect(n).toEqual({ x: 0, y: 0 });
  });

  it('normalizing negative vector preserves direction', () => {
    const n = normalize(vec2(-4, 0));
    expect(n.x).toBeCloseTo(-1);
    expect(n.y).toBeCloseTo(0);
  });
});

describe('distance', () => {
  it('computes distance between two points', () => {
    expect(distance(vec2(0, 0), vec2(3, 4))).toBe(5);
  });

  it('distance to self is zero', () => {
    expect(distance(vec2(5, 5), vec2(5, 5))).toBe(0);
  });

  it('distance is symmetric', () => {
    const a = vec2(1, 2);
    const b = vec2(4, 6);
    expect(distance(a, b)).toBe(distance(b, a));
  });
});

describe('distanceSq', () => {
  it('computes squared distance', () => {
    expect(distanceSq(vec2(0, 0), vec2(3, 4))).toBe(25);
  });
});

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint when t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('handles negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });

  it('extrapolates beyond t=1', () => {
    expect(lerp(0, 10, 2)).toBe(20);
  });

  it('extrapolates below t=0', () => {
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

describe('lerpVec2', () => {
  it('interpolates both components', () => {
    const result = lerpVec2(vec2(0, 0), vec2(10, 20), 0.5);
    expect(result.x).toBe(5);
    expect(result.y).toBe(10);
  });

  it('returns a when t=0', () => {
    const result = lerpVec2(vec2(1, 2), vec2(10, 20), 0);
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it('returns b when t=1', () => {
    const result = lerpVec2(vec2(1, 2), vec2(10, 20), 1);
    expect(result).toEqual({ x: 10, y: 20 });
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('works with negative ranges', () => {
    expect(clamp(0, -10, -5)).toBe(-5);
  });
});

describe('angleFromDirection', () => {
  it('right direction (1,0) gives angle 0', () => {
    expect(angleFromDirection(vec2(1, 0))).toBeCloseTo(0);
  });

  it('up direction (0,-1) gives angle pi/2 (negative y is up)', () => {
    // atan2(-(-1), 0) = atan2(1, 0) = pi/2
    expect(angleFromDirection(vec2(0, -1))).toBeCloseTo(Math.PI / 2);
  });

  it('left direction (-1,0) gives angle pi', () => {
    expect(Math.abs(angleFromDirection(vec2(-1, 0)))).toBeCloseTo(Math.PI);
  });

  it('down direction (0,1) gives angle -pi/2', () => {
    // atan2(-1, 0) = -pi/2
    expect(angleFromDirection(vec2(0, 1))).toBeCloseTo(-Math.PI / 2);
  });
});

describe('directionFromAngle', () => {
  it('angle 0 gives right direction (1, 0)', () => {
    const dir = directionFromAngle(0);
    expect(dir.x).toBeCloseTo(1);
    expect(dir.y).toBeCloseTo(0);
  });

  it('angle pi/2 gives up direction (0, -1)', () => {
    const dir = directionFromAngle(Math.PI / 2);
    expect(dir.x).toBeCloseTo(0);
    expect(dir.y).toBeCloseTo(-1);
  });

  it('angle pi gives left direction (-1, 0)', () => {
    const dir = directionFromAngle(Math.PI);
    expect(dir.x).toBeCloseTo(-1);
    expect(dir.y).toBeCloseTo(0);
  });

  it('roundtrips with angleFromDirection', () => {
    const original = vec2(0.6, -0.8);
    const angle = angleFromDirection(original);
    const recovered = directionFromAngle(angle);
    expect(recovered.x).toBeCloseTo(original.x);
    expect(recovered.y).toBeCloseTo(original.y);
  });
});

describe('rotateVec2', () => {
  it('rotating (1,0) by pi/2 gives (0,1)', () => {
    const result = rotateVec2(vec2(1, 0), Math.PI / 2);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  it('rotating by 0 is identity', () => {
    const result = rotateVec2(vec2(3, 4), 0);
    expect(result.x).toBeCloseTo(3);
    expect(result.y).toBeCloseTo(4);
  });

  it('rotating by 2*pi is identity', () => {
    const result = rotateVec2(vec2(3, 4), 2 * Math.PI);
    expect(result.x).toBeCloseTo(3);
    expect(result.y).toBeCloseTo(4);
  });

  it('rotating by pi reverses direction', () => {
    const result = rotateVec2(vec2(1, 0), Math.PI);
    expect(result.x).toBeCloseTo(-1);
    expect(result.y).toBeCloseTo(0);
  });

  it('preserves vector length', () => {
    const v = vec2(3, 4);
    const rotated = rotateVec2(v, 1.23);
    expect(length(rotated)).toBeCloseTo(length(v));
  });
});

describe('perpendicular', () => {
  it('returns perpendicular vector', () => {
    const result = perpendicular(vec2(1, 0));
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  it('perpendicular of (0,1) is (-1,0)', () => {
    expect(perpendicular(vec2(0, 1))).toEqual({ x: -1, y: 0 });
  });

  it('result is actually perpendicular (dot product is zero)', () => {
    const v = vec2(3, 7);
    const p = perpendicular(v);
    expect(dot(v, p)).toBeCloseTo(0);
  });

  it('preserves length', () => {
    const v = vec2(3, 4);
    const p = perpendicular(v);
    expect(length(p)).toBeCloseTo(length(v));
  });
});

describe('angleToDirectionIndex', () => {
  // 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
  // Math convention: angle 0 = right (east), pi/2 = up (north)

  it('angle pi/2 (north / up) returns 0 (N)', () => {
    expect(angleToDirectionIndex(Math.PI / 2)).toBe(0);
  });

  it('angle pi/4 (northeast) returns 1 (NE)', () => {
    expect(angleToDirectionIndex(Math.PI / 4)).toBe(1);
  });

  it('angle 0 (east / right) returns 2 (E)', () => {
    expect(angleToDirectionIndex(0)).toBe(2);
  });

  it('angle -pi/4 (southeast) returns 3 (SE)', () => {
    expect(angleToDirectionIndex(-Math.PI / 4)).toBe(3);
  });

  it('angle -pi/2 (south / down) returns 4 (S)', () => {
    expect(angleToDirectionIndex(-Math.PI / 2)).toBe(4);
  });

  it('angle -3pi/4 (southwest) returns 5 (SW)', () => {
    expect(angleToDirectionIndex(-3 * Math.PI / 4)).toBe(5);
  });

  it('angle pi (west / left) returns 6 (W)', () => {
    expect(angleToDirectionIndex(Math.PI)).toBe(6);
  });

  it('angle 3pi/4 (northwest) returns 7 (NW)', () => {
    expect(angleToDirectionIndex(3 * Math.PI / 4)).toBe(7);
  });
});

describe('projectPointOnSegment', () => {
  it('projects point onto middle of segment', () => {
    const result = projectPointOnSegment(
      vec2(5, 5),
      vec2(0, 0),
      vec2(10, 0),
    );
    expect(result.t).toBeCloseTo(0.5);
    expect(result.closest.x).toBeCloseTo(5);
    expect(result.closest.y).toBeCloseTo(0);
    expect(result.distance).toBeCloseTo(5);
  });

  it('clamps to start when point is before segment', () => {
    const result = projectPointOnSegment(
      vec2(-5, 0),
      vec2(0, 0),
      vec2(10, 0),
    );
    expect(result.t).toBe(0);
    expect(result.closest).toEqual({ x: 0, y: 0 });
    expect(result.distance).toBeCloseTo(5);
  });

  it('clamps to end when point is after segment', () => {
    const result = projectPointOnSegment(
      vec2(15, 0),
      vec2(0, 0),
      vec2(10, 0),
    );
    expect(result.t).toBe(1);
    expect(result.closest).toEqual({ x: 10, y: 0 });
    expect(result.distance).toBeCloseTo(5);
  });

  it('handles degenerate segment (zero length)', () => {
    const result = projectPointOnSegment(
      vec2(3, 4),
      vec2(5, 5),
      vec2(5, 5),
    );
    expect(result.t).toBe(0);
    expect(result.closest).toEqual({ x: 5, y: 5 });
    expect(result.distance).toBeCloseTo(Math.sqrt(4 + 1));
  });

  it('handles vertical segment', () => {
    const result = projectPointOnSegment(
      vec2(3, 5),
      vec2(0, 0),
      vec2(0, 10),
    );
    expect(result.t).toBeCloseTo(0.5);
    expect(result.closest.x).toBeCloseTo(0);
    expect(result.closest.y).toBeCloseTo(5);
    expect(result.distance).toBeCloseTo(3);
  });

  it('handles diagonal segment', () => {
    const result = projectPointOnSegment(
      vec2(0, 10),
      vec2(0, 0),
      vec2(10, 10),
    );
    expect(result.t).toBeCloseTo(0.5);
    expect(result.closest.x).toBeCloseTo(5);
    expect(result.closest.y).toBeCloseTo(5);
  });

  it('point exactly on segment start', () => {
    const result = projectPointOnSegment(
      vec2(0, 0),
      vec2(0, 0),
      vec2(10, 0),
    );
    expect(result.t).toBeCloseTo(0);
    expect(result.distance).toBeCloseTo(0);
  });

  it('point exactly on segment end', () => {
    const result = projectPointOnSegment(
      vec2(10, 0),
      vec2(0, 0),
      vec2(10, 0),
    );
    expect(result.t).toBeCloseTo(1);
    expect(result.distance).toBeCloseTo(0);
  });
});

describe('randomRange', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns min when Math.random() returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(randomRange(5, 10)).toBe(5);
  });

  it('returns max when Math.random() returns ~1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999999);
    expect(randomRange(5, 10)).toBeCloseTo(10);
  });

  it('returns midpoint when Math.random() returns 0.5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(randomRange(0, 100)).toBe(50);
  });

  it('works with equal min and max', () => {
    expect(randomRange(5, 5)).toBe(5);
  });

  it('works with negative ranges', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(randomRange(-10, 10)).toBe(0);
  });
});

describe('randomAngle', () => {
  it('returns 0 when Math.random() returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(randomAngle()).toBe(0);
  });

  it('returns ~2pi when Math.random() returns ~1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999999);
    expect(randomAngle()).toBeCloseTo(2 * Math.PI);
    vi.restoreAllMocks();
  });
});
