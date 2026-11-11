import type { Actor } from './actor';
import type { MapDefinition, RectCollider } from '../content/maps/types';
import { firstSegmentHit, type Point3 } from './combat';
import type { ProjectileSnapshot } from './projectiles';
import { moveBody } from './spatial';

export interface Steering { x: number; z: number; lift: number; boost: boolean }
export interface DodgeIntent extends Steering { dodging: boolean }
interface Threat { shot: ProjectileSnapshot; time: number }
const HORIZON = 0.8;

function pointAt(p: Point3, v: Point3, t: number): Point3 { return { x: p.x + v.x * t, y: p.y + v.y * t, z: p.z + v.z * t }; }
function visible(enemy: Actor, shot: ProjectileSnapshot, walls: RectCollider[]): boolean {
  const eye = { x: enemy.position.x, y: enemy.position.y + enemy.definition.height * 0.55, z: enemy.position.z };
  return shot.team !== enemy.team && shot.ownerId !== enemy.id && shot.life > 0 &&
    Math.hypot(shot.position.x - eye.x, shot.position.y - eye.y, shot.position.z - eye.z) <= 100 &&
    !firstSegmentHit(eye, shot.position, walls, []);
}

/** Relative segments use the same finite cylinder as actual projectile damage. */
export function incomingThreats(enemy: Actor, shots: readonly ProjectileSnapshot[], walls: RectCollider[], horizon = HORIZON): Threat[] {
  const threats: Threat[] = [];
  for (const shot of shots) {
    if (!visible(enemy, shot, walls)) continue;
    const duration = Math.min(horizon, shot.life);
    const relative = { x: shot.velocity.x - enemy.velocity.x, y: shot.velocity.y - enemy.velocity.y, z: shot.velocity.z - enemy.velocity.z };
    const hit = firstSegmentHit(shot.position, pointAt(shot.position, relative, duration), [], [enemy.hitBody()]);
    if (!hit) continue;
    const time = hit.t * duration;
    if (!firstSegmentHit(shot.position, pointAt(shot.position, shot.velocity, time), walls, [])) threats.push({ shot, time });
  }
  return threats.sort((a, b) => a.time - b.time);
}

/** Preview the actual exponential acceleration and swept body collision, without mutating the actor. */
function risk(enemy: Actor, intent: Steering, shots: readonly ProjectileSnapshot[], walls: RectCollider[], bounds: MapDefinition['bounds']): { danger: number; blocked: boolean } {
  let position: Point3 = { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z };
  const velocity = { x: enemy.velocity.x, y: enemy.velocity.y, z: enemy.velocity.z };
  const size = Math.max(1, Math.hypot(intent.x, intent.z, enemy.flying ? intent.lift : 0));
  const speed = enemy.flying ? intent.boost ? enemy.definition.flightBoostSpeed : enemy.definition.flightSpeed :
    intent.boost ? enemy.definition.boostSpeed : enemy.definition.speed * (enemy.grounded ? 1 : 0.7);
  const rate = enemy.flying ? intent.boost ? 9 : 12 : enemy.grounded ? 12 : 6;
  const desired = { x: intent.x / size * speed, y: enemy.flying ? intent.lift / size * speed : 0, z: intent.z / size * speed };
  const hitShots = new Set<number>();
  let danger = 0, blocked = false;
  for (let t = 0; t < HORIZON - 1e-8; t += 0.08) {
    const dt = Math.min(0.08, HORIZON - t), decay = Math.exp(-rate * dt), delta = { x: 0, y: 0, z: 0 };
    for (const axis of ['x', 'y', 'z'] as const) {
      if (axis === 'y' && !enemy.flying) {
        delta.y = velocity.y * dt - 12 * dt * dt; velocity.y = Math.max(-12, velocity.y - 24 * dt);
      } else {
        delta[axis] = desired[axis] * dt + (velocity[axis] - desired[axis]) * (1 - decay) / rate;
        velocity[axis] = desired[axis] + (velocity[axis] - desired[axis]) * decay;
      }
    }
    const next = moveBody(position, delta, enemy.definition.radius, enemy.definition.height, walls, bounds);
    if (next.blocked.x || next.blocked.z || (enemy.flying && next.blocked.y && intent.lift !== 0)) blocked = true;
    for (const axis of ['x', 'y', 'z'] as const) if (next.blocked[axis]) velocity[axis] = 0;
    for (const shot of shots) {
      if (hitShots.has(shot.id) || shot.life <= t) continue;
      const a = pointAt(shot.position, shot.velocity, t), endTime = Math.min(t + dt, shot.life);
      const b = pointAt(shot.position, shot.velocity, endTime), fraction = (endTime - t) / dt;
      const relativeEnd = { x: b.x - (next.position.x - position.x) * fraction,
        y: b.y - (next.position.y - position.y) * fraction, z: b.z - (next.position.z - position.z) * fraction };
      const hit = firstSegmentHit(a, relativeEnd, [], [{ ...enemy.hitBody(), ...position }]);
      if (hit && !firstSegmentHit(shot.position, pointAt(shot.position, shot.velocity, t + hit.t * (endTime - t)), walls, [])) {
        danger += shot.damage / (0.15 + t + hit.t * dt); hitShots.add(shot.id);
      }
    }
    position = next.position;
  }
  return { danger, blocked };
}

