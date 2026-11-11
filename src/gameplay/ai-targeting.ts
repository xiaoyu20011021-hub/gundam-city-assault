import { interceptPoint, TargetTracker } from './ai-aim';
import type { Point3 } from './combat';
import type { RemoteUnitSnapshot } from './remote-weapons/types';

interface EnemySnapshot { id: string; elite: boolean; position: Point3; team?: string }
interface Decision {
  elite: boolean;
  assessment: number;
  hold: number;
  selected?: string;
  tracked?: string;
  tracker?: TargetTracker;
}
const distance = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function airborne(target: RemoteUnitSnapshot): boolean {
  return target.health > 0 && !['docked', 'recharging', 'destroyed'].includes(target.state);
}

/** Shooting decisions remain independent of the AI's player pursuit and movement. */
export class RemoteTargetingController {
  private decisions = new Map<string, Decision>();
  private state(id: string): Decision {
    let state = this.decisions.get(id);
    if (!state) { state = { elite: false, assessment: 0, hold: 0 }; this.decisions.set(id, state); }
    return state;
  }
  choose(enemy: EnemySnapshot, units: readonly RemoteUnitSnapshot[], dt: number,
    canSee: (a: Point3, b: Point3) => boolean, range: number, random: () => number = Math.random): RemoteUnitSnapshot | undefined {
    const state = this.state(enemy.id);
    state.elite = enemy.elite;
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    state.assessment -= elapsed; state.hold -= elapsed;
    const candidates = units.filter(target => airborne(target) && target.team !== (enemy.team ?? 'enemy')
      && distance(enemy.position, target.position) <= range && canSee(enemy.position, target.position));
    const selected = candidates.find(target => target.id === state.selected);
    if (state.selected && !selected) {
      state.selected = undefined; state.tracked = undefined; state.tracker = undefined; state.hold = 0;
      state.assessment = Math.max(state.assessment, 0.4);
      return undefined;
    }
    if (selected && state.hold > 0) return selected;
    if (state.assessment > 1e-8) return selected;
    state.assessment = 0.4;
    state.selected = undefined;
    if (candidates.length && random() < (enemy.elite ? 0.4 : 0.25)) {
      // Nearest eligible target is deterministic; random controls the decision,
      // rather than making a second roll for every small weapon in the scene.
      candidates.sort((a, b) => distance(enemy.position, a.position) - distance(enemy.position, b.position) || a.id.localeCompare(b.id));
      state.selected = candidates[0].id; state.hold = 1;
      return candidates[0];
    }
    state.tracked = undefined; state.tracker = undefined;
    return undefined;
  }
  aim(enemyId: string, target: RemoteUnitSnapshot, origin: Point3, mode: 'classic' | 'enhanced', time: number,
    speed: number, range: number, random: () => number = Math.random): Point3 | null {
    if (!airborne(target) || !Number.isFinite(speed) || speed <= 0 || !Number.isFinite(range) || range <= 0
      || !Number.isFinite(time) || distance(origin, target.position) > range) return null;
    const state = this.state(enemyId);
    let point = target.position;
    if (mode === 'enhanced') {
      if (state.tracked !== target.id || !state.tracker) {
        state.tracked = target.id;
        state.tracker = new TargetTracker(state.elite ? 0.12 : 0.22);
      }
      state.tracker.observe(time, target.position, target.velocity);
      const observed = state.tracker.read(time);
      if (!observed) return null;
      const solution = interceptPoint(origin, observed.position, observed.velocity, speed, range / speed);
      if (!solution) return null;
      point = solution.point;
    }
    const length = distance(origin, point);
    if (!Number.isFinite(length) || length < 0.001 || length > range) return null;
    // Scatter in the plane perpendicular to the shot, scaled for a small target.
    // This avoids the humanoid torso offset and does not grant perfect tracking.
    const x = (point.x - origin.x) / length, y = (point.y - origin.y) / length, z = (point.z - origin.z) / length;
    const horizontal = Math.hypot(x, z);
    const right = horizontal > 1e-7 ? { x: -z / horizontal, y: 0, z: x / horizontal } : { x: 1, y: 0, z: 0 };
    const up = { x: y * right.z - z * right.y, y: z * right.x - x * right.z, z: x * right.y - y * right.x };
    const spread = Math.max(target.radius * 0.35, target.height * 0.2, length * (mode === 'classic' ? 0.012 : state.elite ? 0.004 : 0.008));
    const horizontalOffset = (random() * 2 - 1) * spread, verticalOffset = (random() * 2 - 1) * spread;
    return { x: point.x + right.x * horizontalOffset + up.x * verticalOffset,
      y: point.y + right.y * horizontalOffset + up.y * verticalOffset,
      z: point.z + right.z * horizontalOffset + up.z * verticalOffset };
  }
  clear(): void { this.decisions.clear(); }
}
