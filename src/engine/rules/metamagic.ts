/**
 * Metamagic: a sorcerer bends a spell it already knows.
 *
 * WHY THIS IS A FIELD ON THE ACTION AND NOT A NEW ACTION KIND
 *
 * Metamagic does not cast anything. It modifies a cast that was already legal —
 * same spell, same slot, same targets, one thing different. Modelling it as its
 * own action would mean duplicating every gate in `castSpell` (silence, wild
 * shape, concentration, counterspell) and then keeping the two copies in step
 * forever. `metamagic?: MetamagicId` on the existing action reuses all of it.
 *
 * WHY `legalActions` DOES NOT ENUMERATE THE VARIANTS
 *
 * `legalActions` is the hot path: every AI turn and every arena run walks it,
 * and the arena runs it tens of thousands of times per measurement. Offering
 * "every prepared spell x every affordable slot x every known Metamagic" would
 * multiply the most expensive list in the game by three or four for the one
 * class that can use it, and by nothing at all for the other eleven.
 *
 * So the fan-out is GATED rather than general. Quickened Spell turns an action
 * into a bonus action, which is only worth anything when the action is already
 * spent — that is the entire point of the option, "a second spell this turn".
 * Enumerating it only in that state costs literally zero on the ordinary turn
 * (where `actionUsed` is false) and produces a bounded extra pass on the one
 * turn where the option means something.
 *
 * `isLegalAction` is deliberately WIDER than the enumeration: a quickened cast
 * with the action still free is legal, it is just not offered. A player who
 * arms Quickened from the UI constructs the action directly and validates it,
 * so the UI never needs an enumeration at all.
 *
 * WHY QUICKENED NEEDS NO NEW SCORING CURRENCY
 *
 * Every other modifier in this codebase had to be priced as a delta, and six
 * times running it was priced as a flat number instead and either never fired
 * or always did (Bless, Haste, Mirror Image, Steady Aim, Hex, the whole
 * defensive tier). Quickened escapes that because the enumeration gate makes
 * the delta literal: the candidate only appears once the action is gone, so its
 * score IS the value of a spell the sorcerer would not otherwise get to cast.
 * `scoreSpell` prices it with no changes and no new constant to tune. The
 * options that arrive next do not have this property — Empowered's worth is the
 * rerolled dice, which nothing currently computes — and that is where the delta
 * problem comes back.
 */
import type { GameState, Id, Combatant } from '../types.js';
import type { SpellData } from '../../data/spells.js';

export type MetamagicId = 'quickened' | 'heightened';

export interface MetamagicData {
  id: MetamagicId;
  name: string;
  /** The feature a sorcerer must hold to use it. */
  featureId: Id;
  /** Sorcery points per use. */
  cost: number;
  blurb: string;
  /** Whether this option can bend this particular spell. */
  applies(spell: SpellData): boolean;
}

/**
 * Which spells Heightened Spell is OFFERED for, and why it is not all of them.
 *
 * The SRD lets it bend any spell that forces a save. Enumerating that would
 * double the spell pass for a sorcerer, and — worse — a heightened cast is
 * STRICTLY better than the plain one, so offering both side by side means the
 * bent version wins every time unless a sorcery point has a price. That price
 * is the thing this codebase has got wrong six times.
 *
 * Both problems go away by offering it only where it is actually the point of
 * the option: a spell whose ENTIRE effect hangs on one creature's save. On a
 * Fireball, disadvantage on one target's Dexterity save moves a few hit points
 * of the half-damage margin. On a Banishment it is the difference between
 * removing the boss from the fight and spending a 4th-level slot on nothing.
 */
const SAVE_OR_SUCK = new Set([
  'hold-person', 'banishment', 'blindness', 'fear', 'confusion', 'suggestion',
  'phantasmal-killer', 'sleep', 'command', 'bane',
]);
/*
 * Two entries were removed from that list after the chip row was opened in a
 * browser and read.
 *
 * `polymorph` looked obvious and is wrong HERE: the SRD version lets an
 * unwilling creature save, but this game's Polymorph targets an ally only and
 * rolls nothing at all. Heightening it would have charged two sorcery points
 * for no effect whatsoever — and the tray offered it, in gold, with the price
 * printed on the button.
 *
 * `slow` was worse: there is no such spell in this game. It sat in the set
 * doing nothing, and would have gone on doing nothing forever.
 *
 * `metamagic.test.ts` now holds every id here to being a real spell that
 * actually calls `savingThrow`, which is the check that would have caught both
 * without anyone opening a browser.
 */

export const METAMAGIC: Record<MetamagicId, MetamagicData> = {
  quickened: {
    id: 'quickened',
    name: 'Quickened Spell',
    featureId: 'metamagic-quickened',
    cost: 2,
    blurb: 'Cast a spell with a casting time of an action as a bonus action instead.',
    // Only an action-cast spell has anything to gain. A spell that is already a
    // bonus action would pay two points for nothing, and one that is a reaction
    // never reaches this path at all.
    applies: (spell) => spell.castingTime === 'action',
  },
  heightened: {
    id: 'heightened',
    name: 'Heightened Spell',
    featureId: 'metamagic-heightened',
    cost: 2,
    blurb: 'One target of the spell has Disadvantage on its saves against it.',
    applies: (spell) => SAVE_OR_SUCK.has(spell.id),
  },
};

/**
 * Which target a bend lands on, decided in ONE place so the engine and the AI
 * can never disagree about it.
 *
 * Heightened protects nobody and picks one victim: the creature the caster most
 * wants the spell to stick to. For a single-target spell that is the target it
 * was aimed at, which is every spell `SAVE_OR_SUCK` currently lists. For an
 * area spell it would have to be chosen from the footprint, and the honest
 * engine-side proxy is the biggest enemy in it — the engine cannot see the AI's
 * notion of threat, and `outputPerRound` lives in the scorer.
 */
export function heightenedTarget(targets: Array<{ combatantId?: Id }>): Id | undefined {
  return targets.find((t) => t.combatantId !== undefined)?.combatantId;
}

/** Where a sorcerer's points live: a long-rest pool, like every other. */
export const SORCERY_POINTS = 'font-of-magic';

export function sorceryPoints(c: Combatant): number {
  return c.featureUses[SORCERY_POINTS]?.current ?? 0;
}

/** The options this creature knows AND can currently pay for — the chip row. */
export function affordableMetamagic(c: Combatant): MetamagicData[] {
  const points = sorceryPoints(c);
  return knownMetamagic(c).filter((m) => m.cost <= points);
}

/** The options this creature actually knows. */
export function knownMetamagic(c: Combatant): MetamagicData[] {
  return Object.values(METAMAGIC).filter((m) => c.featureIds.includes(m.featureId));
}

/**
 * Which options could bend this cast — what the UI's chip row reads, and what
 * the AI would consult if it ever wanted to consider one it was not offered.
 *
 * Deliberately not called by `legalActions`; see the header.
 */
export function metamagicOptions(state: GameState, actorId: Id, spell: SpellData): MetamagicData[] {
  const c = state.combatants[actorId];
  if (!c) return [];
  const points = sorceryPoints(c);
  return knownMetamagic(c).filter((m) => m.cost <= points && m.applies(spell));
}

/** Can `actorId` afford and apply `id` to `spell`? */
export function canMetamagic(state: GameState, actorId: Id, spell: SpellData, id: MetamagicId): boolean {
  return metamagicOptions(state, actorId, spell).some((m) => m.id === id);
}
