import { distance } from './motion';
import type { RemoteOwnerSnapshot, RemoteTargetSnapshot, WorldContext } from './types';

export function eligibleTarget(target: RemoteTargetSnapshot, owner: RemoteOwnerSnapshot, range: number): boolean {
  return target.alive && target.team !== owner.team && target.id !== owner.id && distance(owner.position, target.position) <= range;
}

export function selectTargets(owner: RemoteOwnerSnapshot, range: number, context: WorldContext): RemoteTargetSnapshot[] {
  return context.targets
    .filter(target => eligibleTarget(target, owner, range) && context.lineClear(owner.position, target.position))
    .sort((a, b) => {
      if (a.id === context.priorityTargetId) return -1;
      if (b.id === context.priorityTargetId) return 1;
      return distance(owner.position, a.position) - distance(owner.position, b.position) || a.id.localeCompare(b.id);
    })
    .slice(0, 2);
}
