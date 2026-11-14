import * as T from 'three';
import { Batch, label, ring, terrace } from './batch';
import { generateBlocks, random } from './layout';
import type { Materials } from './materials';

const TAU = Math.PI * 2;

function splitTower(b: Batch, m: Materials, x: number, z: number, w: number, d: number, h: number) {
  b.frame(x, 0, z, 0, () => {
    b.box(m.concrete, 0, 3, 0, w + 8, 6, d + 8);
    b.add('chamfer', m.armor, 0, 10, 0, w + 2, 12, d + 2);
    for (const sign of [-1, 1]) {
      const height = h * (sign === -1 ? 1 : .79), xx = sign * w * .29;
      b.add('chamfer', m.white, xx, height / 2 + 8, 0, w * .39, height, d * .9);
      b.box(m.dark, xx, height * .48 + 8, d * .451, w * .22, height * .83, .7);
      for (let y = 17; y < height; y += 7) b.box(m.window, xx, y, d * .46, w * .2, 1.1, .5);
      b.box(m.silver, xx - w * .18, height / 2 + 8, d * .35, 2, height + 5, 3);
      b.box(m.armor, xx, height + 10, 0, w * .4, 4, d * .8);
      b.box(m.ochre, xx, height + 3, d * .46, w * .3, 3, 1);
    }
    for (const y of [h * .35, h * .68]) {
      b.box(m.dark, 0, y, 0, w * .79, 9, d * .63);
      b.box(m.glass, 0, y, d * .33, w * .87, 4, 1);
      b.box(m.silver, 0, y + 5, 0, w * .85, 2, d * .7);
    }
    b.cylinder(m.silver, -w * .29, h + 20, 0, .8, 22);
    b.box(m.redLight, -w * .29, h + 32, 0, 1, 1, 1);
  });
}

function drumTower(b: Batch, m: Materials, x: number, z: number, w: number, d: number, h: number) {
  const diameter = Math.max(w, d);
  b.frame(x, 0, z, 0, () => {
    b.add('octagon', m.concrete, 0, 3, 0, diameter + 8, 6, diameter + 8);
    b.add('octagon', m.silver, 0, h * .5 + 4, 0, diameter, h, diameter);
    for (let y = 11; y < h; y += 9) {
      b.add('octagon', m.glass, 0, y, 0, diameter + .3, 3, diameter + .3);
      b.add('octagon', m.white, 0, y + 3.4, 0, diameter + 1.8, 2, diameter + 1.8);
      for (const side of [-1, 1]) b.box(m.window, side * diameter * .39, y, diameter * .18, .5, .7, diameter * .3);
    }
    for (let k = 0; k < 8; k++) {
      const a = (k + .5) / 8 * TAU;
      b.box(m.white, Math.sin(a) * diameter * .49, h / 2 + 4, Math.cos(a) * diameter * .49, 2, h + 1, 2, a);
    }
    b.add('octagon', m.armor, 0, h + 7, 0, diameter + 3, 6, diameter + 3);
    b.add('octagon', m.white, 0, h + 13, 0, diameter * .6, 7, diameter * .6);
    b.add('octagon', m.dark, 0, h + 17, 0, diameter * .43, 2, diameter * .43);
    b.cylinder(m.silver, diameter * .22, h + 23, 0, 1, 17);
    b.box(m.warning, diameter * .22, h + 32, 0, 1, 1, 1);
    b.box(m.ochre, 0, h * .7, diameter / 2 + .5, 6, 12, 1);
  });
}

