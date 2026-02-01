import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { createRun, InputState, stepGame } from '../engine';
import { TUNING } from '../tuning';
import { Laser, Loot, Mode, Vec2 } from '../types';
import { clamp } from '../math';
import { useMeta } from '../meta/meta';

const getPalette = (paletteId: string) =>
  TUNING.cosmetics.palettes.find((palette) => palette.id === paletteId) ?? TUNING.cosmetics.palettes[0];

const getTrail = (trailId: string) =>
  TUNING.cosmetics.trails.find((trail) => trail.id === trailId) ?? TUNING.cosmetics.trails[0];

const screenToWorld = (screen: Vec2, camera: Vec2, scale: number, offset: Vec2) => ({
  x: (screen.x - offset.x) / scale + camera.x,
  y: (screen.y - offset.y) / scale + camera.y,
});

const now = () => (globalThis.performance?.now?.() ?? Date.now());

const endReasonLabel = (reason: string) => {
  switch (reason) {
    case 'TIME':
      return 'Time up';
    case 'LASER':
      return 'Laser';
    case 'DRONE':
      return 'Drone';
    case 'ALARM':
      return 'Alarm';
    default:
      return 'Quit';
  }
};

const MODE_HINTS: Record<Mode, string> = {
  NORMAL: 'Standard run. Best for learning routes and timing.',
  DAILY: 'Daily seed. Same layout for everyone today.',
  RISK: 'Harder rooms, bigger rewards. Costs 2 tickets.',
};

const SFX = {
  pickup: require('../../../assets/audio/pickup.wav'),
  dash: require('../../../assets/audio/dash.wav'),
  nearMiss: require('../../../assets/audio/near_miss.wav'),
  alarm: require('../../../assets/audio/alarm.wav'),
  vault: require('../../../assets/audio/vault.wav'),
};

const laserVisual = (laser: Laser) => {
  if (laser.kind !== 'BLINK_GATE' || !laser.blink) {
    return { active: true, opacity: 1 };
  }
  const active = laser.blink.phase < laser.blink.onFor;
  const telegraph = laser.blink.phase >= laser.blink.onFor - laser.blink.telegraph;
  return {
    active,
    opacity: active ? 1 : telegraph ? 0.35 : 0.15,
  };
};

const lootBaseColor = (item: Loot, palette: ReturnType<typeof getPalette>) => {
  switch (item.kind) {
    case 'COIN':
      return palette.neonA;
    case 'GEM':
      return palette.neonC;
    case 'CROWN':
      return palette.neonB;
    case 'KEY':
      return '#FFD166';
    case 'CURSED':
      return palette.warning;
    default:
      return palette.neonA;
  }
};

const renderLootSprite = (item: Loot, palette: ReturnType<typeof getPalette>) => {
  const baseColor = lootBaseColor(item, palette);
  const size = item.kind === 'CROWN' ? 12 : 10;
  const baseStyle = {
    position: 'absolute' as const,
    left: item.pos.x - size / 2,
    top: item.pos.y - size / 2,
    width: size,
    height: size,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const glowStyle = {
    position: 'absolute' as const,
    width: size + 8,
    height: size + 8,
    borderRadius: (size + 8) / 2,
    backgroundColor: baseColor,
    opacity: 0.2,
  };

  if (item.kind === 'GEM') {
    return (
      <View key={item.id} style={baseStyle}>
        <View style={glowStyle} />
        <View
          style={{
            width: size,
            height: size,
            backgroundColor: baseColor,
            borderRadius: 2,
            transform: [{ rotate: '45deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: size * 0.45,
            height: size * 0.45,
            backgroundColor: 'rgba(255,255,255,0.55)',
            borderRadius: 1,
            transform: [{ rotate: '45deg' }],
          }}
        />
      </View>
    );
  }

  if (item.kind === 'CROWN') {
    return (
      <View key={item.id} style={baseStyle}>
        <View style={glowStyle} />
        <View
          style={{
            width: size + 2,
            height: size * 0.6,
            backgroundColor: baseColor,
            borderRadius: 2,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: -2,
            flexDirection: 'row',
            gap: 2,
          }}>
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: baseColor }} />
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: baseColor }} />
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: baseColor }} />
        </View>
      </View>
    );
  }

  if (item.kind === 'KEY') {
    return (
      <View key={item.id} style={baseStyle}>
        <View style={glowStyle} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: size * 0.55,
              height: size * 0.55,
              borderRadius: size * 0.3,
              borderWidth: 2,
              borderColor: baseColor,
            }}
          />
          <View
            style={{
              width: size * 0.65,
              height: 2,
              backgroundColor: baseColor,
              marginLeft: 2,
            }}
          />
          <View
            style={{
              width: 2,
              height: 4,
              backgroundColor: baseColor,
              marginLeft: 1,
            }}
          />
        </View>
      </View>
    );
  }

  if (item.kind === 'CURSED') {
    return (
      <View key={item.id} style={baseStyle}>
        <View style={glowStyle} />
        <View
          style={{
            width: size + 2,
            height: size + 2,
            borderRadius: 2,
            borderWidth: 1,
            borderColor: baseColor,
            transform: [{ rotate: '45deg' }],
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        />
      </View>
    );
  }

  return (
    <View key={item.id} style={baseStyle}>
      <View style={glowStyle} />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: baseColor,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.7)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.2,
          left: size * 0.2,
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: size * 0.2,
          backgroundColor: 'rgba(255,255,255,0.6)',
        }}
      />
    </View>
  );
};

