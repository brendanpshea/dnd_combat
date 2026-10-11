/**
 * The XP trace adds an edge to the walk, and may only ever add a self-loop.
 *
 * `traceXp` runs the reachability search with every edge tagged, then stores
 * its `ReachReport` under the key `checkModuleReach` reads —
 * `scripts/check-story.ts` leans on that, running the XP pass FIRST so the
 * check behind it costs nothing. But the two walks are not edge-identical:
 * `searchModule`'s `challenge` case pushes an extra step when the trace is on
 * (a spent approach's paying failure — "A spent approach's own failure plays
 * where the party stands"), which exists only to carry XP.
 *
 * WHY A SELF-LOOP IS THE WHOLE ARGUMENT, AND WHY THERE IS NO PARITY TEST HERE.
 *
 * A state is `(scene, hub, flags)` (`add`, reach.ts). That step names its own
 * scene, keeps the hub, and carries no effects, so its target packs to the key
 * the source already has: it can never create a state. And a self-loop cannot
 * change which states are reachable (its target is its source) nor which can
 * still reach a victory (it offers no new way onward). Since a report is
 * `states`, `errors` and `skipped`, and `skipped` only fires on a state count,
 * the sharing is sound — provided the step stays a self-loop with no effects.
 *
 * Two earlier versions of this file compared the traced report against the
 * untraced one instead. Both passed with a divergence planted in reach.ts,
 * because that comparison is not falsifiable: the report has no field a benign
 * extra edge could move, and a fixture big enough to have one would still not
 * prove the general case. So this checks the property the argument rests on —
 * that the edge is a self-loop — which is exactly what a future edit to that
 * line would break.
 */
import { describe, it, expect } from 'vitest';
import { MODULES } from '../src/data/modules/index.js';
import { checkModuleReach, traceXp } from '../src/adventure/reach.js';
import { maxXpReport } from '../src/adventure/xp-reach.js';
import type { Module, Scene } from '../src/adventure/types.js';

/**
 * A spent approach whose failure pays: the one shape that adds an edge.
 *
 * Not one of the shipped chapters, because not one `perApproach` approach
 * failure in the trilogy pays XP — the extra step is never built there, so a
 * test against them would be watching a line that never runs.
 */
function fixture(failureXp: number): Module {
  const scenes: Record<string, Scene> = {
    gate: {
      id: 'gate', kind: 'challenge', retry: 'perApproach',
      intro: ['A gate.'],
      success: { to: 'fight' },
      failure: { to: 'fight' },
      approaches: [
        { id: 'heave', label: 'Heave', skill: 'athletics', dc: 12,
          success: { to: 'fight' },
          /*
           * The payment is what makes the trace build its self-loop, and the
           * `to` points AWAY from the gate on purpose.
           *
           * A `perApproach` challenge ignores its approaches' own `failure.to`
           * — a spent approach plays where the party stands — so the trace's
           * step must name the scene itself. A fixture whose `to` was already
           * `gate` would make a step built from `failure.to` look like a
           * self-loop too, and the check below could not tell the two apart.
           * Verified by planting exactly that change in reach.ts.
           */
          failure: { to: 'detour', effects: [{ kind: 'xp', amount: failureXp }] } },
        { id: 'pick', label: 'Pick the lock', skill: 'sleight-of-hand', dc: 12, success: { to: 'fight' } },
      ],
    },
    detour: {
      id: 'detour', kind: 'story', text: ['The long way round.'],
      next: [{ id: 'back', label: 'Back to the gate', to: 'gate' }],
    },
    fight: {
      id: 'fight', kind: 'battle', encounterId: 'marsh-dead', mapId: 'bog',
      onWin: { to: 'won' },
    },
    won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Through.'] },
  };
  return { id: 'tiny-perapproach', title: 'T', blurb: '', start: 'gate', scenes };
}

/** Every edge the trace tagged as paying, as `[from, to, label]`. */
function payingEdges(m: Module): Array<[number, number, string]> {
  const out: Array<[number, number, string]> = [];
  traceXp(m, {
    battleXp: () => 0,
    levelXp: () => 0,
    onGraph: (g) => {
      for (const [e, label] of g.edgeLabel) out.push([g.edgeFrom[e]!, g.edgeTo[e]!, label]);
    },
    // A copy, not MODULES, so this probe does not write the shared cache.
  }, [m]);
  return out;
}

describe('the XP trace only ever adds a self-loop', () => {
  it('keeps a spent approach\'s paying failure where the party stands', () => {
    const fails = payingEdges(fixture(150)).filter(([, , label]) => label.includes('(fails)'));
    expect(fails.length, 'the spent approach\'s failure pays nothing: the extra edge is not being built')
      .toBeGreaterThan(0);
    for (const [from, to, label] of fails) {
      expect(to, `${label} leaves the scene it is played in, so it can add a state and strand the shared report`)
        .toBe(from);
    }
  });

  it('is actually reaching the XP bound through that edge', () => {
    // Without this, the case above could be watching an edge that is built but
    // priced at nothing, and the construct would be untested either way.
    const door = (xp: number) => maxXpReport(fixture(xp), [fixture(xp)]).battles
      .find((b) => b.scene === 'fight')!.max;
    expect(door(150), 'the spent approach\'s payment never reaches the XP bound')
      .toBeGreaterThan(door(0));
  });

  it('holds on any shipped chapter that grows the construct', () => {
    // Zero today, so this costs nothing. It is not an assertion that no
    // chapter may ever pay on a spent approach — it is the check arriving on
    // its own the day one does, where it would really be load-bearing.
    const grown = MODULES.filter((m) => Object.values(m.scenes).some((s) =>
      s.kind === 'challenge' && s.retry === 'perApproach'
      && s.approaches.some((a) => (a.failure?.effects ?? []).some((e) => e.kind === 'xp' || e.kind === 'xpToLevel'))));
    for (const m of grown) {
      for (const [from, to, label] of payingEdges(m)) {
        if (label.includes('(fails)')) expect(to, `${m.id}: ${label}`).toBe(from);
      }
      // And the report the check reads back is still the untraced one's.
      const plain = checkModuleReach(m, [...MODULES]);
      maxXpReport(m, MODULES);
      const traced = checkModuleReach(m, MODULES);
      expect(traced.states, `${m.id}: the trace changed the walk`).toBe(plain.states);
      expect([...traced.errors].sort(), `${m.id}: the trace changed the errors`).toEqual([...plain.errors].sort());
    }
  }, 180000);
});
