import Phaser from 'phaser';

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

const CARD_WIDTH = 264;
const CARD_HEIGHT = 292;
const HOTKEYS = ['ONE', 'TWO', 'THREE'] as const;

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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onSelect: (index: number) => void,
  ) {}

  build(specs: RewardCardSpec[], centerX: number, centerY: number) {
    const parts: Phaser.GameObjects.GameObject[] = [];
    specs.forEach((spec, index) => {
      const x = centerX + (index - (specs.length - 1) / 2) * 300;
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
        .circle(x, top + 54, 34, 0x06101d, 1)
        .setStrokeStyle(3, spec.accent, 0.95);
      const iconLabel = this.scene.add
        .text(x, top + 54, spec.icon, { fontFamily: 'Arial Black', fontSize: '30px', color: hex })
        .setOrigin(0.5);
      const title = this.scene.add
        .text(x, top + 108, spec.name, {
          fontFamily: 'Arial Black',
          fontSize: '19px',
          color: '#eaffff',
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 36 },
        })
        .setOrigin(0.5);
      const effect = this.scene.add
        .text(x, top + 158, spec.effect, {
          fontSize: '15px',
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
              .rectangle(pipX, top + 208, pipWidth, 7, spec.accent, pip < spec.pips.filled ? 1 : 0.16)
              .setStrokeStyle(1, spec.accent, pip < spec.pips.filled ? 1 : 0.4),
          );
        }
      }
      if (spec.footer)
        parts.push(
          this.scene.add
            .text(x, top + 236, spec.footer, {
              fontFamily: 'Arial Black',
              fontSize: '12px',
              color: hex,
            })
            .setOrigin(0.5),
        );

      // Hotkey badge. Showing the key is what makes the keyboard path discoverable at all.
      const badge = this.scene.add
        .circle(x - CARD_WIDTH / 2 + 22, top + 22, 15, 0x06101d, 1)
        .setStrokeStyle(2, spec.accent, 0.95);
      const badgeLabel = this.scene.add
        .text(x - CARD_WIDTH / 2 + 22, top + 22, String(index + 1), {
          fontFamily: 'Arial Black',
          fontSize: '14px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      parts.push(badge, badgeLabel);

      card.on('pointerdown', () => this.select(index));
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
    handlers.push(['keydown-ENTER', () => this.select(this.focus)]);
    for (const [event, handler] of handlers) {
      keyboard.on(event, handler);
      this.disposers.push(() => keyboard.off(event, handler));
    }
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
