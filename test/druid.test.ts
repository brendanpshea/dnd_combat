/**
 * Druid: Wild Shape and Thorn Whip.
 *
 * Wild Shape is the 2024 version, which keeps the druid's hit points and hands
 * it temporary ones — so these tests are mostly about the swap being complete
 * in one direction and exactly reversible in the other.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES, WILD_SHAPE_FORMS } from '../src/data/features.js';
import { SPELLS, wearsMetal } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { legalActions } from '../src/engine/actions.js';
import { applyDamage, breakConcentration } from '../src/engine/rules/attack.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id });
const foe = (monsterId: string, position: Position, id: string): Combatant =>
  ({ ...buildMonster(monsterId, 'team2', position), id });

const shape = (c: Combat, id = 'dru') => FEATURES['wild-shape']!.apply!({ state: c.state, actorId: id });

function board(level: number): Combat {
  return new Combat({
    seed: 1, width: 14, height: 10,
    combatants: [pc('druid', level, { x: 3, y: 3 }, 'dru'), foe('ogre', { x: 9, y: 3 }, 'ogre')],
  });
}

describe('Druid: the class', () => {
  it('is a Wisdom full caster in light armour', () => {
    const d = buildCharacter({ classId: 'druid', team: 'team1', position: { x: 1, y: 1 }, level: 5 });
    expect(d.spellcastingAbility).toBe('wis');
    expect(d.spellSlots.map((s) => s.max)).toEqual([4, 3, 2]);
    expect(CLASSES['druid']!.savingThrows).toEqual(['int', 'wis']);
    expect(CLASSES['druid']!.armorProfs).toEqual(['light', 'shield']);
  });

  it('has no Wild Shape until level 2', () => {
    expect(pc('druid', 1, { x: 1, y: 1 }, 'a').featureIds).not.toContain('wild-shape');
    expect(pc('druid', 2, { x: 1, y: 1 }, 'a').featureIds).toContain('wild-shape');
  });

  it('every listed form is a real beast', () => {
    for (const f of WILD_SHAPE_FORMS) {
      const m = MONSTERS[f.monsterId];
      expect(m, `${f.monsterId} is not in the bestiary`).toBeDefined();
      expect(m!.creatureType, `${f.monsterId} is not a beast`).toBe('beast');
    }
  });
});

describe('Wild Shape', () => {
  it('takes on the beast’s body and keeps the druid’s hit points', () => {
    const c = board(5);
    const before = { ac: acOf(c.state.combatants['dru']!), hp: c.state.combatants['dru']!.hp };
    const events = shape(c);
    const d = c.state.combatants['dru']!;
    const beast = MONSTERS[d.wildShape!.formId]!;

    expect(events.some((e) => e.type === 'wildShaped')).toBe(true);
    expect(acOf(d), 'AC comes from the beast').toBe(beast.ac);
    expect(acOf(d)).not.toBe(before.ac);
    expect(d.speed).toBe(beast.speed);
    expect(d.abilities.str).toBe(beast.abilities.str);
    expect(d.equipped.mainHand, 'and its teeth are in hand').toBe(beast.weaponIds[0]);
    expect(d.hp, 'hit points are the druid’s own, untouched').toBe(before.hp);
    expect(d.tempHp, 'plus temporary hit points equal to druid level').toBe(d.level);
  });

  it('keeps the druid’s mind and class features, and gains the beast’s traits', () => {
    const c = board(5);
    shape(c);
    const d = c.state.combatants['dru']!;
    const beast = MONSTERS[d.wildShape!.formId]!;
    expect(d.abilities.wis, 'Wisdom is the druid’s own').toBe(pc('druid', 5, { x: 0, y: 0 }, 'x').abilities.wis);
    expect(d.featureIds, 'class features come along').toContain('wild-shape');
    for (const f of beast.featureIds ?? []) expect(d.featureIds, `beast trait ${f}`).toContain(f);
  });

  it('cannot cast a single spell while shaped', () => {
    const c = board(5);
    expect(legalActions(c.state, 'dru').some((a) => a.kind === 'castSpell')).toBe(true);
    shape(c);
    expect(legalActions(c.state, 'dru').some((a) => a.kind === 'castSpell'),
      'a wolf does not cast Cure Wounds').toBe(false);
  });

  it('reverts to exactly what it was, and the round trip costs one use', () => {
    const c = board(5);
    const d0 = c.state.combatants['dru']!;
    const snapshot = {
      ac: acOf(d0), speed: d0.speed, abilities: { ...d0.abilities },
      equipped: { ...d0.equipped }, features: [...d0.featureIds],
      attacks: d0.attacksPerAction,
    };
    const uses = d0.featureUses['wild-shape']!.current;

    shape(c);
    shape(c);   // and back again

    const d = c.state.combatants['dru']!;
    expect(d.wildShape).toBeUndefined();
    expect(acOf(d)).toBe(snapshot.ac);
    expect(d.speed).toBe(snapshot.speed);
    expect(d.abilities).toEqual(snapshot.abilities);
    expect(d.equipped).toEqual(snapshot.equipped);
    expect(d.featureIds).toEqual(snapshot.features);
    expect(d.attacksPerAction).toBe(snapshot.attacks);
    expect(d.tempHp, 'the beast’s temporary hit points go with the beast').toBeUndefined();
    expect(d.featureUses['wild-shape']!.current, 'shifting costs a use; shifting back is free')
      .toBe(uses - 1);
  });

  it('the temporary hit points actually soak damage before the druid’s own', () => {
    const c = board(5);
    shape(c);
    const d = c.state.combatants['dru']!;
    const hp = d.hp;
    const temp = d.tempHp!;
    applyDamage(c.state, 'dru', 'nobody', temp, 'slashing');
    expect(c.state.combatants['dru']!.hp, 'the beast’s hide took all of it').toBe(hp);
    expect(c.state.combatants['dru']!.tempHp ?? 0).toBe(0);
  });

  it('runs out after two shifts', () => {
    const c = board(5);
    for (let i = 0; i < 3; i++) { shape(c); shape(c); }
    const d = c.state.combatants['dru']!;
    expect(d.featureUses['wild-shape']!.current).toBe(0);
    expect(shape(c), 'a spent pool shifts nothing').toEqual([]);
    expect(d.wildShape).toBeUndefined();
  });
});

describe('Thorn Whip', () => {
  it('drags the target toward the druid on a hit', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed, width: 14, height: 10,
        combatants: [pc('druid', 5, { x: 3, y: 3 }, 'dru'), foe('scout', { x: 8, y: 3 }, 'sc')],
      });
      const before = c.state.combatants['sc']!.position.x;
      const events = SPELLS['thorn-whip']!.cast({
        state: c.state, casterId: 'dru', slotLevel: 0, targetIds: ['sc'], positions: [],
      });
      const atk = events.find((e) => e.type === 'attackRolled');
      if (atk?.type !== 'attackRolled' || !atk.hit) continue;
      expect(events.some((e) => e.type === 'damageDealt' && e.damageType === 'piercing')).toBe(true);
      expect(c.state.combatants['sc']!.position.x, 'hauled toward the caster').toBeLessThan(before);
      return;
    }
    throw new Error('thorn whip never hit across 60 seeds');
  });

  it('a miss moves nobody', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed, width: 14, height: 10,
        combatants: [pc('druid', 5, { x: 3, y: 3 }, 'dru'), foe('scout', { x: 8, y: 3 }, 'sc')],
      });
      const before = { ...c.state.combatants['sc']!.position };
      const events = SPELLS['thorn-whip']!.cast({
        state: c.state, casterId: 'dru', slotLevel: 0, targetIds: ['sc'], positions: [],
      });
      const atk = events.find((e) => e.type === 'attackRolled');
      if (atk?.type !== 'attackRolled' || atk.hit) continue;
      expect(c.state.combatants['sc']!.position).toEqual(before);
      return;
    }
    throw new Error('thorn whip never missed across 60 seeds');
  });
});

describe('Entangle', () => {
  it('vines catch on a Strength save, not a Dexterity one', () => {
    // A strong, clumsy target and a nimble, weak one: only the save differs.
    const brute = { ...pc('fighter', 5, { x: 6, y: 4 }, 'brute'), abilities: { str: 20, dex: 1, con: 10, int: 10, wis: 10, cha: 10 } };
    const acrobat = { ...pc('fighter', 5, { x: 6, y: 5 }, 'acro'), abilities: { str: 1, dex: 20, con: 10, int: 10, wis: 10, cha: 10 } };
    brute.team = 'team2'; acrobat.team = 'team2';
    let brutesCaught = 0, acrobatsCaught = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed, width: 14, height: 10,
        combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), { ...brute }, { ...acrobat }],
      });
      SPELLS['entangle']!.cast({
        state: c.state, casterId: 'dru', slotLevel: 1, targetIds: [], positions: [{ x: 6, y: 4 }],
      });
      if (c.state.combatants['brute']!.conditions.some((k) => k.id === 'restrained')) brutesCaught++;
      if (c.state.combatants['acro']!.conditions.some((k) => k.id === 'restrained')) acrobatsCaught++;
    }
    expect(acrobatsCaught, 'a Strength save is what gets you out of vines')
      .toBeGreaterThan(brutesCaught);
  });

  it('the vines linger and catch whoever walks in afterwards', () => {
    const c = new Combat({
      seed: 5, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('ogre', { x: 11, y: 4 }, 'ogre')],
    });
    SPELLS['entangle']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 1, targetIds: [], positions: [{ x: 7, y: 4 }],
    });
    const cell = c.state.grid.cells[4 * c.state.grid.width + 7]!;
    expect(cell.web, 'the ground should still be vined').toBeDefined();
    expect(cell.web!.ability, 'and it should ask for Strength').toBe('str');
    expect(cell.web!.kind).toBe('entangle');
  });

  it('a plain Web still asks for Dexterity', () => {
    const c = new Combat({
      seed: 5, width: 14, height: 10,
      combatants: [pc('wizard', 5, { x: 2, y: 4 }, 'wiz'), foe('ogre', { x: 11, y: 4 }, 'ogre')],
    });
    SPELLS['web']!.cast({
      state: c.state, casterId: 'wiz', slotLevel: 2, targetIds: [], positions: [{ x: 7, y: 4 }],
    });
    const cell = c.state.grid.cells[4 * c.state.grid.width + 7]!;
    expect(cell.web!.ability, 'absent means Dexterity — Web is unchanged').toBeUndefined();
  });
});

describe('Heat Metal', () => {
  it('knows what is actually made of metal', () => {
    const metal = ['orc', 'knight', 'skeleton'];      // greataxe, mail + greatsword, shortsword
    const notMetal = ['ogre', 'wolf', 'gargoyle'];    // greatclub, and two sets of teeth
    for (const m of metal) expect(wearsMetal(buildMonster(m, 'team2', { x: 1, y: 1 })), m).toBe(true);
    for (const m of notMetal) expect(wearsMetal(buildMonster(m, 'team2', { x: 1, y: 1 })), m).toBe(false);
  });

  it('burns a knight and does nothing at all to a wolf', () => {
    const c = new Combat({
      seed: 6, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('knight', { x: 6, y: 4 }, 'k'), foe('wolf', { x: 6, y: 6 }, 'w')],
    });
    const kHp = c.state.combatants['k']!.hp;
    const wHp = c.state.combatants['w']!.hp;
    const hit = SPELLS['heat-metal']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 2, targetIds: ['k'], positions: [],
    });
    expect(hit.some((e) => e.type === 'damageDealt' && e.damageType === 'fire')).toBe(true);
    expect(c.state.combatants['k']!.hp).toBeLessThan(kHp);

    const miss = SPELLS['heat-metal']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 2, targetIds: ['w'], positions: [],
    });
    expect(miss, 'there is nothing on a wolf to heat').toEqual([]);
    expect(c.state.combatants['w']!.hp).toBe(wHp);
  });

  it('needs no attack roll and no save to deal its damage', () => {
    const c = new Combat({
      seed: 6, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('knight', { x: 6, y: 4 }, 'k')],
    });
    const events = SPELLS['heat-metal']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 2, targetIds: ['k'], positions: [],
    });
    expect(events.some((e) => e.type === 'attackRolled')).toBe(false);
    const dmg = events.find((e) => e.type === 'damageDealt');
    const save = events.find((e) => e.type === 'savingThrow');
    // The save exists, but it is only for the fumble rider — the fire lands first.
    expect(events.indexOf(dmg!)).toBeLessThan(events.indexOf(save!));
  });
});

describe('Call Lightning', () => {
  it('strikes on the turn it is cast, and again each turn the storm holds', () => {
    const c = new Combat({
      seed: 7, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('ogre', { x: 9, y: 4 }, 'ogre')],
    });
    const first = SPELLS['call-lightning']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 3, targetIds: [], positions: [{ x: 9, y: 4 }],
    });
    expect(first.some((e) => e.type === 'lightningStruck')).toBe(true);
    expect(c.state.combatants['dru']!.stormCloud).toBeDefined();

    const hp = c.state.combatants['ogre']!.hp;
    let struck = false;
    do {
      const ev = c.apply({ kind: 'endTurn' });
      if (ev.some((e) => e.type === 'lightningStruck')) struck = true;
    } while (c.activeId !== 'dru');
    expect(struck, 'the cloud should fire again on the druid’s turn').toBe(true);
    expect(c.state.combatants['ogre']!.hp, 'and it should hurt').toBeLessThan(hp);
  });

  it('never drops a bolt on the druid’s own side', () => {
    const c = new Combat({
      seed: 7, width: 14, height: 10,
      combatants: [
        pc('druid', 5, { x: 2, y: 4 }, 'dru'), pc('fighter', 5, { x: 8, y: 4 }, 'fig'),
        foe('ogre', { x: 9, y: 4 }, 'ogre'),
      ],
    });
    c.state.combatants['dru']!.stormCloud = { dice: '3d10', dc: 15 };
    const figHp = c.state.combatants['fig']!.hp;
    for (let i = 0; i < 20; i++) {
      do { c.apply({ kind: 'endTurn' }); } while (c.activeId !== 'dru' && !c.winner());
      if (c.winner()) break;
    }
    expect(c.state.combatants['fig']!.hp, 'the fighter is standing next to the target').toBe(figHp);
  });

  it('the storm blows out when concentration breaks', () => {
    const c = new Combat({
      seed: 7, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('ogre', { x: 9, y: 4 }, 'ogre')],
    });
    SPELLS['call-lightning']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 3, targetIds: [], positions: [{ x: 9, y: 4 }],
    });
    breakConcentration(c.state, 'dru');
    expect(c.state.combatants['dru']!.stormCloud).toBeUndefined();
  });
});
