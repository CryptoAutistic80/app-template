import { Rect, Vec2 } from './types';
import { clamp, vecSub, vecLength } from './math';

export function distancePointToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const ab = vecSub(b, a);
  const ap = vecSub(point, a);
  const abLenSq = ab.x * ab.x + ab.y * ab.y;
  const t = abLenSq > 0 ? clamp((ap.x * ab.x + ap.y * ab.y) / abLenSq, 0, 1) : 0;
  const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return vecLength(vecSub(point, closest));
}

export function resolveCircleRect(pos: Vec2, radius: number, rect: Rect): Vec2 {
  const nearestX = clamp(pos.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(pos.y, rect.y, rect.y + rect.h);
  const dx = pos.x - nearestX;
  const dy = pos.y - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radius * radius || distSq === 0) {
    return pos;
  }
  const dist = Math.sqrt(distSq);
  const push = radius - dist + 0.001;
  return { x: pos.x + (dx / dist) * push, y: pos.y + (dy / dist) * push };
}

export function pointInRect(point: Vec2, rect: Rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}
