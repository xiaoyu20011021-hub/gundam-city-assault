import { Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';

interface Particle { position: Vector3; velocity: Vector3; life: number; duration: number; size: number; color: Color; smoke: boolean }
export class Effects {
  readonly root = new Group();
  private readonly mesh: InstancedMesh;
  private readonly geometry = new SphereGeometry(1, 6, 4);
  private readonly material = new MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false });
  private readonly particles: Particle[] = Array.from({ length: 320 }, () => ({ position: new Vector3(), velocity: new Vector3(), life: 0, duration: 1, size: 1, color: new Color(), smoke: false }));
  private matrix = new Matrix4();
  private scale = new Vector3();
  private rotation = new Quaternion();
  private cursor = 0;
  constructor() {
    this.mesh = new InstancedMesh(this.geometry, this.material, this.particles.length);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage); this.mesh.frustumCulled = false;
    this.root.add(this.mesh); this.update(0);
  }
  burst(position: Vector3, color: number, count = 12, intensity = 1, smoke = false): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.cursor++ % this.particles.length];
      p.position.copy(position);
      p.velocity.set((Math.random() - 0.5) * 13 * intensity, Math.random() * 11 * intensity, (Math.random() - 0.5) * 13 * intensity);
      p.life = p.duration = (smoke ? 1.6 : 0.35) + Math.random() * (smoke ? 1 : 0.4);
      p.size = (smoke ? 0.6 : 0.08) + Math.random() * (smoke ? 0.8 : 0.25); p.color.setHex(color); p.smoke = smoke;
    }
  }
  trail(position: Vector3, color: number): void {
    const p = this.particles[this.cursor++ % this.particles.length];
    p.position.copy(position); p.velocity.set(0, 0, 0); p.life = p.duration = 0.19;
    p.size = 0.12; p.color.setHex(color); p.smoke = false;
  }
  update(dt: number): void {
    let index = 0;
    for (const p of this.particles) {
      p.life = Math.max(0, p.life - dt);
      if (p.life <= 0) continue;
      p.position.addScaledVector(p.velocity, dt);
      if (!p.smoke) p.velocity.y -= 18 * dt;
      else p.velocity.multiplyScalar(Math.exp(-dt * 1.5));
      const ratio = p.life / p.duration;
      const size = p.size * (p.smoke ? 1 + (1 - ratio) * 2 : ratio);
      this.scale.setScalar(size); this.matrix.compose(p.position, this.rotation, this.scale);
      this.mesh.setMatrixAt(index, this.matrix); this.mesh.setColorAt(index, p.color.clone().multiplyScalar(p.smoke ? ratio : 1.5)); index++;
    }
    this.mesh.count = index; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear(): void { for (const p of this.particles) p.life = 0; this.mesh.count = 0; }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); this.mesh.dispose(); this.root.removeFromParent(); }
}
