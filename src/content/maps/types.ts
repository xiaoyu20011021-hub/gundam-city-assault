import type { Group } from 'three';
export interface RectCollider {
  minX: number; maxX: number; minZ: number; maxZ: number; height: number;
}
export interface SpawnPoint { x: number; z: number }
export interface WaveDefinition { title: string; enemies: string[] }
export interface MapDefinition {
  id: string;
  name: string;
  subtitle: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  playerSpawn: SpawnPoint;
  enemySpawns: SpawnPoint[];
  waves: WaveDefinition[];
  createWorld(onProgress?: (message: string) => void): Promise<MapWorld>;
}
export interface MapWorld {
  root: Group;
  colliders: RectCollider[];
  dispose(): void;
}
