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

// Seg 0: Y 5100→4500 - Extension before start
const seg0 = straight(240, 5100, 4500, 260);

// Seg 1: Y 4500→4100 - Wide opening straight, width 260
const seg1 = straight(240, 4500, 4100, 260);

// Seg 2: Y 4100→3700 - Gentle right curve, width 260→250
const seg2 = curve(240, 4100, 3700, 35, 260, 250);

// Seg 3: Y 3700→3300 - Straight, width 250→270 (widening into mud pit)
const seg3 = curve(275, 3700, 3300, -15, 250, 270);

// Seg 4: Y 3300→2900 - Gentle left curve, width 270→240
const seg4 = curve(260, 3300, 2900, -40, 270, 240);

// Seg 5: Y 2900→2500 - FORK SECTION: widens to 380px
const seg5 = curve(220, 2900, 2500, 20, 240, 380);

// Seg 6: Y 2500→2000 - Gentle right curve, narrows back from fork
const seg6 = curve(240, 2500, 2000, 45, 380, 220);

// Seg 7: Y 2000→1500 - Straight, width 220→250
const seg7 = curve(285, 2000, 1500, -25, 220, 250);

// Seg 8: Y 1500→1000 - Gentle left curve, width 250→260
const seg8 = curve(260, 1500, 1000, -30, 250, 260);

// Seg 9: Y 1000→500 - Final straight, width 260
const seg9 = straight(230, 1000, 500, 260);

// Seg 10: Extension past finish Y=500→-500
const seg10 = straight(230, 500, -500, 260);

const road = joinSegments(seg0, seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, seg9, seg10);

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
  // --- Arrow pad to start ---
  { type: 'arrow_pad', x: roadAt(4350).x, y: 4350, angle: 0 },

  // --- First mud zone on curve apex (drift through for boost!) ---
  {
    type: 'mud_zone',
    x: roadAt(4100).x,
    y: 4100,
    angle: 0,
    width: 100,
  },

  // --- Destructible barrels in the curve ---
  {
    type: 'destructible',
    x: roadAt(3900).x - roadAt(3900).width * 0.2,
    y: 3900,
    angle: 0.2,
  },
  {
    type: 'destructible',
    x: roadAt(3850).x + roadAt(3850).width * 0.15,
    y: 3850,
    angle: -0.1,
  },

  // --- Arrow pad after curve ---
  { type: 'arrow_pad', x: roadAt(3700).x, y: 3700, angle: 0 },

  // --- Big mud pit on curve apex (drift opportunity!) ---
  {
    type: 'mud_zone',
    x: roadAt(3500).x,
    y: 3500,
    angle: 0,
    width: 110,
  },

  // --- Log between mud zones ---
  {
    type: 'log',
    x: roadAt(3350).x + roadAt(3350).width * 0.2,
    y: 3350,
    angle: -0.3,
  },

  // --- Mud then arrow pad: "mud catapult" combo ---
  {
    type: 'mud_zone',
    x: roadAt(3200).x,
    y: 3200,
    angle: 0,
    width: 90,
  },
  { type: 'arrow_pad', x: roadAt(3050).x, y: 3050, angle: 0 },

  // --- Ramp to jump over next section ---
  { type: 'ramp', x: roadAt(2950).x, y: 2950, angle: 0 },

  // === FORK SECTION (Y 2800→2600, road widens to 380px) ===
  // Center: bouncy wall divides paths (fun, not deadly!)
  {
    type: 'bouncy_wall',
    x: roadAt(2700).x,
    y: 2700,
    angle: 0,
  },
  // Left path: mud zone (drift opportunity — risk/reward!)
  {
    type: 'mud_zone',
    x: roadAt(2700).x - roadAt(2700).width * 0.3,
    y: 2700,
    angle: 0,
    width: 80,
  },
  // Right path: destructibles (smash through for micro-boost)
  {
    type: 'destructible',
    x: roadAt(2750).x + roadAt(2750).width * 0.28,
    y: 2750,
    angle: 0,
  },
  {
    type: 'destructible',
    x: roadAt(2680).x + roadAt(2680).width * 0.28,
    y: 2680,
    angle: 0,
  },
  // === END FORK ===

  // --- Bouncy wall after fork ---
  {
    type: 'bouncy_wall',
    x: roadAt(2300).x - roadAt(2300).width * 0.2,
    y: 2300,
    angle: 0.5,
  },

  // --- Mud zone on curve apex (drift through!) ---
  {
    type: 'mud_zone',
    x: roadAt(2100).x,
    y: 2100,
    angle: 0,
    width: 90,
  },

  // --- Ramp to jump ---
  { type: 'ramp', x: roadAt(1850).x, y: 1850, angle: 0 },

  // --- Arrow pad after ramp ---
  { type: 'arrow_pad', x: roadAt(1650).x, y: 1650, angle: 0 },

  // --- Final mud on curve apex ---
  {
    type: 'mud_zone',
    x: roadAt(1300).x,
    y: 1300,
    angle: 0,
    width: 90,
  },

  // --- Log before finish ---
  {
    type: 'log',
    x: roadAt(1100).x + roadAt(1100).width * 0.15,
    y: 1100,
    angle: -0.2,
  },

  // --- Final boost ---
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
    p1: { x: startRoad.x - 38, y: 4460, angle: Math.PI / 2 },
    p2: { x: startRoad.x - 13, y: 4460, angle: Math.PI / 2 },
    p3: { x: startRoad.x + 13, y: 4460, angle: Math.PI / 2 },
    p4: { x: startRoad.x + 38, y: 4460, angle: Math.PI / 2 },
  },
};

export default mudRunner;
