/**
 * "The Wyrmcalling" — Part 3 of the trilogy (docs/trilogy-plan.md): the
 * L4→5 finale. The Reedwife's two sisters come to collect what the company
 * owes the coven — by waking the Calling stone in the high hills and
 * whistling down every hungry thing that answers: wyrmlings from their dens,
 * giants promised a valley, elementals pulled through the seams the
 * Undercrypt's broken ward left thin.
 *
 * Shape: a war-camp hub (the valley raises its army at last) → the high
 * hills, an open traversal where the company PICKS ITS BATTLES — every den
 * raided and beast put down is one monster fewer when the Calling peaks — →
 * the stone itself, where the party answers the sisters and tries to tear them
 * out of the rock: fight them in person (`sisters-at-stone`), or, if every
 * approach fails, the cataclysm the stone spends them on. The mid fights are
 * genuinely optional; the dens have a mechanical payoff too (clear all three
 * and the chromatic clutch never masses at the gate). Most threats can also be
 * handled without a fight, as Wren's notes say: talk the manticore into
 * collecting from the coven, time the stampede (or a druid calms it), lie the
 * ogre-mage into raiding the ettin, set the ettin's heads on each other, or
 * rob the gorgon's statues by stealth. A dragonborn can order the green
 * wyrmling home; a wizard or warlock gets an extra way to tear the sisters
 * loose. Everything dealt with ticks the camp's tally (TALLY), which the
 * ending reads as the camp held or the camp bled.
 *
 * XP budget (trilogy-plan.md), and no level floor: the hills' fights carry a
 * company from 4th to 5th before the stone (docs/module-writing-guide.md,
 * "Levels come from fights"). On every road up: the envoy's hired swords
 * 1,700, the griffons on the switchbacks 1,800, the flooded seam 2,100, the
 * three dens 2,625 (or the brood on the rim), the ogre-mage's hold 3,100 and
 * the giants' hall 2,100; the manticore, the boar-runs and the gorgon add
 * 3,500 more. The near side is fought at 4th and tuned for it (the hold is
 * the hardest, 73% won at 4th). Every way past a fight (talking, tricking,
 * paying, scattering the herd) pays what the fight would have
 * (`avoidedFightXP`). A continuing company (~3,450–4,300 XP from Part 2)
 * reaches 5th partway up the hills on every transcript route; a cold start
 * opens at 4th (its one floor, on the cold-start choice) and gets there
 * after its last hill fight. The stone is fought at 5th.
 *
 * CARRIED CHOICES: only the ledger (docs/state-ledger.md). Vex's briefing
 * reads whether he was `turned` (took the party's offer in Part 1), and is
 * worded true of every company he was not. Wren's fire reads her fate
 * `saved` (she owes you a leg) or `lost` (her partner's bow); any other
 * {wren} walked the fen with the company in Part 2, and a cold start's
 * {wren} has never walked with it: they are strangers (WREN_NEW). A
 * cold start is the company that broke the Ashfang and killed the Reedwife,
 * with nothing carried about how any parting went. A saved Halden (fate
 * `saved`) opens an easier way to tear the sisters loose. The endings'
 * slides read these and the rest (`sunken-barrows:seal-cracked`, Vargan
 * `dead` or `spared`, Marrow); the fen-folk's fire at the war-camp reads the
 * cracked door too, through a "you've been here" beat the reach search does
 * not track, and at the stone the Warden's dead come up through the cracks
 * (see CRACKED).
 *
 * TWO ENDINGS: the sisters fall at the stone (`wc-epilogue`), or — after an
 * answer that owns the wrong or tells the truth, and a challenge whose
 * approaches are the company's carried mercy (see REPLIES, vigilScene) —
 * Sedge agrees to keep the vigil her sister kept, drags Nettle out of the
 * stone, and the Calling dies without a last fight (`wc-epilogue-vigil`). No
 * loot, no fight; hags in the fen again.
 *
 * WAR ASSETS: the war council on the rim, before the company goes down into
 * the bowl, is where Parts 1–2 come due (see OWED / COUNCIL): Wren, Halden
 * and Vex's man Hask can join (two at most), the freed captives
 * (`hollow-road:captives-freed`) bring potions, and the valley's regard
 * (`sunken-barrows:regard`, read in bands; see REGARD) brings Thornwick's
 * watch for the camp's tally at 1, and at 2 or more the fen-folk's ropes as
 * well, which make `tear-loose` easier. A cold start is owed Wren alone.
 *
 * MONSTER VARIETY: the top shelf, none of it fielded by Parts 1–2 — the envoy's
 * hired knight, harpies by night, a talking manticore, boar stampedes, three
 * chromatic wyrmlings (or their massed clutch), an ogre-mage's warband, an
 * ettin's hall, a gorgon, a water elemental, and at the stone either the
 * sisters themselves with a fire elemental, or the fire-and-earth cataclysm.
 *
 * VOICE: plain, concrete, Zelda-register. Every image resolves inside the
 * passage it appears in (no riddle-similes), a character speaks the stakes
 * rather than the narrator implying them, proper nouns get a physical anchor
 * on first use, and abstractions give way to things a reader can see. See
 * docs/module-writing-guide.md.
 */
import type { Choice, Effect, Module, Outcome, Para, Requirement, Scene } from '../../adventure/types.js';
import { withCanon, speaker, companionsFrom, carriedRenames, npcFateFlag } from '../../adventure/npcs.js';
import { TRILOGY_NPCS as NPCS, TRILOGY_RENAMED_FATES } from './npcs.js';
import { TRILOGY_FACTS, factValue } from './canon.js';
import { avoidedFightXP } from '../encounters.js';
import { HOLLOW_ROAD_RENAMED_NPC_FLAGS } from './hollow-road.js';
import { SUNKEN_BARROWS_RENAMED_NPC_FLAGS } from './sunken-barrows.js';

const WREN = speaker(NPCS.wren!, 'Chief of Scouts');
const BRAM = speaker(NPCS.bram!, 'War-Quartermaster');

/** Into Vex's briefing: whether he took the party's offer in Part 1
 *  (`turned`), or not. Exactly one holds in every mix. */
const TO_BRIEFING: Choice[] = [
  { id: 'hear', label: 'Hear him out', to: 'vex-brief-turned',
    requires: [{ kind: 'npc', npc: 'vex', fate: 'turned' }], hideWhenBlocked: true },
  { id: 'hear-new', label: 'Hear him out', to: 'vex-brief',
    requires: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }], hideWhenBlocked: true },
];

/** Vex's plan, the same whoever he is to you, closing on how he stands with
 *  the reeve: pardoned (`RESPECTABLE`, turned), or out of a cell on the
 *  reeve's hard terms (`ON_TERMS`). {sedge} is not named until the stone. */
const RESPECTABLE = 'Apparently I\'m respectable now, and respectable men don\'t go up first."';
const ON_TERMS = 'The reeve likes his prisoners where he can count them, and that isn\'t out in front."';
const briefPlan = (close: string): string[] => [
  '"Here\'s the problem." He taps the map, where fires mark the high passes. "Every day the stone sings, more of the hills come down to listen. Wyrm dens here, here and here. An ogre-mage holding the middle pass. An ettin in a hall above the tree-line. Giant footprints in the orchards, and streams running uphill."',
  '"{nettle} and her sister are holding the peak back, and I think they\'re saving it for you. The night you come over the last ridge, they\'ll let the {calling} peak. All of it comes down this slope at once, unless it\'s dead first."',
  `"So every den you burn out is one monster fewer on the day. Clear what you can reach before you climb that ridge, and my scouts will pin it on the map." A thin smile comes and goes. "I\'ll bring the column up behind you once the passes are open. ${close}`,
];

const briefed = (vexBody: string): Effect[] => [
  { kind: 'setFlag', flag: 'briefed' },
  { kind: 'journal', entry: { id: 'n-vex3', kind: 'npc', title: 'Captain {vex}', body: vexBody } },
  { kind: 'journal', entry: { id: 'lead-stone', kind: 'lead', resolvedBy: 'calling-found',
    title: 'The {calling} Stone', body: 'Somewhere past the ogre-mage\'s pass and the giants\' hall, the sisters are tending the stone that calls the hills down. Climb until you find it. {vex} says the {calling} will peak the night you reach the last ridge, so clear what you can first.' } },
];

/**
 * Wren's advice, the same whether she knows you or not. Every tip points at a
 * real option in the hills, and each is easier with her notes (`wren-brief`):
 * the manticore's toll (`tollcliff`), timing the stampede (`boarruns`),
 * robbing the statues quietly (`gorgonvale-sneak`), and setting the ogre-mage
 * and the ettin's two heads against each other (`onihold`, `steading`).
 * Each is a pair of choices on the flag, so only one version shows, and the
 * pair shares one `attempt`.
 */
const WREN_BEASTS =
  '"The **manticore** on the toll-cliff talks. It\'ll ask you for a toll, and what it really wants is you. But it\'s greedy, and greedy things can be pointed somewhere else. The **boar-runs** flood with a stampede twice a day. Watch the dust."';
const WREN_GORGON =
  '"Past the middle pass there\'s a valley full of statues, and they\'re far too good. **Gorgon.** Don\'t let it breathe on you. Their purses are still lying at their feet, if you can go in quietly."';
const WREN_GIANTS =
  '"The ogre-mage and the ettin both want the valley, and neither one trusts the other. And the ettin. Watch which head is talking."';

/** How {wren} hands over her notes, by what she makes of the company (her
 *  `attitude`, built in Parts 1–2). Neither line shows on a cold start. */
const WREN_SEES_YOU_OFF = [
  { if: [{ kind: 'npc' as const, npc: 'wren', attitude: { atLeast: 2 } }],
    text: 'She walks you to the edge of the firelight, which she does not do for the captain.' },
  { if: [{ kind: 'npc' as const, npc: 'wren', attitude: { below: 0 } }],
    text: 'She hands the notes over the way she would hand them to anyone. They are complete and correct, and there is nothing extra in them.' },
];

/** Set (as a count, so the reach search leaves it untracked) when {wren} goes
 *  down into the bowl with a company she would follow anywhere: her regard
 *  warm (2 or more) at the war council. She slips down into the bowl alone
 *  while the column digs in on the rim (see `war-council`), and shows
 *  the company the stone's seam (`tear-loose`), and she will speak for it to
 *  {sedge} (the vigil). */
const WREN_FOLLOWS = 'wren-follows';
const wrenFollows = (yes: boolean): Requirement => ({ kind: 'count', flag: WREN_FOLLOWS, ...(yes ? { atLeast: 1 } : { below: 1 }) });

const TAKE_NOTES: Choice[] = [{ id: 'ok', label: 'Take her map-notes', to: 'warcamp',
  effects: [{ kind: 'setFlag', flag: 'wren-brief' }, { kind: 'xp', amount: 30 },
    { kind: 'journal', entry: { id: 'c-scoutnotes', kind: 'clue', title: '{wren}\'s Map-Notes',
      body: '{wren} said the manticore on the toll-cliff is greedy, so promise it a bigger meal somewhere else. Watch the dust at the boar-runs and slip across between stampedes. The gorgon\'s statues dropped their purses when their belts turned to stone, and anyone quiet enough can pick them up. The ogre-mage and the ettin distrust each other, and the ettin\'s two heads never agree.' } }] }];

/**
 * The camp's tally: one tick for every threat dealt with before the Calling
 * peaks, whether fought or talked down. (A toll paid at the middle pass buys
 * the pass, not the warband, which goes down at the camp on the night: no
 * tick, and one off, ONI_AT_CAMP; see `onihold`.) Three are on every road up
 * (the flooded pass, the middle pass, the giants' hall). The rest are the
 * company's choice: the toll-cliff, the boar-runs, the gorgon, and the three
 * dens. A den burned out counts twice (DEN_TICKS), as Vex promised: its
 * wyrmling never reaches the rim, and its kobolds never reach the camp.
 * Thornwick's watch, if Reeve Aldous sends it (see WAR ASSETS), counts for
 * two more. So the tally on the night runs from 1 to 14 (the brood met on the
 * rim comes after the night, and does not count). It starts at minus
 * THREAT_PAR, so `flag` (above zero) means more than THREAT_PAR threats were
 * handled, `notFlag` means THREAT_PAR or fewer. Play reads it: Vex's map in
 * the command tent, the night watched from the last ridge (see PEAK_NOW), and
 * the camp on the morning after (see PEAK_WHEN). A requirement can only ask
 * "at least N" (or `notFlag`, "zero or less"), so a three-way split is made by
 * a node's `sceneWhen`, where the first match wins. The reach search does not
 * track a counted flag; a requirement on it is taken as possible either way.
 */
const TALLY = 'threats-cleared';
const THREAT_PAR = 9;
const DEN_TICKS = 2;
/** The ogre-mage's warband, paid out of the middle pass before the peak,
 *  goes down at the camp on the night: one more threat at the east line, so
 *  a tick off the tally (see `onihold`). */
const ONI_AT_CAMP: Effect = { kind: 'addFlag', flag: TALLY, amount: -1 };
const tally = (n = 1): Effect[] => Array.from({ length: n }, () => ({ kind: 'setFlag' as const, flag: TALLY }));
/** The tally read in play: at least TALLY_HIGH is most of the hills dealt
 *  with (ten or more of fourteen), at least TALLY_HALF about half (six to
 *  nine), and anything under that is a camp in trouble. With par at nine, a
 *  company that walks the road and burns the dens but leaves the rest (or
 *  pays its way through the middle pass) lands at a cost; the best night
 *  needs side threats or Thornwick's watch as well. */
const TALLY_HIGH = 1;
const TALLY_HALF = -3;
const tallyAtLeast = (n: number): Requirement => ({ kind: 'flag', flag: TALLY, value: n });
/**
 * The night of the Calling, frozen at the dawn it ends (see DAWNS): deeds
 * done after it are counted in TALLY, but they cannot rewrite the night.
 * PEAK_TALLY is the tally as it stood that morning. PEAK_HELD is the same
 * count shifted so that `flag` means the camp held (TALLY_HALF or better)
 * and `notFlag` means it nearly broke, since a requirement cannot ask
 * "below N" any other way.
 */
const PEAK_TALLY = 'tally-at-peak';
const PEAK_HELD = 'peak-held';
const peakAtLeast = (n: number): Requirement => ({ kind: 'flag', flag: PEAK_TALLY, value: n });
const PEAK_SNAPSHOT: Effect[] = [
  { kind: 'copyFlag', from: TALLY, to: PEAK_TALLY },
  { kind: 'copyFlag', from: TALLY, to: PEAK_HELD },
  ...Array.from({ length: 1 - TALLY_HALF }, () => ({ kind: 'setFlag' as const, flag: PEAK_HELD })),
];

/**
 * Each of Wren's tricks is one try, with her notes or without: the two
 * versions of each share an `attempt`, so a party that fails the plain one and
 * then reads her notes does not get a second roll.
 */
/** The herd got past without a fight: it lives, and it turns away. */
const HERD_SPARED: Effect[] = [{ kind: 'setFlag', flag: 'boarruns-cleared' },
  ...tally(), { kind: 'xp', amount: avoidedFightXP('boar-stampede') }];

/** A missed run across the boar-runs: a pack bursts under the herd. */
const SCATTERED: Effect[] = [{ kind: 'gold', amount: -30 }];

const GORGON_WON = { to: 'hills', text: ['The gorgon crashes onto its side with its iron plates ringing, and the green vapour thins away to nothing. The statues keep their silent watch. At the end of one row stands a stone peddler with his money-box at his feet, and the box is not stone.'],
  effects: [{ kind: 'setFlag', flag: 'gorgon-cleared' }, ...tally(), { kind: 'gold', amount: 100 }] } satisfies Outcome;

/** The ettin talked into a fight with itself: the hall empties, no loot. */
const STEADING_TALKED: Effect[] = [{ kind: 'setFlag', flag: 'steading-cleared' }, { kind: 'setFlag', flag: 'ettin-split' },
  ...tally(), { kind: 'xp', amount: avoidedFightXP('giants-hall') }];

const STEADING_INTRO = [
  'Above the tree-line stands the giants\' hall. Something built it in one season, out of whole pine trees and stone blocks as big as wagons.',
  'At the first scrape of your boots, one huge body ducks out of the door with two heads on top, arguing. It is the **ettin** {vex} warned you about. Two shaggy ogres in sheepskins stumble out behind it, still chewing, and a skinny orc runner trots at their heels.',
  '"THE STONE PROMISED US THE VALLEY," booms the left head. "The stone promised ME the valley," the right head corrects. Both heads notice you at the same moment, and both of them stop talking.',
];
const STEADING_WON = { to: 'hills', text: ['The ettin goes down still arguing about whose fault it was. The orc runner falls beside it. Inside the hall you find tribute, plunder, and an entire orchard\'s worth of pickled fruit, taken from the valley one cart at a time.'],
  effects: [{ kind: 'setFlag', flag: 'steading-cleared' }, ...tally(), { kind: 'gold', amount: 140 }] } satisfies Outcome;
/** Wren's clue: the two heads never agree. Agree with both. */
const STEADING_PARLEY = [
  '"The valley is yours," you tell the left head. You turn to the right head. "And yours." Both heads hear you say it.',
  'The ettin stands very still until the left head says something unforgivable to the right one. The argument carries it out through the back of the hall, ogres and orc runner and all. You can hear it halfway down the mountain.',
];

const TO_EPILOGUE: Choice[] = [{ id: 'done', label: 'Let the valley celebrate', to: 'wc-epilogue' }];
const TO_VIGIL_EPILOGUE: Choice[] = [{ id: 'done', label: 'Let the valley celebrate', to: 'wc-epilogue-vigil' }];

/**
 * The walk down the mountain: one short beat for each companion the war
 * council sent down into the bowl, in a fixed order, then on to the camp.
 * The ending slides say what became of them; these only say they came back.
 */
const ESCORTS = ['wren', 'halden', 'hask'] as const;
const ESCORT_LINES: Record<(typeof ESCORTS)[number], Para[]> = {
  wren: ['{wren} walks down beside you, counting the passes under her breath. At each one she stops and marks the map. "For the report," she says.',
    // Warmth is earned: only a company she has come to like gets checked on.
    { if: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }],
      text: 'She does not say she is glad you are all alive, but she keeps checking that you are.' }],
  halden: ['Brother {halden} walks down with his prayer book shut under his arm. Halfway down he stops, holds out his hands, and looks at them. They have shaken since the drowned chapel. Now they are still.'],
  hask: ['{hask} walks down at the back, the way a guard should, and says nothing the whole way. At the last bend he looks back up at the broken stone. "Tell {vex} I kept my feet," he says.'],
};
/** What each escort's line takes for granted besides being there. */
const ESCORT_ASSUMES: Partial<Record<(typeof ESCORTS)[number], Requirement[]>> = {
  halden: [{ kind: 'npc', npc: 'halden', fate: 'saved' }],
  hask: [{ kind: 'npc', npc: 'vex', fate: 'turned' }],
};
/** From the `from`th escort on: the first one still with the party, or `dest`. */
const walkDown = (from: number, prefix: string, dest: string, label: string, effects?: Effect[]): Choice[] => {
  const rest = ESCORTS.slice(from);
  const fx = effects ? { effects } : {};
  const gone = (c: string): Requirement => ({ kind: 'noCompanion', companion: c });
  return [
    ...rest.map((c, i): Choice => ({ id: `with-${c}`, label, to: `${prefix}-${c}`, hideWhenBlocked: true,
      requires: [...rest.slice(0, i).map(gone), { kind: 'companion', companion: c }], ...fx })),
    { id: 'on', label, to: dest, hideWhenBlocked: true, requires: rest.map(gone), ...fx },
  ];
};
const walkDownScenes = (prefix: string, dest: string): Record<string, Scene> => Object.fromEntries(ESCORTS.map((c, i) => {
  const id = `${prefix}-${c}`;
  return [id, { id, kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '⛰️' },
    assumes: [{ kind: 'companion', companion: c }, ...(ESCORT_ASSUMES[c] ?? [])],
    text: ESCORT_LINES[c], next: walkDown(i + 1, prefix, dest, 'Walk on down') } satisfies Scene];
}));

/**
 * The brood on the rim is exactly the wyrmlings whose dens were left
 * standing — Vex's "one monster fewer on the day", kept to the letter. One
 * battle scene per combination (encounters `den-clutch-*`), picked by which
 * dens are cleared. All three cleared skips the rim (`calling-gate-clear`).
 */
const DENS = {
  g: { flag: 'green-cleared', name: 'green', from: 'out of the thicket' },
  b: { flag: 'blue-cleared', name: 'blue', from: 'off the mesa' },
  r: { flag: 'red-cleared', name: 'red', from: 'up from the burning den' },
} as const;
const BROODS = ['g', 'b', 'r', 'gb', 'gr', 'br', 'gbr'] as const;
/** A den marker after the Calling peaks (see DAWNS): nobody home. */
const PEAKED = { if: [{ kind: 'flag' as const, flag: 'calling-peaked' }], to: 'den-flown' };
/** The other optional threats after the peak: they went down the slope at the
 *  camp on the night, so they are gone from their posts, and the night is
 *  judged without them (no tally tick). Each beat only leads back to the
 *  hills, so it costs the reach search nothing. The required ones (the
 *  flooded pass, the middle pass, the giants' hall) hold the road to the
 *  stone, and stay where they are. */
const PEAKED_GONE = (id: string) => ({ if: [{ kind: 'flag' as const, flag: 'calling-peaked' }], to: `${id}-flown` });
const broodChoices = (effects?: Effect[], also: Requirement[] = []): Choice[] => BROODS.map((k) => ({
  id: `brood-${k}`, label: 'Meet the brood on the rim', to: `clutch-${k}`, hideWhenBlocked: true,
  requires: [...also, ...(['g', 'b', 'r'] as const).map((c) => (k.includes(c)
    ? { kind: 'notFlag' as const, flag: DENS[c].flag }
    : { kind: 'flag' as const, flag: DENS[c].flag }))],
  ...(effects ? { effects } : {}),
}));
const broodScenes = (): Record<string, Scene> => Object.fromEntries(BROODS.map((k) => {
  const parts = [...k].map((c) => `the ${DENS[c as keyof typeof DENS].name} ${DENS[c as keyof typeof DENS].from}`);
  const intro = k.length === 1
    ? `One wyrmling comes over the rim alone: ${parts[0]}, from the one den you left standing. It is all the brood the stone has left, and it is furious about it.`
    : `${k.length === 2 ? 'Two' : 'Three'} wyrmlings come over the rim together: ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}. Every den you left standing has answered the stone.`;
  const id = `clutch-${k}`;
  return [id, {
    id, kind: 'battle', encounterId: `den-clutch-${k}`, mapId: 'open', intro: [intro],
    onWin: { to: 'ridge-quiet', text: [`${k.length === 1 ? 'The' : 'The last'} wyrmling drops out of the bruised light and does not get up. The stone\'s note wavers, as if it has just counted how few voices are still answering it.`],
      // Each wyrmling killed on the rim is no longer waiting in its den to be
      // killed again. No tally: the night is already judged (see PEAK_NOW).
      effects: [...k].map((c) => ({ kind: 'setFlag' as const, flag: DENS[c as keyof typeof DENS].flag })) },
  } satisfies Scene];
}));

