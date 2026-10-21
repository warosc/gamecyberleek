import { hashSeed } from '../progression/DailyOperation';

/**
 * Gameplay randomness for the current run. The daily operation seeds it, so every player of the
 * day meets the same waves, upgrade offers, loot and contracts; until it did, only the sector,
 * weapon and mutator were shared and the global board compared different games. Ordinary runs
 * stay unseeded (Math.random).
 *
 * Each concern draws from its own stream: a player who picks different loot must not shift the
 * waves or the upgrade offers that follow. Cosmetic randomness (sparks, idle animations) keeps
 * using Math.random and never touches these streams.
 */
export type RandomStream = 'spawn' | 'upgrades' | 'loot' | 'contracts';

const STREAMS: readonly RandomStream[] = ['spawn', 'upgrades', 'loot', 'contracts'];

/** mulberry32: small, fast, and good enough for gameplay rolls. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seeded: Partial<Record<RandomStream, () => number>> = {};

/** Seeds every stream from `seed` (the daily run's identity), or unseeds them with undefined. */
export function setRunSeed(seed: string | undefined) {
  seeded = seed === undefined
    ? {}
    : Object.fromEntries(STREAMS.map(stream => [stream, mulberry32(hashSeed(`${seed}:${stream}`))]));
}

/** A number in [0, 1) from the given stream. */
export function runRandom(stream: RandomStream) {
  return (seeded[stream] ?? Math.random)();
}

/** The stream as a `() => number`, for APIs that take a random source. */
export const randomFrom = (stream: RandomStream) => () => runRandom(stream);
