import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { MONSTERS, MONSTER_XP, buildMonster } from '../src/data/monsters.js';
import { buildCharacter } from '../src/builder/character.js';
import { FEATURES, BREATH_WEAPONS } from '../src/data/features.js';
import { canAttackWith, collectAttackSources } from '../src/engine/rules/attack.js';
import { legalActions, isLegalAction } from '../src/engine/actions.js';
import { ARENA_EXCLUDED, arenaRoster } from '../src/arena/encounter.js';
import { WEAPONS } from '../src/data/weapons.js';
import { abilityMod, proficiencyBonus } from '../src/engine/types.js';
import { seedRng } from '../src/engine/rng.js';
import type { Combatant, GameState } from '../src/engine/types.js';

/**
 * The SRD 5.2.1 stat blocks added for module authors. Their numbers and
 * attacks are held to the print by srd-monsters.test.ts like every other
 * monster's; this is what that test cannot see.
 */

const ADDED = ['ankheg', 'medusa', 'efreeti', 'vampire', 'drider', 'phase-spider', 'hippogriff',
  'centaur-trooper', 'giant-frog', 'boar', 'stirge', 'giant-lizard', 'young-bronze',
  'crocodile', 'mastiff', 'baboon', 'tiger', 'hobgoblin-warrior', 'hobgoblin-captain', 'pirate',
  'commoner', 'frog', 'scorpion', 'shambling-mound', 'minotaur-skeleton', 'ogre-zombie'];

const hero = (id: string, x: number, y: number): Combatant =>
  ({ ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x, y }, level: 5 }), id, hp: 500, maxHp: 500 });

function duel(monsterId: string, at = { x: 3, y: 4 }): Combat {
  const m = { ...buildMonster(monsterId, 'team2', at), id: 'm' };
  const c = new Combat({ seed: 2, width: 8, height: 8, combatants: [hero('h', 3, 3), m] });
  let guard = 0;
  while (c.activeId !== 'm' && guard++ < 10) c.apply({ kind: 'endTurn' });
  return c;
}

const swings = (state: GameState) => [...new Set(legalActions(state, 'm')
  .filter((a) => a.kind === 'attack' && !a.offhand && !a.frenzy)
  .map((a) => (a as { weaponId: string }).weaponId))].sort();

describe('the added stat blocks', () => {
  it('are all here, priced, and kept out of the arena', () => {
    for (const id of ADDED) {
      expect(MONSTERS[id], id).toBeDefined();
      expect(MONSTER_XP[id], id).toBeGreaterThan(0);
      expect(ARENA_EXCLUDED.has(id), id).toBe(true);
    }
    expect(arenaRoster().some((r) => ADDED.includes(r.id))).toBe(false);
  });

  it('every one builds and has something to attack with', () => {
    for (const id of ADDED) {
      const c = duel(id);
      expect(swings(c.state).length, id).toBeGreaterThan(0);
    }
  });
});

describe('their Multiattacks', () => {
  it('a medusa claws and bites with its hair, or fires three rays — not both', () => {
    const c = duel('medusa');
    expect(swings(c.state)).toEqual(['medusa-claw', 'medusa-poison-ray', 'medusa-snake-hair']);
    c.apply(legalActions(c.state, 'm').find((a) => a.kind === 'attack' && a.weaponId === 'medusa-claw')!);
    expect(swings(c.state)).toEqual(['medusa-claw', 'medusa-snake-hair']);
  });

  it('a vampire strikes twice and bites once', () => {
    const c = duel('vampire');
    const bite = legalActions(c.state, 'm').find((a) => a.kind === 'attack' && a.weaponId === 'vampire-bite')!;
    c.apply(bite);
    expect(swings(c.state)).toEqual(['vampire-grave-strike']);
  });

  it('a centaur trooper reaches ten feet with its pike, and shoots', () => {
    const c = duel('centaur-trooper', { x: 3, y: 5 });
    const m = c.state.combatants['m']!;
    expect(canAttackWith(c.state, m, 'pike', 'h')).toBe(true);
    expect(canAttackWith(c.state, m, 'longbow', 'h')).toBe(true);
    expect(WEAPONS['pike']!.properties).toContain('reach');
  });

  it('a drider reaches ten feet with a foreleg', () => {
    const c = duel('drider', { x: 3, y: 5 });
    expect(canAttackWith(c.state, c.state.combatants['m']!, 'drider-foreleg', 'h')).toBe(true);
  });
});

