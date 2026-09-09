import Phaser from 'phaser';
import type { ContractKind, ContractProgress } from '../systems/ContractSystem';

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
    this.panelWidth = mobile ? 300 : 250;
    this.rowHeight = mobile ? 46 : 30;
    const fontSize = mobile ? '20px' : '10px';
    const textTop = mobile ? 6 : 4;
    const barInset = mobile ? 10 : 8;
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
        .text(PANEL_X + 12, y + textTop, contract.title, {
          fontFamily: 'Arial Black', fontSize, color: '#eaffff', letterSpacing: 1,
        })
        .setOrigin(0, 0)
        .setName(`contract-row-${index}-title`);
      const progress = scene.add
        .text(PANEL_X + this.panelWidth - 8, y + textTop, '', {
          fontFamily: 'Arial Black', fontSize, color: '#8ba5b8',
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
      const titleText = contract.completed ? `✓ ${contract.title}` : contract.title;
      if (row.lastTitle !== titleText) {
        row.title.setText(titleText).setColor(contract.completed ? '#73ef62' : '#eaffff');
        row.lastTitle = titleText;
      }
      const progressText = contract.completed ? 'HECHO' : formatProgress(contract);
      if (row.lastProgress !== progressText) {
        row.progress.setText(progressText);
        row.lastProgress = progressText;
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

  destroy() {
    this.container.destroy(true);
  }
}

function formatProgress(contract: ContractProgress) {
  if (contract.kind === 'UNSCATHED')
    return `${Math.floor(contract.progress / 1000)}/${Math.round(contract.target / 1000)}s`;
  return `${Math.min(contract.progress, contract.target)}/${contract.target}`;
}
