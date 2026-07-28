/**
 * Two fixes the arena asked for by name.
 *
 * STEADY AIM (Rogue 3)
 *
 * The rogue was the worst class in the game by a distance — bottom-third
 * damage, the most downs of anyone, and a finish rate of 15% against 38-62%
 * for everybody else. The cause is structural rather than numeric: all of a
 * rogue's damage is Sneak Attack, Sneak Attack needs advantage or an ally in
 * reach, and the archer rogue is deliberately standing where it has neither.
 * Steady Aim is the SRD's own answer, and it was simply missing.
 *
 * The cost is what makes it a decision: it cannot be taken after moving, and
 * taking it ends the turn's movement. A version without those gates is a free
 * advantage every round, which is a much better feature than the printed one.
 *
 * CONFUSION
 *
 * What shipped applied `incapacitated`: the creature stood there. That is a
 * 4th-level Hold Person on a 2x2 and never once turned a monster on its
 * friends, which is the only reason anybody casts Confusion. The d10 now
 * happens at the start of the confused creature's turn, in the ENGINE — not in
 * the AI, because friendly fire has to happen to heroes too.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { CLASSES } from '../src/data/classes.js';
import { isLegalAction } from '../src/engine/actions.js';
import { SPELLS } from '../src/data/spells.js';
import type { Combatant, Position } from '../src/engine/types.js';

function rogueAt(level: number, position: Position = { x: 1, y: 3 }): Combatant {
  return buildCharacter({ classId: 'rogue', team: 'team1', position, level });
}

/** Advance turns until it is `id`'s go. */
function turnOf(c: Combat, id: string): void {
  let guard = 0;
  while (c.activeId !== id && guard++ < 40) c.apply({ kind: 'endTurn' });
}

describe('Steady Aim', () => {
  it('is a rogue feature from level 3', () => {
    const byLevel = CLASSES.rogue!.featuresByLevel;
    expect(byLevel[3]).toContain('steady-aim');
    // Below 3 it must not be there at all — a level-1 rogue with it is a
    // different class from the one the SRD prints.
    for (const lvl of [1, 2]) expect(byLevel[lvl] ?? []).not.toContain('steady-aim');
  });

  it('gives advantage on the next attack and then is spent', () => {
    const me = rogueAt(3);
    const foe = { ...buildMonster('orc', 'team2', { x: 5, y: 3 }), id: 'e0' };
    const c = new Combat({ combatants: [me, foe], seed: 7 });
    turnOf(c, me.id);
    c.apply({ kind: 'useFeature', featureId: 'steady-aim' });
    expect(c.state.combatants[me.id]!.conditions.some((k) => k.id === 'aiming')).toBe(true);

    const events = c.apply({ kind: 'attack', weaponId: 'shortbow', targetId: 'e0' });
    const roll = events.find((e) => e.type === 'attackRolled');
    expect(roll && roll.type === 'attackRolled' && roll.advSources).toContain('steady aim');
    // One-shot: the marker is consumed by the roll it helped, exactly like
    // Heroic Inspiration. Left on, it would be advantage for the whole fight.
    expect(c.state.combatants[me.id]!.conditions.some((k) => k.id === 'aiming')).toBe(false);
  });

  it('costs the turn its movement', () => {
    const me = rogueAt(3);
    const foe = { ...buildMonster('orc', 'team2', { x: 5, y: 3 }), id: 'e0' };
    const c = new Combat({ combatants: [me, foe], seed: 7 });
    turnOf(c, me.id);
    expect(c.state.combatants[me.id]!.turn.movementMax).toBeGreaterThan(0);
    c.apply({ kind: 'useFeature', featureId: 'steady-aim' });
    const t = c.state.combatants[me.id]!.turn;
    expect(t.movementMax).toBe(t.movementUsed);
  });

  it('cannot be taken after moving', () => {
    // The whole price of the feature. Without this gate the rogue moves into
    // position and then aims, which is strictly better than the printed rule.
    const me = rogueAt(3);
    const foe = { ...buildMonster('orc', 'team2', { x: 6, y: 3 }), id: 'e0' };
    const c = new Combat({ combatants: [me, foe], seed: 7 });
    turnOf(c, me.id);
    expect(isLegalAction(c.state, me.id, { kind: 'useFeature', featureId: 'steady-aim' })).toBe(true);
    c.apply({ kind: 'move', to: { x: 2, y: 3 } });
    expect(isLegalAction(c.state, me.id, { kind: 'useFeature', featureId: 'steady-aim' })).toBe(false);
  });

  it('cannot be stacked on itself', () => {
    const me = rogueAt(3);
    const foe = { ...buildMonster('orc', 'team2', { x: 5, y: 3 }), id: 'e0' };
    const c = new Combat({ combatants: [me, foe], seed: 7 });
    turnOf(c, me.id);
    c.apply({ kind: 'useFeature', featureId: 'steady-aim' });
    expect(isLegalAction(c.state, me.id, { kind: 'useFeature', featureId: 'steady-aim' })).toBe(false);
  });
});

