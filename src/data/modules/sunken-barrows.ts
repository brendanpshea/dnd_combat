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

const INN_CHOICES = [
  { id: 'room', label: 'Take a room for the night — 1 gold (long rest)', to: 'inn-rest',
    requires: [{ kind: 'gold' as const, atLeast: 1 }], effects: [{ kind: 'gold' as const, amount: -1 }] },
  { id: 'leave', label: 'Back to the street', to: 'town' },
];

const POOL_CHOICES = [
  { id: 'fight', label: 'Wade in and settle the rent', to: 'pool-fight' },
  { id: 'leave', label: 'Leave the pool its privacy', to: 'fen' },
];

const scenes: Record<string, Scene> = {
  // === ACT 1 — THORNWICK, THE WRONG BELLS ================================
  return: {
    id: 'return', kind: 'story', art: { imageId: 'loc-town', emoji: '🔔' },
    text: [
      'Thornwick by night, and the bells are ringing. Not the steady count of the hour. This is the panicked clatter of a rope hauled by somebody who has forgotten how bells work.',
      'Last season the Ashfang raiders fell, and the **Reedwife**, the green hag of the fen, died in the Ashfang chief's hall. Thornwick still toasts the company that did it. Since then, the valley has slept easy. The gate-warden\'s face says the sleeping is over. "It\'s the **churchyard**," he manages. "The graves are *open*, and it wasn\'t shovels did it."',
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
    id: 'grave-morning', kind: 'story', art: { emoji: '⛪' },
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
          ] },
      ],
    },
  },
  inn: {
    id: 'inn', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'The Wander-Inn is far too full for this hour. Nobody in Thornwick wants to sleep alone tonight, not with the churchyard standing open. **Mira** sets down a bowl in front of you unasked.',
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
  'sb-market': { id: 'sb-market', kind: 'shop', title: 'Thornwick Market', next: 'town',
    npc: BRAM,
    intro: ['"Grave-trouble, they say." **Bram** spreads his hands over the stall. "Then you\'ll be wanting silver, steel, and no questions. Two of the three I stock."'] },
  'reeve-hall': {
    id: 'reeve-hall', kind: 'dialogue', npc: REEVE, art: { emoji: '⚖️' },
    lines: [
      'The reeve\'s hall smells of candle-wax and ledgers. **Reeve Aldous** stands at the window with his back to you. He watches the fen fog eat his water-meadows. He grips his chain of office in one fist, like a weapon he doesn\'t know how to use.',
      '"Thornwick settles its debts," he says, without turning. "It appears the marsh does likewise. My grandfather\'s grave is open, and my grandfather has *gone somewhere*." He turns. He looks older than the ledgers. "You stood against the things in my churchyard last night. My watch did not. So I am paying you. Follow my dead into the fen, find what calls them, and put it down."',
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
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'lights-cleared' }], to: 'lights-done' }] },
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
      'There are two ways on. North stands the broken tower of the **drowned chapel**. South lies flat water where the **corpse-lights** dance. Past them both, where all the tracks come together, the barrow-country waits.',
    ],
    next: [{ id: 'on', label: 'Into the fen', to: 'fen',
      effects: [{ kind: 'setFlag', flag: 'fen-read' },
        { kind: 'journal', entry: { id: 'c-work', kind: 'clue', title: 'Called to Work',
          body: 'The fen\'s own dead have walked for days, in rows, past the chapel and the corpse-lights toward the old barrow-country. Whatever calls them is putting them to work. It is digging something open, or building something.' } }] }],
  },
  'causeway-done': {
    id: 'causeway-done', kind: 'story', art: { emoji: '👣' },
    text: ['The old road\'s stones stretch on into the fog. The files of footprints are still there. Everything that made them has already gone on ahead.'],
    next: [{ id: 'ok', label: 'Press on', to: 'fen' }], noBack: true,
  },
  'fen-night': {
    id: 'fen-night', kind: 'battle', encounterId: 'marsh-dead', mapId: 'bog',
    intro: ['You wake to a hand on your shoulder and a blade already drawn beside you. The fen has sent visitors. Two ghouls, grave-mud to the elbows, crawl out of the black water. They move with the calm confidence of things that have done this before. No rest tonight. Just work.'],
    onWin: { to: '@hub', text: ['The ghouls lie still, properly still this time. The night is ruined and the fire is out. Nobody says what you are all thinking. They came out of the deep fen, the *very place you plan to go*.'] },
  },
  chapel: {
    id: 'chapel', kind: 'dialogue', npc: HALDEN, art: { imageId: 'loc-temple', emoji: '🕯️' },
    lines: [
      'The chapel kneels in the water, drowned to its windows, its bell-tower leaning like a man listening. Candlelight where no candles should be. And on the dry island of the altar steps stands a priest. His robes are fen-stained, his face serene. He is leading a congregation.',
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
  },
  'chapel-caught': {
    id: 'chapel-caught', kind: 'battle', encounterId: 'temple', mapId: 'ruins',
    surprise: 'enemies',
    intro: ['You see it a breath before it moves. The thing behind Halden\'s serenity winds up through him like rot up a post. You\'re already moving when his two acolytes step forward and two skeletons wade out of the rows. For once the dead are the ones caught flat-footed.'],
    onWin: { to: 'chapel-won', text: ['Caught off balance from the first blow, the dead never find their rows again. Halden slumps against the altar rail. Whatever was wearing him lets go, and leaves him looking almost grateful.'] },
  },
  'chapel-won': {
    id: 'chapel-won', kind: 'story', art: { imageId: 'loc-temple', emoji: '📖' },
    text: [
      'Halden\'s prayer book lies open on the altar, fen-damp but easy to read. Notes crowd the margins in a tidy priest\'s hand. *The Reedwife kept the vigil. The vigil is ended. The Warden of the Barrows wakes, and gathers hands to open his door from within.*',
      'And beneath, underlined twice, the sentence that makes it your business: *"The rites of sealing are the old rites. The words are in this book. What is wanted is someone with the nerve to say them at the door."*',
      'So the truth lands at last. The **Reedwife** was never just a hag. She was the jailer of the **Warden of the Barrows**, an ancient dead power under the fen. Her feeding kept him asleep. When she died, his seal broke with her. Now he wakes, and he calls the dead to open his door from the inside.',
      'The book also gives you the fix. Take it to the great barrow, reach the Warden\'s door, and *speak the rites of sealing there*. That will shut him in again. Under the altar cloth you also find a healing potion that Halden never got to drink.',
      '"Nerve we\'ve got," Wren says, reading over your shoulder. She sounds almost sure of it. "The door\'s past the Barrow Gate."',
    ],
    next: [{ id: 'on', label: 'Take the prayer book', to: 'fen',
      effects: [{ kind: 'setFlag', flag: 'chapel-cleared' }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 },
        { kind: 'journal', entry: { id: 'c-rites', kind: 'clue', title: 'The Rites of Sealing',
          body: 'Brother Halden\'s prayer book holds the old rites of sealing. The Reedwife was the jailer of the Warden of the Barrows. Her feeding kept him asleep, and her death broke his seal. Speak the rites at the Warden\'s door, deep in the great barrow, to shut him in again.' } }] }],
  },
  'chapel-done': {
    id: 'chapel-done', kind: 'story', art: { imageId: 'loc-temple', emoji: '🕯️' },
    text: ['The drowned chapel stands empty. Its awful congregation lies still at last, and the candles have burned out. The bell-tower still leans, listening to nothing.'],
    next: [{ id: 'ok', label: 'Back to the fen', to: 'fen' }], noBack: true,
  },
  lights: {
    id: 'lights', kind: 'story', art: { emoji: '💡' },
    text: [
      'The flat water south of the old road is where the fen does its prettiest lying. Lights hang over the black mirror — soft, swaying, warm as windows. Wren\'s face goes carefully blank. "Corpse-candles. They walk mourners into the deep pools and hold them under. Half of Thornwick\'s missing folk are *under this water*."',
      'The lights drift nearer, hopeful as dogs. Something else moves between them, further out. It is a colder shape, and it was a person once.',
    ],
    next: [
      { id: 'fight', label: 'Snuff them out', to: 'lights-fight' },
      { id: 'leave', label: 'Back away from the water', to: 'fen' },
    ],
  },
  'lights-fight': {
    id: 'lights-fight', kind: 'battle', encounterId: 'wisp-bog', mapId: 'bog',
    intro: ['The lights stop pretending. Two of them come in low and fast over the water, crackling with stolen life. A cold shape rises between them. It is a specter trailing fen-mist, its mouth open on a scream the water drank years ago.'],
    onWin: { to: 'fen', text: ['The last wisp winks out, and the water goes dark for good. In the shallows you find the purses of the drowned, 55 gold between them. Somewhere under the water, Thornwick\'s missing folk can rest at last.'],
      effects: [{ kind: 'setFlag', flag: 'lights-cleared' }, { kind: 'gold', amount: 55 }] },
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
      'Wren stops dead. "Those weren\'t there when I scouted." She\'s right — the stone bases are mossy, but the watchers\' claws are clean. The granite stretches, cracks its wings, and drops on you like a falling roof.',
    ],
    onWin: { to: 'lychgate-won', text: ['The second gargoyle shatters mid-dive and rains down as plain gravel. The Barrow Gate stands unwatched now. Beyond it, the field of burial mounds opens out ahead of you.'] },
  },
  // Wren stays here. Every way down the steps sends her to her post.
  'lychgate-won': {
    id: 'lychgate-won', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛩️' },
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
  undercrypt: {
    id: 'undercrypt', kind: 'explore',
    map: {
      title: 'The Undercrypt', theme: 'graveyard', art: { imageId: 'loc-crypt', emoji: '🕳️' },
      camp: { risky: { chance: 0.35, battleScene: 'crypt-night' } },
      entry: ['hall'],
      paths: [['hall', 'ossuary'], ['hall', 'wights'], ['wights', 'king'], ['king', 'seal']],
      nodes: [
        { id: 'hall', x: 14, y: 50, label: 'The Painted Hall', icon: 'tok-ruin', scene: 'hall',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'hall-seen' }], to: 'hall-done' }] },
        { id: 'ossuary', x: 34, y: 20, label: 'The Bone Room', mystery: 'A room stacked with bones…', icon: 'tok-treasure', scene: 'ossuary',
          hidden: { dc: 13 },
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'ossuary-searched' }], to: 'ossuary-done' }] },
        { id: 'wights', x: 46, y: 62, label: 'The Barrow-Lords', mystery: 'Armoured silhouettes…', icon: 'tok-figure', scene: 'wights',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'wights-down' }], to: 'wights-done' }] },
        { id: 'king', x: 68, y: 40, label: 'The King\'s Chamber', mystery: 'A door sealed in lead…', icon: 'tok-boss', scene: 'king',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'king-down' }], to: 'king-done' }] },
        { id: 'seal', x: 88, y: 60, label: 'The Warden\'s Door', mystery: 'Chanting, below…', icon: 'tok-danger', scene: 'seal-approach' },
      ],
    },
  },
  // The chapel told it in words; the hall shows it in paint, and adds where.
  hall: {
    id: 'hall', kind: 'story', art: { imageId: 'loc-crypt', emoji: '🎨' },
    text: [
      'The stair opens into a painted hall. Artists covered these walls before Thornwick had a name. The pictures tell one story, over and over. A **door** stands under the earth. A **horned warden** waits behind it. Before the door, age after age, a **woman of the reeds** keeps watch.',
      'The last panel is fresh mud smeared over old paint. One angry stroke crosses out the woman of the reeds. Beneath her, many dead hands scrawled the words: **THE VIGIL HAS ENDED. THE DOOR OPENS FROM WITHIN.**',
      'It is Halden\'s prayer book in pictures. The mud adds one thing the book did not say. The Warden\'s servants are at his door right now, deep below you.',
    ],
    next: [{ id: 'on', label: 'Deeper in', to: 'undercrypt',
      effects: [{ kind: 'setFlag', flag: 'hall-seen' },
        { kind: 'journal', entry: { id: 'c-warden', kind: 'clue', title: 'The Door Opens From Within',
          body: 'The painted hall at the top of the Undercrypt shows the Warden\'s door, far below, and the reed-woman who guarded it. Fresh mud over the paint says the vigil has ended and the door opens from within. His servants are at the door now. Get there first and speak Halden\'s rites.' } }] }],
  },
  'hall-done': {
    id: 'hall-done', kind: 'story', art: { imageId: 'loc-crypt', emoji: '🎨' },
    text: ['The painted hall is still. On the walls, the woman of the reeds keeps her watch, crossed out in mud.'],
    next: [{ id: 'ok', label: 'Deeper in', to: 'undercrypt' }], noBack: true,
  },
  'crypt-night': {
    id: 'crypt-night', kind: 'battle', encounterId: 'specter-haunt', mapId: 'corridor',
    intro: ['You bank a fire in a dry side-vault, and the Undercrypt notices. The cold comes first. Then come the shapes it belongs to. Two specters, the painted dead come loose from the walls, slide toward your fire.'],
    onWin: { to: '@hub', text: ['The specters tear apart into cold and silence. Nobody tries to sleep again. You sit out the rest of the night with your backs to the wall and your weapons across your knees.'] },
  },
  ossuary: {
    id: 'ossuary', kind: 'check', skill: 'investigation', dc: 12, art: { emoji: '💀' },
    intro: ['A side room stacked floor to ceiling with the tidy dead — ten thousand skulls stacked in rows like bricks. Grave-goods glint in the niches. The barrow-lords took their wealth down with them; a careful eye might take some of it back up.'],
    success: { to: 'undercrypt', text: ['Behind a row of skulls, the builders left a hidden nook. Inside are coins stamped by kings nobody remembers. There is also a flask of drink that has gone strong with age instead of sour.'],
      effects: [{ kind: 'setFlag', flag: 'ossuary-searched' }, { kind: 'gold', amount: 90 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }] },
    failure: { to: 'undercrypt', text: ['You grope through two niches, touch something that crunches, and decide to stop. You leave with a few loose coins off the floor. The dead can keep the rest. They did the work.'],
      effects: [{ kind: 'setFlag', flag: 'ossuary-searched' }, { kind: 'gold', amount: 20 }] },
  },
  'ossuary-done': {
    id: 'ossuary-done', kind: 'story', art: { emoji: '💀' },
    text: ['The bone room\'s skulls sit in their rows, as neat as ever. Nothing is left here but the dead and their tidy stacking.'],
    next: [{ id: 'ok', label: 'Back to the halls', to: 'undercrypt' }], noBack: true,
  },
  wights: {
    id: 'wights', kind: 'battle', encounterId: 'wight-tomb', mapId: 'corridor',
    intro: [
      'This is the hall of the kings\' guard. Three slabs of black stone stand in the dark. On the middle one, an old guardsman in barrow-armour sits *up*. Cold light burns in its eye sockets. It draws a sword older than the road outside. It does not shuffle like the other dead. It takes a **stance**.',
      'From the slabs on either side, two skeletons rise to guard it. They snap to their feet like soldiers called to order, and they come for you.',
    ],
    onWin: { to: 'undercrypt', text: ['The wight comes apart at the joints, like a puppet whose strings were cut centuries too late. The cold light in its eyes gutters out, and its skeletons clatter down after it. The dead army below just lost its officers.'],
      effects: [{ kind: 'setFlag', flag: 'wights-down' }, { kind: 'gold', amount: 40 }] },
  },
  'wights-done': {
    id: 'wights-done', kind: 'story', art: { emoji: '⚔️' },
    text: ['The barrow-guard and its skeletons lie broken across the black slabs. Its old sword lies where it fell. Nobody feels any need to pick it up.'],
    next: [{ id: 'ok', label: 'Onward', to: 'undercrypt' }], noBack: true,
  },
  king: {
    id: 'king', kind: 'battle', encounterId: 'mummy-crypt', mapId: 'corridor',
    intro: [
      'Old masons sealed the king\'s chamber in lead. Something has peeled the lead back like fruit-rind, from the *inside*. Within, a figure in grave-wrappings the colour of old honey stands before a wall carved with names.',
      'They are the names of villages, hundreds of them, and a line runs through every one. You know a few from old songs. None of them stand anymore. These are the places the Warden swallowed the last time he woke.',
      'The embalmed king turns. Whatever the Warden promised him, the Warden clearly paid in full. The eyes behind the wrappings burn with a slow, pleased light. Two of his household dead lurch from the corners, still in their funeral best.',
    ],
    onWin: { to: 'undercrypt', text: ['The king crumbles. His grave-cloths sag around nothing but dust and old spice. His servants drop mid-lurch. Behind him, at the bottom of the wall, one name sits freshly carved, with no line through it yet. **THORNWICK**. The Warden has already chosen his next village.'],
      effects: [{ kind: 'setFlag', flag: 'king-down' }, { kind: 'gold', amount: 60 }] },
  },
  'king-done': {
    id: 'king-done', kind: 'story', art: { emoji: '🏺' },
    text: ['Dust and peeled lead mark where the king held court. At the bottom of the wall of lost villages, Thornwick\'s name still has no line through it. You mean to keep it that way.'],
    next: [{ id: 'ok', label: 'Onward', to: 'undercrypt' }], noBack: true,
  },
  'seal-approach': {
    id: 'seal-approach', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '🚪' },
    text: [
      'The lowest stair ends at the door the paintings promised. It is a slab of stone the size of a barn wall. Old words are cut across it, and lead fills every letter. The stone bows *outward*, straining, as something on the far side leans against it. The chanting you\'ve heard for an hour turns into words. Living voices speak them. The dead do not chant.',
      'A congregation of the **living** kneels at the door. They wear robes the colour of grave-worms and hold candles of black tallow. This is the **Cult of the Worm**, come far and fast on the news of a failing seal. Their fanatic stands at the door with a chisel of bone, prying the lead out one letter at a time. An acolyte kneels at his side with the candle. A walking suit of ancient armour guards the stair. Two ghouls crouch among the candles like pets.',
      '"Faster," the fanatic tells his chisel, sweetly reasonable. "The Warden is *so near the latch*." The rites of sealing are in your pack. The nerve to say them is up to you.',
    ],
    next: [{ id: 'fight', label: 'Interrupt the service', to: 'seal-battle' }],
  },
  'seal-battle': {
    id: 'seal-battle', kind: 'battle', encounterId: 'cult', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The fanatic turns with the chisel still in his hand, and rage floods the sweet reason off his face. "The door opens for the *faithful*!" His acolyte drops the candle and pulls a knife. The armour grinds down the stair. The ghouls come low and fast between the candles.'],
    onWin: { to: 'resealing', text: ['The fanatic dies reaching for the door. For the first time in an age, none of the Warden\'s servants stand at his door. Only you stand there, with the book.'],
      effects: [{ kind: 'xpToLevel', level: 4 }, { kind: 'setFlag', flag: 'cult-broken' }, { kind: 'gold', amount: 120 }] },
  },
  resealing: {
    id: 'resealing', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '📖' },
    text: [
      'You read the old rites from Halden\'s prayer book by black candle-light. You stumble over the oldest words, and say them again until they come out right. The lead letters drink the words the way dry ground drinks rain. Line by line, the great door stops *straining*.',
      'Last of all comes the pressure behind it. Something enormous on the far side turns its attention away, unhurried and unimpressed. It is not beaten. It has simply gone back to sleep. Up above, across the barrow-field, every walking corpse lies down where it stands.',
      'It is done. The door stands sealed, and the **Warden** sleeps again.',
      'The vigil holds. It has a new keeper now — a book, a door, and a town that knows to watch it. It will have to do.',
    ],
    next: [{ id: 'home', label: 'Climb back to the light', to: 'sb-aftermath' }],
  },
  'sb-aftermath': {
    id: 'sb-aftermath', kind: 'story', art: { imageId: 'loc-town', emoji: '🏘️' },
    text: [
      'Wren is still holding the Barrow Gate when you come up. She is upright, knife out, in a great field of dead who have finally stopped moving. She wears the look of someone determined to have been calm the whole time. The walk home is long and wet, and the best walk any of you can remember.',
      'Thornwick reburies its dead in the following days, oldest graves first. The reeve stands bareheaded at every single service. He pays before anyone asks, and counts nothing twice. He shakes each of your hands one entire second longer than protocol requires. For Aldous, this is close to weeping.',
    ],
    next: [
      { id: 'bounty', label: 'Accept the reeve\'s commission, paid in full', to: 'sb-aftermath',
        requires: [{ kind: 'flag', flag: 'reeve-task' }, { kind: 'notFlag', flag: 'sb-paid' }],
        effects: [{ kind: 'gold', amount: 150 }, { kind: 'setFlag', flag: 'sb-paid' }] },
      { id: 'mira', label: 'Stand Mira\'s taproom a round, for once', to: 'sb-aftermath',
        requires: [{ kind: 'gold', atLeast: 10 }, { kind: 'notFlag', flag: 'sb-round' }],
        effects: [{ kind: 'gold', amount: -10 }, { kind: 'setFlag', flag: 'sb-round' }] },
      { id: 'done', label: 'Let the town sleep', to: 'sb-epilogue' },
    ],
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
      'The barrows sleep. The chapel is drained and re-blessed. The corpse-lights are out for good. Every grave in Thornwick\'s churchyard is full again, and stays that way. The prayer book lives in the reeve\'s strongest chest. The reeve has promoted Wren, to her visible horror. She leads the watch that walks the old road once a season.',
      'Only one thing sours the ale. On the last night, at the fen\'s edge, the reeds parted around two figures. They did not walk so much as *arrive* — tall, green-fingered, river-weed in their hair. They were sisters, unmistakably, of a certain late Reedwife. They looked at the sealed barrow-field for a long moment. Then they looked at the town, the way you look at a house you mean to come back to. Then the reeds closed, and they were gone — for now. Debts, in the deep fen, have a way of *coming due*.',
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
  // What the last chapter remembers: whether the company knows Wren (read
  // there as 'sunken-barrows:met-wren'). Set on every route to the fen.
  carries: ['met-wren'],
  companions: {
    wren: {
      id: 'wren', name: 'Wren', monsterId: 'scout', portraitId: 'npc-scout', emoji: '🏹',
      blurb: 'The reeve\'s scout. Guiding you through the deep fen as far as the Barrow Gate, where she holds the way out.',
    },
  },
};
