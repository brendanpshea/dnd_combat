import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { acOf } from '../src/data/armor.js';
import type { Combatant, Position } from '../src/engine/types.js';

const fighter = (position: Position, id: string, styles: string[] = [], level = 3): Combatant => {
  const c = buildCharacter({ classId: 'fighter', team: 'team1', position, speciesId: 'human', level });
  // Fighter ships with Dueling; swap in the style under test so it stands alone.
  return { ...c, id, featureIds: [...c.featureIds.filter((f) => f !== 'dueling'), ...styles] };
};
const dummy = (position: Position, id: string): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp: 999, maxHp: 999, acOverride: 5 });

function totalOfFirstAttack(seed: number, styles: string[], weaponId: string, targetAt: Position): number {
  const atk = fighter({ x: 3, y: 3 }, 'f', styles);
  const c = new Combat({ seed, mapId: 'open', combatants: [atk, dummy(targetAt, 't')] });
  const evs = resolveAttack(c.state, 'f', 't', weaponId);
  const roll = evs.find((e) => e.type === 'attackRolled')!;
  return (roll as { total: number }).total;
}

describe('Fighting Style: Defense', () => {
  it('adds +1 AC while armored, and nothing while unarmored', () => {
    const armored = fighter({ x: 1, y: 1 }, 'a', ['defense']);
    const plain = fighter({ x: 2, y: 2 }, 'b', []);
    expect(acOf(armored)).toBe(acOf(plain) + 1);

    const bare = { ...plain, equipped: { ...plain.equipped, armor: undefined } };
    const bareDefense = { ...bare, featureIds: [...bare.featureIds, 'defense'] };
    expect(acOf(bareDefense)).toBe(acOf(bare)); // no armor, no bonus
  });
});

describe('Fighting Style: Archery', () => {
  it('adds +2 to a ranged attack roll and nothing to a melee one', () => {
    // Same seed → same natural d20; the only difference is the +2.
    for (let seed = 1; seed <= 5; seed++) {
      const withArchery = totalOfFirstAttack(seed, ['archery'], 'shortbow', { x: 6, y: 3 });
      const without = totalOfFirstAttack(seed, [], 'shortbow', { x: 6, y: 3 });
      expect(withArchery - without).toBe(2);
      // Melee weapon: no change.
      const meleeWith = totalOfFirstAttack(seed, ['archery'], 'longsword', { x: 4, y: 3 });
      const meleeWithout = totalOfFirstAttack(seed, [], 'longsword', { x: 4, y: 3 });
      expect(meleeWith - meleeWithout).toBe(0);
    }
  });
});

describe('Fighting Style: Great Weapon Fighting', () => {
  it('rerolls 1s and 2s on a two-handed weapon so average damage rises', () => {
    let withSum = 0, withoutSum = 0;
    const trials = 120;
    for (let seed = 1; seed <= trials; seed++) {
      withSum += damage(seed, ['great-weapon-fighting'], 'greatsword', { x: 4, y: 3 });
      withoutSum += damage(seed, [], 'greatsword', { x: 4, y: 3 });
    }
    // Rerolling 1s/2s on 2d6 lifts the mean by ~1.7/die; comfortably positive.
    expect(withSum).toBeGreaterThan(withoutSum + trials);
  });
});

describe('Fighting Style: Two-Weapon Fighting', () => {
  it('adds the ability modifier to off-hand damage', () => {
    let withSum = 0, withoutSum = 0;
    const trials = 60;
    for (let seed = 1; seed <= trials; seed++) {
      withSum += damage(seed, ['two-weapon-fighting'], 'shortsword', { x: 4, y: 3 }, true);
      withoutSum += damage(seed, [], 'shortsword', { x: 4, y: 3 }, true);
    }
    // Every landed off-hand swing gains the (positive) Str/Dex mod; the gap is
    // trials × mod minus the misses, still clearly above zero.
    expect(withSum).toBeGreaterThan(withoutSum);
  });
});

function damage(seed: number, styles: string[], weaponId: string, at: Position, offhand = false): number {
  const atk = fighter({ x: 3, y: 3 }, 'f', styles);
  const c = new Combat({ seed, mapId: 'open', combatants: [atk, dummy(at, 't')] });
  const evs = resolveAttack(c.state, 'f', 't', weaponId, { offhand });
  const dmg = evs.find((e) => e.type === 'damageDealt');
  return dmg ? (dmg as { amount: number }).amount : 0;
}
