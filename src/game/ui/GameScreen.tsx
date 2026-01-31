import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createRun, InputState, stepGame } from '../engine';
import { TUNING } from '../tuning';
import { Laser, Mode, Vec2 } from '../types';
import { clamp } from '../math';
import { useMeta } from '../meta/meta';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const getPalette = (paletteId: string) =>
  TUNING.cosmetics.palettes.find((palette) => palette.id === paletteId) ?? TUNING.cosmetics.palettes[0];

const screenToWorld = (screen: Vec2, camera: Vec2, scale: number, offset: Vec2) => ({
  x: (screen.x - offset.x) / scale + camera.x,
  y: (screen.y - offset.y) / scale + camera.y,
});

const now = () => (globalThis.performance?.now?.() ?? Date.now());

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

export const GameScreen = () => {
  const insets = useSafeAreaInsets();
  const { meta, spendTickets, grantTickets, earnRunRewards } = useMeta();
  const palette = getPalette(meta.cosmetics.paletteId);
  const [mode, setMode] = useState<Mode>('NORMAL');
  const [runId, setRunId] = useState(0);
  const [, setTick] = useState(0);
  const gameRef = useRef<ReturnType<typeof createRun> | null>(null);
  const inputRef = useRef<InputState>({ targetWorld: null, dashRequested: false });
  const handledEndRef = useRef(false);

  const startRun = () => {
    const allowed = spendTickets(mode);
    if (!allowed) {
      return;
    }
    gameRef.current = createRun({ mode, upgrades: meta.upgrades });
    inputRef.current = { targetWorld: null, dashRequested: false };
    handledEndRef.current = false;
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
      if (game && game.ended && !handledEndRef.current) {
        handledEndRef.current = true;
        earnRunRewards(game.stats.creditsEarned, game.stats.shardsEarned);
      }
      setTick((value) => value + 1);
      animation = requestAnimationFrame(loop);
    };

    animation = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animation);
  }, [runId, earnRunRewards]);

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

  const showOverlay = !game || game.ended;
  const alarmRatio = game ? clamp(game.alarm / TUNING.danger.alarm.max, 0, 1) : 0;

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
          {game?.walls.map((wall) => (
            <View
              key={`wall-${wall.x}-${wall.y}`}
              style={{
                position: 'absolute',
                left: wall.x,
                top: wall.y,
                width: wall.w,
                height: wall.h,
                backgroundColor: '#111220',
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
                opacity: 0.3,
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
                backgroundColor: door.opened ? 'rgba(20, 255, 180, 0.18)' : 'rgba(255, 45, 218, 0.08)',
              }}
            />
          ))}

          {game?.loot.map((item) => (
            <View
              key={item.id}
              style={{
                position: 'absolute',
                left: item.pos.x - 5,
                top: item.pos.y - 5,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor:
                  item.kind === 'COIN'
                    ? palette.neonA
                    : item.kind === 'GEM'
                      ? palette.neonC
                      : item.kind === 'CROWN'
                        ? palette.neonB
                        : item.kind === 'KEY'
                          ? '#FFD166'
                          : palette.warning,
                opacity: 0.9,
              }}
            />
          ))}

          {game?.drones.map((drone) => (
            <View
              key={drone.id}
              style={{
                position: 'absolute',
                left: drone.pos.x - drone.radius,
                top: drone.pos.y - drone.radius,
                width: drone.radius * 2,
                height: drone.radius * 2,
                borderRadius: drone.radius,
                backgroundColor: '#FF4D6D',
                opacity: 0.9,
              }}
            />
          ))}

          {game?.lasers.map((laser) => {
            const { active, opacity } = laserVisual(laser);
            const half = laser.length / 2;
            const left = laser.anchor.x - half;
            const top = laser.anchor.y - laser.thickness / 2;
            return (
              <View
                key={laser.id}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: laser.length,
                  height: laser.thickness,
                  backgroundColor: palette.warning,
                  opacity: active ? opacity : opacity * 0.7,
                  transform: [
                    { translateX: half },
                    { translateY: laser.thickness / 2 },
                    { rotate: `${laser.angle}rad` },
                    { translateX: -half },
                    { translateY: -laser.thickness / 2 },
                  ],
                }}
              />
            );
          })}

          {game && (
            <View
              style={{
                position: 'absolute',
                left: game.player.pos.x - game.player.radius - 6,
                top: game.player.pos.y - game.player.radius - 6,
                width: (game.player.radius + 6) * 2,
                height: (game.player.radius + 6) * 2,
                borderRadius: 999,
                backgroundColor: palette.neonA,
                opacity: 0.2,
              }}
            />
          )}
          {game && (
            <View
              style={{
                position: 'absolute',
                left: game.player.pos.x - game.player.radius,
                top: game.player.pos.y - game.player.radius,
                width: game.player.radius * 2,
                height: game.player.radius * 2,
                borderRadius: 999,
                backgroundColor: palette.neonA,
              }}
            />
          )}
        </View>
      </View>

      <View style={[styles.hud, { paddingTop: insets.top + 12 }]}> 
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

            <Pressable style={[styles.primaryButton, { backgroundColor: palette.neonA }]} onPress={startRun}>
              <Text style={styles.primaryButtonText}>Start Run</Text>
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
  hud: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  hudRow: {
    marginBottom: 8,
  },
  hudLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  hudValue: {
    fontSize: 20,
    fontWeight: '700',
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
    maxWidth: 360,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#0C0F1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
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
