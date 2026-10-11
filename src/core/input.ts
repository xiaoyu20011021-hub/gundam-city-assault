export class GameInput {
  readonly keys = new Set<string>();
  private pressed = new Set<string>();
  firing = false;
  aiming = false;
  mouseX = 0;
  mouseY = 0;
  onUnlock?: () => void;
  private abort = new AbortController();
  constructor(readonly canvas: HTMLCanvasElement) {
    const options = { signal: this.abort.signal };
    document.addEventListener('keydown', e => {
      if (!this.locked) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    }, options);
    document.addEventListener('keyup', e => this.keys.delete(e.code), options);
    document.addEventListener('mousemove', e => {
      if (this.locked) { this.mouseX += e.movementX; this.mouseY += e.movementY; }
    }, options);
    document.addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) this.firing = true;
      if (e.button === 2) this.aiming = true;
    }, options);
    document.addEventListener('mouseup', e => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this.aiming = false;
    }, options);
    canvas.addEventListener('contextmenu', e => e.preventDefault(), options);
    document.addEventListener('pointerlockchange', () => {
      if (!this.locked) { this.clear(); this.onUnlock?.(); }
    }, options);
    window.addEventListener('blur', () => { this.clear(); this.onUnlock?.(); }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); this.onUnlock?.(); } }, options);
  }
  get locked(): boolean { return document.pointerLockElement === this.canvas; }
  takeKey(code: string): boolean { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  clear(): void { this.keys.clear(); this.pressed.clear(); this.firing = false; this.aiming = false; this.mouseX = 0; this.mouseY = 0; }
  async lock(): Promise<void> { await this.canvas.requestPointerLock(); }
  unlock(): void { if (this.locked) document.exitPointerLock(); }
  dispose(): void { this.abort.abort(); this.clear(); }
}
