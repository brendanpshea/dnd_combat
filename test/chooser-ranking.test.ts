/**
 * The attack chooser puts the best option first and folds the rest.
 *
 * Reported from a session with a young player: the list of things you can do to
 * a tapped enemy is overwhelming, and it encourages bad plays — a wizard's
 * dagger, a fighter's Sacred Flame. Measured over sixty battles, the list has a
 * median of four entries and reaches nine; a fighter's is six essentially every
 * turn, and 65% of taps offer more than three.
 *
 * These are behavioural: they build real combats and read the real lists, which
 * is the only way to catch a ranking that is right in principle and wrong on
 * the board.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { groupActions, SHOWN_OPTIONS } from '../web/src/actionGroups.js';
import { expectedDamage, hinderedByAdjacency } from '../src/engine/rules/estimate.js';
import { step, type Action } from '../src/engine/actions.js';
import { WEAPONS } from '../src/data/weapons.js';
import { SPELLS } from '../src/data/spells.js';
import type { Combatant, Position, TeamId } from '../src/engine/types.js';

function pc(classId: string, team: TeamId, position: Position, id: string, level = 5): Combatant {
  return { ...buildCharacter({ classId, team, position, level }), id };
}
function mon(monsterId: string, team: TeamId, position: Position, id: string): Combatant {
  return { ...buildMonster(monsterId, team, position), id };
}

/** The options a hero would see for a tapped enemy, with `hero` up. */
function optionsFor(combat: Combat, heroId: string, foeId: string) {
  let guard = 0;
  while (combat.activeId !== heroId && guard++ < 40) combat.apply({ kind: 'endTurn' });
  expect(combat.activeId, 'never reached the hero\'s turn').toBe(heroId);
  const g = groupActions(combat.state, heroId, combat.legalActions());
  return g.perTarget.get(foeId) ?? [];
}

describe('the chooser ranks by expected damage', () => {
  it('puts a wizard\'s cantrip ahead of its dagger', () => {
    // The reported case, exactly: tapping an enemy offered the dagger first.
    const combat = new Combat({
      seed: 7,
      mapId: 'open',
      combatants: [pc('wizard', 'team1', { x: 3, y: 3 }, 'wiz'), mon('goblin-warrior', 'team2', { x: 3, y: 4 }, 'gob')],
    });
    const opts = optionsFor(combat, 'wiz', 'gob');
    expect(opts.length, 'the wizard has only one thing to do — no ranking to test').toBeGreaterThan(1);
    const daggerAt = opts.findIndex((o) => /dagger/i.test(o.label));
    const boltAt = opts.findIndex((o) => /bolt|ray|shock/i.test(o.label));
    expect(daggerAt, 'no dagger in the list — the fixture stopped testing anything').toBeGreaterThan(-1);
    expect(boltAt, 'no damaging cantrip in the list').toBeGreaterThan(-1);
    expect(boltAt, 'the dagger still outranks the cantrip').toBeLessThan(daggerAt);
  });

  it('is sorted, all the way down', () => {
    // Not just "the best is first": every adjacent pair, or the ordering is
    // only accidentally right on the fixture above.
    const combat = new Combat({
      seed: 11,
      mapId: 'open',
      combatants: [pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
    });
    const opts = optionsFor(combat, 'ftr', 'orc');
    expect(opts.length).toBeGreaterThan(2);
    const ready = opts.filter((o) => !o.stowed);
    const scores = ready.map((o) => expectedDamage(combat.state, 'ftr', o.action));
    for (let i = 1; i < scores.length; i++) {
      // The 5% tie band keeps near-equal options in their original order, so
      // the guarantee is "not meaningfully worse", not "never equal".
      expect(scores[i]!, `option ${i} outranks ${i - 1}`)
        .toBeLessThanOrEqual(scores[i - 1]! * 1.05 + 0.05);
    }
  });

  it('prefers something in hand only between near-equals', () => {
    // This used to be absolute — pack weapons sank below everything ready,
    // whatever they would do — and that hid a strictly better weapon. Drawing
    // one is a free object interaction, so the pack is a tie-break, not a veto.
    const combat = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
    });
    const opts = optionsFor(combat, 'ftr', 'orc');
    const scores = opts.map((o) => expectedDamage(combat.state, 'ftr', o.action));
    for (let i = 1; i < opts.length; i++) {
      // A packed option may only sit above a ready one by being better.
      if (opts[i - 1]!.stowed && !opts[i]!.stowed) {
        expect(scores[i - 1]!, 'a pack weapon jumped a ready one without earning it')
          .toBeGreaterThan(scores[i]! * (1 - 0.02));
      }
    }
  });
});

