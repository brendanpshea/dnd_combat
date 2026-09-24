/**
 * Hypnotic Pattern, Slow, Spike Growth, Hideous Laughter, Hellish Rebuke and
 * Vampiric Touch (SRD 5.2.1).
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { legalActions, isLegalAction } from '../src/engine/actions.js';
import { SPELLS } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { applyDamage, breakConcentration } from '../src/engine/rules/attack.js';
import { pushCreature } from '../src/engine/rules/movement.js';
import { canReact, cellAt, type Combatant, type GameState } from '../src/engine/types.js';
import { makeCombatant } from './helpers.js';

const DUNCE = { str: 10, dex: 10, con: 12, int: 1, wis: 1, cha: 1 };

/** A 5th-level Int caster (spell DC 15) with the given spells and slots. */
function caster(spellIds: string[], over: Partial<Combatant> = {}): Combatant {
  return makeCombatant({
    id: 'w', team: 'team1', position: { x: 0, y: 0 }, level: 5,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 18 },
    spellcastingAbility: 'int', spellIds,
    spellSlots: [{ current: 4, max: 4 }, { current: 3, max: 3 }, { current: 2, max: 2 }],
    hp: 40, maxHp: 40, savingThrowProfs: [],
    ...over,
  });
}

function foe(id: string, x: number, y: number, over: Partial<Combatant> = {}): Combatant {
  return makeCombatant({
    id, team: 'team2', position: { x, y }, abilities: DUNCE, savingThrowProfs: [],
    hp: 200, maxHp: 200, ...over,
  });
}

function fight(all: Combatant[], seed = 1, mapId = 'open'): Combat {
  return new Combat({ seed, mapId, combatants: all });
}

/** Make `id` the creature whose turn it is, with a fresh turn. */
function turnOf(state: GameState, id: string) {
  state.turnIndex = state.initiativeOrder.indexOf(id);
  const c = state.combatants[id]!;
  c.turn = { ...c.turn, actionUsed: false, bonusActionUsed: false, reactionUsed: false,
    movementUsed: 0, movementMax: c.speed, attacksLeft: 0 };
}

/** First seed on which `cast` leaves `check` true. */
function firstSeed(make: (seed: number) => Combat, cast: (c: Combat) => void, check: (c: Combat) => boolean): Combat {
  for (let seed = 1; seed <= 60; seed++) {
    const c = make(seed);
    cast(c);
    if (check(c)) return c;
  }
  throw new Error('no seed gave the wanted result');
}

const has = (c: Combat, id: string, cond: string) =>
  c.state.combatants[id]!.conditions.some((k) => k.id === cond);

describe('Hypnotic Pattern', () => {
  const make = (seed: number) => fight([
    caster(['hypnotic-pattern']), foe('a', 4, 4), foe('b', 5, 5),
    makeCombatant({ id: 'ally', team: 'team1', position: { x: 4, y: 5 }, abilities: DUNCE, savingThrowProfs: [] }),
  ], seed);
  const cast = (c: Combat) => { SPELLS['hypnotic-pattern']!.cast({ state: c.state, casterId: 'w', slotLevel: 3, targetIds: [], positions: [{ x: 4, y: 4 }] }); };
  const held = (c: Combat) => has(c, 'a', 'charmed') && has(c, 'b', 'charmed') && has(c, 'ally', 'charmed');

  it('charms and incapacitates everyone in the square who fails, allies included', () => {
    const c = firstSeed(make, cast, held);
    for (const id of ['a', 'b', 'ally']) expect(has(c, id, 'incapacitated'), id).toBe(true);
    expect(c.state.combatants.w!.concentratingOn?.spellId).toBe('hypnotic-pattern');
  });

  it('ends on a creature the moment it takes damage', () => {
    const c = firstSeed(make, cast, held);
    applyDamage(c.state, 'a', 'w', 3, 'slashing', [], { magical: false });
    expect(has(c, 'a', 'charmed') || has(c, 'a', 'incapacitated')).toBe(false);
    expect(has(c, 'b', 'incapacitated'), 'the others stay held').toBe(true);
  });

  it('can be shaken off by a neighbour, with an action', () => {
    const c = firstSeed(make, cast, held);
    c.state.combatants.b!.team = 'team1';       // stand-in for a friend beside the ally
    c.state.combatants.b!.conditions = [];
    turnOf(c.state, 'b');
    const shake = { kind: 'shakeAwake' as const, targetId: 'ally' };
    expect(isLegalAction(c.state, 'b', shake)).toBe(true);
    c.apply(shake);
    expect(has(c, 'ally', 'incapacitated')).toBe(false);
  });

  it('lifts from everyone when the caster loses concentration', () => {
    const c = firstSeed(make, cast, held);
    breakConcentration(c.state, 'w');
    expect(['a', 'b', 'ally'].some((id) => has(c, id, 'incapacitated'))).toBe(false);
  });

  it('does nothing to a creature that cannot see it, or cannot be charmed', () => {
    const c = fight([
      caster(['hypnotic-pattern']),
      foe('blind', 4, 4, { conditions: [{ id: 'blinded' }] }),
      foe('undying', 5, 5, { conditionImmunities: ['charmed'] }),
    ]);
    cast(c);
    expect(has(c, 'blind', 'incapacitated')).toBe(false);
    expect(has(c, 'undying', 'incapacitated')).toBe(false);
  });
});

