/**
 * The swing, driven by a real attack rather than by a hand-written event.
 *
 * `strike.test.ts` checks the geometry and the timings in isolation. This
 * checks the wiring: that a real `step()` through the real engine, with real
 * weapons and real positions, actually produces a lunge for a sword and an
 * arrow for a bow — and, just as importantly, that the damage number is held
 * behind the swing rather than drawn on top of it.
 *
 * `effects.ts` reaches for `localStorage` and `AudioContext` through `sound.js`
 * at import, which is why nothing has ever tested it in Node. Mocking that one
 * module is the whole cost, and it buys coverage of the file where every one of
 * these effects is actually decided.
 */
import { describe, it, expect, vi } from 'vitest';
import type { GameEvent } from '../src/engine/events.js';
import type { GameState } from '../src/engine/types.js';

vi.mock('../web/src/sound.js', () => ({ sfx: () => {}, initAudio: () => {} }));

const { effectsFor } = await import('../web/src/effects.js');
const { MELEE_LEAD_MS, SHOT_LEAD_MS } = await import('../web/src/strike.js');
const { Combat } = await import('../src/engine/combat.js');
const { step } = await import('../src/engine/actions.js');
const { makeCombatant } = await import('./helpers.js');
type AttackRolled = Extract<GameEvent, { type: 'attackRolled' }>;

/**
 * `a` acts first, deterministically.
 *
 * The obvious spelling — hand the turn over with `endTurn` until it is `a`'s —
 * compiles only if you ignore that `endTurn` returns EVENTS, not a state. It
 * also happened to be dead code: with this seed `a` already won initiative, so
 * the loop never ran and the mistake never showed. Stating the order outright
 * is both shorter and honest about what the fixture needs.
 */
const aFirst = (state: GameState): GameState =>
  ({ ...state, initiativeOrder: ['a', 'b'], turnIndex: 0 });

/**
 * Two combatants at chosen squares, the first wielding `weaponId`, and its
 * attack actually executed.
 *
 * `effectsFor` is handed the POST state, as the app hands it — a dead target
 * keeps its position, which is what the lunge aims at.
 */
function fight(weaponId: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const c = new Combat({
    seed: 3,
    combatants: [
      makeCombatant({
        id: 'a', team: 'team1', position: from,
        equipped: { mainHand: weaponId, armor: 'scale-mail' },
      }),
      makeCombatant({ id: 'b', team: 'team2', position: to, hp: 40, maxHp: 40 }),
    ],
  });
  // Initiative decides who opens; `step` only accepts the combatant whose turn
  // it is, so hand the turn over until it is `a`'s.
  const out = step(aFirst(c.state), { kind: 'attack', targetId: 'b', weaponId });
  return effectsFor(out.state, out.events);
}

describe('a sword lunges', () => {
  it('produces a strike for the attacker, not for the target', () => {
    const fx = fight('longsword', { x: 2, y: 2 }, { x: 3, y: 2 });
    expect(fx.strikes.length, 'a melee attack produced no swing at all').toBe(1);
    expect(fx.strikes[0]!.attackerId, 'the wrong token was told to lunge').toBe('a');
  });

  it('lunges toward the target', () => {
    const east = fight('longsword', { x: 2, y: 2 }, { x: 3, y: 2 });
    expect(east.strikes[0]!.dx, 'a swing to the east went west').toBeGreaterThan(0);
    const north = fight('longsword', { x: 2, y: 2 }, { x: 2, y: 3 });
    // Screen space: north is up, and up is negative.
    expect(north.strikes[0]!.dy, 'a swing to the north went down the screen').toBeLessThan(0);
  });

  it('throws no projectile', () => {
    const fx = fight('longsword', { x: 2, y: 2 }, { x: 3, y: 2 });
    expect(fx.projectiles.length, 'a sword fired something').toBe(0);
  });
});

describe('a bow shoots', () => {
  it('flies an arrow from the archer to the target', () => {
    const fx = fight('longbow', { x: 1, y: 1 }, { x: 6, y: 5 });
    expect(fx.projectiles.length, 'a bow shot nothing').toBe(1);
    const p = fx.projectiles[0]!;
    expect(p.kind, 'the arrow is drawn as a spell bolt').toBe('arrow');
    expect(p.from).toEqual({ x: 1, y: 1 });
    expect(p.to).toEqual({ x: 6, y: 5 });
    expect(fx.strikes.length, 'the archer lunged as well as shooting').toBe(0);
  });

  it('still shoots at point-blank range', () => {
    // A longbow cannot be swung, so an adjacent shot is still an arrow leaving
    // a string — not a lunge with a bow stave.
    const fx = fight('longbow', { x: 2, y: 2 }, { x: 3, y: 2 });
    expect(fx.projectiles.length, 'a point-blank bow shot became a melee swing').toBe(1);
    expect(fx.strikes.length).toBe(0);
  });
});

