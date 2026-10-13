/**
 * The Hollow Road: chapter one of the trilogy (docs/trilogy-plan.md).
 * Why it is built as it is, scene by scene: docs/chapters/hollow-road-notes.md.
 */
import type { Module } from '../../adventure/types.js';
import type { DelveSpec } from '../../adventure/delve-spec.js';
import { withCanon, companionsFrom, npcMetFlag, npcFateFlag } from '../../adventure/npcs.js';
import { TRILOGY_NPCS as NPCS, TRILOGY_RENAMED_FATES } from './npcs.js';
import { TRILOGY_FACTS } from './canon.js';
// The scenes are written in hollow-road/*.story (one file per place) and
// built by `npm run stories`.
import { SCENES as scenes } from './hollow-road/scenes.gen.js';

export const HOLLOW_ROAD_RENAMED_NPC_FLAGS: Record<string, string> = {
  'saved-scout': npcFateFlag('wren', 'saved'),
  'scout-met': npcFateFlag('wren', 'lost'),
  'met-vex': npcMetFlag('vex'),
  'vex-turned': npcFateFlag('vex', 'turned'),
  'chief-dead': npcFateFlag('vargan', 'dead'),
  'vargan-executed': npcFateFlag('vargan', 'dead'),
  'vargan-jailed': npcFateFlag('vargan', 'spared'),
  'vargan-freed': npcFateFlag('vargan', 'spared'),
};
const HOLLOW_ROAD_RENAMED: Record<string, string> = {
  ...HOLLOW_ROAD_RENAMED_NPC_FLAGS,
  'hag-dead': npcFateFlag('reedwife', 'dead'),
  'scout-left': 'scout-walked-past',
  [npcFateFlag('wren', 'left')]: 'scout-walked-past',
  [npcFateFlag('vex', 'rebuffed')]: 'vex-rebuffed',
  ...TRILOGY_RENAMED_FATES,
};