/**
 * The party's answer to the sisters at the stone, to {nettle}'s "Sister-killers"
 * (or "Binders", to a company that bound the {reedwife} in Part 1). Every
 * reply is worded true of both.
 * None is the right one: each buys something and costs something, and the
 * scene's last lines (the sisters' tells) are the clue to which answer reaches whom.
 *   - rueful ("sorry"): owns the wrong. Opens the vigil (`vigil-rueful`) on
 *     its easiest plain ask, but {nettle} takes it as a debt owned and digs in
 *     to collect it: dragging them out is harder (`tear-loose-rueful`).
 *   - unknowing ("we didn't know"): the truth, for every company. Opens the
 *     vigil too (`vigil-unknowing`), on a harder plain ask, since it is not an
 *     apology; the stone is faced as it stands (`tear-loose`).
 *   - defiant ("we owe you nothing"): {nettle} rages, and her grip slips:
 *     dragging her out is easiest of all. But she sings louder (breaking the
 *     song is harder), and {sedge} stops listening: no vigil.
 *   - cold (a drawn blade): {sedge} flinches, so dragging her out is easier,
 *     and no one will hear another word: no vigil.
 *   - sold ("{vargan} sold her the water"): names the chief's sale, which
 *     {sedge} has been brooding on since `calling-approach`. Only a company
 *     that knows what became of him (a cold start has no fate for him). If he
 *     lives (`spared`) {sedge} turns to listen: the vigil opens
 *     (`vigil-sold`) on the rueful answer's ask, but {nettle} has a second
 *     name to collect from and sings louder (`tear-loose-sold`: the song is
 *     harder, the haul is plain). If the company killed him (`dead`), the
 *     sale is already paid for, and by the same hands: no vigil, and the
 *     stone as it stands (`answer-sold-dead`).
 * Routed by scene, not by flag, so an answer costs the reach search nothing.
 * A company that cut the captives out of the {ashfang} pens (Part 1) says so
 * in its defiance (`answer-defiant`). No XP rides on the way down (see goDown),
 * so no level-up lands between an answer and its reply.
 */
const REPLIES = [
  { id: 'defiant', to: 'answer-defiant',
    // True for any company, a cold start too (the pen itself is Part 1's,
    // and only a company that opened it says so; see `answer-defiant`).
    label: '"She fed on the people of this valley. We owe you nothing."' },
  { id: 'rueful', to: 'answer-rueful',
    // Its cost is said aloud before the answer (`calling-approach`: "Say you
    // owe it, and I will hold on until it is paid"): owning the debt digs
    // {nettle} in (`tear-loose-rueful`).
    label: '"The vigil broke on our watch. We know, and we\'re sorry for that part."' },
  { id: 'unknowing', to: 'answer-unknowing',
    label: '"We didn\'t know what she was keeping. No one in the valley did."' },
  { id: 'cold', to: 'answer-cold',
    label: 'Say nothing, and draw' },
] as const;
// Answered once: a company that falls back and climbs again goes to
// `calling-return`, not back through the sisters' greeting.
const SOLD = '{vargan} sold her that water, and the people off the marsh road with it.';
const SOLD_REPLIES: Choice[] = [
  { id: 'sold', label: `"${SOLD} He lives, and cuts reeds in it."`, to: 'answer-sold',
    requires: [{ kind: 'npc', npc: 'vargan', fate: 'spared' }], hideWhenBlocked: true },
  { id: 'sold-dead', label: `"${SOLD} We killed him for it."`, to: 'answer-sold-dead',
    requires: [{ kind: 'npc', npc: 'vargan', fate: 'dead' }], hideWhenBlocked: true },
];
const replyChoices: Choice[] = REPLIES.flatMap((r) => [{ id: r.id, label: r.label, to: r.to },
  ...(r.id === 'unknowing' ? SOLD_REPLIES : [])]);
/**
 * `tear-loose` spends every approach it tries, for good. So a company that
 * loses the fight after it and climbs back must not walk into it again with
 * nothing left to try. It goes straight back to whichever fight it earned.
 *
 * A door that shut cracked in Part 2 (`sunken-barrows:seal-cracked`) lands
 * here: the stone sings down to it, and the Warden's dead come up through the
 * cracks in the bowl. Each scene past the answer has a cracked twin (its id
 * plus CRACK), where grey hands hold the company's ankles as the fight starts.
 * The flag is carried, so it costs no fact: the search runs once with the
 * door cracked and once without.
 */
const LOOSE: Effect[] = [{ kind: 'setFlag', flag: 'sisters-loose' }];
/** Beaten at the stone: up onto the rim, where the column is (`stone-lost`).
 *  Hauling the company out costs {vex}'s column pikemen (RIM_DEAD, a count
 *  read only by the ending's slides, so the reach search never sees it). */
const RIM_DEAD = 'rim-dead';
const RIM_COST: Effect[] = [{ kind: 'addFlag', flag: RIM_DEAD, amount: 1 }];
const STONE_LOST_SISTERS = { to: 'stone-lost', effects: RIM_COST,
  text: ['Green claws close over you, and the last thing you hear is {nettle} adding it to the account.'] } satisfies Outcome;
const STONE_LOST_CALLING = { to: 'stone-lost', effects: RIM_COST,
  text: ['The rock bucks under you like a struck bell, and the {calling}\'s note goes on singing after the light goes out.'] } satisfies Outcome;
const CRACKED = 'sunken-barrows:seal-cracked';
const CRACK = '-cracked';
/** A way on to the stone, in a sound version and a cracked one. */
const toStone = (id: string, label: string, to: string, requires: Requirement[]): Choice[] => [
  { id, label, to, hideWhenBlocked: true, requires: [...requires, { kind: 'notFlag', flag: CRACKED }] },
  { id: id + CRACK, label, to: to + CRACK, hideWhenBlocked: true, requires: [...requires, { kind: 'flag', flag: CRACKED }] },
];
/** On to the stone after an answer: into `tear` (the answer's own version of
 *  `tear-loose`), or back to the fight a company fell back from. */
const stoneChoices = (tear = 'tear-loose'): Choice[] => [
  ...toStone('on', 'Tear them out of the stone', tear,
    [{ kind: 'notFlag', flag: 'sisters-loose' }, { kind: 'notFlag', flag: 'stone-spent' }]),
  ...toStone('loose', 'Face the sisters again', 'sisters-battle', [{ kind: 'flag', flag: 'sisters-loose' }]),
  ...toStone('spent', 'Face what the stone called up', 'calling-battle', [{ kind: 'flag', flag: 'stone-spent' }]),
];
const TO_STONE = stoneChoices();

/**
 * WAR ASSETS: what Parts 1–2 are worth at the end.
 *
 * At the war council on the rim, before the company goes down into the bowl,
 * Vex brings the forward column up (`war-council`), and whoever owes the
 * company comes with it:
 *   - Wren (she lived, or walked the fen with you; any company she holds no
 *     grudge against) — joins, a scout, and at her warmest she brings the
 *     stone's weak seam, found alone while the column digs in (WREN_FOLLOWS);
 *   - Brother Halden (fate `saved`) — joins, a priest;
 *   - Hask, Vex's guard (Vex's fate `turned`) — joins, a veteran;
 *   - the fen-folk (the valley's regard at 2 or more; see REGARD) — ropes:
 *     an easier way to drag the sisters out of the stone at `tear-loose`.
 * There is always a council, whoever is owed a seat: going down alone is
 * always one way out of it. Leaving the council sets `rim-clear`, so a company
 * that comes back up after a defeat walks straight down. Who goes down is the
 * way out of the council: one choice per group (alone, any one, or any pair;
 * two seats, no more), so the cap costs the reachability search no facts.
 *
 * Two more debts are paid at the war-camp:
 *   - the carter from the Ashfang pens (`captives-freed`) — potions, at his
 *     map marker. Its scene is the gift, and a company not owed it (or
 *     already paid) is turned aside to a "nothing here for you" beat;
 *   - Reeve Aldous's watch (the valley's regard at 1 or more; see WATCH) —
 *     two ticks on the camp's tally, posted from the muster.
 */
const has = (flag: string): Requirement => ({ kind: 'flag', flag });
const hasNot = (flag: string): Requirement => ({ kind: 'notFlag', flag });
/**
 * The valley's regard (docs/state-ledger.md): a tally of 0 to 3, one for each
 * deed in Part 2 that kept faith with {thornwick}. Read only in its bands (0,
 * 1, 2 or more), never by which deed earned it: at 1 Reeve {aldous} sends
 * {thornwick}'s watch to the war-camp (WATCH), and at 2 the fen-folk bring
 * their ropes to the war council as well. A count, so the reach search takes it as possible either
 * way, and it is carried, so it costs no fact.
 */
const REGARD = 'sunken-barrows:regard';
const regard = (band: { atLeast?: 1 | 2; below?: 1 | 2 }): Requirement => ({ kind: 'count', flag: REGARD, ...band });

/**
 * The night the Calling peaks (see DAWNS), everything left in the hills comes
 * down on the war-camp at once, as Vex promised. The first time the company
 * is back at the camp after it, whichever marker it taps, it sees how that
 * night went, by the tally as it stood that morning (PEAK_TALLY, not the live
 * count): held easily or at a cost (`peak-night`), or nearly
 * broken, with the last of it still at the east line (`peak-line`, a fight).
 * `peak-seen` makes it once. It is set as a count (`value: 1`), so the reach
 * search leaves it untracked and takes the redirect as possible either way;
 * both beats only lead back to the camp, so that can never hide a dead end,
 * and it keeps the search half the size. What the company saw (`peak-easy` /
 * `peak-cost` / `peak-broke`) is read only by the ending's slides.
 */
const PEAK_WHEN: Array<{ if: Requirement[]; to: string }> = [
  { if: [has('calling-peaked'), hasNot('peak-seen'), hasNot('rim-clear'), has(PEAK_HELD)], to: 'peak-night' },
  { if: [has('calling-peaked'), hasNot('peak-seen'), hasNot('rim-clear')], to: 'peak-line' },
];

/**
 * The {calling} peaks the night the company first comes over the last ridge,
 * as {vex} warned (or on the sixth morning, for a company that never gets
 * there: see DAWNS). The ridge (`calling-gate`, `calling-gate-clear`) shows
 * the company that night from above, read off the live tally, and the way off
 * the ridge freezes the tally (PEAK_SNAPSHOT) and spends the night
 * (`passDay`). So the tally always decides the brood on the rim (the dens
 * left standing) and the night at the camp, which {vex} reports at the war
 * council. Nothing ticks the tally after the ridge (the optional threats are
 * gone from their posts, and the brood's kills do not count), so a sixth
 * morning after it snapshots the same count again.
 *
 * A night that goes well warms {wren}: her riders were on the east line. The
 * live tally on that step is the snapshot it takes, so `peakWays` splits the
 * way off the ridge on it: one version with the warmth, one without, and the
 * plain one for a ridge reached after the sixth morning. Only a {wren} who
 * walked the fen with the company in Part 2 (every company that won it)
 * warms to what it did in the hills; a cold start's {wren} has never walked
 * with it, and a good night warms her to the war-camp, not to strangers
 * (WREN_KNOWS). Part 2's `won` is carried, so reading it costs the reach
 * search nothing.
 */
const WREN_KNOWS: Requirement = { kind: 'flag', flag: 'sunken-barrows:won' };
const WREN_NEW: Requirement = { kind: 'notFlag', flag: 'sunken-barrows:won' };
const WREN_WARMS: Effect = { kind: 'npc', npc: 'wren', attitude: 1 };
/** Set (as a count, untracked) when the ridge gave that warmth, so the
 *  morning after at the camp (`peak-night`) gives it only if the ridge did
 *  not: a sixth morning can peak the {calling} before the ridge is reached. */
const WREN_WARMED = 'wren-warmed';
const warmedOnRidge = (yes: boolean): Requirement => ({ kind: 'count', flag: WREN_WARMED, ...(yes ? { atLeast: 1 } : { below: 1 }) });
const PEAK_NOW: Effect[] = [{ kind: 'setFlag', flag: 'calling-peaked' }, ...PEAK_SNAPSHOT, { kind: 'passDay' }];
const peakWays = (ways: (effects: Effect[], also: Requirement[]) => Choice[]): Choice[] => {
  const found: Effect = { kind: 'setFlag', flag: 'calling-found' };
  const tag = (suffix: string) => (c: Choice): Choice => ({ ...c, id: `${c.id}${suffix}` });
  return [
    ...ways([found, ...PEAK_NOW, WREN_WARMS, { kind: 'setFlag', flag: WREN_WARMED, value: 1 }],
      [hasNot('calling-peaked'), tallyAtLeast(TALLY_HIGH), WREN_KNOWS]).map(tag('-night-held')),
    ...ways([found, ...PEAK_NOW], [hasNot('calling-peaked'), tallyAtLeast(TALLY_HIGH), WREN_NEW]).map(tag('-night-held-new')),
    ...ways([found, ...PEAK_NOW], [hasNot('calling-peaked'), hasNot(TALLY)]).map(tag('-night')),
    ...ways([found], [has('calling-peaked')]),
  ];
};
/** The ridge, first sight: the stone; then, unless the sixth morning got
 *  there first, the sisters seeing the company, and the night of the {calling}
 *  watched from the ridge, by the live tally (which the way off it freezes). */
const RIDGE_SIGHT: Para[] = [
  'You reach the last ridge. The {calling} is not a pull any more. It is a pressure, a note held so long that the mountain hums it back at you. Beyond the ridge, a bowl of bare rock opens under the sky. At its centre stands the **stone**: a single black fang of rock, wrapped in a bruise-coloured light.',
  { if: [hasNot('calling-peaked')],
    text: 'Down in the bowl, two tall green women at the foot of the stone lift their heads. They have seen you. The note climbs, and climbs, and does not come down. The {calling} is peaking.' },
];
const NIGHT_FALLS = 'Behind you, everything still loose in the hills turns at once and starts down toward the war-camp. You hold the ridge through the night, and watch.';
const RIDGE_NIGHT: Para[] = [
  { if: [hasNot('calling-peaked'), tallyAtLeast(TALLY_HIGH)],
    text: `${NIGHT_FALLS} Not much of it reaches the camp. The horns sound twice, and the torches on the east line never waver. By midnight the camp is quiet.` },
  { if: [hasNot('calling-peaked'), { kind: 'count', flag: TALLY, atLeast: TALLY_HALF, below: TALLY_HIGH }],
    text: `${NIGHT_FALLS} It reaches the camp in a wave, and the horns sound until dawn. Torches go out along the east line one at a time. Someone runs to light them again.` },
  { if: [hasNot('calling-peaked'), { kind: 'count', flag: TALLY, below: TALLY_HALF }],
    text: `${NIGHT_FALLS} There is too much of it. The torches on the east line go out one after another, and stay out. The horns sound until long after midnight, and then they stop.` },
  // The toll bought the pass, not the warband (see `onihold-paid`).
  { if: [hasNot('calling-peaked'), has('oni-paid')],
    text: 'One column on the slope below kept step the whole way down, with a horn at its head. It was the ogre-mage\'s warband, out of the pass you paid for, and it went straight at the east line.' },
];

/**
 * Vex's map in the command tent, after the briefing: how many of the hills'
 * threats are pinned (the tent's marker routes by the tally, see TALLY), and
 * which wyrm dens still stand. One den line shows, picked from every mix of
 * dens cleared, before and after the Calling peaks. Text only, so free.
 */
const TENT_OPEN = 'The command tent works on. Guard posts, rations, and the slow business of keeping frightened people pointed the right way. Captain {vex} puts a pin on his map for every threat you deal with up in the hills. He keeps them in a neat little row.';
const DEN_LIST = (['g', 'b', 'r'] as const);
const denLines = (): Para[] => {
  const lines: Para[] = [{ if: DEN_LIST.map((c) => has(DENS[c].flag)),
    text: '"And all three dens are burned out," {vex} says. "No wyrm is coming down this slope. I never thought I\'d get to say that."' }];
  for (let mask = 1; mask < 8; mask++) {
    const standing = DEN_LIST.filter((_, i) => mask & (1 << i));
    const names = standing.map((c) => DENS[c].name);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    const many = standing.length > 1;
    const dens = DEN_LIST.map((c) => (standing.includes(c) ? hasNot(DENS[c].flag) : has(DENS[c].flag)));
    lines.push({ if: [...dens, hasNot('calling-peaked')],
      text: `His finger moves to the dens. "The ${list} ${many ? 'dens' : 'den'}. Still standing."` });
    lines.push({ if: [...dens, has('calling-peaked')],
      text: `His finger moves to the dens. "The ${list} ${many ? 'dens are' : 'den is'} empty now. ${many ? 'Those wyrms' : 'That wyrm'} flew up to the rim when the {calling} peaked. You'll meet ${many ? 'them' : 'it'} there."` });
  }
  return lines;
};
/** `before` is how the hills stand while the night of the Calling is still
 *  coming; `after`, once the camp has been through it. */
/** How the night went, as the company saw it the morning after (the tent's
 *  marker shows `peak-night` / `peak-line` first, so these are always set by
 *  the time the tent shows `after`). Read off the snapshot, not the live row. */
const TENT_NIGHT: Para[] = [
  { if: [has('peak-easy')], text: 'He taps the east line. "And the night went our way. I didn\'t bury anyone."' },
  { if: [has('peak-cost')], text: 'He taps the east line. "We got through the night. It cost us more than I like."' },
  { if: [has('peak-broke')], text: 'He taps the east line. "We nearly didn\'t get through it. You saw what was left."' },
];
const tentScene = (id: string, row: string, before: string, after: string): Scene => ({
  id, kind: 'story', art: { emoji: '🗺️' }, noBack: true,
  text: [TENT_OPEN,
    { if: [hasNot('calling-peaked')], text: `${row} ${before}` },
    { if: [has('calling-peaked')], text: `${row} ${after}` },
    ...TENT_NIGHT,
    ...denLines()],
  next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
});
/** Down into the bowl: through the council the first time, straight down after. */
const goDown = (effects: Effect[] = []): Choice[] => {
  const fx = effects.length ? { effects } : {};
  return [
    { id: 'down', label: 'Go down into the bowl', to: 'calling-approach', hideWhenBlocked: true,
      requires: [has('rim-clear'), hasNot('sisters-loose'), hasNot('stone-spent')], ...fx },
    // Back after falling back or a defeat: the sisters have had their say, so
    // the party goes straight back to the fight it left (see TO_STONE).
    { id: 'back-loose', label: 'Go back down into the bowl', to: 'calling-return', hideWhenBlocked: true,
      requires: [has('rim-clear'), has('sisters-loose')], ...fx },
    { id: 'back-spent', label: 'Go back down into the bowl', to: 'calling-return', hideWhenBlocked: true,
      requires: [has('rim-clear'), has('stone-spent')], ...fx },
    // The first time: through the war council (see SEATS).
    { id: 'down-council', label: 'Go down into the bowl', to: 'war-council', hideWhenBlocked: true,
      requires: [hasNot('rim-clear')], ...fx },
  ];
};
/** Who is owed a place beside the company, and why (`owed`: any one of these
 *  holds; they never overlap; `effects` ride on that one's way down). Wren:
 *  any company she does not hold a grudge against (her `attitude`, built over
 *  Parts 1–2; a cold start is 0). She lived in Part 1, or walked the fen with
 *  you in Part 2; a cold start meets her at the war-camp as a stranger, and
 *  she takes a seat as the camp's scout. Below 0 she stays on the rim (see `war-council`). At 2 or more
 *  (warm) she has already been down into the bowl alone, and she brings
 *  what she found there (WREN_FOLLOWS). A good night at the
 *  camp warms a {wren} who knows the company by one on the way to the
 *  council (see peakWays); a cold start's stays at 0. The
 *  search takes an attitude gate as open and shut, so going down alone,
 *  always offered, keeps the way on. */
type Owed = { requires: Requirement[]; effects?: Effect[] };
const SEATS: Record<string, { name: string; who: string; role: string; owed: Owed[]; journal: { id: string; title: string; body: string } }> = {
  wren: { name: '{wren}', who: 'who has mapped every pass you cleared', role: 'a scout',
    owed: [
      // Warm (2 or more), she brings the seam she chalked.
      { requires: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 0, below: 2 } }] },
      { requires: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }],
        effects: [{ kind: 'setFlag', flag: WREN_FOLLOWS, value: 1 }] },
    ],
    journal: { id: 'n-wren3', title: '{wren}, Chief of Scouts',
      body: '{wren} climbed up with the column and went down into the bowl with you. Somebody, she says, has to write the route report.' } },
  halden: { name: 'Brother {halden}', who: 'his prayer book under his arm', role: 'a priest',
    owed: [{ requires: [{ kind: 'npc', npc: 'halden', fate: 'saved' }] }],
    journal: { id: 'n-halden3', title: 'Brother {halden}',
      body: '{halden} climbed the whole mountain with his prayer book under his arm, to say his rites at the stone. A door\'s a door, he says, whether it\'s under a fen or inside a rock.' } },
  hask: { name: '{hask}', who: 'the chief\'s old guard, who answers to {vex}', role: 'a veteran',
    owed: [{ requires: [{ kind: 'npc', npc: 'vex', fate: 'turned' }] }],
    journal: { id: 'n-hask', title: '{hask}, {vex}\'s Sergeant',
      body: '{hask} was the {ashfang} chief\'s own guard, but he answered to {vex}. The night you came for {vargan}, {hask} found somewhere else to be. Now {vex} has lent him to you for the stone.' } },
};
type Seat = 'wren' | 'halden' | 'hask';
const SEAT_IDS: Seat[] = ['wren', 'halden', 'hask'];
/** Every way to fill (up to) two seats from what each seat's `owed` allows. */
const product = (lists: ReadonlyArray<ReadonlyArray<Owed>>): Owed[] =>
  lists.reduce<Owed[]>((acc, l) => acc.flatMap((a) => l.map((o) => ({
    requires: [...a.requires, ...o.requires], effects: [...(a.effects ?? []), ...(o.effects ?? [])] }))), [{ requires: [] }]);
/**
 * The way out of the council, and always the company's choice: go down alone,
 * with any one companion owed a seat, or with any two of them (never more).
 * Each group shows whenever every member of it is owed a seat.
 */
const escortChoices = (): Choice[] => {
  const groups: Seat[][] = [[], ...SEAT_IDS.map((c) => [c]),
    ...SEAT_IDS.flatMap((c, i) => SEAT_IDS.slice(i + 1).map((d) => [c, d]))];
  return groups.flatMap((g) => {
    const names = g.map((c) => `${SEATS[c]!.name}, ${SEATS[c]!.who}`).join(', and ');
    const label = g.length === 0 ? 'Let them hold the rim while you go down' : `Go down into the bowl with ${names}`;
    return product(g.map((c) => SEATS[c]!.owed)).map((owed, i): Choice => ({
      id: `go-${g.join('-') || 'alone'}-${i}`, label, to: 'calling-approach', hideWhenBlocked: true,
      requires: owed.requires,
      effects: [{ kind: 'setFlag', flag: 'rim-clear' }, ...(owed.effects ?? []),
        // Taking {wren} down, rather than leaving her on the rim: she warms to it.
        ...g.flatMap((c): Effect[] => [{ kind: 'joinParty', companion: c },
          ...(c === 'wren' ? [{ kind: 'npc' as const, npc: 'wren', attitude: 1 }] : []),
          { kind: 'journal', entry: { kind: 'npc', ...SEATS[c]!.journal } }])],
    }));
  });
};
/** Every mix of who is owed a seat, by the first of each seat's `owed` (and
 *  its opposite), with how many that is: for {vex}'s send-off. */
