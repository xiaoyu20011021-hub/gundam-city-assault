import './style.css';

export type Screen = 'loading' | 'menu' | 'gallery' | 'playing' | 'paused' | 'victory' | 'defeat' | 'error';
export type SortieMode = 'standard' | 'unlimited';
export interface HudState {
  health: number; maxHealth: number; energy: number; heat: number; overheated: boolean;
  weapon: string; melee: boolean; wave: number; remaining: number; kills: number; elapsed: number;
  intermission: number; fps: number; reloading: boolean;
  flightState: 'grounded' | 'takeoff' | 'hover' | 'flight' | 'boost' | 'descent' | 'jump';
  altitude: number; flightDenied: boolean; sortieMode: SortieMode;
}
export interface EnemyMarker { id: string; x: number; y: number; health: number; name: string; elite: boolean }
export interface RadarDot { x: number; z: number; elite: boolean }

export class GameUI {
  screen: Screen = 'loading';
  private pilot: 'gundam' | 'gm' = 'gundam';
  private sortieMode: SortieMode = 'standard';
  onAction?: (action: string) => void;
  onSetting?: (name: string, value: string | boolean) => void;
  private root: HTMLElement;
  private overlay: HTMLElement;
  private hud: HTMLElement;
  private radar: HTMLCanvasElement;
  private elements = new Map<string, HTMLElement>();
  private floating: { node: HTMLElement; remaining: number }[] = [];
  private hitTime = 0;
  private flashTime = 0;
  private bannerTime = 0;
  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="screen-grain" aria-hidden="true"></div>
      <div id="hurt-vignette" aria-hidden="true"></div>
      <div class="brand-lockup"><span class="brand-square">SD</span><span>GUNDAM<span class="brand-sub">CITY SORTIE</span></span></div>
      <div class="system-meta">U.C. 0079 <span>／</span> SIDE 7</div>
      <main id="overlay"></main>
      <section id="hud" hidden aria-label="战斗状态">
        <div class="mission-strip"><span class="live-dot"></span><span>城市作战</span><i></i><span id="wave-label">WAVE 01 / 03</span></div>
        <div class="battle-top"><div class="battle-counter"><span>敌机剩余</span><strong id="remaining">04</strong></div><span id="timer">00:00</span></div>
        <div id="reticle" aria-hidden="true"><b></b><b></b><b></b><b></b><span></span><em id="hitmarker">×</em></div>
        <div id="markers"></div><div id="floating-damage"></div>
        <div class="flight-status" id="flight-status"><span class="micro-label" id="flight-system-label">FLIGHT SYSTEM</span><div><strong id="flight-state">地面</strong><span>离地 <b id="altitude">0.0</b> m</span></div><small id="flight-hint">F 起飞 · 松开方向键悬停</small></div>
        <div class="pilot-status"><span class="micro-label" id="pilot-name">RX-78-2 <span>GUNDAM</span></span><div class="health-numbers"><strong id="health">1000</strong><span id="max-health">/ 1000</span><span class="status-caption">机体耐久</span></div><div class="status-track"><i id="health-fill"></i></div><div class="boost-row"><span>推进能量</span><div class="boost-track"><i id="boost-fill"></i></div><b id="energy">100</b></div></div>
        <div class="weapon-status"><span class="micro-label">WEAPON SYSTEM</span><h3 id="weapon">光束步枪</h3><div class="weapon-details"><span id="weapon-message">ENERGY · READY</span><b id="weapon-slot">01</b></div><div class="heat-track"><i id="heat-fill"></i></div><div class="weapon-keys"><span id="ranged-key" class="selected"><kbd>1</kbd> <span id="ranged-label">步枪</span></span><span id="melee-key"><kbd>2</kbd> 军刀</span></div></div>
        <div class="quick-controls"><span><kbd>F</kbd> 飞行 / 降落</span><span><kbd>W</kbd> 朝准星飞</span><span><kbd>Space</kbd> 跳跃 / 上升</span><span><kbd>Ctrl</kbd> 下降</span><span><kbd>Shift</kbd> 加速</span><span><kbd>Esc</kbd> 暂停</span></div>
        <div class="radar-wrap"><canvas id="radar" width="156" height="156" aria-label="附近敌机雷达"></canvas><span>TACTICAL RADAR</span></div>
        <div id="wave-banner" role="status"></div><div id="toast" role="status"></div>
        <div class="performance"><span id="fps">60 FPS</span><span id="kill-label">击破 00</span></div>
      </section>`;
    this.overlay = root.querySelector('#overlay')!; this.hud = root.querySelector('#hud')!;
    this.radar = root.querySelector('#radar')!;
    root.querySelectorAll<HTMLElement>('[id]').forEach(el => this.elements.set(el.id, el));
    root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (button && !(button instanceof HTMLButtonElement && button.disabled)) this.onAction?.(button.dataset.action!);
    });
    root.addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.setting) this.onSetting?.(input.dataset.setting, input.type === 'checkbox' ? input.checked : input.value);
    });
    this.show('loading');
  }
  private el(id: string): HTMLElement { return this.elements.get(id)!; }
  show(screen: Screen, data: { message?: string; elapsed?: number; kills?: number; health?: number; score?: number; best?: number } = {}): void {
    this.screen = screen; this.root.dataset.screen = screen;
    this.hud.hidden = screen !== 'playing'; this.overlay.hidden = screen === 'playing';
    if (screen === 'playing') { this.overlay.innerHTML = ''; return; }
    const settings = `<div class="settings-inline"><label>画质 <select data-setting="quality" aria-label="画质"><option value="medium">中 · 阴影开启</option><option value="low">低 · 流畅优先</option></select></label><label class="sound-setting"><input type="checkbox" data-setting="muted"/> 静音</label></div>`;
    const controls = `<dl class="controls-list"><div><dt>移动 / W 朝准星飞</dt><dd><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dd></div><div><dt>飞行 / 降落</dt><dd><kbd>F</kbd></dd></div><div><dt>跳跃、上升 / 下降</dt><dd><kbd>Space</kbd><kbd>Ctrl</kbd></dd></div><div><dt>加速 / 松键悬停</dt><dd><kbd>Shift</kbd></dd></div><div><dt>攻击 / 瞄准</dt><dd><kbd>左键</kbd><kbd>右键</kbd></dd></div><div><dt>切换武器</dt><dd><kbd>1</kbd><kbd>2</kbd></dd></div></dl>`;
    if (screen === 'loading') this.overlay.innerHTML = `<div class="loading-screen"><div class="loading-mark">SD<span>＋</span></div><span class="micro-label">SYSTEM INITIALIZING</span><h2>准备出击</h2><p id="loading-message">载入城市与机体资源…</p><div class="loading-track"><i></i></div></div>`;
    const gm = this.pilot === 'gm';
    const pilotSelect = `<label class="pilot-select">出击机体<select data-setting="pilot" aria-label="出击机体"><option value="gundam" ${gm ? '' : 'selected'}>RX-78-2 高达</option><option value="gm" ${gm ? 'selected' : ''}>RGM-79 吉姆</option></select></label>`;
    const modeSelect = `<label class="pilot-select">作战模式<select data-setting="sortie-mode" aria-label="作战模式"><option value="standard" ${this.sortieMode === 'standard' ? 'selected' : ''}>标准模式</option><option value="unlimited" ${this.sortieMode === 'unlimited' ? 'selected' : ''}>无限推进（机动不耗能）</option></select></label>`;
    if (screen === 'menu') this.overlay.innerHTML = `<div class="menu-content"><div class="eyebrow"><span></span> OPERATION 01 · 城市战斗</div><h1>城市<span>突入<span class="title-period">.</span></span></h1><p class="menu-description">驾驶经典机体，穿越城市街区。<br>驾驶高达或吉姆，迎击来袭的扎古。</p><div class="sortie-details"><span>单人作战</span><i></i><span>三波敌机</span><i></i><span>第三人称</span></div>${pilotSelect}${modeSelect}<button class="primary-button" data-action="start"><span>开始作战</span><span>↗</span></button><button class="secondary-button" data-action="gallery"><span>机体整备库</span><span>04 <b>→</b></span></button>${settings}<p class="desktop-note">电脑键鼠操作 · 点击出击后鼠标进入瞄准模式</p></div><div class="hero-caption"><span class="hero-line"></span><span class="micro-label">联邦军 · ${gm ? '量产机' : '原型机'}</span><h2>${gm ? 'RGM-79' : 'RX-78-2'}<span>${gm ? 'GM' : 'GUNDAM'}</span></h2><p>${gm ? '光束喷枪' : '光束步枪'} ／ 光束军刀</p></div><div class="menu-footer"><span>SD GUNDAM / CITY SORTIE</span><span>本地单人体验 <b>v1.0</b></span></div>`;
    if (screen === 'gallery') this.overlay.innerHTML = `<div class="gallery-header"><span class="micro-label">MOBILE SUIT ARCHIVE</span><h1>机体整备库<span>04</span></h1><p>选择机体 · 旋转检视 · 联邦机体可出击</p></div><div class="gallery-cards"><button data-action="inspect-gundam" class="archive-card active"><span>01 / EARTH FEDERATION</span><h3>RX-78-2 高达</h3><p>光束步枪 · 光束军刀</p><b>可驾驶</b></button><button data-action="inspect-gm" class="archive-card"><span>02 / EARTH FEDERATION</span><h3>RGM-79 吉姆</h3><p>光束喷枪 · 单军刀背包 · 绿色面罩</p><b>可驾驶</b></button><button data-action="inspect-zaku" class="archive-card"><span>03 / PRINCIPALITY OF ZEON</span><h3>MS-06F 扎古 II</h3><p>120mm 机枪 · 热能斧</p><b>普通敌机</b></button><button data-action="inspect-char-zaku" class="archive-card char-card"><span>04 / CHAR AZNABLE</span><h3>MS-06S 夏亚专用</h3><p>指挥官角 · 红色涂装 · 精英机动</p><b>精英敌机</b></button></div><div class="gallery-actions"><button class="secondary-button" data-action="menu">← 返回作战准备</button><button class="secondary-button" data-action="rotate">旋转机体 ↻</button><button class="secondary-button" data-action="preview-weapon">切换展示武器 ⇄</button><button class="secondary-button sortie-button" data-action="sortie">驾驶高达出击 ↗</button></div>`;
    if (screen === 'paused') this.overlay.innerHTML = `<div class="modal-scrim"></div><div class="pause-panel"><span class="micro-label">SYSTEM STANDBY</span><h1>作战暂停<span>Ⅱ</span></h1><p class="panel-subtitle">${data.message || '喘口气，准备下一次推进。'}</p><button class="primary-button" data-action="resume"><span>继续作战</span><span>→</span></button><button class="secondary-button" data-action="restart">重新出击 ↻</button><button class="text-button" data-action="menu">返回作战准备</button>${controls}${settings}</div>`;
    if (screen === 'victory' || screen === 'defeat') this.overlay.innerHTML = `<div class="modal-scrim"></div><div class="result-panel ${screen}"><span class="micro-label">${screen === 'victory' ? 'MISSION COMPLETE' : 'MISSION FAILED'}</span><h1>${screen === 'victory' ? '作战成功' : '机体失去响应'}<span>${screen === 'victory' ? '↗' : '／'}</span></h1><p>${screen === 'victory' ? '城市区域已肃清。欢迎返航，驾驶员。' : '重新整备机体，再次挑战城市战场。'}</p><div class="result-stats"><div><span>击破敌机</span><strong>${data.kills ?? 0}<small> / 15</small></strong></div><div><span>作战时间</span><strong>${formatTime(data.elapsed ?? 0)}</strong></div><div><span>作战积分</span><strong>${data.score ?? 0}</strong></div></div><div class="best-score">本地最佳 <b>${data.best ?? 0}</b></div><button class="primary-button" data-action="restart"><span>再次出击</span><span>↗</span></button><button class="text-button" data-action="menu">返回作战准备</button></div>`;
    if (screen === 'error') this.overlay.innerHTML = `<div class="modal-scrim"></div><div class="pause-panel"><span class="micro-label">LOAD INTERRUPTED</span><h1>资源载入中断</h1><p class="panel-subtitle" id="error-message"></p><button class="primary-button" data-action="retry"><span>重新载入</span><span>↻</span></button><p class="desktop-note">请通过启动脚本或本地 HTTP 服务打开游戏。</p></div>`;
    if (screen === 'error') this.overlay.querySelector('#error-message')!.textContent = data.message ?? '请刷新后重试。';
  }
  setPilot(id: 'gundam' | 'gm'): void {
    this.pilot = id;
    this.el('pilot-name').textContent = id === 'gm' ? 'RGM-79 / GM' : 'RX-78-2 / GUNDAM';
    this.el('ranged-label').textContent = id === 'gm' ? '喷枪' : '步枪';
  }
  setSortieMode(mode: SortieMode): void {
    this.sortieMode = mode;
    const select = this.overlay.querySelector<HTMLSelectElement>('[data-setting="sortie-mode"]');
    if (select) select.value = mode;
  }
  selectPreview(id: string): void {
    this.overlay.querySelectorAll<HTMLElement>('.archive-card').forEach(card => {
      const active = card.dataset.action === 'inspect-' + id;
      card.classList.toggle('active', active); card.setAttribute('aria-pressed', String(active));
    });
    const sortie = this.overlay.querySelector<HTMLButtonElement>('[data-action="sortie"]');
    if (sortie) {
      sortie.disabled = id !== 'gm' && id !== 'gundam';
      sortie.textContent = id === 'gm' ? '驾驶吉姆出击 ↗' : id === 'gundam' ? '驾驶高达出击 ↗' : '敌机 · 仅供检视';
    }
  }
  loading(message: string): void { const node = this.overlay.querySelector('#loading-message'); if (node) node.textContent = message; }
  syncSettings(quality: string, muted: boolean): void {
    const select = this.overlay.querySelector<HTMLSelectElement>('[data-setting="quality"]'); if (select) select.value = quality;
    const checkbox = this.overlay.querySelector<HTMLInputElement>('[data-setting="muted"]'); if (checkbox) checkbox.checked = muted;
  }
  update(data: HudState): void {
    this.el('health').textContent = String(Math.ceil(data.health)); this.el('max-health').textContent = '/ ' + data.maxHealth;
    this.el('health-fill').style.width = Math.max(0, data.health / data.maxHealth * 100) + '%';
    this.el('health-fill').classList.toggle('critical', data.health < data.maxHealth * 0.3);
    this.el('boost-fill').style.width = data.energy + '%'; this.el('energy').textContent = String(Math.round(data.energy));
    this.el('boost-fill').classList.toggle('critical', data.sortieMode === 'standard' && data.energy < 20);
    const states = { grounded: '地面', takeoff: '起飞', hover: '悬停', flight: '飞行', boost: '加速', descent: '降落', jump: '跳跃' };
    this.el('flight-state').textContent = states[data.flightState];
    this.el('altitude').textContent = data.altitude.toFixed(1);
    this.el('flight-system-label').textContent = data.sortieMode === 'unlimited' ? 'UNLIMITED BOOST' : 'FLIGHT SYSTEM';
    this.el('flight-status').classList.toggle('low-energy', data.sortieMode === 'standard' && data.energy < 20);
    this.el('flight-status').classList.toggle('airborne', data.flightState !== 'grounded');
    this.el('flight-hint').textContent = data.sortieMode === 'unlimited' ? '无限推进 · 飞行、冲刺、跳跃不耗能' :
      data.flightDenied ? '能量不足 · 至少 20 才能启动飞行' :
      data.energy <= 0 && data.flightState !== 'grounded' ? '推进耗尽 · 降落后充能' :
      data.energy < 20 ? '能量偏低 · 建议落地充能' :
      data.flightState === 'grounded' ? 'F 起飞 · 松开方向键悬停' :
      data.flightState === 'descent' || data.flightState === 'jump' ? 'F 接管飞行 · 落地自动充能' : '松键悬停 · F 降落 · Space / Ctrl 升降';
    this.el('weapon').textContent = data.weapon; this.el('weapon-slot').textContent = data.melee ? '02' : '01';
    this.el('weapon-message').textContent = data.melee ? (data.reloading ? 'SLASH · RECOVERING' : 'SLASH · READY') : (data.overheated ? 'OVERHEAT · 冷却中' : 'ENERGY · ' + Math.round(data.heat) + '%');
    this.el('heat-fill').style.width = data.melee ? (data.reloading ? '100%' : '0%') : data.heat + '%';
    this.el('heat-fill').classList.toggle('critical', data.overheated);
    this.el('ranged-key').classList.toggle('selected', !data.melee); this.el('melee-key').classList.toggle('selected', data.melee);
    this.el('reticle').classList.toggle('melee', data.melee);
    this.el('remaining').textContent = String(data.remaining).padStart(2, '0');
    this.el('wave-label').textContent = 'WAVE 0' + data.wave + ' / 03';
    this.el('timer').textContent = formatTime(data.elapsed);
    this.el('fps').textContent = data.fps + ' FPS'; this.el('kill-label').textContent = '击破 ' + String(data.kills).padStart(2, '0');
    if (data.intermission > 0) this.el('toast').textContent = '街区肃清 · 下一波 ' + Math.ceil(data.intermission) + ' 秒';
    else this.el('toast').textContent = '';
  }
  markers(markers: EnemyMarker[]): void {
    const container = this.el('markers');
    container.innerHTML = markers.map(m => `<div class="enemy-marker ${m.elite ? 'elite' : ''}" style="left:${m.x}%;top:${m.y}%"><span>${m.name}</span><div><i style="width:${Math.max(0, m.health * 100)}%"></i></div></div>`).join('');
  }
  drawRadar(player: { x: number; z: number; yaw: number }, enemies: RadarDot[]): void {
    const ctx = this.radar.getContext('2d')!; const cx = 78, scale = 0.6;
    ctx.clearRect(0, 0, 156, 156); ctx.strokeStyle = 'rgba(187,217,220,.21)'; ctx.lineWidth = 1;
    for (const radius of [24, 48, 70]) { ctx.beginPath(); ctx.arc(cx, cx, radius, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(8, cx); ctx.lineTo(148, cx); ctx.moveTo(cx, 8); ctx.lineTo(cx, 148); ctx.stroke();
    for (const enemy of enemies) {
      let dx = (enemy.x - player.x) * scale, dz = (enemy.z - player.z) * scale;
      const length = Math.hypot(dx, dz); if (length > 68) { dx *= 68 / length; dz *= 68 / length; }
      ctx.fillStyle = enemy.elite ? '#ff795e' : '#f8bd73'; ctx.beginPath(); ctx.arc(cx + dx, cx + dz, enemy.elite ? 4 : 2.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.translate(cx, cx); ctx.rotate(-player.yaw); ctx.fillStyle = '#9df5db';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4, 5); ctx.lineTo(0, 3); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  wave(index: number, title: string): void {
    const banner = this.el('wave-banner'); banner.innerHTML = `<span>WAVE 0${index + 1}</span><strong>${title}</strong>`; this.bannerTime = 3.4;
  }
  damaged(x: number, y: number, damage: number, player = false): void {
    if (player) { this.flashTime = 0.35; return; }
    this.hitTime = 0.16;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    const node = document.createElement('span'); node.className = 'damage-number'; node.textContent = String(damage);
    node.style.left = x + '%'; node.style.top = y + '%'; this.el('floating-damage').append(node);
    this.floating.push({ node, remaining: 0.65 });
    if (this.floating.length > 24) this.floating.shift()?.node.remove();
  }
  animate(dt: number): void {
    this.hitTime = Math.max(0, this.hitTime - dt); this.el('hitmarker').style.opacity = this.hitTime > 0 ? '1' : '0';
    this.flashTime = Math.max(0, this.flashTime - dt); this.el('hurt-vignette').style.opacity = String(this.flashTime * 2);
    this.bannerTime = Math.max(0, this.bannerTime - dt); this.el('wave-banner').classList.toggle('visible', this.bannerTime > 0 && this.screen === 'playing');
    for (const floating of this.floating) { floating.remaining -= dt; if (floating.remaining <= 0) floating.node.remove(); }
    this.floating = this.floating.filter(f => f.remaining > 0);
  }
  clear(): void { this.floating.forEach(f => f.node.remove()); this.floating = []; this.hitTime = this.flashTime = this.bannerTime = 0; this.el('markers').innerHTML = ''; }
}
export function formatTime(seconds: number): string { return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(Math.floor(seconds % 60)).padStart(2, '0'); }
