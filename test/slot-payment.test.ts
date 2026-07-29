/**
 * Any slot big enough can pay for a spell.
 *
 * THE BUG
 *
 * `legalActions` enumerated slot levels like this:
 *
 *     const levels = upcastable ? [base, ...every tier] : [base];
 *
 * The `[base]` branch is the one that bites. A spell that does not SCALE with
 * the slot can still be CAST from a bigger one — you simply gain nothing extra
 * — but this offered the spell's own tier and nothing else. A level-7 wizard
 * out of 2nd-level slots and holding three 3rd-level slots could not cast
 * Suggestion at all.
 *
 * 50 of the game's 70 leveled spells are not flagged `upcast`, so this is most
 * of the spell list, not an edge.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS
 *
 * It is also fatal for Pact Magic. A warlock's slots are all at ONE tier, above
 * the base level of most of its list — a level-7 warlock holds two 4th-level
 * slots and nothing else — so under the old rule it could cast only the fifth
 * of the spell list that happens to scale. The class could not be added
 * correctly until this was fixed, and the bug is invisible until a class with a
 * gapped slot table exists. Hence its own change, ahead of the class.
 *
 * WHAT IT MUST NOT DO
 *
 * Offer every higher tier as a separate choice. Those entries would do
 * literally nothing different from one another, and a tray full of
 * near-duplicates is what the `upcastable` check was guarding against. One
 * candidate: the lowest slot that can pay.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { legalActions } from '../src/engine/actions.js';
import { SPELLS } from '../src/data/spells.js';
import type { Combatant } from '../src/engine/types.js';

function board(spellIds: string[], classId = 'wizard', level = 7) {
  const me: Combatant = buildCharacter({ classId, team: 'team1', position: { x: 0, y: 3 }, level });
  me.spellIds = spellIds;
  const foe = { ...buildMonster('orc', 'team2', { x: 3, y: 3 }), id: 'e0', hp: 60, maxHp: 60 };
  const c = new Combat({ combatants: [me, foe], seed: 4 });
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
  return { c, meId: me.id };
}

/** The slot levels `spellId` is currently offered at. */
function offeredAt(c: Combat, meId: string, spellId: string): number[] {
  return [...new Set(legalActions(c.state, meId)
    .flatMap((a) => (a.kind === 'castSpell' && a.spellId === spellId ? [a.slotLevel] : [])))]
    .sort((x, y) => x - y);
}

describe('a bigger slot can pay for a smaller spell', () => {
  it('casts a non-scaling spell from a higher slot when its own tier is spent', () => {
    // THE defect, exactly as measured: 4/3/3/1 becomes 4/0/3/1 and Suggestion
    // goes from castable to uncastable while three 3rd-level slots sit unused.
    const { c, meId } = board(['suggestion', 'fire-bolt']);
    expect(SPELLS.suggestion!.upcast, 'this test needs a non-scaling spell').not.toBe(true);
    expect(offeredAt(c, meId, 'suggestion')).toEqual([2]);
    c.state.combatants[meId]!.spellSlots[1]!.current = 0;
    expect(offeredAt(c, meId, 'suggestion')).toEqual([3]);
  });

  it('offers exactly one slot level for a non-scaling spell, not a menu', () => {
    // The other half. Every higher tier would do literally the same thing, and
    // a tray full of identical entries is worse than the bug being fixed.
    const { c, meId } = board(['suggestion', 'fire-bolt']);
    c.state.combatants[meId]!.spellSlots[1]!.current = 0;
    expect(offeredAt(c, meId, 'suggestion')).toHaveLength(1);
  });

  it('still offers the whole ladder for a spell that scales', () => {
    // Upcasting is a real choice for these, so the menu is correct here.
    const { c, meId } = board(['burning-hands', 'fire-bolt']);
    expect(SPELLS['burning-hands']!.upcast).toBe(true);
    expect(offeredAt(c, meId, 'burning-hands').length).toBeGreaterThan(1);
  });

  it('does not offer a spell there is no slot left for at any tier', () => {
    const { c, meId } = board(['suggestion', 'fire-bolt']);
    const live = c.state.combatants[meId]!;
    live.spellSlots.forEach((s) => { s.current = 0; });
    expect(offeredAt(c, meId, 'suggestion')).toEqual([]);
  });

  it('leaves cantrips alone', () => {
    // Level 0 has no slot to find, and an `affordable` that searched upward
    // from 0 would have started charging for cantrips.
    const { c, meId } = board(['suggestion', 'fire-bolt']);
    const live = c.state.combatants[meId]!;
    live.spellSlots.forEach((s) => { s.current = 0; });
    expect(offeredAt(c, meId, 'fire-bolt')).toEqual([0]);
  });
});

describe('a pact caster can cast its whole list', () => {
  it('casts a 1st- and 2nd-level spell from a 4th-level-only slot table', () => {
    // Pact Magic in miniature, before the class exists: slots at one tier only,
    // above the base level of most of the list. Under the old rule this caster
    // could cast a fifth of what it knows.
    const { c, meId } = board(['magic-missile', 'suggestion', 'fire-bolt']);
    const live = c.state.combatants[meId]!;
    live.spellSlots.forEach((s, i) => { s.current = i === 3 ? 2 : 0; s.max = i === 3 ? 2 : 0; });
    expect(offeredAt(c, meId, 'suggestion')).toEqual([4]);
    // Magic Missile does not scale either, so it must come from the 4th too.
    expect(offeredAt(c, meId, 'magic-missile')).toEqual([4]);
  });
});
