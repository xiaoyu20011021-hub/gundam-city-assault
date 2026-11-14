import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { stepEnemy, enemyAimPoint } from '../src/gameplay/ai';
import { stepEnemy as stepClassic } from '../src/gameplay/ai-classic';
import { Game } from '../src/gameplay/game';
import { ProjectileSystem } from '../src/gameplay/projectiles';
import { WEAPON_DEFINITIONS } from '../src/content/weapons';

const actors: Actor[] = [], bounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
function make(id: string, team: 'player' | 'enemy', key = id) { const a = new Actor(key, getMechaDefinition(id), team); actors.push(a); return a; }
const context = { mode: 'enhanced' as const, projectiles: [] };
afterEach(() => { actors.splice(0).forEach(a => a.dispose()); vi.restoreAllMocks(); });

it('leaves classic decisions, movement and state exactly equal to the archived controller', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.4);
  const p = make('gundam', 'player'), a = make('zaku', 'enemy', 'a'), b = make('zaku', 'enemy', 'b');
  p.position.set(10, 0, -45);
  for (let i = 0; i < 180; i++) {
    a.tick(1 / 60); b.tick(1 / 60);
    expect(stepEnemy(a, p, 1 / 60, i / 60, [], bounds)).toEqual(stepClassic(b, p, 1 / 60, i / 60, [], bounds));
    expect(a.position.toArray()).toEqual(b.position.toArray());
    expect([a.energy, a.yaw, a.aimPitch, a.aiTimer, a.aiStrafe]).toEqual([b.energy, b.yaw, b.aimPitch, b.aiTimer, b.aiStrafe]);
  }
});
it('waits to acquire the player then aims ahead of a laterally moving target', () => {
  const p = make('gundam', 'player'), e = make('zaku', 'enemy');
  p.position.set(0, 0, -55); p.velocity.x = 12;
  expect(stepEnemy(e, p, 1 / 60, 0, [], bounds, false, context).fire).toBe(false);
  expect(enemyAimPoint(e, p, new Vector3(0, 3, 0), 'enhanced', () => 0.5)).toBeNull();
  const action = stepEnemy(e, p, 1 / 60, 0.23, [], bounds, false, context);
  expect(action.fire).toBe(true);
  const target = enemyAimPoint(e, p, new Vector3(0, 3, 0), 'enhanced', () => 0.5)!;
  expect(target.x).toBeGreaterThan(6);
});
it('does not acquire or shoot a player behind a building', () => {
  const p = make('gundam', 'player'), e = make('zaku', 'enemy'); p.position.z = -55;
  const walls = [{ minX: -8, maxX: 8, minZ: -30, maxZ: -20, height: 30 }];
  for (let i = 0; i < 25; i++) expect(stepEnemy(e, p, 1 / 60, i / 60, walls, bounds, false, context).fire).toBe(false);
  expect(enemyAimPoint(e, p, new Vector3(0, 3, 0), 'enhanced')).toBeNull();
});
it('uses the delayed predicted point in actual enemy shots and checks the real muzzle before spending ammo', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const p = make('gundam', 'player'), e = make('zaku', 'enemy');
  p.position.z = -55; p.velocity.x = 12;
  stepEnemy(e, p, 1 / 60, 0, [], bounds, false, context);
  stepEnemy(e, p, 1 / 60, 0.23, [], bounds, false, context); e.updateVisual(0.23, true);
  const shots = new ProjectileSystem();
  const subject = Object.assign(Object.create(Game.prototype), { player: p, selectedAiMode: 'enhanced', world: { colliders: [] },
    projectiles: shots, effects: { burst() {} }, bus: { emit() {} } });
  subject.fireEnemy(e);
  expect(shots.snapshot()[0].velocity.x).toBeGreaterThan(5);
  shots.clear(); e.aiFireTimer = 0;
  const muzzle = e.rig.muzzle.getWorldPosition(new Vector3());
  subject.world.colliders = [{ minX: muzzle.x - 0.2, maxX: muzzle.x + 0.2, minZ: muzzle.z - 0.2, maxZ: muzzle.z + 0.2, height: 30 }];
  const ammo = e.aiAmmo;
  subject.fireEnemy(e);
  expect(shots.activeCount).toBe(0); expect(e.aiAmmo).toBe(ammo); expect(e.aiFireTimer).toBe(0);
  shots.dispose();
});
it('lands enhanced AI to recover energy and takes off again after recharging', () => {
  const p = make('gundam', 'player'), e = make('zaku', 'enemy');
  p.position.set(0, 30, -40); p.flying = true; e.position.y = 20; e.flying = true; e.energy = 12;
  for (let i = 0; i < 120; i++) { e.tick(1 / 60); stepEnemy(e, p, 1 / 60, i / 60, [], bounds, false, context); }
  expect(e.flying).toBe(false); expect(e.grounded).toBe(true); expect(e.aiRecovering).toBe(true);
  for (let i = 120; i < 480; i++) { e.tick(1 / 60); stepEnemy(e, p, 1 / 60, i / 60, [], bounds, false, context); }
  expect(e.flying).toBe(true); expect(e.position.y).toBeGreaterThan(3);
});
it('improves actual projectile hits against steady lateral targets in a fixed scenario', () => {
  const p = make('gundam', 'player'), e = make('zaku', 'enemy'), shots = new ProjectileSystem();
  let classicHits = 0, enhancedHits = 0;
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  for (const distance of [30, 45, 60, 75]) for (const speed of [-14, -10, 10, 14]) {
    p.position.set(0, 0, -distance); p.velocity.set(speed, 0, 0);
    const origin = new Vector3(0, 3.4, 0), dt = 1 / 120;
    const flightTime = distance / 95;
    // Feed a steady motion history to the controller; no future player input is available.
    const start = 10 + distance;
    p.position.x = -speed * 0.3;
    stepEnemy(e, p, dt, start, [], bounds, false, context);
    p.position.x = 0;
    stepEnemy(e, p, dt, start + 0.3, [], bounds, false, context);
    const classic = enemyAimPoint(e, p, origin, 'classic', () => 0.5)!;
    const enhanced = enemyAimPoint(e, p, origin, 'enhanced', () => 0.5)!;
    for (const [mode, target] of [['classic', classic], ['enhanced', enhanced]] as const) {
      shots.clear(); p.position.x = 0;
      shots.fire(e, origin, new Vector3(target.x, target.y, target.z).sub(origin), WEAPON_DEFINITIONS['zaku-machinegun']);
      let hits = 0;
      for (let t = 0; t < flightTime + 0.25; t += dt) {
        p.position.x += speed * dt;
        shots.update(dt, [p], [], (_pos, _damage, actor) => { if (actor) hits++; });
      }
      if (mode === 'classic') classicHits += hits; else enhancedHits += hits;
    }
  }
  expect(enhancedHits).toBeGreaterThanOrEqual(14);
  expect(enhancedHits).toBeGreaterThan(classicHits + 8);
  console.info(`AI lateral comparison: classic ${classicHits}/16, enhanced ${enhancedHits}/16`);
  shots.dispose();
});

