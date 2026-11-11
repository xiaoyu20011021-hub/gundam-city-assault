import { afterEach, expect, it } from 'vitest';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { DodgeController, incomingThreats } from '../src/gameplay/ai-dodge';
import type { ProjectileSnapshot } from '../src/gameplay/projectiles';

const actors: Actor[] = [], bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
function enemy() { const e = new Actor('enemy', getMechaDefinition('zaku'), 'enemy'); actors.push(e); return e; }
const shot = (overrides: Partial<ProjectileSnapshot> = {}): ProjectileSnapshot => ({ id: 1, ownerId: 'player', team: 'player',
  position: { x: 0, y: 3, z: -55 }, velocity: { x: 0, y: 0, z: 95 }, life: 1, damage: 12, ...overrides });
const idle = { x: 0, z: 0, lift: 0, boost: false };
afterEach(() => actors.splice(0).forEach(e => e.dispose()));

it('detects a body collision using relative velocity and remaining projectile life', () => {
  const e = enemy();
  expect(incomingThreats(e, [shot()], [], 0.8)[0].time).toBeGreaterThan(0.5);
  expect(incomingThreats(e, [shot({ life: 0.1 })], [], 0.8)).toHaveLength(0);
  e.velocity.x = 30;
  expect(incomingThreats(e, [shot()], [], 0.8)).toHaveLength(0);
});
it('ignores friendly, departing, overhead, occluded and wall-blocked bullets', () => {
  const e = enemy();
  for (const p of [shot({ team: 'enemy' }), shot({ velocity: { x: 0, y: 0, z: -95 } }), shot({ position: { x: 0, y: 30, z: -55 } })]) {
    expect(incomingThreats(e, [p], [], 0.8)).toHaveLength(0);
  }
  const wall = [{ minX: -5, maxX: 5, minZ: -30, maxZ: -25, height: 15 }];
  expect(incomingThreats(e, [shot()], wall, 0.8)).toHaveLength(0);
});
it('waits after first sight, then chooses a lateral escape and holds it through cooldown', () => {
  const e = enemy(), dodge = new DodgeController(0.22, 0.7), p = shot();
  expect(dodge.step(e, [p], 1 / 60, 0, [], bounds, idle, false).dodging).toBe(false);
  expect(dodge.step(e, [p], 1 / 60, 0.1, [], bounds, idle, false).dodging).toBe(false);
  const move = dodge.step(e, [p], 1 / 60, 0.23, [], bounds, idle, false);
  expect(move.dodging).toBe(true); expect(Math.abs(move.x)).toBeGreaterThan(0.5);
  expect(move.boost).toBe(true);
  expect(dodge.step(e, [p], 1 / 60, 0.24, [], bounds, idle, false).x).toBe(move.x);
  expect(dodge.step(e, [], 1 / 60, 0.6, [], bounds, idle, false).dodging).toBe(false);
  expect(dodge.step(e, [shot({ id: 2 })], 1 / 60, 0.61, [], bounds, idle, false).dodging).toBe(false);
});
it('avoids the blocked side and respects the map boundary', () => {
  const e = enemy(), dodge = new DodgeController(0, 0.7);
  const wall = [{ minX: 2.2, maxX: 20, minZ: -10, maxZ: 10, height: 30 }];
  const move = dodge.step(e, [shot()], 1 / 60, 0, wall, bounds, idle, false);
  expect(move.dodging).toBe(true); expect(move.x).toBeLessThan(0);
  e.position.x = bounds.minX + e.definition.radius;
  const atEdge = new DodgeController(0, 0.7).step(e, [shot({ position: { x: e.position.x, y: 3, z: -55 } })], 1 / 60, 0, [], bounds, idle, false);
  expect(atEdge.x).toBeGreaterThan(0);
});
it('can dodge on foot with low energy without boosting or interrupting a melee swing', () => {
  const e = enemy(); e.energy = 5; e.aiRecovering = true;
  const dodge = new DodgeController(0, 0.7);
  const move = dodge.step(e, [shot()], 1 / 60, 0, [], bounds, idle, false);
  expect(move.dodging).toBe(true); expect(move.boost).toBe(false); expect(move.lift).toBe(0);
  e.swing.start();
  expect(dodge.step(e, [shot()], 1 / 60, 0.1, [], bounds, idle, false).dodging).toBe(false);
});
it('allows vertical evasion in the air and checks all incoming shots', () => {
  const e = enemy(); e.position.y = 20; e.flying = true; e.grounded = false;
  const threats = [shot({ position: { x: 0, y: 23, z: -55 } }),
    shot({ id: 2, position: { x: -55, y: 23, z: 0 }, velocity: { x: 95, y: 0, z: 0 } })];
  const move = new DodgeController(0, 0.7).step(e, threats, 1 / 60, 0, [], bounds, idle, false);
  expect(move.dodging).toBe(true);
  expect(Math.hypot(move.x, move.z, move.lift)).toBeGreaterThan(0.9);
});
