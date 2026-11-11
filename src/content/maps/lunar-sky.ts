import { BufferGeometry, DataTexture, Float32BufferAttribute, LinearFilter, Mesh, MeshBasicMaterial, Points, PointsMaterial, RGBAFormat, SphereGeometry, SRGBColorSpace } from 'three';
import { LunarKit, seededRandom } from './lunar-kit';

/** Stylised, seamless globe texture. No network, canvas, or external image dependency. */
function earthTexture(): DataTexture {
  const width = 512, height = 256;
  const data = new Uint8Array(width * height * 4);
  const continents = [[0.22, 0.28, 0.12, 0.16], [0.32, 0.63, 0.065, 0.23],
    [0.53, 0.48, 0.085, 0.20], [0.64, 0.25, 0.20, 0.12], [0.82, 0.72, 0.065, 0.075]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const lon = u * Math.PI * 2;
    const lat = v * Math.PI;
    const wobble = Math.sin(lon * 19 + Math.sin(lat * 13)) * 0.012 + Math.sin(lon * 37 - lat * 29) * 0.006;
    const land = continents.some(([cx, cy, rx, ry]) => ((u + wobble - cx) / rx) ** 2 + ((v + wobble - cy) / ry) ** 2 < 1);
    const cloudNoise = Math.sin(lon * 9 + Math.sin(lat * 11) * 2) + Math.sin(lon * 17 - lat * 19) * 0.5 + Math.sin(lon * 37 + lat * 31) * 0.22;
    const cloud = Math.max(0, Math.min(0.9, (cloudNoise - 0.3) * 0.85));
    const ice = Math.abs(v - 0.5) > 0.43;
    const base = ice ? [207, 225, 234] : land ? [81, 116, 110] : [18, 65, 124];
    const light = Math.max(0.12, Math.min(1, (Math.cos(lon - 3.8) * Math.sin(lat) * 0.75 + Math.cos(lat) * 0.4) * 1.2 + 0.25));
    const offset = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) data[offset + c] = (base[c] * (1 - cloud) + 235 * cloud) * light;
    data[offset + 3] = 255;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function addLunarSky(kit: LunarKit): void {
  const texture = kit.track(earthTexture());
  const earth = new Mesh(kit.track(new SphereGeometry(42, 64, 40)),
    kit.track(new MeshBasicMaterial({ map: texture, toneMapped: false })));
  earth.name = 'earth';
  earth.position.set(35, 88, -420);
  earth.rotation.set(0.12, 1.7, -0.25);
  kit.root.add(earth);
  const random = seededRandom(19690720);
  // Screen-space sizes keep the sky legible from the ground and in low-quality mode.
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = (x - 15.5) / 15.5, dy = (y - 15.5) / 15.5;
    const core = Math.exp(-(dx * dx + dy * dy) * 10);
    const rays = Math.exp(-Math.min(dx * dx, dy * dy) * 220) * Math.max(0, 1 - Math.hypot(dx, dy)) * 0.35;
    const offset = (y * 32 + x) * 4;
    pixels.set([255, 255, 255, Math.min(255, (core + rays) * 255)], offset);
  }
  const sprite = kit.track(new DataTexture(pixels, 32, 32, RGBAFormat));
  sprite.magFilter = sprite.minFilter = LinearFilter;
  sprite.needsUpdate = true;
  for (const [count, size, brightness] of [[2200, 2, 0.65], [550, 3.5, 0.9], [90, 6, 1]]) {
    const positions: number[] = [], colors: number[] = [];
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const y = 0.015 + random() * 0.985;
      const radial = Math.sqrt(1 - y * y);
      positions.push(Math.cos(angle) * radial * 950, y * 950, Math.sin(angle) * radial * 950);
      const warm = random() > 0.8;
      colors.push(brightness * (warm ? 1 : 0.8), brightness * 0.9, brightness * (warm ? 0.8 : 1));
    }
    const geometry = kit.track(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const material = kit.track(new PointsMaterial({ size, sizeAttenuation: false, vertexColors: true,
      map: sprite, transparent: true, depthWrite: false, toneMapped: false }));
    const stars = new Points(geometry, material);
    stars.name = `lunar-starfield-${size}`;
    kit.root.add(stars);
  }
}
