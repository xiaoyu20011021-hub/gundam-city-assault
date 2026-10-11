import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';

export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 1, 0.15, 650);
  readonly sun = new DirectionalLight(0xfff1d4, 2.7);
  quality: 'low' | 'medium' = 'medium';
  private resize = () => {
    const width = window.innerWidth, height = window.innerHeight;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color(0xb2d0dc);
    this.scene.fog = new Fog(0xb2d0dc, 110, 330);
    this.scene.add(new HemisphereLight(0xdfefff, 0xaba18b, 2.0));
    this.sun.position.set(36, 70, 30); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -66, right: 66, top: 66, bottom: -66, near: 1, far: 160 });
    this.sun.shadow.bias = -0.00045; this.sun.shadow.normalBias = 0.12;
    this.scene.add(this.sun, this.sun.target);
    this.setQuality('medium'); this.resize();
    window.addEventListener('resize', this.resize);
  }
  setQuality(quality: 'low' | 'medium'): void {
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1 : 1.5));
    this.renderer.shadowMap.enabled = quality === 'medium';
    this.sun.castShadow = quality === 'medium';
  }
  followSun(position: Vector3): void {
    this.sun.target.position.set(position.x, 0, position.z);
    this.sun.position.set(position.x + 36, 70, position.z + 30);
  }
  render(): void { this.renderer.render(this.scene, this.camera); }
  dispose(): void { window.removeEventListener('resize', this.resize); this.sun.dispose(); this.renderer.dispose(); }
}
