/**
 * "The Hollow Road" — the campaign module: an original, SRD-safe ~2-hour
 * adventure in three acts (village hub → wilderness trail → raider hideout →
 * boss), the deliverable that proves the whole adventure system end to end.
 *
 * Design targets from docs/adventure-mode-plan.md: ~25 scenes, 3 explore maps,
 * combat never more than 3–4 scenes away, two avoidable fights, skill variety
 * across the 18-skill list, and an epilogue that reads flags back so choices
 * visibly mattered. No new stat blocks — every encounter is composed from the
 * existing bestiary. All content is original; no published module text is reproduced.
 *
 * LEVEL BAND 1→3: fights carry the leveling, with no milestone floors
 * (docs/module-writing-guide.md, "Levels come from fights"). Every way past a
 * fight pays what the fight would have (`avoidedFightXP`): the spy's crew
 * shouted down or caught, the den's gate slipped, Vex turned so that Hask
 * stands aside from the chief's guard; staring down the road-out goblins carries the 2nd level a
 * company that has done the town would reach by fighting them. A company
 * that fights its road reaches 2nd on the marsh road and 3rd by the chief's
 * hall; one that walks past the side fights (the mill, the barrow, the
 * thicket) meets the chief at 2nd, by its own choice.
 *
 * MONSTER VARIETY is a goal in itself — this module is a tour of the bestiary,
 * a distinct roster per fight (goblins, human crooks, the marsh's toads and
 * risen dead, a hag-thrall lizardfolk war-party, a bugbear/gnoll gate, a chained
 * ogre pit-brute, kenneled hyenas, and a green-hag-and-warlord finale) across a
 * spread of maps (road, village square, bog ford, ruins, corridor, fire-pit). The connective story explains
 * *why* beasts, undead and lizardfolk fight for "bandits": chief Vargan, a
 * Thornwick-born reed-cutter, sold the reed-cutters' common marsh to the
 * Reedwife, a green hag, for coin and monsters. She branded him like the rest.
 */
import type { Module, Scene, Effect, Choice, Para, Requirement } from '../../adventure/types.js';
import { withCanon, speaker, companionsFrom, npcMetFlag, npcFateFlag } from '../../adventure/npcs.js';
import { TRILOGY_NPCS as NPCS } from './npcs.js';
import { TRILOGY_FACTS, factValue } from './canon.js';
import { avoidedFightXP } from '../encounters.js';

/** Learning whose the marsh-things are: the Reedwife reveal. */
const HAG_LEARNED: Effect[] = [
  { kind: 'setFlag', flag: 'know-hag' },
  { kind: 'journal', entry: { id: 'c-hag', kind: 'clue', title: 'The {reedwife}',
    body: 'A green hag the reed-cutters call the "{reedwife}" owns the marsh-creatures that serve the {ashfang}, and brands them like cattle. She waits at the den\'s fire beside the {ashfang} chief. She told you to ask him what he sold her.' } },
];

/** Past the den's gate without a fight (the signal, the wall, the water-gate,
 *  or a bluff): what beating its enforcers would have earned. */
const GATE_PASSED: Effect[] = [{ kind: 'xp', amount: avoidedFightXP('den-gate') }, { kind: 'setFlag', flag: 'signal-spent' }];

/** Past the gate by any road: the gate-signal lead is done with, used or not. */
const SIGNAL_SPENT: Effect = { kind: 'setFlag', flag: 'signal-spent' };

/** The pens, as a lead: Vex points the way, but only while the pen is still
 *  an open question (`pens-settled` unset). Looking in it, the dark moon, or
 *  the hag's death (no way back into the den after it) settles it. */
const PENS_LEAD: Effect = { kind: 'journal', entry: { id: 'lead-pens', kind: 'lead', resolvedBy: 'pens-settled',
  title: 'The Pens Behind the Kennels',
  body: 'Behind the kennels in the {ashfang} den is a pen where the chief keeps captives for the {reedwife}. She comes for them when the moon goes dark. Look in it.' } };

/** Past the hollow: the reveal, and the wet way in (`trail-wet`) no longer
 *  matters, so the den is not searched twice over for it. */
const HOLLOW_PASSED: Effect[] = [...HAG_LEARNED, { kind: 'clearFlag', flag: 'trail-wet' }];

/** What bringing Wren round buys, whether she goes home or comes along. */
const WREN_SAVED: Effect[] = [
  { kind: 'npc', npc: 'wren', met: true, fate: 'saved' }, { kind: 'setFlag', flag: 'know-vex' },
  { kind: 'journal', entry: { id: 'npc-wren', kind: 'npc', title: '{wren}, the Scout', body: 'You pulled a reeve\'s scout, {wren}, out from under a dead horse on the marsh road. She mapped the den for you.' } },
  { kind: 'journal', entry: { id: 'lead-vex', kind: 'lead', resolvedBy: npcMetFlag('vex'),
    title: '{vex}, the Lieutenant', body: '{wren} named {vex}, the {ashfang} chief\'s resentful lieutenant. Seek out his fire inside the den — he may turn on the chief if offered a way out.' } },
];

/** Wren's word on Vex, once she can talk: a name to look for, or (for a
 *  party that has already been inside the den) a man they have met. */
const WREN_ON_VEX: Para[] = [
  { if: [{ kind: 'npc', npc: 'vex', met: false }],
    text: '"You got the horse off me. Let me pay some of that back." She catches your wrist. "There\'s a man in there hates the chief worse than you do — **{vex}**, the lieutenant. Offer him a way out when you reach his fire, and he might stand his guards aside instead of setting them at your throat."' },
  { if: [{ kind: 'npc', npc: 'vex', met: true }],
    text: '"You got the horse off me. Let me pay some of that back." She looks at the den-mud on your boots. "You\'ve been inside already, so you\'ve met {vex} at his fire. He hates the chief worse than you do. Whatever you said to him, he\'ll remember it when the chief calls for his guards."' },
];

/** The chief and the hag go down together, in every version of the hall. He
 *  is beaten, not dead: what becomes of him is the company's call
 *  (`vargan-beaten`), and finishing him there is an execution (`executed`),
 *  as it is for a chief who turned on her. The hag's death also closes the
 *  pens lead: there is no going back into the den after it. */
const BOSS_FALLS = 'The chief falls across the fire-pit, and the **{reedwife}** screams. As the scream goes on she slumps into river-weed and black water, and the earth floor drinks her down. Up in the rafters, the trophies of a hundred raids stop swinging.';
const BOSS_WON: Effect[] = [
  { kind: 'npc', npc: 'reedwife', fate: 'dead' }, { kind: 'gold', amount: 100 }, { kind: 'setFlag', flag: 'pens-settled' },
];

/** Naming Vargan's brand: the moment before he chooses a side. */
const VARGAN_BRAND = [
  'The rag on his axe hand has slipped. Burned into the skin beneath is a mark of reeds and a reaching hand, the same brand the lizardfolk wore in the hollow.',
  '"She owns you too, {vargan}," you say. He stares down at his own hand as if it belongs to someone else. Behind him the hag has stopped smiling.',
];
/** Talked round: he turns on her, and she burns him down with her own mark
 *  (named already, or shown to the company only now). */
const VARGAN_TURNS: Para[] = [
  { if: [{ kind: 'flag', flag: 'vargan-shaken' }],
    text: '{vargan} looks from the brand to the hag, and turns, and swings his axe at her two-handed. She catches the blade in a fist of river-weed. "My mother\'s house," he says through his teeth. The hag closes her fingers, and the brand on his hand burns white. He drops to the floor, screaming.' },
  { if: [{ kind: 'notFlag', flag: 'vargan-shaken' }],
    text: '{vargan} looks at the hag without a word, and turns, and swings his axe at her two-handed. She catches the blade in a fist of river-weed. "My mother\'s house," he says through his teeth. The hag closes her fingers. Through the rag on his axe hand a brand burns white, a mark of reeds and a reaching hand, and he drops to the floor, screaming.' },
];
/** The talk, before or after the read. One try (`attempt: 'turn'`). */
const TURN_UNREAD_LABEL = '[Persuasion DC 14] "She drowned your mother\'s house. Help us end her."';
const TURN_READ_LABEL = '[Persuasion DC 10] "She owns you too. Help us end her."';
/** The harder talk, split on Vex's bargain; `also` narrows it further. */
const turnUnread = (also: Requirement[]): Choice[] => [
  { id: 'turn', label: TURN_UNREAD_LABEL, to: 'vargan-turns', attempt: 'turn',
    requires: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }, ...also], hideWhenBlocked: true,
    check: { skill: 'persuasion', dc: 14, failTo: 'boss' } },
  { id: 'turn-alone', label: TURN_UNREAD_LABEL, to: 'vargan-turns-alone', attempt: 'turn',
    requires: [{ kind: 'npc', npc: 'vex', fate: 'turned' }, ...also], hideWhenBlocked: true,
    check: { skill: 'persuasion', dc: 14, failTo: 'boss-unguarded' } },
];
/** Marching him down to the reeve. {wren} asked for something to arrest, and
 *  thinks the better of the company for it, but only if she knows the company
 *  at all (`met`: pulled out from under the horse). */
const BIND_VARGAN: Choice[] = [
  { id: 'reeve', label: 'Bind him and march him down to the reeve', to: 'aftermath',
    requires: [{ kind: 'npc', npc: 'wren', met: true }], hideWhenBlocked: true,
    effects: [{ kind: 'npc', npc: 'vargan', fate: 'jailed' }, { kind: 'npc', npc: 'wren', attitude: 1 }] },
  { id: 'reeve-unmet', label: 'Bind him and march him down to the reeve', to: 'aftermath',
    requires: [{ kind: 'npc', npc: 'wren', met: false }], hideWhenBlocked: true,
    effects: [{ kind: 'npc', npc: 'vargan', fate: 'jailed' }] },
];
const REEDWIFE_FALLS = 'The **{reedwife}** staggers back into the fire-pit and goes down hissing. When the steam clears there is nothing in the coals but a twist of river-weed, curling as it dries.';
const REEDWIFE_WON: Effect[] = [{ kind: 'npc', npc: 'reedwife', fate: 'dead' }, { kind: 'gold', amount: 100 }, { kind: 'setFlag', flag: 'pens-settled' }];
const REEDWIFE_LOST = [
  'The hag\'s cold fingers close over your eyes, and the hall goes dark.',
  'You wake behind the throne, where somebody dragged you. {vargan} sits beside you with his burned hand in his lap. "She is still by the fire," he says. "Get up. I cannot finish her alone."',
];

/**
 * The claims in the square after the chief falls. Each pays out once, shows a
 * one-line result beat, and comes back to the short `aftermath-hub` instead of
 * replaying the homecoming. The bounty is owed to whoever killed the chief; a
 * party that took the 25-gold retainer at the board collects the balance.
 */
