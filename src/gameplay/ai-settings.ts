export type AIMode = 'classic' | 'enhanced';
export const AI_MODE_KEY = 'sd-city-ai-mode';
export const AI_LABELS: Record<AIMode, string> = { classic: '经典 AI', enhanced: '增强 AI' };
export function parseAiMode(value: unknown): AIMode { return value === 'enhanced' ? 'enhanced' : 'classic'; }
export function readAiMode(read: (key: string) => string | null): AIMode {
  try { return parseAiMode(read(AI_MODE_KEY)); } catch { return 'classic'; }
}
export function aiBestKey(mode: AIMode): string { return mode === 'enhanced' ? 'sd-city-best-enhanced' : 'sd-city-best'; }
