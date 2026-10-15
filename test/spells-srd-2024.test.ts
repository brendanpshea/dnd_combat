import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { isLegalAction, step } from '../src/engine/actions.js';
import { breakConcentration } from '../src/engine/rules/attack.js';
import { SPELLS } from '../src/data/spells.js';
import { seedRng } from '../src/engine/rng.js';
import type { Combatant, GameState, Position } from '../src/engine/types.js';
import type { GameEvent } from '../src/engine/events.js';

/** Spells checked against their SRD 5.2.1 text. */

const pc = (classId: string, position: Position, id: string, level = 9, team: 'team1' | 'team2' = 'team1'): Combatant =>
  ({ ...buildCharacter({ classId, team, position, level }), id });
const dummy = (position: Position, id: string, extra: Partial<Combatant> = {}): Combatant =>
  ({ ...buildMonster('ogre', 'team2', position), id, hp: 300, maxHp: 300, ...extra });

function onTurn(c: Combat, id: string): GameState {
  let guard = 0;
  while (c.activeId !== id && guard++ < 20) c.apply({ kind: 'endTurn' });
  return c.state;
}
const cast = (s: GameState, spellId: string, slotLevel: number, targets: Array<{ combatantId: string } | { position: Position }>, seed = 1) => {
  const t: GameState = structuredClone(s);
  t.rng = seedRng(seed);
  return step(t, { kind: 'castSpell', spellId, slotLevel, targets });
};
const dealt = (events: GameEvent[], id: string) =>
  events.reduce((n, e) => n + (e.type === 'damageDealt' && e.targetId === id ? e.amount : 0), 0);

describe('Cone of Cold', () => {
  it('fills the cone, not just the cell that names its direction', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('wizard', { x: 0, y: 3 }, 'w'), dummy({ x: 2, y: 3 }, 'far')] });
    const s = onTurn(c, 'w');
    const r = cast(s, 'cone-of-cold', 5, [{ position: { x: 1, y: 3 } }]);
    expect(dealt(r.events, 'far')).toBeGreaterThan(0);
  });
});

describe('Inflict Wounds (line 12155)', () => {
  it('is a Constitution save for 2d10, half on a success', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('cleric', { x: 3, y: 3 }, 'cl'), dummy({ x: 3, y: 4 }, 'o')] });
    const s = onTurn(c, 'cl');
    let half = false, full = false;
    for (let seed = 1; seed < 60 && !(half && full); seed++) {
      const r = cast(s, 'inflict-wounds', 1, [{ combatantId: 'o' }], seed);
      expect(r.events.some((e) => e.type === 'attackRolled')).toBe(false);
      const save = r.events.find((e) => e.type === 'savingThrow' && e.combatantId === 'o');
      expect(save?.type === 'savingThrow' && save.ability).toBe('con');
      const d = dealt(r.events, 'o');
      expect(d).toBeLessThanOrEqual(20);
      if (save?.type === 'savingThrow' && save.success) { half = true; expect(d).toBeLessThanOrEqual(10); }
      else full = true;
    }
    expect(half && full).toBe(true);
  });
});

describe('Mass Healing Word (line 12340)', () => {
  it('heals 2d4 plus the modifier', () => {
    const cl = pc('cleric', { x: 3, y: 3 }, 'cl');
    const mate = { ...pc('fighter', { x: 4, y: 3 }, 'f'), hp: 1 };
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [cl, mate, dummy({ x: 7, y: 7 }, 'o')] });
    const s = onTurn(c, 'cl');
    s.combatants['cl']!.featureIds = s.combatants['cl']!.featureIds.filter((f) => f !== 'disciple-of-life');
    const mod = Math.floor((s.combatants['cl']!.abilities.wis - 10) / 2);
    for (let seed = 1; seed < 20; seed++) {
      const r = cast(s, 'mass-healing-word', 3, [{ combatantId: 'f' }], seed);
      const healed = r.events.find((e) => e.type === 'healed' && e.targetId === 'f');
      expect(healed?.type === 'healed' && healed.amount).toBeGreaterThanOrEqual(2 + mod);
    }
  });
});

describe('Phantasmal Killer (line 12480)', () => {
  it('half on a save, the damage again on a failed repeat, and upcast', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('wizard', { x: 0, y: 0 }, 'w'), dummy({ x: 5, y: 5 }, 'o')] });
    const s = onTurn(c, 'w');
    expect(SPELLS['phantasmal-killer']!.upcast).toBe(true);
    let saved = false, failed = false;
    for (let seed = 1; seed < 80 && !(saved && failed); seed++) {
      const r = cast(s, 'phantasmal-killer', 4, [{ combatantId: 'o' }], seed);
      const save = r.events.find((e) => e.type === 'savingThrow');
      const d = dealt(r.events, 'o');
      if (save?.type === 'savingThrow' && save.success) {
        saved = true;
        expect(d).toBeLessThanOrEqual(20);
        expect(r.state.combatants['w']!.concentratingOn).toBeUndefined();
      } else {
        failed = true;
        const fear = r.state.combatants['o']!.conditions.find((k) => k.id === 'frightened');
        expect(fear?.failDamage).toEqual({ dice: '4d10', type: 'psychic' });
      }
    }
    expect(saved && failed).toBe(true);
  });
});

