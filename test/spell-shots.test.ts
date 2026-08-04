/**
 * A spell fires as many shots as its CASTER has earned, not as many as it can
 * ever reach.
 *
 * THE BUGS THIS EXISTS FOR, both reported from play:
 *
 * 1. A level-1 warlock's Eldritch Blast asked for two distinct targets. It has
 *    one beam until 5th level. `targeting.count` is written at the cap so the
 *    legality check permits the most a caster could ever pick, and every reader
 *    of it treated the cap as the actual number: the picker asked for two, the
 *    button said "(2 hits)", and `cast` silently threw the extra away.
 *
 * 2. At 5th level, with two beams, both could not be put on the same creature.
 *    `allowRepeats` in the UI was a hard-coded list of two spell ids. Eldritch
 *    Blast declares `stacksOnOneTarget: true` right there in its own data and
 *    was not on the list.
 *
 * The id list is the recurring failure here — the same one `spellTargetSets`
 * already carries a comment about, from the time Eldritch Blast quietly fired
 * one beam at a lone enemy. Both numbers are read off the spell now.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { SPELLS, spellShots, eldritchBeams } from '../src/data/spells.js';
import { groupActions } from '../web/src/actionGroups.js';
import type { Combatant, Position, TeamId } from '../src/engine/types.js';

function warlock(level: number, position: Position = { x: 3, y: 3 }): Combatant {
  return { ...buildCharacter({ classId: 'warlock', team: 'team1' as TeamId, position, level }), id: 'wl' };
}

function fight(level: number, foes = 2) {
  const enemies = Array.from({ length: foes }, (_, i) => ({
    ...buildMonster('goblin-warrior', 'team2' as TeamId, { x: 3 + i, y: 6 }),
    id: `foe${i}`,
  }));
  const c = new Combat({ seed: 5, mapId: 'open', combatants: [warlock(level), ...enemies] });
  let guard = 0;
  while (c.activeId !== 'wl' && guard++ < 40) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe('wl');
  return c;
}

describe('spellShots follows the caster, not the cap', () => {
  it('gives Eldritch Blast the beams the warlock has earned', () => {
    const eb = SPELLS['eldritch-blast']!;
    for (const [level, beams] of [[1, 1], [4, 1], [5, 2], [10, 2], [11, 3], [17, 4]] as const) {
      expect(spellShots(eb, warlock(level)), `level ${level}`).toBe(beams);
      expect(spellShots(eb, warlock(level))).toBe(eldritchBeams(level));
    }
  });

  it('is never more than the declared cap the legality check allows', () => {
    // `count` is the maximum; a `shots` that exceeded it would build target
    // sets the engine then rejects.
    for (const spell of Object.values(SPELLS)) {
      if (spell.targeting.kind !== 'creature') continue;
      for (const level of [1, 5, 11, 17]) {
        expect(spellShots(spell, warlock(level)), `${spell.id} at level ${level}`)
          .toBeLessThanOrEqual(spell.targeting.count);
      }
    }
  });

  it('falls back to the flat count for a spell that does not scale', () => {
    expect(spellShots(SPELLS['magic-missile']!, warlock(1))).toBe(3);
    expect(spellShots(SPELLS['magic-missile']!, warlock(17))).toBe(3);
  });
});

describe('the engine asks for the right number of targets', () => {
  it('will not accept a second Eldritch Blast target at level 1', () => {
    const c = fight(1);
    const twoBeams = {
      kind: 'castSpell' as const, spellId: 'eldritch-blast', slotLevel: 0,
      targets: [{ combatantId: 'foe0' }, { combatantId: 'foe1' }],
    };
    expect(() => c.apply(twoBeams), 'a level-1 warlock was allowed two beams').toThrow();
  });

  it('accepts two at level 5, including both on one creature', () => {
    const c = fight(5);
    expect(() => c.apply({
      kind: 'castSpell', spellId: 'eldritch-blast', slotLevel: 0,
      targets: [{ combatantId: 'foe0' }, { combatantId: 'foe0' }],
    }), 'both beams on one enemy was rejected').not.toThrow();
  });

  it('defaults a level-1 cast to a single target', () => {
    const c = fight(1);
    const casts = c.legalActions().filter(
      (a) => a.kind === 'castSpell' && a.spellId === 'eldritch-blast',
    );
    expect(casts.length, 'no Eldritch Blast on offer at all').toBeGreaterThan(0);
    for (const a of casts) {
      expect(a.kind === 'castSpell' && a.targets.length, 'a level-1 beam set has more than one target').toBe(1);
    }
  });
});

describe('the chooser offers Eldritch Blast the way it actually casts', () => {
  it('is a plain one-tap option at level 1', () => {
    const c = fight(1);
    const opts = groupActions(c.state, 'wl', c.legalActions()).perTarget.get('foe0') ?? [];
    const eb = opts.find((o) => o.label.startsWith('Eldritch Blast'));
    expect(eb, 'Eldritch Blast vanished from the chooser entirely').toBeDefined();
    // No target picker, and no "(2 hits)" on the button.
    expect(eb!.multi, 'a level-1 warlock is asked to pick more than one target').toBeUndefined();
    expect(eb!.label, 'the button claims more beams than the warlock has').toBe('Eldritch Blast');
  });

  it('offers two beams at level 5, and lets both land on one enemy', () => {
    const c = fight(5);
    const opts = groupActions(c.state, 'wl', c.legalActions()).perTarget.get('foe0') ?? [];
    const eb = opts.find((o) => o.label.startsWith('Eldritch Blast'));
    expect(eb?.multi, 'no target picker at level 5').toBeDefined();
    expect(eb!.multi!.maxTargets).toBe(2);
    expect(eb!.multi!.allowRepeats, 'both beams cannot be put on one enemy').toBe(true);
    expect(eb!.label).toBe('Eldritch Blast (2 hits)');
  });

  it('lets Magic Missile put every dart into one creature', () => {
    // The classic use, and the old id list's whole reason for existing. Magic
    // Missile was ON that list but did not carry `stacksOnOneTarget` in its own
    // data — so moving the UI to the flag would have silently taken this away.
    // The flag was added with the move; this is what would have caught it.
    expect(SPELLS['magic-missile']!.stacksOnOneTarget,
      'Magic Missile no longer declares that its darts may double up').toBe(true);
    const c = new Combat({
      seed: 5, mapId: 'open',
      combatants: [
        { ...buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 3, y: 3 }, level: 3 }), id: 'wz' },
        { ...buildMonster('orc', 'team2', { x: 3, y: 6 }), id: 'foe0', hp: 200, maxHp: 200 },
      ],
    });
    let guard = 0;
    while (c.activeId !== 'wz' && guard++ < 40) c.apply({ kind: 'endTurn' });
    // Read from the TRAY, not from the tapped enemy. Magic Missile is a
    // levelled spell and levelled spells no longer hang off a creature —
    // tapping is the attack gesture, and spending a slot is a decision that
    // belongs beside the slot pips. The dart picker itself is unchanged, which
    // is what this is really about.
    const mm = groupActions(c.state, 'wz', c.legalActions()).bar
      .find((b) => b.multi?.spellId === 'magic-missile');
    expect(mm?.multi, 'Magic Missile has no dart picker').toBeDefined();
    expect(mm!.multi!.allowRepeats, 'the darts can no longer all go to one creature').toBe(true);
    expect(mm!.multi!.maxTargets).toBe(3);
  });

  it('reads stacking off the spell rather than a list of ids', () => {
    // Scorching Ray and Magic Missile were the two ids the old list named.
    // Every spell that says it stacks must be allowed to, or the list is back.
    const c = fight(5);
    const g = groupActions(c.state, 'wl', c.legalActions());
    const specs = [...g.perTarget.values()].flat().filter((o) => o.multi);
    expect(specs.length).toBeGreaterThan(0);
    for (const o of specs) {
      expect(o.multi!.allowRepeats, `${o.multi!.spellId} disagrees with its own data`)
        .toBe(SPELLS[o.multi!.spellId]?.stacksOnOneTarget === true);
    }
  });
});

describe('a high-level warlock fires every beam it has earned', () => {
  it('lets an 11th-level warlock put three beams on the board', () => {
    // Found by the invariant above rather than by anyone playing an 11th-level
    // warlock: `count` was written at 2 while `eldritchBeams` reaches 4, so the
    // legality check rejected the third target and the default target set never
    // built one. `cast` would have fired it. Two beams quietly went missing for
    // every warlock above 10th level.
    const c = fight(11, 3);
    expect(() => c.apply({
      kind: 'castSpell', spellId: 'eldritch-blast', slotLevel: 0,
      targets: [{ combatantId: 'foe0' }, { combatantId: 'foe1' }, { combatantId: 'foe2' }],
    })).not.toThrow();
  });

  it('actually rolls one attack per beam', () => {
    // The count being legal is not the same as the beams being fired.
    const c = fight(11, 3);
    const events = c.apply({
      kind: 'castSpell', spellId: 'eldritch-blast', slotLevel: 0,
      targets: [{ combatantId: 'foe0' }, { combatantId: 'foe1' }, { combatantId: 'foe2' }],
    });
    const rolls = events.filter((e) => e.type === 'attackRolled');
    expect(rolls.length, 'an 11th-level warlock fired fewer than three beams').toBe(3);
  });
});
