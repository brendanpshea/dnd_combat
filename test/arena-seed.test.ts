import { describe, it, expect } from 'vitest';
import { offerSeed } from '../src/arena/seed.js';

/**
 * The offers at a door (check, bounty, prize) are picked with `seed % n`, so
 * the seed's low bits must move with every part of the key. The weighted sums
 * they replaced did not: with a multiplier divisible by three, the wave never
 * changed which of three eligible checks a door offered.
 */
describe('offerSeed', () => {
  it('reaches every choice as the wave moves, for small pools', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      for (const door of [0, 1, 2]) {
        const seen = new Set<number>();
        for (let wave = 1; wave <= 40; wave++) {
          seen.add(offerSeed('gambit', { runSeed: 1234, wave, half: 'morning', door }) % n);
        }
        expect(seen.size, `pool of ${n}, door ${door}`).toBe(n);
      }
    }
  });

  it('is stable for one fight, and different for each kind of offer', () => {
    const key = { runSeed: 77, wave: 3, half: 'afternoon' as const, door: 2 };
    expect(offerSeed('bounty', key)).toBe(offerSeed('bounty', { ...key }));
    expect(offerSeed('bounty', key)).not.toBe(offerSeed('spoil', key));
    expect(offerSeed('bounty', key)).not.toBe(offerSeed('bounty', { ...key, half: 'morning' }));
  });
});
