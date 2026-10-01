/**
 * "The Sunken Barrows" — Part 2 of the trilogy (docs/trilogy-plan.md): a
 * L3→4 adventure in three acts (Thornwick's wrong graves → the deep fen →
 * the Undercrypt), continuing The Hollow Road's company or standing alone.
 *
 * The premise pays off Part 1's victory with its cost: the Reedwife was not
 * merely squatting in the marsh — she was the Undercrypt's jailer gone to
 * rot, feeding on the sleep of the dead to keep something older under. The
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
    body: 'Brother Halden\'s prayer book holds the old rites of sealing. The Reedwife was the jailer of the Warden of the Barrows. Her feeding kept him asleep, and her death broke his seal. Speak the rites at the Warden\'s door, deep in the great barrow, to shut him in again.' } },
];

/** The words Halden said over Thornwick's dead, said back to him. */
const LITURGY = '*Lie down and be at peace. Your work is done. The bell will wake you.*';

/** The cult, glimpsed in the fen before it shows itself at the Warden's door. */
const WORM_CLUE: Effect = { kind: 'journal', entry: { id: 'c-worm', kind: 'clue', title: 'Robes the Colour of Worms',
  body: 'A stranger lay drowned among the corpse-lights, in long robes the colour of grave-worms. Nailed boots on the old road, black candles in the chapel, and now this. Someone living is helping the dead along.' } };

const INN_CHOICES = [
  { id: 'room', label: 'Take a room for the night — 1 gold (long rest)', to: 'inn-rest',
    requires: [{ kind: 'gold' as const, atLeast: 1 }], effects: [{ kind: 'gold' as const, amount: -1 }] },
  { id: 'leave', label: 'Back to the street', to: 'town' },
];

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
  { id: 'done', label: 'Let the town sleep', to: 'sb-epilogue' },
];

