import * as T from 'three';
import { Batch } from './batch';
import { random, terrainHeight } from './layout';
import type { Materials } from './materials';

function earthTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
  const c = canvas.getContext('2d')!, rng = random(112);
  const bg = c.createLinearGradient(0, 0, 0, 1024); bg.addColorStop(0, '#7696ae'); bg.addColorStop(.18, '#1f4d72'); bg.addColorStop(.5, '#17496c'); bg.addColorStop(.85, '#254a67'); bg.addColorStop(1, '#d2dce1'); c.fillStyle = bg; c.fillRect(0, 0, 2048, 1024);
  // Coarse geographical silhouettes in longitude / latitude; cloud bands soften coastlines.
  const continents = [
    [[-168,70],[-140,70],[-124,58],[-130,50],[-123,40],[-108,25],[-98,19],[-83,10],[-78,20],[-82,28],[-75,37],[-59,51],[-64,60],[-82,61],[-95,74],[-130,74]],
    [[-81,10],[-66,9],[-50,-1],[-35,-8],[-43,-23],[-54,-34],[-68,-55],[-75,-45],[-72,-15]],
    [[-17,34],[8,37],[32,31],[43,12],[51,10],[40,-8],[34,-23],[19,-35],[10,-28],[2,-5],[-15,7]],
    [[-10,36],[-10,57],[4,60],[18,71],[49,70],[70,77],[110,74],[147,60],[178,63],[171,48],[145,40],[140,32],[122,24],[111,5],[101,1],[92,22],[80,8],[70,25],[45,31],[35,41],[23,36],[15,42]],
    [[113,-23],[130,-12],[146,-16],[154,-28],[145,-39],[128,-33],[115,-34]],
    [[-52,60],[-44,60],[-20,76],[-35,83],[-54,80],[-62,70]],
    [[46,-13],[51,-15],[48,-25],[44,-24]], [[132,33],[142,44],[145,42],[139,34]],
  ];
  for (const points of continents) {
    c.beginPath(); points.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * 2048, y = (90 - lat) / 180 * 1024; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.fillStyle = '#777f6c'; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 2600; i++) { c.fillStyle = rng() > .55 ? '#8c8b71' : '#4b6862'; c.globalAlpha = .18; c.fillRect(rng() * 2048, rng() * 1024, 8 + rng() * 20, 3 + rng() * 8); }
    c.restore();
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 1250; i++) {
    const x = rng() * 2048, y = rng() * 1024, w = 8 + rng() * 110;
    c.beginPath(); c.ellipse(x, y, w, 1 + rng() * 9, -.3, 0, Math.PI * 2); c.fillStyle = 'rgba(235,245,248,' + (.05 + rng() * .28) + ')'; c.fill();
  }
  const t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace; return t;
}

export function createEnvironment(scene: T.Group, mat: Materials) {
  let disposed = false;
  const geometry = new T.PlaneGeometry(15000, 15000, 160, 160); geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position, colors = new Float32Array(pos.count * 3), rng = random(48);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), z = pos.getZ(i);
    const radius = Math.hypot(x, z);
    if (radius > 6200) { x *= 6200 / radius; z *= 6200 / radius; pos.setX(i, x); pos.setZ(i, z); }
    pos.setY(i, terrainHeight(x, z));
    const n = .71 + rng() * .19 + Math.sin(x * .007 + z * .012) * .035;
    colors.set([n, n, n * .99], i * 3);
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const terrain = new T.Mesh(geometry, mat.lunar); terrain.receiveShadow = true; terrain.name = 'Lunar regolith / crater rim'; scene.add(terrain);

  const rockMat = new T.MeshStandardMaterial({ color: 0x777971, roughness: 1 });
  const rockHigh = new T.IcosahedronGeometry(1, 1), rockLow = new T.IcosahedronGeometry(1, 0);
  const rocks = new T.InstancedMesh(rockLow, rockMat, 600), dummy = new T.Object3D();
  for (let i = 0; i < 600; i++) {
    const a = rng() * Math.PI * 2, r = 1320 + rng() * 3600, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 2 + rng() * 12;
    dummy.position.set(x, terrainHeight(x, z) + s * .1, z); dummy.rotation.set(rng() * 3, rng() * 6, rng()); dummy.scale.set(s * 1.7, s * .7, s); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.receiveShadow = true; scene.add(rocks);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39, r = 1120 + rng() * 130;
    const lod = new T.LOD(), hi = new T.Mesh(rockHigh, rockMat), lo = new T.Mesh(rockLow, rockMat);
    lod.addLevel(hi, 0); lod.addLevel(lo, 1400); lod.position.set(Math.cos(a) * r, terrainHeight(Math.cos(a) * r, Math.sin(a) * r), Math.sin(a) * r); lod.scale.set(25, 17, 23); scene.add(lod);
  }

  const starPos: number[] = [], starColors: number[] = [];
  for (let i = 0; i < 2100; i++) {
    const a = rng() * Math.PI * 2, y = .08 + rng() * .92, rad = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(a) * rad * 14000, y * 14000, Math.sin(a) * rad * 14000);
    const v = .2 + rng() * .55; starColors.push(v * .85, v * .91, v);
  }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(starPos, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(starColors, 3));
  const stars = new T.Points(sg, new T.PointsMaterial({ size: 6.5, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: .72, depthWrite: false })); scene.add(stars);

  const earth = new T.Group(); earth.position.set(-5200, 1700, -9200);
  const globe = new T.Mesh(new T.SphereGeometry(650, 64, 48), new T.MeshStandardMaterial({ map: earthTexture(), roughness: .93, metalness: 0, emissive: 0x1c4669, emissiveIntensity: .18 }));
  globe.rotation.y = -1.4; globe.rotation.z = .18; earth.add(globe);
  new T.TextureLoader().load(import.meta.env.BASE_URL + 'assets/selene/earth-atmosphere.jpg', texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    globe.material.map?.dispose(); globe.material.map = texture; globe.material.needsUpdate = true;
  }, undefined, () => { /* The locally generated geographic texture remains available offline. */ });
  const atmosphere = new T.Mesh(new T.SphereGeometry(665, 48, 32), new T.ShaderMaterial({
    vertexShader: 'varying vec3 vNormal; varying vec3 vPosition; void main(){ vNormal=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.); vPosition=p.xyz; gl_Position=projectionMatrix*p; }',
    fragmentShader: 'varying vec3 vNormal; varying vec3 vPosition; void main(){ float rim=pow(1.-abs(dot(normalize(vNormal),normalize(-vPosition))),3.); gl_FragColor=vec4(.22,.51,.84,rim*.58); }',
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.FrontSide,
  })); earth.add(atmosphere); scene.add(earth);

  const batch = new Batch();
  // Utility pylons outside the inhabited basin, establishing the terrain's scale.
  for (let i = 0; i < 30; i++) {
    const x = -1600 - i * 85, z = -680 + i * 34, h = terrainHeight(x, z);
    batch.box(mat.dark, x, h + 9, z, 2, 18, 2); batch.box(mat.silver, x, h + 16, z, 16, 1, 2);
  }
  scene.add(batch.finish());
  return { earth, stars, dispose: () => { disposed = true; } };
}
