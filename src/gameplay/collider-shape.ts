import type { RectCollider, SpawnPoint } from '../content/maps/types';
import type { Point3 } from './combat';

// Continuous broad phase also catches a shot crossing a whole building in one step.
export function segmentBox(a: Point3, b: Point3, min: Point3, max: Point3): number | null {
  let enter = 0, exit = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-8) {
      if (a[axis] < min[axis] || a[axis] > max[axis]) return null;
    } else {
      let t0 = (min[axis] - a[axis]) / delta, t1 = (max[axis] - a[axis]) / delta;
      if (t0 > t1) [t0, t1] = [t1, t0];
      enter = Math.max(enter, t0); exit = Math.min(exit, t1);
      if (enter > exit) return null;
    }
  }
  return enter;
}

/** Clip a segment against a solid prism; padding conservatively sweeps a small body. */
export function segmentCollider(a: Point3, b: Point3, wall: RectCollider, padding = 0): number | null {
  const broad = segmentBox(a, b,
    { x: wall.minX - padding, y: (wall.minY ?? 0) - padding, z: wall.minZ - padding },
    { x: wall.maxX + padding, y: wall.height + padding, z: wall.maxZ + padding });
  if (broad === null || !wall.footprint) return broad;
  let enter = 0, exit = 1;
  const clip = (start: number, delta: number): boolean => {
    if (Math.abs(delta) < 1e-10) return start <= 1e-8;
    const t = -start / delta;
    if (delta < 0) enter = Math.max(enter, t); else exit = Math.min(exit, t);
    return enter <= exit;
  };
  if (!clip((wall.minY ?? 0) - padding - a.y, a.y - b.y)
    || !clip(a.y - wall.height - padding, b.y - a.y)) return null;
  const width = wall.maxX - wall.minX, depth = wall.maxZ - wall.minZ, points = wall.footprint;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const nx = (q.z - p.z) * depth, nz = -(q.x - p.x) * width;
    const start = nx * (a.x - wall.minX - p.x * width) + nz * (a.z - wall.minZ - p.z * depth) - padding * Math.hypot(nx, nz);
    if (!clip(start, nx * (b.x - a.x) + nz * (b.z - a.z))) return null;
  }
  return enter;
}

/** Circle/prism footprint overlap; untouched rectangular maps retain their old clearance. */
export function overlapsFootprint(p: SpawnPoint, radius: number, wall: RectCollider): boolean {
  if (p.x <= wall.minX - radius || p.x >= wall.maxX + radius || p.z <= wall.minZ - radius || p.z >= wall.maxZ + radius) return false;
  if (!wall.footprint) return true;
  const width = wall.maxX - wall.minX, depth = wall.maxZ - wall.minZ, points = wall.footprint;
  let inside = true, nearestSquared = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = (b.x - a.x) * width, dz = (b.z - a.z) * depth;
    const px = p.x - wall.minX - a.x * width, pz = p.z - wall.minZ - a.z * depth;
    if (dz * px - dx * pz > 0) inside = false;
    const t = Math.max(0, Math.min(1, (px * dx + pz * dz) / (dx * dx + dz * dz)));
    nearestSquared = Math.min(nearestSquared, (px - dx * t) ** 2 + (pz - dz * t) ** 2);
  }
  return inside || nearestSquared < radius * radius;
}
