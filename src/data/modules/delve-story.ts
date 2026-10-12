/**
 * Dev-only: a written story with a generated dungeon in the middle of it.
 *
 * The proof that the two meet (adventure/embed.ts): the story is written —
 * the reeve, his daughter, the ending that depends on her — and the cellar
 * under the manor is generated, a different place for every run, held by
 * kobolds, with the story's own people placed in it. Mara is a set piece
 * bound to a story name; freeing her is exported back as a story flag, and
 * the ending reads it.
 */
import type { Module } from '../../adventure/types.js';

export const DELVE_STORY_MODULE: Module = {
  id: 'delve-story-hollowmere',
  title: 'Beneath Hollowmere',
  blurb: 'A written errand into a dungeon that is different every time.',
  start: 'start',
  levelBand: { from: 2, to: 3 },
  cast: [{ name: 'Mara', introducedAt: ['start'] }],
  scenes: {
    start: {
      id: 'start', kind: 'story', art: { emoji: '🏚️' },
      text: [
        'The reeve of Hollowmere meets you at the gate with his hat in his hands.',
        '"My daughter Mara went into the old manor cellars after the kobolds took our lambs. Three days ago. Please."',
      ],
      next: [
        { id: 'ask', label: 'Ask around the village first', to: 'tavern',
          effects: [{ kind: 'xpToLevel', level: 2 }, { kind: 'journal', entry: { id: 'find-mara', kind: 'quest', title: 'Find Mara', body: 'The reeve\'s daughter went into the cellars under the old manor and has not come back.' } }] },
        { id: 'go', label: 'Go straight to the manor', to: 'cellar',
          effects: [{ kind: 'xpToLevel', level: 2 }, { kind: 'journal', entry: { id: 'find-mara', kind: 'quest', title: 'Find Mara', body: 'The reeve\'s daughter went into the cellars under the old manor and has not come back.' } }] },
      ],
    },
    tavern: {
      id: 'tavern', kind: 'story', art: { emoji: '🍺' }, noBack: true,
      text: ['The innkeeper lowers her voice. "The little ones answer to something bigger, down deep. Mara will be wherever they keep what they mean to keep."'],
      next: [{ id: 'go', label: 'To the manor', to: 'cellar', effects: [{ kind: 'setFlag', flag: 'heard-of-mara' }] }],
    },
    epilogue: {
      id: 'epilogue', kind: 'story', art: { emoji: '🌄' }, noBack: true,
      text: ['You come up into daylight, and the village is waiting.'],
      next: [
        { id: 'with', label: 'Bring Mara home', to: 'home-with-mara', requires: [{ kind: 'flag', flag: 'mara-freed' }], hideWhenBlocked: true },
        { id: 'alone', label: 'Tell the reeve', to: 'home-alone', requires: [{ kind: 'notFlag', flag: 'mara-freed' }], hideWhenBlocked: true },
      ],
    },
    'home-with-mara': { id: 'home-with-mara', kind: 'ending', outcome: 'victory',
      text: ['The reeve runs the last of the way. Hollowmere eats well that night, and Mara tells the story better than you would.'] },
    'home-alone': { id: 'home-alone', kind: 'ending', outcome: 'victory',
      text: ['The cellars are quiet now. The reeve thanks you, and does not ask what you found, and you do not tell him.'] },
    abandoned: { id: 'abandoned', kind: 'ending', outcome: 'defeat',
      text: ['You leave Hollowmere with its cellars and its grief.'] },
  },
  delves: {
    cellar: {
      spec: {
        theme: 'stone', level: 2, floors: 2, fights: 'inhabitants', factions: ['kobolds'],
        pieces: [
          { piece: 'warden', bind: { title: 'the kobold jailer' } },
          { piece: 'prisoner', floor: 2, where: 'afterLock', bind: { name: 'Mara' } },
          { piece: 'lair' },
          // Only for a company that freed the Hollow Road's captives: word got
          // around, and somebody left them a place to rest.
          { piece: 'shrine', floor: 2, when: ['hollow-road:captives-freed'] },
        ],
      },
      onWin: { to: 'epilogue' },
      onLeave: { to: 'abandoned' },
      reads: ['heard-of-mara', 'hollow-road:captives-freed'],
      exports: { 'f2-p1-freed': 'mara-freed' },
    },
  },
};
