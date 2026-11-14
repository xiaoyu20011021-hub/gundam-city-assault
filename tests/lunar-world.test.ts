import { describe, expect, it } from 'vitest';
import { Box3, BufferGeometry, InstancedMesh, Material, Mesh, Points, Texture } from 'three';
import { cityDefinition, CITY_COLLIDERS } from '../src/content/maps/city';

describe('lunar city world', () => {
  it('builds locally with finite geometry and independent collision data', async () => {
    const world = await cityDefinition.createWorld();
    try {
      expect(world.colliders).toEqual(CITY_COLLIDERS);
      expect(world.colliders[0]).not.toBe(CITY_COLLIDERS[0]);
      let batches = 0;
      world.root.traverse(object => {
        if (!(object instanceof Mesh) && !(object instanceof Points)) return;
        batches++;
        const box = new Box3().setFromObject(object);
        expect([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)).toBe(true);
      });
      expect(batches).toBeGreaterThan(0);
      expect(batches).toBeLessThan(120);
    } finally { world.dispose(); }
  });

  it('keeps solid building shells on the collision footprints', async () => {
    const world = await cityDefinition.createWorld();
    try {
      const shells = world.root.getObjectByName('building-shells') as InstancedMesh;
      expect(shells).toBeInstanceOf(InstancedMesh);
      expect(shells.count).toBe(CITY_COLLIDERS.length);
      for (let i = 0; i < shells.count; i++) {
        const mesh = new Mesh(shells.geometry, shells.material);
        shells.getMatrixAt(i, mesh.matrix);
        mesh.matrixAutoUpdate = false;
        mesh.matrixWorldNeedsUpdate = true;
        const box = new Box3().setFromObject(mesh);
        const c = CITY_COLLIDERS[i];
        expect(box.min.x).toBeCloseTo(c.minX, 3);
        expect(box.max.x).toBeCloseTo(c.maxX, 3);
        expect(box.min.z).toBeCloseTo(c.minZ, 3);
        expect(box.max.z).toBeCloseTo(c.maxZ, 3);
        expect(box.max.y).toBeCloseTo(c.height, 3);
      }
    } finally { world.dispose(); }
  });

  it('releases every shared GPU resource exactly once, even when disposed twice', async () => {
    const world = await cityDefinition.createWorld();
    const resources = new Set<BufferGeometry | Material | Texture | InstancedMesh>();
    world.root.traverse(object => {
      if (!(object instanceof Mesh) && !(object instanceof Points)) return;
      if (object instanceof InstancedMesh) resources.add(object);
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
      }
    });
    const counts = new Map<object, number>();
    for (const resource of resources) {
      const listener = () => { counts.set(resource, (counts.get(resource) ?? 0) + 1); };
      if (resource instanceof BufferGeometry) resource.addEventListener('dispose', listener);
      else if (resource instanceof Material) resource.addEventListener('dispose', listener);
      else if (resource instanceof Texture) resource.addEventListener('dispose', listener);
      else resource.addEventListener('dispose', listener);
    }
    world.dispose(); world.dispose();
    expect(world.root.children).toHaveLength(0);
    for (const resource of resources) expect(counts.get(resource)).toBe(1);
    const second = await cityDefinition.createWorld();
    expect(second.root.children.length).toBeGreaterThan(0);
    second.dispose();
  });
});
