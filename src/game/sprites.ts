import { getCharacter } from '../data/characters';
import { COLORS } from '../utils/constants';

// ── Sprite cache ─────────────────────────────────────────────────────
const playerSpriteCache = new Map<string, HTMLCanvasElement>();
const lavaTileCache = new Map<number, HTMLCanvasElement>();
const obstacleSpriteCache = new Map<string, HTMLCanvasElement>();

function cacheKey(char: string, palette: string, dir: number): string {
  return `${char}_${palette}_${dir}`;
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Set a single pixel on an ImageData buffer. */
function setPixel(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/** Simple seeded pseudo-random (good enough for deterministic tiles). */
function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s >>> 16) / 32768;
  };
}

// ── Lava tile generator (32x32) ──────────────────────────────────────
const LAVA_TILE_SIZE = 32;

export function generateLavaTile(frame: number): HTMLCanvasElement {
  const cached = lavaTileCache.get(frame);
  if (cached) return cached;

  const c = createCanvas(LAVA_TILE_SIZE, LAVA_TILE_SIZE);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(LAVA_TILE_SIZE, LAVA_TILE_SIZE);
  const d = img.data;

  const baseR = hexToRgb(COLORS.lavaMid);
  const hiR = hexToRgb(COLORS.lavaBright);
  const glowR = hexToRgb(COLORS.lavaGlow);
  const darkR = hexToRgb(COLORS.lavaDark);

  const rng = seeded(42 + frame * 1337);

  for (let y = 0; y < LAVA_TILE_SIZE; y++) {
    for (let x = 0; x < LAVA_TILE_SIZE; x++) {
      // Procedural bubbling pattern using simple noise
      const fx = x + frame * 3.7;
      const fy = y + frame * 2.3;
      const n1 = Math.sin(fx * 0.4 + fy * 0.3) * 0.5 + 0.5;
      const n2 = Math.sin(fx * 0.7 - fy * 0.5 + 2.1) * 0.5 + 0.5;
      const n3 = Math.sin((fx + fy) * 0.2 + frame * 1.1) * 0.5 + 0.5;
      const v = (n1 + n2 * 0.6 + n3 * 0.4) / 2.0;

      let r: number, g: number, b: number;
      if (v < 0.35) {
        // dark crust
        const t = v / 0.35;
        r = darkR[0] + (baseR[0] - darkR[0]) * t;
        g = darkR[1] + (baseR[1] - darkR[1]) * t;
        b = darkR[2] + (baseR[2] - darkR[2]) * t;
      } else if (v < 0.65) {
        // mid lava
        const t = (v - 0.35) / 0.3;
        r = baseR[0] + (hiR[0] - baseR[0]) * t;
        g = baseR[1] + (hiR[1] - baseR[1]) * t;
        b = baseR[2] + (hiR[2] - baseR[2]) * t;
      } else {
        // bright glow
        const t = (v - 0.65) / 0.35;
        r = hiR[0] + (glowR[0] - hiR[0]) * t;
        g = hiR[1] + (glowR[1] - hiR[1]) * t;
        b = hiR[2] + (glowR[2] - hiR[2]) * t;
      }

      // Random speckling for texture
      const speck = (rng() - 0.5) * 20;
      r = Math.max(0, Math.min(255, r + speck));
      g = Math.max(0, Math.min(255, g + speck * 0.6));
      b = Math.max(0, Math.min(255, b + speck * 0.3));

      setPixel(d, LAVA_TILE_SIZE, x, y, r | 0, g | 0, b | 0);
    }
  }

  ctx.putImageData(img, 0, 0);
  lavaTileCache.set(frame, c);
  return c;
}

// ── Player sprite generator (48x48) ─────────────────────────────────
const SPRITE_SIZE = 48;

