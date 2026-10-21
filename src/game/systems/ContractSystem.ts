import type { MomentumState } from './CombatMomentum';
import { t } from '../i18n';
import { runRandom } from './RunRandom';

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
}

/**
 * Data-only definitions. Targets are rolled per run so a contract never feels identical twice;
 * rewards scale roughly with how disruptive the objective is to a player's default playstyle.
 *
 * Targets are sized against the real run: ~50 spawns in the first minute and ~290 before the
 * commander, a 1.8 s chain window, six barrels per arena and ~20 elites from 2:00. The earlier
 * ranges (15–25 kills, a 5-chain, 2 barrel kills, 2 elites or any boss kill, a clean half-minute
 * that could start at 0:00) were all met by just playing, so the perfect bonus was routine.
 */
const BLUEPRINTS: Record<ContractKind, ContractBlueprint> = {
  ELIMINATIONS: {
    kind: 'ELIMINATIONS',
    title: 'ELIMINACIONES',
    reward: 45,
    // ~130 enemies have spawned by 2:15, so this lands between 1:30 and 2:15 for a player who
    // clears the waves as they come, and not at all for one who only survives.
    rollTarget: () => 80 + Math.floor(runRandom('contracts') * 41), // 80-120
  },
  KILL_STREAK: {
    kind: 'KILL_STREAK',
    title: 'CADENA LETAL',
    reward: 55,
    // Needs a packed screen and a build that clears it, not a lucky pair of runners.
    rollTarget: () => 12 + Math.floor(runRandom('contracts') * 5), // 12-16
  },
  DEVICE_KILLS: {
    kind: 'DEVICE_KILLS',
    title: 'SABOTAJE',
    reward: 60,
    // Six barrels per arena: this asks for luring crowds onto them, not stray shots.
    rollTarget: () => 4 + Math.floor(runRandom('contracts') * 3), // 4-6
  },
  UNSCATHED: {
    kind: 'UNSCATHED',
    title: 'SIN RASGUÑOS',
    reward: 65,
    // Counted from UNSCATHED_START_MS only, so it is earned against carrots and tomatoes.
    rollTarget: () => 45000 + Math.floor(runRandom('contracts') * 31) * 1000, // 45s-75s
  },
  ELITE_HUNT: {
    kind: 'ELITE_HUNT',
    title: 'CAZA MAYOR',
    reward: 70,
    rollTarget: () => 5 + Math.floor(runRandom('contracts') * 3), // 5-7
  },
};

export const ALL_CONTRACT_KINDS = Object.keys(BLUEPRINTS) as ContractKind[];
export const contractTitle = (kind: ContractKind) => BLUEPRINTS[kind].title;
export const CONTRACTS_PER_RUN = 3;
export const PERFECT_BONUS_CREDITS = 120;
/**
 * The clean clock starts here, not at 0:00: the first 30 s are radishes only and cannot really
 * hurt anyone, so they used to hand out half of the contract for free.
 */
export const UNSCATHED_START_MS = 30000;
/**
 * The commander counts as this many elites. It used to close the hunt outright, which made the
 * contract a free completion for every victory.
 */
export const BOSS_ELITE_VALUE = 3;

/** Fisher-Yates over a copy, mirroring `AbilityRegistry`'s `shuffled`. Kept engine-free. */
function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(runRandom('contracts') * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function contractDescription(contract: Pick<ContractProgress, 'kind' | 'target'>) {
  const target = contract.kind === 'UNSCATHED' ? Math.round(contract.target / 1000) : contract.target;
  return t(`contract.${contract.kind}`, { target });
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
  private cleanSince = UNSCATHED_START_MS;

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

  /**
   * Fed from `GameScene.resolveEnemyDeath`, the single choke point every kill already passes
   * through. Every still-open contract is evaluated against the same kill (an elite killed by a
   * barrel, say, can count toward two contracts at once) — an early return here would silently
   * drop that second contract's progress whenever it happened to complete on the very kill that
   * also finished another one. Only one just-completed contract is reported back (GameScene
   * fires a single `CONTRACT_COMPLETED` per kill), but no contract's counter is ever skipped.
   */
  onEnemyDefeated(event: EnemyDefeatEvent): ContractProgress | undefined {
    let justCompleted: ContractProgress | undefined;
    const eliminations = this.find('ELIMINATIONS');
    if (eliminations && !eliminations.completed) {
      eliminations.progress++;
      if (eliminations.progress >= eliminations.target) {
        this.complete(eliminations);
        justCompleted = eliminations;
      }
    }
    if (event.environment) {
      const device = this.find('DEVICE_KILLS');
      if (device && !device.completed) {
        device.progress++;
        if (device.progress >= device.target) {
          this.complete(device);
          justCompleted ??= device;
        }
      }
    }
    const eliteHunt = this.find('ELITE_HUNT');
    if (eliteHunt && !eliteHunt.completed && (event.boss || event.elite)) {
      // The commander is worth several elites, not the whole hunt: the contract should still
      // ask for elites to be hunted before the finale.
      eliteHunt.progress += event.boss ? BOSS_ELITE_VALUE : 1;
      if (eliteHunt.progress >= eliteHunt.target) {
        this.complete(eliteHunt);
        justCompleted ??= eliteHunt;
      }
    }
    return justCompleted;
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
    // A hit during the warm-up must not move the start earlier than the warm-up's end.
    this.cleanSince = Math.max(UNSCATHED_START_MS, survivalMs);
  }

  /** Called once per gameplay frame (never while paused, in a level-up, or after game over). */
  update(survivalMs: number): ContractProgress | undefined {
    const unscathed = this.find('UNSCATHED');
    if (!unscathed || unscathed.completed) return undefined;
    unscathed.progress = Math.max(0, Math.min(unscathed.target, survivalMs - this.cleanSince));
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
