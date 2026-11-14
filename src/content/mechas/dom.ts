import { Group, SphereGeometry } from 'three';
import { createDomWeapons } from '../weapons/models';
import { assembleRig } from './animation';
import { GeometryResources, group, mergeArmor, part, rod } from './geometry';
import type { MechaDefinition, MechaRig } from './types';

/** SD MS-09: oversized cross visor, bell skirt, bulbous hover legs and Giant Bazooka. */
export function createDomRig(): MechaRig {
  const r = new GeometryResources();
  const purple = r.material(0x7560a8), light = r.material(0x9380c6), deep = r.material(0x4e4177);
  const black = r.material(0x242532), dark = r.material(0x101520), steel = r.material(0x686b7e);
  const red = r.material(0xb84e64), pink = r.material(0xffa7de, 0xff278b, 2.4);
  const gold = r.material(0xeab65c), blue = r.material(0x9feaff, 0x3fbdff, 2.0);
  const root = new Group(); root.name = 'MS-09 Dom';
  const torso = group(root, 'torso', [0, 2.55, 0]);
  const body = group(torso, 'torso-armor');
  part(body, r.box(1.6, 0.65, 1.2), dark, [0, 0.15, 0]);
  part(body, r.box(2.45, 1.25, 1.65, 0.23), black, [0, 1.13, 0]);
  part(body, r.plate([[-1.16, 0.46], [-0.55, 0.64], [0.55, 0.64], [1.16, 0.46], [0.93, -0.48], [-0.93, -0.48]], 0.38, 0.07), black, [0, 1.18, -0.77]);
  part(body, r.box(1.32, 0.18, 0.13), purple, [0, 1.61, -1.0]);
  part(body, r.box(0.64, 0.43, 0.22), red, [0, 0.77, -0.94]);
  part(body, r.box(0.4, 0.16, 0.06), deep, [0, 0.77, -1.08]);
  // Dom's chest scattering-beam port is a visual detail, not a second ranged attack.
  part(body, r.cylinder(0.26, 0.26, 0.13, 16), gold, [-0.68, 1.35, -1.02], [Math.PI / 2, 0, 0]);
  part(body, r.cylinder(0.17, 0.17, 0.03, 16), dark, [-0.68, 1.35, -1.1], [Math.PI / 2, 0, 0]);
  part(body, r.box(0.57, 0.38, 0.15), steel, [0.7, 1.3, -1.01]);
  for (let i = 0; i < 3; i++) part(body, r.box(0.44, 0.045, 0.04), dark, [0.7, 1.2 + i * 0.1, -1.1]);
  mergeArmor(body, r);

  const skirt = group(torso, 'bell-skirt');
  for (const side of [-1, 1]) {
    const panel = group(skirt, 'front-skirt-panel', [side * 0.72, -0.08, -0.78]);
    part(panel, r.plate([[-0.48, 0.65], [0.48, 0.65], [0.75, -0.63], [-0.75, -0.63]], 0.4, 0.08), purple, [0, 0, 0], [-0.2, 0, -side * 0.08]);
    part(panel, r.box(0.86, 0.1, 0.08), deep, [0, -0.34, -0.32]);
    mergeArmor(panel, r);
    part(skirt, r.box(0.72, 1.45, 1.6, 0.16), purple, [side * 1.47, -0.1, 0.05], [0, 0, side * 0.25]);
    part(skirt, r.box(0.12, 0.52, 0.75), dark, [side * 1.88, -0.36, 0.02], [0, 0, side * 0.25]);
  }
  part(skirt, r.box(2.68, 1.28, 0.4, 0.12), deep, [0, -0.08, 0.85], [0.15, 0, 0]);
  part(skirt, r.plate([[-0.34, 0.48], [0.34, 0.48], [0.46, -0.48], [-0.46, -0.48]], 0.34), black, [0, 0.06, -0.96]);
  mergeArmor(skirt, r);

  const head = group(torso, 'head', [0, 2.21, -0.03]);
  const helmet = group(head, 'dom-helmet');
  const dome = r.geometry('dom-dome', () => new SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.68));
  part(helmet, dome, purple, [0, 0.48, 0.08], [0, 0, 0], [1.43, 1.38, 1.16]);
  part(helmet, r.box(2.64, 0.85, 1.73, 0.3), purple, [0, 0.11, 0]);
  // Curved cheek armor surrounds a red-bordered cross rather than a rectangular faceplate.
  for (const side of [-1, 1]) {
    part(helmet, r.plate([[0.3, 0.83], [0.65, 0.81], [1.05, 0.55], [1.14, 0.27], [0.3, 0.27]].map(([x, y]) => [side * x, y] as const), 0.2, 0.06), purple,
      [0, 0.43, -1.02]);
    part(helmet, r.plate([[0.3, -0.27], [1.12, -0.27], [0.98, -0.65], [0.35, -0.77]].map(([x, y]) => [side * x, y] as const), 0.23, 0.06), purple,
      [0, 0.43, -1.03]);
  }
  const cross = group(head, 'cross-visor');
  part(cross, r.plate([[-0.3, 0.87], [0.3, 0.87], [0.3, 0.27], [1.19, 0.27], [1.19, -0.27], [0.3, -0.27], [0.3, -0.8], [-0.3, -0.8], [-0.3, -0.27], [-1.19, -0.27], [-1.19, 0.27], [-0.3, 0.27]], 0.12, 0.035), red, [0, 0.43, -1.19]);
  part(cross, r.box(2.21, 0.34, 0.05, 0.035), dark, [0, 0.43, -1.28]);
  part(cross, r.box(0.4, 1.51, 0.055, 0.035), dark, [0, 0.465, -1.29]);
  mergeArmor(cross, r);
  const eye = group(head, 'monoeye', [0, 0.43, -1.37]);
  part(eye, r.cylinder(0.2, 0.2, 0.06, 20), steel, [0, 0, 0], [Math.PI / 2, 0, 0]);
  part(eye, r.sphere(0.155), pink, [0, 0, -0.05], [0, 0, 0], [1, 0.92, 0.4]);
  for (const side of [-1, 1]) {
    part(helmet, r.box(0.36, 0.7, 0.8, 0.13), deep, [side * 1.27, -0.09, -0.24]);
    part(helmet, r.box(0.1, 0.34, 0.4), black, [side * 1.47, -0.1, -0.28]);
  }
  part(helmet, r.box(0.49, 0.22, 0.2), purple, [0, -0.38, -1.15]);
  mergeArmor(helmet, r);

  const backpack = group(torso, 'backpack', [0, 1.0, 1.05]);
  part(backpack, r.box(1.65, 1.25, 0.78, 0.13), black);
  const thrusters: Group[] = [];
  for (const side of [-1, 1]) {
    part(backpack, r.cylinder(0.22, 0.33, 0.45), steel, [side * 0.49, -0.3, 0.48], [Math.PI / 2, 0, 0]);
    const flame = group(backpack, 'boost-flame', [side * 0.49, -0.3, 0.76]);
    part(flame, r.cylinder(0.22, 0, 1.05), blue, [0, 0, 0.45], [Math.PI / 2, 0, 0]);
    flame.visible = false; thrusters.push(flame);
  }
  mergeArmor(backpack, r);
  const stowedSaber = group(torso, 'stowed-heat-saber', [-0.66, 1.1, 1.58]);
  rod(stowedSaber, r, [0, -0.66, 0], [0, 1.48, 0], 0.11, steel);
  rod(stowedSaber, r, [0, 1.48, 0], [0, 1.88, 0], 0.14, gold);

  const arms: Group[] = [], legs: Group[] = [], hoverJets: Group[] = [];
  for (const side of [-1, 1]) {
    const arm = group(torso, side < 0 ? 'left-arm' : 'right-arm', [side * 1.76, 1.13, 0]);
    const shell = group(arm, 'arm-armor');
    part(shell, r.sphere(0.86), purple, [side * 0.08, 0.06, 0], [0, 0, 0], [1.08, 0.72, 1.04]);
    part(shell, r.box(1.19, 0.23, 1.53, 0.09), deep, [side * 0.1, -0.34, 0]);
    part(shell, r.cylinder(0.3, 0.32, 0.65), black, [0, -0.59, 0]);
    part(shell, r.box(0.89, 0.82, 0.96, 0.2), purple, [0, -0.91, -0.05]);
    part(shell, r.box(0.53, 0.16, 0.09), light, [0, -0.79, -0.56]);
    part(shell, r.box(0.59, 0.4, 0.59), black, [0, -1.38, -0.09]);
    for (let i = 0; i < 3; i++) part(shell, r.box(0.11, 0.12, 0.04), steel, [-0.19 + i * 0.19, -1.32, -0.41]);
    mergeArmor(shell, r); arms.push(arm);

    const leg = group(root, side < 0 ? 'left-leg' : 'right-leg', [side * 0.92, 1.85, 0]);
    const boot = group(leg, 'hover-leg-armor');
    part(boot, r.cylinder(0.43, 0.5, 0.6), black, [0, -0.15, 0]);
    part(boot, r.sphere(1), purple, [0, -0.86, 0.07], [0, 0, 0], [0.83, 0.82, 0.84]);
    part(boot, r.box(0.76, 0.36, 0.31, 0.1), black, [0, -0.46, -0.76]);
    part(boot, r.box(1.61, 0.56, 2.08, 0.18), black, [0, -1.57, -0.28]);
    part(boot, r.box(1.32, 0.35, 1.05, 0.15), purple, [0, -1.18, -0.48]);
    part(boot, r.box(1.15, 0.07, 0.09), deep, [0, -1.48, -1.32]);
    part(boot, r.cylinder(0.27, 0.27, 0.12, 16), dark, [side * 0.79, -1.02, 0.1], [0, 0, Math.PI / 2]);
    part(boot, r.cylinder(0.18, 0.18, 0.14, 16), steel, [side * 0.8, -1.02, 0.1], [0, 0, Math.PI / 2]);
    mergeArmor(boot, r);
    const jet = group(leg, 'hover-glow', [0, -1.7, 0.2]);
    part(jet, r.sphere(0.4), blue, [0, 0, 0], [0, 0, 0], [1.5, 0.2, 1.9]);
    jet.visible = false; hoverJets.push(jet); legs.push(leg);
  }
  const weapons = createDomWeapons(arms[1], r);
  const rig = assembleRig({ root, resources: r, weapons, thrusters, stowedSaber, heavy: true,
    joints: { torso, head, leftArm: arms[0], rightArm: arms[1], leftLeg: legs[0], rightLeg: legs[1] } });
  const animateBase = rig.animate;
  rig.animate = pose => {
    animateBase(pose);
    const moving = Math.min(1, Math.abs(pose.speed));
    // Dom glides with level feet; no inherited marching cycle or accumulated offsets.
    if (!pose.airborne) {
      legs.forEach(leg => leg.rotation.set(0, 0, 0));
      torso.position.y = 2.55 + Math.sin(pose.time * 2.2) * 0.018 + moving * 0.07;
    }
    torso.rotation.z = Math.sin(pose.time * 2.3) * moving * 0.025 + Math.sin(pose.time * 65) * pose.hurt * 0.06;
    hoverJets.forEach(jet => { jet.visible = moving > 0.08 || pose.boosting; });
    if (weapons.ranged.visible) {
      arms[1].rotation.set(-(pose.aimPitch ?? 0) - torso.rotation.x - (pose.recoil ?? 0) * 0.12, 0, 0);
      arms[0].rotation.x = -0.22;
    }
    eye.position.x = pose.aiming ? 0 : Math.sin(pose.time * 0.75) * 0.44;
    eye.scale.setScalar(1 + (pose.charge ?? 0) * (0.2 + Math.sin(pose.time * 28) * 0.12));
  };
  return rig;
}

export const domDefinition: MechaDefinition = {
  id: 'dom', name: 'MS-09 大魔', maxHealth: 240, speed: 7.2, boostSpeed: 16,
  flightSpeed: 7.2, flightBoostSpeed: 16, radius: 1.65, height: 6.7, rangedWeapon: 'giant-bazooka', meleeWeapon: 'heat-saber', createRig: createDomRig,
};
