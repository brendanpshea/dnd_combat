import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { legalActions } from '../src/engine/actions.js';
import { resolveAttack, collectAttackSources } from '../src/engine/rules/attack.js';
import { applyHealing } from '../src/engine/rules/heal.js';
import { WEAPONS, weaponCategory } from '../src/data/weapons.js';
import { TRINKETS } from '../src/data/trinkets.js';
import { newCampaign, equipBlocked, rarityOf, SHOP_STOCK } from '../src/campaign/campaign.js';
import { makeCombatant } from './helpers.js';
import type { MapData } from '../src/data/maps.js';
import type { Combatant, Id } from '../src/engine/types.js';

const board = (rows: string[]): MapData => ({ id: 't', name: 'T', theme: 'stone', rows });
const OPEN = ['........', '........', '........', '........', '........'];

const hero = (over: Partial<Combatant> = {}, weapon = 'longsword'): Combatant => ({
  ...buildCharacter({
    classId: 'fighter', team: 'team1', level: 5, position: { x: 1, y: 1 }, speciesId: 'human',
    equipped: { mainHand: weapon },
  }),
  ...over, id: 'h',
});

/**
 * The named rare weapons, and the two wands that came with them.
 *
 * Every one of these is bought for a rider rather than for its dice, so what
 * the tests defend is the rider and — more importantly — its *cost*. A
 * Berserker Axe with no curse is a +1 axe with free hit points; a Sword of
 * Wounding whose wound can be healed is 2d6 of necrotic and nothing else.
 */

describe('Sword of Wounding', () => {
  function swingUntilHit(seed = 1): Combat {
    for (let s = seed; s < seed + 60; s++) {
      const h = hero({}, 'sword-of-wounding');
      const foe = { ...buildMonster('ogre', 'team2', { x: 2, y: 1 }), id: 'foe', hp: 500, maxHp: 500 };
      const c = new Combat({ seed: s, map: board(OPEN), combatants: [h, foe] });
      const evs = resolveAttack(c.state, 'h', 'foe', 'sword-of-wounding');
      const roll = evs.find((e) => e.type === 'attackRolled');
      if (roll?.type !== 'attackRolled' || !roll.hit) continue;
      if (!c.state.combatants['foe']!.conditions.some((k) => k.id === 'wounded')) continue;
      return c;
    }
    throw new Error('never landed a wounding hit');
  }

  it('leaves a wound that nothing can heal', () => {
    const c = swingUntilHit();
    const foe = c.state.combatants['foe']!;
    foe.hp = 100;
    const before = foe.hp;
    const evs = applyHealing(c.state, 'foe', 'foe', 50);
    expect(foe.hp, 'the wound closed').toBe(before);
    const healed = evs.find((e) => e.type === 'healed');
    if (healed?.type === 'healed') expect(healed.amount).toBe(0);
  });

  it('heals normally once the wound is gone', () => {
    const c = swingUntilHit();
    const foe = c.state.combatants['foe']!;
    foe.conditions = foe.conditions.filter((k) => k.id !== 'wounded');
    foe.hp = 100;
    applyHealing(c.state, 'foe', 'foe', 50);
    expect(foe.hp).toBe(150);
  });

  it('also deals its extra necrotic', () => {
    expect(WEAPONS['sword-of-wounding']!.extraDamage).toEqual({ dice: '2d6', type: 'necrotic' });
  });
});

describe('Sword of Life Stealing', () => {
  /** Swing until a natural 20 lands. */
  function crit(monsterId: string): { c: Combat; before: number } {
    for (let s = 1; s < 400; s++) {
      const h = hero({}, 'sword-of-life-stealing');
      const foe = { ...buildMonster(monsterId, 'team2', { x: 2, y: 1 }), id: 'foe', hp: 500, maxHp: 500 };
      const c = new Combat({ seed: s, map: board(OPEN), combatants: [h, foe] });
      const before = c.state.combatants['foe']!.hp;
      const evs = resolveAttack(c.state, 'h', 'foe', 'sword-of-life-stealing');
      const roll = evs.find((e) => e.type === 'attackRolled');
      if (roll?.type !== 'attackRolled' || !roll.crit) continue;
      return { c, before };
    }
    throw new Error(`never rolled a 20 against ${monsterId}`);
  }

  it('tears 15 necrotic loose on a natural 20, and the wielder keeps it', () => {
    const { c } = crit('ogre');
    const stolen = c.state.combatants['h']!.tempHp ?? 0;
    expect(stolen, 'nothing was stolen').toBeGreaterThan(0);
    expect(stolen).toBeLessThanOrEqual(15);
  });

  it('takes nothing from a construct or the undead', () => {
    for (const id of ['animated-armor', 'skeleton']) {
      const { c } = crit(id);
      expect(c.state.combatants['h']!.tempHp ?? 0, `${id} had life to steal`).toBe(0);
    }
  });
});

