/** Menu metadata has no renderer dependency. */
export const PLAYABLE_MECHAS = {
  gundam: { name: 'RX-78-2 高达', code: 'RX-78-2', english: 'GUNDAM', role: '原型机', weapons: '光束步枪 · 120mm 机枪 · 光束军刀' },
  gm: { name: 'RGM-79 吉姆', code: 'RGM-79', english: 'GM', role: '量产机', weapons: '光束喷枪 · 120mm 机枪 · 光束军刀' },
  'nu-gundam': { name: 'RX-93 牛高达', code: 'RX-93', english: 'ν GUNDAM', role: '精神感应机', weapons: '光束步枪 · 光束军刀 · 六枚浮游炮' },
} as const;
export type PlayableMechaId = keyof typeof PLAYABLE_MECHAS;
export function isPlayableMecha(id: unknown): id is PlayableMechaId {
  return typeof id === 'string' && Object.hasOwn(PLAYABLE_MECHAS, id);
}
