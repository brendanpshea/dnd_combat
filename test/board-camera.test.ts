/**
 * The battle camera's arithmetic (web/src/boardCamera.ts).
 *
 * All of it is pure on purpose: the web tests in this repo run without a DOM,
 * so anything that lives in the component is untestable, and a camera is
 * exactly the kind of thing that is wrong by a factor of the zoom in one of
 * four directions. The component is left holding only events and refs.
 *
 * The case that matters most is the FIRST one. A camera that changes what a
 * board looks like today has broken eleven shipped maps and every screenshot
 * in the docs to buy a feature nobody asked for yet; the whole point of zoom 1
 * meaning "fit" is that nothing moves until the player or a bigger board asks
 * it to.
 */
import { describe, it, expect } from 'vitest';
import {
  FIT, MIN_ZOOM, MAX_ZOOM, MIN_CELL_PX,
  clampAxis, clamp, zoomToTap, cellCentre, centreOn, ensureVisible, zoomAbout,
  isPannable, offScreenEdge, type Camera, type Size,
} from '../web/src/boardCamera.js';

/** A phone-ish viewport, and the two board shapes the game actually ships. */
const VIEW: Size = { w: 360, h: 360 };
const TALL: Size = { w: 360, h: 540 };
const SQUARE = { width: 8, height: 8 };
const DEEP = { width: 8, height: 12 };

describe('zoom 1 is the board as it was', () => {
  it('has nothing to pan and sits flush', () => {
    const cam = clamp(FIT, VIEW);
    expect(cam).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(isPannable(cam, VIEW)).toBe(false);
  });

  it('puts the corners of the grid at the corners of the window', () => {
    // If this drifts, every token, projectile and area effect on the board is
    // offset from the cell it belongs to, because they all share this space.
    const bottomLeft = cellCentre(FIT, VIEW, SQUARE, { x: 0, y: 0 });
    const topRight = cellCentre(FIT, VIEW, SQUARE, { x: 7, y: 7 });
    expect(bottomLeft).toEqual({ x: 360 / 16, y: 360 - 360 / 16 });
    expect(topRight).toEqual({ x: 360 - 360 / 16, y: 360 / 16 });
  });

  it('draws rank 1 at the bottom, like the board does', () => {
    // The cell loop runs y = height-1 down to 0, so y = 0 is the bottom row.
    // Getting this backwards would make the camera follow the wrong half of
    // the board and put every off-screen marker on the opposite edge.
    const low = cellCentre(FIT, TALL, DEEP, { x: 3, y: 0 });
    const high = cellCentre(FIT, TALL, DEEP, { x: 3, y: 11 });
    expect(low.y).toBeGreaterThan(high.y);
  });

  it('leaves no off-screen creatures to mark', () => {
    for (let x = 0; x < DEEP.width; x++) {
      for (let y = 0; y < DEEP.height; y++) {
        expect(offScreenEdge(FIT, TALL, DEEP, { x, y }), `${x},${y}`).toBeUndefined();
      }
    }
  });
});

describe('the pan stays on the board', () => {
  it('centres rather than corners what is smaller than the window', () => {
    // Pinned to 0 instead, a zoomed-out board would sit against the left edge
    // with a gap down the right — a layout bug, not a camera.
    expect(clampAxis(-500, 360, 200)).toBe(80);
    expect(clampAxis(500, 360, 200)).toBe(80);
  });

  it('allows exactly the overhang and not a pixel more', () => {
    expect(clampAxis(50, 360, 720)).toBe(0);         // can't drag past the left edge
    expect(clampAxis(-1000, 360, 720)).toBe(-360);   // nor past the right
    expect(clampAxis(-100, 360, 720)).toBe(-100);    // in between, as asked
  });

  it('holds the zoom inside its bounds', () => {
    expect(clamp({ zoom: 99, x: 0, y: 0 }, VIEW).zoom).toBe(MAX_ZOOM);
    expect(clamp({ zoom: 0.01, x: 0, y: 0 }, VIEW).zoom).toBe(MIN_ZOOM);
  });

  it('never leaves a gap at any zoom, from any pan', () => {
    // The property, rather than three examples of it: wherever the camera is
    // asked to go, no edge of the window shows past the board.
    for (const zoom of [1, 1.3, 2, 2.75, 3]) {
      for (const x of [-9999, -360, -100, 0, 50, 9999]) {
        const cam = clamp({ zoom, x, y: x }, VIEW);
        const content = { w: VIEW.w * zoom, h: VIEW.h * zoom };
        if (content.w > VIEW.w) {
          expect(cam.x, `z${zoom} x${x}`).toBeLessThanOrEqual(0);
          expect(cam.x + content.w, `z${zoom} x${x}`).toBeGreaterThanOrEqual(VIEW.w - 1e-9);
        } else {
          expect(cam.x).toBeCloseTo((VIEW.w - content.w) / 2);
        }
      }
    }
  });
});

