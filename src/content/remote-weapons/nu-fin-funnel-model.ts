import { Group, Object3D } from 'three';
import { GeometryResources, group, mergeArmor, part } from '../mechas/geometry';

export interface NuFinFunnelModel {
  root: Group;
  muzzle: Object3D;
  /** 0: long stowed plate; 1: open C-shaped firing pose. */
  setDeployment(blend: number): void;
}

/** All meshes share caller-owned resources; no gameplay state is stored here. */
export function createNuFinFunnel(resources: GeometryResources): NuFinFunnelModel {
  const root = new Group();
  root.name = 'nu-fin-funnel';
  const white = resources.material(0xf1f2e9);
  const navy = resources.material(0x202c41);
  const gray = resources.material(0x8e9ba5);
  const gold = resources.material(0xf4bd36);
  const cyan = resources.material(0x9befff, 0x35c8ff, 1.4);
  const center = group(root, 'funnel-center');
  part(center, resources.box(0.4, 0.55, 0.35, 0.025), navy);
  part(center, resources.box(0.43, 0.17, 0.39, 0.015), gold);
  part(center, resources.box(0.22, 0.23, 0.07), gray, [0, 0, -0.22]);
  part(center, resources.box(0.13, 0.15, 0.03, 0.005), cyan, [0, 0, -0.27]);
  for (const side of [-1, 1]) {
    part(center, resources.cylinder(0.14, 0.14, 0.045), gray, [side * 0.225, 0, 0], [0, 0, Math.PI / 2]);
  }
  mergeArmor(center, resources);
  const upper = group(root, 'upper-fin', [0, 0.23, 0]);
  const lower = group(root, 'lower-fin', [0, -0.23, 0]);
  for (const [hinge, side] of [[upper, 1], [lower, -1]] as const) {
    const armor = group(hinge, 'fin-armor');
    part(armor, resources.box(0.36, 1.1, 0.18, 0.025), white, [0, side * 0.6, 0]);
    part(armor, resources.box(0.29, 0.35, 0.205, 0.02), navy, [0, side * 0.25, 0.005]);
    part(armor, resources.plate([[-0.18, 0.12], [0.18, 0.12], [0.15, -0.12], [-0.15, -0.12]], 0.2, 0.018), navy, [0, side * 1.22, 0]);
    part(armor, resources.box(0.2, 0.035, 0.016, 0.003), gray, [0, side * 0.91, -0.105]);
    part(armor, resources.box(0.08, 0.24, 0.025, 0.004), gray, [-0.11, side * 0.61, -0.11]);
    part(armor, resources.box(0.22, 0.08, 0.04, 0.005), gold, [0, side * 1.09, -0.115]);
    mergeArmor(armor, resources);
  }
  const thruster = group(root, 'funnel-thruster', [0, 0, 0.22]);
  part(thruster, resources.box(0.24, 0.17, 0.09), gray);
  part(thruster, resources.box(0.16, 0.1, 0.02), cyan, [0, 0, 0.055]);
  const muzzle = new Object3D();
  muzzle.name = 'funnel-muzzle';
  muzzle.position.z = -0.3;
  muzzle.rotation.y = Math.PI;
  root.add(muzzle);
  return {
    root, muzzle,
    setDeployment(blend) {
      const t = Number.isFinite(blend) ? Math.max(0, Math.min(1, blend)) : 0;
      upper.rotation.x = -t * Math.PI * 0.43;
      lower.rotation.x = t * Math.PI * 0.43;
    },
  };
}
