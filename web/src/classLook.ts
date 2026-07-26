/**
 * How a class looks: one glyph and one colour, in one place.
 *
 * Portraits track *species*, which was the right call for the forge — but it
 * left the board unable to answer "which of these four is the wizard". A
 * dwarf cleric and a dwarf fighter are the same picture. The class had to be
 * carried by something other than the art.
 *
 * Two signals rather than one, because they fail in different places. Colour
 * survives being small — at token size on a phone it is the only thing that
 * still reads — but six hues are more than anyone memorises. The glyph is
 * unambiguous and needs no learning, but turns to mush below about 14px. Shown
 * together they cover each other.
 *
 * `classId` on a monster is its monster id, so everything here is keyed on the
 * real class table and callers get `undefined` for anything else. Nothing
 * needs to know the difference between "a monster" and "a class we forgot".
 */
import { CLASSES } from '../../src/data/classes.js';

export interface ClassLook {
  glyph: string;
  /** Accent for pips, rings and rails. Picked for separation at small size on
   *  the dark board, not for theme accuracy. */
  color: string;
  name: string;
}

const LOOK: Record<string, Omit<ClassLook, 'name'>> = {
  // Glyphs are chosen for silhouette, not for meaning: at pip size an emoji
  // is about 11px and only its outline survives. The board's old fallback
  // emoji for the wizard was 🧙, a whole figure, which at this size is a
  // coloured smudge — 🔮 keeps a shape. The others are already single objects.
  fighter: { glyph: '⚔️', color: '#e0685e' },
  cleric: { glyph: '✨', color: '#e8c46a' },
  wizard: { glyph: '🔮', color: '#6aa2e8' },
  rogue: { glyph: '🗡️', color: '#b07fe0' },
  ranger: { glyph: '🏹', color: '#63b478' },
  paladin: { glyph: '🛡️', color: '#cfd8e8' },
  bard: { glyph: '🎵', color: '#d98cc0' },
};

export function classLook(classId: string | undefined): ClassLook | undefined {
  if (!classId) return undefined;
  const look = LOOK[classId];
  const cls = CLASSES[classId];
  if (!look || !cls) return undefined;
  return { ...look, name: cls.name };
}
