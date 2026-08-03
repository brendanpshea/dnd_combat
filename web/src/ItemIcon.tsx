/**
 * A piece of gear, drawn if we have a picture of it and lettered if we do not.
 *
 * WHAT THIS REPLACES
 *
 * `itemIcon()` returns a CATEGORY glyph: every melee weapon is ⚔️, every armour
 * 🥋, every potion 🧪. So a shop screen was a column of identical emoji beside
 * a column of names, and the picture carried no information the text did not
 * already have. A dagger and a greatsword were the same symbol.
 *
 * WHERE IT IS USED, AND WHERE IT IS NOT
 *
 * Only where the icon gets 40px or more: the gear slots, the gear picker and
 * the shop rows. Measured, these icons stop being legible below about 28px —
 * a dagger, a longsword and a greatsword all collapse into the same diagonal
 * sliver — and at that size the emoji genuinely wins. The 20px loot list keeps
 * its emoji for that reason.
 *
 * The split is by SCREEN rather than by item, which is what makes a mixed
 * presentation acceptable: nobody ever sees a drawn icon and an emoji standing
 * in for the same kind of thing side by side.
 *
 * The emoji fallback is not a placeholder to be designed away. Wands, staves,
 * rings and the named magic blades have no icon on purpose — see `itemArt.ts`.
 */
import { itemArtUrl } from './itemArt.js';

export function ItemIcon(
  { itemId, fallback, size = 28, className = '' }: {
    itemId: string;
    /** What `itemIcon()` would have shown. Used when there is no drawing. */
    fallback: string;
    size?: number;
    className?: string;
  },
) {
  const url = itemArtUrl(itemId);
  if (!url) return <span className={`item-ico ${className}`.trim()}>{fallback}</span>;
  return (
    <img
      className={`item-ico art ${className}`.trim()}
      src={url}
      // Decorative: every place this is used prints the item's name beside it,
      // so announcing it again would just make a screen reader say everything
      // twice.
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      // Lazy would be wrong here: these sit in lists the player is already
      // looking at, and a gear screen that fades in one sword at a time reads
      // as a bug.
      decoding="async"
    />
  );
}