function tower(b: Batch, m: Materials, x: number, z: number, w: number, d: number, h: number, style: number) {
  if (style === 1) { splitTower(b, m, x, z, w, d, h); return; }
  if (style === 2) { drumTower(b, m, x, z, w, d, h); return; }
  const body = style === 1 ? m.armor : style === 2 ? m.silver : m.white;
  b.frame(x, 0, z, 0, () => {
    b.box(m.concrete, 0, 2, 0, w + 8, 4, d + 8);
    b.add('chamfer', m.dark, 0, h * .47, 0, w * .7, h * .9, d * .7);
    const tiers = style === 3 ? 3 : 2;
    for (let k = 0; k < tiers; k++) {
      const ww = w * (1 - k * .12), dd = d * (1 - k * .12), hh = h / tiers - 2, yy = 4 + k * h / tiers + hh / 2;
      b.add('chamfer', body, 0, yy, 0, ww, hh, dd);
      b.box(m.dark, 0, yy - hh / 2 + 2, 0, ww + 1, 3, dd + 1);
      // Alternating recessed glazing, structural mullions and armored corner ribs.
      for (let floor = 7; floor < hh - 2; floor += 6) {
        const fy = yy - hh / 2 + floor;
        b.box(m.glass, 0, fy, dd / 2 + .04, ww * .72, 2.3, .22);
        b.box(m.glass, 0, fy, -dd / 2 - .04, ww * .72, 2.3, .22);
        b.box(m.glass, ww / 2 + .04, fy, 0, .22, 2.3, dd * .72);
        if ((Math.round(floor / 6) + style) % 3 !== 0) {
          b.box((style + floor) % 4 ? m.window : m.warm, -ww * .13, fy, dd / 2 + .2, ww * .38, .7, .35);
          b.box(m.window, ww / 2 + .2, fy, dd * .1, .35, .65, dd * .31);
        }
      }
      for (const side of [-1, 1]) {
        b.box(body, side * ww * .33, yy, dd / 2 + .45, 1.8, hh, 1.2);
        b.box(m.armor, ww / 2 + .45, yy, side * dd * .32, 1.2, hh, 1.8);
      }
    }
    b.box(m.dark, 0, h + 1, 0, w * .63, 3, d * .65);
    b.box(m.silver, w * .12, h + 5, -d * .1, w * .26, 6, d * .32);
    b.cylinder(m.silver, -w * .2, h + 9, 0, .8, 18);
    b.box(m.warning, -w * .2, h + 18, 0, 1.1, 1.1, 1.1);
    if (h > 90) {
      b.box(m.armor, -w / 2 - 3, h * .43, 0, 6, h * .7, 7);
      b.box(m.silver, -w / 2 - 7, h * .65, 0, 2, h * .32, 3);
      b.box(m.ochre, 0, h * .81, d / 2 + 1.1, w * .7, 3, 1);
    }
  });
}

function dome(parent: T.Group, b: Batch, m: Materials, x: number, z: number, radius: number, floor: number) {
  b.cylinder(m.dark, x, floor + 2, z, radius * 2.1, 5);
  b.cylinder(m.concrete, x, floor + 5, z, radius * 2, 3);
  const mesh = new T.Mesh(new T.SphereGeometry(radius, 32, 16, 0, TAU, 0, Math.PI / 2), m.dome); mesh.position.set(x, floor + 7, z); parent.add(mesh);
  const green = new T.MeshStandardMaterial({ color: 0x294e40, roughness: .94 });
  const garden = new T.Mesh(new T.CircleGeometry(radius * .93, 48), green); garden.rotation.x = -Math.PI / 2; garden.position.set(x, floor + 7, z); parent.add(garden);
  const lineMat = new T.LineBasicMaterial({ color: 0x8eaab3, transparent: true, opacity: .65 });
  const points: T.Vector3[] = [];
  for (let az = 0; az < 12; az++) {
    const phi = az / 12 * TAU;
    for (let j = 0; j < 16; j++) {
      for (const t of [j / 16, (j + 1) / 16]) { const a = t * Math.PI / 2; points.push(new T.Vector3(x + Math.cos(phi) * radius * Math.sin(a), floor + 7 + radius * Math.cos(a), z + Math.sin(phi) * radius * Math.sin(a))); }
    }
  }
  for (let k = 1; k < 5; k++) {
    const a = k / 5 * Math.PI / 2;
    for (let j = 0; j < 64; j++) for (const v of [j, j + 1]) { const phi = v / 64 * TAU; points.push(new T.Vector3(x + Math.cos(phi) * radius * Math.sin(a), floor + 7 + radius * Math.cos(a), z + Math.sin(phi) * radius * Math.sin(a))); }
  }
  parent.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points), lineMat));
  b.frame(x, floor + 7, z, 0, () => {
    for (let i = -1; i <= 1; i++) { b.box(m.line, i * 14, .3, 0, 2, .4, radius * 1.65); b.box(m.white, i * 18, 6, -radius * .25, 12, 12, 19); }
    const rng = random(Math.abs(Math.round(x)));
    for (let i = 0; i < 36; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * radius * .8;
      b.add('sphere', m.armor, Math.cos(a) * r, 3 + rng() * 5, Math.sin(a) * r, 5, 7, 5);
    }
  });
}

