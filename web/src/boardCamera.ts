/**
 * The battle camera: what part of the board you are looking at.
 *
 * WHY A CAMERA AT ALL
 *
 * Board size was capped by a CSS formula, not by a rule. `styles.css` fits the
 * whole board into the space left over (`min(96vw, --board-budget / aspect,
 * 600px)`) and shrinks the cells to make it fit, so a bigger board means
 * smaller squares until they are too small to tap. The arena's own notes say as
 * much — `arena/map.ts` rejected a 16-row board because "the width formula in
 * styles.css then spends about 607px of an 844px screen on the board alone".
 * A camera is what turns board size back into a design decision.
 *
 * WHY A TRANSFORM, AND NOT A CELL SIZE
 *
 * Everything on the board is laid out in PERCENTAGES of the grid — tokens sit
 * at `translate(x * 100%, y * 100%)`, projectiles are `100 / width` percent
 * wide, the area and burst effects likewise. Re-deriving a pixel cell size
 * would mean re-deriving all of that, and every one of those is a place for the
 * layers to disagree by a pixel. A `translate(...) scale(...)` on a wrapper
 * leaves the whole coordinate space alone and lets the browser map pointer
 * events back through it, so taps keep landing on the square under the finger
 * with no arithmetic of ours involved.
 *
 * THE MODEL
 *
 * The board at zoom 1 is exactly the viewport (that is what the fit formula
 * guarantees). So `content = viewport * zoom`, and the pan is a pixel offset
 * applied before the scale: a point `p` in unzoomed board space lands on screen
 * at `p * zoom + pan`.
 *
 * Everything here is pure, and that is deliberate: this repo's web tests run
 * without a DOM, so logic that lives in the component cannot be tested at all.
 * The component does events and refs; the arithmetic lives here.
 */

/** A box, in pixels. The viewport is the board's clipping window. */
export interface Size { w: number; h: number }

export interface Camera {
  /** 1 = the whole board fits, which is what it did before there was a camera. */
  zoom: number;
  /** Pixel offset applied before the scale. 0,0 is the board's top-left. */
  x: number;
  y: number;
}

export const FIT: Camera = { zoom: 1, x: 0, y: 0 };

/** Zoom bounds. Past 3x a 45px cell is 135px and four of them fill a phone. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/**
 * The smallest square still worth aiming a finger at.
 *
 * 44px is the usual accessibility floor for a touch target and the cells are
 * the primary control in this game — every move and every attack is a tap on
 * one. 34 is below that on purpose: a cell is a big target in a grid of
 * identical big targets, where a near miss hits a neighbouring square rather
 * than nothing, and holding 44 would force a default zoom that cut the board
 * down to a keyhole on a phone. Taps on a *token* get the full 44 via the
 * token layer, which is drawn larger than its cell.
 */
export const MIN_CELL_PX = 34;

/**
 * Where the pan may sit, given how much bigger the content is than the window.
 *
 * Two regimes, and the small one matters more than it looks: when the content
 * is no bigger than the window there is nothing to pan, and the right answer is
 * to CENTRE it rather than pin it to a corner. Clamping to `[0, 0]` instead
 * would park a zoomed-out board against the left edge with a gap down the
 * right, which reads as a layout bug rather than as a camera.
 */
export function clampAxis(v: number, window: number, content: number): number {
  if (content <= window) return (window - content) / 2;
  return Math.min(0, Math.max(window - content, v));
}

export function clamp(cam: Camera, view: Size): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom));
  return {
    zoom,
    x: clampAxis(cam.x, view.w, view.w * zoom),
    y: clampAxis(cam.y, view.h, view.h * zoom),
  };
}

/**
 * The zoom at which a cell is still big enough to tap.
 *
 * This is what makes a board larger than the screen playable rather than
 * merely visible: at zoom 1 a 16-wide board on a 390px phone draws 24px cells,
 * so the camera opens already zoomed in and the player pans. On today's 8-wide
 * boards the fit is around 45px a cell, this returns 1, and the camera starts
 * exactly where the board used to be.
 */
export function zoomToTap(view: Size, columns: number, minCell = MIN_CELL_PX): number {
  if (view.w <= 0 || columns <= 0) return MIN_ZOOM;
  const fitCell = view.w / columns;
  if (fitCell <= 0) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, minCell / fitCell));
}

