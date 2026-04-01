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
  const dy = endY - startY;
  const count = Math.round(Math.abs(dy) / step);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push({ x: startX, y: startY + dy * t, width });
  }
  return points;
}

// Helper: generate road points along a curve
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
    const curveT = (1 - Math.cos(Math.PI * t)) / 2;
    points.push({
      x: startX + xShift * curveT,
      y: startY + dy * t,
      width: startWidth + (endWidth - startWidth) * t,
    });
  }
  return points;
}

function joinSegments(
  ...segments: { x: number; y: number; width: number }[][]
): { x: number; y: number; width: number }[] {
  const result = [...segments[0]];
  for (let i = 1; i < segments.length; i++) {
    result.push(...segments[i].slice(1));
  }
  return result;
}

// === MUD RUNNER: Easy, wide, messy and fun ===
// Total length: ~4000px (Y: 4500 → 500)

// Seg 1: Y 4500→4100 - Wide opening straight, width 260
const seg1 = straight(240, 4500, 4100, 260);

// Seg 2: Y 4100→3700 - Gentle right curve, width 260→250
const seg2 = curve(240, 4100, 3700, 35, 260, 250);

// Seg 3: Y 3700→3300 - Straight, width 250→270 (widening into mud pit)
const seg3 = curve(275, 3700, 3300, -15, 250, 270);

// Seg 4: Y 3300→2900 - Gentle left curve, width 270→240
const seg4 = curve(260, 3300, 2900, -40, 270, 240);

// Seg 5: Y 2900→2500 - Straight, width 240→260
const seg5 = curve(220, 2900, 2500, 20, 240, 260);

// Seg 6: Y 2500→2000 - Gentle right curve, width 260→220
const seg6 = curve(240, 2500, 2000, 45, 260, 220);

// Seg 7: Y 2000→1500 - Straight, width 220→250
const seg7 = curve(285, 2000, 1500, -25, 220, 250);

// Seg 8: Y 1500→1000 - Gentle left curve, width 250→260
const seg8 = curve(260, 1500, 1000, -30, 250, 260);

// Seg 9: Y 1000→500 - Final straight, width 260
const seg9 = straight(230, 1000, 500, 260);

// Seg 10: Extension past finish Y=500→100
const seg10 = straight(230, 500, 100, 260);

const road = joinSegments(seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, seg9, seg10);

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

function roadAt(y: number): { x: number; width: number } {
  const idx = indexAtY(y);
  return { x: road[idx].x, width: road[idx].width };
}

const startLineIdx = indexAtY(4500);
const finishLineIdx = indexAtY(600);

const obstacles: ObstaclePlacement[] = [
  // --- Seg 1: Arrow pad to start + first mud zone ---
  { type: 'arrow_pad', x: roadAt(4350).x, y: 4350, angle: 0 },
  {
    type: 'mud_zone',
    x: roadAt(4200).x + roadAt(4200).width * 0.1,
    y: 4200,
    angle: 0,
    width: 90,
  },

  // --- Seg 2: Destructible barrels in the curve ---
  {
    type: 'destructible',
    x: roadAt(4000).x - roadAt(4000).width * 0.2,
    y: 4000,
    angle: 0.2,
  },
  {
    type: 'destructible',
    x: roadAt(3850).x + roadAt(3850).width * 0.15,
    y: 3850,
    angle: -0.1,
  },

  // --- Arrow pad after the curve ---
  { type: 'arrow_pad', x: roadAt(3700).x, y: 3700, angle: 0 },

  // --- Seg 3: Big mud pit + logs ---
  {
    type: 'mud_zone',
    x: roadAt(3550).x - roadAt(3550).width * 0.15,
    y: 3550,
    angle: 0,
    width: 100,
  },
  {
    type: 'log',
    x: roadAt(3400).x + roadAt(3400).width * 0.2,
    y: 3400,
    angle: -0.3,
  },
  {
    type: 'mud_zone',
    x: roadAt(3250).x + roadAt(3250).width * 0.1,
    y: 3250,
    angle: 0,
    width: 80,
  },

  // --- Seg 4: Destructibles + ramp ---
  {
    type: 'destructible',
    x: roadAt(3100).x,
    y: 3100,
    angle: 0,
  },
  {
    type: 'ramp',
    x: roadAt(2950).x,
    y: 2950,
    angle: 0,
  },

  // --- Seg 5: Logs + arrow pad ---
  {
    type: 'log',
    x: roadAt(2800).x - roadAt(2800).width * 0.2,
    y: 2800,
    angle: 0.4,
  },
  { type: 'arrow_pad', x: roadAt(2650).x, y: 2650, angle: 0 },

  // --- Seg 6: Mud + destructibles + bouncy wall ---
  {
    type: 'mud_zone',
    x: roadAt(2450).x - roadAt(2450).width * 0.1,
    y: 2450,
    angle: 0,
    width: 85,
  },
  {
    type: 'destructible',
    x: roadAt(2300).x + roadAt(2300).width * 0.2,
    y: 2300,
    angle: 0.3,
  },
  {
    type: 'bouncy_wall',
    x: roadAt(2150).x - roadAt(2150).width * 0.2,
    y: 2150,
    angle: 0.5,
  },

  // --- Seg 7: Log + mud + ramp combo ---
  {
    type: 'log',
    x: roadAt(1950).x + roadAt(1950).width * 0.15,
    y: 1950,
    angle: -0.2,
  },
  {
    type: 'mud_zone',
    x: roadAt(1800).x,
    y: 1800,
    angle: 0,
    width: 95,
  },
  {
    type: 'ramp',
    x: roadAt(1650).x,
    y: 1650,
    angle: 0,
  },

  // --- Arrow pad after the ramp ---
  { type: 'arrow_pad', x: roadAt(1500).x, y: 1500, angle: 0 },

  // --- Seg 8: Final mud gauntlet + destructible ---
  {
    type: 'mud_zone',
    x: roadAt(1300).x + roadAt(1300).width * 0.1,
    y: 1300,
    angle: 0,
    width: 90,
  },
  {
    type: 'destructible',
    x: roadAt(1150).x - roadAt(1150).width * 0.15,
    y: 1150,
    angle: 0,
  },

  // --- Seg 9: Final boost ---
  { type: 'arrow_pad', x: roadAt(800).x, y: 800, angle: 0 },
];

const startRoad = roadAt(4460);

const mudRunner: TrackData = {
  name: 'Mud Runner',
  difficulty: 'easy',
  road,
  obstacles,
  startLine: startLineIdx,
  finishLine: finishLineIdx,
  startPositions: {
    p1: { x: startRoad.x - 25, y: 4460, angle: Math.PI / 2 },
    p2: { x: startRoad.x + 25, y: 4460, angle: Math.PI / 2 },
    p3: { x: startRoad.x - 25, y: 4500, angle: Math.PI / 2 },
    p4: { x: startRoad.x + 25, y: 4500, angle: Math.PI / 2 },
  },
};

export default mudRunner;
