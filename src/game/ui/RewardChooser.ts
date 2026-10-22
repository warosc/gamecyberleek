import Phaser from 'phaser';
import { hudFont, isCompactHud } from './HudLayout';
import { fitText } from './SceneWidgets';

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

/** A secondary action under the cards that does not close the modal (the level-up reroll). */
export interface RewardExtraAction {
  label: string;
  /** Phaser key name, bound while the action is enabled and shown on its badge. */
  key: string;
  enabled: boolean;
  accent: number;
  /** Centre of the button. */
  y: number;
  onActivate: () => void;
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
  private extra?: { button: Phaser.GameObjects.Rectangle; action: RewardExtraAction; used: boolean };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onSelect: (index: number) => void,
  ) {}

  build(specs: RewardCardSpec[], centerX: number, centerY: number, extra?: RewardExtraAction) {
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

    if (extra) parts.push(...this.buildExtra(extra, centerX));
    this.bindKeyboard(specs.length);
    this.setFocus(0);
    return parts;
  }

  /**
   * The button sits under the cards so DOWN reaches it: the pad bridge replays the d-pad as
   * arrows and A as ENTER here, which gives the pad the action without a button of its own.
   * Spent, it stays on screen greyed out, so the player learns there was one per run.
   */
  private buildExtra(action: RewardExtraAction, centerX: number) {
    const compact = isCompactHud(this.scene);
    const width = compact ? 420 : 300;
    const height = compact ? 46 : 38;
    const color = action.enabled ? action.accent : 0x4d6070;
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    const button = this.scene.add
      .rectangle(centerX, action.y, width, height, 0x0b1d30, 0.98)
      .setStrokeStyle(2, color, action.enabled ? 0.9 : 0.5);
    const label = this.scene.add
      .text(centerX + 14, action.y, action.label, {
        fontFamily: 'Arial Black', fontSize: hudFont(this.scene, 13), color: hex, letterSpacing: 2,
      })
      .setOrigin(0.5);
    fitText(label, width - 70, 10);
    const badgeX = centerX - width / 2 + 22;
    const badge = this.scene.add.circle(badgeX, action.y, compact ? 16 : 13, 0x06101d, 1).setStrokeStyle(2, color, 0.95);
    const badgeLabel = this.scene.add
      .text(badgeX, action.y, action.key, { fontFamily: 'Arial Black', fontSize: hudFont(this.scene, 12), color: '#ffffff' })
      .setOrigin(0.5);
    const parts = [button, label, badge, badgeLabel];
    if (!action.enabled) {
      parts.forEach(part => part.setAlpha(0.55));
      return parts;
    }
    this.extra = { button, action, used: false };
    button.setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      if (this.armed) this.activateExtra();
    });
    button.on('pointerover', () => this.setFocus(this.cards.length));
    return parts;
  }

  private bindKeyboard(count: number) {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    const handlers: Array<[string, () => void]> = [];
    for (let index = 0; index < Math.min(count, HOTKEYS.length); index++)
      handlers.push([`keydown-${HOTKEYS[index]}`, () => this.select(index)]);
    // From the extra button LEFT / RIGHT go back to the cards: the first card, or the last.
    handlers.push(['keydown-LEFT', () => this.setFocus(this.focus >= count ? count - 1 : (this.focus + count - 1) % count)]);
    handlers.push(['keydown-RIGHT', () => this.setFocus(this.focus >= count ? 0 : (this.focus + 1) % count)]);
    let cardFocus = 0;
    handlers.push(['keydown-DOWN', () => {
      if (!this.extra || this.focus >= count) return;
      cardFocus = this.focus;
      this.setFocus(count);
    }]);
    handlers.push(['keydown-UP', () => {
      if (this.focus >= count) this.setFocus(cardFocus);
    }]);
    // The extra action's key is armed like ENTER: R is also the OVERDRIVE special, and a player
    // still pressing it when the modal opens must not spend the run's only reroll by accident.
    if (this.extra)
      handlers.push([`keydown-${this.extra.action.key}`, (event?: KeyboardEvent) => {
        if (this.armed && !event?.repeat) this.activateExtra();
      }]);
    // Enter only. SPACE is the dash key, so confirming with it would fire a dash the instant
    // the modal closed and the run resumed.
    const confirm = (event?: KeyboardEvent) => {
      if (!this.armed || event?.repeat) return;
      if (this.focus >= count) this.activateExtra();
      else this.select(this.focus);
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
    const extraFocused = index >= this.cards.length;
    this.extra?.button.setFillStyle(extraFocused ? 0x12304a : 0x0b1d30, extraFocused ? 1 : 0.98)
      .setScale(extraFocused ? 1.04 : 1);
  }

  /** Once per chooser: the action replaces the modal, and a second press must not spend twice. */
  private activateExtra() {
    if (!this.extra || this.extra.used || this.resolved) return;
    this.extra.used = true;
    this.extra.action.onActivate();
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
