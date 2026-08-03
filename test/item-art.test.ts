/**
 * Gear icons: the framing that makes them legible, and the aliasing that makes
 * 34 pictures enough.
 *
 * WHY THESE EXIST
 *
 * `itemIcon()` returns a CATEGORY glyph — every melee weapon ⚔️, every armour
 * 🥋 — so a shop was a column of identical emoji beside a column of names. The
 * drawn icons fix that, but only if two things hold, and both are the kind that
 * fail silently:
 *
 *   1. FRAMING. The icons are drawn inside a 512 canvas and a rapier used 4% of
 *      it. Unframed they still render — just far too small to tell apart — so
 *      nothing errors and nothing looks broken, it merely stops being useful.
 *
 *   2. ALIASING. 34 icons against 191 ownable things looks hopeless until the
 *      variants collapse: 60 scrolls are one scroll, 50 `+1`/silvered/vicious
 *      weapons are the weapon. Get the mapping wrong and coverage silently
 *      drops to 31 items, which reads as broken rather than as sparse.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemArtId } from '../web/src/itemArt.js';
import { HAS_ITEM_ART } from '../web/src/art-registry.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ARMOR } from '../src/data/armor.js';
import { ITEMS } from '../src/data/items.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'art/svg-items');
const PUB = join(ROOT, 'web/public/art/items');

const names = readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
const text = (dir: string, n: string) => readFileSync(join(dir, `${n}.svg`), 'utf8');

/** Everything a player can own — the honest denominator. */
const ownable = [
  ...Object.values(WEAPONS), ...Object.values(ARMOR), ...Object.values(ITEMS),
].filter((x) => (x as { cost?: number }).cost !== undefined).map((x) => x.id);

describe('the icons are framed', () => {
  it('found icons to check', () => {
    expect(names.length, 'no item SVGs at all — this suite tests nothing').toBeGreaterThan(20);
  });

  it.each(names)('%s is cropped to its drawing, not the whole canvas', (n) => {
    // The default canvas is `0 0 512 512`. Anything still on it has not been
    // through `npm run svg-frame`, and will render at a fraction of its slot.
    const vb = text(SRC, n).match(/viewBox="([^"]+)"/);
    expect(vb, `${n} has no viewBox`).toBeTruthy();
    expect(vb![1]!.trim(), `${n} is still on the full 512 canvas; run npm run svg-frame`)
      .not.toBe('0 0 512 512');
  });

  it('crops to a square, so nothing is drawn out of proportion', () => {
    // A tight non-square box stretched into a square slot would make a rapier
    // the one item in the game that is not to scale.
    for (const n of names) {
      const [, , w, h] = text(SRC, n).match(/viewBox="([^"]+)"/)![1]!.trim().split(/\s+/).map(Number);
      expect(w, `${n} is cropped to a non-square box`).toBeCloseTo(h!, 1);
    }
  });

  it('leaves every icon visible inside its box', () => {
    // A crop that lost the drawing would also pass "not 0 0 512 512". The upper
    // bound is deliberately loose: the longbow really does span the canvas, and
    // with padding its box is legitimately a little over 512. Degenerate is
    // what is being ruled out here, not "large".
    for (const n of names) {
      const [, , w] = text(SRC, n).match(/viewBox="([^"]+)"/)![1]!.trim().split(/\s+/).map(Number);
      expect(w!, `${n} cropped to nothing`).toBeGreaterThan(40);
      expect(w!, `${n} has a box far bigger than the canvas it was drawn on`).toBeLessThan(700);
    }
  });

  it('actually shrinks the box for most icons', () => {
    // The point of the exercise, stated as a number. Per-icon bounds cannot say
    // this: an unframed set would pass every one of them individually while
    // being exactly as illegible as before.
    const sides = names.map((n) =>
      Number(text(SRC, n).match(/viewBox="([^"]+)"/)![1]!.trim().split(/\s+/)[2]));
    const tightened = sides.filter((w) => w < 512 * 0.85).length;
    expect(tightened, `only ${tightened}/${names.length} icons were meaningfully cropped`)
      .toBeGreaterThanOrEqual(Math.floor(names.length * 0.8));
  });
});

