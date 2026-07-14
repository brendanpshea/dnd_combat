import type { GameState, Position, Combatant, Id } from '../../src/engine/types.js';
import { cellAt } from '../../src/engine/types.js';
import { acOf } from '../../src/data/armor.js';
import { posKey } from './actionGroups.js';

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
  onCellTap(pos: Position, occupant?: Combatant): void;
}

export function Board({ state, activeId, highlights, selectedId, multiCounts, onCellTap }: BoardProps) {
  const { width, height } = state.grid;
  const rows = [];
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const pos = { x, y };
      const cell = cellAt(state.grid, pos)!;
      const occ = cell.occupantId ? state.combatants[cell.occupantId] : undefined;
      const hl = highlights.get(posKey(pos));
      const classes = ['cell', `terrain-${cell.terrain}`];
      if (hl) classes.push(`hl-${hl}`);
      if ((x + y) % 2 === 0) classes.push('dark');
      const count = occ && multiCounts?.get(occ.id);
      rows.push(
        <div
          key={posKey(pos)}
          className={classes.join(' ')}
          onClick={() => onCellTap(pos, occ)}
        >
          {occ && (
            <div
              className={[
                'token',
                occ.team,
                occ.id === activeId ? 'active' : '',
                occ.id === selectedId ? 'selected' : '',
              ].join(' ')}
            >
              <span className="glyph">{TOKEN[occ.classId] ?? '❓'}</span>
              <div className="hpbar">
                <div
                  className="hpfill"
                  style={{ width: `${Math.round((occ.hp / occ.maxHp) * 100)}%` }}
                />
              </div>
              {count ? <span className="multi-count">{count}</span> : null}
              {occ.conditions.length > 0 && <span className="cond-dot" title={occ.conditions.map((c) => c.id).join(', ')} />}
            </div>
          )}
        </div>,
      );
    }
  }
  return (
    <div className="board-wrap">
      <div className="board" style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
        {rows}
      </div>
    </div>
  );
}

export function tooltipFor(c: Combatant): string {
  return `${c.name} — HP ${c.hp}/${c.maxHp}, AC ${acOf(c)}`;
}
