// src/game/render/GameRenderer.tsx
// Game renderer using React Native views (Expo Go compatible)

import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { GameState, VisualState, Laser, Drone, Loot, GeneratedRoom } from "../types";
import { TUNING, getPalette } from "../tuning";
import { getLaserEndpoints } from "../sim/math";

interface GameRendererProps {
  width: number;
  height: number;
  gameState: GameState;
  visuals: VisualState;
  paletteId?: string;
}

export const GameRenderer: React.FC<GameRendererProps> = ({
  width,
  height,
  gameState,
  visuals,
  paletteId = "PAL_CYAN_MAGENTA",
}) => {
  const palette = getPalette(paletteId);

  // Calculate camera offset to follow player
  const cameraOffset = useMemo(() => {
    const targetY = gameState.player.pos.y - height / 2;
    return {
      x: visuals.screenShake.x,
      y: -targetY + visuals.screenShake.y,
    };
  }, [gameState.player.pos.y, height, visuals.screenShake]);

  // Scale to fit room width
  const scale = width / TUNING.world.roomW;

  return (
    <View style={[styles.container, { width, height, backgroundColor: palette.bg[0] }]}>
      {/* Near-miss flash overlay */}
      {visuals.nearMissFlash > 0 && (
        <View
          style={[
            styles.flashOverlay,
            { backgroundColor: palette.neonC, opacity: visuals.nearMissFlash * 0.4 },
          ]}
        />
      )}

      {/* Game world */}
      <View
        style={[
          styles.gameWorld,
          {
            transform: [
              { translateX: cameraOffset.x * scale },
              { translateY: cameraOffset.y * scale },
              { scale },
            ],
          },
        ]}
      >
        {/* Render rooms */}
        {gameState.rooms.map((room) => (
          <RoomRenderer key={room.index} room={room} palette={palette} />
        ))}

        {/* Player */}
        <PlayerRenderer
          pos={gameState.player.pos}
          radius={gameState.player.radius}
          palette={palette}
          iFrames={gameState.player.iFrames}
          shield={gameState.player.shield && !gameState.player.shieldUsed}
        />

        {/* Particles */}
        {visuals.particles.map((p, i) => (
          <View
            key={i}
            style={[
              styles.particle,
              {
                left: p.pos.x - p.size / 2,
                top: p.pos.y - p.size / 2,
                width: p.size * (p.life / p.maxLife),
                height: p.size * (p.life / p.maxLife),
                backgroundColor: p.color,
                opacity: p.life / p.maxLife,
                borderRadius: p.size,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

// === Room Renderer ===
interface RoomRendererProps {
  room: GeneratedRoom;
  palette: ReturnType<typeof getPalette>;
}

const RoomRenderer: React.FC<RoomRendererProps> = ({ room, palette }) => {
  return (
    <View style={[styles.room, { left: room.offset.x, top: room.offset.y }]}>
      {/* Walls */}
      {room.walls.map((wall, i) => (
        <View
          key={`wall_${i}`}
          style={[
            styles.wall,
            {
              left: wall.x,
              top: wall.y,
              width: wall.w,
              height: wall.h,
              backgroundColor: palette.neonB,
            },
          ]}
        />
      ))}

      {/* Loot */}
      {room.loot
        .filter((l) => !l.collected)
        .map((loot) => (
          <LootRenderer key={loot.id} loot={loot} palette={palette} />
        ))}

      {/* Lasers */}
      {room.lasers.map((laser) => (
        <LaserRenderer key={laser.id} laser={laser} palette={palette} />
      ))}

      {/* Drones */}
      {room.drones.map((drone) => (
        <DroneRenderer key={drone.id} drone={drone} palette={palette} />
      ))}
    </View>
  );
};

// === Player Renderer ===
interface PlayerRendererProps {
  pos: { x: number; y: number };
  radius: number;
  palette: ReturnType<typeof getPalette>;
  iFrames: number;
  shield: boolean;
}

const PlayerRenderer: React.FC<PlayerRendererProps> = ({
  pos,
  radius,
  palette,
  iFrames,
  shield,
}) => {
  const isFlashing = iFrames > 0 && Math.floor(iFrames * 20) % 2 === 0;
  const size = radius * 2;

  return (
    <View style={[styles.absolute, { left: pos.x - radius, top: pos.y - radius }]}>
      {/* Outer glow */}
      <View
        style={[
          styles.glow,
          {
            width: size * 2.5,
            height: size * 2.5,
            borderRadius: size * 1.25,
            backgroundColor: palette.neonA,
            left: -size * 0.75,
            top: -size * 0.75,
          },
        ]}
      />

      {/* Shield ring */}
      {shield && (
        <View
          style={[
            styles.shieldRing,
            {
              width: size * 1.8,
              height: size * 1.8,
              borderRadius: size * 0.9,
              borderColor: palette.neonC,
              left: -size * 0.4,
              top: -size * 0.4,
            },
          ]}
        />
      )}

      {/* Main body */}
      <View
        style={[
          styles.playerBody,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: isFlashing ? "#FFFFFF" : palette.neonA,
          },
        ]}
      />
    </View>
  );
};

// === Laser Renderer ===
interface LaserRendererProps {
  laser: Laser;
  palette: ReturnType<typeof getPalette>;
}

const LaserRenderer: React.FC<LaserRendererProps> = ({ laser, palette }) => {
  const { a, b } = getLaserEndpoints(laser.anchor, laser.angle, laser.length);

  // Blink gate telegraph
  if (laser.kind === "BLINK_GATE" && !laser.isOn && laser.blink) {
    const cycleTime = (laser.blinkTimer || 0) % laser.blink.period;
    const timeUntilOn = laser.blink.period - laser.blink.onFor - cycleTime;
    const isTelegraphing = timeUntilOn > 0 && timeUntilOn < laser.blink.telegraph;

    if (!isTelegraphing && !laser.isOn) return null;
  }

  if (!laser.lethal && laser.kind === "BLINK_GATE") return null;

  // Calculate line dimensions
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <View
      style={[
        styles.laser,
        {
          left: a.x,
          top: a.y - laser.thickness / 2,
          width: length,
          height: laser.thickness,
          backgroundColor: palette.warning,
          transform: [{ rotate: `${angle}deg` }],
          transformOrigin: "left center",
          shadowColor: palette.warning,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 10,
        },
      ]}
    />
  );
};

// === Loot Renderer ===
interface LootRendererProps {
  loot: Loot;
  palette: ReturnType<typeof getPalette>;
}

const LootRenderer: React.FC<LootRendererProps> = ({ loot, palette }) => {
  const colors: Record<string, string> = {
    COIN: palette.neonC,
    GEM: palette.neonB,
    CROWN: "#FFD700",
    KEY: palette.neonA,
    CURSED: palette.neonB,
  };

  const color = colors[loot.kind] || palette.neonC;
  const size = loot.kind === "CROWN" ? 20 : loot.kind === "KEY" ? 16 : 12;

  const fadeThreshold = 2;
  const opacity = loot.ttl < fadeThreshold ? loot.ttl / fadeThreshold : 1;

  return (
    <View
      style={[
        styles.loot,
        {
          left: loot.pos.x - size / 2,
          top: loot.pos.y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 8,
        },
      ]}
    />
  );
};

// === Drone Renderer ===
interface DroneRendererProps {
  drone: Drone;
  palette: ReturnType<typeof getPalette>;
}

const DroneRenderer: React.FC<DroneRendererProps> = ({ drone, palette }) => {
  const size = drone.radius * 2;

  return (
    <View
      style={[
        styles.drone,
        {
          left: drone.pos.x - drone.radius,
          top: drone.pos.y - drone.radius,
          width: size,
          height: size,
          borderRadius: drone.radius,
          backgroundColor: palette.neonB,
          shadowColor: palette.neonB,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
        },
      ]}
    >
      {/* Eye */}
      <View
        style={[
          styles.droneEye,
          {
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: size * 0.2,
            backgroundColor: palette.warning,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  gameWorld: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  room: {
    position: "absolute",
  },
  wall: {
    position: "absolute",
    opacity: 0.4,
  },
  absolute: {
    position: "absolute",
  },
  glow: {
    position: "absolute",
    opacity: 0.25,
  },
  shieldRing: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "transparent",
    opacity: 0.7,
  },
  playerBody: {
    shadowColor: "#22E7FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
  laser: {
    position: "absolute",
    elevation: 5,
  },
  loot: {
    position: "absolute",
    elevation: 3,
  },
  drone: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  droneEye: {
    elevation: 2,
  },
  particle: {
    position: "absolute",
  },
});

export default GameRenderer;
