// app/game.tsx
// Game screen route

import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, BackHandler, GestureResponderEvent } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { GameState, InputState, Mode, VisualState, EndReason } from "@/src/game/types";
import { TUNING } from "@/src/game/tuning";
import { generateRun, createGameState } from "@/src/game/generator";
import { stepSimulation, createVisualState } from "@/src/game/sim/simulation";
import { GameRenderer } from "@/src/game/render/GameRenderer";
import {
  loadMeta,
  saveMeta,
  addCredits,
  updateMissionProgress,
  updateStats,
} from "@/src/game/meta/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode: Mode }>();
  const mode = (params.mode as Mode) || "NORMAL";

  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [visuals, setVisuals] = useState<VisualState>(createVisualState());
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [upgrades, setUpgrades] = useState<Record<string, number>>({});
  const [paletteId, setPaletteId] = useState("PAL_CYAN_MAGENTA");

  // Refs for game loop (avoid stale closures)
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const gameStateRef = useRef<GameState | null>(null);
  const visualsRef = useRef<VisualState>(createVisualState());
  const isPausedRef = useRef(false);
  const isGameOverRef = useRef(false);
  const upgradesRef = useRef<Record<string, number>>({});

  // Input ref (mutated directly for performance)
  const inputRef = useRef<InputState>({
    touching: false,
    touchPos: { x: 0, y: 0 },
    dashRequested: false,
  });

  // Keep refs in sync with state
  isPausedRef.current = isPaused;
  isGameOverRef.current = isGameOver;
  upgradesRef.current = upgrades;

  // Load meta and initialize game
  useEffect(() => {
    loadMeta().then((meta) => {
      setUpgrades(meta.upgrades);
      setPaletteId(meta.cosmetics.paletteId);

      const layout = generateRun(mode);
      const state = createGameState(layout, meta.upgrades);
      setGameState(state);
      gameStateRef.current = state;
      lastTimeRef.current = performance.now();
    });

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [mode]);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!isGameOver) {
        setIsPaused(true);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [isGameOver]);

  // Game over handler
  const handleGameOver = useCallback(async () => {
    if (!gameStateRef.current) return;

    const stats = gameStateRef.current.stats;

    // Load and update meta
    const meta = await loadMeta();

    // Add credits earned
    addCredits(meta, stats.creditsEarned);

    // Update mission progress
    updateMissionProgress(meta, {
      nearMissCount: stats.nearMissCount,
      vaultsOpened: stats.vaultsOpened,
      score: stats.score,
      maxAlarm: stats.maxAlarm,
    });

    // Update lifetime stats
    updateStats(meta, {
      score: stats.score,
      nearMissCount: stats.nearMissCount,
    });

    // Save
    await saveMeta(meta);
  }, []);

  // Game loop
  useEffect(() => {
    if (!gameState) return;

    const gameLoop = () => {
      const state = gameStateRef.current;
      if (!state || isPausedRef.current || isGameOverRef.current) {
        frameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, TUNING.run.maxFrameDt);
      lastTimeRef.current = now;

      // Step simulation using refs
      const result = stepSimulation(state, inputRef.current, dt, visualsRef.current, upgradesRef.current);

      // Debug logging (remove later)
      if (Math.random() < 0.01) {
        console.log("Player pos:", state.player.pos, "Input:", inputRef.current.touching, "Rooms:", state.rooms.length);
      }

      // Clear dash request after processing
      inputRef.current.dashRequested = false;

      // Check for game over
      if (result.endReason) {
        setEndReason(result.endReason);
        setIsGameOver(true);

        // Haptic feedback
        if (result.endReason !== "TIME") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Finalize stats
        state.stats.score = state.score;
        state.stats.maxAlarm = Math.max(state.stats.maxAlarm, state.alarm);
        state.stats.timeSurvived = TUNING.run.durationSec - state.timeRemaining;
        state.stats.endReason = result.endReason;

        // Save progress
        handleGameOver();
      }

      // Update visuals ref and state for re-render
      visualsRef.current = result.visuals;
      setVisuals({ ...result.visuals });

      // Force state update for HUD
      setGameState({ ...state });

      frameRef.current = requestAnimationFrame(gameLoop);
    };

    frameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [gameState, handleGameOver]);

  // Double tap detection
  const lastTapRef = useRef(0);

  // Convert screen coords to world coords (inline to avoid ref timing issues)
  const getWorldPos = (screenX: number, screenY: number) => {
    const playerY = gameStateRef.current?.player.pos.y || 0;
    const scale = SCREEN_WIDTH / TUNING.world.roomW;
    const worldX = screenX / scale;
    const worldY = screenY / scale + playerY - SCREEN_HEIGHT / scale / 2;
    return { x: worldX, y: worldY };
  };

  // Touch handlers (mutate ref directly for performance)
  const handleTouchStart = (evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    const worldPos = getWorldPos(locationX, locationY);

    // Check for double tap
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      inputRef.current.dashRequested = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    lastTapRef.current = now;

    inputRef.current.touching = true;
    inputRef.current.touchPos = worldPos;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTouchMove = (evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    const worldPos = getWorldPos(locationX, locationY);
    inputRef.current.touchPos = worldPos;
  };

  const handleTouchEnd = () => {
    inputRef.current.touching = false;
  };

  // Quit handler
  const handleQuit = useCallback(() => {
    router.replace("/");
  }, [router]);

  if (!gameState) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Generating heist...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={styles.gameContainer}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <GameRenderer
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          gameState={gameState}
          visuals={visuals}
          paletteId={paletteId}
        />
      </View>

      {/* HUD Overlay */}
      <View style={styles.hudOverlay} pointerEvents="box-none">
        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{Math.ceil(gameState.timeRemaining)}</Text>
        </View>

        {/* Score */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{Math.floor(gameState.score)}</Text>
          {gameState.combo > 1.1 && (
            <Text style={styles.comboText}>x{gameState.combo.toFixed(1)}</Text>
          )}
        </View>

        {/* Debug info */}
        <Text style={styles.debugText}>
          Pos: {Math.round(gameState.player.pos.x)}, {Math.round(gameState.player.pos.y)} |
          Touch: {inputRef.current.touching ? "Y" : "N"} |
          Rooms: {gameState.rooms.length}
        </Text>

        {/* Alarm bar */}
        {gameState.alarm > 0 && (
          <View style={styles.alarmContainer}>
            <View
              style={[
                styles.alarmBar,
                { width: `${(gameState.alarm / TUNING.danger.alarm.max) * 100}%` },
              ]}
            />
          </View>
        )}

        {/* Pause button */}
        <TouchableOpacity
          style={styles.pauseButton}
          onPress={() => setIsPaused(!isPaused)}
        >
          <Text style={styles.pauseButtonText}>{isPaused ? "▶" : "⏸"}</Text>
        </TouchableOpacity>
      </View>

      {/* Pause overlay */}
      {isPaused && !isGameOver && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>PAUSED</Text>
          <TouchableOpacity style={styles.menuButton} onPress={() => setIsPaused(false)}>
            <Text style={styles.menuButtonText}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, styles.quitButton]} onPress={handleQuit}>
            <Text style={styles.menuButtonText}>Quit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Game over overlay */}
      {isGameOver && (
        <View style={styles.overlay}>
          <Text style={[styles.overlayTitle, endReason === "TIME" && styles.successTitle]}>
            {endReason === "TIME" ? "TIME'S UP!" : "CAUGHT!"}
          </Text>
          <Text style={styles.finalScore}>{Math.floor(gameState.score)}</Text>

          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>Near Misses: {gameState.stats.nearMissCount}</Text>
            <Text style={styles.statsText}>Loot: {gameState.stats.lootCollected}</Text>
            <Text style={styles.statsText}>
              Credits: +{Math.floor(gameState.stats.creditsEarned)}
            </Text>
          </View>

          <TouchableOpacity style={styles.menuButton} onPress={handleQuit}>
            <Text style={styles.menuButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070812",
  },
  gameContainer: {
    flex: 1,
  },
  loadingText: {
    color: "#22E7FF",
    fontSize: 24,
    textAlign: "center",
    marginTop: 200,
  },
  hudOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  timerContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "bold",
    textShadowColor: "#22E7FF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  scoreContainer: {
    position: "absolute",
    top: 50,
    left: 16,
  },
  scoreText: {
    color: "#A7FF3A",
    fontSize: 28,
    fontWeight: "bold",
  },
  comboText: {
    color: "#FF2DDA",
    fontSize: 20,
    fontWeight: "bold",
  },
  alarmContainer: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    height: 6,
    backgroundColor: "rgba(255,59,48,0.2)",
    borderRadius: 3,
  },
  alarmBar: {
    height: "100%",
    backgroundColor: "#FF3B30",
    borderRadius: 3,
  },
  pauseButton: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pauseButtonText: {
    color: "#FFFFFF",
    fontSize: 22,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7,8,18,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayTitle: {
    color: "#FF3B30",
    fontSize: 42,
    fontWeight: "bold",
    marginBottom: 20,
  },
  successTitle: {
    color: "#A7FF3A",
  },
  finalScore: {
    color: "#A7FF3A",
    fontSize: 72,
    fontWeight: "bold",
    marginBottom: 30,
  },
  statsContainer: {
    marginBottom: 40,
  },
  statsText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  menuButton: {
    backgroundColor: "#22E7FF",
    paddingHorizontal: 50,
    paddingVertical: 18,
    borderRadius: 10,
    marginVertical: 8,
  },
  quitButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#FF3B30",
  },
  menuButtonText: {
    color: "#070812",
    fontSize: 22,
    fontWeight: "bold",
  },
  debugText: {
    position: "absolute",
    bottom: 100,
    left: 10,
    color: "#FFFF00",
    fontSize: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 4,
  },
});
