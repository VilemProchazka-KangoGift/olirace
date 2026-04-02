import { describe, it, expect } from 'vitest';
import {
  circleCircle,
  pointInAABB,
  circleAABB,
  circleOBB,
  isPointOnRoad,
  findNearestRoadPoint,
} from '../collision';
import type { RoadPoint } from '../../types';

// Helper: create a simple straight road
function createStraightRoad(
  width: number = 100,
): RoadPoint[] {
  return [
    { x: 0, y: 0, width },
    { x: 0, y: 100, width },
    { x: 0, y: 200, width },
    { x: 0, y: 300, width },
  ];
}

// Helper: create an L-shaped road
function createLShapedRoad(width: number = 80): RoadPoint[] {
  return [
    { x: 0, y: 0, width },
    { x: 0, y: 100, width },
    { x: 100, y: 100, width },
    { x: 200, y: 100, width },
  ];
}

describe('circleCircle', () => {
  it('detects overlapping circles', () => {
    expect(circleCircle(0, 0, 10, 5, 0, 10)).toBe(true);
  });

  it('detects touching circles (distance = sum of radii)', () => {
    expect(circleCircle(0, 0, 5, 10, 0, 5)).toBe(true);
  });

  it('detects separated circles', () => {
    expect(circleCircle(0, 0, 5, 20, 0, 5)).toBe(false);
  });

  it('detects concentric circles', () => {
    expect(circleCircle(5, 5, 10, 5, 5, 3)).toBe(true);
  });

  it('detects barely separated circles', () => {
    // Distance = 10.001, sum of radii = 10
    expect(circleCircle(0, 0, 5, 10.001, 0, 5)).toBe(false);
  });

  it('handles zero-radius circle', () => {
    // Point inside circle
    expect(circleCircle(0, 0, 0, 0, 0, 5)).toBe(true);
    // Point outside circle
    expect(circleCircle(10, 0, 0, 0, 0, 5)).toBe(false);
  });

  it('handles diagonal separation', () => {
    // Distance = sqrt(50) ~ 7.07, sum of radii = 6
    expect(circleCircle(0, 0, 3, 5, 5, 3)).toBe(false);
    // sum of radii = 8
    expect(circleCircle(0, 0, 4, 5, 5, 4)).toBe(true);
  });
});

describe('pointInAABB', () => {
  // Rectangle at (10, 10) with size 20x30
  const rx = 10, ry = 10, rw = 20, rh = 30;

  it('detects point inside', () => {
    expect(pointInAABB(20, 25, rx, ry, rw, rh)).toBe(true);
  });

  it('detects point outside (left)', () => {
    expect(pointInAABB(5, 25, rx, ry, rw, rh)).toBe(false);
  });

  it('detects point outside (right)', () => {
    expect(pointInAABB(35, 25, rx, ry, rw, rh)).toBe(false);
  });

  it('detects point outside (above)', () => {
    expect(pointInAABB(20, 5, rx, ry, rw, rh)).toBe(false);
  });

  it('detects point outside (below)', () => {
    expect(pointInAABB(20, 45, rx, ry, rw, rh)).toBe(false);
  });

  it('detects point on left edge', () => {
    expect(pointInAABB(10, 25, rx, ry, rw, rh)).toBe(true);
  });

  it('detects point on right edge', () => {
    expect(pointInAABB(30, 25, rx, ry, rw, rh)).toBe(true);
  });

  it('detects point on top edge', () => {
    expect(pointInAABB(20, 10, rx, ry, rw, rh)).toBe(true);
  });

  it('detects point on bottom edge', () => {
    expect(pointInAABB(20, 40, rx, ry, rw, rh)).toBe(true);
  });

  it('detects point on corner', () => {
    expect(pointInAABB(10, 10, rx, ry, rw, rh)).toBe(true);
    expect(pointInAABB(30, 40, rx, ry, rw, rh)).toBe(true);
  });
});

