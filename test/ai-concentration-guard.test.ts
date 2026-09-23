import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { scoreCastForTest } from '../src/ai/greedy.js';
import { legalActions } from '../src/engine/actions.js';
import type { Action } from '../src/engine/actions.js';

/**
 * Holding concentration blocks the NEXT concentration spell, and nothing else.
 *
 * The smites share one scoring case, and a flat `concentratingOn` guard added
 * for Shining Smite and Ensnaring Strike also caught Divine and Searing Smite,
 * which are not concentration: a paladin holding Bless never chose to smite.
 */
describe('the AI concentration guard', () => {
  it('stops concentration smites while concentrating, and no others', () => {
    const me = buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 0, y: 3 }, level: 5 });
    const foe = { ...buildMonster('orc', 'team2', { x: 1, y: 3 }), id: 'e0', hp: 60, maxHp: 60 };
    const c = new Combat({ combatants: [me, foe], seed: 4 });
    for (let g = 0; c.activeId !== me.id && g < 20; g++) c.apply({ kind: 'endTurn' });
    const actor = c.state.combatants[me.id]!;
    const smites = legalActions(c.state, me.id).filter(
      (a): a is Action & { kind: 'castSpell' } => a.kind === 'castSpell' && /smite|strike/.test(a.spellId),
    );
    expect(smites.some((a) => !SPELLS[a.spellId]!.concentration), 'no non-concentration smite offered').toBe(true);

    actor.concentratingOn = { spellId: 'bless', targetIds: [] };
    for (const a of smites) {
      const score = scoreCastForTest(c.state, actor, a);
      if (SPELLS[a.spellId]!.concentration) expect(score, a.spellId).toBe(0);
      else expect(score, `${a.spellId} is not concentration`).toBeGreaterThan(0);
    }
  });
});