const SEAT_NOT_OWED: Record<Seat, Requirement[]> = {
  wren: [{ kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
  halden: [{ kind: 'npc', npc: 'halden', notFate: ['saved'] }],
  hask: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }],
};
const SEAT_IS_OWED: Record<Seat, Requirement[]> = {
  wren: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 0 } }],
  halden: [{ kind: 'npc', npc: 'halden', fate: 'saved' }],
  hask: [{ kind: 'npc', npc: 'vex', fate: 'turned' }],
};
const SEAT_OWED_MIXES = Array.from({ length: 7 }, (_, i) => i + 1).map((mask) => {
  const owed = SEAT_IDS.filter((_, b) => mask & (1 << b));
  return { owed, requires: SEAT_IDS.flatMap((c) => (owed.includes(c) ? SEAT_IS_OWED[c] : SEAT_NOT_OWED[c])) };
});
/** How {vex} offers the seats: by name when only one is owed. */
const VEX_ONE_SEAT: Record<Seat, string> = {
  wren: '"Take {wren} down with you, if she\'ll go. A big party\'s a loud one, so no one else."',
  halden: '"Take Brother {halden} down with you, if he\'ll go. A big party\'s a loud one, so no one else."',
  hask: '"Take {hask} down with you. I can spare him for a morning. A big party\'s a loud one, so no one else."',
};
const vexSeats = (owed: Seat[]): string => (owed.length === 1 ? VEX_ONE_SEAT[owed[0]!]
  : owed.length === 2 ? '"Take one of them down with you, or both. A big party\'s a loud one."'
    : '"Take one of them down with you, or two, but no more. A big party\'s a loud one."');
const COUNCIL: Choice[] = [
  { id: 'ropes', label: 'Take the fen-folk\'s drowning-ropes',
    // `war-council` and `war-council-table` share this list, and `once` is
    // per scene: the shared attempt makes it once across both.
    to: 'war-council-table', attempt: 'fen-ropes', hideWhenBlocked: true, requires: [regard({ atLeast: 2 })],
    effects: [{ kind: 'setFlag', flag: 'fen-ropes' },
      { kind: 'journal', entry: { id: 'c-ropes', kind: 'clue', title: 'The Fen-Folk\'s Ropes',
        body: 'The fen-folk sent {rope-bearers} up the mountain with coils of drowning-rope, braided for hauling people out of deep water. Loop them round the sisters and pull.' } }] },
  ...escortChoices(),
];

/** The fen-folk's hedge-witch, drawn so she works whether or not the company
 *  ever sat at the regulars' table in Mira's inn and heard her talk spells. */
const FENFOLK_WITCH = 'The fen-folk keep their own small fire at the edge of the camp, with their boar-spears stacked beside it. By it sits the old hedge-witch from the regulars\' table at {mira}\'s inn, with river-stones in her hair. She knits while she talks, and she does not look up.';

/** The witch's point: the people the Ashfang penned for the Reedwife were her
 *  own greed (and the chief's sale), not the door's price. (The price itself, a lamb a winter, is
 *  Nettle's to tell, at the stone.) */
const FENFOLK_PRICE = '"Those poor souls the {ashfang} penned up for her? That was the {reedwife}\'s own greed, and their chief was glad to sell them to her," she says. "The door never asked for them. Now her sisters want feeding too, and they want the whole valley."';

/** Mira at the feast, by {wren}'s regard (below 0 or not): a company that
 *  left {wren} with a grudge has had its doings told in Mira's taproom since. A cold start gets her barrel,
 *  and no history: she is neither warm nor cold with it. */
const MIRA_BARREL = '{mira}, who keeps the {wander-inn} down in {thornwick}, has hauled a barrel all the way up to the camp.';
const MIRA_TOAST: Para[] = [
  { if: [has('sunken-barrows:won'), { kind: 'npc', npc: 'wren', attitude: { atLeast: 0 } }],
    text: `${MIRA_BARREL} She fills your cup before you can reach for your purse. "Three times now," she says. "People will start to expect it."` },
  { if: [has('sunken-barrows:won'), { kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
    text: `${MIRA_BARREL} She pours for the pikemen first. When she gets to you, she fills your cup and holds out her hand for the coin, the same as anyone's.` },
  { if: [hasNot('sunken-barrows:won')],
    text: `${MIRA_BARREL} The whole camp drinks from it tonight. She fills your cups as she fills everyone's, and she nods to you as she passes.` },
];

/**
 * The ending slides. Each ending is its own opening text, then SLIDES_HILLS,
 * its own slide for the door under the fen, SLIDES_PEOPLE, a line for Halden
 * if he came down into the bowl, and SLIDES_LAST, which closes on Wren. Every
 * slide is a fate told through a thing or a gesture, never a list of what the
 * company did, so a route sees eight to twelve of them in all (a cold start
 * about nine, a company that did everything about twelve).
 */
type Slide = { if: Requirement[]; text: string };
const SLIDES_HILLS: Slide[] = [
  // The hills' threats that were talked off the mountain rather than killed.
  { if: [{ kind: 'flag', flag: 'green-sent' }],
    text: 'Somewhere past the far hills, a green dragon is growing up. It still flinches at the sound of the dragon tongue.' },
  { if: [{ kind: 'flag', flag: 'manticore-sent' }],
    text: 'The manticore never came back to its cliff. Shepherds say it circled the broken stone for a week, shouting for the meal the hags swore to give it.' },
  { if: [{ kind: 'flag', flag: 'ettin-split' }],
    text: 'Hunters still hear the ettin some nights, far off in the high hills. It is still arguing with itself about the valley.' },
  // The night of the Calling (see DAWNS, PEAK_WHEN), by the snapshot the
  // morning after shows (`peak-night` / `peak-line` set `peak-easy` /
  // `peak-cost` / `peak-broke` on exactly these bands). Worded true whether
  // or not the company came back to the camp to see it.
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, peakAtLeast(TALLY_HIGH)],
    text: 'After the {calling}\'s last night, {bram} tried to sell the army back its own arrows. Hardly anyone had loosed one.' },
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'flag', flag: PEAK_HELD }, { kind: 'notFlag', flag: PEAK_TALLY }],
    text: 'The pikemen still keep the list of names from the {calling}\'s last night. Once a year they stand where the torches went out, and read it aloud.' },
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'notFlag', flag: PEAK_HELD }],
    text: 'The beasts you left in the hills nearly broke the war-camp. The funeral fires burned in a long row the next morning, and the camp-clerk wrote down every name.' },
  // What became of Vargan (Part 1): one line for each ledger value.
  { if: [{ kind: 'npc', npc: 'vargan', fate: 'dead' }],
    text: 'The reed-cutters are back in the shallows {vargan} sold, cutting reeds for a copper a bundle. They never say his name.' },
  { if: [{ kind: 'npc', npc: 'vargan', fate: 'spared' }],
    text: '{vargan} still cuts reeds in the shallows he sold. During the {calling}\'s last week, a sack of reed-arrows turned up at the war-camp gate, and nobody saw who left it.' },
];
const SLIDES_PEOPLE: Slide[] = [
  { if: [{ kind: 'npc', npc: 'vex', fate: 'turned' }],
    text: '{vex} keeps the reeve\'s pardon folded in his coat. He has opened it so often that the creases have gone soft.' },
  // No deal (a cold start too): he held the valley on the reeve's hard terms.
  { if: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }],
    text: 'In the autumn the reeve sends {vex} his pardon, sealed in red wax, as the bargain said. {vex} has never opened it. It hangs on a nail by his cot, where he can see it from his pillow.' },
  // What became of Marrow, the gravedigger at the Warden's door (Part 2).
  { if: [{ kind: 'npc', npc: 'marrow', fate: 'sings' }],
    text: 'Word comes up from {saltmere} that a grey old gravedigger has mended {saltmere-graves} there. While the stone sang, he sat up among them every night with a lamp, saying the rites, in case anyone woke.' },
  { if: [{ kind: 'npc', npc: 'marrow', fate: 'bound' }],
    text: '{marrow} still mends {thornwick}\'s churchyard on the reeve\'s orders. While the stone sang, he sat up among the graves every night with a lamp, in case anyone woke.' },
  // Halden at home; each ending has its own line for a Halden who came down.
  { if: [{ kind: 'npc', npc: 'halden', fate: 'saved' }, { kind: 'noCompanion', companion: 'halden' }],
    text: 'Brother {halden} climbs to the bowl each spring to bless the broken stone, and then he walks home to his little chapel.' },
  // The reeve's thanks, in his own key, and his watch if it came (see COUNCIL).
  { if: [{ kind: 'notFlag', flag: 'watch-holds' }],
    text: 'Down in {thornwick}, the reeve orders a plaque for the square. He has the wording changed twice.' },
  { if: [{ kind: 'flag', flag: 'watch-holds' }, { kind: 'flag', flag: 'calling-peaked' }],
    text: '{thornwick}\'s watch stood at the thin end of the east line on the {calling}\'s last night. Reeve {aldous} has every man\'s name cut into a plaque for the square, and he has the wording changed twice.' },
];
/** The last slides, building to Wren: the companions the council sent down
 *  (see COUNCIL), the carter's girl, and then one line of what {wren} made
 *  of the company over three chapters (her `attitude`), which always shows. */
const SLIDES_LAST: Slide[] = [
  { if: [{ kind: 'companion', companion: 'hask' }],
    text: '{hask} went back to {vex}\'s side with a new scar and a better story, and {vex} pretends to be tired of hearing it.' },
  { if: [{ kind: 'companion', companion: 'wren' }],
    text: '{wren}\'s route report of the climb to the stone runs to eleven pages. It is the only report in the camp that admits anybody felt afraid.' },
  { if: [{ kind: 'flag', flag: 'mules-unloaded' }],
    text: 'The carter from the {ashfang} pens drives the last wagon home to {thornwick}. The girl in her new shoes rides on top.' },
  { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }, { kind: 'npc', npc: 'wren', attitude: { atLeast: 0, below: 2 } }],
    text: '{wren} still limps on cold mornings, and she tells every new scout how you lifted a dead horse off her leg.' },
  // A company she walked the fen with in Part 2; a cold start's {wren} met
  // it at the war-camp (WREN_NEW).
  { if: [{ kind: 'npc', npc: 'wren', notFate: ['saved'] }, WREN_KNOWS, { kind: 'npc', npc: 'wren', attitude: { atLeast: 0, below: 2 } }],
    text: '{wren} tells every new scout how she walked the fen with you as far as the barrows, and how you walked back out.' },
  { if: [WREN_NEW, { kind: 'npc', npc: 'wren', attitude: { atLeast: 0, below: 2 } }],
    text: '{wren} draws the road to the stone for every new scout. She marks the place where your company went down into the bowl, and the place it came back up.' },
  { if: [{ kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
    text: '{wren} keeps a list of the people she would follow anywhere. It is a short list, and she has never said whether you are on it.' },
  { if: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }],
    text: '{wren} keeps a short list folded in her bracer. It is the people she would follow anywhere. Your names are at the top, in her best hand.' },
];

const TEAR_OPEN = 'The sisters have sunk their hands to the wrist in the black rock, and the stone is drinking them down. A crack of fire opens across the floor of the bowl. Something huge is climbing up out of it.';
/** After the defiant answer {nettle}'s hands came half out of the rock (see
 *  `answer-defiant`), so the stone has only {sedge} to the wrist. */
const TEAR_OPEN_DEFIANT = '{sedge} has her hands sunk to the wrist in the black rock, and the stone is drinking her down. {nettle}\'s hands are only half in it, and they shake with her temper. A crack of fire opens across the floor of the bowl. Something huge is climbing up out of it.';
/** What is at stake, in Nettle's voice: out of the rock they are only two
 *  hags; left in it, the stone spends them on the cataclysm. */
const TEAR_STAKES = '{nettle} sees you looking at her wrists, and she laughs. "Pull, then. The mountain has more of us than you have hands."';
/** The cracked door under the fen, answering the stone (see CRACKED). */
const TEAR_CRACKED = [
  'The floor of the bowl knocks under your boots: three slow knocks. You have felt that through stone before, with your hand on the {warden}\'s door. The stone is singing down into the ground, all the way to the cracked door under the barrows, and something down there is answering.',
  'Grey hands push up through the cracks around the stone. They catch at your ankles and hold on. The {warden}\'s dead have come up to hear the song.',
];
/**
 * Face the sisters, or let the stone spend them: a success means they fight
 * in person (`sisters`); every approach failing means the stone throws its
 * whole cataclysm at you instead (`calling`). Built for each answer's mood,
 * each twice: sound, and with the Warden's dead come up through the cracks
 * (see CRACKED).
 */
/** How the sisters took the company's answer (see REPLIES): a rueful one
 *  makes the haul harder, a defiant one makes {nettle} easy to drag and the
 *  song harder to break, a cold one makes {sedge} easy to drag, and naming
 *  the chief's sale makes the song harder. */
type TearMood = 'rueful' | 'defiant' | 'cold' | 'sold';
/** The haul without {hask}: plain, or as the answer left the sisters. `won`
 *  is its own success beat (the plain haul uses the challenge's). */
