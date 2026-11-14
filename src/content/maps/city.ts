import { Group } from 'three';
import type { MapDefinition, MapWorld, RectCollider } from './types';
import { LunarKit } from './lunar-kit';
import { addLunarBuildings } from './lunar-buildings';
import { addLunarTerrain } from './lunar-terrain';
import { addLunarSky } from './lunar-sky';

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

async function createCityWorld(onProgress?: (message: string) => void): Promise<MapWorld> {
  const root = new Group();
  root.name = 'lunar-city';
  const kit = new LunarKit(root);
  try {
    onProgress?.('正在构建月面殖民都市…');
    addLunarBuildings(kit, CITY_BUILDINGS);
    addLunarTerrain(kit);
    addLunarSky(kit);
    kit.flush();
    onProgress?.('静海战线准备完成');
    return { root, colliders: CITY_COLLIDERS.map(c => ({ ...c })), dispose: () => kit.dispose() };
  } catch (error) {
    kit.dispose();
    throw error;
  }
}

export const cityDefinition: MapDefinition = {
  id: 'city', name: '月面都市 · 静海战线', subtitle: 'TRANQUILITY / LUNAR FRONT',
  bounds: { minX: -130, maxX: 130, minZ: -130, maxZ: 130 },
  playerSpawn: { x: 0, z: 55 },
  enemySpawns: [
    { x: -78, z: -78 }, { x: 0, z: -106 }, { x: 78, z: -78 }, { x: 104, z: 0 },
    { x: -104, z: 0 }, { x: -78, z: 78 }, { x: 78, z: 78 }, { x: 0, z: -52 },
    { x: -52, z: 0 }, { x: 52, z: 0 }, { x: 0, z: 108 },
  ],
  waves: [
    { title: '第一波 · 侦察小队', enemies: Array(4).fill('zaku') },
    { title: '第二波 · 大魔重装突击', enemies: ['dom', 'dom', ...Array(4).fill('zaku')] },
    { title: '最终波 · 赤色彗星', enemies: ['char-zaku', 'dom', ...Array(3).fill('zaku')] },
  ],
  createWorld: createCityWorld,
};
