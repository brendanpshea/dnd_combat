/**
 * How much game there is, counted rather than claimed.
 *
 * The landing page advertised "6 classes · 8 ancestries · 45+ spells · 130+
 * monsters". Three of those four numbers were wrong the day the barbarian was
 * written — there were nine classes and sixty-nine spells, not six and
 * forty-five — and they had been drifting for as long as content had been
 * added, because a number typed into JSX has nothing keeping it honest.
 *
 * Undercounting is the friendly direction to be wrong in, which is exactly why
 * nobody noticed: the page was quietly selling the game short on the one screen
 * a new player decides from.
 *
 * Same rule as the reference docs and the art registry, applied to a sentence:
 * derive it from the data. `Object.keys(CLASSES).length` cannot go stale.
 */
import { CLASSES } from '../../src/data/classes.js';
import { SPECIES } from '../../src/data/species.js';
import { SPELLS } from '../../src/data/spells.js';
import { MONSTERS } from '../../src/data/monsters.js';

export const CLASS_COUNT = Object.keys(CLASSES).length;
export const SPECIES_COUNT = Object.keys(SPECIES).length;

/**
 * Spells and monsters round DOWN to the nearest ten and take a "+".
 *
 * An exact "69 spells" invites the reader to check, and a marketing line that
 * has to be exact is a marketing line that goes stale on the next commit. "60+"
 * stays true through the next eleven spells and is still an honest floor.
 */
const floorTen = (n: number) => Math.floor(n / 10) * 10;
export const SPELL_COUNT = `${floorTen(Object.keys(SPELLS).length)}+`;
export const MONSTER_COUNT = `${floorTen(Object.keys(MONSTERS).length)}+`;
