import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { legalActions } from '../src/engine/actions.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { seedRng } from '../src/engine/rng.js';
import type { Combatant, GameState } from '../src/engine/types.js';

/**
 * "On a turn, you can expend only one spell slot to cast a spell" (SRD 5.2.1,
 * One Spell with a Spell Slot per Turn, line 10718).
 */

const pc = (classId: string, team: 'team1' | 'team2', x: number, y: number, id: string, level = 5): Combatant =>
  ({ ...buildCharacter({ classId, team, position: { x, y }, level }), id });

function turnOf(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 10) c.apply({ kind: 'endTurn' });
}

describe('one spell slot a turn', () => {
  it('a cleric who spent a slot on its action has no slot spell left for the bonus action — cantrips still', () => {
    const c = new Combat({
      seed: 2, width: 8, height: 8,
      combatants: [pc('cleric', 'team1', 1, 1, 'cle'), pc('fighter', 'team1', 2, 1, 'ftr'), pc('wizard', 'team2', 4, 4, 'wiz')],
    });
    turnOf(c, 'cle');
    const bless = legalActions(c.state, 'cle').find((a) => a.kind === 'castSpell' && a.spellId === 'bless');
    expect(bless).toBeDefined();
    c.apply(bless!);
    const after = legalActions(c.state, 'cle').filter((a) => a.kind === 'castSpell');
    expect(after.filter((a) => a.kind === 'castSpell' && a.slotLevel >= 1)).toEqual([]);
    // A slot spent is not the bonus action spent.
    expect(c.state.combatants['cle']!.turn.bonusActionUsed).toBe(false);
  });

  it('Divine Smite does not fire on a turn a slot was already spent', () => {
    const fired = (spent: boolean): boolean => {
      for (let seed = 1; seed < 400; seed++) {
        const c = new Combat({
          seed: 1, width: 8, height: 8,
          combatants: [pc('paladin', 'team1', 3, 3, 'pal'), { ...buildMonster('goblin-warrior', 'team2', { x: 3, y: 4 }), id: 'gob' }],
        });
        turnOf(c, 'pal');
        const s: GameState = structuredClone(c.state);
        s.rng = seedRng(seed);
        s.combatants['pal']!.turn.slotSpent = spent;
        s.combatants['gob']!.hp = s.combatants['gob']!.maxHp = 200;
        const events = resolveAttack(s, 'pal', 'gob', s.combatants['pal']!.equipped.mainHand!);
        const hit = events.find((e) => e.type === 'attackRolled');
        // A critical hit: the moment the auto-smite always takes.
        if (hit?.type !== 'attackRolled' || !hit.crit) continue;
        return events.some((e) => e.type === 'smited');
      }
      throw new Error('never crit');
    };
    expect(fired(false)).toBe(true);
    expect(fired(true)).toBe(false);
  });
});
