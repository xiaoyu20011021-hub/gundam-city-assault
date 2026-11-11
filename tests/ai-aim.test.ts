import { expect, it } from 'vitest';
import { classicAimPoint, interceptPoint, TargetTracker } from '../src/gameplay/ai-aim';

const origin = { x: 0, y: 3, z: 0 };
it('intercepts a stationary target at distance divided by bullet speed', () => {
  const shot = interceptPoint(origin, { x: 0, y: 3, z: -50 }, { x: 0, y: 0, z: 0 }, 100, 1)!;
  expect(shot.time).toBeCloseTo(0.5);
  expect(shot.point).toEqual({ x: 0, y: 3, z: -50 });
});
it('leads a moving target in all three axes using the actual bullet speed', () => {
  const target = { x: 10, y: 20, z: -45 }, velocity = { x: 20, y: 8, z: -6 };
  const shot = interceptPoint(origin, target, velocity, 95, 1.1)!;
  expect(shot.point.x).toBeGreaterThan(target.x);
  expect(shot.point.y).toBeGreaterThan(target.y);
  expect(Math.hypot(shot.point.x, shot.point.y - 3, shot.point.z)).toBeCloseTo(95 * shot.time, 8);
});
it('handles equal-speed linear interception and picks the earlier of two positive roots', () => {
  expect(interceptPoint(origin, { x: 100, y: 3, z: 0 }, { x: -100, y: 0, z: 0 }, 100, 2)?.time).toBeCloseTo(0.5);
  expect(interceptPoint(origin, { x: 100, y: 3, z: 0 }, { x: -200, y: 0, z: 0 }, 100, 2)?.time).toBeCloseTo(1 / 3);
});
it('rejects unreachable, expired, zero-speed and nonfinite solutions', () => {
  const target = { x: 100, y: 3, z: 0 };
  expect(interceptPoint(origin, target, { x: 200, y: 0, z: 0 }, 100, 2)).toBeNull();
  expect(interceptPoint(origin, target, { x: 0, y: 0, z: 0 }, 100, 0.5)).toBeNull();
  expect(interceptPoint(origin, target, { x: 0, y: 0, z: 0 }, 0, 2)).toBeNull();
  expect(interceptPoint(origin, target, { x: NaN, y: 0, z: 0 }, 100, 2)).toBeNull();
});
it('waits for reaction time and cannot instantly observe a target reversal', () => {
  const tracker = new TargetTracker(0.2);
  tracker.observe(0, { x: 0, y: 3, z: -40 }, { x: 10, y: 0, z: 0 });
  expect(tracker.read(0.1)).toBeNull();
  expect(tracker.read(0.2)?.position.x).toBeCloseTo(2);
  tracker.observe(0.21, { x: 2.1, y: 3, z: -40 }, { x: -10, y: 0, z: 0 });
  expect(tracker.read(0.3)?.velocity.x).toBe(10);
  expect(tracker.read(0.42)?.velocity.x).toBe(-10);
});
it('copies observations and resets target history when a new sortie resets time', () => {
  const tracker = new TargetTracker(0.1), target = { x: 1, y: 3, z: -40 };
  tracker.observe(10, target, { x: 0, y: 0, z: 0 }); target.x = 99;
  expect(tracker.read(10.2)?.position.x).toBe(1);
  tracker.observe(0, target, { x: 0, y: 0, z: 0 });
  expect(tracker.read(0.05)).toBeNull();
});
it('keeps the classic random aim and random call order exactly', () => {
  const values = [0.2, 0.7, 0.9];
  expect(classicAimPoint({ x: 10, y: 20, z: 30 }, () => values.shift()!)).toEqual({ x: 8.5, y: 24.03, z: 32 });
  expect(values).toHaveLength(0);
});
