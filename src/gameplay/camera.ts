import { PerspectiveCamera, Vector3 } from 'three';
import type { RectCollider } from '../content/maps/types';
import { firstSegmentHit } from './combat';

export class ThirdPersonCamera {
  yaw = 0;
  pitch = 0.13;
  private target = new Vector3();
  private desired = new Vector3();
  private pivot = new Vector3();
  private wallSource?: RectCollider[];
  private expandedWalls: RectCollider[] = [];
  constructor(readonly camera: PerspectiveCamera) {}
  update(position: Vector3, aiming: boolean, walls: RectCollider[], dt: number, snap = false, flightBoost = false): void {
    const distance = aiming ? 7.7 : flightBoost ? 14 : 12.5, shoulder = aiming ? 2.35 : 2.0;
    if (this.wallSource !== walls) {
      this.wallSource = walls;
      this.expandedWalls = walls.map(w => ({ ...w, minX: w.minX - 0.4, maxX: w.maxX + 0.4, minZ: w.minZ - 0.4, maxZ: w.maxZ + 0.4, height: w.height + 0.4 }));
    }
    this.pivot.set(position.x, position.y + 4.1, position.z);
    this.target.set(position.x + Math.cos(this.yaw) * shoulder, position.y + 4.1, position.z - Math.sin(this.yaw) * shoulder);
    // The actor's center is safe; its shoulder offset may already cross a wall.
    const shoulderHit = firstSegmentHit(this.pivot, this.target, this.expandedWalls, []);
    if (shoulderHit) this.target.lerpVectors(this.pivot, this.target, Math.max(0, shoulderHit.t - 0.03));
    this.desired.set(this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      this.target.y + Math.sin(this.pitch) * distance,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * distance);
    this.desired.y = Math.max(0.65, this.desired.y);
    const collision = firstSegmentHit(this.pivot, this.desired, this.expandedWalls, []);
    if (collision) this.desired.lerpVectors(this.pivot, this.desired, Math.max(0, collision.t - 0.025));
    this.camera.position.lerp(this.desired, snap ? 1 : 1 - Math.exp(-dt * 18));
    const smoothedHit = firstSegmentHit(this.pivot, this.camera.position, this.expandedWalls, []);
    if (smoothedHit) this.camera.position.lerpVectors(this.pivot, this.camera.position, Math.max(0, smoothedHit.t - 0.025));
    this.camera.position.y = Math.max(0.65, this.camera.position.y);
    // Mouse aim responds immediately even while the shoulder position eases into
    // place. Flight input uses this same yaw/pitch direction.
    const look = this.camera.position.clone().add(new Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)));
    this.camera.lookAt(look);
    const fov = aiming ? 44 : flightBoost ? 63 : 58;
    this.camera.fov += (fov - this.camera.fov) * (snap ? 1 : 1 - Math.exp(-dt * 12));
    this.camera.updateProjectionMatrix();
  }
}
