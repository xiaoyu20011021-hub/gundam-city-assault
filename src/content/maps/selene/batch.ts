import * as T from 'three';

export function chamferGeometry() {
  const s = new T.Shape(), a = .5, b = .34;
  s.moveTo(-b, -a); s.lineTo(b, -a); s.lineTo(a, -b); s.lineTo(a, b);
  s.lineTo(b, a); s.lineTo(-b, a); s.lineTo(-a, b); s.lineTo(-a, -b); s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(0, -.5, 0); return g;
}

export class Batch {
  constructor(private readonly cellSize = 0) {}
  readonly root = new T.Group();
  private frames = [new T.Matrix4()];
  private items = new Map<string, { geometry: T.BufferGeometry; material: T.Material; matrices: T.Matrix4[] }>();
  readonly geometries = { box: new T.BoxGeometry(1, 1, 1), cylinder: new T.CylinderGeometry(.5, .5, 1, 12), octagon: new T.CylinderGeometry(.5, .5, 1, 8), chamfer: chamferGeometry(), sphere: new T.SphereGeometry(.5, 10, 6) };
  frame(x: number, y: number, z: number, angle: number, build: () => void) {
    const m = new T.Matrix4().makeRotationY(angle); m.setPosition(x, y, z);
    this.frames.push(this.frames[this.frames.length - 1].clone().multiply(m));
    build(); this.frames.pop();
  }
  add(shape: keyof Batch['geometries'], mat: T.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0, rz = 0, rx = 0) {
    const key = shape + mat.uuid;
    if (!this.items.has(key)) this.items.set(key, { geometry: this.geometries[shape], material: mat, matrices: [] });
    const m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(w, h, d));
    m.premultiply(this.frames[this.frames.length - 1]); this.items.get(key)!.matrices.push(m);
  }
  box(mat: T.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) { this.add('box', mat, x, y, z, w, h, d, ry); }
  cylinder(mat: T.Material, x: number, y: number, z: number, diameter: number, h: number) { this.add('cylinder', mat, x, y, z, diameter, h, diameter); }
  beam(mat: T.Material, start: T.Vector3, end: T.Vector3, width: number, depth = width) {
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    const m = new T.Matrix4().compose(start.clone().add(end).multiplyScalar(.5), q, new T.Vector3(width, start.distanceTo(end), depth));
    m.premultiply(this.frames[this.frames.length - 1]); const key = 'box' + mat.uuid;
    if (!this.items.has(key)) this.items.set(key, { geometry: this.geometries.box, material: mat, matrices: [] });
    this.items.get(key)!.matrices.push(m);
  }
  finish(shadow = true) {
    for (const {geometry, material, matrices} of this.items.values()) {
      const cells = new Map<string, T.Matrix4[]>();
      for (const matrix of matrices) {
        const key = this.cellSize ? `${Math.floor(matrix.elements[12] / this.cellSize)},${Math.floor(matrix.elements[14] / this.cellSize)}` : 'all';
        const cell = cells.get(key) ?? []; cell.push(matrix); cells.set(key, cell);
      }
      for (const cell of cells.values()) {
        const mesh = new T.InstancedMesh(geometry, material, cell.length);
        cell.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = shadow && !(material instanceof T.MeshBasicMaterial);
        mesh.receiveShadow = true; mesh.computeBoundingSphere(); this.root.add(mesh);
      }
    }
    this.items.clear(); return this.root;
  }
}

export function ring(radius: number, width: number, y: number, material: T.Material, parent: T.Object3D, segments = 192) {
  const mesh = new T.Mesh(new T.RingGeometry(radius - width / 2, radius + width / 2, segments), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function terrace(radius: number, width: number, top: number, bottom: number, material: T.Material) {
  const shape = new T.Shape(); shape.absarc(0, 0, radius + width / 2, 0, Math.PI * 2, false);
  const hole = new T.Path(); hole.absarc(0, 0, radius - width / 2, 0, Math.PI * 2, true); shape.holes.push(hole);
  const geometry = new T.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, curveSegments: 96 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bottom, 0);
  const mesh = new T.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; return mesh;
}

export function label(text: string, width: number, color = '#c6d3d6', background = 'transparent') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  if (background !== 'transparent') { ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 256); }
  ctx.fillStyle = color; ctx.font = 'bold 118px monospace';
  const fontSize = Math.min(118, Math.floor(950 / ctx.measureText(text).width * 118));
  ctx.font = 'bold ' + fontSize + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 128);
  const tex = new T.CanvasTexture(canvas); tex.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(new T.PlaneGeometry(width, width / 4), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  return mesh;
}
