import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { createZakuWeapons } from '../src/content/weapons/models';
import { FirstPersonWeapon } from '../src/gameplay/first-person';

it('accepts an independent weapon factory and works without an alternate ranged mesh', () => {
  const definition = { ...getMechaDefinition('gundam'), alternateRangedWeapon: undefined, weaponModels: createZakuWeapons };
  const actor = new Actor('player', definition, 'player'), camera = new PerspectiveCamera();
  const view = new FirstPersonWeapon(definition);
  expect(view.scene.getObjectByName('heat-hawk')).toBeDefined();
  expect(view.scene.getObjectByName('alternate-ranged-weapon')).toBeUndefined();
  for (const slot of ['ranged', 'melee'] as const) {
    actor.setWeapon(slot); view.update(actor, camera, 1 / 60, 1, false);
    expect(view.scene.getObjectByName('melee-weapon')!.visible).toBe(slot === 'melee');
    expect(view.muzzleWorld(camera).toArray().every(Number.isFinite)).toBe(true);
  }
  view.dispose(); actor.dispose();
});
