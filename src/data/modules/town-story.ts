/**
 * Dev-only: a written story around a generated town, with a generated dungeon
 * under it.
 *
 * The proof that towns compose (adventure/embed.ts): the arrival and the
 * ending are written; the port is generated, a different town every run, with
 * the story's people placed in it; a sewer grate in its market leads down
 * into a generated delve; clearing the delve sets a story flag that closes the
 * harbourmaster's lead, brings the priest out to thank you, and changes how
 * the story ends.
 */
import type { Module } from '../../adventure/types.js';

export const TOWN_STORY_MODULE: Module = {
  id: 'delve-story-saltholm',
  title: 'The Drowned Tunnels',
  blurb: 'A written errand through a town, and under it, that are different every time.',
  start: 'start',
  levelBand: { from: 3, to: 3 },
  cast: [
    { name: 'Wrenna', introducedAt: ['port/person-harbourmaster-wrenna'] },
    { name: 'Aldo', introducedAt: ['port/temple'] },
  ],
  scenes: {
    start: {
      id: 'start', kind: 'story', art: { emoji: '🛶' },
      text: ['The carter drops you at the edge of a port town and does not wait to be paid twice. "Ask for the harbourmaster," he says, already turning the cart. "She has work. Everyone here has work they would rather not do."'],
      next: [{ id: 'go', label: 'Walk into town', to: 'port', effects: [{ kind: 'xpToLevel', level: 3 }] }],
    },
    home: {
      id: 'home', kind: 'story', art: { emoji: '🌅' }, noBack: true,
      text: ['The road out runs along the shore, and the town gets small behind you.'],
      next: [
        { id: 'hero', label: 'Look back once', to: 'home-hero', requires: [{ kind: 'flag', flag: 'tunnels-cleared' }], hideWhenBlocked: true },
        { id: 'quiet', label: 'Keep walking', to: 'home-quiet', requires: [{ kind: 'notFlag', flag: 'tunnels-cleared' }], hideWhenBlocked: true },
      ],
    },
    'home-hero': { id: 'home-hero', kind: 'ending', outcome: 'victory',
      text: ['Someone has rung the harbour bell for you. You can still hear it at the second milestone.'] },
    'home-quiet': { id: 'home-quiet', kind: 'ending', outcome: 'victory',
      text: ['The tunnels under the town are still dark, and still full. That is someone else\'s work now.'] },
  },
  towns: {
    port: {
      spec: {
        size: 'town', level: 3,
        people: [
          { name: 'Harbourmaster Wrenna', title: 'The Harbourmaster', emoji: '⚓', at: 'gatehouse',
            lines: ['"Wrenna. Harbourmaster." She does not offer a hand. "The old drains under the market have filled up with something that used to be people. Shut them up for good, and the town will owe you."'],
            lead: { title: 'The Drowned Tunnels', text: 'Wrenna wants the dead in the drains under the market put down. The way in is a grate in the market.', flag: 'tunnels-cleared' } },
          { name: 'Brother Aldo', emoji: '🕯️', at: 'temple', when: ['tunnels-cleared'],
            lines: ['"Brother Aldo. You went down." He takes your hands in both of his. "We will say their names again, now. Thank you."'] },
        ],
        places: [
          { label: 'Sewer Grate', district: 'market', icon: 'tok-cave',
            text: ['An iron grate in the cobbles, and under it, the sound of water, and something moving in the water.'],
            way: { to: 'tunnels', label: 'Climb down into the tunnels' } },
        ],
        rumours: [{ text: 'They say the drains under the market go further down than anyone dug them.' }],
      },
      onLeave: { to: 'home' },
      reads: ['tunnels-cleared'],
    },
  },
  delves: {
    tunnels: {
      spec: { theme: 'bog', level: 3, fights: 'inhabitants', factions: ['restless-dead'], pieces: [{ piece: 'lair' }] },
      // Straight back onto the town's map, not through its gate again.
      onWin: { to: 'port/city', effects: [{ kind: 'setFlag', flag: 'tunnels-cleared' }] },
      onLeave: { to: 'port/city' },
    },
  },
};
