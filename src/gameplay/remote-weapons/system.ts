import { attackPositions, copyPoint, directionTo, distance, muzzlePosition, turnTowards } from './motion';
import { eligibleTarget, selectTargets } from './targeting';
import type { Point3, RemoteEvent, RemoteOwnerSnapshot, RemoteTargetSnapshot, RemoteUnitSnapshot, RemoteWeaponConfig, WorldContext } from './types';

interface Unit extends RemoteUnitSnapshot {
  sortieTime: number;
  shots: number;
  lostSight: number;
  launchHealth: number;
  damageRecall: boolean;
  goalOffset?: Point3;
  goalTargetId?: string;
  placementTimer: number;
}

interface Equipment {
  ownerId: string;
  config: RemoteWeaponConfig;
  units: Unit[];
  scanTimer: number;
  launchTimer: number;
  targetIds: string[];
}

const zero = (): Point3 => ({ x: 0, y: 0, z: 0 });
const airborne = (unit: Unit): boolean => unit.state !== 'docked' && unit.state !== 'recharging' && unit.state !== 'destroyed';

export class RemoteWeaponSystem {
  private equipment: Equipment[] = [];
  private events: RemoteEvent[] = [];
  private generation = 0;

  attach(ownerId: string, team: string, sourceConfig: RemoteWeaponConfig): void {
    const config = { ...sourceConfig, mountIds: [...sourceConfig.mountIds] };
    this.equipment = this.equipment.filter(equipment => equipment.ownerId !== ownerId || equipment.config.id !== config.id);
    const generation = ++this.generation;
    this.equipment.push({ ownerId, config, scanTimer: 0, launchTimer: 0, targetIds: [],
      units: config.mountIds.map((mountId, index) => ({
        id: `remote:${generation}:${ownerId}:${config.id}:${index}`, ownerId, team,
        equipmentId: config.id, model: config.model, mountId, index, state: 'docked',
        position: zero(), velocity: zero(), direction: { x: 0, y: 0, z: -1 },
        health: config.maxHealth, maxHealth: config.maxHealth, radius: config.radius, height: config.height,
        cooldown: 0, blocked: false, sortieTime: 0, shots: 0, lostSight: 0,
        launchHealth: config.maxHealth, damageRecall: false, placementTimer: 0,
      })),
    });
  }

