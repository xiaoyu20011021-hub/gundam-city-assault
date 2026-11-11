import { describe, expect, it } from 'vitest';
import { RemoteWeaponSystem } from '../src/gameplay/remote-weapons/system';
import type { RemoteWeaponConfig, WorldContext } from '../src/gameplay/remote-weapons/types';
import { createRemoteNavigation } from '../src/gameplay/remote-weapons/navigation';
import { CITY_COLLIDERS } from '../src/content/maps/city';

const config: RemoteWeaponConfig = {
  id: 'test-equipment', model: 'test-model', mountIds: ['a', 'b', 'c', 'd', 'e', 'f'],
  maxHealth: 48, radius: 0.5, height: 0.8, damageWeapon: 'test-beam',
  acquireRange: 85, recallRange: 110, speed: 32, returnSpeed: 42, turnSpeed: 9,
  attackRadius: 14, sortieDuration: 6, maxShots: 5, shotInterval: 1.2,
  rechargeTime: 5, launchInterval: 0.12, lowHealthRatio: 0.25,
};

function world(): WorldContext {
  return {
    owners: [{ id: 'owner', team: 'blue', alive: true, position: { x: 0, y: 0, z: 0 },
      mounts: Object.fromEntries(config.mountIds.map((id, index) => [id, { x: index * 0.2, y: 4, z: 1 }])) }],
    targets: [{ id: 'enemy', team: 'red', alive: true, position: { x: 0, y: 2, z: -30 }, velocity: { x: 0, y: 0, z: 0 } }],
    lineClear: () => true,
    move: (a, b, distance) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const t = d > 0 ? Math.min(1, distance / d) : 0;
      return { position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, blocked: false };
    },
    fire: () => true,
  };
}

function advance(system: RemoteWeaponSystem, context: WorldContext, seconds: number) {
  for (let time = 0; time < seconds - 0.00001; time += 0.05) system.step(0.05, context);
}