const AFTERMATH_CLAIMS: Choice[] = [
  { id: 'bounty', label: 'Let the reeve count out the bounty', to: 'claim-bounty',
    requires: [{ kind: 'notFlag', flag: 'bounty' }, { kind: 'notFlag', flag: 'got-bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold', amount: factValue('bounty-full') }, { kind: 'setFlag', flag: 'got-bounty' }] },
  { id: 'balance', label: 'Let the reeve settle the rest of the bounty', to: 'claim-balance',
    requires: [{ kind: 'flag', flag: 'bounty' }, { kind: 'notFlag', flag: 'got-bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold', amount: factValue('bounty-balance') }, { kind: 'setFlag', flag: 'got-bounty' }] },
  { id: 'banner', label: 'Unroll the {ashfang} banner on the well', to: 'claim-banner',
    requires: [{ kind: 'flag', flag: 'looted' }, { kind: 'notFlag', flag: 'got-banner' }],
    effects: [{ kind: 'gold', amount: factValue('bounty-banner') }, { kind: 'setFlag', flag: 'got-banner' }] },
  // Hidden unless she was saved: a company that never pulled her out from
  // under the horse doesn't know her name.
  { id: 'scout', label: 'Look for {wren} in the crowd', to: 'claim-scout', hideWhenBlocked: true,
    requires: [{ kind: 'npc', npc: 'wren', fate: 'saved' }, { kind: 'notFlag', flag: 'got-scout' }],
    effects: [{ kind: 'gold', amount: factValue('scout-reward') }, { kind: 'setFlag', flag: 'got-scout' }] },
  // `won`: every road to the victory ending runs through here, so the next
  // chapters can tell a company that broke the Ashfang from a cold start.
  // Shown once the bounty is settled (paid, or forfeit for a freed chief), so
  // no company walks off and leaves it on the well by accident.
  { id: 'done', label: 'Let the crowd carry you to the {wander-inn}', to: 'epilogue',
    requires: [{ kind: 'flag', flag: 'got-bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'setFlag', flag: 'won' }] },
];


// NPCs name a reusable archetype `portraitId` (src/data/adventure-art.ts) so
// they share art with every other module's innkeeper / scout / captain; the
// emoji is the fallback until that portrait is generated.
/** What the peddler's stall gives up, however he was taken. */
const SPY_LIST = 'Under a loose board at the back of his stall lies a list of every caravan to leave {thornwick} this month. Someone has ticked off each one. The ticks are his. The list is in another man\'s writing. "The chief writes it," he babbles. "He knows every carter in this town by name. I only tick them off."';

/** What the company can say at {vex}'s fire. Split on whether the pen is
 *  still an open question: only then does his word on it go in the journal
 *  (PENS_LEAD). Shared `attempt`s keep each try to one go across both. */
const VEX_OFFERS = (lead: boolean): Choice[] => {
  const pens: Requirement = lead ? { kind: 'notFlag', flag: 'pens-settled' } : { kind: 'flag', flag: 'pens-settled' };
  const told: Effect[] = lead ? [PENS_LEAD] : [];
  const id = (base: string) => (lead ? base : `${base}-settled`);
  return [
    // Wren's tip (`know-vex`): the party knows what he wants before he says it.
    { id: id('wren'), label: '[Persuasion DC 9] "{wren} says you want out. The reeve\'s pardon, and a road."', to: 'vex-turned',
      attempt: 'vex-pardon', requires: [{ kind: 'flag', flag: 'know-vex' }, pens], hideWhenBlocked: true,
      effects: told, check: { skill: 'persuasion', dc: 9, failTo: 'vex-refuses' } },
    { id: id('persuade'), label: '[Persuasion DC 13] Offer him the reeve\'s pardon and a road out', to: 'vex-turned',
      attempt: 'vex-pardon', requires: [{ kind: 'notFlag', flag: 'know-vex' }, pens], hideWhenBlocked: true,
      effects: told, check: { skill: 'persuasion', dc: 13, failTo: 'vex-refuses' } },
    { id: id('intimidate'), label: '[Intimidation DC 14] Point out his one other way out', to: 'vex-turned',
      attempt: 'vex-threat', requires: [pens], hideWhenBlocked: true,
      effects: told, check: { skill: 'intimidation', dc: 14, failTo: 'vex-refuses' } },
    { id: id('refuse'), label: 'Refuse to deal with a raider', to: 'vex-dismissed',
      requires: [pens], hideWhenBlocked: true,
      effects: [{ kind: 'npc', npc: 'vex', met: true }, ...told] },
  ];
};

/** What earns {mira}'s warmth at the end, as mutually exclusive cases (one
 *  line shows): the captives freed, else the scout saved, else the mill
 *  turning. MIRA_COOL is none of them. The aftermath and the epilogue both
 *  read these, each beside "not executed". */
const MIRA_WARM: Requirement[][] = [
  [{ kind: 'flag', flag: 'captives-freed' }],
  [{ kind: 'notFlag', flag: 'captives-freed' }, { kind: 'npc', npc: 'wren', fate: 'saved' }],
  [{ kind: 'notFlag', flag: 'captives-freed' }, { kind: 'npc', npc: 'wren', notFate: ['saved'] }, { kind: 'flag', flag: 'mill-saved' }],
];
const MIRA_COOL: Requirement[] = [
  { kind: 'notFlag', flag: 'captives-freed' }, { kind: 'npc', npc: 'wren', notFate: ['saved'] }, { kind: 'notFlag', flag: 'mill-saved' },
];

const MIRA = speaker(NPCS.mira!, { label: '{mira} the Innkeeper' });
const SCOUT = speaker(NPCS.wren!, { label: 'Wounded Scout', portraitId: 'npc-wounded', emoji: '🤕' });
const LIEUTENANT = speaker(NPCS.vex!, 'the Lieutenant');

const scenes: Record<string, Scene> = {
  // === ACT 0 — THE VALLEY ROAD (cold open: a fight in the first minute) ===
  // The module leads with combat, not conversation: an ambush that teaches the
  // battle UI (it's the first fight, so the tutorial fires) and names the enemy
  // — the raiders declare for the Ashfang chief before you ever reach town.
  road: {
    id: 'road', kind: 'story', art: { imageId: 'loc-road', emoji: '🛤️' },
    text: [
      'A day\'s hard walk up the valley, and the country has gone wrong-quiet. There are no carters on the road and no herders, only crows that lift off the hedgerows as you pass.',
      '{thornwick} lies an hour ahead, its chimney-smoke thin against the grey hills. Word of the reeve\'s bounty reached you three towns back, but the note folded in your pack is in a plainer hand. *Come quick. We are not too proud to ask.* {mira} of the {wander-inn} signed it, and that note is why you kept walking.',
      'The hedges shift on both sides at once, and it is already too late to run.',
    ],
    next: [{ id: 'go', label: 'Draw steel', to: 'road-ambush' }], noBack: true,
  },
  'road-ambush': {
    id: 'road-ambush', kind: 'battle', encounterId: 'raiders-forward', mapId: 'open',
    intro: [
      'Raiders scramble out of the ditch, an orc with a notched axe and a lean scout with an arrow on the string. A bandit in a stolen carter\'s coat climbs out after them, already grinning.',
      '"The road\'s the **{ashfang}\'s** now!" the bandit crows. "Chief takes his cut of every throat on it — and yours\'ll do just fine."',
    ],
    onWin: { to: 'road-reveal', text: ['The bandit drops into the mud, and the road is yours again — for now.'] },
    // Losing the very first fight must not skip the arrival in Thornwick (the
    // module's defeat scene wakes you at Mira's hearth before you've met her).
    onLoss: { to: 'road-carter', text: ['The world goes grey, then black.'] },
  },
  'road-carter': {
    id: 'road-carter', kind: 'story', art: { imageId: 'loc-road', emoji: '🛒' },
    text: [
      'You wake on a bed of turnips, rocking gently. An old carter glances back from his seat. "Found you face-down in the ditch," he says. "The {ashfang} left you for dead. Lucky for you, they\'re poor judges of it."',
      'He points his whip at the hills, where a thin smudge of smoke rises past the marsh. "That\'s their den up there. Folk keep well clear of it." Ahead, the roofs of {thornwick} come into view.',
    ],
    next: [{ id: 'on', label: 'Ride the last mile into {thornwick}', to: 'thornwick',
      effects: [
        { kind: 'journal', entry: { id: 'c-ashfang', kind: 'clue', title: 'The {ashfang} Own the Valley',
          body: '{ashfang} raiders ambushed you on the road and left you for dead. A carter brought you to {thornwick} and showed you their smoke, rising in the hills past the marsh.' } }] }],
    noBack: true,
  },
  'road-reveal': {
    id: 'road-reveal', kind: 'story', noBack: true, art: { imageId: 'loc-road', emoji: '🩸' },
    text: [
      'The bandit isn\'t dead yet. He laughs wetly through red teeth as you stand over him.',
      '"You think you\'ve done something? There\'s more of us in the hollow than you\'ve got arrows — and the **chief**, he don\'t belong to himself no more. There\'s something *in the marsh* he feeds, and it feeds him back. The **{ashfang}** own this whole valley now, and worse than us owns them."',
      'His eyes drift to the hills, to a thin smudge of smoke past the marsh, and then to nothing at all.',
    ],
    next: [{ id: 'on', label: 'Press on to {thornwick}', to: 'thornwick',
      effects: [
        { kind: 'journal', entry: { id: 'c-ashfang', kind: 'clue', title: 'The {ashfang} Own the Valley',
          body: 'Raiders ambushed you on the road, boasting of an {ashfang} chief who dens in the hills past the marsh — you saw his smoke rise for yourself. They are many, and they answer to him.' } }] }],
  },

  // === ACT 1 — THORNWICK (village hub) ===================================
  thornwick: {
    id: 'thornwick', kind: 'story', art: { imageId: 'loc-village', emoji: '🏘️' },
    text: [
      'The road brings you into **{thornwick}** at last, through a scorched gate and past barred shutters. Faces watch you from the dark of doorways.',
      'For a month the {ashfang} have bled this valley dry, and the whole country locks its doors by dark.',
    ],
    next: [{ id: 'go', label: 'Enter the {wander-inn}', to: 'tavern-meet' }],
    noBack: true,
  },
  // The tavern is a small loop, not a one-way door (#6): each social read is a
  // `once` choice that returns you here, so you can try Insight *and*
  // Persuasion but never re-roll either. "Head to the square" is the way out.
  // First meeting: Mira's introduction plays once, then every return to the
  // inn (rest, the regulars, a lead followed up) lands on the short `tavern` hub.
  'tavern-meet': {
    id: 'tavern-meet', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'Inside the **{wander-inn}** the fire is low and the talk lower. A broad woman with flour to the elbow sets down her cloth, looks you over once, and evidently decides you\'ll do.',
      '"Sellswords. Good. You read my note, then." **{mira}** doesn\'t smile. Nobody in {thornwick} has seen her do it since the raids began. "The reeve\'s too proud to beg, so I wrote it for him. Sit."',
      '"The {ashfang} came down the **marsh road**, out past the reeds. Everyone knows that much. Knowing it never once filled a burned cart back up." She sets down the cup. "Last week they took a carter off the north road, and his granddaughter with him. She\'s seven. The old reed-cutters are counting the nights to the dark of the moon, and none of them will say why."',
      '"And the reeve sent his scout down the marsh road a few days back, a girl on a grey horse. She hasn\'t come back. If she\'s lying hurt out there, she hasn\'t many nights left."',
      '"Some of the old reed-cutters say the {ashfang} chief knows the marsh like he was born on it." She wipes a cup. "There was a reed-cutter\'s boy once. Years back, the spring the marsh rose, his mother\'s house went under the water. He walked out of {thornwick} that week and never came back. Not till the raids started this spring, some say. Folk talk. And there\'s more, the kind folk won\'t say with the door open."',
    ],
    next: [{ id: 'sit', label: 'Pull up a stool', to: 'tavern',
      effects: [{ kind: 'journal', entry: { id: 'q-main', kind: 'quest', title: 'Break the {ashfang}', body: '{mira}, who keeps the {wander-inn}, begged your help against the {ashfang} raiders bleeding {thornwick} dry. Find where they den. Ask around the market and the marsh road, then end them.' } }] }],
    noBack: true,
  },
  tavern: {
    id: 'tavern', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: ['**{mira}** leans on the bar and waits for you to say something useful.'],
    next: [
      // Nothing left to read once the peddler is in the cells.
      { id: 'insight', label: '[Insight DC 12] Read what she isn\'t saying', to: 'tavern-spy',
        once: true, requires: [{ kind: 'notFlag', flag: 'spy-caught' }, { kind: 'notFlag', flag: 'spy-seen' }], hideWhenBlocked: true, check: { skill: 'insight', dc: 12, failTo: 'tavern-blank', failEffects: [{ kind: 'setFlag', flag: 'mira-read' }] } },
      { id: 'persuade', label: '[Persuasion DC 12] Buy the whole room a round ({tavern-round})', to: 'tavern-trail',
        once: true, requires: [{ kind: 'gold', atLeast: factValue('tavern-round') }], effects: [{ kind: 'gold', amount: -factValue('tavern-round') }],
        check: { skill: 'persuasion', dc: 12, failTo: 'tavern-round-flat' } },
      { id: 'plain', label: 'Ask her the way to the den', to: 'tavern-plain', once: true },
      // The rumor table: an optional, in-character tutorial any player can skip.
      // Each regular teaches one real mechanic; kept as its own loop so it never
      // gets in the way of the plot choices above.
      { id: 'regulars', label: 'Drift over to the regulars\' table', to: 'regulars' },
      // A paid long rest: cheap, but a real gold sink and the place to re-prepare
      // spells. Gated on having the coin; the effect deducts it before resting.
      { id: 'room', label: 'Take a room for the night ({inn-room}, long rest)', to: 'inn-rest',
        requires: [{ kind: 'gold', atLeast: factValue('inn-room') }], effects: [{ kind: 'gold', amount: -factValue('inn-room') }] },
      { id: 'leave', label: 'Step out into the square', to: 'square' },
    ],
  },
  'inn-rest': {
    id: 'inn-rest', kind: 'rest', variant: 'long', next: 'tavern',
    intro: ['You take a room above the taproom, bolt the door, and sleep straight through until the smell of {mira}\'s bread comes up the stairs. Your wounds have closed, and your head is clear.'],
  },
  'tavern-spy': {
    id: 'tavern-spy', kind: 'story', noBack: true, art: { emoji: '👁️' },
    text: [
      '**{mira}** sees you\'ve noticed. She lowers her voice until it barely carries over the fire.',
      '"The {ashfang} always seem to know which wagon\'s worth taking. Someone here feeds them word of every caravan that leaves — and I think I know who."',
      '"There\'s a **furtive peddler** who sets up by the **market**, near the gate. Sells nothing, buys nothing, but he\'s there every time a train rolls out. Watch him. If anyone\'s carrying word to the raiders, it\'s him."',
    ],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern',
      effects: [{ kind: 'setFlag', flag: 'know-spy' },
        { kind: 'journal', entry: { id: 'lead-spy', kind: 'lead', resolvedBy: 'spy-caught',
          title: 'The Furtive Peddler', body: '{mira} named a peddler who loiters by the market gate as the raiders\' informant. Find his stall in {thornwick} Square. Come at him quietly, before he can whistle up his crew.' } }] }],
  },
  'tavern-trail': {
    id: 'tavern-trail', kind: 'story', noBack: true, art: { emoji: '🗺️' },
    text: [
      'A round on your coin loosens the whole room. An old trapper drags a finger through spilled ale, sketching the **marsh road** across the bar.',
      '"Here\'s the reeds, here\'s the deep water — and here," he taps a hollow in the hills, "is where their smoke rises of a morning. That\'s your den. Mind, the **trail** bites back long before you reach it."',
    ],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern',
      effects: [{ kind: 'setFlag', flag: 'trail-known' }] }],
  },
  'tavern-plain': {
    id: 'tavern-plain', kind: 'story', back: true, art: { emoji: '🍺' },
    text: ['"The marsh road, then. Follow it till the reeds close in, and keep going." She sets down the cup she was wiping.',
      '"If you find the reeve\'s scout, she\'ll tell you she\'s fine," {mira} says. "Help her anyway. Take a healing potion with you, too. I\'d rather not bury anyone this month." She turns back to her taps.'],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern' }],
  },
  'tavern-blank': {
    id: 'tavern-blank', kind: 'story', back: true, art: { emoji: '🍺' },
    text: ['"Whatever you think you see on my face, it\'s flour." {mira} goes back to wiping cups.'],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern' }],
  },
  'tavern-round-flat': {
    id: 'tavern-round-flat', kind: 'story', back: true, art: { emoji: '🍻' },
    text: ['The room drinks your round and thanks you kindly, and then the talk turns to the weather. The marsh does not come up once.'],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern' }],
  },

  // --- The Regulars' Table: a reusable "lore table" ------------------------
  // A drop-in, fully optional in-character tutorial. Each regular teaches ONE
  // real mechanic in the world's own voice; the choices are `once` so a lesson
  // isn't repeated, and "leave them to it" exits at any time. Any module can
  // paste this shape into its hub — a hub scene whose `once` choices each route
  // to a short lore beat that loops back. Skippable by design: advanced players
  // simply never walk over.
  regulars: {
    id: 'regulars', kind: 'story', back: true, art: { emoji: '🍻' },
    text: ['{thornwick}\'s older hands have claimed the long table by the fire — the sort who\'ve survived enough to have firm opinions about how. They\'ll talk your ear clean off, if you let them. Some of it might even keep you breathing.'],
    again: ['The old hands at the long table shove along the bench to make room for you again.'],
    next: [
      { id: 'tactics', label: 'Ask the old sergeant how a real fight goes', to: 'rumor-tactics', once: true },
      { id: 'magic', label: 'Ask the hedge-witch about working spells', to: 'rumor-magic', once: true },
      { id: 'weapons', label: 'Ask the caravan veteran about her axe', to: 'rumor-weapons', once: true },
      { id: 'back', label: 'Leave them to their ale', to: 'tavern' },
    ],
  },
  'rumor-tactics': {
    id: 'rumor-tactics', kind: 'story', back: true, art: { emoji: '🛡️' },
    text: [
      'A grey-bearded man with a soldier\'s too-straight back taps the boards. "Rule one, and it\'s the reason I\'ve still got both legs: don\'t turn your back on a man with a blade in reach. Step away careless and he gets a free cut at you as you go."',
      '"Want out of a scrap without the parting gift? Then do nothing else but get out of it. Eyes on his blade, back off slow, and don\'t try anything clever on the way. Especially you wand-wavers: get clear before you start your muttering, or you\'ll be eating steel halfway through the word."',
    ],
    next: [{ id: 'ok', label: 'Nod your thanks', to: 'regulars' }],
  },
  'rumor-magic': {
    id: 'rumor-magic', kind: 'story', back: true, art: { emoji: '🔮' },
    text: [
      'A woman with river-stones knotted in her hair doesn\'t look up from her knitting. "Magic\'s never free, whatever the college boys tell you. Every real working takes something out of you, and you\'ve only so much to give before you sleep. Spend it like your last coppers, because in a long fight, that\'s what it is."',
      '"The strong workings, a held foe or a ward of blades, burn only as long as you hold them in your head. Take a hard knock and you\'d best keep your focus, or the whole thing slips through your fingers. Can\'t hold two at once, either. So pick the one that\'ll matter."',
    ],
    next: [{ id: 'ok', label: 'Nod your thanks', to: 'regulars' }],
  },
  'rumor-weapons': {
    id: 'rumor-weapons', kind: 'story', back: true, art: { emoji: '⚔️' },
    text: [
      'A scarred caravan guard rolls her axe over on the table. "Every weapon\'s got a trick in it, if you know how to ask. A heavy blade bites one man and the swing carries on into the next. A mace\'ll rattle a foe, so his next swing at you goes wide."',
      '"Learn what the thing in your hand actually *does*. That\'s how you put down men twice your size."',
    ],
    next: [{ id: 'ok', label: 'Nod your thanks', to: 'regulars' }],
  },

  square: {
    id: 'square', kind: 'explore',
    map: {
      title: '{thornwick} Square', theme: 'stone', art: { imageId: 'loc-village', emoji: '⛲' },
      camp: {}, // safe: rest freely in town
      // Overworld dressing: the party pawn arrives at the inn, and lanes link
      // the stops so the square reads as one place, not floating markers.
      entry: ['inn'],
      roads: [
        ['inn', 'market'], ['market', 'board'], ['inn', 'mill'],
        ['market', 'informant'], ['informant', 'gate'], ['board', 'gate'],
      ],
      nodes: [
        { id: 'inn', x: 20, y: 30, label: 'The {wander-inn}', icon: 'tok-tavern', scene: 'tavern' },
        { id: 'market', x: 40, y: 40, label: 'Market', icon: 'tok-market', scene: 'market' },
        { id: 'board', x: 70, y: 28, label: 'Notice Board', icon: 'tok-notice', scene: 'board' },
        // Optional side bounty: honest early XP for a party that helps out.
        { id: 'mill', x: 12, y: 62, label: 'The Old Mill', icon: 'tok-figure', scene: 'mill',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'mill-saved' }], to: 'mill-done' }] },
        // The peddler is always here to be dealt with, under a plain label: the
        // map doesn't know he's the leak until Mira (the tavern Insight) says so.
        // Walking up cold ends in a fight. A party that read the lead can stalk
        // him first (`spy-stalk`) and take him before he whistles, but only
        // while he hasn't seen them: once he has whistled at them (his crew
        // fought, faced down or fallen back from), the stall is the
        // confrontation again.
        // The gate below won't open until he's caught, so no party skips him.
        { id: 'informant', x: 48, y: 66, label: 'Peddler\'s Stall', icon: 'tok-figure', scene: 'spy-confront',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'spy-caught' }], to: 'spy-gone' },
            { if: [{ kind: 'visited', scene: 'spy-confront' }], to: 'spy-confront' },
            { if: [{ kind: 'flag', flag: 'know-spy' }], to: 'spy-stalk' }] },
        { id: 'gate', x: 82, y: 78, label: 'Leave for the Marsh Road', icon: 'tok-gate', scene: 'trailhead',
          sceneWhen: [{ if: [{ kind: 'notFlag', flag: 'spy-caught' }], to: 'gate-blocked' },
            // The road out was fought (or faced down) already: don't replay it.
            { if: [{ kind: 'visited', scene: 'trail' }], to: 'trailhead-clear' }] },
      ],
    },
  },
  // A raided village's market: healing, plain steel and road armour. Not much
  // magic gets through when the Ashfang take every second cart.
  market: { id: 'market', kind: 'shop', title: '{thornwick} Market', next: 'square',
    stock: [
      'potion-healing', 'potion-greater-healing', 'alchemists-fire', 'potion-poison-resistance',
      'scroll-cure-wounds', 'scroll-healing-word', 'scroll-bless', 'scroll-protection-from-evil-and-good',
      'dagger', 'handaxe', 'spear', 'battleaxe', 'warhammer', 'longbow',
      'padded', 'leather', 'studded-leather', 'hide', 'chain-shirt', 'ring-mail', 'scale-mail', 'chain-mail',
    ],
    npc: speaker(NPCS.bram!, { label: '{bram} the Quartermaster' }),
    intro: ['"Coin\'s coin, and I\'ll not ask where yours has been." **{bram}** plants both hands on the stall. "Buying, or selling? Prices are fair. A dead customer never comes back for more, and I do like the repeat trade."'] },
  board: {
    id: 'board', kind: 'story', art: { emoji: '📜' },
    text: [
      'Here is the reeve\'s bounty in full, nailed up and gone grey at the edges. He will pay good coin for proof the {ashfang} chief is dead, and better still for their banner brought back whole.',
      'Someone has added a line at the bottom in a smaller, prouder hand: *"{thornwick} does not beg. It pays its debts."* That ink is newer than the rest.',
    ],
    again: ['The reeve\'s bounty still hangs on the board, a little greyer at the edges than before.'],
    next: [
      // `once` so the reeve's retainer can't be re-claimed by revisiting the board.
      { id: 'ok', label: 'Take the reeve\'s retainer up front', to: 'square', once: true,
        effects: [{ kind: 'setFlag', flag: 'bounty' }, { kind: 'gold', amount: factValue('bounty-retainer') },
          { kind: 'journal', entry: { id: 'c-bounty', kind: 'clue', title: 'The Reeve\'s Bounty', body: 'The reeve pays for the {ashfang} chief dead, and pays extra for their banner brought back as proof. You took {bounty-retainer} gold of it up front.' } }] },
      { id: 'leave', label: 'Leave it for now', to: 'square' },
    ],
  },
  'spy-confront': {
    id: 'spy-confront', kind: 'dialogue', npc: { id: 'npc-peddler', name: 'The Peddler', portraitId: 'npc-merchant', emoji: '🕵️' },
    art: { emoji: '🕵️' },
    lines: [
      // A party sent by Mira (`know-spy`) has just looked his stall over in `spy-stalk`.
      { if: [{ kind: 'notFlag', flag: 'know-spy' }], text: 'The peddler\'s stall is a marvel of things nobody wants — chipped buttons, one good boot, a birdcage with no bird. He never takes his eyes off the gate.' },
      { if: [{ kind: 'flag', flag: 'know-spy' }, { kind: 'notFlag', flag: 'spy-slipped' }], text: 'Up close he is younger than he looked, and he smells of the fish stall. He still hasn\'t looked round.' },
      // Back at his stall the evening after he saw you creeping up on him.
      { if: [{ kind: 'flag', flag: 'know-spy' }, { kind: 'flag', flag: 'spy-slipped' }], text: 'Up close he is younger than he looked, and he smells of the fish stall. He knows your faces from yesterday, and he watches you all the way across the square.' },
      'When your shadow falls across his goods he goes very still, and then he does the last thing you expect of a man selling buttons. He puts two fingers to his teeth and *whistles*. All round the square, hard-faced men start setting down their drinks. A thickset man in a good coat, the **fixer** who pays them, stands up last.',
    ],
    again: ['The peddler is back behind his stall of chipped buttons. He sees you coming this time. His fingers are at his teeth before you reach him, and the whistle brings his crew out of the crowd again.'],
    // The whistle has gone up and his crew is closing: no strolling off now.
    // `spy-seen`: he knows their faces, so Mira's quiet-approach tip is stale.
    noBack: true,
    next: [
      { id: 'investigate', label: '[Investigation DC 13] Pick his crew out of the crowd first', to: 'spy-ambush',
        once: true, effects: [{ kind: 'setFlag', flag: 'spy-seen' }],
        check: { skill: 'investigation', dc: 13, failTo: 'spy-pinched', failEffects: [{ kind: 'gold', amount: -factValue('pinched-purse') }] } },
      { id: 'intimidate', label: '[Intimidation DC 14] Shout down the hired help before they close', to: 'spy-balked',
        once: true, effects: [{ kind: 'setFlag', flag: 'spy-seen' }], check: { skill: 'intimidation', dc: 14, failTo: 'spy-bolts' } },
      { id: 'brace', label: 'Put your backs to the wall and draw', to: 'spy-bolts', effects: [{ kind: 'setFlag', flag: 'spy-seen' }] },
    ],
  },
  // Taken quietly (stalked and grabbed, his crew shouted down, or caught by
  // a read of the crowd): nobody runs for the marsh to warn the den, so the
  // gate-signal he gives up is still good.
  'spy-caught': {
    id: 'spy-caught', kind: 'story', art: { emoji: '🔗' },
    text: [
      'His crew is down or gone, one way or another, and the peddler knows it. He folds like wet paper. "I only carried word! I never lifted a blade!"',
      SPY_LIST,
      'The rest comes out all in one breath, and the raiders\' **gate-signal** with it. "Call that up to the watch-post and they\'ll open for you like you\'re one of their own." None of his crew went toward the marsh, so the signal is still good.',
    ],
    noBack: true,
    next: [{ id: 'ok', label: 'Hand him to the reeve', to: 'square',
      effects: [{ kind: 'setFlag', flag: 'spy-caught' }, { kind: 'setFlag', flag: 'know-signal' }, { kind: 'gold', amount: 40 },
        { kind: 'journal', entry: { id: 'c-signal', kind: 'lead', resolvedBy: 'signal-spent', title: 'The Gate-Signal', body: 'You caught the {ashfang}\'s informant in the market and took the raiders\' gate-signal off him. Call it up to the watch-post at the den\'s gate, and the watch should open for you.' } }] }],
  },
  // Taken the loud way (a brawl, or his knives scared off): one of them ran
  // for the den, so the signal is spoiled before the peddler can give it up. The den still has
  // other ways in (the wall, the water-gate, the gate itself).
  'spy-caught-loud': {
    id: 'spy-caught-loud', kind: 'story', art: { emoji: '🔗' },
    text: [
      'It is over, and half the square watched it happen. The peddler sits in the dirt by his stall with his hands up. "I only carried word! I never lifted a blade!"',
      SPY_LIST,
      'You ask him for the raiders\' gate-signal. He laughs, shakily, and points past the gate. Out on the marsh road, one of his knives is still running. "He\'ll be at the den by dark. They\'ll change the signal the minute he tells them. It\'s no good to anybody now."',
    ],
    noBack: true,
    next: [{ id: 'ok', label: 'Hand him to the reeve', to: 'square',
      effects: [{ kind: 'setFlag', flag: 'spy-caught' }, { kind: 'gold', amount: 40 },
        { kind: 'journal', entry: { id: 'c-peddler', kind: 'clue', title: 'The Peddler\'s List', body: 'You caught the {ashfang}\'s informant in the market, but not quietly. One of his crew ran for the den, so the gate-signal he knew is no good now. You will need another way past the den\'s watch.' } }] }],
  },
  // Mira's lead pays off: the party knows who he is, and he doesn't know them.
  'spy-stalk': {
    id: 'spy-stalk', kind: 'story', art: { imageId: 'loc-village', emoji: '🕵️' },
    text: [
      'There he is, just where {mira} said: a peddler with a stall of chipped buttons and a birdcage with no bird. He sells nothing, and he watches the gate.',
      'He hasn\'t seen you yet. Round the square, a few big men in work coats nurse their drinks and keep one eye on him.',
    ],
    again: ['The peddler is back at his stall of chipped buttons, watching the gate. His crew are back at their drinks, too.'],
    assumes: [{ kind: 'flag', flag: 'know-spy' }],
    next: [
      { id: 'stalk', label: '[Stealth DC 12] Come at him from behind the stalls', to: 'spy-grabbed',
        once: true, check: { skill: 'stealth', dc: 12, failTo: 'spy-slipped' } },
      { id: 'walk', label: 'Walk straight up to his stall', to: 'spy-confront' },
    ],
  },
  'spy-grabbed': {
    id: 'spy-grabbed', kind: 'story', art: { imageId: 'loc-village', emoji: '🤫' },
    text: [
      'You slip round behind the fish stall and come up at his back. His fingers are halfway to his teeth when you take his wrist.',
      'His crew sees the knife at his ribs. One by one, they find somewhere else to drink.',
    ],
    next: [{ id: 'ok', label: 'Turn out his stall', to: 'spy-caught', effects: [{ kind: 'xp', amount: avoidedFightXP('cutpurses') }] }],
    noBack: true,
  },
  'gate-blocked': {
    id: 'gate-blocked', kind: 'story', art: { imageId: 'loc-village', emoji: '🚧' },
    assumes: [{ kind: 'notFlag', flag: 'spy-caught' }],
    text: [
      'The gate-warden lays his spear across the road and shakes his head, not unkindly. "Reeve\'s orders, and for once they\'re sound ones. Someone in this town sells the {ashfang} word of every cart that leaves. Nobody goes out until he\'s in the cells."',
      // Before the peddler whistled: the warden doesn't know his face.
      { if: [{ kind: 'notFlag', flag: 'spy-seen' }],
        text: '"Don\'t look at me like that. If I knew his face, he\'d be there already. All I know is it\'s someone near the gate. Someone who\'s always about when a cart goes out. Find me who it is, and the road\'s yours."' },
      // {mira}'s read is still to be had only while the peddler hasn't shown
      // his hand (the tavern's Insight is gone once he has, or once tried).
      { if: [{ kind: 'notFlag', flag: 'spy-seen' }, { kind: 'notFlag', flag: 'know-spy' }, { kind: 'notFlag', flag: 'mira-read' }],
        text: '"Or ask {mira} at the {wander-inn}. She hears everything."' },
      // After the whistle and the brawl at his stall, the whole square knows.
      { if: [{ kind: 'flag', flag: 'spy-seen' }],
        text: '"And don\'t tell me you don\'t know who. Half the market watched that peddler whistle his knives out at you." He jerks his chin at the stall by the market. "Bring him in, and the road\'s yours."' },
    ],
    next: [{ id: 'ok', label: 'Back into the square', to: 'square' }], noBack: true,
  },
  // --- Optional: the mill bounty (Act 1 side fight) ------------------------
  mill: {
    id: 'mill', kind: 'dialogue', npc: speaker(NPCS.osk!, { label: '{osk} the Miller' }),
    art: { emoji: '🌾' },
    lines: [
      'The mill\'s sails hang still, and the miller meets you at a barred door with a boat-hook in both hands. "Not raiders, this one. Something\'s roosting in my hedgerows — turned my dog stiff as a fencepost. *Stone*, you understand. Won\'t nobody come near the mill now, and the grain\'s standing."',
      '"Clear them out and there\'s coin in it. Just — don\'t let the ugly things *touch* you."',
    ],
    again: ['{osk} the miller still has his boat-hook in both hands. "Back, are you? The ugly things are still in my hedgerows, and my grain\'s still standing."'],
    next: [
      { id: 'help', label: 'Beat the hedgerows', to: 'mill-fight' },
      { id: 'later', label: 'Leave him to his hedgerows', to: 'square' },
    ],
  },
  'mill-fight': {
    id: 'mill-fight', kind: 'battle', encounterId: 'cockatrice-flock', mapId: 'open',
    intro: ['Two bat-winged things burst out of the hedge in a fury of beak and scale, hissing like geese. "Cockatrices!" the miller shouts from his door. "Mind the beaks!"'],
    again: ['The cockatrices are still in the hedge, and this time they come out of it the moment you reach the gate. Mind the bite.'],
    onWin: { to: 'square', text: ['The second cockatrice flops still. The miller pays up gladly, prods the stone dog, and allows that it makes a fair garden ornament.'],
      effects: [{ kind: 'setFlag', flag: 'mill-saved' }, { kind: 'gold', amount: 35 }] },
  },
  'mill-done': {
    id: 'mill-done', kind: 'story', art: { emoji: '🌾' },
    text: ['The mill\'s sails are turning again, and the miller waves from the door. The stone dog keeps its vigil by the gate, forever pointing at nothing.'],
    next: [{ id: 'ok', label: 'Back to the square', to: 'square' }], noBack: true,
  },

  'spy-bolts': {
    id: 'spy-bolts', kind: 'battle', encounterId: 'cutpurses', mapId: 'village',
    intro: ['His crew shoulders out of the market crowd: a fixer and two hired knives, blades held low and level. They come straight for you.'],
    again: ['The fixer and his two hired knives close in again, blades low and level. They know your faces now.'],
    onWin: { to: 'spy-caught-loud', text: ['The fixer goes down, and the hired help drops its knives and its nerve together, and runs. One of them does not stop at the edge of the square. He goes straight out through the gate, toward the marsh.'] },
    parley: {
      skill: 'deception', dc: 13, label: 'Tell the knives the watch is coming',
      refused: ['The fixer doesn\'t even look round. "The reeve\'s men are down at the marsh gate, friend. We watched them go." His knives close in.'],
      success: { to: 'spy-caught-loud', effects: [{ kind: 'xp', amount: avoidedFightXP('cutpurses') }], text: ['"The reeve\'s men are two stalls behind us," you say, loud enough to carry, and glance past them as if you can see the pikes. The hired knives do the sums faster than their fixer does. They are gone into the crowd before he turns round. Alone, the fixer raises his empty hands and backs off into the market.',
        'Over the heads of the crowd, though, you see one of the knives slip out through the gate, toward the marsh.'] },
    },
  },
  'spy-ambush': {
    id: 'spy-ambush', kind: 'battle', encounterId: 'cutpurses', mapId: 'village',
    surprise: 'enemies', // you read the ambush first — the crew loses its opening round
    intro: ['The crew moves in from the stalls, but you are already where they didn\'t expect you. They scramble.'],
    // You picked them out first and stood between them and the gate, so
    // nobody gets out to warn the den.
    onWin: { to: 'spy-caught', text: ['The crew is still turning round when the fixer falls, and his hired blades throw down their knives. You are standing between them and the gate, so they bolt the other way, straight into the reeve\'s watch.'] },
  },
  // Shouted down: the hired help decides this is not worth dying for.
  'spy-balked': {
    id: 'spy-balked', kind: 'story', noBack: true, art: { imageId: 'loc-village', emoji: '📣' },
    text: [
      'You plant your feet and roar at the hired knives to put their blades away, now, while they still have hands to do it. Every head in the square turns.',
      'The knives look at your steel, then at the fixer, then at all the people watching. One by one they set their blades down on the cobbles. The fixer goes with them, out past the well and away from the gate. None of them looks keen to explain this to the chief.',
    ],
    next: [{ id: 'ok', label: 'Turn out his stall', to: 'spy-caught', effects: [{ kind: 'xp', amount: avoidedFightXP('cutpurses') }] }],
  },
  // A failed stalk: he sees you coming and slips away, and the party loses a
  // day waiting for him to come back to his stall.
  'spy-slipped': {
    id: 'spy-slipped', kind: 'story', noBack: true, art: { imageId: 'loc-village', emoji: '🕵️' },
    text: ['A board creaks under your boot, three stalls short. The peddler glances round, sees you, and is gone into the crowd before you can reach him. He does not come back to his stall until the next evening. You lose a whole day watching it stand empty.'],
    // `spy-slipped`: he has seen them now, and the confrontation says so.
    next: [{ id: 'on', label: 'Walk up to his stall', to: 'spy-confront', effects: [{ kind: 'passDay' }, { kind: 'setFlag', flag: 'spy-slipped' }] }],
  },
  // A failed read of the crowd: while you look for his crew, one of them robs you.
  'spy-pinched': {
    id: 'spy-pinched', kind: 'story', noBack: true, art: { imageId: 'loc-village', emoji: '👛' },
    text: ['You search the crowd for his crew, and you look in all the wrong places. By the time you spot the fixer, one of his knives has already brushed past you. Your purse went with him.'],
    next: [{ id: 'on', label: 'Get your backs to the wall', to: 'spy-bolts' }],
  },

  // === ACT 2 — THE MARSH ROAD (wilderness) ==============================
  trailhead: {
    id: 'trailhead', kind: 'story', art: { imageId: 'loc-road', emoji: '🛤️' },
    text: [
      { assumes: [{ kind: 'flag', flag: 'spy-caught' }], text: 'The peddler is in the reeve\'s cells now. The gate-warden stands aside, and **{thornwick}** falls away behind you. Ahead the road narrows into the **marsh**, a ribbon of mud between dark pools and whispering reeds.' },
      'Somewhere out in that maze the {ashfang} keep their den. Somewhere a good deal closer, it seems, they keep their eyes on the road.',
    ],
    next: [{ id: 'go', label: 'Set out on the marsh road', to: 'road-out' }],
  },
  'trailhead-clear': {
    id: 'trailhead-clear', kind: 'story', art: { imageId: 'loc-road', emoji: '🛤️' },
    text: ['The gate-warden waves you through, and the marsh road lies quiet. The goblins you met on it have not come back.'],
    next: [{ id: 'go', label: 'Out along the marsh road', to: 'trail' }],
  },
  'road-out': {
    id: 'road-out', kind: 'battle', encounterId: 'goblin-outriders', mapId: 'open',
    intro: ['Barely a mile from the gate the reeds erupt. A pack of goblins spills onto the road, yelling as if they had been waiting for you all day. Their boss lopes out in front with his scimitar bared, cackling something in Goblin that needs no translation.'],
    again: ['The goblin outriders are still in the reeds a mile from the gate. Their boss lopes out in front of the pack again, scimitar bared, cackling.'],
    // No milestone on the win: the fight's own XP is the reward. Staring the
    // pack down is the clever way past, so the parley carries the level a
    // company that has done the town would reach by fighting (2nd).
    onWin: { to: 'trail', text: ['The goblin pack breaks and vanishes into the reeds, and ahead of you the marsh swallows the road whole. Your sword-arm aches, but your hands are steady. A week ago, that fight would have finished you.'] },
    parley: {
      skill: 'intimidation', dc: 13, label: 'Stare down the goblin boss',
      refused: ['The goblin boss counts your blades, then counts his pack, and likes his own sum better. "Chief pays for heads," he cackles in bad Common. "Yours."'],
      success: { to: 'trail', text: ['You hold his eye and draw steel slow, and let him count your blades. The cackle dies in his throat. He barks something at his pack, and they melt back into the reeds as if they were never there. Behind you, somebody lets out a long breath. Not one blade got wet.'],
        effects: [{ kind: 'xpToLevel', level: 2 }] },
    },
  },
  trail: {
    id: 'trail', kind: 'explore',
    map: {
      title: 'The Marsh Road', theme: 'forest', art: { imageId: 'loc-marsh', emoji: '🌾' },
      camp: { risky: { chance: 0.4, battleScene: 'camp-ambush' } }, // sleep here at your peril
      // A traversal map: you start at the tracks and the trail forks — the
      // sunken ravine ahead, a cry for help off to the south. The hollow reveals
      // only once you've pushed on past the ravine.
      entry: ['tracks'],
      paths: [
        ['tracks', 'ravine'], ['tracks', 'scout'], ['ravine', 'approach'],
        ['scout', 'barrow'], ['ravine', 'thicket'],
      ],
      nodes: [
        { id: 'tracks', x: 18, y: 55, label: 'Fresh Tracks', icon: 'tok-tracks', scene: 'tracks',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'trail-read' }], to: 'tracks-done' },
            // The trapper's sketch from the inn round: no need to roll for the line.
            { if: [{ kind: 'flag', flag: 'trail-known' }], to: 'tracks-mapped' }] },
        { id: 'scout', x: 34, y: 82, label: 'A Cry for Help', mystery: 'A faint sound…', icon: 'tok-person', scene: 'wounded',
          sceneWhen: [
            { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }, { kind: 'companion', companion: 'wren' }], to: 'scout-along' },
            { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }], to: 'scout-sent' },
            { if: [{ kind: 'npc', npc: 'tamsin', fate: 'dead' }], to: 'scout-gone' },
            { if: [{ kind: 'npc', npc: 'wren', fate: 'left' }], to: 'scout-passed' },
            // Untended until the fifth morning (see `wounded`).
            { if: [{ kind: 'flag', flag: 'scout-bled-out' }], to: 'scout-dead' }] },
        // Optional: a sunken barrow, spotted only by a sharp-eyed party.
        { id: 'barrow', x: 52, y: 90, label: 'A Sunken Barrow', mystery: 'A low mound…', icon: 'tok-cave', scene: 'barrow',
          hidden: { dc: 12 },
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'barrow-cleared' }], to: 'barrow-done' }] },
        // Optional: a webbed thicket — plainly dangerous, plainly avoidable.
        { id: 'thicket', x: 66, y: 70, label: 'Webbed Thicket', mystery: 'Pale shapes in the reeds…', icon: 'tok-tree', scene: 'thicket',
          requires: [{ kind: 'flag', flag: 'crossed-ravine' }],
          note: 'The ravine cuts the trail. The webs are beyond it.',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'thicket-cleared' }], to: 'thicket-done' }] },
        { id: 'ravine', x: 52, y: 46, label: 'Sunken Ravine', icon: 'tok-crossing', scene: 'ravine',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'crossed-ravine' }], to: 'ravine-done' }],
          wandering: { chance: 0.5, battleScene: 'bog-toads' } },
        { id: 'approach', x: 82, y: 34, label: 'The Hollow Ahead', icon: 'tok-cave', scene: 'ambush',
          requires: [{ kind: 'flag', flag: 'trail-read' }, { kind: 'flag', flag: 'crossed-ravine' }],
          note: 'The ravine cuts the trail, and past it the reeds hide the way to the hollow. Cross the ravine, and find the patrols\' tracks.',
          // Once the ambush is broken the hollow is a walk, not a re-fightable
          // reward loop — the return trip from a den retreat passes through
          // quietly instead of re-rolling the battle (and its XP/treasure).
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'know-hag' }], to: 'hollow-quiet' },
            // A scout who counted the den's watch-posts sees the ambush first.
            { if: [{ kind: 'companion', companion: 'wren' }], to: 'ambush-wren' },
            // Lost the dry line at the tracks: the party splashes in, heard.
            { if: [{ kind: 'flag', flag: 'trail-wet' }], to: 'ambush-wet' }] },
      ],
    },
  },
  // The tracks: a Survival roll, easier for a ranger. One try either way.
  tracks: {
    id: 'tracks', kind: 'story', art: { emoji: '👣' },
    text: ['Boot-prints and drag-marks cross the mud. Read them right and the maze unravels.'],
    next: [
      { id: 'ranger', label: '[Ranger · Survival DC 9] Read the patrols\' line at a glance', to: 'tracks-read',
        requires: [{ kind: 'classInParty', classId: 'ranger' }], hideWhenBlocked: true,
        attempt: 'tracks', check: { skill: 'survival', dc: 9, failTo: 'tracks-lost' } },
      { id: 'read', label: '[Survival DC 12] Follow the boot-prints', to: 'tracks-read',
        attempt: 'tracks', check: { skill: 'survival', dc: 12, failTo: 'tracks-lost' } },
    ],
  },
  'tracks-read': {
    id: 'tracks-read', kind: 'story', art: { emoji: '👣' },
    text: ['The tracks tell their whole story: a heavy patrol out at dusk, a lighter one back at dawn, always the same dry line through the reeds. You\'ve found the **safe path to the hollow**.'],
    next: [{ id: 'ok', label: 'Follow the dry line', to: 'trail',
      effects: [{ kind: 'setFlag', flag: 'trail-read' }, { kind: 'xp', amount: 20 }] }],
    noBack: true,
  },
  'tracks-lost': {
    id: 'tracks-lost', kind: 'story', art: { emoji: '👣' },
    text: ['The prints tangle and double back on themselves until your eyes water, but they point roughly toward the hills. That\'s enough to find the hollow by, if not the dry way there.',
      'The wet way is slow and loud. You will come at the hollow splashing from one tussock to the next. Anything waiting in the reeds will hear you long before you see it.'],
    // `trail-wet`: the hollow's ambush is sprung on the party, no Perception roll.
    next: [{ id: 'ok', label: 'Head for the hills', to: 'trail',
      effects: [{ kind: 'setFlag', flag: 'trail-read' }, { kind: 'setFlag', flag: 'trail-wet' }] }],
    noBack: true,
  },
  'tracks-done': {
    id: 'tracks-done', kind: 'story', art: { emoji: '👣' },
    text: ['The mud has told you all it can. Nothing new has passed this way since.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'trail' }], noBack: true,
  },
  'tracks-mapped': {
    id: 'tracks-mapped', kind: 'story', art: { emoji: '🗺️' },
    assumes: [{ kind: 'flag', flag: 'trail-known' }],
    text: ['The old trapper\'s ale-sketch was a good one. The reeds, the pools and the hollow in the hills all line up with the mud. The patrols\' dry line runs just where his finger traced it.'],
    next: [{ id: 'ok', label: 'Follow the trapper\'s line', to: 'trail',
      effects: [{ kind: 'setFlag', flag: 'trail-read' }, { kind: 'xp', amount: 20 }] }],
    noBack: true,
  },
  'hollow-quiet': {
    id: 'hollow-quiet', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🌾' },
    assumes: [{ kind: 'flag', flag: 'know-hag' }],
    text: ['The hollow lies quiet where you broke the {reedwife}\'s ambush, with nothing left of it but flattened reeds and still water. The den\'s wooden wall waits ahead.'],
    // Wren parts at the tree line whichever way the party comes up to it.
    next: [
      { id: 'ok', label: 'On to the den gate', to: 'gate',
        requires: [{ kind: 'noCompanion', companion: 'wren' }], hideWhenBlocked: true },
      { id: 'wren', label: 'On to the den gate', to: 'wren-parts',
        requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true },
    ], noBack: true,
  },
  ravine: {
    id: 'ravine', kind: 'challenge', art: { emoji: '🪨' },
    intro: ['A collapsed ravine cuts the trail. The other lip is close, but the gap between is all loose rock, and there is more than one way across it.'],
    again: ['The ravine still cuts the trail. You look the loose stone over again for a way across you have not tried.'],
    // `perApproach`: a botched climb doesn't strand you — you can still scramble
    // the rubble or take the slow way round. Only when every line fails do you
    // take the long detour, and it costs a whole day on the clock.
    retry: 'perApproach',
    approaches: [
      { id: 'climb', label: 'Climb the sheer face',
        skill: 'athletics', dc: 13,
        success: { to: 'trail', text: ['You haul each other up and over, hand over hand.'],
          effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'xp', amount: 30 }] },
        failure: { to: 'ravine', text: ['A hold crumbles and you slide back down in a clatter of stone. That way will not work.'] } },
      { id: 'scramble', label: 'Pick across the rubble where it lies shallowest',
        skill: 'acrobatics', dc: 12,
        success: { to: 'trail', text: ['Light on your feet, you thread the shifting stones and reach the far lip.'],
          effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'xp', amount: 30 }] },
        failure: { to: 'ravine', text: ['The loose stone gives all at once and you scramble back before it takes an ankle with it.'] } },
      { id: 'detour', label: 'Look for a gentler way round', hint: 'It will cost you the afternoon.',
        skill: 'survival', dc: 11,
        success: { to: 'trail', text: ['You trace a gentler slope downstream and lead the party around dry-shod. It costs time, but nothing else.'],
          effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'xp', amount: 15 }] },
        failure: { to: 'ravine', text: ['You follow the lip of the ravine downstream for an hour, and it only gets deeper. You trudge back to where you started.'] } },
    ],
    // Reached only if every line of attack fails (or is spent).
    success: { to: 'trail', effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }] },
    failure: { to: 'trail', text: ['Every way across fights you. In the end you take the long, muddy detour downstream, miles out of your way. By the time you climb back onto the trail past the ravine, the light is gone. You have lost the whole day.'],
      effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'passDay' }] },
  },
  'ravine-done': {
    id: 'ravine-done', kind: 'story', art: { emoji: '🪨' },
    text: ['The ravine lies behind you. Nothing waits here but the wind over the loose stone.'],
    next: [{ id: 'ok', label: 'Press on', to: 'trail' }], noBack: true,
  },
  wounded: {
    id: 'wounded', kind: 'dialogue', npc: SCOUT, art: { emoji: '🤕' },
    lines: ['A young scout in the reeve\'s colours lies pinned under a dead horse, an arrow through her leg, her jaw set hard against the pain. "I\'m fine," she says — a lie you can see from here. "Get the horse off me and I\'ll tell you everything. How they\'re set, where they watch. I counted. That\'s the job."',
      'The mud under the arrow is dark and wet. She will not last many more nights out here.'],
    // No stepping back to the map: walking away from her is a choice (`leave`,
    // fate `left`), never a quiet click that records nothing.
    noBack: true,
    // One sure way to save her (a potion), and the rest are rolls: a healer's
    // hands come easier than the plain Medicine check, but they can still
    // slip. A slip fails forward (`scout-fail`): she lives, but it costs a day
    // and she is no guide. Every way out of here records her fate, so she is
    // met once. Walking past is final (fate `left`): the map marker
    // then shows only the empty horse, never the rescue again. Left untended
    // until the fifth morning (the dawn's `scout-bled-out`; {mira} warns of
    // her at the first meeting), she dies there: the scout the party covers
    // then is {tamsin} (fate `dead`).
    next: [
      { id: 'potion', label: 'Give her a healing potion', to: 'scout-saved',
        requires: [{ kind: 'item', itemId: 'potion-healing' }], hideWhenBlocked: true,
        // The company's own potion, spent on her: she won't forget it.
        effects: [{ kind: 'removeItem', itemId: 'potion-healing', qty: 1 }, { kind: 'npc', npc: 'wren', attitude: 1 }] },
      { id: 'lay-hands', label: '[Paladin · Religion DC 9] Lay hands on the wound', to: 'scout-saved',
        requires: [{ kind: 'classInParty', classId: 'paladin' }], hideWhenBlocked: true,
        attempt: 'scout-wound', check: { skill: 'religion', dc: 9, failTo: 'scout-fail' } },
      { id: 'pray', label: '[Cleric · Religion DC 9] Pray over the wound', to: 'scout-saved',
        requires: [{ kind: 'classInParty', classId: 'cleric' }], hideWhenBlocked: true,
        attempt: 'scout-wound', check: { skill: 'religion', dc: 9, failTo: 'scout-fail' } },
      { id: 'moss', label: '[Druid · Nature DC 9] Pack the wound with marsh-moss', to: 'scout-saved',
        requires: [{ kind: 'classInParty', classId: 'druid' }], hideWhenBlocked: true,
        attempt: 'scout-wound', check: { skill: 'nature', dc: 9, failTo: 'scout-fail' } },
      { id: 'medicine', label: '[Medicine DC 12] Ease her out and bind the leg', to: 'scout-saved',
        attempt: 'scout-wound', check: { skill: 'medicine', dc: 12, failTo: 'scout-fail' } },
      { id: 'leave', label: 'Leave her and press on', to: 'scout-left',
        effects: [{ kind: 'npc', npc: 'wren', fate: 'left' }] },
    ],
  },
  // Walking past (Wren's fate `left`, but not `met`): the party never
  // learned her name.
  'scout-left': {
    id: 'scout-left', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    text: [
      'You step around the horse. She doesn\'t call after you. She only watches you go, jaw still set, as if she had expected nothing else.',
      'Behind you the reeds close over the trail. You don\'t look back.',
    ],
    next: [{ id: 'ok', label: 'Press on', to: 'trail' }], noBack: true,
  },
  // The marker after walking past: she's gone, and no telling how.
  'scout-passed': {
    id: 'scout-passed', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    assumes: [{ kind: 'npc', npc: 'wren', fate: 'left' }],
    text: ['The dead horse still lies across the trail. The scout is gone. A line of flattened reeds drags away toward {thornwick}, and you cannot tell who made it.'],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'scout-saved': {
    id: 'scout-saved', kind: 'story', noBack: true, art: { emoji: '❤️‍🩹' },
    text: [
      'The horse comes off and the bleeding stops, and the scout lets out a breath she has been holding since the horse went down. "**{wren}**," she offers, as if admitting to a name costs her something. She scratches the den\'s watch-posts into the mud, quick and exact. She really did count.',
      ...WREN_ON_VEX,
    ],
    next: [
      { id: 'ok', label: 'Send {wren} back to {thornwick}', to: 'trail', effects: WREN_SAVED },
      // The Gold Box guide: she knows the marsh, and she owes you twice over.
      // Only as far as the den's gate: a party that has already been inside
      // (and could walk straight back in) sends her home instead.
      { id: 'come', label: 'Ask {wren} to come with you through the marsh', to: 'wren-joins',
        requires: [{ kind: 'notFlag', flag: 'den-entered' }], hideWhenBlocked: true,
        effects: [...WREN_SAVED, { kind: 'joinParty', companion: 'wren' }] },
    ],
  },
  'wren-joins': {
    id: 'wren-joins', kind: 'story', noBack: true, art: { emoji: '🧭' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: ['{wren} tests the bound leg, winces, and decides it will do. "I know where the sinkholes are. You don\'t." She takes up her bow. "As far as their gate. Then I go for the reeve\'s men, and you had better still be alive when I get back."'],
    next: [{ id: 'go', label: 'Follow {wren} into the marsh', to: 'trail' }],
  },
  // She came as far as she said she would.
  'wren-parts': {
    id: 'wren-parts', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🧭' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: ['At the tree line above the hollow {wren} stops, and eases her weight off the leg. "This is as far as I said." She counts the watch-posts one last time, lips moving. "Reeve\'s men by nightfall, if I run. Leave me something to arrest."'],
    next: [{ id: 'go', label: 'Let her go, and face the gate', to: 'gate',
      effects: [{ kind: 'leaveParty', companion: 'wren' }, { kind: 'setFlag', flag: 'wren-parted' }] }],
  },
  // A slip fails forward: she lives, but the bleeding costs the day, and the
  // leg won't carry her through the marsh, so she can't guide.
  'scout-fail': {
    id: 'scout-fail', kind: 'story', noBack: true, art: { emoji: '🩸' },
    text: [
      'It goes wrong. As the horse comes off her the arrowhead shifts, and the blood comes fast and dark. She fumbles at her belt for the healing potion she could never reach with the horse on top of her. You get it down her, and press on the wound until your arms shake.',
      'The bleeding stops at last, with the light already going. "**{wren}**," she says, grey to the lips. "In case you have to tell someone." She scratches the den\'s watch-posts into the mud, slower than she wants to. She is in no state to guide anyone anywhere today.',
      ...WREN_ON_VEX,
    ],
    next: [{ id: 'ok', label: 'Send {wren} limping back to {thornwick}', to: 'trail',
      effects: [...WREN_SAVED, { kind: 'passDay' }] }],
  },
  // The fifth morning came first: the scout under the horse is {tamsin},
  // and the party only finds her (or finds her again) to cover her.
  'scout-dead': {
    id: 'scout-dead', kind: 'story', noBack: true, art: { imageId: 'loc-marsh', emoji: '🐴' },
    assumes: [{ kind: 'flag', flag: 'scout-bled-out' }, { kind: 'npc', npc: 'wren', notFate: ['saved', 'left'] }],
    text: [
      'A young scout in the reeve\'s colours lies under the dead horse with an arrow through her leg. She died in the night, alone. There are tally-marks scratched in the mud by her hand. She was still counting the den\'s watch-posts.',
      'At her belt is the healing potion she could never reach with the horse on top of her. There is no one on the road to tell you her name.',
    ],
    next: [{ id: 'ok', label: 'Cover her and go', to: 'trail',
      effects: [{ kind: 'npc', npc: 'tamsin', met: true, fate: 'dead' }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 }] }],
  },
  // "Already done" beats: a finished location shows this instead of replaying
  // its full scene (the explore node's sceneWhen routes here once its flag set).
  'scout-gone': {
    id: 'scout-gone', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    assumes: [{ kind: 'npc', npc: 'tamsin', fate: 'dead' }, { kind: 'npc', npc: 'wren', notFate: ['saved'] }],
    text: ['The dead horse still lies across the trail, flies rising in the heat. Beside it is the low mound of reeds where you covered the scout.'],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'scout-along': {
    id: 'scout-along', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: ['The dead horse still lies across the trail. {wren} walks past it without looking. "He was a good horse," she says, too quickly. "Come on."'],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'scout-sent': {
    id: 'scout-sent', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    assumes: [{ kind: 'npc', npc: 'wren', fate: 'saved' }, { kind: 'noCompanion', companion: 'wren' }],
    text: [
      'The dead horse still lies across the trail.',
      { if: [{ kind: 'flag', flag: 'wren-parted' }],
        text: '{wren} left you at the tree line above the hollow, running for the reeve\'s men. The flies have the horse to themselves.' },
      { if: [{ kind: 'notFlag', flag: 'wren-parted' }],
        text: '{wren} is long gone, limping to {thornwick} for the reeve\'s men. A line of neat round holes in the mud shows where she leaned on her bow.' },
    ],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'spy-gone': {
    id: 'spy-gone', kind: 'story', art: { imageId: 'loc-village', emoji: '🕳️' },
    assumes: [{ kind: 'flag', flag: 'spy-caught' }],
    text: ['The peddler\'s stall stands bare, its awning taken down. He sits in the reeve\'s cells now, and the square has already moved on.'],
    next: [{ id: 'ok', label: 'Turn back to the square', to: 'square' }], noBack: true,
  },
  // --- Optional: the sunken barrow (Act 2 side fight, undead teaser) -------
  barrow: {
    id: 'barrow', kind: 'story', art: { emoji: '🪦' },
    text: [
      'Half-swallowed by the reeds lies a barrow-mound, its stones worn as smooth as soap. Its capstone is cracked and weeping cold air. The marsh has been chewing at it for centuries. Lately, something below has been pushing at the capstone, and something else has been pushing it back down.',
      'Grave-goods glint in the dark below. So does something that moves without touching the water.',
    ],
    again: ['The barrow-mound still breathes cold air through its cracked capstone. Down in the dark, the grave-goods still glint, and something still waits beside them.'],
    next: [
      { id: 'in', label: 'Go down into the dark', to: 'barrow-fight' },
      { id: 'leave', label: 'Leave the dead their peace', to: 'trail' },
    ],
  },
  'barrow-fight': {
    id: 'barrow-fight', kind: 'battle', encounterId: 'specter-haunt', mapId: 'corridor',
    intro: ['The cold answers you. Two shapes pour up out of the grave-earth. They were men once, and now they are nothing but spite and winter air. They pass *through* the barrow stones to reach you.'],
    again: ['The two cold shapes are waiting this time, down among the grave-goods. They come for you through the barrow stones again.'],
    onWin: { to: 'trail', text: ['The specters shred into cold mist. Among the grave-goods you find a little plain silver, and leave the rest, on balance, where it lies.'],
      effects: [{ kind: 'setFlag', flag: 'barrow-cleared' }, { kind: 'gold', amount: 45 }] },
  },
  'barrow-done': {
    id: 'barrow-done', kind: 'story', art: { emoji: '🪦' },
    text: ['The barrow lies quiet now, and the air above the capstone is no colder than the marsh.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'trail' }], noBack: true,
  },

  // --- Optional: the webbed thicket (Act 2 side fight — hard, telegraphed) --
  thicket: {
    id: 'thicket', kind: 'story', art: { emoji: '🕸️' },
    text: [
      'Pale silk sheets the reeds ahead, and they have gone grey and still. Bundles hang in the webbing at the height a man\'s shoulders would be. Some of the bundles are man-shaped.',
      'Something spins here, and it has been eating well off the {ashfang}\'s road. It is not small, and there is more than one of it. But those cocoons will have purses.',
    ],
    again: ['The grey webs still sheet the reeds, and the man-shaped bundles still hang in them. The spinners have not gone anywhere.'],
    next: [
      { id: 'in', label: 'Cut your way in', to: 'thicket-fight' },
      { id: 'leave', label: 'Give the webs a wide berth', to: 'trail' },
    ],
  },
  'thicket-fight': {
    id: 'thicket-fight', kind: 'battle', encounterId: 'spiders', mapId: 'marsh',
    intro: ['The silk trembles over your heads. Four giant spiders drop from the high webbing on every side, fangs already wet.'],
    again: ['The spiders are waiting in the high webbing this time. They drop the moment your blade touches the silk.'],
    onWin: { to: 'trail', text: ['The final spider curls in on itself like a burnt glove. The cocoons hold two dissolved raiders, their purses intact. There is also one caravan guard, still breathing. He does not stop thanking you until the reeds swallow the sound.'],
      effects: [{ kind: 'setFlag', flag: 'thicket-cleared' }, { kind: 'gold', amount: 60 }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 }] },
  },
  'thicket-done': {
    id: 'thicket-done', kind: 'story', art: { emoji: '🕸️' },
    text: ['The torn webs hang slack and grey. Nothing spins in the thicket now.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'trail' }], noBack: true,
  },

  'bog-toads': {
    id: 'bog-toads', kind: 'battle', encounterId: 'toad-swamp', mapId: 'bog',
    intro: ['The black water bulges, then heaves. A pair of giant toads haul themselves onto the mud bank. Each is wider than a shield, and faster than anything that size should be. A tongue lashes out for the nearest of you.'],
    onWin: { to: 'ravine', text: ['The second toad shudders and goes still, half in the water. You scrape off the slime and press on toward the ravine.'] },
  },
  'camp-ambush': {
    id: 'camp-ambush', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'marsh-dead', mapId: 'bog',
    intro: ['You wake to a wet, dragging sound in the dark. Two grey shapes are clawing up out of the mire beyond the fire. They come for the light on all fours, jaws working.'],
    again: ['The dragging sound comes again, out in the dark. The marsh has more dead in it than you hoped, and two of them are crawling toward your fire.'],
    // A risky camp can be broken up more than once: the second time reads
    // differently (`marsh-camp-raided` is a tally the text reads, nothing else).
    onWin: { to: '@hub', text: [
      { if: [{ kind: 'count', flag: 'marsh-camp-raided', below: 1 }],
        text: 'You shove the bodies back into the mire, but the fire will not catch again. You pack up in the dark, stiff and unrested, and walk on rather than lie down beside that water.' },
      { if: [{ kind: 'count', flag: 'marsh-camp-raided', atLeast: 1 }],
        text: 'Two more of them go back under the black water. You sit back to back by the dead fire for a long while after, blades across your knees, listening to the marsh.' },
    ], effects: [{ kind: 'addFlag', flag: 'marsh-camp-raided', amount: 1 }] },
  },
  ambush: {
    id: 'ambush', kind: 'check', skill: 'perception', dc: 13, roller: 'group', art: { emoji: '⛰️' },
    intro: ['The hollow opens below you, and the reeds in it are too still, and cold where the marsh should be warm. Nothing moves. Something out there is lying flat in the water, waiting for you to come closer.'],
    again: ['You come back to the lip of the hollow. The reeds below are still too still, and too cold. Something out there is waiting for you again.'],
    // The perception check only sets the terms (surprise). The hollow ambush is
    // the one route to the den (approach needs trail-read from the tracks), so
    // it never gets skipped.
    success: { to: 'ambush-turned', text: ['You catch the gleam of an eye among the reeds a breath before it moves. The trap is yours to spring.'] },
    failure: { to: 'ambush-sprung', text: ['A hiss, a ripple — and the reeds come alive all at once. Too late.'] },
  },
  // The wet way in (a failed read at the tracks): no chance to spot them.
  'ambush-wet': {
    id: 'ambush-wet', kind: 'story', noBack: true, art: { imageId: 'loc-marsh', emoji: '⛰️' },
    text: [
      'You come up out of the sinkholes on the wrong side of the hollow, soaked to the waist. Every step sucks and splashes.',
      'The reeds ahead are too still, and cold where the marsh should be warm. You see it a moment too late. Anything lying in that water heard you coming a long way off.',
    ],
    next: [{ id: 'on', label: 'Draw steel', to: 'ambush-sprung' }],
  },
  // Wren's one trick on the marsh road: she reads the reeds before anyone rolls.
  'ambush-wren': {
    id: 'ambush-wren', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🧭' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: [
      'At the lip of the hollow {wren} puts out an arm and stops you. She watches the reeds below for a long time.',
      '"Too still," she says. "And cold. The marsh is never cold at noon." She points once, twice, three times. "Lizardfolk, lying in the water. And something big behind them, a toad, I think. They think we\'ll come down the dry line. So we won\'t."',
    ],
    next: [{ id: 'wren', label: 'Follow {wren} round behind them', to: 'ambush-turned',
      requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true }],
  },
  'ambush-turned': {
    id: 'ambush-turned', kind: 'battle', encounterId: 'hag-thralls', mapId: 'bog',
    surprise: 'enemies', // you spotted them — they lose the first round
    intro: ['You strike first. Scaled backs rise out of the water where they lay, a hunting-party of **lizardfolk** with a monstrous toad lumbering behind them like a herded ox. For a heartbeat, not one of them sees you.'],
    again: ['You strike first again. The lizardfolk are back in the water with their toad behind them, and once more they are watching the wrong way.'],
    onWin: { to: 'hollow-won', text: ['The lizardfolk sink back into the dark water they came from, one by one.'] },
  },
  'ambush-sprung': {
    id: 'ambush-sprung', kind: 'battle', encounterId: 'hag-thralls', mapId: 'bog',
    surprise: 'party', // the check failed — they get the drop on you
    intro: ['The reeds burst apart around you, and scaled shapes rush in with hooked spears, a giant toad heaving up through the muck behind them. They move together, too well, as if one hand worked them all.'],
    again: ['The reeds erupt around you again. The lizardfolk and their toad have been waiting for you to come back.'],
    onWin: { to: 'hollow-won', text: ['Bloodied, you break them at last. The last of the lizardfolk drags itself into the water and does not come up.'] },
  },
  // The reveal beat: the lizardfolk didn't choose the raiders — something in the
  // marsh owns them, and now you know its name.
  'hollow-won': {
    id: 'hollow-won', kind: 'story', noBack: true, art: { imageId: 'loc-marsh', emoji: '🐍' },
    text: [
      'You turn the nearest body with your boot. Branded into the scaled hide, still weeping, is a crude mark of reeds and a reaching hand. Someone *owned* these, and marked them like cattle.',
      'A voice drifts across the water, old and wet and amused. "My little dogs, off their leash. No matter, sweetlings. The reed-cutters call me the **{reedwife}**. Ask your chief what he sold me. Ask him what I paid."',
      '"Come up to the fire, if you can find it. The chief and I will be waiting." The reeds shiver, and go quiet.',
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} has gone white. "A green hag," she says. "My gran had a story about one. I thought it was a story."' },
    ],
    next: [{ id: 'ok', label: 'On to the den', to: 'gate',
      requires: [{ kind: 'noCompanion', companion: 'wren' }], hideWhenBlocked: true,
      effects: HOLLOW_PASSED },
    { id: 'wren', label: 'On to the den', to: 'wren-parts',
      requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true,
      effects: HOLLOW_PASSED }],
  },

  // === ACT 3 — THE ASHFANG DEN (dungeon) ================================
  gate: {
    id: 'gate', kind: 'story', back: true, art: { imageId: 'loc-camp', emoji: '🏚️' },
    text: ['A wall of lashed timber rings the hollow, with a watch-post looming over its only gate. Somewhere beyond it, the chief is waiting.'],
    // `den-entered` is set by every way in (a failed roll clears it again on
    // the way to the gate fight), so a return trip only offers the way back in.
    next: [
      { id: 'back', label: 'Slip back in the way you left', to: 'inner',
        requires: [{ kind: 'flag', flag: 'den-entered' }], hideWhenBlocked: true },
      { id: 'signal', label: '[Deception DC 10] Call the stolen gate-signal up to the post', to: 'den-slipped',
        requires: [{ kind: 'flag', flag: 'know-signal' }, { kind: 'notFlag', flag: 'den-entered' }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'den-entered' }, SIGNAL_SPENT],
        check: { skill: 'deception', dc: 10, failTo: 'gate-signal-blown', failEffects: [{ kind: 'clearFlag', flag: 'den-entered' }] } },
      // A rogue's bonus: the water-gate's cheap lock, an easy roll and no
      // alarm. One try: a snapped pick leaves the other ways in.
      { id: 'lock', label: '[Rogue · Sleight of Hand DC 10] Pick the lock on the little water-gate', to: 'den-picked',
        requires: [{ kind: 'classInParty', classId: 'rogue' }, { kind: 'notFlag', flag: 'den-entered' }], hideWhenBlocked: true,
        once: true, effects: [{ kind: 'setFlag', flag: 'den-entered' }],
        check: { skill: 'sleight-of-hand', dc: 10, failTo: 'den-lock-jammed', failEffects: [{ kind: 'clearFlag', flag: 'den-entered' }] } },
      { id: 'sneak', label: '[Stealth DC 13] Slip over the wall together', to: 'den-slipped',
        requires: [{ kind: 'notFlag', flag: 'den-entered' }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'den-entered' }],
        check: { skill: 'stealth', dc: 13, roller: 'group', failTo: 'gate-caught', failEffects: [{ kind: 'clearFlag', flag: 'den-entered' }] } },
      { id: 'fight', label: 'Storm the gate', to: 'gate-fight',
        requires: [{ kind: 'notFlag', flag: 'den-entered' }], hideWhenBlocked: true },
    ],
  },
  'den-lock-jammed': {
    id: 'den-lock-jammed', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🗝️' },
    text: ['Down where the wall meets the marsh, a little gate lets the den draw water. Its lock is cheap and rusted, and your pick snaps off inside it. No one on the wall hears, but that gate will not open now, for anyone.'],
    next: [{ id: 'back', label: 'Back to the main gate', to: 'gate' }],
  },
  'den-picked': {
    id: 'den-picked', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗝️' },
    text: ['Down where the wall meets the marsh, a little gate lets the den draw water. Its lock is cheap and rusted. It takes your rogue about as long as a sneeze, and makes less noise.'],
    next: [{ id: 'in', label: 'Slip inside', to: 'inner', effects: GATE_PASSED }], noBack: true,
  },
  // In by the signal or over the wall: past the gate's enforcers without a
  // blow, which earns what beating them would have.
  'den-slipped': {
    id: 'den-slipped', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '🤫' },
    text: ['You are inside the wall, and no horn has sounded. Up in the gateway the bugbear scratches himself and watches the marsh, his back to you. The gnolls are asleep in a heap by the fire.'],
    next: [{ id: 'in', label: 'Into the den', to: 'inner', effects: GATE_PASSED }],
  },
  'gate-fight': {
    id: 'gate-fight', kind: 'battle', encounterId: 'den-gate', mapId: 'corridor',
    intro: ['A horn brays from the watch-post, and the gate-runners answer. A hulking bugbear ducks through the gateway. Behind him two gnolls come yammering their high, laughing bark. The narrow timber run hems all three in.'],
    again: ['The watch-post saw you coming this time. The bugbear already fills the gateway, and the two gnolls yammer their high, laughing bark behind him.'],
    onWin: { to: 'inner', text: ['The bugbear goes down last, folding across the gateway. The path in is open.'],
      effects: [{ kind: 'setFlag', flag: 'den-entered' }, SIGNAL_SPENT] },
    parley: {
      skill: 'deception', dc: 15, label: 'Pass yourselves off as new blood',
      refused: ['The bugbear sniffs you, slow and thorough. "Chief sent for nobody," he rumbles. "Chief never sends for anybody." Behind him the gnolls laugh harder.'],
      success: { to: 'inner', text: ['"Chief sent for fighters," you growl, and shoulder past the horn like you own the place. The bugbear sniffs you, weighs you, and decides you are someone else\'s problem. The gnolls fall in laughing behind you, and the den stays asleep.'],
        effects: [{ kind: 'setFlag', flag: 'den-entered' }, ...GATE_PASSED] },
    },
  },
  // The stolen signal, called wrong: the watch knows it has been sold. The
  // party lies up in the reeds until the den settles, and the signal is gone.
  'gate-signal-blown': {
    id: 'gate-signal-blown', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '📯' },
    text: [
      'The watch-post goes quiet, and a voice calls down a countersign you never learned. Somebody up there knows that someone sold the gate-signal.',
      'A horn brays, and torches run along the wall. You fall back into the reeds and lie in the mud while the watch hunts the hollow. It takes all night and most of the next day before the den settles. By then the watch has a new signal, and you do not know it.',
    ],
    next: [{ id: 'back', label: 'Crawl back up to the gate', to: 'gate',
      effects: [{ kind: 'passDay' }, { kind: 'clearFlag', flag: 'know-signal' },
        { kind: 'journal', entry: { id: 'c-signal-burned', kind: 'clue', title: 'The Gate-Signal Is Burned',
          body: 'The den\'s watch knew someone sold the gate-signal, and they changed it. You will need another way past the gate: over the wall, or through it.' } }] }],
  },
  // Caught on the wall: the gate-runners are waiting at the bottom of it.
  'gate-caught': {
    id: 'gate-caught', kind: 'battle', encounterId: 'den-gate', mapId: 'corridor',
    surprise: 'party',
    intro: ['Halfway over the wall, a stake shifts under a boot and cracks. A horn brays right above your heads. When you drop down inside, the bugbear and two gnolls are already waiting at the foot of the wall.'],
    onWin: { to: 'inner', text: ['The bugbear goes down last, face-first in the mud at the foot of the wall. The path in is open.'],
      effects: [{ kind: 'setFlag', flag: 'den-entered' }, SIGNAL_SPENT] },
  },
  // The den as a dungeon: rooms and links, laid out by the game. The spine is
  // forced — yard → pit → Vex's fire → the chief's hall — so every party
  // crosses the pit-brute and meets Vex before the throne. The kennels and the
  // plunder tent hang off the yard; the tent is barred, and the kennel-master
  // keeps its key. The gate is the way back out to the marsh road.
  inner: {
    id: 'inner', kind: 'dungeon',
    dungeon: {
      title: 'The {ashfang} Den', theme: 'ember', art: { imageId: 'loc-camp', emoji: '🔥' },
      // Hostile ground, but you can bank a fire in a cleared corner and chance
      // a rest — the watch may stumble on you (no recovery if they do).
      // Enemy ground: two nights' sleep in the den in the chapter, then only short rests.
      camp: { nights: 2, risky: { chance: 0.35, battleScene: 'den-camp-ambush' } },
      entry: 'gate',
      rooms: [
        { id: 'gate', name: 'Gate', size: 'small', exit: { to: 'trail', label: 'Out to the marsh road' } },
        { id: 'yard', name: 'Muster Yard', size: 'large',
          firstVisit: ['Inside the wall the den sprawls around a central fire-pit: tents, drying-racks, and the reek of a place that has never been clean. Ahead, a staked ring of trampled mud — **the pit** — where a chained shape heaves against its irons.'] },
        { id: 'kennel', name: 'Kennels', fight: 'den-hyenas' },
        // What the hag is paid in: the captives, penned behind the kennels.
        { id: 'pens', name: 'The Pens', size: 'small', event: { scene: 'den-pens-door' } },
        { id: 'cache', name: 'Plunder Tent', size: 'small', search: 'cache' },
        { id: 'muster', name: 'The Pit', fight: 'den-muster' },
        { id: 'vex', name: 'A Lone Fire', size: 'small',
          event: { scene: 'vex-parley', until: [{ kind: 'npc', npc: 'vex', met: true }] } },
        // Whatever becomes of {vargan} here, the company leaves the den for good.
        { id: 'throne', name: 'The Chief\'s Hall', size: 'large', goal: true,
          event: { scene: 'boss-approach', until: [{ kind: 'npc', npc: 'reedwife', fate: 'dead' }] } },
      ],
      links: [
        { a: 'gate', b: 'yard' },
        { a: 'yard', b: 'kennel' },
        { a: 'kennel', b: 'pens' },
        { a: 'yard', b: 'cache', door: {
          locked: [{ kind: 'flag', flag: 'kennel-cleared' }],
          note: 'Barred from inside — the kennel-master keeps the key.',
          force: { skill: 'athletics', dc: 15 } } },
        { a: 'yard', b: 'muster' },
        { a: 'muster', b: 'vex' },
        { a: 'vex', b: 'throne' },
      ],
    },
  },
  'den-muster': {
    id: 'den-muster', kind: 'battle', encounterId: 'den-muster', mapId: 'ruins',
    intro: [
      'The chained shape in the pit stands up, and keeps standing up: an **ogre**, half-starved, whip-scarred and beside itself with rage. Two orc goaders work its temper with barbed poles, and when they see you they grin and haul the pins.',
      '"Fresh meat for the pit!" one bellows, and slips the ogre\'s chain.',
    ],
    again: ['The ogre is off its chain now, and it is not going back on. The two orc goaders whoop and drive it at you with their barbed poles.'],
    onWin: { to: 'inner', text: ['The ogre crashes down across its own broken chains, and the goaders don\'t outlive it by much. Its collar has worn a groove in its neck as deep as a thumb.'],
      effects: [{ kind: 'gold', amount: 25 }] },
  },
  'den-camp-ambush': {
    id: 'den-camp-ambush', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'raiders-forward', mapId: '@room',
    intro: ['You\'ve barely banked the fire when a watch-patrol rounds the tents: an orc, an archer and a bandit, blinking in the light. The bandit finds his voice first and starts to shout.'],
    again: ['Another patrol. They come round the drying-racks this time, three of them, and they have their blades out before they reach the fire.'],
    onWin: { to: '@hub', text: ['You put the patrol down before the whole den wakes, and kick dirt over the fire. Across the yard a dog starts barking, and you are on your feet and moving before it stops.'] },
  },
  // The clock (see DAWNS): the Reedwife takes her due when the moon goes
  // dark. Until then the pen holds people; after, it holds a shoe.
  'den-pens-door': {
    id: 'den-pens-door', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '⛓️' },
    text: ['Behind the kennels stands a pen of lashed stakes, the kind a farmer keeps pigs in. Something in the straw shifts as your torch comes near.'],
    next: [
      { id: 'look', label: 'Look in the pen', to: 'den-pens', hideWhenBlocked: true,
        requires: [{ kind: 'notFlag', flag: 'captives-taken' }], effects: [{ kind: 'setFlag', flag: 'pens-found' }, { kind: 'setFlag', flag: 'pens-settled' }] },
      { id: 'look-late', label: 'Look in the pen', to: 'den-pens-empty', hideWhenBlocked: true,
        requires: [{ kind: 'flag', flag: 'captives-taken' }], effects: [{ kind: 'setFlag', flag: 'pens-found' }, { kind: 'setFlag', flag: 'pens-settled' }] },
    ],
  },
  'den-pens-empty': {
    id: 'den-pens-empty', kind: 'story', noBack: true, art: { imageId: 'loc-camp', emoji: '⛓️' },
    assumes: [{ kind: 'flag', flag: 'captives-taken' }],
    text: [
      'There are no pigs in the pen, and no people. It was only a rat in the straw. The chain hangs open, and wet, webbed footprints lead from the gate toward the marsh. None lead back.',
      'The moon has gone dark, and the {reedwife} has come and gone. In the corner lies one small shoe.',
    ],
    next: [{ id: 'ok', label: 'Back to the den', to: 'inner' }],
  },
  'den-pens': {
    id: 'den-pens', kind: 'story', art: { imageId: 'loc-camp', emoji: '⛓️' },
    assumes: [{ kind: 'notFlag', flag: 'captives-taken' }],
    text: [
      'There are no pigs. A grey-bearded carter, two reed-cutters and a girl of about seven blink up at your torch.',
      'The girl has one shoe, on her right foot. "They said the lady in the water comes for us when the moon goes dark," the carter whispers. "My gran gave her one {door-price} each {door-midwinter}, and that was all she ever asked. Now the chief feeds her people." He swallows. "Are you the reeve\'s men?"',
      'A chain and a heavy padlock hold the pen shut. Across the yard, a raider dozes by the fire with his spear across his lap.',
    ],
    // Freeing them is never free: a quiet lock that may fail, or a loud one
    // that brings the watch. Leaving them is final (the event plays once).
    next: [
      { id: 'pick', label: '[Sleight of Hand DC 13] Work the padlock open quietly', to: 'den-pens-freed',
        once: true, check: { skill: 'sleight-of-hand', dc: 13, failTo: 'pens-alarm' } },
      { id: 'hack', label: 'Hack through the stakes, and never mind the noise', to: 'pens-alarm' },
      // Wren hears of it either way: she rounds up the Ashfang after, and
      // the reeve's men find the pens (her `attitude`, read in Parts 2–3).
      { id: 'leave', label: 'Leave them for the reeve\'s men', to: 'den-pens-left',
        effects: [{ kind: 'setFlag', flag: 'captives-left' }, { kind: 'npc', npc: 'wren', attitude: -1 }] },
    ],
    noBack: true,
  },
  'pens-alarm': {
    id: 'pens-alarm', kind: 'battle', encounterId: 'raiders', mapId: 'ruins',
    // The price of the captives: a hard fight with nothing in its pockets.
    loot: false,
    intro: ['The noise carries. The raider by the fire jumps up and yells, and the den\'s watch comes running with him. Two orcs, two archers and a bandit spread out in front of the pen. The carter pulls the girl down into the straw.'],
    onWin: { to: 'den-pens-freed', text: ['The last raider falls against the stakes, and no one else comes. In a den this loud, one more fight in the dark is nothing new.'] },
    // The pens are played once: there is no coming back to them, so the fight
    // is seen through, and losing it loses the captives.
    noFlee: true,
    onLoss: { to: 'inner', text: ['You go down in the mud in front of the pen, and come to in the straw of the pen itself, left for dead. The gate stands open and the captives are gone. Their tracks lead out toward the deep fen.'],
      effects: [{ kind: 'setFlag', flag: 'captives-taken' }] },
  },
  'den-pens-freed': {
    id: 'den-pens-freed', kind: 'story', art: { imageId: 'loc-camp', emoji: '⛓️' },
    text: ['The pen comes open. The carter lifts the girl onto his back, and the reed-cutters take a kennel-pole each. They slip off toward the gate and the dark of the marsh road, not making a sound.'],
    next: [{ id: 'ok', label: 'Back to the den', to: 'inner',
      effects: [{ kind: 'setFlag', flag: 'captives-freed' }, { kind: 'npc', npc: 'wren', attitude: 1 }] }], noBack: true,
  },
  'den-pens-left': {
    id: 'den-pens-left', kind: 'story', art: { imageId: 'loc-camp', emoji: '⛓️' },
    text: ['"The reeve\'s men will come," you tell them. The carter nods slowly and says nothing. The girl watches you go, holding her one shoe in both hands.'],
    next: [{ id: 'ok', label: 'Back to the den', to: 'inner' }], noBack: true,
  },
  'den-hyenas': {
    id: 'den-hyenas', kind: 'battle', encounterId: 'kennel-hyenas', mapId: '@room',
    intro: ['Two giant hyenas lunge to the ends of their chains at the sight of you. The {ashfang} raider who keeps them yanks the pins and runs. The hyenas come loose in a scrabble of claws and yelping.'],
    again: ['The two giant hyenas are loose in the kennels now. Their keeper is long gone, and they come for you at once.'],
    onWin: { to: 'inner', text: ['The kennel falls quiet. In the straw you find a raider\'s stashed purse and a satchel worth the trouble. By the gate lies the key ring their keeper dropped as he ran. One key fits the plunder tent.'],
      effects: [{ kind: 'setFlag', flag: 'kennel-cleared' }, { kind: 'gold', amount: 30 }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 }] },
  },
  cache: {
    id: 'cache', kind: 'check', skill: 'investigation', dc: 12, art: { emoji: '📦' },
    intro: ['A tent of stolen goods, heaped anyhow. A careful search turns up the best of it.'],
    success: { to: 'inner', text: ['Beneath the junk you find real coin and a caravan\'s lost potion. Stuffed in a sack at the bottom is the **{ashfang} banner** itself. The reeve will pay extra for that.'],
      effects: [{ kind: 'gold', amount: 80 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }, { kind: 'setFlag', flag: 'looted' }] },
    failure: { to: 'inner', text: ['You grab what\'s in reach before the noise draws eyes.'],
      effects: [{ kind: 'gold', amount: 25 }] },
  },
  'vex-parley': {
    // One-way: whatever the party says (or doesn't), Vex has met them.
    id: 'vex-parley', kind: 'dialogue', noBack: true, npc: LIEUTENANT, art: { emoji: '🗡️' },
    lines: [
      'At the lone fire a lean, grey-templed raider watches you come. A bare blade lies across his knees. He holds it as if he would rather be leaning on it.',
      '"**{vex}**," he says. "The chief\'s lieutenant, for my sins. He keeps an ogre in a pit for people like you. For me he keeps a knife he thinks I haven\'t seen." A thin smile, gone as fast. "So what do you offer a man for stepping aside?"',
      // Every winning route passes his fire before the hall, so no company
      // misses the pen by not knowing it is there (it drives a Part 3 war
      // asset and the epilogue's slide). Text only, so free to the search.
      // The lead (PENS_LEAD) goes in the journal whatever the party says, if
      // the pen is still unsettled (VEX_OFFERS).
      { if: [{ kind: 'notFlag', flag: 'pens-found' }, { kind: 'notFlag', flag: 'captives-taken' }],
        text: 'Before you can answer, he tips his head back toward the kennels. "One thing for nothing. There\'s a pen behind the dogs, with people in it. A carter and a little girl, among others. The chief keeps them for the lady in the water." He looks into his fire. "I never had the stomach to open it. You might."' },
      { if: [{ kind: 'notFlag', flag: 'pens-found' }, { kind: 'flag', flag: 'captives-taken' }],
        text: 'Before you can answer, he tips his head back toward the kennels. "There was a pen behind the dogs, with people in it. The lady in the water came for them when the moon went dark." He looks into his fire. "Go and look, if you want to know what the chief sold."' },
    ],
    next: [...VEX_OFFERS(true), ...VEX_OFFERS(false)],
  },
  'vex-turned': {
    id: 'vex-turned', kind: 'story', noBack: true, art: { emoji: '🤝' },
    text: ['{vex} weighs it, then slides the blade home. "A road out of this valley, then. I\'ll take it before the reeve\'s men take it from me."', '"{hask} guards the chief, and {hask} answers to me. He\'ll find somewhere else to be — this once." He steps back into the smoke, unhurried. "Do it properly. I\'m tired of soldiering for a man who burns barns and calls it strategy."'],
    // Hask standing aside is one blade fewer at the chief's side: the company
    // earns what beating him would have.
    next: [{ id: 'ok', label: 'On to the chief', to: 'inner',
      effects: [{ kind: 'npc', npc: 'vex', met: true, fate: 'turned' },
        { kind: 'xp', amount: avoidedFightXP('ashfang-hall') - avoidedFightXP('ashfang-warlord-alone') },
        { kind: 'journal', entry: { id: 'n-vex', kind: 'npc', title: '{vex}, Turned', body: '{vex} the lieutenant took your offer of a way out of the valley. {hask}, the chief\'s guard, answers to {vex}. He will stand aside when you face the chief, this once. After that, {vex} means to be gone.' } }] }],
  },
  'vex-refuses': {
    id: 'vex-refuses', kind: 'story', noBack: true, art: { emoji: '💢' },
    text: [
      '{vex} studies you a long moment, then shakes his head, almost sorry about it. "No. You\'d hang me the morning after, and we both know it."',
      '"Pity. I\'d have liked to see the far end of this valley." He melts back into the dark, toward the ridge above the den.',
    ],
    next: [{ id: 'ok', label: 'Leave him to the dark', to: 'inner', effects: [{ kind: 'npc', npc: 'vex', met: true, fate: 'refused' }] }],
  },
  'vex-dismissed': {
    id: 'vex-dismissed', kind: 'story', noBack: true, art: { emoji: '🗡️' },
    text: ['"Suit yourself." {vex} turns back to his fire. "I won\'t help you. I won\'t get in your way, either."'],
    next: [{ id: 'ok', label: 'Leave him to his fire', to: 'inner', effects: [{ kind: 'npc', npc: 'vex', met: true, fate: 'rebuffed' }] }],
  },
  // The read missed: his hand stays wrapped, and the talk is the harder one.
  'vargan-unread': {
    id: 'vargan-unread', kind: 'story', noBack: true, art: { imageId: 'loc-throne', emoji: '👑' },
    assumes: [{ kind: 'notFlag', flag: 'vargan-shaken' }],
    text: ['His axe hand stays wrapped in its rag, and his face gives you nothing at all. Behind the throne the hag watches you look, and smiles.'],
    next: [
      ...turnUnread([]),
      { id: 'fight', label: 'End them both', to: 'boss',
        requires: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }], hideWhenBlocked: true },
      { id: 'fight-alone', label: 'End them both. {hask} stands aside', to: 'boss-unguarded',
        requires: [{ kind: 'npc', npc: 'vex', fate: 'turned' }], hideWhenBlocked: true },
    ],
  },
  'boss-approach': {
    id: 'boss-approach', kind: 'story', art: { imageId: 'loc-throne', emoji: '👑' },
    // The first meeting plays once; a party back from falling back or a wipe
    // gets `again`, a short return.
    text: [
      'The chief\'s hall reeks of smoke and old blood. Trophies of a hundred raids hang from the rafters: a miller\'s ledger, a carter\'s whip, and a child\'s left shoe, small and still muddy.',
      'The **{ashfang} chief** sits on a throne of lashed spears, a rag wound round his axe hand. In the shadows behind the throne something else unfolds — long and green and grinning, river-weed in its hair, fingers too many and too long. The **{reedwife}**, the green hag of the marsh, come up out of her water to see what her coin has bought.',
      '"Up, **{vargan}**, my sweet," the hag says. "Guests." The chief rises.',
      '"I was born down in {thornwick}," {vargan} says. "I cut reeds on that marsh for a copper a bundle, same as my father. The spring I was a boy, she raised the water, and my mother\'s house went under first. {thornwick} watched from the bank." He looks up at his trophies the way a farmer looks at a full barn. "The shallows were still common water. So this spring I came home and sold them to her. She paid me in monsters, and a valley to run. Fair price."',
      // The jailer, planted where every winning route walks: a line that
      // reads as a hag's grumble now and as the whole story in Part 2.
      'The hag laughs. "Fairer than the fen ever paid me. One {door-price} a winter, for sitting by their door in the dark." She turns to you, delighted. "You\'ve been *busy*." At a flick of her hand, she calls for the chief\'s guard. For a heartbeat the whole hall waits to see what you\'ll do.',
    ],
    again: [
      'The chief\'s hall still reeks of smoke and old blood, and the child\'s shoe still hangs from the rafters.',
      '**{vargan}** is back on his throne of spears, and the **{reedwife}** waits in the shadows behind it. "Back for more," the hag says, delighted. "Waste not." {vargan} only rolls the great axe off his shoulder.',
      { if: [{ kind: 'flag', flag: 'vargan-shaken' }],
        text: 'He keeps his branded hand shut in a fist. His eyes keep going back to it.' },
    ],
    next: [
      // The talk with Vargan is always on offer (`turn`, one try however
      // it is reached). The read on him first (he wears the hag's brand too)
      // makes it easier, and a fight he starts a round behind; a missed read
      // (`vargan-unread`) leaves the harder talk and the plain fight. Every
      // copy splits on Vex's bargain, so each lands in the right hall.
      { id: 'insight', label: '[Insight DC 14] Look at his hands', to: 'vargan-brand', attempt: 'brand',
        requires: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'vargan-shaken' }],
        check: { skill: 'insight', dc: 14, failTo: 'vargan-unread', failEffects: [{ kind: 'clearFlag', flag: 'vargan-shaken' }] } },
      { id: 'insight-alone', label: '[Insight DC 14] Look at his hands', to: 'vargan-brand-alone', attempt: 'brand',
        requires: [{ kind: 'npc', npc: 'vex', fate: 'turned' }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'vargan-shaken' }],
        check: { skill: 'insight', dc: 14, failTo: 'vargan-unread', failEffects: [{ kind: 'clearFlag', flag: 'vargan-shaken' }] } },
      // A warlock knows a pact-mark when one sees it: the brand, named on an
      // easier roll.
      { id: 'pact', label: '[Warlock · Arcana DC 11] Name the bargain burned into his hand', to: 'vargan-brand', attempt: 'brand',
        requires: [{ kind: 'classInParty', classId: 'warlock' }, { kind: 'npc', npc: 'vex', notFate: ['turned'] }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'vargan-shaken' }],
        check: { skill: 'arcana', dc: 11, failTo: 'vargan-unread', failEffects: [{ kind: 'clearFlag', flag: 'vargan-shaken' }] } },
      { id: 'pact-alone', label: '[Warlock · Arcana DC 11] Name the bargain burned into his hand', to: 'vargan-brand-alone', attempt: 'brand',
        requires: [{ kind: 'classInParty', classId: 'warlock' }, { kind: 'npc', npc: 'vex', fate: 'turned' }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'vargan-shaken' }],
        check: { skill: 'arcana', dc: 11, failTo: 'vargan-unread', failEffects: [{ kind: 'clearFlag', flag: 'vargan-shaken' }] } },
      ...turnUnread([{ kind: 'notFlag', flag: 'vargan-shaken' }]),
      // Back after a wipe with the brand named and the talk not yet tried.
      { id: 'turn-shaken', label: TURN_READ_LABEL, to: 'vargan-turns', attempt: 'turn',
        requires: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }, { kind: 'flag', flag: 'vargan-shaken' }], hideWhenBlocked: true,
        check: { skill: 'persuasion', dc: 10, failTo: 'boss-shaken' } },
      { id: 'turn-shaken-alone', label: TURN_READ_LABEL, to: 'vargan-turns-alone', attempt: 'turn',
        requires: [{ kind: 'npc', npc: 'vex', fate: 'turned' }, { kind: 'flag', flag: 'vargan-shaken' }], hideWhenBlocked: true,
        check: { skill: 'persuasion', dc: 10, failTo: 'boss-unguarded-shaken' } },
      // Vex's bargain pays off here: his guard stands down, and the chief and
      // the hag fight alone. The two choices are mutually exclusive on the flag.
      // Back after a wipe with the brand already named (`vargan-shaken`): he
      // still starts the fight a round behind.
      { id: 'fight-alone', label: 'End them both. {hask} stands aside', to: 'boss-unguarded',
        requires: [{ kind: 'npc', npc: 'vex', fate: 'turned' }, { kind: 'notFlag', flag: 'vargan-shaken' }], hideWhenBlocked: true },
      { id: 'fight-alone-shaken', label: 'End them both. {hask} stands aside', to: 'boss-unguarded-shaken',
        requires: [{ kind: 'npc', npc: 'vex', fate: 'turned' }, { kind: 'flag', flag: 'vargan-shaken' }], hideWhenBlocked: true },
      { id: 'fight', label: 'End them both', to: 'boss',
        requires: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }, { kind: 'notFlag', flag: 'vargan-shaken' }], hideWhenBlocked: true },
      { id: 'fight-shaken', label: 'End them both', to: 'boss-shaken',
        requires: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }, { kind: 'flag', flag: 'vargan-shaken' }], hideWhenBlocked: true },
    ],
  },
  boss: {
    id: 'boss', kind: 'battle', encounterId: 'ashfang-hall', mapId: 'firepit',
    intro: ['"You\'ve cost me a good season," the chief says, almost mild, and rolls the great axe off his shoulder. Beside him the hag only laughs, low and pleased, her fingers already weaving something cold out of the smoke. "Oh, don\'t kill them quickly," she tells him. "Waste not."',
      'The chief\'s guard answers her call from the door. He is a grey, scarred soldier, and the only one in the hall who looks as if he has done this before. He comes for you without a word.'],
    again: ['The hag\'s fingers are already weaving something cold out of the smoke. "Don\'t kill them quickly this time," she tells the chief. His grey old guard is back at his shoulder.'],
    loot: { bonusTier: 'rare' }, // a warlord's hoard + a hag's trophies — guaranteed drop
    onWin: { to: 'vargan-beaten', text: [BOSS_FALLS], effects: BOSS_WON },
  },
  // The same hall with Vargan's brand named: he loses the first round.
  'boss-shaken': {
    id: 'boss-shaken', kind: 'battle', encounterId: 'ashfang-hall', mapId: 'firepit',
    surprise: 'enemies',
    intro: [
      { assumes: [{ kind: 'flag', flag: 'vargan-shaken' }], text: '{vargan} closes his fist over the brand and looks at it a moment too long. Behind him the hag says nothing at all. By then you are already moving.' },
      'By the door, the chief\'s guard, a grey and scarred old soldier, is still reaching for his weapon.',
    ],
    again: [{ assumes: [{ kind: 'flag', flag: 'vargan-shaken' }], text: '{vargan}\'s eyes go to his shut fist again. Behind him the hag says nothing. By then you are already moving.' }],
    loot: { bonusTier: 'rare' },
    onWin: { to: 'vargan-beaten', text: [`{vargan} fights with one eye on his own shut fist. ${BOSS_FALLS}`], effects: BOSS_WON },
  },
  // The same hall with Vex's word kept: his guard finds somewhere else to be.
  'boss-unguarded': {
    id: 'boss-unguarded', kind: 'battle', encounterId: 'ashfang-warlord-alone', mapId: 'firepit',
    intro: [
      { assumes: [{ kind: 'npc', npc: 'vex', fate: 'turned' }],
        text: 'The chief bellows for {hask}, his guard. {hask} stands by the door with his spear grounded. He looks at the chief, then at you, and steps aside to let you pass before he walks out into the smoke. {vex} has kept his word.' },
      '"You\'ve cost me a good season," he says anyway, almost mild, and rolls the great axe off his shoulder. The hag goes quiet. Her eyes flick to the doorway, counting the blades that didn\'t come.',
    ],
    again: [{ assumes: [{ kind: 'npc', npc: 'vex', fate: 'turned' }], text: '{hask} is nowhere in the hall. {vex}\'s word still holds.' }, '{vargan} rolls the great axe off his shoulder again. The hag watches the doorway, still counting the blades that didn\'t come.'],
    loot: { bonusTier: 'rare' },
    onWin: { to: 'vargan-beaten', text: [BOSS_FALLS], effects: BOSS_WON },
  },
  // Vex's guard gone *and* the brand named.
  'boss-unguarded-shaken': {
    id: 'boss-unguarded-shaken', kind: 'battle', encounterId: 'ashfang-warlord-alone', mapId: 'firepit',
    surprise: 'enemies',
    intro: [
      { assumes: [{ kind: 'npc', npc: 'vex', fate: 'turned' }, { kind: 'flag', flag: 'vargan-shaken' }],
        text: '{vargan} closes his fist over the brand and bellows for {hask}. By the door, {hask} grounds his spear, steps aside to let you pass, and walks out into the smoke.' },
      '"Waste not," the hag hisses, but by then you are already moving.',
    ],
    again: [{ assumes: [{ kind: 'npc', npc: 'vex', fate: 'turned' }, { kind: 'flag', flag: 'vargan-shaken' }], text: '{hask} is still gone, and {vargan} still keeps his branded hand shut in a fist.' }, '"Waste not," the hag hisses, but by then you are already moving.'],
    loot: { bonusTier: 'rare' },
    onWin: { to: 'vargan-beaten', text: [`{vargan} fights with one eye on his own shut fist. ${BOSS_FALLS}`], effects: BOSS_WON },
  },

  // The brand named: Vargan sees what he sold himself for, and the talk comes
  // easier; a miss (or striking now) is the fight he starts behind.
  // Two copies, split on Vex's bargain like every version of the hall.
  'vargan-brand': {
    id: 'vargan-brand', kind: 'story', noBack: true, art: { imageId: 'loc-throne', emoji: '✋' },
    text: VARGAN_BRAND,
    next: [
      { id: 'turn', label: TURN_READ_LABEL, to: 'vargan-turns', attempt: 'turn',
        check: { skill: 'persuasion', dc: 10, failTo: 'boss-shaken' } },
      { id: 'strike', label: 'Strike while he stares', to: 'boss-shaken' },
    ],
  },
  'vargan-brand-alone': {
    id: 'vargan-brand-alone', kind: 'story', noBack: true, art: { imageId: 'loc-throne', emoji: '✋' },
    text: VARGAN_BRAND,
    next: [
      { id: 'turn', label: TURN_READ_LABEL, to: 'vargan-turns-alone', attempt: 'turn',
        check: { skill: 'persuasion', dc: 10, failTo: 'boss-unguarded-shaken' } },
      { id: 'strike', label: 'Strike while he stares', to: 'boss-unguarded-shaken' },
    ],
  },
  // Vargan turned: the hag burns him down with his own brand. The turn is its
  // own beat, so a party back from a wipe (`reedwife-lost`) does not watch him
  // turn twice: the fights after it open on the hag alone.
  'vargan-turns': {
    id: 'vargan-turns', kind: 'story', noBack: true, art: { imageId: 'loc-throne', emoji: '✋' },
    text: [...VARGAN_TURNS, 'The hag looks down at him for a moment before she turns to you, smiling.'],
    next: [{ id: 'fight', label: 'Face the {reedwife}', to: 'reedwife-fight' }],
  },
  'vargan-turns-alone': {
    id: 'vargan-turns-alone', kind: 'story', noBack: true, art: { imageId: 'loc-throne', emoji: '✋' },
    text: [...VARGAN_TURNS, 'The hag looks down at him for a moment before she turns to you, smiling.'],
    next: [{ id: 'fight', label: 'Face the {reedwife}', to: 'reedwife-fight-alone' }],
  },
  // The hag fights on without him, with the chief's guard and one more raider.
  'reedwife-fight': {
    id: 'reedwife-fight', kind: 'battle', encounterId: 'hag-guarded', mapId: 'firepit',
    // No falling back: the hall behind you is the one where Vargan turned.
    noFlee: true,
    loot: { bonusTier: 'rare' },
    intro: ['The **{reedwife}** stands by the fire-pit with river-weed dripping from her fingers. "Waste not," she says, and whistles for the chief\'s guard again. He comes out of the smoke at last, with another raider at his back.'],
    again: ['The {reedwife} is still by the fire-pit. "Up again, sweetlings?" She whistles, and the chief\'s guard comes back out of the smoke with his raider.'],
    onWin: { to: 'vargan-fate', text: [REEDWIFE_FALLS], effects: REEDWIFE_WON },
    onLoss: { to: 'reedwife-lost' },
  },
  // The same, with Hask gone: the two raiders she whistles in come late, and
  // lose their first round (`surprise`).
  'reedwife-fight-alone': {
    id: 'reedwife-fight-alone', kind: 'battle', encounterId: 'hag-coven', mapId: 'firepit',
    noFlee: true,
    surprise: 'enemies',
    loot: { bonusTier: 'rare' },
    intro: ['The **{reedwife}** stands by the fire-pit with river-weed dripping from her fingers. "Waste not," she says, and whistles for the chief\'s guard again. {hask} still does not come. Two raiders stumble in from the yard instead, still fumbling with their belts, and you are on them before they find their blades.'],
    again: ['The {reedwife} is still by the fire-pit. She whistles for {hask} once more, and he still does not come. Her two raiders stumble in from the yard, and you are on them before they find their blades.'],
    onWin: { to: 'vargan-fate', text: [REEDWIFE_FALLS], effects: REEDWIFE_WON },
    onLoss: { to: 'reedwife-lost-alone' },
  },
  // A short rest, not a night: Vargan's "Get up" is now, and no dawn (the
  // dark moon's included) can come while the hag waits by the fire.
  'reedwife-lost': {
    id: 'reedwife-lost', kind: 'rest', variant: 'short', next: 'reedwife-fight',
    intro: REEDWIFE_LOST,
  },
  'reedwife-lost-alone': {
    id: 'reedwife-lost-alone', kind: 'rest', variant: 'short', next: 'reedwife-fight-alone',
    intro: REEDWIFE_LOST,
  },
  // Won in the hall: the hag is dead and the chief is beaten, but breathing.
  // The same three roads as `vargan-fate`. Finishing a man on his knees is an
  // execution (`executed`) here too, and Mira and Wren hear of it the same way.
  'vargan-beaten': {
    id: 'vargan-beaten', kind: 'story', noBack: true, art: { imageId: 'loc-throne', emoji: '⚖️' },
    text: [
      '{vargan} is down on one knee in the ashes of the fire-pit, and his axe lies out of his reach. He is still breathing.',
      { if: [{ kind: 'flag', flag: 'vargan-shaken' }],
        text: 'The brand on his hand has gone grey, like an old scar. He looks at it, and not at you.' },
      { if: [{ kind: 'notFlag', flag: 'vargan-shaken' }],
        text: 'The rag has burned off his axe hand. Under it is a brand of reeds and a reaching hand, the mark the lizardfolk wore, gone grey like an old scar.' },
      '"Go on, then," he says. "{thornwick} will only hang me slower."',
    ],
    next: [
      ...BIND_VARGAN,
      { id: 'free', label: 'Let him crawl out into the marsh', to: 'aftermath',
        effects: [{ kind: 'npc', npc: 'vargan', fate: 'freed' }, { kind: 'setFlag', flag: 'got-bounty' }] },
      { id: 'end', label: 'End it here', to: 'aftermath',
        effects: [{ kind: 'npc', npc: 'vargan', fate: 'executed' }, { kind: 'npc', npc: 'wren', attitude: -1 }] },
    ],
  },
  // Turned on the hag: she is dead and the chief is alive. What becomes of
  // him is the company's call, and the reeve pays only for a chief he gets to see.
  'vargan-fate': {
    id: 'vargan-fate', kind: 'story', noBack: true, art: { imageId: 'loc-throne', emoji: '⚖️' },
    text: [
      '{vargan} sits against his throne of spears. The brand on his hand has gone grey, like an old scar. He does not reach for his axe.',
      '"{thornwick} will want me hanged," he says. "{thornwick} is right. I sold them to her for a full barn." He looks at the trophies in the rafters. "Do what you came to do."',
      { if: [{ kind: 'classInParty', classId: 'cleric' }],
        text: 'Your cleric kneels beside him and studies the grey brand. There is no prayer for this, and {vargan} does not ask for one.' },
    ],
    next: [
      ...BIND_VARGAN,
      // Mercy has a price: the reeve pays for a chief he gets to see, not one
      // the company let walk.
      { id: 'free', label: 'Let him walk out into the marsh', to: 'aftermath',
        effects: [{ kind: 'npc', npc: 'vargan', fate: 'freed' }, { kind: 'setFlag', flag: 'got-bounty' }] },
      // Executed is read only by text and the endings, so it is free.
      { id: 'end', label: 'End it here', to: 'aftermath',
        effects: [{ kind: 'npc', npc: 'vargan', fate: 'executed' }, { kind: 'npc', npc: 'wren', attitude: -1 }] },
    ],
  },

  // The reckoning: your earlier choices surface here as rewards you can (or
  // can't) claim — blocked options show *why*, so what you did back in the
  // village and the marsh visibly mattered.
  aftermath: {
    id: 'aftermath', kind: 'story', art: { imageId: 'loc-village', emoji: '🏘️' },
    text: [
      'You come back down the marsh road into a {thornwick} with every shutter in it thrown open. Word runs ahead of you; by the time you reach the square, the square is full.',
      // What became of Vargan, if the company turned him on the hag.
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'jailed' }],
        text: '{vargan} walks in front of you with his hands tied, and the crowd goes quiet to let him through. An old reed-cutter spits at his feet. {vargan} does not look up from the road.' },
      { if: [{ kind: 'npc', npc: 'vargan', notFate: ['freed'] }],
        text: 'The reeve is there too — stiff-backed, unsmiling, a strongbox under one arm. He does not thank you. He sets the strongbox on the well and opens it. "{thornwick} keeps its word," he says, as though daring you to make something of it.' },
      // Freed: he came to pay for a chief, and there is no chief (see below).
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'freed' }],
        text: 'The reeve is there too — stiff-backed, unsmiling, a strongbox under one arm. He sets it down on the well, and keeps his hand on the lid.' },
      // Mira's one near-smile is earned by more than the kill: the captives
      // out, the scout brought home, or the mill turning again.
      ...MIRA_WARM.map((when) => ({ if: [{ kind: 'npc' as const, npc: 'vargan', notFate: ['executed'] }, ...when],
        text: 'Behind him, {mira} catches your eye and very nearly smiles.' })),
      { if: [{ kind: 'npc', npc: 'vargan', notFate: ['executed'] }, ...MIRA_COOL],
        text: 'Behind him, {mira} watches from the inn door, wiping her hands on her apron.' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'freed' }],
        text: 'The reeve looks past you, up the marsh road, for the prisoner who isn\'t there. "You let him *walk*?" His face goes red, then white. "{thornwick} pays for a chief it can see. Not for one you turned loose in my marsh."' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'executed' }],
        text: 'Someone asks how the chief died, and you tell them: on his knees in his own hall, after the hag was already dead. The square goes quiet. Behind the reeve, {mira} looks at you, says nothing, and turns away.' },
    ],
    next: AFTERMATH_CLAIMS,
    // Back in Thornwick with the chief dead: there is no den to go back to,
    // and walking into it would leave the ending behind for good.
    noBack: true,
  },
  // Where each claim comes back to: the same choices, without the homecoming.
  'aftermath-hub': {
    id: 'aftermath-hub', kind: 'story', art: { imageId: 'loc-village', emoji: '🏘️' },
    text: [
      'The crowd presses in around the well, where the reeve\'s strongbox stands.',
      { if: [{ kind: 'flag', flag: 'got-bounty' }, { kind: 'npc', npc: 'vargan', notFate: ['freed'] }],
        text: 'The reeve has closed his ledger, and stands with his arms folded in case anyone else has a claim.' },
      { if: [{ kind: 'flag', flag: 'got-banner' }],
        text: 'Someone has hung the {ashfang} banner from the well-rope, and the children are taking turns to throw mud at it.' },
      { if: [{ kind: 'flag', flag: 'got-scout' }],
        text: '{wren} has found a barrel to sit on, her crutch across her knees. She is pretending not to watch you.' },
    ],
    next: AFTERMATH_CLAIMS, noBack: true,
  },
  'claim-bounty': {
    id: 'claim-bounty', kind: 'story', art: { imageId: 'loc-village', emoji: '💰' },
    text: ['The reeve counts out {bounty-full}, coin by coin, as if each one hurts. "Paid in full."'],
    next: [{ id: 'ok', label: 'Sweep it into your pack', to: 'aftermath-hub' }], noBack: true,
  },
  'claim-balance': {
    id: 'claim-balance', kind: 'story', art: { imageId: 'loc-village', emoji: '💰' },
    assumes: [{ kind: 'flag', flag: 'bounty' }],
    text: ['The reeve checks his ledger, takes off the {bounty-retainer} you drew at the board, and counts out {bounty-balance}. "Paid in full."'],
    next: [{ id: 'ok', label: 'Sweep it into your pack', to: 'aftermath-hub' }], noBack: true,
  },
  'claim-banner': {
    id: 'claim-banner', kind: 'story', art: { imageId: 'loc-village', emoji: '🚩' },
    assumes: [{ kind: 'flag', flag: 'looted' }],
    text: ['You unroll the {ashfang} banner across the well for the crowd to see, and the cheer goes on for some time. The reeve adds {bounty-banner} to your pile without a word.'],
    next: [{ id: 'ok', label: 'Let them cheer', to: 'aftermath-hub' }], noBack: true,
  },
  'claim-scout': {
    id: 'claim-scout', kind: 'story', art: { imageId: 'loc-village', emoji: '🏹' },
    assumes: [{ kind: 'npc', npc: 'wren', fate: 'saved' }, { kind: 'noCompanion', companion: 'wren' }],
    text: [
      '{wren} pushes through the crowd on a crutch and hands you the reeve\'s purse of {scout-reward}, and then she just stands there.',
      { if: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 0 } }],
        text: '"You came back," she says at last, and goes red to the ears.' },
      { if: [{ kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
        text: '"You came back," she says at last, and looks at you a moment longer, as if she is still making up her mind about it.' },
    ],
    next: [{ id: 'ok', label: '"So did you."', to: 'aftermath-hub' }], noBack: true,
  },

  // A total party wipe lands here (revived at half HP), not a hard game over —
  // dragged back to Thornwick to lick wounds and try again.
  defeat: {
    id: 'defeat', kind: 'story', art: { imageId: 'loc-tavern', emoji: '🍺' },
    text: [
      'You wake to lamplight and the crackle of {mira}\'s hearth. The last thing you remember is the ground coming up to meet you.',
      // How the company got home, by where it fell (Part 2 has its own).
      { if: [{ kind: 'at', hub: 'square' }],
        text: 'The reeve\'s men carried you in, she tells you, and then stood about in her taproom until she fed them.' },
      { if: [{ kind: 'at', hub: 'trail' }],
        text: 'A reed-cutter found you face-down in the reeds and poled you home on his raft. He would not take a copper for it.' },
      { if: [{ kind: 'at', hub: 'inner' }],
        text: 'She does not know who carried you out of the den. At first light she found you on her step, laid side by side, with your weapons at your feet.' },
      // (Dead or executed, he was beaten first: no fight is left to lose after that.)
      { assumes: [{ kind: 'npc', npc: 'vargan', notFate: ['slain', 'executed'] }],
        text: '"Easy, now." She puts a mug of something hot and bitter into your hands. "You slept the day round. The {ashfang} are still out there, but you\'re no use to {thornwick} dead. Drink that, then finish it."' },
    ],
    again: [
      'You wake on {mira}\'s cot again, under the same crack in the ceiling, aching in all the same places.',
      { assumes: [{ kind: 'npc', npc: 'vargan', notFate: ['slain', 'executed'] }],
        text: '"Same cot, same mug," {mira} says, and sets it down. "Try to need it less."' },
    ],
    // A wipe costs time: the day goes by on Mira's cot. Then the square, or,
    // once the party has walked it, straight back out on the marsh road, so a
    // loss out there or in the den is not the whole road again.
    // A party that fell inside the den goes straight back in, to the room it
    // fell in (as Part 2's barrow stair), not the whole marsh road again.
    next: [{ id: 'up', label: 'Get back on your feet', to: 'square', effects: [{ kind: 'passDay' }] },
      { id: 'back', label: 'Go straight back out on the marsh road', to: 'trail', effects: [{ kind: 'passDay' }],
        requires: [{ kind: 'visited', scene: 'trail' }], hideWhenBlocked: true },
      { id: 'den', label: 'Go straight back into the den', to: 'inner', effects: [{ kind: 'passDay' }],
        requires: [{ kind: 'at', hub: 'inner' }, { kind: 'flag', flag: 'den-entered' }], hideWhenBlocked: true }], noBack: true,
  },

  // The ending reads the run back: a short universal close, then one line for
  // each person or place the party touched. Every slide stands alone, so any
  // mix of them reads in order.
  epilogue: {
    id: 'epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'Bonfires burn in the square tonight. Out past the reeds the marsh has gone still, and the cold has lifted off the water.',
      'By morning the carters are already complaining about the state of the road. {mira} says that is the surest sign a place has stopped being afraid.',
    ],
    slides: [
      // The chief, then the den, then the scout, then the inn, building to the
      // pens: every victory ends on one of the captives' slides.
      // Dead in his hall, or after it: every victory leaves him one fate.
      { if: [{ kind: 'flag', flag: 'vargan-shaken' }, { kind: 'npc', npc: 'vargan', notFate: ['jailed', 'freed'] }],
        text: 'By the bonfire they already tell it your way: the {ashfang} chief wore the hag\'s brand too, and he died knowing it.' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'jailed' }],
        text: 'The reeve does not hang {vargan}. He sends him out to cut reeds on the common land until the drowned houses stand again. {vargan} has not missed a day.' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'executed' }],
        text: 'The reed-cutters bury {vargan} at the edge of the shallows he sold. They leave the grave unmarked, and no one asks where it is.' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'freed' }],
        text: 'No one sees {vargan} leave the valley, and the reeve keeps his bounty and says so loudly. Next spring, a man with a scarred hand cuts reeds alone at the far edge of the marsh.' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'slain' }, { kind: 'notFlag', flag: 'vargan-shaken' }],
        text: 'The reeve hangs the chief\'s great axe over the door of his hall. His clerk dusts round it, and will not touch the blade.' },
      { if: [{ kind: 'npc', npc: 'vex', fate: 'turned' }],
        text: 'At the edge of the crowd, a lean, grey-templed man with no rope on his wrists touches two fingers to his brow and is gone.' },
      // Refused the company, he went up to the ridge (`vex-refuses`); refused
      // by it, he stayed at his fire (`vex-dismissed`).
      { if: [{ kind: 'npc', npc: 'vex', met: true, notFate: ['turned', 'rebuffed'] }],
        text: '{vex} watched the end of it from the ridge above the den. At dawn he walks down into {thornwick} alone and gives himself up at the reeve\'s hall. He asks for a cell with a window.' },
      { if: [{ kind: 'npc', npc: 'vex', met: true, fate: 'rebuffed' }],
        text: '{vex} sat out the end of it at his own fire, the bare blade across his knees. At dawn he walks down into {thornwick} alone and lays it on the reeve\'s table. He asks for a cell with a window.' },
      { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }],
        text: 'At dawn {wren} limps out ahead of the reeve\'s men to round up what\'s left of the {ashfang}. She makes a list first.' },
      { if: [{ kind: 'npc', npc: 'wren', fate: 'left' }],
        text: 'The reeve\'s men bring a scout in from the marsh road on a door. Whether she lives, nobody at the bonfire will say.' },
      // Mira's thanks are earned, as her near-smile in the square is: the
      // captives out, the scout brought home, or the mill turning again, and
      // never from a company that killed a beaten man in front of her town.
      // Otherwise she pours, and takes the coin like anyone's.
      ...MIRA_WARM.map((when) => ({ if: [{ kind: 'npc' as const, npc: 'vargan', notFate: ['executed'] }, ...when],
        text: '{mira} pours the first round on the house, and the second when she thinks you aren\'t counting. "Don\'t go making a habit of saving towns," she warns you. "People come to expect it." It is the nearest thing to thanks she keeps in stock, and you both know it.' })),
      { if: [{ kind: 'npc', npc: 'vargan', notFate: ['executed'] }, ...MIRA_COOL],
        text: '{mira} pours your round and takes your coin for it. "Town\'s still standing," she allows, and moves off down the bar.' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'executed' }],
        text: '{mira} pours your round and sets it down without a word. She does not pour a second. When you leave, she is wiping the same cup she was wiping when you came in.' },
      { if: [{ kind: 'flag', flag: 'looted' }],
        text: 'The {ashfang} banner hangs upside down over the bar at the {wander-inn}, where all can see it.' },
      { if: [{ kind: 'npc', npc: 'tamsin', fate: 'dead' }, { kind: 'npc', npc: 'wren', notFate: ['saved'] }],
        text: '{mira} sets an extra cup at the end of the bar and fills it. Nobody drinks from it. Nobody asks.' },
      // The town and the marsh, true on every road to here.
      { if: [],
        text: 'The quartermaster in the market puts his prices up a copper for the bonfire week. He calls it the festival rate.' },
      { if: [],
        text: 'Out past the reeds, the reeve\'s men pull down the den\'s timber wall one post at a time. They leave the posts for the marsh to take.' },
      { if: [{ kind: 'visited', scene: 'board' }],
        text: 'The bounty notice comes down off the board in the square. Someone tears off the bottom corner first, the line in the prouder hand, and keeps it.' },
      { if: [{ kind: 'flag', flag: 'mill-saved' }],
        text: 'Out at the old mill the sails are turning, and someone has tied a ribbon round the stone dog\'s neck.' },
      { if: [{ kind: 'flag', flag: 'captives-freed' }],
        text: 'The carter\'s girl sits on the edge of the well in a new pair of shoes. She shows them to anyone who stops long enough.' },
      // The captives: freed (above), left, taken by the dark moon, or never found.
      { if: [{ kind: 'flag', flag: 'captives-taken' }, { kind: 'notFlag', flag: 'captives-freed' }, { kind: 'notFlag', flag: 'captives-left' }],
        text: 'Every evening, a widow walks the edge of the marsh and calls a name across the water.' },
      { if: [{ kind: 'flag', flag: 'captives-left' }, { kind: 'notFlag', flag: 'captives-taken' }],
        text: 'The reeve\'s men find the pens behind the kennels two days later. The carter is alive. He will not say your names, and he will not drive the marsh road again.' },
      { if: [{ kind: 'flag', flag: 'captives-left' }, { kind: 'flag', flag: 'captives-taken' }],
        text: 'The reeve\'s men reach the pens behind the kennels after the moon has gone dark. They find the chain hanging open, and a child\'s shoe in the straw.' },
      { if: [{ kind: 'notFlag', flag: 'captives-taken' }, { kind: 'notFlag', flag: 'captives-freed' }, { kind: 'notFlag', flag: 'captives-left' }],
        text: 'Behind the kennels, the reeve\'s men find a pen you never looked in: a carter, two reed-cutters and a girl with one shoe. They had been waiting for the dark of the moon.' },
    ],
  },

};

