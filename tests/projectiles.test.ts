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
