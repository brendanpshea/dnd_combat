/**
 * Point buy, and the class kits that move stats and starting gear together.
 *
 * The load-bearing test here is the first one: the point-buy default must
 * reproduce `[16,16,13,12,10,8]` exactly, for every class. That is what lets
 * this whole feature ship without rebalancing anything — if it ever fails, some
 * party somewhere silently got different characters.
 */
import { describe, it, expect } from 'vitest';
import {
  ABILITIES, BASE_ARRAY, POINT_BUY_BUDGET, POINT_BUY_MIN, POINT_BUY_MAX, POINT_COST,
  pointsSpent, canRaise, canLower, resolveStatBuild, defaultStatBuild, isLegalStatBuild,
  type StatBuild,
} from '../src/builder/stats.js';
import { STANDARD_ARRAY, assignStats, buildCharacter } from '../src/builder/character.js';
import { CLASSES, kitFor, defaultKitId } from '../src/data/classes.js';
import {
  newCampaign, setPartyKit, setPartyClass, setPartyStatBuild, clearPartyStatBuild,
  abilitiesOf, buildCampaignParty, skillBonus, applyPartyTemplate, PARTY_TEMPLATES,
  partyChoice, setPartyChoice,
} from '../src/campaign/campaign.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ARMOR, armorStealthDisadvantage } from '../src/data/armor.js';
import { attackAbility } from '../src/engine/rules/attack.js';
import { shoveDc } from '../src/engine/rules/shove.js';
import type { Ability } from '../src/engine/types.js';

const HERE = { x: 0, y: 0 } as const;

describe('point buy', () => {
  it('the default build reproduces the old standard array for every class', () => {
    for (const cls of Object.values(CLASSES)) {
      const scores = assignStats(cls.statPriority);
      const inOrder = cls.statPriority.map((ab) => scores[ab]);
      expect(inOrder, cls.id).toEqual([...STANDARD_ARRAY]);
    }
  });

  it('the standard array spends the budget exactly', () => {
    expect(BASE_ARRAY.reduce((n, v) => n + POINT_COST[v]!, 0)).toBe(POINT_BUY_BUDGET);
  });

  it('places the +1 on the primary and the +2 on the second', () => {
    // 15+1 and 14+2 are both 16 — the reason the default lands on two 16s
    // rather than a 17 and a 15. Pinned because it is easy to "fix" and wrong.
    const b = defaultStatBuild(['str', 'con', 'dex', 'wis', 'int', 'cha']);
    expect(b.plus1).toBe('str');
    expect(b.plus2).toBe('con');
    expect(resolveStatBuild(b).str).toBe(16);
    expect(resolveStatBuild(b).con).toBe(16);
  });

  it('costs more per point above 13', () => {
    expect(POINT_COST[14]! - POINT_COST[13]!).toBe(2);
    expect(POINT_COST[13]! - POINT_COST[12]!).toBe(1);
  });

  it('refuses to raise past 15 or past the budget', () => {
    const b = defaultStatBuild(['str', 'con', 'dex', 'wis', 'int', 'cha']);
    expect(canRaise(b.base, 'str')).toBe(false);   // already 15
    expect(canRaise(b.base, 'cha')).toBe(false);   // budget fully spent
    expect(canLower(b.base, 'cha')).toBe(false);   // already 8
    expect(canLower(b.base, 'str')).toBe(true);
  });

  it('frees points when a score is lowered', () => {
    const b = defaultStatBuild(['str', 'con', 'dex', 'wis', 'int', 'cha']);
    const cheaper = { ...b.base, str: 13 };
    expect(pointsSpent(cheaper)).toBe(POINT_BUY_BUDGET - 4);
    expect(canRaise(cheaper, 'cha')).toBe(true);
  });

  it('rejects illegal builds', () => {
    const ok = defaultStatBuild(['str', 'con', 'dex', 'wis', 'int', 'cha']);
    expect(isLegalStatBuild(ok)).toBe(true);
    expect(isLegalStatBuild(undefined)).toBe(false);
    expect(isLegalStatBuild({ ...ok, plus1: ok.plus2 })).toBe(false);          // both bonuses stacked
    expect(isLegalStatBuild({ ...ok, base: { ...ok.base, str: 18 } })).toBe(false);  // out of range
    expect(isLegalStatBuild({ ...ok, base: { ...ok.base, cha: 15 } })).toBe(false);  // over budget
    expect(isLegalStatBuild({ ...ok, base: { ...ok.base, str: POINT_BUY_MIN - 1 } })).toBe(false);
    expect(isLegalStatBuild({ ...ok, base: { ...ok.base, str: POINT_BUY_MAX } })).toBe(true);
  });

  it('never lets the editor reach a 17 by buying it', () => {
    // 17 exists, but only via the +2 — the bought ceiling is 15.
    for (const ab of ABILITIES) {
      const b = defaultStatBuild(['str', 'con', 'dex', 'wis', 'int', 'cha']);
      expect(b.base[ab]).toBeLessThanOrEqual(POINT_BUY_MAX);
    }
  });
});