export function createArchitecture(m: Materials) {
  const root = new T.Group(), b = new Batch(600), rng = random(87);
  root.name = 'Planned city / civic and residential structures';
  const basin = new T.Mesh(new T.CircleGeometry(1020, 160), m.concrete); basin.rotation.x = -Math.PI / 2; basin.position.y = -.03; basin.receiveShadow = true; root.add(basin);
  for (const r of [598, 668, 970]) {
    ring(r, r === 970 ? 22 : 19, .3, m.road, root);
    ring(r - 8, .6, .4, m.line, root); ring(r + 8, .6, .4, m.line, root);
    for (let i = 0; i < 160; i++) {
      const a = i / 160 * TAU; b.box(m.line, Math.cos(a) * r, .5, Math.sin(a) * r, 3.8, .2, .6, -a);
    }
  }
  // Orthogonal service streets and broad axes through the city core.
  for (let j = -7; j <= 7; j++) {
    const offset = j * 69, length = Math.sqrt(Math.max(0, 578 ** 2 - offset ** 2)) * 2;
    b.box(m.road, offset, .15, 0, j === 0 ? 36 : 12, .3, length);
    b.box(m.road, 0, .16, offset, length, .3, j === 0 ? 36 : 12);
    for (let k = -Math.floor(length / 34); k <= Math.floor(length / 34); k++) {
      b.box(m.line, offset, .4, k * 16, .6, .1, 5);
      b.box(m.line, k * 16, .41, offset, 5, .1, .6);
    }
  }
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * TAU;
    b.frame(0, 0, 0, angle, () => {
      b.box(m.road, 0, 1, 797, 24, 2, 333);
      b.beam(m.road, new T.Vector3(0, 3, 690), new T.Vector3(0, 38, 970), 24, 3);
      for (const x of [-11, 11]) b.beam(m.line, new T.Vector3(x, 5, 690), new T.Vector3(x, 40, 970), .6, .3);
      for (let z = 710; z < 970; z += 48) { b.box(m.silver, 17, 12, z, 1.2, 23, 1.2); b.box(m.teal, 13, 23, z, 7, .6, 1); }
    });
  }
  // Retaining terraces: occupied areas deliberately avoid the industrial and port approaches.
  for (const [tier, radius] of [745, 845, 925].entries()) {
    root.add(terrace(radius, tier === 2 ? 58 : 64, tier * 16 + 1.8, -5, m.concrete));
    ring(radius, tier === 2 ? 58 : 64, tier * 16 + 2, m.dark, root);
    ring(radius + 31, 3, tier * 16 + 4, m.silver, root);
    const count = 68 + tier * 10;
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU;
      if ((a > 1.15 && a < 1.65) || (Math.cos(a) > .8 && Math.sin(a) > -.45) || (Math.cos(a) < -.83 && Math.sin(a) > -.42)) continue;
      const h = 20 + rng() * 13, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      b.frame(x, tier * 16 + 3, z, -a + Math.PI / 2, () => {
        b.box(m.concrete, 0, -1.1, 0, 61, 2.2, 36);
        b.box(m.white, 0, h / 2, 0, 58, h, 34);
        b.box(m.dark, 0, h / 2, 18, 54, h - 7, 2);
        for (let f = 5; f < h - 2; f += 5) for (let w = -22; w < 26; w += 8) b.box((w + i) % 3 ? m.window : m.warm, w, f, 19.1, 5, 1.2, .3);
        for (const v of [-26, 0, 26]) b.box(m.silver, v, h / 2, 20, 2, h + 3, 5);
        b.box(m.armor, 0, h + 2, 0, 62, 3, 38); b.box(m.ochre, -27, h * .5, 20.1, 4, 9, .3);
        b.box(m.silver, 13, h + 5, 0, 13, 4, 17);
      });
    }
  }
  for (const block of generateBlocks(87)) tower(b, m, block.x, block.z, block.width, block.depth, block.height, block.style);

  // Anaheim's landmark: a four-buttress, tapering superstructure with a suspended command crown.
  b.frame(-90, 0, -95, 0, () => {
    b.add('octagon', m.dark, 0, 4, 0, 152, 8, 152);
    b.add('chamfer', m.white, 0, 103, 0, 71, 198, 65);
    b.add('chamfer', m.armor, 0, 223, 0, 55, 67, 54);
    b.add('chamfer', m.white, 0, 267, 0, 103, 29, 77);
    b.add('chamfer', m.dark, 0, 253, 0, 110, 8, 81);
    b.add('chamfer', m.glass, 0, 269, 0, 104, 9, 78);
    b.add('chamfer', m.silver, 0, 287, 0, 88, 11, 67);
    for (const x of [-33, 33]) for (const z of [-28, 28]) {
      b.box(m.silver, x, 130, z, 10, 247, 12); b.box(m.dark, x, 127, z + 6.4, 5, 197, 1);
      b.box(m.teal, x, 137, z + 7, 1, 165, .5);
    }
    for (let y = 28; y < 248; y += 11) { b.box(m.glass, 0, y, 33.1, 52, 4, .5); b.box(m.window, 2, y, 33.5, 25, 1, .5); }
    b.box(m.ochre, 0, 237, 28, 42, 5, 2);
    b.cylinder(m.dark, 0, 306, 0, 24, 31); b.cylinder(m.silver, 0, 335, 0, 2, 70); b.box(m.redLight, 0, 371, 0, 2, 2, 2);
    for (let a = 0; a < 4; a++) b.frame(0, 0, 0, a * Math.PI / 2, () => { b.box(m.white, 0, 28, 57, 24, 55, 20); b.beam(m.silver, new T.Vector3(0, 15, 75), new T.Vector3(0, 170, 31), 6); });
  });
  const ae = label('AE', 29, '#e4d8bb'); ae.position.set(-90, 270, -55.8); root.add(ae);
  tower(b, m, 130, 85, 69, 60, 230, 3);
  // Keep sky bridges in the backdrop, beyond the flat central battle boundary.
  for (const [x, z, length, angle] of [[0, -610, 145, 0], [0, 610, 151, 0], [610, 0, 140, Math.PI / 2]]) {
    b.box(m.armor, x, 63, z, length, 7, 13, angle); b.box(m.glass, x, 67, z, length, 4, 11, angle);
    b.box(m.silver, x, 70, z, length, 1, 14, angle);
  }
  // Civic park and ecological habitats.
  dome(root, b, m, -470, -490, 67, 4);
  dome(root, b, m, -700, -420, 78, 21);
  dome(root, b, m, 430, -661, 72, 21);
  dome(root, b, m, -200, -833, 92, 37);
  root.add(b.finish());
  return root;
}
