import { expect, it } from 'vitest';
import { colliderIndex } from '../src/gameplay/collider-index';
import { SELENE_COLLIDERS } from '../src/content/maps/selene';

it('matches brute-force bounds queries, including cell boundaries and negative coordinates', () => {
  const index = colliderIndex(SELENE_COLLIDERS);
  for (let i = 0; i < 180; i++) {
    const x = (i * 37 % 290) - 145, z = (i * 61 % 290) - 145;
    const expected = SELENE_COLLIDERS.filter(w => w.maxX >= x && w.minX <= x + 17 && w.maxZ >= z && w.minZ <= z + 13);
    expect(new Set(index.query(x, x + 17, z, z + 13))).toEqual(new Set(expected));
  }
});

it('limits local candidates without omitting walls spanning many cells', () => {
  const walls = [...SELENE_COLLIDERS, { minX: -200, maxX: 200, minZ: -1, maxZ: 1, height: 9 }];
  const found = colliderIndex(walls).query(-2, 2, -2, 2);
  expect(found).toContain(walls.at(-1));
  expect(found.length).toBeLessThan(walls.length / 10);
  expect(colliderIndex(walls)).toBe(colliderIndex(walls));
});
