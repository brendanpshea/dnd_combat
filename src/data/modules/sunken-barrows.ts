/**
 * "The Sunken Barrows" — Part 2 of the trilogy (docs/trilogy-plan.md): a
 * L3→4 adventure in three acts (Thornwick's wrong graves → the deep fen →
 * the Undercrypt), continuing The Hollow Road's company or standing alone.
 *
 * The premise pays off Part 1's victory with its cost: the Reedwife was not
 * merely squatting in the marsh — she was the Undercrypt's jailer gone to
 * rot, paid a lamb each midwinter to keep something older under. The
 * company killed her, so the barrows are opening, and the debt is theirs.
 * The Cult of the Worm arrives to finish what the broken ward began.
 *
 * XP budget (see trilogy-plan.md): required spine ≈ 5,550 encounter XP
 * (shadows 200, chapel 650, wisps 1100, lychgate 900, wights 800, the king
 * 800, cult finale 1100), the serpent pool optional (+900). A continuing
 * company (median ~1,650 XP from Part 1) reaches L4 honestly before the
 * finale; the `xpToLevel: 4` on the finale win is the floor for a
 * fight-shy or cold-start run. Cold starts: the opening choice carries
 * `xpToLevel: 3`, a no-op for a continuing party.
 *
 * MONSTER VARIETY: this module owns the undead/guardian shelf — shadows,
 * ghouls by night, a corrupt chapel, will-o'-wisps, gargoyles, wights, a
 * mummy, constrictor snakes, and the cult — none of it fielded by Part 1.
 */
import type { Module, Scene, Effect } from '../../adventure/types.js';

const MIRA = { id: 'npc-mira', name: 'Mira the Innkeeper', portraitId: 'npc-innkeeper', emoji: '🍺' };
const BRAM = { id: 'npc-bram', name: 'Bram the Quartermaster', portraitId: 'npc-merchant', emoji: '🧑‍🌾' };
const REEVE = { id: 'npc-reeve', name: 'Reeve Aldous', portraitId: 'npc-noble', emoji: '⚖️' };
const WREN = { id: 'npc-wren', name: 'Wren, the Reeve\'s Scout', portraitId: 'npc-scout', emoji: '🏹' };
const HALDEN = { id: 'npc-halden', name: 'Brother Halden', portraitId: 'npc-priest', emoji: '🕯️' };

/** Wren comes along from the fen road, however the party first meets her. */
const WREN_JOINS: Effect[] = [
  { kind: 'setFlag', flag: 'met-wren' }, { kind: 'joinParty', companion: 'wren' },
];

/** What Wren tells the party at the fen road, whether or not they know her. */
const WREN_BRIEF = 'I\'ve scouted the near fen twice since the graves opened. Every trail runs to the old barrow-country, past the **drowned chapel** and past the **corpse-lights**. I can walk you as far as sense allows. After that it\'s barrows, and sense stays home.';

/** What the chapel hands over, whether Halden lived through it or not. */
const CHAPEL_CLEARED: Effect[] = [
  { kind: 'setFlag', flag: 'chapel-cleared' }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 },
  { kind: 'journal', entry: { id: 'c-rites', kind: 'clue', title: 'The Rites of Sealing',
    body: 'Brother Halden\'s prayer book holds the old rites of sealing. The Reedwife was the jailer of the Warden of the Barrows. The fen-folk paid her a lamb each midwinter, and she kept him asleep. Her death broke his seal. Speak the rites at the Warden\'s door, deep in the great barrow, to shut him in again.' } },
];

/** The words Halden said over Thornwick's dead, said back to him. */
const LITURGY = '*Lie down and be at peace. Your work is done. The bell will wake you.*';

/** The cult, glimpsed in the fen before it shows itself at the Warden's door. */
const WORM_CLUE: Effect = { kind: 'journal', entry: { id: 'c-worm', kind: 'clue', title: 'Robes the Colour of Worms',
  body: 'A stranger lay drowned among the corpse-lights, in long robes the colour of grave-worms. Nailed boots on the old road, black candles in the chapel, and now this. Someone living is helping the dead along.' } };

/** Taking Aldous's commission. */
const REEVE_TAKE = [{ id: 'take', label: 'Take the reeve\'s commission', to: 'town', once: true,
  effects: [{ kind: 'setFlag' as const, flag: 'reeve-task' }, { kind: 'gold' as const, amount: 60 },
    { kind: 'journal' as const, entry: { id: 'n-aldous', kind: 'npc' as const, title: 'Reeve Aldous',
      body: 'Thornwick\'s reeve is proud and paying, and he takes this one personally. His grandfather\'s grave is among the opened. His orders are simple. Follow the dead into the fen and end what calls them.' } },
    { kind: 'journal' as const, entry: { id: 'lead-fen', kind: 'lead' as const, resolvedBy: 'undercrypt-found',
      title: 'Into the Deep Fen', body: 'The dead walk one way, into the barrow-country of the deep fen. The reeve\'s scout, Wren, waits at the fen road to guide you in. Find where the trails meet.' } }] }];

const INN_CHOICES = [
  { id: 'room', label: 'Take a room for the night — 1 gold (long rest)', to: 'inn-rest',
    requires: [{ kind: 'gold' as const, atLeast: 1 }], effects: [{ kind: 'gold' as const, amount: -1 }] },
  { id: 'leave', label: 'Back to the street', to: 'town' },
];

/** The serpents beaten, however the fight began. */
const POOL_WON = { to: 'fen', text: ['The serpents lie in loops like dropped rope. Your boots turn up everything the fen-folk ever paid here, from old coins to a sealed flask of potion. The pool is plain water now.'],
  effects: [{ kind: 'setFlag' as const, flag: 'pool-cleared' }, { kind: 'gold' as const, amount: 85 }, { kind: 'addItem' as const, itemId: 'potion-greater-healing', qty: 1 }] };

const POOL_CHOICES = [
  { id: 'fight', label: 'Wade in and settle the rent', to: 'pool-fight' },
  { id: 'leave', label: 'Leave the pool its privacy', to: 'fen' },
];

