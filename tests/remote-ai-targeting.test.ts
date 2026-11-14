import { expect, it, vi } from 'vitest';
import { RemoteTargetingController } from '../src/gameplay/ai-targeting';
import type { RemoteUnitSnapshot } from '../src/gameplay/remote-weapons/types';

const origin = { x: 0, y: 3, z: 0 };
const enemy = { id: 'enemy', elite: false, position: origin };
const visible = () => true;
function unit(id = 'funnel', overrides: Partial<RemoteUnitSnapshot> = {}): RemoteUnitSnapshot {
  return { id, ownerId: 'player', team: 'player', equipmentId: 'fins', model: 'fins', mountId: '1', index: 0,
    state: 'attacking', position: { x: 0, y: 3, z: -20 }, velocity: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 },
    health: 48, maxHealth: 48, radius: 0.5, height: 0.8, cooldown: 0, blocked: false, ...overrides };
}

it('chooses visible airborne opposing units independently of the player visibility', () => {
  const targeting = new RemoteTargetingController(), target = unit();
  expect(targeting.choose(enemy, [target], 0.016, visible, 100, () => 0)?.id).toBe(target.id);
  expect(targeting.choose(enemy, [unit('friend', { team: 'enemy' })], 0.016, visible, 100, () => 0)).toBeUndefined();
});

it('keeps negative choices until the next assessment instead of rolling each frame', () => {
  const targeting = new RemoteTargetingController(), random = vi.fn(() => 0.9);
  for (let i = 0; i < 20; i++) expect(targeting.choose(enemy, [unit()], 0.016, visible, 100, random)).toBeUndefined();
  expect(random).toHaveBeenCalledTimes(1);
  targeting.choose(enemy, [unit()], 0.1, visible, 100, random);
  expect(random).toHaveBeenCalledTimes(2);
});

it('holds a target for a second while immediately invalidating death, walls and range', () => {
  const targeting = new RemoteTargetingController(), target = unit(), random = vi.fn(() => 0);
  expect(targeting.choose(enemy, [target], 0.01, visible, 100, random)?.id).toBe(target.id);
  for (let i = 0; i < 9; i++) expect(targeting.choose(enemy, [unit('other'), target], 0.1, visible, 100, random)?.id).toBe(target.id);
  expect(random).toHaveBeenCalledTimes(1);
  expect(targeting.choose(enemy, [target], 0.01, () => false, 100, random)).toBeUndefined();
  expect(targeting.choose(enemy, [target], 0.01, visible, 100, random)).toBeUndefined();
  targeting.clear();
  expect(targeting.choose(enemy, [unit('dead', { health: 0 }), unit('docked', { state: 'docked' }), unit('charge', { state: 'recharging' })], 1, visible, 100, random)).toBeUndefined();
  expect(targeting.choose({ ...enemy, id: 'range' }, [target], 1, visible, 10, random)).toBeUndefined();
});

it('does not use random when no eligible target exists and uses elite decision chance', () => {
  const targeting = new RemoteTargetingController(), random = vi.fn(() => 0.3);
  targeting.choose(enemy, [], 0.01, visible, 100, random);
  expect(random).not.toHaveBeenCalled();
  expect(targeting.choose({ ...enemy, id: 'ordinary' }, [unit()], 0.01, visible, 100, random)).toBeUndefined();
  expect(targeting.choose({ ...enemy, id: 'elite', elite: true }, [unit()], 0.01, visible, 100, random)?.id).toBe('funnel');
});

it('aims at the small target center with fair angular scatter and no humanoid height offset', () => {
  const targeting = new RemoteTargetingController(), target = unit();
  expect(targeting.aim(enemy.id, target, origin, 'classic', 0, 100, 100, () => 0.5)).toEqual(target.position);
  const high = targeting.aim(enemy.id, target, origin, 'classic', 0.1, 100, 100, () => 1)!;
  const low = targeting.aim(enemy.id, target, origin, 'classic', 0.2, 100, 100, () => 0)!;
  expect(high.y - target.position.y).toBeCloseTo(target.position.y - low.y);
  expect(Math.abs(high.y - target.position.y)).toBeLessThan(1);
});

it('uses delayed observations for enhanced aiming and isolates enemy and target history', () => {
  const targeting = new RemoteTargetingController();
  const moving = unit('moving', { velocity: { x: 10, y: 0, z: 0 } });
  expect(targeting.aim(enemy.id, moving, origin, 'enhanced', 0, 100, 100, () => 0.5)).toBeNull();
  expect(targeting.aim(enemy.id, moving, origin, 'enhanced', 0.22, 100, 100, () => 0.5)!.x).toBeGreaterThan(2.2);
  const reversed = { ...moving, position: { x: 2.3, y: 3, z: -20 }, velocity: { x: -10, y: 0, z: 0 } };
  expect(targeting.aim(enemy.id, reversed, origin, 'enhanced', 0.23, 100, 100, () => 0.5)!.x).toBeGreaterThan(2.3);
  expect(targeting.aim(enemy.id, unit('new'), origin, 'enhanced', 0.24, 100, 100, () => 0.5)).toBeNull();
  expect(targeting.aim('another-enemy', moving, origin, 'enhanced', 0.24, 100, 100, () => 0.5)).toBeNull();
  targeting.clear();
  expect(targeting.aim(enemy.id, moving, origin, 'enhanced', 0.5, 100, 100, () => 0.5)).toBeNull();
});

it('rejects dead and unreachable aim and gives elites a shorter reaction time', () => {
  const targeting = new RemoteTargetingController(), target = unit();
  targeting.choose({ ...enemy, elite: true }, [target], 0.01, visible, 100, () => 0);
  expect(targeting.aim(enemy.id, target, origin, 'enhanced', 0, 100, 100, () => 0.5)).toBeNull();
  expect(targeting.aim(enemy.id, target, origin, 'enhanced', 0.12, 100, 100, () => 0.5)).toEqual(target.position);
  expect(targeting.aim(enemy.id, unit('dead', { health: 0 }), origin, 'classic', 0.3, 100, 100)).toBeNull();
  expect(targeting.aim(enemy.id, target, origin, 'classic', 0.3, 100, 10)).toBeNull();
});
