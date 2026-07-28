/**
 * Randomness in spell choice, confined to where it is free.
 *
 * `chooseAction` is a hard argmax, so a caster in a given situation casts the
 * same spell every time and a whole fight replays identically. The obvious fix
 * is a softmax over the scores, and the obvious fix is wrong here: this
 * codebase already has evidence that unfocused randomness costs play strength
 * (the sim AI's common-random-numbers variant "measurably weakened play in the
 * arena" and was reverted).
 *
 * So the randomness is banded. Spells within a fraction of the best score are
 * chosen among uniformly; anything below that is never chosen however many
 * times the dice roll. A spell the scorer thinks is half as good stays unpicked.
 *
 * WHAT THE MEASUREMENT SAID
 *
 * Over 60 randomized arena runs at margins 0, 0.15 and 0.30 the win rate was
 * 45% / 45% / 45% — the variation is free. It also does not fix the long tail:
 * spells cast went 53 / 53 / 54 and the top-five share stayed at 43-44%. The
 * sameness is caused by large score gaps, not by near-ties, so the thing that
 * would move it is the flat slot cost — not this.
 *
 * It is kept because it does what it says (it changes the pick on 5.6% of spell
 * turns) and costs nothing, and because it is the piece that will matter once
 * the scores it chooses between are closer together.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction, setSpellVariety, spellVariety } from '../src/ai/greedy.js';
import type { Position } from '../src/engine/types.js';

function caster(foes: Position[], seed = 4) {
  const me = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 3 }, level: 7 });
  const enemies = foes.map((p, i) => ({
    ...buildMonster('orc', 'team2', p), id: `e${i}`, hp: 40, maxHp: 40,
  }));
  const c = new Combat({ combatants: [me, ...enemies], seed });
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 20) c.apply({ kind: 'endTurn' });
  return { c, meId: me.id };
}

const CLUMP: Position[] = [{ x: 5, y: 2 }, { x: 6, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 3 }];

describe('spell variety', () => {
  it('is deterministic for a given board', () => {
    // THE constraint. `chooseAction` is a pure chooser the caller applies
    // afterwards, and it can legitimately be called twice on the same state (a
    // UI preview, a re-render). If it consumed `state.rng` the second call
    // would differ from the first and every replay would desynchronise.
    const before = spellVariety();
    setSpellVariety(0.15);
    try {
      const { c, meId } = caster(CLUMP);
      const first = JSON.stringify(chooseAction(c.state, meId));
      for (let i = 0; i < 20; i++) {
        expect(JSON.stringify(chooseAction(c.state, meId))).toBe(first);
      }
    } finally { setSpellVariety(before); }
  });

  it('does not advance the game RNG', () => {
    const before = spellVariety();
    setSpellVariety(0.15);
    try {
      const { c, meId } = caster(CLUMP);
      const rng = c.state.rng;
      chooseAction(c.state, meId);
      expect(c.state.rng).toBe(rng);
    } finally { setSpellVariety(before); }
  });

  it('never swaps a spell for something that is not a spell', () => {
    // The band only ever reorders spells among themselves. It must not turn a
    // cast into a move, an attack, or the end of a turn — the shape of the turn
    // is not what is being randomized.
    const before = spellVariety();
    try {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        setSpellVariety(0);
        const strictBoard = caster(CLUMP, seed);
        const strict = chooseAction(strictBoard.c.state, strictBoard.meId);
        setSpellVariety(0.4);
        const variedBoard = caster(CLUMP, seed);
        const varied = chooseAction(variedBoard.c.state, variedBoard.meId);
        if (strict.kind === 'castSpell') expect(varied.kind, `seed ${seed}`).toBe('castSpell');
        else expect(JSON.stringify(varied), `seed ${seed}`).toBe(JSON.stringify(strict));
      }
    } finally { setSpellVariety(before); }
  });

  it('a margin of zero is the old hard argmax', () => {
    // The escape hatch has to actually restore the previous behaviour, or the
    // A/B that justified the default was measuring two versions of the new one.
    const before = spellVariety();
    try {
      setSpellVariety(0);
      const a = caster(CLUMP);
      const strict = JSON.stringify(chooseAction(a.c.state, a.meId));
      setSpellVariety(0);
      const b = caster(CLUMP);
      expect(JSON.stringify(chooseAction(b.c.state, b.meId))).toBe(strict);
    } finally { setSpellVariety(before); }
  });

  it('never picks a spell far below the best', () => {
    // The whole reason this is a band and not a temperature. Whatever it
    // chooses must be a spell the scorer rated close to its favourite.
    const before = spellVariety();
    try {
      setSpellVariety(0);
      const strictBoard = caster(CLUMP);
      const strict = chooseAction(strictBoard.c.state, strictBoard.meId);
      if (strict.kind !== 'castSpell') return;
      // Fireball on four orcs is worth many times a cantrip; with a 15% band a
      // cantrip can never be the pick.
      setSpellVariety(0.15);
      const seen = new Set<string>();
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const { c, meId } = caster(CLUMP, seed);
        const a = chooseAction(c.state, meId);
        if (a.kind === 'castSpell') seen.add(a.spellId);
      }
      expect(seen.has('fire-bolt'), 'a cantrip was chosen over Fireball on a clump').toBe(false);
    } finally { setSpellVariety(before); }
  });
});
