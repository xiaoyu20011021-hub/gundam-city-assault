import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshBasicMaterial } from 'three';
import type { MapWorld } from '../types';
import { SELENE_COLLIDERS, SELENE_SCALE, seleneDefinition } from '../selene';
import { createMaterials } from './materials';
import { createArchitecture } from './architecture';
import { createFacilities } from './facilities';
import { createEnvironment } from './environment';
import { createTraffic } from './traffic';
import { createHangarUnits } from './hangar';
import { createMapDisposer } from './resources';

function addBoundary(root: Group): void {
  const { minX, maxX, minZ, maxZ } = seleneDefinition.bounds;
  const material = new MeshBasicMaterial({ color: 0xcda66a });
  const marks = new InstancedMesh(new BoxGeometry(1, 1, 1), material, 112);
  marks.name = 'Central district battle perimeter';
  const matrix = new Matrix4(); let index = 0;
  for (let n = 0; n < 28; n++) {
    const p = minX + 5 + n * 10;
    for (const z of [minZ, maxZ]) { matrix.makeScale(3, .07, .3).setPosition(p, .05, z); marks.setMatrixAt(index++, matrix); }
    for (const x of [minX, maxX]) { matrix.makeScale(.3, .07, 3).setPosition(x, .05, p); marks.setMatrixAt(index++, matrix); }
  }
  marks.computeBoundingSphere(); root.add(marks);
}

export async function createSeleneWorld(onProgress?: (message: string) => void): Promise<MapWorld> {
  const root = new Group(); root.name = 'selene-von-braun';
  const city = new Group(); city.scale.setScalar(SELENE_SCALE); root.add(city);
  const materials = createMaterials();
  let environment: ReturnType<typeof createEnvironment> | undefined;
  let stopped = false, elapsed = 0;
  const dispose = createMapDisposer(root, Object.values(materials), () => { stopped = true; environment?.dispose(); });
  try {
    onProgress?.('构建冯·布朗城区、宇宙港与质量投射器…');
    environment = createEnvironment(city, materials);
    city.add(createArchitecture(materials)); city.add(createFacilities(materials)); city.add(createHangarUnits());
    const traffic = createTraffic(materials); city.add(traffic.root);
    traffic.root.traverse(object => { object.castShadow = false; }); traffic.update(0);
    addBoundary(root); root.updateMatrixWorld(true);
    onProgress?.('SELENE 中央城区准备完成');
    return { root, colliders: SELENE_COLLIDERS.map(c => ({ ...c })), dispose,
      update(dt) {
        if (stopped) return;
        elapsed += Math.max(0, Math.min(.1, dt)); traffic.update(elapsed);
        environment!.earth.rotation.y = elapsed * .0005;
      } };
  } catch (error) { dispose(); throw error; }
}
