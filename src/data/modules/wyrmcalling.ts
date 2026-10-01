/**
 * "The Wyrmcalling" — Part 3 of the trilogy (docs/trilogy-plan.md): the
 * L4→5 finale. The Reedwife's two sisters come to collect what the company
 * owes the coven — by waking the Calling stone in the high hills and
 * whistling down every hungry thing that answers: wyrmlings from their dens,
 * giants promised a valley, elementals pulled through the seams the
 * Undercrypt's broken ward left thin.
 *
 * Shape: a war-camp hub (the valley raises its army at last) → the high
 * hills, an open traversal where the company PICKS ITS BATTLES — every den
 * raided and beast put down is one monster fewer when the Calling peaks — →
 * the stone itself, where the party answers the sisters and tries to tear them
 * out of the rock: fight them in person (`sisters-at-stone`), or, if every
 * approach fails, the cataclysm the stone spends them on. The mid fights are
 * genuinely optional; the dens have a mechanical payoff too (clear all three
 * and the chromatic clutch never masses at the gate).
 *
 * XP budget (trilogy-plan.md): required spine ≈ 9,450 (coven 750, the
 * flooded seam 1,800, the oni's hold 1,650, the giants' hall 1,650,
 * cataclysm finale 3,600, or 3,200 for the sisters in person); optional
 * dens/beasts add up to ~6,000 more. A continuing company (~3,050 XP from
 * Part 2) that raids most of the hills passes L5's 6,500 honestly; `xpToLevel: 5` on stepping up to the finale is the floor
 * for a fight-shy run (or one that buys its way past the ogre-mage). Cold
 * starts are floored to L4 by the opening choice.
 *
 * CARRIED CHOICES: Vex's history reads `hollow-road:vex-turned` (he took the
 * party's offer in Part 1); Wren's familiarity reads `hollow-road:saved-scout`
 * or `sunken-barrows:met-wren`. Each has a version for a cold start, where
 * the party knows nobody. A saved Halden (`sunken-barrows:halden-saved`) opens
 * an easier way to tear the sisters loose. The one ending's slides read these
 * and the rest (`hollow-road:chief-dead`, `sunken-barrows:seal-cracked`).
 *
 * MONSTER VARIETY: the top shelf, none of it fielded by Parts 1–2 — the hag
 * coven, harpies by night, a talking manticore, boar stampedes, three
 * chromatic wyrmlings (or their massed clutch), an ogre-mage's warband, an
 * ettin's hall, a gorgon, a water elemental, and at the stone either the
 * sisters themselves with a fire elemental, or the fire-and-earth cataclysm.
 *
 * VOICE: plain, concrete, Zelda-register. Every image resolves inside the
 * passage it appears in (no riddle-similes), a character speaks the stakes
 * rather than the narrator implying them, proper nouns get a physical anchor
 * on first use, and abstractions give way to things a reader can see. See
 * docs/module-writing-guide.md.
 */
import type { Choice, Effect, Module, Scene } from '../../adventure/types.js';

const VEX = { id: 'npc-vex', name: 'Captain Vex', portraitId: 'npc-captain', emoji: '🗡️' };
const WREN = { id: 'npc-wren', name: 'Wren, Chief of Scouts', portraitId: 'npc-scout', emoji: '🏹' };
const BRAM = { id: 'npc-bram', name: 'Bram, War-Quartermaster', portraitId: 'npc-merchant', emoji: '🧑‍🌾' };

/** Into Vex's briefing: which version depends on what he did in Part 1. */
const TO_BRIEFING: Choice[] = [
  { id: 'hear', label: 'Hear him out', to: 'vex-brief-turned',
    requires: [{ kind: 'flag', flag: 'hollow-road:vex-turned' }], hideWhenBlocked: true },
  { id: 'hear-new', label: 'Hear him out', to: 'vex-brief',
    requires: [{ kind: 'notFlag', flag: 'hollow-road:vex-turned' }], hideWhenBlocked: true },
];

/** Vex's plan, the same whoever he is to you. */
const BRIEF_PLAN = [
  '"Here is the problem." He taps the map, where the high passes are marked fire by fire. "The stone calls, and the hills answer. There are wyrm dens here, here, and here. An ogre-mage holds the middle pass with a warband. An ettin has taken a hall above the tree-line. And there are things in the streams now that are not fish."',
  '"When the Calling reaches its peak, all of it comes down this slope at once. Unless it is dead first." He looks up at you. "So here is the deal. Every den you burn out is one monster fewer on the day. Fight as many as you can reach. My scouts will keep the map honest."',
  'A thin smile crosses his face and vanishes. "I would come myself, but apparently I am respectable now. Nobody warns you about that part."',
];

const briefed = (vexBody: string): Effect[] => [
  { kind: 'setFlag', flag: 'briefed' },
  { kind: 'journal', entry: { id: 'n-vex3', kind: 'npc', title: 'Captain Vex', body: vexBody } },
  { kind: 'journal', entry: { id: 'lead-stone', kind: 'lead', resolvedBy: 'calling-found',
    title: 'The Calling Stone', body: 'Somewhere past the ogre-mage\'s pass and the giants\' hall, the sisters are tending the stone that calls the hills down. Climb until you find it.' } },
];

/** Wren's advice, the same whether she knows you or not. */
const WREN_BEASTS =
  '"The **manticore** on the toll-cliff talks. It will ask you for a toll. What it really wants is you. The **boar-runs** flood with a stampede twice a day, so either time it or fight through it."';
const WREN_GORGON =
  '"There is a valley past the middle pass full of statues that are far too good. A **gorgon** made them. Its breath turns people to stone. Stay out, or go in with your blade drawn."';

const TAKE_NOTES: Choice[] = [{ id: 'ok', label: 'Take her map-notes', to: 'warcamp',
  effects: [{ kind: 'setFlag', flag: 'wren-brief' }, { kind: 'xp', amount: 30 },
    { kind: 'journal', entry: { id: 'c-scoutnotes', kind: 'clue', title: 'Wren\'s Map-Notes',
      body: 'Wren warned that the manticore on the toll-cliff talks, and what it wants is you. The boar-runs stampede twice a day. A gorgon made the statues in the valley past the middle pass. And the streams themselves are walking uphill.' } }] }];

/** Out of the aftermath to the one ending; its slides read the run back. */
const TO_EPILOGUE: Choice[] = [{ id: 'done', label: 'Let the valley celebrate', to: 'wc-epilogue' }];

/**
 * The brood on the rim is exactly the wyrmlings whose dens were left
 * standing — Vex's "one monster fewer on the day", kept to the letter. One
 * battle scene per combination (encounters `den-clutch-*`), picked by which
 * dens are cleared. All three cleared skips the rim (`calling-gate-clear`).
 */
