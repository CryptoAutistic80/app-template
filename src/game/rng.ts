export interface RNG {
  next(): number;
  float(min?: number, max?: number): number;
  int(min: number, max: number): number;
  pick<T>(items: T[]): T;
}

export function createRng(seed: number): RNG {
  let state = seed >>> 0;
  const next = () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    float(min = 0, max = 1) {
      return min + (max - min) * next();
    },
    int(min: number, max: number) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick<T>(items: T[]) {
      return items[Math.floor(next() * items.length)];
    },
  };
}

export function pickWeighted<T>(items: T[], weights: number[], rng: RNG): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng.float(0, total);
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

export function hashStringToSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seedFromUtcDate(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return hashStringToSeed(`${y}-${m}-${d}`);
}
