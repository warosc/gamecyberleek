import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import { t } from '../i18n';
import type { LiveEntry } from '../online/LiveRanking';
import { reducedMotion } from '../systems/RuntimeSettings';
import { fitText } from './SceneWidgets';
import { RIGHT_EDGE_INSET, hudFont, hudPx, isCompactHud, rightColumn } from './HudLayout';
import { DISPLAY_FONT } from '../config/Fonts';

/**
 * Live daily board: who else is playing today's daily right now, and their live score. Sits
 * under the optional-objective panel on the right; shows fewer rows on phones so it stays clear
 * of the touch controls.
 */
export class LiveBoardHud {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly back: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly record: Phaser.GameObjects.Text;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly maxRows: number;
  private readonly width: number;
  private readonly rowGap: number;
  private readonly rowSize: number;
  /** Callsign column width in characters: 20 at 12px, 14 once phone type makes each row wider. */
  private readonly nameChars: number;
  private readonly recordTop: number;
  private rowsTop: number;

  constructor(private readonly scene: Phaser.Scene, mobile: boolean) {
    const compact = isCompactHud(scene);
    const column = rightColumn(mobile, compact);
    this.maxRows = column.liveRows;
    this.width = column.liveWidth;
    this.rowSize = hudPx(scene, 12);
    // Monospace rows are about 1.2em tall; 18px spacing was measured for the 12px desktop rows.
    this.rowGap = Math.max(18, Math.round(this.rowSize * 1.2));
    this.nameChars = compact ? 14 : 20;
    const left = -this.width / 2 + 15;
    this.back = scene.add.rectangle(0, 0, this.width, 60, 0x06101d, 0.9).setOrigin(0.5, 0).setStrokeStyle(2, 0xff476f, 0.6);
    this.title = scene.add.text(left, 8, t('live.connecting'), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(scene, 12), color: '#ff476f', letterSpacing: 1,
    });
    this.recordTop = 8 + Math.ceil(this.title.height) + 2;
    this.rowsTop = this.recordTop + 2;
    this.record = scene.add.text(left, this.recordTop, '', { fontFamily: 'monospace', fontSize: hudFont(scene, 11), color: '#ffc857' });
    for (let index = 0; index < this.maxRows; index++)
      this.rows.push(scene.add.text(left, this.rowsTop + index * this.rowGap, '', {
        fontFamily: 'monospace', fontSize: `${this.rowSize}px`, color: '#c7d9e2',
      }));
    this.panel = scene.add.container(GAME_WIDTH - RIGHT_EDGE_INSET - this.width / 2, column.liveTop,
      [this.back, this.title, this.record, ...this.rows]).setDepth(58).setName('live-board');
    this.layout(0);
  }

  /** The day's persisted record; rows move down to make room only once there is one. */
  setRecord(callsign: string, score: number) {
    this.record.setFontSize(hudPx(this.scene, 11)).setText(t('live.record', { callsign, score }));
    fitText(this.record, this.width - 30, 10);
    this.rowsTop = this.recordTop + Math.max(18, Math.ceil(this.record.height));
    this.rows.forEach((row, index) => row.setY(this.rowsTop + index * this.rowGap));
  }

  setEntries(entries: readonly LiveEntry[]) {
    const others = entries.filter(entry => !entry.self).length;
    this.title.setText(t('live.title', { count: entries.length }));
    const self = entries.findIndex(entry => entry.self);
    // Keep the player's own row visible even when they are outside the top rows.
    let shown = entries.slice(0, this.maxRows);
    if (self >= this.maxRows) shown = [...entries.slice(0, this.maxRows - 1), entries[self]];
    const lines = shown.map(entry => {
      const rank = entries.indexOf(entry) + 1;
      const name = entry.self ? `${t('live.you')} · ${entry.callsign}` : entry.callsign;
      return { text: `${String(rank).padStart(2, ' ')}. ${name.slice(0, this.nameChars).padEnd(this.nameChars, ' ')} ${String(entry.score).padStart(6, ' ')}`, self: entry.self };
    });
    if (!others) lines.push({ text: t('live.alone'), self: false });
    this.rows.forEach((row, index) => {
      const line = lines[index];
      row.setFontSize(this.rowSize).setText(line?.text ?? '').setColor(line?.self ? '#73ef62' : '#c7d9e2');
      fitText(row, this.width - 30, 10);
    });
    this.layout(Math.min(lines.length, this.maxRows));
  }

  /** Brief pulse on the panel; the headline itself goes through the phase banner. */
  flash() {
    this.back.setStrokeStyle(3, 0xff476f, 1);
    const settle = () => this.back.setStrokeStyle(2, 0xff476f, 0.6);
    // The brighter outline alone says it under reduced motion; only the pop is decorative.
    if (reducedMotion()) {
      this.scene.time.delayedCall(240, settle);
      return;
    }
    this.scene.tweens.add({ targets: this.panel, scale: 1.05, duration: 120, yoyo: true, onComplete: settle });
  }

  private layout(rows: number) {
    // setSize, not a plain height assignment: the stroke path is only rebuilt by setSize, so the
    // border would stay at its first height while rows grew past it.
    this.back.setSize(this.width, this.rowsTop + 4 + Math.max(rows, 1) * this.rowGap);
  }

  destroy() {
    this.panel.destroy(true);
  }
}
