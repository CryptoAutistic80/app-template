import { distancePointToSegment, pointInRect, resolveCircleRect } from './collision';
import { clamp, moveTowards, vecDistance, vecNormalize } from './math';
import { generateRunLayout } from './generator';
import { TUNING } from './tuning';
import {
  Difficulty,
  EndReason,
  Laser,
  Loot,
  Mode,
  Rect,
  RunLayout,
  RunStats,
  TripZone,
  Vec2,
  PlayerState,
  Drone,
} from './types';
import { createRng, seedFromUtcDate } from './rng';

export interface UpgradeEffects {
  maxSpeed: number;
  dashCooldown: number;
  magnetRadius: number;
  shieldEnabled: boolean;
  heatConvMul: number;
}

export interface InputState {
  targetWorld: Vec2 | null;
  dashRequested: boolean;
}

export interface GameState {
  layout: RunLayout;
  player: PlayerState;
  alarm: number;
  timeLeft: number;
  combo: number;
  comboTimer: number;
  nearMissCooldown: number;
  invuln: number;
  keys: Set<string>;
  vaultMul: number;
  cursedSpeedBoost: number;
  upgradeEffects: UpgradeEffects;
  lasers: Laser[];
  drones: Drone[];
  loot: Loot[];
  tripZones: (TripZone & { triggered: boolean })[];
  vaultDoors: { rect: Rect; keyId: string; opened: boolean; rewardTable?: string }[];
  walls: Rect[];
  stats: RunStats;
  ended: boolean;
}

export interface RunConfig {
  mode: Mode;
  seed?: number;
  upgrades?: Record<string, number>;
  difficulty?: Difficulty;
}

const TAU = Math.PI * 2;
const PICKUP_RADIUS = 8;

const buildUpgradeEffects = (upgrades: Record<string, number> = {}): UpgradeEffects => {
  const speedLevel = upgrades.SPEED ?? 0;
  const dashLevel = upgrades.DASH ?? 0;
  const magnetLevel = upgrades.MAGNET ?? 0;
  const shieldLevel = upgrades.SHIELD ?? 0;
  const heatLevel = upgrades.HEAT_CONV ?? 0;

  const dashCooldown = Math.max(0.7, TUNING.player.dash.cooldownBase - dashLevel * TUNING.upgrades.list.DASH.effectPerLevel);

  return {
    maxSpeed: TUNING.player.maxSpeed * (1 + speedLevel * TUNING.upgrades.list.SPEED.effectPerLevel),
    dashCooldown,
    magnetRadius: TUNING.player.magnet.baseRadius + magnetLevel * TUNING.upgrades.list.MAGNET.effectPerLevel,
    shieldEnabled: shieldLevel > 0,
    heatConvMul: heatLevel * TUNING.upgrades.list.HEAT_CONV.effectPerLevel,
  };
};

const alarmLevel = (alarm: number) => {
  const levels = TUNING.danger.alarm.levels;
  for (let i = levels.length - 1; i >= 0; i -= 1) {
    if (alarm >= levels[i].at) {
      return levels[i];
    }
  }
  return levels[0];
};

const laserSegment = (laser: Laser) => {
  const half = laser.length / 2;
  const dx = Math.cos(laser.angle) * half;
  const dy = Math.sin(laser.angle) * half;
  return {
    a: { x: laser.anchor.x - dx, y: laser.anchor.y - dy },
    b: { x: laser.anchor.x + dx, y: laser.anchor.y + dy },
  };
};

const isLaserActive = (laser: Laser) => {
  if (laser.kind === 'BLINK_GATE' && laser.blink) {
    return laser.blink.phase < laser.blink.onFor;
  }
  return true;
};

