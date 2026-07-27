import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { WEAPONS, weaponCategory, isWeaponProficient, baseWeaponId } from '../src/data/weapons.js';
import { chooseAction } from '../src/ai/greedy.js';
import { rarityOf, isObtainable } from '../src/campaign/campaign.js';
import { parseMap, type MapData } from '../src/data/maps.js';
import type { Combatant, CreatureType, Id } from '../src/engine/types.js';

/**
 * Bane weapons: extra dice, but only against the creature types they were made
 * for.
 *
 * The conditional IS the design. A Dragon Slayer swung at a goblin is a
 * longsword +1, so carrying one is a decision made from the gate cards rather
 * than a strict upgrade — and that means the two things worth testing hardest
 * are that the rider fires against the right types and that it stays silent
 * against everything else.
 */

const SLAYERS: Id[] = ['dragon-slayer', 'giant-slayer', 'sun-blade', 'mace-of-disruption', 'mace-of-smiting'];
const board = (rows: string[]): MapData => ({ id: 't', name: 'T', theme: 'stone', rows });
const ROWS = ['....', '....', '....'];

/** Swing `weaponId` at `monsterId` until something connects; report the hit. */
function swing(weaponId: Id, monsterId: Id, seed = 1): { total: number; tags: string[]; types: string[] } {
  const hero = buildCharacter({
    classId: 'fighter', team: 'team1', level: 5, name: 'H',
    position: { x: 1, y: 1 }, speciesId: 'human',
  });
  hero.equipped.mainHand = weaponId;
  for (let s = seed; s < seed + 60; s++) {
    const foe = { ...buildMonster(monsterId, 'team2', { x: 2, y: 1 }), id: 'foe', hp: 9999, maxHp: 9999 };
    const c = new Combat({ seed: s, map: board(ROWS), combatants: [hero, foe] });
    for (let i = 0; i < 20 && c.activeId !== hero.id; i++) c.apply({ kind: 'endTurn' });
    if (c.activeId !== hero.id) continue;
    const events = c.apply({ kind: 'attack', weaponId, targetId: 'foe' });
    const roll = events.find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled' || !roll.hit || roll.crit) continue;   // crits double dice
    const dmg = events.filter((e) => e.type === 'damageDealt');
    return {
      total: dmg.reduce((n, e) => n + (e.type === 'damageDealt' ? e.amount : 0), 0),
      tags: dmg.flatMap((e) => (e.type === 'damageDealt' ? e.tags ?? [] : [])),
      types: dmg.map((e) => (e.type === 'damageDealt' ? e.damageType : '')),
    };
  }
  throw new Error(`${weaponId} never landed a normal hit on ${monsterId}`);
}

/** A monster of the given type that exists in the bestiary. */
function someMonsterOf(type: CreatureType): Id {
  const m = Object.values(MONSTERS).find((x) => x.creatureType === type);
  if (!m) throw new Error(`no ${type} in the bestiary`);
  return m.id;
}

describe('the bane rider', () => {
  it('fires against the type it names and stays silent otherwise', () => {
    // Same weapon, same level, two targets. Only the creature type differs.
    const dragon = swing('dragon-slayer', someMonsterOf('dragon'));
    const other = swing('dragon-slayer', someMonsterOf('beast'));
    expect(dragon.tags, 'the rider should name itself in the log').toContain('Dragon Slayer');
    expect(other.tags, 'a beast is not a dragon').not.toContain('Dragon Slayer');
    expect(dragon.total, `${dragon.total} vs ${other.total}`).toBeGreaterThan(other.total);
  });

  it('covers every type each weapon names, not just the first', () => {
    // The Mace of Disruption names two. A rider that checked only types[0]
    // would pass every other test in this file.
    const undead = swing('mace-of-disruption', someMonsterOf('undead'));
    const fiend = swing('mace-of-disruption', someMonsterOf('fiend'));
    expect(undead.tags).toContain('Mace of Disruption');
    expect(fiend.tags).toContain('Mace of Disruption');
    expect(swing('mace-of-disruption', someMonsterOf('beast')).tags)
      .not.toContain('Mace of Disruption');
  });

  it('lands as the weapon\'s own damage type, or the one it names', () => {
    // The Slayers deal "damage of the weapon's type"; the Sun Blade and the
    // Mace of Disruption name radiant.
    expect(swing('giant-slayer', someMonsterOf('giant')).types).toContain('slashing');
    expect(swing('mace-of-disruption', someMonsterOf('undead')).types).toContain('radiant');
    const sun = swing('sun-blade', someMonsterOf('undead'));
    expect(sun.types.every((t) => t === 'radiant'), `${sun.types.join(', ')}`).toBe(true);
  });

  it('is not simply a better weapon — against the wrong target it is a +1', () => {
    const beast = someMonsterOf('beast');
    const slayer = swing('dragon-slayer', beast);
    const plus1 = swing('longsword-plus1', beast);
    expect(slayer.total, `slayer ${slayer.total} vs +1 ${plus1.total}`).toBe(plus1.total);
  });
});

