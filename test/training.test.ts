import { describe, it, expect } from 'vitest';
import { makeTrainingCombat, TRAINING_COACH } from '../web/src/training.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { GameEvent } from '../src/engine/events.js';

describe('the Training Yard', () => {
  it('sets up two heroes vs two kobolds on open ground', () => {
    const { combat, aiTeams } = makeTrainingCombat();
    const cs = Object.values(combat.state.combatants);
    const heroes = cs.filter((c) => c.team === 'team1');
    const foes = cs.filter((c) => c.team === 'team2');
    expect(heroes).toHaveLength(2);
    expect(foes).toHaveLength(2);
    expect(foes.every((f) => f.id.includes('kobold'))).toBe(true);
    expect(aiTeams.has('team2')).toBe(true);
    expect(aiTeams.has('team1')).toBe(false); // the player drives the heroes
    expect(combat.state.grid.width).toBe(8);
  });

  it('is comfortably winnable — the deterministic seed clears with no hero lost', () => {
    const { combat } = makeTrainingCombat();
    let guard = 0;
    while (!combat.isOver() && guard++ < 300) combat.apply(chooseAction(combat.state, combat.activeId));
    expect(combat.isOver()).toBe(true);
    const alive = (t: string) => Object.values(combat.state.combatants).filter((c) => c.team === t && c.alive).length;
    expect(alive('team2')).toBe(0); // player wins
    expect(alive('team1')).toBe(2); // both heroes standing
  });

  it('the coach completes on a win even if the fight ends fast', () => {
    // Drive both sides with greedy (a "player" who plays optimally and blitzes),
    // mirroring App's advance logic: a combatEnded always finishes the coach.
    const { combat, aiTeams } = makeTrainingCombat();
    const isPlayer = (id: string) => { const t = combat.state.combatants[id]?.team; return !!t && !aiTeams.has(t); };
    let step = 0, guard = 0;
    while (!combat.isOver() && guard++ < 300) {
      const ev: GameEvent[] = combat.apply(chooseAction(combat.state, combat.activeId));
      if (ev.some((e) => e.type === 'combatEnded')) step = TRAINING_COACH.length;
      else if (step < TRAINING_COACH.length && TRAINING_COACH[step]!.done(ev, combat.state, isPlayer)) step++;
    }
    expect(step).toBe(TRAINING_COACH.length); // banner clears; the win screen takes over
  });

  it('the early steps advance on the moves they teach', () => {
    const s = { combatants: { hero: { id: 'hero', team: 'team1' }, foe: { id: 'foe', team: 'team2' } } } as never;
    const isPlayer = (id: string) => id === 'hero';
    const moved: GameEvent[] = [{ type: 'moved', combatantId: 'hero', path: [{ x: 0, y: 0 }, { x: 0, y: 1 }] }];
    const atk: GameEvent[] = [{ type: 'attackRolled', attackerId: 'hero', targetId: 'foe', weaponId: 'w', natural: 12, total: 16, targetAc: 12, mode: 'normal', advSources: [], disSources: [], hit: true, crit: false, opportunity: false }];
    const ended: GameEvent[] = [{ type: 'turnEnded', combatantId: 'hero' }];
    expect(TRAINING_COACH[0]!.done(moved, s, isPlayer)).toBe(true);
    expect(TRAINING_COACH[1]!.done(atk, s, isPlayer)).toBe(true);
    expect(TRAINING_COACH[2]!.done(ended, s, isPlayer)).toBe(true);
  });
});