/** What the party can still do in Thornwick once the door is sealed. */
const SB_CLAIMS = [
  { id: 'bounty', label: 'Collect the reeve\'s commission', to: 'sb-claim-paid',
    requires: [{ kind: 'notFlag' as const, flag: 'sb-paid' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold' as const, amount: 150 }, { kind: 'setFlag' as const, flag: 'sb-paid' }] },
  { id: 'mira', label: 'Stand Mira\'s taproom a round (10 gold)', to: 'sb-claim-round',
    requires: [{ kind: 'gold' as const, atLeast: 10 }, { kind: 'notFlag' as const, flag: 'sb-round' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold' as const, amount: -10 }, { kind: 'setFlag' as const, flag: 'sb-round' }] },
  // The good deeds from below, handed over in person, once each.
  { id: 'grandfather', label: 'Lay the old reeve before Aldous', to: 'sb-claim-grandfather', once: true,
    requires: [{ kind: 'flag' as const, flag: 'grandfather-home' }, { kind: 'notFlag' as const, flag: 'sb-grandfather' }], hideWhenBlocked: true,
    effects: [{ kind: 'setFlag' as const, flag: 'sb-grandfather' }] },
  { id: 'purses', label: 'Hand the drowned folk\'s purses to the fen-folk', to: 'sb-claim-purses', once: true,
    requires: [{ kind: 'flag' as const, flag: 'drowned-gold-home' }, { kind: 'notFlag' as const, flag: 'sb-purses' }], hideWhenBlocked: true,
    effects: [{ kind: 'setFlag' as const, flag: 'sb-purses' }] },
  // `won`: the one road to the victory ending, carried for the last chapter.
  { id: 'done', label: 'Let the town sleep', to: 'sb-epilogue', effects: [{ kind: 'setFlag' as const, flag: 'won' }] },
];

const scenes: Record<string, Scene> = {
  // === ACT 1 — THORNWICK, THE WRONG BELLS ================================
  return: {
    id: 'return', kind: 'story', art: { imageId: 'loc-town', emoji: '🔔' },
    text: [
      'Thornwick by night, and the bells are ringing. Not the steady count of the hour. This is the panicked clatter of a rope hauled by somebody who has forgotten how bells work.',
      'Last season the Ashfang raiders fell, and the **Reedwife**, the green hag of the fen, died in the Ashfang chief\'s hall. That was your company\'s work, and Thornwick still toasts you for it. Since then, the valley has slept easy. The gate-warden\'s face says the sleeping is over. "It\'s the **churchyard**," he manages. "The graves are *open*, and it wasn\'t shovels did it."',
      'Down the lane, past the shuttered market, cold lamplight spills across the churchyard wall. And the shadows between the stones are moving against the light.',
    ],
    next: [{ id: 'go', label: 'Answer the bells', to: 'lychyard',
      // Cold-start floor: a fresh company starts this module at 3rd level
      // (no-op for a party continuing from The Hollow Road at L3+).
      effects: [{ kind: 'xpToLevel', level: 3 },
        { kind: 'journal', entry: { id: 'q-barrows', kind: 'quest', title: 'The Opened Graves',
          body: 'Thornwick\'s dead are leaving their graves and walking into the deep fen. Find what is calling them, and stop it.' } }] }],
    noBack: true,
  },
  lychyard: {
    id: 'lychyard', kind: 'battle', encounterId: 'shadow-ambush', mapId: 'corridor',
    intro: [
      'The churchyard gate hangs off its hinge. Between the headstones, the darkness has come loose. Two shapes of it glide toward you across the grass. You can feel the cold coming off them, and holy ground does not slow them down at all.',
      'Draw steel, for whatever good steel does against a shadow.',
    ],
    onWin: { to: 'grave-morning', text: ['The last shadow tatters apart on your blade like smoke off a doused fire. The churchyard holds its breath.'] },
    // Lost before the party has met anyone who could drag them out of the fen:
    // the town carries them in, and morning still shows them the graves.
    onLoss: { to: 'lychyard-lost' },
  },
  'lychyard-lost': {
    id: 'lychyard-lost', kind: 'rest', variant: 'long', next: 'grave-morning',
    intro: [
      'The cold sinks into your bones, and the grass comes up to meet you. The last thing you hear is the bells.',
      'You wake in the Wander-Inn with the sun up. The bell-ringers carried you in. "The shadows went with the dark," **Mira** says, and puts a bowl in your hands. "The graves have waited this long. They can wait while you eat."',
    ],
  },
  'grave-morning': {
    id: 'grave-morning', kind: 'story', noBack: true, art: { emoji: '⛪' },
    text: [
      'Morning shows the churchyard plain, and plain is worse. A dozen graves stand open — dug *outward*, turf thrown wide from below. The dead didn\'t wait for anyone to take them. They climbed out and left on their own.',
      'And they left together. The drag-marks run through the gap in the wall and out across the water-meadows. Every one of them points the same way, straight as a drawn line: **into the deep fen**.',
      'Every old headstone carries the same words, cut deep and green with moss. ' + LITURGY + ' Thornwick\'s priests have said them over every grave for three hundred winters.',
    ],
    next: [{ id: 'on', label: 'Take it to the town', to: 'town',
      effects: [{ kind: 'setFlag', flag: 'dead-walk' },
        { kind: 'journal', entry: { id: 'c-deadwalk', kind: 'clue', title: 'They Walk One Way',
          body: 'Something opened the graves from below. Every trail leads the same way. They all point into the deep fen, where the old burial mounds stand.' } }] }],
  },
  town: {
    id: 'town', kind: 'explore',
    map: {
      title: 'Thornwick', theme: 'stone', art: { imageId: 'loc-town', emoji: '🏘️' },
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
        { id: 'inn', x: 22, y: 32, label: 'The Wander-Inn', icon: 'tok-tavern', scene: 'inn',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'reeve-task' }], to: 'inn-later' }] },
        { id: 'market', x: 44, y: 42, label: 'Market', icon: 'tok-market', scene: 'sb-market' },
        { id: 'reeve', x: 70, y: 30, label: 'The Reeve\'s Hall', icon: 'tok-house', scene: 'reeve-hall',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'reeve-task' }], to: 'reeve-done' }] },
        { id: 'graves', x: 30, y: 72, label: 'The Churchyard', icon: 'tok-temple', scene: 'grave-study',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'graves-read' }], to: 'graves-done' }] },
        // Wren waits here: an old friend if the company pulled her out from
        // under a horse in Part 1, a stranger otherwise; after that, the road.
        { id: 'fen-gate', x: 80, y: 76, label: 'The Fen Road', icon: 'tok-gate', scene: 'fen-out',
          requires: [{ kind: 'flag', flag: 'reeve-task' }],
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'met-wren' }], to: 'fen-road' },
            { if: [{ kind: 'flag', flag: 'hollow-road:saved-scout' }], to: 'fen-reunion' },
            // The scout under the horse died in Part 1: this Wren is someone else.
            { if: [{ kind: 'flag', flag: 'hollow-road:scout-met' }], to: 'fen-partner' },
            // The company walked past her on the marsh road in Part 1.
            { if: [{ kind: 'flag', flag: 'hollow-road:scout-left' }], to: 'fen-left' },
          ] },
      ],
    },
  },
  // The company that killed the Reedwife, home again: Mira says out loud
  // what the rest of the taproom is thinking.
  inn: {
    id: 'inn', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'The Wander-Inn is full, and nobody is in a hurry to leave. Nobody in Thornwick wants to be alone today, not with the churchyard standing open. **Mira** sets down a bowl in front of you unasked.',
      '"So. The marsh sends us another bill." She says it flat, wiping the bar the way other people sharpen knives. "I\'ll say it, since nobody else in here will. You killed the Reedwife last season. This season the dead get up and walk. The fen-folk say she kept something shut out there, and now nobody\'s minding it."',
      '"I poured your first round on the house when you came back from that den, and I\'d do it again. But folk are starting to look at you sideways. Eat. Then go see the reeve. He\'s been pacing his hall since the bells."',
    ],
    next: INN_CHOICES,
  },
  'inn-later': {
    id: 'inn-later', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'The Wander-Inn is as full as ever. Nobody in Thornwick wants to sleep alone while the dead are walking. **Mira** slides a bowl your way without asking.',
      '"So Aldous hired you. Good. He pays slow, but he pays." She tops up your cup. "Finish what she left behind, and the town will stop looking at you sideways. The fen will still be out there in the morning. That\'s the trouble with it."',
    ],
    next: INN_CHOICES,
  },
  'inn-rest': {
    id: 'inn-rest', kind: 'rest', variant: 'long', next: 'town',
    intro: ['A bolted door, a real bed, and the comfortable murmur of a crowded taproom below. Whatever walks the fen, it isn\'t walking in here. You sleep like the blessedly living.'],
  },
  // Stocked for a town whose dead are walking: blunt steel for bone, and
  // everything a priest would sell you if Thornwick still had one.
  'sb-market': { id: 'sb-market', kind: 'shop', title: 'Thornwick Market', next: 'town',
    npc: BRAM,
    stock: [
      'potion-healing', 'potion-greater-healing', 'alchemists-fire',
      'scroll-guiding-bolt', 'scroll-bane', 'scroll-shield-of-faith', 'scroll-command',
      'scroll-burning-hands', 'scroll-hold-person', 'scroll-magic-missile',
      'mace', 'warhammer', 'shield',
    ],
    intro: ['"Grave-trouble, they say." **Bram** spreads his hands over the stall. "Then you\'ll be wanting silver, steel, and no questions. Two of the three I stock."'] },
  // He knows this company: it broke the Ashfang last season.
  'reeve-hall': {
    id: 'reeve-hall', kind: 'dialogue', npc: REEVE, art: { emoji: '⚖️' },
    lines: [
      'The reeve\'s hall smells of candle-wax and ledgers. **Reeve Aldous** stands at the window with his back to you. He watches the fen fog eat his water-meadows. He grips his chain of office in one fist, like a weapon he doesn\'t know how to use.',
      '"You again," he says, without turning. "Last season you broke the Ashfang. Thornwick settles its debts. It appears the marsh does likewise. My grandfather\'s grave is open, and my grandfather has *gone somewhere*. We buried him in his chain of office. The twin of this one."',
      'He turns. He looks as if he has not slept since the bells. "The fen-folk say the hag kept something shut out there, and that it got loose when you killed her. I don\'t know if that is true. I know you stood in my churchyard last night, and my watch did not. So I am paying you. Follow my dead into the fen, find what calls them, and put it down."',
      '"My scout, Wren, will meet you at the fen road. She asked for the job. Rather forcefully, for someone I employ."',
    ],
    next: REEVE_TAKE,
  },
  'reeve-done': {
    id: 'reeve-done', kind: 'story', art: { emoji: '⚖️' },
    text: ['The reeve\'s clerk intercepts you at the door with the particular firmness of a man defending his employer\'s composure. "The commission stands. The reeve counts on you. The reeve is *busy*." Through the doorway, the reeve is visibly not busy. He is watching the fen.'],
    next: [{ id: 'ok', label: 'Leave him to it', to: 'town' }], noBack: true,
  },
  'grave-study': {
    id: 'grave-study', kind: 'check', skill: 'medicine', dc: 12, art: { emoji: '🪦' },
    intro: ['The open graves wait for a steadier eye. The dead left in company — but bodies, even walking ones, tell their stories to anyone trained to listen.'],
    // `graves-ranks`: the dead keep step, oldest first. Knowing it opens an
    // easier way past the diggers in the Undercrypt. A failed read closes it.
    success: { to: 'town', text: ['The story is in the turf. They didn\'t claw out in hunger. They *stepped* out in order, oldest graves first, called up in ranks. Whatever summons them has real authority. It is old enough to call the oldest first.',
      'If you ever have to walk among them, you know how now. Keep the step, and keep to the back of the oldest rank.'],
      effects: [{ kind: 'setFlag', flag: 'graves-read' }, { kind: 'setFlag', flag: 'graves-ranks' }, { kind: 'xp', amount: 30 },
        { kind: 'journal', entry: { id: 'c-muster', kind: 'clue', title: 'The Dead Marched in Ranks',
          body: 'The dead left in neat rows, oldest graves first. They were not hungry. They were obeying orders. Something down there has the right to command graves, and it is using it. If you must pass among them, fall in at the back of the oldest rank.' } }] },
    failure: { to: 'town', text: ['You get mud, turf, and the underside of a churchyard. You trample the edges of three graves, and whatever they had to say is gone under your boots. You will never know how the dead left, or in what order.',
      'The trails still point one way, into the fen. Whatever order the dead keep, you will have to learn it down there, among them.'],
      effects: [{ kind: 'setFlag', flag: 'graves-read' }] },
  },
  'graves-done': {
    id: 'graves-done', kind: 'story', art: { emoji: '🪦' },
    text: ['The churchyard lies quiet, its open graves still gaping at the sky. Nothing more walks here. Everything that could has already gone ahead of you.'],
    next: [{ id: 'ok', label: 'Back to town', to: 'town' }], noBack: true,
  },
  // First meeting: a company that never pulled Wren from under the horse in
  // Part 1 (or a fresh one) meets the reeve's scout here.
  'fen-out': {
    id: 'fen-out', kind: 'dialogue', npc: WREN, art: { imageId: 'loc-marsh', emoji: '🌫️' },
    lines: [
      'The cart-road ends where the old raised road begins. A young woman in the reeve\'s colours sits on a milestone there, sharpening a boot-knife. A bow lies across her knees. She favours one leg when she stands, and pretends she doesn\'t.',
      '"**Wren**. The reeve\'s scout." She says it fast, like she practised it on the way here. "' + WREN_BRIEF + '"',
    ],
    next: [{ id: 'go', label: 'Follow her onto the raised road', to: 'fen',
      effects: [...WREN_JOINS,
        { kind: 'journal', entry: { id: 'n-wren', kind: 'npc', title: 'Wren, the Reeve\'s Scout',
          body: 'Wren is Reeve Aldous\'s scout. She is young, she limps, and she will not be left behind. She guides you through the deep fen as far as the old barrow-country.' } }] }],
  },
  // The company stepped round her on the marsh road in Part 1. She lived.
  'fen-left': {
    id: 'fen-left', kind: 'dialogue', npc: WREN, art: { imageId: 'loc-marsh', emoji: '🌫️' },
    lines: [
      'The cart-road ends where the old raised road begins. A young woman in the reeve\'s colours sits on a milestone there, sharpening a boot-knife. She stands when she sees you, and favours one leg.',
      '"**Wren**. The reeve\'s scout." She looks at you a long moment. "We\'ve met. You stepped round me on the marsh road, under a dead horse. The reeve\'s men dug me out the next day." She puts the knife away. "I\'m not here to settle that. I\'m here because the reeve asked. Keep up."',
      '"' + WREN_BRIEF + '"',
    ],
    next: [{ id: 'go', label: 'Follow her onto the raised road', to: 'fen',
      effects: [...WREN_JOINS,
        { kind: 'journal', entry: { id: 'n-wren', kind: 'npc', title: 'Wren, the Reeve\'s Scout',
          body: 'Wren is Reeve Aldous\'s scout, the one you left under a horse on the marsh road. She lived. She guides you through the deep fen anyway, as far as the old barrow-country.' } }] }],
  },
  // The company found a scout dying under a horse in Part 1, and she never
  // told them her name. She was Wren's partner.
  'fen-partner': {
    id: 'fen-partner', kind: 'dialogue', npc: WREN, art: { imageId: 'loc-marsh', emoji: '🌫️' },
    lines: [
      'The cart-road ends where the old raised road begins. A young woman in the reeve\'s colours sits on a milestone there, sharpening a boot-knife. A bow lies across her knees.',
      '"**Wren**. The reeve\'s scout." She looks you over. "You\'re the ones who found Tamsin under that horse on the marsh road. She was my partner. The reeve says you stayed with her at the end." She puts the knife away. "Thank you for that."',
      '"' + WREN_BRIEF + '"',
    ],
    next: [{ id: 'go', label: 'Follow her onto the raised road', to: 'fen',
      effects: [...WREN_JOINS,
        { kind: 'journal', entry: { id: 'n-wren', kind: 'npc', title: 'Wren, the Reeve\'s Scout',
          body: 'Wren is Reeve Aldous\'s scout. Her partner Tamsin was the scout you found dying on the marsh road. She guides you through the deep fen as far as the old barrow-country.' } }] }],
  },
  // Reunion: the company saved her on the marsh road in Part 1.
  'fen-reunion': {
    id: 'fen-reunion', kind: 'dialogue', npc: WREN, art: { imageId: 'loc-marsh', emoji: '🌫️' },
    lines: [
      'The cart-road ends where the old raised road begins. A familiar figure sits there sharpening a familiar boot-knife. It is **Wren**, upright this time, with no dead horse on top of her. Someone has mended the reeve\'s colours at her shoulder.',
      '"Heard the bells. Figured you\'d be along." She stands, and only barely favours the leg. "' + WREN_BRIEF + '"',
    ],
    next: [{ id: 'go', label: 'Follow her onto the raised road', to: 'fen',
      effects: [...WREN_JOINS,
        { kind: 'journal', entry: { id: 'n-wren', kind: 'npc', title: 'Wren, Again',
          body: 'Wren is the scout you pulled from under a dead horse on the marsh road. Her leg has healed, and she refuses to stay behind. She guides you through the deep fen as far as the old barrow-country.' } }] }],
  },
  'fen-road': {
    id: 'fen-road', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🌫️' },
    text: ['The old raised road runs out into the fog, the same as before. The fen waits at the end of it.'],
    next: [
      { id: 'go', label: 'Out along the raised road', to: 'fen' },
      { id: 'back', label: 'Back to town', to: 'town' },
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
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'fen-read' }], to: 'causeway-done' }] },
        { id: 'chapel', x: 42, y: 34, label: 'The Drowned Chapel', mystery: 'A sunken bell-tower…', icon: 'tok-temple', scene: 'chapel',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'chapel-cleared' }], to: 'chapel-done' }] },
        { id: 'lights', x: 44, y: 76, label: 'The Corpse-Lights', mystery: 'Pale fire over the water…', icon: 'tok-danger', scene: 'lights',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'lights-skirted' }], to: 'lights-skirted-done' },
            { if: [{ kind: 'flag', flag: 'lights-cleared' }], to: 'lights-done' }] },
        // Optional, so it may come after Wren has stayed at the Barrow Gate.
        { id: 'pool', x: 66, y: 22, label: 'The Serpent Pool', mystery: 'Ripples with no wind…', icon: 'tok-well', scene: 'pool',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'pool-cleared' }], to: 'pool-done' },
            { if: [{ kind: 'noCompanion', companion: 'wren' }], to: 'pool-alone' }] },
        { id: 'lychgate', x: 78, y: 56, label: 'The Barrow Gate', mystery: 'Standing stones ahead…', icon: 'tok-gate', scene: 'lychgate',
          requires: [{ kind: 'flag', flag: 'chapel-cleared' }, { kind: 'flag', flag: 'lights-cleared' }],
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'lychgate-cleared' }], to: 'lychgate-open' }] },
      ],
    },
  },
  causeway: {
    id: 'causeway', kind: 'story', art: { imageId: 'loc-marsh', emoji: '👣' },
    text: [
      'The old raised road is older than the cart-track that meets it. Hands that measured in generations laid these great flat stones. Wren crouches at its edge and reads the mud the way Mira reads a customer.',
      '"Here. And here." Footprints, water-filled, in files. "Your churchyard dead came through in *step*. And look at this." She points to older prints, sunk deeper, ' +
      'wider. "They weren\'t the first. The fen\'s own dead have been walking for days. Whatever\'s calling has been at it a while, and it isn\'t calling them to wander. It\'s calling them to **work**."',
      'Wren frowns at one print and sets her thumb in it. "This one has nails in the heel. The dead don\'t buy boots. Somebody **living** walked out here with them."',
      'There are two ways on. North stands the broken tower of the **drowned chapel**. South lies flat water where the **corpse-lights** dance. Past them both, where all the tracks come together, the barrow-country waits.',
    ],
    next: [{ id: 'on', label: 'Into the fen', to: 'fen',
      effects: [{ kind: 'setFlag', flag: 'fen-read' },
        { kind: 'journal', entry: { id: 'c-work', kind: 'clue', title: 'Called to Work',
          body: 'The fen\'s own dead have walked for days, in rows, past the chapel and the corpse-lights toward the old barrow-country. Whatever calls them is putting them to work. It is digging something open, or building something. One set of prints had nailed boots. Someone living walked with them.' } }] }],
  },
  'causeway-done': {
    id: 'causeway-done', kind: 'story', art: { emoji: '👣' },
    text: ['The old road\'s stones stretch on into the fog. The files of footprints are still there. Everything that made them has already gone on ahead.'],
    next: [{ id: 'ok', label: 'Press on', to: 'fen' }], noBack: true,
  },
  'fen-night': {
    id: 'fen-night', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'marsh-dead', mapId: 'bog',
    intro: ['You wake to a hand on your shoulder and a blade already drawn beside you. The fen has sent visitors. Two ghouls, grave-mud to the elbows, crawl out of the black water. They move with the calm confidence of things that have done this before. No rest tonight. Just work.'],
    onWin: { to: '@hub', text: ['The ghouls lie still, properly still this time. The night is ruined and the fire is out. Nobody says what you are all thinking. They came from further in, where every track in this fen leads.'] },
  },
  chapel: {
    id: 'chapel', kind: 'dialogue', npc: HALDEN, art: { imageId: 'loc-temple', emoji: '🕯️' },
    lines: [
      'The chapel kneels in the water, drowned to its windows, its bell-tower leaning like a man listening. Candles burn on every ledge. Most are plain white wax, the kind the chandler sells in Thornwick. A few are **black tallow**, and they smoke like wet wood. On the dry island of the altar steps stands a priest. His robes are fen-stained, his face serene. He is leading a congregation.',
      'The congregation is dead. They stand in the water in row after row, mud-black and empty-eyed, every face turned to the altar.',
      'Wren grips your arm. "That\'s **Brother Halden**," she whispers. "He kept the little chapel in Thornwick. Mildest man in the valley. He could never get a room to go quiet."',
      '"**Welcome!**" Halden beams at you with terrible peace, and the whole room goes quiet for him. "You\'ve come to see the great work. The Warden below is gathering his flock at last. I merely… keep the service, until he calls them down. Will you kneel? Everyone kneels down here, sooner or later."',
    ],
    next: [
      { id: 'insight', label: '[Insight DC 13] Read what\'s wearing him before it moves', to: 'chapel-caught',
        once: true, check: { skill: 'insight', dc: 13, failTo: 'chapel-fight' } },
      { id: 'refuse', label: 'Refuse the sermon and draw', to: 'chapel-fight' },
    ],
  },
  'chapel-fight': {
    id: 'chapel-fight', kind: 'battle', encounterId: 'temple', mapId: 'ruins',
    intro: ['Halden sighs, a shepherd let down by his flock. Two skeletons in rotted mourning-clothes wade out of the rows. Two acolytes in Thornwick\'s chapel colours step up beside him, their eyes as empty as the dead\'s. "The Warden provides," says Halden, and sets them on you.'],
    onWin: { to: 'chapel-won', text: ['Halden sinks down on the altar steps and does not rise again. At the end, he mostly looks relieved.'] },
    // Saving Halden: the thing wearing him borrowed his prayers, so his own
    // words for the dead can turn it out. One try, before the first blow.
    parley: {
      skill: 'religion', dc: 14, label: 'Speak his own liturgy back to him',
      success: { to: 'chapel-saved', text: [
        'You know the words Halden said over Thornwick\'s dead. They are cut on every old headstone in his churchyard. You say them back to him, slow and plain. ' + LITURGY,
        'His smile twitches. The acolytes stop in mid-step. Then the thing inside Halden lets go of him all at once, like a hand opening. His acolytes drop where they stand, and the skeletons fold into the water.',
      ] },
    },
  },
  'chapel-caught': {
    id: 'chapel-caught', kind: 'battle', encounterId: 'temple', mapId: 'ruins',
    surprise: 'enemies',
    intro: ['You see it a breath before it moves. The thing behind Halden\'s serenity winds up through him like rot up a post. You\'re already moving when his two acolytes step forward and two skeletons wade out of the rows. For once the dead are the ones caught flat-footed.'],
    onWin: { to: 'chapel-won', text: ['Caught off balance from the first blow, the dead never find their rows again. Halden slumps against the altar rail and does not get up again. Whatever was wearing him lets go, and he dies looking almost grateful.'] },
    parley: {
      skill: 'religion', dc: 14, label: 'Speak his own liturgy back to him',
      success: { to: 'chapel-saved', text: [
        'You saw the thing behind his face. So you aim your words at the man under it. You speak the words from Thornwick\'s headstones, the prayer Halden said over every one of them. ' + LITURGY,
        'Halden\'s calm face cracks like ice on a pond. Then the thing inside him lets go all at once. His acolytes drop where they stand, and the skeletons fold into the water.',
      ] },
    },
  },
  // Halden lives: he tells the party himself what the dead man's book says.
  'chapel-saved': {
    id: 'chapel-saved', kind: 'dialogue', noBack: true, npc: HALDEN, art: { imageId: 'loc-temple', emoji: '📖' },
    lines: [
      'Halden sits down hard on the altar steps, shaking, and himself again. He stares at his hands as if someone has just given them back. Behind him, his two acolytes sit up in the shallows, coughing up fen-water. "It came up through the floor," he says. "Through the *prayers*. The black candles aren\'t mine. A grey little gravedigger brought them. He said his name was **Marrow**, and I *thanked* him."',
      'He pushes his prayer book into your hands. "The **Reedwife** was never just a hag. She was a jailer. The fen-folk left her a lamb at the water\'s edge each midwinter, and for that she kept the **Warden of the Barrows** asleep under the fen. When she died, his seal broke with her. Now he calls the dead to open his door from the inside." Wren lets out a breath. "So the hag was the lock," she says quietly. "And we broke it."',
      'Halden taps the flyleaf, where someone has inked a mark of reeds and a reaching hand. "That\'s the hag\'s brand," Wren says. "Every marsh-thing that ran with the Ashfang wore it." Halden shakes his head. "It was a keeper\'s mark first. The vigil\'s mark. The old builders cut it into the Barrow Gate, and the gate\'s watchers know it. She grew greedy and burned it into everything she owned. She made a keeper\'s mark into a slaver\'s brand."',
      '"The rites of sealing are in there too. Someone must say them at his door, in the great barrow past the gate, and say them whole. It will take nerve. I couldn\'t say them while it had me, but I\'ll follow you down and wait on the stair." He finds a healing potion under the altar cloth and gives you that too. "Nerve we\'ve got," Wren says, and she sounds almost sure of it. She puts her own cloak round Halden\'s shoulders without looking at him.',
    ],
    next: [{ id: 'on', label: 'Take the prayer book', to: 'fen',
      effects: [...CHAPEL_CLEARED, { kind: 'setFlag', flag: 'halden-saved' },
        { kind: 'journal', entry: { id: 'n-halden', kind: 'npc', title: 'Brother Halden',
          body: 'Halden keeps Thornwick\'s little chapel. Something under the fen took hold of him through his own prayers, and you talked it out of him. He has promised to follow you down to the Warden\'s door.' } }] }],
  },
  'chapel-won': {
    id: 'chapel-won', kind: 'story', noBack: true, art: { imageId: 'loc-temple', emoji: '📖' },
    text: [
      'Halden\'s prayer book lies open on the altar, fen-damp but easy to read. Notes crowd the margins in his tidy hand. *The Reedwife was the jailer of the Warden of the Barrows. The fen-folk paid her a lamb each midwinter, and she kept him asleep under the fen. She is dead, and the vigil is over. The Warden wakes, and gathers hands to open his door from within.* Further down, the hand changes. It shakes, like a man fighting his own arm.',
      'Pressed so hard the nib tore the page: *"The rites of sealing are in this book. Someone with nerve must say them at his door, in the great barrow. Not me. It will not let it be me."* On the flyleaf, someone has inked a mark of reeds and a reaching hand. Beside it, in the tidy hand: *The vigil\'s mark. The old builders cut it into the Barrow Gate, and its watchers know it. It was a keeper\'s mark first. She made it a slaver\'s brand.*',
      '"That\'s the hag\'s brand," Wren says, reading over your shoulder. "You saw it on those lizardfolk in the hollow. Every marsh-thing that ran with the Ashfang wore it." She frowns at the page. "So the hag was the lock. And we broke it." She shuts the book and hands it to you. "Well. Nerve we\'ve got. The door\'s past the Barrow Gate."',
      'Under the altar cloth you find a healing potion that Halden never got to drink. On the way out, Wren sniffs one of the black candles and makes a face. "Halden never bought these in Thornwick. Somebody brought them out here."',
    ],
    next: [{ id: 'on', label: 'Take the prayer book', to: 'fen', effects: CHAPEL_CLEARED }],
  },
  'chapel-done': {
    id: 'chapel-done', kind: 'story', art: { imageId: 'loc-temple', emoji: '🕯️' },
    text: ['The drowned chapel stands empty. Its awful congregation lies still at last, and the candles have burned out. The bell-tower still leans, listening to nothing.'],
    next: [{ id: 'ok', label: 'Back to the fen', to: 'fen' }], noBack: true,
  },
  // The corpse-lights: fight them (after resisting their pull), or walk round
  // the pools by the firm ground. Only the fight finds the drowned folk's purses.
  lights: {
    id: 'lights', kind: 'story', art: { emoji: '💡' },
    text: [
      'The flat water south of the old road is where the fen does its prettiest lying. Lights hang over the black mirror — soft, swaying, warm as windows. Wren\'s face goes carefully blank. "Corpse-candles. They walk mourners into the deep pools and hold them under. Half the people the fen has taken this year are *under this water*."',
      'The lights drift nearer, hopeful as dogs. Something else moves between them, further out. It is a colder shape, and it was a person once.',
      '"We don\'t have to go through," Wren says quietly. "There\'s firm ground round the pools, if you can find it. Miss it, and the lights find *you*."',
    ],
    next: [
      { id: 'fight', label: 'Snuff them out', to: 'lights-call' },
      // A druid or a ranger reads the firm ground easier, but it is still a
      // roll, and a miss puts them in the water like anyone else.
      { id: 'druid', label: '[Druid · Nature DC 10] Read the fen like a map, and walk round', to: 'lights-skirted',
        requires: [{ kind: 'classInParty', classId: 'druid' }], hideWhenBlocked: true,
        once: true, check: { skill: 'nature', dc: 10, failTo: 'lights-sunk' } },
      { id: 'ranger', label: '[Ranger · Survival DC 10] Follow the reeds that only grow on firm ground', to: 'lights-skirted',
        requires: [{ kind: 'classInParty', classId: 'ranger' }], hideWhenBlocked: true,
        once: true, check: { skill: 'survival', dc: 10, failTo: 'lights-sunk' } },
      { id: 'skirt', label: '[Survival DC 13] Find the dry way round the pools', to: 'lights-skirted',
        once: true, check: { skill: 'survival', dc: 13, failTo: 'lights-sunk' } },
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
    failure: { to: 'lights-lured', text: ['The water is at your knees before you notice it. Then it is at your waist. The lights close in around you, and they are not warm at all.'] },
  },
  'lights-fight': {
    id: 'lights-fight', kind: 'battle', encounterId: 'wisp-bog', mapId: 'bog',
    intro: ['Two of the lights come in low and fast over the water, crackling with stolen life. A cold shape rises between them. It is a specter trailing fen-mist, its mouth open on a scream the water drank years ago.'],
    onWin: { to: 'lights-won', text: ['The last wisp winks out, and the water goes dark for good. Somewhere under it, the fen\'s drowned can rest at last.'] },
  },
  // Missed the firm ground: in the water before the lights even sing.
  'lights-sunk': {
    id: 'lights-sunk', kind: 'story', noBack: true, art: { emoji: '💡' },
    text: ['You think you have found the firm ground. Three steps later it is not there. You go in to the waist, and the lights come gliding over the water before anyone can pull you out. Wren said it: miss the firm ground, and the lights find you.'],
    next: [{ id: 'on', label: 'Fight your way back to the mud', to: 'lights-lured' }],
  },
  // The same fight, caught waist-deep after the lights' pull won.
  'lights-lured': {
    id: 'lights-lured', kind: 'battle', encounterId: 'wisp-bog', mapId: 'bog',
    surprise: 'party',
    intro: ['Two wisps flare white-hot in front of your faces. The specter rises out of the pool behind you, close enough to touch. You have to fight your way back to the mud before you can fight anything else.'],
    onWin: { to: 'lights-won', text: ['You drag each other out onto the mud, soaked and shaking. The last wisp is out. The water lies dark and still.'] },
  },
  // The drowned folk's purses, and a body that isn't one of them.
  'lights-won': {
    id: 'lights-won', kind: 'story', art: { emoji: '💰' },
    text: [
      'In the shallows you find the purses of the drowned. There are a dozen of them, 55 gold between them, still tied to their belts.',
      'One body is not like the others. It wears long robes the colour of grave-worms, and a stub of **black candle** sits in its belt. Wren turns it over with her boot. "That\'s no fen-folk," she says. "Nobody from here dresses like that to go walking."',
      'She looks at the purses, then at you. "Those belonged to somebody\'s husband, somebody\'s gran. The families could use them. So could you. Your call."',
    ],
    next: [
      { id: 'keep', label: 'Keep the purses. The living have bills too', to: 'lights-kept',
        effects: [{ kind: 'gold', amount: 55 }, { kind: 'setFlag', flag: 'lights-cleared' }, WORM_CLUE] },
      { id: 'home', label: 'Carry the purses home for the families', to: 'fen',
        effects: [{ kind: 'setFlag', flag: 'lights-cleared' }, { kind: 'setFlag', flag: 'drowned-gold-home' }, WORM_CLUE,
          { kind: 'journal', entry: { id: 'c-purses', kind: 'clue', title: 'The Drowned Folk\'s Purses',
            body: 'You took the purses of the people the corpse-lights drowned. You mean to hand them to Reeve Aldous for their families.' } }] },
    ],
    noBack: true,
  },
  // The purses kept: Wren has one thing to say about it, and says it once.
  'lights-kept': {
    id: 'lights-kept', kind: 'story', noBack: true, art: { emoji: '💰' },
    text: ['Wren watches you fill your pockets with the drowned folk\'s coin. She says nothing for a while. "Somebody\'s gran," she says at last, and walks on ahead.'],
    next: [{ id: 'on', label: 'Follow her into the fen', to: 'fen' }],
  },
  // Round the pools on firm ground: the lights stay lit, and the purses stay
  // under the water, but nobody has to wade in.
  'lights-skirted': {
    id: 'lights-skirted', kind: 'story', art: { emoji: '🌾' },
    text: [
      'You find the firm ground and keep to it, one tussock to the next. The lights follow along the water\'s edge, swaying, waiting for a foot to slip. None does.',
      'Halfway round, Wren grabs your sleeve and points. A body floats face-down in the pool. It wears long robes the colour of grave-worms. "That\'s no fen-folk," she whispers. "Nobody from here dresses like that." Then the lights drift closer, and you keep moving.',
    ],
    next: [{ id: 'on', label: 'On toward the barrows', to: 'fen',
      effects: [{ kind: 'setFlag', flag: 'lights-cleared' }, { kind: 'setFlag', flag: 'lights-skirted' }, { kind: 'xp', amount: 50 }, WORM_CLUE] }],
    noBack: true,
  },
  'lights-skirted-done': {
    id: 'lights-skirted-done', kind: 'story', art: { emoji: '💡' },
    text: ['The corpse-lights still sway over the flat water, patient as ever. You found the firm ground once. Nobody wants to test your luck twice.'],
    next: [{ id: 'ok', label: 'Back to the fen', to: 'fen' }], noBack: true,
  },
  'lights-done': {
    id: 'lights-done', kind: 'story', art: { emoji: '🌑' },
    text: ['The flat water lies dark and truthful. Nothing dances over it now. It is the only stretch of the fen that feels *cleaner* for your passing.'],
    next: [{ id: 'ok', label: 'Back to the fen', to: 'fen' }], noBack: true,
  },
  pool: {
    id: 'pool', kind: 'story', art: { emoji: '🐍' },
    text: [
      'North of the chapel the reeds part around a pool so still it looks solid. Old offerings crowd the rim: coins, combs, grinding-stones. Fen-folk have been paying something here for generations. Then the surface moves once, with no wind to move it, in a line longer than a boat.',
      'Wren picks up a coin and puts it back with great care. "The fen-folk fed the pool so the pool stayed *in* the pool. Nobody\'s fed it since the graves opened." The water ripples again, closer. Wren takes one careful step back. "So it\'s hungry. Good to know."',
    ],
    next: [
      { id: 'wren', label: '[Wren] Let Wren draw them out on the far bank', to: 'pool-drawn',
        requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true },
      ...POOL_CHOICES,
    ],
  },
  'pool-alone': {
    id: 'pool-alone', kind: 'story', art: { emoji: '🐍' },
    text: [
      'North of the chapel the reeds part around a pool so still it looks solid. Old offerings crowd the rim: coins, combs, grinding-stones. Fen-folk have been paying something here for generations. Then the surface moves once, with no wind to move it, in a line longer than a boat.',
      'Nobody has left an offering here since the graves opened. The water ripples again, closer to the rim, as if it has noticed.',
    ],
    next: POOL_CHOICES,
  },
  'pool-fight': {
    id: 'pool-fight', kind: 'battle', encounterId: 'snake-pit', mapId: 'marsh',
    intro: ['The pool empties itself at you. Two constrictors the girth of roof-beams pour out of the water in oiled coils. They are fen-serpents, grown old and vast on a century of offerings. And lately, on whatever walks past unwary.'],
    onWin: POOL_WON,
  },
  // Wren's fen-craft: rattle the reeds on the far bank, and the serpents rise
  // there with their backs to you.
  'pool-drawn': {
    id: 'pool-drawn', kind: 'battle', encounterId: 'snake-pit', mapId: 'marsh',
    surprise: 'enemies',
    intro: ['Wren creeps round to the far bank and rattles her bow in the reeds there, the way fen-folk hunt eels. The water bulges on her side of the pool. Two constrictors the girth of roof-beams rise toward the noise, and they have their backs to you.'],
    onWin: POOL_WON,
  },
  'pool-done': {
    id: 'pool-done', kind: 'story', art: { emoji: '💧' },
    text: ['The serpent pool sits quiet, and the offerings on its rim gleam dully. It is deep and cold, and finally ordinary.'],
    next: [{ id: 'ok', label: 'Back to the fen', to: 'fen' }], noBack: true,
  },
  lychgate: {
    id: 'lychgate', kind: 'battle', encounterId: 'gargoyle-perch', mapId: 'ruins',
    intro: [
      'All the tracks come together here, and the barrow-country begins. A gate of standing stones rises ahead, the **Barrow Gate**. It is older than the chapel and older than the road. Two weathered granite watchers crouch on top of it.',
      'Wren stops dead. "Nobody said anything about those." She\'s right — the stone bases are mossy, but the watchers\' claws are clean. The granite stretches, cracks its wings, and drops on you like a falling roof.',
    ],
    onWin: { to: 'lychgate-won', text: ['The second gargoyle shatters mid-dive and rains down as plain gravel. The Barrow Gate stands unwatched now. Beyond it, the field of burial mounds opens out ahead of you.'] },
    // The watchers were set to guard the vigil, not to fight it. Halden's book
    // carries the vigil's mark, if someone knows the old way to show it.
    parley: {
      skill: 'history', dc: 14, label: 'Show them the vigil\'s mark in Halden\'s book',
      success: { to: 'lychgate-won', text: [
        'You hold up Halden\'s book, open at the reed-woman\'s mark on the flyleaf. The old builders cut that same mark into the gate. You find it on the nearest stone and lay your hand flat on it.',
        'The watchers stop at the edge of the lintel. They look at the book for a long, grinding moment. Then they fold their wings and turn back into plain grey stone. They guard the vigil, and the book says you keep it now.',
      ] },
    },
  },
  // Wren stays here. Every way down the steps sends her to her post.
  'lychgate-won': {
    id: 'lychgate-won', kind: 'story', noBack: true, art: { imageId: 'loc-crypt', emoji: '⛩️' },
    text: [
      'Past the Barrow Gate the mounds rise in their dozens. At the field\'s heart the largest barrow stands **open**. Not fallen in, but *unlocked*. A doorway of dressed stone breathes out cold. Worked steps lead down. Every file of the walking dead leads down into it like thread into a needle.',
      'The **Undercrypt**. This is the prison the old prayers named, the one the Reedwife kept shut since long before the first reed-cutters came to the fen. Wren looks at the steps, then at you. "This is where sense stays home," she says. "I\'ll hold the gate. Someone\'s got to be standing here when you walk back out." You pretend, kindly, not to hear the *when* she leans on.',
    ],
    next: [
      { id: 'down', label: 'Leave Wren the gate, and go down', to: 'undercrypt',
        requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true,
        effects: [{ kind: 'leaveParty', companion: 'wren' },
          { kind: 'setFlag', flag: 'lychgate-cleared' }, { kind: 'setFlag', flag: 'undercrypt-found' }] },
      { id: 'down-alone', label: 'Leave Wren the gate, and go down', to: 'undercrypt',
        requires: [{ kind: 'noCompanion', companion: 'wren' }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'lychgate-cleared' }, { kind: 'setFlag', flag: 'undercrypt-found' }] },
    ],
  },
  'lychgate-open': {
    id: 'lychgate-open', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛩️' },
    text: ['The Barrow Gate stands unwatched, its broken guardians spread across the old road as gravel. Beyond, the great barrow\'s doorway breathes out cold. Wren keeps her post at the stones, arms wrapped tight against more than the chill.'],
    next: [{ id: 'down', label: 'Go down into the Undercrypt', to: 'undercrypt' }], noBack: true,
  },

  // === ACT 3 — THE UNDERCRYPT ============================================
  // A dungeon: down the stair, past the painted hall (the bone room behind a
  // hidden door), through the cut where Thornwick's dead are digging, past
  // the barrow-guard and the king, then a drop down the burial shaft to the
  // Warden's door. The diggers and the guard each bar the way until dealt with.
  undercrypt: {
    id: 'undercrypt', kind: 'dungeon',
    dungeon: {
      title: 'The Undercrypt', theme: 'graveyard', art: { imageId: 'loc-crypt', emoji: '🕳️' },
      torch: { length: 16, out: 'crypt-dark' },
      camp: { risky: { chance: 0.35, battleScene: 'crypt-night' } },
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
        { id: 'king', name: 'The King\'s Chamber', size: 'large', fight: 'king' },
        { id: 'shaft', name: 'The Shaft\'s Foot', size: 'small',
          firstVisit: ['You land hard in old bones and older dust. The shaft goes up into the dark, far out of reach. The only way now is down the last stair, toward the chanting.'] },
        { id: 'seal', name: 'The Warden\'s Door', size: 'large', goal: true,
          event: { scene: 'seal-approach', until: [{ kind: 'flag', flag: 'cult-broken' }] } },
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
        // The drop: no climbing back up the burial shaft.
        { a: 'king', b: 'shaft', door: { oneWay: true } },
        { a: 'shaft', b: 'seal' },
      ],
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
    id: 'hall', kind: 'story', art: { imageId: 'loc-crypt', emoji: '🎨' },
    text: [
      'The stair opens into a painted hall. Artists covered these walls before Thornwick had a name. The pictures tell one story, over and over. A **door** stands under the earth. A **horned warden** waits behind it. Before the door, age after age, a **woman of the reeds** keeps watch.',
      'In one panel, a line of soldiers in green bronze stands before the door. Each one holds a fist pressed flat to his chest. That is the old kings\' salute, and the painter took great care over it.',
      'The last panel is fresh mud smeared over old paint. One angry stroke crosses out the woman of the reeds. Beneath her, many dead hands scrawled the words: **THE VIGIL HAS ENDED. THE DOOR OPENS FROM WITHIN.**',
      'The mud is still wet. Whoever wrote those words is down at the door right now, somewhere deep below you.',
    ],
    next: [{ id: 'on', label: 'Deeper in', to: '@hub',
      effects: [{ kind: 'setFlag', flag: 'hall-seen' },
        { kind: 'journal', entry: { id: 'c-warden', kind: 'clue', title: 'The Door Opens From Within',
          body: 'The painted hall at the top of the Undercrypt shows the Warden\'s door, far below, and the reed-woman who guarded it. Fresh mud over the paint says the vigil has ended and the door opens from within. His servants are at the door now. Get there first and speak Halden\'s rites.' } }] }],
  },
  'crypt-night': {
    id: 'crypt-night', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'specter-haunt', mapId: 'corridor',
    intro: ['You bank a fire in a dry side-vault, and the Undercrypt notices. The cold comes first. Then come the shapes it belongs to. Two specters, the painted dead come loose from the walls, slide toward your fire.'],
    onWin: { to: '@hub', text: ['The specters tear apart into cold and silence. Nobody tries to sleep again. You sit out the rest of the night with your backs to the wall and your weapons across your knees.'] },
  },
  ossuary: {
    id: 'ossuary', kind: 'check', skill: 'investigation', dc: 12, art: { emoji: '💀' },
    intro: ['Grave-goods glint in the niches between the skulls. The barrow-lords took their wealth down with them. A careful eye might take some of it back up.'],
    success: { to: '@hub', text: ['Behind a row of skulls, the builders left a hidden nook. Inside are coins stamped by kings nobody remembers. There is also a flask of drink that has gone strong with age instead of sour.'],
      effects: [{ kind: 'setFlag', flag: 'ossuary-searched' }, { kind: 'gold', amount: 90 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }] },
    failure: { to: '@hub', text: ['You grope through two niches, touch something that crunches, and decide to stop. You leave with a few loose coins off the floor. The dead can keep the rest. They did the work.'],
      effects: [{ kind: 'setFlag', flag: 'ossuary-searched' }, { kind: 'gold', amount: 20 }] },
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
    id: 'diggers', kind: 'challenge', art: { imageId: 'loc-crypt', emoji: '⛏️' },
    intro: [
      'A long cut runs through the rock here, and Thornwick\'s dead fill it. They still wear their burial clothes. They chip at a seam of grey **lead** in the wall with picks, stones and bare fingers. Nobody gives them orders. Nobody needs to.',
      'The cut is just wide enough for them. To get past, you will have to get through them. Near the far end, one digger wears a chain of office over its shroud. Its links match the chain Reeve Aldous wears.',
    ],
    retry: 'perApproach',
    approaches: [
      { id: 'sneak', label: 'Slip past along the wall', hint: 'Keep low, and only move when the picks swing.',
        skill: 'stealth', dc: 12, roller: 'group',
        success: { to: 'diggers-chain', text: ['You edge along the wall between swings. Not one head turns. At the far end, the digger with the chain lowers its pick, and does not lift it again.'] },
        failure: { to: 'diggers', text: ['A loose stone skitters across the floor. Every pick in the cut stops. Then, slowly, they start again. Nobody breathes.'] } },
      { id: 'still', label: 'Say the burial words over them', hint: 'Halden said these over every grave in Thornwick.',
        skill: 'religion', dc: 13,
        success: { to: 'diggers-chain', text: ['You speak the old words, slow and plain. ' + LITURGY, 'One by one, the picks go quiet. The dead lie down in the cut in rows, as if they had only ever been asleep.'] },
        failure: { to: 'diggers', text: ['The words come out in the wrong order. A few of the dead pause. Then the call from below drowns you out, and the picks start again.'] } },
      // The churchyard read (`graves-ranks`): you know the order they keep.
      { id: 'step-ranks', label: 'Fall in at the back of the oldest rank', hint: 'The churchyard showed you their order: oldest first, in ranks. Keep it, and you are one more of them.',
        skill: 'deception', dc: 10, requires: [{ kind: 'flag', flag: 'graves-ranks' }], hideWhenBlocked: true,
        success: { to: 'diggers-chain', text: ['You find the oldest rank by its grave-clothes and fall in at the back of it. Swing, step, swing, in time with the rest. The dead make room for you the way soldiers make room in a line. You walk out the far end, still swinging.'] },
        failure: { to: 'diggers', text: ['You fall in a beat behind the rank, and the rank notices. The nearest digger stops and turns its empty face toward you. Then, slowly, it goes back to work.'] } },
      { id: 'step', label: 'Pick up a tool and fall into step', hint: 'Shuffle, swing, and look as dead as they do.',
        skill: 'deception', dc: 13, requires: [{ kind: 'notFlag', flag: 'graves-ranks' }], hideWhenBlocked: true,
        success: { to: 'diggers-chain', text: ['You take a pick from the pile and shuffle in among them. Swing, step, swing. Nobody looks twice at one more digger. You walk out the far end, still swinging.'] },
        failure: { to: 'diggers', text: ['You swing too fast. The living always do. The nearest digger stops and turns its empty face toward you, then slowly goes back to work.'] } },
      { id: 'cleric', label: '[Cleric] Raise your holy symbol and turn them aside', hint: 'The dead give way to the gods, when the gods are asked properly.',
        skill: 'religion', dc: 10,
        requires: [{ kind: 'classInParty', classId: 'cleric' }], hideWhenBlocked: true,
        success: { to: 'diggers-chain', text: ['You hold up your holy symbol, and a light that is not torch-light fills the cut. The dead shuffle back from it like sheep from a dog. They press to the walls and leave you a road.'] },
        failure: { to: 'diggers', text: ['The light flickers and fails. Something deeper in the barrow is pushing back, and it is stronger down here.'] } },
      { id: 'paladin', label: '[Paladin] Stand in their road and speak your oath', hint: 'An oath is a promise. The dead remember promises.',
        skill: 'religion', dc: 10,
        requires: [{ kind: 'classInParty', classId: 'paladin' }], hideWhenBlocked: true,
        success: { to: 'diggers-chain', text: ['You plant your feet and speak your oath aloud. The nearest dead stop digging. They step aside one by one, the way a crowd makes room for a funeral.'] },
        failure: { to: 'diggers', text: ['Your oath rings off the stone, and the dead do not hear it. The call from below is louder.'] } },
    ],
    success: { to: 'diggers-chain' },
    // Every try spent: the whole cut turns on the party.
    failure: { to: 'diggers-fight', text: ['Every pick in the cut stops at once. Then the dead turn, all together, and come for you.'],
      effects: [{ kind: 'setFlag', flag: 'diggers-roused' }] },
  },
  'diggers-fight': {
    id: 'diggers-fight', kind: 'battle', encounterId: 'undead', mapId: 'corridor',
    intro: ['The dead come down the cut with their picks raised. Two are bare bones in grave-rags. Three are fresh, and still wear the faces Thornwick buried. Hit hard, and try not to look.'],
    onWin: { to: 'diggers-chain', text: ['The last digger falls across its pick. The cut goes quiet, apart from your breathing.'] },
  },
  'diggers-chain': {
    id: 'diggers-chain', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛓️' },
    text: [
      'At the end of the cut, one of the dead has stopped moving. It is an old man in a good burial coat. A reeve\'s chain of office hangs round his neck, with the same crest Aldous wears.',
      'This is the reeve\'s **grandfather**. Whatever called him down here has let him go. He is light now, just bones in a coat.',
      'The diggers stacked their grave-goods against the wall as they worked. There are rings, buckles and a scatter of old coin. The way ahead is narrow and dark. You can carry the old man, or the heap, but not both.',
    ],
    // A real trade: the old reeve home (a war asset in Part 3) or the gold.
    next: [
      { id: 'carry', label: 'Wrap him in a cloak and carry him home (leave the grave-goods)', to: '@hub',
        effects: [{ kind: 'setFlag', flag: 'diggers-passed' }, { kind: 'setFlag', flag: 'grandfather-home' },
          { kind: 'journal', entry: { id: 'c-grandfather', kind: 'clue', title: 'The Old Reeve',
            body: 'Reeve Aldous\'s grandfather was digging with the dead in the Undercrypt. You knew him by his chain of office. You are carrying him home to Thornwick.' } }] },
      { id: 'leave', label: 'Lay him down here, chain and all, and take the grave-goods (40 gold)', to: '@hub',
        effects: [{ kind: 'setFlag', flag: 'diggers-passed' }, { kind: 'gold', amount: 40 }] },
    ],
    noBack: true,
  },
  // The Worm's own sentry, waiting in the passage past the diggers.
  'crypt-ambush': {
    id: 'crypt-ambush', kind: 'battle', encounterId: 'crypt', mapId: '@room',
    intro: [
      'A black candle burns on the floor of the passage. A man in robes the colour of grave-worms kneels beside it. He hears you, and smiles.',
      '"The Worm goes before the Warden," he says. Two ghouls and two old skeletons climb to their feet around him and come at you.',
    ],
    onWin: { to: '@hub', text: ['The man in the robe dies still holding his candle. It smells of the fen. Whoever he served, there are more of them further down.'] },
  },
  // An old soldier at his post: he can be fought, or relieved of it.
  wights: {
    id: 'wights', kind: 'battle', encounterId: 'wight-tomb', mapId: 'corridor',
    intro: [
      'This is the hall of the kings\' guard. Three slabs of black stone stand in the dark. On the middle one, an old guardsman in barrow-armour sits *up*. Cold light burns in its eye sockets. It draws a sword older than the road outside. It does not shuffle like the other dead. It takes a **stance**.',
      'From the slabs on either side, two skeletons rise to guard it. They snap to their feet like soldiers called to order, and they come for you.',
    ],
    onWin: { to: '@hub', text: ['The wight comes apart at the joints, like a puppet whose strings were cut centuries too late. The cold light in its eyes gutters out, and its skeletons clatter down after it. Whatever the Warden raises next will have nobody to lead it.'],
      effects: [{ kind: 'setFlag', flag: 'wights-down' }, { kind: 'gold', amount: 40 }] },
    parley: {
      skill: 'history', dc: 15, label: 'Relieve him of his post, the old way',
      success: { to: '@hub', text: [
        'The painted hall showed how the old kings\' soldiers saluted. You give that salute now, fist to chest, and tell him his watch is over.',
        'The wight stands still for a long moment. Then it lowers its sword and lies back down on its slab. Its skeletons lie down with it. A soldier can rest, once someone tells him he may.',
      ], effects: [{ kind: 'setFlag', flag: 'wights-down' }] },
    },
  },
  king: {
    id: 'king', kind: 'battle', encounterId: 'mummy-crypt', mapId: '@room',
    intro: [
      'Old masons sealed the king\'s chamber in lead. Something has peeled the lead back like fruit-rind, from the *inside*. Within, a figure in grave-wrappings the colour of old honey stands before a wall carved with names.',
      'They are the names of villages, hundreds of them, and a line runs through every one. You know a few from old songs. None of them stand anymore. These are the places the Warden swallowed the last time he woke.',
      'The embalmed king turns. He served the Warden once, and the Warden has woken him first, as a reward. The eyes behind the wrappings burn with a slow, pleased light. Two of his household dead lurch from the corners, still in their funeral best.',
    ],
    onWin: { to: '@hub', text: ['The king crumbles. His grave-cloths sag around nothing but dust and old spice. His servants drop mid-lurch. Behind him, at the bottom of the wall, one name sits freshly carved, with no line through it yet. **THORNWICK**. The Warden has already chosen his next village.', 'Behind the king\'s throne, a burial shaft drops into the dark. The chanting comes up out of it.'],
      effects: [{ kind: 'setFlag', flag: 'king-down' }, { kind: 'gold', amount: 60 }] },
  },
  'seal-approach': {
    id: 'seal-approach', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '🚪' },
    text: [
      'The lowest stair ends at the door the paintings promised. It is a slab of stone the size of a barn wall. Old words are cut across it, and lead fills every letter. The stone bows *outward*, straining, as something on the far side leans against it.',
      'The chanting you\'ve heard for an hour comes from the **living**. They kneel at the door in robes the colour of grave-worms, holding candles of black tallow. This is the **Cult of the Worm**. Their leader is a thin grey man in a gravedigger\'s apron. He pries the lead out of the door one letter at a time with a chisel of bone. An acolyte kneels at his side with a candle. A walking suit of ancient armour guards the stair, and two ghouls crouch among the candles like pets.',
      '"Faster," he tells his chisel, sweetly reasonable. He sees you, and he does not stop working. "**Marrow**," he says, by way of greeting. "I brought your priest his candles."',
      '"I dug graves at Saltmere for thirty years. Then the fever came. I buried the whole village, my wife and my two boys last. Forty graves, and then I walked away and left them all in the cold. The Warden leaves nobody in the cold. Under him the dead stand together, and they have work to do. Is that so wicked?" He sets the chisel to the next letter. "The rites are in your pack, I expect. Say them over my body, if you must."',
    ],
    next: [
      // Marrow's own reasons, turned on him: the king's wall shows what the
      // Warden does with a village. Talked round, he fights half-hearted and
      // lives; what to do with him is the company's next choice.
      { id: 'wall', label: '[Persuasion DC 14] Tell Marrow what the king\'s wall says', to: 'seal-doubt', once: true,
        check: { skill: 'persuasion', dc: 14, failTo: 'seal-scorned', failEffects: [{ kind: 'setFlag', flag: 'kneelers-scorned' }] } },
      { id: 'fight', label: 'Interrupt the service', to: 'seal-battle' },
    ],
  },
  // Marrow not swayed, in front of his whole congregation: they saw the
  // company fail, and they will not chant for it at the door later.
  'seal-scorned': {
    id: 'seal-scorned', kind: 'story', noBack: true, art: { imageId: 'loc-dungeon', emoji: '🕯️' },
    text: [
      'You tell him about the wall in the king\'s chamber, and the villages with a line through every name. Marrow hears you out without stopping his chisel. "Then the Warden chose Thornwick," he says. "He chose well."',
      'Behind him the kneelers laugh, all together, and lift their black candles higher. They watched you try to turn their gravedigger, and they watched you fail. Whatever you say at this door now, they will not listen.',
    ],
    next: [{ id: 'on', label: 'Interrupt the service', to: 'seal-battle' }],
  },
  'seal-doubt': {
    id: 'seal-doubt', kind: 'battle', encounterId: 'cult-wavering', mapId: 'firepit',
    // No falling back: the stair behind you leads to the Marrow who still believed.
    noFlee: true,
    surprise: 'enemies',
    onLoss: { to: 'seal-doubt-lost' },
    loot: { bonusTier: 'rare' },
    intro: [
      'You tell him about the wall in the king\'s chamber. Hundreds of villages are cut there, with a line through every one. None of them stand together. None of them stand at all. "Thornwick is the next name," you say. "Saltmere\'s graves will be on the wall after that."',
      'Marrow\'s chisel stops. His acolyte sees it stop, and screams that he has lost his faith. The armour and the ghouls come for you anyway. Marrow does not. He sets his back against the door and watches, like a man walking in his sleep.',
    ],
    onWin: { to: 'marrow-spared', text: ['The last ghoul falls among the candles. Marrow never moved from the door. When it is over, he is sitting on the bottom stair with the chisel in his lap.'],
      effects: [{ kind: 'xpToLevel', level: 4 }, { kind: 'setFlag', flag: 'cult-broken' }, { kind: 'gold', amount: 120 }] },
  },
  // Marrow lived: lend his voice to the rites, or bind him for Thornwick.
  'marrow-spared': {
    id: 'marrow-spared', kind: 'dialogue', noBack: true, art: { imageId: 'loc-dungeon', emoji: '⛏️' },
    npc: { id: 'npc-marrow', name: 'Marrow, the Gravedigger', portraitId: 'npc-priest', emoji: '⛏️' },
    lines: [
      'Marrow looks up at the door, and at the letters he pried loose. "Forty graves," he says. "I thought he would give them back to me." Behind him, the kneelers who never fought still hold their black candles. They are watching him to see what he does.',
      '"They will sing whatever I sing," he says. "Or you can take me up to your reeve. I would understand that."',
    ],
    next: [
      { id: 'sing', label: 'Make him lead his faithful in the rites (an easier way to seal the door)', to: 'resealing',
        effects: [{ kind: 'setFlag', flag: 'marrow-sings' }] },
      { id: 'bind', label: 'Bind him for the reeve, and take the cult\'s offering-purse (50 gold)', to: 'resealing',
        effects: [{ kind: 'setFlag', flag: 'marrow-bound' }, { kind: 'gold', amount: 50 }] },
    ],
  },
  'seal-battle': {
    id: 'seal-battle', kind: 'battle', encounterId: 'cult', mapId: 'firepit',
    onLoss: { to: 'seal-battle-lost' },
    loot: { bonusTier: 'rare' },
    intro: ['Marrow turns with the chisel still in his hand, and rage floods the sweet reason off his face. "The door opens for the *faithful*!" His acolyte drops the candle and pulls a knife. The armour grinds down the stair. The ghouls come low and fast between the candles.'],
    onWin: { to: 'resealing', text: ['Marrow dies reaching for the door. Nobody stands to fight for the Warden now. Only his kneeling faithful remain, staring at the body, and you stand at the door with the book.'],
      effects: [{ kind: 'xpToLevel', level: 4 }, { kind: 'setFlag', flag: 'cult-broken' }, { kind: 'gold', amount: 120 }] },
  },
  // The climax is a choice of how, and a roll: each way of saying the rites may
  // be tried once. Halden, if he lived, can say his own. If every voice fails,
  // the door cracks and the Warden's dead come through it.
  resealing: {
    id: 'resealing', kind: 'challenge', art: { imageId: 'loc-dungeon', emoji: '📖' },
    intro: [
      'The great door still bulges outward. Half the lead is gone from its letters, and the Warden leans on what is left. Against the far wall, the cultists who never fought are still on their knees. They watch you with their black candles guttering.',
      'Halden\'s book lies open in your hands. The rites fill three pages, and the oldest words look too old for a living mouth. Someone has to say them, now, at this door. Halden wrote that it would take nerve.',
    ],
    retry: 'perApproach',
    noBack: true,
    approaches: [
      { id: 'rites', label: 'Speak the rites aloud', hint: 'Read the old prayers straight from the book, and mean every word.',
        skill: 'religion', dc: 13,
        success: { to: 'seal-clean', text: ['You read the old rites by black candle-light. You stumble over the oldest words, and say them again until they come out right. The lead letters drink the words the way dry ground drinks rain.'] },
        failure: { to: 'resealing', text: ['Your voice cracks on the oldest word, and the rest come out wrong. The letters stay dark. The door groans, and leans a little harder.'] } },
      { id: 'letters', label: 'Read the lead letters as a spell', hint: 'The words cut in the door are a lock. Use the rites as its key.',
        skill: 'arcana', dc: 14,
        success: { to: 'seal-clean', text: ['The letters are not a prayer at all. They are a lock, and the rites are its key. You trace each letter with a finger and speak its line from the book. One by one, the lead letters glow and set hard.'] },
        failure: { to: 'resealing', text: ['You trace the wrong line first. A letter spits its lead at your hand and goes dark. Whatever the old masons built, it will not take orders from you.'] } },
      // Closed for good if Marrow already laughed off the company in front of them.
      { id: 'kneelers', label: 'Turn the kneeling cultists to the words', hint: 'They came here to chant at this door. Make them chant the right thing.',
        skill: 'persuasion', dc: 14, requires: [{ kind: 'notFlag', flag: 'kneelers-scorned' }],
        success: { to: 'seal-clean', text: ['You hold the book up where the kneelers can see it. "You came to sing to the Warden," you tell them. "Then sing this." One voice joins yours, then five, then all of them. The Warden\'s own faithful sing him back to sleep.'] },
        failure: { to: 'resealing', text: ['The kneelers look at the book, then at the door. They bow their heads and go back to their own chant, louder than before.'] } },
      { id: 'wizard', label: '[Wizard] Pick the lock the old masons cut', hint: 'You know a ward when you see one. This one is only half-broken.',
        skill: 'arcana', dc: 11,
        requires: [{ kind: 'classInParty', classId: 'wizard' }], hideWhenBlocked: true,
        success: { to: 'seal-clean', text: ['You have read wards like this in dusty books. This one is a lock, and the rites are its key. You find where the fanatic broke it, and mend each letter with the line that belongs to it. The lead glows, and sets hard.'] },
        failure: { to: 'resealing', text: ['The ward is older than any book you have read. You lose your place in it, and a letter spits hot lead at your hand.'] } },
      { id: 'marrow', label: 'Let Marrow lead his faithful in the rites', hint: 'They came to sing at this door. They will sing what he sings.',
        skill: 'persuasion', dc: 9,
        requires: [{ kind: 'flag', flag: 'marrow-sings' }], hideWhenBlocked: true,
        success: { to: 'seal-clean', text: ['Marrow takes the book in both hands and turns to his kneelers. "We had the words wrong," he tells them. Then he reads, and forty living voices follow him. The lead letters drink every word.'] },
        failure: { to: 'resealing', text: ['Marrow\'s voice breaks on the first line. He was never a priest. The kneelers wait for him, and the door groans.'] } },
      { id: 'halden', label: 'Give Halden the book', hint: 'He followed you all the way down. Let him say his own rites.',
        skill: 'religion', dc: 8,
        requires: [{ kind: 'flag', flag: 'halden-saved' }], hideWhenBlocked: true,
        success: { to: 'seal-clean', text: ['Brother Halden comes down the last stair, still shaking. He takes the book and finds his place without looking. He reads in the same calm voice that led the drowned congregation. This time the voice is his own. The lead letters drink every word.'] },
        failure: { to: 'resealing', text: ['Halden opens his mouth, and the voice that comes out is not quite his. He shuts the book fast and hands it back, white to the lips. "Not me," he whispers. "It still knows me."'] } },
    ],
    success: { to: 'seal-clean' },
    // Every voice failed: the door cracks before it seals.
    failure: { to: 'seal-breach', text: ['The last word dies in the dark. For a moment nothing happens. Then the great door splits from top to bottom, with a crack like river ice. Grey hands push out through the gap. The Warden has stopped waiting for his servants.'],
      effects: [{ kind: 'setFlag', flag: 'seal-breach' }] },
  },
  'seal-clean': {
    id: 'seal-clean', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '📖' },
    text: [
      'Line by line, the great door stops *straining*. Last of all goes the pressure behind it. Something enormous on the far side turns its attention away, unhurried and unimpressed. It is not beaten. It has simply gone back to sleep. Up above, across the barrow-field, every walking corpse lies down where it stands.',
      'It is done. The door stands sealed, and the **Warden** sleeps again.',
      'The vigil holds. It has a new keeper now — a book, a door, and a town that knows to watch it. It will have to do.',
    ],
    next: [{ id: 'home', label: 'Climb back to the light', to: 'sb-aftermath' }], noBack: true,
  },
  // The rites failed, and the Warden pushed back. Win, and the door shuts
  // over the bodies, but not cleanly: the crack carries into Part 3.
  'seal-breach': {
    id: 'seal-breach', kind: 'battle', encounterId: 'undead', mapId: 'firepit',
    noFlee: true,
    // Beaten back from a cracked door: the dead are still coming through it,
    // so the party gets up and holds it again.
    onLoss: { to: 'seal-breach-lost' },
    intro: ['The Warden\'s own dead squeeze out through the crack in his door. Skeletons in green barrow-bronze come first, then three swollen fen-dead, and more grey fingers wait behind them. If they get past you, Thornwick is next.'],
    onWin: { to: 'seal-shut', text: ['The last of them falls across the doorstep. All of you put your shoulders to the door and shove it home over the bodies. You shout the rites into the crack, badly and all at once. It is enough, barely.'],
      effects: [{ kind: 'setFlag', flag: 'seal-cracked' }] },
  },
  // Lost to the cult below the one-way drop: they leave the party for dead
  // and go back to their door, and the party comes to where it fell.
  // Losing after Marrow has stopped believing does not make him believe again.
  'seal-doubt-lost': {
    id: 'seal-doubt-lost', kind: 'rest', variant: 'long', next: 'seal-doubt',
    intro: ['You go down under the ghouls. You wake on the cold floor by the shaft, with a gravedigger\'s coat folded under your head. Below, the acolyte is still chanting, and Marrow still has not lifted his chisel.'],
  },
  'seal-battle-lost': {
    id: 'seal-battle-lost', kind: 'rest', variant: 'long', next: 'seal-battle',
    intro: ['You go down under the cultists\' knives. You wake on the cold floor by the shaft, tied and forgotten. They were too busy with the door to finish you. You work the ropes loose, and the chanting is still going.'],
  },
  'seal-breach-lost': {
    id: 'seal-breach-lost', kind: 'rest', variant: 'long', next: 'seal-breach',
    intro: ['You go down under grey hands, and the dark closes over you. When you wake, you are lying on the stair, far above the door. The dead have not climbed past you. They are still pushing out through the crack, slowly, one at a time.', 'You get up. Someone has to hold that door, and it is still you.'],
  },
  'seal-shut': {
    id: 'seal-shut', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '🚪' },
    text: [
      'The door holds. The crack in it does not close. Lead creeps into it from the letters on either side, and stops a finger short. Behind the stone, the Warden settles. He is not asleep. Now and then the door ticks under your hand, like a knuckle tapping.',
      'Up above, across the barrow-field, every walking corpse lies down where it stands. It is done, more or less. The vigil holds, with a new keeper — a book, a cracked door, and a town that will have to watch it closely.',
    ],
    next: [{ id: 'home', label: 'Climb back to the light', to: 'sb-aftermath' }], noBack: true,
  },
  // Each claim gets one line, then a short hub: the homecoming doesn't replay.
  'sb-claim-paid': {
    id: 'sb-claim-paid', kind: 'story', art: { imageId: 'loc-town', emoji: '💰' },
    text: ['The reeve counts the purse into your hands himself, coin by coin. He loses count twice, and does not seem to mind.'],
    next: [{ id: 'ok', label: 'Back to the square', to: 'sb-aftermath-hub' }], noBack: true,
  },
  'sb-claim-round': {
    id: 'sb-claim-round', kind: 'story', art: { imageId: 'loc-tavern', emoji: '🍺' },
    text: ['The taproom drinks to the company, then to the dead, then to Mira, who pretends not to hear it.'],
    next: [{ id: 'ok', label: 'Back to the square', to: 'sb-aftermath-hub' }], noBack: true,
  },
  'sb-claim-grandfather': {
    id: 'sb-claim-grandfather', kind: 'story', art: { imageId: 'loc-town', emoji: '⛓️' },
    text: [
      'You carry the old man into the reeve\'s hall, still wrapped in your cloak, and lay him on the long table among the ledgers. Aldous lifts the edge of the cloak and looks for a long time.',
      'Then he takes off his own chain of office and lays it beside his grandfather\'s. The links match. "He taught me to wear this straight," he says, and his voice gives out on the last word. He turns to the window. He does not turn back while you are in the room.',
    ],
    next: [{ id: 'ok', label: 'Leave him with his grandfather', to: 'sb-aftermath-hub' }], noBack: true,
  },
  'sb-claim-purses': {
    id: 'sb-claim-purses', kind: 'story', art: { imageId: 'loc-town', emoji: '💰' },
    text: [
      'The fen-folk have come in from the far pools for the reburials. You hand over the purses one by one, and they pass them along, name by name. Nobody counts the coins.',
      'One widow opens hers and finds a carved bone button among the coins. She closes it again. "He always kept that," she says, and holds the purse against her chest. Wren tucks the last purse into her coat. It belongs to a widow at the far edge of the fen, and Wren says she will walk it out there herself.',
    ],
    next: [{ id: 'ok', label: 'Back to the square', to: 'sb-aftermath-hub' }], noBack: true,
  },
  'sb-aftermath-hub': {
    id: 'sb-aftermath-hub', kind: 'story', art: { imageId: 'loc-town', emoji: '🏘️' },
    text: ['Thornwick goes about its burying, and its living.'],
    next: SB_CLAIMS, noBack: true,
  },
  'sb-aftermath': {
    id: 'sb-aftermath', kind: 'story', art: { imageId: 'loc-town', emoji: '🏘️' },
    text: [
      'Wren is still holding the Barrow Gate when you come up. She is upright, knife out, in a great field of dead who have finally stopped moving. She wears the look of someone determined to have been calm the whole time. The walk home is long and wet, and the best walk any of you can remember.',
      'Thornwick reburies its dead in the following days, oldest graves first. The reeve stands bareheaded at every single service. He has a purse set aside for you, and does not make you ask twice. He shakes each of your hands one entire second longer than protocol requires. For Aldous, this is close to weeping.',
    ],
    next: SB_CLAIMS,
    // Home, with the door sealed: nothing below is left to walk back into.
    noBack: true,
  },
  'sb-defeat': {
    id: 'sb-defeat', kind: 'story', art: { imageId: 'loc-tavern', emoji: '🍺' },
    text: [
      'You wake in the Wander-Inn\'s back room with fen-mud in your ears. Mira\'s bone-broth steams on the sill. Someone hauled you all back to Thornwick in the dark. Mira will not say who, and you do not ask.',
      '"The fen\'s still there," Mira says, which is her way of asking if you\'re going back. You are. She puts the bread where you can reach it.',
    ],
    next: [{ id: 'up', label: 'Back on your feet', to: 'town' }], noBack: true,
  },
  'sb-epilogue': {
    id: 'sb-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'The barrows sleep, and Thornwick\'s churchyard is quiet again.',
    ],
    // One line per thread the run touched, then the hook for Part 3 (always).
    slides: [
      { if: [{ kind: 'flag', flag: 'halden-saved' }],
        text: 'Brother Halden keeps the vigil now, and he reads the rites a little louder than he needs to.' },
      { if: [{ kind: 'notFlag', flag: 'halden-saved' }],
        text: 'Halden and his acolytes share a new grave by the chapel. Mira paid for the white headstone, and had his own burial words cut into it.' },
      { if: [{ kind: 'notFlag', flag: 'seal-cracked' }],
        text: 'Far below the barrow-field, the Warden\'s door stays shut and silent, the way a good door should.' },
      { if: [{ kind: 'flag', flag: 'seal-cracked' }],
        text: 'The door holds, but on still nights the fen-folk swear that something under the barrows still knocks, faintly.' },
      { if: [{ kind: 'flag', flag: 'grandfather-home' }],
        text: 'Aldous buries his grandfather a second time, chain and all. He digs the grave himself. Nobody offers to help, because everyone can see he needs to.' },
      { if: [{ kind: 'visited', scene: 'diggers-chain' }, { kind: 'notFlag', flag: 'grandfather-home' }],
        text: 'The old reeve\'s grave in the churchyard stays empty. Aldous fills it in anyway, and visits it every week.' },
      { if: [{ kind: 'flag', flag: 'drowned-gold-home' }],
        text: 'The drowned folk\'s purses go home to their families. Wren carries the last one herself, to a widow at the far edge of the fen.' },
      { if: [{ kind: 'flag', flag: 'met-wren' }],
        text: 'The reeve has promoted Wren, to her visible horror, and she leads the watch that walks the old road once a season.' },
      { if: [{ kind: 'flag', flag: 'hollow-road:vex-turned' }],
        text: 'Vex, who turned on the Ashfang chief for you, hears the news in a hill inn and buys the whole room a round.' },
      { if: [{ kind: 'flag', flag: 'marrow-sings' }],
        text: 'Marrow walks home to Saltmere alone, to keep forty graves he once left in the cold. He says the rites over them every evening.' },
      { if: [{ kind: 'flag', flag: 'marrow-bound' }],
        text: 'Marrow waits in the reeve\'s cells. He asks for a shovel. After some thought, Aldous gives him the churchyard to mend.' },
      { if: [{ kind: 'flag', flag: 'hollow-road:vargan-jailed' }],
        text: 'Out on the common land, Vargan stops cutting reeds when the bells ring, and does not start again until they stop.' },
      { if: [],
        text: 'On the last night, at the fen\'s edge, the reeds parted around two figures. They did not walk so much as *arrive* — tall, green-fingered, river-weed in their hair. They were sisters, unmistakably, of a certain late Reedwife. They looked at the sealed barrow-field for a long moment. Then they looked at the town, the way you look at a house you mean to come back to. Then the reeds closed over them. Whatever the sisters came to look at, they meant to come back for it.' },
    ],
  },
};

