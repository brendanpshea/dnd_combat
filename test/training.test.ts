import { describe, it, expect } from 'vitest';
import { makeTrainingCombat, TRAINING_COACH } from '../web/src/training.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { GameEvent } from '../src/engine/events.js';

describe('the Training Yard', () => {
  it('sets up three heroes vs four kobolds on open ground, with a wounded fighter', () => {
    const { combat, aiTeams } = makeTrainingCombat();
    const cs = Object.values(combat.state.combatants);
    const heroes = cs.filter((c) => c.team === 'team1');
    const foes = cs.filter((c) => c.team === 'team2');
    expect(heroes).toHaveLength(3);
    expect(foes).toHaveLength(4);
    expect(foes.every((f) => f.id.includes('kobold'))).toBe(true);
    expect(aiTeams.has('team2')).toBe(true);
    expect(aiTeams.has('team1')).toBe(false); // the player drives the heroes
    expect(combat.state.grid.width).toBe(8);
    // The fighter begins scuffed so the Cleric's heal lesson has a target.
    const rurik = heroes.find((c) => c.name === 'Rurik')!;
    expect(rurik.hp).toBeLessThan(rurik.maxHp);
  });

  it('is comfortably winnable — the deterministic seed clears with no hero lost', () => {
    const { combat } = makeTrainingCombat();
    let guard = 0;
    while (!combat.isOver() && guard++ < 400) combat.apply(chooseAction(combat.state, combat.activeId));
    expect(combat.isOver()).toBe(true);
    const alive = (t: string) => Object.values(combat.state.combatants).filter((c) => c.team === t && c.alive).length;
    expect(alive('team2')).toBe(0); // player wins
    expect(alive('team1')).toBe(3); // all three heroes standing
  });

  it('the coach completes on a win even if the fight ends fast', () => {
    // Drive both sides with greedy (a "player" who plays optimally and blitzes),
    // mirroring App's advance logic: a combatEnded always finishes the coach.
    const { combat, aiTeams } = makeTrainingCombat();
    const isPlayer = (id: string) => { const t = combat.state.combatants[id]?.team; return !!t && !aiTeams.has(t); };
    let step = 0, guard = 0;
    while (!combat.isOver() && guard++ < 400) {
      const ev: GameEvent[] = combat.apply(chooseAction(combat.state, combat.activeId));
      if (ev.some((e) => e.type === 'combatEnded')) step = TRAINING_COACH.length;
      else if (step < TRAINING_COACH.length && TRAINING_COACH[step]!.done(ev, combat.state, isPlayer)) step++;
    }
    expect(step).toBe(TRAINING_COACH.length); // banner clears; the win screen takes over
  });

  it('gates each lesson on the mechanic it teaches', () => {
    const s = { combatants: { hero: { id: 'hero', team: 'team1' }, foe: { id: 'foe', team: 'team2' } } } as never;
    const isPlayer = (id: string) => id === 'hero';
    const moved: GameEvent[] = [{ type: 'moved', combatantId: 'hero', path: [{ x: 0, y: 0 }, { x: 0, y: 1 }] }];
    const melee: GameEvent[] = [{ type: 'attackRolled', attackerId: 'hero', targetId: 'foe', weaponId: 'longsword', natural: 12, total: 16, targetAc: 12, mode: 'normal', advSources: [], disSources: [], hit: true, crit: false, opportunity: false }];
    const ended: GameEvent[] = [{ type: 'turnEnded', combatantId: 'hero' }];
    const cantrip: GameEvent[] = [{ type: 'spellCast', casterId: 'hero', spellId: 'fire-bolt', origin: { x: 0, y: 0 }, cells: [] }];
    const leveled: GameEvent[] = [{ type: 'spellCast', casterId: 'hero', spellId: 'magic-missile', origin: { x: 0, y: 0 }, cells: [] }];
    const heal: GameEvent[] = [{ type: 'healed', targetId: 'foe', sourceId: 'hero', amount: 6 }];

    // 0 move, 1 melee, 2 end turn, 3 cantrip, 4 leveled spell, 5 heal.
    expect(TRAINING_COACH[0]!.done(moved, s, isPlayer)).toBe(true);
    expect(TRAINING_COACH[1]!.done(melee, s, isPlayer)).toBe(true);
    expect(TRAINING_COACH[2]!.done(ended, s, isPlayer)).toBe(true);
    expect(TRAINING_COACH[3]!.done(cantrip, s, isPlayer)).toBe(true);
    expect(TRAINING_COACH[4]!.done(leveled, s, isPlayer)).toBe(true);
    expect(TRAINING_COACH[5]!.done(heal, s, isPlayer)).toBe(true);

    // A ranged cantrip is not a melee swing; a heal is not a "spend a slot" spell.
    expect(TRAINING_COACH[1]!.done(cantrip, s, isPlayer)).toBe(false);
    const cureWounds: GameEvent[] = [{ type: 'spellCast', casterId: 'hero', spellId: 'cure-wounds', origin: { x: 0, y: 0 }, cells: [] }];
    expect(TRAINING_COACH[4]!.done(cureWounds, s, isPlayer)).toBe(false);
    // The enemy doing something never advances the player's coach.
    const foeMoved: GameEvent[] = [{ type: 'moved', combatantId: 'foe', path: [{ x: 0, y: 0 }, { x: 0, y: 1 }] }];
    expect(TRAINING_COACH[0]!.done(foeMoved, s, isPlayer)).toBe(false);
  });
});
