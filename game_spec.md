Below is a **single, integrated, data-driven plan** for **Minute Heist (Neon Arcade)** as a **standalone Android game** built in **React Native + Expo**. It includes the **TypeScript schema**, the **room template library**, and a **full tuning config** as first-class parts of the architecture, so you can balance the game by editing numbers rather than rewriting logic.

---

# Minute Heist: Neon Arcade Development Plan

## 0) The Game in One Paragraph

You are a glowing “thief dot” in a neon museum. Each run lasts **60 seconds**. You grab loot, thread lasers, dodge drones, and decide how greedy to get by entering vault wings that are more dangerous but worth more. Death is immediate and fair, restarts are instant, and the game rewards both **skill** (near-misses, route choice) and **progress** (upgrades, cosmetics). Monetisation is “**pay to play more**” via tickets, with clean rewarded ads and cosmetic packs.

---

## 1) Non-Negotiable Build Principles

1. **Everything is data-driven**
   Game rules, spawns, hazards, scoring, and progression live in a tuning file. Gameplay code reads config.

2. **Everything is primitive shapes**
   Player, lasers, drones, loot, walls are circles/rectangles/segments with glow and particles. Minimal custom assets.

3. **Deterministic runs under a seed**
   Every run can be reproduced from a seed, crucial for QA and fairness.

4. **Fast feel, fair deaths**
   Telegraph blink lasers, keep collision forgiving, and heavily reward near-miss risk.

---

## 2) Technical Stack Decisions

### Rendering

* Preferred: **Skia canvas** (glow, particles, cheap primitives).
* UI: React Native normal views for menus, overlays.
* Animation: Reanimated for screen transitions, not for the core game simulation.

### Platform modules

* Haptics: Expo Haptics
* Audio: Expo AV
* Persistence: AsyncStorage (and SecureStore for purchase flags if needed)

### Ads and IAP

* Ads: use a native ad SDK (commonly AdMob via Google) if desired.
* IAP: store-based IAP module.
* Reality: when you introduce native ads/IAP modules, you build via EAS, not purely in Expo Go.

---

## 3) Project Structure (Clean, Data-Led)

Suggested file layout:

* `src/game/types.ts` (schema)
* `src/game/tuning.ts` (tuning config + helper curves)
* `src/game/templates.ts` (room templates)
* `src/game/rng.ts` (seeded RNG)
* `src/game/generator.ts` (build a run layout from templates + constraints)
* `src/game/sim/` (simulation: movement, hazards, collisions)
* `src/game/render/` (Skia rendering)
* `src/game/meta/` (wallet, tickets, upgrades, cosmetics, missions)
* `src/analytics/events.ts`
* `src/screens/` (Home, Results, Upgrades, Shop)

---

## 4) Core Systems and How They Work Together

### Run flow

1. Pick `mode` (Normal, Daily Seed, Risk Run)
2. Create `RunSpec` (seed + chosen templates + difficulty curve)
3. Generate `RunLayout` (rooms stitched with doors)
4. Simulate at fixed timestep (player + hazards + loot)
5. Score and reward computed from run stats + config
6. Persist meta changes (credits, shards, upgrades, cosmetics)

### “Dopamine levers” built into the loop

* **Near-miss ticks** (score + micro-haptic + spark)
* **Combo decay** (forces constant movement)
* **Risk wing** (player chooses greed)
* **End screen fireworks** (numbers pop, fast replay)

---

# 5) Deliverable A: TypeScript Data Schema (used everywhere)

Create a schema that’s strict enough to prevent nonsense, but flexible enough to evolve.

