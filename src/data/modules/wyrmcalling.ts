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
 * XP budget (trilogy-plan.md): required spine ≈ 9,625 (the envoy's hired
 * swords 925, the flooded seam 1,800, the oni's hold 1,650, the giants' hall 1,650,
 * cataclysm finale 3,600, or 3,200 for the sisters in person); optional
 * dens/beasts add up to ~6,000 more. A continuing company (~3,050 XP from
 * Part 2) that raids most of the hills passes L5's 6,500 honestly; `xpToLevel: 5` on stepping up to the finale is the floor
 * for a fight-shy run (or one that buys its way past the ogre-mage). Cold
 * starts are floored to L4 by the opening choice.
 *
 * CARRIED CHOICES: Vex's briefing reads `hollow-road:vex-turned` (he took the
 * party's offer in Part 1) and `hollow-road:met-vex` (they met at his fire,
 * no deal); Wren's familiarity reads `hollow-road:saved-scout` (she owes you
 * a leg) or `sunken-barrows:met-wren` (she held the Barrow Gate for you).
 * Wren also remembers a company that left her under the horse
 * (`hollow-road:scout-left`). A cold start is still the company that broke
 * the Ashfang and killed the Reedwife: Vex met it at his fire, Wren knows it
 * by name, and nothing carried says how either parting went. A saved
 * Halden (`sunken-barrows:halden-saved`) opens an easier way to tear the
 * sisters loose. The endings' slides read these and the rest
 * (`hollow-road:chief-dead`, `sunken-barrows:seal-cracked`, what became of
 * Vargan); the fen-folk's fire at the war-camp reads the cracked door too,
 * through a "you've been here" beat the reach search does not track.
 *
 * TWO ENDINGS: the sisters fall at the stone (`wc-epilogue`), or — after the
 * rueful answer and a Persuasion check — Sedge agrees to keep the vigil her
 * sister kept, drags Nettle out of the stone, and the Calling dies without a
 * last fight (`wc-epilogue-vigil`). No loot, no fight; hags in the fen again.
 *
 * WAR ASSETS: the war council on the rim, before the company goes down into
 * the bowl, is where Parts 1–2 come due (see OWED / COUNCIL): Wren, Halden
 * and Vex's man Hask can join (two at most), the freed captives
 * (`hollow-road:captives-freed`) bring potions, the old reeve carried home
 * (`sunken-barrows:grandfather-home`) brings Thornwick's watch to the camp's
 * tally, and the drowned folk's purses (`sunken-barrows:drowned-gold-home`)
 * bring ropes that make `tear-loose` easier. A cold start is owed nothing.
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
import type { Choice, Effect, Module, Outcome, Requirement, Scene } from '../../adventure/types.js';

const VEX = { id: 'npc-vex', name: 'Captain Vex', portraitId: 'npc-captain', emoji: '🗡️' };
const WREN = { id: 'npc-wren', name: 'Wren, Chief of Scouts', portraitId: 'npc-scout', emoji: '🏹' };
const BRAM = { id: 'npc-bram', name: 'Bram, War-Quartermaster', portraitId: 'npc-merchant', emoji: '🧑‍🌾' };

/** Into Vex's briefing: which version depends on what he did in Part 1 —
 *  took the party's offer, met them at his fire and didn't, or (a cold
 *  start) met them at his fire with nothing carried about a deal. Exactly
 *  one holds in every mix. */
const TO_BRIEFING: Choice[] = [
  { id: 'hear', label: 'Hear him out', to: 'vex-brief-turned',
    requires: [{ kind: 'flag', flag: 'hollow-road:vex-turned' }], hideWhenBlocked: true },
  { id: 'hear-met', label: 'Hear him out', to: 'vex-brief-met',
    requires: [{ kind: 'notFlag', flag: 'hollow-road:vex-turned' }, { kind: 'flag', flag: 'hollow-road:met-vex' }], hideWhenBlocked: true },
  { id: 'hear-new', label: 'Hear him out', to: 'vex-brief',
    requires: [{ kind: 'notFlag', flag: 'hollow-road:vex-turned' }, { kind: 'notFlag', flag: 'hollow-road:met-vex' }], hideWhenBlocked: true },
];

/** Vex's plan, the same whoever he is to you. */
const BRIEF_PLAN = [
  '"Here\'s the problem." He taps the map, where the high passes are marked fire by fire. "The stone calls, and the hills answer. There\'s a wyrm den here, here, and here. An ogre-mage holds the middle pass with a warband. An ettin\'s taken a hall above the tree-line. And there are things in the streams now that aren\'t fish."',
  '"When the Calling peaks, all of it comes down this slope at once, unless it\'s dead first." He looks up at you. "So here\'s the deal. Every den you burn out is one monster fewer on the day. Fight as many as you can reach, and my scouts will keep the map honest."',
  'A thin smile crosses his face and vanishes. "I\'d come myself, but apparently I\'m respectable now. Nobody warns you about that part."',
];

const briefed = (vexBody: string): Effect[] => [
  { kind: 'setFlag', flag: 'briefed' },
  { kind: 'journal', entry: { id: 'n-vex3', kind: 'npc', title: 'Captain Vex', body: vexBody } },
  { kind: 'journal', entry: { id: 'lead-stone', kind: 'lead', resolvedBy: 'calling-found',
    title: 'The Calling Stone', body: 'Somewhere past the ogre-mage\'s pass and the giants\' hall, the sisters are tending the stone that calls the hills down. Climb until you find it.' } },
];

/**
 * Wren's advice, the same whether she knows you or not. Every tip points at a
 * real option in the hills, and each is easier with her notes (`wren-brief`):
 * the manticore's toll (`tollcliff`), timing the stampede (`boarruns`),
 * robbing the statues quietly (`gorgonvale-sneak`), and setting the ogre-mage
 * and the ettin's two heads against each other (`onihold`, `steading-notes`).
 * Each is a pair of choices on the flag, so only one version shows.
 */
const WREN_BEASTS =
  '"The **manticore** on the toll-cliff talks. It\'ll ask you for a toll, and what it really wants is you. But it\'s greedy. Promise it a bigger meal somewhere else, and it might fly off. The **boar-runs** flood with a stampede twice a day. Watch the dust, and you can slip across between runs."';
const WREN_GORGON =
  '"There\'s a valley past the middle pass full of statues that are far too good. A **gorgon** made them. Its breath turns people to stone. Their purses are still lying at their feet. Go in quietly, or go in with your blade drawn."';
const WREN_GIANTS =
  '"The ogre-mage and the ettin both want the valley, and neither one trusts the other. The ettin\'s two heads can\'t even agree with each other. Use that."';

const TAKE_NOTES: Choice[] = [{ id: 'ok', label: 'Take her map-notes', to: 'warcamp',
  effects: [{ kind: 'setFlag', flag: 'wren-brief' }, { kind: 'xp', amount: 30 },
    { kind: 'journal', entry: { id: 'c-scoutnotes', kind: 'clue', title: 'Wren\'s Map-Notes',
      body: 'Wren said the manticore on the toll-cliff is greedy, so promise it a bigger meal somewhere else. Watch the dust at the boar-runs and slip across between stampedes. The gorgon\'s statues dropped their purses when their belts turned to stone, and anyone quiet enough can pick them up. The ogre-mage and the ettin distrust each other, and the ettin\'s two heads never agree.' } }] }];

/**
 * The camp's tally: one tick for every threat dealt with before the stone,
 * whether fought, talked down, paid off, or met on the rim. Six are on every
 * road up (the flooded pass, the middle pass, the giants' hall and the three
 * wyrmlings, in their dens or on the rim). The other three are the company's
 * choice. A den burned out counts twice (DEN_TICKS), as Vex promised: its
 * wyrmling never reaches the rim, and its kobolds never reach the camp.
 * Thornwick's watch, if Reeve Aldous sends it (see WAR ASSETS), counts for
 * two more. So the tally runs from 6 to 14. It starts at minus THREAT_PAR, so
 * the ending can read both sides of the line: `flag` (above zero) means more
 * than THREAT_PAR threats were handled, `notFlag` means THREAT_PAR or fewer.
 * Only ending slides read it, so it costs the reachability search nothing.
 */
const TALLY = 'threats-cleared';
const THREAT_PAR = 7;
const DEN_TICKS = 2;
const tally = (n = 1): Effect[] => Array.from({ length: n }, () => ({ kind: 'setFlag' as const, flag: TALLY }));

/** Out of the aftermath to the one ending; its slides read the run back. */
/** The herd got past without a fight: it lives, and it turns away. */
const HERD_SPARED: Effect[] = [{ kind: 'setFlag', flag: 'boarruns-cleared' }, { kind: 'setFlag', flag: 'herd-spared' },
  ...tally(), { kind: 'xp', amount: 150 }];

/** A missed run across the boar-runs: a pack bursts under the herd. */
const SCATTERED: Effect[] = [{ kind: 'gold', amount: -30 }];

const GORGON_WON = { to: 'hills', text: ['The gorgon crashes onto its side with a sound like a foundry falling downstairs, and the green vapour thins away to nothing. The statues keep their silent watch. But the collection is closed.'],
  effects: [{ kind: 'setFlag', flag: 'gorgon-cleared' }, ...tally(), { kind: 'gold', amount: 100 }] } satisfies Outcome;

/** The ettin talked into a fight with itself: the hall empties, no loot. */
const STEADING_TALKED: Effect[] = [{ kind: 'setFlag', flag: 'steading-cleared' }, { kind: 'setFlag', flag: 'ettin-split' },
  ...tally(), { kind: 'xp', amount: 300 }];

const STEADING_INTRO = [
  'Above the tree-line stands the giants\' hall, built from whole pine trunks and stone blocks as big as wagons. Something put it up in a single season and treated the work as simple stacking. The **ettin** that holds it comes out at the first scrape of your boots. It is two heads arguing on top of one enormous body. A shaggy ogre in a sheepskin stumbles out behind it, still chewing. A skinny orc runner trots at its heels.',
  '"THE STONE PROMISED US THE VALLEY," booms the left head. "The stone promised ME the valley," the right head corrects. Then both heads notice you at the same moment, and for the first time all day they agree about something.',
];
const STEADING_WON = { to: 'hills', text: ['The ettin goes down still arguing about whose fault it was. The orc runner lies beside it. Inside the hall you find tribute, plunder, and an entire orchard\'s worth of pickled fruit, all of it bound for the war-camp below. Two loud voices on the mountain have stopped answering the stone.'],
  effects: [{ kind: 'setFlag', flag: 'steading-cleared' }, ...tally(), { kind: 'gold', amount: 140 }] } satisfies Outcome;
/** Wren's tip: the two heads never agree. Agree with both. */
const STEADING_PARLEY = { to: 'hills', text: [
  '"The valley is yours," you tell the left head. Then you turn to the right head. "And yours." Both heads hear you say it.',
  'The ettin stands very still. Then it punches itself in the jaw. Its two heads brawl across the hall, through the back wall, and down the far side of the mountain. The ogre and the orc runner chase after it, shouting. The road to the stone stands open.',
], effects: STEADING_TALKED } satisfies Outcome;

const TO_EPILOGUE: Choice[] = [{ id: 'done', label: 'Let the valley celebrate', to: 'wc-epilogue' }];
const TO_VIGIL_EPILOGUE: Choice[] = [{ id: 'done', label: 'Let the valley celebrate', to: 'wc-epilogue-vigil' }];

/**
 * The walk down the mountain: one short beat for each companion the war
 * council sent down into the bowl, in a fixed order, then on to the camp.
 * The ending slides say what became of them; these only say they came back.
 */
const ESCORTS = ['wren', 'halden', 'hask'] as const;
const ESCORT_LINES: Record<(typeof ESCORTS)[number], string> = {
  wren: 'Wren walks down beside you, counting the passes under her breath. At each one she stops and marks the map. "For the report," she says. She does not say she is glad you are all alive. She keeps checking that you are, though.',
  halden: 'Brother Halden walks down with his prayer book shut under his arm. Halfway down he stops, holds out his hands, and looks at them. For the first time since the drowned chapel, they are not shaking.',
  hask: 'Hask walks down at the back, the way a guard should, and says nothing the whole way. At the last bend he looks back up at the broken stone. "Vex owes me a drink," he says. "Maybe two."',
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
    text: [ESCORT_LINES[c]], next: walkDown(i + 1, prefix, dest, 'Walk on down') } satisfies Scene];
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
const broodChoices = (effects?: Effect[]): Choice[] => BROODS.map((k) => ({
  id: `brood-${k}`, label: 'Meet the brood on the rim', to: `clutch-${k}`, hideWhenBlocked: true,
  requires: (['g', 'b', 'r'] as const).map((c) => (k.includes(c)
    ? { kind: 'notFlag' as const, flag: DENS[c].flag }
    : { kind: 'flag' as const, flag: DENS[c].flag })),
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
    onWin: { to: 'ridge-quiet', text: ['The last wyrmling drops out of the bruised light and does not get up. The rim is yours. The stone\'s note wavers, as if it has just counted how few voices are still answering it.'],
      // Each wyrmling killed on the rim is one that never reached the camp,
      // and one that is no longer waiting in its den to be killed again.
      effects: [{ kind: 'setFlag', flag: 'clutch-beaten' }, ...tally(k.length),
        ...[...k].map((c) => ({ kind: 'setFlag' as const, flag: DENS[c as keyof typeof DENS].flag }))] },
  } satisfies Scene];
}));

