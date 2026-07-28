/**
 * What the company could do to itself before walking through a door.
 *
 * The machinery for this already existed and was invisible. `PartyScreen` — the
 * arena's own Gear panel — has had "Drink now" and out-of-combat casting since
 * the adventure store was folded into it, and the durations were already right:
 * a giant-strength or resistance potion is an hour, so it clears at lunch and
 * covers exactly the fight you drank it for; Mage Armor is eight, so it survives
 * lunch and dies at the night. Nobody had to build any of that.
 *
 * What nobody could do was FIND it. Buffing meant opening Gear, tapping an item
 * and noticing a button, on a screen you visit to change armour — so the whole
 * system was reachable only by accident, and the one spell it exists for is the
 * one a wizard has least reason to prepare.
 *
 * WHY THE GATE AND NOT THE MORNING
 *
 * Because the door tells you what is behind it. The card names the monsters and
 * a landed knowledge check gives their damage types, so "a fire elemental is
 * through there, drink the fire resistance" is a read rather than a guess — and
 * it is a read you can only make after choosing a door. Offering the same list
 * at breakfast would be asking the question an hour before the information
 * arrives.
 *
 * WHY IT LISTS RATHER THAN SUGGESTS
 *
 * A resistance potion is worth an enormous amount against the right wave and
 * nothing at all against the wrong one, and the game already tells you which
 * you are facing. Ranking them here would be doing the read for you, which is
 * the part worth keeping.
 */
import type { Id, DamageType, Combatant } from '../engine/types.js';
import {
  type CampaignState, type PartyCharacter, buildCampaignParty, isCampBuffPotion, storeSpellActions,
  itemName,
} from '../campaign/campaign.js';
import { SPELLS } from '../data/spells.js';

export interface PrepOption {
  kind: 'potion' | 'spell';
  /** Index into `campaign.characters` — who would drink or cast it. */
  who: number;
  name: string;
  /** Item id to drink, or spell id to cast. */
  id: Id;
  icon: string;
  /** One line for the button: what it does and how long it lasts. */
  detail: string;
}

/** Damage types this hero is already resistant to from a drunk potion. */
function activeResistances(c: CampaignState, i: number): DamageType[] {
  return c.characters[i]?.resources?.effects?.resistances ?? [];
}

/**
 * Buff potions in packs, minus the ones already in effect.
 *
 * A second fire-resistance potion on a hero who is already resistant to fire
 * does nothing at all — `drinkCampBuffPotion` would consume it and set a flag
 * that is already set — so offering it is offering to throw a potion away.
 */
export function potionOptions(c: CampaignState): PrepOption[] {
  const out: PrepOption[] = [];
  for (const [i, ch] of c.characters.entries()) {
    for (const stack of ch.inventory) {
      if (stack.qty <= 0 || !isCampBuffPotion(stack.itemId)) continue;
      const already = activeResistances(c, i);
      const resist = stack.itemId.match(/^potion-(\w+)-resistance$/)?.[1] as DamageType | undefined;
      if (resist && already.includes(resist)) continue;
      // Giant strength does not stack with itself either; a second potion would
      // overwrite the same score.
      const strength = stack.itemId.startsWith('potion-giant-strength');
      if (strength && ch.resources?.effects?.giantStrength !== undefined) continue;
      out.push({
        kind: 'potion', who: i, name: ch.name, id: stack.itemId, icon: '🧪',
        detail: `${itemName(stack.itemId)} — lasts this fight.`,
      });
    }
  }
  return out;
}

/**
 * Out-of-combat casts that are worth making now and not in the fight.
 *
 * Only the ones with a duration long enough to survive the walk through the
 * door. Cure Wounds is a heal rather than a buff and belongs on the party
 * screen; Find Familiar is a ritual the owl is already out for.
 *
 * WHY THIS IS A TABLE NOW
 *
 * It used to be one hard-coded `if (action.spellId !== 'mage-armor') continue`,
 * which meant every camp spell added afterwards was castable from the party
 * screen and invisible at the gate — the one moment a buff is worth most,
 * because the wave is on screen and the fight is the next click. Each entry
 * carries its own "would this do anything" test, since the reason to hide a
 * button differs per spell: Mage Armor does nothing over worn armour, False
 * Life does nothing on top of itself, and a concentration buff cannot be
 * stacked at all.
 */
interface CampSpell {
  detail: string;
  /** True when the button would change nothing, so it is not offered. */
  redundant(ctx: { c: CampaignState; ch: PartyCharacter; me: Combatant; idx: number }): boolean;
}

const CAMP_SPELLS: Record<Id, CampSpell> = {
  'mage-armor': {
    detail: 'Mage Armor — 13 + Dex, and it lasts all day.',
    // `mageArmor` in `acOf` already knows armour wins; this mirrors it so the
    // button is never offered to somebody it would do nothing for.
    redundant: ({ ch, me }) => !!ch.resources?.effects?.mageArmor || me.equipped.armor !== undefined,
  },
  'false-life': {
    detail: 'False Life — temporary hit points, before anyone reaches you.',
    redundant: ({ ch }) => ch.resources?.effects?.falseLife !== undefined,
  },
  aid: {
    detail: 'Aid — +5 hit points to everyone else, for the day.',
    redundant: ({ ch }) => ch.resources?.effects?.aid !== undefined,
  },
  haste: {
    detail: 'Haste — an ally moves and strikes twice; you hold the concentration.',
    // One mind, one spell: not offered if this caster already holds a camp
    // buff, nor if there is nobody left unbuffed to put it on.
    redundant: ({ c, idx }) =>
      c.characters.some((x) => x.resources?.effects?.campConcentration?.casterIdx === idx) ||
      !c.characters.some((x, i) => i !== idx && !x.resources?.effects?.campConcentration),
  },
  'protection-from-evil-and-good': {
    detail: 'Protection — fiends and undead strike an ally at disadvantage.',
    redundant: ({ c, idx }) =>
      c.characters.some((x) => x.resources?.effects?.campConcentration?.casterIdx === idx) ||
      !c.characters.some((x, i) => i !== idx && !x.resources?.effects?.campConcentration),
  },
};

export function spellOptions(c: CampaignState): PrepOption[] {
  const party = buildCampaignParty(c);
  const out: PrepOption[] = [];
  for (const [i, ch] of c.characters.entries()) {
    const me = party[i];
    if (!me) continue;
    for (const action of storeSpellActions(me)) {
      const entry = CAMP_SPELLS[action.spellId];
      if (!entry) continue;
      if (entry.redundant({ c, ch, me, idx: i })) continue;
      const level = SPELLS[action.spellId]?.level ?? 1;
      if ((me.spellSlots[level - 1]?.current ?? 0) <= 0) continue;   // no slot to spend
      out.push({
        kind: 'spell', who: i, name: ch.name, id: action.spellId, icon: action.icon,
        detail: entry.detail,
      });
    }
  }
  return out;
}

/**
 * Everything on offer at the gate. Empty is common and must stay quiet: a party
 * with no potions and no unarmoured caster should see nothing at all rather
 * than an empty heading.
 */
export function prepOptions(c: CampaignState): PrepOption[] {
  return [...spellOptions(c), ...potionOptions(c)];
}
