import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { legalActions, step } from '../src/engine/actions.js';
import { discoverHidden } from '../src/engine/rules/hide.js';
import { skillBonus } from '../src/campaign/campaign.js';
import { abilityMod } from '../src/engine/types.js';
import type { Combatant, Position } from '../src/engine/types.js';

const elf = (classId: string, team: 'team1' | 'team2', position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team, position, speciesId: 'elf', level: 3 }), id });
const human = (classId: string, team: 'team1' | 'team2', position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team, position, speciesId: 'human', level: 3 }), id });

describe('a wood elf knows True Strike', () => {
  it('gets it from the species, whatever the class — including one with no spellbook', () => {
    expect(elf('wizard', 'team1', { x: 0, y: 0 }, 'a').spellIds).toContain('true-strike');
    expect(elf('fighter', 'team1', { x: 0, y: 0 }, 'a').spellIds).toContain('true-strike');
    expect(human('fighter', 'team1', { x: 0, y: 0 }, 'a').spellIds).not.toContain('true-strike');
  });

  it('is castable by a non-caster: a cantrip needs no slot', () => {
    const c = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [elf('fighter', 'team1', { x: 3, y: 3 }, 'ftr'), human('wizard', 'team2', { x: 3, y: 4 }, 'foe')],
    });
    let guard = 0;
    while (c.activeId !== 'ftr' && guard++ < 20) c.apply({ kind: 'endTurn' });
    expect(c.state.combatants['ftr']!.spellSlots).toEqual([]);   // no slots at all
    const casts = legalActions(c.state, 'ftr').filter(
      (a) => a.kind === 'castSpell' && a.spellId === 'true-strike',
    );
    expect(casts.length).toBeGreaterThan(0);
  });

  it('swings the weapon in hand, guided by the sharpest mind', () => {
    // An elf wizard: Int 16 (+3) against Str 8 (-1). Its quarterstaff should
    // suddenly hit like a weapon rather than like a wizard holding a stick.
    const c = new Combat({
      seed: 8,
      mapId: 'open',
      combatants: [elf('wizard', 'team1', { x: 3, y: 3 }, 'wiz'), human('fighter', 'team2', { x: 3, y: 4 }, 'foe')],
    });
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 20) c.apply({ kind: 'endTurn' });

    const wiz = c.state.combatants['wiz']!;
    expect(abilityMod(wiz.abilities.int)).toBeGreaterThan(abilityMod(wiz.abilities.str));

    const { events } = step(c.state, {
      kind: 'castSpell', spellId: 'true-strike', slotLevel: 0,
      targets: [{ combatantId: 'foe' }],
    });
    const attack = events.find((e) => e.type === 'attackRolled');
    expect(attack?.type === 'attackRolled' && attack.weaponId).toBe('dagger');
    // Int (+3), not Str (-1): the roll must clear the natural die by the mind's
    // modifier plus proficiency.
    if (attack?.type !== 'attackRolled') throw new Error('no attack');
    expect(attack.total - attack.natural).toBe(abilityMod(wiz.abilities.int) + 2);
  });

  it('is only worth casting for a caster — the rest is left to the numbers', () => {
    // Nothing here special-cases class. A fighter's mental stats are poor, so
    // True Strike is simply worse than swinging normally, and no rule had to
    // say so.
    const ftr = elf('fighter', 'team1', { x: 0, y: 0 }, 'f');
    const wiz = elf('wizard', 'team1', { x: 0, y: 0 }, 'w');
    const mental = (c: Combatant) => Math.max(...(['int', 'wis', 'cha'] as const).map((a) => abilityMod(c.abilities[a])));
    expect(mental(ftr)).toBeLessThan(abilityMod(ftr.abilities.str));    // fighter: don't bother
    expect(mental(wiz)).toBeGreaterThan(abilityMod(wiz.abilities.str)); // wizard: worth it
  });

  it('reaches as far as the weapon does — a crossbow shoots across the board', () => {
    // The whole point of weaponAttack targeting: a static range on the spell
    // could be melee OR ranged, never both, and the same spell has to be both.
    const c = new Combat({
      seed: 5,
      mapId: 'open',
      combatants: [elf('cleric', 'team1', { x: 1, y: 1 }, 'cle'), human('fighter', 'team2', { x: 1, y: 6 }, 'foe')],
    });
    expect(c.state.combatants['cle']!.equipped.mainHand).toBe('light-crossbow');
    let guard = 0;
    while (c.activeId !== 'cle' && guard++ < 20) c.apply({ kind: 'endTurn' });

    // Five cells away — no melee spell could reach, but the crossbow does.
    const shot = legalActions(c.state, 'cle').some(
      (a) => a.kind === 'castSpell' && a.spellId === 'true-strike' &&
        a.targets[0] && 'combatantId' in a.targets[0] && a.targets[0].combatantId === 'foe',
    );
    expect(shot).toBe(true);

    const { events } = step(c.state, {
      kind: 'castSpell', spellId: 'true-strike', slotLevel: 0, targets: [{ combatantId: 'foe' }],
    });
    const attack = events.find((e) => e.type === 'attackRolled');
    expect(attack?.type === 'attackRolled' && attack.weaponId).toBe('light-crossbow');
    // Wisdom-guided, and proficiency-backed.
    if (attack?.type !== 'attackRolled') throw new Error('no shot');
    const cle = c.state.combatants['cle']!;
    expect(attack.total - attack.natural).toBe(abilityMod(cle.abilities.wis) + 2);
  });

  it('will not reach a target the weapon cannot: out of range is out of range', () => {
    // A staff-wielding elf can't True Strike someone across the room.
    const c = new Combat({
      seed: 5,
      mapId: 'open',
      combatants: [elf('wizard', 'team1', { x: 0, y: 0 }, 'wiz'), human('fighter', 'team2', { x: 7, y: 7 }, 'foe')],
    });
    // Swap the daggers (thrown, 60 ft) for a pure-melee staff.
    const wiz = c.state.combatants['wiz']!;
    wiz.equipped.mainHand = 'quarterstaff';
    delete wiz.equipped.offHand;
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const reaches = legalActions(c.state, 'wiz').some(
      (a) => a.kind === 'castSpell' && a.spellId === 'true-strike',
    );
    expect(reaches).toBe(false);
  });

  it('does nothing with an empty hand rather than throwing', () => {
    const c = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [elf('wizard', 'team1', { x: 3, y: 3 }, 'wiz'), human('fighter', 'team2', { x: 3, y: 4 }, 'foe')],
    });
    delete c.state.combatants['wiz']!.equipped.mainHand;
    delete c.state.combatants['wiz']!.equipped.offHand;
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const legal = legalActions(c.state, 'wiz').some(
      (a) => a.kind === 'castSpell' && a.spellId === 'true-strike',
    );
    expect(legal).toBe(false);   // nothing in hand to guide
  });
});