describe('the weapons themselves', () => {
  it('are all rare, stocked, and priced above the +1 they beat', () => {
    for (const id of SLAYERS) {
      expect(rarityOf(id), id).toBe('rare');
      expect(isObtainable(id), `${id} cannot be obtained by any route`).toBe(true);
      expect(WEAPONS[id]!.cost!, id).toBeGreaterThan(WEAPONS['longsword-plus1']!.cost!);
    }
  });

  it('name creature types the bestiary actually fields', () => {
    // A bane weapon against a type nobody plays is dead data with a price tag.
    const population = new Map<string, number>();
    for (const m of Object.values(MONSTERS)) {
      population.set(m.creatureType ?? '?', (population.get(m.creatureType ?? '?') ?? 0) + 1);
    }
    for (const id of SLAYERS) {
      for (const t of WEAPONS[id]!.slays!.types) {
        expect(population.get(t) ?? 0, `${id} hunts ${t}, of which there are none`).toBeGreaterThan(3);
      }
    }
  });

  it('between them answer most of what a wave can field', () => {
    // The set exists for coverage, so assert the coverage rather than trusting
    // it: these five should cover a solid share of the bestiary by headcount.
    const covered = new Set(SLAYERS.flatMap((id) => WEAPONS[id]!.slays!.types));
    const total = Object.values(MONSTERS).length;
    const hit = Object.values(MONSTERS).filter((m) => covered.has(m.creatureType ?? '?' as CreatureType)).length;
    expect(hit / total, `${hit}/${total} of the bestiary is covered`).toBeGreaterThan(0.35);
  });

  /**
   * The silent-and-generous failure. `weaponCategory` returns undefined for an
   * id it doesn't recognise, and the proficiency check reads that as "natural
   * weapon — always proficient". So a named magic weapon missing from
   * NAMED_BASE would let a wizard swing a Dragon Slayer at full proficiency,
   * and nothing would look wrong.
   */
  it('resolve to a base weapon, so proficiency still means something', () => {
    for (const id of SLAYERS) {
      expect(weaponCategory(id), `${id} has no simple/martial category`).toBeDefined();
      expect(WEAPONS[baseWeaponId(id)], `${id} resolves to a base that does not exist`).toBeDefined();
    }
    const wizard = buildCharacter({
      classId: 'wizard', team: 'team1', level: 5, name: 'W',
      position: { x: 0, y: 0 }, speciesId: 'human',
    });
    expect(isWeaponProficient(wizard.weaponProfs, 'dragon-slayer'),
      'a wizard is not proficient with a longsword by any other name').toBe(false);
    const fighter = buildCharacter({
      classId: 'fighter', team: 'team1', level: 5, name: 'F',
      position: { x: 0, y: 0 }, speciesId: 'human',
    });
    expect(isWeaponProficient(fighter.weaponProfs, 'dragon-slayer')).toBe(true);
  });

  it('holds every magic weapon to the same rule, not just these five', () => {
    // The guard that survives the next named weapon somebody adds.
    const named = Object.values(WEAPONS).filter((w) => w.magic && w.cost !== undefined);
    for (const w of named) {
      expect(weaponCategory(w.id), `${w.id} has no category — proficiency would pass for anyone`)
        .toBeDefined();
    }
  });
});

/**
 * A weapon the AI cannot see the value of is dead data — and the arena drives
 * the party through these same policies, so a slayer the AI won't draw is a
 * slayer the player's own characters won't use.
 *
 * `attackableWeapons` counts stowed weapons as long as the turn's interaction
 * is unspent, so drawing the right sword is genuinely one of the actions on
 * offer. That is what makes this testable rather than hypothetical.
 */
describe('the AI can tell which weapon is which', () => {
  /** What the policy reaches for, holding one sword and carrying the other. */
  function weaponChosenAgainst(monsterId: Id): Id | undefined {
    const hero = buildCharacter({
      classId: 'fighter', team: 'team1', level: 5, name: 'H',
      position: { x: 1, y: 1 }, speciesId: 'human',
    });
    hero.equipped.mainHand = 'longsword-plus1';
    hero.inventory = [{ itemId: 'dragon-slayer', qty: 1 }];
    const foe = { ...buildMonster(monsterId, 'team2', { x: 2, y: 1 }), id: 'foe' };
    const c = new Combat({ seed: 4, map: board(ROWS), combatants: [hero, foe] });
    for (let i = 0; i < 20 && c.activeId !== hero.id; i++) c.apply({ kind: 'endTurn' });
    const a = chooseAction(c.state, hero.id);
    return a.kind === 'attack' ? a.weaponId : undefined;
  }

  it('draws the slayer for its quarry', () => {
    expect(weaponChosenAgainst(someMonsterOf('dragon'))).toBe('dragon-slayer');
  });

  it('leaves it stowed against everything else', () => {
    // Not merely "does not always draw it" — against a beast the rider is worth
    // nothing, so spending the interaction to swap would be a wasted action.
    expect(weaponChosenAgainst(someMonsterOf('beast'))).toBe('longsword-plus1');
  });

  it('prices a magic weapon at all, which it did not before', () => {
    // scoreAttack read neither attackBonus nor damageBonus, so a +1 longsword
    // and a plain one were indistinguishable to the policy. Regression guard.
    const hero = buildCharacter({
      classId: 'fighter', team: 'team1', level: 5, name: 'H',
      position: { x: 1, y: 1 }, speciesId: 'human',
    });
    hero.equipped.mainHand = 'longsword';
    hero.inventory = [{ itemId: 'longsword-plus1', qty: 1 }];
    const foe = { ...buildMonster(someMonsterOf('beast'), 'team2', { x: 2, y: 1 }), id: 'foe' };
    const c = new Combat({ seed: 4, map: board(ROWS), combatants: [hero, foe] });
    for (let i = 0; i < 20 && c.activeId !== hero.id; i++) c.apply({ kind: 'endTurn' });
    const a = chooseAction(c.state, hero.id);
    expect(a.kind === 'attack' ? a.weaponId : undefined).toBe('longsword-plus1');
  });
});
