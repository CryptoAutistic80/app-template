export const TUNING = {
  run: {
    durationSec: 60,
    fixedStep: 1 / 120,
    maxFrameDt: 1 / 20,
  },

  world: {
    roomW: 360,
    roomH: 640,
    wallThickness: 10,
  },

  player: {
    radius: 9,
    maxSpeed: 250,
    accel: 1400,
    friction: 9.5,
    dash: {
      chargesBase: 2,
      cooldownBase: 2.6,
      impulse: 520,
      iFrames: 0.06,
    },
    magnet: {
      baseRadius: 34,
      pullStrength: 900,
    },
    shield: {
      baseEnabled: false,
      postHitInvuln: 0.35,
    },
  },

  danger: {
    nearMiss: {
      window: 14,
      scoreTick: 12,
      creditsTick: 1,
      cooldown: 0.12,
    },

    alarm: {
      enabled: true,
      max: 100,
      decayPerSec: 3.0,
      levels: [
        { at: 0, laserSpeedMul: 1.0, droneSpeedMul: 1.0, lootValueMul: 1.0 },
        { at: 25, laserSpeedMul: 1.04, droneSpeedMul: 1.04, lootValueMul: 1.1 },
        { at: 50, laserSpeedMul: 1.08, droneSpeedMul: 1.08, lootValueMul: 1.22 },
        { at: 75, laserSpeedMul: 1.12, droneSpeedMul: 1.12, lootValueMul: 1.38 },
      ],
      cursedStackAlarmAdd: 4.5,
      tripZoneBurst: 18,
    },
  },

  hazards: {
    lasers: {
      thickness: 6,
      telegraphOpacity: 0.35,
      rotator: { angVelMin: 0.55, angVelMax: 1.2, lengthMin: 140, lengthMax: 240 },
      sweeper: { sweepSpan: 200, speedMin: 70, speedMax: 130 },
      blinkGate: { period: 2.6, onFor: 0.85, telegraph: 0.55 },
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
          { kind: 'COIN', weight: 80, value: 20 },
          { kind: 'GEM', weight: 20, value: 60 },
        ],
      },
      MAIN_MIX: {
        picks: [
          { kind: 'COIN', weight: 70, value: 22 },
          { kind: 'GEM', weight: 24, value: 70 },
          { kind: 'CROWN', weight: 6, value: 160 },
        ],
      },
      CURSED_MIX: {
        picks: [
          { kind: 'GEM', weight: 55, value: 90 },
          { kind: 'CROWN', weight: 25, value: 220 },
          { kind: 'CURSED', weight: 20, value: 360, cursed: { stacks: 1, alarmBoost: 10, speedBoost: 0.03 } },
        ],
      },
      VAULT_REWARD: {
        picks: [
          { kind: 'GEM', weight: 55, value: 140 },
          { kind: 'CROWN', weight: 35, value: 320 },
          { kind: 'CURSED', weight: 10, value: 520, cursed: { stacks: 2, alarmBoost: 18, speedBoost: 0.05 } },
        ],
      },
      KEY_SPAWN: {
        picks: [{ kind: 'KEY', weight: 100, value: 0 }],
      },
    },
  },

  scoring: {
    baseLootScore: 1.0,
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
      chainMulAdd: 0.25,
      maxChainMul: 2.0,
    },
    endBonus: {
      timeUpMul: 1.1,
      alarmMaxFailMul: 0.85,
    },
  },

  economy: {
    credits: {
      perLootValue: 0.1,
      nearMissTick: 1,
      vaultOpenFlat: 18,
      completionBonus: 35,
    },
    shards: {
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
    list: {
      SPEED: { maxLevel: 12, costBase: 120, costMul: 1.18, effectPerLevel: 0.018 },
      DASH: { maxLevel: 10, costBase: 160, costMul: 1.2, effectPerLevel: 0.1 },
      MAGNET: { maxLevel: 10, costBase: 130, costMul: 1.19, effectPerLevel: 3.2 },
      SHIELD: { maxLevel: 5, costBase: 260, costMul: 1.35, effectPerLevel: 1 },
      HEAT_CONV: { maxLevel: 8, costBase: 200, costMul: 1.22, effectPerLevel: 0.06 },
    },
  },

  cosmetics: {
    trails: [
      { id: 'TRAIL_SOFT', length: 18 },
      { id: 'TRAIL_SPARK', length: 14 },
      { id: 'TRAIL_COMET', length: 22 },
    ],
    palettes: [
      {
        id: 'PAL_CYAN_MAGENTA',
        bg: ['#070812', '#0B1030'],
        neonA: '#22E7FF',
        neonB: '#FF2DDA',
        neonC: '#A7FF3A',
        warning: '#FF3B30',
      },
      {
        id: 'PAL_LIME_VIOLET',
        bg: ['#05060B', '#0F0B26'],
        neonA: '#B7FF00',
        neonB: '#7C4DFF',
        neonC: '#00F5D4',
        warning: '#FF375F',
      },
    ],
  },

  missions: {
    dailyCount: 3,
    weeklyCount: 3,
    pool: {
      nearMiss: { target: [8, 14, 20], rewardShards: [2, 3, 4] },
      vaults: { target: [1, 2, 3], rewardShards: [3, 5, 7] },
      score: { target: [9000, 15000, 22000], rewardShards: [2, 4, 6] },
      alarm: { target: [40, 60, 75], rewardShards: [2, 3, 5] },
    },
  },
} as const;
