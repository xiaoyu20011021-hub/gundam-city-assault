import {
  Box3, BoxGeometry, CylinderGeometry, Group, InstancedMesh,
  LoadingManager, Material, Matrix4, Mesh, MeshStandardMaterial, Quaternion, RingGeometry, Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MapDefinition, MapWorld, RectCollider } from './types';

export interface CityBuilding {
  model: string; x: number; z: number; width: number; depth: number; height: number;
  rotation?: number;
}

// Collision footprints share the same data as the rendered buildings.
export const CITY_BUILDINGS: CityBuilding[] = [
  { model: 'building-f', x: -43, z: -43, width: 27, depth: 29, height: 37 },
  { model: 'building-j', x: 43, z: -43, width: 31, depth: 29, height: 29 },
  { model: 'building-h', x: -43, z: 43, width: 28, depth: 28, height: 29, rotation: Math.PI },
  { model: 'building-b', x: 43, z: 43, width: 28, depth: 28, height: 32, rotation: Math.PI },
  { model: 'building-c', x: -108, z: -43, width: 26, depth: 28, height: 23 },
  { model: 'building-skyscraper-a', x: 108, z: -43, width: 25, depth: 26, height: 57 },
  { model: 'building-a', x: -108, z: 43, width: 26, depth: 28, height: 30, rotation: Math.PI },
  { model: 'building-f', x: 108, z: 43, width: 26, depth: 28, height: 39, rotation: Math.PI },
  { model: 'building-m', x: -43, z: -108, width: 28, depth: 26, height: 52 },
  { model: 'building-a', x: 43, z: -108, width: 28, depth: 26, height: 30 },
  { model: 'building-j', x: -43, z: 108, width: 31, depth: 26, height: 28, rotation: Math.PI },
  { model: 'building-skyscraper-b', x: 43, z: 108, width: 26, depth: 26, height: 64 },
  { model: 'building-skyscraper-a', x: -108, z: -108, width: 25, depth: 25, height: 56 },
  { model: 'building-skyscraper-d', x: 108, z: -108, width: 25, depth: 25, height: 69 },
  { model: 'building-m', x: -108, z: 108, width: 26, depth: 26, height: 54 },
  { model: 'building-skyscraper-a', x: 108, z: 108, width: 25, depth: 25, height: 58 },
];

export const CITY_COLLIDERS: RectCollider[] = CITY_BUILDINGS.map(b => ({
  minX: b.x - b.width / 2, maxX: b.x + b.width / 2,
  minZ: b.z - b.depth / 2, maxZ: b.z + b.depth / 2, height: b.height,
}));

const COMMERCIAL = ['building-a', 'building-b', 'building-c', 'building-f', 'building-h',
  'building-j', 'building-m', 'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-d'];
const ROADS = ['road-straight', 'road-intersection-line', 'road-intersection-path', 'road-square',
  'tile-low', 'traffic-light', 'road-sign-street'];
interface Placement { x: number; z: number; y?: number; width: number; depth: number; height: number; rotation?: number }

function disposeObjects(objects: Group[]): void {
  const geometries = new Set<BoxGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<import('three').Texture>();
  for (const group of objects) group.traverse(object => {
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh) object.dispose();
    geometries.add(object.geometry as BoxGeometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      // All texture slots are released, including shared GLTF palette maps.
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as import('three').Texture);
      }
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

function instanceModel(root: Group, prototype: Group, placements: Placement[], name: string): void {
  if (!placements.length) return;
  prototype.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(prototype);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const origin = new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z);
  prototype.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const instances = new InstancedMesh(object.geometry, object.material, placements.length);
    instances.name = name;
    instances.castShadow = name.startsWith('building') || name.includes('light');
    instances.receiveShadow = true;
    placements.forEach((p, i) => {
      const transform = new Matrix4().compose(
        new Vector3(p.x, p.y ?? 0, p.z),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.rotation ?? 0),
        new Vector3(p.width / size.x, p.height / size.y, p.depth / size.z),
      );
      transform.multiply(origin).multiply(object.matrixWorld);
      instances.setMatrixAt(i, transform);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    root.add(instances);
  });
}

