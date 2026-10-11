import type { Actor } from './actor';
import type { MapDefinition, RectCollider } from '../content/maps/types';
import { moveWithCollisions } from './navigation';

export interface MovementIntent { x: number; z: number; yaw: number; boost: boolean; jump: boolean }
export function stepPlayerMovement(actor: Actor, input: MovementIntent, dt: number, walls: RectCollider[], bounds: MapDefinition['bounds']): void {
  const magnitude = Math.hypot(input.x, input.z), factor = magnitude > 1 ? 1 / magnitude : 1;
  actor.boosting = input.boost && magnitude > 0 && actor.energy > 5;
  if (actor.boosting) actor.energy = Math.max(0, actor.energy - dt * 36);
  else if (!input.boost && actor.position.y <= 0) actor.energy = Math.min(100, actor.energy + dt * 24);
  if (input.jump && actor.position.y <= 0 && actor.energy >= 22) { actor.velocity.y = 12; actor.energy -= 22; }
  const speed = actor.boosting ? actor.definition.boostSpeed : actor.definition.speed;
  const desiredX = (input.x * Math.cos(input.yaw) - input.z * Math.sin(input.yaw)) * factor * speed;
  const desiredZ = (-input.x * Math.sin(input.yaw) - input.z * Math.cos(input.yaw)) * factor * speed;
  const decay = Math.exp(-12 * dt), oldX = actor.velocity.x, oldZ = actor.velocity.z;
  // Exact integration of exponential acceleration keeps travel equal at different
  // frame rates, instead of applying the end-of-frame velocity to the whole frame.
  const delta = { x: desiredX * dt + (oldX - desiredX) * (1 - decay) / 12,
    z: desiredZ * dt + (oldZ - desiredZ) * (1 - decay) / 12 };
  actor.velocity.x = desiredX + (oldX - desiredX) * decay;
  actor.velocity.z = desiredZ + (oldZ - desiredZ) * decay;
  const position = moveWithCollisions(actor.position, delta, actor.definition.radius, walls, bounds);
  if (Math.abs(position.x - actor.position.x - delta.x) > 0.002) actor.velocity.x = 0;
  if (Math.abs(position.z - actor.position.z - delta.z) > 0.002) actor.velocity.z = 0;
  actor.position.x = position.x; actor.position.z = position.z;
  if (actor.position.y > 0 || actor.velocity.y > 0) {
    actor.position.y = Math.max(0, actor.position.y + actor.velocity.y * dt - 12 * dt * dt);
    actor.velocity.y -= 24 * dt;
    if (actor.position.y === 0) actor.velocity.y = 0;
  }
  actor.speed = Math.hypot(actor.velocity.x, actor.velocity.z);
}
