import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { ARENA_THEMES } from '../config/ArenaDefinitions';
import { t, td } from '../i18n';
import { ACHIEVEMENTS } from '../progression/Achievements';
import { loadProfile } from '../systems/ProfileStore';
import { starterWeapon } from '../weapons/WeaponRegistry';
import {
  UI, backToMenu, fitText, framePanel, panelButton, subMenuFrame, uiFont, type PanelButton,
} from '../ui/SceneWidgets';
import { onlineService } from '../online/OnlinePorts';
import { dailyOperation } from '../progression/DailyOperation';

export function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}:${rest}`;
}

type Profile = ReturnType<typeof loadProfile>;
type Layer = Phaser.GameObjects.Container;

/**
 * Lifetime totals, the recent run log, the achievement board and today's daily board. Read-only.
 * One tab at a time, each using the full width: three dense columns were unreadable on a phone.
 * Hidden tabs keep their objects, so every value stays in the scene.
 */
export class RecordsScene extends Phaser.Scene {
  constructor() { super('Records'); }

  create() {
    this.game.canvas.dataset.scene = 'Records';
    subMenuFrame(this, GAME_WIDTH, GAME_HEIGHT, t('records.title'), t('records.subtitle'), UI.cyan);
    const profile = loadProfile();
    const cx = GAME_WIDTH / 2;
    const tabs: { id: string; label: string; layer: Layer; button?: PanelButton }[] = [
      { id: 'totals', label: t('records.lifetime'), layer: this.add.container(0, 0) },
      { id: 'history', label: t('records.tabHistory'), layer: this.add.container(0, 0) },
      {
        id: 'achievements',
        label: t('records.achievements', { owned: profile.achievements.length, total: ACHIEVEMENTS.length }),
        layer: this.add.container(0, 0),
      },
      { id: 'today', label: t('records.tabToday'), layer: this.add.container(0, 0) },
    ];
    let active = 0;
    const show = (index: number) => {
      active = (index + tabs.length) % tabs.length;
      tabs.forEach((tab, tabIndex) => {
        tab.layer.setVisible(tabIndex === active);
        tab.button?.setSelected(tabIndex === active);
      });
    };
    const tabWidth = 262;
    tabs.forEach((tab, index) => {
      tab.button = panelButton(this, cx + (index - 1.5) * (tabWidth + 12), 166, tabWidth, 50, tab.label, UI.cyan,
        () => show(index), 14, { name: `records-tab-${tab.id}` });
    });

    this.buildTotals(tabs[0].layer, profile, cx);
    this.buildHistory(tabs[1].layer, profile, cx);
    this.buildAchievements(tabs[2].layer, profile, cx);
    this.buildToday(tabs[3].layer, profile, cx);
    show(0);
    this.input.keyboard?.on('keydown-LEFT', () => show(active - 1));
    this.input.keyboard?.on('keydown-RIGHT', () => show(active + 1));
    backToMenu(this, cx, 652, t('common.back'));
  }

  private buildTotals(layer: Layer, profile: Profile, cx: number) {
    const life = profile.lifetime;
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
      const x = cx + (index % 2 === 0 ? -280 : 280);
      const y = 250 + Math.floor(index / 2) * 84;
      layer.add(framePanel(this, x, y, 540, 72, UI.cyan, { strokeAlpha: 0.35, band: 0.06, cut: 12, brackets: false }));
      layer.add(fitText(this.add.text(x - 248, y, t(key), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 13), color: UI.muted, letterSpacing: 1,
      }).setOrigin(0, 0.5), 330));
      layer.add(this.add.text(x + 248, y, text, {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 26), color: UI.text,
      }).setOrigin(1, 0.5).setName(`records-${key}`));
    });
  }

  private buildHistory(layer: Layer, profile: Profile, cx: number) {
    const history = [...profile.history].reverse().slice(0, 7);
    if (!history.length) layer.add(this.add.text(cx, 330, t('records.empty'), {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 16), color: UI.muted,
    }).setOrigin(0.5));
    history.forEach((run, index) => {
      const y = 232 + index * 54;
      const accent = run.victory ? UI.green : UI.red;
      layer.add(framePanel(this, cx, y, 1100, 46, accent, { strokeAlpha: 0.4, band: 0.06, cut: 10, brackets: false }));
      layer.add(this.add.text(cx - 530, y, run.victory ? t('records.win') : t('records.loss'), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 14), color: run.victory ? '#73ef62' : '#ff476f',
      }).setOrigin(0, 0.5));
      const sector = ARENA_THEMES[Math.min(run.sector, ARENA_THEMES.length - 1)].subtitle;
      layer.add(fitText(this.add.text(cx - 330, y, `${sector} · ${starterWeapon(run.weaponId).name}`, {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 14), color: UI.text,
      }).setOrigin(0, 0.5), 440));
      layer.add(this.add.text(cx + 530, y, `N${run.level} · ${formatDuration(run.durationMs)} · +${run.credits}`, {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 14), color: '#ffc857',
      }).setOrigin(1, 0.5));
    });
  }

  private buildAchievements(layer: Layer, profile: Profile, cx: number) {
    ACHIEVEMENTS.forEach((achievement, index) => {
      const x = cx + (index % 2 === 0 ? -280 : 280);
      const y = 236 + Math.floor(index / 2) * 74;
      const owned = profile.achievements.includes(achievement.id);
      layer.add(framePanel(this, x, y, 540, 64, owned ? UI.green : UI.line, {
        fill: owned ? 0x10301d : UI.panel, strokeAlpha: owned ? 0.9 : 0.7, band: owned ? 0.1 : 0.04, cut: 10, brackets: owned,
      }));
      layer.add(fitText(this.add.text(x - 252, y - 13, td(achievement.name), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 15), color: owned ? '#73ef62' : UI.muted,
      }).setOrigin(0, 0.5), 400));
      layer.add(fitText(this.add.text(x - 252, y + 15, td(achievement.description), {
        fontFamily: 'Arial', fontSize: uiFont(this, 12), color: owned ? UI.body : '#7d95a6',
      }).setOrigin(0, 0.5), 420));
      layer.add(this.add.text(x + 252, y, `+${achievement.reward}`, {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 14), color: owned ? '#ffc857' : '#7d95a6',
      }).setOrigin(1, 0.5));
    });
  }

  private buildToday(layer: Layer, profile: Profile, cx: number) {
    // Today's board is always shown, played or not: seeing the competition is the invitation.
    // Through the online port: offline it is this device's board, with a backend the world's.
    const today = dailyOperation().date;
    const mine = profile.daily.date === today && profile.daily.bestScore > 0
      ? `   ·   ${t('records.yourBest', { score: profile.daily.bestScore })}` : '';
    layer.add(this.add.text(cx, 222, `${t('records.todayBoard', { date: today })}${mine}`, {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 16), color: '#ffc857',
    }).setOrigin(0.5));
    void onlineService().fetchDailyBoard(today).then(board => {
      if (!this.sys.isActive()) return;
      if (!board.length) {
        layer.add(this.add.text(cx, 320, t('records.boardEmpty'), {
          fontFamily: 'Arial Black', fontSize: uiFont(this, 15), color: UI.muted,
        }).setOrigin(0.5).setName('records-daily-board'));
        return;
      }
      board.slice(0, 10).forEach((entry, index) => {
        const x = cx + (index < 5 ? -280 : 280);
        const y = 276 + (index % 5) * 62;
        const top = entry.rank === 1;
        layer.add(framePanel(this, x, y, 540, 52, top ? UI.gold : UI.line, {
          strokeAlpha: top ? 0.9 : 0.6, band: 0.06, cut: 10, brackets: top,
        }));
        const name = this.add.text(x - 250, y, `${entry.rank}.  ${entry.displayName}`, {
          fontFamily: 'Arial Black', fontSize: uiFont(this, 16), color: top ? '#ffc857' : UI.text,
        }).setOrigin(0, 0.5);
        if (index === 0) name.setName('records-daily-board');
        layer.add(name);
        layer.add(this.add.text(x + 250, y, String(entry.score), {
          fontFamily: 'Arial Black', fontSize: uiFont(this, 18), color: top ? '#ffc857' : UI.text,
        }).setOrigin(1, 0.5));
      });
    }).catch(() => undefined);
  }
}
