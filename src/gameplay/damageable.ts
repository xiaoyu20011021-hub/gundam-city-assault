import type { HitBody } from './combat';

/** A target can receive damage without owning a pilot, mission slot or Actor rig. */
export interface DamageableTarget {
  id: string;
  team: string;
  kind: 'remote-unit';
  isAlive(): boolean;
  hitBody(): HitBody;
}