/**
 * A ranger standing in melee was offered its longbow first and its shortsword
 * folded away at the bottom.
 *
 * Two faults at once. The bow swings at DISADVANTAGE with an enemy in reach —
 * the engine had that right — so at level 1 the sword is worth 4.26 against the
 * bow's 3.13, and it was ranked last anyway because a ranger's shortsword lives
 * in the pack and pack weapons sank unconditionally.
 *
 * And even at level 5, where the bow really is the better play (6.59 to 5.67),
 * burying the sword hides the answer to the situation the player is looking at.
 * So the ordering is by damage, and something that WORKS in melee is guaranteed
 * a visible row.
 *
 * "Works" rather than "is a melee weapon": the first version promoted a weapon,
 * which made a wizard show its dagger instead of Shocking Grasp — a touch spell,
 * unhindered, and better than anything else it had. The test is damage AND not
 * hindered by the adjacency, which a melee weapon, a touch cantrip and a
 * save-based spell all pass, and a bow does not. Hunter's Mark is unhindered and
 * deals nothing, so it does not count.
 */
describe('something that works in melee is always on offer', () => {
  const rangerVsOrc = (level: number) => {
    const c = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [pc('ranger', 'team1', { x: 3, y: 3 }, 'rng', level), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
    });
    let guard = 0;
    while (c.activeId !== 'rng' && guard++ < 40) c.apply({ kind: 'endTurn' });
    return c;
  };

  it.each([1, 5])('keeps the ranger\'s shortsword visible at level %i', (level) => {
    const c = rangerVsOrc(level);
    const opts = groupActions(c.state, 'rng', c.legalActions()).perTarget.get('orc') ?? [];
    const sword = opts.find((o) => /Shortsword/i.test(o.label));
    expect(sword, 'the ranger has no shortsword — the fixture stopped testing anything').toBeDefined();
    expect(sword!.folded, 'the melee weapon is folded away while standing in melee').toBeFalsy();
  });

  it('puts the shortsword FIRST at level 1, where it is simply better', () => {
    const c = rangerVsOrc(1);
    const opts = groupActions(c.state, 'rng', c.legalActions()).perTarget.get('orc') ?? [];
    const sword = opts.findIndex((o) => /Shortsword/i.test(o.label));
    const bow = opts.findIndex((o) => /Longbow/i.test(o.label));
    expect(sword).toBeGreaterThan(-1);
    expect(bow).toBeGreaterThan(-1);
    expect(sword, 'the longbow still outranks the shortsword in melee').toBeLessThan(bow);
  });

  it('still lets the bow rank first at level 5, where it is', () => {
    // The guarantee must not become "melee always wins" — that would be the
    // same kind of wrong, pointed the other way.
    const c = rangerVsOrc(5);
    const opts = groupActions(c.state, 'rng', c.legalActions()).perTarget.get('orc') ?? [];
    expect(opts[0]!.label, 'the guarantee has turned into a melee override').toMatch(/Longbow/i);
  });

  it('gives the bow disadvantage — the rule was never the problem', () => {
    const c = rangerVsOrc(5);
    const shot = c.legalActions().find((a) => a.kind === 'attack' && a.weaponId === 'longbow')!;
    const roll = step(c.state, shot).events.find((e) => e.type === 'attackRolled');
    expect(roll && 'disSources' in roll && roll.disSources).toContain('enemy adjacent');
  });

  it('leaves a wizard on its cantrip rather than forcing the dagger up', () => {
    // Shocking Grasp is a touch spell: unhindered, and the best thing a wizard
    // has against something standing on it. The earlier melee-WEAPON rule spent
    // the third row on the dagger — the worst option in the list — for nothing.
    const c = new Combat({
      seed: 7,
      mapId: 'open',
      combatants: [pc('wizard', 'team1', { x: 3, y: 3 }, 'wiz', 5), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
    });
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const opts = groupActions(c.state, 'wiz', c.legalActions()).perTarget.get('orc') ?? [];
    const shown = opts.filter((o) => !o.folded);
    expect(shown[0]!.label, 'the wizard is not led with its touch cantrip').toMatch(/Shocking Grasp/i);
    expect(shown.some((o) => o.action.kind === 'attack' && WEAPONS[o.action.weaponId]?.melee === true),
      'the dagger is still being promoted over a better cantrip').toBe(false);
  });

  it('promotes an unhindered option when the whole top three is hindered', () => {
    // The fixture that actually FIRES the guarantee. Everything the ranger and
    // the wizard tests above assert is true whether or not the guarantee runs,
    // because the ranking already keeps a working option visible for them —
    // four earlier versions of these tests passed with the guarantee deleted.
    //
    // A wizard with no touch cantrip, a crossbow in hand and a dagger in the
    // pack, standing on a zombie: Fire Bolt, Ray of Frost and the crossbow are
    // the top three and every one of them is swinging at disadvantage.
    //
    // It used to reach that top three via Scorching Ray. Levelled spells no
    // longer hang off a tapped enemy — tapping is the attack gesture, and a
    // slot is a resource decision that belongs in the tray — so the third
    // hindered option is a crossbow now. The shape of the fixture is what
    // matters, and the file already said to rebuild rather than let this pass
    // for the wrong reason.
    const wz = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 3, y: 3 }, level: 5 });
    wz.spellIds = wz.spellIds.filter((id) => !['shocking-grasp', 'poison-spray', 'true-strike'].includes(id));
    wz.equipped = { mainHand: 'light-crossbow' };
    wz.inventory = [{ itemId: 'dagger', qty: 1 }];
    const c = new Combat({
      seed: 7,
      mapId: 'open',
      combatants: [{ ...wz, id: 'wz' }, mon('zombie', 'team2', { x: 3, y: 4 }, 'z')],
    });
    let guard = 0;
    while (c.activeId !== 'wz' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const opts = groupActions(c.state, 'wz', c.legalActions()).perTarget.get('z') ?? [];
    const score = new Map(opts.map((o) => [o, expectedDamage(c.state, 'wz', o.action)]));
    const works = (o: (typeof opts)[number]) =>
      score.get(o)! > 0 && !hinderedByAdjacency(c.state, 'wz', o.action);

    // If this stops holding, the test has stopped exercising the guarantee and
    // must be rebuilt rather than left passing for the wrong reason.
    const naturalTop = [...opts].sort((a, b) => score.get(b)! - score.get(a)!).slice(0, SHOWN_OPTIONS);
    expect(naturalTop.some(works),
      'the fixture no longer needs the guarantee — rebuild it').toBe(false);

    expect(opts.filter((o) => !o.folded).some(works),
      'every visible option is hindered by the enemy standing on you').toBe(true);
  });

  it('knows which things the adjacency actually hinders', () => {
    // The predicate itself, because everything above passes as long as SOMETHING
    // is unhindered — it never checks that the right things are.
    const c = new Combat({
      seed: 7,
      mapId: 'open',
      combatants: [pc('wizard', 'team1', { x: 3, y: 3 }, 'wiz', 5), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
    });
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const spell = (id: string) => c.legalActions().find((a) => a.kind === 'castSpell' && a.spellId === id);
    const weapon = (id: string) => c.legalActions().find((a) => a.kind === 'attack' && a.weaponId === id);
    const hindered = (a: Action | undefined) => a && hinderedByAdjacency(c.state, 'wiz', a);

    // A ranged spell attack is hindered; a touch one is not.
    expect(hindered(spell('fire-bolt')), 'Fire Bolt is not being penalised in melee').toBe(true);
    expect(hindered(spell('shocking-grasp')), 'Shocking Grasp is being treated as a ranged attack').toBe(false);
    // A melee weapon is not.
    expect(hindered(weapon('dagger')), 'a dagger is being penalised for melee').toBe(false);
    // Poison Spray is deliberately NOT the save case: 2024 made it a ranged
    // spell attack, so it is hindered, and asserting otherwise was my mistake
    // rather than the code's.
    expect(hindered(spell('poison-spray')), 'Poison Spray is a ranged spell attack in 2024').toBe(true);
  });

  it('does not hinder a spell that rolls no attack at all', () => {
    // Sacred Flame is a Dexterity save: nothing to have disadvantage on, and it
    // works perfectly well with something breathing on you.
    const c = new Combat({
      seed: 7,
      mapId: 'open',
      combatants: [pc('cleric', 'team1', { x: 3, y: 3 }, 'cle', 5), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
    });
    let guard = 0;
    while (c.activeId !== 'cle' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const flame = c.legalActions().find((a) => a.kind === 'castSpell' && a.spellId === 'sacred-flame');
    expect(flame, 'no Sacred Flame — the fixture stopped testing anything').toBeDefined();
    expect(hinderedByAdjacency(c.state, 'cle', flame!),
      'a saving-throw spell is being treated as an attack').toBe(false);
  });

  it('promotes nothing when there is no answer to give', () => {
    // A wizard with no touch cantrip and no weapon at all, standing on a
    // zombie: every damaging option is a hindered ranged attack, and the only
    // unhindered things left — Blindness, a shove — deal nothing. There is no
    // answer, and promoting a dud into the visible set to pretend otherwise
    // would cost a real option its row. This is what the `> 0` is for.
    const wz = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 3, y: 3 }, level: 5 });
    wz.spellIds = wz.spellIds.filter((id) => !['shocking-grasp', 'true-strike', 'magic-missile'].includes(id));
    wz.equipped = { armor: wz.equipped.armor } as typeof wz.equipped;
    wz.inventory = [];
    const c = new Combat({
      seed: 7,
      mapId: 'open',
      combatants: [{ ...wz, id: 'wz' }, mon('zombie', 'team2', { x: 3, y: 4 }, 'z')],
    });
    let guard = 0;
    while (c.activeId !== 'wz' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const opts = groupActions(c.state, 'wz', c.legalActions()).perTarget.get('z') ?? [];
    const score = new Map(opts.map((o) => [o, expectedDamage(c.state, 'wz', o.action)]));
    const unhindered = (o: (typeof opts)[number]) => !hinderedByAdjacency(c.state, 'wz', o.action);

    // The fixture only tests anything while these hold.
    expect(opts.some((o) => unhindered(o) && score.get(o)! === 0),
      'no zero-damage unhindered option left to mis-promote — rebuild the fixture').toBe(true);
    expect(opts.some((o) => unhindered(o) && score.get(o)! > 0),
      'the fixture has a real melee answer now — rebuild it').toBe(false);

    // Every visible row must have been earned by damage, not by the guarantee.
    const shown = opts.filter((o) => !o.folded);
    const byScore = [...opts].sort((a, b) => score.get(b)! - score.get(a)!).slice(0, SHOWN_OPTIONS);
    expect(shown.map((o) => o.label).sort(),
      'a zero-damage option was promoted as if it were a melee answer')
      .toEqual(byScore.map((o) => o.label).sort());
  });


  it('does not invent a melee row when nothing is in reach', () => {
    // At range nothing is hindered, so the first damaging option satisfies the
    // rule and nothing is ever promoted. Self-limiting by construction.
    const c = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [pc('ranger', 'team1', { x: 3, y: 3 }, 'rng', 5), mon('orc', 'team2', { x: 3, y: 7 }, 'orc')],
    });
    let guard = 0;
    while (c.activeId !== 'rng' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const opts = groupActions(c.state, 'rng', c.legalActions()).perTarget.get('orc') ?? [];
    expect(opts.length, 'nothing on offer at range at all').toBeGreaterThan(0);
    for (const o of opts.filter((x) => !x.folded)) {
      expect(o.action.kind === 'attack' && WEAPONS[o.action.weaponId]?.melee,
        'a melee swing is offered against something out of reach').toBeFalsy();
    }
  });
});

