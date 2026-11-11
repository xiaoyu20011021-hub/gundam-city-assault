import { LunarKit, seededRandom } from './lunar-kit';

function landingPad(kit: LunarKit, x: number, z: number, radius: number): void {
  kit.add('cylinder', 'metal', [x, -0.025, z], [radius * 2 + 3, 0.12, radius * 2 + 3], [0, 0, 0], '', false);
  kit.add('ring', 'paint', [x, 0.055, z], [radius, radius, 0.2], [-Math.PI / 2, 0, 0], '', false);
  kit.add('ring', 'cyan', [x, 0.065, z], [radius + 0.75, radius + 0.75, 0.12], [-Math.PI / 2, 0, 0], '', false);
  for (const side of [-1, 1]) {
    kit.box('paint', x + side * radius * 0.32, 0.09, z, 0.5, 0.015, radius * 0.9, 0, '', false);
    kit.box('amber', x + side * (radius + 0.8), 0.1, z, 0.3, 0.04, 1.6, 0, '', false);
  }
  kit.box('paint', x, 0.09, z, radius * 0.64, 0.015, 0.5, 0, '', false);
}

function groundNumber(kit: LunarKit, x: number, z: number, digit: number): void {
  const segments = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'][digit];
  const layout: Record<string, [number, number, number, number]> = {
    a: [0, -2, 2.4, 0.32], b: [1.1, -1, 0.32, 1.8], c: [1.1, 1, 0.32, 1.8],
    d: [0, 2, 2.4, 0.32], e: [-1.1, 1, 0.32, 1.8], f: [-1.1, -1, 0.32, 1.8], g: [0, 0, 2.4, 0.32],
  };
  for (const segment of segments) {
    const [dx, dz, w, d] = layout[segment];
    kit.box('paint', x + dx, 0.075, z + dz, w, 0.015, d, 0, '', false);
  }
}

