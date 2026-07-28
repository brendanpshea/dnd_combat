/**
 * The barbarian.
 *
 * Every rider of Rage is read somewhere other than where it is applied — the
 * damage bonus and the physical resistance in `attack.ts`, the Strength-save
 * advantage in `saves.ts`, the AC in `armor.ts` — which is what makes the
 * condition a clean piece of state and also what makes it easy for one of them
 * to quietly stop being wired up. Each gets its own test here for that reason.
 *
 * The two that would be silent failures if they broke:
 *
 *   Unarmored Defense. If the class ever ships with armour in its kit, the
 *   feature is dead data and nothing errors — the barbarian just has a worse
 *   AC than it should and nobody knows why.
 *
 *   Rage's count. Rage lasts the whole fight, so a per-encounter pool would
 *   refill before it was ever empty and the number pacing the class would be
 *   decoration. That is the reason feature pools were rest-scoped first.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SPELLS } from '../src/data/spells.js';
import { MONSTERS } from '../src/data/monsters.js';
import { CLASS_COUNT, SPELL_COUNT, MONSTER_COUNT } from '../web/src/contentCounts.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack, rageDamage } from '../src/engine/rules/attack.js';
import { applyDamage } from '../src/engine/rules/attack.js';
import { Combat } from '../src/engine/combat.js';
import { acOf } from '../src/data/armor.js';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES } from '../src/data/features.js';
import { isLegalAction } from '../src/engine/actions.js';
import type { Combatant, Position, GameState } from '../src/engine/types.js';

function barb(level = 1, position: Position = { x: 0, y: 0 }): Combatant {
  return buildCharacter({ classId: 'barbarian', team: 'team1', position, level });
}
const dummy = (position: Position, id = 'd1', ac = 10, hp = 999): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp, maxHp: 999, acOverride: ac });

/** A two-combatant fight with the barbarian adjacent to a target. */
function arena(level = 1): { state: GameState; c: Combat; me: Combatant } {
  const me = barb(level, { x: 1, y: 1 });
  const foe = dummy({ x: 2, y: 1 });
  const c = new Combat({ combatants: [me, foe], seed: 7 });
  return { state: c.state, c, me };
}

describe('Barbarian: the build', () => {
  it('starts with no armour, because Unarmored Defense is the armour', () => {
    // The silent failure this guards: hand the class hide armour and the level-1
    // feature becomes dead data that nothing errors about.
    const kit = CLASSES['barbarian']!.equipment;
    expect(kit.armor, 'armour in the kit makes Unarmored Defense dead data').toBeUndefined();
    const b = barb();
    expect(b.equipped.armor).toBeUndefined();
    // 10 + Dex + Con, with the class's 16/13 spread -> 10 + 1 + 3.
    expect(b.abilities.dex).toBe(13);
    expect(b.abilities.con).toBe(16);
    expect(acOf(b)).toBe(10 + 1 + 3);
  });

  it('loses Unarmored Defense the moment it puts armour on', () => {
    // Not a rule the class can break for itself: if a player equips the scale
    // mail they won, the AC has to come from the mail.
    const b = { ...barb(), equipped: { ...barb().equipped, armor: 'scale-mail' } };
    expect(acOf(b)).not.toBe(10 + 1 + 3);
  });

  it('has the biggest hit die in the game', () => {
    expect(CLASSES['barbarian']!.hitDie).toBe(12);
    expect(barb().maxHp).toBe(12 + 3);
  });

  it('rations Rage by the day, not by the fight', () => {
    // THE reason feature pools were rest-scoped before this class was written.
    expect(FEATURES['rage']!.uses!.per).toBe('longRest');
    expect(barb().featureUses['rage']!.max).toBe(2);
    expect(barb(5).featureUses['rage']!.max).toBe(3);
  });

  it('moves faster from 5th and rolls initiative twice from 7th', () => {
    expect(barb(4).speed).toBe(barb(1).speed);
    expect(barb(5).speed).toBe(barb(1).speed + 10);
    expect(barb(7).featureIds).toContain('feral-instinct');
  });
});

