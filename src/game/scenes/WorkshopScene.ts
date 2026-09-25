import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { t, td } from '../i18n';
import { WORKSHOP_UPGRADES, nextRankCost, type WorkshopUpgradeId } from '../progression/Workshop';
import { loadProfile, purchaseWorkshopRank } from '../systems/ProfileStore';
import { AudioManager } from '../managers/AudioManager';
import { UI, backToMenu, framePanel, hex, panelButton, subMenuFrame, uiFont, type PanelButton } from '../ui/SceneWidgets';
import { shakeCamera } from '../systems/RuntimeSettings';

/** Spends bio-credits on small permanent upgrades; the only credit sink outside a run. */
export class WorkshopScene extends Phaser.Scene {
  private audio?: AudioManager;
  private balance!: Phaser.GameObjects.Text;
  private readonly rows = new Map<WorkshopUpgradeId, {
    rank: Phaser.GameObjects.Text;
    pips: Phaser.GameObjects.Rectangle[];
    button: PanelButton;
  }>();

  constructor() { super('Workshop'); }

  create() {
    this.game.canvas.dataset.scene = 'Workshop';
    this.audio = new AudioManager(this);
    this.rows.clear();
    subMenuFrame(this, GAME_WIDTH, GAME_HEIGHT, t('workshop.title'), t('workshop.subtitle'), 0xffc857);
    this.balance = this.add.text(GAME_WIDTH / 2, 150, '', {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 20), color: '#ffc857', letterSpacing: 2,
    }).setOrigin(0.5).setName('workshop-balance');

    // Offset from the 1280 design width so the list stays centred on wide phone canvases.
    const ox = (GAME_WIDTH - 1280) / 2;
    WORKSHOP_UPGRADES.forEach((upgrade, index) => {
      const y = 216 + index * 80;
      // The whole row is a purchase target, not only the button: rows are tall enough to tap.
      framePanel(this, GAME_WIDTH / 2, y, 1040, 70, upgrade.color, { strokeAlpha: 0.45, band: 0.07, cut: 12 });
      this.add.rectangle(GAME_WIDTH / 2, y, 1040, 70, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true }).on('pointerup', () => this.buy(upgrade.id));
      this.add.rectangle(ox + 128, y, 5, 46, upgrade.color, 0.9);
      this.add.text(ox + 146, y - 14, td(upgrade.name), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 18), color: hex(upgrade.color),
      }).setOrigin(0, 0.5);
      this.add.text(ox + 146, y + 16, td(upgrade.effect), {
        fontFamily: 'Arial', fontSize: uiFont(this, 14), color: UI.body,
      }).setOrigin(0, 0.5);
      const pips = upgrade.costs.map((_, pip) =>
        this.add.rectangle(ox + 560 + pip * 34, y - 10, 26, 14, upgrade.color, 0.15).setStrokeStyle(2, upgrade.color, 0.7));
      const rank = this.add.text(ox + 548, y + 16, '', {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 12), color: UI.muted,
      }).setOrigin(0, 0.5);
      const button = panelButton(this, ox + 1010, y, 230, 54, '', upgrade.color, () => this.buy(upgrade.id), 15,
        { name: `workshop-buy-${upgrade.id}` });
      this.rows.set(upgrade.id, { rank, pips, button });
    });
    this.refresh();
    backToMenu(this, GAME_WIDTH / 2, 648, t('common.back'));
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
      row.button.setLabel(cost === undefined ? t('workshop.maxed')
        : affordable ? t('workshop.buy', { cost }) : t('workshop.short', { missing: cost - profile.bioCredits }));
      row.button.setDimmed(!affordable);
    }
  }
}
