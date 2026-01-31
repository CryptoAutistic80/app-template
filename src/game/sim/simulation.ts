// src/game/sim/simulation.ts
// Core game simulation - fixed timestep, player movement, collision handling

import {
  GameState,
  InputState,
  PlayerState,
  Laser,
  Drone,
  Loot,
  GeneratedRoom,
  Vec2,
  EndReason,
  VisualState,
  Particle,
} from "../types";
import { TUNING, getAlarmLevel } from "../tuning";
import {
  vec,
  add,
  sub,
  mul,
  normalize,
  length,
  clampLength,
  dist,
  circleVsRect,
  pushCircleOutOfRect,
  circleVsSegment,
  getLaserEndpoints,
  circleVsCircle,
  angleBetween,
  angleInCone,
  clamp,
} from "./math";

// === Create initial player state ===
export function createPlayer(spawnPos: Vec2, upgrades: Record<string, number>): PlayerState {
  const speedUpgrade = upgrades.SPEED || 0;
  const dashUpgrade = upgrades.DASH || 0;
  const magnetUpgrade = upgrades.MAGNET || 0;
  const shieldUpgrade = upgrades.SHIELD || 0;

  return {
    pos: { ...spawnPos },
    vel: { x: 0, y: 0 },
    radius: TUNING.player.radius,
    dashCharges: TUNING.player.dash.chargesBase,
    dashCooldown: 0,
    shield: shieldUpgrade > 0 && TUNING.player.shield.baseEnabled,
    shieldUsed: false,
    magnetRadius: TUNING.player.magnet.baseRadius + magnetUpgrade * TUNING.upgrades.list.MAGNET.effectPerLevel,
    cursedStacks: 0,
    iFrames: 0,
  };
}

// === Main simulation step ===
export function stepSimulation(
  state: GameState,
  input: InputState,
  dt: number,
  visuals: VisualState,
  upgrades: Record<string, number>
): { state: GameState; visuals: VisualState; endReason: EndReason | null } {
  if (state.gameOver || state.paused) {
    return { state, visuals, endReason: null };
  }

  // Clamp dt to prevent teleporting through hazards
  dt = Math.min(dt, TUNING.run.maxFrameDt);

  // Fixed timestep accumulator
  const fixedDt = TUNING.run.fixedStep;
  let accumulated = dt;
  let endReason: EndReason | null = null;

  while (accumulated >= fixedDt && !endReason) {
    endReason = stepFixed(state, input, fixedDt, visuals, upgrades);
    accumulated -= fixedDt;
  }

  // Update visuals (particles, screen shake, etc.)
  updateVisuals(visuals, dt);

  return { state, visuals, endReason };
}

// === Fixed timestep simulation ===
function stepFixed(
  state: GameState,
  input: InputState,
  dt: number,
  visuals: VisualState,
  upgrades: Record<string, number>
): EndReason | null {
  // === Time ===
  state.timeRemaining -= dt;
  if (state.timeRemaining <= 0) {
    state.timeRemaining = 0;
    state.gameOver = true;
    return "TIME";
  }

  // === Player movement ===
  updatePlayer(state, input, dt, upgrades, visuals);

  // === Hazards ===
  const currentRoom = state.rooms[state.currentRoomIndex];
  if (currentRoom) {
    // Update and check lasers
    const laserHit = updateLasers(state, currentRoom, dt, visuals);
    if (laserHit) return "LASER";

    // Update and check drones
    const droneHit = updateDrones(state, currentRoom, dt, visuals);
    if (droneHit) return "DRONE";

    // Collect loot
    collectLoot(state, currentRoom, dt, visuals);

    // Check trip zones
    checkTripZones(state, currentRoom);
  }

  // === Alarm decay ===
  if (state.alarm > 0) {
    state.alarm = Math.max(0, state.alarm - TUNING.danger.alarm.decayPerSec * dt);
  }

  // === Combo decay ===
  if (state.comboDecayTimer > 0) {
    state.comboDecayTimer -= dt;
  } else if (state.combo > TUNING.scoring.combo.start) {
    state.combo = Math.max(
      TUNING.scoring.combo.start,
      state.combo - TUNING.scoring.combo.decayPerSec * dt
    );
  }

  // === Near-miss cooldown ===
  if (state.nearMissCooldown > 0) {
    state.nearMissCooldown -= dt;
  }

  // === Alarm death check ===
  if (state.alarm >= TUNING.danger.alarm.max) {
    state.gameOver = true;
    return "ALARM";
  }

  return null;
}

