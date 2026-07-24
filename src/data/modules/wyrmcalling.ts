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
 * the stone itself. The mid fights are genuinely optional; the dens have a
 * mechanical payoff too (clear all three and the chromatic clutch never
 * masses at the gate).
 *
 * XP budget (trilogy-plan.md): required spine ≈ 9,450 (coven 750, the
 * flooded seam 1,800, the oni's hold 1,650, the giants' hall 1,650,
 * cataclysm finale 3,600); optional dens/beasts add up to ~6,000 more. A
 * continuing company (~3,050 XP from Part 2) that raids most of the hills
 * passes L5's 6,500 honestly; `xpToLevel: 5` on the finale win is the floor
 * for a fight-shy run. Cold starts are floored to L4 by the opening choice.
 *
 * MONSTER VARIETY: the top shelf, none of it fielded by Parts 1–2 — the hag
 * coven, harpies by night, a talking manticore, boar stampedes, three
 * chromatic wyrmlings (or their massed clutch), an ogre-mage's warband, an
 * ettin's hall, a gorgon, a water elemental, and the fire-and-earth
 * cataclysm at the stone.
 *
 * VOICE: plain, concrete, Zelda-register. Every image resolves inside the
 * passage it appears in (no riddle-similes), a character speaks the stakes
 * rather than the narrator implying them, proper nouns get a physical anchor
 * on first use, and abstractions give way to things a reader can see. See
 * docs/module-writing-guide.md.
 */
import type { Module, Scene } from '../../adventure/types.js';

const VEX = { id: 'npc-vex', name: 'Captain Vex', portraitId: 'npc-captain', emoji: '🗡️' };
const WREN = { id: 'npc-wren', name: 'Wren, Chief of Scouts', portraitId: 'npc-scout', emoji: '🏹' };
const BRAM = { id: 'npc-bram', name: 'Bram, War-Quartermaster', portraitId: 'npc-merchant', emoji: '🧑‍🌾' };