export const HOLLOW_ROAD_MODULE: Module = withCanon({
  id: 'hollow-road', title: 'The Hollow Road',
  blurb: 'Break the {ashfang} raiders — through the village, the marsh, and their den. By blade or by wit.',
  cover: 'loc-village',
  levelBand: { from: 1, to: 3 },
  places: {
    'square/city': { reads: ['know-spy', 'mira-read'], exports: ['bounty', 'know-signal', 'mill-saved', 'spy-caught', 'spy-seen'] },
  },
  towns: {
    square: {
      spec: {
        size: 'village', level: 1, name: '{thornwick}', camp: true,
        people: [{ name: '{bram}', at: 'general', keeps: true,
          lines: ['"Coin\'s coin, and I\'ll not ask where yours has been." **{bram}** plants both hands on the stall. "Buying, or selling? Prices are fair. A dead customer never comes back for more, and I do like the repeat trade."'] }],
        places: [
          { label: 'The {wander-inn}', replaces: 'inn', text: [], event: { scene: 'tavern' } },
          { label: 'Notice Board', replaces: 'notice-board', icon: 'tok-notice', text: [], event: { scene: 'board' } },
          { label: 'The Old Mill', icon: 'tok-figure',
            text: ['The mill\'s sails are turning again, and the miller waves from the door. The stone dog keeps its vigil by the gate, forever pointing at nothing.'],
            event: { scene: 'mill', until: [{ kind: 'flag', flag: 'mill-saved' }] } },
          { label: 'Peddler\'s Stall', icon: 'tok-figure',
            text: ['The peddler\'s stall stands bare, its awning taken down. He sits in the reeve\'s cells now, and the square has already moved on.'],
            event: { scene: 'spy-confront', until: [{ kind: 'flag', flag: 'spy-caught' }], when: [
              { if: [{ kind: 'visited', scene: 'spy-confront' }], to: 'spy-confront' },
              { if: [{ kind: 'flag', flag: 'know-spy' }], to: 'spy-stalk' }] } },
          // Shut until the peddler is caught, or the party got out another
          // way, and the peddler has warned the den (its alarm); the road out fought once.
          { label: 'The Marsh Road', replaces: 'gate', icon: 'tok-gate', text: [], event: { scene: 'trailhead', when: [
            { if: [{ kind: 'visited', scene: 'trail' }], to: 'trailhead-clear' },
            { if: [{ kind: 'notFlag', flag: 'spy-caught' }, { kind: 'alarm', dungeon: 'inner/delve', below: 2 }], to: 'gate-blocked' },
            { if: [{ kind: 'notFlag', flag: 'spy-caught' }], to: 'gate-slipped' }] } },
        ],
      },
      onLeave: { to: 'trailhead' },
      proveApart: true, title: '{thornwick}',
    },
  },
  delves: {
  trail: {
    spec: {
      // A road, not a maze: one long way through the reeds, held by the hag's creatures.
      level: 1, theme: 'marsh', shape: 'spine', rooms: 10, fights: 'inhabitants', factions: ['marsh-things'], maxFights: 0,
      dressing: { name: 'The Marsh Road',
        door: 'Past the last fence-post the road runs out into reeds and black water, and goes on as a line of planks and tussocks.',
        outside: 'The reeds open, and the road back to {thornwick} runs dry under your boots.',
        back: 'Back into the reeds', leave: 'Walk back to {thornwick}' },
      lock: { requires: [{ kind: 'flag', flag: 'trail-read' }, { kind: 'flag', flag: 'crossed-ravine' }],
        note: 'The ravine cuts the trail, and past it the reeds hide the way to the hollow. Cross the ravine, and find the patrols\' tracks.' },
      require: [
        { name: 'Fresh Tracks', where: 'beforeLock', event: { scene: 'tracks', until: [{ kind: 'flag', flag: 'trail-read' }],
          // The trapper's sketch from the inn round: no need to roll for the line.
          when: [{ if: [{ kind: 'flag', flag: 'trail-known' }], to: 'tracks-mapped' }] } },
        { name: 'Sunken Ravine', where: 'beforeLock', event: { scene: 'ravine', until: [{ kind: 'flag', flag: 'crossed-ravine' }] } },
        // The scout: every visit says where she stands now.
        { name: 'A Cry for Help', where: 'beforeLock', event: { scene: 'wounded', when: [
          { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }, { kind: 'companion', companion: 'wren' }], to: 'scout-along' },
          { if: [{ kind: 'npc', npc: 'wren', fate: 'saved' }], to: 'scout-sent' },
          { if: [{ kind: 'npc', npc: 'wren', fate: 'lost' }], to: 'scout-gone' },
          // Untended until the fifth morning (see `wounded`), walked past or not.
          { if: [{ kind: 'flag', flag: 'scout-bled-out' }], to: 'scout-dead' },
          { if: [{ kind: 'flag', flag: 'scout-walked-past' }], to: 'scout-passed' }] } },
        { name: 'A Sunken Barrow', where: 'side', event: { scene: 'barrow', until: [{ kind: 'flag', flag: 'barrow-cleared' }] } },
        { name: 'Webbed Thicket', where: 'afterLock', event: { scene: 'thicket', until: [{ kind: 'flag', flag: 'thicket-cleared' }] } },
        { name: 'The Hollow', where: 'goal', event: { scene: 'ambush', until: [{ kind: 'flag', flag: 'know-hag' }], when: [
          // A scout who counted the den's watch-posts sees the ambush first.
          { if: [{ kind: 'companion', companion: 'wren' }], to: 'ambush-wren' },
          // Lost the dry line at the tracks: the party splashes in, heard.
          { if: [{ kind: 'flag', flag: 'trail-wet' }], to: 'ambush-wet' }] },
          exit: { to: 'hollow-quiet', label: 'On to the den' } },
      ],
    } as DelveSpec,
    onWin: { to: 'hollow-quiet' }, onLeave: { to: 'square/city' },
    proveApart: true, title: 'The Marsh Road',
  },
  inner: {
    spec: {
      // A spine: no lock and key of its own, so no flag the whole chapter's
      // proof would have to carry twice over.
      level: 2, theme: 'stockade', shape: 'spine', rooms: 9, fights: 'inhabitants', factions: ['raiders'], maxFights: 0,
      dressing: { name: 'The {ashfang} Den',
        door: 'Inside the wall the den is tents and cook-smoke and stolen carts, and the noise of a camp at its fires.',
        outside: 'You slip back out through the gate, into the quiet of the hollow.',
        back: 'Back inside', leave: 'Leave the den for now' },
      require: [
        { name: 'The Pit', where: 'main', event: { scene: 'den-muster', until: [{ kind: 'flag', flag: 'pit-won' }] } },
        { name: 'A Lone Fire', where: 'main',
          event: { scene: 'vex-parley', until: [{ kind: 'npc', npc: 'vex', met: true }] } },
        // The kennels, and the plunder their keeper guarded.
        { name: 'Kennels', event: { scene: 'den-hyenas', until: [{ kind: 'flag', flag: 'kennel-cleared' }] }, search: 'den-cache' },
        // What the hag is paid in: the captives, penned behind the kennels.
        { name: 'The Pens', event: { scene: 'den-pens-door' } },
        // The hall is settled once the {reedwife} is: dead or bound, both of
        // which mark her `met`.
        { name: 'The Chief\'s Hall', where: 'goal',
          event: { scene: 'boss-approach', until: [{ kind: 'npc', npc: 'reedwife', met: true }] } },
      ],
    } as DelveSpec,
    onWin: { to: 'boss-approach' }, onLeave: { to: 'hollow-quiet' },
    // Proved in parts: its layout when built, the chapter with only its outside.
    proveApart: true, title: 'The {ashfang} Den',
  } },
  // Part 1 of the trilogy (docs/trilogy-plan.md): a victory carries the
  // company into The Sunken Barrows.
  sequel: 'sunken-barrows',
  start: 'road', scenes, defeatScene: 'defeat', town: 'square/city',
  // The clock: the Ashfang keep their captives for the Reedwife, and she
  // takes them when the moon goes dark. Six nights' sleep and they are gone.
  dawns: [
    { day: 4, text: [
      'Last night\'s moon was a thin paring of light, and it was down long before dawn.',
      { if: [{ kind: 'notFlag', flag: 'pens-settled' }, { kind: 'npc', npc: 'vex', met: true }],
        text: '{vex} said the chief keeps people in the pen behind the kennels for the {reedwife}. The reed-cutters in town are counting the nights to the dark of the moon. Three more nights of this one, at most.' },
      // Woken on the marsh road or in town (`at` names no third map but the
      // den), or in the den itself, or on {mira}'s cot after falling there.
      ...(['square', 'trail'] as const).map((hub) => ({
        if: [{ kind: 'notFlag' as const, flag: 'pens-settled' }, { kind: 'npc' as const, npc: 'vex', met: false }, { kind: 'at' as const, hub: hub === 'trail' ? 'trail/delve' : 'square/city' }],
        text: 'Somewhere out there the {ashfang} still have the carter they took off the marsh road, and his granddaughter. The reed-cutters were counting the nights toward something, and this moon will not last many more.' })),
      { if: [{ kind: 'notFlag', flag: 'pens-settled' }, { kind: 'npc', npc: 'vex', met: false }, { kind: 'at', hub: 'inner/delve' }],
        text: 'Somewhere in the den the {ashfang} still have the carter they took off the marsh road, and his granddaughter. The reed-cutters were counting the nights toward something, and this moon will not last many more.' },
      // The scout's deadline (the next dawn's `scout-bled-out`), while she is
      // still out there unfound: neither met nor stepped round.
      { if: [{ kind: 'npc', npc: 'wren', met: false }, { kind: 'notFlag', flag: 'scout-walked-past' }],
        text: 'There is still no word of the reeve\'s scouts. If one of them is lying hurt out on the marsh road, tonight may be her last.' },
    ] },
    { day: 5, text: ['There is frost on everything this morning, and the sun comes up thin and cold. The moon is wasting. A few more nights and it will be gone.'],
      // The scout under the horse dies if no one has tended her (see
      // `wounded`), walked past or not.
      effects: [{ kind: 'setFlag', flag: 'scout-bled-out' }] },
    { day: 6, text: ['A rind of moon rose late over the marsh and set early. One more night of it, at most.'] },
    { day: 7, text: ['There was no moon at all last night. Far out on the marsh, something sang until dawn, and then stopped.'],
      effects: [{ kind: 'setFlag', flag: 'captives-taken' }] },
  ],
  carries: ['won', 'captives-freed'],
  // Saves from before that state moved onto the NPCs.
  renamedFlags: HOLLOW_ROAD_RENAMED,
  companions: companionsFrom(NPCS, [
    { id: 'wren', blurb: 'The reeve\'s scout you pulled from under a dead horse. Guiding you through the marsh as far as the den\'s gate.' },
  ]),
}, { npcs: NPCS, facts: TRILOGY_FACTS });