describe('a board bigger than the screen opens zoomed in', () => {
  it('leaves today\'s 8-wide boards exactly where they were', () => {
    // 360 / 8 = 45px a cell, already past the floor, so the camera must not
    // start somewhere the player did not ask for.
    expect(zoomToTap(VIEW, 8)).toBe(MIN_ZOOM);
  });

  it('zooms in far enough to tap a 16-wide board on a phone', () => {
    // 360 / 16 = 22.5px, under the floor: without this the camera would be
    // "visible but unplayable", which is the trap a camera is supposed to avoid.
    const z = zoomToTap(VIEW, 16);
    expect(z).toBeGreaterThan(1);
    expect((VIEW.w * z) / 16).toBeGreaterThanOrEqual(MIN_CELL_PX - 1e-9);
  });

  it('gives up rather than exceeding the zoom ceiling', () => {
    // A 60-wide board cannot have tappable cells on a phone at any sane zoom.
    // Returning MAX rather than something larger keeps the camera inside the
    // range every other part of this file assumes.
    expect(zoomToTap(VIEW, 60)).toBe(MAX_ZOOM);
  });

  it('survives a viewport that has not been measured yet', () => {
    // The first paint, before any ResizeObserver has fired.
    expect(zoomToTap({ w: 0, h: 0 }, 8)).toBe(MIN_ZOOM);
    expect(zoomToTap(VIEW, 0)).toBe(MIN_ZOOM);
  });
});

describe('zooming holds a point still', () => {
  it('keeps the pinch centre under the fingers', () => {
    const at = { x: 120, y: 200 };
    const cam = zoomAbout({ zoom: 1, x: 0, y: 0 }, VIEW, 2, at);
    // The board point that was under `at` must still be under `at`.
    const before = (at.x - 0) / 1;
    const after = (at.x - cam.x) / cam.zoom;
    expect(after).toBeCloseTo(before);
  });

  it('still refuses to show past the edge', () => {
    // Holding a corner point still would pull the board off screen; the clamp
    // wins, and the gesture simply cannot drag the edge inside.
    const cam = zoomAbout({ zoom: 1, x: 0, y: 0 }, VIEW, 3, { x: 0, y: 0 });
    expect(cam.x).toBeLessThanOrEqual(0);
    expect(cam.x + VIEW.w * cam.zoom).toBeGreaterThanOrEqual(VIEW.w);
  });

  it('zooming out all the way returns to the fit', () => {
    const inAt = zoomAbout(FIT, VIEW, 2.5, { x: 300, y: 40 });
    const out = zoomAbout(inAt, VIEW, 1, { x: 10, y: 10 });
    expect(out).toEqual({ zoom: 1, x: 0, y: 0 });
  });
});