/**
 * What this chapter once said about people in flags of its own, and the NPC
 * state that says it now (old saves load under the new names). Exported for
 * the later chapters, which renamed the carried forms (`hollow-road:<flag>`).
 * `scout-met` marked the scout under the horse, saved or not; unsaved, she was
 * Tamsin, and the reads that wanted her still check Wren wasn't saved.
 */
export const HOLLOW_ROAD_RENAMED_NPC_FLAGS: Record<string, string> = {
  'saved-scout': npcFateFlag('wren', 'saved'),
  'scout-left': npcFateFlag('wren', 'left'),
  'scout-met': npcFateFlag('tamsin', 'dead'),
  'met-vex': npcMetFlag('vex'),
  'vex-turned': npcFateFlag('vex', 'turned'),
  'chief-dead': npcFateFlag('vargan', 'slain'),
  'vargan-executed': npcFateFlag('vargan', 'executed'),
  'vargan-jailed': npcFateFlag('vargan', 'jailed'),
  'vargan-freed': npcFateFlag('vargan', 'freed'),
};
const HOLLOW_ROAD_RENAMED: Record<string, string> = {
  ...HOLLOW_ROAD_RENAMED_NPC_FLAGS,
  'hag-dead': npcFateFlag('reedwife', 'dead'),
};

