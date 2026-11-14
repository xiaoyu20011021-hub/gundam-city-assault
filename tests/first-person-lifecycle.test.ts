import { expect, it } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { Game } from '../src/gameplay/game';
import { ThirdPersonCamera } from '../src/gameplay/camera';
import { GameRenderer } from '../src/core/renderer';
import { Mission } from '../src/gameplay/mission';

function subject() {
  const graphics = { scene: new Scene(), camera: new PerspectiveCamera() };
  const input = { locked: true, lock: async () => {}, clear: () => {}, unlock: () => {},
    takeKey: () => false, keys: new Set<string>(), firing: false, aiming: false };
  return Object.assign(Object.create(Game.prototype), {
    graphics, input, mode: 'menu', camera: new ThirdPersonCamera(graphics.camera),
    world: { colliders: [] }, selectedPlayer: 'gundam', selectedBattleMode: 'campaign',
    selectedSortieMode: 'standard', selectedAiMode: 'classic',
    map: { playerSpawn: { x: 0, z: 0 }, bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, waves: [{ title: 'Test', enemies: ['zaku'] }] },
    mission: new Mission([{ title: 'Test', enemies: ['zaku'] }]),
    ui: { setPilot: () => {}, clear: () => {} }, audio: { unlock: async () => {}, stop: () => {} },
    bus: { emit: () => {} }, effects: { clear: () => {}, update: () => {} },
    projectiles: { clear: () => {}, update: () => {} }, enemies: [], exhibit: [],
    spawnWave: () => {}, show(screen: string) { this.mode = screen; },
    stepSoundTime: 1, boostSoundTime: 1,
  });
}

it('toggles during real simulation, preserves combat state, retains on resume and resets on restart', async () => {
  const game = subject(); await game.start();
  expect(game.camera.viewMode).toBe('third-person');
  game.camera.yaw = 0.7; game.camera.pitch = -0.4;
  game.player.setWeapon('alternate-ranged'); game.player.activeRangedState.fire();
  const ammo = game.player.activeRangedState.ammo;
  game.input.takeKey = (code: string) => code === 'KeyT';
  game.simulation(1 / 60);
  expect(game.camera.viewMode).toBe('first-person');
  expect(game.camera.yaw).toBe(0.7); expect(game.camera.pitch).toBe(-0.4);
  expect(game.player.activeRangedState.ammo).toBe(ammo);
  expect(game.graphics.camera.position.y).toBeCloseTo(game.player.definition.height * 0.82);
  game.pause(); await game.resume(); expect(game.camera.viewMode).toBe('first-person');
  const oldView = game.firstPersonWeapon;
  await game.start();
  expect(game.camera.viewMode).toBe('third-person');
  expect(oldView.scene.children).toHaveLength(0);
  game.clearActors(); expect(game.firstPersonWeapon).toBeUndefined();
});

it('renders the world without the local body and restores it even if rendering fails', () => {
  const body = new Scene(), scene = new Scene(), camera = new PerspectiveCamera();
  const visibility: boolean[] = [], overlay = { scene: new Scene(), camera: new PerspectiveCamera() };
  const renderer = { autoClear: true, info: { autoReset: true, reset: () => {} },
    clearDepth: () => {}, render: () => { visibility.push(body.visible); } };
  const graphics = Object.assign(Object.create(GameRenderer.prototype), { scene, camera, renderer });
  graphics.render(overlay, body);
  expect(visibility).toEqual([false, true]); expect(body.visible).toBe(true); expect(renderer.autoClear).toBe(true);
  renderer.render = () => { throw new Error('render failure'); };
  expect(() => graphics.render(overlay, body)).toThrow('render failure');
  expect(body.visible).toBe(true); expect(renderer.autoClear).toBe(true);
});

it('hides the local body in first-person results while only drawing weapons during play and pause', async () => {
  const game = subject(); await game.start();
  const calls: unknown[][] = [];
  game.graphics.render = (...args: unknown[]) => calls.push(args);
  game.camera.viewMode = 'first-person';
  for (const screen of ['playing', 'paused', 'victory', 'defeat']) {
    game.mode = screen; game.render();
    expect(calls.at(-1)![1]).toBe(game.player.rig.root);
    expect(calls.at(-1)![0]).toBe(screen === 'playing' || screen === 'paused' ? game.firstPersonWeapon : undefined);
  }
  game.camera.viewMode = 'third-person'; game.render();
  expect(calls.at(-1)).toEqual([undefined, undefined]);
  game.clearActors();
});

it('synchronizes a paused overlay projection on resize without advancing its pose', () => {
  const scene = new Scene(), camera = new PerspectiveCamera(50, 2);
  const overlay = { scene: new Scene(), camera: new PerspectiveCamera(72, 1) };
  const renderer = { autoClear: true, info: { autoReset: true, reset: () => {} }, clearDepth: () => {}, render: () => {} };
  const graphics = Object.assign(Object.create(GameRenderer.prototype), { scene, camera, renderer });
  const oldPose = overlay.scene.matrix.clone(); graphics.render(overlay);
  expect(overlay.camera.aspect).toBe(2); expect(overlay.camera.fov).toBe(50);
  expect(overlay.scene.matrix.equals(oldPose)).toBe(true);
});

it('uses actual firePlayer state for first-person projectiles and refuses shots on cooldown', async () => {
  const game = subject(); await game.start();
  game.camera.viewMode = 'first-person';
  game.camera.update(game.player.position, false, [], 1 / 60, true);
  game.firstPersonWeapon.update(game.player, game.graphics.camera, 0, 0, false);
  game.input.firing = true;
  const shots: Vector3[] = [];
  game.projectiles.fire = (_owner: unknown, origin: Vector3) => shots.push(origin.clone());
  game.effects.burst = () => {};
  game.firePlayer(); game.firePlayer();
  expect(shots).toHaveLength(1); expect(game.player.rifle.heat).toBeGreaterThan(0);
  expect(shots[0].distanceTo(game.firstPersonWeapon.muzzleWorld(game.graphics.camera))).toBeLessThan(0.001);
  game.firstPersonWeapon.update(game.player, game.graphics.camera, 0, 0, false);
  expect(game.firstPersonWeapon.scene.getObjectByName('first-person-muzzle-flash')!.visible).toBe(true);
  game.clearActors();
});
