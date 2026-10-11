import { Game } from './gameplay/game';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ui = document.querySelector<HTMLElement>('#ui')!;
try {
  const game = new Game(canvas, ui);
  if (new URLSearchParams(location.search).has('debug')) Object.defineProperty(window, 'sdDiagnostics', { value: () => game.inspect(), configurable: true });
  window.addEventListener('pagehide', () => game.dispose(), { once: true });
  void game.load();
} catch (error) {
  ui.innerHTML = '<div style="position:absolute;inset:0;background:#142a35;color:#eef9f4;display:grid;place-content:center;padding:30px;font-family:Microsoft YaHei,sans-serif"><h1>无法启动 3D 场景</h1><p id="startup-error"></p><p>请使用 Chrome 或 Edge，并开启浏览器的图形加速。</p></div>';
  ui.querySelector('#startup-error')!.textContent = error instanceof Error ? error.message : String(error);
}
