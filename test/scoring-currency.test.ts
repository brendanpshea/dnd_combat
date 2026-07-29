/**
 * Every spell has to be priced in the same currency: hit points.
 *
 * THE BUG THIS EXISTS FOR, SIX TIMES OVER
 *
 * `damageValue` returns an expectation in hit points — a Fireball across three
 * orcs comes to about eighty. Control, buff and ward spells were priced on
 * hand-tuned 0-to-10 scales instead:
 *
 *     Bless           3 a head, capped near 15 for the whole party
 *     Haste           4, less than a cantrip
 *     Mirror Image    5 + 2 per threat
 *     Mage Armor      4
 *     Death Ward      6 - slotCost
 *     Fear            3.5 a head
 *
 * Nothing on the first scale can outbid anything on the second, so a caster
 * with any damage on its list never chose them. Fourteen playable spells were
 * cast zero times across sixty level-8 runs.
 *
 * It was never one bug. It was one HABIT — reaching for a plausible small
 * number when the thing being priced is not damage — and it grew back three
 * separate times while this codebase was being worked on. So rather than fix
 * the six and wait for the seventh, this reads the scorer and holds every
 * return to being expressed through one of the shared currencies.
 *
 * WHAT COUNTS AS A CURRENCY
 *
 *     damageValue        hit points removed
 *     rescueValue        hit points kept, weighted by real danger
 *     wardValue          the same, for a ward put up in anticipation
 *     denialValue        an enemy's output, removed for some rounds
 *     upliftValue        an ally's output, raised
 *     incomingPerRound   what is being thrown at a creature
 *     outputPerRound     what a creature does with a round
 *
 * A `return 0` is always fine: that is a gate, not a price.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GREEDY = fileURLToPath(new URL('../src/ai/greedy.ts', import.meta.url));

/**
 * The value functions — things that return a price in hit points.
 *
 * `avgDice` and `hitProb` are deliberately NOT here. They are INGREDIENTS: a
 * dice average is not a valuation, and counting them let a case pass merely for
 * mentioning one. Planting Haste's old flat `4 + meleeBonus` back proved it —
 * `meleeBonus` is computed with `avgDice`, so the case still contained a
 * "currency" and the guard stayed green on exactly the bug it exists to catch.
 */
const CURRENCIES = [
  'damageValue', 'rescueValue', 'wardValue', 'denialValue', 'upliftValue',
  'incomingPerRound', 'outputPerRound',
  // `heal` is the hit points a heal restores — a price, not an ingredient.
  'heal',
];

/**
 * Returns that are a bare number by design, each with a reason.
 *
 * The bar for being here is that the quantity genuinely is not hit points and
 * cannot be converted into them without inventing a model this game does not
 * have — not that a number happened to look about right.
 */
const ALLOWED: Record<string, string> = {
  'misty-step': 'A teleport is a POSITION, and this game cannot price one — the same reason Dimension Door is unscored entirely. The number is a nudge to take a good landing spot when one exists, not a valuation.',
  'find-familiar': 'An owl granting advantage once a round. Its worth is the advantage, which is priced where advantage is priced; this is the standing cost of the ritual.',
  'lesser-restoration': 'Priced off a per-condition weight table, which is its own small currency — how bad each condition is relative to the others, not hit points.',
  'dispel-magic': 'The value is whatever the enemy spell was worth, which this AI has no way to look up. Counting held effects is the honest proxy available.',
  'sanctuary': 'A ward that breaks the moment its holder attacks, so its value is mostly about what the holder intends to do next — not something the board says.',
  'protection-from-evil-and-good': 'Scaled by how much of the enemy roster it actually applies to, which is a fraction rather than a quantity of hit points.',
  'protection-from-energy': 'Priced off the breath damage it would absorb, which IS hit points — the constant is the share of fights where that breath actually arrives.',
  'aid': 'Hit points directly: five per ally, discounted for arriving before they are needed.',
  'ice-storm': 'The bonus is for the difficult ground left behind, which slows both sides — deliberately small and deliberately not hit points.',
  'conjure-animals': 'A floor, so a pack that lands on nobody is still worth casting because it will run somebody down next turn.',
};

