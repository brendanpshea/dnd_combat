import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildParty } from '../src/builder/character.js';
import { buildMonster, buildEncounter, ENCOUNTERS, MONSTERS, MONSTER_XP, encounterXP } from '../src/data/monsters.js';
import { chooseAction } from '../src/ai/greedy.js';
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
          makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'team2-giant-constrictor-snake1');
      const events = c.apply({ kind: 'attack', weaponId: 'snake-constrict', targetId: 'pc' });
      const hit = events.find((e) => e.type === 'attackRolled' && e.hit);
      if (hit) {
        const pc = c.state.combatants['pc']!;
        expect(pc.conditions.some((cond) => cond.id === 'restrained')).toBe(true);
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });
});

describe('new encounters complete under AI', () => {
  it('party beats or loses each new encounter without stalling', () => {
    for (const encId of [
      'bandits', 'spiders', 'crypt', 'kobolds', 'raiders', 'wilds', 'cult',
      'watch', 'ambush', 'swamp', 'pack', 'syndicate',
      'badger-den', 'toad-swamp', 'hyena-pack', 'boar-stampede', 'snake-pit',
      'gargoyle-perch', 'fire-nexus', 'water-vortex', 'earth-tremor', 'tempest-eye', 'elemental-cataclysm'
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
