import Phaser from 'phaser';
export class AudioManager {
  private context?: AudioContext;
  constructor(scene: Phaser.Scene) {
    scene.input.once('pointerdown', () => {
      this.context ??= new AudioContext();
    });
  }
  tone(frequency: number, duration = 0.04, volume = 0.025) {
    if (!this.context || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'square';
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }
}
