import { EnemyType } from './EnemyTypes';

export const VEGETABLE_ROSTER = {
  [EnemyType.GRUNT]: { id: 'radish', name: 'RÁB-01', role: 'SOLDADO RÁBANO', height: 78, color: 0xff438a },
  [EnemyType.RUNNER]: { id: 'carrot', name: 'ZAN-7', role: 'ZANAHORIA VELOCISTA', height: 80, color: 0xffab32 },
  [EnemyType.TANK]: { id: 'eggplant', name: 'BER-8', role: 'BERENJENA BLINDADA', height: 112, color: 0xb66aff },
  [EnemyType.SHOOTER]: { id: 'tomato', name: 'TOM-4', role: 'TOMATE ARTILLERO', height: 92, color: 0xff7438 },
} as const;

export type VegetableType = keyof typeof VEGETABLE_ROSTER;
export const vegetableTexture = (type: VegetableType) => `vegetable-${VEGETABLE_ROSTER[type].id}`;
export const vegetableAsset = (type: VegetableType) => `assets/enemies/vegetables/${VEGETABLE_ROSTER[type].id}.png`;
export function isVegetableType(type: EnemyType): type is VegetableType {
  return type in VEGETABLE_ROSTER;
}
