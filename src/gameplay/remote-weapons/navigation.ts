import type { MapDefinition, RectCollider } from '../../content/maps/types';
import type { Point3 } from '../combat';
import { segmentCollider } from '../collider-shape';
import { colliderIndex } from '../collider-index';

const distance = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const margin = 0.02;

/** Small flying equipment uses swept volumes; visual orientation never grants wall clearance. */
export function createRemoteNavigation(walls: RectCollider[], bounds: MapDefinition['bounds'], maxAltitude = 100) {
  const index = colliderIndex(walls);
  const highestRoof = walls.reduce((height, wall) => Math.max(height, wall.height), 0);
  type Plan = { goal: Point3; radius: number; path?: Point3[]; search?: Generator<void, Point3[] | undefined>; failedAt?: number };
  const plans = new Map<string, Plan>();
  const stats = { searchSteps: 0, plans: 0 };
  let budget = 4096, step = 0;
  function nearby(a: Point3, b: Point3, radius: number) {
    return index.query(Math.min(a.x, b.x) - radius, Math.max(a.x, b.x) + radius,
      Math.min(a.z, b.z) - radius, Math.max(a.z, b.z) + radius);
  }
  function inside(p: Point3, radius: number): boolean {
    return [p.x, p.y, p.z].every(Number.isFinite) && p.x >= bounds.minX + radius && p.x <= bounds.maxX - radius
      && p.z >= bounds.minZ + radius && p.z <= bounds.maxZ - radius && p.y >= radius && p.y <= maxAltitude - radius;
  }
  function clear(a: Point3, b: Point3, radius: number): boolean {
    return inside(a, radius) && inside(b, radius) && !nearby(a, b, radius).some(w => segmentCollider(a, b, w, radius) !== null);
  }
  function validRoute(a: Point3, points: Point3[], radius: number): boolean {
    let previous = a;
    for (const point of points) { if (!clear(previous, point, radius)) return false; previous = point; }
    return true;
  }
  function* route(a: Point3, b: Point3, radius: number): Generator<void, Point3[] | undefined> {
    yield;
    if (clear(a, b, radius)) return [b];
    if (!clear(a, a, radius) || !clear(b, b, radius)) return undefined;

    // Try a complete roof route before local side waypoints. Every leg must be safe,
    // including the final descent to a moving mount next to a building.
    const heights = [...new Set(nearby(a, b, radius).filter(w => segmentCollider(a, b, w, radius) !== null)
      .map(w => Math.max(a.y, b.y, w.height + radius + margin)))].sort((x, y) => x - y);
    // A second obstruction on an ascent may require clearing a taller roof as well.
    const highest = Math.max(a.y, b.y, highestRoof + radius + margin);
    if (!heights.includes(highest)) heights.push(highest);
    for (const y of heights) {
      yield;
      const points = [{ x: a.x, y, z: a.z }, { x: b.x, y, z: b.z }, b];
      if (validRoute(a, points, radius)) return points;
    }

    // The finite visibility graph connects expanded building corners. It handles
    // adjacent tall buildings without choosing an alternating left/right detour.
    const y = Math.max(a.y, b.y);
    for (const padding of [12, 40, Infinity]) {
    const nodes: Point3[] = [a, b];
    const local = Number.isFinite(padding) ? nearby(a, b, padding) : walls;
    for (const wall of local) {
      yield;
      if (wall.height + radius < y || (wall.minY ?? 0) - radius > y) continue;
      for (const x of [wall.minX - radius - margin, wall.maxX + radius + margin]) {
        for (const z of [wall.minZ - radius - margin, wall.maxZ + radius + margin]) {
          const point = { x, y, z };
          yield;
          if (clear(point, point, radius)) nodes.push(point);
        }
      }
    }
    const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
    costs[0] = 0;
    for (let count = 0; count < nodes.length; count++) {
      let current = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
      if (current < 0 || !Number.isFinite(costs[current])) break;
      if (current === 1) {
        const path: Point3[] = [];
        for (let next = 1; next > 0; next = previous[next]) path.unshift(nodes[next]);
        return path;
      }
      visited.add(current);
      for (let i = 1; i < nodes.length; i++) {
        yield;
        if (visited.has(i)) continue;
        const cost = costs[current] + distance(nodes[current], nodes[i]);
        if (cost + 1e-8 < costs[i] && clear(nodes[current], nodes[i], radius)) { costs[i] = cost; previous[i] = current; }
      }
    }
    }
    return undefined;
  }
  return {
    stats,
    beginStep(maxSearchSteps = 4096): void {
      budget = maxSearchSteps; stats.searchSteps = 0; step++;
    },
    lineClear: (a: Point3, b: Point3): boolean => clear(a, b, 0),
    move(a: Point3, b: Point3, maxDistance: number, radius: number, unitId?: string): { position: Point3; blocked: boolean } {
      if (!Number.isFinite(radius) || radius < 0 || !Number.isFinite(maxDistance) || maxDistance < 0) return { position: { ...a }, blocked: true };
      if (!inside(a, radius) || !inside(b, radius) || !clear(b, b, radius)) return { position: { ...a }, blocked: true };
      let point: Point3 | undefined;
      if (clear(a, b, radius)) { point = b; if (unitId) plans.delete(unitId); }
      else if (!unitId) {
        // Synchronous API for standalone callers; the game always supplies a unit ID.
        const search = route(a, b, radius);
        let result = search.next();
        while (!result.done) result = search.next();
        point = result.value?.find(p => distance(a, p) > 1e-7);
      } else {
        let plan = plans.get(unitId);
        if (!plan || plan.radius !== radius || (plan.failedAt !== undefined && (step - plan.failedAt >= 15 || distance(plan.goal, b) > 4))) {
          plan = { goal: { ...b }, radius, search: route({ ...a }, { ...b }, radius) };
          plans.set(unitId, plan); stats.plans++;
          // Bound retained state if equipment gets replaced repeatedly within a match.
          if (plans.size > 64) plans.delete(plans.keys().next().value!);
        }
        let allowance = Math.min(budget, 512);
        // Six funnels each receive a slice; an early unit cannot spend their time.
        const unitDeadline = performance.now() + .25;
        while (plan.search && allowance-- > 0) {
          if ((stats.searchSteps & 15) === 0 && performance.now() >= unitDeadline) break;
          budget--; stats.searchSteps++;
          const result = plan.search.next();
          if (result.done) { plan.search = undefined; plan.path = result.value; if (!result.value) plan.failedAt = step; }
        }
        if (plan.path) {
          while (plan.path.length && distance(a, plan.path[0]) < 1e-7) plan.path.shift();
          // A moving dock is only approached through a newly validated segment.
          point = plan.path.length === 1 ? b : plan.path[0];
          if (point && !clear(a, point, radius)) { plans.delete(unitId); point = undefined; }
        }
        // Pending is not failure: retain the selected attack station while planning.
        if (plan.search) return { position: { ...a }, blocked: false };
      }
      if (!point) return { position: { ...a }, blocked: true };
      const length = distance(a, point);
      if (length < 1e-7 || maxDistance === 0) return { position: { ...a }, blocked: false };
      const t = Math.min(1, maxDistance / length);
      const position = t === 1 ? { ...point } : { x: a.x + (point.x - a.x) * t, y: a.y + (point.y - a.y) * t, z: a.z + (point.z - a.z) * t };
      return clear(a, position, radius) ? { position, blocked: false } : { position: { ...a }, blocked: true };
    },
  };
}
