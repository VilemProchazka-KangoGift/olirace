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

// === DEVIL'S HIGHWAY: Hard, narrow, punishing ===
// Total length: ~5500px (Y: 5800 → 300)

// Seg 1: Y 5800→5500 - Short starting straight, width 180 (the widest you'll get)
const seg1 = straight(240, 5800, 5500, 180);

// Seg 2: Y 5500→5100 - Tight right curve, width 180→150
const seg2 = curve(240, 5500, 5100, 70, 180, 150);

// Seg 3: Y 5100→4700 - Tight left curve (hairpin feel), width 150→130
const seg3 = curve(310, 5100, 4700, -100, 150, 130);

// Seg 4: Y 4700→4400 - Short straight, width 130
const seg4 = straight(210, 4700, 4400, 130);

// Seg 5: Y 4400→3900 - S-curve right-left, width 130→120 (narrowest!)
const seg5a = curve(210, 4400, 4150, 80, 130, 125, 25);
const seg5b = curve(290, 4150, 3900, -70, 125, 120, 25);
const seg5 = [...seg5a, ...seg5b.slice(1)];

// Seg 6: Y 3900→3500 - Straight, width 120 (the gauntlet)
const seg6 = straight(220, 3900, 3500, 120);

// Seg 7: Y 3500→3100 - Left hairpin, width 120→140
const seg7 = curve(220, 3500, 3100, -90, 120, 140);

// Seg 8: Y 3100→2700 - Right hairpin, width 140→130
const seg8 = curve(130, 3100, 2700, 110, 140, 130);

// Seg 9: Y 2700→2300 - Straight, width 130
const seg9 = straight(240, 2700, 2300, 130);

// Seg 10: Y 2300→1800 - Triple S-curve, width 130→140
const seg10a = curve(240, 2300, 2100, 60, 130, 130, 25);
const seg10b = curve(300, 2100, 1900, -80, 130, 135, 25);
const seg10c = curve(220, 1900, 1800, 40, 135, 140, 25);
const seg10 = [...seg10a, ...seg10b.slice(1), ...seg10c.slice(1)];

// Seg 11: Y 1800→1400 - Straight, width 140
const seg11 = straight(260, 1800, 1400, 140);

// Seg 12: Y 1400→1000 - Tight left curve, width 140→150
const seg12 = curve(260, 1400, 1000, -70, 140, 150);

// Seg 13: Y 1000→600 - Straight, width 150→160 (slight widening for finish approach)
const seg13 = curve(190, 1000, 600, 30, 150, 160, 30);

// Seg 14: Y 600→300 - Final straight, width 160
const seg14 = straight(220, 600, 300, 160);

// Segment 15: Extension past finish line Y=300→-100
const seg15 = straight(220, 300, -100, 160);

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

const startLineIdx = indexAtY(5800);
const finishLineIdx = indexAtY(400);

