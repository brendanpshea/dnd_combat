import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { legalActions } from '../src/engine/actions.js';
import { ITEMS, isCharged } from '../src/data/items.js';
import { WEAPONS, VICIOUS_WEAPONS, weaponCategory, baseWeaponId } from '../src/data/weapons.js';
import { TRINKETS } from '../src/data/trinkets.js';
import {
  newCampaign, buildCampaignParty, longRest, readBackSurvivors, rarityOf, SHOP_STOCK,
} from '../src/campaign/campaign.js';
import { parseMap, type MapData } from '../src/data/maps.js';
import type { Combatant, Id } from '../src/engine/types.js';

/**
 * Wands: a scroll you get to keep.
 *
 * The difference matters more than it sounds. A scroll is a decision made once,
 * at the moment you spend it; a wand is a decision made every turn of every
 * fight until it runs dry. Charges refill on a long rest and the arena rests
 * between every wave, so a wand is a per-wave resource — something for a caster
 * to spend when the slots are gone, and something for the classes with no slots
 * at all to cast.
 */

const board = (rows: string[]): MapData => ({ id: 't', name: 'T', theme: 'stone', rows });
const OPEN = ['........', '........', '........', '........', '........'];

function wielder(classId: string, itemId: Id, level = 5): { c: Combat; hero: Combatant } {
  const hero = buildCharacter({
    classId, team: 'team1', level, name: 'H', position: { x: 1, y: 0 }, speciesId: 'human',
    inventory: [{ itemId, qty: 1 }],
  });
  const foe = buildCharacter({
    classId: 'fighter', team: 'team2', level, name: 'F', position: { x: 5, y: 4 }, speciesId: 'human',
  });
  const c = new Combat({ seed: 3, map: board(OPEN), combatants: [hero, { ...foe, id: 'foe' }] });
  for (let i = 0; i < 20 && c.activeId !== hero.id; i++) c.apply({ kind: 'endTurn' });
  return { c, hero };
}

const wandActions = (c: Combat, id: Id, itemId: Id) =>
  legalActions(c.state, id).filter((a) => a.kind === 'useItem' && a.itemId === itemId);

