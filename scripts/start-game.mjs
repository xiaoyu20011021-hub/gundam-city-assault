import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const openBrowser = url => {
  if (process.argv.includes('--no-open')) return;
  if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' }).unref();
};
async function ourGame(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(600) });
    return response.ok && (await response.text()).includes('SD GUNDAM · 城市突入');
  } catch { return false; }
}
async function freePort(port) {
  return new Promise(resolvePort => {
    const probe = createServer();
    probe.once('error', () => resolvePort(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolvePort(true)));
  });
}
let port = 5173;
if (await ourGame(port)) {
  const url = `http://127.0.0.1:${port}/`;
  console.log('游戏服务已运行：' + url); openBrowser(url);
} else {
  while (!(await freePort(port)) && port < 5193) port++;
  if (port >= 5193) throw new Error('没有可用的本地端口，请关闭旧的游戏启动窗口后重试。');
  const child = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'inherit', windowsHide: true });
  let alive = true;
  child.on('exit', code => { alive = false; process.exitCode = code ?? 0; });
  child.on('error', error => { alive = false; console.error(error.message); process.exitCode = 1; });
  let ready = false;
  for (let attempt = 0; attempt < 40 && alive; attempt++) {
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
    if (await ourGame(port)) { ready = true; break; }
  }
  if (ready) {
    const url = `http://127.0.0.1:${port}/`;
    console.log('\n游戏已准备就绪：' + url + '\n保留此窗口以继续游戏；按 Ctrl+C 关闭服务。'); openBrowser(url);
  } else if (alive) { console.error('游戏启动超时，请查看上面的启动错误。'); child.kill(); process.exitCode = 1; }
  process.on('SIGINT', () => { child.kill(); });
  process.on('SIGTERM', () => { child.kill(); });
}
