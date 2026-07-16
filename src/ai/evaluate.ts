/**
 * Generic state evaluation for the simulation AI.
 *
 * V(state, team) reads only generic state fields (HP, conditions, resources,
 * positions, equipped kit) — never specific spell/feature/item ids. New
 * content is valued through what it *does* to the state, so the AI
 * generalizes to content that didn't exist when this file was written.
 */
import type { GameState, Combatant, TeamId, ConditionId } from '../engine/types.js';
import { abilityMod } from '../engine/types.js';
import { WEAPONS, type WeaponData } from '../data/weapons.js';
import { ITEMS } from '../data/items.js';
import { parseDice } from '../engine/dice.js';
import { distanceCells, hasLineOfSight } from '../engine/grid.js';
import { cellAt } from '../engine/types.js';
import { equippedWeapons, stowedWeapons } from '../engine/rules/equipment.js';

function avgDice(expr: string): number {
  const d = parseDice(expr);
  return d.count * (d.sides + 1) / 2 + d.bonus;
}

function weaponDamage(c: Combatant, w: WeaponData): number {
  const ability = w.melee && !w.properties.includes('finesse') ? 'str' : 'dex';
  return avgDice(w.damage) + abilityMod(c.abilities[ability]) + (w.damageBonus ?? 0);
}

/**
 * Best output at melee reach and at range, over the unit's *whole* kit
 * (carried as well as drawn — a fighter with a stowed longsword is still a
 * melee fighter after it throws a javelin). Casters count their magic as
 * ranged: a wizard's staff is a last resort, not a reason to charge.
 */
function damageProfile(c: Combatant): { melee: number; ranged: number } {
  let melee = 2; // unarmed floor
  let ranged = 0;
  for (const wid of [...equippedWeapons(c), ...stowedWeapons(c)]) {
    const w = WEAPONS[wid];
    if (!w) continue;
    const dmg = weaponDamage(c, w);
    if (w.melee) melee = Math.max(melee, dmg);
    if (w.range !== undefined) ranged = Math.max(ranged, dmg);
  }
  if (c.spellIds.length > 0) {
    // Cantrips are unlimited ranged damage; slots add burst on top.
    const slotPower = c.spellSlots.reduce((s, pool, i) => s + pool.current * (i + 1), 0);
    ranged = Math.max(ranged, 5) + Math.min(6, slotPower);
  }
  return { melee, ranged };
}

/** Rough damage-per-round proxy from a unit's kit. Content-agnostic. */
export function damageProxy(c: Combatant): number {
  const { melee, ranged } = damageProfile(c);
  return Math.max(melee, ranged) * c.attacksPerAction;
}

/** How much losing this unit hurts. */
export function unitWorth(c: Combatant): number {
  return c.maxHp + 4 * c.level + 1.5 * damageProxy(c);
}

/** Fraction of a unit's effectiveness a condition removes (or adds). */
const CONDITION_WEIGHT: Partial<Record<ConditionId, number>> = {
  // loses actions entirely (and helpless conditions invite auto-crits)
  paralyzed: -0.55,
  unconscious: -0.55,
  incapacitated: -0.4,
  // impaired
  prone: -0.1,
  blinded: -0.2,
  poisoned: -0.12,
  frightened: -0.1,
  sapped: -0.06,
  guided: -0.08,   // the *bearer* is easier to hit
  // buffs
  blessed: 0.08,
  // Dodging only pays off if something actually attacks you, and it costs the
  // action that could have been an attack. Weighted low so a real attack wins.
  dodging: 0.02,
  hidden: 0.14,
};

/**
 * Does this unit's kit want to be in melee? Decided by which range band it
 * actually hits harder from — NOT by whether it happens to be holding a melee
 * weapon, which is true of every character (a wizard carries a staff) and
 * would march the squishiest party member into melee.
 */
function prefersMelee(c: Combatant): boolean {
  const { melee, ranged } = damageProfile(c);
  return melee >= ranged;
}

