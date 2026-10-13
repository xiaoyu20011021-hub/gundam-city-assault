import { Group } from 'three';
import { createGundamWeapons } from '../weapons/models';
import { assembleRig } from './animation';
import { GeometryResources, group, mergeArmor, part, rod } from './geometry';
import type { MechaDefinition, MechaRig } from './types';

export function createGundamRig(): MechaRig {
  const resources = new GeometryResources();
  const white = resources.material(0xeaf1fa);
  const pale = resources.material(0xb5c5d8);
  const dark = resources.material(0x263447);
  const blue = resources.material(0x2365be);
  const red = resources.material(0xdd3c43);
  const yellow = resources.material(0xffce49);
  const eyes = resources.material(0x9affb6, 0x31ff74, 2.7);
  const root = new Group();
  root.name = 'RX-78-2';
  const torso = group(root, 'torso', [0, 2.35, 0]);
  const body = group(torso, 'torso-armor');
  part(body, resources.box(1.7, 0.44, 1.13), dark, [0, 0.1, 0]);
  part(body, resources.box(0.86, 0.52, 0.41), red, [0, 0.12, -0.63]);
  part(body, resources.box(0.37, 0.25, 0.14), yellow, [0, 0.12, -0.88]);
  part(body, resources.box(2.27, 1.12, 1.34, 0.11), blue, [0, 1.11, 0]);
  part(body, resources.box(1.88, 0.39, 1.25), blue, [0, 1.68, 0.02]);
  part(body, resources.box(0.82, 0.48, 0.25), red, [0, 0.67, -0.67]);
  part(body, resources.box(0.46, 0.44, 0.3), dark, [0, 1.44, -0.73]);
  part(body, resources.box(0.38, 0.34, 0.13), red, [0, 1.48, -0.9]);
  // The two broad yellow intake blocks define the RX-78 chest silhouette.
  for (const side of [-1, 1]) {
    part(body, resources.box(0.63, 0.58, 0.16), yellow, [side * 0.74, 1.21, -0.78]);
    for (let i = 0; i < 3; i++) part(body, resources.box(0.46, 0.065, 0.04), dark, [side * 0.74, 1.03 + i * 0.15, -0.887]);
    part(body, resources.plate([[-0.41, 0.3], [0.41, 0.3], [0.48, -0.43], [-0.43, -0.43]], 0.18), white, [side * 0.52, -0.03, -0.65], [-0.12, 0, side * -0.06]);
    part(body, resources.box(0.68, 0.12, 0.08), pale, [side * 0.52, -0.14, -0.77]);
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
  for (const side of [-1, 1]) {
    const saber = group(backpack, `stowed-saber-${side}`, [side * 0.65, 0.67, 0]);
    rod(saber, resources, [0, -0.1, 0], [side * 0.09, 0.66, 0], 0.105, white);
    rod(saber, resources, [side * 0.065, 0.43, 0], [side * 0.072, 0.49, 0], 0.13, pale);
    if (side > 0) stowedSaber = saber;
    mergeArmor(saber, resources);
  }

  const head = group(torso, 'head', [0, 2.15, -0.02]);
  const helmet = group(head, 'helmet-armor');
  part(helmet, resources.cylinder(0.37, 0.37, 0.35), dark, [0, -0.05, 0]);
  part(helmet, resources.box(2.2, 1.61, 1.68, 0.2), white, [0, 0.64, 0.03]);
  part(helmet, resources.box(1.8, 0.75, 0.23), dark, [0, 0.43, -0.85]);
  for (const side of [-1, 1]) {
    part(helmet, resources.box(0.38, 0.93, 0.54), white, [side * 0.91, 0.07, -0.48], [0, 0, side * 0.07]);
    part(helmet, resources.box(0.2, 0.59, 0.76), pale, [side * 1.11, 0.36, 0.13]);
    part(helmet, resources.box(0.12, 0.35, 0.25), red, [side * 1.22, 0.51, 0.08]);
    part(helmet, resources.box(0.36, 0.49, 0.13), white, [side * 0.68, 0.12, -1.03], [0, 0, side * -0.16]);
    const eyePoints = side > 0 ? [[0.08, 0.11], [0.65, 0.15], [0.59, -0.02], [0.12, -0.06]] as const : [[-0.65, 0.15], [-0.08, 0.11], [-0.12, -0.06], [-0.59, -0.02]] as const;
    part(helmet, resources.plate(eyePoints, 0.03, 0), eyes, [0, 0.55, -1.012]);
    part(helmet, resources.box(0.69, 0.13, 0.18), white, [side * 0.39, 0.77, -1.02], [0, 0, side * 0.1]);
    // Broad swept fins are beveled wedges rather than thin rods.
    part(helmet, resources.plate([[0, 0], [side * 0.15, -0.09], [side * 1.31, 0.91], [side * 1.18, 1.06]], 0.13, 0.02), yellow, [0, 0.97, -0.89]);
  }
  part(helmet, resources.plate([[-0.55, 0.27], [0.55, 0.27], [0.4, -0.25], [0, -0.47], [-0.4, -0.25]], 0.16), white, [0, 0.21, -1.08]);
  for (const side of [-1, 1]) {
    part(helmet, resources.box(0.045, 0.28, 0.035), dark, [side * 0.16, 0.17, -1.202], [0, 0, side * 0.14]);
    part(helmet, resources.box(0.045, 0.21, 0.035), dark, [side * 0.29, 0.2, -1.201], [0, 0, side * 0.14]);
  }
  part(helmet, resources.box(0.34, 0.32, 0.24), red, [0, -0.21, -1.04], [0.16, 0, 0]);
  part(helmet, resources.box(0.36, 0.7, 0.49), white, [0, 1.08, -0.24]);
  part(helmet, resources.box(0.25, 0.28, 0.15), red, [0, 1.12, -0.95]);
  part(helmet, resources.box(0.19, 0.13, 0.06), eyes, [0, 1.39, -0.53]);
  part(helmet, resources.box(0.19, 0.13, 0.05), eyes, [0, 1.39, 0.53]);
  mergeArmor(helmet, resources);

  const arms: Group[] = [];
  const legs: Group[] = [];
  for (const side of [-1, 1]) {
    const arm = group(torso, side < 0 ? 'left-arm' : 'right-arm', [side * 1.5, 1.11, 0]);
    const armor = group(arm, 'arm-armor');
    part(armor, resources.box(0.94, 0.71, 1.02, 0.1), white, [side * 0.15, 0.11, 0]);
    part(armor, resources.box(0.8, 0.2, 0.86), pale, [side * 0.15, -0.19, 0]);
    part(armor, resources.cylinder(0.25, 0.25, 0.5), dark, [0, -0.58, 0], [0, 0, Math.PI / 2]);
    part(armor, resources.box(0.62, 0.7, 0.71), white, [0, -0.8, -0.02]);
    part(armor, resources.box(0.38, 0.2, 0.08), pale, [0, -0.72, -0.43]);
    part(armor, resources.box(0.48, 0.38, 0.49), dark, [0, -1.23, -0.08]);
    for (let i = 0; i < 3; i++) part(armor, resources.box(0.08, 0.11, 0.04), pale, [-0.15 + i * 0.15, -1.19, -0.34]);
    mergeArmor(armor, resources);
    arms.push(arm);

    const leg = group(root, side < 0 ? 'left-leg' : 'right-leg', [side * 0.58, 1.95, 0]);
    const legArmor = group(leg, 'leg-armor');
    part(legArmor, resources.box(0.72, 0.69, 0.73), white, [0, -0.24, 0]);
    part(legArmor, resources.cylinder(0.23, 0.23, 0.53), dark, [0, -0.59, 0], [0, 0, Math.PI / 2]);
    part(legArmor, resources.box(0.81, 0.86, 0.91), white, [0, -0.98, 0]);
    part(legArmor, resources.box(0.62, 0.3, 0.24), white, [0, -0.65, -0.57]);
    part(legArmor, resources.box(0.52, 0.08, 0.05), pale, [0, -0.64, -0.725]);
    part(legArmor, resources.box(1.08, 0.6, 1.53, 0.09), red, [0, -1.65, -0.2]);
    part(legArmor, resources.box(0.74, 0.32, 0.65), white, [0, -1.36, 0.02]);
    part(legArmor, resources.box(0.88, 0.12, 0.85), pale, [0, -1.82, -0.38]);
    mergeArmor(legArmor, resources);
    legs.push(leg);
  }

  const shield = group(arms[0], 'shield', [-0.5, -0.56, -0.32]);
  const shieldArmor = group(shield, 'shield-armor');
  const outline = [[-0.61, 1.17], [0.61, 1.17], [0.66, -0.52], [0.38, -1.1], [0, -1.38], [-0.38, -1.1], [-0.66, -0.52]] as const;
  part(shieldArmor, resources.plate(outline, 0.25, 0.07), white);
  part(shieldArmor, resources.plate(outline.map(([x, y]) => [x * 0.78, y * 0.85] as const), 0.06), red, [0, 0.015, -0.19]);
  part(shieldArmor, resources.box(0.25, 1.14, 0.065), yellow, [0, -0.1, -0.26]);
  part(shieldArmor, resources.box(0.84, 0.22, 0.065), yellow, [0, 0.02, -0.26]);
  part(shieldArmor, resources.box(0.7, 0.25, 0.075), dark, [0, 0.76, -0.25]);
  part(shieldArmor, resources.box(0.27, 0.6, 0.19), dark, [0, 0, 0.26]);
  mergeArmor(shieldArmor, resources);
  mergeArmor(body, resources);
  const weapons = createGundamWeapons(arms[1], resources);
  return assembleRig({ root, resources, weapons, thrusters, stowedSaber,
    joints: { torso, head, leftArm: arms[0], rightArm: arms[1], leftLeg: legs[0], rightLeg: legs[1] },
  });
}

export const gundamDefinition: MechaDefinition = {
  id: 'gundam', name: 'RX-78-2 高达', maxHealth: 320, speed: 9, boostSpeed: 23,
  flightSpeed: 14, flightBoostSpeed: 30,
  radius: 1.12, height: 6.55, rangedWeapon: 'beam-rifle', meleeWeapon: 'beam-saber', createRig: createGundamRig,
};
