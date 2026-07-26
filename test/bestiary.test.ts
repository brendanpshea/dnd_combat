import { describe, it, expect } from 'vitest';
import { distanceFeet } from '../src/engine/grid.js';
import { Combat } from '../src/engine/combat.js';
import { buildParty, buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS, MONSTER_XP, monsterLevel } from '../src/data/monsters.js';
import { buildEncounter, ENCOUNTERS, encounterXP } from '../src/data/encounters.js';
import { SPELLS } from '../src/data/spells.js';
import { BREATH_WEAPONS } from '../src/data/features.js';
import { WEAPONS } from '../src/data/weapons.js';
import { chooseAction } from '../src/ai/greedy.js';
import { applyDamage, resolveAttack } from '../src/engine/rules/attack.js';
import { applyHealing } from '../src/engine/rules/heal.js';
import { arenaRoster } from '../src/arena/encounter.js';
import { acOf } from '../src/data/armor.js';
import { FEATURES } from '../src/data/features.js';
import { makeCombatant } from './helpers.js';
import { abilityMod, proficiencyBonus, Position, Combatant } from '../src/engine/types.js';

function until(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 60) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe(id);
}

describe('new monster stat blocks', () => {
  it('derived attack bonuses match SRD printed values', () => {
    // bandit scimitar (dex 12 finesse): +1 +2 = +3
    expect(abilityMod(MONSTERS['bandit']!.abilities.dex) + proficiencyBonus(1)).toBe(3);
    // dire wolf bite (str 17): +3 +2 = +5
    expect(abilityMod(MONSTERS['dire-wolf']!.abilities.str) + proficiencyBonus(1)).toBe(5);
    // giant spider bite (dex 16 finesse): +3 +2 = +5
    expect(abilityMod(MONSTERS['giant-spider']!.abilities.dex) + proficiencyBonus(1)).toBe(5);
  });

  it('acolyte is a caster with slots and cleric spells', () => {
    const a = buildMonster('acolyte', 'team2', { x: 0, y: 0 });
    expect(a.spellcastingAbility).toBe('wis');
    expect(a.spellSlots).toEqual([{ current: 3, max: 3 }]);
    expect(a.spellIds).toEqual(expect.arrayContaining(['sacred-flame', 'cure-wounds', 'bless']));
  });

  it('every monster has an XP entry (guards the parallel XP map from drift)', () => {
    for (const id of Object.keys(MONSTERS)) {
      expect(MONSTER_XP[id], `${id} missing from MONSTER_XP`).toBeGreaterThan(0);
    }
    expect(encounterXP('kobolds')).toBe(6 * 25);
    expect(encounterXP('cult')).toBe(450 + 50 + 200 + 200 + 200);
  });

  it('all new encounters build and start combat cleanly', () => {
    for (const id of ['bandits', 'spiders', 'crypt']) {
      const mob = buildEncounter(id, 'team2', 7);
      expect(new Set(mob.map((m) => m.id)).size).toBe(mob.length);
      const c = new Combat({ seed: 1, combatants: [...buildParty('team1', 0, 3), ...mob] });
      expect(c.state.initiativeOrder.length).toBe(4 + mob.length);
    }
    expect(ENCOUNTERS['bandits']!.suggestedLevel).toBe(2);
  });
});

