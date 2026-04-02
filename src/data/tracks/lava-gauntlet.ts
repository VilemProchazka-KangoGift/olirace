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

// Segment 0: Y 5600→5000, extension before start
const seg0 = straight(240, 5600, 5000, 240);

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

// Segment 6: Y 2800→2400, FORK SECTION: widens to 380px
const seg6 = curve(210, 2800, 2400, 0, 180, 380);

// Segment 7: Y 2400→1800, S-curve (right then left), narrows back from fork
const seg7a = curve(210, 2400, 2100, 70, 380, 170, 30);
const seg7b = curve(280, 2100, 1800, -70, 170, 160, 30);
const seg7 = [...seg7a, ...seg7b.slice(1)];

// Segment 8: Y 1800→1200, straight, width 160
const seg8 = straight(210, 1800, 1200, 160);

// Segment 9: Y 1200→800, gentle right curve, width 160→200
const seg9 = curve(210, 1200, 800, 40, 160, 200);

// Segment 10: Y 800→400, straight, width 200
const seg10 = straight(250, 800, 400, 200);

// Segment 11: Extension past finish line Y=400→-600
const seg11 = straight(250, 400, -600, 200);

const road = joinSegments(seg0, seg1, seg2, seg3, seg4, seg5, seg6, seg7, seg8, seg9, seg10, seg11);

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
  // --- Arrow pad to start ---
  { type: 'arrow_pad', x: roadAt(4800).x, y: 4800, angle: 0 },

  // --- Mud zone on curve apex (drift through!) ---
  { type: 'mud_zone', x: roadAt(4600).x, y: 4600, angle: 0, width: 70 },

  // --- Destructible barrel ---
  {
    type: 'destructible',
    x: roadAt(4400).x + roadAt(4400).width * 0.2,
    y: 4400,
    angle: 0,
  },

  // --- Logs ---
  {
    type: 'log',
    x: roadAt(4100).x - roadAt(4100).width * 0.3,
    y: 4100,
    angle: 0.3,
  },
  {
    type: 'log',
    x: roadAt(3900).x + roadAt(3900).width * 0.2,
    y: 3900,
    angle: -0.2,
  },

  // --- Alternating spikes: force zigzag ---
  {
    type: 'spikes',
    x: roadAt(3700).x - roadAt(3700).width * 0.2,
    y: 3700,
    angle: 0,
    width: roadAt(3700).width * 0.5,
  },
  {
    type: 'spikes',
    x: roadAt(3500).x + roadAt(3500).width * 0.2,
    y: 3500,
    angle: 0,
    width: roadAt(3500).width * 0.5,
  },

  // --- COMBO: Arrow pad → ramp (fly over rotating spike gauntlet!) ---
  { type: 'arrow_pad', x: roadAt(3300).x, y: 3300, angle: 0 },
  { type: 'ramp', x: roadAt(3150).x, y: 3150, angle: 0 },
  // Rotating spike below the ramp — skilled players jump over
  {
    type: 'rotating_spikes',
    x: roadAt(3000).x,
    y: 3000,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 50,
    patrolSpeed: 5,
  },

  // --- Bouncy wall corridor before S-curve (chaos!) ---
  {
    type: 'bouncy_wall',
    x: roadAt(2850).x - roadAt(2850).width * 0.25,
    y: 2850,
    angle: 0.4,
  },
  {
    type: 'bouncy_wall',
    x: roadAt(2750).x + roadAt(2750).width * 0.25,
    y: 2750,
    angle: -0.3,
  },

  // === FORK SECTION (Y 2700→2500, road widens to 380px) ===
  // Center: rotating spike splits the paths
  {
    type: 'rotating_spikes',
    x: roadAt(2600).x,
    y: 2600,
    angle: 0,
    patrolAxis: 'y',
    patrolDistance: 30,
    patrolSpeed: 4,
  },
  // Left path: mud zone (drift opportunity!)
  {
    type: 'mud_zone',
    x: roadAt(2600).x - roadAt(2600).width * 0.3,
    y: 2600,
    angle: 0,
    width: 70,
  },
  // Left path: arrow pad at exit (mud catapult!)
  {
    type: 'arrow_pad',
    x: roadAt(2500).x - roadAt(2500).width * 0.25,
    y: 2500,
    angle: 0,
  },
  // Right path: destructibles (smash for micro-boost)
  {
    type: 'destructible',
    x: roadAt(2650).x + roadAt(2650).width * 0.25,
    y: 2650,
    angle: 0,
  },
  {
    type: 'destructible',
    x: roadAt(2550).x + roadAt(2550).width * 0.25,
    y: 2550,
    angle: 0,
  },
  // === END FORK ===

  // --- S-curve: angled arrow pad (diagonal slingshot!) ---
  { type: 'arrow_pad', x: roadAt(2200).x, y: 2200, angle: 0.4 },

  // --- Ramp in S-curve ---
  { type: 'ramp', x: roadAt(2000).x, y: 2000, angle: 0 },

  // --- Mud on S-curve apex (drift opportunity) ---
  { type: 'mud_zone', x: roadAt(1900).x, y: 1900, angle: 0, width: 60 },

  // --- Rotating spike gauntlet (pair on opposite sides) ---
  {
    type: 'rotating_spikes',
    x: roadAt(1700).x - roadAt(1700).width * 0.2,
    y: 1700,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 35,
    patrolSpeed: 5.5,
  },
  {
    type: 'rotating_spikes',
    x: roadAt(1500).x + roadAt(1500).width * 0.2,
    y: 1500,
    angle: 0,
    patrolAxis: 'x',
    patrolDistance: 35,
    patrolSpeed: 5,
  },

  // --- Logs ---
  { type: 'log', x: roadAt(1300).x, y: 1300, angle: 0.1 },

  // --- Bouncy wall before final stretch ---
  {
    type: 'bouncy_wall',
    x: roadAt(1100).x - roadAt(1100).width * 0.25,
    y: 1100,
    angle: -0.3,
  },

  // --- Final boost ---
  { type: 'arrow_pad', x: roadAt(900).x, y: 900, angle: 0 },
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
    p1: { x: startRoad.x - 45, y: 4960, angle: Math.PI / 2 },
    p2: { x: startRoad.x - 15, y: 4960, angle: Math.PI / 2 },
    p3: { x: startRoad.x + 15, y: 4960, angle: Math.PI / 2 },
    p4: { x: startRoad.x + 45, y: 4960, angle: Math.PI / 2 },
  },
};

export default lavaGauntlet;
