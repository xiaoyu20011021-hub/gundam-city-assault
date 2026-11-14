import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, BufferGeometry, Group, InstancedMesh, Material, Mesh, MeshStandardMaterial, Texture, TextureLoader, Raycaster, Vector3, Matrix4, PerspectiveCamera } from 'three';
import { createMapDisposer } from '../src/content/maps/selene/resources';
import { seleneDefinition } from '../src/content/maps/selene';
import { generateBlocks } from '../src/content/maps/selene/layout';
import { moveBody } from '../src/gameplay/spatial';
import { Game } from '../src/gameplay/game';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('releases shared geometry, materials, textures and instancing buffers exactly once', () => {
  const root = new Group(), geometry = new BoxGeometry(), texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture });
  const first = new InstancedMesh(geometry, material, 2), second = new Mesh(geometry, material);
  root.add(first, second);
  const calls = [geometry, material, texture, first].map(resource => vi.spyOn(resource, 'dispose'));
  const dispose = createMapDisposer(root); dispose(); dispose();
  expect(root.children.length).toBe(0); calls.forEach(call => expect(call).toHaveBeenCalledTimes(1));
});

it('builds a finite independent world, animates it and prevents late textures after disposal', async () => {
  const context = new Proxy({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 400 }),
  }, { get: (target, key) => key in target ? target[key as keyof typeof target] : () => {} });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  let loaded!: (texture: Texture<HTMLImageElement>) => void;
  vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    loaded = onLoad!; return new Texture();
  });
  const world = await seleneDefinition.createWorld();
  expect(world.root.name).toBe('selene-von-braun');
  expect(world.colliders.length).toBeGreaterThan(50);
  const b = generateBlocks(87).find(b => b.x === 35 && b.z === 35)!;
  const x = (b.x + b.width * .29) / 3, z = b.z / 3;
  const architecture = world.root.getObjectByName('Planned city / civic and residential structures')!;
  const visible = new Raycaster(new Vector3(x, 95, z), new Vector3(0, -1, 0)).intersectObject(architecture, true)[0].point.y;
  const landed = moveBody({ x, y: 95, z }, { x: 0, y: -90, z: 0 }, 1.2, 6.2, world.colliders, seleneDefinition.bounds);
  expect(landed.position.y).toBeCloseTo(visible, 3);
  const camera = new PerspectiveCamera();
  const game = Object.assign(Object.create(Game.prototype), { map: seleneDefinition, mode: 'gallery', exhibit: [],
    graphics: { camera, followSun() {} }, simulationTime: 0 });
  game.updateExhibit(0);
  let cameraInsideStructure = false;
  const matrix = new Matrix4();
  world.root.traverse(object => {
    if (!(object instanceof InstancedMesh) || !(object.geometry instanceof BoxGeometry)) return;
    object.geometry.computeBoundingBox();
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrix); matrix.premultiply(object.matrixWorld);
      if (object.geometry.boundingBox!.clone().applyMatrix4(matrix).containsPoint(camera.position)) cameraInsideStructure = true;
    }
  });
  expect(cameraInsideStructure, 'gallery camera must stay outside station roof and other solids').toBe(false);
  const resources = new Set<BufferGeometry | Material | Texture | InstancedMesh>();
  world.root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.geometry) return;
    resources.add(mesh.geometry);
    if (mesh instanceof InstancedMesh) {
      resources.add(mesh);
      expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
    }
  });
  expect(resources.size).toBeGreaterThan(20);
  const calls = [...resources].map(resource => vi.spyOn(resource, 'dispose'));
  world.update!(1 / 60); world.dispose(); world.dispose(); world.update!(1 / 60);
  expect(world.root.children.length).toBe(0);
  calls.forEach(call => expect(call).toHaveBeenCalledTimes(1));
  const late = new Texture<HTMLImageElement>(), released = vi.spyOn(late, 'dispose'); loaded(late);
  expect(released).toHaveBeenCalledTimes(1);
}, 20000);
