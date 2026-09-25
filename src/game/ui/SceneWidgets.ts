import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Shared menu palette. Muted text is brighter than it used to be: it has to survive a phone. */
export const UI = {
  ink: 0x06101d,
  panel: 0x0a1a2a,
  line: 0x24506a,
  text: '#eaffff',
  body: '#b9cbd8',
  muted: '#8fa9ba',
  cyan: 0x21e6ff,
  green: 0x73ef62,
  gold: 0xffc857,
  violet: 0xd566ff,
  red: 0xff476f,
} as const;

/** Real CSS pixels per logical pixel. About 0.48 on a phone in landscape, 1 on a 1280x720 window. */
export function displayScale(scene: Phaser.Scene) {
  const { displaySize, gameSize } = scene.scale;
  return gameSize.height > 0 && displaySize.height > 0 ? displaySize.height / gameSize.height : 1;
}

/** A phone-sized display: menus switch to their roomier, larger-type layouts. */
export const isCompact = (scene: Phaser.Scene) => displayScale(scene) < 0.75;

/**
 * Menu type scale. The canvas keeps a 720-high logical size, so on a phone every logical pixel
 * shows at about half a CSS pixel and a 10px label becomes unreadable. Small text is floored to
 * roughly 11 real pixels (never above 22 logical), and larger text grows a little with it.
 */
export function uiPx(scene: Phaser.Scene, size: number) {
  const scale = displayScale(scene);
  const floor = Phaser.Math.Clamp(11 / scale, 12, 22);
  const grow = Phaser.Math.Clamp(0.6 / scale, 1, 1.25);
  return Math.round(Math.max(size, floor, size * grow));
}
export const uiFont = (scene: Phaser.Scene, size: number) => `${uiPx(scene, size)}px`;

/** Shrinks a one-line label until it fits `maxWidth`, keeping a legible floor. */
export function fitText(text: Phaser.GameObjects.Text, maxWidth: number, minSize = 12) {
  let size = parseFloat(String(text.style.fontSize));
  while (text.width > maxWidth && size > minSize) text.setFontSize(--size);
  return text;
}

/** Phaser draws plain {x, y} points; its typings ask for Vector2. */
const points = (list: { x: number; y: number }[]) => list as unknown as Phaser.Math.Vector2[];

export interface FrameStyle {
  /** Base fill and its alpha. */
  fill?: number;
  fillAlpha?: number;
  /** Alpha of the accent-tinted band across the top: the panel's two-tone "sheen". */
  band?: number;
  strokeAlpha?: number;
  lineWidth?: number;
  /** Size of the cut corners (top-left and bottom-right). */
  cut?: number;
  /** Bright L-brackets on the two square corners. */
  brackets?: boolean;
  /** A soft outer glow line. */
  glow?: number;
}

/**
 * The menu panel shape: a chamfered rectangle (cut top-left and bottom-right), a two-tone fill,
 * an accent outline with an optional soft glow, and bright corner brackets. Drawn centred on the
 * Graphics object's position so it can be scaled for press feedback.
 */
export function drawFrame(g: Phaser.GameObjects.Graphics, width: number, height: number, accent: number, style: FrameStyle = {}) {
  const {
    fill = UI.panel, fillAlpha = 0.94, band = 0.1, strokeAlpha = 0.75, lineWidth = 2,
    cut = Math.min(14, height * 0.28), brackets = true, glow = 0,
  } = style;
  const x = -width / 2;
  const y = -height / 2;
  const outline = points([
    { x: x + cut, y }, { x: x + width, y }, { x: x + width, y: y + height - cut },
    { x: x + width - cut, y: y + height }, { x, y: y + height }, { x, y: y + cut },
  ]);
  g.clear();
  if (glow > 0) {
    g.lineStyle(lineWidth + 6, accent, glow);
    g.strokePoints(outline, true, true);
  }
  g.fillStyle(fill, fillAlpha);
  g.fillPoints(outline, true, true);
  if (band > 0) {
    // A header strip on large panels, the upper half on buttons and small cards.
    const bandHeight = Math.max(cut + 2, Math.min(height * 0.46, 44));
    g.fillStyle(accent, band);
    g.fillPoints(points([
      { x: x + cut, y }, { x: x + width, y }, { x: x + width, y: y + bandHeight },
      { x, y: y + bandHeight }, { x, y: y + cut },
    ]), true, true);
  }
  g.lineStyle(lineWidth, accent, strokeAlpha);
  g.strokePoints(outline, true, true);
  if (brackets) {
    const arm = Math.min(22, width * 0.18, height * 0.45);
    g.lineStyle(lineWidth + 1, accent, 1);
    g.beginPath();
    g.moveTo(x + width - arm, y); g.lineTo(x + width, y); g.lineTo(x + width, y + arm);
    g.moveTo(x, y + height - arm); g.lineTo(x, y + height); g.lineTo(x + arm, y + height);
    g.strokePath();
    // A short bright tick along the top-left cut.
    g.lineBetween(x + 1, y + cut - 1, x + cut - 1, y + 1);
  }
  return g;
}

/** A framed panel centred at (x, y). */
export function framePanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, accent: number, style?: FrameStyle) {
  return drawFrame(scene.add.graphics({ x, y }), width, height, accent, style);
}

