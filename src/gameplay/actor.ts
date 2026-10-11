import { Vector3 } from 'three';
import type { MechaDefinition, MechaRig, WeaponSlot } from '../content/mechas/types';
import { MeleeSwing, WeaponState } from './combat';
import { WEAPON_DEFINITIONS } from '../content/weapons';

export class Actor {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  readonly rig: MechaRig;
  readonly rifle: WeaponState;
  readonly swing: MeleeSwing;
  health: number;
  energy = 100;
  slot: WeaponSlot = 'ranged';
  yaw = 0;
  speed = 0;
  boosting = false;
  hurt = 0;
  dead = false;
  aiTimer = 0;
  aiFireTimer = 0;
  aiAmmo = 12;
  aiReload = 0;
  aiPath: { x: number; z: number }[] = [];
  aiStrafe = 1;
  private pendingWeapon?: WeaponSlot;
  constructor(readonly id: string, readonly definition: MechaDefinition, readonly team: 'player' | 'enemy') {
    this.health = definition.maxHealth;
    this.rig = definition.createRig(); this.rig.root.name = id;
    const weapon = WEAPON_DEFINITIONS[definition.rangedWeapon];
    this.rifle = new WeaponState({ cooldown: weapon.cooldown, heatPerShot: weapon.heatPerShot, cooling: weapon.cooling });
    this.swing = definition.id === 'gundam' ? new MeleeSwing(0.18, 0.22, 0.38) : new MeleeSwing(0.32, 0.24, 0.59);
  }
  setWeapon(slot: WeaponSlot): void {
    if (this.swing.running) { this.pendingWeapon = slot; return; }
    if (this.slot === slot) return;
    this.slot = slot; this.rig.setWeapon(slot);
  }
  updateVisual(time: number, aiming: boolean): void {
    this.rig.root.position.copy(this.position); this.rig.root.rotation.y = this.yaw;
    this.rig.animate({ time, speed: this.speed / this.definition.speed, aiming, attack: this.swing.progress,
      boosting: this.boosting, airborne: this.position.y > 0.1, hurt: this.hurt });
    this.rig.root.updateMatrixWorld(true);
  }
  tick(dt: number): void {
    this.rifle.update(dt); this.swing.update(dt);
    if (!this.swing.running && this.pendingWeapon) {
      const slot = this.pendingWeapon; this.pendingWeapon = undefined; this.setWeapon(slot);
    }
    this.hurt = Math.max(0, this.hurt - dt * 3);
    this.aiFireTimer = Math.max(0, this.aiFireTimer - dt);
    this.aiReload = Math.max(0, this.aiReload - dt);
  }
  hitBody() { return { id: this.id, x: this.position.x, y: this.position.y, z: this.position.z, radius: this.definition.radius, height: this.definition.height }; }
  dispose(): void { this.rig.root.removeFromParent(); this.rig.dispose(); }
}
