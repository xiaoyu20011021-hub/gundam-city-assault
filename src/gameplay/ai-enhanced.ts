import type { Actor } from './actor';
import type { MapDefinition, RectCollider } from '../content/maps/types';
import { WEAPON_DEFINITIONS } from '../content/weapons';
import { firstSegmentHit, type Point3 } from './combat';
import { TargetTracker, interceptPoint, type TargetObservation } from './ai-aim';
import { DodgeController } from './ai-dodge';
import { findPath } from './navigation';
import { stepPlayerMovement } from './movement';
import type { ProjectileSnapshot } from './projectiles';

export const ENHANCED_PROFILES = {
  zaku: { reaction: 0.22, spread: 0.018, dodgeCooldown: 0.7 },
  elite: { reaction: 0.12, spread: 0.009, dodgeCooldown: 0.42 },
} as const;
interface EnemyState { tracker: TargetTracker; dodge: DodgeController; target: TargetObservation | null }
const states = new WeakMap<Actor, EnemyState>();
function stateFor(enemy: Actor): EnemyState {
  let state = states.get(enemy);
  if (!state) {
    const profile = enemy.definition.id === 'char-zaku' ? ENHANCED_PROFILES.elite : ENHANCED_PROFILES.zaku;
    state = { tracker: new TargetTracker(profile.reaction), dodge: new DodgeController(profile.reaction, profile.dodgeCooldown), target: null };
    states.set(enemy, state);
  }
  return state;
}

export function aimEnhancedEnemy(enemy: Actor, origin: Point3, random: () => number = Math.random): Point3 | null {
  const target = states.get(enemy)?.target;
  if (!target) return null;
  const weapon = WEAPON_DEFINITIONS[enemy.definition.rangedWeapon];
  const solution = interceptPoint(origin, target.position, target.velocity, weapon.speed, Math.min(1.1, weapon.range / weapon.speed));
  const point = solution?.point ?? { ...target.position };
  const distance = Math.hypot(point.x - origin.x, point.y - origin.y, point.z - origin.z);
  if (distance > weapon.range || distance < 0.01) return null;
  const profile = enemy.definition.id === 'char-zaku' ? ENHANCED_PROFILES.elite : ENHANCED_PROFILES.zaku;
  const spread = distance * profile.spread;
  return { x: point.x + (random() * 2 - 1) * spread, y: Math.max(1, Math.min(103, point.y + (random() * 2 - 1) * spread)),
    z: point.z + (random() * 2 - 1) * spread };
}

