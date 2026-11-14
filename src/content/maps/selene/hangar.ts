import { Box3, Group } from 'three';
import { createGmRig } from '../../mechas/gm';

export const MOBILE_SUIT_BAYS = [-75, -25, 25, 75].map((x, i) => ({ x, designation: `RGM-79 04${i + 1}` }));

export function createHangarUnits(): Group {
  const root = new Group(); root.name = 'SELENE hangar mobile suits';
  const master = createGmRig();
  const box = new Box3().setFromObject(master.root);
  const scale = 18 / (box.max.y - box.min.y);
  for (const bay of MOBILE_SUIT_BAYS) {
    const unit = master.root.clone(true);
    unit.scale.setScalar(scale); unit.rotation.y = Math.PI;
    unit.position.set(130 + bay.x, 2.4 - box.min.y * scale, 732); root.add(unit);
  }
  // Clones share the master's resources, which the map's resource owner releases.
  return root;
}
