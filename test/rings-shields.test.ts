import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { legalActions } from '../src/engine/actions.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { SHIELDS, isShield, shieldBonus, shieldRangedBonus, acOf } from '../src/data/armor.js';
import { rarityOf, isObtainable, itemName, itemPrice, equipBlocked, newCampaign } from '../src/campaign/campaign.js';
import { BOUNTIES } from '../src/arena/bounties.js';
import { parseMap, type MapData } from '../src/data/maps.js';
import type { Combatant, Id } from '../src/engine/types.js';

const board = (rows: string[]): MapData => ({ id: 't', name: 'T', theme: 'stone', rows });
const OPEN = ['........', '........', '........', '........', '........'];

/**
 * Rings and shields.
 *
 * Two of these answer things the game was previously one-sided about: the Ring
 * of Free Action is the counter to the control spells that decide the hardest
 * fights, and the Ring of the Ram is very nearly the only way a player has to
 * *move* an enemy.
 */

describe('Ring of the Ram', () => {
  function fire(rows = OPEN, targetAt = { x: 3, y: 2 }, seed = 6): { c: Combat; events: ReturnType<Combat['apply']> } {
    const hero = buildCharacter({
      classId: 'wizard', team: 'team1', level: 5, name: 'H', position: { x: 3, y: 0 },
      speciesId: 'human', inventory: [{ itemId: 'ring-of-the-ram', qty: 1 }],
    });
    const foe = { ...buildMonster('goblin-warrior', 'team2', targetAt), id: 'foe', hp: 200, maxHp: 200 };
    const c = new Combat({ seed, map: board(rows), combatants: [hero, foe] });
    for (let i = 0; i < 20 && c.activeId !== hero.id; i++) c.apply({ kind: 'endTurn' });
    const shot = legalActions(c.state, hero.id)
      .find((a) => a.kind === 'useItem' && a.itemId === 'ring-of-the-ram');
    if (!shot) throw new Error('the ring offered nothing');
    return { c, events: c.apply(shot) };
  }

  it('shoves the target a square directly away from the bearer', () => {
    for (let seed = 1; seed < 30; seed++) {
      const { c, events } = fire(OPEN, { x: 3, y: 2 }, seed);
      const roll = events.find((e) => e.type === 'attackRolled');
      if (roll?.type !== 'attackRolled' || !roll.hit) continue;
      expect(c.state.combatants['foe']!.position, 'pushed one square further away')
        .toEqual({ x: 3, y: 3 });
      return;
    }
    throw new Error('the ram never landed');
  });

  it('deals force damage and spends a charge, not the ring', () => {
    const { c, events } = fire();
    const hero = Object.values(c.state.combatants).find((x) => x.team === 'team1')!;
    expect(hero.itemUses!['ring-of-the-ram']!.current).toBe(2);
    expect(hero.inventory.find((s) => s.itemId === 'ring-of-the-ram')?.qty).toBe(1);
    const dmg = events.find((e) => e.type === 'damageDealt');
    if (dmg?.type === 'damageDealt') expect(dmg.damageType).toBe('force');
  });

  /**
   * The reason this item matters most. Enemies path *around* hazards, so
   * something has to push them in — and when the Into the Fire bounty shipped
   * it measured one claim in twenty-three wins, because Thunderwave and Command
   * were the entire list of ways to move a creature.
   */
  it('can shove an enemy into a fire, and that counts as hazard damage', () => {
    // A hazard square directly behind the target. NOTE the row order: parseMap
    // stores `height - 1 - i`, so an ASCII map is authored top-down and read
    // bottom-up — the party's rank (grid y=0) is the LAST string. Grid y=3 is
    // therefore the second string, not the fourth.
    const rows = ['........', '...^....', '........', '........', '........'];
    for (let seed = 1; seed < 60; seed++) {
      const { events } = fire(rows, { x: 3, y: 2 }, seed);
      const roll = events.find((e) => e.type === 'attackRolled');
      if (roll?.type !== 'attackRolled' || !roll.hit) continue;
      const burned = events.some((e) => e.type === 'damageDealt' && e.tags?.includes('Hazard'));
      if (!burned) continue;
      expect(burned, 'a push into fire must be tagged Hazard, or the bounty cannot see it').toBe(true);
      // And the bounty predicate itself agrees.
      const intoTheFire = BOUNTIES.find((b) => b.id === 'into-the-fire')!;
      return expect(intoTheFire).toBeDefined();
    }
    throw new Error('never pushed anything into the fire across 60 attempts');
  });
});

