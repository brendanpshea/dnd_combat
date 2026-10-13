/**
 * The Hollow Road's shared pieces: effects, lines and choices more than one
 * scene uses. The scenes (*.story) name them as `@NAME`.
 */
import type { Scene, Effect, Choice, Para, Requirement } from '../../../adventure/types.js';
import { speaker, npcMetFlag, npcFateFlag } from '../../../adventure/npcs.js';
import { TRILOGY_NPCS as NPCS } from '../npcs.js';
import { factValue } from '../canon.js';
import { avoidedFightXP } from '../../encounters.js';

/** Learning whose the marsh-things are: the Reedwife reveal. */
export const HAG_LEARNED: Effect[] = [
  { kind: 'setFlag', flag: 'know-hag' },
  { kind: 'journal', entry: { id: 'c-hag', kind: 'clue', title: 'The {reedwife}',
    body: 'A green hag the reed-cutters call the "{reedwife}" owns the marsh-creatures that serve the {ashfang}, and brands them like cattle. She waits at the den\'s fire beside the {ashfang} chief. She told you to ask him what he sold her.' } },
];

/** Past the den's gate without a fight (the signal, the wall, the water-gate,
 *  or a bluff): what beating its enforcers would have earned. */
/** Past the gate unseen (the gate obstacle's answers pay its avoided XP themselves). */
export const GATE_QUIET: Effect[] = [{ kind: 'setFlag', flag: 'signal-spent' },
  // No horn: the yard has not looked round yet (its first visit reads this).
  // In by their own signal, the party is taken for their own: whatever the
  // peddler warned them of, they stop looking for it.
  { kind: 'setFlag', flag: 'den-quiet' }, { kind: 'alarm', dungeon: 'inner/delve', amount: -3 }];
/** In by the water-gate: the party comes up beside the pens. */
export const IN_BY_WATER: Effect = { kind: 'enterAt', dungeon: 'inner/delve', room: 'The Pens' };
/** Over the wall: down behind the kennels. */
export const IN_OVER_WALL: Effect = { kind: 'enterAt', dungeon: 'inner/delve', room: 'Kennels' };
/** …and talked past it, at the gate's own fight. */
export const GATE_PASSED: Effect[] = [{ kind: 'xp', amount: avoidedFightXP('den-gate') }, ...GATE_QUIET];

/** Past the gate by any road: the gate-signal lead is done with, used or not. */
export const SIGNAL_SPENT: Effect = { kind: 'setFlag', flag: 'signal-spent' };

/** Past the hollow: the reveal, and the wet way in (`trail-wet`) no longer
 *  matters, so the den is not searched twice over for it. */
export const HOLLOW_PASSED: Effect[] = [...HAG_LEARNED, { kind: 'clearFlag', flag: 'trail-wet' }];

/** What bringing Wren round buys, whether she goes home or comes along. */
export const WREN_SAVED: Effect[] = [
  { kind: 'npc', npc: 'wren', met: true, fate: 'saved' }, { kind: 'setFlag', flag: 'know-vex' },
  { kind: 'journal', entry: { id: 'npc-wren', kind: 'npc', title: '{wren}, the Scout', body: 'You pulled a reeve\'s scout, {wren}, out from under a dead horse on the marsh road. She mapped the den for you.' } },
  { kind: 'journal', entry: { id: 'lead-vex', kind: 'lead', resolvedBy: npcMetFlag('vex'),
    title: '{vex}, the Lieutenant', body: '{wren} named {vex}, the {ashfang} chief\'s resentful lieutenant. Seek out his fire inside the den — he may turn on the chief if offered a way out.' } },
];

/** Wren's word on Vex, once she can talk: a name to look for, or (for a
 *  party that has already been inside the den) a man they have met. */
export const WREN_ON_VEX: Para[] = [
  { if: [{ kind: 'npc', npc: 'vex', met: false }],
    text: '"You got the horse off me. Let me pay some of that back." She catches your wrist. "There\'s a man in there hates the chief worse than you do — **{vex}**, the lieutenant. Offer him a way out when you reach his fire, and he might stand his guards aside instead of setting them at your throat."' },
  { if: [{ kind: 'npc', npc: 'vex', met: true }],
    text: '"You got the horse off me. Let me pay some of that back." She looks at the den-mud on your boots. "You\'ve been inside already, so you\'ve met {vex} at his fire. He hates the chief worse than you do. Whatever you said to him, he\'ll remember it when the chief calls for his guards."' },
];