describe('buildCharacter and stat builds', () => {
  it('honours a legal hand-bought build', () => {
    const build: StatBuild = {
      base: { str: 8, dex: 15, con: 14, int: 10, wis: 12, cha: 13 },
      plus2: 'dex', plus1: 'con',
    };
    const c = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, statBuild: build });
    expect(c.abilities.dex).toBe(17);
    expect(c.abilities.con).toBe(15);
    expect(c.abilities.str).toBe(8);
  });

  it('ignores an illegal build rather than honouring it', () => {
    // A hand-edited save must not be a way to buy six 15s.
    const cheat: StatBuild = {
      base: { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 },
      plus2: 'str', plus1: 'con',
    };
    const c = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, statBuild: cheat });
    expect(c.abilities.str).toBe(16);   // the fighter's recommended spread
    expect(c.abilities.dex).toBe(13);
  });

  it('leaves every existing character exactly as it was', () => {
    for (const id of Object.keys(CLASSES)) {
      for (const level of [1, 4, 8]) {
        const c = buildCharacter({ classId: id, team: 'team1', position: HERE, level });
        const expected = assignStats(CLASSES[id]!.statPriority);
        const primary = CLASSES[id]!.statPriority[0];
        let want = expected[primary];
        if (level >= 4) want = Math.min(20, want + 2);
        if (level >= 6 && id === 'fighter') want = Math.min(20, want + 2);
        if (level >= 8) want = Math.min(20, want + 2);
        expect(c.abilities[primary], `${id} L${level}`).toBe(want);
      }
    }
  });
});

