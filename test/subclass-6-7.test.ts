import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { FEATURES } from '../src/data/features.js';
import { CLASSES } from '../src/data/classes.js';

const pc = (classId: string, level: number, position: { x: number; y: number }, id: string) =>
  ({ ...buildCharacter({ classId, team: 'team1' as const, position, level }), id });

describe('subclass features at 6th and 7th', () => {
  it('Aura of Devotion stops a charm landing inside the aura', () => {
    // The ally has to be the NEAREST enemy to the succubus or the charm goes to
    // the paladin instead — and a paladin's own Aura of Protection makes its
    // save so good that the test would measure nothing at all.
    const charmedCount = (palLevel: number) => {
      let charmed = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const c = new Combat({
          seed, width: 8, height: 8,
          combatants: [
            pc('fighter', 7, { x: 2, y: 2 }, 'ally'),
            pc('paladin', palLevel, { x: 1, y: 3 }, 'pal'),
            { ...buildMonster('succubus', 'team2', { x: 5, y: 2 }), id: 'succ' },
          ],
        });
        FEATURES['charm']!.apply!({ state: c.state, actorId: 'succ' });
        if (c.state.combatants['ally']!.conditions.some((k) => k.id === 'charmed')) charmed++;
      }
      return charmed;
    };
    expect(charmedCount(6), 'a 6th-level paladin has no ward to give').toBeGreaterThan(0);
    expect(charmedCount(7), 'nothing should be charmed inside the aura').toBe(0);
  });

  it('Aura of Devotion is a position, not a party-wide blessing', () => {
    let charmed = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed, width: 12, height: 12,
        combatants: [
          pc('fighter', 7, { x: 2, y: 2 }, 'ally'),
          pc('paladin', 7, { x: 10, y: 10 }, 'pal'),   // far out of the aura
          { ...buildMonster('succubus', 'team2', { x: 5, y: 2 }), id: 'succ' },
        ],
      });
      FEATURES['charm']!.apply!({ state: c.state, actorId: 'succ' });
      if (c.state.combatants['ally']!.conditions.some((k) => k.id === 'charmed')) charmed++;
    }
    expect(charmed, 'the ward reached across the whole board').toBeGreaterThan(0);
  });

  it('Escape the Horde gives opportunity attacks disadvantage', () => {
    const disadvantaged = (level: number) => {
      let dis = 0, n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const c = new Combat({
          seed, width: 8, height: 8,
          combatants: [pc('ranger', level, { x: 2, y: 2 }, 'r'), { ...buildMonster('ogre', 'team2', { x: 3, y: 2 }), id: 'o' }],
        });
        const evs = resolveAttack(c.state, 'o', 'r', c.state.combatants['o']!.equipped.mainHand!, { opportunity: true });
        const a = evs.find((e) => e.type === 'attackRolled');
        if (a && 'mode' in a) { n++; if (a.mode === 'disadvantage') dis++; }
      }
      return { dis, n };
    };
    expect(disadvantaged(6).dis).toBe(0);
    const seven = disadvantaged(7);
    expect(seven.dis).toBe(seven.n);
  });

  it('Escape the Horde does not touch an ordinary attack', () => {
    let dis = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed, width: 8, height: 8,
        combatants: [pc('ranger', 7, { x: 2, y: 2 }, 'r'), { ...buildMonster('ogre', 'team2', { x: 3, y: 2 }), id: 'o' }],
      });
      const evs = resolveAttack(c.state, 'o', 'r', c.state.combatants['o']!.equipped.mainHand!);
      const a = evs.find((e) => e.type === 'attackRolled');
      if (a && 'mode' in a && a.mode === 'disadvantage') dis++;
    }
    expect(dis).toBe(0);
  });

  it('Blessed Healer pays the cleric back for healing someone else', () => {
    const healSelf = (level: number) => {
      const c = new Combat({
        seed: 3, width: 8, height: 8,
        combatants: [
          { ...pc('cleric', level, { x: 1, y: 1 }, 'cle'), hp: 10 },
          { ...pc('fighter', level, { x: 2, y: 1 }, 'ally'), hp: 5 },
          { ...buildMonster('orc', 'team2', { x: 7, y: 7 }), id: 'o' },
        ],
      });
      let guard = 0;
      while (c.activeId !== 'cle' && guard++ < 40) c.apply({ kind: 'endTurn' });
      const before = c.state.combatants['cle']!.hp;
      const cast = c.legalActions('cle').find((a) => a.kind === 'castSpell' && a.spellId === 'cure-wounds' &&
        a.targets.some((t) => 'combatantId' in t && t.combatantId === 'ally'));
      expect(cast, 'Cure Wounds on the ally was not offered').toBeDefined();
      c.apply(cast!);
      return c.state.combatants['cle']!.hp - before;
    };
    expect(healSelf(5)).toBe(0);
    expect(healSelf(6), 'should be 2 + the slot level').toBe(3);
  });

  it('a 7th-level fighter picks a second Fighting Style', () => {
    const points = (CLASSES['fighter']!.choices ?? []).filter((p) => p.atLevel <= 7);
    expect(points.length, 'only one Fighting Style choice exists at 7th').toBe(2);
    // Distinct ids, or picks (keyed by id) would choose once for both.
    expect(new Set(points.map((p) => p.id)).size).toBe(2);
    const seven = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 7,
      choices: { 'fighting-style': 'dueling', 'fighting-style-2': 'archery' },
    });
    expect(seven.featureIds).toContain('dueling');
    expect(seven.featureIds).toContain('archery');
    const six = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 6 });
    expect(six.featureIds.filter((f) => ['dueling', 'archery', 'defense', 'great-weapon-fighting', 'two-weapon-fighting'].includes(f)))
      .toHaveLength(1);
  });

  it('picking the same style twice grants it once, not twice', () => {
    // Most readers ask `featureIds.includes(...)`, but advantageDice SUMS across
    // the list — a duplicated feature would quietly roll twice. The builder
    // dedupes so no reader has to be careful.
    const f = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 7,
      choices: { 'fighting-style': 'dueling', 'fighting-style-2': 'dueling' },
    });
    expect(f.featureIds.filter((x) => x === 'dueling')).toHaveLength(1);
    expect(new Set(f.featureIds).size).toBe(f.featureIds.length);
  });
});
