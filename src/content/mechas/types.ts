import type { Group, Object3D } from 'three';
import type { RemoteWeaponConfig } from '../../gameplay/remote-weapons/types';
import type { GeometryResources } from './geometry';
import type { WeaponModels } from '../weapons/models';

export type WeaponSlot = 'ranged' | 'alternate-ranged' | 'melee';
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
  remoteMounts?: Record<string, Object3D>;
  /** Gallery-only stowed meshes; battle views replace them with equipment instances. */
  stowedRemoteModels?: Record<string, Object3D>;
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
  alternateRangedWeapon?: string;
  meleeWeapon: string;
  remoteWeapons?: RemoteWeaponConfig[];
  weaponModels?: (parent: Object3D, resources: GeometryResources) => WeaponModels;
  createRig(): MechaRig;
}
