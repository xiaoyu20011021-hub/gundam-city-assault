export interface GameEvents {
  shot: { ownerId: string; weapon: string };
  damaged: { targetId: string; damage: number; x: number; y: number; z: number };
  defeated: { targetId: string; elite: boolean };
  wave: { index: number; title: string };
}
export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<(event: any) => void>>();
  on<K extends keyof GameEvents>(kind: K, handler: (event: GameEvents[K]) => void): () => void {
    if (!this.handlers.has(kind)) this.handlers.set(kind, new Set());
    this.handlers.get(kind)!.add(handler);
    return () => this.handlers.get(kind)?.delete(handler);
  }
  emit<K extends keyof GameEvents>(kind: K, event: GameEvents[K]): void { this.handlers.get(kind)?.forEach(handler => handler(event)); }
  clear(): void { this.handlers.clear(); }
}