```ts
// src/game/types.ts

export type Seed = number;

export type Mode = "NORMAL" | "DAILY" | "RISK";
export type EndReason = "TIME" | "LASER" | "DRONE" | "ALARM" | "QUIT";

export interface Vec2 { x: number; y: number; }
export interface Rect { x: number; y: number; w: number; h: number; }

export type LootKind = "COIN" | "GEM" | "CROWN" | "KEY" | "CURSED";

export type LaserKind = "ROTATOR" | "SWEEPER" | "BLINK_GATE";
export type DroneKind = "PATROL" | "SCANNER";

export interface PlayerState {
  pos: Vec2;
  vel: Vec2;
  radius: number;          // collision radius, separate from glow
  dashCharges: number;
  dashCooldown: number;
  shield: boolean;
  magnetRadius: number;
  cursedStacks: number;
}

export interface Laser {
  id: string;
  kind: LaserKind;
  // Geometry is derived from params per kind.
  anchor: Vec2;
  length: number;
  angle: number;
  angVel: number;
  sweepDir?: 1 | -1;
  sweepSpan?: number;
  blink?: { period: number; onFor: number; telegraph: number; phase: number };
  thickness: number;
  lethal: boolean;
}

export interface Drone {
  id: string;
  kind: DroneKind;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  waypoints: Vec2[];
  wpIndex: number;
  speed: number;
  scanner?: { range: number; fov: number; alarmPerSec: number };
}

export interface Loot {
  id: string;
  kind: LootKind;
  pos: Vec2;
  value: number;
  ttl: number;            // seconds
  cursed?: { stacks: number; alarmBoost: number; speedBoost: number };
  keyId?: string;         // for vault doors
}

export interface TripZone {
  id: string;
  rect: Rect;
  alarmBurst: number;
}

export interface RoomTemplate {
  id: string;
  tags: string[];
  size: { w: number; h: number };
  doors: { id: string; at: Vec2; normal: Vec2 }[];
  walls: Rect[];
  spawnPoints: Vec2[];
  // Spawner descriptors. Actual entities are created by generator using tuning.
  spawners: SpawnerSpec[];
  constraints: TemplateConstraints;
  weight: number; // selection weight
}

export type SpawnerSpec =
  | { type: "LOOT_FIELD"; area: Rect; table: string; countMin: number; countMax: number }
  | { type: "LASER_SET"; anchors: Vec2[]; pattern: string; difficulty: number }
  | { type: "DRONE_SET"; path: Vec2[]; kind: DroneKind; count: number; difficulty: number }
  | { type: "TRIP_ZONES"; areas: Rect[]; difficulty: number }
  | { type: "VAULT_DOOR"; rect: Rect; keyId: string; rewardTable: string };

export interface TemplateConstraints {
  minTelegraphClearance: number;  // min safe corridor width in px units
  disallowBlinkOverlap: boolean;
  maxLaserDensity: number;
  maxDroneDensity: number;
}

export interface RunLayout {
  seed: Seed;
  mode: Mode;
  rooms: GeneratedRoom[];
  connections: { fromDoor: string; toDoor: string }[];
}

export interface GeneratedRoom {
  templateId: string;
  index: number;
  offset: Vec2; // world offset
  doors: { id: string; worldAt: Vec2; normal: Vec2 }[];
  walls: Rect[];
  lasers: Laser[];
  drones: Drone[];
  loot: Loot[];
  tripZones: TripZone[];
  vaultDoors: { rect: Rect; keyId: string; opened: boolean }[];
}

export interface RunStats {
  score: number;
  creditsEarned: number;
  shardsEarned: number;
  nearMissCount: number;
  vaultsOpened: number;
  maxAlarm: number;
  streakMax: number;
  endReason: EndReason;
}

export interface MetaState {
  credits: number;
  shards: number;
  tickets: number;
  ticketCap: number;
  upgrades: Record<string, number>;
  cosmetics: {
    paletteId: string;
    trailId: string;
    owned: string[];
  };
  missions: {
    dailySeedDay: string;
    daily: MissionState[];
    weekly: MissionState[];
  };
}

export interface MissionState {
  id: string;
  progress: number;
  target: number;
  completed: boolean;
  reward: { credits?: number; shards?: number; cosmeticId?: string };
}
```

This schema forces the generator and sim to speak a common language, and makes the game tunable without touching core logic.

---

# 6) Deliverable B: Room Template Library (8 templates, constraints included)

## Coordinate system and sizing

Use a **virtual resolution** so the world scales well across devices:

* Room size baseline: `w = 360`, `h = 640`
* Player radius: `~9` (tuning-controlled)
* All templates built in local room coords, then offset into world coords.

## Template selection philosophy

* Runs are built from a **graph** of rooms:

  * `SPAWN_SAFE -> MAIN -> (CONNECTOR) -> MAIN -> (RISK/VAULT optional) -> MAIN -> EXIT_STRIP`
