/**
 * The sorcerer's and warlock's missing levels.
 *
 * WHAT WAS MISSING. Every other class in this game hands you something as you
 * climb. The sorcerer handed you nothing at levels 1, 5, 6 and 7 — it was the
 * only class in the game with an empty FIRST level — and the warlock nothing at
 * 6. The SRD has features for all five; three of them had been looked at and
 * deferred in writing, each for a reason that has since stopped being true:
 *
 *   - Elemental Affinity's damage half wanted "a hook in the damage pipeline
 *     that nothing else in the game wants". `rollSpellDice` was built for
 *     Empowered Spell and is exactly that hook.
 *   - Dark One's Own Luck was "a once-a-rest +d10 nobody chooses to spend",
 *     which was true only because it was written as a choice. Auto-applied to a
 *     save that has ALREADY failed, nobody has to choose.
 *   - Innate Sorcery was left to "its own change rather than being guessed at".
 *     This is that change.
 *
 * Sorcery Incarnate is the one that is still half-deferred, and the test below
 * holds the half that shipped to actually working rather than to being present.
 */
import { describe, it, expect } from 'vitest';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES } from '../src/data/features.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { legalActions } from '../src/engine/actions.js';
import { SPELLS, spellDc } from '../src/data/spells.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { rollSpellDice, sorceryPoints } from '../src/engine/rules/metamagic.js';
import { seedRng } from '../src/engine/rng.js';
import { newCampaign, buildCampaignParty, setPartyClass, shortRest } from '../src/campaign/campaign.js';
import type { Combatant, GameState } from '../src/engine/types.js';

const HERE = { x: 0, y: 0 } as const;

const sorcerer = (level: number) =>
  buildCharacter({ classId: 'sorcerer', team: 'team1', position: HERE, level });
const warlock = (level: number) =>
  buildCharacter({ classId: 'warlock', team: 'team1', position: HERE, level });

/** A one-combatant state, enough for the roll helpers. */
function bench(c: Combatant, seed = 7): GameState {
  return { combatants: { [c.id]: c }, rng: seedRng(seed), round: 1 } as never as GameState;
}

/** A fight with a sorcerer of `level` next to something to shoot at. */
function arena(hero: Combatant) {
  const foe = buildMonster('goblin-warrior', 'team2', { x: 3, y: 0 });
  const combat = new Combat({ combatants: [hero, foe], seed: 11, mapId: 'open' });
  return { combat, heroId: hero.id, foeId: foe.id };
}

describe('no level in either class table is empty any more', () => {
  /**
   * The test that would have caught the gap in the first place. Levels 4 and 8
   * are Ability Score Increases in the SRD for both classes — the builder's job,
   * not the table's — so they are the only permitted blanks.
   */
  const ASI_ONLY = new Set([4, 8]);

  for (const classId of ['sorcerer', 'warlock']) {
    it(`${classId} gains something at every level through 8`, () => {
      const cls = CLASSES[classId]!;
      for (let level = 1; level <= 8; level++) {
        if (ASI_ONLY.has(level)) continue;
        const fromTable = cls.featuresByLevel[level] ?? [];
        const fromChoices = (cls.choices ?? []).filter((ch) => ch.atLevel === level);
        // A new spell TIER counts too: the warlock's 5th is its second Eldritch
        // Blast beam, which the spell reads off level rather than a feature.
        const slots = cls.spellcasting?.slotsByLevel;
        const grew = slots !== undefined && level > 1 &&
          (slots[level - 1]?.length ?? 0) > (slots[level - 2]?.length ?? 0);
        expect(
          fromTable.length + fromChoices.length + (grew ? 1 : 0),
          `${classId} level ${level} hands the player nothing`,
        ).toBeGreaterThan(0);
      }
    });

    it(`every ${classId} feature id names a real feature`, () => {
      for (const ids of Object.values(CLASSES[classId]!.featuresByLevel)) {
        for (const id of ids) expect(FEATURES[id], id).toBeDefined();
      }
    });
  }
});

