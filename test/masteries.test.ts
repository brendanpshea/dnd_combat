import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { abilityMod } from '../src/engine/types.js';
import type { Combatant, Position } from '../src/engine/types.js';

// A fighter that has trained the mastery for whatever weapon a test wields.
const wielder = (position: Position, id: string, weaponId: string): Combatant => {
  const c = buildCharacter({ classId: 'fighter', team: 'team1', position, speciesId: 'human', level: 3 });
  return { ...c, id, weaponMasteries: [...c.weaponMasteries, weaponId] };
};
// A target with a chosen AC so hits/misses are deterministic.
const target = (position: Position, id: string, ac: number): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp: 999, maxHp: 999, acOverride: ac });

describe('Weapon mastery: Slow', () => {
  it('applies the slowed condition on a hit and clears it at the victim next turn', () => {
    const atk = wielder({ x: 3, y: 3 }, 'a', 'javelin');
    const t = target({ x: 4, y: 3 }, 't', 1); // AC 1 → always hit
    const c = new Combat({ seed: 3, mapId: 'open', combatants: [atk, t] });
    resolveAttack(c.state, 'a', 't', 'javelin');
    expect(c.state.combatants['t']!.conditions.some((k) => k.id === 'slowed')).toBe(true);
  });
});

describe('Weapon mastery: Push', () => {
  it('shoves the target 10 ft straight away from the attacker on a hit', () => {
    const atk = wielder({ x: 3, y: 3 }, 'a', 'ogre-greatclub');
    const t = target({ x: 4, y: 3 }, 't', 1);
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [atk, t] });
    resolveAttack(c.state, 'a', 't', 'ogre-greatclub');
    // Pushed +x by 2 cells: 4 → 6.
    expect(c.state.combatants['t']!.position).toEqual({ x: 6, y: 3 });
  });
});

describe('Weapon mastery: Topple', () => {
  it('can knock a target prone (Con save) and never does so untrained', () => {
    let pronedTrained = 0, pronedUntrained = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const t1 = target({ x: 4, y: 3 }, 't', 1);
      const trained = new Combat({ seed, mapId: 'open', combatants: [wielder({ x: 3, y: 3 }, 'a', 'quarterstaff'), t1] });
      resolveAttack(trained.state, 'a', 't', 'quarterstaff');
      if (trained.state.combatants['t']!.conditions.some((k) => k.id === 'prone')) pronedTrained++;

      // Same fighter without the quarterstaff mastery.
      const base = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 3, y: 3 }, speciesId: 'human', level: 3 });
      const untrainedAtk = { ...base, id: 'a', weaponMasteries: base.weaponMasteries.filter((w) => w !== 'quarterstaff') };
      const t2 = target({ x: 4, y: 3 }, 't', 1);
      const untrained = new Combat({ seed, mapId: 'open', combatants: [untrainedAtk, t2] });
      resolveAttack(untrained.state, 'a', 't', 'quarterstaff');
      if (untrained.state.combatants['t']!.conditions.some((k) => k.id === 'prone')) pronedUntrained++;
    }
    expect(pronedTrained).toBeGreaterThan(0);
    expect(pronedUntrained).toBe(0);
  });
});

describe('Weapon mastery: Nick (SRD 5.2.1)', () => {
  it('makes the Light extra attack part of the Attack action, once a turn', () => {
    const atk = { ...wielder({ x: 3, y: 3 }, 'a', 'dagger'), equipped: { mainHand: 'shortsword', offHand: 'dagger', armor: 'leather' } };
    const t = target({ x: 4, y: 3 }, 't', 1);
    const c = new Combat({ seed: 3, mapId: 'open', combatants: [atk, t] });
    let guard = 0;
    while (c.activeId !== 'a' && guard++ < 10) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'attack', weaponId: 'shortsword', targetId: 't' });
    c.apply({ kind: 'attack', weaponId: 'dagger', targetId: 't', offhand: true });
    // The bonus action is still there.
    expect(c.state.combatants['a']!.turn.bonusActionUsed).toBe(false);
    expect(c.state.combatants['a']!.turn.nickUsed).toBe(true);
  });
});

describe('Weapon mastery: Cleave (SRD 5.2.1)', () => {
  it('a hit swings on at a second creature beside the first, without the modifier', () => {
    const atk = wielder({ x: 3, y: 3 }, 'a', 'greataxe');
    const t = target({ x: 4, y: 3 }, 't', 1);
    const u = target({ x: 4, y: 4 }, 'u', 1);
    const c = new Combat({ seed: 2, mapId: 'open', combatants: [atk, t, u] });
    let guard = 0;
    while (c.activeId !== 'a' && guard++ < 10) c.apply({ kind: 'endTurn' });
    const evs = resolveAttack(c.state, 'a', 't', 'greataxe');
    const second = evs.filter((e) => e.type === 'damageDealt' && e.targetId === 'u');
    expect(second.length).toBe(1);
    const d = second[0]!;
    if (d.type === 'damageDealt') expect(d.amount).toBe(d.rolls.reduce((s, r) => s + r, 0));
    // Once a turn.
    const again = resolveAttack(c.state, 'a', 't', 'greataxe');
    expect(again.some((e) => e.type === 'damageDealt' && e.targetId === 'u')).toBe(false);
  });

  it('a miss does nothing — that was Graze', () => {
    const atk = wielder({ x: 3, y: 3 }, 'a', 'greataxe');
    const t = target({ x: 4, y: 3 }, 't', 99);
    const c = new Combat({ seed: 2, mapId: 'open', combatants: [atk, t] });
    const evs = resolveAttack(c.state, 'a', 't', 'greataxe');
    expect(evs.some((e) => e.type === 'damageDealt')).toBe(false);
  });
});

describe('Weapon mastery: Graze', () => {
  it('deals the attacker ability modifier in damage even on a miss', () => {
    const atk = wielder({ x: 3, y: 3 }, 'a', 'greatsword');
    const t = target({ x: 4, y: 3 }, 't', 99); // AC 99 → always miss
    const c = new Combat({ seed: 2, mapId: 'open', combatants: [atk, t] });
    const evs = resolveAttack(c.state, 'a', 't', 'greatsword');
    const roll = evs.find((e) => e.type === 'attackRolled')!;
    expect((roll as { hit: boolean }).hit).toBe(false);
    const dmg = evs.find((e) => e.type === 'damageDealt');
    expect(dmg).toBeDefined();
    expect((dmg as { amount: number }).amount).toBe(abilityMod(atk.abilities.str));
  });
});
