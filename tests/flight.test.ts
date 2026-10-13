import { afterEach, expect, it } from 'vitest';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { stepPlayerMovement, type MovementIntent } from '../src/gameplay/movement';
import type { RectCollider } from '../src/content/maps/types';

const bounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
const actors: Actor[] = [];
const make = (id = 'gundam') => { const a = new Actor(id, getMechaDefinition(id), 'player'); actors.push(a); return a; };
const idle = { x: 0, z: 0, yaw: 0, boost: false, jump: false };
function step(a: Actor, input: Partial<MovementIntent> = {}, seconds = 1 / 60, walls: RectCollider[] = [], hz = 60) {
  for (let n = 0; n < Math.round(seconds * hz); n++) stepPlayerMovement(a, { ...idle, ...input }, 1 / hz, walls, bounds);
}
function launch(a: Actor) { step(a, { toggleFlight: true }); step(a, {}, 0.8); }
afterEach(() => { actors.splice(0).forEach(a => a.dispose()); });

it.each(['gundam', 'zaku', 'char-zaku'])('%s takes off and holds altitude while spending energy', id => {
  const a = make(id); launch(a);
  expect(a.flying).toBe(true); expect(a.position.y).toBeGreaterThan(2);
  step(a, {}, 0.5); const y = a.position.y, energy = a.energy;
  step(a, { yaw: 2, pitch: -1 }, 1);
  expect(a.position.y).toBeCloseTo(y, 1); expect(a.position.x).toBe(0);
  expect(energy - a.energy).toBeCloseTo(4, 3);
});
it('flies W toward mouse pitch and brakes to hover without drift', () => {
  const a = make(); launch(a);
  const y = a.position.y; step(a, { z: 1, pitch: -0.6 }, 1);
  expect(a.position.y).toBeGreaterThan(y + 4); expect(a.position.z).toBeLessThan(-6);
  step(a, {}, 0.4); const stopped = a.position.clone(); step(a, {}, 1);
  expect(a.position.distanceTo(stopped)).toBeLessThan(0.03);
});
it('normalizes three-axis movement and preserves frame-independent travel and energy', () => {
  const run = (hz: number, diagonal: boolean) => {
    const a = make(); a.position.y = 20; step(a, { toggleFlight: true }, 1 / hz, [], hz);
    const start = a.position.clone();
    step(a, { z: 1, x: diagonal ? 1 : 0, lift: diagonal ? 1 : 0 }, 1, [], hz);
    return { distance: a.position.distanceTo(start), energy: a.energy };
  };
  expect(run(60, false).distance).toBeCloseTo(run(60, true).distance, 5);
  expect(run(30, false).distance).toBeCloseTo(run(120, false).distance, 2);
});
it.each([30, 60, 120])('uses the specified energy rates at %i Hz', hz => {
  for (const [input, rate] of [[{}, 4], [{ z: 1 }, 6], [{ z: 1, boost: true }, 18]] as const) {
    const a = make(); a.position.y = 40;
    step(a, { toggleFlight: true }, 1 / hz, [], hz);
    expect(a.energy).toBeCloseTo(92 - 4 / hz, 7);
    const energy = a.energy;
    step(a, input, 2, [], hz); expect(energy - a.energy).toBeCloseTo(rate * 2, 7);
  }
});
it('requires 20 energy to activate and delays recovery 0.6 seconds after landing', () => {
  const a = make(); a.position.y = 10; a.energy = 19.99;
  step(a, { toggleFlight: true }); expect(a.flying).toBe(false); expect(a.flightNotice).toBeGreaterThan(0);
  a.energy = 20; step(a, { toggleFlight: true }); expect(a.flying).toBe(true);
  expect(a.energy).toBeCloseTo(12 - 4 / 60, 7);
  a.flying = false; a.position.y = 0; a.velocity.set(0, 0, 0); a.energy = 0; a.rechargeDelay = 0.6;
  step(a, {}, 0.6); expect(a.energy).toBeCloseTo(0, 7);
  step(a, {}, 1); expect(a.energy).toBeCloseTo(24, 7);
});
it('exhaustion forces capped descent, cannot recharge in air or restart below threshold', () => {
  const a = make(); a.position.y = 50; step(a, { toggleFlight: true }); a.energy = 0.05;
  step(a, { boost: true, z: 1 }, 0.5);
  expect(a.flying).toBe(false); expect(a.energy).toBe(0); expect(a.position.y).toBeLessThan(50);
  step(a, { toggleFlight: true }); expect(a.flying).toBe(false);
  step(a, {}, 1); expect(a.velocity.y).toBeGreaterThanOrEqual(-12);
  step(a, {}, 8); expect(a.position.y).toBe(0); expect(a.energy).toBeGreaterThan(0);
});
it('F descends and a second press resumes flight without teleporting', () => {
  const a = make(); a.position.y = 30; step(a, { toggleFlight: true });
  step(a, { toggleFlight: true }); step(a, {}, 0.3);
  expect(a.flying).toBe(false); const y = a.position.y;
  step(a, { toggleFlight: true }); expect(a.flying).toBe(true);
  expect(Math.abs(a.position.y - y)).toBeLessThan(0.3);
});
const roof = [{ minX: -10, maxX: 10, minZ: -10, maxZ: 10, height: 15 }];
it('lands on roofs, recharges there and can jump or take off again', () => {
  const a = make(); a.position.y = 25; a.energy = 10;
  step(a, {}, 2, roof); expect(a.position.y).toBe(15); expect(a.grounded).toBe(true);
  step(a, {}, 2, roof); expect(a.energy).toBeGreaterThan(20);
  step(a, { jump: true }, 1 / 60, roof); expect(a.position.y).toBeGreaterThan(15);
  step(a, {}, 2, roof); step(a, { toggleFlight: true }, 1 / 60, roof); step(a, {}, 1, roof);
  expect(a.flying).toBe(true); expect(a.position.y).toBeGreaterThan(17);
});
it('passes above a building but slides against its facade at low altitude', () => {
  const high = make(); high.position.set(0, 24, 20); step(high, { toggleFlight: true });
  step(high, { z: 1, boost: true }, 1, roof); expect(high.position.z).toBeLessThan(0);
  const low = make(); low.position.set(0, 6, 20); step(low, { toggleFlight: true });
  step(low, { z: 1, boost: true }, 1, roof); expect(low.position.z).toBeGreaterThanOrEqual(11.1);
});
it('walking off a roof falls, and a downward flight lands instead of penetrating', () => {
  const a = make(); a.position.set(0, 15, 0); step(a, { x: 1 }, 2, roof); step(a, {}, 2, roof);
  expect(a.position.y).toBe(0);
  const b = make(); b.position.set(0, 25, 0); step(b, { toggleFlight: true });
  step(b, { lift: -1 }, 2, roof); expect(b.position.y).toBe(15); expect(b.flying).toBe(false);
});
it('limits altitude smoothly and preserves descending input at the ceiling', () => {
  const a = make(); a.position.y = 97; step(a, { toggleFlight: true });
  step(a, { lift: 1, boost: true }, 2); expect(a.position.y).toBeLessThanOrEqual(100);
  expect(a.velocity.y).toBeLessThan(1);
  step(a, { lift: -1 }, 0.5); expect(a.position.y).toBeLessThan(99);
});