describe('Magic Missile and Scorching Ray upcast', () => {
  it('a dart (or ray) more per slot level', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('wizard', { x: 0, y: 0 }, 'w'), dummy({ x: 5, y: 5 }, 'o')] });
    const s = onTurn(c, 'w');
    const darts = (n: number) => Array.from({ length: n }, () => ({ combatantId: 'o' }));
    expect(isLegalAction(s, 'w', { kind: 'castSpell', spellId: 'magic-missile', slotLevel: 1, targets: darts(4) })).toBe(false);
    expect(isLegalAction(s, 'w', { kind: 'castSpell', spellId: 'magic-missile', slotLevel: 2, targets: darts(4) })).toBe(true);
    expect(isLegalAction(s, 'w', { kind: 'castSpell', spellId: 'scorching-ray', slotLevel: 2, targets: darts(4) })).toBe(false);
    expect(isLegalAction(s, 'w', { kind: 'castSpell', spellId: 'scorching-ray', slotLevel: 3, targets: darts(4) })).toBe(true);
    const r = cast(s, 'magic-missile', 3, darts(5));
    expect(r.events.filter((e) => e.type === 'damageDealt').length).toBe(5);
  });
});

describe('Counterspell (line 11301)', () => {
  it('the caster saves; a countered caster keeps its slot, one that saves casts anyway', () => {
    let countered = false, resisted = false;
    for (let seed = 1; seed < 80 && !(countered && resisted); seed++) {
      const me = pc('wizard', { x: 1, y: 1 }, 'me', 7);
      const enemy = pc('wizard', { x: 3, y: 1 }, 'e1', 7, 'team2');
      const c = new Combat({ combatants: [me, enemy, dummy({ x: 6, y: 6 }, 'o')], seed });
      const s = onTurn(c, 'e1');
      const before = s.combatants['e1']!.spellSlots[2]!.current;
      const r = cast(s, 'fireball', 3, [{ position: { x: 1, y: 2 } }], seed);
      const ev = r.events.find((e) => e.type === 'counterspelled');
      expect(ev).toBeDefined();
      if (ev?.type === 'counterspelled' && !ev.resisted) {
        countered = true;
        expect(r.state.combatants['e1']!.spellSlots[2]!.current).toBe(before);
        expect(dealt(r.events, 'me')).toBe(0);
      } else {
        resisted = true;
        expect(r.state.combatants['e1']!.spellSlots[2]!.current).toBe(before - 1);
      }
    }
    expect(countered && resisted).toBe(true);
  });
});

describe('Sleep ends with its concentration', () => {
  it('the sleepers wake when the caster stops concentrating', () => {
    for (let seed = 1; seed < 40; seed++) {
      const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('wizard', { x: 0, y: 0 }, 'w', 3), { ...buildMonster('bandit', 'team2', { x: 4, y: 4 }), id: 'b' }] });
      const s = onTurn(c, 'w');
      const r = cast(s, 'sleep', 1, [{ position: { x: 4, y: 4 } }], seed);
      if (!r.state.combatants['b']!.conditions.some((k) => k.id === 'incapacitated')) continue;
      breakConcentration(r.state, 'w');
      expect(r.state.combatants['b']!.conditions.some((k) => k.id === 'incapacitated' || k.id === 'unconscious')).toBe(false);
      return;
    }
    throw new Error('the bandit never slept');
  });
});

describe('Disciple of Life on every slot heal', () => {
  it('Healing Word restores 2 + the slot level more', () => {
    const cl = pc('cleric', { x: 3, y: 3 }, 'cl', 3);
    const mate = { ...pc('fighter', { x: 4, y: 3 }, 'f', 3), hp: 1 };
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [cl, mate, dummy({ x: 7, y: 7 }, 'o')] });
    const s = onTurn(c, 'cl');
    expect(s.combatants['cl']!.featureIds).toContain('disciple-of-life');
    const r = cast(s, 'healing-word', 1, [{ combatantId: 'f' }]);
    const heals = r.events.filter((e) => e.type === 'healed' && e.targetId === 'f');
    expect(heals.length).toBe(2);
    expect(heals[1]!.type === 'healed' && heals[1].amount).toBe(3);
  });
});

describe('True Strike', () => {
  it('adds 1d6 radiant from 5th level', () => {
    const c = new Combat({ seed: 1, width: 8, height: 8, combatants: [pc('wizard', { x: 3, y: 3 }, 'w', 5), dummy({ x: 3, y: 4 }, 'o', { acOverride: 1 })] });
    const s = onTurn(c, 'w');
    const weapon = s.combatants['w']!.equipped.mainHand!;
    const t: GameState = structuredClone(s);
    const r = step(t, { kind: 'castSpell', spellId: 'true-strike', slotLevel: 0, targets: [{ combatantId: 'o' }], weaponId: weapon });
    expect(r.events.some((e) => e.type === 'damageDealt' && e.damageType === 'radiant' && e.tags?.includes('True Strike'))).toBe(true);
  });
});
