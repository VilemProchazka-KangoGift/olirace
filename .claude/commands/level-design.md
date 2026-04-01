# Level Design Guide

When creating or modifying tracks, follow these rules. They encode hard-won lessons from playtesting.

## Track Data Format

Each track is a TypeScript file in `src/data/tracks/` exporting a `TrackData` object:
- `road: RoadPoint[]` — polyline of `{x, y, width}` points, Y decreases (cars travel upward)
- `obstacles: ObstaclePlacement[]` — placed hazards
- `startLine` / `finishLine` — road segment indices
- `startPositions` — P1-P4 spawn points with `{x, y, angle}`

Helper functions `straight()`, `curve()`, `joinSegments()` build the road polyline. `indexAtY()` and `roadAt()` look up road geometry at a given Y position.

## Adding a New Track — Wiring Checklist

1. Create `src/data/tracks/{id}.ts` exporting a `TrackData` object
2. Add import + entry in `src/screens/GameScreen.tsx` → `trackMap`
3. Add import + entry in `src/screens/TrackSelect.tsx` → `tracks` array (sorted by difficulty)
4. Add i18n key `track_{id}` in both `src/i18n/en.ts` and `src/i18n/cs.ts`
5. Run `npm run lint && npm run test && npm run build`
6. Commit and push

## Track Design Principles

### Track Length & Segments
| Difficulty | Y range | Length | Segments | Road `step` |
|---|---|---|---|---|
| Easy | ~4000px | 4000-4500 | 5-8 | 40 (default) |
| Medium | ~5000px | 4500-5500 | 8-12 | 30-40 |
| Hard | ~5500px | 5000-5800 | 10-15 | 30 (more road points for tight curves) |

The `step` parameter in `straight()` and `curve()` controls point density. Use 30 on hard tracks for smoother tight curves.

### Track Theming
Each track should have a **signature obstacle type** that appears 4-6 times and defines the track's personality. Other obstacle types appear 1-3 times for variety.

Examples from existing tracks:
- **Mud Runner** — signature: mud_zone (6) + destructible (5). No death hazards at all.
- **Pinball Alley** — signature: bouncy_wall (6). Chaotic ricochets everywhere.
- **Sky Bridge** — signature: ramp (5). Ramps placed before deadly obstacles as the "intended" route.

### Death-Free Easy Tracks
Easy tracks CAN have zero death hazards (no spikes, no rotating_spikes). Mud Runner proves this works — the challenge comes from mud slowdowns, barrel impacts, and the road itself. This is a valid and fun design for the youngest players.

## Road Geometry Rules

### Width Ranges by Difficulty
| Difficulty | Min Width | Max Width | Notes |
|---|---|---|---|
| Easy | 230 | 280 | Forgiving, gentle curves only |
| Medium | 160 | 240 | Moderate curves, S-bends |
| Hard | 120 | 180 | Tight hairpins, narrow gauntlets |

### Curve Tightness
- `xShift` in `curve()` controls how far the road bends horizontally
- Easy: xShift 10-45 (gentle bends)
- Medium: xShift 40-80 (moderate curves, S-bends)
- Hard: xShift 60-100 (hairpins)
- Never exceed xShift 110 — cars can't steer that fast

### Road Width Transitions
- Width changes should be gradual (max 30px change per segment)
- Always extend road 200-400px past the finish line to prevent lava death on crossing

## Obstacle Placement Rules

### Spacing — THE MOST IMPORTANT RULE
**Minimum distance between ANY two obstacles: 150px (Y-axis)**

This gives players time to see, react, and dodge at speed. Violations of this rule make the track feel unfair and frustrating.

| Difficulty | Recommended spacing | Absolute minimum |
|---|---|---|
| Easy | 200px+ | 150px |
| Medium | 150-200px | 150px |
| Hard | 150-200px | 150px |

Even on hard tracks, spacing below 150px is NEVER acceptable. Hard difficulty comes from narrow roads and tighter curves, not from impossible obstacle spam.

### Obstacle Budget
| Difficulty | Total obstacles | Deadly obstacles | Arrow pads |
|---|---|---|---|
| Easy | 15-20 | 2-4 | 4-5 |
| Medium | 18-25 | 6-10 | 3-4 |
| Hard | 20-28 | 8-14 | 3-4 |

### Obstacle Type Reference

**arrow_pad** (boost forward)
- Size: 40x40
- Effect: sets speed to 1.5x maxSpeed for 2s, overrides angle to `boostAngle`
- Retrigger distance: 200px (player must leave and return)
- Use as rewards, pacing resets, and before difficult sections
- Always set `angle: 0` (boost forward/up in world space)

**spikes** (instant death)
- Default size: 32x16
- Custom width via `width` property — use to create partial-road barriers
- Place at one side of the road with clear gap on the other (never block >50% of road on easy)
- Width guideline: `roadWidth * 0.3 - 0.45` leaves a dodgeable gap
- On narrow roads (<150px), keep spike width under `roadWidth * 0.35`

**log** (knockback + 0.3s stun)
- Size: 60x20
- Non-lethal — use freely for variety
- `angle` rotates the log (0.2-0.5 range works well for diagonal placement)
- Offset from center using `roadAt(y).x ± roadAt(y).width * 0.15-0.3`