describe('their other actions', () => {
  const dc = (m: Combatant, a: 'con' | 'cha') => 8 + proficiencyBonus(m.level) + abilityMod(m.abilities[a]);

  it('breathe at the printed DCs and dice', () => {
    expect(dc(buildMonster('ankheg', 'team2', { x: 0, y: 0 }), 'con')).toBe(12);
    expect(BREATH_WEAPONS['breath-acid-ankheg']).toMatchObject({ shape: 'line', length: 6, dice: '4d6', damageType: 'acid' });
    expect(FEATURES['breath-acid-ankheg']!.recharge).toBe(6);
    expect(dc(buildMonster('young-bronze', 'team2', { x: 0, y: 0 }), 'con')).toBe(15);
    expect(BREATH_WEAPONS['breath-lightning-young-bronze']).toMatchObject({ shape: 'line', length: 12, dice: '9d10' });
  });

  it('the medusa gazes as a Bonus Action at DC 13, and it restrains', () => {
    const c = duel('medusa');
    const m = c.state.combatants['m']!;
    expect(dc(m, 'cha')).toBe(13);
    expect(FEATURES['petrifying-gaze']).toMatchObject({ trigger: 'bonus', recharge: 5 });
    let restrained = false;
    for (let seed = 1; seed <= 30 && !restrained; seed++) {
      const s: GameState = structuredClone(c.state);
      s.rng = seedRng(seed);
      FEATURES['petrifying-gaze']!.apply!({ state: s, actorId: 'm' });
      restrained = s.combatants['h']!.conditions.some((k) => k.id === 'restrained');
    }
    expect(restrained).toBe(true);
    // The Bonus Action leaves its Multiattack free.
    c.apply({ kind: 'useFeature', featureId: 'petrifying-gaze' });
    expect(c.state.combatants['m']!.turn.actionUsed).toBe(false);
  });

  it('the vampire charms as a Bonus Action at DC 17', () => {
    const c = duel('vampire');
    expect(dc(c.state.combatants['m']!, 'cha')).toBe(17);
    expect(isLegalAction(c.state, 'm', { kind: 'useFeature', featureId: 'vampire-charm' })).toBe(true);
    c.apply({ kind: 'useFeature', featureId: 'vampire-charm' });
    expect(c.state.combatants['m']!.turn.actionUsed).toBe(false);
  });

  it('a Bloodied boar attacks with Advantage', () => {
    const c = duel('boar');
    const m = c.state.combatants['m']!;
    const src = () => collectAttackSources(c.state, m, c.state.combatants['h']!, WEAPONS['boar-gore']!, true).adv;
    expect(src()).not.toContain('bloodied fury');
    m.hp = Math.floor(m.maxHp / 2);
    expect(src()).toContain('bloodied fury');
  });
});

describe('the people and beasts added with them', () => {
  it('a crocodile grapples and restrains a Medium or smaller target', () => {
    const w = WEAPONS['small-crocodile-bite']!;
    expect(w.onHitGrapple).toMatchObject({ dc: 12, restrains: true, maxSize: 'medium' });
    expect(MONSTERS['crocodile']!.size).toBe('large');
  });

  it('a mastiff bites a target down, and a tiger rends one', () => {
    expect(WEAPONS['mastiff-bite']!.onHitCondition).toBe('prone');
    expect(WEAPONS['tiger-rend']!.onHitCondition).toBe('prone');
  });

  it('a hobgoblin captain makes two attacks, sword or bow, and both poison', () => {
    const m = MONSTERS['hobgoblin-captain']!;
    expect(m.attacksPerAction).toBe(2);
    for (const id of m.weaponIds) expect(WEAPONS[id]!.extraDamage?.type, id).toBe('poison');
    const c = duel('hobgoblin-captain', { x: 3, y: 5 });
    expect(canAttackWith(c.state, c.state.combatants['m']!, 'hobgoblin-captain-longbow', 'h')).toBe(true);
  });

  it('a hobgoblin warrior shoots a poisoned arrow from behind a shield', () => {
    expect(WEAPONS['hobgoblin-longbow']!.extraDamage).toMatchObject({ dice: '3d4', type: 'poison' });
    expect(MONSTERS['hobgoblin-warrior']!.ac).toBe(18);
    expect(MONSTERS['hobgoblin-warrior']!.featureIds).toContain('pack-tactics');
  });

  it('a pirate daggers twice; a shambling mound lashes three times with reach', () => {
    expect(MONSTERS['pirate']!.attacksPerAction).toBe(2);
    expect(MONSTERS['shambling-mound']!.attacksPerAction).toBe(3);
    expect(WEAPONS['shambling-mound-tendril']!.properties).toContain('reach');
    expect(MONSTERS['shambling-mound']!.immunities).toContain('lightning');
  });

  it('the undead are as the SRD has them: a minotaur skeleton breaks to a mace, an ogre zombie will not stay down', () => {
    expect(MONSTERS['minotaur-skeleton']!.vulnerabilities).toContain('bludgeoning');
    expect(MONSTERS['minotaur-skeleton']!.conditionImmunities).toContain('poisoned');
    expect(MONSTERS['ogre-zombie']!.featureIds).toContain('undead-fortitude');
  });
});
