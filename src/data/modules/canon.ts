/**
 * The trilogy's facts of the world: one record per place, group, price or
 * count that more than one line (or a line and a rule) relies on, across The
 * Hollow Road, The Sunken Barrows and The Wyrmcalling (see "Facts of the
 * world: canon" in docs/module-writing-guide.md). Prose says them by token
 * (`{thornwick}`, `{^drowned-gold}`), and each chapter is built with
 * `withCanon(module, { npcs: TRILOGY_NPCS, facts: TRILOGY_FACTS })`. Where a
 * fact has a number, the effects that pay or charge it read `.value` from
 * here, so the text and the rule are one record (test/canon-trilogy.test.ts).
 *
 * A one-off detail stays plain prose.
 */
import type { Id } from '../../engine/types.js';
import type { CanonFact } from '../../adventure/types.js';

export const TRILOGY_FACTS: Record<Id, CanonFact> = {
  // ── Places and groups ────────────────────────────────────────────────────
  // Names, each typed only here (test/npc-names.test.ts). Prose supplies its
  // own article: "the {ashfang}", "an {ashfang} raider", "the {calling} Stone".
  thornwick: { text: 'Thornwick' },
  'wander-inn': { text: 'Wander-Inn' },
  /** The raiders of Part 1, and the name that follows them after. */
  ashfang: { text: 'Ashfang' },
  /** The stone's song in Part 3 ("the night of the {calling}"). */
  calling: { text: 'Calling' },
  /** Where the Warden sleeps, under the great barrow. */
  undercrypt: { text: 'Undercrypt' },
  /** The deep fen's gate of standing stones, where the barrow-country begins. */
  'barrow-gate': { text: 'Barrow Gate' },
  /** Marrow's village, emptied by the fever. */
  saltmere: { text: 'Saltmere' },
  /** The cult Marrow leads ("the Cult of the {worm}"). */
  worm: { text: 'Worm' },

  // ── The Reedwife's door ──────────────────────────────────────────────────
  /** What the fen-folk paid her, and when, to keep the Warden asleep. Told in
   *  all three chapters: "one {door-price} each {door-midwinter}". */
  'door-price': { text: 'lamb' },
  'door-midwinter': { text: 'midwinter' },
  /** How long she kept the door (her sister's words), against how long
   *  Thornwick's priests have said the liturgy: she kept it "since before
   *  your Thornwick had a name", so the first must be the longer. */
  'door-kept': { text: 'a thousand winters', value: 1000 },
  'thornwick-liturgy': { text: 'three hundred winters', value: 300 },

  // ── Part 1: the reeve's bounty ───────────────────────────────────────────
  /** The retainer taken at the board, and docked from the balance. */
  'bounty-retainer': { text: 'twenty-five', value: 25 },
  /** The bounty for the chief, paid whole to a company that took no retainer. */
  'bounty-full': { text: 'a hundred and twenty gold', value: 120 },
  /** What is left to pay after the retainer: the full bounty less it. */
  'bounty-balance': { text: 'ninety-five gold', value: 95 },
  'bounty-banner': { text: 'sixty gold', value: 60 },
  /** The reeve's reward for his scout, which she brings you herself. */
  'scout-reward': { text: 'fifty gold', value: 50 },
  /** What the peddler's fixer lifts from a company that looks in the wrong places. */
  'pinched-purse': { text: 'fifteen gold', value: 15, unspoken: true },
  /** A round for the taproom (Part 1), and a room for the night (Parts 1 and 2). */
  'tavern-round': { text: '3 gold', value: 3 },
  'inn-room': { text: '1 gold', value: 1 },

  // ── Part 2: the deep fen and the barrows ─────────────────────────────────
  /** The drowned folk's purses, counted at the pools. */
  'drowned-purses': { text: 'twelve', value: 12 },
  'drowned-gold': { text: 'fifty-five gold', value: 55 },
  /** Marrow's cult's offering-purse, taken when he is bound. */
  'offering-purse': { text: 'fifty gold', value: 50 },
  /** The graves Marrow dug at Saltmere, and later keeps. */
  'saltmere-graves': { text: 'forty graves', value: 40 },
  /** A hot supper for the whole taproom, after. */
  'taproom-supper': { text: '10 gold', value: 10 },

  // ── Part 3: the Wyrmcalling ──────────────────────────────────────────────
  /** Kin of the drowned, who bring their ropes to a company that carried the purses home. */
  'rope-bearers': { text: 'two fen-folk', value: 2 },
  /** The ogre-mage's toll for the middle pass: priced to hurt, about half of
   *  what a company carries up the mountain, against a fight or a lie. */
  'ogre-toll': { text: 'four hundred gold', value: 400 },
  /** Wren's reckoning on the third morning: the nights left before the
   *  Calling peaks (the dawn that marks the peak comes that many days later). */
  'peak-nights': { text: 'three more nights', value: 3 },
};

/** A fact's number, for an effect or requirement. Throws if it has none. */
export function factValue(id: Id): number {
  const v = TRILOGY_FACTS[id]?.value;
  if (v === undefined) throw new Error(`canon: fact '${id}' has no value`);
  return v;
}