function addProceduralDetails(root: Group): void {
  const concrete = new MeshStandardMaterial({ color: '#bac6c8', roughness: 0.92 });
  const dark = new MeshStandardMaterial({ color: '#263943', roughness: 0.88 });
  const light = new MeshStandardMaterial({ color: '#dbe2dc', roughness: 0.95 });
  const green = new MeshStandardMaterial({ color: '#459279', roughness: 0.87 });
  const bark = new MeshStandardMaterial({ color: '#706a54', roughness: 0.9 });
  const grass = new MeshStandardMaterial({ color: '#879d7d', roughness: 1 });
  const ground = new Mesh(new BoxGeometry(420, 1, 420), concrete);
  ground.position.y = -0.57;
  ground.receiveShadow = true;
  ground.name = 'city-ground';
  root.add(ground);

  // A clear battle square with broad entrances and subtle paving seams.
  const plaza = new Mesh(new BoxGeometry(52, 0.06, 52), light);
  plaza.position.y = 0.01;
  plaza.receiveShadow = true;
  root.add(plaza);
  const seams: Placement[] = [];
  for (let n = -24; n <= 24; n += 8) {
    seams.push({ x: n, z: 0, width: 0.055, height: 0.015, depth: 52, y: 0.05 });
    seams.push({ x: 0, z: n, width: 52, height: 0.015, depth: 0.055, y: 0.05 });
  }
  const boxInstances = (geometry: BoxGeometry, material: Material, entries: Placement[], name: string) => {
    const mesh = new InstancedMesh(geometry, material, entries.length);
    const dummy = new Matrix4();
    entries.forEach((p, i) => {
      dummy.compose(new Vector3(p.x, p.y ?? p.height / 2, p.z),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.rotation ?? 0), new Vector3(p.width, p.height, p.depth));
      mesh.setMatrixAt(i, dummy);
    });
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = name !== 'paving-seams';
    mesh.computeBoundingSphere();
    root.add(mesh);
  };
  boxInstances(new BoxGeometry(1, 1, 1), concrete, seams, 'paving-seams');

  const ring = new Mesh(new RingGeometry(9.2, 9.35, 64), green);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  root.add(ring);
  const landingRing = new Mesh(new RingGeometry(6.2, 6.45, 48), green);
  landingRing.rotation.x = -Math.PI / 2;
  landingRing.position.set(0, 0.04, 55);
  root.add(landingRing);

  // Planting beds occupy sidewalks, leaving the central roads unobstructed.
  const trees: { x: number; z: number; height: number }[] = [];
  const beds: Placement[] = [];
  for (const xSign of [-1, 1]) for (const zSign of [-1, 1]) {
    for (const offset of [32, 48, 102, 118]) {
      trees.push({ x: xSign * 20.5, z: zSign * offset, height: 5.6 + (offset % 3) * 0.5 });
      trees.push({ x: xSign * offset, z: zSign * 20.5, height: 5.8 });
    }
    beds.push({ x: xSign * 20.5, z: zSign * 42, width: 5, depth: 36, height: 0.12, y: 0.08 });
    beds.push({ x: xSign * 42, z: zSign * 20.5, width: 36, depth: 5, height: 0.12, y: 0.08 });
  }
  boxInstances(new BoxGeometry(1, 1, 1), grass, beds, 'sidewalk-gardens');
  const trunks = new InstancedMesh(new CylinderGeometry(0.28, 0.4, 1, 6), bark, trees.length);
  root.add(trunks);
  // The crown is built as two faceted cones rather than a large imported tree pack.
  const foliage = new InstancedMesh(new CylinderGeometry(0.8, 2.5, 3, 7), green, trees.length * 2);
  const transform = new Matrix4();
  trees.forEach((tree, i) => {
    transform.compose(new Vector3(tree.x, tree.height / 3, tree.z), new Quaternion(), new Vector3(1, tree.height * 0.55, 1));
    trunks.setMatrixAt(i, transform);
    transform.compose(new Vector3(tree.x, tree.height * 0.75, tree.z), new Quaternion(), new Vector3(1, 1, 1));
    foliage.setMatrixAt(i * 2, transform);
    transform.compose(new Vector3(tree.x, tree.height * 1.02, tree.z), new Quaternion(), new Vector3(0.77, 0.85, 0.77));
    foliage.setMatrixAt(i * 2 + 1, transform);
  });
  trunks.castShadow = foliage.castShadow = true;
  trunks.computeBoundingSphere(); foliage.computeBoundingSphere();
  root.add(foliage);

  const barriers: Placement[] = [];
  for (let n = -120; n <= 120; n += 20) {
    if (Math.abs(n) < 16 || Math.abs(Math.abs(n) - 80) < 15) continue;
    barriers.push({ x: n, z: -132, width: 16, depth: 0.7, height: 1.4 });
    barriers.push({ x: n, z: 132, width: 16, depth: 0.7, height: 1.4 });
    barriers.push({ x: -132, z: n, width: 0.7, depth: 16, height: 1.4 });
    barriers.push({ x: 132, z: n, width: 0.7, depth: 16, height: 1.4 });
  }
  boxInstances(new BoxGeometry(1, 1, 1), dark, barriers, 'perimeter-barriers');

  // Light markers give the playable avenues an architectural rhythm.
  const bollards: Placement[] = [];
  for (let n = -120; n <= 120; n += 20) {
    if (Math.abs(n) < 28 || Math.abs(Math.abs(n) - 78) < 18) continue;
    for (const side of [-1, 1]) {
      bollards.push({ x: side * 15.5, z: n, width: 0.65, depth: 0.65, height: 1.5 });
      bollards.push({ x: n, z: side * 15.5, width: 0.65, depth: 0.65, height: 1.5 });
    }
  }
  boxInstances(new BoxGeometry(1, 1, 1), dark, bollards, 'avenue-bollards');
}

