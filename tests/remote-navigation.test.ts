import { expect, it } from 'vitest';
import { createRemoteNavigation } from '../src/gameplay/remote-weapons/navigation';
import type { RectCollider } from '../src/content/maps/types';
import { segmentBox, type Point3 } from '../src/gameplay/combat';

const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
function travel(walls: RectCollider[], start: Point3, goal: Point3, steps = 300): Point3 {
  const nav = createRemoteNavigation(walls, bounds);
  let position = start;
  for (let i = 0; i < steps && Math.hypot(position.x - goal.x, position.y - goal.y, position.z - goal.z) > 0.001; i++) {
    const result = nav.move(position, goal, 0.7, 0.5);
    expect(Math.hypot(result.position.x - position.x, result.position.y - position.y, result.position.z - position.z)).toBeLessThanOrEqual(0.700001);
    for (const wall of walls) expect(segmentBox(position, result.position,
      { x: wall.minX - 0.5, y: -0.5, z: wall.minZ - 0.5 },
      { x: wall.maxX + 0.5, y: wall.height + 0.5, z: wall.maxZ + 0.5 })).toBeNull();
    expect(result.position.y).toBeGreaterThanOrEqual(0.5);
    expect(result.position.y).toBeLessThanOrEqual(99.5);
    expect(result.position.x).toBeGreaterThanOrEqual(-19.5);
    expect(result.position.x).toBeLessThanOrEqual(19.5);
    position = result.position;
  }
  return position;
}

it('moves directly, caps distance, and checks exact wall visibility', () => {
  const nav = createRemoteNavigation([{ minX: 0, maxX: 0.01, minZ: -2, maxZ: 2, height: 8 }], bounds);
  expect(nav.lineClear({ x: -5, y: 3, z: 0 }, { x: 5, y: 3, z: 0 })).toBe(false);
  expect(nav.lineClear({ x: -5, y: 9, z: 0 }, { x: 5, y: 9, z: 0 })).toBe(true);
  expect(nav.move({ x: -5, y: 3, z: 5 }, { x: 5, y: 3, z: 5 }, 2, 0.5)).toEqual({ position: { x: -3, y: 3, z: 5 }, blocked: false });
});

it('sweeps through a thin wall safely and eventually clears its roof', () => {
  const wall = { minX: 0, maxX: 0.01, minZ: -20, maxZ: 20, height: 8 };
  const goal = { x: 5, y: 3, z: 0 };
  expect(travel([wall], { x: -5, y: 3, z: 0 }, goal)).toEqual(goal);
  const result = createRemoteNavigation([wall], bounds).move({ x: -5, y: 3, z: 0 }, goal, 100, 0.5);
  expect(result.position.x).toBeLessThan(0);
  expect(result.position.y).toBeGreaterThan(8.5);
});

it('takes side waypoints around walls too tall to overfly', () => {
  const goal = { x: 8, y: 3, z: 0 };
  expect(travel([{ minX: -1, maxX: 1, minZ: -5, maxZ: 5, height: 110 }], { x: -8, y: 3, z: 0 }, goal)).toEqual(goal);
});

it('converges around adjacent roof corners into a dock close to a wall', () => {
  const walls = [
    { minX: -2, maxX: 2, minZ: -6, maxZ: 2, height: 110 },
    { minX: 2, maxX: 7, minZ: -2, maxZ: 2, height: 110 },
  ];
  const goal = { x: 7.6, y: 3, z: -1 };
  expect(travel(walls, { x: -5, y: 3, z: -5 }, goal)).toEqual(goal);
});

it('waits safely when a wall seals the map and resumes when the dock moves', () => {
  const nav = createRemoteNavigation([{ minX: -1, maxX: 1, minZ: -20, maxZ: 20, height: 110 }], bounds);
  const position = { x: -3, y: 4, z: 0 };
  expect(nav.move(position, { x: 3, y: 4, z: 0 }, 5, 0.5)).toEqual({ position, blocked: true });
  expect(nav.move(position, { x: -3, y: 4, z: 8 }, 1, 0.5)).toEqual({ position: { x: -3, y: 4, z: 1 }, blocked: false });
});

it('does not teleport to a dock outside the map or inside a building', () => {
  const position = { x: -3, y: 4, z: 0 };
  const nav = createRemoteNavigation([{ minX: 0, maxX: 1, minZ: -2, maxZ: 2, height: 10 }], bounds);
  for (const goal of [{ x: 0.1, y: 4, z: 0 }, { x: 21, y: 4, z: 0 }, { x: -3, y: 101, z: 0 }]) {
    expect(nav.move(position, goal, 1, 0.5)).toEqual({ position, blocked: true });
  }
});

it('bounds search work and resumes a tall-wall route across steps for an identified unit', () => {
  const walls = [{ minX: -1, maxX: 1, minZ: -5, maxZ: 5, height: 110 }];
  const nav = createRemoteNavigation(walls, bounds);
  let position = { x: -8, y: 3, z: 0 };
  const goal = { x: 8, y: 3, z: 0 };
  for (let i = 0; i < 400 && Math.hypot(position.x - goal.x, position.z - goal.z) > .001; i++) {
    nav.beginStep(3);
    const result = nav.move(position, goal, .7, .5, 'unit-1');
    expect(nav.stats.searchSteps).toBeLessThanOrEqual(3);
    expect(segmentBox(position, result.position, { x: -1.5, y: -.5, z: -5.5 }, { x: 1.5, y: 110.5, z: 5.5 })).toBeNull();
    position = result.position;
  }
  expect(position).toEqual(goal);
  expect(nav.stats.plans).toBe(1);
});

it('rechecks a moving dock and never follows a cached final segment into a building', () => {
  const nav = createRemoteNavigation([{ minX: -1, maxX: 1, minZ: -5, maxZ: 5, height: 110 }], bounds);
  let position = { x: -8, y: 3, z: 0 };
  nav.beginStep(1000);
  position = nav.move(position, { x: 8, y: 3, z: 0 }, .7, .5, 'unit').position;
  nav.beginStep();
  expect(nav.move(position, { x: 0, y: 3, z: 0 }, .7, .5, 'unit')).toEqual({ position, blocked: true });
});

it('keeps making search progress when a valid dock moves while planning', () => {
  const nav = createRemoteNavigation([{ minX: -1, maxX: 1, minZ: -5, maxZ: 5, height: 110 }], bounds);
  let position = { x: -8, y: 3, z: 0 };
  for (let i = 0; i < 250; i++) {
    nav.beginStep(3);
    const goal = { x: 8, y: 3, z: i % 2 ? 3 : -3 };
    position = nav.move(position, goal, .7, .5, 'moving-dock').position;
  }
  expect(position.x).toBeGreaterThan(1.5);
  expect(nav.stats.plans).toBeLessThan(10);
});

it('allows all six funnels to finish concurrent searches without starving later units', () => {
  const nav = createRemoteNavigation([{ minX: -1, maxX: 1, minZ: -5, maxZ: 5, height: 110 }], bounds);
  const positions = Array.from({ length: 6 }, (_, i) => ({ x: -8, y: 3 + i, z: 0 }));
  for (let step = 0; step < 300; step++) {
    nav.beginStep();
    for (let i = 0; i < 6; i++) positions[i] = nav.move(positions[i], { x: 8, y: 3 + i, z: 0 }, .7, .5, `unit-${i}`).position;
    expect(nav.stats.searchSteps).toBeLessThanOrEqual(4096);
  }
  positions.forEach((p,i) => expect(p).toEqual({ x: 8, y: 3 + i, z: 0 }));
});
