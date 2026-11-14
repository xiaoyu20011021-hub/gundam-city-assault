import { segmentCollider } from './collider-shape';
export { segmentBox } from './collider-shape';
import { colliderIndex } from './collider-index';
import type { RectCollider } from '../content/maps/types';

export interface Point3 { x: number; y: number; z: number }
export interface HitBody extends Point3 { id: string; radius: number; height: number }
export interface SegmentHit { type: 'wall' | 'actor'; id?: string; t: number; point: Point3 }

export class WeaponState {
  heat = 0;
  overheated = false;
  cooldown = 0;
  readonly magazine?: number;
  private coolingDelay = 0;
  ammo: number | null;
  reloading = false;
  private reloadTimer = 0;
  constructor(private readonly config: { cooldown: number; heatPerShot: number; cooling: number; magazine?: number; reloadTime?: number }) {
    this.magazine = config.magazine;
    this.ammo = config.magazine ?? null;
  }
  fire(): boolean {
    if (this.cooldown > 1e-6 || this.overheated || this.reloading) return false;
    if (this.config.magazine !== undefined && (this.ammo ?? 0) <= 0) {
      this.startReload();
      return false;
    }
    this.cooldown = this.config.cooldown;
    this.coolingDelay = 0.4;
    this.heat = Math.min(100, this.heat + this.config.heatPerShot);
    if (this.heat >= 100) this.overheated = true;
    if (this.config.magazine !== undefined) {
      this.ammo = Math.max(0, (this.ammo ?? 0) - 1);
      if (this.ammo === 0) this.startReload();
    }
    return true;
  }
  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading) {
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
      if (this.reloadTimer === 0) {
        this.reloading = false;
        this.ammo = this.config.magazine ?? null;
      }
    }
    const coolingTime = Math.max(0, dt - this.coolingDelay);
    this.coolingDelay = Math.max(0, this.coolingDelay - dt);
    this.heat = Math.max(0, this.heat - this.config.cooling * coolingTime);
    if (this.overheated && this.heat <= 24) this.overheated = false;
  }
  private startReload(): void {
    if (this.config.magazine === undefined || this.reloading) return;
    this.reloading = true;
    this.reloadTimer = this.config.reloadTime ?? 0;
    if (this.reloadTimer === 0) {
      this.reloading = false;
      this.ammo = this.config.magazine;
    }
  }
}

export class MeleeSwing {
  elapsed = 0;
  running = false;
  private victims = new Set<string>();
  constructor(readonly windup: number, readonly activeDuration: number, readonly recovery: number) {}
  get duration(): number { return this.windup + this.activeDuration + this.recovery; }
  get progress(): number { return this.running ? this.elapsed / this.duration : 0; }
  get active(): boolean { return this.running && this.elapsed >= this.windup && this.elapsed < this.windup + this.activeDuration; }
  start(): boolean {
    if (this.running) return false;
    this.elapsed = 0; this.running = true; this.victims.clear();
    return true;
  }
  update(dt: number): void {
    if (!this.running) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.running = false;
  }
  hit(id: string): boolean {
    if (!this.active || this.victims.has(id)) return false;
    this.victims.add(id); return true;
  }
}

function segmentCylinder(a: Point3, b: Point3, body: HitBody): number | null {
  const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
  const ox = a.x - body.x, oz = a.z - body.z;
  const aa = dx * dx + dz * dz, cc = ox * ox + oz * oz - body.radius ** 2;
  let enter = 0, exit = 1;
  if (aa < 1e-9) { if (cc > 0) return null; }
  else {
    const bb = 2 * (ox * dx + oz * dz), discriminant = bb * bb - 4 * aa * cc;
    if (discriminant < 0) return null;
    const sqrt = Math.sqrt(discriminant);
    enter = Math.max(enter, (-bb - sqrt) / (2 * aa));
    exit = Math.min(exit, (-bb + sqrt) / (2 * aa));
  }
  if (Math.abs(dy) < 1e-9) {
    if (a.y < body.y || a.y > body.y + body.height) return null;
  } else {
    let lo = (body.y - a.y) / dy, hi = (body.y + body.height - a.y) / dy;
    if (lo > hi) [lo, hi] = [hi, lo];
    enter = Math.max(enter, lo); exit = Math.min(exit, hi);
  }
  return enter <= exit ? enter : null;
}

export function firstSegmentHit(a: Point3, b: Point3, walls: RectCollider[], actors: HitBody[]): SegmentHit | null {
  let nearest: SegmentHit | null = null;
  const record = (t: number | null, type: SegmentHit['type'], id?: string) => {
    if (t === null || t < 0 || t > 1 || (nearest && t >= nearest.t)) return;
    nearest = { type, id, t, point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t } };
  };
  for (const wall of colliderIndex(walls).query(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z))) record(segmentCollider(a, b, wall), 'wall');
  for (const body of actors) record(segmentCylinder(a, b, body), 'actor', body.id);
  return nearest;
}

export function meleeCanHit(attacker: { x: number; y?: number; z: number; yaw: number; pitch?: number; height?: number },
  target: { x: number; y?: number; z: number; height?: number }, range: number, walls: RectCollider[]): boolean {
  const aY = (attacker.y ?? 0) + (attacker.height ?? 6) * 0.5, bY = (target.y ?? 0) + (target.height ?? 6) * 0.5;
  const dx = target.x - attacker.x, dz = target.z - attacker.z, dy = bY - aY, distance = Math.hypot(dx, dy, dz);
  if (distance > range || distance < 0.01) return false;
  const pitch = attacker.pitch ?? 0;
  const dot = (dx * -Math.sin(attacker.yaw) * Math.cos(pitch) - dy * Math.sin(pitch) - dz * Math.cos(attacker.yaw) * Math.cos(pitch)) / distance;
  return dot >= Math.cos(Math.PI * 0.38) && !firstSegmentHit(
    { x: attacker.x, y: aY, z: attacker.z }, { x: target.x, y: bY, z: target.z }, walls, []);
}

/** Distance is measured to the body surface; solid cover blocks the pressure wave. */
export function blastHits(center: Point3, radius: number, damage: number, bodies: HitBody[], walls: RectCollider[], directId?: string): { id: string; damage: number }[] {
  const hits: { id: string; damage: number }[] = [];
  for (const body of bodies) {
    if (body.id === directId) { hits.push({ id: body.id, damage }); continue; }
    const dx = center.x - body.x, dz = center.z - body.z, horizontal = Math.hypot(dx, dz);
    const factor = horizontal > 0 ? Math.min(1, body.radius / horizontal) : 0;
    const nearest = { x: body.x + dx * factor, y: Math.max(body.y, Math.min(body.y + body.height, center.y)), z: body.z + dz * factor };
    const distance = Math.hypot(nearest.x - center.x, nearest.y - center.y, nearest.z - center.z);
    if (distance >= radius || firstSegmentHit(center, nearest, walls, [])) continue;
    hits.push({ id: body.id, damage: Math.max(1, Math.round(damage * (1 - 0.8 * distance / radius))) });
  }
  return hits;
}
