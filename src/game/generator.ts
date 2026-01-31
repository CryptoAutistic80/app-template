// src/game/generator.ts
// Procedural run generation - assembles rooms into playable layouts

import {
  Seed,
  Mode,
  RunLayout,
  GeneratedRoom,
  RoomTemplate,
  Laser,
  Drone,
  Loot,
  TripZone,
  VaultDoor,
  Vec2,
  SpawnerSpec,
  LootKind,
} from "./types";
import { SeededRNG, generateSeed, getDailySeed } from "./rng";
import { templates, getTemplatesByTag, ROOM_W, ROOM_H } from "./templates";
import { TUNING, LootTablePick } from "./tuning";

// === Generate a complete run layout ===
export function generateRun(mode: Mode, existingSeed?: Seed): RunLayout {
  // Determine seed
  let seed: Seed;
  if (existingSeed !== undefined) {
    seed = existingSeed;
  } else if (mode === "DAILY") {
    seed = getDailySeed();
  } else {
    seed = generateSeed();
  }

  const rng = new SeededRNG(seed);

  // Build room graph based on mode
  const roomGraph = buildRoomGraph(mode, rng);

  // Generate each room
  const rooms: GeneratedRoom[] = [];
  let yOffset = 0;

  for (let i = 0; i < roomGraph.length; i++) {
    const template = roomGraph[i];
    const room = generateRoom(template, i, { x: 0, y: yOffset }, rng);
    rooms.push(room);
    yOffset += template.size.h;
  }

  // Connect rooms via doors
  const connections: { fromDoor: string; toDoor: string }[] = [];
  for (let i = 0; i < rooms.length - 1; i++) {
    const fromRoom = rooms[i];
    const toRoom = rooms[i + 1];
    // Connect north door of current to south door of next (or vice versa)
    const fromDoor = fromRoom.doors.find((d) => d.normal.y < 0);
    const toDoor = toRoom.doors.find((d) => d.normal.y > 0);
    if (fromDoor && toDoor) {
      connections.push({
        fromDoor: `${fromRoom.index}_${fromDoor.id}`,
        toDoor: `${toRoom.index}_${toDoor.id}`,
      });
    }
  }

  return { seed, mode, rooms, connections };
}

// === Build the room graph (which templates to use) ===
function buildRoomGraph(mode: Mode, rng: SeededRNG): RoomTemplate[] {
  const graph: RoomTemplate[] = [];

  // Always start with spawn safe
  const spawnTemplates = getTemplatesByTag("SPAWN_SAFE");
  graph.push(rng.pick(spawnTemplates));

  // Main rooms - more for RISK mode
  const mainTemplates = getTemplatesByTag("MAIN");
  const mainCount = mode === "RISK" ? 4 : 3;

  for (let i = 0; i < mainCount; i++) {
    graph.push(rng.pickWeighted(mainTemplates));

    // Occasionally add connector between main rooms
    if (i < mainCount - 1 && rng.chance(0.3)) {
      const connectorTemplates = getTemplatesByTag("CONNECTOR");
      if (connectorTemplates.length > 0) {
        graph.push(rng.pickWeighted(connectorTemplates));
      }
    }
  }

  // RISK mode: add risk wing and vault
  if (mode === "RISK") {
    const riskTemplates = getTemplatesByTag("RISK");
    if (riskTemplates.length > 0) {
      graph.push(rng.pickWeighted(riskTemplates));
    }

    const vaultTemplates = getTemplatesByTag("VAULT");
    if (vaultTemplates.length > 0) {
      graph.push(rng.pickWeighted(vaultTemplates));
    }
  }

  // End with exit strip
  const exitTemplates = getTemplatesByTag("EXIT_STRIP");
  if (exitTemplates.length > 0) {
    graph.push(rng.pick(exitTemplates));
  }

  return graph;
}

