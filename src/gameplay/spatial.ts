import type { RectCollider, MapDefinition } from '../content/maps/types';
import type { Point3 } from './combat';

const EPS = 1e-5;
function overlaps(p: Point3, radius: number, wall: RectCollider): boolean {
  return p.x > wall.minX - radius + EPS && p.x < wall.maxX + radius - EPS &&
    p.z > wall.minZ - radius + EPS && p.z < wall.maxZ + radius - EPS;
}

/** Highest solid surface under the feet, including roof edges supporting the body. */
export function supportHeight(position: Point3, radius: number, walls: RectCollider[]): number {
  let height = 0;
  for (const wall of walls) {
    if (wall.height <= position.y + EPS && wall.height > height && overlaps(position, radius, wall)) height = wall.height;
  }
  return height;
}

/** Small 3D steps preserve wall sliding and catch both facades and roof landings. */
export function moveBody(position: Point3, delta: Point3, radius: number, height: number,
  walls: RectCollider[], bounds: MapDefinition['bounds']): { position: Point3; blocked: Record<'x' | 'y' | 'z', boolean> } {
  const p = { x: position.x, y: position.y, z: position.z }, blocked = { x: false, y: false, z: false };
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y, delta.z) / Math.min(0.3, radius * 0.3)));
  for (let n = 0; n < steps; n++) {
    for (const axis of ['x', 'z'] as const) {
      const wanted = p[axis] + delta[axis] / steps;
      const min = axis === 'x' ? bounds.minX : bounds.minZ, max = axis === 'x' ? bounds.maxX : bounds.maxZ;
      const next = { ...p, [axis]: Math.max(min + radius, Math.min(max - radius, wanted)) };
      if (walls.some(w => p.y < w.height - EPS && p.y + height > EPS && overlaps(next, radius, w))) blocked[axis] = true;
      else { p[axis] = next[axis]; if (Math.abs(wanted - next[axis]) > EPS) blocked[axis] = true; }
    }
    const wantedY = p.y + delta.y / steps;
    let nextY = Math.max(0, Math.min(100, wantedY));
    for (const wall of walls) {
      if (!overlaps(p, radius, wall)) continue;
      if (delta.y <= 0 && p.y >= wall.height - EPS && nextY < wall.height) nextY = wall.height;
    }
    if (Math.abs(wantedY - nextY) > EPS) blocked.y = true;
    p.y = nextY;
  }
  return { position: p, blocked };
}

/** Separate solid body volumes only when their vertical intervals overlap. */
export function separateActors(actors: { position: Point3; definition: { radius: number; height: number } }[],
  walls: RectCollider[], bounds: MapDefinition['bounds']): void {
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
    const a = actors[i], b = actors[j];
    if (a.position.y >= b.position.y + b.definition.height || b.position.y >= a.position.y + a.definition.height) continue;
    const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
    const distance = Math.hypot(dx, dz), minimum = a.definition.radius + b.definition.radius;
    if (distance >= minimum) continue;
    const nx = distance > 0.001 ? dx / distance : 1, nz = distance > 0.001 ? dz / distance : 0;
    for (const [actor, sign] of [[a, -1], [b, 1]] as const) {
      const next = moveBody(actor.position, { x: nx * (minimum - distance) * 0.5 * sign, y: 0, z: nz * (minimum - distance) * 0.5 * sign },
        actor.definition.radius, actor.definition.height, walls, bounds);
      Object.assign(actor.position, next.position);
    }
  }
}
