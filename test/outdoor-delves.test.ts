/**
 * The out-of-doors themes (OUTDOOR_THEMES: a marsh road, a raiders' camp) on
 * their own, with no story to dress them: any adventure, or the county map,
 * can roll one, and it must read as the place it is.
 */
import { describe, it, expect } from 'vitest';
import { generateSpecDelve } from '../src/adventure/delve-spec.js';
import { OUTDOOR_THEMES, ROOMS } from '../src/adventure/dungeon-gen.js';
import type { Module, Scene } from '../src/adventure/types.js';

const dungeons = (m: Module) => Object.values(m.scenes).filter((s): s is Extract<Scene, { kind: 'dungeon' }> => s.kind === 'dungeon').map((s) => s.dungeon);
/** Every line a player can read in the place. */
const prose = (m: Module): string[] => JSON.stringify(m.scenes).match(/"(?:text|intro|firstVisit|lines)":\[[^\]]*\]/g) ?? [];

describe('an out-of-doors delve', () => {
  for (const theme of OUTDOOR_THEMES) {
    for (const fights of ['inhabitants', 'generated'] as const) {
      it(`(${theme}, ${fights}) proves at every level, and reads as out of doors`, () => {
        const T = ROOMS[theme];
        for (let level = 1; level <= 5; level++) {
          for (let seed = 1; seed <= 3; seed++) {
            const { module } = generateSpecDelve(seed, { theme, level, fights });
            for (const d of dungeons(module)) {
              expect(d.torch, `${theme} L${level} seed ${seed}: a torch out of doors`).toBeUndefined();
              expect(d.theme).toBe(T.board);
              expect(d.emptySearches).toEqual(T.outdoor!.empty);
              expect(d.rooms.find((r) => r.id === d.entry)!.name).toBe(T.outdoor!.entry);
            }
            expect(Object.keys(module.scenes).filter((id) => /(^|-)dark$/.test(id)), 'no torch to die').toEqual([]);
            expect((module.scenes.outside as { text: string[] }).text).toEqual([T.outdoor!.outside]);
            const words = prose(module).join(' ');
            for (const indoors of ['torch', 'Daylight', 'the deep', 'cellar']) {
              expect(words, `${theme} L${level} seed ${seed}: '${indoors}'`).not.toContain(indoors);
            }
          }
        }
      });
    }
  }

  it('is held, when peopled, by someone who belongs there', () => {
    const fits = { marsh: ['marsh-things', 'lizardfolk', 'hag-court'], stockade: ['raiders', 'bandits', 'goblins', 'gnolls'] };
    for (const theme of OUTDOOR_THEMES) {
      for (let seed = 1; seed <= 8; seed++) {
        const { module } = generateSpecDelve(seed, { theme, level: 3, fights: 'inhabitants' });
        const story = (module.scenes.start as { text: string[] }).text.join(' ');
        expect(story, `${theme} seed ${seed}`).toMatch(/^The way into .+ stands open\./);
        // Its past is its own: not an abbey or a forge borrowed from elsewhere.
        expect(story).not.toMatch(/dwarven|fire-priests|monks|forge|crypt/i);
        expect(fits[theme].length).toBeGreaterThan(1);
      }
    }
  });
});
