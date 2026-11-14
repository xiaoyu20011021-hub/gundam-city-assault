import { afterEach, expect, it } from 'vitest';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { stepEnemy } from '../src/gameplay/ai';
import { meleeCanHit } from '../src/gameplay/combat';
import { separateActors } from '../src/gameplay/spatial';
import { PerspectiveCamera, Vector3 } from 'three';
import { ThirdPersonCamera } from '../src/gameplay/camera';

const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
const actors: Actor[] = [];
const make = (id: string, team: 'player' | 'enemy') => {
  const a = new Actor(id, getMechaDefinition(id), team); actors.push(a); return a;
};
afterEach(() => actors.splice(0).forEach(a => a.dispose()));

it.each(['zaku', 'char-zaku'])('%s pursues the player in the air and spends real energy', id => {
  const p = make('gundam', 'player'), e = make(id, 'enemy');
  p.position.set(0, 25, -30); p.flying = true;
  for (let i = 0; i < 240; i++) { e.tick(1 / 60); stepEnemy(e, p, 1 / 60, i / 60, [], bounds); }
  expect(e.flying).toBe(true); expect(e.position.y).toBeGreaterThan(8); expect(e.energy).toBeLessThan(90);
});
it('low-energy AI lands, waits for recharge and takes off again', () => {
  const p = make('gundam', 'player'), e = make('zaku', 'enemy');
  p.position.set(0, 30, -30); p.flying = true;
  e.position.y = 20; e.flying = true; e.energy = 12;
  for (let i = 0; i < 120; i++) stepEnemy(e, p, 1 / 60, i / 60, [], bounds);
  expect(e.flying).toBe(false); expect(e.position.y).toBe(0); expect(e.aiRecovering).toBe(true);
  for (let i = 120; i < 480; i++) stepEnemy(e, p, 1 / 60, i / 60, [], bounds);
  expect(e.flying).toBe(true); expect(e.position.y).toBeGreaterThan(3);
});
it.each(['zaku', 'char-zaku'])('%s clears a roof without oscillating between landing and takeoff', id => {
  const p = make('gundam', 'player'), e = make(id, 'enemy');
  p.position.set(0, 6, -60); p.flying = true;
  e.position.set(0, 6, 20); e.flying = true;
  const walls = [{ minX: -15, maxX: 15, minZ: -30, maxZ: 0, height: 25 }];
  let landings = 0;
  for (let i = 0; i < 600; i++) {
    const wasFlying = e.flying; stepEnemy(e, p, 1 / 60, i / 60, walls, bounds);
    if (wasFlying && !e.flying) landings++;
  }
  expect(landings).toBe(0); expect(e.position.z).toBeLessThan(-15); expect(e.energy).toBeGreaterThan(20);
});
it('airborne melee uses real height instead of ground-level obstruction', () => {
  const wall = [{ minX: -2, maxX: 2, minZ: -4, maxZ: -3, height: 8 }];
  expect(meleeCanHit({ x: 0, y: 20, z: 0, yaw: 0 }, { x: 0, y: 20, z: -6 }, 9, wall)).toBe(true);
  expect(meleeCanHit({ x: 0, y: 20, z: 0, yaw: 0 }, { x: 0, y: 0, z: -6 }, 9, [])).toBe(false);
  expect(meleeCanHit({ x: 0, y: 0, z: 0, yaw: 0 }, { x: 0, y: 0, z: -6 }, 9, wall)).toBe(false);
});
it('body separation works above roofs and respects actual body heights', () => {
  const a = make('gundam', 'player'), b = make('zaku', 'enemy');
  a.position.set(0, 20, 0); b.position.set(0, 25, 0);
  const walls = [{ minX: -8, maxX: 8, minZ: -8, maxZ: 8, height: 15 }];
  separateActors([a, b], walls, bounds);
  expect(Math.abs(a.position.x - b.position.x)).toBeGreaterThan(2);
  b.position.set(a.position.x, 30, a.position.z); const x = a.position.x;
  separateActors([a, b], walls, bounds); expect(a.position.x).toBe(x);
});
it('flight boost widens the camera but aiming takes precedence', () => {
  const c = new PerspectiveCamera(), follow = new ThirdPersonCamera(c), p = new Vector3(0, 20, 0);
  follow.update(p, false, [], 1, true, true);
  expect(c.fov).toBeGreaterThan(58);
  follow.update(p, true, [], 1, true, true); expect(c.fov).toBe(44);
  expect(c.up.toArray()).toEqual([0, 1, 0]);
});
