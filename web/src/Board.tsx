import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { GameState, Position, Combatant, Id } from '../../src/engine/types.js';
import { cellAt, isDown } from '../../src/engine/types.js';
import { acOf } from '../../src/data/armor.js';
import type { CoverRead } from '../../src/engine/rules/cover.js';
import { posKey } from './actionGroups.js';
import type { FloatEffect, CorpseEffect, BurstEffect, AreaEffect, ProjectileEffect } from './effects.js';
import { glyphFor } from './glyphs.js';
import { ArtImage } from './ArtImage.js';
import {
  hasArt, tokenUrl, tokenScale, boardBgUrl, HAS_BOARD_BG, hasSpellIcon, spellIconUrl,
  HAS_TERRAIN_ART, terrainUrl, backdropLayers,
} from './art.js';
import { conditionBadges, conditionTint } from './conditions.js';
import { boardThemeVars } from './boardTheme.js';
import { classLook } from './classLook.js';
import type { MapTheme } from '../../src/data/maps.js';


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
  selectedId?: Id | undefined;
  multiCounts?: Map<Id, number> | undefined;
  floats?: FloatEffect[];
  corpses?: CorpseEffect[];
  bursts?: BurstEffect[];
  areas?: AreaEffect[];
  projectiles?: ProjectileEffect[];
  castingId?: Id | undefined;
  hitIds?: Set<Id>;
  /** Summon tokens mid-strike, keyed `casterId:kind` — briefly lunges them. */
  strikingSummons?: Set<string>;
  movePaths?: Map<Id, Position[]>;
  /** Map visual theme — styles the whole board as a place. */
  theme?: string | undefined;
  onCellTap(pos: Position, occupant?: Combatant): void;
  /** Tapping a condition badge asks for an explanation (mobile has no hover
   *  tooltip). Absent = badges stay hover-only. */
  onCondition?: ((label: string, icon: string) => void) | undefined;
}

/**
 * Two layers in one coordinate space: a grid of tappable terrain cells
 * (highlights, floats, corpses) and an absolutely-positioned token layer.
 * Tokens are keyed by combatant id and positioned with transforms, so a
 * position change slides them (CSS transition) instead of teleporting.
 */
export function Board({ state, activeId, highlights, coverCells, coverUnits, selectedId, multiCounts, floats, corpses, bursts, areas, projectiles, castingId, hitIds, strikingSummons, movePaths, theme, onCellTap, onCondition }: BoardProps) {
  const { width, height } = state.grid;
  const slotRefs = useRef(new Map<Id, HTMLDivElement>());

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
      const classes = ['cell', `terrain-${cell.terrain}`];
      // Badge only the perimeter of an effect field (or a lone tile): a cell
      // whose terrain differs from any orthogonal neighbour, or sits on the
      // grid edge. Keeps a large lava pool or marsh from being stamped on
      // every interior tile while still flagging what the terrain is.
      if (cell.terrain === 'difficult' || cell.terrain === 'hazard' || cell.terrain === 'cover') {
        const edge = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
          const n = cellAt(state.grid, { x: x + dx, y: y + dy });
          return !n || n.terrain !== cell.terrain;
        });
        // A drawn prop carries its own meaning; stamping an emoji on top of it
        // would be the placeholder showing through the thing that replaced it.
        if (edge && !(cell.terrain === 'cover' && drawnProps)) {
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
      if ((cell.terrain === 'wall' || cell.terrain === 'cover') && drawnProps) {
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
      if (hl) classes.push(`hl-${hl}`);
      if ((x + y) % 2 === 0) classes.push('dark');
      const cellFloats = floats?.filter((f) => f.cellKey === key) ?? [];
      const cellCorpses = corpses?.filter((c) => c.cellKey === key) ?? [];
      const cellBursts = bursts?.filter((b) => b.cellKey === key) ?? [];
      const cellAreas = areas?.filter((a) => a.cellKeys.includes(key)) ?? [];
      cells.push(
        <div
          key={key}
          className={classes.join(' ')}
          style={{
            ...(webbed && hasSpellIcon('web') ? { ['--web-img' as string]: `url(${spellIconUrl('web')})` } : {}),
            ...(propUrl ? { ['--prop' as string]: `url(${propUrl})` } : {}),
          }}
          onClick={() => onCellTap(pos, cell.occupantId ? state.combatants[cell.occupantId] : undefined)}
        >
          {coverHere && (
            <span
              className="cover-badge"
              title={`+${coverHere.ac} AC against ranged attacks from here`}
              aria-label={`cover, +${coverHere.ac} armour class`}
            >
              <b>+{coverHere.ac}</b>
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
              hasArt(artId) ? 'art' : 'emoji',
              c.id === activeId ? 'active' : '',
              c.id === selectedId ? 'selected' : '',
              hitIds?.has(c.id) ? 'hit' : '',
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
              !isDown(c) && c.conditions.some((condition) => condition.id === 'prone') ? 'prone' : '',
            ].join(' ')}
          >
            {c.id === activeId && <div className="turn-arrow" />}
            <div className="base" />
            {/* The board rolled its own image-with-fallback, and its error path
                hid the img and left the cell empty — worse than the glyph it
                already had to hand. ArtImage holds the glyph while the token is
                in flight and returns to it if the token never comes. */}
            <ArtImage
              id={c.classId}
              {...(hasArt(artId) ? { src: tokenUrl(artId) } : {})}
              className="art"
              glyphClassName="glyph"
              style={{ transform: `scale(${tokenScale(artId)})` }}
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
            {badges.length > 0 && (
              <div className="cond-badges">
                {badges.slice(0, 3).map((m, i) => (
                  <span
                    key={i} className={`cond-badge ${m.kind}`} title={m.label}
                    onClick={onCondition ? (e) => { e.stopPropagation(); onCondition(m.label, m.icon); } : undefined}
                  >{m.icon}</span>
                ))}
                {badges.length > 3 && (
                  <span
                    className="cond-badge more" title={badges.slice(3).map((m) => m.label).join('\n')}
                    onClick={onCondition ? (e) => { e.stopPropagation(); onCondition(badges.slice(3).map((m) => m.label).join(' · '), '🏷️'); } : undefined}
                  >
                    +{badges.length - 3}
                  </span>
                )}
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

  return (
    // --board-aspect drives the width cap in styles.css: a tall board (8×12,
    // aspect 1.5) must be narrower than a square one to fit the same viewport
    // height. Width is what sets cell size, so this is the whole responsive
    // story — columns never grow, so taps stay finger-sized on a phone.
    <div className="board-wrap" style={{ ['--board-aspect' as string]: `${height / width}` }}>
      <div className={`board theme-${boardTheme}`} style={boardStyle}>
        {cells}
        {summonTokens.length > 0 && <div className="token-layer summon-layer">{summonTokens}</div>}
        <div className="token-layer">{tokens}</div>
        {bolts.length > 0 && <div className="token-layer projectile-layer">{bolts}</div>}
      </div>
    </div>
  );
}

export function tooltipFor(c: Combatant): string {
  const temp = c.tempHp ? ` + ${c.tempHp} temporary` : '';
  return `${c.name} — HP ${c.hp}/${c.maxHp}${temp}, AC ${acOf(c)}`;
}
