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
import { SCENES as scenes, ACTS } from './hollow-road/scenes.gen.js';
import { rescueWhen } from '../../adventure/rescue.js';

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
    'square/city': { reads: ['know-spy'], exports: ['bounty', 'know-signal', 'mill-saved', 'spy-caught', 'spy-seen'] },
  },
  towns: {
    square: {
      spec: {
        size: 'village', level: 1, name: '{thornwick}', camp: true,
        people: [{ name: 'Hobb', at: 'smithy', keeps: true,
          lines: ['"Steel or leather?" **Hobb** the smith wipes his hands on an apron gone stiff with soot. "Either way, you pay up front. I made the reeve new hinges for that gate a month back, and I am still waiting on the coin. A gate that holds out raiders, and he haggles over the hinges."'] },
          { name: '{bram}', at: 'general', keeps: true,
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
            { if: [{ kind: 'notFlag', flag: 'spy-caught' }, { kind: 'alarm', dungeon: 'inner/delve', below: 3 }], to: 'gate-blocked' },
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
      // What the marsh remembers of the lamb custom, and the hag's mark.
      lore: [
        'A lamb\'s skull is tied to a stake here, old and green with moss. The reed-cutters left one every midwinter, once.',
        'A flat stone lies in the reeds, furred with moss. Cut into it is a reaching hand, the same mark the raiders burn into the carts they take.',
      ],
      dressing: { name: 'The Marsh Road',
        door: 'Past the last fence-post the road runs out into reeds and black water, and goes on as a line of planks and tussocks.',
        outside: 'The reeds open, and the road back to {thornwick} runs dry under your boots.',
        back: 'Back into the reeds', leave: 'Walk back to {thornwick}' },
      // Either way finds it (`trail-read`): the patrols' tracks, or the
      // crossing of the ravine, which comes out on their dry line.
      lock: { requires: [{ kind: 'flag', flag: 'trail-read' }],
        note: 'The reeds hide the way to the hollow. Read the patrols\' tracks, or cross the ravine and come at it from the far side.' },
      require: [
        { name: 'Fresh Tracks', where: 'beforeLock', text: 'Boot-prints and clawed feet in the mud, all going the same way, along a line of firmer ground.', event: { scene: 'tracks', until: [{ kind: 'flag', flag: 'trail-read' }],
          // The trapper's sketch from the inn round: no need to roll for the line.
          when: [{ if: [{ kind: 'flag', flag: 'trail-known' }], to: 'tracks-mapped' }] } },
        { name: 'Sunken Ravine', where: 'beforeLock', event: { scene: 'ravine', until: [{ kind: 'flag', flag: 'crossed-ravine' }] } },
        // The scout: every visit says where she stands now.
        { name: 'A Cry for Help', where: 'beforeLock', event: { scene: 'wounded',
          when: rescueWhen('wounded', 'wren', { walked: 'scout-walked-past', bled: 'scout-bled-out' }) } },
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
      // What the camp lets slip about its chief and the one who pays him.
      lore: [
        'A drowned house is scratched into a plank: a boy on the roof, and the water at the door. Under it, in a child\'s letters, is a name. {vargan}.',
        'A tally stick hangs from a tent pole, with a notch for every cart taken. At the top someone has cut a reaching hand.',
        'A list in the chief\'s hand of what the water is owed. Someone has crossed out "one lamb a winter" and written "a lamb each moon" over it. At the bottom: "the carter and the girl, at the dark of the moon."',
      ],
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
        // On the way to the hall: free them first, or go straight to the chief.
        // On the way to the hall: free them first, or go straight to the chief.
        { name: 'The Pens', where: 'main', text: 'Behind the kennels stands a pen of lashed stakes, the kind a farmer keeps pigs in.',
          hostage: {
            who: 'the captives', many: true, as: { freed: 'captives-freed', taken: 'captives-taken' },
            // The den's noise does not move them: only the moon's dark gives them
            // to her (the day-7 dawn). Storming the gate costs Vex, not the girl.
            movedAt: false,
            lines: {
              pick: 'Work the padlock open quietly', force: 'Hack through the stakes, and never mind the noise',
              watch: ['The noise carries. The raider by the fire jumps up and yells, and the den\'s watch comes running with him. Two hulking raiders with greataxes, four archers and an orc spread out in front of the pen. The carter pulls the girl down into the straw.'],
              won: ['The last raider falls against the stakes. Across the yard a horn starts up, and the tent lines come awake.'],
              lost: ['You go down in the mud in front of the pen, and come to in the straw of the pen itself, left for dead. The gate stands open and the captives are gone. Their tracks lead out toward the deep fen.'],
            },
            found: [
              'There are no pigs. A grey-bearded carter, two reed-cutters and a girl of about seven blink up at you from the straw.',
              'The girl has one shoe, on her right foot. "They said the lady in the water comes for us when the moon goes dark," the carter whispers. "The old folk paid her a little, once a year, and she kept to her water. Now the chief feeds her people." He swallows. "Are you the reeve\'s men?"',
              'A chain and a heavy padlock hold the pen shut. Across the yard, a raider dozes by the fire with his spear across his lap.',
            ],
            freed: ['The pen comes open. The carter lifts the girl onto his back, and the reed-cutters take a kennel-pole each. "We\'ll make the gate," the carter says. He stops at the pen door. "That chief of theirs. I knew him as a boy, cutting reeds. His mother\'s house was the first the water took. He has not forgotten it." He hitches the girl higher. "Find us in {thornwick}, after." They slip off toward the dark of the marsh road, not making a sound.'],
            gone: ['There are no pigs in the pen, and no people. The chain hangs open, and wet, webbed footprints lead from the gate toward the marsh. None lead back.',
              'Something has come for them out of the water, and gone again. In the corner lies one small shoe.'],
            onFreed: [{ kind: 'npc', npc: 'wren', attitude: 1 }],
            guard: { dc: 13, fight: 'pen-watch' },
            quest: { title: 'Bring the Captives Home',
              body: 'Behind the kennels in the {ashfang} den is a pen where the chief keeps captives for the {reedwife}: a carter, his granddaughter and two reed-cutters. She comes for them when the moon goes dark. Get them out before she does.' },
          } },
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
  start: 'road', scenes, acts: ACTS, defeatScene: 'defeat', town: 'square/city',
  // The clock: the Ashfang keep their captives for the Reedwife, and she
  // takes them when the moon goes dark. Six nights' sleep and they are gone.
  dawns: [
    { day: 4, text: [
      'Last night\'s moon was a thin paring of light, and it was down long before dawn.',
      { if: [{ kind: 'notFlag', flag: 'captives-freed' }, { kind: 'npc', npc: 'vex', met: true }],
        text: '{vex} said the chief keeps people in the pen behind the kennels for the {reedwife}. The reed-cutters in town are counting the nights to the dark of the moon. Three more nights of this one, at most.' },
      // Woken on the marsh road or in town (`at` names no third map but the
      // den), or in the den itself, or on {mira}'s cot after falling there.
      ...(['square', 'trail'] as const).map((hub) => ({
        if: [{ kind: 'notFlag' as const, flag: 'captives-freed' }, { kind: 'npc' as const, npc: 'vex', met: false }, { kind: 'at' as const, hub: hub === 'trail' ? 'trail/delve' : 'square/city' }],
        text: 'Somewhere out there the {ashfang} still have the carter they took off the marsh road, and his granddaughter. The reed-cutters were counting the nights toward something, and this moon will not last many more.' })),
      { if: [{ kind: 'notFlag', flag: 'captives-freed' }, { kind: 'npc', npc: 'vex', met: false }, { kind: 'at', hub: 'inner/delve' }],
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
