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
 * WHY THESE FOUR, AND WHY NOT ALERT
 *
 * The SRD has ten. Four are built, chosen for reaching different parts of the
 * engine: a non-caster's route to magic, a damage floor, out-of-combat range,
 * and hit points. Anything that only touched one of those would make the pick a
 * false choice.
 *
 * Alert (+proficiency to Initiative) was on the list and was measured out. The
 * probe was deliberately absurd — the WHOLE PARTY given +20 initiative, so every
 * hero acts before every foe in every fight — and that ceiling was worth 141/200
 * wins against a baseline of 131/200. Five percentage points for a guarantee no
 * feat can approach; one character with +2 or +3 is a small fraction of it, well
 * under the noise. A chip that says nothing is worse than no chip, so Alert is
 * not here. Tough took its place.
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
     * SIDE EFFECT, deliberately taken: `spellcastingAbility` is also what
     * `actions.ts` checks before letting anyone use a scroll or a wand, so this
     * feat opens those to a non-caster. That is a real, if modest, extra grant
     * beyond the SRD wording, and it is the honest reading of "Wisdom is your
     * spellcasting ability" — a character who can cast can read a scroll.
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
  tough: {
    id: 'tough', name: 'Tough',
    blurb: 'Two extra hit points per level. Simple, and it never stops mattering.',
    grants: { hpPerLevel: 2 },
  },
};

/**
 * The skills Skilled hands out: the first N of a fixed order that the character
 * is not already proficient in.
 *
 * A FIXED ORDER rather than a random or a "best" one, because the arena's
 * randomized parties have to be comparable run to run, and because a player
 * reading the forge should be able to predict what they are getting. The order
 * is roughly by how often this game actually rolls the skill — Perception and
 * Stealth lead because the arena's creep check and the adventure's scene checks
 * ask for them more than anything else.
 */
export const SKILLED_ORDER: readonly SkillId[] = [
  'perception', 'stealth', 'insight', 'athletics', 'persuasion', 'investigation',
  'survival', 'acrobatics', 'arcana', 'deception', 'intimidation', 'medicine',
  'nature', 'religion', 'history', 'sleight-of-hand', 'animal-handling', 'performance',
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
  criminal: 'skilled',                // SRD: Alert — measured out, see above
  entertainer: 'skilled',             // SRD: Musician — not modelled
  farmer: 'tough',                    // SRD: Tough
  guard: 'savage-attacker',           // SRD: Alert — measured out; Savage Attacker fits a guard
  guide: 'magic-initiate-cleric',     // SRD: Magic Initiate (Druid) — cleric is the one built
  hermit: 'magic-initiate-cleric',    // SRD: Healer — not modelled
  merchant: 'skilled',                // SRD: Lucky — not modelled
  noble: 'skilled',                   // SRD: Skilled
  sage: 'magic-initiate-cleric',      // SRD: Magic Initiate (Wizard) — cleric is the one built
  sailor: 'tough',                    // SRD: Tavern Brawler — not modelled; Tough is the nearest
  scribe: 'skilled',                  // SRD: Skilled
  soldier: 'savage-attacker',         // SRD: Savage Attacker
  wayfarer: 'savage-attacker',        // SRD: Lucky — not modelled
};

export function defaultFeatFor(backgroundId: Id | undefined): Id | undefined {
  return backgroundId ? BACKGROUND_FEAT[backgroundId] : undefined;
}
