import type { Group, Object3D } from 'three';
import type { WeaponModels } from '../weapons/models';
import type { GeometryResources } from './geometry';
import type { MechaPose, MechaRig, WeaponSlot } from './types';

export interface RigParts {
  root: Group;
  joints: MechaRig['joints'];
  resources: GeometryResources;
  weapons: WeaponModels;
  thrusters: Group[];
  stowedSaber?: Object3D;
  heavy?: boolean;
}

/** All offsets are evaluated from the bind pose; pause/restart never adds drift. */
export function assembleRig(parts: RigParts): MechaRig {
  const { root, joints, resources, weapons, thrusters } = parts;
  const bind = Object.fromEntries(Object.entries(joints).map(([name, joint]) => [name, {
    position: joint.position.clone(), rotation: joint.rotation.clone(),
  }]));
  let weapon: WeaponSlot = 'ranged';
  let disposed = false;
  const rig: MechaRig = {
    root, joints, muzzle: weapons.muzzle, bladeTip: weapons.bladeTip,
    setWeapon(slot) {
      weapon = slot;
      weapons.ranged.visible = slot === 'ranged';
      weapons.melee.visible = slot === 'melee';
      if (parts.stowedSaber) parts.stowedSaber.visible = slot === 'ranged';
    },
    animate(pose: MechaPose) {
      const flight = pose.flightBlend ?? 0;
      const movement = Math.min(1, Math.max(0, Math.abs(pose.speed))) * (pose.airborne ? 0 : 1);
      const phase = pose.time * (parts.heavy ? 8.5 : 10.5);
      const stride = Math.sin(phase) * movement;
      const idle = Math.sin(pose.time * 2.2);
      Object.entries(joints).forEach(([name, joint]) => {
        joint.position.copy(bind[name].position);
        joint.rotation.copy(bind[name].rotation);
      });
      joints.torso.position.y += movement * Math.abs(Math.sin(phase)) * 0.055 + idle * 0.018;
      joints.torso.rotation.x = pose.boosting ? -0.16 : 0.025 * movement;
      joints.torso.rotation.z = stride * 0.035 + Math.sin(pose.time * 65) * pose.hurt * 0.08;
      joints.head.rotation.y = pose.aiming ? 0 : Math.sin(pose.time * 0.8) * 0.035;
      joints.head.rotation.x = pose.airborne ? -0.08 : idle * 0.018;
      joints.leftLeg.rotation.x = stride * 0.42;
      joints.rightLeg.rotation.x = -stride * 0.42;
      joints.leftLeg.rotation.z = 0.025;
      joints.rightLeg.rotation.z = -0.025;
      joints.leftArm.rotation.x = -stride * 0.2;
      joints.leftArm.rotation.z = 0.08;
      joints.rightArm.rotation.x = pose.aiming ? 0.015 : stride * 0.12;
      joints.rightArm.rotation.z = -0.055;
      joints.rightArm.rotation.y = pose.aiming ? -0.035 : 0;
      if (weapon === 'melee') {
        joints.rightArm.rotation.z = -0.2;
        joints.rightArm.rotation.x = -0.12;
        if (pose.attack > 0 && pose.attack < 1) {
          const attack = Math.min(1, pose.attack);
          joints.rightArm.rotation.x = -0.55 + Math.sin(attack * Math.PI) * 1.25;
          joints.rightArm.rotation.y = -0.9 + attack * 1.8;
          joints.rightArm.rotation.z = -0.95 * Math.cos(attack * Math.PI);
          joints.torso.rotation.y = Math.sin(attack * Math.PI) * -0.22;
        }
      }
      if (pose.airborne) {
        joints.leftLeg.rotation.x = 0.32;
        joints.rightLeg.rotation.x = 0.52;
        joints.leftLeg.rotation.z = 0.08;
        joints.rightLeg.rotation.z = -0.08;
        joints.leftArm.rotation.z = 0.18;
      }
      joints.torso.rotation.x += pose.flightPitch ?? 0;
      joints.torso.rotation.z += pose.bank ?? 0;
      joints.torso.position.y += Math.sin(pose.time * 2) * 0.025 * flight;
      joints.head.rotation.x -= (pose.aimPitch ?? 0) * 0.6 + joints.torso.rotation.x;
      // Local forward is -Z: upward aim needs a positive X rotation. Compensate
      // the torso lean so boosting never points the rifle away from the reticle.
      if (weapon === 'ranged') joints.rightArm.rotation.x = -(pose.aimPitch ?? 0) - joints.torso.rotation.x;
      if (flight > 0) {
        joints.leftLeg.rotation.x += flight * 0.08;
        joints.rightLeg.rotation.x += flight * 0.06;
      }
      thrusters.forEach((flame, index) => {
        const thrust = pose.thrust ?? (pose.boosting || pose.airborne ? 0.7 : 0);
        flame.visible = thrust > 0;
        flame.scale.set(0.7 + thrust * 0.3, 0.7 + thrust * 0.3, 0.35 + thrust * 1.05 + Math.sin(pose.time * 42 + index) * 0.1);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      resources.dispose();
    },
  };
  rig.setWeapon('ranged');
  return rig;
}