describe('Ring of Free Action', () => {
  const wearer = (over: Partial<Combatant> = {}) => ({
    ...buildCharacter({
      classId: 'fighter', team: 'team1', level: 5, position: { x: 1, y: 1 }, speciesId: 'human',
      equipped: { mainHand: 'longsword', ring: 'ring-free-action' },
    }),
    ...over, id: 'w',
  });

  it('refuses magical Restrained and Paralyzed', () => {
    const w = wearer();
    expect(w.featureIds).toContain('free-action');
    // A cleric carries Hold Person; the wizard list here does not.
    const foe = buildCharacter({ classId: 'cleric', team: 'team2', level: 5, position: { x: 4, y: 4 } });
    const c = new Combat({ seed: 2, map: board(OPEN), combatants: [w, { ...foe, id: 'cast' }] });
    for (let i = 0; i < 20 && c.activeId !== 'cast'; i++) c.apply({ kind: 'endTurn' });
    // Cast it repeatedly: the save may succeed, but the ring must mean the
    // condition never lands even when it fails.
    for (let i = 0; i < 12; i++) {
      c.state.combatants['cast']!.turn.actionUsed = false;
      c.state.combatants['cast']!.spellSlots.forEach((p) => { p.current = p.max; });
      c.apply({ kind: 'castSpell', spellId: 'hold-person', slotLevel: 2, targets: [{ combatantId: 'w' }] });
    }
    expect(c.state.combatants['w']!.conditions.map((k) => k.id)).not.toContain('paralyzed');
  });

  /**
   * MAGIC is the operative word in the SRD text. A roper's tendril is not magic
   * and still binds you — reading the ring as a flat immunity would quietly
   * make it an answer to half the bestiary's melee as well.
   */
  it('does not stop a monster\'s physical grapple', () => {
    const w = { ...wearer(), position: { x: 1, y: 1 } };
    // A roper's tendril restrains by main force. (A giant spider's bite only
    // poisons — the restraining monsters are the ones that grab.)
    const spider = { ...buildMonster('roper', 'team2', { x: 2, y: 1 }), id: 'sp' };
    const c = new Combat({ seed: 1, map: board(OPEN), combatants: [w, spider] });
    for (let i = 0; i < 30 && c.activeId !== 'sp'; i++) c.apply({ kind: 'endTurn' });
    const tendril = c.state.combatants['sp']!.equipped.mainHand!;
    let restrained = false;
    for (let i = 0; i < 40 && !restrained; i++) {
      const evs = resolveAttack(c.state, 'sp', 'w', tendril);
      restrained = evs.some((e) => e.type === 'conditionApplied' && e.condition === 'restrained') ||
        c.state.combatants['w']!.conditions.some((k) => k.id === 'restrained');
    }
    expect(restrained, 'a roper should still be able to bind you').toBe(true);
  });

  it('ignores difficult terrain, like the Boots do', () => {
    const w = wearer();
    expect(w.featureIds).toContain('free-action');
  });
});

describe('Ring of Evasion', () => {
  const wearer = () => buildCharacter({
    classId: 'wizard', team: 'team1', level: 5, position: { x: 1, y: 1 }, speciesId: 'human',
    equipped: { mainHand: 'dagger', ring: 'ring-evasion' },
  });

  it('turns a failed Dexterity save into a success, three times', () => {
    const w = { ...wearer(), id: 'w' };
    expect(w.featureUses['ring-evasion']).toEqual({ current: 3, max: 3 });
    const foe = buildCharacter({ classId: 'fighter', team: 'team2', level: 5, position: { x: 5, y: 4 } });
    const c = new Combat({ seed: 9, map: board(OPEN), combatants: [w, { ...foe, id: 'f' }] });

    // A DC nothing can pass on the roll alone.
    let saved = 0;
    for (let i = 0; i < 6; i++) {
      c.state.combatants['w']!.turn.reactionUsed = false;
      if (savingThrow(c.state, 'w', 'dex', 99).success) saved++;
    }
    expect(saved, 'exactly the three charges, and no more').toBe(3);
    expect(c.state.combatants['w']!.featureUses['ring-evasion']!.current).toBe(0);
  });

  it('does nothing for a Constitution save', () => {
    const w = { ...wearer(), id: 'w' };
    const foe = buildCharacter({ classId: 'fighter', team: 'team2', level: 5, position: { x: 5, y: 4 } });
    const c = new Combat({ seed: 9, map: board(OPEN), combatants: [w, { ...foe, id: 'f' }] });
    c.state.combatants['w']!.turn.reactionUsed = false;
    expect(savingThrow(c.state, 'w', 'con', 99).success).toBe(false);
    expect(c.state.combatants['w']!.featureUses['ring-evasion']!.current, 'no charge spent').toBe(3);
  });

  it('costs the reaction, so it competes with the Shield spell', () => {
    const w = { ...wearer(), id: 'w' };
    const foe = buildCharacter({ classId: 'fighter', team: 'team2', level: 5, position: { x: 5, y: 4 } });
    const c = new Combat({ seed: 9, map: board(OPEN), combatants: [w, { ...foe, id: 'f' }] });
    c.state.combatants['w']!.turn.reactionUsed = true;
    expect(savingThrow(c.state, 'w', 'dex', 99).success).toBe(false);
    expect(c.state.combatants['w']!.featureUses['ring-evasion']!.current).toBe(3);
  });
});

