import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack, collectAttackSources } from '../src/engine/rules/attack.js';
import { legalActions, isLegalAction } from '../src/engine/actions.js';
import { WEAPONS, weaponCategory } from '../src/data/weapons.js';
import { seedRng } from '../src/engine/rng.js';
import type { Combatant, GameState, Position } from '../src/engine/types.js';
import type { GameEvent } from '../src/engine/events.js';
import { TRINKETS } from '../src/data/trinkets.js';
import { acOf } from '../src/data/armor.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Weapon properties and masteries against SRD 5.2.1 (lines 9071-9118). */

const hero = (position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildCharacter({ classId: 'fighter', team: 'team1', position, level: 5 }), id, ...over });
const dummy = (position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp: 999, maxHp: 999, acOverride: 1, vulnerabilities: [], ...over });
const turnOf = (c: Combat, id: string) => {
  let guard = 0;
  while (c.activeId !== id && guard++ < 10) c.apply({ kind: 'endTurn' });
};
const hits = (events: GameEvent[], id: string) =>
  events.filter((e): e is Extract<GameEvent, { type: 'damageDealt' }> => e.type === 'damageDealt' && e.targetId === id);

describe('the weapon table', () => {
  it('the scimitar is martial and the sling has Slow', () => {
    expect(weaponCategory('scimitar')).toBe('martial');
    expect(WEAPONS['sling']!.mastery).toBe('slow');
  });
});

describe('Versatile', () => {
  it('a longsword in both hands rolls the d10; with a shield, the d8', () => {
    let maxTwo = 0, maxOne = 0;
    for (let seed = 1; seed <= 80; seed++) {
      for (const offHand of [undefined, 'shield'] as const) {
        const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [
          hero({ x: 3, y: 3 }, 'h', { equipped: { mainHand: 'longsword', armor: 'scale-mail', ...(offHand ? { offHand } : {}) } }),
          dummy({ x: 4, y: 3 }, 'd'),
        ] });
        c.state.rng = seedRng(seed);
        for (const d of hits(resolveAttack(c.state, 'h', 'd', 'longsword'), 'd')) {
          const die = Math.max(...d.rolls);
          if (offHand) maxOne = Math.max(maxOne, die); else maxTwo = Math.max(maxTwo, die);
        }
      }
    }
    expect(maxOne).toBeLessThanOrEqual(8);
    expect(maxTwo).toBeGreaterThan(8);
  });
});

describe('Heavy', () => {
  it('disadvantage below 13 Strength with a heavy melee weapon', () => {
    const weak = hero({ x: 3, y: 3 }, 'w', { abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 } });
    const strong = hero({ x: 3, y: 3 }, 's');
    const t = dummy({ x: 4, y: 3 }, 'd');
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [weak, t] });
    expect(collectAttackSources(c.state, weak, t, WEAPONS['greatsword']!, true).dis).toContain('heavy weapon');
    expect(collectAttackSources(c.state, strong, t, WEAPONS['greatsword']!, true).dis).not.toContain('heavy weapon');
  });
});

describe('Loading', () => {
  it('one crossbow bolt an action, whatever Extra Attack says', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [
      hero({ x: 0, y: 0 }, 'h', { equipped: { mainHand: 'light-crossbow', armor: 'scale-mail' }, inventory: [{ itemId: 'longsword', qty: 1 }] }),
      dummy({ x: 5, y: 5 }, 'd'),
    ] });
    turnOf(c, 'h');
    const shoot = { kind: 'attack' as const, weaponId: 'light-crossbow', targetId: 'd' };
    c.apply(shoot);
    expect(c.state.combatants['h']!.turn.attacksLeft).toBe(1);
    expect(isLegalAction(c.state, 'h', shoot)).toBe(false);
  });
});

describe('Push', () => {
  it('moves a Large creature, not a Huge one', () => {
    for (const [size, moves] of [['large', true], ['huge', false]] as const) {
      const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [
        hero({ x: 2, y: 3 }, 'h', { weaponMasteries: ['warhammer'], equipped: { mainHand: 'warhammer', armor: 'scale-mail' } }),
        dummy({ x: 3, y: 3 }, 'd', { size }),
      ] });
      resolveAttack(c.state, 'h', 'd', 'warhammer');
      expect(c.state.combatants['d']!.position.x !== 3, size).toBe(moves);
    }
  });
});