const spawnVaultReward = (rect: Rect, rewardTable: string | undefined, rngSeed: number): Loot[] => {
  if (!rewardTable) {
    return [];
  }
  const rng = createRng(rngSeed);
  const table = TUNING.loot.tables[rewardTable as keyof typeof TUNING.loot.tables];
  const weights = table.picks.map((pick) => pick.weight);
  const rewards: Loot[] = [];
  for (let i = 0; i < 3; i += 1) {
    const chosen = pickWeightedLoot(table.picks, weights, rng) ?? table.picks[0];
    rewards.push({
      id: `vault-reward-${rect.x}-${rect.y}-${i}`,
      kind: chosen.kind,
      pos: { x: rect.x + rect.w / 2 + rng.float(-25, 25), y: rect.y + rect.h + 30 + rng.float(-15, 15) },
      value: chosen.value,
      ttl: chosen.kind === 'CROWN' ? TUNING.loot.ttl.crown : TUNING.loot.ttl.gem,
      cursed: chosen.cursed,
    });
  }
  return rewards;
};

const pickWeightedLoot = (
  picks: { kind: Loot['kind']; weight: number; value: number; cursed?: Loot['cursed'] }[],
  weights: number[],
  rng: { float: (min?: number, max?: number) => number },
) => {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng.float(0, total);
  for (let i = 0; i < picks.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return picks[i];
    }
  }
  return picks[picks.length - 1];
};

const flattenLayout = (layout: RunLayout) => {
  const lasers: Laser[] = [];
  const drones: Drone[] = [];
  const loot: Loot[] = [];
  const tripZones: (TripZone & { triggered: boolean })[] = [];
  const vaultDoors: { rect: Rect; keyId: string; opened: boolean; rewardTable?: string }[] = [];
  const walls: Rect[] = [];

  layout.rooms.forEach((room) => {
    lasers.push(...room.lasers);
    drones.push(...room.drones);
    loot.push(...room.loot);
    tripZones.push(...room.tripZones.map((zone) => ({ ...zone, triggered: false })));
    vaultDoors.push(...room.vaultDoors.map((door) => ({ ...door })));
    walls.push(...room.walls);
  });

  return { lasers, drones, loot, tripZones, vaultDoors, walls };
};

export const createRun = ({ mode, seed, upgrades, difficulty = 'PRO' }: RunConfig): GameState => {
  const resolvedSeed =
    seed ??
    (mode === 'DAILY'
      ? seedFromUtcDate(new Date())
      : Math.floor(Date.now() % 2147483647));
  const layout = generateRunLayout(resolvedSeed, mode, difficulty);
  const { lasers, drones, loot, tripZones, vaultDoors, walls } = flattenLayout(layout);
  const startPos = layout.rooms[0]?.spawnPoints?.[0] ?? { x: ROOM_CENTER.x, y: ROOM_CENTER.y };
  const upgradeEffects = buildUpgradeEffects(upgrades);

  const player: PlayerState = {
    pos: { ...startPos },
    vel: { x: 0, y: 0 },
    radius: TUNING.player.radius,
    dashCharges: TUNING.player.dash.chargesBase,
    dashCooldown: 0,
    shield: upgradeEffects.shieldEnabled,
    magnetRadius: upgradeEffects.magnetRadius,
    cursedStacks: 0,
  };

  const stats: RunStats = {
    score: 0,
    creditsEarned: 0,
    shardsEarned: 0,
    nearMissCount: 0,
    vaultsOpened: 0,
    maxAlarm: 0,
    streakMax: 0,
    endReason: 'TIME',
  };

  return {
    layout,
    player,
    alarm: 0,
    timeLeft: TUNING.run.durationSec,
    combo: TUNING.scoring.combo.start,
    comboTimer: 0,
    nearMissCooldown: 0,
    invuln: 0,
    keys: new Set(),
    vaultMul: 1,
    cursedSpeedBoost: 0,
    upgradeEffects,
    lasers,
    drones,
    loot,
    tripZones,
    vaultDoors,
    walls,
    stats,
    ended: false,
  };
};