describe('class kits', () => {
  it('a class with no kits resolves to its own fields', () => {
    const rogue = CLASSES.rogue!;
    expect(rogue.kits).toBeUndefined();
    expect(defaultKitId(rogue)).toBeUndefined();
    const k = kitFor(rogue, 'nonsense');
    expect(k.statPriority).toEqual(rogue.statPriority);
    expect(k.equipment).toEqual(rogue.equipment);
    expect(k.weaponMasteries).toEqual(rogue.weaponMasteries);
  });

  it("the fighter's default kit changes nothing", () => {
    const fighter = CLASSES.fighter!;
    expect(defaultKitId(fighter)).toBe('martial');
    const k = kitFor(fighter, undefined);
    expect(k.statPriority).toEqual(fighter.statPriority);
    expect(k.equipment).toEqual(fighter.equipment);
    expect(k.weaponMasteries).toEqual(fighter.weaponMasteries);
  });

  it('every kit id is unique and every kit overrides something except the first', () => {
    for (const cls of Object.values(CLASSES)) {
      if (!cls.kits) continue;
      expect(cls.kits.length, `${cls.id} offers a one-card picker`).toBeGreaterThan(1);
      const ids = cls.kits.map((k) => k.id);
      expect(new Set(ids).size, cls.id).toBe(ids.length);
      for (const kit of cls.kits.slice(1)) {
        const overrides = [kit.statPriority, kit.equipment, kit.weaponMasteries].filter(Boolean);
        expect(overrides.length, `${cls.id}/${kit.id} is a duplicate of the default`)
          .toBeGreaterThan(0);
      }
    }
  });

  it("every kit's gear is real, wieldable and has mastery listed", () => {
    for (const cls of Object.values(CLASSES)) {
      for (const kit of cls.kits ?? []) {
        const k = kitFor(cls, kit.id);
        const where = `${cls.id}/${kit.id}`;
        expect(WEAPONS[k.equipment.mainHand], `${where} main hand`).toBeDefined();
        if (k.equipment.armor) expect(ARMOR[k.equipment.armor], `${where} armor`).toBeDefined();
        // A starting weapon with no mastery listed is a silently worse kit.
        expect(k.weaponMasteries, `${where} mastery`).toContain(k.equipment.mainHand);
      }
    }
  });
});

describe('the Duelist fighter', () => {
  const martial = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE });
  const duelist = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, kitId: 'duelist' });

  it('leads on Dexterity and carries a finesse weapon that uses it', () => {
    expect(duelist.abilities.dex).toBe(16);
    expect(duelist.abilities.str).toBe(13);
    expect(duelist.equipped.mainHand).toBe('rapier');
    // The whole point: the attack must actually read Dexterity. Moving the
    // scores alone would leave a longsword swinging off a 13 Strength.
    expect(attackAbility(duelist, WEAPONS.rapier!)).toBe('dex');
    expect(attackAbility(martial, WEAPONS.longsword!)).toBe('str');
  });

  it('wears light armour, so the Dexterity is not capped away', () => {
    expect(ARMOR[duelist.equipped.armor!]!.category).toBe('light');
    expect(ARMOR[duelist.equipped.armor!]!.dexCap).toBe('full');
    // The Martial kit's medium armour is exactly what makes the swap necessary.
    expect(ARMOR[martial.equipped.armor!]!.dexCap).toBe(2);
  });

  it('deals the same damage per swing as the Martial kit', () => {
    // Rapier over shortsword precisely so the kit is a different fighter and
    // not a worse one — and so Dueling, the default Fighting Style, still fires.
    expect(WEAPONS.rapier!.damage).toBe(WEAPONS.longsword!.damage);
    expect(WEAPONS.rapier!.properties).not.toContain('two-handed');
    expect(duelist.equipped.offHand).toBe('shield');
  });

  it('throws daggers rather than javelins', () => {
    // A javelin is a Strength attack; a thrown finesse weapon is not.
    const thrown = duelist.inventory.map((s) => s.itemId);
    expect(thrown).toContain('dagger');
    expect(thrown).not.toContain('javelin');
    expect(WEAPONS.dagger!.properties).toContain('finesse');
  });

  it('sends its ability increases to Dexterity', () => {
    const l8 = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level: 8, kitId: 'duelist' });
    expect(l8.abilities.dex).toBe(20);
    expect(l8.abilities.str).toBe(13);
  });

  it('is one AC behind at 1st, level at 4th, one ahead at 8th', () => {
    const ac = (c: { abilities: { dex: number }; equipped: { armor?: string } }) => {
      const a = ARMOR[c.equipped.armor!]!;
      const dexMod = Math.floor((c.abilities.dex - 10) / 2);
      return a.base + (a.dexCap === 'full' ? dexMod : Math.min(dexMod, a.dexCap as number)) + 2;
    };
    const at = (level: number, kitId?: string) =>
      ac(buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level,
        ...(kitId ? { kitId } : {}) }));
    // The arc is the whole balance argument for the kit. Studded leather (12)
    // instead of leather (11) makes every one of these >= and the kit becomes
    // the correct answer rather than a choice.
    expect(at(1, 'duelist')).toBe(at(1) - 1);
    expect(at(4, 'duelist')).toBe(at(4));
    expect(at(8, 'duelist')).toBe(at(8) + 1);
  });

  it('can creep, which the Martial kit cannot', () => {
    expect(armorStealthDisadvantage(martial.equipped.armor)).toBe(true);
    expect(armorStealthDisadvantage(duelist.equipped.armor)).toBe(false);
  });

  it('shoves worse, which is what it pays', () => {
    expect(shoveDc(duelist)).toBeLessThan(shoveDc(martial));
  });

  it('is not simply better than the Martial kit', () => {
    // Fewer hit points is the price of the light armour — the Martial fighter's
    // Constitution is its second ability and the Duelist's is too, so this
    // holds only because the shared 16 goes to Dexterity instead of Strength.
    // If this ever flips, the kit has stopped being a trade.
    expect(duelist.maxHp).toBe(martial.maxHp);   // both lead Con second
    expect(duelist.abilities.str).toBeLessThan(martial.abilities.str);
  });
});

