import type { Actor } from './actor';
import type { MapDefinition, RectCollider } from '../content/maps/types';
import { firstSegmentHit } from './combat';
import { findPath, moveWithCollisions } from './navigation';
import { WEAPON_DEFINITIONS } from '../content/weapons';

export function stepEnemy(enemy: Actor, player: Actor, dt: number, time: number, walls: RectCollider[], bounds: MapDefinition['bounds']): { fire: boolean; slash: boolean } {
  const dx = player.position.x - enemy.position.x, dz = player.position.z - enemy.position.z, distance = Math.hypot(dx, dz);
  enemy.yaw = Math.atan2(-dx, -dz);
  const clear = !firstSegmentHit({ x: enemy.position.x, y: enemy.position.y + 3.6, z: enemy.position.z },
    { x: player.position.x, y: player.position.y + 3.6, z: player.position.z }, walls, []);
  const elite = enemy.definition.id === 'char-zaku';
  const meleeDistance = WEAPON_DEFINITIONS[enemy.definition.meleeWeapon].range - 0.3;
  const close = distance < meleeDistance && Math.abs(player.position.y - enemy.position.y) < 3.5;
  enemy.setWeapon(close ? 'melee' : 'ranged');
  let slash = false;
  if (close && clear && enemy.aiFireTimer <= 0 && !enemy.swing.running) {
    slash = enemy.swing.start(); enemy.aiFireTimer = elite ? 0.95 : 1.5;
  }
  let mx = 0, mz = 0;
  enemy.aiTimer -= dt;
  if (!clear) {
    if (enemy.aiTimer <= 0) {
      enemy.aiPath = findPath(enemy.position, player.position, walls, bounds, enemy.definition.radius, 5);
      enemy.aiTimer = 1.1 + (elite ? 0 : 0.25);
    }
    while (enemy.aiPath.length && Math.hypot(enemy.aiPath[0].x - enemy.position.x, enemy.aiPath[0].z - enemy.position.z) < 2) enemy.aiPath.shift();
    if (enemy.aiPath.length) { mx = enemy.aiPath[0].x - enemy.position.x; mz = enemy.aiPath[0].z - enemy.position.z; }
  } else if (distance > (elite ? 24 : 37)) { mx = dx; mz = dz; }
  else if (distance > 9) {
    if (enemy.aiTimer <= 0) { enemy.aiStrafe *= -1; enemy.aiTimer = 2.2 + Math.random() * 1.7; }
    const side = enemy.aiStrafe;
    mx = dz / Math.max(1, distance) * side; mz = -dx / Math.max(1, distance) * side;
    if (distance < 17 && !elite) { mx -= dx / distance * 0.7; mz -= dz / distance * 0.7; }
  } else if (!close) { mx = dx; mz = dz; }
  enemy.boosting = elite && clear && distance < 50 && distance > 12 && Math.sin(time * 1.7 + enemy.aiStrafe) > 0.7;
  const speed = enemy.boosting ? enemy.definition.boostSpeed : enemy.definition.speed;
  const length = Math.hypot(mx, mz);
  if (length > 0.01 && !enemy.swing.running) {
    const next = moveWithCollisions(enemy.position, { x: mx / length * speed * dt, z: mz / length * speed * dt }, enemy.definition.radius, walls, bounds);
    enemy.speed = Math.hypot(next.x - enemy.position.x, next.z - enemy.position.z) / dt;
    enemy.position.x = next.x; enemy.position.z = next.z;
  } else enemy.speed = 0;
  return { fire: clear && distance < 95 && !close && !enemy.swing.running && enemy.slot === 'ranged' && enemy.aiFireTimer <= 0 && enemy.aiReload <= 0, slash };
}
