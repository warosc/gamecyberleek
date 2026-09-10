import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { loadProfile, updateProfile } from '../systems/ProfileStore';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';

/** Owns touch controls and guarantees that interrupted pointers never stick. */
export class MobileControls {
  private readonly disposers: Array<() => void> = [];
  private movePointer = -1;
  private aimPointer = -1;

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameScene) {}

  create() {
    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;
    const moveAnchor = new Phaser.Math.Vector2(112, height - 130);
    const aimAnchor = new Phaser.Math.Vector2(width - 112, height - 130);
    const moveCenter = moveAnchor.clone();
    const aimCenter = aimAnchor.clone();
    // Large invisible capture zones make the controls forgiving on a moving phone. They sit
    // behind every visible button, so dash, powers and inventory still receive their taps.
    const moveZone = this.scene.add.rectangle(width * 0.2, height * 0.72, width * 0.4, height * 0.56, 0, 0)
      .setInteractive().setDepth(-1).setName('touch-move-zone');
    const aimZone = this.scene.add.rectangle(width * 0.8, height * 0.72, width * 0.4, height * 0.56, 0, 0)
      .setInteractive().setDepth(-1).setName('touch-aim-zone');
    const moveBase = this.scene.add.circle(moveCenter.x, moveCenter.y, 74, 0x07111f, .38)
      .setStrokeStyle(3, 0x21e6ff, .55).setInteractive().setDepth(60);
    const moveKnob = this.scene.add.circle(moveCenter.x, moveCenter.y, 28, 0x21e6ff, .5).setDepth(61);
    const aimBase = this.scene.add.circle(aimCenter.x, aimCenter.y, 74, 0x07111f, .38)
      .setStrokeStyle(3, 0xff476f, .65).setInteractive().setDepth(60);
    const aimKnob = this.scene.add.circle(aimCenter.x, aimCenter.y, 28, 0xff476f, .5).setDepth(61);
    const moveLabel = this.scene.add.text(moveCenter.x, moveCenter.y + 88, 'MOVER', { fontFamily: 'Arial Black', fontSize: '10px', color: '#8fcbd6' }).setOrigin(.5).setDepth(61);
    const aimLabel = this.scene.add.text(aimCenter.x, aimCenter.y + 88, 'APUNTAR / FUEGO', { fontFamily: 'Arial Black', fontSize: '10px', color: '#ff9caf' }).setOrigin(.5).setDepth(61);
    const dash = this.scene.add.circle(width - 226, height - 232, 43, 0x21e6ff, .36)
      .setStrokeStyle(3, 0x73ef62, .8).setInteractive().setDepth(61);
    const dashLabel = this.scene.add.text(dash.x, dash.y, 'DASH', { fontFamily: 'Arial Black', fontSize: '13px', color: '#eaffff' }).setOrigin(.5).setDepth(62);
    const profile = loadProfile();
    const auto = this.scene.add.rectangle(width - 226, height - 300, 104, 38, 0x07111f, .74)
      .setStrokeStyle(3, profile.autoFire ? 0x73ef62 : 0x7594a8, .9).setInteractive().setDepth(61);
    const autoLabel = this.scene.add.text(auto.x, auto.y, profile.autoFire ? 'AUTO ON' : 'AUTO OFF', { fontFamily: 'Arial Black', fontSize: '12px', color: '#eaffff' }).setOrigin(.5).setDepth(62);
    const moveVisuals = [moveBase, moveKnob, moveLabel];
    const aimVisuals = [aimBase, aimKnob, aimLabel];
    const setFocus = (objects: Phaser.GameObjects.GameObject[], active: boolean) => {
      this.scene.tweens.killTweensOf(objects);
      this.scene.tweens.add({ targets: objects, alpha: active ? 1 : 0.62, duration: active ? 70 : 260 });
    };
    setFocus(moveVisuals, false);
    setFocus(aimVisuals, false);
    const toggleAuto = () => { this.game.mobileInput.autoFire = !this.game.mobileInput.autoFire; updateProfile({ autoFire: this.game.mobileInput.autoFire }); autoLabel.setText(this.game.mobileInput.autoFire ? 'AUTO ON' : 'AUTO OFF'); auto.setStrokeStyle(3, this.game.mobileInput.autoFire ? 0x73ef62 : 0x7594a8, .9); };
    auto.on('pointerup', toggleAuto); this.disposers.push(() => auto.off('pointerup', toggleAuto));
    const positionStick = (center: Phaser.Math.Vector2, x: number, y: number,
      base: Phaser.GameObjects.Arc, knob: Phaser.GameObjects.Arc, label: Phaser.GameObjects.Text) => {
      center.set(x, y); base.setPosition(x, y); knob.setPosition(x, y); label.setPosition(x, y + 88);
    };
    const updateStick = (pointer: Phaser.Input.Pointer, center: Phaser.Math.Vector2, knob: Phaser.GameObjects.Arc, output: Phaser.Math.Vector2) => { output.set(pointer.x - center.x, pointer.y - center.y); if (output.length() > 74) output.setLength(74); knob.setPosition(center.x + output.x, center.y + output.y); output.scale(1 / 74); };
    const resetMove = () => { this.movePointer = -1; this.game.mobileInput.movement.set(0, 0); positionStick(moveCenter, moveAnchor.x, moveAnchor.y, moveBase, moveKnob, moveLabel); setFocus(moveVisuals, false); };
    const resetAim = () => { this.aimPointer = -1; this.game.mobileInput.aim.set(0, 0); this.game.mobileInput.firing = false; positionStick(aimCenter, aimAnchor.x, aimAnchor.y, aimBase, aimKnob, aimLabel); setFocus(aimVisuals, false); };
    const reset = () => { resetMove(); resetAim(); this.game.mobileInput.dash = false; };
    const onMove = (p: Phaser.Input.Pointer) => { if (p.id === this.movePointer) updateStick(p, moveCenter, moveKnob, this.game.mobileInput.movement); if (p.id === this.aimPointer) updateStick(p, aimCenter, aimKnob, this.game.mobileInput.aim); };
    const onUp = (p: Phaser.Input.Pointer) => { if (p.id === this.movePointer) resetMove(); if (p.id === this.aimPointer) resetAim(); };
    const beginMove = (p: Phaser.Input.Pointer) => {
      if (this.movePointer !== -1) return;
      this.movePointer = p.id;
      positionStick(moveCenter, Phaser.Math.Clamp(p.x, 90, width * .38), Phaser.Math.Clamp(p.y, height * .52, height - 105), moveBase, moveKnob, moveLabel);
      setFocus(moveVisuals, true);
    };
    const beginAim = (p: Phaser.Input.Pointer) => {
      if (this.aimPointer !== -1) return;
      this.aimPointer = p.id; this.game.mobileInput.firing = true;
      positionStick(aimCenter, Phaser.Math.Clamp(p.x, width * .62, width - 90), Phaser.Math.Clamp(p.y, height * .52, height - 105), aimBase, aimKnob, aimLabel);
      setFocus(aimVisuals, true);
    };
    moveBase.on('pointerdown', beginMove); moveZone.on('pointerdown', beginMove);
    aimBase.on('pointerdown', beginAim); aimZone.on('pointerdown', beginAim);
    dash.on('pointerdown', () => { this.game.mobileInput.dash = true; this.scene.tweens.add({ targets: [dash, dashLabel], scale: 1.12, duration: 80, yoyo: true }); });
    const onVisibility = () => { if (document.hidden) reset(); };
    this.scene.input.on('pointermove', onMove); this.scene.input.on('pointerup', onUp); this.scene.input.on('pointercancel', onUp); this.scene.input.on('gameout', reset);
    window.addEventListener('blur', reset); window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', onVisibility);
    this.scene.events.once('shutdown', reset);
    this.disposers.push(() => { this.scene.input.off('pointermove', onMove); this.scene.input.off('pointerup', onUp); this.scene.input.off('pointercancel', onUp); this.scene.input.off('gameout', reset); window.removeEventListener('blur', reset); window.removeEventListener('pagehide', reset); document.removeEventListener('visibilitychange', onVisibility); });
  }

  destroy() { this.disposers.splice(0).forEach((dispose) => dispose()); this.game.mobileInput.movement.set(0, 0); this.game.mobileInput.firing = false; }
}
