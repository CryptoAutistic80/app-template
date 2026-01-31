import { Vec2 } from './types';

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const vecAdd = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const vecSub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const vecScale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });

export const vecLength = (a: Vec2) => Math.hypot(a.x, a.y);

export const vecNormalize = (a: Vec2): Vec2 => {
  const len = vecLength(a);
  if (len <= 0.00001) {
    return { x: 0, y: 0 };
  }
  return { x: a.x / len, y: a.y / len };
};

export const vecDistance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export const moveTowards = (from: Vec2, to: Vec2, maxDelta: number): Vec2 => {
  const delta = vecSub(to, from);
  const dist = vecLength(delta);
  if (dist <= maxDelta || dist <= 0.00001) {
    return { ...to };
  }
  return vecAdd(from, vecScale(delta, maxDelta / dist));
};