describe('Slow', () => {
  const slowed = (seed = 1, over: Partial<Combatant> = {}) => firstSeed(
    (s) => fight([caster(['slow']), foe('a', 1, 0, { attacksPerAction: 3, ...over })], s + seed - 1),
    (c) => { SPELLS.slow!.cast({ state: c.state, casterId: 'w', slotLevel: 3, targetIds: ['a'], positions: [] }); },
    (c) => has(c, 'a', 'lethargic'),
  );

  it('costs 2 AC and 2 on Dexterity saves, and the reaction', () => {
    const c = slowed();
    const a = c.state.combatants.a!;
    const before = acOf({ ...a, conditions: [] });
    expect(acOf(a)).toBe(before - 2);
    expect(canReact(a)).toBe(false);
    // Same die both ways, two apart.
    const s1 = { ...c.state, rng: c.state.rng };
    const slow = savingThrow(s1, 'a', 'dex', 10, { magical: false }).event;
    a.conditions = [];
    const s2 = { ...c.state, rng: c.state.rng };
    const free = savingThrow(s2, 'a', 'dex', 10, { magical: false }).event;
    if (slow.type === 'savingThrow' && free.type === 'savingThrow') expect(free.total - slow.total).toBe(2);
  });

  it('halves speed, and allows one attack and an action or a bonus action', () => {
    const c = slowed();
    turnOf(c.state, 'a');
    c.apply({ kind: 'endTurn' });   // back round to 'a' via its own startTurn
    while (c.activeId !== 'a') c.apply({ kind: 'endTurn' });
    const a = c.state.combatants.a!;
    expect(a.turn.movementMax).toBe(15);
    const swing = legalActions(c.state, 'a').find((x) => x.kind === 'attack');
    expect(swing).toBeDefined();
    c.apply(swing!);
    expect(a.turn.attacksLeft, 'one attack, not three').toBe(0);
    expect(c.state.combatants.a!.turn.bonusActionUsed, 'and no bonus action after it').toBe(true);
  });

  it('only takes targets that fit in one 40-foot cube', () => {
    // The High Pass is twelve squares long: room for two creatures further
    // apart than any 40-foot cube.
    const c = fight([caster(['slow'], { position: { x: 3, y: 5 } }), foe('a', 3, 0), foe('b', 3, 11), foe('near', 4, 1)], 1, 'pass');
    const w = c.state.combatants.w!;
    const spread = { kind: 'castSpell' as const, spellId: 'slow', slotLevel: 3,
      targets: [{ combatantId: 'a' }, { combatantId: 'b' }] };
    turnOf(c.state, 'w');
    void w;
    expect(isLegalAction(c.state, 'w', spread)).toBe(false);
    const offered = legalActions(c.state, 'w').filter((x) => x.kind === 'castSpell' && x.spellId === 'slow');
    expect(offered.length).toBeGreaterThan(0);
    for (const o of offered) {
      if (o.kind !== 'castSpell') continue;
      const ids = o.targets.map((t) => ('combatantId' in t ? t.combatantId : ''));
      expect(ids.includes('a') && ids.includes('b')).toBe(false);
    }
  });
});

