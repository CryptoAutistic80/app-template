// src/game/sim/math.ts
// Vector math and collision primitives

import { Vec2, Rect } from "../types";

// === Vector operations ===

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function div(v: Vec2, s: number): Vec2 {
  return { x: v.x / s, y: v.y / s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function lengthSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function dist(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

export function distSq(a: Vec2, b: Vec2): number {
  return lengthSq(sub(a, b));
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function rotate(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

export function clampLength(v: Vec2, maxLen: number): Vec2 {
  const len = length(v);
  if (len <= maxLen) return v;
  return mul(normalize(v), maxLen);
}

// === Collision primitives ===

// Circle vs circle
export function circleVsCircle(
  p1: Vec2,
  r1: number,
  p2: Vec2,
  r2: number
): boolean {
  return distSq(p1, p2) < (r1 + r2) * (r1 + r2);
}

// Point vs rect
export function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

// Circle vs rect (AABB)
export function circleVsRect(center: Vec2, radius: number, rect: Rect): boolean {
  // Find closest point on rect to circle center
  const closestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.h));
  const dx = center.x - closestX;
  const dy = center.y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

// Push circle out of rect (for wall collision resolution)
export function pushCircleOutOfRect(
  center: Vec2,
  radius: number,
  rect: Rect
): Vec2 | null {
  if (!circleVsRect(center, radius, rect)) return null;

  // Find penetration from each side
  const left = center.x + radius - rect.x;
  const right = rect.x + rect.w - (center.x - radius);
  const top = center.y + radius - rect.y;
  const bottom = rect.y + rect.h - (center.y - radius);

  // Push out by smallest penetration
  const minX = left < right ? -left : right;
  const minY = top < bottom ? -top : bottom;

  if (Math.abs(minX) < Math.abs(minY)) {
    return { x: center.x + minX, y: center.y };
  } else {
    return { x: center.x, y: center.y + minY };
  }
}

// === Line segment collision ===

// Distance from point to line segment
export function pointToSegmentDist(
  p: Vec2,
  a: Vec2,
  b: Vec2
): { dist: number; closest: Vec2 } {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const abLenSq = lengthSq(ab);

  if (abLenSq === 0) {
    // Segment is a point
    return { dist: dist(p, a), closest: a };
  }

  // Project p onto line ab, clamped to segment
  let t = dot(ap, ab) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const closest = add(a, mul(ab, t));
  return { dist: dist(p, closest), closest };
}

// Circle vs line segment (for laser collision)
export function circleVsSegment(
  center: Vec2,
  radius: number,
  a: Vec2,
  b: Vec2,
  segmentThickness: number = 0
): { hit: boolean; dist: number; closest: Vec2 } {
  const result = pointToSegmentDist(center, a, b);
  const totalRadius = radius + segmentThickness;
  return {
    hit: result.dist < totalRadius,
    dist: result.dist - segmentThickness,
    closest: result.closest,
  };
}

// Get laser segment endpoints from anchor, angle, length
export function getLaserEndpoints(
  anchor: Vec2,
  angle: number,
  length: number
): { a: Vec2; b: Vec2 } {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  return {
    a: anchor,
    b: add(anchor, mul(dir, length)),
  };
}

// === Angle utilities ===

export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += Math.PI * 2;
  while (angle >= Math.PI * 2) angle -= Math.PI * 2;
  return angle;
}

export function angleBetween(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Check if angle is within cone (for scanner drones)
export function angleInCone(
  angle: number,
  coneCenter: number,
  coneHalfWidth: number
): boolean {
  let diff = normalizeAngle(angle - coneCenter);
  if (diff > Math.PI) diff -= Math.PI * 2;
  return Math.abs(diff) <= coneHalfWidth;
}

// === General utilities ===

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
