import React, { useState, useCallback } from 'react';
import { Silhouette } from './Silhouette.js';

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
 * The stand-in is a silhouette — an abstract shape chosen from the creature's
 * body plan, class or type. It used to be an emoji, and the emoji was measurably
 * too small: `.token.emoji .glyph` sized it from the viewport rather than the
 * cell, so a 49px board cell on a 430px phone held a 20px speck and the board
 * read as empty tiles with dirt on them. A silhouette is an SVG stretched to
 * its box, so it fills whatever it is given.
 *
 * Emoji have not gone away — the combat log, the class pips and the corpse
 * markers still use them, and at 16px inline that is the right mark. What
 * changed is the picture-shaped holes, which wanted a picture-shaped stand-in.
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
  id, src, className, glyphClassName, alt = '', title, style, priority,
}: {
  /** Creature id — chooses the fallback glyph. */
  id: string;
  /** Where the art would be. Omit when there is none, to render the glyph. */
  src?: string;
  className?: string;
  /** Class for the fallback span, when it needs different sizing to the img. */
  glyphClassName?: string;
  /**
   * Ask the browser to fetch this ahead of whatever else is queued.
   *
   * The board sets `high` for its tokens: they are the one thing a player is
   * actually waiting on, and on a slow connection they compete with whatever
   * the landing page left in flight, which the browser will not cancel.
   *
   * ON THE EVIDENCE, HONESTLY. Repeated runs on an emulated 400 kbps profile
   * were tight within a build (±0.01s across three runs) and jumped between
   * builds, which is the signature of a confound rather than a signal — one
   * promising 1.8s result did not reproduce, and re-measuring the same build
   * gave 3.6s. So this is here because it is semantically right, not because a
   * number was demonstrated. No configuration measured worse than the baseline.
   */
  priority?: 'high' | 'low';
  alt?: string;
  title?: string;
  /**
   * Extra style for whichever element renders — the board scales tokens per
   * creature, and the silhouette has to take that scale too. It was
   * image-only, which meant a Huge monster's stand-in was the same size as a
   * Tiny one's until its picture landed.
   */
  style?: React.CSSProperties;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');

  // Runs before paint, so a cached image skips the glyph entirely.
  const measure = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete) setState(el.naturalWidth > 0 ? 'ok' : 'failed');
  }, []);

  if (!src || state === 'failed') {
    return (
      <span
        className={glyphClassName ?? className}
        style={style}
        title={title}
        role="img"
        aria-label={alt || undefined}
      >
        <Silhouette id={id} />
      </span>
    );
  }

  return (
    <>
      {state === 'loading' && (
        <span
          className={`${glyphClassName ?? className ?? ''} art-waiting`}
          style={style}
          title={title}
          role="img"
          aria-label={alt || undefined}
        >
          <Silhouette id={id} />
        </span>
      )}
      <img
        ref={measure}
        className={className}
        style={state === 'loading' ? { ...style, display: 'none' } : style}
        src={src}
        alt={alt}
        title={title}
        {...(priority ? { fetchPriority: priority } : {})}
        draggable={false}
        onLoad={() => setState('ok')}
        onError={() => setState('failed')}
      />
    </>
  );
}
