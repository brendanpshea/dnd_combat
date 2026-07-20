/**
 * A compact exploration demo — "The Bandit Hideout" — exercising every M2
 * mechanic: a node map with fog, a locked door (flag-gated), a secret vault
 * (passive Perception), a wandering encounter, an NPC parley, a skill check,
 * a shop, and a boss fight with a flag-payoff epilogue. It is not the finished
 * campaign module (that's M4) — it's the playable proof the pieces fit.
 */
import type { Module } from '../../adventure/types.js';

export const HIDEOUT_MODULE: Module = {
  id: 'hideout', title: 'The Bandit Hideout',
  blurb: 'Root out the bandits plaguing the road — by blade or by wit.',
  start: 'road',
  scenes: {
    road: {
      id: 'road', kind: 'story', art: { emoji: '🛤️' },
      text: [
        'The road cuts through pine woods gone quiet. Ahead, a game trail forks toward a hollow — the bandits\' den, if the rumors hold.',
        'Your quartermaster checks the packs one last time.',
      ],
      next: [
        { id: 'shop', label: 'Check the supply cache first', to: 'cache' },
        { id: 'go', label: 'Press on to the hollow', to: 'hollow',
          effects: [{ kind: 'journal', entry: { id: 'q1', kind: 'quest', title: 'Clear the Hideout', body: 'Bandits have made a den in the wooded hollow. Deal with them.' } }] },
      ],
    },

    cache: {
      id: 'cache', kind: 'shop', title: 'Supply Cache', next: 'hollow',
      intro: ['A hidden caravan cache — someone left goods and a tally-slate for coin.'],
    },

    hollow: {
      id: 'hollow', kind: 'explore',
      map: {
        title: 'The Wooded Hollow', theme: 'forest', art: { emoji: '🌲' },
        nodes: [
          { id: 'lookout', x: 22, y: 30, label: 'Lookout', icon: '👁️', scene: 'lookout-npc' },
          { id: 'trail', x: 50, y: 55, label: 'Bramble Trail', icon: '🌿', scene: 'trail-arrive',
            wandering: { chance: 0.6, battleScene: 'trail-fight' } },
          { id: 'door', x: 74, y: 32, label: 'Barred Door', icon: '🚪', scene: 'den',
            requires: [{ kind: 'flag', flag: 'password' }] },
          { id: 'cache2', x: 40, y: 80, label: 'Hollow Log', icon: '📦', scene: 'log-cache',
            hidden: { dc: 12 } },
        ],
      },
    },

    'lookout-npc': {
      id: 'lookout-npc', kind: 'dialogue', npc: { id: 'bandit', name: 'A Nervous Lookout', emoji: '🥸' },
      art: { emoji: '🥸' },
      lines: ['"Halt! Nobody gets to the den without the password, see?"'],
      next: [
        { id: 'intimidate', label: '[Intimidation DC 12] Loom over him', to: 'lookout-yield',
          check: { skill: 'intimidation', dc: 12, failTo: 'lookout-fight' } },
        { id: 'persuade', label: '[Deception DC 13] "The boss sent us."', to: 'lookout-yield',
          check: { skill: 'deception', dc: 13, failTo: 'lookout-fight' } },
        { id: 'back', label: 'Back away to the hollow', to: 'hollow' },
      ],
    },
    'lookout-yield': {
      id: 'lookout-yield', kind: 'story', art: { emoji: '🗝️' },
      text: ['He swallows. "It\'s… \'red willow.\' Just don\'t tell the boss I told you."'],
      next: [{ id: 'ok', label: 'Return to the hollow', to: 'hollow',
        effects: [
          { kind: 'setFlag', flag: 'password' },
          { kind: 'journal', entry: { id: 'c1', kind: 'clue', title: 'The Password', body: 'The barred door opens to "red willow".' } },
        ] }],
    },
    'lookout-fight': {
      id: 'lookout-fight', kind: 'battle', encounterId: 'kobolds', mapId: 'ruins',
      intro: ['The lookout shrieks and his friends boil out of the brush!'],
      onWin: { to: 'hollow', text: ['The ambush is broken. The way is open.'],
        effects: [{ kind: 'setFlag', flag: 'password' }] },
    },

    'trail-arrive': {
      id: 'trail-arrive', kind: 'story', art: { emoji: '🌿' },
      text: ['The bramble trail loops back to the hollow, scratched but wiser.'],
      next: [{ id: 'back', label: 'Return', to: 'hollow' }],
    },
    'trail-fight': {
      id: 'trail-fight', kind: 'battle', encounterId: 'wolves', mapId: 'marsh',
      intro: ['Wolves kept as guards lunge from the brambles!'],
      onWin: { to: 'trail-arrive', text: ['The pack is driven off.'], effects: [{ kind: 'xp', amount: 40 }] },
    },

    'log-cache': {
      id: 'log-cache', kind: 'story', art: { emoji: '📦' },
      text: ['Inside the hollow log: a stash the bandits hid from their own boss.'],
      next: [{ id: 'take', label: 'Pocket the loot', to: 'hollow',
        effects: [
          { kind: 'gold', amount: 60 },
          { kind: 'addItem', itemId: 'potion-healing', qty: 2 },
          { kind: 'setFlag', flag: 'found-stash' },
        ] }],
    },

    den: {
      id: 'den', kind: 'story', art: { emoji: '🏚️' },
      text: ['Past the barred door, the bandit chief waits — and knows you\'re coming.'],
      next: [{ id: 'fight', label: 'Confront the chief', to: 'boss' }],
    },
    boss: {
      id: 'boss', kind: 'battle', encounterId: 'bandits', mapId: 'open',
      intro: ['"You cost me good coin," the chief snarls. Steel rings.'],
      onWin: { to: 'win', text: ['The chief falls. The hideout is yours.'] },
    },

    win: {
      id: 'win', kind: 'ending', outcome: 'victory', art: { emoji: '🏆' },
      text: [
        'The road is safe again, and the bandits\' hoard rides in your packs.',
        'The nervous lookout, if he lived, is likely still running.',
      ],
    },
  },
};
