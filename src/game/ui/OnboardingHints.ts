import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { t, type StringKey } from '../i18n';
import { reducedMotion } from '../systems/RuntimeSettings';
import { hudFont } from './HudLayout';
import { DISPLAY_FONT } from '../config/Fonts';

export type HintAction = 'move' | 'aim' | 'fire' | 'dash' | 'special';
/** The device the player is using right now: it picks the vocabulary of every hint. */
export type HintDevice = 'keyboard' | 'touch' | 'pad';

/**
 * Control hints in the order they are taught, per device. On a pad the right stick aims and
 * fires together, and on a phone the aim stick does, so neither has a separate fire hint.
 */
export const HINT_SEQUENCE: Record<HintDevice, readonly HintAction[]> = {
  keyboard: ['move', 'aim', 'fire', 'dash'],
  touch: ['move', 'fire', 'dash'],
  pad: ['move', 'aim', 'dash'],
};

const LABELS: Record<HintDevice, Partial<Record<HintAction, StringKey>>> = {
  keyboard: { move: 'hint.move', aim: 'hint.aim', fire: 'hint.fire', dash: 'hint.dash', special: 'hint.specials' },
  touch: { move: 'hint.touchMove', fire: 'hint.touchFire', dash: 'hint.touchDash', special: 'hint.touchSpecials' },
  pad: { move: 'hint.padMove', aim: 'hint.padAim', dash: 'hint.padDash', special: 'hint.padSpecials' },
};

export function hintLabel(action: HintAction, device: HintDevice): StringKey | undefined {
  return LABELS[device][action];
}

/**
 * The one hint to show next, or none. Control hints come first, in order, skipping anything the
 * player has already done (or that timed out); the special-power hint follows once a power has
 * charged, so it is never taught before the player can use it.
 */
export function nextHint(device: HintDevice, done: ReadonlySet<HintAction>, specialReady: boolean): HintAction | undefined {
  const pending = HINT_SEQUENCE[device].find(action => !done.has(action));
  if (pending) return pending;
  return specialReady && !done.has('special') ? 'special' : undefined;
}

/** Moving and aiming are the two things the contract briefing must not talk over. */
export function controlsLearned(done: ReadonlySet<HintAction>) {
  return done.has('move') && (done.has('aim') || done.has('fire'));
}

/**
 * Live-play time a hint stays up if its action never happens. The old 9 s ceiling covered all
 * four hints together, so a slow reader lost the last ones before reaching them.
 */
export const HINT_CAP_MS = 15000;
/** Pause before the first hint, so it lands after the arena rather than with it. */
const FIRST_HINT_DELAY_MS = 500;
/** After this many completed runs the player has seen the controls; stop showing them. */
const SHOW_FOR_FIRST_RUNS = 2;

interface Anchor { x: number; y: number; originX: number }

/**
 * Where a hint sits. Keyboard and pad hints share one slot below the player. Touch hints point at
 * the control they describe, because on a phone the thing to look at is the control itself, kept
 * clear of the dash pad (271 to 181 from the right edge, 443-533) and the ability bar (from 589).
 * The power hint sits over the ability buttons it is about.
 */
function anchor(action: HintAction, device: HintDevice): Anchor {
  if (action === 'special')
    return device === 'touch'
      ? { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 162, originX: 0.5 }
      : { x: GAME_WIDTH - 45, y: GAME_HEIGHT - 152, originX: 1 };
  if (device !== 'touch') return { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 120, originX: 0.5 };
  if (action === 'move') return { x: 24, y: GAME_HEIGHT - 240, originX: 0 };
  if (action === 'dash') return { x: GAME_WIDTH - 280, y: GAME_HEIGHT - 232, originX: 1 };
  return { x: GAME_WIDTH - 280, y: GAME_HEIGHT - 160, originX: 1 };
}

