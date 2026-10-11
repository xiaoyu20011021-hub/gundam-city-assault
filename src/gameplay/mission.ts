import type { WaveDefinition } from '../content/maps/types';

export class Mission {
  status: 'idle' | 'playing' | 'victory' | 'defeat' = 'idle';
  waveIndex = 0;
  remaining = 0;
  kills = 0;
  elapsed = 0;
  intermission = 0;
  waveChanged = false;
  constructor(readonly waves: WaveDefinition[]) {}
  start(): void {
    this.status = 'playing'; this.waveIndex = 0; this.kills = 0; this.elapsed = 0;
    this.intermission = 0; this.remaining = this.waves[0].enemies.length; this.waveChanged = true;
  }
  enemyDefeated(): void {
    if (this.status !== 'playing' || this.remaining <= 0) return;
    this.remaining--; this.kills++;
    if (this.remaining === 0) {
      if (this.waveIndex === this.waves.length - 1) this.status = 'victory';
      else this.intermission = 3.5;
    }
  }
  defeat(): void { if (this.status === 'playing') this.status = 'defeat'; }
  update(dt: number): void {
    if (this.status !== 'playing') return;
    this.elapsed += dt;
    if (this.intermission <= 0) return;
    this.intermission -= dt;
    if (this.intermission <= 0) {
      this.intermission = 0; this.waveIndex++;
      this.remaining = this.waves[this.waveIndex].enemies.length; this.waveChanged = true;
    }
  }
}