export class DodgeController {
  private seen = new Map<number, number>();
  private maneuver?: Steering;
  private until = 0;
  private readyAt = 0;
  constructor(readonly reactionTime: number, readonly cooldown: number) {}
  step(enemy: Actor, shots: readonly ProjectileSnapshot[], _dt: number, time: number, walls: RectCollider[], bounds: MapDefinition['bounds'], base: Steering, unlimitedEnergy: boolean): DodgeIntent {
    const observed = shots.filter(p => visible(enemy, p, walls));
    const ids = new Set(observed.map(p => p.id));
    for (const id of this.seen.keys()) if (!ids.has(id)) this.seen.delete(id);
    for (const p of observed) if (!this.seen.has(p.id)) this.seen.set(p.id, time);
    if (enemy.swing.running) { this.maneuver = undefined; return { ...base, dodging: false }; }
    if (this.maneuver && time < this.until) {
      const continuing = { ...this.maneuver, boost: this.maneuver.boost && (unlimitedEnergy || enemy.energy >= 5) && !enemy.aiRecovering };
      if (!risk(enemy, continuing, [], walls, bounds).blocked) return { ...continuing, dodging: true };
      this.maneuver = undefined;
    }
    if (time < this.readyAt) return { ...base, dodging: false };
    const perceived = observed.filter(p => time - this.seen.get(p.id)! >= this.reactionTime - 1e-8);
    const threats = incomingThreats(enemy, perceived, walls);
    if (!threats.length) return { ...base, dodging: false };
    const baseline = risk(enemy, base, perceived, walls, bounds);
    if (baseline.danger === 0) return { ...base, dodging: false };
    const v = threats[0].shot.velocity, length = Math.hypot(v.x, v.z);
    const side = length > 1e-6 ? { x: v.z / length, z: -v.x / length } : { x: 1, z: 0 };
    const boost = !enemy.aiRecovering && (unlimitedEnergy || enemy.energy >= 16);
    const candidates: Steering[] = [];
    for (const sign of [1, -1]) {
      candidates.push({ x: side.x * sign, z: side.z * sign, lift: 0, boost });
      candidates.push({ x: side.x * sign * 0.8 - v.x / Math.max(1, length) * 0.6,
        z: side.z * sign * 0.8 - v.z / Math.max(1, length) * 0.6, lift: 0, boost });
      if (enemy.flying && !enemy.aiRecovering) candidates.push({ x: side.x * sign * 0.6, z: side.z * sign * 0.6, lift: sign * 0.8, boost });
    }
    let best: Steering | undefined, bestRisk = baseline.danger;
    for (const candidate of candidates) {
      const score = risk(enemy, candidate, perceived, walls, bounds);
      if (!score.blocked && score.danger < bestRisk - 1e-6) { best = candidate; bestRisk = score.danger; }
    }
    if (!best) return { ...base, dodging: false };
    this.maneuver = best; this.until = time + 0.34; this.readyAt = this.until + this.cooldown;
    return { ...best, dodging: true };
  }
}