describe('an ability is spelled the same way everywhere', () => {
  it('ABILITIES covers exactly the six', () => {
    const fromClass = new Set<Ability>(Object.values(CLASSES).flatMap((c) => c.statPriority));
    expect(new Set(ABILITIES)).toEqual(fromClass);
  });
});

describe('the forge', () => {
  const forge = () => {
    const c = newCampaign(7);
    c.characters[0]!.classId = 'fighter';
    return c;
  };

  it('switching kit moves the gear with the stats', () => {
    const c = forge();
    expect(setPartyKit(c, 0, 'duelist')).toBe(true);
    expect(c.characters[0]!.equipped.mainHand).toBe('rapier');
    expect(c.characters[0]!.equipped.armor).toBe('leather');
    expect(c.characters[0]!.inventory.map((s) => s.itemId)).toContain('dagger');
    // And it reaches the combatant, which is the only thing that matters.
    const fighter = buildCampaignParty(c)[0]!;
    expect(fighter.equipped.mainHand).toBe('rapier');
    expect(fighter.abilities.dex).toBe(16);
    expect(fighter.weaponMasteries).toContain('rapier');
  });

  it('refuses a kit the class does not have', () => {
    const c = forge();
    expect(setPartyKit(c, 0, 'duelist2')).toBe(false);
    expect(setPartyKit(c, 1, 'duelist')).toBe(false);   // the wizard has no kits
    expect(c.characters[0]!.kitId).toBeUndefined();
  });

  it('changing class drops the kit and the bought scores', () => {
    const c = forge();
    setPartyKit(c, 0, 'duelist');
    setPartyStatBuild(c, 0, {
      base: { str: 8, dex: 15, con: 14, int: 10, wis: 12, cha: 13 }, plus2: 'dex', plus1: 'con',
    });
    setPartyClass(c, 0, 'cleric');
    expect(c.characters[0]!.kitId).toBeUndefined();
    expect(c.characters[0]!.statBuild).toBeUndefined();
    expect(abilitiesOf(c.characters[0]!).wis).toBe(16);   // the cleric's own recommendation
  });

  it('switching kit drops scores bought against the old one', () => {
    const c = forge();
    setPartyStatBuild(c, 0, {
      base: { str: 15, dex: 8, con: 14, int: 10, wis: 12, cha: 13 }, plus2: 'str', plus1: 'con',
    });
    setPartyKit(c, 0, 'duelist');
    expect(c.characters[0]!.statBuild).toBeUndefined();
    expect(abilitiesOf(c.characters[0]!).dex).toBe(16);
  });

  it('stores a legal build and refuses an illegal one', () => {
    const c = forge();
    const good = { base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, plus2: 'dex', plus1: 'str' } as StatBuild;
    expect(setPartyStatBuild(c, 0, good)).toBe(true);
    expect(abilitiesOf(c.characters[0]!)).toMatchObject({ str: 16, dex: 16, con: 13 });
    const overBudget = { ...good, base: { ...good.base, cha: 15 } };
    expect(setPartyStatBuild(c, 0, overBudget)).toBe(false);
    expect(abilitiesOf(c.characters[0]!).cha).toBe(8);    // untouched by the refusal
  });

  it('a skill check reads the scores the player actually bought', () => {
    const c = forge();
    const before = skillBonus('fighter', 1, 'stealth', c.characters[0]!.speciesId,
      c.characters[0]!.backgroundId, abilitiesOf(c.characters[0]!));
    setPartyKit(c, 0, 'duelist');
    const after = skillBonus('fighter', 1, 'stealth', c.characters[0]!.speciesId,
      c.characters[0]!.backgroundId, abilitiesOf(c.characters[0]!));
    expect(after).toBe(before + 2);   // Dex 13 (+1) becomes Dex 16 (+3)
  });

  it('is a pre-launch decision only', () => {
    const c = forge();
    c.partyReady = true;
    expect(setPartyKit(c, 0, 'duelist')).toBe(false);
    expect(clearPartyStatBuild(c, 0)).toBe(false);
  });

  it('a save written before kits existed builds exactly as it always did', () => {
    const c = forge();
    delete c.characters[0]!.kitId;
    delete c.characters[0]!.statBuild;
    const fighter = buildCampaignParty(c)[0]!;
    expect(fighter.equipped.mainHand).toBe('longsword');
    expect(fighter.abilities.str).toBe(16);
  });
});

