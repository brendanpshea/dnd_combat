/**
 * The 2024 cleric's defensive list: Sanctuary, Protection from Evil and Good,
 * Warding Bond, Protection from Energy, Bestow Curse.
 *
 * All five are on the SRD 5.2 cleric spell list (verified against the class
 * entry, not from memory — two earlier candidates, Toll the Dead and Word of
 * Radiance, turned out to be PHB-only and were dropped).
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { SPELLS, threateningElement } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { applyDamage, resolveAttack } from '../src/engine/rules/attack.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { CLASSES } from '../src/data/classes.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id });
const foe = (monsterId: string, position: Position, id: string): Combatant =>
  ({ ...buildMonster(monsterId, 'team2', position), id });

/** Cast a spell straight through its hook, bypassing turn order. */
function cast(c: Combat, spellId: string, casterId: string, targetIds: string[]) {
  return SPELLS[spellId]!.cast({
    state: c.state, casterId, slotLevel: SPELLS[spellId]!.level, targetIds, positions: [],
  });
}

describe('cleric spell list', () => {
  it('every spell the cleric class grants actually exists', () => {
    const byLevel = CLASSES['cleric']!.spellcasting!.spellsByLevel;
    for (const ids of Object.values(byLevel)) {
      for (const id of ids) expect(SPELLS[id], `${id} is on the cleric list but not implemented`).toBeDefined();
    }
  });

  it('the new spells are on the list at the level their slots arrive', () => {
    const byLevel = CLASSES['cleric']!.spellcasting!.spellsByLevel;
    expect(byLevel[1]).toEqual(expect.arrayContaining(['sanctuary', 'protection-from-evil-and-good']));
    expect(byLevel[3]).toContain('warding-bond');
    expect(byLevel[5]).toEqual(expect.arrayContaining(['protection-from-energy', 'bestow-curse']));
  });
});

describe('Sanctuary', () => {
  it('an attacker that fails its save loses the attack entirely — no roll, no damage', () => {
    let warded = 0;
    let hurt = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig'), foe('ogre', { x: 3, y: 2 }, 'ogre')],
      });
      cast(c, 'sanctuary', 'cle', ['fig']);
      const before = c.state.combatants['fig']!.hp;
      const events = resolveAttack(c.state, 'ogre', 'fig', 'greatclub');
      if (events.some((e) => e.type === 'attackWarded')) {
        warded += 1;
        expect(events.some((e) => e.type === 'attackRolled'), 'a warded attack is never rolled').toBe(false);
        expect(c.state.combatants['fig']!.hp, 'a warded attack deals nothing').toBe(before);
      } else if (c.state.combatants['fig']!.hp < before) {
        hurt += 1;
      }
    }
    expect(warded, 'the ward should turn some attacks aside').toBeGreaterThan(0);
    expect(hurt, 'and let others through — it is a save, not immunity').toBeGreaterThan(0);
  });

  it('attacking breaks your own sanctuary', () => {
    const c = new Combat({
      seed: 3,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig'), foe('ogre', { x: 3, y: 2 }, 'ogre')],
    });
    cast(c, 'sanctuary', 'cle', ['fig']);
    expect(c.state.combatants['fig']!.conditions.some((k) => k.id === 'sanctuary')).toBe(true);
    resolveAttack(c.state, 'fig', 'ogre', 'greatsword');
    expect(c.state.combatants['fig']!.conditions.some((k) => k.id === 'sanctuary'),
      'you cannot swing and stay untouchable').toBe(false);
  });

  it('but healing an ally does not', () => {
    const c = new Combat({
      seed: 3,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig'), foe('ogre', { x: 6, y: 5 }, 'ogre')],
    });
    cast(c, 'sanctuary', 'cle', ['cle']);
    c.state.combatants['fig']!.hp = 5;
    while (c.activeId !== 'cle') c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'castSpell', spellId: 'healing-word', slotLevel: 1, targets: [{ combatantId: 'fig' }] });
    expect(c.state.combatants['cle']!.conditions.some((k) => k.id === 'sanctuary'),
      'an ally-only spell is not an act of aggression').toBe(true);
  });

  it('and attacking with a spell does', () => {
    const c = new Combat({
      seed: 3,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), foe('ogre', { x: 4, y: 1 }, 'ogre')],
    });
    cast(c, 'sanctuary', 'cle', ['cle']);
    while (c.activeId !== 'cle') c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'castSpell', spellId: 'sacred-flame', slotLevel: 0, targets: [{ combatantId: 'ogre' }] });
    expect(c.state.combatants['cle']!.conditions.some((k) => k.id === 'sanctuary'),
      'a warded cleric must not be able to shell the board forever').toBe(false);
  });
});