type Drag = { id: string; label: string; hint?: string; dc: number; won?: string; lost: string };
const DRAG: Record<TearMood | 'plain', Drag> = {
  plain: { id: 'drag', label: 'Drag their hands out of the rock', dc: 15,
    lost: 'The rock holds them fast. You let go with burned palms, and the stone keeps drinking.' },
  // You owned the debt, and {nettle} means to collect it.
  rueful: { id: 'drag', label: 'Drag their hands out of the rock', hint: '{nettle} has sunk her hands past the wrist now.', dc: 17,
    lost: '{nettle} smiles at you the whole time you pull. You let go with burned palms.' },
  // The defiant answer: {nettle} rages, and her grip slips.
  defiant: { id: 'drag-nettle', label: 'Drag {nettle} out while she rages', hint: 'She is angrier than she is careful.', dc: 11,
    won: '{nettle} is still shouting when you take her wrists, and her hands come out of the rock before she knows it. She tears at you, screaming. {sedge} will not leave her sister alone with you, and she pulls free after her.',
    lost: '{nettle} stops shouting just in time. She drives her hands back into the rock, and her song climbs over your grunting.' },
  // The sale named: {nettle} only sings louder, and the haul is the plain one.
  sold: { id: 'drag', label: 'Drag their hands out of the rock', dc: 15,
    lost: 'The rock holds them fast. You let go with burned palms, and the stone keeps drinking.' },
  // The cold answer: {sedge} flinched at the drawn blade. Take her first.
  cold: { id: 'drag-sedge', label: 'Drag {sedge} out first', hint: 'She flinched when you drew steel. Take her wrists before she finds her nerve again.', dc: 12,
    won: '{sedge} does not pull back, not at first. By the time she does, her hands are out of the rock. {nettle} will not let her sister go alone, and she tears free after her, screaming.',
    lost: '{sedge} finds her nerve a moment too soon. She drives her hands back into the rock, and the stone keeps drinking.' },
};
const tearLoose = (id: string, intro: string[], sisters: string, calling: string, mood?: TearMood): Scene => {
  const drag = DRAG[mood ?? 'plain'];
  return {
    id, kind: 'challenge', art: { imageId: 'loc-mountain', emoji: '🗿' },
    intro,
    retry: 'perApproach',
    approaches: [
      { id: drag.id, label: drag.label, ...(drag.hint ? { hint: drag.hint } : {}), skill: 'athletics', dc: drag.dc,
        requires: [{ kind: 'noCompanion', companion: 'hask' }], hideWhenBlocked: true,
        ...(drag.won ? { success: { to: sisters, effects: LOOSE, text: [drag.won] } } : {}),
        failure: { to: id, text: [drag.lost] } },
      // Hask's way: the same haul, on a sergeant's count.
      { id: 'hask', label: 'Haul them out on {hask}\'s count', hint: 'He has called the step for twenty years. Pull when he says pull, and not before.',
        skill: 'athletics', dc: 11, requires: [{ kind: 'companion', companion: 'hask' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['{hask} plants his feet and counts the way a sergeant counts a drill. "Ready. Ready. *Pull.*" Everyone pulls on the same word, again and again. On the fifth pull the stone lets go. Both sisters tumble out across the rock, their burned hands curled like claws.'] },
        failure: { to: id, text: ['{hask} counts, and you all pull on the word. The stone pulls back harder. {hask} spits on his burned palms. "It\'s got better footing than we have."'] } },
      // The fen-folk's ropes, from the war council (see REGARD).
      { id: 'ropes', label: 'Haul them out with the fen-folk\'s ropes', hint: 'Loop a drowning-rope round each sister and pull, the way the fen-folk pull the living out of deep water.',
        skill: 'athletics', dc: 11,
        requires: [{ kind: 'flag', flag: 'fen-ropes' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['The ropes bite, and the whole company hauls together. The stone can hold against hands. It cannot hold against a rope the fen-folk braided to pull the drowned out of deep water. Both sisters come free with a sound like a boot pulled out of mud. They lie tangled in the wet rope, hissing.'] },
        failure: { to: id, text: ['The ropes smoke and part where they touch the stone. Two scorched ends hang from your hands.'] } },
      mood === 'defiant'
        // The defiant answer: Nettle sings louder, out of spite.
        ? { id: 'song', label: 'Sing a wrong note into the {calling}',
          skill: 'arcana', dc: 17,
          failure: { to: id, text: ['{nettle} hears your wrong note and sings right over it, louder. The {calling} never misses a beat.'] } }
        : mood === 'sold'
        // The sale named: Nettle has a second name to collect from.
        ? { id: 'song', label: 'Sing a wrong note into the {calling}',
          skill: 'arcana', dc: 17,
          failure: { to: id, text: ['{nettle} hums your wrong note back at you, pleased, and folds it into the song.'] } }
        : { id: 'song', label: 'Sing a wrong note into the {calling}',
          skill: 'arcana', dc: 15,
          failure: { to: id, text: ['Your wrong note goes into the song and vanishes. The {calling} swallows it and sings on.'] } },
      // Every company carried Halden's book down to the Warden's door, whether
      // he lived or not (a cold start is still the company that sealed the
      // barrows). A Halden who lived has his book back, and it is up on the rim
      // under his arm (see `war-council`): the company says the words from
      // memory. With Halden himself here, his way is better.
      { id: 'rites', label: 'Say {halden}\'s rites over the stone', hint: 'Its oldest words are for shutting doors.',
        skill: 'religion', dc: 11,
        requires: [{ kind: 'noCompanion', companion: 'halden' }, { kind: 'npc', npc: 'halden', notFate: ['saved'] }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['{halden}\'s old words fall on the stone like cold water on a hot pan. The black rock hisses and lets go. Both sisters stagger free with steam rising off their arms.'] },
        failure: { to: id, text: ['You lose the words halfway through. The book says to say them whole, and you did not.'] } },
      { id: 'rites-learned', label: 'Say {halden}\'s rites over the stone', hint: 'You heard them said at the {warden}\'s door. Their oldest words are for shutting doors.',
        skill: 'religion', dc: 11,
        requires: [{ kind: 'noCompanion', companion: 'halden' }, { kind: 'npc', npc: 'halden', fate: 'saved' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['You say {halden}\'s old words from memory, the whole of them. They fall on the stone like cold water on a hot pan. The black rock hisses and lets go. Both sisters stagger free with steam rising off their arms.'] },
        failure: { to: id, text: ['You lose the words halfway through, and the book that holds them is up on the rim.'] } },
      // Halden came down into the bowl: he says his own rites at the stone.
      { id: 'halden', label: 'Let {halden} say his rites over the stone', hint: 'He climbed the whole mountain to say them here.',
        skill: 'religion', dc: 8, requires: [{ kind: 'companion', companion: 'halden' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['Brother {halden} steps up to the stone and opens his book. He does not need it. He says the old words for shutting a door, the whole of them, in his own calm voice. The black rock hisses like a doused fire and lets go. Both sisters fall free at his feet, and {nettle} is already reaching for his throat.'] },
        failure: { to: id, text: ['{halden} gets halfway before the song finds the place in him the {warden} once held, and his voice shakes. "Not here," he whispers. "It\'s too loud here."'] } },
      // A wizard can read the old letters cut into the stone: easier than
      // breaking the song (Arcana DC 15), but still a real roll at the climax.
      { id: 'letters', label: 'Let your wizard read the old letters cut into the stone', hint: 'One line of them runs unbroken all the way round the stone.',
        skill: 'arcana', dc: 12,
        requires: [{ kind: 'classInParty', classId: 'wizard' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['Your wizard finds the line of old letters that binds the sisters in. One scratch of a knife point through the last letter, and the stone spits them both out.'] },
        failure: { to: id, text: ['The letters crawl and shift under your wizard\'s eyes. They will not hold still long enough to read.'] } },
      // A warlock knows how a pact is built, and how one breaks.
      { id: 'pact', label: 'Let your warlock offer the stone a better bargain', hint: 'Every pact has a way out.',
        skill: 'deception', dc: 13,
        requires: [{ kind: 'classInParty', classId: 'warlock' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['Your warlock speaks to the stone in a patron\'s voice, and promises it something better than two old hags. The stone believes it for one breath. That is long enough. It lets go of the sisters to reach for the new prize.'] },
        failure: { to: id, text: ['The stone has heard better offers. It keeps the sisters and goes on drinking.'] } },
      // Wren's way: a scout's eye finds the weak line for you. A Wren who
      // would follow the company anywhere found it already (WREN_FOLLOWS).
      { id: 'wren-chalk', label: 'Strike the seam {wren} chalked', hint: 'She walked round this stone alone and marked where the song leaks out.',
        skill: 'athletics', dc: 6, requires: [{ kind: 'companion', companion: 'wren' }, wrenFollows(true)], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['{wren} puts her hand flat on the stone, over a white chalk mark no wider than a thumb. "Here." You hit it with everything you have. The stone rings like a cracked bell and spits the sisters out onto the rock. {sedge} is up first, with her claws out.'] },
        failure: { to: id, text: ['Your blow lands a hand\'s width off the chalk. The stone shrugs it off. {wren} swears, and wipes the mark clean with her sleeve.'] } },
      { id: 'wren', label: 'Let {wren} find the stone\'s weak seam', hint: 'She has found the weak spot in every wall on this mountain.',
        skill: 'investigation', dc: 10, requires: [{ kind: 'companion', companion: 'wren' }, wrenFollows(false)], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['{wren} walks round the stone twice, slowly, the way she walks a pass, and lays her knife-point on a crack as thin as a thread. "There." You hit it with everything you have. The stone rings like a cracked bell and spits the sisters out onto the rock. {sedge} is up first, with her claws out.'] },
        failure: { to: id, text: ['{wren} points, and you strike, but the crack has closed by the time your blow lands. "It moved," she says. She does not sound as if she believes it.'] } },
      // The manticore talked off its cliff (`tollcliff-talked`) is on its
      // ledge above the bowl, waiting for the meal the hags promised it. Read
      // as a count, so the reach search leaves it untracked.
      { id: 'manticore', label: 'Shout up to the manticore that its dinner is ready', hint: 'It flew up here to collect from the hags, and it is still waiting on its ledge.',
        skill: 'intimidation', dc: 8, requires: [{ kind: 'count', flag: 'manticore-sent', atLeast: 1 }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['"They\'re paying now!" you shout up at the ledge. "Come and collect!" The manticore is off its ledge before you finish. It drops onto {nettle}\'s back and drags her out of the rock by the hair. {sedge} tears her own hands free to go after her sister.', 'The manticore meets two sets of green claws at once and decides the meal is not worth it. It beats away over the rim with a mouthful of green hair, shouting about promises.'] },
        failure: { to: id, text: ['The manticore only grins down at you with its man\'s face. "When they are out of the rock," it purrs. "I do not dig for my dinner."'] } },
      { id: 'seam', label: 'Find where the stone is weakest', hint: 'The song is louder on one face of the stone than the others.',
        skill: 'investigation', dc: 14, requires: [{ kind: 'noCompanion', companion: 'wren' }], hideWhenBlocked: true,
        failure: { to: id, text: ['Every face of the stone looks the same to you, smooth and black and singing.'] } },
    ],
    success: { to: sisters, effects: LOOSE, text: ['The stone gives a crack like a snapped bone and throws the sisters off. They land in a crouch, with ash falling out of their hair and nothing left in the rock to hide behind.'] },
    failure: { to: calling, effects: [{ kind: 'setFlag', flag: 'stone-spent' }], text: ['Nothing you try reaches them. The sisters sink into the stone to the elbow, and the stone takes everything they have left.'] },
    noBack: true,
  };
};

/**
 * The vigil: asking {sedge} to keep the door her sister kept, after an answer
 * that owns the wrong (`rueful`) or tells the truth (`unknowing`). One try per
 * approach, and each approach is a reason she might listen, given by whoever
 * has the right to give it. The plain ask is open to every company, a cold
 * start too; its DC is set by the answer. The rest are what three chapters of
 * mercy carried up the mountain: the pen opened (`hollow-road:captives-freed`),
 * the valley's regard (REGARD: the reeve at 1, the fen-folk at 2), {marrow} spared to keep
 * his graves, {halden} saved (or beside you), and a {wren} who would follow
 * you anywhere. So a merciful company has several tries at it, and a cruel
 * one (if it says sorry at all) has one hard one.
 *
 * Every approach lands on `vigil-kept`, or on the answer's own refusal once
 * all are spent, so none can open or shut a way on. The carried flags behind
 * them are read as counts (OWED), which the reach search leaves untracked as
 * it does an attitude gate; read as flags, each would double its whole walk.
 */
const OWED = (flag: string): Requirement => ({ kind: 'count', flag, atLeast: 1 });
type VigilMood = 'rueful' | 'unknowing' | 'sold';
const WREN_REBUFFED = '{sedge} hardly looks at her. "Your scout loves you," she says. "My sister loved no one, and she kept the door anyway."';
const VIGIL_ASK_DC: Record<VigilMood, number> = { rueful: 15, unknowing: 17, sold: 15 };
const vigilScene = (mood: VigilMood): Scene => ({
  id: `vigil-${mood}`, kind: 'challenge', art: { imageId: 'loc-mountain', emoji: '🚪' },
  intro: ['{sedge} keeps her hands in the rock, but she is listening. {nettle} sings louder, to drown you out.'],
  retry: 'perApproach',
  noBack: true,
  approaches: [
    { id: 'pen', label: 'Tell her the pen behind the kennels stands empty', hint: 'Whatever her sister grew greedy for, you let it walk home.',
      skill: 'persuasion', dc: 15, requires: [OWED('hollow-road:captives-freed')], hideWhenBlocked: true,
      success: { to: 'vigil-kept', text: ['"We opened her pen," you tell {sedge}. "The carter walked home, and the girl with one shoe. Whatever your sister grew greedy for at the end is given back." {sedge} is quiet for a long breath. "Then only the door is owed," she says.'] },
      failure: { to: `vigil-${mood}`, text: ['"One pen," {sedge} says. "She sat in the dark for {door-kept}. A pen does not weigh much against that."'] } },
    { id: 'fen', label: 'Promise her the fen will pay the old price',
      skill: 'persuasion', dc: 15, requires: [regard({ atLeast: 2 })], hideWhenBlocked: true,
      success: { to: 'vigil-kept', text: ['"The fen-folk on the rim came up this mountain for us," you tell her. "There will be a {door-price} at the water\'s edge each {door-midwinter}, the way their grandparents left it." {sedge} turns her burning face up toward the rim, where the fen-folk stand with their ropes.'] },
      failure: { to: `vigil-${mood}`, text: ['"Their grandparents forgot," {sedge} says. "So will they."'] } },
    { id: 'ledger', label: 'Promise her {thornwick} will remember her this time', hint: 'The reeve owes you, and he keeps the town\'s ledger.',
      skill: 'persuasion', dc: 15, requires: [regard({ atLeast: 1 })], hideWhenBlocked: true,
      success: { to: 'vigil-kept', text: ['"The reeve owes us," you tell her. "He will write her price into {thornwick}\'s ledger, and her name beside it, and every reeve after him will read it." {sedge} turns the words over. "Her name," she says. "In a ledger."'] },
      failure: { to: `vigil-${mood}`, text: ['"Ink," {sedge} says. "Your {thornwick} had ink before, and it forgot her all the same."'] } },
    { id: 'marrow', label: 'Tell her who keeps {saltmere}\'s graves now', hint: '{marrow} took a chisel to the {warden}\'s door. You let him go home to his dead.',
      skill: 'persuasion', dc: 16, requires: [OWED(npcFateFlag('marrow', 'sings'))], hideWhenBlocked: true,
      success: { to: 'vigil-kept', text: ['"The man who took a chisel to that door was {marrow}," you tell her. "We let him live, and he went home to keep {saltmere}\'s graves with the rites, so that nothing there wakes." {sedge} looks at you, and for once there is no anger in it. "A gravedigger keeping watch," she says. "She would have laughed."'] },
      failure: { to: `vigil-${mood}`, text: ['"One old man with a lamp," {sedge} says. "She kept the whole fen."'] } },
    // Halden came down into the bowl: he says the rites for her himself.
    { id: 'halden', label: 'Let {halden} say the rites for her sister', hint: 'He has said them for everyone in {thornwick}. No one has ever said them for her.',
      skill: 'religion', dc: 13, requires: [{ kind: 'companion', companion: 'halden' }], hideWhenBlocked: true,
      success: { to: 'vigil-kept', text: ['Brother {halden} opens his book at the oldest rites in it, the ones for keepers of a door. He says them slowly, all the way through, for a hag whose name he does not know. When he finishes, {sedge} is weeping. "No one ever said them for her," she says.'] },
      failure: { to: `vigil-${mood}`, text: ['{halden} starts the rites, and {nettle} sings over him until no one can hear the words. {sedge} turns her face back to the stone.'] } },
    { id: 'halden-rim', label: 'Promise her {halden} will say the rites for her sister', hint: 'He is up on the rim, alive because of you. He has never refused anyone the rites.',
      skill: 'persuasion', dc: 15, requires: [{ kind: 'npc', npc: 'halden', fate: 'saved' }, { kind: 'noCompanion', companion: 'halden' }], hideWhenBlocked: true,
      success: { to: 'vigil-kept', text: ['"Brother {halden} is up on the rim," you tell her. "He has never refused anyone the rites. He will say them for your sister." {sedge} says nothing for a breath. "No one ever said them for her," she says.'] },
      failure: { to: `vigil-${mood}`, text: ['"A priest\'s words," {sedge} says. "She had {door-kept} of silence. Words come late."'] } },
    // A Wren who would follow the company anywhere speaks for it: the same
    // Wren who found the seam (WREN_FOLLOWS, her `attitude` at the council).
    // Three wars only for the Wren they pulled out from under the horse in
    // Part 1; any other walked with them from the fen on.
    { id: 'wren', label: 'Let {wren} speak for you', hint: 'She has walked behind you through three wars. She would tell anyone what she thinks of you.',
      skill: 'persuasion', dc: 13,
      requires: [{ kind: 'companion', companion: 'wren' }, wrenFollows(true), { kind: 'npc', npc: 'wren', fate: 'saved' }], hideWhenBlocked: true,
      success: { to: 'vigil-kept', text: ['{wren} lowers her bow and steps up beside you. "I\'ve walked behind them through three wars," she tells {sedge}. "They keep their word. If they say the fen will pay, it will." {sedge} looks at the girl, and then at you.'] },
      failure: { to: `vigil-${mood}`, text: [WREN_REBUFFED] } },
    { id: 'wren-fen', label: 'Let {wren} speak for you', hint: 'She walked the fen with you, and she came down into this bowl with you. She would tell anyone what she thinks of you.',
      skill: 'persuasion', dc: 13,
      requires: [{ kind: 'companion', companion: 'wren' }, wrenFollows(true), { kind: 'npc', npc: 'wren', notFate: ['saved'] }], hideWhenBlocked: true,
      success: { to: 'vigil-kept', text: ['{wren} lowers her bow and steps up beside you. "I walked the fen with them, as far as the barrows," she tells {sedge}. "They keep their word. If they say the fen will pay, it will." {sedge} looks at the girl, and then at you.'] },
      failure: { to: `vigil-${mood}`, text: [WREN_REBUFFED] } },
    // The plain ask, open to every company: the answer sets how hard it is.
    { id: 'ask', label: 'Tell her the door still needs a keeper', skill: 'persuasion', dc: VIGIL_ASK_DC[mood],
      success: { to: 'vigil-kept', text: ['"The door under the fen still needs a keeper," you tell her. "A priest\'s book is a poor jailer. Your sister kept that door through more winters than anyone can count. Keep it for her."'] },
      failure: { to: `vigil-${mood}`, text: ['"A keeper," {sedge} says. "She was a keeper for an age, and no one in your valley knew it. Give me a better reason than your need."'] } },
  ],
  success: { to: 'vigil-kept' },
  failure: { to: `vigil-refused-${mood}` },
});

/** A fresh company begins the finale at 4th level. Only the cold start
 *  carries it: a company continuing from The Sunken Barrows arrives with what
 *  its fights earned (see docs/module-writing-guide.md, "Levels come from fights"). */
const COLD_START: Effect = { kind: 'xpToLevel', level: 4 };
/** Into the war-camp, however the company comes to it. */
const OPENING: Effect[] = [
  // The camp's tally starts below zero (see TALLY).
  { kind: 'setFlag', flag: TALLY, value: -THREAT_PAR },
  { kind: 'journal', entry: { id: 'q-calling', kind: 'quest', title: 'Silence the {calling}',
    body: 'The {reedwife}\'s sisters have woken the {calling} Stone in the high hills. Its song pulls wyrms, giants, and worse down on the valley. Climb the passes, kill what answers the call, and break the stone.' } }];

/** Reeve {aldous}'s thanks, for a company the valley holds in regard
 *  (REGARD at 1 or more): {thornwick}'s watch arrives with the company at the
 *  muster and holds the camp's weakest line, two ticks on the tally (see
 *  TALLY). Posted from the opening, not a marker, because a marker's
 *  redirect cannot read a tally (the reach search would take it as certain). */
const WATCH: Effect[] = [{ kind: 'setFlag', flag: 'watch-holds' }, ...tally(2),
  { kind: 'journal', entry: { id: 'c-watch', kind: 'clue', title: '{thornwick}\'s Watch',
    body: 'Reeve {aldous} sent {thornwick}\'s watch up to the war-camp, for what you have done for the town. They hold the camp\'s weakest line when the {calling} peaks. That is two fewer things for the pikes to stop.' } }];

const scenes: Record<string, Scene> = {
  // === ACT 1 — THE WAR-CAMP ==============================================
  muster: {
    id: 'muster', kind: 'story', art: { imageId: 'loc-camp', emoji: '⚔️' },
    text: [
      'The valley has raised an army at last. A **war-camp** spreads across the wet meadows below the high hills, where {thornwick}\'s recruits drill: fen-folk with boar-spears, and carters holding pikes. This time everyone can see the trouble coming. Fires burn every night up in the high passes, and no shepherd lit them.',
      // A cold start: who the company is, in two lines (Parts 1–2, as the
      // muster's recruit and Vex take them for granted).
      { if: [hasNot('sunken-barrows:won')],
        text: 'Two seasons ago your company broke the {ashfang} raiders in their den past the marsh. You killed the hag their chief had sold himself to, the one the fen-folk called the {reedwife}.' },
      // Halden's book introduces him, for the rites at the stone (`tear-loose`).
      { if: [hasNot('sunken-barrows:won')],
        text: 'Last season the dead of {thornwick} walked out of their graves. You followed them down into the barrows under the fen, and shut the door they came out of. The rites you said there came from the prayer book of Brother {halden}, {thornwick}\'s priest. It still rides in your pack, fen-damp.' },
      'A fen-folk recruit with a boar-spear falls into step beside you. "It\'s the **{calling} Stone**," he says, and points his spear at the passes. "A black fang of rock up in the high hills. It sings, and every monster in the hills comes to listen. Down here you can\'t hear it yet. Up there, you will. The **{reedwife}\'s sisters** woke it. My cousin saw them at the edge of the fen the night the barrows closed."',
      // The blame falls on what no one knew, not on a crime (see `answer-unknowing`).
      'He looks sideways at you, and then away. "There\'s talk round the fires that it\'s on you, for what you did to the hag. I lit a bonfire the night the den fell, same as everyone. None of us knew what she was sitting on." The crowd opens a path for you all the way to the command tent.',
      { if: [hasNot('sunken-barrows:won')],
        text: 'Your purse still holds two seasons of the reeve\'s pay: the bounty for the {ashfang}, and the commission for the barrows. {thornwick} keeps its word.' },
      // The valley's regard (see WATCH).
      { if: [regard({ atLeast: 1 })],
        text: 'Twenty men in {thornwick}\'s colours fall in behind you, and their sergeant hands you a folded note in the reeve\'s stiff handwriting. *{thornwick} is in your debt, and I keep its accounts. The watch is yours until the {calling} is broken. — {aldous}* "We\'ll take the weakest stretch of the line," the sergeant says.' },
    ],
    next: [
      { id: 'go', label: 'Report to the command tent', to: 'envoys', hideWhenBlocked: true,
        requires: [has('sunken-barrows:won'), regard({ below: 1 })], effects: OPENING },
      { id: 'go-watch', label: 'Report to the command tent', to: 'envoys', hideWhenBlocked: true,
        requires: [has('sunken-barrows:won'), regard({ atLeast: 1 })], effects: [...OPENING, ...WATCH] },
      // A cold start is still the company that ended the Ashfang and sealed
      // the barrows, so it still has the pay: about what a run through Parts
      // 1–2 carries into this chapter (some 700 to 1,400 gold on the
      // transcript routes), so the ogre-mage's toll costs it what it costs them.
      { id: 'go-cold', label: 'Report to the command tent', to: 'envoys', hideWhenBlocked: true,
        requires: [hasNot('sunken-barrows:won')], effects: [COLD_START, ...OPENING, { kind: 'gold', amount: 800 }] },
    ],
    noBack: true,
  },
  envoys: {
    // The sister is only a seeming (see onWin); her hired swords are real.
    id: 'envoys', kind: 'battle', encounterId: 'hired-swords', mapId: 'open',
    intro: [
      'You are ten paces from the command tent when the whole camp stops talking at once. A woman stands in your way who was not there a moment ago. She is a head taller than anyone in the camp, with duckweed braided into her hair. Five hired swords stand behind her: a knight in dented black plate, a grey old sellsword with a scarred face, and three archers. They watch you with bored, empty eyes.',
      '"The famous company." She smiles without opening her mouth. "I am **{nettle}**, elder sister to the one you called the {reedwife}. You beat her in the chief\'s hall, and you cost this family its living. That debt is written down, and it will be paid."',
      'She flexes her green fingers. "The rest of the collectors are gathering up on the mountain. Think of this as the first notice."',
    ],
    onWin: { to: 'envoys-won', text: ['The last hired sword goes down. {nettle} smiles at you once more, and then there is only a heap of wet reeds where she stood, and a puddle spreading over the mud.', 'Her hired swords were real enough. They stay where they fell.'] },
    // Losing the opening fight gets its own beat: nobody has met Vex yet,
    // and the briefing that follows must not read as if you had won.
    onLoss: { to: 'envoys-lost', text: ['You go down in the mud, and {nettle}\'s green fingers are the last you see.'] },
  },
  'envoys-lost': {
    id: 'envoys-lost', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏕️' },
    text: [
      'You wake on a cot in the hospital tent, with mud still drying in your hair. The scouts who dragged you in say the tall woman sank into a puddle, and her hired swords walked off after her.',
      'A grey-haired captain looks in through the tent flap. "She does that," he says. "Can you stand? Good. Come to the command tent. We\'ve a war to plan, and you\'re in it."',
    ],
    // Straight to the briefing: no night can pass (and no dawn speak of
    // Vex's word, or the peak come) before the party has heard him.
    next: [{ id: 'up', label: 'Follow him to the command tent', to: 'tent-after-loss' }], noBack: true,
  },
  'envoys-won': {
    id: 'envoys-won', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'The command tent stands open. Inside, maps cover a table, and a grey-haired captain sits with a sword across his knees. He watches you duck in with a tired calm, as if his bad guesses keep coming true and he has stopped minding.',
      '"She\'s been at my patrols all week." He nods at the tent flap. "You\'re the first she\'s stopped to talk to. You did better than they did."',
    ],
    next: TO_BRIEFING,
  },
  // Reached straight from the hospital tent, only after losing to the envoy.
  'tent-after-loss': {
    id: 'tent-after-loss', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' }, noBack: true,
    assumes: [{ kind: 'notFlag', flag: 'briefed' }],
    text: [
      'The command tent stands open. Maps cover a table, and the grey-haired captain sits behind it with a sword across his knees. He has a tired calm about him, as if his bad guesses keep coming true and he has stopped minding.',
      '"Sit down before you fall down," he says. "She did the same to my last two patrols. You lasted longer than they did."',
    ],
    next: TO_BRIEFING,
  },
  // Not turned (Part 1): he made no deal with the company, whether it met him
  // at his fire or not (a cold start too). The chief's guard fought for the
  // chief, and Vex gave himself up after. He commands on the reeve's terms.
  'vex-brief': {
    id: 'vex-brief', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗡️' },
    assumes: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }],
    text: [
      'You know this man. It is **{vex}**, once the {ashfang}\'s lieutenant. He kept a lone fire in the chief\'s den, apart from the rest, and he made no deal with you. "The chief\'s guard answered to me," he says. "I could have stood him down, and I let him fight you instead. I\'ve thought about that."',
      'The morning after, he walked into the reeve\'s hall and gave himself up, and the reeve gave him a cell with a window. When the fires started, the reeve took him out of the cell and handed him the war. "Hold the valley through the summer, and I walk free," {vex} says. "Lose it, and he has a rope ready. I\'ve made worse bargains. Most of them with the chief."',
      ...briefPlan(ON_TERMS),
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('{vex} was the {ashfang}\'s lieutenant, and he made no deal with you. He let the chief\'s guard fight you in the hall, then gave himself up and sat in the reeve\'s cells until the fires started. The reeve gave him no pardon, only the war-camp: hold the valley and walk free, or hang. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the {calling} peaks.') }],
  },
  'vex-brief-turned': {
    id: 'vex-brief-turned', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗡️' },
    assumes: [{ kind: 'npc', npc: 'vex', fate: 'turned' }],
    text: [
      'You know this man. It is **{vex}**, with a captain\'s sash where the {ashfang} tooth used to hang.',
      '"I got as far as a hill inn," he says. "Then word came that the dead were walking, and then fires in the passes. I found I couldn\'t sit and drink while this valley went through it all again. So I walked back and offered the reeve my sword. He took it, which surprised us both. No more burned barns. I like this side better."',
      ...briefPlan(RESPECTABLE),
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('{vex} was the {ashfang}\'s lieutenant until he took the way out you gave him in the chief\'s den. He left the valley, then came back when the hills began to burn. Now he runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the {calling} peaks.') }],
  },
  warcamp: {
    id: 'warcamp', kind: 'explore',
    map: {
      title: 'The War-Camp', theme: 'ember', art: { imageId: 'loc-camp', emoji: '🏕️' },
      camp: {}, // safe: the one place in the valley with walls of spears
      // Overworld dressing: arrive at the command tent; tracks link the camp.
      entry: ['command'],
      roads: [
        ['command', 'stores'], ['stores', 'scouts'], ['stores', 'trailhead'],
        ['stores', 'wagons'], ['command', 'eastline'], ['scouts', 'fenfolk'],
      ],
      nodes: [
        // Every party reaches the camp briefed (a loss to the envoy goes
        // straight from the hospital tent to the briefing), so the default
        // scene is never shown. Vex's map says how the hills stand (see
        // tentScene): the first match wins, so the tally splits three ways.
        // Every marker opens on the morning after the peak, once (PEAK_WHEN).
        { id: 'command', x: 25, y: 30, label: 'The Command Tent', icon: 'tok-fire', scene: 'tent-after-loss',
          sceneWhen: [...PEAK_WHEN,
            // After the war council {vex} holds the rim (`stone-lost`).
            { if: [has('rim-clear')], to: 'command-rim' },
            { if: [has('briefed'), tallyAtLeast(TALLY_HIGH)], to: 'command-done' },
            { if: [has('briefed'), tallyAtLeast(TALLY_HALF)], to: 'command-half' },
            { if: [has('briefed')], to: 'command-thin' }] },
        { id: 'stores', x: 50, y: 45, label: 'The War-Stores', icon: 'tok-market', scene: 'wc-stores',
          sceneWhen: PEAK_WHEN },
        // Wren knows you if you pulled her out from under a horse (Part 1).
        // Every company that won Part 2 walked the fen with her; a cold start
        // meets her here as a stranger (`scouts-fire-old`, WREN_KNOWS); how
        // warmly is her regard (WREN_SEES_YOU_OFF).
        { id: 'scouts', x: 30, y: 70, label: 'The Scouts\' Fire', icon: 'tok-camp', scene: 'scouts-fire-old',
          sceneWhen: [...PEAK_WHEN,
            // Back from the bowl with Wren still in the party: she isn't here.
            { if: [{ kind: 'companion', companion: 'wren' }], to: 'scouts-with-you' },
            // After the war council she is up on the rim with the column.
            { if: [has('rim-clear')], to: 'scouts-rim' },
            { if: [{ kind: 'flag', flag: 'wren-brief' }], to: 'scouts-done' },
            { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }], to: 'scouts-fire-saved' },
          ] },
        // War assets paid at the camp (see WAR ASSETS): the marker's scene is
        // the gift; a company not owed it, or already paid, is waved past.
        { id: 'wagons', x: 58, y: 80, label: 'The Supply Wagons', icon: 'tok-market', scene: 'wagons-carter',
          sceneWhen: [...PEAK_WHEN,
            { if: [{ kind: 'flag', flag: 'mules-unloaded' }], to: 'wagons-paid' },
            { if: [{ kind: 'notFlag', flag: 'hollow-road:captives-freed' }], to: 'wagons-busy' },
          ] },
        { id: 'eastline', x: 62, y: 18, label: 'The East Line', icon: 'tok-lookout', scene: 'eastline-busy',
          sceneWhen: [...PEAK_WHEN, { if: [{ kind: 'flag', flag: 'watch-holds' }], to: 'eastline-held' }] },
        // The fen-folk tie the Calling back to the fen: the Reedwife's old
        // price, and the door under the barrows. Both versions only lead back,
        // so the cracked door they read costs the reach search nothing.
        { id: 'fenfolk', x: 10, y: 52, label: 'The Fen-Folk\'s Fire', icon: 'tok-camp', scene: 'fenfolk-fire',
          sceneWhen: [...PEAK_WHEN, { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }], to: 'fenfolk-fire-cracked' }] },
        { id: 'trailhead', x: 80, y: 60, label: 'The High Trail', icon: 'tok-gate', scene: 'hills-out',
          // The first climb hears the Calling; after that, `again`.
          sceneWhen: PEAK_WHEN,
          requires: [{ kind: 'flag', flag: 'briefed' }],
          note: 'The lookout lets no one up the high trail without the captain\'s orders. Report to the command tent.' },
      ],
    },
  },
  // The fen-folk: what the Reedwife's price was, and what the stone is doing
  // to the door under the barrows (louder, if it shut cracked in Part 2).
  'fenfolk-fire': {
    id: 'fenfolk-fire', kind: 'story', art: { imageId: 'loc-camp', emoji: '🔥' },
    text: [
      FENFOLK_WITCH,
      FENFOLK_PRICE,
      { assumes: [{ kind: 'notFlag', flag: 'sunken-barrows:seal-cracked' }], text: '"And the stone sings into the ground as well as the sky. We feel it in our feet. The dead under the barrows are turning in their sleep." She pulls her yarn tight. "Break that stone before they wake up properly."' },
    ],
    again: ['The hedge-witch is still knitting by the fen-folk\'s fire. "Break that stone," she says, without looking up.'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
  },
  'fenfolk-fire-cracked': {
    id: 'fenfolk-fire-cracked', kind: 'story', art: { imageId: 'loc-camp', emoji: '🔥' },
    assumes: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
    again: ['The hedge-witch is still knitting by the fen-folk\'s fire. "Hear it knock?" she says, without looking up. "Break that stone."'],
    text: [
      FENFOLK_WITCH,
      FENFOLK_PRICE,
      '"You know the door under the barrows. You shut it, near enough. Well, it knocks now, every night the stone sings, and louder each time." She pulls her yarn tight. "If the {calling} runs much longer, that crack\'ll open. The sisters know it. I think they\'re counting on it."',
    ],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
  },
  // Vex's map, by the tally (see tentScene and TALLY_HIGH / TALLY_HALF).
  'command-done': tentScene('command-done', 'The row is longer than the list of fires now.',
    '"More than half of it\'s pinned," {vex} says. "If it all came down tonight, we\'d hold. Easily. I might even get some sleep."',
    '"More than half of it\'s pinned," {vex} says. "Now go and finish the rest."'),
  'command-half': tentScene('command-half', 'The row reaches about halfway down the edge of the map.',
    '"We\'re getting there," {vex} says. "If it all came down tonight, we\'d hold. But I\'d be writing a lot of names in the morning."',
    '"We got about half of it," {vex} says. "The other half came down the slope at us, the night the {calling} peaked."'),
  'command-thin': tentScene('command-thin', 'It is a short row.',
    '"Not enough yet," {vex} says, and he taps the fires still burning in the passes. "If all of that came down tonight, it would go through this camp like a flood."',
    '"Not enough," {vex} says, and he taps the passes where the fires burned. "Most of it was still up there when the {calling} peaked, and it all came down on us."'),
  // {vex} and his column are up on the rim after the war council.
  'command-rim': {
    id: 'command-rim', kind: 'story', art: { emoji: '🗺️' }, noBack: true,
    assumes: [has('rim-clear')],
    text: ['The command tent is half empty. {vex} has taken the column up to the rim. His clerk keeps the tent for him, with ink on his cuffs and a runner asleep by the door. "The captain holds the rim until the stone is broken," the clerk says. "Those were his orders. He didn\'t say what to do after."'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
  },
  // The morning after the peak (see PEAK_WHEN): the camp held, easily or not.
  'peak-night': {
    id: 'peak-night', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🔥' },
    text: [
      'The war-camp has had its night. The {calling} peaked in the dark, and everything still loose in the hills came down the slope at once, just as Captain {vex} said it would.',
      { if: [peakAtLeast(TALLY_HIGH)],
        text: 'It did not get far. You had thinned the hills, and the pikes had little left to stop. The east line is trampled, but it is whole. {vex} walks it at dawn and finds no one to bury.' },
      { if: [hasNot(PEAK_TALLY)],
        text: 'The pikes held, but it cost. The east line is a mess of mud and broken shafts, and the hospital tent is full. {vex} walks the line at dawn, stopping at every stretcher.' },
      // The warband the toll sent down (ONI_AT_CAMP).
      { if: [has('oni-paid')],
        text: 'The ogre-mage\'s warband hit the east line at midnight, as it said it would, with its horn blowing. Its dead still lie in the ditch below the pikes, in their stolen mail.' },
      { if: [has('watch-holds')],
        text: '{thornwick}\'s watch held the weakest end of the line all night. Their sergeant salutes you as you pass.' },
    ],
    next: [
      // A good night warms a {wren} who knows the company (see PEAK_NOW),
      // once: from the ridge (WREN_WARMED), or here. A sixth morning that
      // peaked it before the ridge leaves the warmth to this beat.
      { id: 'easy', label: 'Head back to the camp', to: 'warcamp', hideWhenBlocked: true, requires: [peakAtLeast(TALLY_HIGH), warmedOnRidge(false), WREN_KNOWS],
        effects: [{ kind: 'setFlag', flag: 'peak-seen', value: 1 }, { kind: 'setFlag', flag: 'peak-easy' }, WREN_WARMS] },
      { id: 'easy-new', label: 'Head back to the camp', to: 'warcamp', hideWhenBlocked: true, requires: [peakAtLeast(TALLY_HIGH), WREN_NEW],
        effects: [{ kind: 'setFlag', flag: 'peak-seen', value: 1 }, { kind: 'setFlag', flag: 'peak-easy' }] },
      { id: 'easy-ridge', label: 'Head back to the camp', to: 'warcamp', hideWhenBlocked: true, requires: [peakAtLeast(TALLY_HIGH), warmedOnRidge(true), WREN_KNOWS],
        effects: [{ kind: 'setFlag', flag: 'peak-seen', value: 1 }, { kind: 'setFlag', flag: 'peak-easy' }] },
      { id: 'cost', label: 'Head back to the camp', to: 'warcamp', hideWhenBlocked: true, requires: [hasNot(PEAK_TALLY)],
        effects: [{ kind: 'setFlag', flag: 'peak-seen', value: 1 }, { kind: 'setFlag', flag: 'peak-cost' }] },
    ],
  },
  // Too little of the hills dealt with: the camp nearly broke, and the last
  // of the night is still at the east line. One fight, once (`peak-seen` is
  // set on the way in), and no walking away from it.
  'peak-line': {
    id: 'peak-line', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🔥' },
    text: [
      'The war-camp nearly broke on the night the {calling} peaked. Everything still loose in the hills came down the slope at once, just as Captain {vex} said it would. There was too much of it left.',
      { if: [has('oni-paid')],
        text: 'The ogre-mage\'s warband hit the east line first, at midnight, with its horn blowing. The pikes there never closed the gap it made.' },
      'The east line is a wreck of mud and snapped pikes. Smoke hangs over the tents. And it is not over yet. Something is still singing over the east line, and the pikemen there are walking away from their posts toward it.',
      { if: [has('watch-holds')],
        text: '{thornwick}\'s watch is the only part of the line still standing in good order. Their sergeant waves you on toward the singing.' },
    ],
    next: [{ id: 'hold', label: 'Hold the east line', to: 'peak-battle',
      effects: [{ kind: 'setFlag', flag: 'peak-seen', value: 1 }, { kind: 'setFlag', flag: 'peak-broke' }] }],
  },
  'peak-battle': {
    id: 'peak-battle', kind: 'battle', encounterId: 'harpy-roost', mapId: 'open',
    // The night's last stragglers: a setback to survive, not a payday.
    loot: false, noFlee: true,
    intro: ['Two harpies sit on the broken line with their wings spread, singing. Three pikemen have dropped their pikes and walk toward them, smiling. The harpies see you coming, and they turn their song on you.'],
    onWin: { to: 'warcamp', text: ['The second harpy drops into the mud between the pikes, and the singing stops. The pikemen shake their heads and stare at their empty hands. {vex} comes down the line behind you, counting the wounded under his breath.'] },
    // Lost in the camp itself, not on the mountain: its own wake-up.
    onLoss: { to: 'peak-line-lost', text: ['The harpies\' song closes over your heads, and you go down in the mud of the east line.'] },
  },
  'peak-line-lost': {
    id: 'peak-line-lost', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🏕️' },
    text: [
      'Someone has laid you on a cot with your boots still on, and by the light it is a day later. The pikemen drove the harpies off in the end, with rocks and shouting and their own hands over their ears.',
      '{vex} looks in, grey from lack of sleep. "We held," he says. "Just. Get up when you can. The stone is still singing."',
    ],
    next: [{ id: 'up', label: 'Get back on your feet', to: 'warcamp', effects: [{ kind: 'passDay' }] }],
  },
  'wc-stores': { id: 'wc-stores', kind: 'shop', title: 'The War-Stores', next: 'warcamp',
    npc: BRAM,
    // A war camp's shelf: healing, answers to dragon breath and gorgon
    // poison, a giant's strength in a bottle, and spears and bows for the pikes.
    stock: [
      'potion-healing', 'potion-greater-healing', 'alchemists-fire',
      'potion-fire-resistance', 'potion-poison-resistance', 'potion-giant-strength-hill',
      'scroll-cure-wounds', 'scroll-bless', 'scroll-protection-from-energy', 'scroll-haste',
      'spear', 'longbow', 'chain-mail',
    ],
    intro: ['{bram} has taken over a supply wagon and, by the look of things, every pricing decision in the war. "War makes everything cost more," he says. "Except my goods. The captain reads my books." He turns a crate around to face you. "There\'s big things up that hill. Buy accordingly."'] },
  // Wren knows the company from the deep fen, as far as the barrows (whether
  // she held the Barrow Gate or went down the stair is Part 2's own). A cold
  // start lands here too, and so does a {wren} who lost her partner (`lost`).
  'scouts-fire-old': {
    id: 'scouts-fire-old', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    // Any company but a cold start walked the fen with her in Part 2.
    assumes: [{ kind: 'npc', npc: 'wren', notFate: ['saved'] }, { kind: 'noCompanion', companion: 'wren' }],
    again: ['{wren} looks up from the map board. "My notes are still here when you want them," she says. "The passes won\'t read themselves."'],
    lines: [
      '**{wren}** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She made Chief of Scouts young, and still goes pink when the riders say it.',
      // `lost` (Part 1): her partner died under the horse on the marsh road.
      { if: [{ kind: 'npc', npc: 'wren', fate: 'lost' }],
        text: 'A second bow hangs unstrung from the post behind her, with {tamsin}\'s name burned into the grip. Nobody at the fire touches it.' },
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' She frowns. "And the streams are walking uphill. I don\'t know what that means yet, but I\'m watching it."',
      // Only a company she walked the fen with (WREN_KNOWS); to a cold start
      // she is the reeve's scout, and it is strangers to her.
      { if: [WREN_KNOWS],
        text: 'She pauses. "Last time it was the barrows. I didn\'t enjoy a step of it." She rolls the map up tight. "Pick somewhere with a sky over it this time."' },
      ...WREN_SEES_YOU_OFF,
    ],
    next: TAKE_NOTES,
  },
  // Wren owes the company her leg, and probably her life: they lifted a dead
  // horse off her on the marsh road in Part 1.
  'scouts-fire-saved': {
    id: 'scouts-fire-saved', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    assumes: [{ kind: 'npc', npc: 'wren', fate: 'saved' }, { kind: 'noCompanion', companion: 'wren' }],
    again: ['{wren} looks up from the map board. "My notes are still here when you want them," she says. "The passes won\'t read themselves."'],
    lines: [
      '**{wren}** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She stands when she sees you, on the leg you once pulled out from under a dead horse on the marsh road.',
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' She taps a blue line on the map. "And the streams are walking uphill. I don\'t know what that means yet, but I\'m watching it. I counted the watch-posts for you once, lying under a horse. This is a better map." She hands it over. "Come down off that mountain on your own feet. All of you. I won\'t be far behind you."',
      ...WREN_SEES_YOU_OFF,
    ],
    next: TAKE_NOTES,
  },
  'scouts-done': {
    id: 'scouts-done', kind: 'story', art: { emoji: '🏹' },
    assumes: [{ kind: 'noCompanion', companion: 'wren' }],
    text: ['The scouts\' fire crackles through another change of shift. {wren}\'s riders come and go with the brisk urgency she has drilled into them, and her map grows more arrowheads by the hour. She flicks you a two-finger salute without looking up.'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }], noBack: true,
  },
  // The war council is over and {wren} stayed on the rim: her riders keep the fire.
  'scouts-rim': {
    id: 'scouts-rim', kind: 'story', art: { emoji: '🏹' }, noBack: true,
    assumes: [{ kind: 'noCompanion', companion: 'wren' }, has('rim-clear')],
    text: ['The scouts\' fire has burned down to a low red glow. Two of {wren}\'s young riders keep it, taking turns to sleep. "The chief\'s up on the rim with the captain," one says. "She left the map with us. We\'re not to touch it."'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
  },
  'scouts-with-you': {
    id: 'scouts-with-you', kind: 'story', art: { emoji: '🏹' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: ['The scouts\' fire crackles on without its chief. Her three young riders look up as you come over, then past you, at {wren}. She is still at your shoulder. "Map\'s on the board," she tells them. "Keep it straight till I\'m back." They nod, and go back to work.'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }], noBack: true,
  },
  // The carter Part 1's company cut out of the Ashfang pens (`captives-freed`).
  'wagons-carter': {
    id: 'wagons-carter', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🐴' },
    text: [
      'A grey-bearded carter is backing a supply wagon up to {bram}\'s stores, and he stops halfway when he sees you. You last saw him in a stake pen behind the {ashfang} kennels, with a girl of about seven on his back.',
      '"I drive for the army now. The pay\'s bad, and nobody locks me in at night." He reaches under the wagon-seat and comes up with a crate. "The best of the stores. Two flasks of the strong healing, and one that keeps fire off you up where the dragons are. I took it off the top before {bram} could price it. Don\'t tell him."',
    ],
    next: [{ id: 'take', label: 'Take the carter\'s crate', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'mules-unloaded' },
        { kind: 'addItem', itemId: 'potion-greater-healing', qty: 2 }, { kind: 'addItem', itemId: 'potion-fire-resistance', qty: 1 },
        { kind: 'journal', entry: { id: 'c-carter', kind: 'clue', title: 'The Carter\'s Crate',
          body: 'The carter you cut out of the {ashfang} pens drives supply wagons for the war-camp now. He kept the best of the stores back for you.' } }] }],
  },
  // The crate already taken. (No `assumes`: the marker's `sceneWhen` is
  // the only way in, and an assumption would make the search track the flag.)
  'wagons-paid': {
    id: 'wagons-paid', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🐴' },
    text: ['Supply wagons come and go from {bram}\'s stores in a slow line. The grey-bearded carter lifts his whip to you from his wagon-seat, and does not stop.'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
  },
  // A company that never opened the pen (a cold start too): the crate it
  // might have had goes to {bram}'s shelf at {bram}'s price.
  'wagons-busy': {
    id: 'wagons-busy', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🐴' },
    text: ['Supply wagons come and go from {bram}\'s stores in a slow line. A driver hands down a crate of healing flasks, the good kind, and {bram}\'s clerk inks a price on every one. None of the drivers knows your faces, and none of them looks up.'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
  },
  // The watch posted from the muster (see WATCH).
  'eastline-held': {
    id: 'eastline-held', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🛡️' },
    text: ['{thornwick}\'s watch has dug in at the end of the east line, where the pikes were thinnest. Their sergeant raises a muddy hand to you and goes back to his digging.'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
  },
  // No watch (the valley's regard at 0, or a cold start): the weak end stays weak.
  'eastline-busy': {
    id: 'eastline-busy', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🛡️' },
    text: ['Pikemen stand to their posts along the east line. At the far end the line runs thin, and a sergeant has marked a gap on his board where twenty more men ought to stand. He waves you past without looking up.'],
    next: [{ id: 'ok', label: 'Head back to the camp', to: 'warcamp' }],
  },
  'hills-out': {
    id: 'hills-out', kind: 'story', art: { imageId: 'loc-hills', emoji: '⛰️' },
    again: ['You take the high trail again, past the saluted marker. Above you, the {calling} hums on, no quieter than before.'],
    text: ['The high trail leaves the last lookout behind at a stone marker the recruits have started saluting. Above you the hills stack up into the sky, pass over pass. Over the highest one you hear it at last: the **{calling}**. It is not really a sound. It is a pull, like a door standing open somewhere above the clouds.',
      // Sedge's first beat, on every road up: her grief, not Nettle's ledger.
      'For a moment there is a voice on the wind, too. It is a woman\'s voice, raw from crying. "She kept it alone," it says. "In the dark, all those winters. And no one ever came." The wind turns, and the voice is gone.'],
    // No level floor on the climb: the hills' near side is tuned for 4th,
    // and its fights carry the company to 5th.
    next: [{ id: 'up', label: 'Start up the high trail', to: 'hills' }],
  },

  // === ACT 2 — THE HIGH HILLS ===========================================
  hills: {
    id: 'hills', kind: 'explore',
    map: {
      title: 'The High Hills', theme: 'stone', art: { imageId: 'loc-mountain', emoji: '⛰️' },
      camp: { risky: { chance: 0.4, battleScene: 'hills-night' } },
      entry: ['switchbacks'],
      paths: [
        ['switchbacks', 'tollcliff'], ['switchbacks', 'boarruns'], ['switchbacks', 'greenden'], ['switchbacks', 'seam'],
        ['seam', 'blueden'], ['seam', 'onihold'],
        ['onihold', 'redden'], ['onihold', 'gorgonvale'], ['onihold', 'steading'],
        ['steading', 'callinggate'],
      ],
      nodes: [
        { id: 'switchbacks', x: 12, y: 60, label: 'The Switchbacks', icon: 'tok-tracks', scene: 'switchbacks',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'hills-read' }], to: 'switchbacks-done' }] },
        { id: 'tollcliff', x: 26, y: 26, label: 'The Toll-Cliff', mystery: 'A voice on the wind…', icon: 'tok-lookout', scene: 'tollcliff',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'tollcliff-cleared' }], to: 'tollcliff-done' }, PEAKED_GONE('tollcliff')] },
        { id: 'boarruns', x: 30, y: 86, label: 'The Boar-Runs', mystery: 'Drumming underfoot…', icon: 'tok-danger', scene: 'boarruns',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'boarruns-cleared' }], to: 'boarruns-done' }, PEAKED_GONE('boarruns')] },
        { id: 'greenden', x: 38, y: 48, label: 'The Green Den', mystery: 'A sharp green stink…', icon: 'tok-cave', scene: 'greenden',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'green-cleared' }], to: 'greenden-done' }, PEAKED] },
        { id: 'seam', x: 50, y: 66, label: 'The Flooded Pass', mystery: 'A stream running uphill…', icon: 'tok-crossing', scene: 'seam',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'seam-cleared' }], to: 'seam-done' }] },
        { id: 'blueden', x: 58, y: 30, label: 'The Blue Mesa', mystery: 'A smell of thunder…', icon: 'tok-cave', scene: 'blueden',
          requires: [{ kind: 'flag', flag: 'seam-cleared' }],
          note: 'A brook running uphill floods the pass. Something waits in the pool at the top, and nothing gets past it.',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'blue-cleared' }], to: 'blueden-done' }, PEAKED] },
        { id: 'onihold', x: 68, y: 56, label: 'The Middle Pass', mystery: 'A horn on a wall…', icon: 'tok-ruin', scene: 'onihold',
          requires: [{ kind: 'flag', flag: 'seam-cleared' }],
          note: 'A brook running uphill floods the pass. Something waits in the pool at the top, and nothing gets past it.',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'oni-cleared' }], to: 'onihold-done' }] },
        { id: 'redden', x: 74, y: 22, label: 'The Burning Den', mystery: 'Smoke with no campfire…', icon: 'tok-fire', scene: 'redden',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }],
          note: 'The ogre-mage\'s fort holds the middle pass, and no one gets past it.',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'red-cleared' }], to: 'redden-done' }, PEAKED] },
        { id: 'gorgonvale', x: 84, y: 78, label: 'The Valley of Statues', mystery: 'Statues that are too good…', icon: 'tok-mystery', scene: 'gorgonvale',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }],
          note: 'The ogre-mage\'s fort holds the middle pass, and no one gets past it.',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'gorgon-cleared' }], to: 'gorgonvale-done' }, PEAKED_GONE('gorgonvale')] },
        { id: 'steading', x: 88, y: 44, label: 'The Giants\' Hall', mystery: 'Smoke above the tree-line…', icon: 'tok-house', scene: 'steading',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }],
          note: 'The ogre-mage\'s fort holds the middle pass, and no one gets past it.',
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'steading-cleared' }], to: 'steading-done' },
            // The ogre-mage was lied into raiding the hall first.
            { if: [{ kind: 'flag', flag: 'oni-tricked' }], to: 'steading-raided' },
          ] },
        // The den-raiding payoff routes here: beat the clutch (or never let it
        // mass) and later visits cross a still ridge; clear all three dens and
        // the brood never masses at all. Falling back from the clutch fight
        // returns to a short beat, not the first sight of the ridge. First
        // matching sceneWhen wins.
        { id: 'callinggate', x: 95, y: 20, label: 'The Last Ridge', mystery: 'The pull, stronger…', icon: 'tok-boss', scene: 'calling-gate',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }, { kind: 'flag', flag: 'steading-cleared' }],
          note: 'The last road to the ridge runs past the ogre-mage\'s fort and through the giants\' hall. Both stand in the way.',
          // `rim-clear`: the brood is beaten or never massed, and the war
          // council has been held.
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'rim-clear' }], to: 'ridge-quiet' },
            { if: [{ kind: 'flag', flag: 'green-cleared' }, { kind: 'flag', flag: 'blue-cleared' }, { kind: 'flag', flag: 'red-cleared' }], to: 'calling-gate-clear' },
            { if: [{ kind: 'flag', flag: 'calling-found' }], to: 'clutch-again' },
          ] },
      ],
    },
  },
  switchbacks: {
    id: 'switchbacks', kind: 'story', art: { imageId: 'loc-hills', emoji: '👣' },
    text: [
      'The path climbs in tight turns past empty shepherds\' huts with their roofs fallen in. The higher you go, the less the mountain hides.',
      'Burn marks streak the loose rock in three sizes and three colours: green, blue and red.',
      'A boulder sits beside the trail with a handprint pressed into it. The hand was wider than a door.',
      'Water has cut fresh channels across the path, though no stream runs anywhere up here.',
      'Under it all runs that steady pull. The mud is full of tracks, and none of them come back down.',
      'Halfway up, the sky over the trail fills with wings. A flight of **griffons** is riding that pull up the mountain, four of them, and you are standing on their road. The lead one folds its wings and drops.',
    ],
    again: ['The griffons still wheel over the switchbacks, riding the pull up the mountain, and they have seen you.'],
    next: [{ id: 'on', label: 'Stand and meet them', to: 'switchbacks-fight' }],
  },
  // The hills' opening fight, on every road up: the first thing the Calling
  // has pulled up the mountain. Fought at 4th, like the rest of the hills'
  // near side (the levels come from these fights, not from a floor).
  'switchbacks-fight': {
    id: 'switchbacks-fight', kind: 'battle', encounterId: 'griffon-flight', mapId: 'pass',
    // "Nowhere to run on a trail this narrow": no falling back from it.
    noFlee: true,
    intro: ['The griffons come down on the switchbacks screaming, all beak and talon, and the loose rock goes out from under your boots. There is nowhere to run on a trail this narrow, and nothing to do but fight.'],
    again: ['The griffons drop on the switchbacks again, screaming. Their talons rake the loose rock where you stand.'],
    onWin: { to: 'hills', text: ['The last griffon tumbles away down the loose rock. Above you the whole mountain is still climbing toward the stone.'],
      effects: [{ kind: 'setFlag', flag: 'hills-read' }] },
  },
  'switchbacks-done': {
    id: 'switchbacks-done', kind: 'story', art: { emoji: '👣' },
    text: ['The switchbacks wind away below you, familiar now. Up ahead, the {calling} still pulls at the edge of hearing.'],
    next: [{ id: 'ok', label: 'Follow the pull uphill', to: 'hills' }], noBack: true,
  },
  'hills-night': {
    id: 'hills-night', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'harpy-roost', mapId: 'open',
    intro: [
      'In your sleep you see a stone door under the fen. Two tall green women stand in front of it with their backs to you. The younger one turns, and her face is wet. "You broke our sister," she says. The elder, {nettle}, does not turn. "So we will take the valley from you," she says. "It is only fair."',
      'The singing starts in the dream and goes on after it. It is sweet, and wrong, and getting closer. Birds with women\'s faces come riding the night wind down from the crags. Their song tugs at your legs and puts words in your head. *Stand up. Walk to the edge. It is not far.* You wake in time, because the sentry is shouting.',
    ],
    again: ['The same dream comes back: the stone door under the fen, and the two green women in front of it. The singing starts, and the birds with women\'s faces come riding the night wind down from the crags. You wake in time, because the sentry is shouting.'],
    onWin: { to: '@hub', text: ['The last harpy drops into the dark with its song broken off mid-note. You kick the scattered fire back together and stand round it, too wide awake to lie down again. No one mentions the dream.'] },
  },
  tollcliff: {
    id: 'tollcliff', kind: 'story', art: { emoji: '🦁' },
    again: ['The manticore still lies along its ledge under the overhang. It opens one eye. "Back with my toll?" it purrs. "Good. I was getting hungry."'],
    text: [
      'The trail narrows under an overhang, and something lies along the ledge above it like a lord at his dinner table. You see a lion\'s body first, then folded bat\'s wings, then a tail bristling with black spikes.',
      'It lifts its head, and the face is a man\'s, smiling.',
      '"Toll," it says. Its voice is a purr dragged over gravel. "Everything that walks my cliff pays. The goblins paid in sheep. The hags paid in promises." It grins with human lips, and the teeth behind them are a lion\'s. "You will pay in meat. I have decided."',
    ],
    next: [
      // Wren's clue: it is greedy, so point it at a bigger meal. One try, and
      // easier with her notes. A miss gives it the first strike.
      { id: 'promise-notes', label: '[Persuasion DC 11] "Have the hags paid you yet?"', to: 'tollcliff-talked',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'tollcliff', check: { skill: 'persuasion', dc: 11, failTo: 'tollcliff-stung' } },
      { id: 'promise', label: '[Persuasion DC 14] "Have the hags paid you yet?"', to: 'tollcliff-talked',
        requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'tollcliff', check: { skill: 'persuasion', dc: 14, failTo: 'tollcliff-stung' } },
      { id: 'fight', label: 'Pay it in steel', to: 'tollcliff-fight' },
      { id: 'leave', label: 'Leave it on its ledge', to: 'hills' },
    ],
  },
  // Talked down: the manticore flies off to collect from the coven instead.
  'tollcliff-talked': {
    id: 'tollcliff-talked', kind: 'story', art: { emoji: '🦁' },
    text: [
      'You tell it the truth, more or less. "The hags promised you a valley full of meat. They\'re up at the stone right now. Have they paid you one sheep yet?" You shrug. "A lord takes what he was promised. He doesn\'t wait on a ledge for scraps."',
      'The manticore\'s human face goes thoughtful. "Promises," it says, tasting the word. It stretches, and its spiked tail rattles. "I believe I will go and dine with them." It drops off the ledge and beats away uphill, toward the {calling} Stone. Two goblins break from the rocks below the ledge, where they have been hiding all along, and run the other way.',
    ],
    next: [{ id: 'ok', label: 'Walk the open trail', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, { kind: 'setFlag', flag: 'manticore-sent' },
        ...tally(), { kind: 'xp', amount: avoidedFightXP('manticore-cliff') }] }],
    noBack: true,
  },
  'tollcliff-fight': {
    id: 'tollcliff-fight', kind: 'battle', encounterId: 'manticore-cliff', mapId: 'cliff',
    intro: ['"Steel, then," the manticore sighs, sounding genuinely put out. Its tail curves over its shoulder like a drawn bow. Two goblins scramble up from the rocks behind it with spears.'],
    onWin: { to: 'hills', text: ['The manticore drops onto the trail with one last offended word. "Toll." The pile in the overhang holds ten years of pickings, taken from frightened travellers.'],
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, ...tally(), { kind: 'gold', amount: 110 }] },
  },
  // Talked at too long: its tail was cocked the whole time.
  'tollcliff-stung': {
    id: 'tollcliff-stung', kind: 'battle', encounterId: 'manticore-cliff', mapId: 'cliff',
    surprise: 'party',
    intro: ['The manticore listens with its head on one side. "Promises," it says. "The hags gave me promises. I have eaten better." Its tail has stayed cocked over its shoulder the whole time you talked. It looses a volley of spikes before you can raise a shield, and two goblins scramble up from the rocks behind it.'],
    onWin: { to: 'hills', text: ['The manticore drops onto the trail with one last offended word. "Toll." The pile in the overhang holds ten years of pickings, taken from frightened travellers.'],
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, ...tally(), { kind: 'gold', amount: 110 }] },
  },
  'tollcliff-done': {
    id: 'tollcliff-done', kind: 'story', art: { emoji: '🦁' },
    text: ['The overhang stands empty, and the trail below is free to walk.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  boarruns: {
    id: 'boarruns', kind: 'story', art: { emoji: '🐗' },
    again: ['The drumming starts up under your boots again. The herd is still running its gully twice a day, as mad with the {calling} as ever.'],
    text: [
      'A dry gully crosses the trail. Hooves have churned its floor to mud and left coarse hair snagged on every thorn. The hoofprints are as wide as wash-basins, and the newest are still filling with water.',
      'Under your boots, the ground has begun to drum.',
      { if: [{ kind: 'flag', flag: 'wren-brief' }], text: 'Far up the gully, a haze of dust hangs where the herd last ran.' },
    ],
    next: [
      // Timing it: easier with Wren's notes. A miss puts you in the open
      // when the herd comes back, and a pack bursts under it.
      { id: 'time-notes', label: '[Survival DC 11] Time the stampede', to: 'boarruns-timed',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'boarruns', check: { skill: 'survival', dc: 11, failTo: 'boarruns-scattered', failEffects: SCATTERED } },
      { id: 'time', label: '[Survival DC 14] Time the stampede', to: 'boarruns-timed',
        requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'boarruns', check: { skill: 'survival', dc: 14, failTo: 'boarruns-scattered', failEffects: SCATTERED } },
      { id: 'calm', label: '[Druid · Animal Handling DC 12] Kneel in the narrows and calm the leaders', to: 'boarruns-calmed',
        requires: [{ kind: 'classInParty', classId: 'druid' }], hideWhenBlocked: true,
        once: true, check: { skill: 'animal-handling', dc: 12, failTo: 'boarruns-fight' } },
      { id: 'fight', label: 'Meet the stampede at the narrows', to: 'boarruns-fight' },
      { id: 'wait', label: 'Leave the herd to its runs', to: 'hills' },
    ],
  },
  'boarruns-fight': {
    id: 'boarruns-fight', kind: 'battle', encounterId: 'boar-stampede', mapId: 'pass',
    intro: ['The drumming turns into thunder. Two boars the size of hay-carts come down the narrows shoulder to shoulder. Their tusks are as long as plough blades and their eyes are mad with the {calling}. Too late, you see that the gully narrows behind you as well.'],
    again: ['The drumming turns into thunder again. The two great boars come down the narrows shoulder to shoulder, and this time you know the gully closes behind you.'],
    onWin: { to: 'hills', text: ['The stampede breaks around its fallen leaders. The rest of the herd scatters over the far ridge, away from the valley. A drover\'s torn purse hangs from the lead boar\'s tusk, still half full.'],
      effects: [{ kind: 'setFlag', flag: 'boarruns-cleared' }, ...tally(), { kind: 'gold', amount: 40 }] },
  },
  // Timed wrong: the herd catches the party in the open, and a pack bursts.
  'boarruns-scattered': {
    id: 'boarruns-scattered', kind: 'story', noBack: true, art: { emoji: '🐗' },
    text: ['You run too soon. The herd comes back over the rise while you are still in the open, and you dive for the rocks. A boar\'s shoulder catches a pack as it goes by and bursts it. Coins scatter across the gully, and the hooves grind them into the mud.'],
    next: [{ id: 'on', label: 'Meet them at the narrows', to: 'boarruns-fight' }],
  },
  // Timed, not fought: the herd lives, and turns away from the valley.
  'boarruns-timed': {
    id: 'boarruns-timed', kind: 'story', art: { emoji: '🐗' },
    text: [
      'You lie flat on the lip of the gully and watch the dust. The herd thunders past below you and away over the next rise. You count to twenty, and then you run.',
      'Across the gully you pile dry brush in the narrows and set it alight. When the herd comes back, it smells the smoke and swings away over the far ridge, away from the valley. Every boar lives, and not one of them will come near the camp.',
    ],
    next: [{ id: 'ok', label: 'Leave the herd to the smoke and climb', to: 'hills', effects: HERD_SPARED }], noBack: true,
  },
  // A druid's way: the herd is frightened, not angry.
  'boarruns-calmed': {
    id: 'boarruns-calmed', kind: 'story', art: { emoji: '🐗' },
    text: [
      'Your druid walks out into the narrows alone and kneels in the mud. The lead boar skids to a stop, close enough to touch. It is not angry. It is afraid, and the song gives it no rest.',
      'Your druid talks to it, low and slow, until its ears drop. It turns, and the whole herd follows it over the far ridge, away from the valley, until the drumming fades to nothing.',
    ],
    next: [{ id: 'ok', label: 'Let the herd go', to: 'hills', effects: HERD_SPARED }], noBack: true,
  },
  'boarruns-done': {
    id: 'boarruns-done', kind: 'story', art: { emoji: '🐗' },
    text: ['The boar-runs lie still, and grass is growing back over the churned earth. The herd keeps beyond the ridge now.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  // The den's mouth: a dragonborn can order the wyrmling home in the dragon tongue.
  greenden: {
    id: 'greenden', kind: 'story', art: { emoji: '🐉' },
    again: ['The briar tunnel still stinks of cut grass gone bad. The green wyrmling slides out of the briar again, showing its small dragon\'s teeth, and its kobolds shriek the alarm.'],
    text: [
      'The thicket smells of cut grass gone bad, sharp and rotten at once. A tunnel runs into it through strangling briar, and its floor is a bed of picked bones. Somewhere inside, kobolds start shrieking the alarm.',
      'Something green slides out of the briar on its belly. It is no longer than a pony, but its teeth are a dragon\'s teeth. Every bone on the tunnel floor came from something bigger than it is.',
    ],
    next: [
      { id: 'roar', label: '[Intimidation DC 13] Order it home in the dragon tongue', to: 'greenden-cowed',
        requires: [{ kind: 'speciesInParty', speciesId: 'dragonborn' }], hideWhenBlocked: true,
        once: true, check: { skill: 'intimidation', dc: 13, failTo: 'greenden-fight' } },
      { id: 'fight', label: 'Go in after it', to: 'greenden-fight' },
    ],
  },
  'greenden-fight': {
    id: 'greenden-fight', kind: 'battle', encounterId: 'green-dragon-den', mapId: 'marsh',
    intro: ['The kobolds scatter for their spears. The wyrmling coils back into the briar and sucks in a long breath. A green haze leaks out between its teeth.'],
    onWin: { to: 'hills', text: ['The wyrmling drops in the middle of a hiss, and its poison breath thins to a harmless stink. Its small hoard lies under the bones, and you dig it out.',
      'Up the mountain, the {calling}\'s note bends. {nettle}\'s voice rides it down the wind, close as a whisper. "One fewer, little debtors. I have marked it down. We have so many more."'],
      effects: [{ kind: 'setFlag', flag: 'green-cleared' }, ...tally(DEN_TICKS), { kind: 'gold', amount: 75 }] },
  },
  'greenden-cowed': {
    id: 'greenden-cowed', kind: 'story', art: { emoji: '🐉' },
    text: [
      'Your dragonborn steps forward and roars in the old tongue of dragons. The wyrmling knows every word. *This mountain has an older dragon than you. Go home before it finds you.*',
      'The wyrmling drops flat on its bones and shivers. It snatches up its little hoard in its jaws and bolts out the back of the briar, away over the far hills. Its kobolds run after it. It does not look back, and it does not leave you a single coin.',
    ],
    // Sparing it costs the hoard: the fight pays, the mercy does not.
    next: [{ id: 'ok', label: 'Let it go', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'green-cleared' }, { kind: 'setFlag', flag: 'green-sent' },
        ...tally(DEN_TICKS), { kind: 'xp', amount: avoidedFightXP('green-dragon-den') }] }],
    noBack: true,
  },
  // The clock (see DAWNS): after the Calling peaks, a den left standing is
  // empty. Its wyrmlings have gone up to the rim, and its hoard with them.
  'den-flown': {
    id: 'den-flown', kind: 'story', art: { emoji: '🪶' },
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: ['The den is empty. Scorched scales litter the floor, and claw-marks run up the rock to the open sky. Its owner went up to the stone when the {calling} peaked, and it took its hoard in its belly. It will be waiting on the rim.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  'tollcliff-flown': {
    id: 'tollcliff-flown', kind: 'story', art: { emoji: '🦁' },
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: ['The overhang is empty. Deep claw-marks run down the cliff toward the valley, and snapped black tail-spikes lie on the trail. The manticore went down at the war-camp when the {calling} peaked, and it has not come back to its ledge.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  'boarruns-flown': {
    id: 'boarruns-flown', kind: 'story', art: { emoji: '🐗' },
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: ['The boar-runs are empty. The herd has churned the gully to soup, and every hoofprint points downhill. The whole herd went down the slope at the war-camp when the stone called it. The drumming has not come back.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  'gorgonvale-flown': {
    id: 'gorgonvale-flown', kind: 'story', art: { emoji: '🗿' },
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: ['The statues still stand in their crooked rows, but nothing grazes between them. A trail of grey grass, turned to stone, runs out of the valley and down the slope. The gorgon has gone down to the war-camp.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  'greenden-done': {
    id: 'greenden-done', kind: 'story', art: { emoji: '🌿' },
    text: ['The briar tunnel stands silent, and the sharp green stink has faded to the ordinary smell of rot.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  seam: {
    id: 'seam', kind: 'story', art: { emoji: '🌊' },
    again: ['The brook still runs uphill into its pool, and the pool still has shoulders. It waits for you, as patient as before.'],
    text: [
      'A mountain brook runs up the pass instead of down it, quick and steady. Where it pools at the top, the pool has a shape. It has shoulders, and it is waiting.',
      'A crack runs down the rock behind the pool, thin as a knife cut, and cold air breathes out of it. Something came through that crack. The road to the middle pass runs right through its pool.',
    ],
    next: [{ id: 'fight', label: 'Break the water', to: 'seam-fight' }],
  },
  'seam-fight': {
    id: 'seam-fight', kind: 'battle', encounterId: 'flooded-seam', mapId: 'bog',
    intro: ['The pool stands up into twelve feet of mountain water, in the rough shape of a giant and as cold as the crack it came through. The thing does not roar. It simply pours itself at you, and it knocks you off your feet. Behind it, three little ice-things with frost for wings scrabble out of the crack and come shrieking after it.'],
    again: ['The pool stands up again into its rough giant\'s shape. It pours itself at you, as cold as the crack it came through, and the ice-things come shrieking after it.'],
    onWin: { to: 'hills', text: ['The water-giant falls apart all at once. A hundred gallons of plain water run away downhill like any other brook, and leave the purses of the travellers it drowned lying in the mud.',
      'Behind it, the crack in the rock is closing. Just before it shuts, cold air sighs out of it one last time, and it smells of the fen.'],
      effects: [{ kind: 'setFlag', flag: 'seam-cleared' }, ...tally(), { kind: 'gold', amount: 50 }] },
  },
  'seam-done': {
    id: 'seam-done', kind: 'story', art: { emoji: '💧' },
    text: ['The brook runs downhill now, chattering over the stones with no shape in it at all. The crack it came through stays shut.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  blueden: {
    id: 'blueden', kind: 'battle', encounterId: 'blue-dragon-den', mapId: 'ruins',
    intro: [
      'The mesa smells like a storm about to break. Something lives in the ruined watchtower at its top, and its kobolds have lashed copper rods to every standing wall to catch the lightning. The rods hum.',
      'Along a broken wall, a blue **wyrmling** uncoils, crackling, and the air turns sharp and metallic.',
    ],
    again: ['The copper rods still hum on the mesa\'s broken walls. The blue wyrmling uncoils along its wall again, crackling, and the air turns sharp and metallic.'],
    onWin: { to: 'hills', text: ['The wyrmling falls off the wall trailing dead sparks, and the copper rods go cold. The hoard here was tribute, saved up for a dragon\'s future. It rides out in your packs instead.'],
      effects: [{ kind: 'setFlag', flag: 'blue-cleared' }, ...tally(DEN_TICKS), { kind: 'gold', amount: 95 }] },
  },
  'blueden-done': {
    id: 'blueden-done', kind: 'story', art: { emoji: '⚡' },
    text: ['The ruin on the mesa stands empty, and its copper rods are turning green. The storms overhead are only weather now.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  onihold: {
    id: 'onihold', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    again: ['The ogre-mage still stands above the gate of its fort. "Back again," it calls down, pleasantly. "The price is still {ogre-toll}. Or try us. We are still bored."'],
    text: [
      'Someone holds the middle pass, and holds it the way a soldier would. A stone fort stands across it, rebuilt in a week by hands that lift boulders like loaves of bread. Guard posts of sharpened pine ring its walls, and a horn hangs by the gate. It has sounded once today.',
      'Above the gate stands the **ogre-mage** {vex} marked on his map, blue-skinned and wearing scraps of old lacquered armour. It looks you over slowly, from boots to blades, and does its sums.',
      { if: [has('calling-peaked')],
        text: 'Its orcs went down against the war-camp in the night, and the ones who came back wear bandages. The ogre-mage stayed behind to hold the pass. The stone promised it something, and it means to collect.' },
      // What the toll buys, said before it is paid: the pass, not the
      // warband. Paid before the peak, the warband goes down at the camp on
      // the night (no tally tick; see `onihold-paid`).
      { if: [hasNot('calling-peaked')],
        text: '"The stone sings," it calls down, pleasantly. "We answered first, and whoever answers first holds the pass. {^ogre-toll} buys it. We will take our spears somewhere else. Down to your camp in the meadows, I expect, on the night the stone peaks. Or try us. We have not had a proper fight all week."' },
      { if: [has('calling-peaked')],
        text: '"The stone sings," it calls down, pleasantly. "We answered first, and whoever answers first holds the pass. {^ogre-toll}, and we will find another war. Or try us. We have not had a proper fight all week."' },
    ],
    next: [
      // The toll buys the pass and the fight's XP (the guide's avoidance
      // rule), but no tally tick: the warband is not dealt with, only moved.
      // Before the peak it goes down at the camp on the night, one more
      // thing at the east line (ONI_AT_CAMP; `oni-paid`, read only by text);
      // after it, the night is already judged.
      { id: 'pay', label: `Buy the pass (${factValue('ogre-toll')} gold)`, to: 'onihold-paid',
        requires: [{ kind: 'gold', atLeast: factValue('ogre-toll') }, hasNot('calling-peaked')], hideWhenBlocked: true,
        effects: [{ kind: 'gold', amount: -factValue('ogre-toll') }, { kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'setFlag', flag: 'oni-paid' },
          ONI_AT_CAMP, { kind: 'xp', amount: avoidedFightXP('oni-hold') }] },
      { id: 'pay-late', label: `Buy the pass (${factValue('ogre-toll')} gold)`, to: 'onihold-paid',
        requires: [{ kind: 'gold', atLeast: factValue('ogre-toll') }, has('calling-peaked')], hideWhenBlocked: true,
        effects: [{ kind: 'gold', amount: -factValue('ogre-toll') }, { kind: 'setFlag', flag: 'oni-cleared' },
          { kind: 'xp', amount: avoidedFightXP('oni-hold') }] },
      // Wren's clue: set the two warbands on each other. One try, and easier
      // with her notes. A lie it sees through drives the party off the pass.
      { id: 'trick-notes', label: '[Deception DC 12] "The ettin is coming for your pass tonight."', to: 'onihold-tricked',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'oni', check: { skill: 'deception', dc: 12, failTo: 'onihold-driven' } },
      { id: 'trick', label: '[Deception DC 15] "The ettin is coming for your pass tonight."', to: 'onihold-tricked',
        requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'oni', check: { skill: 'deception', dc: 15, failTo: 'onihold-driven' } },
      { id: 'fight', label: 'Take the pass by force', to: 'onihold-fight' },
    ],
  },
  // Lied to: the ogre-mage marches on the giants' hall (see `steading-raided`).
  'onihold-tricked': {
    id: 'onihold-tricked', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: [
      '"Keep your toll," you call up. "The ettin up the hill says it answered the stone first. It\'s coming down for your pass tonight. We only came to watch."',
      'The ogre-mage\'s pleasant face goes very still. "Two heads," it says, "and not one straight thought between them." It blows the horn four times. Within the hour its whole warband is marching uphill toward the giants\' hall. The gate behind them stands open.',
    ],
    next: [{ id: 'ok', label: 'Walk through the open gate', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'setFlag', flag: 'oni-tricked' },
        ...tally(), { kind: 'xp', amount: avoidedFightXP('oni-hold') }] }],
    noBack: true,
  },
  // The lie seen through: the warband drives the party off the pass, and
  // working back up to it costs a day. The fort is still there to be fought.
  'onihold-driven': {
    id: 'onihold-driven', kind: 'story', noBack: true, art: { imageId: 'loc-keep', emoji: '🏯' },
    text: [
      '"The ettin?" The ogre-mage laughs. "It has two heads and not one plan. It would never come down here." It blows the horn once, and the wall answers with rocks, then spears.',
      'You run for the switchbacks and keep running. It takes the rest of the day and all of the night to work back up through the rocks. The whole time, the stone sings over your heads.',
    ],
    next: [{ id: 'on', label: 'Climb back to the trail, a day behind', to: 'hills', effects: [{ kind: 'passDay' }] }],
  },
  // Bought off: the ogre-mage takes the gold and leaves the pass. Before the
  // peak its warband goes down toward the camp, to come at it on the night;
  // after it, the warband has had its night and leaves the mountain.
  'onihold-paid': {
    id: 'onihold-paid', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The ogre-mage weighs the purse in one blue hand and smiles. "Gold, and not one of my soldiers scratched. The best kind of war." It blows the horn three times.',
      { if: [has('oni-paid')],
        text: 'By noon its warband is marching down the long road toward the meadows, where the war-camp\'s smoke goes up.' },
      { if: [hasNot('oni-paid')],
        text: 'By noon its warband is marching down the other side of the mountain, away from the valley.' }],
    next: [{ id: 'ok', label: 'Walk through the open pass', to: 'hills' }], noBack: true,
  },
  'onihold-fight': {
    id: 'onihold-fight', kind: 'battle', encounterId: 'oni-hold', mapId: 'open',
    intro: ['The horn sounds twice, and the gate opens on the ogre-mage\'s guard. Two orcs in stolen mail march out onto the open ground before it with their spears on their shoulders, like drilled soldiers. A scarred old orc calls the step. Last of all, the ogre-mage itself rises off the wall on a cold wind with its blade drawn. The air goes dark around it.'],
    onWin: { to: 'hills', text: ['The ogre-mage falls out of its own darkness, astonished right to the end. Its drilled guard lies dead at the gate, and the fort\'s war-chest sits unguarded in the yard.'],
      effects: [{ kind: 'setFlag', flag: 'oni-cleared' }, ...tally(), { kind: 'gold', amount: 130 }] },
  },
  'onihold-done': {
    id: 'onihold-done', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The fort at the middle pass stands empty, its horn silent on the wall. {wren}\'s scouts have been through. They have chalked a small arrowhead by the gate, pointing up.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  redden: {
    id: 'redden', kind: 'battle', encounterId: 'red-dragon-den', mapId: 'firepit',
    intro: [
      'You smell the den before you see it: woodsmoke with a hot, metal edge. In a scorched bowl of hillside, something has built a forge-hall out of split rock and cinders. Its kobolds tend heaps of half-melted treasure with the care of jewellers.',
      'On the largest heap lies a red **wyrmling** with one eye open. It rises to meet you, burning with its own light.',
    ],
    again: ['The forge-hall still smokes in its scorched bowl. The red wyrmling rises off its heap again, burning with its own light, and its kobolds run for cover.'],
    onWin: { to: 'hills', text: ['The wyrmling\'s fire goes out from the inside, and it is finally, simply small. Its half-melted hoard cools into heavy lumps of real gold, and {bram} will weigh every one twice before he pays.',
      'The stone\'s song dips, and {nettle}\'s voice comes down the wind with it. "That one was promised a war. Never mind." She sounds bored.'],
      effects: [{ kind: 'setFlag', flag: 'red-cleared' }, ...tally(DEN_TICKS), { kind: 'gold', amount: 120 }] },
  },
  'redden-done': {
    id: 'redden-done', kind: 'story', art: { emoji: '🔥' },
    text: ['The burning den has gone cold. Rain has found the scorched bowl, and green shoots are coming up through the ash.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  gorgonvale: {
    id: 'gorgonvale', kind: 'story', art: { emoji: '🗿' },
    again: ['The gorgon still grazes at the head of the valley of statues, its head down. Steam curls from its iron nostrils. It is not looking your way.'],
    // {wren}'s notes (`wren-brief`) already named the beast and called the
    // statues too good; without them, the valley says both itself.
    text: [
      { if: [{ kind: 'notFlag', flag: 'wren-brief' }],
        text: 'The statues in this valley are far too good. One is a shepherd caught mid-stride, with one arm flung up. One is a wolf turning to run. One is a hired sword with his blade half drawn, and a look on his face you can read from thirty paces.' },
      { if: [{ kind: 'flag', flag: 'wren-brief' }],
        text: 'The statues stand in the grass just as {wren} said. One is a shepherd caught mid-stride, with one arm flung up. One is a wolf turning to run. One is a hired sword with his blade half drawn, and a look on his face you can read from thirty paces.' },
      'At the head of the valley, a bull made of black iron plates grazes between them. Steam curls from its nostrils in the cold air, and wherever the steam drifts, the grass has gone grey and brittle.',
      { if: [{ kind: 'notFlag', flag: 'wren-brief' }],
        text: 'Someone has scratched one word into the rock at the shepherd\'s feet, in big, shaky letters: **GORGON**.' },
      'The bull has not noticed you yet.',
    ],
    next: [
      // Wren's clue: the statues' purses lie at their feet. One try, and the
      // gorgon stays to be fought (or left) either way.
      { id: 'rob', label: 'Rob the statues without waking it', to: 'gorgonvale-sneak', once: true },
      { id: 'fight', label: 'Go in blade-first', to: 'gorgonvale-fight' },
      { id: 'leave', label: 'Back away before it looks up', to: 'hills' },
    ],
  },
  'gorgonvale-sneak': {
    id: 'gorgonvale-sneak', kind: 'challenge', art: { emoji: '🗿' }, noBack: true,
    intro: [
      'The statues stand in crooked rows, and their purses lie in the grass at their feet, where the stone belts let go of them. The gorgon grazes at the far end with its back half turned. Its iron plates creak as it chews.',
      'One wrong step on the loose rock, and you join the collection.',
    ],
    approaches: [
      { id: 'creep-notes', label: 'Creep in while it grazes',
        skill: 'stealth', dc: 11, requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true },
      { id: 'creep', label: 'Creep from statue to statue', hint: 'Keep a stone body between you and it at every step.',
        skill: 'stealth', dc: 14, requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true },
      { id: 'watch', label: 'Wait for it to doze', hint: 'Watch until its head droops, then walk in on its blind side.',
        skill: 'perception', dc: 14 },
    ],
    success: { to: 'hills', text: [
      'You work down the rows with soft hands, gathering purses out of the grass. A hired sword\'s flask of healing lies by his stone boot.',
      'The gorgon chews on and does not look up. You are back on the trail before your hands stop shaking.',
    ], effects: [{ kind: 'gold', amount: 90 }, { kind: 'addItem', itemId: 'potion-greater-healing' }] },
    failure: { to: 'gorgonvale-woken', text: ['A stone arm snaps off under your elbow and hits the rock like a dropped bell. Across the valley, the gorgon\'s head comes up.'] },
  },
  'gorgonvale-fight': {
    id: 'gorgonvale-fight', kind: 'battle', encounterId: 'gorgon-maze', mapId: 'corridor',
    intro: ['The gorgon\'s head comes up, and its breath comes with it. A rolling green vapour turns the grass it touches into grey stalks of stone. It charges through its own statues with its iron plates thundering, and the valley becomes a maze of stone people with you inside it.'],
    onWin: GORGON_WON,
  },
  // Caught robbing the statues: the same fight, on the gorgon's terms.
  'gorgonvale-woken': {
    id: 'gorgonvale-woken', kind: 'battle', encounterId: 'gorgon-maze', mapId: 'corridor', surprise: 'party',
    intro: ['The gorgon swings round, and its breath comes rolling down the rows. The green vapour turns the grass to grey stalks of stone. It charges through its own statues, and the maze closes in around you.'],
    onWin: GORGON_WON,
  },
  'gorgonvale-done': {
    id: 'gorgonvale-done', kind: 'story', art: { emoji: '🗿' },
    text: ['The statues stand silent in their crooked rows. Nothing grazes between them now.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },
  // The hall: talk the two heads into a fight with each other (easier with
  // Wren's notes; one try either way), or draw steel.
  steading: {
    id: 'steading', kind: 'story', art: { emoji: '🏚️' },
    text: [...STEADING_INTRO,
      { if: [{ kind: 'flag', flag: 'wren-brief' }], text: 'In the margin of {wren}\'s map, beside the hall, she has written: *Two heads. Never agree. Use that.*' }],
    again: ['The ettin is back in the yard of its hall, both heads still arguing about the valley. They stop when they see you.'],
    next: [
      { id: 'agree-notes', label: '[Deception DC 11] Agree with both heads at once', to: 'steading-talked',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'steading', check: { skill: 'deception', dc: 11, failTo: 'steading-balked' } },
      { id: 'agree', label: '[Deception DC 14] Agree with both heads at once', to: 'steading-talked',
        requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'steading', check: { skill: 'deception', dc: 14, failTo: 'steading-balked' } },
      { id: 'fight', label: 'Draw steel', to: 'steading-roused' },
    ],
  },
  'steading-talked': {
    id: 'steading-talked', kind: 'story', noBack: true, art: { emoji: '🏚️' },
    text: STEADING_PARLEY,
    next: [{ id: 'ok', label: 'Climb on past the empty hall', to: 'hills', effects: STEADING_TALKED }],
  },
  // The talk spent and failed: the ettin's two heads have heard enough.
  'steading-balked': {
    id: 'steading-balked', kind: 'story', noBack: true, art: { emoji: '🏚️' },
    text: ['You tell the left head the valley is its own. The right head hears you say it, and it does not like it one bit.'],
    next: [{ id: 'fight', label: 'Draw steel', to: 'steading-roused' }],
  },
  'steading-roused': {
    id: 'steading-roused', kind: 'battle', encounterId: 'giants-hall', mapId: 'ruins',
    intro: ['The ettin lifts both its clubs. For once both heads want the same thing, and the thing is you. The ogres spit out their breakfast. Their orc ducks behind them all.'],
    again: ['The ettin lifts both its clubs again, and both heads still want the same thing. The ogres are on their feet this time, and their orc is already behind them all.'],
    onWin: STEADING_WON,
  },
  // The ogre-mage took the bait: its warband hit the hall first, and the
  // company arrives at the end of that fight. The
  // same roster still stands (a lighter one would need its own encounter), but
  // it is beaten up and quarrelling, so the parley comes cheaper.
  'steading-raided': {
    id: 'steading-raided', kind: 'battle', encounterId: 'giants-raided', mapId: 'ruins',
    intro: [
      'Above the tree-line stands the giants\' hall, and you arrive at the end of its fight. Fire is eating half the roof. Dead orcs from the ogre-mage\'s warband lie in the yard, and the ettin\'s ogres lie among them. Of the ogre-mage itself there is only a trail of blue blood, leading away over the rocks.',
      'The **ettin** comes out at the first scrape of your boots, limping. "YOU let them in," roars the left head. "YOU were asleep," roars the right. A skinny orc runner stumbles out behind it. All three of them notice you at once.',
    ],
    again: ['The giants\' hall is still burning. The ettin limps out into the yard again, its two heads still arguing about the raid. The orc runner stumbles after it.'],
    onWin: { to: 'hills', text: ['The ettin goes down still blaming itself, one head at a time. The orc runner falls across its legs. The ogre-mage\'s warband left its war-chest in the yard, and the hall holds the ettin\'s tribute too.'],
      effects: [{ kind: 'setFlag', flag: 'steading-cleared' }, ...tally(), { kind: 'gold', amount: 190 }] },
    parley: {
      skill: 'deception', dc: 11, label: 'Ask each head whose fault the raid was',
      refused: ['"YOUR fault," roars the left head, and points a club at you. "YOUR fault," the right head agrees.'],
      success: { to: 'hills', text: [
        'You ask the left head whose fault the raid was, and then you ask the right head. That is all it takes.',
        'The two heads fall to brawling across the yard, through what is left of the wall, and down the back of the mountain. The orc runner limps after it, shouting.',
      ], effects: STEADING_TALKED },
    },
  },
  'steading-done': {
    id: 'steading-done', kind: 'story', art: { emoji: '🏚️' },
    text: ['The giants\' hall stands hollow, its doorway a bright rectangle of sky. {vex} will want it for a forward post. {wren}\'s scouts have claimed the roof.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'hills' }], noBack: true,
  },

  // === ACT 3 — THE CALLING ===============================================
  // The clutch path: any wyrm den left standing means the brood masses on
  // the ridge and must be fought through to reach the stone.
  // The first time, the Calling peaks (see PEAK_NOW); after a sixth morning
  // that got there first, the brood is already on the rim.
  'calling-gate': {
    id: 'calling-gate', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [...RIDGE_SIGHT, ...RIDGE_NIGHT,
      { if: [hasNot('calling-peaked')], text: 'At first light, wingbeats ride the wind. Something is circling over the far rim of the bowl, shrieking, and it has seen you.' },
      { if: [has('calling-peaked')], text: 'Wingbeats ride the wind. Something is circling over the far rim of the bowl, shrieking, and it has seen you.' },
    ],
    next: peakWays((effects, also) => broodChoices(effects, also)),
    noBack: true,
  },
  // The den-raiding payoff: all three dens emptied, so the brood never masses.
  'calling-gate-clear': {
    id: 'calling-gate-clear', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [...RIDGE_SIGHT, ...RIDGE_NIGHT,
      { if: [hasNot('calling-peaked')], text: 'At first light, nothing moves overhead. The rim is bare, and only old scorch marks show where wyrms once perched.' },
      { if: [has('calling-peaked')], text: 'Nothing moves overhead. Old scorch marks blacken the bare rim where wyrms once perched, and you cross the ridge with the wind for company.' },
    ],
    again: ['You come back over the last ridge. Below you the bowl and the stone wait in their bruised light, and nothing moves on the rim.'],
    next: peakWays((effects, also) => [{ id: 'down-council', label: 'Go down into the bowl', to: 'war-council', hideWhenBlocked: true,
      requires: [...also, hasNot('rim-clear')], effects }]),
    noBack: true,
  },
  'ridge-quiet': {
    id: 'ridge-quiet', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: ['The ridge lies still, and no wings ride the wind. Below you, the bowl and the stone wait in their bruised light.'],
    next: goDown(), noBack: true,
  },
  // The war council: the camp comes up behind the company, and whoever owes
  // it from Parts 1–2 comes too (see OWED / COUNCIL).
  'war-council': {
    id: 'war-council', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '⚔️' },
    // Every way here crosses the ridge, where the Calling peaks (PEAK_NOW).
    assumes: [has('calling-peaked')],
    text: [
      'Before you start down, horns sound behind you. {vex} has marched the forward column up through the passes you cleared, and his pikes spread out along the rim to hold it.',
      // The night at the camp, as he tells it, unless the company went down
      // and saw the morning after for itself (PEAK_WHEN).
      { if: [{ kind: 'count', flag: 'peak-seen', below: 1 }, peakAtLeast(TALLY_HIGH)],
        text: '{vex}\'s boots are white with rock-dust from the climb, but his eyes are clear. "The night went our way," he says. "I didn\'t bury anyone."' },
      { if: [{ kind: 'count', flag: 'peak-seen', below: 1 }, has(PEAK_HELD), hasNot(PEAK_TALLY)],
        text: '{vex} has not slept, and there is a bandage round one hand. "We held," he says. "It cost. I have a list of names in my coat."' },
      { if: [{ kind: 'count', flag: 'peak-seen', below: 1 }, hasNot(PEAK_HELD)],
        text: '{vex} is grey with smoke, and his column is half the size it ought to be. "We held," he says. "Only just. Don\'t ask me for the count."' },
      // One line for each debt that holds (see OWED); text only, so free.
      // {wren} climbed with the column, from the camp: she was on neither
      // the ridge nor in the bowl until now.
      { assumes: [{ kind: 'noCompanion', companion: 'wren' }], text: '{wren} is first up the last slope, bow on her back and map under her arm.' },
      { if: [peakAtLeast(TALLY_HIGH), { kind: 'npc', npc: 'wren', attitude: { atLeast: 0 } }],
        text: '"My riders were on the east line all night," {wren} says. "Every one of them came back."' },
      // Her attitude decides whether she has a seat at all (see SEATS).
      { if: [{ kind: 'noCompanion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }],
        text: 'While the pikes dig in, she drops over the lip of the bowl and is gone. She comes back up with chalk on her fingers, and finds your end of the rim before she reports to {vex}. "There\'s a seam in that stone," she says quietly. "I chalked it. Take me down, and I\'ll show you where."' },
      { if: [{ kind: 'noCompanion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
        text: 'She reports to {vex} first. You get a nod, later. When {vex} asks who is going down with you, she says the rim needs its scout more than you do.' },
      { if: [{ kind: 'npc', npc: 'halden', fate: 'saved' }], text: 'Brother {halden} climbs with his prayer book under his arm, red in the face and still praying.' },
      { if: [{ kind: 'npc', npc: 'vex', fate: 'turned' }], text: '{hask} walks at {vex}\'s shoulder: the chief\'s old guard, grey and scarred, the one you never had to fight. He gives you one short nod and looks down at the bowl.' },
      { if: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }], text: '{vex} holds this column on the reeve\'s terms. Two of the reeve\'s pikemen walk behind him, close enough to count his steps.' },
      // People from the valley, if its regard sent any (see REGARD).
      { if: [regard({ atLeast: 2 })], text: '{^rope-bearers} come up behind the pikes, mud to the knees, with coils of rope over their shoulders. "The valley owes you a rope at least," one of them says.' },
      // Vex's send-off, by how many are owed a seat (see SEATS): one, two or
      // all three (two seats at most), or no one (below).
      ...SEAT_OWED_MIXES.map(({ requires, owed }): Para => ({ if: requires,
        text: `"We hold the ridge. You go down," {vex} says. "That was the whole plan, until people started following you up mountains." He jerks a thumb along the rim. ${vexSeats(owed)}` })),
      { if: [{ kind: 'npc', npc: 'wren', attitude: { below: 0 } }, { kind: 'npc', npc: 'halden', notFate: ['saved'] }, { kind: 'npc', npc: 'vex', notFate: ['turned'] }, regard({ atLeast: 2 })],
        text: '"We hold the ridge. You go down," {vex} says. "Take the fen-folk\'s rope. No one else up here is going down with you, and a small party\'s a quiet one."' },
      { if: [{ kind: 'npc', npc: 'wren', attitude: { below: 0 } }, { kind: 'npc', npc: 'halden', notFate: ['saved'] }, { kind: 'npc', npc: 'vex', notFate: ['turned'] }, regard({ below: 2 })],
        text: '"We hold the ridge. You go down," {vex} says. He looks along the rim, where no one from the valley has come to see you off. "That\'s the whole plan. A small party\'s a quiet one."' },
    ],
    next: COUNCIL,
  },
  'war-council-table': {
    id: 'war-council-table', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '⚔️' },
    text: [
      { if: [{ kind: 'flag', flag: 'fen-ropes' }],
        text: 'The fen-folk show you how a drowning-rope loops under the arms. "It pulls the drowned out of deep water," one says. "It will pull a hag out of a rock."' },
      'The column digs in along the rim. {vex} waits at the edge of the bowl, and the faces from the valley wait to hear what else you need.',
    ],
    next: COUNCIL,
  },
  // Back at the ridge after falling back from the clutch.
  'clutch-again': {
    id: 'clutch-again', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: ['The brood still circles the rim of the bowl, shrieking. They watched you go, and they have been waiting for you to come back.'],
    next: broodChoices(),
  },
  ...broodScenes(),
  'calling-approach': {
    id: 'calling-approach', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: [
      'Down in the bowl, **{nettle}** is waiting at the foot of the stone, and beside her the younger sister, **{sedge}**. They have pushed their green fingers to the knuckle into the black rock. Old letters ring its base, filled with lead like the letters on the {warden}\'s door under the fen.',
      { if: [{ kind: 'flag', flag: 'manticore-sent' }],
        text: 'On a ledge above the bowl crouches the manticore from the toll-cliff. It came up here to collect its meal from the hags. It watches the sisters, and licks its lips, and waits to see who wins.' },
      // The one line that cannot be worded true of both Part 1 endings: she
      // was killed, or bound back to her door (Part 1's BIND_HAG). A cold
      // start has neither fate, and hears the first.
      { if: [{ kind: 'npc', npc: 'reedwife', notFate: ['bound'] }],
        text: 'The sisters are pouring their own lives into the stone to keep it singing, and their faces are burning down like candles. "Sister-killers," {nettle} says, without turning around. "Our sister had kept the door under the fen since before your grandmothers\' grandmothers. One {door-price} at the water\'s edge each {door-midwinter}, and the {warden} slept. That was the price, and it was paid. You cut her down in the chief\'s hall, and you left that door to a priest\'s book."' },
      { if: [{ kind: 'npc', npc: 'reedwife', fate: 'bound' }],
        text: 'The sisters are pouring their own lives into the stone to keep it singing, and their faces are burning down like candles. "Binders," {nettle} says, without turning around. "Our sister had kept the door under the fen since before your grandmothers\' grandmothers. One {door-price} each {door-midwinter}, and the {warden} slept. You beat her in the chief\'s hall and tied her back to that door with her own words. She takes your {door-price} now like a dog on a leash, and a leashed keeper keeps nothing. So we take the valley, and she walks free."' },
      '{sedge} does not turn either. Her voice is raw, and you have heard it before, on the wind. "Not one of you ever thanked her. You never even knew her name. One of your reed-cutters came down to the bank and sold her the shallows, and your valley stood by and let him." {nettle} goes on as if her sister had not spoken. "So we did what she did. She bought a reed-cutter with a valley. We bought these hills with the same coin, one promise at a time."',
      'The light around the stone thickens, and the ground beneath it begins, gently, to burn. "But you came so far," {nettle} says. "Stay. The last of the collection is arriving now. Out of the fire, and out of the ground."',
      // The sisters' tells, said before the answer (see REPLIES): {nettle}'s
      // temper loosens her grip, owning the debt digs her in, and {sedge}
      // is listening for something else.
      '{nettle}\'s hands shake in the rock. "Well?" she says. "Say you owe it, and I will hold on until it is paid." {sedge} has not looked at you once. She is looking down the mountain, toward the marsh.',
    ],
    next: replyChoices,
  },
  // Back in the bowl after falling back or a defeat. The sisters are either
  // torn loose (`sisters-loose`) or sunk in the stone to the shoulder
  // (`stone-spent`); nothing else lets a party leave the bowl.
  'calling-return': {
    id: 'calling-return', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: [
      'You climb back down into the bowl. The burning ground has spread while you were gone, and the stone\'s note has not changed.',
      { if: [{ kind: 'flag', flag: 'sisters-loose' }],
        text: 'The sisters wait at the foot of the stone, out of the rock where you tore them loose. Their burned hands still curl like claws. "Back again," {nettle} says. "Good. The account is still open." {sedge} says nothing at all.' },
      { if: [{ kind: 'flag', flag: 'stone-spent' }],
        text: 'The sisters still stand sunk to the shoulder in the stone. They do not turn to look at you. The crack across the floor glows red, and the ground heaves under your boots as the stone gets ready to spend them again.' },
    ],
    next: TO_STONE,
  },
  'answer-defiant': {
    id: 'answer-defiant', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: [
      '{nettle} laughs, a dry rustle with no breath behind it. "She grew greedy at the end. We do not deny it. But for {door-kept} she kept that door, and not one of the dead walked. Set that against your carters."',
      { if: [{ kind: 'flag', flag: 'hollow-road:captives-freed' }],
        text: '"We took her pen apart ourselves," you tell her. "Everyone in it walked home." {nettle}\'s lip curls. "Very brave. And the next season, the dead walked out of their graves."' },
      '{sedge} does not laugh. "Ask your barrows what her fall bought you," she says, very quietly, and turns back to the stone. {nettle} rounds on you instead, and her hands come half out of the rock as she does. Her song climbs, louder and angrier than before, and the burning ground creeps toward your boots.',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '"She took people off the marsh road," {wren} says under her breath, her bow drawn. "I wrote their names down for the reeve. I can still say every one."' },
    ],
    next: stoneChoices('tear-loose-defiant'), noBack: true,
  },
  'answer-rueful': {
    id: 'answer-rueful', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['For one breath, the song falters. {sedge} turns her burning face toward you. "Sorry," she says slowly, as if no one has ever said the word to her before. "Sorry does not put the dead back to sleep. It does not undo what you did to her. But I heard it."',
      '{nettle} does not turn. "Then you own the debt," she says, and her hands sink deeper into the rock. "Good. Owed is owed."',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} lets her bowstring ease a finger\'s width. "That\'s the first time anyone\'s said it," she murmurs. "Somebody should have."' }],
    // An answer that owns the wrong opens the vigil (see vigilScene): ask
    // Sedge to keep the door. One try at the whole of it; or face the stone,
    // with Nettle dug in to collect (`tear-loose-rueful`).
    next: [
      { id: 'vigil', label: 'Ask {sedge} to take up her sister\'s vigil', to: 'vigil-rueful',
        once: true, hideWhenBlocked: true,
        requires: [{ kind: 'notFlag', flag: 'sisters-loose' }, { kind: 'notFlag', flag: 'stone-spent' }] },
      ...stoneChoices('tear-loose-rueful'),
    ],
    noBack: true,
  },
  // The truth, for every company: no one in the valley knew what she kept.
  'answer-unknowing': {
    id: 'answer-unknowing', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['{nettle} laughs without turning round. "Not knowing pays nothing."',
      '{sedge} turns her burning face toward you, and looks at you for a long time. "No," she says. "You did not know. None of you ever asked." The song goes on, but she has stopped singing it.',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '"It\'s true," {wren} says beside you. "I scouted that fen for the reeve, and I never knew either."' }],
    next: [
      { id: 'vigil', label: 'Ask {sedge} to take up her sister\'s vigil', to: 'vigil-unknowing',
        once: true, hideWhenBlocked: true,
        requires: [{ kind: 'notFlag', flag: 'sisters-loose' }, { kind: 'notFlag', flag: 'stone-spent' }] },
      ...TO_STONE,
    ],
    noBack: true,
  },
  // The chief's sale named, and he still lives (see REPLIES).
  'answer-sold': {
    id: 'answer-sold', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    assumes: [{ kind: 'npc', npc: 'vargan', fate: 'spared' }],
    text: [
      // She reacts to what the answer just told her (SOLD_REPLIES).
      '{sedge} turns her burning face toward you for the first time. "Cutting reeds," she says. "In my sister\'s water." She is quiet a moment. "So he still lives off her. And your valley lets him."',
      '{nettle} laughs without turning round. "Two names on the account, then. His for the selling, and yours for the chief\'s hall. I can collect from both." Her song climbs, louder than before.',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '"His name was first on the reeve\'s list," {wren} says quietly. "I wrote it there myself."' },
      '{sedge} has stopped singing. Her hands are still in the rock, but she is listening.',
    ],
    next: [
      { id: 'vigil', label: 'Ask {sedge} to take up her sister\'s vigil', to: 'vigil-sold',
        once: true, hideWhenBlocked: true,
        requires: [{ kind: 'notFlag', flag: 'sisters-loose' }, { kind: 'notFlag', flag: 'stone-spent' }] },
      ...stoneChoices('tear-loose-sold'),
    ],
    noBack: true,
  },
  // The chief's sale named, by the company that killed him for it.
  'answer-sold-dead': {
    id: 'answer-sold-dead', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    assumes: [{ kind: 'npc', npc: 'vargan', fate: 'dead' }],
    text: [
      '{sedge} turns her burning face toward you. "The reed-cutter," she says. "You killed him as well. We heard how." She turns back to the stone. "Then who is left to answer for the water?"',
      '{nettle} only nods. "Paid," she says, like a clerk drawing a line through a name. "His share is closed. Yours is open."',
    ],
    next: TO_STONE, noBack: true,
  },
  'answer-cold': {
    id: 'answer-cold', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: [
      'You say nothing. The ring of your blade leaving its sheath is your whole answer.',
      '{sedge} flinches, and just for a moment she looks afraid. Her hands slip a finger\'s width out of the rock before she pushes them back in. {nettle} only nods. "Then come and pull us out," she says. "If you can."',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: 'Beside you, {wren} draws an arrow to her cheek. Her hands are shaking. She steadies them on purpose, one finger at a time.' },
    ],
    next: stoneChoices('tear-loose-cold'), noBack: true,
  },
  // One `tear-loose` per answer's mood, sound and cracked (see tearLoose).
  ...Object.fromEntries((['', 'rueful', 'defiant', 'cold', 'sold'] as const).flatMap((mood) => {
    const id = mood ? `tear-loose-${mood}` : 'tear-loose';
    const open = mood === 'defiant' ? TEAR_OPEN_DEFIANT : TEAR_OPEN;
    return [
      [id, tearLoose(id, [open, TEAR_STAKES], 'sisters-battle', 'calling-battle', mood || undefined)],
      [id + CRACK, tearLoose(id + CRACK, [open, ...TEAR_CRACKED, TEAR_STAKES], 'sisters-battle' + CRACK, 'calling-battle' + CRACK, mood || undefined)],
    ];
  })),
  // Torn loose: the sisters fall fighting, beside the one elemental the stone
  // still had the strength to raise.
  'sisters-battle': {
    id: 'sisters-battle', kind: 'battle', encounterId: 'sisters-at-stone', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The sisters come at you with green claws and burning faces. "Then we collect by hand," {nettle} says. {sedge} says nothing. She is weeping, and she comes at you all the same. Behind them, the crack in the floor gives up the last thing the stone has the strength to raise. A pillar of living fire climbs out and turns toward you.'],
    again: ['"Then we collect by hand," {nettle} says again, and the sisters come at you with their burned claws. {sedge} is still weeping. Behind them, the pillar of living fire turns toward you once more.'],
    onLoss: STONE_LOST_SISTERS,
    onWin: { to: 'calling-won', text: ['{nettle} falls first, clawing at your boots, still telling you what you owe. {sedge} falls calling a name no one in the valley ever knew, and then cursing you. Where they lay there is only a scatter of dry reeds, and the coin of a hundred old bargains, green with fen-water. The fire gutters out of the air.',
      'The black fang has no one left to spend. It cracks from top to bottom, and the {calling} stops: not with thunder, but with the huge, ringing quiet of a held note let go.'],
      effects: [{ kind: 'gold', amount: 200 }] },
  },
  // The same fights with the Warden's dead at your ankles (see CRACKED): the
  // company starts a round behind.
  'sisters-battle-cracked': {
    id: 'sisters-battle-cracked', kind: 'battle', encounterId: 'sisters-at-stone', mapId: 'firepit',
    loot: { bonusTier: 'rare' }, surprise: 'party',
    intro: ['The sisters come at you with green claws and burning faces. Grey hands still hold your ankles, and you are still kicking free when the sisters reach you. "Then we collect by hand," {nettle} says. {sedge} is weeping, and she comes at you all the same. Behind them, a pillar of living fire climbs out of the crack and turns toward you.'],
    again: ['Grey hands catch at your ankles again as the sisters come at you, claws out. {sedge} is still weeping, and behind them the pillar of living fire turns toward you once more.'],
    onLoss: STONE_LOST_SISTERS,
    onWin: { to: 'calling-won', text: ['{nettle} falls first, clawing at your boots, still telling you what you owe. {sedge} falls calling a name no one in the valley ever knew, and then cursing you. Where they lay there is only a scatter of dry reeds, and the coin of a hundred old bargains, green with fen-water. The fire gutters out of the air.',
      'The black fang has no one left to spend. It cracks from top to bottom, and the {calling} stops: not with thunder, but with the huge, ringing quiet of a held note let go.'],
      effects: [{ kind: 'gold', amount: 200 }] },
  },
  // Sedge said yes: she drags her sister out of the stone and takes her down
  // to the fen, to keep the Warden's door. The Calling dies with nobody
  // feeding it. No last fight, and no hoard either. Whatever reason moved
  // her was said in the vigil's own beat (see vigilScene).
  'vigil-kept': {
    id: 'vigil-kept', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🚪' },
    text: [
      '{sedge} looks down at her own hands, sunk to the wrist in the stone. She pulls them out. The stone screams, and {nettle} screams with it, and {sedge} takes her sister by both wrists and drags her free of the rock.',
      'With no one feeding it, the {calling} falters. The black fang cracks from top to bottom, and the fire in the floor of the bowl sinks back into the rock. There is only the wind.',
      '"We will keep the door," {sedge} says. "She did not keep it all those winters for nothing. And we will take one {door-price} at {door-midwinter} and no more, as our sister did before she grew greedy. Do not come into our fen again." {nettle} says nothing. She only looks at you, the way you look at a debt you mean to collect.',
      // Bound in Part 1 (BIND_HAG): their sister is alive, held at her door.
      { if: [{ kind: 'npc', npc: 'reedwife', fate: 'bound' }],
        text: '"Our sister is at that door still, on the leash you tied," {sedge} says. "We will stand it beside her. Three keepers need no leash."' },
    ],
    next: walkDown(0, 'vigil-down-with', 'vigil-aftermath', 'Watch them walk down the mountain toward the fen',
      [{ kind: 'xp', amount: 1200 }]),
  },
  ...walkDownScenes('vigil-down-with', 'vigil-aftermath'),
  // Every reason spent, and Sedge still says no: the stone, as the answer left it.
  'vigil-refused-rueful': {
    id: 'vigil-refused-rueful', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['{sedge} slowly shakes her head. "She kept that door so that you could sleep soundly, and you broke her for it. Now you want me to do the same? No." {nettle}\'s hands sink another inch into the rock. "I could have told you," she says. The stone drinks deeper, and the burning ground creeps toward your boots.'],
    next: stoneChoices('tear-loose-rueful'),
  },
  'vigil-refused-unknowing': {
    id: 'vigil-refused-unknowing', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['{sedge} slowly shakes her head. "She kept that door so that you could sleep soundly, and none of you ever asked her name. Now you want me to do the same? No." {nettle} hisses at her to hold still. "I told you. Not knowing pays nothing." The stone drinks deeper, and the burning ground creeps toward your boots.'],
    next: TO_STONE,
  },
  'vigil-refused-sold': {
    id: 'vigil-refused-sold', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['{sedge} slowly shakes her head. "One of yours sold her the water, and the rest of you broke her for drinking it. Now you want me to sit in her dark for you? No." {nettle} does not even look round. "Two names," she says. The stone drinks deeper, and the burning ground creeps toward your boots.'],
    next: stoneChoices('tear-loose-sold'),
  },
  'vigil-rueful': vigilScene('rueful'),
  'vigil-unknowing': vigilScene('unknowing'),
  'vigil-sold': vigilScene('sold'),
  'vigil-aftermath': {
    id: 'vigil-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      'You reach the war-camp at dusk with {vex}\'s column, a long way behind the sisters. They walked through the pikes on the rim without a word from anyone, and through the camp\'s lines the same way. The camp has not decided yet whether to cheer.',
      '{vex} decides for it. "The {calling}\'s broken," he says, loud enough to carry. He says the next part more quietly. "Hags in the fen again. I watched them walk through my own line." You tell him they\'re keepers now. He is quiet a while. "Then I hope they keep," he says.',
      { if: [{ kind: 'noCompanion', companion: 'wren' }],
        text: '**{wren}** has kept an arrow on the string since the two hags walked through the line on the rim. At the camp gate she puts it back in her quiver at last, and sits down hard, laughing.' },
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} goes straight to the scouts\' fire. Her riders crowd round her, and she tells them about the hags in the fen before anyone can ask. Afterwards she sits down hard, and laughs until she has to wipe her eyes.' },
    ],
    next: [
      { id: 'pay', label: 'Accept the valley\'s purse', to: 'vigil-purse',
        effects: [{ kind: 'gold', amount: 250 }] },
      ...TO_VIGIL_EPILOGUE,
    ],
    noBack: true,
  },
  'vigil-purse': {
    id: 'vigil-purse', kind: 'story', art: { imageId: 'loc-camp', emoji: '💰' },
    text: ['Every village in the valley paid into the purse, and a farmer from each one comes up to shake your hand. A few of them ask about the fen. Most of them do not want to know.'],
    next: TO_VIGIL_EPILOGUE, noBack: true,
  },
  'calling-battle': {
    id: 'calling-battle', kind: 'battle', encounterId: 'elemental-cataclysm', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The sisters pour the last of themselves into the stone, and the stone spends it all at once. The floor of the bowl splits along a burning crack. A pillar of living fire climbs out of it, and the mountain\'s own bones heave up beside it into a shape with fists. The sisters sink into the rock to the shoulder, and they do not let go. "Take it all," {nettle} tells the stone. "Every drop we owe." {sedge} only whispers her sister\'s name. The {calling} rises to one last note, and everything it raised turns toward you.'],
    again: ['The stone spends the sisters again. The pillar of fire and the shape of mountain bone climb out of the burning crack, and everything the {calling} raised turns toward you.'],
    onLoss: STONE_LOST_CALLING,
    onWin: { to: 'calling-won', text: ['The stone takes the last of the sisters. {nettle} goes smiling, and {sedge} goes with her sister\'s name still on her lips. A few dry reeds are all that is left of them, and the coin of a hundred old bargains, green with fen-water.',
      'The fire gutters out of the air, and the shape of mountain bone shakes itself apart into rubble. The black fang has nothing left to spend. It cracks from top to bottom, and the {calling} stops: not with thunder, but with the huge, ringing quiet of a held note let go.'],
      effects: [{ kind: 'gold', amount: 200 }] },
  },
  'calling-battle-cracked': {
    id: 'calling-battle-cracked', kind: 'battle', encounterId: 'elemental-cataclysm', mapId: 'firepit',
    loot: { bonusTier: 'rare' }, surprise: 'party',
    intro: ['The sisters pour the last of themselves into the stone, and the stone spends it all at once. A pillar of living fire climbs out of the burning crack. The mountain\'s own bones heave up beside it into a shape with fists. Grey hands push up through the cracks and hold your ankles fast. "Take it all," {nettle} tells the stone. "Every drop we owe." The {calling} rises to one last note, and everything it raised turns toward you.'],
    again: ['The stone spends the sisters again, and grey hands hold your ankles fast. The pillar of fire and the shape of mountain bone climb out of the burning crack toward you.'],
    onLoss: STONE_LOST_CALLING,
    onWin: { to: 'calling-won', text: ['The stone takes the last of the sisters. {nettle} goes smiling, and {sedge} goes with her sister\'s name still on her lips. A few dry reeds are all that is left of them, and the coin of a hundred old bargains, green with fen-water.',
      'The fire gutters out of the air, and the shape of mountain bone shakes itself apart into rubble. The black fang has nothing left to spend. It cracks from top to bottom, and the {calling} stops: not with thunder, but with the huge, ringing quiet of a held note let go.'],
      effects: [{ kind: 'gold', amount: 200 }] },
  },
  // Beaten at the stone: {vex}'s column holds the rim above the bowl, so it
  // hauls the company up there, not off the mountain. No day passes and no
  // one rests: the party is picked up at half strength (see resolveBattle),
  // and goes back down, or back to the trail and the camp, as it is.
  'stone-lost': {
    id: 'stone-lost', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [
      'You come to on the rim, flat on your back on cold rock, with rope burns under your arms. {vex}\'s pikemen went down the slope on lines and dragged you up while the stone was busy singing.',
      '{vex} crouches beside you. Down in the bowl, the light round the stone has not dimmed at all. "You\'re still breathing," he says, and nods down at it. "So is that thing. Three of my lads went down those lines for you, and two came back up. My column holds this rim as long as it takes. Go back down when you can stand."',
    ],
    // A second defeat, the same rescue: shorter, and it costs the column again.
    again: [
      'Rope burns again, and cold rock under your back. The pikemen who hauled you up this time sit in a row along the rim, getting their breath back. There are fewer of them than before.',
      '{vex} does not crouch this time. He looks down into the bowl, and then at you. "I\'m running out of men who\'ll go down those lines," he says. "Make the next one count."',
    ],
    next: [...goDown(), { id: 'trail', label: 'Climb back down to the trail', to: 'hills' }],
  },
  'calling-won': {
    id: 'calling-won', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🌅' },
    text: [
      { if: [{ kind: 'flag', flag: CRACKED }],
        text: 'At the foot of the stone, the grey hands go limp and sink back down through the cracks, toward the fen.' },
      // The company's one line at the chapter's key beat (rule 15), unless
      // Halden is here to say the words himself (see the ending's slides).
      { if: [{ kind: 'classInParty', classId: 'cleric' }, { kind: 'noCompanion', companion: 'halden' }],
        text: 'Your cleric kneels by the dry reeds and says the short prayer for the dead over them. It is the only one the sisters will get.' },
      'Below you, pass by pass, the hills go quiet. Out on the slopes, things that were walking toward the valley stop, shake their heads, and turn back toward their own high places. The wingbeats fade off the wind.',
      'Up on the rim, {vex}\'s pikes raise a ragged cheer. Far down the slope, faint and disbelieving, the war-camp takes it up.',
    ],
    next: walkDown(0, 'down-with', 'wc-aftermath', 'Come down the mountain'),
  },
  ...walkDownScenes('down-with', 'wc-aftermath'),
  'wc-aftermath': {
    id: 'wc-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      'You reach the war-camp with {vex}\'s column at your back. The camp has stopped being an army and started being the biggest festival the valley has ever thrown.',
      'At the camp gate {vex} shakes your hand, once. "The {calling}\'s broken," he says. "Tomorrow this camp packs up and everybody goes home. Do stop now, before your luck notices you."',
      { if: [{ kind: 'noCompanion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { atLeast: 0 } }],
        text: '**{wren}** walks in beside you, with every pass on the way down marked on her map. She looks at your company, then up at the hills, and grins her whole age for once. She catches herself and goes back to giving orders.' },
      { if: [{ kind: 'noCompanion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
        text: '**{wren}** comes in behind the column, with every pass on the way down marked on her map. She nods to your company, once, and goes straight to {vex} with her report.' },
      // A Wren below 0 stayed on the rim (see SEATS).
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} hands {vex} her route report before she has even sat down. She looks back up at the hills and grins her whole age for once, and then she coughs and goes off to give orders.' },
      // The company's line at the homecoming (rule 15): the fighter's, as the
      // stone's was the cleric's.
      { if: [{ kind: 'classInParty', classId: 'fighter' }],
        text: 'Your fighter sits down on the first barrel inside the gate, and does not get up again until morning.' },
    ],
    next: [
      { id: 'pay', label: 'Accept the valley\'s purse', to: 'wc-purse',
        effects: [{ kind: 'gold', amount: 250 }] },
      ...TO_EPILOGUE,
    ],
    noBack: true,
  },
  'wc-purse': {
    id: 'wc-purse', kind: 'story', art: { imageId: 'loc-camp', emoji: '💰' },
    text: ['Every village in the valley paid into the purse, and a farmer from each one comes up to shake your hand. It takes most of the evening.'],
    next: TO_EPILOGUE, noBack: true,
  },
  'wc-defeat': {
    id: 'wc-defeat', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏕️' },
    text: [
      'You wake in the hospital tent to canvas light and the smell of stew from {bram}\'s war-stores. The scouts carried you off the mountain in relays, and you have slept a whole day away.',
      { if: [hasNot('rim-clear')], assumes: [{ kind: 'flag', flag: 'briefed' }], text: '{vex} looks in, sees that you are breathing, and sets your kit at the foot of the cot without a word. Through the tent flap, the hills are still there.' },
      // After the war council {vex} holds the rim (`stone-lost`).
      { if: [has('rim-clear')], text: '{vex}\'s clerk looks in, sees that you are breathing, and sets your kit at the foot of the cot. "The captain still holds the rim," he says. Through the tent flap, the hills are still there.' },
    ],
    // A wipe costs time: a day lost on the cot.
    next: [{ id: 'up', label: 'Get back on your feet', to: 'warcamp', effects: [{ kind: 'passDay' }] }], noBack: true,
  },
  // The ending after the last fight: its text holds for every company, and
  // the slides read the run back. Each slide stands alone, so any mix of them reads in order.
  'wc-epilogue': {
    id: 'wc-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'The valley remembers it as the year of three wars: the raiders, the graves, and the hills. The songs about the last one end at a black stone split in two, with dry reeds blowing round its foot.',
      ...MIRA_TOAST,
    ],
    slides: [
      ...SLIDES_HILLS,
      { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'The reeve has the {warden}\'s door checked each spring. The crack is a hair wider every time.' },
      // A clean seal (a cold start sealed the barrows too).
      { if: [{ kind: 'notFlag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'A fen-boy dares his friends to knock on the barrow stair. None of them do.' },
      // Beaten at the stone (`stone-lost`): the pikemen who went down the
      // lines for the company. Only this ending: a defeat there has torn the
      // sisters loose or spent the stone, so the vigil is past.
      { if: [{ kind: 'count', flag: RIM_DEAD, atLeast: 1 }],
        text: 'A heap of rocks stands on the rim above the broken stone. {vex}\'s pikemen went down the lines for you there, and not all of them came back up. {vex} carried the first rock himself.' },
      ...SLIDES_PEOPLE,
      { if: [{ kind: 'companion', companion: 'halden' }],
        text: 'At the broken stone, {halden} said the rites for the sisters too. No one else would have.' },
      ...SLIDES_LAST,
    ],
  },
  // The ending after Sedge took up the vigil: the Calling died unfought, and
  // there are hags in the fen again. Same slides for the hills and the people.
  'wc-epilogue-vigil': {
    id: 'wc-epilogue-vigil', kind: 'ending', outcome: 'victory', art: { emoji: '🚪' },
    text: [
      'The valley remembers it as the year of three wars: the raiders, the graves, and the hills. The songs about the last one end strangely. There is no great fight on the mountain. Two tall women walk down out of the hills and into the fen, and the {calling} stops.',
      ...MIRA_TOAST,
      '{vex} finds you at the edge of the firelight. He looks off toward the fen. "Here\'s to whoever is keeping that door tonight," he says.',
    ],
    // {vex} has had his line above, so his slide is left out here.
    slides: [
      ...SLIDES_HILLS,
      { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the knocking at the {undercrypt}\'s door stops for good. The fen-folk leave a {door-price} at the water\'s edge each {door-midwinter}, the way their grandparents did.' },
      { if: [{ kind: 'notFlag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the {warden}\'s door stays shut. Tall shapes keep watch over it now, and the fen-folk know better than to ask their names.' },
      // Bound in Part 1: the sister they came to free stands with them.
      { if: [{ kind: 'npc', npc: 'reedwife', fate: 'bound' }],
        text: 'Reed-cutters out late have seen three tall women standing in the shallows above the barrows, where for so long there was one. They go home the long way round.' },
      ...SLIDES_PEOPLE.filter((s) => !s.if.some((r) => r.kind === 'npc' && r.npc === 'vex')),
      { if: [{ kind: 'companion', companion: 'halden' }],
        text: '{halden} walks down to the edge of the deep fen each spring and reads the rites aloud. Something out in the reeds always waits until he has finished.' },
      ...SLIDES_LAST,
    ],
  },
};

export const WYRMCALLING_MODULE: Module = withCanon({
  id: 'wyrmcalling', title: 'The Wyrmcalling',
  blurb: 'The {reedwife}\'s sisters wake the {calling} Stone, and the hills answer with wyrms, giants, and worse. Climb the passes, thin what answers, and silence the stone.',
  cover: 'loc-mountain',
  levelBand: { from: 4, to: 5 },
  start: 'muster', scenes, defeatScene: 'wc-defeat', town: 'warcamp',
  // Saves from before the earlier chapters' people moved onto NPC state.
  renamedFlags: {
    ...carriedRenames('hollow-road', HOLLOW_ROAD_RENAMED_NPC_FLAGS),
    ...carriedRenames('sunken-barrows', SUNKEN_BARROWS_RENAMED_NPC_FLAGS),
    ...TRILOGY_RENAMED_FATES,
    // Part 2's deeds, carried before the ledger, become the valley's regard
    // (see REGARD). A save renames each to `true`, which a count reads as 1;
    // the first one present wins, so a company that did both arrives at 1.
    'sunken-barrows:grandfather-home': REGARD,
    'sunken-barrows:drowned-gold-home': REGARD,
  },
  // The clock: the Calling peaks the night the company reaches the last ridge
  // (PEAK_NOW), or on the sixth morning if it has not got there by then. Any
  // dragon den still standing then empties, and its wyrmlings go up to the
  // rim (den-flown). Each warning speaks only while the peak is still to come
  // (a dawn's text is read before its effects apply).
  dawns: [
    // Worded to hold wherever the party wakes: the camp, the hills, or with
    // Wren at its side.
    { day: 3, text: ['The stone\'s note is louder this morning.',
      { if: [hasNot('calling-peaked'), { kind: 'noCompanion', companion: 'wren' }],
        text: 'A rider from the scouts\' fire brings {wren}\'s word at first light. {^peak-nights} before the {calling} peaks, she reckons, and not one more.' },
      { if: [hasNot('calling-peaked'), { kind: 'companion', companion: 'wren' }],
        text: '{wren} counts on her fingers, frowning up at the passes. "{^peak-nights} before it peaks," she says. "Not one more."' }] },
    { day: 5, text: ['The stone sang all night. Loose stones crept down the slope in the dark, ticking against each other, and nothing had touched them.',
      { if: [hasNot('calling-peaked')],
        text: 'A runner from the command tent brings {vex}\'s word: he has doubled the watch. "Tonight," the message says. "Anything still in those dens will fly."' }] },
    { day: 6, text: [
      { if: [hasNot('calling-peaked')],
        text: 'The {calling} peaked in the night. The whole mountain hummed with it, and horns sounded from the war-camp until dawn. Anything still nesting in the hills has gone up to the ridge.' },
      { if: [has('calling-peaked')],
        text: 'The {calling} has not dropped since the night it peaked. The whole mountain hums with it.' }],
      // The night is judged as it stood this morning (see PEAK_TALLY). After
      // a peak at the ridge nothing has ticked the tally, so this changes nothing.
      effects: [{ kind: 'setFlag', flag: 'calling-peaked' }, ...PEAK_SNAPSHOT] },
  ],
  // The people the war council can send down into the bowl (see SEATS).
  companions: (() => {
    const c = companionsFrom(NPCS, [
      { id: 'wren', blurb: 'Chief of Scouts. She followed the column up to the rim, and she is not staying on it.' },
      'halden', 'hask',
    ]);
    // On the party screen he goes by his title, as everywhere he speaks.
    return { ...c, halden: { ...c.halden!, name: 'Brother {halden}' } };
  })(),
}, { npcs: NPCS, facts: TRILOGY_FACTS });
