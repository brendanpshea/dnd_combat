import { useLayoutEffect, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameState, Position, Combatant, Id } from '../../src/engine/types.js';
import { cellAt, isDown } from '../../src/engine/types.js';
import { acOf } from '../../src/data/armor.js';
import type { CoverRead } from '../../src/engine/rules/cover.js';
import type { MoveRisk } from './moveRisk.js';
import { posKey } from './actionGroups.js';
import type { FloatEffect, CorpseEffect, BurstEffect, AreaEffect, ProjectileEffect } from './effects.js';
import { type StrikeEffect, shotAngleDeg } from './strike.js';
import { ArtImage } from './ArtImage.js';
import {
  hasArt, tokenUrl, tokenScale, boardBgUrl, HAS_BOARD_BG, hasSpellIcon, spellIconUrl,
  HAS_TERRAIN_ART, terrainUrl, backdropLayers,
} from './art.js';
import { reachCells } from '../../src/engine/rules/reach.js';
import { conditionBadges, conditionChip, conditionTint } from './conditions.js';
import { boardThemeVars } from './boardTheme.js';
import { classLook } from './classLook.js';
import type { MapTheme } from '../../src/data/maps.js';
import {
  FIT, MIN_ZOOM, MAX_ZOOM, clamp, zoomToTap, centreOn, ensureVisible, zoomAbout,
  isPannable, offScreenEdge, type Camera, type Size,
} from './boardCamera.js';


export type CellHighlight = 'move' | 'enemy' | 'ally' | 'cell-target' | 'aoe' | 'hint' | undefined;

export interface BoardProps {
  state: GameState;
  activeId: Id;
  highlights: Map<string, CellHighlight>;
  /**
   * Cover at each cell the active hero could move to, and on each combatant
   * already standing in some. Only the covered ones are present — an absent
   * entry means no cover, which keeps the board from having to reason about it.
   */
  coverCells?: Map<string, CoverRead> | undefined;
  coverUnits?: Map<Id, CoverRead> | undefined;
  /**
   * Which reachable squares cost something to reach, and how much. Absent
   * entries are free walks, which is nearly all of them — so the region keeps
   * reading as one shape and only the expensive parts of it are marked.
   */
  riskCells?: Map<string, MoveRisk> | undefined;
  selectedId?: Id | undefined;
  multiCounts?: Map<Id, number> | undefined;
  floats?: FloatEffect[];
  corpses?: CorpseEffect[];
  bursts?: BurstEffect[];
  areas?: AreaEffect[];
  projectiles?: ProjectileEffect[];
  /** Attackers mid-swing. At most one lunge per token per batch — a second
   *  attack restarts nothing, the same way a target hit twice shakes once. */
  strikes?: StrikeEffect[];
  castingId?: Id | undefined;
  hitIds?: Set<Id>;
  /** Summon tokens mid-strike, keyed `casterId:kind` — briefly lunges them. */
  strikingSummons?: Set<string>;
  movePaths?: Map<Id, Position[]>;
  /** Map visual theme — styles the whole board as a place. */
  theme?: string | undefined;
  onCellTap(pos: Position, occupant?: Combatant): void;
}

/**
 * Two layers in one coordinate space: a grid of tappable terrain cells
 * (highlights, floats, corpses) and an absolutely-positioned token layer.
 * Tokens are keyed by combatant id and positioned with transforms, so a
 * position change slides them (CSS transition) instead of teleporting.
 */
