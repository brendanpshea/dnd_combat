/**
 * Equipment helpers: which weapons a combatant can attack with right now,
 * and the free-interaction weapon swap.
 */
import type { GameState, Combatant, Id } from '../types.js';
import { WEAPONS } from '../../data/weapons.js';
import type { GameEvent } from '../events.js';

/** Weapon ids currently in hand. */
export function equippedWeapons(c: Combatant): Id[] {
  const out: Id[] = [];
  if (c.equipped.mainHand && WEAPONS[c.equipped.mainHand]) out.push(c.equipped.mainHand);
  if (c.equipped.offHand && c.equipped.offHand !== 'shield' && WEAPONS[c.equipped.offHand]) {
    out.push(c.equipped.offHand);
  }
  return out;
}

/** Weapon ids in the pack that could be drawn with the free interaction. */
export function stowedWeapons(c: Combatant): Id[] {
  return c.inventory.filter((s) => s.qty > 0 && WEAPONS[s.itemId]).map((s) => s.itemId);
}

/**
 * Weapons the combatant may attack with this turn: anything in hand, plus
 * stowed weapons if the free interaction is still available (attacking with
 * one auto-swaps it into the main hand).
 */
export function attackableWeapons(c: Combatant): Id[] {
  const ids = new Set(equippedWeapons(c));
  if (!c.turn.interacted) {
    for (const w of stowedWeapons(c)) ids.add(w);
  }
  // A monk's fists are always available and never need drawing. Everyone else
  // is left alone: an unarmed option on every character's bar would be nine
  // classes of noise for the one that wants it.
  //
  // Every CHARACTER can punch, though (SRD 5.2.1, Unarmed Strike): a hero with
  // a bow in hand still has a fist for the goblin beside it. Monsters keep
  // to their stat blocks — "a monster is proficient with any weapon in its
  // stat block", and a fist is in very few.
  if (c.featureIds.includes('martial-arts') || c.weaponProfs !== undefined) ids.add('unarmed-strike');
  // Nor are the attacks a stat block's Multiattack names: a wyvern does not
  // draw its sting after biting. Without this the free interaction went on the
  // first swap and a bite-then-sting routine could never be finished.
  for (const r of c.routines ?? []) for (const w of r) ids.add(w);
  return [...ids];
}

/** A weapon the stat block's Multiattack names — always to hand, never drawn. */
export function routineWeapon(c: Combatant, weaponId: Id): boolean {
  return (c.routines ?? []).some((r) => r.includes(weaponId));
}

/** Draw `weaponId` into the main hand, stowing what was there. Costs the interaction. */
export function autoSwap(state: GameState, actorId: Id, weaponId: Id): GameEvent[] {
  const c = state.combatants[actorId]!;
  if (equippedWeapons(c).includes(weaponId)) return [];
  const stack = c.inventory.find((s) => s.itemId === weaponId && s.qty > 0);
  if (!stack) throw new Error(`${actorId} does not carry ${weaponId}`);
  stack.qty -= 1;
  if (stack.qty === 0) c.inventory = c.inventory.filter((s) => s !== stack);
  const old = c.equipped.mainHand;
  if (old !== undefined) {
    const existing = c.inventory.find((s) => s.itemId === old);
    if (existing) existing.qty += 1;
    else c.inventory.push({ itemId: old, qty: 1 });
  }
  c.equipped.mainHand = weaponId;
  c.turn.interacted = true;
  return [{ type: 'equipped', combatantId: actorId, weaponId }];
}