const ROOM_CENTER = { x: TUNING.world.roomW / 2, y: TUNING.world.roomH / 2 };

export const stepGame = (state: GameState, input: InputState, dt: number) => {
  if (state.ended) {
    return;
  }

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    finishRun(state, 'TIME');
    return;
  }

  if (TUNING.danger.alarm.enabled) {
    state.alarm = Math.max(0, state.alarm - TUNING.danger.alarm.decayPerSec * dt);
  }

  const alarmSettings = alarmLevel(state.alarm);
  state.stats.maxAlarm = Math.max(state.stats.maxAlarm, state.alarm);

  const player = state.player;
  const inputTarget = input.targetWorld;

  if (inputTarget) {
    const dir = vecNormalize({ x: inputTarget.x - player.pos.x, y: inputTarget.y - player.pos.y });
    player.vel.x += dir.x * TUNING.player.accel * dt;
    player.vel.y += dir.y * TUNING.player.accel * dt;
  } else {
    const drag = Math.exp(-TUNING.player.friction * dt);
    player.vel.x *= drag;
    player.vel.y *= drag;
  }

  const cursedSpeedMul = 1 + state.cursedSpeedBoost;
  const maxSpeed = state.upgradeEffects.maxSpeed * cursedSpeedMul;
  const speed = Math.hypot(player.vel.x, player.vel.y);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    player.vel.x *= scale;
    player.vel.y *= scale;
  }

  updateDash(player, state, input, dt);

  player.pos.x += player.vel.x * dt;
  player.pos.y += player.vel.y * dt;

  const worldW = TUNING.world.roomW;
  const worldH = TUNING.world.roomH * state.layout.rooms.length;
  player.pos.x = clamp(player.pos.x, player.radius, worldW - player.radius);
  player.pos.y = clamp(player.pos.y, player.radius, worldH - player.radius);

  state.walls.forEach((wall) => {
    player.pos = resolveCircleRect(player.pos, player.radius, wall);
  });

  updateLasers(state.lasers, dt, alarmSettings.laserSpeedMul);
  updateDrones(state.drones, dt, alarmSettings.droneSpeedMul);

  if (state.invuln > 0) {
    state.invuln = Math.max(0, state.invuln - dt);
  }

  handleTripZones(state, dt);
  handleLoot(state, alarmSettings.lootValueMul, dt);
  handleNearMiss(state, dt);
  handleVaults(state);
  handleCollisions(state);

  updateCombo(state, dt);

  if (state.alarm >= TUNING.danger.alarm.max) {
    finishRun(state, 'ALARM');
  }
};

const updateDash = (player: PlayerState, state: GameState, input: InputState, dt: number) => {
  if (player.dashCharges < TUNING.player.dash.chargesBase) {
    player.dashCooldown -= dt;
    if (player.dashCooldown <= 0) {
      player.dashCharges += 1;
      if (player.dashCharges < TUNING.player.dash.chargesBase) {
        player.dashCooldown = state.upgradeEffects.dashCooldown;
      } else {
        player.dashCooldown = 0;
      }
    }
  }

  if (!input.dashRequested || player.dashCharges <= 0) {
    return;
  }

  const dir = input.targetWorld
    ? vecNormalize({ x: input.targetWorld.x - player.pos.x, y: input.targetWorld.y - player.pos.y })
    : vecNormalize(player.vel);

  if (Math.hypot(dir.x, dir.y) < 0.1) {
    input.dashRequested = false;
    return;
  }

  player.vel.x += dir.x * TUNING.player.dash.impulse;
  player.vel.y += dir.y * TUNING.player.dash.impulse;
  player.dashCharges -= 1;
  player.dashCooldown = state.upgradeEffects.dashCooldown;
  state.invuln = Math.max(state.invuln, TUNING.player.dash.iFrames);
  input.dashRequested = false;
};

