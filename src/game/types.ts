export type Seed = number;

export type Mode = 'NORMAL' | 'DAILY' | 'RISK';
export type EndReason = 'TIME' | 'LASER' | 'DRONE' | 'ALARM' | 'QUIT';

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

export type LootKind = 'COIN' | 'GEM' | 'CROWN' | 'KEY' | 'CURSED';

export type LaserKind = 'ROTATOR' | 'SWEEPER' | 'BLINK_GATE';
export type DroneKind = 'PATROL' | 'SCANNER';

export interface PlayerState {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  dashCharges: number;
  dashCooldown: number;
  shield: boolean;
  magnetRadius: number;
  cursedStacks: number;
}

export interface Laser {
  id: string;
  kind: LaserKind;
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
  ttl: number;
  cursed?: { stacks: number; alarmBoost: number; speedBoost: number };
  keyId?: string;
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
  spawners: SpawnerSpec[];
  constraints: TemplateConstraints;
  weight: number;
}

export type SpawnerSpec =
  | { type: 'LOOT_FIELD'; area: Rect; table: string; countMin: number; countMax: number }
  | { type: 'LASER_SET'; anchors: Vec2[]; pattern: string; difficulty: number }
  | { type: 'DRONE_SET'; path: Vec2[]; kind: DroneKind; count: number; difficulty: number }
  | { type: 'TRIP_ZONES'; areas: Rect[]; difficulty: number }
  | { type: 'VAULT_DOOR'; rect: Rect; keyId: string; rewardTable: string };

export interface TemplateConstraints {
  minTelegraphClearance: number;
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
  offset: Vec2;
  doors: { id: string; worldAt: Vec2; normal: Vec2 }[];
  walls: Rect[];
  spawnPoints: Vec2[];
  lasers: Laser[];
  drones: Drone[];
  loot: Loot[];
  tripZones: TripZone[];
  vaultDoors: { rect: Rect; keyId: string; opened: boolean; rewardTable?: string }[];
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
