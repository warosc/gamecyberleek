import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import { td } from '../i18n';
import { reducedMotion } from '../systems/RuntimeSettings';
import { fitText } from './SceneWidgets';
import { hudFont, isCompactHud } from './HudLayout';
import { DISPLAY_FONT } from '../config/Fonts';

/** Short tactical callout shown only when the enemy roster changes. */
export class PhaseBanner {
  private active?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly mobile: boolean) {}

  show(phase: { title: string; brief: string; color: number }) {
    this.active?.destroy(true);
    // Phone-sized type: "{score} PTS EN VIVO · ¡RECUPERA EL PUESTO!" is ~540px at 22px monospace,
    // past the 500px phone banner, so the compact banner is 640 wide and its lines fit to it.
    const compact = isCompactHud(this.scene);
    const width = compact ? 640 : this.mobile ? 500 : 620;
    const height = compact ? 90 : 78;
    const back = this.scene.add.rectangle(0, 0, width, height, 0x06101d, 0.94)
      .setStrokeStyle(3, phase.color, 0.92);
    const marker = this.scene.add.rectangle(-width / 2 + 6, 0, 8, height - 16, phase.color, 1);
    const title = fitText(this.scene.add.text(0, compact ? -17 : -14, td(phase.title), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this.scene, this.mobile ? 20 : 23), color: '#ffffff', letterSpacing: 2,
    }).setOrigin(0.5), width - 40, 14);
    const brief = fitText(this.scene.add.text(0, compact ? 22 : 18, td(phase.brief), {
      fontFamily: 'monospace', fontSize: hudFont(this.scene, this.mobile ? 11 : 12),
      color: `#${phase.color.toString(16).padStart(6, '0')}`, letterSpacing: 2,
    }).setOrigin(0.5), width - 40, 10);
    // Depth 90 keeps this under the level-up/chest/pause modals (depth 100+): a phase
    // callout can fire the instant an XP level-up opens one, and at depth 125 the banner
    // used to render on top of the modal's title, making it unreadable mid-combat.
    // Under reduced motion it fades in place instead of dropping and zooming in.
    const still = reducedMotion();
    const banner = this.scene.add.container(GAME_WIDTH / 2, still ? 150 : 120, [back, marker, title, brief])
      .setName('phase-banner').setDepth(90).setAlpha(0).setScale(still ? 1 : 0.88);
    this.active = banner;
    this.scene.tweens.add({
      targets: banner, y: 150, alpha: 1, scale: 1, duration: 220, ease: still ? 'Linear' : 'Back.Out', hold: 1450, yoyo: true,
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
