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
import { chooseAction, scoreCastForTest } from '../src/ai/greedy.js';
import { SORCERY_POINTS, metamagicOptions, knownMetamagic } from '../src/engine/rules/metamagic.js';
import { SPELLS } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
    expect(quickened(c, meId)).toEqual([]);      // not QUICKENED-offered...
    const opts = metamagicOptions(c.state, meId, SPELLS.fireball!);
    // Both bends a Fireball can take: Quickened (it is an action) and Empowered
    // (it rolls damage dice). Not Heightened — see SAVE_OR_SUCK for why an area
    // spell is not what that option is for.
    expect(opts.map((m) => m.id).sort()).toEqual(['empowered', 'quickened']);
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

/**
 * Heightened Spell: a player option, and the machinery that makes it one.
 *
 * WHY IT IS NOT OFFERED TO THE AI
 *
 * Measured, twice. Offered, it fires 208 times across 40 level-8 runs — it is
 * strictly better than the plain cast and the scorer has no term for a sorcery
 * point, so the bent version always wins — and it pushed Quickened from 78 uses
 * down to 20. Then, given away FREE to ask whether it is worth anything at all:
 *
 *     60 runs, level 8      baseline      + free Heightened
 *     finished              52/60         52/60
 *     fights won            413 (48%)     413 (48%)
 *
 * Free, it does not move the outcome; charged, it can only be worse. So the AI
 * keeps its points for Quickened, and Heightened reaches the player through the
 * chip row instead — which is exactly the case the UI's "construct it yourself
 * and validate" design was built for.
 */
describe('Heightened Spell', () => {
  function caster(spellIds: string[]) {
    const me = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 3 }, level: 8 });
    me.spellIds = spellIds;
    const c = new Combat({
      seed: 4,
      combatants: [me, { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e0', hp: 60, maxHp: 60 }],
    });
    let guard = 0;
    while (c.activeId !== me.id && guard++ < 40) c.apply({ kind: 'endTurn' });
    return { c, meId: me.id };
  }

  const heighten = (spellId: string, slotLevel: number): Action => ({
    kind: 'castSpell', spellId, slotLevel, targets: [{ combatantId: 'e0' }], metamagic: 'heightened',
  });

  it('is legal, and never enumerated', () => {
    const { c, meId } = caster(['hold-person', 'fire-bolt']);
    expect(isLegalAction(c.state, meId, heighten('hold-person', 2))).toBe(true);
    expect(legalActions(c.state, meId).filter(
      (a) => a.kind === 'castSpell' && a.metamagic === 'heightened',
    )).toEqual([]);
  });

  it('gives its victim disadvantage on the save, and only for that one cast', () => {
    // The engine hook. `metamagicCast` lives on the state for the duration of
    // one `cast` call and is cleared in a `finally`; if the clearing broke, the
    // next creature to save would keep saving at disadvantage forever, which is
    // the kind of leak a per-cast flag invites.
    const { c, meId } = caster(['hold-person', 'fire-bolt']);
    c.apply(heighten('hold-person', 2));
    expect(c.state.metamagicCast, 'the bend must not outlive the cast').toBeUndefined();
  });

  it('spends the points', () => {
    const { c, meId } = caster(['hold-person', 'fire-bolt']);
    const before = c.state.combatants[meId]!.featureUses[SORCERY_POINTS]!.current;
    c.apply(heighten('hold-person', 2));
    expect(c.state.combatants[meId]!.featureUses[SORCERY_POINTS]!.current).toBe(before - 2);
  });

  it('offers only spells that actually roll a save', () => {
    /**
     * Every id in SAVE_OR_SUCK must be a real spell whose `cast` calls
     * `savingThrow`. Both halves earned their place: `polymorph` was on the list
     * and rolls nothing at all here (this game's version is ally-only), so the
     * tray offered a 2-point button that did nothing; and `slow` is not a spell
     * this game has, so it sat in the set forever doing nothing.
     *
     * Read off the source, because whether a save happens lives inside a `cast`
     * closure and there is no data flag for it.
     */
    const src = readFileSync(fileURLToPath(new URL('../src/data/spells.ts', import.meta.url)), 'utf8');
    const metaSrc = readFileSync(fileURLToPath(new URL('../src/engine/rules/metamagic.ts', import.meta.url)), 'utf8');
    const listed = [...metaSrc.slice(metaSrc.indexOf('const SAVE_OR_SUCK'))
      .slice(0, metaSrc.slice(metaSrc.indexOf('const SAVE_OR_SUCK')).indexOf(']'))
      .matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!);
    expect(listed.length, 'the set should not be empty').toBeGreaterThan(4);
    const bad: string[] = [];
    for (const id of listed) {
      if (!SPELLS[id]) { bad.push(`${id}: no such spell`); continue; }
      const key = `\n  ${/^[a-z]+$/.test(id) ? `${id}: {` : `'${id}': {`}`;
      const i = src.indexOf(key);
      const body = src.slice(i, src.indexOf('\n  },', i));
      if (!/savingThrow\(/.test(body)) bad.push(`${id}: rolls no save, so Heightened does nothing`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('only bends spells whose whole effect hangs on one save', () => {
    // The fan-out guard. Letting it apply to everything that rolls a save would
    // make the chip row a second copy of the spell list, and on a Fireball it
    // moves a few hit points of the half-damage margin rather than deciding
    // anything.
    const { c, meId } = caster(['fireball', 'hold-person', 'fire-bolt']);
    const ids = metamagicOptions(c.state, meId, SPELLS['hold-person']!).map((m) => m.id);
    expect(ids).toContain('heightened');
    expect(metamagicOptions(c.state, meId, SPELLS.fireball!).map((m) => m.id)).not.toContain('heightened');
    expect(isLegalAction(c.state, meId, {
      kind: 'castSpell', spellId: 'fireball', slotLevel: 3, metamagic: 'heightened',
      targets: [{ position: { x: 4, y: 3 } }],
    })).toBe(false);
  });

  it('scores higher than the same spell unbent', () => {
    // The scorer hook, which is one line in `saveFailProb` and nothing
    // per-spell. This is not used by the AI (nothing enumerates it) but it is
    // what a future price would be weighed against, and a bend that scored the
    // same as no bend would mean the hook was not wired at all.
    const { c, meId } = caster(['hold-person', 'fire-bolt']);
    const me = c.state.combatants[meId]!;
    const plain: Action = { kind: 'castSpell', spellId: 'hold-person', slotLevel: 2, targets: [{ combatantId: 'e0' }] };
    expect(scoreCastForTest(c.state, me, heighten('hold-person', 2) as Action & { kind: 'castSpell' }))
      .toBeGreaterThan(scoreCastForTest(c.state, me, plain as Action & { kind: 'castSpell' }));
  });
});
