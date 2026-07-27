/**
 * Bard: Bardic Inspiration, Cutting Words, Vicious Mockery, and the two skill
 * features. The class's whole resource is one small pool of d6s — handed to an
 * ally, or spent to spoil an enemy's hit — so most of these tests are about
 * that pool being spent exactly once, in exactly one direction.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES } from '../src/data/features.js';
import { SPELLS } from '../src/data/spells.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { skillBonus } from '../src/campaign/campaign.js';
import { abilityMod, proficiencyBonus } from '../src/engine/types.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id });
const foe = (monsterId: string, position: Position, id: string): Combatant =>
  ({ ...buildMonster(monsterId, 'team2', position), id });

describe('Bard: the class', () => {
  it('is a Charisma full caster with the 2024 slot progression', () => {
    const b = buildCharacter({ classId: 'bard', team: 'team1', position: { x: 1, y: 1 }, level: 5 });
    expect(b.spellcastingAbility).toBe('cha');
    expect(b.spellSlots.map((s) => s.max)).toEqual([4, 3, 2]);
    expect(CLASSES['bard']!.hitDie).toBe(8);
    expect(CLASSES['bard']!.savingThrows).toEqual(['dex', 'cha']);
  });

  it('defaults to a weapon it is actually trained with', () => {
    const b = buildCharacter({ classId: 'bard', team: 'team1', position: { x: 1, y: 1 }, level: 1 });
    // Simple weapons only in 2024 — a rapier would be martial and untrained.
    expect(CLASSES['bard']!.weaponProfs.martial).toBe(false);
    expect(b.weaponProfs?.simple).toBe(true);
    expect(CLASSES['bard']!.equipment.mainHand).toBe('dagger');
  });

  it('has as many inspiration dice as its Charisma modifier', () => {
    for (const level of [1, 5]) {
      const b = buildCharacter({ classId: 'bard', team: 'team1', position: { x: 1, y: 1 }, level });
      expect(b.featureUses['bardic-inspiration']!.max).toBe(abilityMod(b.abilities.cha));
    }
  });
});

describe('Bardic Inspiration', () => {
  it('hands an ally a die that lands on their next attack roll, once', () => {
    const bard = pc('bard', 5, { x: 1, y: 1 }, 'bard');
    const fighter = pc('fighter', 5, { x: 2, y: 2 }, 'fig');
    const c = new Combat({ seed: 4, mapId: 'open', combatants: [bard, fighter, foe('ogre', { x: 3, y: 2 }, 'ogre')] });
    FEATURES['bardic-inspiration']!.apply!({ state: c.state, actorId: 'bard' });
    expect(c.state.combatants['fig']!.conditions.some((k) => k.id === 'inspiring')).toBe(true);

    const events = resolveAttack(c.state, 'fig', 'ogre', 'greatsword');
    const roll = events.find((e) => e.type === 'attackRolled');
    expect(roll?.type === 'attackRolled' && roll.total, 'the d6 has to be in the total')
      .toBeGreaterThan(roll?.type === 'attackRolled' ? roll.natural : 0);
    expect(c.state.combatants['fig']!.conditions.some((k) => k.id === 'inspiring'),
      'and then it is spent').toBe(false);
  });

  it('can be spent on a saving throw instead', () => {
    const bard = pc('bard', 5, { x: 1, y: 1 }, 'bard');
    const fighter = pc('fighter', 5, { x: 2, y: 2 }, 'fig');
    const c = new Combat({ seed: 4, mapId: 'open', combatants: [bard, fighter] });
    FEATURES['bardic-inspiration']!.apply!({ state: c.state, actorId: 'bard' });
    const inspired = savingThrow(c.state, 'fig', 'wis', 15);
    const plain = savingThrow(c.state, 'fig', 'wis', 15);
    const mod = (e: typeof inspired.event) => (e.type === 'savingThrow' ? e.total - e.natural : NaN);
    expect(mod(inspired.event), 'the inspired roll carries the extra die')
      .toBeGreaterThan(mod(plain.event));
    expect(c.state.combatants['fig']!.conditions.some((k) => k.id === 'inspiring')).toBe(false);
  });

  it('never doubles up on the same ally', () => {
    const bard = pc('bard', 5, { x: 1, y: 1 }, 'bard');
    const fighter = pc('fighter', 5, { x: 2, y: 2 }, 'fig');
    const c = new Combat({ seed: 4, mapId: 'open', combatants: [bard, fighter] });
    FEATURES['bardic-inspiration']!.apply!({ state: c.state, actorId: 'bard' });
    FEATURES['bardic-inspiration']!.apply!({ state: c.state, actorId: 'bard' });
    expect(c.state.combatants['fig']!.conditions.filter((k) => k.id === 'inspiring')).toHaveLength(1);
  });
});

describe('Cutting Words', () => {
  it('turns a hit into a miss and spends a die doing it', () => {
    let cut = false;
    for (let seed = 1; seed <= 60 && !cut; seed++) {
      const bard = pc('bard', 5, { x: 1, y: 1 }, 'bard');
      const fighter = pc('fighter', 5, { x: 2, y: 2 }, 'fig');
      const c = new Combat({ seed, mapId: 'open', combatants: [bard, fighter, foe('ogre', { x: 3, y: 2 }, 'ogre')] });
      const before = c.state.combatants['bard']!.featureUses['bardic-inspiration']!.current;
      const events = resolveAttack(c.state, 'ogre', 'fig', 'ogre-greatclub');
      const words = events.find((e) => e.type === 'cuttingWords');
      if (!words) continue;
      cut = true;
      expect(c.state.combatants['bard']!.featureUses['bardic-inspiration']!.current,
        'the jibe costs a die').toBe(before - 1);
      expect(c.state.combatants['bard']!.turn.reactionUsed, 'and the reaction').toBe(true);
      const roll = events.find((e) => e.type === 'attackRolled');
      expect(roll?.type).toBe('attackRolled');
      if (roll?.type !== 'attackRolled' || words.type !== 'cuttingWords') throw new Error('bad events');
      // The logged total is post-jibe, and it was a hit before the jibe —
      // otherwise the bard spent a die on an attack that was already missing.
      expect(roll.total + words.amount).toBeGreaterThanOrEqual(roll.targetAc);
      // And if the jibe was enough, the attack must actually be recorded as a miss.
      if (roll.total < roll.targetAc) expect(roll.hit).toBe(false);
    }
    expect(cut, 'cutting words never fired across 60 seeds').toBe(true);
  });

  it('is not spent on a roll it could never have saved', () => {
    // AC 10 fighter against a roll that beats it by miles: a d6 cannot help.
    const bard = pc('bard', 5, { x: 1, y: 1 }, 'bard');
    const fighter = pc('fighter', 5, { x: 2, y: 2 }, 'fig');
    fighter.acOverride = 1;   // everything hits by a mile
    const c = new Combat({ seed: 8, mapId: 'open', combatants: [bard, fighter, foe('ogre', { x: 3, y: 2 }, 'ogre')] });
    const before = c.state.combatants['bard']!.featureUses['bardic-inspiration']!.current;
    for (let i = 0; i < 10; i++) {
      c.state.combatants['bard']!.turn.reactionUsed = false;
      resolveAttack(c.state, 'ogre', 'fig', 'ogre-greatclub');
    }
    expect(c.state.combatants['bard']!.featureUses['bardic-inspiration']!.current,
      'a die spent on a hopeless roll is a wasted die').toBe(before);
  });

  it('a bard without the Lore feature does not cut in', () => {
    const bard = pc('bard', 1, { x: 1, y: 1 }, 'bard');   // Cutting Words arrives at 3
    const fighter = pc('fighter', 5, { x: 2, y: 2 }, 'fig');
    expect(bard.featureIds).not.toContain('cutting-words');
    const c = new Combat({ seed: 5, mapId: 'open', combatants: [bard, fighter, foe('ogre', { x: 3, y: 2 }, 'ogre')] });
    const before = c.state.combatants['bard']!.featureUses['bardic-inspiration']!.current;
    for (let i = 0; i < 20; i++) {
      c.state.combatants['bard']!.turn.reactionUsed = false;
      resolveAttack(c.state, 'ogre', 'fig', 'ogre-greatclub');
    }
    expect(c.state.combatants['bard']!.featureUses['bardic-inspiration']!.current).toBe(before);
  });
});

describe('Vicious Mockery', () => {
  it('a failed save costs psychic damage and the target swings badly next', () => {
    let landed = false;
    for (let seed = 1; seed <= 60 && !landed; seed++) {
      const bard = pc('bard', 5, { x: 1, y: 1 }, 'bard');
      const c = new Combat({ seed, mapId: 'open', combatants: [bard, foe('ogre', { x: 4, y: 1 }, 'ogre')] });
      const events = SPELLS['vicious-mockery']!.cast({
        state: c.state, casterId: 'bard', slotLevel: 0, targetIds: ['ogre'], positions: [],
      });
      const save = events.find((e) => e.type === 'savingThrow');
      if (save?.type !== 'savingThrow' || save.success) continue;
      landed = true;
      expect(events.some((e) => e.type === 'damageDealt' && e.damageType === 'psychic')).toBe(true);
      expect(c.state.combatants['ogre']!.conditions.some((k) => k.id === 'sapped')).toBe(true);
    }
    expect(landed, 'vicious mockery never landed across 60 seeds').toBe(true);
  });

  it('a successful save costs nothing at all', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const bard = pc('bard', 5, { x: 1, y: 1 }, 'bard');
      const c = new Combat({ seed, mapId: 'open', combatants: [bard, foe('ogre', { x: 4, y: 1 }, 'ogre')] });
      const hp = c.state.combatants['ogre']!.hp;
      const events = SPELLS['vicious-mockery']!.cast({
        state: c.state, casterId: 'bard', slotLevel: 0, targetIds: ['ogre'], positions: [],
      });
      const save = events.find((e) => e.type === 'savingThrow');
      if (save?.type !== 'savingThrow' || !save.success) continue;
      expect(c.state.combatants['ogre']!.hp).toBe(hp);
      expect(c.state.combatants['ogre']!.conditions.some((k) => k.id === 'sapped')).toBe(false);
      return;
    }
    throw new Error('the ogre never made the save across 60 seeds');
  });
});

describe('Bard: skills', () => {
  it('Expertise doubles proficiency on the class skills, from level 2', () => {
    const l1 = skillBonus('bard', 1, 'persuasion');
    const l2 = skillBonus('bard', 2, 'persuasion');
    // Same proficiency bonus at both levels, so the jump is Expertise alone.
    expect(proficiencyBonus(1)).toBe(proficiencyBonus(2));
    expect(l2 - l1).toBe(proficiencyBonus(2));
  });

  it('Jack of All Trades adds half proficiency to skills it lacks', () => {
    // Arcana is not a bard class skill, so this is Jack of All Trades alone.
    const l1 = skillBonus('bard', 1, 'arcana');
    const l2 = skillBonus('bard', 2, 'arcana');
    expect(l2 - l1).toBe(Math.floor(proficiencyBonus(2) / 2));
  });

  it('and neither leaks onto another class', () => {
    expect(skillBonus('fighter', 2, 'arcana')).toBe(skillBonus('fighter', 1, 'arcana'));
  });
});