export function Board({ state, activeId, highlights, coverCells, coverUnits, riskCells, selectedId, multiCounts, floats, corpses, bursts, areas, projectiles, strikes, castingId, hitIds, strikingSummons, movePaths, theme, onCellTap }: BoardProps) {
  const { width, height } = state.grid;
  const slotRefs = useRef(new Map<Id, HTMLDivElement>());
  /**
   * Keyboard play: which cell the arrow keys are on.
   *
   * The board was mouse-and-touch only. Measured in a browser, a battle offered
   * thirteen focusable controls -- the whole action bar -- and ZERO focusable
   * cells, so a keyboard user could open the spell tray and never move, never
   * attack, and never target anything. The game was unfinishable without a
   * pointer.
   *
   * A roving tabindex is the standard fix for a grid and the only one that
   * works at this size: eighty cells each in the tab order would mean eighty
   * presses to cross the board and would bury the action bar behind them. One
   * cell is tabbable, the arrows move which one, Enter and Space tap it.
   *
   * `undefined` until the first keyboard press, so that the tabbable cell is
   * the active hero's own square -- the place a player would start from -- and
   * so nothing shows a focus ring for a mouse user who never pressed a key.
   */
  const [cursor, setCursor] = useState<Position | undefined>(undefined);

  /*
   * THE CAMERA.
   *
   * See boardCamera.ts for the model and why it is a transform rather than a
   * cell size. The component holds only what needs a DOM: the viewport's
   * measured size, the gesture in progress, and the suppression of the click
   * that follows a drag.
   *
   * `view` starts at zero and is filled by a ResizeObserver. Every camera
   * function tolerates that — a zero viewport yields the fit — so the first
   * paint is the board exactly as it was before any of this existed.
   */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<Size>({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera>(FIT);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => setView((was) => {
      const w = el.clientWidth, h = el.clientHeight;
      // Only on a real change: `setView` re-runs the effects below, and a
      // sub-pixel wobble between the observer and the transform would loop.
      return Math.abs(was.w - w) < 1 && Math.abs(was.h - h) < 1 ? was : { w, h };
    });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Open at a zoom where the squares can be tapped, and re-open on a new board.
   *
   * On the 8-wide boards this game ships today `zoomToTap` returns 1, so this
   * does nothing and the board is pixel-identical to the version with no
   * camera. It is what makes a board wider than the screen playable rather
   * than merely visible.
   *
   * Keyed on the board's shape, so a new fight starts from the fit rather than
   * wherever the last one was left pointing.
   */
  useEffect(() => {
    setCam(clamp({ zoom: zoomToTap(view, width), x: 0, y: 0 }, view));
  }, [view, width, height]);

  /*
   * Follow whoever is acting, by the shortest move that brings them into view.
   *
   * Only when they are off screen, and only as far as it takes — see
   * `ensureVisible`. A camera that re-centred every turn would swing the board
   * out from under a player who had just finished reading it.
   */
  const active = state.combatants[activeId];
  const activeCell = active ? posKey(active.position) : '';
  useEffect(() => {
    if (!active) return;
    setCam((was) => {
      const next = ensureVisible(was, view, state.grid, active.position, 8);
      return next.x === was.x && next.y === was.y && next.zoom === was.zoom ? was : next;
    });
    // `activeCell` rather than the combatant: a creature that moves during its
    // own turn should be followed too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeCell, view.w, view.h]);

  // The keyboard cursor must not walk off screen — it is the only way a
  // keyboard player can pan at all.
  useEffect(() => {
    if (!cursor) return;
    setCam((was) => {
      const next = ensureVisible(was, view, state.grid, cursor, 8);
      return next.x === was.x && next.y === was.y ? was : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor?.x, cursor?.y, view.w, view.h]);

  const pannable = isPannable(cam, view);

  /*
   * Drag to pan, pinch to zoom — and a tap is still a tap.
   *
   * EVERY GESTURE IS MEASURED FROM WHERE IT BEGAN, never accumulated event by
   * event. Accumulating drifts both ways: a pan clamps on every move, so
   * dragging along an edge loses whatever the clamp ate and the board creeps
   * away from the finger; and an incremental pinch compounds a ratio per
   * pointer, which on two fingers moving at once is applied twice from
   * half-updated positions. Measured in a real browser, a full pinch-out moved
   * the zoom from 1.00 to 1.03, and the pinch back in zoomed to 3.
   *
   * POINTERS ARE CAPTURED, and the gesture re-arms when one of two fingers
   * lifts. A touch that leaves the element otherwise never reports an up here,
   * so its entry sits in the map for ever and the NEXT gesture is computed
   * against a finger that is no longer on the glass — which is the other half
   * of what that measurement was showing.
   *
   * `moved` is what separates a pan from a tap. A click fires after a drag
   * exactly as it does after a tap, so without a threshold every pan would also
   * order a move to whatever square the finger came to rest on — the single
   * worst thing a camera could do to this game. The click is swallowed in the
   * capture phase, before any cell sees it.
   */
  const drag = useRef({
    points: new Map<number, { x: number; y: number }>(),
    mode: 'none' as 'none' | 'pan' | 'pinch',
    /** The camera when this gesture began; every frame is measured from it. */
    from: FIT,
    /** Pan: the press point, in client space. Pinch: the midpoint, in local space. */
    origin: { x: 0, y: 0 },
    span0: 0,
    moved: false,
  });
  const DRAG_SLOP = 8; // px of travel before a press becomes a pan

  const spanOf = (pts: Array<{ x: number; y: number }>) =>
    Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  const localTo = (p: { x: number; y: number }) => {
    const box = wrapRef.current?.getBoundingClientRect();
    return { x: p.x - (box?.left ?? 0), y: p.y - (box?.top ?? 0) };
  };

  /** Start (or restart) a gesture from whatever fingers are down now. */
  const arm = (cur: Camera) => {
    const d = drag.current;
    const pts = [...d.points.values()];
    d.from = cur;
    if (pts.length >= 2) {
      d.mode = 'pinch';
      d.span0 = spanOf(pts) || 1;
      d.origin = localTo({ x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 });
      d.moved = true; // a pinch is never a tap
    } else if (pts.length === 1) {
      d.mode = 'pan';
      d.origin = { ...pts[0]! };
    } else {
      d.mode = 'none';
    }
  };

  function onPointerDown(e: React.PointerEvent) {
    const d = drag.current;
    if (d.points.size === 0) d.moved = false;
    d.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    arm(cam);
  }

  /*
   * THE POINTER IS CAPTURED ONLY ONCE THE GESTURE IS A GESTURE.
   *
   * Capturing on every press looks like the robust thing to do and silently
   * breaks the game: with a capture active, the browser dispatches the
   * following `click` to the CAPTURING element rather than to what was under
   * the finger, so every tap on a square and every press of a camera button
   * stops arriving. Measured in Chrome — the zoom buttons simply did nothing.
   *
   * Taking it at the moment a press becomes a drag keeps taps intact and still
   * buys what capture is for: a finger that leaves the board mid-drag goes on
   * reporting here, instead of stranding the board stuck to it.
   */
  const capture = (e: React.PointerEvent) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  };

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.points.has(e.pointerId)) return;
    d.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...d.points.values()];

    if (d.mode === 'pinch' && pts.length >= 2) {
      // A pinch may zoom OUT from the fit as well as in — which is how a player
      // gets back to the whole board without hunting for a button.
      capture(e);
      setCam(zoomAbout(d.from, view, (d.from.zoom * spanOf(pts)) / d.span0, d.origin));
      return;
    }
    if (d.mode !== 'pan' || !pannable) return;
    const dx = e.clientX - d.origin.x, dy = e.clientY - d.origin.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!d.moved) capture(e);
    d.moved = true;
    setCam(clamp({ zoom: d.from.zoom, x: d.from.x + dx, y: d.from.y + dy }, view));
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    d.points.delete(e.pointerId);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* never taken */ }
    // Lifting one finger of a pinch leaves the other panning, from here —
    // rather than from where the pinch started, which would snap the board.
    setCam((c) => { arm(c); return c; });
  }

  const zoomBy = (k: number) => setCam((c) =>
    zoomAbout(c, view, c.zoom * k, { x: view.w / 2, y: view.h / 2 }));


  // Slide tokens along their actual path (around walls / through allies) via
  // the Web Animations API. Runs before paint so there's no jump-then-slide.
  useLayoutEffect(() => {
    if (!movePaths) return;
    for (const [id, path] of movePaths) {
      const el = slotRefs.current.get(id);
      if (!el || path.length < 2) continue;
      const frames = path.map((p) => ({
        transform: `translate(${p.x * 100}%, ${(height - 1 - p.y) * 100}%)`,
      }));
      el.animate(frames, { duration: Math.min(650, 85 * (path.length - 1)), easing: 'ease-in-out' });
    }
  }, [movePaths, height]);

  // Hoisted above the cell loop: the drawn blocking props are per-theme, so the
  // loop needs to know which theme it is drawing before it draws anything.
  const boardTheme = (theme ?? 'stone') as MapTheme;
  const drawnProps = HAS_TERRAIN_ART.has(boardTheme);

  /**
   * Which cell carries `tabIndex={0}` — the single keyboard entry point.
   *
   * Before any key is pressed that is the ACTIVE HERO's own square, so the
   * first Tab into the board lands where a player would look, and the first
   * arrow press moves off their own feet rather than from a corner.
   */
  const tabPos: Position = cursor
    ?? state.combatants[activeId]?.position
    ?? { x: 0, y: 0 };

  const cells = [];
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const pos = { x, y };
      const cell = cellAt(state.grid, pos)!;
      const key = posKey(pos);
      const hl = highlights.get(key);
      // XCOM's shield, on the cell you are about to step onto. Only where the
      // move is actually offered — a badge on ground you cannot reach would be
      // information about a decision you are not making.
      const coverHere = hl === 'move' ? coverCells?.get(key) : undefined;
      const riskHere = hl === 'move' ? riskCells?.get(key) : undefined;
      const classes = ['cell', `terrain-${cell.terrain}`];
      // Badge only the perimeter of an effect field (or a lone tile): a cell
      // whose terrain differs from any orthogonal neighbour, or sits on the
      // grid edge. Keeps a large lava pool or marsh from being stamped on
      // every interior tile while still flagging what the terrain is.
      if (cell.terrain === 'difficult' || cell.terrain === 'hazard' || cell.terrain === 'cover' || cell.terrain === 'high-cover') {
        const edge = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
          const n = cellAt(state.grid, { x: x + dx, y: y + dy });
          return !n || n.terrain !== cell.terrain;
        });
        // A drawn prop carries its own meaning; stamping an emoji on top of it
        // would be the placeholder showing through the thing that replaced it.
        if (edge && !((cell.terrain === 'cover' || cell.terrain === 'high-cover') && drawnProps)) {
          classes.push('needs-badge');
        }
      }
      // A drawn blocking prop, where the theme has a full set.
      //
      // The variant is chosen from the cell's own coordinates rather than at
      // random: a board must look the same every time it is drawn, and a
      // re-render that reshuffled the scenery would be its own kind of bug.
      // Mixing two variants is the whole reason there are two — a run of one
      // sprite down a map edge reads as wallpaper rather than as a wall.
      let propUrl: string | undefined;
      if ((cell.terrain === 'wall' || cell.terrain === 'cover' || cell.terrain === 'high-cover') && drawnProps) {
        propUrl = terrainUrl(cell.terrain === 'wall' ? 'wall' : 'cover', boardTheme,
          (x * 3 + y * 5) % 2 === 0 ? 'a' : 'b');
        classes.push('art-prop');
      }
      // An overlay, not a terrain: it sits on top of whatever the cell really
      // is, so it can't just be another terrain-* class (that would replace
      // the ground it's covering rather than sitting on it).
      if (cell.illusion) classes.push('illusion');
      // A lingering Web overlay — strands you can see and route around. Real
      // web art when it's built (a square-plated icon that fits a cell), else
      // the CSS strand hatching.
      const webbed = !!cell.web;
      if (webbed) classes.push(hasSpellIcon('web') ? 'webbed webbed-art' : 'webbed');
      // A spell's standing hazard (Wall of Fire, Insect Plague, Spike Growth)
      // and a Silence: overlays too, and until now drawn nowhere — the board
      // showed a web you could route around and a wall of fire you could not
      // see. A tint and a corner glyph, so the ground still reads beneath.
      const zone = cell.fire
        ? (cell.fire.label === 'Spike Growth' ? { cls: 'zone-spikes', glyph: '🌵' }
          : cell.fire.label === 'Insect Plague' ? { cls: 'zone-swarm', glyph: '🦗' }
          : { cls: 'zone-fire', glyph: '🔥' })
        : cell.silent ? { cls: 'zone-silence', glyph: '🔇' } : undefined;
      if (zone) classes.push('zoned', zone.cls);
      if (hl) classes.push(`hl-${hl}`);
      /**
       * Where you can walk is ONE REGION, not forty-eight boxes.
       *
       * Every reachable cell wore a 3px bright-blue ring, so a 30-foot move on
       * an 8x8 board ringed forty-eight of its sixty-four squares — the map art,
       * the terrain and the tokens all read through a grid of loud rectangles,
       * and the thing the rings were meant to communicate ("here is where you
       * can go") was the hardest thing on the board to see.
       *
       * So the ring is drawn only on the REGION'S EDGE — a reachable cell with
       * at least one unreachable orthogonal neighbour — and the interior gets a
       * faint wash instead. Same information, one shape. This is the same trick
       * the terrain badges above already use, for the same reason: a large area
       * marked on every interior tile is marked on nothing.
       */
      if (hl === 'move') {
        const open = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          .every(([dx, dy]) => highlights.get(posKey({ x: x + dx, y: y + dy })) === 'move');
        if (!open) classes.push('hl-move-edge');
        // Deliberately NOT a different `hl-`: the region's edge is computed
        // from `hl === 'move'`, so making risk a highlight kind would cut the
        // reachable area into islands and ring each one. It is a wash on top of
        // the same region, which is what it actually is.
        if (riskHere) classes.push(`hl-move-${riskHere.level}`);
      }
      if ((x + y) % 2 === 0) classes.push('dark');
      const cellFloats = floats?.filter((f) => f.cellKey === key) ?? [];
      const cellCorpses = corpses?.filter((c) => c.cellKey === key) ?? [];
      const cellBursts = bursts?.filter((b) => b.cellKey === key) ?? [];
      const cellAreas = areas?.filter((a) => a.cellKeys.includes(key)) ?? [];
      cells.push(
        <div
          key={key}
          className={classes.join(' ')}
          role="gridcell"
          data-x={x}
          data-y={y}
          /* Roving tabindex: exactly one cell is reachable by Tab. See `cursor`. */
          tabIndex={posKey(tabPos) === key ? 0 : -1}
          aria-label={cellLabel(state, pos, cell.occupantId, hl) +
            (cell.fire ? `, ${cell.fire.label ?? 'Wall of Fire'}` : cell.silent ? ', Silence' : '') +
            (riskHere ? `, ${riskHere.why}` : '')}
          style={{
            ...(webbed && hasSpellIcon('web') ? { ['--web-img' as string]: `url(${spellIconUrl('web')})` } : {}),
            ...(propUrl ? { ['--prop' as string]: `url(${propUrl})` } : {}),
          }}
          onClick={() => onCellTap(pos, cell.occupantId ? state.combatants[cell.occupantId] : undefined)}
        >
          {zone && <span className="zone-glyph" aria-hidden="true">{zone.glyph}</span>}
          {coverHere && (
            <span
              className="cover-badge"
              title={`+${coverHere.ac} AC against ranged attacks from here`}
              aria-label={`cover, +${coverHere.ac} armour class`}
            >
              <b>+{coverHere.ac}</b>
            </span>
          )}
          {riskHere && (
            // The number is the point. A player can tell "-7" against 9 hit
            // points apart from "-7" against 40 at a glance, which is the whole
            // decision, and no colour scale can carry it.
            <span
              className={`risk-badge risk-${riskHere.level}`}
              title={riskHere.why}
              aria-hidden="true"
            >
              <b>-{riskHere.damage}</b>
            </span>
          )}
          {cellAreas.map((a) => (
            <span
              key={a.id}
              className={`spell-area fx-${a.kind}${a.centerKey === key ? ' center' : ''}`}
              style={{ animationDelay: `${a.delayMs}ms` }}
            />
          ))}
          {cellCorpses.map((c) => (
            <span key={c.id} className="corpse">{c.glyph}</span>
          ))}
          {cellBursts.map((b) => (
            <span key={b.id} className={`burst burst-${b.kind}`} style={{ animationDelay: `${b.delayMs}ms` }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
                <i key={k} style={{ ['--a' as string]: `${k * 45 + (b.id % 20)}deg`, animationDelay: `${b.delayMs}ms` }} />
              ))}
            </span>
          ))}
          {cellFloats.map((f) => (
            <span key={f.id} className={`float ${f.cls}`} style={{ animationDelay: `${f.delayMs}ms` }}>
              {f.text}
            </span>
          ))}
        </div>,
      );
    }
  }

  // First strike per attacker: an Extra Attack turn produces several, and
  // restarting a CSS animation mid-flight needs a remount, which would drop the
  // token's loaded art. The staggered damage numbers carry the repetition.
  const strikeOf = new Map<Id, StrikeEffect>();
  for (const s of strikes ?? []) if (!strikeOf.has(s.attackerId)) strikeOf.set(s.attackerId, s);

  const tokens = Object.values(state.combatants)
    .filter((c) => c.alive)
    .map((c) => {
      const artId = c.portraitId ?? c.classId;
      const count = multiCounts?.get(c.id);
      const tx = c.position.x * 100;
      const ty = (height - 1 - c.position.y) * 100;
      const condIds = c.conditions.map((k) => k.id);
      // Only real classes light up, so monsters (whose classId is their
      // monster id) get nothing and the pip stays a "this one is yours" mark.
      const look = classLook(c.classId);
      const badges = conditionBadges(condIds);
      const chip = conditionChip(condIds);
      const tint = conditionTint(condIds);
      return (
        <div
          key={c.id}
          ref={(el) => { if (el) slotRefs.current.set(c.id, el); else slotRefs.current.delete(c.id); }}
          className="token-slot"
          style={{
            width: `${100 / width}%`,
            height: `${100 / height}%`,
            transform: `translate(${tx}%, ${ty}%)`,
            // Front rows (lower y = nearer the viewer) overlap the ranks behind
            // them, so figures whose art overflows upward layer correctly.
            zIndex: height - c.position.y,
          }}
        >
          <div
            className={[
              'token',
              c.team,
              hasArt(artId) ? 'art' : 'noart',
              c.id === activeId ? 'active' : '',
              c.id === selectedId ? 'selected' : '',
              hitIds?.has(c.id) ? 'hit' : '',
              strikeOf.has(c.id) ? 'striking' : '',
              c.id === castingId ? 'casting' : '',
              c.conditions.some((condition) => condition.id === 'hidden') ? 'hidden' : '',
              tint ? `tint-${tint}` : '',
              // A body on the floor: greyed and toppled, but still yours and
              // still there — the point of downing is that you can see who to
              // go and pick up.
              isDown(c) ? 'downed' : '',
              // Knocked prone but still conscious: toppled like a downed body,
              // yet in full colour and still in the fight (down already owns the
              // greyed-out look, so only tilt a prone creature that isn't down).
              //
              // An unconscious creature is toppled too. The rules say so — an
              // unconscious creature falls prone — and until this it did not
              // read that way at all: a target that failed its save against
              // Sleep stood upright in full colour, indistinguishable from an
              // enemy about to act, which is the one thing the caster spent a
              // slot to change. `incapacitated` is deliberately NOT included:
              // Sleep's first stage, and a creature that is merely incapacitated
              // stays on its feet in the rules.
              !isDown(c) && c.conditions.some((condition) =>
                condition.id === 'prone' || condition.id === 'unconscious') ? 'prone' : '',
              // Scale alone was carrying the whole "this thing is enormous"
              // signal, and it could not: the bands overlapped, and a token 15%
              // bigger than its neighbour is easy to miss on a phone. A Huge
              // creature also gets a heavier base and a broader shadow.
              c.size === 'huge' || c.size === 'gargantuan' ? 'size-huge' : '',
              // Reach is the tactical half and matters more than bulk: this
              // creature threatens the ring TWO cells out, so the square that
              // looks safe is not.
              reachCells(c) > 1 ? 'has-reach' : '',
              c.flying ? 'flying' : '',
            ].join(' ')}
            style={strikeOf.has(c.id) ? {
              // Direction and timing as custom properties so one keyframe rule
              // serves every angle — the alternative is eight canned animations
              // and a diagonal that lunges sideways.
              ['--lx' as string]: `${strikeOf.get(c.id)!.dx * 100}%`,
              ['--ly' as string]: `${strikeOf.get(c.id)!.dy * 100}%`,
              ['--l-delay' as string]: `${strikeOf.get(c.id)!.delayMs}ms`,
            } : undefined}
          >
            {c.id === activeId && <div className="turn-arrow" />}
            <div className="base" />
            {/* The board rolled its own image-with-fallback, and its error path
                hid the img and left the cell empty — worse than the stand-in it
                already had to hand. ArtImage holds a silhouette while the token
                is in flight and keeps it if the token never comes. The size
                scale goes to both: a Huge shape has to read as Huge whether or
                not its picture has arrived, which is the signal the old emoji
                fallback threw away. */}
            <ArtImage
              id={c.classId}
              {...(hasArt(artId) ? { src: tokenUrl(artId) } : {})}
              className="art"
              glyphClassName="sil"
              priority="high"
              style={{ transform: `scale(${tokenScale(artId, c.size)})` }}
            />
            {c.familiar?.kind === 'owl' && (
              <span
                className={`familiar${c.familiar.helpedRound === state.round ? ' spent' : ''}`}
                title={c.familiar.helpedRound === state.round ? 'Owl familiar has helped this round' : 'Owl familiar is ready to help'}
              >
                🦉
              </span>
            )}
            {look && (
              <span className="class-pip" style={{ ['--pip' as string]: look.color }} title={look.name}>
                {look.glyph}
              </span>
            )}
            {/* Standing behind something right now. On the token rather than
                the cell, because a figure's own defensive state is a fact about
                the figure — and it lets the whole board's shape be read at a
                glance instead of one hover at a time. */}
            {coverUnits?.get(c.id) && (
              <span
                className="cover-pip"
                title={`Behind cover: +${coverUnits.get(c.id)!.ac} AC against ranged attacks`}
                aria-label="behind cover"
              >🛡</span>
            )}
            <div className="hpbar">
              <div className="hpfill" style={{ width: `${Math.round((c.hp / c.maxHp) * 100)}%` }} />
            </div>
            {count ? <span className="multi-count">{count}</span> : null}
            {/*
                ONE CHIP, AND IT DOES NOT TAKE TAPS.

                This was up to four stacked badges, each of them clickable. On a
                390px phone that column measured 14x59 against a 46x46 token —
                taller than the creature — covering 29% of it, and the fourth
                badge's centre sat on the NEXT SQUARE ALONG. Since `.token-layer`
                is `pointer-events: none`, those badges were the only things in
                it that took taps: holes punched over the cell grid, which is
                what a player is actually aiming at.

                The tap they stole is the attack. So the more conditions on an
                enemy — webbed, prone, poisoned, i.e. the enemy most worth
                hitting — the harder it became to hit, and a miss opened a
                glossary card instead of swinging.

                The chip still says "something is wrong with this one" at a
                glance, which is the job. What each condition DOES is spelled
                out in the chooser that opens when you tap the creature — the
                panel you were already heading for.
            */}
            {chip && (
              <div className="cond-badges" title={badges.map((m) => m.label).join('\n')}>
                <span className={`cond-badge ${chip.meta.kind}`}>{chip.meta.icon}</span>
                {chip.extra > 0 && <span className="cond-badge more">+{chip.extra}</span>}
              </div>
            )}
          </div>
        </div>
      );
    });

  // Conjured summons (Spiritual Weapon, Flaming Sphere): visible, roaming
  // tokens of their own. Keyed by caster+kind, so a summon that moves keeps its
  // element and the CSS transform transition glides it across the board.
  // Each summon kind maps to a spell icon (Flaming Sphere borrows Fireball's
  // for now) and an emoji fallback if the art isn't built.
  const SUMMON_GLYPH: Record<string, { icon: string; iconId: string; label: string }> = {
    'spiritual-weapon': { icon: '🔨', iconId: 'spiritual-weapon', label: 'Spiritual Weapon — strikes on its own each turn' },
    'flaming-sphere': { icon: '🔥', iconId: 'fireball', label: 'Flaming Sphere — rolls and rams on its own each turn' },
    // The elemental spirit does not roam — but it has to be VISIBLE, or it is
    // an invisible square that grabs you and deals 8d8.
    'conjure-elemental': { icon: '🪨', iconId: 'conjure-elemental', label: 'Elemental Spirit — grabs and crushes one creature that comes within 5 feet' },
  };
  const summonTokens = Object.values(state.combatants)
    .filter((c) => c.alive && c.summons?.length)
    .flatMap((c) => (c.summons ?? []).map((s) => {
      const glyph = SUMMON_GLYPH[s.kind] ?? { icon: '✨', iconId: s.kind, label: s.kind };
      const art = hasSpellIcon(glyph.iconId);
      const key = `${c.id}:${s.kind}`;
      const striking = strikingSummons?.has(key) ?? false;
      return (
        <div
          key={key}
          className="token-slot summon-slot"
          style={{
            width: `${100 / width}%`,
            height: `${100 / height}%`,
            transform: `translate(${s.position.x * 100}%, ${(height - 1 - s.position.y) * 100}%)`,
            zIndex: height - s.position.y,
          }}
          title={glyph.label}
        >
          <div className={`summon-token ${c.team} kind-${s.kind}${art ? ' art' : ''}${striking ? ' striking' : ''}`}>
            {art
              ? <img src={spellIconUrl(glyph.iconId)} alt="" draggable={false} />
              : glyph.icon}
          </div>
        </div>
      );
    }));

  const bolts = (projectiles ?? []).map((p) => {
    const fx = p.from.x * 100, fy = (height - 1 - p.from.y) * 100;
    const tx = p.to.x * 100, ty = (height - 1 - p.to.y) * 100;
    return (
      <span
        key={p.id}
        className={`projectile fx-${p.kind}`}
        style={{
          width: `${100 / width}%`,
          height: `${100 / height}%`,
          ['--fx' as string]: `${fx}%`, ['--fy' as string]: `${fy}%`,
          ['--tx' as string]: `${tx}%`, ['--ty' as string]: `${ty}%`,
          // Only a shaft needs a facing; a glowing orb is the same from every
          // angle, which is why the spell bolt never carried one.
          ['--rot' as string]: `${shotAngleDeg(p.from, p.to)}deg`,
          animationDelay: `${p.delayMs}ms`,
        }}
      />
    );
  });

  // Floor + blocking-prop colours come from the palette (boardTheme.ts), fed in
  // as custom properties so styles.css holds only the shapes — and a contrast
  // test can hold the colours to a legibility floor.
  const boardStyle: CSSProperties = { gridTemplateColumns: `repeat(${width}, 1fr)`, ...boardThemeVars(boardTheme) };
  if (HAS_BOARD_BG.has(boardTheme)) {
    // A painterly backdrop per theme, sitting behind the CSS-drawn grid — see
    // art/arena-prompts.md. Set inline (not in styles.css) so the URL goes
    // through the same BASE_URL-aware helper as token/portrait art, which a
    // plain CSS `url()` can't: the GitHub Pages build serves from a subpath.
    boardStyle.backgroundImage = backdropLayers(boardBgUrl(boardTheme));
  }

  /*
   * What you cannot see, on the edge nearest it.
   *
   * The problem a camera creates: with the whole board in view you could watch
   * an enemy act. Panned in, a creature taking its turn off screen is simply
   * absent, and the player loses the thread of the fight. A marker on the edge
   * keeps the two facts that survive the crop — that it is there, and roughly
   * which way.
   *
   * Only the living, and only while something is actually out of sight; at zoom
   * 1 this list is always empty, which is the whole board as it was.
   */
  const offBoard = !pannable ? [] : Object.values(state.combatants)
    .filter((c) => c.alive && !isDown(c))
    .map((c) => ({ c, edge: offScreenEdge(cam, view, state.grid, c.position) }))
    .filter((m): m is { c: Combatant; edge: NonNullable<ReturnType<typeof offScreenEdge>> } => !!m.edge);

  return (
    // --board-aspect drives the width cap in styles.css: a tall board (8×12,
    // aspect 1.5) must be narrower than a square one to fit the same viewport
    // height. Width is what sets the board's size at zoom 1, so this is still
    // the whole responsive story; the camera scales that, it does not replace
    // it. The wrap is also the camera's window: it clips, and the pan layer
    // inside it is what moves.
    <div
      ref={wrapRef}
      className={`board-wrap${pannable ? ' panning' : ''}`}
      style={{ ['--board-aspect' as string]: `${height / width}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      /* Ctrl/⌘ + wheel is the desktop convention for zooming a canvas rather
         than scrolling the page past it. A bare wheel is left alone: the
         battle column scrolls, and stealing that would trap the page. */
      onWheel={(e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        setCam((c) => zoomAbout(c, view, c.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
          localTo({ x: e.clientX, y: e.clientY })));
      }}
      /* The click that follows a drag, swallowed before a cell can read it as
         an order to move. Capture phase, because the cell's own handler would
         otherwise run first. */
      onClickCapture={(e) => {
        if (!drag.current.moved) return;
        drag.current.moved = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className="board-pan"
        style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})` }}
      >
      <div
        className={`board theme-${boardTheme}`}
        style={boardStyle}
        role="grid"
        aria-label="Battle map"
        /* One handler on the grid rather than eighty on the cells: the target
           carries its own coordinates, so this stays O(1) per keypress and does
           not re-create eighty closures on every render. */
        onKeyDown={(e) => {
          /**
           * Up is +y, and that is not a typo.
           *
           * The cell loop runs `for (let y = height - 1; y >= 0; y--)`, so rank
           * 1 (y = 0) is drawn at the BOTTOM — the chessboard convention this
           * game labels its squares with. Mapping ArrowUp to -y read as
           * obviously right and did nothing at all on the back rank, which is
           * exactly where a hero starts and therefore the first key a keyboard
           * player would ever press.
           */
          const step: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
          };
          const target = e.target as HTMLElement;
          const at = { x: Number(target.dataset?.x), y: Number(target.dataset?.y) };
          if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
          if (step[e.key]) {
            const [dx, dy] = step[e.key]!;
            const to = { x: at.x + dx, y: at.y + dy };
            if (to.x < 0 || to.y < 0 || to.x >= width || to.y >= height) return;
            e.preventDefault();
            setCursor(to);
            // Focus follows the cursor, so the ring and the tab stop agree.
            const next = e.currentTarget.querySelector<HTMLElement>(`[data-x="${to.x}"][data-y="${to.y}"]`);
            next?.focus();
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const occ = cellAt(state.grid, at)?.occupantId;
            onCellTap(at, occ ? state.combatants[occ] : undefined);
          }
        }}
      >
        {cells}
        {summonTokens.length > 0 && <div className="token-layer summon-layer">{summonTokens}</div>}
        <div className="token-layer">{tokens}</div>
        {bolts.length > 0 && <div className="token-layer projectile-layer">{bolts}</div>}
      </div>
      </div>
      {offBoard.map(({ c, edge }) => (
        <span
          key={c.id}
          className={`offboard off-${edge.side} ${c.team === state.combatants[activeId]?.team ? 'ally' : 'foe'}${c.id === activeId ? ' acting' : ''}`}
          style={{ [edge.side === 'left' || edge.side === 'right' ? 'top' : 'left']: `${edge.offset * 100}%` }}
          title={`${c.name} — off screen`}
          aria-hidden="true"
        >
          {edge.side === 'left' ? '◀' : edge.side === 'right' ? '▶' : edge.side === 'top' ? '▲' : '▼'}
        </span>
      ))}
      {/*
        * Always rendered, and shown by CSS only when the camera is in use (or
        * under a hovering pointer) — see `.board-cam`. Rendering them
        * conditionally instead would mean a player who pinches has no controls
        * until React catches up, and a mouse user has no way to find them at
        * all.
        */}
      <div className="board-cam">
        <button
          type="button" className="cam-btn" title="Zoom in"
          disabled={cam.zoom >= MAX_ZOOM} onClick={() => zoomBy(1.4)}
        >＋</button>
        <button
          type="button" className="cam-btn" title="Zoom out"
          disabled={cam.zoom <= MIN_ZOOM} onClick={() => zoomBy(1 / 1.4)}
        >－</button>
        <button
          type="button" className="cam-btn" title={active ? `Centre on ${active.name}` : 'Centre'}
          disabled={!pannable || !active}
          onClick={() => active && setCam((c) => centreOn(c, view, state.grid, active.position))}
        >◎</button>
        <button
          type="button" className="cam-btn" title="Show the whole board"
          disabled={!pannable} onClick={() => setCam(clamp(FIT, view))}
        >⤢</button>
      </div>
    </div>
  );
}

