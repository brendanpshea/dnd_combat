import { useLayoutEffect, useRef } from 'react';
import type { GameState, Position, Combatant, Id } from '../../src/engine/types.js';
import { cellAt, isDown } from '../../src/engine/types.js';
import { acOf } from '../../src/data/armor.js';
import { posKey } from './actionGroups.js';
import type { FloatEffect, CorpseEffect, BurstEffect } from './effects.js';
import { hasArt, tokenUrl, tokenScale } from './art.js';

const TOKEN: Record<string, string> = {
  fighter: '⚔️', wizard: '🧙', cleric: '✨', rogue: '🗡️',
  'goblin-warrior': '👺', 'goblin-boss': '👹', skeleton: '💀',
  bandit: '🥷', 'bandit-captain': '🏴‍☠️', 'dire-wolf': '🐺', ghoul: '🧛', 'giant-spider': '🕷️', acolyte: '🧎',
  kobold: '🦎', scout: '🏹', orc: '🧌', 'brown-bear': '🐻', 'cult-fanatic': '🕯️', 'animated-armor': '🛡️',
  wolf: '🐺', zombie: '🧟', ogre: '🦣',
  knight: '🤺', minotaur: '🐂', ettin: '🗿',
  priest: '🙏', 'ogre-mage': '🧞',
  guard: '🛡️', bugbear: '🐻‍❄️', lizardfolk: '🦎', gnoll: '🐺', spy: '🕵️',
  'giant-badger': '🦡', 'giant-toad': '🐸', 'giant-hyena': '🐺', 'giant-boar': '🐗', 'giant-constrictor-snake': '🐍',
  gargoyle: '🗿', 'fire-elemental': '🔥', 'water-elemental': '🌊', 'earth-elemental': '🪨', 'air-elemental': '🌪️',
  sprite: '🧚', satyr: '🐐', dryad: '🌳', 'green-hag': '🧙‍♀️', unicorn: '🦄',
  cockatrice: '🐓', harpy: '🦅', manticore: '🦁', owlbear: '🦉', gorgon: '🐂',
};

export type CellHighlight = 'move' | 'enemy' | 'ally' | 'cell-target' | 'aoe' | 'hint' | undefined;

export interface BoardProps {
  state: GameState;
  activeId: Id;
  highlights: Map<string, CellHighlight>;
  selectedId?: Id | undefined;
  multiCounts?: Map<Id, number> | undefined;
  floats?: FloatEffect[];
  corpses?: CorpseEffect[];
  bursts?: BurstEffect[];
  hitIds?: Set<Id>;
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
export function Board({ state, activeId, highlights, selectedId, multiCounts, floats, corpses, bursts, hitIds, movePaths, theme, onCellTap }: BoardProps) {
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

  const cells = [];
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const pos = { x, y };
      const cell = cellAt(state.grid, pos)!;
      const key = posKey(pos);
      const hl = highlights.get(key);
      const classes = ['cell', `terrain-${cell.terrain}`];
      // Badge only the perimeter of an effect field (or a lone tile): a cell
      // whose terrain differs from any orthogonal neighbour, or sits on the
      // grid edge. Keeps a large lava pool or marsh from being stamped on
      // every interior tile while still flagging what the terrain is.
      if (cell.terrain === 'difficult' || cell.terrain === 'hazard') {
        const edge = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
          const n = cellAt(state.grid, { x: x + dx, y: y + dy });
          return !n || n.terrain !== cell.terrain;
        });
        if (edge) classes.push('needs-badge');
      }
      // An overlay, not a terrain: it sits on top of whatever the cell really
      // is, so it can't just be another terrain-* class (that would replace
      // the ground it's covering rather than sitting on it).
      if (cell.illusion) classes.push('illusion');
      if (hl) classes.push(`hl-${hl}`);
      if ((x + y) % 2 === 0) classes.push('dark');
      const cellFloats = floats?.filter((f) => f.cellKey === key) ?? [];
      const cellCorpses = corpses?.filter((c) => c.cellKey === key) ?? [];
      const cellBursts = bursts?.filter((b) => b.cellKey === key) ?? [];
      cells.push(
        <div
          key={key}
          className={classes.join(' ')}
          onClick={() => onCellTap(pos, cell.occupantId ? state.combatants[cell.occupantId] : undefined)}
        >
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
              c.conditions.some((condition) => condition.id === 'hidden') ? 'hidden' : '',
              // A body on the floor: greyed and toppled, but still yours and
              // still there — the point of downing is that you can see who to
              // go and pick up.
              isDown(c) ? 'downed' : '',
            ].join(' ')}
          >
            {c.id === activeId && <div className="turn-arrow" />}
            <div className="base" />
            {hasArt(artId) ? (
              <img
                className="art"
                src={tokenUrl(artId)}
                alt=""
                draggable={false}
                style={{ transform: `scale(${tokenScale(artId)})` }}
              />
            ) : (
              <span className="glyph">{TOKEN[c.classId] ?? '❓'}</span>
            )}
            {c.familiar?.kind === 'owl' && (
              <span
                className={`familiar${c.familiar.helpedRound === state.round ? ' spent' : ''}`}
                title={c.familiar.helpedRound === state.round ? 'Owl familiar has helped this round' : 'Owl familiar is ready to help'}
              >
                🦉
              </span>
            )}
            <div className="hpbar">
              <div className="hpfill" style={{ width: `${Math.round((c.hp / c.maxHp) * 100)}%` }} />
            </div>
            {count ? <span className="multi-count">{count}</span> : null}
            {c.conditions.length > 0 && (
              <span className="cond-dot" title={c.conditions.map((k) => k.id).join(', ')} />
            )}
          </div>
        </div>
      );
    });

  return (
    <div className="board-wrap">
      <div className={`board theme-${theme ?? 'stone'}`} style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
        {cells}
        <div className="token-layer">{tokens}</div>
      </div>
    </div>
  );
}

export function tooltipFor(c: Combatant): string {
  const temp = c.tempHp ? ` + ${c.tempHp} temporary` : '';
  return `${c.name} — HP ${c.hp}/${c.maxHp}${temp}, AC ${acOf(c)}`;
}
