import { expect, it } from 'vitest';
import { PerspectiveCamera, Scene } from 'three';
import { Game } from '../src/gameplay/game';
import { ThirdPersonCamera } from '../src/gameplay/camera';
import { Mission } from '../src/gameplay/mission';
import { ProjectileSystem } from '../src/gameplay/projectiles';
import { Effects } from '../src/gameplay/effects';
import { Actor } from '../src/gameplay/actor';
import { getMechaDefinition } from '../src/content/mechas';

function subject() {
  const graphics = { scene: new Scene(), camera: new PerspectiveCamera() };
  return Object.assign(Object.create(Game.prototype), {
    graphics, input: { locked: true, lock: async () => {}, clear: () => {}, unlock: () => {}, takeKey: () => false,
      keys: new Set<string>(), firing: false, aiming: false }, mode: 'menu', camera: new ThirdPersonCamera(graphics.camera),
    world: { colliders: [] }, selectedPlayer: 'nu-gundam', selectedBattleMode: 'campaign', selectedSortieMode: 'unlimited', selectedAiMode: 'classic',
    map: { playerSpawn: { x: 0, z: 0 }, bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, waves: [{ title: 'Test', enemies: ['zaku'] }] },
    mission: new Mission([{ title: 'Test', enemies: ['zaku'] }]),
    ui: { setPilot: () => {}, clear: () => {}, remoteNotice: () => {} }, audio: { unlock: async () => {}, stop: () => {}, play: () => {} },
    bus: { emit: () => {} }, effects: new Effects(), projectiles: new ProjectileSystem(), enemies: [] as Actor[], exhibit: [] as Actor[],
    spawnWave() {
      this.mission.waveChanged = false;
      const enemy = new Actor('enemy', getMechaDefinition('zaku'), 'enemy'); enemy.position.z = -40;
      this.enemies.push(enemy); this.graphics.scene.add(enemy.rig.root); enemy.updateVisual(0, false);
    }, show(screen: string) { this.mode = screen; }, stepSoundTime: 10, boostSoundTime: 10,
  });
}

it('preserves destroyed funnels through pause, camera toggles and wave spawn; new sortie restores them', async () => {
  const game = subject(); await game.start();
  expect(game.remoteWeapons.snapshot()).toHaveLength(6);
  for (let i = 0; i < 70; i++) game.simulation(1 / 60);
  const id = game.remoteWeapons.snapshot()[0].id;
  game.remoteWeapons.applyDamage(id, 999);
  game.pause(); await game.resume(); game.camera.viewMode = 'first-person'; game.simulation(1 / 60);
  game.spawnWave();
  expect(game.remoteWeapons.snapshot().find((unit: { id: string }) => unit.id === id).state).toBe('destroyed');
  expect(game.mission.kills).toBe(0);
  const oldRuntime = game.remoteWeapons;
  await game.start();
  expect(oldRuntime.root.children).toHaveLength(0);
  expect(game.remoteWeapons.snapshot().every((unit: { health: number }) => unit.health === 48)).toBe(true);
  expect(game.player.definition.id).toBe('nu-gundam');
  game.clearActors(); expect(game.remoteWeapons).toBeUndefined();
  game.projectiles.dispose(); game.effects.dispose();
});
