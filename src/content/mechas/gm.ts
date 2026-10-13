import { createFederationRig } from './gundam';
import type { MechaDefinition, MechaRig } from './types';

export function createGmRig(): MechaRig { return createFederationRig(true); }

export const gmDefinition: MechaDefinition = {
  id: 'gm', name: 'RGM-79 吉姆', maxHealth: 280, speed: 9.6, boostSpeed: 23,
  flightSpeed: 14, flightBoostSpeed: 29,
  radius: 1.12, height: 6.2, rangedWeapon: 'beam-spray-gun', meleeWeapon: 'beam-saber', createRig: createGmRig,
};
