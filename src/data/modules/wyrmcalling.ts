/**
 * "The Wyrmcalling" — Part 3 of the trilogy (docs/trilogy-plan.md): the
 * L4→5 finale. The Reedwife's two sisters come to collect what the company
 * owes the coven — by waking the Calling stone in the high hills and
 * whistling down every hungry thing that answers: wyrmlings from their dens,
 * giants promised a valley, elementals pulled through the seams the
 * Undercrypt's broken ward left thin.
 *
 * Shape: a war-camp hub (the valley musters at last) → the high hills, an
 * open traversal where the company PICKS ITS BATTLES — every den raided and
 * beast put down is one voice fewer when the Calling sounds — → the stone
 * itself. The mid fights are genuinely optional; the dens have a mechanical
 * payoff too (clear all three and the chromatic clutch never masses at the
 * gate).
 *
 * XP budget (trilogy-plan.md): required spine ≈ 9,450 (coven 750, the
 * flooded seam 1,800, the oni's hold 1,650, the giants' steading 1,650,
 * cataclysm finale 3,600); optional dens/beasts add up to ~6,000 more. A
 * continuing company (~3,050 XP from Part 2) that raids most of the hills
 * passes L5's 6,500 honestly; `xpToLevel: 5` on the finale win is the floor
 * for a fight-shy run. Cold starts are floored to L4 by the opening choice.
 *
 * MONSTER VARIETY: the top shelf, none of it fielded by Parts 1–2 — the hag
 * coven, harpies by night, a talking manticore, boar stampedes, three
 * chromatic wyrmlings (or their massed clutch), an ogre-mage's warband, an
 * ettin's steading, a gorgon, a water elemental, and the fire-and-earth
 * cataclysm at the stone.
 */
import type { Module, Scene } from '../../adventure/types.js';

const VEX = { id: 'npc-vex', name: 'Captain Vex', portraitId: 'npc-captain', emoji: '🗡️' };
const WREN = { id: 'npc-wren', name: 'Wren, Chief of Scouts', portraitId: 'npc-scout', emoji: '🏹' };
const BRAM = { id: 'npc-bram', name: 'Bram, War-Quartermaster', portraitId: 'npc-merchant', emoji: '🧑‍🌾' };

