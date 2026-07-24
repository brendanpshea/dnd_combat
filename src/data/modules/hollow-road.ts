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
import type { Module, Scene } from '../../adventure/types.js';

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
    onWin: { to: 'road-reveal', text: ['The last of them drops into the mud. The road is yours again — for now.'] },
  },
  'road-reveal': {
    id: 'road-reveal', kind: 'story', art: { imageId: 'loc-road', emoji: '🩸' },
    text: [
      'The bandit isn\'t dead yet. He laughs wetly through red teeth as you stand over him.',
      '"You think you\'ve done something? We\'re a hundred strong in the hollow — and the **chief**, he don\'t even answer to himself no more. There\'s something *in the marsh* he feeds, and it feeds him back. The **Ashfang** own this whole valley now, and worse than us owns them."',
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
      'You limp the last mile into **Thornwick** — gate scorched, shutters barred, faces watching you pass from the dark of doorways.',
      'So the raiders on the road told it true. For a month the **Ashfang** have bled this valley dry. The whole country has learned to lock its doors by dark.',
      'The reeve\'s bounty is what you came for. But it was the plea nailed beneath it, in a shakier hand, that made you keep walking: "Help us. There is no one else."',
    ],
    next: [{ id: 'go', label: 'Enter the Wander-Inn', to: 'tavern',
      effects: [{ kind: 'journal', entry: { id: 'q-main', kind: 'quest', title: 'Break the Ashfang', body: 'Mira, who keeps the Wander-Inn, begged your help against the Ashfang raiders bleeding Thornwick dry. Find where they den. Ask around the market and the marsh road, then end them.' } }] }],
  },
  // The tavern is a small loop, not a one-way door (#6): each social read is a
  // `once` choice that returns you here, so you can try Insight *and*
  // Persuasion but never re-roll either. "Head to the square" is the way out.
  tavern: {
    id: 'tavern', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'Inside the **Wander-Inn** the fire is low and the talk lower. A broad woman with flour to the elbow sets down her cloth, looks you over once, and evidently decides you\'ll do.',
      '"Sellswords. Good." **Mira** doesn\'t smile — you get the feeling she keeps it somewhere safe, for special occasions. "The reeve\'s too proud to beg, so I do it for him. Sit."',
      '"The **Ashfang** came down the **marsh road**, out past the reeds. Everyone knows that much. Knowing it never once filled a burned cart back up. But there\'s more — the kind folk won\'t say with the door open."',
    ],
    next: [
      { id: 'insight', label: '[Insight DC 12] Read what she isn\'t saying', to: 'tavern-spy',
        once: true, check: { skill: 'insight', dc: 12, failTo: 'tavern-plain' } },
      { id: 'persuade', label: '[Persuasion DC 12] Buy the whole room a round', to: 'tavern-trail',
        once: true, check: { skill: 'persuasion', dc: 12, failTo: 'tavern-plain' } },
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
      '"Here\'s the reeds, here\'s the black water — and here," he taps a hollow in the hills, "is where their smoke rises of a morning. That\'s your den. Mind, the **trail** bites back long before you reach it."',
    ],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern',
      effects: [{ kind: 'setFlag', flag: 'trail-known' }] }],
  },
  'tavern-plain': {
    id: 'tavern-plain', kind: 'story', art: { emoji: '🍺' },
    text: ['"The marsh road, then. Mind yourself." She turns back to her taps.'],
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
      'A grey-bearded man with a soldier\'s too-straight back taps the boards. "Rule one, and it\'s the reason I\'ve still got both legs: don\'t turn your back on a man with a blade in reach. Step away careless and he gets a free cut at you — an *opportunity*, they call it. They don\'t miss those the way they miss in a fair fight."',
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
      'A scarred caravan guard rolls her axe over on the table. "Every weapon\'s got a trick in it, if you know how to ask. A heavy blade *cleaves* — bite one man and the swing carries on into the next. A flail\'ll *sap* a foe, so the next of your lot to hit him lands the easier."',
      '"Learn what the thing in your hand actually *does*, and you\'ll put down men a brute twice your size never lays a finger on. It\'s not the size of the axe, love. It\'s knowing where the grain runs."',
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
          sceneWhen: [{ if: [{ kind: 'notFlag', flag: 'spy-caught' }], to: 'gate-blocked' }] },
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
      'When your shadow falls across his goods he goes very still. Then he does the last thing you expected of a man selling buttons. He puts two fingers to his teeth and *whistles*. All round the square, the wrong sort of people start setting down their drinks. This won\'t end with words.',
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
    text: ['With his hired knives down, the peddler makes it four steps before you run him down. Under the false bottom of his cart: a tally of every caravan to leave Thornwick in a month, in a hand that isn\'t his. He folds like wet paper. "I only carried word. I never lifted a blade!" And, babbling, he gives it up: **the raiders\' gate-signal. You can walk into the den wearing their own password.**'],
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
    intro: ['Two bat-winged things explode out of the hedge in a fury of beak and scale — cockatrices, ugly as sin and twice as mean. Mind the bite: flesh that takes it goes to stone.'],
    onWin: { to: 'square', text: ['The last cockatrice flops still. The miller pays up gladly, prods the stone dog, and allows that it makes a fair garden ornament.'],
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
    onWin: { to: 'spy-caught', text: ['The last of the hired help drops his knife and his nerve together, and runs.'] },
  },
  'spy-ambush': {
    id: 'spy-ambush', kind: 'battle', encounterId: 'cutpurses', mapId: 'village',
    surprise: 'enemies', // you read the ambush first — the crew loses its opening round
    intro: ['You had them marked before the whistle finished. When the crew moves in from the stalls, you\'re already where they didn\'t expect you — and they scramble, a beat behind.'],
    onWin: { to: 'spy-caught', text: ['Wrong-footed from the first, the crew never finds its feet. The last of them throws down and bolts.'] },
  },

  // === ACT 2 — THE MARSH ROAD (wilderness) ==============================
  trailhead: {
    id: 'trailhead', kind: 'story', art: { imageId: 'loc-road', emoji: '🛤️' },
    text: [
      'The peddler is in the reeve\'s cells now. The gate-warden stands aside, and **Thornwick** falls away behind you. Ahead the road narrows toward the **marsh**. It is a ribbon of mud between black water and whispering reeds.',
      'Somewhere out in that maze the **Ashfang** keep their den. Somewhere a good deal closer, it seems, they keep their eyes on the road.',
    ],
    next: [{ id: 'go', label: 'Set out on the marsh road', to: 'road-out' }],
  },
  'road-out': {
    id: 'road-out', kind: 'battle', encounterId: 'goblin-outriders', mapId: 'open',
    intro: ['Barely a mile from the gate, the reeds erupt. The Ashfang keep goblin outriders on the road, and word of you has run ahead. A wiry goblin boss lopes out in front of his pack. His scimitar is bared, and he cackles something in Goblin that needs no translation.'],
    // Milestone M1 rides on this fight's win: surviving the road out of town is
    // what dings the party to 2nd level, so the level-up lands on a fight it
    // earned rather than out of nowhere. road-out is on the one-way path into the
    // marsh, so the grant fires exactly once.
    onWin: { to: 'trail', text: ['The last of the pack breaks and vanishes into the reeds. Behind you Thornwick; ahead, the marsh swallows the road whole. You feel steadier on your feet than a week ago — hardened, and a shade deadlier.'],
      effects: [{ kind: 'xpToLevel', level: 2 }] },
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
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'trail-read' }], to: 'tracks-done' }] },
        { id: 'scout', x: 34, y: 82, label: 'A Cry for Help', mystery: 'A faint sound…', icon: 'tok-person', scene: 'wounded',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'scout-met' }], to: 'scout-gone' }] },
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
    success: { to: 'trail', text: ['The tracks tell their whole story: a heavy patrol out at dusk, a lighter one back at dawn, always the same dry line through the reeds. You\'ve found the **safe path to the hollow** — and you\'ll see the raiders before they see you.'],
      effects: [{ kind: 'setFlag', flag: 'trail-read' }, { kind: 'xp', amount: 20 }] },
    failure: { to: 'trail', text: ['The prints tangle and double back on themselves until your eyes water. Still — they point, roughly, toward the hills. You\'ll find the den, but you\'ll be walking in blind.'],
      effects: [{ kind: 'setFlag', flag: 'trail-read' }] },
  },
  'tracks-done': {
    id: 'tracks-done', kind: 'story', art: { emoji: '👣' },
    text: ['The mud has told you all it can — you now hold the patrols\' dry line through the reeds fixed in your memory. Nothing new has passed this way since.'],
    next: [{ id: 'ok', label: 'Back to the trail', to: 'trail' }], noBack: true,
  },
  'hollow-quiet': {
    id: 'hollow-quiet', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🌾' },
    text: ['The hollow lies quiet where you broke the Reedwife\'s ambush — only flattened reeds and still black water remain. The den\'s wooden wall waits ahead.'],
    next: [{ id: 'ok', label: 'On to the den gate', to: 'gate' }], noBack: true,
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
        success: { to: 'trail', text: ['You haul the party up and over hand over hand. The shortcut is yours.'],
          effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'setFlag', flag: 'shortcut' }, { kind: 'xp', amount: 30 }] },
        failure: { to: 'ravine', text: ['A hold crumbles and you slide back down in a clatter of stone. That way will not work.'] } },
      { id: 'scramble', label: 'Pick across the rubble', hint: 'Balance over the loose stone where it has fallen shallowest.',
        skill: 'acrobatics', dc: 12,
        success: { to: 'trail', text: ['Light on your feet, you thread the shifting stones and reach the far lip. The shortcut is yours.'],
          effects: [{ kind: 'setFlag', flag: 'crossed-ravine' }, { kind: 'setFlag', flag: 'shortcut' }, { kind: 'xp', amount: 30 }] },
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
    next: [{ id: 'ok', label: 'Send Wren back to Thornwick', to: 'trail',
      effects: [{ kind: 'setFlag', flag: 'saved-scout' }, { kind: 'setFlag', flag: 'scout-met' }, { kind: 'setFlag', flag: 'know-vex' },
        { kind: 'journal', entry: { id: 'npc-wren', kind: 'npc', title: 'Wren, the Scout', body: 'You pulled a reeve\'s scout, Wren, out from under a dead horse on the marsh road. She mapped the den for you.' } },
        { kind: 'journal', entry: { id: 'lead-vex', kind: 'lead', resolvedBy: 'met-vex',
          title: 'Vex, the Lieutenant', body: 'Wren named Vex, the Ashfang chief\'s resentful lieutenant. Seek out his fire inside the den — he may turn on the chief if offered a way out.' } }] }],
  },
  'scout-fail': {
    id: 'scout-fail', kind: 'story', art: { emoji: '🩸' },
    text: ['Your hands aren\'t enough; she fades before she can say much. She presses a token into your palm — the reeve will know it.'],
    next: [{ id: 'ok', label: 'Cover her and go', to: 'trail',
      effects: [{ kind: 'setFlag', flag: 'scout-met' }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 }] }],
  },
  // "Already done" beats: a finished location shows this instead of replaying
  // its full scene (the explore node's sceneWhen routes here once its flag set).
  'scout-gone': {
    id: 'scout-gone', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🐴' },
    text: ['The dead horse still lies across the trail, flies rising in the heat. Of the scout there\'s no sign — dragged home, or into the reeds. Nothing more remains for you here.'],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'spy-gone': {
    id: 'spy-gone', kind: 'story', art: { imageId: 'loc-village', emoji: '🕳️' },
    text: ['The peddler\'s stall stands bare, its awning taken down. The reeve\'s men came for him at first light; the square has already moved on.'],
    next: [{ id: 'ok', label: 'Turn back to the square', to: 'square' }], noBack: true,
  },
  // --- Optional: the sunken barrow (Act 2 side fight, undead teaser) -------
  barrow: {
    id: 'barrow', kind: 'story', art: { emoji: '🪦' },
    text: [
      'Half-swallowed by the reeds is a barrow-mound older than any kingdom you could name. Its capstone is cracked and weeping cold air. The marsh has been chewing at it for centuries. Lately, something has been chewing back out.',
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
      'The reeds ahead are wrong — sheeted in pale silk, gone grey and still. Bundles hang in the webbing at the height a man\'s shoulders would be. Some of the bundles are man-shaped.',
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
    onWin: { to: 'trail', text: ['The last spider curls in on itself like a burnt glove. The cocoons hold two dissolved raiders, their purses intact. There is also one caravan guard, still breathing. He does not stop thanking you until the reeds swallow the sound.'],
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
    onWin: { to: 'ravine', text: ['The last toad shudders and goes still, half in the water. You scrape the slime off and press on — the ravine still waits.'] },
  },
  'camp-ambush': {
    id: 'camp-ambush', kind: 'battle', encounterId: 'marsh-dead', mapId: 'bog',
    intro: ['You wake to the wrongness before you hear it — a wet, dragging sound in the dark. The marsh gives up its dead: two ghouls claw up out of the mire, jaws working, and come for the firelight. No time to ready anything — you fight with what you\'ve got.'],
    onWin: { to: '@hub', text: ['The dead lie still again — but the night\'s ruined, and no one\'s resting now. You got no good of that rest; you\'ll have to bank the fire and try again, if you dare.'] },
  },
  ambush: {
    id: 'ambush', kind: 'check', skill: 'perception', dc: 13, roller: 'group', art: { emoji: '⛰️' },
    intro: ['The hollow opens below — and the reeds are wrong. Too still, and cold where the marsh should be warm. Shapes crouch there that are neither raider nor beast. Scaled things wait in the shallows, listening for a word. Who spots the trap first decides everything.'],
    // The perception check only sets the terms (surprise); Milestone M2 rides the
    // battle's win, so 3rd level is earned in the fight, not handed over — and the
    // hollow ambush is the one route to the den (approach needs trail-read from
    // the tracks), so it never gets skipped.
    success: { to: 'ambush-turned', text: ['You catch the gleam of an eye among the reeds a breath before it moves. The trap is yours to spring.'],
      effects: [{ kind: 'setFlag', flag: 'surprise' }] },
    failure: { to: 'ambush-sprung', text: ['A hiss, a ripple — and the reeds come alive all at once. Too late.'] },
  },
  'ambush-turned': {
    id: 'ambush-turned', kind: 'battle', encounterId: 'hag-thralls', mapId: 'bog',
    surprise: 'enemies', // you spotted them — they lose the first round
    intro: ['You strike first. A hunting-party of **lizardfolk** rises from the water where they lay. Driven, herded, a monstrous toad lumbering at their backs. For a heartbeat they don\'t even see you. Whatever bound them here, it did not teach them to watch their own flank.'],
    onWin: { to: 'hollow-won', text: ['The last of the marsh-folk sinks back into the black water it came from.'],
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
      'Then a voice comes drifting across the water — old, and wet, and amused. "Vargan\'s little dogs, off their leash. No matter. Come up to the fire, sweetlings. The chief and his **Reedwife** have been expecting you." The reeds shiver, and go quiet. **So that is the Ashfang\'s secret: a green hag of the marsh, and a chief who sold his people\'s home to her for coin and cruelty.**',
    ],
    next: [{ id: 'ok', label: 'On to the den', to: 'gate',
      effects: [{ kind: 'setFlag', flag: 'know-hag' },
        { kind: 'journal', entry: { id: 'c-hag', kind: 'clue', title: 'The Reedwife',
          body: 'A green hag called the "Reedwife" owns and brands the marsh-creatures that serve the Ashfang. Chief Vargan sold his people\'s marsh to her. She gets caravans and captives. He gets coin and monsters. She waits at the den\'s fire beside him.' } }] }],
  },

  // === ACT 3 — THE ASHFANG DEN (dungeon) ================================
  gate: {
    id: 'gate', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏚️' },
    text: ['A wooden wall of lashed timber rings the hollow. A watch-post looms over the only gate. Beyond: the chief.'],
    next: [
      { id: 'signal', label: 'Give the stolen watch-signal', to: 'inner',
        requires: [{ kind: 'flag', flag: 'know-signal' }],
        effects: [{ kind: 'setFlag', flag: 'walked-in' }] },
      { id: 'sneak', label: '[Stealth] Slip over the wall (whole party)', to: 'inner',
        check: { skill: 'stealth', dc: 13, roller: 'group', failTo: 'gate-fight' } },
      { id: 'fight', label: 'Storm the gate', to: 'gate-fight' },
    ],
  },
  'gate-fight': {
    id: 'gate-fight', kind: 'battle', encounterId: 'den-gate', mapId: 'corridor',
    intro: ['A horn brays from the watch-post, and the gate-runners answer. A hulking bugbear ducks through the gateway. Behind him two gnolls come yammering that awful laughing bark. The narrow timber run hems all three in.'],
    onWin: { to: 'inner', text: ['The bugbear goes down last, folding across the gateway. The path in is open — though the whole den is awake and shouting now.'],
      effects: [{ kind: 'setFlag', flag: 'loud-entry' }] },
  },
  // A traversal dungeon, laid out like the marsh: you enter at the muster yard
  // and the camp reveals itself node by node as you push deeper. The spine is
  // forced — yard → the pit → Vex's fire → the chief's hall — so every party
  // crosses the pit-brute and meets Vex before the throne; the kennels, the
  // plunder tent, and the road back to the marsh hang off the yard as choices.
  inner: {
    id: 'inner', kind: 'explore',
    map: {
      title: 'Inside the Den', theme: 'ember', art: { imageId: 'loc-camp', emoji: '🔥' },
      // The den is hostile ground, but you can bank a fire in a cleared corner
      // and chance a rest — the watch may stumble on you (no recovery if they do).
      camp: { risky: { chance: 0.35, battleScene: 'den-camp-ambush' } },
      entry: ['yard'],
      paths: [
        ['yard', 'retreat'], ['yard', 'cache'], ['yard', 'kennel'],
        ['yard', 'muster'], ['muster', 'vex'], ['vex', 'throne'],
      ],
      nodes: [
        { id: 'yard', x: 12, y: 50, label: 'The Gathering Yard', icon: 'tok-fire', scene: 'den-yard' },
        { id: 'retreat', x: 10, y: 84, label: 'Back to the Marsh Road', icon: 'tok-gate', scene: 'den-retreat' },
        { id: 'cache', x: 30, y: 24, label: 'Plunder Tent', mystery: 'A guarded tent…', icon: 'tok-treasure', scene: 'cache',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'cache-searched' }], to: 'cache-done' }] },
        { id: 'kennel', x: 38, y: 80, label: 'The Kennels', mystery: 'Something\'s snarling…', icon: 'tok-figure', scene: 'kennel',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'kennel-cleared' }], to: 'kennel-done' }] },
        { id: 'muster', x: 50, y: 50, label: 'The Pit', mystery: 'Chains and firelight…', icon: 'tok-figure', scene: 'den-muster',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'muster-cleared' }], to: 'muster-done' }] },
        { id: 'vex', x: 70, y: 56, label: 'Vex\'s Fire', mystery: 'A lone fire, apart…', icon: 'tok-fire', scene: 'vex-parley',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'met-vex' }], to: 'vex-done' }] },
        { id: 'throne', x: 86, y: 32, label: 'The Chief\'s Hall', icon: 'tok-boss', scene: 'boss-approach' },
      ],
    },
  },
  'den-yard': {
    id: 'den-yard', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏚️' },
    text: [
      'Inside the wooden wall the Ashfang den sprawls around a central fire-pit. Tents and drying-racks churn together. Over it all hangs the reek of a place that has never once been clean.',
      'Directly ahead, a staked ring of trampled mud: **the pit**, where a chained shape heaves against its irons in the firelight. Past it, apart from the rest, a single small fire burns — someone keeping their own counsel. The chief\'s hall looms beyond, and behind you the gate still opens onto the marsh road, if it comes to that.',
    ],
    next: [{ id: 'ok', label: 'Take stock of the camp', to: 'inner' }],
  },
  'den-retreat': {
    id: 'den-retreat', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🌾' },
    text: ['You slip back out through the gate the way you came. The marsh road stretches behind the den. Here you can catch your breath, sort your gear, or bank a fire in the reeds before you go back in.'],
    next: [{ id: 'ok', label: 'Out to the marsh road', to: 'trail' }], noBack: true,
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
  'muster-done': {
    id: 'muster-done', kind: 'story', art: { emoji: '⛓️' },
    text: ['The pit stands empty, its chains slack in the churned mud. Nothing moves here but the fire-shadows.'],
    next: [{ id: 'ok', label: 'On through the camp', to: 'inner' }], noBack: true,
  },
  'den-camp-ambush': {
    id: 'den-camp-ambush', kind: 'battle', encounterId: 'raiders-forward', mapId: 'corridor',
    intro: ['You\'ve barely banked the fire when a watch-patrol rounds the tents — an orc and two hired blades, blinking in the firelight, already shouting the alarm. So much for rest.'],
    onWin: { to: '@hub', text: ['You put the patrol down before the whole camp wakes — but the night\'s gone, and you got no rest of it. Bank the fire and try again, if you dare.'] },
  },
  kennel: {
    id: 'kennel', kind: 'story', art: { emoji: '🦴' },
    text: ['A staked-out run of gnawed bones and rank straw — the Ashfang keep hunting-beasts. Two giant hyenas lunge to the ends of their chains at the sight of you, and a gnoll handler reaches for the pins to loose them.'],
    next: [
      { id: 'fight', label: 'Put them down before they\'re loosed', to: 'den-hyenas' },
      { id: 'leave', label: 'Back away slowly', to: 'inner' },
    ],
  },
  'den-hyenas': {
    id: 'den-hyenas', kind: 'battle', encounterId: 'kennel-hyenas', mapId: 'open',
    intro: ['The handler yanks the pins. The hyenas come off their chains in a scrabble of claws and that awful laughing yammer.'],
    onWin: { to: 'inner', text: ['The kennel falls quiet. Among the straw and bones: a raider\'s stashed purse and a half-eaten satchel worth the trouble.'],
      effects: [{ kind: 'setFlag', flag: 'kennel-cleared' }, { kind: 'gold', amount: 30 }, { kind: 'addItem', itemId: 'potion-healing', qty: 1 }] },
  },
  'kennel-done': {
    id: 'kennel-done', kind: 'story', art: { emoji: '🦴' },
    text: ['The kennels stand silent now, chains slack in the mud. Nothing left here but flies.'],
    next: [{ id: 'ok', label: 'Back to the den', to: 'inner' }], noBack: true,
  },
  'cache-done': {
    id: 'cache-done', kind: 'story', art: { emoji: '📦' },
    text: ['You already turned the plunder tent over yourself. Only torn sacking and broken crates remain.'],
    next: [{ id: 'ok', label: 'Back to the den', to: 'inner' }], noBack: true,
  },
  cache: {
    id: 'cache', kind: 'check', skill: 'investigation', dc: 12, art: { emoji: '📦' },
    intro: ['A tent of stolen goods, hastily hidden. A careful search turns up the best of it.'],
    success: { to: 'inner', text: ['Beneath the junk: real coin and a caravan\'s lost potions.'],
      effects: [{ kind: 'gold', amount: 80 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }, { kind: 'setFlag', flag: 'looted' }, { kind: 'setFlag', flag: 'cache-searched' }] },
    failure: { to: 'inner', text: ['You grab what\'s in reach before the noise draws eyes.'],
      effects: [{ kind: 'gold', amount: 25 }, { kind: 'setFlag', flag: 'cache-searched' }] },
  },
  'vex-parley': {
    id: 'vex-parley', kind: 'dialogue', npc: LIEUTENANT, art: { emoji: '🗡️' },
    lines: ['At the lone fire a lean, grey-templed raider watches you come — bared blade across his knees, held like a man who\'d rather be leaning on it. "**Vex**," he offers, unprompted. "The chief\'s lieutenant, for my sins. He sent his best to die at the gate; I notice he didn\'t send me." A thin smile, gone as fast. "You\'ve come this far through his people. So — what do you offer a man for stepping aside?"'],
    next: [
      { id: 'persuade', label: '[Persuasion DC 13] Offer him the chief\'s seat, once it\'s empty', to: 'vex-turned',
        once: true, check: { skill: 'persuasion', dc: 13, failTo: 'vex-refuses' } },
      { id: 'intimidate', label: '[Intimidation DC 14] Point out his one other way out', to: 'vex-turned',
        once: true, check: { skill: 'intimidation', dc: 14, failTo: 'vex-refuses' } },
      { id: 'refuse', label: 'Refuse to deal with a raider', to: 'inner' },
    ],
  },
  'vex-turned': {
    id: 'vex-turned', kind: 'story', art: { emoji: '🤝' },
    text: ['Vex weighs it, then slides the blade home. "The chief\'s guards answer to me, not him. They\'ll find somewhere else to be — this once." He steps back into the smoke, unhurried. "Do it properly. I\'m tired of soldiering for a man who burns barns and calls it strategy."'],
    next: [{ id: 'ok', label: 'On to the chief', to: 'inner',
      effects: [{ kind: 'setFlag', flag: 'vex-turned' }, { kind: 'setFlag', flag: 'met-vex' },
        { kind: 'journal', entry: { id: 'n-vex', kind: 'npc', title: 'Vex, Turned', body: 'Vex the lieutenant took your offer. His guards will stand aside when you face the Ashfang chief — this once.' } }] }],
  },
  'vex-refuses': {
    id: 'vex-refuses', kind: 'story', art: { emoji: '💢' },
    text: ['Vex studies you a long moment, then shakes his head, almost sorry about it. "No. You\'d hang me the morning after, and we both know it." He melts back into the dark. "Pity. I\'d have made a better chief than either of us." You\'ll meet his blade again — at the warlord\'s side.'],
    next: [{ id: 'ok', label: 'Press on', to: 'inner', effects: [{ kind: 'setFlag', flag: 'vex-hostile' }, { kind: 'setFlag', flag: 'met-vex' }] }],
  },
  // Passing Vex's fire again once his answer is settled — no second bargain.
  'vex-done': {
    id: 'vex-done', kind: 'story', art: { emoji: '🔥' },
    text: ['Vex\'s little fire still burns, but the man himself is done talking — either your ally now, or your enemy at the throne. There\'s nothing left to say here.'],
    next: [{ id: 'ok', label: 'On through the camp', to: 'inner' }], noBack: true,
  },
  'boss-approach': {
    id: 'boss-approach', kind: 'story', art: { imageId: 'loc-throne', emoji: '👑' },
    text: [
      'The chief\'s hall reeks of smoke and old blood. Trophies of a hundred raids hang from the rafters — a child\'s shoe, a miller\'s ledger, a reeve\'s chain.',
      'The **Ashfang** warlord rises from a throne of lashed spears, axe already in hand. And in the shadows behind the throne something else unfolds — long and green and grinning, river-weed in its hair, fingers too many and too long. The **Reedwife**, the green hag of the marsh, come up out of her water to see how her investment fares.',
      '"You\'ve been *busy*," she says, delighted, and the warlord\'s guards set their feet at a flick of her hand. For a heartbeat the whole hall waits to see what you\'ll do.',
    ],
    next: [
      // Vex's bargain pays off here: his guard stands down, and the chief and
      // the hag fight alone. The two choices are mutually exclusive on the flag.
      { id: 'fight-alone', label: 'End them both — Vex\'s guards stand aside', to: 'boss-unguarded',
        requires: [{ kind: 'flag', flag: 'vex-turned' }], hideWhenBlocked: true },
      { id: 'fight', label: 'End them both', to: 'boss',
        requires: [{ kind: 'notFlag', flag: 'vex-turned' }], hideWhenBlocked: true },
    ],
  },
  boss: {
    id: 'boss', kind: 'battle', encounterId: 'ashfang-warlord', mapId: 'firepit',
    intro: ['"You\'ve cost me a good season," the warlord says, almost mild, and rolls the great axe off his shoulder. Beside him the hag only laughs, low and pleased, her fingers already weaving something cold out of the smoke. "Oh, don\'t kill them quickly," she tells him. "Waste not."'],
    loot: { bonusTier: 'rare' }, // a warlord's hoard + a hag's trophies — guaranteed drop
    onWin: { to: 'aftermath', text: ['The warlord falls, and the **Reedwife** comes apart like wet reeds in a fist, her laughter curdling to a wail that sinks back into the marsh. The **Ashfang** are broken — root and branch.'],
      effects: [{ kind: 'setFlag', flag: 'chief-dead' }, { kind: 'setFlag', flag: 'hag-dead' }, { kind: 'gold', amount: 100 }] },
  },
  // The same hall with Vex's word kept: his guard finds somewhere else to be.
  'boss-unguarded': {
    id: 'boss-unguarded', kind: 'battle', encounterId: 'ashfang-warlord-alone', mapId: 'firepit',
    intro: [
      'The warlord bellows for his guard. Nothing answers. Somewhere back in the smoke, Vex is looking the other way on purpose.',
      '"You\'ve cost me a good season," the chief says anyway, almost mild, and rolls the great axe off his shoulder. The hag\'s laughter falters, just once, counting the blades that didn\'t come.',
    ],
    loot: { bonusTier: 'rare' },
    onWin: { to: 'aftermath', text: ['The warlord falls, and the **Reedwife** comes apart like wet reeds in a fist, her laughter curdling to a wail that sinks back into the marsh. The **Ashfang** are broken — root and branch.'],
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
    next: [
      { id: 'bounty', label: 'Claim the reeve\'s bounty for the chief\'s head', to: 'aftermath',
        requires: [{ kind: 'flag', flag: 'bounty' }, { kind: 'notFlag', flag: 'got-bounty' }],
        effects: [{ kind: 'gold', amount: 120 }, { kind: 'setFlag', flag: 'got-bounty' }] },
      { id: 'banner', label: 'Present the Ashfang banner for the bonus', to: 'aftermath',
        requires: [{ kind: 'flag', flag: 'looted' }, { kind: 'notFlag', flag: 'got-banner' }],
        effects: [{ kind: 'gold', amount: 60 }, { kind: 'setFlag', flag: 'got-banner' }] },
      { id: 'scout', label: 'Accept the scout\'s reward and her thanks', to: 'aftermath',
        requires: [{ kind: 'flag', flag: 'saved-scout' }, { kind: 'notFlag', flag: 'got-scout' }],
        effects: [{ kind: 'gold', amount: 50 }, { kind: 'setFlag', flag: 'got-scout' }] },
      { id: 'done', label: 'Raise a glass at the Wander-Inn', to: 'epilogue' },
    ],
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
      'The Ashfang banner burns in the square. Out past the reeds the marsh has gone strangely still. The black water is lower than anyone remembers, and the wrong-cold has lifted. It is as if something held its breath for years and finally let it out. The **Reedwife** is done. The carters have already started complaining about the state of the road. Mira says that is the surest sign a place has stopped being afraid.',
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
};
