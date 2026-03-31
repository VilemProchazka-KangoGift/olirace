import { getCharacter } from '../data/characters';
import { COLORS } from '../utils/constants';

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Darken (negative amount) or lighten (positive amount) a hex color.
 * Amount is in the range -255..+255.
 */
function colorShade(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return (
    '#' +
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  );
}

/** Simple seeded pseudo-random (deterministic per seed). */
function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s >>> 16) / 32768;
  };
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Draw a rounded rectangle path. Does NOT fill/stroke — caller decides.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const mr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + mr, y);
  ctx.lineTo(x + w - mr, y);
  ctx.arcTo(x + w, y, x + w, y + mr, mr);
  ctx.lineTo(x + w, y + h - mr);
  ctx.arcTo(x + w, y + h, x + w - mr, y + h, mr);
  ctx.lineTo(x + mr, y + h);
  ctx.arcTo(x, y + h, x, y + h - mr, mr);
  ctx.lineTo(x, y + mr);
  ctx.arcTo(x, y, x + mr, y, mr);
  ctx.closePath();
}

// ── 1. drawPlayerVector ─────────────────────────────────────────────

/**
 * Draws a player character centered at (0,0) at the given size.
 * The caller is responsible for ctx.save/translate/rotate/restore.
 */
export function drawPlayerVector(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  palette: 'primary' | 'rival',
  size = 48,
): void {
  const char = getCharacter(characterId);
  const color = palette === 'primary' ? char.primaryColor : char.rivalColor;
  const shadow = colorShade(color, -60);
  const highlight = colorShade(color, 60);
  // Scaling factor: the SVG viewBox was 56, so we scale from a 56-unit
  // design space down to `size`.
  const s = size / 56;

  ctx.save();
  ctx.scale(s, s);
  // Origin is now at the center of the 56x56 design space, which is (28,28).
  ctx.translate(-28, -28);

  switch (characterId) {
    case 'formula':
      drawFormula(ctx, color, shadow, highlight);
      break;
    case 'yeti':
      drawYeti(ctx, color, shadow, highlight);
      break;
    case 'cat':
      drawCat(ctx, color, shadow, highlight);
      break;
    case 'pig':
      drawPig(ctx, color, shadow, highlight);
      break;
    case 'frog':
      drawFrog(ctx, color, shadow, highlight);
      break;
    case 'toilet':
      drawToilet(ctx, color, shadow, highlight);
      break;
    default:
      drawDefaultCar(ctx, color, shadow);
      break;
  }

  ctx.restore();
}

// ── Formula: Sleek narrow F1 race car ───────────────────────────────

