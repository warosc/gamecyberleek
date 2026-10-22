import Phaser from 'phaser';
import { hudFont, isCompactHud } from './HudLayout';

export interface RewardCardSpec {
  accent: number;
  /** One short symbol. A glyph is read faster than a truncated word. */
  icon: string;
  name: string;
  /** Single line. Anything longer stops being readable inside two seconds. */
  effect: string;
  /** Progress footer, e.g. the level this pick takes the upgrade to. */
  footer?: string;
  /** Filled/total pips, so current strength and the cap are visible without reading. */
  pips?: { filled: number; total: number };
}

/**
 * Card geometry. On a phone-sized display (0.46 scale on an iPhone Pro Max) the 15px effect line
 * drew at 7 CSS px; at 22px it needs three wrapped lines, so the cards grow to 340x330 and the
 * row to 1080px, which still fits the narrowest widened phone canvas (1281).
 */
export function rewardCardLayout(compact: boolean) {
  return compact
    ? { width: 340, height: 330, spacing: 370, icon: 46, iconRadius: 30, title: 110, effect: 190, pips: 258, footer: 290, badge: 24, badgeRadius: 18 }
    : { width: 264, height: 292, spacing: 300, icon: 54, iconRadius: 34, title: 108, effect: 158, pips: 208, footer: 236, badge: 22, badgeRadius: 15 };
}
const HOTKEYS = ['ONE', 'TWO', 'THREE'] as const;
/**
 * A modal opens mid-combat, while the player is still clicking to fire or pressing the pad's A
 * to dash (the gamepad bridge replays A as ENTER outside combat). For this long after opening,
 * a click or ENTER is taken as that combat input and ignored. The number keys are never combat
 * input, so they work at once.
 */
export const REWARD_ARM_MS = 450;

/**
 * The level-up and supply-chest choices, as one component.
 *
 * Both modals previously built their own near-identical cards inline in `UIScene`, and neither
 * could be operated from the keyboard: the run stopped dead and the only way forward was to
 * find a card with the mouse. These cards accept a click, a touch, the number keys, and the
 * arrow keys with Enter, and they show level pips so the player can see how much of an upgrade
 * is left before reading a word.
 */