export function tooltipFor(c: Combatant): string {
  const temp = c.tempHp ? ` + ${c.tempHp} temporary` : '';
  return `${c.name} — HP ${c.hp}/${c.maxHp}${temp}, AC ${acOf(c)}`;
}

/**
 * What a screen reader says about a cell.
 *
 * Position first ("d4"), because a grid without coordinates read aloud is a
 * maze; then who is standing there and what the game is currently offering to
 * do with the square. The highlight is the game's own answer to "can I act
 * here", so reusing it keeps the spoken board and the painted board in step.
 */
function cellLabel(
  state: GameState, pos: Position, occupantId: Id | undefined, hl: CellHighlight,
): string {
  const file = String.fromCharCode(97 + pos.x);
  const where = `${file}${pos.y + 1}`;
  const occ = occupantId ? state.combatants[occupantId] : undefined;
  const who = occ
    ? `${occ.name}, ${occ.team === 'team1' ? 'ally' : 'enemy'}, ${occ.hp} of ${occ.maxHp} hit points`
    : 'empty';
  const offer =
    hl === 'move' ? ', can move here'
      : hl === 'enemy' ? ', can attack'
      : hl === 'ally' ? ', can target'
      : hl === 'cell-target' || hl === 'aoe' ? ', can aim here'
      : hl === 'hint' ? ', suggested'
      : '';
  return `${where}, ${who}${offer}`;
}
