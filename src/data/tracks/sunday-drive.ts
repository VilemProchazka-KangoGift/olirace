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

// === SUNDAY DRIVE: Easy, wide, friendly ===
// Total length: ~4500px (Y: 4800 → 300)

// Seg 1: Y 4800→4400 - Wide opening straight, width 280
const seg1 = straight(240, 4800, 4400, 280);

// Seg 2: Y 4400→4000 - Gentle left bend, width 280→260
const seg2 = curve(240, 4400, 4000, -30, 280, 260);

// Seg 3: Y 4000→3600 - Straight, width 260
const seg3 = straight(210, 4000, 3600, 260);

// Seg 4: Y 3600→3200 - Gentle right bend, width 260→250
const seg4 = curve(210, 3600, 3200, 40, 260, 250);

// Seg 5: Y 3200→2800 - Straight, width 250
const seg5 = straight(250, 3200, 2800, 250);

// Seg 6: Y 2800→2400 - Gentle left bend, width 250→240
const seg6 = curve(250, 2800, 2400, -35, 250, 240);

// Seg 7: Y 2400→2000 - Straight, width 240
const seg7 = straight(215, 2400, 2000, 240);

// Seg 8: Y 2000→1600 - Gentle right bend, width 240→230
const seg8 = curve(215, 2000, 1600, 45, 240, 230);

// Seg 9: Y 1600→1200 - Straight, width 230
const seg9 = straight(260, 1600, 1200, 230);

// Seg 10: Y 1200→800 - Gentle left bend, width 230→240
const seg10 = curve(260, 1200, 800, -30, 230, 240);

// Seg 11: Y 800→300 - Final straight, width 240→260 (widens for finish)
const seg11 = curve(230, 800, 300, 10, 240, 260, 40);

const road = joinSegments(seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, seg9, seg10, seg11);

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

const startLineIdx = indexAtY(4800);
const finishLineIdx = indexAtY(400);

const obstacles: ObstaclePlacement[] = [
  // --- Early boost to get players going ---
  { type: 'arrow_pad', x: roadAt(4600).x, y: 4600, angle: 0 },

  // --- A few friendly logs in Seg 3, well spaced ---
  {
    type: 'log',
    x: roadAt(3900).x - roadAt(3900).width * 0.2,
    y: 3900,
    angle: 0.3,
  },
  {
    type: 'log',
    x: roadAt(3700).x + roadAt(3700).width * 0.25,
    y: 3700,
    angle: -0.2,
  },

  // --- Arrow pad reward after logs ---
  { type: 'arrow_pad', x: roadAt(3400).x, y: 3400, angle: 0 },

  // --- Single log in the bend ---
  {
    type: 'log',
    x: roadAt(3100).x,
    y: 3100,
    angle: 0.4,
  },

  // --- Gentle spike introduction: narrow strip, easy to dodge ---
  {
    type: 'spikes',
    x: roadAt(2900).x,
    y: 2900,
    angle: 0,
    width: 60,
  },

  // --- Arrow pad as encouragement ---
  { type: 'arrow_pad', x: roadAt(2600).x, y: 2600, angle: 0 },

  // --- Pair of logs, staggered ---
  {
    type: 'log',
    x: roadAt(2200).x - roadAt(2200).width * 0.15,
    y: 2200,
    angle: 0.1,
  },
  {
    type: 'log',
    x: roadAt(2100).x + roadAt(2100).width * 0.2,
    y: 2100,
    angle: -0.3,
  },

  // --- A slow rotating spike, easy to time ---
  {
    type: 'rotating_spikes',
    x: roadAt(1900).x,
    y: 1900,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 40,
    patrolSpeed: 20,
  },

  // --- Mid-track boost ---
  { type: 'arrow_pad', x: roadAt(1700).x, y: 1700, angle: 0 },

  // --- Log chicane before finish area ---
  {
    type: 'log',
    x: roadAt(1400).x - roadAt(1400).width * 0.2,
    y: 1400,
    angle: 0.5,
  },
  {
    type: 'log',
    x: roadAt(1300).x + roadAt(1300).width * 0.15,
    y: 1300,
    angle: -0.1,
  },
  {
    type: 'log',
    x: roadAt(1100).x,
    y: 1100,
    angle: 0.2,
  },

  // --- Small spike strip near end, lots of room to dodge ---
  {
    type: 'spikes',
    x: roadAt(900).x + roadAt(900).width * 0.15,
    y: 900,
    angle: 0,
    width: 50,
  },

  // --- Final boost before finish ---
  { type: 'arrow_pad', x: roadAt(600).x, y: 600, angle: 0 },
];

const startRoad = roadAt(4760);

const sundayDrive: TrackData = {
  name: 'Sunday Drive',
  difficulty: 'easy',
  road,
  obstacles,
  startLine: startLineIdx,
  finishLine: finishLineIdx,
  startPositions: {
    p1: { x: startRoad.x - 35, y: 4760, angle: Math.PI / 2 },
    p2: { x: startRoad.x + 35, y: 4760, angle: Math.PI / 2 },
  },
};

export default sundayDrive;
