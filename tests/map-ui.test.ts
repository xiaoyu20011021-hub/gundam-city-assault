import { expect, it } from 'vitest';
import { HemisphereLight, PerspectiveCamera } from 'three';
import { GameUI } from '../src/ui/ui';
import { GameRenderer } from '../src/core/renderer';
import { cityDefinition } from '../src/content/maps/city';
import { seleneDefinition } from '../src/content/maps/selene';

it('shows both maps and retains pilot, mission and difficulty while changing map identity', () => {
  const meta = { textContent: '' };
  const ui = Object.assign(Object.create(GameUI.prototype), {
    pilot: 'nu-gundam', battleMode: 'duel', sortieMode: 'unlimited', aiMode: 'enhanced', map: cityDefinition,
    root: { dataset: {}, querySelector: () => meta }, hud: { hidden: true }, overlay: { hidden: false, innerHTML: '' },
  });
  ui.setMap(seleneDefinition); ui.show('menu');
  expect(ui.overlay.innerHTML).toContain('aria-label="作战地图"');
  expect(ui.overlay.innerHTML).toContain('value="selene" selected');
  expect(ui.overlay.innerHTML).toContain('静海战线'); expect(meta.textContent).toContain('0087');
  for (const id of ['nu-gundam', 'duel', 'unlimited', 'enhanced']) expect(ui.overlay.innerHTML).toContain(`value="${id}" selected`);
  ui.setMap(cityDefinition); ui.show('menu');
  expect(ui.overlay.innerHTML).toContain('value="city" selected'); expect(meta.textContent).toContain('0079');
  ui.setMap(seleneDefinition); ui.show('loading');
  expect(ui.overlay.innerHTML).toContain('data-setting="map"'); expect(ui.overlay.innerHTML).toContain('data-action="back-map"');
});

it('restores original render settings after returning from SELENE', () => {
  const graphics = Object.assign(Object.create(GameRenderer.prototype), {
    camera: new PerspectiveCamera(55, 1, .15, 1500), ambient: new HemisphereLight(0xffffff, 0xffffff, 1.65),
    renderer: { toneMappingExposure: 1.05 },
  });
  graphics.setEnvironment(seleneDefinition.environment);
  expect(graphics.camera.far).toBe(8000); expect(graphics.renderer.toneMappingExposure).toBe(1);
  graphics.setEnvironment(cityDefinition.environment);
  expect(graphics.camera.far).toBe(1500); expect(graphics.renderer.toneMappingExposure).toBe(1.05);
});
