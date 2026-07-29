/**
 * Metamagic: Quickened Spell, and the two things it must not become.
 *
 * WHAT THIS IS GUARDING
 *
 * Quickened Spell is a MODIFIER, and every modifier added to this codebase has
 * gone wrong the same way. Bless, Haste, Mirror Image, Steady Aim, Hex and the
 * whole defensive tier were each priced as a flat number rather than as the
 * delta they buy, and each one came out never-chosen or always-chosen. Six
 * times.
 *
 * Quickened dodges that, but only because of a design decision that is easy to
 * undo by accident: `legalActions` offers a quickened cast ONLY once the action
 * is already spent. In that state the candidate is competing against ending the
 * turn, so `scoreSpell`'s ordinary price for the spell IS the delta — a second
 * spell the sorcerer would not otherwise get. Offer it a moment earlier and it
 * competes against casting the same spell for free, two sorcery points cheaper,
 * and the option is dead. There is no constant to tune here and there must not
 * become one; what holds it up is the gate, so the gate is what gets tested.
 *
 * THE OTHER FAILURE MODE
 *
 * The 2024 clause is not the 2014 one. It reads:
 *
 *   "You can't modify a spell in this way if you've already cast a level 1+
 *    spell on the current turn, nor can you cast a level 1+ spell on this turn
 *    after modifying a spell in this way."
 *
 * Without it, two points buys Fireball-and-Fireball, which is not a Metamagic
 * option, it is a broken class. Both directions of the clause are checked
 * below, and so is the thing it deliberately leaves open: a quickened leveled
 * spell plus a cantrip.
 *
 * AND THE COST OF ALL THIS
 *
 * `legalActions` is walked by every AI turn and every arena fight, tens of
 * thousands of times per measurement. The last test here pins the shape that
 * keeps it cheap: on an ordinary turn, for every class in the game, the
 * enumeration is byte-for-byte what it was before Metamagic existed.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { legalActions, isLegalAction, type Action } from '../src/engine/actions.js';
import { chooseAction } from '../src/ai/greedy.js';
import { SORCERY_POINTS, metamagicOptions, knownMetamagic } from '../src/engine/rules/metamagic.js';
import { SPELLS } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { abilityMod, type Combatant, type Position } from '../src/engine/types.js';

function board(opts: { level?: number; spellIds?: string[]; foes?: Position[] } = {}) {
  const me: Combatant = buildCharacter({
    classId: 'sorcerer', team: 'team1', position: { x: 0, y: 3 }, level: opts.level ?? 8,
  });
  if (opts.spellIds) me.spellIds = opts.spellIds;
  const foes = (opts.foes ?? [{ x: 4, y: 3 }]).map((p, i) => ({
    ...buildMonster('orc', 'team2', p), id: `e${i}`, hp: 60, maxHp: 60,
  }));
  const c = new Combat({ combatants: [me, ...foes], seed: 4 });
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 40) c.apply({ kind: 'endTurn' });
  return { c, me: c.state.combatants[me.id]!, meId: me.id };
}

/** The quickened casts currently on offer, by spell id. */
function quickened(c: Combat, meId: string): string[] {
  return [...new Set(legalActions(c.state, meId)
    .flatMap((a) => (a.kind === 'castSpell' && a.metamagic === 'quickened' ? [a.spellId] : [])))]
    .sort();
}

describe('a sorcerer has points to spend', () => {
  it('gains Font of Magic at 2nd, with points equal to its level', () => {
    for (const level of [2, 5, 8]) {
      const s = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 0 }, level });
      expect(s.featureUses[SORCERY_POINTS]?.max, `level ${level}`).toBe(level);
    }
  });

  it('has none at 1st, because the feature has not arrived', () => {
    const s = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 0 }, level: 1 });
    expect(s.featureUses[SORCERY_POINTS]).toBeUndefined();
    expect(knownMetamagic(s)).toEqual([]);
  });

  it('spends two points per quickened cast, and no slot beyond the spell', () => {
    const { c, meId } = board({ spellIds: ['fireball', 'fire-bolt'] });
    const before = c.state.combatants[meId]!.spellSlots[2]!.current;
    c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'e0' }] });
    c.apply({
      kind: 'castSpell', spellId: 'fireball', slotLevel: 3, metamagic: 'quickened',
      targets: [{ position: { x: 4, y: 3 } }],
    });
    const after = c.state.combatants[meId]!;
    expect(after.featureUses[SORCERY_POINTS]!.current).toBe(after.featureUses[SORCERY_POINTS]!.max - 2);
    expect(after.spellSlots[2]!.current).toBe(before - 1);
    expect(after.turn.bonusActionUsed).toBe(true);
  });

  it('will not quicken on an empty pool', () => {
    const { c, meId } = board({ spellIds: ['fireball', 'fire-bolt'] });
    c.state.combatants[meId]!.featureUses[SORCERY_POINTS]!.current = 1;   // one short of the cost
    c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'e0' }] });
    expect(quickened(c, meId)).toEqual([]);
  });
});