/**
 * Every Fighting Style must have a kit whose weapons can actually fire it.
 *
 * Three of the five were unreachable before kits: Archery, Great Weapon
 * Fighting and Two-Weapon Fighting were all on the fighter's list while the
 * class started with a longsword and a shield. Great Weapon Fighting was also
 * the *default* for the fighter's second style at 7th level, so a sword-and-
 * board fighter reached the top of the game and gained nothing. The paladin and
 * the ranger had the same shape of hole.
 *
 * This is the dead-data standard applied to a build choice rather than an item:
 * an option nobody can use is worse than an absent one, because it looks like a
 * decision.
 */
describe('every Fighting Style has gear that fires it', () => {
  /** What each style needs from the hand it is holding. */
  const usable: Record<string, (e: { mainHand: string; offHand?: string; armor?: string }) => boolean> = {
    archery: (e) => WEAPONS[e.mainHand]?.melee === false,
    'great-weapon-fighting': (e) => !!WEAPONS[e.mainHand]?.properties.includes('two-handed'),
    'two-weapon-fighting': (e) => e.offHand !== undefined && e.offHand !== 'shield',
    dueling: (e) => !!WEAPONS[e.mainHand]?.melee && !WEAPONS[e.mainHand]?.properties.includes('two-handed'),
    defense: (e) => e.armor !== undefined,
  };

  const styled = Object.values(CLASSES)
    .flatMap((cls) => (cls.choices ?? [])
      .filter((cp) => cp.id.startsWith('fighting-style'))
      .map((cp) => ({ cls, cp })));

  it('covers a class that actually has styles', () => {
    expect(styled.length).toBeGreaterThan(0);
    expect(new Set(styled.map((x) => x.cls.id))).toContain('fighter');
  });

  for (const { cls, cp } of styled) {
    it(`${cls.id} / ${cp.id}: every option is playable on some kit`, () => {
      const kitIds = cls.kits?.map((k) => k.id) ?? [undefined];
      for (const opt of cp.options) {
        const test = usable[opt.id];
        expect(test, `no usability rule written for ${opt.id}`).toBeDefined();
        const fits = kitIds.some((kitId) => test!(kitFor(cls, kitId).equipment));
        expect(fits, `${cls.id}: no kit can use ${opt.id}`).toBe(true);
      }
    });
  }

  it("the kit's default style reaches the built character", () => {
    // Data alone is not enough: buildCharacter has to actually fold the kit's
    // picks under the player's. Without this, every assertion above passes
    // while every character still gets the class-wide default.
    const gw = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, kitId: 'greatweapon' });
    expect(gw.featureIds).toContain('great-weapon-fighting');
    expect(gw.featureIds).not.toContain('dueling');

    const archer = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, kitId: 'archer' });
    expect(archer.featureIds).toContain('archery');

    // The bug this was written for: a 7th-level sword-and-board fighter used to
    // take Great Weapon Fighting as its second style and gain nothing.
    const martial7 = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level: 7 });
    expect(martial7.featureIds).toContain('defense');
    expect(martial7.featureIds).not.toContain('great-weapon-fighting');
  });

  it('a player pick still beats the kit default', () => {
    const stubborn = buildCharacter({
      classId: 'fighter', team: 'team1', position: HERE, kitId: 'greatweapon',
      choices: { 'fighting-style': 'defense' },
    });
    expect(stubborn.featureIds).toContain('defense');
    expect(stubborn.featureIds).not.toContain('great-weapon-fighting');
  });

  it("a kit's own default style is one it can use", () => {
    // The specific bug: the fighter's second style defaulted to Great Weapon
    // Fighting on a sword-and-shield kit.
    for (const { cls, cp } of styled) {
      for (const kit of cls.kits ?? []) {
        const picked = kitFor(cls, kit.id).choices[cp.id] ?? cp.default;
        const equipment = kitFor(cls, kit.id).equipment;
        expect(usable[picked]?.(equipment), `${cls.id}/${kit.id} defaults to ${picked}, which it cannot use`)
          .toBe(true);
      }
    }
  });
});

