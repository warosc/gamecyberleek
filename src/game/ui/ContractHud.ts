import Phaser from 'phaser';
import type { ContractKind, ContractProgress } from '../systems/ContractSystem';

const PANEL_X = 16;
// Starts below the HP/energy panel (which ends at y=126) and stays clear of the boss banner
// and phase callouts (centred, starting well to the right of this panel's edge) and, on the
// left side, well above the mobile move stick (~y=440 and below). See StatusHud/BossBanner/
// MobileControls for the regions this was measured against.
const PANEL_Y = 138;
const PANEL_WIDTH = 250;
const ROW_HEIGHT = 30;
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

  constructor(scene: Phaser.Scene, contracts: readonly ContractProgress[]) {
    const parts: Phaser.GameObjects.GameObject[] = [];
    contracts.forEach((contract, index) => {
      const y = PANEL_Y + index * (ROW_HEIGHT + ROW_GAP);
      const back = scene.add
        .rectangle(PANEL_X, y, PANEL_WIDTH, ROW_HEIGHT, 0x06101d, 0.86)
        .setOrigin(0, 0)
        .setStrokeStyle(1, ACCENT, 0.4)
        .setName(`contract-row-${index}`);
      const marker = scene.add.rectangle(PANEL_X + 3, y + 4, 4, ROW_HEIGHT - 8, ACCENT, 0.9).setOrigin(0, 0);
      const title = scene.add
        .text(PANEL_X + 12, y + 4, contract.title, {
          fontFamily: 'Arial Black', fontSize: '10px', color: '#eaffff', letterSpacing: 1,
        })
        .setOrigin(0, 0);
      const progress = scene.add
        .text(PANEL_X + PANEL_WIDTH - 8, y + 4, '', {
          fontFamily: 'Arial Black', fontSize: '10px', color: '#8ba5b8',
        })
        .setOrigin(1, 0);
      const barBack = scene.add
        .rectangle(PANEL_X + 12, y + ROW_HEIGHT - 8, PANEL_WIDTH - 24, 4, 0x0b1e30, 1)
        .setOrigin(0, 0);
      const barFill = scene.add.rectangle(PANEL_X + 12, y + ROW_HEIGHT - 8, 0, 4, ACCENT, 1).setOrigin(0, 0);
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
      row.barFill.width = (PANEL_WIDTH - 24) * ratio;
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

  /** Brief pop + border flash on the row that just completed; the confirmation the spec asks for. */
  celebrate(kind: ContractKind) {
    const row = this.rows.find((candidate) => candidate.kind === kind);
    if (!row) return;
    row.back.setStrokeStyle(2, COMPLETE_COLOR, 1);
    row.back.scene.tweens.add({ targets: row.back, scaleY: 1.28, duration: 100, yoyo: true, ease: 'Quad.Out' });
    row.back.scene.tweens.add({ targets: [row.title, row.progress], scale: 1.18, duration: 100, yoyo: true });
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
