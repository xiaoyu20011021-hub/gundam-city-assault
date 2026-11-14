import { expect, it } from 'vitest';
import { firstSegmentHit } from '../src/gameplay/combat';
import { moveBody } from '../src/gameplay/spatial';
import { pointBlocked } from '../src/gameplay/navigation';
import { createRemoteNavigation } from '../src/gameplay/remote-weapons/navigation';
import { buildingColliders } from '../src/content/maps/selene/collisions';
import { generateBlocks } from '../src/content/maps/selene/layout';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { stepEnemy } from '../src/gameplay/ai';

const bounds = { minX: -140, maxX: 140, minZ: -140, maxZ: 140 };
const overhead = { minX: -3, maxX: 3, minZ: -3, maxZ: 3, minY: 12, height: 15 };

it.each(['classic', 'enhanced'] as const)('%s flying AI climbs before raised tower bodies', mode => {
  const enemy = new Actor('enemy', getMechaDefinition('zaku'), 'enemy');
  const player = new Actor('player', getMechaDefinition('gundam'), 'player');
  try {
    enemy.position.set(0, 15, 0); enemy.flying = true; enemy.grounded = false;
    player.position.set(0, 6, -100);
    const wall = { minX: -8, maxX: 8, minZ: -7, maxZ: -3, minY: 5, height: 30 };
    stepEnemy(enemy, player, 1 / 60, 0, [wall], bounds, true, { mode, projectiles: [] });
    expect(enemy.velocity.y).toBeGreaterThan(0);
  } finally { enemy.dispose(); player.dispose(); }
});

it('allows movement, shots and funnels under raised solids and blocks their actual volume', () => {
  expect(pointBlocked({ x: 0, z: 0 }, [overhead], 1.2)).toBe(false);
  expect(firstSegmentHit({ x: 0, y: 6, z: -6 }, { x: 0, y: 6, z: 6 }, [overhead], [])).toBeNull();
  expect(firstSegmentHit({ x: 0, y: 13, z: -6 }, { x: 0, y: 13, z: 6 }, [overhead], [])?.type).toBe('wall');
  const moved = moveBody({ x: 0, y: 0, z: -6 }, { x: 0, y: 0, z: 12 }, 1.2, 6.2, [overhead], bounds);
  expect(moved.position.z).toBeCloseTo(6);
  const rising = moveBody({ x: 0, y: 0, z: 0 }, { x: 0, y: 20, z: 0 }, 1.2, 6.2, [overhead], bounds);
  expect(rising.position.y).toBeCloseTo(12 - 6.2);
  const remote = createRemoteNavigation([overhead], bounds).move({ x: 0, y: 6, z: -6 }, { x: 0, y: 6, z: 6 }, 12, .5);
  expect(remote.blocked).toBe(false); expect(remote.position.z).toBeCloseTo(6);
});

it('lands on the short split tower roof and leaves the high gap open', () => {
  const b = generateBlocks(87).find(b => b.x === 35 && b.z === 35)!;
  expect(b.style).toBe(1);
  const walls = buildingColliders(b), x = (b.x + b.width * .29) / 3, z = b.z / 3;
  const actualRoof = (b.height * .79 + 12) / 3;
  const landed = moveBody({ x, y: 95, z }, { x: 0, y: -90, z: 0 }, 1.2, 6.2, walls, bounds);
  expect(landed.position.y).toBeCloseTo(actualRoof, 4);
  const gapX = b.x / 3, gapY = (b.height * .9) / 3;
  expect(firstSegmentHit({ x: gapX, y: gapY, z: z - 8 }, { x: gapX, y: gapY, z: z + 8 }, walls, [])).toBeNull();
});

it('blocks the large lateral armor support beside a stepped tower', () => {
  const b = { x: 69, z: 69, width: 34, depth: 34, height: 150, style: 0 };
  const x = (b.x - b.width / 2 - 3) / 3, y = b.height * .43 / 3, z = b.z / 3;
  expect(firstSegmentHit({ x, y, z: z - 4 }, { x, y, z: z + 4 }, buildingColliders(b), [])?.type).toBe('wall');
});