describe('circleAABB', () => {
  // Rectangle at (0, 0) with size 20x20
  const rx = 0, ry = 0, rw = 20, rh = 20;

  it('detects overlap (circle center inside rect)', () => {
    expect(circleAABB(10, 10, 5, rx, ry, rw, rh)).toBe(true);
  });

  it('detects overlap (circle overlaps from left)', () => {
    expect(circleAABB(-3, 10, 5, rx, ry, rw, rh)).toBe(true);
  });

  it('detects separated (circle far left)', () => {
    expect(circleAABB(-10, 10, 5, rx, ry, rw, rh)).toBe(false);
  });

  it('detects touching (circle just touches edge)', () => {
    // Circle center at (-5, 10), radius 5 -> touches left edge at x=0
    expect(circleAABB(-5, 10, 5, rx, ry, rw, rh)).toBe(true);
  });

  it('detects corner case: circle near corner but separated', () => {
    // Circle center at (-4, -4), radius 5
    // Closest point on rect is (0,0), distance = sqrt(32) ~ 5.66 > 5
    expect(circleAABB(-4, -4, 5, rx, ry, rw, rh)).toBe(false);
  });

  it('detects corner case: circle overlaps corner', () => {
    // Circle center at (-3, -3), radius 5
    // Closest point on rect is (0,0), distance = sqrt(18) ~ 4.24 < 5
    expect(circleAABB(-3, -3, 5, rx, ry, rw, rh)).toBe(true);
  });

  it('handles circle completely containing rect', () => {
    expect(circleAABB(10, 10, 100, rx, ry, rw, rh)).toBe(true);
  });

  it('handles zero-radius circle inside rect', () => {
    expect(circleAABB(10, 10, 0, rx, ry, rw, rh)).toBe(true);
  });

  it('handles zero-radius circle outside rect', () => {
    expect(circleAABB(-1, -1, 0, rx, ry, rw, rh)).toBe(false);
  });
});

describe('circleOBB', () => {
  it('detects collision with non-rotated OBB (angle=0)', () => {
    // OBB centered at (10,10), 20x10, angle=0
    // Circle at (10,10), radius 5 -> inside
    expect(circleOBB(10, 10, 5, 10, 10, 20, 10, 0)).toBe(true);
  });

  it('detects no collision with non-rotated OBB', () => {
    // OBB centered at (10,10), 20x10, angle=0
    // Circle at (30,10), radius 5 -> halfW=10, so OBB spans x:[0,20], circle at 30
    expect(circleOBB(30, 10, 5, 10, 10, 20, 10, 0)).toBe(false);
  });

  it('detects collision with rotated OBB at 90 degrees', () => {
    // OBB centered at (0,0), 20x10, angle=pi/2
    // After rotation, width=20 becomes height and vice versa
    // Circle at (0, 8) should be inside the rotated rectangle
    // In local space (rotated by -pi/2): (8, 0) -> halfW=10, halfH=5
    expect(circleOBB(0, 8, 3, 0, 0, 20, 10, Math.PI / 2)).toBe(true);
  });

  it('detects no collision with rotated OBB at 90 degrees', () => {
    // OBB centered at (0,0), 20x10, angle=pi/2
    // Circle at (8, 0) -> in local space (rotated by -pi/2): (0, -8)
    // halfW=10, halfH=5 -> closestY = clamp(-8, -5, 5) = -5, dy = -3
    // dist = 3, radius = 2 -> 3 > 2 -> no collision
    expect(circleOBB(8, 0, 2, 0, 0, 20, 10, Math.PI / 2)).toBe(false);
  });

  it('detects collision with 45-degree rotation', () => {
    // OBB centered at origin, 20x20, rotated 45 degrees
    // Circle at (0, 0) radius 1 -> clearly inside
    expect(circleOBB(0, 0, 1, 0, 0, 20, 20, Math.PI / 4)).toBe(true);
  });

  it('handles circle at the edge of rotated OBB', () => {
    // OBB centered at origin, 20x10, angle=0
    // Circle at (12, 0), radius 3 -> halfW=10, closestX=10, dx=2
    // 2*2 = 4 < 9 -> collision
    expect(circleOBB(12, 0, 3, 0, 0, 20, 10, 0)).toBe(true);
  });

  it('handles circle just outside rotated OBB', () => {
    // OBB centered at origin, 20x10, angle=0
    // Circle at (14, 0), radius 3 -> halfW=10, closestX=10, dx=4
    // 4*4 = 16 > 9 -> no collision
    expect(circleOBB(14, 0, 3, 0, 0, 20, 10, 0)).toBe(false);
  });
});

