/**
 * What the company should do before walking out onto the sand again.
 *
 * The arena hands you armour and scrolls between fights and then trusts you to
 * remember. `buyItem` only fills a pack — it never equips — so a breastplate
 * won as a prize sits in a rucksack for the rest of the run unless somebody
 * opens the party screen and puts it on. The measurement scripts had to grow an
 * `equipUpgrades` step for exactly this reason: every armour purchase in every
 * sweep before that was invisible, because nobody wore any of it.
 *
 * A player has the same problem and less information. So the night's rest is
 * where the game asks: here is what is sitting unused, do you want it.
 *
 * WHY IT IS A LIST AND NOT AN ACTION
 *
 * The obvious move is to equip the best thing automatically. It is the wrong
 * one: "best" is a judgement — plate is more AC and disadvantage on Stealth,
 * and a rogue who wants to creep past the sentries would rather have neither —
 * and a game that silently redresses your party has taken a decision off you
 * and not told you. This reports; the player decides.
 *
 * WHY ONLY AFTER A NIGHT
 *
 * Lunch keeps hit points, slots and charges; the night is the only break where
 * spells are re-prepared and items recharge, so it is the only one where the
 * loadout question has changed. Asking at lunch too would train the answer
 * "dismiss", which costs more than the reminder is worth.
 */
import type { Id } from '../engine/types.js';
import {
  type CampaignState, type RestResult,
  buildCampaignParty, equipBlocked, partyPreparedRoom, preparedRoom,
} from '../campaign/campaign.js';
import { ARMOR, SHIELDS, armorClass, armorSpeedPenalty, armorStealthDisadvantage } from '../data/armor.js';
import { CLASSES } from '../data/classes.js';

export interface MorningTask {
  kind: 'armor' | 'shield' | 'spells';
  /** Index into `campaign.characters`. */
  who: number;
  name: string;
  /** One line, already phrased for a player. */
  detail: string;
}

/**
 * How good a piece of armour is *for this hero*, not in the abstract.
 *
 * AC, minus a point for a strength requirement they do not meet, minus a point
 * for Stealth disadvantage if they are the one who does the sneaking. The same
 * scoring the playtest harness uses, so what the game suggests and what the
 * measurement assumes cannot drift apart.
 */
function scoreArmor(
  c: CampaignState, i: number, id: Id | undefined,
): number {
  const party = buildCampaignParty(c);
  const me = party[i]!;
  const dexMod = Math.floor((me.abilities.dex - 10) / 2);
  const shieldAc = me.equipped.offHand ? 2 : 0;
  if (id === undefined) return armorClass(undefined, dexMod, shieldAc);
  const sneaks = (CLASSES[c.characters[i]!.classId]?.skillProfs ?? []).includes('stealth');
  return armorClass(id, dexMod, shieldAc)
    - (armorSpeedPenalty(id, me.abilities.str) > 0 ? 1 : 0)
    - (sneaks && armorStealthDisadvantage(id) ? 1 : 0);
}

/** Armour and shields sitting in a pack that beat what is being worn. */
export function gearTasks(c: CampaignState): MorningTask[] {
  const out: MorningTask[] = [];
  for (const [i, ch] of c.characters.entries()) {
    // Body armour and shields are separate tables — a shield has no `base` and
    // is not in ARMOR at all, so asking ARMOR about one silently finds nothing.
    const wearable = (slot: 'armor' | 'offHand') => ch.inventory
      .filter((s) => s.qty > 0
        && (slot === 'armor' ? ARMOR[s.itemId] : SHIELDS[s.itemId])
        && equipBlocked(c, i, s.itemId, slot) === undefined)
      .map((s) => s.itemId);

    const armors = wearable('armor').sort((a, b) => scoreArmor(c, i, b) - scoreArmor(c, i, a));
    const bestArmor = armors[0];
    if (bestArmor !== undefined && scoreArmor(c, i, bestArmor) > scoreArmor(c, i, ch.equipped.armor)) {
      const gain = scoreArmor(c, i, bestArmor) - scoreArmor(c, i, ch.equipped.armor);
      out.push({
        kind: 'armor', who: i, name: ch.name,
        detail: `${ARMOR[bestArmor]!.name} is in their pack — ${gain > 0 ? `+${gain}` : gain} armour class over what they are wearing.`,
      });
    }

    // A shield is worth its flat bonus or nothing; there is no judgement in it
    // beyond whether the hands are free, which `equipBlocked` already answers.
    if (!ch.equipped.offHand) {
      const shields = wearable('offHand')
        .sort((a, b) => (SHIELDS[b]?.ac ?? 0) - (SHIELDS[a]?.ac ?? 0));
      const best = shields[0];
      if (best !== undefined) {
        out.push({
          kind: 'shield', who: i, name: ch.name,
          detail: `${SHIELDS[best]!.name} is in their pack and their off hand is empty — +${SHIELDS[best]!.ac} armour class.`,
        });
      }
    }
  }
  return out;
}

/** Casters carrying fewer prepared spells than they are allowed. */
export function spellTasks(c: CampaignState): MorningTask[] {
  return partyPreparedRoom(c).map((i) => {
    const { used, limit } = preparedRoom(c, i);
    return {
      kind: 'spells' as const, who: i, name: c.characters[i]!.name,
      detail: `Preparing ${used} of ${limit} spells — ${limit - used} slot${limit - used === 1 ? '' : 's'} going unused.`,
    };
  });
}

/**
 * Everything worth doing before the next day's first fight.
 *
 * Empty is the good case and the common one, and the interface must treat it
 * that way: a review screen that opens every morning whether or not anything
 * changed is a screen people learn to close without reading, which costs more
 * than the one useful reminder it was built for.
 */
export function morningTasks(c: CampaignState): MorningTask[] {
  return [...gearTasks(c), ...spellTasks(c)];
}

/**
 * Whether to open the morning review, and where to start.
 *
 * A decision, not a render, and it lives here for the reason the last one did:
 * the first cut of this put the logic in the arena component, below its
 * `phase.p === ...` early returns, so the hook it needed ran on some renders
 * and not others. That is React error #300 and it took the whole arena down.
 * Nothing in a test could have seen it, because there was nothing to test.
 *
 * `rested.hitDiceSpent` is the honest signal for which break just happened —
 * only lunch reports it, and by the time this screen paints the run has already
 * advanced, so `half` says 'afternoon' after a won morning and cannot be used.
 */
export function morningReview(
  rested: RestResult, c: CampaignState,
): { open: 'gear' | 'spells'; note: string } | null {
  if (rested.hitDiceSpent !== undefined) return null;   // lunch: nothing has changed
  const tasks = morningTasks(c);
  if (tasks.length === 0) return null;
  return {
    open: tasks.some((t) => t.kind !== 'spells') ? 'gear' : 'spells',
    note: tasks.map((t) => `${t.name}: ${t.detail}`).join(' '),
  };
}