// === Generate a single room from template ===
function generateRoom(
  template: RoomTemplate,
  index: number,
  offset: Vec2,
  rng: SeededRNG
): GeneratedRoom {
  const room: GeneratedRoom = {
    templateId: template.id,
    index,
    offset,
    doors: template.doors.map((d) => ({
      id: d.id,
      worldAt: { x: d.at.x + offset.x, y: d.at.y + offset.y },
      normal: d.normal,
    })),
    walls: template.walls.map((w) => ({ ...w })),
    lasers: [],
    drones: [],
    loot: [],
    tripZones: [],
    vaultDoors: [],
  };

  // Process spawners
  for (const spawner of template.spawners) {
    processSpawner(room, spawner, rng);
  }

  // Validate and fix if needed
  validateRoom(room, template, rng);

  return room;
}

// === Process a spawner specification ===
function processSpawner(room: GeneratedRoom, spawner: SpawnerSpec, rng: SeededRNG) {
  switch (spawner.type) {
    case "LOOT_FIELD":
      spawnLootField(room, spawner, rng);
      break;
    case "LASER_SET":
      spawnLaserSet(room, spawner, rng);
      break;
    case "DRONE_SET":
      spawnDroneSet(room, spawner, rng);
      break;
    case "TRIP_ZONES":
      spawnTripZones(room, spawner, rng);
      break;
    case "VAULT_DOOR":
      spawnVaultDoor(room, spawner, rng);
      break;
  }
}

// === Spawn loot from table ===
function spawnLootField(
  room: GeneratedRoom,
  spawner: Extract<SpawnerSpec, { type: "LOOT_FIELD" }>,
  rng: SeededRNG
) {
  const table = TUNING.loot.tables[spawner.table as keyof typeof TUNING.loot.tables];
  if (!table) return;

  const count = rng.int(spawner.countMin, spawner.countMax);

  for (let i = 0; i < count; i++) {
    const pick = rng.pickWeighted([...table.picks] as LootTablePick[]);
    const pos = rng.pointInRect(
      spawner.area.x,
      spawner.area.y,
      spawner.area.w,
      spawner.area.h
    );

    const loot: Loot = {
      id: `loot_${room.index}_${room.loot.length}_${i}`,
      kind: pick.kind as LootKind,
      pos,
      value: pick.value,
      ttl: TUNING.loot.ttl[pick.kind as keyof typeof TUNING.loot.ttl] || 8,
      collected: false,
    };

    if (pick.cursed) {
      loot.cursed = { ...pick.cursed };
    }

    room.loot.push(loot);
  }
}

// === Spawn laser patterns ===
function spawnLaserSet(
  room: GeneratedRoom,
  spawner: Extract<SpawnerSpec, { type: "LASER_SET" }>,
  rng: SeededRNG
) {
  const { anchors, pattern, difficulty } = spawner;

  switch (pattern) {
    case "SINGLE_ROTATOR":
      if (anchors.length > 0) {
        room.lasers.push(createRotatorLaser(anchors[0], room.index, 0, rng, difficulty));
      }
      break;

    case "TWO_SWEEPERS_OPPOSED":
      for (let i = 0; i < Math.min(2, anchors.length); i++) {
        room.lasers.push(createSweeperLaser(anchors[i], room.index, i, rng, difficulty, i === 0 ? 1 : -1));
      }
      break;

    case "TRI_ROTATORS":
      for (let i = 0; i < Math.min(3, anchors.length); i++) {
        room.lasers.push(createRotatorLaser(anchors[i], room.index, i, rng, difficulty));
      }
      break;

    case "BLINK_GATE_CENTER":
      if (anchors.length > 0) {
        room.lasers.push(createBlinkGateLaser(anchors[0], room.index, 0, rng));
      }
      break;
  }
}

