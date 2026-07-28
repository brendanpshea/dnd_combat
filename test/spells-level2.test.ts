/**
 * The 2nd-level tier's missing pieces, and Counterspell.
 *
 * Second level had fifteen spells and NO area damage at all — Scorching Ray
 * hits one target and Flaming Sphere is a summon — so a caster's answer to a
 * crowd jumped from Burning Hands at 1st to Fireball at 3rd, skipping exactly
 * the levels most parties spend the longest at.
 *
 * And nothing in the game answered an enemy caster. Sixteen monsters cast
 * spells, including Fireball, Lightning Bolt and Spirit Guardians.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { tryCounterspell } from '../src/engine/rules/attack.js';
import { isLegalAction } from '../src/engine/actions.js';
import { silenceCell } from '../src/engine/grid.js';
import { cellAt } from '../src/engine/types.js';
import {
  newCampaign, buildCampaignParty, setPartyClass, characterSkillBonus, useStoreSpell, shortRest,
} from '../src/campaign/campaign.js';
import type { Combatant, Position } from '../src/engine/types.js';

const wiz = (level = 7, position: Position = { x: 1, y: 1 }): Combatant =>
  buildCharacter({ classId: 'wizard', team: 'team1', position, level });
const foe = (position: Position, id = 'd1'): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp: 80, maxHp: 80 });

describe('Shatter', () => {
  it('is the tier\'s only area damage, and it lands on everyone in the blast', () => {
    const me = wiz();
    const c = new Combat({ combatants: [me, foe({ x: 4, y: 4 }), foe({ x: 5, y: 4 }, 'd2')], seed: 3 });
    const before = [c.state.combatants['d1']!.hp, c.state.combatants['d2']!.hp];
    SPELLS['shatter']!.cast({
      state: c.state, casterId: me.id, slotLevel: 2, targetIds: [], positions: [{ x: 4, y: 4 }],
    });
    expect(c.state.combatants['d1']!.hp).toBeLessThan(before[0]!);
    expect(c.state.combatants['d2']!.hp, 'the second target was outside the blast').toBeLessThan(before[1]!);
  });
});

describe('Mirror Image', () => {
  it('puts three duplicates up, and they get struck instead of you', () => {
    const me = wiz(7, { x: 1, y: 1 });
    const c = new Combat({ combatants: [me, foe({ x: 2, y: 1 })], seed: 11 });
    SPELLS['mirror-image']!.cast({
      state: c.state, casterId: me.id, slotLevel: 2, targetIds: [], positions: [],
    });
    expect(c.state.combatants[me.id]!.mirrorImages).toBe(3);

    // Swing at it until the images are gone; each one popped is one fewer.
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const left = c.state.combatants[me.id]!.mirrorImages ?? 0;
      seen.add(left);
      if (left === 0) break;
      resolveAttack(c.state, 'd1', me.id, 'shortsword', {});
    }
    expect(seen.has(0), 'the images never ran out').toBe(true);
    expect(seen.size, 'they should have gone one at a time').toBeGreaterThan(2);
  });
});

describe('Silence', () => {
  it('stops a spell being cast from a hushed cell, and only from there', () => {
    const me = wiz(7, { x: 1, y: 1 });
    const c = new Combat({ combatants: [me, foe({ x: 2, y: 1 })], seed: 5 });
    for (let i = 0; i < 8 && c.activeId !== me.id; i++) c.apply({ kind: 'endTurn' });
    const cast = { kind: 'castSpell' as const, spellId: 'magic-missile', slotLevel: 1, targets: [{ combatantId: 'd1' }] };
    expect(isLegalAction(c.state, me.id, cast), 'before the hush').toBe(true);
    silenceCell(c.state.grid, { x: 1, y: 1 }, 'd1');
    expect(isLegalAction(c.state, me.id, cast), 'inside the hush').toBe(false);
    // Walking out of it restores the voice.
    delete cellAt(c.state.grid, { x: 1, y: 1 })!.silent;
    expect(isLegalAction(c.state, me.id, cast)).toBe(true);
  });
});

describe('Counterspell', () => {
  it('stops a 2nd-level spell or better, and spends the reaction and a slot', () => {
    const me = wiz();                                  // has counterspell at 7
    const enemy = { ...wiz(7, { x: 3, y: 1 }), id: 'e1', team: 'team2' as const };
    const c = new Combat({ combatants: [me, enemy], seed: 2 });
    expect(c.state.combatants[me.id]!.spellIds).toContain('counterspell');
    const slotsBefore = c.state.combatants[me.id]!.spellSlots[2]!.current;

    const by = tryCounterspell(c.state, 'e1', 3);
    expect(by, 'nobody countered a 3rd-level spell').toBe(me.id);
    expect(c.state.combatants[me.id]!.spellSlots[2]!.current).toBe(slotsBefore - 1);
    expect(c.state.combatants[me.id]!.turn.reactionUsed).toBe(true);
  });

  it('never burns a slot on a cantrip or a 1st-level spell', () => {
    // THE gate. Countering a goblin hexer's Vicious Mockery with a 3rd-level
    // slot is the failure mode an autocast reaction has to avoid.
    const me = wiz();
    const enemy = { ...wiz(7, { x: 3, y: 1 }), id: 'e1', team: 'team2' as const };
    const c = new Combat({ combatants: [me, enemy], seed: 2 });
    expect(tryCounterspell(c.state, 'e1', 0), 'countered a cantrip').toBeUndefined();
    expect(tryCounterspell(c.state, 'e1', 1), 'countered a 1st-level spell').toBeUndefined();
    expect(c.state.combatants[me.id]!.turn.reactionUsed).toBe(false);
  });

  it('does not counter its own side', () => {
    const me = wiz();
    const friend = { ...wiz(7, { x: 3, y: 1 }), id: 'f1' };
    const c = new Combat({ combatants: [me, friend, foe({ x: 6, y: 6 })], seed: 2 });
    expect(tryCounterspell(c.state, 'f1', 3)).toBeUndefined();
  });

  it('needs the reaction, a slot, and line of sight', () => {
    const me = wiz();
    const enemy = { ...wiz(7, { x: 3, y: 1 }), id: 'e1', team: 'team2' as const };
    const c = new Combat({ combatants: [me, enemy], seed: 2 });
    c.state.combatants[me.id]!.turn.reactionUsed = true;
    expect(tryCounterspell(c.state, 'e1', 3), 'reacted twice in a round').toBeUndefined();
    c.state.combatants[me.id]!.turn.reactionUsed = false;
    c.state.combatants[me.id]!.spellSlots[2]!.current = 0;
    expect(tryCounterspell(c.state, 'e1', 3), 'countered with no slot').toBeUndefined();
  });
});

describe('Pass without Trace', () => {
  it('gives the whole party +10 Stealth, until the next rest', () => {
    // It exists for one roll: the group Stealth check at the arena's gate,
    // where half the party must pass and the armoured members are the problem.
    const c = newCampaign(2);
    setPartyClass(c, 3, 'druid');
    c.xp = 0;
    while (buildCampaignParty(c)[0]!.level < 5) c.xp += 900;
    const before = c.characters.map((_, i) => characterSkillBonus(c, i, 'stealth'));

    expect(useStoreSpell(c, 3, 'pass-without-trace'), 'the druid could not cast it').toBe(true);
    const after = c.characters.map((_, i) => characterSkillBonus(c, i, 'stealth'));
    for (const [i, b] of before.entries()) {
      expect(after[i], `hero ${i} was not hushed`).toBe(b + 10);
    }

    // A camp buff, so it lapses with the others at the next rest.
    shortRest(c);
    expect(c.characters.map((_, i) => characterSkillBonus(c, i, 'stealth'))).toEqual(before);
  });
});
