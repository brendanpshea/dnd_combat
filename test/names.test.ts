/**
 * The name generators: deterministic, never a teacher's name or a famous
 * one, sayable, unique within a place, and patronymics that fit.
 */
import { describe, it, expect } from 'vitest';
import { seedRng, next } from '../src/engine/rng.js';

/** A random function from a seed, as the generators take. */
function R(seed: number): () => number {
  let st = seedRng(seed);
  return () => { const r = next(st); st = r.state; return r.value; };
}
import {
  NAME_STYLES, acceptable, firstName, surname, personName, placeName, bossName, beastName, minionName, styleFor,
} from '../src/adventure/names.js';
import { CORPORA, FAMOUS } from '../src/data/names/corpora.js';
import { generateCity } from '../src/adventure/city-gen.js';

const lower = (s: string) => s.toLowerCase();

describe('names', () => {
  it('are the same from the same seed', () => {
    for (const style of NAME_STYLES) {
      const a = R(7), b = R(7);
      expect(personName(style, 'female', a).full).toBe(personName(style, 'female', b).full);
      expect(placeName(style, a)).toBe(placeName(style, b));
    }
  });

  it('never hand back a name the chain learned from, nor a famous one', () => {
    for (const style of NAME_STYLES) {
      const c = CORPORA[style];
      const taught = new Set([...c.male, ...c.female, ...c.surname, ...c.place].map(lower));
      const rng = R(11);
      for (let i = 0; i < 40; i++) {
        for (const n of [firstName(style, 'male', rng), firstName(style, 'female', rng), placeName(style, rng)]) {
          expect(taught.has(lower(n)), `${style}: ${n}`).toBe(false);
          expect(FAMOUS.map(lower)).not.toContain(lower(n));
        }
      }
    }
  });

  it('turn away what cannot be said, or is famous', () => {
    const none = new Set<string>();
    expect(acceptable('Brkstn', none)).toBe(false);
    expect(acceptable('Aaalor', none)).toBe(false);
    expect(acceptable('Gandalv', none)).toBe(false);
    expect(acceptable('Brandy', new Set(['brandybrook']))).toBe(false);
    expect(acceptable('Merilwen', none)).toBe(true);
  });

  it('keep to their lengths', () => {
    const rng = R(3);
    for (const style of NAME_STYLES) for (let i = 0; i < 30; i++) {
      const f = firstName(style, 'male', rng);
      expect(f.length).toBeGreaterThanOrEqual(4);
      expect(f.length).toBeLessThanOrEqual(9);
      expect(placeName(style, rng).length).toBeLessThanOrEqual(11);
    }
  });

  it('are not repeated within a place', () => {
    const avoid = new Set<string>(), rng = R(5);
    const got = Array.from({ length: 30 }, () => firstName('saxon', 'female', rng, 9, avoid));
    expect(new Set(got).size).toBe(got.length);
  });

  it('give sons and daughters the right patronymic', () => {
    const rng = R(9);
    for (let i = 0; i < 60; i++) {
      expect(personName('norse', 'male', rng).last).not.toMatch(/dottir$/i);
      expect(personName('norse', 'female', rng).last).not.toMatch(/sson$/i);
    }
  });

  it('make sorcerers "of" somewhere as often as the corpus does', () => {
    const rng = R(4);
    const ofs = Array.from({ length: 80 }, () => personName('sorcery', 'male', rng).last).filter((l) => l.startsWith('of '));
    expect(ofs.length).toBeGreaterThan(0);
    for (const l of ofs) expect(l).toMatch(/^of [A-Z]\w+$/);
    expect(surname('saxon', rng)).toMatch(/^[A-Z]/);
  });

  it('name bosses, beasts and minions', () => {
    const rng = R(2);
    expect(bossName('norse', 'male', rng)).toMatch(/^[A-Z]\w+ (the )?[A-Z]/);
    expect(beastName(rng)).toMatch(/^[A-Z]/);
    expect(minionName(rng)).toMatch(/^[A-Z]/);
  });

  it('suit the place', () => {
    const rng = R(1);
    for (let i = 0; i < 40; i++) {
      expect(['saxon', 'hearth', 'isles', 'gaelic', 'slavic']).toContain(styleFor('village', 'village', rng));
      expect(['elvish', 'saxon', 'gaelic']).toContain(styleFor('delve', 'forest', rng));
    }
  });

  it('give a town proprietors who are all different people', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const m = generateCity(seed, { size: 'city', level: 3 }).module;
      // One keeper may stand in two scenes (the temple and its wares): count people, not scenes.
      const people = new Set(Object.values(m.scenes).flatMap((s) => 'npc' in s && s.npc ? [s.npc as { name: string }] : []));
      const names = [...people].map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
