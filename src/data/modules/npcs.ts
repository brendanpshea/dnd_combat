/**
 * The trilogy's cast: one record per named character across The Hollow Road,
 * The Sunken Barrows and The Wyrmcalling (see src/adventure/npcs.ts). Prose
 * names them by token (`{wren}`), and each chapter is built with
 * `withCanon(module, { npcs: TRILOGY_NPCS, facts: TRILOGY_FACTS })` (facts in canon.ts).
 *
 * `introducedAt` lists, by chapter, the scenes where a player first learns who
 * the character is. A chapter that can be started cold (Parts 2 and 3) lists
 * its own introductions for a character carried from before. A character a
 * chapter names only in lines gated on carried flags (an ending slide for a
 * company that met them) is not listed for it: only a company that knows
 * them sees the name.

 */
import type { Id } from '../../engine/types.js';
import type { NpcDef } from '../../adventure/types.js';

/** Each version of the stone's `tear-loose` challenge (see wyrmcalling.ts). */
const TEAR_LOOSE = ['tear-loose', 'tear-loose-cracked', 'tear-loose-defiant', 'tear-loose-defiant-cracked',
  'tear-loose-cold', 'tear-loose-cold-cracked'];

export const TRILOGY_NPCS: Record<Id, NpcDef> = {
  mira: {
    id: 'mira', name: 'Mira', portraitId: 'npc-innkeeper', emoji: '🍺',
    introducedAt: {
      // Her note, signed in the first scene; then her own taproom.
      'hollow-road': ['road', 'tavern-meet'],
      // Her taproom; and "Mira the innkeeper", "Mira of the Wander-Inn" for a
      // company that never stops at the inn.
      'sunken-barrows': ['lychyard-lost', 'inn', 'inn-later', 'sb-defeat', 'sb-claim-round', 'sb-epilogue'],
      // "Mira's inn" at the fen-folk's fire; "Mira, who keeps the Wander-Inn" at the end.
      wyrmcalling: ['fenfolk-fire', 'fenfolk-fire-cracked', 'wc-epilogue', 'wc-epilogue-vigil'],
    },
  },
  wren: {
    id: 'wren', name: 'Wren', portraitId: 'npc-scout', emoji: '🏹', monsterId: 'scout',
    blurb: 'The reeve\'s scout.',
    // Pulled from under the horse on the marsh road (well, or at the cost of
    // a day), or walked past there.
    fates: ['saved', 'left'],
    introducedAt: {
      'hollow-road': ['scout-saved', 'scout-fail'],
      'sunken-barrows': ['reeve-hall', 'fen-out', 'fen-left', 'fen-partner', 'fen-reunion'],
      // Her fire, the council on the rim, and "Wren's scouts" at the forts they took.
      wyrmcalling: ['scouts-fire-old', 'scouts-fire-saved', 'scouts-fire-mended', 'war-council',
        'onihold-done', 'steading-done'],
    },
  },
  tamsin: {
    id: 'tamsin', name: 'Tamsin',
    // The scout who died under the horse when no one tended her in time.
    fates: ['dead'],
    introducedAt: { 'sunken-barrows': ['fen-partner'] },
  },
  vex: {
    id: 'vex', name: 'Vex', aka: ['the lieutenant'], portraitId: 'npc-captain', emoji: '🗡️',
    // At his fire: took the company's offer (`turned`), turned it down
    // (`refused`), or was refused a deal (`rebuffed`). `met` with no fate is
    // a save from before the last two.
    fates: ['turned', 'refused', 'rebuffed'],
    introducedAt: {
      'hollow-road': ['scout-saved', 'scout-fail', 'vex-parley'],
      // His briefing, and "Captain Vex" on the morning after the peak, and at
      // his map in the command tent.
      wyrmcalling: ['vex-brief', 'vex-brief-met', 'vex-brief-turned', 'peak-night', 'peak-line',
        'command-done', 'command-half', 'command-thin'],
    },
  },
  vargan: {
    id: 'vargan', name: 'Vargan', aka: ['the chief', 'the Ashfang chief'],
    // Killed in his hall; or, turned on the hag, executed, jailed or let go.
    fates: ['slain', 'executed', 'jailed', 'freed'],
    introducedAt: {
      // The bandit on the road speaks of his chief, and Mira tells of the
      // reed-cutter's boy; the hall gives him his name.
      'hollow-road': ['road-reveal', 'tavern-meet', 'boss-approach'],
    },
  },
  hask: {
    id: 'hask', name: 'Hask', portraitId: 'npc-guard', emoji: '🛡️', monsterId: 'veteran',
    blurb: 'The {ashfang} chief\'s guard, who answered to {vex} and stood aside for you. {vex} lent him to you for the stone.',
    introducedAt: {
      // Named by Vex when he turns; the hall's "Hask stands aside" choices
      // show only to a company that turned him.
      'hollow-road': ['vex-turned'],
      wyrmcalling: ['war-council'],
    },
  },
  reedwife: {
    id: 'reedwife', name: 'Reedwife',
    fates: ['dead'],
    introducedAt: {
      'hollow-road': ['hollow-won', 'boss-approach'],
      'sunken-barrows': ['inn', 'chapel-saved', 'chapel-won'],
      wyrmcalling: ['muster', 'envoys'],
    },
  },
  bram: {
    id: 'bram', name: 'Bram', portraitId: 'npc-merchant', emoji: '🧑‍🌾',
    introducedAt: {
      'hollow-road': ['market'],
      'sunken-barrows': ['sb-market'],
      // His stores; "Bram's stores" at the wagons, "Bram's war-stores" in the
      // hospital tent, the hoard he will buy, the arrows he sells in the ending.
      wyrmcalling: ['wc-stores', 'wagons-busy', 'wagons-carter', 'wc-defeat', 'redden', 'wc-epilogue', 'wc-epilogue-vigil'],
    },
  },
  osk: {
    id: 'osk', name: 'Osk', portraitId: 'npc-commoner', emoji: '🌾',
    introducedAt: { 'hollow-road': ['mill'] },
  },
  aldous: {
    id: 'aldous', name: 'Aldous', portraitId: 'npc-noble', emoji: '⚖️',
    introducedAt: {
      // "See Reeve Aldous at his hall": the fen road's note, on the town map.
      'sunken-barrows': ['town', 'reeve-hall'],
      // His note to the company, signed.
      // His note to the company, signed; "Reeve Aldous" in the ending slides.
      wyrmcalling: ['eastline-watch', 'eastline-late', 'wc-epilogue', 'wc-epilogue-vigil'],
    },
  },
  halden: {
    id: 'halden', name: 'Halden', portraitId: 'npc-priest', emoji: '🕯️', monsterId: 'priest',
    blurb: '{thornwick}\'s priest, whom you talked back out of the {warden}\'s grip. He came to say his rites at the stone.',
    // Talked out of the Warden's grip in the drowned chapel.
    fates: ['saved'],
    introducedAt: {
      'sunken-barrows': ['inn', 'chapel'],
      // At the council if he lived; otherwise his book of rites, at the stone.
      wyrmcalling: ['war-council', ...TEAR_LOOSE],
    },
  },
  marrow: {
    id: 'marrow', name: 'Marrow', portraitId: 'npc-priest', emoji: '⛏️',
    // Spared at the Warden's door: leads his faithful in the rites, or bound for the reeve.
    fates: ['sings', 'bound'],
    introducedAt: { 'sunken-barrows': ['chapel-saved', 'seal-approach'] },
  },
  warden: {
    id: 'warden', name: 'Warden',
    // What sleeps behind the door under the barrows. Halden speaks of him in
    // the drowned chapel; by Part 3 every company has stood at his door.
    introducedAt: { 'sunken-barrows': ['chapel', 'chapel-saved'] },
  },
  nettle: {
    id: 'nettle', name: 'Nettle',
    introducedAt: { wyrmcalling: ['envoys'] },
  },
  sedge: {
    id: 'sedge', name: 'Sedge',
    introducedAt: { wyrmcalling: ['calling-approach'] },
  },
};
