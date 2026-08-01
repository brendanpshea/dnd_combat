/**
 * Every class has a look, and the board says which class you are.
 *
 * THE BUG THIS EXISTS FOR
 *
 * `LOOK` in `classLook.ts` is a hand-kept table of a glyph and a colour per
 * class. It had ten entries; the game has twelve classes. Warlock and sorcerer
 * were simply absent, and the failure was silent in the worst way:
 * `classLook` returns `undefined` for anything it does not recognise — which is
 * correct for a monster — so a warlock got no glyph, no accent colour, and,
 * because the status line renders the class tag only when there is a look, no
 * CLASS NAME either. The battle HUD just said "You". Reported exactly that way.
 *
 * A table that has to be extended by hand every time a class is added will fall
 * behind again. This is the thing that notices.
 */
import { describe, it, expect } from 'vitest';
import { CLASSES } from '../src/data/classes.js';
import { classLook, sheetSubtitle } from '../web/src/classLook.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ids = Object.keys(CLASSES);

describe('every playable class has a look', () => {
  it('covers the class table with nothing left over', () => {
    const missing = ids.filter((id) => !classLook(id));
    expect(missing, `these classes render with no glyph, no colour and no name: ${missing.join(', ')}`)
      .toEqual([]);
  });

  it.each(ids)('%s has a glyph, a colour and the class name', (id) => {
    const look = classLook(id)!;
    expect(look.glyph.length, `${id} has an empty glyph`).toBeGreaterThan(0);
    expect(look.color, `${id}'s colour is not a hex value`).toMatch(/^#[0-9a-f]{6}$/i);
    // The name comes from the class table rather than being restated here, so
    // it cannot disagree with what the rest of the game calls the class.
    expect(look.name).toBe(CLASSES[id]!.name);
  });

  it('gives every class a distinguishable glyph', () => {
    // Two classes sharing a glyph makes the pip useless for telling them apart,
    // which is the entire reason the glyph exists.
    const glyphs = ids.map((id) => classLook(id)!.glyph);
    expect(new Set(glyphs).size, 'two classes share a glyph').toBe(glyphs.length);
  });

  it('gives every class a distinct colour', () => {
    const colors = ids.map((id) => classLook(id)!.color.toLowerCase());
    expect(new Set(colors).size, 'two classes share an accent colour').toBe(colors.length);
  });

  it('still returns undefined for a monster, which has no class', () => {
    // `classId` on a monster is its monster id. Callers rely on undefined to
    // mean "not a class", so this must not become a fallback that invents one.
    expect(classLook('goblin-warrior')).toBeUndefined();
    expect(classLook(undefined)).toBeUndefined();
  });
});

/**
 * And the two places that show a character say which class it is.
 *
 * The battle sheet said only "Your hero" / "Enemy" — the side, which the player
 * already knows because they tapped their own token — while the party screen's
 * sheet had shown "Wizard · Level 3" all along. Portraits follow species, so a
 * dwarf cleric and a dwarf fighter are the same picture.
 */
describe('the character sheet names the class', () => {
  const app = readFileSync(fileURLToPath(new URL('../web/src/App.tsx', import.meta.url)), 'utf8');

  it('gives a hero its class and level, not just which side it is on', () => {
    expect(sheetSubtitle({ classId: 'warlock', level: 3 }, 'Your hero'))
      .toBe('Warlock · Level 3 · Your hero');
    expect(sheetSubtitle({ classId: 'wizard', level: 7 }, 'Enemy'))
      .toBe('Wizard · Level 7 · Enemy');
  });

  it('still says which side, so an enemy sheet is not mistaken for a hero', () => {
    for (const side of ['Your hero', 'Enemy', 'Blue team', 'Red team']) {
      expect(sheetSubtitle({ classId: 'fighter', level: 1 }, side)).toContain(side);
    }
  });

  it('leaves a monster with the side alone — it has no class or level to show', () => {
    expect(sheetSubtitle({ classId: 'goblin-warrior', level: 2 }, 'Enemy')).toBe('Enemy');
    expect(sheetSubtitle({ level: 2 }, 'Enemy')).toBe('Enemy');
  });

  it('is what the battle sheet actually uses', () => {
    // The battle sheet built this inline and got it wrong for a long time.
    expect(app, 'the battle sheet is composing its own subtitle again')
      .toMatch(/subtitle=\{sheetSubtitle\(sheetFor/);
  });

  it('names the class in the battle status line', () => {
    // The status line renders the class tag only when there is a look, which is
    // how a missing LOOK entry turned into a HUD that just said "You".
    expect(app).toContain('class-tag');
    expect(app).toContain('activeLook');
  });
});
