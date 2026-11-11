import { cityDefinition } from './city';
import { seleneDefinition } from './selene';

export const MAP_DEFINITIONS = { city: cityDefinition, selene: seleneDefinition };
export const mapRegistry = MAP_DEFINITIONS;
export { cityDefinition, seleneDefinition };
export type { MapDefinition, MapWorld, RectCollider, SpawnPoint, WaveDefinition } from './types';
export type MapId = keyof typeof MAP_DEFINITIONS;
export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && Object.hasOwn(MAP_DEFINITIONS, value);
}