* The generator picks from templates by tags and weights, then validates constraints.

## The 8 templates

### T1: `SPAWN_SAFE_PAD`

* Tags: `SPAWN_SAFE, CONNECTOR`
* Purpose: give player 1 second to orient.
* Spawners: light loot only, no hazards.
* Constraints: none beyond corridor width.

### T2: `MAIN_LOOP_ARCADE`

* Tags: `MAIN`
* Purpose: baseline room, moderate loot, 1 rotator laser.
* Spawners:

  * `LOOT_FIELD` (coins + gems)
  * `LASER_SET` pattern: `SINGLE_ROTATOR`
* Constraints: `maxLaserDensity` low.

### T3: `MAIN_SWEEPER_HALL`

* Tags: `MAIN`
* Purpose: introduces sweep timing.
* Spawners:

  * `LASER_SET` pattern: `TWO_SWEEPERS_OPPOSED`
  * Loot positioned to bait timing.

### T4: `MAIN_DRONE_PATROL`

* Tags: `MAIN`
* Purpose: waypoint drone teaching.
* Spawners:

  * `DRONE_SET` patrol loop rectangle
  * `LOOT_FIELD` placed near patrol path for risk.

### T5: `CONNECTOR_CHOKEPOINT`

* Tags: `CONNECTOR`
* Purpose: short connector with a blink gate that telegraphs clearly.
* Spawners:

  * `LASER_SET` pattern: `BLINK_GATE_CENTER`
* Constraints:

  * `disallowBlinkOverlap = true`
  * larger `minTelegraphClearance`

### T6: `RISK_WING_CURSED_CLUSTER`

* Tags: `RISK`
* Purpose: cursed loot bait, higher danger.
* Spawners:

  * `LOOT_FIELD` table: `CURSED_MIX`
  * `LASER_SET` pattern: `TRI_ROTATORS`
* Constraints: `maxLaserDensity` moderate, must keep one safe line.

### T7: `VAULT_ANTICHAMBER`

* Tags: `VAULT`
* Purpose: vault door + key mechanic.
* Spawners:

  * `VAULT_DOOR` (locked)
  * `LOOT_FIELD` (key can spawn elsewhere via run logic, or here at low chance)
  * hazards mild but punishing near door.

### T8: `EXIT_STRIP_MULTIPLIER`

* Tags: `EXIT_STRIP`
* Purpose: optional end-lane that grants multiplier if reached near end.
* Spawners:

  * loot line + near-miss bait
  * sweepers with generous telegraph

## Template definitions (data objects)

Example template (one of them), showing the pattern:

```ts
// src/game/templates.ts
import { RoomTemplate } from "./types";

export const ROOM_W = 360;
export const ROOM_H = 640;

export const templates: RoomTemplate[] = [
  {
    id: "SPAWN_SAFE_PAD",
    tags: ["SPAWN_SAFE", "CONNECTOR"],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: "D_N", at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: "D_S", at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.75 }],
    spawners: [
      { type: "LOOT_FIELD", area: { x: 40, y: 200, w: 280, h: 320 }, table: "SAFE_COINS", countMin: 6, countMax: 10 },
    ],
    constraints: {
      minTelegraphClearance: 90,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.0,
      maxDroneDensity: 0.0,
    },
    weight: 1,
  },
  // Add 7 more templates with the same structure
];
```

## Generator constraints and validation (must-have)

When assembling rooms, validate:

* No unavoidable blink gates (telegraph window must allow a clear passage at player speed).
* Laser overlap never creates a full-width kill wall unless it has a safe timing gap.
* Drone paths do not intersect blink gates in a way that forces collision.
* Loot never spawns inside walls or in a zone with zero survivable approach.

If validation fails, the generator re-rolls that room’s spawners using the same template (still deterministic by stepping the RNG).

---

# 7) Deliverable C: Full Tuning Config (Numbers, Curves, Tables)

This file is your balancing control panel. It should be the only place you touch when:

* the game feels too hard
* scores inflate
* players run out of tickets too fast
* upgrades become mandatory
* ad rewards feel stingy