const scenes: Record<string, Scene> = {
  // === ACT 1 — THORNWICK, THE WRONG BELLS ================================
  return: {
    id: 'return', kind: 'story', art: { imageId: 'loc-town', emoji: '🔔' },
    text: [
      'Thornwick by night, and the bells are ringing. Not the steady count of the hour. This is the panicked clatter of a rope hauled by somebody who has forgotten how bells work.',
      'Last season the Ashfang raiders fell, and the **Reedwife**, the green hag of the fen, died in the Ashfang chief\'s hall. Thornwick still toasts the company that did it. Since then, the valley has slept easy. The gate-warden\'s face says the sleeping is over. "It\'s the **churchyard**," he manages. "The graves are *open*, and it wasn\'t shovels did it."',
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
  inn: {
    id: 'inn', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'The Wander-Inn is full, and nobody is in a hurry to leave. Nobody in Thornwick wants to be alone today, not with the churchyard standing open. **Mira** sets down a bowl in front of you unasked.',
      '"So. The marsh sends us another bill." She says it flat, wiping the bar the way other people sharpen knives. "First raiders, now the departed. I\'d ask what\'s next, but I\'ve found the marsh treats that as a challenge."',
      '"Eat. Then go see the reeve — he\'s been pacing his hall since the bells. And whatever\'s pulling the dead out there — charge it double."',
    ],
    next: INN_CHOICES,
  },
  'inn-later': {
    id: 'inn-later', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'The Wander-Inn is as full as ever. Nobody in Thornwick wants to sleep alone while the dead are walking. **Mira** slides a bowl your way without asking.',
      '"So Aldous hired you. Good. He pays slow, but he pays." She tops up your cup. "Eat while it\'s hot. The fen will still be out there in the morning. That\'s the trouble with it."',
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
  'reeve-hall': {
    id: 'reeve-hall', kind: 'dialogue', npc: REEVE, art: { emoji: '⚖️' },
    lines: [
      'The reeve\'s hall smells of candle-wax and ledgers. **Reeve Aldous** stands at the window with his back to you. He watches the fen fog eat his water-meadows. He grips his chain of office in one fist, like a weapon he doesn\'t know how to use.',
      '"Thornwick settles its debts," he says, without turning. "It appears the marsh does likewise. My grandfather\'s grave is open, and my grandfather has *gone somewhere*. We buried him in his chain of office. The twin of this one." He turns. He looks older than the ledgers. "You stood against the things in my churchyard last night. My watch did not. So I am paying you. Follow my dead into the fen, find what calls them, and put it down."',
      '"My scout, Wren, will meet you at the fen road. She asked for the job. Rather forcefully, for someone I employ."',
    ],
    next: [{ id: 'take', label: 'Take the reeve\'s commission', to: 'town', once: true,
      effects: [{ kind: 'setFlag', flag: 'reeve-task' }, { kind: 'gold', amount: 60 },
        { kind: 'journal', entry: { id: 'n-aldous', kind: 'npc', title: 'Reeve Aldous',
          body: 'Thornwick\'s reeve is proud and paying, and he takes this one personally. His grandfather\'s grave is among the opened. His orders are simple. Follow the dead into the fen and end what calls them.' } },
        { kind: 'journal', entry: { id: 'lead-fen', kind: 'lead', resolvedBy: 'undercrypt-found',
          title: 'Into the Deep Fen', body: 'The dead walk one way, into the barrow-country of the deep fen. The reeve\'s scout, Wren, waits at the fen road to guide you in. Find where the trails meet.' } }] }],
  },
  'reeve-done': {
    id: 'reeve-done', kind: 'story', art: { emoji: '⚖️' },
    text: ['The reeve\'s clerk intercepts you at the door with the particular firmness of a man defending his employer\'s composure. "The commission stands. The reeve counts on you. The reeve is *busy*." Through the doorway, the reeve is visibly not busy. He is watching the fen.'],
    next: [{ id: 'ok', label: 'Leave him to it', to: 'town' }], noBack: true,
  },
  'grave-study': {
    id: 'grave-study', kind: 'check', skill: 'medicine', dc: 12, art: { emoji: '🪦' },
    intro: ['The open graves wait for a steadier eye. The dead left in company — but bodies, even walking ones, tell their stories to anyone trained to listen.'],
    success: { to: 'town', text: ['The story is in the turf. They didn\'t claw out in hunger. They *stepped* out in order, oldest graves first, called up in ranks. Whatever summons them has real authority. It is old enough to call the oldest first.'],
      effects: [{ kind: 'setFlag', flag: 'graves-read' }, { kind: 'xp', amount: 30 },
        { kind: 'journal', entry: { id: 'c-muster', kind: 'clue', title: 'The Dead Marched in Ranks',
          body: 'The dead left in neat rows, oldest graves first. They were not hungry. They were obeying orders. Something down there has the right to command graves, and it is using it.' } }] },
    failure: { to: 'town', text: ['Mud, turf, and the underside of a churchyard: whatever the graves have to say, they aren\'t saying it to you. The trails still point one way. Sometimes the obvious clue is the whole clue.'],
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
    onWin: { to: '@hub', text: ['The ghouls lie still, properly still this time. The night is ruined and the fire is out. Nobody says what you are all thinking. They came out of the deep fen, the *very place you plan to go*.'] },
  },
  chapel: {
    id: 'chapel', kind: 'dialogue', npc: HALDEN, art: { imageId: 'loc-temple', emoji: '🕯️' },
    lines: [
      'The chapel kneels in the water, drowned to its windows, its bell-tower leaning like a man listening. Candles burn on every ledge. Most are plain white wax, the kind Halden buys in Thornwick. A few are **black tallow**, and they smoke like wet wood. On the dry island of the altar steps stands a priest. His robes are fen-stained, his face serene. He is leading a congregation.',
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
    onWin: { to: 'chapel-won', text: ['Halden sinks down on the altar steps. At the end, he mostly looks relieved.'] },
    // Saving Halden: the thing wearing him borrowed his prayers, so his own
    // words for the dead can turn it out. One try, before the first blow.
    parley: {
      skill: 'religion', dc: 14, label: 'Speak his own liturgy back to him',
      success: { to: 'chapel-saved', text: [
        'You know the words Halden said over Thornwick\'s dead. Every priest in the valley says them. You say them back to him, slow and plain. ' + LITURGY,
        'His smile twitches. The acolytes stop in mid-step. Then the thing inside Halden lets go of him all at once, like a hand opening. His acolytes drop where they stand, and the skeletons fold into the water.',
      ] },
    },
  },
  'chapel-caught': {
    id: 'chapel-caught', kind: 'battle', encounterId: 'temple', mapId: 'ruins',
    surprise: 'enemies',
    intro: ['You see it a breath before it moves. The thing behind Halden\'s serenity winds up through him like rot up a post. You\'re already moving when his two acolytes step forward and two skeletons wade out of the rows. For once the dead are the ones caught flat-footed.'],
    onWin: { to: 'chapel-won', text: ['Caught off balance from the first blow, the dead never find their rows again. Halden slumps against the altar rail. Whatever was wearing him lets go, and leaves him looking almost grateful.'] },
    parley: {
      skill: 'religion', dc: 14, label: 'Speak his own liturgy back to him',
      success: { to: 'chapel-saved', text: [
        'You saw the thing behind his face. So you aim your words at the man under it. You speak the prayer Halden said over Thornwick\'s dead, slow and plain. ' + LITURGY,
        'Halden\'s calm face cracks like ice on a pond. Then the thing inside him lets go all at once. His acolytes drop where they stand, and the skeletons fold into the water.',
      ] },
    },
  },
  // Halden lives: he tells the party himself what the dead man's book says.
  'chapel-saved': {
    id: 'chapel-saved', kind: 'dialogue', noBack: true, npc: HALDEN, art: { imageId: 'loc-temple', emoji: '📖' },
    lines: [
      'Halden sits down hard on the altar steps. He is shaking, and he is himself again. He stares at his hands as if someone just gave them back. Behind him, his two acolytes sit up in the shallows, coughing up fen-water.',
      '"It came up through the floor," he says. "Through the *prayers*. I heard myself preaching, and I couldn\'t stop. The black candles aren\'t mine. A man in robes the colour of grave-worms brought them, and I *thanked* him." He pushes his prayer book into your hands. His tidy notes crowd the margins. Further down the page, the writing starts to shake.',
      '"The **Reedwife** was never just a hag. She was a jailer. Her feeding kept the **Warden of the Barrows** asleep under the fen. When she died, his seal broke with her. Now he calls the dead to open his door from the inside."',
      '"The rites of sealing are in that book. Someone must say them at his door, in the great barrow past the Barrow Gate." He swallows. "It wouldn\'t let me say them while it had me. I don\'t know if I can now. But I\'ll follow you down, well behind. I\'ll be on the stair when you need me."',
      'He finds a healing potion under the altar cloth and gives you that too. "Nerve we\'ve got," Wren says, and she sounds almost sure of it. She puts her own cloak round Halden\'s shoulders without looking at him.',
    ],
    next: [{ id: 'on', label: 'Take the prayer book', to: 'fen',
      effects: [...CHAPEL_CLEARED, { kind: 'setFlag', flag: 'halden-saved' },
        { kind: 'journal', entry: { id: 'n-halden', kind: 'npc', title: 'Brother Halden',
          body: 'Halden keeps Thornwick\'s little chapel. Something under the fen took hold of him through his own prayers, and you talked it out of him. He has promised to follow you down to the Warden\'s door.' } }] }],
  },
  'chapel-won': {
    id: 'chapel-won', kind: 'story', noBack: true, art: { imageId: 'loc-temple', emoji: '📖' },
    text: [
      'Halden\'s prayer book lies open on the altar, fen-damp but easy to read. Notes crowd the margins in Halden\'s tidy hand. *The Reedwife kept the vigil. The vigil is ended. The Warden of the Barrows wakes, and gathers hands to open his door from within.* Further down, the hand changes. It shakes, like a man fighting his own arm.',
      'Pressed so hard the nib tore the page: *"The rites of sealing are in this book. Someone with nerve must say them at the door. Not me. It will not let it be me."*',
      'So the truth lands at last. The **Reedwife** was never just a hag. She was the jailer of the **Warden of the Barrows**, an ancient dead power under the fen. Her feeding kept him asleep. When she died, his seal broke with her. Now he wakes, and he calls the dead to open his door from the inside.',
      'The book also gives you the fix. Take it to the great barrow, reach the Warden\'s door, and *speak the rites of sealing there*. That will shut him in again. Under the altar cloth you also find a healing potion that Halden never got to drink.',
      '"Nerve we\'ve got," Wren says, reading over your shoulder. She sounds almost sure of it. "The door\'s past the Barrow Gate." On the way out she sniffs one of the black candles and makes a face. "Halden never bought these in Thornwick. Somebody brought them out here."',
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
      { id: 'druid', label: '[Druid] Read the fen like a map, and walk round', to: 'lights-skirted',
        requires: [{ kind: 'classInParty', classId: 'druid' }], hideWhenBlocked: true },
      { id: 'ranger', label: '[Ranger] Follow the reeds that only grow on firm ground', to: 'lights-skirted',
        requires: [{ kind: 'classInParty', classId: 'ranger' }], hideWhenBlocked: true },
      { id: 'skirt', label: '[Survival DC 13] Find the dry way round the pools', to: 'lights-skirted',
        once: true, check: { skill: 'survival', dc: 13, failTo: 'lights-call' } },
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
      { id: 'keep', label: 'Keep the purses. The living have bills too', to: 'fen',
        effects: [{ kind: 'gold', amount: 55 }, { kind: 'setFlag', flag: 'lights-cleared' }, WORM_CLUE] },
      { id: 'home', label: 'Carry the purses home for the families', to: 'fen',
        effects: [{ kind: 'setFlag', flag: 'lights-cleared' }, { kind: 'setFlag', flag: 'drowned-gold-home' }, WORM_CLUE,
          { kind: 'journal', entry: { id: 'c-purses', kind: 'clue', title: 'The Drowned Folk\'s Purses',
            body: 'You took the purses of the people the corpse-lights drowned. You mean to hand them to Reeve Aldous for their families.' } }] },
    ],
    noBack: true,
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
    next: POOL_CHOICES,
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
    onWin: { to: 'fen', text: ['The serpents lie in loops like dropped rope. Your boots turn up everything the fen-folk ever paid here, from old coins to a sealed flask of potion. The pool is plain water now.'],
      effects: [{ kind: 'setFlag', flag: 'pool-cleared' }, { kind: 'gold', amount: 85 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }] },
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
        'You hold up Halden\'s book, open at the drawing of the reed-woman\'s mark. The old builders cut that same mark into the gate. You find it on the nearest stone and lay your hand flat on it.',
        'The watchers stop at the edge of the lintel. They look at the book for a long, grinding moment. Then they fold their wings and turn back into plain grey stone. They guard the vigil, and the book says you keep it now.',
      ] },
    },
  },
  // Wren stays here. Every way down the steps sends her to her post.
  'lychgate-won': {
    id: 'lychgate-won', kind: 'story', noBack: true, art: { imageId: 'loc-crypt', emoji: '⛩️' },
    text: [
      'Past the Barrow Gate the mounds rise in their dozens. At the field\'s heart the largest barrow stands **open**. Not fallen in, but *unlocked*. A doorway of dressed stone breathes out cold. Worked steps lead down. Every file of the walking dead leads down into it like thread into a needle.',
      'The **Undercrypt**. This is the prison the old prayers named, the one the Reedwife\'s long feeding kept shut. Wren looks at the steps, then at you. "This is where sense stays home," she says. "I\'ll hold the gate. Someone\'s got to be standing here when you walk back out." You pretend, kindly, not to hear the *when* she leans on.',
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
      torch: { length: 12, out: 'crypt-dark' },
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
      'The torch gutters, spits, and dies. The dark down here is total. You hold hands like children and feel your way along the walls, up and up.',
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
      'The last panel is fresh mud smeared over old paint. One angry stroke crosses out the woman of the reeds. Beneath her, many dead hands scrawled the words: **THE VIGIL HAS ENDED. THE DOOR OPENS FROM WITHIN.**',
      'It is Halden\'s prayer book in pictures. The mud adds one thing the book did not say. The Warden\'s servants are at his door right now, deep below you.',
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
      { id: 'step', label: 'Pick up a tool and fall into step', hint: 'Shuffle, swing, and look as dead as they do.',
        skill: 'deception', dc: 13,
        success: { to: 'diggers-chain', text: ['You take a pick from the pile and shuffle in among them. Swing, step, swing. Nobody looks twice at one more digger. You walk out the far end, still swinging.'] },
        failure: { to: 'diggers', text: ['You swing too fast. The living always do. The nearest digger stops and turns its empty face toward you, then slowly goes back to work.'] } },
      { id: 'cleric', label: '[Cleric] Raise your holy symbol and turn them aside', hint: 'The dead give way to the gods, when the gods are asked properly.',
        skill: 'religion', dc: 8,
        requires: [{ kind: 'classInParty', classId: 'cleric' }], hideWhenBlocked: true,
        success: { to: 'diggers-chain', text: ['You hold up your holy symbol, and a light that is not torch-light fills the cut. The dead shuffle back from it like sheep from a dog. They press to the walls and leave you a road.'] },
        failure: { to: 'diggers', text: ['The light flickers and fails. Something deeper in the barrow is pushing back, and it is stronger down here.'] } },
      { id: 'paladin', label: '[Paladin] Stand in their road and speak your oath', hint: 'An oath is a promise. The dead remember promises.',
        skill: 'religion', dc: 8,
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
    ],
    next: [
      { id: 'carry', label: 'Wrap him in a cloak and carry him home', to: '@hub',
        effects: [{ kind: 'setFlag', flag: 'diggers-passed' }, { kind: 'setFlag', flag: 'grandfather-home' },
          { kind: 'journal', entry: { id: 'c-grandfather', kind: 'clue', title: 'The Old Reeve',
            body: 'Reeve Aldous\'s grandfather was digging with the dead in the Undercrypt. You knew him by his chain of office. You are carrying him home to Thornwick.' } }] },
      { id: 'leave', label: 'Lay him down here, chain and all', to: '@hub',
        effects: [{ kind: 'setFlag', flag: 'diggers-passed' }] },
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
      'The embalmed king turns. Whatever the Warden promised him, the Warden clearly paid in full. The eyes behind the wrappings burn with a slow, pleased light. Two of his household dead lurch from the corners, still in their funeral best.',
    ],
    onWin: { to: '@hub', text: ['The king crumbles. His grave-cloths sag around nothing but dust and old spice. His servants drop mid-lurch. Behind him, at the bottom of the wall, one name sits freshly carved, with no line through it yet. **THORNWICK**. The Warden has already chosen his next village.', 'Behind the king\'s throne, a burial shaft drops into the dark. The chanting comes up out of it.'],
      effects: [{ kind: 'setFlag', flag: 'king-down' }, { kind: 'gold', amount: 60 }] },
  },
  'seal-approach': {
    id: 'seal-approach', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '🚪' },
    text: [
      'The lowest stair ends at the door the paintings promised. It is a slab of stone the size of a barn wall. Old words are cut across it, and lead fills every letter. The stone bows *outward*, straining, as something on the far side leans against it. The chanting you\'ve heard for an hour turns into words. Living voices speak them. The dead do not chant.',
      'A congregation of the **living** kneels at the door. They wear robes the colour of grave-worms and hold candles of black tallow. This is the **Cult of the Worm**, come far and fast on the news of a failing seal. The nailed boots on the old road were theirs. So were the black candles in the chapel. Their fanatic stands at the door with a chisel of bone, prying the lead out one letter at a time. An acolyte kneels at his side with the candle. A walking suit of ancient armour guards the stair. Two ghouls crouch among the candles like pets.',
      '"Faster," the fanatic tells his chisel, sweetly reasonable. "The Warden is *so near the latch*." The rites of sealing are in your pack. The nerve to say them is up to you.',
    ],
    next: [{ id: 'fight', label: 'Interrupt the service', to: 'seal-battle' }],
  },
  'seal-battle': {
    id: 'seal-battle', kind: 'battle', encounterId: 'cult', mapId: 'firepit',
    onLoss: { to: 'seal-battle-lost' },
    loot: { bonusTier: 'rare' },
    intro: ['The fanatic turns with the chisel still in his hand, and rage floods the sweet reason off his face. "The door opens for the *faithful*!" His acolyte drops the candle and pulls a knife. The armour grinds down the stair. The ghouls come low and fast between the candles.'],
    onWin: { to: 'resealing', text: ['The fanatic dies reaching for the door. For the first time in an age, none of the Warden\'s servants stand at his door. Only you stand there, with the book.'],
      effects: [{ kind: 'xpToLevel', level: 4 }, { kind: 'setFlag', flag: 'cult-broken' }, { kind: 'gold', amount: 120 }] },
  },
  // The climax is a choice of how, and a roll: each way of saying the rites may
  // be tried once. Halden, if he lived, can say his own. If every voice fails,
  // the door cracks and the Warden's dead come through it.
  resealing: {
    id: 'resealing', kind: 'challenge', art: { imageId: 'loc-dungeon', emoji: '📖' },
    intro: [
      'The great door still bulges outward. Half the lead is gone from its letters, and the Warden leans on what is left. Against the far wall, the cultists who never fought are still on their knees. They watch you with their black candles guttering.',
      'Halden\'s book lies open in your hands. The rites fill three pages, and the oldest words look too old for a living mouth. Someone has to say them, now, at this door. Halden wrote that it would take nerve. Whose nerve, and how, is up to you.',
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
      { id: 'kneelers', label: 'Turn the kneeling cultists to the words', hint: 'They came here to chant at this door. Make them chant the right thing.',
        skill: 'persuasion', dc: 14,
        success: { to: 'seal-clean', text: ['You hold the book up where the kneelers can see it. "You came to sing to the Warden," you tell them. "Then sing this." One voice joins yours, then five, then all of them. The Warden\'s own faithful sing him back to sleep.'] },
        failure: { to: 'resealing', text: ['The kneelers look at the book, then at the door. They bow their heads and go back to their own chant, louder than before.'] } },
      { id: 'wizard', label: '[Wizard] Pick the lock the old masons cut', hint: 'You know a ward when you see one. This one is only half-broken.',
        skill: 'arcana', dc: 10,
        requires: [{ kind: 'classInParty', classId: 'wizard' }], hideWhenBlocked: true,
        success: { to: 'seal-clean', text: ['You have read wards like this in dusty books. This one is a lock, and the rites are its key. You find where the fanatic broke it, and mend each letter with the line that belongs to it. The lead glows, and sets hard.'] },
        failure: { to: 'resealing', text: ['The ward is older than any book you have read. You lose your place in it, and a letter spits hot lead at your hand.'] } },
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
    text: ['The reeve counts the purse into your hands himself, coin by coin. "Thornwick settles its debts," he says, and for once he almost smiles.'],
    next: [{ id: 'ok', label: 'Back to the square', to: 'sb-aftermath-hub' }], noBack: true,
  },
  'sb-claim-round': {
    id: 'sb-claim-round', kind: 'story', art: { imageId: 'loc-tavern', emoji: '🍺' },
    text: ['The taproom drinks to the company, then to the dead, then to Mira, who pretends not to hear it.'],
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
        text: 'Halden and his acolytes share a new grave by the chapel, and Mira won\'t say whose idea the white stone was.' },
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
      { if: [],
        text: 'On the last night, at the fen\'s edge, the reeds parted around two figures. They did not walk so much as *arrive* — tall, green-fingered, river-weed in their hair. They were sisters, unmistakably, of a certain late Reedwife. They looked at the sealed barrow-field for a long moment. Then they looked at the town, the way you look at a house you mean to come back to. Then the reeds closed, and they were gone — for now. Debts, in the deep fen, have a way of *coming due*.' },
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
  // whether the company knows Wren (set on every route to the fen), whether
  // Brother Halden lived, and whether the Warden's door shut cracked.
  carries: ['met-wren', 'halden-saved', 'seal-cracked'],
  companions: {
    wren: {
      id: 'wren', name: 'Wren', monsterId: 'scout', portraitId: 'npc-scout', emoji: '🏹',
      blurb: 'The reeve\'s scout. Guiding you through the deep fen as far as the Barrow Gate, where she holds the way out.',
    },
  },
};
