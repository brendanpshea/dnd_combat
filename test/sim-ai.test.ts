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
import { buildWave } from '../src/arena/run.js';
import { newCampaign, buildCampaignParty, partyLevelOf } from '../src/campaign/campaign.js';
import { buildMonster } from '../src/data/monsters.js';
import { parseMap } from '../src/data/maps.js';
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
    // `npm run arena` with hundreds of games — sim-normal sits ~52% vs the
    // hand-tuned greedy). The floor is set far below that true rate so
    // ordinary small-sample noise never flakes it; only a real collapse
    // (the 8-15% win rates seen mid-development) trips it. Note 8 seeds cannot
    // measure strength at all — a 16-game read carries ~±12 points — which is
    // exactly why this asserts a floor and not a number.
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

/**
 * The engagement gradient has to survive being outnumbered.
 *
 * V = mine - theirs, and the engagement term was a per-unit sum on both sides:
 * a mover closing one cell gained 0.9 for itself and handed 0.3 back to *every*
 * enemy whose nearest foe it now was. Against a party of four that is 1.2
 * against 0.9, so every step toward the enemy scored worse than standing still
 * and an outnumbered melee unit correctly refused to approach — the gradient
 * pointed backwards, all the way home.
 *
 * AI-vs-AI play hid this completely: the heroes walked into the monsters, so
 * contact happened regardless. It only shows against a *passive* party, which
 * is what a human hanging back at the top of the board looks like.
 */
describe('engagement against a passive party', () => {
  function stalledOptions(monsters: number) {
    const heroes = buildParty('team1', 0, 3);
    const foes = Array.from({ length: monsters }, (_, i) =>
      place('fighter', 'team2', { x: i + 1, y: 11 }, { id: `m${i}` }));
    return new Combat({ seed: 9, width: 8, height: 12, combatants: [...heroes, ...foes] });
  }

  it('closing scores better than standing still even when badly outnumbered', () => {
    const c = stalledOptions(3);
    const mover = c.state.combatants['m0']!;
    const stay = evaluate(c.state, 'team2');
    const closer = {
      ...c.state,
      combatants: { ...c.state.combatants, m0: { ...mover, position: { x: 1, y: 8 } } },
    };
    expect(evaluate(closer, 'team2')).toBeGreaterThan(stay);
  });

  it('the gradient does not invert as the party grows', () => {
    // One monster against four heroes was the case that broke: 4 x 0.3 > 0.9.
    for (const monsters of [1, 2, 4]) {
      const c = stalledOptions(monsters);
      const mover = c.state.combatants['m0']!;
      const stay = evaluate(c.state, 'team2');
      const closer = {
        ...c.state,
        combatants: { ...c.state.combatants, m0: { ...mover, position: { x: 1, y: 6 } } },
      };
      expect(evaluate(closer, 'team2'), `${monsters} monsters vs 4 heroes`).toBeGreaterThan(stay);
    }
  });

  /**
   * The real arena wave that surfaced this, rebuilt exactly as the web app
   * builds it. Seed 1 wave 1 is four melee constructs on the far rank of a
   * twelve-row map: with the summed term they shuffled sideways and dodged for
   * twenty rounds while the party stood at the other end, untouched.
   *
   * A synthetic open-grid setup does NOT reproduce it — the stall needs the
   * mover to be the uniquely-closest foe, which is what a full back rank of
   * equidistant monsters produces. Built from the shipping code path so it
   * stays a real fight rather than a hand-tuned one.
   */
  it('monsters close on a passive party in a real arena wave', () => {
    const seed = 1;
    const campaign = newCampaign(seed);
    const wave = buildWave(seed, partyLevelOf(campaign), 1);
    const grid = parseMap(wave.map);
    const files = [3, 1, 5, 2, 6, 0, 7, 4];
    const foes = wave.encounter.members.map((mid, i) =>
      buildMonster(mid, 'team2', { x: files[i % files.length]!, y: grid.height - 1 }, String(i + 1)));
    const c = new Combat({
      seed: (seed ^ 7919) >>> 0,
      map: wave.map,
      combatants: [...buildCampaignParty(campaign), ...foes],
    });

    let contact = false;
    let round = 0;
    for (let i = 0; i < 2000 && !c.isOver() && !contact && round <= 12; i++) {
      const id = c.activeId;
      const me = c.state.combatants[id]!;
      // The heroes do nothing at all — the human who hangs back and waits.
      const action = me.team === 'team1'
        ? ({ kind: 'endTurn' } as const)
        : chooseActionSim(c.state, id, SIM_PRESETS.easy);
      for (const e of c.apply(action)) {
        if (e.type === 'roundStarted') round = e.round;
        if (e.type === 'attackRolled' && c.state.combatants[e.attackerId]?.team === 'team2') contact = true;
      }
    }
    expect(contact, 'monsters never reached a party that stood still').toBe(true);
  });
});
