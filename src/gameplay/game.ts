import { Group, Vector3 } from 'three';
import { GameRenderer } from '../core/renderer';
import { GameInput } from '../core/input';
import { GameAudio } from '../core/audio';
import { EventBus } from '../core/events';
import { cityDefinition } from '../content/maps/city';
import { isMapId, MAP_DEFINITIONS } from '../content/maps';
import type { MapDefinition, MapWorld, WaveDefinition } from '../content/maps/types';
import { getMechaDefinition, MECHA_DEFINITIONS } from '../content/mechas';
import { isPlayableMecha, type PlayableMechaId } from '../content/mechas/playable';
import { WEAPON_DEFINITIONS } from '../content/weapons';
import { GameUI, type Screen, type EnemyMarker, type SortieMode, type BattleMode } from '../ui/ui';
import { Actor } from './actor';
import { Mission } from './mission';
import { ThirdPersonCamera } from './camera';
import { FirstPersonWeapon, safeFirstPersonOrigin } from './first-person';
import { stepPlayerMovement } from './movement';
import { stepEnemy, enemyAimPoint, type AIMode } from './ai';
import { AI_MODE_KEY, aiBestKey, readAiMode } from './ai-settings';
import { firstSegmentHit, meleeCanHit, type Point3 } from './combat';
import { separateActors } from './spatial';
import { Effects } from './effects';
import { ProjectileSystem } from './projectiles';
import { RemoteWeaponRuntime, isRemoteAirborne } from './remote-weapons/adapter';