const DENS = {
  g: { flag: 'green-cleared', name: 'green', from: 'out of the thicket' },
  b: { flag: 'blue-cleared', name: 'blue', from: 'off the mesa' },
  r: { flag: 'red-cleared', name: 'red', from: 'up from the burning den' },
} as const;
const BROODS = ['g', 'b', 'r', 'gb', 'gr', 'br', 'gbr'] as const;
const broodChoices = (effects?: Effect[]): Choice[] => BROODS.map((k) => ({
  id: `brood-${k}`, label: 'Meet the brood on the rim', to: `clutch-${k}`, hideWhenBlocked: true,
  requires: (['g', 'b', 'r'] as const).map((c) => (k.includes(c)
    ? { kind: 'notFlag' as const, flag: DENS[c].flag }
    : { kind: 'flag' as const, flag: DENS[c].flag })),
  ...(effects ? { effects } : {}),
}));
const broodScenes = (): Record<string, Scene> => Object.fromEntries(BROODS.map((k) => {
  const parts = [...k].map((c) => `the ${DENS[c as keyof typeof DENS].name} ${DENS[c as keyof typeof DENS].from}`);
  const intro = k.length === 1
    ? `One wyrmling comes over the rim alone: ${parts[0]}, from the one den you left standing. It is all the brood the stone has left, and it is furious about it.`
    : `${k.length === 2 ? 'Two' : 'Three'} wyrmlings come over the rim together: ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}. Every den you left standing has answered the stone.`;
  const id = `clutch-${k}`;
  return [id, {
    id, kind: 'battle', encounterId: `den-clutch-${k}`, mapId: 'open', intro: [intro],
    onWin: { to: 'calling-approach', text: ['The last wyrmling drops out of the bruised light and does not get up. The rim is yours, and the hollow below waits. The stone\'s note wavers, as if it has just counted how few voices are still answering it.'],
      effects: [{ kind: 'setFlag', flag: 'clutch-beaten' }] },
  } satisfies Scene];
}));

/**
 * The party's answer to the sisters at the stone. Each sets a flag the ending
 * reads; none is the right one, and the sisters have a reply for each. The
 * level floor rides on every answer, so it lands before whichever fight comes.
 * Only the ending reads these flags, so they cost the reachability search nothing.
 */
const REPLIES = [
  { id: 'defiant', flag: 'answered-defiant', to: 'answer-defiant',
    label: '"She fed on this valley for a hundred years. We owe you nothing."' },
  { id: 'rueful', flag: 'answered-rueful', to: 'answer-rueful',
    label: '"Killing her broke the vigil. We know, and we are sorry for that part."' },
  { id: 'cold', flag: 'answered-cold', to: 'answer-cold',
    label: 'Say nothing. Draw your blade.' },
] as const;
const replyChoices: Choice[] = REPLIES.map((r) => ({ id: r.id, label: r.label, to: r.to,
  effects: [{ kind: 'xpToLevel', level: 5 },
    // A company that falls back and climbs again answers again; the last
    // answer is the one the valley remembers.
    ...REPLIES.filter((o) => o.id !== r.id).map((o) => ({ kind: 'clearFlag' as const, flag: o.flag })),
    { kind: 'setFlag', flag: r.flag }] }));
const TO_STONE: Choice[] = [{ id: 'on', label: 'Tear them out of the stone', to: 'tear-loose' }];

const MIRA_TOAST = 'Mira, who keeps the Wander-Inn down in Thornwick, has hauled a barrel all the way up to the camp. She pours the first round on the house, and the second before anybody asks. With the third comes her observation that heroes drink no more carefully than anyone else. The reeve orders a plaque made. Wren corrects the geography on it.';