export class RewardChooser {
  private readonly disposers: Array<() => void> = [];
  private readonly cards: Phaser.GameObjects.Rectangle[] = [];
  private readonly glows: Phaser.GameObjects.Rectangle[] = [];
  private focus = 0;
  private resolved = false;
  private armedAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onSelect: (index: number) => void,
  ) {}

  build(specs: RewardCardSpec[], centerX: number, centerY: number) {
    this.armedAt = this.scene.time.now + REWARD_ARM_MS;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const layout = rewardCardLayout(isCompactHud(this.scene));
    const { width: CARD_WIDTH, height: CARD_HEIGHT } = layout;
    specs.forEach((spec, index) => {
      const x = centerX + (index - (specs.length - 1) / 2) * layout.spacing;
      const glow = this.scene.add
        .rectangle(x, centerY, CARD_WIDTH + 14, CARD_HEIGHT + 14, spec.accent, 0.12)
        .setStrokeStyle(1, spec.accent, 0.28);
      const card = this.scene.add
        .rectangle(x, centerY, CARD_WIDTH, CARD_HEIGHT, 0x0b1d30, 0.98)
        .setStrokeStyle(3, spec.accent, 0.9)
        .setInteractive({ useHandCursor: true });
      const hex = `#${spec.accent.toString(16).padStart(6, '0')}`;
      const top = centerY - CARD_HEIGHT / 2;

      const icon = this.scene.add
        .circle(x, top + layout.icon, layout.iconRadius, 0x06101d, 1)
        .setStrokeStyle(3, spec.accent, 0.95);
      const iconLabel = this.scene.add
        .text(x, top + layout.icon, spec.icon, { fontFamily: 'Arial Black', fontSize: '30px', color: hex })
        .setOrigin(0.5);
      const title = this.scene.add
        .text(x, top + layout.title, spec.name, {
          fontFamily: 'Arial Black',
          fontSize: hudFont(this.scene, 19),
          color: '#eaffff',
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 36 },
        })
        .setOrigin(0.5);
      const effect = this.scene.add
        .text(x, top + layout.effect, spec.effect, {
          fontSize: hudFont(this.scene, 15),
          color: '#c3d5df',
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 44 },
        })
        .setOrigin(0.5);
      parts.push(glow, card, icon, iconLabel, title, effect);

      if (spec.pips) {
        // Pips read as "how much of this upgrade is left" at a glance, which a level number
        // beside a cap does not.
        const total = spec.pips.total;
        const pipWidth = Math.min(26, (CARD_WIDTH - 60) / total - 6);
        const spacing = pipWidth + 6;
        for (let pip = 0; pip < total; pip++) {
          const pipX = x + (pip - (total - 1) / 2) * spacing;
          parts.push(
            this.scene.add
              .rectangle(pipX, top + layout.pips, pipWidth, 7, spec.accent, pip < spec.pips.filled ? 1 : 0.16)
              .setStrokeStyle(1, spec.accent, pip < spec.pips.filled ? 1 : 0.4),
          );
        }
      }
      if (spec.footer)
        parts.push(
          this.scene.add
            .text(x, top + layout.footer, spec.footer, {
              fontFamily: 'Arial Black',
              fontSize: hudFont(this.scene, 12),
              color: hex,
            })
            .setOrigin(0.5),
        );

      // Hotkey badge. Showing the key is what makes the keyboard path discoverable at all.
      const badge = this.scene.add
        .circle(x - CARD_WIDTH / 2 + 22, top + layout.badge, layout.badgeRadius, 0x06101d, 1)
        .setStrokeStyle(2, spec.accent, 0.95);
      const badgeLabel = this.scene.add
        .text(x - CARD_WIDTH / 2 + 22, top + layout.badge, String(index + 1), {
          fontFamily: 'Arial Black',
          fontSize: hudFont(this.scene, 14),
          color: '#ffffff',
        })
        .setOrigin(0.5);
      parts.push(badge, badgeLabel);

      card.on('pointerdown', () => {
        if (this.armed) this.select(index);
      });
      card.on('pointerover', () => this.setFocus(index));
      this.cards.push(card);
      this.glows.push(glow);
    });

    this.bindKeyboard(specs.length);
    this.setFocus(0);
    return parts;
  }

  private bindKeyboard(count: number) {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    const handlers: Array<[string, () => void]> = [];
    for (let index = 0; index < Math.min(count, HOTKEYS.length); index++)
      handlers.push([`keydown-${HOTKEYS[index]}`, () => this.select(index)]);
    handlers.push(['keydown-LEFT', () => this.setFocus((this.focus + count - 1) % count)]);
    handlers.push(['keydown-RIGHT', () => this.setFocus((this.focus + 1) % count)]);
    // Enter only. SPACE is the dash key, so confirming with it would fire a dash the instant
    // the modal closed and the run resumed.
    const confirm = (event?: KeyboardEvent) => {
      if (this.armed && !event?.repeat) this.select(this.focus);
    };
    for (const [event, handler] of [...handlers, ['keydown-ENTER', confirm] as const]) {
      keyboard.on(event, handler);
      this.disposers.push(() => keyboard.off(event, handler));
    }
  }

  private get armed() {
    return this.scene.time.now >= this.armedAt;
  }

  private setFocus(index: number) {
    this.focus = index;
    this.cards.forEach((card, position) => {
      const focused = position === index;
      card.setFillStyle(focused ? 0x12304a : 0x0b1d30, focused ? 1 : 0.98);
      card.setScale(focused ? 1.03 : 1);
      this.glows[position].setScale(focused ? 1.03 : 1);
    });
  }

  private select(index: number) {
    // A modal that fires twice applies two upgrades for one level. Guard it here rather than
    // trusting every call site to unbind first.
    if (this.resolved) return;
    this.resolved = true;
    this.destroy();
    this.onSelect(index);
  }

  destroy() {
    this.disposers.splice(0).forEach((dispose) => dispose());
  }
}
