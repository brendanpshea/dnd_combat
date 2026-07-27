/**
 * The armor table, and the two columns that make it a choice rather than a
 * ladder.
 *
 * Base AC alone makes armor selection trivial: buy the biggest number you are
 * proficient in. Stealth disadvantage and the Strength minimum are what give
 * the middle of the table a reason to exist — Breastplate is Scale Mail's
 * armor class at eight times the price, and the only thing the money buys is
 * the ability to Hide in it.
 */
import { describe, it, expect } from 'vitest';
import {
  ARMOR, armorClass, armorStealthDisadvantage, armorSpeedPenalty,
} from '../src/data/armor.js';
import { buildCharacter } from '../src/builder/character.js';
import { Combat } from '../src/engine/combat.js';
import { buildMonster } from '../src/data/monsters.js';
import type { Id } from '../src/engine/types.js';

describe('the SRD armor table', () => {
  // SRD 5.2.1, the Armor table: every row, with the columns we model.
  const SRD: Array<[Id, number, 'light' | 'medium' | 'heavy', number, number | undefined, boolean]> = [
    // id, base AC, category, cost gp, Strength, Stealth disadvantage
    ['padded', 11, 'light', 5, undefined, true],
    ['leather', 11, 'light', 10, undefined, false],
    ['studded-leather', 12, 'light', 45, undefined, false],
    ['hide', 12, 'medium', 10, undefined, false],
    ['chain-shirt', 13, 'medium', 50, undefined, false],
    ['scale-mail', 14, 'medium', 50, undefined, true],
    ['breastplate', 14, 'medium', 400, undefined, false],
    ['half-plate', 15, 'medium', 750, undefined, true],
    ['ring-mail', 14, 'heavy', 30, undefined, true],
    ['chain-mail', 16, 'heavy', 75, 13, true],
    ['splint', 17, 'heavy', 200, 15, true],
    ['plate', 18, 'heavy', 1500, 15, true],
  ];

  it.each(SRD)('%s matches the SRD row', (id, base, category, cost, strMin, stealth) => {
    const a = ARMOR[id];
    expect(a, `${id} is missing from the table`).toBeDefined();
    expect(a!.base).toBe(base);
    expect(a!.category).toBe(category);
    expect(a!.cost).toBe(cost);
    expect(a!.strMin).toBe(strMin);
    expect(armorStealthDisadvantage(id)).toBe(stealth);
  });

  it('carries every mundane row — a missing one is a hole in the reference', () => {
    for (const [id] of SRD) expect(Object.keys(ARMOR)).toContain(id);
  });

  it('gives magical variants the same handling weight as their base', () => {
    // A +1 Splint is still splint: it is heavy, it wants Strength 15 and it
    // rattles. Losing those when the enchantment was added would make every
    // magic armor a strict upgrade and quietly delete the tradeoff.
    for (const [id, a] of Object.entries(ARMOR)) {
      const base = id.replace(/^adamantine-/, '').replace(/-plus1$/, '');
      if (base === id) continue;
      const parent = ARMOR[base];
      expect(parent, `${id} has no base armor ${base}`).toBeDefined();
      expect(a.category, id).toBe(parent!.category);
      expect(a.strMin, id).toBe(parent!.strMin);
      expect(armorStealthDisadvantage(id), id).toBe(armorStealthDisadvantage(base));
    }
  });

  it('prices Plate above every armor money can otherwise buy', () => {
    // Plate is the arena's designed gold sink. If anything non-magical ever
    // costs more for less protection, the sink has sprung a leak.
    const mundane = Object.values(ARMOR).filter((a) => !a.noCrit && !a.id.endsWith('plus1'));
    for (const a of mundane) {
      if (a.id === 'plate') continue;
      expect(a.cost, `${a.id} costs as much as Plate`).toBeLessThan(ARMOR['plate']!.cost);
      expect(a.base, `${a.id} protects as well as Plate`).toBeLessThanOrEqual(ARMOR['plate']!.base);
    }
  });

  it('keeps Breastplate worth its price', () => {
    // Same AC as Scale Mail, eight times the cost, and the entire difference is
    // this one column. If it ever gains stealth disadvantage it becomes a trap.
    expect(ARMOR['breastplate']!.base).toBe(ARMOR['scale-mail']!.base);
    expect(armorStealthDisadvantage('breastplate')).toBe(false);
    expect(armorStealthDisadvantage('scale-mail')).toBe(true);
  });
});

