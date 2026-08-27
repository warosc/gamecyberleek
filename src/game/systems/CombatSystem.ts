export type DamageType = 'kinetic' | 'energy' | 'plasma' | 'bio';
export type DamageSource = 'player' | 'enemy' | 'environment';

export interface DamagePacket {
  baseAmount: number;
  type: DamageType;
  source: DamageSource;
  criticalChance?: number;
  criticalMultiplier?: number;
  armorReduction?: number;
  resistance?: number;
}

export interface DamageResult {
  amount: number;
  critical: boolean;
  type: DamageType;
}

export function resolveDamage(packet: DamagePacket, roll = Math.random()): DamageResult {
  const critical = roll < Math.max(0, packet.criticalChance ?? 0);
  const criticalMultiplier = critical ? Math.max(1, packet.criticalMultiplier ?? 2) : 1;
  const mitigation = Math.min(0.95, Math.max(0, packet.armorReduction ?? 0));
  const resistance = Math.min(0.95, Math.max(0, packet.resistance ?? 0));
  return {
    amount: Math.max(0, Math.round(packet.baseAmount * criticalMultiplier * (1 - mitigation) * (1 - resistance))),
    critical,
    type: packet.type,
  };
}

export const calculateDamage = (base: number, criticalChance: number, roll = Math.random()) => {
  const result = resolveDamage({
    baseAmount: base,
    type: 'energy',
    source: 'player',
    criticalChance,
  }, roll);
  return { amount: result.amount, critical: result.critical };
};