```ts
// src/game/tuning.ts

export const TUNING = {
  run: {
    durationSec: 60,
    fixedStep: 1 / 120,          // sim step
    maxFrameDt: 1 / 20,          // clamp spikes
  },

  world: {
    roomW: 360,
    roomH: 640,
    wallThickness: 10,
  },

  player: {
    radius: 9,
    maxSpeed: 250,               // units/sec
    accel: 1400,                 // units/sec^2
    friction: 9.5,               // higher = snappier stop
    dash: {
      chargesBase: 2,
      cooldownBase: 2.6,
      impulse: 520,
      iFrames: 0.06,             // tiny forgiveness window
    },
    magnet: {
      baseRadius: 34,
      pullStrength: 900,
    },
    shield: {
      baseEnabled: false,        // unlocked via upgrade
      postHitInvuln: 0.35,
    },
  },

  danger: {
    // Near miss: distance from player center to laser segment minus laser thickness
    nearMiss: {
      window: 14,                // units
      scoreTick: 12,
      creditsTick: 1,
      cooldown: 0.12,            // prevent farming by hovering
    },

    alarm: {
      enabled: true,
      max: 100,
      decayPerSec: 3.0,
      levels: [
        { at: 0,   laserSpeedMul: 1.0, droneSpeedMul: 1.0, lootValueMul: 1.0 },
        { at: 25,  laserSpeedMul: 1.08, droneSpeedMul: 1.06, lootValueMul: 1.10 },
        { at: 50,  laserSpeedMul: 1.16, droneSpeedMul: 1.12, lootValueMul: 1.22 },
        { at: 75,  laserSpeedMul: 1.25, droneSpeedMul: 1.20, lootValueMul: 1.38 },
      ],
      cursedStackAlarmAdd: 4.5,  // per stack per pickup
      tripZoneBurst: 18,
    },
  },

  hazards: {
    lasers: {
      thickness: 7,
      telegraphOpacity: 0.35,
      rotator: { angVelMin: 0.9, angVelMax: 1.8, lengthMin: 140, lengthMax: 240 },
      sweeper: { sweepSpan: 220, speedMin: 150, speedMax: 260 },
      blinkGate: { period: 2.2, onFor: 0.9, telegraph: 0.35 }, // clear telegraph is the “fair death” rule
    },
    drones: {
      radius: 12,
      patrol: { speedMin: 90, speedMax: 150 },
      scanner: { speedMin: 75, speedMax: 120, range: 160, fovRad: 0.9, alarmPerSec: 10 },
    },
  },

  loot: {
    ttl: { coin: 7.5, gem: 9.0, crown: 10.0, cursed: 8.5, key: 12.0 },
    tables: {
      SAFE_COINS: {
        picks: [
          { kind: "COIN", weight: 80, value: 20 },
          { kind: "GEM",  weight: 20, value: 60 },
        ],
      },
      MAIN_MIX: {
        picks: [
          { kind: "COIN",  weight: 70, value: 22 },
          { kind: "GEM",   weight: 24, value: 70 },
          { kind: "CROWN", weight: 6,  value: 160 },
        ],
      },
      CURSED_MIX: {
        picks: [
          { kind: "GEM",    weight: 55, value: 90 },
          { kind: "CROWN",  weight: 25, value: 220 },
          { kind: "CURSED", weight: 20, value: 360, cursed: { stacks: 1, alarmBoost: 10, speedBoost: 0.03 } },
        ],
      },
      VAULT_REWARD: {
        picks: [
          { kind: "GEM",    weight: 55, value: 140 },
          { kind: "CROWN",  weight: 35, value: 320 },
          { kind: "CURSED", weight: 10, value: 520, cursed: { stacks: 2, alarmBoost: 18, speedBoost: 0.05 } },
        ],
      },
      KEY_SPAWN: {
        picks: [
          { kind: "KEY", weight: 100, value: 0 },
        ],
      },
    },
  },

  scoring: {
    // Score is intentionally “loud” but bounded.
    baseLootScore: 1.0,          // multiplied by loot.value
    combo: {
      enabled: true,
      start: 1.0,
      max: 4.0,
      addPerPickup: 0.08,
      decayPerSec: 0.22,
      decayDelay: 0.9,
    },
    vaultBonus: {
      openScoreFlat: 450,
      chainMulAdd: 0.25,         // per vault opened
      maxChainMul: 2.0,
    },
    endBonus: {
      timeUpMul: 1.10,           // finishing alive feels good
      alarmMaxFailMul: 0.85,     // alarm death is “you pushed it”
    },
  },

  economy: {
    // Credits earned are tied to score but softened.
    credits: {
      perLootValue: 0.10,        // 20 value coin => 2 credits
      nearMissTick: 1,
      vaultOpenFlat: 18,
      completionBonus: 35,
    },
    shards: {
      // premium drip from missions and streaks, not raw grinding
      dailyMissionAvg: 3,
      weeklyMissionAvg: 10,
    },
    tickets: {
      capBase: 5,
      refillMinutesPerTicket: 18,
      runCost: { NORMAL: 1, DAILY: 1, RISK: 2 },
      adRewardTickets: 1,
      premiumBuyTickets: 5,
    },
  },

  upgrades: {
    // Small set, meaningful effects, curves controlled here
    list: {
      SPEED:       { maxLevel: 12, costBase: 120, costMul: 1.18, effectPerLevel: 0.018 }, // +1.8% maxSpeed
      DASH:        { maxLevel: 10, costBase: 160, costMul: 1.20, effectPerLevel: 0.10 },  // -0.10s cooldown
      MAGNET:      { maxLevel: 10, costBase: 130, costMul: 1.19, effectPerLevel: 3.2 },   // +3.2 radius
      SHIELD:      { maxLevel: 5,  costBase: 260, costMul: 1.35, effectPerLevel: 1 },     // unlock + improve recharge rules
      HEAT_CONV:   { maxLevel: 8,  costBase: 200, costMul: 1.22, effectPerLevel: 0.06 },  // convert alarm into credits bonus
    },
  },

  cosmetics: {
    // Pure vanity, high variety, cheap to produce
    trails: [
      { id: "TRAIL_SOFT", length: 18 },
      { id: "TRAIL_SPARK", length: 14 },
      { id: "TRAIL_COMET", length: 22 },
    ],
    palettes: [
      { id: "PAL_CYAN_MAGENTA", bg: ["#070812", "#0B1030"], neonA: "#22E7FF", neonB: "#FF2DDA", neonC: "#A7FF3A", warning: "#FF3B30" },
      { id: "PAL_LIME_VIOLET",  bg: ["#05060B", "#0F0B26"], neonA: "#B7FF00", neonB: "#7C4DFF", neonC: "#00F5D4", warning: "#FF375F" },
    ],
  },

  missions: {
    dailyCount: 3,
    weeklyCount: 3,
    pool: {
      nearMiss: { target: [8, 14, 20], rewardShards: [2, 3, 4] },
      vaults:   { target: [1, 2, 3],   rewardShards: [3, 5, 7] },
      score:    { target: [9000, 15000, 22000], rewardShards: [2, 4, 6] },
      alarm:    { target: [40, 60, 75], rewardShards: [2, 3, 5] },
    },
  },
} as const;
```