describe('Confusion', () => {
  it('applies confused, not incapacitated', () => {
    // The defect, stated as a test: `incapacitated` is a creature standing
    // still, and standing still is not what this spell is for.
    const me = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 7 });
    const foes = [{ x: 5, y: 3 }, { x: 6, y: 3 }].map((p, i) => (
      { ...buildMonster('orc', 'team2', p), id: `e${i}`, hp: 40, maxHp: 40 }
    ));
    const c = new Combat({ combatants: [me, ...foes], seed: 3 });
    turnOf(c, me.id);
    c.apply({
      kind: 'castSpell', spellId: 'confusion', slotLevel: 4,
      targets: [{ position: { x: 5, y: 3 } }],
    });
    const caught = foes
      .map((f) => c.state.combatants[f.id]!)
      .filter((f) => f.conditions.some((k) => k.id === 'confused'));
    expect(caught.length).toBeGreaterThan(0);
    for (const f of caught) {
      expect(f.conditions.some((k) => k.id === 'incapacitated')).toBe(false);
    }
  });

  it('makes a confused creature strike its own side', () => {
    // The point of the spell. Two orcs standing together; one is confused, and
    // over enough turns the d10 must eventually land on 7-8 and send it at the
    // only thing in reach — which is its friend.
    let sawFriendlyFire = false;
    for (let seed = 1; seed <= 40 && !sawFriendlyFire; seed++) {
      const a = { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'a' };
      const b = { ...buildMonster('orc', 'team2', { x: 5, y: 3 }), id: 'b' };
      const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 7 }, level: 5 });
      const c = new Combat({ combatants: [hero, a, b], seed });
      c.state.combatants.a!.conditions.push({ id: 'confused', sourceId: hero.id });
      for (let i = 0; i < 12 && !sawFriendlyFire; i++) {
        if (c.activeId === 'a') {
          const events = c.apply({ kind: 'endTurn' });
          // startTurn fires before the turn is handed over, so the strike shows
          // up in whatever call advances into it.
          void events;
        }
        const evs = c.apply({ kind: 'endTurn' });
        for (const e of evs) {
          if (e.type === 'confusedTurn' && e.effect === 'lashesOut' && e.targetId === 'b') sawFriendlyFire = true;
        }
      }
    }
    expect(sawFriendlyFire, 'a confused orc never once hit the orc beside it').toBe(true);
  });

  it('sometimes wastes the turn outright and sometimes does not', () => {
    // Both tails of the d10 have to be reachable, or the table is decoration.
    const effects = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const a = { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'a' };
      const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 7 }, level: 5 });
      const c = new Combat({ combatants: [hero, a], seed });
      c.state.combatants.a!.conditions.push({ id: 'confused', sourceId: hero.id });
      for (let i = 0; i < 8; i++) {
        for (const e of c.apply({ kind: 'endTurn' })) {
          if (e.type === 'confusedTurn') effects.add(e.effect);
        }
      }
    }
    expect(effects.has('nothing')).toBe(true);
    expect(effects.has('normal')).toBe(true);
  });

  it('is still a concentration spell that a save can end', () => {
    // Repricing and re-implementing must not quietly make it stronger than it
    // was: it costs concentration and the victim gets its save every turn.
    const spell = SPELLS.confusion!;
    expect(spell.concentration).toBe(true);
    const me = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 7 });
    const foe = { ...buildMonster('orc', 'team2', { x: 5, y: 3 }), id: 'e0', hp: 40, maxHp: 40 };
    const c = new Combat({ combatants: [me, foe], seed: 3 });
    turnOf(c, me.id);
    c.apply({
      kind: 'castSpell', spellId: 'confusion', slotLevel: 4,
      targets: [{ position: { x: 5, y: 3 } }],
    });
    const cond = c.state.combatants.e0!.conditions.find((k) => k.id === 'confused');
    if (cond) {
      expect(cond.concentration).toBe(true);
      expect(cond.repeatSave?.ability).toBe('wis');
    }
  });
});

