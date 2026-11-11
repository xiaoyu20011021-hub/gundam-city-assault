import { expect, it } from 'vitest';
import { InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import { Batch } from '../src/content/maps/selene/batch';

it('partitions static instances spatially while retaining transformed positions and tight bounds', () => {
  const batch = new Batch(600), material = new MeshStandardMaterial();
  batch.box(material, -900, 0, 0, 10, 10, 10);
  batch.frame(900, 0, 0, 0, () => batch.box(material, 1, 0, 0, 10, 10, 10));
  const root = batch.finish();
  expect(root.children).toHaveLength(2);
  const positions: number[] = [];
  for (const child of root.children) {
    const mesh = child as InstancedMesh, matrix = new Matrix4();
    mesh.getMatrixAt(0, matrix); positions.push(new Vector3().setFromMatrixPosition(matrix).x);
    expect(mesh.boundingSphere!.radius).toBeLessThan(10);
  }
  expect(positions.sort((a,b)=>a-b)).toEqual([-900, 901]);
});