describe('Spike Growth', () => {
  const grown = () => {
    const c = fight([caster(['spike-growth']), foe('a', 6, 2)]);
    SPELLS['spike-growth']!.cast({ state: c.state, casterId: 'w', slotLevel: 2, targetIds: [], positions: [{ x: 4, y: 2 }] });
    return c;
  };

  it('lays thorns over the area and does nothing to anyone standing still', () => {
    const c = grown();
    expect(cellAt(c.state.grid, { x: 4, y: 2 })?.fire?.label).toBe('Spike Growth');
    expect(c.state.combatants.a!.hp).toBe(200);
  });

  it('cuts whoever walks through it, square by square, with no save', () => {
    const c = grown();
    turnOf(c.state, 'a');
    const events = c.apply({ kind: 'move', to: { x: 4, y: 2 } });
    expect(events.some((e) => e.type === 'savingThrow' && e.combatantId === 'a')).toBe(false);
    const cuts = events.filter((e) => e.type === 'damageDealt' && e.targetId === 'a');
    expect(cuts.length).toBe(2);   // (5,2) and (4,2)
  });

  it('is difficult ground', () => {
    const c = grown();
    turnOf(c.state, 'a');
    c.apply({ kind: 'move', to: { x: 5, y: 2 } });
    expect(c.state.combatants.a!.turn.movementUsed).toBe(10);
  });

  it('cuts whoever is shoved through it', () => {
    const c = grown();
    const events = pushCreature(c.state, 'a', { x: -1, y: 0 }, 1);
    expect(events.some((e) => e.type === 'damageDealt' && e.targetId === 'a')).toBe(true);
  });

  it('withers when concentration drops', () => {
    const c = grown();
    breakConcentration(c.state, 'w');
    expect(cellAt(c.state.grid, { x: 4, y: 2 })?.fire).toBeUndefined();
  });
});

describe('Hideous Laughter', () => {
  const laughing = (seed = 0) => firstSeed(
    (s) => fight([caster(['hideous-laughter']), foe('a', 3, 0)], s + seed),
    (c) => { SPELLS['hideous-laughter']!.cast({ state: c.state, casterId: 'w', slotLevel: 1, targetIds: ['a'], positions: [] }); },
    (c) => has(c, 'a', 'incapacitated'),
  );

  it('drops the target prone and helpless', () => {
    const c = laughing();
    expect(has(c, 'a', 'prone')).toBe(true);
    expect(c.state.combatants.w!.concentratingOn?.spellId).toBe('hideous-laughter');
  });

  it('a hit buys another save, with advantage, rather than simply ending it', () => {
    const c = laughing();
    const events = applyDamage(c.state, 'a', 'w', 3, 'slashing', [], { magical: false });
    expect(events.some((e) => e.type === 'savingThrow' && e.combatantId === 'a' && e.ability === 'wis')).toBe(true);
  });

  it('a failed end-of-turn save keeps it laughing, not asleep', () => {
    for (let seed = 0; seed < 40; seed++) {
      const c = laughing(seed);
      turnOf(c.state, 'a');
      const events = c.apply({ kind: 'endTurn' });
      const save = events.find((e) => e.type === 'savingThrow' && e.combatantId === 'a');
      if (save?.type !== 'savingThrow' || save.success) continue;
      expect(has(c, 'a', 'incapacitated')).toBe(true);
      expect(has(c, 'a', 'unconscious')).toBe(false);
      return;
    }
    throw new Error('never failed the repeat save');
  });

  it('cannot get up while it laughs', () => {
    const c = laughing();
    turnOf(c.state, 'w');
    for (let i = 0; i < 4 && c.activeId !== 'a'; i++) c.apply({ kind: 'endTurn' });
    if (has(c, 'a', 'incapacitated')) expect(has(c, 'a', 'prone')).toBe(true);
  });
});