describe('ability increases are never thrown away', () => {
  it('a level-8 fighter no longer wastes its third increase', () => {
    const f = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level: 8 });
    expect(f.abilities.str).toBe(20);   // 16 -> 18 (4th) -> 20 (6th)
    expect(f.abilities.con).toBe(18);   // 8th used to vanish into the cap
  });

  it('spills the spare point when the primary is one short of 20', () => {
    // Strength 15 +2 = 17 at first level, 19 after the 4th-level increase. The
    // 6th-level one then takes it to 20 with a point left over, and that point
    // moves down the priority list instead of vanishing into the cap.
    const build = {
      base: { str: 15, dex: 8, con: 14, int: 10, wis: 12, cha: 13 },
      plus2: 'str', plus1: 'con',
    } as StatBuild;
    const at4 = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level: 4, statBuild: build });
    expect(at4.abilities.str).toBe(19);
    expect(at4.abilities.con).toBe(15);   // untouched so far

    const at6 = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level: 6, statBuild: build });
    expect(at6.abilities.str).toBe(20);
    expect(at6.abilities.con).toBe(16);   // the spare point, not lost
  });

  it('follows the kit, so a Duelist raises Dexterity and a Martial raises Strength', () => {
    const d = buildCharacter({ classId: 'fighter', team: 'team1', position: HERE, level: 8, kitId: 'duelist' });
    expect(d.abilities.dex).toBe(20);
    expect(d.abilities.con).toBe(18);
    expect(d.abilities.str).toBe(13);
  });

  it('never exceeds 20 anywhere', () => {
    for (const id of Object.keys(CLASSES)) {
      const c = buildCharacter({ classId: id, team: 'team1', position: HERE, level: 8 });
      for (const ab of ABILITIES) expect(c.abilities[ab], `${id}.${ab}`).toBeLessThanOrEqual(20);
    }
  });
});

