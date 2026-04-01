# Olíkův závod — Project Guide

## Overview

Top-down vertical-scrolling racing game. React 19 + TypeScript + Vite + HTML5 Canvas + Web Audio API. 1-4 player local multiplayer with 0-3 AI bot opponents (max 4 total racers). 6 characters, 6 tracks, all assets procedurally generated (no image/audio files).

## Commands

```
npm run dev          # Dev server (port 3000)
npm run build        # TypeScript check + Vite build (~320KB, ~98KB gzip)
npm run test         # Vitest (427 tests)
npm run test:e2e     # Playwright (12 tests, needs port 4174)
npm run lint         # TypeScript --noEmit
```

## Architecture

### Game Loop (`src/game/engine.ts`)
Fixed 1/60s timestep with accumulator. Per tick: input → countdown → player physics → road collision → obstacle collision → car-car collision → respawn → track progress → obstacles → camera → particles → win check → tether.

Two-phase rendering: lava background at raw canvas resolution (fills window), then game content with uniform `Math.min` scaling to preserve aspect ratio.

### Rendering (`src/game/renderer.ts` + `src/game/vector-sprites.ts`)
All sprites are vector (canvas paths) — no bitmaps. `vector-sprites.ts` exports:
- `drawPlayerVector(ctx, characterId, palette, size)` — 6 cartoony character designs (thick outlines, googly eyes, rosy cheeks)
- `drawObstacleVector(ctx, type, frame, width, height)` — obstacle types
- `drawLavaTile(frame)` — cached 128x128 seamless lava tile (pixel-based Voronoi, static, wrapping-distance math)

Canvas: 480x854 virtual viewport, dynamically scaled to window via `ctx.scale()`.

Rendering pipeline (in order): lava (parallax 30%) → road shadow → orange underglow → road surface + asphalt texture → rumble strips → edge markings + guard rail posts → center line → skid marks → start/finish → obstacle shadows + danger glow + obstacles (1.25x) → player shadows + players (64px) + googly eyes + expressions → particles → position indicators → comic text → random events → countdown spotlight → vignette.

Visual systems: skid marks (persistent on road), comic text popups ("POW!", "SPLAT!"), position indicators with crown, tire smoke, exhaust trails (character-colored), boost flame jets, spark showers near edges, lava splatter particles, random events (bird, UFO), lava burst explosions.

### Player Physics (`src/game/player.ts`)
- Acceleration: `speed += acceleration * input * dt`, capped at `maxSpeed`
- Braking: `speed -= brakeForce * dt`, reverse cap at `-maxSpeed * 0.4`
- Friction: `speed *= 0.97` when no input
- Steering: `angle -= handling * steerX * (speed/maxSpeed) * dt` (right = clockwise). Slow turning (15% handling) when stationary.
- Drift: hold brake + steer at >40% speed. Builds boost charge (max 1.5s), exit gives speed bonus.
- Turbo start: press accelerate within 0.3s of "GO!" for speed bonus.
- Boost: arrow pads set speed to 1.5x maxSpeed for 2s
- Death: ragdoll tumble, respawn 200px back, 1.5s invincibility, damage counter increments
- Squash/stretch: compresses on collision, stretches on boost. Recovers at rate 5/s.
- Expressions: happy (boost), angry (collision), scared (near lava edge)
- Mud: 50% speed multiplier, lingers 0.5s after leaving zone
- Airborne: from ramps, 0.6s flight, no collisions while airborne

### AI Opponents (`src/game/ai.ts`)
`computeAIInput(player, playerIndex, gameState): PlayerInput` — generates the same 4-value input that human players produce. Injected at `readPlayerInput()` in `input.ts` — if `playerIndex >= humanPlayerCount`, routes to AI instead of keyboard/gamepad. All physics, collision, and rendering code is unchanged.

AI features: road-following with look-ahead, obstacle avoidance (deadly vs beneficial), curvature braking, drift initiation, rubber-banding (only to active humans — idle humans are ignored so bots race freely), dynamic jockeying (bots steer away from nearby players to spread laterally), stuck recovery. Per-character personalities defined in `PERSONALITIES` map (cornerSkill, seekBoosts, driftSkill, steeringNoise, rubberBandFactor).

`GameConfig.botCount: 0|1|2|3` controls how many AI players. Human indices `0..playerCount-1`, bot indices `playerCount..playerCount+botCount-1`.

### Input (`src/game/input.ts`)
P1: Arrows + Enter | P2: WASD + Space | P3: IJKL + H | P4: Numpad 8456 + Num0. Gamepad API support (index → player). AI bots routed via `setAIContext()`.

### State (`src/game/state.ts`)
Factory: `createGameState(config, track)`. Types in `src/types/index.ts`. Key interfaces: `GameState`, `PlayerState`, `TrackData`, `ObstacleState`.

### Audio (`src/game/audio.ts`)
Web Audio API synthesis. SFX: engine (4-gear transmission), boost, death (generic + per-character), log, spike, honk, countdown, go (with bass drop), finish, respawn, tether, sad trombone, boing, drift, drift_exit, crowd, whoosh, per-character victory fanfares. 3 music loops (menu, race, results).

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

### Tracks (`src/data/tracks/`) — 6 total
- `sunday-drive.ts` — easy, wide roads (230-280px)
- `mud-runner.ts` — easy, mud-themed
- `lava-gauntlet.ts` — medium, flagship track
- `pinball-alley.ts` — medium, bouncy walls
- `devils-highway.ts` — hard, narrow (120-180px)
- `sky-bridge.ts` — hard, elevated bridges

Track format: `RoadPoint[]` polyline with `{x, y, width}`, obstacles as `ObstaclePlacement[]`.

### Obstacles — 8 types
- `arrow_pad` — boost forward 1.5x for 2s
- `spikes` — instant death
- `log` — knockback + 0.3s stun
- `rotating_spikes` — patrolling death (very slow rotation), `boostAngle` preserves original direction
- `ramp` — launches player airborne briefly (0.6s)
- `destructible` — breakable barrels/crates, respawn after 8s
- `mud_zone` — 50% speed slowdown zone
- `bouncy_wall` — pinball-style bouncer, exaggerated restitution

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

## Visual Polish Notes
- Screen shake is disabled (function exists but is a no-op — user found it distracting)
- Speed lines / chromatic aberration removed (user found them annoying)
- Lava tile is static (no animation — user found animation dizzying)
- Lava parallax at 30% camera speed (bridge-over-lava feel)
- Devil's Highway obstacle spacing was widened and patrol speeds halved (was too dense)
- GameResults includes `awards` array (Most Deaths, Biggest Bully, Slowpoke, Clean Racer, Speed Demon)
- Haptic feedback attempted on gamepad collisions/boosts (graceful fallback if unavailable)

## Key Files

1. `src/types/index.ts` — all interfaces
2. `src/game/engine.ts` — game loop + car collisions
3. `src/game/player.ts` — driving physics
4. `src/game/ai.ts` — AI bot brain (personalities, road following, obstacle avoidance, rubber-banding)
5. `src/game/renderer.ts` — rendering pipeline
6. `src/game/vector-sprites.ts` — vector sprite drawing
7. `src/utils/constants.ts` — all tuning values + color palette
8. `src/App.tsx` — screen routing
9. `olirace.md` — original game design spec
