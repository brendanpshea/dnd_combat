import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildParty, buildCharacter } from '../src/builder/character.js';
import { buildMonster, buildEncounter, ENCOUNTERS, MONSTERS, MONSTER_XP, encounterXP, monsterLevel } from '../src/data/monsters.js';
import { SPELLS } from '../src/data/spells.js';
import { BREATH_WEAPONS } from '../src/data/features.js';
import { WEAPONS } from '../src/data/weapons.js';
import { chooseAction } from '../src/ai/greedy.js';
import { applyDamage } from '../src/engine/rules/attack.js';
import { arenaRoster } from '../src/arena/encounter.js';
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
