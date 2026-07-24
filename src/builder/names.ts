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

export const HERO_NAMES: Record<Id, string> = {
  fighter: 'Sir Arthur',
  wizard: 'Morgana Le Fey',
  cleric: 'Elaine the Holy',
  rogue: 'Cedric the Sneaky',
  ranger: 'Sylva Thornwood',
  paladin: 'Ser Roland',
};

export const RIVAL_NAMES: Record<Id, string> = {
  fighter: 'Sir Kay',
  wizard: 'Vivian the Cold',
  cleric: 'Brother Mordred',
  rogue: 'Nessa Quickfingers',
  ranger: 'Kael Grimshaw',
  paladin: 'Dame Vex',
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
  /** First names — one pool, not split by gender: the game never asks. */
  first: string[];
  /** Family names / epithets. Empty for species that use a single name. */
  last: string[];
}

const NAME_POOLS: Record<Id, NamePool> = {
  human: {
    first: ['Alric', 'Mara', 'Cedric', 'Rowan', 'Elena', 'Garrick', 'Isolde', 'Tomas',
      'Bryn', 'Aldous', 'Wren', 'Halvard'],
    last: ['Ashdown', 'Vale', 'Thorne', 'Marsh', 'Whitlock', 'Grey', 'Fenn', 'Harrow'],
  },
  dwarf: {
    first: ['Borin', 'Thrain', 'Dagna', 'Hilde', 'Grum', 'Onar', 'Brunna', 'Kildr',
      'Vesta', 'Durgan', 'Norra', 'Balin'],
    last: ['Ironbeard', 'Stonehand', 'Deepdelve', 'Coalheart', 'Hammerfall', 'Grimforge',
      'Oreson', 'Anvilbrow'],
  },
  elf: {
    first: ['Aelith', 'Sylvara', 'Faelen', 'Ilyra', 'Thaerin', 'Nuala', 'Erevan', 'Miriel',
      'Caladan', 'Yssara', 'Loriel', 'Aramil'],
    last: ['Moonwhisper', 'Silverbough', 'Nightbreeze', 'Dawnrunner', 'Starfall',
      'Willowmere', 'Highgrove', 'Sunweaver'],
  },
  orc: {
    first: ['Grosh', 'Karza', 'Ulk', 'Nazha', 'Dregg', 'Morga', 'Thokk', 'Ruka',
      'Skarn', 'Vashka', 'Gorm', 'Ilza'],
    last: ['Skullsplitter', 'Ironjaw', 'Bloodtusk', 'the Unbroken', 'Bonebreaker',
      'Ashfist', 'the Roaring', 'Redhand'],
  },
  dragonborn: {
    first: ['Rhogar', 'Sora', 'Balasar', 'Kavax', 'Thava', 'Arjhan', 'Nala', 'Torinn',
      'Vezra', 'Medrash', 'Surina', 'Kriv'],
    last: ['Emberscale', 'Stormhorn', 'Goldclaw', 'Ashwing', 'Brightfang', 'Cinderhide',
      'Thunderjaw', 'Frostmaw'],
  },
  tiefling: {
    first: ['Kesh', 'Nyx', 'Damaris', 'Zevran', 'Lilith', 'Mordai', 'Ash', 'Verrin',
      'Sable', 'Iskra', 'Thren', 'Ravel'],
    last: ['Duskbane', 'Emberlyn', 'the Quiet', 'Nightfell', 'Hollowmark', 'Sorrowvale',
      'Blackthorn', 'the Wry'],
  },
  gnome: {
    first: ['Fibble', 'Wren', 'Zook', 'Nissa', 'Pipp', 'Bramblewick', 'Tilda', 'Orin',
      'Jeb', 'Marigold', 'Corky', 'Nell'],
    last: ['Cogsworth', 'Fizzlebang', 'Copperkettle', 'Tinkertop', 'Sparkwhistle',
      'Underbramble', 'Quickfix', 'Nimblenock'],
  },
  halfling: {
    first: ['Perrin', 'Rosie', 'Milo', 'Poppy', 'Bandobras', 'Daisy', 'Tolman', 'Merry',
      'Nob', 'Pearl', 'Odo', 'Lily'],
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
