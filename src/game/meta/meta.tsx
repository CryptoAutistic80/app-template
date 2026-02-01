import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Difficulty } from '../types';
import { TUNING } from '../tuning';

export interface GameMeta {
  credits: number;
  shards: number;
  tickets: number;
  ticketCap: number;
  hasWonRun: boolean;
  difficulty: Difficulty;
  upgrades: Record<string, number>;
  cosmetics: {
    paletteId: string;
    trailId: string;
    owned: string[];
  };
  nextTicketAt: number;
}

interface MetaContextValue {
  meta: GameMeta;
  spendTickets: (mode: keyof typeof TUNING.economy.tickets.runCost) => boolean;
  grantTickets: (amount: number) => void;
  earnRunRewards: (credits: number, shards?: number) => void;
  buyUpgrade: (id: keyof typeof TUNING.upgrades.list) => boolean;
  setPalette: (id: string) => void;
  setTrail: (id: string) => void;
  markWonRun: () => void;
  setDifficulty: (difficulty: Difficulty) => void;
}

const MetaContext = createContext<MetaContextValue | null>(null);
const META_STORAGE_KEY = 'minute-heist-meta-v1';

const createDefaultMeta = (): GameMeta => ({
  credits: 0,
  shards: 0,
  tickets: TUNING.economy.tickets.capBase,
  ticketCap: TUNING.economy.tickets.capBase,
  hasWonRun: false,
  difficulty: 'PRO',
  upgrades: {},
  cosmetics: {
    paletteId: TUNING.cosmetics.palettes[0].id,
    trailId: TUNING.cosmetics.trails[0].id,
    owned: [TUNING.cosmetics.palettes[0].id, TUNING.cosmetics.trails[0].id],
  },
  nextTicketAt: Date.now() + TUNING.economy.tickets.refillMinutesPerTicket * 60 * 1000,
});

const hydrateMeta = (stored: Partial<GameMeta> | null): GameMeta => {
  const defaults = createDefaultMeta();
  if (!stored) {
    return defaults;
  }
  return {
    ...defaults,
    ...stored,
    upgrades: { ...defaults.upgrades, ...stored.upgrades },
    cosmetics: {
      ...defaults.cosmetics,
      ...stored.cosmetics,
      owned: stored.cosmetics?.owned ?? defaults.cosmetics.owned,
    },
  };
};

export const getUpgradeCost = (id: keyof typeof TUNING.upgrades.list, level: number) => {
  const upgrade = TUNING.upgrades.list[id];
  return Math.floor(upgrade.costBase * Math.pow(upgrade.costMul, level));
};

export const MetaProvider = ({ children }: { children: React.ReactNode }) => {
  const [meta, setMeta] = useState<GameMeta>(() => createDefaultMeta());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(META_STORAGE_KEY);
        if (!alive) {
          return;
        }
        if (stored) {
          const parsed = JSON.parse(stored) as GameMeta;
          setMeta(hydrateMeta(parsed));
        }
      } catch (error) {
        console.warn('Failed to load meta', error);
      } finally {
        if (alive) {
          setHydrated(true);
        }
      }
    };
    hydrate();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMeta((current) => {
        if (current.tickets >= current.ticketCap) {
          return current;
        }
        if (Date.now() < current.nextTicketAt) {
          return current;
        }
        return {
          ...current,
          tickets: Math.min(current.ticketCap, current.tickets + 1),
          nextTicketAt: Date.now() + TUNING.economy.tickets.refillMinutesPerTicket * 60 * 1000,
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    AsyncStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta)).catch((error) => {
      console.warn('Failed to save meta', error);
    });
  }, [meta, hydrated]);

  const spendTickets = (mode: keyof typeof TUNING.economy.tickets.runCost) => {
    const cost = TUNING.economy.tickets.runCost[mode];
    let allowed = false;
    setMeta((current) => {
      if (current.tickets < cost) {
        allowed = false;
        return current;
      }
      allowed = true;
      return { ...current, tickets: current.tickets - cost };
    });
    return allowed;
  };

  const grantTickets = (amount: number) => {
    setMeta((current) => ({
      ...current,
      tickets: Math.min(current.ticketCap, current.tickets + amount),
    }));
  };

  const earnRunRewards = (credits: number, shards = 0) => {
    setMeta((current) => ({
      ...current,
      credits: current.credits + credits,
      shards: current.shards + shards,
    }));
  };

  const buyUpgrade = (id: keyof typeof TUNING.upgrades.list) => {
    let success = false;
    setMeta((current) => {
      const level = current.upgrades[id] ?? 0;
      const upgrade = TUNING.upgrades.list[id];
      if (level >= upgrade.maxLevel) {
        success = false;
        return current;
      }
      const cost = getUpgradeCost(id, level);
      if (current.credits < cost) {
        success = false;
        return current;
      }
      success = true;
      return {
        ...current,
        credits: current.credits - cost,
        upgrades: {
          ...current.upgrades,
          [id]: level + 1,
        },
      };
    });
    return success;
  };

  const setPalette = (id: string) => {
    setMeta((current) => ({
      ...current,
      cosmetics: { ...current.cosmetics, paletteId: id },
    }));
  };

  const setTrail = (id: string) => {
    setMeta((current) => ({
      ...current,
      cosmetics: { ...current.cosmetics, trailId: id },
    }));
  };

  const markWonRun = () => {
    setMeta((current) => (current.hasWonRun ? current : { ...current, hasWonRun: true }));
  };

  const setDifficulty = (difficulty: Difficulty) => {
    setMeta((current) => ({ ...current, difficulty }));
  };

  const value = useMemo(
    () => ({ meta, spendTickets, grantTickets, earnRunRewards, buyUpgrade, setPalette, setTrail, markWonRun, setDifficulty }),
    [meta],
  );

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
};

export const useMeta = () => {
  const context = useContext(MetaContext);
  if (!context) {
    throw new Error('useMeta must be used within MetaProvider');
  }
  return context;
};
