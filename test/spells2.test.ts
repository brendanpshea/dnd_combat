import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id, ...over });
const foe = (monsterId: string, position: Position, id: string): Combatant =>
  ({ ...buildMonster(monsterId, 'team2', position), id });

function until(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 40) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe(id);
}

describe('Healing Word', () => {
  it('heals an ally at range as a bonus action', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        pc('cleric', 1, { x: 1, y: 1 }, 'clr'),
        pc('fighter', 1, { x: 5, y: 1 }, 'ally', { hp: 3 }),
        foe('goblin-warrior', { x: 7, y: 7 }, 'g'),
      ],
    });
    until(c, 'clr');
    const events = c.apply({ kind: 'castSpell', spellId: 'healing-word', slotLevel: 1, targets: [{ combatantId: 'ally' }] });
    expect(events.some((e) => e.type === 'healed')).toBe(true);
    expect(c.state.combatants['ally']!.hp).toBeGreaterThan(3);
    expect(c.state.combatants['clr']!.turn.bonusActionUsed).toBe(true);
  });
});

describe('Suggestion', () => {
  it('removes a humanoid from the fight on a failed Wisdom save', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('wizard', 3, { x: 2, y: 2 }, 'wiz'), foe('bandit', { x: 4, y: 2 }, 'b')],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'suggestion', slotLevel: 2, targets: [{ combatantId: 'b' }] });
      if (!events.some((e) => e.type === 'charmedAway')) continue;
      expect(c.state.combatants['b']!.alive).toBe(false); // out of the fight, not dead
      return;
    }
    throw new Error('bandit never failed the save across 40 seeds');
  });

  it('cannot target a non-humanoid (a beast)', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('wizard', 3, { x: 2, y: 2 }, 'wiz'), foe('wolf', { x: 4, y: 2 }, 'w')],
    });
    until(c, 'wiz');
    const suggestion = c.legalActions().filter((a) => a.kind === 'castSpell' && a.spellId === 'suggestion');
    expect(suggestion).toHaveLength(0); // wolf is a beast; no valid target
  });
});

describe('Command', () => {
  it('makes a humanoid grovel: prone and no actions on its next turn', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('cleric', 1, { x: 1, y: 1 }, 'clr'), foe('goblin-warrior', { x: 5, y: 5 }, 'gob')],
      });
      until(c, 'clr');
      const events = c.apply({ kind: 'castSpell', spellId: 'command', slotLevel: 1, targets: [{ combatantId: 'gob' }] });
      if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'commanded')) continue;
      until(c, 'gob');
      const g = c.state.combatants['gob']!;
      expect(g.conditions.some((k) => k.id === 'prone')).toBe(true);
      const kinds = new Set(c.legalActions().map((a) => a.kind));
      expect(kinds.has('attack')).toBe(false);
      expect(kinds.has('move')).toBe(false);
      // The command clears after the stolen turn.
      c.apply({ kind: 'endTurn' });
      expect(c.state.combatants['gob']!.conditions.some((k) => k.id === 'commanded')).toBe(false);
      return;
    }
    throw new Error('goblin never failed the Command save across 40 seeds');
  });
});

describe('Web', () => {
  it('restrains enemies in the area — speed 0 and easier to hit', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          pc('wizard', 3, { x: 1, y: 1 }, 'wiz'),
          foe('goblin-warrior', { x: 5, y: 5 }, 'g1'),
          foe('goblin-warrior', { x: 6, y: 5 }, 'g2'),
        ],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'web', slotLevel: 2, targets: [{ position: { x: 5, y: 5 } }] });
      const stuck = events.find((e) => e.type === 'conditionApplied' && e.condition === 'restrained');
      if (!stuck || stuck.type !== 'conditionApplied') continue;
      const gid = stuck.combatantId;
      expect(c.state.combatants['wiz']!.concentratingOn?.spellId).toBe('web');
      until(c, gid);
      expect(c.state.combatants[gid]!.turn.movementMax).toBe(0); // can't move
      return;
    }
    throw new Error('no goblin was ever webbed across 40 seeds');
  });
});

describe('Fear', () => {
  it('frightens enemies in the cone so they attack at disadvantage', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('wizard', 5, { x: 3, y: 3 }, 'wiz'), foe('goblin-warrior', { x: 3, y: 4 }, 'gob')],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'fear', slotLevel: 3, targets: [{ position: { x: 3, y: 4 } }] });
      if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'frightened')) continue;
      until(c, 'gob');
      const swing = c.apply({ kind: 'attack', weaponId: 'goblin-scimitar', targetId: 'wiz' });
      const roll = swing.find((e) => e.type === 'attackRolled')!;
      if (roll.type !== 'attackRolled') throw new Error();
      expect(roll.disSources).toContain('attacker frightened');
      return;
    }
    throw new Error('goblin never got frightened across 40 seeds');
  });
});