export function generatePlayerSprite(
  characterId: string,
  palette: 'primary' | 'rival',
  direction: number,
): HTMLCanvasElement {
  const key = cacheKey(characterId, palette, direction);
  const cached = playerSpriteCache.get(key);
  if (cached) return cached;

  const char = getCharacter(characterId);
  const color = palette === 'primary' ? char.primaryColor : char.rivalColor;
  const [cr, cg, cb] = hexToRgb(color);

  const c = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
  const d = img.data;

  // Shadow / outline color
  const sr = Math.max(0, cr - 80);
  const sg = Math.max(0, cg - 80);
  const sb = Math.max(0, cb - 80);

  // Highlight
  const hr = Math.min(255, cr + 60);
  const hg = Math.min(255, cg + 60);
  const hb = Math.min(255, cb + 60);

  // Direction determines rotation (0=N, 1=NE ... 7=NW)
  // We draw the car facing up (north) then conceptually apply rotation via
  // pattern placement. For pixel art we draw a pre-rotated look per direction.
  const angle = (direction * Math.PI) / 4;

  // Helper: plot a rotated pixel around center
  const cx = SPRITE_SIZE / 2;
  const cy = SPRITE_SIZE / 2;

  const plot = (
    ox: number,
    oy: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ) => {
    // Rotate around center
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const rx = Math.round(cx + ox * cosA - oy * sinA);
    const ry = Math.round(cy + ox * sinA + oy * cosA);
    if (rx >= 0 && rx < SPRITE_SIZE && ry >= 0 && ry < SPRITE_SIZE) {
      setPixel(d, SPRITE_SIZE, rx, ry, r, g, b, a);
    }
  };

  // Fill helper: fill a rectangle relative to center, rotated
  const fillRect = (
    x1: number,
    y1: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        plot(x1 + dx, y1 + dy, r, g, b, a);
      }
    }
  };

  // Fill circle helper
  const fillCircle = (
    ccx: number,
    ccy: number,
    rad: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ) => {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy <= rad * rad) {
          plot(ccx + dx, ccy + dy, r, g, b, a);
        }
      }
    }
  };

  // Fill oval helper
  const fillOval = (
    ccx: number,
    ccy: number,
    radX: number,
    radY: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ) => {
    for (let dy = -radY; dy <= radY; dy++) {
      for (let dx = -radX; dx <= radX; dx++) {
        if ((dx * dx) / (radX * radX) + (dy * dy) / (radY * radY) <= 1) {
          plot(ccx + dx, ccy + dy, r, g, b, a);
        }
      }
    }
  };

  switch (characterId) {
    case 'formula': {
      // Sleek F1-style racer
      // Body - narrow elongated
      fillRect(-5, -12, 9, 24, cr, cg, cb);
      // Nose cone
      fillRect(-3, -15, 6, 5, hr, hg, hb);
      fillRect(-2, -18, 3, 3, hr, hg, hb);
      // Rear wing
      fillRect(-9, 8, 18, 3, sr, sg, sb);
      fillRect(-8, 6, 15, 2, sr, sg, sb);
      // Front wing
      fillRect(-8, -14, 15, 2, sr, sg, sb);
      // Cockpit
      fillRect(-3, -5, 6, 6, 40, 40, 50);
      fillRect(-2, -3, 3, 3, 80, 80, 100);
      // Wheels
      fillRect(-9, -9, 3, 6, 30, 30, 30);
      fillRect(6, -9, 3, 6, 30, 30, 30);
      fillRect(-9, 5, 3, 6, 30, 30, 30);
      fillRect(6, 5, 3, 6, 30, 30, 30);
      // Exhaust pipes
      plot(2, 11, 100, 100, 110);
      plot(-2, 11, 100, 100, 110);
      break;
    }

    case 'yeti': {
      // Boxy SUV shape
      // Body - wide boxy
      fillRect(-11, -11, 21, 24, cr, cg, cb);
      // Roof - slightly inset
      fillRect(-8, -8, 15, 15, hr, hg, hb);
      // Windshield
      fillRect(-6, -9, 12, 5, 100, 140, 180);
      fillRect(-5, -8, 9, 3, 140, 180, 220);
      // Rear window
      fillRect(-6, 6, 12, 3, 80, 120, 160);
      // Bumpers
      fillRect(-11, -12, 21, 3, sr, sg, sb);
      fillRect(-11, 12, 21, 3, sr, sg, sb);
      // Headlights
      plot(-8, -12, 255, 255, 200);
      plot(6, -12, 255, 255, 200);
      // Taillights
      plot(-8, 14, 255, 40, 40);
      plot(6, 14, 255, 40, 40);
      // Wheels - big chunky
      fillRect(-12, -8, 3, 6, 30, 30, 30);
      fillRect(9, -8, 3, 6, 30, 30, 30);
      fillRect(-12, 5, 3, 6, 30, 30, 30);
      fillRect(9, 5, 3, 6, 30, 30, 30);
      // Side stripe
      fillRect(-11, 0, 2, 2, 255, 255, 255);
      fillRect(9, 0, 2, 2, 255, 255, 255);
      break;
    }

    case 'cat': {
      // Round cat shape with ears
      // Body circle
      fillCircle(0, 0, 11, cr, cg, cb);
      // Highlight belly
      fillCircle(0, 2, 6, hr, hg, hb);
      // Ears (triangular)
      fillRect(-9, -14, 5, 5, cr, cg, cb);
      fillRect(-8, -15, 3, 3, cr, cg, cb);
      fillRect(5, -14, 5, 5, cr, cg, cb);
      fillRect(5, -15, 3, 3, cr, cg, cb);
      // Inner ears
      plot(-8, -14, hr, hg, hb);
      plot(6, -14, hr, hg, hb);
      // Eyes
      plot(-5, -5, 40, 40, 40);
      plot(3, -5, 40, 40, 40);
      plot(-5, -6, 200, 220, 200);
      plot(3, -6, 200, 220, 200);
      // Nose
      plot(0, -2, 255, 140, 160);
      // Whiskers
      plot(-8, -2, 180, 180, 180);
      plot(-9, -3, 180, 180, 180);
      plot(6, -2, 180, 180, 180);
      plot(8, -3, 180, 180, 180);
      // Wheels (small, cat cart)
      fillRect(-11, -5, 3, 3, 30, 30, 30);
      fillRect(8, -5, 3, 3, 30, 30, 30);
      fillRect(-11, 6, 3, 3, 30, 30, 30);
      fillRect(8, 6, 3, 3, 30, 30, 30);
      // Tail
      plot(5, 11, cr, cg, cb);
      plot(6, 12, cr, cg, cb);
      plot(8, 11, cr, cg, cb);
      break;
    }

    case 'pig': {
      // Round pink shape
      // Body
      fillCircle(0, 0, 12, cr, cg, cb);
      // Highlight
      fillCircle(-3, -3, 5, hr, hg, hb);
      // Snout
      fillOval(0, -3, 5, 3, Math.min(255, cr + 30), cg, Math.min(255, cb + 20));
      // Nostrils
      plot(-2, -3, sr, sg, sb);
      plot(2, -3, sr, sg, sb);
      // Eyes
      plot(-5, -8, 40, 40, 40);
      plot(5, -8, 40, 40, 40);
      // Ears
      fillRect(-9, -12, 5, 5, Math.min(255, cr + 15), cg, cb);
      fillRect(5, -12, 5, 5, Math.min(255, cr + 15), cg, cb);
      // Wheels
      fillRect(-12, -5, 3, 5, 30, 30, 30);
      fillRect(9, -5, 3, 5, 30, 30, 30);
      fillRect(-12, 5, 3, 5, 30, 30, 30);
      fillRect(9, 5, 3, 5, 30, 30, 30);
      // Curly tail
      plot(0, 12, cr, cg, cb);
      plot(2, 14, cr, cg, cb);
      plot(0, 15, cr, cg, cb);
      break;
    }

    case 'frog': {
      // Green oval with big eyes
      // Body oval
      fillOval(0, 0, 11, 12, cr, cg, cb);
      // Lighter belly
      fillOval(0, 3, 6, 6, hr, hg, hb);
      // Big eyes (protruding at top)
      fillCircle(-6, -12, 5, cr, cg, cb);
      fillCircle(6, -12, 5, cr, cg, cb);
      // Eye whites
      fillCircle(-6, -12, 3, 220, 230, 220);
      fillCircle(6, -12, 3, 220, 230, 220);
      // Pupils
      plot(-6, -12, 20, 20, 20);
      plot(6, -12, 20, 20, 20);
      // Mouth line
      fillRect(-6, 2, 12, 2, sr, sg, sb);
      // Leg spots
      plot(-9, 6, sr, sg, sb);
      plot(9, 6, sr, sg, sb);
      // Wheels
      fillRect(-12, -5, 3, 5, 30, 30, 30);
      fillRect(9, -5, 3, 5, 30, 30, 30);
      fillRect(-12, 6, 3, 5, 30, 30, 30);
      fillRect(9, 6, 3, 5, 30, 30, 30);
      break;
    }

    default: {
      // Fallback generic car
      fillRect(-8, -11, 15, 21, cr, cg, cb);
      fillRect(-6, -8, 12, 8, hr, hg, hb);
      fillRect(-9, -8, 3, 6, 30, 30, 30);
      fillRect(6, -8, 3, 6, 30, 30, 30);
      fillRect(-9, 5, 3, 6, 30, 30, 30);
      fillRect(6, 5, 3, 6, 30, 30, 30);
      break;
    }
  }

  ctx.putImageData(img, 0, 0);
  playerSpriteCache.set(key, c);
  return c;
}

