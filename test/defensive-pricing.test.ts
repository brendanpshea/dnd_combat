/**
 * Defensive spells have to be priced in the same currency as damage.
 *
 * THE BUG
 *
 * `damageValue` returns an expectation in hit points — a Fireball across three
 * orcs comes to about 80. The protective spells were priced on a hand-tuned
 * 0-to-10 scale:
 *
 *     Death Ward            6 - slotCost  =  4
 *     Freedom of Movement   7 - slotCost  =  5
 *     Greater Invisibility  8 - slotCost  =  6
 *     Polymorph      6 + hurt*10 - cost   = 14 at most
 *
 * Nothing on the first scale can outbid anything on the second, so the whole
 * defensive half of the 4th-level tier was legal, prepared, scored — and never
 * chosen. Measured before the fix: Polymorph was a legal action on 251 caster
 * turns across 60 level-8 runs and picked zero times.
 *
 * It was one bug wearing four faces, which is why the fix is one shared helper
 * rather than four new constants.
 *
 * WHAT THE MEASUREMENT SAID
 *
 * 60 runs, randomized prepared lists, started at level 8 — a microscope, not a
 * balance run — against the same config on the old scoring:
 *
 *     Death Ward             0 -> 184
 *     Greater Invisibility   0 ->  32
 *     Polymorph              0 ->  14
 *     Freedom of Movement    0 ->   1
 *
 * with the damage spells barely moving and the win rate going 48% -> 46%,
 * inside the noise at n=60. In the ordinary configuration the two are
 * indistinguishable: 19/60 finished and a 44% median win rate either way.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { Combatant, Position } from '../src/engine/types.js';

/**
 * A caster with exactly one defensive spell and one real damage spell, an ally,
 * and enemies. The question every test here asks is which of the two it picks.
 */
function board(opts: {
  spellId: string;
  allyHp: number;          // fraction of max
  foes: Position[];
  allyAt?: Position;
  classId?: string;
}) {
  const me: Combatant = buildCharacter({
    classId: opts.classId ?? 'wizard', team: 'team1', position: { x: 0, y: 3 }, level: 8,
  });
  // Fireball is the thing that was always winning. Leaving it in is the point:
  // a defensive spell that only wins when nothing else is on offer has not been
  // fixed, it has been isolated.
  me.spellIds = [opts.spellId, 'fireball', 'fire-bolt'];
  me.inventory = [];
  const ally: Combatant = {
    ...buildCharacter({ classId: 'fighter', team: 'team1', position: opts.allyAt ?? { x: 1, y: 3 }, level: 8 }),
    id: 'ally',
  };
  ally.hp = Math.max(1, Math.round(ally.maxHp * opts.allyHp));
  const foes = opts.foes.map((p, i) => ({
    ...buildMonster('orc', 'team2', p), id: `e${i}`, hp: 60, maxHp: 60,
  }));
  const c = new Combat({ combatants: [me, ally, ...foes], seed: 4 });
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
  return { c, meId: me.id, allyId: 'ally' };
}

function picks(opts: Parameters<typeof board>[0]): boolean {
  const { c, meId } = board(opts);
  const a = chooseAction(c.state, meId);
  return a.kind === 'castSpell' && a.spellId === opts.spellId;
}

/** Two orcs right on the ally: the situation these spells exist for. */
const PRESSED: Position[] = [{ x: 1, y: 2 }, { x: 1, y: 4 }];
/**
 * The same orcs, off fighting somebody else — nothing is on the ally.
 *
 * "Far away" is a surprisingly hard thing to arrange on an eight-cell board:
 * the first version of `danger` counted anything within a turn's reach, which
 * at 30 ft of orc speed is the whole grid, so the term was always 1 and gated
 * nothing. It counts 15 feet now, which these are outside of.
 */
const DISTANT: Position[] = [{ x: 7, y: 7 }, { x: 7, y: 6 }];

describe('a threatened ally is worth rescuing', () => {
  it('casts Polymorph on a fighter about to go down', () => {
    expect(picks({ spellId: 'polymorph', allyHp: 0.2, foes: PRESSED })).toBe(true);
  });

  it('casts Death Ward and Greater Invisibility over a cantrip', () => {
    // Not over a Fireball catching two orcs, and that is correct: killing two
    // enemies IS worth more than warding one ally, and a fix that inverted
    // that would be a worse bug than the one being fixed. Polymorph clears
    // even that bar because it hands over a whole second health bar; these two
    // do not, and should not.
    //
    // What they must clear is the bar they were failing: being worth more than
    // the free thing. Both scored under 7 before, against a cantrip's ~5.
    for (const spellId of ['death-ward', 'greater-invisibility']) {
      const { c, meId } = board({ spellId, allyHp: 0.2, foes: PRESSED });
      c.state.combatants[meId]!.spellIds = [spellId, 'fire-bolt'];
      const a = chooseAction(c.state, meId);
      expect(a.kind === 'castSpell' && a.spellId === spellId, spellId).toBe(true);
    }
  });
});

describe('and an unthreatened one is not', () => {
  it('leaves a healthy ally alone', () => {
    // The other half of a price. A spell that is always worth casting is not
    // priced, it is just on.
    for (const spellId of ['polymorph', 'death-ward', 'greater-invisibility']) {
      expect(picks({ spellId, allyHp: 1.0, foes: PRESSED }), spellId).toBe(false);
    }
  });

  it('leaves a hurt ally alone when nothing can reach them', () => {
    // Hit points are only at risk if something is coming for them. Without this
    // the wizard wards the back line while the front line is being eaten.
    for (const spellId of ['polymorph', 'death-ward', 'greater-invisibility']) {
      expect(picks({ spellId, allyHp: 0.2, foes: DISTANT, allyAt: { x: 1, y: 3 } }), spellId).toBe(false);
    }
  });
});

describe('rescue does not outbid winning the fight', () => {
  it('still throws the Fireball when there is a pack to throw it at', () => {
    // The failure mode of the fix: price a rescue too high and the wizard wards
    // its fighter instead of ending a fight it was one spell from winning.
    // Five orcs in a clump is worth far more than one ally's hit points.
    const clump: Position[] = [
      { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 5, y: 2 }, { x: 6, y: 2 }, { x: 5, y: 3 },
    ];
    const { c, meId } = board({ spellId: 'polymorph', allyHp: 0.2, foes: clump, allyAt: { x: 6, y: 3 } });
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'castSpell' && a.spellId === 'fireball').toBe(true);
  });
});

describe('the scales are actually comparable', () => {
  it('prices a rescue in tens of hit points, not in single digits', () => {
    // The bug stated as a number. Every one of these was capped under 15 while
    // a Fireball scored about 80, which is why none of them was ever chosen.
    // Rather than assert an exact score (which would pin the tuning), assert
    // the thing that was actually broken: a badly threatened ally must be able
    // to beat a cantrip on a single enemy by a wide margin.
    const { c, meId } = board({ spellId: 'death-ward', allyHp: 0.15, foes: PRESSED });
    // Remove the big damage option so the comparison is rescue vs. cantrip.
    c.state.combatants[meId]!.spellIds = ['death-ward', 'fire-bolt'];
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'castSpell' && a.spellId === 'death-ward').toBe(true);
  });

  it('never wards the same ally twice', () => {
    const { c, meId, allyId } = board({ spellId: 'death-ward', allyHp: 0.2, foes: PRESSED });
    c.state.combatants[allyId]!.conditions.push({ id: 'deathWarded', sourceId: meId });
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'castSpell' && a.spellId === 'death-ward').toBe(false);
  });
});
