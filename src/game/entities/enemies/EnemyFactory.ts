import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { EnemyType } from './EnemyTypes';
export class EnemyFactory {
  constructor(private scene: Phaser.Scene) {}
  create(type: EnemyType, x: number, y: number) {
    return new Enemy(this.scene, x, y, type);
  }
}