/**
 * First-run control prompts.
 *
 * The alpha's success condition is that a new player understands what to do without being
 * told, so these are the smallest nudge that gets there: one short line at a time, no tutorial,
 * no modal, and nothing that takes control away. Four lines at once (plus the contract briefing
 * and a phase callout) was too much to take in during the first seconds of a first run, so the
 * hints now queue: each stays until its action is performed or HINT_CAP_MS of live play passes,
 * then the next one appears. A player who already understands never reads them, and the whole
 * set is skipped once the player has finished a couple of runs.
 *
 * Desktop, pad and touch never mix: a phone player is shown sticks, never WASD, and a pad
 * player sees the pad's buttons as soon as the pad becomes the active device.
 */
export class OnboardingHints {
  private readonly done = new Set<HintAction>();
  private label?: Phaser.GameObjects.Text;
  private showing?: HintAction;
  private device: HintDevice = 'keyboard';
  private shownMs = 0;
  private elapsed = 0;
  private specialReady = false;
  private enabled = false;

  constructor(private readonly scene: Phaser.Scene) {}

  /** `runs` is the player's completed-run count; `device` selects the control vocabulary. */
  create(runs: number, device: HintDevice) {
    this.device = device;
    this.enabled = runs < SHOW_FOR_FIRST_RUNS;
  }

  /** True while this run is teaching controls; false for experienced players. */
  get active() {
    return this.enabled;
  }

  /** True once moving and aiming have been done (or timed out): the briefing can follow. */
  get controlsLearned() {
    return !this.enabled || controlsLearned(this.done);
  }

  /** A special power has charged for the first time: queue its hint. */
  powerReady() {
    this.specialReady = true;
  }

  /** Called when the player performs an action; its hint has done its job and leaves. */
  satisfy(action: HintAction) {
    if (!this.enabled || this.done.has(action)) return;
    this.done.add(action);
    if (this.showing === action) this.retire(true);
  }

  /** `live` is false while the run is paused or a modal is open: hint time only counts in play. */
  update(delta: number, live: boolean, device: HintDevice) {
    if (!this.enabled) return;
    if (device !== this.device) {
      // The player picked up a pad (or went back to the mouse): reword rather than mislead.
      this.device = device;
      this.retire(false);
    }
    if (!live) return;
    this.elapsed += delta;
    if (this.showing) {
      this.shownMs += delta;
      if (this.shownMs >= HINT_CAP_MS) {
        // Timed out: it counts as done so the queue moves on instead of nagging.
        this.done.add(this.showing);
        this.retire(true);
      }
      return;
    }
    if (this.elapsed < FIRST_HINT_DELAY_MS || this.label) return;
    const next = nextHint(this.device, this.done, this.specialReady);
    if (next) this.show(next);
  }

  destroy() {
    this.enabled = false;
    this.label?.destroy();
    this.label = undefined;
    this.showing = undefined;
  }

  private show(action: HintAction) {
    const key = hintLabel(action, this.device);
    if (!key) {
      this.done.add(action);
      return;
    }
    const spot = anchor(action, this.device);
    const label = this.scene.add
      .text(spot.x, spot.y, t(key), {
        fontFamily: DISPLAY_FONT, fontStyle: 'bold',
        fontSize: hudFont(this.scene, 15),
        color: '#eaffff',
        backgroundColor: '#04121ccc',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(spot.originX, 0.5)
      .setAlpha(0)
      .setDepth(80)
      .setName(`hint-${action}`);
    // Centred hints are clamped onto the canvas: at phone size the longest is ~520px wide.
    if (spot.originX === 0.5)
      label.setX(Phaser.Math.Clamp(spot.x, 12 + label.width / 2, GAME_WIDTH - 12 - label.width / 2));
    this.label = label;
    this.showing = action;
    this.shownMs = 0;
    this.scene.tweens.add({ targets: label, alpha: 1, duration: 260 });
  }

  /** `animate` false drops the label at once, for a device switch. */
  private retire(animate: boolean) {
    const label = this.label;
    this.label = undefined;
    this.showing = undefined;
    if (!label) return;
    if (!animate) {
      label.destroy();
      return;
    }
    this.scene.tweens.killTweensOf(label);
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      // It lifts away as it goes, unless reduced motion asks for a plain fade.
      y: reducedMotion() ? label.y : label.y - 14,
      duration: 260,
      onComplete: () => label.destroy(),
    });
  }
}
