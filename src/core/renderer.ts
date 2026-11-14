import { ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer, type Object3D } from 'three';
import type { MapDefinition } from '../content/maps/types';

export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 1, 0.15, 1500);
  readonly sun = new DirectionalLight(0xe4edff, 3.2);
  readonly ambient = new HemisphereLight(0xb3c9e9, 0x666978, 1.65);
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
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.scene.background = new Color(0x03060d);
    this.scene.add(this.ambient);
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
  setEnvironment(environment?: MapDefinition['environment']): void {
    this.camera.far = environment?.far ?? 1500; this.camera.updateProjectionMatrix();
    this.renderer.toneMappingExposure = environment?.exposure ?? 1.05;
    this.ambient.intensity = environment?.ambient ?? 1.65;
  }
  followSun(position: Vector3): void {
    this.sun.target.position.set(position.x, 0, position.z);
    this.sun.position.set(position.x + 36, 70, position.z + 30);
  }
  render(overlay?: { scene: Scene; camera: PerspectiveCamera }, hiddenBody?: Object3D): void {
    const visible = hiddenBody?.visible;
    const autoClear = this.renderer.autoClear, autoReset = this.renderer.info.autoReset;
    if (autoReset) this.renderer.info.reset();
    this.renderer.info.autoReset = false;
    try {
      if (hiddenBody) hiddenBody.visible = false;
      try { this.renderer.render(this.scene, this.camera); }
      finally { if (hiddenBody) hiddenBody.visible = visible!; }
      if (overlay) {
        if (overlay.camera.aspect !== this.camera.aspect || overlay.camera.fov !== this.camera.fov) {
          overlay.camera.aspect = this.camera.aspect; overlay.camera.fov = this.camera.fov;
          overlay.camera.updateProjectionMatrix();
        }
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(overlay.scene, overlay.camera);
      }
    } finally {
      this.renderer.autoClear = autoClear; this.renderer.info.autoReset = autoReset;
    }
  }
  dispose(): void { window.removeEventListener('resize', this.resize); this.sun.dispose(); this.renderer.dispose(); }
}
