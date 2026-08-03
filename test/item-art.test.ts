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

/** The side of the square viewBox an icon is framed in. */
const side = (n: string) =>
  Number(text(SRC, n).match(/viewBox="([^"]+)"/)![1]!.trim().split(/\s+/)[2]);

/**
 * How much of its slot an icon's drawing actually fills, 0..1.
 *
 * Uses `data-ink`, which `svg-item-frame.ts` writes alongside the viewBox. It
 * has to: once a weapon is framed against a LONGER weapon, its box is wider
 * than its drawing by an amount that depends on where the floor clipped, and
 * the viewBox alone cannot be inverted to recover the drawing's size. Measuring
 * it here instead would mean launching Chromium on every test run.
 */
const renders = (n: string) => {
  const ink = Number(text(SRC, n).match(/data-ink="([\d.]+)"/)![1]);
  return ink / side(n);
};

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

  it('actually shrinks the box for the things framed against themselves', () => {
    // The point of the exercise, stated as a number. Per-icon bounds cannot say
    // this: an unframed set would pass every one of them individually while
    // being exactly as illegible as before.
    //
    // Weapons are excluded because they are deliberately NOT framed against
    // themselves — see the size-ladder test below — so a large box is correct
    // for them and would make this assertion say the opposite of what it means.
    const loose = names.filter((n) => !(n in WEAPONS));
    const tightened = loose.filter((n) => side(n) < 512 * 0.85).length;
    expect(tightened, `only ${tightened}/${loose.length} non-weapon icons were meaningfully cropped`)
      .toBeGreaterThanOrEqual(Math.floor(loose.length * 0.8));
  });

  it('draws a dagger visibly shorter than a greatsword', () => {
    /*
     * The cue that cropping each icon to itself threw away.
     *
     * At 36px a dagger, a longsword and a greatsword are the same silhouette —
     * a blade on a diagonal — and length was the only thing separating them.
     * Framing every weapon against its own drawing made all three fill the slot
     * identically, which is why they became indistinguishable.
     *
     * `renders()` is the fraction of the slot the drawing actually occupies:
     * its own tight extent over the box it is framed in.
     */
    const ladder = ['dagger', 'shortsword', 'longsword', 'greatsword'];
    const sizes = ladder.map(renders);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!, `${ladder[i]} does not render larger than ${ladder[i - 1]}`)
        .toBeGreaterThan(sizes[i - 1]!);
    }
    expect(sizes[0]! / sizes.at(-1)!, 'a dagger and a greatsword still render the same size')
      .toBeLessThan(0.9);
  });

  it('does not shrink the smallest weapon into a speck', () => {
    // The other half of the trade. True proportion would put a dagger at 0.53
    // of a longbow and draw 19px of blade inside a 36px slot — one illegibility
    // swapped for another.
    const weapons = names.filter((n) => n in WEAPONS);
    const smallest = Math.min(...weapons.map(renders));
    expect(smallest, 'the shortest weapon renders too small to read').toBeGreaterThan(0.55);
  });

  it('frames non-weapons against themselves', () => {
    // A shield is not "shorter" than a breastplate. Sharing the weapon scale
    // would just make all the armour small for no information gained.
    for (const n of names.filter((x) => !(x in WEAPONS))) {
      expect(renders(n), `${n} is not framed to its own drawing`).toBeGreaterThan(0.85);
    }
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

  it('draws every wand as a wand and every staff as a staff', () => {
    expect(itemArtId('wand-fireballs')).toBe('wand');
    expect(itemArtId('wand-paralysis')).toBe('wand');
    expect(itemArtId('staff-healing')).toBe('staff');
    expect(itemArtId('figurine-golden-lion')).toBe('figurine');
    expect(itemArtId('ring-of-the-ram')).toBe('ring');
  });

  it('gives the four elemental vessels one vessel', () => {
    for (const id of ['brazier-fire-elemental', 'bowl-water-elemental',
      'censer-air-elemental', 'stone-earth-elemental']) {
      expect(itemArtId(id), `${id} has no icon`).toBe('elemental-focus');
    }
  });

  it('does not mistake ring mail for jewellery', () => {
    // `ring-mail` is ARMOUR — a tunic sewn with iron rings — and it has an icon
    // of its own. A `^ring-` prefix match would have swapped a suit of armour
    // for a piece of jewellery, and it would have looked deliberate.
    expect(itemArtId('ring-mail'), 'a suit of ring mail was drawn as a ring').toBe('ring-mail');
  });

  it('refuses to stand in for something genuinely different', () => {
    // A Sun Blade drawn as a longsword would say the wrong thing about the one
    // weapon in the shop worth saving for. The NAMED magic weapons keep their
    // emoji for that reason — unlike wands and figurines, which are now drawn,
    // because what a wand does is written on it rather than visible in it.
    for (const id of ['sun-blade', 'dragon-slayer', 'mace-of-disruption',
      'berserker-axe', 'sword-of-wounding']) {
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

  it('covers nearly everything a player can own', () => {
    // The number that decided this was worth doing: 31 without the aliasing,
    // 159 with it, 181 once the wands, staves, rings, figurines and elemental
    // vessels were drawn. Anything well below that means the mapping broke.
    const covered = ownable.filter((id) => itemArtId(id) !== undefined);
    expect(covered.length, `only ${covered.length}/${ownable.length} ownable items have an icon`)
      .toBeGreaterThanOrEqual(175);
  });

  it('leaves exactly the things that have no honest picture', () => {
    // Named magic weapons, and the unarmed strike, which is not an object at
    // all. Naming them makes the emoji fallback a decision rather than a gap:
    // anything NEW turning up here is an icon somebody forgot to draw.
    const bare = ownable.filter((id) => itemArtId(id) === undefined).sort();
    expect(bare).toEqual([
      'berserker-axe', 'dragon-slayer', 'giant-slayer', 'mace-of-disruption',
      'mace-of-smiting', 'mace-of-terror', 'sun-blade', 'sword-of-life-stealing',
      'sword-of-wounding', 'unarmed-strike',
    ]);
  });
});
