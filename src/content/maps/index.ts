import { cityDefinition } from './city';
import type { MapDefinition } from './types';

export const mapRegistry: Record<string, MapDefinition> = { city: cityDefinition };
export { cityDefinition };
export type { MapDefinition, MapWorld, RectCollider, SpawnPoint, WaveDefinition } from './types';
