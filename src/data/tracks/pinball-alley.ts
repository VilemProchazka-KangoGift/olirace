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

// === PINBALL ALLEY: Medium difficulty, wide and chaotic with bouncy walls ===
// Total length: ~5000px (Y: 5500 → 500)

// Seg 0: Y 6100→5500 - Extension before start
const seg0 = straight(240, 6100, 5500, 240);

// Seg 1: Y 5500→5100 - Wide opening straight, width 240
const seg1 = straight(240, 5500, 5100, 240);

// Seg 2: Y 5100→4700 - Gentle right curve, width 240→220
const seg2 = curve(240, 5100, 4700, 50, 240, 220);

// Seg 3: Y 4700→4300 - Straight, width 220→250 (widening for pinball zone)
const seg3 = curve(290, 4700, 4300, -20, 220, 250);

// Seg 4: Y 4300→3800 - Gentle left curve, width 250→230
const seg4 = curve(270, 4300, 3800, -60, 250, 230);

// Seg 5: Y 3800→3300 - Straight, width 230→240
const seg5 = curve(210, 3800, 3300, 30, 230, 240);

// Seg 6: Y 3300→2800 - Right curve, FORK SECTION: widens to 400px
const seg6 = curve(240, 3300, 2800, 55, 240, 400);

// Seg 7: Y 2800→2300 - Straight, narrows back from fork
const seg7 = curve(295, 2800, 2300, -40, 400, 220);

// Seg 8: Y 2300→1800 - Left curve, width 220→180 (narrowing for tension)
const seg8 = curve(255, 2300, 1800, -50, 220, 180);

// Seg 9: Y 1800→1300 - Straight, width 180→210
const seg9 = curve(205, 1800, 1300, 25, 180, 210);

// Seg 10: Y 1300→800 - Gentle right curve, width 210→230 (widening for finish)
const seg10 = curve(230, 1300, 800, 30, 210, 230);

// Seg 11: Y 800→500 - Final straight, width 230
const seg11 = straight(260, 800, 500, 230);

// Seg 12: Extension past finish Y=500→-500
const seg12 = straight(260, 500, -500, 230);

const road = joinSegments(seg0, seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, seg9, seg10, seg11, seg12);

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

const startLineIdx = indexAtY(5500);
const finishLineIdx = indexAtY(600);

