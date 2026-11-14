import { expect, it } from 'vitest';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';
import { WEAPON_DEFINITIONS } from '../src/content/weapons';
import { ProjectileSystem } from '../src/gameplay/projectiles';

it('renders the GM spray gun with the same beam silhouette as the rifle', () => {
  const owner = new Actor('player', getMechaDefinition('gm'), 'player');
  const shots = new ProjectileSystem();
  const mesh = shots.root.children[0] as InstancedMesh;
  const lengths: number[] = [];
  for (const id of ['beam-rifle', 'beam-spray-gun', 'zaku-machinegun']) {
    shots.clear();
    shots.fire(owner, new Vector3(0, 3, 0), new Vector3(0, 0, -1), WEAPON_DEFINITIONS[id]);
    shots.update(1 / 60, [], [], () => {});
    const transform = new Matrix4(); mesh.getMatrixAt(0, transform);
    lengths.push(new Vector3().setFromMatrixScale(transform).z);
  }
  expect(lengths[1]).toBeCloseTo(lengths[0]);
  expect(lengths[1]).toBeGreaterThan(lengths[2]);
  shots.dispose(); owner.dispose();
});

it('exposes detached active-shot snapshots and never reuses a shot identity', () => {
  const owner = new Actor('player', getMechaDefinition('gm'), 'player'), shots = new ProjectileSystem();
  shots.fire(owner, new Vector3(0, 3, 0), new Vector3(0, 0, -1), WEAPON_DEFINITIONS['zaku-machinegun']);
  const snapshot = shots.snapshot(), id = snapshot[0].id;
  expect(snapshot[0].team).toBe('player');
  expect(snapshot[0].velocity.z).toBe(-95);
  shots.update(0.1, [], [], () => {});
  expect(snapshot[0].position.z).toBe(0);
  expect(shots.snapshot()[0].position.z).toBeCloseTo(-9.5);
  snapshot[0].position.x = 999;
  expect(shots.snapshot()[0].position.x).toBe(0);
  shots.clear(); expect(shots.snapshot()).toHaveLength(0);
  shots.fire(owner, new Vector3(), new Vector3(0, 0, -1), WEAPON_DEFINITIONS['zaku-machinegun']);
  expect(shots.snapshot()[0].id).toBeGreaterThan(id);
  shots.update(2, [], [], () => {}); expect(shots.snapshot()).toHaveLength(0);
  shots.dispose(); owner.dispose();
});
