import { expect, it } from 'vitest';
import { isPlayableMecha, PLAYABLE_MECHAS } from '../src/content/mechas/playable';
import { remoteHudMarkup } from '../src/ui/remote-hud';
import type { RemoteUnitSnapshot } from '../src/gameplay/remote-weapons/types';

it('exposes Nu as a playable pilot with its own weapon summary', () => {
  expect(isPlayableMecha('nu-gundam')).toBe(true); expect(isPlayableMecha('char-zaku')).toBe(false);
  expect(PLAYABLE_MECHAS['nu-gundam'].weapons).toContain('六枚浮游炮');
  expect(PLAYABLE_MECHAS['nu-gundam'].weapons).not.toContain('机枪');
});

it('shows individual health, irreversible losses and blocked recall without revival text', () => {
  const base: RemoteUnitSnapshot = { id: 'one', ownerId: 'player', team: 'player', equipmentId: 'funnel', model: 'nu-fin-funnel',
    mountId: 'funnel-0', index: 0, state: 'returning', position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 },
    health: 24, maxHealth: 48, radius: .5, height: .8, cooldown: 0, blocked: true };
  const html = remoteHudMarkup([base, { ...base, id: 'two', index: 1, state: 'destroyed', health: 0, blocked: false }]);
  expect(html).toContain('24/48'); expect(html).toContain('归队受阻'); expect(html).toContain('损失');
  expect(html).toContain('存活 1/2'); expect(html).not.toContain('复活');
  const targeted = remoteHudMarkup([{ ...base, blocked: false, targetId: 'enemy' }], { enemy: '夏亚专用扎古' });
  expect(targeted).toContain('攻击目标：夏亚专用扎古');
});