describe('a thrown weapon', () => {
  // The case that a weapon-flag check gets wrong: a handaxe has `melee: true`
  // AND a range, so keying off the flag alone would lunge at empty air.
  it('lunges when swung in melee', () => {
    const fx = fight('handaxe', { x: 2, y: 2 }, { x: 3, y: 2 });
    expect(fx.strikes.length, 'a handaxe in melee threw itself instead of chopping').toBe(1);
    expect(fx.projectiles.length).toBe(0);
  });

  it('flies when thrown across the board', () => {
    const fx = fight('handaxe', { x: 1, y: 1 }, { x: 6, y: 4 });
    expect(fx.projectiles.length, 'a handaxe thrown five squares lunged at nothing').toBe(1);
    expect(fx.strikes.length).toBe(0);
  });
});

describe('what already telegraphs itself is left alone', () => {
  it('does not lunge a wizard casting Fire Bolt', () => {
    // A spell attack rolls an `attackRolled` just like a sword, so the naive
    // wiring gives it a lunge — on top of the caster pulse and bolt that
    // `spellCast` has ALREADY drawn. One action, telegraphed twice, and the
    // wizard lurches at a target they are shooting from thirty feet away.
    const c = new Combat({
      seed: 3,
      combatants: [
        makeCombatant({
          id: 'a', team: 'team1', position: { x: 1, y: 1 },
          classId: 'wizard', spellIds: ['fire-bolt'],
        }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 6, y: 5 }, hp: 40, maxHp: 40 }),
      ],
    });
    const out = step(aFirst(c.state), {
      kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'b' }],
    });
    const fx = effectsFor(out.state, out.events);
    expect(out.events.some((e) => e.type === 'attackRolled'),
      'the fixture never rolled a spell attack — it tests nothing').toBe(true);
    expect(fx.strikes.length, 'a wizard lunged while casting a ranged cantrip').toBe(0);
    // And exactly one bolt: the spell's own, not a second arrow beside it.
    expect(fx.projectiles.length, 'the cantrip drew a second projectile').toBe(1);
    expect(fx.projectiles[0]!.kind, 'the spell bolt was redrawn as an arrow').not.toBe('arrow');
  });

  it('does not lunge the caster when their Spiritual Weapon swings', () => {
    // A conjuration's attack is the CASTER's attack mechanically — `attackerId`
    // is the cleric — so the naive wiring lunges a cleric who is standing still
    // across the board while a floating hammer does the hitting. `summonStrikes`
    // already animates the hammer; this is about not animating the wrong token.
    //
    // Built as an event rather than by casting and waiting a round: `effectsFor`
    // is a pure mapping from events to visuals, and `via` is the only field
    // under test.
    const c = new Combat({
      seed: 3,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 1, y: 1 } }),
        makeCombatant({ id: 'b', team: 'team2', position: { x: 2, y: 1 }, hp: 40, maxHp: 40 }),
      ],
    });
    const swing: AttackRolled = {
      type: 'attackRolled', attackerId: 'a', targetId: 'b', weaponId: 'spiritual-weapon',
      natural: 15, total: 20, targetAc: 14, mode: 'flat', advSources: [], disSources: [],
      hit: true, crit: false, opportunity: false,
    };
    const summoned = effectsFor(c.state, [{ ...swing, via: 'spiritual-weapon' }]);
    expect(summoned.strikes.length, 'the caster lunged for a blow their summon struck').toBe(0);
    expect(summoned.summonStrikes.length, 'the hammer did not swing either').toBe(1);
    // The guard must be `via`, not "this weapon id never lunges": the same
    // event without `via` is a real swing and must still produce one.
    expect(effectsFor(c.state, [swing]).strikes.length,
      'the guard swallowed an ordinary melee attack too').toBe(1);
  });
});

describe('the damage number waits for the blow', () => {
  it('delays every float behind the swing', () => {
    const fx = fight('longsword', { x: 2, y: 2 }, { x: 3, y: 2 });
    expect(fx.floats.length, 'the attack produced no number or miss to place').toBeGreaterThan(0);
    for (const f of fx.floats) {
      expect(f.delayMs, `"${f.text}" drew while the arm was still moving`)
        .toBeGreaterThanOrEqual(MELEE_LEAD_MS);
    }
  });

  it('delays it behind an arrow by the arrow\'s own flight time', () => {
    const fx = fight('longbow', { x: 1, y: 1 }, { x: 6, y: 5 });
    for (const f of fx.floats) {
      expect(f.delayMs, `"${f.text}" landed before the arrow did`).toBeGreaterThanOrEqual(SHOT_LEAD_MS);
    }
  });

  it('starts the swing immediately — the delay is on the result', () => {
    // The other way round is the mistake that looks identical in a still frame
    // and completely wrong in motion.
    const fx = fight('longsword', { x: 2, y: 2 }, { x: 3, y: 2 });
    expect(fx.strikes[0]!.delayMs, 'the swing itself was delayed').toBe(0);
  });
});