describe('on-hit save riders', () => {
  it('ghoul claws paralyze on a failed save; paralysis is save-ends and does not wake on damage', () => {
    let verified = false;
    for (let seed = 1; seed <= 80 && !verified; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          buildMonster('ghoul', 'team2', { x: 3, y: 4 }, '1'),
          makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      const ghoul = Object.values(c.state.combatants).find((x) => x.classId === 'ghoul')!;
      until(c, ghoul.id);
      const events = c.apply({ kind: 'attack', weaponId: 'ghoul-claws', targetId: 'pc' });
      const dmg = events.find((e) => e.type === 'damageDealt');
      const save = events.find((e) => e.type === 'savingThrow' && e.ability === 'con');
      if (!dmg || !save) continue; // missed
      if (save.type === 'savingThrow' && !save.success) {
        expect(c.state.combatants['pc']!.conditions.some((k) => k.id === 'paralyzed')).toBe(true);
        // Paralyzed does NOT wake on damage (unlike sleep).
        until(c, ghoul.id);
        c.apply({ kind: 'attack', weaponId: 'ghoul-bite', targetId: 'pc' });
        if (c.state.combatants['pc']!.alive) {
          expect(c.state.combatants['pc']!.conditions.some((k) => k.id === 'paralyzed')).toBe(true);
        }
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  it('paralyzed target can be auto-crit from melee and takes no actions', () => {
    let verified = false;
    for (let seed = 1; seed <= 80 && !verified; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          buildMonster('ghoul', 'team2', { x: 3, y: 4 }, '1'),
          makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      const ghoul = Object.values(c.state.combatants).find((x) => x.classId === 'ghoul')!;
      until(c, ghoul.id);
      const events = c.apply({ kind: 'attack', weaponId: 'ghoul-claws', targetId: 'pc' });
      const save = events.find((e) => e.type === 'savingThrow');
      if (save?.type === 'savingThrow' && !save.success && c.state.combatants['pc']!.conditions.some((k) => k.id === 'paralyzed')) {
        c.apply({ kind: 'endTurn' });
        expect(c.activeId).toBe('pc');
        const kinds = new Set(c.legalActions().map((a) => a.kind));
        expect(kinds.has('attack')).toBe(false);
        expect(kinds.has('move')).toBe(false);
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  it('giant spider bite deals bonus poison damage and can poison', () => {
    let sawPoisonDmg = false;
    let sawPoisoned = false;
    for (let seed = 1; seed <= 60 && !(sawPoisonDmg && sawPoisoned); seed++) {
      const c = new Combat({
        seed,
        combatants: [
          buildMonster('giant-spider', 'team2', { x: 3, y: 4 }, '1'),
          makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      const spider = Object.values(c.state.combatants).find((x) => x.classId === 'giant-spider')!;
      until(c, spider.id);
      const events = c.apply({ kind: 'attack', weaponId: 'spider-bite', targetId: 'pc' });
      const dmgs = events.filter((e) => e.type === 'damageDealt');
      if (dmgs.some((e) => e.type === 'damageDealt' && e.damageType === 'poison')) sawPoisonDmg = true;
      if (c.state.combatants['pc']!.conditions.some((k) => k.id === 'poisoned')) sawPoisoned = true;
    }
    expect(sawPoisonDmg).toBe(true);
    expect(sawPoisoned).toBe(true);
  });

  it('poisoned imposes disadvantage on the victim\'s attacks', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, conditions: [{ id: 'poisoned' }] }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 }, hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'pc');
    const events = c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'foe' });
    const roll = events.find((e) => e.type === 'attackRolled');
    expect(roll?.type === 'attackRolled' && roll.disSources.includes('poisoned')).toBe(true);
  });
});

describe('second monster batch', () => {
  it('reuses existing seams: orc adrenaline rush, animated armor immunities, caster fanatic', () => {
    const orc = buildMonster('orc', 'team2', { x: 0, y: 0 });
    expect(orc.featureIds).toContain('adrenaline-rush');
    expect(orc.featureUses['adrenaline-rush']!.current).toBe(proficiencyBonus(1)); // PB uses

    const armor = buildMonster('animated-armor', 'team2', { x: 0, y: 0 });
    expect(armor.immunities).toEqual(expect.arrayContaining(['poison', 'psychic']));

    const fanatic = buildMonster('cult-fanatic', 'team2', { x: 0, y: 0 });
    expect(fanatic.spellcastingAbility).toBe('wis');
    expect(fanatic.spellSlots).toEqual([{ current: 4, max: 4 }, { current: 2, max: 2 }]);
    expect(fanatic.spellIds).toContain('hold-person');
  });

  it('kobold pack tactics grants advantage when a kobold ally flanks', () => {
    const c = new Combat({
      seed: 5,
      combatants: [
        buildMonster('kobold', 'team2', { x: 3, y: 4 }, '1'),
        buildMonster('kobold', 'team2', { x: 4, y: 3 }, '2'),
        makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000 }),
      ],
    });
    const kobolds = Object.values(c.state.combatants).filter((x) => x.classId === 'kobold').map((k) => k.id);
    let guard = 0;
    while (!kobolds.includes(c.activeId) && guard++ < 10) c.apply({ kind: 'endTurn' });
    const events = c.apply({ kind: 'attack', weaponId: 'dagger', targetId: 'pc' });
    const roll = events.find((e) => e.type === 'attackRolled');
    expect(roll?.type === 'attackRolled' && roll.advSources.includes('pack tactics')).toBe(true);
  });

  it('snake constrict weapon applies restrained condition on hit', () => {
    let verified = false;
    for (let seed = 1; seed <= 50 && !verified; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          buildMonster('giant-constrictor-snake', 'team2', { x: 3, y: 4 }, '1'),
          makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000, abilities: { str: 1, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }),
        ],
      });
      until(c, 'team2-giant-constrictor-snake1');
      const events = c.apply({ kind: 'attack', weaponId: 'snake-constrict', targetId: 'pc' });
      const applied = events.find((e) => e.type === 'conditionApplied' && e.condition === 'restrained');
      if (applied) {
        const pc = c.state.combatants['pc']!;
        expect(pc.conditions.some((cond) => cond.id === 'restrained')).toBe(true);
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  it("will-o'-wisp Consume Life drains an adjacent enemy and heals the wisp", () => {
    let verified = false;
    for (let seed = 1; seed <= 30 && !verified; seed++) {
      const wisp = { ...buildMonster('will-o-wisp', 'team2', { x: 3, y: 3 }, '1'), hp: 8 }; // wounded, so the heal is real
      const c = new Combat({
        seed,
        combatants: [
          wisp,
          makeCombatant({ id: 'pc', team: 'team1', position: { x: 4, y: 3 }, hp: 1000, maxHp: 1000, abilities: { str: 10, dex: 10, con: 6, int: 10, wis: 10, cha: 10 } }),
        ],
      });
      until(c, 'team2-will-o-wisp1');
      const use = c.legalActions().find((a) => a.kind === 'useFeature' && a.featureId === 'consume-life');
      if (!use) continue;
      const hpBefore = c.state.combatants['team2-will-o-wisp1']!.hp;
      const events = c.apply(use);
      const w = c.state.combatants['team2-will-o-wisp1']!; // fresh state after apply
      const dmg = events.find((e) => e.type === 'damageDealt' && e.damageType === 'necrotic');
      if (dmg && dmg.type === 'damageDealt' && dmg.amount > 0) {
        expect(w.hp).toBeGreaterThan(hpBefore);        // drained life back into itself
        expect(w.hp).toBeLessThanOrEqual(w.maxHp);     // never over-heals
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  it('mummy Dreadful Glare frightens, and paralyzes on a save failed by 5+', () => {
    let sawFright = false;
    let sawParalyze = false;
    for (let seed = 1; seed <= 80 && !(sawFright && sawParalyze); seed++) {
      const c = new Combat({
        seed,
        combatants: [
          buildMonster('mummy', 'team2', { x: 3, y: 3 }, '1'),
          makeCombatant({ id: 'pc', team: 'team1', position: { x: 5, y: 3 }, hp: 1000, maxHp: 1000, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 6, cha: 10 } }),
        ],
      });
      until(c, 'team2-mummy1');
      const use = c.legalActions().find((a) => a.kind === 'useFeature' && a.featureId === 'dreadful-glare');
      if (!use) continue;
      const applied = c.apply(use).find((e) => e.type === 'conditionApplied');
      if (applied?.type === 'conditionApplied') {
        if (applied.condition === 'frightened') sawFright = true;
        if (applied.condition === 'paralyzed') sawParalyze = true;
      }
    }
    expect(sawFright).toBe(true);
    expect(sawParalyze).toBe(true);
  });
});

describe('monster proficiency scales with CR', () => {
  it('maps CR to the SRD proficiency-bonus table', () => {
    // CR band -> PB: 0-4=+2, 5-8=+3, 9-12=+4, 13-16=+5, 17-20=+6, 21-24=+7.
    const expected: Array<[number, number]> = [
      [0.25, 2], [1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4], [13, 5], [17, 6], [21, 7], [24, 7],
    ];
    for (const [cr, pb] of expected) {
      expect(proficiencyBonus(monsterLevel(cr))).toBe(pb);
    }
    // Absent CR defaults to level 1 / PB +2 (every current monster).
    expect(monsterLevel(undefined)).toBe(1);
  });

  it('a CR-4 wyrmling still casts its breath at PB +2 (DC 8 + 2 + Con)', () => {
    const red = buildMonster('red-wyrmling', 'team2', { x: 0, y: 0 });
    expect(red.level).toBe(4); // from cr: 4
    // Breath DC = 8 + PB(4) + Con mod(17 -> +3) = 13, the SRD red wyrmling DC.
    expect(8 + proficiencyBonus(red.level) + abilityMod(red.abilities.con)).toBe(13);
  });
});

describe('dragon wyrmling breath weapons', () => {
  it('a red wyrmling breathes fire in an auto-aimed cone, halved on a save', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const red = { ...buildMonster('red-wyrmling', 'team2', { x: 3, y: 3 }, '1') };
      const c = new Combat({
        seed,
        combatants: [
          red,
          makeCombatant({ id: 'a', team: 'team1', position: { x: 4, y: 3 }, hp: 500, maxHp: 500, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }),
          makeCombatant({ id: 'b', team: 'team1', position: { x: 5, y: 3 }, hp: 500, maxHp: 500, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }),
        ],
      });
      until(c, 'team2-red-wyrmling1');
      const use = c.legalActions().find((x) => x.kind === 'useFeature' && x.featureId === 'breath-fire');
      if (!use) continue;
      const ev = c.apply(use);
      const fire = ev.filter((e) => e.type === 'damageDealt' && e.damageType === 'fire');
      if (fire.length === 0) continue;
      expect(fire.length).toBeGreaterThanOrEqual(1); // the cone caught someone
      // Save-for-half: a successful save takes at most half of 7d6's max (21).
      for (const e of ev) {
        if (e.type === 'savingThrow' && e.success) {
          const dealt = fire.find((f) => f.type === 'damageDealt' && f.targetId === e.combatantId);
          if (dealt && dealt.type === 'damageDealt') expect(dealt.amount).toBeLessThanOrEqual(21);
        }
      }
      return;
    }
    throw new Error('red wyrmling never breathed across 30 seeds');
  });

  it('a wyrmling is immune to its own element', () => {
    const r1 = { ...buildMonster('red-wyrmling', 'team2', { x: 3, y: 3 }, '1') };
    const r2 = { ...buildMonster('red-wyrmling', 'team1', { x: 4, y: 3 }, '2') }; // enemy, in the cone
    const c = new Combat({ seed: 1, combatants: [r1, r2] });
    until(c, 'team2-red-wyrmling1');
    const use = c.legalActions().find((x) => x.kind === 'useFeature' && x.featureId === 'breath-fire')!;
    const ev = c.apply(use);
    const dealtToR2 = ev.filter((e) => e.type === 'damageDealt' && e.targetId === 'team1-red-wyrmling2')
      .reduce((s, e) => s + (e.type === 'damageDealt' ? e.amount : 0), 0);
    expect(dealtToR2).toBe(0); // fire-immune
  });

  it('breath is Recharge 5–6: spent on use, and comes back on a d6 roll', () => {
    const red = { ...buildMonster('red-wyrmling', 'team2', { x: 3, y: 3 }, '1') };
    const c = new Combat({
      seed: 2,
      combatants: [red, makeCombatant({ id: 'a', team: 'team1', position: { x: 4, y: 3 }, hp: 500, maxHp: 500 })],
    });
    until(c, 'team2-red-wyrmling1');
    expect(c.state.combatants['team2-red-wyrmling1']!.featureUses['breath-fire']!.current).toBe(1); // charged
    c.apply(c.legalActions().find((x) => x.kind === 'useFeature' && x.featureId === 'breath-fire')!);
    expect(c.state.combatants['team2-red-wyrmling1']!.featureUses['breath-fire']!.current).toBe(0); // spent

    // Over enough of its turns, the d6 eventually recharges it (emits an event).
    let recharged = false;
    for (let i = 0; i < 60 && !recharged; i++) {
      const events = c.apply({ kind: 'endTurn' });
      if (events.some((e) => e.type === 'recharged' && e.featureId === 'breath-fire')) recharged = true;
    }
    expect(recharged).toBe(true);
    expect(c.state.combatants['team2-red-wyrmling1']!.featureUses['breath-fire']!.current).toBe(1);
  });
});

describe('2024 dragonborn breath weapon', () => {
  const castBreath = (level: number, seed: number) => {
    const db = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 3, y: 3 }, speciesId: 'dragonborn', level }), id: 'db' };
    const c = new Combat({ seed, combatants: [db, makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 4 }, hp: 500, maxHp: 500, abilities: { str: 10, dex: 1, con: 10, int: 10, wis: 10, cha: 10 } })] });
    return SPELLS['breath-weapon']!.cast({ state: c.state, casterId: 'db', slotLevel: 0, targetIds: [], positions: [{ x: 3, y: 4 }] });
  };

  it('uses a Constitution-based save DC (8 + PB + Con mod)', () => {
    const db = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 3, y: 3 }, speciesId: 'dragonborn', level: 1 });
    const expected = 8 + proficiencyBonus(1) + abilityMod(db.abilities.con);
    const ev = castBreath(1, 1);
    const save = ev.find((e) => e.type === 'savingThrow');
    expect(save?.type === 'savingThrow' && save.dc).toBe(expected);
  });

  it('scales past 1d10 by level 5 (2d10)', () => {
    // A level-1 breath can never exceed 10; a level-5 (2d10) routinely does.
    let sawBig = false;
    for (let seed = 1; seed <= 40 && !sawBig; seed++) {
      const dealt = castBreath(5, seed).find((e) => e.type === 'damageDealt');
      if (dealt?.type === 'damageDealt' && dealt.amount > 10) sawBig = true;
    }
    expect(sawBig).toBe(true);
  });
});