export function addLunarTerrain(kit: LunarKit): void {
  const random = seededRandom(2079);
  kit.box('soil', 0, -0.65, 0, 2400, 1, 2400, 0, 'lunar-ground', false);
  kit.box('metal', 0, -0.13, 0, 280, 0.2, 280, 0, '', false);
  // Flush square deck plates; all raised structures remain outside navigable roads.
  for (let x = -130; x <= 130; x += 26) for (let z = -130; z <= 130; z += 26) {
    kit.box('road', x, -0.04, z, 25.75, 0.08, 25.75, 0, '', true);
  }
  for (const axis of [0, 1]) for (const lane of [-78, 0, 78]) {
    const at = (u: number, v: number): [number, number] => axis ? [v, u] : [u, v];
    for (const side of [-1, 1]) {
      for (let n = -136; n <= 136; n += 8) {
        const [x, z] = at(lane + side * 11.8, n);
        kit.box('metal', x, 0.015, z, axis ? 7.5 : 0.8, 0.03, axis ? 0.8 : 7.5, 0, '', false);
        const [lx, lz] = at(lane + side * 11.8, n + 1.5);
        kit.box('cyan', lx, 0.04, lz, axis ? 2.1 : 0.16, 0.025, axis ? 0.16 : 2.1, 0, '', false);
      }
    }
    for (let n = -132; n <= 132; n += 12) {
      if (Math.abs(n) < 27 || Math.abs(Math.abs(n) - 78) < 16) continue;
      const [x, z] = at(lane, n);
      kit.box('paint', x, 0.018, z, axis ? 3.6 : 0.18, 0.02, axis ? 0.18 : 3.6, 0, '', false);
    }
  }
  kit.box('metal', 0, 0.015, 0, 49, 0.035, 49, 0, '', true);
  for (let n = -24; n <= 24; n += 6) {
    kit.box('dark', n, 0.04, 0, 0.06, 0.015, 48, 0, '', false);
    kit.box('dark', 0, 0.04, n, 48, 0.015, 0.06, 0, '', false);
  }
  landingPad(kit, 0, 0, 14);
  landingPad(kit, 0, 55, 8);
  groundNumber(kit, -2, 21, 0); groundNumber(kit, 2, 21, 1);
  groundNumber(kit, -5, 68, 0); groundNumber(kit, -1, 68, 2);
  for (const s of [-1, 1]) for (let i = -5; i <= 5; i++) {
    kit.box('amber', i * 2, 0.06, s * 24, 0.7, 0.02, 1.1, -0.55, '', false);
  }
  // Recessed utility hatches and blast marks do not introduce phantom cover.
  for (let i = 0; i < 24; i++) {
    const lane = [-78, 0, 78][i % 3];
    const z = -124 + (i % 8) * 33;
    kit.box('dark', lane + 8, 0.035, z, 1.8, 0.03, 2.8, 0, '', false);
    for (let n = -1; n <= 1; n++) kit.box('metal', lane + 8 + n * 0.45, 0.055, z, 0.18, 0.02, 2.4, 0, '', false);
  }
  for (const [x, z, r] of [[-7, -44, 3], [82, 20, 4], [-70, 92, 4], [21, -76, 3]]) {
    kit.add('cylinder', 'scorch', [x, 0.035, z], [r * 2, 0.012, r * 1.4], [0, 0.6, 0], '', false);
    for (let n = 0; n < 7; n++) kit.box('scorch', x + (random() - 0.5) * 7, 0.046, z + (random() - 0.5) * 7, 0.1, 0.01, 2 + random() * 3, random() * Math.PI, '', false);
  }

  // A clear perimeter frames the artificial deck against the regolith.
  for (const side of [-1, 1]) for (let n = -130; n <= 130; n += 13) {
    for (const [x, z, yaw] of [[n, side * 140, 0], [side * 140, n, Math.PI / 2]]) {
      kit.box('armor', x, 0.45, z, 12, 0.9, 1.5, yaw);
      kit.box('amber', x, 0.95, z, 1.8, 0.07, 0.7, yaw, '', false);
    }
  }
  for (let i = 0; i < 160; i++) {
    const a = random() * Math.PI * 2;
    const radius = 220 + random() * 580;
    const size = 4 + random() * 30;
    kit.add('rock', i % 3 ? 'soil' : 'rock', [Math.sin(a) * radius, -1, Math.cos(a) * radius],
      [size * 2, size * (0.25 + random() * 0.45), size], [0, random() * 6, 0], '', false);
  }
  for (const [x, z, r] of [[-180, 40, 22], [175, 90, 24], [30, -216, 34], [-270, -150, 42], [240, 255, 55]]) {
    kit.add('cylinder', 'scorch', [x, -0.12, z], [r * 2, 0.03, r * 2], [0, 0, 0], '', false);
    kit.add('ring', 'rock', [x, -0.08, z], [r, r, r * 1.4], [-Math.PI / 2, 0, 0], '', false);
    kit.add('cylinder', 'soil', [x, -0.09, z], [r * 1.5, 0.03, r * 1.5], [0, 0, 0], '', false);
  }
  // Distant clustered silhouettes and conduits, all beyond the playable boundary.
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
    const x = side * (186 + random() * 45), z = -190 + i * 47, h = 18 + random() * 65;
    kit.box('hull', x, h / 2, z, 19, h, 22);
    kit.box('armor', x, h - 3, z, 22, 6, 24);
    for (let y = 8; y < h - 5; y += 8) {
      kit.box('glass', x - side * 9.6, y, z, 0.15, 1.8, 19, 0, '', false);
      kit.box('cyan', x - side * 9.75, y, z, 0.08, 0.35, 13, 0, '', false);
    }
    kit.box('metal', x, h + 3, z, 0.35, 6, 0.35);
    kit.add('sphere', 'red', [x, h + 6, z], [0.3, 0.3, 0.3], [0, 0, 0], '', false);
  }
  for (const x of [-70, 70]) {
    kit.box('metal', x, 4, -183, 32, 8, 22);
    kit.add('sphere', 'pale', [x, 8, -183], [14, 7, 10]);
    kit.add('cylinder', 'metal', [x, 17, -183], [1, 12, 1]);
    kit.add('sphere', 'armor', [x, 23, -183], [8, 1, 8], [0.55, 0, 0]);
    kit.add('cylinder', 'dark', [x, 25, -183], [0.3, 5, 0.3], [0.55, 0, 0]);
  }
}
