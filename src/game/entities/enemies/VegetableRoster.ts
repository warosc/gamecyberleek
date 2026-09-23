import { EnemyType } from './EnemyTypes';

/**
 * `art` names the production sprite a role uses. The three later families reuse an existing
 * sprite with a colour grade (`tint`) until dedicated artwork exists, so each texture is loaded
 * once however many roles share it.
 */
export const VEGETABLE_ROSTER = {
  [EnemyType.GRUNT]: { id: 'radish', art: 'radish', name: 'RÁB-01', role: 'SOLDADO RÁBANO', height: 78, color: 0xff438a },
  [EnemyType.RUNNER]: { id: 'carrot', art: 'carrot', name: 'ZAN-7', role: 'ZANAHORIA VELOCISTA', height: 80, color: 0xffab32 },
  [EnemyType.TANK]: { id: 'eggplant', art: 'eggplant', name: 'BER-8', role: 'BERENJENA BLINDADA', height: 112, color: 0xb66aff },
  [EnemyType.SHOOTER]: { id: 'tomato', art: 'tomato', name: 'TOM-4', role: 'TOMATE ARTILLERO', height: 92, color: 0xff7438 },
  [EnemyType.MEDIC]: { id: 'medic', art: 'radish', name: 'COL-3', role: 'COL MÉDICA', height: 74, color: 0x5dffb0, tint: 0x9dffc8 },
  [EnemyType.BULWARK]: { id: 'bulwark', art: 'eggplant', name: 'PAP-5', role: 'PATATA BALUARTE', height: 122, color: 0x7fb2ff, tint: 0x9cc4ff },
  [EnemyType.BROOD]: { id: 'brood', art: 'tomato', name: 'CEB-9', role: 'CEBOLLA NIDO', height: 88, color: 0xf2e36b, tint: 0xfff08a },
} as const;

export type VegetableType = keyof typeof VEGETABLE_ROSTER;
export const vegetableTexture = (type: VegetableType) => `vegetable-${VEGETABLE_ROSTER[type].art}`;
export const vegetableAsset = (type: VegetableType) => `assets/enemies/vegetables/${VEGETABLE_ROSTER[type].art}.png`;
export const vegetableTint = (type: VegetableType): number | undefined =>
  'tint' in VEGETABLE_ROSTER[type] ? (VEGETABLE_ROSTER[type] as { tint: number }).tint : undefined;
/** One entry per distinct sprite, for the loader. */
export const VEGETABLE_ART = [...new Set(Object.values(VEGETABLE_ROSTER).map(spec => spec.art))];
export function isVegetableType(type: EnemyType): type is VegetableType {
  return type in VEGETABLE_ROSTER;
}
