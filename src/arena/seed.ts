/**
 * The seed behind one of a fight's offers: its pre-fight check, its bounty,
 * its prize.
 *
 * Each of those used to mix its own seed as a plain weighted sum of the run,
 * wave, half and door, and pick with `seed % pool.length`. A sum like that
 * keeps the low bits of its inputs, so the pick followed simple patterns: with
 * a multiplier divisible by three, the wave never changed which of three
 * eligible checks a door offered. Two of them were also keyed on the wrong
 * clock (the day, not the wave) and one forgot the half. So there is one
 * function, fed the same key everywhere, that hashes it.
 *
 * The wave and the doors themselves (`buildWave`, `gatesFor`) still use their
 * original mixers: changing those would reroll every fight in every saved run.
 */
import type { DayHalf } from './run.js';

/** MurmurHash3's finaliser: every input bit reaches every output bit. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface OfferKey {
  runSeed: number;
  wave: number;
  half: DayHalf;
  door: number;
}

/** A well-mixed 32-bit seed for the `what` drawn at this fight. */
export function offerSeed(
  what: 'gambit' | 'bounty' | 'spoil', key: OfferKey, ...extra: number[]
): number {
  let h = what === 'gambit' ? 0x9e3779b9 : what === 'bounty' ? 0x7f4a7c15 : 0x2545f491;
  for (const part of [key.runSeed, key.wave, key.half === 'afternoon' ? 1 : 0, key.door, ...extra]) {
    h = fmix32((h ^ (part >>> 0)) + 0x6b43a9b5);
  }
  return h;
}
