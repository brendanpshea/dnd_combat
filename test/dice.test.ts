import { describe, it, expect } from 'vitest';
import { parseDice, rollDice, rollD20, resolveRollMode } from '../src/engine/dice.js';
import { seedRng } from '../src/engine/rng.js';

describe('parseDice', () => {
  it('parses standard forms', () => {
    expect(parseDice('2d8+3')).toEqual({ count: 2, sides: 8, bonus: 3 });
    expect(parseDice('1d10')).toEqual({ count: 1, sides: 10, bonus: 0 });
    expect(parseDice('d4-1')).toEqual({ count: 1, sides: 4, bonus: -1 });
    expect(parseDice('3d6')).toEqual({ count: 3, sides: 6, bonus: 0 });
  });

  it('rejects garbage', () => {
    expect(() => parseDice('2d')).toThrow();
    expect(() => parseDice('d')).toThrow();
    expect(() => parseDice('8')).toThrow();
    expect(() => parseDice('2d6+')).toThrow();
  });
});

describe('rollDice', () => {
  it('respects count, sides, and bonus', () => {
    let s = seedRng(11);
    for (let i = 0; i < 200; i++) {
      const r = rollDice(s, '2d8+3');
      expect(r.rolls).toHaveLength(2);
      expect(r.total).toBe(r.rolls[0]! + r.rolls[1]! + 3);
      for (const die of r.rolls) {
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(8);
      }
      s = r.state;
    }
  });

  it('crit doubles dice but not the bonus', () => {
    const s = seedRng(5);
    const crit = rollDice(s, '1d8+3', true);
    expect(crit.rolls).toHaveLength(2);
    expect(crit.total).toBe(crit.rolls[0]! + crit.rolls[1]! + 3);
  });
});

describe('resolveRollMode (5e cancellation rule)', () => {
  it('cancels any advantage against any disadvantage', () => {
    expect(resolveRollMode([], [])).toBe('flat');
    expect(resolveRollMode(['vex'], [])).toBe('advantage');
    expect(resolveRollMode([], ['sap'])).toBe('disadvantage');
    expect(resolveRollMode(['vex'], ['sap'])).toBe('flat');
    expect(resolveRollMode(['vex', 'unconscious-target'], ['sap'])).toBe('flat');
    expect(resolveRollMode(['a'], ['b', 'c', 'd'])).toBe('flat');
  });
});

describe('rollD20', () => {
  it('advantage takes the higher die, disadvantage the lower', () => {
    let s = seedRng(99);
    for (let i = 0; i < 100; i++) {
      const adv = rollD20(s, 'advantage');
      expect(adv.dice).toHaveLength(2);
      expect(adv.natural).toBe(Math.max(...adv.dice));
      const dis = rollD20(adv.state, 'disadvantage');
      expect(dis.natural).toBe(Math.min(...dis.dice));
      s = dis.state;
    }
  });

  it('flat rolls one die', () => {
    const r = rollD20(seedRng(1), 'flat');
    expect(r.dice).toHaveLength(1);
    expect(r.natural).toBe(r.dice[0]);
  });
});
