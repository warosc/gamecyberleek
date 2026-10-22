import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { EnemyType } from './EnemyTypes';
import { enemyHealthMultiplier, sectorDamageMultiplier } from '../../config/EnemyScaling';

/**
 * Every regular enemy created during a run goes through here (waves, boss reinforcements, brood
 * splits), so a runner split off a brood at 3:30 is as tough as one spawned by the wave next to it.
 * Without arguments the enemy keeps its base stats, which the e2e scenes rely on.
 */
export function createScaledEnemy(
  scene: Phaser.Scene,
  type: EnemyType,
  x: number,
  y: number,
  survivalMs = 0,
  sector = 0,
  threat = 0,
) {
  return new Enemy(scene, x, y, type)
    .applyScaling(enemyHealthMultiplier(survivalMs, sector, threat), sectorDamageMultiplier(sector));
}

export class EnemyFactory {
  constructor(private scene: Phaser.Scene) {}
  create(type: EnemyType, x: number, y: number, survivalMs = 0, sector = 0, threat = 0) {
    return createScaledEnemy(this.scene, type, x, y, survivalMs, sector, threat);
  }
}
