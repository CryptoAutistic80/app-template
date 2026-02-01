import { Difficulty, GeneratedRoom, Laser, Loot, Mode, RunLayout, RoomTemplate, TripZone, Vec2, Drone } from './types';
import { templates, ROOM_H, ROOM_W } from './templates';
import { TUNING } from './tuning';
import { RNG, createRng, pickWeighted } from './rng';

const TAU = Math.PI * 2;

const pickTemplate = (tag: string, rng: RNG): RoomTemplate => {
  const candidates = templates.filter((template) => template.tags.includes(tag));
  const weights = candidates.map((template) => template.weight);
  return pickWeighted(candidates, weights, rng);
};

const spawnLootField = (
  roomId: string,
  area: { x: number; y: number; w: number; h: number },
  tableId: string,
  countMin: number,
  countMax: number,
  rng: RNG,
): Loot[] => {
  const table = TUNING.loot.tables[tableId as keyof typeof TUNING.loot.tables];
  const count = rng.int(countMin, countMax);
  const loot: Loot[] = [];
  const weights = table.picks.map((pick) => pick.weight);
  for (let i = 0; i < count; i += 1) {
    const pick = pickWeighted(table.picks, weights, rng);
    const pos = {
      x: area.x + rng.float(0, area.w),
      y: area.y + rng.float(0, area.h),
    };
    const ttl =
      pick.kind === 'COIN'
        ? TUNING.loot.ttl.coin
        : pick.kind === 'GEM'
          ? TUNING.loot.ttl.gem
          : pick.kind === 'CROWN'
            ? TUNING.loot.ttl.crown
            : pick.kind === 'CURSED'
              ? TUNING.loot.ttl.cursed
              : TUNING.loot.ttl.key;
    loot.push({
      id: `${roomId}-loot-${i}-${pick.kind}`,
      kind: pick.kind,
      pos,
      value: pick.value,
      ttl,
      cursed: pick.cursed,
    });
  }
  return loot;
};

const spawnLaserPattern = (roomId: string, pattern: string, anchors: Vec2[], rng: RNG, difficulty: number): Laser[] => {
  const lasers: Laser[] = [];
  const thickness = TUNING.hazards.lasers.thickness;
  const rotator = TUNING.hazards.lasers.rotator;
  const sweeper = TUNING.hazards.lasers.sweeper;
  const blink = TUNING.hazards.lasers.blinkGate;
  const anchor = anchors[0] ?? { x: ROOM_W / 2, y: ROOM_H / 2 };

  if (pattern === 'SINGLE_ROTATOR') {
    lasers.push({
      id: `${roomId}-laser-rotator`,
      kind: 'ROTATOR',
      anchor,
      length: rng.float(rotator.lengthMin, rotator.lengthMax),
      angle: rng.float(0, TAU),
      angVel: rng.float(rotator.angVelMin, rotator.angVelMax) * (rng.pick([1, -1]) as 1 | -1) * difficulty,
      thickness,
      lethal: true,
    });
  }

  if (pattern === 'TWO_SWEEPERS_OPPOSED') {
    const length = ROOM_W - 30;
    lasers.push({
      id: `${roomId}-laser-sweep-a`,
      kind: 'SWEEPER',
      anchor,
      length,
      angle: -sweeper.sweepSpan * 0.25 * (Math.PI / 180),
      angVel: rng.float(sweeper.speedMin, sweeper.speedMax) * (Math.PI / 180) * difficulty,
      sweepDir: 1,
      sweepSpan: (sweeper.sweepSpan * Math.PI) / 180,
      thickness,
      lethal: true,
    });
    lasers.push({
      id: `${roomId}-laser-sweep-b`,
      kind: 'SWEEPER',
      anchor: { x: anchor.x, y: anchor.y + 80 },
      length,
      angle: sweeper.sweepSpan * 0.25 * (Math.PI / 180),
      angVel: rng.float(sweeper.speedMin, sweeper.speedMax) * (Math.PI / 180) * difficulty,
      sweepDir: -1,
      sweepSpan: (sweeper.sweepSpan * Math.PI) / 180,
      thickness,
      lethal: true,
    });
  }

  if (pattern === 'BLINK_GATE_CENTER') {
    lasers.push({
      id: `${roomId}-laser-blink`,
      kind: 'BLINK_GATE',
      anchor,
      length: ROOM_W - 40,
      angle: 0,
      angVel: 0,
      thickness,
      blink: { period: blink.period, onFor: blink.onFor, telegraph: blink.telegraph, phase: rng.float(0, blink.period) },
      lethal: true,
    });
  }

  if (pattern === 'TRI_ROTATORS') {
    for (let i = 0; i < 3; i += 1) {
      lasers.push({
        id: `${roomId}-laser-rotator-${i}`,
        kind: 'ROTATOR',
        anchor: {
          x: anchor.x + Math.cos((TAU / 3) * i) * 60,
          y: anchor.y + Math.sin((TAU / 3) * i) * 60,
        },
        length: rng.float(rotator.lengthMin * 0.7, rotator.lengthMax * 0.85),
        angle: rng.float(0, TAU),
        angVel: rng.float(rotator.angVelMin, rotator.angVelMax) * (rng.pick([1, -1]) as 1 | -1) * difficulty,
        thickness,
        lethal: true,
      });
    }
  }

  return lasers;
};

