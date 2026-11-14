import type { RectCollider } from '../types';
import { SELENE_SCALE as s, type CityBlock } from './layout';

// Same normalized outlines as Batch's CylinderGeometry(8) and chamferGeometry().
const octagon = Array.from({ length: 8 }, (_, i) => ({ x: .5 + Math.cos(i * Math.PI / 4) * .5, z: .5 + Math.sin(i * Math.PI / 4) * .5 }));
const chamfer = [[.16, 0], [.84, 0], [1, .16], [1, .84], [.84, 1], [.16, 1], [0, .84], [0, .16]].map(([x, z]) => ({ x, z }));

function box(x: number, y: number, z: number, w: number, h: number, d: number, footprint?: RectCollider['footprint']): RectCollider {
  return { minX: (x - w / 2) * s, maxX: (x + w / 2) * s, minZ: (z - d / 2) * s, maxZ: (z + d / 2) * s,
    minY: Math.max(0, (y - h / 2) * s), height: (y + h / 2) * s, ...(footprint ? { footprint } : {}) };
}

/** Structural solids follow architecture.ts; thin trim, lights and antennae are decoration. */
export function buildingColliders(b: CityBlock): RectCollider[] {
  const { x, z, width: w, depth: d, height: h, style } = b;
  const walls: RectCollider[] = [];
  const add = (xx: number, y: number, zz: number, ww: number, hh: number, dd: number, footprint?: RectCollider['footprint']) => walls.push(box(x + xx, y, z + zz, ww, hh, dd, footprint));
  if (style === 1) {
    add(0, 3, 0, w + 8, 6, d + 8); add(0, 10, 0, w + 2, 12, d + 2, chamfer);
    for (const sign of [-1, 1]) {
      const height = h * (sign === -1 ? 1 : .79), xx = sign * w * .29;
      add(xx, height / 2 + 8, 0, w * .39, height, d * .9, chamfer);
      add(xx, height + 10, 0, w * .4, 4, d * .8);
      add(xx - w * .18, height / 2 + 8, d * .35, 2, height + 5, 3);
    }
    for (const y of [h * .35, h * .68]) {
      add(0, y, 0, w * .79, 9, d * .63); add(0, y + 5, 0, w * .85, 2, d * .7);
    }
  } else if (style === 2) {
    const diameter = Math.max(w, d);
    add(0, 3, 0, diameter + 8, 6, diameter + 8, octagon);
    add(0, h / 2 + 4, 0, diameter, h, diameter, octagon);
    add(0, h + 7, 0, diameter + 3, 6, diameter + 3, octagon);
    add(0, h + 13, 0, diameter * .6, 7, diameter * .6, octagon);
    add(0, h + 17, 0, diameter * .43, 2, diameter * .43, octagon);
  } else {
    add(0, 2, 0, w + 8, 4, d + 8);
    add(0, h * .47, 0, w * .7, h * .9, d * .7, chamfer);
    const tiers = style === 3 ? 3 : 2;
    for (let k = 0; k < tiers; k++) {
      const ww = w * (1 - k * .12), dd = d * (1 - k * .12), hh = h / tiers - 2, yy = 4 + k * h / tiers + hh / 2;
      add(0, yy, 0, ww, hh, dd, chamfer);
      add(0, yy - hh / 2 + 2, 0, ww + 1, 3, dd + 1);
    }
    add(0, h + 1, 0, w * .63, 3, d * .65);
    add(w * .12, h + 5, -d * .1, w * .26, 6, d * .32);
    if (h > 90) add(-w / 2 - 3, h * .43, 0, 6, h * .7, 7);
  }
  return walls;
}

export function landmarkColliders(): RectCollider[] {
  const main = [
    box(-90, 4, -95, 152, 8, 152, octagon), box(-90, 103, -95, 71, 198, 65, chamfer),
    box(-90, 223, -95, 55, 67, 54, chamfer), box(-90, 267, -95, 103, 29, 77, chamfer),
    box(-90, 253, -95, 110, 8, 81, chamfer), box(-90, 269, -95, 104, 9, 78, chamfer), box(-90, 287, -95, 88, 11, 67, chamfer),
  ];
  for (const x of [-33, 33]) for (const z of [-28, 28]) main.push(box(-90 + x, 130, -95 + z, 10, 247, 12));
  for (const sign of [-1, 1]) {
    main.push(box(-90, 28, -95 + sign * 57, 24, 55, 20));
    main.push(box(-90 + sign * 57, 28, -95, 20, 55, 24));
  }
  return main;
}