// === Player movement with feel-good physics ===
function updatePlayer(
  state: GameState,
  input: InputState,
  dt: number,
  upgrades: Record<string, number>,
  visuals: VisualState
) {
  const player = state.player;
  const speedUpgrade = upgrades.SPEED || 0;
  const dashUpgrade = upgrades.DASH || 0;

  // Calculate max speed with upgrades
  const maxSpeed =
    TUNING.player.maxSpeed *
    (1 + speedUpgrade * TUNING.upgrades.list.SPEED.effectPerLevel) *
    (1 + player.cursedStacks * 0.03); // Cursed stacks make you faster but riskier

  // === Input: move toward touch ===
  if (input.touching) {
    const toTouch = sub(input.touchPos, player.pos);
    const touchDist = length(toTouch);

    if (touchDist > 5) {
      // Dead zone to prevent jitter
      const dir = normalize(toTouch);
      const accel = mul(dir, TUNING.player.accel * dt);
      player.vel = add(player.vel, accel);
    }
  }

  // === Friction (makes movement feel snappy) ===
  const friction = Math.pow(1 - TUNING.player.friction * 0.1, dt * 60);
  player.vel = mul(player.vel, friction);

  // === Clamp to max speed ===
  player.vel = clampLength(player.vel, maxSpeed);

  // === Apply velocity ===
  player.pos = add(player.pos, mul(player.vel, dt));

  // === Dash handling ===
  if (player.dashCooldown > 0) {
    player.dashCooldown -= dt;
  }

  if (input.dashRequested && player.dashCharges > 0 && player.dashCooldown <= 0) {
    // Dash in movement direction (or toward touch if stationary)
    let dashDir = normalize(player.vel);
    if (length(player.vel) < 10 && input.touching) {
      dashDir = normalize(sub(input.touchPos, player.pos));
    }

    if (length(dashDir) > 0.1) {
      player.vel = mul(dashDir, TUNING.player.dash.impulse);
      player.dashCharges--;
      player.dashCooldown =
        TUNING.player.dash.cooldownBase -
        dashUpgrade * TUNING.upgrades.list.DASH.effectPerLevel;
      player.iFrames = TUNING.player.dash.iFrames;

      // Dash particle burst
      spawnParticles(visuals, player.pos, 6, "#22E7FF", 80);
    }
  }

  // Recharge dash (simplified: 1 charge per cooldown period)
  if (player.dashCharges < TUNING.player.dash.chargesBase && player.dashCooldown <= 0) {
    player.dashCooldown =
      TUNING.player.dash.cooldownBase -
      dashUpgrade * TUNING.upgrades.list.DASH.effectPerLevel;
    player.dashCharges++;
  }

  // === i-frames decay ===
  if (player.iFrames > 0) {
    player.iFrames -= dt;
  }

  // === Wall collision (push out of walls) ===
  const currentRoom = state.rooms[state.currentRoomIndex];
  if (currentRoom) {
    for (const wall of currentRoom.walls) {
      // Offset wall to world coords
      const worldWall = {
        x: wall.x + currentRoom.offset.x,
        y: wall.y + currentRoom.offset.y,
        w: wall.w,
        h: wall.h,
      };

      const pushed = pushCircleOutOfRect(player.pos, player.radius, worldWall);
      if (pushed) {
        player.pos = pushed;
        // Kill velocity into wall
        const dx = pushed.x - player.pos.x;
        const dy = pushed.y - player.pos.y;
        if (Math.abs(dx) > 0.01) player.vel.x = 0;
        if (Math.abs(dy) > 0.01) player.vel.y = 0;
      }
    }

    // Keep player in room bounds
    const roomLeft = currentRoom.offset.x + TUNING.world.wallThickness;
    const roomRight = currentRoom.offset.x + TUNING.world.roomW - TUNING.world.wallThickness;
    const roomTop = currentRoom.offset.y + TUNING.world.wallThickness;
    const roomBottom = currentRoom.offset.y + TUNING.world.roomH - TUNING.world.wallThickness;

    player.pos.x = clamp(player.pos.x, roomLeft + player.radius, roomRight - player.radius);
    player.pos.y = clamp(player.pos.y, roomTop + player.radius, roomBottom - player.radius);
  }
}