// ── Obstacle sprite generator ────────────────────────────────────────

export function generateObstacleSprite(
  type: string,
  frame = 0,
): HTMLCanvasElement {
  const key = `${type}_${frame}`;
  const cached = obstacleSpriteCache.get(key);
  if (cached) return cached;

  let c: HTMLCanvasElement;

  switch (type) {
    case 'arrow_pad':
      c = generateArrowPad(frame);
      break;
    case 'spikes':
      c = generateSpikes();
      break;
    case 'log':
      c = generateLog();
      break;
    case 'rotating_spikes':
      c = generateRotatingSpikes(frame);
      break;
    default:
      c = createCanvas(32, 32);
      break;
  }

  obstacleSpriteCache.set(key, c);
  return c;
}

function generateArrowPad(frame: number): HTMLCanvasElement {
  const W = 64;
  const H = 48;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  // Glow pulse: 3 frames at 6 FPS
  const pulse = [0.6, 0.8, 1.0][frame % 3];

  const greenR = hexToRgb(COLORS.green);
  const cyanR = hexToRgb(COLORS.cyan);

  // Base pad
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Border
      if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) {
        const gv = Math.round(pulse * 255);
        setPixel(d, W, x, y, 0, gv, Math.round(gv * 0.8));
        continue;
      }
      // Interior - dark green
      setPixel(d, W, x, y, 10, 40, 20);
    }
  }

  // Arrow chevrons - three rows of chevron pointing up
  const arrowColor = [
    Math.round(cyanR[0] * pulse),
    Math.round(cyanR[1] * pulse),
    Math.round(cyanR[2] * pulse),
  ] as const;

  for (let row = 0; row < 3; row++) {
    const baseY = 8 + row * 12;
    for (let i = 0; i < 8; i++) {
      // Left side of chevron
      const lx = W / 2 - 1 - i;
      const ly = baseY + i;
      if (lx >= 2 && ly < H - 2) {
        setPixel(d, W, lx, ly, arrowColor[0], arrowColor[1], arrowColor[2]);
        setPixel(d, W, lx, ly + 1, arrowColor[0], arrowColor[1], arrowColor[2]);
      }
      // Right side of chevron
      const rx = W / 2 + i;
      if (rx < W - 2 && ly < H - 2) {
        setPixel(d, W, rx, ly, arrowColor[0], arrowColor[1], arrowColor[2]);
        setPixel(d, W, rx, ly + 1, arrowColor[0], arrowColor[1], arrowColor[2]);
      }
    }
  }

  // Glow overlay for pulsing effect
  const glowStr = (pulse - 0.6) / 0.4; // 0..1
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = (y * W + x) * 4;
      d[i + 1] = Math.min(255, d[i + 1] + Math.round(glowStr * 30));
      d[i + 2] = Math.min(255, d[i + 2] + Math.round(glowStr * 20));
    }
  }

  ctx.putImageData(img, 0, 0);
  return c;
}

