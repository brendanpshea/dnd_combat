import { describe, it, expect } from 'vitest';
import { beatFor, narrate } from '../web/src/pacing.js';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import type { GameEvent } from '../src/engine/events.js';

const hit = (attacker: string, target: string): GameEvent => ({
  type: 'attackRolled', attackerId: attacker, targetId: target, weaponId: 'longsword',
  natural: 14, total: 18, targetAc: 15, mode: 'flat', advSources: [], disSources: [],
  hit: true, crit: false, opportunity: false,
});
const dmg = (target: string, amount: number, tags?: string[]): GameEvent => ({
  type: 'damageDealt', targetId: target, sourceId: 'a', amount, damageType: 'slashing',
  rolls: [amount], ...(tags ? { tags } : {}),
});

describe('enemy-turn pacing', () => {
  it('gives impact a longer beat than movement or a turn hand-off', () => {
    // The bug this guards: pacing used to run *before* each action, sized by the
    // action about to happen, so the pause after a hit was whatever the next
    // action wanted — nearly always endTurn, the shortest delay there is. The
    // moment of impact got the least screen time of anything on screen.
    const impact = beatFor([hit('a', 'b'), dmg('b', 6)]);
    const walk = beatFor([{ type: 'moved', combatantId: 'a', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }]);
    const handoff = beatFor([{ type: 'turnEnded', combatantId: 'a' }]);
    expect(impact).toBeGreaterThan(walk);
    expect(impact).toBeGreaterThan(handoff);
    expect(handoff).toBeLessThanOrEqual(150);
  });

  it('holds longest on a death, and a miss still gets its own beat', () => {
    expect(beatFor([{ type: 'died', combatantId: 'b' }])).toBeGreaterThan(beatFor([dmg('b', 6)]));
    const miss: GameEvent = { ...hit('a', 'b'), hit: false } as GameEvent;
    expect(beatFor([miss])).toBeGreaterThan(300);
  });

  it('keeps a whole enemy turn watchable but brief', () => {
    // move + attack + end: long enough to read, short enough that four enemies
    // don't turn a round into a screensaver.
    const turn = beatFor([{ type: 'moved', combatantId: 'a', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }])
      + beatFor([hit('a', 'b'), dmg('b', 6)])
      + beatFor([{ type: 'turnEnded', combatantId: 'a' }]);
    expect(turn).toBeLessThan(1800);
  });
});

describe('narration', () => {
  const c = new Combat({
    seed: 1,
    combatants: [
      { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 } }), id: 'a', name: 'Sir Arthur' },
      { ...buildCharacter({ classId: 'wizard', team: 'team2', position: { x: 1, y: 0 } }), id: 'b', name: 'Grix' },
    ],
  });

  it('names the characters and reports the damage', () => {
    expect(narrate(c.state, [hit('a', 'b'), dmg('b', 6)])).toBe('Sir Arthur hits Grix for 6!');
  });

  it('calls out crits and sneak attacks', () => {
    expect(narrate(c.state, [hit('a', 'b'), dmg('b', 12, ['Critical Hit'])])).toContain('CRITS');
    expect(narrate(c.state, [hit('a', 'b'), dmg('b', 9, ['Sneak Attack'])])).toContain('Sneak Attack!');
  });

  it('reports a miss', () => {
    expect(narrate(c.state, [{ ...hit('a', 'b'), hit: false } as GameEvent])).toBe('Sir Arthur misses Grix.');
  });

  it('leads with a death whatever else happened in the batch', () => {
    expect(narrate(c.state, [hit('a', 'b'), dmg('b', 99), { type: 'died', combatantId: 'b' }]))
      .toBe('☠ Grix is down!');
  });

  it('says nothing for a turn where nothing happened to anyone', () => {
    expect(narrate(c.state, [{ type: 'turnEnded', combatantId: 'a' }])).toBeUndefined();
  });
});
