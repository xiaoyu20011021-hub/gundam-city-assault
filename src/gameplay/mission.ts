import type { WaveDefinition } from '../content/maps/types';

export class Mission {
  status: 'idle' | 'playing' | 'victory' | 'defeat' = 'idle';
  waveIndex = 0;
  remaining = 0;
  kills = 0;
  elapsed = 0;
  intermission = 0;
  waveChanged = false;
  private activeWaves: WaveDefinition[];
  constructor(readonly waves: WaveDefinition[]) { this.activeWaves = waves; }
  get currentWave(): WaveDefinition { return this.activeWaves[this.waveIndex]; }
  get waveCount(): number { return this.activeWaves.length; }
  get totalEnemies(): number { return this.activeWaves.reduce((total, wave) => total + wave.enemies.length, 0); }
  start(waves: WaveDefinition[] = this.waves): void {
    this.activeWaves = waves;
    this.status = 'playing'; this.waveIndex = 0; this.kills = 0; this.elapsed = 0;
    this.intermission = 0; this.remaining = this.currentWave.enemies.length; this.waveChanged = true;
  }
  enemyDefeated(): void {
    if (this.status !== 'playing' || this.remaining <= 0) return;
    this.remaining--; this.kills++;
    if (this.remaining === 0) {
      if (this.waveIndex === this.activeWaves.length - 1) this.status = 'victory';
      else this.intermission = 3.5;
    }
  }
  defeat(): void { if (this.status === 'playing' || this.status === 'victory') this.status = 'defeat'; }
  update(dt: number): void {
    if (this.status !== 'playing') return;
    this.elapsed += dt;
    if (this.intermission <= 0) return;
    this.intermission -= dt;
    if (this.intermission <= 0) {
      this.intermission = 0; this.waveIndex++;
      this.remaining = this.currentWave.enemies.length; this.waveChanged = true;
    }
  }
}
