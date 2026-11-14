import type { Point3 } from './combat';

/** Constant world-speed bullets do not inherit the shooter's velocity. */
export function interceptPoint(origin: Point3, target: Point3, velocity: Point3, speed: number, maxTime: number): { point: Point3; time: number } | null {
  if (![origin.x, origin.y, origin.z, target.x, target.y, target.z, velocity.x, velocity.y, velocity.z, speed, maxTime].every(Number.isFinite) || speed <= 0 || maxTime <= 0) return null;
  const x = target.x - origin.x, y = target.y - origin.y, z = target.z - origin.z;
  const a = velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2 - speed ** 2;
  const b = 2 * (x * velocity.x + y * velocity.y + z * velocity.z), c = x * x + y * y + z * z;
  let roots: number[];
  if (c < 1e-10) roots = [0];
  else if (Math.abs(a) < 1e-8 * speed * speed) roots = Math.abs(b) > 1e-10 ? [-c / b] : [];
  else {
    const d = b * b - 4 * a * c;
    if (d < 0) return null;
    // Avoid cancellation when the target is almost at projectile speed.
    const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(d));
    roots = q === 0 ? [-b / (2 * a)] : [q / a, c / q];
  }
  const time = Math.min(...roots.filter(t => Number.isFinite(t) && t >= 0 && t <= maxTime));
  if (!Number.isFinite(time)) return null;
  return { time, point: { x: target.x + velocity.x * time, y: target.y + velocity.y * time, z: target.z + velocity.z * time } };
}

export interface TargetObservation { position: Point3; velocity: Point3 }
interface Sample extends TargetObservation { time: number }

/** Retains real observations so sudden changes remain unknown during reaction time. */
export class TargetTracker {
  private samples: Sample[] = [];
  constructor(readonly reactionTime: number) {}
  observe(time: number, position: Point3, velocity: Point3): void {
    if (this.samples.length && time < this.samples[this.samples.length - 1].time) this.samples = [];
    this.samples.push({ time, position: { ...position }, velocity: { ...velocity } });
    while (this.samples.length > 2 && this.samples[1].time < time - this.reactionTime - 0.1) this.samples.shift();
  }
  read(time: number): TargetObservation | null {
    let sample: Sample | undefined;
    for (let i = this.samples.length - 1; i >= 0; i--) {
      if (this.samples[i].time <= time - this.reactionTime + 1e-8) { sample = this.samples[i]; break; }
    }
    if (!sample || time - sample.time > 0.65) return null;
    const age = Math.max(0, time - sample.time);
    return { position: { x: sample.position.x + sample.velocity.x * age, y: sample.position.y + sample.velocity.y * age,
      z: sample.position.z + sample.velocity.z * age }, velocity: { ...sample.velocity } };
  }
}

/** Keep the legacy spread and even its random-number order unchanged. */
export function classicAimPoint(player: Point3, random: () => number = Math.random): Point3 {
  return { x: player.x + (random() - 0.5) * 5, y: player.y + (2.7 + random() * 1.9), z: player.z + (random() - 0.5) * 5 };
}
