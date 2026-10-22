import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import { MOMENTUM_WINDOW_MS, type MomentumState } from '../systems/CombatMomentum';
import { t } from '../i18n';
import { reducedMotion } from '../systems/RuntimeSettings';
import { RIGHT_EDGE_INSET, hudFont, isCompactHud, rightColumn } from './HudLayout';
import { DISPLAY_FONT } from '../config/Fonts';

export class MomentumHud {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly count: Phaser.GameObjects.Text;
  private readonly bonus: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Rectangle;
  private readonly barWidth: number;
  private expiresAt = 0;

  constructor(scene: Phaser.Scene, mobile: boolean) {
    // Its own slot in the right-hand stack (HudLayout): it used to open over the objective panel.
    const compact = isCompactHud(scene);
    const { momentumY: y, momentumWidth: width } = rightColumn(mobile, compact);
    const height = compact ? 76 : 68;
    const x = GAME_WIDTH - RIGHT_EDGE_INSET - width / 2;
    this.barWidth = width - 28;
    const back = scene.add.rectangle(0, 0, width, height, 0x06101d, 0.88).setStrokeStyle(2, 0xffc857, 0.75);
    this.count = scene.add.text(-width / 2 + 18, -height / 2 + 14, t('hud.chain', { chain: 2 }), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(scene, 16), color: '#ffffff',
    });
    this.bonus = scene.add.text(width / 2 - 18, -height / 2 + 16, t('hud.chainBonus', { percent: 0 }), {
      fontFamily: 'monospace', fontSize: hudFont(scene, 11), color: '#ffc857',
    }).setOrigin(1, 0);
    const barY = height / 2 - 15;
    const barBack = scene.add.rectangle(-this.barWidth / 2, barY, this.barWidth, 7, 0x221b10, 1).setOrigin(0, 0.5);
    this.timer = scene.add.rectangle(-this.barWidth / 2, barY, this.barWidth, 5, 0xffc857, 1).setOrigin(0, 0.5);
    this.panel = scene.add.container(x, y, [back, barBack, this.count, this.bonus, this.timer])
      .setDepth(85).setVisible(false).setName('momentum-hud');
  }

  set(state: MomentumState) {
    this.expiresAt = state.expiresAt;
    this.panel.setVisible(state.chain >= 2);
    if (state.chain < 2) return;
    this.count.setText(t('hud.chain', { chain: state.chain }));
    this.bonus.setText(t('hud.chainBonus', { percent: Math.round((state.xpMultiplier - 1) * 100) }));
    // A pop on every kill of a long chain is a constant pulse in the corner of the eye.
    if (reducedMotion()) return;
    this.panel.setScale(1.08);
    this.panel.scene.tweens.add({ targets: this.panel, scale: 1, duration: 110, ease: 'Quad.Out' });
  }

  update(time: number) {
    if (!this.panel.visible) return;
    this.timer.width = this.barWidth * Phaser.Math.Clamp((this.expiresAt - time) / MOMENTUM_WINDOW_MS, 0, 1);
  }
}
