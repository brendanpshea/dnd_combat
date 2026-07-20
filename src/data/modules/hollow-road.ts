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
      'The village of Thornwick huddles under grey hills, its gate scorched and its people wary.',
      'For a month the Ashfang raiders have bled the road dry. The reeve\'s bounty — and a plea — brought you here.',
    ],
    next: [{ id: 'go', label: 'Enter the Wander-Inn', to: 'tavern',
      effects: [{ kind: 'journal', entry: { id: 'q-main', kind: 'quest', title: 'Break the Ashfang', body: 'End the raiders plaguing Thornwick. Start by learning where they den.' } }] }],
  },
  // The tavern is a small loop, not a one-way door (#6): each social read is a
  // `once` choice that returns you here, so you can try Insight *and*
  // Persuasion but never re-roll either. "Head to the square" is the way out.
  tavern: {
    id: 'tavern', kind: 'dialogue', npc: MIRA, art: { imageId: 'loc-tavern', emoji: '🍺' },
    lines: [
      '"Sellswords, are you? Good. The reeve\'s too proud to beg, so I will."',
      '"The Ashfang came from the marsh road. But there\'s more folk won\'t say aloud…"',
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
    text: ['Her eyes flick to the door. "Someone here feeds them word of every caravan. I\'d start at the market, if I were you."'],
    next: [{ id: 'ok', label: 'Back to your table', to: 'tavern',
      effects: [{ kind: 'setFlag', flag: 'know-spy' },
        { kind: 'journal', entry: { id: 'c-spy', kind: 'clue', title: 'An Informant', body: 'A spy in Thornwick feeds the raiders. Mira suspects the market.' } }] }],
  },
  'tavern-trail': {
    id: 'tavern-trail', kind: 'story', art: { emoji: '🗺️' },
    text: ['The room loosens. An old trapper sketches the marsh road on the bar and taps a hollow in the hills. "Their den. But the trail bites back."'],
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
      nodes: [
        { id: 'inn', x: 20, y: 30, label: 'The Wander-Inn', icon: '🍺', scene: 'tavern' },
        { id: 'market', x: 40, y: 40, label: 'Market', icon: '🛒', scene: 'market' },
        { id: 'board', x: 70, y: 28, label: 'Notice Board', icon: '📜', scene: 'board' },
        { id: 'informant', x: 48, y: 66, label: 'Furtive Peddler', icon: '🕵️', scene: 'spy-confront',
          requires: [{ kind: 'flag', flag: 'know-spy' }] },
        { id: 'gate', x: 82, y: 78, label: 'Leave for the Marsh Road', icon: '🚪', scene: 'trailhead' },
      ],
    },
  },
  market: { id: 'market', kind: 'shop', title: 'Thornwick Market', next: 'square',
    intro: ['Stalls of oddments and a wary quartermaster who\'ll buy your spare gear at a pinch.'] },
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
    text: ['The marsh road leaves Thornwick behind. Reeds close in; the hills wait beyond a maze of black water and game trails.'],
    next: [{ id: 'go', label: 'Into the marsh', to: 'trail' }],
  },
  trail: {
    id: 'trail', kind: 'explore',
    map: {
      title: 'The Marsh Road', theme: 'forest', art: { imageId: 'loc-marsh', emoji: '🌾' },
      nodes: [
        { id: 'tracks', x: 28, y: 40, label: 'Fresh Tracks', icon: '👣', scene: 'tracks' },
        { id: 'ravine', x: 55, y: 62, label: 'Sunken Ravine', icon: '🪨', scene: 'ravine',
          wandering: { chance: 0.5, battleScene: 'marsh-wolves' } },
        { id: 'scout', x: 34, y: 78, label: 'A Cry for Help', icon: '🆘', scene: 'wounded' },
        { id: 'approach', x: 80, y: 40, label: 'The Hollow Ahead', icon: '⛰️', scene: 'ambush',
          requires: [{ kind: 'flag', flag: 'trail-read' }] },
      ],
    },
  },
  tracks: {
    id: 'tracks', kind: 'check', skill: 'survival', dc: 12, art: { emoji: '👣' },
    intro: ['Boot-prints and drag-marks cross the mud. Read them right and the maze unravels.'],
    success: { to: 'trail', text: ['You read the raiders\' comings and goings — the safe path to the hollow is plain now.'],
      effects: [{ kind: 'setFlag', flag: 'trail-read' }, { kind: 'xp', amount: 40 }] },
    failure: { to: 'trail', text: ['The prints tangle and double back. Still — they point roughly toward the hills.'],
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
    text: ['The bleeding stops. Grateful, she maps the den\'s watch-posts and the lieutenant who hates the chief. "Vex. Offer Vex a way out and he might take it."'],
    next: [{ id: 'ok', label: 'Send her back to Thornwick', to: 'trail',
      effects: [{ kind: 'setFlag', flag: 'saved-scout' }, { kind: 'setFlag', flag: 'know-vex' },
        { kind: 'journal', entry: { id: 'n-scout', kind: 'npc', title: 'The Scout', body: 'You saved a reeve\'s scout. She named Vex, the chief\'s resentful lieutenant.' } }] }],
  },
  'scout-fail': {
    id: 'scout-fail', kind: 'story', art: { emoji: '🩸' },
    text: ['Your hands aren\'t enough; she fades before she can say much. She presses a token into your palm — the reeve will know it.'],
    next: [{ id: 'ok', label: 'Cover her and go', to: 'trail',
      effects: [{ kind: 'addItem', itemId: 'potion-healing', qty: 1 }] }],
  },
  'marsh-wolves': {
    id: 'marsh-wolves', kind: 'battle', encounterId: 'wolves', mapId: 'marsh',
    intro: ['Marsh-wolves, half-starved and bold, break from the reeds!'],
    onWin: { to: 'ravine', text: ['The pack breaks. The ravine still waits.'], effects: [{ kind: 'xp', amount: 30 }] },
  },
  ambush: {
    id: 'ambush', kind: 'check', skill: 'perception', dc: 13, roller: 'group', art: { emoji: '⛰️' },
    intro: ['The hollow opens below — and the reeds are too quiet. Raiders lie in wait. Who spots them first decides everything.'],
    success: { to: 'ambush-turned', text: ['You catch the glint of a spearpoint. The ambush becomes yours.'],
      effects: [{ kind: 'setFlag', flag: 'surprise' }] },
    failure: { to: 'ambush-sprung', text: ['A whistle — too late. They\'re already moving.'] },
  },
  'ambush-turned': {
    id: 'ambush-turned', kind: 'battle', encounterId: 'raiders', mapId: 'open',
    intro: ['You strike from cover — the raiders scramble, wrong-footed.'],
    onWin: { to: 'gate', text: ['The outer band is broken. The den\'s gate stands ahead.'], effects: [{ kind: 'xp', amount: 60 }] },
  },
  'ambush-sprung': {
    id: 'ambush-sprung', kind: 'battle', encounterId: 'raiders', mapId: 'marsh',
    intro: ['The trap springs shut — raiders on every side!'],
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
        { id: 'cache', x: 30, y: 34, label: 'Plunder Tent', icon: '📦', scene: 'cache',
          hidden: { dc: 13 } },
        { id: 'vex', x: 58, y: 60, label: 'Vex\'s Fire', icon: '🗡️', scene: 'vex-parley',
          requires: [{ kind: 'flag', flag: 'know-vex' }] },
        { id: 'throne', x: 82, y: 34, label: 'The Chief\'s Hall', icon: '👑', scene: 'boss-approach' },
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
      effects: [{ kind: 'setFlag', flag: 'vex-turned' },
        { kind: 'journal', entry: { id: 'n-vex', kind: 'npc', title: 'Vex', body: 'The lieutenant Vex will stand his guards aside when you face the chief.' } }] }],
  },
  'vex-refuses': {
    id: 'vex-refuses', kind: 'story', art: { emoji: '💢' },
    text: ['"Thought not." Vex spits and vanishes — you\'ll meet his blade again at the chief\'s side.'],
    next: [{ id: 'ok', label: 'Press on', to: 'inner', effects: [{ kind: 'setFlag', flag: 'vex-hostile' }] }],
  },
  'boss-approach': {
    id: 'boss-approach', kind: 'story', art: { imageId: 'loc-throne', emoji: '👑' },
    text: [
      'The chief\'s hall reeks of smoke and old blood. The Ashfang warlord rises, axe in hand.',
      'Around him, his guards tense — or do they hesitate?',
    ],
    next: [{ id: 'fight', label: 'End it', to: 'boss' }],
  },
  boss: {
    id: 'boss', kind: 'battle', encounterId: 'bandits', mapId: 'firepit',
    intro: ['"You\'ve cost me everything," the warlord snarls. "Bleed for it."'],
    onWin: { to: 'aftermath', text: ['The warlord falls. The Ashfang are broken.'],
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
  start: 'start', scenes,
};
