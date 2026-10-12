/**
 * Names for the things fetch quests are about: long enough to say what they
 * are, and grand enough to be worth a walk — "the Tome of Drowned Lanterns",
 * "Aldric's Silver Chalice", "the Weeping Jewel of Harrowmere". A proper
 * noun, where one is wanted, comes from the name generators, in the county's
 * own style, so the jewel sounds like it came from round here.
 *
 * Every name reads after "the" or as a possessive ("Aldric's …"), and stays
 * within 40 characters: it goes in the journal and in choices.
 */
import { firstName, placeName, type NameStyle } from './names.js';

type Rng = () => number;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;

/** What it is: a book, a jewel, a relic, a regalia. */
const BOOK = ['Tome', 'Codex', 'Grimoire', 'Chronicle', 'Book', 'Ledger', 'Psalter', 'Scroll'];
const JEWEL = ['Jewel', 'Sapphire', 'Ruby', 'Emerald', 'Pearl', 'Opal', 'Diamond', 'Garnet'];
const THING = ['Chalice', 'Crown', 'Sceptre', 'Amulet', 'Signet', 'Reliquary', 'Censer', 'Circlet', 'Horn', 'Lantern', 'Mirror', 'Key', 'Ewer', 'Torc'];
const STUFF = ['Silver', 'Gilded', 'Ivory', 'Jade', 'Bronze', 'Obsidian', 'Amber', 'Crystal', 'Ebony', 'Pewter'];
const MOOD = ['Weeping', 'Burning', 'Sleeping', 'Hollow', 'Singing', 'Bleeding', 'Frozen', 'Whispering', 'Shrouded', 'Last'];
const OF_ADJ = ['Drowned', 'Forgotten', 'Silent', 'Broken', 'Ashen', 'Unspoken', 'Wandering', 'Hidden', 'Lost', 'Seven'];
const OF_NOUN = ['Lanterns', 'Winters', 'Kings', 'Stars', 'Tides', 'Bells', 'Saints', 'Names', 'Roads', 'Crowns', 'Doors', 'Hours'];

/** One name, without "the" (the caller adds it where the sentence wants). */
export function questObjectName(rng: Rng, style: NameStyle = 'saxon'): string {
  for (let i = 0; i < 20; i++) {
    const n = draft(rng, style);
    if (n.length <= 40) return n;
  }
  return `${pick(rng, STUFF)} ${pick(rng, THING)}`;
}

function draft(rng: Rng, style: NameStyle): string {
  switch (Math.floor(rng() * 5)) {
    case 0: return `${pick(rng, BOOK)} of ${pick(rng, OF_ADJ)} ${pick(rng, OF_NOUN)}`;
    case 1: return `${firstName(style, rng() < 0.5 ? 'male' : 'female', rng)}'s ${pick(rng, STUFF)} ${pick(rng, THING)}`;
    case 2: return `${pick(rng, MOOD)} ${pick(rng, JEWEL)} of ${placeName(style, rng, 10)}`;
    // Singular: "the Seven King" will not do.
    case 3: return `${pick(rng, THING)} of the ${pick(rng, OF_ADJ.filter((a) => a !== 'Seven'))} ${pick(rng, OF_NOUN).replace(/s$/, '')}`;
    default: return `${pick(rng, STUFF)} ${pick(rng, THING)} of ${placeName(style, rng, 10)}`;
  }
}

/** "the Tome of …", but "Aldric's …" as it is. */
export function theObject(name: string): string {
  return /^[A-Z][a-z]+'s /.test(name) ? name : `the ${name}`;
}
