import type { Point3 } from './types';

export const copyPoint = (point: Point3): Point3 => ({ x: point.x, y: point.y, z: point.z });
export const distance = (a: Point3, b: Point3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
export function directionTo(a: Point3, b: Point3): Point3 {
  const length = distance(a, b);
  return length > 1e-8 ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length, z: (b.z - a.z) / length } : { x: 0, y: 0, z: -1 };
}

/** Rotate at a bounded angular speed, including the opposite-direction case. */
export function turnTowards(current: Point3, desired: Point3, angle: number): Point3 {
  const dot = Math.max(-1, Math.min(1, current.x * desired.x + current.y * desired.y + current.z * desired.z));
  const remaining = Math.acos(dot);
  if (remaining < 1e-6 || angle >= remaining) return copyPoint(desired);
  if (angle <= 0) return copyPoint(current);
  let tangent = { x: desired.x - current.x * dot, y: desired.y - current.y * dot, z: desired.z - current.z * dot };
  let length = Math.hypot(tangent.x, tangent.y, tangent.z);
  if (length < 1e-6) {
    tangent = Math.abs(current.y) < 0.9 ? { x: -current.z, y: 0, z: current.x } : { x: 0, y: -current.z, z: current.y };
    length = Math.hypot(tangent.x, tangent.y, tangent.z);
  }
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle) / length;
  return { x: current.x * cosine + tangent.x * sine, y: current.y * cosine + tangent.y * sine, z: current.z * cosine + tangent.z * sine };
}

export function attackPosition(target: Point3, index: number, count: number, radius: number): Point3 {
  const angle = index * Math.PI * 2 / Math.max(1, count) + Math.PI / 6;
  return { x: target.x + Math.cos(angle) * radius, y: target.y + 4 + (index % 2) * 2, z: target.z + Math.sin(angle) * radius };
}

/** A bounded search keeps the preferred slot first, then nearby slots and shorter/lower rings. */
export function attackPositions(target: Point3, index: number, count: number, radius: number): Point3[] {
  const preferred = attackPosition(target, index, count, radius);
  const baseAngle = Math.atan2(preferred.z - target.z, preferred.x - target.x);
  const positions: Point3[] = [];
  for (const [scale, heightScale] of [[1, 1], [0.8, 0.5], [0.6, 0]] as const) {
    for (const slot of [0, 1, -1, 2, -2, 3]) {
      const angle = baseAngle + slot * Math.PI / 3;
      const height = (preferred.y - target.y) * heightScale + (heightScale === 0 ? index % 2 : 0);
      positions.push({ x: target.x + Math.cos(angle) * radius * scale, y: target.y + height, z: target.z + Math.sin(angle) * radius * scale });
    }
  }
  return positions;
}

/** Model contract: the deployed muzzle lies 0.3 units along local -Z. */
export function muzzlePosition(position: Point3, direction: Point3): Point3 {
  return { x: position.x + direction.x * 0.3, y: position.y + direction.y * 0.3, z: position.z + direction.z * 0.3 };
}
