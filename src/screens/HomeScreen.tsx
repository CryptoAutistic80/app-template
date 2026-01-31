// src/screens/HomeScreen.tsx
// Main menu screen with mode selection and meta display

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { MetaState, Mode } from "../game/types";
import { TUNING, getPalette } from "../game/tuning";
import {
  loadMeta,
  saveMeta,
  spendTicket,
  getTimeUntilNextTicket,
  addCredits,
  updateMissionProgress,
  updateStats,
} from "../game/meta/storage";

interface HomeScreenProps {
  onStartGame: (mode: Mode, meta: MetaState) => void;
  onOpenUpgrades: (meta: MetaState) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartGame,
  onOpenUpgrades,
}) => {
  const [meta, setMeta] = useState<MetaState | null>(null);
  const [ticketTimer, setTicketTimer] = useState(0);

  const palette = getPalette(meta?.cosmetics.paletteId || "PAL_CYAN_MAGENTA");

  // Load meta on mount
  useEffect(() => {
    loadMeta().then(setMeta);
  }, []);

  // Ticket timer countdown
  useEffect(() => {
    if (!meta) return;

    const updateTimer = () => {
      const time = getTimeUntilNextTicket(meta);
      setTicketTimer(time);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [meta]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start a run
  const handleStartRun = useCallback(
    async (mode: Mode) => {
      if (!meta) return;

      // Check tickets
      if (!spendTicket(meta, mode)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Save and start
      await saveMeta(meta);
      onStartGame(mode, meta);
    },
    [meta, onStartGame]
  );

  if (!meta) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const ticketCost = {
    NORMAL: TUNING.economy.tickets.runCost.NORMAL,
    DAILY: TUNING.economy.tickets.runCost.DAILY,
    RISK: TUNING.economy.tickets.runCost.RISK,
  };

  return (
    <LinearGradient colors={palette.bg as [string, string]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: palette.neonA }]}>MINUTE</Text>
          <Text style={[styles.title, { color: palette.neonB }]}>HEIST</Text>
        </View>

        {/* Resources */}
        <View style={styles.resourcesContainer}>
          <View style={styles.resourceItem}>
            <Text style={styles.resourceLabel}>TICKETS</Text>
            <Text style={[styles.resourceValue, { color: palette.neonA }]}>
              {meta.tickets}/{meta.ticketCap}
            </Text>
            {ticketTimer > 0 && meta.tickets < meta.ticketCap && (
              <Text style={styles.ticketTimer}>+1 in {formatTime(ticketTimer)}</Text>
            )}
          </View>

          <View style={styles.resourceItem}>
            <Text style={styles.resourceLabel}>CREDITS</Text>
            <Text style={[styles.resourceValue, { color: palette.neonC }]}>
              {meta.credits}
            </Text>
          </View>

          <View style={styles.resourceItem}>
            <Text style={styles.resourceLabel}>SHARDS</Text>
            <Text style={[styles.resourceValue, { color: palette.neonB }]}>
              {meta.shards}
            </Text>
          </View>
        </View>

        {/* Mode buttons */}
        <View style={styles.modesContainer}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              { borderColor: palette.neonA },
              meta.tickets < ticketCost.NORMAL && styles.modeButtonDisabled,
            ]}
            onPress={() => handleStartRun("NORMAL")}
            disabled={meta.tickets < ticketCost.NORMAL}
          >
            <Text style={[styles.modeTitle, { color: palette.neonA }]}>NORMAL</Text>
            <Text style={styles.modeDescription}>Standard 60-second heist</Text>
            <Text style={styles.modeCost}>{ticketCost.NORMAL} ticket</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              { borderColor: palette.neonC },
              meta.tickets < ticketCost.DAILY && styles.modeButtonDisabled,
            ]}
            onPress={() => handleStartRun("DAILY")}
            disabled={meta.tickets < ticketCost.DAILY}
          >
            <Text style={[styles.modeTitle, { color: palette.neonC }]}>DAILY</Text>
            <Text style={styles.modeDescription}>Same seed for everyone today</Text>
            <Text style={styles.modeCost}>{ticketCost.DAILY} ticket</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              { borderColor: palette.neonB },
              meta.tickets < ticketCost.RISK && styles.modeButtonDisabled,
            ]}
            onPress={() => handleStartRun("RISK")}
            disabled={meta.tickets < ticketCost.RISK}
          >
            <Text style={[styles.modeTitle, { color: palette.neonB }]}>RISK RUN</Text>
            <Text style={styles.modeDescription}>More rooms, more danger, more loot</Text>
            <Text style={styles.modeCost}>{ticketCost.RISK} tickets</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>YOUR STATS</Text>
          <Text style={styles.statItem}>Best Score: {meta.stats.bestScore}</Text>
          <Text style={styles.statItem}>Total Runs: {meta.stats.totalRuns}</Text>
          <Text style={styles.statItem}>Near Misses: {meta.stats.totalNearMisses}</Text>
        </View>

        {/* Upgrades button */}
        <TouchableOpacity
          style={[styles.upgradesButton, { backgroundColor: palette.neonC }]}
          onPress={() => onOpenUpgrades(meta)}
        >
          <Text style={styles.upgradesButtonText}>UPGRADES</Text>
        </TouchableOpacity>

        {/* Missions preview */}
        <View style={styles.missionsContainer}>
          <Text style={styles.missionsTitle}>DAILY MISSIONS</Text>
          {meta.missions.daily.map((mission) => (
            <View key={mission.id} style={styles.missionItem}>
              <Text style={styles.missionText}>
                {getMissionDescription(mission.type, mission.target)}
              </Text>
              <Text
                style={[
                  styles.missionProgress,
                  mission.completed && styles.missionCompleted,
                ]}
              >
                {mission.progress}/{mission.target}
                {mission.completed && !mission.claimed && " ✓"}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

function getMissionDescription(type: string, target: number): string {
  switch (type) {
    case "nearMiss":
      return `Get ${target} near misses`;
    case "vaults":
      return `Open ${target} vault${target > 1 ? "s" : ""}`;
    case "score":
      return `Score ${target} points`;
    case "alarm":
      return `Reach ${target}% alarm`;
    default:
      return `Complete ${type}`;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  loadingText: {
    color: "#22E7FF",
    fontSize: 24,
    textAlign: "center",
    marginTop: 100,
  },
  titleContainer: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    letterSpacing: 8,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  resourcesContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 30,
  },
  resourceItem: {
    alignItems: "center",
  },
  resourceLabel: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },
  resourceValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  ticketTimer: {
    color: "#666",
    fontSize: 11,
    marginTop: 2,
  },
  modesContainer: {
    width: "100%",
    marginBottom: 30,
  },
  modeButton: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  modeButtonDisabled: {
    opacity: 0.4,
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  modeDescription: {
    color: "#AAA",
    fontSize: 14,
    marginBottom: 8,
  },
  modeCost: {
    color: "#666",
    fontSize: 12,
  },
  statsContainer: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  statsTitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  statItem: {
    color: "#DDD",
    fontSize: 16,
    marginBottom: 6,
  },
  upgradesButton: {
    paddingHorizontal: 60,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 30,
  },
  upgradesButtonText: {
    color: "#070812",
    fontSize: 20,
    fontWeight: "bold",
  },
  missionsContainer: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 20,
  },
  missionsTitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  missionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  missionText: {
    color: "#DDD",
    fontSize: 14,
    flex: 1,
  },
  missionProgress: {
    color: "#888",
    fontSize: 14,
  },
  missionCompleted: {
    color: "#A7FF3A",
  },
});

export default HomeScreen;
