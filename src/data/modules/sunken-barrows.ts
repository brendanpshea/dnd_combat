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
import type { Module, Scene } from '../../adventure/types.js';

const MIRA = { id: 'npc-mira', name: 'Mira the Innkeeper', portraitId: 'npc-innkeeper', emoji: '🍺' };
const BRAM = { id: 'npc-bram', name: 'Bram the Quartermaster', portraitId: 'npc-merchant', emoji: '🧑‍🌾' };
const REEVE = { id: 'npc-reeve', name: 'Reeve Aldous', portraitId: 'npc-noble', emoji: '⚖️' };
const WREN = { id: 'npc-wren', name: 'Wren, the Reeve\'s Scout', portraitId: 'npc-scout', emoji: '🏹' };
const HALDEN = { id: 'npc-halden', name: 'Brother Halden', portraitId: 'npc-priest', emoji: '🕯️' };

const scenes: Record<string, Scene> = {
  // === ACT 1 — THORNWICK, THE WRONG BELLS ================================
  return: {
    id: 'return', kind: 'story', art: { imageId: 'loc-town', emoji: '🔔' },
    text: [
      'Thornwick by night, and the bells are ringing. Not the steady count of the hour. This is the panicked clatter of a rope hauled by somebody who has forgotten how bells work.',
      'In the marsh, last season, you hunted down and killed the **Reedwife**, the green hag of the fen. Since that victory, the valley has slept easy. The gate-warden\'s face says the sleeping is over. "It\'s the **lychyard**," he manages. "The graves. Sergeant, the graves are *open*, and it wasn\'t shovels did it."',
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
      'The lychyard gate hangs off its hinge. Between the headstones, the darkness has come loose. Two shapes of pure spilled night glide across holy ground. They are cold enough to see, and the ground means nothing to them.',
      'Which, apparently, it now is. Draw steel — for what good steel does against shadow.',
    ],
    onWin: { to: 'grave-morning', text: ['The last shadow tatters apart on your blade like smoke off a doused fire. The lychyard holds its breath.'] },
  },
  'grave-morning': {
    id: 'grave-morning', kind: 'story', art: { emoji: '⛪' },
    text: [
      'Morning shows the lychyard plain, and plain is worse. A dozen graves stand open — dug *outward*, turf thrown wide from below. The dead didn\'t wait for anyone to take them. They climbed out and left on their own.',
      'And they left together. The drag-marks run through the wall-gap and out across the water-meadows, every one of them, straight as a pilgrim road — **into the deep fen**.',
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
        { id: 'inn', x: 22, y: 32, label: 'The Wander-Inn', icon: 'tok-tavern', scene: 'inn' },
        { id: 'market', x: 44, y: 42, label: 'Market', icon: 'tok-market', scene: 'sb-market' },
        { id: 'reeve', x: 70, y: 30, label: 'The Reeve\'s Hall', icon: 'tok-house', scene: 'reeve-hall',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'reeve-task' }], to: 'reeve-done' }] },
        { id: 'graves', x: 30, y: 72, label: 'The Lychyard', icon: 'tok-temple', scene: 'grave-study',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'graves-read' }], to: 'graves-done' }] },
        { id: 'fen-gate', x: 80, y: 76, label: 'The Fen Road', icon: 'tok-gate', scene: 'fen-out',
          requires: [{ kind: 'flag', flag: 'reeve-task' }] },
      ],
    },
  },
  inn: {
    id: 'inn', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'The Wander-Inn is fuller than an inn should be at this hour — nobody in Thornwick fancies sleeping alone with the churchyard in its current mood. **Mira** sets down a bowl in front of you unasked.',
      '"So. The marsh sends us another bill." She says it flat, wiping the bar the way other people sharpen knives. "First raiders, now the departed. I\'d ask what\'s next, but I\'ve found the marsh treats that as a challenge."',
      '"Eat. Then go see the reeve — he\'s been pacing his hall since the bells. And whatever\'s pulling the dead out there — charge it double."',
    ],
    next: [
      { id: 'room', label: 'Take a room for the night — 1 gold (long rest)', to: 'inn-rest',
        requires: [{ kind: 'gold', atLeast: 1 }], effects: [{ kind: 'gold', amount: -1 }] },
      { id: 'leave', label: 'Back to the street', to: 'town' },
    ],
  },
  'inn-rest': {
    id: 'inn-rest', kind: 'rest', variant: 'long', next: 'inn',
    intro: ['A bolted door, a real bed, and the comfortable murmur of a crowded taproom below. Whatever walks the fen, it isn\'t walking in here. You sleep like the blessedly living.'],
  },
  'sb-market': { id: 'sb-market', kind: 'shop', title: 'Thornwick Market', next: 'town',
    npc: BRAM,
    intro: ['"Back again, and the town in trouble again. I\'d call it coincidence, but I\'d not call it that twice." **Bram** spreads his hands over the stall. "Grave-trouble, they say. Then you\'ll be wanting silver, steel, and no questions. Two of the three I stock."'] },
  'reeve-hall': {
    id: 'reeve-hall', kind: 'dialogue', npc: REEVE, art: { emoji: '⚖️' },
    lines: [
      'The reeve\'s hall smells of candle-wax and ledgers. **Reeve Aldous** stands at the window with his back to you. He watches the fen fog eat his water-meadows. He grips his chain of office in one fist, like a weapon he doesn\'t know how to use.',
      '"Thornwick settles its debts," he says, without turning. "It appears the marsh does likewise. My grandfather\'s grave is open, and my grandfather has *gone somewhere*." He turns. He looks older than the ledgers. "I paid you to break raiders and you broke them. I\'m paying you again. Follow my dead into the fen, find what calls them, and put it down."',
      '"My scout will meet you at the fen road. She insisted. Rather forcefully, for someone I employ."',
    ],
    next: [{ id: 'take', label: 'Take the reeve\'s commission', to: 'town', once: true,
      effects: [{ kind: 'setFlag', flag: 'reeve-task' }, { kind: 'gold', amount: 60 },
        { kind: 'journal', entry: { id: 'n-aldous', kind: 'npc', title: 'Reeve Aldous',
          body: 'Thornwick\'s reeve is proud and paying, and he takes this one personally. His grandfather\'s grave is among the opened. His orders are simple. Follow the dead into the fen and end what calls them.' } },
        { kind: 'journal', entry: { id: 'lead-fen', kind: 'lead', resolvedBy: 'undercrypt-found',
          title: 'Into the Deep Fen', body: 'The dead walk one way — into the barrow-country of the deep fen. Wren waits at the fen road to guide you in. Find where the trails converge.' } }] }],
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
        { kind: 'journal', entry: { id: 'c-muster', kind: 'clue', title: 'A Muster of the Dead',
          body: 'The dead left in ranks, oldest first — answering an authority, not a hunger. Something with the right to command graves is doing the commanding.' } }] },
    failure: { to: 'town', text: ['Mud, turf, and the underside of a churchyard: whatever the graves have to say, they aren\'t saying it to you. The trails still point one way. Sometimes the obvious clue is the whole clue.'],
      effects: [{ kind: 'setFlag', flag: 'graves-read' }] },
  },
  'graves-done': {
    id: 'graves-done', kind: 'story', art: { emoji: '🪦' },
    text: ['The lychyard lies quiet, its open graves gaping at the sky like a choir mid-note. Nothing more walks here. Everything that could has already gone ahead of you.'],
    next: [{ id: 'ok', label: 'Back to town', to: 'town' }], noBack: true,
  },
  'fen-out': {
    id: 'fen-out', kind: 'dialogue', npc: WREN, art: { imageId: 'loc-marsh', emoji: '🌫️' },
    lines: [
      'Where the cart-road gives up and the old raised road starts, a familiar figure sits sharpening a familiar boot-knife. **Wren** — upright this time, no dead horse in sight, the reeve\'s colours mended at the shoulder.',
      '"Heard the bells. Figured you\'d be along." She stands, and only barely favours the leg. "I\'ve scouted the near fen twice since the graves opened. Every trail feeds the old barrow-country — past the **drowned chapel**, past the **corpse-lights**. I can walk you as far as sense allows. After that it\'s barrows, and sense stays home."',
    ],
    next: [{ id: 'go', label: 'Follow her onto the raised road', to: 'fen',
      effects: [{ kind: 'setFlag', flag: 'wren-guide' },
        { kind: 'journal', entry: { id: 'n-wren2', kind: 'npc', title: 'Wren, Again',
          body: 'Wren is the scout you pulled from under a horse on the marsh road. She has healed, she has earned a promotion, and she refuses to stay behind. She guides you through the deep fen.' } }] }],
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
        { id: 'pool', x: 66, y: 22, label: 'The Serpent Pool', mystery: 'Ripples with no wind…', icon: 'tok-well', scene: 'pool',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'pool-cleared' }], to: 'pool-done' }] },
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
      'Two ways on: the **drowned chapel\'s** broken tower north, the flat water where the **corpse-lights** dance south. Past both, where every file of prints converges, the barrow-country waits.',
    ],
    next: [{ id: 'on', label: 'Into the fen', to: 'fen',
      effects: [{ kind: 'setFlag', flag: 'fen-read' },
        { kind: 'journal', entry: { id: 'c-work', kind: 'clue', title: 'Called to Work',
          body: 'The fen\'s dead have walked for days, in ranks, converging past the chapel and the corpse-lights on the old barrow-country. Whatever calls them is putting them to work. It is digging something open, or building something.' } }] }],
  },
  'causeway-done': {
    id: 'causeway-done', kind: 'story', art: { emoji: '👣' },
    text: ['The old road\'s stones stretch on, patient as ever. The files of footprints haven\'t moved — everything that made them is already where it was going.'],
    next: [{ id: 'ok', label: 'Press on', to: 'fen' }], noBack: true,
  },
  'fen-night': {
    id: 'fen-night', kind: 'battle', encounterId: 'marsh-dead', mapId: 'bog',
    intro: ['You wake to Wren\'s hand on your shoulder and her knife already out. The fen has sent visitors. Two ghouls, grave-mud to the elbows, crawl out of the black water. They move with the calm confidence of things that have done this before. No rest tonight. Just work.'],
    onWin: { to: '@hub', text: ['The ghouls lie still — properly still, this time. The night is ruined and the fire is out. Wren does not say what you\'re both thinking. They came out of the deep fen — the *very place you plan to go*.'] },
  },
  chapel: {
    id: 'chapel', kind: 'dialogue', npc: HALDEN, art: { imageId: 'loc-temple', emoji: '🕯️' },
    lines: [
      'The chapel kneels in the water, drowned to its windows, its bell-tower canted like a man listening. Candlelight where no candles should be. And on the dry island of the altar steps stands a priest. His robes are fen-stained, his face serene. He is leading a congregation.',
      'The congregation is dead. Rank on rank of them, standing patient in the water, mud-black and empty-eyed, *facing the altar*.',
      '"**Welcome!**" The priest is Brother Halden, once of Thornwick, the mild one who never could hold a room. He beams at you with terrible peace. "You\'ve come to see the great work. The Warden below is gathering his flock at last. I merely… keep the service, until he calls them down. Will you kneel? Everyone kneels, eventually. That\'s rather the point of everyone."',
    ],
    next: [
      { id: 'insight', label: '[Insight DC 13] Read what\'s wearing him before it moves', to: 'chapel-caught',
        once: true, check: { skill: 'insight', dc: 13, failTo: 'chapel-fight' } },
      { id: 'refuse', label: 'Refuse the sermon and draw', to: 'chapel-fight' },
    ],
  },
  'chapel-fight': {
    id: 'chapel-fight', kind: 'battle', encounterId: 'temple', mapId: 'ruins',
    intro: ['Halden sighs, a shepherd disappointed in his flock. The congregation turns as one. Skeletons in rotted mourning-clothes wade from the water. Two acolytes you recognise from Thornwick\'s own chapel flank their brother, eyes as empty as the dead\'s. "The Warden provides," says Halden, and provides.'],
    onWin: { to: 'chapel-won', text: ['Halden folds at the altar steps, looking, at the end, mostly relieved.'] },
  },
  'chapel-caught': {
    id: 'chapel-caught', kind: 'battle', encounterId: 'temple', mapId: 'ruins',
    surprise: 'enemies',
    intro: ['You see it a breath before it moves. The thing behind Halden\'s serenity winds up through him like rot up a post. You\'re already moving when the congregation turns. For once the dead are the ones caught flat-footed.'],
    onWin: { to: 'chapel-won', text: ['Wrong-footed from the first, the congregation never recovers its ranks. Halden folds at the altar steps, looking, at the end, mostly relieved.'] },
  },
  'chapel-won': {
    id: 'chapel-won', kind: 'story', art: { imageId: 'loc-temple', emoji: '📖' },
    text: [
      'Halden\'s prayer-book lies open on the altar, fen-damp but legible. The notes in the margins are a horror-story in a tidy clerical hand. *The Reedwife kept the vigil. The vigil is ended. The Warden of the Barrows wakes, and gathers hands to open his door from within.*',
      'And beneath, underlined twice, the sentence that makes it your business: *"The rites of sealing are the old rites. The words are in this book. What is wanted is someone with the nerve to say them at the door."*',
      'So the truth lands at last, and it lands on you. The **Reedwife** was never just a hag. She was the jailer of the **Warden of the Barrows**, an ancient dead power under the fen. Her feeding kept him asleep. When you killed her, you broke his seal without knowing it. Now he wakes, and he calls the dead to open his door from the inside.',
      'The book also gives you the fix. Take the prayer-book to the great barrow, reach the Warden\'s door, and *speak the rites of sealing there*. That will shut him in again.',
      'Wren reads over your shoulder. "Nerve we\'ve got," she says. "Door\'s past the graveyard gate." She does not mention who ended the vigil. She\'s kind that way.',
    ],
    next: [{ id: 'on', label: 'Take the prayer book', to: 'fen',
      effects: [{ kind: 'setFlag', flag: 'chapel-cleared' }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 },
        { kind: 'journal', entry: { id: 'c-rites', kind: 'clue', title: 'The Rites of Sealing',
          body: 'Brother Halden\'s prayer-book holds the old rites that closed the Undercrypt. The Reedwife\'s feeding was the watch that kept the Warden asleep. Her death ended it. Someone must speak the rites at the door itself, deep in the great barrow.' } }] }],
  },
  'chapel-done': {
    id: 'chapel-done', kind: 'story', art: { imageId: 'loc-temple', emoji: '🕯️' },
    text: ['The drowned chapel stands empty now, its terrible congregation dispersed to proper stillness. The candles have gone out. On the whole, that counts as an improvement.'],
    next: [{ id: 'ok', label: 'Back to the fen', to: 'fen' }], noBack: true,
  },
  lights: {
    id: 'lights', kind: 'story', art: { emoji: '💡' },
    text: [
      'The flat water south of the old road is where the fen does its prettiest lying. Lights hang over the black mirror — soft, swaying, warm as windows. Wren\'s face goes carefully blank. "Corpse-candles. They walk mourners into the deep pools and hold them under. Half of Thornwick\'s missing folk are *under this water*."',
      'The lights drift nearer, hopeful as dogs. Between them, deeper in, something else keeps them company — a colder shape that was a person once.',
    ],
    next: [
      { id: 'fight', label: 'Snuff them out', to: 'lights-fight' },
      { id: 'leave', label: 'Back away from the water', to: 'fen' },
    ],
  },
  'lights-fight': {
    id: 'lights-fight', kind: 'battle', encounterId: 'wisp-bog', mapId: 'bog',
    intro: ['The lights stop pretending. They come in low and fast over the water, crackling with stolen life. A cold shape rises between them. It is a specter trailing fen-mist, its mouth open on a scream the water drank years ago.'],
    onWin: { to: 'fen', text: ['The last wisp gutters out like a debt paid. The water goes honestly dark. Somewhere under it, half of Thornwick\'s missing folk finally rest, and tonight that counts as mercy.'],
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
      'North of the chapel the reeds part around a pool so still it looks solid. Offerings crowd its rim — old ones, coins and combs and querns, generations of fen-folk paying rent to something. The surface moves once, without wind, in a line longer than a boat.',
      'Wren picks up a coin, puts it back with exaggerated care. "The fen-folk fed the pool so the pool stayed *in* the pool. Nobody\'s fed it since the graves opened." A pause. "It looks fed to me," she adds, entirely without conviction.',
    ],
    next: [
      { id: 'fight', label: 'Wade in and settle the rent', to: 'pool-fight' },
      { id: 'leave', label: 'Leave the pool its privacy', to: 'fen' },
    ],
  },
  'pool-fight': {
    id: 'pool-fight', kind: 'battle', encounterId: 'snake-pit', mapId: 'marsh',
    intro: ['The pool empties itself at you. Two constrictors the girth of roof-beams pour out of the water in oiled coils. They are fen-serpents, grown old and vast on a century of offerings. And lately, on whatever walks past unwary.'],
    onWin: { to: 'fen', text: ['The serpents lie in loops like discarded rope. In the offering-mud your boots turn up the accumulated rent of generations — and the pool, at long last, is just water.'],
      effects: [{ kind: 'setFlag', flag: 'pool-cleared' }, { kind: 'gold', amount: 85 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }] },
  },
  'pool-done': {
    id: 'pool-done', kind: 'story', art: { emoji: '💧' },
    text: ['The serpent pool sits quiet, its rim of offerings gleaming dully. It is just water now — deep, cold, and finally ordinary.'],
    next: [{ id: 'ok', label: 'Back to the fen', to: 'fen' }], noBack: true,
  },
  lychgate: {
    id: 'lychgate', kind: 'battle', encounterId: 'gargoyle-perch', mapId: 'ruins',
    intro: [
      'Where every file of footprints converges, the barrow-country announces itself. A graveyard gate of standing stones rises here, older than the chapel, older than the old road. Two weathered granite watchers crown it.',
      'Wren stops dead. "Those weren\'t there when I scouted." She\'s right — the plinths are mossy, but the watchers\' claws are clean. The granite unfolds, cracks its wings, and comes down at you like the roof of the world.',
    ],
    onWin: { to: 'lychgate-won', text: ['The second gargoyle comes apart mid-dive. It rains down as honest gravel. The graveyard gate stands unwatched now. Beyond it, the field of burial mounds opens like a held breath.'] },
  },
  'lychgate-won': {
    id: 'lychgate-won', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛩️' },
    text: [
      'Past the graveyard gate the mounds rise in their dozens. At the field\'s heart the largest barrow stands **open**. Not fallen in, but *unlocked*. A doorway of dressed stone breathes out cold. Worked steps descend. Every file of the walking dead leads down into it like thread into a needle.',
      'The **Undercrypt**. The thing the old prayers named. The thing her long feeding kept shut. Wren looks at the steps, then at you. "This is where sense stays home," she says. "I\'ll hold the gate. It\'s become something of a family tradition. Someone\'s got to be standing here when you walk back out." You pretend, kindly, not to hear the *when* she leans on.',
    ],
    next: [{ id: 'down', label: 'Descend into the Undercrypt', to: 'undercrypt',
      effects: [{ kind: 'setFlag', flag: 'lychgate-cleared' }, { kind: 'setFlag', flag: 'undercrypt-found' }] }],
  },
  'lychgate-open': {
    id: 'lychgate-open', kind: 'story', art: { imageId: 'loc-crypt', emoji: '⛩️' },
    text: ['The graveyard gate stands unwatched, its shattered guardians spread across the old road as gravel. Beyond, the great barrow\'s doorway waits, exhaling cold. Wren keeps her post at the stones, arms folded against more than the chill.'],
    next: [{ id: 'down', label: 'Descend into the Undercrypt', to: 'undercrypt' }], noBack: true,
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
        { id: 'hall', x: 14, y: 50, label: 'The Painted Hall', icon: 'tok-ruin', scene: 'hall' },
        { id: 'ossuary', x: 34, y: 20, label: 'The Bone Room', mystery: 'A side-gallery…', icon: 'tok-treasure', scene: 'ossuary',
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
  hall: {
    id: 'hall', kind: 'story', art: { imageId: 'loc-crypt', emoji: '🎨' },
    text: [
      'The stair opens into a painted hall. Artists covered these walls before Thornwick had a name. The frescoes tell one story, over and over, wrapping the room like a bandage. A **door** stands under the earth. A **horned warden** waits behind it. And before the door, generation after generation, a **woman of the reeds** keeps watch. She takes the sleep of the dead into herself like a woman drawing water.',
      'The last panel is fresh mud smeared over old paint. One furious stroke has crossed out the woman of the reeds. Beneath her, many dead hands scrawled the words: **THE VIGIL HAS ENDED. THE DOOR OPENS FROM WITHIN.**',
      'So there it is, painted plain. The Reedwife was no squatter — she was the *lock*. And the company that broke her has come, at last, to pay for the privilege.',
    ],
    next: [{ id: 'on', label: 'Deeper in', to: 'undercrypt',
      effects: [{ kind: 'journal', entry: { id: 'c-warden', kind: 'clue', title: 'The Warden Below',
        body: 'The Undercrypt\'s wall-paintings name the truth. The Reedwife was the Warden\'s jailer. Her feeding was the watch that kept his door shut. Her death, your victory, is what opened the barrows. The rites in Halden\'s prayer-book can close the door again, spoken at the door itself.' } }] }],
  },
  'crypt-night': {
    id: 'crypt-night', kind: 'battle', encounterId: 'specter-haunt', mapId: 'corridor',
    intro: ['You bank a fire in a dry side-vault, and the Undercrypt notices. The cold arrives first, then the shapes it belongs to — two specters sliding out of the painted walls, the fresco-dead come loose from their own story. So much for the watch rotation.'],
    onWin: { to: '@hub', text: ['The specters shred into cold and silence. Nobody suggests going back to sleep. The fire gets banked. The night gets counted as spent. The Undercrypt gets exactly no rest out of any of you.'] },
  },
  ossuary: {
    id: 'ossuary', kind: 'check', skill: 'investigation', dc: 12, art: { emoji: '💀' },
    intro: ['A side-gallery stacked floor to vault with the tidy dead — ten thousand skulls in courses, like masonry with opinions. Grave-goods glint in the niches. The barrow-lords took their wealth down with them; a careful eye might take some of it back up.'],
    success: { to: 'undercrypt', text: ['Behind a course of skulls, the masons left a paymaster\'s niche. Inside is coin struck by kings nobody remembers. There is also a flask of something that has aged into strength rather than vinegar.'],
      effects: [{ kind: 'setFlag', flag: 'ossuary-searched' }, { kind: 'gold', amount: 90 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }] },
    failure: { to: 'undercrypt', text: ['You grope two niches, meet something that crunches, and elect to stop. The dead keep their wages. On reflection, they did the work.'],
      effects: [{ kind: 'setFlag', flag: 'ossuary-searched' }, { kind: 'gold', amount: 20 }] },
  },
  'ossuary-done': {
    id: 'ossuary-done', kind: 'story', art: { emoji: '💀' },
    text: ['The ossuary\'s ten thousand residents regard you with the fixed patience of an audience that has seen your act already. Nothing left here but the dead and their arithmetic.'],
    next: [{ id: 'ok', label: 'Back to the halls', to: 'undercrypt' }], noBack: true,
  },
  wights: {
    id: 'wights', kind: 'battle', encounterId: 'wight-tomb', mapId: 'corridor',
    intro: [
      'This is the hall of the old dead kings. Three slabs of black stone stand in the dark. On the middle one, a king\'s guard sits *up*. Cold light burns in its eye sockets. It draws a sword older than the road outside. It does not shuffle like the other dead. It takes a **stance**.',
      'From the slabs on either side, its honour-guard of skeletons rise to their feet. They stand with the parade-ground snap of soldiers called to order. And they mean to enjoy it.',
    ],
    onWin: { to: 'undercrypt', text: ['The wight comes apart at the joints, like a puppet whose strings were cut centuries too late. Its guards clatter down after it. The cold light gutters out of three pairs of sockets. The dead army below just lost its officers.'],
      effects: [{ kind: 'setFlag', flag: 'wights-down' }, { kind: 'gold', amount: 40 }] },
  },
  'wights-done': {
    id: 'wights-done', kind: 'story', art: { emoji: '⚔️' },
    text: ['The old dead kings lie decommissioned across their stone slabs. The ancient sword you left on the centre slab stays exactly where it is. On the whole, you feel this is the correct arrangement for everyone.'],
    next: [{ id: 'ok', label: 'Onward', to: 'undercrypt' }], noBack: true,
  },
  king: {
    id: 'king', kind: 'battle', encounterId: 'mummy-crypt', mapId: 'corridor',
    intro: [
      'Old masons sealed the king\'s chamber in lead. Something has peeled the lead back like fruit-rind — from the *inside*. Within, a figure in cerements the colour of old honey stands before a wall of names. It strikes through each one with a charred finger.',
      'The embalmed king turns. Whatever the Warden promised him for his service, the Warden clearly paid it in full. The eyes behind the wrappings burn with the settled satisfaction of a creditor. Two of his household dead lurch from the corners, still in their funeral best.',
    ],
    onWin: { to: 'undercrypt', text: ['The king burns from the inside out. His grave-cloths turn to ash in a spiral of embers. His servants drop mid-lurch. The wall of crossed-out names stands behind him. Near the bottom, uncrossed and freshly carved, is one word. **THORNWICK**.'],
      effects: [{ kind: 'setFlag', flag: 'king-down' }, { kind: 'gold', amount: 60 }] },
  },
  'king-done': {
    id: 'king-done', kind: 'story', art: { emoji: '🏺' },
    text: ['Ash and peeled lead mark where the king held court. The wall of names waits for a mason who is never coming. Thornwick\'s entry, you note in passing, remains unstruck. You intend to keep it that way.'],
    next: [{ id: 'ok', label: 'Onward', to: 'undercrypt' }], noBack: true,
  },
  'seal-approach': {
    id: 'seal-approach', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '🚪' },
    text: [
      'The lowest stair ends at the door the frescoes promised. It is a slab of stone the size of a barn wall, veined with lead marks. It bows *outward*, straining, as something on the far side leans its patience against it. The chanting you\'ve heard for an hour resolves into words. Living voices speak them — the dead do not chant.',
      'A congregation of the **living** kneels at the door. They wear robes the colour of grave-worms and hold candles of black tallow. This is the **Cult of the Worm**, come far and fast on the news of a failing seal. Their fanatic stands at the marks with a chisel of bone, prying up the lead one line at a time. A walking suit of ancient armour holds the stair. Two ghouls crouch among the candles like pets.',
      '"Faster," the fanatic tells his chisel, sweetly reasonable. "The Warden is *so near the latch*." The rites of sealing are in your pack. The nerve, as promised, you brought yourselves.',
    ],
    next: [{ id: 'fight', label: 'Interrupt the service', to: 'seal-battle' }],
  },
  'seal-battle': {
    id: 'seal-battle', kind: 'battle', encounterId: 'cult', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The fanatic turns with the chisel still in his hand and rage flooding the sweet reason off his face. "The door opens for the *faithful*!" The armour grinds down the stair. The ghouls come low and fast between the candles. The last fight for the Undercrypt begins at the Warden\'s own threshold.'],
    onWin: { to: 'resealing', text: ['The fanatic dies reaching for the door. For the first time in a very long age, the door finds no one on its outer side. No one stands there except you, and the book.'],
      effects: [{ kind: 'xpToLevel', level: 4 }, { kind: 'setFlag', flag: 'cult-broken' }, { kind: 'gold', amount: 120 }] },
  },
  resealing: {
    id: 'resealing', kind: 'story', art: { imageId: 'loc-dungeon', emoji: '📖' },
    text: [
      'You read the old rites off Halden\'s prayer-book by black candle-light, mispronouncing, in Wren\'s later and much-repeated estimation, "no more than a third of it." The lead marks take the words the way dry ground takes rain. Line by line, the great door stops *straining*.',
      'Last of all comes the pressure behind it. A vast attention withdraws, unhurried and unimpressed, the way a creditor leaves a debtor\'s door: *not forgiven. Deferred.* Somewhere above, across the barrow-field, ten thousand dead lie down where they stand.',
      'It is done. The door stands sealed. The **Warden** sleeps again, and the dead fall still.',
      'The vigil holds. It has a new keeper now — a book, a door, and a town that knows to watch it. It will have to do.',
    ],
    next: [{ id: 'home', label: 'Climb back to the light', to: 'sb-aftermath' }],
  },
  'sb-aftermath': {
    id: 'sb-aftermath', kind: 'story', art: { imageId: 'loc-town', emoji: '🏘️' },
    text: [
      'Wren is still holding the graveyard gate when you come up. She is upright, knife out, surrounded by a great settling field of the finally motionless dead. She wears the expression of someone determined to have been calm the whole time. The walk home is long, wet, and the best walk any of you can remember.',
      'Thornwick reburies its dead in the following days, oldest graves first. The reeve stands bareheaded at every single service. He pays before anyone asks, and counts nothing twice. He shakes each of your hands one entire second longer than protocol requires. For Aldous, this is close to weeping.',
      'Say it plainly, because you earned the right. Your victory over the Reedwife broke the seal and opened these graves. You went into the dark and closed it with your own hands. You fixed what your own triumph broke.',
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
  },
  'sb-defeat': {
    id: 'sb-defeat', kind: 'story', art: { imageId: 'loc-tavern', emoji: '🍺' },
    text: [
      'You wake in the Wander-Inn\'s back room with fen-mud in your ears and Mira\'s bone-broth steaming on the sill. Wren dragged you out — all of you, in relays, which she declines to describe and you decline to press.',
      '"The fen\'s still there," Mira says, which is her way of asking if you\'re going back. You are. She puts the bread where you can reach it.',
    ],
    next: [{ id: 'up', label: 'Back on your feet', to: 'town' }], noBack: true,
  },
  'sb-epilogue': {
    id: 'sb-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'The barrows sleep. The chapel is drained and re-blessed. The corpse-lights are out for good. Thornwick\'s lychyard holds precisely the population it should. The prayer-book lives in the reeve\'s strongest chest. The reeve has promoted Wren again, to her visible horror. She leads the watch that walks the old road once a season.',
      'Only one thing sours the ale. On the last night, at the fen\'s edge, the reeds parted around two figures. They did not walk so much as *arrive* — tall, green-fingered, river-weed in their hair. They were sisters, unmistakably, of a certain late Reedwife. They looked at the resealed barrow-field for a long moment, and then at the town, the way creditors look at a debtor\'s house. Then the reeds closed, and they were gone — for now. Debts, in the deep fen, have a way of *coming due*.',
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
};
