import { describe, expect, it } from 'vitest';
import { cityDefinition, CITY_COLLIDERS } from '../src/content/maps/city';
import { findPath } from '../src/gameplay/navigation';

const freeWithClearance = (p: { x: number; z: number }, margin = 3) =>
  !CITY_COLLIDERS.some(c => p.x > c.minX - margin && p.x < c.maxX + margin && p.z > c.minZ - margin && p.z < c.maxZ + margin);

describe('city battle content', () => {
  it('provides open spawns with clearance for six-unit SD mechas', () => {
    const spawns = [cityDefinition.playerSpawn, ...cityDefinition.enemySpawns];
    expect(spawns.length).toBeGreaterThan(7);
    for (const p of spawns) {
      expect(freeWithClearance(p)).toBe(true);
      expect(p.x).toBeGreaterThan(cityDefinition.bounds.minX + 3);
      expect(p.x).toBeLessThan(cityDefinition.bounds.maxX - 3);
      expect(p.z).toBeGreaterThan(cityDefinition.bounds.minZ + 3);
      expect(p.z).toBeLessThan(cityDefinition.bounds.maxZ - 3);
    }
  });
  it('leaves a broad connected cross through the plaza and city', () => {
    for (let n = -120; n <= 120; n += 5) {
      expect(freeWithClearance({ x: 0, z: n }, 8)).toBe(true);
      expect(freeWithClearance({ x: n, z: 0 }, 8)).toBe(true);
    }
  });
  it('defines the agreed three waves and reserves Char for the final wave', () => {
    expect(cityDefinition.waves.map(w => w.enemies.length)).toEqual([4, 6, 5]);
    expect(cityDefinition.waves[0].enemies.every(e => e === 'zaku')).toBe(true);
    expect(cityDefinition.waves[1].enemies.every(e => e === 'zaku')).toBe(true);
    expect(cityDefinition.waves[2].enemies.filter(e => e === 'char-zaku')).toHaveLength(1);
    expect(cityDefinition.waves[2].enemies.filter(e => e === 'zaku')).toHaveLength(4);
  });
  it('connects every enemy spawn to the player through navigable streets', () => {
    for (const spawn of cityDefinition.enemySpawns) {
      const path = findPath(spawn, cityDefinition.playerSpawn, CITY_COLLIDERS, cityDefinition.bounds, 2.3);
      expect(path.length).toBeGreaterThan(0);
      expect(path.at(-1)).toEqual(cityDefinition.playerSpawn);
      for (const step of path) expect(freeWithClearance(step, 2.3)).toBe(true);
    }
  });
});