// === Laser update and collision ===
function updateLasers(
  state: GameState,
  room: GeneratedRoom,
  dt: number,
  visuals: VisualState
): boolean {
  const player = state.player;
  const alarmLevel = getAlarmLevel(state.alarm);

  for (const laser of room.lasers) {
    // Update laser based on type
    switch (laser.kind) {
      case "ROTATOR":
        laser.angle += laser.angVel * alarmLevel.laserSpeedMul * dt;
        break;

      case "SWEEPER":
        if (laser.sweepBase !== undefined && laser.sweepSpan !== undefined) {
          laser.angle += laser.angVel * (laser.sweepDir || 1) * alarmLevel.laserSpeedMul * dt;
          // Reverse at sweep limits
          const relAngle = laser.angle - laser.sweepBase;
          if (Math.abs(relAngle) > laser.sweepSpan / 2) {
            laser.sweepDir = (laser.sweepDir || 1) * -1 as 1 | -1;
          }
        }
        break;

      case "BLINK_GATE":
        if (laser.blink) {
          laser.blinkTimer = (laser.blinkTimer || 0) + dt;
          const cycleTime = laser.blinkTimer % laser.blink.period;
          laser.isOn = cycleTime < laser.blink.onFor;
          laser.lethal = laser.isOn;
        }
        break;
    }

    // Skip collision if laser is off or player has i-frames
    if (!laser.lethal || player.iFrames > 0) continue;

    // Get laser segment in world coords
    const worldAnchor = add(laser.anchor, room.offset);
    const { a, b } = getLaserEndpoints(worldAnchor, laser.angle, laser.length);

    // Check collision
    const collision = circleVsSegment(player.pos, player.radius, a, b, laser.thickness);

    if (collision.hit) {
      // Check for shield
      if (player.shield && !player.shieldUsed) {
        player.shieldUsed = true;
        player.iFrames = TUNING.player.shield.postHitInvuln;
        state.screenShake = TUNING.juice.screenShakeIntensity;
        spawnParticles(visuals, player.pos, 16, "#22E7FF", 120);
        continue;
      }

      // Death!
      state.gameOver = true;
      spawnParticles(visuals, player.pos, TUNING.juice.particleCount.death, "#FF3B30", 200);
      return true;
    }

    // Near-miss detection (the dopamine hit!)
    if (
      !collision.hit &&
      collision.dist < TUNING.danger.nearMiss.window &&
      state.nearMissCooldown <= 0
    ) {
      // Near miss!
      state.score += TUNING.danger.nearMiss.scoreTick;
      state.stats.nearMissCount++;
      state.nearMissCooldown = TUNING.danger.nearMiss.cooldown;
      visuals.nearMissFlash = TUNING.juice.nearMissFlashDuration;

      // Particles at near-miss point
      spawnParticles(visuals, collision.closest, TUNING.juice.particleCount.nearMiss, "#A7FF3A", 60);
    }
  }

  return false;
}

// === Drone update and collision ===
function updateDrones(
  state: GameState,
  room: GeneratedRoom,
  dt: number,
  visuals: VisualState
): boolean {
  const player = state.player;
  const alarmLevel = getAlarmLevel(state.alarm);

  for (const drone of room.drones) {
    // Move along waypoints
    if (drone.waypoints.length > 0) {
      const target = add(drone.waypoints[drone.wpIndex], room.offset);
      const toTarget = sub(target, drone.pos);
      const distToTarget = length(toTarget);

      if (distToTarget < 5) {
        // Reached waypoint, move to next
        drone.wpIndex = (drone.wpIndex + 1) % drone.waypoints.length;
      } else {
        const dir = normalize(toTarget);
        const speed = drone.speed * alarmLevel.droneSpeedMul;
        drone.vel = mul(dir, speed);
        drone.pos = add(drone.pos, mul(drone.vel, dt));

        // Update scanner facing direction
        if (drone.scanner) {
          drone.scanner.angle = angleBetween(vec(0, 0), dir);
        }
      }
    }

    // Scanner cone alarm buildup
    if (drone.scanner && drone.kind === "SCANNER") {
      const toPlayer = sub(player.pos, drone.pos);
      const distToPlayer = length(toPlayer);

      if (distToPlayer < drone.scanner.range) {
        const angleToPlayer = angleBetween(vec(0, 0), toPlayer);
        if (angleInCone(angleToPlayer, drone.scanner.angle, drone.scanner.fov / 2)) {
          // Player in scanner cone!
          state.alarm += drone.scanner.alarmPerSec * dt;
        }
      }
    }

    // Skip collision if player has i-frames
    if (player.iFrames > 0) continue;

    // Direct collision with drone
    if (circleVsCircle(player.pos, player.radius, drone.pos, drone.radius)) {
      // Check for shield
      if (player.shield && !player.shieldUsed) {
        player.shieldUsed = true;
        player.iFrames = TUNING.player.shield.postHitInvuln;
        state.screenShake = TUNING.juice.screenShakeIntensity;
        spawnParticles(visuals, player.pos, 16, "#FF2DDA", 120);
        continue;
      }

      state.gameOver = true;
      spawnParticles(visuals, player.pos, TUNING.juice.particleCount.death, "#FF3B30", 200);
      return true;
    }
  }

  return false;
}