const scenes: Record<string, Scene> = {
  // === ACT 1 — THE WAR-CAMP ==============================================
  muster: {
    id: 'muster', kind: 'story', art: { imageId: 'loc-camp', emoji: '⚔️' },
    text: [
      'The valley has raised an army at last. A **war-camp** spreads across the wet meadows below the high hills. Thornwick\'s recruits drill there, fen-folk with boar-spears and carters holding pikes. This time everyone can see the trouble coming. Every night there are fires burning up in the high passes, and no shepherd lit them.',
      'The story reaches you before you reach the tents. High in the hills stands the **Calling Stone**, a black fang of rock as old as the mountain. Someone has woken it. It sings a note that only monsters can hear, and that note pulls them down toward the valley. Every day it sings, more of them come.',
      'People whisper about who woke it. The **Reedwife\'s sisters** did, they say. They are two more hags, a head taller than any man, seen at the edge of the fen the night the barrows closed. Now the hills answer their stone. Wyrmlings ride the wind at dusk. Giant footprints cross the orchards. Streams run uphill, as if the stone called the water too.',
      'Word of your company reached the camp before you did. The crowd opens a path for you all the way to the command tent. Nobody says out loud that the sisters have come to collect a debt from you. They do not have to.',
    ],
    next: [{ id: 'go', label: 'Report to the command tent', to: 'envoys',
      // Cold-start floor: a fresh company begins the finale at 4th level
      // (no-op for a company continuing from The Sunken Barrows).
      effects: [{ kind: 'xpToLevel', level: 4 },
        { kind: 'journal', entry: { id: 'q-calling', kind: 'quest', title: 'Silence the Calling',
          body: 'The Reedwife\'s sisters have woken the Calling Stone in the high hills. Its song pulls wyrms, giants, and worse down on the valley. Climb the passes, kill what answers the call, and break the stone.' } }] }],
    noBack: true,
  },
  envoys: {
    id: 'envoys', kind: 'battle', encounterId: 'hag-coven', mapId: 'open',
    intro: [
      'You are ten paces from the command tent when the whole camp stops talking at once. A woman stands in your way. She was not there a moment ago. She stands a head taller than anyone in the camp, with river-weed braided into her hair. Two hired swords stand at her shoulders and watch you with bored, empty eyes.',
      '"The famous company," the Reedwife\'s sister says. Her smile has too many teeth in it. "My sister fed off that marsh for a hundred years. You cost this family its living, so we have come to settle the bill." She flexes her green fingers. "The rest of the collectors are gathering up on the mountain. Think of this as a knock at the door."',
    ],
    onWin: { to: 'envoys-won', text: ['The hag falls apart into reeds and river-water. She was never really standing there at all. Her hired swords were real, and they stay where they fall.'] },
    // Losing the opening fight gets its own beat: nobody has met Vex yet,
    // and the briefing that follows must not read as if you had won.
    onLoss: { to: 'envoys-lost', text: ['The hag\'s laugh is the last thing you hear. Then the mud comes up to meet you.'] },
  },
  'envoys-lost': {
    id: 'envoys-lost', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏕️' },
    text: [
      'You wake on a cot in the hospital tent. Camp scouts dragged you here out of the mud. The hag is gone, and her hired swords went with her. The scouts say she sank into a puddle, laughing.',
      'A grey-haired captain looks in through the tent flap. "She does that," he says. "When you can stand, come to the command tent. We have a war to plan, and you are in it."',
    ],
    next: [{ id: 'up', label: 'Get back on your feet', to: 'warcamp' }], noBack: true,
  },
  'envoys-won': {
    id: 'envoys-won', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'The command tent stands open. Inside, maps cover a table, and a grey-haired captain sits with a sword across his knees. He watches you duck in with the tired calm of a man whose bad guesses keep coming true.',
      '"That is the second one of those this week. You get used to it." He nods at the tent flap. "You did better than my patrols did."',
    ],
    next: TO_BRIEFING,
  },
  // Reached from the command tent only after losing to the envoy.
  'tent-after-loss': {
    id: 'tent-after-loss', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'The command tent stands open. Maps cover a table, and the grey-haired captain sits behind it with a sword across his knees. He has the tired calm of a man whose bad guesses keep coming true.',
      '"Sit down before you fall down," he says. "She did the same to my last two patrols. You lasted longer than they did."',
    ],
    next: TO_BRIEFING,
  },
  // Vex refused the party in Part 1, or this is a cold start: introduce him
  // plainly, in words that hold for both.
  'vex-brief': {
    id: 'vex-brief', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'This is **Vex**. He was the Ashfang\'s lieutenant once. When the chief made his last stand, Vex would not fight for him. He walked away and gave himself up to the reeve. Now Thornwick trusts him to run its war. "It took me too long to walk away," he says. "A slow learner still learns."',
      ...BRIEF_PLAN,
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('Vex was the Ashfang\'s lieutenant. He walked away from the chief\'s last fight and gave himself up. Now he runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.') }],
  },
  'vex-brief-turned': {
    id: 'vex-brief-turned', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'You know this man. It is **Vex**, once the Ashfang\'s lieutenant. In the chief\'s den he took your offer and kept his guards out of the last fight. Now Thornwick trusts him to run its war. "No more burned barns," he says. "I like this side better."',
      ...BRIEF_PLAN,
    ],
    next: [{ id: 'on', label: 'Step out into the camp', to: 'warcamp',
      effects: briefed('Vex was the Ashfang\'s lieutenant until he took your offer in the chief\'s den. Now he runs the valley\'s war-camp. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.') }],
  },
  warcamp: {
    id: 'warcamp', kind: 'explore',
    map: {
      title: 'The War-Camp', theme: 'ember', art: { imageId: 'loc-camp', emoji: '🏕️' },
      camp: {}, // safe: the one place in the valley with walls of spears
      // Overworld dressing: arrive at the command tent; tracks link the camp.
      entry: ['command'],
      roads: [
        ['command', 'stores'], ['stores', 'scouts'], ['stores', 'trailhead'],
      ],
      nodes: [
        // Unbriefed (the party lost to the envoy and was carried in), the
        // tent is where Vex gives the briefing the win would have led to.
        { id: 'command', x: 25, y: 30, label: 'The Command Tent', icon: 'tok-fire', scene: 'tent-after-loss',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'briefed' }], to: 'command-done' }] },
        { id: 'stores', x: 50, y: 45, label: 'The War-Stores', icon: 'tok-market', scene: 'wc-stores' },
        // Wren knows you if you pulled her out from under a horse (Part 1) or
        // walked the fen with her (Part 2); otherwise this is a first meeting.
        { id: 'scouts', x: 30, y: 70, label: 'The Scouts\' Fire', icon: 'tok-camp', scene: 'scouts-fire',
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'wren-brief' }], to: 'scouts-done' },
            { if: [{ kind: 'flag', flag: 'sunken-barrows:met-wren' }], to: 'scouts-fire-old' },
            { if: [{ kind: 'flag', flag: 'hollow-road:saved-scout' }], to: 'scouts-fire-old' },
          ] },
        { id: 'trailhead', x: 80, y: 60, label: 'The High Trail', icon: 'tok-gate', scene: 'hills-out',
          requires: [{ kind: 'flag', flag: 'briefed' }] },
      ],
    },
  },
  'command-done': {
    id: 'command-done', kind: 'story', art: { emoji: '🗺️' },
    text: ['The command tent works on. Guard posts, rations, the slow business of keeping frightened people pointed the right way. Vex adds a new pin to his map for every fight you win up in the hills. He would never say so, but he keeps them in a neat little row.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
  },
  'wc-stores': { id: 'wc-stores', kind: 'shop', title: 'The War-Stores', next: 'warcamp',
    npc: BRAM,
    intro: ['Bram has taken over a supply wagon and, by the look of things, every pricing decision in the war. "War makes everything cost more. Except my goods, because I am a patriot. Also the captain reads my books." He turns a crate around to face you. "There are big things up that hill. Buy accordingly."'] },
  // A first meeting: a cold start, or a company that never met her.
  'scouts-fire': {
    id: 'scouts-fire', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    lines: [
      'A young woman named **Wren** runs the scouts\' fire. Three riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She is young to be Chief of Scouts. She wears the title like a coat that fits her but embarrasses her anyway.',
      '"You are the company the camp keeps talking about? Good. Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. "And the streams are walking uphill. I have no advice about that one. I only know where they walk." She hesitates. "Come back down the hill on your own feet," she adds, a little too fast.',
    ],
    next: TAKE_NOTES,
  },
  // Wren knows the company from the marsh road or the deep fen.
  'scouts-fire-old': {
    id: 'scouts-fire-old', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    lines: [
      '**Wren** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She made Chief of Scouts young. She wears the title like a coat that fits her but embarrasses her anyway.',
      '"Right. Listen." She jabs a finger at the map. ' + WREN_BEASTS,
      WREN_GORGON,
      'She looks up. "And the streams are walking uphill. I have no advice about that one. I only know where they walk." She pauses. "So. Here we are again." She almost smiles. "Try to come down the hill on your own feet. We could make that a tradition."',
    ],
    next: TAKE_NOTES,
  },
  'scouts-done': {
    id: 'scouts-done', kind: 'story', art: { emoji: '🏹' },
    text: ['The scouts\' fire crackles through another change of shift. Wren\'s riders come and go with the brisk urgency she has drilled into them, and her map grows more arrowheads by the hour. She flicks you a two-finger salute without looking up.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
  },
  'hills-out': {
    id: 'hills-out', kind: 'story', art: { imageId: 'loc-hills', emoji: '⛰️' },
    text: ['The high trail leaves the last lookout behind at a stone marker the recruits have started saluting. Above you the hills stack up into the sky, pass over pass. Over the highest one you hear it for the first time: the **Calling**. It is not really a sound. It is a pull, like a door standing open somewhere above the clouds.'],
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
        { id: 'greenden', x: 38, y: 48, label: 'The Green Den', mystery: 'A sharp green stink…', icon: 'tok-cave', scene: 'greenden',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'green-cleared' }], to: 'greenden-done' }] },
        { id: 'seam', x: 50, y: 66, label: 'The Flooded Pass', mystery: 'A stream running uphill…', icon: 'tok-crossing', scene: 'seam',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'seam-cleared' }], to: 'seam-done' }] },
        { id: 'blueden', x: 58, y: 30, label: 'The Blue Mesa', mystery: 'A smell of thunder…', icon: 'tok-cave', scene: 'blueden',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'blue-cleared' }], to: 'blueden-done' }] },
        { id: 'onihold', x: 68, y: 56, label: 'The Middle Pass', mystery: 'A horn on a wall…', icon: 'tok-ruin', scene: 'onihold',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'oni-cleared' }], to: 'onihold-done' }] },
        { id: 'redden', x: 74, y: 22, label: 'The Burning Den', mystery: 'Smoke with no campfire…', icon: 'tok-fire', scene: 'redden',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'red-cleared' }], to: 'redden-done' }] },
        { id: 'gorgonvale', x: 84, y: 78, label: 'The Valley of Statues', mystery: 'Statues that are too good…', icon: 'tok-mystery', scene: 'gorgonvale',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'gorgon-cleared' }], to: 'gorgonvale-done' }] },
        { id: 'steading', x: 88, y: 44, label: 'The Giants\' Hall', mystery: 'Smoke above the tree-line…', icon: 'tok-house', scene: 'steading',
          sceneWhen: [{ if: [{ kind: 'flag', flag: 'steading-cleared' }], to: 'steading-done' }] },
        // The den-raiding payoff routes here: beat the clutch (or never let it
        // mass) and later visits cross a still ridge; clear all three dens and
        // the brood never masses at all. Falling back from the clutch fight
        // returns to a short beat, not the first sight of the ridge. First
        // matching sceneWhen wins.
        { id: 'callinggate', x: 95, y: 20, label: 'The Last Ridge', mystery: 'The pull, stronger…', icon: 'tok-boss', scene: 'calling-gate',
          requires: [{ kind: 'flag', flag: 'oni-cleared' }, { kind: 'flag', flag: 'steading-cleared' }],
          sceneWhen: [
            { if: [{ kind: 'flag', flag: 'clutch-beaten' }], to: 'ridge-quiet' },
            { if: [{ kind: 'flag', flag: 'clutch-skipped' }], to: 'ridge-quiet' },
            { if: [{ kind: 'flag', flag: 'green-cleared' }, { kind: 'flag', flag: 'blue-cleared' }, { kind: 'flag', flag: 'red-cleared' }], to: 'calling-gate-clear' },
            { if: [{ kind: 'flag', flag: 'calling-found' }], to: 'clutch-again' },
          ] },
      ],
    },
  },
  switchbacks: {
    id: 'switchbacks', kind: 'story', art: { imageId: 'loc-hills', emoji: '👣' },
    text: [
      'The path climbs in tight turns past empty shepherds\' huts with their roofs fallen in. The higher you go, the less the mountain hides.',
      'Burn marks streak the loose rock in three different sizes and three different colours. Green, blue, and red mean three separate dragons came this way.',
      'A boulder sits beside the trail with a handprint pressed into it. The hand was wider than a door.',
      'Water has cut channels straight across the path. There is no stream up here. There should be no water at all.',
      'And under all of it, that steady pull. The stone is drawing every monster on this mountain toward one high place. Whatever you beat down here will not be waiting for you at the top.',
    ],
    next: [{ id: 'on', label: 'Pick your fights', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'hills-read' }] }],
  },
  'switchbacks-done': {
    id: 'switchbacks-done', kind: 'story', art: { emoji: '👣' },
    text: ['The switchbacks wind away below you, familiar now. Up ahead, the Calling still pulls at the edge of hearing.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'hills-night': {
    id: 'hills-night', kind: 'battle',
    // A night attack is a setback, not a payday: no XP or loot, so a
    // risky camp can't be farmed by resting over and over.
    loot: false, encounterId: 'harpy-roost', mapId: 'open',
    intro: ['The singing starts an hour after you bank the fire. It is sweet, and wrong, and getting closer. Harpies come riding the night wind down from the crags. Their song tugs at your legs and puts words in your head. *Stand up. Walk to the edge. It is not far.* You wake in time, mostly because the sentry threw a boot.'],
    onWin: { to: '@hub', text: ['The last harpy drops into the dark with its song broken. You do not sleep again that night. You bank the fire and count the watches until a grey, quiet dawn.'] },
  },
  tollcliff: {
    id: 'tollcliff', kind: 'story', art: { emoji: '🦁' },
    text: [
      'The trail narrows under an overhang, and the overhang is occupied. A **manticore** lies stretched along it like a lord at his dinner table. It has the body of a lion, the wings of a bat, and a tail covered in black spikes. Its face is human, which is somehow the worst part.',
      '"Toll," it says. Its voice is a purr dragged over gravel. "Everything that walks my cliff pays. The goblins paid in sheep. The hags paid in promises." Its grin widens by one tooth too many. "You will pay in meat. I have decided."',
    ],
    next: [
      { id: 'fight', label: 'Pay it in steel', to: 'tollcliff-fight' },
      { id: 'leave', label: 'Leave it on its ledge', to: 'hills' },
    ],
  },
  'tollcliff-fight': {
    id: 'tollcliff-fight', kind: 'battle', encounterId: 'manticore-cliff', mapId: 'cliff',
    intro: ['"Steel, then," the manticore sighs, sounding genuinely put out. Its tail curves over its shoulder like a drawn bow. Two goblins scramble up from the rocks behind it with spears. They are probably the ones who paid in sheep, working off a debt.'],
    onWin: { to: 'hills', text: ['The manticore drops onto the trail with one last offended word. "Toll." The pile in the overhang holds ten years of payments, taken from frightened travellers.'],
      effects: [{ kind: 'setFlag', flag: 'tollcliff-cleared' }, { kind: 'gold', amount: 110 }] },
  },
  'tollcliff-done': {
    id: 'tollcliff-done', kind: 'story', art: { emoji: '🦁' },
    text: ['The overhang stands empty and its hoard is picked clean. The trail below is free to walk now. It may take the local shepherds a whole generation to believe it.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  boarruns: {
    id: 'boarruns', kind: 'story', art: { emoji: '🐗' },
    text: [
      'A dry gully crosses the trail here. Hooves have churned its floor to mud and left coarse hair all over it. These are the **boar-runs**, and the drumming under your boots says the herd is coming. These are not farm pigs. The hoofprints are as wide as wash-basins.',
      'Something has been driving the herd uphill, day after day. The Calling wants its beasts angry and moving.',
      'You can leave the herd to its runs and turn back. Or you can meet the stampede where the gully narrows and break the herd for good.',
    ],
    next: [
      { id: 'fight', label: 'Meet the stampede at the narrows', to: 'boarruns-fight' },
      { id: 'wait', label: 'Leave the herd to its runs', to: 'hills' },
    ],
  },
  'boarruns-fight': {
    id: 'boarruns-fight', kind: 'battle', encounterId: 'boar-stampede', mapId: 'pass',
    intro: ['The drumming turns into thunder. Two boars the size of hay-carts come down the narrows shoulder to shoulder. Their tusks are as long as plough blades and their eyes are mad with the Calling. Then you notice that the gully narrows behind you as well.'],
    onWin: { to: 'hills', text: ['The stampede breaks around its fallen leaders. The rest of the herd scatters over the far ridge, away from the valley. You have just saved the war-camp from a living battering ram.'],
      effects: [{ kind: 'setFlag', flag: 'boarruns-cleared' }, { kind: 'gold', amount: 40 }] },
  },
  'boarruns-done': {
    id: 'boarruns-done', kind: 'story', art: { emoji: '🐗' },
    text: ['The boar-runs lie still, and grass is growing back over the churned earth. The herd keeps to the far side of the ridge now. It has learned what the narrows cost.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  greenden: {
    id: 'greenden', kind: 'battle', encounterId: 'green-dragon-den', mapId: 'marsh',
    intro: [
      'The thicket smells of cut grass gone bad, sharp and rotten at the same time. That smell means a **green wyrmling**. Its den is a tunnel dug through strangling briar, and the floor is a bed of picked bones. Everything in that pile mistook a young dragon for a safe one. Its kobolds are shrieking the alarm.',
      'The wyrmling slides out of the briar like an eel out of a wall. It is small. Its grin is still a dragon\'s grin. This is one more monster for the Calling, unless you stop it here.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling drops in the middle of a hiss, and its poison breath fades to a harmless stink. That is one monster fewer for the Calling. The den\'s small hoard rides out in your packs.'],
      effects: [{ kind: 'setFlag', flag: 'green-cleared' }, { kind: 'gold', amount: 75 }] },
  },
  'greenden-done': {
    id: 'greenden-done', kind: 'story', art: { emoji: '🌿' },
    text: ['The briar tunnel stands silent, and the sharp green stink has faded to ordinary rot. There is one dragon fewer in these hills.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  seam: {
    id: 'seam', kind: 'story', art: { emoji: '🌊' },
    text: [
      'A mountain brook runs up the pass instead of down it, quickly and steadily, straight against gravity. Where it pools at the top, the pool has a shape. It has shoulders. It waits with a patience that water should not have.',
      'The weeks the Undercrypt\'s ward stood broken left thin places in the world, and something came through this one. The Calling holds it here like a cork in a bottle. The road to the middle pass runs right through its pool.',
    ],
    next: [{ id: 'fight', label: 'Break the water', to: 'seam-fight' }],
  },
  'seam-fight': {
    id: 'seam-fight', kind: 'battle', encounterId: 'water-vortex', mapId: 'bog',
    intro: ['The pool stands up. Twelve feet of mountain water in the rough shape of a giant, cold as the crack it came through. The **water elemental** does not roar. It simply pours itself at you, and it hits like the flood it actually is.'],
    onWin: { to: 'hills', text: ['The elemental loses its argument with gravity all at once. It collapses into a hundred gallons of ordinary water, which hurries away downhill as if embarrassed. The thin place behind it closes. The pass is open.'],
      effects: [{ kind: 'setFlag', flag: 'seam-cleared' }, { kind: 'gold', amount: 50 }] },
  },
  'seam-done': {
    id: 'seam-done', kind: 'story', art: { emoji: '💧' },
    text: ['The brook runs downhill now, the way brooks should, chattering over the stones with no shape in it at all. The crack it came through stays shut.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  blueden: {
    id: 'blueden', kind: 'battle', encounterId: 'blue-dragon-den', mapId: 'ruins',
    intro: [
      'The mesa smells like a storm about to break. A **blue wyrmling** has taken the ruined watchtower at its top, and its kobolds have been busy. They have lashed copper rods to every standing wall to catch the lightning, and the rods hum.',
      'The wyrmling uncoils along a broken wall, crackling with pride, and the air turns sharp and metallic. Someone has clearly told it that it will be enormous one day. Nobody has told it about you.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling falls off the wall trailing dead sparks, and the copper rods go cold. The hoard here was tribute, saved up for a dragon\'s future. It pays for your present instead.'],
      effects: [{ kind: 'setFlag', flag: 'blue-cleared' }, { kind: 'gold', amount: 95 }] },
  },
  'blueden-done': {
    id: 'blueden-done', kind: 'story', art: { emoji: '⚡' },
    text: ['The ruin on the mesa stands empty, and its copper rods are turning green. The storms overhead are only weather now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  onihold: {
    id: 'onihold', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: [
      'The middle pass is held. Not squatted in. Held properly, by someone who knows soldiering. A stone fort rebuilt in a week by hands that lift boulders like loaves of bread. Guard posts of sharpened pine. A horn on the wall that has sounded once today.',
      'The holder stands above the gate: an **ogre-mage**, blue-skinned, wearing scraps of old lacquered armour. It looks down at you, and that look frightens you more than anything else in these hills, because it is thinking.',
      '"The stone sings," it calls down, pleasantly. "We answered first, and whoever answers first holds the pass. Pay a toll of one hundred and fifty gold, and we will find another war. Or try us, little debtors."',
    ],
    next: [
      { id: 'pay', label: 'Pay the toll (150 gold)', to: 'onihold-paid',
        requires: [{ kind: 'gold', atLeast: 150 }],
        effects: [{ kind: 'gold', amount: -150 }, { kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'setFlag', flag: 'oni-paid' }] },
      { id: 'fight', label: 'Try them', to: 'onihold-fight' },
    ],
  },
  // Bought off: the ogre-mage takes the gold and its warband leaves the mountain.
  'onihold-paid': {
    id: 'onihold-paid', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The ogre-mage weighs the purse in one blue hand and smiles. "A war that pays before it starts is the best kind." It blows the horn three times. By noon its warband is marching down the far side of the mountain, away from the valley. The middle pass is open.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'onihold-fight': {
    id: 'onihold-fight', kind: 'battle', encounterId: 'oni', mapId: 'corridor',
    intro: ['The horn sounds twice, and the gate opens on the ogre-mage\'s guard. An ogre in an iron collar marches out with its maul on its shoulder, like a drilled soldier. An orc veteran in stolen mail calls the step. Then the ogre-mage itself rises off the wall on a cold wind with its blade drawn. The air darkens around it like ink spreading through water.'],
    onWin: { to: 'hills', text: ['The ogre-mage falls out of its own darkness, astonished right to the end. Its drilled guard lies dead at the gate. The middle pass stands open, and beyond it lies the road to the giants\' hall and the stone. The fort\'s war-chest is yours, fair and square.'],
      effects: [{ kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'gold', amount: 130 }] },
  },
  'onihold-done': {
    id: 'onihold-done', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The fort at the middle pass stands empty, its horn silent on the wall. Wren\'s scouts have been through. They have chalked a small arrowhead by the gate, pointing up.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  redden: {
    id: 'redden', kind: 'battle', encounterId: 'red-dragon-den', mapId: 'firepit',
    intro: [
      'You smell the den before you see it: woodsmoke with a hot, metal edge to it. It sits in a scorched bowl of hillside where a **red wyrmling** has built itself a forge-hall out of split rock and cinders. Kobolds tend heaps of half-melted treasure with the care of moneylenders.',
      'The wyrmling lies on the largest heap with one eye open. Red dragons are the proudest of a proud family, and the stone\'s song promised this one a war. It rises, burning with its own light, delighted that you have saved it the trip downhill.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling\'s fire goes out from the inside, and it is finally, simply small. Its half-melted hoard cools into heavy lumps. They are the honest kind, and Bram will weigh them twice and pay well.'],
      effects: [{ kind: 'setFlag', flag: 'red-cleared' }, { kind: 'gold', amount: 120 }] },
  },
  'redden-done': {
    id: 'redden-done', kind: 'story', art: { emoji: '🔥' },
    text: ['The burning den has gone cold. Rain has found the scorched bowl, and something green is growing up through the ash, thoroughly unimpressed by dragons.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  gorgonvale: {
    id: 'gorgonvale', kind: 'story', art: { emoji: '🗿' },
    text: [
      'The statues in this valley are far too good. A shepherd caught mid-stride with one arm flung up. A wolf turning to run. A hired sword with his blade half drawn and a look on his face you can read from thirty paces. No sculptor chose these subjects, and no sculptor ever worked this fast.',
      'At the head of the valley stands a bull made of black iron plates, grazing between its own victims. This is a **gorgon**. Its breath turns living things to stone, and steam curls from its nostrils in the cold air. The Calling drew it down from somewhere higher and worse.',
      'It has not noticed you yet. The statues suggest that never lasts long.',
    ],
    next: [
      { id: 'fight', label: 'Go in blade-first', to: 'gorgonvale-fight' },
      { id: 'leave', label: 'Back away before it looks up', to: 'hills' },
    ],
  },
  'gorgonvale-fight': {
    id: 'gorgonvale-fight', kind: 'battle', encounterId: 'gorgon-maze', mapId: 'corridor',
    intro: ['The gorgon\'s head comes up, and its breath comes with it. A rolling green vapour turns the grass it touches into grey stalks of stone. It charges through its own statues with its iron plates thundering, and the valley becomes a maze of stone people with you inside it.'],
    onWin: { to: 'hills', text: ['The gorgon crashes onto its side with a sound like a foundry falling downstairs, and the green vapour thins away to nothing. The statues keep their silent watch. But the collection is closed.'],
      effects: [{ kind: 'setFlag', flag: 'gorgon-cleared' }, { kind: 'gold', amount: 100 }] },
  },
  'gorgonvale-done': {
    id: 'gorgonvale-done', kind: 'story', art: { emoji: '🗿' },
    text: ['The valley of statues stands in permanent, silent company. Moss will cover them in time, and shepherds will tell stories about them for much longer. Nothing grazes between them now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  steading: {
    id: 'steading', kind: 'battle', encounterId: 'giants', mapId: 'ruins',
    intro: [
      'Above the tree-line stands the giants\' hall, built from whole pine trunks and stone blocks as big as wagons. Something put it up in a single season and treated the work as simple stacking. The **ettin** that holds it comes out at the first scrape of your boots. It is two heads arguing on top of one enormous body. A shaggy ogre in a sheepskin stumbles out behind it, still chewing. A skinny orc runner trots at its heels.',
      '"THE STONE PROMISED US THE VALLEY," booms the left head. "The stone promised ME the valley," the right head corrects. Then both heads notice you at the same moment, and for the first time all day they agree about something.',
    ],
    onWin: { to: 'hills', text: ['The ettin goes down still arguing about whose fault it was. The ogre and the orc runner lie beside it. Inside the hall you find tribute, plunder, and an entire orchard\'s worth of pickled fruit, all of it bound for the war-camp below. Two loud voices on the mountain have stopped answering the stone.'],
      effects: [{ kind: 'setFlag', flag: 'steading-cleared' }, { kind: 'gold', amount: 140 }] },
  },
  'steading-done': {
    id: 'steading-done', kind: 'story', art: { emoji: '🏚️' },
    text: ['The giants\' hall stands hollow, its doorway a bright rectangle of sky. Vex will want it for a forward post. Wren\'s scouts have claimed the roof.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },

  // === ACT 3 — THE CALLING ===============================================
  // The clutch path: any wyrm den left standing means the brood masses on
  // the ridge and must be fought through to reach the stone.
  'calling-gate': {
    id: 'calling-gate', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [
      'You reach the last ridge. The Calling is not a pull any more. It is a pressure, a note held so long that the mountain hums it back at you.',
      'Beyond the ridge, a bowl of bare rock opens under the sky. At its centre stands the **stone**: a single black fang, older than anyone can guess, wrapped in a light that hurts to look at.',
      'Wingbeats ride the wind. The rim of the bowl is where the wyrms gather, and the Calling has pulled every wyrmling it could still reach up there to meet you. Clear the rim, and only the stone and its keepers are left.',
    ],
    next: broodChoices([{ kind: 'setFlag', flag: 'calling-found' }]),
    noBack: true,
  },
  // The den-raiding payoff: all three dens emptied, so the brood never masses.
  'calling-gate-clear': {
    id: 'calling-gate-clear', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [
      'You reach the last ridge. The Calling is not a pull any more. It is a pressure, a note held so long that the mountain hums it back at you.',
      'Beyond the ridge, a bowl of bare rock opens under the sky. At its centre stands the **stone**: a single black fang, older than anyone can guess, wrapped in a light that hurts to look at.',
      'Nothing moves overhead. The rim is a gathering ground with nothing gathered on it. You emptied every den on the way up, so there is no brood left to send against you. You cross the ridge unopposed. Only the stone and its keepers are left.',
    ],
    next: [{ id: 'on', label: 'Down into the bowl', to: 'calling-approach',
      effects: [{ kind: 'setFlag', flag: 'calling-found' }, { kind: 'setFlag', flag: 'clutch-skipped' }] }],
    noBack: true,
  },
  'ridge-quiet': {
    id: 'ridge-quiet', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: ['The ridge lies still, and no wings ride the wind. Below you, the bowl and the stone wait in their bruised light.'],
    next: [{ id: 'on', label: 'Down into the bowl', to: 'calling-approach' }], noBack: true,
  },
  // Back at the ridge after falling back from the clutch.
  'clutch-again': {
    id: 'clutch-again', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: ['The brood still circles the rim of the bowl, shrieking. They watched you go, and they have been waiting for you to come back.'],
    next: broodChoices(),
  },
  ...broodScenes(),
  'calling-approach': {
    id: 'calling-approach', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: [
      'Down in the bowl, at the foot of the stone, the **sisters** are waiting. The two hags stand a head taller than any man. They have pushed their green fingers to the knuckle into the black rock.',
      'They are not commanding the stone. They are pouring themselves into it. Their hair has turned to river-weed and wire. Their faces are burning down like candles. They are spending two long lives to keep the Calling singing.',
      '"Sister-killers," they say together, without turning around. "You cut her down in the chief\'s hall. So we woke the stone, and we called the hills down on everyone you saved." The light around the stone thickens, and the ground beneath it begins, gently, to burn. "But you came so far. Stay. The last of the collection is arriving now. Out of the fire, and out of the ground."',
    ],
    // The level floor lands before the hardest fight, not after it: every
    // answer carries it (see REPLIES).
    next: replyChoices,
  },
  'answer-defiant': {
    id: 'answer-defiant', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['The sisters laugh together, a sound like wind in dry reeds. "A hundred years," one says. "And in all those years, the dead never once walked. Ask your barrows what your hundred years bought you." Their hands sink deeper into the stone, and the burning ground creeps toward your boots.'],
    next: TO_STONE, noBack: true,
  },
  'answer-rueful': {
    id: 'answer-rueful', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['For one breath, the song falters. A sister turns her burning face toward you. "Sorry," she says slowly, as if nobody has ever said the word to her before. "Sorry does not put the dead back to sleep. But we heard it." She turns back to the stone. "Now hold still."'],
    next: TO_STONE, noBack: true,
  },
  'answer-cold': {
    id: 'answer-cold', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🗿' },
    text: ['You say nothing. The ring of your blade leaving its sheath is your whole answer. The sisters go quiet, and for the first time they look a little afraid. "Then come and pull us out," they say together. "If you can."'],
    next: TO_STONE, noBack: true,
  },
  // Face them, or let the stone spend them: a success means the sisters fight
  // in person (`sisters-battle`); every approach failing means the stone
  // throws its whole cataclysm at you instead (`calling-battle`).
  'tear-loose': {
    id: 'tear-loose', kind: 'challenge', art: { imageId: 'loc-mountain', emoji: '🗿' },
    intro: [
      'The sisters have sunk their hands to the wrist in the black rock. The stone is drinking them down. A crack of fire opens across the floor of the bowl, and something huge is climbing up out of it.',
      'All their power is in the stone now. Pull them out, and they must fight you with their own two hands. Leave them there, and the stone will spend every last drop of them at once.',
    ],
    retry: 'perApproach',
    approaches: [
      { id: 'drag', label: 'Drag their hands out of the rock', hint: 'Grab a wrist each and pull, while the stone pulls back.',
        skill: 'athletics', dc: 15,
        failure: { to: 'tear-loose', text: ['The rock holds them fast. You let go with burned palms, and the stone keeps drinking.'] } },
      { id: 'song', label: 'Break the song', hint: 'Sing a wrong note into the Calling and knock it off its beat.',
        skill: 'arcana', dc: 15,
        failure: { to: 'tear-loose', text: ['Your wrong note goes into the song and vanishes. The Calling swallows it and sings on.'] } },
      // Halden lived through the barrows, and he taught the company his rites.
      { id: 'rites', label: 'Say Halden\'s rites over the stone', hint: 'Brother Halden taught you the old words for shutting a door.',
        skill: 'religion', dc: 11,
        requires: [{ kind: 'flag', flag: 'sunken-barrows:halden-saved' }], hideWhenBlocked: true,
        success: { to: 'sisters-battle', text: ['Halden\'s old words fall on the stone like cold water on a hot pan. The black rock hisses and lets go. Both sisters stagger free, smoking and furious.'] },
        failure: { to: 'tear-loose', text: ['You lose the words halfway through. Halden always warned you to say them whole.'] } },
      { id: 'seam', label: 'Find where the stone is weakest', hint: 'Look for the seam the song leaks out of, and hit it hard.',
        skill: 'investigation', dc: 14,
        failure: { to: 'tear-loose', text: ['Every face of the stone looks the same to you, smooth and black and singing.'] } },
    ],
    success: { to: 'sisters-battle', text: ['The stone gives a crack like a snapped bone and throws the sisters off. They land on their feet, smoking and furious. For the first time in a hundred years, the coven has to fight for itself.'] },
    failure: { to: 'calling-battle', text: ['Nothing you try reaches them. The sisters sink into the stone to the elbow, and the stone takes everything they have left.'] },
    noBack: true,
  },
  // Torn loose: the sisters fall fighting, beside the one elemental the stone
  // still had the strength to raise.
  'sisters-battle': {
    id: 'sisters-battle', kind: 'battle', encounterId: 'sisters-at-stone', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The sisters come at you with green claws and burning faces. Behind them, the crack in the floor gives up the last thing the stone can pay for. A pillar of living fire climbs out and turns toward you. This time the sisters have to fight for themselves.'],
    onWin: { to: 'calling-won', text: ['The first sister falls clawing at your boots. The second falls calling her dead sister\'s name, and then cursing yours. Both of them crumble into drifts of dry reeds. The fire gutters out of the air. The black fang has nobody left to spend, so it cracks from top to bottom and falls silent. The Calling ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  'calling-battle': {
    id: 'calling-battle', kind: 'battle', encounterId: 'elemental-cataclysm', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The sisters pour the last of themselves into the stone, and the stone spends it all at once. The floor of the bowl splits along a burning crack. A pillar of living fire climbs out of it. The mountain\'s own bones heave up into a shape with fists. The sisters\' hands sink into the rock to the wrist, and they do not let go. The Calling\'s last note is a disaster, and it has your name in it.'],
    onWin: { to: 'calling-won', text: ['The sisters crumble into drifts of dry reeds, smiling as they go. The fire gutters out of the air. The stone shape shakes itself apart into loose rubble. The black fang has nothing left to spend and nobody left to spend it, so it cracks from top to bottom and falls silent. The Calling does not end with thunder. It ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  'calling-won': {
    id: 'calling-won', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌅' },
    text: [
      'It is over. The **Calling Stone** lies cracked and silent, and the sisters are gone with it. Where they fell, a scatter of dry reeds lifts on the wind. The revenge they climbed all this way to take burned away in the taking. Your company has the mountain to itself.',
      'Below you, pass by pass, the hills go still. The song that pulled monsters toward the valley has stopped, so the monsters stop with it. Whatever was walking toward the stone lies down where it stands, and the wingbeats fade off the wind. The valley is safe. Far down the slope, faint and disbelieving, the war-camp starts to cheer.',
    ],
    next: [{ id: 'down', label: 'Come down the mountain', to: 'wc-aftermath' }],
  },
  'wc-aftermath': {
    id: 'wc-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      'You come down the hill on your own feet. You walk into a camp that has stopped being an army and started being the biggest festival the valley has ever thrown.',
      'Vex shakes your hand like a man signing off on accounts he never expected to balance. "The Calling is broken," he says. "Tomorrow this camp packs up and everybody goes home. Do stop now, before your luck notices you."',
      'Wren says nothing at all. She just looks at the four of you, then up at the hills, and grins her whole age for once. Then she remembers that she is Chief of Scouts, coughs, and asks for your route report.',
    ],
    next: [
      { id: 'pay', label: 'Accept the valley\'s purse — every village paid in', to: 'wc-purse',
        effects: [{ kind: 'gold', amount: 250 }] },
      ...TO_EPILOGUE,
    ],
    noBack: true,
  },
  'wc-purse': {
    id: 'wc-purse', kind: 'story', art: { imageId: 'loc-camp', emoji: '💰' },
    text: ['Every village in the valley paid into the purse, and a farmer from each one comes up to shake your hand. It takes most of the evening.'],
    next: TO_EPILOGUE, noBack: true,
  },
  'wc-defeat': {
    id: 'wc-defeat', kind: 'story', art: { imageId: 'loc-camp', emoji: '🏕️' },
    text: [
      'You wake in the hospital tent to canvas light and the smell of Bram\'s cooking, which nobody voted for. The scouts carried you off the mountain in relays.',
      'Vex looks in, sees that you are breathing, and sets your kit at the foot of the cot without a word. The hills are still up there. The stone is still calling. It is only waiting.',
    ],
    next: [{ id: 'up', label: 'Back on your feet', to: 'warcamp' }], noBack: true,
  },
  // The one ending: its text holds for every company, and the slides read
  // the run back. Each slide stands alone, so any mix of them reads in order.
  'wc-epilogue': {
    id: 'wc-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'The valley remembers it as the year of three wars: the raiders, the graves, and the hills. The songs about the last one all end on the same mountain, with your company standing on it. You silenced the Calling, and the coven\'s long debt burned away to reeds on a mountain wind.',
      MIRA_TOAST,
      'Vex raises a glass to the four of you. "To the company," he says. "Paid in full."',
    ],
    slides: [
      { if: [{ kind: 'flag', flag: 'hollow-road:chief-dead' }],
        text: 'The same four names run through all three songs. You broke the Ashfang. You sealed the Undercrypt.' },
      { if: [{ kind: 'flag', flag: 'hollow-road:vex-turned' }],
        text: 'Vex has seen every side of the valley\'s troubles, and he finally picked the right one.' },
      { if: [{ kind: 'notFlag', flag: 'hollow-road:vex-turned' }],
        text: 'Vex once walked away from the losing side, and he still looks surprised to be on the winning one.' },
      { if: [{ kind: 'flag', flag: 'oni-paid' }],
        text: 'Far past the mountain, an ogre-mage\'s warband marches on someone else\'s valley, and your gold paid for its boots.' },
      { if: [{ kind: 'notFlag', flag: 'oni-paid' }],
        text: 'The fort at the middle pass becomes Vex\'s lookout, and no warband holds that pass against the valley again.' },
      { if: [{ kind: 'flag', flag: 'clutch-skipped' }],
        text: 'No dragon flies over the high pastures again, because you burned out every den on the way up.' },
      { if: [{ kind: 'flag', flag: 'clutch-beaten' }],
        text: 'The wyrmlings you left in their dens died on the rim instead, and the shepherds still give those dens a wide berth.' },
      { if: [{ kind: 'flag', flag: 'answered-defiant' }],
        text: 'The valley still says what you told the sisters: she fed on us for a hundred years, so we owe her nothing.' },
      { if: [{ kind: 'flag', flag: 'answered-rueful' }],
        text: 'Some nights you still think about the sisters, and about the vigil you ended without knowing it was one.' },
      { if: [{ kind: 'flag', flag: 'answered-cold' }],
        text: 'Nobody ever learns what you said to the sisters at the stone, because you said nothing at all.' },
      { if: [{ kind: 'flag', flag: 'hollow-road:saved-scout' }],
        text: 'Wren still limps on cold mornings, and she tells every new scout how you lifted a dead horse off her leg.' },
      { if: [{ kind: 'notFlag', flag: 'hollow-road:saved-scout' }, { kind: 'flag', flag: 'sunken-barrows:met-wren' }],
        text: 'Wren tells every new scout how she held the gate of the Undercrypt, and how you walked back out.' },
      { if: [{ kind: 'notFlag', flag: 'hollow-road:saved-scout' }, { kind: 'notFlag', flag: 'sunken-barrows:met-wren' }],
        text: 'Wren pins her map of the passes over her bed, arrowheads and all, with your four names inked along the top.' },
      { if: [{ kind: 'flag', flag: 'sunken-barrows:halden-saved' }],
        text: 'Brother Halden climbs to the bowl each spring to bless the broken stone, and then he walks home to his little chapel.' },
      { if: [{ kind: 'flag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the Undercrypt\'s door still holds, though on still nights the fen-folk swear they hear something knock.' },
      // A company that played Part 2 always met Wren there; a clean seal.
      { if: [{ kind: 'flag', flag: 'sunken-barrows:met-wren' }, { kind: 'notFlag', flag: 'sunken-barrows:seal-cracked' }],
        text: 'Deep under the fen, the Undercrypt\'s door stays shut and silent, just as you left it.' },
    ],
  },
};

export const WYRMCALLING_MODULE: Module = {
  id: 'wyrmcalling', title: 'The Wyrmcalling',
  blurb: 'The Reedwife\'s sisters wake the Calling Stone, and the hills answer with wyrms, giants, and worse. Climb the passes, thin what answers, and silence the stone.',
  cover: 'loc-mountain',
  levelBand: { from: 4, to: 5 },
  start: 'muster', scenes, defeatScene: 'wc-defeat', town: 'warcamp',
};
