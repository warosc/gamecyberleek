import { EnemyType } from '../entities/enemies/EnemyTypes';

export const BOSS_START_MS = 240000;
export const UPGRADE_MILESTONES = [60000, 120000, 180000] as const;
export const RUN_PHASES = [
  { at: 0, label: 'RÁBANOS · MANTÉN DISTANCIA', interval: 1300, cap: 12, types: [EnemyType.GRUNT] },
  { at: 30000, label: 'ZANAHORIAS · SAL DE LA LÍNEA', interval: 1100, cap: 20, types: [EnemyType.GRUNT, EnemyType.GRUNT, EnemyType.RUNNER] },
  { at: 75000, label: 'TOMATES · ESQUIVA EL DISPARO', interval: 900, cap: 28, types: [EnemyType.GRUNT, EnemyType.RUNNER, EnemyType.SHOOTER] },
  { at: 135000, label: 'BRECHA ABIERTA · COMBINA TUS MEJORAS', interval: 700, cap: 32, types: [EnemyType.GRUNT, EnemyType.RUNNER, EnemyType.SHOOTER, EnemyType.TANK] },
  { at: 210000, label: 'ÚLTIMA OLEADA · PREPÁRATE PARA BRÓK-9', interval: 950, cap: 32, types: [EnemyType.GRUNT, EnemyType.RUNNER, EnemyType.SHOOTER] },
  { at: BOSS_START_MS, label: 'BRÓK-9 · DERROTA AL COMANDANTE', interval: 999999, cap: 0, types: [] },
] as const;
export function runPhase(time: number) {
  return [...RUN_PHASES].reverse().find(phase => time >= phase.at) ?? RUN_PHASES[0];
}