export const BOSS_FALLS = 'The chief\'s axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging.';
/** The unguarded hall's whistled help, ended (`boss-unguarded`). */
// The guarded hall: the chief's guard and a raider fight beside him.
export const GUARD_ENDS = 'By the door the chief\'s grey old guard is down, and the raider who stood with him lies across the threshold.';
export const SNAKE_ENDS = 'Across the threshold her branded snake lies dead in its own coils, and the one raider who stayed lies beside it.';
/** What the hall pays, beside its loot: the chief's strongbox. */
export const BOSS_HOARD = 'Behind the throne stands the chief\'s strongbox, its lid forced long ago and never mended. It is heavy with a season of stolen coin.';
export const BOSS_WON: Effect[] = [
  { kind: 'npc', npc: 'reedwife', met: true, fate: 'dead' }, { kind: 'gold', amount: 100 },
];

/** Naming Vargan's brand: the moment before he chooses a side. */
export const VARGAN_BRAND = [
  'The rag on his axe hand has slipped. Burned into the skin beneath is a mark of reeds and a reaching hand, the same brand the lizardfolk wore in the hollow.',
  'He stares down at his own hand as if it belongs to someone else. Behind him the hag has stopped smiling.',
];
/** Talked round: he turns on her, and she burns him down with her own mark
 *  (named already, or shown to the company only now). */
export const VARGAN_TURNS: Para[] = [
  { if: [{ kind: 'flag', flag: 'vargan-shaken' }],
    text: '{vargan} looks from the brand to the hag, and turns, and swings his axe at her two-handed. She catches the blade in a fist of river-weed. "My mother\'s house," he says through his teeth. The hag closes her fingers, and the brand on his hand burns white. He drops to the floor, screaming.' },
  { if: [{ kind: 'notFlag', flag: 'vargan-shaken' }],
    text: '{vargan} looks at the hag without a word, and turns, and swings his axe at her two-handed. She catches the blade in a fist of river-weed. "My mother\'s house," he says through his teeth. The hag closes her fingers. Through the rag on his axe hand a brand burns white, a mark of reeds and a reaching hand, and he drops to the floor, screaming.' },
];
/** The talk, before or after the read. One try (`attempt: 'turn'`). */
export const TURN_UNREAD_LABEL = '[Persuasion DC 14] "She drowned your mother\'s house. Help us end her."';
export const TURN_READ_LABEL = '[Persuasion DC 10] "She owns you too. Help us end her."';
/** The harder talk, before the brand is read (one try, `attempt: 'turn'`). */
export const TURN_UNREAD: Choice = { id: 'turn', label: TURN_UNREAD_LABEL, to: 'vargan-turns', attempt: 'turn',
  check: { skill: 'persuasion', dc: 14, failTo: 'boss' } };
/** …offered in the hall only while the brand is still unread. */
export const TURN_UNREAD_FRESH: Choice = { ...TURN_UNREAD, requires: [{ kind: 'notFlag', flag: 'vargan-shaken' }], hideWhenBlocked: true };
export const BIND_VARGAN: Choice[] = [
  { id: 'reeve', label: 'Bind him and march him down to the reeve', to: 'way-out',
    effects: [{ kind: 'npc', npc: 'vargan', fate: 'spared' }, { kind: 'npc', npc: 'wren', attitude: 1 }] },
];
/** Finishing him on his knees (`dead`). {wren} thinks the worse of the
 *  company for it, as with binding him, if she knows it. */
