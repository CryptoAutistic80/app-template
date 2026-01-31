// app/upgrades.tsx
// Upgrades shop modal

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { MetaState } from "@/src/game/types";
import { TUNING, getPalette, getUpgradeCost } from "@/src/game/tuning";
import { loadMeta, saveMeta, buyUpgrade } from "@/src/game/meta/storage";

const UPGRADE_INFO: Record<string, { name: string; description: string; icon: string }> = {
  SPEED: {
    name: "Swift Feet",
    description: "+1.8% movement speed per level",
    icon: "⚡",
  },
  DASH: {
    name: "Quick Dash",
    description: "-0.1s dash cooldown per level",
    icon: "💨",
  },
  MAGNET: {
    name: "Loot Magnet",
    description: "+3.2 pickup radius per level",
    icon: "🧲",
  },
  SHIELD: {
    name: "Emergency Shield",
    description: "Survive one hit per run",
    icon: "🛡️",
  },
  HEAT_CONV: {
    name: "Heat Converter",
    description: "Convert alarm into bonus credits",
    icon: "🔥",
  },
};

export default function UpgradesScreen() {
  const router = useRouter();
  const [meta, setMeta] = useState<MetaState | null>(null);

  const palette = getPalette(meta?.cosmetics.paletteId || "PAL_CYAN_MAGENTA");

  useEffect(() => {
    loadMeta().then(setMeta);
  }, []);

  const handleBuyUpgrade = useCallback(
    async (upgradeId: string) => {
      if (!meta) return;

      if (buyUpgrade(meta, upgradeId)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await saveMeta(meta);
        setMeta({ ...meta });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [meta]
  );

  if (!meta) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const upgradeIds = Object.keys(TUNING.upgrades.list) as Array<
    keyof typeof TUNING.upgrades.list
  >;

  return (
    <LinearGradient colors={palette.bg as [string, string]} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.neonA }]}>UPGRADES</Text>
        <View style={styles.creditsContainer}>
          <Text style={styles.creditsLabel}>CREDITS</Text>
          <Text style={[styles.creditsValue, { color: palette.neonC }]}>
            {meta.credits}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {upgradeIds.map((upgradeId) => {
          const config = TUNING.upgrades.list[upgradeId];
          const info = UPGRADE_INFO[upgradeId];
          const currentLevel = meta.upgrades[upgradeId] || 0;
          const isMaxed = currentLevel >= config.maxLevel;
          const cost = isMaxed ? 0 : getUpgradeCost(upgradeId, currentLevel + 1);
          const canAfford = meta.credits >= cost;

          return (
            <View key={upgradeId} style={styles.upgradeCard}>
              <View style={styles.upgradeHeader}>
                <Text style={styles.upgradeIcon}>{info.icon}</Text>
                <View style={styles.upgradeInfo}>
                  <Text style={[styles.upgradeName, { color: palette.neonA }]}>
                    {info.name}
                  </Text>
                  <Text style={styles.upgradeDescription}>{info.description}</Text>
                </View>
              </View>

              <View style={styles.levelContainer}>
                <View style={styles.levelBar}>
                  {Array.from({ length: config.maxLevel }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.levelPip,
                        i < currentLevel && { backgroundColor: palette.neonC },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.levelText}>
                  {currentLevel}/{config.maxLevel}
                </Text>
              </View>

              {isMaxed ? (
                <View style={[styles.buyButton, styles.maxedButton]}>
                  <Text style={styles.maxedText}>MAXED</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.buyButton,
                    { backgroundColor: palette.neonC },
                    !canAfford && styles.disabledButton,
                  ]}
                  onPress={() => handleBuyUpgrade(upgradeId)}
                  disabled={!canAfford}
                >
                  <Text style={styles.buyButtonText}>{cost}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    color: "#22E7FF",
    fontSize: 24,
    textAlign: "center",
    marginTop: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 4,
  },
  creditsContainer: {
    alignItems: "flex-end",
  },
  creditsLabel: {
    color: "#888",
    fontSize: 10,
  },
  creditsValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  scrollContent: {
    padding: 20,
  },
  upgradeCard: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  upgradeHeader: {
    flexDirection: "row",
    marginBottom: 16,
  },
  upgradeIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  upgradeInfo: {
    flex: 1,
  },
  upgradeName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  upgradeDescription: {
    color: "#AAA",
    fontSize: 14,
  },
  levelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  levelBar: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  levelPip: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
  },
  levelText: {
    color: "#888",
    fontSize: 14,
    marginLeft: 12,
  },
  buyButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buyButtonText: {
    color: "#070812",
    fontSize: 18,
    fontWeight: "bold",
  },
  disabledButton: {
    opacity: 0.4,
  },
  maxedButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  maxedText: {
    color: "#A7FF3A",
    fontSize: 16,
    fontWeight: "bold",
  },
});
