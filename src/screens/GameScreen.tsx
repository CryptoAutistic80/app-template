// src/screens/GameScreen.tsx
// Main game screen - the actual playable game

import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { GameState, InputState, Mode, VisualState, EndReason } from "../game/types";
import { TUNING } from "../game/tuning";
import { generateRun, createGameState } from "../game/generator";
import { stepSimulation, createVisualState } from "../game/sim/simulation";
import { GameRenderer } from "../game/render/GameRenderer";

interface GameScreenProps {
  mode: Mode;
  upgrades: Record<string, number>;
  paletteId: string;
  onGameOver: (stats: GameState["stats"]) => void;
  onQuit: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const GameScreen: React.FC<GameScreenProps> = ({
  mode,
  upgrades,
  paletteId,
  onGameOver,
  onQuit,
}) => {
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [visuals, setVisuals] = useState<VisualState>(createVisualState());
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [endReason, setEndReason] = useState<EndReason | null>(null);

  // Input tracking
  const inputRef = useRef<InputState>({
    touching: false,
    touchPos: { x: 0, y: 0 },
    dashRequested: false,
  });

  // Animation frame ref
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Initialize game
  useEffect(() => {
    const layout = generateRun(mode);
    const state = createGameState(layout, upgrades);
    setGameState(state);
    lastTimeRef.current = performance.now();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [mode, upgrades]);

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState || isPaused || isGameOver) {
      frameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const now = performance.now();
    const dt = Math.min((now - lastTimeRef.current) / 1000, TUNING.run.maxFrameDt);
    lastTimeRef.current = now;

    // Step simulation
    const result = stepSimulation(gameState, inputRef.current, dt, visuals, upgrades);

    // Clear dash request after processing
    inputRef.current.dashRequested = false;

    // Check for game over
    if (result.endReason) {
      setEndReason(result.endReason);
      setIsGameOver(true);

      // Haptic feedback on death
      if (result.endReason !== "TIME") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Finalize stats
      gameState.stats.score = gameState.score;
      gameState.stats.maxAlarm = Math.max(gameState.stats.maxAlarm, gameState.alarm);
      gameState.stats.timeSurvived = TUNING.run.durationSec - gameState.timeRemaining;
      gameState.stats.endReason = result.endReason;

      onGameOver(gameState.stats);
    }

    // Update state for re-render (only update visual state, game state is mutated in place)
    setVisuals({ ...result.visuals });

    frameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, isPaused, isGameOver, visuals, upgrades, onGameOver]);

  // Start game loop
  useEffect(() => {
    if (gameState) {
      frameRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [gameState, gameLoop]);

  // Touch gesture for movement
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      inputRef.current.touching = true;
      inputRef.current.touchPos = { x: e.x, y: e.y };

      // Light haptic on touch start
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      // Convert screen coords to game world coords
      const scale = SCREEN_WIDTH / TUNING.world.roomW;
      const worldX = e.x / scale;
      const worldY = e.y / scale + (gameState?.player.pos.y || 0) - SCREEN_HEIGHT / scale / 2;

      inputRef.current.touchPos = { x: worldX, y: worldY };
    })
    .onEnd(() => {
      inputRef.current.touching = false;
    });

  // Double tap for dash
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      inputRef.current.dashRequested = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(panGesture, doubleTapGesture);

  if (!gameState) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.gameContainer}>
          <GameRenderer
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            gameState={gameState}
            visuals={visuals}
            paletteId={paletteId}
          />
        </View>
      </GestureDetector>

      {/* HUD Overlay with text (Skia doesn't handle text well without fonts) */}
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

        {/* Pause button */}
        <TouchableOpacity style={styles.pauseButton} onPress={() => setIsPaused(!isPaused)}>
          <Text style={styles.pauseButtonText}>{isPaused ? "▶" : "⏸"}</Text>
        </TouchableOpacity>
      </View>

      {/* Pause overlay */}
      {isPaused && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseTitle}>PAUSED</Text>
          <TouchableOpacity style={styles.menuButton} onPress={() => setIsPaused(false)}>
            <Text style={styles.menuButtonText}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={onQuit}>
            <Text style={styles.menuButtonText}>Quit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Game over overlay */}
      {isGameOver && (
        <View style={styles.gameOverOverlay}>
          <Text style={styles.gameOverTitle}>
            {endReason === "TIME" ? "TIME'S UP!" : "CAUGHT!"}
          </Text>
          <Text style={styles.finalScore}>{Math.floor(gameState.score)}</Text>
          <Text style={styles.statsText}>
            Near Misses: {gameState.stats.nearMissCount}
          </Text>
          <Text style={styles.statsText}>
            Loot Collected: {gameState.stats.lootCollected}
          </Text>
          <TouchableOpacity style={styles.menuButton} onPress={onQuit}>
            <Text style={styles.menuButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

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
    marginTop: 100,
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
    fontSize: 32,
    fontWeight: "bold",
    textShadowColor: "#22E7FF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  scoreContainer: {
    position: "absolute",
    top: 50,
    left: 16,
  },
  scoreText: {
    color: "#A7FF3A",
    fontSize: 24,
    fontWeight: "bold",
  },
  comboText: {
    color: "#FF2DDA",
    fontSize: 18,
    fontWeight: "bold",
  },
  pauseButton: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pauseButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  pauseTitle: {
    color: "#22E7FF",
    fontSize: 48,
    fontWeight: "bold",
    marginBottom: 40,
  },
  menuButton: {
    backgroundColor: "#22E7FF",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 8,
    marginVertical: 10,
  },
  menuButtonText: {
    color: "#070812",
    fontSize: 20,
    fontWeight: "bold",
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  gameOverTitle: {
    color: "#FF3B30",
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 20,
  },
  finalScore: {
    color: "#A7FF3A",
    fontSize: 64,
    fontWeight: "bold",
    marginBottom: 20,
  },
  statsText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginBottom: 8,
  },
});

export default GameScreen;
