import Phaser from 'phaser';
import { PLAYER_RIG_LAYERS, PLAYER_RIG_STATES } from '../entities/player/PlayerRigManifest';
import { BOSS_IDENTITY } from '../entities/enemies/BossVisual';
import { VEGETABLE_ART } from '../entities/enemies/VegetableRoster';
import { parseMidi } from '../audio/MidiFile';
import type { MusicCue, MusicManifest } from '../audio/MusicDirector';
import { registerMusic } from '../managers/AudioManager';
export class PreloadScene extends Phaser.Scene {
  private startedAt = 0;
  private bar?: Phaser.GameObjects.Rectangle;
  private percent?: Phaser.GameObjects.Text;
  private status?: Phaser.GameObjects.Text;
  constructor() {
    super('Preload');
  }
  init() {
    this.startedAt = performance.now();
  }
  preload() {
    this.game.canvas.dataset.scene = 'Preload';
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x030912);
    const grid = this.add.grid(width / 2, height / 2, width, height, 48, 48, 0x061323, 1, 0x174358, 0.28);
    grid.setRotation(-0.035);
    this.add.circle(width / 2, height / 2 - 76, 58, 0x07111f, 1)
      .setStrokeStyle(4, 0x21e6ff, 0.9);
    const scanner = this.add.circle(width / 2, height / 2 - 76, 46, 0x73ef62, 0)
      .setStrokeStyle(5, 0x73ef62, 0.8);
    this.tweens.add({ targets: scanner, angle: 360, scale: 1.12, alpha: { from: 0.35, to: 1 },
      duration: 1100, repeat: -1, yoyo: true });
    this.add.text(width / 2, height / 2 - 80, 'L', {
      fontFamily: 'Arial Black', fontSize: '54px', color: '#73ef62',
    }).setOrigin(0.5).setShadow(0, 0, '#21e6ff', 12, true, true);
    this.add.text(width / 2, height / 2 + 8, 'CYBERLEEK', {
      fontFamily: 'Arial Black', fontSize: '42px', color: '#eaffff', letterSpacing: 5,
    }).setOrigin(0.5);
    this.add.rectangle(width / 2, height / 2 + 78, 524, 20, 0x02060c, 1)
      .setStrokeStyle(2, 0x21e6ff, 0.8);
    this.bar = this.add.rectangle(width / 2 - 256, height / 2 + 78, 1, 12, 0x73ef62)
      .setOrigin(0, 0.5);
    this.percent = this.add.text(width / 2, height / 2 + 110, '0%', {
      fontFamily: 'Arial Black', fontSize: '17px', color: '#73ef62',
    }).setOrigin(0.5);
    this.status = this.add.text(width / 2, height / 2 + 145, 'INICIALIZANDO NÚCLEO TÁCTICO', {
      fontFamily: 'monospace', fontSize: '12px', color: '#789bab', letterSpacing: 2,
    }).setOrigin(0.5);
    const domBar = document.getElementById('boot-progress');
    const domStatus = document.getElementById('boot-status');
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      this.bar?.setDisplaySize(Math.max(1, 512 * value), 12);
      this.percent?.setText(`${Math.round(value * 100)}%`);
      if (domBar) domBar.style.width = `${Math.max(3, value * 100)}%`;
    });
    this.load.on(Phaser.Loader.Events.FILE_PROGRESS, (file: Phaser.Loader.File) => {
      const message = this.loadingMessage(file.key);
      this.status?.setText(message);
      if (domStatus) domStatus.textContent = message;
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.status?.setText('BIO-SISTEMAS LISTOS');
      if (domStatus) domStatus.textContent = 'BIO-SISTEMAS LISTOS';
    });
    this.load.image(BOSS_IDENTITY.texture, BOSS_IDENTITY.asset);
    // Dedicated sprites for the later families and commanders; absent entries keep the graded fallback.
    this.load.once('filecomplete-json-art-manifest', (_key: string, _type: string, manifest: { sprites?: { key: string; path: string }[] }) => {
      for (const sprite of manifest.sprites ?? []) this.load.image(sprite.key, sprite.path);
    });
    this.load.json('art-manifest', 'assets/enemies/art-manifest.json');
    for (const art of VEGETABLE_ART)
      this.load.image(`vegetable-${art}`, `assets/enemies/vegetables/${art}.png`);
    this.load.image(
      'leek-placeholder-front',
      'assets/character/leek/placeholder-front-reference.png',
    );
    this.load.image('leek-avatar', 'assets/character/leek/avatar.png');
    this.load.image('leek-hero-clean', 'assets/character/leek/hero-clean-v2.png');
    this.load.image('leek-actions', 'assets/character/leek/actions-reference.png');
    this.load.image('leek-profile', 'assets/character/leek/turnaround-profile.png');
    this.load.image('leek-back', 'assets/character/leek/turnaround-back.png');
    for (const layer of PLAYER_RIG_LAYERS)
      this.load.image(`rig-${layer}`, `assets/character/leek/rig/layers/${layer}.png`);
    for (const state of PLAYER_RIG_STATES)
      this.load.json(`rig-anim-${state}`, `assets/character/leek/rig/animations/${state}.json`);
    this.load.image('lab-floor', 'assets/maps/cyber-vegetable-lab-floor.png');
    this.load.image('menu-backdrop', 'assets/ui/menu-backdrop.png');
    // The soundtrack is optional: a missing manifest or file leaves the procedural score.
    this.load.once('filecomplete-json-music-manifest', (_key: string, _type: string, manifest: MusicManifest) => {
      for (const [cue, entry] of Object.entries(manifest)) if (entry) this.load.binary(`music-${cue}`, `assets/music/${entry.midi}`);
    });
    this.load.json('music-manifest', 'assets/music/manifest.json');
  }
  create() {
    this.registerSoundtrack();
    const actions = this.textures.get('leek-actions');
    actions.add('move', 0, 13, 35, 129, 184);
    actions.add('dash', 0, 150, 5, 125, 135);
    actions.add('attack', 0, 365, 12, 220, 210);
    const enter = () => {
      const splash = document.getElementById('boot-splash');
      splash?.classList.add('boot-complete');
      splash?.setAttribute('aria-hidden', 'true');
      this.scene.start('Menu');
    };
    const remaining = Math.max(0, 700 - (performance.now() - this.startedAt));
    if (remaining > 0) this.time.delayedCall(remaining, enter);
    else enter();
  }
  private registerSoundtrack() {
    const manifest = this.cache.json.get('music-manifest') as MusicManifest | undefined;
    if (!manifest) return;
    for (const [cue, entry] of Object.entries(manifest)) {
      const data = this.cache.binary.get(`music-${cue}`) as ArrayBuffer | undefined;
      if (!data || !entry) continue;
      try {
        registerMusic(cue as MusicCue, parseMidi(data), entry);
      } catch {
        // A corrupt file loses that cue only; the rest of the soundtrack still plays.
      }
    }
  }
  private loadingMessage(key: string) {
    if (key.startsWith('music-')) return 'AFINANDO BANDA SONORA';
    if (key.startsWith('rig-') || key.startsWith('leek-')) return 'ENSAMBLANDO OPERADOR CYBERLEEK';
    if (key.startsWith('vegetable-') || key.includes('brok')) return 'ESCANEANDO AMENAZAS VEGETALES';
    if (key.includes('floor')) return 'CARTOGRAFIANDO SECTORES';
    if (key.includes('menu')) return 'ABRIENDO CANAL DE OPERACIONES';
    return 'SINCRONIZANDO BIO-SISTEMAS';
  }
}
