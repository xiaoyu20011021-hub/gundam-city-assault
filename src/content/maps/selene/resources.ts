import { BufferGeometry, InstancedMesh, Material, Object3D, Texture } from 'three';

/** A map owns its resources, including shared materials and instancing buffers. */
export function createMapDisposer(root: Object3D, extraMaterials: Material[] = [], beforeDispose = () => {}): () => void {
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true; beforeDispose();
    const resources = new Set<BufferGeometry | Material | Texture | InstancedMesh>();
    const addMaterial = (material: Material) => {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
    };
    extraMaterials.forEach(addMaterial);
    root.traverse(object => {
      const drawable = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
      if (drawable.geometry) resources.add(drawable.geometry);
      if (drawable.material) (Array.isArray(drawable.material) ? drawable.material : [drawable.material]).forEach(addMaterial);
      if (object instanceof InstancedMesh) resources.add(object);
    });
    resources.forEach(resource => resource.dispose());
    root.removeFromParent(); root.clear();
  };
}