export const HOLLOW_ROAD_MODULE: Module = withCanon({
  id: 'hollow-road', title: 'The Hollow Road',
  blurb: 'Break the {ashfang} raiders — through the village, the marsh, and their den. By blade or by wit.',
  cover: 'loc-village',
  levelBand: { from: 1, to: 3 },
  // Part 1 of the trilogy (docs/trilogy-plan.md): a victory carries the
  // company into The Sunken Barrows.
  sequel: 'sunken-barrows',
  start: 'road', scenes, defeatScene: 'defeat', town: 'square',
  // The clock: the Ashfang keep their captives for the Reedwife, and she
  // takes them when the moon goes dark. Six nights' sleep and they are gone.
  dawns: [
    // Every dawn here is read wherever the party woke: a camp on the marsh
    // road, the den, or Mira's cot after a wipe (where `at` still names the
    // place it fell). So none of them names a place to stand in.
    { day: 5, text: ['There is frost on everything this morning, and the sun comes up thin and cold. The moon is wasting. A few more nights and it will be gone.'],
      // The scout under the horse dies if no one has tended her (see `wounded`).
      effects: [{ kind: 'setFlag', flag: 'scout-bled-out' }] },
    { day: 6, text: ['A rind of moon rose late over the marsh and set early. One more night of it, at most.'] },
    { day: 7, text: ['There was no moon at all last night. Far out on the marsh, something sang until dawn, and then stopped.'],
      effects: [{ kind: 'setFlag', flag: 'captives-taken' }, { kind: 'setFlag', flag: 'pens-settled' }] },
  ],
  // What the rest of the campaign remembers (read as 'hollow-road:won', …):
  // that the company won this chapter at all (`won`), and whether it cut the
  // captives out of the pens (a war asset at the Wyrmcalling's council). What
  // became of Wren, Tamsin, Vex, Vargan and the Reedwife is NPC state, which
  // every later chapter sees without a carry.
  carries: ['won', 'captives-freed'],
  // Saves from before that state moved onto the NPCs.
  renamedFlags: HOLLOW_ROAD_RENAMED,
  companions: companionsFrom(NPCS, [
    { id: 'wren', blurb: 'The reeve\'s scout you pulled from under a dead horse. Guiding you through the marsh as far as the den\'s gate.' },
  ]),
}, { npcs: NPCS, facts: TRILOGY_FACTS });
