/**
 * ASCII board + English event log. Pure functions of state/events.
 */
import type { GameState, Combatant, Id, Position } from '../../engine/types.js';
import { cellAt } from '../../engine/types.js';
import type { GameEvent } from '../../engine/events.js';
import type { Action } from '../../engine/actions.js';
import { WEAPONS } from '../../data/weapons.js';
import { SPELLS } from '../../data/spells.js';
import { FEATURES } from '../../data/features.js';
import { ITEMS } from '../../data/items.js';
import { acOf } from '../../data/armor.js';

const CLASS_LETTER: Record<string, string> = {
  fighter: 'F', wizard: 'W', cleric: 'C', rogue: 'R',
  'goblin-warrior': 'g', 'goblin-boss': 'G', skeleton: 's',
  wolf: 'w', zombie: 'z', ogre: 'O',
};

export function cellName(p: Position): string {
  return `${String.fromCharCode(97 + p.x)}${p.y + 1}`;
}

export function parseCell(s: string): Position | undefined {
  const m = /^([a-h])([1-8])$/i.exec(s.trim());
  if (!m) return undefined;
  return { x: m[1]!.toLowerCase().charCodeAt(0) - 97, y: parseInt(m[2]!, 10) - 1 };
}

function token(c: Combatant): string {
  const letter = CLASS_LETTER[c.classId] ?? '?';
  return `${letter}${c.team === 'team1' ? '1' : '2'}`;
}

export function renderBoard(state: GameState): string {
  const { width, height } = state.grid;
  const lines: string[] = [];
  const header = '     ' + Array.from({ length: width }, (_, x) => ` ${String.fromCharCode(97 + x)}  `).join('');
  lines.push(header);
  const rule = '   +' + '---+'.repeat(width);
  for (let y = height - 1; y >= 0; y--) {
    lines.push(rule);
    let row = ` ${String(y + 1).padStart(2)} |`;
    for (let x = 0; x < width; x++) {
      const cell = cellAt(state.grid, { x, y })!;
      const occ = cell.occupantId ? state.combatants[cell.occupantId] : undefined;
      const ground =
        cell.terrain === 'wall' ? '###' :
        cell.terrain === 'difficult' ? '~~~' :
        cell.terrain === 'hazard' ? '^^^' : '   ';
      row += occ ? ` ${token(occ)}|` : `${ground}|`;
    }
    lines.push(row);
  }
  lines.push(rule);
  return lines.join('\n');
}

export function renderStatus(state: GameState): string {
  const rows: string[] = [];
  for (const team of ['team1', 'team2'] as const) {
    const members = Object.values(state.combatants).filter((c) => c.team === team);
    const cells = members.map((c) => {
      if (!c.alive) return `${token(c)} ${c.name}: DEAD`;
      const conds = c.conditions.map((k) => k.id).join(',');
      const slots = c.spellSlots.length > 0 ? ` slots:${c.spellSlots.map((s) => s.current).join('/')}` : '';
      const items = c.inventory.filter((s) => ITEMS[s.itemId]).reduce((n, s) => n + s.qty, 0);
      const itemStr = items > 0 ? ` items:${items}` : '';
      return `${token(c)} ${c.name}: ${c.hp}/${c.maxHp}hp AC${acOf(c)}${slots}${itemStr}${conds ? ` [${conds}]` : ''}`;
    });
    rows.push(`  ${team === 'team1' ? 'Team 1' : 'Team 2'}: ${cells.join('  |  ')}`);
  }
  return rows.join('\n');
}

function name(state: GameState, id: Id): string {
  const c = state.combatants[id];
  return c ? `${c.name}(${c.team === 'team1' ? 'T1' : 'T2'})` : id;
}

