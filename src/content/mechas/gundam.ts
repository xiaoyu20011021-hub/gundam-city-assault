import { Group } from 'three';
import { createGundamWeapons } from '../weapons/models';
import { assembleRig } from './animation';
import { createFederationHead } from './federation-heads';
import { GeometryResources, group, mergeArmor, part, rod } from './geometry';
import type { MechaDefinition, MechaRig } from './types';

export function createGundamRig(): MechaRig { return createFederationRig(false); }

export function createFederationRig(gm: boolean): MechaRig {
  const resources = new GeometryResources();
  const white = resources.material(gm ? 0xd5e5dc : 0xf0f2ed);
  const pale = resources.material(gm ? 0x9ebbb3 : 0xaebcc7);
  const dark = resources.material(0x263447);
  const blue = resources.material(gm ? 0xc84348 : 0x2051a3);
  const red = resources.material(0xc7313e);
  const yellow = resources.material(0xffce49);
  const root = new Group();
  root.name = gm ? 'RGM-79 GM' : 'RX-78-2';
  const torso = group(root, 'torso', [0, 2.35, 0]);
  const body = group(torso, 'torso-armor');
  part(body, resources.box(1.7, 0.44, 1.13), dark, [0, 0.1, 0]);
  part(body, resources.box(0.86, 0.52, 0.41), gm ? white : red, [0, 0.12, -0.63]);
  if (!gm) part(body, resources.box(0.37, 0.25, 0.14), yellow, [0, 0.12, -0.88]);
  part(body, resources.armor([[-0.56, 0.88, 0.56, 0], [0.2, 1.16, 0.7, 0], [0.56, 1.07, 0.61, 0]], 0.3), blue, [0, 1.11, 0]);
  part(body, resources.box(1.88, 0.25, 1.2), blue, [0, 1.68, 0.02]);
  part(body, resources.box(0.82, 0.48, 0.25), red, [0, 0.67, -0.67]);
  if (!gm) {
    part(body, resources.box(0.46, 0.44, 0.3), dark, [0, 1.44, -0.73]);
    part(body, resources.box(0.38, 0.34, 0.13), red, [0, 1.48, -0.9]);
  }
  part(body, resources.plate([[-0.5, 0.12], [0.5, 0.12], [0.34, -0.12], [-0.34, -0.12]], 0.17), gm ? white : yellow, [0, 1.65, -0.59]);
  for (const side of [-1, 1]) {
    part(body, resources.box(gm ? 0.55 : 0.64, gm ? 0.27 : 0.41, 0.19), yellow, [side * 0.71, gm ? 1.07 : 1.17, -0.73]);
    for (let i = 0; i < 3; i++) part(body, resources.box(0.46, gm ? 0.028 : 0.065, 0.04), dark, [side * 0.71, (gm ? 0.99 : 1.04) + i * (gm ? 0.08 : 0.13), -0.844]);
    part(body, resources.plate([[-0.41, 0.3], [0.41, 0.3], [0.48, -0.43], [-0.43, -0.43]], 0.18), white, [side * 0.52, -0.03, -0.65], [-0.12, 0, side * -0.06]);
    if (!gm) part(body, resources.box(0.3, 0.3, 0.08), yellow, [side * 0.51, 0.13, -0.805]);
    part(body, resources.box(0.68, 0.08, 0.045), pale, [side * 0.52, -0.14, -0.77]);
    part(body, resources.box(0.42, 0.78, 1.05), white, [side * 1.03, 0.04, 0], [0, 0, side * -0.18]);
  }
  part(body, resources.box(1.76, 0.74, 0.23), white, [0, -0.05, 0.68]);

  const backpack = group(torso, 'backpack', [0, 1.07, 0.81]);
  const packArmor = group(backpack, 'backpack-armor');
  part(packArmor, resources.box(1.42, 1.26, 0.61), dark, [0, 0, 0]);
  part(packArmor, resources.box(1.01, 0.73, 0.15), pale, [0, 0.08, 0.37]);
  const thrusters: Group[] = [];
  for (const side of [-1, 1]) {
    part(packArmor, resources.cylinder(0.22, 0.31, 0.45), dark, [side * 0.45, -0.35, 0.44], [Math.PI / 2, 0, 0]);
    part(packArmor, resources.cylinder(0.18, 0.22, 0.035), pale, [side * 0.45, -0.35, 0.69], [Math.PI / 2, 0, 0]);
    const flame = group(backpack, 'boost-flame', [side * 0.45, -0.35, 0.71]);
    part(flame, resources.cylinder(0, 0.22, 0.91), resources.material(0xa6f8ff, 0x49baff, 3), [0, 0, 0.42], [Math.PI / 2, 0, 0]);
    flame.visible = false;
    thrusters.push(flame);
  }
  mergeArmor(packArmor, resources);
  let stowedSaber: Group | undefined;
  for (const side of gm ? [1] : [-1, 1]) {
    const saber = group(backpack, `stowed-saber-${side}`, [side * 0.65, 0.67, 0]);
    rod(saber, resources, [0, -0.1, 0], [side * 0.09, 0.66, 0], 0.105, white);
    rod(saber, resources, [side * 0.065, 0.43, 0], [side * 0.072, 0.49, 0], 0.13, pale);
    if (side > 0) stowedSaber = saber;
    mergeArmor(saber, resources);
  }

  const head = createFederationHead(torso, resources, gm);

  const arms: Group[] = [];
  const legs: Group[] = [];
  for (const side of [-1, 1]) {
    const arm = group(torso, side < 0 ? 'left-arm' : 'right-arm', [side * 1.5, 1.11, 0]);
    const armor = group(arm, 'arm-armor');
    part(armor, resources.armor([[-0.35, 0.48, 0.5, 0], [0.15, 0.56, 0.56, 0], [0.4, 0.43, 0.44, 0]], 0.23), gm ? red : white, [side * 0.15, 0.11, 0]);
    part(armor, resources.box(0.8, 0.2, 0.86), pale, [side * 0.15, -0.19, 0]);
    part(armor, resources.cylinder(0.25, 0.25, 0.5), dark, [0, -0.58, 0], [0, 0, Math.PI / 2]);
    part(armor, resources.armor([[-0.35, 0.32, 0.36, 0], [0.2, 0.38, 0.41, 0], [0.35, 0.29, 0.32, 0]]), white, [0, -0.8, -0.02]);
    part(armor, resources.box(0.38, 0.2, 0.08), pale, [0, -0.72, -0.43]);
    part(armor, resources.box(0.48, 0.38, 0.49), dark, [0, -1.23, -0.08]);
    for (let i = 0; i < 3; i++) part(armor, resources.box(0.08, 0.11, 0.04), pale, [-0.15 + i * 0.15, -1.19, -0.34]);
    mergeArmor(armor, resources);
    arms.push(arm);

    const leg = group(root, side < 0 ? 'left-leg' : 'right-leg', [side * 0.58, 1.95, 0]);
    const legArmor = group(leg, 'leg-armor');
    part(legArmor, resources.box(0.72, 0.69, 0.73), white, [0, -0.24, 0]);
    part(legArmor, resources.cylinder(0.23, 0.23, 0.53), dark, [0, -0.59, 0], [0, 0, Math.PI / 2]);
    part(legArmor, resources.armor([[-0.43, 0.44, 0.44, 0.02], [0.08, 0.48, 0.5, 0.04], [0.43, 0.36, 0.39, 0]], 0.33), white, [0, -0.98, 0]);
    part(legArmor, resources.box(0.62, 0.3, 0.24), white, [0, -0.65, -0.57]);
    part(legArmor, resources.box(0.52, 0.08, 0.05), pale, [0, -0.64, -0.725]);
    part(legArmor, resources.armor([[-0.3, 0.54, 0.78, -0.04], [-0.1, 0.56, 0.78, -0.04], [0.3, 0.43, 0.59, 0.07]], 0.2), red, [0, -1.65, -0.2]);
    part(legArmor, resources.box(0.74, 0.32, 0.65), white, [0, -1.36, 0.02]);
    part(legArmor, resources.box(0.92, 0.1, 1.18), dark, [0, -1.82, -0.38]);
    mergeArmor(legArmor, resources);
    legs.push(leg);
  }

  const shield = group(arms[0], 'shield', [-0.5, -0.56, -0.32]);
  const shieldArmor = group(shield, 'shield-armor');
  const outline = [[-0.48, 1.36], [0.48, 1.36], [0.68, 1.13], [0.68, -1.07], [0.48, -1.34], [-0.48, -1.34], [-0.68, -1.07], [-0.68, 1.13]] as const;
  part(shieldArmor, resources.plate(outline, 0.25, 0.07), white);
  part(shieldArmor, resources.plate(outline.map(([x, y]) => [x * 0.78, y * 0.85] as const), 0.06), red, [0, 0.015, -0.19]);
  part(shieldArmor, resources.box(0.16, 1.07, 0.065), yellow, [0, -0.1, -0.26]);
  part(shieldArmor, resources.box(0.83, 0.14, 0.065), yellow, [0, 0.02, -0.26]);
  part(shieldArmor, resources.box(0.7, 0.25, 0.075), dark, [0, 0.76, -0.25]);
  part(shieldArmor, resources.box(0.27, 0.6, 0.19), dark, [0, 0, 0.26]);
  mergeArmor(shieldArmor, resources);
  mergeArmor(body, resources);
  const weapons = createGundamWeapons(arms[1], resources, gm);
  return assembleRig({ root, resources, weapons, thrusters, stowedSaber,
    joints: { torso, head, leftArm: arms[0], rightArm: arms[1], leftLeg: legs[0], rightLeg: legs[1] },
  });
}

export const gundamDefinition: MechaDefinition = {
  id: 'gundam', name: 'RX-78-2 高达', maxHealth: 320, speed: 9, boostSpeed: 23,
  flightSpeed: 14, flightBoostSpeed: 30,
  radius: 1.12, height: 6.55, rangedWeapon: 'beam-rifle', meleeWeapon: 'beam-saber', createRig: createGundamRig,
};
