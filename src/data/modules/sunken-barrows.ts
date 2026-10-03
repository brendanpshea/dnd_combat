/**
 * "The Sunken Barrows" — Part 2 of the trilogy (docs/trilogy-plan.md): a
 * L3→4 adventure in three acts (Thornwick's wrong graves → the deep fen →
 * the Undercrypt), continuing The Hollow Road's company or standing alone.
 *
 * The premise pays off Part 1's victory with its cost: the Reedwife was not
 * merely squatting in the marsh — she was the Undercrypt's jailer gone to
 * rot, paid a lamb each midwinter to keep something older under. The
 * company killed her (or, Part 1's other road, bound her back to that door
 * after she had left it all spring), so the barrows are opening, and the
 * debt is theirs. Every line about her is worded true of both.
 * The Cult of the Worm arrives to finish what the broken ward began.
 *
 * XP budget (see trilogy-plan.md), and no level floor: the fights carry a
 * company from 3rd to 4th before the Warden's door (docs/module-writing-guide.md,
 * "Levels come from fights"). Required spine ≈ 8,000 encounter XP before the
 * finale (the churchyard's shadows and ghost 1,500, the drowned chapel 1,050,
 * the corpse-lights 2,200, the Barrow Gate's watchers 1,100, wights 800, the
 * embalmed king 1,600), then the cult at the door 2,050, or 900 with Marrow
 * talked down; the serpent pool optional (+900). The XP sits early, so a
 * carried company (~1,100–1,600 XP from Part 1) reaches 4th between the
 * corpse-lights and the first rooms of the Undercrypt, and a cold start by
 * the barrow-guard. The finale is the chapter's hardest fight. Every way past a fight
 * (Halden talked down, the lights skirted, the diggers slipped past, the
 * watchers or the wight stood down) pays what the fight would have
 * (`avoidedFightXP`). Cold starts: only the cold-start choice carries
 * `xpToLevel: 3`; a continuing company arrives with what it earned.
 *
 * MONSTER VARIETY: this module owns the undead/guardian shelf — shadows,
 * ghouls by night, a corrupt chapel, will-o'-wisps, gargoyles, wights, a
 * mummy, constrictor snakes, a ghost, and the cult — none of it fielded by Part 1.
 */
import type { Module, Scene, Effect, Choice } from '../../adventure/types.js';
import { withCanon, speaker, companionsFrom, npcMetFlag, npcFateFlag, carriedRenames } from '../../adventure/npcs.js';
import { TRILOGY_NPCS as NPCS, TRILOGY_RENAMED_FATES } from './npcs.js';
import { TRILOGY_FACTS, factValue } from './canon.js';
import { avoidedFightXP } from '../encounters.js';
import { HOLLOW_ROAD_RENAMED_NPC_FLAGS } from './hollow-road.js';

const MIRA = speaker(NPCS.mira!, { label: '{mira} the Innkeeper' });
const BRAM = speaker(NPCS.bram!, { label: '{bram} the Quartermaster' });
const REEVE = speaker(NPCS.aldous!, { label: 'Reeve {aldous}' });
const WREN = speaker(NPCS.wren!, 'the Reeve\'s Scout');
const HALDEN = speaker(NPCS.halden!, { label: 'Brother {halden}' });

/** Wren comes along from the fen road, however the party first meets her. */
const WREN_JOINS: Effect[] = [
  { kind: 'npc', npc: 'wren', met: true }, { kind: 'joinParty', companion: 'wren' },
];

/** What Wren tells the party at the fen road, whether or not they know her. */
const WREN_BRIEF = 'I\'ve scouted the near fen twice since the graves opened. Every trail runs to the old barrow-country, past the **drowned chapel** and past the **corpse-lights**. I can walk you as far as the barrow-country. Past that, I don\'t know the ground, and I won\'t pretend I do.';

/** What the chapel hands over, whether Halden lived through it or not. */
const CHAPEL_CLEARED: Effect[] = [
  { kind: 'setFlag', flag: 'chapel-cleared' }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 },
  { kind: 'journal', entry: { id: 'c-rites', kind: 'clue', title: 'The Rites of Sealing',
    body: 'Brother {halden}\'s prayer book holds the old rites of sealing. The {reedwife} was the jailer of the {warden} of the Barrows. The fen-folk gave her a {door-price} each {door-midwinter}, and she kept him asleep. With her gone from the door, his seal broke. Speak the rites at the {warden}\'s door, deep in the great barrow, to shut him in again.' } },
];

/** The words Halden said over Thornwick's dead, said back to him. */
const LITURGY = '*Lie down and be at peace. Your work is done. The bell will wake you.*';

/** The one try at saving Halden with his own words, from wherever it is offered. */
const LITURGY_TRY = (dc: number): Choice => ({ id: 'speak', label: `[Religion DC ${dc}] Speak his own liturgy back to him`, to: 'chapel-saved',
  attempt: 'liturgy', check: { skill: 'religion', dc, failTo: 'chapel-unheard' } });

/** Past the diggers without a fight: what the fight would have paid. */
const DIGGERS_SLIPPED: Effect[] = [{ kind: 'xp', amount: avoidedFightXP('undead') }];

/** The kneelers at the Warden's door, turned to the rites or not. */
const KNEELERS_WON = { to: 'seal-clean', text: ['You hold the book up where the kneelers can see it. "You came to sing to the {warden}," you tell them. "Then sing this." One voice joins yours, then five, then all of them. The {warden}\'s own faithful sing him back to sleep.'] };
const KNEELERS_LOST = (to: string) => ({ to, text: ['The kneelers look at the book, then at the door. They bow their heads and go back to their own chant, louder than before.'] });
/** While Marrow leads his faithful, they are his to turn, not the company's. */
const NOT_SINGING = { kind: 'npc' as const, npc: 'marrow', notFate: ['sings'] };
/** Marrow's kneelers, chanting each line after whoever reads it. */
const SINGERS = { if: [{ kind: 'npc' as const, npc: 'marrow', fate: 'sings' }],
  text: 'At the back of the stair, {marrow}\'s kneelers chant every line back. The whole stair keeps time, low and steady.' };

/** The cult, glimpsed in the fen before it shows itself at the Warden's door. */
const WORM_CLUE: Effect = { kind: 'journal', entry: { id: 'c-worm', kind: 'clue', title: 'Robes the Colour of Worms',
  body: 'A stranger in long, worm-pale robes lay drowned among the corpse-lights. Nailed boots on the old road, black candles in the chapel, and now this. Someone living is helping the dead along.' } };

/** The valley's regard (docs/state-ledger.md): one for each deed that keeps
 *  faith with {thornwick}, carried on as `sunken-barrows:regard` and read
 *  there in bands. The purses carried home, the old reeve carried home, and
 *  the town fed while it names its dead. Which deed earned it stays here. */
const REGARD: Effect = { kind: 'addFlag', flag: 'regard', amount: 1 };

/** The drowned folk's purses, found after the fight or on the firm ground
 *  round it: keep them, or carry them home (Wren's call to watch you make).
 *  Keeping them pays now (the coin, and two healing draughts for the fights
 *  ahead); carrying them home pays in {wren} and in {thornwick}.
 *  `extra` is what the way to them costs or pays. */
const purseChoices = (extra: Effect[]): Choice[] => [
  { id: 'keep', label: 'Keep the purses. The dead won\'t spend them', to: 'lights-kept',
    effects: [...extra, { kind: 'gold', amount: factValue('drowned-gold') }, { kind: 'addItem', itemId: 'potion-healing', qty: 2 },
      { kind: 'setFlag', flag: 'lights-cleared' }, WORM_CLUE,
      { kind: 'npc', npc: 'wren', attitude: -1 }] },
  { id: 'home', label: 'Carry the purses home for the families', to: 'lights-home',
    effects: [...extra, { kind: 'setFlag', flag: 'lights-cleared' }, { kind: 'setFlag', flag: 'drowned-gold-home' }, REGARD, WORM_CLUE,
      { kind: 'npc', npc: 'wren', attitude: 1 },
      { kind: 'journal', entry: { id: 'c-purses', kind: 'clue', title: 'The Drowned Folk\'s Purses',
        body: 'You took the purses of the people the corpse-lights drowned. You mean to hand them back to the fen-folk families in {thornwick}, once the barrows are shut.' } }] },
];

/** Wren's question over the purses, wherever they turn up. */
const PURSES_ASK = 'She looks at the purses, then at you. "Those belonged to somebody\'s husband, somebody\'s gran. The families could use them. So could you. Your call."';

/** Taking Aldous's commission. */
const REEVE_TAKE = [{ id: 'take', label: 'Take the reeve\'s commission', to: 'town', once: true,
  effects: [{ kind: 'setFlag' as const, flag: 'reeve-task' }, { kind: 'gold' as const, amount: 60 },
    { kind: 'journal' as const, entry: { id: 'n-aldous', kind: 'npc' as const, title: 'Reeve {aldous}',
      body: '{thornwick}\'s reeve is proud and paying, and he takes this one personally. His grandfather\'s grave is among the opened. His orders are simple. Follow the dead into the fen and end what calls them.' } },
    { kind: 'journal' as const, entry: { id: 'lead-fen', kind: 'lead' as const, resolvedBy: 'undercrypt-found',
      title: 'Into the Deep Fen', body: 'The dead walk one way, into the barrow-country of the deep fen. The reeve\'s scout, {wren}, waits at the fen road to guide you in. Find where the trails meet.' } }] }];

const INN_CHOICES = [
  { id: 'room', label: 'Take a room for the night ({inn-room}, long rest)', to: 'inn-rest',
    requires: [{ kind: 'gold' as const, atLeast: factValue('inn-room') }], effects: [{ kind: 'gold' as const, amount: -factValue('inn-room') }] },
  { id: 'leave', label: 'Go back out to the street', to: 'town' },
];

/** The serpents beaten, however the fight began. */
const POOL_WON = { to: 'fen', text: ['The serpents lie in loops like dropped rope. Your boots turn up everything the fen-folk ever left here, from old coins to a sealed flask of potion. The pool is plain water now.'],
  effects: [{ kind: 'setFlag' as const, flag: 'pool-cleared' }, { kind: 'gold' as const, amount: 85 }, { kind: 'addItem' as const, itemId: 'potion-greater-healing', qty: 1 }] };

const POOL_CHOICES = [
  { id: 'fight', label: 'Wade in and clear the pool', to: 'pool-fight' },
  { id: 'leave', label: 'Leave the pool its privacy', to: 'fen' },
];

/** The way home from the sealed door, whichever way it shut. The reeve's
 *  commission is counted out that evening in `sb-hall` (paid on the way into
 *  it, from `sb-aftermath`), where what the company carried up (the old reeve,
 *  the drowned folk's purses) is handed over too, so what this chapter carries
 *  on is what really reached Thornwick. */
const CLIMB_HOME = [{ id: 'home', label: 'Climb the cult\'s rope ladder back to the light', to: 'sb-aftermath' }];

/** What the party can still do in Thornwick once the door is sealed. */
const SB_CLAIMS = [
  { id: 'mira', label: 'Pay for a hot supper for the whole taproom ({taproom-supper})', to: 'sb-claim-round',
    requires: [{ kind: 'gold' as const, atLeast: factValue('taproom-supper') }, { kind: 'notFlag' as const, flag: 'sb-round' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold' as const, amount: -factValue('taproom-supper') }, { kind: 'setFlag' as const, flag: 'sb-round' }, REGARD] },
  // `won`: the one road to the victory ending, carried for the last chapter.
  { id: 'done', label: 'Let the town sleep', to: 'sb-epilogue', effects: [{ kind: 'setFlag' as const, flag: 'won' }] },
];

/** The climax is a choice of how, and a roll: each way of saying the rites may
 *  be tried once. Halden, if he lived, can say his own. If every voice fails,
 *  the door cracks and the Warden's dead come through it.
 *
 *  The door's clock (see `dawns`): once the ground has shaken twice
 *  (`door-straining`) the book is opened at `resealing-shifted`, where every
 *  way a company has without help (the rites, the letters, the kneelers) is
 *  two harder. The help it earned ({halden}, {marrow}, a wizard) is not. */
function resealing(strained: boolean): Scene {
  const id = strained ? 'resealing-shifted' : 'resealing';
  const hard = strained ? 2 : 0;
  const shifted = strained ? ', and the door has shifted in its frame since.' : '.';
  return {
    id, kind: 'challenge', art: { imageId: 'loc-dungeon', emoji: '📖' },
    intro: [
      'The great door still bulges outward, and half the lead is gone from its letters. Against the far wall the robed faithful are still on their knees, watching you over their guttering black candles.',
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'sings' }],
        text: '{marrow} has laid his chisel down on the step. He watches the book now, not the door.' },
      '{halden}\'s book lies open in your hands. The rites fill three pages, and the oldest words look too old for a living mouth. Someone has to say them, now, at this door, and it will take nerve.',
    ],
    retry: 'perApproach',
    noBack: true,
    approaches: [
      { id: 'rites', label: 'Speak the rites aloud',
        ...(strained ? { hint: 'The door has shifted in its frame, and the lead in its letters has cracked with it.' } : {}),
        skill: 'religion', dc: 13 + hard,
        success: { to: 'seal-clean', text: ['You read the old rites by black candle-light. You stumble over the oldest words, and say them again until they come out right. The lead letters drink the words the way dry ground drinks rain.', SINGERS] },
        failure: { to: id, text: ['Your voice cracks on the oldest word, and the rest come out wrong. The letters stay dark. The door groans, and leans a little harder.'] } },
      { id: 'letters', label: 'Read the lead letters as a spell', hint: 'They are cut deeper than any prayer needs' + shifted,
        skill: 'arcana', dc: 14 + hard,
        success: { to: 'seal-clean', text: ['The letters are not a prayer at all. They are a lock, and the rites are its key. You trace each letter with a finger and speak its line from the book. One by one, the lead letters glow and set hard.', SINGERS] },
        failure: { to: id, text: ['You trace the wrong line first. A letter spits its lead at your hand and goes dark. The old masons\' work will not take orders from you.'] } },
      // Harder once they watched {marrow} laugh the company off
      // (`kneelers-scorned`). Not offered while {marrow} leads them.
      { id: 'kneelers', attempt: 'kneelers', label: 'Turn the kneeling cultists to the words',
        hint: strained ? 'They felt the ground shake, and they think their door is opening.' : 'They came here to chant at this door.',
        skill: 'persuasion', dc: 14 + hard, requires: [{ kind: 'notFlag', flag: 'kneelers-scorned' }, NOT_SINGING], hideWhenBlocked: true,
        success: KNEELERS_WON, failure: KNEELERS_LOST(id) },
      { id: 'kneelers-scorned', attempt: 'kneelers', label: 'Turn the kneeling cultists to the words', hint: 'They laughed at you once.',
        skill: 'persuasion', dc: 16, requires: [{ kind: 'flag', flag: 'kneelers-scorned' }, NOT_SINGING], hideWhenBlocked: true,
        success: KNEELERS_WON, failure: KNEELERS_LOST(id) },
      { id: 'wizard', label: '[Wizard] Pick the lock the old masons cut', hint: 'You know a ward when you see one. This one is only half-broken.',
        skill: 'arcana', dc: 11,
        requires: [{ kind: 'classInParty', classId: 'wizard' }], hideWhenBlocked: true,
        success: { to: 'seal-clean', text: ['You have read wards like this in dusty books. This one is a lock, and the rites are its key. You find where {marrow}\'s chisel broke it, and mend each letter with the line that belongs to it. The lead glows, and sets hard.', SINGERS] },
        failure: { to: id, text: ['No book you have ever read goes back as far as this ward. You lose your place in it, and a letter spits hot lead at your hand.'] } },
      { id: 'marrow', label: 'Let {marrow} lead his faithful in the rites', hint: 'His faithful will sing whatever he sings.',
        skill: 'persuasion', dc: 9,
        requires: [{ kind: 'npc', npc: 'marrow', fate: 'sings' }], hideWhenBlocked: true,
        success: { to: 'seal-clean', text: ['{marrow} takes the book in both hands and turns to his kneelers. "We had the words wrong," he tells them. He reads, and every kneeler on the stair follows him, and one by one the lead letters fill with light.'] },
        failure: { to: id, text: ['{marrow}\'s voice breaks on the first line. He was never a priest. The kneelers wait for him, and the door groans.'] } },
      { id: 'halden', label: 'Give {halden} the book',
        skill: 'religion', dc: 8,
        requires: [{ kind: 'npc', npc: 'halden', fate: 'saved' }], hideWhenBlocked: true,
        success: { to: 'seal-clean', text: ['{halden} takes the book and finds his place without looking. He reads in the same calm voice that led the drowned congregation. This time the voice is his own, and the lead letters drink every word.', SINGERS] },
        failure: { to: id, text: ['{halden} opens his mouth, and the voice that comes out is not quite his. He shuts the book fast and hands it back, white to the lips. "Not me," he whispers. "It still knows me."'] } },
    ],
    success: { to: 'seal-clean' },
    // Every voice failed: the door cracks before it seals.
    failure: { to: 'seal-breach', text: ['The last word dies in the dark, and for a moment nothing happens. The great door splits down its middle with a crack like river ice, and grey hands push out through the gap. The {warden} has stopped waiting for his servants.'] },
  };
}

