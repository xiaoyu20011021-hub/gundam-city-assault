import { describe, expect, it } from 'vitest';
import { MAP_DEFINITIONS, isMapId } from '../src/content/maps';
import { SELENE_COLLIDERS, seleneDefinition } from '../src/content/maps/selene';
import { findPath, pointBlocked } from '../src/gameplay/navigation';
import { moveBody } from '../src/gameplay/spatial';
import { firstSegmentHit } from '../src/gameplay/combat';

describe('SELENE playable map', () => {
  it('offers a second map without replacing the original map', () => {
    expect(Object.keys(MAP_DEFINITIONS)).toEqual(['city', 'selene']);
    expect(MAP_DEFINITIONS.city.name).toContain('静海');
    expect(MAP_DEFINITIONS.selene).toBe(seleneDefinition);
    expect(isMapId('selene')).toBe(true); expect(isMapId('__proto__')).toBe(false);
  });
  it('connects every safe spawn through the central streets', () => {
    const { bounds, playerSpawn, enemySpawns } = seleneDefinition;
    expect(enemySpawns.length).toBeGreaterThanOrEqual(8);
    for (const p of [playerSpawn, ...enemySpawns]) {
      expect(pointBlocked(p, SELENE_COLLIDERS, 3)).toBe(false);
      expect(p.x).toBeGreaterThan(bounds.minX + 3); expect(p.x).toBeLessThan(bounds.maxX - 3);
      expect(p.z).toBeGreaterThan(bounds.minZ + 3); expect(p.z).toBeLessThan(bounds.maxZ - 3);
      const path = findPath(p, playerSpawn, SELENE_COLLIDERS, bounds, 2.3);
      expect(path.length, `route from ${JSON.stringify(p)}`).toBeGreaterThan(0);
      expect(path.at(-1)).toEqual(playerSpawn);
      for (const step of path) expect(pointBlocked(step, SELENE_COLLIDERS, 2.3)).toBe(false);
    }
  });
  it('blocks projectiles and fast movement at a building and supports roof landings', () => {
    const wall = SELENE_COLLIDERS.find(c => c.minX > 25 && c.maxX < 110 && c.minZ > 40)!;
    expect(wall).toBeDefined();
    const x = (wall.minX + wall.maxX) / 2, z = (wall.minZ + wall.maxZ) / 2;
    expect(firstSegmentHit({ x, y: 2, z: wall.minZ - 8 }, { x, y: 2, z: wall.maxZ + 8 }, SELENE_COLLIDERS, [])?.type).toBe('wall');
    const hit = moveBody({ x, y: 0, z: wall.minZ - 5 }, { x: 0, y: 0, z: 15 }, 1.2, 6.2, SELENE_COLLIDERS, seleneDefinition.bounds);
    expect(hit.position.z).toBeLessThanOrEqual(wall.minZ - 1.2 + 1e-4);
    const landed = moveBody({ x, y: wall.height + 5, z }, { x: 0, y: -8, z: 0 }, 1.2, 6.2, [wall], seleneDefinition.bounds);
    expect(landed.position.y).toBeCloseTo(wall.height);
  });
});