export interface PanelButton {
  /** The hit area. It carries the name tests and callers look up. */
  box: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  frame: Phaser.GameObjects.Graphics;
  /** Everything the button added, for callers that re-parent into a container. */
  parts: Phaser.GameObjects.GameObject[];
  setLabel(label: string): void;
  /** Dimmed buttons still respond; disabled ones do not. */
  setDimmed(dimmed: boolean): void;
  setEnabled(enabled: boolean): void;
  setSelected(selected: boolean): void;
}

export interface ButtonOptions {
  /** Solid accent fill with dark text: the one action a screen is about. */
  primary?: boolean;
  name?: string;
  /** Fire on pointerdown instead of pointerup. */
  onDown?: boolean;
  depth?: number;
}

/**
 * The menu-family button, centred at (x, y) and sized for touch. A transparent rectangle is the
 * hit area and carries the name; the chamfered frame is drawn separately so it can react to hover
 * and press. Fires on pointerup by default, so a drag that leaves the button does not trigger it.
 */
export function panelButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: number,
  action: () => void,
  fontSize = height > 55 ? 22 : 15,
  options: ButtonOptions = {},
): PanelButton {
  const depth = options.depth ?? 0;
  const frame = scene.add.graphics({ x, y }).setDepth(depth);
  const box = scene.add.rectangle(x, y, width, height, 0x000000, 0.001)
    .setInteractive({ useHandCursor: true }).setDepth(depth);
  if (options.name) box.setName(options.name);
  const primary = !!options.primary;
  const text = scene.add.text(x, y, label, {
    fontFamily: 'Arial Black', fontSize: uiFont(scene, fontSize), color: primary ? '#04121c' : UI.text,
    letterSpacing: 1, align: 'center',
  }).setOrigin(0.5).setDepth(depth);
  const fit = () => fitText(text, width - 18);
  fit();
  let hover = false;
  let selected = false;
  const draw = () => {
    const lit = hover || selected;
    drawFrame(frame, width, height, color, primary
      ? { fill: color, fillAlpha: lit ? 1 : 0.88, band: 0, strokeAlpha: 1, glow: lit ? 0.3 : 0.16, cut: 12 }
      : { fill: lit ? color : UI.ink, fillAlpha: lit ? 0.24 : 0.92, band: lit ? 0.16 : 0.1, strokeAlpha: lit ? 1 : 0.85, glow: lit ? 0.22 : 0, cut: Math.min(12, height * 0.26) });
  };
  const press = (scale: number) => { frame.setScale(scale); text.setScale(scale); };
  draw();
  box.on('pointerover', () => { hover = true; draw(); });
  box.on('pointerout', () => { hover = false; draw(); press(1); });
  box.on('pointerdown', () => { press(0.96); if (options.onDown) action(); });
  box.on('pointerup', () => { press(1); if (!options.onDown) action(); });
  const parts = [frame, box, text];
  return {
    box, text, frame, parts,
    setLabel(next: string) { text.setFontSize(uiPx(scene, fontSize)).setText(next); fit(); },
    setDimmed(dimmed: boolean) { frame.setAlpha(dimmed ? 0.5 : 1); text.setAlpha(dimmed ? 0.6 : 1); },
    setEnabled(enabled: boolean) {
      if (enabled) box.setInteractive({ useHandCursor: true }); else box.disableInteractive();
      frame.setAlpha(enabled ? 1 : 0.35);
      text.setAlpha(enabled ? 1 : 0.4);
    },
    setSelected(next: boolean) { selected = next; draw(); },
  };
}

/** Full-screen sub-menu frame shared by the workshop, settings, records and cloud screens. */
export function subMenuFrame(scene: Phaser.Scene, width: number, height: number, title: string, subtitle: string, accent: number) {
  scene.cameras.main.setBackgroundColor(0x07111f);
  const music = new AudioManager(scene);
  scene.events.on(Phaser.Scenes.Events.UPDATE, (time: number) => music.updateMusic(time, 'menu'));
  if (scene.textures.exists('menu-backdrop'))
    scene.add.image(width / 2, height / 2, 'menu-backdrop').setDisplaySize(width, height).setAlpha(0.3);
  framePanel(scene, width / 2, height / 2, width - 48, height - 36, accent, {
    fill: 0x07111f, fillAlpha: 0.9, band: 0.05, strokeAlpha: 0.5, cut: 26, glow: 0.08,
  });
  scene.add.text(width / 2, 60, title, {
    fontFamily: 'Arial Black', fontSize: uiFont(scene, 36), color: hex(accent), stroke: '#020710', strokeThickness: 6,
  }).setOrigin(0.5).setShadow(0, 0, hex(accent), 12, false, true);
  const sub = scene.add.text(width / 2, 103, subtitle, {
    fontFamily: 'Arial Black', fontSize: uiFont(scene, 12), color: UI.muted, letterSpacing: isCompact(scene) ? 1 : 3,
  }).setOrigin(0.5);
  fitText(sub, width - 160);
  // Divider: a faint rule with a bright accent segment in the middle.
  scene.add.rectangle(width / 2, 124, Math.min(900, width - 200), 1, accent, 0.3);
  scene.add.rectangle(width / 2, 124, 120, 3, accent, 0.9);
}

/** Binds ESC and a back button to the main menu and releases the key on shutdown. */
export function backToMenu(scene: Phaser.Scene, x: number, y: number, label: string) {
  const leave = () => scene.scene.start('Menu');
  const button = panelButton(scene, x, y, 300, 58, label, UI.cyan, leave, 17);
  scene.input.keyboard?.on('keydown-ESC', leave);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.keyboard?.off('keydown-ESC', leave));
  return button;
}
