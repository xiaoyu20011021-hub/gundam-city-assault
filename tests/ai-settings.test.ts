import { afterEach, expect, it, vi } from 'vitest';
import { aiBestKey, parseAiMode, readAiMode } from '../src/gameplay/ai-settings';
import { Game } from '../src/gameplay/game';
import { GameUI } from '../src/ui/ui';
import { cityDefinition } from '../src/content/maps/city';

afterEach(() => vi.unstubAllGlobals());
it('defaults to classic for absent or invalid mode and tolerates blocked browser storage', () => {
  expect(parseAiMode(null)).toBe('classic'); expect(parseAiMode('broken')).toBe('classic');
  expect(parseAiMode('enhanced')).toBe('enhanced');
  expect(readAiMode(() => { throw new Error('blocked'); })).toBe('classic');
  expect(readAiMode(() => 'enhanced')).toBe('enhanced');
});
it('keeps the old classic score key and uses a separate enhanced score key', () => {
  expect(aiBestKey('classic')).toBe('sd-city-best');
  expect(aiBestKey('enhanced')).toBe('sd-city-best-enhanced');
});
it('persists mode selection independently from sortie mode and restores its own best score', () => {
  const stored = new Map([['sd-city-best', '1234'], ['sd-city-best-enhanced', '567']]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
  const shown: string[] = [];
  const subject = Object.assign(Object.create(Game.prototype), { mode: 'menu', selectedAiMode: 'classic', selectedSortieMode: 'unlimited',
    best: 1234, ui: { setAiMode: (value: string) => shown.push(value) } });
  subject.setting('ai-mode', 'enhanced');
  expect(subject.selectedAiMode).toBe('enhanced'); expect(subject.selectedSortieMode).toBe('unlimited');
  expect(subject.best).toBe(567); expect(stored.get('sd-city-ai-mode')).toBe('enhanced');
  expect(readAiMode(key => stored.get(key) ?? null)).toBe('enhanced');
  subject.setting('ai-mode', 'classic');
  expect(subject.best).toBe(1234); expect(shown).toEqual(['enhanced', 'classic']);
  subject.setting('ai-mode', 'bad'); expect(subject.selectedAiMode).toBe('classic');
});
it('does not allow difficulty to change during a sortie', () => {
  const subject = Object.assign(Object.create(Game.prototype), { mode: 'playing', selectedAiMode: 'classic' });
  subject.setting('ai-mode', 'enhanced'); expect(subject.selectedAiMode).toBe('classic');
});

it('offers both AI modes and identifies the chosen difficulty on pause and results', () => {
  const subject = Object.assign(Object.create(GameUI.prototype), { pilot: 'gundam', sortieMode: 'unlimited', aiMode: 'enhanced', map: cityDefinition,
    root: { dataset: {} }, hud: { hidden: true }, overlay: { hidden: false, innerHTML: '' } });
  subject.show('menu');
  expect(subject.overlay.innerHTML).toContain('aria-label="敌方 AI"');
  expect(subject.overlay.innerHTML).toMatch(/value="enhanced" selected/);
  expect(subject.overlay.innerHTML).toContain('经典 AI');
  subject.show('paused'); expect(subject.overlay.innerHTML).toContain('增强 AI');
  subject.show('victory', { best: 345 }); expect(subject.overlay.innerHTML).toContain('增强 AI');
  expect(subject.overlay.innerHTML).toContain('345');
});

it('writes an enhanced result without replacing an existing classic best score', () => {
  const stored = new Map([['sd-city-best', '1234']]);
  vi.stubGlobal('localStorage', { setItem: (key: string, value: string) => stored.set(key, value) });
  const subject = Object.assign(Object.create(Game.prototype), { selectedAiMode: 'enhanced', ended: false, best: 0,
    mission: { kills: 5, status: 'defeat', elapsed: 10 }, input: { unlock() {}, clear() {} }, show() {} });
  subject.finish();
  expect(stored.get('sd-city-best')).toBe('1234'); expect(stored.get('sd-city-best-enhanced')).toBe('500');
});
