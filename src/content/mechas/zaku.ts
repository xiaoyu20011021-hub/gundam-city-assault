import { CylinderGeometry, Group, SphereGeometry } from 'three';
import { createZakuWeapons } from '../weapons/models';
import { assembleRig } from './animation';
import { GeometryResources, group, mergeArmor, part, rod } from './geometry';
import type { MechaDefinition, MechaRig, } from './types';

export function createZakuRig(isChar = false): MechaRig {
  const resources = new GeometryResources();
  const armor = resources.material(isChar ? 0xc96563 : 0x78955c);
  const light = resources.material(isChar ? 0xe38980 : 0x98b774);
  const deep = resources.material(isChar ? 0x853d42 : 0x4b6746);
  const dark = resources.material(0x263437);
  const steel = resources.material(0x55605b);
  const hose = resources.material(isChar ? 0xb89080 : 0xa6ac7c);
  const pink = resources.material(0xffadf3, 0xff32c5, 3.5);
  const root = new Group();
  root.name = isChar ? 'MS-06S Char Zaku II' : 'MS-06F Zaku II';
  const torso = group(root, 'torso', [0, 2.35, 0]);
  const body = group(torso, 'torso-armor');
  part(body, resources.box(1.55, 0.49, 1.1), dark, [0, 0.15, 0]);
  part(body, resources.box(2.26, 1.11, 1.41, 0.15), deep, [0, 1.06, 0]);
  part(body, resources.box(1.93, 0.57, 1.41), armor, [0, 1.44, -0.06]);
  part(body, resources.box(1.42, 0.58, 0.26), armor, [0, 1.17, -0.78]);
  part(body, resources.box(0.7, 0.39, 0.17), dark, [0, 0.74, -0.73]);
  part(body, resources.box(0.44, 0.2, 0.07), steel, [0, 0.75, -0.85]);
  for (const side of [-1, 1]) {
    part(body, resources.plate([[-0.41, 0.33], [0.41, 0.33], [0.57, -0.5], [-0.47, -0.5]], 0.26), armor, [side * 0.53, 0.01, -0.61], [-0.1, 0, side * -0.1]);
    part(body, resources.box(0.81, 0.94, 1.08), armor, [side * 1.02, -0.02, 0.14], [0, 0, side * -0.22]);
    part(body, resources.box(0.52, 0.09, 0.08), deep, [side * 0.53, -0.15, -0.81]);
    const points: [number, number, number][] = [[side * 0.42, 0.61, -0.75], [side * 0.93, 0.62, -0.74], [side * 1.12, 0.51, -0.32], [side * 1.03, 0.32, 0.43], [side * 0.63, 0.35, 0.63]];
    part(body, resources.tube(points, 0.105), hose);
    // Raised coupling bands make the waist power pipes read at game-camera scale.
    for (let i = 0; i < 5; i++) part(body, resources.sphere(0.125), hose, [side * (0.72 + Math.sin(i / 4 * Math.PI) * 0.35), 0.52 - i * 0.04, -0.7 + i * 0.29], [0, 0, 0], [1, 1, 0.62]);
  }
  part(body, resources.box(1.75, 0.86, 0.21), armor, [0, 0, 0.68]);
  mergeArmor(body, resources);

  const backpack = group(torso, 'backpack', [0, 1.01, 0.89]);
  const pack = group(backpack, 'backpack-armor');
  part(pack, resources.box(1.45, 1.11, 0.68), deep);
  part(pack, resources.box(0.78, 0.63, 0.19), armor, [0, 0.06, 0.42]);
  const thrusters: Group[] = [];
  for (const side of [-1, 1]) {
    part(pack, resources.cylinder(0.2, 0.3, 0.41), dark, [side * 0.47, -0.29, 0.48], [Math.PI / 2, 0, 0]);
    part(pack, resources.cylinder(0.17, 0.21, 0.04), steel, [side * 0.47, -0.29, 0.71], [Math.PI / 2, 0, 0]);
    const flame = group(backpack, 'boost-flame', [side * 0.47, -0.29, 0.74]);
    part(flame, resources.cylinder(0, 0.2, 0.83), resources.material(0xabecff, 0x49bbff, 3), [0, 0, 0.4], [Math.PI / 2, 0, 0]);
    flame.visible = false;
    thrusters.push(flame);
  }
  mergeArmor(pack, resources);

  const head = group(torso, 'head', [0, 2.09, -0.01]);
  const helmet = group(head, 'helmet-armor');
  part(helmet, resources.cylinder(0.36, 0.36, 0.29), dark, [0, -0.07, 0]);
  const dome = resources.geometry('zaku-dome', () => new SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.63));
  part(helmet, dome, light, [0, 0.28, 0.04], [0, 0, 0], [1.26, 1.19, 1.08]);
  part(helmet, resources.cylinder(1.16, 1.16, 0.39, 24), armor, [0, 0.06, 0.01], [0, 0, 0], [1, 1, 0.95]);
  const visor = resources.geometry('monoeye-visor', () => new CylinderGeometry(1.23, 1.23, 0.35, 28, 1, true, Math.PI * 0.57, Math.PI * 0.86));
  part(helmet, visor, dark, [0, 0.32, -0.01], [0, 0, 0], [1, 1, 0.92]);
  part(helmet, resources.sphere(0.155), pink, [0, 0.34, -1.171], [0, 0, 0], [1, 0.92, 0.43]);
  part(helmet, resources.cylinder(0.43, 0.43, 0.42, 12), armor, [0, -0.03, -1.055], [Math.PI / 2, 0, 0]);
  part(helmet, resources.cylinder(0.31, 0.31, 0.028, 12), deep, [0, -0.03, -1.291], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) part(helmet, resources.box(0.43, 0.055, 0.035), dark, [0, -0.14 + i * 0.1, -1.315]);
  for (const side of [-1, 1]) {
    part(helmet, resources.box(0.38, 0.65, 0.49), armor, [side * 1.02, -0.03, -0.12], [0, 0, side * 0.16]);
    part(helmet, resources.cylinder(0.17, 0.17, 0.19), deep, [side * 1.17, 0.12, -0.03], [0, 0, Math.PI / 2]);
    const points: [number, number, number][] = [[side * 0.37, -0.13, -1.03], [side * 0.8, -0.24, -0.98], [side * 1.13, -0.19, -0.53], [side * 1.14, -0.03, 0.09], [side * 0.86, 0.07, 0.55]];
    part(helmet, resources.tube(points, 0.105), hose);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const angle = -Math.PI / 2 + t * Math.PI * 0.84;
      part(helmet, resources.sphere(0.128), hose, [side * (0.47 + Math.cos(angle) * 0.67), -0.15 + t * 0.16, -0.35 + Math.sin(angle) * 0.72], [0, 0, 0], [0.75, 1, 1]);
    }
  }
  part(helmet, resources.box(0.1, 0.74, 0.15), armor, [0, 1.02, 0.17]);
  part(helmet, resources.box(0.36, 0.16, 0.16), deep, [0, 0.51, -1.08]);
  mergeArmor(helmet, resources);
  if (isChar) {
    const horn = group(head, 'commander-horn', [0, 1.17, -0.38]);
    part(horn, resources.plate([[-0.2, -0.13], [0.2, -0.13], [0.09, 0.62], [0, 0.99], [-0.06, 0.64]], 0.23), deep, [0, 0, 0], [-0.15, 0, 0]);
    part(horn, resources.plate([[-0.095, 0.08], [0.095, 0.08], [0.042, 0.59], [0, 0.8]], 0.02, 0.012), light, [0, 0, -0.15], [-0.15, 0, 0]);
    mergeArmor(horn, resources);
  }

  const arms: Group[] = [];
  const legs: Group[] = [];
  for (const side of [-1, 1]) {
    const arm = group(torso, side < 0 ? 'left-arm' : 'right-arm', [side * 1.53, 1.07, 0]);
    const shell = group(arm, 'arm-armor');
    part(shell, resources.cylinder(0.28, 0.28, 0.64), dark, [0, -0.37, 0]);
    part(shell, resources.box(0.66, 0.77, 0.73, 0.12), armor, [0, -0.79, 0]);
    part(shell, resources.box(0.47, 0.15, 0.07), deep, [0, -0.64, -0.41]);
    part(shell, resources.box(0.48, 0.35, 0.48), dark, [0, -1.23, -0.08]);
    for (let i = 0; i < 3; i++) part(shell, resources.box(0.08, 0.11, 0.035), steel, [-0.15 + i * 0.15, -1.19, -0.34]);
    if (side < 0) {
      part(shell, resources.sphere(0.65), light, [-0.13, 0.06, 0], [0, 0, 0], [1.1, 0.77, 0.95]);
      // Zaku's left rounded pauldron carries three radial spikes.
      rod(shell, resources, [-0.51, 0.29, 0], [-1.11, 0.63, 0], 0.19, light, 0);
      rod(shell, resources, [-0.23, 0.49, -0.07], [-0.31, 1.06, -0.12], 0.17, light, 0);
      rod(shell, resources, [-0.41, 0.07, -0.43], [-0.78, 0.17, -0.94], 0.16, light, 0);
    } else {
      part(shell, resources.box(0.75, 0.69, 0.88), armor, [0.07, 0.06, 0]);
      part(shell, resources.box(0.23, 1.77, 1.22, 0.07), armor, [0.59, -0.48, -0.07]);
      part(shell, resources.box(0.08, 1.52, 0.97), deep, [0.75, -0.48, -0.07]);
      part(shell, resources.box(0.08, 0.16, 0.56), light, [0.8, 0.07, -0.06]);
      part(shell, resources.box(0.08, 0.16, 0.56), light, [0.8, -0.91, -0.06]);
    }
    mergeArmor(shell, resources);
    arms.push(arm);

    const leg = group(root, side < 0 ? 'left-leg' : 'right-leg', [side * 0.6, 1.95, 0]);
    const boot = group(leg, 'leg-armor');
    part(boot, resources.cylinder(0.36, 0.41, 0.65), armor, [0, -0.27, 0]);
    part(boot, resources.cylinder(0.26, 0.26, 0.51), dark, [0, -0.63, 0], [0, 0, Math.PI / 2]);
    part(boot, resources.box(0.81, 0.9, 0.91, 0.12), light, [0, -1.02, 0]);
    part(boot, resources.box(0.62, 0.3, 0.2), armor, [0, -0.65, -0.54]);
    part(boot, resources.box(1.11, 0.6, 1.58, 0.1), deep, [0, -1.65, -0.23]);
    part(boot, resources.box(0.74, 0.29, 0.64), armor, [0, -1.36, 0]);
    part(boot, resources.box(0.65, 0.1, 0.08), deep, [0, -0.88, -0.53]);
    for (const pipeSide of [-1, 1]) {
      part(boot, resources.tube([[pipeSide * 0.38, -0.49, 0.23], [pipeSide * 0.49, -0.82, 0.22], [pipeSide * 0.46, -1.17, 0.15]], 0.07), hose);
    }
    mergeArmor(boot, resources);
    legs.push(leg);
  }
  const weapons = createZakuWeapons(arms[1], resources);
  return assembleRig({ root, resources, weapons, thrusters, heavy: true,
    joints: { torso, head, leftArm: arms[0], rightArm: arms[1], leftLeg: legs[0], rightLeg: legs[1] },
  });
}

export const zakuDefinition: MechaDefinition = {
  id: 'zaku', name: 'MS-06F 扎古 II', maxHealth: 90, speed: 5.4, boostSpeed: 11,
  radius: 1.1, height: 5.95, rangedWeapon: 'zaku-machinegun', meleeWeapon: 'heat-hawk', createRig: () => createZakuRig(),
};

export const charZakuDefinition: MechaDefinition = {
  id: 'char-zaku', name: 'MS-06S 夏亚专用扎古 II', maxHealth: 300, speed: 8.2, boostSpeed: 20,
  radius: 1.1, height: 6.7, rangedWeapon: 'zaku-machinegun', meleeWeapon: 'heat-hawk', createRig: () => createZakuRig(true),
};
