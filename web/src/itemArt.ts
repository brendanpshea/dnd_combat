/**
 * Which drawn icon, if any, stands for a piece of gear.
 *
 * WHY THIS IS NOT JUST `HAS_ITEM_ART.has(id)`
 *
 * There are 34 icons and 191 things a player can own, and that ratio looks
 * hopeless until you notice what the 191 actually are. Sixty of them are
 * scrolls, which differ only in the spell written on the parchment. Fifty are
 * `+1`, `silvered` and `vicious` variants of a weapon already drawn. Six are
 * resistance potions, which are a potion.
 *
 * Map those onto the shape they are, and 34 pictures cover 159 of the 191 —
 * 83%. Without the mapping it is 31, and the shop is a column of emoji with the
 * occasional picture in it, which reads as broken rather than as sparse.
 *
 * WHAT IS DELIBERATELY NOT MAPPED
 *
 * Wands, staves, rings, figurines and the named magic weapons (Sun Blade,
 * Dragon Slayer). Those have no icon and no honest stand-in: drawing a Sun
 * Blade as a longsword would say the wrong thing about the one item in the shop
 * worth saving for. They keep their emoji, which already distinguishes them —
 * `itemIcon` gives a magic weapon 🌙 and a bane weapon 🗡️.
 */
import { HAS_ITEM_ART } from './art-registry.js';
import { assetUrl } from './assetUrl.js';

/**
 * Prefixes that describe a MATERIAL or an ENCHANTMENT rather than a shape.
 *
 * `adamantine-plate` is plate. `silvered-longsword` is a longsword. The
 * distinction matters mechanically and is carried by the item's name and its
 * stats; it is not something a 44px picture was ever going to convey.
 */
const SHAPE_PREFIXES = /^(silvered|vicious|adamantine)-/;

/**
 * The drawn shape an item id resolves to, or `undefined` if nothing fits.
 *
 * Returns the base id rather than a URL so this stays testable in Node — the
 * URL half needs `import.meta.env`, which only exists under Vite.
 */
export function itemArtId(itemId: string): string | undefined {
  let base = itemId.replace(SHAPE_PREFIXES, '').replace(/-plus1$/, '');
  // Every scroll is the same rolled parchment. The spell is in the name.
  if (base.startsWith('scroll-')) base = 'scroll';
  // Resistance and giant-strength potions are a potion. Greater Healing keeps
  // its own icon, because it is the one potion whose art was drawn to differ.
  if (/^potion-(fire|cold|acid|poison)-resistance$/.test(base)) base = 'potion-healing';
  if (base.startsWith('potion-giant-strength')) base = 'potion-healing';
  // Magic implements: what a wand does is written on it, not visible in it.
  if (base.startsWith('wand-')) base = 'wand';
  if (base.startsWith('staff-')) base = 'staff';
  if (base.startsWith('figurine-')) base = 'figurine';
  /*
   * `^ring-of-`, NOT `^ring-`.
   *
   * `ring-mail` is ARMOUR — a tunic sewn with iron rings — and it has an icon
   * of its own. A prefix match would have quietly replaced a suit of armour
   * with a piece of jewellery, and it would have looked deliberate.
   */
  if (base.startsWith('ring-') && base !== 'ring-mail') base = 'ring';
  // Brazier, bowl, censer and stone: four vessels that each summon an
  // elemental. One vessel is enough — the element is in the name.
  if (base.endsWith('-elemental')) base = 'elemental-focus';
  return HAS_ITEM_ART.has(base) ? base : undefined;
}

/** Where the icon lives, or `undefined` when the item has none. */
export function itemArtUrl(itemId: string): string | undefined {
  const id = itemArtId(itemId);
  return id ? assetUrl(`art/items/${id}.svg`) : undefined;
}
