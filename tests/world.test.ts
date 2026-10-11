import { describe, expect, it } from 'vitest';
import { moveWithCollisions, findPath } from '../src/gameplay/navigation';
import { Mission } from '../src/gameplay/mission';
import { CITY_COLLIDERS, cityDefinition } from '../src/content/maps/city';

const bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
const wall = { minX: -4, maxX: 4, minZ: -12, maxZ: -8, height: 10 };
describe('world and mission', () => {
  it('routes to a legal position hugging a wall even when its rounded grid cell is blocked', () => {
    const path = findPath({ x: 0, z: 55 }, { x: -28.25, z: -43 }, CITY_COLLIDERS, cityDefinition.bounds, 1.1, 5);
    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)?.x).toBeCloseTo(-28.25);
    expect(path.at(-1)?.z).toBeCloseTo(-43);
  });
  it('blocks fast movement while allowing sliding alongside a building', () => {
    const p = moveWithCollisions({ x: 0, z: 0 }, { x: 4, z: -30 }, 2, [wall], bounds);
    expect(p.z).toBeGreaterThanOrEqual(-6.001);
    expect(p.x).toBeCloseTo(4);
  });
  it('finds a route around buildings with clearance for the actor', () => {
    const path = findPath({ x: 0, z: 0 }, { x: 0, z: -30 }, [wall], bounds, 2, 4);
    expect(path.length).toBeGreaterThan(2);
    expect(path.some(p => Math.abs(p.x) > 6)).toBe(true);
    expect(path.at(-1)?.z).toBeCloseTo(-30);
  });
  it('completes exactly three waves and resets all mission state on restart', () => {
    const mission = new Mission([{ title: 'A', enemies: ['zaku'] }, { title: 'B', enemies: ['zaku'] }, { title: 'C', enemies: ['char-zaku'] }]);
    mission.start();
    expect(mission.waveIndex).toBe(0);
    mission.enemyDefeated(); mission.update(4);
    expect(mission.waveIndex).toBe(1);
    mission.enemyDefeated(); mission.update(4);
    expect(mission.waveIndex).toBe(2);
    mission.enemyDefeated();
    expect(mission.status).toBe('victory');
    mission.start();
    expect(mission.status).toBe('playing');
    expect(mission.kills).toBe(0);
    expect(mission.waveIndex).toBe(0);
  });
  it('does not advance waves after player defeat', () => {
    const mission = new Mission([{ title: 'A', enemies: ['zaku'] }, { title: 'B', enemies: ['zaku'] }]);
    mission.start(); mission.defeat(); mission.enemyDefeated(); mission.update(10);
    expect(mission.status).toBe('defeat');
    expect(mission.waveIndex).toBe(0);
  });
});