describe('following the turn', () => {
  const zoomed = clamp({ zoom: 2, x: 0, y: 0 }, VIEW); // looking at the top-left quarter

  it('does nothing when the creature is already on screen', () => {
    // The reason this is a nudge and not a re-centre: a camera that swings on
    // every creature's turn costs the player the board they had just read.
    const visible = { x: 1, y: 7 }; // top-left on an 8x8 at zoom 2
    expect(ensureVisible(zoomed, VIEW, SQUARE, visible)).toEqual(zoomed);
  });

  it('moves the least it can to bring one into view', () => {
    // Zoom 3 on a 12-deep board, so there is room between "just inside" and
    // "centred". At zoom 2 on an 8x8 the far corner needs the whole pan range
    // and the nudge and the centre coincide — true, and no test of anything.
    const deep = clamp({ zoom: 3, x: 0, y: 0 }, TALL);
    const target = { x: 5, y: 3 };
    const cam = ensureVisible(deep, TALL, DEEP, target);
    expect(offScreenEdge(cam, TALL, DEEP, target)).toBeUndefined();

    const middle = centreOn(deep, TALL, DEEP, target);
    expect(cam, 'following re-centres instead of nudging').not.toEqual(middle);
    // It arrives at the edge it came in from, not in the middle.
    const at = cellCentre(cam, TALL, DEEP, target);
    const mid = cellCentre(middle, TALL, DEEP, target);
    expect(Math.min(at.x, TALL.w - at.x)).toBeLessThan(Math.min(mid.x, TALL.w - mid.x));
  });

  it('keeps a margin, so the token is not half cut', () => {
    const deep = clamp({ zoom: 3, x: 0, y: 0 }, TALL);
    const target = { x: 5, y: 3 };
    const margin = 12;
    const cam = ensureVisible(deep, TALL, DEEP, target, margin);
    const at = cellCentre(cam, TALL, DEEP, target);
    const half = { x: (TALL.w * cam.zoom) / DEEP.width / 2, y: (TALL.h * cam.zoom) / DEEP.height / 2 };
    expect(at.x + half.x + margin).toBeLessThanOrEqual(TALL.w + 1e-9);
    expect(at.x - half.x - margin).toBeGreaterThanOrEqual(-1e-9);
  });

  it('gives the margin up at the board\'s own edge, rather than panning off it', () => {
    // There is nothing beyond the last rank to show, so a cell in the corner
    // sits against the window edge and the margin simply cannot be honoured.
    // Worth pinning: the alternative is a camera that pans into empty space to
    // satisfy its own padding.
    const corner = { x: 0, y: 0 };
    const cam = ensureVisible(clamp({ zoom: 3, x: 0, y: 0 }, TALL), TALL, DEEP, corner, 40);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(TALL.h - TALL.h * 3);
    expect(offScreenEdge(cam, TALL, DEEP, corner)).toBeUndefined();
  });

  it('centres on a cell when asked, within the edges', () => {
    const cam = centreOn(zoomed, VIEW, SQUARE, { x: 4, y: 4 });
    const at = cellCentre(cam, VIEW, SQUARE, { x: 4, y: 4 });
    expect(at.x).toBeCloseTo(VIEW.w / 2);
    expect(at.y).toBeCloseTo(VIEW.h / 2);
  });

  it('cannot be asked to centre past a corner', () => {
    const cam = centreOn(zoomed, VIEW, SQUARE, { x: 0, y: 0 });
    expect(cam.x).toBe(0);                 // flush to the left
    expect(cam.y).toBe(VIEW.h - VIEW.h * 2); // flush to the bottom
    expect(offScreenEdge(cam, VIEW, SQUARE, { x: 0, y: 0 })).toBeUndefined();
  });

  it('every cell can be reached by centring on it', () => {
    // The guarantee that makes the camera sufficient: there is no square the
    // player can be prevented from looking at.
    for (const zoom of [1, 2, 3]) {
      for (let x = 0; x < DEEP.width; x++) {
        for (let y = 0; y < DEEP.height; y++) {
          const cam = centreOn({ zoom, x: 0, y: 0 }, TALL, DEEP, { x, y });
          expect(offScreenEdge(cam, TALL, DEEP, { x, y }), `z${zoom} ${x},${y}`).toBeUndefined();
        }
      }
    }
  });
});

describe('what you cannot see is marked on the edge', () => {
  // Looking at the top-left quarter of an 8x8 at zoom 2.
  const cam: Camera = { zoom: 2, x: 0, y: 0 };

  it('names the side a creature lies on', () => {
    expect(offScreenEdge(cam, VIEW, SQUARE, { x: 7, y: 7 })?.side).toBe('right');
    expect(offScreenEdge(cam, VIEW, SQUARE, { x: 0, y: 0 })?.side).toBe('bottom');
  });

  it('files a corner under the direction it is furthest in', () => {
    // Bottom-right of the board, from the top-left quarter: off both axes.
    // Whichever it picks must be one it is genuinely off, not whichever test
    // happened to run first.
    const edge = offScreenEdge(cam, VIEW, SQUARE, { x: 7, y: 0 })!;
    expect(['right', 'bottom']).toContain(edge.side);
  });

  it('places the marker across from the thing it is about', () => {
    const near = offScreenEdge(cam, VIEW, SQUARE, { x: 7, y: 7 })!;
    const far = offScreenEdge(cam, VIEW, SQUARE, { x: 7, y: 5 })!;
    expect(near.side).toBe('right');
    expect(far.side).toBe('right');
    // y = 7 is the top row, y = 5 is lower down: the marker follows.
    expect(near.offset).toBeLessThan(far.offset);
  });

  it('keeps the offset on the edge it is drawn along', () => {
    for (let x = 0; x < SQUARE.width; x++) {
      for (let y = 0; y < SQUARE.height; y++) {
        const edge = offScreenEdge(cam, VIEW, SQUARE, { x, y });
        if (!edge) continue;
        expect(edge.offset, `${x},${y}`).toBeGreaterThanOrEqual(0);
        expect(edge.offset, `${x},${y}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
