import { describe, it, expect } from 'vitest';
import { seedRng, next, rollDie, coinFlip } from '../src/engine/rng.js';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    let a = seedRng(42);
    let b = seedRng(42);
    for (let i = 0; i < 100; i++) {
      const ra = next(a);
      const rb = next(b);
      expect(ra.value).toBe(rb.value);
      a = ra.state;
      b = rb.state;
    }
  });

  it('diverges for different seeds, including adjacent small seeds', () => {
    const seq = (seed: number) => {
      let s = seedRng(seed);
      const out: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = next(s);
        out.push(r.value);
        s = r.state;
      }
      return out;
    };
    expect(seq(0)).not.toEqual(seq(1));
    expect(seq(1)).not.toEqual(seq(2));
  });

  it('rollDie stays within [1, sides] and covers the range', () => {
    let s = seedRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const r = rollDie(s, 20);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(20);
      seen.add(r.value);
      s = r.state;
    }
    expect(seen.size).toBe(20);
  });

  it('coinFlip produces both outcomes', () => {
    let s = seedRng(3);
    const seen = new Set<boolean>();
    for (let i = 0; i < 100; i++) {
      const r = coinFlip(s);
      seen.add(r.value);
      s = r.state;
    }
    expect(seen.size).toBe(2);
  });
});