const updateLasers = (lasers: Laser[], dt: number, speedMul: number) => {
  lasers.forEach((laser) => {
    if (laser.kind === 'ROTATOR') {
      laser.angle = (laser.angle + laser.angVel * speedMul * dt + TAU) % TAU;
    }
    if (laser.kind === 'SWEEPER') {
      const span = laser.sweepSpan ?? Math.PI;
      laser.angle += (laser.sweepDir ?? 1) * laser.angVel * speedMul * dt;
      const halfSpan = span / 2;
      if (laser.angle > halfSpan) {
        laser.angle = halfSpan;
        laser.sweepDir = -1;
      }
      if (laser.angle < -halfSpan) {
        laser.angle = -halfSpan;
        laser.sweepDir = 1;
      }
    }
    if (laser.kind === 'BLINK_GATE' && laser.blink) {
      laser.blink.phase = (laser.blink.phase + dt) % laser.blink.period;
    }
  });
};

const updateDrones = (drones: Drone[], dt: number, speedMul: number) => {
  drones.forEach((drone) => {
    const target = drone.waypoints[drone.wpIndex] ?? drone.pos;
    const step = drone.speed * speedMul * dt;
    drone.pos = moveTowards(drone.pos, target, step);
    if (vecDistance(drone.pos, target) < 3) {
      drone.wpIndex = (drone.wpIndex + 1) % drone.waypoints.length;
    }
  });
};

const handleTripZones = (state: GameState, dt: number) => {
  state.tripZones.forEach((zone) => {
    if (zone.triggered) {
      return;
    }
    if (pointInRect(state.player.pos, zone.rect)) {
      zone.triggered = true;
      state.alarm += zone.alarmBurst;
    }
  });

  state.drones.forEach((drone) => {
    if (!drone.scanner) {
      return;
    }
    const dist = vecDistance(drone.pos, state.player.pos);
    if (dist > drone.scanner.range) {
      return;
    }
    state.alarm += drone.scanner.alarmPerSec * dt;
  });
};

const handleLoot = (state: GameState, lootMul: number, dt: number) => {
  for (let i = state.loot.length - 1; i >= 0; i -= 1) {
    const item = state.loot[i];
    item.ttl -= dt;
    if (item.ttl <= 0) {
      state.loot.splice(i, 1);
      continue;
    }

    const dist = vecDistance(state.player.pos, item.pos);
    if (dist < state.player.magnetRadius && dist > state.player.radius + PICKUP_RADIUS) {
      item.pos = moveTowards(item.pos, state.player.pos, TUNING.player.magnet.pullStrength * dt);
    }

    if (dist <= state.player.radius + PICKUP_RADIUS) {
      const value = item.value * lootMul;
      const comboMul = TUNING.scoring.combo.enabled ? state.combo : 1;
      const vaultMul = state.vaultMul;
      const scoreGain = value * TUNING.scoring.baseLootScore * comboMul * vaultMul;
      const creditBase = value * TUNING.economy.credits.perLootValue;
      const creditMul = 1 + (state.alarm / 100) * state.upgradeEffects.heatConvMul;

      state.stats.score += Math.round(scoreGain);
      state.stats.creditsEarned += Math.round(creditBase * creditMul);
      state.combo = Math.min(TUNING.scoring.combo.max, state.combo + TUNING.scoring.combo.addPerPickup);
      state.comboTimer = TUNING.scoring.combo.decayDelay;
      state.stats.streakMax = Math.max(state.stats.streakMax, Math.round((state.combo - 1) * 10));

      if (item.kind === 'CURSED' && item.cursed) {
        state.player.cursedStacks += item.cursed.stacks;
        state.alarm += item.cursed.alarmBoost;
        state.cursedSpeedBoost += item.cursed.speedBoost;
      }

      if (item.kind === 'KEY' && item.keyId) {
        state.keys.add(item.keyId);
      }

      state.loot.splice(i, 1);
    }
  }
};

