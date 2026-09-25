import Phaser from 'phaser';
import { ARENA, COLORS } from '../config/Constants';
import type { CombatEffects } from '../effects/CombatEffects';
import type { Player } from '../entities/player/Player';
import { EquipmentDrop } from '../loot/EquipmentDrop';
import { rollEquipment } from '../loot/Equipment';
import type { AudioManager } from '../managers/AudioManager';

interface LootSystemOptions {
  player: Player;
  effects: CombatEffects;
  audio: AudioManager;
  level: () => number;
}

export class LootSystem {
  readonly chests: Phaser.Physics.Arcade.Group;
  readonly drops: Phaser.Physics.Arcade.Group;

  constructor(private readonly scene: Phaser.Scene, private readonly options: LootSystemOptions) {
    this.chests = scene.physics.add.group({ runChildUpdate: false });
    this.drops = scene.physics.add.group({ runChildUpdate: false });
  }

  spawnChest() {
    const { player } = this.options;
    const x = Phaser.Math.Clamp(player.x + Phaser.Math.Between(-420, 420), 80, ARENA.width - 80);
    const y = Phaser.Math.Clamp(player.y + Phaser.Math.Between(-300, 300), 80, ARENA.height - 80);
    const chest = this.scene.add.rectangle(x, y, 54, 42, 0x173650)
      .setStrokeStyle(4, COLORS.green, 0.95).setDepth(7);
    chest.setData('opened', false);
    this.scene.physics.add.existing(chest);
    (chest.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    this.chests.add(chest);
    this.scene.tweens.add({ targets: chest, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });
  }

  openChest(object: Phaser.GameObjects.GameObject) {
    const chest = object as Phaser.GameObjects.Rectangle;
    if (chest.getData('opened') as boolean) return false;
    chest.setData('opened', true);
    chest.destroy();
    return true;
  }

  spawnEquipmentDrop() {
    const equipment = rollEquipment(this.options.level());
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const x = Phaser.Math.Clamp(this.options.player.x + Math.cos(angle) * 145, 70, ARENA.width - 70);
    const y = Phaser.Math.Clamp(this.options.player.y + Math.sin(angle) * 145, 70, ARENA.height - 70);
    this.drops.add(new EquipmentDrop(this.scene, x, y, equipment));
    this.options.effects.floatingText(x, y - 82, 'EQUIPO DETECTADO', `#${equipment.color.toString(16).padStart(6, '0')}`);
    this.options.audio.tone(880, 0.18, 0.035);
  }

  collectEquipment(object: Phaser.GameObjects.GameObject) {
    const drop = object as EquipmentDrop;
    if (!drop.active) return;
    const equipment = drop.equipment;
    const burst = this.scene.add.circle(drop.x, drop.y, 18, equipment.color, 0.45).setDepth(20);
    this.scene.tweens.add({ targets: burst, scale: 5, alpha: 0, duration: 420, onComplete: () => burst.destroy() });
    drop.destroy();
    this.options.audio.tone(equipment.rarity === 'LEGENDARY' ? 1040 : 720, 0.28, 0.045);
    return equipment;
  }
}
