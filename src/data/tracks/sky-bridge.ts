import type { TrackData, ObstaclePlacement } from '../../types';

// Helper: generate road points along a straight segment
function straight(
  startX: number,
  startY: number,
  endY: number,
  width: number,
  step: number = 30,
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
  step: number = 30,
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

// === SKY BRIDGE: Hard, narrow bridges with ramp jumps ===
// Total length: ~5500px (Y: 6000 → 500)

// Seg 1: Y 6000→5700 - Starting straight, width 170
const seg1 = straight(240, 6000, 5700, 170);

// Seg 2: Y 5700→5300 - Right curve, width 170→150
const seg2 = curve(240, 5700, 5300, 60, 170, 150);

// Seg 3: Y 5300→4900 - Tight left curve, width 150→130
const seg3 = curve(300, 5300, 4900, -90, 150, 130);

// Seg 4: Y 4900→4600 - Short narrow straight, width 130
const seg4 = straight(210, 4900, 4600, 130);

// Seg 5: Y 4600→4200 - S-curve right-left, width 130→140
const seg5a = curve(210, 4600, 4400, 70, 130, 135, 25);
const seg5b = curve(280, 4400, 4200, -60, 135, 140, 25);
const seg5 = [...seg5a, ...seg5b.slice(1)];

// Seg 6: Y 4200→3800 - Straight, width 140→160 (brief widening)
const seg6 = curve(220, 4200, 3800, 15, 140, 160);

// Seg 7: Y 3800→3400 - Tight right curve, width 160→140
const seg7 = curve(235, 3800, 3400, 80, 160, 140);

// Seg 8: Y 3400→3000 - Straight, width 140→130 (narrowing bridge)
const seg8 = curve(315, 3400, 3000, -40, 140, 130);

// Seg 9: Y 3000→2600 - Left hairpin, width 130→150
const seg9 = curve(275, 3000, 2600, -100, 130, 150);

// Seg 10: Y 2600→2200 - Straight, width 150→140
const seg10 = curve(175, 2600, 2200, 30, 150, 140);

// Seg 11: Y 2200→1700 - S-curve, width 140→160
const seg11a = curve(205, 2200, 1950, 65, 140, 145, 25);
const seg11b = curve(270, 1950, 1700, -55, 145, 160, 25);
const seg11 = [...seg11a, ...seg11b.slice(1)];

// Seg 12: Y 1700→1300 - Straight, width 160→150
const seg12 = curve(215, 1700, 1300, 20, 160, 150);

// Seg 13: Y 1300→900 - Tight right curve, width 150→170 (widening for finish approach)
const seg13 = curve(235, 1300, 900, 50, 150, 170);

// Seg 14: Y 900→500 - Final straight, width 170
const seg14 = straight(285, 900, 500, 170);

// Seg 15: Extension past finish Y=500→100
const seg15 = straight(285, 500, 100, 170);

const road = joinSegments(
  seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, seg9, seg10, seg11, seg12, seg13, seg14, seg15,
);

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

const startLineIdx = indexAtY(6000);
const finishLineIdx = indexAtY(600);

const obstacles: ObstaclePlacement[] = [
  // --- Seg 1: Arrow pad to start ---
  { type: 'arrow_pad', x: roadAt(5850).x, y: 5850, angle: 0 },

  // --- Seg 2: Mud zone on the curve + bouncy wall ---
  {
    type: 'mud_zone',
    x: roadAt(5550).x,
    y: 5550,
    angle: 0,
    width: 60,
  },
  {
    type: 'bouncy_wall',
    x: roadAt(5400).x + roadAt(5400).width * 0.2,
    y: 5400,
    angle: -0.5,
  },

  // --- Seg 3: Ramp before spikes — skilled players jump over ---
  {
    type: 'ramp',
    x: roadAt(5200).x,
    y: 5200,
    angle: 0,
  },
  {
    type: 'spikes',
    x: roadAt(5050).x - roadAt(5050).width * 0.1,
    y: 5050,
    angle: 0,
    width: roadAt(5050).width * 0.4,
  },

  // --- Seg 4: Log + destructible ---
  {
    type: 'log',
    x: roadAt(4850).x + roadAt(4850).width * 0.15,
    y: 4850,
    angle: -0.3,
  },
  {
    type: 'destructible',
    x: roadAt(4700).x - roadAt(4700).width * 0.15,
    y: 4700,
    angle: 0.2,
  },

  // --- Seg 5: Arrow pad + rotating spike in S-curve ---
  { type: 'arrow_pad', x: roadAt(4500).x, y: 4500, angle: 0 },
  {
    type: 'rotating_spikes',
    x: roadAt(4300).x,
    y: 4300,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 65,
    patrolSpeed: 3,
  },

  // --- Seg 6: Ramp to jump over danger below ---
  {
    type: 'ramp',
    x: roadAt(4100).x,
    y: 4100,
    angle: 0,
  },
  {
    type: 'spikes',
    x: roadAt(3950).x + roadAt(3950).width * 0.15,
    y: 3950,
    angle: 0,
    width: roadAt(3950).width * 0.35,
  },

  // --- Seg 7: Bouncy wall + mud ---
  {
    type: 'bouncy_wall',
    x: roadAt(3700).x - roadAt(3700).width * 0.2,
    y: 3700,
    angle: 0.4,
  },
  {
    type: 'mud_zone',
    x: roadAt(3550).x,
    y: 3550,
    angle: 0,
    width: 55,
  },

  // --- Seg 8: Rotating spike on the narrow bridge ---
  {
    type: 'rotating_spikes',
    x: roadAt(3250).x,
    y: 3250,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 65,
    patrolSpeed: 3.5,
  },

  // --- Seg 9: Ramp before rotating spike at hairpin ---
  {
    type: 'ramp',
    x: roadAt(2950).x,
    y: 2950,
    angle: 0,
  },
  {
    type: 'rotating_spikes',
    x: roadAt(2750).x,
    y: 2750,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 70,
    patrolSpeed: 3,
  },

  // --- Arrow pad after the danger ---
  { type: 'arrow_pad', x: roadAt(2600).x, y: 2600, angle: 0 },

  // --- Seg 10: Log + destructible ---
  {
    type: 'log',
    x: roadAt(2400).x - roadAt(2400).width * 0.15,
    y: 2400,
    angle: 0.4,
  },
  {
    type: 'destructible',
    x: roadAt(2250).x + roadAt(2250).width * 0.15,
    y: 2250,
    angle: 0,
  },

  // --- Seg 11: Ramp + spikes combo (the big jump) ---
  {
    type: 'ramp',
    x: roadAt(2100).x,
    y: 2100,
    angle: 0,
  },
  {
    type: 'spikes',
    x: roadAt(1950).x - roadAt(1950).width * 0.1,
    y: 1950,
    angle: 0,
    width: roadAt(1950).width * 0.4,
  },
  {
    type: 'spikes',
    x: roadAt(1800).x + roadAt(1800).width * 0.1,
    y: 1800,
    angle: 0,
    width: roadAt(1800).width * 0.35,
  },

  // --- Seg 12: Arrow pad + ramp for final approach ---
  { type: 'arrow_pad', x: roadAt(1600).x, y: 1600, angle: 0 },
  {
    type: 'ramp',
    x: roadAt(1450).x,
    y: 1450,
    angle: 0,
  },

  // --- Seg 13: Final gauntlet ---
  {
    type: 'spikes',
    x: roadAt(1200).x + roadAt(1200).width * 0.15,
    y: 1200,
    angle: 0,
    width: roadAt(1200).width * 0.35,
  },
  {
    type: 'log',
    x: roadAt(1050).x - roadAt(1050).width * 0.15,
    y: 1050,
    angle: -0.3,
  },

  // --- Final boost to finish ---
  { type: 'arrow_pad', x: roadAt(750).x, y: 750, angle: 0 },
];

const startRoad = roadAt(5960);

const skyBridge: TrackData = {
  name: 'Sky Bridge',
  difficulty: 'hard',
  road,
  obstacles,
  startLine: startLineIdx,
  finishLine: finishLineIdx,
  startPositions: {
    p1: { x: startRoad.x - 25, y: 5960, angle: Math.PI / 2 },
    p2: { x: startRoad.x + 25, y: 5960, angle: Math.PI / 2 },
    p3: { x: startRoad.x - 25, y: 6000, angle: Math.PI / 2 },
    p4: { x: startRoad.x + 25, y: 6000, angle: Math.PI / 2 },
  },
};

export default skyBridge;
