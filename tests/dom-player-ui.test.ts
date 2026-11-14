import { expect, it } from 'vitest';
import { isPlayableMecha } from '../src/content/mechas/playable';
import { cityDefinition } from '../src/content/maps/city';
import { GameUI, type HudState } from '../src/ui/ui';
import { Game } from '../src/gameplay/game';
import { Actor } from '../src/gameplay/actor';
import { MECHA_DEFINITIONS } from '../src/content/mechas';

it('offers Dom in the pilot menu and enables its hangar sortie', () => {
  expect(isPlayableMecha('dom')).toBe(true);
  const sortie = { disabled: true, textContent: '' };
  const ui = Object.assign(Object.create(GameUI.prototype), {
    pilot: 'dom', battleMode: 'campaign', sortieMode: 'standard', aiMode: 'classic', map: cityDefinition,
    root: { dataset: {} }, hud: { hidden: true },
    overlay: { innerHTML: '', querySelector: () => sortie, querySelectorAll: () => [] },
  });
  ui.show('menu'); expect(ui.overlay.innerHTML).toContain('value="dom" selected');
  ui.show('gallery'); ui.selectPreview('dom');
  expect(sortie.disabled).toBe(false); expect(sortie.textContent).toContain('MS-09');
  ui.selectPreview('zaku'); expect(sortie.disabled).toBe(true);
  const actor = new Actor('preview', MECHA_DEFINITIONS.dom, 'player');
  const game = Object.assign(Object.create(Game.prototype), { map: cityDefinition, mode: 'menu', selectedPlayer: 'dom', exhibit: [actor] });
  game.layoutExhibit(); expect(actor.rig.root.visible).toBe(true); actor.dispose();
});

it('displays main-slot rocket ammo and reload instead of the beam heat meter', () => {
  const nodes = new Map<string, { textContent: string; hidden: boolean; style: { width: string }; classList: { toggle(): void } }>();
  const ui = Object.assign(Object.create(GameUI.prototype), { el(id: string) {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', hidden: false, style: { width: '' }, classList: { toggle() {} } });
    return nodes.get(id)!;
  } });
  const state = { health: 240, maxHealth: 240, energy: 100, heat: 0, weapon: 'Giant Bazooka', slot: 'ranged',
    ammo: 2, magazine: 3, melee: false, reloading: false, hasAlternateRanged: false, altitude: 0, elapsed: 0 } as HudState;
  ui.setPilot('dom'); ui.update(state);
  expect(nodes.get('weapon-message')!.textContent).toContain('2/3');
  expect(parseFloat(nodes.get('heat-fill')!.style.width)).toBeCloseTo(200 / 3);
  expect(nodes.get('machinegun-key')!.hidden).toBe(true);
  ui.update({ ...state, ammo: 0, reloading: true });
  expect(nodes.get('weapon-message')!.textContent).toContain('RELOADING');
  expect(nodes.get('heat-fill')!.style.width).toBe('0%');
});
