import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { isSectorUnlocked } from '../systems/UnlockRegistry';
import { loadProfile } from '../systems/ProfileStore';
import { recordRestart, type RunRecord } from '../systems/RunTelemetry';
import type { ContractOutcome } from '../systems/ContractSystem';
import { AudioManager } from '../managers/AudioManager';
import { t, td } from '../i18n';

const BUTTON_WIDTH = 270;
const BUTTON_GAP = 20;

interface GameOverData {
  time: number; level: number; victory: boolean; arenaIndex: number; weaponId: string;
  summary: Readonly<RunRecord>; equipment: string[]; synergy?: string;
  masteryEarned?: number; creditsEarned?: number; newUnlocks?: string[]; contracts?: ContractOutcome;
  newAchievements?: { name: string; reward: number }[];
  daily?: { date: string; mutator: string; score: number };
  dailyBest?: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private navigating = false;
  constructor() { super('GameOver'); }

  create(data: GameOverData) {
    this.game.canvas.dataset.scene = 'GameOver';
    this.input.enabled = true;
    this.navigating = false;
    const accent = data.victory ? 0x73ef62 : 0xff476f;
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu-backdrop')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setTint(data.victory ? 0xb8ffd0 : 0x8d6070);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020710, 0.68);
    this.add.rectangle(GAME_WIDTH / 2, 358, 1120, 620, 0x07111f, 0.96).setStrokeStyle(3, accent, 0.8);
    this.add.text(GAME_WIDTH / 2, 82, t(data.victory ? 'gameover.victory' : 'gameover.defeat'), {
      fontFamily: 'Arial Black', fontSize: '42px', color: data.victory ? '#73ef62' : '#ff476f',
      stroke: '#020710', strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 130, t(data.victory ? 'gameover.victorySub' : 'gameover.defeatSub'), {
      fontFamily: 'Arial Black', fontSize: '13px', color: '#21e6ff', letterSpacing: 4,
    }).setOrigin(0.5);

    const summary = data.summary;
    const seconds = Math.floor(data.time / 1000);
    const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const accuracy = summary.shotsFired > 0 ? Math.min(100, Math.round(summary.hits / summary.shotsFired * 100)) : 0;
    this.statCard(250, 230, t('gameover.survival'), duration, 'results-survival');
    this.statCard(510, 230, t('gameover.kills'), String(summary.kills), 'results-kills');
    this.statCard(770, 230, t('gameover.damage'), String(summary.damageDealt), 'results-damage');
    this.statCard(1030, 230, t('gameover.accuracy'), `${accuracy}%`, 'results-accuracy');

    const items = data.equipment.length ? data.equipment.slice(-3).join('  ·  ') : t('gameover.noEquipment');
    const build = data.synergy ? t('gameover.synergy', { name: data.synergy })
      : t('gameover.build', { weapon: summary.weapon, count: summary.upgrades.length });
    this.add.text(160, 330, t('gameover.run', { level: data.level, sector: data.arenaIndex + 1, taken: summary.damageTaken }), {
      fontFamily: 'Arial Black', fontSize: '15px', color: '#eaffff', letterSpacing: 1,
    }).setName('results-run');
    this.add.text(160, 370, build, { fontFamily: 'Arial Black', fontSize: '14px', color: '#c986ff' })
      .setName('results-build');
    this.add.text(160, 406, t('gameover.equipment', { items }), { fontFamily: 'monospace', fontSize: '15px', color: '#9dc5d6' })
      .setName('results-equipment');

    const reward = t('gameover.rewards', {
      credits: data.creditsEarned ?? 0, mastery: data.masteryEarned ?? 0, contracts: data.contracts?.completedCount ?? 0,
    });
    this.add.rectangle(GAME_WIDTH / 2, 462, 920, 58, 0x102a32, 0.92).setStrokeStyle(2, 0xffc857, 0.65);
    this.add.text(GAME_WIDTH / 2, 462, reward, {
      fontFamily: 'Arial Black', fontSize: '19px', color: '#ffc857', letterSpacing: 2,
    }).setOrigin(0.5).setName('results-rewards');

    // Up to two short lines between the rewards and the buttons, most important first.
    const notes: { text: string; color: string; name: string }[] = [];
    if (data.daily)
      notes.push({
        text: `${t('gameover.daily', { score: data.daily.score })}${data.dailyBest ? `   ${t('gameover.dailyBest')}` : ''}`,
        color: '#ffc857', name: 'results-daily',
      });
    if (data.newAchievements?.length)
      notes.push({
        text: data.newAchievements.map(a => t('gameover.achievement', { name: td(a.name), reward: a.reward })).join('   ·   '),
        color: '#73ef62', name: 'results-achievements',
      });
    if (data.newUnlocks?.length)
      notes.push({ text: t('gameover.unlock', { list: data.newUnlocks.join(' · ') }), color: '#73ef62', name: 'results-unlocks' });
    notes.slice(0, 2).forEach((note, index) => this.add.text(GAME_WIDTH / 2, 502 + index * 22, note.text, {
      fontFamily: 'Arial Black', fontSize: '13px', color: note.color, align: 'center', wordWrap: { width: 1040 },
    }).setOrigin(0.5).setName(note.name));
    if (data.newAchievements?.length) new AudioManager(this).play('achievement');

    const nextArenaIndex = data.victory ? data.arenaIndex + 1 : data.arenaIndex;
    const canAdvance = !data.daily && isSectorUnlocked(nextArenaIndex, loadProfile().unlocks);
    const go = (key: string, sceneData?: object) => () => {
      if (this.navigating) return;
      this.navigating = true;
      this.scene.start(key, sceneData);
    };
    // A daily retry replays the same sector, weapon and mutator; it never advances a sector.
    const start = go('Game', {
      arenaIndex: data.victory && canAdvance ? nextArenaIndex : data.arenaIndex,
      weaponId: data.weaponId,
      daily: data.daily && { date: data.daily.date, mutator: data.daily.mutator },
    });
    const redeploy = () => { recordRestart(); start(); };
    const mainMenu = go('Menu');
    const offset = (BUTTON_WIDTH + BUTTON_GAP) / 2;
    const againLabel = data.daily ? t('gameover.retryDaily') : data.victory && canAdvance ? t('gameover.next') : t('gameover.again');
    this.button(GAME_WIDTH / 2 - offset, 575, againLabel, 0x73ef62, redeploy);
    this.button(GAME_WIDTH / 2 + offset, 575, t('gameover.menu'), 0x21e6ff, mainMenu);
    this.input.keyboard?.on('keydown-ENTER', redeploy);
    this.input.keyboard?.on('keydown-SPACE', redeploy);
    this.input.keyboard?.on('keydown-ESC', mainMenu);
    this.add.text(GAME_WIDTH / 2, 641, t('gameover.keys'), {
      fontFamily: 'monospace', fontSize: '12px', color: '#7594a8', letterSpacing: 1,
    }).setOrigin(0.5);
  }

  private statCard(x: number, y: number, label: string, value: string, name: string) {
    this.add.rectangle(x, y, 230, 105, 0x0b1b2b, 0.95).setStrokeStyle(2, 0x214c65, 0.9);
    this.add.text(x, y - 26, label, { fontFamily: 'Arial Black', fontSize: '11px', color: '#7594a8', letterSpacing: 2 }).setOrigin(0.5);
    this.add.text(x, y + 18, value, { fontFamily: 'Arial Black', fontSize: '29px', color: '#eaffff' }).setOrigin(0.5).setName(name);
  }

  private button(x: number, y: number, label: string, color: number, action: () => void) {
    const button = this.add.rectangle(x, y, BUTTON_WIDTH, 62, 0x07111f, 0.96)
      .setStrokeStyle(3, color, 0.9).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, { fontFamily: 'Arial Black', fontSize: '17px', color: '#eaffff' }).setOrigin(0.5);
    button.on('pointerover', () => { button.setFillStyle(color, 0.28); text.setColor('#ffffff'); });
    button.on('pointerout', () => { button.setFillStyle(0x07111f, 0.96); text.setColor('#eaffff'); });
    button.on('pointerup', action);
  }
}
