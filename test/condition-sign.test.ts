/**
 * A badge must not tell the player the opposite of what the engine does.
 *
 * WHAT WAS WRONG
 *
 * `vexed` was labelled "the next attack against it has advantage" and filed as
 * a debuff. The engine does the reverse: `rules/attack.ts` puts `vexed` on the
 * ATTACKER, with `sourceId` naming the creature they just hit, and grants them
 * advantage on the follow-up. So a fighter who had landed a vex hit wore a red
 * badge announcing they were easier to kill — and because control and debuff
 * badges sort ahead of buffs, it took the one chip the token has from whatever
 * was actually happening to them.
 *
 * It survived because nothing connected the two files. The label is prose and
 * the rule is code, and prose does not fail to compile.
 *
 * WHY THE AI IS THE THING TO CHECK AGAINST
 *
 * `CONDITION_WEIGHT` in ai/evaluate.ts is a second, independent opinion about
 * who each condition is good for — written for the AI's own use, by somebody
 * reading the rules rather than the badges, and load-bearing enough that
 * getting a sign wrong there makes the AI visibly play for the wrong team. It
 * is the only cross-check available that is not just the UI agreeing with
 * itself.
 *
 * The check is sign-only. The magnitudes are the AI's business and no badge
 * claims to know them.
 */
import { describe, it, expect } from 'vitest';
import { CONDITION_WEIGHT } from '../src/ai/evaluate.js';
import { CONDITION_META } from '../web/src/conditions.js';
import type { ConditionId } from '../src/engine/types.js';

/**
 * Badges the AI's sign deliberately disagrees with, and why.
 *
 * `reckless` is the barbarian's own choice and the AI prices the whole package;
 * the badge is a debuff on purpose, because what the BOARD needs to show is
 * that this creature is easier to hit, and that is true whichever side of it
 * you are on. Anything added here needs a reason of that kind — not "the test
 * went red".
 */
const DELIBERATE: Partial<Record<ConditionId, string>> = {};

const entries = Object.entries(CONDITION_WEIGHT) as Array<[ConditionId, number]>;

describe('the badge agrees with the engine about who a condition helps', () => {
  it('has a table to check, and it covers a decent share of the conditions', () => {
    // Guards the case below from quietly passing on an empty or gutted table.
    expect(entries.length, 'CONDITION_WEIGHT is empty or no longer exported').toBeGreaterThan(20);
    expect(entries.some(([, w]) => w > 0), 'no buffs priced at all').toBe(true);
    expect(entries.some(([, w]) => w < 0), 'no debuffs priced at all').toBe(true);
  });

  it.each(entries)('%s', (id, weight) => {
    if (DELIBERATE[id]) return;
    const meta = CONDITION_META[id];
    expect(meta, `${id} is priced by the AI but has no badge metadata`).toBeDefined();
    const uiSaysGood = meta.kind === 'buff';
    expect(
      uiSaysGood,
      `${id}: the AI prices it at ${weight} (${weight > 0 ? 'good' : 'bad'} for whoever holds it) ` +
      `but the badge calls it a ${meta.kind} — "${meta.label}"`,
    ).toBe(weight > 0);
  });

  it('describes vex as something the holder gains', () => {
    // The specific regression, pinned in words rather than in a `kind`, because
    // a correct classification with a backwards sentence is the same bug.
    const label = CONDITION_META['vexed'].label.toLowerCase();
    expect(label, 'the vex badge is back to describing an attack made against its wearer')
      .not.toContain('against it');
    expect(label, 'the vex badge no longer says whose attack benefits').toContain('its next attack');
  });
});
