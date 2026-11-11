import type { Group } from 'three';
export interface RectCollider {
  minX: number; maxX: number; minZ: number; maxZ: number; height: number;
  /** Bottom of a raised solid; omitted for the original ground-based buildings. */
  minY?: number;
  /** Optional convex footprint, counterclockwise in X/Z, normalized to [0, 1] within the bounds. */
  footprint?: readonly SpawnPoint[];
}
export interface SpawnPoint { x: number; z: number }
export interface WaveDefinition { title: string; enemies: string[] }
export interface MapDefinition {
  id: string;
  name: string;
  subtitle: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  playerSpawn: SpawnPoint;
  previewSpawn?: SpawnPoint;
  enemySpawns: SpawnPoint[];
  waves: WaveDefinition[];
  environment?: { far: number; exposure: number; ambient: number };
  createWorld(onProgress?: (message: string) => void): Promise<MapWorld>;
}
export interface MapWorld {
  root: Group;
  colliders: RectCollider[];
  update?(dt: number): void;
  dispose(): void;
}
