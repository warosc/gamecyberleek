import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';

export type HintAction = 'move' | 'aim' | 'fire' | 'dash';

interface HintSpec {
  action: HintAction;
  label: string;
  x: number;
  y: number;
  delayMs: number;
}

/** Hard ceiling: a hint that has not been satisfied still leaves rather than nagging. */
const HINT_LIFETIME_MS = 9000;
/** After this many completed runs the player has seen the controls; stop showing them. */
const SHOW_FOR_FIRST_RUNS = 2;

/**
 * First-run control prompts.
 *
 * The alpha's success condition is that a new player understands what to do without being
 * told, so these are the smallest nudge that gets there: four short lines, no tutorial, no
 * modal, and nothing that takes control away. Each hint disappears the moment the player
 * performs its action, so a player who already understands never reads them, and the whole set
 * is skipped once the player has finished a couple of runs.
 *
 * Desktop and touch never mix: a phone player is shown sticks, never WASD.
 */
export class OnboardingHints {
  private readonly labels = new Map<HintAction, Phaser.GameObjects.Text>();
  private readonly satisfied = new Set<HintAction>();
  private elapsed = 0;
  private active = false;

  constructor(private readonly scene: Phaser.Scene) {}

  /** `runs` is the player's completed-run count; `touch` selects the control vocabulary. */
  create(runs: number, touch: boolean) {
    if (runs >= SHOW_FOR_FIRST_RUNS) return;
    this.active = true;
    for (const spec of touch ? TOUCH_HINTS : DESKTOP_HINTS) {
      const label = this.scene.add
        .text(spec.x, spec.y, spec.label, {
          fontFamily: 'Arial Black',
          fontSize: '15px',
          color: '#eaffff',
          backgroundColor: '#04121ccc',
          padding: { x: 12, y: 8 },
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(80);
      this.labels.set(spec.action, label);
      // Staggered so the player is never handed four instructions at once.
      this.scene.tweens.add({
        targets: label,
        alpha: 1,
        duration: 260,
        delay: spec.delayMs,
      });
    }
  }

  /** Called when the player performs an action; its hint has done its job and leaves. */
  satisfy(action: HintAction) {
    if (!this.active || this.satisfied.has(action)) return;
    this.satisfied.add(action);
    const label = this.labels.get(action);
    if (!label) return;
    this.labels.delete(action);
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      y: label.y - 14,
      duration: 260,
      onComplete: () => label.destroy(),
    });
  }

  update(delta: number) {
    if (!this.active) return;
    this.elapsed += delta;
    if (this.elapsed < HINT_LIFETIME_MS) return;
    this.active = false;
    for (const action of [...this.labels.keys()]) {
      this.active = true;
      this.satisfy(action);
      this.active = false;
    }
  }

  destroy() {
    this.active = false;
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear();
  }
}

const DESKTOP_HINTS: HintSpec[] = [
  { action: 'move', label: 'W A S D   MOVE', x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 120, delayMs: 500 },
  { action: 'aim', label: 'MOUSE   AIM', x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 160, delayMs: 1100 },
  { action: 'fire', label: 'CLICK   FIRE', x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 200, delayMs: 1700 },
  { action: 'dash', label: 'SPACE   DASH', x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 240, delayMs: 2600 },
];

// Anchored over the sticks they describe rather than centred, because on a phone the thing to
// point at is the control itself.
const TOUCH_HINTS: HintSpec[] = [
  { action: 'move', label: 'MOVE', x: 135, y: GAME_HEIGHT - 285, delayMs: 500 },
  { action: 'fire', label: 'AIM  ·  FIRE', x: GAME_WIDTH - 135, y: GAME_HEIGHT - 300, delayMs: 1200 },
  { action: 'dash', label: 'DASH', x: GAME_WIDTH - 285, y: GAME_HEIGHT - 355, delayMs: 2200 },
];
