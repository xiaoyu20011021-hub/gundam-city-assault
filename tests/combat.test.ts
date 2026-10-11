import { describe, expect, it } from 'vitest';
import { WeaponState, MeleeSwing, firstSegmentHit, meleeCanHit } from '../src/gameplay/combat';

describe('combat rules', () => {
  it('enforces rifle cooldown and recovers after overheating', () => {
    const state = new WeaponState({ cooldown: 0.2, heatPerShot: 36, cooling: 24 });
    expect(state.fire()).toBe(true);
    expect(state.fire()).toBe(false);
    state.update(0.2);
    expect(state.fire()).toBe(true);
    state.update(0.2);
    expect(state.fire()).toBe(true);
    state.update(0.2);
    expect(state.fire()).toBe(false);
    state.update(5);
    expect(state.fire()).toBe(true);
  });
  it('cooling is independent of frame rate', () => {
    const simulate = (hz: number) => {
      const state = new WeaponState({ cooldown: 0.2, heatPerShot: 60, cooling: 24 });
      state.fire();
      for (let i = 0; i < hz; i++) state.update(1 / hz);
      return state.heat;
    };
    expect(simulate(30)).toBeCloseTo(simulate(120), 8);
  });
  it('hits each enemy only once per swing and only during active frames', () => {
    const swing = new MeleeSwing(0.18, 0.22, 0.38);
    expect(swing.start()).toBe(true);
    expect(swing.hit('enemy')).toBe(false);
    swing.update(0.2);
    expect(swing.hit('enemy')).toBe(true);
    expect(swing.hit('enemy')).toBe(false);
    swing.update(0.8);
    expect(swing.start()).toBe(true);
    swing.update(0.2);
    expect(swing.hit('enemy')).toBe(true);
  });
  it('selects a wall before an enemy even when a fast projectile crosses both', () => {
    const hit = firstSegmentHit({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: -60 },
      [{ minX: -4, maxX: 4, minZ: -20, maxZ: -18, height: 8 }],
      [{ id: 'enemy', x: 0, y: 0, z: -30, radius: 2, height: 5 }]);
    expect(hit?.type).toBe('wall');
    expect(hit?.t).toBeCloseTo(0.3);
  });
  it('ignores actors behind the start or beyond the end of a segment', () => {
    expect(firstSegmentHit({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: -10 }, [],
      [{ id: 'enemy', x: 0, y: 0, z: -30, radius: 2, height: 5 }])).toBeNull();
  });
  it('requires melee range, facing and unobstructed line of sight', () => {
    const attacker = { x: 0, z: 0, yaw: 0 };
    expect(meleeCanHit(attacker, { x: 0, z: -6 }, 9, [])).toBe(true);
    expect(meleeCanHit(attacker, { x: 0, z: 6 }, 9, [])).toBe(false);
    expect(meleeCanHit(attacker, { x: 0, z: -16 }, 9, [])).toBe(false);
    expect(meleeCanHit(attacker, { x: 0, z: -6 }, 9,
      [{ minX: -2, maxX: 2, minZ: -4, maxZ: -3, height: 8 }])).toBe(false);
  });
});
