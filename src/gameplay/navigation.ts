import type { RectCollider, SpawnPoint, MapDefinition } from '../content/maps/types';
import { firstSegmentHit } from './combat';

type Bounds = MapDefinition['bounds'];
export function pointBlocked(p: SpawnPoint, walls: RectCollider[], radius: number): boolean {
  return walls.some(w => p.x > w.minX - radius && p.x < w.maxX + radius && p.z > w.minZ - radius && p.z < w.maxZ + radius);
}

export function moveWithCollisions(position: SpawnPoint, delta: SpawnPoint, radius: number, walls: RectCollider[], bounds: Bounds): SpawnPoint {
  const p = { ...position };
  // Small substeps prevent a boost crossing thin colliders. Each axis is resolved
  // separately, preserving movement along a wall rather than sticking to it.
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / Math.max(0.5, radius * 0.4)));
  for (let i = 0; i < steps; i++) {
    const x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, p.x + delta.x / steps));
    if (!pointBlocked({ x, z: p.z }, walls, radius)) p.x = x;
    const z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, p.z + delta.z / steps));
    if (!pointBlocked({ x: p.x, z }, walls, radius)) p.z = z;
  }
  return p;
}

export function findPath(start: SpawnPoint, goal: SpawnPoint, walls: RectCollider[], bounds: Bounds, radius = 1.8, cellSize = 5): SpawnPoint[] {
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cellSize), rows = Math.ceil((bounds.maxZ - bounds.minZ) / cellSize);
  const toCell = (p: SpawnPoint) => ({ x: Math.max(0, Math.min(cols - 1, Math.round((p.x - bounds.minX) / cellSize))), z: Math.max(0, Math.min(rows - 1, Math.round((p.z - bounds.minZ) / cellSize))) });
  const fromCell = (x: number, z: number): SpawnPoint => ({ x: bounds.minX + x * cellSize, z: bounds.minZ + z * cellSize });
  const key = (x: number, z: number) => z * cols + x;
  const connectorWalls = walls.map(w => ({ ...w, minX: w.minX - radius, maxX: w.maxX + radius, minZ: w.minZ - radius, maxZ: w.maxZ + radius }));
  const connectorClear = (a: SpawnPoint, b: SpawnPoint) => !firstSegmentHit({ x: a.x, y: 0.5, z: a.z }, { x: b.x, y: 0.5, z: b.z }, connectorWalls, []);
  const nearestCell = (point: SpawnPoint): { x: number; z: number } | null => {
    const rounded = toCell(point);
    if (!pointBlocked(fromCell(rounded.x, rounded.z), walls, radius + cellSize * 0.25) && connectorClear(point, fromCell(rounded.x, rounded.z))) return rounded;
    let closest: { x: number; z: number } | null = null, distance = Infinity;
    for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
      const candidate = fromCell(x, z), squared = (candidate.x - point.x) ** 2 + (candidate.z - point.z) ** 2;
      if (squared >= distance || pointBlocked(candidate, walls, radius + cellSize * 0.25) || !connectorClear(point, candidate)) continue;
      closest = { x, z }; distance = squared;
    }
    return closest;
  };
  const s = nearestCell(start), g = nearestCell(goal);
  if (!s || !g) return [];
  const startKey = key(s.x, s.z), goalKey = key(g.x, g.z);
  const open: number[] = [startKey], costs = new Map<number, number>([[startKey, 0]]), parent = new Map<number, number>();
  const closed = new Set<number>();
  const score = (k: number) => (costs.get(k) ?? Infinity) + Math.abs(k % cols - g.x) + Math.abs(Math.floor(k / cols) - g.z);
  let found = false;
  while (open.length && closed.size < cols * rows) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (score(open[i]) < score(open[best])) best = i;
    const current = open.splice(best, 1)[0];
    if (current === goalKey) { found = true; break; }
    if (closed.has(current)) continue;
    closed.add(current);
    const cx = current % cols, cz = Math.floor(current / cols);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
      const next = key(nx, nz);
      if (closed.has(next) || pointBlocked(fromCell(nx, nz), walls, radius + cellSize * 0.25)) continue;
      const cost = (costs.get(current) ?? 0) + 1;
      if (cost >= (costs.get(next) ?? Infinity)) continue;
      parent.set(next, current); costs.set(next, cost); open.push(next);
    }
  }
  if (!found) return [];
  const route: SpawnPoint[] = [];
  let cursor = goalKey;
  while (cursor !== startKey) {
    route.unshift(fromCell(cursor % cols, Math.floor(cursor / cols)));
    cursor = parent.get(cursor)!;
  }
  const startCenter = fromCell(s.x, s.z);
  if (Math.hypot(startCenter.x - start.x, startCenter.z - start.z) > 0.2) route.unshift(startCenter);
  // Only finish at the requested position if the last connector has clearance.
  if (!pointBlocked(goal, walls, radius) && connectorClear(fromCell(g.x, g.z), goal)) route.push({ ...goal });
  return route;
}
