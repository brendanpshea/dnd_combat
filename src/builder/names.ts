/**
 * Sample names for generated parties.
 *
 * A name is what makes a combat log read like a story instead of a spreadsheet
 * — and the narration bar has no room for anything else, since it speaks plain
 * English ("Sir Arthur hits Grix for 6!") rather than the log's tagged
 * "Fighter(T1) attacks Goblin Warrior 1(T2)".
 *
 * Two sets, because both sides of a skirmish are generated parties: one list
 * would put Sir Arthur against Sir Arthur. The log gets away with that (its
 * (T1)/(T2) tags disambiguate); plain English cannot.
 *
 * Lives in the builder rather than the campaign because *every* mode assembles
 * a party — skirmish, arena and CLI all call buildParty — and the campaign sits
 * above this layer, so it can read these but not the other way round.
 */
import type { Id, TeamId } from '../engine/types.js';
import { next, type RngState } from '../engine/rng.js';
import { CLASSES } from '../data/classes.js';

/**
 * A NAME MAY NOT ASSERT A GENDER, because there is no picture for it to be
 * right about.
 *
 * Portraits in this game are per-CLASS, not per-character: every cleric wears
 * the same face, and so does every paladin. So a default name that commits to
 * one is a coin flip against art that cannot change — and it kept losing. The
 * cleric portrait is a woman and the rival cleric was "Brother Mordred"; the
 * paladin portrait is a woman and the hero paladin was "Ser Roland". The same
 * mistake had already been found and fixed in the tutorial, where the cleric
 * was "Brother Alden".
 *
 * So: no honorifics that carry a gender (Sir, Ser, Dame, Brother, Sister), and
 * given names chosen to sit either side of the line. Epithets do the work the
 * honorifics were doing — "the Holy", "the Sneaky" — and carry no such claim.
 */
export const HERO_NAMES: Record<Id, string> = {
  fighter: 'Arthur the Bold',
  wizard: 'Morgan Le Fey',
  cleric: 'Elaine the Holy',
  rogue: 'Ash the Sneaky',
  ranger: 'Sylva Thornwood',
  paladin: 'Roan the Radiant',
  barbarian: 'Hrothgar',
  monk: 'Shen',
  bard: 'Lyra Songthread',
  druid: 'Alder Mosswood',
  warlock: 'Thessaly Grimm',
  sorcerer: 'Ember',
};

export const RIVAL_NAMES: Record<Id, string> = {
  fighter: 'Kay the Grim',
  wizard: 'Vivian the Cold',
  cleric: 'Mordred the Pale',
  rogue: 'Nessa Quickfingers',
  ranger: 'Kael Grimshaw',
  paladin: 'Vex the Sworn',
  barbarian: 'Skarn',
  monk: 'Ilma',
  bard: 'Corvin Blackquill',
  druid: 'Nettle Ashbark',
  warlock: 'Malachai Crowe',
  sorcerer: 'Draven Coil',
};

/** A starting name for a class, distinct per side so a mirror match reads. */
export function defaultNameFor(classId: Id, team: TeamId = 'team1'): string {
  const names = team === 'team1' ? HERO_NAMES : RIVAL_NAMES;
  return names[classId] ?? CLASSES[classId]?.name ?? 'Adventurer';
}

// --- Random names ----------------------------------------------------------
/**
 * A per-species name generator, hand-curated rather than pulled from a package.
 *
 * The off-the-shelf generators (Markov chains, syllable mashers) produce a lot
 * of "Vrelnag" — pronounceable in theory, unreadable in a text box a nine-year
 * old is scanning mid-fight. Curated lists cost eighty lines and give each
 * species an actual phonetic identity: dwarves get hard consonants and stone,
 * elves get liquid vowels, halflings get homely English, orcs get one blunt
 * syllable. That legibility is the whole point of a name here.
 *
 * Seeded off the campaign RNG (`next`), so a given seed always rebuilds the
 * same party — the same determinism every other generated thing in this project
 * relies on.
 */
interface NamePool {
  /**
   * First names — one pool, and every name in it deliberately reads either way.
   *
   * "Not split by gender" was already the rule; what it missed is that the pool
   * still HELD strongly gendered names (Rosie, Lilith, Elena, Dagna, Marigold),
   * and a random name lands on a per-class portrait it has no say over. Drawing
   * "Rosie" for a character wearing the fighter's face is the same mismatch as
   * calling the woman in the cleric portrait "Brother". Each species keeps its
   * phonetic identity — dwarves hard and stony, elves liquid, halflings homely —
   * because that legibility is the whole point; only the gendering is gone.
   */
  first: string[];
  /** Family names / epithets. Empty for species that use a single name. */
  last: string[];
}