function generateSpikes(): HTMLCanvasElement {
  const W = 48;
  const H = 32;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const metalC = hexToRgb(COLORS.metal);
  const metalLC = hexToRgb(COLORS.metalLight);

  // Draw a row of triangular spikes
  const spikeCount = 6;
  const spikeW = W / spikeCount;

  for (let s = 0; s < spikeCount; s++) {
    const baseX = Math.round(s * spikeW);
    const tipX = Math.round(baseX + spikeW / 2);

    for (let y = 0; y < H; y++) {
      // Width of spike at this height
      const t = y / H; // 0 at top, 1 at bottom
      const halfW = (spikeW / 2) * t;
      const left = Math.round(tipX - halfW);
      const right = Math.round(tipX + halfW);

      for (let x = left; x <= right && x < W; x++) {
        if (x < 0) continue;
        // Shade: lighter at tip, darker at base; edge highlight
        const fromEdge = Math.min(x - left, right - x) / Math.max(1, right - left);
        const shade = (1 - t) * 0.4 + fromEdge * 0.6;
        const r = Math.round(metalC[0] + (metalLC[0] - metalC[0]) * shade);
        const g = Math.round(metalC[1] + (metalLC[1] - metalC[1]) * shade);
        const b = Math.round(metalC[2] + (metalLC[2] - metalC[2]) * shade);
        setPixel(d, W, x, y, r, g, b);
      }
    }
    // Sharp tip highlight
    if (tipX >= 0 && tipX < W) {
      setPixel(d, W, tipX, 0, 220, 230, 240);
      if (tipX + 1 < W) setPixel(d, W, tipX, 1, 200, 210, 220);
    }
  }

  // Base plate
  for (let x = 0; x < W; x++) {
    setPixel(d, W, x, H - 1, 60, 60, 70);
    setPixel(d, W, x, H - 2, 70, 70, 80);
  }

  ctx.putImageData(img, 0, 0);
  return c;
}