// === Loot collection ===
function collectLoot(
  state: GameState,
  room: GeneratedRoom,
  dt: number,
  visuals: VisualState
) {
  const player = state.player;
  const alarmLevel = getAlarmLevel(state.alarm);

  for (const loot of room.loot) {
    if (loot.collected) continue;

    // TTL countdown
    loot.ttl -= dt;
    if (loot.ttl <= 0) {
      loot.collected = true;
      continue;
    }

    const worldPos = add(loot.pos, room.offset);
    const toLoot = sub(worldPos, player.pos);
    const distToLoot = length(toLoot);

    // Magnet pull
    if (distToLoot < player.magnetRadius && distToLoot > player.radius) {
      const pullDir = normalize(mul(toLoot, -1));
      const pullAmount = TUNING.player.magnet.pullStrength * dt;
      loot.pos = sub(loot.pos, mul(pullDir, Math.min(pullAmount, distToLoot - player.radius)));
    }

    // Collection
    if (distToLoot < player.radius + 8) {
      loot.collected = true;
      state.stats.lootCollected++;

      // Apply value with alarm multiplier
      const value = Math.floor(loot.value * alarmLevel.lootValueMul);

      // Score with combo
      state.score += Math.floor(value * state.combo * TUNING.scoring.baseLootScore);

      // Reset combo decay timer
      state.comboDecayTimer = TUNING.scoring.combo.decayDelay;

      // Increase combo
      state.combo = Math.min(
        TUNING.scoring.combo.max,
        state.combo + TUNING.scoring.combo.addPerPickup
      );

      // Credits
      state.stats.creditsEarned += Math.floor(value * TUNING.economy.credits.perLootValue);

      // Cursed loot effects
      if (loot.cursed) {
        player.cursedStacks += loot.cursed.stacks;
        state.alarm += loot.cursed.alarmBoost;
      }

      // Particles
      const color = loot.kind === "CURSED" ? "#FF2DDA" : "#A7FF3A";
      spawnParticles(visuals, worldPos, TUNING.juice.particleCount.lootCollect, color, 50);

      // Combo popup
      if (state.combo > 1.5) {
        visuals.comboPopup = { value: state.combo, timer: 0.8 };
      }
    }
  }
}

// === Trip zone check ===
function checkTripZones(state: GameState, room: GeneratedRoom) {
  const player = state.player;

  for (const zone of room.tripZones) {
    if (zone.triggered) continue;

    const worldRect = {
      x: zone.rect.x + room.offset.x,
      y: zone.rect.y + room.offset.y,
      w: zone.rect.w,
      h: zone.rect.h,
    };

    if (circleVsRect(player.pos, player.radius, worldRect)) {
      zone.triggered = true;
      state.alarm += zone.alarmBurst;
    }
  }
}

// === Visual effects ===
let visuals: VisualState;

function spawnParticles(
  v: VisualState,
  pos: Vec2,
  count: number,
  color: string,
  speed: number
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const vel = {
      x: Math.cos(angle) * speed * (0.5 + Math.random() * 0.5),
      y: Math.sin(angle) * speed * (0.5 + Math.random() * 0.5),
    };
    v.particles.push({
      pos: { ...pos },
      vel,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.4 + Math.random() * 0.3,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

function updateVisuals(v: VisualState, dt: number) {
  // Update particles
  for (let i = v.particles.length - 1; i >= 0; i--) {
    const p = v.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      v.particles.splice(i, 1);
      continue;
    }
    p.pos = add(p.pos, mul(p.vel, dt));
    p.vel = mul(p.vel, 0.95); // Drag
  }

  // Screen shake decay
  if (v.screenShake.x !== 0 || v.screenShake.y !== 0) {
    v.screenShake = mul(v.screenShake, 0.85);
    if (length(v.screenShake) < 0.5) {
      v.screenShake = { x: 0, y: 0 };
    }
  }

  // Near-miss flash decay
  if (v.nearMissFlash > 0) {
    v.nearMissFlash -= dt;
  }

  // Combo popup decay
  if (v.comboPopup) {
    v.comboPopup.timer -= dt;
    if (v.comboPopup.timer <= 0) {
      v.comboPopup = null;
    }
  }
}

// === Create initial visual state ===
export function createVisualState(): VisualState {
  return {
    particles: [],
    screenShake: { x: 0, y: 0 },
    nearMissFlash: 0,
    comboPopup: null,
  };
}

// === Trigger screen shake ===
export function triggerScreenShake(v: VisualState, intensity: number) {
  const angle = Math.random() * Math.PI * 2;
  v.screenShake = {
    x: Math.cos(angle) * intensity,
    y: Math.sin(angle) * intensity,
  };
}
