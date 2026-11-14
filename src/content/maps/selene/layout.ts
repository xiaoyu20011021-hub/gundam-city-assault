import { Vector3 } from 'three';
export const SELENE_SCALE = 1 / 3;

export function random(seed = 87) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export interface CityBlock { x: number; z: number; width: number; depth: number; height: number; style: number }

export function generateBlocks(seed: number): CityBlock[] {
  const rng = random(seed), blocks: CityBlock[] = [];
  for (let ix = -7; ix <= 7; ix++) for (let iz = -7; iz <= 7; iz++) {
    const x = ix * 69 + 35, z = iz * 69 + 35, radius = Math.hypot(x, z);
    if (radius > 570 || Math.abs(x) < 27 || Math.abs(z) < 27) continue;
    if (Math.hypot(x + 90, z + 95) < 95 || Math.hypot(x - 130, z - 85) < 80) continue;
    const width = 28 + rng() * 23, depth = 26 + rng() * 24;
    // Central battle streets need clearance for SD bodies and the navigation grid.
    const combat = Math.abs(x) < 480 && Math.abs(z) < 480;
    blocks.push({ x, z, width: combat ? Math.min(width, 34) : width, depth: combat ? Math.min(depth, 34) : depth,
      height: 30 + Math.pow(1 - radius / 690, 1.25) * (55 + rng() * 170), style: Math.floor(rng() * 4) });
  }
  return blocks;
}

const craters = [ [-1950, 1450, 400], [2050, 850, 290], [-2200, -1700, 520], [1000, -2900, 490], [3300, -400, 650], [-700, 2650, 480] ];
export function terrainHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r < 970) return -8;
  const a = Math.atan2(z, x);
  const rim = 180 * Math.exp(-Math.pow((r - 1230) / 210, 2));
  const rough = (Math.sin(x * .009 + Math.cos(z * .005)) * 9 + Math.sin(z * .017 + x * .006) * 5 + Math.cos(x * .035 - z * .022) * 3);
  let h = -8 + rim * (0.83 + Math.sin(a * 9) * .09 + Math.cos(a * 17) * .08) + rough * Math.min(1, (r - 970) / 180);
  for (const [cx, cz, cr] of craters) {
    const d = Math.hypot(x - cx, z - cz) / cr;
    h += 60 * Math.exp(-Math.pow((d - 1) * 5, 2)) - 50 * Math.exp(-Math.pow(d * 1.45, 4));
  }
  const along = (x - 600) * Math.sin(.57) - (z + 700) * Math.cos(.57);
  const across = Math.abs((x - 600) * Math.cos(.57) + (z + 700) * Math.sin(.57));
  if (along > 0 && along < 1600 && across < 95) {
    const blend = 1 - Math.min(1, Math.max(0, (across - 52) / 43));
    h = h * (1 - blend) + Math.min(h, 7 + along * .0486) * blend;
  }
  return h - Math.pow(Math.max(0, r - 4000) / 2200, 2) * 1100;
}
export const wrapProgress = (p: number) => ((p % 1) + 1) % 1;
export const TRAIN_DIRECTIONS: readonly number[] = [1, 1, 1];
export const safeDelta = (dt: number) => Math.max(0, Math.min(.05, dt));
export const trainPosition = (t: number) => new Vector3(Math.cos(t * Math.PI * 2) * 631, 28, Math.sin(t * Math.PI * 2) * 631);

export const destinations = [
  { name: '城市全景', en: 'CITY OVERVIEW', position: [1460, 980, 1550], target: [0, 125, -50], description: '月面都市 · 冯·布朗', title: 'VON BRAUN', number: '01' },
  { name: '中央城区', en: 'CENTRAL DISTRICT', position: [610, 480, 690], target: [-60, 125, -60], description: '中央行政区 · 阿纳海姆总部', title: 'THE CITADEL', number: '02' },
  { name: '工业制造区', en: 'INDUSTRIAL SECTOR', position: [-1040, 400, 880], target: [-690, 35, 50], description: '工业制造区 · 第七工厂', title: 'FOUNDRY 07', number: '03' },
  { name: '宇宙港', en: 'ORBITAL SPACEPORT', position: [1150, 280, 580], target: [800, 65, 70], description: '轨道交通港 · 第三泊位', title: 'PORT SELENE', number: '04' },
  { name: '机动战士基地', en: 'MOBILE SUIT HANGAR', position: [175, 64, 908], target: [130, 15, 736], description: '机动战士基地 · 维护机库', title: 'HANGAR 04', number: '05' },
  { name: '质量投射器', en: 'MASS DRIVER', position: [830, 260, -510], target: [1700, 120, -2420], description: '月面发射系统 · 电磁质量投射器', title: 'BEYOND LUNA', number: '06' },
] as const;