describe('quick-start templates', () => {
  it('a template that names a kit gets that kit, gear and all', () => {
    const c = newCampaign(3);
    expect(applyPartyTemplate(c, 'hunt')).toBe(true);
    const fighter = c.characters.find((ch) => ch.classId === 'fighter')!;
    expect(fighter.kitId).toBe('archer');
    // The bug this guards: fitCharacter read CLASSES[...].equipment directly,
    // which would hand an Archer a longsword and a shield and silently undo it.
    expect(fighter.equipped.mainHand).toBe('longbow');
    expect(fighter.equipped.offHand).toBeUndefined();
    const built = buildCampaignParty(c)[c.characters.indexOf(fighter)]!;
    expect(built.featureIds).toContain('archery');
  });

  it('a template with no kit gets the class default', () => {
    const c = newCampaign(3);
    applyPartyTemplate(c, 'classic');
    const fighter = c.characters.find((ch) => ch.classId === 'fighter')!;
    expect(fighter.kitId).toBeUndefined();
    expect(fighter.equipped.mainHand).toBe('longsword');
  });

  it('every template names a kit its class actually has', () => {
    for (const t of PARTY_TEMPLATES) {
      for (const m of t.members) {
        if (!m.kitId) continue;
        const ids = CLASSES[m.classId]?.kits?.map((k) => k.id) ?? [];
        expect(ids, `${t.id}: ${m.classId} has no kit ${m.kitId}`).toContain(m.kitId);
      }
    }
  });

  it('switching template twice does not leave the old kit behind', () => {
    const c = newCampaign(3);
    applyPartyTemplate(c, 'hunt');       // fighter -> archer
    applyPartyTemplate(c, 'classic');    // fighter -> default
    const fighter = c.characters.find((ch) => ch.classId === 'fighter')!;
    expect(fighter.kitId).toBeUndefined();
    expect(fighter.equipped.mainHand).toBe('longsword');
  });
});

describe('the forge panel shows what the character actually has', () => {
  it('a kit default reaches the Fighting Style panel', () => {
    // The panel used to compute `ch.choices?.[id] ?? cp.default` itself, so an
    // Archer displayed "Dueling" selected while the built character had Archery.
    // The UI was not describing the character.
    const c = newCampaign(5);
    c.characters[0]!.classId = 'fighter';
    const cp = CLASSES.fighter!.choices!.find((x) => x.id === 'fighting-style')!;
    expect(partyChoice(c.characters[0]!, cp.id, cp.default)).toBe('dueling');
    setPartyKit(c, 0, 'archer');
    expect(partyChoice(c.characters[0]!, cp.id, cp.default)).toBe('archery');
    // …and it agrees with the combatant, which is the whole point.
    expect(buildCampaignParty(c)[0]!.featureIds).toContain('archery');
  });

  it('an explicit pick still shows as the explicit pick', () => {
    const c = newCampaign(5);
    c.characters[0]!.classId = 'fighter';
    setPartyKit(c, 0, 'archer');
    setPartyChoice(c, 0, 'fighting-style', 'defense');
    expect(partyChoice(c.characters[0]!, 'fighting-style', 'dueling')).toBe('defense');
  });

  it('and the forge actually calls it', async () => {
    // Source-read, in the manner of the other harness guards: the helper being
    // correct is worthless if the panel keeps computing its own answer, and
    // that is precisely the bug that shipped.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(fileURLToPath(new URL('../web/src/ForgeMember.tsx', import.meta.url)), 'utf8');
    expect(src).toContain('partyChoice(ch, cp.id, cp.default)');
    expect(src, 'the panel computes its own selection again')
      .not.toMatch(/selected\s*=\s*ch\.choices\?\.\[cp\.id\]/);
  });

  it('a class with no kits falls through to the class default', () => {
    const c = newCampaign(5);
    expect(partyChoice(c.characters[1]!, 'fighting-style', 'dueling')).toBe('dueling');
  });
});
