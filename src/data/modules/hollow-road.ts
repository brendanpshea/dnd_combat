/**
 * "The Hollow Road" — the campaign module: an original, SRD-safe ~2-hour
 * adventure in three acts (village hub → wilderness trail → raider hideout →
 * boss), the deliverable that proves the whole adventure system end to end.
 *
 * Design targets from docs/adventure-mode-plan.md: ~25 scenes, 3 explore maps,
 * combat never more than 3–4 scenes away, two avoidable fights, skill variety
 * across the 18-skill list, and an epilogue that reads flags back so choices
 * visibly mattered. Zero new stat blocks — every fight reuses an existing
 * encounter. All content is original; no published module text is reproduced.
 */
import type { Module, Scene } from '../../adventure/types.js';

// NPCs name a reusable archetype `portraitId` (src/data/adventure-art.ts) so
// they share art with every other module's innkeeper / scout / captain; the
// emoji is the fallback until that portrait is generated.
const MIRA = { id: 'npc-mira', name: 'Mira the Innkeeper', portraitId: 'npc-innkeeper', emoji: '🍺' };
const SCOUT = { id: 'npc-scout-hr', name: 'Wounded Scout', portraitId: 'npc-wounded', emoji: '🤕' };
const LIEUTENANT = { id: 'npc-vex', name: 'Vex, the Lieutenant', portraitId: 'npc-captain', emoji: '🗡️' };

