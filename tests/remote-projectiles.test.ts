import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { ProjectileSystem } from '../src/gameplay/projectiles';
import { WEAPON_DEFINITIONS } from '../src/content/weapons';

it('routes the nearest remote-unit hit without also damaging the actor behind it', () => {
  const owner = new Actor('enemy', getMechaDefinition('zaku'), 'enemy');
  const player = new Actor('player', getMechaDefinition('gundam'), 'player');
  player.position.z = -8;
  let health = 48, actorHits = 0;
  const target = { id: 'funnel', team: 'player', kind: 'remote-unit' as const,
    isAlive: () => health > 0, hitBody: () => ({ id: 'funnel', x: 0, y: 2.5, z: -4, radius: 0.5, height: 1 }) };
  const shots = new ProjectileSystem();
  shots.fire(owner, new Vector3(0, 3, 0), new Vector3(0, 0, -1), WEAPON_DEFINITIONS['zaku-machinegun']);
  shots.update(0.1, [player], [], () => actorHits++, [target], (_p, damage, hit) => {
    expect(hit.id).toBe('funnel'); health -= damage;
  });
  expect(health).toBe(36); expect(actorHits).toBe(0);
  shots.dispose(); owner.dispose(); player.dispose();
});

it('removes a destroyed remote target from subsequent shots in the same simulation step', () => {
  const owner = new Actor('enemy', getMechaDefinition('zaku'), 'enemy');
  const player = new Actor('player', getMechaDefinition('gundam'), 'player'); player.position.z = -8;
  let health = 12, actorHits = 0;
  const target = { id: 'funnel', team: 'player', kind: 'remote-unit' as const,
    isAlive: () => health > 0, hitBody: () => ({ id: 'funnel', x: 0, y: 2.5, z: -4, radius: 0.5, height: 1 }) };
  const shots = new ProjectileSystem();
  for (let i = 0; i < 2; i++) shots.fire(owner, new Vector3(0, 3, 0), new Vector3(0, 0, -1), WEAPON_DEFINITIONS['zaku-machinegun']);
  shots.update(0.1, [player], [], () => actorHits++, [target], (_p, damage) => { health -= damage; });
  expect(health).toBe(0); expect(actorHits).toBe(1);
  shots.dispose(); owner.dispose(); player.dispose();
});

it('reports a full projectile pool and retains an optional source-unit identity', () => {
  const owner = new Actor('player', getMechaDefinition('gundam'), 'player'), shots = new ProjectileSystem();
  for (let i = 0; i < 160; i++) expect(shots.fire(owner, new Vector3(), new Vector3(0, 0, -1), WEAPON_DEFINITIONS['beam-rifle'], 'funnel-1')).toBe(true);
  expect(shots.fire(owner, new Vector3(), new Vector3(0, 0, -1), WEAPON_DEFINITIONS['beam-rifle'])).toBe(false);
  expect(shots.snapshot()[0].sourceUnitId).toBe('funnel-1');
  shots.clear(); expect(shots.activeCount).toBe(0);
  shots.dispose(); owner.dispose();
});

it('blocks remote-unit shots with cover and ignores friendly remote targets', () => {
  const owner = new Actor('player', getMechaDefinition('gundam'), 'player');
  const target = { id: 'friendly', team: 'player', kind: 'remote-unit' as const,
    isAlive: () => true, hitBody: () => ({ id: 'friendly', x: 0, y: 2.5, z: -1, radius: 0.5, height: 1 }) };
  const shots = new ProjectileSystem(); let remoteHits = 0, walls = 0;
  shots.fire(owner, new Vector3(0, 3, 0), new Vector3(0, 0, -1), WEAPON_DEFINITIONS['beam-rifle']);
  shots.update(0.1, [], [{ minX: -1, maxX: 1, minZ: -4, maxZ: -3, height: 10 }], () => walls++, [target], () => remoteHits++);
  expect(walls).toBe(1); expect(remoteHits).toBe(0);
  shots.dispose(); owner.dispose();
});