async function createCityWorld(onProgress?: (message: string) => void): Promise<MapWorld> {
  const root = new Group();
  root.name = 'city-district';
  const missingAssets: string[] = [];
  const manager = new LoadingManager();
  manager.onError = path => { missingAssets.push(path); };
  const loader = new GLTFLoader(manager);
  const requests = [...COMMERCIAL.map(model => ({ pack: 'commercial', model })),
    ...ROADS.map(model => ({ pack: 'roads', model }))];
  let loaded = 0;
  onProgress?.('正在载入本地 Kenney 城市素材…');
  const results = await Promise.allSettled(requests.map(async ({ pack, model }) => {
    const path = `${import.meta.env.BASE_URL}assets/kenney/${pack}/${model}.glb`;
    try {
      const gltf = await loader.loadAsync(path);
      loaded++;
      onProgress?.(`城市资源 ${loaded}/${requests.length} · ${model}`);
      return { model, scene: gltf.scene };
    } catch {
      throw new Error(`城市素材载入失败：${model}.glb。请确认本地 assets 文件完整后重试。`);
    }
  }));
  const prototypes = new Map<string, Group>();
  results.forEach(result => { if (result.status === 'fulfilled') prototypes.set(result.value.model, result.value.scene); });
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') {
    disposeObjects([...prototypes.values()]);
    throw failed.reason;
  }
  // GLTFLoader can resolve after a missing image using an empty material.
  // Surface that failure so the UI offers retry instead of a broken white city.
  if (missingAssets.length) {
    disposeObjects([...prototypes.values()]);
    throw new Error(`城市贴图载入失败：${missingAssets[0].split('/').at(-1)}。请检查本地素材后重试。`);
  }
  try {
    addProceduralDetails(root);
    for (const model of COMMERCIAL) {
      const placements: Placement[] = CITY_BUILDINGS.filter(b => b.model === model);
      // Buildings beyond the arena make a complete skyline without extra collision work.
      for (let i = 0; i < 6; i++) {
        if (COMMERCIAL[i % COMMERCIAL.length] !== model) continue;
        const n = -150 + i * 60;
        placements.push({ x: n, z: -168, width: 28, depth: 26, height: 50 + i * 8 });
        placements.push({ x: -170, z: n, width: 28, depth: 26, height: 40 + i * 6 });
        placements.push({ x: 170, z: n, width: 28, depth: 26, height: 55 + i * 5 });
        placements.push({ x: n, z: 168, width: 28, depth: 26, height: 45 + i * 7 });
      }
      instanceModel(root, prototypes.get(model)!, placements, model);
    }
    const roadPlacements = new Map<string, Placement[]>(ROADS.map(model => [model, []]));
    for (let x = -130; x <= 130; x += 26) for (let z = -130; z <= 130; z += 26) {
      const northSouth = x === 0 || Math.abs(x) === 78;
      const eastWest = z === 0 || Math.abs(z) === 78;
      let model = 'tile-low';
      if (northSouth && eastWest) model = x === 0 && z === 0 ? 'road-square' : 'road-intersection-path';
      else if (northSouth || eastWest) model = 'road-straight';
      roadPlacements.get(model)!.push({ x, z, width: 26, depth: 26, height: 0.07, y: -0.065,
        rotation: eastWest && !northSouth ? Math.PI / 2 : 0 });
    }
    for (const [x, z] of [[-16, -30], [16, 30], [-30, 16], [30, -16], [-94, -94], [94, 94]]) {
      roadPlacements.get('traffic-light')!.push({ x, z, width: 1.5, depth: 1.4, height: 6.5,
        rotation: x > 0 ? Math.PI : 0 });
    }
    for (const [x, z] of [[-17, -62], [17, 62], [-62, 17], [62, -17]]) {
      roadPlacements.get('road-sign-street')!.push({ x, z, width: 2.6, depth: 2.6, height: 5.5 });
    }
    for (const model of ROADS) instanceModel(root, prototypes.get(model)!, roadPlacements.get(model)!, model);
  } catch (error) {
    disposeObjects([root, ...prototypes.values()]);
    throw error;
  }
  onProgress?.('城市街区准备完成');
  let disposed = false;
  return {
    root,
    colliders: CITY_COLLIDERS.map(c => ({ ...c })),
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeObjects([root, ...prototypes.values()]);
      root.clear();
    },
  };
}

export const cityDefinition: MapDefinition = {
  id: 'city', name: '新东京 · 城市战线', subtitle: 'DAYLIGHT / URBAN COMBAT',
  bounds: { minX: -130, maxX: 130, minZ: -130, maxZ: 130 },
  playerSpawn: { x: 0, z: 55 },
  enemySpawns: [
    { x: -78, z: -78 }, { x: 0, z: -106 }, { x: 78, z: -78 }, { x: 104, z: 0 },
    { x: -104, z: 0 }, { x: -78, z: 78 }, { x: 78, z: 78 }, { x: 0, z: -52 },
    { x: -52, z: 0 }, { x: 52, z: 0 }, { x: 0, z: 108 },
  ],
  waves: [
    { title: '第一波 · 侦察小队', enemies: Array(4).fill('zaku') },
    { title: '第二波 · 城市突击', enemies: Array(6).fill('zaku') },
    { title: '最终波 · 赤色彗星', enemies: ['char-zaku', ...Array(4).fill('zaku')] },
  ],
  createWorld: createCityWorld,
};