// --- the AI has to actually reach for it -------------------------------------
//
// A feature nothing scores is a feature that never fires, which is the same
// dead data the spell-scoring guard exists for. Steady Aim in particular has to
// be *chosen*, because the rogue's problem was never that it lacked options.

describe('the AI uses Steady Aim', () => {
  function board(level: number, foeAt: Position, allyAt?: Position) {
    const me = rogueAt(level, { x: 1, y: 3 });
    const foe = { ...buildMonster('orc', 'team2', foeAt), id: 'e0', hp: 40, maxHp: 40 };
    const ally = allyAt
      ? { ...buildCharacter({ classId: 'fighter', team: 'team1', position: allyAt, level: 5 }), id: 'a0' }
      : undefined;
    const c = new Combat({ combatants: [me, foe, ...(ally ? [ally] : [])], seed: 5 });
    turnOf(c, me.id);
    return { c, meId: me.id };
  }

  it('aims before shooting when nothing else grants advantage', async () => {
    const { chooseAction } = await import('../src/ai/greedy.js');
    const { c, meId } = board(3, { x: 6, y: 3 });
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'useFeature' && a.featureId === 'steady-aim').toBe(true);
  });

  it('does not bother once it has already aimed', async () => {
    const { chooseAction } = await import('../src/ai/greedy.js');
    const { c, meId } = board(3, { x: 6, y: 3 });
    c.apply({ kind: 'useFeature', featureId: 'steady-aim' });
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'useFeature' && a.featureId === 'steady-aim').toBe(false);
  });
});

describe('Confusion does not fight the other turn-start effects', () => {
  it('does not crash a fleeing creature', () => {
    // The bug this exists for: the confusion block zeroes `turn.movementMax`,
    // while the fleeing code plans a route against the local `speed` and then
    // has `executeMove` validate it against `turn.movementMax`. Ordered wrong,
    // that throws "Illegal move" and takes the whole run with it — which is
    // exactly what it did, on a fleeing skeleton caught by Confusion. No test
    // in the suite caught it; a 60-run simulation did, on the third fight.
    for (let seed = 1; seed <= 25; seed++) {
      const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
      const foe = { ...buildMonster('skeleton', 'team2', { x: 4, y: 4 }), id: 'f' };
      const c = new Combat({ combatants: [hero, foe], seed });
      c.state.combatants.f!.conditions.push({ id: 'confused', sourceId: hero.id });
      c.state.combatants.f!.conditions.push({ id: 'fleeing', sourceId: hero.id });
      expect(() => {
        for (let i = 0; i < 10 && !c.state.winner; i++) c.apply({ kind: 'endTurn' });
      }).not.toThrow();
    }
  });

  it('does not crash a lured creature', () => {
    // Luring Song walks the victim toward the singer off the same `speed`, so
    // it has the identical shape. Both are covered by running the confusion
    // roll after every planner rather than by a guard per planner.
    for (let seed = 1; seed <= 25; seed++) {
      const hero = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
      const foe = { ...buildMonster('skeleton', 'team2', { x: 4, y: 4 }), id: 'f' };
      const c = new Combat({ combatants: [hero, foe], seed });
      c.state.combatants.f!.conditions.push({ id: 'confused', sourceId: hero.id });
      c.state.combatants.f!.conditions.push({ id: 'lured', sourceId: hero.id });
      expect(() => {
        for (let i = 0; i < 10 && !c.state.winner; i++) c.apply({ kind: 'endTurn' });
      }).not.toThrow();
    }
  });
});
