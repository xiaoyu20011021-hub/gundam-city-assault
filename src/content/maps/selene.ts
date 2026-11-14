import type { MapDefinition, RectCollider } from './types';
import { generateBlocks } from './selene/layout';
import { buildingColliders, landmarkColliders } from './selene/collisions';
import { cityDefinition } from './city';

export { SELENE_SCALE } from './selene/layout';
export const SELENE_COLLIDERS: RectCollider[] = [
  ...generateBlocks(87).flatMap(buildingColliders), ...landmarkColliders(),
  ...buildingColliders({ x: 130, z: 85, width: 69, depth: 60, height: 230, style: 3 }),
].filter(c => c.maxX >= -145 && c.minX <= 145 && c.maxZ >= -145 && c.minZ <= 145);

export const seleneDefinition: MapDefinition = {
  id: 'selene', name: 'SELENE · 冯·布朗月面都市', subtitle: 'VON BRAUN / CENTRAL DISTRICT',
  // Align the central axes with the existing five-metre navigation grid.
  bounds: { minX: -140, maxX: 140, minZ: -140, maxZ: 140 },
  playerSpawn: { x: 0, z: 60 },
  previewSpawn: { x: 0, z: 183 },
  enemySpawns: [
    ...[-115, -92, -69, 69, 92, 115].map(x => ({ x, z: 0 })),
    ...[-115, -92, -69, -46, 92, 115].map(z => ({ x: 0, z })),
  ],
  waves: cityDefinition.waves.map(w => ({ ...w, enemies: [...w.enemies] })),
  environment: { far: 8000, exposure: 1, ambient: 1.65 },
  async createWorld(onProgress) {
    onProgress?.('正在载入 SELENE 月面都市…');
    const { createSeleneWorld } = await import('./selene/world');
    return createSeleneWorld(onProgress);
  },
};
