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
import { SPELLS } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { legalActions } from '../src/engine/actions.js';
import { applyDamage } from '../src/engine/rules/attack.js';
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
