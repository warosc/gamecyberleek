import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { t, td } from '../i18n';
import { WORKSHOP_UPGRADES, nextRankCost, type WorkshopUpgradeId } from '../progression/Workshop';
import { loadProfile, purchaseWorkshopRank } from '../systems/ProfileStore';
import { AudioManager } from '../managers/AudioManager';
import { backToMenu, hex, panelButton, subMenuFrame } from '../ui/SceneWidgets';
import { shakeCamera } from '../systems/RuntimeSettings';

/** Spends bio-credits on small permanent upgrades; the only credit sink outside a run. */
export class WorkshopScene extends Phaser.Scene {
  private audio?: AudioManager;
  private balance!: Phaser.GameObjects.Text;
  private readonly rows = new Map<WorkshopUpgradeId, {
    rank: Phaser.GameObjects.Text;
    pips: Phaser.GameObjects.Rectangle[];
    button: { box: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
  }>();

  constructor() { super('Workshop'); }

  create() {
    this.game.canvas.dataset.scene = 'Workshop';
    this.audio = new AudioManager(this);
    this.rows.clear();
    subMenuFrame(this, GAME_WIDTH, GAME_HEIGHT, t('workshop.title'), t('workshop.subtitle'), 0xffc857);
    this.balance = this.add.text(GAME_WIDTH / 2, 146, '', {
      fontFamily: 'Arial Black', fontSize: '20px', color: '#ffc857', letterSpacing: 2,
    }).setOrigin(0.5).setName('workshop-balance');

    // Offset from the 1280 design width so the list stays centred on wide phone canvases.
    const ox = (GAME_WIDTH - 1280) / 2;
    WORKSHOP_UPGRADES.forEach((upgrade, index) => {
      const y = 212 + index * 80;
      // The whole row is a purchase target, not only the button: rows are tall enough to tap.
      this.add.rectangle(GAME_WIDTH / 2, y, 1000, 72, 0x0b1b2b, 0.95).setStrokeStyle(2, upgrade.color, 0.5)
        .setInteractive({ useHandCursor: true }).on('pointerup', () => this.buy(upgrade.id));
      this.add.text(ox + 170, y - 13, td(upgrade.name), { fontFamily: 'Arial Black', fontSize: '18px', color: hex(upgrade.color) }).setOrigin(0, 0.5);
      this.add.text(ox + 170, y + 15, td(upgrade.effect), { fontFamily: 'Arial', fontSize: '14px', color: '#a9bbc9' }).setOrigin(0, 0.5);
      const pips = upgrade.costs.map((_, pip) =>
        this.add.rectangle(ox + 560 + pip * 34, y, 26, 14, upgrade.color, 0.15).setStrokeStyle(2, upgrade.color, 0.7));
      const rank = this.add.text(ox + 560 + upgrade.costs.length * 34 + 8, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#eaffff',
      }).setOrigin(0, 0.5);
      const button = panelButton(this, ox + 1000, y, 220, 58, '', upgrade.color, () => this.buy(upgrade.id), 15);
      button.box.setName(`workshop-buy-${upgrade.id}`);
      this.rows.set(upgrade.id, { rank, pips, button });
    });
    this.refresh();
    backToMenu(this, GAME_WIDTH / 2, 638, t('common.back'));
  }

  private buy(id: WorkshopUpgradeId) {
    const profile = purchaseWorkshopRank(id);
    if (!profile) {
      this.audio?.play('ui_deny');
      shakeCamera(this.cameras.main, 90, 0.003);
      return;
    }
    this.audio?.play('ui_confirm');
    this.refresh();
  }

  private refresh() {
    const profile = loadProfile();
    this.balance.setText(t('workshop.balance', { credits: profile.bioCredits }));
    for (const upgrade of WORKSHOP_UPGRADES) {
      const row = this.rows.get(upgrade.id)!;
      const rank = profile.workshop[upgrade.id];
      row.pips.forEach((pip, index) => pip.setFillStyle(upgrade.color, index < rank ? 0.9 : 0.15));
      row.rank.setText(t('workshop.rank', { rank, max: upgrade.costs.length }));
      const cost = nextRankCost(upgrade.id, profile.workshop);
      const affordable = cost !== undefined && profile.bioCredits >= cost;
      row.button.text.setText(cost === undefined ? t('workshop.maxed')
        : affordable ? t('workshop.buy', { cost }) : t('workshop.short', { missing: cost - profile.bioCredits }));
      row.button.box.setAlpha(affordable ? 1 : 0.55);
    }
  }
}