const scenes: Record<string, Scene> = {
  // === ACT 1 — THORNWICK (village hub) ===================================
  start: {
    id: 'start', kind: 'story', art: { imageId: 'loc-village', emoji: '🏘️' },
    text: [
      'The village of **Thornwick** huddles under grey hills, its gate scorched, its people watching you from shuttered windows.',
      'For a month the **Ashfang raiders** have bled the road dry — burned barns, emptied larders, carried off anyone caught after dark.',
      'The reeve\'s bounty drew you up the valley. But it was the plea nailed beneath it, in a shakier hand, that made you come: "Help us. There is no one else."',
    ],
    next: [{ id: 'go', label: 'Enter the Wander-Inn', to: 'tavern',
      effects: [{ kind: 'journal', entry: { id: 'q-main', kind: 'quest', title: 'Break the Ashfang', body: 'Mira, who keeps the Wander-Inn, begged your help against the Ashfang raiders bleeding Thornwick dry. Learn where they den — the market and the marsh road are the places to ask — then end them.' } }] }],
  },
  // The tavern is a small loop, not a one-way door (#6): each social read is a
  // `once` choice that returns you here, so you can try Insight *and*
  // Persuasion but never re-roll either. "Head to the square" is the way out.
  tavern: {
    id: 'tavern', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      'Inside the **Wander-Inn**, the fire is low and the talk lower. A broad woman with flour on her sleeves sets down a cloth and looks you over.',
      '"Sellswords, are you? Good." **Mira** doesn\'t smile. "The reeve\'s too proud to beg, so I\'ll do it for him."',
      '"The **Ashfang** came down the **marsh road**, out past the reeds. That much everyone knows. But there\'s more that folk won\'t say with the door open…"',
    ],
    next: [
      { id: 'insight', label: '[Insight DC 12] Something she\'s holding back?', to: 'tavern-spy',
        once: true, check: { skill: 'insight', dc: 12, failTo: 'tavern-plain' } },
      { id: 'persuade', label: '[Persuasion DC 12] Buy the room a round', to: 'tavern-trail',
        once: true, check: { skill: 'persuasion', dc: 12, failTo: 'tavern-plain' } },
      { id: 'plain', label: 'Just ask the way', to: 'tavern-plain', once: true },
      { id: 'leave', label: 'Head out to the square', to: 'square' },
    ],
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

  square: {
    id: 'square', kind: 'explore',
    map: {
      title: 'Thornwick Square', theme: 'stone', art: { imageId: 'loc-village', emoji: '⛲' },
      camp: {}, // safe: rest freely in town
      nodes: [
        { id: 'inn', x: 20, y: 30, label: 'The Wander-Inn', icon: 'tok-tavern', scene: 'tavern' },
        { id: 'market', x: 40, y: 40, label: 'Market', icon: 'tok-market', scene: 'market' },
        { id: 'board', x: 70, y: 28, label: 'Notice Board', icon: 'tok-notice', scene: 'board' },
        { id: 'informant', x: 48, y: 66, label: 'Furtive Peddler', icon: 'tok-figure', scene: 'spy-confront',
          requires: [{ kind: 'flag', flag: 'know-spy' }],
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'spy-caught' }], to: 'spy-gone' }] },
        { id: 'gate', x: 82, y: 78, label: 'Leave for the Marsh Road', icon: 'tok-gate', scene: 'trailhead' },
      ],
    },
  },
  market: { id: 'market', kind: 'shop', title: 'Thornwick Market', next: 'square',
    npc: { id: 'npc-quartermaster', name: 'Bram the Quartermaster', portraitId: 'npc-merchant', emoji: '🧑‍🌾' },
    intro: ['"Coin\'s coin, sellsword. Buying, or have you got something to shift?"'] },
  board: {
    id: 'board', kind: 'story', art: { emoji: '📜' },
    text: ['A weathered bounty: the reeve promises coin for proof the Ashfang chief is dead — and more for their banner.'],
    next: [
      // `once` so the reeve's retainer can't be re-claimed by revisiting the board.
      { id: 'ok', label: 'Take the retainer (+25 gold)', to: 'square', once: true,
        effects: [{ kind: 'setFlag', flag: 'bounty' }, { kind: 'gold', amount: 25 },
          { kind: 'journal', entry: { id: 'c-bounty', kind: 'clue', title: 'The Reeve\'s Bounty', body: 'Extra reward for the Ashfang banner as proof.' } }] },
      { id: 'leave', label: 'Turn away', to: 'square' },
    ],
  },
  'spy-confront': {
    id: 'spy-confront', kind: 'dialogue', npc: { id: 'npc-peddler', name: 'The Peddler', portraitId: 'npc-merchant', emoji: '🕵️' },
    art: { emoji: '🕵️' },
    lines: ['A peddler you\'ve seen watching the gate too closely goes stiff as you approach.'],
    next: [
      { id: 'investigate', label: '[Investigation DC 13] Search his wares', to: 'spy-caught',
        once: true, check: { skill: 'investigation', dc: 13, failTo: 'spy-bolts' } },
      { id: 'intimidate', label: '[Intimidation DC 14] "Talk. Now."', to: 'spy-caught',
        once: true, check: { skill: 'intimidation', dc: 14, failTo: 'spy-bolts' } },
      { id: 'leave', label: 'Let him be', to: 'square' },
    ],
  },
  'spy-caught': {
    id: 'spy-caught', kind: 'story', art: { emoji: '🔗' },
    text: ['Under the false bottom: a raider tally of every caravan. He talks — the den\'s watch expects a signal you can now fake.'],
    next: [{ id: 'ok', label: 'Hand him to the reeve', to: 'square',
      effects: [{ kind: 'setFlag', flag: 'spy-caught' }, { kind: 'setFlag', flag: 'know-signal' }, { kind: 'gold', amount: 40 },
        { kind: 'journal', entry: { id: 'c-signal', kind: 'clue', title: 'The Watch-Signal', body: 'The spy gave up the raiders\' gate signal — the den\'s watch can be fooled.' } }] }],
  },
  'spy-bolts': {
    id: 'spy-bolts', kind: 'battle', encounterId: 'kobolds', mapId: 'ruins',
    intro: ['The peddler whistles — and his hired knives spill from the alley!'],
    onWin: { to: 'square', text: ['The thugs scatter. The peddler is gone, but so is his cover.'],
      effects: [{ kind: 'setFlag', flag: 'spy-caught' }] },
  },

  // === ACT 2 — THE MARSH ROAD (wilderness) ==============================
  trailhead: {
    id: 'trailhead', kind: 'story', art: { imageId: 'loc-marsh', emoji: '🌫️' },
    text: [
      '**Thornwick** falls away behind you, and the **marsh road** takes its place: a ribbon of mud between black water and whispering reeds.',
      'Somewhere out in that maze the **Ashfang** have their den. Somewhere closer, the trail bites back.',
    ],
    next: [{ id: 'go', label: 'Into the marsh', to: 'trail' }],
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
      paths: [['tracks', 'ravine'], ['tracks', 'scout'], ['ravine', 'approach']],
      nodes: [
        { id: 'tracks', x: 18, y: 55, label: 'Fresh Tracks', icon: 'tok-tracks', scene: 'tracks' },
        { id: 'scout', x: 34, y: 82, label: 'A Cry for Help', mystery: 'A faint sound…', icon: 'tok-person', scene: 'wounded',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'scout-met' }], to: 'scout-gone' }] },
        { id: 'ravine', x: 52, y: 46, label: 'Sunken Ravine', icon: 'tok-crossing', scene: 'ravine',
          wandering: { chance: 0.5, battleScene: 'marsh-wolves' } },
        { id: 'approach', x: 82, y: 34, label: 'The Hollow Ahead', icon: 'tok-cave', scene: 'ambush',
          requires: [{ kind: 'flag', flag: 'trail-read' }] },
      ],
    },
  },
  tracks: {
    id: 'tracks', kind: 'check', skill: 'survival', dc: 12, art: { emoji: '👣' },
    intro: ['Boot-prints and drag-marks cross the mud. Read them right and the maze unravels.'],
    success: { to: 'trail', text: ['The tracks tell their whole story: a heavy patrol out at dusk, a lighter one back at dawn, always the same dry line through the reeds. You\'ve found the **safe path to the hollow** — and you\'ll see the raiders before they see you.'],
      effects: [{ kind: 'setFlag', flag: 'trail-read' }, { kind: 'xp', amount: 40 }] },
    failure: { to: 'trail', text: ['The prints tangle and double back on themselves until your eyes water. Still — they point, roughly, toward the hills. You\'ll find the den, but you\'ll be walking in blind.'],
      effects: [{ kind: 'setFlag', flag: 'trail-read' }] },
  },
  ravine: {
    id: 'ravine', kind: 'check', skill: 'athletics', dc: 13, art: { emoji: '🪨' },
    intro: ['A collapsed ravine cuts the trail. A hard climb saves an hour — a fall costs blood.'],
    success: { to: 'trail', text: ['You haul the party up and over. The shortcut is yours.'],
      effects: [{ kind: 'setFlag', flag: 'shortcut' }, { kind: 'xp', amount: 30 }] },
    failure: { to: 'trail', text: ['Loose scree turns an ankle or two before you find the long way round.'] },
  },
  wounded: {
    id: 'wounded', kind: 'dialogue', npc: SCOUT, art: { emoji: '🤕' },
    lines: ['A reeve\'s scout lies pinned under a dead horse, arrow in her leg. "They… they took the east watch-post. Help me and I\'ll tell you how they stand."'],
    next: [
      { id: 'medicine', label: '[Medicine DC 12] Tend her wound', to: 'scout-saved',
        once: true, check: { skill: 'medicine', dc: 12, failTo: 'scout-fail' } },
      { id: 'leave', label: 'No time — press on', to: 'trail' },
    ],
  },
  'scout-saved': {
    id: 'scout-saved', kind: 'story', art: { emoji: '❤️‍🩹' },
    text: [
      'The bleeding stops. Grateful, the scout — **Wren**, she says — maps the den\'s watch-posts in the mud, then grips your wrist.',
      '"There\'s one of them who hates the chief worse than you do. **Vex**, the lieutenant. Offer Vex a way out when you reach the den\'s fire and he might just take it — and stand his guards aside."',
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
    text: ['The dead horse still lies across the trail, flies rising in the heat. Of the scout there\'s no sign — dragged home, or into the reeds. Nothing more for you here.'],
    next: [{ id: 'ok', label: 'Move on', to: 'trail' }], noBack: true,
  },
  'spy-gone': {
    id: 'spy-gone', kind: 'story', art: { imageId: 'loc-village', emoji: '🕳️' },
    text: ['The peddler\'s stall stands bare, its awning taken down. The reeve\'s men came for him at first light; the square has already moved on.'],
    next: [{ id: 'ok', label: 'Turn back to the square', to: 'square' }], noBack: true,
  },
  'marsh-wolves': {
    id: 'marsh-wolves', kind: 'battle', encounterId: 'wolves', mapId: 'marsh',
    intro: ['Marsh-wolves, half-starved and bold, break from the reeds!'],
    onWin: { to: 'ravine', text: ['The pack breaks. The ravine still waits.'] },
  },
  'camp-ambush': {
    id: 'camp-ambush', kind: 'battle', encounterId: 'wolves', mapId: 'marsh',
    intro: ['Your watch-fire draws them: marsh-wolves slink out of the dark, drawn by the smell of blood and rations.'],
    onWin: { to: '@hub', text: ['The pack is driven off. You bank the fire and see out the rest of the night.'] },
  },
  ambush: {
    id: 'ambush', kind: 'check', skill: 'perception', dc: 13, roller: 'group', art: { emoji: '⛰️' },
    intro: ['The hollow opens below — and the reeds are too quiet. Raiders lie in wait. Who spots them first decides everything.'],
    success: { to: 'ambush-turned', text: ['You catch the glint of a spearpoint. The ambush becomes yours.'],
      effects: [{ kind: 'setFlag', flag: 'surprise' }] },
    failure: { to: 'ambush-sprung', text: ['A whistle — too late. They\'re already moving.'] },
  },
  'ambush-turned': {
    id: 'ambush-turned', kind: 'battle', encounterId: 'raiders-forward', mapId: 'open',
    surprise: 'enemies', // you spotted them — they lose the first round
    intro: ['You strike from cover. The outriders scramble, wrong-footed — for a heartbeat they don\'t even see you.'],
    onWin: { to: 'gate', text: ['The outer band is broken. The den\'s gate stands ahead.'] },
  },
  'ambush-sprung': {
    id: 'ambush-sprung', kind: 'battle', encounterId: 'raiders-forward', mapId: 'marsh',
    surprise: 'party', // the check failed — they get the drop on you
    intro: ['The trap springs shut — a whistle, and the outriders are on you before you can set your feet.'],
    onWin: { to: 'gate', text: ['Bloodied but through, you reach the den\'s gate.'] },
  },

  // === ACT 3 — THE ASHFANG DEN (dungeon) ================================
  gate: {
    id: 'gate', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏚️' },
    text: ['A palisade of lashed timber rings the hollow. A watch-post looms over the only gate. Beyond: the chief.'],
    next: [
      { id: 'signal', label: 'Give the stolen watch-signal', to: 'inner',
        requires: [{ kind: 'flag', flag: 'know-signal' }],
        effects: [{ kind: 'setFlag', flag: 'walked-in' }] },
      { id: 'sneak', label: '[Stealth] Slip over the palisade (whole party)', to: 'inner',
        check: { skill: 'stealth', dc: 13, roller: 'group', failTo: 'gate-fight' } },
      { id: 'fight', label: 'Storm the gate', to: 'gate-fight' },
    ],
  },
  'gate-fight': {
    id: 'gate-fight', kind: 'battle', encounterId: 'goblins', mapId: 'ruins',
    intro: ['The watch cries the alarm and the gate-guards charge!'],
    onWin: { to: 'inner', text: ['The gate is yours — though the whole den knows you\'re here now.'],
      effects: [{ kind: 'setFlag', flag: 'loud-entry' }] },
  },
  inner: {
    id: 'inner', kind: 'explore',
    map: {
      title: 'Inside the Den', theme: 'ember', art: { imageId: 'loc-camp', emoji: '🔥' },
      nodes: [
        { id: 'cache', x: 30, y: 34, label: 'Plunder Tent', icon: 'tok-treasure', scene: 'cache',
          hidden: { dc: 13 } },
        { id: 'vex', x: 58, y: 60, label: 'Vex\'s Fire', icon: 'tok-fire', scene: 'vex-parley',
          requires: [{ kind: 'flag', flag: 'know-vex' }] },
        { id: 'throne', x: 82, y: 34, label: 'The Chief\'s Hall', icon: 'tok-boss', scene: 'boss-approach' },
      ],
    },
  },
  cache: {
    id: 'cache', kind: 'check', skill: 'investigation', dc: 12, art: { emoji: '📦' },
    intro: ['A tent of stolen goods, hastily hidden. A careful search turns up the best of it.'],
    success: { to: 'inner', text: ['Beneath the junk: real coin and a caravan\'s lost potions.'],
      effects: [{ kind: 'gold', amount: 80 }, { kind: 'addItem', itemId: 'potion-greater-healing', qty: 1 }, { kind: 'setFlag', flag: 'looted' }] },
    failure: { to: 'inner', text: ['You grab what\'s in reach before the noise draws eyes.'],
      effects: [{ kind: 'gold', amount: 25 }] },
  },
  'vex-parley': {
    id: 'vex-parley', kind: 'dialogue', npc: LIEUTENANT, art: { emoji: '🗡️' },
    lines: ['Vex meets you with a bared blade and a bitter smile. "The chief sent his best to die at the gate. Not me. So — what do you offer?"'],
    next: [
      { id: 'persuade', label: '[Persuasion DC 13] Offer him the chief\'s seat', to: 'vex-turned',
        once: true, check: { skill: 'persuasion', dc: 13, failTo: 'vex-refuses' } },
      { id: 'intimidate', label: '[Intimidation DC 14] Promise him a quick end otherwise', to: 'vex-turned',
        once: true, check: { skill: 'intimidation', dc: 14, failTo: 'vex-refuses' } },
      { id: 'refuse', label: 'Refuse to bargain with raiders', to: 'inner' },
    ],
  },
  'vex-turned': {
    id: 'vex-turned', kind: 'story', art: { emoji: '🤝' },
    text: ['Vex sheathes his blade. "The chief\'s guards answer to me. They\'ll stand aside — this once." He melts into the smoke.'],
    next: [{ id: 'ok', label: 'On to the chief', to: 'inner',
      effects: [{ kind: 'setFlag', flag: 'vex-turned' }, { kind: 'setFlag', flag: 'met-vex' },
        { kind: 'journal', entry: { id: 'n-vex', kind: 'npc', title: 'Vex', body: 'The lieutenant Vex will stand his guards aside when you face the chief.' } }] }],
  },
  'vex-refuses': {
    id: 'vex-refuses', kind: 'story', art: { emoji: '💢' },
    text: ['"Thought not." Vex spits and vanishes — you\'ll meet his blade again at the chief\'s side.'],
    next: [{ id: 'ok', label: 'Press on', to: 'inner', effects: [{ kind: 'setFlag', flag: 'vex-hostile' }, { kind: 'setFlag', flag: 'met-vex' }] }],
  },
  'boss-approach': {
    id: 'boss-approach', kind: 'story', art: { imageId: 'loc-throne', emoji: '👑' },
    text: [
      'The chief\'s hall reeks of smoke and old blood. Trophies of a hundred raids hang from the rafters — a child\'s shoe, a miller\'s ledger, a reeve\'s chain.',
      'The **Ashfang** warlord rises from a throne of lashed spears, axe already in hand.',
      'Around him his guards set their feet — or do they hesitate? For a heartbeat, the whole hall waits to see what you\'ll do.',
    ],
    next: [{ id: 'fight', label: 'End it', to: 'boss' }],
  },
  boss: {
    id: 'boss', kind: 'battle', encounterId: 'bandits', mapId: 'firepit',
    intro: ['"You\'ve cost me everything," the warlord snarls. "Bleed for it."'],
    loot: { bonusTier: 'rare' }, // a warlord's hoard — guaranteed trophy
    onWin: { to: 'aftermath', text: ['The warlord falls. The **Ashfang** are broken.'],
      effects: [{ kind: 'setFlag', flag: 'chief-dead' }, { kind: 'gold', amount: 100 }] },
  },

  // The reckoning: your earlier choices surface here as rewards you can (or
  // can't) claim — blocked options show *why*, so what you did back in the
  // village and the marsh visibly mattered.
  aftermath: {
    id: 'aftermath', kind: 'story', art: { imageId: 'loc-village', emoji: '🏘️' },
    text: ['Back in Thornwick, the square fills. There are debts to settle in your favor now.'],
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
      'The Ashfang banner burns in Thornwick square, and the marsh road runs safe again.',
      'Mira pours the first round on the house. The road ahead is quieter — for now.',
    ],
  },
};

export const HOLLOW_ROAD_MODULE: Module = {
  id: 'hollow-road', title: 'The Hollow Road',
  blurb: 'Break the Ashfang raiders — through the village, the marsh, and their den. By blade or by wit.',
  start: 'start', scenes, defeatScene: 'defeat',
};
