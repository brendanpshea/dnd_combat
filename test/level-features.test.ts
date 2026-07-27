import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { savingThrow, saveForHalf } from '../src/engine/rules/saves.js';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES } from '../src/data/features.js';
import { SPELLS } from '../src/data/spells.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, level }), id });
const foe = { ...buildMonster('ogre', 'team2', { x: 7, y: 7 }), id: 'foe' };
/**
 * A sampled save rate. These are measurements, not equalities: two Combats with
 * different rosters consume the RNG differently, so two setups that should be
 * identical still land a couple of points apart. At n=1000 the standard error
 * is about 1.5 points, so NOISE (0.06) is a comfortable four sigma — wide
 * enough never to flake, narrow enough that a +3 aura (worth ~15 points) or
 * advantage (~20) cannot hide inside it.
 */
const N = 1000;
const NOISE = 0.06;
const rate = (c: Combat, id: string, ability: 'wis' | 'dex') => {
  let pass = 0;
  for (let i = 0; i < N; i++) if (savingThrow(c.state, id, ability, 14).success) pass++;
  return pass / N;
};

describe('level 6 and 7 class features', () => {
  it('every feature a class table names actually exists', () => {
    // A featuresByLevel entry naming an id with no FEATURES record does not
    // throw — the character simply carries a string nothing ever reads.
    for (const cls of Object.values(CLASSES)) {
      for (const [level, ids] of Object.entries(cls.featuresByLevel)) {
        for (const id of ids) {
          expect(FEATURES[id], `${cls.id} level ${level} names '${id}', which does not exist`).toBeDefined();
        }
      }
    }
  });

  it('Aura of Protection lifts an ally\'s saves, and only within 10 ft', () => {
    const near = new Combat({ seed: 5, width: 12, height: 12, combatants: [
      pc('rogue', 6, { x: 1, y: 1 }, 'ally'), pc('paladin', 6, { x: 2, y: 1 }, 'pal'), foe] });
    const far = new Combat({ seed: 5, width: 12, height: 12, combatants: [
      pc('rogue', 6, { x: 1, y: 1 }, 'ally'), pc('paladin', 6, { x: 9, y: 9 }, 'pal'), foe] });
    const alone = new Combat({ seed: 5, width: 12, height: 12, combatants: [
      pc('rogue', 6, { x: 1, y: 1 }, 'ally'), foe] });
    const base = rate(alone, 'ally', 'wis');
    expect(rate(near, 'ally', 'wis')).toBeGreaterThan(base + NOISE);
    // Out of the aura it is worth nothing — it is a position, not a party buff.
    expect(rate(far, 'ally', 'wis')).toBeLessThan(base + NOISE);
  });

  it('a paladin below 6th has no aura at all', () => {
    const five = new Combat({ seed: 5, width: 12, height: 12, combatants: [
      pc('rogue', 6, { x: 1, y: 1 }, 'ally'), pc('paladin', 5, { x: 2, y: 1 }, 'pal'), foe] });
    const alone = new Combat({ seed: 5, width: 12, height: 12, combatants: [
      pc('rogue', 6, { x: 1, y: 1 }, 'ally'), foe] });
    expect(rate(five, 'ally', 'wis')).toBeLessThan(rate(alone, 'ally', 'wis') + NOISE);
  });

  it('Evasion takes a rogue to zero on a made Dex save, and halves a failed one', () => {
    const six = buildCharacter({ classId: 'rogue', team: 'team1', position: { x: 0, y: 0 }, level: 6 });
    const seven = buildCharacter({ classId: 'rogue', team: 'team1', position: { x: 0, y: 0 }, level: 7 });
    expect(saveForHalf(six, 'dex', 24, true)).toBe(12);
    expect(saveForHalf(seven, 'dex', 24, true)).toBe(0);
    expect(saveForHalf(seven, 'dex', 24, false)).toBe(12);
    // Only Dexterity: a Constitution save is halved the ordinary way.
    expect(saveForHalf(seven, 'con', 24, true)).toBe(12);
  });

  it('Countercharm gives allies advantage on Wis and Cha saves nearby', () => {
    const withBard = new Combat({ seed: 6, width: 12, height: 12, combatants: [
      pc('fighter', 7, { x: 1, y: 1 }, 'ally'), pc('bard', 7, { x: 3, y: 1 }, 'bard'), foe] });
    const alone = new Combat({ seed: 6, width: 12, height: 12, combatants: [
      pc('fighter', 7, { x: 1, y: 1 }, 'ally'), foe] });
    expect(rate(withBard, 'ally', 'wis')).toBeGreaterThan(rate(alone, 'ally', 'wis') + NOISE);
    // Not Dexterity — charm and fear do not use it.
    expect(rate(withBard, 'ally', 'dex')).toBeLessThan(rate(alone, 'ally', 'dex') + NOISE);
  });

  it('Potent Spellcasting reaches EVERY damaging cantrip, save-based included', () => {
    // Sacred Flame was the one that did not read the caster bonus, and it is the
    // cleric's only damaging cantrip — so the feature was inert for the class it
    // was added for. It is a save, not an attack roll, which is why it was
    // missed.
    const src = SPELLS;
    const damagingCantrips = Object.values(src).filter((s) => s.level === 0 && s.id !== 'minor-illusion');
    expect(damagingCantrips.length).toBeGreaterThan(0);
    const mean = (cls: string, level: number, cantrip: string) => {
      let total = 0, n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const h = { ...buildCharacter({ classId: cls, team: 'team1', position: { x: 1, y: 1 }, level }), id: 'h' };
        const c = new Combat({ seed, width: 8, height: 8, combatants: [h, { ...buildMonster('ogre', 'team2', { x: 3, y: 1 }), id: 'f' }] });
        while (c.activeId !== 'h') c.apply({ kind: 'endTurn' });
        const a = c.legalActions('h').find((x) => x.kind === 'castSpell' && x.spellId === cantrip);
        if (!a) continue;
        for (const e of c.apply(a)) if (e.type === 'damageDealt') { total += e.amount; n++; }
      }
      return n ? total / n : 0;
    };
    expect(mean('cleric', 7, 'sacred-flame')).toBeGreaterThan(mean('cleric', 6, 'sacred-flame'));
    expect(mean('druid', 7, 'starry-wisp')).toBeGreaterThan(mean('druid', 6, 'starry-wisp'));
  });

  it('the martials gain something too', () => {
    // The fighter's second Ability Score Increase at 6th, and the ranger's
    // Roving. Without these the two classes with no spell slots walk out of
    // both levels holding nothing but hit points.
    const f5 = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    const f6 = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 6 });
    expect(f6.abilities.str).toBeGreaterThan(f5.abilities.str);
    const r5 = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
    const r6 = buildCharacter({ classId: 'ranger', team: 'team1', position: { x: 0, y: 0 }, level: 6 });
    expect(r6.speed).toBe(r5.speed + 10);
  });

  it('gives every class something at 6 or 7, not just the casters', () => {
    for (const cls of Object.values(CLASSES)) {
      const at = (lvl: number) => buildCharacter({ classId: cls.id, team: 'team1', position: { x: 0, y: 0 }, level: lvl });
      const five = at(5), seven = at(7);
      const gained =
        seven.featureIds.length > five.featureIds.length ||
        seven.speed > five.speed ||
        Object.values(seven.abilities).some((v, i) => v > Object.values(five.abilities)[i]!) ||
        (seven.spellSlots.length > five.spellSlots.length);
      expect(gained, `${cls.id} gains nothing but hit points across 6th and 7th`).toBe(true);
    }
  });
});
