import type { Vec2, RoadPoint } from '../types';
import {
  sub,
  dot,
  length,
  scale,
  add,
  clamp,
  projectPointOnSegment,
  rotateVec2,
  vec2,
} from '../utils/math';
import { LAVA_GRACE_ZONE, PLAYER_HITBOX_RADIUS } from '../utils/constants';

export function circleCircle(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const distSq = dx * dx + dy * dy;
  const radSum = ar + br;
  return distSq <= radSum * radSum;
}

export function pointInAABB(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function circleAABB(
  cx: number,
  cy: number,
  cr: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  // Find the closest point on the AABB to the circle center
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= cr * cr;
}

export function circleOBB(
  cx: number,
  cy: number,
  cr: number,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  angle: number,
): boolean {
  // Transform circle center into OBB local space (OBB centered at ox, oy)
  const local = rotateVec2(vec2(cx - ox, cy - oy), -angle);

  // Now test as circle vs AABB centered at origin
  const halfW = ow / 2;
  const halfH = oh / 2;
  const closestX = clamp(local.x, -halfW, halfW);
  const closestY = clamp(local.y, -halfH, halfH);
  const dx = local.x - closestX;
  const dy = local.y - closestY;
  return dx * dx + dy * dy <= cr * cr;
}

export function findNearestRoadPoint(
  point: Vec2,
  road: RoadPoint[],
): {
  segIdx: number;
  t: number;
  centerPoint: Vec2;
  distance: number;
  roadWidth: number;
} {
  let bestSegIdx = 0;
  let bestT = 0;
  let bestCenter: Vec2 = { x: road[0].x, y: road[0].y };
  let bestDist = Infinity;
  let bestWidth = road[0].width;

  for (let i = 0; i < road.length - 1; i++) {
    const segStart: Vec2 = { x: road[i].x, y: road[i].y };
    const segEnd: Vec2 = { x: road[i + 1].x, y: road[i + 1].y };
    const proj = projectPointOnSegment(point, segStart, segEnd);

    if (proj.distance < bestDist) {
      bestDist = proj.distance;
      bestSegIdx = i;
      bestT = proj.t;
      bestCenter = proj.closest;
      // Interpolate road width along segment
      bestWidth = road[i].width + (road[i + 1].width - road[i].width) * proj.t;
    }
  }

  return {
    segIdx: bestSegIdx,
    t: bestT,
    centerPoint: bestCenter,
    distance: bestDist,
    roadWidth: bestWidth,
  };
}

export function isPointOnRoad(
  point: Vec2,
  road: RoadPoint[],
): {
  onRoad: boolean;
  nearestSegIdx: number;
  distFromCenter: number;
} {
  const nearest = findNearestRoadPoint(point, road);
  const halfWidth = nearest.roadWidth / 2;
  const onRoad = nearest.distance <= halfWidth + PLAYER_HITBOX_RADIUS + LAVA_GRACE_ZONE;
  return {
    onRoad,
    nearestSegIdx: nearest.segIdx,
    distFromCenter: nearest.distance,
  };
}
