import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { loadProfile, updateProfile } from '../systems/ProfileStore';

/** Owns touch controls and guarantees that interrupted pointers never stick. */
export class MobileControls {
  private readonly disposers: Array<() => void> = [];
  private movePointer = -1;
  private aimPointer = -1;

  constructor(private readonly scene: Phaser.Scene, private readonly game: GameScene) {}

  create() {
    const width = 1280;
    const height = 720;
    const moveCenter = new Phaser.Math.Vector2(135, height - 165);
    const aimCenter = new Phaser.Math.Vector2(width - 135, height - 170);
    const moveBase = this.scene.add.circle(moveCenter.x, moveCenter.y, 86, 0x07111f, .52)
      .setStrokeStyle(3, 0x21e6ff, .55).setInteractive().setDepth(60);
    const moveKnob = this.scene.add.circle(moveCenter.x, moveCenter.y, 35, 0x21e6ff, .48).setDepth(61);
    const aimBase = this.scene.add.circle(aimCenter.x, aimCenter.y, 88, 0x07111f, .52)
      .setStrokeStyle(3, 0xff476f, .65).setInteractive().setDepth(60);
    const aimKnob = this.scene.add.circle(aimCenter.x, aimCenter.y, 35, 0xff476f, .48).setDepth(61);
    this.scene.add.text(moveCenter.x, moveCenter.y + 105, 'MOVE', { fontFamily: 'Arial Black', fontSize: '11px', color: '#8fcbd6' }).setOrigin(.5).setDepth(61);
    this.scene.add.text(aimCenter.x, aimCenter.y + 107, 'AIM / FIRE', { fontFamily: 'Arial Black', fontSize: '11px', color: '#ff9caf' }).setOrigin(.5).setDepth(61);
    const dash = this.scene.add.circle(width - 285, height - 285, 54, 0x21e6ff, .42)
      .setStrokeStyle(3, 0x73ef62, .8).setInteractive().setDepth(61);
    this.scene.add.text(dash.x, dash.y, 'DASH', { fontFamily: 'Arial Black', fontSize: '13px', color: '#eaffff' }).setOrigin(.5).setDepth(62);
    const profile = loadProfile();
    const auto = this.scene.add.rectangle(width - 285, height - 365, 108, 42, 0x07111f, .82)
      .setStrokeStyle(3, profile.autoFire ? 0x73ef62 : 0x7594a8, .9).setInteractive().setDepth(61);
    const autoLabel = this.scene.add.text(auto.x, auto.y, profile.autoFire ? 'AUTO ON' : 'AUTO OFF', { fontFamily: 'Arial Black', fontSize: '12px', color: '#eaffff' }).setOrigin(.5).setDepth(62);
    const toggleAuto = () => { this.game.mobileInput.autoFire = !this.game.mobileInput.autoFire; updateProfile({ autoFire: this.game.mobileInput.autoFire }); autoLabel.setText(this.game.mobileInput.autoFire ? 'AUTO ON' : 'AUTO OFF'); auto.setStrokeStyle(3, this.game.mobileInput.autoFire ? 0x73ef62 : 0x7594a8, .9); };
    auto.on('pointerup', toggleAuto); this.disposers.push(() => auto.off('pointerup', toggleAuto));
    const updateStick = (pointer: Phaser.Input.Pointer, center: Phaser.Math.Vector2, knob: Phaser.GameObjects.Arc, output: Phaser.Math.Vector2) => { output.set(pointer.x - center.x, pointer.y - center.y); if (output.length() > 86) output.setLength(86); knob.setPosition(center.x + output.x, center.y + output.y); output.scale(1 / 86); };
    const reset = () => { this.movePointer = -1; this.aimPointer = -1; this.game.mobileInput.movement.set(0, 0); this.game.mobileInput.firing = false; moveKnob.setPosition(moveCenter.x, moveCenter.y); aimKnob.setPosition(aimCenter.x, aimCenter.y); };
    const onMove = (p: Phaser.Input.Pointer) => { if (p.id === this.movePointer) updateStick(p, moveCenter, moveKnob, this.game.mobileInput.movement); if (p.id === this.aimPointer) updateStick(p, aimCenter, aimKnob, this.game.mobileInput.aim); };
    const onUp = (p: Phaser.Input.Pointer) => { if (p.id === this.movePointer) { this.movePointer = -1; this.game.mobileInput.movement.set(0, 0); moveKnob.setPosition(moveCenter.x, moveCenter.y); } if (p.id === this.aimPointer) { this.aimPointer = -1; this.game.mobileInput.firing = false; aimKnob.setPosition(aimCenter.x, aimCenter.y); } };
    moveBase.on('pointerdown', (p: Phaser.Input.Pointer) => { this.movePointer = p.id; updateStick(p, moveCenter, moveKnob, this.game.mobileInput.movement); });
    aimBase.on('pointerdown', (p: Phaser.Input.Pointer) => { this.aimPointer = p.id; this.game.mobileInput.firing = true; updateStick(p, aimCenter, aimKnob, this.game.mobileInput.aim); });
    dash.on('pointerdown', () => { this.game.mobileInput.dash = true; });
    this.scene.input.on('pointermove', onMove); this.scene.input.on('pointerup', onUp); this.scene.input.on('pointercancel', reset); this.scene.input.on('gameout', reset);
    this.scene.events.once('shutdown', reset);
    this.disposers.push(() => { this.scene.input.off('pointermove', onMove); this.scene.input.off('pointerup', onUp); this.scene.input.off('pointercancel', reset); this.scene.input.off('gameout', reset); });
  }

  destroy() { this.disposers.splice(0).forEach((dispose) => dispose()); this.game.mobileInput.movement.set(0, 0); this.game.mobileInput.firing = false; }
}
