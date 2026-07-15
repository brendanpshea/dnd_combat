import type { GameState, Position, Combatant, Id } from '../../src/engine/types.js';
import { cellAt } from '../../src/engine/types.js';
import { acOf } from '../../src/data/armor.js';
import { posKey } from './actionGroups.js';
import type { FloatEffect, CorpseEffect } from './effects.js';

const TOKEN: Record<string, string> = {
  fighter: '⚔️', wizard: '🧙', cleric: '✨', rogue: '🗡️',
  'goblin-warrior': '👺', 'goblin-boss': '👹', skeleton: '💀',
  wolf: '🐺', zombie: '🧟', ogre: '🦣',
};

export type CellHighlight = 'move' | 'enemy' | 'ally' | 'cell-target' | undefined;

export interface BoardProps {
  state: GameState;
  activeId: Id;
  highlights: Map<string, CellHighlight>;
  selectedId?: Id | undefined;
  multiCounts?: Map<Id, number> | undefined;
  floats?: FloatEffect[];
  corpses?: CorpseEffect[];
  hitIds?: Set<Id>;
  onCellTap(pos: Position, occupant?: Combatant): void;
}

/**
 * Two layers in one coordinate space: a grid of tappable terrain cells
 * (highlights, floats, corpses) and an absolutely-positioned token layer.
 * Tokens are keyed by combatant id and positioned with transforms, so a
 * position change slides them (CSS transition) instead of teleporting.
 */
export function Board({ state, activeId, highlights, selectedId, multiCounts, floats, corpses, hitIds, onCellTap }: BoardProps) {
  const { width, height } = state.grid;

  const cells = [];
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const pos = { x, y };
      const cell = cellAt(state.grid, pos)!;
      const key = posKey(pos);
      const hl = highlights.get(key);
      const classes = ['cell', `terrain-${cell.terrain}`];
      if (hl) classes.push(`hl-${hl}`);
      if ((x + y) % 2 === 0) classes.push('dark');
      const cellFloats = floats?.filter((f) => f.cellKey === key) ?? [];
      const cellCorpses = corpses?.filter((c) => c.cellKey === key) ?? [];
      cells.push(
        <div
          key={key}
          className={classes.join(' ')}
          onClick={() => onCellTap(pos, cell.occupantId ? state.combatants[cell.occupantId] : undefined)}
        >
          {cellCorpses.map((c) => (
            <span key={c.id} className="corpse">{c.glyph}</span>
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
      const count = multiCounts?.get(c.id);
      const tx = c.position.x * 100;
      const ty = (height - 1 - c.position.y) * 100;
      return (
        <div
          key={c.id}
          className="token-slot"
          style={{
            width: `${100 / width}%`,
            height: `${100 / height}%`,
            transform: `translate(${tx}%, ${ty}%)`,
          }}
        >
          <div
            className={[
              'token',
              c.team,
              c.id === activeId ? 'active' : '',
              c.id === selectedId ? 'selected' : '',
              hitIds?.has(c.id) ? 'hit' : '',
            ].join(' ')}
          >
            <span className="glyph">{TOKEN[c.classId] ?? '❓'}</span>
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
      <div className="board" style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
        {cells}
        <div className="token-layer">{tokens}</div>
      </div>
    </div>
  );
}

export function tooltipFor(c: Combatant): string {
  return `${c.name} — HP ${c.hp}/${c.maxHp}, AC ${acOf(c)}`;
}
