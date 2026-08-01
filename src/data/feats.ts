/**
 * Origin feats: the thing every 2024 character gets at first level and this
 * game did not have.
 *
 * WHERE THEY LIVE, AND WHY
 *
 * On the BACKGROUND, which is where the 2024 rules put them and which — as
 * `backgrounds.ts` says in its own adaptation note — was the missing half of
 * what a background is. A background here granted two skills and nothing else,
 * so the pick changed what the party could do outside a fight and never what it
 * could do inside one. Each background now names an origin feat, and the player
 * can take a different one.
 *
 * Humans get a second. That is the 2024 Human's Versatile trait, and it is the
 * one species-level exception.
 *
 * NAMES
 *
 * Two of these are renamed. "Tough" and "Lucky" are Player's Handbook feats
 * rather than SRD ones, so they ship here as HARDY and FATED with the same
 * mechanics — the same substitution `backgrounds.ts` already made when Folk Hero
 * became Farmer and Investigator became Scribe.
 *
 * ALERT, AND WHY IT IS HERE ANYWAY
 *
 * Alert was cut once for being useless and is back, because it was only
 * half-built. The measurement stands: a ceiling probe giving the WHOLE PARTY +20
 * initiative — every hero acting before every foe in every fight — was worth
 * 141/200 wins against a baseline of 131/200. Five percentage points for a
 * guarantee no feat can approach, so +proficiency alone says almost nothing.
 *
 * But +proficiency is only Alert's first half. The second is INITIATIVE SWAP:
 * "immediately after you roll Initiative, you can swap your Initiative with one
 * willing ally." That is not a small bonus to a die, it is handing the party's
 * artillery the top of the round, and it is the actual reason the feat exists.
 * It applies itself (see rules/initiative.ts) — no prompt, no AI tuning.
 *
 * See test/feats.test.ts for the per-feat measurements.
 */
import type { Id } from '../engine/types.js';
import type { SkillId } from './classes.js';

export interface OriginFeat {
  id: Id;
  name: string;
  /** One line shown under the option in the forge. */
  blurb: string;
  grants: {
    /** Passive features, read by the engine (Savage Attacker). */
    featureIds?: Id[];
    /** Cantrips known outright — no slot, no limit. */
    spellIds?: Id[];
    /**
     * Cast this many times per long rest without a slot. The same mechanism
     * species innate casting uses, so Magic Initiate's one Healing Word needed
     * no new machinery at all.
     */
    innateSpells?: Array<{ spellId: Id; uses: number }>;
    /**
     * Which ability powers the granted spells, when the character has none of
     * its own. A fighter with Magic Initiate would otherwise fall through to
     * `spellMod`'s Intelligence default and cast off a 12.
     *
     * This is the spell MATH only, and deliberately not permission to hold a
     * wand. It used to be both: `actions.ts` gated wands on
     * `spellcastingAbility !== undefined`, so this feat handed a fighter a Wand
     * of Fireballs. See `Combatant.classCaster` for the split.
     *
     * Scrolls were never affected either way — they are gated by
     * `classScrollPool(classId)`, which is built from the class table and is
     * empty for every non-caster, so a fighter could not read one before this
     * feat and cannot now.
     */
    spellcastingAbility?: 'wis' | 'int' | 'cha';
    /** Extra hit points per level, exactly like a species' `hpPerLevel`. */
    hpPerLevel?: number;
    /**
     * How many skill proficiencies to grant, chosen automatically from the ones
     * the character does not already have (see `skilledSkills`). Auto-chosen
     * because the alternative is a second three-slot picker in the forge for a
     * decision most players would rather have made well than made themselves.
     */
    skillCount?: number;
  };
}

export const ORIGIN_FEATS: Record<Id, OriginFeat> = {
  'magic-initiate-cleric': {
    id: 'magic-initiate-cleric', name: 'Magic Initiate (Cleric)',
    blurb: 'Sacred Flame and Guidance at will, and one Healing Word a day.',
    grants: {
      spellIds: ['sacred-flame', 'guidance'],
      innateSpells: [{ spellId: 'healing-word', uses: 1 }],
      spellcastingAbility: 'wis',
    },
  },
  'savage-attacker': {
    id: 'savage-attacker', name: 'Savage Attacker',
    blurb: 'Once a turn, reroll your weapon damage and keep the better roll.',
    grants: { featureIds: ['savage-attacker'] },
  },
  skilled: {
    id: 'skilled', name: 'Skilled',
    blurb: 'Three more skill proficiencies, picked to fill the gaps you have.',
    grants: { skillCount: 3 },
  },
  hardy: {
    id: 'hardy', name: 'Hardy',
    blurb: 'Two extra hit points per level. Simple, and it never stops mattering.',
    grants: { hpPerLevel: 2 },
  },
  alert: {
    id: 'alert', name: 'Alert',
    blurb: 'Add your proficiency to Initiative — and start the fight in an ally\'s place if it helps them more.',
    grants: { featureIds: ['alert'] },
  },
  fated: {
    id: 'fated', name: 'Fated',
    blurb: 'Three times a day, a bad roll gets a second chance. It happens on its own.',
    grants: { featureIds: ['fated'] },
  },
};

