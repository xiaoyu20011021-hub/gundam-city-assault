import type { Group } from 'three';
import { GeometryResources, group, mergeArmor, part } from './geometry';

/** Forward is -Z; lenses sit ahead of the opaque helmet, never inside it. */
export function createFederationHead(torso: Group, resources: GeometryResources, gm: boolean): Group {
  const head = group(torso, 'head', [0, 2.04, -0.04]);
  const helmet = group(head, 'helmet-armor');
  const white = resources.material(gm ? 0xd5e5dc : 0xf0f2ed);
  const pale = resources.material(gm ? 0x9ebbb3 : 0xaebcc7);
  const dark = resources.material(0x202c38);
  const red = resources.material(0xc7313e);
  const yellow = resources.material(0xffd75a, 0xffbd24, 0.45);
  const sensor = resources.material(gm ? 0x24b9b5 : 0x69edbb, gm ? 0x128c78 : 0x20c68c, gm ? 0.3 : 0.65);
  part(helmet, resources.cylinder(0.33, 0.33, 0.3), dark, [0, -0.1, 0]);
  part(helmet, resources.armor([[-0.17, 0.97, 0.73, 0.13], [0.28, 1.24, 0.93, 0.1],
    [1.18, 1.19, 0.92, 0.13], [1.59, 0.91, 0.69, 0.16], [1.7, 0.55, 0.46, 0.17]], 0.48), white);
  for (const side of [-1, 1]) {
    part(helmet, resources.armor([[-0.13, 0.18, 0.4, 0], [0.78, 0.24, 0.44, 0], [1.08, 0.19, 0.36, 0]], 0.42), pale, [side * 1.13, 0.04, 0.02]);
    part(helmet, resources.box(0.09, 0.69, 0.47), white, [side * 1.36, 0.52, 0.02]);
    for (let i = 0; i < 3; i++) part(helmet, resources.box(0.025, 0.065, 0.31), dark, [side * 1.411, 0.31 + i * 0.18, -0.01]);
    part(helmet, resources.plate([[0, 0.58], [side * 0.31, 0.62], [side * 0.34, -0.17], [side * 0.09, -0.35]], 0.29), white, [side * 0.77, 0.12, -0.93]);
  }
  if (gm) {
    // A single broad, bevel-edged green visor and plain chin distinguish RGM-79.
    const visor = [[-0.9, 0.2], [-0.27, 0.26], [-0.23, 0.5], [0.23, 0.5], [0.27, 0.26], [0.9, 0.2], [0.84, -0.21], [0.51, -0.37], [-0.51, -0.37], [-0.84, -0.21]] as const;
    part(helmet, resources.plate(visor, 0.1), dark, [0, 0.63, -0.98]);
    part(helmet, resources.plate(visor.map(([x, y]) => [x * 0.9, y * 0.82] as const), 0.045, 0.025), sensor, [0, 0.65, -1.07]);
    part(helmet, resources.plate([[-0.65, 0.08], [-0.28, 0.14], [-0.4, 0.03], [-0.68, -0.04]], 0.01, 0), resources.material(0x75dad1), [0, 0.68, -1.104]);
    part(helmet, resources.plate([[-0.58, 0.18], [0.58, 0.18], [0.42, -0.14], [-0.42, -0.14]], 0.19), white, [0, 0.06, -0.96]);
    part(helmet, resources.box(0.4, 0.83, 0.54), white, [0, 1.3, -0.26]);
    part(helmet, resources.box(0.28, 0.19, 0.07), dark, [0, 1.59, -0.59]);
    part(helmet, resources.box(0.21, 0.12, 0.035), sensor, [0, 1.59, -0.641]);
    for (const side of [-1, 1]) part(helmet, resources.cylinder(0.065, 0.065, 0.09), dark, [side * 0.75, 1.21, -0.77], [Math.PI / 2, 0, 0]);
  } else {
    part(helmet, resources.plate([[-0.94, 0.28], [0.94, 0.28], [0.76, -0.29], [-0.76, -0.29]], 0.13), dark, [0, 0.67, -0.98]);
    for (const side of [-1, 1]) {
      part(helmet, resources.plate([[side * 0.1, 0.02], [side * 0.8, 0.16], [side * 0.63, -0.1], [side * 0.13, -0.13]], 0.035, 0.008), yellow, [0, 0.73, -1.082]);
      part(helmet, resources.plate([[side * 0.02, 0.05], [side * 0.93, 0.27], [side * 0.83, 0.38], [side * 0.01, 0.2]], 0.12), white, [0, 0.76, -1.09]);
      part(helmet, resources.cylinder(0.12, 0.12, 0.09), dark, [side * 0.83, 1.21, -0.85], [Math.PI / 2, 0, 0]);
      part(helmet, resources.cylinder(0.072, 0.072, 0.11), yellow, [side * 0.83, 1.21, -0.9], [Math.PI / 2, 0, 0]);
      // The RX-78-2 antenna is white, swept sideways and tapering to a point.
      part(helmet, resources.plate([[side * 0.09, 0], [side * 0.29, -0.04], [side * 1.59, 1.01], [side * 1.44, 0.98]], 0.12, 0.018), white, [0, 1.17, -0.97]);
    }
    const mask = group(head, 'face-mask');
    part(mask, resources.plate([[-0.48, 0.35], [0, 0.49], [0.48, 0.35], [0.35, -0.15], [0, -0.34], [-0.35, -0.15]], 0.26, 0.035), white, [0, 0.28, -1.13]);
    for (let i = 0; i < 2; i++) part(mask, resources.box(0.34 - i * 0.045, 0.05, 0.02, 0.004), dark, [0, 0.4 - i * 0.13, -1.301]);
    part(mask, resources.plate([[-0.17, 0.18], [0.17, 0.18], [0.13, -0.2], [0, -0.3], [-0.13, -0.2]], 0.23), red, [0, -0.04, -1.16]);
    mergeArmor(mask, resources);
    part(helmet, resources.box(0.42, 0.73, 0.5), white, [0, 1.41, -0.3]);
    part(helmet, resources.plate([[-0.21, 0.29], [0.21, 0.29], [0.26, -0.09], [0, -0.29], [-0.26, -0.09]], 0.2), red, [0, 1.31, -1.02]);
    part(helmet, resources.box(0.25, 0.18, 0.08), sensor, [0, 1.69, -0.61]);
  }
  part(helmet, resources.box(0.22, 0.13, 0.07), sensor, [0, 1.4, 0.93]);
  mergeArmor(helmet, resources);
  return head;
}