/**
 * The party's answer to the sisters at the stone. Each sets a flag the ending
 * reads; none is the right one, and the sisters have a reply for each. Only
 * the rueful one opens a door: `answer-rueful` offers the vigil (a Persuasion
 * try that ends the Calling without the last fight). The
 * level floor rides on every answer, so it lands before whichever fight comes.
 * Only the ending reads these flags, so they cost the reachability search nothing.
 */
const REPLIES = [
  { id: 'defiant', flag: 'answered-defiant', to: 'answer-defiant',
    label: '"She ate people out of a pen. We owe you nothing."' },
  { id: 'rueful', flag: 'answered-rueful', to: 'answer-rueful',
    label: '"Killing her broke the vigil. We know, and we\'re sorry for that part."' },
  { id: 'cold', flag: 'answered-cold', to: 'answer-cold',
    label: 'Say nothing. Draw your blade.' },
] as const;
const replyChoices: Choice[] = REPLIES.map((r) => ({ id: r.id, label: r.label, to: r.to,
  effects: [{ kind: 'xpToLevel', level: 5 },
    // A company that falls back and climbs again answers again; the last
    // answer is the one the valley remembers.
    ...REPLIES.filter((o) => o.id !== r.id).map((o) => ({ kind: 'clearFlag' as const, flag: o.flag })),
    { kind: 'setFlag', flag: r.flag }] }));
/**
 * `tear-loose` spends every approach it tries, for good. So a company that
 * loses the fight after it and climbs back must not walk into it again with
 * nothing left to try. It goes straight back to whichever fight it earned.
 */
const LOOSE: Effect[] = [{ kind: 'setFlag', flag: 'sisters-loose' }];
const TO_STONE: Choice[] = [
  { id: 'on', label: 'Tear them out of the stone', to: 'tear-loose', hideWhenBlocked: true,
    requires: [{ kind: 'notFlag', flag: 'sisters-loose' }, { kind: 'notFlag', flag: 'stone-spent' }] },
  { id: 'loose', label: 'Face the sisters again', to: 'sisters-battle', hideWhenBlocked: true,
    requires: [{ kind: 'flag', flag: 'sisters-loose' }] },
  { id: 'spent', label: 'Face what the stone called up', to: 'calling-battle', hideWhenBlocked: true,
    requires: [{ kind: 'flag', flag: 'stone-spent' }] },
];

/**
 * WAR ASSETS: what Parts 1–2 are worth at the end.
 *
 * At the war council on the rim, before the company goes down into the bowl,
 * Vex brings the forward column up (`war-council`), and whoever owes the
 * company comes with it:
 *   - Wren (she lived, or walked the fen with you) — joins, a scout;
 *   - Brother Halden (`halden-saved`) — joins, a priest;
 *   - Hask, Vex's guard (`vex-turned`) — joins, a veteran;
 *   - the fen-folk (`drowned-gold-home`) — ropes: an easier way to drag the
 *     sisters out of the stone at `tear-loose`.
 * A company owed nothing (a cold start) gets the short version
 * (`war-council-cold`). Leaving the council sets `rim-clear`, so a company
 * that comes back up after a defeat walks straight down. Who goes down is the
 * way out of the council: one choice per pair (two seats, no more), so the cap
 * costs the reachability search no facts at all.
 *
 * Two more debts are paid at the war-camp, as map markers:
 *   - the carter from the Ashfang pens (`captives-freed`) — potions;
 *   - Reeve Aldous's watch (`grandfather-home`) — two ticks on the camp's tally.
 * Each marker's scene is the gift, and a company not owed it (or already
 * paid) is turned aside to a "nothing here for you" beat. The reach search
 * does not track a flag read only by such a beat, and every carried flag it
 * does track doubles its whole search, so these two cost it nothing.
 */
const OWED = [
  'hollow-road:saved-scout', 'sunken-barrows:met-wren', 'sunken-barrows:halden-saved', 'hollow-road:vex-turned',
  'sunken-barrows:drowned-gold-home',
];
const has = (flag: string): Requirement => ({ kind: 'flag', flag });
const hasNot = (flag: string): Requirement => ({ kind: 'notFlag', flag });
/** Down into the bowl: through the council the first time, straight down after. */
const goDown = (effects: Effect[] = []): Choice[] => {
  const fx = effects.length ? { effects } : {};
  return [
    { id: 'down', label: 'Down into the bowl', to: 'calling-approach', hideWhenBlocked: true,
      requires: [has('rim-clear')], ...fx },
    // Owed anything at all: the first flag that holds picks the one choice shown.
    ...OWED.map((f, i): Choice => ({ id: `down-${i}`, label: 'Down into the bowl', to: 'war-council', hideWhenBlocked: true,
      requires: [hasNot('rim-clear'), ...OWED.slice(0, i).map(hasNot), has(f)], ...fx })),
    { id: 'down-cold', label: 'Down into the bowl', to: 'war-council-cold', hideWhenBlocked: true,
      requires: [hasNot('rim-clear'), ...OWED.map(hasNot)], ...fx },
  ];
};
/** Who is owed a place beside the company, and why (`owed`: any one of these
 *  holds; `unowed`: none does). Wren: she lived in Part 1, or walked the fen
 *  with you in Part 2. */
const SEATS = {
  wren: { name: 'Wren', who: 'who has mapped every pass you cleared', role: 'a scout',
    owed: [[has('hollow-road:saved-scout')], [hasNot('hollow-road:saved-scout'), has('sunken-barrows:met-wren')]],
    unowed: [hasNot('hollow-road:saved-scout'), hasNot('sunken-barrows:met-wren')],
    journal: { id: 'n-wren3', title: 'Wren, Chief of Scouts',
      body: 'Wren climbed up with the column and went down into the bowl with you. Somebody, she says, has to write the route report.' } },
  halden: { name: 'Brother Halden', who: 'his prayer book under his arm', role: 'a priest',
    owed: [[has('sunken-barrows:halden-saved')]], unowed: [hasNot('sunken-barrows:halden-saved')],
    journal: { id: 'n-halden3', title: 'Brother Halden',
      body: 'Halden climbed the whole mountain with his prayer book under his arm, to say his rites at the stone. A door\'s a door, he says, whether it\'s under a fen or inside a rock.' } },
  hask: { name: 'Hask', who: 'Vargan\'s guard, who stood aside for you in his hall', role: 'a veteran',
    owed: [[has('hollow-road:vex-turned')]], unowed: [hasNot('hollow-road:vex-turned')],
    journal: { id: 'n-hask', title: 'Hask, Vex\'s Sergeant',
      body: 'Hask was the Ashfang chief\'s own guard, but he answered to Vex. When you came for Vargan in his hall, Hask stood aside and let you pass. Now Vex has lent him to you for the stone.' } },
} as const;
type Seat = keyof typeof SEATS;
const SEAT_IDS = Object.keys(SEATS) as Seat[];
/** Every way to fill (up to) two seats from what each requirement list allows. */
const product = (lists: ReadonlyArray<ReadonlyArray<ReadonlyArray<Requirement>>>): Requirement[][] =>
  lists.reduce<Requirement[][]>((acc, l) => acc.flatMap((a) => l.map((r) => [...a, ...r])), [[]]);
/**
 * The way out of the council: go down with a pair when two or more are owed a
 * seat, with the one when only one is, alone when nobody is. Exactly the
 * options a company has earned are shown.
 */
const escortChoices = (): Choice[] => {
  const groups: Seat[][] = [[], ...SEAT_IDS.map((c) => [c]),
    ...SEAT_IDS.flatMap((c, i) => SEAT_IDS.slice(i + 1).map((d) => [c, d]))];
  return groups.flatMap((g) => {
    // A single (or nobody) only when nobody else is owed; a pair whenever both are.
    const others = g.length < 2 ? SEAT_IDS.filter((c) => !g.includes(c)).flatMap((c) => SEATS[c].unowed) : [];
    const names = g.map((c) => `${SEATS[c].name}, ${SEATS[c].who}`).join(', and ');
    const roles = g.map((c) => SEATS[c].role).join(' and ');
    const label = g.length === 0 ? 'Go down into the bowl'
      : `Go down into the bowl with ${names} (${roles} ${g.length === 1 ? 'joins' : 'join'} the party)`;
    return product(g.map((c) => SEATS[c].owed)).map((owed, i): Choice => ({
      id: `go-${g.join('-') || 'alone'}-${i}`, label, to: 'calling-approach', hideWhenBlocked: true,
      requires: [...owed, ...others],
      effects: [{ kind: 'setFlag', flag: 'rim-clear' },
        ...g.flatMap((c): Effect[] => [{ kind: 'joinParty', companion: c },
          { kind: 'journal', entry: { kind: 'npc', ...SEATS[c].journal } }])],
    }));
  });
};
const COUNCIL: Choice[] = [
  { id: 'ropes', label: 'Take the fen-folk\'s drowning-ropes, their thanks for the drowned you carried home (an easier way to drag the sisters out of the stone)',
    to: 'war-council-table', once: true, hideWhenBlocked: true, requires: [has('sunken-barrows:drowned-gold-home')],
    effects: [{ kind: 'setFlag', flag: 'fen-ropes' },
      { kind: 'journal', entry: { id: 'c-ropes', kind: 'clue', title: 'The Fen-Folk\'s Ropes',
        body: 'The families whose drowned you carried home sent two fen-folk up the mountain with coils of drowning-rope, braided for hauling people out of deep water. Loop them round the sisters and pull.' } }] },
  ...escortChoices(),
];

/** The Reedwife's price, told once and the same way everywhere: one lamb a
 *  winter kept the door. The people the Ashfang penned for her were her own
 *  greed, not the door's price. */
const FENFOLK_PRICE = '"My gran paid the Reedwife every midwinter," she says. "A lamb at the water\'s edge, and the dead slept sound. Nobody called it a bargain. It was just the price of living by the fen." She pulls a stitch tight. "Those poor souls the Ashfang penned up for her, that was her own greed. The door never asked for them. The sisters want the old price now, only bigger. They want the whole valley."';

const MIRA_TOAST = 'Mira, who keeps the Wander-Inn down in Thornwick, has hauled a barrel all the way up to the camp. She pours the first round on the house, and the second before anybody asks. With the third comes her observation that heroes drink no more carefully than anyone else. The reeve orders a plaque made. Wren corrects the geography on it.';