describe('Hellish Rebuke', () => {
  const setup = (slots: number, over: Partial<Combatant> = {}) => {
    const warlock = caster(['hellish-rebuke'], {
      spellSlots: [{ current: slots, max: slots }], position: { x: 3, y: 3 }, ...over,
    });
    const brute = foe('a', 4, 3, { abilities: { ...DUNCE, str: 18 }, hp: 200, maxHp: 200 });
    return fight([warlock, brute]);
  };
  /** Swing at the warlock until something lands. */
  const beatOn = (c: Combat) => {
    for (let i = 0; i < 20; i++) {
      turnOf(c.state, 'a');
      c.state.combatants.w!.turn.reactionUsed = false;
      const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'w' });
      if (events.some((e) => e.type === 'damageDealt' && e.targetId === 'w')) return events;
      c.state.combatants.w!.hp = 40;
    }
    throw new Error('never hit');
  };

  it('burns whoever hurt the warlock, with a reaction and a slot', () => {
    const c = setup(2);
    const events = beatOn(c);
    expect(events.some((e) => e.type === 'spellCast' && e.spellId === 'hellish-rebuke')).toBe(true);
    expect(events.some((e) => e.type === 'damageDealt' && e.targetId === 'a' && e.damageType === 'fire')).toBe(true);
    expect(c.state.combatants.w!.spellSlots[0]!.current).toBe(1);
    expect(c.state.combatants.w!.turn.reactionUsed).toBe(true);
  });

  it('keeps the last slot for something better, unless it would finish the attacker', () => {
    const c = setup(1);
    const events = beatOn(c);
    expect(events.some((e) => e.type === 'spellCast' && e.spellId === 'hellish-rebuke')).toBe(false);
    expect(c.state.combatants.w!.spellSlots[0]!.current).toBe(1);
    const weak = setup(1);
    weak.state.combatants.a!.hp = 5;
    expect(beatOn(weak).some((e) => e.type === 'spellCast' && e.spellId === 'hellish-rebuke')).toBe(true);
  });
});

describe('Vampiric Touch', () => {
  const touched = () => {
    const c = fight([caster(['vampiric-touch'], { hp: 10 }), foe('a', 1, 0, { acOverride: 1 })]);
    turnOf(c.state, 'w');
    const cast = legalActions(c.state, 'w').find((x) => x.kind === 'castSpell' && x.spellId === 'vampiric-touch');
    expect(cast).toBeDefined();
    const events = c.apply(cast!);
    return { c, events };
  };

  it('drains the target and heals the caster half of it', () => {
    const { c, events } = touched();
    const hurt = events.find((e) => e.type === 'damageDealt' && e.targetId === 'a');
    const healed = events.find((e) => e.type === 'healed' && e.targetId === 'w');
    expect(hurt?.type === 'damageDealt' && healed?.type === 'healed' && healed.amount)
      .toBe(hurt?.type === 'damageDealt' ? Math.floor(hurt.amount / 2) : -1);
    expect(c.state.combatants.w!.spellSlots[2]!.current).toBe(1);
  });

  it('is offered again on a later turn, free', () => {
    const { c } = touched();
    turnOf(c.state, 'w');
    const again = legalActions(c.state, 'w').filter((x) => x.kind === 'castSpell' && x.spellId === 'vampiric-touch');
    expect(again.length).toBeGreaterThan(0);
    expect(again.every((x) => x.kind === 'castSpell' && x.slotLevel === 0)).toBe(true);
    c.apply(again[0]!);
    expect(c.state.combatants.w!.spellSlots[2]!.current, 'no second slot').toBe(1);
    expect(c.state.combatants.w!.concentratingOn?.spellId, 'still held').toBe('vampiric-touch');
  });

  it('stops being offered free once concentration drops', () => {
    const { c } = touched();
    breakConcentration(c.state, 'w');
    expect(c.state.combatants.w!.vampiricTouch).toBeUndefined();
    turnOf(c.state, 'w');
    const again = legalActions(c.state, 'w').filter((x) => x.kind === 'castSpell' && x.spellId === 'vampiric-touch');
    expect(again.every((x) => x.kind === 'castSpell' && x.slotLevel >= 3)).toBe(true);
  });
});