const obstacles: ObstaclePlacement[] = [
  // --- Seg 1: Arrow pad to start ---
  { type: 'arrow_pad', x: roadAt(5650).x, y: 5650, angle: 0 },

  // --- Destructible barrel blocking part of narrow curve ---
  {
    type: 'destructible',
    x: roadAt(5475).x + roadAt(5475).width * 0.15,
    y: 5475,
    angle: 0,
  },

  // --- Seg 2: Spike strip on outside of curve ---
  {
    type: 'spikes',
    x: roadAt(5300).x + roadAt(5300).width * 0.2,
    y: 5300,
    angle: 0,
    width: roadAt(5300).width * 0.35,
  },

  // --- Mud zone at hairpin apex — punishes bad lines ---
  { type: 'mud_zone', x: roadAt(5150).x, y: 5150, angle: 0, width: 40 },

  // --- Seg 3: Log then rotating spike in the hairpin ---
  {
    type: 'log',
    x: roadAt(5000).x - roadAt(5000).width * 0.2,
    y: 5000,
    angle: 0.4,
  },
  // Spike ball swings wide (65px patrol = partially off-road, creates clear window)
  {
    type: 'rotating_spikes',
    x: roadAt(4800).x,
    y: 4800,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 65,
    patrolSpeed: 3.5,
  },

  // --- Seg 4: Spike strip ---
  {
    type: 'spikes',
    x: roadAt(4550).x - roadAt(4550).width * 0.15,
    y: 4550,
    angle: 0,
    width: roadAt(4550).width * 0.3,
  },

  // --- Mud zone at S-curve apex ---
  { type: 'mud_zone', x: roadAt(4375).x, y: 4375, angle: 0, width: 40 },

  // --- Seg 5: S-curve with log ---
  {
    type: 'log',
    x: roadAt(4200).x + roadAt(4200).width * 0.15,
    y: 4200,
    angle: -0.3,
  },
  // Spike ball with wide swing on narrow S-curve
  {
    type: 'rotating_spikes',
    x: roadAt(3950).x,
    y: 3950,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 60,
    patrolSpeed: 3,
  },

  // --- Seg 6: The gauntlet (narrowest section) ---
  { type: 'arrow_pad', x: roadAt(3750).x, y: 3750, angle: 0 },
  // Alternating spike walls — narrow, well spaced
  {
    type: 'spikes',
    x: roadAt(3600).x - roadAt(3600).width * 0.2,
    y: 3600,
    angle: 0,
    width: roadAt(3600).width * 0.3,
  },
  {
    type: 'spikes',
    x: roadAt(3400).x + roadAt(3400).width * 0.2,
    y: 3400,
    angle: 0,
    width: roadAt(3400).width * 0.3,
  },

  // --- Seg 7-8: Hairpin pair — fewer obstacles, more spaced ---
  {
    type: 'log',
    x: roadAt(3250).x,
    y: 3250,
    angle: -0.5,
  },
  // Wide-swinging spike ball at hairpin apex
  {
    type: 'rotating_spikes',
    x: roadAt(3000).x,
    y: 3000,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 70,
    patrolSpeed: 3,
  },
  {
    type: 'log',
    x: roadAt(2800).x + roadAt(2800).width * 0.15,
    y: 2800,
    angle: 0.3,
  },

  // --- Seg 9: Straight of death ---
  { type: 'arrow_pad', x: roadAt(2650).x, y: 2650, angle: 0 },
  // Single rotating spike — wide patrol, slow
  {
    type: 'rotating_spikes',
    x: roadAt(2450).x,
    y: 2450,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 60,
    patrolSpeed: 3.5,
  },

  // --- Seg 10: Triple S-curve ---
  {
    type: 'log',
    x: roadAt(2200).x,
    y: 2200,
    angle: 0.4,
  },
  {
    type: 'spikes',
    x: roadAt(2000).x + roadAt(2000).width * 0.15,
    y: 2000,
    angle: 0,
    width: roadAt(2000).width * 0.35,
  },
  // Wide-swinging spike ball
  {
    type: 'rotating_spikes',
    x: roadAt(1850).x,
    y: 1850,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 65,
    patrolSpeed: 3,
  },

  // --- Seg 11: Straight gauntlet ---
  { type: 'arrow_pad', x: roadAt(1700).x, y: 1700, angle: 0 },
  {
    type: 'spikes',
    x: roadAt(1550).x - roadAt(1550).width * 0.15,
    y: 1550,
    angle: 0,
    width: roadAt(1550).width * 0.35,
  },
  {
    type: 'log',
    x: roadAt(1400).x + roadAt(1400).width * 0.2,
    y: 1400,
    angle: -0.4,
  },

  // --- Seg 12: Tight curve with rotating spike at apex ---
  {
    type: 'rotating_spikes',
    x: roadAt(1200).x,
    y: 1200,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 65,
    patrolSpeed: 3.5,
  },

  // --- Ramp as escape route — fly over the spike strip at Y=900! ---
  { type: 'ramp', x: roadAt(1050).x, y: 1050, angle: 0 },

  // --- Seg 13: Approach to finish ---
  {
    type: 'spikes',
    x: roadAt(900).x - roadAt(900).width * 0.1,
    y: 900,
    angle: 0,
    width: roadAt(900).width * 0.3,
  },

  // --- Bouncy wall at hairpin exit before final gauntlet ---
  {
    type: 'bouncy_wall',
    x: roadAt(700).x + roadAt(700).width * 0.25,
    y: 700,
    angle: 0.4,
  },

  // --- Seg 14: Final straight ---
  {
    type: 'rotating_spikes',
    x: roadAt(500).x,
    y: 500,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 60,
    patrolSpeed: 3.5,
  },
];

const startRoad = roadAt(5760);

const devilsHighway: TrackData = {
  name: "Devil's Highway",
  difficulty: 'hard',
  road,
  obstacles,
  startLine: startLineIdx,
  finishLine: finishLineIdx,
  startPositions: {
    p1: { x: startRoad.x - 38, y: 5760, angle: Math.PI / 2 },
    p2: { x: startRoad.x - 13, y: 5760, angle: Math.PI / 2 },
    p3: { x: startRoad.x + 13, y: 5760, angle: Math.PI / 2 },
    p4: { x: startRoad.x + 38, y: 5760, angle: Math.PI / 2 },
  },
};

export default devilsHighway;
