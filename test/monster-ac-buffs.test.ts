/**
 * A monster's armour class has to be able to change.
 *
 * WHAT WAS WRONG
 *
 * `acOf` opened with `if (c.acOverride !== undefined) return c.acOverride;`, and
 * `buildMonster` sets `acOverride` on every monster in the game. So the first
 * line of the function returned before any modifier was read, and every AC
 * effect in the game silently did nothing to anything with a stat block:
 * Shield of Faith, the Shield reaction, Haste's +2, Warding Bond, trinkets, and
 * armour corrosion.
 *
 * Measured by applying Shield of Faith to whole enemy lines across 750 fights:
 * a win-rate delta of 0.0 +/-0.0. Not a small effect — an absent one.
 *
 * TWO MECHANICS WERE PAYING FOR IT
 *
 * `tryAutoShield` spends a spell SLOT and the reaction to set `shielded`, and
 * exactly one monster carries Shield. It paid full price for nothing.
 *
 * And weapons with `corrodes` increment `corroded` on metal-armoured monsters —
 * which `buildMonster` deliberately equips with chain mail so the rider can
 * find them — writing a number that nobody read.
 *
 * WHAT IS PINNED HERE
 *
 * That each modifier moves a monster's AC by its own amount, that they stack,
 * that the base is otherwise untouched for every monster in the book, and that
 * the stat block's number is still a BASE rather than an invitation to add the
 * armour calculation on top of it.
 */
import { describe, it, expect } from 'vitest';
import { acOf } from '../src/data/armor.js';
import { MONSTERS, buildMonster } from '../src/data/monsters.js';
import { tryAutoShield } from '../src/engine/rules/attack.js';
import { Combat } from '../src/engine/combat.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, ConditionId } from '../src/engine/types.js';

const ids = Object.keys(MONSTERS);
const mob = (id = 'goblin-warrior') => buildMonster(id, 'team2', { x: 1, y: 1 });

describe('conditions reach a stat block', () => {
  it.each([
    ['warded', 2],       // Shield of Faith
    ['shielded', 5],     // the Shield reaction
    ['hasted', 2],       // Haste's armour half
    ['bonded', 1],       // Warding Bond
  ] as Array<[ConditionId, number]>)('%s moves a monster AC by %i', (id, delta) => {
    const m = mob();
    const before = acOf(m);
    m.conditions.push({ id });
    expect(acOf(m) - before, `${id} does nothing to a creature with a stat block`).toBe(delta);
  });

  it('stacks them, rather than taking the best', () => {
    const m = mob();
    const before = acOf(m);
    m.conditions.push({ id: 'warded' }, { id: 'shielded' });
    expect(acOf(m) - before).toBe(7);
  });

  it('leaves every monster in the book at its printed AC when nothing is on it', () => {
    // The other half of the fix: the override is still the base. Adding the
    // derived armour calculation on top would silently re-armour the metal
    // monsters, which carry chain mail only so Shocking Grasp can find them.
    const wrong = ids.filter((id) => acOf(mob(id)) !== MONSTERS[id]!.ac);
    expect(wrong, `these no longer match their stat block: ${wrong.join(', ')}`).toEqual([]);
  });

  it('does not add a stat block monster armour it is only carrying for the rider', () => {
    const metal = ids.find((id) => MONSTERS[id]!.metalArmor);
    expect(metal, 'no metal-armoured monster to check').toBeDefined();
    const m = mob(metal!);
    expect(m.equipped.armor, 'the chain mail for the Shocking Grasp rider is gone').toBe('chain-mail');
    expect(acOf(m), 'the chain mail is being counted as armour').toBe(MONSTERS[metal!]!.ac);
  });
});

describe('corrosion reaches a stat block too', () => {
  const metalId = ids.find((id) => MONSTERS[id]!.metalArmor)!;

  it('lowers the AC of a monster whose armour is being eaten', () => {
    const m = mob(metalId);
    const before = acOf(m);
    m.corroded = 2;
    expect(acOf(m), 'rust on a stat block still does nothing').toBe(before - 2);
  });

  it('never rusts one below what it would have with no armour at all', () => {
    const m = mob(metalId);
    m.corroded = 99;
    const bare = 10 + Math.floor((m.abilities.dex - 10) / 2);
    expect(acOf(m)).toBeGreaterThanOrEqual(Math.min(acOf(mob(metalId)), bare));
  });
});

describe('the Shield reaction now buys something', () => {
  it('raises the AC of the monster that spent a slot and its reaction on it', () => {
    // The control caster is the one monster carrying Shield. Before the fix it
    // paid a slot and a reaction for a condition nothing read.
    const caster = ids.find((id) => MONSTERS[id]!.spellcasting?.spellIds.includes('shield'));
    expect(caster, 'no monster carries Shield any more — this tests nothing').toBeDefined();

    const foe = buildMonster(caster!, 'team2', { x: 5, y: 5 }, 'x');
    const hero = makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 1 } });
    const combat = new Combat({ seed: 4, combatants: [hero, foe] });
    const target = combat.state.combatants[foe.id] as Combatant;

    const before = acOf(target);
    const slots = target.spellSlots.reduce((a, s) => a + s.current, 0);
    expect(tryAutoShield(combat.state, foe.id), 'the caster refused to cast Shield').toBe(true);

    expect(acOf(target) - before, 'it spent a slot and a reaction for no armour').toBe(5);
    expect(target.spellSlots.reduce((a, s) => a + s.current, 0), 'no slot was spent').toBe(slots - 1);
    expect(target.turn.reactionUsed).toBe(true);
  });
});
