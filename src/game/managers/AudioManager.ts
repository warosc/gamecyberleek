import Phaser from 'phaser';

/**
 * One AudioContext for the whole game, created on the first user gesture that reaches any
 * scene and never replaced.
 *
 * A context per `GameScene` leaked one on every restart, and browsers cap concurrent contexts
 * per document — iOS Safari most tightly — so repeated runs eventually failed with
 * "Failed to start the audio device" and lost audio for the rest of the session.
 */
let context: AudioContext | undefined;

function unlock() {
  if (context) return;
  try {
    context = new AudioContext();
  } catch {
    // Audio is optional; a browser refusing a context must never interrupt a run.
    return;
  }
  // Safari can hand back a suspended context even inside a gesture.
  void context.resume().catch(() => undefined);
}

export class AudioManager {
  constructor(scene: Phaser.Scene) {
    // Re-arm per scene only while no context exists: a run where the player never taps
    // leaves nothing behind, and the next run gets another chance to unlock.
    if (!context) scene.input.once('pointerdown', unlock);
  }

  tone(frequency: number, duration = 0.04, volume = 0.025) {
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'square';
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }
}
