import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { loadProfile, updateProfile } from '../systems/ProfileStore';
import { pulseHaptics, reducedMotion } from '../systems/RuntimeSettings';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { t } from '../i18n';
import { fitText } from './SceneWidgets';
import { hudFont, isCompactHud, touchLayout } from './HudLayout';
import { DISPLAY_FONT } from '../config/Fonts';

/**
 * Touch controls for one-thumb play (HudLayout.touchLayout): a floating move stick that starts
 * wherever the left thumb lands on the left half, auto-aim while auto-fire is on, and an action
 * cluster for the right thumb (dash, with the three powers arced around it, drawn by AbilityBar).
 * Dragging on the free right side aims by hand, which overrides auto-aim while it is held.
 * Interrupted pointers (blur, pagehide, a call coming in) never leave a stick stuck.
 */
export class MobileControls {
  private readonly disposers: Array<() => void> = [];
  private movePointer = -1;
  private aimPointer = -1;

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameScene) {}

  create() {
    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;
    const compact = isCompactHud(this.scene);
    const layout = touchLayout(width, height, compact);
    const radius = layout.stickRadius;
    const travel = radius * 0.8;
    const moveAnchor = new Phaser.Math.Vector2(layout.moveAnchor.x, layout.moveAnchor.y);
    const aimAnchor = new Phaser.Math.Vector2(layout.aimAnchor.x, layout.aimAnchor.y);
    const moveCenter = moveAnchor.clone();
    const aimCenter = aimAnchor.clone();
    // Capture zones: each half of the screen below the top HUD. They sit behind every visible
    // button, so dash, powers, INV and pause still receive their own taps.
    const zoneHeight = height - layout.stickTop;
    const moveZone = this.scene.add.rectangle(layout.splitX / 2, layout.stickTop + zoneHeight / 2, layout.splitX, zoneHeight, 0, 0)
      .setInteractive().setDepth(-1).setName('touch-move-zone');
    const aimZone = this.scene.add.rectangle(layout.splitX + (width - layout.splitX) / 2, layout.stickTop + zoneHeight / 2,
      width - layout.splitX, zoneHeight, 0, 0)
      .setInteractive().setDepth(-1).setName('touch-aim-zone');
    const moveBase = this.scene.add.circle(moveCenter.x, moveCenter.y, radius, 0x07111f, .38)
      .setStrokeStyle(4, 0x21e6ff, .6).setDepth(60);
    const moveKnob = this.scene.add.circle(moveCenter.x, moveCenter.y, layout.knobRadius, 0x21e6ff, .55).setDepth(61);
    const aimBase = this.scene.add.circle(aimCenter.x, aimCenter.y, radius * 0.86, 0x07111f, .3)
      .setStrokeStyle(3, 0xff476f, .55).setDepth(60);
    const aimKnob = this.scene.add.circle(aimCenter.x, aimCenter.y, layout.knobRadius * 0.86, 0xff476f, .5).setDepth(61);
    const labelOffset = radius + (compact ? 16 : 14);
    const moveLabel = this.scene.add.text(moveCenter.x, moveCenter.y - labelOffset, t('hud.move'), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this.scene, 10), color: '#8fcbd6',
    }).setOrigin(.5).setDepth(61);
    const aimLabel = this.scene.add.text(aimCenter.x, aimCenter.y - labelOffset, '', {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this.scene, 10), color: '#ff9caf',
    }).setOrigin(.5).setDepth(61);
    const placeLabel = (label: Phaser.GameObjects.Text, x: number, y: number) =>
      label.setPosition(Phaser.Math.Clamp(x, 8 + label.width / 2, width - 8 - label.width / 2), y - labelOffset);

    const dash = this.scene.add.circle(layout.dash.x, layout.dash.y, layout.dash.r, 0x21e6ff, .32)
      .setStrokeStyle(4, 0x73ef62, .85).setInteractive().setDepth(61).setName('mobilecontrols-dash');
    const dashLabel = fitText(this.scene.add.text(dash.x, dash.y, t('hud.dash'), {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(this.scene, 15), color: '#eaffff',
    }).setOrigin(.5).setDepth(62), layout.dash.r * 1.7, 10);

    // Auto-fire sits in the top row beside INV and pause: a preference, not a combat button, and
    // the right thumb's corner now belongs to dash and the powers.
    const profile = loadProfile();
    const auto = this.scene.add.rectangle(layout.auto.x, layout.auto.y, layout.auto.width, layout.auto.height, 0x07111f, .78)
      .setStrokeStyle(3, profile.autoFire ? 0x73ef62 : 0x7594a8, .9).setDepth(61);
    const autoSize = parseFloat(hudFont(this.scene, 12));
    const autoLabel = this.scene.add.text(auto.x, auto.y, '', {
      fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: `${autoSize}px`, color: '#eaffff',
    }).setOrigin(.5).setDepth(62);
    // A taller invisible hit zone than the pill: at a 0.46 phone scale the pill alone is ~24 CSS
    // px tall, easy to miss with a thumb.
    const autoZone = this.scene.add.zone(auto.x, layout.auto.hitHeight / 2, layout.auto.width, layout.auto.hitHeight)
      .setInteractive().setDepth(61).setName('mobilecontrols-auto-zone');

    const moveVisuals = [moveBase, moveKnob, moveLabel];
    const aimVisuals = [aimBase, aimKnob, aimLabel];
    // The aim stick is optional under auto-fire, so it rests nearly out of sight until used.
    const aimIdleAlpha = () => (this.game.mobileInput.autoFire ? 0.28 : 0.62);
    const setFocus = (objects: Phaser.GameObjects.GameObject[], active: boolean, idle = 0.62) => {
      this.scene.tweens.killTweensOf(objects);
      this.scene.tweens.add({ targets: objects, alpha: active ? 1 : idle, duration: active ? 70 : 260 });
    };
    const applyAuto = (on: boolean) => {
      fitText(autoLabel.setFontSize(autoSize).setText(t(on ? 'hud.autoOn' : 'hud.autoOff')), layout.auto.width - 12, 10);
      auto.setStrokeStyle(3, on ? 0x73ef62 : 0x7594a8, .9);
      aimLabel.setText(t(on ? 'hud.aimManual' : 'hud.aimFire'));
      placeLabel(aimLabel, aimCenter.x, aimCenter.y);
      if (this.aimPointer === -1) setFocus(aimVisuals, false, aimIdleAlpha());
    };
    applyAuto(profile.autoFire);
    placeLabel(moveLabel, moveCenter.x, moveCenter.y);
    setFocus(moveVisuals, false);
    const toggleAuto = () => {
      this.game.mobileInput.autoFire = !this.game.mobileInput.autoFire;
      updateProfile({ autoFire: this.game.mobileInput.autoFire });
      applyAuto(this.game.mobileInput.autoFire);
    };
    autoZone.on('pointerup', toggleAuto);
    this.disposers.push(() => autoZone.off('pointerup', toggleAuto));

    const positionStick = (center: Phaser.Math.Vector2, x: number, y: number,
      base: Phaser.GameObjects.Arc, knob: Phaser.GameObjects.Arc, label: Phaser.GameObjects.Text) => {
      center.set(x, y); base.setPosition(x, y); knob.setPosition(x, y); placeLabel(label, x, y);
    };
    const updateStick = (pointer: Phaser.Input.Pointer, center: Phaser.Math.Vector2, knob: Phaser.GameObjects.Arc, output: Phaser.Math.Vector2) => {
      output.set(pointer.x - center.x, pointer.y - center.y);
      if (output.length() > travel) output.setLength(travel);
      knob.setPosition(center.x + output.x, center.y + output.y);
      output.scale(1 / travel);
    };
    // A stick starts where the thumb lands, kept whole on screen and off the top HUD.
    const clampY = (y: number) => Phaser.Math.Clamp(y, layout.stickTop + radius * 0.5, height - radius - 30);
    const resetMove = () => {
      this.movePointer = -1;
      this.game.mobileInput.movement.set(0, 0);
      positionStick(moveCenter, moveAnchor.x, moveAnchor.y, moveBase, moveKnob, moveLabel);
      setFocus(moveVisuals, false);
    };
    const resetAim = () => {
      this.aimPointer = -1;
      this.game.mobileInput.aimHeld = false;
      this.game.mobileInput.firing = false;
      positionStick(aimCenter, aimAnchor.x, aimAnchor.y, aimBase, aimKnob, aimLabel);
      setFocus(aimVisuals, false, aimIdleAlpha());
    };
    const reset = () => { resetMove(); resetAim(); this.game.mobileInput.dash = false; };
    const onMove = (p: Phaser.Input.Pointer) => {
      if (p.id === this.movePointer) updateStick(p, moveCenter, moveKnob, this.game.mobileInput.movement);
      if (p.id === this.aimPointer) updateStick(p, aimCenter, aimKnob, this.game.mobileInput.aim);
    };
    const onUp = (p: Phaser.Input.Pointer) => {
      if (p.id === this.movePointer) resetMove();
      if (p.id === this.aimPointer) resetAim();
    };
    // The stick labels only teach the first touch: afterwards they repeat the onboarding hint, so
    // each fades out once its stick has been used.
    const retire = (label: Phaser.GameObjects.Text) => {
      if (label.getData('retired')) return;
      label.setData('retired', true);
      if (reducedMotion()) label.setVisible(false);
      else this.scene.tweens.add({ targets: label, alpha: 0, duration: 400, onComplete: () => label.setVisible(false) });
    };
    const beginMove = (p: Phaser.Input.Pointer) => {
      if (this.movePointer !== -1) return;
      this.movePointer = p.id;
      retire(moveLabel);
      positionStick(moveCenter, Phaser.Math.Clamp(p.x, radius + 10, layout.splitX - radius * 0.6), clampY(p.y), moveBase, moveKnob, moveLabel);
      setFocus(moveVisuals, true);
    };
    const beginAim = (p: Phaser.Input.Pointer) => {
      if (this.aimPointer !== -1) return;
      this.aimPointer = p.id;
      this.game.mobileInput.aimHeld = true;
      this.game.mobileInput.aim.set(0, 0);
      this.game.mobileInput.firing = true;
      retire(aimLabel);
      positionStick(aimCenter, Phaser.Math.Clamp(p.x, layout.splitX + radius * 0.6, width - radius - 10), clampY(p.y), aimBase, aimKnob, aimLabel);
      setFocus(aimVisuals, true);
    };
    moveZone.on('pointerdown', beginMove);
    aimZone.on('pointerdown', beginAim);
    dash.on('pointerdown', () => {
      this.game.mobileInput.dash = true;
      if (loadProfile().vibration) pulseHaptics(10);
      // The dash itself is the feedback under reduced motion; the pad's pop is decoration.
      if (!reducedMotion()) this.scene.tweens.add({ targets: [dash, dashLabel], scale: 1.12, duration: 80, yoyo: true });
    });
    const onVisibility = () => { if (document.hidden) reset(); };
    this.scene.input.on('pointermove', onMove); this.scene.input.on('pointerup', onUp); this.scene.input.on('pointercancel', onUp); this.scene.input.on('gameout', reset);
    window.addEventListener('blur', reset); window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', onVisibility);
    this.scene.events.once('shutdown', reset);
    this.disposers.push(() => {
      this.scene.input.off('pointermove', onMove); this.scene.input.off('pointerup', onUp); this.scene.input.off('pointercancel', onUp);
      this.scene.input.off('gameout', reset); window.removeEventListener('blur', reset); window.removeEventListener('pagehide', reset);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  destroy() {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.game.mobileInput.movement.set(0, 0);
    this.game.mobileInput.firing = false;
    this.game.mobileInput.aimHeld = false;
  }
}
