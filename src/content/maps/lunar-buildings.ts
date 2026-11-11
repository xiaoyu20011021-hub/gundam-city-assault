import type { CityBuilding } from './city';
import { LunarKit, seededRandom, type Surface } from './lunar-kit';

/** Structural shells stay exactly on the collision envelopes. Facade details are shallow relief. */
export function addLunarBuildings(kit: LunarKit, buildings: CityBuilding[]): void {
  buildings.forEach((b, index) => {
    const { x, z, width: w, depth: d, height: h } = b;
    const kind = index % 4;
    const random = seededRandom(701 + index);
    const damaged = index === 1 || index === 6 || index === 11 || index === 14;
    kit.box('hull', x, h / 2, z, w, h, d, 0, 'building-shells');

    // Four armoured corner columns and the foundation anchor the architectural scale.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      kit.box('pale', x + sx * (w / 2 - 1.0), h / 2, z + sz * (d / 2 - 1.0), 2.2, h + 0.04, 2.2);
      kit.box('metal', x + sx * (w / 2 - 1.52), 2, z + sz * (d / 2 - 1.52), 3.4, 4, 3.4);
    }
    // Local face coordinates: u runs along the facade, v is height, relief is outward.
    for (let side = 0; side < 4; side++) {
      const yaw = side * Math.PI / 2;
      const span = side % 2 ? d : w;
      const distance = (side % 2 ? w : d) / 2;
      const face = (surface: Surface, u: number, v: number, width: number, height: number, relief = 0.12) => {
        kit.box(surface, x + Math.sin(yaw) * (distance + relief / 2) + Math.cos(yaw) * u,
          v, z + Math.cos(yaw) * (distance + relief / 2) - Math.sin(yaw) * u,
          width, height, relief, yaw, '', !['cyan', 'amber', 'glass', 'scorch'].includes(surface));
      };
      face('metal', 0, 1.3, span, 2.6);
      face('pale', 0, h - 1, span, 2);
      const floors = Math.floor((h - 7) / 5);
      for (let row = 0; row < floors; row++) {
        const y = 5.3 + row * 5;
        const broken = damaged && side === 0 && row > floors / 2 - 1 && row < floors / 2 + 2;
        // Missing external plates reveal a solid scorched pressure hull, never a false passage.
        face(broken ? 'scorch' : kind === 2 ? 'metal' : 'armor', 0, y, span - 4.5, 3.85);
        if (kind === 0) {
          for (let u = -span / 2 + 4; u < span / 2 - 2; u += 3.5) {
            face(broken ? 'dark' : random() > 0.2 ? 'cyan' : 'glass', u, y + 0.3, 1.5, 1.2, 0.18);
            face('dark', u, y - 1, 1.5, 0.22, 0.18);
          }
        } else if (kind === 1) {
          face(broken ? 'dark' : 'glass', 0, y + 0.4, span - 6, 1.3, 0.18);
          for (let u = -span / 2 + 4; u < span / 2 - 3; u += 5) {
            face(broken ? 'metal' : 'cyan', u, y + 0.4, 2.3, 0.45, 0.23);
            face('pale', u + 1.8, y, 0.35, 3.4, 0.26);
          }
        } else if (kind === 2) {
          face('dark', 0, y, span - 6, 2.4, 0.17);
          for (let u = -span / 2 + 4; u < span / 2 - 3; u += 2.5) face('metal', u, y, 0.65, 2.4, 0.25);
          if (row % 2 === 0) face('amber', 0, y + 1.6, span - 7, 0.16, 0.2);
        } else {
          for (const u of [-span * 0.25, 0, span * 0.25]) {
            face(broken ? 'scorch' : 'pale', u, y, 3.8, 4.2, 0.28);
            face('dark', u, y, 2.5, 2.5, 0.32);
            face(broken ? 'metal' : 'cyan', u, y, 0.22, 1.8, 0.36);
          }
        }
        if (broken) {
          for (let j = 0; j < 5; j++) face('metal', -span / 2 + 4 + j * (span - 8) / 4, y, 0.25, 3.7, 0.3);
          face('amber', span / 2 - 4, y, 0.3, 0.8, 0.35);
        }
      }
      // Airlock doors and industrial identification bars.
      face('dark', 0, 3.2, kind === 2 ? span - 7 : 5, 5.8, 0.2);
      face('metal', 0, 3.2, kind === 2 ? span - 8 : 4.3, 5.1, 0.24);
      face('dark', 0, 3.2, 0.15, 4.8, 0.29);
      face('amber', 0, 6.2, kind === 2 ? span - 7 : 5, 0.18, 0.28);
      for (let j = 0; j < kind + 1; j++) face('paint', -span / 2 + 4 + j * 1.3, h - 3.3, 0.65, 1.5, 0.2);
    }

    // Top-level machinery is inset into the pressure shell's footprint.
    // The small antenna tips extend above the collider like the existing rooftop details.
    kit.box('dark', x, h + 0.04, z, w - 4, 0.08, d - 4, 0, '', false);
    if (kind === 0) {
      kit.box('metal', x, h + 0.7, z, w * 0.42, 1.4, d * 0.5);
      for (let n = -2; n <= 2; n++) kit.box('pale', x + n * 2, h + 1.45, z, 0.7, 0.1, d * 0.45);
    } else if (kind === 1) {
      for (const u of [-w * 0.23, w * 0.23]) {
        kit.add('cylinder', 'metal', [x + u, h + 0.8, z], [4.5, 1.6, 4.5]);
        kit.add('ring', 'cyan', [x + u, h + 1.62, z], [1.9, 1.9, 0.4], [-Math.PI / 2, 0, 0], '', false);
      }
    } else if (kind === 2) {
      for (let n = -1; n <= 1; n++) kit.box('armor', x + n * 5, h + 0.6, z, 3.2, 1.2, d * 0.5);
    } else {
      kit.add('sphere', 'metal', [x, h, z], [w * 0.26, 2.2, d * 0.26]);
      kit.add('ring', 'cyan', [x, h + 0.5, z], [w * 0.26, d * 0.26, 0.5], [-Math.PI / 2, 0, 0], '', false);
    }
    kit.add('cylinder', 'metal', [x - w * 0.3, h + 1.4, z - d * 0.3], [0.22, 2.8, 0.22], [0, 0, damaged ? 0.45 : 0]);
    kit.add('sphere', 'red', [x - w * 0.3, h + 2.85, z - d * 0.3], [0.22, 0.22, 0.22], [0, 0, 0], '', false);
    if (damaged) {
      for (let n = 0; n < 8; n++) kit.add('rock', n % 2 ? 'metal' : 'scorch',
        [x + (random() - 0.5) * (w - 8), h + 0.5, z + (random() - 0.5) * (d - 8)],
        [1 + random(), 0.5, 1 + random()], [0, random() * Math.PI, 0]);
    }
  });
}