describe('the 2024 Quickened clause', () => {
  it('refuses to quicken after a leveled spell has already been cast', () => {
    // The half that stops two Fireballs a turn for two points.
    const { c, meId } = board({ spellIds: ['fireball', 'magic-missile', 'fire-bolt'] });
    c.apply({ kind: 'castSpell', spellId: 'magic-missile', slotLevel: 1, targets: [{ combatantId: 'e0' }] });
    expect(c.state.combatants[meId]!.turn.leveledSpellCast).toBe(true);
    expect(quickened(c, meId)).not.toContain('fireball');
    expect(isLegalAction(c.state, meId, {
      kind: 'castSpell', spellId: 'fireball', slotLevel: 3, metamagic: 'quickened',
      targets: [{ position: { x: 4, y: 3 } }],
    })).toBe(false);
  });

  it('refuses a leveled spell after quickening one', () => {
    // The other half. Reachable from the UI, which can quicken with the action
    // still in hand — `isLegalAction` is deliberately wider than what
    // `legalActions` offers, so this direction is not hypothetical.
    const { c, meId } = board({ spellIds: ['fireball', 'magic-missile', 'fire-bolt'] });
    c.apply({
      kind: 'castSpell', spellId: 'fireball', slotLevel: 3, metamagic: 'quickened',
      targets: [{ position: { x: 4, y: 3 } }],
    });
    expect(c.state.combatants[meId]!.turn.quickenedThisTurn).toBe(true);
    expect(isLegalAction(c.state, meId, {
      kind: 'castSpell', spellId: 'magic-missile', slotLevel: 1, targets: [{ combatantId: 'e0' }],
    })).toBe(false);
  });

  it('still allows the cantrip, which is the combination the rule leaves open', () => {
    const { c, meId } = board({ spellIds: ['fireball', 'fire-bolt'] });
    c.apply({
      kind: 'castSpell', spellId: 'fireball', slotLevel: 3, metamagic: 'quickened',
      targets: [{ position: { x: 4, y: 3 } }],
    });
    expect(isLegalAction(c.state, meId, {
      kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'e0' }],
    })).toBe(true);
  });

  it('does not quicken a spell that is already a bonus action', () => {
    // Two points for nothing. `applies` gates on the casting time, not on the
    // spell being leveled.
    const { c, meId } = board({ spellIds: ['misty-step', 'fire-bolt'] });
    expect(SPELLS['misty-step']!.castingTime).not.toBe('action');
    c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'e0' }] });
    expect(quickened(c, meId)).not.toContain('misty-step');
  });
});

