import { DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { GeometryResources, group, mergeArmor, part } from '../content/mechas/geometry';
import { createGundamWeapons, type WeaponModels } from '../content/weapons/models';
import type { Actor } from './actor';
import type { RectCollider } from '../content/maps/types';
import { firstSegmentHit, type HitBody } from './combat';
import type { MechaDefinition } from '../content/mechas/types';

/** A display-only rig: combat state always belongs to the real actor. */
export class FirstPersonWeapon {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(72, 1, 0.02, 20);
  private readonly resources = new GeometryResources();
  private readonly root = new Group();
  private readonly weapons: WeaponModels;
  private recoil = 0;
  private flashTime = 0;
  private readonly flash: Group;
  private disposed = false;
  private alternate = false;

  constructor(pilot: boolean | MechaDefinition) {
    const gm = typeof pilot === 'boolean' ? pilot : pilot.id === 'gm';
    this.scene.add(this.root, new HemisphereLight(0xd9edff, 0x657381, 2));
    const light = new DirectionalLight(0xffffff, 2.8);
    light.position.set(-3, 5, 2); this.scene.add(light);
    const hand = group(this.root, 'first-person-hand');
    const armor = this.resources.material(gm ? 0xd5e5dc : 0xf0f2ed);
    const dark = this.resources.material(0x263447);
    part(hand, this.resources.box(0.48, 0.38, 0.49), dark, [0, -0.12, 0]);
    part(hand, this.resources.box(0.6, 0.72, 0.64), armor, [0, -0.62, 0.12]);
    for (let i = 0; i < 3; i++) part(hand, this.resources.box(0.09, 0.17, 0.08), armor, [-0.15 + i * 0.15, -0.09, -0.27]);
    mergeArmor(hand, this.resources);
    this.weapons = typeof pilot !== 'boolean' && pilot.weaponModels
      ? pilot.weaponModels(this.root, this.resources) : createGundamWeapons(this.root, this.resources, gm);
    for (const weapon of [this.weapons.ranged, this.weapons.alternateRanged, this.weapons.melee]) weapon?.position.set(0, 0, -0.15);
    this.flash = group(this.root, 'first-person-muzzle-flash');
    part(this.flash, this.resources.sphere(0.19), this.resources.material(0xffefb5, 0xffb349, 4));
    this.flash.visible = false;
    this.root.scale.setScalar(0.45);
  }

  update(actor: Actor, camera: PerspectiveCamera, dt: number, time: number, aiming: boolean): void {
    this.camera.aspect = camera.aspect; this.camera.fov = camera.fov; this.camera.updateProjectionMatrix();
    this.alternate = actor.slot === 'alternate-ranged';
    this.weapons.ranged.visible = actor.slot === 'ranged';
    if (this.weapons.alternateRanged) this.weapons.alternateRanged.visible = this.alternate;
    this.weapons.melee.visible = actor.slot === 'melee';
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.flashTime = Math.max(0, this.flashTime - dt);
    const movement = actor.grounded ? Math.min(1, actor.speed / actor.definition.speed) : 0;
    const swing = actor.slot === 'melee' && actor.swing.running ? Math.sin(actor.swing.progress * Math.PI) : 0;
    this.root.position.set((aiming ? 0.32 : 0.58) - swing * 0.55,
      -0.48 + Math.sin(time * 10) * movement * 0.012 + swing * 0.22,
      -0.9 + this.recoil * 0.1);
    this.root.rotation.set(this.recoil * 0.065 - swing * 0.45, swing * 0.85, -0.04 - swing * 0.5);
    this.flash.visible = actor.slot !== 'melee' && this.flashTime > 0;
    const muzzle = this.alternate && this.weapons.alternateMuzzle ? this.weapons.alternateMuzzle : this.weapons.muzzle;
    this.flash.position.copy(muzzle.position).add(muzzle.parent!.position);
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
  }

  shot(): void { this.recoil = 1; this.flashTime = 0.055; }

  muzzleWorld(camera: PerspectiveCamera): Vector3 {
    const muzzle = this.alternate && this.weapons.alternateMuzzle ? this.weapons.alternateMuzzle : this.weapons.muzzle;
    camera.updateMatrixWorld(true);
    return muzzle.getWorldPosition(new Vector3()).applyMatrix4(camera.matrixWorld);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.scene.clear(); this.resources.dispose();
  }
}

/** Don't allow a cosmetic gun to place a shot beyond cover or a close target. */
export function safeFirstPersonOrigin(eye: Vector3, muzzle: Vector3, target: Vector3,
  walls: RectCollider[], bodies: HitBody[]): Vector3 {
  if (eye.distanceToSquared(target) <= eye.distanceToSquared(muzzle)
    || firstSegmentHit(eye, muzzle, walls, bodies)) return eye.clone();
  return muzzle.clone();
}
