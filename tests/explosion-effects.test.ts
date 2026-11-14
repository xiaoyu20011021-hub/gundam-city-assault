import { expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import { Effects } from '../src/gameplay/effects';

it('expands and fades blast layers, bounds repeated explosions, and clears them on restart', () => {
  const effects = new Effects();
  const capacity = effects.root.children.length;
  effects.explosion(new Vector3(5, 2, 7), 7);
  const blast = effects.root.getObjectByName('rocket-explosion')!;
  const [core, fire, ring] = blast.children as Mesh[];
  expect(blast.visible).toBe(true); expect(blast.position.toArray()).toEqual([5, 2, 7]);
  const radius = ring.scale.x;
  effects.update(.3);
  expect(ring.scale.x).toBeGreaterThan(radius);
  expect((core.material as { opacity: number }).opacity).toBe(0);
  expect((fire.material as { opacity: number }).opacity).toBeGreaterThan(0);
  effects.update(.6); expect(blast.visible).toBe(false);
  for (let i = 0; i < 100; i++) effects.explosion(new Vector3(), 7);
  expect(effects.root.children).toHaveLength(capacity);
  effects.clear(); expect(effects.root.children.filter(node => node.name === 'rocket-explosion').every(node => !node.visible)).toBe(true);
  let released = 0;
  core.geometry.addEventListener('dispose', () => released++);
  ring.geometry.addEventListener('dispose', () => released++);
  effects.dispose(); expect(released).toBe(2);
});
