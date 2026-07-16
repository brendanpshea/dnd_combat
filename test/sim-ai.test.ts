import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter, buildParty } from '../src/builder/character.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';
import { chooseAction as greedy } from '../src/ai/greedy.js';
import { evaluate, unitWorth } from '../src/ai/evaluate.js';
import { runArena } from '../src/ai/arena.js';
import { SPELLS } from '../src/data/spells.js';
import { FEATURES } from '../src/data/features.js';
import { ITEMS } from '../src/data/items.js';
import { makeCombatant } from './helpers.js';
import type { Combatant, Position } from '../src/engine/types.js';

const FAST = { samples: 2, beam: 3, depth: 2, moveCandidates: 4 };

function place(classId: string, team: 'team1' | 'team2', position: Position, over: Partial<Combatant> = {}): Combatant {
  const c = buildCharacter({ classId, team, position });
  return { ...c, ...over, id: over.id ?? c.id };
}

describe('generalization guardrails', () => {
  it('the simulation AI references no specific content ids', () => {
    const contentIds = [
      ...Object.keys(SPELLS), ...Object.keys(FEATURES), ...Object.keys(ITEMS),
    ].filter((id) => id.length > 3);
    for (const file of ['src/ai/simulated.ts', 'src/ai/evaluate.ts']) {
      const src = fs.readFileSync(file, 'utf8');
      for (const id of contentIds) {
        expect(src.includes(`'${id}'`), `${file} mentions content id '${id}'`).toBe(false);
      }
    }
  });

  it('evaluate is finite, roughly mirror-balanced, and prefers winning states', () => {
    const c = new Combat({
      seed: 3,
      combatants: [...buildParty('team1', 0, 2), ...buildParty('team2', 7, 2)],
    });
    const v1 = evaluate(c.state, 'team1');
    const v2 = evaluate(c.state, 'team2');
    expect(Number.isFinite(v1)).toBe(true);
    // Deliberately POV-asymmetric (positional terms), but a mirror match
    // should still evaluate near-neutral from both sides.
    expect(Math.abs(v1 - v2)).toBeLessThan(unitWorth(c.state.combatants[c.state.initiativeOrder[0]!]!));
    // Hurt team2 badly: team1's evaluation must rise.
    const hurt = structuredClone(c.state);
    for (const x of Object.values(hurt.combatants)) {
      if (x.team === 'team2') x.hp = 1;
    }
    expect(evaluate(hurt, 'team1')).toBeGreaterThan(v1);
    expect(unitWorth(c.state.combatants[c.state.initiativeOrder[0]!]!)).toBeGreaterThan(0);
  });

  it('moves have a positional gradient (closing melee beats standing still)', () => {
    const c = new Combat({
      seed: 4,
      combatants: [
        place('fighter', 'team1', { x: 1, y: 1 }, { id: 'ftr' }),
        place('fighter', 'team2', { x: 6, y: 6 }, { id: 'foe' }),
      ],
    });
    const base = evaluate(c.state, 'team1');
    const closer = structuredClone(c.state);
    closer.combatants['ftr']!.position = { x: 3, y: 3 };
    expect(evaluate(closer, 'team1')).toBeGreaterThan(base);
  });
});

describe('simulation AI behavior', () => {
  it('is deterministic for the same state', () => {
    const c = new Combat({
      seed: 11,
      combatants: [...buildParty('team1', 0, 2), ...buildParty('team2', 7, 2)],
    });
    const a = chooseActionSim(c.state, c.activeId, FAST);
    const b = chooseActionSim(c.state, c.activeId, FAST);
    expect(a).toEqual(b);
  });

  it('attacks a lethal adjacent target rather than wandering off', () => {
    const c = new Combat({
      seed: 5,
      combatants: [
        place('fighter', 'team1', { x: 3, y: 3 }, { id: 'ftr' }),
        place('wizard', 'team2', { x: 3, y: 4 }, { id: 'wiz', hp: 3 }),
        place('fighter', 'team2', { x: 7, y: 7 }, { id: 'f2' }),
      ],
    });
    let guard = 0;
    while (c.activeId !== 'ftr' && guard++ < 20) c.apply({ kind: 'endTurn' });

    // Play the whole turn out, rather than asserting on the first action alone.
    // "Attack, then reposition" and "reposition, then attack" both spend one
    // move and one attack, so they score identically and which one wins is
    // decided by sampling noise — a first-action assertion tests a coin flip.
    // What the AI must never do is finish the turn without swinging at a
    // one-hit kill standing next to it, and that is what this checks.
    const kinds: string[] = [];
    let steps = 0;
    while (c.activeId === 'ftr' && steps++ < 8) {
      const action = chooseActionSim(c.state, 'ftr', FAST);
      kinds.push(action.kind === 'attack' && action.targetId === 'wiz' ? 'attack:wiz' : action.kind);
      c.apply(action);
    }
    expect(kinds).toContain('attack:wiz');
  });

  it('full games complete without stalling', () => {
    for (const seed of [2, 7]) {
      const c = new Combat({
        seed,
        mapId: 'ruins',
        combatants: [...buildParty('team1', 0, 2), ...buildParty('team2', 7, 2)],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 3000) {
        c.apply(chooseActionSim(c.state, c.activeId, FAST));
      }
      expect(c.isOver()).toBe(true);
    }
  }, 120000);

  it('arena gate: sim AI is at least competitive with greedy (regression floor)', () => {
    // A gross-regression tripwire, not a superiority proof (that's
    // `npm run arena` with hundreds of games — sim-normal sits ~37% vs the
    // hand-tuned greedy). The floor is set well below that true rate so
    // ordinary small-sample noise never flakes it; only a real collapse
    // (the 8-15% win rates seen mid-development) trips it.
    const seeds = Array.from({ length: 8 }, (_, i) => i * 5 + 1);
    const result = runArena(
      (s, id) => chooseActionSim(s, id, FAST),
      greedy,
      seeds,
    );
    expect(result.stalls).toBe(0);
    expect(result.aWinRate).toBeGreaterThanOrEqual(0.2);
  }, 300000);
});
