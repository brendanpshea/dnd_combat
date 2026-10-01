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
 * LEVEL BAND 1→3, paced by "acts = levels": required fights carry the leveling
 * and milestones only top up the gap. M1 rides the Act 1 road-out win → L2; M2
 * rides the Act 2 hollow-ambush win → L3, so both level-ups land on a fight the
 * party earned. Required-fight + milestone XP guarantees the floor for a
 * wit-heavy party; a fight-everything run tops out around L4 as the thresholds
 * absorb it. The party fights the boss at L3.
 *
 * MONSTER VARIETY is a goal in itself — this module is a tour of the bestiary,
 * a distinct roster per fight (goblins, human crooks, the marsh's toads and
 * risen dead, a hag-thrall lizardfolk war-party, a bugbear/gnoll gate, a chained
 * ogre pit-brute, kenneled hyenas, and a green-hag-and-warlord finale) across a
 * spread of maps (road, village square, bog ford, ruins, corridor, fire-pit). The connective story explains
 * *why* beasts, undead and lizardfolk fight for "bandits": chief Vargan sold his
 * people's marsh to the Reedwife, a green hag, for coin and monsters.
 */
import type { Module, Scene, Effect, Choice } from '../../adventure/types.js';

/** Learning whose the marsh-things are: the Reedwife reveal. */
const HAG_LEARNED: Effect[] = [
  { kind: 'setFlag', flag: 'know-hag' },
  { kind: 'journal', entry: { id: 'c-hag', kind: 'clue', title: 'The Reedwife',
    body: 'A green hag called the "Reedwife" owns and brands the marsh-creatures that serve the Ashfang. Chief Vargan sold his people\'s marsh to her. She gets caravans and captives. He gets coin and monsters. She waits at the den\'s fire beside him.' } },
];

/** What bringing Wren round buys, whether she goes home or comes along. */
const WREN_SAVED: Effect[] = [
  { kind: 'setFlag', flag: 'saved-scout' }, { kind: 'setFlag', flag: 'scout-met' }, { kind: 'setFlag', flag: 'know-vex' },
  { kind: 'journal', entry: { id: 'npc-wren', kind: 'npc', title: 'Wren, the Scout', body: 'You pulled a reeve\'s scout, Wren, out from under a dead horse on the marsh road. She mapped the den for you.' } },
  { kind: 'journal', entry: { id: 'lead-vex', kind: 'lead', resolvedBy: 'met-vex',
    title: 'Vex, the Lieutenant', body: 'Wren named Vex, the Ashfang chief\'s resentful lieutenant. Seek out his fire inside the den — he may turn on the chief if offered a way out.' } },
];

/**
 * The claims in the square after the chief falls. Each pays out once, shows a
 * one-line result beat, and comes back to the short `aftermath-hub` instead of
 * replaying the homecoming. The bounty is owed to whoever killed the chief; a
 * party that took the 25-gold retainer at the board collects the balance.
 */
const AFTERMATH_CLAIMS: Choice[] = [
  { id: 'bounty', label: 'Claim the reeve\'s bounty for the chief', to: 'claim-bounty',
    requires: [{ kind: 'notFlag', flag: 'bounty' }, { kind: 'notFlag', flag: 'got-bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold', amount: 120 }, { kind: 'setFlag', flag: 'got-bounty' }] },
  { id: 'balance', label: 'Claim the rest of the reeve\'s bounty', to: 'claim-balance',
    requires: [{ kind: 'flag', flag: 'bounty' }, { kind: 'notFlag', flag: 'got-bounty' }], hideWhenBlocked: true,
    effects: [{ kind: 'gold', amount: 95 }, { kind: 'setFlag', flag: 'got-bounty' }] },
  { id: 'banner', label: 'Present the Ashfang banner for the bonus', to: 'claim-banner',
    requires: [{ kind: 'flag', flag: 'looted' }, { kind: 'notFlag', flag: 'got-banner' }],
    effects: [{ kind: 'gold', amount: 60 }, { kind: 'setFlag', flag: 'got-banner' }] },
  { id: 'scout', label: 'Accept the scout\'s thanks, and the reeve\'s reward', to: 'claim-scout',
    requires: [{ kind: 'flag', flag: 'saved-scout' }, { kind: 'notFlag', flag: 'got-scout' }],
    effects: [{ kind: 'gold', amount: 50 }, { kind: 'setFlag', flag: 'got-scout' }] },
  { id: 'done', label: 'Raise a glass at the Wander-Inn', to: 'epilogue' },
];


// NPCs name a reusable archetype `portraitId` (src/data/adventure-art.ts) so
// they share art with every other module's innkeeper / scout / captain; the
// emoji is the fallback until that portrait is generated.
const MIRA = { id: 'npc-mira', name: 'Mira the Innkeeper', portraitId: 'npc-innkeeper', emoji: '🍺' };
const SCOUT = { id: 'npc-scout-hr', name: 'Wounded Scout', portraitId: 'npc-wounded', emoji: '🤕' };
const LIEUTENANT = { id: 'npc-vex', name: 'Vex, the Lieutenant', portraitId: 'npc-captain', emoji: '🗡️' };

