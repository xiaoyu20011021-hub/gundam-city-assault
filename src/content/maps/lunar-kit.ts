import {
  BoxGeometry, BufferGeometry, CylinderGeometry, Euler, Group, InstancedMesh,
  Material, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry,
  Points, Quaternion, SphereGeometry, Texture, TorusGeometry, Vector3,
} from 'three';

type Shape = 'box' | 'cylinder' | 'rock' | 'sphere' | 'ring';
type Triple = [number, number, number];
export type Surface = 'hull' | 'armor' | 'pale' | 'metal' | 'dark' | 'glass' | 'cyan' | 'amber' | 'red' | 'soil' | 'rock' | 'road' | 'paint' | 'scorch' | 'star';

/** Each material/geometry combination is one draw batch for the whole district. */
export class LunarKit {
  private geometries = new Map<Shape, BufferGeometry>();
  private materials = new Map<Surface, Material>();
  private batches = new Map<string, { geometry: BufferGeometry; material: Material; matrices: Matrix4[]; shadow: boolean; name: string }>();
  private extras = new Set<BufferGeometry | Material | Texture>();
  private disposed = false;
  constructor(readonly root: Group) {}

  material(surface: Surface): Material {
    const cached = this.materials.get(surface);
    if (cached) return cached;
    const colors: Record<Surface, number> = {
      hull: 0x35414c, armor: 0x87949e, pale: 0xc2cbd0, metal: 0x566a76,
      dark: 0x17232e, glass: 0x18394b, cyan: 0x72d8ed, amber: 0xf4b458,
      red: 0xd8543b, soil: 0x75777d, rock: 0x939297, road: 0x303b47,
      paint: 0xc0c7c4, scorch: 0x1b2027, star: 0xb4c1d3,
    };
    const glow = ['cyan', 'amber', 'red', 'star'].includes(surface);
    const material = glow
      ? new MeshBasicMaterial({ color: colors[surface], toneMapped: false })
      : new MeshStandardMaterial({ color: colors[surface], roughness: surface === 'glass' ? 0.3 : 0.87,
        metalness: ['soil', 'rock', 'scorch', 'paint'].includes(surface) ? 0 : 0.28 });
    this.materials.set(surface, material);
    return material;
  }

  geometry(shape: Shape): BufferGeometry {
    let geometry = this.geometries.get(shape);
    if (!geometry) {
      geometry = shape === 'box' ? new BoxGeometry(1, 1, 1)
        : shape === 'cylinder' ? new CylinderGeometry(0.5, 0.5, 1, 16)
        : shape === 'sphere' ? new SphereGeometry(1, 20, 12)
        : shape === 'ring' ? new TorusGeometry(1, 0.035, 4, 64)
        : new OctahedronGeometry(1, 0);
      this.geometries.set(shape, geometry);
    }
    return geometry;
  }

  add(shape: Shape, surface: Surface, position: Triple, scale: Triple, rotation: Triple = [0, 0, 0], name = '', shadow = true): void {
    const key = `${shape}/${surface}/${shadow}/${name}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { geometry: this.geometry(shape), material: this.material(surface), matrices: [], shadow,
        name: name || `lunar-${shape}-${surface}` };
      this.batches.set(key, batch);
    }
    batch.matrices.push(new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...rotation)), new Vector3(...scale)));
  }

  box(surface: Surface, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0, name = '', shadow = true): void {
    this.add('box', surface, [x, y, z], [w, h, d], [0, yaw, 0], name, shadow);
  }

  track<T extends BufferGeometry | Material | Texture>(resource: T): T {
    this.extras.add(resource);
    return resource;
  }

  flush(): void {
    for (const batch of this.batches.values()) {
      const mesh = new InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      mesh.name = batch.name;
      mesh.castShadow = batch.shadow;
      mesh.receiveShadow = batch.shadow;
      batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.root.add(mesh);
    }
    this.batches.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); });
    const resources = new Set<BufferGeometry | Material | Texture>([...this.geometries.values(), ...this.materials.values(), ...this.extras]);
    // Also cover optional sky meshes and their texture slots.
    this.root.traverse(object => {
      if (!(object instanceof Mesh) && !(object instanceof Points)) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
      }
    });
    resources.forEach(resource => resource.dispose());
    this.root.clear();
    this.root.removeFromParent();
    this.batches.clear(); this.geometries.clear(); this.materials.clear(); this.extras.clear();
  }
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