// === Create rotator laser ===
function createRotatorLaser(
  anchor: Vec2,
  roomIndex: number,
  laserIndex: number,
  rng: SeededRNG,
  difficulty: number
): Laser {
  const cfg = TUNING.hazards.lasers.rotator;
  const diffMul = 1 + difficulty * 0.15;

  return {
    id: `laser_${roomIndex}_${laserIndex}`,
    kind: "ROTATOR",
    anchor: { ...anchor },
    length: rng.range(cfg.lengthMin, cfg.lengthMax),
    angle: rng.angle(),
    angVel: rng.range(cfg.angVelMin, cfg.angVelMax) * diffMul * (rng.chance(0.5) ? 1 : -1),
    thickness: TUNING.hazards.lasers.thickness,
    lethal: true,
  };
}

// === Create sweeper laser ===
function createSweeperLaser(
  anchor: Vec2,
  roomIndex: number,
  laserIndex: number,
  rng: SeededRNG,
  difficulty: number,
  initialDir: 1 | -1
): Laser {
  const cfg = TUNING.hazards.lasers.sweeper;
  const diffMul = 1 + difficulty * 0.12;
  const baseAngle = anchor.x < ROOM_W / 2 ? 0 : Math.PI; // Point inward

  return {
    id: `laser_${roomIndex}_${laserIndex}`,
    kind: "SWEEPER",
    anchor: { ...anchor },
    length: ROOM_W * 0.8,
    angle: baseAngle,
    angVel: rng.range(cfg.speedMin, cfg.speedMax) * 0.005 * diffMul,
    sweepDir: initialDir,
    sweepSpan: (cfg.sweepSpan * Math.PI) / 180,
    sweepBase: baseAngle,
    thickness: TUNING.hazards.lasers.thickness,
    lethal: true,
  };
}

// === Create blink gate laser ===
function createBlinkGateLaser(
  anchor: Vec2,
  roomIndex: number,
  laserIndex: number,
  rng: SeededRNG
): Laser {
  const cfg = TUNING.hazards.lasers.blinkGate;

  return {
    id: `laser_${roomIndex}_${laserIndex}`,
    kind: "BLINK_GATE",
    anchor: { ...anchor },
    length: ROOM_W - 40, // Span most of room width
    angle: Math.PI / 2, // Horizontal
    angVel: 0,
    blink: {
      period: cfg.period,
      onFor: cfg.onFor,
      telegraph: cfg.telegraph,
      phase: rng.next() * cfg.period,
    },
    blinkTimer: rng.next() * cfg.period,
    isOn: false,
    thickness: TUNING.hazards.lasers.thickness,
    lethal: false, // Starts off
  };
}

// === Spawn drones ===
function spawnDroneSet(
  room: GeneratedRoom,
  spawner: Extract<SpawnerSpec, { type: "DRONE_SET" }>,
  rng: SeededRNG
) {
  const { path, kind, count, difficulty } = spawner;
  if (path.length === 0) return;

  const cfg = kind === "SCANNER" ? TUNING.hazards.drones.scanner : TUNING.hazards.drones.patrol;
  const diffMul = 1 + difficulty * 0.1;

  for (let i = 0; i < count; i++) {
    // Distribute drones along the path
    const startWp = Math.floor((i / count) * path.length);
    const startPos = path[startWp];

    const drone: Drone = {
      id: `drone_${room.index}_${i}`,
      kind,
      pos: { ...startPos },
      vel: { x: 0, y: 0 },
      radius: TUNING.hazards.drones.radius,
      waypoints: path.map((p) => ({ ...p })),
      wpIndex: startWp,
      speed: rng.range(cfg.speedMin, cfg.speedMax) * diffMul,
    };

    if (kind === "SCANNER") {
      const scanCfg = TUNING.hazards.drones.scanner;
      drone.scanner = {
        range: scanCfg.range,
        fov: scanCfg.fovRad,
        alarmPerSec: scanCfg.alarmPerSec,
        angle: 0,
      };
    }

    room.drones.push(drone);
  }
}