const scenes: Record<string, Scene> = {
  // === ACT 0 — THE VALLEY ROAD (cold open: a fight in the first minute) ===
  // The module leads with combat, not conversation: an ambush that teaches the
  // battle UI (it's the first fight, so the tutorial fires) and names the enemy
  // — the raiders declare for the Ashfang chief before you ever reach town.
  road: {
    id: 'road', kind: 'story', art: { imageId: 'loc-road', emoji: '🛤️' },
    text: [
      'A day\'s hard walk up the valley. The country has gone wrong-quiet. The road holds no carters and no herders. Only crows lift off the hedgerows as you pass.',
      'Thornwick lies an hour ahead, its chimney-smoke thin against the grey hills. You carry the reeve\'s bounty folded in your pack. The plea that hung beneath it is why you kept walking.',
      'Then the hedges shift on both sides at once — and it\'s already too late to run.',
    ],
    next: [{ id: 'go', label: 'Draw steel', to: 'road-ambush' }], noBack: true,
  },
  'road-ambush': {
    id: 'road-ambush', kind: 'battle', encounterId: 'raiders-forward', mapId: 'open',
    intro: [
      'Raiders scramble out of the ditch. An orc hefts a notched axe. A lean scout nocks an arrow. A bandit is already grinning.',
      '"The road\'s the **Ashfang\'s** now!" the bandit crows. "Chief takes his cut of every throat on it — and yours\'ll do just fine."',
    ],
    onWin: { to: 'road-reveal', text: ['The bandit drops into the mud, and the road is yours again — for now.'] },
    // Losing the very first fight must not skip the arrival in Thornwick (the
    // module's defeat scene wakes you at Mira's hearth before you've met her).
    onLoss: { to: 'road-carter', text: ['The world goes grey, then black.'] },
  },
  'road-carter': {
    id: 'road-carter', kind: 'story', art: { imageId: 'loc-road', emoji: '🛒' },
    text: [
      'You wake on a bed of turnips, rocking gently. An old carter glances back from his seat. "Found you face-down in the ditch," he says. "The Ashfang left you for dead. Lucky for you, they\'re poor judges of it."',
      'He points his whip at the hills, where a thin smudge of smoke rises past the marsh. "That\'s their den up there. Nobody goes near it." Ahead, the roofs of Thornwick come into view.',
    ],
    next: [{ id: 'on', label: 'Ride the last mile into Thornwick', to: 'thornwick',
      effects: [{ kind: 'setFlag', flag: 'road-ambushed' },
        { kind: 'journal', entry: { id: 'c-ashfang', kind: 'clue', title: 'The Ashfang Own the Valley',
          body: 'Ashfang raiders ambushed you on the road and left you for dead. A carter brought you to Thornwick and showed you their smoke, rising in the hills past the marsh.' } }] }],
    noBack: true,
  },
  'road-reveal': {
    id: 'road-reveal', kind: 'story', art: { imageId: 'loc-road', emoji: '🩸' },
    text: [
      'The bandit isn\'t dead yet. He laughs wetly through red teeth as you stand over him.',
      '"You think you\'ve done something? There\'s more of us in the hollow than you\'ve got arrows — and the **chief**, he don\'t even answer to himself no more. There\'s something *in the marsh* he feeds, and it feeds him back. The **Ashfang** own this whole valley now, and worse than us owns them."',
      'His eyes drift to the hills, to a thin smudge of smoke rising somewhere past the marsh. Then they drift to nothing at all.',
    ],
    next: [{ id: 'on', label: 'Press on to Thornwick', to: 'thornwick',
      effects: [{ kind: 'setFlag', flag: 'road-ambushed' },
        { kind: 'journal', entry: { id: 'c-ashfang', kind: 'clue', title: 'The Ashfang Own the Valley',
          body: 'Raiders ambushed you on the road, boasting of an Ashfang chief who dens in the hills past the marsh — you saw his smoke rise for yourself. They are many, and they answer to him.' } }] }],
  },

  // === ACT 1 — THORNWICK (village hub) ===================================
  thornwick: {
    id: 'thornwick', kind: 'story', art: { imageId: 'loc-village', emoji: '🏘️' },
    text: [
      'The road brings you into **Thornwick** at last. Its gate is scorched and its shutters barred. Faces watch you pass from the dark of doorways.',
      'So it is true. For a month the **Ashfang** have bled this valley dry, and the whole country locks its doors by dark.',
    ],
    next: [{ id: 'go', label: 'Enter the Wander-Inn', to: 'tavern-meet' }],
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
      'Inside the **Wander-Inn** the fire is low and the talk lower. A broad woman with flour to the elbow sets down her cloth, looks you over once, and evidently decides you\'ll do.',
      '"Sellswords. Good." **Mira** doesn\'t smile — you get the feeling she keeps it somewhere safe, for special occasions. "The reeve\'s too proud to beg, so I do it for him. Sit."',
      '"The **Ashfang** came down the **marsh road**, out past the reeds. Everyone knows that much. Knowing it never once filled a burned cart back up. But there\'s more — the kind folk won\'t say with the door open."',
    ],
    next: [{ id: 'sit', label: 'Pull up a stool', to: 'tavern',
      effects: [{ kind: 'journal', entry: { id: 'q-main', kind: 'quest', title: 'Break the Ashfang', body: 'Mira, who keeps the Wander-Inn, begged your help against the Ashfang raiders bleeding Thornwick dry. Find where they den. Ask around the market and the marsh road, then end them.' } }] }],
    noBack: true,
  },
  tavern: {
    id: 'tavern', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: ['**Mira** leans on the bar and waits for you to say something useful.'],
    next: [
      { id: 'insight', label: '[Insight DC 12] Read what she isn\'t saying', to: 'tavern-spy',
        once: true, check: { skill: 'insight', dc: 12, failTo: 'tavern-blank' } },
      { id: 'persuade', label: '[Persuasion DC 12] Buy the whole room a round (3 gold)', to: 'tavern-trail',
        once: true, requires: [{ kind: 'gold', atLeast: 3 }], effects: [{ kind: 'gold', amount: -3 }],
        check: { skill: 'persuasion', dc: 12, failTo: 'tavern-round-flat' } },
      { id: 'plain', label: 'Just ask the road to the den', to: 'tavern-plain', once: true },
      // The rumor table: an optional, in-character tutorial any player can skip.
      // Each regular teaches one real mechanic; kept as its own loop so it never
      // gets in the way of the plot choices above.
      { id: 'regulars', label: 'Drift over to the regulars\' table', to: 'regulars' },
      // A paid long rest: cheap, but a real gold sink and the place to re-prepare
      // spells. Gated on having the coin; the effect deducts it before resting.
      { id: 'room', label: 'Take a room for the night — 1 gold (long rest)', to: 'inn-rest',
        requires: [{ kind: 'gold', atLeast: 1 }], effects: [{ kind: 'gold', amount: -1 }] },
      { id: 'leave', label: 'Step out into the square', to: 'square' },
    ],
  },
  'inn-rest': {
    id: 'inn-rest', kind: 'rest', variant: 'long', next: 'tavern',
    intro: ['You take a room above the taproom. For the first time in days you sleep behind a bolted door — and wake clear-headed, wounds closed, spells fresh.'],
  },
  'tavern-spy': {
    id: 'tavern-spy', kind: 'story', art: { emoji: '👁️' },
    text: [
      '**Mira** reads the doubt on your face and lowers her voice until it barely carries over the fire.',
      '"The **Ashfang** always seem to know which wagon\'s worth taking. Someone here feeds them word of every caravan that leaves — and I think I know who."',
      '"There\'s a **furtive peddler** who sets up by the **market**, near the gate. Sells nothing, buys nothing, but he\'s there every time a train rolls out. Watch him. If anyone\'s carrying word to the raiders, it\'s him."',
    ],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern',
      effects: [{ kind: 'setFlag', flag: 'know-spy' },
        { kind: 'journal', entry: { id: 'lead-spy', kind: 'lead', resolvedBy: 'spy-caught',
          title: 'The Furtive Peddler', body: 'Mira named a peddler who loiters by the market gate as the raiders\' informant. Find him in Thornwick Square and deal with him.' } }] }],
  },
  'tavern-trail': {
    id: 'tavern-trail', kind: 'story', art: { emoji: '🗺️' },
    text: [
      'A round on your coin loosens the whole room. An old trapper drags a finger through spilled ale, sketching the **marsh road** across the bar.',
      '"Here\'s the reeds, here\'s the deep water — and here," he taps a hollow in the hills, "is where their smoke rises of a morning. That\'s your den. Mind, the **trail** bites back long before you reach it."',
    ],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern',
      effects: [{ kind: 'setFlag', flag: 'trail-known' }] }],
  },
  'tavern-plain': {
    id: 'tavern-plain', kind: 'story', art: { emoji: '🍺' },
    text: ['"The marsh road, then. Mind yourself." She turns back to her taps.'],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern' }],
  },
  'tavern-blank': {
    id: 'tavern-blank', kind: 'story', art: { emoji: '🍺' },
    text: ['"Whatever you think you see on my face, it\'s flour." Mira turns back to her taps.'],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern' }],
  },
  'tavern-round-flat': {
    id: 'tavern-round-flat', kind: 'story', art: { emoji: '🍻' },
    text: ['The room drinks your round and thanks you kindly. Then the talk turns to the weather. Nobody wants to be the one who mentions the marsh.'],
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
    id: 'regulars', kind: 'story', art: { emoji: '🍻' },
    text: ['Thornwick\'s older hands have claimed the long table by the fire — the sort who\'ve survived enough to have firm opinions about how. They\'ll talk your ear clean off, if you let them. Some of it might even keep you breathing.'],
    next: [
      { id: 'tactics', label: 'Ask the old sergeant how a real fight goes', to: 'rumor-tactics', once: true },
      { id: 'magic', label: 'Ask the hedge-witch about working spells', to: 'rumor-magic', once: true },
      { id: 'weapons', label: 'Ask the caravan veteran about her axe', to: 'rumor-weapons', once: true },
      { id: 'back', label: 'Leave them to their ale', to: 'tavern' },
    ],
  },
  'rumor-tactics': {
    id: 'rumor-tactics', kind: 'story', art: { emoji: '🛡️' },
    text: [
      'A grey-bearded man with a soldier\'s too-straight back taps the boards. "Rule one, and it\'s the reason I\'ve still got both legs: don\'t turn your back on a man with a blade in reach. Step away careless and he gets a free cut at you — an *opportunity*, they call it."',
      '"Want out of a scrap without the parting gift? *Disengage* — costs you your whole action, but you walk clear and nobody swings. Especially you wand-wavers: get clear before you start your muttering, or you\'ll be eating steel halfway through the word."',
    ],
    next: [{ id: 'ok', label: 'Nod your thanks', to: 'regulars' }],
  },
  'rumor-magic': {
    id: 'rumor-magic', kind: 'story', art: { emoji: '🔮' },
    text: [
      'A woman with river-stones braided into her hair doesn\'t look up from her knitting. "Magic\'s never free, whatever the college boys tell you. Your real spells burn *slots*, and you\'ve precious few. Spend them like your last coppers — because in a long fight, that\'s what they are."',
      '"And the strong workings. A held foe, a ward of blades. You\'ve to *concentrate* to keep them lit. Take a hard knock and you\'d best hold your focus or the whole thing comes apart in your hands. Can\'t hold two at once, either. So pick the one that\'ll matter."',
    ],
    next: [{ id: 'ok', label: 'Nod your thanks', to: 'regulars' }],
  },
  'rumor-weapons': {
    id: 'rumor-weapons', kind: 'story', art: { emoji: '⚔️' },
    text: [
      'A scarred caravan guard rolls her axe over on the table. "Every weapon\'s got a trick in it, if you know how to ask. A heavy blade *cleaves* — bite one man and the swing carries on into the next. A mace\'ll *sap* a foe, so his next swing at you goes wide."',
      '"Learn what the thing in your hand actually *does*. That\'s how you put down men twice your size."',
    ],
    next: [{ id: 'ok', label: 'Nod your thanks', to: 'regulars' }],
  },

  square: {
    id: 'square', kind: 'explore',
    map: {
      title: 'Thornwick Square', theme: 'stone', art: { imageId: 'loc-village', emoji: '⛲' },
      camp: {}, // safe: rest freely in town
      // Overworld dressing: the party pawn arrives at the inn, and lanes link
      // the stops so the square reads as one place, not floating markers.
      entry: ['inn'],
      roads: [
        ['inn', 'market'], ['market', 'board'], ['inn', 'mill'],
        ['market', 'informant'], ['informant', 'gate'], ['board', 'gate'],
      ],
      nodes: [
        { id: 'inn', x: 20, y: 30, label: 'The Wander-Inn', icon: 'tok-tavern', scene: 'tavern' },
        { id: 'market', x: 40, y: 40, label: 'Market', icon: 'tok-market', scene: 'market' },
        { id: 'board', x: 70, y: 28, label: 'Notice Board', icon: 'tok-notice', scene: 'board' },
        // Optional side bounty: honest early XP for a party that helps out.
        { id: 'mill', x: 12, y: 62, label: 'The Old Mill', icon: 'tok-figure', scene: 'mill',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'mill-saved' }], to: 'mill-done' }] },
        // The peddler is always here to be dealt with (the tavern Insight just
        // names him early). Confronting him always ends in a fight — and the
        // gate below won't open until he's caught, so no party skips it.
        { id: 'informant', x: 48, y: 66, label: 'Furtive Peddler', icon: 'tok-figure', scene: 'spy-confront',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'spy-caught' }], to: 'spy-gone' }] },
        { id: 'gate', x: 82, y: 78, label: 'Leave for the Marsh Road', icon: 'tok-gate', scene: 'trailhead',
          sceneWhen: [{ if: [{ kind: 'notFlag', flag: 'spy-caught' }], to: 'gate-blocked' },
            // The road out was fought (or faced down) already: don't replay it.
            { if: [{ kind: 'visited', scene: 'trail' }], to: 'trailhead-clear' }] },
      ],
    },
  },
  market: { id: 'market', kind: 'shop', title: 'Thornwick Market', next: 'square',
    npc: { id: 'npc-quartermaster', name: 'Bram the Quartermaster', portraitId: 'npc-merchant', emoji: '🧑‍🌾' },
    intro: ['"Coin\'s coin, and I\'ll not ask where yours has been." **Bram** plants both hands on the stall. "Buying, or selling? Prices are honest — a dead customer never comes back for more, and I do like the repeat trade."'] },
  board: {
    id: 'board', kind: 'story', art: { emoji: '📜' },
    text: [
      'A bounty, nailed up and gone grey at the edges. The reeve will pay good coin for proof the **Ashfang chief** is dead. He will pay better coin still for their banner brought back whole.',
      'Someone has added a line at the bottom in a smaller, prouder hand — *"Thornwick does not beg. It pays its debts."* That ink is newer than the rest.',
    ],
    next: [
      // `once` so the reeve's retainer can't be re-claimed by revisiting the board.
      { id: 'ok', label: 'Take the reeve\'s retainer up front (25 gold)', to: 'square', once: true,
        effects: [{ kind: 'setFlag', flag: 'bounty' }, { kind: 'gold', amount: 25 },
          { kind: 'journal', entry: { id: 'c-bounty', kind: 'clue', title: 'The Reeve\'s Bounty', body: 'The reeve pays for the Ashfang chief dead, and pays extra for their banner brought back as proof. You took the retainer up front.' } }] },
      { id: 'leave', label: 'Leave it for now', to: 'square' },
    ],
  },
  'spy-confront': {
    id: 'spy-confront', kind: 'dialogue', npc: { id: 'npc-peddler', name: 'The Peddler', portraitId: 'npc-merchant', emoji: '🕵️' },
    art: { emoji: '🕵️' },
    lines: [
      'The peddler\'s stall is a marvel of things nobody wants — chipped buttons, one good boot, a birdcage with no bird. He watches the gate the way a cat watches a mousehole.',
      'When your shadow falls across his goods he goes very still. Then he does the last thing you expected of a man selling buttons. He puts two fingers to his teeth and *whistles*. All round the square, hard-faced men start setting down their drinks. This won\'t end with words.',
    ],
    next: [
      { id: 'investigate', label: '[Investigation DC 13] Pick his crew out of the crowd first', to: 'spy-ambush',
        once: true, check: { skill: 'investigation', dc: 13, failTo: 'spy-bolts' } },
      { id: 'intimidate', label: '[Intimidation DC 14] Shout down the hired help before they close', to: 'spy-ambush',
        once: true, check: { skill: 'intimidation', dc: 14, failTo: 'spy-bolts' } },
      { id: 'brace', label: 'Put your backs to the wall and draw', to: 'spy-bolts' },
    ],
  },
  'spy-caught': {
    id: 'spy-caught', kind: 'story', art: { emoji: '🔗' },
    text: [
      'His crew is gone, one way or another. The peddler makes it four steps before you run him down.',
      'Under the false bottom of his cart lies a tally of every caravan to leave Thornwick this month. It isn\'t in his handwriting. He folds like wet paper. "I only carried word! I never lifted a blade!"',
      'Then, babbling, he gives up the rest. **He tells you the raiders\' gate-signal.** With it, you can walk up to the den like one of their own.',
    ],
    next: [{ id: 'ok', label: 'Hand him to the reeve', to: 'square',
      effects: [{ kind: 'setFlag', flag: 'spy-caught' }, { kind: 'setFlag', flag: 'know-signal' }, { kind: 'gold', amount: 40 },
        { kind: 'journal', entry: { id: 'c-signal', kind: 'clue', title: 'The Watch-Signal', body: 'You caught the Ashfang\'s informant in the market and took the raiders\' gate signal off him. With it, you can fool the den\'s watch.' } }] }],
  },
  'gate-blocked': {
    id: 'gate-blocked', kind: 'story', art: { imageId: 'loc-village', emoji: '🚧' },
    text: ['The gate-warden lays his spear across the road and shakes his head, not unkindly. "Reeve\'s orders, and for once they\'re sound ones. Nobody leaves while the Ashfang still keep a whistler in the **market**, counting who comes and goes. Deal with that first — then the road\'s yours."'],
    next: [{ id: 'ok', label: 'Back into the square', to: 'square' }], noBack: true,
  },
  // --- Optional: the mill bounty (Act 1 side fight) ------------------------
  mill: {
    id: 'mill', kind: 'dialogue', npc: { id: 'npc-miller', name: 'Osk the Miller', portraitId: 'npc-commoner', emoji: '🌾' },
    art: { emoji: '🌾' },
    lines: [
      'The mill\'s sails hang still, and the miller meets you at a barred door with a boat-hook in both hands. "Not raiders, this one. Something\'s roosting in my hedgerows — turned my dog stiff as a fencepost. *Stone*, you understand. Won\'t nobody come near the mill now, and the grain\'s standing."',
      '"Clear them out and there\'s coin in it. Just — don\'t let the ugly things *touch* you."',
    ],
    next: [
      { id: 'help', label: 'Beat the hedgerows', to: 'mill-fight' },
      { id: 'later', label: 'Another time', to: 'square' },
    ],
  },
  'mill-fight': {
    id: 'mill-fight', kind: 'battle', encounterId: 'cockatrice-flock', mapId: 'open',
    intro: ['Two bat-winged things explode out of the hedge in a fury of beak and scale — cockatrices, all claws and temper. Mind the bite: flesh that takes it goes to stone.'],
    onWin: { to: 'square', text: ['The second cockatrice flops still. The miller pays up gladly, prods the stone dog, and allows that it makes a fair garden ornament.'],
      effects: [{ kind: 'setFlag', flag: 'mill-saved' }, { kind: 'gold', amount: 35 }] },
  },
  'mill-done': {
    id: 'mill-done', kind: 'story', art: { emoji: '🌾' },
    text: ['The mill\'s sails are turning again. The miller waves from the door — and the stone dog keeps its vigil by the gate, forever pointing at nothing.'],
    next: [{ id: 'ok', label: 'Back to the square', to: 'square' }], noBack: true,
  },

  'spy-bolts': {
    id: 'spy-bolts', kind: 'battle', encounterId: 'cutpurses', mapId: 'village',
    intro: ['His crew shoulders out of the market crowd — a fixer and two hired knives, blades already low and level. No surprises left; just the work.'],
    onWin: { to: 'spy-caught', text: ['The fixer goes down, and the hired help drops its knives and its nerve together, and runs.'] },
    parley: {
      skill: 'deception', dc: 13, label: 'Tell the knives the watch is coming',
      success: { to: 'spy-caught', text: ['"The reeve\'s men are two stalls behind us," you say, loud enough to carry, and glance past them as if you can see the pikes. The hired knives do the sums faster than their fixer does. They are gone into the crowd before he turns round. Alone, the fixer raises his empty hands and backs off into the market.'] },
    },
  },
  'spy-ambush': {
    id: 'spy-ambush', kind: 'battle', encounterId: 'cutpurses', mapId: 'village',
    surprise: 'enemies', // you read the ambush first — the crew loses its opening round
    intro: ['The crew moves in from the stalls a beat too late. You\'re already where they didn\'t expect you, and they scramble.'],
    onWin: { to: 'spy-caught', text: ['Off balance from the first, the crew never finds its feet. The fixer falls, and his hired blades throw down and bolt.'] },
  },

  // === ACT 2 — THE MARSH ROAD (wilderness) ==============================
  trailhead: {
    id: 'trailhead', kind: 'story', art: { imageId: 'loc-road', emoji: '🛤️' },
    text: [
      'The peddler is in the reeve\'s cells now. The gate-warden stands aside, and **Thornwick** falls away behind you. Ahead the road narrows toward the **marsh**. It is a ribbon of mud between dark pools and whispering reeds.',
      'Somewhere out in that maze the **Ashfang** keep their den. Somewhere a good deal closer, it seems, they keep their eyes on the road.',
    ],
    next: [{ id: 'go', label: 'Set out on the marsh road', to: 'road-out' }],
  },
  'trailhead-clear': {
    id: 'trailhead-clear', kind: 'story', art: { imageId: 'loc-road', emoji: '🛤️' },
    text: ['The gate-warden waves you through. The marsh road lies quiet now. The goblins you met on it have not come back.'],
    next: [{ id: 'go', label: 'Out along the marsh road', to: 'trail' }],
  },
  'road-out': {
    id: 'road-out', kind: 'battle', encounterId: 'goblin-outriders', mapId: 'open',
    intro: ['Barely a mile from the gate, the reeds erupt. The Ashfang keep goblin outriders on the road, and word of you has run ahead. A wiry goblin boss lopes out in front of his pack. His scimitar is bared, and he cackles something in Goblin that needs no translation.'],
    // Milestone M1 rides on this fight's win: surviving the road out of town is
    // what dings the party to 2nd level, so the level-up lands on a fight it
    // earned rather than out of nowhere. road-out is on the one-way path into the
    // marsh, so the grant fires exactly once.
    onWin: { to: 'trail', text: ['The goblin pack breaks and vanishes into the reeds. Behind you Thornwick; ahead, the marsh swallows the road whole. You feel steadier on your feet than a week ago — hardened, and a shade deadlier.'],
      effects: [{ kind: 'xpToLevel', level: 2 }] },
    parley: {
      skill: 'intimidation', dc: 13, label: 'Stare down the goblin boss',
      success: { to: 'trail', text: ['You hold his eye and draw steel slow, and let him count your blades. The cackle dies in his throat. He barks something at his pack, and they melt back into the reeds as if they were never there. You have learned something new on this road. Sometimes a fight can end before it starts.'],
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
            { if: [{ kind: 'flag', flag: 'saved-scout' }, { kind: 'companion', companion: 'wren' }], to: 'scout-along' },
            { if: [{ kind: 'flag', flag: 'saved-scout' }], to: 'scout-sent' },
            { if: [{ kind: 'flag', flag: 'scout-met' }], to: 'scout-gone' }] },
        // Optional: a sunken barrow, spotted only by a sharp-eyed party.
        { id: 'barrow', x: 52, y: 90, label: 'A Sunken Barrow', mystery: 'A low mound…', icon: 'tok-cave', scene: 'barrow',
          hidden: { dc: 12 },
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'barrow-cleared' }], to: 'barrow-done' }] },
        // Optional: a webbed thicket — plainly dangerous, plainly avoidable.
        { id: 'thicket', x: 66, y: 70, label: 'Webbed Thicket', mystery: 'Pale shapes in the reeds…', icon: 'tok-tree', scene: 'thicket',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'thicket-cleared' }], to: 'thicket-done' }] },
        { id: 'ravine', x: 52, y: 46, label: 'Sunken Ravine', icon: 'tok-crossing', scene: 'ravine',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'crossed-ravine' }], to: 'ravine-done' }],
          wandering: { chance: 0.5, battleScene: 'bog-toads' } },
        { id: 'approach', x: 82, y: 34, label: 'The Hollow Ahead', icon: 'tok-cave', scene: 'ambush',
          requires: [{ kind: 'flag', flag: 'trail-read' }],
          // Once the ambush is broken the hollow is a walk, not a re-fightable
          // reward loop — the return trip from a den retreat passes through
          // quietly instead of re-rolling the battle (and its XP/treasure).
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'know-hag' }], to: 'hollow-quiet' }] },
      ],
    },
  },
  tracks: {
    id: 'tracks', kind: 'check', skill: 'survival', dc: 12, art: { emoji: '👣' },
    intro: ['Boot-prints and drag-marks cross the mud. Read them right and the maze unravels.'],
    success: { to: 'trail', text: ['The tracks tell their whole story: a heavy patrol out at dusk, a lighter one back at dawn, always the same dry line through the reeds. You\'ve found the **safe path to the hollow**.'],
      effects: [{ kind: 'setFlag', flag: 'trail-read' }, { kind: 'xp', amount: 20 }] },
    failure: { to: 'trail', text: ['The prints tangle and double back on themselves until your eyes water. Still, they point roughly toward the hills. That\'s enough to find the hollow by, if not the driest way there.'],
      effects: [{ kind: 'setFlag', flag: 'trail-read' }] },
  },
  'tracks-done': {
    id: 'tracks-done', kind: 'story', art: { emoji: '👣' },
    text: ['The mud has told you all it can. Nothing new has passed this way since.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'trail' }], noBack: true,
  },
  'tracks-mapped': {
    id: 'tracks-mapped', kind: 'story', art: { emoji: '🗺️' },
    text: ['The old trapper\'s ale-sketch was a good one. The reeds, the pools and the hollow in the hills all line up with the mud. The patrols\' dry line runs just where his finger traced it.'],
    next: [{ id: 'ok', label: 'Follow the trapper\'s line', to: 'trail',
      effects: [{ kind: 'setFlag', flag: 'trail-read' }, { kind: 'xp', amount: 20 }] }],
    noBack: true,
  },
  'hollow-quiet': {
    id: 'hollow-quiet', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🌾' },
    text: ['The hollow lies quiet where you broke the Reedwife\'s ambush. Only flattened reeds and still water remain. The den\'s wooden wall waits ahead.'],
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
    intro: ['A collapsed ravine cuts the trail. The far side is close — but the gap is loose stone and broken rock. There\'s more than one way across.'],
    // `perApproach`: a botched climb doesn't strand you — you can still scramble
    // the rubble or take the slow way round. Only when every line fails do you
    // lose the hour outright.
    retry: 'perApproach',
    approaches: [
      { id: 'climb', label: 'Climb it head-on', hint: 'Muscle up the sheer face — fastest, if you don\'t fall.',
        skill: 'athletics', dc: 13,
        success: { to: 'trail', text: ['You haul the party up and over, hand over hand.'],
          effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'xp', amount: 30 }] },
        failure: { to: 'ravine', text: ['A hold crumbles and you slide back down in a clatter of stone. That way will not work.'] } },
      { id: 'scramble', label: 'Pick across the rubble', hint: 'Balance over the loose stone where it has fallen shallowest.',
        skill: 'acrobatics', dc: 12,
        success: { to: 'trail', text: ['Light on your feet, you thread the shifting stones and reach the far lip.'],
          effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'xp', amount: 30 }] },
        failure: { to: 'ravine', text: ['The loose stone gives all at once and you scramble back before it takes an ankle with it.'] } },
      { id: 'detour', label: 'Find the long way round', hint: 'Read the ground for a safe line — slower, but no broken bones.',
        skill: 'survival', dc: 11,
        success: { to: 'trail', text: ['You trace a gentler slope downstream and lead the party around dry-shod. It costs time, but nothing else.'],
          effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'xp', amount: 15 }] } },
    ],
    // Reached only if every line of attack fails (or is spent).
    success: { to: 'trail', effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }] },
    failure: { to: 'trail', text: ['Every way across fights you. In the end you give up the hour and take the long, muddy detour — bruised and behind schedule.'],
      effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }] },
  },
  'ravine-done': {
    id: 'ravine-done', kind: 'story', art: { emoji: '🪨' },
    text: ['The broken ravine lies behind you now, already crossed. Nothing waits here but the wind over the loose stone.'],
    next: [{ id: 'ok', label: 'Press on', to: 'trail' }], noBack: true,
  },
  wounded: {
    id: 'wounded', kind: 'dialogue', npc: SCOUT, art: { emoji: '🤕' },
    lines: ['A young scout in the reeve\'s colours lies pinned under a dead horse, an arrow through her leg, her jaw set hard against the pain. "I\'m fine," she says — a lie you can see from here. "Get the horse off me and I\'ll tell you everything. How they\'re set, where they watch. I counted. That\'s the job."'],
    next: [
      { id: 'medicine', label: '[Medicine DC 12] Ease her out and bind the leg', to: 'scout-saved',
        once: true, check: { skill: 'medicine', dc: 12, failTo: 'scout-fail' } },
      { id: 'leave', label: 'No time to spare her — press on', to: 'trail' },
    ],
  },
  'scout-saved': {
    id: 'scout-saved', kind: 'story', art: { emoji: '❤️‍🩹' },
    text: [
      'The horse comes off and the bleeding stops, and the scout lets out a breath she looks like she\'d been saving all week. "**Wren**," she offers, as if admitting to a name costs her something. She scratches the den\'s watch-posts into the mud, quick and exact. She really did count.',
      '"One thing more, and then I owe you twice over." She catches your wrist. "There\'s a man in there hates the chief worse than you do — **Vex**, the lieutenant. Offer him a way out when you reach his fire, and he might stand his guards aside instead of setting them at your throat."',
    ],
    next: [
      { id: 'ok', label: 'Send Wren back to Thornwick', to: 'trail', effects: WREN_SAVED },
      // The Gold Box guide: she knows the marsh, and she owes you twice over.
      { id: 'come', label: 'Ask Wren to come with you through the marsh', to: 'wren-joins',
        effects: [...WREN_SAVED, { kind: 'joinParty', companion: 'wren' }] },
    ],
  },
  'wren-joins': {
    id: 'wren-joins', kind: 'story', art: { emoji: '🧭' },
    text: ['Wren tests the bound leg, winces, and decides it will do. "Someone has to keep you out of the sinkholes." She takes up her bow. "As far as their gate. Then I go for the reeve\'s men, and you had better still be alive when I get back."'],
    next: [{ id: 'go', label: 'Into the marsh, with Wren leading', to: 'trail' }],
  },
  // She came as far as she said she would.
  'wren-parts': {
    id: 'wren-parts', kind: 'story', art: { imageId: 'loc-camp', emoji: '🧭' },
    text: ['At the tree line above the hollow Wren stops, and eases her weight off the leg. "This is as far as I said." She counts the watch-posts one last time, lips moving. "Reeve\'s men by nightfall, if I run. Leave me something to arrest."'],
    next: [{ id: 'go', label: 'Let her go, and face the gate', to: 'gate',
      effects: [{ kind: 'leaveParty', companion: 'wren' }] }],
  },
  'scout-fail': {
    id: 'scout-fail', kind: 'story', art: { emoji: '🩸' },
    text: [
      'The arrow went deeper than it looked, and she knows it before you do. She presses her last healing potion into your hand. "Too late for me. Take it in there with you."',
      'A minute later she is gone. She never told you her name.',
    ],
    next: [{ id: 'ok', label: 'Cover her and go', to: 'trail',
      effects: [{ kind: 'setFlag', flag: 'scout-met' }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 }] }],
  },
  // "Already done" beats: a finished location shows this instead of replaying
  // its full scene (the explore node's sceneWhen routes here once its flag set).
  'scout-gone': {
    id: 'scout-gone', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    text: ['The dead horse still lies across the trail, flies rising in the heat. Beside it is the low mound of reeds where you covered the scout. Nothing more remains for you here.'],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'scout-along': {
    id: 'scout-along', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    text: ['The dead horse still lies across the trail. Wren walks past it without looking. "He was a good horse," she says, too quickly. "Come on."'],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'scout-sent': {
    id: 'scout-sent', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    text: ['The dead horse still lies across the trail, flies rising in the heat. Wren is long gone, limping to Thornwick for the reeve\'s men. Nothing more remains for you here.'],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'spy-gone': {
    id: 'spy-gone', kind: 'story', art: { imageId: 'loc-village', emoji: '🕳️' },
    text: ['The peddler\'s stall stands bare, its awning taken down. He sits in the reeve\'s cells now, and the square has already moved on.'],
    next: [{ id: 'ok', label: 'Turn back to the square', to: 'square' }], noBack: true,
  },
  // --- Optional: the sunken barrow (Act 2 side fight, undead teaser) -------
  barrow: {
    id: 'barrow', kind: 'story', art: { emoji: '🪦' },
    text: [
      'Half-swallowed by the reeds is a barrow-mound older than any kingdom you could name. Its capstone is cracked and weeping cold air. The marsh has been chewing at it for centuries. Lately, something below has been pushing at the capstone, and something else has been pushing it back down.',
      'Grave-goods glint in the dark below. So does something that moves without touching the water.',
    ],
    next: [
      { id: 'in', label: 'Go down into the dark', to: 'barrow-fight' },
      { id: 'leave', label: 'Leave the dead their peace', to: 'trail' },
    ],
  },
  'barrow-fight': {
    id: 'barrow-fight', kind: 'battle', encounterId: 'specter-haunt', mapId: 'corridor',
    intro: ['The cold answers you. Two shapes pour up out of the grave-earth. They were men once, and now they are nothing but spite and winter air. They pass *through* the barrow stones to reach you.'],
    onWin: { to: 'trail', text: ['The specters shred into cold mist. Among the grave-goods you find honest silver — and leave the rest, on balance, where it lies.'],
      effects: [{ kind: 'setFlag', flag: 'barrow-cleared' }, { kind: 'gold', amount: 45 }] },
  },
  'barrow-done': {
    id: 'barrow-done', kind: 'story', art: { emoji: '🪦' },
    text: ['The barrow lies quiet now, its cold spent. Whatever walked here walks no more.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'trail' }], noBack: true,
  },

  // --- Optional: the webbed thicket (Act 2 side fight — hard, telegraphed) --
  thicket: {
    id: 'thicket', kind: 'story', art: { emoji: '🕸️' },
    text: [
      'Pale silk sheets the reeds ahead, and they have gone grey and still. Bundles hang in the webbing at the height a man\'s shoulders would be. Some of the bundles are man-shaped.',
      'Whatever spins here has been eating well off the Ashfang\'s road. It is not small, and there is more than one of it. But those cocoons will have purses.',
    ],
    next: [
      { id: 'in', label: 'Cut your way in', to: 'thicket-fight' },
      { id: 'leave', label: 'Give the webs a wide berth', to: 'trail' },
    ],
  },
  'thicket-fight': {
    id: 'thicket-fight', kind: 'battle', encounterId: 'spiders', mapId: 'marsh',
    intro: ['The silk trembles — then the reeds themselves seem to stand up and walk. Giant spiders, four of them, drop from the high webbing on every side. They are quick, and their bite carries venom.'],
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
    onWin: { to: 'ravine', text: ['The second toad shudders and goes still, half in the water. You scrape the slime off and press on — the ravine still waits.'] },
  },
  'camp-ambush': {
    id: 'camp-ambush', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'marsh-dead', mapId: 'bog',
    intro: ['You wake to a wet, dragging sound in the dark. The marsh gives up its dead: two ghouls claw up out of the mire, jaws working, and come for the firelight. No time to ready anything — you fight with what you\'ve got.'],
    onWin: { to: '@hub', text: ['The dead lie still again — but the night\'s ruined, and no one\'s resting now. You got no good of that rest. If you want sleep, you\'ll have to start over.'] },
  },
  ambush: {
    id: 'ambush', kind: 'check', skill: 'perception', dc: 13, roller: 'group', art: { emoji: '⛰️' },
    intro: ['The hollow opens below, and the reeds are too still. They are cold where the marsh should be warm. Nothing moves. That is the trouble. Whoever spots what is waiting first decides everything.'],
    // The perception check only sets the terms (surprise); Milestone M2 rides the
    // battle's win, so 3rd level is earned in the fight, not handed over — and the
    // hollow ambush is the one route to the den (approach needs trail-read from
    // the tracks), so it never gets skipped.
    success: { to: 'ambush-turned', text: ['You catch the gleam of an eye among the reeds a breath before it moves. The trap is yours to spring.'] },
    failure: { to: 'ambush-sprung', text: ['A hiss, a ripple — and the reeds come alive all at once. Too late.'] },
  },
  'ambush-turned': {
    id: 'ambush-turned', kind: 'battle', encounterId: 'hag-thralls', mapId: 'bog',
    surprise: 'enemies', // you spotted them — they lose the first round
    intro: ['You strike first. A hunting-party of **lizardfolk** rises from the water where they lay. Driven, herded, a monstrous toad lumbering at their backs. For a heartbeat they don\'t even see you. Whatever bound them here, it did not teach them to watch their own flank.'],
    onWin: { to: 'hollow-won', text: ['The lizardfolk sink back into the dark water they came from, one by one.'],
      effects: [{ kind: 'xpToLevel', level: 3 }] },
  },
  'ambush-sprung': {
    id: 'ambush-sprung', kind: 'battle', encounterId: 'hag-thralls', mapId: 'bog',
    surprise: 'party', // the check failed — they get the drop on you
    intro: ['The reeds erupt around you. **Lizardfolk** rush in with hooked spears. A giant toad heaves up through the muck. All of it moves with one dreadful purpose, as if a single hand worked them like puppets.'],
    onWin: { to: 'hollow-won', text: ['Bloodied, you break them at last. The marsh-things fall still.'],
      effects: [{ kind: 'xpToLevel', level: 3 }] },
  },
  // The reveal beat: the lizardfolk didn't choose the raiders — something in the
  // marsh owns them, and now you know its name.
  'hollow-won': {
    id: 'hollow-won', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐍' },
    text: [
      'You turn the nearest body with your boot. Branded into the scaled hide, still weeping: a crude mark of reeds and a reaching hand. These weren\'t raiders. Someone *owned* them, and marked them like cattle.',
      'Then a voice drifts across the water, old and wet and amused. "My little dogs, off their leash. No matter. **Vargan**, the Ashfang chief, sold me this marsh, sweetlings, and all his people\'s homes in it. I pay him in coin and in creatures."',
      '"Come up to the fire, if you can find it. The chief and I will be waiting." The reeds shiver, and go quiet. So the Ashfang answer to a **green hag** of the marsh.',
    ],
    next: [{ id: 'ok', label: 'On to the den', to: 'gate',
      requires: [{ kind: 'noCompanion', companion: 'wren' }], hideWhenBlocked: true,
      effects: HAG_LEARNED },
    { id: 'wren', label: 'On to the den', to: 'wren-parts',
      requires: [{ kind: 'companion', companion: 'wren' }], hideWhenBlocked: true,
      effects: HAG_LEARNED }],
  },

  // === ACT 3 — THE ASHFANG DEN (dungeon) ================================
  gate: {
    id: 'gate', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏚️' },
    text: ['A wooden wall of lashed timber rings the hollow. A watch-post looms over the only gate. Beyond it waits the chief.'],
    // `den-entered` is set by every way in (a failed roll clears it again on
    // the way to the gate fight), so a return trip only offers the way back in.
    next: [
      { id: 'back', label: 'Slip back in the way you left', to: 'inner',
        requires: [{ kind: 'flag', flag: 'den-entered' }], hideWhenBlocked: true },
      { id: 'signal', label: '[Deception DC 10] Call the stolen watch-signal up to the post', to: 'inner',
        requires: [{ kind: 'flag', flag: 'know-signal' }, { kind: 'notFlag', flag: 'den-entered' }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'den-entered' }],
        check: { skill: 'deception', dc: 10, failTo: 'gate-fight', failEffects: [{ kind: 'clearFlag', flag: 'den-entered' }] } },
      { id: 'sneak', label: '[Stealth DC 13] Slip over the wall (whole party)', to: 'inner',
        requires: [{ kind: 'notFlag', flag: 'den-entered' }], hideWhenBlocked: true,
        effects: [{ kind: 'setFlag', flag: 'den-entered' }],
        check: { skill: 'stealth', dc: 13, roller: 'group', failTo: 'gate-fight', failEffects: [{ kind: 'clearFlag', flag: 'den-entered' }] } },
      { id: 'fight', label: 'Storm the gate', to: 'gate-fight',
        requires: [{ kind: 'notFlag', flag: 'den-entered' }], hideWhenBlocked: true },
    ],
  },
  'gate-fight': {
    id: 'gate-fight', kind: 'battle', encounterId: 'den-gate', mapId: 'corridor',
    intro: ['A horn brays from the watch-post, and the gate-runners answer. A hulking bugbear ducks through the gateway. Behind him two gnolls come yammering their high, laughing bark. The narrow timber run hems all three in.'],
    onWin: { to: 'inner', text: ['The bugbear goes down last, folding across the gateway. The path in is open.'],
      effects: [{ kind: 'setFlag', flag: 'den-entered' }] },
    parley: {
      skill: 'deception', dc: 15, label: 'Pass yourselves off as new blood',
      success: { to: 'inner', text: ['"Chief sent for fighters," you growl, and shoulder past the horn like you own the place. The bugbear sniffs you, weighs you, and decides you are someone else\'s problem. The gnolls fall in laughing behind you, and the den stays asleep.'],
        effects: [{ kind: 'setFlag', flag: 'den-entered' }] },
    },
  },
  // The den as a dungeon: rooms and links, laid out by the game. The spine is
  // forced — yard → pit → Vex's fire → the chief's hall — so every party
  // crosses the pit-brute and meets Vex before the throne. The kennels and the
  // plunder tent hang off the yard; the tent is barred, and the kennel-master
  // keeps its key. The gate is the way back out to the marsh road.
  inner: {
    id: 'inner', kind: 'dungeon',
    dungeon: {
      title: 'The Ashfang Den', theme: 'ember', art: { imageId: 'loc-camp', emoji: '🔥' },
      // Hostile ground, but you can bank a fire in a cleared corner and chance
      // a rest — the watch may stumble on you (no recovery if they do).
      camp: { risky: { chance: 0.35, battleScene: 'den-camp-ambush' } },
      entry: 'gate',
      rooms: [
        { id: 'gate', name: 'Gate', size: 'small', exit: { to: 'trail', label: 'Out to the marsh road' } },
        { id: 'yard', name: 'Muster Yard', size: 'large',
          firstVisit: ['Inside the wall the den sprawls around a central fire-pit: tents, drying-racks, and the reek of a place that has never once been clean. Ahead, a staked ring of trampled mud — **the pit** — where a chained shape heaves against its irons.'] },
        { id: 'kennel', name: 'Kennels', fight: 'den-hyenas' },
        { id: 'cache', name: 'Plunder Tent', size: 'small', search: 'cache' },
        { id: 'muster', name: 'The Pit', fight: 'den-muster' },
        { id: 'vex', name: 'A Lone Fire', size: 'small',
          event: { scene: 'vex-parley', until: [{ kind: 'flag', flag: 'met-vex' }] } },
        { id: 'throne', name: 'The Chief\'s Hall', size: 'large', goal: true,
          event: { scene: 'boss-approach', until: [{ kind: 'flag', flag: 'chief-dead' }] } },
      ],
      links: [
        { a: 'gate', b: 'yard' },
        { a: 'yard', b: 'kennel' },
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
      'The chained shape in the pit is an **ogre** — half-starved, whip-scarred, and utterly beside itself with rage. Two orc goaders work its temper with barbed poles, and when they see you they grin and haul the pins.',
      '"Fresh meat for the pit!" one bellows, and slips the ogre\'s chain.',
    ],
    onWin: { to: 'inner', text: ['The ogre crashes down across its own broken chains, and the goaders don\'t outlive it by much. The pit is quiet. Whatever the Ashfang were, they were cruel to their own monsters too.'],
      effects: [{ kind: 'setFlag', flag: 'muster-cleared' }, { kind: 'gold', amount: 25 }] },
  },
  'den-camp-ambush': {
    id: 'den-camp-ambush', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'raiders-forward', mapId: '@room',
    intro: ['You\'ve barely banked the fire when a watch-patrol rounds the tents — an orc, an archer and a bandit, blinking in the firelight, already shouting the alarm. So much for rest.'],
    onWin: { to: '@hub', text: ['You put the patrol down before the whole camp wakes. But the night\'s gone, and you got no rest of it.'] },
  },
  'den-hyenas': {
    id: 'den-hyenas', kind: 'battle', encounterId: 'kennel-hyenas', mapId: '@room',
    intro: ['Two giant hyenas lunge to the ends of their chains at the sight of you. The Ashfang raider who keeps them yanks the pins and runs. The hyenas come loose in a scrabble of claws and yelping.'],
    onWin: { to: 'inner', text: ['The kennel falls quiet. In the straw you find a raider\'s stashed purse and a satchel worth the trouble. By the gate lies the key ring their keeper dropped as he ran. One key fits the plunder tent.'],
      effects: [{ kind: 'setFlag', flag: 'kennel-cleared' }, { kind: 'gold', amount: 30 }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 }] },
  },
  cache: {
    id: 'cache', kind: 'check', skill: 'investigation', dc: 12, art: { emoji: '📦' },
    intro: ['A tent of stolen goods, heaped anyhow. A careful search turns up the best of it.'],
    success: { to: 'inner', text: ['Beneath the junk you find real coin and a caravan\'s lost potion. Stuffed in a sack at the bottom is the **Ashfang banner** itself. The reeve will pay extra for that.'],
      effects: [{ kind: 'gold', amount: 80 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }, { kind: 'setFlag', flag: 'looted' }, { kind: 'setFlag', flag: 'cache-searched' }] },
    failure: { to: 'inner', text: ['You grab what\'s in reach before the noise draws eyes.'],
      effects: [{ kind: 'gold', amount: 25 }, { kind: 'setFlag', flag: 'cache-searched' }] },
  },
  'vex-parley': {
    id: 'vex-parley', kind: 'dialogue', npc: LIEUTENANT, art: { emoji: '🗡️' },
    lines: [
      'At the lone fire a lean, grey-templed raider watches you come. A bare blade lies across his knees. He holds it like a man who\'d rather be leaning on it.',
      '"**Vex**," he offers. "The chief\'s lieutenant, for my sins. He keeps an ogre in a pit for people like you. I notice he never kept one for me." A thin smile, gone as fast. "So what do you offer a man for stepping aside?"',
    ],
    next: [
      { id: 'persuade', label: '[Persuasion DC 13] Offer him the chief\'s seat, once it\'s empty', to: 'vex-turned',
        once: true, check: { skill: 'persuasion', dc: 13, failTo: 'vex-refuses' } },
      { id: 'intimidate', label: '[Intimidation DC 14] Point out his one other way out', to: 'vex-turned',
        once: true, check: { skill: 'intimidation', dc: 14, failTo: 'vex-refuses' } },
      { id: 'refuse', label: 'Refuse to deal with a raider', to: 'vex-dismissed',
        effects: [{ kind: 'setFlag', flag: 'met-vex' }] },
    ],
  },
  'vex-turned': {
    id: 'vex-turned', kind: 'story', art: { emoji: '🤝' },
    text: ['Vex weighs it, then slides the blade home. "The man who guards the chief answers to me, not him. He\'ll find somewhere else to be — this once." He steps back into the smoke, unhurried. "Do it properly. I\'m tired of soldiering for a man who burns barns and calls it strategy."'],
    next: [{ id: 'ok', label: 'On to the chief', to: 'inner',
      effects: [{ kind: 'setFlag', flag: 'vex-turned' }, { kind: 'setFlag', flag: 'met-vex' },
        { kind: 'journal', entry: { id: 'n-vex', kind: 'npc', title: 'Vex, Turned', body: 'Vex the lieutenant took your offer. The chief\'s guard will stand aside when you face the Ashfang chief — this once.' } }] }],
  },
  'vex-refuses': {
    id: 'vex-refuses', kind: 'story', art: { emoji: '💢' },
    text: [
      'Vex studies you a long moment, then shakes his head, almost sorry about it. "No. You\'d hang me the morning after, and we both know it."',
      '"Pity. I\'d have made a better chief than he ever did." He melts back into the dark. Whatever happens in the hall, he means to watch it from a long way off.',
    ],
    next: [{ id: 'ok', label: 'Press on', to: 'inner', effects: [{ kind: 'setFlag', flag: 'met-vex' }] }],
  },
  'vex-dismissed': {
    id: 'vex-dismissed', kind: 'story', art: { emoji: '🗡️' },
    text: ['"Suit yourself." Vex turns back to his fire. "I won\'t help you. I won\'t get in your way, either."'],
    next: [{ id: 'ok', label: 'Press on', to: 'inner' }],
  },
  'boss-approach': {
    id: 'boss-approach', kind: 'story', art: { imageId: 'loc-throne', emoji: '👑' },
    text: [
      'The chief\'s hall reeks of smoke and old blood. Trophies of a hundred raids hang from the rafters — a child\'s shoe, a miller\'s ledger, a reeve\'s chain.',
      '**Vargan** rises from a throne of lashed spears, axe already in hand. And in the shadows behind the throne something else unfolds — long and green and grinning, river-weed in its hair, fingers too many and too long. The **Reedwife**, the green hag of the marsh, come up out of her water to see how her investment fares.',
      '"You\'ve been *busy*," she says, delighted. At a flick of her hand, the bandit at the chief\'s shoulder sets his feet. For a heartbeat the whole hall waits to see what you\'ll do.',
    ],
    next: [
      // Vex's bargain pays off here: his guard stands down, and the chief and
      // the hag fight alone. The two choices are mutually exclusive on the flag.
      { id: 'fight-alone', label: 'End them both — Vex\'s man stands aside', to: 'boss-unguarded',
        requires: [{ kind: 'flag', flag: 'vex-turned' }], hideWhenBlocked: true },
      { id: 'fight', label: 'End them both', to: 'boss',
        requires: [{ kind: 'notFlag', flag: 'vex-turned' }], hideWhenBlocked: true },
    ],
  },
  boss: {
    id: 'boss', kind: 'battle', encounterId: 'ashfang-warlord', mapId: 'firepit',
    intro: ['"You\'ve cost me a good season," the chief says, almost mild, and rolls the great axe off his shoulder. Beside him the hag only laughs, low and pleased, her fingers already weaving something cold out of the smoke. "Oh, don\'t kill them quickly," she tells him. "Waste not."'],
    loot: { bonusTier: 'rare' }, // a warlord's hoard + a hag's trophies — guaranteed drop
    onWin: { to: 'aftermath', text: ['The chief falls, and the **Reedwife** comes apart like wet reeds in a fist, her laughter curdling to a wail that sinks back into the marsh. The **Ashfang** are broken — root and branch.'],
      effects: [{ kind: 'setFlag', flag: 'chief-dead' }, { kind: 'setFlag', flag: 'hag-dead' }, { kind: 'gold', amount: 100 }] },
  },
  // The same hall with Vex's word kept: his guard finds somewhere else to be.
  'boss-unguarded': {
    id: 'boss-unguarded', kind: 'battle', encounterId: 'ashfang-warlord-alone', mapId: 'firepit',
    intro: [
      'The chief bellows for his guard. Nothing answers. Somewhere back in the smoke, Vex is looking the other way on purpose.',
      '"You\'ve cost me a good season," he says anyway, almost mild, and rolls the great axe off his shoulder. The hag\'s laughter falters, just once, counting the blades that didn\'t come.',
    ],
    loot: { bonusTier: 'rare' },
    onWin: { to: 'aftermath', text: ['The chief falls, and the **Reedwife** comes apart like wet reeds in a fist, her laughter curdling to a wail that sinks back into the marsh. The **Ashfang** are broken — root and branch.'],
      effects: [{ kind: 'setFlag', flag: 'chief-dead' }, { kind: 'setFlag', flag: 'hag-dead' }, { kind: 'gold', amount: 100 }] },
  },

  // The reckoning: your earlier choices surface here as rewards you can (or
  // can't) claim — blocked options show *why*, so what you did back in the
  // village and the marsh visibly mattered.
  aftermath: {
    id: 'aftermath', kind: 'story', art: { imageId: 'loc-village', emoji: '🏘️' },
    text: [
      'You come back down the marsh road into a Thornwick with its shutters thrown open for the first time in a month. Word runs ahead of you; by the time you reach the square, the square is full.',
      'The reeve is there too — stiff-backed, unsmiling, a strongbox under one arm. He does not thank you. He pays. "Thornwick settles its debts," he says, as though daring you to make something of it. Behind him, Mira catches your eye and very nearly smiles.',
    ],
    next: AFTERMATH_CLAIMS,
    // Back in Thornwick with the chief dead: there is no den to go back to,
    // and walking into it would leave the ending behind for good.
    noBack: true,
  },
  // Where each claim comes back to: the same choices, without the homecoming.
  'aftermath-hub': {
    id: 'aftermath-hub', kind: 'story', art: { imageId: 'loc-village', emoji: '🏘️' },
    text: ['The square is still full, and the reeve\'s strongbox is still open.'],
    next: AFTERMATH_CLAIMS, noBack: true,
  },
  'claim-bounty': {
    id: 'claim-bounty', kind: 'story', art: { imageId: 'loc-village', emoji: '💰' },
    text: ['The reeve counts out a hundred and twenty gold, coin by coin, as if each one hurts. "Paid in full."'],
    next: [{ id: 'ok', label: 'Back to the crowd', to: 'aftermath-hub' }], noBack: true,
  },
  'claim-balance': {
    id: 'claim-balance', kind: 'story', art: { imageId: 'loc-village', emoji: '💰' },
    text: ['The reeve checks his ledger, takes off the twenty-five you drew at the board, and counts out ninety-five gold. "Paid in full."'],
    next: [{ id: 'ok', label: 'Back to the crowd', to: 'aftermath-hub' }], noBack: true,
  },
  'claim-banner': {
    id: 'claim-banner', kind: 'story', art: { imageId: 'loc-village', emoji: '🚩' },
    text: ['The reeve unrolls the Ashfang banner for the crowd to see, and the cheer goes on for some time. He adds sixty gold to your pile without a word.'],
    next: [{ id: 'ok', label: 'Back to the crowd', to: 'aftermath-hub' }], noBack: true,
  },
  'claim-scout': {
    id: 'claim-scout', kind: 'story', art: { imageId: 'loc-village', emoji: '🏹' },
    text: ['Wren pushes through the crowd on a crutch and hands you the reeve\'s purse of fifty gold. Then she just stands there. "You came back," she says at last, and goes red to the ears.'],
    next: [{ id: 'ok', label: 'Back to the crowd', to: 'aftermath-hub' }], noBack: true,
  },

  // A total party wipe lands here (revived at half HP), not a hard game over —
  // dragged back to Thornwick to lick wounds and try again.
  defeat: {
    id: 'defeat', kind: 'story', art: { imageId: 'loc-tavern', emoji: '🍺' },
    text: [
      'You wake to lamplight and the smell of Mira\'s hearth. Someone hauled you off the field before the ravens came.',
      '"Easy, now," she says, setting down a bowl. "The Ashfang are still out there — but you\'re no use to Thornwick dead. Rest, then finish it."',
    ],
    next: [{ id: 'up', label: 'Get back on your feet', to: 'square' }], noBack: true,
  },

  epilogue: {
    id: 'epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'Bonfires burn in the square tonight. Out past the reeds, the marsh has gone strangely still.',
      'The water is lower than anyone remembers, and the cold has lifted from it. It is as if something held its breath for years and finally let it out. The **Reedwife** is done.',
      'By morning the carters are already complaining about the state of the road. Mira says that is the surest sign a place has stopped being afraid.',
      'She pours the first round on the house, and the second when she thinks you aren\'t counting. "Don\'t go making a habit of saving towns," she warns you. "People come to expect it." It is the nearest thing to thanks she keeps in stock, and you both know it.',
    ],
  },

};

export const HOLLOW_ROAD_MODULE: Module = {
  id: 'hollow-road', title: 'The Hollow Road',
  blurb: 'Break the Ashfang raiders — through the village, the marsh, and their den. By blade or by wit.',
  cover: 'loc-village',
  levelBand: { from: 1, to: 3 },
  // Part 1 of the trilogy (docs/trilogy-plan.md): a victory carries the
  // company into The Sunken Barrows.
  sequel: 'sunken-barrows',
  start: 'road', scenes, defeatScene: 'defeat', town: 'square',
  // What the rest of the campaign remembers: whether Wren lived, and whether
  // Vex took the party's offer (read as 'hollow-road:saved-scout', …).
  carries: ['saved-scout', 'scout-met', 'vex-turned', 'chief-dead'],
  companions: {
    wren: {
      id: 'wren', name: 'Wren', monsterId: 'scout', portraitId: 'npc-scout', emoji: '🏹',
      blurb: 'The reeve\'s scout you pulled from under a dead horse. Guiding you through the marsh as far as the den\'s gate.',
    },
  },
};
