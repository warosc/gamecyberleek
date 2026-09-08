import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import { MOMENTUM_WINDOW_MS, type MomentumState } from '../systems/CombatMomentum';

export class MomentumHud {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly count: Phaser.GameObjects.Text;
  private readonly bonus: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Rectangle;
  private expiresAt = 0;

  constructor(scene: Phaser.Scene, mobile: boolean) {
    const x = GAME_WIDTH - (mobile ? 118 : 145);
    const y = mobile ? 110 : 205;
    const back = scene.add.rectangle(0, 0, 220, 68, 0x06101d, 0.88).setStrokeStyle(2, 0xffc857, 0.75);
    this.count = scene.add.text(-92, -20, 'CHAIN x2', {
      fontFamily: 'Arial Black', fontSize: '16px', color: '#ffffff',
    });
    this.bonus = scene.add.text(92, -18, '+0% XP', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffc857',
    }).setOrigin(1, 0);
    scene.add.rectangle(-96, 19, 192, 7, 0x221b10, 1).setOrigin(0, 0.5);
    this.timer = scene.add.rectangle(-96, 19, 192, 5, 0xffc857, 1).setOrigin(0, 0.5);
    this.panel = scene.add.container(x, y, [back, this.count, this.bonus, this.timer])
      .setDepth(85).setVisible(false).setName('momentum-hud');
  }

  set(state: MomentumState) {
    this.expiresAt = state.expiresAt;
    this.panel.setVisible(state.chain >= 2);
    if (state.chain < 2) return;
    this.count.setText(`CHAIN x${state.chain}`);
    this.bonus.setText(`+${Math.round((state.xpMultiplier - 1) * 100)}% XP`);
    this.panel.setScale(1.08);
    this.panel.scene.tweens.add({ targets: this.panel, scale: 1, duration: 110, ease: 'Quad.Out' });
  }

  update(time: number) {
    if (!this.panel.visible) return;
    this.timer.width = 192 * Phaser.Math.Clamp((this.expiresAt - time) / MOMENTUM_WINDOW_MS, 0, 1);
  }
}