const DUEL_WAVES: WaveDefinition[] = [{ title: '赤色彗星 · 一对一', enemies: ['char-zaku'] }];

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
  private remoteWeapons?: RemoteWeaponRuntime;
  private remoteHurtUntil = new Map<string, number>();
  private player?: Actor;
  private firstPersonWeapon?: FirstPersonWeapon;
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
  private selectedPlayer: PlayableMechaId = 'gundam';
  private selectedBattleMode: BattleMode = 'campaign';
  private selectedSortieMode: SortieMode = 'standard';
  private selectedAiMode: AIMode = readAiMode(readStorage);
  private stepSoundTime = 0;
  private boostSoundTime = 0;
  private ended = false;
  private disposed = false;
  private loadGeneration = 0;
  private loadingMap?: MapDefinition;
  private preferences = readPreferences();
  private best = Number(readStorage(bestScoreKey(this.selectedAiMode, this.selectedBattleMode)) ?? 0);
  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, public map: MapDefinition = cityDefinition) {
    this.graphics = new GameRenderer(canvas);
    this.input = new GameInput(canvas); this.ui = new GameUI(uiRoot);
    this.camera = new ThirdPersonCamera(this.graphics.camera); this.mission = new Mission(this.map.waves);
    this.graphics.scene.add(this.effects.root, this.projectiles.root);
    this.graphics.setQuality(this.preferences.quality); this.audio.muted = this.preferences.muted;
    this.input.onUnlock = () => { if (this.mode === 'playing') this.pause(); };
    this.ui.onAction = action => { void this.action(action); };
    this.ui.onSetting = (name, value) => this.setting(name, value);
    this.bus.on('shot', event => {
      const sound = WEAPON_DEFINITIONS[event.weapon]?.visual === 'beam' || event.weapon === 'beam-rifle' || event.weapon === 'beam-spray-gun' ? 'beam' : event.weapon === 'beam-saber' ? 'saber' : event.weapon === 'heat-hawk' ? 'axe' : 'machinegun';
      this.audio.play(sound, event.ownerId === 'player' ? 0.48 : 0.12, 0.95 + Math.random() * 0.1);
    });
    this.bus.on('wave', event => { this.ui.wave(event.index, event.title, this.selectedBattleMode); this.audio.play('wave', 0.28); });
    this.bus.on('damaged', event => {
      const screen = new Vector3(event.x, event.y, event.z).project(this.graphics.camera);
      this.ui.damaged((screen.x * 0.5 + 0.5) * 100, (-screen.y * 0.5 + 0.5) * 100, event.damage, event.targetId === 'player');
      this.audio.play('impact', event.targetId === 'player' ? 0.22 : 0.14);
    });
    this.bus.on('defeated', () => this.audio.play('explosion', 0.33));
  }
  private setting(name: string, value: string | boolean): void {
    if (name === 'map' && ['menu', 'loading', 'error'].includes(this.mode) && isMapId(value)) {
      void this.load(MAP_DEFINITIONS[value]); return;
    }
    if (name === 'ai-mode') {
      if (this.mode !== 'menu' || (value !== 'classic' && value !== 'enhanced')) return;
      this.selectedAiMode = value; writeStorage(AI_MODE_KEY, value);
      this.best = Number(readStorage(bestScoreKey(value, this.selectedBattleMode)) ?? 0); this.ui.setAiMode(value); return;
    }
    if (name === 'pilot' && this.mode === 'menu' && isPlayableMecha(value)) { this.selectedPlayer = value; this.showMenu(); return; }
    if (name === 'battle-mode' && this.mode === 'menu' && (value === 'campaign' || value === 'duel')) {
      this.selectedBattleMode = value;
      this.best = Number(readStorage(bestScoreKey(this.selectedAiMode, value)) ?? 0);
      this.showMenu(); return;
    }
    if (name === 'sortie-mode' && (value === 'standard' || value === 'unlimited')) {
      this.selectedSortieMode = value; this.ui.setSortieMode(value); return;
    }
    if (name === 'quality') { this.preferences.quality = value === 'low' ? 'low' : 'medium'; this.graphics.setQuality(this.preferences.quality); }
    if (name === 'muted') { this.preferences.muted = Boolean(value); this.audio.muted = Boolean(value); }
    writeStorage('sd-city-settings', JSON.stringify(this.preferences));
  }
  async load(target: MapDefinition = this.loadingMap ?? this.map): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.loadGeneration;
    this.loadingMap = target;
    this.input.clear(); this.input.unlock(); this.audio.stop(); this.clearActors();
    this.show('loading');
    try {
      const audioLoad = this.audio.load();
      // Consume both operations even on failure to avoid an unhandled rejection.
      const results = await Promise.allSettled([target.createWorld(message => {
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
      this.map = target; this.world = mapResult.value; this.graphics.scene.add(this.world.root);
      this.graphics.setEnvironment(target.environment);
      this.ui.loading('检查机体关节与武器系统…');
      this.showMenu();
      if (!this.frameHandle) this.frameHandle = requestAnimationFrame(this.frame);
    } catch (error) {
      if (!this.disposed && generation === this.loadGeneration) this.show('error', { message: error instanceof Error ? error.message : String(error) });
    }
  }
  private show(screen: Screen, data: Parameters<GameUI['show']>[1] = {}): void {
    this.mode = screen; this.ui.setBattleMode(this.selectedBattleMode); this.ui.setAiMode(this.selectedAiMode);
    this.ui.setMap(screen === 'loading' || screen === 'error' ? this.loadingMap ?? this.map : this.map);
    this.ui.show(screen, data); this.ui.syncSettings(this.preferences.quality, this.preferences.muted);
  }
  private async action(action: string): Promise<void> {
    if (action === 'start' || action === 'restart') return this.start();
    if (action === 'resume') return this.resume();
    if (action === 'retry') return this.load();
    if (action === 'back-map') {
      this.loadGeneration++; this.loadingMap = this.map;
      if (this.world) this.showMenu(); else return this.load(cityDefinition);
      return;
    }
    if (this.mode === 'loading' || this.mode === 'error') return;
    if (action === 'menu') { this.mode = 'menu'; this.input.unlock(); this.audio.stop(); this.showMenu(); return; }
    if (action === 'gallery') { this.show('gallery'); this.ui.selectPreview(this.selectedPreview); this.galleryRotation = 0; this.layoutExhibit(); return; }
    if (action === 'sortie' && isPlayableMecha(this.selectedPreview)) {
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
    this.remoteWeapons?.dispose(); this.remoteWeapons = undefined; this.remoteHurtUntil?.clear();
    this.firstPersonWeapon?.dispose(); this.firstPersonWeapon = undefined;
    this.enemies.forEach(actor => actor.dispose()); this.enemies = [];
    this.exhibit.forEach(actor => actor.dispose()); this.exhibit = [];
    this.player?.dispose(); this.player = undefined;
    this.projectiles.clear(); this.effects.clear(); this.ui.clear();
  }
  private showMenu(): void {
    this.clearActors(); this.ended = false; this.accumulator = 0; this.galleryWeapon = false; this.galleryRotation = 0; this.selectedPreview = this.selectedPlayer;
    this.ui.setPilot(this.selectedPlayer);
    this.ui.setBattleMode(this.selectedBattleMode);
    this.ui.setSortieMode(this.selectedSortieMode);
    for (const id of Object.keys(MECHA_DEFINITIONS)) {
      const actor = new Actor('preview-' + id, getMechaDefinition(id), isPlayableMecha(id) ? 'player' : 'enemy');
      this.exhibit.push(actor); this.graphics.scene.add(actor.rig.root);
    }
    this.show('menu'); this.layoutExhibit(); this.updateExhibit(0);
  }
  private layoutExhibit(): void {
    const spawn = this.map.previewSpawn ?? this.map.playerSpawn;
    this.exhibit.forEach((actor, index) => {
      const gallery = this.mode === 'gallery';
      const hero = actor.definition.id === this.selectedPlayer;
      const backdropX = actor.definition.id === 'zaku' ? 8 : actor.definition.id === 'char-zaku' ? -13 : actor.definition.id === 'nu-gundam' ? -21 : -6;
      actor.position.set(spawn.x + (gallery ? (index - (this.exhibit.length - 1) / 2) * 7 : hero ? 0 : backdropX),
        0, spawn.z + (gallery || hero || this.map.previewSpawn ? 0 : -8));
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
    const spawn = this.map.previewSpawn ?? this.map.playerSpawn, gallery = this.mode === 'gallery';
    const galleryDistance = this.map.previewSpawn ? 25 : 30;
    const galleryHeight = this.map.previewSpawn ? 15.5 : 11.6;
    this.graphics.camera.position.set(spawn.x + (gallery ? this.map.previewSpawn ? 0 : 4 : 13), gallery ? galleryHeight : 8.2, spawn.z + (gallery ? galleryDistance : 18.8));
    this.graphics.camera.fov = gallery ? 50 : 47; this.graphics.camera.updateProjectionMatrix();
    this.graphics.camera.lookAt(spawn.x + (gallery ? 0 : -2.8), gallery ? 2.5 : 3.1, spawn.z - (gallery ? 0 : 0.5));
    this.graphics.followSun(new Vector3(spawn.x, 0, spawn.z));
  }
  private async start(): Promise<void> {
    if (!this.world || this.mode === 'loading' || this.mode === 'error') return;
    this.clearActors(); this.ended = false; this.accumulator = 0; this.simulationTime = 0;
    this.player = new Actor('player', getMechaDefinition(this.selectedPlayer), 'player');
    this.firstPersonWeapon = new FirstPersonWeapon(this.player.definition);
    this.camera.viewMode = 'third-person';
    this.ui.setPilot(this.selectedPlayer);
    this.player.position.set(this.map.playerSpawn.x, 0, this.map.playerSpawn.z);
    this.graphics.scene.add(this.player.rig.root); this.camera.yaw = 0; this.camera.pitch = 0.1;
    this.mission.start(this.selectedBattleMode === 'duel' ? DUEL_WAVES : this.map.waves);
    this.spawnWave(); this.player.updateVisual(0, false);
    if (this.player.definition.remoteWeapons?.length) {
      this.remoteWeapons = new RemoteWeaponRuntime(this.projectiles);
      this.graphics.scene.add(this.remoteWeapons.root); this.remoteWeapons.attach(this.player);
    }
    this.camera.update(this.player.position, false, this.world.colliders, 1 / 60, true, false, this.player.definition.height);
    this.firstPersonWeapon.update(this.player, this.graphics.camera, 0, 0, false);
    try {
      // An unavailable/suspended sound device must not hold the game in its menu.
      void this.audio.unlock().catch(() => {});
      await this.input.lock();
      if (this.disposed) return;
      if (!this.input.locked) throw new Error('请点击继续作战以启用鼠标瞄准。');
      this.show('playing'); this.bus.emit('wave', { index: 0, title: this.mission.currentWave?.title ?? this.map.waves[0].title });
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
    const wave = this.mission.currentWave;
    const distanceFromPlayer = (point: { x: number; z: number }) => Math.hypot(point.x - this.player!.position.x, point.z - this.player!.position.z);
    const available = this.map.enemySpawns.filter(point => distanceFromPlayer(point) > 24);
    const closestSpawn = [...this.map.enemySpawns].sort((a, b) => distanceFromPlayer(a) - distanceFromPlayer(b))[0];
    const spawns = this.selectedBattleMode === 'duel'
      ? [closestSpawn ?? this.map.playerSpawn]
      : available.length >= wave.enemies.length ? available : [...this.map.enemySpawns].sort((a, b) => distanceFromPlayer(b) - distanceFromPlayer(a));
    wave.enemies.forEach((id, index) => {
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
    if (!player.activeRangedState.fire()) return;
    const weaponId = player.slot === 'alternate-ranged' ? player.definition.alternateRangedWeapon! : player.definition.rangedWeapon;
    const weapon = WEAPON_DEFINITIONS[weaponId];
    const direction = this.graphics.camera.getWorldDirection(new Vector3());
    const far = this.graphics.camera.position.clone().addScaledVector(direction, weapon.range);
    const bodies = this.enemies.filter(a => !a.dead).map(a => a.hitBody());
    const hit = firstSegmentHit(this.graphics.camera.position, far, this.world!.colliders, bodies);
    const target = hit ? new Vector3(hit.point.x, hit.point.y, hit.point.z) : far;
    const firstPerson = this.camera.viewMode === 'first-person' && this.firstPersonWeapon;
    const origin = firstPerson
      ? safeFirstPersonOrigin(this.graphics.camera.position, firstPerson.muzzleWorld(this.graphics.camera), target, this.world!.colliders, bodies)
      : safeFirstPersonOrigin(player.position.clone().add(new Vector3(0, player.definition.height * .55, 0)),
        player.rig.muzzle.getWorldPosition(new Vector3()), target, this.world!.colliders, bodies);
    this.projectiles.fire(player, origin, target.sub(origin).normalize(), weapon);
    this.effects.burst(origin, weapon.color, 4, 0.15);
    if (firstPerson) firstPerson.shot();
    this.bus.emit('shot', { ownerId: player.id, weapon: weapon.id });
  }
  private fireEnemy(enemy: Actor, remoteAim?: Point3): void {
    const player = this.player!, weapon = WEAPON_DEFINITIONS[enemy.definition.rangedWeapon];
    if (enemy.aiAmmo <= 0) { enemy.aiAmmo = weapon.magazine ?? 12; enemy.aiReload = weapon.reloadTime ?? 2.3; return; }
    const origin = enemy.rig.muzzle.getWorldPosition(new Vector3());
    const point = remoteAim ?? enemyAimPoint(enemy, player, origin, this.selectedAiMode);
    if (!point || ((remoteAim || this.selectedAiMode === 'enhanced') && firstSegmentHit(origin, point, this.world!.colliders, []))) return;
    const target = new Vector3(point.x, point.y, point.z);
    enemy.aiAmmo--; enemy.aiFireTimer = weapon.cooldown;
    this.projectiles.fire(enemy, origin, target.sub(origin).normalize(), weapon);
    this.effects.burst(origin, weapon.color, 2, 0.09); this.bus.emit('shot', { ownerId: enemy.id, weapon: weapon.id });
  }
  private damage(actor: Actor, amount: number, position: Vector3): void {
    if (actor.dead || this.mode !== 'playing') return;
    actor.health = Math.max(0, actor.health - amount); actor.hurt = 1;
    this.bus.emit('damaged', { targetId: actor.id, damage: amount, x: position.x, y: position.y, z: position.z });
    if (actor.health > 0) return;
    actor.dead = true; actor.rig.root.visible = false;
    this.remoteWeapons?.detachOwner(actor.id);
    const explosion = actor.position.clone().add(new Vector3(0, 2.8, 0));
    this.effects.burst(explosion, 0xffb771, 40, 1.25); this.effects.burst(explosion, 0x566470, 16, 0.35, true);
    this.bus.emit('defeated', { targetId: actor.id, elite: actor.definition.id === 'char-zaku' });
    // Count every kill in this step before resolving player defeat, regardless of projectile order.
    if (actor.team === 'enemy') this.mission.enemyDefeated();
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
    for (const target of this.remoteWeapons?.targets() ?? []) {
      if (target.team === attacker.team || !target.isAlive()) continue;
      const body = target.hitBody();
      if (meleeCanHit({ x: attacker.position.x, y: attacker.position.y, z: attacker.position.z, yaw: attacker.yaw,
        pitch: attacker.aimPitch, height: attacker.definition.height }, body, weapon.range, this.world!.colliders) && attacker.swing.hit(target.id)) {
        this.remoteWeapons!.applyDamage(target.id, weapon.damage);
      }
    }
  }
  private handleRemoteEvents(): void {
    for (const event of this.remoteWeapons?.drainEvents() ?? []) {
      const position = new Vector3(event.position.x, event.position.y, event.position.z);
      if (event.type === 'shot') { this.effects.burst(position, 0xffd36f, 2, 0.08); this.audio.play('beam', 0.045); }
      if (event.type === 'docked') this.audio.play('step', 0.035, 1.3);
      if (event.type === 'damaged') {
        (this.remoteHurtUntil ??= new Map()).set(event.unitId, this.simulationTime + 2);
        this.effects.burst(position, 0xffbb75, 5, 0.18); this.audio.play('impact', 0.07);
      }
      if (event.type === 'destroyed') {
        const unit = this.remoteWeapons?.snapshot().find(unit => unit.id === event.unitId);
        this.effects.burst(position, 0xffad58, 16, 0.5); this.audio.play('explosion', 0.13);
        if (event.ownerId === this.player?.id) this.ui.remoteNotice(`浮游炮 ${String((unit?.index ?? 0) + 1).padStart(2, '0')} 损失`);
        this.remoteHurtUntil?.delete(event.unitId);
      }
    }
    this.remoteWeapons?.syncVisual();
  }
  private simulation(dt: number): void {
    const player = this.player!, walls = this.world!.colliders;
    this.simulationTime += dt; player.tick(dt);
    if (this.input.takeKey('KeyT')) {
      this.camera.viewMode = this.camera.viewMode === 'third-person' ? 'first-person' : 'third-person';
      this.hudTime = 0.08;
    }
    if (this.input.takeKey('Digit1')) player.setWeapon('ranged');
    if (this.input.takeKey('Digit2')) player.setWeapon('melee');
    if (this.input.takeKey('Digit3') && player.definition.alternateRangedWeapon) player.setWeapon('alternate-ranged');
    stepPlayerMovement(player, { x: Number(this.input.keys.has('KeyD')) - Number(this.input.keys.has('KeyA')),
      z: Number(this.input.keys.has('KeyW')) - Number(this.input.keys.has('KeyS')), yaw: this.camera.yaw,
      pitch: this.camera.pitch, toggleFlight: this.input.takeKey('KeyF'),
      lift: Number(this.input.keys.has('Space')) - Number(this.input.keys.has('ControlLeft') || this.input.keys.has('ControlRight')),
      boost: this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight'), jump: this.input.takeKey('Space'),
      unlimitedEnergy: this.selectedSortieMode === 'unlimited' }, dt, walls, this.map.bounds);
    player.yaw = this.camera.yaw; player.aimPitch = this.camera.pitch;
    const aiContext = this.selectedAiMode === 'enhanced' ? { mode: this.selectedAiMode, projectiles: this.projectiles.snapshot() } : undefined;
    const enemyActions: { enemy: Actor; fire: boolean; slash: boolean }[] = [];
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.tick(dt);
      const action = stepEnemy(enemy, player, dt, this.simulationTime, walls, this.map.bounds, this.selectedSortieMode === 'unlimited', aiContext);
      enemyActions.push({ enemy, ...action });
    }
    const alive = [player, ...this.enemies].filter(a => !a.dead);
    separateActors(alive, walls, this.map.bounds);
    for (const actor of alive) actor.updateVisual(this.simulationTime, actor === player ? this.input.aiming : true);
    if (this.remoteWeapons) {
      const far = this.graphics.camera.getWorldDirection(new Vector3()).multiplyScalar(85).add(this.graphics.camera.position);
      const aimed = firstSegmentHit(this.graphics.camera.position, far, walls, this.enemies.filter(e => !e.dead).map(e => e.hitBody()));
      this.remoteWeapons.step(dt, alive, walls, this.map.bounds, aimed?.type === 'actor' ? aimed.id : undefined);
    }
    this.camera.update(player.position, this.input.aiming, walls, dt, false, player.flying && player.boosting, player.definition.height);
    this.firstPersonWeapon?.update(player, this.graphics.camera, dt, this.simulationTime, this.input.aiming);
    this.firePlayer(); this.melee(player, this.enemies);
    for (const { enemy, fire, slash } of enemyActions) {
      if (enemy.dead) continue;
      const remoteShot = this.remoteWeapons?.enemyShot(enemy, dt, this.simulationTime, this.selectedAiMode);
      if (remoteShot) {
        if (remoteShot.point && enemy.slot === 'ranged' && !enemy.swing.running && enemy.aiFireTimer <= 0 && enemy.aiReload <= 0) {
          const dx = remoteShot.point.x - enemy.position.x, dz = remoteShot.point.z - enemy.position.z;
          enemy.yaw = Math.atan2(-dx, -dz);
          enemy.aimPitch = -Math.atan2(remoteShot.point.y - (enemy.position.y + enemy.definition.height * .55), Math.hypot(dx, dz));
          enemy.updateVisual(this.simulationTime, true); this.fireEnemy(enemy, remoteShot.point);
        }
      } else if (fire) this.fireEnemy(enemy);
      if (slash) this.bus.emit('shot', { ownerId: enemy.id, weapon: enemy.definition.meleeWeapon });
      this.melee(enemy, [player]);
    }
    this.projectiles.update(dt, alive, walls, (position, amount, target) => {
      this.effects.burst(position, target ? 0xffd38c : 0xbcc9c5, target ? 10 : 6, 0.45);
      if (target) this.damage(target, amount, position);
    }, this.remoteWeapons?.targets(), (position, amount, target) => {
      this.remoteWeapons?.applyDamage(target.id, amount);
    });
    this.handleRemoteEvents();
    this.effects.update(dt);
    this.enemies = this.enemies.filter(enemy => { if (!enemy.dead) return true; enemy.dispose(); return false; });
    if (player.dead) this.mission.defeat();
    this.mission.update(dt);
    if (this.mission.waveChanged) { this.spawnWave(); this.bus.emit('wave', { index: this.mission.waveIndex, title: this.mission.currentWave.title }); }
    this.stepSoundTime -= dt; this.boostSoundTime -= dt;
    if ((player.boosting || player.flying) && this.boostSoundTime <= 0) { this.audio.play('boost', player.boosting ? 0.12 : 0.035, player.boosting ? 1 : 0.8); this.boostSoundTime = 0.6; }
    else if (player.speed > 2 && player.grounded && this.stepSoundTime <= 0) { this.audio.play('step', 0.08, 0.85); this.stepSoundTime = 0.42; }
    if (this.mission.status === 'victory' || this.mission.status === 'defeat') this.finish();
  }
  private finish(): void {
    if (this.ended) return; this.ended = true;
    const score = this.mission.kills * 100 + (this.mission.status === 'victory' ? 1500 + Math.ceil(this.player!.health) : 0);
    this.best = Math.max(this.best, score); writeStorage(bestScoreKey(this.selectedAiMode, this.selectedBattleMode), String(this.best));
    this.mode = this.mission.status === 'victory' ? 'victory' : 'defeat'; this.input.unlock(); this.input.clear();
    this.show(this.mode, { kills: this.mission.kills, elapsed: this.mission.elapsed, score, best: this.best, totalEnemies: this.mission.totalEnemies });
  }
  private updateHud(): void {
    if (!this.player) return;
    const player = this.player;
    const melee = player.slot === 'melee';
    const weaponId = melee ? player.definition.meleeWeapon : player.slot === 'alternate-ranged' ? player.definition.alternateRangedWeapon! : player.definition.rangedWeapon;
    const rangedState = melee ? undefined : player.activeRangedState;
    this.ui.update({ health: player.health, maxHealth: player.definition.maxHealth, energy: player.energy, heat: rangedState?.heat ?? 0,
      overheated: rangedState?.overheated ?? false, weapon: WEAPON_DEFINITIONS[weaponId].name, slot: player.slot,
      hasAlternateRanged: Boolean(player.definition.alternateRangedWeapon), ammo: rangedState?.ammo ?? undefined, magazine: rangedState?.magazine,
      melee, viewMode: this.camera.viewMode, battleMode: this.selectedBattleMode, wave: this.mission.waveIndex + 1, waveCount: this.mission.waveCount,
      totalEnemies: this.mission.totalEnemies, remaining: this.mission.remaining, kills: this.mission.kills,
      elapsed: this.mission.elapsed, intermission: this.mission.intermission, fps: this.fps, reloading: melee ? player.swing.running : Boolean(rangedState?.reloading),
      flightState: player.flightState, altitude: player.altitude, flightDenied: player.flightNotice > 0, sortieMode: this.selectedSortieMode,
      remoteUnits: this.remoteWeapons?.snapshot(player.id),
      remoteTargetNames: Object.fromEntries(this.enemies.filter(enemy => !enemy.dead).map(enemy => [enemy.id, enemy.definition.name])) });
    const markers: EnemyMarker[] = [];
    for (const enemy of this.enemies) {
      if (enemy.position.distanceTo(player.position) > 105) continue;
      const position = enemy.position.clone().add(new Vector3(0, enemy.definition.height + 0.8, 0)).project(this.graphics.camera);
      if (position.z < -1 || position.z > 1 || Math.abs(position.x) > 1 || Math.abs(position.y) > 1) continue;
      if (firstSegmentHit(this.graphics.camera.position, enemy.position.clone().add(new Vector3(0, 4, 0)), this.world!.colliders, [])) continue;
      markers.push({ id: enemy.id, x: (position.x * 0.5 + 0.5) * 100, y: (-position.y * 0.5 + 0.5) * 100,
        health: enemy.health / enemy.definition.maxHealth, name: enemy.definition.id === 'char-zaku' ? 'CHAR / 夏亚专用' : 'ZAKU II', elite: enemy.definition.id === 'char-zaku' });
    }
    for (const unit of this.remoteWeapons?.snapshot(player.id) ?? []) {
      if (!isRemoteAirborne(unit) || (this.remoteHurtUntil?.get(unit.id) ?? 0) < this.simulationTime) continue;
      const point = new Vector3(unit.position.x, unit.position.y + .7, unit.position.z);
      if (firstSegmentHit(this.graphics.camera.position, point, this.world!.colliders, [])) continue;
      point.project(this.graphics.camera);
      if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
      markers.push({ id: unit.id, x: (point.x * .5 + .5) * 100, y: (-point.y * .5 + .5) * 100,
        health: unit.health / unit.maxHealth, name: `FIN ${String(unit.index + 1).padStart(2, '0')}`, elite: false, remote: true });
    }
    this.ui.markers(markers); this.ui.drawRadar({ x: player.position.x, z: player.position.z, yaw: player.yaw }, this.enemies.map(e => ({ x: e.position.x, z: e.position.z, elite: e.definition.id === 'char-zaku' })));
  }
  private frame = (now: number): void => {
    if (this.disposed) return;
    const elapsed = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    const dt = Math.min(0.1, elapsed); this.lastFrame = now;
    if (!document.hidden && (this.mode === 'menu' || this.mode === 'gallery' || this.mode === 'playing')) this.world?.update?.(dt);
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
    this.ui.animate(dt); this.render();
    this.frameHandle = requestAnimationFrame(this.frame);
  };
  private render(): void {
    const firstPerson = this.camera.viewMode === 'first-person';
    const overlay = firstPerson && (this.mode === 'playing' || this.mode === 'paused') ? this.firstPersonWeapon : undefined;
    this.graphics.render(overlay, firstPerson ? this.player?.rig.root : undefined);
  }
  // Read-only diagnostics are opt-in for maintainers; controls always use real input.
  inspect() {
    return { screen: this.mode, map: { id: this.map.id, name: this.map.name, bounds: this.map.bounds, colliders: this.world?.colliders.length ?? 0 }, viewMode: this.camera.viewMode, battleMode: this.selectedBattleMode, aiMode: this.selectedAiMode, locked: this.input.locked, quality: this.graphics.quality, fps: this.fps, audio: this.audio.state,
      renderer: { calls: this.graphics.renderer.info.render.calls, triangles: this.graphics.renderer.info.render.triangles, geometries: this.graphics.renderer.info.memory.geometries, textures: this.graphics.renderer.info.memory.textures },
      mission: { status: this.mission.status, wave: this.mission.waveIndex + 1, remaining: this.mission.remaining, kills: this.mission.kills, elapsed: this.mission.elapsed },
      player: this.player ? { type: this.player.definition.id, x: this.player.position.x, y: this.player.position.y, z: this.player.position.z, health: this.player.health, energy: this.player.energy, slot: this.player.slot, yaw: this.player.yaw, heat: this.player.rifle.heat,
        flightState: this.player.flightState, velocity: this.player.velocity.toArray(), altitude: this.player.altitude } : null,
      remoteUnits: this.remoteWeapons?.snapshot() ?? [], activeProjectiles: this.projectiles.activeCount,
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
function bestScoreKey(aiMode: AIMode, battleMode: BattleMode = 'campaign'): string {
  if (battleMode === 'campaign') return aiBestKey(aiMode);
  return `sd-city-duel-best${aiMode === 'enhanced' ? '-enhanced' : ''}`;
}
function readPreferences(): { quality: 'low' | 'medium'; muted: boolean } {
  try {
    const value = JSON.parse(readStorage('sd-city-settings') ?? '{}');
    return { quality: value.quality === 'low' ? 'low' : 'medium', muted: value.muted === true };
  } catch { return { quality: 'medium', muted: false }; }
}
