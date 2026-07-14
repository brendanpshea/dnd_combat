/**
 * Dice expressions ('2d8+3', '1d10', 'd4-1') and d20 rolls with
 * advantage/disadvantage.
 */
import { RngState, rollDie } from './rng.js';

export interface DiceExpr {
  count: number;
  sides: number;
  bonus: number;
}

const DICE_RE = /^(\d*)d(\d+)([+-]\d+)?$/i;

export function parseDice(expr: string): DiceExpr {
  const m = DICE_RE.exec(expr.trim());
  if (!m) throw new Error(`Invalid dice expression: '${expr}'`);
  return {
    count: m[1] ? parseInt(m[1], 10) : 1,
    sides: parseInt(m[2]!, 10),
    bonus: m[3] ? parseInt(m[3], 10) : 0,
  };
}

export interface DiceRoll {
  rolls: number[];
  total: number;
  state: RngState;
}

/** Roll a dice expression. `doubleDice` doubles the dice (crit), not the bonus. */
export function rollDice(state: RngState, expr: string | DiceExpr, doubleDice = false): DiceRoll {
  const d = typeof expr === 'string' ? parseDice(expr) : expr;
  const count = doubleDice ? d.count * 2 : d.count;
  const rolls: number[] = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const r = rollDie(s, d.sides);
    rolls.push(r.value);
    s = r.state;
  }
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + d.bonus, state: s };
}

/**
 * Advantage/disadvantage as sets of sources. Any advantage + any disadvantage
 * cancels to a flat roll regardless of counts (the 5e rule).
 */
export type RollMode = 'flat' | 'advantage' | 'disadvantage';

export function resolveRollMode(advSources: string[], disSources: string[]): RollMode {
  const adv = advSources.length > 0;
  const dis = disSources.length > 0;
  if (adv === dis) return 'flat';
  return adv ? 'advantage' : 'disadvantage';
}

export interface D20Roll {
  /** The die result actually used (before modifiers). */
  natural: number;
  /** Both dice when adv/dis, one die when flat. */
  dice: number[];
  mode: RollMode;
  state: RngState;
}

export function rollD20(state: RngState, mode: RollMode = 'flat'): D20Roll {
  const first = rollDie(state, 20);
  if (mode === 'flat') {
    return { natural: first.value, dice: [first.value], mode, state: first.state };
  }
  const second = rollDie(first.state, 20);
  const pick = mode === 'advantage' ? Math.max : Math.min;
  return {
    natural: pick(first.value, second.value),
    dice: [first.value, second.value],
    mode,
    state: second.state,
  };
}
