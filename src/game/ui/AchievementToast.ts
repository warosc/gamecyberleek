import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { DISPLAY_FONT } from '../config/Fonts';
import { reducedMotion } from '../systems/RuntimeSettings';
import { fitText } from './SceneWidgets';
import { hudFont, isCompactHud } from './HudLayout';

export interface AchievementSpec {
  /** Small gold line above the name, e.g. "CONTRATO COMPLETADO". */
  kicker: string;
  title: string;
  /** The reward, shown in green under the name. */
  detail: string;
  /** One glyph for the emblem. */
  icon: string;
  /** Accent for the emblem ring's inner glow; the frame itself is always gold. */
  color: number;
}

const GOLD = 0xffc857;
const HOLD_MS = 2600;

/**
 * Achievement-style notification for a completed contract or sector objective.
 *
 * A completion used to show only as a small pop on its corner row, which players missed in a
 * fight. This plate rises in the lower centre, the way an MMO announces an achievement: above
 * the XP bar and ability buttons, below the player, never pausing play. Completions that land
 * together queue rather than stack on top of each other.
 */
export class AchievementToast {
  private readonly queue: AchievementSpec[] = [];
  private showing = false;
  private readonly width: number;
  private readonly height: number;
  private readonly y: number;
  /** Phone-sized type: the shared floor lifts the kicker to the name's size, so the name grows. */
  private readonly titleSize: string;

  constructor(private readonly scene: Phaser.Scene, mobile: boolean) {
    const compact = isCompactHud(scene);
    this.width = compact ? 760 : 520;
    this.height = compact ? 112 : 84;
    // Phones keep their ability bar in the bottom centre (its top near GAME_HEIGHT - 131), so the
    // plate sits just above it, under the player's feet; desktop has that space above the XP bar.
    this.y = mobile || compact ? GAME_HEIGHT - 131 - 8 - this.height / 2 : GAME_HEIGHT - 150;
    this.titleSize = compact ? '32px' : hudFont(scene, 20);
  }

  show(spec: AchievementSpec) {
    this.queue.push(spec);
    if (!this.showing) this.next();
  }

  private next() {
    const spec = this.queue.shift();
    if (!spec) {
      this.showing = false;
      return;
    }
    this.showing = true;
    const { scene, width, height } = this;
    const left = -width / 2;
    const emblemX = left + height / 2 + 4;
    const emblemRadius = height / 2 - 12;
    const textLeft = emblemX + emblemRadius + 18;
    const textWidth = width / 2 - textLeft - 16;
    const parts: Phaser.GameObjects.GameObject[] = [
      scene.add.rectangle(0, 0, width + 10, height + 10, GOLD, 0.16),
      scene.add.rectangle(0, 0, width, height, 0x0a1220, 0.96).setStrokeStyle(3, GOLD, 0.95),
      scene.add.rectangle(0, -height / 2 + 3, width - 6, 3, GOLD, 0.35),
      scene.add.circle(emblemX, 0, emblemRadius + 5, GOLD, 0.25),
      scene.add.circle(emblemX, 0, emblemRadius, 0x06101d, 1).setStrokeStyle(4, GOLD, 1),
      scene.add.circle(emblemX, 0, emblemRadius - 8, spec.color, 0.18),
      scene.add.text(emblemX, 0, spec.icon, {
        fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: `${Math.round(emblemRadius * 1.1)}px`, color: '#ffe3a1',
      }).setOrigin(0.5),
    ];
    const kicker = fitText(scene.add.text(textLeft, -height / 2 + 12, spec.kicker, {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(scene, 11), color: '#ffc857', letterSpacing: 3,
    }), textWidth, 9);
    const title = fitText(scene.add.text(textLeft, 0, spec.title, {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: this.titleSize, color: '#ffffff',
      stroke: '#0a1220', strokeThickness: 3,
    }).setOrigin(0, 0.5), textWidth, 12);
    const detail = fitText(scene.add.text(textLeft, height / 2 - 12, spec.detail, {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(scene, 12), color: '#73ef62',
    }).setOrigin(0, 1), textWidth, 9);
    parts.push(kicker, title, detail);
    // Depth 96: over the briefing rows and banners, under every modal (100+).
    const plate = scene.add.container(GAME_WIDTH / 2, this.y, parts).setDepth(96).setName('achievement-toast');

    const finish = () => {
      plate.destroy(true);
      this.next();
    };
    if (reducedMotion()) {
      plate.setAlpha(0);
      scene.tweens.add({ targets: plate, alpha: 1, duration: 200, hold: HOLD_MS, yoyo: true, onComplete: finish });
      return;
    }
    // Light sweeping across the plate once it has landed: the beat that says "achievement".
    // It travels inside the frame and fades at both ends: a geometry mask does not clip inside
    // a container here, and the sweep spilled past the plate's right edge.
    const shine = scene.add.rectangle(left + 40, 0, 40, height - 10, 0xffffff, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    plate.add(shine);
    plate.setAlpha(0).setScale(0.6);
    scene.tweens.add({
      targets: plate, alpha: 1, scale: 1, duration: 320, ease: 'Back.Out',
      onComplete: () => {
        scene.tweens.add({ targets: shine, x: width / 2 - 40, duration: 650, ease: 'Sine.InOut' });
        scene.tweens.add({ targets: shine, alpha: 1, duration: 325, yoyo: true });
        scene.tweens.add({
          targets: plate, alpha: 0, y: this.y + 24, delay: HOLD_MS, duration: 320, ease: 'Quad.In',
          onComplete: finish,
        });
      },
    });
  }

  destroy() {
    this.queue.length = 0;
  }
}
