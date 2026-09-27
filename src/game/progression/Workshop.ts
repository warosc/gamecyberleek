import type { PlayerStats } from '../entities/player/PlayerStats';

export type WorkshopUpgradeId = 'plating' | 'firepower' | 'magnet' | 'dash' | 'salvage';
export type WorkshopRanks = Record<WorkshopUpgradeId, number>;

export interface WorkshopUpgrade {
  id: WorkshopUpgradeId;
  name: string;
  /** Short effect per rank, shown on the workshop card. */
  effect: string;
  color: number;
  /** Cost of buying rank `index + 1`; its length is the maximum rank. */
  costs: readonly number[];
}

/**
 * Permanent bio-credit upgrades. Each rank is deliberately small: a maxed workshop makes a
 * fresh loadout noticeably sturdier, but the run's level-ups and loot still decide the build.
 */
export const WORKSHOP_UPGRADES: readonly WorkshopUpgrade[] = [
  { id: 'plating', name: 'BLINDAJE FOLIAR', effect: '+10 PV máx.', color: 0x73ef62, costs: [60, 120, 200, 320, 480] },
  { id: 'firepower', name: 'NÚCLEO DE DAÑO', effect: '+4% daño', color: 0xff476f, costs: [80, 160, 260, 400, 600] },
  { id: 'magnet', name: 'IMÁN DE SAVIA', effect: '+22 radio de XP', color: 0x21e6ff, costs: [50, 110, 190] },
  { id: 'dash', name: 'BATERÍA DE DASH', effect: '−7% recarga de dash', color: 0xd566ff, costs: [70, 150, 260] },
  { id: 'salvage', name: 'RECICLAJE', effect: '+10% bio-créditos', color: 0xffc857, costs: [100, 220, 380] },
];

export const EMPTY_WORKSHOP: WorkshopRanks = { plating: 0, firepower: 0, magnet: 0, dash: 0, salvage: 0 };

export function workshopUpgrade(id: WorkshopUpgradeId) {
  return WORKSHOP_UPGRADES.find(upgrade => upgrade.id === id)!;
}

export function maxRank(id: WorkshopUpgradeId) {
  return workshopUpgrade(id).costs.length;
}

/** Cost of the next rank, or `undefined` when the upgrade is maxed. */
export function nextRankCost(id: WorkshopUpgradeId, ranks: Readonly<WorkshopRanks>) {
  return workshopUpgrade(id).costs[ranks[id]];
}

export function normalizeWorkshop(value: unknown): WorkshopRanks {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Record<string, unknown>>;
  const ranks = { ...EMPTY_WORKSHOP };
  for (const upgrade of WORKSHOP_UPGRADES) {
    const rank = raw[upgrade.id];
    if (typeof rank === 'number' && Number.isFinite(rank))
      ranks[upgrade.id] = Math.min(Math.max(0, Math.floor(rank)), upgrade.costs.length);
  }
  return ranks;
}

/** Pure purchase rule: returns the new balance and ranks, or `undefined` when not allowed. */
export function purchaseRank(id: WorkshopUpgradeId, ranks: Readonly<WorkshopRanks>, credits: number) {
  const cost = nextRankCost(id, ranks);
  if (cost === undefined || credits < cost) return undefined;
  return { credits: credits - cost, ranks: { ...ranks, [id]: ranks[id] + 1 } };
}

export function applyWorkshop(stats: PlayerStats, ranks: Readonly<WorkshopRanks>) {
  stats.maxHp += ranks.plating * 10;
  stats.attackDamage *= 1 + ranks.firepower * 0.04;
  stats.magnetRadius += ranks.magnet * 22;
  stats.dashCooldown *= 1 - ranks.dash * 0.07;
}

export function creditMultiplier(ranks: Readonly<WorkshopRanks>) {
  return 1 + ranks.salvage * 0.1;
}
