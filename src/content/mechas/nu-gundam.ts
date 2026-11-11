import { Group, Object3D } from 'three';
import { NU_FIN_FUNNELS } from '../remote-weapons/nu-fin-funnel';
import { createNuFinFunnel } from '../remote-weapons/nu-fin-funnel-model';
import { createNuWeapons } from '../weapons/nu-models';
import { assembleRig } from './animation';
import { GeometryResources, group, mergeArmor, part, rod } from './geometry';
import type { MechaDefinition, MechaRig } from './types';

/** Original SD RX-93 proportions, with a separate six-fin left-back rack. */
export function createNuGundamRig(): MechaRig {
  const resources = new GeometryResources();
  const white = resources.material(0xf0f2e9);
  const pale = resources.material(0xa5b2bb);
  const navy = resources.material(0x202c41);
  const dark = resources.material(0x151f2b);
  const yellow = resources.material(0xf3bf38);
  const red = resources.material(0xc74342);
  const green = resources.material(0x78f0bc, 0x35cf99, 0.55);
  const root = new Group();
  root.name = 'RX-93 Nu Gundam';
  const torso = group(root, 'torso', [0, 2.35, 0]);
  const body = group(torso, 'nu-torso-armor');
  part(body, resources.armor([[-0.34, 0.78, 0.51, 0], [0.19, 0.91, 0.58, 0]], 0.3), navy, [0, 0.15, 0]);
  part(body, resources.armor([[-0.42, 0.85, 0.52, 0], [0.11, 1.1, 0.7, 0], [0.48, 0.91, 0.53, 0.02]], 0.4), navy, [0, 1.12, 0]);
  part(body, resources.box(1.62, 0.18, 0.8), white, [0, 1.66, 0.02]);
  part(body, resources.plate([[-0.33, 0.19], [0.33, 0.19], [0.21, -0.19], [-0.21, -0.19]], 0.18), navy, [0, 1.49, -0.7]);
  part(body, resources.box(0.34, 0.16, 0.07), red, [0, 1.25, -0.76]);
  part(body, resources.plate([[-0.34, 0.16], [0.34, 0.16], [0.22, -0.2], [-0.22, -0.2]], 0.17), white, [0, 0.63, -0.57]);
  part(body, resources.box(0.35, 0.2, 0.07), yellow, [0, 0.66, -0.71]);
  for (const side of [-1, 1]) {
    // White swept clavicles frame the two yellow vent blocks.
    part(body, resources.plate([[side * 0.2, 0.15], [side * 0.98, 0.28], [side * 1.04, -0.02], [side * 0.39, -0.2]], 0.2), white, [0, 1.4, -0.57]);
    part(body, resources.box(0.43, 0.45, 0.18), yellow, [side * 0.72, 1.04, -0.72]);
    for (let i = 0; i < 3; i++) part(body, resources.box(0.32, 0.045, 0.03, 0.003), dark, [side * 0.72, 0.9 + i * 0.135, -0.827]);
    part(body, resources.plate([[-0.4, 0.38], [0.4, 0.38], [0.48, -0.4], [-0.37, -0.4]], 0.22), white, [side * 0.48, 0, -0.67], [-0.13, 0, side * -0.08]);
    part(body, resources.box(0.36, 0.2, 0.06), navy, [side * 0.48, 0.12, -0.825]);
    part(body, resources.box(0.64, 0.055, 0.035, 0.004), pale, [side * 0.48, -0.16, -0.825]);
    part(body, resources.armor([[-0.34, 0.27, 0.49, 0], [0.34, 0.24, 0.42, 0]], 0.4), white, [side * 1.05, 0.04, 0.04]);
  }
  part(body, resources.box(1.72, 0.75, 0.23), white, [0, -0.02, 0.67]);
  mergeArmor(body, resources);

  const backpack = group(torso, 'nu-backpack', [0, 1.06, 0.83]);
  const packArmor = group(backpack, 'backpack-armor');
  part(packArmor, resources.box(1.42, 1.18, 0.6), navy);
  part(packArmor, resources.box(0.63, 0.76, 0.17), pale, [0, 0.03, 0.37]);
  const thrusters: Group[] = [];
  for (const side of [-1, 1]) {
    part(packArmor, resources.cylinder(0.2, 0.29, 0.43), dark, [side * 0.47, -0.25, 0.4], [Math.PI / 2, 0, 0]);
    part(packArmor, resources.cylinder(0.2, 0.21, 0.08), pale, [side * 0.47, -0.25, 0.66], [Math.PI / 2, 0, 0]);
    const flame = group(backpack, 'boost-flame', [side * 0.47, -0.25, 0.71]);
    part(flame, resources.cylinder(0, 0.21, 0.9), resources.material(0xb5f6ff, 0x45bbff, 3), [0, 0, 0.42], [Math.PI / 2, 0, 0]);
    flame.visible = false;
    thrusters.push(flame);
  }
  // Single rack on the left. No static fin mesh is merged into the core backpack.
  part(packArmor, resources.box(0.38, 0.6, 0.5), pale, [-0.86, 0.37, 0.05]);
  rod(packArmor, resources, [-0.75, 0.38, 0.07], [-2.55, 1.3, 0.07], 0.1, navy);
  mergeArmor(packArmor, resources);
  const stowedSaber = group(backpack, 'stowed-nu-saber', [0.67, 0.66, 0]);
  rod(stowedSaber, resources, [0, -0.08, 0], [0.1, 0.7, 0], 0.1, white);
  part(stowedSaber, resources.box(0.32, 0.13, 0.28), navy, [0.065, 0.49, 0]);
  mergeArmor(stowedSaber, resources);

  const remoteMounts: Record<string, Object3D> = {};
  const stowedRemoteModels: Record<string, Object3D> = {};
  for (let i = 0; i < 6; i++) {
    const id = `funnel-${i}`;
    const mount = group(torso, id, [-1.06 - i * 0.39, 1.64 + i * 0.23, 1.12]);
    mount.rotation.z = 0.12;
    remoteMounts[id] = mount;
    const fin = createNuFinFunnel(resources);
    fin.root.name = `stowed-${id}`;
    mount.add(fin.root);
    stowedRemoteModels[id] = fin.root;
  }

  const head = group(torso, 'head', [0, 2.02, -0.03]);
  const helmet = group(head, 'nu-helmet');
  part(helmet, resources.cylinder(0.32, 0.32, 0.29), dark, [0, -0.09, 0]);
  part(helmet, resources.armor([[-0.15, 0.91, 0.7, 0.12], [0.32, 1.15, 0.89, 0.08], [1.18, 1.08, 0.84, 0.12], [1.58, 0.76, 0.58, 0.14], [1.7, 0.44, 0.37, 0.15]], 0.4), white);
  part(helmet, resources.plate([[-0.86, 0.23], [0.86, 0.23], [0.72, -0.2], [-0.72, -0.2]], 0.12), dark, [0, 0.72, -0.96]);
  for (const side of [-1, 1]) {
    part(helmet, resources.plate([[side * 0.12, 0.04], [side * 0.75, 0.14], [side * 0.59, -0.1], [side * 0.13, -0.1]], 0.04, 0.008), yellow, [0, 0.78, -1.055]);
    part(helmet, resources.plate([[side * 0.02, 0.08], [side * 0.85, 0.25], [side * 0.79, 0.36], [side * 0.02, 0.22]], 0.11), white, [0, 0.8, -1.06]);
    part(helmet, resources.plate([[0, 0.6], [side * 0.31, 0.63], [side * 0.34, -0.17], [side * 0.08, -0.37]], 0.3), white, [side * 0.75, 0.11, -0.84]);
    part(helmet, resources.armor([[-0.15, 0.16, 0.36, 0], [0.77, 0.23, 0.4, 0], [1.1, 0.17, 0.31, 0]], 0.4), white, [side * 1.06, 0.05, 0.01]);
    part(helmet, resources.box(0.09, 0.64, 0.38), pale, [side * 1.28, 0.4, 0.03]);
    for (let i = 0; i < 3; i++) part(helmet, resources.box(0.022, 0.055, 0.25, 0.003), navy, [side * 1.336, 0.24 + i * 0.16, 0]);
    part(helmet, resources.cylinder(0.1, 0.1, 0.08), navy, [side * 0.78, 1.18, -0.86], [Math.PI / 2, 0, 0]);
  }
  part(helmet, resources.box(0.38, 0.71, 0.44), white, [0, 1.42, -0.31]);
  part(helmet, resources.box(0.24, 0.17, 0.07), green, [0, 1.65, -0.61]);
  part(helmet, resources.box(0.22, 0.13, 0.07), green, [0, 1.35, 0.9]);
  part(helmet, resources.plate([[-0.19, 0.2], [0.19, 0.2], [0.23, -0.1], [0, -0.26], [-0.23, -0.1]], 0.18), red, [0, 1.26, -1.04]);
  mergeArmor(helmet, resources);
  // Four separate tapered white antennae distinguish RX-93 from the RX-78 V-fin.
  let antennaIndex = 0;
  for (const side of [-1, 1]) for (const inner of [false, true]) {
    const antenna = group(head, `nu-antenna-${antennaIndex++}`, [0, 1.25, -0.98]);
    part(antenna, resources.plate([[side * 0.07, 0], [side * 0.23, -0.02], [side * (inner ? 0.86 : 1.6), inner ? 1.12 : 0.74], [side * (inner ? 0.75 : 1.48), inner ? 1.04 : 0.76]], 0.09, 0.012), white);
  }
  const mask = group(head, 'nu-face-mask');
  part(mask, resources.plate([[-0.42, 0.36], [0, 0.48], [0.42, 0.36], [0.31, -0.13], [0, -0.3], [-0.31, -0.13]], 0.25), white, [0, 0.29, -1.1]);
  for (let i = 0; i < 2; i++) part(mask, resources.box(0.29 - i * 0.04, 0.044, 0.021, 0.003), navy, [0, 0.4 - i * 0.12, -1.263]);
  part(mask, resources.plate([[-0.16, 0.14], [0.16, 0.14], [0.12, -0.18], [0, -0.27], [-0.12, -0.18]], 0.22), red, [0, -0.02, -1.12]);
  mergeArmor(mask, resources);

  const arms: Group[] = [], legs: Group[] = [];
  for (const side of [-1, 1]) {
    const arm = group(torso, side < 0 ? 'left-arm' : 'right-arm', [side * 1.48, 1.12, 0]);
    const armor = group(arm, 'nu-arm-armor');
    part(armor, resources.armor([[-0.3, 0.48, 0.46, 0], [0.22, 0.58, 0.51, 0], [0.43, 0.4, 0.4, 0]], 0.3), white, [side * 0.13, 0.13, 0]);
    part(armor, resources.box(0.76, 0.15, 0.1), navy, [side * 0.13, 0.1, -0.53]);
    part(armor, resources.box(0.14, 0.19, 0.045), yellow, [side * 0.46, 0.12, -0.605]);
    part(armor, resources.cylinder(0.23, 0.23, 0.47), navy, [0, -0.55, 0], [0, 0, Math.PI / 2]);
    part(armor, resources.armor([[-0.36, 0.31, 0.34, 0], [0.27, 0.39, 0.41, 0]], 0.3), white, [0, -0.81, -0.02]);
    part(armor, resources.box(0.4, 0.29, 0.07), navy, [0, -0.83, -0.46]);
    part(armor, resources.box(0.48, 0.36, 0.47), navy, [0, -1.24, -0.1]);
    for (let i = 0; i < 3; i++) part(armor, resources.box(0.07, 0.09, 0.032, 0.003), pale, [-0.14 + i * 0.14, -1.21, -0.35]);
    mergeArmor(armor, resources); arms.push(arm);

    const leg = group(root, side < 0 ? 'left-leg' : 'right-leg', [side * 0.58, 1.95, 0]);
    const legArmor = group(leg, 'nu-leg-armor');
    part(legArmor, resources.box(0.72, 0.66, 0.73), white, [0, -0.22, 0]);
    part(legArmor, resources.cylinder(0.22, 0.22, 0.5), dark, [0, -0.57, 0], [0, 0, Math.PI / 2]);
    part(legArmor, resources.armor([[-0.43, 0.42, 0.43, 0], [0.2, 0.46, 0.46, 0.03], [0.45, 0.33, 0.35, 0]], 0.3), white, [0, -0.99, 0.05]);
    part(legArmor, resources.box(0.59, 0.32, 0.23), navy, [0, -0.65, -0.51]);
    part(legArmor, resources.box(0.4, 0.06, 0.035, 0.004), yellow, [0, -0.66, -0.649]);
    part(legArmor, resources.box(0.7, 0.25, 0.59), white, [0, -1.42, 0]);
    part(legArmor, resources.armor([[-0.23, 0.53, 0.81, 0], [0.07, 0.54, 0.77, 0], [0.28, 0.42, 0.57, 0.14]], 0.23), navy, [0, -1.66, -0.32]);
    part(legArmor, resources.box(0.95, 0.12, 1.31), dark, [0, -1.89, -0.32]);
    part(legArmor, resources.box(0.66, 0.07, 0.08), pale, [0, -1.62, -1.09]);
    mergeArmor(legArmor, resources); legs.push(leg);
  }

  const shield = group(arms[0], 'nu-shield', [-0.53, -0.55, -0.35]);
  const shieldArmor = group(shield, 'nu-shield-armor');
  const outline = [[-0.55, 1.47], [0.55, 1.47], [0.66, 1.05], [0.49, -0.95], [0.09, -1.62], [-0.09, -1.62], [-0.49, -0.95], [-0.66, 1.05]] as const;
  part(shieldArmor, resources.plate(outline, 0.23, 0.055), white);
  part(shieldArmor, resources.plate([[-0.44, 1.26], [0.44, 1.26], [0.36, 0.65], [-0.36, 0.65]], 0.08), navy, [0, 0, -0.19]);
  part(shieldArmor, resources.plate([[-0.21, 0.58], [0.21, 0.58], [0.18, -0.83], [0, -1.23], [-0.18, -0.83]], 0.08), navy, [0, 0, -0.19]);
  part(shieldArmor, resources.box(0.26, 0.13, 0.04), yellow, [0, 0.9, -0.26]);
  // Small red geometric personal crest, kept on the shield surface.
  part(shieldArmor, resources.plate([[-0.39, 0.4], [-0.28, 0.4], [-0.2, -0.02], [-0.09, 0.3], [0.01, 0.3], [-0.18, -0.24], [-0.27, -0.24]], 0.025, 0.004), red, [-0.13, 0, -0.262]);
  part(shieldArmor, resources.box(0.29, 0.65, 0.17), navy, [0, 0.05, 0.22]);
  mergeArmor(shieldArmor, resources);

  const weapons = createNuWeapons(arms[1], resources);
  const rig = assembleRig({ root, resources, weapons, thrusters, stowedSaber,
    joints: { torso, head, leftArm: arms[0], rightArm: arms[1], leftLeg: legs[0], rightLeg: legs[1] },
  });
  rig.remoteMounts = remoteMounts;
  rig.stowedRemoteModels = stowedRemoteModels;
  return rig;
}

export const nuGundamDefinition: MechaDefinition = {
  id: 'nu-gundam', name: 'RX-93 牛高达', maxHealth: 320, speed: 9, boostSpeed: 23,
  flightSpeed: 14, flightBoostSpeed: 30, radius: 1.12, height: 6.55,
  rangedWeapon: 'nu-beam-rifle', meleeWeapon: 'beam-saber',
  remoteWeapons: [NU_FIN_FUNNELS], weaponModels: createNuWeapons, createRig: createNuGundamRig,
};
