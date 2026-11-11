/** Data-only contract; the host provides collision, world snapshots and actual projectiles. */
export interface Point3 { x: number; y: number; z: number }

export interface RemoteWeaponConfig {
  id: string;
  model: string;
  mountIds: string[];
  maxHealth: number;
  radius: number;
  height: number;
  damageWeapon: string;
  acquireRange: number;
  recallRange: number;
  speed: number;
  returnSpeed: number;
  turnSpeed: number;
  attackRadius: number;
  sortieDuration: number;
  maxShots: number;
  shotInterval: number;
  rechargeTime: number;
  launchInterval: number;
  lowHealthRatio: number;
}

export type RemoteUnitState = 'docked' | 'deploying' | 'attacking' | 'repositioning' | 'returning' | 'recharging' | 'destroyed';

export interface RemoteUnitSnapshot {
  id: string;
  ownerId: string;
  team: string;
  equipmentId: string;
  model: string;
  mountId: string;
  index: number;
  state: RemoteUnitState;
  position: Point3;
  velocity: Point3;
  direction: Point3;
  health: number;
  maxHealth: number;
  radius: number;
  height: number;
  cooldown: number;
  blocked: boolean;
  targetId?: string;
}

export interface RemoteOwnerSnapshot {
  id: string;
  team: string;
  position: Point3;
  mounts: Record<string, Point3>;
  alive: boolean;
}

export interface RemoteTargetSnapshot {
  id: string;
  team: string;
  position: Point3;
  velocity: Point3;
  alive: boolean;
}

export interface WorldContext {
  owners: RemoteOwnerSnapshot[];
  targets: RemoteTargetSnapshot[];
  priorityTargetId?: string;
  lineClear(a: Point3, b: Point3): boolean;
  move(a: Point3, b: Point3, maxDistance: number, radius: number, unitId?: string): { position: Point3; blocked: boolean };
  fire(request: { ownerId: string; unitId: string; weaponId: string; position: Point3; direction: Point3 }): boolean;
}

export interface RemoteEvent {
  type: 'shot' | 'damaged' | 'destroyed';
  unitId: string;
  ownerId: string;
  position: Point3;
}
