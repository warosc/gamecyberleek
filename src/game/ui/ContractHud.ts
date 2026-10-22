import Phaser from 'phaser';
import type { ContractKind, ContractProgress } from '../systems/ContractSystem';
import { t, td } from '../i18n';
import { reducedMotion } from '../systems/RuntimeSettings';
import { fitText } from './SceneWidgets';
import { hudPx, isCompactHud } from './HudLayout';
import { DISPLAY_FONT } from '../config/Fonts';

const PANEL_X = 16;
// Starts below the HP/energy panel (which ends at y=126) and stays clear of the boss banner
// and phase callouts (centred, starting well to the right of this panel's edge) and, on the
// left side, well above the mobile move stick (~y=440 and below). See StatusHud/BossBanner/
// MobileControls for the regions this was measured against.
const PANEL_Y = 138;
const ROW_GAP = 4;

const ACCENT = 0x21e6ff;
const COMPLETE_COLOR = 0x73ef62;

interface Row {
  kind: ContractKind;
  back: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  progress: Phaser.GameObjects.Text;
  barFill: Phaser.GameObjects.Rectangle;
  lastTitle: string;
  lastProgress: string;
}

/**
 * Always-on, compact contract tracker. Three short rows stacked in the gap between the HP panel
 * and the mobile move stick, so it never overlaps controls, the health bar, or the boss/miniboss
 * banner on either PC or mobile layouts.
 */
export class ContractHud {
  private readonly container: Phaser.GameObjects.Container;
  private readonly rows: Row[] = [];
  private readonly panelWidth: number;
  private readonly rowHeight: number;
  private readonly fontSize: number;

  constructor(scene: Phaser.Scene, contracts: readonly ContractProgress[], mobile: boolean) {
    // ViewportLayout widens the logical canvas to match a phone's aspect ratio (up to 1600
    // logical px) while the physical canvas stays pinned to the real viewport (e.g. 844 CSS
    // px on an iPhone 13/14 landscape) — a ~0.54-0.5 logical-to-CSS scale, worse than
    // desktop's 1:1. A first pass here only bumped the font from 10px to 13px, which measured
    // out to *smaller* real CSS pixels than desktop (13 * 0.54 ≈ 7px vs desktop's 10px): a
    // proportional-looking increase without checking the actual rendered size. 20px is chosen
    // so mobile never renders smaller than desktop's 10px even at the worst-case scale seen
    // across the three phone widths this was measured against (740/844/915 CSS px landscape,
    // ~0.5-0.57 scale): 20 * 0.5 = 10px, matching or beating desktop everywhere else.
    // The shared HUD floor (HudLayout) now covers the narrower iPhone Pro Max case (0.46 scale,
    // where 20px drew at 9 CSS px), and the row widens to 330 so "✓ CADENA LETAL  HECHO" still
    // fits beside its progress at 22px.
    const compact = isCompactHud(scene);
    const large = mobile || compact;
    this.panelWidth = compact ? 330 : mobile ? 300 : 250;
    this.rowHeight = large ? 46 : 30;
    this.fontSize = mobile ? Math.max(20, hudPx(scene, 10)) : hudPx(scene, 10);
    const fontSize = `${this.fontSize}px`;
    const textTop = large ? 6 : 4;
    const barInset = large ? 10 : 8;
    const parts: Phaser.GameObjects.GameObject[] = [];
    contracts.forEach((contract, index) => {
      const y = PANEL_Y + index * (this.rowHeight + ROW_GAP);
      const back = scene.add
        .rectangle(PANEL_X, y, this.panelWidth, this.rowHeight, 0x06101d, 0.86)
        .setOrigin(0, 0)
        .setStrokeStyle(1, ACCENT, 0.4)
        .setName(`contract-row-${index}`);
      const marker = scene.add.rectangle(PANEL_X + 3, y + 4, 4, this.rowHeight - 8, ACCENT, 0.9).setOrigin(0, 0);
      const title = scene.add
        .text(PANEL_X + 12, y + textTop, td(contract.title), {
          fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize, color: '#eaffff', letterSpacing: 1,
        })
        .setOrigin(0, 0)
        .setName(`contract-row-${index}-title`);
      const progress = scene.add
        .text(PANEL_X + this.panelWidth - 8, y + textTop, '', {
          fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize, color: '#8ba5b8',
        })
        .setOrigin(1, 0);
      const barBack = scene.add
        .rectangle(PANEL_X + 12, y + this.rowHeight - barInset, this.panelWidth - 24, 4, 0x0b1e30, 1)
        .setOrigin(0, 0);
      const barFill = scene.add.rectangle(PANEL_X + 12, y + this.rowHeight - barInset, 0, 4, ACCENT, 1).setOrigin(0, 0);
      parts.push(back, marker, title, progress, barBack, barFill);
      this.rows.push({ kind: contract.kind, back, marker, title, progress, barFill, lastTitle: '', lastProgress: '' });
    });
    this.container = scene.add.container(0, 0, parts).setDepth(70).setName('contract-hud');
  }

