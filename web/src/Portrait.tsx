import type { TeamId } from '../../src/engine/types.js';
import { hasArt, portraitUrl } from './art.js';
import { ArtImage } from './ArtImage.js';

/**
 * Circular character portrait.
 *
 * It used to return null when there was no art, which left an empty ring where
 * every other creature had a face — 58 of the 137 monsters have no portrait, so
 * that was most of the bestiary showing a hole. The board has always fallen
 * back to an emoji and reads fine; this now does the same, and also survives
 * the art failing to load.
 */
export function Portrait({ id, team, big, label }: { id: string; team: TeamId; big?: boolean; label?: string }) {
  const cls = `portrait ${team} ${big ? 'big' : ''}`;
  return (
    <ArtImage
      id={id}
      {...(hasArt(id) ? { src: portraitUrl(id) } : {})}
      className={cls}
      glyphClassName={`${cls} portrait-glyph`}
      alt={label ?? ''}
    />
  );
}
