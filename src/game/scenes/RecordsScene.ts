import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { ARENA_THEMES } from '../config/ArenaDefinitions';
import { t, td } from '../i18n';
import { ACHIEVEMENTS } from '../progression/Achievements';
import { loadProfile } from '../systems/ProfileStore';
import { starterWeapon } from '../weapons/WeaponRegistry';
import { backToMenu, subMenuFrame } from '../ui/SceneWidgets';
import { onlineService } from '../online/OnlinePorts';

export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}:${rest}`;
}

/** Lifetime totals, the recent run log and the achievement board. Read-only. */
export class RecordsScene extends Phaser.Scene {
  constructor() { super('Records'); }

  create() {
    this.game.canvas.dataset.scene = 'Records';
    subMenuFrame(this, GAME_WIDTH, GAME_HEIGHT, t('records.title'), t('records.subtitle'), 0x21e6ff);
    const profile = loadProfile();
    const life = profile.lifetime;
    // Offset from the 1280 design width so the three columns stay centred on wide phone canvases.
    const ox = (GAME_WIDTH - 1280) / 2;
    const label = { fontFamily: 'Arial Black', fontSize: '12px', color: '#7594a8', letterSpacing: 1 };
    const value = { fontFamily: 'Arial Black', fontSize: '15px', color: '#eaffff' };

    this.add.text(ox + 70, 140, t('records.lifetime'), { ...label, color: '#21e6ff', fontSize: '14px' });
    const accuracy = life.shotsFired > 0 ? `${Math.round(life.hits / life.shotsFired * 100)}%` : '—';
    const totals: [Parameters<typeof t>[0], string][] = [
      ['records.runs', String(profile.runs)],
      ['records.victories', String(profile.victories)],
      ['records.kills', String(life.kills)],
      ['records.bossKills', String(life.bossKills)],
      ['records.playTime', formatDuration(life.playTimeMs)],
      ['records.accuracy', accuracy],
      ['records.fastest', life.fastestVictoryMs ? formatDuration(life.fastestVictoryMs) : '—'],
      ['records.earned', String(life.creditsEarned)],
    ];
    totals.forEach(([key, text], index) => {
      const y = 176 + index * 42;
      this.add.rectangle(ox + 215, y, 300, 36, 0x0b1b2b, 0.95).setStrokeStyle(1, 0x214c65);
      this.add.text(ox + 76, y, t(key), label).setOrigin(0, 0.5);
      this.add.text(ox + 354, y, text, value).setOrigin(1, 0.5).setName(`records-${key}`);
    });
    if (profile.daily.bestScore > 0) {
      this.add.text(ox + 70, 520, `${t('records.dailyBest', { date: profile.daily.date })}  ${profile.daily.bestScore}`, {
        ...label, color: '#ffc857',
      });
      // Through the online port: offline it is this device's board, with a backend the world's.
      void onlineService().fetchDailyBoard(profile.daily.date).then(board => {
        if (!this.sys.isActive() || !board.length) return;
        this.add.text(ox + 70, 544, board.map(entry => `${entry.rank}. ${entry.displayName}  ${entry.score}`).join('\n'), {
          fontFamily: 'monospace', fontSize: '11px', color: '#c7d9e2', lineSpacing: 3,
        }).setName('records-daily-board');
      }).catch(() => undefined);
    }

    this.add.text(ox + 410, 140, t('records.history'), { ...label, color: '#21e6ff', fontSize: '14px' });
    const history = [...profile.history].reverse().slice(0, 9);
    if (!history.length) this.add.text(ox + 410, 180, t('records.empty'), { ...label, fontSize: '13px' });
    history.forEach((run, index) => {
      const y = 176 + index * 38;
      const accent = run.victory ? 0x73ef62 : 0xff476f;
      this.add.rectangle(ox + 610, y, 400, 32, 0x0b1b2b, 0.95).setStrokeStyle(1, accent, 0.45);
      this.add.text(ox + 418, y, run.victory ? t('records.win') : t('records.loss'), {
        ...label, color: run.victory ? '#73ef62' : '#ff476f',
      }).setOrigin(0, 0.5);
      const sector = ARENA_THEMES[Math.min(run.sector, ARENA_THEMES.length - 1)].subtitle;
      this.add.text(ox + 510, y, `${sector} · ${starterWeapon(run.weaponId).name}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#c7d9e2',
      }).setOrigin(0, 0.5);
      this.add.text(ox + 802, y, `N${run.level} · ${formatDuration(run.durationMs)} · +${run.credits}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffc857',
      }).setOrigin(1, 0.5);
    });

    this.add.text(ox + 840, 140, t('records.achievements', { owned: profile.achievements.length, total: ACHIEVEMENTS.length }), {
      ...label, color: '#21e6ff', fontSize: '14px',
    });
    ACHIEVEMENTS.forEach((achievement, index) => {
      const y = 176 + index * 40;
      const owned = profile.achievements.includes(achievement.id);
      this.add.rectangle(ox + 1025, y, 370, 34, owned ? 0x14331f : 0x0b1b2b, 0.95)
        .setStrokeStyle(1, owned ? 0x73ef62 : 0x214c65, owned ? 0.9 : 0.6);
      this.add.text(ox + 850, y - 7, td(achievement.name), {
        fontFamily: 'Arial Black', fontSize: '12px', color: owned ? '#73ef62' : '#7594a8',
      }).setOrigin(0, 0.5);
      this.add.text(ox + 850, y + 8, td(achievement.description), {
        fontFamily: 'Arial', fontSize: '10px', color: owned ? '#c7d9e2' : '#5d7688',
      }).setOrigin(0, 0.5);
      this.add.text(ox + 1200, y, `+${achievement.reward}`, {
        fontFamily: 'monospace', fontSize: '11px', color: owned ? '#ffc857' : '#5d7688',
      }).setOrigin(1, 0.5);
    }, this);
    backToMenu(this, GAME_WIDTH / 2, 650, t('common.back'));
  }
}