export function renderEvent(state: GameState, e: GameEvent): string | undefined {
  switch (e.type) {
    case 'combatStarted':
      return 'Initiative: ' + e.order.map((o) => `${name(state, o.id)} ${o.initiative}`).join(', ');
    case 'roundStarted':
      return `\n=== Round ${e.round} ===`;
    case 'turnStarted':
      return `-- ${name(state, e.combatantId)}'s turn --`;
    case 'turnEnded':
      return undefined;
    case 'moved':
      return `${name(state, e.combatantId)} moves to ${cellName(e.path[e.path.length - 1]!)}.`;
    case 'attackRolled': {
      const w = e.weaponId === 'spell' ? 'a spell' : WEAPONS[e.weaponId]?.name ?? e.weaponId;
      const oa = e.opportunity ? ' (opportunity attack)' : '';
      const mode = e.mode !== 'flat' ? ` [${e.mode}: ${[...e.advSources, ...e.disSources].join(', ')}]` : '';
      const result = e.hit ? (e.crit ? 'CRIT!' : 'hit') : 'miss';
      return `${name(state, e.attackerId)} attacks ${name(state, e.targetId)} with ${w}${oa}: ${e.total} vs AC ${e.targetAc} — ${result}${mode}`;
    }
    case 'damageDealt':
      return `  ${name(state, e.targetId)} takes ${e.amount} ${e.damageType} damage.`;
    case 'healed':
      return `${name(state, e.targetId)} regains ${e.amount} HP (${state.combatants[e.targetId]?.hp}/${state.combatants[e.targetId]?.maxHp}).`;
    case 'savingThrow':
      return `  ${name(state, e.combatantId)} ${e.ability.toUpperCase()} save: ${e.total} vs DC ${e.dc} — ${e.success ? 'success' : 'fail'}.`;
    case 'conditionApplied':
      return `  ${name(state, e.combatantId)} is ${e.condition}.`;
    case 'conditionRemoved':
      return `  ${name(state, e.combatantId)} is no longer ${e.condition}.`;
    case 'concentrationBroken':
      return `${name(state, e.combatantId)} loses concentration on ${SPELLS[e.spellId]?.name ?? e.spellId}.`;
    case 'equipped':
      return `${name(state, e.combatantId)} draws ${WEAPONS[e.weaponId]?.name ?? e.weaponId}.`;
    case 'itemUsed': {
      const item = ITEMS[e.itemId]?.name ?? e.itemId;
      return e.targetId && e.targetId !== e.combatantId
        ? `${name(state, e.combatantId)} uses ${item} on ${name(state, e.targetId)}.`
        : `${name(state, e.combatantId)} uses ${item}.`;
    }
    case 'dashed':
      return `${name(state, e.combatantId)} dashes.`;
    case 'disengaged':
      return `${name(state, e.combatantId)} disengages.`;
    case 'dodging':
      return `${name(state, e.combatantId)} dodges.`;
    case 'died':
      return `*** ${name(state, e.combatantId)} dies! ***`;
    case 'combatEnded':
      return `\n##### ${e.winner === 'team1' ? 'TEAM 1' : 'TEAM 2'} WINS! #####`;
  }
}

export function describeAction(state: GameState, a: Action): string {
  switch (a.kind) {
    case 'move': return `Move to ${cellName(a.to)}`;
    case 'attack': {
      const w = WEAPONS[a.weaponId]?.name ?? a.weaponId;
      return `${a.offhand ? 'Off-hand attack' : 'Attack'} ${name(state, a.targetId)} with ${w}`;
    }
    case 'castSpell': {
      const s = SPELLS[a.spellId]?.name ?? a.spellId;
      const tg = a.targets.map((t) => 'combatantId' in t ? name(state, t.combatantId) : cellName(t.position)).join(', ');
      return `Cast ${s} → ${tg}`;
    }
    case 'useFeature': return FEATURES[a.featureId]?.name ?? a.featureId;
    case 'useItem': {
      const item = ITEMS[a.itemId]?.name ?? a.itemId;
      const tg = (a.targets ?? []).map((t) => 'combatantId' in t ? name(state, t.combatantId) : cellName(t.position)).join(', ');
      return tg ? `Use ${item} → ${tg}` : `Use ${item}`;
    }
    case 'dash': return 'Dash';
    case 'disengage': return 'Disengage';
    case 'dodge': return 'Dodge';
    case 'shakeAwake': return `Shake ${name(state, a.targetId)} awake`;
    case 'endTurn': return 'End turn';
  }
}