describe('charges', () => {
  it('start full for a carried wand and are spent, not consumed', () => {
    const { c, hero } = wielder('wizard', 'wand-fireballs');
    const pool = c.state.combatants[hero.id]!.itemUses!['wand-fireballs']!;
    expect(pool).toEqual({ current: 7, max: 7 });

    const shot = wandActions(c, hero.id, 'wand-fireballs')[0];
    expect(shot, 'the wand offered nothing to do').toBeDefined();
    c.apply(shot!);

    const after = c.state.combatants[hero.id]!;
    expect(after.itemUses!['wand-fireballs']!.current, 'a charge went').toBe(6);
    expect(after.inventory.find((s) => s.itemId === 'wand-fireballs')?.qty,
      'the wand itself must survive being used').toBe(1);
  });

  it('run out, and an empty wand offers nothing', () => {
    const { c, hero } = wielder('wizard', 'wand-fireballs');
    c.state.combatants[hero.id]!.itemUses!['wand-fireballs']!.current = 0;
    expect(wandActions(c, hero.id, 'wand-fireballs')).toEqual([]);
  });

  it('come back on a long rest, and survive a fight in between', () => {
    const camp = newCampaign(4);
    camp.characters[0]!.inventory.push({ itemId: 'wand-fireballs', qty: 1 });
    const party = buildCampaignParty(camp);
    expect(party[0]!.itemUses!['wand-fireballs']!.current).toBe(7);

    // Spend three, then walk out of the fight.
    party[0]!.itemUses!['wand-fireballs']!.current = 4;
    readBackSurvivors(camp, party);
    expect(camp.characters[0]!.resources?.itemCharges?.['wand-fireballs'],
      'a spent wand is remembered').toBe(4);
    expect(buildCampaignParty(camp)[0]!.itemUses!['wand-fireballs']!.current).toBe(4);

    longRest(camp);
    expect(camp.characters[0]!.resources?.itemCharges, 'a rest clears the record').toBeUndefined();
    expect(buildCampaignParty(camp)[0]!.itemUses!['wand-fireballs']!.current,
      'and the wand comes back charged').toBe(7);
  });

  /**
   * A conjuration is once per RUN, not once per rest. The arena rests between
   * every wave, so "once per rest" would have put a CR 5 elemental in every
   * fight — measured at +20 points of win rate, the largest single item effect
   * in the game.
   */
  it('does not refill a once-per-run item on a long rest', () => {
    const camp = newCampaign(4);
    camp.characters[0]!.inventory.push({ itemId: 'brazier-fire-elemental', qty: 1 });
    const party = buildCampaignParty(camp);
    expect(party[0]!.itemUses!['brazier-fire-elemental']!.current).toBe(1);

    party[0]!.itemUses!['brazier-fire-elemental']!.current = 0;
    readBackSurvivors(camp, party);
    longRest(camp);
    expect(camp.characters[0]!.resources?.itemCharges?.['brazier-fire-elemental'],
      'the brazier recharged over a night\'s sleep').toBe(0);
    expect(buildCampaignParty(camp)[0]!.itemUses!['brazier-fire-elemental']!.current).toBe(0);
  });

  it('still refills an ordinary wand alongside it', () => {
    // The kept-charges filter must not become "keep everything".
    const camp = newCampaign(4);
    camp.characters[0]!.inventory.push({ itemId: 'wand-fireballs', qty: 1 });
    camp.characters[0]!.inventory.push({ itemId: 'brazier-fire-elemental', qty: 1 });
    const party = buildCampaignParty(camp);
    party[0]!.itemUses!['wand-fireballs']!.current = 2;
    party[0]!.itemUses!['brazier-fire-elemental']!.current = 0;
    readBackSurvivors(camp, party);
    longRest(camp);
    const after = buildCampaignParty(camp)[0]!;
    expect(after.itemUses!['wand-fireballs']!.current, 'the wand should come back').toBe(7);
    expect(after.itemUses!['brazier-fire-elemental']!.current, 'the brazier should not').toBe(0);
  });

  /**
   * `itemUses` is built from the inventory `buildCharacter` is handed, so a wand
   * pushed onto an already-built combatant has no pool. The strict reading made
   * that wand permanently unusable with nothing to say why — and because the
   * campaign always rebuilds from the roster, it only ever bit hand-built
   * combatants, which is to say tests and measurement scripts. It cost a
   * measurement that read +0.0% for four items that had never fired once.
   */
  it('treats a missing charge pool as full rather than as empty', () => {
    const { c, hero } = wielder('wizard', 'wand-fireballs');
    delete c.state.combatants[hero.id]!.itemUses;
    const shot = wandActions(c, hero.id, 'wand-fireballs')[0];
    expect(shot, 'a wand with no pool was unusable').toBeDefined();
    c.apply(shot!);
    expect(c.state.combatants[hero.id]!.itemUses!['wand-fireballs']!.current,
      'and firing it must create the pool, or it fires forever').toBe(6);
  });

  it('records nothing for a wand that was never fired', () => {
    // "Absent means full" is the same signal HP and slots use; writing a full
    // pool into the save would quietly break that convention for everything.
    const camp = newCampaign(4);
    camp.characters[0]!.inventory.push({ itemId: 'wand-web', qty: 1 });
    readBackSurvivors(camp, buildCampaignParty(camp));
    expect(camp.characters[0]!.resources?.itemCharges).toBeUndefined();
  });
});

describe('who may use which wand', () => {
  it('lets a fighter fire a Wand of Magic Missiles', () => {
    // It needs no attunement in the SRD, which is exactly what makes it worth a
    // martial character's pack slot — the only levelled spell most will cast.
    const { c, hero } = wielder('fighter', 'wand-magic-missiles');
    expect(wandActions(c, hero.id, 'wand-magic-missiles').length).toBeGreaterThan(0);
  });

  it('does not let a fighter use one that needs a spellcaster', () => {
    for (const itemId of ['wand-web', 'wand-fireballs', 'wand-lightning-bolts'] as Id[]) {
      const { c, hero } = wielder('fighter', itemId);
      expect(wandActions(c, hero.id, itemId), `a fighter fired ${itemId}`).toEqual([]);
    }
  });

  it('ignores the class spell list a scroll is bound by', () => {
    // A cleric cannot read a Scroll of Fireball — it is not on the cleric list.
    // A Wand of Fireballs does not care: the magic is in the wand.
    const scroll = wielder('cleric', 'scroll-fireball');
    expect(wandActions(scroll.c, scroll.hero.id, 'scroll-fireball')).toEqual([]);
    const wand = wielder('cleric', 'wand-fireballs');
    expect(wandActions(wand.c, wand.hero.id, 'wand-fireballs').length).toBeGreaterThan(0);
  });
});