describe('reusable remote weapons', () => {
  it('creates configurable equipment with stable IDs and detached snapshots', () => {
    const system = new RemoteWeaponSystem();
    system.attach('owner', 'blue', { ...config, mountIds: ['a', 'b'] });
    const first = system.snapshot();
    expect(first).toHaveLength(2);
    expect(first.every(unit => unit.state === 'docked' && unit.health === 48)).toBe(true);
    first[0].position.x = 999;
    first[0].health = 0;
    expect(system.snapshot()[0].health).toBe(48);
    expect(system.snapshot()[0].position.x).not.toBe(999);
    system.step(0, world());
    expect(system.snapshot().map(unit => unit.id)).toEqual(first.map(unit => unit.id));
  });

  it('launches automatically in staggered order and distributes at most two enemy targets', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    context.targets.push(...[1, 2].map(n => ({ ...context.targets[0], id: `enemy-${n}`, position: { x: n * 5, y: 2, z: -30 } })));
    context.priorityTargetId = 'enemy-2';
    system.attach('owner', 'blue', config);
    system.step(0.05, context);
    expect(system.snapshot().filter(unit => unit.state !== 'docked')).toHaveLength(1);
    advance(system, context, 1);
    expect(system.snapshot().every(unit => unit.state !== 'docked')).toBe(true);
    expect(new Set(system.snapshot().map(unit => unit.targetId))).toEqual(new Set(['enemy-2', 'enemy']));
  });

  it('recalls on shot budget, recharges and preserves damage and destroyed slots', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    system.attach('owner', 'blue', { ...config, maxShots: 1, rechargeTime: 0.3 });
    advance(system, context, 0.8);
    const [hurt, lost] = system.snapshot();
    system.applyDamage(hurt.id, 13);
    system.applyDamage(lost.id, 100);
    advance(system, context, 4);
    expect(system.snapshot().find(unit => unit.id === hurt.id)?.health).toBe(35);
    expect(system.snapshot().find(unit => unit.id === lost.id)?.state).toBe('destroyed');
    expect(system.drainEvents().filter(event => event.type === 'destroyed')).toHaveLength(1);
    system.applyDamage(lost.id, 100);
    expect(system.drainEvents()).toHaveLength(0);
    expect(system.snapshot()).toHaveLength(6);
  });

  it('does not consume shot budget when the projectile pool rejects fire', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    let accepted = false;
    let shots = 0;
    context.fire = request => {
      expect(Number.isFinite(request.direction.x)).toBe(true);
      if (accepted) shots++;
      return accepted;
    };
    system.attach('owner', 'blue', { ...config, mountIds: ['a'], maxShots: 1, sortieDuration: 30 });
    advance(system, context, 3);
    expect(system.snapshot()[0].state).toBe('attacking');
    expect(system.drainEvents()).toHaveLength(0);
    accepted = true;
    advance(system, context, 0.2);
    expect(shots).toBe(1);
    expect(system.snapshot()[0].state).toBe('returning');
    expect(system.drainEvents().filter(event => event.type === 'shot')).toHaveLength(1);
  });

  it('never teleports through a blocked launch or return path', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    context.move = a => ({ position: { ...a }, blocked: true });
    system.attach('owner', 'blue', { ...config, mountIds: ['a'] });
    advance(system, context, 1);
    expect(system.snapshot()[0].state).toBe('docked');
    expect(system.snapshot()[0].blocked).toBe(true);
    const safeWorld = world();
    advance(system, safeWorld, 1);
    const position = system.snapshot()[0].position;
    context.targets = [];
    advance(system, context, 5);
    expect(system.snapshot()[0]).toMatchObject({ state: 'returning', blocked: true, position });
  });

  it('recalls hurt units but allows a damaged unit to sortie again without healing', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    system.attach('owner', 'blue', { ...config, mountIds: ['a'], rechargeTime: 0.2, sortieDuration: 30 });
    advance(system, context, 0.8);
    const id = system.snapshot()[0].id;
    system.applyDamage(id, 40);
    system.step(0.05, context);
    expect(system.snapshot()[0].state).toBe('returning');
    advance(system, context, 3);
    expect(system.snapshot()[0].health).toBe(8);
    expect(['deploying', 'attacking', 'repositioning']).toContain(system.snapshot()[0].state);
  });

  it('does not target allies, dead targets, hidden targets or targets beyond acquisition range', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    context.targets = [
      { ...context.targets[0], id: 'ally', team: 'blue' },
      { ...context.targets[0], id: 'dead', alive: false },
      { ...context.targets[0], id: 'far', position: { x: 0, y: 0, z: -200 } },
      { ...context.targets[0], id: 'hidden' },
    ];
    context.lineClear = () => false;
    system.attach('owner', 'blue', config);
    advance(system, context, 3);
    expect(system.snapshot().every(unit => unit.state === 'docked')).toBe(true);
  });

  it('isolates owners, ignores docked damage and stops firing for a dead owner', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    system.attach('owner', 'blue', { ...config, mountIds: ['a'] });
    system.attach('other', 'red', { ...config, mountIds: ['a'] });
    system.applyDamage(system.snapshot('owner')[0].id, 99);
    expect(system.snapshot('owner')[0].health).toBe(48);
    advance(system, context, 1);
    context.owners[0].alive = false;
    let shots = 0;
    context.fire = () => { shots++; return true; };
    advance(system, context, 3);
    expect(shots).toBe(0);
    system.detachOwner('owner');
    expect(system.snapshot('other')).toHaveLength(1);
    expect(system.snapshot('owner')).toHaveLength(0);
    const previousId = system.snapshot('other')[0].id;
    system.clear();
    system.attach('other', 'red', { ...config, mountIds: ['a'] });
    expect(system.snapshot('other')[0].id).not.toBe(previousId);
  });

  it('emits a successful shot at the deployed model muzzle rather than at its root', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    let firstShot: Parameters<WorldContext['fire']>[0] | undefined;
    context.fire = request => { firstShot = request; return true; };
    system.attach('owner', 'blue', { ...config, mountIds: ['a'], maxShots: 1 });
    advance(system, context, 1);
    expect(firstShot).toBeDefined();
    const event = system.drainEvents().find(candidate => candidate.type === 'shot');
    expect(event?.position).toEqual(firstShot?.position);
    expect(Math.hypot(firstShot!.direction.x, firstShot!.direction.y, firstShot!.direction.z)).toBeCloseTo(1);
  });

  it('recalls on sortie time, lost targets and owner distance without requiring successful fire', () => {
    for (const reason of ['time', 'dead-target', 'distance'] as const) {
      const system = new RemoteWeaponSystem();
      const context = world();
      context.fire = () => false;
      system.attach('owner', 'blue', { ...config, mountIds: ['a'], sortieDuration: reason === 'time' ? 1 : 30 });
      advance(system, context, 0.9);
      if (reason === 'dead-target') context.targets[0].alive = false;
      if (reason === 'distance') context.owners[0].position.x = 200;
      advance(system, context, 0.2);
      expect(system.snapshot()[0].state).toBe('returning');
    }
  });

  it('recalls after one second of obstructed sight and cannot fire through the wall', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    system.attach('owner', 'blue', { ...config, mountIds: ['a'], sortieDuration: 30 });
    advance(system, context, 0.9);
    system.drainEvents();
    context.lineClear = () => false;
    let attempts = 0;
    context.fire = () => { attempts++; return true; };
    advance(system, context, 0.5);
    expect(system.snapshot()[0].state).not.toBe('returning');
    advance(system, context, 0.55);
    expect(system.snapshot()[0].state).toBe('returning');
    expect(attempts).toBe(0);
  });

  it('can destroy a returning unit and restores equipment only on an explicit fresh attach', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    system.attach('owner', 'blue', { ...config, mountIds: ['a'] });
    advance(system, context, 0.8);
    context.targets = [];
    system.step(0.05, context);
    const old = system.snapshot()[0];
    expect(old.state).toBe('returning');
    system.applyDamage(old.id, 99);
    advance(system, context, 10);
    expect(system.snapshot()[0]).toMatchObject({ state: 'destroyed', health: 0 });
    system.attach('owner', 'blue', { ...config, mountIds: ['a'] });
    expect(system.snapshot()).toHaveLength(1);
    expect(system.snapshot()[0]).toMatchObject({ state: 'docked', health: 48 });
    expect(system.snapshot()[0].id).not.toBe(old.id);
    system.clear();
    expect(system.snapshot()).toHaveLength(0);
    expect(system.drainEvents()).toHaveLength(0);
  });

  it('checks live airborne collision eligibility without constructing snapshots', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    system.attach('owner', 'blue', { ...config, mountIds: ['a'] });
    const id = system.snapshot()[0].id;
    expect(system.isAlive(id)).toBe(false);
    expect(system.isAlive('missing-unit')).toBe(false);
    advance(system, context, 0.8);
    // Hot collision checks must not call the allocating external snapshot API.
    system.snapshot = () => { throw new Error('liveness must not allocate snapshots'); };
    expect(system.isAlive(id)).toBe(true);
    context.targets = [];
    system.step(0.05, context);
    expect(system.isAlive(id)).toBe(true);
    system.applyDamage(id, 100);
    expect(system.isAlive(id)).toBe(false);
    system.detachOwner('owner');
    expect(system.isAlive(id)).toBe(false);
  });

  it('finds safe firing positions for all six units beside the real city building', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    context.owners[0].position = { x: -10, y: 0, z: -43 };
    context.owners[0].mounts = Object.fromEntries(config.mountIds.map((id, index) => [id, { x: -10 + index * 0.2, y: 4, z: -42 }]));
    context.targets[0].position = { x: -26, y: 3.3, z: -43 };
    Object.assign(context, createRemoteNavigation(CITY_COLLIDERS, { minX: -150, maxX: 150, minZ: -150, maxZ: 150 }));
    const fired = new Set<string>();
    context.fire = request => { fired.add(request.unitId); return true; };
    system.attach('owner', 'blue', config);
    advance(system, context, 20);
    expect(fired.size).toBe(6);
  });

  it('keeps a safe alternative station for the sortie when the preferred station becomes available', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    const directMove = context.move;
    let closed = true;
    context.move = (a, b, amount, radius) => closed && b.x > 0
      ? { position: { ...a }, blocked: true } : directMove(a, b, amount, radius);
    context.fire = () => false;
    system.attach('owner', 'blue', { ...config, mountIds: ['a'], sortieDuration: 30 });
    advance(system, context, 2);
    const station = system.snapshot()[0].position;
    expect(system.snapshot()[0].state).toBe('attacking');
    expect(station.x).toBeLessThanOrEqual(0);
    closed = false;
    advance(system, context, 1);
    expect(system.snapshot()[0].position).toEqual(station);
    context.targets[0].position.x += 2;
    advance(system, context, 1);
    expect(system.snapshot()[0].position.x).toBeCloseTo(station.x + 2);
    expect(system.snapshot()[0].position.y).toBeCloseTo(station.y);
    expect(system.snapshot()[0].position.z).toBeCloseTo(station.z);
  });

  it('bounds failed station searches and waits safely instead of retrying every frame', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    let attempts = 0;
    context.move = a => { attempts++; return { position: { ...a }, blocked: true }; };
    system.attach('owner', 'blue', { ...config, mountIds: ['a'] });
    advance(system, context, 0.2);
    const firstAttempts = attempts;
    expect(firstAttempts).toBeLessThanOrEqual(18);
    advance(system, context, 0.15);
    expect(attempts).toBe(firstAttempts);
    expect(system.snapshot()[0]).toMatchObject({ state: 'docked', blocked: true, health: 48 });
  });

  it('finds lower firing stations when a high-flying target puts preferred stations above the ceiling', () => {
    const system = new RemoteWeaponSystem();
    const context = world();
    context.owners[0].position.y = 92;
    for (const mount of Object.values(context.owners[0].mounts)) mount.y = 96;
    context.targets[0].position.y = 95.6;
    Object.assign(context, createRemoteNavigation([], { minX: -150, maxX: 150, minZ: -150, maxZ: 150 }));
    const fired = new Set<string>();
    context.fire = request => { fired.add(request.unitId); return true; };
    system.attach('owner', 'blue', config);
    advance(system, context, 3);
    expect(fired.size).toBe(6);
    expect(system.snapshot().every(unit => unit.position.y <= 99.5)).toBe(true);
  });
});