function generateLog(): HTMLCanvasElement {
  const W = 80;
  const H = 20;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const brownC = hexToRgb(COLORS.brown);
  const brownLC = hexToRgb(COLORS.brownLight);
  const rng = seeded(777);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Cylindrical shading: brighter in center vertically
      const vy = Math.abs(y - H / 2) / (H / 2);
      const shade = 1 - vy * 0.5;

      // Bark texture: horizontal streaks
      const streak = Math.sin(x * 0.8 + y * 0.3) * 0.15 + 0.85;
      const bark = shade * streak;

      const r = Math.round(brownC[0] + (brownLC[0] - brownC[0]) * bark);
      const g = Math.round(brownC[1] + (brownLC[1] - brownC[1]) * bark);
      const b = Math.round(brownC[2] + (brownLC[2] - brownC[2]) * bark);

      // Random knots
      const speck = (rng() - 0.5) * 12;
      setPixel(
        d,
        W,
        x,
        y,
        Math.max(0, Math.min(255, r + speck)) | 0,
        Math.max(0, Math.min(255, g + speck)) | 0,
        Math.max(0, Math.min(255, b + speck * 0.5)) | 0,
      );
    }
  }

  // End rings (circular cross-section at ends)
  for (let y = 0; y < H; y++) {
    const vy = (y - H / 2) / (H / 2);
    if (Math.abs(vy) < 0.9) {
      // Left end ring
      setPixel(d, W, 0, y, 90, 65, 35);
      setPixel(d, W, 1, y, 85, 60, 30);
      // Right end ring
      setPixel(d, W, W - 1, y, 90, 65, 35);
      setPixel(d, W, W - 2, y, 85, 60, 30);
    }
  }

  // Top highlight
  for (let x = 2; x < W - 2; x++) {
    const i = (1 * W + x) * 4;
    d[i] = Math.min(255, d[i] + 25);
    d[i + 1] = Math.min(255, d[i + 1] + 20);
    d[i + 2] = Math.min(255, d[i + 2] + 10);
  }

  ctx.putImageData(img, 0, 0);
  return c;
}

function generateRotatingSpikes(frame: number): HTMLCanvasElement {
  const SIZE = 48;
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 22;
  const innerR = 10;
  const teethCount = 8;
  const rotAngle = (frame * Math.PI * 2) / 24; // smooth rotation over 24 frames

  // Draw saw blade
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) + rotAngle;

      if (dist > outerR + 2) continue;

      // Teeth pattern: outer radius varies with angle
      const toothAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const toothPhase = (toothAngle / (Math.PI * 2)) * teethCount;
      const toothFrac = toothPhase - Math.floor(toothPhase);
      const toothRadius =
        innerR + (outerR - innerR) * (toothFrac < 0.5 ? toothFrac * 2 : (1 - toothFrac) * 2);

      if (dist > toothRadius) continue;

      // Color: red center, orange teeth
      const t = dist / outerR;
      if (dist < innerR * 0.6) {
        // Center hub - dark metal
        setPixel(d, SIZE, x, y, 60, 60, 70);
      } else if (dist < innerR) {
        // Inner disc - dark red
        setPixel(d, SIZE, x, y, 160, 30, 20);
      } else {
        // Teeth - gradient from red to orange
        const tr = Math.round(200 + 55 * t);
        const tg = Math.round(50 + 80 * t);
        const tb = 20;
        setPixel(d, SIZE, x, y, Math.min(255, tr), tg, tb);
      }

      // Edge highlight on teeth
      if (Math.abs(dist - toothRadius) < 1.5 && dist > innerR) {
        setPixel(d, SIZE, x, y, 255, 180, 60);
      }
    }
  }

  // Center axle
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy <= 4) {
        setPixel(d, SIZE, cx + dx, cy + dy, 100, 100, 110);
      }
    }
  }
  setPixel(d, SIZE, cx, cy, 140, 140, 150);

  ctx.putImageData(img, 0, 0);
  return c;
}

export function clearSpriteCache(): void {
  playerSpriteCache.clear();
  lavaTileCache.clear();
  obstacleSpriteCache.clear();
}
