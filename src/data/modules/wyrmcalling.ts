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
 * a leg); otherwise she held the Barrow Gate for you in Part 2.
 * Wren also remembers a company that left her under the horse
 * (`hollow-road:scout-left`). A cold start is still the company that broke
 * the Ashfang and killed the Reedwife: Vex met it at his fire, Wren guided it
 * through the fen, and nothing carried says how either parting went. A saved
 * Halden (`sunken-barrows:halden-saved`) opens an easier way to tear the
 * sisters loose. The endings' slides read these and the rest
 * (`hollow-road:chief-dead`, `sunken-barrows:seal-cracked`, what became of
 * Vargan); the fen-folk's fire at the war-camp reads the cracked door too,
 * through a "you've been here" beat the reach search does not track, and at
 * the stone the Warden's dead come up through the cracks (see CRACKED).
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
 * bring ropes that make `tear-loose` easier. A cold start is owed Wren alone.
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
import { withNpcs, speaker, companionsFrom } from '../../adventure/npcs.js';
import { TRILOGY_NPCS as NPCS } from './npcs.js';

const WREN = speaker(NPCS.wren!, 'Chief of Scouts');
const BRAM = speaker(NPCS.bram!, 'War-Quartermaster');

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
  '"Here\'s the problem." He taps the map, where fires mark the high passes. "Every day the stone sings, more of the hills come down to listen. Wyrm dens here, here and here. An ogre-mage holding the middle pass. An ettin in a hall above the tree-line. Giant footprints in the orchards, and streams running uphill."',
  '"When the Calling peaks, all of it comes down this slope at once, unless it\'s dead first. So every den you burn out is one monster fewer on the day. Clear what you can reach, and my scouts will keep the map honest." A thin smile comes and goes. "I\'ll bring the column up behind you once the passes are open. Apparently I\'m respectable now, and respectable men don\'t go up first."',
];

const briefed = (vexBody: string): Effect[] => [
  { kind: 'setFlag', flag: 'briefed' },
  { kind: 'journal', entry: { id: 'n-vex3', kind: 'npc', title: 'Captain {vex}', body: vexBody } },
  { kind: 'journal', entry: { id: 'lead-stone', kind: 'lead', resolvedBy: 'calling-found',
    title: 'The Calling Stone', body: 'Somewhere past the ogre-mage\'s pass and the giants\' hall, the sisters are tending the stone that calls the hills down. Climb until you find it.' } },
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
  '"The **manticore** on the toll-cliff talks. It\'ll ask you for a toll, and what it really wants is you. But it\'s greedy. Promise it a bigger meal somewhere else, and it might fly off. The **boar-runs** flood with a stampede twice a day. Watch the dust, and you can slip across between runs."';
const WREN_GORGON =
  '"There\'s a valley past the middle pass full of statues that are far too good. A **gorgon** made them. Its breath turns people to stone. Their purses are still lying at their feet. Go in quietly, or go in with your blade drawn."';
const WREN_GIANTS =
  '"The ogre-mage and the ettin both want the valley, and neither one trusts the other. The ettin\'s two heads can\'t even agree with each other. Use that."';

const TAKE_NOTES: Choice[] = [{ id: 'ok', label: 'Take her map-notes', to: 'warcamp',
  effects: [{ kind: 'setFlag', flag: 'wren-brief' }, { kind: 'xp', amount: 30 },
    { kind: 'journal', entry: { id: 'c-scoutnotes', kind: 'clue', title: '{wren}\'s Map-Notes',
      body: '{wren} said the manticore on the toll-cliff is greedy, so promise it a bigger meal somewhere else. Watch the dust at the boar-runs and slip across between stampedes. The gorgon\'s statues dropped their purses when their belts turned to stone, and anyone quiet enough can pick them up. The ogre-mage and the ettin distrust each other, and the ettin\'s two heads never agree.' } }] }];

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
 * Play reads it too: Vex's map in the command tent, and the camp on the
 * morning after the Calling peaks (see PEAK_WHEN). A requirement can only ask
 * "at least N" (or `notFlag`, "zero or less"), so a three-way split is made by
 * a node's `sceneWhen`, where the first match wins. The reach search does not
 * track a counted flag; a requirement on it is taken as possible either way.
 */
const TALLY = 'threats-cleared';
const THREAT_PAR = 7;
const DEN_TICKS = 2;
const tally = (n = 1): Effect[] => Array.from({ length: n }, () => ({ kind: 'setFlag' as const, flag: TALLY }));
/** The tally read in play: at least TALLY_HIGH is more than half the hills
 *  dealt with (eight or more), at least TALLY_HALF about half (four to seven),
 *  and anything under that is a camp in trouble. */
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
const HERD_SPARED: Effect[] = [{ kind: 'setFlag', flag: 'boarruns-cleared' }, { kind: 'setFlag', flag: 'herd-spared' },
  ...tally(), { kind: 'xp', amount: 150 }];

/** A missed run across the boar-runs: a pack bursts under the herd. */
const SCATTERED: Effect[] = [{ kind: 'gold', amount: -30 }];

const GORGON_WON = { to: 'hills', text: ['The gorgon crashes onto its side with its iron plates ringing, and the green vapour thins away to nothing. The statues keep their silent watch.'],
  effects: [{ kind: 'setFlag', flag: 'gorgon-cleared' }, ...tally(), { kind: 'gold', amount: 100 }] } satisfies Outcome;

/** The ettin talked into a fight with itself: the hall empties, no loot. */
const STEADING_TALKED: Effect[] = [{ kind: 'setFlag', flag: 'steading-cleared' }, { kind: 'setFlag', flag: 'ettin-split' },
  ...tally(), { kind: 'xp', amount: 300 }];

const STEADING_INTRO = [
  'Above the tree-line stands the giants\' hall, built from whole pine trunks and stone blocks as big as wagons. Something put it up in a single season. The **ettin** that holds it comes out at the first scrape of your boots. It is two heads arguing on top of one enormous body. A shaggy ogre in a sheepskin stumbles out behind it, still chewing. A skinny orc runner trots at its heels.',
  '"THE STONE PROMISED US THE VALLEY," booms the left head. "The stone promised ME the valley," the right head corrects. Then both heads notice you at the same moment, and for the first time all day they agree about something.',
];
const STEADING_WON = { to: 'hills', text: ['The ettin goes down still arguing about whose fault it was. The orc runner lies beside it. Inside the hall you find tribute, plunder, and an entire orchard\'s worth of pickled fruit, all of it bound for the war-camp below. Two loud voices on the mountain have stopped answering the stone.'],
  effects: [{ kind: 'setFlag', flag: 'steading-cleared' }, ...tally(), { kind: 'gold', amount: 140 }] } satisfies Outcome;
/** Wren's tip: the two heads never agree. Agree with both. */
const STEADING_PARLEY = [
  '"The valley is yours," you tell the left head. Then you turn to the right head. "And yours." Both heads hear you say it.',
  'The ettin stands very still. Then it punches itself in the jaw. The two heads brawl across the hall and through the back wall, and they roll on down the far side of the mountain. The ogre and the orc runner chase after it, shouting. The road to the stone stands open.',
];

const TO_EPILOGUE: Choice[] = [{ id: 'done', label: 'Let the valley celebrate', to: 'wc-epilogue' }];
const TO_VIGIL_EPILOGUE: Choice[] = [{ id: 'done', label: 'Let the valley celebrate', to: 'wc-epilogue-vigil' }];

/**
 * The walk down the mountain: one short beat for each companion the war
 * council sent down into the bowl, in a fixed order, then on to the camp.
 * The ending slides say what became of them; these only say they came back.
 */
const ESCORTS = ['wren', 'halden', 'hask'] as const;
const ESCORT_LINES: Record<(typeof ESCORTS)[number], string> = {
  wren: '{wren} walks down beside you, counting the passes under her breath. At each one she stops and marks the map. "For the report," she says. She does not say she is glad you are all alive. She keeps checking that you are, though.',
  halden: 'Brother {halden} walks down with his prayer book shut under his arm. Halfway down he stops, holds out his hands, and looks at them. For the first time since the drowned chapel, they are not shaking.',
  hask: '{hask} walks down at the back, the way a guard should, and says nothing the whole way. At the last bend he looks back up at the broken stone. "Tell {vex} I kept my feet," he says.',
};
/** What each escort's line takes for granted besides being there. */
const ESCORT_ASSUMES: Partial<Record<(typeof ESCORTS)[number], Requirement[]>> = {
  halden: [{ kind: 'flag', flag: 'sunken-barrows:halden-saved' }],
  hask: [{ kind: 'flag', flag: 'hollow-road:vex-turned' }],
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
/** The other optional threats after the peak: they went down the slope at the
 *  camp on the night, so they are gone from their posts, and the night is
 *  judged without them (no tally tick). Each beat only leads back to the
 *  hills, so it costs the reach search nothing. The required ones (the
 *  flooded pass, the middle pass, the giants' hall) hold the road to the
 *  stone, and stay where they are. */
const PEAKED_GONE = (id: string) => ({ if: [{ kind: 'flag' as const, flag: 'calling-peaked' }], to: `${id}-flown` });
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
 * try that ends the Calling without the last fight). The defiant and the cold
 * answers each lead to their own `tear-loose` (see tearLoose): defiance makes
 * Nettle sing louder (breaking the song is harder), and cold steel makes Sedge
 * flinch (dragging her out is easier). Routed by scene, not by flag, so the
 * answer flags are still read only by the ending and cost the reach search
 * nothing. The level floor rides on every answer, so it lands before
 * whichever fight comes. A company that cut the captives out of the Ashfang
 * pens (Part 1) says so in its defiance (`answer-defiant`).
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
  // Answered once: a company that falls back and climbs again goes to
  // `calling-return`, not back through the sisters' greeting.
  effects: [{ kind: 'xpToLevel', level: 5 }, { kind: 'setFlag', flag: r.flag }] }));
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
 *   - Wren (she lived, or walked the fen with you; every company) — joins, a scout;
 *   - Brother Halden (`halden-saved`) — joins, a priest;
 *   - Hask, Vex's guard (`vex-turned`) — joins, a veteran;
 *   - the fen-folk (`drowned-gold-home`) — ropes: an easier way to drag the
 *     sisters out of the stone at `tear-loose`.
 * Wren is owed a seat by every company, a cold start too, so there is
 * always a council. Leaving the council sets `rim-clear`, so a company
 * that comes back up after a defeat walks straight down. Who goes down is the
 * way out of the council: one choice per group (alone, any one, or any pair;
 * two seats, no more), so the cap costs the reachability search no facts.
 *
 * Two more debts are paid at the war-camp, as map markers:
 *   - the carter from the Ashfang pens (`captives-freed`) — potions;
 *   - Reeve Aldous's watch (`grandfather-home`) — two ticks on the camp's tally.
 * Each marker's scene is the gift, and a company not owed it (or already
 * paid) is turned aside to a "nothing here for you" beat. The reach search
 * does not track a flag read only by such a beat, and every carried flag it
 * does track doubles its whole search, so these two cost it nothing.
 */
const has = (flag: string): Requirement => ({ kind: 'flag', flag });
const hasNot = (flag: string): Requirement => ({ kind: 'notFlag', flag });

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
  { if: [has('calling-peaked'), hasNot('peak-seen'), has(PEAK_HELD)], to: 'peak-night' },
  { if: [has('calling-peaked'), hasNot('peak-seen')], to: 'peak-line' },
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
      text: `His finger moves to the dens. "The ${list} ${many ? 'dens are' : 'den is'} still standing. Burn ${many ? 'them' : 'it'} out, and that's ${['one more wyrm', 'two more wyrms', 'three more wyrms'][standing.length - 1]} that never ${many ? 'reach' : 'reaches'} the rim."` });
    lines.push({ if: [...dens, has('calling-peaked')],
      text: `His finger moves to the dens. "The ${list} ${many ? 'dens are' : 'den is'} empty now. ${many ? 'Those wyrms' : 'That wyrm'} flew up to the rim when the Calling peaked. You'll meet ${many ? 'them' : 'it'} there."` });
  }
  return lines;
};
/** `before` is how the hills stand while the night of the Calling is still
 *  coming; `after`, once the camp has been through it. */
/** How the night went, as the company saw it the morning after (the tent's
 *  marker shows `peak-night` / `peak-line` first, so these are always set by
 *  the time the tent shows `after`). Read off the snapshot, not the live row. */
