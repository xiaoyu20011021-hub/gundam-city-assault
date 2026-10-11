import { gundamDefinition } from './gundam';
import { charZakuDefinition, zakuDefinition } from './zaku';
import type { MechaDefinition } from './types';

export { createGundamRig, gundamDefinition } from './gundam';
export { createZakuRig, zakuDefinition, charZakuDefinition } from './zaku';
export type { MechaDefinition, MechaPose, MechaRig, WeaponSlot } from './types';

export const MECHA_DEFINITIONS: Record<string, MechaDefinition> = {
  gundam: gundamDefinition,
  zaku: zakuDefinition,
  'char-zaku': charZakuDefinition,
};
export const mechaDefinitions = MECHA_DEFINITIONS;

export function getMechaDefinition(id: string): MechaDefinition {
  const definition = MECHA_DEFINITIONS[id];
  if (!definition) throw new Error(`Unknown mecha: ${id}`);
  return definition;
}