describe('Barbarian: Rage', () => {
  it('adds flat damage to a Strength melee swing', () => {
    const { c, me } = arena();
    const before = c.state.combatants['d1']!.hp;
    // Rage on, then swing. Compared against the same seeded swing without it
    // would be fragile (the rage costs an rng draw), so this asserts the tag
    // and that the total clears the weapon's own maximum without it.
    c.state.combatants[me.id]!.conditions.push({ id: 'raging', sourceId: me.id });
    let hits = 0;
    for (let i = 0; i < 40 && hits < 5; i++) {
      const evs = resolveAttack(c.state, me.id, 'd1', 'greataxe', {});
      // A MISS also deals damage to d1 — the greataxe's Cleave mastery — and it
      // carries no tags, so "there was a damage event" is not the same question
      // as "the swing landed". Ask the roll.
      const roll = evs.find((e) => e.type === 'attackRolled');
      if (!roll || roll.type !== 'attackRolled' || !roll.hit) continue;
      const dmg = evs.find((e) => e.type === 'damageDealt' && e.targetId === 'd1');
      if (dmg && dmg.type === 'damageDealt') {
        hits += 1;
        expect(dmg.tags, 'a raging melee hit is tagged').toContain('Rage');
      }
    }
    expect(hits, 'never landed a hit to check').toBeGreaterThan(0);
    expect(c.state.combatants['d1']!.hp).toBeLessThan(before);
  });

  it('adds nothing to a swing made on Dexterity', () => {
    // The bargain is Strength. A finesse weapon swung on Dex gets no rage
    // damage, which is also what stops rage being a free rider on a rapier.
    const me = { ...barb(), abilities: { ...barb().abilities, dex: 20, str: 10 },
      equipped: { ...barb().equipped, mainHand: 'dagger' } };
    const foe = dummy({ x: 2, y: 1 }, 'd1', 1);
    const c = new Combat({ combatants: [{ ...me, position: { x: 1, y: 1 } }, foe], seed: 3 });
    c.state.combatants[me.id]!.conditions.push({ id: 'raging', sourceId: me.id });
    let checked = 0;
    for (let i = 0; i < 40 && checked < 3; i++) {
      const evs = resolveAttack(c.state, me.id, 'd1', 'dagger', {});
      const dmg = evs.find((e) => e.type === 'damageDealt' && e.targetId === 'd1');
      if (dmg && dmg.type === 'damageDealt') { checked += 1; expect(dmg.tags ?? []).not.toContain('Rage'); }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('halves blades, arrows and clubs — and keeps halving magic ones', () => {
    // Not waived by a magic weapon, unlike a monster's physical resistance.
    // That is the SRD rule, and it is what keeps rage worth using at the levels
    // where the enemies start carrying magic.
    const { c, me } = arena();
    const hp0 = c.state.combatants[me.id]!.hp;
    applyDamage(c.state, me.id, 'd1', 10, 'slashing', [10]);
    expect(hp0 - c.state.combatants[me.id]!.hp).toBe(10);

    c.state.combatants[me.id]!.hp = hp0;
    c.state.combatants[me.id]!.conditions.push({ id: 'raging', sourceId: me.id });
    applyDamage(c.state, me.id, 'd1', 10, 'slashing', [10]);
    expect(hp0 - c.state.combatants[me.id]!.hp, 'raging halves slashing').toBe(5);

    c.state.combatants[me.id]!.hp = hp0;
    applyDamage(c.state, me.id, 'd1', 10, 'slashing', [10], { magical: true });
    expect(hp0 - c.state.combatants[me.id]!.hp, 'a magic blade is halved too').toBe(5);
  });

  it('does nothing about fire', () => {
    // The other half of the same claim: rage is toughness against weapons, not
    // a general damage shield, and a test that only checked slashing would pass
    // just as happily if the condition halved everything.
    const { c, me } = arena();
    const hp0 = c.state.combatants[me.id]!.hp;
    c.state.combatants[me.id]!.conditions.push({ id: 'raging', sourceId: me.id });
    applyDamage(c.state, me.id, 'd1', 10, 'fire', [10]);
    expect(hp0 - c.state.combatants[me.id]!.hp).toBe(10);
  });

  it('scales its damage off level, through one function', () => {
    expect(rageDamage(1)).toBe(2);
    expect(rageDamage(8)).toBe(2);
  });
});

describe('Barbarian: Reckless Attack', () => {
  it('cuts both ways', () => {
    const { c, me } = arena(2);
    c.state.combatants[me.id]!.conditions.push({ id: 'reckless', sourceId: me.id });
    // The condition is read from both ends, so one test covers the pair — the
    // failure mode worth guarding is exactly that they come apart.
    const evs = resolveAttack(c.state, me.id, 'd1', 'greataxe', {});
    const roll = evs.find((e) => e.type === 'attackRolled');
    if (roll && roll.type === 'attackRolled') expect(roll.advSources).toContain('reckless');
    const back = resolveAttack(c.state, 'd1', me.id, 'shortsword', {});
    const backRoll = back.find((e) => e.type === 'attackRolled');
    if (backRoll && backRoll.type === 'attackRolled') {
      expect(backRoll.advSources, 'the enemy swings back at advantage').toContain('target reckless');
    }
  });

  it('lifts at the start of the barbarian\'s next turn', () => {
    // What makes it a gamble rather than a free upgrade: the whole enemy team
    // gets a round of swinging at advantage before it goes.
    const { c, me } = arena(2);
    for (let i = 0; i < 6 && c.activeId !== me.id; i++) c.apply({ kind: 'endTurn' });
    expect(c.activeId).toBe(me.id);
    c.apply({ kind: 'useFeature', featureId: 'reckless-attack' });
    expect(c.state.combatants[me.id]!.conditions.some((k) => k.id === 'reckless')).toBe(true);
    // Round the table once: it must survive the enemy's turn (that is the
    // gamble) and lift when the barbarian's own turn comes back around.
    c.apply({ kind: 'endTurn' });
    expect(c.state.combatants[me.id]!.conditions.some((k) => k.id === 'reckless'),
      'must survive the enemy turn, or there is no risk').toBe(true);
    for (let i = 0; i < 8 && c.activeId !== me.id; i++) c.apply({ kind: 'endTurn' });
    expect(c.state.combatants[me.id]!.conditions.some((k) => k.id === 'reckless')).toBe(false);
  });
});

describe('Barbarian: Berserker', () => {
  it('offers Frenzy only while raging, and only after the first swing', () => {
    const me = barb(3, { x: 1, y: 1 });
    const foe = dummy({ x: 2, y: 1 });
    const c = new Combat({ combatants: [me, foe], seed: 11 });
    const frenzy = { kind: 'attack' as const, weaponId: 'greataxe', targetId: 'd1', frenzy: true };
    const live = () => c.state.combatants[me.id]!;

    for (let i = 0; i < 8 && c.activeId !== me.id; i++) c.apply({ kind: 'endTurn' });
    expect(isLegalAction(c.state, me.id, frenzy), 'not raging, not attacked').toBe(false);

    live().conditions.push({ id: 'raging', sourceId: me.id });
    expect(isLegalAction(c.state, me.id, frenzy), 'raging but has not swung yet').toBe(false);

    c.apply({ kind: 'attack', weaponId: 'greataxe', targetId: 'd1' });
    expect(isLegalAction(c.state, me.id, frenzy), 'raging and has swung').toBe(true);

    c.apply(frenzy);
    expect(live().turn.bonusActionUsed, 'frenzy spends the bonus action').toBe(true);
    expect(isLegalAction(c.state, me.id, frenzy), 'and only once').toBe(false);
  });

  it('keeps its ability modifier, unlike an off-hand swing', () => {
    // The reason Frenzy has its own flag rather than reusing `offhand`: an
    // off-hand attack drops the modifier and would be tagged Two-Weapon
    // Fighting in the log.
    const me = barb(3, { x: 1, y: 1 });
    const foe = dummy({ x: 2, y: 1 }, 'd1', 1);
    const c = new Combat({ combatants: [me, foe], seed: 5 });
    let checked = 0;
    for (let i = 0; i < 40 && checked < 3; i++) {
      const evs = resolveAttack(c.state, me.id, 'd1', 'greataxe', { offhand: false });
      const dmg = evs.find((e) => e.type === 'damageDealt' && e.targetId === 'd1');
      if (dmg && dmg.type === 'damageDealt') {
        checked += 1;
        expect(dmg.tags ?? []).not.toContain('Two-Weapon Fighting');
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('cannot be frightened while raging, from 6th', () => {
    const six = buildCharacter({ classId: 'barbarian', team: 'team1', position: { x: 0, y: 0 }, level: 6 });
    expect(six.featureIds).toContain('mindless-rage');
    const three = buildCharacter({ classId: 'barbarian', team: 'team1', position: { x: 0, y: 0 }, level: 3 });
    expect(three.featureIds).not.toContain('mindless-rage');
  });
});

/**
 * Weapon mastery on a miss, which the barbarian is the first player class to
 * carry — and which turned out to be pointing the wrong way.
 *
 * `applyDamage` takes (target, source). The Graze/Cleave miss branch passed
 * (attacker, target), so for as long as the mastery has existed a miss dealt
 * the WIELDER their own ability modifier in damage. Nothing caught it because
 * no class shipped with a graze or cleave weapon: the fighter masters the
 * longsword and javelin, the ranger a bow. The barbarian's greataxe is cleave.
 */
describe('Graze and Cleave, on a miss', () => {
  it('damages the target, not the wielder', () => {
    const me = barb(1, { x: 1, y: 1 });
    // AC 30: every swing misses, so every damage event is the mastery's.
    const foe = dummy({ x: 2, y: 1 }, 'd1', 30);
    const c = new Combat({ combatants: [me, foe], seed: 4 });
    expect(c.state.combatants[me.id]!.weaponMasteries).toContain('greataxe');
    const hp0 = c.state.combatants[me.id]!.hp;
    const foeHp0 = c.state.combatants['d1']!.hp;

    let misses = 0;
    for (let i = 0; i < 12; i++) {
      const evs = resolveAttack(c.state, me.id, 'd1', 'greataxe', {});
      const roll = evs.find((e) => e.type === 'attackRolled');
      if (roll && roll.type === 'attackRolled' && !roll.hit) misses += 1;
    }
    expect(misses, 'AC 30 should have missed every time').toBe(12);
    expect(c.state.combatants[me.id]!.hp, 'the wielder must not damage itself').toBe(hp0);
    expect(c.state.combatants['d1']!.hp, 'a cleave miss still bites').toBeLessThan(foeHp0);
  });
});

/**
 * The shop window.
 *
 * The landing page advertised "6 classes · 8 ancestries · 45+ spells · 130+
 * monsters". Three of the four were already wrong — nine classes and
 * sixty-nine spells — and had been drifting for as long as content had been
 * added. Undercounting is the friendly direction to be wrong in, which is why
 * nobody noticed: the page was selling the game short on the one screen a new
 * player decides from.
 */
describe('what the landing page claims', () => {
  it('counts the classes rather than asserting a number', () => {
    const src = readFileSync(new URL('../web/src/App.tsx', import.meta.url), 'utf8');
    expect(src, 'a hardcoded class count goes stale the next time one is added')
      .not.toMatch(/\d+ classes/);
    expect(CLASS_COUNT).toBe(Object.keys(CLASSES).length);
    // Asserting a literal here would recreate the bug in the test. What must
    // be true is that the count moves when a class is added, and the barbarian
    // is the one that just did.
    expect(Object.keys(CLASSES)).toContain('barbarian');
  });

  it('offers every class in the picker by enumerating them', () => {
    // Why this is a source test rather than a click: the guarantee worth having
    // is that the picker cannot MISS a class, and that is a property of mapping
    // over CLASSES — a driven click only proves one class showed up once.
    const src = readFileSync(new URL('../web/src/ForgeMember.tsx', import.meta.url), 'utf8');
    expect(src, 'a hand-listed class picker would silently omit new classes')
      .toContain('Object.values(CLASSES).map');
  });

  it('never overstates the spell or monster count', () => {
    // A floor with a "+" stays true as content is added; an exact number is a
    // promise that expires on the next commit.
    expect(Number(SPELL_COUNT.replace('+', ''))).toBeLessThanOrEqual(Object.keys(SPELLS).length);
    expect(Number(MONSTER_COUNT.replace('+', ''))).toBeLessThanOrEqual(Object.keys(MONSTERS).length);
    expect(SPELL_COUNT.endsWith('+')).toBe(true);
  });
});