const TENT_NIGHT: Para[] = [
  { if: [has('peak-easy')], text: 'He taps the east line. "And the night of the Calling went our way. I didn\'t bury anyone."' },
  { if: [has('peak-cost')], text: 'He taps the east line. "We got through the night of the Calling. It cost us more than I like."' },
  { if: [has('peak-broke')], text: 'He taps the east line. "We nearly didn\'t get through the night of the Calling. You saw what was left of it."' },
];
const tentScene = (id: string, row: string, before: string, after: string): Scene => ({
  id, kind: 'story', art: { emoji: '🗺️' }, noBack: true,
  text: [TENT_OPEN,
    { if: [hasNot('calling-peaked')], text: `${row} ${before}` },
    { if: [has('calling-peaked')], text: `${row} ${after}` },
    ...TENT_NIGHT,
    ...denLines()],
  next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
});
/** Down into the bowl: through the council the first time, straight down after. */
const goDown = (effects: Effect[] = []): Choice[] => {
  const fx = effects.length ? { effects } : {};
  return [
    { id: 'down', label: 'Down into the bowl', to: 'calling-approach', hideWhenBlocked: true,
      requires: [has('rim-clear'), hasNot('sisters-loose'), hasNot('stone-spent')], ...fx },
    // Back after falling back or a defeat: the sisters have had their say, so
    // the party goes straight back to the fight it left (see TO_STONE).
    { id: 'back-loose', label: 'Back down into the bowl', to: 'calling-return', hideWhenBlocked: true,
      requires: [has('rim-clear'), has('sisters-loose')], ...fx },
    { id: 'back-spent', label: 'Back down into the bowl', to: 'calling-return', hideWhenBlocked: true,
      requires: [has('rim-clear'), has('stone-spent')], ...fx },
    // The first time: through the war council. Every company is owed Wren
    // at least (see SEATS), so there is always a council.
    { id: 'down-council', label: 'Down into the bowl', to: 'war-council', hideWhenBlocked: true,
      requires: [hasNot('rim-clear')], ...fx },
  ];
};
/** Who is owed a place beside the company, and why (`owed`: any one of these
 *  requirement lists holds; they never overlap). Wren: always. She lived in
 *  Part 1, or walked the fen with you in Part 2, and a cold start is still the
 *  company she guided through the fen (she greets it so at her fire). */
const SEATS = {
  wren: { name: '{wren}', who: 'who has mapped every pass you cleared', role: 'a scout',
    owed: [[]],
    journal: { id: 'n-wren3', title: '{wren}, Chief of Scouts',
      body: '{wren} climbed up with the column and went down into the bowl with you. Somebody, she says, has to write the route report.' } },
  halden: { name: 'Brother {halden}', who: 'his prayer book under his arm', role: 'a priest',
    owed: [[has('sunken-barrows:halden-saved')]],
    journal: { id: 'n-halden3', title: 'Brother {halden}',
      body: '{halden} climbed the whole mountain with his prayer book under his arm, to say his rites at the stone. A door\'s a door, he says, whether it\'s under a fen or inside a rock.' } },
  hask: { name: '{hask}', who: '{vargan}\'s guard, who stood aside for you in his hall', role: 'a veteran',
    owed: [[has('hollow-road:vex-turned')]],
    journal: { id: 'n-hask', title: '{hask}, {vex}\'s Sergeant',
      body: '{hask} was the Ashfang chief\'s own guard, but he answered to {vex}. When you came for {vargan} in his hall, {hask} stood aside and let you pass. Now {vex} has lent him to you for the stone.' } },
} as const;
type Seat = keyof typeof SEATS;
const SEAT_IDS = Object.keys(SEATS) as Seat[];
/** Every way to fill (up to) two seats from what each requirement list allows. */
const product = (lists: ReadonlyArray<ReadonlyArray<ReadonlyArray<Requirement>>>): Requirement[][] =>
  lists.reduce<Requirement[][]>((acc, l) => acc.flatMap((a) => l.map((r) => [...a, ...r])), [[]]);
/**
 * The way out of the council, and always the company's choice: go down alone,
 * with any one companion owed a seat, or with any two of them (never more).
 * Each group shows whenever every member of it is owed a seat.
 */
const escortChoices = (): Choice[] => {
  const groups: Seat[][] = [[], ...SEAT_IDS.map((c) => [c]),
    ...SEAT_IDS.flatMap((c, i) => SEAT_IDS.slice(i + 1).map((d) => [c, d]))];
  return groups.flatMap((g) => {
    const names = g.map((c) => `${SEATS[c].name}, ${SEATS[c].who}`).join(', and ');
    const label = g.length === 0 ? 'Go down into the bowl alone' : `Go down into the bowl with ${names}`;
    return product(g.map((c) => SEATS[c].owed)).map((owed, i): Choice => ({
      id: `go-${g.join('-') || 'alone'}-${i}`, label, to: 'calling-approach', hideWhenBlocked: true,
      requires: owed,
      effects: [{ kind: 'setFlag', flag: 'rim-clear' },
        ...g.flatMap((c): Effect[] => [{ kind: 'joinParty', companion: c },
          { kind: 'journal', entry: { kind: 'npc', ...SEATS[c].journal } }])],
    }));
  });
};
const COUNCIL: Choice[] = [
  { id: 'ropes', label: 'Take the fen-folk\'s drowning-ropes',
    to: 'war-council-table', once: true, hideWhenBlocked: true, requires: [has('sunken-barrows:drowned-gold-home')],
    effects: [{ kind: 'setFlag', flag: 'fen-ropes' },
      { kind: 'journal', entry: { id: 'c-ropes', kind: 'clue', title: 'The Fen-Folk\'s Ropes',
        body: 'The families whose drowned you carried home sent two fen-folk up the mountain with coils of drowning-rope, braided for hauling people out of deep water. Loop them round the sisters and pull.' } }] },
  ...escortChoices(),
];

/** The fen-folk's hedge-witch, drawn so she works whether or not the company
 *  ever sat at the regulars' table in Mira's inn and heard her talk spells. */
const FENFOLK_WITCH = 'The fen-folk keep their own small fire at the edge of the camp, with their boar-spears stacked beside it. An old hedge-witch waves you over. She has river-stones braided into her hair. In Thornwick she drinks at the regulars\' table in {mira}\'s inn. "Magic\'s never free," she tells the young casters there, "whatever the college boys say." She knits while she talks, and she doesn\'t look up.';

/** The witch's point: the people the Ashfang penned for the Reedwife were her
 *  own greed, not the door's price. (The price itself, a lamb a winter, is
 *  Nettle's to tell, at the stone.) */
const FENFOLK_PRICE = '"Those poor souls the Ashfang penned up for her? That was the {reedwife}\'s own greed," she says. "The door never asked for them. The fen gave her a little, for a long time, and the dead slept sound." She pulls a stitch tight. "The sisters want feeding again now, and a little won\'t do. They want the whole valley."';

const MIRA_TOAST = '{mira}, who keeps the Wander-Inn down in Thornwick, has hauled a barrel all the way up to the camp. She fills your cup before you can reach for your purse. "Three times now," she says. "I did warn you about habits."';
/** The reeve's thanks, in his own key. */
const REEVE_PLAQUE = 'Down in Thornwick, the reeve orders a plaque made for the square. He has the wording changed twice.';

type Slide = { if: Requirement[]; text: string };
/** Ending slides every company's ending shares: the hills, and the people. */
const SLIDES_HILLS: Slide[] = [
  // A company that won both earlier chapters.
  { if: [{ kind: 'flag', flag: 'hollow-road:won' }, { kind: 'flag', flag: 'sunken-barrows:won' }],
    text: 'You broke the Ashfang, sealed the Undercrypt, and silenced the stone.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:vargan-executed' }],
    text: 'Nobody in the valley mourns {vargan}. Nobody sings about the way he died, either, on his knees in his own hall with the hag already dead. The reed-cutters are back in the shallows he sold, and they do not say his name.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:chief-dead' }, { kind: 'notFlag', flag: 'hollow-road:vargan-executed' }],
    text: 'Nobody in the valley mourns {vargan}. His mother\'s house is still under the water, but the reed-cutters are back in the shallows he sold, cutting reeds for a copper a bundle.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:vex-turned' }],
    text: '{vex} keeps the reeve\'s pardon folded in his coat. He has opened it so often that the creases have gone soft.' },
  { if: [{ kind: 'notFlag', flag: 'hollow-road:vex-turned' }],
    text: '{vex} keeps a key to the reeve\'s cells on a nail by his cot. He walked into Thornwick once expecting a rope. Now he holds the keys.' },
  { if: [{ kind: 'flag', flag: 'oni-paid' }],
    text: 'Far past the mountain, an ogre-mage\'s warband marches on someone else\'s valley, and your gold paid for its boots.' },
  { if: [{ kind: 'notFlag', flag: 'oni-paid' }],
    text: 'The fort at the middle pass becomes {vex}\'s lookout, and no warband holds that pass against the valley again.' },
  { if: [{ kind: 'flag', flag: 'clutch-skipped' }],
    text: 'No dragon flies over the high pastures again. You emptied every den on the way up.' },
  { if: [{ kind: 'flag', flag: 'green-sent' }],
    text: 'Somewhere past the far hills, a green dragon is growing up. It still flinches at the sound of the dragon tongue.' },
  // The night of the Calling (see DAWNS, PEAK_WHEN). A company that came
  // back to the camp afterwards saw how it went, and the slide says the same.
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'flag', flag: 'peak-easy' }],
    text: 'On the night of the Calling, the war-camp held. You had thinned the hills so well that {vex} did not lose a single soldier. {bram} still complains about all the arrows nobody needed.' },
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'flag', flag: 'peak-cost' }],
    text: 'On the night of the Calling, the pikes held, but it cost. {vex} keeps the list of names he wrote that morning, and he reads it aloud once a year.' },
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'flag', flag: 'peak-broke' }],
    text: 'On the night of the Calling, the beasts you left in the hills nearly broke the war-camp. {vex} burned a long row of funeral fires the next morning, and he wrote down every name.' },
  // A company that never came back to the camp between the peak and the stone
  // (it stayed up, or fast-travelled past every marker) did not see the night.
  // Its slide is judged by the same snapshot the morning would have shown.
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'notFlag', flag: 'peak-seen' }, peakAtLeast(TALLY_HIGH)],
    text: 'The Calling peaked while you were still up in the hills, and the war-camp fought the night of it without you. You had thinned the hills so well that {vex} did not lose a single soldier.' },
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'notFlag', flag: 'peak-seen' }, { kind: 'flag', flag: PEAK_HELD }, { kind: 'notFlag', flag: PEAK_TALLY }],
    text: 'The Calling peaked while you were still up in the hills, and the war-camp fought the night of it without you. The pikes held, but it cost. {vex} keeps the list of names he wrote that morning.' },
  { if: [{ kind: 'flag', flag: 'calling-peaked' }, { kind: 'notFlag', flag: 'peak-seen' }, { kind: 'notFlag', flag: PEAK_HELD }],
    text: 'The Calling peaked while you were still up in the hills, and the beasts you left there nearly broke the war-camp without you. {vex} burned a long row of funeral fires the next morning, and he wrote down every name.' },
  { if: [{ kind: 'notFlag', flag: 'calling-peaked' }, { kind: 'notFlag', flag: TALLY }],
    text: 'You broke the stone before the Calling peaked, and the war-camp never had to fight its night. But what you left in the hills is still up there. The shepherds will be dealing with it for years.' },
  { if: [{ kind: 'notFlag', flag: 'calling-peaked' }, { kind: 'flag', flag: TALLY, value: 1 }],
    text: 'You broke the stone before the Calling peaked, and you had thinned the hills on the way. {vex} sends the pikemen home before the first snow.' },
  { if: [{ kind: 'flag', flag: 'manticore-sent' }],
    text: 'The manticore never came back to its cliff. Shepherds say it circled the broken stone for a week, shouting for the meal the hags swore to give it.' },
  { if: [{ kind: 'flag', flag: 'herd-spared' }],
    text: 'The giant boars still run their gully twice a day. They run it away from the valley now.' },
  { if: [{ kind: 'flag', flag: 'oni-tricked' }],
    text: 'The ogre-mage limped off the mountain after its war with the ettin. It never did learn who started it.' },
  { if: [{ kind: 'flag', flag: 'ettin-split' }],
    text: 'Hunters still hear the ettin some nights, far off in the high hills. It is still arguing with itself about the valley.' },
  { if: [{ kind: 'flag', flag: 'clutch-beaten' }],
    text: 'The wyrmlings you left in their dens died on the rim instead, and the shepherds still give those dens a wide berth.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:vargan-jailed' }],
    text: '{vargan} hears about the Calling in the reeve\'s reed-beds. He asks to go up and fight. The reeve says no, and {vargan} goes back to cutting.' },
  { if: [{ kind: 'flag', flag: 'hollow-road:vargan-freed' }],
    text: 'A reed-cutter with a scarred hand left a sack of reed-arrows at the war-camp gate one night. Nobody saw his face. {bram} sold every one.' },
];
const SLIDES_PEOPLE: Slide[] = [
  { if: [{ kind: 'flag', flag: 'hollow-road:saved-scout' }],
    text: '{wren} still limps on cold mornings, and she tells every new scout how you lifted a dead horse off her leg.' },
  // A cold start is still the company Wren guided through the fen.
  { if: [{ kind: 'notFlag', flag: 'hollow-road:saved-scout' }],
    text: '{wren} tells every new scout how she held the gate of the Undercrypt, and how you walked back out.' },
  // What became of Marrow, the gravedigger at the Warden's door (Part 2).
  { if: [{ kind: 'flag', flag: 'sunken-barrows:marrow-sings' }],
    text: 'Word comes up from Saltmere that a grey old gravedigger has mended forty graves there. While the stone sang, he sat up among them every night with a lamp, saying the rites, in case anyone woke.' },
  { if: [{ kind: 'flag', flag: 'sunken-barrows:marrow-bound' }],
    text: '{marrow} still mends Thornwick\'s churchyard on the reeve\'s orders. While the stone sang, he sat up among the graves every night with a lamp, in case anyone woke.' },
  { if: [{ kind: 'flag', flag: 'sunken-barrows:halden-saved' }],
    text: 'Brother {halden} climbs to the bowl each spring to bless the broken stone, and then he walks home to his little chapel.' },
  // The war assets the council called in (see COUNCIL).
  { if: [{ kind: 'companion', companion: 'wren' }],
    text: '{wren}\'s route report of the climb to the stone runs to eleven pages. It is the only report in the camp that admits anybody felt afraid.' },
  { if: [{ kind: 'companion', companion: 'hask' }],
    text: '{hask} went back to {vex}\'s side with a new scar and a better story, and {vex} pretends to be tired of hearing it.' },
  { if: [{ kind: 'flag', flag: 'mules-unloaded' }],
    text: 'The carter from the Ashfang pens drives the last wagon home to Thornwick. The girl in her new shoes rides on top.' },
  { if: [{ kind: 'flag', flag: 'watch-holds' }, { kind: 'flag', flag: 'calling-peaked' }],
    text: 'Thornwick\'s watch held the camp\'s weakest line on the night of the Calling. Reeve {aldous} has every man\'s name read aloud in the square, and he declares the debt settled.' },
  { if: [{ kind: 'flag', flag: 'watch-holds' }, { kind: 'notFlag', flag: 'calling-peaked' }],
    text: 'Thornwick\'s watch dug in on the camp\'s weakest line and stood ready all the same. Reeve {aldous} declares the debt settled, and has it written in the town\'s ledger.' },
];