describe('armor class maths', () => {
  it('applies Dex in full, capped, or not at all', () => {
    expect(armorClass('leather', 3, 0)).toBe(14);        // full
    expect(armorClass('breastplate', 3, 0)).toBe(16);    // capped at +2
    expect(armorClass('plate', 3, 0)).toBe(18);          // none
    expect(armorClass('plate', -1, 2)).toBe(20);         // shield still counts
  });

  it('makes Plate the ceiling for a low-Dex hero and not for a high-Dex one', () => {
    // The reason heavy armor is not simply correct: a Dex 20 hero in Half Plate
    // matches Plate and can still sneak.
    expect(armorClass('half-plate', 5, 0)).toBe(17);
    expect(armorClass('plate', 5, 0)).toBe(18);
  });
});

describe('the Strength minimum', () => {
  it('costs 10 feet of speed below the listed score, and nothing at or above', () => {
    expect(armorSpeedPenalty('plate', 14)).toBe(10);
    expect(armorSpeedPenalty('plate', 15)).toBe(0);
    expect(armorSpeedPenalty('plate', 20)).toBe(0);
    expect(armorSpeedPenalty('chain-mail', 12)).toBe(10);
    expect(armorSpeedPenalty('chain-mail', 13)).toBe(0);
  });

  it('never penalises armor with no requirement, or none at all', () => {
    expect(armorSpeedPenalty('breastplate', 3)).toBe(0);
    expect(armorSpeedPenalty('ring-mail', 3)).toBe(0);
    expect(armorSpeedPenalty(undefined, 3)).toBe(0);
  });

  it('slows a built character who cannot carry what they are wearing', () => {
    const strong = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 },
      equipped: { mainHand: 'longsword', armor: 'plate' },
    });
    const weak = buildCharacter({
      classId: 'wizard', team: 'team1', position: { x: 0, y: 0 },
      equipped: { mainHand: 'quarterstaff', armor: 'plate' },
    });
    // A fighter's Strength is its first priority stat; a wizard's is its last.
    expect(strong.abilities.str).toBeGreaterThanOrEqual(15);
    expect(weak.abilities.str).toBeLessThan(15);
    expect(strong.speed).toBe(30);
    expect(weak.speed).toBe(20);
  });

  it('lets Gauntlets of Ogre Power carry the plate for you', () => {
    // The gauntlets set Strength to 19, and the builder folds worn trinkets
    // before speed is computed — so the wizard who found them can wear plate
    // properly. If this ever regresses it will look like a speed bug.
    const gauntleted = buildCharacter({
      classId: 'wizard', team: 'team1', position: { x: 0, y: 0 },
      equipped: { mainHand: 'quarterstaff', armor: 'plate', trinket: 'gauntlets-ogre-power' },
    });
    expect(gauntleted.abilities.str).toBeGreaterThanOrEqual(15);
    expect(gauntleted.speed).toBe(30);
  });
});

describe('Stealth disadvantage', () => {
  /** Roll one Hide with a fixed seed and report the check total. */
  function hideTotal(armor: Id | undefined, seed: number): number {
    const rogue = buildCharacter({
      classId: 'rogue', team: 'team1', position: { x: 0, y: 0 }, level: 3,
      equipped: { mainHand: 'shortsword', ...(armor ? { armor } : {}) },
    });
    // A blinded foe so `canHide` allows the attempt at all — the check is what
    // this test is about, not the line-of-sight rules around it.
    const foe = buildMonster('goblin-warrior', 'team2', { x: 0, y: 5 });
    const combat = new Combat({ seed, map: undefined, combatants: [rogue, foe] });
    let guard = 0;
    while (combat.activeId !== rogue.id && guard++ < 20) combat.apply({ kind: 'endTurn' });
    // Blind it on the *live* state, not the builder's: blindness wears off at
    // the end of a turn, so a foe blinded before combat can see again the
    // moment it wins initiative — and the rogue could then only Hide on the
    // seeds where it happened to go first.
    const live = combat.state.combatants[foe.id]!;
    live.conditions.push({ id: 'blinded', sourceId: foe.id });
    const events = combat.apply({ kind: 'hide' });
    const check = events.find((e) => e.type === 'hideCheck');
    return (check as { total: number }).total;
  }

  it('rolls a rogue in Splint worse than the same rogue in Leather', () => {
    // Paired across many seeds: a single seed proves nothing about a die roll.
    let leatherBetter = 0;
    let splintBetter = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const light = hideTotal('leather', seed);
      const heavy = hideTotal('splint', seed);
      if (light > heavy) leatherBetter += 1;
      if (heavy > light) splintBetter += 1;
    }
    // Disadvantage cannot beat a flat roll on the same seed, only tie or lose.
    expect(splintBetter).toBe(0);
    expect(leatherBetter).toBeGreaterThan(20);
  });

  it('does not penalise Breastplate, which is the whole reason to buy it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(hideTotal('breastplate', seed)).toBe(hideTotal('leather', seed));
    }
  });
});
