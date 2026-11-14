import { Vector3 } from 'three';
import type { MechaDefinition, MechaRig, WeaponSlot } from '../content/mechas/types';
import { MeleeSwing, WeaponState } from './combat';
import { WEAPON_DEFINITIONS } from '../content/weapons';

export class Actor {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  readonly rig: MechaRig;
  readonly rifle: WeaponState;
  readonly alternateRangedState?: WeaponState;
  readonly swing: MeleeSwing;
  health: number;
  energy = 100;
  slot: WeaponSlot = 'ranged';
  yaw = 0;
  speed = 0;
  boosting = false;
  flying = false;
  grounded = true;
  altitude = 0;
  takeoffHeight: number | null = null;
  rechargeDelay = 0;
  flightNotice = 0;
  flightBlend = 0;
  bank = 0;
  flightPitch = 0;
  aimPitch = 0;
  aiFlightDelay = 1;
  aiRecovering = false;
  hurt = 0;
  dead = false;
  aiTimer = 0;
  aiFireTimer = 0;
  aiAmmo: number;
  aiReload = 0;
  aiPath: { x: number; z: number }[] = [];
  aiStrafe = 1;
  aiAimTime = 0;
  readonly aiAimPoint = new Vector3();
  recoil = 0;
  private pendingWeapon?: WeaponSlot;
  constructor(readonly id: string, readonly definition: MechaDefinition, readonly team: 'player' | 'enemy') {
    this.health = definition.maxHealth;
    this.rig = definition.createRig(); this.rig.root.name = id;
    const rangedWeapon = WEAPON_DEFINITIONS[definition.rangedWeapon];
    this.rifle = new WeaponState(rangedWeapon);
    this.aiAmmo = rangedWeapon.magazine ?? 12;
    if (definition.alternateRangedWeapon) this.alternateRangedState = new WeaponState(WEAPON_DEFINITIONS[definition.alternateRangedWeapon]);
    this.swing = definition.meleeWeapon === 'beam-saber' ? new MeleeSwing(0.18, 0.22, 0.38) : new MeleeSwing(0.32, 0.24, 0.59);
  }
  get activeRangedState(): WeaponState {
    return this.slot === 'alternate-ranged' ? this.alternateRangedState! : this.rifle;
  }
  setWeapon(slot: WeaponSlot): void {
    if (slot === 'alternate-ranged' && !this.alternateRangedState) return;
    if (this.swing.running) { this.pendingWeapon = slot; return; }
    if (this.slot === slot) return;
    this.slot = slot; this.rig.setWeapon(slot);
  }
  get flightState(): 'grounded' | 'takeoff' | 'hover' | 'flight' | 'boost' | 'descent' | 'jump' {
    if (!this.flying) return this.grounded ? 'grounded' : this.velocity.y > 0.2 ? 'jump' : 'descent';
    if (this.takeoffHeight !== null) return 'takeoff';
    return this.boosting ? 'boost' : this.velocity.length() > 0.25 ? 'flight' : 'hover';
  }
  updateVisual(time: number, aiming: boolean): void {
    this.rig.root.position.copy(this.position); this.rig.root.rotation.y = this.yaw;
    this.rig.animate({ time, speed: this.speed / this.definition.speed, aiming, attack: this.swing.progress,
      boosting: this.boosting, airborne: !this.grounded, hurt: this.hurt,
      charge: this.aiAimTime / (WEAPON_DEFINITIONS[this.definition.rangedWeapon].aimTime ?? 1), recoil: this.recoil,
      flying: this.flying, flightBlend: this.flightBlend, bank: this.bank, flightPitch: this.flightPitch, aimPitch: this.aimPitch,
      thrust: this.flying ? (this.boosting ? 1 : this.velocity.length() > 0.25 ? 0.65 : 0.4) : this.boosting ? 1 : this.velocity.y > 0 ? 0.3 : 0 });
    this.rig.root.updateMatrixWorld(true);
  }
  tick(dt: number): void {
    this.rifle.update(dt); this.alternateRangedState?.update(dt); this.swing.update(dt);
    if (!this.swing.running && this.pendingWeapon) {
      const slot = this.pendingWeapon; this.pendingWeapon = undefined; this.setWeapon(slot);
    }
    this.recoil = Math.max(0, this.recoil - dt * 4);
    this.hurt = Math.max(0, this.hurt - dt * 3);
    this.aiFireTimer = Math.max(0, this.aiFireTimer - dt);
    this.aiReload = Math.max(0, this.aiReload - dt);
    this.flightNotice = Math.max(0, this.flightNotice - dt);
  }
  hitBody() { return { id: this.id, x: this.position.x, y: this.position.y, z: this.position.z, radius: this.definition.radius, height: this.definition.height }; }
  dispose(): void { this.rig.root.removeFromParent(); this.rig.dispose(); }
}