describe('the Light extra attack', () => {
  it('keeps a negative ability modifier on its damage', () => {
    const clumsy = hero({ x: 3, y: 3 }, 'h', {
      abilities: { str: 6, dex: 6, con: 14, int: 10, wis: 10, cha: 10 },
      equipped: { mainHand: 'shortsword', offHand: 'dagger', armor: 'leather' },
    });
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [clumsy, dummy({ x: 4, y: 3 }, 'd')] });
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 5; seed++) {
      const s: GameState = structuredClone(c.state);
      s.rng = seedRng(seed);
      for (const d of hits(resolveAttack(s, 'h', 'd', 'dagger', { offhand: true }), 'd')) {
        checked++;
        expect(d.amount).toBe(Math.max(0, d.rolls.reduce((a, b) => a + b, 0) - 2));
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Unarmed Strike (line 14124)', () => {
  it('every character has one: 1 + Strength bludgeoning', () => {
    const h = hero({ x: 3, y: 3 }, 'h');
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [h, dummy({ x: 4, y: 3 }, 'd')] });
    turnOf(c, 'h');
    expect(legalActions(c.state, 'h').some((a) => a.kind === 'attack' && a.weaponId === 'unarmed-strike')).toBe(true);
    const d = hits(resolveAttack(c.state, 'h', 'd', 'unarmed-strike'), 'd')[0]!;
    expect(d.amount).toBe(1 + Math.floor((h.abilities.str - 10) / 2));
  });

  it('a monster has only its stat block', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [hero({ x: 3, y: 3 }, 'h'), dummy({ x: 4, y: 3 }, 'd')] });
    turnOf(c, 'd');
    expect(legalActions(c.state, 'd').some((a) => a.kind === 'attack' && a.weaponId === 'unarmed-strike')).toBe(false);
  });

  it('is an opportunity attack for a hero holding a bow', () => {
    const archer = hero({ x: 3, y: 3 }, 'h', { equipped: { mainHand: 'longbow', armor: 'leather' }, inventory: [] });
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [archer, { ...dummy({ x: 4, y: 3 }, 'd'), speed: 30 }] });
    turnOf(c, 'd');
    const away = legalActions(c.state, 'd').find((a) => a.kind === 'move' && a.to.x === 7);
    expect(away).toBeDefined();
    const evs = c.apply(away!);
    expect(evs.some((e) => e.type === 'attackRolled' && e.opportunity && e.weaponId === 'unarmed-strike')).toBe(true);
  });
});