describe('Berserker Axe', () => {
  it('raises the wielder\'s hit point maximum by their level', () => {
    const plain = buildCharacter({
      classId: 'fighter', team: 'team1', level: 5, position: { x: 0, y: 0 }, speciesId: 'human',
      equipped: { mainHand: 'battleaxe' },
    });
    const berserk = buildCharacter({
      classId: 'fighter', team: 'team1', level: 5, position: { x: 0, y: 0 }, speciesId: 'human',
      equipped: { mainHand: 'berserker-axe' },
    });
    expect(berserk.maxHp - plain.maxHp).toBe(5);
    expect(berserk.hp).toBe(berserk.maxHp);
  });

  /**
   * The curse is what pays for the hit points, and it is sharper than it looks:
   * it costs you the bow on your back AND any bane weapon you were carrying for
   * the wave ahead.
   */
  it('makes every other weapon worse to swing', () => {
    const h = hero({}, 'berserker-axe');
    h.inventory = [{ itemId: 'longbow', qty: 1 }];
    const foe = makeCombatant({ id: 'foe', team: 'team2', position: { x: 2, y: 1 } });
    const c = new Combat({ seed: 3, map: board(OPEN), combatants: [h, foe] });
    const me = c.state.combatants['h']!;
    const them = c.state.combatants['foe']!;

    const withAxe = collectAttackSources(c.state, me, them, WEAPONS['berserker-axe']!, true);
    expect(withAxe.dis).not.toContain("berserker's grip");
    const withBow = collectAttackSources(c.state, me, them, WEAPONS['longbow']!, false);
    expect(withBow.dis).toContain("berserker's grip");
  });

  it('does not curse someone who is not holding it', () => {
    const h = hero({}, 'longsword');
    const foe = makeCombatant({ id: 'foe', team: 'team2', position: { x: 2, y: 1 } });
    const c = new Combat({ seed: 3, map: board(OPEN), combatants: [h, foe] });
    const src = collectAttackSources(
      c.state, c.state.combatants['h']!, c.state.combatants['foe']!, WEAPONS['longsword']!, true);
    expect(src.dis).not.toContain("berserker's grip");
  });
});

describe('Mace of Terror', () => {
  const TALL = Array<string>(12).fill('........');

  function bearer(seed = 1) {
    const h = hero({}, 'mace-of-terror');
    const foes = [0, 1, 2].map((i) => ({
      ...buildMonster('goblin-warrior', 'team2', { x: 2 + i, y: 2 }), id: `f${i}`,
    }));
    // Well out of range: 30 ft is INCLUSIVE, so "just at the edge" is inside it.
    // Ten cells away is 50 ft and unambiguous.
    const far = { ...buildMonster('goblin-warrior', 'team2', { x: 1, y: 11 }), id: 'far' };
    const c = new Combat({ seed, map: board(TALL), combatants: [h, ...foes, far] });
    for (let i = 0; i < 30 && c.activeId !== 'h'; i++) c.apply({ kind: 'endTurn' });
    return c;
  }

  it('is an action the wielder can take, three times', () => {
    const c = bearer();
    expect(c.state.combatants['h']!.featureIds).toContain('wave-of-terror');
    expect(c.state.combatants['h']!.featureUses['wave-of-terror']).toEqual({ current: 3, max: 3 });
    expect(legalActions(c.state, 'h')
      .some((a) => a.kind === 'useFeature' && a.featureId === 'wave-of-terror')).toBe(true);
  });

  it('routs what it reaches and leaves the rest alone', () => {
    // A DC 15 Wisdom save is one a goblin often fails and sometimes makes, so
    // this walks seeds until the wave lands on somebody rather than asserting a
    // particular roll.
    for (let seed = 1; seed <= 20; seed++) {
      const c = bearer(seed);
      if (c.activeId !== 'h') continue;
      c.apply({ kind: 'useFeature', featureId: 'wave-of-terror' });
      const fleeing = (id: string) => c.state.combatants[id]!.conditions.some((k) => k.id === 'fleeing');
      expect(fleeing('far'), 'something 50 feet away was frightened').toBe(false);
      expect(c.state.combatants['h']!.featureUses['wave-of-terror']!.current).toBe(2);
      if (['f0', 'f1', 'f2'].some(fleeing)) return;
    }
    throw new Error('twenty waves of terror and nothing ever broke');
  });

  it('does not frighten the wielder\'s own side', () => {
    const c = bearer();
    c.apply({ kind: 'useFeature', featureId: 'wave-of-terror' });
    expect(c.state.combatants['h']!.conditions.some((k) => k.id === 'fleeing')).toBe(false);
  });
});

