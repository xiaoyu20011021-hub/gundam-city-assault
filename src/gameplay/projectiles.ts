import { Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { WeaponDefinition } from '../content/weapons';
import type { RectCollider } from '../content/maps/types';
import type { Actor } from './actor';
import { firstSegmentHit, type Point3 } from './combat';
import type { DamageableTarget } from './damageable';

export interface ProjectileSnapshot { id: number; position: Point3; velocity: Point3; life: number; ownerId: string; team: string; damage: number; sourceUnitId?: string }
interface Projectile extends Omit<ProjectileSnapshot, 'position' | 'velocity'> { active: boolean; position: Vector3; velocity: Vector3; color: Color; beam: boolean }
export class ProjectileSystem {
  readonly root = new Group();
  private readonly geometry = new SphereGeometry(1, 6, 4);
  private readonly material = new MeshBasicMaterial({ toneMapped: false });
  private mesh: InstancedMesh;
  private pool: Projectile[] = Array.from({ length: 160 }, () => ({ id: 0, active: false, position: new Vector3(), velocity: new Vector3(), life: 0, ownerId: '', team: '', damage: 0, color: new Color(), beam: false }));
  private nextShotId = 1;
  private matrix = new Matrix4();
  private quaternion = new Quaternion();
  private scale = new Vector3();
  private forward = new Vector3(0, 0, -1);
  constructor() {
    this.mesh = new InstancedMesh(this.geometry, this.material, this.pool.length);
    this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(DynamicDrawUsage); this.mesh.count = 0;
    this.root.add(this.mesh);
  }
  fire(owner: Pick<Actor, 'id' | 'team'>, origin: Vector3, direction: Vector3, weapon: WeaponDefinition, sourceUnitId?: string): boolean {
    const p = this.pool.find(p => !p.active);
    if (!p) return false;
    p.id = this.nextShotId++; p.active = true; p.position.copy(origin); p.velocity.copy(direction).normalize().multiplyScalar(weapon.speed);
    p.life = weapon.range / weapon.speed; p.ownerId = owner.id; p.team = owner.team; p.damage = weapon.damage;
    p.sourceUnitId = sourceUnitId;
    p.color.setHex(weapon.color); p.beam = weapon.visual === 'beam' || weapon.id === 'beam-rifle' || weapon.id === 'beam-spray-gun';
    return true;
  }
  update(dt: number, actors: Actor[], walls: RectCollider[], onHit: (position: Vector3, damage: number, target?: Actor) => void,
    additionalTargets: readonly DamageableTarget[] = [], onRemoteHit?: (position: Vector3, damage: number, target: DamageableTarget) => void): void {
    const bodyTeams = new Map<string, Actor>();
    for (const actor of actors) if (!actor.dead) bodyTeams.set(actor.id, actor);
    const end = new Vector3();
    let index = 0;
    for (const p of this.pool) {
      if (!p.active) continue;
      const travelTime = Math.min(dt, p.life);
      end.copy(p.position).addScaledVector(p.velocity, travelTime);
      const remoteTargets = additionalTargets.filter(t => t.team !== p.team && t.id !== p.ownerId && t.isAlive());
      const bodies = [...bodyTeams.values()].filter(a => !a.dead && a.team !== p.team && a.id !== p.ownerId).map(a => a.hitBody());
      bodies.push(...remoteTargets.map(t => t.hitBody()));
      const hit = firstSegmentHit(p.position, end, walls, bodies);
      p.life -= dt;
      if (hit) {
        p.active = false;
        const position = new Vector3(hit.point.x, hit.point.y, hit.point.z);
        const remote = remoteTargets.find(t => t.id === hit.id);
        if (remote) onRemoteHit?.(position, p.damage, remote);
        else onHit(position, p.damage, hit.id ? bodyTeams.get(hit.id) : undefined);
        continue;
      }
      if (p.life <= 0) { p.active = false; continue; }
      p.position.copy(end);
      this.quaternion.setFromUnitVectors(this.forward, p.velocity.clone().normalize());
      this.scale.set(p.beam ? 0.12 : 0.085, p.beam ? 0.12 : 0.085, p.beam ? 2.4 : 0.75);
      this.matrix.compose(p.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(index, this.matrix); this.mesh.setColorAt(index, p.color); index++;
    }
    this.mesh.count = index; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear(): void { for (const p of this.pool) p.active = false; this.mesh.count = 0; }
  snapshot(): ProjectileSnapshot[] {
    return this.pool.filter(p => p.active).map(p => ({ id: p.id, ownerId: p.ownerId, sourceUnitId: p.sourceUnitId, team: p.team, damage: p.damage, life: p.life,
      position: { x: p.position.x, y: p.position.y, z: p.position.z }, velocity: { x: p.velocity.x, y: p.velocity.y, z: p.velocity.z } }));
  }
  get activeCount(): number { return this.pool.filter(p => p.active).length; }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); this.mesh.dispose(); this.root.removeFromParent(); }
}