describe('Protection from Evil and Good', () => {
  it('gives the six listed types disadvantage, and everyone else nothing', () => {
    const roll = (monsterId: string, weaponId: string) => {
      const c = new Combat({
        seed: 5,
        combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig'), foe(monsterId, { x: 3, y: 2 }, 'm')],
      });
      cast(c, 'protection-from-evil-and-good', 'cle', ['fig']);
      const events = resolveAttack(c.state, 'm', 'fig', weaponId);
      const atk = events.find((e) => e.type === 'attackRolled');
      return atk?.type === 'attackRolled' ? atk.disSources : [];
    };
    // Ghoul is undead; ogre is a giant.
    expect(roll('ghoul', 'ghoul-claws')).toContain('protection from evil and good');
    expect(roll('ogre', 'greatclub')).not.toContain('protection from evil and good');
  });
});

describe('Warding Bond', () => {
  it('halves what reaches the ally and puts the other half on the cleric', () => {
    const c = new Combat({
      seed: 7,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig')],
    });
    cast(c, 'warding-bond', 'cle', ['fig']);
    const figBefore = c.state.combatants['fig']!.hp;
    const cleBefore = c.state.combatants['cle']!.hp;
    applyDamage(c.state, 'fig', 'nobody', 20, 'slashing');
    expect(figBefore - c.state.combatants['fig']!.hp, 'the ally takes half').toBe(10);
    expect(cleBefore - c.state.combatants['cle']!.hp, 'the cleric takes the rest').toBe(10);
  });

  it('adds +1 AC and +1 to saves', () => {
    const c = new Combat({
      seed: 7,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig')],
    });
    const acBefore = acOf(c.state.combatants['fig']!);
    cast(c, 'warding-bond', 'cle', ['fig']);
    expect(acOf(c.state.combatants['fig']!)).toBe(acBefore + 1);
    // Same seed, same roll: the bonded save must come out one higher.
    const bonded = savingThrow(c.state, 'fig', 'wis', 15);
    c.state.combatants['fig']!.conditions = [];
    const plain = savingThrow({ ...c.state, rng: c.state.rng }, 'fig', 'wis', 15);
    expect(bonded.event.type === 'savingThrow' && plain.event.type === 'savingThrow' &&
      bonded.event.total - bonded.event.natural).toBe(
      plain.event.type === 'savingThrow' ? plain.event.total - plain.event.natural + 1 : NaN);
  });

  it('does not bounce a blow back and forth between two bonded casters', () => {
    const c = new Combat({
      seed: 7,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'a'), pc('cleric', 5, { x: 2, y: 2 }, 'b')],
    });
    // Deliberately pathological: each carries the other.
    cast(c, 'warding-bond', 'a', ['b']);
    cast(c, 'warding-bond', 'b', ['a']);
    const total = () => c.state.combatants['a']!.hp + c.state.combatants['b']!.hp;
    const before = total();
    applyDamage(c.state, 'b', 'nobody', 20, 'slashing');
    expect(before - total(), 'a mutual bond must not multiply or erase damage').toBe(20);
  });

  it('ends the moment the cleric goes down, and the ally feels the whole blow', () => {
    const c = new Combat({
      seed: 7,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig')],
    });
    cast(c, 'warding-bond', 'cle', ['fig']);
    applyDamage(c.state, 'cle', 'nobody', 999, 'slashing');   // the cleric drops
    const figBefore = c.state.combatants['fig']!.hp;
    applyDamage(c.state, 'fig', 'nobody', 20, 'slashing');
    expect(figBefore - c.state.combatants['fig']!.hp, 'nobody is carrying them any more').toBe(20);
    expect(c.state.combatants['fig']!.conditions.some((k) => k.id === 'bonded')).toBe(false);
  });
});