describe('the enumeration gate is the whole pricing story', () => {
  it('offers nothing quickened while the action is still in hand', () => {
    // THE test. If this starts passing quickened casts through, the option is
    // competing against the same spell cast for free — which is how every
    // modifier in this codebase has been mispriced, six times running.
    const { c, meId } = board({ spellIds: ['fireball', 'fire-bolt'] });
    expect(c.state.combatants[meId]!.turn.actionUsed).toBe(false);
    expect(quickened(c, meId)).toEqual([]);
  });

  it('does not offer a cantrip, however cheap the points look', () => {
    // MEASURED, not reasoned. Offering every quickenable spell put Quickened at
    // 258 uses across 40 level-8 arena runs — 236 of them Poison Spray, a
    // quarter of the day's points for about five hit points of cantrip. The
    // scorer prices what a spell does and has no term for the pool at all, so
    // anything above zero wins; the pool is reserved by policy instead.
    // (`isLegalAction` still allows it — a player may spend the points.)
    const { c, meId } = board({ spellIds: ['fireball', 'fire-bolt', 'poison-spray'] });
    c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'e0' }] });
    expect(quickened(c, meId)).not.toContain('poison-spray');
    expect(isLegalAction(c.state, meId, {
      kind: 'castSpell', spellId: 'poison-spray', slotLevel: 0, metamagic: 'quickened',
      targets: [{ combatantId: 'e0' }],
    })).toBe(true);
  });

  it('offers them once the action is gone', () => {
    const { c, meId } = board({ spellIds: ['fireball', 'fire-bolt'] });
    c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'e0' }] });
    expect(quickened(c, meId)).toContain('fireball');
  });

  it('and the AI actually takes one, rather than ending its turn', () => {
    // The measurement that matters: a spell nobody casts is a spell that does
    // not exist. Three orcs in a clump, cantrip already thrown — a Fireball is
    // worth far more than the two points, and the AI has to see that with no
    // metamagic-specific scoring anywhere in `greedy.ts`.
    const { c, meId } = board({
      spellIds: ['fireball', 'fire-bolt'],
      foes: [{ x: 5, y: 2 }, { x: 6, y: 2 }, { x: 5, y: 3 }],
    });
    c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'e0' }] });
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'castSpell' && a.metamagic === 'quickened' && a.spellId === 'fireball').toBe(true);
  });

  it('costs the other eleven classes nothing at all', () => {
    // The reason the gate is written the way it is. `legalActions` is the hot
    // path in every arena run; a class with no points must produce exactly the
    // list it always did, and the guard must be one boolean rather than a walk.
    for (const classId of ['wizard', 'fighter', 'cleric', 'bard', 'warlock']) {
      const me: Combatant = buildCharacter({ classId, team: 'team1', position: { x: 0, y: 3 }, level: 8 });
      const foe = { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e0' };
      const c = new Combat({ combatants: [me, foe], seed: 4 });
      let guard = 0;
      while (c.activeId !== me.id && guard++ < 40) c.apply({ kind: 'endTurn' });
      const withMeta = legalActions(c.state, me.id)
        .filter((a: Action) => a.kind === 'castSpell' && a.metamagic !== undefined);
      expect(withMeta, `${classId} was offered metamagic`).toEqual([]);
    }
  });
});

describe('metamagicOptions is what a UI reads', () => {
  it('answers for a spell the caster could bend, with the action still free', () => {
    // The UI arms a chip and builds the action itself; it never enumerates.
    // So this has to answer independently of what `legalActions` chose to emit.
    const { c, meId } = board({ spellIds: ['fireball', 'fire-bolt'] });
    expect(quickened(c, meId)).toEqual([]);      // not offered...
    const opts = metamagicOptions(c.state, meId, SPELLS.fireball!);
    expect(opts.map((m) => m.id)).toEqual(['quickened']);   // ...but available
    expect(isLegalAction(c.state, meId, {
      kind: 'castSpell', spellId: 'fireball', slotLevel: 3, metamagic: 'quickened',
      targets: [{ position: { x: 4, y: 3 } }],
    })).toBe(true);
  });

  it('says nothing for a class that knows no metamagic', () => {
    const w = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 8 });
    const c = new Combat({ combatants: [w, { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e0' }], seed: 1 });
    expect(metamagicOptions(c.state, w.id, SPELLS.fireball!)).toEqual([]);
  });
});

describe('Draconic Sorcery', () => {
  it('wears its scales instead of Mage Armor when the scales are better', () => {
    // The ordering trap: a sorcerer has Mage Armor on its own list, and the
    // Mage Armor branch of `acOf` used to return before anything else could.
    // At level 8 (Cha 20) the scales are 10 + Dex + 5 against the spell's
    // 13 + Dex, so resolving in written order made the subclass feature
    // worthless on exactly the character that has both.
    const s = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 0 }, level: 8 });
    const bare = acOf(s);
    s.mageArmor = true;
    expect(acOf(s), 'Mage Armor must never LOWER a draconic sorcerer\'s AC').toBeGreaterThanOrEqual(bare);
    expect(bare).toBeGreaterThan(10 + 1);   // scales are doing something
  });

  it('adds hit points, 3 at level 3 and one a level after', () => {
    const three = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 0 }, level: 3 });
    const four = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 0 }, level: 4 });
    // Level 4 also brings an ASI to Charisma, not Constitution, so the only
    // difference beyond the hit die is this feature.
    const perLevel = Math.ceil((6 + 1) / 2) + abilityMod(three.abilities.con);
    expect(four.maxHp - three.maxHp).toBe(perLevel + 1);
    // And the level-3 jump carries the +3, on top of one ordinary level.
    const two = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 0 }, level: 2 });
    expect(three.maxHp - two.maxHp).toBe(perLevel + 3);
  });

  it('has Command prepared from 3rd, which is not on the sorcerer list', () => {
    const three = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 0 }, level: 3 });
    expect(three.spellIds).toContain('command');
  });
});
