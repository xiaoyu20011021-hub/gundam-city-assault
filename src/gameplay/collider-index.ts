import type { RectCollider } from '../content/maps/types';

const indices = new WeakMap<RectCollider[], ColliderIndex>();

/** Static map geometry. Replace the collider array when changing map geometry. */
class ColliderIndex {
  private cells = new Map<string, RectCollider[]>();
  private readonly size = 16;
  constructor(walls: RectCollider[]) {
    for (const wall of walls) {
      for (let x = Math.floor(wall.minX / this.size); x <= Math.floor(wall.maxX / this.size); x++) {
        for (let z = Math.floor(wall.minZ / this.size); z <= Math.floor(wall.maxZ / this.size); z++) {
          const key = `${x},${z}`, cell = this.cells.get(key) ?? [];
          cell.push(wall); this.cells.set(key, cell);
        }
      }
    }
  }
  query(minX: number, maxX: number, minZ: number, maxZ: number): RectCollider[] {
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return [];
    const found = new Set<RectCollider>();
    for (let x = Math.floor(minX / this.size); x <= Math.floor(maxX / this.size); x++) {
      for (let z = Math.floor(minZ / this.size); z <= Math.floor(maxZ / this.size); z++) {
        for (const wall of this.cells.get(`${x},${z}`) ?? []) {
          if (wall.maxX >= minX && wall.minX <= maxX && wall.maxZ >= minZ && wall.minZ <= maxZ) found.add(wall);
        }
      }
    }
    return [...found];
  }
}

export function colliderIndex(walls: RectCollider[]): ColliderIndex {
  let index = indices.get(walls);
  if (!index) { index = new ColliderIndex(walls); indices.set(walls, index); }
  return index;
}
