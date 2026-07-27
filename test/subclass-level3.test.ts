import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { CLASSES } from '../src/data/classes.js';

const pc = (classId: string, level: number, position: { x: number; y: number }, id: string) =>
  ({ ...buildCharacter({ classId, team: 'team1' as const, position, level }), id });

describe('subclass features at 3rd level', () => {
  /**
   * Every class picks up its subclass at 3rd and the druid picked up nothing —
   * the only class in the game with no subclass feature at all. That is a hole
   * every single playthrough walks into, unlike anything at 6th or 7th which
   * only the deepest runs ever see.
   */
  it('every class gains a feature at 3rd level', () => {
    for (const cls of Object.values(CLASSES)) {
      const two = buildCharacter({ classId: cls.id, team: 'team1', position: { x: 0, y: 0 }, level: 2 });
      const three = buildCharacter({ classId: cls.id, team: 'team1', position: { x: 0, y: 0 }, level: 3 });
      const gained = three.featureIds.filter((f) => !two.featureIds.includes(f));
      expect(gained.length, `${cls.id} gains nothing at 3rd`).toBeGreaterThan(0);
    }
  });

  it("Land's Aid hurts enemies, heals an ally, and costs a Wild Shape use", () => {
    const dru = pc('druid', 4, { x: 3, y: 3 }, 'dru');
    const ally = { ...pc('fighter', 4, { x: 4, y: 4 }, 'ally'), hp: 5 };
    const foes = [0, 1].map((i) => ({ ...buildMonster('orc', 'team2', { x: 4 + i, y: 3 }), id: `m${i}` }));
    const c = new Combat({ seed: 4, width: 8, height: 8, combatants: [dru, ally, ...foes] });
    while (c.activeId !== 'dru') c.apply({ kind: 'endTurn' });

    const before = c.state.combatants['dru']!.featureUses['wild-shape']!.current;
    const aid = c.legalActions('dru').find((a) => a.kind === 'useFeature' && a.featureId === 'lands-aid');
    expect(aid, "Land's Aid is never offered").toBeDefined();
    const events = c.apply(aid!);

    expect(events.some((e) => e.type === 'damageDealt'), 'nothing was hurt').toBe(true);
    expect(events.some((e) => e.type === 'healed'), 'nobody was healed').toBe(true);
    // It spends Wild Shape, so it competes with turning into a bear rather than
    // being a free extra.
    expect(c.state.combatants['dru']!.featureUses['wild-shape']!.current).toBe(before - 1);
  });

  it("Land's Aid spares allies standing in it", () => {
    const dru = pc('druid', 4, { x: 0, y: 0 }, 'dru');
    const ally = { ...pc('fighter', 4, { x: 4, y: 4 }, 'ally'), hp: 5 };
    const foes = [0, 1].map((i) => ({ ...buildMonster('orc', 'team2', { x: 4 + i, y: 5 }), id: `m${i}` }));
    const c = new Combat({ seed: 4, width: 8, height: 8, combatants: [dru, ally, ...foes] });
    while (c.activeId !== 'dru') c.apply({ kind: 'endTurn' });
    const aid = c.legalActions('dru').find((a) => a.kind === 'useFeature' && a.featureId === 'lands-aid');
    if (!aid) return;
    const hurt = c.apply(aid).filter((e) => e.type === 'damageDealt').map((e) => (e as { targetId: string }).targetId);
    expect(hurt, 'an ally was caught in the sphere').not.toContain('ally');
  });

  it('Remarkable Athlete rolls initiative with advantage', () => {
    const mean = (level: number) => {
      let total = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const f = pc('fighter', level, { x: 1, y: 1 }, 'f');
        const c = new Combat({ seed, width: 8, height: 8, combatants: [f, { ...buildMonster('orc', 'team2', { x: 6, y: 6 }), id: 'o' }] });
        total += c.state.combatants['f']!.initiative;
      }
      return total / 200;
    };
    // Advantage on a d20 is worth about +3.3 on average; 2 is a comfortable
    // floor that random variation cannot reach at n=200.
    expect(mean(3)).toBeGreaterThan(mean(2) + 2);
  });

  it('a critical hit buys a Champion half its speed, unprovoked', () => {
    let crits = 0, granted = 0, disengaged = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const f = pc('fighter', 3, { x: 1, y: 1 }, 'f');
      const c = new Combat({ seed, width: 8, height: 8, combatants: [f, { ...buildMonster('ogre', 'team2', { x: 2, y: 1 }), id: 'o' }] });
      while (c.activeId !== 'f') c.apply({ kind: 'endTurn' });
      const before = c.state.combatants['f']!.turn.movementMax;
      const evs = resolveAttack(c.state, 'f', 'o', c.state.combatants['f']!.equipped.mainHand!);
      if (!evs.some((e) => e.type === 'attackRolled' && e.crit)) continue;
      crits++;
      granted += c.state.combatants['f']!.turn.movementMax - before;
      if (c.state.combatants['f']!.turn.disengaged) disengaged++;
    }
    expect(crits, 'no crits landed in 300 tries').toBeGreaterThan(0);
    expect(granted).toBe(crits * 15);   // half of 30 ft speed, every time
    expect(disengaged).toBe(crits);
  });

  it('a 2nd-level fighter gets none of it', () => {
    let granted = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const f = pc('fighter', 2, { x: 1, y: 1 }, 'f');
      const c = new Combat({ seed, width: 8, height: 8, combatants: [f, { ...buildMonster('ogre', 'team2', { x: 2, y: 1 }), id: 'o' }] });
      while (c.activeId !== 'f') c.apply({ kind: 'endTurn' });
      const before = c.state.combatants['f']!.turn.movementMax;
      resolveAttack(c.state, 'f', 'o', c.state.combatants['f']!.equipped.mainHand!);
      granted += c.state.combatants['f']!.turn.movementMax - before;
    }
    expect(granted).toBe(0);
  });
});
