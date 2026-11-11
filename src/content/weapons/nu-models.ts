import { Object3D } from 'three';
import { GeometryResources, group, mergeArmor, part, rod } from '../mechas/geometry';
import type { WeaponModels } from './models';

/** Third- and first-person views use this same RX-93 equipment factory. */
export function createNuWeapons(parent: Object3D, resources: GeometryResources): WeaponModels {
  const navy = resources.material(0x202b3e);
  const white = resources.material(0xf0f2eb);
  const gray = resources.material(0x85949e);
  const gold = resources.material(0xeebc36);
  const pink = resources.material(0xffb5ea, 0xff42cf, 3.4);
  const ranged = group(parent, 'ranged-weapon', [0, -1.1, -0.25]);
  const body = group(ranged, 'nu-rifle-body');
  // Nu's elongated receiver, underslung energy magazine, and slim white barrel shroud.
  part(body, resources.box(0.4, 0.46, 1.36), navy, [0, 0.18, -0.46]);
  part(body, resources.armor([[-0.2, 0.21, 0.26, 0], [0.25, 0.21, 0.3, 0]], 0.35), navy, [0, 0.18, 0.38]);
  part(body, resources.box(0.22, 0.44, 0.25), gray, [0, -0.2, -0.06], [-0.2, 0, 0]);
  part(body, resources.box(0.28, 0.5, 0.5), navy, [0, -0.12, -0.77]);
  part(body, resources.box(0.28, 0.28, 1.2), white, [0, 0.18, -1.59]);
  part(body, resources.box(0.18, 0.17, 1.05), gray, [0, 0.17, -1.73]);
  part(body, resources.cylinder(0.105, 0.105, 0.41), navy, [0, 0.18, -2.36], [Math.PI / 2, 0, 0]);
  part(body, resources.cylinder(0.13, 0.13, 0.12), gray, [0, 0.18, -2.58], [Math.PI / 2, 0, 0]);
  part(body, resources.cylinder(0.075, 0.075, 0.025), gold, [0, 0.18, -2.66], [Math.PI / 2, 0, 0]);
  part(body, resources.box(0.21, 0.2, 0.38), navy, [0, 0.5, -0.58]);
  part(body, resources.box(0.15, 0.12, 0.045), gold, [0, 0.5, -0.795]);
  part(body, resources.box(0.23, 0.09, 0.57), white, [0, 0.45, -1.35]);
  for (let i = 0; i < 3; i++) part(body, resources.box(0.43, 0.035, 0.18), gray, [0, 0.22 - i * 0.1, -0.39]);
  mergeArmor(body, resources);
  const muzzle = new Object3D();
  muzzle.name = 'muzzle'; muzzle.position.set(0, 0.18, -2.7); muzzle.rotation.y = Math.PI;
  ranged.add(muzzle);

  const melee = group(parent, 'melee-weapon', [0, -1.1, -0.16]);
  const saber = group(melee, 'nu-beam-saber');
  rod(saber, resources, [0, -0.23, 0.04], [0, 0.3, -0.08], 0.115, white);
  part(saber, resources.box(0.35, 0.12, 0.28), navy, [0, 0.21, -0.06]);
  part(saber, resources.box(0.12, 0.17, 0.1), gold, [0, 0.03, -0.12]);
  rod(saber, resources, [0, 0.32, -0.09], [0, 2.56, -0.76], 0.105, pink, 0.025);
  part(saber, resources.sphere(0.045), pink, [0, 2.56, -0.76]);
  mergeArmor(saber, resources);
  const bladeTip = new Object3D();
  bladeTip.name = 'blade-tip'; bladeTip.position.set(0, 2.56, -0.76); bladeTip.rotation.y = Math.PI;
  melee.add(bladeTip);
  melee.visible = false;
  return { ranged, melee, muzzle, bladeTip };
}
