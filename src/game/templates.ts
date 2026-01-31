// src/game/templates.ts
// Room template definitions - the building blocks of each run

import { RoomTemplate } from "./types";

export const ROOM_W = 360;
export const ROOM_H = 640;

export const templates: RoomTemplate[] = [
  // T1: SPAWN_SAFE_PAD - Safe starting area
  {
    id: "SPAWN_SAFE_PAD",
    tags: ["SPAWN_SAFE", "CONNECTOR"],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: "D_N", at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H },
      { x: 0, y: 0, w: ROOM_W, h: 10 },
      { x: 0, y: ROOM_H - 10, w: ROOM_W, h: 10 },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.75 }],
    spawners: [
      {
        type: "LOOT_FIELD",
        area: { x: 40, y: 200, w: 280, h: 320 },
        table: "SAFE_COINS",
        countMin: 6,
        countMax: 10,
      },
    ],
    constraints: {
      minTelegraphClearance: 90,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.0,
      maxDroneDensity: 0.0,
    },
    weight: 1,
  },

  // T2: MAIN_LOOP_ARCADE - Basic room with one rotator laser
  {
    id: "MAIN_LOOP_ARCADE",
    tags: ["MAIN"],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: "D_N", at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: "D_S", at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H },
      { x: 0, y: 0, w: ROOM_W, h: 10 },
      { x: 0, y: ROOM_H - 10, w: ROOM_W, h: 10 },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H - 80 }],
    spawners: [
      {
        type: "LOOT_FIELD",
        area: { x: 30, y: 100, w: 300, h: 440 },
        table: "MAIN_MIX",
        countMin: 8,
        countMax: 14,
      },
      {
        type: "LASER_SET",
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 2 }],
        pattern: "SINGLE_ROTATOR",
        difficulty: 1,
      },
    ],
    constraints: {
      minTelegraphClearance: 60,
      disallowBlinkOverlap: false,
      maxLaserDensity: 0.3,
      maxDroneDensity: 0.0,
    },
    weight: 3,
  },

  // T3: MAIN_SWEEPER_HALL - Introduces sweep timing
  {
    id: "MAIN_SWEEPER_HALL",
    tags: ["MAIN"],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: "D_N", at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: "D_S", at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H },
      { x: 0, y: 0, w: ROOM_W, h: 10 },
      { x: 0, y: ROOM_H - 10, w: ROOM_W, h: 10 },
      // Center pillar for cover
      { x: ROOM_W / 2 - 25, y: ROOM_H / 2 - 40, w: 50, h: 80 },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H - 80 }],
    spawners: [
      {
        type: "LOOT_FIELD",
        area: { x: 30, y: 80, w: 130, h: 200 },
        table: "MAIN_MIX",
        countMin: 4,
        countMax: 7,
      },
      {
        type: "LOOT_FIELD",
        area: { x: 200, y: 80, w: 130, h: 200 },
        table: "MAIN_MIX",
        countMin: 4,
        countMax: 7,
      },
      {
        type: "LASER_SET",
        anchors: [
          { x: 10, y: ROOM_H / 3 },
          { x: ROOM_W - 10, y: (ROOM_H * 2) / 3 },
        ],
        pattern: "TWO_SWEEPERS_OPPOSED",
        difficulty: 2,
      },
    ],
    constraints: {
      minTelegraphClearance: 50,
      disallowBlinkOverlap: false,
      maxLaserDensity: 0.5,
      maxDroneDensity: 0.0,
    },
    weight: 2,
  },

  // T4: MAIN_DRONE_PATROL - Introduces drones
  {
    id: "MAIN_DRONE_PATROL",
    tags: ["MAIN"],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: "D_N", at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: "D_S", at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H },
      { x: 0, y: 0, w: ROOM_W, h: 10 },
      { x: 0, y: ROOM_H - 10, w: ROOM_W, h: 10 },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H - 80 }],
    spawners: [
      {
        type: "LOOT_FIELD",
        area: { x: 60, y: 150, w: 240, h: 340 },
        table: "MAIN_MIX",
        countMin: 10,
        countMax: 16,
      },
      {
        type: "DRONE_SET",
        path: [
          { x: 60, y: 150 },
          { x: 300, y: 150 },
          { x: 300, y: 490 },
          { x: 60, y: 490 },
        ],
        kind: "PATROL",
        count: 1,
        difficulty: 1,
      },
    ],
    constraints: {
      minTelegraphClearance: 60,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.0,
      maxDroneDensity: 0.4,
    },
    weight: 2,
  },

  // T5: CONNECTOR_CHOKEPOINT - Blink gate corridor
  {
    id: "CONNECTOR_CHOKEPOINT",
    tags: ["CONNECTOR"],
    size: { w: ROOM_W, h: ROOM_H / 2 },
    doors: [
      { id: "D_N", at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: "D_S", at: { x: ROOM_W / 2, y: ROOM_H / 2 - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H / 2 },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H / 2 },
      { x: 0, y: 0, w: ROOM_W, h: 10 },
      { x: 0, y: ROOM_H / 2 - 10, w: ROOM_W, h: 10 },
      // Narrow corridor walls
      { x: 10, y: ROOM_H / 4 - 40, w: 100, h: 80 },
      { x: ROOM_W - 110, y: ROOM_H / 4 - 40, w: 100, h: 80 },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H / 2 - 60 }],
    spawners: [
      {
        type: "LOOT_FIELD",
        area: { x: 120, y: 60, w: 120, h: 200 },
        table: "MAIN_MIX",
        countMin: 3,
        countMax: 5,
      },
      {
        type: "LASER_SET",
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 4 }],
        pattern: "BLINK_GATE_CENTER",
        difficulty: 2,
      },
    ],
    constraints: {
      minTelegraphClearance: 80,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.3,
      maxDroneDensity: 0.0,
    },
    weight: 1,
  },

  // T6: RISK_WING_CURSED_CLUSTER - High risk, high reward
  {
    id: "RISK_WING_CURSED_CLUSTER",
    tags: ["RISK"],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: "D_S", at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H },
      { x: 0, y: 0, w: ROOM_W, h: 10 },
      { x: 0, y: ROOM_H - 10, w: ROOM_W, h: 10 },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H - 80 }],
    spawners: [
      {
        type: "LOOT_FIELD",
        area: { x: 50, y: 100, w: 260, h: 400 },
        table: "CURSED_MIX",
        countMin: 12,
        countMax: 18,
      },
      {
        type: "LASER_SET",
        anchors: [
          { x: 80, y: 200 },
          { x: ROOM_W - 80, y: 200 },
          { x: ROOM_W / 2, y: 400 },
        ],
        pattern: "TRI_ROTATORS",
        difficulty: 3,
      },
    ],
    constraints: {
      minTelegraphClearance: 45,
      disallowBlinkOverlap: false,
      maxLaserDensity: 0.7,
      maxDroneDensity: 0.0,
    },
    weight: 1,
  },

  // T7: VAULT_ANTICHAMBER - Vault door room
  {
    id: "VAULT_ANTICHAMBER",
    tags: ["VAULT"],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: "D_S", at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H },
      { x: 0, y: 0, w: ROOM_W, h: 10 },
      { x: 0, y: ROOM_H - 10, w: ROOM_W, h: 10 },
      // Vault alcove walls
      { x: 10, y: 100, w: 80, h: 10 },
      { x: ROOM_W - 90, y: 100, w: 80, h: 10 },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H - 80 }],
    spawners: [
      {
        type: "LOOT_FIELD",
        area: { x: 100, y: 200, w: 160, h: 300 },
        table: "MAIN_MIX",
        countMin: 6,
        countMax: 10,
      },
      {
        type: "VAULT_DOOR",
        rect: { x: ROOM_W / 2 - 40, y: 20, w: 80, h: 60 },
        keyId: "vault_key_1",
        rewardTable: "VAULT_REWARD",
      },
      {
        type: "LASER_SET",
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 2 }],
        pattern: "SINGLE_ROTATOR",
        difficulty: 2,
      },
    ],
    constraints: {
      minTelegraphClearance: 55,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.4,
      maxDroneDensity: 0.0,
    },
    weight: 1,
  },

  // T8: EXIT_STRIP_MULTIPLIER - End-run bonus lane
  {
    id: "EXIT_STRIP_MULTIPLIER",
    tags: ["EXIT_STRIP"],
    size: { w: ROOM_W, h: ROOM_H / 2 },
    doors: [
      { id: "D_S", at: { x: ROOM_W / 2, y: ROOM_H / 2 - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [
      { x: 0, y: 0, w: 10, h: ROOM_H / 2 },
      { x: ROOM_W - 10, y: 0, w: 10, h: ROOM_H / 2 },
      { x: 0, y: 0, w: ROOM_W, h: 10 },
      { x: 0, y: ROOM_H / 2 - 10, w: ROOM_W, h: 10 },
    ],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H / 2 - 60 }],
    spawners: [
      {
        type: "LOOT_FIELD",
        area: { x: 40, y: 40, w: 280, h: 220 },
        table: "MAIN_MIX",
        countMin: 8,
        countMax: 12,
      },
      {
        type: "LASER_SET",
        anchors: [
          { x: 10, y: 100 },
          { x: ROOM_W - 10, y: 200 },
        ],
        pattern: "TWO_SWEEPERS_OPPOSED",
        difficulty: 1,
      },
    ],
    constraints: {
      minTelegraphClearance: 70,
      disallowBlinkOverlap: false,
      maxLaserDensity: 0.4,
      maxDroneDensity: 0.0,
    },
    weight: 1,
  },
];

// Get template by ID
export function getTemplate(id: string): RoomTemplate | undefined {
  return templates.find((t) => t.id === id);
}

// Get templates by tag
export function getTemplatesByTag(tag: string): RoomTemplate[] {
  return templates.filter((t) => t.tags.includes(tag));
}
