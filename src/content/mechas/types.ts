import type { Group, Object3D } from 'three';

export type WeaponSlot = 'ranged' | 'melee';
export interface MechaPose {
  time: number;
  speed: number;
  aiming: boolean;
  attack: number;
  boosting: boolean;
  airborne: boolean;
  hurt: number;
  flying?: boolean;
  flightBlend?: number;
  bank?: number;
  flightPitch?: number;
  aimPitch?: number;
  thrust?: number;
}
export interface MechaRig {
  root: Group;
  joints: Record<'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg', Object3D>;
  muzzle: Object3D;
  bladeTip: Object3D;
  setWeapon(slot: WeaponSlot): void;
  animate(pose: MechaPose): void;
  dispose(): void;
}
export interface MechaDefinition {
  id: string;
  name: string;
  maxHealth: number;
  speed: number;
  boostSpeed: number;
  flightSpeed: number;
  flightBoostSpeed: number;
  radius: number;
  height: number;
  rangedWeapon: string;
  meleeWeapon: string;
  createRig(): MechaRig;
}
