// src/game/rng.ts
// Seeded random number generator for deterministic runs
// Uses mulberry32 - fast and good enough for games

export class SeededRNG {
  private state: number;
  private initialSeed: number;

  constructor(seed: number) {
    this.initialSeed = seed;
    this.state = seed;
  }

  // Reset to initial seed (for replay)
  reset(): void {
    this.state = this.initialSeed;
  }

  // Get current seed state (for save/load)
  getState(): number {
    return this.state;
  }

  // Set state (for save/load)
  setState(state: number): void {
    this.state = state;
  }

  // Core random: returns [0, 1)
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Random float in range [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Random integer in range [min, max] inclusive
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  // Random boolean with probability p
  chance(p: number): boolean {
    return this.next() < p;
  }

  // Pick random element from array
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }

  // Pick random element using weights
  pickWeighted<T extends { weight: number }>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.next() * totalWeight;

    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }

    return items[items.length - 1];
  }

  // Shuffle array in place (Fisher-Yates)
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Random point in rectangle
  pointInRect(x: number, y: number, w: number, h: number): { x: number; y: number } {
    return {
      x: this.range(x, x + w),
      y: this.range(y, y + h),
    };
  }

  // Random angle in radians [0, 2PI)
  angle(): number {
    return this.next() * Math.PI * 2;
  }

  // Gaussian-ish distribution (Box-Muller, mean 0, stddev 1)
  gaussian(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
  }
}

// Generate seed from current time + device salt
export function generateSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

// Generate daily seed (same for all players on same day)
export function getDailySeed(): number {
  const date = new Date();
  const dateString = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = (hash << 5) - hash + dateString.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash ^ 0x4d696e75) >>> 0; // XOR with "Minu" for flavor
}

// Get today's date string for mission tracking
export function getTodayString(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