describe('the wands of Fear and Binding', () => {
  function wielder(classId: string, itemId: Id) {
    const h = {
      ...buildCharacter({
        classId, team: 'team1', level: 5, position: { x: 1, y: 1 }, speciesId: 'human',
        inventory: [{ itemId, qty: 1 }],
      }), id: 'h',
    };
    const foe = { ...buildMonster('ogre', 'team2', { x: 3, y: 2 }), id: 'foe' };
    const c = new Combat({ seed: 4, map: board(OPEN), combatants: [h, foe] });
    for (let i = 0; i < 30 && c.activeId !== 'h'; i++) c.apply({ kind: 'endTurn' });
    return c;
  }

  it('lets a fighter use the Wand of Fear — it needs no attunement', () => {
    const c = wielder('fighter', 'wand-fear');
    const act = legalActions(c.state, 'h').find((a) => a.kind === 'useItem' && a.itemId === 'wand-fear');
    expect(act, 'a fighter could not use it').toBeDefined();
    c.apply(act!);
    expect(c.state.combatants['h']!.itemUses!['wand-fear']!.current).toBe(6);
  });

  it('binds with the hardest save in the game, and Free Action still refuses it', () => {
    const c = wielder('wizard', 'wand-binding');
    const act = legalActions(c.state, 'h').find((a) => a.kind === 'useItem' && a.itemId === 'wand-binding');
    expect(act).toBeDefined();
    // A target that cannot be bound by magic, however the save falls.
    c.state.combatants['foe']!.featureIds = [
      ...c.state.combatants['foe']!.featureIds, 'free-action',
    ];
    for (let i = 0; i < 10; i++) {
      c.state.combatants['h']!.turn.actionUsed = false;
      c.state.combatants['h']!.itemUses!['wand-binding']!.current = 7;
      c.apply(act!);
    }
    expect(c.state.combatants['foe']!.conditions.some((k) => k.id === 'restrained')).toBe(false);
  });
});

describe('Necklace of Prayer Beads', () => {
  it('can only be worn by a cleric, druid or paladin', () => {
    const camp = newCampaign(1);
    for (const [i, ch] of camp.characters.entries()) {
      ch.inventory.push({ itemId: 'necklace-prayer-beads', qty: 1 });
      const blocked = equipBlocked(camp, i, 'necklace-prayer-beads', 'trinket');
      const allowed = TRINKETS['necklace-prayer-beads']!.classes!.includes(ch.classId);
      expect(blocked === undefined, `${ch.classId}: blocked=${blocked}`).toBe(allowed);
    }
  });

  it('grants nothing to a class that could never attune to it', () => {
    // equipBlocked refuses to put it on, but the builder is what actually runs
    // — a hand-edited or older save must not hand a wizard a cleric's beads.
    const wizard = buildCharacter({
      classId: 'wizard', team: 'team1', level: 5, position: { x: 0, y: 0 },
      equipped: { mainHand: 'dagger', trinket: 'necklace-prayer-beads' },
    });
    expect(wizard.featureIds).not.toContain('prayer-bead-bless');
    const cleric = buildCharacter({
      classId: 'cleric', team: 'team1', level: 5, position: { x: 0, y: 0 },
      equipped: { mainHand: 'mace', trinket: 'necklace-prayer-beads' },
    });
    expect(cleric.featureIds).toContain('prayer-bead-bless');
  });

  it('blesses the party as a bonus action, once', () => {
    const cleric = {
      ...buildCharacter({
        classId: 'cleric', team: 'team1', level: 5, position: { x: 1, y: 1 },
        equipped: { mainHand: 'mace', trinket: 'necklace-prayer-beads' },
      }), id: 'c',
    };
    const ally = { ...buildCharacter({ classId: 'fighter', team: 'team1', level: 5, position: { x: 2, y: 1 } }), id: 'a' };
    const foe = { ...buildMonster('ogre', 'team2', { x: 6, y: 4 }), id: 'foe' };
    const c = new Combat({ seed: 2, map: board(OPEN), combatants: [cleric, ally, foe] });
    for (let i = 0; i < 30 && c.activeId !== 'c'; i++) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'useFeature', featureId: 'prayer-bead-bless' });
    expect(c.state.combatants['c']!.conditions.some((k) => k.id === 'blessed')).toBe(true);
    expect(c.state.combatants['a']!.conditions.some((k) => k.id === 'blessed')).toBe(true);
    expect(c.state.combatants['foe']!.conditions.some((k) => k.id === 'blessed'),
      'it blessed the ogre').toBe(false);
  });
});

describe('all of it reaches a player', () => {
  const NEW: Id[] = [
    'sword-of-wounding', 'sword-of-life-stealing', 'berserker-axe', 'mace-of-terror',
    'wand-fear', 'wand-binding', 'necklace-prayer-beads',
  ];

  it('is stocked, rare, and resolves to a base weapon where it is one', () => {
    for (const id of NEW) {
      expect(SHOP_STOCK, `${id} is not stocked`).toContain(id);
      expect(rarityOf(id), id).toBe('rare');
      if (WEAPONS[id]) {
        expect(weaponCategory(id), `${id} has no category — proficiency would pass for anyone`)
          .toBeDefined();
      }
    }
  });
});
