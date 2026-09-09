import type { MomentumState } from './CombatMomentum';

export type ContractKind = 'ELIMINATIONS' | 'KILL_STREAK' | 'DEVICE_KILLS' | 'UNSCATHED' | 'ELITE_HUNT';

export interface ContractProgress {
  kind: ContractKind;
  title: string;
  target: number;
  progress: number;
  completed: boolean;
  reward: number;
}

export interface EnemyDefeatEvent {
  elite: boolean;
  boss: boolean;
  environment: boolean;
}

export interface ContractOutcome {
  contracts: ContractProgress[];
  completedCount: number;
  perfect: boolean;
  creditsEarned: number;
}

interface ContractBlueprint {
  kind: ContractKind;
  title: string;
  reward: number;
  rollTarget: () => number;
  describe: (target: number) => string;
}

/**
 * Data-only definitions. Targets are rolled per run so a contract never feels identical twice;
 * rewards scale roughly with how disruptive the objective is to a player's default playstyle.
 */
const BLUEPRINTS: Record<ContractKind, ContractBlueprint> = {
  ELIMINATIONS: {
    kind: 'ELIMINATIONS',
    title: 'ELIMINACIONES',
    reward: 45,
    rollTarget: () => 15 + Math.floor(Math.random() * 11), // 15-25
    describe: (target) => `Elimina ${target} enemigos`,
  },
  KILL_STREAK: {
    kind: 'KILL_STREAK',
    title: 'CADENA LETAL',
    reward: 55,
    rollTarget: () => 5 + Math.floor(Math.random() * 4), // 5-8
    describe: (target) => `Encadena ${target} bajas`,
  },
  DEVICE_KILLS: {
    kind: 'DEVICE_KILLS',
    title: 'SABOTAJE',
    reward: 60,
    rollTarget: () => 2 + Math.floor(Math.random() * 3), // 2-4
    describe: (target) => `Elimina ${target} enemigos con barriles`,
  },
  UNSCATHED: {
    kind: 'UNSCATHED',
    title: 'SIN RASGUÑOS',
    reward: 65,
    rollTarget: () => 30000 + Math.floor(Math.random() * 31) * 1000, // 30s-60s
    describe: (target) => `Sobrevive ${Math.round(target / 1000)}s sin recibir daño`,
  },
  ELITE_HUNT: {
    kind: 'ELITE_HUNT',
    title: 'CAZA MAYOR',
    reward: 70,
    rollTarget: () => 2 + Math.floor(Math.random() * 2), // 2-3
    describe: (target) => `Derrota a ${target} elites o al comandante`,
  },
};

export const ALL_CONTRACT_KINDS = Object.keys(BLUEPRINTS) as ContractKind[];
export const CONTRACTS_PER_RUN = 3;
export const PERFECT_BONUS_CREDITS = 120;

/** Fisher-Yates over a copy, mirroring `AbilityRegistry`'s `shuffled`. Kept engine-free. */
function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function contractDescription(contract: Pick<ContractProgress, 'kind' | 'target'>) {
  return BLUEPRINTS[contract.kind].describe(contract.target);
}

function rollContract(kind: ContractKind): ContractProgress {
  const blueprint = BLUEPRINTS[kind];
  return {
    kind,
    title: blueprint.title,
    target: blueprint.rollTarget(),
    progress: 0,
    completed: false,
    reward: blueprint.reward,
  };
}

function rollThreeContracts(): ContractProgress[] {
  return shuffled(ALL_CONTRACT_KINDS).slice(0, CONTRACTS_PER_RUN).map(rollContract);
}

/**
 * Rolls three distinct random contracts for the run and tracks their progress from the combat
 * events GameScene already emits (enemy deaths, momentum changes, player damage). Owns no
 * per-frame enemy/projectile scans of its own: everything here is O(1) against a 3-entry list.
 *
 * The constructor accepts an explicit contract list so unit tests can exercise progress and
 * reward logic deterministically without fighting the random selection; GameScene always uses
 * the default (a fresh random roll).
 */
export class ContractSystem {
  readonly list: ContractProgress[];
  private cleanSince = 0;

  constructor(contracts: ContractProgress[] = rollThreeContracts()) {
    this.list = contracts;
  }

  private find(kind: ContractKind) {
    return this.list.find((contract) => contract.kind === kind);
  }

  private complete(contract: ContractProgress) {
    contract.completed = true;
    contract.progress = contract.target;
  }

  /** Fed from `GameScene.resolveEnemyDeath`, the single choke point every kill already passes through. */
  onEnemyDefeated(event: EnemyDefeatEvent): ContractProgress | undefined {
    const eliminations = this.find('ELIMINATIONS');
    if (eliminations && !eliminations.completed) {
      eliminations.progress++;
      if (eliminations.progress >= eliminations.target) {
        this.complete(eliminations);
        return eliminations;
      }
    }
    if (event.environment) {
      const device = this.find('DEVICE_KILLS');
      if (device && !device.completed) {
        device.progress++;
        if (device.progress >= device.target) {
          this.complete(device);
          return device;
        }
      }
    }
    const eliteHunt = this.find('ELITE_HUNT');
    if (eliteHunt && !eliteHunt.completed) {
      // The commander is the run's single boss, so downing it always closes this contract
      // outright rather than counting as one more elite.
      if (event.boss) {
        this.complete(eliteHunt);
        return eliteHunt;
      }
      if (event.elite) {
        eliteHunt.progress++;
        if (eliteHunt.progress >= eliteHunt.target) {
          this.complete(eliteHunt);
          return eliteHunt;
        }
      }
    }
    return undefined;
  }

  /** Fed from the existing `CombatMomentum` state; tracks the longest chain reached this run. */
  onMomentumChanged(state: MomentumState): ContractProgress | undefined {
    const streak = this.find('KILL_STREAK');
    if (!streak || streak.completed) return undefined;
    streak.progress = Math.max(streak.progress, state.chain);
    if (streak.progress >= streak.target) {
      this.complete(streak);
      return streak;
    }
    return undefined;
  }

  /** Fed from `Events.PLAYER_DAMAGED` whenever damage was actually applied; resets the clean clock. */
  onPlayerDamaged(survivalMs: number) {
    this.cleanSince = survivalMs;
  }

  /** Called once per gameplay frame (never while paused, in a level-up, or after game over). */
  update(survivalMs: number): ContractProgress | undefined {
    const unscathed = this.find('UNSCATHED');
    if (!unscathed || unscathed.completed) return undefined;
    unscathed.progress = Math.min(unscathed.target, survivalMs - this.cleanSince);
    if (unscathed.progress >= unscathed.target) {
      this.complete(unscathed);
      return unscathed;
    }
    return undefined;
  }

  summary(): ContractOutcome {
    const completed = this.list.filter((contract) => contract.completed);
    const perfect = completed.length === this.list.length;
    const creditsEarned =
      completed.reduce((sum, contract) => sum + contract.reward, 0) + (perfect ? PERFECT_BONUS_CREDITS : 0);
    return { contracts: this.list, completedCount: completed.length, perfect, creditsEarned };
  }
}
