import { AdditiveBlending, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';

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
  private readonly blastGeometry = new SphereGeometry(1, 16, 12);
  private readonly ringGeometry = new TorusGeometry(1, 0.035, 6, 48);
  private readonly blasts = Array.from({ length: 12 }, () => {
    const root = new Group(); root.name = 'rocket-explosion'; root.visible = false;
    const material = (color: number) => new MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false, blending: AdditiveBlending });
    const core = new Mesh(this.blastGeometry, material(0xffefb0));
    const fire = new Mesh(this.blastGeometry, material(0xff6b20));
    const ring = new Mesh(this.ringGeometry, material(0xffc276));
    ring.rotation.x = Math.PI / 2;
    root.add(core, fire, ring);
    return { root, core, fire, ring, life: 0, radius: 7 };
  });
  private blastCursor = 0;
  constructor() {
    this.mesh = new InstancedMesh(this.geometry, this.material, this.particles.length);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage); this.mesh.frustumCulled = false;
    this.root.add(this.mesh, ...this.blasts.map(blast => blast.root)); this.update(0);
  }
  explosion(position: Vector3, radius: number): void {
    const blast = this.blasts[this.blastCursor++ % this.blasts.length];
    blast.root.position.copy(position); blast.radius = radius; blast.life = 0.8; blast.root.visible = true;
    this.updateBlast(blast);
    this.burst(position, 0xffbb51, 38, 1.5);
    this.burst(position, 0x625860, 18, 0.65, true);
    this.burst(position, 0x9b8170, 10, 1, true);
  }
  private updateBlast(blast: typeof this.blasts[number]): void {
    const age = 0.8 - blast.life, t = age / 0.8;
    blast.root.visible = blast.life > 0;
    blast.core.scale.setScalar(blast.radius * (0.12 + Math.min(age / 0.12, 1) * 0.3));
    blast.core.material.opacity = Math.max(0, 1 - age / 0.24);
    blast.fire.scale.setScalar(blast.radius * (0.18 + (1 - Math.exp(-age * 9)) * 0.48));
    blast.fire.material.opacity = Math.max(0, 0.75 * (1 - age / 0.6));
    blast.fire.position.y = age * 1.1;
    blast.ring.scale.setScalar(blast.radius * (0.1 + t * 1.35));
    blast.ring.material.opacity = Math.max(0, 0.85 * (1 - t));
    blast.ring.position.y = 0.06;
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
    for (const blast of this.blasts) {
      if (blast.life <= 0) continue;
      blast.life = Math.max(0, blast.life - dt); this.updateBlast(blast);
    }
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
  clear(): void {
    for (const p of this.particles) p.life = 0;
    for (const blast of this.blasts) { blast.life = 0; blast.root.visible = false; }
    this.mesh.count = 0;
  }
  dispose(): void {
    this.clear(); this.blastGeometry.dispose(); this.ringGeometry.dispose();
    for (const blast of this.blasts) for (const mesh of [blast.core, blast.fire, blast.ring]) mesh.material.dispose();
    this.geometry.dispose(); this.material.dispose(); this.mesh.dispose(); this.root.removeFromParent();
  }
}