function drawFormula(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Rear wing --
  ctx.fillStyle = COLORS.darkGray;
  roundRect(ctx, 12, 44, 32, 4, 1);
  ctx.fill();
  ctx.fillStyle = COLORS.midGray;
  roundRect(ctx, 14, 42, 28, 3, 1);
  ctx.fill();

  // -- Body - sleek elongated --
  ctx.fillStyle = color;
  roundRect(ctx, 21, 8, 14, 38, 4);
  ctx.fill();

  // -- Nose cone (triangle) --
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(28, 2);
  ctx.lineTo(22, 14);
  ctx.lineTo(34, 14);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Front wing --
  ctx.fillStyle = COLORS.midGray;
  roundRect(ctx, 12, 12, 32, 3, 1);
  ctx.fill();

  // -- Cockpit --
  ctx.fillStyle = COLORS.black;
  roundRect(ctx, 24, 20, 8, 10, 2);
  ctx.fill();
  ctx.fillStyle = '#3a3a5a';
  roundRect(ctx, 25, 22, 6, 6, 1);
  ctx.fill();

  // -- Wheels --
  ctx.fillStyle = COLORS.darkGray;
  roundRect(ctx, 12, 14, 6, 10, 2);
  ctx.fill();
  roundRect(ctx, 38, 14, 6, 10, 2);
  ctx.fill();
  roundRect(ctx, 12, 34, 6, 10, 2);
  ctx.fill();
  roundRect(ctx, 38, 34, 6, 10, 2);
  ctx.fill();

  // -- Side air intakes --
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  roundRect(ctx, 19, 30, 3, 5, 1);
  ctx.fill();
  roundRect(ctx, 34, 30, 3, 5, 1);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Exhaust pipes --
  ctx.fillStyle = COLORS.lightGray;
  ctx.beginPath();
  ctx.arc(26, 48, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(30, 48, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // -- Highlight stripe along body center --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.25;
  roundRect(ctx, 26, 10, 4, 32, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Shadow on lower body --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.2;
  roundRect(ctx, 21, 36, 14, 8, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Yeti: Boxy tall SUV ────────────────────────────────────────────

function drawYeti(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Main body --
  ctx.fillStyle = color;
  roundRect(ctx, 10, 14, 36, 32, 3);
  ctx.fill();

  // -- Roof rack bars --
  ctx.fillStyle = COLORS.metal;
  roundRect(ctx, 14, 10, 28, 3, 1);
  ctx.fill();
  // Rack posts
  ctx.fillRect(18, 8, 2, 4);
  ctx.fillRect(36, 8, 2, 4);

  // -- Roof area (lighter) --
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  roundRect(ctx, 14, 12, 28, 16, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Windshield --
  ctx.fillStyle = '#88aace';
  ctx.globalAlpha = 0.6;
  roundRect(ctx, 16, 14, 24, 10, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Rear window --
  ctx.fillStyle = '#6688aa';
  ctx.globalAlpha = 0.5;
  roundRect(ctx, 18, 32, 20, 6, 1);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Bumpers --
  ctx.fillStyle = COLORS.metal;
  roundRect(ctx, 10, 12, 36, 3, 1);
  ctx.fill();
  roundRect(ctx, 10, 44, 36, 3, 1);
  ctx.fill();

  // -- Headlights (yellow circles) --
  ctx.fillStyle = '#e0c000';
  ctx.beginPath();
  ctx.arc(14, 13, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(42, 13, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // -- Taillights (red rects) --
  ctx.fillStyle = '#e02020';
  roundRect(ctx, 11, 44, 5, 2, 1);
  ctx.fill();
  roundRect(ctx, 40, 44, 5, 2, 1);
  ctx.fill();

  // -- Wheels - big chunky --
  ctx.fillStyle = COLORS.darkGray;
  roundRect(ctx, 6, 18, 6, 10, 3);
  ctx.fill();
  roundRect(ctx, 44, 18, 6, 10, 3);
  ctx.fill();
  roundRect(ctx, 6, 34, 6, 10, 3);
  ctx.fill();
  roundRect(ctx, 44, 34, 6, 10, 3);
  ctx.fill();

  // -- Side trim stripe --
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(10, 29, 36, 2);
  ctx.globalAlpha = 1.0;

  // -- Body highlight --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.15;
  roundRect(ctx, 12, 14, 12, 14, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Body shadow at bottom --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.15;
  roundRect(ctx, 10, 38, 36, 8, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Cat: Round body with ears and tail ──────────────────────────────

function drawCat(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Tail (curling up) --
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(40, 38);
  ctx.quadraticCurveTo(48, 32, 46, 22);
  ctx.quadraticCurveTo(45, 18, 42, 20);
  ctx.stroke();

  // -- Body (round ellipse) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(28, 32, 16, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Belly highlight --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(28, 34, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Left ear (triangle) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(14, 20);
  ctx.lineTo(10, 6);
  ctx.lineTo(22, 16);
  ctx.closePath();
  ctx.fill();
  // Inner ear
  ctx.fillStyle = '#e08060';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(15, 18);
  ctx.lineTo(12, 9);
  ctx.lineTo(20, 16);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Right ear (triangle) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(42, 20);
  ctx.lineTo(46, 6);
  ctx.lineTo(34, 16);
  ctx.closePath();
  ctx.fill();
  // Inner ear
  ctx.fillStyle = '#e08060';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(41, 18);
  ctx.lineTo(44, 9);
  ctx.lineTo(36, 16);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Eyes (white + dark pupil) --
  // Left eye
  ctx.fillStyle = '#c8e0c8';
  ctx.beginPath();
  ctx.ellipse(22, 26, 3.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.ellipse(23, 26, 1.8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Right eye
  ctx.fillStyle = '#c8e0c8';
  ctx.beginPath();
  ctx.ellipse(34, 26, 3.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.ellipse(35, 26, 1.8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Nose (pink) --
  ctx.fillStyle = '#ff8090';
  ctx.beginPath();
  ctx.ellipse(28, 31, 2.5, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Whiskers --
  ctx.strokeStyle = '#a0a0b0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 28);
  ctx.lineTo(20, 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 32);
  ctx.lineTo(20, 32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(36, 30);
  ctx.lineTo(48, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(36, 32);
  ctx.lineTo(48, 32);
  ctx.stroke();

  // -- Mouth --
  ctx.strokeStyle = COLORS.black;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(25, 33);
  ctx.quadraticCurveTo(28, 36, 31, 33);
  ctx.stroke();

  // -- Wheels (small circles) --
  ctx.fillStyle = COLORS.darkGray;
  ctx.beginPath();
  ctx.arc(18, 46, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(38, 46, 4, 0, Math.PI * 2);
  ctx.fill();
  // Wheel hubs
  ctx.fillStyle = COLORS.lightGray;
  ctx.beginPath();
  ctx.arc(18, 46, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(38, 46, 2, 0, Math.PI * 2);
  ctx.fill();

  // -- Body shadow --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(28, 38, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Pig: Round body with snout and curly tail ───────────────────────

function drawPig(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Curly tail --
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(40, 38);
  ctx.bezierCurveTo(50, 36, 48, 24, 44, 28);
  ctx.stroke();

  // -- Body (round/oval) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(28, 32, 18, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Body highlight --
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(24, 28, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Left ear (floppy oval, rotated) --
  ctx.save();
  ctx.translate(16, 18);
  ctx.rotate(-20 * Math.PI / 180);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d0607a';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.restore();

  // -- Right ear (floppy oval, rotated) --
  ctx.save();
  ctx.translate(40, 18);
  ctx.rotate(20 * Math.PI / 180);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d0607a';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.restore();

  // -- Eyes (white + dark pupil) --
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(22, 26, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(34, 26, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.arc(22.5, 26, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(34.5, 26, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // -- Snout (oval) --
  ctx.fillStyle = '#d0607a';
  ctx.beginPath();
  ctx.ellipse(28, 34, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Nostrils --
  ctx.fillStyle = COLORS.black;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(25, 34, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(31, 34, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Wheels (circles) --
  ctx.fillStyle = COLORS.darkGray;
  ctx.beginPath();
  ctx.arc(16, 46, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 46, 4, 0, Math.PI * 2);
  ctx.fill();
  // Hubs
  ctx.fillStyle = COLORS.lightGray;
  ctx.beginPath();
  ctx.arc(16, 46, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 46, 2, 0, Math.PI * 2);
  ctx.fill();

  // -- Body shadow --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(28, 40, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Frog: Wide body with protruding eyes ────────────────────────────

function drawFrog(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Body (wide ellipse) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(28, 34, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Lighter belly --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(28, 36, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Left eye bulge --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(16, 18, 9, 0, Math.PI * 2);
  ctx.fill();
  // Eye white
  ctx.fillStyle = '#dde8dd';
  ctx.beginPath();
  ctx.arc(16, 17, 6, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.arc(16.5, 17, 3, 0, Math.PI * 2);
  ctx.fill();

  // -- Right eye bulge --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(40, 18, 9, 0, Math.PI * 2);
  ctx.fill();
  // Eye white
  ctx.fillStyle = '#dde8dd';
  ctx.beginPath();
  ctx.arc(40, 17, 6, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = COLORS.black;
  ctx.beginPath();
  ctx.arc(40.5, 17, 3, 0, Math.PI * 2);
  ctx.fill();

  // -- Wide mouth arc --
  ctx.strokeStyle = '#1a4a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 38);
  ctx.quadraticCurveTo(28, 46, 44, 38);
  ctx.stroke();

  // -- Nostrils --
  ctx.fillStyle = '#1a4a1a';
  ctx.beginPath();
  ctx.arc(24, 30, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(32, 30, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // -- Spots --
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(20, 32, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(36, 32, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Front leg stumps --
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.ellipse(12, 44, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(44, 44, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Wheels (circles) --
  ctx.fillStyle = COLORS.darkGray;
  ctx.beginPath();
  ctx.arc(16, 48, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 48, 4, 0, Math.PI * 2);
  ctx.fill();
  // Hubs
  ctx.fillStyle = COLORS.lightGray;
  ctx.beginPath();
  ctx.arc(16, 48, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 48, 2, 0, Math.PI * 2);
  ctx.fill();

  // -- Eye bulge highlight --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(14, 15, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(38, 15, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Body shadow --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(28, 42, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Toilet: Racing toilet on wheels ─────────────────────────────────

function drawToilet(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Tank/cistern (rectangle behind, at the back/top) --
  ctx.fillStyle = colorShade(color, -20);
  roundRect(ctx, 18, 36, 20, 14, 3);
  ctx.fill();
  // Tank highlight
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.2;
  roundRect(ctx, 20, 38, 8, 10, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Flush handle (lever on top of tank) --
  ctx.strokeStyle = '#b0b0c0';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(34, 40);
  ctx.lineTo(40, 38);
  ctx.lineTo(42, 40);
  ctx.stroke();
  // Handle knob
  ctx.fillStyle = '#c0c0d0';
  ctx.beginPath();
  ctx.arc(42, 40, 2, 0, Math.PI * 2);
  ctx.fill();

  // -- Bowl body (oval, slightly taller than wide) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(28, 24, 14, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Bowl shadow (darker bottom edge) --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.ellipse(28, 28, 13, 10, 0, 0, Math.PI);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Toilet seat (darker oval ring on top) --
  ctx.strokeStyle = colorShade(color, -40);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(28, 22, 10, 12, 0, 0, Math.PI * 2);
  ctx.stroke();

  // -- Lid slightly open (arc at back of seat) --
  ctx.fillStyle = colorShade(color, -15);
  ctx.beginPath();
  ctx.ellipse(28, 32, 10, 3, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colorShade(color, -30);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(28, 32, 10, 3, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // -- Water inside (blue oval visible through seat hole) --
  ctx.fillStyle = '#60a0e0';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(28, 22, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Water splash effect (blue highlights) --
  ctx.fillStyle = '#80d0ff';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(25, 18, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(32, 20, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(28, 15, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Porcelain highlight --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(22, 18, 4, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Wheels (4 small circles) --
  ctx.fillStyle = COLORS.darkGray;
  ctx.beginPath();
  ctx.arc(16, 12, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 12, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(16, 46, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 46, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Hubs
  ctx.fillStyle = COLORS.lightGray;
  ctx.beginPath();
  ctx.arc(16, 12, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 12, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(16, 46, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 46, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// ── Default fallback car ────────────────────────────────────────────

function drawDefaultCar(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
): void {
  // Body
  ctx.fillStyle = color;
  roundRect(ctx, 12, 18, 32, 20, 4);
  ctx.fill();
  // Roof
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  roundRect(ctx, 18, 10, 20, 14, 3);
  ctx.fill();
  ctx.globalAlpha = 1.0;
  // Wheels
  ctx.fillStyle = COLORS.darkGray;
  ctx.beginPath();
  ctx.arc(18, 42, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(38, 42, 4, 0, Math.PI * 2);
  ctx.fill();
}

// ── 2. drawObstacleVector ───────────────────────────────────────────

/**
 * Draws an obstacle centered at (0,0).
 * The caller is responsible for ctx.save/translate/rotate/restore.
 */
export function drawObstacleVector(
  ctx: CanvasRenderingContext2D,
  type: string,
  frame: number,
  width: number,
  height: number,
): void {
  switch (type) {
    case 'arrow_pad':
      drawArrowPadVector(ctx, frame, width, height);
      break;
    case 'spikes':
      drawSpikesVector(ctx, width, height);
      break;
    case 'log':
      drawLogVector(ctx, width, height);
      break;
    case 'rotating_spikes':
      drawRotatingSpikesVector(ctx, frame, width, height);
      break;
  }
}

// ── Arrow pad ───────────────────────────────────────────────────────

function drawArrowPadVector(
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
): void {
  const hw = width / 2;
  const hh = height / 2;
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.5);

  // -- Dark green base --
  ctx.fillStyle = '#004020';
  roundRect(ctx, -hw, -hh, width, height, 4);
  ctx.fill();

  // -- Cyan pulsing border --
  ctx.strokeStyle = `rgba(0, 224, 224, ${(0.5 + 0.5 * pulse).toFixed(2)})`;
  ctx.lineWidth = 2.5;
  roundRect(ctx, -hw, -hh, width, height, 4);
  ctx.stroke();

  // -- 3 chevron arrows (V-shapes pointing up) --
  const chevronCount = 3;
  const spacing = height / (chevronCount + 1);
  const chevronHalfW = hw * 0.5;

  ctx.strokeStyle = `rgba(0, 224, 224, ${(0.6 + 0.4 * pulse).toFixed(2)})`;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < chevronCount; i++) {
    const cy = -hh + spacing * (i + 1);
    ctx.beginPath();
    ctx.moveTo(-chevronHalfW, cy + 5);
    ctx.lineTo(0, cy - 5);
    ctx.lineTo(chevronHalfW, cy + 5);
    ctx.stroke();
  }

  // -- Bright glow overlay on active frames --
  if (pulse > 0.7) {
    ctx.fillStyle = `rgba(0, 224, 224, ${((pulse - 0.7) * 0.3).toFixed(2)})`;
    roundRect(ctx, -hw + 2, -hh + 2, width - 4, height - 4, 3);
    ctx.fill();
  }
}

// ── Spikes ──────────────────────────────────────────────────────────

function drawSpikesVector(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const hw = width / 2;
  const hh = height / 2;
  const spikeCount = Math.max(3, Math.round(width / 10));
  const spikeWidth = width / spikeCount;
  const spikeHeight = height - 4; // leave room for base plate

  // -- Metallic gradient for spikes --
  const grad = ctx.createLinearGradient(0, -hh, 0, hh - 4);
  grad.addColorStop(0, COLORS.metalLight);
  grad.addColorStop(0.5, '#c0c8d8');
  grad.addColorStop(1, COLORS.metal);

  ctx.fillStyle = grad;

  // Draw each triangular spike
  for (let i = 0; i < spikeCount; i++) {
    const baseLeft = -hw + i * spikeWidth;
    const baseRight = baseLeft + spikeWidth;
    const tipX = baseLeft + spikeWidth / 2;

    ctx.beginPath();
    ctx.moveTo(baseLeft, hh - 4);
    ctx.lineTo(tipX, -hh);
    ctx.lineTo(baseRight, hh - 4);
    ctx.closePath();
    ctx.fill();

    // Bright tip highlight
    ctx.fillStyle = '#dde4f0';
    ctx.beginPath();
    ctx.arc(tipX, -hh + 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = grad;
  }

  // -- Spike edge strokes for definition --
  ctx.strokeStyle = '#606878';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < spikeCount; i++) {
    const baseLeft = -hw + i * spikeWidth;
    const baseRight = baseLeft + spikeWidth;
    const tipX = baseLeft + spikeWidth / 2;
    ctx.beginPath();
    ctx.moveTo(baseLeft, hh - 4);
    ctx.lineTo(tipX, -hh);
    ctx.lineTo(baseRight, hh - 4);
    ctx.stroke();
  }

  // -- Dark base plate at bottom --
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(-hw, hh - 4, width, 4);
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(-hw, hh - 2, width, 2);
}

// ── Log ─────────────────────────────────────────────────────────────

function drawLogVector(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(hh, 6);

  // -- Cylindrical body gradient (darker edges, lighter center) --
  const bodyGrad = ctx.createLinearGradient(0, -hh, 0, hh);
  bodyGrad.addColorStop(0, '#4a3018');
  bodyGrad.addColorStop(0.3, COLORS.brownLight);
  bodyGrad.addColorStop(0.5, '#9a7050');
  bodyGrad.addColorStop(0.7, COLORS.brownLight);
  bodyGrad.addColorStop(1, '#4a3018');

  ctx.fillStyle = bodyGrad;
  roundRect(ctx, -hw, -hh, width, height, r);
  ctx.fill();

  // -- Horizontal bark texture lines --
  ctx.strokeStyle = '#5a3818';
  ctx.lineWidth = 0.6;
  const lineCount = Math.max(3, Math.round(height / 3));
  for (let i = 1; i < lineCount; i++) {
    const y = -hh + (height * i) / lineCount;
    // Slightly wavy line for organic feel
    ctx.beginPath();
    ctx.moveTo(-hw + 3, y);
    for (let x = -hw + 8; x < hw - 3; x += 10) {
      ctx.lineTo(x, y + (Math.sin(x * 0.5 + i) * 0.8));
    }
    ctx.lineTo(hw - 3, y);
    ctx.stroke();
  }

  // -- End rings (darker vertical lines at each edge) --
  ctx.fillStyle = '#4a2810';
  // Left end
  roundRect(ctx, -hw, -hh, 3, height, Math.min(r, 3));
  ctx.fill();
  ctx.fillStyle = '#5a3818';
  roundRect(ctx, -hw + 3, -hh, 2, height, 1);
  ctx.fill();
  // Right end
  ctx.fillStyle = '#4a2810';
  roundRect(ctx, hw - 3, -hh, 3, height, Math.min(r, 3));
  ctx.fill();
  ctx.fillStyle = '#5a3818';
  roundRect(ctx, hw - 5, -hh, 2, height, 1);
  ctx.fill();

  // -- Top highlight --
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundRect(ctx, -hw + 4, -hh, width - 8, 3, 1);
  ctx.fill();

  // -- Subtle outline --
  ctx.strokeStyle = '#3a2010';
  ctx.lineWidth = 1;
  roundRect(ctx, -hw, -hh, width, height, r);
  ctx.stroke();
}

// ── Rotating spikes (saw blade) ─────────────────────────────────────

function drawRotatingSpikesVector(
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
): void {
  const outerR = Math.min(width, height) / 2;
  const innerR = outerR * 0.42;
  const hubR = innerR * 0.55;
  const teethCount = 8;
  const rotAngle = (frame * Math.PI * 2) / 24;

  // -- Tooth gradient (red to orange) --
  const toothGrad = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
  toothGrad.addColorStop(0, '#c02010');
  toothGrad.addColorStop(1, '#e08020');

  // -- Build the saw blade path --
  ctx.fillStyle = toothGrad;
  ctx.beginPath();

  for (let i = 0; i < teethCount; i++) {
    const baseAngle = rotAngle + (i * Math.PI * 2) / teethCount;
    const halfTooth = Math.PI / teethCount;

    // Inner point (valley between teeth)
    const v1Angle = baseAngle - halfTooth * 0.5;
    const v1x = Math.cos(v1Angle) * innerR;
    const v1y = Math.sin(v1Angle) * innerR;

    // Outer point (tooth tip)
    const tipAngle = baseAngle;
    const tipX = Math.cos(tipAngle) * outerR;
    const tipY = Math.sin(tipAngle) * outerR;

    // Inner point (valley after tooth)
    const v2Angle = baseAngle + halfTooth * 0.5;
    const v2x = Math.cos(v2Angle) * innerR;
    const v2y = Math.sin(v2Angle) * innerR;

    if (i === 0) {
      ctx.moveTo(v1x, v1y);
    } else {
      ctx.lineTo(v1x, v1y);
    }
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(v2x, v2y);
  }

  ctx.closePath();
  ctx.fill();

  // -- Bright edge highlight on teeth --
  ctx.strokeStyle = '#ffa030';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // -- Inner hub circle (dark) --
  ctx.fillStyle = '#4a1a1a';
  ctx.beginPath();
  ctx.arc(0, 0, hubR, 0, Math.PI * 2);
  ctx.fill();

  // -- Hub ring --
  ctx.strokeStyle = '#6a3030';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, hubR, 0, Math.PI * 2);
  ctx.stroke();

  // -- Center axle --
  ctx.fillStyle = '#808090';
  ctx.beginPath();
  ctx.arc(0, 0, hubR * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a0a0b0';
  ctx.beginPath();
  ctx.arc(0, 0, hubR * 0.15, 0, Math.PI * 2);
  ctx.fill();
}

// ── 3. drawLavaTile ─────────────────────────────────────────────────

const lavaTileCache = new Map<number, HTMLCanvasElement>();
const LAVA_TILE_SIZE = 128;

/**
 * Helper: draw a single radial gradient, wrapping around tile edges so the
 * pattern tiles seamlessly. For a cell near an edge, we also draw it at the
 * mirrored position on the opposite side (and corners).
 */
function drawWrappedGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  S: number,
  createGrad: (gx: number, gy: number) => CanvasGradient,
): void {
  // Collect all wrapped positions for this cell
  const offsets: [number, number][] = [[0, 0]];
  if (cx - radius < 0) offsets.push([S, 0]);
  if (cx + radius > S) offsets.push([-S, 0]);
  if (cy - radius < 0) offsets.push([0, S]);
  if (cy + radius > S) offsets.push([0, -S]);
  // Corners
  if (cx - radius < 0 && cy - radius < 0) offsets.push([S, S]);
  if (cx + radius > S && cy - radius < 0) offsets.push([-S, S]);
  if (cx - radius < 0 && cy + radius > S) offsets.push([S, -S]);
  if (cx + radius > S && cy + radius > S) offsets.push([-S, -S]);

  for (const [ox, oy] of offsets) {
    ctx.fillStyle = createGrad(cx + ox, cy + oy);
    ctx.fillRect(0, 0, S, S);
  }
}

/**
 * Helper: draw a wrapped circle (for bright spot highlights).
 */
function drawWrappedCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  S: number,
  createGrad: (gx: number, gy: number) => CanvasGradient,
): void {
  const offsets: [number, number][] = [[0, 0]];
  if (cx - radius < 0) offsets.push([S, 0]);
  if (cx + radius > S) offsets.push([-S, 0]);
  if (cy - radius < 0) offsets.push([0, S]);
  if (cy + radius > S) offsets.push([0, -S]);
  if (cx - radius < 0 && cy - radius < 0) offsets.push([S, S]);
  if (cx + radius > S && cy - radius < 0) offsets.push([-S, S]);
  if (cx - radius < 0 && cy + radius > S) offsets.push([S, -S]);
  if (cx + radius > S && cy + radius > S) offsets.push([-S, -S]);

  for (const [ox, oy] of offsets) {
    const gx = cx + ox;
    const gy = cy + oy;
    ctx.fillStyle = createGrad(gx, gy);
    ctx.beginPath();
    ctx.arc(gx, gy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Returns a cached 128x128 canvas with a seamlessly-tiling lava tile drawn
 * using vector operations (radial gradients, no ImageData pixel manipulation).
 * Cells near edges are wrapped so left matches right and top matches bottom.
 * Caches 3 frames (frame 0, 1, 2).
 */
export function drawLavaTile(frame: number): HTMLCanvasElement {
  if (lavaTileCache.has(frame)) return lavaTileCache.get(frame)!;

  const c = createCanvas(LAVA_TILE_SIZE, LAVA_TILE_SIZE);
  const ctx = c.getContext('2d')!;
  const S = LAVA_TILE_SIZE;

  // -- Base color fill --
  ctx.fillStyle = COLORS.lavaMid;
  ctx.fillRect(0, 0, S, S);

  // -- Lava cells: overlapping radial gradients with edge wrapping --
  const rng = seeded(42 + frame * 1337);
  const cellCount = 14;

  for (let i = 0; i < cellCount; i++) {
    // Deterministic positions with frame-dependent shift, wrapped to [0, S)
    const cx = ((rng() * S + frame * 5 * (i % 2 === 0 ? 1 : -1)) % S + S) % S;
    const cy = ((rng() * S + frame * 3 * (i % 2 === 0 ? -1 : 1)) % S + S) % S;
    const radius = 16 + rng() * 28;
    const alpha = 0.5 + rng() * 0.3;

    ctx.globalAlpha = alpha;
    drawWrappedGradient(ctx, cx, cy, radius, S, (gx, gy) => {
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
      grad.addColorStop(0, COLORS.lavaGlow);
      grad.addColorStop(0.4, COLORS.lavaBright);
      grad.addColorStop(1, 'rgba(192, 64, 10, 0)');
      return grad;
    });
  }

  ctx.globalAlpha = 1.0;

  // -- Dark crust patches with edge wrapping --
  const crustCount = 8;
  for (let i = 0; i < crustCount; i++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const radius = 8 + rng() * 16;
    const alpha = 0.3 + rng() * 0.25;

    ctx.globalAlpha = alpha;
    drawWrappedGradient(ctx, cx, cy, radius, S, (gx, gy) => {
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
      grad.addColorStop(0, COLORS.lavaDark);
      grad.addColorStop(1, 'rgba(138, 32, 0, 0)');
      return grad;
    });
  }

  ctx.globalAlpha = 1.0;

  // -- Bright spot highlights with edge wrapping --
  const spotCount = 6;
  for (let i = 0; i < spotCount; i++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const radius = 4 + rng() * 7;
    const alpha = 0.3 + rng() * 0.2;

    ctx.globalAlpha = alpha;
    drawWrappedCircle(ctx, cx, cy, radius, S, (gx, gy) => {
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
      grad.addColorStop(0, '#ffe060');
      grad.addColorStop(0.5, COLORS.lavaGlow);
      grad.addColorStop(1, 'rgba(255, 128, 32, 0)');
      return grad;
    });
  }

  ctx.globalAlpha = 1.0;

  lavaTileCache.set(frame, c);
  return c;
}

// ── Cache management ────────────────────────────────────────────────

export function clearVectorSpriteCache(): void {
  lavaTileCache.clear();
}
