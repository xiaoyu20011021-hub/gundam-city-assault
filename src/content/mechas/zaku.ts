import { CylinderGeometry, Group, SphereGeometry } from 'three';
import { createZakuWeapons } from '../weapons/models';
import { assembleRig } from './animation';
import { GeometryResources, group, mergeArmor, part, powerPipe, rod } from './geometry';
import type { MechaDefinition, MechaRig, } from './types';

export function createZakuRig(isChar = false): MechaRig {
  const resources = new GeometryResources();
  const armor = resources.material(isChar ? 0xc36964 : 0x718967);
  const light = resources.material(isChar ? 0xde8c7f : 0x94aa7d);
  const deep = resources.material(isChar ? 0x763e46 : 0x3e5645);
  const dark = resources.material(0x263437);
  const steel = resources.material(0x55605b);
  const hose = resources.material(isChar ? 0xd48a7c : 0x9bae87);
  const pink = resources.material(0xff9acb, 0xff3184, 1.5);
  const root = new Group();
  root.name = isChar ? 'MS-06S Char Zaku II' : 'MS-06F Zaku II';
  const torso = group(root, 'torso', [0, 2.35, 0]);
  const body = group(torso, 'torso-armor');
  part(body, resources.box(1.55, 0.49, 1.1), dark, [0, 0.15, 0]);
  part(body, resources.armor([[-0.55, 0.86, 0.55, 0], [0.24, 1.14, 0.73, 0], [0.56, 0.99, 0.6, 0]], 0.42), deep, [0, 1.06, 0]);
  part(body, resources.box(1.93, 0.57, 1.41), armor, [0, 1.44, -0.06]);
  part(body, resources.box(0.84, 0.93, 0.26), dark, [0, 1.13, -0.7]);
  for (const side of [-1, 1]) {
    part(body, resources.plate([[-0.2, 0.48], [0.2, 0.42], [0.24, -0.41], [-0.22, -0.45]], 0.18), armor, [side * 0.7, 1.12, -0.74]);
    for (let i = 0; i < 3; i++) part(body, resources.box(0.21, 0.035, 0.025), deep, [side * 0.7, 1.05 + i * 0.09, -0.87]);
  }
  part(body, resources.box(0.7, 0.39, 0.17), dark, [0, 0.74, -0.73]);
  part(body, resources.box(0.44, 0.2, 0.07), steel, [0, 0.75, -0.85]);
  for (const side of [-1, 1]) {
    part(body, resources.plate([[-0.41, 0.33], [0.41, 0.33], [0.57, -0.5], [-0.47, -0.5]], 0.26), armor, [side * 0.53, 0.01, -0.61], [-0.1, 0, side * -0.1]);
    part(body, resources.box(0.81, 0.94, 1.08), armor, [side * 1.02, -0.02, 0.14], [0, 0, side * -0.22]);
    part(body, resources.box(0.52, 0.09, 0.08), deep, [side * 0.53, -0.15, -0.81]);
    const points: [number, number, number][] = [[side * 0.42, 0.61, -0.75], [side * 0.93, 0.62, -0.74], [side * 1.12, 0.51, -0.32], [side * 1.03, 0.32, 0.43], [side * 0.63, 0.35, 0.63]];
    powerPipe(body, resources, points, 0.125, hose, dark, 13);
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
  const dome = resources.geometry('zaku-dome', () => new SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.48));
  part(helmet, dome, light, [0, 0.44, 0.04], [0, 0, 0], [1.26, 1.19, 1.08]);
  part(helmet, resources.cylinder(1.08, 1.17, 0.42, 24), armor, [0, -0.08, 0.01], [0, 0, 0], [1, 1, 0.95]);
  const visor = resources.geometry('monoeye-visor', () => new CylinderGeometry(1.21, 1.21, 0.4, 32));
  part(helmet, visor, dark, [0, 0.31, 0.01], [0, 0, 0], [1, 1, 0.92]);
  part(helmet, resources.cylinder(1.26, 1.25, 0.11, 32), armor, [0, 0.54, 0.04], [0, 0, 0], [1, 1, 0.89]);
  part(helmet, resources.cylinder(0.185, 0.185, 0.07, 20), steel, [0, 0.34, -1.13], [Math.PI / 2, 0, 0]);
  part(helmet, resources.sphere(0.15), pink, [0, 0.35, -1.19], [0, 0, 0], [1, 0.92, 0.43]);
  part(helmet, resources.plate([[-0.44, 0.14], [0.44, 0.14], [0.3, -0.37], [-0.3, -0.37]], 0.42, 0.045), armor, [0, -0.01, -1.07]);
  part(helmet, resources.box(0.43, 0.29, 0.04), dark, [0, -0.18, -1.327]);
  for (let i = 0; i < 3; i++) part(helmet, resources.box(0.36, 0.035, 0.035), steel, [0, -0.27 + i * 0.09, -1.36]);
  for (const side of [-1, 1]) {
    part(helmet, resources.box(0.38, 0.65, 0.49), armor, [side * 1.02, -0.03, -0.12], [0, 0, side * 0.16]);
    part(helmet, resources.cylinder(0.17, 0.17, 0.19), deep, [side * 1.17, 0.12, -0.03], [0, 0, Math.PI / 2]);
    const points: [number, number, number][] = [[side * 0.37, -0.13, -1.03], [side * 0.8, -0.24, -0.98], [side * 1.13, -0.19, -0.53], [side * 1.14, -0.03, 0.09], [side * 0.86, 0.07, 0.55]];
    powerPipe(helmet, resources, points, 0.128, hose, dark, 15);
  }
  part(helmet, resources.box(0.13, 0.055, 0.8), armor, [0, 1.63, 0.12]);
  part(helmet, resources.box(0.36, 0.16, 0.16), deep, [0, 0.51, -1.08]);
  mergeArmor(helmet, resources);
  helmet.scale.set(1.07, 1.03, 1.07);
  if (isChar) {
    const horn = group(head, 'commander-horn', [0, 1.33, -0.38]);
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
    part(shell, resources.armor([[-0.38, 0.3, 0.34, 0], [0.08, 0.4, 0.43, 0], [0.38, 0.29, 0.33, 0]], 0.5), armor, [0, -0.79, 0]);
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
    part(boot, resources.sphere(1), light, [0, -1.0, 0.05], [0, 0, 0], [0.48, 0.59, 0.52]);
    part(boot, resources.box(0.62, 0.3, 0.2), armor, [0, -0.65, -0.54]);
    part(boot, resources.armor([[-0.3, 0.56, 0.79, -0.02], [-0.04, 0.58, 0.8, -0.01], [0.3, 0.42, 0.59, 0.08]], 0.33), deep, [0, -1.65, -0.23]);
    part(boot, resources.box(0.74, 0.29, 0.64), armor, [0, -1.36, 0]);
    part(boot, resources.box(0.65, 0.1, 0.08), deep, [0, -0.88, -0.53]);
    for (const pipeSide of [-1, 1]) {
      powerPipe(boot, resources, [[pipeSide * 0.38, -0.49, 0.23], [pipeSide * 0.53, -0.82, 0.27], [pipeSide * 0.46, -1.17, 0.15]], 0.09, hose, dark, 7);
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
  flightSpeed: 10, flightBoostSpeed: 20,
  radius: 1.1, height: 5.95, rangedWeapon: 'zaku-machinegun', meleeWeapon: 'heat-hawk', createRig: () => createZakuRig(),
};

export const charZakuDefinition: MechaDefinition = {
  id: 'char-zaku', name: 'MS-06S 夏亚专用扎古 II', maxHealth: 300, speed: 8.2, boostSpeed: 20,
  flightSpeed: 15, flightBoostSpeed: 32,
  radius: 1.1, height: 6.7, rangedWeapon: 'zaku-machinegun', meleeWeapon: 'heat-hawk', createRig: () => createZakuRig(true),
};
