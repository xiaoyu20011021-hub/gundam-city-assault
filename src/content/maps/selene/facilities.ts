import * as T from 'three';
import { Batch, label, ring } from './batch';
import { random, terrainHeight } from './layout';
import { MOBILE_SUIT_BAYS } from './hangar';
import type { Materials } from './materials';

export function hullGeometry() {
  const sections = [ [-172, 1, 1, -3], [-148, 15, 7, -2], [-103, 31, 13, 0], [-40, 38, 19, 0], [72, 35, 20, 0], [123, 29, 17, 0], [139, 28, 14, 0] ];
  const vertices: number[] = [], indices: number[] = [];
  for (const [z, w, h, dy] of sections) {
    for (const [x, y] of [[-w * .7, h], [w * .7, h], [w, h * .25], [w * .8, -h * .65], [-w * .8, -h * .65], [-w, h * .25]]) vertices.push(x, y + dy, z);
  }
  for (let j = 0; j < sections.length - 1; j++) for (let k = 0; k < 6; k++) {
    const a = j * 6 + k, b = j * 6 + (k + 1) % 6, c = b + 6, d = a + 6; indices.push(a, b, d, b, c, d);
  }
  for (let k = 1; k < 5; k++) { indices.push(0, k + 1, k); const n = (sections.length - 1) * 6; indices.push(n, n + k, n + k + 1); }
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

export function createCruiser(m: Materials) {
  const group = new T.Group(), b = new Batch();
  const hull = new T.Mesh(hullGeometry(), m.white); hull.castShadow = hull.receiveShadow = true; group.add(hull);
  b.add('chamfer', m.red, 0, -11, 17, 55, 8, 231);
  b.add('chamfer', m.armor, 0, 19, 20, 48, 5, 190);
  b.add('chamfer', m.white, 0, 32, 61, 35, 23, 61);
  b.add('chamfer', m.dark, 0, 46, 68, 30, 6, 29);
  b.add('chamfer', m.white, 0, 53, 65, 44, 10, 27);
  b.box(m.glass, 0, 54, 50.9, 32, 4, .6); b.box(m.teal, 0, 54, 50.5, 27, 1, .4);
  b.box(m.armor, 0, 63, 70, 10, 13, 12); b.cylinder(m.silver, 0, 79, 70, 1, 25); b.box(m.redLight, 0, 92, 70, 1.4, 1.4, 1.4);
  for (const sign of [-1, 1]) {
    // Sponsons, shield plates, radiator panels and ventral maneuvering engines.
    b.add('chamfer', m.white, sign * 44, 3, 40, 20, 21, 125);
    b.add('chamfer', m.armor, sign * 48, 14, 54, 21, 5, 98);
    b.box(m.blue, sign * 58, 2, 81, 5, 16, 60);
    for (let k = 0; k < 10; k++) b.box(m.silver, sign * 60.8, 3, 55 + k * 5, .8, 14, 1.2);
    b.box(m.ochre, sign * 38, 4, -35, 2, 2, 85);
    for (let i = 0; i < 12; i++) {
      b.box(m.dark, sign * 27, 18.2, -75 + i * 13, 2, .5, 8);
      b.box(m.window, sign * 37.5, 3, -47 + i * 8, .6, .7, 2.3);
    }
    for (let i = 0; i < 4; i++) {
      b.box(m.armor, sign * 34, -4, -50 + i * 43, 9, 18, 3);
      b.box(m.silver, sign * 25, 22, -36 + i * 35, 9, 4, 11);
    }
    b.box(m.redLight, sign * 56, 15, 12, 2, 1.2, 2);
  }
  for (const z of [-82, -13]) {
    b.cylinder(m.armor, 0, 21, z, 24, 5); b.add('chamfer', m.white, 0, 25, z, 18, 6, 15);
    for (const x of [-4, 4]) b.box(m.dark, x, 27, z - 12, 2.2, 2.2, 23);
  }
  for (const x of [-17, 0, 17]) {
    b.add('cylinder', m.dark, x, 0, 142, 14, 19, 14, 0, 0, Math.PI / 2);
    b.add('cylinder', m.armor, x, 0, 151, 12, 6, 12, 0, 0, Math.PI / 2);
    b.add('cylinder', m.teal, x, 0, 154.1, 8, .3, 8, 0, 0, Math.PI / 2);
  }
  const name = label('SCV-087', 30, '#31434b'); name.position.set(0, 16, -123); name.rotation.x = -Math.PI / 2; group.add(name);
  group.add(b.finish()); return group;
}

function maintenanceArm(b: Batch, m: Materials, x: number, z: number, mirror: number) {
  // Service arms stand clear of an 18 m airframe: the gripper parks outboard of the
  // shoulder line and forward of the cockpit instead of resting inside the armour.
  b.box(m.dark, x, 2, z, 4, 4, 4);
  b.cylinder(m.ochre, x, 9, z, 2, 14);
  const p1 = new T.Vector3(x, 14, z), p2 = new T.Vector3(x + mirror * 3, 19.5, z), p3 = new T.Vector3(x + mirror * 4.5, 16, z + 4);
  b.beam(m.ochre, p1, p2, 1.7); b.beam(m.silver, p2, p3, .9);
  b.add('sphere', m.dark, p2.x, p2.y, p2.z, 2.6, 2.6, 2.6); b.box(m.dark, p3.x, p3.y, p3.z, 2, 1.3, 1.3);
}

export function createFacilities(m: Materials) {
  const root = new T.Group(), b = new Batch(600), rng = random(197);
  root.name = 'Spaceport / industrial yards / hangar / mass driver';
  // Spaceport: a deep recessed berth flanked by loading platforms and crane gantries.
  b.frame(800, 0, 105, -.2, () => {
    b.box(m.dark, 0, 3, 0, 270, 10, 515);
    b.box(m.road, 0, 9, 0, 185, 2, 477);
    for (const x of [-114, 114]) {
      b.box(m.concrete, x, 11, 0, 38, 12, 510); b.box(m.silver, x, 18, 0, 39, 2, 512);
      b.box(m.ochre, x - Math.sign(x) * 20, 19, 0, 2, .2, 510);
      for (let z = -230; z < 240; z += 19) {
        b.box(m.dark, x, 19.1, z, 25, .2, 3, .45);
        b.box(m.teal, x + Math.sign(x) * 15, 19.8, z, 1.5, .5, 3);
      }
      for (const z of [-150, -10, 140]) {
        b.box(m.armor, x, 43, z, 12, 48, 14);
        b.box(m.white, x - Math.sign(x) * 18, 62, z, 44, 8, 12);
        b.box(m.ochre, x - Math.sign(x) * 39, 61, z, 6, 12, 14);
      }
    }
    for (const z of [-190, 185]) {
      for (const x of [-143, 143]) {
        b.box(m.armor, x, 69, z, 8, 136, 11);
        b.box(m.ochre, x, 139, z, 12, 4, 13);
        for (let h = 20; h < 130; h += 19) b.beam(m.silver, new T.Vector3(x - 3, h, z - 5), new T.Vector3(x + 3, h + 16, z + 5), 1.3);
      }
      b.box(m.silver, 0, 139, z, 300, 6, 12); b.box(m.dark, 0, 147, z, 300, 4, 11);
      for (let x = -130; x < 140; x += 22) b.beam(m.armor, new T.Vector3(x, 140, z), new T.Vector3(x + 19, 149, z), 1.5);
      b.box(m.ochre, 26, 138, z, 26, 8, 16); b.box(m.dark, 26, 115, z, .7, 40, .7);
    }
  });
  const cruiser = createCruiser(m); cruiser.position.set(800, 67, 105); cruiser.rotation.y = -.2; root.add(cruiser);
  const port = label('SELENE / 03', 95, '#d3c6a6'); port.rotation.x = -Math.PI / 2; port.rotation.z = -.2; port.position.set(820, 19.3, 360); root.add(port);
  // Secondary berth and docked logistics ship.
  b.box(m.dark, 735, 4, -435, 180, 8, 263); b.box(m.concrete, 735, 9, -435, 170, 3, 250);
  const transport = createCruiser(m); transport.position.set(735, 37, -425); transport.scale.setScalar(.54); transport.rotation.y = Math.PI; root.add(transport);
  for (let i = 0; i < 5; i++) { b.box(m.white, 1000, 20, -270 + i * 48, 63, 39, 32); b.box(m.dark, 996, 25, -252 + i * 48, 49, 23, 2); }
  b.add('chamfer', m.dark, 1010, 58, 42, 43, 116, 40);
  b.add('chamfer', m.white, 1010, 124, 42, 83, 19, 58); b.add('chamfer', m.glass, 1010, 122, 42, 84, 8, 59);
  b.add('chamfer', m.silver, 1010, 138, 42, 76, 8, 54); b.cylinder(m.silver, 1010, 155, 42, 2, 38);
  b.box(m.warning, 1010, 175, 42, 2.5, 2.5, 2.5);

  // Pressurized manufacturing halls with ribbed roofs, service bays, pipe racks and silos.
  b.box(m.concrete, -745, 1, 122, 340, 3, 620);
  for (let i = 0; i < 4; i++) {
    const z = -90 + i * 127, x = -755 + (i % 2) * 25;
    b.box(m.dark, x, 20, z, 193, 40, 88); b.add('chamfer', m.white, x, 42, z, 199, 11, 93);
    b.box(m.ochre, x, 28, z + 45, 194, 4, 2);
    for (let j = -4; j <= 4; j++) {
      b.box(m.silver, x + j * 23, 24, z + 46, 2.4, 47, 3);
      b.box(m.armor, x + j * 23, 49, z, 3, 3, 93);
      b.box(m.glass, x + j * 23 + 7, 32, z + 46.2, 10, 6, .7);
      b.box(m.teal, x + j * 23, 50.6, z, 1, .4, 25);
    }
    for (const v of [-45, 45]) {
      b.box(m.armor, x + v, 13, z + 46.5, 33, 26, 1); b.box(m.dark, x + v, 12, z + 47.2, 26, 21, .7);
      for (let y = 4; y < 22; y += 4) b.box(m.silver, x + v, y, z + 47.8, 25, .6, .4);
    }
    b.box(m.silver, x - 76, 55, z, 16, 14, 36);
    for (let j = 0; j < 5; j++) b.box(m.dark, x - 75, 62.1, z - 13 + j * 6, 12, .5, 2);
  }
  for (let i = 0; i < 8; i++) {
    const z = -250 + Math.floor(i / 4) * 60, x = -880 + (i % 4) * 52;
    b.cylinder(m.dark, x, 3, z, 45, 6); b.cylinder(m.silver, x, 28, z, 35, 49);
    b.add('sphere', m.white, x, 51, z, 35, 10, 35);
    for (const y of [12, 33, 46]) b.cylinder(m.armor, x, y, z, 36, 2);
    b.box(m.ochre, x, 30, z + 18, 5, 20, 1);
  }
  // Reactor and heat-exchanger towers: vacuum radiators, no atmospheric smoke.
  for (let i = 0; i < 3; i++) {
    const x = -970, z = 15 + i * 102;
    b.add('octagon', m.dark, x, 5, z, 69, 10, 69); b.cylinder(m.silver, x, 43, z, 39, 76);
    for (let y = 18; y < 83; y += 8) b.cylinder(m.armor, x, y, z, 58, 2.8);
    b.cylinder(m.white, x, 88, z, 43, 8); b.cylinder(m.ochre, x, 96, z, 25, 8);
    b.box(m.warning, x, 101, z, 2, 2, 2);
  }
  for (let i = 0; i < 9; i++) {
    const z = -300 + i * 65;
    b.box(m.armor, -626, 9, z, 3, 18, 4);
    for (const x of [-634, -625, -616]) b.add('cylinder', m.silver, x, 17, z, 3, 65, 3, 0, 0, Math.PI / 2);
  }
  const factory = label('AE / INDUSTRIAL 07', 135, '#d5c4a7'); factory.position.set(-730, 27, 340); root.add(factory);
  // Solar power and dark cooling arrays to the west of the crater.
  for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
    const x = -1440 - col * 55, z = -370 + row * 97, y = terrainHeight(x, z) + 10;
    b.box(m.armor, x, y - 4, z, 3, 10, 3); b.add('box', m.blue, x, y, z, 47, 1, 77, 0, 0, -.2);
    for (let k = -2; k <= 2; k++) b.box(m.silver, x + k * 9, y + 1, z, .5, .6, 76);
  }

  // Mobile-suit maintenance hall: open front, roof gantries and four distinct 18 m service bays.
  b.frame(130, 0, 736, 0, () => {
    b.box(m.concrete, 0, 1, 0, 215, 2, 153); b.box(m.road, 0, 2.2, 24, 200, .4, 98);
    b.box(m.dark, 0, 21, -43, 190, 42, 5);
    b.box(m.armor, 0, 42, -23, 202, 4, 60);
    b.box(m.white, 0, 40, 21, 205, 8, 9); b.box(m.ochre, 0, 35, 26, 201, 3, 1);
    for (const x of [-99, -51, 0, 51, 99]) {
      b.box(m.silver, x, 22, 20, 4, 43, 8); b.box(m.armor, x, 21, -40, 4, 42, 7);
      b.box(m.silver, x, 38, -9, 3, 3, 67);
    }
    for (const bay of MOBILE_SUIT_BAYS) {
      const x = bay.x;
      b.box(m.white, x, 16, -38, 33, 30, 3); b.box(m.dark, x, 15, -35.8, 19, 28, 1);
      b.box(m.window, x, 30, -34.9, 27, 1, 1);
      b.box(m.ochre, x, 2.7, 20, 31, .3, 1); b.box(m.ochre, x - 17, 2.7, 3, 1, .3, 34);
      b.box(m.ochre, x + 17, 2.7, 3, 1, .3, 34);
      b.box(m.silver, x, 11, -20, 30, 1, 8);
      for (const s of [-1, 1]) { b.box(m.dark, x + s * 13, 6, -20, 1, 12, 1); maintenanceArm(b, m, x + s * 12, 1, -s); }
      b.box(m.ochre, x, 36, -5, 14, 4, 8); b.box(m.dark, x, 27, -5, .4, 17, .4);
      // Airframes themselves come from world/mecha/mobileSuits; only the bay signage is here.
      const plate = label(bay.designation, 19, '#c0a37a'); plate.position.set(130 + x, 32, 762); root.add(plate);
    }
    for (let j = 0; j < 22; j++) { b.box(m.line, -104, 2.6, -40 + j * 5, 3, .2, 2); b.box(m.line, 104, 2.6, -40 + j * 5, 3, .2, 2); }
    b.box(m.armor, 129, 12, -4, 38, 24, 91); b.box(m.glass, 129, 18, 42, 31, 7, 1);
    for (let j = 0; j < 8; j++) b.box(m.silver, 116 + j * 4, 25, -4, 1, 1, 91);
  });
  const hangarSign = label('04 / MS MAINTENANCE', 117, '#d6c5a7'); hangarSign.position.set(130, 40.2, 762); root.add(hangarSign);
  for (let i = 0; i < 22; i++) {
    const x = 310 + Math.floor(i / 6) * 26, z = 645 + i % 6 * 21;
    b.box(i % 3 === 0 ? m.ochre : m.armor, x, 4.5, z, 22, 9, 13);
    for (let k = -4; k < 5; k++) b.box(m.silver, x + k * 2.3, 4.5, z + 6.6, .4, 8, .4);
  }

  // Electromagnetic launch structure: two rails, repeating acceleration coils and braced viaduct.
  b.frame(600, 0, -700, -.57, () => {
    for (let i = 0; i < 54; i++) {
      const z = -i * 70, y = 22 + i * 3.4;
      const foundation = terrainHeight(600 + Math.sin(.57) * i * 70, -700 - Math.cos(.57) * i * 70) - 2;
      for (const x of [-19, 19]) {
        b.beam(m.armor, new T.Vector3(x, y, z), new T.Vector3(x, y + 3.4, z - 70), 8, 8);
        b.beam(m.silver, new T.Vector3(x, y + 5, z), new T.Vector3(x, y + 8.4, z - 70), 5, 2);
        b.beam(m.teal, new T.Vector3(x, y + 6.2, z), new T.Vector3(x, y + 9.6, z - 70), .8, .4);
        b.box(m.concrete, x, (y + foundation) / 2, z, 10, Math.max(6, y - foundation), 15);
        b.box(m.dark, x, foundation, z, 19, 3, 23);
      }
      b.beam(m.dark, new T.Vector3(0, y - 2, z), new T.Vector3(0, y + 1.4, z - 70), 32, 5);
      b.box(m.silver, 0, y - 5, z, 55, 3, 7);
      if (i % 2 === 0) {
        for (const s of [-1, 1]) {
          b.beam(m.white, new T.Vector3(s * 30, y, z), new T.Vector3(s * 34, y + 34, z), 5, 8);
          b.beam(m.white, new T.Vector3(s * 34, y + 34, z), new T.Vector3(s * 20, y + 53, z), 5, 8);
          b.box(m.ochre, s * 34, y + 28, z, 5.5, 9, 9);
          b.box(m.teal, s * 27, y + 23, z + 4.1, 1, 25, 1);
        }
        b.box(m.silver, 0, y + 53, z, 41, 4, 8);
        b.box(m.warning, 0, y + 56, z, 3, 1, 3);
      }
    }
    b.box(m.armor, 0, 9, 55, 150, 18, 190); b.box(m.white, -65, 29, 55, 26, 40, 180);
    for (let i = 0; i < 7; i++) b.box(m.dark, -65, 50, i * 24 - 15, 28, 3, 2);
    b.box(m.ochre, -51, 31, 55, 2, 8, 170);
  });
  const driverSign = label('MASS DRIVER / 01', 116, '#d2c4aa'); driverSign.position.set(539, 40, -638); driverSign.rotation.y = -.57; root.add(driverSign);

  // Surface landing aprons and cargo handling infrastructure.
  for (const [x, z] of [[525, 430], [-520, 580]]) {
    const disk = new T.Mesh(new T.CircleGeometry(69, 64), m.road); disk.rotation.x = -Math.PI / 2; disk.position.set(x, .6, z); root.add(disk);
    const outline = ring(59, 1.2, .8, m.ochre, root); outline.position.x = x; outline.position.z = z;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.box(m.teal, x + Math.cos(a) * 66, 1.2, z + Math.sin(a) * 66, 1.8, .5, 1.8); }
    const h = label('H', 46, '#b4b6ac'); h.position.set(x, 1, z); h.rotation.x = -Math.PI / 2; root.add(h);
  }
  for (let i = 0; i < 45; i++) {
    const x = -550 - rng() * 30, z = -300 + rng() * 650;
    b.box(i % 4 === 0 ? m.ochre : m.armor, x, 5, z, 17, 10, 8);
  }
  root.add(b.finish()); return root;
}