describe('the files are safe to inline', () => {
  it('gives every gradient and filter an id unique to its own icon', () => {
    // All 34 once declared `blade-light`, `drop-shadow` and the rest. As
    // separate <img> files that is harmless; inline two into one document and
    // the last definition wins, silently repainting the other in its colours.
    const owners = new Map<string, string[]>();
    for (const n of names) {
      for (const m of text(SRC, n).matchAll(/id="([^"]+)"/g)) {
        owners.set(m[1]!, [...(owners.get(m[1]!) ?? []), n]);
      }
    }
    const shared = [...owners].filter(([, who]) => who.length > 1).map(([id]) => id);
    expect(shared, `these ids are declared by more than one icon: ${shared.slice(0, 5).join(', ')}`)
      .toEqual([]);
  });

  it('defines nothing it does not use', () => {
    for (const n of names) {
      const s = text(SRC, n);
      const defined = new Set([...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]!));
      const used = new Set([...s.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!));
      const dead = [...defined].filter((d) => !used.has(d));
      expect(dead, `${n} carries ${dead.length} unused definitions`).toEqual([]);
    }
  });

  it('keeps the background transparent', () => {
    for (const n of names) {
      expect(text(SRC, n), `${n} has a background rect`).not.toMatch(/<rect[^>]*width="100%"/);
    }
  });
});

describe('the published copies match the source', () => {
  it.each(names)('%s is published', (n) => {
    expect(existsSync(join(PUB, `${n}.svg`)), `${n}.svg is not in web/public/art/items`).toBe(true);
    expect(text(PUB, n), `${n}.svg in web/public differs from its source`).toBe(text(SRC, n));
  });

  it('publishes nothing with no source behind it', () => {
    const orphans = (existsSync(PUB) ? readdirSync(PUB) : [])
      .filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4))
      .filter((n) => !names.includes(n));
    expect(orphans, `published icons with no source: ${orphans.join(', ')}`).toEqual([]);
  });

  it('registers exactly what is published', () => {
    // `HAS_ITEM_ART` is what the app consults; a file on disk it does not know
    // about is invisible, and an id it knows about with no file is a 404.
    expect([...HAS_ITEM_ART].sort()).toEqual(names);
  });
});

describe('one picture stands in for a family', () => {
  it('maps enchanted and material variants to the plain shape', () => {
    expect(itemArtId('longsword-plus1')).toBe('longsword');
    expect(itemArtId('silvered-longsword')).toBe('longsword');
    expect(itemArtId('vicious-greataxe')).toBe('greataxe');
    expect(itemArtId('adamantine-plate')).toBe('plate');
  });

  it('draws every scroll as a scroll', () => {
    expect(itemArtId('scroll-fireball')).toBe('scroll');
    expect(itemArtId('scroll-cure-wounds')).toBe('scroll');
  });

  it('draws the resistance potions as a potion', () => {
    expect(itemArtId('potion-fire-resistance')).toBe('potion-healing');
    expect(itemArtId('potion-giant-strength-hill')).toBe('potion-healing');
    // ...but Greater Healing keeps the icon that was drawn for it.
    expect(itemArtId('potion-greater-healing')).toBe('potion-greater-healing');
  });

  it('refuses to stand in for something genuinely different', () => {
    // A Sun Blade drawn as a longsword would say the wrong thing about the one
    // weapon in the shop worth saving for. These keep their emoji.
    for (const id of ['sun-blade', 'dragon-slayer', 'wand-fireballs', 'staff-healing',
      'ring-of-the-ram', 'figurine-golden-lion']) {
      expect(itemArtId(id), `${id} was given somebody else's picture`).toBeUndefined();
    }
  });

  it('never invents an id that has no file', () => {
    for (const id of ownable) {
      const art = itemArtId(id);
      if (art !== undefined) {
        expect(HAS_ITEM_ART.has(art), `${id} maps to ${art}, which does not exist`).toBe(true);
      }
    }
  });

  it('covers most of what a player can own', () => {
    // The number that decided this was worth doing: 31 without the aliasing,
    // 159 with it. Anything near the lower figure means the mapping broke.
    const covered = ownable.filter((id) => itemArtId(id) !== undefined);
    expect(covered.length, `only ${covered.length}/${ownable.length} ownable items have an icon`)
      .toBeGreaterThanOrEqual(150);
  });
});