type Slide = { if: Requirement[]; text: string };
/** Ending slides every company's ending shares: the hills, and the people. */
const SLIDES_HILLS: Slide[] = [
  { if: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: 'The Calling peaked before you reached the stone. The camp held through the night of it, and the pikemen still talk about the sound the mountain made.' },
  // A company that won both earlier chapters.
  { if: [{ kind: 'flag', flag: 'hollow-road:won' }, { kind: 'flag', flag: 'sunken-barrows:won' }],
    text: 'The same four names run through all three songs. You broke the Ashfang. You sealed the Undercrypt.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:chief-dead' }],
    text: 'Nobody in the valley mourns Vargan. His mother\'s house is still under the water, but the reed-cutters are back in the shallows he sold, cutting reeds for a copper a bundle.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:vex-turned' }],
    text: 'Vex has seen every side of the valley\'s troubles, and he finally picked the right one.' },
  { if: [{ kind: 'notFlag', flag: 'hollow-road:vex-turned' }],
    text: 'Vex once walked away from the losing side, and he still looks surprised to be on the winning one.' },
  { if: [{ kind: 'flag', flag: 'oni-paid' }],
    text: 'Far past the mountain, an ogre-mage\'s warband marches on someone else\'s valley, and your gold paid for its boots.' },
  { if: [{ kind: 'notFlag', flag: 'oni-paid' }],
    text: 'The fort at the middle pass becomes Vex\'s lookout, and no warband holds that pass against the valley again.' },
  { if: [{ kind: 'flag', flag: 'clutch-skipped' }],
    text: 'No dragon flies over the high pastures again. You emptied every den on the way up.' },
  { if: [{ kind: 'flag', flag: 'green-sent' }],
    text: 'Somewhere past the far hills, a green dragon is growing up. It still flinches at the sound of the dragon tongue.' },
  // The camp's tally (see TALLY): above zero means the hills were thinned.
  // The camp is only attacked if the Calling peaked (see DAWNS); broken
  // before then, what was left in the hills simply turned for home.
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'notFlag', flag: TALLY }],
    text: 'On the night of the Calling, the beasts you left in the hills came down on the war-camp. The pikes held, but only just. Vex burned a long row of funeral fires the next morning, and he wrote down every name.' },
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'flag', flag: TALLY, value: 1 }],
    text: 'On the night of the Calling, the war-camp held. You had thinned the hills so well that Vex did not lose a single soldier.' },
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'flag', flag: TALLY, value: 10 - THREAT_PAR }],
    text: 'Bram still complains about all the arrows nobody needed.' },
  { if: [{ kind: 'notFlag', flag: 'calling-peaked' }, { kind: 'notFlag', flag: TALLY }],
    text: 'You broke the stone before the Calling peaked, and the war-camp never had to fight its night. But what you left in the hills is still up there. The shepherds will be dealing with it for years.' },
  { if: [{ kind: 'notFlag', flag: 'calling-peaked' }, { kind: 'flag', flag: TALLY, value: 1 }],
    text: 'You broke the stone before the Calling peaked, and you had thinned the hills on the way. Vex sends the pikemen home before the first snow.' },
  { if: [{ kind: 'flag', flag: 'manticore-sent' }],
    text: 'The manticore never came back to its cliff. Shepherds say it circled the broken stone for a week, shouting about unpaid tolls.' },
  { if: [{ kind: 'flag', flag: 'herd-spared' }],
    text: 'The giant boars still run their gully twice a day. They run it away from the valley now.' },
  { if: [{ kind: 'flag', flag: 'oni-tricked' }],
    text: 'The ogre-mage limped off the mountain after its war with the ettin. It never did learn who started it.' },
  { if: [{ kind: 'flag', flag: 'ettin-split' }],
    text: 'Hunters still hear the ettin some nights, far off in the high hills. It is still arguing with itself about the valley.' },
  { if: [{ kind: 'flag', flag: 'clutch-beaten' }],
    text: 'The wyrmlings you left in their dens died on the rim instead, and the shepherds still give those dens a wide berth.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:vargan-jailed' }],
    text: 'Vargan hears about the Calling in the reeve\'s reed-beds. He asks to go up and fight. The reeve says no, and Vargan goes back to cutting.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:vargan-freed' }],
    text: 'A reed-cutter with a scarred hand left a sack of reed-arrows at the war-camp gate one night. Nobody saw his face. Bram sold every one.' },
];
const SLIDES_PEOPLE: Slide[] = [
  { if: [{ kind: 'flag', flag: 'hollow-road:saved-scout' }],
    text: 'Wren still limps on cold mornings, and she tells every new scout how you lifted a dead horse off her leg.' },
  { if: [{ kind: 'notFlag', flag: 'hollow-road:saved-scout' }, { kind: 'flag', flag: 'sunken-barrows:met-wren' }],
    text: 'Wren tells every new scout how she held the gate of the Undercrypt, and how you walked back out.' },
  { if: [{ kind: 'notFlag', flag: 'hollow-road:saved-scout' }, { kind: 'notFlag', flag: 'sunken-barrows:met-wren' }],
    text: 'Wren pins her map of the passes over her bed, arrowheads and all, with your four names inked along the top.' },
  { if: [{ kind: 'flag', flag: 'sunken-barrows:halden-saved' }],
    text: 'Brother Halden climbs to the bowl each spring to bless the broken stone, and then he walks home to his little chapel.' },
  // The war assets the council called in (see COUNCIL).
  { if: [{ kind: 'companion', companion: 'wren' }],
    text: 'Wren\'s route report of the climb to the stone runs to eleven pages. It is the only report in the camp that admits anybody felt afraid.' },
  { if: [{ kind: 'companion', companion: 'hask' }],
    text: 'Hask went back to Vex\'s side with a new scar and a better story, and Vex pretends to be tired of hearing it.' },
  { if: [{ kind: 'flag', flag: 'mules-unloaded' }],
    text: 'The carter from the Ashfang pens drives the last wagon home to Thornwick. The girl in her new shoes rides on top.' },
  { if: [{ kind: 'flag', flag: 'watch-holds' }, { kind: 'flag', flag: 'calling-peaked' }],
        text: 'Thornwick\'s watch held the camp\'s weakest line on the night of the Calling. Reeve Aldous calls it a debt settled, and for once he smiles as he says it.' },
      { if: [{ kind: 'flag', flag: 'watch-holds' }, { kind: 'notFlag', flag: 'calling-peaked' }],
        text: 'Thornwick\'s watch dug in on the camp\'s weakest line and never had to hold it. Reeve Aldous calls the debt settled anyway, and almost means it.' },
];

