import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';

/** Short tactical callout shown only when the enemy roster changes. */
export class PhaseBanner {
  private active?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly mobile: boolean) {}

  show(phase: { title: string; brief: string; color: number }) {
    this.active?.destroy(true);
    const width = this.mobile ? 500 : 620;
    const back = this.scene.add.rectangle(0, 0, width, 78, 0x06101d, 0.94)
      .setStrokeStyle(3, phase.color, 0.92);
    const marker = this.scene.add.rectangle(-width / 2 + 6, 0, 8, 62, phase.color, 1);
    const title = this.scene.add.text(0, -14, phase.title, {
      fontFamily: 'Arial Black', fontSize: this.mobile ? '20px' : '23px', color: '#ffffff', letterSpacing: 2,
    }).setOrigin(0.5);
    const brief = this.scene.add.text(0, 18, phase.brief, {
      fontFamily: 'monospace', fontSize: this.mobile ? '11px' : '12px',
      color: `#${phase.color.toString(16).padStart(6, '0')}`, letterSpacing: 2,
    }).setOrigin(0.5);
    const banner = this.scene.add.container(GAME_WIDTH / 2, 120, [back, marker, title, brief])
      .setName('phase-banner').setDepth(125).setAlpha(0).setScale(0.88);
    this.active = banner;
    this.scene.tweens.add({
      targets: banner, y: 150, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out', hold: 1450, yoyo: true,
      onComplete: () => {
        if (this.active === banner) this.active = undefined;
        banner.destroy(true);
      },
    });
  }

  destroy() {
    this.active?.destroy(true);
    this.active = undefined;
  }
}