/**
 * Each case of `scoreSpell`, whole.
 *
 * The WHOLE body, not just the return line. Moonbeam and Call Lightning
 * accumulate `damageValue` into a running total across a loop and then return
 * `v * 1.5 - slotCost`; reading the return alone flags both as bare constants,
 * which is a false positive that would push two correctly-priced spells onto
 * the exemption list and quietly weaken the check for everything else.
 */
function casesOf(): Array<{ spellId: string; body: string }> {
  const src = readFileSync(GREEDY, 'utf8');
  const body = src.slice(src.indexOf('function scoreSpell'));
  const scored = body.slice(0, body.indexOf('\nconst END_TURN_THRESHOLD'));
  const parts = scored.split(/\n {4}case '([a-z0-9-]+)':/);
  const out: Array<{ spellId: string; body: string }> = [];
  for (let i = 1; i < parts.length; i += 2) {
    out.push({ spellId: parts[i]!, body: parts[i + 1]! });
  }
  return out;
}

describe('spell scoring currency', () => {
  it('prices every spell in hit points, or says why not', () => {
    const offenders = new Set<string>();
    for (const { spellId, body } of casesOf()) {
      if (ALLOWED[spellId]) continue;
      // Delegation counts: a scroll is worth what the spell it casts is worth.
      if (body.includes('scoreSpell(')) continue;
      // Variables that hold a price, so `v += damageValue(...)` then
      // `return v * 1.5` reads as priced — which it is. Without this, Moonbeam
      // and Call Lightning are false positives, and pushing two correctly
      // priced spells onto the exemption list weakens the check for everything.
      const priced = new Set<string>();
      for (const m of body.matchAll(/(?:const|let)\s+(\w+)[^;\n]*=([^;]*)/g)) {
        if (CURRENCIES.some((c) => m[2]!.includes(c))) priced.add(m[1]!);
      }
      for (const m of body.matchAll(/(\w+)\s*\+?=\s*([^;]*)/g)) {
        if (CURRENCIES.some((c) => m[2]!.includes(c))) priced.add(m[1]!);
      }
      const anyPrice = [...body.matchAll(/return ([^;]+);/g)]
        .map((m) => m[1]!.trim())
        .some((e) => e !== '0');
      // A case that reaches NO currency at all and still returns something is
      // priced on a scale of its own, whatever its final line looks like.
      // Bless accumulated `v += 3` in a loop and returned `v - slotCost`: no
      // digit on the return line, so a digit-only check waved it through — on
      // exactly the spell that started this whole investigation.
      if (anyPrice && !CURRENCIES.some((c) => body.includes(c))) {
        offenders.add(`${spellId}: priced without any currency`);
        continue;
      }
      const prices = [...body.matchAll(/return ([^;]+);/g)]
        .map((m) => m[1]!.replace(/\s+/g, ' ').trim())
        .filter((e) => /\d/.test(e) && e !== '0')
        .filter((e) => !CURRENCIES.some((c) => e.includes(c)))
        .filter((e) => ![...priced].some((v) => new RegExp(`\\b${v}\\b`).test(e)));
      if (prices.length === 0) continue;                 // gates only, or priced
      offenders.add(`${spellId}: return ${prices[0]}`);
    }
    expect(
      [...offenders],
      'these are priced on a scale of their own, which no damage spell can lose to:\n'
        + [...offenders].join('\n'),
    ).toEqual([]);
  });

  it('keeps the exemption list honest', () => {
    // An exemption for a spell that has since been converted, or that no longer
    // exists, is a comment that has stopped being true.
    const cases = new Set(casesOf().map((r) => r.spellId));
    for (const [spellId, why] of Object.entries(ALLOWED)) {
      expect(cases.has(spellId), `${spellId} is exempted but has no scoring case`).toBe(true);
      expect(why.length, `${spellId} needs a reason`).toBeGreaterThan(20);
    }
  });

  it('has the shared currencies it claims to', () => {
    // The list above is only meaningful if the helpers exist; a typo would
    // silently turn this whole check off.
    const src = readFileSync(GREEDY, 'utf8');
    for (const c of ['rescueValue', 'wardValue', 'denialValue', 'upliftValue',
      'incomingPerRound', 'outputPerRound']) {
      expect(src, `${c} is referenced by this test but not defined`).toContain(`function ${c}(`);
    }
  });
});