describe('Innate Sorcery', () => {
  it('is the sorcerer’s level-1 feature, and a bonus action it can actually press', () => {
    const me = sorcerer(1);
    expect(me.featureIds).toContain('innate-sorcery');
    expect(me.featureUses['innate-sorcery']?.max).toBe(2);
    const { combat, heroId } = arena(me);
    let guard = 0;
    while (combat.activeId !== heroId && guard++ < 20) combat.apply({ kind: 'endTurn' });
    const offered = legalActions(combat.state, heroId)
      .filter((a) => a.kind === 'useFeature' && a.featureId === 'innate-sorcery');
    expect(offered.length, 'nothing offers Innate Sorcery').toBeGreaterThan(0);
  });

  it('raises the spell save DC by one, and only while it burns', () => {
    const me = sorcerer(5);
    const state = bench(me);
    const before = spellDc(state, me.id);
    FEATURES['innate-sorcery']!.apply!({ state, actorId: me.id });
    expect(spellDc(state, me.id)).toBe(before + 1);
    // Ten rounds, not forever — a one-minute buff that outlived the minute
    // would be a different feature.
    const cond = me.conditions.find((k) => k.id === 'innateSorcery')!;
    expect(cond.expiresAtRound).toBe(11);
  });

  it('gives spell attacks advantage', () => {
    /**
     * Behavioural rather than a flag check: the point is that the ROLL changes,
     * and `spellAttack` collects its sources through machinery this feature
     * does not own. Fire Bolt over 300 casts, on and off.
     */
    const hits = (on: boolean) => {
      const me = sorcerer(5);
      const { combat, heroId, foeId } = arena(me);
      if (on) FEATURES['innate-sorcery']!.apply!({ state: combat.state, actorId: heroId });
      let landed = 0;
      for (let i = 0; i < 300; i++) {
        const foe = combat.state.combatants[foeId]!;
        foe.hp = 999; foe.alive = true;
        const events = SPELLS['fire-bolt']!.cast({
          state: combat.state, casterId: heroId, slotLevel: 0,
          targetIds: [foeId], positions: [],
        } as never);
        if (events.some((e) => e.type === 'attackRolled' && e.hit)) landed += 1;
      }
      return landed;
    };
    expect(hits(true)).toBeGreaterThan(hits(false));
  });

  it('cannot be stacked on itself, and runs out after two', () => {
    const me = sorcerer(5);
    const state = bench(me);
    const apply = () => FEATURES['innate-sorcery']!.apply!({ state, actorId: me.id });
    expect(apply().length).toBe(1);
    // Already burning: no second condition, and no second use spent.
    expect(apply().length).toBe(0);
    expect(me.featureUses['innate-sorcery']!.current).toBe(1);
    me.conditions = [];
    expect(apply().length).toBe(1);
    expect(me.featureUses['innate-sorcery']!.current).toBe(0);
    me.conditions = [];
    expect(apply().length, 'fired with an empty pool').toBe(0);
  });
});

describe('Sorcery Incarnate', () => {
  it('buys a use of Innate Sorcery for two sorcery points once the pool is dry', () => {
    const me = sorcerer(7);
    expect(me.featureIds).toContain('sorcery-incarnate');
    const state = bench(me);
    me.featureUses['innate-sorcery']!.current = 0;
    const points = sorceryPoints(me);
    expect(points).toBeGreaterThanOrEqual(2);
    expect(FEATURES['innate-sorcery']!.apply!({ state, actorId: me.id }).length).toBe(1);
    expect(sorceryPoints(me)).toBe(points - 2);
  });

  it('does not, for a sorcerer that has not reached 7th', () => {
    const me = sorcerer(6);
    expect(me.featureIds).not.toContain('sorcery-incarnate');
    const state = bench(me);
    me.featureUses['innate-sorcery']!.current = 0;
    const points = sorceryPoints(me);
    expect(FEATURES['innate-sorcery']!.apply!({ state, actorId: me.id }).length).toBe(0);
    expect(sorceryPoints(me), 'points spent on nothing').toBe(points);
  });
});