describe('keen senses', () => {
  it('makes an elf better at spotting a hidden creature than anyone else', () => {
    // Passive Perception ignored proficiency entirely, so every creature in the
    // game was equally good at looking. Now the elf is the party's lookout.
    const c = new Combat({
      seed: 6,
      mapId: 'open',
      combatants: [
        elf('cleric', 'team1', { x: 1, y: 1 }, 'elf-cle'),
        human('cleric', 'team1', { x: 2, y: 1 }, 'hum-cle'),
        human('rogue', 'team2', { x: 6, y: 6 }, 'rog'),
      ],
    });
    const rogue = c.state.combatants['rog']!;
    // A hide check the elf's proficiency clears and the human's does not.
    const elfSees = (dc: number) => {
      rogue.conditions = [{ id: 'hidden', sourceId: 'rog', hideCheck: dc } as never];
      return discoverHidden(c.state, 'elf-cle').length > 0;
    };
    const humanSees = (dc: number) => {
      rogue.conditions = [{ id: 'hidden', sourceId: 'rog', hideCheck: dc } as never];
      return discoverHidden(c.state, 'hum-cle').length > 0;
    };
    // Same Wisdom, so only proficiency (+2 at level 3) can separate them.
    expect(c.state.combatants['elf-cle']!.abilities.wis).toBe(c.state.combatants['hum-cle']!.abilities.wis);
    const base = 15 + abilityMod(c.state.combatants['hum-cle']!.abilities.wis);
    expect(humanSees(base)).toBe(false);      // ties don't reveal
    expect(elfSees(base)).toBe(true);         // +2 proficiency clears it
  });

  it('makes the elf the party\'s choice for a perception check', () => {
    expect(skillBonus('fighter', 3, 'perception', 'elf'))
      .toBeGreaterThan(skillBonus('fighter', 3, 'perception', 'human'));
  });
});
