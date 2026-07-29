/**
 * Alert: the origin feat that decides who acts first.
 *
 * TWO HALVES, AND ONLY ONE OF THEM MATTERS
 *
 * "Initiative Proficiency: you can add your Proficiency Bonus to the roll.
 *  Initiative Swap: immediately after you roll Initiative, you can swap your
 *  Initiative with one willing ally in the same combat."
 *
 * The bonus is nearly worthless here and that is measured, not assumed: a ceiling
 * probe giving the WHOLE PARTY +20 initiative — every hero before every foe in
 * every fight — was worth 141/200 wins against 131/200. A feat cannot approach
 * that guarantee, so a few points on one character's die is noise.
 *
 * The SWAP is the feat. It does not improve a roll; it moves a turn to the
 * character who can do the most with it. A wizard at the top of round one gets
 * its Fireball off before the enemy line spreads out; the same wizard acting last
 * throws it into a scrum with allies in it. That is a different kind of effect
 * from +2, and it is why Alert is worth offering after all.
 *
 * IT APPLIES ITSELF
 *
 * No prompt for the player and no scoring for the AI, on purpose. A swap is
 * decidable from the initiative order alone — no board state, no target
 * selection, no resource to weigh — so a fixed policy is honest here in a way it
 * would not be for, say, a spell. The policy is below, and the whole of it is
 * "give it to the artillery, but only if that actually raises them".
 */
import type { GameState, Id, Combatant } from '../types.js';
import type { GameEvent } from '../events.js';

/**
 * Classes whose turn is worth the most at the top of the round.
 *
 * The three full casters with area and control magic. Deliberately NOT every
 * caster: a cleric's best round-one play is usually a reaction to what happened,
 * and a druid or bard sits between the two. Naming three classes is cruder than
 * scoring "who benefits most" and is the right trade — the alternative is an AI
 * tuning problem attached to a feat, and the ranking would be re-derived every
 * time a spell list changed.
 */
export const SWAP_PRIORITY: readonly Id[] = ['wizard', 'sorcerer', 'warlock'];

const isArtillery = (c: Combatant): boolean =>
  c.classId !== undefined && SWAP_PRIORITY.includes(c.classId);

/**
 * Apply every Alert holder's swap, mutating `initiative` on the combatants and
 * returning the events describing what moved.
 *
 * Called by `rollInitiative` after every die is in, because the rule is
 * "immediately after you roll" and a swap needs to see the whole order.
 *
 * Deterministic: holders are processed in sorted id order and each takes the
 * lowest-rolling eligible ally, so the same fight resolves the same way twice.
 * Without that, two Alert characters and two casters would resolve by object
 * iteration order — a replay-breaking coin flip.
 */
export function applyAlertSwaps(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const holders = Object.values(state.combatants)
    .filter((c) => c.alive && c.featureIds.includes('alert'))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const holder of holders) {
    // "One willing ally": same team, not itself, and someone who gains from it.
    const candidates = Object.values(state.combatants)
      .filter((c) => c.team === holder.team && c.id !== holder.id && c.alive && isArtillery(c))
      // Only worth doing if the ally is currently going LATER than the holder.
      // Swapping with a caster who already acts first would hand the holder the
      // good slot and slow the party down — the feat helping nobody.
      .filter((c) => c.initiative < holder.initiative)
      .sort((a, b) => a.initiative - b.initiative || a.id.localeCompare(b.id));

    const ally = candidates[0];
    if (!ally) continue;
    const before = { holder: holder.initiative, ally: ally.initiative };
    holder.initiative = before.ally;
    ally.initiative = before.holder;
    events.push({
      type: 'initiativeSwapped',
      combatantId: holder.id, allyId: ally.id,
      from: before.holder, to: before.ally,
    });
  }
  return events;
}