export function stepEnhancedEnemy(enemy: Actor, player: Actor, dt: number, time: number, walls: RectCollider[], bounds: MapDefinition['bounds'], unlimitedEnergy: boolean, shots: readonly ProjectileSnapshot[]): { fire: boolean; slash: boolean } {
  const state = stateFor(enemy), elite = enemy.definition.id === 'char-zaku';
  const dx = player.position.x - enemy.position.x, dz = player.position.z - enemy.position.z, distance = Math.hypot(dx, dz);
  const eye = { x: enemy.position.x, y: enemy.position.y + enemy.definition.height * 0.55, z: enemy.position.z };
  const target = { x: player.position.x, y: player.position.y + player.definition.height * 0.55, z: player.position.z };
  const clear = !firstSegmentHit(eye, target, walls, []);
  if (clear) state.tracker.observe(time, target, player.velocity);
  state.target = clear ? state.tracker.read(time) : null;
  enemy.yaw = Math.atan2(-dx, -dz);
  enemy.aimPitch = -Math.atan2(target.y - eye.y, Math.max(0.01, distance));
  enemy.aiFlightDelay = Math.max(0, enemy.aiFlightDelay - dt);
  if (unlimitedEnergy) enemy.aiRecovering = false;
  else {
    if (enemy.energy < 20) enemy.aiRecovering = true;
    if (enemy.aiRecovering && enemy.grounded && enemy.energy >= 80) { enemy.aiRecovering = false; enemy.aiFlightDelay = 0.6; }
  }
  const wantsFlight = player.flying || player.position.y > enemy.position.y + 5 || (time > 4 && (time + enemy.aiStrafe * 3) % 18 < 6);
  const toggleFlight = enemy.aiRecovering ? enemy.flying : !enemy.flying && enemy.grounded && wantsFlight && enemy.aiFlightDelay <= 0 && (unlimitedEnergy || enemy.energy >= 60);
  const close = distance < WEAPON_DEFINITIONS[enemy.definition.meleeWeapon].range - 0.3 && Math.abs(player.position.y - enemy.position.y) < 3.5;
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
      enemy.aiTimer = elite ? 1.1 : 1.35;
    }
    while (enemy.aiPath.length && Math.hypot(enemy.aiPath[0].x - enemy.position.x, enemy.aiPath[0].z - enemy.position.z) < 2) enemy.aiPath.shift();
    if (enemy.aiPath.length) { mx = enemy.aiPath[0].x - enemy.position.x; mz = enemy.aiPath[0].z - enemy.position.z; }
  } else if (distance > (elite ? 24 : 37)) { mx = dx; mz = dz; }
  else if (distance > 9) {
    if (enemy.aiTimer <= 0) { enemy.aiStrafe *= -1; enemy.aiTimer = 2.2 + Math.random() * 1.7; }
    mx = dz / Math.max(1, distance) * enemy.aiStrafe; mz = -dx / Math.max(1, distance) * enemy.aiStrafe;
    if (distance < 17 && !elite) { mx -= dx / distance * 0.7; mz -= dz / distance * 0.7; }
  } else if (!close) { mx = dx; mz = dz; }
  let lift = 0;
  if (enemy.flying && !enemy.aiRecovering) {
    let altitude = Math.max(6, Math.min(92, player.position.y + enemy.aiStrafe * (elite ? 2 : 4)));
    const directionLength = Math.max(0.01, Math.hypot(mx, mz)), margin = enemy.definition.radius + 0.4;
    for (const wall of walls) {
      // This query projects footprints to estimate a safe flight altitude.
      const expanded = { ...wall, minY: 0, minX: wall.minX - margin, maxX: wall.maxX + margin, minZ: wall.minZ - margin, maxZ: wall.maxZ + margin };
      if (firstSegmentHit({ x: enemy.position.x, y: 0.1, z: enemy.position.z },
        { x: enemy.position.x + mx / directionLength * 7, y: 0.1, z: enemy.position.z + mz / directionLength * 7 }, [expanded], [])) altitude = Math.max(altitude, wall.height + 2);
    }
    lift = Math.max(-1, Math.min(1, (altitude - enemy.position.y) * 2 / enemy.definition.flightSpeed));
    if (Math.abs(altitude - enemy.position.y) < 0.2) lift = 0;
  }
  if (enemy.aiRecovering || enemy.swing.running) { mx = 0; mz = 0; lift = 0; }
  const length = Math.max(1, Math.hypot(mx, mz));
  const hover = enemy.flying && clear && distance < 40 && Math.sin(time * 1.4 + enemy.aiStrafe) > 0.65;
  const base = { x: hover ? 0 : mx / length, z: hover ? 0 : mz / length, lift,
    boost: !enemy.aiRecovering && elite && clear && distance < 65 && distance > 16 && Math.sin(time * 1.7 + enemy.aiStrafe) > 0.7 };
  const move = state.dodge.step(enemy, shots, dt, time, walls, bounds, base, unlimitedEnergy);
  stepPlayerMovement(enemy, { x: move.x, z: -move.z, yaw: 0, lift: move.lift, boost: move.boost,
    jump: false, toggleFlight, unlimitedEnergy }, dt, walls, bounds);
  const aim = !close ? aimEnhancedEnemy(enemy, eye, () => 0.5) : null;
  if (aim) {
    const ax = aim.x - enemy.position.x, az = aim.z - enemy.position.z;
    enemy.yaw = Math.atan2(-ax, -az); enemy.aimPitch = -Math.atan2(aim.y - eye.y, Math.max(0.01, Math.hypot(ax, az)));
  }
  return { fire: clear && !!aim && !firstSegmentHit(eye, aim, walls, []) && !close && !enemy.swing.running && enemy.slot === 'ranged' && enemy.aiFireTimer <= 0 && enemy.aiReload <= 0, slash };
}
