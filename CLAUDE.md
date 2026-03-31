# Olíkův závod — Project Guide

## Overview

Top-down vertical-scrolling racing game. React 19 + TypeScript + Vite + HTML5 Canvas + Web Audio API. 1-4 player local multiplayer. 6 characters, 3 tracks, all assets procedurally generated (no image/audio files).

## Commands

```
npm run dev          # Dev server (port 3000)
npm run build        # TypeScript check + Vite build (~320KB, ~98KB gzip)
npm run test         # Vitest (382 tests)
npm run test:e2e     # Playwright (12 tests, needs port 4174)
npm run lint         # TypeScript --noEmit
```

## Architecture

### Game Loop (`src/game/engine.ts`)
Fixed 1/60s timestep with accumulator. Per tick: input → countdown → player physics → road collision → obstacle collision → car-car collision → respawn → track progress → obstacles → camera → particles → win check → tether.

Two-phase rendering: lava background at raw canvas resolution (fills window), then game content with uniform `Math.min` scaling to preserve aspect ratio.

### Rendering (`src/game/renderer.ts` + `src/game/vector-sprites.ts`)
All sprites are vector (canvas paths) — no bitmaps. `vector-sprites.ts` exports:
- `drawPlayerVector(ctx, characterId, palette, size)` — 6 character designs
- `drawObstacleVector(ctx, type, frame, width, height)` — 4 obstacle types
- `drawLavaTile(frame)` — cached 128x128 seamless lava tiles (3 frames)

Canvas: 480x854 virtual viewport, dynamically scaled to window via `ctx.scale()`.

### Player Physics (`src/game/player.ts`)
- Acceleration: `speed += acceleration * input * dt`, capped at `maxSpeed`
- Braking: `speed -= brakeForce * dt`, reverse cap at `-maxSpeed * 0.4`
- Friction: `speed *= 0.97` when no input
- Steering: `angle -= handling * steerX * (speed/maxSpeed) * dt` (right = clockwise)
- Boost: arrow pads set speed to 1.5x maxSpeed for 2s
- Death: respawn 200px back, 1.5s invincibility

### Input (`src/game/input.ts`)
P1: Arrows + Enter | P2: WASD + Space | P3: IJKL + H | P4: Numpad 8456 + Num0. Gamepad API support (index → player).

### State (`src/game/state.ts`)
Factory: `createGameState(config, track)`. Types in `src/types/index.ts`. Key interfaces: `GameState`, `PlayerState`, `TrackData`, `ObstacleState`.

### Audio (`src/game/audio.ts`)
Web Audio API synthesis. 12 SFX (engine with 4-gear transmission, boost, death, log, spike, honk, countdown, go, finish, respawn, tether, sad trombone). 3 music loops (menu, race, results).

## Data

### Characters (`src/data/characters.ts`) — 6 total
| ID | Speed | Accel | Handling | Weight |
|----|-------|-------|----------|--------|
| formula | 280 | 200 | 1.8 | 0.15 |
| yeti | 180 | 100 | 1.5 | 0.85 |
| cat | 220 | 160 | 2.2 | 0.15 |
| pig | 260 | 180 | 1.1 | 0.75 |
| frog | 230 | 150 | 1.6 | 0.45 |
| toilet | 200 | 130 | 1.4 | 0.65 |

### Tracks (`src/data/tracks/`) — 3 total
- `sunday-drive.ts` — easy, wide roads (230-280px)
- `lava-gauntlet.ts` — medium, flagship track
- `devils-highway.ts` — hard, narrow (120-180px)

Track format: `RoadPoint[]` polyline with `{x, y, width}`, obstacles as `ObstaclePlacement[]`.

### Obstacles — 4 types
- `arrow_pad` — boost forward 1.5x for 2s
- `spikes` — instant death
- `log` — knockback + 0.3s stun
- `rotating_spikes` — patrolling death, `boostAngle` preserves original direction

## Conventions

- Types: `PascalCase` | Functions: `camelCase` | Constants: `UPPER_SNAKE_CASE`
- Factories: `create*` | Updates: `update*` | Checks: `is*`/`check*`
- All user-visible strings through i18n (`useTranslation()` or `i18n.t()`)
- Czech is default language, English is fallback
- Tests alongside source in `__tests__/` directories

## Adding Things

**Character:** `src/data/characters.ts` → `src/game/vector-sprites.ts` (drawPlayerVector case) → `src/screens/CharacterSelect.tsx` (CarIcon case) → `src/i18n/{cs,en}.ts`

**Track:** Create `src/data/tracks/id.ts` exporting `TrackData` → import in `src/screens/GameScreen.tsx` trackMap → add i18n keys

**Obstacle type:** `src/types/index.ts` → `src/game/obstacles.ts` (creation + collision) → `src/game/vector-sprites.ts` (drawing) → `src/game/renderer.ts` (render dispatch)

## Key Files

1. `src/types/index.ts` — all interfaces
2. `src/game/engine.ts` — game loop + car collisions
3. `src/game/player.ts` — driving physics
4. `src/game/renderer.ts` — rendering pipeline
5. `src/game/vector-sprites.ts` — vector sprite drawing
6. `src/utils/constants.ts` — all tuning values + color palette
7. `src/App.tsx` — screen routing
8. `olirace.md` — original game design spec