export const SUNKEN_BARROWS_MODULE: Module = {
  id: 'sunken-barrows', title: 'The Sunken Barrows',
  blurb: 'The Reedwife\'s death broke an old vigil. Follow Thornwick\'s walking dead into the fen — and close what your victory opened.',
  cover: 'loc-crypt',
  levelBand: { from: 3, to: 4 },
  // Part 2 of the trilogy: a victory carries the company into The Wyrmcalling.
  sequel: 'wyrmcalling',
  start: 'return', scenes, defeatScene: 'sb-defeat', town: 'town',
  // What the last chapter remembers (read there as 'sunken-barrows:<flag>'):
  // that the company won this chapter (`won`),
  // whether the company knows Wren (set on every route to the fen), whether
  // Brother Halden lived, whether the Warden's door shut cracked, and whether
  // the company carried the old reeve home and the drowned folk's purses back
  // to their families. Those last two are owed back at the Wyrmcalling.
  carries: ['won', 'met-wren', 'halden-saved', 'seal-cracked', 'grandfather-home', 'drowned-gold-home'],
  companions: {
    wren: {
      id: 'wren', name: 'Wren', monsterId: 'scout', portraitId: 'npc-scout', emoji: '🏹',
      blurb: 'The reeve\'s scout. Guiding you through the deep fen as far as the Barrow Gate, where she holds the way out.',
    },
  },
};