it('takes fewer real projectile hits with reactive dodging in a reproducible firing lane', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const p = make('gundam', 'player'); p.position.set(0, 0, -60);
  const scores: number[] = [];
  for (const mode of ['classic', 'enhanced'] as const) {
    let hits = 0;
    for (let lane = 0; lane < 8; lane++) {
      const e = make('zaku', 'enemy', `${mode}-${lane}`), shots = new ProjectileSystem();
      // Start in an approach lane: classic keeps closing, enhanced must evade laterally.
      e.position.x = (lane - 3.5) * 2;
      const from = e.position.clone().add(new Vector3(0, 3, -60));
      shots.fire(p, from, new Vector3(0, 0, 1), WEAPON_DEFINITIONS['zaku-machinegun']);
      for (let i = 0; i < 120; i++) {
        e.tick(1 / 120);
        stepEnemy(e, p, 1 / 120, i / 120, [], bounds, false, { mode, projectiles: shots.snapshot() });
        shots.update(1 / 120, [e], [], (_pos, _damage, target) => { if (target) hits++; });
      }
      shots.dispose();
    }
    scores.push(hits);
  }
  expect(scores[0]).toBeGreaterThanOrEqual(6);
  expect(scores[1]).toBeLessThanOrEqual(scores[0] / 2);
  console.info(`AI dodge comparison: classic ${scores[0]}/8 hits, enhanced ${scores[1]}/8 hits`);
});