### How tuning is applied (practical rules)

* Alarm level modifies hazard speeds and loot values via the `alarm.levels` table.
* Combo multiplier is updated every pickup and decays when idle.
* Vault chain adds a separate multiplier (keeps “greed runs” special).
* Credits are earned from loot value and run outcomes, not from raw time.

---

## 8) Generator: How a Run Is Assembled (No Guesswork)

### Step-by-step generation

1. **Choose mode**

   * NORMAL: random seed from `(time + runIndex + deviceSalt)`
   * DAILY: seed from `(UTC date + constant)`
   * RISK: same as normal but forces inclusion of `RISK` and `VAULT` rooms

2. **Build a room graph**
   Example canonical graph:

   * Room 0: `SPAWN_SAFE`
   * Room 1: `MAIN`
   * Room 2: `MAIN`
   * Room 3: `CONNECTOR`
   * Optional branch: `RISK` then `VAULT` then back
   * Final: `EXIT_STRIP`

3. **Select templates by tags and weights**

4. **Instantiate spawners**

   * For each `SpawnerSpec`, consult `TUNING` tables and generate entities.

5. **Validate constraints**

   * If invalid, re-roll spawners for that room (advance RNG deterministically).

6. **Emit `RunLayout`**

   * store seed, selected templates, and final entities for reproducibility.

### Anti-unfairness checks (must implement)

