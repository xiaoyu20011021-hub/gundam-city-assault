import { Vector3 } from 'three';
import type { MapDefinition, RectCollider } from '../../content/maps/types';
import { RemoteWeaponView } from '../../content/remote-weapons/view';
import { WEAPON_DEFINITIONS } from '../../content/weapons';
import type { Actor } from '../actor';
import type { AIMode } from '../ai-settings';
import { RemoteTargetingController } from '../ai-targeting';
import type { DamageableTarget } from '../damageable';
import type { ProjectileSystem } from '../projectiles';
import { createRemoteNavigation } from './navigation';
import { RemoteWeaponSystem } from './system';
import type { Point3, RemoteEvent, RemoteOwnerSnapshot, RemoteTargetSnapshot, RemoteUnitSnapshot } from './types';

type RuntimeEvent = RemoteEvent | { type: 'docked'; unitId: string; ownerId: string; position: Point3 };

export function isRemoteAirborne(unit: RemoteUnitSnapshot): boolean {
  return unit.health > 0 && !['docked', 'recharging', 'destroyed'].includes(unit.state);
}

/** Integrates rules with combat; it never forwards a weapon loss to the mission. */
export class RemoteWeaponRuntime {
  readonly system = new RemoteWeaponSystem();
  readonly view = new RemoteWeaponView();
  readonly root = this.view.root;
  private owners = new Map<string, Actor>();
  private targeting = new RemoteTargetingController();
  private navigation?: ReturnType<typeof createRemoteNavigation>;
  private walls?: RectCollider[];
  private bounds?: MapDefinition['bounds'];
  private events: RuntimeEvent[] = [];
  constructor(private projectiles: ProjectileSystem) {}
  attach(actor: Actor): void {
    if (this.owners.has(actor.id)) this.system.detachOwner(actor.id);
    this.owners.set(actor.id, actor);
    for (const config of actor.definition.remoteWeapons ?? []) this.system.attach(actor.id, actor.team, config);
    for (const model of Object.values(actor.rig.stowedRemoteModels ?? {})) model.visible = false;
    this.view.sync(this.system.snapshot(), this.owners, 0);
  }
  step(dt: number, actors: readonly Actor[], walls: RectCollider[], bounds: MapDefinition['bounds'], priorityTargetId?: string): void {
    for (const [id, owner] of this.owners) if (owner.dead || !actors.includes(owner)) {
      this.detachOwner(id);
    }
    if (!this.navigation || this.walls !== walls || this.bounds !== bounds) {
      // Actor altitude is measured at the feet; equipment and attack stations extend above it.
      this.navigation = createRemoteNavigation(walls, bounds, 120); this.walls = walls; this.bounds = bounds;
    }
    this.navigation.beginStep();
    const owners: RemoteOwnerSnapshot[] = [...this.owners.values()].map(actor => {
      const mounts: Record<string, Point3> = {};
      for (const [id, mount] of Object.entries(actor.rig.remoteMounts ?? {})) {
        const p = mount.getWorldPosition(new Vector3()); mounts[id] = { x: p.x, y: p.y, z: p.z };
      }
      return { id: actor.id, team: actor.team, position: actor.position, mounts, alive: !actor.dead };
    });
    const targets: RemoteTargetSnapshot[] = actors.filter(actor => !actor.dead).map(actor => ({
      id: actor.id, team: actor.team, alive: true,
      position: { x: actor.position.x, y: actor.position.y + actor.definition.height * 0.55, z: actor.position.z }, velocity: actor.velocity,
    }));
    const previous = new Map(this.system.snapshot().map(unit => [unit.id, unit.state]));
    this.system.step(dt, { owners, targets, priorityTargetId, ...this.navigation, fire: request => {
      const owner = this.owners.get(request.ownerId), weapon = WEAPON_DEFINITIONS[request.weaponId];
      if (!owner || owner.dead || !weapon) return false;
      return this.projectiles.fire(owner, new Vector3(request.position.x, request.position.y, request.position.z),
        new Vector3(request.direction.x, request.direction.y, request.direction.z), weapon, request.unitId);
    } });
    for (const unit of this.system.snapshot()) if (previous.get(unit.id) === 'returning' && unit.state === 'recharging') {
      this.events.push({ type: 'docked', unitId: unit.id, ownerId: unit.ownerId, position: unit.position });
    }
    this.syncVisual(dt);
  }
  syncVisual(dt = 0): void { this.view.sync(this.system.snapshot(), this.owners, dt); }
  snapshot(ownerId?: string): RemoteUnitSnapshot[] { return this.system.snapshot(ownerId); }
  applyDamage(id: string, amount: number): void { this.system.applyDamage(id, amount); }
  detachOwner(id: string): void {
    this.system.detachOwner(id); this.owners.delete(id); this.events = this.events.filter(event => event.ownerId !== id); this.syncVisual();
  }
  drainEvents(): RuntimeEvent[] {
    const events = [...this.system.drainEvents(), ...this.events]; this.events = []; return events;
  }
  targets(): DamageableTarget[] {
    return this.system.snapshot().filter(isRemoteAirborne).map(unit => ({
      id: unit.id, team: unit.team, kind: 'remote-unit' as const,
      isAlive: () => this.system.isAlive(unit.id) && this.owners.get(unit.ownerId)?.dead === false,
      hitBody: () => ({ id: unit.id, x: unit.position.x, y: unit.position.y - unit.height / 2, z: unit.position.z, radius: unit.radius, height: unit.height }),
    }));
  }
  enemyShot(enemy: Actor, dt: number, time: number, mode: AIMode): { point: Point3 | null } | undefined {
    if (!this.navigation) return undefined;
    const origin = enemy.rig.muzzle.getWorldPosition(new Vector3()), weapon = WEAPON_DEFINITIONS[enemy.definition.rangedWeapon];
    const target = this.targeting.choose({ id: enemy.id, team: enemy.team, elite: enemy.definition.id === 'char-zaku', position: origin },
      this.snapshot(), dt, this.navigation.lineClear, weapon.range);
    if (!target) return undefined;
    const point = this.targeting.aim(enemy.id, target, origin, mode, time, weapon.speed, weapon.range);
    return { point: point && this.navigation.lineClear(origin, point) ? point : null };
  }
  dispose(): void {
    for (const actor of this.owners.values()) for (const model of Object.values(actor.rig.stowedRemoteModels ?? {})) model.visible = true;
    this.owners.clear(); this.system.clear(); this.events = []; this.targeting.clear(); this.view.dispose();
  }
}