const spawnDrones = (
  roomId: string,
  path: Vec2[],
  kind: 'PATROL' | 'SCANNER',
  count: number,
  rng: RNG,
  difficulty: number,
): Drone[] => {
  const drones: Drone[] = [];
  const baseSpeed =
    kind === 'SCANNER'
      ? rng.float(TUNING.hazards.drones.scanner.speedMin, TUNING.hazards.drones.scanner.speedMax)
      : rng.float(TUNING.hazards.drones.patrol.speedMin, TUNING.hazards.drones.patrol.speedMax);
  for (let i = 0; i < count; i += 1) {
    const wpIndex = i % path.length;
    drones.push({
      id: `${roomId}-drone-${i}`,
      kind,
      pos: { ...path[wpIndex] },
      vel: { x: 0, y: 0 },
      radius: TUNING.hazards.drones.radius,
      waypoints: path.map((point) => ({ ...point })),
      wpIndex,
      speed: baseSpeed * (0.9 + rng.float(0, 0.2)) * difficulty,
      scanner:
        kind === 'SCANNER'
          ? {
              range: TUNING.hazards.drones.scanner.range,
              fov: TUNING.hazards.drones.scanner.fovRad,
              alarmPerSec: TUNING.hazards.drones.scanner.alarmPerSec,
            }
          : undefined,
    });
  }
  return drones;
};

const spawnTripZones = (roomId: string, areas: { x: number; y: number; w: number; h: number }[], difficulty: number): TripZone[] =>
  areas.map((rect, index) => ({
    id: `${roomId}-trip-${index}`,
    rect,
    alarmBurst: TUNING.danger.alarm.tripZoneBurst * difficulty,
  }));