**rotating_spikes** (spike ball, instant death, patrols back and forth)
- Hitbox radius: 20px, player hitbox: 16px → needs 36px clearance minimum
- `patrolAxis`: `'x'` (side to side) or `'y'` (back and forth along road)
- `patrolDistance`: how far from center the ball swings
- `patrolSpeed`: oscillation speed (radians/sec for the sine wave)

#### CRITICAL: Rotating Spike Passability Rules

The spike ball must ALWAYS be passable. A ball centered on a road of width W with patrol distance D creates a swept zone of `2 * (D + 20)` pixels. The player needs 16px radius to pass.

**Clearance formula:** `(roadWidth / 2) - patrolDistance - 20 - 16 > 0`

If this is negative, the ball is impassable at its extremes. Fix by **increasing patrolDistance** so the ball swings partially off the road — this creates a clear window on the opposite side when the ball is at its far swing.

| Road Width | Recommended patrolDistance | patrolSpeed |
|---|---|---|
| 230-280 (easy) | 40-50 | 3.0-4.0 |
| 160-200 (medium) | 50-65 | 3.5-5.0 |
| 120-150 (hard) | 60-70 | 3.0-3.5 |

**On narrow roads, make the ball swing WIDER, not narrower.** patrolDistance 60-70 on a 120px road means the ball goes 10-20px off the road on each side, giving a safe lane when it's at the opposite extreme. Combined with slow speed (3.0-3.5), players can reliably time their pass.

**ramp** (launches player airborne 0.6s)
- Size: 50x30
- Player flies over obstacles while airborne — use before dangerous sections as an alternate route
- Non-lethal, fun, gives brief invulnerability

**destructible** (breakable barrel/crate, respawns after 8s)
- Size: 24x24
- Slight slowdown on break (speed * 0.8)
- Good for light variety, non-threatening

**mud_zone** (50% speed for 0.5s after leaving)
- Default size: 60x60, custom size via `width` property
- On narrow roads (≤150px), use `width: 40` to avoid filling the entire road
- Non-lethal, strategic placement to slow down leaders
- Place on racing line through curves for risk/reward

**bouncy_wall** (pinball bouncer, 1.5x restitution)
- Size: 60x12
- Exaggerated bounce — fun chaos element
- `angle` controls wall orientation
- Place at curve exits for pinball moments

### Placement Patterns

**Alternating spike walls:** Place spike strips on alternating sides of the road, 150-200px apart. Forces weaving.

**Rotating spike + arrow pad:** Place arrow pad 200px before a rotating spike to give speed boost for timing the pass.

**Log chicane:** 2-3 logs staggered left-right, 150-200px apart. Non-lethal slalom.

**Curve apex obstacle:** Place a log or slow-moving rotating spike at the apex (tightest point) of a curve. Road is already challenging there.

**Boost recovery:** After a difficult section, place an arrow pad. Rewards survival and resets pacing.

**Ramp-before-danger:** Place a ramp 150-200px before a spike strip or rotating spike. Skilled players can launch off the ramp and fly over the danger (0.6s airborne = ~150-200px at speed). This is the core mechanic of Sky Bridge and makes hard tracks feel fair — there's always a skillful way through.

## Difficulty Design Philosophy

### Easy (Sunday Drive)
- Primarily logs and arrow pads
- 1-2 spike strips (narrow, easy to dodge)
- 1-2 rotating spikes (slow speed ≤3, wide road)
- Wide road forgives steering mistakes
- Arrow pads every 400-600px to maintain speed and fun

### Medium (Lava Gauntlet)
- Mix of all obstacle types
- Spike strips block 40-60% of road
- Rotating spikes with moderate speed
- S-curves with obstacles at decision points
- Arrow pads before and after hard sections

### Hard (Devil's Highway)
- Narrow roads create inherent difficulty — obstacles ADD to it, not substitute for it
- Rotating spikes must swing wide (60-70 patrol) and move slowly (3-3.5 speed)
- Spike strips kept narrow (≤35% of road width)
- RESIST the urge to pack obstacles close together — spacing ≥150px always
- Arrow pads placed strategically as breathing room
- The road itself is the challenge; obstacles are punctuation, not the sentence

## Start Position Layout

Cars spawn in a 2x2 grid offset from road center:
```
P1: center - 25..35, y = startY - 40
P2: center + 25..35, y = startY - 40
P3: center - 25..35, y = startY
P4: center + 25..35, y = startY
```
Offset distance varies with road width: 25px for narrow, 35px for wide. All face `angle: Math.PI / 2` (upward).

## Validation Checklist

Before finalizing a track:
- [ ] No two obstacles within 150px Y-distance
- [ ] All rotating spikes pass the clearance formula
- [ ] Road extends 200px+ past finish line
- [ ] Arrow pads placed every 400-800px as pacing resets
- [ ] Spike strips never block more than 50% of road on easy, 45% on medium/hard
- [ ] At least one arrow pad in the first 300px of track
- [ ] Start positions fit within road width at spawn point
- [ ] Track tested with 1 player and 4 players (tether affects spacing perception)
