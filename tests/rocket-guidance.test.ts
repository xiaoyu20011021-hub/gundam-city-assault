import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { WEAPON_DEFINITIONS } from '../src/content/weapons';
import { guideRocket, type RocketGuidance } from '../src/gameplay/rocket-guidance';
import { ProjectileSystem } from '../src/gameplay/projectiles';
import { Actor } from '../src/gameplay/actor';
import { MECHA_DEFINITIONS } from '../src/content/mechas';

const weapon = WEAPON_DEFINITIONS['giant-bazooka'];
const config = weapon.homing!;
const state = (): RocketGuidance => ({ config, acquired: false, remaining: config.duration });
const origin = new Vector3(0, 3, 0);
const body = { id: 'enemy', x: 8, y: 0, z: -40, height: 6, radius: 1 };
const wall = { minX: -20, maxX: 20, minZ: -22, maxZ: -20, height: 12 };

describe('limited rocket guidance', () => {
  it.each([30, 60, 120])('turns toward a visible target with a bounded angular speed at %i Hz', hz => {
    const guidance = state(), velocity = new Vector3(0, 0, -42), before = velocity.clone();
    guideRocket(origin, velocity, guidance, 1 / hz, [body], []);
    expect(guidance.targetId).toBe(body.id);
    expect(velocity.x).toBeGreaterThan(0);
    expect(before.angleTo(velocity)).toBeCloseTo(config.turnRate / hz, 6);
    expect(velocity.length()).toBeCloseTo(42, 8);
  });
  it('selects the target nearest the firing direction, excluding cover, wide angles and excessive range', () => {
    const candidates = [{ ...body, id: 'wide', x: 30 }, { ...body, id: 'far', x: 0, z: -110 }, body,
      { ...body, id: 'center', x: 0 }];
    const guidance = state();
    guideRocket(origin, new Vector3(0, 0, -42), guidance, .016, candidates, []);
    expect(guidance.targetId).toBe('center');
    const blocked = state();
    guideRocket(origin, new Vector3(0, 0, -42), blocked, .016, candidates, [wall]);
    expect(blocked.targetId).toBeUndefined(); expect(blocked.remaining).toBe(0);
  });
  it.each(['cover', 'dead', 'passed', 'fuel'])('loses guidance after %s and never reacquires another target', reason => {
    const guidance = state(), velocity = new Vector3(0, 0, -42);
    guideRocket(origin, velocity, guidance, .016, [body], []);
    if (reason === 'fuel') guidance.remaining = 0;
    guideRocket(origin, velocity, guidance, .016, reason === 'dead' ? [] : [{ ...body, z: reason === 'passed' ? 10 : body.z }], reason === 'cover' ? [wall] : []);
    expect(guidance.remaining).toBe(0);
    const before = velocity.clone();
    guideRocket(origin, velocity, guidance, .5, [{ ...body, x: -5, id: 'replacement' }], []);
    expect(velocity.toArray()).toEqual(before.toArray());
  });
  it.each(['player', 'enemy'] as const)('guides %s rockets only toward living opponents, leaving bullets unguided', team => {
    const friend = new Actor('friend', MECHA_DEFINITIONS.dom, team);
    const foe = new Actor('foe', MECHA_DEFINITIONS.gundam, team === 'player' ? 'enemy' : 'player');
    friend.position.set(-4, 0, -35); foe.position.set(8, 0, -40);
    const shots = new ProjectileSystem(), owner = { id: 'owner', team };
    shots.fire(owner, origin, new Vector3(0, 0, -1), weapon);
    shots.fire(owner, origin, new Vector3(0, 0, -1), WEAPON_DEFINITIONS['zaku-machinegun']);
    shots.update(1 / 60, [friend, foe], [], () => {});
    expect(shots.snapshot()[0].velocity.x).toBeGreaterThan(0);
    expect(shots.snapshot()[1].velocity.x).toBe(0);
    foe.dead = true;
    const before = shots.snapshot()[0].velocity;
    shots.update(1 / 60, [friend, foe], [], () => {});
    expect(shots.snapshot()[0].velocity).toEqual(before);
    shots.clear();
    shots.fire(owner, origin, new Vector3(0, 0, -1), weapon);
    shots.update(1 / 60, [friend, foe], [], () => {});
    expect(shots.snapshot()[0].velocity.x).toBe(0);
    shots.dispose(); friend.dispose(); foe.dispose();
  });
});
