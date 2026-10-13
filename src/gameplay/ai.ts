import type { Actor } from './actor';
import type { MapDefinition, RectCollider } from '../content/maps/types';
import { firstSegmentHit } from './combat';
import { findPath } from './navigation';
import { stepPlayerMovement } from './movement';
import { WEAPON_DEFINITIONS } from '../content/weapons';

export function stepEnemy(enemy: Actor, player: Actor, dt: number, time: number, walls: RectCollider[], bounds: MapDefinition['bounds'], unlimitedEnergy = false): { fire: boolean; slash: boolean } {
  const dx = player.position.x - enemy.position.x, dz = player.position.z - enemy.position.z, distance = Math.hypot(dx, dz);
  enemy.yaw = Math.atan2(-dx, -dz);
  enemy.aimPitch = -Math.atan2(player.position.y - enemy.position.y, Math.max(0.01, distance));
  const clear = !firstSegmentHit({ x: enemy.position.x, y: enemy.position.y + 3.6, z: enemy.position.z },
    { x: player.position.x, y: player.position.y + 3.6, z: player.position.z }, walls, []);
  const elite = enemy.definition.id === 'char-zaku';
  enemy.aiFlightDelay = Math.max(0, enemy.aiFlightDelay - dt);
  if (unlimitedEnergy) enemy.aiRecovering = false;
  else {
    if (enemy.energy < 20) enemy.aiRecovering = true;
    if (enemy.aiRecovering && enemy.grounded && enemy.energy >= 80) { enemy.aiRecovering = false; enemy.aiFlightDelay = 0.6; }
  }
  const wantsFlight = player.flying || player.position.y > enemy.position.y + 5 || (time > 4 && (time + enemy.aiStrafe * 3) % 18 < 6);
  const toggleFlight = enemy.aiRecovering ? enemy.flying : !enemy.flying && enemy.grounded && wantsFlight && enemy.aiFlightDelay <= 0 && (unlimitedEnergy || enemy.energy >= 60);
  const meleeDistance = WEAPON_DEFINITIONS[enemy.definition.meleeWeapon].range - 0.3;
  const close = distance < meleeDistance && Math.abs(player.position.y - enemy.position.y) < 3.5;
  enemy.setWeapon(close ? 'melee' : 'ranged');
  let slash = false;
  if (close && clear && enemy.aiFireTimer <= 0 && !enemy.swing.running) {
    slash = enemy.swing.start(); enemy.aiFireTimer = elite ? 0.95 : 1.5;
  }
  let mx = 0, mz = 0;
  enemy.aiTimer -= dt;
  if (!clear && !enemy.flying) {
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
  let lift = 0;
  if (enemy.flying && !enemy.aiRecovering) {
    let altitude = Math.max(6, Math.min(92, player.position.y + enemy.aiStrafe * (elite ? 2 : 4)));
    // Look ahead with the complete body footprint before crossing a facade.
    const directionLength = Math.max(0.01, Math.hypot(mx, mz)), margin = enemy.definition.radius + 0.4;
    for (const wall of walls) {
      const expanded = { ...wall, minX: wall.minX - margin, maxX: wall.maxX + margin, minZ: wall.minZ - margin, maxZ: wall.maxZ + margin };
      // Project onto the footprint: clearance must persist after rising above the
      // roof, until the entire body has crossed it (not only until a ray clears).
      const hit = firstSegmentHit({ x: enemy.position.x, y: 0.1, z: enemy.position.z },
        { x: enemy.position.x + mx / directionLength * 7, y: 0.1, z: enemy.position.z + mz / directionLength * 7 }, [expanded], []);
      if (hit) altitude = Math.max(altitude, wall.height + 2);
    }
    lift = Math.max(-1, Math.min(1, (altitude - enemy.position.y) * 2 / enemy.definition.flightSpeed));
    if (Math.abs(altitude - enemy.position.y) < 0.2) lift = 0;
  }
  if (enemy.aiRecovering || enemy.swing.running) { mx = 0; mz = 0; lift = 0; }
  const length = Math.hypot(mx, mz);
  // At close range, intermittent pauses create deliberate hover-and-fire windows.
  const hover = enemy.flying && clear && distance < 40 && Math.sin(time * 1.4 + enemy.aiStrafe) > 0.65;
  stepPlayerMovement(enemy, { x: hover ? 0 : mx / Math.max(1, length), z: hover ? 0 : -mz / Math.max(1, length), yaw: 0, lift,
    boost: !enemy.aiRecovering && elite && clear && distance < 65 && distance > 16 && Math.sin(time * 1.7 + enemy.aiStrafe) > 0.7,
    jump: false, toggleFlight, unlimitedEnergy }, dt, walls, bounds);
  return { fire: clear && Math.hypot(distance, player.position.y - enemy.position.y) < 95 && !close && !enemy.swing.running && enemy.slot === 'ranged' && enemy.aiFireTimer <= 0 && enemy.aiReload <= 0, slash };
}
