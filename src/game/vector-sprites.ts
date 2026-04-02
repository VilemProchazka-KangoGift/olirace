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

// ── Formula: Chunky cartoon F1 race car ────────────────────────────

function drawFormula(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Big rear wing --
  ctx.fillStyle = COLORS.darkGray;
  roundRect(ctx, 10, 44, 36, 5, 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  roundRect(ctx, 10, 44, 36, 5, 2);
  ctx.stroke();
  // Wing endplates
  ctx.fillStyle = color;
  roundRect(ctx, 8, 42, 4, 8, 1);
  ctx.fill();
  roundRect(ctx, 44, 42, 4, 8, 1);
  ctx.fill();

  // -- Fat wheels (oversized for cartoon feel) --
  ctx.fillStyle = COLORS.darkGray;
  roundRect(ctx, 8, 12, 8, 14, 3);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 8, 12, 8, 14, 3);
  ctx.stroke();
  roundRect(ctx, 40, 12, 8, 14, 3);
  ctx.fill();
  roundRect(ctx, 40, 12, 8, 14, 3);
  ctx.stroke();
  roundRect(ctx, 8, 34, 8, 14, 3);
  ctx.fill();
  roundRect(ctx, 8, 34, 8, 14, 3);
  ctx.stroke();
  roundRect(ctx, 40, 34, 8, 14, 3);
  ctx.fill();
  roundRect(ctx, 40, 34, 8, 14, 3);
  ctx.stroke();
  // Wheel hubs
  ctx.fillStyle = COLORS.lightGray;
  for (const [wx, wy] of [[12, 19], [44, 19], [12, 41], [44, 41]]) {
    ctx.beginPath();
    ctx.arc(wx, wy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- Wide body --
  ctx.fillStyle = color;
  roundRect(ctx, 17, 8, 22, 40, 5);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  roundRect(ctx, 17, 8, 22, 40, 5);
  ctx.stroke();

  // -- Chunky nose cone --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(28, 1);
  ctx.lineTo(19, 14);
  ctx.lineTo(37, 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();

  // -- Front wing --
  ctx.fillStyle = COLORS.metal;
  roundRect(ctx, 10, 10, 36, 3, 1);
  ctx.fill();

  // -- Side pods (chubby air intakes) --
  ctx.fillStyle = colorShade(color, -20);
  ctx.beginPath();
  ctx.ellipse(18, 32, 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(38, 32, 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Helmet/cockpit (big round visor) --
  ctx.fillStyle = '#1a1a3a';
  ctx.beginPath();
  ctx.ellipse(28, 22, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Visor
  ctx.fillStyle = '#4060a0';
  ctx.beginPath();
  ctx.ellipse(28, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Visor gleam
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(25, 18, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Racing number circle --
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(28, 34, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', 28, 34.5);

  // -- Highlight stripe --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.4;
  roundRect(ctx, 26, 10, 4, 34, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Exhaust pipes --
  ctx.fillStyle = COLORS.metal;
  ctx.beginPath();
  ctx.arc(25, 49, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(31, 49, 2, 0, Math.PI * 2);
  ctx.fill();

  // -- Shadow on lower body --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.2;
  roundRect(ctx, 17, 38, 22, 8, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Yeti: Big fluffy monster truck ─────────────────────────────────

function drawYeti(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Huge wheels (monster truck style) --
  ctx.fillStyle = COLORS.darkGray;
  for (const [wx, wy] of [[8, 18], [48, 18], [8, 40], [48, 40]]) {
    ctx.beginPath();
    ctx.arc(wx, wy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Tire treads
    ctx.fillStyle = COLORS.midGray;
    ctx.beginPath();
    ctx.arc(wx, wy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.darkGray;
  }

  // -- Main body (round and chunky) --
  ctx.fillStyle = color;
  roundRect(ctx, 12, 10, 32, 38, 8);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  roundRect(ctx, 12, 10, 32, 38, 8);
  ctx.stroke();

  // -- Fluffy fur tufts around edges --
  ctx.fillStyle = highlight;
  const tufts = [[14, 12], [42, 12], [12, 28], [44, 28], [14, 46], [42, 46],
                 [20, 8], [36, 8], [20, 50], [36, 50]];
  for (const [tx, ty] of tufts) {
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- Belly patch (lighter oval) --
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(28, 34, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Horns/antlers --
  ctx.strokeStyle = '#c0a060';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(18, 14);
  ctx.lineTo(10, 4);
  ctx.lineTo(14, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(38, 14);
  ctx.lineTo(46, 4);
  ctx.lineTo(42, 10);
  ctx.stroke();

  // -- Snout/muzzle --
  ctx.fillStyle = '#e0d0c0';
  ctx.beginPath();
  ctx.ellipse(28, 26, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Nose --
  ctx.fillStyle = '#404060';
  ctx.beginPath();
  ctx.ellipse(28, 24, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Mouth --
  ctx.strokeStyle = '#404060';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(24, 28);
  ctx.quadraticCurveTo(28, 32, 32, 28);
  ctx.stroke();

  // -- Tooth (one big fang) --
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(26, 28);
  ctx.lineTo(28, 32);
  ctx.lineTo(30, 28);
  ctx.closePath();
  ctx.fill();

  // -- Rosy cheeks --
  ctx.fillStyle = '#ff6080';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(17, 24, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(39, 24, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Body highlight --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.25;
  roundRect(ctx, 14, 12, 12, 16, 4);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Body shadow at bottom --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.15;
  roundRect(ctx, 12, 38, 32, 10, 4);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Cat: Round fluffy cat with big ears ─────────────────────────────

function drawCat(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Tail (thick curling up from back) --
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(42, 42);
  ctx.quadraticCurveTo(52, 34, 50, 22);
  ctx.quadraticCurveTo(49, 16, 44, 18);
  ctx.stroke();
  // Tail outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(42, 42);
  ctx.quadraticCurveTo(52, 34, 50, 22);
  ctx.quadraticCurveTo(49, 16, 44, 18);
  ctx.stroke();
  // Tail tip (darker stripe)
  ctx.strokeStyle = colorShade(color, -40);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(50, 22);
  ctx.quadraticCurveTo(49, 16, 44, 18);
  ctx.stroke();

  // -- Paws (little circles peeking at bottom) --
  ctx.fillStyle = colorShade(color, -20);
  for (const px of [16, 24, 32, 40]) {
    ctx.beginPath();
    ctx.arc(px, 48, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Toe beans
  ctx.fillStyle = '#ffaaaa';
  for (const px of [16, 40]) {
    ctx.beginPath();
    ctx.arc(px, 49, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px - 2, 47, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 2, 47, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- Big round body --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(28, 34, 18, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(28, 34, 18, 16, 0, 0, Math.PI * 2);
  ctx.stroke();

  // -- Belly (white patch) --
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(28, 38, 10, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Tabby stripes on back --
  ctx.strokeStyle = colorShade(color, -50);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 3; i++) {
    const sy = 26 + i * 5;
    ctx.beginPath();
    ctx.moveTo(20, sy);
    ctx.quadraticCurveTo(28, sy - 2, 36, sy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // -- Left ear (big pointy) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(13, 22);
  ctx.lineTo(8, 2);
  ctx.lineTo(24, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Inner ear (pink)
  ctx.fillStyle = '#ff9999';
  ctx.beginPath();
  ctx.moveTo(14, 20);
  ctx.lineTo(11, 6);
  ctx.lineTo(22, 18);
  ctx.closePath();
  ctx.fill();

  // -- Right ear (big pointy) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(43, 22);
  ctx.lineTo(48, 2);
  ctx.lineTo(32, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Inner ear (pink)
  ctx.fillStyle = '#ff9999';
  ctx.beginPath();
  ctx.moveTo(42, 20);
  ctx.lineTo(45, 6);
  ctx.lineTo(34, 18);
  ctx.closePath();
  ctx.fill();

  // (Eyes drawn by googly eyes overlay in renderer)

  // -- Rosy cheeks --
  ctx.fillStyle = '#ff6080';
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(15, 28, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(41, 28, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Nose (pink triangle) --
  ctx.fillStyle = '#ff8090';
  ctx.beginPath();
  ctx.moveTo(28, 27);
  ctx.lineTo(25, 30);
  ctx.lineTo(31, 30);
  ctx.closePath();
  ctx.fill();

  // -- Whiskers (thicker, more expressive) --
  ctx.strokeStyle = '#808090';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  // Left whiskers
  ctx.beginPath();
  ctx.moveTo(5, 26);
  ctx.lineTo(20, 29);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, 30);
  ctx.lineTo(20, 31);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5, 34);
  ctx.lineTo(20, 33);
  ctx.stroke();
  // Right whiskers
  ctx.beginPath();
  ctx.moveTo(36, 29);
  ctx.lineTo(51, 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(36, 31);
  ctx.lineTo(52, 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(36, 33);
  ctx.lineTo(51, 34);
  ctx.stroke();

  // -- Cat mouth (w-shape) --
  ctx.strokeStyle = '#303040';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(23, 32);
  ctx.quadraticCurveTo(25.5, 35, 28, 32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, 32);
  ctx.quadraticCurveTo(30.5, 35, 33, 32);
  ctx.stroke();

  // -- Body shadow --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(28, 42, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Pig: Super round blob with big snout and floppy ears ────────────

function drawPig(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Curly tail (more visible corkscrew) --
  ctx.strokeStyle = colorShade(color, -30);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(42, 40);
  ctx.bezierCurveTo(54, 38, 52, 28, 46, 32);
  ctx.bezierCurveTo(52, 24, 48, 20, 44, 24);
  ctx.stroke();
  // Tail outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(42, 40);
  ctx.bezierCurveTo(54, 38, 52, 28, 46, 32);
  ctx.bezierCurveTo(52, 24, 48, 20, 44, 24);
  ctx.stroke();

  // -- Little hooves (at bottom) --
  ctx.fillStyle = '#8a5030';
  for (const hx of [18, 38]) {
    ctx.beginPath();
    ctx.ellipse(hx, 50, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- BIG round body --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(28, 32, 20, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(28, 32, 20, 18, 0, 0, Math.PI * 2);
  ctx.stroke();

  // -- Belly highlight --
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.ellipse(28, 36, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Left ear (big floppy, rotated) --
  ctx.save();
  ctx.translate(14, 16);
  ctx.rotate(-30 * Math.PI / 180);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Inner ear
  ctx.fillStyle = '#e0607a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // -- Right ear (big floppy, rotated) --
  ctx.save();
  ctx.translate(42, 16);
  ctx.rotate(30 * Math.PI / 180);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Inner ear
  ctx.fillStyle = '#e0607a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // (Eyes drawn by googly eyes overlay in renderer)

  // -- Rosy cheeks (bigger, cuter) --
  ctx.fillStyle = '#ff6080';
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(14, 28, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(42, 28, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Big snout (oval) --
  ctx.fillStyle = '#e0607a';
  ctx.beginPath();
  ctx.ellipse(28, 32, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // -- Nostrils (bigger, cartoon) --
  ctx.fillStyle = '#903050';
  ctx.beginPath();
  ctx.ellipse(24, 32, 2.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(32, 32, 2.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Happy mouth under snout --
  ctx.strokeStyle = '#903050';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(22, 37);
  ctx.quadraticCurveTo(28, 41, 34, 37);
  ctx.stroke();

  // -- Body shadow --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(28, 42, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Frog: Wide smiley frog with properly-sized eye bumps ────────────

function drawFrog(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Webbed feet (splayed at bottom) --
  ctx.fillStyle = colorShade(color, -30);
  for (const [fx, fy, rot] of [[12, 48, -0.3], [44, 48, 0.3]] as const) {
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(rot);
    // Three toes
    for (const tx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.ellipse(tx, 0, 2.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // -- Wide body --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(28, 36, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(28, 36, 20, 14, 0, 0, Math.PI * 2);
  ctx.stroke();

  // -- Lighter belly --
  ctx.fillStyle = colorShade(color, 60);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(28, 39, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Spots (darker circles on back) --
  ctx.fillStyle = colorShade(color, -30);
  ctx.globalAlpha = 0.3;
  for (const [sx, sy, sr] of [[18, 30, 4], [38, 30, 3.5], [28, 28, 3], [22, 36, 2.5], [34, 36, 2.5]]) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // -- Eye bumps (aligned with googly eye overlay at x=22,34 y=20) --
  // Googly eyes draw at (-6, -8) and (6, -8) from center = (22, 20) and (34, 20)
  for (const ex of [22, 34]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ex, 18, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Highlight on eye bump
    ctx.fillStyle = highlight;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(ex - 2, 15, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // -- Rosy cheeks --
  ctx.fillStyle = '#ff6080';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(12, 36, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(44, 36, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Nostrils --
  ctx.fillStyle = colorShade(color, -60);
  ctx.beginPath();
  ctx.arc(24, 32, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(32, 32, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // -- Big wide smile --
  ctx.strokeStyle = colorShade(color, -80);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(12, 38);
  ctx.quadraticCurveTo(28, 50, 44, 38);
  ctx.stroke();

  // -- Tongue peeking out --
  ctx.fillStyle = '#ff6070';
  ctx.beginPath();
  ctx.ellipse(28, 44, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Front leg bumps --
  ctx.fillStyle = color;
  for (const lx of [10, 46]) {
    ctx.beginPath();
    ctx.ellipse(lx, 42, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- Body shadow --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(28, 44, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ── Toilet: Goofy racing toilet ────────────────────────────────────

function drawToilet(
  ctx: CanvasRenderingContext2D,
  color: string,
  shadow: string,
  highlight: string,
): void {
  // -- Wheels (4 chunky wheels) --
  ctx.fillStyle = COLORS.darkGray;
  for (const [wx, wy] of [[14, 10], [42, 10], [14, 48], [42, 48]]) {
    ctx.beginPath();
    ctx.arc(wx, wy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Hub
    ctx.fillStyle = COLORS.lightGray;
    ctx.beginPath();
    ctx.arc(wx, wy, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.darkGray;
  }

  // -- Tank/cistern (big chunky rectangle at back) --
  ctx.fillStyle = colorShade(color, -20);
  roundRect(ctx, 16, 36, 24, 16, 4);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 16, 36, 24, 16, 4);
  ctx.stroke();
  // Tank highlight
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.3;
  roundRect(ctx, 18, 38, 8, 12, 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Flush handle (chrome lever) --
  ctx.strokeStyle = COLORS.metal;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(36, 40);
  ctx.lineTo(44, 36);
  ctx.stroke();
  // Chrome knob
  ctx.fillStyle = COLORS.metalLight;
  ctx.beginPath();
  ctx.arc(44, 36, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // -- Bowl body (big chubby oval) --
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(28, 22, 16, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(28, 22, 16, 18, 0, 0, Math.PI * 2);
  ctx.stroke();

  // -- Porcelain highlight (shiny gleam) --
  ctx.fillStyle = highlight;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(20, 14, 5, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Toilet seat ring --
  ctx.strokeStyle = colorShade(color, -30);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(28, 20, 11, 13, 0, 0, Math.PI * 2);
  ctx.stroke();

  // -- Water inside (blue with bubbles) --
  ctx.fillStyle = '#5090d0';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(28, 20, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
  // Bubbles
  ctx.fillStyle = '#a0d8ff';
  ctx.globalAlpha = 0.7;
  for (const [bx, by, br] of [[24, 17, 1.5], [30, 15, 1], [32, 20, 1.2], [26, 22, 0.8]]) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // -- Lid edge (back of seat, slightly raised) --
  ctx.fillStyle = colorShade(color, -15);
  ctx.beginPath();
  ctx.ellipse(28, 34, 12, 3, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colorShade(color, -30);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // (Eyes drawn by googly eyes overlay in renderer)

  // -- Water splash drops flying up --
  ctx.fillStyle = '#80d0ff';
  ctx.globalAlpha = 0.7;
  for (const [dx, dy, dr] of [[22, 8, 1.5], [28, 5, 2], [34, 8, 1.5], [25, 3, 1]]) {
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // -- Rosy cheeks --
  ctx.fillStyle = '#ff6080';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(16, 24, 3.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(40, 24, 3.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // -- Shadow below bowl --
  ctx.fillStyle = shadow;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.ellipse(28, 34, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
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

let lavaTileCanvas: HTMLCanvasElement | null = null;
const LAVA_TILE_SIZE = 128;

/**
 * Returns a cached 128x128 seamlessly-tiling lava tile.
 * Static — dark crust with glowing molten cracks.
 *
 * Tiling is guaranteed by computing each pixel's color using
 * wrapping-distance to feature points. Every distance calculation
 * wraps around [0, S), so left==right and top==bottom by definition.
 */
export function drawLavaTile(_frame: number): HTMLCanvasElement {
  if (lavaTileCanvas) return lavaTileCanvas;

  const S = LAVA_TILE_SIZE;
  const c = createCanvas(S, S);
  const ctx = c.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);
  const pixels = imgData.data;
  const rng = seeded(42);

  // Generate Voronoi cell centers (these define the crust plates)
  const cellCount = 18;
  const cells: [number, number][] = [];
  for (let i = 0; i < cellCount; i++) {
    cells.push([rng() * S, rng() * S]);
  }

  // Wrapping distance helper
  function wrapDist(ax: number, ay: number, bx: number, by: number): number {
    let dx = Math.abs(ax - bx);
    let dy = Math.abs(ay - by);
    if (dx > S / 2) dx = S - dx;
    if (dy > S / 2) dy = S - dy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // For each pixel, find distance to nearest and 2nd-nearest cell center
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let d1 = Infinity;
      let d2 = Infinity;

      for (let i = 0; i < cellCount; i++) {
        const d = wrapDist(px, py, cells[i][0], cells[i][1]);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }

      // Crack intensity: where d2 - d1 is small, we're on a cell boundary (crack)
      const crackWidth = d2 - d1;
      const crackT = Math.max(0, 1 - crackWidth / 8); // 0 = solid plate, 1 = crack center

      // Distance from plate center for surface shading
      const plateT = Math.min(1, d1 / 30); // 0 = center of plate, 1 = far from center

      // Base colors
      // Plate: dark charcoal, slightly varies by distance from center
      const plateR = 20 + plateT * 8;
      const plateG = 12 + plateT * 5;
      const plateB = 6 + plateT * 3;

      // Crack glow: orange-yellow
      const glowR = 255;
      const glowG = 120 + crackT * 80; // more yellow at center
      const glowB = 10 + crackT * 30;

      // Blend: plate vs crack
      const r = plateR + (glowR - plateR) * crackT;
      const g = plateG + (glowG - plateG) * crackT;
      const b = plateB + (glowB - plateB) * crackT;

      const idx = (py * S + px) * 4;
      pixels[idx] = Math.min(255, r);
      pixels[idx + 1] = Math.min(255, g);
      pixels[idx + 2] = Math.min(255, b);
      pixels[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  lavaTileCanvas = c;
  return c;
}

// ── Cache management ────────────────────────────────────────────────

export function clearVectorSpriteCache(): void {
  lavaTileCanvas = null;
}
