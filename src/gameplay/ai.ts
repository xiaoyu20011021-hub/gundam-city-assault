import type { Actor } from './actor';
import type { MapDefinition, RectCollider } from '../content/maps/types';
import type { Point3 } from './combat';
import type { ProjectileSnapshot } from './projectiles';
import { stepEnemy as stepClassicEnemy } from './ai-classic';
import { aimEnhancedEnemy, stepEnhancedEnemy } from './ai-enhanced';
import { classicAimPoint } from './ai-aim';
import type { AIMode } from './ai-settings';

export type { AIMode } from './ai-settings';
export interface EnemyContext { mode: AIMode; projectiles: readonly ProjectileSnapshot[] }
export function stepEnemy(enemy: Actor, player: Actor, dt: number, time: number, walls: RectCollider[], bounds: MapDefinition['bounds'], unlimitedEnergy = false, context?: EnemyContext): { fire: boolean; slash: boolean } {
  return context?.mode === 'enhanced' ? stepEnhancedEnemy(enemy, player, dt, time, walls, bounds, unlimitedEnergy, context.projectiles) :
    stepClassicEnemy(enemy, player, dt, time, walls, bounds, unlimitedEnergy);
}
export function enemyAimPoint(enemy: Actor, player: Actor, origin: Point3, mode: AIMode, random: () => number = Math.random): Point3 | null {
  return mode === 'enhanced' ? aimEnhancedEnemy(enemy, origin, random) : classicAimPoint(player.position, random);
}
