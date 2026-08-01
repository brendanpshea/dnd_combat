/**
 * "No Concentration or Spells." A raging barbarian casts nothing.
 *
 * SRD 5.2.1, Rage: *"No Concentration or Spells. You can't maintain
 * Concentration, and you can't cast spells."* Neither half was implemented.
 *
 * It never came up because a pure barbarian has no spell list — but this game
 * grants spells by ANCESTRY, so a tiefling barbarian carries Poison Spray and
 * Ray of Sickness, and was casting both mid-rage. Reported from play.
 *
 * The rule is about casting, not about magic in general: a potion is still
 * drinkable, and the resistances and Strength advantage rage grants are
 * untouched. A spell SCROLL is casting, so it goes too.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import type { Action } from '../src/engine/actions.js';
import type { Combatant, TeamId } from '../src/engine/types.js';

/** A barbarian whose ancestry gives it spells, ready to act. */
function ragingBarbarian(extra: Partial<Combatant> = {}) {
  const b = {
    ...buildCharacter({
      classId: 'barbarian', team: 'team1' as TeamId,
      position: { x: 3, y: 3 }, level: 5, speciesId: 'tiefling',
    }),
    id: 'bar',
    ...extra,
  };
  const c = new Combat({
    seed: 4,
    mapId: 'open',
    combatants: [b, { ...buildMonster('orc', 'team2' as TeamId, { x: 3, y: 5 }), id: 'orc' }],
  });
  let guard = 0;
  while (c.activeId !== 'bar' && guard++ < 40) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe('bar');
  return c;
}

const rageAction = (c: Combat): Action =>
  c.legalActions().find((a) => a.kind === 'useFeature' && a.featureId === 'rage')!;

const casts = (c: Combat) => c.legalActions().filter((a) => a.kind === 'castSpell');

describe('rage suppresses spellcasting', () => {
  it('offers ancestry spells before the rage and none during it', () => {
    const c = ragingBarbarian();
    expect(casts(c).length, 'this barbarian has no spells — the fixture tests nothing')
      .toBeGreaterThan(0);
    c.apply(rageAction(c));
    expect(c.state.combatants['bar']!.conditions.some((k) => k.id === 'raging')).toBe(true);
    expect(casts(c).map((a) => a.kind === 'castSpell' && a.spellId),
      'a raging barbarian is still being offered spells').toEqual([]);
  });

  it('refuses the cast even when the action is submitted directly', () => {
    // The menu not offering it is not the same as the engine refusing it: the
    // AI and a replayed action list both go straight to `apply`.
    const c = ragingBarbarian();
    const spell = casts(c)[0]!;
    c.apply(rageAction(c));
    expect(() => c.apply(spell), 'the engine let a raging barbarian cast').toThrow();
  });

  it('takes an item that casts a spell too — a wand is still casting', () => {
    // Not a scroll: a scroll needs the spell on the user's CLASS list, and a
    // barbarian has no list, so it could never read one rage or no rage. A
    // charged wand skips that check by design — the magic is in the wand — so
    // it is the only way a barbarian reaches `targeting.kind === 'spell'`, and
    // therefore the only thing that tests this branch.
    const c = ragingBarbarian({
      inventory: [{ itemId: 'wand-magic-missiles', qty: 1 }],
    });
    const wands = () => c.legalActions().filter(
      (a) => a.kind === 'useItem' && a.itemId === 'wand-magic-missiles',
    );
    expect(wands().length, 'the wand was not usable even before raging').toBeGreaterThan(0);
    const wand = wands()[0]!;
    c.apply(rageAction(c));
    expect(wands(), 'a raging barbarian can still fire a wand').toEqual([]);
    expect(() => c.apply(wand)).toThrow();
  });

  it('still lets it drink a potion — that is not casting', () => {
    // The rule is about spells, not about everything magical.
    //
    // Checked on the turn AFTER the rage, still raging. A healing potion is a
    // BONUS action and so is Rage, so testing on the same turn measures the
    // spent bonus action and calls it a rage restriction — which is exactly
    // what the first version of this test did, and it failed for that reason
    // rather than for the one it claimed.
    const c = ragingBarbarian({ inventory: [{ itemId: 'potion-healing', qty: 1 }] });
    c.apply(rageAction(c));
    let guard = 0;
    do { c.apply({ kind: 'endTurn' }); } while (c.activeId !== 'bar' && guard++ < 40);
    expect(c.state.combatants['bar']!.conditions.some((k) => k.id === 'raging'),
      'the rage ended before the check').toBe(true);
    const potions = c.legalActions().filter(
      (a) => a.kind === 'useItem' && a.itemId === 'potion-healing',
    );
    expect(potions.length, 'raging took the healing potion away').toBeGreaterThan(0);
  });

  it('leaves the rest of the rage alone', () => {
    // A gate in the wrong place could easily cost the barbarian its own class.
    const c = ragingBarbarian();
    c.apply(rageAction(c));
    const bar = c.state.combatants['bar']!;
    expect(bar.conditions.some((k) => k.id === 'raging')).toBe(true);
    expect(c.legalActions().some((a) => a.kind === 'attack'),
      'a raging barbarian cannot attack').toBe(true);
  });

  it('does not gate a caster who is not raging', () => {
    const c = new Combat({
      seed: 4,
      mapId: 'open',
      combatants: [
        { ...buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 3, y: 3 }, level: 5 }), id: 'wz' },
        { ...buildMonster('orc', 'team2', { x: 3, y: 5 }), id: 'orc' },
      ],
    });
    let guard = 0;
    while (c.activeId !== 'wz' && guard++ < 40) c.apply({ kind: 'endTurn' });
    expect(c.legalActions().filter((a) => a.kind === 'castSpell').length,
      'the rage gate is catching everybody').toBeGreaterThan(0);
  });
});

describe('rage drops concentration', () => {
  it('ends a concentration spell the moment the rage begins', () => {
    // The other half of the same sentence. A barbarian can hold a concentration
    // effect from before the rage — an ancestry spell, a scroll read last turn —
    // and RAW it goes.
    const c = ragingBarbarian();
    const conc = casts(c).find((a) => a.kind === 'castSpell' && a.spellId === 'ray-of-sickness');
    // Ray of Sickness does not concentrate; set the state directly so the test
    // is about the rage rather than about which ancestry spell happens to.
    void conc;
    c.state.combatants['bar']!.concentratingOn = { spellId: 'faerie-fire', targetIds: ['orc'] };
    c.apply(rageAction(c));
    expect(c.state.combatants['bar']!.concentratingOn,
      'the barbarian kept concentrating through its own rage').toBeUndefined();
  });

  it('says so in the event stream, so the log can explain it', () => {
    const c = ragingBarbarian();
    c.state.combatants['bar']!.concentratingOn = { spellId: 'faerie-fire', targetIds: ['orc'] };
    const events = c.apply(rageAction(c));
    expect(events.some((e) => e.type === 'concentrationBroken'),
      'concentration ended silently').toBe(true);
  });
});
