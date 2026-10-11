const SOUND_FILES = {
  beam: 'beam', machinegun: 'machinegun', saber: 'saber', boost: 'boost',
  explosion: 'explosion', wave: 'wave', impact: 'impact', axe: 'axe', step: 'step',
} as const;
export type SoundName = keyof typeof SOUND_FILES;

export class GameAudio {
  private context = new AudioContext();
  private buffers = new Map<SoundName, AudioBuffer>();
  private voices = new Set<AudioBufferSourceNode>();
  private master = this.context.createGain();
  muted = false;
  constructor() { this.master.gain.value = 0.55; this.master.connect(this.context.destination); }
  get state(): AudioContextState { return this.context.state; }
  async load(): Promise<void> {
    await Promise.all(Object.entries(SOUND_FILES).map(async ([name, file]) => {
      const response = await fetch(import.meta.env.BASE_URL + 'assets/audio/' + file + '.ogg');
      if (!response.ok) throw new Error('音效加载失败：' + file);
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(name as SoundName, buffer);
    }));
  }
  async unlock(): Promise<void> { if (this.context.state === 'suspended') await this.context.resume(); }
  play(name: SoundName, volume = 1, pitch = 1): void {
    if (this.muted || this.context.state !== 'running' || this.voices.size >= 24) return;
    const buffer = this.buffers.get(name); if (!buffer) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; source.playbackRate.value = pitch;
    gain.gain.value = volume; source.connect(gain); gain.connect(this.master);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
    this.voices.add(source); source.start();
  }
  stop(): void { for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } } }
  dispose(): void { this.stop(); this.master.disconnect(); void this.context.close(); }
}