// === Spawn trip zones ===
function spawnTripZones(
  room: GeneratedRoom,
  spawner: Extract<SpawnerSpec, { type: "TRIP_ZONES" }>,
  rng: SeededRNG
) {
  for (let i = 0; i < spawner.areas.length; i++) {
    room.tripZones.push({
      id: `trip_${room.index}_${i}`,
      rect: { ...spawner.areas[i] },
      alarmBurst: TUNING.danger.alarm.tripZoneBurst * (1 + spawner.difficulty * 0.2),
      triggered: false,
    });
  }
}

// === Spawn vault door ===
function spawnVaultDoor(
  room: GeneratedRoom,
  spawner: Extract<SpawnerSpec, { type: "VAULT_DOOR" }>,
  rng: SeededRNG
) {
  room.vaultDoors.push({
    id: `vault_${room.index}`,
    rect: { ...spawner.rect },
    keyId: spawner.keyId,
    opened: false,
  });

  // Spawn key somewhere in the room
  const keyPos = rng.pointInRect(50, 200, ROOM_W - 100, 300);
  room.loot.push({
    id: `key_${room.index}`,
    kind: "KEY",
    pos: keyPos,
    value: 0,
    ttl: TUNING.loot.ttl.KEY,
    collected: false,
    keyId: spawner.keyId,
  });
}

// === Validate room (ensure fair deaths are possible) ===
function validateRoom(room: GeneratedRoom, template: RoomTemplate, rng: SeededRNG) {
  // Check for overlapping blink gates if disallowed
  if (template.constraints.disallowBlinkOverlap) {
    const blinkLasers = room.lasers.filter((l) => l.kind === "BLINK_GATE");
    // For now, just ensure they have offset phases
    for (let i = 1; i < blinkLasers.length; i++) {
      if (blinkLasers[i].blink) {
        blinkLasers[i].blink!.phase = (i / blinkLasers.length) * blinkLasers[i].blink!.period;
      }
    }
  }

  // Ensure minimum clearance for player movement
  // (In a full implementation, we'd check laser sweep patterns against corridors)

  // Ensure loot doesn't spawn inside walls
  for (const loot of room.loot) {
    for (const wall of room.walls) {
      if (
        loot.pos.x > wall.x &&
        loot.pos.x < wall.x + wall.w &&
        loot.pos.y > wall.y &&
        loot.pos.y < wall.y + wall.h
      ) {
        // Move loot outside wall
        loot.pos.x = wall.x + wall.w + 20;
      }
    }
  }
}

// === Create initial game state from layout ===
export function createGameState(
  layout: RunLayout,
  upgrades: Record<string, number>
): import("./types").GameState {
  const spawnRoom = layout.rooms[0];
  const spawnPos = spawnRoom.offset;
  const template = templates.find((t) => t.id === spawnRoom.templateId);
  const playerSpawn = template?.spawnPoints[0] || { x: ROOM_W / 2, y: ROOM_H * 0.75 };

  // Import here to avoid circular dependency
  const { createPlayer } = require("./sim/simulation");

  return {
    mode: layout.mode,
    seed: layout.seed,
    timeRemaining: TUNING.run.durationSec,
    player: createPlayer(
      { x: playerSpawn.x + spawnRoom.offset.x, y: playerSpawn.y + spawnRoom.offset.y },
      upgrades
    ),
    rooms: layout.rooms,
    currentRoomIndex: 0,
    score: 0,
    combo: TUNING.scoring.combo.start,
    comboDecayTimer: 0,
    alarm: 0,
    nearMissCooldown: 0,
    stats: {
      score: 0,
      creditsEarned: 0,
      shardsEarned: 0,
      nearMissCount: 0,
      vaultsOpened: 0,
      maxAlarm: 0,
      streakMax: 0,
      lootCollected: 0,
      endReason: "TIME",
      timeSurvived: 0,
    },
    paused: false,
    gameOver: false,
    screenShake: 0,
  };
}
