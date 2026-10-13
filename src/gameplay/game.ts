import { Group, Vector3 } from 'three';
import { GameRenderer } from '../core/renderer';
import { GameInput } from '../core/input';
import { GameAudio } from '../core/audio';
import { EventBus } from '../core/events';
import { cityDefinition } from '../content/maps/city';
import type { MapDefinition, MapWorld } from '../content/maps/types';
import { getMechaDefinition } from '../content/mechas';
import { WEAPON_DEFINITIONS } from '../content/weapons';
import { GameUI, type Screen, type EnemyMarker, type SortieMode } from '../ui/ui';
import { Actor } from './actor';
import { Mission } from './mission';
import { ThirdPersonCamera } from './camera';
import { stepPlayerMovement } from './movement';
import { stepEnemy } from './ai';
import { firstSegmentHit, meleeCanHit } from './combat';
import { separateActors } from './spatial';
import { Effects } from './effects';
import { ProjectileSystem } from './projectiles';

export class Game {
  readonly graphics: GameRenderer;
  readonly input: GameInput;
  readonly audio = new GameAudio();
  readonly bus = new EventBus();
  readonly ui: GameUI;
  readonly camera: ThirdPersonCamera;
  readonly mission: Mission;
  private world?: MapWorld;
  private effects = new Effects();
  private projectiles = new ProjectileSystem();
  private player?: Actor;
  private enemies: Actor[] = [];
  private exhibit: Actor[] = [];
  private mode: Screen = 'loading';
  private simulationTime = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private frameHandle = 0;
  private hudTime = 0;
  private fpsTime = 0;
  private frames = 0;
  private fps = 60;
  private galleryRotation = 0;
  private galleryWeapon = false;
  private selectedPreview = 'gundam';
  private selectedPlayer: 'gundam' | 'gm' = 'gundam';
  private selectedSortieMode: SortieMode = 'standard';
  private stepSoundTime = 0;
  private boostSoundTime = 0;
  private ended = false;
  private disposed = false;
  private loadGeneration = 0;
  private preferences = readPreferences();
  private best = Number(readStorage('sd-city-best') ?? 0);
  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, readonly map: MapDefinition = cityDefinition) {
    this.graphics = new GameRenderer(canvas);
    this.input = new GameInput(canvas); this.ui = new GameUI(uiRoot);
    this.camera = new ThirdPersonCamera(this.graphics.camera); this.mission = new Mission(this.map.waves);
    this.graphics.scene.add(this.effects.root, this.projectiles.root);
    this.graphics.setQuality(this.preferences.quality); this.audio.muted = this.preferences.muted;
    this.input.onUnlock = () => { if (this.mode === 'playing') this.pause(); };
    this.ui.onAction = action => { void this.action(action); };
    this.ui.onSetting = (name, value) => {
      if (name === 'pilot' && (value === 'gundam' || value === 'gm')) { this.selectedPlayer = value; this.showMenu(); return; }
      if (name === 'sortie-mode' && (value === 'standard' || value === 'unlimited')) {
        this.selectedSortieMode = value; this.ui.setSortieMode(value); return;
      }
      if (name === 'quality') { this.preferences.quality = value === 'low' ? 'low' : 'medium'; this.graphics.setQuality(this.preferences.quality); }
      if (name === 'muted') { this.preferences.muted = Boolean(value); this.audio.muted = Boolean(value); }
      writeStorage('sd-city-settings', JSON.stringify(this.preferences));
    };
    this.bus.on('shot', event => {
      const sound = event.weapon === 'beam-rifle' || event.weapon === 'beam-spray-gun' ? 'beam' : event.weapon === 'beam-saber' ? 'saber' : event.weapon === 'heat-hawk' ? 'axe' : 'machinegun';
      this.audio.play(sound, event.ownerId === 'player' ? 0.48 : 0.12, 0.95 + Math.random() * 0.1);
    });
    this.bus.on('wave', event => { this.ui.wave(event.index, event.title); this.audio.play('wave', 0.28); });
    this.bus.on('damaged', event => {
      const screen = new Vector3(event.x, event.y, event.z).project(this.graphics.camera);
      this.ui.damaged((screen.x * 0.5 + 0.5) * 100, (-screen.y * 0.5 + 0.5) * 100, event.damage, event.targetId === 'player');
      this.audio.play('impact', event.targetId === 'player' ? 0.22 : 0.14);
    });
    this.bus.on('defeated', () => this.audio.play('explosion', 0.33));
  }
  async load(): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.loadGeneration;
    this.show('loading');
    try {
      const audioLoad = this.audio.load();
      // Consume both operations even on failure to avoid an unhandled rejection.
      const results = await Promise.allSettled([this.map.createWorld(message => {
        if (!this.disposed && generation === this.loadGeneration) this.ui.loading(message);
      }), audioLoad]);
      const mapResult = results[0], audioResult = results[1];
      if (this.disposed || generation !== this.loadGeneration) {
        if (mapResult.status === 'fulfilled') mapResult.value.dispose();
        return;
      }
      if (mapResult.status === 'rejected') throw mapResult.reason;
      if (audioResult.status === 'rejected') { mapResult.value.dispose(); throw audioResult.reason; }
      this.world?.root.removeFromParent(); this.world?.dispose();
      this.world = mapResult.value; this.graphics.scene.add(this.world.root);
      this.ui.loading('检查机体关节与武器系统…');
      this.showMenu();
      if (!this.frameHandle) this.frameHandle = requestAnimationFrame(this.frame);
    } catch (error) {
      if (!this.disposed && generation === this.loadGeneration) this.show('error', { message: error instanceof Error ? error.message : String(error) });
    }
  }
  private show(screen: Screen, data: Parameters<GameUI['show']>[1] = {}): void {
    this.mode = screen; this.ui.show(screen, data); this.ui.syncSettings(this.preferences.quality, this.preferences.muted);
  }
  private async action(action: string): Promise<void> {
    if (action === 'start' || action === 'restart') return this.start();
    if (action === 'resume') return this.resume();
    if (action === 'retry') return this.load();
    if (action === 'menu') { this.mode = 'menu'; this.input.unlock(); this.audio.stop(); this.showMenu(); return; }
    if (action === 'gallery') { this.show('gallery'); this.ui.selectPreview(this.selectedPreview); this.galleryRotation = 0; this.layoutExhibit(); return; }
    if (action === 'sortie' && (this.selectedPreview === 'gundam' || this.selectedPreview === 'gm')) {
      this.selectedPlayer = this.selectedPreview;
      return this.start();
    }
    if (action === 'rotate') this.galleryRotation += Math.PI / 6;
    if (action === 'preview-weapon') {
      this.galleryWeapon = !this.galleryWeapon;
      this.exhibit.forEach(actor => actor.setWeapon(this.galleryWeapon ? 'melee' : 'ranged'));
    }
    if (action.startsWith('inspect-')) {
      this.selectedPreview = action.slice(8);
      this.ui.selectPreview(this.selectedPreview);
    }
  }
  private clearActors(): void {
    this.enemies.forEach(actor => actor.dispose()); this.enemies = [];
    this.exhibit.forEach(actor => actor.dispose()); this.exhibit = [];
    this.player?.dispose(); this.player = undefined;
    this.projectiles.clear(); this.effects.clear(); this.ui.clear();
  }
  private showMenu(): void {
    this.clearActors(); this.ended = false; this.accumulator = 0; this.galleryWeapon = false; this.galleryRotation = 0; this.selectedPreview = this.selectedPlayer;
    this.ui.setPilot(this.selectedPlayer);
    this.ui.setSortieMode(this.selectedSortieMode);
    for (const id of ['gundam', 'gm', 'zaku', 'char-zaku']) {
      const actor = new Actor('preview-' + id, getMechaDefinition(id), id === 'gundam' || id === 'gm' ? 'player' : 'enemy');
      this.exhibit.push(actor); this.graphics.scene.add(actor.rig.root);
    }
    this.show('menu'); this.layoutExhibit(); this.updateExhibit(0);
  }
  private layoutExhibit(): void {
    const spawn = this.map.playerSpawn;
    this.exhibit.forEach((actor, index) => {
      const gallery = this.mode === 'gallery';
      const hero = actor.definition.id === this.selectedPlayer;
      const backdropX = actor.definition.id === 'zaku' ? 8 : actor.definition.id === 'char-zaku' ? -13 : -6;
      actor.position.set(spawn.x + (gallery ? (index - 1.5) * 8.2 : hero ? 0 : backdropX),
        0, spawn.z + (gallery || hero ? 0 : -8));
      actor.yaw = Math.PI + (gallery ? 0.12 : -0.15);
    });
  }
  private updateExhibit(dt: number): void {
    this.layoutExhibit();
    this.exhibit.forEach(actor => {
      actor.yaw += this.galleryRotation;
      if (this.mode === 'gallery' && actor.definition.id === this.selectedPreview) actor.yaw += Math.sin(this.simulationTime * 0.4) * 0.05;
      actor.updateVisual(this.simulationTime, false);
    });
    const spawn = this.map.playerSpawn, gallery = this.mode === 'gallery';
    this.graphics.camera.position.set(gallery ? 4 : 13, gallery ? 11.6 : 8.2, spawn.z + (gallery ? 30 : 18.8));
    this.graphics.camera.fov = gallery ? 50 : 47; this.graphics.camera.updateProjectionMatrix();
    this.graphics.camera.lookAt(gallery ? 0 : -2.8, gallery ? 2.5 : 3.1, spawn.z - (gallery ? 0 : 0.5));
    this.graphics.followSun(new Vector3(0, 0, spawn.z));
  }
  private async start(): Promise<void> {
    if (!this.world) return;
    this.clearActors(); this.ended = false; this.accumulator = 0; this.simulationTime = 0;
    this.player = new Actor('player', getMechaDefinition(this.selectedPlayer), 'player');
    this.ui.setPilot(this.selectedPlayer);
    this.player.position.set(this.map.playerSpawn.x, 0, this.map.playerSpawn.z);
    this.graphics.scene.add(this.player.rig.root); this.camera.yaw = 0; this.camera.pitch = 0.1;
    this.mission.start(); this.spawnWave(); this.player.updateVisual(0, false);
    this.camera.update(this.player.position, false, this.world.colliders, 1 / 60, true);
    try {
      // An unavailable/suspended sound device must not hold the game in its menu.
      void this.audio.unlock().catch(() => {});
      await this.input.lock();
      if (this.disposed) return;
      if (!this.input.locked) throw new Error('请点击继续作战以启用鼠标瞄准。');
      this.show('playing'); this.bus.emit('wave', { index: 0, title: this.map.waves[0].title });
    } catch {
      this.show('paused', { message: '浏览器尚未启用鼠标瞄准，请点击「继续作战」。建议在 Chrome 或 Edge 打开。' });
    }
  }
  private async resume(): Promise<void> {
    if (!this.player || !this.world) return;
    try {
      void this.audio.unlock().catch(() => {});
      await this.input.lock();
      if (this.disposed) return;
      if (!this.input.locked) throw new Error('Mouse lock denied');
      this.accumulator = 0; this.show('playing');
    } catch { this.show('paused', { message: '鼠标瞄准未启用。请允许浏览器捕获鼠标后重试。' }); }
  }
  private pause(): void { this.mode = 'paused'; this.input.clear(); this.input.unlock(); this.audio.stop(); this.accumulator = 0; this.show('paused'); }
  private spawnWave(): void {
    if (!this.player) return;
    this.mission.waveChanged = false;
    const available = this.map.enemySpawns.filter(p => Math.hypot(p.x - this.player!.position.x, p.z - this.player!.position.z) > 24);
    const spawns = available.length >= this.map.waves[this.mission.waveIndex].enemies.length ? available : [...this.map.enemySpawns].sort((a, b) =>
      Math.hypot(b.x - this.player!.position.x, b.z - this.player!.position.z) - Math.hypot(a.x - this.player!.position.x, a.z - this.player!.position.z));
    this.map.waves[this.mission.waveIndex].enemies.forEach((id, index) => {
      const spawn = spawns[(index + this.mission.waveIndex * 2) % spawns.length];
      const actor = new Actor('enemy-' + this.mission.waveIndex + '-' + index, getMechaDefinition(id), 'enemy');
      actor.position.set(spawn.x, 0, spawn.z); actor.aiStrafe = index % 2 === 0 ? 1 : -1;
      actor.aiFireTimer = 1.6 + index * 0.18; actor.aiTimer = index * 0.12;
      actor.aiFlightDelay = 1 + index * 0.7;
      this.enemies.push(actor); this.graphics.scene.add(actor.rig.root); actor.updateVisual(this.simulationTime, false);
      this.effects.burst(actor.position.clone().add(new Vector3(0, 1, 0)), 0xacd4c8, 8, 0.25, true);
    });
  }
  private firePlayer(): void {
    const player = this.player!;
    if (!this.input.firing) return;
    if (player.slot === 'melee') {
      if (player.swing.start()) this.bus.emit('shot', { ownerId: player.id, weapon: player.definition.meleeWeapon });
      return;
    }
    if (!player.rifle.fire()) return;
    const weapon = WEAPON_DEFINITIONS[player.definition.rangedWeapon];
    const direction = this.graphics.camera.getWorldDirection(new Vector3());
    const far = this.graphics.camera.position.clone().addScaledVector(direction, weapon.range);
    const hit = firstSegmentHit(this.graphics.camera.position, far, this.world!.colliders, this.enemies.filter(a => !a.dead).map(a => a.hitBody()));
    const target = hit ? new Vector3(hit.point.x, hit.point.y, hit.point.z) : far;
    const origin = player.rig.muzzle.getWorldPosition(new Vector3());
    this.projectiles.fire(player, origin, target.sub(origin).normalize(), weapon);
    this.effects.burst(origin, weapon.color, 4, 0.15);
    this.bus.emit('shot', { ownerId: player.id, weapon: weapon.id });
  }
  private fireEnemy(enemy: Actor): void {
    const player = this.player!, weapon = WEAPON_DEFINITIONS[enemy.definition.rangedWeapon];
    if (enemy.aiAmmo <= 0) { enemy.aiAmmo = weapon.magazine ?? 12; enemy.aiReload = weapon.reloadTime ?? 2.3; return; }
    enemy.aiAmmo--; enemy.aiFireTimer = weapon.cooldown;
    const origin = enemy.rig.muzzle.getWorldPosition(new Vector3());
    const target = player.position.clone().add(new Vector3((Math.random() - 0.5) * 5, 2.7 + Math.random() * 1.9, (Math.random() - 0.5) * 5));
    this.projectiles.fire(enemy, origin, target.sub(origin).normalize(), weapon);
    this.effects.burst(origin, weapon.color, 2, 0.09); this.bus.emit('shot', { ownerId: enemy.id, weapon: weapon.id });
  }
  private damage(actor: Actor, amount: number, position: Vector3): void {
    if (actor.dead || this.mode !== 'playing') return;
    actor.health = Math.max(0, actor.health - amount); actor.hurt = 1;
    this.bus.emit('damaged', { targetId: actor.id, damage: amount, x: position.x, y: position.y, z: position.z });
    if (actor.health > 0) return;
    actor.dead = true; actor.rig.root.visible = false;
    const explosion = actor.position.clone().add(new Vector3(0, 2.8, 0));
    this.effects.burst(explosion, 0xffb771, 40, 1.25); this.effects.burst(explosion, 0x566470, 16, 0.35, true);
    this.bus.emit('defeated', { targetId: actor.id, elite: actor.definition.id === 'char-zaku' });
    if (actor.team === 'enemy') this.mission.enemyDefeated(); else this.mission.defeat();
  }
  private melee(attacker: Actor, targets: Actor[]): void {
    if (!attacker.swing.active) return;
    const weapon = WEAPON_DEFINITIONS[attacker.definition.meleeWeapon];
    this.effects.trail(attacker.rig.bladeTip.getWorldPosition(new Vector3()), weapon.color);
    for (const target of targets) {
      if (target.dead) continue;
      if (meleeCanHit({ x: attacker.position.x, y: attacker.position.y, z: attacker.position.z, yaw: attacker.yaw, pitch: attacker.aimPitch, height: attacker.definition.height },
        { x: target.position.x, y: target.position.y, z: target.position.z, height: target.definition.height }, weapon.range, this.world!.colliders) && attacker.swing.hit(target.id)) {
        const position = target.position.clone().add(new Vector3(0, 3, 0));
        this.effects.burst(position, weapon.color, 16, 0.6); this.damage(target, weapon.damage, position);
      }
    }
  }
  private simulation(dt: number): void {
    const player = this.player!, walls = this.world!.colliders;
    this.simulationTime += dt; player.tick(dt);
    if (this.input.takeKey('Digit1')) player.setWeapon('ranged');
    if (this.input.takeKey('Digit2')) player.setWeapon('melee');
    stepPlayerMovement(player, { x: Number(this.input.keys.has('KeyD')) - Number(this.input.keys.has('KeyA')),
      z: Number(this.input.keys.has('KeyW')) - Number(this.input.keys.has('KeyS')), yaw: this.camera.yaw,
      pitch: this.camera.pitch, toggleFlight: this.input.takeKey('KeyF'),
      lift: Number(this.input.keys.has('Space')) - Number(this.input.keys.has('ControlLeft') || this.input.keys.has('ControlRight')),
      boost: this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight'), jump: this.input.takeKey('Space'),
      unlimitedEnergy: this.selectedSortieMode === 'unlimited' }, dt, walls, this.map.bounds);
    player.yaw = this.camera.yaw; player.aimPitch = this.camera.pitch;
    const enemyActions: { enemy: Actor; fire: boolean; slash: boolean }[] = [];
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.tick(dt);
      const action = stepEnemy(enemy, player, dt, this.simulationTime, walls, this.map.bounds, this.selectedSortieMode === 'unlimited');
      enemyActions.push({ enemy, ...action });
    }
    const alive = [player, ...this.enemies].filter(a => !a.dead);
    separateActors(alive, walls, this.map.bounds);
    for (const actor of alive) actor.updateVisual(this.simulationTime, actor === player ? this.input.aiming : true);
    this.camera.update(player.position, this.input.aiming, walls, dt, false, player.flying && player.boosting);
    this.firePlayer(); this.melee(player, this.enemies);
    for (const { enemy, fire, slash } of enemyActions) {
      if (enemy.dead) continue;
      if (fire) this.fireEnemy(enemy);
      if (slash) this.bus.emit('shot', { ownerId: enemy.id, weapon: enemy.definition.meleeWeapon });
      this.melee(enemy, [player]);
    }
    this.projectiles.update(dt, alive, walls, (position, amount, target) => {
      this.effects.burst(position, target ? 0xffd38c : 0xbcc9c5, target ? 10 : 6, 0.45);
      if (target) this.damage(target, amount, position);
    });
    this.effects.update(dt);
    this.enemies = this.enemies.filter(enemy => { if (!enemy.dead) return true; enemy.dispose(); return false; });
    this.mission.update(dt);
    if (this.mission.waveChanged) { this.spawnWave(); this.bus.emit('wave', { index: this.mission.waveIndex, title: this.map.waves[this.mission.waveIndex].title }); }
    this.stepSoundTime -= dt; this.boostSoundTime -= dt;
    if ((player.boosting || player.flying) && this.boostSoundTime <= 0) { this.audio.play('boost', player.boosting ? 0.12 : 0.035, player.boosting ? 1 : 0.8); this.boostSoundTime = 0.6; }
    else if (player.speed > 2 && player.grounded && this.stepSoundTime <= 0) { this.audio.play('step', 0.08, 0.85); this.stepSoundTime = 0.42; }
    if (this.mission.status === 'victory' || this.mission.status === 'defeat') this.finish();
  }
  private finish(): void {
    if (this.ended) return; this.ended = true;
    const score = this.mission.kills * 100 + (this.mission.status === 'victory' ? 1500 + Math.ceil(this.player!.health) : 0);
    this.best = Math.max(this.best, score); writeStorage('sd-city-best', String(this.best));
    this.mode = this.mission.status === 'victory' ? 'victory' : 'defeat'; this.input.unlock(); this.input.clear();
    this.show(this.mode, { kills: this.mission.kills, elapsed: this.mission.elapsed, score, best: this.best });
  }
  private updateHud(): void {
    if (!this.player) return;
    const player = this.player;
    this.ui.update({ health: player.health, maxHealth: player.definition.maxHealth, energy: player.energy, heat: player.rifle.heat,
      overheated: player.rifle.overheated, weapon: WEAPON_DEFINITIONS[player.slot === 'ranged' ? player.definition.rangedWeapon : player.definition.meleeWeapon].name,
      melee: player.slot === 'melee', wave: this.mission.waveIndex + 1, remaining: this.mission.remaining, kills: this.mission.kills,
      elapsed: this.mission.elapsed, intermission: this.mission.intermission, fps: this.fps, reloading: player.swing.running,
      flightState: player.flightState, altitude: player.altitude, flightDenied: player.flightNotice > 0, sortieMode: this.selectedSortieMode });
    const markers: EnemyMarker[] = [];
    for (const enemy of this.enemies) {
      if (enemy.position.distanceTo(player.position) > 105) continue;
      const position = enemy.position.clone().add(new Vector3(0, enemy.definition.height + 0.8, 0)).project(this.graphics.camera);
      if (position.z < -1 || position.z > 1 || Math.abs(position.x) > 1 || Math.abs(position.y) > 1) continue;
      if (firstSegmentHit(this.graphics.camera.position, enemy.position.clone().add(new Vector3(0, 4, 0)), this.world!.colliders, [])) continue;
      markers.push({ id: enemy.id, x: (position.x * 0.5 + 0.5) * 100, y: (-position.y * 0.5 + 0.5) * 100,
        health: enemy.health / enemy.definition.maxHealth, name: enemy.definition.id === 'char-zaku' ? 'CHAR / 夏亚专用' : 'ZAKU II', elite: enemy.definition.id === 'char-zaku' });
    }
    this.ui.markers(markers); this.ui.drawRadar({ x: player.position.x, z: player.position.z, yaw: player.yaw }, this.enemies.map(e => ({ x: e.position.x, z: e.position.z, elite: e.definition.id === 'char-zaku' })));
  }
  private frame = (now: number): void => {
    if (this.disposed) return;
    const elapsed = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    const dt = Math.min(0.1, elapsed); this.lastFrame = now;
    this.frames++; this.fpsTime += elapsed;
    if (this.fpsTime >= 0.8) { this.fps = Math.round(this.frames / this.fpsTime); this.frames = 0; this.fpsTime = 0; }
    if (this.mode === 'playing') {
      this.camera.yaw -= this.input.mouseX * 0.0021; this.camera.pitch = Math.max(-1.25, Math.min(1.25, this.camera.pitch + this.input.mouseY * 0.0017));
      this.input.mouseX = this.input.mouseY = 0;
      this.accumulator += dt;
      while (this.accumulator >= 1 / 60 && this.mode === 'playing') { this.simulation(1 / 60); this.accumulator -= 1 / 60; }
      this.hudTime += dt; if (this.hudTime >= 0.08) { this.hudTime = 0; this.updateHud(); }
      if (this.player) this.graphics.followSun(this.player.position);
    } else if (this.mode === 'menu' || this.mode === 'gallery') {
      this.simulationTime += dt; this.updateExhibit(dt);
    } else if (this.mode === 'victory' || this.mode === 'defeat') this.effects.update(dt);
    this.ui.animate(dt); this.graphics.render(); this.frameHandle = requestAnimationFrame(this.frame);
  };
  // Read-only diagnostics are opt-in for maintainers; controls always use real input.
  inspect() {
    return { screen: this.mode, locked: this.input.locked, quality: this.graphics.quality, fps: this.fps, audio: this.audio.state,
      renderer: { calls: this.graphics.renderer.info.render.calls, triangles: this.graphics.renderer.info.render.triangles, geometries: this.graphics.renderer.info.memory.geometries, textures: this.graphics.renderer.info.memory.textures },
      mission: { status: this.mission.status, wave: this.mission.waveIndex + 1, remaining: this.mission.remaining, kills: this.mission.kills, elapsed: this.mission.elapsed },
      player: this.player ? { type: this.player.definition.id, x: this.player.position.x, y: this.player.position.y, z: this.player.position.z, health: this.player.health, energy: this.player.energy, slot: this.player.slot, yaw: this.player.yaw, heat: this.player.rifle.heat,
        flightState: this.player.flightState, velocity: this.player.velocity.toArray(), altitude: this.player.altitude } : null,
      camera: { x: this.graphics.camera.position.x, y: this.graphics.camera.position.y, z: this.graphics.camera.position.z, yaw: this.camera.yaw, pitch: this.camera.pitch },
      enemies: this.enemies.map(e => { const s = e.position.clone().add(new Vector3(0, 3.5, 0)).project(this.graphics.camera); return { id: e.id, type: e.definition.id, x: e.position.x, y: e.position.y, z: e.position.z, energy: e.energy, flightState: e.flightState, health: e.health, screenX: (s.x * 0.5 + 0.5) * innerWidth, screenY: (-s.y * 0.5 + 0.5) * innerHeight, visible: s.z >= -1 && s.z <= 1 }; }) };
  }
  dispose(): void {
    this.disposed = true; this.loadGeneration++; cancelAnimationFrame(this.frameHandle); this.input.dispose(); this.audio.dispose(); this.clearActors();
    this.world?.dispose(); this.effects.dispose(); this.projectiles.dispose(); this.bus.clear(); this.graphics.dispose();
  }
}

function readStorage(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function writeStorage(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* Private browsing can deny local storage. */ } }
function readPreferences(): { quality: 'low' | 'medium'; muted: boolean } {
  try {
    const value = JSON.parse(readStorage('sd-city-settings') ?? '{}');
    return { quality: value.quality === 'low' ? 'low' : 'medium', muted: value.muted === true };
  } catch { return { quality: 'medium', muted: false }; }
}