export const END_VARGAN: Choice[] = [
  { id: 'end', label: 'End it here', to: 'way-out',
    effects: [{ kind: 'npc', npc: 'vargan', fate: 'dead' }, { kind: 'npc', npc: 'wren', attitude: -1 }] },
];
export const FREE_VARGAN = (label: string): Choice[] => [
  { id: 'free', label, hint: 'The reeve pays for a chief he can see.', to: 'way-out', requires: [{ kind: 'notFlag', flag: 'bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'npc', npc: 'vargan', fate: 'spared' }, { kind: 'setFlag', flag: 'vargan-let-go' }, { kind: 'setFlag', flag: 'got-bounty' }] },
  { id: 'free-retainer', label, hint: 'The reeve pays for a chief he can see, and he will want his retainer back.', to: 'way-out', requires: [{ kind: 'flag', flag: 'bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'npc', npc: 'vargan', fate: 'spared' }, { kind: 'setFlag', flag: 'vargan-let-go' }, { kind: 'setFlag', flag: 'got-bounty' },
      { kind: 'gold', amount: -factValue('bounty-retainer') }] },
];
export const REEDWIFE_FALLS = 'The **{reedwife}** staggers back into the fire-pit and goes down hissing among the coals. When the steam clears she is still lying there, and she does not get up. The smell of her, rotten water and burning weed, hangs in the hall for a long time.';
/** And hers: the purse at her belt. */
export const REEDWIFE_HOARD = 'A sodden purse hangs at her belt on a cord of river-weed. It is full of old coin, gone green with marsh-water.';
export const REEDWIFE_WON: Effect[] = [{ kind: 'npc', npc: 'reedwife', met: true, fate: 'dead' }, { kind: 'gold', amount: 100 }];
export const BIND_HAG_WON = (encounter: string): Effect[] =>
  [{ kind: 'npc', npc: 'reedwife', met: true, fate: 'bound' }, { kind: 'xp', amount: avoidedFightXP(encounter) }];
/** Who watches her go: the chief's guard, or (Vex's bargain kept) her own
 *  whistled help. */
export const BIND_HAG_HELD: Para[] = [
  'The words catch in her like a hook. She hisses and twists, but she cannot get free of them. "One {door-price}," she says at last, as if it tastes of mud. "See that they pay it."',
  'She goes out of the hall into the night, toward the marsh, and the earth floor stays wet where she walked.',
  { if: [{ kind: 'npc', npc: 'vex', notFate: ['turned'] }], text: 'The chief\'s guard watches her go, and then walks out into the smoke after her. His four raiders go with him.' },
  { if: [{ kind: 'npc', npc: 'vex', fate: 'turned' }], text: 'Her two raiders watch her go, and then they run too. The snake pours out after her into the dark.' },
];
/** Bound, she leaves the hall with the fight unfought: pays the smaller of
 *  the hall's two fights (guarded, or with Vex's bargain kept). */
const BOUND_FROM = 'hag-whistled';
export const BIND_HAG: NonNullable<Extract<Scene, { kind: 'battle' }>['parley']> = {
  skill: 'arcana', dc: 15, attempt: 'bind-hag',
  label: 'Hold her to her old price: one {door-price} a winter, by their door',
  refused: ['You start the words, and she hears the place where your voice catches. "Oh, sweetling," she says. "That bargain is long spent." She laughs, and comes for you.'],
  success: { to: 'vargan-fate',
    effects: BIND_HAG_WON(BOUND_FROM),
    text: [
      'You say her price back to her, in her own words. One {door-price} each {door-midwinter}, for sitting by their door in the dark. Nothing more: no shallows, no pens, no chief.',
      ...BIND_HAG_HELD,
    ] },
};
export const BIND_HAG_RITE_CHOICE: Choice = {
  id: 'rite', label: '[Religion DC 15] Bind her to her old price as a rite: one {door-price} a winter, by their door',
  hint: 'One try at binding her, whichever way the words are said.', to: 'bind-hag-rite', attempt: 'bind-hag' };
export const BIND_HAG_RITE: Scene = {
  id: 'bind-hag-rite', kind: 'check', skill: 'religion', dc: 15,
  intro: ['Before she can whistle for anyone, you speak her price the way a priest speaks a binding rite. Each word goes down slowly, like a stone: one {door-price} each {door-midwinter}, for sitting by their door in the dark. You ask for nothing more: no shallows, no pens, no chief.'],
  success: { to: 'vargan-fate', effects: BIND_HAG_WON(BOUND_FROM), text: BIND_HAG_HELD },
  failure: { to: 'reedwife-fight', text: ['One word comes out wrong, and the rite falls apart in your mouth. "Oh, sweetling," she says. "That bargain is long spent." She laughs.'] },
};
export const REEDWIFE_LOST = [
  'The hag\'s cold fingers close over your eyes, and the hall goes dark.',
  'You wake behind the throne, where somebody dragged you. {vargan} sits beside you with his burned hand in his lap. "She is still by the fire," he says. "Get up. I cannot finish her alone."',
];

/** The reeve's strongbox first: paid (or refused, for a chief let go), the
 *  company is in the square's hub with its other claims. */
export const AFTERMATH_PAY: Choice[] = [
  { id: 'bounty', label: 'Let the reeve count out the bounty', to: 'claim-bounty',
    requires: [{ kind: 'notFlag', flag: 'bounty' }, { kind: 'notFlag', flag: 'got-bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold', amount: factValue('bounty-full') }, { kind: 'setFlag', flag: 'got-bounty' }] },
  { id: 'balance', label: 'Let the reeve settle the rest of the bounty', to: 'claim-balance',
    requires: [{ kind: 'flag', flag: 'bounty' }, { kind: 'notFlag', flag: 'got-bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold', amount: factValue('bounty-balance') }, { kind: 'setFlag', flag: 'got-bounty' }] },
  { id: 'square', label: 'Turn to the crowd', to: 'aftermath-hub',
    requires: [{ kind: 'flag', flag: 'got-bounty' }], hideWhenBlocked: true },
];

export const AFTERMATH_CLAIMS: Choice[] = [
  { id: 'banner', label: 'Unroll the {ashfang} banner on the well', to: 'claim-banner',
    requires: [{ kind: 'flag', flag: 'looted' }, { kind: 'notFlag', flag: 'got-banner' }],
    effects: [{ kind: 'gold', amount: factValue('bounty-banner') }, { kind: 'setFlag', flag: 'got-banner' }] },
  // Hidden unless she was saved: a company that never pulled her out from
  // under the horse doesn't know her name.
  { id: 'scout', label: 'Look for {wren} in the crowd', to: 'claim-scout', hideWhenBlocked: true,
    requires: [{ kind: 'npc', npc: 'wren', fate: 'saved' }, { kind: 'notFlag', flag: 'got-scout' }],
    effects: [{ kind: 'gold', amount: factValue('scout-reward') }, { kind: 'setFlag', flag: 'got-scout' }] },
  ...([
    // (The captives are the company's to bring home: nobody does it for them.)
    [[{ kind: 'npc', npc: 'wren', fate: 'saved' }], []],
    // Not saved, and alive at the end (never found, or walked past: she
    // turned on the company when it stepped round her, at the time): the
    // reeve's men find her, and the scouts' quest is someone else's doing.
    [[{ kind: 'npc', npc: 'wren', notFate: ['saved'] }, { kind: 'notFlag', flag: 'scout-bled-out' }],
      [{ kind: 'setFlag', flag: 'scouts-unfound' }]],
    [[{ kind: 'npc', npc: 'wren', notFate: ['saved'] }, { kind: 'flag', flag: 'scout-bled-out' }],
      [{ kind: 'npc', npc: 'wren', fate: 'lost' }]],
  ] as Array<[Requirement[], Effect[]]>).map(([when, also], i): Choice => ({
    id: ['done', 'done-unsaved', 'done-lost'][i]!, label: 'Let the crowd carry you to the {wander-inn}', to: 'epilogue',
    requires: when, hideWhenBlocked: true,
    effects: [{ kind: 'setFlag', flag: 'won' }, ...also] })),
];


export const SPY_LIST = 'Under a loose board at the back of his stall lies a list of every caravan that has left {thornwick} this month. Someone has ticked off each one. The ticks are his. The names are in another man\'s writing. "The chief sends the names," he babbles. "He knows every carter in this town. I only tick them off."';

export const VEX_OFFERS: Choice[] = [
  // Wren's tip (`know-vex`): the party knows what he wants before he says it.
    { id: 'wren', label: '[Persuasion DC 9] "{wren} says you want out. The reeve\'s pardon, and a road."', to: 'vex-turned',
      attempt: 'vex-pardon', requires: [{ kind: 'flag', flag: 'know-vex' }, { kind: 'alarm', dungeon: 'inner/delve', below: 3 }], hideWhenBlocked: true,
      check: { skill: 'persuasion', dc: 9, failTo: 'vex-refuses' } },
    { id: 'persuade', label: '[Persuasion DC 13] Offer him the reeve\'s pardon and a road out', to: 'vex-turned',
      attempt: 'vex-pardon', requires: [{ kind: 'notFlag', flag: 'know-vex' }, { kind: 'alarm', dungeon: 'inner/delve', below: 3 }], hideWhenBlocked: true,
      check: { skill: 'persuasion', dc: 13, failTo: 'vex-refuses' } },
    // Cowed, not bought (`vex-threatened`, this chapter's own): no pardon
    // was offered. Bought or cowed, he is `turned`.
    { id: 'intimidate', label: '[Intimidation DC 14] Point out his one other way out', to: 'vex-turned',
      attempt: 'vex-threat', requires: [{ kind: 'alarm', dungeon: 'inner/delve', below: 3 }], hideWhenBlocked: true,
      effects: [{ kind: 'setFlag', flag: 'vex-threatened' }],
      check: { skill: 'intimidation', dc: 14, failTo: 'vex-refuses', failEffects: [{ kind: 'clearFlag', flag: 'vex-threatened' }] } },
    { id: 'refuse', label: 'Refuse to deal with a raider', to: 'vex-dismissed',
      effects: [{ kind: 'npc', npc: 'vex', met: true }] },
];

export const MIRA = speaker(NPCS.mira!, { label: '{mira} the Innkeeper' });
export const SCOUT = speaker(NPCS.wren!, { label: 'Wounded Scout', portraitId: 'npc-wounded', emoji: '🤕' });
export const LIEUTENANT = speaker(NPCS.vex!, 'the Lieutenant');
