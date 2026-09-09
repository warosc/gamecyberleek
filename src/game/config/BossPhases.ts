import { EnemyType } from '../entities/enemies/EnemyTypes';

export const BOSS_REINFORCEMENTS = [
  { phase2: [EnemyType.RUNNER, EnemyType.SHOOTER, EnemyType.RUNNER], phase3: [EnemyType.SHOOTER, EnemyType.RUNNER, EnemyType.SHOOTER, EnemyType.RUNNER] },
  { phase2: [EnemyType.GRUNT, EnemyType.TANK, EnemyType.GRUNT], phase3: [EnemyType.RUNNER, EnemyType.GRUNT, EnemyType.TANK, EnemyType.GRUNT] },
  { phase2: [EnemyType.SHOOTER, EnemyType.RUNNER, EnemyType.SHOOTER], phase3: [EnemyType.RUNNER, EnemyType.RUNNER, EnemyType.SHOOTER, EnemyType.SHOOTER] },
] as const;

export const BOSS_PHASE_CALLOUTS = {
  2: { title: 'PROTOCOLO DE REFUERZO', brief: 'ROMPE LA ESCOLTA DE BRÓK-9', color: 0xffb52e },
  3: { title: 'NÚCLEO EN SOBRECARGA', brief: 'ÚLTIMA FASE · NO DEJES DE MOVERTE', color: 0xff476f },
} as const;