describe('the rest of the weapon table (line 9120 on)', () => {
  // Damage, properties, mastery and category, as printed.
  const TABLE: Record<string, [string, string, string[], string, 'simple' | 'martial']> = {
    club: ['1d4', 'bludgeoning', ['light'], 'slow', 'simple'],
    dart: ['1d4', 'piercing', ['finesse', 'thrown'], 'vex', 'simple'],
    flail: ['1d8', 'bludgeoning', [], 'sap', 'martial'],
    glaive: ['1d10', 'slashing', ['heavy', 'reach', 'two-handed'], 'graze', 'martial'],
    halberd: ['1d10', 'slashing', ['heavy', 'reach', 'two-handed'], 'cleave', 'martial'],
    pike: ['1d10', 'piercing', ['heavy', 'reach', 'two-handed'], 'push', 'martial'],
    trident: ['1d8', 'piercing', ['thrown', 'versatile'], 'topple', 'martial'],
    'war-pick': ['1d8', 'piercing', ['versatile'], 'sap', 'martial'],
    'heavy-crossbow': ['1d10', 'piercing', ['heavy', 'loading', 'two-handed'], 'push', 'martial'],
  };
  for (const [id, [dice, type, props, mastery, cat]] of Object.entries(TABLE)) {
    it(`${id} is as printed`, () => {
      const w = WEAPONS[id]!;
      expect(w, id).toBeDefined();
      expect([w.damage, w.damageType, [...w.properties].sort(), w.mastery]).toEqual([dice, type, [...props].sort(), mastery]);
      expect(weaponCategory(id)).toBe(cat);
      expect(w.cost).toBeGreaterThan(0);
    });
  }

  it('the versatile ones roll a d10 in two hands, the thrown ones reach 20/60', () => {
    expect(WEAPONS['trident']!.versatile).toBe('1d10');
    expect(WEAPONS['war-pick']!.versatile).toBe('1d10');
    expect(WEAPONS['trident']!.range).toEqual({ normal: 20, long: 60 });
    expect(WEAPONS['dart']!.range).toEqual({ normal: 20, long: 60 });
    expect(WEAPONS['heavy-crossbow']!.range).toEqual({ normal: 100, long: 400 });
  });

  it('a pike reaches ten feet', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [
      hero({ x: 0, y: 0 }, 'h', { equipped: { mainHand: 'pike', armor: 'scale-mail' } }),
      dummy({ x: 2, y: 0 }, 'd'),
    ] });
    turnOf(c, 'h');
    expect(isLegalAction(c.state, 'h', { kind: 'attack', weaponId: 'pike', targetId: 'd' })).toBe(true);
    expect(isLegalAction(c.state, 'h', { kind: 'attack', weaponId: 'flail', targetId: 'd' })).toBe(false);
  });

  it('a heavy crossbow is one bolt an action', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [
      hero({ x: 0, y: 0 }, 'h', { equipped: { mainHand: 'heavy-crossbow', armor: 'scale-mail' } }),
      dummy({ x: 5, y: 5 }, 'd'),
    ] });
    turnOf(c, 'h');
    const shoot = { kind: 'attack' as const, weaponId: 'heavy-crossbow', targetId: 'd' };
    c.apply(shoot);
    expect(isLegalAction(c.state, 'h', shoot)).toBe(false);
  });
});

describe('Ring of Protection (line 16661)', () => {
  it('is a ring for +1 to AC and every save, and stacks with the cloak', () => {
    expect(TRINKETS['ring-protection']).toMatchObject({ slot: 'ring', rarity: 'rare', attunement: true });
    const ringed = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 1 }, level: 5,
      equipped: { mainHand: 'longsword', armor: 'chain-mail', ring: 'ring-protection' } }), id: 'b' };
    const both = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 2 }, level: 5,
      equipped: { mainHand: 'longsword', armor: 'chain-mail', ring: 'ring-protection', trinket: 'cloak-protection' } }), id: 'k' };
    const bare = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 3 }, level: 5,
      equipped: { mainHand: 'longsword', armor: 'chain-mail' } }), id: 'p' };
    expect(acOf(ringed) - acOf(bare)).toBe(1);
    expect(acOf(both) - acOf(bare)).toBe(2);
    const c = new Combat({ seed: 4, width: 8, height: 8, combatants: [ringed, bare, dummy({ x: 6, y: 6 }, 'd')] });
    for (const ab of ['str', 'wis'] as const) {
      const s1: GameState = structuredClone(c.state);
      const s2: GameState = structuredClone(c.state);
      const r = savingThrow(s1, 'b', ab, 15, { magical: false }).event;
      const n = savingThrow(s2, 'p', ab, 15, { magical: false }).event;
      expect(r.type === 'savingThrow' && n.type === 'savingThrow' && r.total - n.total).toBe(1);
    }
  });

  it('every worn item says whether it needs attunement, as the SRD does', () => {
    const srd = readFileSync(fileURLToPath(new URL('../SRD_CC_v5.2.1.txt', import.meta.url)), 'utf8').split('\n');
    const name = (t: string) => t
      .replace(/^Ring of \w+ Resistance$/, 'Ring of Resistance')
      .replace(/^Belt of Hill Giant Strength$/, 'Belt of Giant Strength')
      .replace(/^Wand of the War Mage \+\d$/, 'Wand of the War Mage, +1, +2, or +3');
    for (const t of Object.values(TRINKETS)) {
      const at = srd.findIndex((l) => l.trim() === name(t.name));
      expect(at, `${t.name} not found in the SRD`).toBeGreaterThan(0);
      const needs = /Requires Attunement/.test(srd[at + 1]!);
      expect(t.attunement === true, t.name).toBe(needs);
    }
  });
});
