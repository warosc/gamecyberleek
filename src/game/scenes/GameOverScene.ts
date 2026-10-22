import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { isSectorUnlocked } from '../systems/UnlockRegistry';
import { loadProfile } from '../systems/ProfileStore';
import { recordRestart, type RunRecord } from '../systems/RunTelemetry';
import type { ContractOutcome } from '../systems/ContractSystem';
import { AudioManager } from '../managers/AudioManager';
import { t, td } from '../i18n';
import { FocusGroup, UI, fitText, framePanel, hex, isCompact, panelButton, uiFont } from '../ui/SceneWidgets';
import { backdropTexture, queueSceneArt } from '../config/SceneArt';
import { allowedThreat, threatLabel } from '../progression/ThreatLevels';
import { DISPLAY_FONT } from '../config/Fonts';

const BUTTON_WIDTH = 270;
const BUTTON_GAP = 20;

interface GameOverData {
  time: number; level: number; victory: boolean; arenaIndex: number; weaponId: string; threat?: number;
  summary: Readonly<RunRecord>; equipment: string[]; synergy?: string;
  masteryEarned?: number; creditsEarned?: number; newUnlocks?: string[]; contracts?: ContractOutcome;
  newAchievements?: { name: string; reward: number }[];
  daily?: { date: string; mutator: string; score: number };
  dailyBest?: boolean;
  /** Daily bonus paid by this run; 0 on a repeat attempt the same day. */
  dailyBonus?: number;
  dailyStreak?: number;
  /** The threat level this victory opened in its sector, when it opened one. */
  threatUnlocked?: number;
  /** Personal records this run beat: best level, fastest victory. */
  recordLevel?: number;
  recordVictoryMs?: number;
}

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export class GameOverScene extends Phaser.Scene {
  private navigating = false;
  constructor() { super('GameOver'); }

  preload() {
    // Only the outcome's own backdrop; the data handed to scene.start is already on the settings.
    const victory = (this.sys.settings.data as Partial<GameOverData> | undefined)?.victory;
    queueSceneArt(this, { backdrops: [victory ? 'victory' : 'defeat'] });
  }

  create(data: GameOverData) {
    this.game.canvas.dataset.scene = 'GameOver';
    this.input.enabled = true;
    this.navigating = false;
    const accent = data.victory ? 0x73ef62 : 0xff476f;
    const backdrop = backdropTexture(this, data.victory ? 'victory' : 'defeat');
    const own = backdrop !== 'menu-backdrop';
    const art = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backdrop).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    if (!own) art.setTint(data.victory ? 0xb8ffd0 : 0x8d6070);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, own ? 0.3 : 0.68);
    framePanel(this, GAME_WIDTH / 2, 358, 1140, 640, accent, { fill: 0x07111f, fillAlpha: own ? 0.74 : 0.96, band: 0.06, strokeAlpha: 0.85, cut: 26, glow: 0.12 });
    this.add.text(GAME_WIDTH / 2, 80, t(data.victory ? 'gameover.victory' : 'gameover.defeat'), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 42), color: hex(accent),
      stroke: '#020710', strokeThickness: 8,
    }).setOrigin(0.5).setShadow(0, 0, hex(accent), 14, false, true);
    this.add.text(GAME_WIDTH / 2, 128, t(data.victory ? 'gameover.victorySub' : 'gameover.defeatSub'), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 13), color: '#21e6ff', letterSpacing: isCompact(this) ? 2 : 4,
    }).setOrigin(0.5);
    // Everything below is laid out on the 1280 design width and centred on wider phone canvases.
    const ox = (GAME_WIDTH - 1280) / 2;

    const summary = data.summary;
    const seconds = Math.floor(data.time / 1000);
    const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const accuracy = summary.shotsFired > 0 ? Math.min(100, Math.round(summary.hits / summary.shotsFired * 100)) : 0;
    this.statCard(ox + 250, 222, t('gameover.survival'), duration, 'results-survival');
    this.statCard(ox + 510, 222, t('gameover.kills'), String(summary.kills), 'results-kills');
    this.statCard(ox + 770, 222, t('gameover.damage'), String(summary.damageDealt), 'results-damage');
    this.statCard(ox + 1030, 222, t('gameover.accuracy'), `${accuracy}%`, 'results-accuracy');

    // Names arrive as the Spanish source strings the run used; `td` shows them in the player's language.
    const items = data.equipment.length ? data.equipment.slice(-3).map(name => td(name)).join('  ·  ') : t('gameover.noEquipment');
    const build = data.synergy ? t('gameover.synergy', { name: td(data.synergy) })
      : t('gameover.build', { weapon: summary.weapon, count: summary.upgrades.length });
    const threat = data.threat ?? 0;
    const runLine = t('gameover.run', { level: data.level, sector: data.arenaIndex + 1, taken: summary.damageTaken });
    fitText(this.add.text(ox + 140, 318, threat > 0 ? `${runLine}  ·  ${threatLabel(threat)}` : runLine, {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 15), color: UI.text, letterSpacing: 1,
    }).setOrigin(0, 0.5).setName('results-run'), 1000);
    fitText(this.add.text(ox + 140, 356, build, { fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 14), color: '#d49cff' })
      .setOrigin(0, 0.5).setName('results-build'), 1000);
    fitText(this.add.text(ox + 140, 394, t('gameover.equipment', { items }), { fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 13), color: '#9dc5d6' })
      .setOrigin(0, 0.5).setName('results-equipment'), 1000);

    const reward = t('gameover.rewards', {
      credits: data.creditsEarned ?? 0, mastery: data.masteryEarned ?? 0, contracts: data.contracts?.completedCount ?? 0,
    });
    framePanel(this, GAME_WIDTH / 2, 452, 960, 60, UI.gold, { fill: 0x102a32, fillAlpha: 0.92, band: 0.1, strokeAlpha: 0.75, cut: 12 });
    fitText(this.add.text(GAME_WIDTH / 2, 452, reward, {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 19), color: '#ffc857', letterSpacing: 2,
    }).setOrigin(0.5).setName('results-rewards'), 920);

    // Up to two short lines between the rewards and the buttons, most important first.
    const notes: { text: string; color: string; name: string }[] = [];
    if (data.daily) {
      const streak = data.dailyStreak ?? 0;
      const bonus = data.dailyBonus
        ? t('gameover.dailyBonus', { bonus: data.dailyBonus, days: streak })
        : t('gameover.dailyClaimed', { days: streak });
      notes.push({
        text: `${t('gameover.daily', { score: data.daily.score })}${data.dailyBest ? `   ${t('gameover.dailyBest')}` : ''}   ·   ${bonus}`,
        color: '#ffc857', name: 'results-daily',
      });
    }
    if (data.newAchievements?.length)
      notes.push({
        text: data.newAchievements.map(a => t('gameover.achievement', { name: td(a.name), reward: a.reward })).join('   ·   '),
        color: '#73ef62', name: 'results-achievements',
      });
    // Records share one line: with two note slots they must not push the achievements out.
    const records = [
      data.recordLevel ? t('gameover.recordLevel', { level: data.recordLevel }) : '',
      data.recordVictoryMs ? t('gameover.recordTime', { time: clock(data.recordVictoryMs) }) : '',
    ].filter(Boolean);
    if (records.length)
      notes.push({ text: t('gameover.records', { list: records.join('  ·  ') }), color: '#21e6ff', name: 'results-records' });
    if (data.newUnlocks?.length)
      notes.push({ text: t('gameover.unlock', { list: data.newUnlocks.join(' · ') }), color: '#73ef62', name: 'results-unlocks' });
    // Last: a new sector matters more on a first win, and the selector shows the level anyway.
    if (data.threatUnlocked)
      notes.push({
        text: t('gameover.threatUnlocked', { threat: threatLabel(data.threatUnlocked), sector: data.arenaIndex + 1 }),
        color: '#ff8a3d', name: 'results-threat',
      });
    notes.slice(0, 2).forEach((note, index) => fitText(this.add.text(GAME_WIDTH / 2, 500 + index * 28, note.text, {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 14), color: note.color, align: 'center',
    }).setOrigin(0.5).setName(note.name), 1080));
    const audio = new AudioManager(this);
    audio.playStinger(data.victory ? 'victory' : 'defeat');
    if (data.newAchievements?.length) audio.play('achievement');

    const nextArenaIndex = data.victory ? data.arenaIndex + 1 : data.arenaIndex;
    const profile = loadProfile();
    const canAdvance = !data.daily && isSectorUnlocked(nextArenaIndex, profile.unlocks);
    const nextArena = data.victory && canAdvance ? nextArenaIndex : data.arenaIndex;
    // The run ends mid-combat, often with ENTER, a click or the pad's A (replayed as ENTER) still
    // being pressed. Until this passes, input is that leftover combat input, not a choice: it
    // would skip the results unread and count as a restart.
    const armedAt = this.time.now + 600;
    const go = (key: string, sceneData?: object) => (event?: KeyboardEvent) => {
      if (this.navigating || this.time.now < armedAt || event?.repeat) return;
      this.navigating = true;
      this.scene.start(key, sceneData);
    };
    // A daily retry replays the same sector, weapon and mutator; it never advances a sector.
    // The same threat again, lowered to what the next sector has opened when advancing.
    const start = go('Game', {
      arenaIndex: nextArena,
      threat: data.daily ? 0 : allowedThreat(profile.threatCleared, nextArena, threat),
      weaponId: data.weaponId,
      daily: data.daily && { date: data.daily.date, mutator: data.daily.mutator },
    });
    const redeploy = (event?: KeyboardEvent) => {
      if (this.navigating || this.time.now < armedAt || event?.repeat) return;
      recordRestart();
      start();
    };
    const mainMenu = go('Menu');
    const offset = (BUTTON_WIDTH + BUTTON_GAP) / 2;
    const againLabel = data.daily ? t('gameover.retryDaily') : data.victory && canAdvance ? t('gameover.next') : t('gameover.again');
    const again = panelButton(this, GAME_WIDTH / 2 - offset, 580, BUTTON_WIDTH, 64, againLabel, UI.green, redeploy, 18, { primary: true });
    const menu = panelButton(this, GAME_WIDTH / 2 + offset, 580, BUTTON_WIDTH, 64, t('gameover.menu'), UI.cyan, mainMenu, 18);
    // ENTER (pad A) runs the focused button, redeploy unless the player moved off it; both
    // actions keep the arming delay above. Not SPACE: it is the dash key, and players are still
    // holding it when the run ends.
    new FocusGroup(this).button(again, { row: 0 }).button(menu, { row: 0 }).start(0);
    this.input.keyboard?.on('keydown-ESC', mainMenu);
    // Keyboard hints mean nothing on a phone.
    if (!isCompact(this)) this.add.text(GAME_WIDTH / 2, 646, t('gameover.keys'), {
      fontFamily: 'monospace', fontSize: uiFont(this, 12), color: UI.muted, letterSpacing: 1,
    }).setOrigin(0.5);
  }

  private statCard(x: number, y: number, label: string, value: string, name: string) {
    framePanel(this, x, y, 236, 110, UI.cyan, { fill: 0x0b1b2b, strokeAlpha: 0.4, band: 0.08, cut: 14 });
    fitText(this.add.text(x, y - 28, label, {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 11), color: UI.muted, letterSpacing: 2,
    }).setOrigin(0.5), 216);
    this.add.text(x, y + 16, value, { fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: uiFont(this, 30), color: UI.text }).setOrigin(0.5).setName(name);
  }
}
