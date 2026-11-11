import { expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Scene } from 'three';
import { Game } from '../src/gameplay/game';
import { cityDefinition } from '../src/content/maps/city';
import type { MapDefinition, MapWorld } from '../src/content/maps/types';

const world = (): MapWorld => ({ root: new Group(), colliders: [], dispose: vi.fn() });
function deferred() { let resolve!: (world: MapWorld) => void; const promise = new Promise<MapWorld>(r => { resolve = r; }); return { promise, resolve }; }
function subject() {
  const old = world(), scene = new Scene(); scene.add(old.root);
  const game = Object.assign(Object.create(Game.prototype), {
    graphics: { scene, camera: new PerspectiveCamera(), setEnvironment: vi.fn() },
    audio: { load: async () => {}, stop: vi.fn() }, input: { clear: vi.fn(), unlock: vi.fn() },
    world: old, map: cityDefinition, mode: 'menu', ui: { loading: vi.fn() }, frameHandle: 1, loadGeneration: 0, disposed: false,
    clearActors: vi.fn(), show(screen: string) { this.mode = screen; }, showMenu() { this.mode = 'menu'; },
  });
  return { game, old, scene };
}
const definition = (id: string, createWorld: MapDefinition['createWorld']): MapDefinition => ({ ...cityDefinition, id, createWorld });

it('commits the selected map and releases the old world only after loading succeeds', async () => {
  const { game, old, scene } = subject(), pending = deferred(), fresh = world();
  const target = definition('selene', () => pending.promise);
  const loading = game.load(target);
  expect(game.map).toBe(cityDefinition); expect(old.dispose).not.toHaveBeenCalled();
  pending.resolve(fresh); await loading;
  expect(game.map).toBe(target); expect(game.world).toBe(fresh); expect(game.mode).toBe('menu');
  expect(old.dispose).toHaveBeenCalledTimes(1); expect(scene.children).toEqual([fresh.root]);
});
it('keeps only the latest selection and disposes stale results', async () => {
  const { game } = subject(), slow = deferred(), stale = world(), latest = world();
  const first = game.load(definition('slow', () => slow.promise));
  const target = definition('latest', async () => latest); await game.load(target);
  slow.resolve(stale); await first;
  expect(game.map).toBe(target); expect(game.world).toBe(latest);
  expect(stale.dispose).toHaveBeenCalledTimes(1); expect(latest.dispose).not.toHaveBeenCalled();
});
it('retains the usable map after failure and retries the failed selection', async () => {
  const { game, old } = subject(), fresh = world(); let attempts = 0;
  const target = definition('retry', async () => { if (++attempts === 1) throw new Error('scene failed'); return fresh; });
  await game.load(target);
  expect(game.mode).toBe('error'); expect(game.map).toBe(cityDefinition); expect(game.world === old).toBe(true);
  expect(old.dispose).not.toHaveBeenCalled();
  await game.action('retry');
  expect(attempts).toBe(2); expect(game.map).toBe(target); expect(game.mode).toBe('menu');
});
it('can return to the usable old map and discards a pending load after leaving', async () => {
  const { game, old } = subject(), pending = deferred(), unused = world();
  const loading = game.load(definition('cancelled', () => pending.promise));
  await game.action('back-map'); pending.resolve(unused); await loading;
  expect(game.map).toBe(cityDefinition); expect(game.world === old).toBe(true); expect(game.mode).toBe('menu');
  expect(unused.dispose).toHaveBeenCalledTimes(1); expect(old.dispose).not.toHaveBeenCalled();
});
it('disposes results completed after the game has been destroyed', async () => {
  const { game } = subject(), pending = deferred(), unused = world();
  const loading = game.load(definition('disposed', () => pending.promise)); game.disposed = true;
  pending.resolve(unused); await loading;
  expect(unused.dispose).toHaveBeenCalledTimes(1);
});
