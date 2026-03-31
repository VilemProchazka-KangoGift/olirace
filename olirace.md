# Olíkův závod — Game Design Spec

> A top-down vertical scrolling racing game. Players choose a car or car-like animal and race through obstacle-filled roads surrounded by lava. Browser-based, React + HTML5 Canvas, TypeScript, Vite.

## 1. Core Concept

A vertical-scrolling racing game rendered on HTML5 Canvas with a React UI shell. The camera follows the player(s) along a predefined winding road from START to FINISH. Players have full 2D driving controls — they steer freely within the road boundaries. The road scrolls as the player progresses.

- **1P mode:** Reach the finish line as fast as possible. Timer counts up.
- **2P mode:** First to cross the finish line wins. Shared screen, competitive.
- **Fail states:** Falling into lava or hitting spikes → respawn ~200px back on the track.
- **Target run time:** ~60 seconds per track for a zero-death run.
- **Orientation:** Portrait, 9:16 aspect ratio. The game canvas is centered in the browser window. The margins outside the canvas are filled with a static lava-colored pattern.

---

## 2. Player Characters

Five characters with numeric stat differences. No unique abilities.

### Stat Definitions

- **maxSpeed** (px/s): Maximum forward velocity.
- **acceleration** (px/s²): How fast the player reaches maxSpeed.
- **handling** (radians/s): Maximum turn rate at full speed. Turn rate scales linearly: `actualTurnRate = handling * (currentSpeed / maxSpeed)`. At zero speed, turning does nothing.
- **weight** (0–1 multiplier): Reduces knockback from logs. Knockback distance = `BASE_KNOCKBACK * (1 - weight)`. Also affects push force in player-player collisions.
- **brakeForce** (px/s²): Deceleration when braking.

### Character Table

| ID | Name | maxSpeed | acceleration | handling | weight | brakeForce | Description |
|----|------|----------|-------------|----------|--------|------------|-------------|
| `formula` | Formula | 280 | 200 | 3.5 | 0.15 | 300 | Tiny open-wheel racer. Fastest, lightest — gets shoved around. |
| `yeti` | Škoda Yeti | 180 | 100 | 3.0 | 0.85 | 200 | Chunky Czech SUV. Slow but barely affected by knockback. Realistic pixel art style (recognizably a Škoda Yeti, not a cartoon). |
| `cat` | Cat | 220 | 160 | 4.5 | 0.15 | 280 | Cat on wheels. Best handling, fragile. |
| `pig` | Pig | 260 | 180 | 2.2 | 0.75 | 250 | Round pig-mobile. Fast with poor handling, heavy. |
| `frog` | Frog | 230 | 150 | 3.2 | 0.45 | 260 | Frog-kart. Balanced all-rounder. |

### Sprite Spec

- Size: 32×32 pixels per frame.
- Rotation: 8 directional frames (N, NE, E, SE, S, SW, W, NW).
- Animation states: `idle` (2 frames, 4 FPS), `driving` (4 frames, 8 FPS), `death` (5 frames, 12 FPS).
- Each character has a **primary palette** and a **rival palette** (for P2 when both players pick the same character). Rival palette swaps the dominant hue (e.g., red pig → blue pig).
- Rendering: nearest-neighbor scaling (no anti-aliasing). The canvas CSS uses `image-rendering: pixelated`.

---

## 3. Controls

### Keyboard Bindings

Both players share a single keyboard. Input handling uses `event.code` (physical key position), which is inherently case-insensitive — it fires the same `KeyW` whether or not Caps Lock or Shift is held. Do NOT use `event.key` (which returns different values for upper/lowercase). Explicitly: ignore `event.shiftKey`, `event.ctrlKey`, and Caps Lock state.

| Action | Player 1 (`event.code`) | Player 2 (`event.code`) |
|--------|----------|----------|
| Accelerate | `KeyW` | `ArrowUp` |
| Brake / Reverse | `KeyS` | `ArrowDown` |
| Steer Left | `KeyA` | `ArrowLeft` |
| Steer Right | `KeyD` | `ArrowRight` |
| Honk (cosmetic) | `Space` | `Enter` |

### Gamepad Bindings (Gamepad API)

Each connected gamepad maps to a player (gamepad index 0 → P1, index 1 → P2). If gamepads are connected AND keyboard is used, gamepad takes precedence for that player.

| Action | Gamepad |
|--------|---------|
| Accelerate | `buttons[7]` (Right Trigger) OR `buttons[0]` (A / Cross) |
| Brake / Reverse | `buttons[6]` (Left Trigger) OR `buttons[1]` (B / Circle) |
| Steer Left/Right | `axes[0]` (Left Stick X). Deadzone: 0.15. |
| Honk | `buttons[2]` (X / Square) |

### Input Implementation

The `input.ts` module maintains a **flag store** — a `Record<string, boolean>` keyed by `event.code`. Keyboard event listeners set flags; the game loop reads them:

```typescript
// input.ts
const keyState: Record<string, boolean> = {};

window.addEventListener("keydown", (e) => { keyState[e.code] = true; });
window.addEventListener("keyup", (e) => { keyState[e.code] = false; });

// Called once per physics step inside the game loop
function readPlayerInput(playerIndex: 0 | 1): PlayerInput {
  if (playerIndex === 0) {
    return {
      accelerate: keyState["KeyW"] ? 1 : 0,
      brake: keyState["KeyS"] ? 1 : 0,
      steerX: (keyState["KeyA"] ? -1 : 0) + (keyState["KeyD"] ? 1 : 0),
      honk: !!keyState["Space"],
    };
  } else {
    return {
      accelerate: keyState["ArrowUp"] ? 1 : 0,
      brake: keyState["ArrowDown"] ? 1 : 0,
      steerX: (keyState["ArrowLeft"] ? -1 : 0) + (keyState["ArrowRight"] ? 1 : 0),
      honk: !!keyState["Enter"],
    };
  }
  // If a gamepad is connected for this player, override with gamepad values.
}
```

### Input Abstraction Interface

```typescript
interface PlayerInput {
  accelerate: number;    // 0 to 1 (binary from keyboard, analog from trigger)
  brake: number;         // 0 to 1
  steerX: number;        // -1 (left) to 1 (right), 0 = no steer
  honk: boolean;
}
```

### Driving Physics

Each frame (at fixed timestep `dt = 1/60`):

```
1. Read input → PlayerInput
2. If accelerate > 0:
     speed += acceleration * accelerate * dt
     speed = min(speed, maxSpeed)
3. If brake > 0:
     speed -= brakeForce * brake * dt
     If speed < 0: speed = max(speed, -maxSpeed * 0.4)  // reverse cap
4. If neither accelerate nor brake:
     speed *= FRICTION_DECAY  // 0.97 per frame — coast to stop
5. If speed != 0 AND steerX != 0:
     angle += handling * steerX * (speed / maxSpeed) * dt
6. velocity.x = cos(angle) * speed
   velocity.y = -sin(angle) * speed   // negative Y = up on canvas
7. position += velocity * dt
```

Constants: `FRICTION_DECAY = 0.97`. Angle is in radians, 0 = facing right, π/2 = facing up.