describe('the damage estimate', () => {
  const combat = () => new Combat({
    seed: 21,
    mapId: 'open',
    combatants: [pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
  });

  it('is deterministic, so the buttons do not move between renders', () => {
    const c = combat();
    let guard = 0;
    while (c.activeId !== 'ftr' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const action = c.legalActions().find((a) => a.kind === 'attack' && a.targetId === 'orc')!;
    const first = expectedDamage(c.state, 'ftr', action);
    for (let i = 0; i < 5; i++) expect(expectedDamage(c.state, 'ftr', action)).toBe(first);
    expect(first, 'a swing at an orc is estimated at zero damage').toBeGreaterThan(0);
  });

  it('does not touch the state it is handed', () => {
    // It resolves the action to find out what it does, which is only safe
    // because `step` clones. If that ever stops being true, this catches it.
    const c = combat();
    let guard = 0;
    while (c.activeId !== 'ftr' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const action = c.legalActions().find((a) => a.kind === 'attack' && a.targetId === 'orc')!;
    const before = JSON.stringify(c.state);
    expectedDamage(c.state, 'ftr', action);
    expect(JSON.stringify(c.state), 'estimating an action changed the board').toBe(before);
  });

  it('never scores a real damaging spell at exactly zero', () => {
    // A short-circuit for zero-damage actions was tried and removed: it saved
    // about 1.5ms of p90 and measured worse on the accuracy harness in a way I
    // could not attribute. This is the property it would have had to preserve,
    // kept because it is worth holding regardless of how the estimate is
    // implemented — a spell that reliably deals damage must never read as 0.
    // Across a spread of boards, because whether run 0's target saves is a
    // property of the seed: one fixture can miss the path entirely.
    let checked = 0;
    for (const seed of [3, 7, 12, 19, 23, 31, 44, 57]) {
      const c = new Combat({
        seed,
        mapId: 'open',
        combatants: [pc('cleric', 'team1', { x: 3, y: 3 }, 'cle', 5), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
      });
      let guard = 0;
      while (c.activeId !== 'cle' && guard++ < 40) c.apply({ kind: 'endTurn' });
      for (const a of c.legalActions()) {
        if (a.kind !== 'castSpell') continue;
        // Ground truth says it deals damage; the shipped estimate must agree it
        // deals SOMETHING, whatever one unlucky save did on the first run.
        if (expectedDamage(c.state, 'cle', a, { samples: 200, salt: 4242 }) < 1) continue;
        checked++;
        expect(expectedDamage(c.state, 'cle', a),
          `a real spell scored exactly zero: ${a.spellId} (seed ${seed})`).toBeGreaterThan(0);
      }
    }
    expect(checked, 'no damaging spell in these fixtures to test').toBeGreaterThan(0);
  }, 20_000);

  it('scores a non-damaging action at zero', () => {
    const c = combat();
    let guard = 0;
    while (c.activeId !== 'ftr' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const shove = c.legalActions().find((a) => a.kind === 'shove');
    if (!shove) return;
    expect(expectedDamage(c.state, 'ftr', shove)).toBe(0);
  });

  it('prices immunity, so a menu never recommends a wasted spell', () => {
    // The whole reason this runs the action instead of pricing it: riders like
    // immunity come along for free and correctly.
    const c = new Combat({
      seed: 4,
      mapId: 'open',
      combatants: [
        pc('wizard', 'team1', { x: 3, y: 3 }, 'wiz'),
        // A fire elemental is immune to fire; a goblin is not.
        mon('fire-elemental', 'team2', { x: 3, y: 5 }, 'imm'),
        mon('goblin-warrior', 'team2', { x: 4, y: 5 }, 'norm'),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const fireAt = (id: string) => c.legalActions().find(
      (a) => a.kind === 'castSpell' && a.spellId === 'fire-bolt' &&
        a.targets.some((t) => 'combatantId' in t && t.combatantId === id),
    );
    const onImmune = fireAt('imm');
    const onNormal = fireAt('norm');
    if (!onImmune || !onNormal) return;
    expect(expectedDamage(c.state, 'wiz', onImmune)).toBe(0);
    expect(expectedDamage(c.state, 'wiz', onNormal)).toBeGreaterThan(0);
  });
});

/**
 * The reported ordering: a melee cantrip beats a ranged one in melee.
 *
 * Fire Bolt is a RANGED spell attack, so a hostile within reach gives it
 * disadvantage; Shocking Grasp is a melee spell attack and takes none. The
 * engine had this right all along — the roll comes back tagged "enemy adjacent"
 * — and the ordering still put Fire Bolt first, because the estimate was too
 * noisy to see a difference the rules were making correctly.
 *
 * Converged over 2000 runs, a level-1 wizard beside an orc: Shocking Grasp
 * 4.48, Fire Bolt 3.85. At level 5: 13.05 against 11.71. Both gaps are real and
 * both were being lost.
 */
describe('a melee cantrip outranks a ranged one in melee', () => {
  const wizardVsOrc = (level: number) => {
    const c = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [pc('wizard', 'team1', { x: 3, y: 3 }, 'wiz', level), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
    });
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 40) c.apply({ kind: 'endTurn' });
    return c;
  };

  it.each([1, 5])('ranks Shocking Grasp above Fire Bolt at level %i', (level) => {
    const c = wizardVsOrc(level);
    const opts = groupActions(c.state, 'wiz', c.legalActions()).perTarget.get('orc') ?? [];
    const shock = opts.findIndex((o) => /Shocking Grasp/.test(o.label));
    const bolt = opts.findIndex((o) => /Fire Bolt/.test(o.label));
    expect(shock, 'no Shocking Grasp in the list').toBeGreaterThan(-1);
    expect(bolt, 'no Fire Bolt in the list').toBeGreaterThan(-1);
    expect(shock, 'Fire Bolt outranks Shocking Grasp in melee').toBeLessThan(bolt);
  });

  it.each([1, 5])('scores it higher too, not just sorts it higher at level %i', (level) => {
    // The tie band could produce the right order from the wrong numbers.
    const c = wizardVsOrc(level);
    const find = (id: string) => c.legalActions().find(
      (a) => a.kind === 'castSpell' && a.spellId === id,
    )!;
    expect(expectedDamage(c.state, 'wiz', find('shocking-grasp')))
      .toBeGreaterThan(expectedDamage(c.state, 'wiz', find('fire-bolt')));
  });

  it('still gives Fire Bolt disadvantage — the rule was never the problem', () => {
    const c = wizardVsOrc(5);
    const { events } = step(c.state, c.legalActions().find(
      (a) => a.kind === 'castSpell' && a.spellId === 'fire-bolt',
    )!);
    const roll = events.find((e) => e.type === 'attackRolled');
    expect(roll && 'disSources' in roll && roll.disSources).toContain('enemy adjacent');
  });

  it('lands close to the converged answer rather than merely on the right side', () => {
    // Ordering can be right by luck. These are the 2000-run values, +/-25%.
    const c = wizardVsOrc(5);
    const find = (id: string) => c.legalActions().find(
      (a) => a.kind === 'castSpell' && a.spellId === id,
    )!;
    const shock = expectedDamage(c.state, 'wiz', find('shocking-grasp'));
    const bolt = expectedDamage(c.state, 'wiz', find('fire-bolt'));
    expect(shock).toBeGreaterThan(13.05 * 0.75);
    expect(shock).toBeLessThan(13.05 * 1.25);
    expect(bolt).toBeGreaterThan(11.71 * 0.75);
    expect(bolt).toBeLessThan(11.71 * 1.25);
  });

  it('never estimates a real option at exactly nothing', () => {
    // The symptom that made this visible: a level-1 Fire Bolt scored 0.00 and
    // sorted below a dagger, because all five of its fixed seeds missed.
    for (const level of [1, 3, 5]) {
      const c = wizardVsOrc(level);
      for (const a of c.legalActions()) {
        if (a.kind !== 'castSpell' && a.kind !== 'attack') continue;
        const hits = expectedDamage(c.state, 'wiz', a, { samples: 400, salt: 99 });
        if (hits < 1) continue;   // genuinely does nothing to this target
        expect(expectedDamage(c.state, 'wiz', a),
          `a real option scored zero at level ${level}`).toBeGreaterThan(0);
      }
    }
    // 400-sample ground truth for every legal action at three levels is
    // genuinely expensive; this is the one test that needs longer than the
    // default budget rather than being made less thorough.
  }, 30_000);
});

describe('tapping an enemy is the attack gesture, not the spellbook', () => {
  /**
   * A levelled spell is a resource decision — which slot, and is this the fight
   * to spend it on. Tapping a creature is the thing you do every turn, for
   * free, forever. Mixing the two put Suggestion and Blindness in the list
   * behind an ogre, where they sorted to the bottom beside Shove because they
   * deal no damage at all.
   *
   * Nothing is removed from the game by this: every levelled spell is still in
   * the tray, with its slot pips beside it, which is the screen that can answer
   * "should I spend this".
   */
  const CASTERS = ['wizard', 'sorcerer', 'warlock', 'druid', 'cleric', 'bard'];

  it.each(CASTERS)('offers %s no levelled spell behind a tapped enemy', (classId) => {
    for (const level of [1, 3, 5, 8]) {
      const c = new Combat({
        seed: 7, mapId: 'open',
        combatants: [pc(classId, 'team1', { x: 3, y: 3 }, 'hero', level), mon('ogre', 'team2', { x: 3, y: 4 }, 'foe')],
      });
      for (const o of optionsFor(c, 'hero', 'foe')) {
        if (o.action.kind !== 'castSpell') continue;
        const spell = SPELLS[o.action.spellId];
        expect(spell?.level, `${classId} L${level} is offered ${o.label} (level ${spell?.level}) behind an enemy`).toBe(0);
      }
    }
  });

  it('still keeps every levelled spell reachable in the tray', () => {
    // The other half. Dropping them from the chooser is only acceptable because
    // the tray is complete — otherwise this hides spells rather than tidying.
    const c = new Combat({
      seed: 7, mapId: 'open',
      combatants: [pc('wizard', 'team1', { x: 3, y: 3 }, 'hero', 5), mon('ogre', 'team2', { x: 3, y: 4 }, 'foe')],
    });
    let guard = 0;
    while (c.activeId !== 'hero' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const g = groupActions(c.state, 'hero', c.legalActions());
    const castable = new Set(
      c.legalActions().filter((a): a is Extract<Action, { kind: 'castSpell' }> => a.kind === 'castSpell')
        .filter((a) => (SPELLS[a.spellId]?.level ?? 0) > 0)
        .map((a) => a.spellId),
    );
    expect(castable.size, 'the fixture has no levelled spell to lose').toBeGreaterThan(0);
    const inTray = new Set(g.bar.filter((b) => b.group === 'spell').map((b) => b.id));
    for (const id of castable) {
      expect([...inTray].some((k) => k.includes(id)), `${id} is castable but reachable from nowhere`).toBe(true);
    }
  });
});

describe('one row per weapon', () => {
  /**
   * True Strike is cast THROUGH a weapon, so a caster holding a dagger gets
   * both "Dagger" and "True Strike (Dagger)" — two buttons swinging the same
   * dagger, differing only in which ability rolls it.
   *
   * Measured on a level-1 wizard beside an ogre, the three visible rows were
   * True Strike (Quarterstaff), Dagger, True Strike (Dagger): two weapons,
   * three ways, and not one attack cantrip on screen. Shocking Grasp, Fire
   * Bolt, Ray of Frost and Poison Spray were all folded behind them.
   */
  const weaponOf = (a: Action): string | undefined =>
    a.kind === 'attack' ? a.weaponId : a.kind === 'castSpell' ? a.weaponId : undefined;

  it.each(['wizard', 'sorcerer', 'bard', 'cleric', 'druid', 'warlock', 'fighter', 'rogue'])(
    'never offers %s the same weapon twice', (classId) => {
      for (const level of [1, 3, 5, 8]) {
        const c = new Combat({
          seed: 7, mapId: 'open',
          combatants: [pc(classId, 'team1', { x: 3, y: 3 }, 'hero', level), mon('ogre', 'team2', { x: 3, y: 4 }, 'foe')],
        });
        const seen = new Map<string, string>();
        for (const o of optionsFor(c, 'hero', 'foe')) {
          const w = weaponOf(o.action);
          if (w === undefined) continue;
          expect(seen.has(w), `${classId} L${level}: "${seen.get(w)}" and "${o.label}" both swing the ${w}`).toBe(false);
          seen.set(w, o.label);
        }
      }
    });

  it('keeps whichever version actually hits harder', () => {
    // Not a fixed preference for the spell: True Strike rolls on the caster's
    // spellcasting ability, so it wins for a wizard whose Intelligence beats
    // its Dexterity and loses for someone who has been raising Dexterity.
    const c = new Combat({
      seed: 7, mapId: 'open',
      combatants: [pc('wizard', 'team1', { x: 3, y: 3 }, 'hero', 1), mon('ogre', 'team2', { x: 3, y: 4 }, 'foe')],
    });
    const opts = optionsFor(c, 'hero', 'foe');
    const dagger = opts.find((o) => weaponOf(o.action) === 'dagger');
    expect(dagger, 'the dagger vanished entirely').toBeDefined();
    const kept = expectedDamage(c.state, 'hero', dagger!.action);
    // Whatever survived must be at least as good as the version that did not.
    const alternatives = c.legalActions().filter((a) => weaponOf(a) === 'dagger');
    expect(alternatives.length, 'the fixture no longer has two ways to use the dagger').toBeGreaterThan(1);
    for (const a of alternatives) {
      expect(kept + 0.01, 'the chooser kept the weaker of the two').toBeGreaterThanOrEqual(
        expectedDamage(c.state, 'hero', a));
    }
  });

  it('frees the row for a cantrip that was being crowded out', () => {
    // The symptom that started this: a level-1 wizard whose three visible rows
    // were all weapon swings, with every attack cantrip folded away.
    const c = new Combat({
      seed: 7, mapId: 'open',
      combatants: [pc('wizard', 'team1', { x: 3, y: 3 }, 'hero', 1), mon('ogre', 'team2', { x: 3, y: 4 }, 'foe')],
    });
    const shown = optionsFor(c, 'hero', 'foe').filter((o) => !o.folded);
    const cantrips = shown.filter((o) =>
      o.action.kind === 'castSpell' && weaponOf(o.action) === undefined && SPELLS[o.action.spellId]?.level === 0);
    expect(cantrips.length, `no attack cantrip visible: ${shown.map((o) => o.label).join(' | ')}`)
      .toBeGreaterThan(0);
  });
});
