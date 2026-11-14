import * as T from 'three';
import { random } from './layout';

export function surfaceTexture(kind: 'metal' | 'regolith') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!, rng = random(121);
  const data = c.createImageData(512, 512);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = (kind === 'metal' ? 185 : 145) + (rng() - .5) * (kind === 'metal' ? 19 : 45);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);
  if (kind === 'metal') {
    c.strokeStyle = '#555b5c'; c.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(512, i); c.stroke(); }
    c.fillStyle = '#777';
    for (let x = 5; x < 512; x += 128) for (let y = 5; y < 512; y += 128) { c.fillRect(x, y, 3, 3); c.fillRect(x + 115, y, 3, 3); }
  }
  const t = new T.CanvasTexture(canvas); t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(kind === 'metal' ? 2 : 100, kind === 'metal' ? 2 : 100); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function createMaterials() {
  const metal = surfaceTexture('metal');
  const standard = (color: number, roughness = .7, metalness = .35) => new T.MeshStandardMaterial({ color, roughness, metalness });
  return {
    white: new T.MeshStandardMaterial({ color: 0xc9c9c0, map: metal, roughness: .65, metalness: .35 }),
    silver: standard(0xa3adb0, .65, .55), dark: standard(0x222d33, .75, .45), armor: standard(0x59666d, .7, .5),
    concrete: standard(0x777b78, .94, .04), road: standard(0x252d31, .93, .08), line: standard(0xa3a69d, .7, .1),
    ochre: standard(0xb87e3f, .7, .35), red: standard(0x8c3d31, .65, .3), blue: standard(0x344e60, .6, .5),
    glass: new T.MeshStandardMaterial({ color: 0x385e6b, metalness: .72, roughness: .2, emissive: 0x1c414d, emissiveIntensity: .22 }),
    window: new T.MeshStandardMaterial({ color: 0x9cbdc5, emissive: 0x91d1e7, emissiveIntensity: .9, roughness: .35, metalness: .1 }),
    warm: new T.MeshStandardMaterial({ color: 0xc8ae81, emissive: 0xffbe62, emissiveIntensity: 1.2, roughness: .5 }),
    teal: new T.MeshBasicMaterial({ color: 0x8ccddd, toneMapped: false }),
    warning: new T.MeshBasicMaterial({ color: 0xffa753, toneMapped: false }),
    redLight: new T.MeshBasicMaterial({ color: 0xff4936, toneMapped: false }),
    dome: new T.MeshPhysicalMaterial({ color: 0x7ca5ae, metalness: .4, roughness: .12, transparent: true, opacity: .24, side: T.DoubleSide, depthWrite: false }),
    lunar: new T.MeshStandardMaterial({ color: 0x90908b, map: surfaceTexture('regolith'), roughness: 1, metalness: 0, vertexColors: true }),
  };
}
export type Materials = ReturnType<typeof createMaterials>;