**Reverse steering:** When `speed < 0`, step 5 naturally inverts the turn direction because `speed / maxSpeed` becomes negative. This means pressing "steer left" while reversing rotates the car to the right — matching real car behavior. This is intentional; do not add a special case.

### Race Start Sequence

1. Players placed at start positions. Input is **locked** (ignored).
2. Countdown overlay: "3" (0.8s) → "2" (0.8s) → "1" (0.8s) → "GO!" (0.5s then fade).
3. On "GO!": input unlocks, timer starts at 0:00.00.
4. Visual: large centered pixel text. Each number scales up from 0 to 1 over 0.1s then holds. "GO!" flashes white.
5. Audio: a rising-pitch beep on each number (3 = low, 2 = mid, 1 = high), horn blast on GO.

---

## 4. The Road & World

### Coordinate System

- World space: Y increases downward (standard Canvas). The track is authored with **Y-down** coordinates.
- The start is at a higher Y value (bottom of track in world), finish at a lower Y value (top). The camera moves upward (decreasing Y) as the player progresses.
- All positions in pixels.

### Track Data Format

Each track is a JSON file with this schema:

```typescript
interface TrackData {
  name: string;                        // display name
  difficulty: "easy" | "medium" | "hard";
  // The road is a polyline of control points. The road surface is generated
  // by extruding width perpendicular to the path at each point.
  road: RoadPoint[];
  obstacles: ObstaclePlacement[];
  startLine: number;                   // index into road[] where start line is
  finishLine: number;                  // index into road[] where finish line is
  startPositions: {                    // starting grid positions (world coords)
    p1: { x: number; y: number; angle: number };
    p2: { x: number; y: number; angle: number };
  };
}

interface RoadPoint {
  x: number;                           // world X of road centerline
  y: number;                           // world Y of road centerline
  width: number;                       // road width at this point (perpendicular to direction)
}

interface ObstaclePlacement {
  type: "arrow_pad" | "spikes" | "log" | "rotating_spikes";
  x: number;                           // world X
  y: number;                           // world Y
  angle: number;                       // rotation in radians (0 = default orientation)
  // Rotating spikes only:
  patrolAxis?: "x" | "y";             // axis of oscillation
  patrolDistance?: number;             // half-width of patrol in px
  patrolSpeed?: number;               // px/s
}
```

### Road Geometry Constraints

When authoring track data, the following must hold to prevent rendering artifacts:

- **Minimum curve radius:** The implied curve radius between any three consecutive `RoadPoint`s must be ≥ the `width` of the widest of those points. This prevents inner-edge self-intersection on tight curves. To achieve tight turns on narrow roads (e.g., Devil's Highway), narrow the road *before* the curve begins, not during.
- **Point spacing:** Adjacent road points should be 20–60px apart along the centerline. Too sparse → jagged edges. Too dense → wasted data.
- **Width transitions:** Width changes between adjacent points should not exceed 40px to avoid visual seams.

### Road Rendering

1. For each pair of adjacent `RoadPoint`s, compute the left and right edges by offsetting `width/2` perpendicular to the segment direction.
2. Draw the road as a series of filled quads (trapezoids) connecting adjacent edge points.
3. Road surface color: `#3a3a4a` (dark asphalt). Dashed center line: `#666680`, 4px wide, 20px dash / 20px gap.
4. Road shoulder: 8px inset from each edge, color `#2a2a3a`.
5. Edge markings: 2px white line at the outer edge of the road.

### Road Collision

The road is the set of quads formed by adjacent road points. To test if a point is on the road:

1. Find the nearest road segment (pair of adjacent RoadPoints).
2. Project the point onto the segment centerline.
3. Compute perpendicular distance from centerline.
4. If perpendicular distance > `width/2` at the interpolated point → off-road (lava).
5. Grace zone: 5px. The actual kill boundary is `width/2 + 5`.

### Lava

Everything not road is lava.

- Fill the entire canvas background with an animated lava pattern before drawing the road.
- Lava visual: tiled 32×32 sprite, 3-frame animation at 3 FPS. Colors: base `#c0400a`, highlights `#e06010`, `#ff8020`.
- Touching lava = instant death (see Respawn System).

### Camera

- **1P:** Camera center = `player.position + lookAheadOffset`. `lookAheadOffset` is 150px in the player's facing direction (so you see more road ahead).
- **2P:** Camera center = `lerp(midpoint(p1, p2), leader.position, 0.3)`, where `leader` is the player further along the track.
- Camera smoothing: `camera.position = lerp(camera.position, target, 0.08)` per frame.
- Camera is axis-aligned (no rotation). The road curves within world space; the camera just pans.
- Viewport size: 480×854 pixels (9:16 at 480px wide). Rendered to canvas, then CSS-scaled to fit browser window maintaining aspect ratio.

---

## 5. Obstacles

### 5.1 Arrow Pad (Speed Boost)

- **Hitbox:** Rectangle, 64×48 px.
- **Visual:** Green/cyan rectangle with a bright upward arrow. 3-frame glow pulse at 6 FPS.
- **Collision type:** AABB.
- **Effect:** On contact, set `player.speed = player.maxSpeed * 1.5`. Apply a `boostTimer = 2.0` (seconds). While `boostTimer > 0`, maxSpeed is temporarily increased by 50%. When timer expires, speed clamps back to normal maxSpeed.
- **Cooldown:** A player can only trigger the same pad once per pass (flag resets when player moves 200px away).

### 5.2 Spikes (Static)

- **Hitbox:** Rectangle, width varies per placement (40–80% of road width at that point), height 24px.
- **Visual:** Metallic gray triangular spikes. Static sprite.
- **Collision type:** AABB.
- **Effect:** Instant death → respawn.
- **Placement rule:** Never span full road width. Always leave a gap ≥ 60px for the player to pass.

### 5.3 Logs (Knockback)

- **Hitbox:** Rectangle, 80×20 px (can be rotated via `angle`).
- **Visual:** Brown log with bark texture. Static sprite.
- **Collision type:** Rotated AABB (OBB). Use Separating Axis Theorem or project player circle onto log axes.
- **Effect:** On collision:
  1. `player.speed = 0` (instant stop).
  2. Push player backward along their facing direction by `BASE_KNOCKBACK * (1 - player.weight)` px. `BASE_KNOCKBACK = 60`.
  3. 0.3s stun (input ignored, player flashes).
- **Does NOT kill.**

### 5.4 Rotating Spikes (Dynamic)

- **Hitbox:** Circle, radius 20px (center of sprite).
- **Visual:** 48×48 px saw blade sprite, 8-frame rotation animation at 12 FPS. Red/orange glow.
- **Collision type:** Circle-circle (player hitbox is also circle, radius 12px centered on sprite).
- **Behavior:**
  - Always visually spinning (animation).
  - If `patrolDistance > 0`: oscillates along `patrolAxis` using `sin(time * patrolSpeed / patrolDistance) * patrolDistance` offset from base position.
- **Effect:** Instant death → respawn.

### Obstacle Collision Priority

Check in this order each frame:
1. Rotating spikes (circle-circle, cheapest).
2. Static spikes (AABB).
3. Logs (OBB).
4. Arrow pads (AABB).
5. Road bounds / lava (point-in-polygon).

If a player is in the invincibility window (post-respawn), skip all lethal checks (spikes, rotating spikes, lava). Logs still apply knockback during invincibility (non-lethal).

---

## 6. Respawn System

Trigger: player touches lava, static spikes, or rotating spikes.

1. **Freeze:** Player is removed from physics. Play death animation (5 frames, 0.42s total).
2. **Respawn position:** Walk backward along the road centerline from death position by 200px. Place player at that centerline point, facing the road's forward direction at that point. If 200px back would be behind the start line, place at start.
3. **Ghost phase:** Player appears at respawn point, translucent (alpha 0.5), blinking (toggle alpha 0.5 / 1.0 every 0.1s).
4. **Invincibility:** 1.5 seconds. During this window, lethal obstacles and lava are ignored. Logs still knock back (non-lethal).
5. **Speed reset:** `player.speed = 0`. Player must re-accelerate.
6. **Death counter:** Increment `player.deaths` by 1.

In 2P: each player respawns independently. The other player is unaffected and keeps racing.

---

## 7. Track System

Three tracks ship at launch. All are unlocked from the start (no progression gates).

### Track Difficulty Tiers

| ID | Name | Difficulty | Road Width Range | Curve Severity | Obstacle Types | Notes |
|----|------|-----------|-----------------|---------------|---------------|-------|
| `sunday-drive` | Sunday Drive | easy | 220–280 px | Gentle bends only | Logs, arrow pads, few static spikes | Wide roads, forgiving. |
| `lava-gauntlet` | Lava Gauntlet | medium | 160–220 px | Moderate curves | All types, moderate density | Default track. Based on Olík's drawing. |
| `devils-highway` | Devil's Highway | hard | 120–180 px | Tight S-curves, hairpins | Dense rotating spikes, spike-log combos, narrow + curves | Punishing. |

### Lava Gauntlet — Segment Breakdown

This is the flagship track, translated from Olík's hand drawing. The track goes from bottom (high Y) to top (low Y) in world space. Total centerline length: ~5000px.

```
Segment 1 (Y: 5000→4600): Straight, width 240. START LINE at Y=5000.
  - Arrow pad at Y=4800, centered.

Segment 2 (Y: 4600→4200): Gentle right curve, width narrows 240→200.

Segment 3 (Y: 4200→3800): Straight, width 200.
  - Logs at Y=4100 (offset left 0.3), Y=4000 (offset right 0.4), Y=3900 (offset left 0.2).

Segment 4 (Y: 3800→3400): Straight, width 200.
  - Static spikes at Y=3700, spanning left 60% of road. Gap on right.
  - Static spikes at Y=3500, spanning right 50% of road. Gap on left.

Segment 5 (Y: 3400→2800): Left curve (moderate), width 200→180.

Segment 6 (Y: 2800→2400): Straight, width 180.
  - Arrow pad at Y=2700, centered.
  - Rotating spike at Y=2500, patrols X-axis, patrolDistance=60, patrolSpeed=40.

Segment 7 (Y: 2400→1800): S-curve (right then left), width 180→160 (narrows).

Segment 8 (Y: 1800→1200): Straight, width 160.
  - Rotating spike pair: Y=1700 (patrols left half), Y=1500 (patrols right half). Offset timing.
  - Logs at Y=1400 (centered), Y=1300 (offset right 0.3).

Segment 9 (Y: 1200→800): Gentle right curve, width widens 160→200.
  - Arrow pad at Y=1000, centered.

Segment 10 (Y: 800→400): Straight, width 200. FINISH LINE at Y=500.
  - Checkered banner visual across full road width.
```

The other two tracks (Sunday Drive, Devil's Highway) follow the same JSON format. They should be authored after the engine can render and play Lava Gauntlet. Use the segment breakdown above as a template.

---

## 8. Couch Multiplayer (Competitive, 2P)

### Shared Screen + Tether

Both players share one viewport. The camera follows `lerp(midpoint(p1, p2), leader, 0.3)`.

**Tether rules:**
1. Compute separation: `distance = |leader.trackProgress - trailer.trackProgress|` (distance along the road centerline, not Euclidean).
2. If separation > 400px: show a pulsing red arrow on the trailing player's screen edge, pointing toward the leader. Arrow opacity pulses 0.5–1.0 at 2 Hz.
3. If separation > 500px: teleport trailing player to `leader.trackProgress - 100px` on the road centerline, facing forward. Set `trailer.speed = 0`. Set `trailer.invincibleTimer = 1.5` (same as death respawn — prevents spawning onto spikes). Flash screen white for 0.1s. Play "woosh" sound.

### Player-Player Collision

- Both players have circle hitboxes (radius 12px).
- On overlap: push both apart along the collision normal so they no longer overlap. Apply push proportional to inverse weight: lighter player gets pushed more.
- Push formula: `pushForce = PUSH_STRENGTH / (weight + 0.1)`. `PUSH_STRENGTH = 120`. Apply as an impulse to velocity.

### Win Condition

- First player whose position crosses the finish line (Y ≤ finishLine Y) wins.
- Winner: play fanfare, confetti particle burst, victory text "P1 WINS!" / "P2 WINS!".
- Loser can still finish. Both times are recorded.
- After 5 seconds (or on any key press), transition to Results screen.

---

## 9. UI & HUD

All UI is rendered as React components overlaying the Canvas element.

### In-Game HUD

- **Timer:** Top-center. `MM:SS.mm` format. Font: "Press Start 2P" (Google Fonts), 16px, white with 2px black text shadow. Starts at `00:00.00`, counts up.
- **Death counter (per player):** Skull emoji + number. P1: top-left. P2: top-right. Same font, 12px.
- **Speed gauge (per player):** Bottom-left (P1) / bottom-right (P2). Semicircular arc, 60px wide. Filled from green (0%) through yellow (50%) to red (100% of maxSpeed). No numbers. Drawn on a small overlay `<canvas>` or SVG.
- **Tether warning (2P only):** Red pulsing arrow at screen edge when separation > 400px.
- **Countdown overlay:** Large centered text for 3-2-1-GO sequence. White text, 64px, with black outline.

### Screen Flow

```
TitleScreen → PlayerCountSelect → TrackSelect → CharacterSelect → GameScreen → ResultsScreen
                                                                          ↑            │
                                                                          └── Rematch ──┘
```

1. **TitleScreen:** Game logo ("Olíkův závod" in pixel font), animated lava background. "Press any key to start." On key → PlayerCountSelect.
2. **PlayerCountSelect:** "1 Player" / "2 Players" choice. Simple button/key selection. `1`/`2` key or click.
3. **TrackSelect:** Three track cards side by side. Each shows: name, difficulty badge (green/yellow/red), small preview (static thumbnail or mini-map). Arrow keys / click to select. `Enter` to confirm.
4. **CharacterSelect:** 5 character portraits in a row. Hover/select shows: name, stat bars (speed/handling/weight as horizontal bars). In 2P: split left/right, each player picks independently. If both pick the same character, P2 automatically gets the rival palette. `Enter` to confirm.
5. **GameScreen:** Canvas fills the viewport (maintaining 9:16 aspect). HUD overlay. `Escape` → PauseMenu overlay (Resume / Restart / Quit to Title).
6. **ResultsScreen:** Shows winner (2P), both players' finish times, death counts. Buttons: "Rematch" (same track + characters) / "Track Select" / "Quit to Title".

---

## 10. Visual Style

### Canvas Setup

- Internal resolution: 480×854 px (9:16).
- Canvas element is centered in the browser window.
- CSS: `image-rendering: pixelated; image-rendering: crisp-edges;`
- The `<body>` background behind the canvas: a static tiled lava pattern (same as in-game lava tile, but darker/desaturated — `#4a1a05`).
- Scale canvas to fit viewport height while maintaining aspect ratio. Center horizontally.

### Color Palette

Use this fixed palette (PICO-8 inspired but not identical):

| Name | Hex | Use |
|------|-----|-----|
| Black | `#1a1a2e` | Background, outlines |
| Dark Gray | `#2a2a3a` | Road shoulder |
| Mid Gray | `#3a3a4a` | Road surface |
| Light Gray | `#666680` | Road markings |
| White | `#e8e8f0` | Text, edge lines |
| Lava Dark | `#8a2000` | Lava base |
| Lava Mid | `#c0400a` | Lava tile base |
| Lava Bright | `#e06010` | Lava highlight |
| Lava Glow | `#ff8020` | Lava brightest frame |
| Green | `#00c040` | Arrow pad, easy badge, speed gauge low |
| Cyan | `#00e0e0` | Arrow pad glow, boost particles |
| Yellow | `#e0c000` | Medium badge, speed gauge mid |
| Red | `#e02020` | Hard badge, speed gauge high, spike glow |
| Orange | `#e07020` | Rotating spike glow |
| Brown | `#6a4020` | Log base |
| Brown Light | `#8a6040` | Log bark highlights |
| Metal | `#808898` | Static spikes |
| Metal Light | `#a0a8b8` | Spike highlights |

### Sprite Dimensions Summary

| Asset | Size (px) | Frame Count | Notes |
|-------|-----------|-------------|-------|
| Player sprite | 32×32 | 8 directions × (2 idle + 4 driving + 5 death) = 88 frames | Sprite sheet: 8 columns (directions), 11 rows (animation frames) |
| Arrow pad | 64×48 | 3 (glow pulse) | |
| Spike strip | variable width × 24 | 1 (static) | Width set per placement |
| Log | 80×20 | 1 (static) | Drawn rotated per placement angle |
| Rotating spike | 48×48 | 8 (spin) | |
| Lava tile | 32×32 | 3 (animated) | Tileable |
| Road tile | 32×32 | 1 per variant (straight, edge-left, edge-right) | Tileable |
| Finish banner | full road width × 48 | 1 | Checkered black/white pattern |
| Countdown numbers | 64×64 | "3", "2", "1", "GO!" as individual sprites or rendered text | |

### Particle Effects

Simple particle system. Each particle: position, velocity, lifetime, color, size.

| Effect | Particle Count | Colors | Lifetime | Trigger |
|--------|---------------|--------|----------|---------|
| Death explosion | 12 | Character's palette colors | 0.5s | Player dies |
| Boost trail | 3 per frame (while boosted) | Cyan, White | 0.3s | Arrow pad active |
| Respawn sparkle | 8 | White, Cyan | 0.4s | Player respawns |
| Confetti (finish) | 30 | Random from palette | 2.0s | Cross finish line |

---

## 11. Audio

### Implementation

Use the Web Audio API directly (no library). Create an `AudioManager` class that:
- Loads audio files on game init.
- Exposes `play(soundId)`, `playLoop(soundId)`, `stop(soundId)`, `setVolume(soundId, vol)`.
- Handles AudioContext resume on first user interaction (browser autoplay policy).

### Sound Effects

Generate all SFX programmatically using the Web Audio API oscillator/noise nodes at build time, OR use jsfxr presets exported as base64 data URIs embedded in the code. Do NOT rely on external audio file downloads.

| ID | Description | Generation Approach |
|----|-------------|-------------------|
| `sfx_engine` | Low hum, pitch proportional to speed | Oscillator: sawtooth wave, frequency 80–200 Hz mapped to speed. Gain 0.15. |
| `sfx_boost` | Rising whoosh, 0.3s | White noise with bandpass filter sweep 200→2000 Hz over 0.3s. Gain 0.3. |
| `sfx_death` | Cartoonish pop, 0.2s | Noise burst + sine sweep 400→100 Hz. Gain 0.4. |
| `sfx_log` | Woody thunk, 0.15s | Noise burst filtered through lowpass 300 Hz. Short envelope. Gain 0.3. |
| `sfx_spike` | Metallic clang, 0.2s | Square wave 800 Hz decaying, mixed with noise. Gain 0.3. |
| `sfx_honk` | Silly horn, 0.3s | Square wave, frequency 300 Hz with vibrato. Gain 0.3. |
| `sfx_countdown_beep` | Short beep, 0.1s | Sine wave. 220 Hz ("3"), 330 Hz ("2"), 440 Hz ("1"). Gain 0.3. |
| `sfx_go` | Horn blast, 0.3s | Sawtooth 440 Hz + 554 Hz (major third chord). Gain 0.4. |
| `sfx_finish` | Triumphant jingle, 1s | Sequence: C5 E5 G5 C6, each 0.2s, sine wave. Gain 0.3. |
| `sfx_respawn` | Ethereal chime, 0.3s | Sine 880 Hz with slow attack, reverb (convolver or delay). Gain 0.2. |
| `sfx_tether_woosh` | Fast woosh, 0.2s | Bandpass noise sweep, high to low. Gain 0.3. |
| `sfx_sad_trombone` | Descending sad tones, 1s | Sawtooth: Bb3 A3 Ab3 G3, each 0.25s. Gain 0.3. |

### Music

For v1, implement a simple looping chiptune using Web Audio API oscillators. Three tracks:

| ID | Screen | Tempo | Key | Character |
|----|--------|-------|-----|-----------|
| `music_menu` | Title, Select screens | 120 BPM | C major | Upbeat, bouncy 8-bar loop. Square wave lead + triangle bass. |
| `music_race` | GameScreen | 140 BPM | A minor | Driving energy, 16-bar loop. Pulse wave lead + sawtooth bass + noise hi-hat. |
| `music_results` | ResultsScreen | 100 BPM | F major | Chill, 8-bar loop. Sine lead + triangle bass. |

Music is low priority. Start with SFX only. Music can be added in a polish pass.

---

## 12. Localization (i18next)

### Setup

Install `i18next` and `react-i18next`. Initialize in `src/i18n/index.ts`:

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import cs from "./cs";
import en from "./en";

i18n.use(initReactI18next).init({
  resources: {
    cs: { translation: cs },
    en: { translation: en },
  },
  lng: "cs",              // Czech is the default language
  fallbackLng: "en",
  interpolation: { escapeValue: false },  // React already escapes
});

export default i18n;
```

Import `src/i18n/index.ts` in `main.tsx` before `createRoot`.

### Usage in Components

All user-visible strings in React components must use the `useTranslation` hook:

```typescript
import { useTranslation } from "react-i18next";

function TitleScreen() {
  const { t } = useTranslation();
  return <h1>{t("title")}</h1>;
}
```

For canvas-rendered text (HUD timer, countdown, in-game messages), pass the `t` function into the renderer or read translations via `i18n.t("key")` directly in game code.

### Language Switcher

Add a small toggle in the TitleScreen and PauseMenu: a flag icon or "CZ / EN" text button. On click:

```typescript
i18n.changeLanguage(i18n.language === "cs" ? "en" : "cs");
```

### String Catalogue

Every user-visible string in the game. Translation keys use flat dot-less naming. Both languages must have identical keys.

```typescript
// src/i18n/cs.ts
export default {
  // Title screen
  title: "Olíkův závod",
  press_any_key: "Stiskni libovolnou klávesu",

  // Player count select
  one_player: "1 hráč",
  two_players: "2 hráči",

  // Track select
  track_select: "Vyber trať",
  track_sunday_drive: "Nedělní projížďka",
  track_lava_gauntlet: "Lávová výzva",
  track_devils_highway: "Ďáblova silnice",
  difficulty_easy: "Lehká",
  difficulty_medium: "Střední",
  difficulty_hard: "Těžká",

  // Character select
  character_select: "Vyber vozidlo",
  character_select_p1: "Hráč 1 — vyber vozidlo",
  character_select_p2: "Hráč 2 — vyber vozidlo",
  char_formula: "Formule",
  char_yeti: "Škoda Yeti",
  char_cat: "Kočka",
  char_pig: "Prasátko",
  char_frog: "Žabák",
  stat_speed: "Rychlost",
  stat_handling: "Ovládání",
  stat_weight: "Váha",
  confirm: "Potvrdit",

  // Countdown
  countdown_go: "START!",

  // HUD
  deaths: "Úmrtí",

  // Pause menu
  paused: "Pauza",
  resume: "Pokračovat",
  restart: "Restartovat",
  quit_to_title: "Hlavní menu",
  language: "Jazyk",

  // Results screen
  results: "Výsledky",
  winner: "Vítěz",
  p1_wins: "Hráč 1 vyhrál!",
  p2_wins: "Hráč 2 vyhrál!",
  time: "Čas",
  death_count: "Počet úmrtí",
  rematch: "Odveta",
  track_select_btn: "Výběr tratě",

  // Tether
  tether_warning: "Dojíždíš!",
} as const;
```

```typescript
// src/i18n/en.ts
export default {
  // Title screen
  title: "Olík's Race",
  press_any_key: "Press any key",

  // Player count select
  one_player: "1 Player",
  two_players: "2 Players",

  // Track select
  track_select: "Select Track",
  track_sunday_drive: "Sunday Drive",
  track_lava_gauntlet: "Lava Gauntlet",
  track_devils_highway: "Devil's Highway",
  difficulty_easy: "Easy",
  difficulty_medium: "Medium",
  difficulty_hard: "Hard",

  // Character select
  character_select: "Choose Your Ride",
  character_select_p1: "Player 1 — choose your ride",
  character_select_p2: "Player 2 — choose your ride",
  char_formula: "Formula",
  char_yeti: "Škoda Yeti",
  char_cat: "Cat",
  char_pig: "Pig",
  char_frog: "Frog",
  stat_speed: "Speed",
  stat_handling: "Handling",
  stat_weight: "Weight",
  confirm: "Confirm",

  // Countdown
  countdown_go: "GO!",

  // HUD
  deaths: "Deaths",

  // Pause menu
  paused: "Paused",
  resume: "Resume",
  restart: "Restart",
  quit_to_title: "Quit to Title",
  language: "Language",

  // Results screen
  results: "Results",
  winner: "Winner",
  p1_wins: "Player 1 wins!",
  p2_wins: "Player 2 wins!",
  time: "Time",
  death_count: "Deaths",
  rematch: "Rematch",
  track_select_btn: "Track Select",

  // Tether
  tether_warning: "Catch up!",
} as const;
```

### Rules for Adding New Strings

- **Never hardcode user-visible text** in components or game code. Always use `t("key")`.
- Add the key to BOTH `cs.ts` and `en.ts` at the same time.
- Canvas-rendered text (countdown numbers "3", "2", "1") are numeric and do NOT need translation. Only the "GO!" / "START!" text is translated.
- Character names that are proper nouns (e.g., "Škoda Yeti") stay the same in both languages. But they still go through i18next so they can be overridden if needed.
- Track names are localized (e.g., "Sunday Drive" → "Nedělní projížďka").

---

## 13. Technical Architecture

### Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Build | Vite | Dev server + production build |
| Language | TypeScript | Strict mode |
| UI Shell | React 18+ | Screens, menus, HUD overlays. `createRoot`. |
| Game Rendering | HTML5 Canvas 2D | One `<canvas>` element managed outside React's render cycle |
| Game Loop | `requestAnimationFrame` | Fixed timestep physics, interpolated rendering |
| Physics | Custom | No library. Simple circle + AABB + OBB. |
| Input | Keyboard `addEventListener` + Gamepad API polling | Abstracted to PlayerInput interface |
| Audio | Web Audio API | Programmatic SFX. No external audio files for v1. |
| i18n | i18next + react-i18next | Czech default, English fallback. All UI strings localized from day one. |
| Font | Google Fonts: "Press Start 2P" | Pixel font for all game text |

### Project Structure

```
olikuv-zavod/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── fonts/                       # Fallback font files if Google Fonts unavailable
├── src/
│   ├── main.tsx                     # ReactDOM.createRoot, mount App
│   ├── App.tsx                      # Screen router (React state machine)
│   ├── screens/
│   │   ├── TitleScreen.tsx
│   │   ├── PlayerCountSelect.tsx
│   │   ├── TrackSelect.tsx
│   │   ├── CharacterSelect.tsx
│   │   ├── GameScreen.tsx           # Mounts <canvas>, starts game loop, renders HUD overlay
│   │   └── ResultsScreen.tsx
│   ├── game/
│   │   ├── engine.ts                # startGame(), stopGame(), game loop with fixed timestep
│   │   ├── state.ts                 # GameState type, initial state factory
│   │   ├── player.ts                # Player entity: physics update, state transitions
│   │   ├── camera.ts                # Camera follow, lerp, 2P midpoint logic
│   │   ├── track.ts                 # Load TrackData JSON, build road geometry, road-point queries
│   │   ├── obstacles.ts             # Obstacle update logic (patrol, animation timers)
│   │   ├── collision.ts             # AABB, OBB, circle-circle, point-on-road tests
│   │   ├── particles.ts             # Particle emitter + updater
│   │   ├── input.ts                 # Keyboard listener + Gamepad poller → PlayerInput
│   │   ├── renderer.ts              # Canvas draw calls: road, lava, obstacles, players, particles
│   │   ├── audio.ts                 # AudioManager: Web Audio API SFX + music
│   │   └── countdown.ts             # Countdown state machine (3-2-1-GO)
│   ├── i18n/
│   │   ├── index.ts                 # i18next init (lng: "cs", fallbackLng: "en")
│   │   ├── cs.ts                    # Czech translations (default language)
│   │   └── en.ts                    # English translations
│   ├── data/
│   │   ├── characters.ts            # Character stat definitions (the table from section 2)
│   │   └── tracks/
│   │       ├── sunday-drive.ts      # TrackData for easy track
│   │       ├── lava-gauntlet.ts     # TrackData for medium track
│   │       └── devils-highway.ts    # TrackData for hard track
│   ├── types/
│   │   └── index.ts                 # Shared TypeScript interfaces (TrackData, PlayerInput, Vec2, etc.)
│   └── utils/
│       ├── math.ts                  # vec2 operations, lerp, clamp, distance, angle helpers
│       └── constants.ts             # All tuning constants in one place
```

### Game Loop (engine.ts)

```typescript
const FIXED_TIMESTEP = 1 / 60;  // 16.67ms
let accumulator = 0;
let previousTime = 0;

function gameLoop(currentTime: number) {
  const deltaTime = (currentTime - previousTime) / 1000;  // ms to seconds
  previousTime = currentTime;
  accumulator += Math.min(deltaTime, 0.1);  // cap to prevent spiral of death

  while (accumulator >= FIXED_TIMESTEP) {
    updateInput(gameState);        // poll keyboard + gamepad → PlayerInput
    updateCountdown(gameState);    // if in countdown phase
    updatePlayers(gameState);      // physics, collision
    updateObstacles(gameState);    // patrol movement, animation timers
    updateCamera(gameState);       // follow target
    updateParticles(gameState);    // move, age, cull dead particles
    checkWinCondition(gameState);  // did anyone cross the finish?
    accumulator -= FIXED_TIMESTEP;
  }

  const alpha = accumulator / FIXED_TIMESTEP;  // interpolation factor
  render(gameState, alpha);        // draw everything, interpolated

  if (gameState.phase !== "finished") {
    requestAnimationFrame(gameLoop);
  }
}
```

### Game State (state.ts)

```typescript
interface GameState {
  phase: "countdown" | "racing" | "finished";
  countdownTimer: number;          // seconds remaining in countdown
  raceTimer: number;               // seconds elapsed since GO
  players: PlayerState[];          // 1 or 2 entries
  track: TrackData;
  camera: CameraState;
  obstacles: ObstacleState[];      // runtime obstacle state (position, animation frame)
  particles: Particle[];
  winner: number | null;           // player index, or null
}

interface PlayerState {
  characterId: string;
  position: Vec2;
  velocity: Vec2;
  angle: number;                   // radians
  speed: number;                   // scalar, signed (negative = reverse)
  maxSpeed: number;
  acceleration: number;
  handling: number;
  weight: number;
  brakeForce: number;
  boostTimer: number;              // seconds remaining of speed boost
  alive: boolean;
  deathTimer: number;              // seconds remaining of death animation
  invincibleTimer: number;         // seconds remaining of post-respawn invincibility
  stunTimer: number;               // seconds remaining of log stun
  deaths: number;
  finishTime: number | null;
  trackProgress: number;           // distance along road centerline (for tether calc)
  input: PlayerInput;
}

interface CameraState {
  position: Vec2;
  target: Vec2;
}

interface Vec2 {
  x: number;
  y: number;
}
```

### Constants (constants.ts)

All tunable values in one file for easy balancing:

```typescript
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 854;
export const FIXED_TIMESTEP = 1 / 60;
export const FRICTION_DECAY = 0.97;
export const REVERSE_SPEED_MULTIPLIER = 0.4;
export const BOOST_SPEED_MULTIPLIER = 1.5;
export const BOOST_DURATION = 2.0;            // seconds
export const BASE_KNOCKBACK = 60;             // px
export const LOG_STUN_DURATION = 0.3;         // seconds
export const DEATH_ANIMATION_DURATION = 0.42; // seconds
export const RESPAWN_DISTANCE = 200;          // px back along road
export const INVINCIBILITY_DURATION = 1.5;    // seconds
export const INVINCIBILITY_BLINK_RATE = 0.1;  // seconds per toggle
export const PLAYER_HITBOX_RADIUS = 12;       // px
export const CAMERA_LERP = 0.08;
export const CAMERA_LOOK_AHEAD = 150;         // px
export const CAMERA_LEADER_BIAS = 0.3;        // for 2P lerp
export const TETHER_WARNING_DISTANCE = 400;   // px along track
export const TETHER_TELEPORT_DISTANCE = 500;  // px along track
export const TETHER_TELEPORT_BEHIND = 100;    // px behind leader
export const PUSH_STRENGTH = 120;
export const COUNTDOWN_STEP_DURATION = 0.8;   // seconds per number
export const GO_DISPLAY_DURATION = 0.5;       // seconds
export const ARROW_PAD_RETRIGGER_DISTANCE = 200;  // px
export const LAVA_GRACE_ZONE = 5;             // px
export const ROTATING_SPIKE_HITBOX_RADIUS = 20;  // px
export const ROAD_EDGE_LINE_WIDTH = 2;
export const ROAD_CENTER_LINE_WIDTH = 4;
export const ROAD_CENTER_DASH = 20;           // px dash length
export const ROAD_CENTER_GAP = 20;            // px gap length
export const ROAD_SHOULDER_INSET = 8;         // px
```

---

## 14. Performance Targets

| Metric | Target |
|--------|--------|
| Frame rate | 60 FPS on mid-range laptop (2020 era, integrated GPU) |
| Internal resolution | 480×854 |
| Max active sprites | ~50 (players + obstacles + particles) |
| Memory | < 30MB (no external audio files in v1) |
| Initial load | < 2s (all assets are code-generated or tiny PNGs) |
| Input latency | ≤ 1 frame (16.67ms) |

---

## 15. Asset Strategy for v1

**Do NOT rely on external asset downloads or URLs.** All visual and audio assets must be either:

1. **Drawn programmatically on canvas at startup** (generate sprite sheets into offscreen canvases). This is the preferred approach for v1. Write a `generateSprites()` function that draws all sprites pixel-by-pixel onto offscreen canvases and caches them.

2. **Embedded as inline data** (base64 data URIs in TypeScript source files) if pixel art is pre-made.

### Programmatic Sprite Generation (Recommended for v1)

Write functions in a `src/game/sprites.ts` file:

- `generatePlayerSprites(characterId, palette)` → returns a sprite sheet as an `OffscreenCanvas` or `HTMLCanvasElement`. Draw each character as simple geometric shapes with the defined palette. Formula = sleek rectangle with spoiler. Yeti = boxy SUV shape. Cat = rounded with ears. Pig = circle with snout. Frog = wide oval with eyes.
- `generateObstacleSprites()` → arrow pad, spikes, log, rotating spike.
- `generateLavaTiles()` → 3-frame animated lava.
- `generateRoadTiles()` → road surface variants.

This avoids any dependency on external files and means the game runs from a single `npm run dev`.

### Font

Add to `index.html` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
```

Fallback: `monospace`.

---

## 16. Testing

### Philosophy

Three test layers. Unit and integration tests are recommended for game logic. **E2E tests via Playwright are mandatory** — every implementation step in the roadmap must have at least one passing Playwright test before moving to the next step.

### Stack

| Layer | Tool | Runs |
|-------|------|------|
| Unit tests | Vitest | `npm run test:unit` |
| Integration tests | Vitest | `npm run test:unit` (same runner, longer tests) |
| E2E tests | Playwright | `npm run test:e2e` |

Install: `vitest` (dev dep), `@playwright/test` (dev dep), `@testing-library/react` (dev dep for component tests).

### Project Structure (test files)

```
olikuv-zavod/
├── src/
│   ├── game/
│   │   ├── __tests__/
│   │   │   ├── collision.test.ts
│   │   │   ├── player.test.ts
│   │   │   ├── camera.test.ts
│   │   │   ├── track.test.ts
│   │   │   ├── obstacles.test.ts
│   │   │   └── countdown.test.ts
│   │   └── ...
│   ├── screens/
│   │   ├── __tests__/
│   │   │   ├── TitleScreen.test.tsx
│   │   │   ├── CharacterSelect.test.tsx
│   │   │   └── ResultsScreen.test.tsx
│   │   └── ...
│   └── utils/
│       └── __tests__/
│           └── math.test.ts
├── e2e/
│   ├── smoke.spec.ts
│   ├── single-player.spec.ts
│   ├── two-player.spec.ts
│   ├── menus.spec.ts
│   └── localization.spec.ts
├── playwright.config.ts
└── vitest.config.ts
```

### Unit Tests (Vitest)

Pure function tests. No DOM, no canvas, no React. Fast — run in < 2s total.

| Module | What to test |
|--------|-------------|
| `utils/math.ts` | `lerp`, `clamp`, `distance`, `normalizeAngle`, `vec2Add`, `vec2Scale` — edge cases (zero vectors, NaN, very large values) |
| `game/collision.ts` | `pointOnRoad` — point inside road returns true, point in lava returns false, point on grace zone edge returns true. `aabbOverlap` — overlapping, touching, separated boxes. `circleCircle` — overlapping, touching, separated. `obbOverlap` — rotated log at 0°, 45°, 90° vs player circle. |
| `game/player.ts` | Physics step: acceleration increases speed up to maxSpeed. Braking decreases speed. Friction decays speed when coasting. Reverse caps at 40% maxSpeed. Steering at zero speed does nothing. Steering inverts when reversing (speed < 0). Boost multiplier applies and expires. Stun timer blocks input. |
| `game/camera.ts` | 1P: camera follows player with look-ahead. 2P: camera targets lerped midpoint. Lerp factor smooths movement. |
| `game/track.ts` | `nearestRoadPoint` — finds correct segment. `trackProgressAt` — returns correct distance along centerline. Road width interpolation between points. |
| `game/obstacles.ts` | Rotating spike patrol: position oscillates correctly over time. Arrow pad cooldown: retrigger blocked within 200px, allowed after. Log knockback: weight reduces knockback correctly (weight=0 → full 60px, weight=0.85 → 9px). |
| `game/countdown.ts` | Timer decrements correctly. Phase transitions: 3→2→1→GO→racing. Input locked during countdown, unlocked on GO. |
| `data/characters.ts` | All 5 characters have all required stat fields. No NaN or zero values in maxSpeed, acceleration, handling, brakeForce. All character IDs are unique. |

### Integration Tests (Vitest)

Test multiple modules working together. May use lightweight DOM mocking for React components (`@testing-library/react`). No browser needed.

| Test | What it covers |
|------|---------------|
| Player + Collision | Drive a player into a log → verify speed=0 and position knocked back by correct amount. Drive into spikes → verify `alive=false`. Drive off road → verify lava death triggers. |
| Player + Boost | Drive over arrow pad → verify speed increases to 1.5× maxSpeed → verify speed clamps back after 2s. |
| Player + Respawn | Kill player → verify death timer runs → verify respawn position is 200px back on road centerline → verify invincibility timer set to 1.5s → verify speed is 0. |
| 2P Tether | Place P1 at trackProgress=1000 and P2 at trackProgress=400 → separation=600 > 500 → verify P2 teleported to trackProgress=900 with invincibleTimer=1.5 and speed=0. |
| 2P Push | Overlap two players → verify both pushed apart along collision normal. Verify lighter player (lower weight) is pushed further. |
| Countdown + Input | Simulate countdown → verify input ignored during countdown → verify input accepted after GO. |
| i18n | Verify all keys in `cs.ts` exist in `en.ts` and vice versa. Verify `i18n.t("title")` returns Czech by default. Verify `i18n.changeLanguage("en")` switches all strings. |

### E2E Tests (Playwright) — MANDATORY

Every Playwright test launches the app in a real Chromium browser, interacts via keyboard/mouse, and asserts on visible UI state. These are the **gate** — a step is not done until its E2E tests pass.

#### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:5173",  // Vite dev server
    headless: true,
    viewport: { width: 480, height: 854 },  // Match game aspect ratio
  },
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

#### E2E Test Specification

Each test file below maps to implementation steps. Tests use `page.keyboard.down()` / `page.keyboard.up()` to simulate held keys (not `page.keyboard.press()` which is tap-and-release).

**`e2e/smoke.spec.ts`** — Gate for step 1 (Scaffold)
```
- "app loads and shows title screen"
  → Navigate to /
  → Expect text matching t("title") ("Olíkův závod") visible within 3s
  → Expect text matching t("press_any_key") visible
```

**`e2e/single-player.spec.ts`** — Gate for steps 2–8
```
- "player can navigate to game and see canvas"
  → Press any key on title → select 1P → select track → select character → confirm
  → Expect <canvas> element visible
  → Expect countdown text visible ("3")

- "player can drive forward after countdown"
  → Start a 1P game, wait for countdown to finish (~3s)
  → Hold KeyW for 2 seconds
  → Read canvas state: verify player Y position has decreased (moved up/forward)
  → (Implementation detail: expose gameState on window in dev mode for assertions,
     e.g., window.__gameState. Guard behind import.meta.env.DEV.)

- "player dies on lava and respawns"
  → Start a 1P game, wait for countdown
  → Hold KeyW + KeyA (drive left off road) for 3 seconds
  → Verify death counter in HUD shows ≥ 1

- "player can pause and resume"
  → Start a 1P game, wait for countdown
  → Press Escape
  → Expect pause menu visible (t("paused"))
  → Press Escape again or click Resume
  → Expect pause menu hidden

- "player can complete a race"
  → Start a 1P game on Sunday Drive (easy)
  → Hold KeyW for 65 seconds (should finish even with some wandering)
  → Expect results screen visible (t("results"))
  → Expect time displayed
```

**`e2e/two-player.spec.ts`** — Gate for step 9
```
- "two players can race simultaneously"
  → Select 2P mode → pick track → both pick characters
  → After countdown, hold KeyW (P1) and ArrowUp (P2) simultaneously
  → Verify both players are moving (gameState.players[0] and [1] Y decreasing)

- "tether teleports trailing player"
  → Start 2P game
  → Hold KeyW (P1 drives forward), do NOT press ArrowUp (P2 stays still)
  → After ~5 seconds, verify P2's trackProgress has jumped (tether teleport)

- "first to finish wins"
  → Start 2P on Sunday Drive
  → Hold KeyW (P1 drives). Do not move P2 (P2 will get tethered but won't finish first).
  → When P1 finishes, expect t("p1_wins") visible on results screen
```

**`e2e/menus.spec.ts`** — Gate for step 10
```
- "full menu flow: title → player count → track → character → game"
  → Verify each screen appears in sequence
  → Verify track select shows 3 tracks with correct names
  → Verify character select shows 5 characters with stat bars
  → Verify game starts after final confirm

- "results screen shows rematch and track select"
  → Complete a race
  → Verify t("rematch") button visible
  → Click rematch → verify game restarts on same track
```

**`e2e/localization.spec.ts`** — Gate for i18n correctness
```
- "app defaults to Czech"
  → Navigate to /
  → Expect t("title") in Czech: "Olíkův závod"
  → Expect t("press_any_key") in Czech: "Stiskni libovolnou klávesu"

- "language can be switched to English"
  → Navigate to /
  → Click language toggle
  → Expect title to change to "Olík's Race"
  → Expect "Press any key" visible

- "language persists through menu flow"
  → Switch to English on title screen
  → Navigate through menus
  → Verify track names are in English ("Sunday Drive", not "Nedělní projížďka")
  → Verify character select labels are in English
```

#### Dev-Mode Game State Exposure

For E2E assertions on game logic (player position, death count, track progress), expose the game state in dev mode only:

```typescript
// In engine.ts, after each update:
if (import.meta.env.DEV) {
  (window as any).__gameState = gameState;
}
```

Playwright tests can then read it:

```typescript
const deaths = await page.evaluate(() => (window as any).__gameState?.players[0]?.deaths ?? 0);
expect(deaths).toBeGreaterThanOrEqual(1);
```

This is stripped from production builds by Vite's dead code elimination.

#### CI Integration

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "test": "vitest run && playwright test"
  }
}
```

All tests must pass before merging any PR. The `npm test` command runs both suites sequentially.

---

## 17. Implementation Order

Build in this order. Each step should result in a runnable game. **E2E tests are mandatory gates** — a step is not complete until its Playwright tests pass. Unit tests are written alongside each step for the modules it touches.

1. **Scaffold:** Vite + React + TypeScript project. Canvas element rendering a colored rectangle. Install `i18next`, `react-i18next`, `vitest`, `@playwright/test`. Set up `src/i18n/index.ts` with `cs.ts` and `en.ts` translation files. Set up `vitest.config.ts` and `playwright.config.ts`. All UI strings go through `t()` from the start — never hardcode text.
   - **E2E gate:** `smoke.spec.ts` — app loads, title screen visible in Czech.
   - **E2E gate:** `localization.spec.ts` — Czech default, EN switch works.

2. **Road rendering:** Load Lava Gauntlet track data. Render road quads on canvas. Render lava background (solid color first, tiled later). Camera pans when dragging with mouse (temporary debug control).
   - **Unit tests:** `track.test.ts` — road point queries, width interpolation.
   - **Unit tests:** `math.test.ts` — vec2 ops, lerp, clamp.

3. **Player movement:** One player drives on the road. Keyboard input (WASD). Physics as specified. No collision yet — just driving.
   - **Unit tests:** `player.test.ts` — acceleration, braking, friction decay, reverse cap, steering.

4. **Collision + death:** Lava kills (point-on-road test). Respawn system. Death animation (simple flash for now). Invincibility blink.
   - **Unit tests:** `collision.test.ts` — pointOnRoad, AABB, circle-circle.
   - **Integration tests:** player + collision (drive off road → death → respawn).
   - **E2E gate:** `single-player.spec.ts` — "player dies on lava and respawns".

5. **Obstacles:** Add all 4 obstacle types to track data. Collision detection. Arrow pad boost. Log knockback. Spike death. Rotating spike patrol + death.
   - **Unit tests:** `obstacles.test.ts` — patrol oscillation, cooldown, knockback math.
   - **Integration tests:** player + boost, player + log knockback, player + spike death.

6. **Camera polish:** Look-ahead bias. Smooth lerp. Viewport correctly sized at 480×854.
   - **Unit tests:** `camera.test.ts` — 1P follow, 2P midpoint, lerp factor.

7. **HUD:** Timer, death counter, speed gauge. React overlay.
   - **E2E gate:** `single-player.spec.ts` — "player can drive forward after countdown" (HUD visible).

8. **Countdown:** 3-2-1-GO sequence with input locking.
   - **Unit tests:** `countdown.test.ts` — phase transitions, input lock/unlock.
   - **E2E gate:** `single-player.spec.ts` — canvas visible, countdown text shown.

9. **2P competitive:** Second player input. Shared camera with tether. Player-player collision. Win condition.
   - **Integration tests:** tether teleport, player-player push.
   - **E2E gate:** `two-player.spec.ts` — all three scenarios (simultaneous racing, tether, first-to-finish wins).

10. **Menus:** Title → PlayerCount → TrackSelect → CharacterSelect → Game → Results flow. Character stats applied.
    - **Component tests:** `TitleScreen.test.tsx`, `CharacterSelect.test.tsx`, `ResultsScreen.test.tsx`.
    - **E2E gate:** `menus.spec.ts` — full flow, rematch.
    - **E2E gate:** `single-player.spec.ts` — "player can pause and resume", "player can complete a race".

11. **Sprites:** Replace colored rectangles with programmatically generated pixel art sprites.

12. **Audio:** Web Audio API SFX. Engine hum, boost, death, log, spike, honk, countdown beeps, finish fanfare.

13. **Particles:** Death explosion, boost trail, respawn sparkle, finish confetti.

14. **Additional tracks:** Author Sunday Drive and Devil's Highway track data.

15. **Polish:** Music loops, rival palette recolors, screen transitions, edge cases.

---

## Appendix: Resolved Decisions

| Question | Decision |
|----------|----------|
| Orientation | Portrait, 9:16 |
| Difficulty model | Track-based (easy/medium/hard) |
| Multiplayer mode | Competitive (first to finish wins) |
| Character abilities | None for v1 (stretch goal) |
| Track length | ~60 seconds clean run |
| Roster | Formula, Škoda Yeti, Cat, Pig, Frog |
| Race start | 3-2-1-GO countdown |
| Track unlocking | All available from start |
| Respawn penalty | Distance-based (~200px back) |
| Škoda Yeti style | Realistic-ish pixel SUV |
| Game name | Olíkův závod |
| Localization | i18next, Czech default (`cs`), English fallback (`en`). All UI strings localized from day one. |

## Appendix: Stretch Goals (NOT in v1 scope)

- Character abilities (Frog hops logs, Cat dashes, Yeti immune to first log, Pig bounces off walls, Formula double boost)
- Online leaderboard
- Track editor
- Unlockable characters
- Power-ups (shield, magnet, speed)
- Ghost mode (race your best run)
- Split screen mode
- Mobile controls (virtual joystick)
- Rive animations for sprites
- Co-op mode (shared victory variant)
