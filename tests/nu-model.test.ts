import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { MECHA_DEFINITIONS } from '../src/content/mechas';
import { GeometryResources } from '../src/content/mechas/geometry';

describe('SD RX-93 Nu Gundam', () => {
  it('folds a separate Fin Funnel around two joints while its muzzle remains local forward', async () => {
    const { createNuFinFunnel } = await import('../src/content/remote-weapons/nu-fin-funnel-model');
    const resources = new GeometryResources();
    const funnel = createNuFinFunnel(resources);
    const upper = funnel.root.getObjectByName('upper-fin')!;
    const lower = funnel.root.getObjectByName('lower-fin')!;
    expect(upper).toBeDefined(); expect(lower).toBeDefined();
    const restBounds = new Box3().setFromObject(funnel.root);
    expect(restBounds.getSize(new Vector3()).y).toBeGreaterThan(2.5);
    funnel.setDeployment(1);
    expect(Math.abs(upper.rotation.x)).toBeGreaterThan(0.8);
    expect(Math.abs(lower.rotation.x)).toBeGreaterThan(0.8);
    const rotation = upper.rotation.x;
    for (let i = 0; i < 30; i++) funnel.setDeployment(1);
    expect(upper.rotation.x).toBe(rotation);
    funnel.root.updateMatrixWorld(true);
    expect(funnel.muzzle.position.z).toBeCloseTo(-0.3);
    expect(funnel.muzzle.getWorldDirection(new Vector3()).z).toBeLessThan(-0.99);
    funnel.setDeployment(0);
    expect(upper.rotation.x).toBeCloseTo(0); expect(lower.rotation.x).toBeCloseTo(0);
    resources.dispose();
  });
  it('registers an independent Nu rig and automatic remote equipment with six left-back mounts', () => {
    const definition = MECHA_DEFINITIONS['nu-gundam'];
    expect(definition).toBeDefined();
    expect(definition.rangedWeapon).toBe('nu-beam-rifle');
    expect(definition.alternateRangedWeapon).toBeUndefined();
    expect(definition.remoteWeapons?.[0].model).toBe('nu-fin-funnel');
    const rig = definition.createRig();
    rig.root.updateMatrixWorld(true);
    expect(Object.keys(rig.remoteMounts ?? {})).toEqual(Array.from({ length: 6 }, (_, i) => `funnel-${i}`));
    expect(Object.keys(rig.stowedRemoteModels ?? {})).toHaveLength(6);
    const positions = Object.values(rig.remoteMounts!).map(mount => mount.getWorldPosition(new Vector3()));
    expect(positions.every(position => position.x < 0 && position.z > 0)).toBe(true);
    expect(new Set(positions.map(position => position.toArray().join(','))).size).toBe(6);
    rig.dispose();
  });

  it('keeps SD body feet at zero and a four-blade crest with an asymmetrical fin wing', () => {
    const rig = MECHA_DEFINITIONS['nu-gundam'].createRig();
    rig.root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(rig.root);
    expect(bounds.min.y).toBeCloseTo(0, 2);
    expect(bounds.max.y).toBeGreaterThan(6);
    expect(bounds.max.y).toBeLessThan(8.5);
    expect(rig.root.getObjectByName('nu-shield')).toBeDefined();
    for (let i = 0; i < 4; i++) expect(rig.root.getObjectByName(`nu-antenna-${i}`)).toBeDefined();
    const headSize = new Box3().setFromObject(rig.joints.head).getSize(new Vector3());
    expect(headSize.x).toBeGreaterThan(2.5);
    expect(headSize.y).toBeGreaterThan(2);
    // Battle view can hide gallery fins without hiding the sockets or the core body.
    Object.values(rig.stowedRemoteModels!).forEach(fin => { fin.visible = false; });
    expect(Object.values(rig.remoteMounts!).every(mount => mount.visible)).toBe(true);
    rig.dispose();
  });

  it('uses Nu-specific reusable weapons and stable forward sockets through weapon changes and animation', () => {
    const definition = MECHA_DEFINITIONS['nu-gundam'];
    expect(definition.weaponModels).toBeTypeOf('function');
    const resources = new GeometryResources();
    const parent = new Group();
    const weapons = definition.weaponModels!(parent, resources);
    parent.updateMatrixWorld(true);
    expect(weapons.ranged.getObjectByName('nu-rifle-body')).toBeDefined();
    expect(weapons.muzzle.getWorldDirection(new Vector3()).z).toBeLessThan(-0.99);
    expect(weapons.alternateRanged).toBeUndefined();
    resources.dispose();
    const rig = definition.createRig();
    const pose = { time: 2.3, speed: 0.6, aiming: true, attack: 0, boosting: true, airborne: true, hurt: 0, aimPitch: -0.6, flightPitch: -0.17, flightBlend: 1 };
    rig.animate(pose);
    const torso = rig.joints.torso.position.clone();
    const mount = rig.remoteMounts!['funnel-0'].position.clone();
    for (let i = 0; i < 100; i++) rig.animate(pose);
    expect(rig.joints.torso.position.distanceTo(torso)).toBeCloseTo(0);
    expect(rig.remoteMounts!['funnel-0'].position.distanceTo(mount)).toBeCloseTo(0);
    rig.root.updateMatrixWorld(true);
    expect(rig.muzzle.getWorldDirection(new Vector3()).y).toBeGreaterThan(0.45);
    rig.setWeapon('melee');
    expect(rig.root.getObjectByName('ranged-weapon')!.visible).toBe(false);
    expect(rig.root.getObjectByName('melee-weapon')!.visible).toBe(true);
    rig.setWeapon('alternate-ranged');
    expect(rig.root.getObjectByName('ranged-weapon')!.visible).toBe(true);
    rig.dispose();
  });

  it('releases its own static and stowed resources once and preserves another rig', () => {
    const first = MECHA_DEFINITIONS['nu-gundam'].createRig();
    const second = MECHA_DEFINITIONS['nu-gundam'].createRig();
    const watched = new Set<object>();
    let released = 0;
    second.root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      watched.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => watched.add(material));
    });
    watched.forEach(resource => (resource as { addEventListener(type: string, handler: () => void): void }).addEventListener('dispose', () => released++));
    first.dispose(); first.dispose();
    expect(released).toBe(0);
    second.dispose();
    expect(released).toBe(watched.size);
    second.dispose();
    expect(released).toBe(watched.size);
  });
});