describe('Protection from Energy', () => {
  it('halves the warded element and leaves the others alone', () => {
    const c = new Combat({
      seed: 9,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig'), foe('young-white', { x: 6, y: 5 }, 'drg')],
    });
    cast(c, 'protection-from-energy', 'cle', ['fig']);
    const ward = c.state.combatants['fig']!.conditions.find((k) => k.id === 'energyWarded');
    expect(ward?.damageType, 'a white dragon breathes cold, so that is what it should ward').toBe('cold');
    let hp = c.state.combatants['fig']!.hp;
    applyDamage(c.state, 'fig', 'drg', 20, 'cold');
    expect(hp - c.state.combatants['fig']!.hp).toBe(10);
    hp = c.state.combatants['fig']!.hp;
    applyDamage(c.state, 'fig', 'drg', 20, 'fire');
    expect(hp - c.state.combatants['fig']!.hp, 'it wards one element, not all of them').toBe(20);
  });

  it('picks the element the enemies can actually deal, and falls back to fire', () => {
    const board = (monsterId: string) => {
      const c = new Combat({
        seed: 9,
        combatants: [pc('fighter', 5, { x: 2, y: 2 }, 'fig'), foe(monsterId, { x: 6, y: 5 }, 'm')],
      });
      return threateningElement(c.state, c.state.combatants['fig']!);
    };
    expect(board('young-white')).toBe('cold');
    expect(board('young-red')).toBe('fire');
    expect(board('skeleton'), 'nothing elemental on the board — the fallback').toBe('fire');
  });
});

describe('Bestow Curse', () => {
  it('a cursed creature attacks and saves at disadvantage', () => {
    const c = new Combat({
      seed: 11,
      combatants: [pc('cleric', 5, { x: 1, y: 1 }, 'cle'), pc('fighter', 5, { x: 2, y: 2 }, 'fig'), foe('ogre', { x: 3, y: 2 }, 'ogre')],
    });
    // Force the curse to land rather than fishing for a seed.
    c.state.combatants['ogre']!.abilities.wis = 1;
    let landed = false;
    for (let i = 0; i < 20 && !landed; i++) {
      cast(c, 'bestow-curse', 'cle', ['ogre']);
      landed = c.state.combatants['ogre']!.conditions.some((k) => k.id === 'cursed');
    }
    expect(landed, 'a wis-1 ogre should fail this inside twenty casts').toBe(true);

    const events = resolveAttack(c.state, 'ogre', 'fig', 'greatclub');
    const atk = events.find((e) => e.type === 'attackRolled');
    expect(atk?.type === 'attackRolled' && atk.disSources).toContain('cursed');

    // And the save side: over many rolls the cursed creature does worse.
    let cursedPasses = 0;
    for (let i = 0; i < 60; i++) if (savingThrow(c.state, 'ogre', 'con', 12).success) cursedPasses += 1;
    c.state.combatants['ogre']!.conditions = [];
    let freePasses = 0;
    for (let i = 0; i < 60; i++) if (savingThrow(c.state, 'ogre', 'con', 12).success) freePasses += 1;
    expect(cursedPasses, 'disadvantage has to show up in the saves too').toBeLessThan(freePasses);
  });
});