describe('new encounters complete under AI', () => {
  it('party beats or loses each new encounter without stalling', () => {
    for (const encId of [
      'bandits', 'spiders', 'crypt', 'kobolds', 'raiders', 'wilds', 'cult',
      'watch', 'ambush', 'swamp', 'pack', 'syndicate',
      'badger-den', 'toad-swamp', 'hyena-pack', 'boar-stampede', 'snake-pit',
      'gargoyle-perch', 'fire-nexus', 'water-vortex', 'earth-tremor', 'tempest-eye', 'elemental-cataclysm',
      'sprite-glade', 'satyr-revelry', 'dryad-grove', 'hag-coven', 'unicorn-sanctuary',
      'cockatrice-flock', 'harpy-roost', 'owlbear-den', 'manticore-cliff', 'gorgon-maze',
      'shadow-ambush', 'specter-haunt', 'wight-tomb', 'mummy-crypt', 'wisp-bog',
      'black-dragon-den', 'green-dragon-den', 'white-dragon-den', 'blue-dragon-den', 'red-dragon-den', 'chromatic-clutch'
    ]) {
      const c = new Combat({
        seed: 7,
        mapId: 'ruins',
        combatants: [...buildParty('team1', 0, ENCOUNTERS[encId]!.suggestedLevel), ...buildEncounter(encId, 'team2', 7)],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 6000) {
        c.apply(chooseAction(c.state, c.activeId));
      }
      expect(c.isOver()).toBe(true);
    }
  }, 60000);
});

/**
 * The CR 5-10 shelf. The roster topped out at 1,800 XP, which meant the arena
 * could only make a high-budget wave harder by adding bodies — and it caps at
 * six. These blocks are what a big budget buys instead.
 */
describe('CR 5-10 monsters', () => {
  const SHELF = [
    'hill-giant', 'stone-giant', 'frost-giant', 'fire-giant',
    'chimera', 'wyvern', 'hydra',
    'young-white', 'young-black', 'young-green', 'young-blue', 'young-red',
  ];

  it('all build, are priced, and carry a CR', () => {
    for (const id of SHELF) {
      const m = MONSTERS[id];
      expect(m, id).toBeDefined();
      // Without a CR they'd derive PB +2 and hit like a CR 1 monster.
      expect(m!.cr, `${id} has no CR`).toBeGreaterThanOrEqual(5);
      expect(MONSTER_XP[id], `${id} has no XP`).toBeGreaterThan(0);
      expect(() => buildMonster(id, 'team2', { x: 0, y: 0 }), id).not.toThrow();
    }
  });

  it('fills the XP band above 1800, which was empty', () => {
    const above = Object.values(MONSTERS).filter((m) => (MONSTER_XP[m.id] ?? 0) > 1800);
    expect(above.length).toBeGreaterThanOrEqual(11);
    // …and reaches high enough that a level-5 even fight (~14,000 adjusted)
    // can be built out of a few real threats rather than six of anything.
    expect(Math.max(...Object.values(MONSTER_XP))).toBeGreaterThanOrEqual(5900);
  });

  it('a young dragon out-hits its wyrmling on both bite and breath', () => {
    for (const [young, wyrmling] of [
      ['young-red', 'red-wyrmling'], ['young-white', 'white-wyrmling'],
      ['young-black', 'black-wyrmling'], ['young-blue', 'blue-wyrmling'],
      ['young-green', 'green-wyrmling'],
    ]) {
      const y = MONSTERS[young!]!, w = MONSTERS[wyrmling!]!;
      expect(y.hp, young).toBeGreaterThan(w.hp);
      expect(y.cr!, young).toBeGreaterThan(w.cr ?? 0);
      const yb = BREATH_WEAPONS[y.featureIds![0]!]!, wb = BREATH_WEAPONS[w.featureIds![0]!]!;
      const avg = (d: string) => {
        const [n, f] = d.split('d').map(Number);
        return n! * (f! + 1) / 2;
      };
      expect(avg(yb.dice), `${young} breath`).toBeGreaterThan(avg(wb.dice));
    }
  });

  it('the hydra trades a big body for a wall of attacks', () => {
    const h = MONSTERS['hydra']!;
    expect(h.attacksPerAction).toBe(5);
    // Five small bites, not five huge ones — the point is the action economy.
    expect(WEAPONS[h.weaponIds[0]!]!.damage).toBe('1d10');
  });

  it('each resolves into a finished fight against a level-8 party', () => {
    for (const id of SHELF) {
      const c = new Combat({
        seed: 3, mapId: 'ruins',
        combatants: [
          ...buildParty('team1', 0, 8),
          buildMonster(id, 'team2', { x: 4, y: 7 }),
        ],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 4000) c.apply(chooseAction(c.state, c.activeId));
      expect(c.isOver(), `${id} did not resolve`).toBe(true);
    }
  }, 60000);
});

/**
 * Regeneration. The trait is only interesting because the *right* damage type
 * turns it off — otherwise it's a flat HP bonus. These pin the suppression, not
 * just the healing.
 */
describe('troll regeneration', () => {
  function trollFight(extra: Combatant[] = [], seed = 1) {
    const troll = buildMonster('troll', 'team2', { x: 4, y: 7 });
    const c = new Combat({
      seed, mapId: 'ruins',
      combatants: [...buildParty('team1', 0, 3), troll, ...extra],
    });
    return { c, id: troll.id };
  }

  /** HP read fresh — `apply` clones state, so a held combatant goes stale. */
  const hp = (c: Combat, id: string) => c.state.combatants[id]!.hp;

  /** Run to the *next* start of `id`'s turn. Always ends at least one turn, so
   *  it can't return on a turn that started before the test set anything up. */
  function nextTurnOf(c: Combat, id: string) {
    c.apply({ kind: 'endTurn' });
    let guard = 0;
    while (c.activeId !== id && guard++ < 60) c.apply({ kind: 'endTurn' });
    expect(c.activeId).toBe(id);
  }

  it('heals at the start of its turn when nothing has burned it', () => {
    const { c, id } = trollFight();
    c.state.combatants[id]!.hp = 40;
    nextTurnOf(c, id);
    expect(hp(c, id)).toBe(50);
  });

  it('does not heal past its maximum', () => {
    const { c, id } = trollFight();
    const max = c.state.combatants[id]!.maxHp;
    c.state.combatants[id]!.hp = max - 3;
    nextTurnOf(c, id);
    expect(hp(c, id)).toBe(max);
  });

  it('fire or acid suppresses exactly one turn of healing, then it re-arms', () => {
    for (const type of ['fire', 'acid'] as const) {
      const { c, id } = trollFight();
      c.state.combatants[id]!.hp = 40;
      applyDamage(c.state, id, id, 5, type);
      expect(hp(c, id)).toBe(35);
      nextTurnOf(c, id);
      expect(hp(c, id), `${type} should have stopped the heal`).toBe(35);
      // Nothing burns it again, so the next turn regenerates normally.
      nextTurnOf(c, id);
      expect(hp(c, id), `${type} suppression should last one turn only`).toBe(45);
    }
  });

  it('slashing damage does not suppress it', () => {
    const { c, id } = trollFight();
    c.state.combatants[id]!.hp = 40;
    applyDamage(c.state, id, id, 5, 'slashing');
    nextTurnOf(c, id);
    expect(hp(c, id)).toBe(45);
  });

  it('a fire hit soaked entirely by temp HP still stops it', () => {
    const { c, id } = trollFight();
    c.state.combatants[id]!.hp = 40;
    c.state.combatants[id]!.tempHp = 20;
    applyDamage(c.state, id, id, 5, 'fire');
    expect(hp(c, id), 'temp HP should have absorbed it').toBe(40);
    nextTurnOf(c, id);
    expect(hp(c, id)).toBe(40);
  });

  it('two trolls do not share one suppression flag', () => {
    const b = buildMonster('troll', 'team2', { x: 3, y: 7 }, '2');
    const { c, id: a } = trollFight([b]);
    c.state.combatants[a]!.hp = 40;
    c.state.combatants[b.id]!.hp = 40;
    applyDamage(c.state, a, a, 5, 'fire');
    nextTurnOf(c, a);
    expect(hp(c, a), 'burned troll').toBe(35);
    // b's turn may come round more than once while we wait; what matters is
    // that it regenerated at all and a still hasn't.
    nextTurnOf(c, b.id);
    expect(hp(c, b.id), 'untouched troll').toBeGreaterThan(40);
    expect(hp(c, a), 'burned troll, still suppressed on its one turn').toBe(35);
  });

  it('does not resurrect a dead troll', () => {
    const { c, id } = trollFight();
    applyDamage(c.state, id, id, 999, 'slashing');
    expect(c.state.combatants[id]!.alive).toBe(false);
    expect(hp(c, id)).toBe(0);
  });

  // The trait has to change how the fight goes, not just pad the HP bar.
  // Measured by running the same seeds with the trait on and off rather than
  // by injecting damage mid-loop, which would end fights out of turn order.
  it('materially lengthens the fight compared to the same troll without it', () => {
    const meanRounds = (regenerating: boolean) => {
      let rounds = 0;
      const N = 8;
      for (let seed = 1; seed <= N; seed++) {
        const { c, id } = trollFight([], seed);
        if (!regenerating) delete c.state.combatants[id]!.regeneration;
        let steps = 0;
        while (!c.isOver() && steps++ < 2000) c.apply(chooseAction(c.state, c.activeId));
        rounds += c.state.round;
      }
      return rounds / N;
    };
    expect(meanRounds(true)).toBeGreaterThan(meanRounds(false));
  });
});

/**
 * Tier 2: the empty creature types. Fiends were zero in a game whose paladin
 * and cleric kits exist to answer them; oozes were zero; constructs were one.
 */
describe('fiends, oozes and constructs', () => {
  const FIENDS = ['imp', 'quasit', 'dretch', 'hell-hound', 'barbed-devil', 'vrock'];
  const OOZES = ['gray-ooze', 'ochre-jelly', 'gelatinous-cube', 'black-pudding'];
  const CONSTRUCTS = ['flying-sword', 'rug-of-smothering', 'flesh-golem'];

  it('all build, are typed, and are priced', () => {
    for (const [ids, type] of [[FIENDS, 'fiend'], [OOZES, 'ooze'], [CONSTRUCTS, 'construct']] as const) {
      for (const id of ids) {
        const m = MONSTERS[id];
        expect(m, id).toBeDefined();
        expect(m!.creatureType, id).toBe(type);
        expect(MONSTER_XP[id], `${id} has no XP`).toBeGreaterThan(0);
        expect(() => buildMonster(id, 'team2', { x: 0, y: 0 }), id).not.toThrow();
      }
    }
  });

  it('fills the three types that had nothing (or almost nothing) in them', () => {
    const count = (t: string) => Object.values(MONSTERS).filter((m) => m.creatureType === t).length;
    expect(count('fiend')).toBeGreaterThanOrEqual(6);
    expect(count('ooze')).toBeGreaterThanOrEqual(4);
    expect(count('construct')).toBeGreaterThanOrEqual(4);
  });

  // The reason to field a fiend over an equal-XP humanoid.
  it('the bigger fiends carry Magic Resistance', () => {
    for (const id of ['imp', 'quasit', 'barbed-devil', 'vrock']) {
      expect(MONSTERS[id]!.featureIds, id).toContain('magic-resistance');
    }
  });

  // An ooze that a sword can't hurt is a different tactical problem from one
  // with more HP, and this is the line that makes it so.
  it("an ochre jelly ignores a rogue's shortsword but not a mace", () => {
    const jelly = buildMonster('ochre-jelly', 'team2', { x: 0, y: 0 });
    const c = new Combat({ seed: 1, mapId: 'ruins', combatants: [...buildParty('team1', 0, 3), jelly] });
    const before = c.state.combatants[jelly.id]!.hp;
    applyDamage(c.state, jelly.id, jelly.id, 12, 'slashing');
    expect(c.state.combatants[jelly.id]!.hp, 'slashing should be ignored').toBe(before);
    applyDamage(c.state, jelly.id, jelly.id, 12, 'bludgeoning');
    expect(c.state.combatants[jelly.id]!.hp).toBe(before - 12);
  });

  it('oozes are slow enough that positioning beats them', () => {
    for (const id of OOZES) {
      expect(MONSTERS[id]!.speed, id).toBeLessThanOrEqual(20);
    }
  });

  it('the rug pins what it hits', () => {
    expect(WEAPONS[MONSTERS['rug-of-smothering']!.weaponIds[0]!]!.onHitCondition).toBe('restrained');
  });

  it('each resolves into a finished fight', () => {
    for (const id of [...FIENDS, ...OOZES, ...CONSTRUCTS]) {
      const c = new Combat({
        seed: 4, mapId: 'ruins',
        combatants: [...buildParty('team1', 0, 5), buildMonster(id, 'team2', { x: 4, y: 7 })],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 4000) c.apply(chooseAction(c.state, c.activeId));
      expect(c.isOver(), `${id} did not resolve`).toBe(true);
    }
  }, 60000);
});

/**
 * Type ceilings. The measured problem: at a level-5 even-fight budget,
 * undead/beast/humanoid turned up in 5-7% of generated fights while
 * dragon/giant/monstrosity ran 20-27%. The generator was working correctly --
 * those types simply had no member expensive enough to fill a high-budget
 * slot, so the reroll-on-underfill wrapper kept discarding them.
 */
describe('creature type ceilings', () => {
  const NEW = [
    'ghast', 'banshee', 'ghost', 'wraith', 'vampire-spawn',
    'giant-scorpion', 'elephant', 'giant-crocodile', 'mammoth', 'giant-ape',
    'berserker', 'veteran', 'gladiator', 'mage', 'assassin',
    'scarecrow', 'shield-guardian', 'stone-golem',
    'magmin', 'azer', 'salamander', 'invisible-stalker',
  ];

  it('all build, are priced, and carry a CR where they need one', () => {
    for (const id of NEW) {
      const m = MONSTERS[id];
      expect(m, id).toBeDefined();
      expect(MONSTER_XP[id], `${id} has no XP`).toBeGreaterThan(0);
      // Anything past CR 4 must declare its CR or it derives PB +2 and fights
      // like a CR 1 monster wearing a big HP bar.
      if ((MONSTER_XP[id] ?? 0) > 1100) expect(m!.cr, `${id} has no CR`).toBeGreaterThanOrEqual(5);
      expect(() => buildMonster(id, 'team2', { x: 0, y: 0 }), id).not.toThrow();
    }
  });

  // The actual fix, stated as an invariant: every type the arena can field
  // must have something that can headline a big fight. Without this a type
  // silently drops out of the late game.
  it('every arena creature type reaches at least 1800 XP', () => {
    // Two types the SRD gives no top end to, so they can't meet the bar and
    // aren't failures. Both show up in generated fights at roughly half the
    // rate of the others, which is the cost of the gap rather than a bug:
    //   fey  - nothing above the green hag (CR 3); the one creature that did
    //          qualify, the unicorn, is excluded as a benign guardian.
    //   ooze - the SRD has exactly four, topping out at the black pudding.
    const NO_SRD_TOP_END = new Set(['fey', 'ooze']);
    const ceiling = new Map<string, number>();
    for (const m of arenaRoster()) {
      ceiling.set(m.type, Math.max(ceiling.get(m.type) ?? 0, m.xp));
    }
    const low = [...ceiling.entries()]
      .filter(([t, xp]) => xp < 1800 && !NO_SRD_TOP_END.has(t))
      .map(([t, xp]) => `${t}=${xp}`);
    expect(low, `types with no top end: ${low.join(', ')}`).toEqual([]);
  });

  it('the mage is a real caster, not a dagger with a hat', () => {
    const m = buildMonster('mage', 'team2', { x: 0, y: 0 });
    expect(m.spellcastingAbility).toBe('int');
    expect(m.spellIds).toEqual(expect.arrayContaining(['fireball', 'web', 'magic-missile']));
    // Every spell it knows has to exist, or casting throws mid-fight.
    for (const sid of m.spellIds) expect(SPELLS[sid], sid).toBeDefined();
  });

  it('the assassin brings its rogue kit', () => {
    const a = MONSTERS['assassin']!;
    expect(a.featureIds).toEqual(expect.arrayContaining(['sneak-attack', 'assassinate']));
  });

  it('each resolves into a finished fight', () => {
    for (const id of NEW) {
      const c = new Combat({
        seed: 6, mapId: 'ruins',
        combatants: [...buildParty('team1', 0, 6), buildMonster(id, 'team2', { x: 4, y: 7 })],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 4000) c.apply(chooseAction(c.state, c.activeId));
      expect(c.isOver(), `${id} did not resolve`).toBe(true);
    }
  }, 60000);
});

/**
 * Filling the type x price matrix. Elementals started at 100 XP with nothing
 * to fill a cheap slot; fiends had six members and no top end; monstrosities
 * had holes at 450 and 1,100. All three are among the SRD's deeper pools, so
 * the gaps were ours, not the source material's.
 */
describe('mephits, fiends and monstrosities', () => {
  const MEPHITS = ['dust-mephit', 'mud-mephit', 'smoke-mephit', 'ice-mephit', 'magma-mephit', 'steam-mephit'];
  const FIENDS = ['shadow-demon', 'succubus', 'bearded-devil', 'night-hag', 'chain-devil', 'hezrou', 'glabrezu', 'horned-devil'];
  const MONSTROSITIES = ['worg', 'rust-monster', 'griffon', 'ettercap', 'basilisk', 'winter-wolf', 'roper', 'bulette', 'remorhaz'];
  const ALL = [...MEPHITS, ...FIENDS, ...MONSTROSITIES, 'tyrannosaurus'];

  it('all build, are priced, and carry a CR where they need one', () => {
    for (const id of ALL) {
      const m = MONSTERS[id];
      expect(m, id).toBeDefined();
      expect(MONSTER_XP[id], `${id} has no XP`).toBeGreaterThan(0);
      if ((MONSTER_XP[id] ?? 0) > 1100) expect(m!.cr, `${id} has no CR`).toBeGreaterThanOrEqual(5);
      expect(() => buildMonster(id, 'team2', { x: 0, y: 0 }), id).not.toThrow();
    }
  });

  it('gives the elementals a floor to fill cheap slots with', () => {
    const elementals = arenaRoster().filter((m) => m.type === 'elemental');
    expect(Math.min(...elementals.map((m) => m.xp))).toBeLessThanOrEqual(50);
  });

  // The point of the batch: the arena can now buy a single 7,200 XP threat at
  // the top of a run instead of only ever stacking bodies.
  it('reaches a 7200 XP tier, in more than one type', () => {
    const top = arenaRoster().filter((m) => m.xp >= 7200);
    expect(top.length).toBeGreaterThanOrEqual(2);
    expect(new Set(top.map((m) => m.type)).size).toBeGreaterThanOrEqual(2);
  });

  // Same rule, two names: a succubus must not tell the player it used
  // "Fey Charm".
  it('the succubus charms under its own name, sharing the dryad mechanic', () => {
    expect(MONSTERS['succubus']!.featureIds).toContain('charm');
    expect(FEATURES['charm']!.name).toBe('Charm');
    expect(FEATURES['charm']!.apply).toBe(FEATURES['fey-charm']!.apply);
  });

  it('mephit breath is scaled to a mephit, not borrowed from a dragon', () => {
    const mephit = BREATH_WEAPONS['breath-mephit-fire']!;
    const wyrmling = BREATH_WEAPONS['breath-fire']!;
    const avg = (d: string) => { const [n, f] = d.split('d').map(Number); return n! * (f! + 1) / 2; };
    expect(avg(mephit.dice)).toBeLessThan(avg(wyrmling.dice));
  });

  it('each resolves into a finished fight', () => {
    for (const id of ALL) {
      const c = new Combat({
        seed: 8, mapId: 'ruins',
        combatants: [...buildParty('team1', 0, 8), buildMonster(id, 'team2', { x: 4, y: 7 })],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 4000) c.apply(chooseAction(c.state, c.activeId));
      expect(c.isOver(), `${id} did not resolve`).toBe(true);
    }
  }, 60000);
});

/**
 * Creature types that changed in the 2024 rules. These are silent if wrong --
 * nothing breaks, the arena just themes fights oddly and type-gated spells
 * pick the wrong targets -- so they're asserted rather than trusted.
 */
describe('2024 creature types', () => {
  it('goblinoids and their wolves are fey, not humanoid', () => {
    for (const id of ['goblin-warrior', 'goblin-boss', 'bugbear', 'worg']) {
      expect(MONSTERS[id]!.creatureType, id).toBe('fey');
    }
  });

  it('gnolls are fiends, not humanoid', () => {
    expect(MONSTERS['gnoll']!.creatureType).toBe('fiend');
  });

  it('the roper is an aberration, not a monstrosity', () => {
    expect(MONSTERS['roper']!.creatureType).toBe('aberration');
  });

  // A type with one member is a type the generator will never pick, so the
  // roper's retype had to come with company.
  it('aberration has enough members for the generator to field it', () => {
    const ab = arenaRoster().filter((m) => m.type === 'aberration');
    expect(ab.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ab.map((m) => m.xp))).toBeGreaterThanOrEqual(1800);
  });

  /**
   * Command and Suggestion were gated to `humanoid` as shorthand for "has a
   * mind and ears". Retyping goblinoids to fey would have left the game's most
   * common low-level enemy immune to both -- a balance change smuggled in by a
   * bookkeeping fix. Neither spell is type-restricted in 2024 anyway.
   */
  it('Command and Suggestion still work on goblins, and still not on oozes', () => {
    for (const spellId of ['command', 'suggestion']) {
      const types = SPELLS[spellId]!.targeting.creatureTypes;
      expect(types, `${spellId} lost its target set`).toBeDefined();
      expect(types, `${spellId} vs a goblin`).toContain('fey');
      expect(types, `${spellId} vs an ooze`).not.toContain('ooze');
      expect(types, `${spellId} vs a construct`).not.toContain('construct');
    }
  });
});

/**
 * CR and XP have to agree. They are two statements of the same thing -- CR
 * drives proficiency bonus and save DCs, XP drives what the arena and the
 * ladder will pay for the fight -- so a mismatch means a monster that hits
 * like one thing and is priced like another, with nothing to announce it.
 *
 * Caught the Ogre Mage: CR 7, 90 HP, AC 15, casts Fireball, priced at 1,100
 * (the CR 4 figure). Every fight holding one was budgeted at well under half
 * what it plays like.
 */
describe('CR and XP agree', () => {
  const CR_XP: Record<number, number> = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100,
    5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400,
  };

  it('every declared CR matches the SRD XP for it', () => {
    const bad: string[] = [];
    for (const m of Object.values(MONSTERS)) {
      if (m.cr === undefined) continue;
      const expected = CR_XP[m.cr];
      if (expected !== undefined && MONSTER_XP[m.id] !== expected) {
        bad.push(`${m.id}: CR ${m.cr} implies ${expected} XP, priced ${MONSTER_XP[m.id]}`);
      }
    }
    expect(bad, bad.join('; ')).toEqual([]);
  });

  // An absent CR means the builder derives level 1 and PB +2, which is only
  // right through CR 4. Anything priced above that must say so out loud or it
  // fights several points below its price.
  it('anything priced above CR 4 declares its CR', () => {
    const bad = Object.values(MONSTERS)
      .filter((m) => m.cr === undefined && (MONSTER_XP[m.id] ?? 0) > 1100)
      .map((m) => `${m.id} (${MONSTER_XP[m.id]} XP)`);
    expect(bad, `no CR, so they derive PB +2: ${bad.join(', ')}`).toEqual([]);
  });
});

/**
 * Signature abilities: the sweep.
 *
 * Two gaps it found, both of the same shape — a stat block whose numbers are
 * right and whose *rule* is missing, which is invisible to every check that
 * looks at XP or hit points.
 */
describe('signature abilities', () => {
  // A rider that lands automatically is a different creature from one the
  // target rolls against, whatever the average says. The scorpion's sting
  // alone outdamages a level-1 hero's entire hit point total; guaranteed, it
  // is an execution, and the SRD does not write it that way.
  it('big poison riders are save-for-half, not automatic', () => {
    for (const id of ['scorpion-sting', 'imp-sting']) {
      const w = WEAPONS[id]!;
      expect(w.extraDamage, id).toBeDefined();
      expect(w.extraDamage!.save, `${id} rider lands with no save`).toBeDefined();
    }
  });

  it('a saved rider is halved and an unsaved one is not', () => {
    const avg = (dice: string) => { const [n, f] = dice.split('d').map(Number); return n! * (f! + 1) / 2; };
    const scorp = buildMonster('giant-scorpion', 'team2', { x: 4, y: 3 });
    // Two targets differing only in Constitution, so only the save differs.
    const tough = makeCombatant({ id: 'tough', team: 'team1', position: { x: 3, y: 3 }, abilities: { str: 10, dex: 10, con: 20, int: 10, wis: 10, cha: 10 }, hp: 200, maxHp: 200, acOverride: 1 });
    const frail = makeCombatant({ id: 'frail', team: 'team1', position: { x: 5, y: 3 }, abilities: { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 }, hp: 200, maxHp: 200, acOverride: 1 });
    const c = new Combat({ seed: 6, mapId: 'open', combatants: [tough, frail, scorp] });
    let toughTotal = 0, frailTotal = 0;
    for (let i = 0; i < 40; i++) {
      const before = { t: c.state.combatants['tough']!.hp, f: c.state.combatants['frail']!.hp };
      resolveAttack(c.state, scorp.id, 'tough', 'scorpion-sting');
      resolveAttack(c.state, scorp.id, 'frail', 'scorpion-sting');
      toughTotal += before.t - c.state.combatants['tough']!.hp;
      frailTotal += before.f - c.state.combatants['frail']!.hp;
      c.state.combatants['tough']!.hp = 200;
      c.state.combatants['frail']!.hp = 200;
    }
    expect(frailTotal, 'the save has to be worth something').toBeGreaterThan(toughTotal);
    expect(avg(WEAPONS['scorpion-sting']!.extraDamage!.dice)).toBeGreaterThan(10);
  });

  // Death Burst is the whole point of a mephit: kill one in the huddle and you
  // have made your own problem. Without it a mephit is a small elemental with
  // a rider, and the choice of where to kill it does not exist.
  it('mephits and magmin go off when they die', () => {
    const bursty = Object.values(MONSTERS).filter((m) => m.deathBurst);
    expect(bursty.length, 'nothing bursts').toBeGreaterThanOrEqual(6);
    for (const m of bursty) expect(m.deathBurst!.save, m.id).toBeDefined();
  });

  it('the burst catches neighbours, spares the distant, and is not a chain reaction', () => {
    const near = buildMonster('magmin', 'team2', { x: 2, y: 1 }, '1');
    const away = buildMonster('magmin', 'team2', { x: 7, y: 7 }, '2');
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [...buildParty('team1', 0, 3), near, away] });
    const adjacent = Object.values(c.state.combatants)
      .filter((x) => x.team === 'team1' && distanceFeet(x.position, near.position) <= 10)
      .map((x) => x.id);
    expect(adjacent.length, 'nobody stood near enough to test').toBeGreaterThan(0);
    const before = new Map(Object.values(c.state.combatants).map((x) => [x.id, x.hp] as const));
    applyDamage(c.state, near.id, 'nobody', 500, 'slashing');
    for (const id of adjacent) {
      expect(c.state.combatants[id]!.hp, `${id} should have been caught`).toBeLessThan(before.get(id)!);
    }
    expect(c.state.combatants[away.id]!.hp, 'the far magmin is out of range').toBe(before.get(away.id));
  });

  // The rust monster's gameplay is "who can afford to stand next to it" — which
  // requires that standing next to it in plate actually cost something.
  it('rust corrodes metal armour a point at a time, up to its cap', () => {
    const rust = buildMonster('rust-monster', 'team2', { x: 4, y: 3 });
    const knight = makeCombatant({ id: 'knight', team: 'team1', position: { x: 3, y: 3 }, hp: 900, maxHp: 900 });
    knight.equipped = { armor: 'chain-mail' };
    const c = new Combat({ seed: 13, mapId: 'open', combatants: [knight, rust] });
    const before = acOf(c.state.combatants['knight']!);
    for (let i = 0; i < 40; i++) resolveAttack(c.state, rust.id, 'knight', 'rust-monster-antennae');
    const t = c.state.combatants['knight']!;
    expect(t.corroded, 'corrosion should cap, not run away').toBe(3);
    expect(acOf(t)).toBe(before - 3);
  });

  it('rust has nothing to eat on leather, and never leaves you worse than unarmoured', () => {
    const rust = buildMonster('rust-monster', 'team2', { x: 4, y: 3 });
    const scout = makeCombatant({ id: 'scout', team: 'team1', position: { x: 3, y: 3 }, hp: 900, maxHp: 900 });
    scout.equipped = { armor: 'studded-leather' };
    // Chain shirt is metal but barely better than bare skin for a high-Dex
    // wearer, so it is the case where the floor has to bite.
    const dexy = makeCombatant({ id: 'dexy', team: 'team1', position: { x: 5, y: 3 }, abilities: { str: 10, dex: 20, con: 10, int: 10, wis: 10, cha: 10 }, hp: 900, maxHp: 900 });
    dexy.equipped = { armor: 'chain-shirt' };
    const c = new Combat({ seed: 14, mapId: 'open', combatants: [scout, dexy, rust] });
    for (let i = 0; i < 40; i++) {
      resolveAttack(c.state, rust.id, 'scout', 'rust-monster-antennae');
      resolveAttack(c.state, rust.id, 'dexy', 'rust-monster-antennae');
    }
    expect(c.state.combatants['scout']!.corroded, 'leather does not rust').toBeUndefined();
    const d = c.state.combatants['dexy']!;
    expect(acOf(d), 'rust must never make armour worse than none').toBeGreaterThanOrEqual(10 + abilityMod(d.abilities.dex));
  });

  // A cube that only restrains is a positioning problem the party can choose to
  // ignore. The tick is what makes it a clock.
  it('engulf holds an adjacent hero and digests them every cube turn', () => {
    const cube = buildMonster('gelatinous-cube', 'team2', { x: 4, y: 3 }, 'cube');
    const pc = makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, abilities: { str: 10, dex: 1, con: 10, int: 10, wis: 10, cha: 10 }, hp: 300, maxHp: 300 });
    const c = new Combat({ seed: 8, mapId: 'open', combatants: [pc, cube] });
    // A dex-1 hero fails this most of the time, but "most" is not "always" —
    // try until one lands rather than fishing for a seed.
    const held = c.state.combatants['pc']!;
    for (let i = 0; i < 10 && !held.conditions.some((k) => k.id === 'restrained'); i++) {
      FEATURES['engulf']!.apply!({ state: c.state, actorId: cube.id });
    }
    expect(held.conditions.some((k) => k.id === 'restrained' && k.sourceId === cube.id),
      'a dex-1 hero should have been swallowed inside ten tries').toBe(true);
    expect(held.hp, 'engulfing deals acid straight away').toBeLessThan(300);
  });

  // The tick is read off the condition's source, so it starts and stops with
  // the hold itself — no separate list of victims to keep in step.
  it('the cube digests its own victims at the start of its turn, and nobody else\'s', () => {
    const cube = buildMonster('gelatinous-cube', 'team2', { x: 4, y: 3 }, 'cube');
    const mine = makeCombatant({ id: 'mine', team: 'team1', position: { x: 3, y: 3 }, hp: 300, maxHp: 300 });
    const theirs = makeCombatant({ id: 'theirs', team: 'team1', position: { x: 5, y: 3 }, hp: 300, maxHp: 300 });
    const c = new Combat({ seed: 11, mapId: 'open', combatants: [mine, theirs, cube] });
    // No repeatSave: this test is about who takes the tick, not about escaping.
    c.state.combatants['mine']!.conditions.push({ id: 'restrained', sourceId: cube.id });
    c.state.combatants['theirs']!.conditions.push({ id: 'restrained', sourceId: 'theirs' });
    // Round the order until the cube takes a fresh turn.
    do { c.apply({ kind: 'endTurn' }); } while (c.activeId !== cube.id);
    expect(c.state.combatants['mine']!.hp, 'the cube\'s victim should be dissolving').toBeLessThan(300);
    expect(c.state.combatants['theirs']!.hp, 'held by someone else — not the cube\'s meal').toBe(300);
  });

  it('engulf takes one victim at a time and skips the already-held', () => {
    const cube = buildMonster('gelatinous-cube', 'team2', { x: 4, y: 3 }, 'cube');
    const a = makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 }, abilities: { str: 10, dex: 1, con: 10, int: 10, wis: 10, cha: 10 }, hp: 300, maxHp: 300 });
    const b = makeCombatant({ id: 'b', team: 'team1', position: { x: 5, y: 3 }, abilities: { str: 10, dex: 1, con: 10, int: 10, wis: 10, cha: 10 }, hp: 300, maxHp: 300 });
    const c = new Combat({ seed: 12, mapId: 'open', combatants: [a, b, cube] });
    FEATURES['engulf']!.apply!({ state: c.state, actorId: cube.id });
    const restrained = () => ['a', 'b'].filter((id) => c.state.combatants[id]!.conditions.some((k) => k.id === 'restrained'));
    expect(restrained().length, 'a cube swallows one creature, not the room').toBe(1);
    const first = restrained()[0]!;
    FEATURES['engulf']!.apply!({ state: c.state, actorId: cube.id });
    expect(restrained().length, 'the second use should take the other one').toBe(2);
    expect(restrained()).toContain(first);
  });

  // Life Drain is the only effect in the game a cleric cannot undo. With no
  // death saves, a falling ceiling is the wraith's whole reason to be feared.
  it('wraith life drain cuts the hit point maximum, and healing cannot buy it back', () => {
    const wraith = buildMonster('wraith', 'team2', { x: 4, y: 3 });
    const pc = makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, abilities: { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 }, hp: 400, maxHp: 400, acOverride: 1 });
    pc.unconsciousAtZero = true;
    const c = new Combat({ seed: 4, mapId: 'open', combatants: [pc, wraith] });
    let drained = false;
    for (let i = 0; i < 20 && !drained; i++) {
      const events = resolveAttack(c.state, wraith.id, 'pc', 'wraith-touch');
      const drain = events.find((e) => e.type === 'maxHpDrained');
      if (!drain || drain.type !== 'maxHpDrained') continue;
      drained = true;
      const t = c.state.combatants['pc']!;
      expect(t.maxHp, 'the ceiling has to move').toBeLessThan(400);
      expect(t.maxHp).toBe(drain.maxHp);
      // A big heal tops them up to the *new* ceiling and no further.
      applyHealing(c.state, 'pc', 'pc', 1000);
      expect(c.state.combatants['pc']!.hp).toBe(t.maxHp);
    }
    expect(drained, 'a con-1 hero should fail this save inside 20 hits').toBe(true);
  });

  it('the drain grinds the ceiling toward 1 but never kills — the blow gets there first', () => {
    const wraith = buildMonster('wraith', 'team2', { x: 4, y: 3 });
    const pc = makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, abilities: { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 }, hp: 300, maxHp: 300, acOverride: 1 });
    pc.unconsciousAtZero = true;
    const c = new Combat({ seed: 7, mapId: 'open', combatants: [pc, wraith] });
    for (let i = 0; i < 200 && c.state.combatants['pc']!.maxHp > 1; i++) {
      // Patch them back up between blows — the drain skips a target already
      // down, so without this the grind stalls the moment one hit drops them.
      const t = c.state.combatants['pc']!;
      t.hp = t.maxHp;
      t.conditions = [];
      resolveAttack(c.state, wraith.id, 'pc', 'wraith-touch');
    }
    const t = c.state.combatants['pc']!;
    expect(t.maxHp, 'the ceiling should bottom out at 1, not 0').toBe(1);
    expect(t.alive, 'the drain itself never kills').toBe(true);
    // And the last blow is what actually takes them out of the fight.
    resolveAttack(c.state, wraith.id, 'pc', 'wraith-touch');
    expect(c.state.combatants['pc']!.hp).toBe(0);
    expect(c.state.combatants['pc']!.conditions.some((k) => k.id === 'unconscious')).toBe(true);
  });

  it('the drain is measured off damage actually taken, so resistance blunts it', () => {
    const wraith = buildMonster('wraith', 'team2', { x: 4, y: 3 });
    const mk = (id: string, x: number, resist: boolean) => {
      const c = makeCombatant({ id, team: 'team1', position: { x, y: 3 }, abilities: { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 }, hp: 500, maxHp: 500, acOverride: 1 });
      c.unconsciousAtZero = true;
      if (resist) c.resistances = ['necrotic'];
      return c;
    };
    const plain = mk('plain', 3, false);
    const warded = mk('warded', 5, true);
    const c = new Combat({ seed: 9, mapId: 'open', combatants: [plain, warded, wraith] });
    for (let i = 0; i < 30; i++) {
      resolveAttack(c.state, wraith.id, 'plain', 'wraith-touch');
      resolveAttack(c.state, wraith.id, 'warded', 'wraith-touch');
    }
    const lost = (id: string) => 500 - c.state.combatants[id]!.maxHp;
    expect(lost('plain'), 'nothing was drained at all').toBeGreaterThan(0);
    expect(lost('warded'), 'resistance should halve the drain too').toBeLessThan(lost('plain'));
  });

  // The banshee's Wail is the creature. Without it a 1,100 XP undead is a
  // touch attack and some resistances — strictly worse than a ghost.
  it('the banshee has its wail', () => {
    expect(MONSTERS['banshee']!.featureIds).toContain('wail');
  });

  it('wail drops those who fail and only bruises those who save', () => {
    const wail = FEATURES['wail']!;
    const banshee = buildMonster('banshee', 'team2', { x: 4, y: 4 });
    // Two heroes at the same distance, differing only in Constitution.
    const tough = makeCombatant({ id: 'tough', team: 'team1', position: { x: 3, y: 4 }, abilities: { str: 10, dex: 10, con: 30, int: 10, wis: 10, cha: 10 }, hp: 100, maxHp: 100 });
    const frail = makeCombatant({ id: 'frail', team: 'team1', position: { x: 5, y: 4 }, abilities: { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 }, hp: 100, maxHp: 100 });
    tough.unconsciousAtZero = true;
    frail.unconsciousAtZero = true;
    const c = new Combat({ seed: 3, mapId: 'open', combatants: [tough, frail, banshee] });
    wail.apply!({ state: c.state, actorId: banshee.id });
    expect(c.state.combatants['frail']!.hp, 'a con-1 hero cannot pass this').toBe(0);
    expect(c.state.combatants['frail']!.conditions.some((k) => k.id === 'unconscious')).toBe(true);
    const t = c.state.combatants['tough']!;
    expect(t.hp, 'a con-30 hero saves and takes 3d6').toBeGreaterThan(0);
    expect(t.hp, 'but the save is not free').toBeLessThan(100);
  });

  it('wail spares constructs and undead, and reaches only 30 ft', () => {
    const banshee = buildMonster('banshee', 'team2', { x: 1, y: 1 });
    // A construct in range and a living hero well outside it.
    const armor = buildMonster('animated-armor', 'team1', { x: 2, y: 1 });
    const far = makeCombatant({ id: 'far', team: 'team1', position: { x: 15, y: 1 }, abilities: { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 }, hp: 100, maxHp: 100 });
    const c = new Combat({ seed: 5, width: 20, height: 6, combatants: [armor, far, banshee] });
    expect(distanceFeet(banshee.position, far.position), 'the far hero must be out of range').toBeGreaterThan(30);
    FEATURES['wail']!.apply!({ state: c.state, actorId: banshee.id });
    expect(c.state.combatants[armor.id]!.hp, 'a construct has no life to take').toBe(armor.maxHp);
    expect(c.state.combatants['far']!.hp, 'out of range is out of range').toBe(100);
  });

  it('a monster killed by the wail ends the fight properly', () => {
    const banshee = buildMonster('banshee', 'team2', { x: 4, y: 4 });
    const rat = buildMonster('goblin-warrior', 'team1', { x: 3, y: 4 });
    const c = new Combat({ seed: 2, mapId: 'open', combatants: [rat, banshee] });
    // Force the failure rather than fishing for a seed: a rat that cannot save.
    c.state.combatants[rat.id]!.abilities.con = 1;
    FEATURES['wail']!.apply!({ state: c.state, actorId: banshee.id });
    if (!c.state.combatants[rat.id]!.alive) {
      expect(c.state.winner, 'the last enemy died — someone has to have won').toBe('team2');
    }
  });
});