const instantiateRoom = (template: RoomTemplate, index: number, rng: RNG, runDifficultyMul: number): GeneratedRoom => {
  const offset = { x: 0, y: index * ROOM_H };
  const roomId = `${template.id}-${index}`;
  const lasers: Laser[] = [];
  const drones: Drone[] = [];
  const loot: Loot[] = [];
  const tripZones: TripZone[] = [];
  const vaultDoors: { rect: { x: number; y: number; w: number; h: number }; keyId: string; opened: boolean; rewardTable?: string }[] = [];
  const roomDifficulty = Math.min(1 + index * 0.05, 1.3);
  const difficulty = roomDifficulty * runDifficultyMul;

  template.spawners.forEach((spawner) => {
    if (spawner.type === 'LOOT_FIELD') {
      loot.push(...spawnLootField(roomId, spawner.area, spawner.table, spawner.countMin, spawner.countMax, rng));
    }

    if (spawner.type === 'LASER_SET') {
      lasers.push(...spawnLaserPattern(roomId, spawner.pattern, spawner.anchors, rng, spawner.difficulty * difficulty));
    }

    if (spawner.type === 'DRONE_SET') {
      drones.push(...spawnDrones(roomId, spawner.path, spawner.kind, spawner.count, rng, spawner.difficulty * difficulty));
    }

    if (spawner.type === 'TRIP_ZONES') {
      tripZones.push(...spawnTripZones(roomId, spawner.areas, spawner.difficulty * difficulty));
    }

    if (spawner.type === 'VAULT_DOOR') {
      vaultDoors.push({ rect: spawner.rect, keyId: spawner.keyId, opened: false, rewardTable: spawner.rewardTable });
    }
  });

  const addOffset = (pos: Vec2): Vec2 => ({ x: pos.x + offset.x, y: pos.y + offset.y });

  return {
    templateId: template.id,
    index,
    offset,
    doors: template.doors.map((door) => ({
      id: `${roomId}-${door.id}`,
      worldAt: addOffset(door.at),
      normal: { ...door.normal },
    })),
    walls: template.walls.map((wall) => ({
      x: wall.x + offset.x,
      y: wall.y + offset.y,
      w: wall.w,
      h: wall.h,
    })),
    spawnPoints: template.spawnPoints.map(addOffset),
    lasers: lasers.map((laser) => ({
      ...laser,
      anchor: addOffset(laser.anchor),
    })),
    drones: drones.map((drone) => ({
      ...drone,
      pos: addOffset(drone.pos),
      waypoints: drone.waypoints.map(addOffset),
    })),
    loot: loot.map((item) => ({
      ...item,
      pos: addOffset(item.pos),
    })),
    tripZones: tripZones.map((zone) => ({
      ...zone,
      rect: { ...zone.rect, x: zone.rect.x + offset.x, y: zone.rect.y + offset.y },
    })),
    vaultDoors: vaultDoors.map((door) => ({
      ...door,
      rect: { ...door.rect, x: door.rect.x + offset.x, y: door.rect.y + offset.y },
    })),
  };
};

const buildSequence = (mode: Mode, rng: RNG) => {
  const sequence = ['SPAWN_SAFE', 'MAIN', 'MAIN', 'CONNECTOR'];
  const includeRisk = mode === 'RISK' || rng.float() < 0.4;
  if (includeRisk) {
    sequence.push('RISK', 'VAULT');
  }
  sequence.push('MAIN', 'EXIT_STRIP');
  return sequence;
};

const injectKeyLoot = (rooms: GeneratedRoom[], rng: RNG) => {
  const vaultRoom = rooms.find((room) => room.vaultDoors.length > 0);
  if (!vaultRoom) {
    return;
  }
  const keyId = vaultRoom.vaultDoors[0].keyId;
  const candidateRooms = rooms.filter((room) => room.templateId !== 'VAULT_ANTICHAMBER');
  const targetRoom = rng.pick(candidateRooms);
  const keyLoot = spawnLootField(`KEY-${targetRoom.templateId}`, { x: 80, y: targetRoom.offset.y + 140, w: 200, h: 260 }, 'KEY_SPAWN', 1, 1, rng)[0];
  keyLoot.keyId = keyId;
  targetRoom.loot.push(keyLoot);
};

export const generateRunLayout = (seed: number, mode: Mode, difficulty: Difficulty): RunLayout => {
  const rng = createRng(seed);
  const sequence = buildSequence(mode, rng);
  const runDifficultyMul = difficulty === 'CHILL' ? 0.85 : 1.0;
  const rooms = sequence.map((tag, index) => instantiateRoom(pickTemplate(tag, rng), index, rng, runDifficultyMul));

  injectKeyLoot(rooms, rng);

  const connections = rooms.slice(1).map((room, index) => ({
    fromDoor: rooms[index].doors.find((door) => door.id.includes('D_S'))?.id ?? '',
    toDoor: room.doors.find((door) => door.id.includes('D_N'))?.id ?? '',
  }));

  return {
    seed,
    mode,
    rooms,
    connections,
  };
};