const handleNearMiss = (state: GameState, dt: number) => {
  state.nearMissCooldown = Math.max(0, state.nearMissCooldown - dt);
  if (state.nearMissCooldown > 0) {
    return;
  }
  let bestDistance = Infinity;
  state.lasers.forEach((laser) => {
    if (!isLaserActive(laser)) {
      return;
    }
    const segment = laserSegment(laser);
    const distance = distancePointToSegment(state.player.pos, segment.a, segment.b) - laser.thickness;
    if (distance < bestDistance) {
      bestDistance = distance;
    }
  });

  if (bestDistance <= TUNING.danger.nearMiss.window) {
    state.stats.score += TUNING.danger.nearMiss.scoreTick;
    state.stats.creditsEarned += TUNING.danger.nearMiss.creditsTick;
    state.stats.nearMissCount += 1;
    state.nearMissCooldown = TUNING.danger.nearMiss.cooldown;
  }
};

const handleVaults = (state: GameState) => {
  state.vaultDoors.forEach((door) => {
    if (door.opened) {
      return;
    }
    const player = state.player;
    const rect = door.rect;
    const inDoor =
      player.pos.x > rect.x - player.radius &&
      player.pos.x < rect.x + rect.w + player.radius &&
      player.pos.y > rect.y - player.radius &&
      player.pos.y < rect.y + rect.h + player.radius;
    if (!inDoor) {
      return;
    }

    if (!state.keys.has(door.keyId)) {
      return;
    }

    door.opened = true;
    state.keys.delete(door.keyId);
    state.stats.vaultsOpened += 1;
    state.stats.score += TUNING.scoring.vaultBonus.openScoreFlat;
    state.stats.creditsEarned += TUNING.economy.credits.vaultOpenFlat;
    state.vaultMul = Math.min(TUNING.scoring.vaultBonus.maxChainMul, state.vaultMul + TUNING.scoring.vaultBonus.chainMulAdd);

    const rewards = spawnVaultReward(rect, door.rewardTable, rect.x + rect.y);
    state.loot.push(...rewards);
  });
};

const handleCollisions = (state: GameState) => {
  if (state.invuln > 0) {
    return;
  }

  for (const laser of state.lasers) {
    if (!isLaserActive(laser)) {
      continue;
    }
    const segment = laserSegment(laser);
    const distance = distancePointToSegment(state.player.pos, segment.a, segment.b);
    if (distance <= state.player.radius + laser.thickness * 0.5) {
      hitPlayer(state, 'LASER');
      return;
    }
  }

  for (const drone of state.drones) {
    const distance = vecDistance(state.player.pos, drone.pos);
    if (distance <= state.player.radius + drone.radius) {
      hitPlayer(state, 'DRONE');
      return;
    }
  }
};

const hitPlayer = (state: GameState, reason: EndReason) => {
  if (state.player.shield) {
    state.player.shield = false;
    state.invuln = TUNING.player.shield.postHitInvuln;
    return;
  }
  finishRun(state, reason);
};

const updateCombo = (state: GameState, dt: number) => {
  if (!TUNING.scoring.combo.enabled) {
    return;
  }
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    return;
  }
  state.combo = Math.max(TUNING.scoring.combo.start, state.combo - TUNING.scoring.combo.decayPerSec * dt);
};

const finishRun = (state: GameState, reason: EndReason) => {
  if (state.ended) {
    return;
  }
  state.ended = true;
  state.stats.endReason = reason;

  if (reason === 'TIME') {
    state.stats.score = Math.round(state.stats.score * TUNING.scoring.endBonus.timeUpMul);
    state.stats.creditsEarned += TUNING.economy.credits.completionBonus;
  }

  if (reason === 'ALARM') {
    state.stats.score = Math.round(state.stats.score * TUNING.scoring.endBonus.alarmMaxFailMul);
  }
};
