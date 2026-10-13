import type { RectCollider } from '../content/maps/types';

export interface Point3 { x: number; y: number; z: number }
export interface HitBody extends Point3 { id: string; radius: number; height: number }
export interface SegmentHit { type: 'wall' | 'actor'; id?: string; t: number; point: Point3 }

export class WeaponState {
  heat = 0;
  overheated = false;
  cooldown = 0;
  private coolingDelay = 0;
  constructor(private readonly config: { cooldown: number; heatPerShot: number; cooling: number }) {}
  fire(): boolean {
    if (this.cooldown > 1e-6 || this.overheated) return false;
    this.cooldown = this.config.cooldown;
    this.coolingDelay = 0.4;
    this.heat = Math.min(100, this.heat + this.config.heatPerShot);
    if (this.heat >= 100) this.overheated = true;
    return true;
  }
  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const coolingTime = Math.max(0, dt - this.coolingDelay);
    this.coolingDelay = Math.max(0, this.coolingDelay - dt);
    this.heat = Math.max(0, this.heat - this.config.cooling * coolingTime);
    if (this.overheated && this.heat <= 24) this.overheated = false;
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

// Normalized segment/AABB intersection also catches projectiles that travel through
// the entire building within a single simulation step.
export function segmentBox(a: Point3, b: Point3, min: Point3, max: Point3): number | null {
  let enter = 0, exit = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-8) {
      if (a[axis] < min[axis] || a[axis] > max[axis]) return null;
    } else {
      let t0 = (min[axis] - a[axis]) / delta, t1 = (max[axis] - a[axis]) / delta;
      if (t0 > t1) [t0, t1] = [t1, t0];
      enter = Math.max(enter, t0); exit = Math.min(exit, t1);
      if (enter > exit) return null;
    }
  }
  return enter;
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
  for (const wall of walls) record(segmentBox(a, b,
    { x: wall.minX, y: 0, z: wall.minZ }, { x: wall.maxX, y: wall.height, z: wall.maxZ }), 'wall');
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
