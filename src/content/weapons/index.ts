export interface WeaponDefinition {
  id: string;
  name: string;
  kind: 'projectile' | 'melee';
  damage: number;
  cooldown: number;
  range: number;
  speed: number;
  color: number;
  heatPerShot: number;
  cooling: number;
  magazine?: number;
  reloadTime?: number;
}
export const WEAPON_DEFINITIONS: Record<string, WeaponDefinition> = {
  'beam-spray-gun': { id: 'beam-spray-gun', name: '光束喷枪', kind: 'projectile', damage: 65, cooldown: 0.2, range: 160, speed: 220, color: 0xff8bbd, heatPerShot: 16, cooling: 42 },
  'beam-rifle': { id: 'beam-rifle', name: '光束步枪', kind: 'projectile', damage: 95, cooldown: 0.26, range: 220, speed: 240, color: 0x7dffde, heatPerShot: 23, cooling: 38 },
  'beam-saber': { id: 'beam-saber', name: '光束军刀', kind: 'melee', damage: 180, cooldown: 0.78, range: 9, speed: 0, color: 0xff5eb8, heatPerShot: 0, cooling: 0 },
  'zaku-machinegun': { id: 'zaku-machinegun', name: '120mm 机枪', kind: 'projectile', damage: 12, cooldown: 0.14, range: 110, speed: 95, color: 0xffd069, heatPerShot: 0, cooling: 0, magazine: 12, reloadTime: 2.3 },
  'heat-hawk': { id: 'heat-hawk', name: '热能斧', kind: 'melee', damage: 75, cooldown: 1.15, range: 7.5, speed: 0, color: 0xff773f, heatPerShot: 0, cooling: 0 },
};