/** Where a cell's centre sits on screen, in viewport pixels. */
export function cellCentre(
  cam: Camera, view: Size, grid: { width: number; height: number }, cell: { x: number; y: number },
): { x: number; y: number } {
  // Column x spans [x/width, (x+1)/width] of the board; row 0 is drawn at the
  // BOTTOM (see the cell loop in Board.tsx), hence the flip.
  const fx = (cell.x + 0.5) / grid.width;
  const fy = (grid.height - 1 - cell.y + 0.5) / grid.height;
  return { x: fx * view.w * cam.zoom + cam.x, y: fy * view.h * cam.zoom + cam.y };
}

/** Pan so that a cell sits in the middle of the window, as far as the edges allow. */
export function centreOn(
  cam: Camera, view: Size, grid: { width: number; height: number }, cell: { x: number; y: number },
): Camera {
  const at = cellCentre({ ...cam, x: 0, y: 0 }, view, grid, cell);
  return clamp({ zoom: cam.zoom, x: view.w / 2 - at.x, y: view.h / 2 - at.y }, view);
}

/**
 * The least pan that brings a cell inside the window, or the camera unchanged.
 *
 * Nudging rather than centring is the whole point of following. A camera that
 * re-centres on every creature's turn swings the board under the player
 * constantly, and in a game where you are reading relative positions that is
 * worse than losing sight of one token: the board you had just understood is
 * somewhere else. This only moves when it must, and then only as far as it
 * must.
 *
 * `margin` keeps the cell off the very edge, where half a token is clipped and
 * its badges are cut.
 */
export function ensureVisible(
  cam: Camera, view: Size, grid: { width: number; height: number }, cell: { x: number; y: number },
  margin = 0,
): Camera {
  const cellW = (view.w * cam.zoom) / grid.width;
  const cellH = (view.h * cam.zoom) / grid.height;
  const at = cellCentre(cam, view, grid, cell);
  const pad = { x: cellW / 2 + margin, y: cellH / 2 + margin };
  let { x, y } = cam;
  if (at.x - pad.x < 0) x += pad.x - at.x;
  else if (at.x + pad.x > view.w) x -= at.x + pad.x - view.w;
  if (at.y - pad.y < 0) y += pad.y - at.y;
  else if (at.y + pad.y > view.h) y -= at.y + pad.y - view.h;
  return clamp({ zoom: cam.zoom, x, y }, view);
}

/**
 * Zoom about a fixed point — the pinch centre, or the pointer.
 *
 * Zooming about the top-left corner instead is the thing that makes a camera
 * feel broken: the square you were looking at slides away under the gesture,
 * so you chase it and overshoot. Holding one screen point still is what makes
 * a pinch feel like it is grabbing the board.
 */
export function zoomAbout(cam: Camera, view: Size, zoom: number, at: { x: number; y: number }): Camera {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const k = next / cam.zoom;
  return clamp({ zoom: next, x: at.x - (at.x - cam.x) * k, y: at.y - (at.y - cam.y) * k }, view);
}

/** Whether any of the board is out of sight — i.e. whether a camera is in use. */
export function isPannable(cam: Camera, view: Size): boolean {
  return view.w * cam.zoom > view.w + 0.5 || view.h * cam.zoom > view.h + 0.5;
}

export type EdgeSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Which way a cell lies when it is off screen, and where to pin the marker.
 *
 * The problem a camera creates: with the whole board in view you could see an
 * enemy act. Panned in, a creature taking its turn off screen is invisible, and
 * the player loses the thread of the fight. The answer every tactics game
 * reaches for is a marker on the edge pointing at what you cannot see — so the
 * information that something is happening, and roughly where, survives the
 * crop.
 *
 * `offset` is the position along that edge, 0..1, so the marker sits across
 * from the thing it is about rather than in a corner.
 */
export function offScreenEdge(
  cam: Camera, view: Size, grid: { width: number; height: number }, cell: { x: number; y: number },
): { side: EdgeSide; offset: number } | undefined {
  const at = cellCentre(cam, view, grid, cell);
  const outL = at.x < 0, outR = at.x > view.w, outT = at.y < 0, outB = at.y > view.h;
  if (!outL && !outR && !outT && !outB) return undefined;
  // How far outside, per axis, so a token off the corner is filed under the
  // direction it is furthest in rather than whichever test ran first.
  const dx = outL ? -at.x : outR ? at.x - view.w : 0;
  const dy = outT ? -at.y : outB ? at.y - view.h : 0;
  const frac = (v: number, span: number) => Math.min(1, Math.max(0, span > 0 ? v / span : 0.5));
  if (dx >= dy) return { side: outL ? 'left' : 'right', offset: frac(at.y, view.h) };
  return { side: outT ? 'top' : 'bottom', offset: frac(at.x, view.w) };
}