/**
 * The skills Skilled hands out: the first N of a fixed order the character is not
 * already proficient in.
 *
 * ORDERED BY WHAT THIS GAME ACTUALLY ROLLS, counted rather than guessed. Every
 * quoted skill id in the shop, the arena and the three shipped adventure modules
 * was tallied, and the head of that list is Stealth (6), Perception (5),
 * Religion/Nature/Intimidation/Insight/Arcana (4 each), Persuasion (3).
 *
 * Two corrections to the raw count, both from reading the code that rolls:
 *
 *  - SLEIGHT OF HAND is promoted well above its tally of 2. Stealing requires
 *    passing BOTH a Stealth and a Sleight of Hand check (`attemptSteal`), so it
 *    is a bottleneck, not a tail skill: granting Stealth alone leaves the gambit
 *    exactly as blocked as before.
 *  - PERSUASION outranks Intimidation and Deception despite similar tallies,
 *    because it is the safe haggle — 20% off with no penalty on a failure, where
 *    Intimidation risks 25% and Deception only saves 15% (`HAGGLE`).
 *
 *  - ATHLETICS is third and ACROBATICS sixth, on a tally of one each, because
 *    Shove became an opposed Athletics-versus-Athletics-or-Acrobatics check, and
 *    that made them the most-rolled skills in the game by a distance: a single
 *    60-run arena sample threw over three thousand shove contests. Counting
 *    quoted ids could not see that — the rule names them once, in one file, and
 *    then rolls them every round. It is also why Skilled is no longer a purely
 *    out-of-combat feat.
 *
 * Fixed rather than random or "best", because the arena's randomized parties have
 * to stay comparable run to run, and because the forge shows the player exactly
 * which three they are getting.
 */
export const SKILLED_ORDER: readonly SkillId[] = [
  'stealth', 'perception', 'athletics', 'sleight-of-hand',
  'persuasion', 'acrobatics', 'insight', 'investigation',
  'intimidation', 'arcana', 'religion', 'nature',
  'deception', 'survival', 'medicine', 'history',
  'animal-handling', 'performance',
];

export function skilledSkills(already: readonly SkillId[], count: number): SkillId[] {
  return SKILLED_ORDER.filter((s) => !already.includes(s)).slice(0, count);
}

/**
 * The feat a background comes with when nobody chooses — the 2024 table's
 * pairing where this game has that feat, and the nearest fit where it does not.
 *
 * Every one of the four appears here, so a player who only ever taps Quick Start
 * still meets all of them across a few parties. A feat reachable in principle
 * and never seen in practice is the dead-data shape one step removed.
 */
export const BACKGROUND_FEAT: Record<Id, Id> = {
  acolyte: 'magic-initiate-cleric',   // SRD: Magic Initiate (Cleric)
  artisan: 'skilled',                 // SRD: Crafter — not modelled; Skilled is the nearest
  charlatan: 'skilled',               // SRD: Skilled
  criminal: 'alert',                  // SRD: Alert
  entertainer: 'skilled',             // SRD: Musician — not modelled
  farmer: 'hardy',                    // SRD: Tough (renamed; PHB name)
  guard: 'alert',                     // SRD: Alert
  guide: 'magic-initiate-cleric',     // SRD: Magic Initiate (Druid) — cleric is the one built
  hermit: 'hardy',                    // SRD: Healer — not modelled; Hardy is the nearest,
                                      //   and it keeps Magic Initiate off two more classes
  merchant: 'fated',                  // SRD: Lucky (renamed; PHB name)
  noble: 'skilled',                   // SRD: Skilled
  sage: 'magic-initiate-cleric',      // SRD: Magic Initiate (Wizard) — cleric is the one built
  sailor: 'hardy',                    // SRD: Tavern Brawler — not modelled; Hardy is the nearest
  scribe: 'skilled',                  // SRD: Skilled
  soldier: 'savage-attacker',         // SRD: Savage Attacker
  wayfarer: 'fated',                  // SRD: Lucky (renamed; PHB name)
};

export function defaultFeatFor(backgroundId: Id | undefined): Id | undefined {
  return backgroundId ? BACKGROUND_FEAT[backgroundId] : undefined;
}