export const GameScreen = () => {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const { meta, spendTickets, grantTickets, earnRunRewards, markWonRun, setDifficulty } = useMeta();
  const palette = getPalette(meta.cosmetics.paletteId);
  const trail = getTrail(meta.cosmetics.trailId);
  const pickupPlayer = useAudioPlayer(SFX.pickup);
  const dashPlayer = useAudioPlayer(SFX.dash);
  const nearMissPlayer = useAudioPlayer(SFX.nearMiss);
  const alarmPlayer = useAudioPlayer(SFX.alarm);
  const vaultPlayer = useAudioPlayer(SFX.vault);
  const [mode, setMode] = useState<Mode>('NORMAL');
  const [runId, setRunId] = useState(0);
  const [, setTick] = useState(0);
  const gameRef = useRef<ReturnType<typeof createRun> | null>(null);
  const inputRef = useRef<InputState>({ targetWorld: null, dashRequested: false });
  const handledEndRef = useRef(false);
  const trailRef = useRef<Vec2[]>([]);
  const lastTrailRef = useRef(0);
  const prevLootCountRef = useRef<number | null>(null);
  const prevNearMissRef = useRef(0);
  const prevDashChargesRef = useRef<number | null>(null);
  const prevVaultsRef = useRef(0);
  const prevAlarmRatioRef = useRef(0);
  const sfxCooldownRef = useRef({
    pickup: 0,
    dash: 0,
    nearMiss: 0,
    alarm: 0,
    vault: 0,
  });

  const startRun = () => {
    const allowed = spendTickets(mode);
    if (!allowed) {
      return;
    }
    gameRef.current = createRun({ mode, upgrades: meta.upgrades, difficulty: meta.difficulty });
    inputRef.current = { targetWorld: null, dashRequested: false };
    handledEndRef.current = false;
    trailRef.current = [];
    lastTrailRef.current = 0;
    prevLootCountRef.current = null;
    prevNearMissRef.current = 0;
    prevDashChargesRef.current = null;
    prevVaultsRef.current = 0;
    prevAlarmRatioRef.current = 0;
    setRunId((value) => value + 1);
  };

  useEffect(() => {
    let animation: number;
    let last = now();
    let acc = 0;

    const loop = (time: number) => {
      const game = gameRef.current;
      const dt = Math.min((time - last) / 1000, TUNING.run.maxFrameDt);
      last = time;
      acc += dt;
      while (acc >= TUNING.run.fixedStep) {
        if (game && !game.ended) {
          stepGame(game, inputRef.current, TUNING.run.fixedStep);
        }
        acc -= TUNING.run.fixedStep;
      }
      if (game && !game.ended) {
        const interval = 1000 / 30;
        if (time - lastTrailRef.current >= interval) {
          lastTrailRef.current = time;
          trailRef.current.unshift({ x: game.player.pos.x, y: game.player.pos.y });
          if (trailRef.current.length > trail.length) {
            trailRef.current.pop();
          }
        }
      }
      if (game && game.ended && !handledEndRef.current) {
        handledEndRef.current = true;
        earnRunRewards(game.stats.creditsEarned, game.stats.shardsEarned);
        if (game.stats.endReason === 'TIME') {
          markWonRun();
        }
      }
      setTick((value) => value + 1);
      animation = requestAnimationFrame(loop);
    };

    animation = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animation);
  }, [runId, earnRunRewards, markWonRun, trail.length]);

  const game = gameRef.current;

  const viewW = TUNING.world.roomW;
  const viewH = TUNING.world.roomH;
  const worldH = game ? TUNING.world.roomH * game.layout.rooms.length : viewH;
  const scale = Math.min(SCREEN_W / viewW, SCREEN_H / viewH);
  const viewport = {
    w: viewW * scale,
    h: viewH * scale,
  };
  const viewportOffset = {
    x: (SCREEN_W - viewport.w) / 2,
    y: (SCREEN_H - viewport.h) / 2,
  };

  const camera = (() => {
    if (!game) {
      return { x: 0, y: 0 };
    }
    const cameraY = clamp(game.player.pos.y - viewH / 2, 0, Math.max(0, worldH - viewH));
    return { x: 0, y: cameraY };
  })();

  const grid = useMemo(() => {
    const spacing = 80;
    const maxLines = 40;
    const countY = Math.min(Math.floor(worldH / spacing), maxLines);
    const ys = Array.from({ length: countY }, (_, i) => (i + 1) * spacing);
    const countX = 5;
    const xs = Array.from({ length: countX }, (_, i) => ((i + 1) * viewW) / (countX + 1));
    return { xs, ys };
  }, [viewW, worldH]);

  const handleTouch = (event: any) => {
    if (!game || game.ended) {
      return;
    }
    const { pageX, pageY } = event.nativeEvent;
    const target = screenToWorld({ x: pageX, y: pageY }, camera, scale, viewportOffset);
    inputRef.current.targetWorld = target;
  };

  const handleRelease = () => {
    inputRef.current.targetWorld = null;
  };

  const handleDash = () => {
    inputRef.current.dashRequested = true;
  };

  const runCost = TUNING.economy.tickets.runCost[mode];
  const canStart = meta.tickets >= runCost;
  const showOverlay = !game || game.ended;
  const alarmRatio = game ? clamp(game.alarm / TUNING.danger.alarm.max, 0, 1) : 0;
  const hasKey = game ? game.keys.size > 0 : false;
  const vaultsOpened = game ? game.stats.vaultsOpened : 0;

  useEffect(() => {
    if (!game || game.ended) {
      return;
    }

    const nowMs = now();
    const gate = (key: keyof typeof sfxCooldownRef.current, cooldownMs: number) => {
      const last = sfxCooldownRef.current[key];
      if (nowMs - last < cooldownMs) {
        return false;
      }
      sfxCooldownRef.current[key] = nowMs;
      return true;
    };

    const play = (
      key: keyof typeof sfxCooldownRef.current,
      player: ReturnType<typeof useAudioPlayer>,
      cooldownMs: number,
      haptic?: () => void,
    ) => {
      if (!gate(key, cooldownMs)) {
        return;
      }
      player.seekTo?.(0);
      player.play();
      haptic?.();
    };

    if (prevLootCountRef.current !== null && game.loot.length < prevLootCountRef.current) {
      play('pickup', pickupPlayer, 90, () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      });
    }
    prevLootCountRef.current = game.loot.length;

    if (game.stats.nearMissCount > prevNearMissRef.current) {
      play('nearMiss', nearMissPlayer, 140, () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      });
    }
    prevNearMissRef.current = game.stats.nearMissCount;

    if (prevDashChargesRef.current !== null && game.player.dashCharges < prevDashChargesRef.current) {
      play('dash', dashPlayer, 100, () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      });
    }
    prevDashChargesRef.current = game.player.dashCharges;

    if (game.stats.vaultsOpened > prevVaultsRef.current) {
      play('vault', vaultPlayer, 220, () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      });
    }
    prevVaultsRef.current = game.stats.vaultsOpened;

    if (alarmRatio >= 0.85 && prevAlarmRatioRef.current < 0.85) {
      play('alarm', alarmPlayer, 600, () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      });
    }
    prevAlarmRatioRef.current = alarmRatio;
  }, [
    alarmPlayer,
    alarmRatio,
    dashPlayer,
    game?.ended,
    game?.loot.length,
    game?.player.dashCharges,
    game?.stats.nearMissCount,
    game?.stats.vaultsOpened,
    nearMissPlayer,
    pickupPlayer,
    vaultPlayer,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg[0] }]}> 
      <View style={styles.glowLayer} pointerEvents="none">
        <View style={[styles.glow, { backgroundColor: palette.neonA, top: -80, left: -60 }]} />
        <View style={[styles.glow, { backgroundColor: palette.neonB, bottom: -120, right: -80 }]} />
        <View style={[styles.glowSmall, { backgroundColor: palette.neonC, top: '40%', right: -40 }]} />
      </View>

      <View
        style={[
          styles.viewport,
          {
            width: viewport.w,
            height: viewport.h,
            left: viewportOffset.x,
            top: viewportOffset.y,
          },
        ]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderMove={handleTouch}
        onResponderGrant={handleTouch}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}>
        <View
          style={{
            width: viewW,
            height: worldH,
            transform: [{ translateX: -camera.x }, { translateY: -camera.y }, { scale }],
          }}>
          <View style={[styles.worldBackdrop, { width: viewW, height: worldH, backgroundColor: palette.bg[1] }]} />

          {grid.ys.map((y) => (
            <View
              key={`grid-y-${y}`}
              style={{
                position: 'absolute',
                left: 0,
                top: y,
                width: viewW,
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}
            />
          ))}
          {grid.xs.map((x) => (
            <View
              key={`grid-x-${x}`}
              style={{
                position: 'absolute',
                left: x,
                top: 0,
                width: 1,
                height: worldH,
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}
            />
          ))}

          {game?.layout.rooms.map((room, index) => (
            <View
              key={`room-${room.templateId}-${index}`}
              style={{
                position: 'absolute',
                left: room.offset.x,
                top: room.offset.y,
                width: viewW,
                height: viewH,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
              }}
            />
          ))}
          {game?.walls.map((wall) => (
            <View
              key={`wall-${wall.x}-${wall.y}`}
              style={{
                position: 'absolute',
                left: wall.x,
                top: wall.y,
                width: wall.w,
                height: wall.h,
                backgroundColor: '#0B0F21',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.04)',
              }}
            />
          ))}

          {game?.tripZones.map((zone) => (
            <View
              key={zone.id}
              style={{
                position: 'absolute',
                left: zone.rect.x,
                top: zone.rect.y,
                width: zone.rect.w,
                height: zone.rect.h,
                borderWidth: 1,
                borderColor: zone.triggered ? palette.warning : palette.neonB,
                backgroundColor: zone.triggered ? 'rgba(255,59,48,0.12)' : 'rgba(255,45,218,0.08)',
                opacity: 0.6,
              }}
            />
          ))}

          {game?.vaultDoors.map((door) => (
            <View
              key={`${door.keyId}-${door.rect.x}`}
              style={{
                position: 'absolute',
                left: door.rect.x,
                top: door.rect.y,
                width: door.rect.w,
                height: door.rect.h,
                borderWidth: 2,
                borderColor: door.opened ? palette.neonC : palette.neonB,
                backgroundColor: door.opened ? 'rgba(20, 255, 180, 0.2)' : 'rgba(255, 45, 218, 0.12)',
                borderRadius: 6,
              }}
            />
          ))}

          {game?.loot.map((item) => renderLootSprite(item, palette))}

          {game?.drones.map((drone) => (
            <View
              key={drone.id}
              style={{
                position: 'absolute',
                left: drone.pos.x - drone.radius,
                top: drone.pos.y - drone.radius,
                width: drone.radius * 2,
                height: drone.radius * 2,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {drone.kind === 'SCANNER' && drone.scanner && (
                <View
                  style={{
                    position: 'absolute',
                    width: drone.scanner.range * 2,
                    height: drone.scanner.range * 2,
                    borderRadius: drone.scanner.range,
                    borderWidth: 1,
                    borderColor: 'rgba(255,77,109,0.18)',
                  }}
                />
              )}
              <View
                style={{
                  width: drone.radius * 2,
                  height: drone.radius * 2,
                  borderRadius: drone.radius,
                  backgroundColor: '#FF4D6D',
                  borderWidth: 2,
                  borderColor: 'rgba(255,255,255,0.18)',
                  opacity: 0.95,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#FFF2F5',
                  opacity: 0.8,
                  top: drone.radius * 0.25,
                  right: drone.radius * 0.35,
                }}
              />
            </View>
          ))}

          {game?.lasers.map((laser) => {
            const { active, opacity } = laserVisual(laser);
            const half = laser.length / 2;
            const left = laser.anchor.x - half;
            const top = laser.anchor.y - laser.thickness / 2;
            const glowThickness = laser.thickness + 4;
            return (
              <View
                key={laser.id}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: laser.length,
                  height: laser.thickness,
                  transform: [
                    { translateX: half },
                    { translateY: laser.thickness / 2 },
                    { rotate: `${laser.angle}rad` },
                    { translateX: -half },
                    { translateY: -laser.thickness / 2 },
                  ],
                }}>
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: -(glowThickness - laser.thickness) / 2,
                    width: laser.length,
                    height: glowThickness,
                    borderRadius: glowThickness / 2,
                    backgroundColor: palette.warning,
                    opacity: active ? opacity * 0.22 : opacity * 0.14,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: laser.length,
                    height: laser.thickness,
                    backgroundColor: palette.warning,
                    opacity: active ? opacity : opacity * 0.7,
                  }}
                />
              </View>
            );
          })}

          {game &&
            trailRef.current.map((point, index) => {
              const max = Math.max(1, trailRef.current.length);
              const t = 1 - index / max;
              const size = game.player.radius * (0.6 + t * 0.9);
              return (
                <View
                  key={`trail-${index}`}
                  style={{
                    position: 'absolute',
                    left: point.x - size / 2,
                    top: point.y - size / 2,
                    width: size,
                    height: size,
                    borderRadius: 999,
                    backgroundColor: palette.neonA,
                    opacity: 0.16 * t,
                  }}
                />
              );
            })}
          {game && (() => {
            const runElapsed = TUNING.run.durationSec - game.timeLeft;
            const spawnPulse = runElapsed < 1.4 ? 1 - runElapsed / 1.4 : 0;
            const pulseOpacity = spawnPulse * (0.3 + 0.2 * Math.sin(runElapsed * 9));
            const ringSize = game.player.radius * 2 + 8;
            const coreSize = Math.max(6, game.player.radius * 1.2);
            return (
              <>
                <View
                  style={{
                    position: 'absolute',
                    left: game.player.pos.x - game.player.radius - 10,
                    top: game.player.pos.y - game.player.radius - 10,
                    width: (game.player.radius + 10) * 2,
                    height: (game.player.radius + 10) * 2,
                    borderRadius: 999,
                    backgroundColor: palette.neonA,
                    opacity: 0.18,
                  }}
                />
                {spawnPulse > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      left: game.player.pos.x - game.player.radius - 18,
                      top: game.player.pos.y - game.player.radius - 18,
                      width: (game.player.radius + 18) * 2,
                      height: (game.player.radius + 18) * 2,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: palette.neonC,
                      opacity: pulseOpacity,
                    }}
                  />
                )}
                <View
                  style={{
                    position: 'absolute',
                    left: game.player.pos.x - ringSize / 2,
                    top: game.player.pos.y - ringSize / 2,
                    width: ringSize,
                    height: ringSize,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: palette.neonA,
                    backgroundColor: 'rgba(5, 6, 14, 0.8)',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: game.player.pos.x - coreSize / 2,
                    top: game.player.pos.y - coreSize / 2,
                    width: coreSize,
                    height: coreSize,
                    borderRadius: 999,
                    backgroundColor: '#F5F7FF',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: game.player.pos.x + coreSize * 0.15,
                    top: game.player.pos.y - coreSize * 0.35,
                    width: coreSize * 0.35,
                    height: coreSize * 0.35,
                    borderRadius: 999,
                    backgroundColor: palette.neonC,
                    opacity: 0.8,
                  }}
                />
              </>
            );
          })()}
        </View>
      </View>

      <View style={[styles.hud, { paddingTop: insets.top + 8 }]} pointerEvents="none">
        <View style={styles.hudTopRow}>
          <View style={styles.hudCard}>
            <View style={styles.hudRow}>
              <Text style={[styles.hudLabel, { color: palette.neonA }]}>SCORE</Text>
              <Text style={[styles.hudValue, { color: '#fff' }]}>{game ? game.stats.score.toLocaleString() : '0'}</Text>
            </View>
            <View style={styles.hudRow}>
              <Text style={[styles.hudLabel, { color: palette.neonB }]}>TIME</Text>
              <Text style={[styles.hudValue, { color: '#fff' }]}>{game ? Math.ceil(game.timeLeft) : TUNING.run.durationSec}</Text>
            </View>
            <View style={styles.hudRow}>
              <Text style={[styles.hudLabel, { color: palette.warning }]}>ALARM</Text>
              <View style={styles.alarmBar}>
                <View style={[styles.alarmFill, { width: `${alarmRatio * 100}%`, backgroundColor: palette.warning }]} />
              </View>
            </View>
          </View>
          <View style={styles.hudMiniCard}>
            <Text style={styles.hudMiniLabel}>KEY</Text>
            <View style={styles.hudMiniRow}>
              <View style={[styles.hudMiniDot, { backgroundColor: hasKey ? '#FFD166' : 'rgba(255,255,255,0.2)' }]} />
              <Text style={styles.hudMiniValue}>{hasKey ? 'FOUND' : 'NONE'}</Text>
            </View>
            <Text style={[styles.hudMiniLabel, { marginTop: 6 }]}>VAULTS</Text>
            <Text style={styles.hudMiniValue}>{vaultsOpened}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}> 
        <View>
          <Text style={styles.ticketLabel}>TICKETS</Text>
          <Text style={styles.ticketValue}>{meta.tickets}</Text>
        </View>
        <Pressable style={[styles.dashButton, { borderColor: palette.neonA }]} onPress={handleDash}>
          <Text style={[styles.dashText, { color: palette.neonA }]}>DASH</Text>
          <Text style={[styles.dashCharges, { color: '#fff' }]}>×{game ? game.player.dashCharges : TUNING.player.dash.chargesBase}</Text>
        </Pressable>
      </View>

      {showOverlay && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={[styles.title, { color: palette.neonA }]}>Minute Heist</Text>
            <Text style={styles.subtitle}>Neon Arcade • 60-second runs</Text>

            {game && game.ended && (
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Run Summary</Text>
                <Text style={styles.summaryText}>Score: {game.stats.score.toLocaleString()}</Text>
                <Text style={styles.summaryText}>Credits: +{game.stats.creditsEarned}</Text>
                <Text style={styles.summaryText}>Near Miss: {game.stats.nearMissCount}</Text>
                <Text style={styles.summaryText}>Vaults: {game.stats.vaultsOpened}</Text>
                <Text style={styles.summaryText}>End: {endReasonLabel(game.stats.endReason)}</Text>
              </View>
            )}

            <View style={styles.goalBlock}>
              <Text style={styles.sectionLabel}>Goal</Text>
              <Text style={styles.goalText}>Grab loot, find the key, open vaults, survive 60 seconds.</Text>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: palette.neonA }]} />
                  <Text style={styles.legendText}>Loot</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FFD166' }]} />
                  <Text style={styles.legendText}>Key</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: palette.neonB }]} />
                  <Text style={styles.legendText}>Vaults</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: palette.warning }]} />
                  <Text style={styles.legendText}>Avoid</Text>
                </View>
              </View>
            </View>

            {!meta.hasWonRun && (
              <View style={styles.howToBlock}>
                <Text style={styles.sectionLabel}>How to Play</Text>
                <Text style={styles.howToText}>1. Drag anywhere to move.</Text>
                <Text style={styles.howToText}>2. Dash to dodge lasers and drones.</Text>
                <Text style={styles.howToText}>3. Find a key to open vaults.</Text>
                <Text style={styles.howToNote}>Win a run to hide these tips.</Text>
              </View>
            )}

            <View style={styles.modeRow}>
              {(['NORMAL', 'DAILY', 'RISK'] as Mode[]).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.modeChip, mode === option && styles.modeChipActive]}
                  onPress={() => setMode(option)}>
                  <Text style={[styles.modeText, mode === option && styles.modeTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.difficultyRow}>
              {(['CHILL', 'PRO'] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.difficultyChip, meta.difficulty === option && styles.difficultyChipActive]}
                  onPress={() => setDifficulty(option)}>
                  <Text style={[styles.difficultyText, meta.difficulty === option && styles.difficultyTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.difficultyHint}>
              {meta.difficulty === 'CHILL' ? 'Slower hazards, wider openings.' : 'Full speed, higher pressure.'}
            </Text>
            <Text style={styles.modeHint}>{MODE_HINTS[mode]}</Text>
            <Text style={[styles.costText, !canStart && styles.costTextWarn]}>
              Cost: {runCost} ticket{runCost === 1 ? '' : 's'}
            </Text>

            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: canStart ? palette.neonA : 'rgba(255,255,255,0.12)' },
              ]}
              onPress={startRun}
              disabled={!canStart}>
              <Text style={[styles.primaryButtonText, !canStart && styles.primaryButtonTextDisabled]}>Start Run</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => grantTickets(TUNING.economy.tickets.adRewardTickets)}>
              <Text style={styles.secondaryButtonText}>Watch Ad → +{TUNING.economy.tickets.adRewardTickets} Ticket</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#05060B',
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.2,
  },
  glowSmall: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.18,
  },
  viewport: {
    position: 'absolute',
    overflow: 'hidden',
  },
  worldBackdrop: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  hud: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  hudTopRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  hudCard: {
    backgroundColor: 'rgba(12, 15, 31, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    maxWidth: 190,
    minWidth: 150,
  },
  hudMiniCard: {
    width: 110,
    backgroundColor: 'rgba(12, 15, 31, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  hudRow: {
    marginBottom: 6,
  },
  hudLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  hudValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  hudMiniLabel: {
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#9FB3FF',
    marginBottom: 4,
  },
  hudMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hudMiniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hudMiniValue: {
    fontSize: 11,
    color: '#E2E6FF',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  alarmBar: {
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginTop: 4,
  },
  alarmFill: {
    height: '100%',
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#fff',
    opacity: 0.6,
  },
  ticketValue: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },
  dashButton: {
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dashText: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  dashCharges: {
    fontSize: 16,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 5, 12, 0.78)',
  },
  overlayCard: {
    width: '86%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#0C0F1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#C6D0FF',
    marginTop: 6,
    marginBottom: 18,
  },
  summary: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 12,
    color: '#C6D0FF',
  },
  goalBlock: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#9FB3FF',
    marginBottom: 6,
  },
  goalText: {
    fontSize: 12,
    color: '#E2E6FF',
    marginBottom: 10,
    lineHeight: 16,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10, 12, 24, 0.8)',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: '#C6D0FF',
  },
  howToBlock: {
    marginBottom: 16,
  },
  howToText: {
    fontSize: 12,
    color: '#C6D0FF',
    lineHeight: 16,
    marginBottom: 4,
  },
  howToNote: {
    fontSize: 11,
    color: '#9FB3FF',
    marginTop: 6,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modeChip: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  modeChipActive: {
    backgroundColor: 'rgba(34,231,255,0.2)',
    borderColor: 'rgba(34,231,255,0.8)',
  },
  modeText: {
    fontSize: 11,
    color: '#C6D0FF',
    letterSpacing: 1,
  },
  modeTextActive: {
    color: '#fff',
  },
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 6,
  },
  difficultyChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(10, 12, 24, 0.5)',
  },
  difficultyChipActive: {
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  difficultyText: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#C6D0FF',
  },
  difficultyTextActive: {
    color: '#fff',
  },
  difficultyHint: {
    fontSize: 11,
    color: '#9FB3FF',
    textAlign: 'center',
    marginBottom: 6,
  },
  modeHint: {
    fontSize: 11,
    color: '#C6D0FF',
    textAlign: 'center',
    marginBottom: 8,
  },
  costText: {
    fontSize: 11,
    color: '#C6D0FF',
    textAlign: 'center',
    marginBottom: 10,
  },
  costTextWarn: {
    color: '#FF9AA4',
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#05060B',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  primaryButtonTextDisabled: {
    color: '#8A93B6',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#9FB3FF',
    fontSize: 12,
  },
});