/** Can `enemy` plausibly hurt `unit` soon? 1 = this turn, decaying with distance. */
function threatReach(enemy: Combatant, unit: Combatant): number {
  const dist = distanceCells(enemy.position, unit.position);
  const cellsPerTurn = enemy.speed / 5;
  const hasRanged = [...equippedWeapons(enemy), ...stowedWeapons(enemy)]
    .some((w) => WEAPONS[w]?.range !== undefined) || enemy.spellIds.length > 0;
  // Melee threat falls off smoothly beyond charge range; ranged threat is
  // wider but still prefers proximity (adjacency, better odds, fewer walls).
  const reachNow = hasRanged ? 8 : cellsPerTurn + 1;
  return 1 / (1 + Math.max(0, dist - reachNow) * (hasRanged ? 0.15 : 0.6));
}

function teamScore(state: GameState, team: TeamId, isPov: boolean): number {
  let score = 0;
  for (const c of Object.values(state.combatants)) {
    if (c.team !== team || !c.alive) continue;
    const worth = unitWorth(c);

    // Alive matters a lot; remaining HP matters proportionally.
    let unit = worth * (0.35 + 0.65 * (c.hp / c.maxHp));
    // A generic buffer against the next damage instance, regardless of source.
    unit += Math.min(c.tempHp ?? 0, c.maxHp) * 0.8;

    for (const cond of c.conditions) {
      unit += worth * (CONDITION_WEIGHT[cond.id] ?? 0);
    }

    // Resources not yet spent retain option value.
    unit += c.spellSlots.reduce((s, pool, i) => s + pool.current * (i + 1) * 0.7, 0);
    unit += Object.values(c.featureUses).reduce((s, u) => s + u.current * 0.5, 0);
    // Consumables too (valued by their data cost) — so the AI doesn't burn
    // a potion at full HP just because it scores no worse than passing.
    unit += c.inventory.reduce((s, stack) => {
      const item = ITEMS[stack.itemId];
      return item ? s + stack.qty * Math.min(2, item.cost / 100) : s;
    }, 0);

    // Standing in a hazard is bad; more so with low HP.
    const cell = cellAt(state.grid, c.position);
    if (cell?.terrain === 'hazard') unit -= 2 + 4 * (1 - c.hp / c.maxHp);

    // Engagement: a unit contributes nothing from across the board. Melee
    // kits want to be adjacent; ranged kits want a comfortable middle band.
    const melee = prefersMelee(c);
    let nearest = Infinity;
    let seesAnyEnemy = false;
    for (const e of Object.values(state.combatants)) {
      if (!e.alive || e.team === team) continue;
      nearest = Math.min(nearest, distanceCells(e.position, c.position));
      if (!melee && !seesAnyEnemy && hasLineOfSight(state.grid, c.position, e.position)) seesAnyEnemy = true;
    }
    // A shooter that can see nobody can threaten nobody, so give it a reason to
    // find a sightline rather than idle behind a wall. Only for ranged kits:
    // penalising a melee unit for lacking line of sight would pin it to a
    // sniping spot it can't use instead of letting it close.
    if (!melee && Number.isFinite(nearest) && !seesAnyEnemy) unit -= 1.2;
    // Distance is mutual, so a symmetric weight would cancel out of
    // V = mine - theirs and leave movement gradient-free. The POV team
    // cares more about its own engagement: that asymmetry is what makes
    // closing (or kiting) worth something to the mover.
    if (Number.isFinite(nearest)) {
      const preferred = prefersMelee(c) ? 1 : 4;
      unit -= (isPov ? 0.9 : 0.3) * Math.abs(nearest - preferred);
    }

    // Incoming threat: fragile units should not sit where enemies can reach.
    let threat = 0;
    for (const e of Object.values(state.combatants)) {
      if (!e.alive || e.team === team) continue;
      threat += threatReach(e, c) * damageProxy(e);
    }
    // Threat matters more the closer it comes to killing you — and the POV
    // team weighs its own exposure more (see engagement note above).
    unit -= (isPov ? 0.25 : 0.12) * Math.min(threat, c.hp * 1.5) * (1.3 - c.hp / c.maxHp);

    score += unit;
  }
  return score;
}

/** Positive is good for `team`. */
export function evaluate(state: GameState, team: TeamId): number {
  const other: TeamId = team === 'team1' ? 'team2' : 'team1';
  if (state.winner === team) return 1e6;
  if (state.winner === other) return -1e6;
  return teamScore(state, team, true) - teamScore(state, other, false);
}