const scenes: Record<string, Scene> = {
  // === ACT 1 — THE MUSTER ================================================
  muster: {
    id: 'muster', kind: 'story', art: { imageId: 'loc-camp', emoji: '⚔️' },
    text: [
      'The valley has finally stopped waiting to be saved. Below the high hills a **war-camp** sprawls across the water-meadows. Thornwick\'s recruits stand there, fen-folk with boar-spears, carters turned pikemen. This time everyone can see the trouble coming. It stands on the skyline every night: fires in the high passes that no shepherd lit.',
      'The story runs ahead of you through the camp. The **Reedwife\'s sisters** have gone up into the hills. Two of them, tall as door-frames. Folk saw them at the fen\'s edge the night the barrows closed. Now they have woken something called the **Calling stone**. And the hills have begun to *answer*. Wyrmlings on the wing at dusk. Giant-sign in the orchards. Whole streams running the wrong way, as if the water had been called too.',
      'You are, by unanimous and unrequested acclaim, the company that broke the Ashfang and shut the Undercrypt. The camp parts around you like water around a keel, all the way to the command tent. Nobody says *it\'s your debt they\'re collecting*. Nobody has to.',
    ],
    next: [{ id: 'go', label: 'Report to the command tent', to: 'envoys',
      // Cold-start floor: a fresh company begins the finale at 4th level
      // (no-op for a company continuing from The Sunken Barrows).
      effects: [{ kind: 'xpToLevel', level: 4 },
        { kind: 'journal', entry: { id: 'q-calling', kind: 'quest', title: 'Silence the Calling',
          body: 'The Reedwife\'s sisters have woken the Calling stone in the high hills, summoning wyrms, giants, and worse down on the valley. Climb the passes, thin what answers the call, and break the stone.' } }] }],
    noBack: true,
  },
  envoys: {
    id: 'envoys', kind: 'battle', encounterId: 'hag-coven', mapId: 'open',
    intro: [
      'You are ten paces from the command tent when the camp\'s noise dies in a wave, like a hand closing over a bell. A woman now stands between you and the tent, though she was not there before. She is tall as a door-frame, with river-weed braided through her hair. Two sell-swords flank her, their eyes flat as coins already spent.',
      '"The company itself," the Reedwife\'s sister says, and smiles with too many of the wrong teeth. "My sister kept a whole marsh fed. You cost the family its *living*. We\'ve come to discuss the bill — and up on the hill, the collectors are already gathering." She flexes her green fingers. "Consider this the courtesy knock."',
    ],
    onWin: { to: 'envoys-won', text: ['The hag comes apart into reeds and river-water that was never a woman at all — a sending, spent. Her hired blades, being regrettably real, stay where they fall.'] },
  },
  'envoys-won': {
    id: 'envoys-won', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'The command tent\'s flap is already open. Inside: maps, lamplight, and a greying captain with a blade across his knees. He watches you duck in with the weary calm of a man whose worst guesses keep coming true. This is **Vex**. He was once the Ashfang\'s lieutenant. Now, by the valley\'s strange math, he is the man Thornwick trusts to run its war.',
      '"That was the second sending this week. You get used to it." He taps the map: the high passes, marked fire by fire. "Here\'s the arithmetic, sellswords. The stone *calls*; the hills *answer*. Wyrm-dens here, here, and here. An ogre-mage holding the middle pass with a warband. An ettin\'s steading above the tree-line. And things in the streams now that aren\'t fish. When the Calling peaks, all of it comes down this slope at once — unless it\'s already dead."',
      '"Every den you burn out is one voice fewer on the day. Pick your fights rich, pick them all if your legs hold. My scouts will keep the map honest." A thin smile, gone as fast. "I\'d come myself, but apparently I\'m *respectable* now. Nobody warns you about that part."',
    ],
    next: [{ id: 'on', label: 'Take the war-camp', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'briefed' },
        { kind: 'journal', entry: { id: 'n-vex3', kind: 'npc', title: 'Captain Vex',
          body: 'The Ashfang\'s old lieutenant now leads the valley war-camp. He is tired, careful, and right too often for anyone\'s comfort. His math is simple. Every den and beast you clear in the hills is one voice fewer when the Calling peaks.' } },
        { kind: 'journal', entry: { id: 'lead-stone', kind: 'lead', resolvedBy: 'calling-found',
          title: 'The Calling Stone', body: 'Somewhere past the oni\'s pass and the giants\' steading, the sisters tend the stone that calls the hills down. Climb until you find it.' } }] }],
  },
  warcamp: {
    id: 'warcamp', kind: 'explore',
    map: {
      title: 'The War-Camp', theme: 'ember', art: { imageId: 'loc-camp', emoji: '🏕️' },
      camp: {}, // safe: the one place in the valley with walls of spears
      nodes: [
        { id: 'command', x: 25, y: 30, label: 'The Command Tent', icon: 'tok-fire', scene: 'command',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'briefed' }], to: 'command-done' }] },
        { id: 'stores', x: 50, y: 45, label: 'The War-Stores', icon: 'tok-market', scene: 'wc-stores' },
        { id: 'scouts', x: 30, y: 70, label: 'The Scouts\' Fire', icon: 'tok-camp', scene: 'scouts-fire',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'wren-brief' }], to: 'scouts-done' }] },
        { id: 'trailhead', x: 80, y: 60, label: 'The High Trail', icon: 'tok-gate', scene: 'hills-out',
          requires: [{ kind: 'flag', flag: 'briefed' }] },
      ],
    },
  },
  command: {
    id: 'command', kind: 'story', art: { emoji: '🗺️' },
    text: ['The command tent, minus its captain\'s patience: Vex is mid-argument with three recruits about guard rotations, conducting with a map-weight. He spares you a nod that means *the hills are that way and you know your business*. It is, from Vex, effusive.'],
    next: [{ id: 'ok', label: 'Leave him to the war', to: 'warcamp' }],
  },
  'command-done': {
    id: 'command-done', kind: 'story', art: { emoji: '🗺️' },
    text: ['The command tent hums on. Guard-posts, rations, the grinding work of keeping frightened people pointed the right way. Vex\'s map grows a new pin for every fight you win in the hills. He\'d never say so, but he keeps them in a tidy little row.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
  },
  'wc-stores': { id: 'wc-stores', kind: 'shop', title: 'The War-Stores', next: 'warcamp',
    npc: BRAM,
    intro: ['Bram has annexed a supply wagon and, by the look of it, the war effort\'s entire pricing authority. "War inflates everything but my margins, which I keep honest out of patriotism. Also the captain checks my ledgers." He turns a crate to face you. "Big things up that hill. Buy accordingly."'] },
  'scouts-fire': {
    id: 'scouts-fire', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    lines: [
      '**Wren** runs the scouts\' fire now — three young riders hanging on her every shrug, a map of the passes weighted down with arrowheads. Chief of Scouts, at her age. She wears it like a coat that fits and embarrasses her anyway.',
      '"Right, listen." All business, jabbing the map. "The **manticore** on the toll-cliff *talks* — don\'t. The **boar-runs** flood with stampede twice a day; time it or go through it. There\'s a vale past the middle pass where the statues are too good — count the sculptors, find none, *stay out or go in blade-first*." She looks up. "And the streams are walking. I don\'t have a note for that. I just have where they walk."',
      'A beat. "Third time we do this, you know. Horse, fen, mountain." She almost smiles. "Try to come down the hill on your feet. It\'s traditional now."',
    ],
    next: [{ id: 'ok', label: 'Take her map-notes', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'wren-brief' }, { kind: 'xp', amount: 30 },
        { kind: 'journal', entry: { id: 'c-scoutnotes', kind: 'clue', title: 'Wren\'s Map-Notes',
          body: 'The manticore on the toll-cliff talks (don\'t). The boar-runs stampede. The vale of statues has no sculptors — a gorgon\'s work. And the streams themselves are walking the hills.' } }] }],
  },
  'scouts-done': {
    id: 'scouts-done', kind: 'story', art: { emoji: '🏹' },
    text: ['The scouts\' fire crackles through another shift-change. Wren\'s riders come and go with the tidy urgency she\'s drilled into them; her map of the passes grows more arrowheads by the hour. She flicks you a two-finger salute without looking up.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
  },
  'hills-out': {
    id: 'hills-out', kind: 'story', art: { imageId: 'loc-hills', emoji: '⛰️' },
    text: ['The high trail leaves the last lookout behind at a stone marker the recruits have taken to saluting. Above, the hills stack into the sky, pass over pass. Over the highest of them, faint as a held note, you hear it for the first time: the **Calling**. It is not so much a sound as a *pull*. It feels like a door standing open somewhere above the weather.'],
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
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'tollcliff-cleared' }], to: 'tollcliff-done' }] },
        { id: 'boarruns', x: 30, y: 86, label: 'The Boar-Runs', mystery: 'Drumming underfoot…', icon: 'tok-danger', scene: 'boarruns',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'boarruns-cleared' }], to: 'boarruns-done' }] },
        { id: 'greenden', x: 38, y: 48, label: 'The Green Den', mystery: 'A reek of chlorine…', icon: 'tok-cave', scene: 'greenden',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'green-cleared' }], to: 'greenden-done' }] },
        { id: 'seam', x: 50, y: 66, label: 'The Flooded Seam', mystery: 'A stream running uphill…', icon: 'tok-crossing', scene: 'seam',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'seam-cleared' }], to: 'seam-done' }] },
        { id: 'blueden', x: 58, y: 30, label: 'The Blue Mesa', mystery: 'Ozone and thunder…', icon: 'tok-cave', scene: 'blueden',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'blue-cleared' }], to: 'blueden-done' }] },
        { id: 'onihold', x: 68, y: 56, label: 'The Middle Pass', mystery: 'A horn, answered…', icon: 'tok-ruin', scene: 'onihold',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'oni-cleared' }], to: 'onihold-done' }] },
        { id: 'redden', x: 74, y: 22, label: 'The Burning Den', mystery: 'Smoke without fire-line…', icon: 'tok-fire', scene: 'redden',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'red-cleared' }], to: 'redden-done' }] },
        { id: 'gorgonvale', x: 84, y: 78, label: 'The Vale of Statues', mystery: 'Too-good statues…', icon: 'tok-mystery', scene: 'gorgonvale',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'gorgon-cleared' }], to: 'gorgonvale-done' }] },
        { id: 'steading', x: 88, y: 44, label: 'The Giants\' Steading', mystery: 'Smoke above the tree-line…', icon: 'tok-house', scene: 'steading',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'steading-cleared' }], to: 'steading-done' }] },
        // The den-raiding payoff routes here: beat the clutch (or never let it
        // mass) and later visits cross a quiet ridge; clear all three dens and
        // the brood never masses at all. First matching sceneWhen wins.
        { id: 'callinggate', x: 95, y: 20, label: 'The Last Ridge', mystery: 'The pull, stronger…', icon: 'tok-boss', scene: 'calling-gate',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }, { kind: 'flag', flag: 'steading-cleared' }],
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'clutch-beaten' }], to: 'ridge-quiet' },
            { if: [{ kind: 'flag', flag: 'green-cleared' }, { kind: 'flag', flag: 'blue-cleared' }, { kind: 'flag', flag: 'red-cleared' }], to: 'calling-gate-clear' },
          ] },
      ],
    },
  },
  switchbacks: {
    id: 'switchbacks', kind: 'story', art: { imageId: 'loc-hills', emoji: '👣' },
    text: [
      'The switchbacks climb through abandoned shielings and drystone folds, and the higher you go the less the hills bother pretending. Wyrm-sign on the scree — three sizes of it, three *colours* of scorch and stain. A boulder with a hand-print in it, if hands came in half-doors. And everywhere, cutting straight across the trails, the tracks of running water where no water should run.',
      'The Calling threads through it all, patient as gravity. Everything on this mountain is being pulled toward the same high place. Everything you put down between here and there is one thing fewer that answers.',
    ],
    next: [{ id: 'on', label: 'Pick your fights', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'hills-read' }] }],
  },
  'switchbacks-done': {
    id: 'switchbacks-done', kind: 'story', art: { emoji: '👣' },
    text: ['The switchbacks wind on below you, familiar now. The wyrm-sign hasn\'t refreshed — what you\'ve cleared has stayed cleared. The Calling still pulls at the edge of hearing, thinner than it was.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'hills-night': {
    id: 'hills-night', kind: 'battle', encounterId: 'harpy-roost', mapId: 'open',
    intro: ['The singing starts an hour after you bank the fire — sweet, wrong, and closing. Harpies, riding the night wind down from the crags, their song plucking at your legs to *stand up, walk off the edge, it\'s not far*. You wake in time. Mostly because the sentry threw a boot.'],
    onWin: { to: '@hub', text: ['The harpies flap away broken-voiced into the dark, and the night is officially unslept. You bank the fire and count the watch until a grey, unmusical dawn.'] },
  },
  tollcliff: {
    id: 'tollcliff', kind: 'story', art: { emoji: '🦁' },
    text: [
      'The trail pinches under an overhang, and the overhang has an occupant. The **manticore** is draped along it like a lord at dinner. It has lion-bulk, bat-wings, and a tail of black spikes. Its face is horribly, chattily human.',
      '"Toll," it says, in a voice like a purr dragged over gravel. "Everything that walks my cliff pays. The goblins paid in sheep. The hags paid in *promises*." Its grin widens by one tooth too many. "You look like the sort that pays in something red."',
    ],
    next: [
      { id: 'fight', label: 'Pay it in steel', to: 'tollcliff-fight' },
      { id: 'leave', label: 'Back down the pinch — find another way', to: 'hills' },
    ],
  },
  'tollcliff-fight': {
    id: 'tollcliff-fight', kind: 'battle', encounterId: 'manticore-cliff', mapId: 'ruins',
    intro: ['"*Steel*, then," the manticore sighs, sounding truly put out. Its tail comes over its shoulder like a drawn bow. From the rocks behind it, two goblin lackeys scramble up with spears. They are sheep-payers, most likely, working off a debt.'],
    onWin: { to: 'hills', text: ['The manticore crashes to the trail with a last, offended "*…toll*". Its lackeys bolt for lower ground and a better boss. The hoard in the overhang holds ten years of tolls, paid by frightened travellers.'],
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, { kind: 'gold', amount: 110 }] },
  },
  'tollcliff-done': {
    id: 'tollcliff-done', kind: 'story', art: { emoji: '🦁' },
    text: ['The toll-cliff overhang stands vacant, its hoard-niche picked clean. The trail below passes free of charge — a novelty the local shepherds may take a generation to trust.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  boarruns: {
    id: 'boarruns', kind: 'story', art: { emoji: '🐗' },
    text: [
      'A dry gully crosses the trail here, floored with churned earth and shed bristles — the **boar-runs**, and the drumming underfoot says the herd is inbound. These aren\'t farm pigs. The prints are the size of wash-basins, and something has been *goading* the herd uphill, day after day: the Calling wants its beasts angry and moving.',
      'You can wait half a day for the runs to clear. Or you can meet the stampede where it narrows and thin the herd for good.',
    ],
    next: [
      { id: 'fight', label: 'Meet the stampede at the narrows', to: 'boarruns-fight' },
      { id: 'wait', label: 'Wait out the runs and slip across', to: 'hills' },
    ],
  },
  'boarruns-fight': {
    id: 'boarruns-fight', kind: 'battle', encounterId: 'boar-stampede', mapId: 'open',
    intro: ['The drumming becomes weather. Two boars the size of hay-carts come down the narrows shoulder to shoulder. Their tusks are like ploughshares, their eyes mad with the Calling. And the narrows, you now see, narrow *behind* you as well.'],
    onWin: { to: 'hills', text: ['The stampede breaks around its fallen leaders and scatters downslope, called or not. The herd will keep to the low country now. The war-camp below is spared a battering-ram with opinions.'],
      effects: [{ kind: 'setFlag', flag: 'boarruns-cleared' }, { kind: 'gold', amount: 40 }] },
  },
  'boarruns-done': {
    id: 'boarruns-done', kind: 'story', art: { emoji: '🐗' },
    text: ['The boar-runs lie quiet, the churned earth already greening at the edges. The herd keeps to the valleys now, having developed a well-founded opinion about the narrows.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  greenden: {
    id: 'greenden', kind: 'battle', encounterId: 'green-dragon-den', mapId: 'marsh',
    intro: [
      'The thicket smells of cut grass gone wrong — chlorine and rot, the calling-card of a **green wyrmling**. Its den is a tunnel of strangled briar. The floor is a bed of picked bones, left by everything that mistook *young* for *safe*. Its kobold pack is already shrieking the alarm.',
      'The wyrmling slides out of the briar like an eel out of a wall, and its grin is a dragon\'s grin at any age. One voice for the Calling — unless you silence it here.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling collapses mid-hiss, poison-breath curdling to harmless reek, and its kobolds flee squeaking into the briar. One voice fewer for the Calling — and the den\'s little hoard rides out in your packs.'],
      effects: [{ kind: 'setFlag', flag: 'green-cleared' }, { kind: 'gold', amount: 75 }] },
  },
  'greenden-done': {
    id: 'greenden-done', kind: 'story', art: { emoji: '🌿' },
    text: ['The green den\'s briar-tunnel stands silent, its chlorine reek fading to honest rot. The hills hold one wyrm fewer.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  seam: {
    id: 'seam', kind: 'story', art: { emoji: '🌊' },
    text: [
      'Here is Wren\'s walking stream. A mountain beck runs *up* the seam of the pass, briskly, against all persuasion of gravity. And where it pools at the top, the pool has a shape. Shoulders. A suggestion of patience.',
      'The Undercrypt\'s ward kept more doors shut than one. This came through a seam the broken vigil left thin. The Calling is holding it here like a stopper in the pass. The road to the middle pass runs straight through its pool.',
    ],
    next: [{ id: 'fight', label: 'Break the water', to: 'seam-fight' }],
  },
  'seam-fight': {
    id: 'seam-fight', kind: 'battle', encounterId: 'water-vortex', mapId: 'bog',
    intro: ['The pool stands up. Twelve feet of mountain water in the rough draft of a giant, cold as the seam it came through. It hits like the flood it technically is. The **water elemental** does not roar. It simply *pours* — at you.'],
    onWin: { to: 'hills', text: ['The elemental loses its argument with gravity all at once, collapsing into a hundred gallons of ordinary beck that hurries away downhill as if embarrassed. The seam behind it sighs shut. The pass is open.'],
      effects: [{ kind: 'setFlag', flag: 'seam-cleared' }, { kind: 'gold', amount: 50 }] },
  },
  'seam-done': {
    id: 'seam-done', kind: 'story', art: { emoji: '💧' },
    text: ['The beck runs downhill now, as becks should, chattering over the stones with no shape in it at all. The seam it came through stays shut.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  blueden: {
    id: 'blueden', kind: 'battle', encounterId: 'blue-dragon-den', mapId: 'ruins',
    intro: [
      'The mesa smells of storms. A **blue wyrmling** has claimed the old watchtower ruin at its crown. Its kobolds have been *busy*. Copper rods are lashed to every standing wall, a nest wired like a storm-cloud waiting to go off.',
      'The wyrmling uncoils along a broken wall, crackling with pride, and the air goes sharp and metallic. It has clearly been told it is going to be enormous someday. It has not been told about you.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling drops from the wall trailing dead sparks. Its kobolds\' lightning-farm shorts into scrap. The mesa\'s hoard was tribute saved for a dragon\'s future. It funds a company\'s present instead.'],
      effects: [{ kind: 'setFlag', flag: 'blue-cleared' }, { kind: 'gold', amount: 95 }] },
  },
  'blueden-done': {
    id: 'blueden-done', kind: 'story', art: { emoji: '⚡' },
    text: ['The mesa\'s ruin stands quiet, its copper rods already greening. The storms overhead are just weather now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  onihold: {
    id: 'onihold', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: [
      'The middle pass is held. Not squatted in. *Held*, with a soldier\'s eye. A drystone hold rebuilt in a week by hands that lift boulders like bread. Guard-posts of sharpened pine. A horn on the wall that has already sounded once.',
      'On the wall above the gate stands the holder. An **ogre-mage**, blue-skinned and beautiful in lacquered scraps of ancient armour. The look it gives you down the pass is the worst thing in the hills so far. *Intelligent*. "The stone sings," it calls down, pleasantly. "We answered first, and the first to answer holds the door. Toll, tithe, or try us, little debtors."',
    ],
    next: [{ id: 'fight', label: 'Try them', to: 'onihold-fight' }],
  },
  'onihold-fight': {
    id: 'onihold-fight', kind: 'battle', encounterId: 'oni', mapId: 'corridor',
    intro: ['The horn sounds twice. The gate opens on the oni\'s honour-guard: an ogre with a knocked-together maul and an orc veteran in stolen mail. Then the ogre-mage itself rises from the wall on a cold wind, blade in hand. It darkens the air around it like ink in water.'],
    onWin: { to: 'hills', text: ['The ogre-mage falls out of its own darkness, astonished to the last, and its warband breaks with it. The middle pass stands open now, the road to the steading and the stone. The hold\'s war-chest is yours, fair and square.'],
      effects: [{ kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'gold', amount: 130 }] },
  },
  'onihold-done': {
    id: 'onihold-done', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The middle-pass hold stands empty, its horn silent on the wall. Wren\'s scouts have already been through and chalked their mark by the gate: a small, tidy arrowhead, pointing up.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  redden: {
    id: 'redden', kind: 'battle', encounterId: 'red-dragon-den', mapId: 'firepit',
    intro: [
      'You smell the burning den before you see it: woodsmoke with a mineral edge. It marks a scorched bowl of hillside where a **red wyrmling** has made itself a forge-hall of split rock and cinders. Kobolds tend heaps of part-melted tribute with the care of bank clerks.',
      'The wyrmling itself lies on the largest heap, one eye open. Red wyrms are the proudest of a proud family, and this one has been promised a *war*. It rises burning with its own light, delighted you\'ve saved it the flight down.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling\'s fire dies from the inside out, leaving it merely, finally small. Its part-melted hoard cools in lumps — heavy, honest lumps, the kind Bram will weigh twice and pay well for.'],
      effects: [{ kind: 'setFlag', flag: 'red-cleared' }, { kind: 'gold', amount: 120 }] },
  },
  'redden-done': {
    id: 'redden-done', kind: 'story', art: { emoji: '🔥' },
    text: ['The burning den has gone out. Rain has already found the scorched bowl, and something green and entirely unimpressed by dragons is growing in the ash.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  gorgonvale: {
    id: 'gorgonvale', kind: 'story', art: { emoji: '🗿' },
    text: [
      'Wren\'s vale. The statues are, as advertised, too good. A shepherd mid-stride, arm flung up. A wolf caught turning. A hag\'s sell-sword with his blade half-drawn and an expression you can read at thirty paces. No sculptor ever chose these subjects. No sculptor was ever this *fast*.',
      'At the vale\'s head stands a bull of black iron plates, cropping the grass between its own masterworks. A **gorgon**, steam curling from its nostrils in the cold. The Calling has drawn it down from some higher, worse pasture. It hasn\'t noticed you yet. The statues suggest that state of affairs tends not to last.',
    ],
    next: [
      { id: 'fight', label: 'Go in blade-first', to: 'gorgonvale-fight' },
      { id: 'leave', label: 'Take Wren\'s advice — stay out', to: 'hills' },
    ],
  },
  'gorgonvale-fight': {
    id: 'gorgonvale-fight', kind: 'battle', encounterId: 'gorgon-maze', mapId: 'corridor',
    intro: ['The gorgon\'s head comes up, and its breath comes with it: a rolling green vapour that turns the grass it touches to grey stems of stone. It charges through its own statues, iron plates thundering. The vale becomes a maze of the petrified with you inside it.'],
    onWin: { to: 'hills', text: ['The gorgon crashes onto its side with a sound like a foundry falling downstairs, and the green vapour thins to nothing. The vale\'s statues keep their vigil — but the collection, at least, is closed.'],
      effects: [{ kind: 'setFlag', flag: 'gorgon-cleared' }, { kind: 'gold', amount: 100 }] },
  },
  'gorgonvale-done': {
    id: 'gorgonvale-done', kind: 'story', art: { emoji: '🗿' },
    text: ['The vale of statues stands in permanent, silent company. Moss will take them in time, and shepherds will tell stories about them for longer. Nothing crops the grass between them now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  steading: {
    id: 'steading', kind: 'battle', encounterId: 'giants', mapId: 'ruins',
    intro: [
      'Above the tree-line stands the steading. It is a hall of whole pine trunks and doorway-sized stone blocks. Something built it in a season, treating the work as mere stacking. The **ettin** that holds it comes out at the first scrape of your boots. It is two heads arguing over one enormous body. An ogre lieutenant and an orc runner scramble in its wake.',
      '"THE STONE PROMISED US THE VALLEY," booms the left head. "*I* heard the stone promise *me* the valley," corrects the right. Both heads notice you at the same time, and for the first time all day, agree.',
    ],
    onWin: { to: 'hills', text: ['The ettin goes down still bickering about whose fault it was. Its followers do not stay to settle the argument. The steading\'s hall stands open. Inside is tribute, plunder, and one entire pickled orchard, all bound for the war-camp below. The last strong voice on the mountain is out of the choir.'],
      effects: [{ kind: 'setFlag', flag: 'steading-cleared' }, { kind: 'gold', amount: 140 }] },
  },
  'steading-done': {
    id: 'steading-done', kind: 'story', art: { emoji: '🏚️' },
    text: ['The giants\' steading stands hollow, its doorway a bright rectangle of sky. Vex will want the hall for a forward post; Wren\'s scouts have already claimed the roof.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },

  // === ACT 3 — THE CALLING ===============================================
  // The clutch path: any wyrm den left standing means the brood masses on
  // the ridge and must be fought through to reach the stone.
  'calling-gate': {
    id: 'calling-gate', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [
      'The last ridge. The Calling is no longer a pull here — it is a *pressure*, a note held so long the mountain hums it back. Beyond the ridge-line, a corrie of bare rock cups the sky. At its centre stands the **stone**. A single black fang, old past guessing, wrapped in a light that bruises to look at.',
      'And on the wind, wingbeats. The corrie\'s rim is the wyrms\' gathering ground. What remains of the brood is *gathering to answer you back*. It is the question you\'ve been answering, den by den, all the way up the mountain.',
    ],
    next: [{ id: 'on', label: 'Meet the clutch on the rim', to: 'clutch-fight',
      effects: [{ kind: 'setFlag', flag: 'calling-found' }] }],
    noBack: true,
  },
  // The den-raiding payoff: all three dens emptied, so the brood never masses.
  'calling-gate-clear': {
    id: 'calling-gate-clear', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [
      'The last ridge. The Calling is no longer a pull here — it is a *pressure*, a note held so long the mountain hums it back. Beyond the ridge-line, a corrie of bare rock cups the sky. At its centre stands the **stone**. A single black fang, old past guessing, wrapped in a light that bruises to look at.',
      'And overhead — nothing. The corrie\'s rim is a gathering ground with no gathering. You emptied the dens one by one on the way up. The sky the Calling promised its wyrms is clean. You cross the ridge unopposed, which is what thoroughness buys.',
    ],
    next: [{ id: 'on', label: 'Down into the corrie', to: 'calling-approach',
      effects: [{ kind: 'setFlag', flag: 'calling-found' }, { kind: 'setFlag', flag: 'clutch-skipped' }] }],
    noBack: true,
  },
  'ridge-quiet': {
    id: 'ridge-quiet', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: ['The ridge lies quiet, the broken brood scattered or still. Below, the corrie and the stone wait, bruise-lit and patient.'],
    next: [{ id: 'on', label: 'Down into the corrie', to: 'calling-approach' }], noBack: true,
  },
  'clutch-fight': {
    id: 'clutch-fight', kind: 'battle', encounterId: 'chromatic-clutch', mapId: 'open',
    intro: ['They come over the rim together: the brood of the high hills, every wyrmling the Calling could still summon. They are black and green and white, shrieking in three keys of greed. The dens you emptied stay empty. The ones you didn\'t are all here, and they have decided the debt is *theirs* to collect.'],
    onWin: { to: 'calling-approach', text: ['The last wyrmling drops out of the bruised light and does not rise. The rim is yours. The hollow below waits. The stone\'s note wavers, as if it has just noticed how few voices are left to answer it.'],
      effects: [{ kind: 'setFlag', flag: 'clutch-beaten' }] },
  },
  'calling-approach': {
    id: 'calling-approach', kind: 'story', art: { imageId: 'loc-cave', emoji: '🗿' },
    text: [
      'Down in the corrie, at the stone\'s foot, the **sisters** are waiting. Two of them, tall as door-frames, green fingers sunk to the knuckle in the black rock — and this close you understand, finally, what the Calling is. They are not commanding the stone. They are *spending themselves into it*. Hair gone to river-weed and wire. Faces burning down like tallow. Two long lives poured through a fang of old rock to hold a door open.',
      '"Sister-killers," they say, in one voice, without turning. "Vigil-breakers. Debt is debt, and we are *almost done paying it into the hills*. Everything that answers is yours to keep." The stone\'s light thickens. The ground under it begins, gently, to burn. "But you came so far. Stay. The last of the collection is just arriving — out of the fire, and out of the ground."',
    ],
    next: [{ id: 'fight', label: 'Break the stone, and the sisters with it', to: 'calling-battle' }],
  },
  'calling-battle': {
    id: 'calling-battle', kind: 'battle', encounterId: 'elemental-cataclysm', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The sisters pour the last of themselves through the stone, and the stone SPENDS it. The corrie floor splits along a burning seam. What comes through is the debt made flesh at last. A roaring pillar of living fire. The mountain\'s own bones shrugging up into a shape with fists. The sisters collapse into drifts of dry reeds, smiling. The Calling\'s final note is a cataclysm, and it has your name in it.'],
    onWin: { to: 'calling-won', text: ['The fire gutters out of the air. The stone shape shakes itself back into loose rubble. The black fang has nothing left to spend, and no one left to spend it. It cracks from top to bottom and goes silent. The Calling does not end with thunder. It ends with the huge, ringing quiet of a note finally let go.'],
      effects: [{ kind: 'xpToLevel', level: 5 }, { kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  'calling-won': {
    id: 'calling-won', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌅' },
    text: [
      'Where the sisters stood there is only a scatter of dry reeds, already lifting on the wind. The debt they came to collect burned up in the collecting. The coven\'s long ledger closed, in the end, by the coven itself. The company that owed it stands whole on a quiet mountain, which is more than most debtors manage.',
      'Below, pass by pass, the hills are going still. Whatever was walking toward the stone lies down where it stands. The wingbeats fade off the wind. Somewhere far downslope, faint and disbelieving, the war-camp starts to cheer.',
    ],
    next: [{ id: 'down', label: 'Come down the mountain', to: 'wc-aftermath' }],
  },
  'wc-aftermath': {
    id: 'wc-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      'You come down the hill on your feet. Traditional now. You walk into a camp that has stopped being an army. It has started being the biggest festival the valley has ever thrown. Vex shakes your hand like a man signing off on a ledger he never expected to balance. "Three for three," he says. "Do stop before the odds notice."',
      'Wren says nothing at all. She just looks at the four of you, and up at the quiet hills, and grins her whole age for once. Then she remembers she is Chief of Scouts, coughs, and asks for your route report.',
    ],
    next: [
      { id: 'pay', label: 'Accept the valley\'s purse — every village paid in', to: 'wc-aftermath',
        requires: [{ kind: 'notFlag', flag: 'wc-paid' }],
        effects: [{ kind: 'gold', amount: 250 }, { kind: 'setFlag', flag: 'wc-paid' }] },
      { id: 'done', label: 'Let the valley celebrate', to: 'wc-epilogue' },
    ],
  },
  'wc-defeat': {
    id: 'wc-defeat', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏕️' },
    text: [
      'You wake in the camp\'s hospital tent to canvas-light and the smell of Bram\'s cooking, which is a punishment nobody voted for. Wren\'s scouts carried you down again, in relays. It is a tradition everyone would happily retire.',
      'Vex looks in, notes that you\'re breathing, and puts your kit at the foot of the cot without a word. The hills are still up there. The stone is still calling. The arithmetic hasn\'t changed — it\'s just waiting.',
    ],
    next: [{ id: 'up', label: 'Back on your feet', to: 'warcamp' }], noBack: true,
  },
  'wc-epilogue': {
    id: 'wc-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'The valley remembers it as the year of the three wars. The raiders, the graves, and the hills. The same four names run through all three stories like a bright thread. The Ashfang broken. The Undercrypt sealed. The Calling silenced, and the coven\'s long debt burned to reeds on a mountain wind.',
      'Mira pours the first round on the house, the second without being asked. The third comes with the observation that heroes drink no more carefully than anyone else. The reeve commissions a plaque. Wren corrects its geography. Vex has seen every side of this valley\'s troubles, and finally picked the right one. He raises a quiet glass to the four of you. To **the Free Company**, paid in full, and free indeed.',
    ],
  },
};

export const WYRMCALLING_MODULE: Module = {
  id: 'wyrmcalling', title: 'The Wyrmcalling',
  blurb: 'The Reedwife\'s sisters wake the Calling stone, and the hills answer — wyrms, giants, and worse. Climb, thin the choir, and silence it.',
  cover: 'loc-mountain',
  levelBand: { from: 4, to: 5 },
  start: 'muster', scenes, defeatScene: 'wc-defeat', town: 'warcamp',
};
