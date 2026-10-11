import { expect, it } from 'vitest';
import { Group, Scene } from 'three';
import { Game } from '../src/gameplay/game';
import type { MapWorld } from '../src/content/maps/types';

it('releases a late map result and does not revive a disposed game', async () => {
  let resolveMap!: (world: MapWorld) => void, disposals = 0, menus = 0;
  const pending = new Promise<MapWorld>(resolve => { resolveMap = resolve; });
  // Exercise the real async lifecycle method without a browser/WebGL constructor.
  const subject = Object.assign(Object.create(Game.prototype), {
    disposed: false, loadGeneration: 0, frameHandle: 1,
    map: { createWorld: () => pending }, audio: { load: async () => {} },
    ui: { loading: () => {} }, graphics: { scene: new Scene() },
    show: () => {}, showMenu: () => { menus++; },
  });
  const loading = subject.load(); subject.disposed = true;
  const root = new Group(); resolveMap({ root, colliders: [], dispose: () => { disposals++; } });
  await loading;
  expect(disposals).toBe(1); expect(menus).toBe(0);
  expect(subject.graphics.scene.children).toHaveLength(0);
});
it('resumes play even if the audio device never finishes unlocking', async () => {
  const subject = Object.assign(Object.create(Game.prototype), {
    player: {}, world: {}, mode: 'paused', accumulator: 1,
    audio: { unlock: () => new Promise<void>(() => {}) },
    input: { locked: true, lock: async () => {} },
    show(screen: string) { this.mode = screen; },
  });
  const result = await Promise.race([
    subject.resume().then(() => 'resumed'),
    new Promise<string>(resolve => setTimeout(() => resolve('blocked'), 30)),
  ]);
  expect(result).toBe('resumed'); expect(subject.mode).toBe('playing');
});