  step(dt: number, context: WorldContext): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const equipment of this.equipment) {
      const owner = context.owners.find(candidate => candidate.id === equipment.ownerId);
      if (!owner?.alive) {
        for (const unit of equipment.units) unit.velocity = zero();
        continue;
      }
      const config = equipment.config;
      equipment.scanTimer -= dt;
      equipment.launchTimer = Math.max(0, equipment.launchTimer - dt);
      if (equipment.scanTimer <= 0) {
        equipment.targetIds = selectTargets(owner, config.acquireRange, context).map(target => target.id);
        equipment.scanTimer = 0.2;
      }
      const candidates = equipment.targetIds.map(id => context.targets.find(target => target.id === id))
        .filter((target): target is RemoteTargetSnapshot => !!target && eligibleTarget(target, owner, config.acquireRange));
      const surviving = equipment.units.filter(unit => unit.state !== 'destroyed');
      for (const unit of equipment.units) {
        if (unit.state === 'destroyed') continue;
        unit.team = owner.team;
        unit.cooldown = Math.max(0, unit.cooldown - dt);
        unit.placementTimer = Math.max(0, unit.placementTimer - dt);
        const mount = owner.mounts[unit.mountId];
        if (unit.state === 'docked' || unit.state === 'recharging') {
          unit.velocity = zero();
          if (!mount) { unit.blocked = true; continue; }
          unit.position = copyPoint(mount);
          if (unit.state === 'recharging') {
            if (unit.cooldown > 0) continue;
            unit.state = 'docked';
          }
          const target = candidates[surviving.indexOf(unit) % candidates.length];
          if (!target || equipment.launchTimer > 0) continue;
          const station = this.attackStation(unit, target, equipment, dt, context);
          unit.blocked = !station;
          if (!station || distance(mount, station.movement.position) < 1e-6) continue;
          unit.state = 'deploying';
          unit.targetId = target.id;
          unit.sortieTime = 0;
          unit.shots = 0;
          unit.lostSight = 0;
          unit.launchHealth = unit.health;
          unit.damageRecall = false;
          unit.cooldown = unit.index * Math.min(config.launchInterval, config.shotInterval / Math.max(1, equipment.units.length));
          this.moveUnit(unit, station.movement.position, dt);
          equipment.launchTimer = config.launchInterval;
          continue;
        }

        unit.sortieTime += dt;
        if (unit.damageRecall || unit.sortieTime >= config.sortieDuration || unit.shots >= config.maxShots
          || distance(owner.position, unit.position) > config.recallRange) unit.state = 'returning';

        if (unit.state !== 'returning') {
          let target: RemoteTargetSnapshot | undefined = candidates[surviving.indexOf(unit) % candidates.length];
          // Keep an occluded live target briefly so a momentary wall does not force an immediate return.
          if (!target) target = context.targets.find(candidate => candidate.id === unit.targetId && eligibleTarget(candidate, owner, config.acquireRange));
          if (!target) unit.state = 'returning';
          else {
            unit.targetId = target.id;
            this.attack(unit, target, equipment, owner, dt, context);
          }
        }
        if (unit.state === 'returning') {
          unit.targetId = undefined;
          if (!mount) { unit.blocked = true; unit.velocity = zero(); continue; }
          const movement = context.move(copyPoint(unit.position), copyPoint(mount), config.returnSpeed * dt, config.radius, unit.id);
          unit.blocked = movement.blocked;
          const direction = directionTo(unit.position, movement.position);
          this.moveUnit(unit, movement.position, dt);
          if (Math.hypot(unit.velocity.x, unit.velocity.y, unit.velocity.z) > 1e-6) unit.direction = turnTowards(unit.direction, direction, config.turnSpeed * dt);
          // The host must verify the entire final docking segment; never snap through an obstruction.
          if (!movement.blocked && distance(unit.position, mount) < 1e-4) {
            unit.state = 'recharging';
            unit.position = copyPoint(mount);
            unit.velocity = zero();
            unit.cooldown = config.rechargeTime;
            unit.goalOffset = undefined;
            unit.goalTargetId = undefined;
            unit.placementTimer = 0;
          }
        }
      }
    }
  }

  snapshot(ownerId?: string): RemoteUnitSnapshot[] {
    return this.equipment.filter(equipment => ownerId === undefined || equipment.ownerId === ownerId)
      .flatMap(equipment => equipment.units.map(unit => ({
        id: unit.id, ownerId: unit.ownerId, team: unit.team, equipmentId: unit.equipmentId, model: unit.model,
        mountId: unit.mountId, index: unit.index, state: unit.state,
        position: copyPoint(unit.position), velocity: copyPoint(unit.velocity), direction: copyPoint(unit.direction),
        health: unit.health, maxHealth: unit.maxHealth, radius: unit.radius, height: unit.height,
        cooldown: unit.cooldown, blocked: unit.blocked, targetId: unit.targetId,
      })));
  }

  /** Hot collision path: never materialize detached public snapshots here. */
  isAlive(unitId: string): boolean {
    for (const equipment of this.equipment) {
      for (const unit of equipment.units) {
        if (unit.id === unitId) return unit.health > 0 && airborne(unit);
      }
    }
    return false;
  }

  applyDamage(unitId: string, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    for (const equipment of this.equipment) {
      const unit = equipment.units.find(candidate => candidate.id === unitId);
      if (!unit || !airborne(unit)) continue;
      unit.health = Math.max(0, unit.health - amount);
      this.event('damaged', unit);
      if (unit.health <= 0) {
        unit.state = 'destroyed';
        unit.targetId = undefined;
        unit.velocity = zero();
        unit.blocked = false;
        this.event('destroyed', unit);
      } else if (unit.health < unit.launchHealth && unit.health <= unit.maxHealth * equipment.config.lowHealthRatio) {
        unit.damageRecall = true;
      }
      return;
    }
  }

  drainEvents(): RemoteEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  detachOwner(ownerId: string): void {
    this.equipment = this.equipment.filter(equipment => equipment.ownerId !== ownerId);
    this.events = this.events.filter(event => event.ownerId !== ownerId);
  }

  clear(): void { this.equipment = []; this.events = []; }

  private moveUnit(unit: Unit, position: Point3, dt: number): void {
    unit.velocity = { x: (position.x - unit.position.x) / dt, y: (position.y - unit.position.y) / dt, z: (position.z - unit.position.z) / dt };
    unit.position = copyPoint(position);
  }

  private event(type: RemoteEvent['type'], unit: Unit, position = unit.position): void {
    this.events.push({ type, unitId: unit.id, ownerId: unit.ownerId, position: copyPoint(position) });
  }

  private attackStation(unit: Unit, target: RemoteTargetSnapshot, equipment: Equipment, dt: number, context: WorldContext):
    { goal: Point3; movement: { position: Point3; blocked: boolean } } | undefined {
    const config = equipment.config;
    if (unit.goalTargetId !== target.id) {
      unit.goalTargetId = target.id;
      unit.goalOffset = undefined;
      unit.placementTimer = 0;
    }
    if (unit.goalOffset) {
      const goal = { x: target.position.x + unit.goalOffset.x, y: target.position.y + unit.goalOffset.y, z: target.position.z + unit.goalOffset.z };
      if (context.lineClear(goal, target.position)) {
        const movement = context.move(copyPoint(unit.position), goal, config.speed * dt, config.radius, unit.id);
        if (!movement.blocked) return { goal, movement };
      }
    }
    if (unit.placementTimer > 0) return undefined;
    unit.placementTimer = 0.4;
    for (const goal of attackPositions(target.position, unit.index, equipment.units.length, config.attackRadius)) {
      if (!context.lineClear(goal, target.position)) continue;
      // Reserve other active units' target-relative stations, including unequal-height slots.
      const occupied = equipment.units.some(other => other !== unit && airborne(other) && other.state !== 'returning'
        && other.goalTargetId === target.id && other.goalOffset
        && distance(goal, { x: target.position.x + other.goalOffset.x, y: target.position.y + other.goalOffset.y,
          z: target.position.z + other.goalOffset.z }) < unit.radius + other.radius + 0.25);
      if (occupied) continue;
      const movement = context.move(copyPoint(unit.position), goal, config.speed * dt, config.radius, unit.id);
      if (movement.blocked) continue;
      unit.goalOffset = { x: goal.x - target.position.x, y: goal.y - target.position.y, z: goal.z - target.position.z };
      return { goal, movement };
    }
    return undefined;
  }

  private attack(unit: Unit, target: RemoteTargetSnapshot, equipment: Equipment, owner: RemoteOwnerSnapshot, dt: number, context: WorldContext): void {
    const config = equipment.config;
    const station = this.attackStation(unit, target, equipment, dt, context);
    const movement = station?.movement ?? { position: unit.position, blocked: true };
    this.moveUnit(unit, movement.position, dt);
    unit.blocked = movement.blocked;
    unit.direction = turnTowards(unit.direction, directionTo(unit.position, target.position), config.turnSpeed * dt);
    const muzzle = muzzlePosition(unit.position, unit.direction);
    const clear = context.lineClear(muzzle, target.position);
    unit.lostSight = clear ? 0 : unit.lostSight + dt;
    if (unit.lostSight >= 1) { unit.state = 'returning'; return; }
    unit.state = !station ? 'repositioning' : distance(unit.position, station.goal) <= 1.5 ? 'attacking' : 'deploying';
    if (unit.state !== 'attacking' || !clear || unit.cooldown > 0 || !target.alive || target.team === owner.team
      || distance(muzzle, target.position) > config.acquireRange) return;
    const aim = directionTo(muzzle, target.position);
    if (aim.x * unit.direction.x + aim.y * unit.direction.y + aim.z * unit.direction.z < 0.995) return;
    if (context.fire({ ownerId: unit.ownerId, unitId: unit.id, weaponId: config.damageWeapon, position: muzzle, direction: copyPoint(unit.direction) })) {
      unit.shots++;
      unit.cooldown = config.shotInterval;
      this.event('shot', unit, muzzle);
      if (unit.shots >= config.maxShots) unit.state = 'returning';
    }
  }
}
