import type { RemoteWeaponConfig } from '../../gameplay/remote-weapons/types';

/** RX-93 loadout data only; lifecycle and targeting belong to the reusable system. */
export const NU_FIN_FUNNELS: RemoteWeaponConfig = {
  id: 'nu-fin-funnels', model: 'nu-fin-funnel',
  mountIds: Array.from({ length: 6 }, (_, index) => `funnel-${index}`),
  maxHealth: 48, radius: 0.5, height: 0.8, damageWeapon: 'fin-funnel-beam',
  acquireRange: 85, recallRange: 110, speed: 32, returnSpeed: 42, turnSpeed: 5,
  attackRadius: 16, sortieDuration: 6, maxShots: 5, shotInterval: 1.2,
  rechargeTime: 5, launchInterval: 0.12, lowHealthRatio: 0.25,
};
