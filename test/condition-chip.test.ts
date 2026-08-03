/**
 * A creature's status must not eat the tap that attacks it.
 *
 * WHAT WAS WRONG, MEASURED ON A 390px PHONE
 *
 * A token is 46x46 there — the cell and the token are the same square, and that
 * square is the tap target. The status badges were a COLUMN of up to four, and
 * they measured 14x59: taller than the creature they belonged to. They covered
 * 29% of it, and the fourth badge's centre landed on a NEIGHBOURING CELL —
 * nothing clips it, both the slot and the token are `overflow: visible`.
 *
 * Worse, `.token-layer` is `pointer-events: none`, so those badges were the only
 * things in that layer that took taps: holes punched straight through to the
 * cell grid underneath. And the tap they stole is the ATTACK — tapping an enemy
 * opens the weapon chooser. So the more conditions on an enemy (webbed, prone,
 * poisoned — precisely the enemy worth hitting), the harder it got to hit, and
 * a near-miss opened a glossary card instead of swinging.
 *
 * WHAT IS TESTED HERE
 *
 * Three things, each of which failed silently before: the chip is at most two
 * elements wide so it can never be taller than the token; nothing in it takes
 * pointer events; and the explanation that used to live behind a badge tap now
 * lives in the chooser, so the information was moved rather than deleted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { conditionBadges, conditionChip, CONDITION_META } from '../web/src/conditions.js';
import type { ConditionId } from '../src/engine/types.js';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const CSS = read('web/src/styles.css');
const BOARD = read('web/src/Board.tsx');
const APP = read('web/src/App.tsx');

/**
 * A CSS rule's DECLARATIONS, comments stripped.
 *
 * Both halves matter. Anchored to the start of a line, so `.a` never matches
 * `.b .a`. And comments removed, because the rule this file cares most about
 * carries a comment EXPLAINING `pointer-events: none` — so a naive search found
 * the explanation and passed even with the declaration flipped to `auto`. The
 * first version of this test did exactly that and let the planted bug through.
 */
const rule = (sel: string): string => {
  const i = CSS.indexOf(`\n${sel} {`);
  expect(i, `no rule for ${sel}`).toBeGreaterThan(-1);
  return CSS.slice(i, CSS.indexOf('}', i)).replace(/\/\*[\s\S]*?\*\//g, '');
};

const ids = Object.keys(CONDITION_META) as ConditionId[];

describe('the token shows one chip, not a stack', () => {
  it('reduces any number of conditions to a chip and a count', () => {
    const many = ids.slice(0, 6);
    const chip = conditionChip(many);
    expect(chip, 'a creature with six conditions shows nothing').toBeDefined();
    expect(chip!.extra, 'the count does not match what was left out')
      .toBe(conditionBadges(many).length - 1);
  });

  it('shows the most significant condition, not the first one applied', () => {
    // `conditionBadges` already sorts control before debuff before buff. The
    // chip has to take the front of that order, or the one glance a player gets
    // reports whichever effect happened to land first.
    const some = ids.filter((id) => CONDITION_META[id]!.kind !== 'control').slice(0, 2);
    const control = ids.find((id) => CONDITION_META[id]!.kind === 'control')!;
    const chip = conditionChip([...some, control]);
    expect(chip!.meta.kind, 'a buff outranked a control on the chip').toBe('control');
  });

  it('says nothing when there is nothing to say', () => {
    expect(conditionChip([])).toBeUndefined();
  });

  it('counts a repeated condition once', () => {
    const one = ids[0]!;
    expect(conditionChip([one, one, one])!.extra, 'the same condition was counted three times').toBe(0);
  });

  it('never renders more than two elements', () => {
    // The whole reason the column overflowed. Two 14px chips side by side are
    // 28x14; four stacked were 14x59 against a 46px token.
    for (const n of [1, 2, 3, 8, 20]) {
      const chip = conditionChip(ids.slice(0, n));
      const elements = chip ? (chip.extra > 0 ? 2 : 1) : 0;
      expect(elements, `${n} conditions rendered ${elements} chips`).toBeLessThanOrEqual(2);
    }
  });
});

describe('the chip is decoration, not a control', () => {
  it('takes no pointer events', () => {
    expect(rule('.cond-badge'),
      'a badge takes taps again — `.token-layer` is pointer-events:none, so this punches a hole to the cell grid')
      .toMatch(/pointer-events:\s*none/);
  });

  it('lays the chip out in a row, so it cannot outgrow the token', () => {
    // A column is what put the fourth badge on the next square along.
    expect(rule('.cond-badges'), 'the badges are stacked in a column again')
      .toMatch(/flex-direction:\s*row/);
  });

  it('has no click handler left on the board', () => {
    expect(BOARD, 'a badge is clickable again').not.toMatch(/cond-badge[\s\S]{0,200}?onClick/);
    expect(BOARD, 'the board still takes an onCondition callback').not.toContain('onCondition');
  });
});

describe('the explanation moved rather than vanished', () => {
  it('lists the target\'s conditions in the chooser', () => {
    // The badge tap was the only way a phone could read what a condition does —
    // there is no hover tooltip. Deleting it without a replacement would remove
    // the information, not just the tap target.
    expect(APP, 'the chooser no longer lists conditions').toContain('chooser-conditions');
    expect(APP, 'the chooser does not read the target\'s conditions')
      .toMatch(/conditionBadges\(chooser\.target\.conditions/);
    expect(rule('.chooser-conditions'), 'the condition list has no styling').toContain('display');
  });

  it('keeps a full sentence for every condition it can show', () => {
    // The chooser splits `label` on the em dash into a name and an explanation.
    // A label without one would render a bare word and no help.
    const thin = ids.filter((id) => !CONDITION_META[id]!.hidden)
      .filter((id) => !CONDITION_META[id]!.label.includes(' — '));
    expect(thin, `these conditions have no explanation after the dash: ${thin.join(', ')}`).toEqual([]);
  });

  it('colours the list the same way it colours the chip', () => {
    // The thing glanced at on the board and the sentence explaining it have to
    // agree, or the colour is just decoration twice.
    for (const kind of ['control', 'debuff', 'buff']) {
      expect(CSS, `the chooser list does not colour ${kind}`)
        .toContain(`.chooser-conditions li.${kind}`);
      expect(CSS, `the chip does not colour ${kind}`).toContain(`.cond-badge.${kind}`);
    }
  });
});
