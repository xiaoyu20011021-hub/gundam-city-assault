import type { Actor } from './actor';
import type { MapDefinition, RectCollider } from '../content/maps/types';
import { moveBody, supportHeight } from './spatial';

export interface MovementIntent {
  x: number; z: number; yaw: number; boost: boolean; jump: boolean;
  pitch?: number; lift?: number; toggleFlight?: boolean;
}

export function stepPlayerMovement(actor: Actor, input: MovementIntent, dt: number, walls: RectCollider[], bounds: MapDefinition['bounds']): void {
  const support = supportHeight(actor.position, actor.definition.radius, walls);
  actor.grounded = actor.position.y <= support + 1e-5 && actor.velocity.y <= 0;
  if (input.toggleFlight) {
    if (actor.flying) { actor.flying = false; actor.takeoffHeight = null; }
    else if (actor.energy >= 20) {
      actor.flying = true; actor.energy -= 8;
      actor.takeoffHeight = actor.grounded ? support + actor.definition.height * 0.5 : null;
    } else actor.flightNotice = 1.8;
  }

  let x = input.x * Math.cos(input.yaw) - input.z * Math.sin(input.yaw);
  let z = -input.x * Math.sin(input.yaw) - input.z * Math.cos(input.yaw), y = 0;
  if (actor.flying) {
    const pitch = input.pitch ?? 0;
    x = input.x * Math.cos(input.yaw) - input.z * Math.sin(input.yaw) * Math.cos(pitch);
    z = -input.x * Math.sin(input.yaw) - input.z * Math.cos(input.yaw) * Math.cos(pitch);
    y = -input.z * Math.sin(pitch) + (input.lift ?? 0);
  }
  const magnitude = Math.hypot(x, y, z), normalizer = Math.max(1, magnitude);
  x /= normalizer; y /= normalizer; z /= normalizer;
  actor.boosting = input.boost && magnitude > 0.01 && actor.energy > 0 && (actor.flying || actor.grounded);
  if (actor.flying) {
    actor.energy = Math.max(0, actor.energy - dt * (actor.boosting ? 18 : magnitude > 0.01 || actor.takeoffHeight !== null ? 6 : 4));
    actor.rechargeDelay = 0.6;
    if (actor.energy === 0) { actor.flying = false; actor.boosting = false; actor.takeoffHeight = null; }
  } else if (actor.boosting) {
    actor.energy = Math.max(0, actor.energy - dt * 36); actor.rechargeDelay = 0.6;
  } else if (actor.grounded && !input.boost) {
    const recovery = Math.max(0, dt - actor.rechargeDelay);
    actor.rechargeDelay = Math.max(0, actor.rechargeDelay - dt);
    actor.energy = Math.min(100, actor.energy + recovery * 24);
  } else actor.rechargeDelay = 0.6;

  if (!actor.flying && input.jump && actor.grounded && actor.energy >= 22) {
    actor.velocity.y = 12; actor.energy -= 22; actor.grounded = false; actor.rechargeDelay = 0.6;
  }
  const speed = actor.flying ? (actor.boosting ? actor.definition.flightBoostSpeed : actor.definition.flightSpeed) :
    actor.boosting ? actor.definition.boostSpeed : actor.definition.speed * (actor.grounded ? 1 : 0.7);
  let desiredY = y * speed;
  if (actor.flying && actor.takeoffHeight !== null) {
    const gap = actor.takeoffHeight - actor.position.y;
    if (gap < 0.08 || (input.lift ?? 0) < 0) actor.takeoffHeight = null;
    else desiredY = Math.max(desiredY, Math.min(10, gap * 12));
  }
  if (desiredY > 0) desiredY = Math.min(desiredY, Math.max(0, (100 - actor.position.y) * 4));
  const rate = actor.flying ? (magnitude < 0.01 && actor.takeoffHeight === null ? 18 : actor.boosting ? 9 : 12) : actor.grounded ? 12 : 6;
  const decay = Math.exp(-rate * dt), delta = { x: 0, y: 0, z: 0 };
  for (const [axis, desired] of [['x', x * speed], ['z', z * speed], ['y', desiredY]] as const) {
    if (axis === 'y' && !actor.flying) continue;
    const previous = actor.velocity[axis];
    delta[axis] = desired * dt + (previous - desired) * (1 - decay) / rate;
    actor.velocity[axis] = desired + (previous - desired) * decay;
    if (desired === 0 && Math.abs(actor.velocity[axis]) < 0.02) actor.velocity[axis] = 0;
  }
  if (!actor.flying) {
    const oldY = actor.velocity.y, acceleratingTime = Math.min(dt, Math.max(0, (oldY + 12) / 24));
    delta.y = oldY * acceleratingTime - 12 * acceleratingTime ** 2 - 12 * (dt - acceleratingTime);
    actor.velocity.y = Math.max(-12, oldY - dt * 24);
  }
  const motion = moveBody(actor.position, delta, actor.definition.radius, actor.definition.height, walls, bounds);
  actor.position.set(motion.position.x, motion.position.y, motion.position.z);
  for (const axis of ['x', 'y', 'z'] as const) if (motion.blocked[axis]) actor.velocity[axis] = 0;
  const surface = supportHeight(actor.position, actor.definition.radius, walls);
  actor.altitude = Math.max(0, actor.position.y - surface);
  actor.grounded = actor.altitude < 1e-5 && actor.velocity.y <= 0;
  if (actor.grounded && actor.flying && desiredY <= 0 && actor.takeoffHeight === null) {
    actor.flying = false; actor.boosting = false; actor.rechargeDelay = 0.6;
  }
  actor.speed = Math.hypot(actor.velocity.x, actor.velocity.z);
  const blend = 1 - Math.exp(-dt * 10);
  actor.flightBlend += ((actor.flying ? 1 : 0) - actor.flightBlend) * blend;
  actor.bank += ((actor.flying ? -input.x * 0.16 : 0) - actor.bank) * blend;
  actor.flightPitch += ((actor.flying ? -Math.min(1, actor.speed / actor.definition.flightSpeed) * 0.17 : 0) - actor.flightPitch) * blend;
}
