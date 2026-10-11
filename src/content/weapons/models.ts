import { Group, Object3D } from 'three';
import { GeometryResources, group, mergeArmor, part, rod } from '../mechas/geometry';

export interface WeaponModels {
  ranged: Group;
  melee: Group;
  muzzle: Object3D;
  bladeTip: Object3D;
}

function forwardSocket(parent: Object3D, name: string, x: number, y: number, z: number): Object3D {
  const socket = new Object3D();
  socket.name = name;
  socket.position.set(x, y, z);
  socket.rotation.y = Math.PI;
  parent.add(socket);
  return socket;
}

export function createGundamWeapons(parent: Object3D, resources: GeometryResources): WeaponModels {
  const dark = resources.material(0x263246);
  const metal = resources.material(0x758396);
  const yellow = resources.material(0xffc845);
  const pink = resources.material(0xffa4ed, 0xff35cf, 3.6);
  const white = resources.material(0xeaf2fa);
  const ranged = group(parent, 'ranged-weapon', [0, -1.08, -0.25]);
  const armor = group(ranged, 'rifle-body');
  part(armor, resources.box(0.44, 0.51, 1.46), dark, [0, 0.18, -0.45]);
  part(armor, resources.box(0.29, 0.3, 0.42), metal, [0, 0.2, 0.43]);
  part(armor, resources.box(0.2, 0.47, 0.27), dark, [0, -0.21, -0.13], [-0.2, 0, 0]);
  part(armor, resources.box(0.14, 0.17, 0.48), metal, [0, 0.48, -0.46]);
  part(armor, resources.cylinder(0.155, 0.18, 0.82), dark, [0, 0.16, -1.53], [Math.PI / 2, 0, 0]);
  part(armor, resources.cylinder(0.2, 0.2, 0.12), metal, [0, 0.16, -1.98], [Math.PI / 2, 0, 0]);
  part(armor, resources.cylinder(0.1, 0.1, 0.025), yellow, [0, 0.16, -2.06], [Math.PI / 2, 0, 0]);
  part(armor, resources.cylinder(0.115, 0.115, 0.17), yellow, [0, 0.57, -0.6], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) part(armor, resources.box(0.48, 0.045, 0.1), metal, [0, 0.24 - i * 0.1, -0.78]);
  mergeArmor(armor, resources);
  const muzzle = forwardSocket(ranged, 'muzzle', 0, 0.16, -2.1);

  const melee = group(parent, 'melee-weapon', [0, -1.1, -0.16]);
  const saber = group(melee, 'beam-saber');
  rod(saber, resources, [0, -0.2, 0.05], [0, 0.24, -0.09], 0.12, white);
  rod(saber, resources, [0, 0.17, -0.07], [0, 0.26, -0.1], 0.17, metal);
  rod(saber, resources, [0, 0.25, -0.1], [0, 2.35, -0.78], 0.095, pink, 0.035);
  part(saber, resources.sphere(0.07), pink, [0, 2.35, -0.78]);
  mergeArmor(saber, resources);
  const bladeTip = forwardSocket(melee, 'blade-tip', 0, 2.35, -0.78);
  melee.visible = false;
  return { ranged, melee, muzzle, bladeTip };
}

export function createZakuWeapons(parent: Object3D, resources: GeometryResources): WeaponModels {
  const dark = resources.material(0x27313b);
  const metal = resources.material(0x65717a);
  const orange = resources.material(0xff9b36, 0xff510b, 1.6);
  const ranged = group(parent, 'ranged-weapon', [0, -1.05, -0.26]);
  const armor = group(ranged, 'machinegun-body');
  part(armor, resources.box(0.41, 0.4, 1.08), dark, [0, 0.15, -0.36]);
  part(armor, resources.box(0.27, 0.46, 0.3), dark, [0, -0.19, -0.08], [-0.22, 0, 0]);
  part(armor, resources.box(0.26, 0.35, 0.36), metal, [0, 0.12, 0.27]);
  part(armor, resources.cylinder(0.46, 0.46, 0.24, 16), dark, [0, 0.51, -0.35]);
  part(armor, resources.cylinder(0.35, 0.35, 0.27, 16), metal, [0, 0.53, -0.35]);
  part(armor, resources.cylinder(0.13, 0.18, 1.02), metal, [0, 0.16, -1.31], [Math.PI / 2, 0, 0]);
  part(armor, resources.cylinder(0.18, 0.18, 0.22), dark, [0, 0.16, -1.91], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) part(armor, resources.cylinder(0.15, 0.15, 0.07), dark, [0, 0.16, -1.08 - i * 0.17], [Math.PI / 2, 0, 0]);
  part(armor, resources.box(0.13, 0.22, 0.25), dark, [0, 0.48, -1.04]);
  mergeArmor(armor, resources);
  const muzzle = forwardSocket(ranged, 'muzzle', 0, 0.16, -2.04);

  const melee = group(parent, 'melee-weapon', [0, -1.08, -0.15]);
  const hawk = group(melee, 'heat-hawk');
  rod(hawk, resources, [0, -0.28, 0], [0, 1.27, -0.12], 0.09, metal);
  for (let i = 0; i < 3; i++) part(hawk, resources.cylinder(0.12, 0.12, 0.08), dark, [0, -0.2 + i * 0.16, 0]);
  part(hawk, resources.plate([[-0.08, 0.91], [0.33, 1.48], [0.95, 1.47], [1.16, 1.09], [0.59, 0.74], [0.14, 0.73]], 0.14), dark, [0, 0, -0.12]);
  // Extend the heated edge beyond both faces of the beveled axe body.
  part(hawk, resources.plate([[0.85, 1.45], [1.16, 1.09], [0.59, 0.74], [0.51, 0.9]], 0.22, 0.018), orange, [0, 0, -0.12]);
  mergeArmor(hawk, resources);
  const bladeTip = forwardSocket(melee, 'blade-tip', 1.16, 1.09, -0.12);
  melee.visible = false;
  return { ranged, melee, muzzle, bladeTip };
}
