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

  it('reads an obstacle as its approach, its fight, and a scene for each answer', () => {
    const s = parseStory([
      '# barrow', 'kind: obstacle', 'art: 🪦', 'fight: barrow-haunt on corridor', 'done: barrow-cleared', 'leave: Walk on  #leave',
      'A cold mound.', 'again:', 'Still cold.',
      'answer religion 13 > Say the words  #settle', 'It settles.',
      'fight > Go down  #in', 'They rise.', 'won:', 'They fall.', 'do gold 45',
    ].join('\n'), 'obstacle') as Record<string, any>;
    expect(Object.keys(s)).toEqual(['barrow', 'barrow-fight', 'barrow-settle']);
    expect(s.barrow.next.map((c: { id: string }) => c.id)).toEqual(['settle', 'in', 'leave']);
    expect(s.barrow.next[0]).toMatchObject({ to: 'barrow-settle', once: true, hideWhenBlocked: true, check: { skill: 'religion', dc: 13, failTo: 'barrow-fight' } });
    expect(s['barrow-fight']).toMatchObject({ kind: 'battle', encounterId: 'barrow-haunt', mapId: 'corridor', intro: ['They rise.'],
      onWin: { to: '@hub', text: ['They fall.'], effects: [{ kind: 'setFlag', flag: 'barrow-cleared' }, { kind: 'gold', amount: 45 }] } });
    expect(s['barrow-settle'].next[0].effects[0]).toEqual({ kind: 'setFlag', flag: 'barrow-cleared' });
    expect(s['barrow-settle'].next[0].effects[1]).toEqual({ kind: 'xp', amount: { $avoided: 'barrow-haunt' } });
  });

  it('reads a rescue as its approach, its outcomes and its later visits', () => {
    const s = parseStory([
      '# hurt', 'kind: rescue', 'art: 🤕', 'who: wren', 'walked: walked-past', 'Someone is hurt.',
      'heal item potion-healing > Give a potion  #potion', 'heal religion 9 cleric > Pray  #pray', 'heal medicine 12 > Bind it  #medicine',
      'leave > Walk on  #leave', 'You walk on.',
      'saved:', 'She lives.', 'send > Send her home  #ok', 'join > Take her along  #come', '? not inside',
      'joins:', 'She comes.', 'failed:', 'She lives, slowly.', 'dead:', 'She died.', 'do npc wren fate lost',
    ].join('\n'), 'rescue') as Record<string, any>;
    expect(Object.keys(s).sort()).toEqual(['hurt', 'hurt-dead', 'hurt-failed', 'hurt-joins', 'hurt-left', 'hurt-saved']);
    expect(s.hurt.next.find((c: { id: string }) => c.id === 'pray')).toMatchObject({ requires: [{ kind: 'classInParty', classId: 'cleric' }], check: { failTo: 'hurt-failed' } });
    expect(s.hurt.next.find((c: { id: string }) => c.id === 'leave').effects).toContainEqual({ kind: 'setFlag', flag: 'walked-past' });
    expect(s['hurt-saved'].next.find((c: { id: string }) => c.id === 'come')).toMatchObject({ to: 'hurt-joins', requires: [{ kind: 'notFlag', flag: 'inside' }] });
    expect(s['hurt-failed'].next[0].effects).toContainEqual({ kind: 'passDay' });
  });

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

  it('reads a dungeon alarm, raised and asked after', () => {
    const s = parseStory('# a\n? alarm inner/delve >= 2 | Roused.\n> Go → b  #go\n  ? alarm inner/delve < 2\n  do alarm inner/delve +2; alarm inner/delve -1');
    expect(s.a).toEqual({ id: 'a', kind: 'story',
      text: [{ if: [{ kind: 'alarm', dungeon: 'inner/delve', atLeast: 2 }], text: 'Roused.' }],
      next: [{ id: 'go', label: 'Go', to: 'b', requires: [{ kind: 'alarm', dungeon: 'inner/delve', below: 2 }],
        effects: [{ kind: 'alarm', dungeon: 'inner/delve', amount: 2 }, { kind: 'alarm', dungeon: 'inner/delve', amount: -1 }] }] });
  });

  it('says where it could not read', () => {
    expect(() => parseStory('# a\n> no arrow here', 'x.story')).toThrow(/x\.story:2/);
  });
});
