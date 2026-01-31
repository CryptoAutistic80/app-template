// src/game/meta/storage.ts
// Meta progression persistence using AsyncStorage

import AsyncStorage from "@react-native-async-storage/async-storage";
import { MetaState, MissionState } from "../types";
import { TUNING } from "../tuning";
import { getTodayString, SeededRNG } from "../rng";

const STORAGE_KEY = "minute_heist_meta";

// Default meta state for new players
export function createDefaultMeta(): MetaState {
  return {
    credits: 0,
    shards: 0,
    tickets: TUNING.economy.tickets.capBase,
    ticketCap: TUNING.economy.tickets.capBase,
    lastTicketRefill: Date.now(),
    upgrades: {},
    cosmetics: {
      paletteId: "PAL_CYAN_MAGENTA",
      trailId: "TRAIL_SOFT",
      owned: ["PAL_CYAN_MAGENTA", "TRAIL_SOFT"],
    },
    missions: {
      dailySeedDay: "",
      daily: [],
      weekly: [],
    },
    stats: {
      totalRuns: 0,
      bestScore: 0,
      totalNearMisses: 0,
    },
  };
}

// Load meta state from storage
export async function loadMeta(): Promise<MetaState> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      const meta = JSON.parse(data) as MetaState;
      // Refill tickets based on time passed
      refillTickets(meta);
      // Refresh missions if new day
      refreshMissionsIfNeeded(meta);
      return meta;
    }
  } catch (e) {
    console.error("Failed to load meta:", e);
  }
  return createDefaultMeta();
}

// Save meta state to storage
export async function saveMeta(meta: MetaState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch (e) {
    console.error("Failed to save meta:", e);
  }
}

// Refill tickets based on time elapsed
function refillTickets(meta: MetaState): void {
  const now = Date.now();
  const elapsed = now - meta.lastTicketRefill;
  const refillMs = TUNING.economy.tickets.refillMinutesPerTicket * 60 * 1000;
  const ticketsToAdd = Math.floor(elapsed / refillMs);

  if (ticketsToAdd > 0 && meta.tickets < meta.ticketCap) {
    meta.tickets = Math.min(meta.ticketCap, meta.tickets + ticketsToAdd);
    meta.lastTicketRefill = now - (elapsed % refillMs);
  }
}

// Get time until next ticket refill (in seconds)
export function getTimeUntilNextTicket(meta: MetaState): number {
  if (meta.tickets >= meta.ticketCap) return 0;
  const refillMs = TUNING.economy.tickets.refillMinutesPerTicket * 60 * 1000;
  const elapsed = Date.now() - meta.lastTicketRefill;
  return Math.max(0, Math.ceil((refillMs - elapsed) / 1000));
}

// Refresh daily/weekly missions if needed
function refreshMissionsIfNeeded(meta: MetaState): void {
  const today = getTodayString();

  if (meta.missions.dailySeedDay !== today) {
    // New day - refresh daily missions
    meta.missions.dailySeedDay = today;
    meta.missions.daily = generateMissions("daily", today);
  }

  // Weekly missions refresh on Monday (simplified: just check if empty)
  if (meta.missions.weekly.length === 0) {
    meta.missions.weekly = generateMissions("weekly", today);
  }
}

// Generate missions
function generateMissions(type: "daily" | "weekly", dateSeed: string): MissionState[] {
  const count = type === "daily" ? TUNING.missions.dailyCount : TUNING.missions.weeklyCount;
  const pool = TUNING.missions.pool;

  // Create seeded RNG from date
  let hash = 0;
  for (let i = 0; i < dateSeed.length; i++) {
    hash = (hash << 5) - hash + dateSeed.charCodeAt(i);
  }
  const rng = new SeededRNG(hash ^ (type === "weekly" ? 0x7765656b : 0x6461696c));

  const missionTypes = Object.keys(pool) as (keyof typeof pool)[];
  const missions: MissionState[] = [];

  // Pick unique mission types
  const shuffled = rng.shuffle([...missionTypes]);

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const mType = shuffled[i];
    const config = pool[mType];
    const difficultyIdx = rng.int(0, config.target.length - 1);

    missions.push({
      id: `${type}_${mType}_${i}`,
      type: mType,
      progress: 0,
      target: config.target[difficultyIdx],
      completed: false,
      claimed: false,
      reward: { shards: config.rewardShards[difficultyIdx] },
    });
  }

  return missions;
}

// Spend tickets for a run
export function spendTicket(meta: MetaState, mode: "NORMAL" | "DAILY" | "RISK"): boolean {
  const cost = TUNING.economy.tickets.runCost[mode];
  if (meta.tickets < cost) return false;
  meta.tickets -= cost;
  return true;
}

// Add credits from run
export function addCredits(meta: MetaState, amount: number): void {
  meta.credits += Math.floor(amount);
}

// Add shards
export function addShards(meta: MetaState, amount: number): void {
  meta.shards += Math.floor(amount);
}

// Buy upgrade
export function buyUpgrade(meta: MetaState, upgradeId: string): boolean {
  const upgrade = TUNING.upgrades.list[upgradeId as keyof typeof TUNING.upgrades.list];
  if (!upgrade) return false;

  const currentLevel = meta.upgrades[upgradeId] || 0;
  if (currentLevel >= upgrade.maxLevel) return false;

  const cost = Math.floor(upgrade.costBase * Math.pow(upgrade.costMul, currentLevel));
  if (meta.credits < cost) return false;

  meta.credits -= cost;
  meta.upgrades[upgradeId] = currentLevel + 1;
  return true;
}

// Update mission progress after a run
export function updateMissionProgress(
  meta: MetaState,
  stats: { nearMissCount: number; vaultsOpened: number; score: number; maxAlarm: number }
): void {
  const updateMissions = (missions: MissionState[]) => {
    for (const mission of missions) {
      if (mission.completed) continue;

      switch (mission.type) {
        case "nearMiss":
          mission.progress += stats.nearMissCount;
          break;
        case "vaults":
          mission.progress += stats.vaultsOpened;
          break;
        case "score":
          mission.progress = Math.max(mission.progress, stats.score);
          break;
        case "alarm":
          mission.progress = Math.max(mission.progress, stats.maxAlarm);
          break;
      }

      if (mission.progress >= mission.target) {
        mission.completed = true;
      }
    }
  };

  updateMissions(meta.missions.daily);
  updateMissions(meta.missions.weekly);
}

// Claim mission reward
export function claimMissionReward(meta: MetaState, missionId: string): boolean {
  const findAndClaim = (missions: MissionState[]): boolean => {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission || !mission.completed || mission.claimed) return false;

    mission.claimed = true;
    if (mission.reward.credits) addCredits(meta, mission.reward.credits);
    if (mission.reward.shards) addShards(meta, mission.reward.shards);
    return true;
  };

  return findAndClaim(meta.missions.daily) || findAndClaim(meta.missions.weekly);
}

// Update stats after a run
export function updateStats(
  meta: MetaState,
  stats: { score: number; nearMissCount: number }
): void {
  meta.stats.totalRuns++;
  meta.stats.bestScore = Math.max(meta.stats.bestScore, stats.score);
  meta.stats.totalNearMisses += stats.nearMissCount;
}