const NAME_POOLS: Record<Id, NamePool> = {
  human: {
    first: ['Rowan', 'Wren', 'Bryn', 'Quinn', 'Ellis', 'Marlow', 'Rory', 'Emery',
      'Ash', 'Hale', 'Wynn', 'Sloane'],
    last: ['Ashdown', 'Vale', 'Thorne', 'Marsh', 'Whitlock', 'Grey', 'Fenn', 'Harrow'],
  },
  dwarf: {
    first: ['Borin', 'Thrain', 'Brok', 'Durn', 'Grum', 'Onar', 'Torv', 'Kildr',
      'Rune', 'Ordan', 'Skald', 'Balin'],
    last: ['Ironbeard', 'Stonehand', 'Deepdelve', 'Coalheart', 'Hammerfall', 'Grimforge',
      'Oreson', 'Anvilbrow'],
  },
  elf: {
    first: ['Aelith', 'Faelen', 'Thaerin', 'Loriel', 'Caladan', 'Aramil', 'Erevan', 'Ilyan',
      'Sevrin', 'Naeryn', 'Vaelor', 'Ithil'],
    last: ['Moonwhisper', 'Silverbough', 'Nightbreeze', 'Dawnrunner', 'Starfall',
      'Willowmere', 'Highgrove', 'Sunweaver'],
  },
  orc: {
    first: ['Grosh', 'Ulk', 'Dregg', 'Thokk', 'Skarn', 'Gorm', 'Zug', 'Mokk',
      'Brag', 'Hruk', 'Varg', 'Krell'],
    last: ['Skullsplitter', 'Ironjaw', 'Bloodtusk', 'the Unbroken', 'Bonebreaker',
      'Ashfist', 'the Roaring', 'Redhand'],
  },
  dragonborn: {
    first: ['Rhogar', 'Kavax', 'Arjhan', 'Torinn', 'Medrash', 'Kriv', 'Zarax', 'Nyrek',
      'Halvax', 'Vrask', 'Skerrin', 'Thorvax'],
    last: ['Emberscale', 'Stormhorn', 'Goldclaw', 'Ashwing', 'Brightfang', 'Cinderhide',
      'Thunderjaw', 'Frostmaw'],
  },
  tiefling: {
    first: ['Kesh', 'Nyx', 'Zevran', 'Mordai', 'Ash', 'Verrin', 'Sable', 'Iskra',
      'Thren', 'Ravel', 'Vesper', 'Corvin'],
    last: ['Duskbane', 'Emberlyn', 'the Quiet', 'Nightfell', 'Hollowmark', 'Sorrowvale',
      'Blackthorn', 'the Wry'],
  },
  gnome: {
    first: ['Fibble', 'Wren', 'Zook', 'Pipp', 'Bramblewick', 'Orin', 'Corky', 'Tinker',
      'Bobbin', 'Quill', 'Sprocket', 'Nim'],
    last: ['Cogsworth', 'Fizzlebang', 'Copperkettle', 'Tinkertop', 'Sparkwhistle',
      'Underbramble', 'Quickfix', 'Nimblenock'],
  },
  halfling: {
    first: ['Perrin', 'Merry', 'Nob', 'Bramble', 'Hob', 'Pip', 'Tansy', 'Fen',
      'Marlow', 'Wick', 'Bilberry', 'Rue'],
    last: ['Goodbarrel', 'Underhill', 'Tealeaf', 'Brambleburr', 'Thistledown',
      'Applewood', 'Greenbottle', 'Highhill'],
  },
};

/** Fallback for a species with no pool of its own (nothing today; future-proof). */
const FALLBACK_POOL: NamePool = NAME_POOLS['human']!;

function pick<T>(list: T[], state: RngState): { value: T; state: RngState } {
  const r = next(state);
  return { value: list[Math.floor(r.value * list.length)]!, state: r.state };
}

/**
 * A random name for a species, advancing the RNG. Roughly a third come back as
 * a bare first name — a party of four all sporting grand two-part names reads
 * like a costume box, and "Milo" beside "Thrain Ironbeard" feels like people.
 */
export function randomNameFor(speciesId: Id, state: RngState): { value: string; state: RngState } {
  const pool = NAME_POOLS[speciesId] ?? FALLBACK_POOL;
  const f = pick(pool.first, state);
  if (pool.last.length === 0) return f;
  const roll = next(f.state);
  if (roll.value < 0.34) return { value: f.value, state: roll.state };
  const l = pick(pool.last, roll.state);
  // An epithet already reads as a phrase ("Grosh the Unbroken"); a surname just
  // follows the first name.
  return { value: `${f.value} ${l.value}`, state: l.state };
}

/** Every species that has a curated pool — for tests and the forge's dice button. */
export const NAMED_SPECIES = Object.keys(NAME_POOLS);
