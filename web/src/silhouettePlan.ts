/**
 * Which silhouette stands in for a creature that has no art yet.
 *
 * The shapes are generated (`art/generate_svg_tokens.py` -> `silhouettes.ts`).
 * Choosing between them is app logic, and it lives here.
 *
 * THE ORDER MATTERS, AND IT IS THE INTERESTING PART
 *
 *   1. an explicit body plan, if this creature has one
 *   2. its class, for the party's own characters
 *   3. its creature type
 *   4. humanoid
 *
 * Creature type is the cheap answer and it is right most of the time: it comes
 * from the monster data, it can never go stale, and a new monster is covered
 * the day it is added. But it is too coarse in exactly the families that vary
 * most. All fourteen monstrosities shared one outline, which made a giant
 * spider, a constrictor snake and a griffon the same object on the board — and
 * those three are precisely the ones a player needs to tell apart at a glance,
 * because they threaten completely different squares.
 *
 * So PLAN is a small hand-kept override list, and being hand-kept it is exactly
 * the kind of thing this codebase distrusts: it can drift from the monster
 * table without anything failing. Two tests hold it down — every id in it must
 * exist, and every key it names must be a real shape — so a rename breaks the
 * suite rather than silently reverting a spider to a blob.
 */
import { MONSTERS } from '../../src/data/monsters.js';
import { CLASSES } from '../../src/data/classes.js';
import { SILHOUETTE_PATH } from './silhouettes.js';

/**
 * Monsters whose shape says more than their type does.
 *
 * Values are full silhouette keys, so an override can send a creature to a body
 * plan OR to another type's shape. That second case is not hypothetical: in
 * 5.5e a kobold is creature type *dragon*, which is true and useless — drawn
 * from its type it came out a winged quadruped, when a kobold is a small person
 * with a spear and a player needs to read it as one.
 *
 * Kept deliberately short. The bar is "the type gets this creature actively
 * wrong", not "a more specific shape would be nicer" — every entry here is a
 * thing that can drift, and a hundred of them would drift constantly.
 */
export const PLAN: Record<string, string> = {
  // Fliers. Type says monstrosity, fiend or beast; what matters on a board is
  // that it can cross the ground you were relying on.
  griffon: 'plan-winged', wyvern: 'plan-winged', harpy: 'plan-winged',
  cockatrice: 'plan-winged', chimera: 'plan-winged', vrock: 'plan-winged',
  imp: 'plan-winged', quasit: 'plan-winged', 'flying-sword': 'plan-winged',
  // No limbs at all, and a reach that goes with that.
  'giant-constrictor-snake': 'plan-serpent', remorhaz: 'plan-serpent',
  roper: 'plan-serpent', hydra: 'plan-serpent', salamander: 'plan-serpent',
  bulette: 'plan-serpent',
  // Legs on every side.
  'giant-spider': 'plan-manylegs', ettercap: 'plan-manylegs',
  'giant-scorpion': 'plan-manylegs', 'rust-monster': 'plan-manylegs',
  'giant-badger': 'plan-manylegs',
  // Off the ground and hard to pin down — the incorporeal undead, which the
  // undead cowl reads as solid.
  ghost: 'plan-drifting', specter: 'plan-drifting', shadow: 'plan-drifting',
  wraith: 'plan-drifting', banshee: 'plan-drifting',
  'will-o-wisp': 'plan-drifting', 'invisible-stalker': 'plan-drifting',
  // Dragon by ancestry, person by shape. Drawn from their type these are
  // winged quadrupeds, which is the wrong thing to see coming at you.
  kobold: 'type-humanoid', 'kobold-emberling': 'type-humanoid',
  lizardfolk: 'type-humanoid',
};

/** The silhouette key for a creature id: a `plan-`, `class-` or `type-` shape. */
export function silhouetteKey(id: string): string {
  const plan = PLAN[id];
  if (plan) return plan;
  if (CLASSES[id]) return `class-${id}`;
  const type = MONSTERS[id]?.creatureType;
  if (type && SILHOUETTE_PATH[`type-${type}`]) return `type-${type}`;
  // Species-and-class portrait ids ('elf-wizard'), NPCs, anything unlisted: an
  // upright two-legged shape is the right guess and never looks like an error.
  return 'type-humanoid';
}

/** The path data a creature's token falls back to. Never undefined. */
export function silhouettePath(id: string): string {
  return SILHOUETTE_PATH[silhouetteKey(id)] ?? SILHOUETTE_PATH['type-humanoid']!;
}