const obstacles: ObstaclePlacement[] = [
  // --- Arrow pad to get going ---
  { type: 'arrow_pad', x: roadAt(5300).x, y: 5300, angle: 0 },

  // --- First bouncy wall pair — pinball intro ---
  {
    type: 'bouncy_wall',
    x: roadAt(5000).x - roadAt(5000).width * 0.25,
    y: 5000,
    angle: 0.4,
  },
  // Arrow pad after bouncy wall (slingshot into boost!) ---
  { type: 'arrow_pad', x: roadAt(4900).x, y: 4900, angle: 0 },
  {
    type: 'bouncy_wall',
    x: roadAt(4800).x + roadAt(4800).width * 0.25,
    y: 4800,
    angle: -0.3,
  },

  // --- Destructibles ---
  {
    type: 'destructible',
    x: roadAt(4600).x - roadAt(4600).width * 0.2,
    y: 4600,
    angle: 0,
  },
  {
    type: 'destructible',
    x: roadAt(4500).x + roadAt(4500).width * 0.15,
    y: 4500,
    angle: 0.3,
  },

  // --- Mud zone ---
  {
    type: 'mud_zone',
    x: roadAt(4350).x,
    y: 4350,
    angle: 0,
    width: 80,
  },

  // --- Bouncy wall at curve + arrow pad (slingshot combo!) ---
  {
    type: 'bouncy_wall',
    x: roadAt(4100).x + roadAt(4100).width * 0.2,
    y: 4100,
    angle: -0.5,
  },
  { type: 'arrow_pad', x: roadAt(4000).x, y: 4000, angle: 0 },

  // --- Ramp ---
  { type: 'ramp', x: roadAt(3850).x, y: 3850, angle: 0 },

  // --- Logs ---
  {
    type: 'log',
    x: roadAt(3600).x - roadAt(3600).width * 0.2,
    y: 3600,
    angle: 0.3,
  },
  {
    type: 'log',
    x: roadAt(3450).x + roadAt(3450).width * 0.15,
    y: 3450,
    angle: -0.2,
  },

  // === PINBALL MACHINE SECTION ===
  // Two bouncy walls narrowing with ramp in middle — bounce off walls, hit ramp, fly over!
  {
    type: 'bouncy_wall',
    x: roadAt(3200).x - roadAt(3200).width * 0.25,
    y: 3200,
    angle: 0.6,
  },
  { type: 'ramp', x: roadAt(3100).x, y: 3100, angle: 0 },
  {
    type: 'bouncy_wall',
    x: roadAt(3000).x + roadAt(3000).width * 0.25,
    y: 3000,
    angle: -0.4,
  },

  // === FORK SECTION (Y 2900→2700, widens to 400px) ===
  // Center: bouncy wall divides paths (pinball-themed!)
  {
    type: 'bouncy_wall',
    x: roadAt(2850).x,
    y: 2850,
    angle: 0,
  },
  // Left path: bouncy wall corridor (pinball chaos!)
  {
    type: 'bouncy_wall',
    x: roadAt(2850).x - roadAt(2850).width * 0.3,
    y: 2850,
    angle: 0.3,
  },
  {
    type: 'bouncy_wall',
    x: roadAt(2750).x - roadAt(2750).width * 0.25,
    y: 2750,
    angle: -0.4,
  },
  // Right path: mud zone (drift opportunity)
  {
    type: 'mud_zone',
    x: roadAt(2800).x + roadAt(2800).width * 0.3,
    y: 2800,
    angle: 0,
    width: 70,
  },
  // === END FORK ===

  // --- Rotating spike with patrol (the real danger) ---
  {
    type: 'rotating_spikes',
    x: roadAt(2500).x,
    y: 2500,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 50,
    patrolSpeed: 4,
  },

  // --- Arrow pad after danger ---
  { type: 'arrow_pad', x: roadAt(2350).x, y: 2350, angle: 0 },

  // --- Bouncy wall + arrow pad slingshot combo ---
  {
    type: 'bouncy_wall',
    x: roadAt(2100).x - roadAt(2100).width * 0.2,
    y: 2100,
    angle: 0.5,
  },
  { type: 'arrow_pad', x: roadAt(2000).x, y: 2000, angle: 0 },

  // --- Final pinball chaos ---
  {
    type: 'bouncy_wall',
    x: roadAt(1600).x + roadAt(1600).width * 0.2,
    y: 1600,
    angle: -0.6,
    patrolAxis: 'x',
    patrolDistance: 30,
    patrolSpeed: 3,
  },
  {
    type: 'log',
    x: roadAt(1400).x - roadAt(1400).width * 0.15,
    y: 1400,
    angle: 0.2,
  },
  {
    type: 'bouncy_wall',
    x: roadAt(1200).x - roadAt(1200).width * 0.2,
    y: 1200,
    angle: 0.5,
  },
  {
    type: 'bouncy_wall',
    x: roadAt(1050).x + roadAt(1050).width * 0.25,
    y: 1050,
    angle: -0.4,
  },

  // --- Final boost ---
  { type: 'arrow_pad', x: roadAt(750).x, y: 750, angle: 0 },
];

const startRoad = roadAt(5460);

const pinballAlley: TrackData = {
  name: 'Pinball Alley',
  difficulty: 'medium',
  road,
  obstacles,
  startLine: startLineIdx,
  finishLine: finishLineIdx,
  startPositions: {
    p1: { x: startRoad.x - 38, y: 5460, angle: Math.PI / 2 },
    p2: { x: startRoad.x - 13, y: 5460, angle: Math.PI / 2 },
    p3: { x: startRoad.x + 13, y: 5460, angle: Math.PI / 2 },
    p4: { x: startRoad.x + 38, y: 5460, angle: Math.PI / 2 },
  },
};

export default pinballAlley;
