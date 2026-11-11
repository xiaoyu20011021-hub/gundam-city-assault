import { expect, it } from 'vitest';
import { Mesh } from 'three';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { ProjectileSystem } from '../src/gameplay/projectiles';
import { RemoteWeaponRuntime } from '../src/gameplay/remote-weapons/adapter';

const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };

it('releases removed view resources when the same owner is attached again', () => {
  const player = new Actor('player', getMechaDefinition('nu-gundam'), 'player'); player.updateVisual(0, false);
  const shots = new ProjectileSystem(), remote = new RemoteWeaponRuntime(shots); remote.attach(player);
  let released = 0;
  const geometries = new Set<object>();
  remote.root.traverse(object => { if (object instanceof Mesh) geometries.add(object.geometry); });
  for (const geometry of geometries) (geometry as { addEventListener(type: string, callback: () => void): void }).addEventListener('dispose', () => released++);
  remote.attach(player);
  expect(released).toBe(geometries.size);
  expect(remote.root.children).toHaveLength(6);
  remote.dispose(); shots.dispose(); player.dispose();
});

it('attaches six world-space units, hides only gallery copies, and keeps damage across return', () => {
  const player = new Actor('player', getMechaDefinition('nu-gundam'), 'player');
  const enemy = new Actor('enemy', getMechaDefinition('zaku'), 'enemy'); enemy.position.z = -30;
  player.updateVisual(0, false); enemy.updateVisual(0, false);
  const shots = new ProjectileSystem(), remote = new RemoteWeaponRuntime(shots);
  remote.attach(player);
  expect(remote.snapshot()).toHaveLength(6);
  expect(remote.root.children).toHaveLength(6);
  Object.values(player.rig.stowedRemoteModels!).forEach(model => expect(model.visible).toBe(false));
  for (let i = 0; i < 120; i++) remote.step(1 / 60, [player, enemy], [], bounds);
  expect(remote.targets().length).toBeGreaterThan(0);
  const unit = remote.snapshot()[0]; remote.applyDamage(unit.id, 12);
  expect(remote.snapshot()[0].health).toBe(36);
  enemy.dead = true;
  for (let i = 0; i < 1000; i++) remote.step(1 / 60, [player, enemy], [], bounds);
  expect(remote.snapshot()[0].health).toBe(36);
  expect(remote.snapshot()[0].state).toBe('docked');
  expect(remote.drainEvents().filter(event => event.type === 'docked')).toHaveLength(6);
  player.rig.root.visible = false;
  expect(remote.root.visible).toBe(true);
  remote.dispose(); expect(remote.root.children).toHaveLength(0);
  shots.dispose(); player.dispose(); enemy.dispose();
});

it('removes a destroyed unit from collision immediately and never increments mission kills', () => {
  const player = new Actor('player', getMechaDefinition('nu-gundam'), 'player');
  const enemy = new Actor('enemy', getMechaDefinition('zaku'), 'enemy'); enemy.position.z = -30;
  player.updateVisual(0, false); enemy.updateVisual(0, false);
  const shots = new ProjectileSystem(), remote = new RemoteWeaponRuntime(shots); remote.attach(player);
  for (let i = 0; i < 60; i++) remote.step(1 / 60, [player, enemy], [], bounds);
  const target = remote.targets()[0]; expect(target).toBeDefined();
  remote.applyDamage(target.id, 999);
  expect(target.isAlive()).toBe(false);
  expect(remote.targets().some(t => t.id === target.id)).toBe(false);
  expect(remote.drainEvents().filter(e => e.type === 'destroyed')).toHaveLength(1);
  expect(remote.drainEvents()).toHaveLength(0);
  remote.step(60, [player, enemy], [], bounds);
  expect(remote.snapshot().find(t => t.id === target.id)?.state).toBe('destroyed');
  player.dead = true; remote.step(1 / 60, [player, enemy], [], bounds);
  expect(remote.snapshot()).toHaveLength(0);
  expect(remote.root.children).toHaveLength(0);
  remote.dispose(); remote.dispose(); shots.dispose(); player.dispose(); enemy.dispose();
});
