import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import { t } from '../i18n';
import type { LiveEntry } from '../online/LiveRanking';

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
  private rowsTop = 28;

  constructor(private readonly scene: Phaser.Scene, mobile: boolean) {
    this.maxRows = mobile ? 4 : 6;
    const top = mobile ? 200 : 250;
    this.back = scene.add.rectangle(0, 0, 330, 60, 0x06101d, 0.9).setOrigin(0.5, 0).setStrokeStyle(2, 0xff476f, 0.6);
    this.title = scene.add.text(-150, 8, t('live.connecting'), {
      fontFamily: 'Arial Black', fontSize: '12px', color: '#ff476f', letterSpacing: 1,
    });
    this.record = scene.add.text(-150, 26, '', { fontFamily: 'monospace', fontSize: '11px', color: '#ffc857' });
    for (let index = 0; index < this.maxRows; index++)
      this.rows.push(scene.add.text(-150, this.rowsTop + index * 18, '', { fontFamily: 'monospace', fontSize: '12px', color: '#c7d9e2' }));
    this.panel = scene.add.container(GAME_WIDTH - 185, top, [this.back, this.title, this.record, ...this.rows])
      .setDepth(58).setName('live-board');
    this.layout(0);
  }

  /** The day's persisted record; rows move down to make room only once there is one. */
  setRecord(callsign: string, score: number) {
    this.record.setText(t('live.record', { callsign, score }));
    this.rowsTop = 46;
    this.rows.forEach((row, index) => row.setY(this.rowsTop + index * 18));
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
      return { text: `${String(rank).padStart(2, ' ')}. ${name.slice(0, 20).padEnd(20, ' ')} ${String(entry.score).padStart(6, ' ')}`, self: entry.self };
    });
    if (!others) lines.push({ text: t('live.alone'), self: false });
    this.rows.forEach((row, index) => {
      const line = lines[index];
      row.setText(line?.text ?? '').setColor(line?.self ? '#73ef62' : '#c7d9e2');
    });
    this.layout(Math.min(lines.length, this.maxRows));
  }

  /** Brief pulse on the panel; the headline itself goes through the phase banner. */
  flash() {
    this.back.setStrokeStyle(3, 0xff476f, 1);
    this.scene.tweens.add({
      targets: this.panel, scale: 1.05, duration: 120, yoyo: true,
      onComplete: () => this.back.setStrokeStyle(2, 0xff476f, 0.6),
    });
  }

  private layout(rows: number) {
    this.back.height = this.rowsTop + 4 + Math.max(rows, 1) * 18;
  }

  destroy() {
    this.panel.destroy(true);
  }
}