describe('findNearestRoadPoint', () => {
  it('finds nearest point on straight road', () => {
    const road = createStraightRoad(100);
    const result = findNearestRoadPoint({ x: 30, y: 150 }, road);
    expect(result.centerPoint.x).toBeCloseTo(0);
    expect(result.centerPoint.y).toBeCloseTo(150);
    expect(result.distance).toBeCloseTo(30);
    expect(result.roadWidth).toBe(100);
  });

  it('finds nearest point at road start', () => {
    const road = createStraightRoad(100);
    const result = findNearestRoadPoint({ x: 5, y: -10 }, road);
    // Should clamp to start of first segment
    expect(result.segIdx).toBe(0);
    expect(result.t).toBe(0);
    expect(result.centerPoint.x).toBeCloseTo(0);
    expect(result.centerPoint.y).toBeCloseTo(0);
  });

  it('finds nearest point at road end', () => {
    const road = createStraightRoad(100);
    const result = findNearestRoadPoint({ x: 5, y: 400 }, road);
    expect(result.segIdx).toBe(2); // last segment index
    expect(result.t).toBe(1);
    expect(result.centerPoint.x).toBeCloseTo(0);
    expect(result.centerPoint.y).toBeCloseTo(300);
  });

  it('finds nearest segment on L-shaped road', () => {
    const road = createLShapedRoad(80);
    // Point at (150, 50) should be closest to the horizontal segment
    const result = findNearestRoadPoint({ x: 150, y: 50 }, road);
    expect(result.segIdx).toBe(2); // third segment (horizontal part)
    expect(result.centerPoint.y).toBeCloseTo(100);
  });

  it('interpolates road width between segments', () => {
    const road: RoadPoint[] = [
      { x: 0, y: 0, width: 50 },
      { x: 0, y: 100, width: 100 },
    ];
    const result = findNearestRoadPoint({ x: 10, y: 50 }, road);
    expect(result.t).toBeCloseTo(0.5);
    expect(result.roadWidth).toBeCloseTo(75); // lerp(50, 100, 0.5)
  });

  it('handles point exactly on road center', () => {
    const road = createStraightRoad(100);
    const result = findNearestRoadPoint({ x: 0, y: 50 }, road);
    expect(result.distance).toBeCloseTo(0);
  });
});

describe('isPointOnRoad', () => {
  it('returns true for point on road center', () => {
    const road = createStraightRoad(100);
    const result = isPointOnRoad({ x: 0, y: 50 }, road);
    expect(result.onRoad).toBe(true);
    expect(result.distFromCenter).toBeCloseTo(0);
  });

  it('returns true for point within road width', () => {
    const road = createStraightRoad(100);
    // Half-width = 50, so x=40 should be on road
    const result = isPointOnRoad({ x: 40, y: 50 }, road);
    expect(result.onRoad).toBe(true);
  });

  it('returns true for point within grace zone', () => {
    const road = createStraightRoad(100);
    // Half-width = 50, grace = 5, so x=53 should be on road (53 <= 50+5)
    const result = isPointOnRoad({ x: 53, y: 50 }, road);
    expect(result.onRoad).toBe(true);
  });

  it('returns false for point off road (beyond hitbox + grace zone)', () => {
    const road = createStraightRoad(100);
    // Half-width = 50, hitbox = 16, grace = 5, so x=75 should be off road (75 > 71)
    const result = isPointOnRoad({ x: 75, y: 50 }, road);
    expect(result.onRoad).toBe(false);
  });

  it('returns false for point far from road', () => {
    const road = createStraightRoad(100);
    const result = isPointOnRoad({ x: 200, y: 50 }, road);
    expect(result.onRoad).toBe(false);
  });

  it('returns segment index of nearest segment', () => {
    const road = createStraightRoad(100);
    const result = isPointOnRoad({ x: 0, y: 150 }, road);
    expect(result.nearestSegIdx).toBe(1); // second segment (100 to 200)
  });

  it('returns correct distFromCenter', () => {
    const road = createStraightRoad(100);
    const result = isPointOnRoad({ x: 30, y: 50 }, road);
    expect(result.distFromCenter).toBeCloseTo(30);
  });

  it('boundary: exactly at halfWidth + hitbox + graceZone', () => {
    const road = createStraightRoad(100);
    // halfWidth=50, hitbox=16, grace=5 -> threshold=71
    const result = isPointOnRoad({ x: 71, y: 50 }, road);
    expect(result.onRoad).toBe(true); // <= check
  });

  it('boundary: just beyond halfWidth + hitbox + graceZone', () => {
    const road = createStraightRoad(100);
    const result = isPointOnRoad({ x: 71.1, y: 50 }, road);
    expect(result.onRoad).toBe(false);
  });
});
