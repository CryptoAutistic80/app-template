// src/game/types.ts
// Core type definitions for Minute Heist

export type Seed = number;

export type Mode = "NORMAL" | "DAILY" | "RISK";
export type EndReason = "TIME" | "LASER" | "DRONE" | "ALARM" | "QUIT";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// === Loot ===
export type LootKind = "COIN" | "GEM" | "CROWN" | "KEY" | "CURSED";

// === Hazards ===
export type LaserKind = "ROTATOR" | "SWEEPER" | "BLINK_GATE";
export type DroneKind = "PATROL" | "SCANNER";

// === Player State ===
export interface PlayerState {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  dashCharges: number;
  dashCooldown: number;
  shield: boolean;
  shieldUsed: boolean;
  magnetRadius: number;
  cursedStacks: number;
  iFrames: number; // invincibility frames remaining
}

// === Laser Entity ===
export interface Laser {
  id: string;
  kind: LaserKind;
  anchor: Vec2;
  length: number;
  angle: number;
  angVel: number;
  sweepDir?: 1 | -1;
  sweepSpan?: number;
  sweepBase?: number; // base angle for sweep
  blink?: {
    period: number;
    onFor: number;
    telegraph: number;
    phase: number;
  };
  thickness: number;
  lethal: boolean;
  // Runtime state
  blinkTimer?: number;
  isOn?: boolean;
}

// === Drone Entity ===
export interface Drone {
  id: string;
  kind: DroneKind;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  waypoints: Vec2[];
  wpIndex: number;
  speed: number;
  scanner?: {
    range: number;
    fov: number;
    alarmPerSec: number;
    angle: number; // current facing direction
  };
}

// === Loot Entity ===
export interface Loot {
  id: string;
  kind: LootKind;
  pos: Vec2;
  value: number;
  ttl: number;
  collected: boolean;
  cursed?: {
    stacks: number;
    alarmBoost: number;
    speedBoost: number;
  };
  keyId?: string;
}

// === Trip Zone (triggers alarm) ===
export interface TripZone {
  id: string;
  rect: Rect;
  alarmBurst: number;
  triggered: boolean;
}

// === Vault Door ===
export interface VaultDoor {
  id: string;
  rect: Rect;
  keyId: string;
  opened: boolean;
}

// === Spawner Specifications (for room templates) ===
export type SpawnerSpec =
  | {
      type: "LOOT_FIELD";
      area: Rect;
      table: string;
      countMin: number;
      countMax: number;
    }
  | {
      type: "LASER_SET";
      anchors: Vec2[];
      pattern: string;
      difficulty: number;
    }
  | {
      type: "DRONE_SET";
      path: Vec2[];
      kind: DroneKind;
      count: number;
      difficulty: number;
    }
  | { type: "TRIP_ZONES"; areas: Rect[]; difficulty: number }
  | {
      type: "VAULT_DOOR";
      rect: Rect;
      keyId: string;
      rewardTable: string;
    };

// === Room Template Constraints ===
export interface TemplateConstraints {
  minTelegraphClearance: number;
  disallowBlinkOverlap: boolean;
  maxLaserDensity: number;
  maxDroneDensity: number;
}

// === Room Template Definition ===
export interface RoomTemplate {
  id: string;
  tags: string[];
  size: { w: number; h: number };
  doors: { id: string; at: Vec2; normal: Vec2 }[];
  walls: Rect[];
  spawnPoints: Vec2[];
  spawners: SpawnerSpec[];
  constraints: TemplateConstraints;
  weight: number;
}

// === Generated Room (instantiated from template) ===
export interface GeneratedRoom {
  templateId: string;
  index: number;
  offset: Vec2;
  doors: { id: string; worldAt: Vec2; normal: Vec2 }[];
  walls: Rect[];
  lasers: Laser[];
  drones: Drone[];
  loot: Loot[];
  tripZones: TripZone[];
  vaultDoors: VaultDoor[];
}

// === Run Layout (full generated level) ===
export interface RunLayout {
  seed: Seed;
  mode: Mode;
  rooms: GeneratedRoom[];
  connections: { fromDoor: string; toDoor: string }[];
}

// === Run Statistics ===
export interface RunStats {
  score: number;
  creditsEarned: number;
  shardsEarned: number;
  nearMissCount: number;
  vaultsOpened: number;
  maxAlarm: number;
  streakMax: number;
  lootCollected: number;
  endReason: EndReason;
  timeSurvived: number;
}

// === Mission State ===
export interface MissionState {
  id: string;
  type: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  reward: { credits?: number; shards?: number; cosmeticId?: string };
}

// === Meta Progression State ===
export interface MetaState {
  credits: number;
  shards: number;
  tickets: number;
  ticketCap: number;
  lastTicketRefill: number;
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
  stats: {
    totalRuns: number;
    bestScore: number;
    totalNearMisses: number;
  };
}

// === Game State (runtime) ===
export interface GameState {
  mode: Mode;
  seed: Seed;
  timeRemaining: number;
  player: PlayerState;
  rooms: GeneratedRoom[];
  currentRoomIndex: number;
  score: number;
  combo: number;
  comboDecayTimer: number;
  alarm: number;
  nearMissCooldown: number;
  stats: RunStats;
  paused: boolean;
  gameOver: boolean;
  screenShake: number;
}

// === Input State ===
export interface InputState {
  touching: boolean;
  touchPos: Vec2;
  dashRequested: boolean;
}

// === Visual Effects ===
export interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface VisualState {
  particles: Particle[];
  screenShake: Vec2;
  nearMissFlash: number;
  comboPopup: { value: number; timer: number } | null;
}
