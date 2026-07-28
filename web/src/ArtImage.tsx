import React, { useState, useCallback } from 'react';
import { glyphFor } from './glyphs.js';

/**
 * A creature image that always renders *something*, from the first frame.
 *
 * `hasArt(id)` is a claim about the registry — that a file was generated and
 * shipped. It is not a promise that the browser has it yet. This used to fall
 * back to the glyph only in `onError`, which covers a stale cache or a
 * half-finished deploy but says nothing about the far more common case: the
 * request is simply still in flight.
 *
 * On an emulated Regular 3G connection the party's own four tokens arrive
 * twenty-three seconds after the app does. For those twenty-three seconds every
 * portrait ring was empty and every token cell was blank, which is what a
 * player reports as "it's broken" — and then closes.
 *
 * So loading is a state, not a non-event. Three of them:
 *
 *   loading   glyph on screen, image fetching invisibly behind it
 *   ok        the image, faded in over one frame
 *   failed    glyph, permanently — the old onError behaviour
 *
 * The glyph is the same emoji the board has always degraded to, so a slow
 * connection now looks like the game's own no-art mode rather than like damage.
 *
 * WHY BOTH ELEMENTS ARE IN THE TREE WHILE LOADING
 *
 * A `display: none` image still fetches, so the hidden `<img>` does the real
 * work while the glyph holds the space. That matters because the alternative —
 * a positioned wrapper with the two stacked — would need a new box in the
 * layout, and `.portrait` is targeted directly by two dozen rules that set its
 * size and flex behaviour from the outside. Swapping siblings changes nothing
 * about the box the parent sees.
 *
 * WHY THE `complete` CHECK IN THE REF
 *
 * An image already in the HTTP cache is `complete` the instant it is created,
 * and its `load` event may have fired before React attached the handler. Read
 * synchronously in the ref callback — before paint — a cached image never shows
 * the glyph at all. Without this, every warm load flickers for one frame.
 */
export function ArtImage({
  id, src, className, glyphClassName, alt = '', title, style,
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
  /** Extra style for the image only — the board scales tokens per creature. */
  style?: React.CSSProperties;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');

  // Runs before paint, so a cached image skips the glyph entirely.
  const measure = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete) setState(el.naturalWidth > 0 ? 'ok' : 'failed');
  }, []);

  if (!src || state === 'failed') {
    return (
      <span className={glyphClassName ?? className} title={title} role="img" aria-label={alt || undefined}>
        {glyphFor(id)}
      </span>
    );
  }

  return (
    <>
      {state === 'loading' && (
        <span
          className={`${glyphClassName ?? className ?? ''} art-waiting`}
          title={title}
          role="img"
          aria-label={alt || undefined}
        >
          {glyphFor(id)}
        </span>
      )}
      <img
        ref={measure}
        className={className}
        style={state === 'loading' ? { ...style, display: 'none' } : style}
        src={src}
        alt={alt}
        title={title}
        draggable={false}
        onLoad={() => setState('ok')}
        onError={() => setState('failed')}
      />
    </>
  );
}
