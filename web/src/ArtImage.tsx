import { useState } from 'react';
import { glyphFor } from './glyphs.js';

/**
 * A creature image that always renders *something*.
 *
 * `hasArt(id)` is a claim about the registry — that a file was generated and
 * shipped. It is not a promise that the browser got it. A stale cache, a
 * half-finished deploy or a flaky connection all end the same way: Chrome's
 * torn-photo icon sitting in a 56px circle, which is what a player reports as
 * "the portraits are broken".
 *
 * So the fallback is driven by `onError`, not only by the registry. Whatever
 * the reason, a creature that cannot show its face shows its glyph, which is
 * the same thing the board has always done and reads as deliberate.
 */
export function ArtImage({
  id, src, className, glyphClassName, alt = '', title,
}: {
  /** Creature id — chooses the fallback glyph. */
  id: string;
  /** Where the art would be. Omit when there is none, to render the glyph. */
  src?: string;
  className?: string;
  /** Class for the fallback span, when it needs different sizing to the img. */
  glyphClassName?: string;
  alt?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={glyphClassName ?? className} title={title} role="img" aria-label={alt || undefined}>
        {glyphFor(id)}
      </span>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      title={title}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
