/**
 * A turn with nothing in it has to say why.
 *
 * WHAT WAS WRONG
 *
 * A paralyzed hero's turn arrived as an EMPTY action bar. Every category
 * filtered to zero entries, the board offered no blue move tiles and no red
 * target rings, and the only control left was "End turn". Nothing anywhere said
 * paralyzed. The player sits looking at their own turn wondering what to tap —
 * reported as "need some way of making it clear to player (who now move)".
 *
 * WHAT IS TESTED HERE
 *
 * The interesting half is the LIST. `blockedReason` supplies the words, but
 * which conditions get words is a hand-kept list next to a rule the engine
 * owns. So rather than restating the list, this drives `legalActions` once per
 * condition and asserts the two agree: anything that empties a turn on its own
 * must have an explanation waiting. That is what caught `confused` — it silences
 * a turn completely and would have shown the generic shrug.
 *
 * The rest pins the shape of the panel that carries those words, since the
 * component itself has no render harness here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Combat } from '../src/engine/combat.js';
import { legalActions } from '../src/engine/actions.js';
import { makeCombatant } from './helpers.js';
import { CONDITION_META, blockedReason } from '../web/src/conditions.js';
import type { ConditionId } from '../src/engine/types.js';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const APP = read('web/src/App.tsx');
const CSS = read('web/src/styles.css');

const ids = Object.keys(CONDITION_META) as ConditionId[];

/** How many things other than "end turn" the engine offers a level-5 hero. */
function offeredUnder(conds: ConditionId[]): number {
  const c = new Combat({
    seed: 3,
    combatants: [
      makeCombatant({
        id: 'a', team: 'team1', position: { x: 2, y: 2 }, level: 5,
        conditions: conds.map((id) => ({ id })),
      }),
      makeCombatant({ id: 'b', team: 'team2', position: { x: 4, y: 2 } }),
    ],
  });
  const s = { ...c.state, initiativeOrder: ['a', 'b'], turnIndex: 0 };
  return legalActions(s, 'a').filter((x) => x.kind !== 'endTurn').length;
}

describe('every dead turn has words for it', () => {
  const dead = ids.filter((id) => offeredUnder([id]) === 0);

  it('finds conditions that really do empty a turn', () => {
    // Guards the two tests below from passing on an empty set — if the harness
    // ever stops building a hero with anything to do, they'd both go vacuous.
    expect(dead.length, 'no condition emptied a turn; the harness is broken')
      .toBeGreaterThan(5);
    expect(offeredUnder([]), 'an unafflicted hero has nothing to do either')
      .toBeGreaterThan(20);
  });

  it.each(ids)('explains %s when it leaves the hero nothing to do', (id) => {
    if (offeredUnder([id]) > 0) return;   // acts fine; no explanation owed
    const why = blockedReason([id]);
    expect(why, `${id} empties the turn but has no explanation — the player gets a shrug`)
      .toBeDefined();
    expect(why!.label, `${id}'s label is a bare word; the panel prints the half after the dash`)
      .toContain(' — ');
  });

  it('names the condition that matters most when several apply', () => {
    // Paralyzed AND restrained is a real pair — Hold Person inside a web. The
    // paralysis is what the player needs told; the order the list is written in
    // is the only thing deciding that.
    expect(blockedReason(['restrained', 'paralyzed'])).toBe(CONDITION_META['paralyzed']);
    expect(blockedReason(['fleeing', 'unconscious'])).toBe(CONDITION_META['unconscious']);
    // Dropping to 0 HP while paralyzed: bleeding out outranks being held.
    expect(blockedReason(['paralyzed', 'unconscious'])).toBe(CONDITION_META['unconscious']);
  });

  it('stays quiet for a hero who simply has no good options', () => {
    // An empty bar is not always a condition. Blessed does nothing to a turn,
    // so it must never be offered as the reason one went missing.
    expect(blockedReason(['blessed', 'poisoned', 'prone'])).toBeUndefined();
  });
});

describe('the panel that carries the words', () => {
  it('decides from what the engine offered, not from the condition list', () => {
    // The trigger has to be "the bar came out empty", because `legalActions`
    // owns the rule. A second reading of the conditions here would be free to
    // disagree with it — and a hero silenced by something with no badge at all
    // would show a full, unusable bar.
    const trigger = /const nothingToDo = ([\s\S]{0,200}?);/.exec(APP)?.[1] ?? '';
    expect(trigger, 'nothingToDo is no longer derived from the grouped actions').toContain('grouped.');
    expect(trigger, 'nothingToDo now reads conditions directly, second-guessing the engine')
      .not.toContain('conditions');
  });

  it('drops the Hint button, whose only advice would be "end your turn"', () => {
    expect(APP).toMatch(/\{!nothingToDo && \(\s*<button\s+className="hint-btn"/);
  });

  it('has styling for the panel and for End turn standing alone', () => {
    for (const sel of ['.turn-blocked', '.turn-blocked .tb-icon', '.turn-blocked .tb-text', '.endturn.only']) {
      expect(CSS, `${sel} is used in App.tsx but has no rule`).toContain(`\n${sel} {`);
    }
    expect(APP).toContain('className="turn-blocked"');
    expect(APP).toContain("`endturn${nothingToDo ? ' only' : ''}`");
  });
});
