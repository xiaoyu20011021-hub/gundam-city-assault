import { expect, it, vi } from 'vitest';
import { GameInput } from '../src/core/input';

it('consumes T once per physical press, ignores unlocked input and clears on pause', () => {
  const canvas = new EventTarget() as unknown as HTMLCanvasElement;
  const doc = Object.assign(new EventTarget(), { pointerLockElement: canvas, hidden: false });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', new EventTarget());
  const input = new GameInput(canvas);
  const key = (type: string, repeat = false) => doc.dispatchEvent(Object.assign(new Event(type), { code: 'KeyT', repeat }));
  try {
    key('keydown'); expect(input.takeKey('KeyT')).toBe(true);
    key('keydown', true); expect(input.takeKey('KeyT')).toBe(false);
    input.clear(); key('keydown', true); expect(input.takeKey('KeyT')).toBe(false);
    key('keyup'); key('keydown'); expect(input.takeKey('KeyT')).toBe(true);
    doc.pointerLockElement = null as unknown as HTMLCanvasElement;
    input.clear(); key('keydown'); expect(input.takeKey('KeyT')).toBe(false);
  } finally { input.dispose(); vi.unstubAllGlobals(); }
});
