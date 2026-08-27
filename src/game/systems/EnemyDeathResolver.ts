import { EnemyType } from '../entities/enemies/EnemyTypes';

export interface DefeatableEnemy {
  x: number;
  y: number;
  xpReward: number;
  enemyType: EnemyType;
  health: { max: number };
  destroy(): void;
}

export interface EnemyDefeat {
  x: number;
  y: number;
  xp: number;
  boss: boolean;
  maxHealth: number;
}

export class EnemyDeathResolver {
  private readonly resolved = new WeakSet<DefeatableEnemy>();

  resolve(enemy: DefeatableEnemy): EnemyDefeat | null {
    if (this.resolved.has(enemy)) return null;
    this.resolved.add(enemy);
    const defeat = {
      x: enemy.x,
      y: enemy.y,
      xp: enemy.xpReward,
      boss: enemy.enemyType === EnemyType.BOSS,
      maxHealth: enemy.health.max,
    };
    enemy.destroy();
    return defeat;
  }
}
