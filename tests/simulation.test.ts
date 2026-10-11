import { expect, it } from 'vitest';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { stepPlayerMovement } from '../src/gameplay/movement';
import { stepEnemy } from '../src/gameplay/ai';
const bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
it('moves equal distances at 30 and 120 Hz without a diagonal speed advantage', () => {
  const run = (hz: number, x: number, z: number) => {
    const actor = new Actor('player', getMechaDefinition('gundam'), 'player');
    for (let i = 0; i < hz * 2; i++) stepPlayerMovement(actor, { x, z, yaw: 0, boost: false, jump: false }, 1 / hz, [], bounds);
    const distance = actor.position.length(); actor.dispose(); return distance;
  };
  expect(run(30, 0, 1)).toBeCloseTo(run(120, 0, 1), 1);
  expect(run(60, 1, 1)).toBeCloseTo(run(60, 0, 1), 5);
});
it('jump consumes energy and returns the actor to the ground', () => {
  const actor = new Actor('player', getMechaDefinition('gundam'), 'player');
  stepPlayerMovement(actor, { x: 0, z: 0, yaw: 0, boost: false, jump: true }, 1 / 60, [], bounds);
  expect(actor.position.y).toBeGreaterThan(0); expect(actor.energy).toBeLessThan(100);
  for (let i = 0; i < 120; i++) stepPlayerMovement(actor, { x: 0, z: 0, yaw: 0, boost: false, jump: false }, 1 / 60, [], bounds);
  expect(actor.position.y).toBe(0); actor.dispose();
});
it('AI never fires through a building and instead requests a navigable route', () => {
  const player = new Actor('player', getMechaDefinition('gundam'), 'player');
  const enemy = new Actor('enemy', getMechaDefinition('zaku'), 'enemy');
  player.position.set(0, 0, -30);
  const walls = [{ minX: -5, maxX: 5, minZ: -15, maxZ: -10, height: 20 }];
  const action = stepEnemy(enemy, player, 1 / 60, 0, walls, bounds);
  expect(action.fire).toBe(false); expect(enemy.aiPath.length).toBeGreaterThan(2);
  player.dispose(); enemy.dispose();
});
it('AI approaches or attacks in the gap between melee and ranged distances', () => {
  const player = new Actor('player', getMechaDefinition('gundam'), 'player');
  const enemy = new Actor('enemy', getMechaDefinition('zaku'), 'enemy');
  player.position.set(0, 0, -7.5);
  const action = stepEnemy(enemy, player, 1 / 60, 0, [], bounds);
  expect(action.fire || action.slash || enemy.position.z < 0).toBe(true);
  player.dispose(); enemy.dispose();
});
it('honors a weapon switch requested during melee recovery once the swing finishes', () => {
  const actor = new Actor('player', getMechaDefinition('gundam'), 'player');
  actor.setWeapon('melee'); actor.swing.start(); actor.setWeapon('ranged');
  expect(actor.slot).toBe('melee');
  actor.tick(1);
  expect(actor.slot).toBe('ranged'); actor.dispose();
});