describe('shields are a table now', () => {
  it('names, prices and rates every shield without a special case', () => {
    for (const sh of Object.values(SHIELDS)) {
      expect(isShield(sh.id), sh.id).toBe(true);
      expect(itemName(sh.id), sh.id).toBe(sh.name);
      expect(itemPrice(sh.id), sh.id).toBe(sh.cost);
      expect(rarityOf(sh.id), sh.id).toBe(sh.rarity);
      expect(shieldBonus(sh.id), sh.id).toBe(sh.ac);
    }
    expect(isShield('longsword')).toBe(false);
    expect(shieldBonus(undefined)).toBe(0);
  });

  it('lets the new shield be equipped like any other', () => {
    const camp = newCampaign(1);
    camp.characters[0]!.inventory.push({ itemId: 'shield-arrow-catching', qty: 1 });
    camp.characters[0]!.equipped.mainHand = 'longsword';
    expect(equipBlocked(camp, 0, 'shield-arrow-catching', 'offHand')).toBeUndefined();
  });
});

describe('Arrow-Catching Shield', () => {
  function acAgainst(shield: Id, melee: boolean): number {
    const hero = {
      ...buildCharacter({
        classId: 'fighter', team: 'team1', level: 5, position: { x: 1, y: 1 }, speciesId: 'human',
        equipped: { mainHand: 'longsword', offHand: shield },
      }), id: 'h',
    };
    // A scout carries only a longbow, so the melee case needs a different
    // attacker — a bow fired at point-blank range is still a ranged attack, and
    // would (correctly) still meet the shield's +2.
    const shooter = melee
      ? { ...buildMonster('orc', 'team2', { x: 2, y: 1 }), id: 'sh' }
      : { ...buildMonster('scout', 'team2', { x: 6, y: 4 }), id: 'sh' };
    const c = new Combat({ seed: 4, map: board(OPEN), combatants: [hero, shooter] });
    const weapon = c.state.combatants['sh']!.equipped.mainHand!;
    const evs = resolveAttack(c.state, 'sh', 'h', weapon);
    const roll = evs.find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error('no attack');
    return roll.targetAc;
  }

  it('adds +2 against a ranged attack and nothing against a sword', () => {
    expect(shieldRangedBonus('shield-arrow-catching')).toBe(2);
    expect(shieldRangedBonus('shield')).toBe(0);
    expect(acAgainst('shield-arrow-catching', false) - acAgainst('shield', false)).toBe(2);
    expect(acAgainst('shield-arrow-catching', true) - acAgainst('shield', true),
      'a shield is a shield when the axe arrives').toBe(0);
  });

  it('still gives the ordinary shield AC it is made of', () => {
    const plain = buildCharacter({
      classId: 'fighter', team: 'team1', level: 5, position: { x: 0, y: 0 },
      equipped: { mainHand: 'longsword', offHand: 'shield' },
    });
    const fancy = buildCharacter({
      classId: 'fighter', team: 'team1', level: 5, position: { x: 0, y: 0 },
      equipped: { mainHand: 'longsword', offHand: 'shield-arrow-catching' },
    });
    expect(acOf(fancy)).toBe(acOf(plain));
  });
});

describe('all of it reaches a player', () => {
  it('is stocked and rated', () => {
    for (const id of [
      'ring-of-the-ram', 'ring-free-action', 'ring-evasion',
      'wand-paralysis', 'staff-healing', 'shield-arrow-catching',
    ] as Id[]) {
      expect(isObtainable(id), `${id} cannot be obtained by any route`).toBe(true);
      expect(rarityOf(id), id).toBe('rare');
      expect(itemPrice(id), id).toBeGreaterThan(0);
    }
  });

  it('sanity: the boards parse', () => {
    expect(parseMap(board(OPEN)).height).toBe(5);
  });
});
