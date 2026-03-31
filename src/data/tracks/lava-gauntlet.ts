import type { TrackData, ObstaclePlacement } from '../../types';

// Helper: generate road points along a straight segment
function straight(
  startX: number,
  startY: number,
  endY: number,
  width: number,
  step: number = 40,
): { x: number; y: number; width: number }[] {
  const points: { x: number; y: number; width: number }[] = [];
  const dy = endY - startY; // negative (going up)
  const count = Math.round(Math.abs(dy) / step);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push({ x: startX, y: startY + dy * t, width });
  }
  return points;
}

// Helper: generate road points along a curve (shifts x gradually)
function curve(
  startX: number,
  startY: number,
  endY: number,
  xShift: number,
  startWidth: number,
  endWidth: number,
  step: number = 40,
): { x: number; y: number; width: number }[] {
  const points: { x: number; y: number; width: number }[] = [];
  const dy = endY - startY;
  const count = Math.round(Math.abs(dy) / step);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    // Smooth sine-based curve
    const curveT = (1 - Math.cos(Math.PI * t)) / 2;
    points.push({
      x: startX + xShift * curveT,
      y: startY + dy * t,
      width: startWidth + (endWidth - startWidth) * t,
    });
  }
  return points;
}

// Build road by concatenating segments (skip first point of each to avoid duplicates)
function joinSegments(
  ...segments: { x: number; y: number; width: number }[][]
): { x: number; y: number; width: number }[] {
  const result = [...segments[0]];
  for (let i = 1; i < segments.length; i++) {
    result.push(...segments[i].slice(1));
  }
  return result;
}

// Segment 1: Y 5000→4600, straight, width 240
const seg1 = straight(240, 5000, 4600, 240);

// Segment 2: Y 4600→4200, gentle right curve, width 240→200
const seg2 = curve(240, 4600, 4200, 50, 240, 200);

// Segment 3: Y 4200→3800, straight, width 200
const seg3 = straight(290, 4200, 3800, 200);

// Segment 4: Y 3800→3400, straight, width 200
const seg4 = straight(290, 3800, 3400, 200);

// Segment 5: Y 3400→2800, left curve (moderate), width 200→180
const seg5 = curve(290, 3400, 2800, -80, 200, 180);

// Segment 6: Y 2800→2400, straight, width 180
const seg6 = straight(210, 2800, 2400, 180);

// Segment 7: Y 2400→1800, S-curve (right then left), width 180→160
const seg7a = curve(210, 2400, 2100, 70, 180, 170, 30);
const seg7b = curve(280, 2100, 1800, -70, 170, 160, 30);
const seg7 = [...seg7a, ...seg7b.slice(1)];

// Segment 8: Y 1800→1200, straight, width 160
const seg8 = straight(210, 1800, 1200, 160);

// Segment 9: Y 1200→800, gentle right curve, width 160→200
const seg9 = curve(210, 1200, 800, 40, 160, 200);

// Segment 10: Y 800→400, straight, width 200
const seg10 = straight(250, 800, 400, 200);

// Segment 11: Extension past finish line Y=400→0 to prevent lava death
const seg11 = straight(250, 400, 0, 200);

const road = joinSegments(seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, seg9, seg10, seg11);

// Find road index closest to a Y value
function indexAtY(y: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < road.length; i++) {
    const d = Math.abs(road[i].y - y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

// Get the road center X and width at a given Y
function roadAt(y: number): { x: number; width: number } {
  const idx = indexAtY(y);
  return { x: road[idx].x, width: road[idx].width };
}

const startLineIdx = indexAtY(5000);
const finishLineIdx = indexAtY(500);

const obstacles: ObstaclePlacement[] = [
  // --- Segment 1: Arrow pad at Y=4800, centered (forward) ---
  { type: 'arrow_pad', x: roadAt(4800).x, y: 4800, angle: 0 },

  // --- Segment 3: Logs ---
  // Y=4100, offset left 0.3
  {
    type: 'log',
    x: roadAt(4100).x - roadAt(4100).width * 0.3,
    y: 4100,
    angle: 0.3,
  },
  // Y=4000, offset right 0.4
  {
    type: 'log',
    x: roadAt(4000).x + roadAt(4000).width * 0.4,
    y: 4000,
    angle: -0.2,
  },
  // Y=3900, offset left 0.2
  {
    type: 'log',
    x: roadAt(3900).x - roadAt(3900).width * 0.2,
    y: 3900,
    angle: 0.5,
  },

  // --- Segment 4: Static spikes ---
  // Y=3700, spanning left 60% of road. Gap on right.
  {
    type: 'spikes',
    x: roadAt(3700).x - roadAt(3700).width * 0.2,
    y: 3700,
    angle: 0,
    width: roadAt(3700).width * 0.6,
  },
  // Y=3500, spanning right 50% of road. Gap on left.
  {
    type: 'spikes',
    x: roadAt(3500).x + roadAt(3500).width * 0.25,
    y: 3500,
    angle: 0,
    width: roadAt(3500).width * 0.5,
  },

  // --- Segment 6: Arrow pad (sideways right!) and rotating spikes ---
  { type: 'arrow_pad', x: roadAt(2700).x, y: 2700, angle: -Math.PI / 2 },
  {
    type: 'rotating_spikes',
    x: roadAt(2500).x,
    y: 2500,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 60,
    patrolSpeed: 6,
  },
  // Extra rotating spike in segment 6
  {
    type: 'rotating_spikes',
    x: roadAt(2600).x + roadAt(2600).width * 0.15,
    y: 2600,
    angle: 0,
    patrolAxis: 'y',
    patrolDistance: 30,
    patrolSpeed: 4.5,
  },

  // --- Segment 8: Rotating spike pair + logs ---
  // Y=1700, patrols left half (slower)
  {
    type: 'rotating_spikes',
    x: roadAt(1700).x - roadAt(1700).width * 0.2,
    y: 1700,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 35,
    patrolSpeed: 6.75,
  },
  // Y=1500, patrols right half (slower)
  {
    type: 'rotating_spikes',
    x: roadAt(1500).x + roadAt(1500).width * 0.2,
    y: 1500,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 35,
    patrolSpeed: 5.25,
  },
  // Extra rotating spike at Y=1600, center
  {
    type: 'rotating_spikes',
    x: roadAt(1600).x,
    y: 1600,
    angle: 0,
    patrolAxis: 'y',
    patrolDistance: 25,
    patrolSpeed: 6,
  },
  // Log at Y=1400, centered
  { type: 'log', x: roadAt(1400).x, y: 1400, angle: 0.1 },
  // Log at Y=1300, offset right 0.3
  {
    type: 'log',
    x: roadAt(1300).x + roadAt(1300).width * 0.3,
    y: 1300,
    angle: -0.4,
  },

  // --- Segment 9: Arrow pad at Y=1000, backward boost (surprise!) ---
  { type: 'arrow_pad', x: roadAt(1000).x, y: 1000, angle: Math.PI },
];

const startRoad = roadAt(4960);

const lavaGauntlet: TrackData = {
  name: 'Lava Gauntlet',
  difficulty: 'medium',
  road,
  obstacles,
  startLine: startLineIdx,
  finishLine: finishLineIdx,
  startPositions: {
    p1: { x: startRoad.x - 30, y: 4960, angle: Math.PI / 2 },
    p2: { x: startRoad.x + 30, y: 4960, angle: Math.PI / 2 },
    p3: { x: startRoad.x - 30, y: 5000, angle: Math.PI / 2 },
    p4: { x: startRoad.x + 30, y: 5000, angle: Math.PI / 2 },
  },
};

export default lavaGauntlet;