describe('Elemental Affinity', () => {
  it('makes a 6th-level sorcerer resistant to fire', () => {
    expect(sorcerer(5).resistances).not.toContain('fire');
    expect(sorcerer(6).resistances).toContain('fire');
  });

  it('adds Charisma to a fire spell’s damage, but only to ONE roll of it', () => {
    /**
     * Scorching Ray is the test case the flag exists for: three separate 2d6
     * rolls in one cast. Without `elementalAffinityUsed` it would collect the
     * bonus three times, which is the exact shape of the mispricings that have
     * cost this codebase the most measurements.
     */
    const me = sorcerer(6);
    me.abilities.cha = 18;                       // +4
    const state = bench(me);
    const totals = [0, 1, 2].map(() => rollSpellDice(state, me.id, '2d6', false, 'fire').total);
    expect(state.elementalAffinityUsed).toBe(true);
    // 2d6 is at most 12, so anything above it can only be the bonus — and the
    // three rolls together can be at most 36 + ONE +4.
    expect(totals.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(36 + 4);
    expect(totals[0]!).toBeGreaterThanOrEqual(2 + 4);
    expect(totals[1]!).toBeLessThanOrEqual(12);
    expect(totals[2]!).toBeLessThanOrEqual(12);
  });

  it('ignores damage of the wrong type, and casters who do not have it', () => {
    const me = sorcerer(6);
    me.abilities.cha = 18;
    // Cold, not fire.
    const cold = bench(me);
    rollSpellDice(cold, me.id, '2d6', false, 'cold');
    expect(cold.elementalAffinityUsed).toBeUndefined();
    // A 5th-level sorcerer throwing the same fire.
    const young = sorcerer(5);
    const s2 = bench(young);
    rollSpellDice(s2, young.id, '2d6', false, 'fire');
    expect(s2.elementalAffinityUsed).toBeUndefined();
  });
});

describe('Sorcerous Restoration', () => {
  it('hands back half the sorcerer’s level in points at the lunch break, once a day', () => {
    const c = newCampaign(1);
    setPartyClass(c, 0, 'sorcerer');
    c.xp = 34000;                                 // level 8
    const before = buildCampaignParty(c)[0]!;
    expect(before.featureIds).toContain('sorcerous-restoration');
    // Spend the whole pool in the morning fight.
    c.characters[0]!.resources = { hp: before.hp, ...c.characters[0]!.resources, featureUses: { 'font-of-magic': 0 } };

    const rest = shortRest(c);
    expect(rest.pointsRestored?.[0]?.points, 'no points came back').toBe(4);
    expect(sorceryPoints(buildCampaignParty(c)[0]!)).toBe(4);

    // Once between long rests: a second short rest gives nothing more.
    c.characters[0]!.resources = { ...c.characters[0]!.resources!, featureUses: {
      ...c.characters[0]!.resources!.featureUses, 'font-of-magic': 0 } };
    expect(shortRest(c).pointsRestored).toBeUndefined();
  });

  it('gives nothing to a sorcerer who never spent any', () => {
    const c = newCampaign(1);
    setPartyClass(c, 0, 'sorcerer');
    c.xp = 34000;
    expect(shortRest(c).pointsRestored).toBeUndefined();
  });
});

describe("Dark One's Own Luck", () => {
  it('is the warlock’s level-6 feature, with Charisma-modifier uses', () => {
    expect(warlock(5).featureIds).not.toContain('dark-ones-own-luck');
    const me = warlock(6);
    expect(me.featureIds).toContain('dark-ones-own-luck');
    expect(me.featureUses['dark-ones-own-luck']?.max)
      .toBe(Math.floor((me.abilities.cha - 10) / 2));
  });

  it('rescues saves that would have failed', () => {
    const fails = (level: number) => {
      const me = warlock(level);
      const state = bench(me, 3);
      let failed = 0;
      for (let i = 0; i < 40; i++) {
        // Refill each round so the pool is not the variable under test.
        const pool = state.combatants[me.id]!.featureUses['dark-ones-own-luck'];
        if (pool) pool.current = pool.max;
        if (!savingThrow(state, me.id, 'str', 25).success) failed += 1;
      }
      return failed;
    };
    // DC 25 on Strength: a level-6 warlock fails almost all of them without the
    // d10 and measurably fewer with it.
    expect(fails(6)).toBeLessThan(fails(5));
  });

  it('is never spent on a save that already succeeded', () => {
    const me = warlock(6);
    const state = bench(me, 3);
    const full = me.featureUses['dark-ones-own-luck']!.current;
    for (let i = 0; i < 10; i++) expect(savingThrow(state, me.id, 'str', 1).success).toBe(true);
    expect(me.featureUses['dark-ones-own-luck']!.current, 'burned on a certain success').toBe(full);
  });

  it('drains, rather than firing forever', () => {
    const me = warlock(6);
    const state = bench(me, 3);
    for (let i = 0; i < 20; i++) savingThrow(state, me.id, 'str', 30);
    expect(me.featureUses['dark-ones-own-luck']!.current).toBe(0);
  });
});
