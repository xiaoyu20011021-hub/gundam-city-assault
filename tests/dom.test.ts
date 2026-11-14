import { describe, expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import { MECHA_DEFINITIONS } from '../src/content/mechas';
import { WEAPON_DEFINITIONS } from '../src/content/weapons';
import { Actor } from '../src/gameplay/actor';
import { stepEnemy } from '../src/gameplay/ai';
import { ProjectileSystem } from '../src/gameplay/projectiles';
import { Game } from '../src/gameplay/game';
import { blastHits } from '../src/gameplay/combat';
import { CITY_COLLIDERS, cityDefinition } from '../src/content/maps/city';
import { findPath, pointBlocked } from '../src/gameplay/navigation';

const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
const bazooka = WEAPON_DEFINITIONS['giant-bazooka'];
const makeActors = () => {
  const dom = new Actor('dom', MECHA_DEFINITIONS.dom, 'enemy');
  const player = new Actor('player', MECHA_DEFINITIONS.gundam, 'player');
  player.position.set(0, 0, -40);
  return { dom, player, dispose() { dom.dispose(); player.dispose(); } };
};

describe('SD Dom rig and movement', () => {
  it('keeps its feet level while gliding and switches between bazooka and heat saber', () => {
    const rig = MECHA_DEFINITIONS.dom.createRig();
    const pose = { time: 1.4, speed: 1, aiming: true, attack: 0, boosting: false, airborne: false, hurt: 0, charge: 0.6, recoil: 0.5 };
    rig.animate(pose);
    expect(rig.root.getObjectByName('cross-visor')).toBeDefined();
    expect(rig.root.getObjectByName('giant-bazooka')).toBeDefined();
    expect(rig.joints.leftLeg.rotation.x).toBe(0);
    expect(rig.joints.rightLeg.rotation.x).toBe(0);
    expect(rig.root.getObjectByName('hover-glow')!.visible).toBe(true);
    const before = rig.joints.torso.position.clone();
    for (let i = 0; i < 100; i++) rig.animate(pose);
    expect(rig.joints.torso.position.distanceTo(before)).toBe(0);
    rig.setWeapon('melee');
    expect(rig.root.getObjectByName('ranged-weapon')!.visible).toBe(false);
    expect(rig.root.getObjectByName('melee-weapon')!.visible).toBe(true);
    expect(rig.root.getObjectByName('stowed-heat-saber')!.visible).toBe(false);
    rig.setWeapon('ranged');
    expect(rig.root.getObjectByName('stowed-heat-saber')!.visible).toBe(true);
    rig.dispose();
  });
  it('owns and releases its resources independently across repeated spawns', () => {
    const first = MECHA_DEFINITIONS.dom.createRig(), second = MECHA_DEFINITIONS.dom.createRig();
    let released = 0;
    second.root.traverse(node => {
      if (node instanceof Mesh) node.geometry.addEventListener('dispose', () => released++);
    });
    first.dispose(); expect(released).toBe(0);
    second.dispose(); expect(released).toBeGreaterThan(0);
    const count = released; second.dispose(); expect(released).toBe(count);
  });
  it('fits connected city routes with its wider collision radius', () => {
    for (const spawn of cityDefinition.enemySpawns) {
      const path = findPath(spawn, cityDefinition.playerSpawn, CITY_COLLIDERS, cityDefinition.bounds, MECHA_DEFINITIONS.dom.radius);
      expect(path.at(-1)).toEqual(cityDefinition.playerSpawn);
      expect(path.every(point => !pointBlocked(point, CITY_COLLIDERS, MECHA_DEFINITIONS.dom.radius))).toBe(true);
    }
  });
});

describe('bazooka enemy behavior', () => {
  it('fires the configured three-round magazine and starts reload after the third rocket', () => {
    const actors = makeActors(), { dom, player } = actors;
    const emitted: string[] = [];
    const shots: Vector3[] = [];
    const game = Object.assign(Object.create(Game.prototype), {
      player, world: { colliders: [] }, effects: { burst() {} },
      projectiles: { fire(_owner: Actor, _origin: Vector3, direction: Vector3) { shots.push(direction.clone()); } },
      bus: { emit(_kind: string, event: { weapon: string }) { emitted.push(event.weapon); } },
    });
    dom.aiAimPoint.set(0, 1, -40); dom.updateVisual(0, true);
    for (let i = 0; i < 3; i++) {
      expect(dom.aiReload).toBe(0);
      dom.aiAimTime = bazooka.aimTime!;
      game.fireEnemy(dom);
      expect(dom.aiAimTime).toBe(0);
      expect(dom.aiFireTimer).toBe(bazooka.cooldown);
    }
    expect(shots).toHaveLength(3);
    expect(shots.every(direction => direction.z < -0.9 && direction.y < 0)).toBe(true);
    expect(emitted).toEqual(['giant-bazooka', 'giant-bazooka', 'giant-bazooka']);
    expect(dom.aiReload).toBe(bazooka.reloadTime);
    expect(stepEnemy(dom, player, 1 / 60, 1, [], bounds).fire).toBe(false);
    actors.dispose();
  });
  it.each([30, 120])('telegraphs before firing and keeps the original dodgeable aim point at %s Hz', hz => {
    const actors = makeActors(), { dom, player } = actors;
    let firedAt = 0;
    for (let frame = 0; frame < hz * 2; frame++) {
      if (frame === 2) player.position.x = 12;
      const action = stepEnemy(dom, player, 1 / hz, frame / hz, [], bounds);
      if (action.fire) { firedAt = (frame + 1) / hz; break; }
    }
    expect(firedAt).toBeGreaterThanOrEqual(bazooka.aimTime! - 1e-6);
    expect(firedAt).toBeLessThan(bazooka.aimTime! + 1 / hz + 1e-6);
    expect(dom.aiAimPoint.x).toBe(0);
    expect(dom.position.length()).toBe(0);
    expect(dom.aiAmmo).toBe(3);
    actors.dispose();
  });
  it('cancels aim behind cover, respects reload, and uses its saber at close range', () => {
    const actors = makeActors(), { dom, player } = actors;
    stepEnemy(dom, player, 0.3, 0, [], bounds);
    expect(dom.aiAimTime).toBeGreaterThan(0);
    const wall = [{ minX: -20, maxX: 20, minZ: -21, maxZ: -19, height: 20 }];
    expect(stepEnemy(dom, player, 0.3, 0.3, wall, bounds).fire).toBe(false);
    expect(dom.aiAimTime).toBe(0);
    dom.aiReload = 2;
    expect(stepEnemy(dom, player, 1, 1, [], bounds).fire).toBe(false);
    expect(dom.aiAimTime).toBe(0);
    dom.aiReload = 0; player.position.copy(dom.position).add(new Vector3(0, 0, -5));
    const action = stepEnemy(dom, player, 1 / 60, 2, [], bounds);
    expect(action.slash).toBe(true); expect(action.fire).toBe(false);
    expect(dom.slot).toBe('melee');
    actors.dispose();
  });
});

describe('rocket collision and splash', () => {
  it('applies one direct hit, splash falloff, and no friendly damage', () => {
    const actors = makeActors(), { dom, player } = actors;
    player.position.set(0, 0, -10);
    const nearby = new Actor('nearby', MECHA_DEFINITIONS.gundam, 'player'); nearby.position.set(4, 0, -10);
    const friend = new Actor('friend', MECHA_DEFINITIONS.zaku, 'enemy'); friend.position.set(2, 0, -10);
    const shots = new ProjectileSystem(), hits: { id: string; damage: number }[] = [];
    let explosions = 0;
    shots.fire(dom, new Vector3(0, 2, 0), new Vector3(0, 0, -1), bazooka);
    shots.update(0.5, [dom, player, nearby, friend], [], (_p, damage, target, blast) => {
      if (blast) explosions++;
      if (target) hits.push({ id: target.id, damage });
    });
    expect(explosions).toBe(1);
    expect(hits.filter(h => h.id === player.id)).toEqual([{ id: player.id, damage: bazooka.damage }]);
    expect(hits.find(h => h.id === nearby.id)!.damage).toBeLessThan(bazooka.damage);
    expect(hits.find(h => h.id === friend.id)).toBeUndefined();
    expect(shots.activeCount).toBe(0);
    shots.dispose(); nearby.dispose(); friend.dispose(); actors.dispose();
  });
  it('explodes against a wall without damaging actors on the far side', () => {
    const actors = makeActors(), { dom, player } = actors; player.position.set(0, 0, -12);
    const shots = new ProjectileSystem(); let explosions = 0, damage = 0;
    shots.fire(dom, new Vector3(0, 2, 0), new Vector3(0, 0, -1), bazooka);
    shots.update(0.5, [dom, player], [{ minX: -8, maxX: 8, minZ: -10, maxZ: -8, height: 10 }], (_p, amount, target, blast) => {
      if (blast) explosions++; if (target) damage += amount;
    });
    expect(explosions).toBe(1); expect(damage).toBe(0);
    shots.dispose(); actors.dispose();
  });
  it('detonates on the ground and reset clears flying rockets', () => {
    const actors = makeActors(), shots = new ProjectileSystem(); let height = -1;
    shots.fire(actors.dom, new Vector3(0, 3, 0), new Vector3(0, -1, -1), bazooka);
    shots.update(0.5, [], [], (p, _damage, _target, blast) => { if (blast) height = p.y; });
    expect(height).toBeGreaterThanOrEqual(0); expect(height).toBeLessThan(0.1);
    expect(shots.activeCount).toBe(0);
    shots.fire(actors.dom, new Vector3(0, 3, 0), new Vector3(0, 0, -1), bazooka);
    expect(shots.activeCount).toBe(1); shots.clear(); expect(shots.activeCount).toBe(0);
    shots.dispose(); actors.dispose();
  });
  it('does not apply splash beyond its radius or to a high airborne target', () => {
    const body = { id: 'target', x: 0, y: 0, z: 9, radius: 1, height: 6 };
    expect(blastHits({ x: 0, y: 0, z: 0 }, 7, 65, [body], [])).toEqual([]);
    expect(blastHits({ x: 0, y: 0, z: 0 }, 7, 65, [{ ...body, z: 0, y: 9 }], [])).toEqual([]);
  });
});
