import { Quaternion, Vector3 } from 'three';
import type { WeaponDefinition } from '../content/weapons';
import type { RectCollider } from '../content/maps/types';
import { firstSegmentHit, type HitBody } from './combat';

export interface RocketGuidance {
  config: NonNullable<WeaponDefinition['homing']>;
  remaining: number;
  acquired: boolean;
  targetId?: string;
}

/** Acquire once; losing sight, passing the target or exhausting fuel ends guidance. */
export function guideRocket(position: Vector3, velocity: Vector3, guidance: RocketGuidance,
  dt: number, targets: readonly HitBody[], walls: RectCollider[]): void {
  if (guidance.remaining <= 0 || dt <= 0) return;
  const { config } = guidance, step = Math.min(dt, guidance.remaining);
  guidance.remaining = Math.max(0, guidance.remaining - dt);
  const forward = velocity.clone().normalize();
  const offset = (body: HitBody) => new Vector3(body.x, body.y + body.height * 0.5, body.z).sub(position);
  const visible = (body: HitBody) => !firstSegmentHit(position,
    new Vector3(body.x, body.y + body.height * 0.5, body.z), walls, []);
  if (!guidance.acquired) {
    guidance.acquired = true;
    let bestAngle = config.acquireAngle;
    for (const body of targets) {
      const delta = offset(body), angle = forward.angleTo(delta);
      if (delta.length() > config.range || angle >= bestAngle || !visible(body)) continue;
      bestAngle = angle; guidance.targetId = body.id;
    }
  }
  const target = targets.find(body => body.id === guidance.targetId);
  if (!target) { guidance.remaining = 0; return; }
  const desired = offset(target), angle = forward.angleTo(desired);
  if (desired.length() > config.range || angle > config.trackingAngle || !visible(target)) {
    guidance.remaining = 0; return;
  }
  if (angle < 1e-6) return;
  const rotation = new Quaternion().setFromUnitVectors(forward, desired.normalize());
  rotation.slerp(new Quaternion(), 1 - Math.min(1, config.turnRate * step / angle));
  velocity.applyQuaternion(rotation);
}
