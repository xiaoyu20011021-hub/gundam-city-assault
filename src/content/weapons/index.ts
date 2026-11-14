export interface WeaponDefinition {
  id: string;
  name: string;
  kind: 'projectile' | 'melee';
  visual?: 'beam' | 'bullet';
  damage: number;
  cooldown: number;
  range: number;
  speed: number;
  color: number;
  heatPerShot: number;
  cooling: number;
  magazine?: number;
  reloadTime?: number;
  blastRadius?: number;
  aimTime?: number;
}
export const WEAPON_DEFINITIONS: Record<string, WeaponDefinition> = {
  'nu-beam-rifle': { id: 'nu-beam-rifle', name: '牛高达光束步枪', kind: 'projectile', visual: 'beam', damage: 95, cooldown: 0.26, range: 220, speed: 240, color: 0xffe18c, heatPerShot: 23, cooling: 38 },
  'fin-funnel-beam': { id: 'fin-funnel-beam', name: 'Fin Funnel 光束', kind: 'projectile', visual: 'beam', damage: 12, cooldown: 1.2, range: 100, speed: 220, color: 0xffd36f, heatPerShot: 0, cooling: 0 },
  'beam-spray-gun': { id: 'beam-spray-gun', name: '光束喷枪', kind: 'projectile', damage: 65, cooldown: 0.2, range: 160, speed: 220, color: 0xff8bbd, heatPerShot: 16, cooling: 42 },
  'beam-rifle': { id: 'beam-rifle', name: '光束步枪', kind: 'projectile', damage: 95, cooldown: 0.26, range: 220, speed: 240, color: 0x7dffde, heatPerShot: 23, cooling: 38 },
  'beam-saber': { id: 'beam-saber', name: '光束军刀', kind: 'melee', damage: 180, cooldown: 0.78, range: 9, speed: 0, color: 0xff5eb8, heatPerShot: 0, cooling: 0 },
  'zaku-machinegun': { id: 'zaku-machinegun', name: '120mm 机枪', kind: 'projectile', damage: 12, cooldown: 0.14, range: 110, speed: 95, color: 0xffd069, heatPerShot: 0, cooling: 0, magazine: 45, reloadTime: 2.3 },
  'heat-hawk': { id: 'heat-hawk', name: '热能斧', kind: 'melee', damage: 75, cooldown: 1.15, range: 7.5, speed: 0, color: 0xff773f, heatPerShot: 0, cooling: 0 },
  'giant-bazooka': { id: 'giant-bazooka', name: '巨型火箭筒', kind: 'projectile', damage: 65, cooldown: 2.2, range: 145, speed: 42, color: 0xffab54, heatPerShot: 0, cooling: 0, magazine: 3, reloadTime: 3.6, blastRadius: 7, aimTime: 0.85 },
  'heat-saber': { id: 'heat-saber', name: '热能军刀', kind: 'melee', damage: 70, cooldown: 1.15, range: 8, speed: 0, color: 0xffb45e, heatPerShot: 0, cooling: 0 },
};