/** Into the churchyard, however the company comes to it. */
const OPENING: Effect[] = [
  { kind: 'journal', entry: { id: 'q-barrows', kind: 'quest', title: 'The Opened Graves',
    body: '{thornwick}\'s dead are leaving their graves and walking into the deep fen. Find what is calling them, and stop it.' } }];

/** A fresh company starts this module at 3rd level. Only the cold start
 *  carries it: a company continuing from The Hollow Road arrives with what its
 *  fights earned (see docs/module-writing-guide.md, "Levels come from fights"). */
const COLD_START: Effect = { kind: 'xpToLevel', level: 3 };

const scenes: Record<string, Scene> = {
  // === ACT 1 — THORNWICK, THE WRONG BELLS ================================
  return: {
    id: 'return', kind: 'story', art: { imageId: 'loc-town', emoji: '🔔' },
    text: [
      '{thornwick} by night, and the bells are ringing, but not to count the hour. Somebody who has forgotten how bells work is hauling on the rope in a panic.',
      'Last season your company broke the {ashfang} in their den past the marsh, and beat the hag their chief had sold himself to. You had hoped for a quiet homecoming.',
      'The gate-warden meets you on the road. His hands are raw from the bell-rope. "It\'s the **churchyard**," he manages. "The graves are *open*, and it wasn\'t shovels did it."',
      'Down the lane, past the shuttered market, cold lamplight spills across the churchyard wall. And the shadows between the stones are moving against the light.',
      { if: [{ kind: 'notFlag', flag: 'hollow-road:won' }],
        text: 'Your purse is still heavy with the reeve\'s bounty for the {ashfang}. {thornwick} keeps its word.' },
    ],
    next: [
      { id: 'go', label: 'Answer the bells', to: 'lychyard', hideWhenBlocked: true,
        requires: [{ kind: 'flag', flag: 'hollow-road:won' }], effects: OPENING },
      // A cold start: still the company that broke the Ashfang, so it still
      // has last season's bounty, about what a run through Part 1 carries.
      { id: 'go-cold', label: 'Answer the bells', to: 'lychyard', hideWhenBlocked: true,
        requires: [{ kind: 'notFlag', flag: 'hollow-road:won' }], effects: [COLD_START, ...OPENING, { kind: 'gold', amount: 250 }] },
    ],
    noBack: true,
  },
  lychyard: {
    id: 'lychyard', kind: 'battle', encounterId: 'shadow-ambush', mapId: 'corridor',
    intro: [
      'The churchyard gate hangs off its hinge. Between the headstones the darkness has come loose, and four shapes of it glide toward you across the grass. You can feel the cold coming off them. Holy ground does not slow them down at all.',
      'Behind them, by the newest grave, stands a woman in a burial shift. The lamplight goes straight through her. She turns toward you, and her face is the face of a woman three weeks buried.',
      'Draw steel, for whatever good steel does against a shadow.',
    ],
    onWin: { to: 'grave-morning', text: ['The last shadow tears on your blade and is gone. The woman in the shift sinks back into her grave without a sound, and the lamplight lies still on the grass.'] },
    // Lost before the party has met anyone who could drag them out of the fen:
    // the town carries them in, and morning still shows them the graves.
    onLoss: { to: 'lychyard-lost' },
  },
  'lychyard-lost': {
    id: 'lychyard-lost', kind: 'rest', variant: 'long', next: 'grave-morning',
    intro: [
      'The cold sinks into your bones, and you fall among the headstones. The last thing you hear is the bells.',
      'You wake in the {wander-inn} with the sun up. The bell-ringers carried you in. "The shadows went with the dark," **{mira}** says, and tears you a heel of bread. "The graves have waited this long. They can wait while you eat."',
    ],
  },
  'grave-morning': {
    id: 'grave-morning', kind: 'story', noBack: true, art: { emoji: '⛪' },
    text: [
      'Morning shows the churchyard plain, and plain is worse. A dozen graves stand open — dug *outward*, turf thrown wide from below. The dead didn\'t wait for anyone to take them. They climbed out and left on their own, and they left together.',
      'The drag-marks run through the gap in the wall and out across the water-meadows. Every one of them points the same way, straight as a drawn line: **out to the deep fen**.',
      'Every old headstone carries the same words, cut deep and green with moss. ' + LITURGY + ' {thornwick}\'s priests have said them over every grave for {thornwick-liturgy}.',
    ],
    next: [{ id: 'on', label: 'Take it to the town', to: 'town',
      effects: [
        { kind: 'journal', entry: { id: 'c-deadwalk', kind: 'clue', title: 'They Walk One Way',
          body: 'Something opened the graves from below. Every trail leads the same way. They all point into the deep fen, where the old burial mounds stand.' } }] }],
  },
  town: {
    id: 'town', kind: 'explore',
    map: {
      title: '{thornwick}', theme: 'stone', art: { imageId: 'loc-town', emoji: '🏘️' },
      camp: {}, // safe: beds and walls
      // Overworld dressing: arrive at the inn; lanes tie the town together.
      entry: ['inn'],
      roads: [
        ['inn', 'market'], ['market', 'reeve'], ['market', 'graves'],
        ['reeve', 'fen-gate'], ['graves', 'fen-gate'],
      ],
      nodes: [
        // Every company, carried in or starting cold, is the one that broke the
        // Ashfang last season, and Mira and the reeve know it.
        { id: 'inn', x: 22, y: 32, label: 'The {wander-inn}', icon: 'tok-tavern', scene: 'inn',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'reeve-task' }], to: 'inn-later' }] },
        { id: 'market', x: 44, y: 42, label: 'Market', icon: 'tok-market', scene: 'sb-market' },
        { id: 'reeve', x: 70, y: 30, label: 'The Reeve\'s Hall', icon: 'tok-house', scene: 'reeve-hall',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'reeve-task' }], to: 'reeve-done' }] },
        { id: 'graves', x: 30, y: 72, label: 'The Churchyard', icon: 'tok-temple', scene: 'grave-study',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'graves-read' }], to: 'graves-done' }] },
        // Wren waits here, by her ledger fate: an old friend if the company
        // pulled her out from under a horse in Part 1 (`saved`), the partner
        // of the scout who died under it (`lost`), a stranger otherwise; after
        // that, the road.
        { id: 'fen-gate', x: 80, y: 76, label: 'The Fen Road', icon: 'tok-gate', scene: 'fen-out',
          requires: [{ kind: 'flag', flag: 'reeve-task' }],
          note: 'The gate-warden will not open the fen road without the reeve\'s say-so. See Reeve {aldous} at his hall.',
          sceneWhen: [
            // Back from the fen: she has walked out with you already.
            { if: [{ kind: 'visited', scene: 'fen' }], to: 'fen-road' },
            { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }], to: 'fen-reunion' },
            { if: [{ kind: 'npc', npc: 'wren', fate: 'lost' }], to: 'fen-partner' },
          ] },
      ],
    },
  },
  // The company that beat the Reedwife, home again: Mira says out loud
  // what the rest of the taproom is thinking.
  inn: {
    id: 'inn', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'The {wander-inn} is full, and the drinkers are in no hurry to leave, not with the churchyard standing open across the lane. **{mira}** sets down a bowl in front of you unasked.',
      '"Well." She says it flat, and wipes the bar hard enough to take the varnish off. "I\'ll say it, since the rest of them won\'t. You saw off the {reedwife}, and this whole town drank to it. I poured. Now the dead get up and walk, and we all sleep with the lamp lit."',
      '"Not a soul in here can tell you what the one thing has to do with the other. That\'s why they keep looking at you." She tops up your cup. "Brother {halden}\'s not rung the chapel bell in a week. He walked out toward the fen with his prayer book, and he hasn\'t come back."',
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'dead' }],
        text: 'She stops with the jug still tilted. "Some of them haven\'t forgotten the chief, either. On his knees in his own hall, they say, with the hag already down." She sets the jug down. "I haven\'t forgotten it myself."' },
      '"Eat. Then go see the reeve. He\'s been pacing his hall since the bells."',
    ],
    again: ['The {wander-inn} is still full. **{mira}** slides a fresh bowl your way. "Still here? The reeve\'s still pacing his hall. Go and let him pay you."'],
    next: INN_CHOICES,
  },
  'inn-later': {
    id: 'inn-later', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'The {wander-inn} is as full as ever. {thornwick} would sooner sleep on the benches in company than alone in its own beds while the dead are walking. **{mira}** slides a bowl your way without asking.',
      '"So {aldous} hired you. Good. He pays slow, but he pays." She tops up your cup. "Put the dead back where they belong, and the town will find something else to look at. The fen will still be out there in the morning. That\'s the trouble with it."',
    ],
    next: INN_CHOICES,
  },
  'inn-rest': {
    id: 'inn-rest', kind: 'rest', variant: 'long', next: 'town',
    intro: ['A bolted door, a real bed, and the comfortable murmur of a crowded taproom below. For one night the fen can keep its dead to itself, and you sleep soundly.'],
  },
  // Stocked for a town whose dead are walking: blunt steel for bone, and
  // everything a priest would sell you if Thornwick still had one.
  'sb-market': { id: 'sb-market', kind: 'shop', title: '{thornwick} Market', next: 'town',
    npc: BRAM,
    stock: [
      'potion-healing', 'potion-greater-healing', 'alchemists-fire',
      'scroll-guiding-bolt', 'scroll-bane', 'scroll-shield-of-faith', 'scroll-command',
      'scroll-burning-hands', 'scroll-hold-person', 'scroll-magic-missile',
      'mace', 'warhammer', 'shield',
    ],
    intro: ['"Grave-trouble, they say." **{bram}** spreads his hands over the stall. "Then you\'ll be wanting silver, steel, and no questions. Two of the three I stock."'] },
  // He knows this company: it broke the Ashfang last season.
  'reeve-hall': {
    id: 'reeve-hall', kind: 'dialogue', npc: REEVE, art: { emoji: '⚖️' },
    lines: [
      'The reeve\'s hall smells of candle-wax and ledgers. **Reeve {aldous}** stands at the window with his back to you, watching the fen fog eat his water-meadows. One fist grips his chain of office like a weapon he doesn\'t know how to use.',
      '"You have returned," he says, without turning. "You broke the {ashfang} for us, and {thornwick} remembers that, one way and another. Now the marsh has sent us a new trouble. My grandfather\'s grave stands empty. We buried him in his chain of office, the twin of this one. He is gone."',
      // The chief's sale of the shallows, set down for Part 3 (where the
      // sisters hold it against the valley). A cold start has no word of him.
      // Spared is one line, true of a chief marched in or let go.
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'spared' }],
        text: 'Out past the glass, at the edge of the water-meadows, a man is cutting reeds. It is {vargan}. "Those shallows were common water in my grandfather\'s day," {aldous} says. "It is written so in my ledger. {vargan} sold them to the hag anyway, and the people off the marsh road with them. And there he is. Alive, and cutting reeds in the shallows he sold."' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'dead' }],
        text: '"Those shallows were common water in my grandfather\'s day," {aldous} says to the glass. "It is written so in my ledger. {vargan} sold them to the hag anyway, and the people off the marsh road with them. I wrote the sale down under the bounty, and the day you killed him under that."' },
      'He turns. His collar is undone, and there is ink on his cuff. "You stood in my churchyard when the bells rang, and my watch did not. So I am paying you. Follow my dead into the fen, find what calls them, and put it down."',
      '"My scout, {wren}, will meet you at the fen road. She asked for the task before I could give it. {thornwick}\'s people do not wait to be told."',
    ],
    again: ['**Reeve {aldous}** is still at his window, watching the fen fog. "The commission stands," he says, without turning. "Take it, and {wren} will meet you at the fen road."'],
    next: REEVE_TAKE,
  },
  'reeve-done': {
    id: 'reeve-done', kind: 'story', art: { emoji: '⚖️' },
    text: ['The reeve\'s clerk meets you at the door. "The commission stands, and the reeve relies upon you. He is receiving no one today." Through the doorway you can see the reeve at his window, watching the fen.'],
    next: [{ id: 'ok', label: 'Leave him to it', to: 'town' }], noBack: true,
  },
  'grave-study': {
    id: 'grave-study', kind: 'check', skill: 'medicine', dc: 12, art: { emoji: '🪦' },
    intro: ['The open graves are as the dead left them. In the bottom of the nearest, the clay still holds the shape of the body that lay there, pressed in like a boot-print. A healer\'s eye might read how it got up.'],
    // `graves-ranks`: the dead keep step, oldest first. Knowing it opens an
    // easier way past the diggers in the Undercrypt. A failed read closes it.
    success: { to: 'town', text: ['The story is in the turf. They didn\'t claw out in hunger. They *stepped* out in order, oldest graves first, called up in ranks.',
      'At the lip of the oldest grave, two heel-marks sit square in the clay. The next grave\'s pair stands one pace behind them, and the next behind that, like a file of soldiers waiting for their names.'],
      effects: [{ kind: 'setFlag', flag: 'graves-read' }, { kind: 'setFlag', flag: 'graves-ranks' }, { kind: 'xp', amount: 30 },
        { kind: 'journal', entry: { id: 'c-muster', kind: 'clue', title: 'The Dead Marched in Ranks',
          body: 'The dead left in neat rows, oldest graves first. They were not hungry. They were obeying orders. Something down there has the right to command graves, and it is using it. If you must pass among them, fall in at the back of the oldest rank.' } }] },
    failure: { to: 'town', text: ['You get mud, turf, and the underside of a churchyard. You trample the edges of three graves, and what they had to say is gone under your boots.',
      'The trails still point one way, into the fen. If the dead keep any order, you will have to learn it down there, among them.'],
      effects: [{ kind: 'setFlag', flag: 'graves-read' }] },
  },
  'graves-done': {
    id: 'graves-done', kind: 'story', art: { emoji: '🪦' },
    text: ['The churchyard lies quiet, its open graves still gaping at the sky. Nothing more walks here. All that could walk has gone ahead of you.'],
    next: [{ id: 'ok', label: 'Walk back to town', to: 'town' }], noBack: true,
  },
  // First meeting, Wren neither saved nor lost: the company walked past her
  // under the horse in Part 1, or never found her, or starts cold. Whichever,
  // she lived, and the reeve's men dug her out.
  'fen-out': {
    id: 'fen-out', kind: 'dialogue', npc: WREN, art: { imageId: 'loc-marsh', emoji: '🌫️' },
    assumes: [{ kind: 'npc', npc: 'wren', notFate: ['saved', 'lost'] }],
    again: ['{wren} is still sitting on the milestone where the raised road begins, sharpening her boot-knife. She looks up. "Ready?"'],
    lines: [
      'The cart-road ends where the old raised road begins. A young woman in the reeve\'s colours sits on a milestone there, sharpening a boot-knife. A bow lies across her knees.',
      'She favours one leg when she stands, and pretends she doesn\'t. "**{wren}**. The reeve\'s scout." She says it fast, like she practised it on the way here. She catches you looking at the leg. "A dead horse came down on me on the marsh road, last season. I was under it until the reeve\'s men dug me out, after the den fell. It holds."',
      '"' + WREN_BRIEF + '"',
    ],
    next: [{ id: 'go', label: 'Follow her onto the raised road', to: 'fen',
      effects: [...WREN_JOINS,
        { kind: 'journal', entry: { id: 'n-wren', kind: 'npc', title: '{wren}, the Reeve\'s Scout',
          body: '{wren} is Reeve {aldous}\'s scout. She is young, and she will not be left behind. She guides you through the deep fen as far as the old barrow-country.' } }] }],
  },
  // The scout under the horse died in Part 1 (Wren `lost`): she was Wren's
  // partner, {tamsin}, and this Wren is the one who came home. Worded to
  // hold however she died: covered by the company, stepped round, or never
  // found in time.
  'fen-partner': {
    id: 'fen-partner', kind: 'dialogue', npc: WREN, art: { imageId: 'loc-marsh', emoji: '🌫️' },
    assumes: [{ kind: 'npc', npc: 'wren', fate: 'lost' }],
    again: ['{wren} is still sitting on the milestone where the raised road begins, sharpening her boot-knife. She looks up. "Ready?"'],
    lines: [
      'The cart-road ends where the old raised road begins. A young woman in the reeve\'s colours sits on a milestone there, sharpening a boot-knife. A bow lies across her knees.',
      '"**{wren}**. The reeve\'s scout." She says it fast, like she practised it on the way here. "My partner was {tamsin}. A dead horse came down on her on the marsh road, the week you went for the den. Nobody got to her in time." She tests her bowstring and does not look up.',
      '"' + WREN_BRIEF + '"',
    ],
    next: [{ id: 'go', label: 'Follow her onto the raised road', to: 'fen',
      effects: [...WREN_JOINS,
        { kind: 'journal', entry: { id: 'n-wren', kind: 'npc', title: '{wren}, the Reeve\'s Scout',
          body: '{wren} is Reeve {aldous}\'s scout. Her partner {tamsin} was the scout under the dead horse on the marsh road. She guides you through the deep fen as far as the old barrow-country.' } }] }],
  },
  // Reunion: the company saved her on the marsh road in Part 1.
  'fen-reunion': {
    id: 'fen-reunion', kind: 'dialogue', npc: WREN, art: { imageId: 'loc-marsh', emoji: '🌫️' },
    assumes: [{ kind: 'npc', npc: 'wren', fate: 'saved' }],
    again: ['{wren} is still sitting on the milestone where the raised road begins, sharpening her boot-knife. She looks up. "Ready?"'],
    lines: [
      'The cart-road ends where the old raised road begins. **{wren}** sits on a milestone there, putting an edge on a boot-knife, upright this time and with no dead horse on top of her. Someone has mended the reeve\'s colours at her shoulder.',
      '"Heard the bells. Figured you\'d be along." She stands, and only barely favours the leg. "' + WREN_BRIEF + '"',
    ],
    next: [{ id: 'go', label: 'Follow her onto the raised road', to: 'fen',
      effects: [...WREN_JOINS,
        { kind: 'journal', entry: { id: 'n-wren', kind: 'npc', title: '{wren}, Again',
          body: '{wren} is the scout you pulled from under a dead horse on the marsh road. Her leg has healed, and she refuses to stay behind. She guides you through the deep fen as far as the old barrow-country.' } }] }],
  },
  'fen-road': {
    id: 'fen-road', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🌫️' },
    text: ['The old raised road runs out into the fog, the same as before. The fen waits at the end of it.'],
    next: [
      { id: 'go', label: 'Walk out along the raised road', to: 'fen' },
      { id: 'back', label: 'Walk back to town', to: 'town' },
    ], noBack: true,
  },

  // === ACT 2 — THE DEEP FEN ==============================================
  fen: {
    id: 'fen', kind: 'explore',
    map: {
      title: 'The Deep Fen', theme: 'bog', art: { imageId: 'loc-marsh', emoji: '🌫️' },
      camp: { risky: { chance: 0.4, battleScene: 'fen-night' } },
      entry: ['causeway'],
      paths: [
        ['causeway', 'chapel'], ['causeway', 'lights'],
        ['chapel', 'pool'], ['chapel', 'lychgate'], ['lights', 'lychgate'],
      ],
      nodes: [
        { id: 'causeway', x: 14, y: 55, label: 'The Raised Road', icon: 'tok-tracks', scene: 'causeway',
          // Wren reads the old road; a party that skipped it until she was
          // left at the Barrow Gate only sees the prints.
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'fen-read' }], to: 'causeway-done' },
            { if: [{ kind: 'noCompanion', companion: 'wren' }], to: 'causeway-done' }] },
        { id: 'chapel', x: 42, y: 34, label: 'The Drowned Chapel', mystery: 'A sunken bell-tower…', icon: 'tok-temple', scene: 'chapel',
          // Met and fought (then fled, or fell): the chapel's `again` text.
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'chapel-cleared' }], to: 'chapel-done' }] },
        { id: 'lights', x: 44, y: 76, label: 'The Corpse-Lights', mystery: 'Pale fire over the water…', icon: 'tok-danger', scene: 'lights',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'lights-skirted' }], to: 'lights-skirted-done' },
            { if: [{ kind: 'flag', flag: 'lights-cleared' }], to: 'lights-done' }] },
        // Optional, so it may come after Wren has stayed at the Barrow Gate.
        { id: 'pool', x: 66, y: 22, label: 'The Serpent Pool', mystery: 'Ripples with no wind…', icon: 'tok-well', scene: 'pool',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'pool-cleared' }], to: 'pool-done' },
            { if: [{ kind: 'noCompanion', companion: 'wren' }], to: 'pool-alone' }] },
        { id: 'lychgate', x: 78, y: 56, label: 'The {barrow-gate}', mystery: 'Standing stones ahead…', icon: 'tok-gate', scene: 'lychgate',
          requires: [{ kind: 'flag', flag: 'chapel-cleared' }, { kind: 'flag', flag: 'lights-cleared' }],
          note: 'Every trail to the barrows runs past the drowned chapel and the corpse-lights. Deal with both first.',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'lychgate-cleared' }], to: 'lychgate-open' }] },
      ],
    },
  },
  causeway: {
    id: 'causeway', kind: 'story', art: { imageId: 'loc-marsh', emoji: '👣' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    again: ['{wren} still crouches at the edge of the raised road, reading the files of footprints. "Same as before," she says. "Nothing\'s come back the other way."'],
    text: [
      'The old raised road was here long before the cart-track that meets it. Each of its great flat stones would take a team of oxen to shift. {wren} crouches at its edge and reads the mud, slow and careful.',
      '"Here. And here." Footprints, water-filled, in files. "Your churchyard dead came through in *step*. And look at this." She points to older prints, sunk deeper and wider. "They weren\'t the first. The fen\'s own dead have been walking for days. Whatever\'s calling has been at it a while, and it isn\'t calling them to wander. It\'s calling them to **work**."',
      '{wren} frowns at one print and sets her thumb in it. "This one has nails in the heel. The dead don\'t buy boots. Somebody **living** walked out here with them."',
      'There are two ways on: north to the broken tower of the **drowned chapel**, or south across the flat water where the **corpse-lights** dance. Past them both, where all the tracks come together, the barrow-country waits.',
    ],
    next: [{ id: 'on', label: 'Head into the fen', to: 'fen',
      effects: [{ kind: 'setFlag', flag: 'fen-read' },
        { kind: 'journal', entry: { id: 'c-work', kind: 'clue', title: 'Called to Work',
          body: 'The fen\'s own dead have walked for days, in rows, past the chapel and the corpse-lights toward the old barrow-country. The thing calling them is putting them to work. It is digging something open, or building something. One set of prints had nailed boots. Someone living walked with them.' } }] }],
  },
  'causeway-done': {
    id: 'causeway-done', kind: 'story', art: { emoji: '👣' },
    text: ['The old road\'s stones stretch on into the fog. The files of footprints are still there, filling slowly with water.'],
    next: [{ id: 'ok', label: 'Leave the footprints to the water', to: 'fen' }], noBack: true,
  },
  'fen-night': {
    id: 'fen-night', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'marsh-dead', mapId: 'bog',
    intro: ['You wake to a hand on your shoulder and a blade already drawn beside you. Two shapes are crawling out of the black water toward the fire, grave-mud to the elbows and teeth bared. They do not hurry. They have done this before.'],
    onWin: { to: '@hub', text: ['The ghouls lie still, properly still this time, and the fire is out. By torchlight you find their tracks, leading back into the black water they crawled out of. It is a long while before anyone\'s hands are steady enough to bank the fire again.'] },
  },
  chapel: {
    id: 'chapel', kind: 'dialogue', npc: HALDEN, art: { imageId: 'loc-temple', emoji: '🕯️' },
    lines: [
      'The chapel kneels in the water, drowned to its windows, its bell-tower leaning like a man listening. Candles burn on every ledge. Most are plain white wax. A few are **black tallow**, and they smoke like wet wood. On the dry island of the altar steps stands a priest. His robes are fen-stained, his face serene. He is leading a congregation.',
      'The congregation is dead. They stand in the water in row after row, mud-black and empty-eyed, every face turned to the altar.',
      { assumes: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} grips your arm. "That\'s **Brother {halden}**," she whispers. "He kept the little chapel in {thornwick}. Mildest man in the valley. He could never get a room to go quiet."' },
      '"**Welcome!**" {halden} beams at you with terrible peace, and the whole room goes quiet for him. "You\'ve come to see the great work. The {warden} below is gathering his flock at last. I merely… keep the service, until he calls them down. Will you kneel? Everyone kneels down here, sooner or later."',
    ],
    // Back after falling back or a wipe: no second sermon.
    again: ['The drowned congregation still stands in its rows, and {halden} still waits on the altar steps. "You came back," he says, and beams. "Everyone does, sooner or later."'],
    next: [
      // Saving Halden: the thing wearing him borrowed his prayers, so his own
      // words for the dead can turn it out. One try (`liturgy`), always
      // offered; a read of him first (`chapel-read`) makes it easier, and a
      // failed read costs nothing but the read.
      { id: 'insight', label: '[Insight DC 13] Read what is wearing him', to: 'chapel-read',
        once: true, check: { skill: 'insight', dc: 13, failTo: 'chapel-unread' } },
      LITURGY_TRY(14),
      { id: 'refuse', label: 'Refuse the sermon and draw', to: 'chapel-fight' },
    ],
  },
  // The read came to nothing: he is as calm as a millpond, and still asking.
  'chapel-unread': {
    id: 'chapel-unread', kind: 'story', noBack: true, art: { imageId: 'loc-temple', emoji: '🕯️' },
    text: ['You watch him for a long breath and learn nothing. His calm is perfect all the way down, if there is a man under it at all. "Will you kneel?" {halden} asks again, gently, as if you might not have heard.'],
    next: [LITURGY_TRY(14), { id: 'refuse', label: 'Refuse the sermon and draw', to: 'chapel-fight' }],
  },
  // Read him: strike first, or speak to the man still under it.
  'chapel-read': {
    id: 'chapel-read', kind: 'story', noBack: true, art: { imageId: 'loc-temple', emoji: '👁️' },
    text: [
      'You see it a breath before it moves. Something winds up through {halden}\'s calm like rot up a post. His smile belongs to it, and so does his voice.',
      'But his hands are shaking on the altar rail, and somewhere under that thing {halden} is still in there. The words he said over {thornwick}\'s dead might reach him. Or you could strike now, while it still thinks you came to listen.',
    ],
    next: [
      { id: 'strike', label: 'Strike before it moves', to: 'chapel-caught' },
      // Knowing where the man is, the words find him more easily.
      LITURGY_TRY(11),
    ],
  },
  // The liturgy, said wrong: the thing in him takes the words for its own.
  'chapel-unheard': {
    id: 'chapel-unheard', kind: 'story', noBack: true, art: { imageId: 'loc-temple', emoji: '🕯️' },
    text: [
      'You say the words {halden} said over {thornwick}\'s dead, the ones cut on every old headstone. ' + LITURGY,
      'They come out wrong, or too late. {halden}\'s smile only widens. "Yes," says the thing in his mouth. "*The bell will wake you.* That is the whole of the promise." His acolytes step down off the altar, and the dead in the water turn toward you.',
    ],
    next: [{ id: 'fight', label: 'Draw steel', to: 'chapel-fight' }],
  },
  'chapel-fight': {
    id: 'chapel-fight', kind: 'battle', encounterId: 'drowned-chapel', mapId: 'ruins',
    intro: ['{halden} sighs, a shepherd let down by his flock. Two skeletons in rotted mourning-clothes wade out of the rows, and behind them two of his drowned parishioners, grey and gnawing. Two acolytes in {thornwick}\'s chapel colours step up beside him, their eyes as empty as the dead\'s. "The {warden} provides," says {halden}, and sets them on you.'],
    again: ['{halden} sighs again, a shepherd let down twice. "The {warden} provides," he says, and his acolytes and his dead come for you once more.'],
    onWin: { to: 'chapel-won', text: ['{halden} sinks down on the altar steps and does not rise again. At the end, he mostly looks relieved.'] },
  },
  'chapel-caught': {
    id: 'chapel-caught', kind: 'battle', encounterId: 'drowned-chapel', mapId: 'ruins',
    surprise: 'enemies',
    intro: ['You\'re already moving when his two acolytes step forward and his dead wade out of the rows, two skeletons and two grey, gnawing parishioners. For once the dead are the ones caught flat-footed.'],
    onWin: { to: 'chapel-won', text: ['The dead are still shuffling into their rows when the last of them falls. {halden} slumps against the altar rail. The thing wearing him lets go, and he dies looking almost grateful.'] },
  },
  // Halden lives: he tells the party himself what the dead man's book says.
  'chapel-saved': {
    id: 'chapel-saved', kind: 'dialogue', noBack: true, npc: HALDEN, art: { imageId: 'loc-temple', emoji: '📖' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    lines: [
      'You know the words {halden} said over {thornwick}\'s dead. They are cut on every old headstone in his churchyard. You say them back to him, slow and plain. ' + LITURGY,
      'The thing inside {halden} lets go of him all at once, like a hand opening, and his dead fold down into the water. He sits hard on the altar steps, shaking and himself again. Behind him his acolytes sit up in the shallows, coughing fen-water. "It came up through the *prayers*," he says. "A grey little gravedigger brought me black candles. He said his name was **{marrow}**, and I *thanked* him."',
      'He looks up at the leaning bell-tower. "I rang the drowned bell up there every night, the way I ring my own at home. *The bell will wake you.* We say it over every grave. I thought it was a promise." He swallows. "It was a summons. I rang, and they woke."',
      // "We" only from the Wren who mapped the den for the company in Part 1.
      { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }], text: 'He pushes his prayer book into your hands. "The **{reedwife}** was never just a hag. She was a jailer. The fen-folk left her a {door-price} at the water\'s edge each {door-midwinter}, and for that she kept the **{warden} of the Barrows** asleep under the fen. When she was gone from that door, his seal broke. Now he calls the dead to open his door from the inside." {wren} lets out a breath. "We drank to her fall," she says.' },
      { if: [{ kind: 'npc', npc: 'wren', notFate: ['saved'] }], text: 'He pushes his prayer book into your hands. "The **{reedwife}** was never just a hag. She was a jailer. The fen-folk left her a {door-price} at the water\'s edge each {door-midwinter}, and for that she kept the **{warden} of the Barrows** asleep under the fen. When she was gone from that door, his seal broke. Now he calls the dead to open his door from the inside." {wren} lets out a breath. "The whole town drank to her fall," she says.' },
      '{halden} lifts the altar cloth and hands you a healing potion. "I bought it in {thornwick} for a bad night," he says. "I think yours will be worse."',
      'He taps the flyleaf, where he has inked a mark of reeds and a reaching hand. "She wore it as her brand, but it was the vigil\'s mark first. The old builders cut it into the {barrow-gate}, and the gate\'s watchers still know it. The rites of sealing are at the back. Someone must say them whole at his door, and it will take nerve. I\'ll follow you down and wait on the stair." {wren} puts her own cloak round his shoulders. "Nerve we\'ve got," she says.',
    ],
    // Talked down, not fought: the chapel's fight is still earned.
    next: [{ id: 'on', label: 'Take the prayer book', to: 'fen',
      // Wren has known him all her life: she saw who reached for him.
      effects: [...CHAPEL_CLEARED, { kind: 'npc', npc: 'halden', fate: 'saved' }, { kind: 'xp', amount: avoidedFightXP('drowned-chapel') },
        { kind: 'npc', npc: 'wren', attitude: 1 },
        { kind: 'journal', entry: { id: 'n-halden', kind: 'npc', title: 'Brother {halden}',
          body: '{halden} keeps {thornwick}\'s little chapel. Something under the fen took hold of him through his own prayers, and you talked it out of him. He has promised to follow you down to the {warden}\'s door.' } }] }],
  },
  'chapel-won': {
    id: 'chapel-won', kind: 'story', noBack: true, art: { imageId: 'loc-temple', emoji: '📖' },
    assumes: [{ kind: 'companion', companion: 'wren' }, { kind: 'npc', npc: 'halden', notFate: ['saved'] }],
    text: [
      '{halden}\'s prayer book lies open on the altar, fen-damp but easy to read. Notes crowd the margins in his tidy hand, and the first of them is almost cheerful. *Found it in the old pages at last. The {door-price} each {door-midwinter} was never an offering. It was her wage. The {reedwife} was the {warden}\'s jailer, and we paid her to keep him asleep.*',
      'The next note is shorter. *She is gone from her door, and he is waking.* Below that: *It has me ring the drowned tower\'s bell each night. The bell will wake you, we tell the dead. Forgive me. It does.*',
      'Further down the hand starts to shake, and the nib tears the page. *The rites of sealing are on the last three pages. Someone must say them at his door, in the great barrow, and it will take nerve. Not me. It will not let it be me.* On the flyleaf someone has inked a mark of reeds and a reaching hand, and beside it, steady again: *Her brand. It was the vigil\'s mark before she took it. The old builders cut it on the {barrow-gate}, and the watchers there still know it.*',
      { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }],
        text: '"That\'s the hag\'s brand," {wren} says, reading over your shoulder. "You saw it on those lizardfolk in the hollow. Every marsh-thing that ran with the {ashfang} wore it." She reads the second note twice. "We drank to her fall," she says. She shuts the book and hands it to you. "The door\'s past the {barrow-gate}. I\'ll get you that far."' },
      { if: [{ kind: 'npc', npc: 'wren', notFate: ['saved'] }],
        text: '"That\'s the hag\'s brand," {wren} says, reading over your shoulder. "They say you saw it on those lizardfolk in the hollow. Every marsh-thing that ran with the {ashfang} wore it." She reads the second note twice. "The whole town drank to her fall," she says. She shuts the book and hands it to you. "The door\'s past the {barrow-gate}. I\'ll get you that far."' },
      'Under the altar cloth you find a healing potion that {halden} never got to drink. On the way out, {wren} sniffs one of the black candles and makes a face. "{halden} never bought these in {thornwick}. Somebody brought them out here."',
    ],
    next: [{ id: 'on', label: 'Take the prayer book', to: 'fen', effects: CHAPEL_CLEARED }],
  },
  'chapel-done': {
    id: 'chapel-done', kind: 'story', art: { imageId: 'loc-temple', emoji: '🕯️' },
    text: ['The drowned chapel stands empty. Its awful congregation lies still at last, and the candles have burned out. The bell-tower still leans, listening to nothing.'],
    next: [{ id: 'ok', label: 'Head back into the fen', to: 'fen' }], noBack: true,
  },
  // The corpse-lights: fight them (after resisting their pull), or walk round
  // the pools by the firm ground. Either way finds the drowned folk's purses.
  lights: {
    id: 'lights', kind: 'story', art: { emoji: '💡' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    again: ['The corpse-lights still sway over the black water, warm as windows. {wren} keeps a hand on your sleeve. "Still there," she says. "Still hungry."'],
    text: [
      'The flat water south of the old road is where the fen does its prettiest lying. Lights hang over the black mirror — soft, swaying, warm as windows. {wren}\'s face goes carefully blank. "Corpse-candles. They walk mourners into the deep pools and hold them under. Half the people the fen has taken this year are *under this water*."',
      'The lights drift nearer, hopeful as dogs. Other things move between them, further out. They are two colder things, still in the clothes they drowned in.',
      '"We don\'t have to go through," {wren} says quietly. "There\'s firm ground round the pools, if you can find it. Miss it, and the lights find *you*."',
    ],
    next: [
      { id: 'fight', label: 'Snuff them out', to: 'lights-call' },
      // A druid or a ranger reads the firm ground easier, but it is still a
      // roll, and a miss puts them in the water like anyone else.
      { id: 'druid', label: '[Druid · Nature DC 10] Read the fen like a map, and walk round', to: 'lights-skirted',
        requires: [{ kind: 'classInParty', classId: 'druid' }], hideWhenBlocked: true,
        attempt: 'firm-ground', check: { skill: 'nature', dc: 10, failTo: 'lights-sunk' } },
      { id: 'ranger', label: '[Ranger · Survival DC 10] Follow the reeds that only grow on firm ground', to: 'lights-skirted',
        requires: [{ kind: 'classInParty', classId: 'ranger' }], hideWhenBlocked: true,
        attempt: 'firm-ground', check: { skill: 'survival', dc: 10, failTo: 'lights-sunk' } },
      { id: 'skirt', label: '[Survival DC 13] Find the dry way round the pools', to: 'lights-skirted',
        attempt: 'firm-ground', check: { skill: 'survival', dc: 13, failTo: 'lights-sunk' } },
      { id: 'leave', label: 'Back away from the water', to: 'fen' },
    ],
  },
  // Their pull, resisted or not, before every fight with them.
  'lights-call': {
    id: 'lights-call', kind: 'check', skill: 'insight', dc: 12, roller: 'group', art: { emoji: '💡' },
    intro: [
      'The lights turn toward you all at once. They don\'t make a sound, but you hear them anyway. They sound like home, and supper, and someone calling your name across a field.',
      'Your feet want to walk to them. Every one of you has to decide not to.',
    ],
    success: { to: 'lights-fight', text: ['You know a lie when it sings to you. You plant your boots in the mud and stay where you are. The lights stop pretending.'] },
    failure: { to: 'lights-lured', text: ['The water is at your knees before you notice it, and then at your waist. The lights close in around you, and they are not warm at all.'] },
  },
  'lights-fight': {
    id: 'lights-fight', kind: 'battle', encounterId: 'corpse-lights', mapId: 'bog',
    intro: ['Four of the lights come in low and fast over the water, crackling with stolen life. The two drowned things rise between them, trailing fen-mist, their mouths open on screams the water drank years ago.'],
    again: ['The four lights come in low over the water again. The drowned things rise between them, their mouths still open on those screams.'],
    onWin: { to: 'lights-won', text: ['The last wisp winks out, and the water goes dark for good.'] },
  },
  // Missed the firm ground: in the water before the lights even sing.
  'lights-sunk': {
    id: 'lights-sunk', kind: 'story', noBack: true, art: { emoji: '💡' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: ['You think you have found the firm ground, and three steps later it is not there. You go in to the waist, and the lights come gliding over the water before anyone can pull you out.'],
    next: [{ id: 'on', label: 'Fight your way back to the mud', to: 'lights-lured' }],
  },
  // The same fight, caught waist-deep after the lights' pull won.
  'lights-lured': {
    id: 'lights-lured', kind: 'battle', encounterId: 'corpse-lights', mapId: 'bog',
    surprise: 'party',
    intro: ['Four wisps flare white-hot in front of your faces. Two cold things rise out of the pool behind you, close enough to touch. You have to fight your way back to the mud before you can fight anything else.'],
    onWin: { to: 'lights-won', text: ['You drag each other out onto the mud, soaked and shaking. Behind you the last wisp is out, and the water lies dark and still.'] },
  },
  // The drowned folk's purses, and a body that isn't one of them.
  'lights-won': {
    id: 'lights-won', kind: 'story', art: { emoji: '💰' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: [
      'In the shallows you find the drowned, with their purses still tied at their belts. There are {drowned-purses} purses, {drowned-gold} between them, and two hold a stoppered healing potion against the fen-fever.',
      'One body is not like the others. It wears long robes the colour of grave-worms, and a stub of **black candle** sits in its belt. {wren} turns it over with her boot. "That\'s no fen-folk," she says. "No one from here dresses like that to go walking."',
      PURSES_ASK,
    ],
    next: purseChoices([]),
    noBack: true,
  },
  // The purses kept: Wren has one thing to say about it, and says it once.
  // The purses carried home: Wren's one line on it.
  'lights-home': {
    id: 'lights-home', kind: 'story', noBack: true, art: { emoji: '💰' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: ['{wren} helps you tie the purses into a bundle. She counts them twice. "{^drowned-purses}," she says. "That\'s {drowned-purses} families." She carries the bundle herself, and walks a little straighter for it.'],
    next: [{ id: 'on', label: 'Follow her into the fen', to: 'fen' }],
  },
  'lights-kept': {
    id: 'lights-kept', kind: 'story', noBack: true, art: { emoji: '💰' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: ['{wren} watches you fill your pockets with the drowned folk\'s coin and their two potions. She says nothing for a while. "Somebody\'s gran," she says at last, and walks on ahead.'],
    next: [{ id: 'on', label: 'Follow her into the fen', to: 'fen' }],
  },
  // Round the pools on firm ground: the lights stay lit, but nobody has to
  // wade in, and Wren spots the drowned folk where the reeds hold them.
  'lights-skirted': {
    id: 'lights-skirted', kind: 'story', art: { emoji: '🌾' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: [
      'You find the firm ground and keep to it, one tussock to the next. The lights follow along the water\'s edge, swaying, waiting for a foot to slip. None does.',
      'Halfway round, {wren} grabs your sleeve and points. The drowned lie in the reeds at the pool\'s edge where the lights let them go, with their purses still tied at their belts. There are {drowned-purses} purses, {drowned-gold} between them, and two hold a stoppered healing potion against the fen-fever.',
      'One body is not like the others. It wears long robes the colour of grave-worms. "That\'s no fen-folk," {wren} whispers. "Not in those robes." The lights drift closer.',
      PURSES_ASK,
    ],
    next: purseChoices([{ kind: 'setFlag', flag: 'lights-skirted' }, { kind: 'xp', amount: avoidedFightXP('corpse-lights') }]),
    noBack: true,
  },
  'lights-skirted-done': {
    id: 'lights-skirted-done', kind: 'story', art: { emoji: '💡' },
    text: ['The corpse-lights still sway over the flat water, patient as ever. You found the firm ground once, and you would rather not ask the fen for it twice.'],
    next: [{ id: 'ok', label: 'Head back into the fen', to: 'fen' }], noBack: true,
  },
  'lights-done': {
    id: 'lights-done', kind: 'story', art: { emoji: '🌑' },
    text: ['The flat water lies dark and truthful, and nothing dances over it now.'],
    next: [{ id: 'ok', label: 'Head back into the fen', to: 'fen' }], noBack: true,
  },
  pool: {
    id: 'pool', kind: 'story', art: { emoji: '🐍' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    again: ['The serpent pool lies still again, too still. {wren} watches the rim for ripples, and keeps well back from it.'],
    text: [
      'North of the chapel the reeds part around a pool so still it looks solid. Old offerings crowd the rim: coins, combs, grinding-stones. The surface moves once, with no wind to move it, in a line longer than a boat.',
      '{wren} picks up a coin and puts it back with great care. "The fen-folk fed the pool so the pool stayed *in* the pool. Since the dead took to the fen roads, not one of them has dared come out this far with a coin." The water ripples again, closer. {wren} takes one careful step back. "It will be hungry."',
    ],
    next: [
      { id: 'wren', label: 'Let {wren} draw it out from the far bank', to: 'pool-drawn',
        requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true },
      ...POOL_CHOICES,
    ],
  },
  'pool-alone': {
    id: 'pool-alone', kind: 'story', art: { emoji: '🐍' },
    text: [
      'North of the chapel the reeds part around a pool so still it looks solid. Old offerings crowd the rim: coins, combs, grinding-stones. Fen-folk have been feeding something here for generations. The surface moves once, with no wind to move it, in a line longer than a boat.',
      'The newest offering on the rim is already green with fen-damp. The water ripples again, closer to the rim, as if it has noticed.',
    ],
    again: ['The serpent pool lies still again, and the offerings on its rim gleam. The water has not forgotten you.'],
    next: POOL_CHOICES,
  },
  'pool-fight': {
    id: 'pool-fight', kind: 'battle', encounterId: 'snake-pit', mapId: 'marsh',
    intro: ['The pool empties itself at you. Two snakes the girth of roof-beams pour over the rim in oiled coils. A century of offerings fed them to that size, and lately so has anyone who walked too close.'],
    again: ['The pool empties itself at you again. The two fen-serpents pour over the rim in their oiled coils, as hungry as before.'],
    onWin: POOL_WON,
  },
  // Wren's fen-craft: rattle the reeds on the far bank, and the serpents rise
  // there with their backs to you.
  'pool-drawn': {
    id: 'pool-drawn', kind: 'battle', encounterId: 'snake-pit', mapId: 'marsh',
    surprise: 'enemies',
    intro: [{ assumes: [{ kind: 'companion', companion: 'wren' }], text: '{wren} creeps round to the far bank and rattles her bow in the reeds there, the way fen-folk hunt eels. The water bulges on her side of the pool. Two constrictors the girth of roof-beams rise toward the noise, and they have their backs to you.' }],
    again: [{ assumes: [{ kind: 'companion', companion: 'wren' }], text: '{wren} creeps round to the far bank again and rattles the reeds. The serpents fall for it twice. They rise toward her with their backs to you.' }],
    onWin: POOL_WON,
  },
  'pool-done': {
    id: 'pool-done', kind: 'story', art: { emoji: '💧' },
    text: ['The serpent pool sits quiet, and the offerings on its rim gleam dully. It is deep and cold, and finally ordinary.'],
    next: [{ id: 'ok', label: 'Head back into the fen', to: 'fen' }], noBack: true,
  },
  // The Barrow Gate: a first sight of its watchers, then the fight. A party
  // back after falling back (or a wipe) gets `again`, not the first sight.
  lychgate: {
    id: 'lychgate', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛩️' },
    text: [
      'All the tracks come together here, and the barrow-country begins. A gate of standing stones rises ahead, the **{barrow-gate}**, mossed to the knees. Two weathered granite watchers crouch on top of it. In the gateway below them, an empty suit of green-bronze armour leans on its spear.',
      { assumes: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} stops dead. "Those weren\'t in anybody\'s stories." The stone bases are mossy, but the watchers\' claws are clean, and so is the spear.' },
    ],
    again: [{ assumes: [{ kind: 'companion', companion: 'wren' }],
      text: 'The two granite watchers crouch on the {barrow-gate} again, whole, with their wings folded, and the green-bronze armour leans in the gateway below. {wren} nocks an arrow and says nothing.' }],
    next: [{ id: 'on', label: 'Walk up to the gate', to: 'lychgate-fight' }],
  },
  'lychgate-fight': {
    id: 'lychgate-fight', kind: 'battle', encounterId: 'barrow-watchers', mapId: 'ruins',
    intro: ['The nearest watcher turns its head with a sound like a millstone. The granite stretches, cracks its wings, and drops on you like a falling roof. Below it, the empty armour lifts its spear and steps out of the gateway.'],
    onWin: { to: 'lychgate-won', text: ['The second gargoyle shatters mid-dive and rains down as plain gravel, over the green-bronze plates scattered across the road. The {barrow-gate} stands unwatched now. Beyond it, the field of burial mounds opens out ahead of you.'] },
    // The watchers were set to guard the vigil, not to fight it. Halden's book
    // carries the vigil's mark, if someone knows the old way to show it.
    parley: {
      skill: 'history', dc: 14, label: 'Show them the vigil\'s mark in {halden}\'s book',
      refused: ['You hold up {halden}\'s book, but you cannot find the builders\' mark on the gate in time. The watchers see only strangers at the vigil\'s door, and they keep coming.'],
      success: { to: 'lychgate-won', text: [
        'You hold up {halden}\'s book, open at the reed-woman\'s mark on the flyleaf. The old builders cut that same mark into the gate. You find it on the nearest stone and lay your hand flat on it.',
        'The watchers stop at the edge of the lintel. They look at the book for a long, grinding moment, then fold their wings and turn back into plain grey stone. Below them, the armour grounds its spear and stands aside.',
      ], effects: [{ kind: 'setFlag', flag: 'watchers-stilled' }, { kind: 'xp', amount: avoidedFightXP('barrow-watchers') }] },
    },
  },
  // Wren stays here. Every way down the steps sends her to her post.
  'lychgate-won': {
    id: 'lychgate-won', kind: 'story', noBack: true, art: { imageId: 'loc-crypt', emoji: '⛩️' },
    // Every way into the fen joins her, and only this scene parts her.
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: [
      'Past the {barrow-gate} the mounds rise in their dozens. At the field\'s heart the largest barrow stands **open**. Not fallen in, but *unlocked*. A doorway of dressed stone breathes out cold. Worked steps lead down. Every file of the walking dead leads down into it like thread into a needle.',
      'Letters are cut into the lintel over the doorway, worn almost smooth.',
      '{wren} scrapes the moss out of them with her thumbnail and reads them aloud, slowly. "*Here is the **{undercrypt}**. Let it stay shut.*" She wipes her thumb on her coat.',
      '{wren} looks at the steps, then at you. "I don\'t know the ground past here," she says. "I\'ll hold the gate."',
      // What she makes of the company so far (her `attitude`): plain on a cold
      // start, warm once earned, cool once lost.
      { if: [{ kind: 'companion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { atLeast: 0, below: 2 } }],
        text: '"Shout if it goes bad. I\'ll hear you from up here."' },
      { if: [{ kind: 'companion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }],
        text: '"Someone has to be standing here when you walk back out." You pretend, kindly, not to hear the *when* she leans on.' },
      { if: [{ kind: 'companion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }],
        text: 'She ties a strip of the reeve\'s colours round your arm, quick and tight, and does not explain it.' },
      { if: [{ kind: 'companion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
        text: 'She does not wish you luck. She checks her bowstring instead, and watches the fen, not you.' },
    ],
    next: [
      { id: 'down', label: 'Leave {wren} the gate, and go down', to: 'undercrypt',
        requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true,
        effects: [{ kind: 'leaveParty', companion: 'wren' },
          { kind: 'setFlag', flag: 'lychgate-cleared' }, { kind: 'setFlag', flag: 'undercrypt-found' }] },
      // Asking is always the company's to do; the answer is hers (her
      // `attitude`). One of the two shows, under the same words.
      { id: 'ask', label: 'Ask {wren} to come down with you', to: 'lychgate-wren-comes',
        requires: [{ kind: 'companion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'lychgate-cleared' }, { kind: 'setFlag', flag: 'undercrypt-found' }] },
      { id: 'ask-no', label: 'Ask {wren} to come down with you', to: 'lychgate-wren-stays',
        requires: [{ kind: 'companion', companion: 'wren' }, { kind: 'npc', npc: 'wren', attitude: { below: 2 } }], hideWhenBlocked: true,
        effects: [{ kind: 'leaveParty', companion: 'wren' },
          { kind: 'setFlag', flag: 'lychgate-cleared' }, { kind: 'setFlag', flag: 'undercrypt-found' }] },
    ],
  },
  // Asked, by a company she would follow anywhere: she comes down.
  'lychgate-wren-comes': {
    id: 'lychgate-wren-comes', kind: 'story', noBack: true, art: { imageId: 'loc-crypt', emoji: '🏹' },
    assumes: [{ kind: 'companion', companion: 'wren' }],
    text: [
      '{wren} looks at the strip of colours she has just tied round your arm. Then she unties it, and ties it round her own. "Fine," she says. "I still don\'t know the ground down there. I know you."',
      'She lights a second torch from yours and takes the first step down before anyone can think better of it. Behind you the {barrow-gate} stands empty.',
    ],
    next: [{ id: 'down', label: 'Follow her down the steps', to: 'undercrypt' }],
  },
  // Asked, by a company she does not trust that far: she keeps the gate.
  'lychgate-wren-stays': {
    id: 'lychgate-wren-stays', kind: 'story', noBack: true, art: { imageId: 'loc-crypt', emoji: '⛩️' },
    assumes: [{ kind: 'noCompanion', companion: 'wren' }],
    text: [
      { if: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 0 } }],
        text: '{wren} shakes her head. "Down there I\'m one more thing for you to watch. Up here I\'m some use."' },
      { if: [{ kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
        text: '"No," {wren} says. "I said I\'d get you to the barrow-country, and I have."' },
      'She sits down on the nearest stone with her bow across her knees, facing the fen. You leave her at her post and start down the worked steps.',
    ],
    next: [{ id: 'down', label: 'Go down into the {undercrypt}', to: 'undercrypt' }],
  },
  'lychgate-open': {
    id: 'lychgate-open', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛩️' },
    // Only text reads `watchers-stilled`, so it costs the reach search nothing.
    text: [
      { if: [{ kind: 'notFlag', flag: 'watchers-stilled' }], text: 'The {barrow-gate} stands unwatched, its broken guardians spread across the old road as gravel and green bronze.' },
      { if: [{ kind: 'flag', flag: 'watchers-stilled' }], text: 'The {barrow-gate}\'s two watchers crouch on the lintel as plain grey stone, wings folded, and the armour stands aside in the gateway. None of them stirs as you pass.' },
      'Beyond, the great barrow\'s doorway breathes out cold.',
      // Unless she came down with the company (`lychgate-wren-comes`).
      { if: [{ kind: 'noCompanion', companion: 'wren' }],
        text: '{wren} keeps her post at the stones, arms wrapped tight against more than the chill.' },
    ],
    next: [{ id: 'down', label: 'Go down into the {undercrypt}', to: 'undercrypt' }], noBack: true,
  },

  // === ACT 3 — THE UNDERCRYPT ============================================
  // A dungeon: down the stair, past the painted hall (the bone room behind a
  // hidden door), through the cut where Thornwick's dead are digging, past
  // the barrow-guard to the king. The diggers and the guard each bar the way
  // until dealt with. Behind the king, the burial shaft drops one way into
  // `warden-stair`, which the cult's candles light: no torch below the drop,
  // so the dark can never claim the party climbed back out past it.
  undercrypt: {
    id: 'undercrypt', kind: 'dungeon',
    dungeon: {
      title: 'The {undercrypt}', theme: 'graveyard', art: { imageId: 'loc-crypt', emoji: '🕳️' },
      emptySearches: [
        'You lift a slab, and find packed earth and roots under it. The builders hid nothing here.',
        'Every niche is empty. The walking dead took their grave-goods with them when they went down to dig.',
        'Your torch finds old chisel-marks and a painted eye, flaking off the stone. Nothing else.',
        'You sift the dust by hand. It is mostly the dead, and they carried nothing.',
      ],
      torch: { length: 16, out: 'crypt-dark' },
      // Enemy ground: two nights' sleep down here in the chapter, then only short rests.
      camp: { nights: 2, risky: { chance: 0.35, battleScene: 'crypt-night' } },
      entry: 'stair',
      rooms: [
        { id: 'stair', name: 'The Barrow Stair', size: 'small',
          exit: { to: 'fen', label: 'Climb out to the barrow-field' },
          firstVisit: ['Worked steps lead down into the cold. Your torch makes a small, brave circle, and the dark waits politely outside it.'] },
        { id: 'hall', name: 'The Painted Hall', size: 'large', event: { scene: 'hall' } },
        { id: 'ossuary', name: 'The Bone Room', size: 'small', search: 'ossuary',
          firstVisit: ['Skulls fill this room from floor to ceiling, stacked in rows like bricks. Ten thousand of the tidy dead keep it.'] },
        { id: 'diggers', name: 'The Lead Cut', size: 'medium',
          event: { scene: 'diggers-cut', until: [{ kind: 'flag', flag: 'diggers-passed' }] } },
        { id: 'guard', name: 'The Barrow-Guard', size: 'medium',
          event: { scene: 'wights', until: [{ kind: 'flag', flag: 'wights-down' }] } },
        // The drop: no climbing back up the burial shaft.
        { id: 'king', name: 'The King\'s Chamber', size: 'large', fight: 'king', goal: true,
          exit: { to: 'warden-stair', label: 'Drop down the burial shaft' } },
      ],
      links: [
        { a: 'stair', b: 'hall' },
        { a: 'hall', b: 'ossuary', door: { secret: { dc: 13 } } },
        { a: 'hall', b: 'diggers' },
        // The dead fill the cut wall to wall; past it, the Worm waits in the dark.
        { a: 'diggers', b: 'guard', length: 2, door: {
          locked: [{ kind: 'flag', flag: 'diggers-passed' }],
          note: 'The dead are digging in the way, wall to wall.',
          ambush: { chance: 0.5, battle: 'crypt-ambush' } } },
        { a: 'guard', b: 'king', door: {
          locked: [{ kind: 'flag', flag: 'wights-down' }],
          note: 'The barrow-guard stands in front of the lead door.' } },
      ],
    },
  },
  // Below the drop: the shaft's foot and the Warden's door. No torch, and no
  // way out but through the door's business.
  'warden-stair': {
    id: 'warden-stair', kind: 'dungeon',
    dungeon: {
      title: 'The {warden}\'s Stair', theme: 'graveyard', art: { imageId: 'loc-crypt', emoji: '🕯️' },
      emptySearches: [
        'Candle-stubs, drips of black tallow and a dropped bone chisel, worn to a nub. The cult brought nothing it could spare.',
        'You feel along the steps by candle-light. They are worn hollow in the middle, and there is nothing in the hollows.',
      ],
      // Its own night attack: a loss here wakes on the stair, not in Thornwick
      // (no way back up the shaft, and no fast travel from a room with no exit).
      // Two nights at most below the drop, as above it.
      camp: { nights: 2, risky: { chance: 0.35, battleScene: 'stair-night' } },
      entry: 'shaft',
      rooms: [
        { id: 'shaft', name: 'The Shaft\'s Foot', size: 'small',
          firstVisit: ['You land hard in old bones and older dust. The shaft goes up into the dark, far out of reach.',
            'Below, black candles burn on every step of the last stair. You will not need your torch again. The only way now is down, toward the chanting.'] },
        { id: 'seal', name: 'The {warden}\'s Door', size: 'large', goal: true,
          event: { scene: 'seal-approach', until: [{ kind: 'flag', flag: 'cult-broken' }] } },
      ],
      links: [{ a: 'shaft', b: 'seal' }],
    },
  },
  // The light gives out: the party climbs out by feel. A fresh torch at the stair.
  'crypt-dark': {
    id: 'crypt-dark', kind: 'story', art: { imageId: 'loc-crypt', emoji: '🕯️' },
    text: [
      'The torch gutters, spits, and dies. The dark down here is total. You hold hands like children and feel your way along the walls. You crawl through gaps and climb stairs you never saw by torchlight, always toward the cold air.',
      'At last grey daylight shows at the top of a stair. You climb out into the barrow-field and light a fresh torch with shaking fingers.',
    ],
    next: [{ id: 'out', label: 'Catch your breath in the barrow-field', to: 'fen' }],
    noBack: true,
  },
  // The chapel told it in words; the hall shows it in paint, and adds where.
  hall: {
    id: 'hall', kind: 'story', art: { imageId: 'loc-crypt', emoji: '🎨' }, noBack: true,
    text: [
      'The stair opens into a painted hall. Artists covered these walls before {thornwick} had a name. The pictures tell one story, over and over. A **door** stands under the earth with a **horned warden** behind it, and before it, age after age, a **woman of the reeds** keeps watch.',
      'In one panel a line of soldiers in green bronze stands before the door, each with a fist pressed flat to his chest. It is the old kings\' salute, and the painter took great care over it.',
      'The last panel is fresh mud smeared over old paint. One angry stroke crosses out the woman of the reeds. Beneath her, many dead hands scrawled the words: **THE VIGIL HAS ENDED. THE DOOR OPENS FROM WITHIN.**',
      'The mud is still wet. A thin grey man in a gravedigger\'s apron stands under the last panel. He is smoothing the mud flat with his palm, the way you would pat down a fresh grave. A bundle of black candles hangs at his hip.',
      { if: [{ kind: 'npc', npc: 'halden', fate: 'saved' }],
        text: 'A grey little gravedigger, {halden} said. The one who brought the candles.' },
      // The door's clock, said by the man running it (see `dawns`). Only text
      // reads `door-straining` here.
      { if: [{ kind: 'notFlag', flag: 'door-straining' }],
        text: 'He sees your torch and is not alarmed. "Mind the cut," he says kindly. "They are working down there, and they don\'t like to be stopped. Another night or two, and the {warden} will put his own shoulder to the door." He picks up his lantern and goes on down into the dark, in no hurry at all.' },
      { if: [{ kind: 'flag', flag: 'door-straining' }],
        text: 'He sees your torch and is not alarmed. "Mind the cut," he says kindly. "They are working down there, and they don\'t like to be stopped. You felt the ground shake? That was the {warden}, leaning on his door." He picks up his lantern and goes on down into the dark, in no hurry at all.' },
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} keeps an arrow on the string until his lantern is gone. "The dead don\'t tell you to mind the cut," she says.' },
    ],
    next: [{ id: 'on', label: 'Go deeper in', to: '@hub',
      effects: [
        { kind: 'journal', entry: { id: 'c-warden', kind: 'clue', title: 'The Door Opens From Within',
          body: 'The painted hall at the top of the {undercrypt} shows the {warden}\'s door, far below, and the reed-woman who guarded it. Fresh mud over the paint says the vigil has ended and the door opens from within. His servants are at the door now. Get there first and speak {halden}\'s rites.' } }] }],
  },
  'crypt-night': {
    id: 'crypt-night', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'specter-haunt', mapId: 'corridor',
    intro: ['You bank a fire in a dry side-vault, and the {undercrypt} notices. The paint on the far wall begins to move. Two of the painted dead peel loose from it, grey and flat and cold, and slide toward your fire.'],
    onWin: { to: '@hub', text: ['The painted dead fall flat to the floor and crumble into flakes of grey paint. Where they came from, two bare patches of plaster show on the painted wall. Your fire lies kicked across the vault floor, and you have never been more awake.'] },
  },
  // Below the drop: the same cold, by the cult's candles. A loss wakes on the
  // stair, since there is no way back up to be carried out by.
  'stair-night': {
    id: 'stair-night', kind: 'battle',
    loot: false, encounterId: 'specter-haunt', mapId: '@room',
    intro: ['You try to sleep at the shaft\'s foot, under the black candles. One by one the candle-flames on the stair lean toward you, in a wind you cannot feel. Two cold grey shapes step out of the wall behind them.'],
    onWin: { to: '@hub', text: ['The specters come apart like breath on a frosty morning, and the candle-flames stand straight again. Below you, the chanting has not stopped once.'] },
    onLoss: { to: 'stair-night-lost' },
  },
  'stair-night-lost': {
    id: 'stair-night-lost', kind: 'story', noBack: true,
    text: ['The cold closes over you. You wake stiff on the bottom step with frost in your hair, and the grey shapes are back inside the wall. They took their fill of your warmth, and left you none of the rest you lay down for. No one below came up to look, and the chanting goes on.'],
    next: [{ id: 'up', label: 'Get up', to: 'warden-stair' }],
  },
  ossuary: {
    id: 'ossuary', kind: 'check', skill: 'investigation', dc: 12, art: { emoji: '💀' },
    intro: ['Old gold winks from the niches between the skulls. The barrow-lords took their wealth down with them. A careful eye might take some of it back up.'],
    success: { to: '@hub', text: ['Behind a row of skulls, the builders left a hidden nook. Inside are coins stamped with kings no song remembers. There is also a flask of drink that has gone strong with age instead of sour.'],
      effects: [{ kind: 'gold', amount: 90 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }] },
    failure: { to: '@hub', text: ['You grope through two niches, touch something that crunches, and decide to stop. You leave with a few loose coins off the floor. The dead can keep the rest. They did the work.'],
      effects: [{ kind: 'gold', amount: 20 }] },
  },
  // Thornwick's own dead, quarrying the lead. Get past them, still them, or
  // fight them. Among them is the reeve's grandfather, in his chain.
  // The way into the cut: the challenge, or, once every try is spent and the
  // dead are roused, straight to the fight (so a party that fell back from it
  // is never left facing a challenge with nothing left to try).
  'diggers-cut': {
    id: 'diggers-cut', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛏️' },
    text: ['The passage narrows into a long cut through the rock. Ahead of you, dozens of picks ring on stone.'],
    next: [
      { id: 'look', label: 'Creep up and look', to: 'diggers',
        requires: [{ kind: 'notFlag', flag: 'diggers-roused' }], hideWhenBlocked: true },
      { id: 'fight', label: 'Wade into the diggers', to: 'diggers-fight',
        requires: [{ kind: 'flag', flag: 'diggers-roused' }], hideWhenBlocked: true },
    ],
  },
  diggers: {
    id: 'diggers', kind: 'challenge', back: true, art: { imageId: 'loc-crypt', emoji: '⛏️' },
    intro: [
      '{thornwick}\'s dead fill the cut. They still wear their burial clothes. They chip at a seam of grey **lead** in the wall with picks, stones and bare fingers. Nobody gives them orders. Nobody needs to.',
      'The cut is just wide enough for them. To get past, you will have to get through them. Near the far end, one digger wears a chain of office over its burial coat.',
    ],
    again: ['{thornwick}\'s dead are still digging at the lead, wall to wall. Near the far end, the digger in the reeve\'s chain swings its pick with the rest.'],
    retry: 'perApproach',
    approaches: [
      { id: 'sneak', label: 'Slip past along the wall', hint: 'The picks ring loud enough to cover a footstep.',
        skill: 'stealth', dc: 12, roller: 'group',
        success: { to: 'diggers-chain', effects: DIGGERS_SLIPPED, text: ['You edge along the wall between swings. Not one head turns. At the far end, the digger with the chain lowers its pick, and does not lift it again.'] },
        failure: { to: 'diggers', text: ['A loose stone skitters across the floor, and every pick in the cut stops. After a long moment they start again, and you remember to breathe.'] } },
      { id: 'still', label: 'Say the burial words over them', hint: '{halden} said these over every grave in {thornwick}.',
        skill: 'religion', dc: 13,
        success: { to: 'diggers-chain', effects: DIGGERS_SLIPPED, text: ['You speak the old words, slow and plain. ' + LITURGY, 'One by one, the picks go quiet. The dead lie down in the cut in rows, as if they had only ever been asleep.'] },
        failure: { to: 'diggers', text: ['The words come out in the wrong order. A few of the dead pause, but the call from below drowns you out, and the picks start again.'] } },
      // The churchyard read (`graves-ranks`): you know the order they keep.
      { id: 'step-ranks', label: 'Fall in at the back of the oldest rank', hint: 'In the churchyard they stepped out of their graves in order, oldest first.',
        skill: 'deception', dc: 10, requires: [{ kind: 'flag', flag: 'graves-ranks' }], hideWhenBlocked: true, attempt: 'fall-in',
        success: { to: 'diggers-chain', effects: DIGGERS_SLIPPED, text: ['You find the oldest rank by its grave-clothes and fall in at the back of it. Swing, step, swing, in time with the rest. The dead make room for you the way soldiers make room in a line. You walk out the far end, still swinging.'] },
        failure: { to: 'diggers', text: ['You fall in a beat behind the rank, and the rank notices. The nearest digger stops and turns its empty face toward you. Then, slowly, it goes back to work.'] } },
      { id: 'step', label: 'Pick up a tool and fall into step',
        skill: 'deception', dc: 13, requires: [{ kind: 'notFlag', flag: 'graves-ranks' }], hideWhenBlocked: true, attempt: 'fall-in',
        success: { to: 'diggers-chain', effects: DIGGERS_SLIPPED, text: ['You take a pick from the pile and shuffle in among them. Swing, step, swing. Not one of them looks twice at one more digger. You walk out the far end, still swinging.'] },
        failure: { to: 'diggers', text: ['You swing too fast. The living always do. The nearest digger stops and turns its empty face toward you, then slowly goes back to work.'] } },
      { id: 'cleric', label: '[Cleric] Raise your holy symbol and turn them aside', hint: 'The dead give way to the gods, when the gods are asked properly.',
        skill: 'religion', dc: 10,
        requires: [{ kind: 'classInParty', classId: 'cleric' }], hideWhenBlocked: true,
        success: { to: 'diggers-chain', effects: DIGGERS_SLIPPED, text: ['You hold up your holy symbol, and a light that is not torch-light fills the cut. The dead shuffle back from it like sheep from a dog. They press to the walls and leave you a road.'] },
        failure: { to: 'diggers', text: ['The light flickers and fails. Something deeper in the barrow is pushing back, and it is stronger down here.'] } },
      { id: 'paladin', label: '[Paladin] Stand in their road and speak your oath', hint: 'An oath is a promise. The dead remember promises.',
        skill: 'religion', dc: 10,
        requires: [{ kind: 'classInParty', classId: 'paladin' }], hideWhenBlocked: true,
        success: { to: 'diggers-chain', effects: DIGGERS_SLIPPED, text: ['You plant your feet and speak your oath aloud. The nearest dead stop digging. They step aside one by one, the way a crowd makes room for a funeral.'] },
        failure: { to: 'diggers', text: ['Your oath rings off the stone, and the dead do not hear it. The call from below is louder.'] } },
    ],
    success: { to: 'diggers-chain' },
    // Every try spent: the whole cut turns on the party.
    failure: { to: 'diggers-fight', text: ['The rhythm of the picks breaks. The dead turn, all together, and come for you.'],
      effects: [{ kind: 'setFlag', flag: 'diggers-roused' }] },
  },
  'diggers-fight': {
    id: 'diggers-fight', kind: 'battle', encounterId: 'undead', mapId: 'corridor',
    intro: ['The dead come down the cut with their picks raised. Two are bare bones in grave-rags. Three are fresh, and still wear the faces {thornwick} buried. Hit hard, and try not to look.'],
    again: ['The dead are waiting in the cut this time, picks raised. Hit hard, and try not to look.'],
    onWin: { to: 'diggers-chain', text: ['The last digger falls across its pick. The cut goes quiet, apart from your breathing.'] },
  },
  'diggers-chain': {
    id: 'diggers-chain', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛓️' },
    text: [
      'At the end of the cut, an old man in a good burial coat has folded down against the wall. A reeve\'s chain of office hangs round his neck, the twin of the one {aldous} grips in his hall.',
      { if: [{ kind: 'notFlag', flag: 'diggers-roused' }],
        text: 'The call that brought him down here has let him go. He is light now, just bones in a coat.' },
      { if: [{ kind: 'flag', flag: 'diggers-roused' }],
        text: 'He came at you with the rest of them, and he fell with the rest of them. He is light now, just bones in a coat.' },
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} kneels and straightens the chain on his chest. "The reeve\'s grandfather," she says, and nothing else.' },
      'The diggers stacked their grave-goods against the wall as they worked. There are rings, buckles and a scatter of old coin. On top lies a boar-spear with a silvered head, laid in some old watchman\'s grave to keep the dead from getting up. The way ahead is narrow and dark. You can carry the old man, or the heap, but not both, and the old man will slow you all the way down.',
    ],
    // A real trade: the old reeve home (a war asset in Part 3) or the
    // grave-goods, whose silvered spear bites the wights, specters and king
    // still ahead (silver counts as magic against their hides).
    // The kind choice is priced in time as well: a dead man on your back
    // costs a day against the door's clock (see `dawns`). Either way {wren},
    // the reeve's scout, sees what comes up the stair.
    next: [
      { id: 'carry', label: 'Carry him home in your cloak, though it will cost the day', to: 'diggers-carry',
        effects: [{ kind: 'setFlag', flag: 'diggers-passed' }, { kind: 'setFlag', flag: 'grandfather-home' }, REGARD,
          { kind: 'npc', npc: 'wren', attitude: 1 },
          { kind: 'journal', entry: { id: 'c-grandfather', kind: 'clue', title: 'The Old Reeve',
            body: 'Reeve {aldous}\'s grandfather was digging with the dead in the {undercrypt}. You knew him by his chain of office. You are carrying him home to {thornwick}.' } }] },
      { id: 'leave', label: 'Lay him down here, chain and all, and take the grave-goods', to: '@hub',
        effects: [{ kind: 'setFlag', flag: 'diggers-passed' }, { kind: 'gold', amount: 40 }, { kind: 'addItem', itemId: 'silvered-spear' },
          { kind: 'npc', npc: 'wren', attitude: -1 }] },
    ],
    noBack: true,
  },
  // The price of carrying him: the day, and the door's clock with it.
  'diggers-carry': {
    id: 'diggers-carry', kind: 'story', noBack: true, art: { imageId: 'loc-crypt', emoji: '⛓️' },
    assumes: [{ kind: 'flag', flag: 'grandfather-home' }],
    text: ['He weighs almost nothing, and he is still the hardest thing you have ever carried. You take every narrow turn sideways, and every low arch on your knees. Somewhere far above you the day goes by, and you feel every hour of it in your shoulders.'],
    next: [{ id: 'on', label: 'Go on, with the old man on your back', to: '@hub', effects: [{ kind: 'passDay' }] }],
  },
  // The Worm's own sentry, waiting in the passage past the diggers.
  'crypt-ambush': {
    id: 'crypt-ambush', kind: 'battle', encounterId: 'crypt', mapId: '@room',
    intro: [
      'A black candle burns on the floor of the passage. A man kneels beside it, robed like the drowned stranger in the fen. He hears you, and smiles.',
      '"The {worm} goes before the {warden}," he says. Two ghouls and two old skeletons climb to their feet around him and come at you.',
    ],
    onWin: { to: '@hub', text: ['The man in the robe dies still holding his candle. It smells of the fen. Whoever he served, there are more of them further down.'] },
  },
  // An old soldier at his post: he can be fought, or relieved of it.
  wights: {
    id: 'wights', kind: 'battle', encounterId: 'wight-tomb', mapId: 'corridor',
    intro: [
      'This is the hall of the kings\' guard. Three slabs of black stone stand in the dark. On the middle one, an old guardsman in barrow-armour sits *up*, with cold light burning in its eye sockets. It draws a sword of green bronze, like the soldiers in the paintings. It does not shuffle like the other dead. It takes a **stance**.',
      'From the slabs on either side, two skeletons rise to guard it. They snap to their feet like soldiers called to order, and they come for you.',
    ],
    again: ['The old guardsman stands before its slab again, sword drawn, cold light in its eyes. Its two skeletons stand at its sides like soldiers on parade.'],
    onWin: { to: '@hub', text: ['The wight comes apart at the joints and lies down in its own armour. The cold light in its eyes gutters out, and its skeletons clatter down after it.', 'Under its slab lies a guardsman\'s pay that no one ever came to collect, old coins gone green in a rotted pouch.'],
      effects: [{ kind: 'setFlag', flag: 'wights-down' }, { kind: 'gold', amount: 40 }] },
    parley: {
      skill: 'history', dc: 15, label: 'Relieve him of his post, the old way',
      refused: ['You give the salute, but not quite the way the painted soldiers gave it. The wight\'s sword stays up. "Not relieved," it rasps. "Not by you."'],
      success: { to: '@hub', text: [
        'The painted hall showed how the old kings\' soldiers saluted. You give that salute now, fist to chest, and tell him his watch is over.',
        'The wight does not move. At last it lowers its sword and lies back down on its slab, and its skeletons lie down with it.',
      ], effects: [{ kind: 'setFlag', flag: 'wights-down' }, { kind: 'xp', amount: avoidedFightXP('wight-tomb') }] },
    },
  },
  king: {
    id: 'king', kind: 'battle', encounterId: 'barrow-king', mapId: '@room',
    intro: [
      'Old masons sealed the king\'s chamber in lead. Something has peeled the lead back like fruit-rind, from the *inside*. Within, a figure in grave-wrappings the colour of old honey stands before a wall carved with names.',
      'They are the names of villages, hundreds of them, and a line runs through every one. You know a few from old songs, and none of them stand anymore.',
      'The embalmed king turns. His wrappings are new-tied at wrist and throat, the knots still tight and pale. Someone has set a crown of green bronze back on his head, and set it straight. The eyes behind the wrappings burn with a slow, pleased light. Two of his household dead lurch from the corners, still in their funeral best.',
    ],
    again: ['The embalmed king still stands before his wall of crossed-out villages. His eyes burn with that slow, pleased light, and his two household dead lurch out of the corners again.'],
    onWin: { to: '@hub', text: ['The king crumbles, his grave-cloths sagging around nothing but dust and old spice, and his servants drop mid-lurch. Behind him, at the bottom of the wall, one name sits freshly carved, with no line through it yet. **THORNWICK**.', 'You pick his gold rings out of the dust where his hands fell.', 'Behind the king\'s throne, a burial shaft drops into the dark. The chanting comes up out of it.'],
      effects: [{ kind: 'gold', amount: 60 }] },
  },
  'seal-approach': {
    id: 'seal-approach', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '🚪' },
    text: [
      'The lowest stair ends at the door the paintings promised. It is a slab of stone the size of a barn wall. Old words are cut across it, and lead fills every letter. The stone bows *outward*, straining, as something behind it leans its weight on it.',
      'The chanting you\'ve heard for an hour comes from the **living**. They kneel at the door with candles of black tallow, in long robes the colour of grave-worms, like the drowned stranger among the corpse-lights. "The {worm} goes before the {warden}," they chant, over and over. Their leader is the thin grey man from the painted hall, in his gravedigger\'s apron. He pries the lead out of the door one letter at a time with a chisel of bone, while an acolyte holds a candle for him.',
      'A walking suit of ancient armour guards the stair. Two ghouls crouch among the candles like pets. Against the door itself sits a soldier of the old kings in green bronze, its sword across its knees. Its eyes are two points of cold light. It watches the stair, and waits for an order.',
      'The grey man leans in to his work. "Faster," he tells the chisel, sweetly reasonable. He sees you, and he does not stop working. "**{marrow}**," he says, by way of greeting. "I brought your priest his candles."',
      '"I dug graves at {saltmere} for thirty years. Then the fever came. I buried the whole village, my wife and my two boys last. {^saltmere-graves}, and then I walked away and left them all in the cold. The {warden} leaves nobody in the cold. Under him the dead stand together, and they have work to do. Is that so wicked?" He sets the chisel to the next letter. "The rites are in your pack, I expect. Say them over my body, if you must."',
      // The door's clock (see `dawns`).
      { if: [{ kind: 'flag', flag: 'door-straining' }],
        text: 'The door has shifted in its frame since the ground shook. A line of dark, a finger wide, shows along its top. "He leaned on it in the night, and the stone gave," {marrow} says. "It will be harder to shut now."' },
    ],
    again: ['{marrow} is still at the door, prying the lead out of its letters one at a time. He does not look round. "Back again," he says. "It is nearly open now. You may as well watch."'],
    next: [
      // Marrow's own reasons, turned on him: the king's wall shows what the
      // Warden does with a village. Talked round, he fights half-hearted and
      // lives; what to do with him is the company's next choice. Not swayed,
      // his kneelers saw it (`kneelers-scorned`): harder to turn later, not shut.
      { id: 'wall', label: '[Persuasion DC 14] Tell {marrow} what the king\'s wall says', to: 'seal-doubt-words', once: true,
        check: { skill: 'persuasion', dc: 14, failTo: 'seal-scorned', failEffects: [{ kind: 'setFlag', flag: 'kneelers-scorned' }] } },
      { id: 'fight', label: 'Interrupt the service', to: 'seal-battle' },
    ],
  },
  // Marrow not swayed, in front of his whole congregation: they saw the
  // company fail, and will be slower to chant for it at the door later.
  'seal-scorned': {
    id: 'seal-scorned', kind: 'story', noBack: true, art: { imageId: 'loc-dungeon', emoji: '🕯️' },
    text: [
      'You tell him about the wall in the king\'s chamber, and the villages with a line through every name. {marrow} hears you out without stopping his chisel. "Then the {warden} chose {thornwick}," he says. "He chose well."',
      'Behind him the kneelers laugh, all together, and lift their black candles higher. They watched you try to turn their gravedigger, and they watched you fail. They will take a great deal more turning now.',
    ],
    next: [{ id: 'on', label: 'Interrupt the service', to: 'seal-battle' }],
  },
  // The words that stop his chisel: their own beat, so a party back up from
  // losing the fight after them (`seal-doubt-lost`) does not say them twice.
  'seal-doubt-words': {
    id: 'seal-doubt-words', kind: 'story', noBack: true, art: { imageId: 'loc-dungeon', emoji: '⛏️' },
    text: [
      'You tell him about the wall in the king\'s chamber. Hundreds of villages are cut there, with a line through every one. None of them stand together. None of them stand at all. "{thornwick} is the next name," you say. "{saltmere}\'s graves will be on the wall after that."',
      '{marrow}\'s chisel stops. His acolyte sees it stop, and screams that he has lost his faith.',
    ],
    next: [{ id: 'on', label: 'Face what is left of his flock', to: 'seal-doubt' }],
  },
  'seal-doubt': {
    id: 'seal-doubt', kind: 'battle', encounterId: 'cult-wavering', mapId: 'firepit',
    // No falling back: the stair behind you leads to the Marrow who still believed.
    noFlee: true,
    surprise: 'enemies',
    onLoss: { to: 'seal-doubt-lost' },
    loot: { bonusTier: 'rare' },
    intro: [
      '{marrow} sits with his back against the door, his chisel still. His acolyte screams at you over the candles. The armour and the ghouls come for you anyway, and one of the ghouls stinks worse than the grave. {marrow} only watches, as if from very far away.',
      'Beside him, the soldier of the old kings does not stir from the door. It waits for an order, and {marrow} gives none.',
    ],
    onWin: { to: 'marrow-spared', text: ['The last ghoul falls among the candles. {marrow} never moved from the door. When it is over, he is still sitting against it with the chisel in his lap.', 'Coins lie thick on the bottom step, thrown there by the faithful for the {warden}. You gather them up, and {marrow} does not look round.'],
      effects: [{ kind: 'setFlag', flag: 'cult-broken' }, { kind: 'gold', amount: 120 }] },
  },
  // Marrow lived: lend his voice to the rites, or bind him for Thornwick.
  'marrow-spared': {
    id: 'marrow-spared', kind: 'dialogue', noBack: true, art: { imageId: 'loc-dungeon', emoji: '⛏️' },
    npc: speaker(NPCS.marrow!, 'the Gravedigger'),
    lines: [
      '{marrow} looks up at the door, and at the letters he pried loose. "{^saltmere-graves}," he says. "I thought he would give them back to me." Behind him, the kneelers who never fought still hold their black candles. They are watching him to see what he does.',
      '"They will sing whatever I sing," he says. "Or you can take me up to your reeve. I would understand that."',
    ],
    next: [
      { id: 'sing', label: 'Make him lead his faithful in the rites', to: 'seal-door',
        effects: [{ kind: 'npc', npc: 'marrow', fate: 'sings' }] },
      { id: 'bind', label: 'Bind him for the reeve, and take the cult\'s offering-purse', to: 'seal-door',
        effects: [{ kind: 'npc', npc: 'marrow', fate: 'bound' }, { kind: 'gold', amount: factValue('offering-purse') }] },
    ],
  },
  'seal-battle': {
    id: 'seal-battle', kind: 'battle', encounterId: 'cult-at-door', mapId: 'firepit',
    onLoss: { to: 'seal-battle-lost' },
    loot: { bonusTier: 'rare' },
    intro: ['{marrow} turns with the chisel still in his hand, and rage floods the sweet reason off his face. "The door opens for the *faithful*!" His acolyte drops the candle and pulls a knife. The armour grinds down the stair. The ghouls come low and fast between the candles, and one of them stinks worse than the grave.',
      'Against the door, the soldier of the old kings gets to its feet in its green bronze. {marrow} woke it to keep his door, and it draws its sword.'],
    again: ['{marrow} turns from the door again, chisel in hand. "The door opens for the *faithful*!" His acolyte already has the knife out. The armour, the ghouls and the soldier in green bronze come for you once more.'],
    onWin: { to: 'seal-door', text: ['{marrow} dies reaching for the door. His kneeling faithful stare at the body and do not get up. No one stands between you and the door now, and the book is in your hands.', 'Coins lie thick on the bottom step, where the faithful threw them at the door. You sweep them into a sack before you open the book.'],
      effects: [{ kind: 'setFlag', flag: 'cult-broken' }, { kind: 'gold', amount: 120 }] },
  },
  // The fighting over, before the rites: Halden keeps his promise here, if
  // he lived, so the door's challenge can take his book from him.
  'seal-door': {
    id: 'seal-door', kind: 'story', noBack: true, art: { imageId: 'loc-dungeon', emoji: '🚪' },
    text: [
      'Quiet settles over the last stair. Only the door still makes a sound, a slow grinding, as the {warden} leans on what is left of its lead.',
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'sings' }],
        text: '{marrow} kneels down among his faithful. "They know how to chant at this door," he says. "Read, or let me read. Whoever reads, they will chant it after, because I will."' },
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'bound' }],
        text: 'You tie {marrow}\'s wrists with his own apron strings. The cult\'s offering-purse hangs at his belt, fat with {offering-purse} of the faithful\'s coin. You take that too.' },
      { if: [{ kind: 'npc', npc: 'halden', fate: 'saved' }],
        text: 'Boots scrape in the shaft above. Brother {halden} drops down it, skinning his palms on the way, and limps down the last stair, still shaking. He promised to follow you down, and he has.' },
    ],
    // The door's clock (see `dawns`): which door the book is opened at.
    next: [
      { id: 'open', label: 'Open {halden}\'s book at the door', to: 'resealing',
        requires: [{ kind: 'notFlag', flag: 'door-straining' }], hideWhenBlocked: true },
      { id: 'open-shifted', label: 'Open {halden}\'s book at the door', to: 'resealing-shifted',
        requires: [{ kind: 'flag', flag: 'door-straining' }], hideWhenBlocked: true },
    ],
  },
  // The climax: see `resealing` above, plain or with the door shifted.
  resealing: resealing(false),
  'resealing-shifted': resealing(true),
  'seal-clean': {
    id: 'seal-clean', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '📖' },
    text: [
      'Line by line the great door stops *straining*, and last of all the weight behind it eases off. Something enormous behind the stone turns away, unhurried and unimpressed, like a sleeper turning over in a warm bed. Far above you, across the barrow-field, every walking corpse lies down where it stands.',
      'The **{warden}** sleeps. The door is shut.',
      'Among the cult\'s packs you find how they came down: a rope ladder and a grapnel. You throw the hook up the burial shaft until it bites.',
    ],
    next: CLIMB_HOME, noBack: true,
  },
  // The rites failed, and the Warden pushed back. Win, and the door shuts
  // over the bodies, but not cleanly: the crack carries into Part 3.
  'seal-breach': {
    id: 'seal-breach', kind: 'battle', encounterId: 'undead', mapId: 'firepit',
    noFlee: true,
    // Beaten back from a cracked door: the dead are still coming through it,
    // so the party gets up and holds it again.
    onLoss: { to: 'seal-breach-lost' },
    intro: ['The {warden}\'s own dead squeeze out through the split in his door. Skeletons in green barrow-bronze come first, then three swollen fen-dead, and more grey fingers wait behind them. If they get past you, {thornwick} is next.'],
    again: ['The {warden}\'s dead are still coming, a few at a time. If they get past you, {thornwick} is next.'],
    onWin: { to: 'seal-shut', text: ['The last of them falls across the doorstep. All of you put your shoulders to the door and shove it home over the bodies. You shout the rites into the crack, badly and all at once. It is enough, barely.'],
      effects: [{ kind: 'setFlag', flag: 'seal-cracked' }] },
  },
  // Lost to the cult below the one-way drop: they leave the party for dead
  // and go back to their door, and the party comes to where it fell.
  // Losing after Marrow has stopped believing does not make him believe again.
  'seal-doubt-lost': {
    id: 'seal-doubt-lost', kind: 'rest', variant: 'long', next: 'seal-doubt',
    intro: ['The ghouls drag you down among the candles. When you come round, you are lying by the shaft with a gravedigger\'s coat folded under your head. Below, the acolyte is still chanting, and {marrow} still has not lifted his chisel.'],
  },
  'seal-battle-lost': {
    id: 'seal-battle-lost', kind: 'rest', variant: 'long', next: 'seal-battle',
    intro: ['A knife-hilt catches you behind the ear, and the candles go out. You come to by the shaft with your wrists tied. The faithful were too busy with the door to finish you. You work the ropes loose, and the chanting has not missed a beat.'],
  },
  'seal-breach-lost': {
    id: 'seal-breach-lost', kind: 'rest', variant: 'long', next: 'seal-breach',
    intro: ['Grey hands close over your face, and the dark comes with them. You wake on the stair, far above the door, and the dead have not climbed past you. They are still squeezing through the door, slowly, one at a time.', 'You get up. Someone has to hold that door, and it is still you.'],
  },
  'seal-shut': {
    id: 'seal-shut', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '🚪' },
    text: [
      'The door holds, but the crack in it does not close. Lead creeps in from the letters on either side and stops a finger short. Behind the stone the {warden} settles without sleeping, and now and then the door ticks under your hand like a knuckle tapping.',
      'Far above you, across the barrow-field, the walking dead lie down where they stand. It is done, more or less.',
      'Among the cult\'s packs you find how they came down: a rope ladder and a grapnel. You throw the hook up the burial shaft until it bites.',
    ],
    next: CLIMB_HOME, noBack: true,
  },
  // Each claim gets one line, then a short hub: the homecoming doesn't replay.
  'sb-claim-round': {
    id: 'sb-claim-round', kind: 'story', art: { imageId: 'loc-tavern', emoji: '🍺' },
    text: ['The whole taproom eats on your coin. Someone stands and names {thornwick}\'s dead, one by one, and the room goes quiet to listen. When the last name is said, someone raises a cup to {mira}, who cooked it all, and she goes on scrubbing the pot.'],
    next: [{ id: 'ok', label: 'Go back to the square', to: 'sb-aftermath-hub' }], noBack: true,
  },
  'sb-aftermath-hub': {
    id: 'sb-aftermath-hub', kind: 'story', art: { imageId: 'loc-town', emoji: '🏘️' },
    text: ['{thornwick} goes about its burying, and its living.'],
    next: SB_CLAIMS, noBack: true,
  },
  // In the order it happens: up out of the barrow and the walk home here;
  // the reeve's hall that evening and the reburials after, in `sb-hall`.
  'sb-aftermath': {
    id: 'sb-aftermath', kind: 'story', art: { imageId: 'loc-town', emoji: '🏘️' },
    text: [
      'The rope ladder brings you up out of the great barrow and into the open air.',
      { if: [{ kind: 'noCompanion', companion: 'wren' }],
        text: '{wren} is still holding the {barrow-gate} when you come up. She is upright, knife out, in a great field of dead who have finally stopped moving. She wears the look of someone determined to have been calm the whole time.' },
      { if: [{ kind: 'companion', companion: 'wren' }],
        text: '{wren} comes up behind you. At the top she stands a long moment in the barrow-field, among dead who have finally stopped moving, and then she unstrings her bow.' },
      { if: [{ kind: 'npc', npc: 'halden', fate: 'saved' }],
        text: 'Brother {halden} climbs out last, blinking at the daylight. He walks the barrow-field with his book open, and says the burial words over every one of the dead lying still in the grass.' },
      // One job for {wren}: the old reeve's feet if he came home, else {marrow}'s rope.
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'bound' }, { kind: 'noCompanion', companion: 'wren' }, { kind: 'notFlag', flag: 'grandfather-home' }],
        text: '{marrow} climbs out behind you with his wrists tied. "That\'s the one who brought the candles?" {wren} asks. She looks him up and down, then takes the rope herself.' },
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'bound' }, { kind: 'noCompanion', companion: 'wren' }, { kind: 'flag', flag: 'grandfather-home' }],
        text: '{marrow} climbs out behind you with his wrists tied. "That\'s the one who brought the candles?" {wren} asks. She looks him up and down, and leaves his rope in your hands.' },
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'bound' }, { kind: 'companion', companion: 'wren' }, { kind: 'notFlag', flag: 'grandfather-home' }],
        text: '{marrow} climbs out with his wrists tied. {wren} has held the end of his rope since the door, and she does not give it up now.' },
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'bound' }, { kind: 'companion', companion: 'wren' }, { kind: 'flag', flag: 'grandfather-home' }],
        text: '{marrow} climbs out with his wrists tied, at the end of a rope your company has held since the door. {wren} does not take her eyes off him.' },
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'sings' }],
        text: '{marrow} climbs out after you, and walks off alone across the barrow-field toward {saltmere}. {wren} keeps her hand on her knife until the fog takes him. "If he comes back," she says, "I\'ll know."' },
      // A seal shut clean: the walk home said here; cracked, below.
      { if: [{ kind: 'notFlag', flag: 'seal-cracked' }, { kind: 'flag', flag: 'grandfather-home' }, { kind: 'noCompanion', companion: 'wren' }],
        text: '{wren} sees the chain glint in the folds of your cloak, and she knows it. She takes one end of the bundle before you can ask. "I\'ve got his feet," she says. "Mind the ruts." The walk home is long and wet.' },
      { if: [{ kind: 'flag', flag: 'seal-cracked' }, { kind: 'flag', flag: 'grandfather-home' }, { kind: 'noCompanion', companion: 'wren' }],
        text: '{wren} sees the chain glint in the folds of your cloak, and she knows it. She takes one end of the bundle before you can ask. "I\'ve got his feet," she says. "Mind the ruts."' },
      // She came down, and has carried him since the cut.
      { if: [{ kind: 'notFlag', flag: 'seal-cracked' }, { kind: 'flag', flag: 'grandfather-home' }, { kind: 'companion', companion: 'wren' }],
        text: 'Since the lead cut {wren} has taken the old man\'s feet wherever the roof drops low, and she will not hand them over now. "Mind the ruts," she says, at every rut. The walk home is long and wet.' },
      { if: [{ kind: 'flag', flag: 'seal-cracked' }, { kind: 'flag', flag: 'grandfather-home' }, { kind: 'companion', companion: 'wren' }],
        text: 'Since the lead cut {wren} has taken the old man\'s feet wherever the roof drops low, and she will not hand them over now. "Mind the ruts," she says, at every rut.' },
      { if: [{ kind: 'notFlag', flag: 'seal-cracked' }, { kind: 'notFlag', flag: 'grandfather-home' }],
        text: 'The walk home is long and wet. The door under the barrows is shut behind you, and the fen is only a fen again.' },
      { if: [{ kind: 'flag', flag: 'seal-cracked' }],
        text: 'The walk home is long and wet. Every so often one of you stops and looks back at the barrow-field, and the others wait, and listen with them.' },
      { if: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 2 } }],
        text: 'At the edge of town {wren} stops and says "Thank you," fast, to the road. She is gone up the lane before anyone can ask what for.' },
      { if: [{ kind: 'npc', npc: 'wren', attitude: { below: 0 } }],
        text: '{wren} walks a few paces ahead of the company the whole way. She talks to the fen-folk on the road, and not much to you.' },
    ],
    // The reeve's commission, counted out in the hall that evening.
    next: [{ id: 'hall', label: 'Go up to the reeve\'s hall', to: 'sb-hall', effects: [{ kind: 'gold', amount: 150 }] }],
    // Home, with the door sealed: nothing below is left to walk back into.
    noBack: true,
  },
  // That evening and the days after: the reeve pays, the old reeve is laid
  // down (if he came home), the town reburies its dead and the drowned folk's
  // purses go back to their families.
  'sb-hall': {
    id: 'sb-hall', kind: 'story', art: { emoji: '⚖️' },
    text: [
      { if: [{ kind: 'flag', flag: 'grandfather-home' }],
        text: 'That evening, in the reeve\'s hall, {aldous} counts your purse into your hands himself, coin by coin. He loses count twice, and does not seem to mind.' },
      { if: [{ kind: 'notFlag', flag: 'grandfather-home' }],
        text: 'That evening, in the reeve\'s hall, {aldous} counts your purse into your hands himself, coin by coin, and does not lose count once.' },
      { if: [{ kind: 'flag', flag: 'grandfather-home' }],
        text: 'You carry the old man in after the coin, still wrapped in your cloak, and lay him on the long table among the ledgers. {aldous} takes off his own chain of office and lays it beside his grandfather\'s. The links match. "He taught me to wear this straight," he says, and his voice gives out on the last word. He turns to the window, and he does not turn back while you are in the room.' },
      '{thornwick} reburies its dead in the following days, oldest graves first. The reeve stands bareheaded at every single service.',
      // The company's one line of its own, at the chapter's last beat (rule 15).
      { if: [{ kind: 'npc', npc: 'halden', notFate: ['saved'] }, { kind: 'classInParty', classId: 'cleric' }],
        text: 'With {halden} in the ground, the town has no priest. Your cleric says the burial words at every grave, and each time stops short of the line about the bell.' },
      // The drowned folk's purses, handed over at the reburials.
      { if: [{ kind: 'flag', flag: 'drowned-gold-home' }],
        text: 'The fen-folk come in from the far pools for the reburials, and you hand over the drowned folk\'s purses one by one. They pass them along, name by name. One widow opens hers and finds a carved bone button among the coins. "He always kept that," she says, and holds the purse to her chest. {wren} tucks the last purse into her coat. She will walk it out to the far edge of the fen herself.' },
    ],
    next: SB_CLAIMS,
    noBack: true,
  },
  'sb-defeat': {
    id: 'sb-defeat', kind: 'story', art: { imageId: 'loc-tavern', emoji: '🍺' },
    text: [
      'The first thing you know is the smell of tallow and wet wool. You are lying on the settles in the {wander-inn}\'s back room, pushed together to make beds, with fen-mud dried stiff in your hair.',
      // Where the party fell: in the fen (a fight there, or a night camp), or
      // down in the barrows. Once the gate is passed, Wren is the one out there.
      { if: [{ kind: 'at', hub: 'fen' }, { kind: 'notFlag', flag: 'lychgate-cleared' }],
        text: 'Eel-catchers from the far pools found you by the raised road at first light, {mira} says. They brought you in on hurdles, and would not stop for so much as a cup.' },
      { if: [{ kind: 'at', hub: 'fen' }, { kind: 'flag', flag: 'lychgate-cleared' }, { kind: 'noCompanion', companion: 'wren' }],
        text: '{mira} will not say who brought you back across the fen. A pair of small, muddy boots is drying by her fire, with a bow propped in the corner beside them.' },
      { if: [{ kind: 'at', hub: 'undercrypt' }, { kind: 'noCompanion', companion: 'wren' }],
        text: 'Somebody got you up the barrow stair and across the whole fen in the dark. {mira} will not say who. A pair of small, muddy boots is drying by her fire, with a bow propped in the corner beside them.' },
      // {wren} came down with the company, and fell with it: back out in the
      // fen, or down in the barrows, where she was in no state to carry anyone.
      { if: [{ kind: 'at', hub: 'fen' }, { kind: 'flag', flag: 'lychgate-cleared' }, { kind: 'companion', companion: 'wren' }],
        text: 'Eel-catchers from the far pools found the whole company in the mud, {wren} among you, and carried you in on hurdles. She is asleep on the next settle with her boots still on.' },
      { if: [{ kind: 'at', hub: 'undercrypt' }, { kind: 'companion', companion: 'wren' }],
        text: 'When no one came back up by dark, eel-catchers from the far pools went down the barrow stair after you with ropes, {mira} says. They hauled the whole company up, {wren} among you. She is asleep on the next settle with her boots still on.' },
      '"The fen\'s still there," {mira} says. She puts the bread where you can reach it.',
    ],
    again: [
      'Back on the settles in {mira}\'s back room, with fresh bruises under the old mud.',
      { if: [{ kind: 'at', hub: 'fen' }, { kind: 'notFlag', flag: 'lychgate-cleared' }],
        text: 'The eel-catchers found you this time, {mira} says. They stayed only long enough to warm their hands.' },
      { if: [{ kind: 'at', hub: 'fen' }, { kind: 'flag', flag: 'lychgate-cleared' }, { kind: 'noCompanion', companion: 'wren' }],
        text: 'A pair of small, muddy boots is drying by the fire, with a bow propped in the corner beside them.' },
      { if: [{ kind: 'at', hub: 'undercrypt' }, { kind: 'noCompanion', companion: 'wren' }],
        text: 'A pair of small, muddy boots is drying by the fire, with a bow propped in the corner beside them.' },
      { if: [{ kind: 'flag', flag: 'lychgate-cleared' }, { kind: 'companion', companion: 'wren' }],
        text: '{wren} is on the next settle again, boots and all, and does not open her eyes.' },
      '"You know where the bread is," {mira} says, and leaves you to it.',
    ],
    // A wipe costs a day, as in every chapter (and the door's clock runs on).
    // Then the town, or, for a party that fell in the barrows, straight back
    // down the barrow stair: a loss there is not the whole fen again.
    // (A party that fell in the barrows comes back to the room it fell in.)
    next: [{ id: 'up', label: 'Get back on your feet', to: 'town', effects: [{ kind: 'passDay' }] },
      { id: 'back', label: 'Go straight back down the barrow stair', to: 'undercrypt', effects: [{ kind: 'passDay' }],
        requires: [{ kind: 'at', hub: 'undercrypt' }], hideWhenBlocked: true }], noBack: true,
  },
  'sb-epilogue': {
    id: 'sb-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'In {thornwick}\'s churchyard the turf is back over every grave, and the bell-rope hangs still.',
    ],
    // One fate per thread the run touched, people first, then the old reeve,
    // the door, and the hook for Part 3 (always) to close on.
    slides: [
      { if: [{ kind: 'npc', npc: 'vex', fate: 'turned' }],
        text: '{vex} hears the news in a hill inn. He sits up late by the fire, looking back toward the valley.' },
      { if: [{ kind: 'npc', npc: 'vargan', fate: 'spared' }],
        text: 'Out in the reed-beds, {vargan} stops cutting when the bells ring, and does not start again until they stop.' },
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'bound' }],
        text: '{marrow} waits in the reeve\'s cells. He asks for a shovel. After some thought, {aldous} gives him the churchyard to mend.' },
      { if: [{ kind: 'npc', npc: 'marrow', fate: 'sings' }],
        text: 'In {saltmere}, {marrow} keeps {saltmere-graves} he once left in the cold. He says the rites over them every evening.' },
      { if: [{ kind: 'npc', npc: 'halden', fate: 'saved' }],
        text: 'Brother {halden} keeps the vigil now, and he reads the rites a little louder than he needs to.' },
      { if: [{ kind: 'npc', npc: 'halden', notFate: ['saved'] }],
        text: '{halden} and his acolytes share a new grave by the chapel. {mira} of the {wander-inn} paid for the white headstone, and had the old burial words cut into it.' },
      { if: [{ kind: 'npc', npc: 'wren', met: true }],
        text: '{wren} wears a captain\'s knot in the reeve\'s colours now, to her plain horror. She leads the watch that walks the old road once a season.' },
      { if: [],
        text: 'Every night since the graves opened, a lamp has burned in the window of the {wander-inn}. Now {mira} takes it down and blows it out.' },
      { if: [{ kind: 'flag', flag: 'drowned-gold-home' }],
        text: 'The widow who found the bone button in her purse sews it back onto her husband\'s good coat. They bury him in it beside the rest of {thornwick}\'s dead, oldest graves first.' },
      { if: [{ kind: 'flag', flag: 'grandfather-home' }],
        text: '{aldous} buries his grandfather a second time, chain and all, and digs the grave himself. The gravediggers stand back with their spades and let him.' },
      { if: [{ kind: 'visited', scene: 'diggers-chain' }, { kind: 'notFlag', flag: 'grandfather-home' }],
        text: 'The old reeve\'s grave in the churchyard stays empty. {aldous} fills it in anyway, and visits it every week.' },
      { if: [{ kind: 'notFlag', flag: 'seal-cracked' }],
        text: 'Deep under the barrow-field, the {warden}\'s door stands shut in the dark. {marrow}\'s bone chisel lies on the bottom step, where he left it.' },
      { if: [{ kind: 'flag', flag: 'seal-cracked' }],
        text: 'On still nights the fen-folk swear that something under the barrows knocks, faintly, like a knuckle on a door.' },
      { if: [{ kind: 'visited', scene: 'chapel' }],
        text: 'Out in the fen, the drowned chapel leans a little further every winter. Someone has cut the rope from its bell.' },
      { if: [],
        text: 'On the night the barrows close, at the fen\'s edge, two figures step out of the reeds. They do not walk so much as *arrive*, tall and green-fingered, with river-weed in their hair. They are sisters, unmistakably, of a certain {reedwife}. They look at the sealed barrow-field, and then at the town, and take their time about both. The reeds close behind them without a ripple.' },
    ],
  },
};