  update(contracts: readonly ContractProgress[]) {
    contracts.forEach((contract) => {
      const row = this.rows.find((candidate) => candidate.kind === contract.kind);
      if (!row) return;
      const ratio = Phaser.Math.Clamp(contract.progress / contract.target, 0, 1);
      row.barFill.width = (this.panelWidth - 24) * ratio;
      const titleText = contract.completed ? `✓ ${td(contract.title)}` : td(contract.title);
      const progressText = contract.completed ? t('contracts.done') : formatProgress(contract);
      if (row.lastTitle !== titleText || row.lastProgress !== progressText) {
        row.title.setText(titleText).setColor(contract.completed ? '#73ef62' : '#eaffff');
        row.progress.setText(progressText);
        row.lastTitle = titleText;
        row.lastProgress = progressText;
        // Title and progress share one row: the title gives way, never the number.
        row.title.setFontSize(this.fontSize);
        fitText(row.title, this.panelWidth - 30 - row.progress.width, Math.round(this.fontSize * 0.8));
      }
      const color = contract.completed ? COMPLETE_COLOR : ACCENT;
      row.marker.setFillStyle(color, 0.9);
      row.barFill.setFillStyle(color, 1);
    });
  }

  /**
   * Confirmation on completion: a bigger pop on the row itself plus a brief outward flash, so
   * the moment reads even without staring straight at a small corner panel. Paired with an audio
   * cue from GameScene (`announceContractCompleted`) — the visual alone tested as too subtle
   * during an actual playtest.
   */
  celebrate(kind: ContractKind) {
    const row = this.rows.find((candidate) => candidate.kind === kind);
    if (!row) return;
    const scene = row.back.scene;
    row.back.setStrokeStyle(3, COMPLETE_COLOR, 1);
    // The green outline, the tick and the audio cue carry it under reduced motion; the pop and the
    // expanding glow are the decorative part.
    if (reducedMotion()) return;
    scene.tweens.add({ targets: row.back, scaleY: 1.45, duration: 140, yoyo: true, ease: 'Back.Out' });
    scene.tweens.add({ targets: [row.title, row.progress], scale: 1.35, duration: 140, yoyo: true, ease: 'Back.Out' });
    const glow = scene.add
      .rectangle(row.back.x + this.panelWidth / 2, row.back.y + this.rowHeight / 2, this.panelWidth, this.rowHeight, COMPLETE_COLOR, 0.4)
      .setDepth(71);
    scene.tweens.add({
      targets: glow,
      scaleX: 1.18,
      scaleY: 1.7,
      alpha: 0,
      duration: 340,
      ease: 'Quad.Out',
      onComplete: () => glow.destroy(),
    });
  }

  /**
   * Introduces the rolled contracts where they live instead of in a centre panel. That panel
   * stopped play reading for four seconds at the start of every run and covered the player;
   * now each row flashes in turn and a chip slides out beside it with the full objective, then
   * fades. The rows themselves never move or resize, so the tracker's layout guarantees hold.
   */
  introduce(descriptions: readonly string[]) {
    const scene = this.container.scene;
    const still = reducedMotion();
    const holdMs = this.rowHeight > 30 ? 5600 : 4600;
    this.rows.forEach((row, index) => {
      const description = descriptions[index];
      if (!description) return;
      const delay = index * 380;
      const y = row.back.y + this.rowHeight / 2;
      const chipX = PANEL_X + this.panelWidth + 8;
      const text = scene.add.text(14, 0, description, {
        fontFamily: 'monospace', fontSize: `${Math.round(this.fontSize * 1.05)}px`, color: '#d9f6ff',
      }).setOrigin(0, 0.5);
      const width = Math.ceil(text.width) + 26;
      const chip = scene.add.container(chipX, y, [
        scene.add.rectangle(0, 0, width, this.rowHeight - 4, 0x06101d, 0.86).setOrigin(0, 0.5).setStrokeStyle(1, ACCENT, 0.45),
        scene.add.rectangle(0, 0, 4, this.rowHeight - 4, ACCENT, 0.95).setOrigin(0, 0.5),
        text,
      ]).setDepth(69).setName(`contract-brief-${index}`).setAlpha(0);
      if (still) {
        scene.tweens.add({ targets: chip, alpha: 1, delay, duration: 160, hold: holdMs, yoyo: true, onComplete: () => chip.destroy(true) });
        return;
      }
      chip.setX(chipX - 24);
      scene.tweens.add({
        targets: chip, alpha: 1, x: chipX, delay, duration: 300, ease: 'Cubic.Out', hold: holdMs, yoyo: true,
        onComplete: () => chip.destroy(true),
      });
      // A light sweeping the row as its chip arrives: the eye follows it down the list.
      const sweep = scene.add.rectangle(PANEL_X, y, 36, this.rowHeight, 0xffffff, 0.28)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(71).setAlpha(0);
      scene.tweens.add({
        targets: sweep, alpha: { from: 0.9, to: 0 }, x: PANEL_X + this.panelWidth, delay, duration: 520, ease: 'Sine.Out',
        onComplete: () => sweep.destroy(),
      });
      scene.tweens.add({ targets: row.marker, scaleY: 1.4, delay, duration: 160, yoyo: true });
    });
  }

  destroy() {
    this.container.destroy(true);
  }
}

function formatProgress(contract: ContractProgress) {
  if (contract.kind === 'UNSCATHED')
    return `${Math.floor(contract.progress / 1000)}/${Math.round(contract.target / 1000)}s`;
  return `${Math.min(contract.progress, contract.target)}/${contract.target}`;
}
