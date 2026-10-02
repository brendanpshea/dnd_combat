/**
 * The trilogy's numeric facts (src/data/modules/canon.ts): each one's text
 * says its value, the rules that pay or charge it use that value, and facts
 * that depend on each other agree.
 */
import { describe, it, expect } from 'vitest';
import { TRILOGY_FACTS } from '../src/data/modules/canon.js';
import { HOLLOW_ROAD_MODULE } from '../src/data/modules/hollow-road.js';
import { SUNKEN_BARROWS_MODULE } from '../src/data/modules/sunken-barrows.js';
import { WYRMCALLING_MODULE } from '../src/data/modules/wyrmcalling.js';
import type { Module } from '../src/adventure/types.js';

const v = (id: string) => TRILOGY_FACTS[id]!.value!;
const text = (id: string) => TRILOGY_FACTS[id]!.text;

/** The number an English phrase spells: "a hundred and twenty gold" → 120. */
const UNITS: Record<string, number> = {
  a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
function spelled(phrase: string): number | undefined {
  let total = 0, current = 0, seen = false;
  for (const word of phrase.toLowerCase().split(/[\s-]+/)) {
    if (/^\d+$/.test(word)) { current += Number(word); seen = true; }
    else if (word in UNITS) { current += UNITS[word]!; seen = true; }
    else if (word === 'hundred') current *= 100;
    else if (word === 'thousand') { total += current * 1000; current = 0; }
    else if (word === 'dozen') current = (current || 1) * 12;
  }
  return seen ? total + current : undefined;
}

/** Every string in a module, deeply. */
const strings = (value: unknown): string[] =>
  typeof value === 'string' ? [value]
    : Array.isArray(value) ? value.flatMap(strings)
      : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const TRILOGY = [HOLLOW_ROAD_MODULE, SUNKEN_BARROWS_MODULE, WYRMCALLING_MODULE];
const PROSE = TRILOGY.flatMap((m) => strings(m.scenes).concat(strings(m.dawns)));

/** The choice `id` inside scene `scene` (searched deeply: next, lines, hubs). */
function choice(m: Module, scene: string, id: string): Record<string, any> {
  const find = (x: unknown): Record<string, any> | undefined => {
    if (Array.isArray(x)) { for (const y of x) { const f = find(y); if (f) return f; } return undefined; }
    if (x && typeof x === 'object') {
      const o = x as Record<string, any>;
      if (o.id === id && 'to' in o) return o;
      for (const y of Object.values(o)) { const f = find(y); if (f) return f; }
    }
    return undefined;
  };
  const c = find(m.scenes[scene]);
  if (!c) throw new Error(`${m.id}: no choice '${id}' in '${scene}'`);
  return c;
}
const gold = (effects: Array<{ kind: string; amount?: number }> | undefined) =>
  (effects ?? []).filter((e) => e.kind === 'gold').map((e) => e.amount);
const goldNeeded = (requires: Array<{ kind: string; atLeast?: number }> | undefined) =>
  (requires ?? []).filter((r) => r.kind === 'gold').map((r) => r.atLeast);

describe('the trilogy\'s numeric facts', () => {
  const numeric = Object.entries(TRILOGY_FACTS).filter(([, f]) => f.value !== undefined);

  it.each(numeric)('%s: its text spells its value, and the prose says it', (id, fact) => {
    expect(spelled(fact.text)).toBe(fact.value);
    expect(PROSE.some((s) => s.toLowerCase().includes(fact.text.toLowerCase()))).toBe(true);
  });

  it('the reeve\'s balance is the bounty less the retainer', () => {
    expect(v('bounty-balance')).toBe(v('bounty-full') - v('bounty-retainer'));
  });

  it('the Reedwife kept her door since before Thornwick had a name', () => {
    expect(v('door-kept')).toBeGreaterThan(v('thornwick-liturgy'));
  });

  it('the Calling peaks the night Wren reckons, on the dawn after it', () => {
    const dawns = WYRMCALLING_MODULE.dawns ?? [];
    const warned = dawns.find((d) => strings(d.text).some((s) => s.toLowerCase().includes(text('peak-nights'))));
    const peaked = dawns.find((d) => (d.effects ?? []).some((e) => e.kind === 'setFlag' && e.flag === 'calling-peaked'));
    expect(warned && peaked && peaked.day - warned.day).toBe(v('peak-nights'));
  });

  it('what is paid or charged is what the prose says', () => {
    const hr = HOLLOW_ROAD_MODULE, sb = SUNKEN_BARROWS_MODULE, wc = WYRMCALLING_MODULE;
    const paid = (m: Module, scene: string, id: string, fact: string) =>
      expect(gold(choice(m, scene, id).effects), `${m.id}:${scene}/${id}`).toEqual([v(fact)]);
    const charged = (m: Module, scene: string, id: string, fact: string) => {
      const c = choice(m, scene, id);
      expect(gold(c.effects), `${m.id}:${scene}/${id}`).toEqual([-v(fact)]);
      expect(goldNeeded(c.requires), `${m.id}:${scene}/${id}`).toEqual([v(fact)]);
      expect(c.label).toContain(`${v(fact)} gold`);
    };
    paid(hr, 'board', 'ok', 'bounty-retainer');
    paid(hr, 'aftermath-hub', 'bounty', 'bounty-full');
    paid(hr, 'aftermath-hub', 'balance', 'bounty-balance');
    paid(hr, 'aftermath-hub', 'banner', 'bounty-banner');
    paid(hr, 'aftermath-hub', 'scout', 'scout-reward');
    expect(gold(choice(hr, 'spy-confront', 'investigate').check.failEffects)).toEqual([-v('pinched-purse')]);
    charged(hr, 'tavern', 'persuade', 'tavern-round');
    charged(hr, 'tavern', 'room', 'inn-room');
    charged(sb, 'inn', 'room', 'inn-room');
    paid(sb, 'lights-won', 'keep', 'drowned-gold');
    paid(sb, 'marrow-spared', 'bind', 'offering-purse');
    charged(sb, 'sb-aftermath-hub', 'mira', 'taproom-supper');
    charged(wc, 'onihold', 'pay', 'ogre-toll');
  });
});