const TEAR_OPEN = 'The sisters have sunk their hands to the wrist in the black rock. The stone is drinking them down. A crack of fire opens across the floor of the bowl, and something huge is climbing up out of it.';
const TEAR_STAKES = 'All their power is in the stone now. Pull them out, and they must fight you with their own two hands. Leave them there, and the stone will spend every last drop of them at once.';
/** The cracked door under the fen, answering the stone (see CRACKED). */
const TEAR_CRACKED = [
  'Then the floor of the bowl knocks under your boots, three slow knocks. You have felt that through stone before, with your hand on the Warden\'s door. The stone is singing down into the ground, all the way to the cracked door under the barrows, and something down there is answering.',
  'Grey hands push up through the cracks around the stone. They catch at your ankles and hold on. The Warden\'s dead have come up to hear the song.',
];
/**
 * Face the sisters, or let the stone spend them: a success means they fight
 * in person (`sisters`); every approach failing means the stone throws its
 * whole cataclysm at you instead (`calling`). Built for each answer's mood,
 * each twice: sound, and with the Warden's dead come up through the cracks
 * (see CRACKED).
 */
/** How the sisters took the company's answer: a defiant one makes `song`
 *  harder, a cold one makes dragging Sedge out easier (see REPLIES). */
type TearMood = 'defiant' | 'cold';
const tearLoose = (id: string, intro: string[], sisters: string, calling: string, mood?: TearMood): Scene => ({
    id, kind: 'challenge', art: { imageId: 'loc-mountain', emoji: '🗿' },
    intro,
    retry: 'perApproach',
    approaches: [
      mood === 'cold'
        // The cold answer: Sedge flinched at the drawn blade. Take her first.
        ? { id: 'drag-sedge', label: 'Drag {sedge} out first', hint: 'She flinched when you drew steel. Take her wrists before she finds her nerve again.',
          skill: 'athletics', dc: 12, requires: [{ kind: 'noCompanion', companion: 'hask' }], hideWhenBlocked: true,
          success: { to: sisters, effects: LOOSE, text: ['{sedge} does not pull back, not at first. By the time she does, her hands are out of the rock. {nettle} will not let her sister go alone, and she tears free after her, screaming.'] },
          failure: { to: id, text: ['{sedge} finds her nerve a moment too soon. She drives her hands back into the rock, and the stone keeps drinking.'] } }
        : { id: 'drag', label: 'Drag their hands out of the rock', hint: 'Grab a wrist each and pull, while the stone pulls back.',
          skill: 'athletics', dc: 15, requires: [{ kind: 'noCompanion', companion: 'hask' }], hideWhenBlocked: true,
          failure: { to: id, text: ['The rock holds them fast. You let go with burned palms, and the stone keeps drinking.'] } },
      // Hask's way: the same haul, on a sergeant's count.
      { id: 'hask', label: '[{hask}] Haul them out on {hask}\'s count', hint: 'He has called the step for twenty years. Pull when he says pull, and not before.',
        skill: 'athletics', dc: 11, requires: [{ kind: 'companion', companion: 'hask' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['{hask} plants his feet and counts the way a sergeant counts a drill. "Ready. Ready. *Pull.*" Everyone pulls on the same word, again and again. On the fifth pull the stone lets go. Both sisters tumble out across the rock, their burned hands curled like claws.'] },
        failure: { to: id, text: ['{hask} counts, and you all pull on the word. The stone pulls back harder. {hask} spits on his burned palms. "It\'s got better footing than we have."'] } },
      // The fen-folk's ropes, from the war council (`drowned-gold-home`).
      { id: 'ropes', label: 'Haul them out with the fen-folk\'s ropes', hint: 'Loop a drowning-rope round each sister and pull, the way the fen-folk pull the living out of deep water.',
        skill: 'athletics', dc: 11,
        requires: [{ kind: 'flag', flag: 'fen-ropes' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['The ropes bite, and the whole company hauls together. The stone can hold against hands. It cannot hold against a rope the fen-folk braided to pull the drowned out of deep water. Both sisters come free with a sound like a boot pulled out of mud. They lie tangled in the wet rope, hissing.'] },
        failure: { to: id, text: ['The ropes smoke and part where they touch the stone. Two scorched ends hang from your hands.'] } },
      mood === 'defiant'
        // The defiant answer: Nettle sings louder, out of spite.
        ? { id: 'song', label: 'Break the song', hint: '{nettle} has sung louder since you answered her. Sing a wrong note into the Calling anyway.',
          skill: 'arcana', dc: 17,
          failure: { to: id, text: ['{nettle} hears your wrong note and sings right over it, louder. The Calling never misses a beat.'] } }
        : { id: 'song', label: 'Break the song', hint: 'Sing a wrong note into the Calling and knock it off its beat.',
          skill: 'arcana', dc: 15,
          failure: { to: id, text: ['Your wrong note goes into the song and vanishes. The Calling swallows it and sings on.'] } },
      // Every company carried Halden's book down to the Warden's door, whether
      // he lived or not (a cold start is still the company that sealed the
      // barrows). With Halden himself here, his way is better.
      { id: 'rites', label: 'Say {halden}\'s rites over the stone', hint: 'Brother {halden}\'s book of rites went down into the barrows with you. Its oldest words are for shutting doors.',
        skill: 'religion', dc: 11,
        requires: [{ kind: 'noCompanion', companion: 'halden' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['{halden}\'s old words fall on the stone like cold water on a hot pan. The black rock hisses and lets go. Both sisters stagger free with steam rising off their arms.'] },
        failure: { to: id, text: ['You lose the words halfway through. The book says to say them whole, and you did not.'] } },
      // Halden came down into the bowl: he says his own rites at the stone.
      { id: 'halden', label: '[{halden}] Let {halden} say his rites over the stone', hint: 'He climbed the whole mountain to say them here. Stand back and let him.',
        skill: 'religion', dc: 8, requires: [{ kind: 'companion', companion: 'halden' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['Brother {halden} steps up to the stone and opens his book. He does not need it. He says the old words for shutting a door, the whole of them, in his own calm voice. The black rock hisses like a doused fire and lets go. Both sisters fall free at his feet, and {nettle} is already reaching for his throat.'] },
        failure: { to: id, text: ['{halden} gets halfway. Then the song finds the place in him the Warden once held, and his voice shakes. "Not here," he whispers. "It\'s too loud here."'] } },
      // A wizard can read the old letters cut into the stone: easier than
      // breaking the song (Arcana DC 15), but still a real roll at the climax.
      { id: 'letters', label: 'Read the old letters cut into the stone', hint: 'Your wizard knows these marks. Find the line that holds the sisters, and scratch it out.',
        skill: 'arcana', dc: 12,
        requires: [{ kind: 'classInParty', classId: 'wizard' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['Your wizard finds the line of old letters that binds the sisters in. One scratch of a knife point through the last letter, and the stone spits them both out.'] },
        failure: { to: id, text: ['The letters crawl and shift under your wizard\'s eyes. They will not hold still long enough to read.'] } },
      // A warlock knows how a pact is built, and how one breaks.
      { id: 'pact', label: 'Offer the stone a better bargain', hint: 'Your warlock knows how pacts work. Every pact has a way out.',
        skill: 'deception', dc: 13,
        requires: [{ kind: 'classInParty', classId: 'warlock' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['Your warlock speaks to the stone in a patron\'s voice, and promises it something better than two old hags. The stone believes it for one breath. That is long enough. It lets go of the sisters to reach for the new prize.'] },
        failure: { to: id, text: ['The stone has heard better offers. It keeps the sisters and goes on drinking.'] } },
      // Wren's way: a scout's eye finds the weak line for you.
      { id: 'wren', label: '[{wren}] Let {wren} find the stone\'s weak seam', hint: 'She has found the weak spot in every wall on this mountain. Hit where she points.',
        skill: 'investigation', dc: 10, requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true,
        success: { to: sisters, effects: LOOSE, text: ['{wren} walks round the stone twice, slowly, the way she walks a pass. Then she lays her knife-point on a crack as thin as a thread. "There." You hit it with everything you have. The stone rings like a cracked bell and spits the sisters out onto the rock. {sedge} is up first, with her claws out.'] },
        failure: { to: id, text: ['{wren} points, and you strike, but the crack has closed by the time your blow lands. "It moved," she says. She does not sound as if she believes it.'] } },
      { id: 'seam', label: 'Find where the stone is weakest', hint: 'Look for the seam the song leaks out of, and hit it hard.',
        skill: 'investigation', dc: 14, requires: [{ kind: 'noCompanion', companion: 'wren' }], hideWhenBlocked: true,
        failure: { to: id, text: ['Every face of the stone looks the same to you, smooth and black and singing.'] } },
    ],
    success: { to: sisters, effects: LOOSE, text: ['The stone gives a crack like a snapped bone and throws the sisters off. They land in a crouch, with ash falling out of their hair. For the first time in longer than anyone can remember, the coven has to fight for itself.'] },
    failure: { to: calling, effects: [{ kind: 'setFlag', flag: 'stone-spent' }], text: ['Nothing you try reaches them. The sisters sink into the stone to the elbow, and the stone takes everything they have left.'] },
    noBack: true,
});

/** Into the war-camp. Cold-start floor: a fresh company begins the finale
 *  at 4th level (no-op for a company continuing from The Sunken Barrows). */
const OPENING: Effect[] = [{ kind: 'xpToLevel', level: 4 },
  // The camp's tally starts below zero (see TALLY).
  { kind: 'setFlag', flag: TALLY, value: -THREAT_PAR },
  { kind: 'journal', entry: { id: 'q-calling', kind: 'quest', title: 'Silence the Calling',
    body: 'The {reedwife}\'s sisters have woken the Calling Stone in the high hills. Its song pulls wyrms, giants, and worse down on the valley. Climb the passes, kill what answers the call, and break the stone.' } }];

const scenes: Record<string, Scene> = {
  // === ACT 1 — THE WAR-CAMP ==============================================
  muster: {
    id: 'muster', kind: 'story', art: { imageId: 'loc-camp', emoji: '⚔️' },
    text: [
      'The valley has raised an army at last. A **war-camp** spreads across the wet meadows below the high hills. Thornwick\'s recruits drill there, fen-folk with boar-spears and carters holding pikes. This time everyone can see the trouble coming. Every night there are fires burning up in the high passes, and no shepherd lit them.',
      'A fen-folk recruit with a boar-spear falls into step beside you. "It\'s the **Calling Stone**," he says, and points his spear at the passes. "A black fang of rock up in the high hills. It sings, and every monster in the hills comes to listen. Down here you can\'t hear it yet. Up there, you will. The **{reedwife}\'s sisters** woke it. My cousin saw them at the edge of the fen the night the barrows closed."',
      'Word of your company reached the camp before you did. The crowd opens a path for you all the way to the command tent. Nobody says out loud whose fault the sisters are. They do not have to.',
      { if: [hasNot('sunken-barrows:won')],
        text: 'Your purse still holds two seasons of the reeve\'s pay: the bounty for the Ashfang, and the commission for the barrows. Thornwick pays its debts.' },
    ],
    next: [
      { id: 'go', label: 'Report to the command tent', to: 'envoys', hideWhenBlocked: true,
        requires: [has('sunken-barrows:won')], effects: OPENING },
      // A cold start is still the company that ended the Ashfang and sealed
      // the barrows, so it still has the pay: about what a run through Parts
      // 1–2 carries, and enough for the ogre-mage's toll.
      { id: 'go-cold', label: 'Report to the command tent', to: 'envoys', hideWhenBlocked: true,
        requires: [hasNot('sunken-barrows:won')], effects: [...OPENING, { kind: 'gold', amount: 400 }] },
    ],
    noBack: true,
  },
  envoys: {
    // The sister is only a seeming (see onWin); her hired swords are real.
    id: 'envoys', kind: 'battle', encounterId: 'knights', mapId: 'open',
    intro: [
      'You are ten paces from the command tent when the whole camp stops talking at once. A woman stands in your way who was not there a moment ago. She is a head taller than anyone in the camp, with river-weed braided into her hair. Four hired swords stand behind her: a knight in dented black plate, two archers and a thug with a club. They watch you with bored, empty eyes.',
      '"The famous company." She smiles without opening her mouth. "I am **{nettle}**, elder sister to the one you called the {reedwife}. She kept the door under the fen when your Thornwick was three huts in the reeds. You cut her down, and you cost this family its living. That debt is written down, and it will be paid."',
      'She flexes her green fingers. "The rest of the collectors are gathering up on the mountain. Think of this as the first notice."',
    ],
    onWin: { to: 'envoys-won', text: ['The last hired sword falls, and {nettle} falls apart into reeds and river-water. She was never really standing there at all. Her hired swords were real, and they stay where they fall.'] },
    // Losing the opening fight gets its own beat: nobody has met Vex yet,
    // and the briefing that follows must not read as if you had won.
    onLoss: { to: 'envoys-lost', text: ['{nettle}\'s green fingers are the last thing you see. Then you are face-down in the mud.'] },
  },
  'envoys-lost': {
    id: 'envoys-lost', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏕️' },
    text: [
      'You wake on a cot in the hospital tent. Camp scouts dragged you here out of the mud. The hag is gone, and her hired swords went with her. The scouts say she sank into a puddle and was gone.',
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
    assumes: [{ kind: 'notFlag', flag: 'briefed' }],
    again: ['The grey-haired captain is still at his map table, sword across his knees. "Sit down before you fall down," he says again.'],
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
    // Only a cold start: every company that won Part 1 met him at his fire.
    assumes: [{ kind: 'notFlag', flag: 'hollow-road:met-vex' }, { kind: 'notFlag', flag: 'hollow-road:vex-turned' }],
    text: [
      'You know this man. It is **{vex}**, once the Ashfang\'s lieutenant. You met him at his lone fire in the chief\'s den, the night your company broke the Ashfang. He kept out of the last fight. When it was over, he went to the reeve of his own accord. Now Thornwick trusts him to run its war. "It took me too long to walk away from that den," he says. "A slow learner still learns."',
      ...BRIEF_PLAN,
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('You met {vex} at his fire in the Ashfang den. He kept out of the chief\'s last fight and went to the reeve. Now he runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.') }],
  },
  // The party met him at his fire in the Ashfang den, and he did not take
  // their offer (or they never made one). He gave himself up anyway.
  'vex-brief-met': {
    id: 'vex-brief-met', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗡️' },
    assumes: [{ kind: 'flag', flag: 'hollow-road:met-vex' }, { kind: 'notFlag', flag: 'hollow-road:vex-turned' }],
    text: [
      'You know this man. It is **{vex}**, once the Ashfang\'s lieutenant. You met him at his lone fire in the chief\'s den, and you did not leave it with a deal. He sat out the last fight anyway, and the next morning he walked into the reeve\'s hall and gave himself up. Now Thornwick trusts him to run its war. "I walked in expecting to hang by noon," he says. "Instead the reeve handed me an army."',
      ...BRIEF_PLAN,
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('You met {vex} at his fire in the Ashfang den, and he did not take your offer. He sat out the chief\'s last fight, gave himself up, and now runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.') }],
  },
  'vex-brief-turned': {
    id: 'vex-brief-turned', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗡️' },
    assumes: [{ kind: 'flag', flag: 'hollow-road:vex-turned' }],
    text: [
      'You know this man. It is **{vex}**, once the Ashfang\'s lieutenant. In the chief\'s den he took your offer and kept his guards out of the last fight. The last you heard, he had taken the road out of the valley, just as he said he would.',
      '"I got as far as a hill inn," he says. "Then word came that the dead were walking, and then fires in the passes. I found I couldn\'t sit and drink while this valley burned twice. So I walked back and offered the reeve my sword. He took it, which surprised us both. No more burned barns. I like this side better."',
      ...BRIEF_PLAN,
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('{vex} was the Ashfang\'s lieutenant until he took your offer in the chief\'s den. He left the valley, then came back when the hills began to burn. Now he runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.') }],
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
        // Briefed, Vex's map says how the hills stand (see tentScene): the
        // first match wins, so the tally splits three ways.
        // Every marker opens on the morning after the peak, once (PEAK_WHEN).
        { id: 'command', x: 25, y: 30, label: 'The Command Tent', icon: 'tok-fire', scene: 'tent-after-loss',
          sceneWhen: [...PEAK_WHEN,
            { if: [has('briefed'), tallyAtLeast(TALLY_HIGH)], to: 'command-done' },
            { if: [has('briefed'), tallyAtLeast(TALLY_HALF)], to: 'command-half' },
            { if: [has('briefed')], to: 'command-thin' }] },
        { id: 'stores', x: 50, y: 45, label: 'The War-Stores', icon: 'tok-market', scene: 'wc-stores',
          sceneWhen: PEAK_WHEN },
        // Wren knows you if you pulled her out from under a horse (Part 1), and
        // coolly if you left her under it. Every company, a cold start too,
        // walked the fen with her in Part 2 (`scouts-fire-old`).
        { id: 'scouts', x: 30, y: 70, label: 'The Scouts\' Fire', icon: 'tok-camp', scene: 'scouts-fire-old',
          sceneWhen: [...PEAK_WHEN,
            // Back from the bowl with Wren still in the party: she isn't here.
            { if: [{ kind: 'companion', companion: 'wren' }], to: 'scouts-with-you' },
            { if: [{ kind: 'flag', flag: 'wren-brief' }], to: 'scouts-done' },
            { if: [{ kind: 'flag', flag: 'hollow-road:saved-scout' }], to: 'scouts-fire-saved' },
            // Left her under the horse, then (always, on the way to the Barrow
            // Gate) walked the fen with her: some of it is squared.
            { if: [{ kind: 'flag', flag: 'hollow-road:scout-left' }], to: 'scouts-fire-mended' },
          ] },
        // War assets paid at the camp (see WAR ASSETS): the marker's scene is
        // the gift; a company not owed it, or already paid, is waved past.
        { id: 'wagons', x: 58, y: 80, label: 'The Supply Wagons', icon: 'tok-market', scene: 'wagons-carter',
          sceneWhen: [...PEAK_WHEN,
            { if: [{ kind: 'flag', flag: 'mules-unloaded' }], to: 'wagons-busy' },
            { if: [{ kind: 'notFlag', flag: 'hollow-road:captives-freed' }], to: 'wagons-busy' },
          ] },
        { id: 'eastline', x: 62, y: 18, label: 'The East Line', icon: 'tok-lookout', scene: 'eastline-watch',
          sceneWhen: [...PEAK_WHEN,
            { if: [{ kind: 'flag', flag: 'watch-holds' }], to: 'eastline-busy' },
            { if: [{ kind: 'notFlag', flag: 'sunken-barrows:grandfather-home' }], to: 'eastline-busy' },
            // The night came before anyone gave the watch a post.
            { if: [{ kind: 'flag', flag: 'calling-peaked' }], to: 'eastline-late' },
          ] },
        // The fen-folk tie the Calling back to the fen: the Reedwife's old
        // price, and the door under the barrows. Both versions only lead back,
        // so the cracked door they read costs the reach search nothing.
        { id: 'fenfolk', x: 10, y: 52, label: 'The Fen-Folk\'s Fire', icon: 'tok-camp', scene: 'fenfolk-fire',
          sceneWhen: [...PEAK_WHEN, { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }], to: 'fenfolk-fire-cracked' }] },
        { id: 'trailhead', x: 80, y: 60, label: 'The High Trail', icon: 'tok-gate', scene: 'hills-out',
          // The first climb hears the Calling; after that, `again`.
          sceneWhen: PEAK_WHEN,
          requires: [{ kind: 'flag', flag: 'briefed' }],
          note: 'The lookout lets nobody up the high trail without the captain\'s orders. Report to the command tent.' },
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
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  'fenfolk-fire-cracked': {
    id: 'fenfolk-fire-cracked', kind: 'story', art: { imageId: 'loc-camp', emoji: '🔥' },
    assumes: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
    again: ['The hedge-witch is still knitting by the fen-folk\'s fire. "Hear it knock?" she says, without looking up. "Break that stone."'],
    text: [
      FENFOLK_WITCH,
      FENFOLK_PRICE,
      '"You know the door under the barrows. You shut it, near enough. Well, it knocks now, every night the stone sings, and louder each time." She pulls her yarn tight. "If the Calling runs much longer, that crack\'ll open. The sisters know it. I think they\'re counting on it."',
    ],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  // Vex's map, by the tally (see tentScene and TALLY_HIGH / TALLY_HALF).
  'command-done': tentScene('command-done', 'The row is longer than the list of fires now.',
    '"More than half of it\'s pinned," {vex} says. "If it all came down tonight, we\'d hold. Easily. I might even get some sleep."',
    '"More than half of it\'s pinned," {vex} says. "Now go and finish the rest."'),
  'command-half': tentScene('command-half', 'The row reaches about halfway down the edge of the map.',
    '"That\'s about half of it," {vex} says. "If it all came down tonight, we\'d hold. But I\'d be writing a lot of names in the morning."',
    '"That\'s about half of it," {vex} says. "The rest is still up there."'),
  'command-thin': tentScene('command-thin', 'It is a short row.',
    '"Not enough yet," {vex} says, and he taps the fires still burning in the passes. "If all of that came down tonight, it would go through this camp like a flood."',
    '"Not enough," {vex} says, and he taps the fires still burning in the passes. "All of that is still up there."'),
  // The morning after the peak (see PEAK_WHEN): the camp held, easily or not.
  'peak-night': {
    id: 'peak-night', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🔥' },
    text: [
      'The war-camp has had its night. The Calling peaked in the dark, and everything still loose in the hills came down the slope at once, just as Captain {vex} said it would.',
      { if: [peakAtLeast(TALLY_HIGH)],
        text: 'It did not get far. You had thinned the hills, and the pikes had little left to stop. The east line is trampled, but it is whole. {vex} walks it at dawn and finds nobody to bury.' },
      { if: [hasNot(PEAK_TALLY)],
        text: 'The pikes held, but it cost. The east line is a mess of mud and broken shafts, and the hospital tent is full. {vex} walks the line at dawn, stopping at every stretcher.' },
      { if: [has('watch-holds')],
        text: 'Thornwick\'s watch held the weakest end of the line all night. Their sergeant salutes you as you pass.' },
    ],
    next: [
      { id: 'easy', label: 'Back to the camp', to: 'warcamp', hideWhenBlocked: true, requires: [peakAtLeast(TALLY_HIGH)],
        effects: [{ kind: 'setFlag', flag: 'peak-seen', value: 1 }, { kind: 'setFlag', flag: 'peak-easy' }] },
      { id: 'cost', label: 'Back to the camp', to: 'warcamp', hideWhenBlocked: true, requires: [hasNot(PEAK_TALLY)],
        effects: [{ kind: 'setFlag', flag: 'peak-seen', value: 1 }, { kind: 'setFlag', flag: 'peak-cost' }] },
    ],
  },
  // Too little of the hills dealt with: the camp nearly broke, and the last
  // of the night is still at the east line. One fight, once (`peak-seen` is
  // set on the way in), and no walking away from it.
  'peak-line': {
    id: 'peak-line', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🔥' },
    text: [
      'The war-camp nearly broke in the night. The Calling peaked in the dark, and everything still loose in the hills came down the slope at once, just as Captain {vex} said it would. There was too much of it left.',
      'The east line is a wreck of mud and snapped pikes. Smoke hangs over the tents. And it is not over yet. Something is still singing over the east line, and the pikemen there are walking away from their posts toward it.',
      { if: [has('watch-holds')],
        text: 'Thornwick\'s watch is the only part of the line still standing in good order. Their sergeant waves you on toward the singing.' },
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
      'You wake in the hospital tent a day later. The pikemen drove the harpies off in the end, with rocks and shouting, and their own hands over their ears.',
      '{vex} looks in. He looks as if he has not slept. "We held," he says. "Just. Get up when you can. The stone is still singing."',
    ],
    next: [{ id: 'up', label: 'Back on your feet', to: 'warcamp', effects: [{ kind: 'passDay' }] }],
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
    intro: ['{bram} has taken over a supply wagon and, by the look of things, every pricing decision in the war. "War makes everything cost more. Except my goods, because I\'m a patriot. Also the captain reads my books." He turns a crate around to face you. "There\'s big things up that hill. Buy accordingly."'] },
  // Left under the horse in Part 1, then walked the fen together in Part 2.
  'scouts-fire-mended': {
    id: 'scouts-fire-mended', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    assumes: [{ kind: 'flag', flag: 'hollow-road:scout-left' }, { kind: 'noCompanion', companion: 'wren' }],
    again: ['{wren} looks up from the map board. "My notes are still here when you want them," she says. "The passes won\'t read themselves."'],
    lines: [
      '**{wren}** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She sees you and nods, once. It\'s not warm, but it\'s not the look she gave you in the fen, either.',
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' "And the streams are walking uphill. I don\'t know what that means yet, but I\'m watching it." She hands over the map-notes. "You walked past me once. Then you came back up out of that barrow when you said you would. I\'m still counting, but that one counted."',
    ],
    next: TAKE_NOTES,
  },
  // Wren knows the company from the deep fen: she held the Barrow Gate while
  // they went down into the Undercrypt. A cold start lands here too.
  'scouts-fire-old': {
    id: 'scouts-fire-old', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    // Every company, a cold start too, walked the fen with her in Part 2.
    assumes: [{ kind: 'notFlag', flag: 'hollow-road:saved-scout' }, { kind: 'notFlag', flag: 'hollow-road:scout-left' }, { kind: 'noCompanion', companion: 'wren' }],
    again: ['{wren} looks up from the map board. "My notes are still here when you want them," she says. "The passes won\'t read themselves."'],
    lines: [
      '**{wren}** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She made Chief of Scouts young. She wears the title like a coat that fits her but embarrasses her anyway.',
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' She frowns. "And the streams are walking uphill. I don\'t know what that means yet, but I\'m watching it." She pauses. "Last time I held a gate and waited for you to walk back out. I didn\'t enjoy it." She rolls the map up tight. "Don\'t make me wait at the top of a mountain as well."',
    ],
    next: TAKE_NOTES,
  },
  // Wren owes the company her leg, and probably her life: they lifted a dead
  // horse off her on the marsh road in Part 1.
  'scouts-fire-saved': {
    id: 'scouts-fire-saved', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    assumes: [{ kind: 'flag', flag: 'hollow-road:saved-scout' }, { kind: 'noCompanion', companion: 'wren' }],
    again: ['{wren} looks up from the map board. "My notes are still here when you want them," she says. "The passes won\'t read themselves."'],
    lines: [
      '**{wren}** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She stands when she sees you, and she only barely favours the leg you once pulled out from under a dead horse on the marsh road.',
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. ' + WREN_GIANTS + ' She frowns. "And the streams are walking uphill. I don\'t know what that means yet, but I\'m watching it." She pauses. "I counted the watch-posts for you once, lying under a horse. This is a better map." She almost smiles. "Come down the hill on your own feet. All of you. I\'ll be counting."',
    ],
    next: TAKE_NOTES,
  },
  'scouts-done': {
    id: 'scouts-done', kind: 'story', art: { emoji: '🏹' },
    assumes: [{ kind: 'noCompanion', companion: 'wren' }],
    text: ['The scouts\' fire crackles through another change of shift. {wren}\'s riders come and go with the brisk urgency she has drilled into them, and her map grows more arrowheads by the hour. She flicks you a two-finger salute without looking up.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
  },
  'scouts-with-you': {
    id: 'scouts-with-you', kind: 'story', art: { emoji: '🏹' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: ['The scouts\' fire crackles on without its chief. Her three young riders look up as you come over, then past you, at {wren}. She is still at your shoulder. "Map\'s on the board," she tells them. "Keep it honest till I\'m back." They grin, and go back to work.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
  },
  // The carter Part 1's company cut out of the Ashfang pens (`captives-freed`).
  'wagons-carter': {
    id: 'wagons-carter', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🐴' },
    text: [
      'A grey-bearded carter is backing a supply wagon up to {bram}\'s stores, and he stops halfway when he sees you. You last saw him in a stake pen behind the Ashfang kennels, with a girl of about seven on his back.',
      '"I drive for the army now. The pay\'s bad, and nobody locks me in at night." He reaches under the wagon-seat and comes up with a crate. "The best of the stores. Two flasks of greater healing, and one against fire for up where the dragons are. I took it off the top before {bram} could price it. Don\'t tell him."',
    ],
    next: [{ id: 'take', label: 'Take the carter\'s crate', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'mules-unloaded' },
        { kind: 'addItem', itemId: 'potion-greater-healing', qty: 2 }, { kind: 'addItem', itemId: 'potion-fire-resistance', qty: 1 },
        { kind: 'journal', entry: { id: 'c-carter', kind: 'clue', title: 'The Carter\'s Crate',
          body: 'The carter you cut out of the Ashfang pens drives supply wagons for the war-camp now. He kept the best of the stores back for you.' } }] }],
  },
  'wagons-busy': {
    id: 'wagons-busy', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🐴' },
    text: ['Supply wagons come and go from {bram}\'s stores in a slow line. The drivers are too busy to talk.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  // Reeve Aldous's thanks for carrying his grandfather home (`grandfather-home`).
  'eastline-watch': {
    id: 'eastline-watch', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '⚖️' },
    text: [
      'Twenty men in Thornwick\'s colours are digging in at the end of the camp\'s east line, where the pikes are thinnest. Their sergeant hands you a folded note in the reeve\'s stiff handwriting.',
      '*You carried my grandfather home. The watch is yours until the Calling is broken. — {aldous}*',
      '"Give us the weakest stretch of the line," the sergeant says. "Whatever comes down that slope on the night, that\'s less of it for the pikes to stop."',
    ],
    next: [{ id: 'post', label: 'Put Thornwick\'s watch on the weakest line', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'watch-holds' }, ...tally(2),
        { kind: 'journal', entry: { id: 'c-watch', kind: 'clue', title: 'Thornwick\'s Watch',
          body: 'Reeve {aldous} sent Thornwick\'s watch up to the war-camp, for carrying his grandfather home. They hold the camp\'s weakest line when the Calling peaks. That is two fewer things for the pikes to stop.' } }] }],
  },
  // Never posted, and the night has come and gone: no credit for holding it.
  'eastline-late': {
    id: 'eastline-late', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '⚖️' },
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: [
      'Twenty men in Thornwick\'s colours sit by the east line, mud to the eyebrows. They came up with a note from the reeve and waited for orders. Nobody gave them a post. On the night of the Calling they fought wherever the pikes broke.',
      'Their sergeant hands you the note, a little crumpled. *You carried my grandfather home. The watch is yours until the Calling is broken. — {aldous}* "We\'d have held a line for you," he says. "Nobody asked. The night came first."',
    ],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  'eastline-busy': {
    id: 'eastline-busy', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🛡️' },
    text: ['Pikemen stand to their posts along the east line. The sergeants wave you past without looking up from their work.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }],
  },
  'hills-out': {
    id: 'hills-out', kind: 'story', art: { imageId: 'loc-hills', emoji: '⛰️' },
    again: ['You take the high trail again, past the saluted marker. Above you, the Calling hums on, no quieter than before.'],
    text: ['The high trail leaves the last lookout behind at a stone marker the recruits have started saluting. Above you the hills stack up into the sky, pass over pass. Over the highest one you hear it for the first time: the **Calling**. It is not really a sound. It is a pull, like a door standing open somewhere above the clouds.',
      // Sedge's first beat, on every road up: her grief, not Nettle's ledger.
      'For a moment there is a voice on the wind, too. It is a woman\'s voice, raw from crying. "She kept it alone," it says. "In the dark, all those winters. And nobody ever came." Then the wind turns, and the voice is gone.'],
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
          note: 'The ogre-mage\'s fort holds the middle pass, and nobody gets past it.',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'red-cleared' }], to: 'redden-done' }, PEAKED] },
        { id: 'gorgonvale', x: 84, y: 78, label: 'The Valley of Statues', mystery: 'Statues that are too good…', icon: 'tok-mystery', scene: 'gorgonvale',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }],
          note: 'The ogre-mage\'s fort holds the middle pass, and nobody gets past it.',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'gorgon-cleared' }], to: 'gorgonvale-done' }, PEAKED_GONE('gorgonvale')] },
        { id: 'steading', x: 88, y: 44, label: 'The Giants\' Hall', mystery: 'Smoke above the tree-line…', icon: 'tok-house', scene: 'steading',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }],
          note: 'The ogre-mage\'s fort holds the middle pass, and nobody gets past it.',
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
      'Burn marks streak the loose rock in three sizes and three colours: green, blue and red. Three separate dragons came this way.',
      'A boulder sits beside the trail with a handprint pressed into it. The hand was wider than a door.',
      'Water has cut fresh channels across the path, though no stream runs anywhere up here.',
      'Under it all runs that steady pull, which draws every beast on the mountain up toward one high place.',
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
      'In your sleep you see a stone door under the fen. Two tall green women stand in front of it with their backs to you. The younger one turns, and her face is wet. "You took our sister from that door," she says. The elder, {nettle}, does not turn. "So we will take the valley from you," she says. "It is only fair."',
      'The singing starts in the dream and goes on after it. It is sweet, and wrong, and getting closer. Harpies come riding the night wind down from the crags. Their song tugs at your legs and puts words in your head. *Stand up. Walk to the edge. It is not far.* You wake in time, because the sentry is shouting.',
    ],
    onWin: { to: '@hub', text: ['The last harpy drops into the dark with its song broken. The fire is scattered and the night is half gone, and nobody will sleep again. You break camp in the dark, no more rested than when you lay down.'] },
  },
  tollcliff: {
    id: 'tollcliff', kind: 'story', art: { emoji: '🦁' },
    again: ['The manticore still lies along its ledge under the overhang. It opens one eye. "Back with my toll?" it purrs. "Good. I was getting hungry."'],
    text: [
      'The trail narrows under an overhang. A **manticore** lies stretched along it like a lord at his dinner table. It has the body of a lion, the wings of a bat, and a tail covered in black spikes. And it has a man\'s face.',
      '"Toll," it says. Its voice is a purr dragged over gravel. "Everything that walks my cliff pays. The goblins paid in sheep. The hags paid in promises." It grins with a man\'s mouth, and the teeth behind it are a lion\'s. "You will pay in meat. I have decided."',
    ],
    next: [
      // Wren's tip: it is greedy, so point it at a bigger meal. One try, and
      // easier with her notes. A miss gives it the first strike.
      { id: 'promise-notes', label: '[Persuasion DC 11] {wren}\'s tip: promise it a bigger meal up at the stone', to: 'tollcliff-talked',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'tollcliff', check: { skill: 'persuasion', dc: 11, failTo: 'tollcliff-stung' } },
      { id: 'promise', label: '[Persuasion DC 14] Tell it the hags at the stone promised it a bigger meal', to: 'tollcliff-talked',
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
      'The manticore\'s human face goes thoughtful. "Promises," it says, tasting the word. Then it stretches, and its spiked tail rattles. "I believe I will go and dine with them." It drops off the ledge and beats away uphill, toward the Calling Stone. Even its goblins, hiding in the rocks below the ledge, run the other way.',
    ],
    next: [{ id: 'ok', label: 'Walk the open trail', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, { kind: 'setFlag', flag: 'manticore-sent' },
        ...tally(), { kind: 'xp', amount: 200 }] }],
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
    intro: ['The manticore listens with its head on one side. "Promises," it says. "The hags gave me promises. I have eaten better." It kept its tail cocked over its shoulder the whole time you talked. It looses a volley of spikes before you can raise a shield, and two goblins scramble up from the rocks behind it.'],
    onWin: { to: 'hills', text: ['The manticore drops onto the trail with one last offended word. "Toll." The pile in the overhang holds ten years of pickings, taken from frightened travellers.'],
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, ...tally(), { kind: 'gold', amount: 110 }] },
  },
  'tollcliff-done': {
    id: 'tollcliff-done', kind: 'story', art: { emoji: '🦁' },
    text: ['The overhang stands empty, and the trail below is free to walk.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  boarruns: {
    id: 'boarruns', kind: 'story', art: { emoji: '🐗' },
    again: ['The drumming starts up under your boots again. The herd is still running its gully twice a day, as mad with the Calling as ever.'],
    text: [
      'A dry gully crosses the trail here. Hooves have churned its floor to mud and left coarse hair all over it. These are the **boar-runs**, and the drumming under your boots says the herd is coming. These are not farm pigs. The hoofprints are as wide as wash-basins.',
      'Something has been driving the herd uphill, day after day. The Calling wants its beasts angry and moving.',
      'You can meet the stampede where the gully narrows and break the herd for good. Or you can watch the dust, and slip across between runs.',
      { if: [{ kind: 'flag', flag: 'wren-brief' }], text: '{wren}\'s notes said the same: watch the dust.' },
    ],
    next: [
      // Timing it: easier with Wren's notes. A miss puts you in the open
      // when the herd comes back, and a pack bursts under it.
      { id: 'time-notes', label: '[Survival DC 11] Time the stampede by {wren}\'s notes', to: 'boarruns-timed',
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
    intro: ['The drumming turns into thunder. Two boars the size of hay-carts come down the narrows shoulder to shoulder. Their tusks are as long as plough blades and their eyes are mad with the Calling. Then you notice that the gully narrows behind you as well.'],
    onWin: { to: 'hills', text: ['The stampede breaks around its fallen leaders. The rest of the herd scatters over the far ridge, away from the valley.'],
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
    text: ['The boar-runs lie still, and grass is growing back over the churned earth. The herd keeps to the far side of the ridge now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  // The den's mouth: a dragonborn can order the wyrmling home in the dragon tongue.
  greenden: {
    id: 'greenden', kind: 'story', art: { emoji: '🐉' },
    again: ['The briar tunnel still stinks of cut grass gone bad. The green wyrmling slides out of the briar again, grinning its small dragon\'s grin, and its kobolds shriek the alarm.'],
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
      'Up the mountain, the Calling\'s note bends. {nettle}\'s voice rides it down the wind, close as a whisper. "One fewer, little debtors. I have marked it down. We have so many more."'],
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
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: ['The den is empty. Scorched scales litter the floor, and claw-marks run up the rock to the open sky. Whatever lived here went up to the stone when the Calling peaked, and it took its hoard in its belly. It will be waiting on the rim.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'tollcliff-flown': {
    id: 'tollcliff-flown', kind: 'story', art: { emoji: '🦁' },
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: ['The overhang is empty. Deep claw-marks run down the cliff toward the valley, and snapped black tail-spikes lie on the trail. The manticore went down at the war-camp on the night of the Calling. Whatever it found there, it has not come back to its ledge.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'boarruns-flown': {
    id: 'boarruns-flown', kind: 'story', art: { emoji: '🐗' },
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: ['The boar-runs are empty. The herd has churned the gully to soup, and every hoofprint points downhill. On the night of the Calling the whole herd went down the slope at the war-camp. The drumming has not come back.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'gorgonvale-flown': {
    id: 'gorgonvale-flown', kind: 'story', art: { emoji: '🗿' },
    assumes: [{ kind: 'flag', flag: 'calling-peaked' }],
    text: ['The statues still stand in their crooked rows, but nothing grazes between them. A trail of grey grass, turned to stone, runs out of the valley and down the slope. On the night of the Calling, the gorgon went down to the war-camp.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'greenden-done': {
    id: 'greenden-done', kind: 'story', art: { emoji: '🌿' },
    text: ['The briar tunnel stands silent, and the sharp green stink has faded to ordinary rot. There is one dragon fewer in these hills.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  seam: {
    id: 'seam', kind: 'story', art: { emoji: '🌊' },
    again: ['The brook still runs uphill into its pool, and the pool still has shoulders. It waits for you, as patient as before.'],
    text: [
      'A mountain brook runs up the pass instead of down it, quickly and steadily, straight against gravity. Where it pools at the top, the pool has a shape. It has shoulders. It waits with a patience that water should not have.',
      'A crack runs down the rock behind the pool, thin as a knife cut, and cold air breathes out of it. Something came through that crack. The road to the middle pass runs right through its pool.',
    ],
    next: [{ id: 'fight', label: 'Break the water', to: 'seam-fight' }],
  },
  'seam-fight': {
    id: 'seam-fight', kind: 'battle', encounterId: 'water-vortex', mapId: 'bog',
    intro: ['The pool stands up. Twelve feet of mountain water in the rough shape of a giant, cold as the crack it came through. The **water elemental** does not roar. It simply pours itself at you, and it hits like the flood it actually is.'],
    onWin: { to: 'hills', text: ['The elemental collapses all at once into a hundred gallons of ordinary water, which runs away downhill. The crack in the rock behind it closes. The pass is open.',
      'Just before it shuts, you hear something through the crack, far away and deep under the ground. It is a slow drip, like water on a stone door far under the fen.'],
      effects: [{ kind: 'setFlag', flag: 'seam-cleared' }, ...tally(), { kind: 'gold', amount: 50 }] },
  },
  'seam-done': {
    id: 'seam-done', kind: 'story', art: { emoji: '💧' },
    text: ['The brook runs downhill now, chattering over the stones with no shape in it at all. The crack it came through stays shut.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  blueden: {
    id: 'blueden', kind: 'battle', encounterId: 'blue-dragon-den', mapId: 'ruins',
    intro: [
      'The mesa smells like a storm about to break. A **blue wyrmling** has taken the ruined watchtower at its top, and its kobolds have been busy. They have lashed copper rods to every standing wall to catch the lightning, and the rods hum.',
      'The wyrmling uncoils along a broken wall, crackling, and the air turns sharp and metallic.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling falls off the wall trailing dead sparks, and the copper rods go cold. The hoard here was tribute, saved up for a dragon\'s future. It rides out in your packs instead.'],
      effects: [{ kind: 'setFlag', flag: 'blue-cleared' }, ...tally(DEN_TICKS), { kind: 'gold', amount: 95 }] },
  },
  'blueden-done': {
    id: 'blueden-done', kind: 'story', art: { emoji: '⚡' },
    text: ['The ruin on the mesa stands empty, and its copper rods are turning green. The storms overhead are only weather now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  onihold: {
    id: 'onihold', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    again: ['The ogre-mage still stands above the gate of its fort. "Back again," it calls down, pleasantly. "The toll is still one hundred and fifty gold. Or try us. We are still bored."'],
    text: [
      'Someone holds the middle pass, and holds it the way a soldier would. A stone fort stands across it, rebuilt in a week by hands that lift boulders like loaves of bread. Guard posts of sharpened pine ring its walls, and a horn hangs by the gate. It has sounded once today.',
      'The holder stands above the gate: an **ogre-mage**, blue-skinned, wearing scraps of old lacquered armour. It looks you over slowly, from boots to blades, and does its sums. Everything else in these hills came at you hungry. This one has stopped to think.',
      { if: [has('calling-peaked')],
        text: 'Its orcs went down at the war-camp on the night of the Calling, and the ones who came back wear bandages. The ogre-mage stayed behind to hold the pass. Whatever the stone promised it, it means to collect.' },
      '"The stone sings," it calls down, pleasantly. "We answered first, and whoever answers first holds the pass. Pay a toll of one hundred and fifty gold, and we will find another war. Or try us. We have not had a proper fight all week."',
    ],
    next: [
      { id: 'pay', label: 'Pay the toll (150 gold)', to: 'onihold-paid',
        requires: [{ kind: 'gold', atLeast: 150 }],
        effects: [{ kind: 'gold', amount: -150 }, { kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'setFlag', flag: 'oni-paid' }, ...tally()] },
      // Wren's tip: set the two warbands on each other. One try, and easier
      // with her notes. A lie it sees through drives the party off the pass.
      { id: 'trick-notes', label: '[Deception DC 12] {wren}\'s tip: warn it the ettin is coming for the pass', to: 'onihold-tricked',
        requires: [{ kind: 'flag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'oni', check: { skill: 'deception', dc: 12, failTo: 'onihold-driven' } },
      { id: 'trick', label: '[Deception DC 15] Warn it the ettin is coming for the pass', to: 'onihold-tricked',
        requires: [{ kind: 'notFlag', flag: 'wren-brief' }], hideWhenBlocked: true,
        attempt: 'oni', check: { skill: 'deception', dc: 15, failTo: 'onihold-driven' } },
      { id: 'fight', label: 'Try them', to: 'onihold-fight' },
    ],
  },
  // Lied to: the ogre-mage marches on the giants' hall (see `steading-raided`).
  'onihold-tricked': {
    id: 'onihold-tricked', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: [
      '"Keep your toll," you call up. "The ettin up the hill says it answered the stone first. It\'s coming down for your pass tonight. We only came to watch."',
      'The ogre-mage\'s pleasant face goes very still. "Two heads," it says, "and not one honest thought between them." It blows the horn four times. Within the hour its whole warband is marching uphill toward the giants\' hall. The gate behind them stands open.',
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
    text: ['The ogre-mage weighs the purse in one blue hand and smiles. "Gold, and not one of my soldiers scratched. The best kind of war." It blows the horn three times. By noon its warband is marching down the far side of the mountain, away from the valley. The middle pass is open.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'onihold-fight': {
    id: 'onihold-fight', kind: 'battle', encounterId: 'oni', mapId: 'corridor',
    intro: ['The horn sounds twice, and the gate opens on the ogre-mage\'s guard. An ogre in an iron collar marches out with its maul on its shoulder, like a drilled soldier. A scarred old orc in stolen mail calls the step. Then the ogre-mage itself rises off the wall on a cold wind with its blade drawn. The air darkens around it like ink spreading through water.'],
    onWin: { to: 'hills', text: ['The ogre-mage falls out of its own darkness, astonished right to the end. Its drilled guard lies dead at the gate. The middle pass stands open, and beyond it lies the road to the giants\' hall and the stone. The fort\'s war-chest is yours.'],
      effects: [{ kind: 'setFlag', flag: 'oni-cleared' }, ...tally(), { kind: 'gold', amount: 130 }] },
  },
  'onihold-done': {
    id: 'onihold-done', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The fort at the middle pass stands empty, its horn silent on the wall. {wren}\'s scouts have been through. They have chalked a small arrowhead by the gate, pointing up.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  redden: {
    id: 'redden', kind: 'battle', encounterId: 'red-dragon-den', mapId: 'firepit',
    intro: [
      'You smell the den before you see it: woodsmoke with a hot, metal edge to it. It sits in a scorched bowl of hillside where a **red wyrmling** has built itself a forge-hall out of split rock and cinders. Kobolds tend heaps of half-melted treasure with the care of jewellers.',
      'The wyrmling lies on the largest heap with one eye open. Red dragons are the proudest of a proud family, and the stone\'s song promised this one a war. It rises, burning with its own light.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling\'s fire goes out from the inside, and it is finally, simply small. Its half-melted hoard cools into heavy lumps. They are the honest kind, and {bram} will weigh them twice and pay well.',
      'The stone\'s song dips, and {nettle}\'s voice comes down the wind with it. "That one was promised a war," she says, like a clerk striking out a line. "Never mind. Promises are cheap, and we have plenty left."'],
      effects: [{ kind: 'setFlag', flag: 'red-cleared' }, ...tally(DEN_TICKS), { kind: 'gold', amount: 120 }] },
  },
  'redden-done': {
    id: 'redden-done', kind: 'story', art: { emoji: '🔥' },
    text: ['The burning den has gone cold. Rain has found the scorched bowl, and green shoots are coming up through the ash.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  gorgonvale: {
    id: 'gorgonvale', kind: 'story', art: { emoji: '🗿' },
    again: ['The gorgon still grazes at the head of the valley of statues, its head down. Steam curls from its iron nostrils. It is not looking your way.'],
    text: [
      'The statues in this valley are far too good. One is a shepherd caught mid-stride, with one arm flung up. One is a wolf turning to run. One is a hired sword with his blade half drawn, and a look on his face you can read from thirty paces. No sculptor ever worked this fast.',
      'At the head of the valley stands a bull made of black iron plates, grazing between its own victims. This is a **gorgon**. Its breath turns living things to stone, and steam curls from its nostrils in the cold air. The Calling drew it down from somewhere higher and worse.',
      'It has not noticed you yet.',
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
      { id: 'creep-notes', label: 'Creep in along {wren}\'s line', hint: '{wren}\'s tip: go in quietly, and take only the purses at their feet.',
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
    text: ['The statues stand silent in their crooked rows. Nothing grazes between them now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  // The hall: talk the two heads into a fight with each other (easier with
  // Wren's notes; one try either way), or draw steel.
  steading: {
    id: 'steading', kind: 'story', art: { emoji: '🏚️' },
    text: [...STEADING_INTRO,
      { if: [{ kind: 'flag', flag: 'wren-brief' }], text: '{wren}\'s notes said it: the two heads never agree. Agree with both of them.' }],
    again: ['The ettin is back in the yard of its hall, both heads still arguing about the valley. They stop when they see you, and for once they agree.'],
    next: [
      { id: 'agree-notes', label: '[Deception DC 11] {wren}\'s tip: agree with both heads at once', to: 'steading-talked',
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
    next: [{ id: 'ok', label: 'Onward', to: 'hills', effects: STEADING_TALKED }],
  },
  // The talk spent and failed: the ettin's two heads have heard enough.
  'steading-balked': {
    id: 'steading-balked', kind: 'story', noBack: true, art: { emoji: '🏚️' },
    text: ['You tell the left head the valley is its own. The right head hears you say it, and it does not like it one bit.'],
    next: [{ id: 'fight', label: 'Draw steel', to: 'steading-roused' }],
  },
  'steading-roused': {
    id: 'steading-roused', kind: 'battle', encounterId: 'giants', mapId: 'ruins',
    intro: ['The ettin lifts both its clubs. For once both heads want the same thing, and the thing is you. The ogre spits out its breakfast, and the orc runner ducks behind them both.'],
    onWin: STEADING_WON,
  },
  // The ogre-mage took the bait: its warband hit the hall first, and the
  // company arrives at the end of that fight. The
  // same roster still stands (a lighter one would need its own encounter), but
  // it is beaten up and quarrelling, so the parley comes cheaper.
  'steading-raided': {
    id: 'steading-raided', kind: 'battle', encounterId: 'giants-raided', mapId: 'ruins',
    intro: [
      'Above the tree-line stands the giants\' hall, and you arrive at the end of its fight. Fire is eating half the roof. Dead orcs from the ogre-mage\'s warband lie in the yard, and the ettin\'s ogre lies among them. Of the ogre-mage itself there is only a trail of blue blood, leading down the far side of the mountain.',
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
    text: ['The giants\' hall stands hollow, its doorway a bright rectangle of sky. {vex} will want it for a forward post. {wren}\'s scouts have claimed the roof.'],
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
      'Before you start down, horns sound behind you. {vex} has marched the forward column up through the passes you cleared, and his pikes spread out along the rim to hold it.',
      'Behind the pikes come people from the valley who have not forgotten you. They are out of breath and mud to the knees, and not one of them has climbed this mountain to stand at the back.',
      // One line for each debt that holds (see OWED); text only, so free.
      { assumes: [{ kind: 'noCompanion', companion: 'wren' }], text: '{wren} is first up the last slope, bow on her back and map under her arm.' },
      { if: [has('sunken-barrows:halden-saved')], text: 'Brother {halden} climbs with his prayer book under his arm, red in the face and still praying.' },
      { if: [has('hollow-road:vex-turned')], text: '{hask}, the chief\'s old guard who stood aside for you in {vargan}\'s hall, walks at {vex}\'s shoulder.' },
      { if: [has('sunken-barrows:drowned-gold-home')], text: 'Two fen-folk carry coils of rope over their shoulders. They are kin to the drowned whose purses you carried home.' },
      '"We hold the ridge. You go down," {vex} says. "That was the whole plan, until this lot followed you up." He jerks a thumb at them. "Take what they brought. Take one of them down with you, or two, or none. Two at most. A big party\'s a loud one."',
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
      'Down in the bowl, at the foot of the stone, the **sisters** are waiting. **{nettle}**, the elder, is the hag who met you at the war-camp. **{sedge}** is the younger. They have pushed their green fingers to the knuckle into the black rock. Old letters ring its base, filled with lead like the letters on the Warden\'s door under the fen.',
      // The harpies' night opens on a dream of the sisters.
      { if: [{ kind: 'flag', flag: 'manticore-sent' }],
        text: 'On a ledge above the bowl crouches the manticore from the toll-cliff. It came up here to collect its meal from the hags. It watches the sisters with its man\'s face, and licks its lips, and waits to see who wins.' },
      { if: [{ kind: 'visited', scene: 'hills-night' }],
        text: 'You know {sedge}\'s face. You saw it once already, in a dream on the mountain. She turned toward you then, and her face was wet.' },
      'They are pouring their own lives into the stone to keep it singing, and their faces are burning down like candles. "Sister-killers," {nettle} says, without turning around. "Our sister kept the door under the fen since before your Thornwick had a name. One lamb at the water\'s edge each midwinter, and the Warden slept. That was the price, and it was paid. You cut her down in the chief\'s hall, and you left that door to a priest\'s book."',
      '{sedge} does not turn either. Her voice is raw. It is the voice you heard on the wind at the foot of the high trail. "She kept it alone, in the dark, for an age. Nobody ever thanked her. You never even knew her name." {nettle} goes on as if her sister had not spoken. "So we did what she did. She bought a reed-cutter with a valley. We bought these hills with the same coin, one promise at a time."',
      'The light around the stone thickens, and the ground beneath it begins, gently, to burn. "But you came so far," {nettle} says. "Stay. The last of the collection is arriving now. Out of the fire, and out of the ground."',
    ],
    // The level floor lands before the hardest fight, not after it: every
    // answer carries it (see REPLIES).
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
      '{nettle} laughs, a sound like wind in dry reeds. "She grew greedy at the end. We do not deny it. But for a thousand winters she kept that door, and the dead never once walked. Set that against your carters."',
      { if: [{ kind: 'flag', flag: 'hollow-road:captives-freed' }],
        text: '"We took her pen apart ourselves," you tell her. "Everyone in it walked home." {nettle}\'s lip curls. "Very brave. And the next season, the dead walked out of their graves."' },
      '{sedge} does not laugh. "Ask your barrows what her death bought you," she says, very quietly. Their hands sink deeper into the stone. {nettle}\'s song climbs, louder and angrier than before, and the burning ground creeps toward your boots.',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '"She took people off the marsh road," {wren} says under her breath, her bow drawn. "I wrote their names down for the reeve. I can still say every one."' },
    ],
    next: stoneChoices('tear-loose-defiant'), noBack: true,
  },
  'answer-rueful': {
    id: 'answer-rueful', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['For one breath, the song falters. {sedge} turns her burning face toward you. "Sorry," she says slowly, as if nobody has ever said the word to her before. "Sorry does not put the dead back to sleep. It does not bring her back. But I heard it." {nettle} hisses at her. "{sedge}. Hold still. Sorry pays nothing." {sedge} turns back to the stone.',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} lets her bowstring ease a finger\'s width. "That\'s the first time anyone\'s said it," she murmurs. "Somebody should have."' }],
    // The one reply that opens a door: ask Sedge to take up her dead sister's
    // vigil. Success ends the Calling without the last fight; a miss leaves
    // the stone to be faced the usual way. One try.
    next: [
      { id: 'vigil', label: '[Persuasion DC 15] Ask {sedge} to keep the vigil her sister kept', to: 'vigil-kept',
        once: true, hideWhenBlocked: true,
        requires: [{ kind: 'notFlag', flag: 'sisters-loose' }, { kind: 'notFlag', flag: 'stone-spent' }],
        check: { skill: 'persuasion', dc: 15, failTo: 'vigil-refused' } },
      ...TO_STONE,
    ],
    noBack: true,
  },
  'answer-cold': {
    id: 'answer-cold', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: [
      'You say nothing. The ring of your blade leaving its sheath is your whole answer.',
      '{sedge} flinches, and for the first time she looks a little afraid. Her hands slip a finger\'s width out of the rock before she pushes them back in. {nettle} only nods. "Then come and pull us out," she says. "If you can."',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: 'Beside you, {wren} draws an arrow to her cheek. Her hands are shaking. She steadies them on purpose, one finger at a time.' },
    ],
    next: stoneChoices('tear-loose-cold'), noBack: true,
  },
  // One `tear-loose` per answer's mood, sound and cracked (see tearLoose).
  ...Object.fromEntries((['', 'defiant', 'cold'] as const).flatMap((mood) => {
    const id = mood ? `tear-loose-${mood}` : 'tear-loose';
    return [
      [id, tearLoose(id, [TEAR_OPEN, TEAR_STAKES], 'sisters-battle', 'calling-battle', mood || undefined)],
      [id + CRACK, tearLoose(id + CRACK, [TEAR_OPEN, ...TEAR_CRACKED, TEAR_STAKES], 'sisters-battle' + CRACK, 'calling-battle' + CRACK, mood || undefined)],
    ];
  })),
  // Torn loose: the sisters fall fighting, beside the one elemental the stone
  // still had the strength to raise.
  'sisters-battle': {
    id: 'sisters-battle', kind: 'battle', encounterId: 'sisters-at-stone', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The sisters come at you with green claws and burning faces. "Then we collect by hand," {nettle} says. {sedge} says nothing. She is weeping, and she comes at you all the same. Behind them, the crack in the floor gives up the last thing the stone has the strength to raise. A pillar of living fire climbs out and turns toward you. This time the sisters have to fight for themselves.'],
    onWin: { to: 'calling-won', text: ['{nettle} falls first, clawing at your boots, still telling you what you owe. {sedge} falls calling her dead sister\'s name, and then cursing yours. Both of them crumble into drifts of dry reeds, and the fire gutters out of the air. The black fang has nobody left to spend, so it cracks from top to bottom and falls silent. The Calling ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  // The same fights with the Warden's dead at your ankles (see CRACKED): the
  // company starts a round behind.
  'sisters-battle-cracked': {
    id: 'sisters-battle-cracked', kind: 'battle', encounterId: 'sisters-at-stone', mapId: 'firepit',
    loot: { bonusTier: 'rare' }, surprise: 'party',
    intro: ['The sisters come at you with green claws and burning faces. Grey hands still hold your ankles, and you are still kicking free when the sisters reach you. "Then we collect by hand," {nettle} says. {sedge} is weeping, and she comes at you all the same. Behind them, a pillar of living fire climbs out of the crack and turns toward you.'],
    onWin: { to: 'calling-won', text: ['{nettle} falls first, clawing at your boots, still telling you what you owe. {sedge} falls calling her dead sister\'s name, and then cursing yours. Both of them crumble into drifts of dry reeds, and the fire gutters out of the air. The black fang has nobody left to spend, so it cracks from top to bottom and falls silent. The Calling ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  // Sedge said yes: she drags her sister out of the stone and takes her down
  // to the fen, to keep the Warden's door. The Calling dies with nobody
  // feeding it. No last fight, and no hoard either.
  'vigil-kept': {
    id: 'vigil-kept', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🚪' },
    text: [
      '"The door under the fen still needs a keeper," you tell her. "We broke the vigil, and a priest\'s book is a poor jailer. Your sister kept that door through more winters than anyone can count. Keep it for her."',
      '{sedge} looks down at her own hands, sunk to the wrist in the stone. Then she pulls them out. The stone screams. {nettle} screams with it, and {sedge} takes her sister by both wrists and drags her free.',
      'With nobody feeding it, the Calling falters. The black fang cracks from top to bottom and goes quiet. The fire in the floor of the bowl sinks back into the rock.',
      '"We will keep the door," {sedge} says. "She kept it alone for an age. I will not let that go to waste. And we will take one lamb at midwinter and no more, as our sister did before she grew greedy. Do not come into the deep fen again." {nettle} says nothing. She only looks at you, the way you look at a debt you mean to collect.',
    ],
    next: walkDown(0, 'vigil-down-with', 'vigil-aftermath', 'Watch them walk down the mountain toward the fen',
      [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'setFlag', flag: 'vigil-kept' }, { kind: 'xp', amount: 1200 }]),
  },
  ...walkDownScenes('vigil-down-with', 'vigil-aftermath'),
  'vigil-refused': {
    id: 'vigil-refused', kind: 'story', noBack: true, art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['{sedge} listens to the end. Then she shakes her head, slowly. "She starved in the dark for an age so that you could sleep soundly, and you killed her for it. Now you want me to do the same? No." {nettle} hisses at her to hold still. "I told you. Sorry pays nothing." The stone drinks deeper, and the burning ground creeps toward your boots.'],
    next: TO_STONE,
  },
  'vigil-aftermath': {
    id: 'vigil-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      'Up on the rim, {vex}\'s pikes opened their line for two tall green shapes, and nobody said a word. The column came down the mountain a long way behind the sisters, and you came down with it. The camp watched the sisters walk past its lines in the dusk, and it has not decided yet whether to cheer.',
      '{vex} decides for it. "The Calling\'s broken," he says, loud enough to carry. Then, quieter: "Hags in the fen again. I watched them walk through my own line." You tell him they\'re keepers now. He looks at you for a long moment. "Then I hope they keep," he says.',
      { if: [{ kind: 'noCompanion', companion: 'wren' }],
        text: '**{wren}** stood on the rim with an arrow on the string while the two hags walked through the line. She kept it there all the way down the mountain. At the camp gate she puts the arrow back in her quiver and sits down hard, laughing.' },
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} goes straight to the scouts\' fire. Her riders crowd round her, and she tells them about the hags in the fen before anyone can ask. Then she sits down hard, and laughs until she has to wipe her eyes.' },
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
    intro: ['The sisters pour the last of themselves into the stone, and the stone spends it all at once. The floor of the bowl splits along a burning crack. A pillar of living fire climbs out of it, and the mountain\'s own bones heave up beside it into a shape with fists. The sisters sink into the rock to the shoulder, and they do not let go. "Take it all," {nettle} tells the stone. "Every drop we owe." {sedge} only whispers her dead sister\'s name. The Calling rises to one last note, and everything it raised turns toward you.'],
    onWin: { to: 'calling-won', text: ['The sisters crumble into drifts of dry reeds. {nettle} goes smiling. {sedge} goes with her sister\'s name still on her lips. The fire gutters out of the air, and the stone shape shakes itself apart into loose rubble. The black fang has nothing left to spend and nobody left to spend it, so it cracks from top to bottom and falls silent. The Calling does not end with thunder. It ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  'calling-battle-cracked': {
    id: 'calling-battle-cracked', kind: 'battle', encounterId: 'elemental-cataclysm', mapId: 'firepit',
    loot: { bonusTier: 'rare' }, surprise: 'party',
    intro: ['The sisters pour the last of themselves into the stone, and the stone spends it all at once. A pillar of living fire climbs out of the burning crack. The mountain\'s own bones heave up beside it into a shape with fists. Grey hands hold your ankles fast while they come. "Take it all," {nettle} tells the stone. "Every drop we owe." The Calling rises to one last note, and everything it raised turns toward you.'],
    onWin: { to: 'calling-won', text: ['The sisters crumble into drifts of dry reeds. {nettle} goes smiling. {sedge} goes with her sister\'s name still on her lips. The fire gutters out of the air, and the stone shape shakes itself apart into loose rubble. The black fang has nothing left to spend and nobody left to spend it, so it cracks from top to bottom and falls silent. The Calling does not end with thunder. It ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  'calling-won': {
    id: 'calling-won', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌅' },
    text: [
      { if: [{ kind: 'notFlag', flag: CRACKED }],
        text: 'It is over. The **Calling Stone** lies cracked and silent, and the sisters are gone with it. Where they fell, a scatter of dry reeds lifts on the wind.' },
      { if: [{ kind: 'flag', flag: CRACKED }],
        text: 'It is over. The **Calling Stone** lies cracked and silent, and the sisters are gone with it. The grey hands at its foot go limp and sink back down through the cracks, toward the fen. Where the sisters fell, a scatter of dry reeds lifts on the wind.' },
      { if: [{ kind: 'flag', flag: 'stone-spent' }], text: 'They climbed all this way for revenge, and the stone burned them up instead. Your company has the mountain to itself.' },
      { if: [{ kind: 'notFlag', flag: 'stone-spent' }], text: 'They climbed all this way for revenge, and in the end they had to fight for it with their own hands. Your company has the mountain to itself.' },
      'Below you, pass by pass, the hills go quiet. The song that pulled monsters toward the valley has stopped. Whatever was still walking down the slope stops, shakes its head, and turns back toward its own hills. The wingbeats fade off the wind.',
      'The valley is safe. Up on the rim, {vex}\'s pikes raise a ragged cheer. Far down the slope, faint and disbelieving, the war-camp takes it up.',
    ],
    next: walkDown(0, 'down-with', 'wc-aftermath', 'Come down the mountain'),
  },
  ...walkDownScenes('down-with', 'wc-aftermath'),
  'wc-aftermath': {
    id: 'wc-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      '{vex}\'s column was waiting on the rim when you climbed out of the bowl, and it came down the mountain with you. You come down on your own feet. You walk into a camp that has stopped being an army and started being the biggest festival the valley has ever thrown.',
      'At the camp gate {vex} shakes your hand like a man who has just found an exit he never expected. "The Calling\'s broken," he says. "Tomorrow this camp packs up and everybody goes home. Do stop now, before your luck notices you."',
      { if: [{ kind: 'noCompanion', companion: 'wren' }],
        text: '**{wren}** came down off the rim at the head of the column, marking every pass on her map. At the camp gate she looks at your company, then up at the hills, and grins her whole age for once. Then she remembers herself, coughs, and goes back to giving orders.' },
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} hands {vex} her route report before she has even sat down. Then she looks back up at the hills and grins her whole age for once. She remembers herself, coughs, and goes off to give orders.' },
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
      'You wake in the hospital tent to canvas light and the smell of stew from {bram}\'s war-stores. The scouts carried you off the mountain in relays, and you have slept a whole day away.',
      { assumes: [{ kind: 'flag', flag: 'briefed' }], text: '{vex} looks in, sees that you are breathing, and sets your kit at the foot of the cot without a word. The hills are still up there. The stone is still calling. It is only waiting.' },
    ],
    // A wipe costs time: a day lost on the cot.
    next: [{ id: 'up', label: 'Back on your feet', to: 'warcamp', effects: [{ kind: 'passDay' }] }], noBack: true,
  },
  // The ending after the last fight: its text holds for every company, and
  // the slides read the run back. Each slide stands alone, so any mix of them reads in order.
  'wc-epilogue': {
    id: 'wc-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'The valley remembers it as the year of three wars: the raiders, the graves, and the hills. The songs about the last one all end on the same mountain, with your company standing on it. The Calling is silent now, and the coven burned away to reeds on a mountain wind.',
      MIRA_TOAST,
      REEVE_PLAQUE,
      '{vex} finds you at the edge of the firelight. "May this valley never need me again," he says, and he means it kindly.',
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
        text: 'At the broken stone, {halden} said the rites for the sisters too. Nobody else would have.' },
      { if: [{ kind: 'flag', flag: 'fen-ropes' }],
        text: 'The fen-folk carry their drowning-ropes home from the mountain and hang them over the widow\'s door at the edge of the fen. Everyone who walks past asks about them.' },
      { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the Undercrypt\'s door still holds, though on still nights the fen-folk swear they hear something knock.' },
      // A clean seal (a cold start sealed the barrows too).
      { if: [{ kind: 'notFlag', flag: 'sunken-barrows:seal-cracked' }],
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
      REEVE_PLAQUE,
      '{vex} finds you at the edge of the firelight. He looks off toward the fen. "Here\'s to whoever is keeping that door tonight," he says.',
    ],
    slides: [
      ...SLIDES_HILLS,
      { if: [],
        text: 'Some nights you still think about {sedge}, down in the dark of the fen, keeping a door for a valley that will never thank her.' },
      ...SLIDES_PEOPLE,
      { if: [{ kind: 'companion', companion: 'halden' }],
        text: '{halden} walks down to the edge of the deep fen each spring and reads the rites aloud. Something out in the reeds always waits until he has finished.' },
      { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the knocking at the Undercrypt\'s door stops for good. The fen-folk leave a lamb at the water\'s edge each midwinter again, the way their grandparents did.' },
      { if: [{ kind: 'notFlag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the Undercrypt\'s door stays shut. Two shapes keep watch over it now, and the fen-folk know better than to ask their names.' },
    ],
  },
};

export const WYRMCALLING_MODULE: Module = withNpcs({
  id: 'wyrmcalling', title: 'The Wyrmcalling',
  blurb: 'The {reedwife}\'s sisters wake the Calling Stone, and the hills answer with wyrms, giants, and worse. Climb the passes, thin what answers, and silence the stone.',
  cover: 'loc-mountain',
  levelBand: { from: 4, to: 5 },
  start: 'muster', scenes, defeatScene: 'wc-defeat', town: 'warcamp',
  // The clock: the Calling peaks on the sixth morning. Any dragon den still
  // standing then empties, and its wyrmlings go up to the rim (den-flown).
  dawns: [
    // Worded to hold wherever the party wakes: the camp, the hills, or with
    // Wren at its side.
    { day: 3, text: ['The stone\'s note is louder this morning.',
      { if: [{ kind: 'noCompanion', companion: 'wren' }],
        text: 'A rider from the scouts\' fire brings {wren}\'s word at first light. Three more nights before the Calling peaks, she reckons, and not one more.' },
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} counts on her fingers, frowning up at the passes. "Three more nights before it peaks," she says. "Not one more."' }] },
    { day: 5, text: ['The streams on the mountain ran uphill all night, loud enough to hear from the valley floor. A runner from the command tent brings {vex}\'s word: he has doubled the watch. "Tonight," the message says. "Whatever\'s still in those dens will fly."'] },
    { day: 6, text: ['The Calling peaked in the night. The whole mountain hummed with it, and horns sounded from the war-camp until dawn. Anything still nesting in the hills has gone up to the ridge.'],
      // The night is judged as it stood this morning (see PEAK_TALLY).
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
}, NPCS);
