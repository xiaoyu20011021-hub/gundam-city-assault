import * as T from 'three';
import { Batch, ring } from './batch';
import { TRAIN_DIRECTIONS, trainPosition, wrapProgress } from './layout';
import type { Materials } from './materials';

function createShuttle(m: Materials) {
  const b = new Batch();
  b.add('chamfer', m.white, 0, 0, 0, 8, 3.5, 23);
  b.add('chamfer', m.glass, 0, 1.5, -6, 6.6, 2.6, 8);
  b.add('chamfer', m.armor, 0, -1.4, 2, 9, 1.6, 17);
  for (const s of [-1, 1]) {
    b.box(m.silver, s * 7, -.5, 3, 7, .7, 9, s * -.2);
    b.add('cylinder', m.dark, s * 4.8, -.5, 7, 3, 10, 3, 0, 0, Math.PI / 2);
    b.box(m.teal, s * 4.8, -.5, 12.2, 2, 2, .3);
    b.box(s === -1 ? m.redLight : m.teal, s * 10.5, -.2, 3, .7, .7, .7);
  }
  return b.finish();
}

export function createTraffic(m: Materials) {
  const root = new T.Group(), staticBatch = new Batch();
  root.name = 'Live transport / maglev, shuttle and cargo systems';
  // Two elevated ring rails with periodic concrete piers.
  ring(631, 13, 24, m.armor, root);
  ring(626.8, 1.4, 25, m.silver, root); ring(635.2, 1.4, 25, m.silver, root);
  ring(637.3, .7, 25.5, m.teal, root);
  for (let i = 0; i < 112; i++) {
    const a = i / 112 * Math.PI * 2, x = Math.cos(a) * 631, z = Math.sin(a) * 631;
    staticBatch.box(m.concrete, x, 10, z, 5, 24, 5, -a);
    staticBatch.box(m.silver, x, 21, z, 17, 2, 3, -a);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    staticBatch.frame(Math.cos(a) * 631, 0, Math.sin(a) * 631, -a, () => {
      staticBatch.box(m.concrete, 0, 23, 0, 30, 3, 83);
      staticBatch.box(m.white, 0, 36, 0, 34, 3, 88);
      for (const z of [-36, 36]) staticBatch.box(m.silver, -12, 29, z, 2, 13, 2);
      staticBatch.box(m.glass, -14, 29, 0, 1, 10, 76);
      staticBatch.box(m.ochre, 9, 25, 0, 1, .4, 81);
    });
  }
  const trains: { mesh: T.Group; direction: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const b = new Batch();
    for (let j = 0; j < 5; j++) {
      const t = i / 3 - j * .0042, p = trainPosition(t);
      b.frame(p.x, p.y, p.z, -t * Math.PI * 2 - Math.PI, () => {
      b.add('chamfer', m.white, 0, 0, 0, 5.2, 4.5, 15.4);
      b.box(m.dark, 0, -1.8, 0, 5.3, 1, 14.4);
      b.box(m.blue, 0, .8, 0, 5.3, 1.9, 13);
      b.box(m.teal, 0, -.7, 0, 5.4, .4, 13);
      if (j === 0) b.box(m.window, 0, 0, -7.8, 3.3, 1.8, .2);
      for (const side of [-1, 1]) for (let k = -2; k <= 2; k++) b.box(m.window, side * 2.68, .9, k * 2.4, .1, 1.3, 1.8);
      });
    }
    const mesh = b.finish(); root.add(mesh); trains.push({ mesh, direction: TRAIN_DIRECTIONS[i] });
  }
  const shuttles: { mesh: T.Group; path: T.CatmullRomCurve3; offset: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const mesh = createShuttle(m); root.add(mesh);
    const offset = i * 18;
    const path = new T.CatmullRomCurve3([
      new T.Vector3(850, 185 + offset, 310), new T.Vector3(420, 270 + offset, 520), new T.Vector3(-240, 310 + offset, 360),
      new T.Vector3(-610, 240 + offset, -150), new T.Vector3(-170, 345 + offset, -570), new T.Vector3(580, 245 + offset, -410),
    ], true, 'catmullrom', .25);
    shuttles.push({ mesh, path, offset: i / 4 });
  }
  const trucks: { mesh: T.Group; offset: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const b = new Batch();
    b.box(m.dark, 0, 1, 0, 4, 1, 10); b.add('chamfer', m.ochre, 0, 2.6, -3.9, 3.8, 3, 3);
    b.box(m.glass, 0, 3, -5.45, 2.8, 1.2, .1); b.box(m.silver, 0, 2.4, 1.6, 3.8, 2.8, 6.4);
    for (const x of [-2.1, 2.1]) for (const z of [-3.6, 1, 3.7]) b.add('cylinder', m.dark, x, .8, z, 1.6, .7, 1.6, 0, Math.PI / 2);
    b.box(m.window, 0, 1.8, -5.5, 3, .35, .1);
    const mesh = b.finish(); root.add(mesh); trucks.push({ mesh, offset: i / 9 });
  }
  const beacons = new T.InstancedMesh(new T.SphereGeometry(1.1, 6, 4), m.warning, 48);
  const dummy = new T.Object3D();
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2; dummy.position.set(Math.cos(a) * 981, 5, Math.sin(a) * 981); dummy.updateMatrix(); beacons.setMatrixAt(i, dummy.matrix);
  }
  root.add(beacons); root.add(staticBatch.finish());
  const lookTarget = new T.Vector3();
  const truckPoints = [new T.Vector3(-582, 1, -330), new T.Vector3(-582, 1, 440), new T.Vector3(-901, 1, 440), new T.Vector3(-901, 1, -330)];
  return {
    root,
    update(time: number) {
      for (const train of trains) train.mesh.rotation.y = -time * .0032 * train.direction * Math.PI * 2;
      for (const shuttle of shuttles) {
        const t = wrapProgress(time * .0025 + shuttle.offset); shuttle.mesh.position.copy(shuttle.path.getPointAt(t));
        lookTarget.copy(shuttle.path.getPointAt(wrapProgress(t + .002))); shuttle.mesh.lookAt(lookTarget); shuttle.mesh.rotateY(Math.PI);
        shuttle.mesh.rotation.z = Math.sin(time * .11 + shuttle.offset * 5) * .06;
      }
      for (const truck of trucks) {
        const t = wrapProgress(time * .007 + truck.offset);
        const segment = Math.floor(t * 4), alpha = t * 4 - segment;
        truck.mesh.position.lerpVectors(truckPoints[segment], truckPoints[(segment + 1) % 4], alpha);
        lookTarget.copy(truckPoints[(segment + 1) % 4]); truck.mesh.lookAt(lookTarget); truck.mesh.rotateY(Math.PI);
      }
      m.redLight.color.setScalar(.65 + Math.sin(time * 3) * .35); m.redLight.color.multiply(new T.Color(0xff5341));
      m.warning.color.setRGB(1, .49 + Math.sin(time * 2.4) * .09, .18);
      beacons.visible = Math.sin(time * 1.8) > -.5;
    },
  };
}