describe('Wand of the War Mage', () => {
  it('adds its bonus to spell attack rolls only', () => {
    const plain = buildCharacter({ classId: 'wizard', team: 'team1', level: 5, position: { x: 0, y: 0 } });
    const armed = buildCharacter({
      classId: 'wizard', team: 'team1', level: 5, position: { x: 0, y: 0 },
      equipped: { mainHand: 'dagger', trinket: 'wand-war-mage-2' },
    });
    expect(armed.featureIds).toContain('war-mage-2');
    expect(plain.featureIds).not.toContain('war-mage-2');
  });

  it('only ships the grades the game has a rarity for', () => {
    // +3 is Very Rare in the SRD, a tier with no levels to reach it here.
    expect(TRINKETS['wand-war-mage-1']!.rarity).toBe('uncommon');
    expect(TRINKETS['wand-war-mage-2']!.rarity).toBe('rare');
    expect(TRINKETS['wand-war-mage-3']).toBeUndefined();
  });
});

/**
 * Half cover applies to a ranged spell attack exactly as it does to an arrow.
 * It did not until now: a Fire Bolt across a barricade was unpenalised while a
 * shortbow shot at the same target took +2 AC, so the one piece of terrain
 * built to shape ranged fire was shaping only half of it.
 */
describe('spell attacks and cover', () => {
  const COVERED = ['........', '........', '...+....', '........', '........'];

  function fireBoltAc(over: Partial<Combatant> = {}, rows = COVERED): number {
    const caster = {
      ...buildCharacter({ classId: 'wizard', team: 'team1', level: 5, position: { x: 3, y: 0 } }),
      ...over, id: 'w',
    };
    const target = buildCharacter({ classId: 'rogue', team: 'team2', level: 5, position: { x: 3, y: 4 } });
    const c = new Combat({ seed: 2, map: board(rows), combatants: [caster, { ...target, id: 'tg' }] });
    for (let i = 0; i < 20 && c.activeId !== 'w'; i++) c.apply({ kind: 'endTurn' });
    const evs = c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'tg' }] });
    const roll = evs.find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error('no spell attack');
    return roll.targetAc;
  }

  it('charges a spell attack the same +2 an arrow pays', () => {
    expect(fireBoltAc({}, COVERED) - fireBoltAc({}, OPEN)).toBe(2);
  });

  it('is what the Wand of the War Mage buys off', () => {
    const armed = buildCharacter({
      classId: 'wizard', team: 'team1', level: 5, position: { x: 3, y: 0 },
      equipped: { mainHand: 'dagger', trinket: 'wand-war-mage-1' },
    });
    expect(fireBoltAc({ featureIds: armed.featureIds }, COVERED),
      'the wand ignores half cover').toBe(fireBoltAc({}, OPEN));
  });
});

describe('vicious weapons', () => {
  it('deal a flat extra 2d6 and carry no attack bonus', () => {
    for (const id of VICIOUS_WEAPONS) {
      const w = WEAPONS[id]!;
      expect(w.extraDamage, id).toEqual({ dice: '2d6', type: WEAPONS[baseWeaponId(id)]!.damageType });
      expect(w.attackBonus, `${id} should have no +N`).toBeUndefined();
      expect(w.damageBonus, `${id} should have no +N`).toBeUndefined();
      expect(weaponCategory(id), `${id} has no category`).toBeDefined();
    }
  });

  it('are the pick when you do not know what is coming', () => {
    // The contrast that makes both worth having: a slayer is +1 always and
    // +3d6 sometimes; a vicious weapon is +0 always and +2d6 always. Against
    // the wrong target the vicious one wins, and against its quarry it loses.
    const slayer = WEAPONS['dragon-slayer']!;
    const vicious = WEAPONS['vicious-longsword']!;
    const avg = (dice: string) => Number(dice.split('d')[0]) * (Number(dice.split('d')[1]) + 1) / 2;
    const viciousAlways = avg('2d6');
    const slayerOffTarget = slayer.damageBonus ?? 0;
    expect(viciousAlways).toBeGreaterThan(slayerOffTarget);
    expect(avg(slayer.slays!.dice) + (slayer.damageBonus ?? 0)).toBeGreaterThan(viciousAlways);
  });
});

describe('everything new reaches a player', () => {
  it('stocks every wand and vicious weapon, at a sane rarity', () => {
    const wands = Object.values(ITEMS).filter(isCharged).map((i) => i.id);
    expect(wands.length).toBeGreaterThanOrEqual(4);
    for (const id of [...wands, ...VICIOUS_WEAPONS, 'wand-war-mage-1', 'wand-war-mage-2']) {
      expect(SHOP_STOCK, `${id} is not stocked`).toContain(id);
      expect(['uncommon', 'rare']).toContain(rarityOf(id));
    }
  });

  it('sanity: the test board parses', () => {
    expect(parseMap(board(OPEN)).width).toBe(8);
  });
});
