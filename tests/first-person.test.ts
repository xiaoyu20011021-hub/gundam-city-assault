import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { FirstPersonWeapon, safeFirstPersonOrigin } from '../src/gameplay/first-person';
import { ProjectileSystem } from '../src/gameplay/projectiles';
import { WEAPON_DEFINITIONS } from '../src/content/weapons';

it('synchronizes each pilot and weapon without mutating combat state', () => {
  for (const pilot of ['gundam', 'gm']) {
    const actor = new Actor('player', getMechaDefinition(pilot), 'player');
    const view = new FirstPersonWeapon(pilot === 'gm');
    const camera = new PerspectiveCamera(72, 16 / 9, 0.15, 1500);
    actor.rifle.fire(); actor.alternateRangedState!.fire();
    const state = [actor.rifle.heat, actor.rifle.cooldown, actor.alternateRangedState!.ammo];
    for (const slot of ['ranged', 'alternate-ranged', 'melee'] as const) {
      actor.setWeapon(slot);
      view.update(actor, camera, 1 / 60, 1, false);
      expect(view.scene.getObjectByName('ranged-weapon')!.visible).toBe(slot === 'ranged');
      expect(view.scene.getObjectByName('alternate-ranged-weapon')!.visible).toBe(slot === 'alternate-ranged');
      expect(view.scene.getObjectByName('melee-weapon')!.visible).toBe(slot === 'melee');
      expect([actor.rifle.heat, actor.rifle.cooldown, actor.alternateRangedState!.ammo]).toEqual(state);
    }
    view.dispose(); actor.dispose();
    expect(view.scene.children).toHaveLength(0);
  }
});

it('maps the display muzzle to the same screen position in the world camera', () => {
  const actor = new Actor('player', getMechaDefinition('gundam'), 'player');
  const view = new FirstPersonWeapon(false), camera = new PerspectiveCamera(50, 1.6, 0.15, 1500);
  camera.position.set(20, 30, 40); camera.rotation.set(-0.6, 1.2, 0); camera.updateMatrixWorld(true);
  view.update(actor, camera, 1 / 60, 0, true);
  const muzzle = view.muzzleWorld(camera).project(camera);
  const display = view.scene.getObjectByName('muzzle')!.getWorldPosition(new Vector3()).project(view.camera);
  expect(muzzle.x).toBeCloseTo(display.x, 6); expect(muzzle.y).toBeCloseTo(display.y, 6);
  view.dispose(); actor.dispose();
});

it('pulls a blocked muzzle back to the eye so the projectile hits the near wall', () => {
  const eye = new Vector3(0, 5, 0), muzzle = new Vector3(0.5, 4.8, -3), target = new Vector3(0, 5, -20);
  const walls = [{ minX: -2, maxX: 2, minZ: -2, maxZ: -1, height: 12 }];
  const origin = safeFirstPersonOrigin(eye, muzzle, target, walls, []);
  expect(origin.toArray()).toEqual(eye.toArray());
  const actor = new Actor('player', getMechaDefinition('gundam'), 'player');
  const projectiles = new ProjectileSystem();
  projectiles.fire(actor, origin, target.clone().sub(origin), WEAPON_DEFINITIONS['beam-rifle']);
  const impacts: Vector3[] = [];
  projectiles.update(0.1, [], walls, position => impacts.push(position));
  expect(impacts).toHaveLength(1); expect(impacts[0].z).toBeCloseTo(-1);
  expect(projectiles.activeCount).toBe(0);
  projectiles.dispose(); actor.dispose();
});

it('uses the eye for close targets and bodies between the eye and muzzle', () => {
  const eye = new Vector3(0, 5, 0), muzzle = new Vector3(0.5, 4.8, -3);
  expect(safeFirstPersonOrigin(eye, muzzle, new Vector3(0, 5, -1), [], []).toArray()).toEqual(eye.toArray());
  const target = new Vector3(0, 5, -20);
  const bodies = [{ id: 'enemy', x: 0, y: 0, z: -1.5, height: 7, radius: 1 }];
  expect(safeFirstPersonOrigin(eye, muzzle, target, [], bodies).toArray()).toEqual(eye.toArray());
  expect(safeFirstPersonOrigin(eye, muzzle, target, [], []).toArray()).toEqual(muzzle.toArray());
});