const scenes: Record<string, Scene> = {
  // === ACT 1 — THE WAR-CAMP ==============================================
  muster: {
    id: 'muster', kind: 'story', art: { imageId: 'loc-camp', emoji: '⚔️' },
    text: [
      'The valley has raised an army at last. A **war-camp** spreads across the wet meadows below the high hills. Thornwick\'s recruits drill there, fen-folk with boar-spears and carters holding pikes. This time everyone can see the trouble coming. Every night there are fires burning up in the high passes, and no shepherd lit them.',
      'A fen-folk recruit with a boar-spear falls into step beside you. "You\'ll have heard about the stone," he says. "Up in the high hills there\'s a black fang of rock as old as the mountain. The **Calling Stone**, folk call it. Somebody\'s woken it. It sings a note only monsters can hear, and every day it sings, more of them come down."',
      '"It was the **Reedwife\'s sisters** that woke it. Two more hags, a head taller than any man. My cousin saw them at the edge of the fen the night the barrows closed." He points his spear at the passes, where wyrmlings ride the wind at dusk. "There\'s giant footprints in the orchards now. And the streams run uphill. Don\'t ask me how."',
      'Word of your company reached the camp before you did. The crowd opens a path for you all the way to the command tent. Nobody says out loud that the sisters have come to collect a debt from you. They do not have to.',
    ],
    next: [{ id: 'go', label: 'Report to the command tent', to: 'envoys',
      // Cold-start floor: a fresh company begins the finale at 4th level
      // (no-op for a company continuing from The Sunken Barrows).
      effects: [{ kind: 'xpToLevel', level: 4 },
        // The camp's tally starts below zero (see TALLY).
        { kind: 'setFlag', flag: TALLY, value: -THREAT_PAR },
        { kind: 'journal', entry: { id: 'q-calling', kind: 'quest', title: 'Silence the Calling',
          body: 'The Reedwife\'s sisters have woken the Calling Stone in the high hills. Its song pulls wyrms, giants, and worse down on the valley. Climb the passes, kill what answers the call, and break the stone.' } }] }],
    noBack: true,
  },
  envoys: {
    // The sister is only a seeming (see onWin); her hired swords are real.
    id: 'envoys', kind: 'battle', encounterId: 'knights', mapId: 'open',
    intro: [
      'You are ten paces from the command tent when the whole camp stops talking at once. A woman stands in your way who was not there a moment ago. She is a head taller than anyone in the camp, with river-weed braided into her hair. Four hired swords stand behind her: a knight in dented black plate, two archers and a thug with a club. They watch you with bored, empty eyes.',
      '"The famous company," the Reedwife\'s sister says. Her smile has too many teeth in it. "My sister fed off that marsh for longer than your Thornwick has had a name. You cost this family its living, so we have come to settle the bill." She flexes her green fingers. "The rest of the collectors are gathering up on the mountain. Think of this as a knock at the door."',
    ],
    onWin: { to: 'envoys-won', text: ['The last hired sword falls, and the hag falls apart into reeds and river-water. She was never really standing there at all. Her hired swords were real, and they stay where they fall.'] },
    // Losing the opening fight gets its own beat: nobody has met Vex yet,
    // and the briefing that follows must not read as if you had won.
    onLoss: { to: 'envoys-lost', text: ['The hag\'s laugh is the last thing you hear. Then the mud comes up to meet you.'] },
  },
  'envoys-lost': {
    id: 'envoys-lost', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏕️' },
    text: [
      'You wake on a cot in the hospital tent. Camp scouts dragged you here out of the mud. The hag is gone, and her hired swords went with her. The scouts say she sank into a puddle, laughing.',
      'A grey-haired captain looks in through the tent flap. "She does that," he says. "When you can stand, come to the command tent. We\'ve a war to plan, and you\'re in it."',
    ],
    next: [{ id: 'up', label: 'Get back on your feet', to: 'warcamp' }], noBack: true,
  },
  'envoys-won': {
    id: 'envoys-won', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'The command tent stands open. Inside, maps cover a table, and a grey-haired captain sits with a sword across his knees. He watches you duck in with the tired calm of a man whose bad guesses keep coming true.',
      '"That\'s the second one of those this week." He nods at the tent flap. "You did better than my patrols did."',
    ],
    next: TO_BRIEFING,
  },
  // Reached from the command tent only after losing to the envoy.
  'tent-after-loss': {
    id: 'tent-after-loss', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'The command tent stands open. Maps cover a table, and the grey-haired captain sits behind it with a sword across his knees. He has the tired calm of a man whose bad guesses keep coming true.',
      '"Sit down before you fall down," he says. "She did the same to my last two patrols. You lasted longer than they did."',
    ],
    next: TO_BRIEFING,
  },
  // A cold start: still the company that broke the Ashfang, so they met him
  // at his fire in the den. Nothing carried says whether they struck a deal.
  'vex-brief': {
    id: 'vex-brief', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'You know this man. It is **Vex**, once the Ashfang\'s lieutenant. You met him at his lone fire in the chief\'s den, the night your company broke the Ashfang. He kept out of the last fight. When it was over, he went to the reeve of his own accord. Now Thornwick trusts him to run its war.',
      '"It took me too long to walk away from that den," he says. "A slow learner still learns."',
      ...BRIEF_PLAN,
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('You met Vex at his fire in the Ashfang den. He kept out of the chief\'s last fight and went to the reeve. Now he runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.') }],
  },
  // The party met him at his fire in the Ashfang den, and he did not take
  // their offer (or they never made one). He gave himself up anyway.
  'vex-brief-met': {
    id: 'vex-brief-met', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'You know this man. It is **Vex**, once the Ashfang\'s lieutenant. You met him at his lone fire in the chief\'s den, and you did not leave it with a deal. He sat out the last fight anyway, and the next morning he walked into the reeve\'s hall and gave himself up. Now Thornwick trusts him to run its war.',
      '"I walked in expecting to hang by noon," he says. "Instead the reeve handed me an army."',
      ...BRIEF_PLAN,
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('You met Vex at his fire in the Ashfang den, and he did not take your offer. He sat out the chief\'s last fight, gave himself up, and now runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.') }],
  },
  'vex-brief-turned': {
    id: 'vex-brief-turned', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'You know this man. It is **Vex**, once the Ashfang\'s lieutenant. In the chief\'s den he took your offer and kept his guards out of the last fight. The last you heard, he had taken the road out of the valley, just as he said he would.',
      '"I got as far as a hill inn," he says. "Then word came that the dead were walking, and after that, fires in the passes. Turns out I can\'t sit and drink while this valley burns twice." He shrugs. "So I walked back and offered the reeve my sword. He took it, which surprised us both. No more burned barns. I like this side better."',
      ...BRIEF_PLAN,
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('Vex was the Ashfang\'s lieutenant until he took your offer in the chief\'s den. He left the valley, then came back when the hills began to burn. Now he runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.') }],
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
        // Unbriefed (the party lost to the envoy and was carried in), the
        // tent is where Vex gives the briefing the win would have led to.
        { id: 'command', x: 25, y: 30, label: 'The Command Tent', icon: 'tok-fire', scene: 'tent-after-loss',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'briefed' }], to: 'command-done' }] },
        { id: 'stores', x: 50, y: 45, label: 'The War-Stores', icon: 'tok-market', scene: 'wc-stores' },
        // Wren knows you if you pulled her out from under a horse (Part 1) or
        // walked the fen with her (Part 2), and coolly if you left her under
        // it; otherwise she knows you by name only.
        { id: 'scouts', x: 30, y: 70, label: 'The Scouts\' Fire', icon: 'tok-camp', scene: 'scouts-fire',
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'wren-brief' }], to: 'scouts-done' },
            { if: [{ kind: 'flag', flag: 'hollow-road:saved-scout' }], to: 'scouts-fire-saved' },
            // Left her under the horse, then (always, on the way to the Barrow
            // Gate) walked the fen with her: some of it is squared.
            { if: [{ kind: 'flag', flag: 'hollow-road:scout-left' }], to: 'scouts-fire-mended' },
            { if: [{ kind: 'flag', flag: 'sunken-barrows:met-wren' }], to: 'scouts-fire-old' },
          ] },
        // War assets paid at the camp (see WAR ASSETS): the marker's scene is
        // the gift; a company not owed it, or already paid, is waved past.
        { id: 'wagons', x: 58, y: 80, label: 'The Supply Wagons', icon: 'tok-market', scene: 'wagons-carter',
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'mules-unloaded' }], to: 'wagons-busy' },
            { if: [{ kind: 'notFlag', flag: 'hollow-road:captives-freed' }], to: 'wagons-busy' },
          ] },
        { id: 'eastline', x: 62, y: 18, label: 'The East Line', icon: 'tok-lookout', scene: 'eastline-watch',
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'watch-holds' }], to: 'eastline-busy' },
            { if: [{ kind: 'notFlag', flag: 'sunken-barrows:grandfather-home' }], to: 'eastline-busy' },
          ] },
        // The fen-folk tie the Calling back to the fen: the Reedwife's old
        // price, and the door under the barrows. Both versions only lead back,
        // so the cracked door they read costs the reach search nothing.
        { id: 'fenfolk', x: 10, y: 52, label: 'The Fen-Folk\'s Fire', icon: 'tok-camp', scene: 'fenfolk-fire',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }], to: 'fenfolk-fire-cracked' }] },
        { id: 'trailhead', x: 80, y: 60, label: 'The High Trail', icon: 'tok-gate', scene: 'hills-out',
          // Read off the hills' own visit (already tracked as a hub), not a
          // fact of its own: the reach search stays half the size.
          sceneWhen: [{ if: [{ kind: 'visited', scene: 'hills' }], to: 'hills-out-again' }],
          requires: [{ kind: 'flag', flag: 'briefed' }] },
      ],
    },
  },
  // The fen-folk: what the Reedwife's price was, and what the stone is doing
  // to the door under the barrows (louder, if it shut cracked in Part 2).
  'fenfolk-fire': {
    id: 'fenfolk-fire', kind: 'story', art: { imageId: 'loc-camp', emoji: '🔥' },
    text: [
      'The fen-folk keep their own small fire at the edge of the camp, with their boar-spears stacked beside it. An old woman waves you over. It\'s the hedge-witch from the regulars\' table at Mira\'s inn, the river-stones still braided into her hair. She knits while she talks, and she still doesn\'t look up.',
      FENFOLK_PRICE,
      '"And the stone sings into the ground as well as the sky. We feel it in our feet. The dead under the barrows are turning in their sleep." She pulls her yarn tight. "Break that stone before they wake up properly."',
    ],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  'fenfolk-fire-cracked': {
    id: 'fenfolk-fire-cracked', kind: 'story', art: { imageId: 'loc-camp', emoji: '🔥' },
    text: [
      'The fen-folk keep their own small fire at the edge of the camp, with their boar-spears stacked beside it. An old woman waves you over. It\'s the hedge-witch from the regulars\' table at Mira\'s inn, the river-stones still braided into her hair. She knits while she talks, and she still doesn\'t look up.',
      FENFOLK_PRICE,
      '"You know the door under the barrows. You shut it, near enough. Well, it knocks now, every night the stone sings, and louder each time." She pulls her yarn tight. "If the Calling runs much longer, that crack\'ll open. The sisters know it. I think they\'re counting on it."',
    ],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  'command-done': {
    id: 'command-done', kind: 'story', art: { emoji: '🗺️' },
    text: ['The command tent works on. Guard posts, rations, the slow business of keeping frightened people pointed the right way. Vex adds a new pin to his map for every fight you win up in the hills. He would never say so, but he keeps them in a neat little row.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
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
    intro: ['Bram has taken over a supply wagon and, by the look of things, every pricing decision in the war. "War makes everything cost more. Except my goods, because I\'m a patriot. Also the captain reads my books." He turns a crate around to face you. "There\'s big things up that hill. Buy accordingly."'] },
  // A cold start, or a company that never got her name: she knows them by
  // reputation, and maybe from across a room, and nothing more is said.
  'scouts-fire': {
    id: 'scouts-fire', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    lines: [
      'A young woman named **Wren** runs the scouts\' fire. Three riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She is young to be Chief of Scouts. She wears the title like a coat that fits her but embarrasses her anyway.',
      '"I know who you are. Everyone in the valley does. I think I saw you once across Mira\'s taproom, but you were busy being famous." She jabs a finger at the map. "Right. Listen." ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' She frowns. "And the streams are walking uphill. I\'ve got no advice about that one." She hesitates. "Come back down the hill on your own feet," she adds, a little too fast.',
    ],
    next: TAKE_NOTES,
  },
  // Left under the horse in Part 1, then walked the fen together in Part 2.
  'scouts-fire-mended': {
    id: 'scouts-fire-mended', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    lines: [
      '**Wren** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She sees you and nods, once. It\'s not warm, but it\'s not the look she gave you in the fen, either.',
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' "And the streams are walking uphill. I\'ve got no advice about that one." She hands over the map-notes. "You walked past me once. Then you came back up out of that barrow when you said you would. I\'m still counting, but that one counted."',
    ],
    next: TAKE_NOTES,
  },
  // Wren knows the company from the deep fen: she held the Barrow Gate while
  // they went down into the Undercrypt.
  'scouts-fire-old': {
    id: 'scouts-fire-old', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    lines: [
      '**Wren** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She made Chief of Scouts young. She wears the title like a coat that fits her but embarrasses her anyway.',
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' She frowns. "And the streams are walking uphill. I\'ve got no advice about that one." She pauses. "Last time I held a gate and waited for you to walk back out. I didn\'t enjoy it." She almost smiles. "Come down the hill on your own feet, and I won\'t have to do it again."',
    ],
    next: TAKE_NOTES,
  },
  // Wren owes the company her leg, and probably her life: they lifted a dead
  // horse off her on the marsh road in Part 1.
  'scouts-fire-saved': {
    id: 'scouts-fire-saved', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    lines: [
      '**Wren** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She stands when she sees you, and she only barely favours the leg you once pulled out from under a dead horse on the marsh road.',
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' She frowns. "And the streams are walking uphill. I\'ve got no advice about that one." She pauses. "I counted the watch-posts for you once, lying under a horse. This is a better map." She almost smiles. "Come down the hill on your own feet. We\'ve made that a tradition."',
    ],
    next: TAKE_NOTES,
  },
  'scouts-done': {
    id: 'scouts-done', kind: 'story', art: { emoji: '🏹' },
    text: ['The scouts\' fire crackles through another change of shift. Wren\'s riders come and go with the brisk urgency she has drilled into them, and her map grows more arrowheads by the hour. She flicks you a two-finger salute without looking up.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
  },
  // The carter Part 1's company cut out of the Ashfang pens (`captives-freed`).
  'wagons-carter': {
    id: 'wagons-carter', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🐴' },
    text: [
      'A grey-bearded carter is backing a supply wagon up to Bram\'s stores, and he stops halfway when he sees you. You last saw him in a stake pen behind the Ashfang kennels, with a girl of about seven on his back.',
      '"I drive for the army now. The pay\'s bad, and nobody locks me in at night." He reaches under the wagon-seat and comes up with a crate. "The best of the stores. I took it off the top before Bram could price it. Don\'t tell him."',
    ],
    next: [{ id: 'take', label: 'Take the carter\'s crate (2 greater healing, 1 fire resistance)', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'mules-unloaded' },
        { kind: 'addItem', itemId: 'potion-greater-healing', qty: 2 }, { kind: 'addItem', itemId: 'potion-fire-resistance', qty: 1 },
        { kind: 'journal', entry: { id: 'c-carter', kind: 'clue', title: 'The Carter\'s Crate',
          body: 'The carter you cut out of the Ashfang pens drives supply wagons for the war-camp now. He kept the best of the stores back for you.' } }] }],
  },
  'wagons-busy': {
    id: 'wagons-busy', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🐴' },
    text: ['Supply wagons come and go from Bram\'s stores in a slow line. The drivers are too busy to talk.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  // Reeve Aldous's thanks for carrying his grandfather home (`grandfather-home`).
  'eastline-watch': {
    id: 'eastline-watch', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '⚖️' },
    text: [
      'Twenty men in Thornwick\'s colours are digging in at the end of the camp\'s east line, where the pikes are thinnest. Their sergeant hands you a folded note in the reeve\'s stiff handwriting.',
      '*You carried my grandfather home. The watch is yours until the Calling is broken. — Aldous*',
    ],
    next: [{ id: 'post', label: 'Put Thornwick\'s watch on the weakest line (the camp holds better on the night)', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'watch-holds' }, ...tally(2),
        { kind: 'journal', entry: { id: 'c-watch', kind: 'clue', title: 'Thornwick\'s Watch',
          body: 'Reeve Aldous sent Thornwick\'s watch up to the war-camp, for carrying his grandfather home. They hold the camp\'s weakest line when the Calling peaks. That is two fewer things for the pikes to stop.' } }] }],
  },
  'eastline-busy': {
    id: 'eastline-busy', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🛡️' },
    text: ['Pikemen stand to their posts along the east line. The sergeants wave you past without looking up from their work.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  'hills-out-again': {
    id: 'hills-out-again', kind: 'story', art: { imageId: 'loc-hills', emoji: '⛰️' },
    text: ['You take the high trail again, past the saluted marker. Above you, the Calling hums on, no quieter than before.'],
    next: [{ id: 'up', label: 'Climb', to: 'hills' }],
  },
  'hills-out': {
    id: 'hills-out', kind: 'story', art: { imageId: 'loc-hills', emoji: '⛰️' },
    text: ['The high trail leaves the last lookout behind at a stone marker the recruits have started saluting. Above you the hills stack up into the sky, pass over pass. Over the highest one you hear it for the first time: the **Calling**. It is not really a sound. It is a pull, like a door standing open somewhere above the clouds.'],
    next: [{ id: 'up', label: 'Climb', to: 'hills' }],
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
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'tollcliff-cleared' }], to: 'tollcliff-done' }] },
        { id: 'boarruns', x: 30, y: 86, label: 'The Boar-Runs', mystery: 'Drumming underfoot…', icon: 'tok-danger', scene: 'boarruns',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'boarruns-cleared' }], to: 'boarruns-done' }] },
        { id: 'greenden', x: 38, y: 48, label: 'The Green Den', mystery: 'A sharp green stink…', icon: 'tok-cave', scene: 'greenden',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'green-cleared' }], to: 'greenden-done' }, PEAKED] },
        { id: 'seam', x: 50, y: 66, label: 'The Flooded Pass', mystery: 'A stream running uphill…', icon: 'tok-crossing', scene: 'seam',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'seam-cleared' }], to: 'seam-done' }] },
        { id: 'blueden', x: 58, y: 30, label: 'The Blue Mesa', mystery: 'A smell of thunder…', icon: 'tok-cave', scene: 'blueden',
          requires: [{ kind: 'flag', flag: 'seam-cleared' }],
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'blue-cleared' }], to: 'blueden-done' }, PEAKED] },
        { id: 'onihold', x: 68, y: 56, label: 'The Middle Pass', mystery: 'A horn on a wall…', icon: 'tok-ruin', scene: 'onihold',
          requires: [{ kind: 'flag', flag: 'seam-cleared' }],
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'oni-cleared' }], to: 'onihold-done' }] },
        { id: 'redden', x: 74, y: 22, label: 'The Burning Den', mystery: 'Smoke with no campfire…', icon: 'tok-fire', scene: 'redden',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }],
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'red-cleared' }], to: 'redden-done' }, PEAKED] },
        { id: 'gorgonvale', x: 84, y: 78, label: 'The Valley of Statues', mystery: 'Statues that are too good…', icon: 'tok-mystery', scene: 'gorgonvale',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }],
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'gorgon-cleared' }], to: 'gorgonvale-done' }] },
        { id: 'steading', x: 88, y: 44, label: 'The Giants\' Hall', mystery: 'Smoke above the tree-line…', icon: 'tok-house', scene: 'steading',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }],
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'steading-cleared' }], to: 'steading-done' },
            // The ogre-mage was lied into raiding the hall first.
            { if: [{ kind: 'flag', flag: 'oni-tricked' }], to: 'steading-raided' },
            // Wren's notes: the two heads never agree, so the parley comes cheaper.
            { if: [{ kind: 'flag', flag: 'wren-brief' }], to: 'steading-notes' },
          ] },
        // The den-raiding payoff routes here: beat the clutch (or never let it
        // mass) and later visits cross a still ridge; clear all three dens and
        // the brood never masses at all. Falling back from the clutch fight
        // returns to a short beat, not the first sight of the ridge. First
        // matching sceneWhen wins.
        { id: 'callinggate', x: 95, y: 20, label: 'The Last Ridge', mystery: 'The pull, stronger…', icon: 'tok-boss', scene: 'calling-gate',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }, { kind: 'flag', flag: 'steading-cleared' }],
          // `rim-clear`: the brood is beaten or never massed, and the war
          // council has been held. `clutch-beaten` and `clutch-skipped` stay
          // for the ending's slides, which cost the reach search nothing.
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
      'Burn marks streak the loose rock in three different sizes and three different colours. Green, blue, and red mean three separate dragons came this way.',
      'A boulder sits beside the trail with a handprint pressed into it. The hand was wider than a door.',
      'Water has cut channels straight across the path, though there is no stream up here, and there should be no water at all.',
      'And under all of it, that steady pull. The stone is drawing every monster on this mountain toward one high place. Whatever you beat down here will not be waiting for you at the top.',
    ],
    next: [{ id: 'on', label: 'Pick your fights', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'hills-read' }] }],
  },
  'switchbacks-done': {
    id: 'switchbacks-done', kind: 'story', art: { emoji: '👣' },
    text: ['The switchbacks wind away below you, familiar now. Up ahead, the Calling still pulls at the edge of hearing.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'hills-night': {
    id: 'hills-night', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'harpy-roost', mapId: 'open',
    intro: [
      'In your sleep you see a stone door under the fen. Two tall green women stand in front of it with their backs to you. One of them turns. "You took our sister from that door," she says. "So we will take the valley from you."',
      'The singing starts in the dream and goes on after it. It is sweet, and wrong, and getting closer. Harpies come riding the night wind down from the crags. Their song tugs at your legs and puts words in your head. *Stand up. Walk to the edge. It is not far.* You wake in time, mostly because the sentry threw a boot.',
    ],
    onWin: { to: '@hub', text: ['The last harpy drops into the dark with its song broken. You do not sleep again that night. You bank the fire and count the watches until a grey, quiet dawn.'] },
  },
  tollcliff: {
    id: 'tollcliff', kind: 'story', art: { emoji: '🦁' },
    text: [
      'The trail narrows under an overhang, and the overhang is occupied. A **manticore** lies stretched along it like a lord at his dinner table. It has the body of a lion, the wings of a bat, and a tail covered in black spikes. Its face is human, which is somehow the worst part.',
      '"Toll," it says. Its voice is a purr dragged over gravel. "Everything that walks my cliff pays. The goblins paid in sheep. The hags paid in promises." Its grin widens by one tooth too many. "You will pay in meat. I have decided."',
    ],
    next: [
      // Wren's tip: it is greedy, so point it at a bigger meal. One try, and
      // easier with her notes. A miss gives it the first strike.
      { id: 'promise-notes', label: '[Persuasion DC 11] Wren\'s tip: promise it a bigger meal up at the stone', to: 'tollcliff-talked',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        once: true, check: { skill: 'persuasion', dc: 11, failTo: 'tollcliff-stung' } },
      { id: 'promise', label: '[Persuasion DC 14] Offer it the sisters\' promise instead', to: 'tollcliff-talked',
        requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true,
        once: true, check: { skill: 'persuasion', dc: 14, failTo: 'tollcliff-stung' } },
      { id: 'fight', label: 'Pay it in steel', to: 'tollcliff-fight' },
      { id: 'leave', label: 'Leave it on its ledge', to: 'hills' },
    ],
  },
  // Talked down: the manticore flies off to collect from the coven instead.
  'tollcliff-talked': {
    id: 'tollcliff-talked', kind: 'story', art: { emoji: '🦁' },
    text: [
      'You tell it the truth, more or less. "The hags promised you a valley full of meat. They\'re up at the stone right now. Have they paid you one sheep yet?" You shrug. "A lord collects what he\'s owed. He doesn\'t wait on a ledge for scraps."',
      'The manticore\'s human face goes thoughtful. "Promises," it says, tasting the word. Then it stretches, and its spiked tail rattles. "I believe I will go and collect." It drops off the ledge and beats away uphill, toward the Calling Stone. Even its goblins, hiding in the rocks below the ledge, run the other way.',
    ],
    next: [{ id: 'ok', label: 'Walk the open trail', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, { kind: 'setFlag', flag: 'manticore-sent' },
        ...tally(), { kind: 'xp', amount: 200 }] }],
    noBack: true,
  },
  'tollcliff-fight': {
    id: 'tollcliff-fight', kind: 'battle', encounterId: 'manticore-cliff', mapId: 'cliff',
    intro: ['"Steel, then," the manticore sighs, sounding genuinely put out. Its tail curves over its shoulder like a drawn bow. Two goblins scramble up from the rocks behind it with spears. They are probably the ones who paid in sheep, working off a debt.'],
    onWin: { to: 'hills', text: ['The manticore drops onto the trail with one last offended word. "Toll." The pile in the overhang holds ten years of payments, taken from frightened travellers.'],
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, ...tally(), { kind: 'gold', amount: 110 }] },
  },
  // Talked at too long: its tail was cocked the whole time.
  'tollcliff-stung': {
    id: 'tollcliff-stung', kind: 'battle', encounterId: 'manticore-cliff', mapId: 'cliff',
    surprise: 'party',
    intro: ['The manticore listens with its head on one side. "Promises," it says. "The hags gave me promises. I have eaten better." It kept its tail cocked over its shoulder the whole time you talked. It looses a volley of spikes before you can raise a shield, and two goblins scramble up from the rocks behind it.'],
    onWin: { to: 'hills', text: ['The manticore drops onto the trail with one last offended word. "Toll." The pile in the overhang holds ten years of payments, taken from frightened travellers.'],
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, ...tally(), { kind: 'gold', amount: 110 }] },
  },
  'tollcliff-done': {
    id: 'tollcliff-done', kind: 'story', art: { emoji: '🦁' },
    text: ['The overhang stands empty. The trail below is free to walk now. It may take the local shepherds a whole generation to believe it.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  boarruns: {
    id: 'boarruns', kind: 'story', art: { emoji: '🐗' },
    text: [
      'A dry gully crosses the trail here. Hooves have churned its floor to mud and left coarse hair all over it. These are the **boar-runs**, and the drumming under your boots says the herd is coming. These are not farm pigs. The hoofprints are as wide as wash-basins.',
      'Something has been driving the herd uphill, day after day. The Calling wants its beasts angry and moving.',
      'You can meet the stampede where the gully narrows and break the herd for good. Or you can watch the dust, as Wren said, and slip across between runs.',
    ],
    next: [
      // Timing it: easier with Wren's notes. A miss puts you in the open
      // when the herd comes back, and a pack bursts under it.
      { id: 'time-notes', label: '[Survival DC 11] Time the stampede by Wren\'s notes', to: 'boarruns-timed',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        once: true, check: { skill: 'survival', dc: 11, failTo: 'boarruns-scattered', failEffects: SCATTERED } },
      { id: 'time', label: '[Survival DC 14] Time the stampede', to: 'boarruns-timed',
        requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true,
        once: true, check: { skill: 'survival', dc: 14, failTo: 'boarruns-scattered', failEffects: SCATTERED } },
      { id: 'calm', label: '[Druid · Animal Handling DC 12] Kneel in the narrows and calm the leaders', to: 'boarruns-calmed',
        requires: [{ kind: 'classInParty', classId: 'druid' }], hideWhenBlocked: true,
        once: true, check: { skill: 'animal-handling', dc: 12, failTo: 'boarruns-fight' } },
      { id: 'fight', label: 'Meet the stampede at the narrows', to: 'boarruns-fight' },
      { id: 'wait', label: 'Leave the herd to its runs', to: 'hills' },
    ],
  },
  'boarruns-fight': {
    id: 'boarruns-fight', kind: 'battle', encounterId: 'boar-stampede', mapId: 'pass',
    intro: ['The drumming turns into thunder. Two boars the size of hay-carts come down the narrows shoulder to shoulder. Their tusks are as long as plough blades and their eyes are mad with the Calling. Then you notice that the gully narrows behind you as well.'],
    onWin: { to: 'hills', text: ['The stampede breaks around its fallen leaders. The rest of the herd scatters over the far ridge, away from the valley. You have just saved the war-camp from a living battering ram.'],
      effects: [{ kind: 'setFlag', flag: 'boarruns-cleared' }, ...tally(), { kind: 'gold', amount: 40 }] },
  },
  // Timed wrong: the herd catches the party in the open, and a pack bursts.
  'boarruns-scattered': {
    id: 'boarruns-scattered', kind: 'story', noBack: true, art: { emoji: '🐗' },
    text: ['You run too soon. The herd comes back over the rise while you are still in the open, and you dive for the rocks. A boar\'s shoulder catches a pack as it goes by and bursts it. Thirty gold scatters across the gully, and the hooves grind it into the mud.'],
    next: [{ id: 'on', label: 'Meet them at the narrows', to: 'boarruns-fight' }],
  },
  // Timed, not fought: the herd lives, and turns away from the valley.
  'boarruns-timed': {
    id: 'boarruns-timed', kind: 'story', art: { emoji: '🐗' },
    text: [
      'You lie flat on the lip of the gully and watch the dust. The herd thunders past below you and away over the next rise. You count to twenty, and then you run.',
      'On the far side you pile dry brush across the narrows and set it alight. When the herd comes back, it smells the smoke and swings away over the far ridge, away from the valley. Every boar lives, and not one of them will come near the camp.',
    ],
    next: [{ id: 'ok', label: 'Onward', to: 'hills', effects: HERD_SPARED }], noBack: true,
  },
  // A druid's way: the herd is frightened, not angry.
  'boarruns-calmed': {
    id: 'boarruns-calmed', kind: 'story', art: { emoji: '🐗' },
    text: [
      'Your druid walks out into the narrows alone and kneels in the mud. The lead boar skids to a stop, close enough to touch. It is not angry. It is afraid, and the song gives it no rest.',
      'Your druid talks to it, low and slow, until its ears drop. Then it turns, and the whole herd follows it over the far ridge, away from the valley. The drumming fades to nothing.',
    ],
    next: [{ id: 'ok', label: 'Onward', to: 'hills', effects: HERD_SPARED }], noBack: true,
  },
  'boarruns-done': {
    id: 'boarruns-done', kind: 'story', art: { emoji: '🐗' },
    text: ['The boar-runs lie still, and grass is growing back over the churned earth. The herd keeps to the far side of the ridge now. It has learned what the narrows cost.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  // The den's mouth: a dragonborn can order the wyrmling home in the dragon tongue.
  greenden: {
    id: 'greenden', kind: 'story', art: { emoji: '🐉' },
    text: [
      'The thicket smells of cut grass gone bad, sharp and rotten at the same time. That smell means a **green wyrmling**. Its den is a tunnel dug through strangling briar, and the floor is a bed of picked bones. Everything in that pile mistook a young dragon for a safe one. Its kobolds are shrieking the alarm.',
      'The wyrmling slides out of the briar like an eel out of a wall. It is small, but its grin is still a dragon\'s grin. This is one more monster for the Calling, unless you stop it here.',
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
    intro: ['The kobolds scatter for their spears. The wyrmling coils back into the briar and sucks in a long breath. The air turns sharp and green.'],
    onWin: { to: 'hills', text: ['The wyrmling drops in the middle of a hiss, and its poison breath fades to a harmless stink. That is one monster fewer for the Calling. The den\'s small hoard rides out in your packs.',
      'Up the mountain, the Calling\'s note bends. Two women\'s voices ride it down the wind, close as a whisper. "One fewer, little debtors. We have so many more."'],
      effects: [{ kind: 'setFlag', flag: 'green-cleared' }, ...tally(DEN_TICKS), { kind: 'gold', amount: 75 }] },
  },
  'greenden-cowed': {
    id: 'greenden-cowed', kind: 'story', art: { emoji: '🐉' },
    text: [
      'Your dragonborn steps forward and roars in the old tongue of dragons. The wyrmling knows every word. *This mountain has an older dragon than you. Go home before it finds you.*',
      'The wyrmling drops flat on its bones and shivers. Then it snatches up its little hoard in its jaws and bolts out the back of the briar, away over the far hills. Its kobolds run after it. It does not look back, and it does not leave you a single coin.',
    ],
    // Sparing it costs the hoard: the fight pays, the mercy does not.
    next: [{ id: 'ok', label: 'Onward', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'green-cleared' }, { kind: 'setFlag', flag: 'green-sent' },
        ...tally(DEN_TICKS), { kind: 'xp', amount: 150 }] }],
    noBack: true,
  },
  // The clock (see DAWNS): after the Calling peaks, a den left standing is
  // empty. Its wyrmlings have gone up to the rim, and its hoard with them.
  'den-flown': {
    id: 'den-flown', kind: 'story', art: { emoji: '🪶' },
    text: ['The den is empty. Scorched scales litter the floor, and claw-marks run up the rock to the open sky. Whatever lived here went up to the stone when the Calling peaked, and it took its hoard in its belly. It will be waiting on the rim.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'greenden-done': {
    id: 'greenden-done', kind: 'story', art: { emoji: '🌿' },
    text: ['The briar tunnel stands silent, and the sharp green stink has faded to ordinary rot. There is one dragon fewer in these hills.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  seam: {
    id: 'seam', kind: 'story', art: { emoji: '🌊' },
    text: [
      'A mountain brook runs up the pass instead of down it, quickly and steadily, straight against gravity. Where it pools at the top, the pool has a shape. It has shoulders. It waits with a patience that water should not have.',
      'The weeks the Undercrypt\'s ward stood broken left thin places in the world, and something came through this one. The Calling holds it here like a cork in a bottle. The road to the middle pass runs right through its pool.',
    ],
    next: [{ id: 'fight', label: 'Break the water', to: 'seam-fight' }],
  },
  'seam-fight': {
    id: 'seam-fight', kind: 'battle', encounterId: 'water-vortex', mapId: 'bog',
    intro: ['The pool stands up. Twelve feet of mountain water in the rough shape of a giant, cold as the crack it came through. The **water elemental** does not roar. It simply pours itself at you, and it hits like the flood it actually is.'],
    onWin: { to: 'hills', text: ['The elemental loses its argument with gravity all at once. It collapses into a hundred gallons of ordinary water, which hurries away downhill as if embarrassed. The thin place behind it closes. The pass is open.',
      'Just before it shuts, you hear something through the crack, far away and deep under the ground. It is a slow sound, like the sea heard in a shell. Something down there is listening.'],
      effects: [{ kind: 'setFlag', flag: 'seam-cleared' }, ...tally(), { kind: 'gold', amount: 50 }] },
  },
  'seam-done': {
    id: 'seam-done', kind: 'story', art: { emoji: '💧' },
    text: ['The brook runs downhill now, the way brooks should, chattering over the stones with no shape in it at all. The crack it came through stays shut.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  blueden: {
    id: 'blueden', kind: 'battle', encounterId: 'blue-dragon-den', mapId: 'ruins',
    intro: [
      'The mesa smells like a storm about to break. A **blue wyrmling** has taken the ruined watchtower at its top, and its kobolds have been busy. They have lashed copper rods to every standing wall to catch the lightning, and the rods hum.',
      'The wyrmling uncoils along a broken wall, crackling with pride, and the air turns sharp and metallic. Someone has clearly told it that it will be enormous one day. Nobody has told it about you.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling falls off the wall trailing dead sparks, and the copper rods go cold. The hoard here was tribute, saved up for a dragon\'s future. It pays for your present instead.'],
      effects: [{ kind: 'setFlag', flag: 'blue-cleared' }, ...tally(DEN_TICKS), { kind: 'gold', amount: 95 }] },
  },
  'blueden-done': {
    id: 'blueden-done', kind: 'story', art: { emoji: '⚡' },
    text: ['The ruin on the mesa stands empty, and its copper rods are turning green. The storms overhead are only weather now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  onihold: {
    id: 'onihold', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: [
      'Someone holds the middle pass, and holds it the way a soldier would. A stone fort stands across it, rebuilt in a week by hands that lift boulders like loaves of bread. Guard posts of sharpened pine ring its walls, and a horn hangs by the gate. It has sounded once today.',
      'The holder stands above the gate: an **ogre-mage**, blue-skinned, wearing scraps of old lacquered armour. It looks down at you, and that look frightens you more than anything else in these hills, because it is thinking.',
      '"The stone sings," it calls down, pleasantly. "We answered first, and whoever answers first holds the pass. Pay a toll of one hundred and fifty gold, and we will find another war. Or try us. We have not had a proper fight all week."',
    ],
    next: [
      { id: 'pay', label: 'Pay the toll (150 gold)', to: 'onihold-paid',
        requires: [{ kind: 'gold', atLeast: 150 }],
        effects: [{ kind: 'gold', amount: -150 }, { kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'setFlag', flag: 'oni-paid' }, ...tally()] },
      // Wren's tip: set the two warbands on each other. One try, and easier
      // with her notes. A lie it sees through drives the party off the pass.
      { id: 'trick-notes', label: '[Deception DC 12] Wren\'s tip: warn it the ettin is coming for the pass', to: 'onihold-tricked',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        once: true, check: { skill: 'deception', dc: 12, failTo: 'onihold-driven' } },
      { id: 'trick', label: '[Deception DC 15] Warn it the ettin is coming for the pass', to: 'onihold-tricked',
        requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true,
        once: true, check: { skill: 'deception', dc: 15, failTo: 'onihold-driven' } },
      { id: 'fight', label: 'Try them', to: 'onihold-fight' },
    ],
  },
  // Lied to: the ogre-mage marches on the giants' hall (see `steading-raided`).
  'onihold-tricked': {
    id: 'onihold-tricked', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: [
      '"Keep your toll," you call up. "The ettin up the hill says it answered the stone first. It\'s coming down for your pass tonight. We only came to watch."',
      'The ogre-mage\'s pleasant face goes very still. "Two heads," it says, "and not one honest thought between them." It blows the horn four times. By dusk its whole warband is marching uphill toward the giants\' hall. The gate behind them stands open.',
    ],
    next: [{ id: 'ok', label: 'Onward', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'setFlag', flag: 'oni-tricked' },
        ...tally(), { kind: 'xp', amount: 300 }] }],
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
    next: [{ id: 'on', label: 'Back on the trail, a day behind', to: 'hills', effects: [{ kind: 'passDay' }] }],
  },
  // Bought off: the ogre-mage takes the gold and its warband leaves the mountain.
  'onihold-paid': {
    id: 'onihold-paid', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The ogre-mage weighs the purse in one blue hand and smiles. "A war that pays before it starts is the best kind." It blows the horn three times. By noon its warband is marching down the far side of the mountain, away from the valley. The middle pass is open.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'onihold-fight': {
    id: 'onihold-fight', kind: 'battle', encounterId: 'oni', mapId: 'corridor',
    intro: ['The horn sounds twice, and the gate opens on the ogre-mage\'s guard. An ogre in an iron collar marches out with its maul on its shoulder, like a drilled soldier. A scarred old orc in stolen mail calls the step. Then the ogre-mage itself rises off the wall on a cold wind with its blade drawn. The air darkens around it like ink spreading through water.'],
    onWin: { to: 'hills', text: ['The ogre-mage falls out of its own darkness, astonished right to the end. Its drilled guard lies dead at the gate. The middle pass stands open, and beyond it lies the road to the giants\' hall and the stone. The fort\'s war-chest is yours, fair and square.'],
      effects: [{ kind: 'setFlag', flag: 'oni-cleared' }, ...tally(), { kind: 'gold', amount: 130 }] },
  },
  'onihold-done': {
    id: 'onihold-done', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The fort at the middle pass stands empty, its horn silent on the wall. Wren\'s scouts have been through. They have chalked a small arrowhead by the gate, pointing up.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  redden: {
    id: 'redden', kind: 'battle', encounterId: 'red-dragon-den', mapId: 'firepit',
    intro: [
      'You smell the den before you see it: woodsmoke with a hot, metal edge to it. It sits in a scorched bowl of hillside where a **red wyrmling** has built itself a forge-hall out of split rock and cinders. Kobolds tend heaps of half-melted treasure with the care of moneylenders.',
      'The wyrmling lies on the largest heap with one eye open. Red dragons are the proudest of a proud family, and the stone\'s song promised this one a war. It rises, burning with its own light, delighted that you have saved it the trip downhill.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling\'s fire goes out from the inside, and it is finally, simply small. Its half-melted hoard cools into heavy lumps. They are the honest kind, and Bram will weigh them twice and pay well.',
      'The stone\'s song dips, and a voice comes down the wind with it. "That one was promised a war," says one of the sisters, almost fondly. "Never mind. Promises are cheap, and we have plenty left."'],
      effects: [{ kind: 'setFlag', flag: 'red-cleared' }, ...tally(DEN_TICKS), { kind: 'gold', amount: 120 }] },
  },
  'redden-done': {
    id: 'redden-done', kind: 'story', art: { emoji: '🔥' },
    text: ['The burning den has gone cold. Rain has found the scorched bowl, and something green is growing up through the ash, thoroughly unimpressed by dragons.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  gorgonvale: {
    id: 'gorgonvale', kind: 'story', art: { emoji: '🗿' },
    text: [
      'The statues in this valley are far too good. One is a shepherd caught mid-stride, with one arm flung up. One is a wolf turning to run. One is a hired sword with his blade half drawn, and a look on his face you can read from thirty paces. No sculptor ever worked this fast.',
      'At the head of the valley stands a bull made of black iron plates, grazing between its own victims. This is a **gorgon**. Its breath turns living things to stone, and steam curls from its nostrils in the cold air. The Calling drew it down from somewhere higher and worse.',
      'It has not noticed you yet. The statues suggest that never lasts long.',
    ],
    next: [
      // Wren's tip: the statues' purses lie at their feet. One try, and the
      // gorgon stays to be fought (or left) either way.
      { id: 'rob', label: 'Rob the statues without waking it', to: 'gorgonvale-sneak', once: true },
      { id: 'fight', label: 'Go in blade-first', to: 'gorgonvale-fight' },
      { id: 'leave', label: 'Back away before it looks up', to: 'hills' },
    ],
  },
  'gorgonvale-sneak': {
    id: 'gorgonvale-sneak', kind: 'challenge', art: { emoji: '🗿' },
    intro: [
      'The statues stand in crooked rows, and their purses lie in the grass at their feet, where the stone belts let go of them. The gorgon grazes at the far end with its back half turned. Its iron plates creak as it chews.',
      'One wrong step on the loose rock, and you join the collection.',
    ],
    approaches: [
      { id: 'creep-notes', label: 'Creep in along Wren\'s line', hint: 'Wren\'s tip: go in quietly, and take only the purses at their feet.',
        skill: 'stealth', dc: 11, requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true },
      { id: 'creep', label: 'Creep from statue to statue', hint: 'Keep a stone body between you and it at every step.',
        skill: 'stealth', dc: 14, requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true },
      { id: 'watch', label: 'Wait for it to doze', hint: 'Watch until its head droops, then walk in on its blind side.',
        skill: 'perception', dc: 14 },
    ],
    success: { to: 'hills', text: [
      'You work down the rows with soft hands. You lift a purse from a stone shepherd and a silver ring from a stone finger. A hired sword gives up his flask of healing without a word.',
      'The gorgon chews on and never once looks up. You are back on the trail before your hands stop shaking.',
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
    text: ['The valley of statues stands in permanent, silent company. Moss will cover them in time, and shepherds will tell stories about them for much longer. Nothing grazes between them now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  steading: {
    id: 'steading', kind: 'battle', encounterId: 'giants', mapId: 'ruins',
    intro: STEADING_INTRO, onWin: STEADING_WON,
    parley: { skill: 'deception', dc: 14, label: 'Agree with both heads at once', success: STEADING_PARLEY },
  },
  // The same hall, with Wren's notes in hand.
  'steading-notes': {
    id: 'steading-notes', kind: 'battle', encounterId: 'giants', mapId: 'ruins',
    intro: STEADING_INTRO, onWin: STEADING_WON,
    parley: { skill: 'deception', dc: 11, label: 'Wren\'s tip: agree with both heads at once', success: STEADING_PARLEY },
  },
  // The ogre-mage took the bait: its warband hit the hall in the night. The
  // same roster still stands (a lighter one would need its own encounter), but
  // it is beaten up and quarrelling, so the parley comes cheaper.
  'steading-raided': {
    id: 'steading-raided', kind: 'battle', encounterId: 'giants-raided', mapId: 'ruins',
    intro: [
      'Above the tree-line stands the giants\' hall, and it has had a bad night. Fire has eaten half the roof. Dead orcs from the ogre-mage\'s warband lie in the yard, and the ettin\'s ogre lies among them. Of the ogre-mage itself there is only a trail of blue blood, leading down the far side of the mountain.',
      'The **ettin** comes out at the first scrape of your boots, limping. "YOU let them in," roars the left head. "YOU were asleep," roars the right. A skinny orc runner stumbles out behind it. All three of them notice you at once.',
    ],
    onWin: { to: 'hills', text: ['The ettin goes down still blaming itself, one head at a time. The orc runner lies beside it. The ogre-mage\'s warband left its war-chest in the yard, and the hall holds the ettin\'s tribute too. Two warbands on the mountain have stopped answering the stone.'],
      effects: [{ kind: 'setFlag', flag: 'steading-cleared' }, ...tally(), { kind: 'gold', amount: 190 }] },
    parley: {
      skill: 'deception', dc: 11, label: 'Ask each head whose fault the raid was',
      success: { to: 'hills', text: [
        'You ask the left head whose fault the raid was. Then you ask the right head. That is all it takes.',
        'The two heads fall to brawling across the yard, through what is left of the wall, and down the back of the mountain. The orc runner limps after it, shouting. The road to the stone stands open.',
      ], effects: STEADING_TALKED },
    },
  },
  'steading-done': {
    id: 'steading-done', kind: 'story', art: { emoji: '🏚️' },
    text: ['The giants\' hall stands hollow, its doorway a bright rectangle of sky. Vex will want it for a forward post. Wren\'s scouts have claimed the roof.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },

  // === ACT 3 — THE CALLING ===============================================
  // The clutch path: any wyrm den left standing means the brood masses on
  // the ridge and must be fought through to reach the stone.
  'calling-gate': {
    id: 'calling-gate', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [
      'You reach the last ridge. The Calling is not a pull any more. It is a pressure, a note held so long that the mountain hums it back at you.',
      'Beyond the ridge, a bowl of bare rock opens under the sky. At its centre stands the **stone**: a single black fang, older than anyone can guess, wrapped in a light that hurts to look at.',
      'Wingbeats ride the wind. The rim of the bowl is where the wyrms gather, and the Calling has pulled every wyrmling it could still reach up there to meet you. Clear the rim, and only the stone and its keepers are left.',
    ],
    next: broodChoices([{ kind: 'setFlag', flag: 'calling-found' }]),
    noBack: true,
  },
  // The den-raiding payoff: all three dens emptied, so the brood never masses.
  'calling-gate-clear': {
    id: 'calling-gate-clear', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [
      'You reach the last ridge. The Calling is not a pull any more. It is a pressure, a note held so long that the mountain hums it back at you.',
      'Beyond the ridge, a bowl of bare rock opens under the sky. At its centre stands the **stone**: a single black fang, older than anyone can guess, wrapped in a light that hurts to look at.',
      'Nothing moves overhead. The rim is a gathering ground with nothing gathered on it. You emptied every den on the way up, so there is no brood left to send against you. You cross the ridge unopposed. Only the stone and its keepers are left.',
    ],
    next: goDown([{ kind: 'setFlag', flag: 'calling-found' }, { kind: 'setFlag', flag: 'clutch-skipped' }]),
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
    text: [
      'Before you start down, horns sound behind you. Vex has marched the forward column up through the passes you cleared, and his pikes spread out along the rim to hold it.',
      'Behind the pikes come faces you know from the valley, from the marsh road to the deep fen. Each of them owes your company something. They are out of breath and mud to the knees, and not one of them has climbed this mountain to stand at the back.',
      '"We hold the ridge. You go down," Vex says. "That was the whole plan, until this lot followed you up." He jerks a thumb at them. "Take what they brought. If any of them can fight, two can go down with you, no more. A big party\'s a loud one."',
    ],
    next: COUNCIL,
  },
  'war-council-table': {
    id: 'war-council-table', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '⚔️' },
    text: ['The column digs in along the rim. Vex waits at the edge of the bowl, and the faces from the valley wait to hear what else you need.'],
    next: COUNCIL,
  },
  // Nobody who owes the company came up the mountain: they are down in the valley.
  'war-council-cold': {
    id: 'war-council-cold', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '⚔️' },
    text: [
      'Before you start down, horns sound behind you. Vex has marched the forward column up through the passes you cleared, and his pikes spread out along the rim to hold it.',
      '"We hold the ridge. You go down," he says. "I\'d send somebody down with you. But the people who owe your company are back down in the valley, and I need every soldier I\'ve got on this rim." He nods at the stone. "So it\'s you and them. You\'ve done this before."',
    ],
    next: [{ id: 'down', label: 'Go down into the bowl', to: 'calling-approach', effects: [{ kind: 'setFlag', flag: 'rim-clear' }] }],
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
      'Down in the bowl, at the foot of the stone, the **sisters** are waiting. The two hags stand a head taller than any man. They have pushed their green fingers to the knuckle into the black rock. Old letters ring the base of the stone, cut deep and filled with lead, like the letters on the Warden\'s door under the fen.',
      'They are not commanding the stone. They are pouring themselves into it. Their hair has turned to river-weed and wire, and their faces are burning down like candles. They are spending two long lives to keep the Calling singing.',
      '"Sister-killers," they say together, without turning around. "Our sister kept the door under the fen since before your Thornwick had a name. One lamb at the water\'s edge each midwinter, and the Warden slept. You cut her down in the chief\'s hall, and you left that door to a priest\'s book."',
      '"So we did what she did. She bought a reed-cutter with a valley. We bought these hills with the same coin, one promise at a time." The light around the stone thickens, and the ground beneath it begins, gently, to burn. "But you came so far. Stay. The last of the collection is arriving now. Out of the fire, and out of the ground."',
    ],
    // The level floor lands before the hardest fight, not after it: every
    // answer carries it (see REPLIES).
    next: replyChoices,
  },
  'answer-defiant': {
    id: 'answer-defiant', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['The sisters laugh together, a sound like wind in dry reeds. "A few carters in a pen," one says. "She grew greedy at the end. We do not deny it. But for longer than your Thornwick has had a name, she took one lamb a winter, and the dead never once walked. Ask your barrows what her death bought you." Their hands sink deeper into the stone, and the burning ground creeps toward your boots.'],
    next: TO_STONE, noBack: true,
  },
  'answer-rueful': {
    id: 'answer-rueful', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['For one breath, the song falters. The younger sister turns her burning face toward you. "Sorry," she says slowly, as if nobody has ever said the word to her before. "Sorry does not put the dead back to sleep. But I heard it." The elder sister, **Nettle**, hisses at her. "Sedge. Hold still." Sedge turns back to the stone.'],
    // The one reply that opens a door: ask Sedge to take up her dead sister's
    // vigil. Success ends the Calling without the last fight; a miss leaves
    // the stone to be faced the usual way. One try.
    next: [
      { id: 'vigil', label: '[Persuasion DC 15] Ask Sedge to keep the vigil her sister kept', to: 'vigil-kept',
        once: true, hideWhenBlocked: true,
        requires: [{ kind: 'notFlag', flag: 'sisters-loose' }, { kind: 'notFlag', flag: 'stone-spent' }],
        check: { skill: 'persuasion', dc: 15, failTo: 'vigil-refused' } },
      ...TO_STONE,
    ],
    noBack: true,
  },
  'answer-cold': {
    id: 'answer-cold', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['You say nothing. The ring of your blade leaving its sheath is your whole answer. The sisters go quiet, and for the first time they look a little afraid. "Then come and pull us out," they say together. "If you can."'],
    next: TO_STONE, noBack: true,
  },
  // Face them, or let the stone spend them: a success means the sisters fight
  // in person (`sisters-battle`); every approach failing means the stone
  // throws its whole cataclysm at you instead (`calling-battle`).
  'tear-loose': {
    id: 'tear-loose', kind: 'challenge', art: { imageId: 'loc-mountain', emoji: '🗿' },
    intro: [
      'The sisters have sunk their hands to the wrist in the black rock. The stone is drinking them down. A crack of fire opens across the floor of the bowl, and something huge is climbing up out of it.',
      'All their power is in the stone now. Pull them out, and they must fight you with their own two hands. Leave them there, and the stone will spend every last drop of them at once.',
    ],
    retry: 'perApproach',
    approaches: [
      { id: 'drag', label: 'Drag their hands out of the rock', hint: 'Grab a wrist each and pull, while the stone pulls back.',
        skill: 'athletics', dc: 15, requires: [{ kind: 'noCompanion', companion: 'hask' }], hideWhenBlocked: true,
        failure: { to: 'tear-loose', text: ['The rock holds them fast. You let go with burned palms, and the stone keeps drinking.'] } },
      // Hask's way: the same haul, on a sergeant's count.
      { id: 'hask', label: '[Hask] Haul them out on Hask\'s count', hint: 'He has called the step for twenty years. Pull when he says pull, and not before.',
        skill: 'athletics', dc: 11, requires: [{ kind: 'companion', companion: 'hask' }], hideWhenBlocked: true,
        success: { to: 'sisters-battle', effects: LOOSE, text: ['Hask plants his feet and counts the way a sergeant counts a drill. "Ready. Ready. *Pull.*" Everyone pulls on the same word, again and again. On the fifth pull the stone lets go, and both sisters come free, smoking and furious.'] },
        failure: { to: 'tear-loose', text: ['Hask counts, and you all pull on the word. The stone pulls back harder. Hask spits on his burned palms. "It\'s got better footing than we have."'] } },
      // The fen-folk's ropes, from the war council (`drowned-gold-home`).
      { id: 'ropes', label: 'Haul them out with the fen-folk\'s ropes', hint: 'Loop a drowning-rope round each sister and pull, the way the fen-folk pull the living out of deep water.',
        skill: 'athletics', dc: 11,
        requires: [{ kind: 'flag', flag: 'fen-ropes' }], hideWhenBlocked: true,
        success: { to: 'sisters-battle', effects: LOOSE, text: ['The ropes bite, and the whole company hauls together. The stone can hold against hands. It cannot hold against a rope the fen-folk braided to pull the drowned out of deep water. Both sisters come free with a sound like a boot pulled out of mud, smoking and furious.'] },
        failure: { to: 'tear-loose', text: ['The ropes smoke and part where they touch the stone. Two scorched ends hang from your hands.'] } },
      { id: 'song', label: 'Break the song', hint: 'Sing a wrong note into the Calling and knock it off its beat.',
        skill: 'arcana', dc: 15,
        failure: { to: 'tear-loose', text: ['Your wrong note goes into the song and vanishes. The Calling swallows it and sings on.'] } },
      // Halden lived through the barrows, and the company read his rites at the door.
      { id: 'rites', label: 'Say Halden\'s rites over the stone', hint: 'Brother Halden\'s book of rites went down into the barrows with you. Its oldest words are for shutting doors.',
        skill: 'religion', dc: 11,
        requires: [{ kind: 'flag', flag: 'sunken-barrows:halden-saved' }, { kind: 'noCompanion', companion: 'halden' }], hideWhenBlocked: true,
        success: { to: 'sisters-battle', effects: LOOSE, text: ['Halden\'s old words fall on the stone like cold water on a hot pan. The black rock hisses and lets go. Both sisters stagger free, smoking and furious.'] },
        failure: { to: 'tear-loose', text: ['You lose the words halfway through. Halden always warned you to say them whole.'] } },
      // Halden came down into the bowl: he says his own rites at the stone.
      { id: 'halden', label: '[Halden] Let Halden say his rites over the stone', hint: 'He climbed the whole mountain to say them here. Stand back and let him.',
        skill: 'religion', dc: 8, requires: [{ kind: 'companion', companion: 'halden' }], hideWhenBlocked: true,
        success: { to: 'sisters-battle', effects: LOOSE, text: ['Brother Halden steps up to the stone and opens his book. He does not need it. He says the old words for shutting a door, the whole of them, in his own calm voice. The black rock hisses like a doused fire and lets go. Both sisters stagger free, smoking and furious.'] },
        failure: { to: 'tear-loose', text: ['Halden gets halfway. Then the song finds the place in him the Warden once held, and his voice shakes. "Not here," he whispers. "It\'s too loud here."'] } },
      // A wizard can read the old letters cut into the stone.
      { id: 'letters', label: 'Read the old letters cut into the stone', hint: 'Your wizard knows these marks. Find the line that holds the sisters, and scratch it out.',
        skill: 'arcana', dc: 11,
        requires: [{ kind: 'classInParty', classId: 'wizard' }], hideWhenBlocked: true,
        success: { to: 'sisters-battle', effects: LOOSE, text: ['Your wizard finds the line of old letters that binds the sisters in. One scratch of a knife point through the last letter, and the stone spits them both out.'] },
        failure: { to: 'tear-loose', text: ['The letters crawl and shift under your wizard\'s eyes. They will not hold still long enough to read.'] } },
      // A warlock knows how a pact is built, and how one breaks.
      { id: 'pact', label: 'Offer the stone a better bargain', hint: 'Your warlock knows how pacts work. Every pact has a way out.',
        skill: 'deception', dc: 13,
        requires: [{ kind: 'classInParty', classId: 'warlock' }], hideWhenBlocked: true,
        success: { to: 'sisters-battle', effects: LOOSE, text: ['Your warlock speaks to the stone the way a patron speaks, and promises it something better than two old hags. The stone believes it for one breath. That is long enough. It lets go of the sisters to reach for the new prize.'] },
        failure: { to: 'tear-loose', text: ['The stone has heard better offers. It keeps the sisters and goes on drinking.'] } },
      // Wren's way: a scout's eye finds the weak line for you.
      { id: 'wren', label: '[Wren] Let Wren find the stone\'s weak seam', hint: 'She has found the weak spot in every wall on this mountain. Hit where she points.',
        skill: 'investigation', dc: 10, requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true,
        success: { to: 'sisters-battle', effects: LOOSE, text: ['Wren walks round the stone twice, slowly, the way she walks a pass. Then she lays her knife-point on a crack as thin as a thread. "There." You hit it with everything you have. The stone rings like a cracked bell and spits the sisters out, smoking and furious.'] },
        failure: { to: 'tear-loose', text: ['Wren points, and you strike, but the crack has closed by the time your blow lands. "It moved," she says. She does not sound as if she believes it.'] } },
      { id: 'seam', label: 'Find where the stone is weakest', hint: 'Look for the seam the song leaks out of, and hit it hard.',
        skill: 'investigation', dc: 14, requires: [{ kind: 'noCompanion', companion: 'wren' }], hideWhenBlocked: true,
        failure: { to: 'tear-loose', text: ['Every face of the stone looks the same to you, smooth and black and singing.'] } },
    ],
    success: { to: 'sisters-battle', effects: LOOSE, text: ['The stone gives a crack like a snapped bone and throws the sisters off. They land on their feet, smoking and furious. For the first time in longer than anyone can remember, the coven has to fight for itself.'] },
    failure: { to: 'calling-battle', effects: [{ kind: 'setFlag', flag: 'stone-spent' }], text: ['Nothing you try reaches them. The sisters sink into the stone to the elbow, and the stone takes everything they have left.'] },
    noBack: true,
  },
  // Torn loose: the sisters fall fighting, beside the one elemental the stone
  // still had the strength to raise.
  'sisters-battle': {
    id: 'sisters-battle', kind: 'battle', encounterId: 'sisters-at-stone', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The sisters come at you with green claws and burning faces. Behind them, the crack in the floor gives up the last thing the stone can pay for. A pillar of living fire climbs out and turns toward you. This time the sisters have to fight for themselves.'],
    onWin: { to: 'calling-won', text: ['The first sister falls clawing at your boots. The second falls calling her dead sister\'s name, and then cursing yours. Both of them crumble into drifts of dry reeds, and the fire gutters out of the air. The black fang has nobody left to spend, so it cracks from top to bottom and falls silent. The Calling ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  // Sedge said yes: she drags her sister out of the stone and takes her down
  // to the fen, to keep the Warden's door. The Calling dies with nobody
  // feeding it. No last fight, and no hoard either.
  'vigil-kept': {
    id: 'vigil-kept', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🚪' },
    text: [
      '"The door under the fen still needs a keeper," you tell her. "We broke the vigil, and a priest\'s book is a poor jailer. Your sister kept that door for longer than Thornwick has had a name. Keep it for her."',
      'Sedge looks down at her own hands, sunk to the wrist in the stone. Then she pulls them out. The stone screams. Nettle screams with it, and Sedge takes her sister by both wrists and drags her free.',
      'With nobody feeding it, the Calling falters. The black fang cracks from top to bottom and goes quiet. The fire in the floor of the bowl sinks back into the rock.',
      '"We will keep the door," Sedge says. "And we will eat what the keeping pays: one lamb at the water\'s edge each midwinter, as our sister did before she grew greedy. Do not come into the deep fen again." Nettle says nothing. She only looks at you, the way you look at a debt you mean to collect.',
    ],
    next: walkDown(0, 'vigil-down-with', 'vigil-aftermath', 'Watch them walk down the mountain toward the fen',
      [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'setFlag', flag: 'vigil-kept' }, { kind: 'xp', amount: 1200 }]),
  },
  ...walkDownScenes('vigil-down-with', 'vigil-aftermath'),
  'vigil-refused': {
    id: 'vigil-refused', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['Sedge listens to the end. Then she laughs, and it is not a kind laugh. "Starve in the dark for another age, so that you can sleep soundly? No." Nettle hisses at her to hold still. The stone drinks deeper, and the burning ground creeps toward your boots.'],
    next: TO_STONE,
  },
  'vigil-aftermath': {
    id: 'vigil-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      'You come down the hill on your own feet. The camp has seen two tall green shapes walk past its lines in the dusk, and it has not decided yet whether to cheer.',
      'Vex decides for it. "The Calling\'s broken," he says, loud enough to carry. Then, quieter: "I hear we\'ve got hags in the fen again." You tell him they\'re keepers now. He looks at you for a long moment. "Then I hope they keep," he says.',
      '**Wren**, the camp\'s Chief of Scouts, watched the two hags walk past from the scouts\' fire with an arrow on the string the whole way. When she sees the four of you behind them, she puts the arrow away and grins her whole age for once.',
    ],
    next: [
      { id: 'pay', label: 'Accept the valley\'s purse — every village paid in', to: 'vigil-purse',
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
    intro: ['The sisters pour the last of themselves into the stone, and the stone spends it all at once. The floor of the bowl splits along a burning crack. A pillar of living fire climbs out of it, and the mountain\'s own bones heave up beside it into a shape with fists. The sisters sink into the rock to the shoulder, and they do not let go. The Calling\'s last note is a disaster, and it has your name in it.'],
    onWin: { to: 'calling-won', text: ['The sisters crumble into drifts of dry reeds, smiling as they go. The fire gutters out of the air, and the stone shape shakes itself apart into loose rubble. The black fang has nothing left to spend and nobody left to spend it, so it cracks from top to bottom and falls silent. The Calling does not end with thunder. It ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  'calling-won': {
    id: 'calling-won', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌅' },
    text: [
      'It is over. The **Calling Stone** lies cracked and silent, and the sisters are gone with it. Where they fell, a scatter of dry reeds lifts on the wind. The revenge they climbed all this way to take burned away in the taking. Your company has the mountain to itself.',
      'Below you, pass by pass, the hills go quiet. The song that pulled monsters toward the valley has stopped. Whatever was still walking down the slope stops, shakes its head, and turns back toward its own hills. The wingbeats fade off the wind.',
      'The valley is safe. Far down the slope, faint and disbelieving, the war-camp starts to cheer.',
    ],
    next: walkDown(0, 'down-with', 'wc-aftermath', 'Come down the mountain'),
  },
  ...walkDownScenes('down-with', 'wc-aftermath'),
  'wc-aftermath': {
    id: 'wc-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      'You come down the hill on your own feet. You walk into a camp that has stopped being an army and started being the biggest festival the valley has ever thrown.',
      'Vex shakes your hand like a man signing off on accounts he never expected to balance. "The Calling\'s broken," he says. "Tomorrow this camp packs up and everybody goes home. Do stop now, before your luck notices you."',
      '**Wren**, the camp\'s Chief of Scouts, looks at the four of you, then up at the hills, and grins her whole age for once. Then she remembers herself, coughs, and goes back to giving orders.',
    ],
    next: [
      { id: 'pay', label: 'Accept the valley\'s purse — every village paid in', to: 'wc-purse',
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
      'You wake in the hospital tent to canvas light and the smell of Bram\'s cooking, which nobody voted for. The scouts carried you off the mountain in relays.',
      'Vex looks in, sees that you are breathing, and sets your kit at the foot of the cot without a word. The hills are still up there. The stone is still calling. It is only waiting.',
    ],
    next: [{ id: 'up', label: 'Back on your feet', to: 'warcamp' }], noBack: true,
  },
  // The ending after the last fight: its text holds for every company, and
  // the slides read the run back. Each slide stands alone, so any mix of them reads in order.
  'wc-epilogue': {
    id: 'wc-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'The valley remembers it as the year of three wars: the raiders, the graves, and the hills. The songs about the last one all end on the same mountain, with your company standing on it. You silenced the Calling, and the coven\'s long debt burned away to reeds on a mountain wind.',
      MIRA_TOAST,
      'Vex raises a glass to the four of you. "To the company," he says. "Paid in full."',
    ],
    slides: [
      ...SLIDES_HILLS,
      { if: [{ kind: 'flag', flag: 'answered-defiant' }],
        text: 'The valley still says what you told the sisters: she ate people out of a pen, so we owe her nothing.' },
      { if: [{ kind: 'flag', flag: 'answered-rueful' }],
        text: 'Some nights you still think about the sisters, and about the vigil you ended without knowing it was one.' },
      { if: [{ kind: 'flag', flag: 'answered-cold' }],
        text: 'The valley still argues about what you said to the sisters at the stone. You said nothing at all.' },
      ...SLIDES_PEOPLE,
      { if: [{ kind: 'companion', companion: 'halden' }],
        text: 'At the broken stone, Halden said the rites for the sisters too. Nobody else would have.' },
      { if: [{ kind: 'flag', flag: 'fen-ropes' }],
        text: 'The fen-folk carry their drowning-ropes home from the mountain and hang them over the widow\'s door at the edge of the fen. Everyone who walks past asks about them.' },
      { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the Undercrypt\'s door still holds, though on still nights the fen-folk swear they hear something knock.' },
      // A company that won Part 2, with a clean seal.
      { if: [{ kind: 'flag', flag: 'sunken-barrows:won' }, { kind: 'notFlag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the Undercrypt\'s door stays shut and silent, just as you left it.' },
    ],
  },
  // The ending after Sedge took up the vigil: the Calling died unfought, and
  // there are hags in the fen again. Same slides for the hills and the people.
  'wc-epilogue-vigil': {
    id: 'wc-epilogue-vigil', kind: 'ending', outcome: 'victory', art: { emoji: '🚪' },
    text: [
      'The valley remembers it as the year of three wars: the raiders, the graves, and the hills. The songs about the last one end strangely. There is no great fight on the mountain. Two tall women walk down out of the hills and into the deep fen, and the Calling stops.',
      MIRA_TOAST,
      'Vex raises a glass to the four of you. "To the company," he says. "And to whoever\'s keeping that door tonight."',
    ],
    slides: [
      ...SLIDES_HILLS,
      { if: [],
        text: 'Some nights you still think about Sedge, down in the dark of the fen, keeping a door for a valley that will never thank her.' },
      ...SLIDES_PEOPLE,
      { if: [{ kind: 'companion', companion: 'halden' }],
        text: 'Halden walks down to the edge of the deep fen each spring and reads the rites aloud. Something out in the reeds always waits until he has finished.' },
      { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the knocking at the Undercrypt\'s door stops for good. The fen-folk leave a lamb at the water\'s edge each midwinter again, the way their grandparents did.' },
      { if: [{ kind: 'notFlag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the Undercrypt\'s door stays shut. Two shapes keep watch over it now, and the fen-folk know better than to ask their names.' },
    ],
  },
};

export const WYRMCALLING_MODULE: Module = {
  id: 'wyrmcalling', title: 'The Wyrmcalling',
  blurb: 'The Reedwife\'s sisters wake the Calling Stone, and the hills answer with wyrms, giants, and worse. Climb the passes, thin what answers, and silence the stone.',
  cover: 'loc-mountain',
  levelBand: { from: 4, to: 5 },
  start: 'muster', scenes, defeatScene: 'wc-defeat', town: 'warcamp',
  // The clock: the Calling peaks on the sixth morning. Any dragon den still
  // standing then empties, and its wyrmlings go up to the rim (den-flown).
  dawns: [
    { day: 3, text: ['The stone\'s note is louder this morning. At the scouts\' fire, Wren chalks a number on the map board: three more nights before the Calling peaks, she reckons, and not one more.'] },
    { day: 5, text: ['The streams on the mountain run uphill all night now, loud enough to hear from the camp. Vex doubles the watch. "Tonight," he says. "Whatever\'s still in those dens will fly."'] },
    { day: 6, text: ['The Calling peaked in the night. The whole mountain hummed with it, and the pikemen stood to their posts until dawn. Anything still nesting in the hills has gone up to the ridge.'],
      effects: [{ kind: 'setFlag', flag: 'calling-peaked' }] },
  ],
  // The people the war council can send down into the bowl (see SEATS).
  companions: {
    wren: {
      id: 'wren', name: 'Wren', monsterId: 'scout', portraitId: 'npc-scout', emoji: '🏹',
      blurb: 'Chief of Scouts. She followed the column up to the rim, and she is not staying on it.',
    },
    halden: {
      id: 'halden', name: 'Brother Halden', monsterId: 'priest', portraitId: 'npc-priest', emoji: '🕯️',
      blurb: 'Thornwick\'s priest, whom you talked back out of the Warden\'s grip. He came to say his rites at the stone.',
    },
    hask: {
      id: 'hask', name: 'Hask', monsterId: 'veteran', portraitId: 'npc-guard', emoji: '🛡️',
      blurb: 'The Ashfang chief\'s guard, who answered to Vex and stood aside for you. Vex lent him to you for the stone.',
    },
  },
};
