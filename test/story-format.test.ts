/**
 * The `.story` format (story-format.ts): every module printed and read back
 * is the module it was.
 */
import { describe, it, expect } from 'vitest';
import { parseStory, printStory, resolve, type StoryEnv } from '../src/adventure/story-format.js';
import { HIDEOUT_MODULE } from '../src/data/modules/demo.js';
import { CLASSIC_MODULE } from '../src/data/modules/classic.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { storyChapters, buildStories, MODULES_DIR } from '../scripts/stories.js';

const bare: StoryEnv = {
  part: (n) => { throw new Error(`no part ${n}`); }, call: (n) => { throw new Error(`no part ${n}`); },
  fact: (n) => { throw new Error(`no fact ${n}`); }, avoided: (n) => { throw new Error(`no fight ${n}`); },
};

describe('the story format', () => {
  for (const m of [HIDEOUT_MODULE, CLASSIC_MODULE]) {
    it(`reads back ${m.id} exactly as printed`, () => {
      const text = printStory(m.scenes);
      expect(resolve(parseStory(text, m.id), bare)).toEqual(m.scenes);
    });
  }

  it('reads the shorthands', () => {
    const s = parseStory([
      '# board',
      'art: loc-village 📜',
      'Here is the bounty.',
      '? not spy-seen; with wren | Wren reads it over your shoulder.',
      'again:',
      'Still there.',
      '> Take the retainer → @hub  #ok',
      '  once hide',
      '  ? gold 5; class ranger',
      '  do +bounty; -old; gold -5; xp 20; item potion-healing x2; day; npc wren met fate saved',
      '  check insight 12 → board-fail',
      '  fail do +read',
      '',
      '# fight',
      'kind: battle',
      'encounterId: wolves',
      'The wolves come.',
      'won → board',
      '  do gold 10',
      '  They flee.',
    ].join('\n'));
    expect(s.board).toEqual({
      id: 'board', kind: 'story', art: { imageId: 'loc-village', emoji: '📜' },
      text: ['Here is the bounty.', { if: [{ kind: 'notFlag', flag: 'spy-seen' }, { kind: 'companion', companion: 'wren' }], text: 'Wren reads it over your shoulder.' }],
      again: ['Still there.'],
      next: [{ id: 'ok', label: 'Take the retainer', to: '@hub', once: true, hideWhenBlocked: true,
        requires: [{ kind: 'gold', atLeast: 5 }, { kind: 'classInParty', classId: 'ranger' }],
        effects: [{ kind: 'setFlag', flag: 'bounty' }, { kind: 'clearFlag', flag: 'old' }, { kind: 'gold', amount: -5 }, { kind: 'xp', amount: 20 },
          { kind: 'addItem', itemId: 'potion-healing', qty: 2 }, { kind: 'passDay' }, { kind: 'npc', npc: 'wren', met: true, fate: 'saved' }],
        check: { skill: 'insight', dc: 12, failTo: 'board-fail', failEffects: [{ kind: 'setFlag', flag: 'read' }] } }],
    });
    expect(s.fight).toEqual({ id: 'fight', kind: 'battle', encounterId: 'wolves', intro: ['The wolves come.'],
      onWin: { to: 'board', effects: [{ kind: 'gold', amount: 10 }], text: ['They flee.'] } });
  });

  it('has every chapter written as stories built (run `npm run stories`)', () => {
    expect(storyChapters()).toContain('hollow-road');
    for (const ch of storyChapters()) {
      expect(readFileSync(join(MODULES_DIR, ch, 'scenes.gen.ts'), 'utf8'), `${ch}/scenes.gen.ts`).toBe(buildStories(ch));
    }
  });

  it('says where it could not read', () => {
    expect(() => parseStory('# a\n> no arrow here', 'x.story')).toThrow(/x\.story:2/);
  });
});
