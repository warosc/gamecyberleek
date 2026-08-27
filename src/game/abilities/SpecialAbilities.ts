export type SpecialAbilityId = 'nova' | 'shield' | 'overdrive';

export interface SpecialAbilityDefinition {
  id: SpecialAbilityId;
  key: 'Q' | 'E' | 'R';
  name: string;
  cooldown: number;
  color: number;
}

export const SPECIAL_ABILITIES: SpecialAbilityDefinition[] = [
  { id: 'nova', key: 'Q', name: 'LEEK NOVA', cooldown: 8000, color: 0x21e6ff },
  { id: 'shield', key: 'E', name: 'BIO SHIELD', cooldown: 12000, color: 0x73ef62 },
  { id: 'overdrive', key: 'R', name: 'OVERDRIVE', cooldown: 18000, color: 0xd566ff },
];
