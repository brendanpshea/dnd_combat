/**
 * Seeded PRNG (mulberry32). Every random decision in the engine flows through
 * an Rng instance so a (seed, actions[]) pair replays a battle exactly.
 *
 * The state is a plain number carried in GameState; `next` returns the new
 * state alongside the value so the engine core can stay pure.
 */

export type RngState = number;

export function seedRng(seed: number): RngState {
  // Mix the seed so small seeds (0, 1, 2...) diverge immediately.
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Returns a float in [0, 1) and the advanced state. */
export function next(state: RngState): { value: number; state: RngState } {
  let t = (state + 0x6d2b79f5) >>> 0;
  const newState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: newState };
}

/** Integer in [1, sides], advancing the state. */
export function rollDie(state: RngState, sides: number): { value: number; state: RngState } {
  const r = next(state);
  return { value: 1 + Math.floor(r.value * sides), state: r.state };
}

/** Fair coin flip: true/false. */
export function coinFlip(state: RngState): { value: boolean; state: RngState } {
  const r = next(state);
  return { value: r.value < 0.5, state: r.state };
}