* Blink gates must always have a survivable window given player maxSpeed and corridor width.
* No simultaneous full-width beams without timing offset.
* Drone scanner cones must not cover mandatory choke points at alarm levels that force death.
* Loot cannot spawn in lethal overlap zones (unless it’s explicitly “cursed bait” and still survivable).

---

## 9) Simulation Details That Keep It Smooth

### Fixed timestep loop

* Clamp dt to avoid “teleporting” through lasers on frame drops.
* Step sim at `TUNING.run.fixedStep`.

### Collision math (fast and forgiving)

* Player vs laser segment: distance-to-segment < (player.radius + laser.thickness).
* Player vs drone: circle distance < (r1 + r2).
* Player vs wall: resolve AABB push-out.
* Forgiveness: player radius is collision radius, glow can be larger.

### Near-miss detection

* Compute “distance-to-segment minus thickness” and check within `nearMiss.window`.
* Add a cooldown so you cannot farm points by hovering.

---

## 10) Upgrades: Exact Effects (Derived From Config)

Implement upgrade effects as pure functions:

* `SPEED`: `maxSpeed = baseMaxSpeed * (1 + lvl * effectPerLevel)`
* `DASH`: `dashCooldown = base - lvl * 0.10`, clamp to a minimum
* `MAGNET`: `magnetRadius = base + lvl * 3.2`
* `SHIELD`: level 1 unlocks shield-once-per-run, higher levels reduce “recharge requirement” (for example shield restores after opening a vault or hitting a streak threshold)
* `HEAT_CONV`: `creditsBonusMul = 1 + (alarm/100) * (lvl * effectPerLevel)`

Costs are geometric growth:

* `cost(lvl) = costBase * (costMul ^ (lvl-1))`

This keeps early progression snappy and late progression aspirational without exploding.

---

## 11) Cosmetics: Cheap Content, Big Perceived Variety

* Palettes change background gradient + neon accents (lasers stay readable, warning stays “warning”).
* Trails are just particle settings (length, fade, spawn rate).
* Optional “laser themes” as hue shifts, but keep danger color consistent if you want accessibility.

---

## 12) Monetisation: Clean “Pay to Play More”

### Tickets

* Capacity and refill rate in tuning.
* Run cost: Normal 1, Daily 1, Risk 2.

### Rewarded ads

* +1 ticket
* revive once per run (no chains)
* double credits on end screen

### IAP

* ticket bundles
* no-ads purchase
* cosmetic packs

Keep leaderboards skill-based by ensuring purchases do not directly multiply score.

---

## 13) Analytics Events (Minimum Useful Set)

Track:

* `run_start` (mode, seed, upgrades snapshot)
* `run_end` (score, endReason, nearMissCount, vaultsOpened, maxAlarm)
* `ticket_spend`, `ticket_refill`, `ad_reward_claim`, `iap_success`
* `upgrade_buy`, `cosmetic_unlock`
* `mission_progress`, `mission_complete`

This lets you tune:

* difficulty curves
* ticket refill satisfaction
* ad conversion points
* retention triggers (daily seed uptake)

---

## 14) Debug Tools You Build In (So QA Is Easy)

Add a hidden dev overlay:

* current seed
* entity counts
* FPS
* “show hitboxes”
* “show laser distance field” (optional)
* “regen run with same seed”
* “regen run with next seed”

Also add an input recorder:

* record finger positions and taps per frame
* replay under the same seed to reproduce “unfair death” reports precisely

---

## 15) Implementation Order (No timelines, just dependency-correct)

1. Schema + tuning config + RNG
2. Fixed-step sim and player movement + wall collisions
3. Laser rendering + collision + near-miss
4. Loot + scoring + combo
5. Templates + generator + validation
6. Drones + scanner cones + alarm
7. Vault door + key + rewards
8. Meta: credits, tickets, upgrades
9. Cosmetics + shop scaffolding
10. Missions + daily seed mode
11. Ads/IAP integration (optional but cleanly encapsulated)

---

## What you have now

* A **strict schema** that prevents spaghetti.
* A **template library design** that makes content scalable without art.
* A **complete tuning config** with real numbers and curves, making balance a data exercise.

If you want the next “max” step without any questions from me: I can also write the **generator + seeded RNG + validation** as concrete TypeScript modules in the same style, ready to paste into your project.
