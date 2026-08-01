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
import { expectedDamage } from '../src/engine/rules/estimate.js';
import { step } from '../src/engine/actions.js';
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

  it('sinks pack weapons below everything ready, whatever they would do', () => {
    // Drawing a spear out of your bag is a deliberate act, not a default.
    const combat = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'), mon('orc', 'team2', { x: 3, y: 4 }, 'orc')],
    });
    const opts = optionsFor(combat, 'ftr', 'orc');
    const firstStowed = opts.findIndex((o) => o.stowed);
    if (firstStowed === -1) return; // this fighter carries nothing spare
    expect(opts.slice(firstStowed).every((o) => o.stowed),
      'a ready weapon is listed below a packed one').toBe(true);
  });
});

describe('the chooser folds the rest', () => {
  const combat = () => new Combat({
    seed: 5,
    mapId: 'open',
    combatants: [
      pc('cleric', 'team1', { x: 3, y: 3 }, 'cle'),
      mon('orc', 'team2', { x: 3, y: 4 }, 'orc'),
    ],
  });

  it('shows no more than the visible cap', () => {
    const opts = optionsFor(combat(), 'cle', 'orc');
    expect(opts.filter((o) => !o.folded).length).toBeLessThanOrEqual(SHOWN_OPTIONS);
  });

  it('folds rather than drops — every legal play is still in the list', () => {
    // Dropping legal plays would be a rules change for the human, since the AI
    // would keep options the player could not reach.
    const c = combat();
    let guard = 0;
    while (c.activeId !== 'cle' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const legalOnOrc = c.legalActions().filter(
      (a) => (a.kind === 'attack' && a.targetId === 'orc') ||
        (a.kind === 'shove' && a.targetId === 'orc'),
    ).length;
    const opts = groupActions(c.state, 'cle', c.legalActions()).perTarget.get('orc') ?? [];
    const inList = opts.filter(
      (o) => o.action.kind === 'attack' || o.action.kind === 'shove',
    ).length;
    expect(inList, 'a legal play vanished from the chooser').toBe(legalOnOrc);
  });

  it('always leaves a free option visible', () => {
    // A first-level slot usually out-damages a cantrip by a little, so a naive
    // ranking fills every visible row with slot-spenders and leaves a caster
    // looking like they have no free attack.
    const opts = optionsFor(combat(), 'cle', 'orc');
    const free = (o: { action: { kind: string; slotLevel?: number } }) =>
      o.action.kind !== 'castSpell' || o.action.slotLevel === 0;
    if (!opts.some(free)) return; // nothing free to protect
    expect(opts.filter((o) => !o.folded).some(free),
      'every visible option costs a spell slot').toBe(true);
  });

  it('leaves a short list alone', () => {
    // Two options need no disclosure, and a fold control over nothing is worse
    // than no fold control.
    const c = new Combat({
      seed: 9,
      mapId: 'open',
      combatants: [pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'), mon('goblin-warrior', 'team2', { x: 3, y: 4 }, 'gob')],
    });
    const opts = optionsFor(c, 'ftr', 'gob');
    if (opts.length > SHOWN_OPTIONS) return;
    expect(opts.every((o) => !o.folded)).toBe(true);
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
  });
});
