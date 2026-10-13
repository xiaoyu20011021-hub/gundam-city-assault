import { describe, expect, it } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import { MECHA_DEFINITIONS } from '../src/content/mechas';
import { WEAPON_DEFINITIONS } from '../src/content/weapons';

describe('modular mecha rigs', () => {
  it.each(['gundam', 'gm', 'zaku', 'char-zaku'])('%s points its gun along vertical aim even while leaning into flight', id => {
    const rig = MECHA_DEFINITIONS[id].createRig();
    for (const pitch of [-0.6, 0.6]) {
      rig.animate({ time: 0, speed: 1, aiming: true, attack: 0, boosting: true, airborne: true, hurt: 0,
        aimPitch: pitch, flightPitch: -0.17, flightBlend: 1 });
      rig.root.updateMatrixWorld(true);
      const direction = rig.muzzle.getWorldDirection(new Vector3());
      expect(direction.y * -Math.sign(pitch)).toBeGreaterThan(0.45);
    }
    rig.dispose();
  });
  it.each(['gundam', 'gm', 'zaku', 'char-zaku'])('creates %s grounded at its feet with a forward muzzle', (id) => {
    const rig = MECHA_DEFINITIONS[id].createRig();
    rig.root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(rig.root);
    expect(bounds.min.y).toBeCloseTo(0, 2);
    expect(bounds.max.y).toBeGreaterThan(5.5);
    expect(bounds.max.y).toBeLessThan(7);
    const muzzle = rig.muzzle.getWorldPosition(new Vector3());
    expect(muzzle.y).toBeGreaterThan(2);
    expect(muzzle.z).toBeLessThan(-1);
    expect(rig.muzzle.getWorldDirection(new Vector3()).z).toBeLessThan(-0.9);
    rig.dispose();
  });

  it('equips GM with a working spray gun and a single drawable beam saber', () => {
    const definition = MECHA_DEFINITIONS.gm;
    expect(definition).toBeDefined();
    expect(WEAPON_DEFINITIONS[definition.rangedWeapon].name).toBe('光束喷枪');
    expect(WEAPON_DEFINITIONS[definition.meleeWeapon].kind).toBe('melee');
    const rig = definition.createRig();
    const stowed = rig.root.getObjectByName('stowed-saber-1')!;
    expect(stowed).toBeDefined();
    expect(rig.root.getObjectByName('stowed-saber--1')).toBeUndefined();
    rig.setWeapon('melee');
    expect(stowed.visible).toBe(false);
    expect(rig.root.getObjectByName('ranged-weapon')!.visible).toBe(false);
    expect(rig.root.getObjectByName('melee-weapon')!.visible).toBe(true);
    rig.setWeapon('ranged');
    expect(stowed.visible).toBe(true);
    rig.dispose();
  });

  it('switches active weapons while preserving usable sockets', () => {
    const rig = MECHA_DEFINITIONS.gundam.createRig();
    const rifle = rig.root.getObjectByName('ranged-weapon')!;
    const saber = rig.root.getObjectByName('melee-weapon')!;
    rig.setWeapon('melee');
    expect(rifle.visible).toBe(false);
    expect(saber.visible).toBe(true);
    expect(rig.bladeTip.parent).not.toBeNull();
    rig.setWeapon('ranged');
    expect(rifle.visible).toBe(true);
    expect(saber.visible).toBe(false);
    rig.dispose();
  });

  it('evaluates animation from the pose instead of accumulating transforms', () => {
    const rig = MECHA_DEFINITIONS.gundam.createRig();
    const pose = { time: 1.7, speed: 0.6, aiming: true, attack: 0.42, boosting: true, airborne: true, hurt: 0.3 };
    rig.animate(pose);
    const first = rig.joints.rightArm.quaternion.clone();
    const firstTorso = rig.joints.torso.position.clone();
    for (let i = 0; i < 100; i++) rig.animate(pose);
    expect(rig.joints.rightArm.quaternion.angleTo(first)).toBeCloseTo(0);
    expect(rig.joints.torso.position.distanceTo(firstTorso)).toBeCloseTo(0);
    rig.dispose();
  });

  it('gives Char the command horn without adding it to the green Zaku', () => {
    const green = MECHA_DEFINITIONS.zaku.createRig();
    const char = MECHA_DEFINITIONS['char-zaku'].createRig();
    expect(green.root.getObjectByName('commander-horn')).toBeUndefined();
    expect(char.root.getObjectByName('commander-horn')).toBeDefined();
    expect(MECHA_DEFINITIONS['char-zaku'].boostSpeed).toBeGreaterThan(MECHA_DEFINITIONS.zaku.boostSpeed);
    green.dispose();
    char.dispose();
  });

  it('shares geometry inside a rig but releases no resource owned by another rig', () => {
    const first = MECHA_DEFINITIONS.zaku.createRig();
    const second = MECHA_DEFINITIONS.zaku.createRig();
    const resources = new Set<object>();
    let disposed = 0;
    second.root.traverse((object) => {
      if (object instanceof Mesh) {
        resources.add(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => resources.add(material));
      }
    });
    resources.forEach((resource) => (resource as { addEventListener(type: string, handler: () => void): void }).addEventListener('dispose', () => disposed++));
    first.dispose();
    expect(disposed).toBe(0);
    second.dispose();
    expect(disposed).toBeGreaterThan(0);
  });
});
