import { RoomTemplate } from './types';
import { TUNING } from './tuning';

export const ROOM_W = TUNING.world.roomW;
export const ROOM_H = TUNING.world.roomH;

const SIDE_WALLS = [
  { x: 0, y: 0, w: TUNING.world.wallThickness, h: ROOM_H },
  { x: ROOM_W - TUNING.world.wallThickness, y: 0, w: TUNING.world.wallThickness, h: ROOM_H },
];

export const templates: RoomTemplate[] = [
  {
    id: 'SPAWN_SAFE_PAD',
    tags: ['SPAWN_SAFE', 'CONNECTOR'],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: 'D_N', at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: 'D_S', at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [...SIDE_WALLS],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.75 }],
    spawners: [
      {
        type: 'LOOT_FIELD',
        area: { x: 40, y: 200, w: 280, h: 320 },
        table: 'SAFE_COINS',
        countMin: 6,
        countMax: 10,
      },
    ],
    constraints: {
      minTelegraphClearance: 90,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0,
      maxDroneDensity: 0,
    },
    weight: 1,
  },
  {
    id: 'MAIN_LOOP_ARCADE',
    tags: ['MAIN'],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: 'D_N', at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: 'D_S', at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [...SIDE_WALLS],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.7 }],
    spawners: [
      {
        type: 'LOOT_FIELD',
        area: { x: 30, y: 160, w: 300, h: 380 },
        table: 'MAIN_MIX',
        countMin: 8,
        countMax: 12,
      },
      {
        type: 'LASER_SET',
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 2 }],
        pattern: 'SINGLE_ROTATOR',
        difficulty: 1,
      },
    ],
    constraints: {
      minTelegraphClearance: 70,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.25,
      maxDroneDensity: 0,
    },
    weight: 2,
  },
  {
    id: 'MAIN_SWEEPER_HALL',
    tags: ['MAIN'],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: 'D_N', at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: 'D_S', at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [...SIDE_WALLS],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.78 }],
    spawners: [
      {
        type: 'LASER_SET',
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 2 }],
        pattern: 'TWO_SWEEPERS_OPPOSED',
        difficulty: 1.15,
      },
      {
        type: 'LOOT_FIELD',
        area: { x: 40, y: 180, w: 280, h: 300 },
        table: 'MAIN_MIX',
        countMin: 6,
        countMax: 10,
      },
    ],
    constraints: {
      minTelegraphClearance: 80,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.35,
      maxDroneDensity: 0,
    },
    weight: 2,
  },
  {
    id: 'MAIN_DRONE_PATROL',
    tags: ['MAIN'],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: 'D_N', at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: 'D_S', at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [...SIDE_WALLS],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.7 }],
    spawners: [
      {
        type: 'DRONE_SET',
        path: [
          { x: 70, y: 160 },
          { x: ROOM_W - 70, y: 160 },
          { x: ROOM_W - 70, y: ROOM_H - 160 },
          { x: 70, y: ROOM_H - 160 },
        ],
        kind: 'PATROL',
        count: 2,
        difficulty: 1,
      },
      {
        type: 'LOOT_FIELD',
        area: { x: 50, y: 190, w: 260, h: 280 },
        table: 'MAIN_MIX',
        countMin: 7,
        countMax: 11,
      },
    ],
    constraints: {
      minTelegraphClearance: 70,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0,
      maxDroneDensity: 0.35,
    },
    weight: 2,
  },
  {
    id: 'CONNECTOR_CHOKEPOINT',
    tags: ['CONNECTOR'],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: 'D_N', at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: 'D_S', at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [...SIDE_WALLS],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.78 }],
    spawners: [
      {
        type: 'LASER_SET',
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 2 }],
        pattern: 'BLINK_GATE_CENTER',
        difficulty: 1,
      },
      {
        type: 'LOOT_FIELD',
        area: { x: 40, y: 120, w: 280, h: 160 },
        table: 'SAFE_COINS',
        countMin: 4,
        countMax: 7,
      },
    ],
    constraints: {
      minTelegraphClearance: 110,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.2,
      maxDroneDensity: 0,
    },
    weight: 1,
  },
  {
    id: 'RISK_WING_CURSED_CLUSTER',
    tags: ['RISK'],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: 'D_N', at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: 'D_S', at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [...SIDE_WALLS],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.8 }],
    spawners: [
      {
        type: 'LOOT_FIELD',
        area: { x: 35, y: 150, w: 290, h: 340 },
        table: 'CURSED_MIX',
        countMin: 6,
        countMax: 9,
      },
      {
        type: 'LASER_SET',
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 2 }],
        pattern: 'TRI_ROTATORS',
        difficulty: 1.25,
      },
    ],
    constraints: {
      minTelegraphClearance: 60,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.45,
      maxDroneDensity: 0,
    },
    weight: 1,
  },
  {
    id: 'VAULT_ANTICHAMBER',
    tags: ['VAULT'],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: 'D_N', at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: 'D_S', at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [...SIDE_WALLS],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.8 }],
    spawners: [
      {
        type: 'VAULT_DOOR',
        rect: { x: ROOM_W / 2 - 32, y: 120, w: 64, h: 26 },
        keyId: 'VAULT_A',
        rewardTable: 'VAULT_REWARD',
      },
      {
        type: 'LOOT_FIELD',
        area: { x: 50, y: 200, w: 260, h: 260 },
        table: 'MAIN_MIX',
        countMin: 5,
        countMax: 8,
      },
      {
        type: 'LASER_SET',
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 2 + 40 }],
        pattern: 'SINGLE_ROTATOR',
        difficulty: 0.9,
      },
    ],
    constraints: {
      minTelegraphClearance: 90,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.25,
      maxDroneDensity: 0,
    },
    weight: 1,
  },
  {
    id: 'EXIT_STRIP_MULTIPLIER',
    tags: ['EXIT_STRIP'],
    size: { w: ROOM_W, h: ROOM_H },
    doors: [
      { id: 'D_N', at: { x: ROOM_W / 2, y: 10 }, normal: { x: 0, y: -1 } },
      { id: 'D_S', at: { x: ROOM_W / 2, y: ROOM_H - 10 }, normal: { x: 0, y: 1 } },
    ],
    walls: [...SIDE_WALLS],
    spawnPoints: [{ x: ROOM_W / 2, y: ROOM_H * 0.75 }],
    spawners: [
      {
        type: 'LOOT_FIELD',
        area: { x: 60, y: 140, w: 240, h: 120 },
        table: 'MAIN_MIX',
        countMin: 5,
        countMax: 7,
      },
      {
        type: 'LASER_SET',
        anchors: [{ x: ROOM_W / 2, y: ROOM_H / 2 - 40 }],
        pattern: 'TWO_SWEEPERS_OPPOSED',
        difficulty: 1,
      },
    ],
    constraints: {
      minTelegraphClearance: 80,
      disallowBlinkOverlap: true,
      maxLaserDensity: 0.35,
      maxDroneDensity: 0,
    },
    weight: 1,
  },
];
