import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Game } from '../src/gameplay/game';
import { Actor } from '../src/gameplay/actor';
import { Mission } from '../src/gameplay/mission';
import { ThirdPersonCamera } from '../src/gameplay/camera';
import { ProjectileSystem } from '../src/gameplay/projectiles';
import { RemoteWeaponRuntime } from '../src/gameplay/remote-weapons/adapter';
import { getMechaDefinition } from '../src/content/mechas';
import { WEAPON_DEFINITIONS } from '../src/content/weapons';
import { CITY_COLLIDERS, cityDefinition } from '../src/content/maps/city';
import { firstSegmentHit } from '../src/gameplay/combat';

function subject(player: Actor, enemies: Actor[] = []) {
  const graphics = { camera: new PerspectiveCamera() };
  const mission = new Mission([{ title: 'Last enemy', enemies: ['zaku'] }]); mission.start(); mission.waveChanged = false;
  return Object.assign(Object.create(Game.prototype), {
    player, enemies, graphics, camera: new ThirdPersonCamera(graphics.camera), mission, mode: 'playing',
    world: { colliders: [] }, map: cityDefinition, simulationTime: 0, selectedAiMode: 'classic',
    selectedBattleMode: 'duel', selectedSortieMode: 'standard', best: 0,
    input: { firing: false, aiming: false, keys: new Set(), takeKey: () => false, unlock() {}, clear() {} },
    projectiles: new ProjectileSystem(), effects: { burst() {}, update() {}, trail() {} },
    bus: { emit() {} }, audio: { play() {} }, stepSoundTime: 10, boostSoundTime: 10,
    result: undefined as unknown,
    show(screen: string, data: unknown) { this.mode = screen; this.result = data; },
  });
}

it.each([false, true])('resolves same-step mutual kills as defeat with one kill (enemy bullet first: %s)', reverse => {
  const player = new Actor('player', getMechaDefinition('gundam'), 'player');
  const enemy = new Actor('enemy', getMechaDefinition('zaku'), 'enemy');
  enemy.position.z = -10; player.health = enemy.health = 1; enemy.aiFireTimer = 100;
  const game = subject(player, [enemy]);
  try {
    const playerShot = () => game.projectiles.fire(player, new Vector3(0, 3, -8), new Vector3(0, 0, -1), WEAPON_DEFINITIONS['beam-rifle']);
    const enemyShot = () => game.projectiles.fire(enemy, new Vector3(0, 3, -2), new Vector3(0, 0, 1), WEAPON_DEFINITIONS['zaku-machinegun']);
    if (reverse) { enemyShot(); playerShot(); } else { playerShot(); enemyShot(); }
    game.simulation(1 / 60);
    expect(player.dead).toBe(true); expect(enemy.dead).toBe(true);
    expect(game.mode).toBe('defeat'); expect(game.mission.kills).toBe(1); expect(game.result.score).toBe(100);
  } finally { player.dispose(); enemy.dispose(); game.projectiles.dispose(); }
});

it.each(['gundam', 'gm', 'nu-gundam'])('keeps %s third-person shots outside a wall beside the player', id => {
  const player = new Actor('player', getMechaDefinition(id), 'player'), wall = CITY_COLLIDERS[0];
  player.position.set(wall.minX - player.definition.radius - .01, 0, (wall.minZ + wall.maxZ) / 2);
  const game = subject(player); game.world.colliders = CITY_COLLIDERS; game.input.firing = true;
  try {
    for (const slot of player.alternateRangedState ? ['ranged', 'alternate-ranged'] as const : ['ranged'] as const) {
      player.setWeapon(slot); player.updateVisual(0, false);
      game.camera.pitch = 0; game.camera.update(player.position, false, CITY_COLLIDERS, 1/60, true);
      const far = game.graphics.camera.position.clone().addScaledVector(game.graphics.camera.getWorldDirection(new Vector3()), 40);
      expect(firstSegmentHit(game.graphics.camera.position, far, CITY_COLLIDERS, [])).toBeNull();
      game.firePlayer();
      const shot = game.projectiles.snapshot()[0]; expect(shot).toBeDefined();
      expect(firstSegmentHit(shot.position, shot.position, CITY_COLLIDERS, [])).toBeNull();
      game.projectiles.update(1/60, [player], CITY_COLLIDERS, () => {});
      expect(game.projectiles.activeCount).toBe(1); game.projectiles.clear();
    }
  } finally { player.dispose(); game.projectiles.dispose(); }
});

it('does not use a clipped muzzle to fire through a wall in front of the player', () => {
  const player = new Actor('player', getMechaDefinition('gundam'), 'player'); player.updateVisual(0, false);
  const game = subject(player), walls = [{ minX: -10, maxX: 10, minZ: -1.5, maxZ: -1.3, height: 10 }];
  game.world.colliders = walls; game.input.firing = true; game.camera.pitch = 0;
  game.camera.update(player.position, false, walls, 1/60, true);
  try {
    game.firePlayer(); const shot = game.projectiles.snapshot()[0];
    expect(shot.position.z).toBeGreaterThan(-1.3);
    const impacts: Vector3[] = [];
    game.projectiles.update(.1, [player], walls, (p: Vector3) => impacts.push(p));
    expect(impacts).toHaveLength(1); expect(impacts[0].z).toBeCloseTo(-1.3);
  } finally { player.dispose(); game.projectiles.dispose(); }
});

it.each([96, 100])('launches, fires and docks all funnels at mother ship altitude %s', altitude => {
  const player = new Actor('player', getMechaDefinition('nu-gundam'), 'player');
  const enemy = new Actor('enemy', getMechaDefinition('zaku'), 'enemy');
  player.position.y = altitude; enemy.position.set(0, 92, -25);
  player.updateVisual(0, false); enemy.updateVisual(0, false);
  const shots = new ProjectileSystem(), remote = new RemoteWeaponRuntime(shots); remote.attach(player);
  try {
    const fired = new Set<string>();
    for (let frame = 0; frame < 600; frame++) {
      remote.step(1/60, [player, enemy], [], cityDefinition.bounds);
      for (const e of remote.drainEvents()) if (e.type === 'shot') fired.add(e.unitId);
      shots.clear();
    }
    expect(fired.size).toBe(6);
    enemy.dead = true;
    for (let frame = 0; frame < 900; frame++) remote.step(1/60, [player, enemy], [], cityDefinition.bounds);
    expect(remote.snapshot().every(u => u.state === 'docked' && !u.blocked)).toBe(true);
  } finally { remote.dispose(); shots.dispose(); player.dispose(); enemy.dispose(); }
});