/** What this chapter once said about people in flags of its own (see
 *  HOLLOW_ROAD_RENAMED_NPC_FLAGS). */
export const SUNKEN_BARROWS_RENAMED_NPC_FLAGS: Record<string, string> = {
  'met-wren': npcMetFlag('wren'),
  'halden-saved': npcFateFlag('halden', 'saved'),
  'marrow-sings': npcFateFlag('marrow', 'sings'),
  'marrow-bound': npcFateFlag('marrow', 'bound'),
};
const SUNKEN_BARROWS_RENAMED: Record<string, string> = {
  ...SUNKEN_BARROWS_RENAMED_NPC_FLAGS,
  ...carriedRenames('hollow-road', HOLLOW_ROAD_RENAMED_NPC_FLAGS),
  ...TRILOGY_RENAMED_FATES,
};

export const SUNKEN_BARROWS_MODULE: Module = withCanon({
  id: 'sunken-barrows', title: 'The Sunken Barrows',
  blurb: 'The {reedwife}\'s fall broke an old vigil. Follow {thornwick}\'s walking dead into the fen — and close what your victory opened.',
  cover: 'loc-crypt',
  levelBand: { from: 3, to: 4 },
  // Part 2 of the trilogy: a victory carries the company into The Wyrmcalling.
  sequel: 'wyrmcalling',
  start: 'return', scenes, defeatScene: 'sb-defeat', town: 'town',
  // The clock: {marrow} is prying the lead out of the Warden's door, and the
  // thing behind it pushes back. A warning on the third morning ({marrow}
  // says what it means in the painted hall); on the fifth the door has
  // shifted, and every way of saying the rites a company has without help
  // (`rites`, `letters`, `kneelers`) is harder at it. Carrying the old reeve
  // (a day) is what most often tips a company past it. No door is lost, only
  // made worse: a failed sealing is the breach fight and a cracked seal.
  // Worded for anywhere the party wakes: the inn, the fen, the barrows.
  dawns: [
    { day: 3, text: ['The ground shivered once in the night, deep down under the fen, the way a door shivers when someone shoves it from the other side. It did not happen again.'] },
    { day: 5, text: ['The ground shook again before dawn, longer this time, and hard enough to wake the soundest sleeper. Somewhere under the fen, old stone gave a little.'],
      effects: [{ kind: 'setFlag', flag: 'door-straining' }] },
  ],
  // What the last chapter remembers (read there as 'sunken-barrows:<flag>'),
  // and no more than the ledger (docs/state-ledger.md): that the company won
  // this chapter (`won`), whether the Warden's door shut cracked, and the
  // valley's regard (`regard`, 0–3: see REGARD), owed back at the
  // Wyrmcalling. Which deeds earned it stays here, and whether Wren came
  // down the barrow stair is forgotten with the chapter. Whether the company knows Wren, whether Brother
  // Halden lived and what became of Marrow are NPC state, and need no carry.
  carries: ['won', 'seal-cracked', 'regard'],
  // Saves from before that state moved onto the NPCs.
  renamedFlags: SUNKEN_BARROWS_RENAMED,
  companions: companionsFrom(NPCS, [
    { id: 'wren', blurb: 'The reeve\'s scout. Guiding you through the deep fen as far as the {barrow-gate}, where she means to hold the way out.' },
  ]),
}, { npcs: NPCS, facts: TRILOGY_FACTS });