const scenes: Record<string, Scene> = {
  // === ACT 1 — THE WAR-CAMP ==============================================
  muster: {
    id: 'muster', kind: 'story', art: { imageId: 'loc-camp', emoji: '⚔️' },
    text: [
      'The valley has raised an army at last. A **war-camp** spreads across the wet meadows below the high hills. Thornwick\'s recruits drill there, fen-folk with boar-spears and carters holding pikes. This time everyone can see the trouble coming. Every night there are fires burning up in the high passes, and no shepherd lit them.',
      'The story reaches you before you reach the tents. High in the hills stands the **Calling Stone**, a black fang of rock as old as the mountain. Someone has woken it. It sings a note that only monsters can hear, and that note pulls them down toward the valley. Every day it sings, more of them come.',
      'People whisper about who woke it. The **Reedwife\'s sisters** did, they say — two more hags, tall as doorframes, seen at the edge of the fen the night the barrows closed. Now the hills answer their stone. Wyrmlings ride the wind at dusk. Giant footprints cross the orchards. Streams run uphill, as if the stone called the water too.',
      'Everyone in this camp knows you. You broke the Ashfang. You shut the Undercrypt. The crowd opens a path for you all the way to the command tent. Nobody says out loud that the sisters have come to collect your debt. Nobody needs to.',
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
      'You are ten paces from the command tent when the whole camp goes quiet at once. A woman stands in your way. She was not there a moment ago. She is tall as a doorframe, with river-weed braided into her hair. Two hired swords stand at her shoulders and watch you with bored, empty eyes.',
      '"The famous company," the Reedwife\'s sister says. Her smile has too many teeth in it. "My sister fed off that marsh for a hundred years. You cost this family its living, so we have come to settle the bill." She flexes her green fingers. "The rest of the collectors are already gathering up on the mountain. Think of this as a knock at the door."',
    ],
    onWin: { to: 'envoys-won', text: ['The hag falls apart into reeds and river-water. She was never really standing there at all. Her hired swords were real, and they stay where they fall.'] },
  },
  'envoys-won': {
    id: 'envoys-won', kind: 'story', art: { imageId: 'loc-camp', emoji: '🗡️' },
    text: [
      'The command tent is already open. Inside, maps cover a table, and a grey-haired captain sits with a sword across his knees. He watches you duck in with the tired calm of a man whose worst guesses keep coming true. This is **Vex**. He was the Ashfang\'s lieutenant once. Now Thornwick trusts him to run its war.',
      '"That is the second one of those this week. You get used to it." He taps the map, where the high passes are marked fire by fire. "Here is the problem. The stone calls, and the hills answer. There are wyrm dens here, here, and here. An ogre-mage holds the middle pass with a warband. An ettin has taken a hall above the tree-line. And there are things in the streams now that are not fish."',
      '"When the Calling reaches its peak, all of it comes down this slope at once. Unless it is already dead." He looks up at you. "So here is the deal. Every den you burn out is one monster fewer on the day. Fight as many as your legs will carry you to. My scouts will keep the map honest."',
      'A thin smile crosses his face and vanishes. "I would come myself, but apparently I am respectable now. Nobody warns you about that part."',
    ],
    next: [{ id: 'on', label: 'Take the war-camp', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'briefed' },
        { kind: 'journal', entry: { id: 'n-vex3', kind: 'npc', title: 'Captain Vex',
          body: 'The Ashfang\'s old lieutenant now runs the valley\'s war-camp. He is tired, careful, and right more often than anyone likes. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks.' } },
        { kind: 'journal', entry: { id: 'lead-stone', kind: 'lead', resolvedBy: 'calling-found',
          title: 'The Calling Stone', body: 'Somewhere past the ogre-mage\'s pass and the giants\' hall, the sisters are tending the stone that calls the hills down. Climb until you find it.' } }] }],
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
    text: ['Vex is arguing with three recruits about guard rotations, keeping time by waving a map-weight at them. He gives you a nod that means the hills are that way and you know your business. From Vex, that counts as a warm send-off.'],
    next: [{ id: 'ok', label: 'Leave him to the war', to: 'warcamp' }],
  },
  'command-done': {
    id: 'command-done', kind: 'story', art: { emoji: '🗺️' },
    text: ['The command tent works on. Guard posts, rations, the slow business of keeping frightened people pointed the right way. Vex adds a new pin to his map for every fight you win up in the hills. He would never say so, but he keeps them in a neat little row.'],
    next: [{ id: 'ok', label: 'Back to the camp', to: 'warcamp' }], noBack: true,
  },
  'wc-stores': { id: 'wc-stores', kind: 'shop', title: 'The War-Stores', next: 'warcamp',
    npc: BRAM,
    intro: ['Bram has taken over a supply wagon and, by the look of things, every pricing decision in the war. "War makes everything cost more. Except my goods, because I am a patriot. Also the captain reads my books." He turns a crate around to face you. "There are big things up that hill. Buy accordingly."'] },
  'scouts-fire': {
    id: 'scouts-fire', kind: 'dialogue', npc: WREN, art: { emoji: '🏹' },
    lines: [
      '**Wren** runs the scouts\' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She made Chief of Scouts young. She wears the title like a coat that fits her but embarrasses her anyway.',
      '"Right. Listen." She jabs a finger at the map. "The **manticore** on the toll-cliff talks. Do not talk back. The **boar-runs** flood with a stampede twice a day, so either time it or fight through it. And there is a valley past the middle pass full of statues that are far too good. Count the sculptors and you will find none. Stay out, or go in with your blade already drawn."',
      'She looks up. "And the streams are walking uphill. I have no advice about that one. I only know where they walk."',
      'She pauses. "Third time we have done this. Horse, fen, mountain." She almost smiles. "Try to come down the hill on your own feet. It is traditional now."',
    ],
    next: [{ id: 'ok', label: 'Take her map-notes', to: 'warcamp',
      effects: [{ kind: 'setFlag', flag: 'wren-brief' }, { kind: 'xp', amount: 30 },
        { kind: 'journal', entry: { id: 'c-scoutnotes', kind: 'clue', title: 'Wren\'s Map-Notes',
          body: 'The manticore on the toll-cliff talks. Do not talk back. The boar-runs stampede twice a day. The valley of statues has no sculptors, because a gorgon made them. And the streams themselves are walking uphill.' } }] }],
  },
  'scouts-done': {
    id: 'scouts-done', kind: 'story', art: { emoji: '🏹' },
    text: ['The scouts\' fire crackles through another change of shift. Wren\'s riders come and go with the tidy urgency she has drilled into them, and her map grows more arrowheads by the hour. She flicks you a two-finger salute without looking up.'],
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
      'The path climbs in tight turns past empty shepherds\' huts with their roofs fallen in. The higher you go, the less the mountain hides.',
      'Burn marks streak the loose rock in three different sizes and three different colours. Red, white, and green mean three separate dragons came this way.',
      'A boulder sits beside the trail with a handprint pressed into it. The hand was wider than a door.',
      'Water has cut channels straight across the path. There is no stream up here. There should be no water at all.',
      'And under all of it, that steady pull. The stone is drawing every monster on this mountain toward one high place. Whatever you beat down here will not be waiting for you at the top.',
    ],
    next: [{ id: 'on', label: 'Pick your fights', to: 'hills',
      effects: [{ kind: 'setFlag', flag: 'hills-read' }] }],
  },
  'switchbacks-done': {
    id: 'switchbacks-done', kind: 'story', art: { emoji: '👣' },
    text: ['The switchbacks wind away below you, familiar now. No new burn marks have appeared. What you cleared has stayed cleared. The Calling still pulls at the edge of hearing, thinner than it was.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  'hills-night': {
    id: 'hills-night', kind: 'battle', encounterId: 'harpy-roost', mapId: 'open',
    intro: ['The singing starts an hour after you bank the fire. It is sweet, and wrong, and getting closer. Harpies come riding the night wind down from the crags. Their song tugs at your legs. Stand up. Walk to the edge. It is not far. You wake in time, mostly because the sentry threw a boot.'],
    onWin: { to: '@hub', text: ['The harpies flap away into the dark with their voices broken. Nobody sleeps after that. You bank the fire and count the watches until a grey, quiet dawn.'] },
  },
  tollcliff: {
    id: 'tollcliff', kind: 'story', art: { emoji: '🦁' },
    text: [
      'The trail narrows under an overhang, and the overhang is occupied. A **manticore** lies stretched along it like a lord at his dinner table. It has the body of a lion, the wings of a bat, and a tail covered in black spikes. Its face is human, which is somehow the worst part.',
      '"Toll," it says. Its voice is a purr dragged over gravel. "Everything that walks my cliff pays. The goblins paid in sheep. The hags paid in promises." Its grin widens by one tooth too many. "You look like the sort that pays in blood."',
    ],
    next: [
      { id: 'fight', label: 'Pay it in steel', to: 'tollcliff-fight' },
      { id: 'leave', label: 'Back down the trail and find another way', to: 'hills' },
    ],
  },
  'tollcliff-fight': {
    id: 'tollcliff-fight', kind: 'battle', encounterId: 'manticore-cliff', mapId: 'ruins',
    intro: ['"Steel, then," the manticore sighs, sounding genuinely put out. Its tail curves over its shoulder like a drawn bow. Two goblins scramble up from the rocks behind it with spears. They are probably the ones who paid in sheep, working off a debt.'],
    onWin: { to: 'hills', text: ['The manticore drops onto the trail with one last offended word. "Toll." Its goblins run downhill to find a better boss. The pile in the overhang holds ten years of payments, taken from frightened travellers.'],
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
      'You can wait half a day for the runs to clear. Or you can meet the stampede where the gully narrows and break the herd for good.',
    ],
    next: [
      { id: 'fight', label: 'Meet the stampede at the narrows', to: 'boarruns-fight' },
      { id: 'wait', label: 'Wait out the runs and slip across', to: 'hills' },
    ],
  },
  'boarruns-fight': {
    id: 'boarruns-fight', kind: 'battle', encounterId: 'boar-stampede', mapId: 'open',
    intro: ['The drumming turns into thunder. Two boars the size of hay-carts come down the narrows shoulder to shoulder. Their tusks are as long as plough blades and their eyes are mad with the Calling. Then you notice that the gully narrows behind you as well.'],
    onWin: { to: 'hills', text: ['The stampede breaks around its fallen leaders and scatters back down the slope. The herd will keep to the low country now. You have just saved the war-camp from a living battering ram.'],
      effects: [{ kind: 'setFlag', flag: 'boarruns-cleared' }, { kind: 'gold', amount: 40 }] },
  },
  'boarruns-done': {
    id: 'boarruns-done', kind: 'story', art: { emoji: '🐗' },
    text: ['The boar-runs lie quiet, and grass is already growing back over the churned earth. The herd stays down in the valleys now. They have learned what the narrows cost.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  greenden: {
    id: 'greenden', kind: 'battle', encounterId: 'green-dragon-den', mapId: 'marsh',
    intro: [
      'The thicket smells of cut grass gone bad, sharp and rotten at the same time. That smell means a **green wyrmling**. Its den is a tunnel dug through strangling briar, and the floor is a bed of picked bones. Everything in that pile mistook a young dragon for a safe one. Its kobolds are already shrieking the alarm.',
      'The wyrmling slides out of the briar like an eel out of a wall. It is small. Its grin is still a dragon\'s grin. This is one more monster for the Calling, unless you stop it here.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling drops in the middle of a hiss, its poison breath fading to a harmless stink, and its kobolds bolt into the briar. That is one monster fewer for the Calling. The den\'s small hoard rides out in your packs.'],
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
      'Here is Wren\'s walking stream. A mountain brook runs up the pass instead of down it, quickly and steadily, straight against gravity. Where it pools at the top, the pool has a shape. It has shoulders. It waits with a patience that water should not have.',
      'The Undercrypt\'s broken ward left thin places in the world, and something came through this one. The Calling holds it here like a cork in a bottle. The road to the middle pass runs right through its pool.',
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
      'The mesa smells like a storm about to break. A **blue wyrmling** has taken the ruined watchtower at its top, and its kobolds have been busy. They have tied copper rods to every standing wall and wired the whole nest like a thundercloud waiting to go off.',
      'The wyrmling uncoils along a broken wall, crackling with pride, and the air turns sharp and metallic. Someone has clearly told it that it will be enormous one day. Nobody has told it about you.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling falls off the wall trailing dead sparks, and the kobolds\' lightning farm shorts out into scrap. The hoard here was tribute, saved up for a dragon\'s future. It pays for your present instead.'],
      effects: [{ kind: 'setFlag', flag: 'blue-cleared' }, { kind: 'gold', amount: 95 }] },
  },
  'blueden-done': {
    id: 'blueden-done', kind: 'story', art: { emoji: '⚡' },
    text: ['The ruin on the mesa is quiet, and its copper rods are already turning green. The storms overhead are only weather now.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  onihold: {
    id: 'onihold', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: [
      'The middle pass is held. Not squatted in. Held properly, by someone who knows soldiering. A stone fort rebuilt in a week by hands that lift boulders like loaves of bread. Guard posts of sharpened pine. A horn on the wall that has already sounded once.',
      'The holder stands above the gate: an **ogre-mage**, blue-skinned, wearing scraps of old lacquered armour. It looks down at you, and that look is the worst thing you have met in these hills, because it is thinking.',
      '"The stone sings," it calls down, pleasantly. "We answered first, and whoever answers first holds the door. Pay a toll, swear a tithe, or try us, little debtors."',
    ],
    next: [{ id: 'fight', label: 'Try them', to: 'onihold-fight' }],
  },
  'onihold-fight': {
    id: 'onihold-fight', kind: 'battle', encounterId: 'oni', mapId: 'corridor',
    intro: ['The horn sounds twice, and the gate opens on the ogre-mage\'s guard: an ogre with a hammered-together maul and an orc veteran in stolen mail. Then the ogre-mage itself rises off the wall on a cold wind with its blade drawn. The air darkens around it like ink spreading through water.'],
    onWin: { to: 'hills', text: ['The ogre-mage falls out of its own darkness, astonished right to the end, and its warband breaks apart with it. The middle pass stands open, and beyond it lies the road to the giants\' hall and the stone. The fort\'s war-chest is yours, fair and square.'],
      effects: [{ kind: 'setFlag', flag: 'oni-cleared' }, { kind: 'gold', amount: 130 }] },
  },
  'onihold-done': {
    id: 'onihold-done', kind: 'story', art: { imageId: 'loc-keep', emoji: '🏯' },
    text: ['The fort at the middle pass stands empty, its horn silent on the wall. Wren\'s scouts have already been through. They have chalked a small, tidy arrowhead by the gate, pointing up.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  redden: {
    id: 'redden', kind: 'battle', encounterId: 'red-dragon-den', mapId: 'firepit',
    intro: [
      'You smell the den before you see it: woodsmoke with a hot, metal edge to it. It sits in a scorched bowl of hillside where a **red wyrmling** has built itself a forge-hall out of split rock and cinders. Kobolds tend heaps of half-melted treasure with the care of bank clerks.',
      'The wyrmling lies on the largest heap with one eye open. Red dragons are the proudest of a proud family, and the stone\'s song promised this one a war. It rises, burning with its own light, delighted that you have saved it the trip downhill.',
    ],
    onWin: { to: 'hills', text: ['The wyrmling\'s fire goes out from the inside, and it is finally, simply small. Its half-melted hoard cools into heavy lumps. They are the honest kind, and Bram will weigh them twice and pay well.'],
      effects: [{ kind: 'setFlag', flag: 'red-cleared' }, { kind: 'gold', amount: 120 }] },
  },
  'redden-done': {
    id: 'redden-done', kind: 'story', art: { emoji: '🔥' },
    text: ['The burning den has gone cold. Rain has already found the scorched bowl, and something green is growing up through the ash, thoroughly unimpressed by dragons.'],
    next: [{ id: 'ok', label: 'Onward', to: 'hills' }], noBack: true,
  },
  gorgonvale: {
    id: 'gorgonvale', kind: 'story', art: { emoji: '🗿' },
    text: [
      'This is Wren\'s valley, and the statues are exactly as good as she warned. A shepherd caught mid-stride with one arm flung up. A wolf turning to run. A hired sword with his blade half drawn and a look on his face you can read from thirty paces. No sculptor chose these subjects, and no sculptor ever worked this fast.',
      'At the head of the valley stands a bull made of black iron plates, grazing between its own victims. This is a **gorgon**. Its breath turns living things to stone, and steam curls from its nostrils in the cold air. The Calling drew it down from somewhere higher and worse.',
      'It has not noticed you yet. The statues suggest that never lasts long.',
    ],
    next: [
      { id: 'fight', label: 'Go in blade-first', to: 'gorgonvale-fight' },
      { id: 'leave', label: 'Take Wren\'s advice and stay out', to: 'hills' },
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
      'Above the tree-line stands the giants\' hall, built from whole pine trunks and stone blocks the size of doorways. Something put it up in a single season and treated the work as simple stacking. The **ettin** that holds it comes out at the first scrape of your boots. It is two heads arguing on top of one enormous body. An ogre and an orc runner scramble out behind it.',
      '"THE STONE PROMISED US THE VALLEY," booms the left head. "The stone promised ME the valley," the right head corrects. Then both heads notice you at the same moment, and for the first time all day they agree about something.',
    ],
    onWin: { to: 'hills', text: ['The ettin goes down still arguing about whose fault it was, and its followers do not stay to finish the argument. Inside the hall you find tribute, plunder, and an entire orchard\'s worth of pickled fruit, all of it bound for the war-camp below. The last strong voice on the mountain has stopped singing.'],
      effects: [{ kind: 'setFlag', flag: 'steading-cleared' }, { kind: 'gold', amount: 140 }] },
  },
  'steading-done': {
    id: 'steading-done', kind: 'story', art: { emoji: '🏚️' },
    text: ['The giants\' hall stands hollow, its doorway a bright rectangle of sky. Vex will want it for a forward post. Wren\'s scouts have already claimed the roof.'],
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
      'Wingbeats ride the wind. The rim of the bowl is where the wyrms gather, and what is left of the brood is massing up there to meet you. Every den you left standing sent its dragon here. Clear the rim, and only the stone and its keepers are left.',
    ],
    next: [{ id: 'on', label: 'Meet the clutch on the rim', to: 'clutch-fight',
      effects: [{ kind: 'setFlag', flag: 'calling-found' }] }],
    noBack: true,
  },
  // The den-raiding payoff: all three dens emptied, so the brood never masses.
  'calling-gate-clear': {
    id: 'calling-gate-clear', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: [
      'You reach the last ridge. The Calling is not a pull any more. It is a pressure, a note held so long that the mountain hums it back at you.',
      'Beyond the ridge, a bowl of bare rock opens under the sky. At its centre stands the **stone**: a single black fang, older than anyone can guess, wrapped in a light that hurts to look at.',
      'Nothing moves overhead. The rim is a gathering ground with nothing gathered on it. You emptied every den on the way up, so there is no brood left to send against you. You cross the ridge unopposed. That is what being thorough buys. Only the stone and its keepers are left.',
    ],
    next: [{ id: 'on', label: 'Down into the bowl', to: 'calling-approach',
      effects: [{ kind: 'setFlag', flag: 'calling-found' }, { kind: 'setFlag', flag: 'clutch-skipped' }] }],
    noBack: true,
  },
  'ridge-quiet': {
    id: 'ridge-quiet', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌄' },
    text: ['The ridge lies quiet, the broken brood scattered or dead. Below you, the bowl and the stone wait in their bruised light.'],
    next: [{ id: 'on', label: 'Down into the bowl', to: 'calling-approach' }], noBack: true,
  },
  'clutch-fight': {
    id: 'clutch-fight', kind: 'battle', encounterId: 'chromatic-clutch', mapId: 'open',
    intro: ['They come over the rim together, every wyrmling the Calling could still reach. Black and green and white, shrieking in three different keys of greed. The dens you emptied stay empty. The ones you did not are all here, and they have decided that your debt is theirs to collect.'],
    onWin: { to: 'calling-approach', text: ['The last wyrmling drops out of the bruised light and does not get up. The rim is yours, and the hollow below waits. The stone\'s note wavers, as if it has just counted how few voices are still answering it.'],
      effects: [{ kind: 'setFlag', flag: 'clutch-beaten' }] },
  },
  'calling-approach': {
    id: 'calling-approach', kind: 'story', art: { imageId: 'loc-cave', emoji: '🗿' },
    text: [
      'Down in the bowl, at the foot of the stone, the **sisters** are waiting. Two hags, tall as doorframes, their green fingers buried to the knuckle in the black rock.',
      'This close, you finally understand what the Calling is. They are not commanding the stone. They are pouring themselves into it. Their hair has turned to river-weed and wire. Their faces are burning down like candles. Two long lives spent to hold one door open.',
      'So here is the truth at the top of the mountain. The keepers of the Calling Stone are the **Reedwife\'s sisters**, and they woke it for revenge. You killed the Reedwife in her marsh. For that, they mean to drown the whole valley in monsters.',
      '"Sister-killers," they say together, without turning around. "You cut her down in her own fen. So we woke the stone, and we called the hills down on everyone you saved. That is what she was worth." The light around the stone thickens, and the ground beneath it begins, gently, to burn. "But you came so far. Stay. The last of the collection is arriving now. Out of the fire, and out of the ground."',
    ],
    next: [{ id: 'fight', label: 'Break the stone, and the sisters with it', to: 'calling-battle' }],
  },
  'calling-battle': {
    id: 'calling-battle', kind: 'battle', encounterId: 'elemental-cataclysm', mapId: 'firepit',
    loot: { bonusTier: 'rare' },
    intro: ['The sisters pour the last of themselves into the stone, and the stone spends it all at once. The floor of the bowl splits along a burning crack. A pillar of living fire climbs out of it. The mountain\'s own bones heave up into a shape with fists. The sisters crumble into drifts of dry reeds, smiling as they go. The Calling\'s last note is a disaster, and it has your name in it.'],
    onWin: { to: 'calling-won', text: ['The fire gutters out of the air. The stone shape shakes itself apart into loose rubble. The black fang has nothing left to spend and nobody left to spend it, so it cracks from top to bottom and falls silent. The Calling does not end with thunder. It ends with the huge, ringing quiet of a held note finally let go.'],
      effects: [{ kind: 'xpToLevel', level: 5 }, { kind: 'setFlag', flag: 'calling-broken' }, { kind: 'gold', amount: 200 }] },
  },
  'calling-won': {
    id: 'calling-won', kind: 'story', art: { imageId: 'loc-mountain', emoji: '🌅' },
    text: [
      'It is over. The **Calling Stone** lies cracked and silent, and the sisters spent themselves along with it. Where they stood, a scatter of dry reeds lifts on the wind. The revenge they climbed all this way to take burned away in the taking. Your company stands whole on a quiet mountain.',
      'Below you, pass by pass, the hills go still. The song that pulled monsters toward the valley has stopped, so the monsters stop with it. Whatever was walking toward the stone lies down where it stands, and the wingbeats fade off the wind. The valley is safe. Far down the slope, faint and disbelieving, the war-camp starts to cheer.',
    ],
    next: [{ id: 'down', label: 'Come down the mountain', to: 'wc-aftermath' }],
  },
  'wc-aftermath': {
    id: 'wc-aftermath', kind: 'story', art: { imageId: 'loc-camp', emoji: '🎉' },
    text: [
      'You come down the hill on your own feet, which is traditional now. You walk into a camp that has stopped being an army and started being the biggest festival the valley has ever thrown.',
      'Vex shakes your hand like a man signing off on accounts he never expected to balance. "Three for three," he says. "The Calling is broken. Tomorrow this camp packs up and everybody goes home. Do stop now, before your luck notices you."',
      'Wren says nothing at all. She just looks at the four of you, then up at the quiet hills, and grins her whole age for once. Then she remembers that she is Chief of Scouts, coughs, and asks for your route report.',
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
      'You wake in the hospital tent to canvas light and the smell of Bram\'s cooking, which nobody voted for. Wren\'s scouts carried you down again, in relays. It is a tradition everyone would happily retire.',
      'Vex looks in, notes that you are breathing, and sets your kit at the foot of the cot without a word. The hills are still up there. The stone is still calling. Nothing has changed. It is only waiting.',
    ],
    next: [{ id: 'up', label: 'Back on your feet', to: 'warcamp' }], noBack: true,
  },
  'wc-epilogue': {
    id: 'wc-epilogue', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
    text: [
      'The valley remembers it as the year of three wars: the raiders, the graves, and the hills. The same four names run through all three stories like a bright thread. You broke the Ashfang. You sealed the Undercrypt. You silenced the Calling, and the coven\'s long debt burned away to reeds on a mountain wind.',
      'Mira pours the first round on the house, and the second before anybody asks. With the third comes her observation that heroes drink no more carefully than anyone else. The reeve orders a plaque made. Wren corrects the geography on it.',
      'Vex has seen every side of this valley\'s troubles, and he finally picked the right one. He raises a quiet glass to the four of you, and drinks to **the Free Company**. Paid in full, and free at last.',
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
