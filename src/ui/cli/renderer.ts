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
  bandit: 'b', 'bandit-captain': 'B', 'dire-wolf': 'D',
  ghoul: 'h', 'giant-spider': 'x', acolyte: 'a',
  kobold: 'k', scout: 'S', orc: 'o', 'brown-bear': 'e',
  'cult-fanatic': 'F', 'animated-armor': 'A',
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
      const temp = c.tempHp ? ` +${c.tempHp} temp` : '';
      const slots = c.spellSlots.length > 0 ? ` slots:${c.spellSlots.map((s) => s.current).join('/')}` : '';
      const innate = Object.entries(c.innateSpells)
        .filter(([, u]) => u.current > 0)
        .map(([id, u]) => `${SPELLS[id]?.name ?? id}:${u.current}`);
      const innateStr = innate.length > 0 ? ` innate:${innate.join(',')}` : '';
      const items = c.inventory.filter((s) => ITEMS[s.itemId]).reduce((n, s) => n + s.qty, 0);
      const itemStr = items > 0 ? ` items:${items}` : '';
      return `${token(c)} ${c.name}: ${c.hp}/${c.maxHp}hp${temp} AC${acOf(c)}${slots}${innateStr}${itemStr}${conds ? ` [${conds}]` : ''}`;
    });
    rows.push(`  ${team === 'team1' ? 'Team 1' : 'Team 2'}: ${cells.join('  |  ')}`);
  }
  return rows.join('\n');
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
/** '+3' / '-1' / '' — the modifier on top of the dice, for readable roll math. */
const signed = (n: number) => (n === 0 ? '' : n > 0 ? `+${n}` : `${n}`);

export interface RenderOpts {
  /**
   * Append (T1)/(T2) after each name. The terminal needs it — it has no colour
   * to tell sides apart with. The web log tags the line's team instead, and
   * names are unique now (rival parties and monsters both get their own), so
   * the tags are pure noise there.
   */
  tagTeams?: boolean;
}

function name(state: GameState, id: Id, opts: RenderOpts = {}): string {
  const c = state.combatants[id];
  if (!c) return id;
  if (opts.tagTeams === false) return c.name;
  return `${c.name}(${c.team === 'team1' ? 'T1' : 'T2'})`;
}

export function renderEvent(state: GameState, e: GameEvent, opts: RenderOpts = {}): string | undefined {
  const nm = (id: Id): string => name(state, id, opts);
  switch (e.type) {
    case 'combatStarted':
      return 'Initiative: ' + e.order.map((o) => `${nm(o.id)} ${o.initiative}`).join(', ');
    case 'roundStarted':
      return `\n=== Round ${e.round} ===`;
    case 'turnStarted':
      return `-- ${nm(e.combatantId)}'s turn --`;
    case 'turnEnded':
      return undefined;
    case 'moved':
      return `${nm(e.combatantId)} moves to ${cellName(e.path[e.path.length - 1]!)}.`;
    case 'attackRolled': {
      const w = e.weaponId === 'spell' ? 'a spell' : WEAPONS[e.weaponId]?.name ?? e.weaponId;
      const oa = e.opportunity ? ' (opportunity attack)' : '';
      const mode = e.mode !== 'flat' ? ` [${e.mode}: ${[...e.advSources, ...e.disSources].join(', ')}]` : '';
      const familiar = e.advSources.includes('owl familiar') ? ' An owl familiar distracts the target.' : '';
      const result = e.hit ? (e.crit ? 'CRIT!' : 'hit') : 'miss';
      // Roll20-style math: the bonus is whatever the engine added on top of
      // the die (proficiency, ability, Bless's d4, a +1 weapon...).
      return `${nm(e.attackerId)} attacks ${nm(e.targetId)} with ${w}${oa}: ` +
        `🎲 d20(${e.natural})${signed(e.total - e.natural)} = ${e.total} vs AC ${e.targetAc} — ${result}${mode}${familiar}`;
    }
    case 'damageDealt': {
      const rolled = sum(e.rolls);
      const mod = e.amount - rolled;
      // Only show `dice+mod` when it actually reconciles. A halved save or a
      // resistance makes the final amount *lower* than the dice, and printing
      // a bogus negative "modifier" would read like broken arithmetic.
      const dice = e.rolls.length === 0 ? ''
        : mod >= 0 ? ` [${e.rolls.join('+')}${signed(mod)}]`
        : ` [rolled ${rolled} → ${e.amount}]`;
      const tags = e.tags && e.tags.length > 0 ? ` (${e.tags.join(', ')})` : '';
      return `  ${nm(e.targetId)} takes ${e.amount} ${e.damageType}${dice}${tags}.`;
    }
    case 'healed':
      return `${nm(e.targetId)} regains ${e.amount} HP (${state.combatants[e.targetId]?.hp}/${state.combatants[e.targetId]?.maxHp}).`;
    case 'savingThrow':
      return `  ${nm(e.combatantId)} ${e.ability.toUpperCase()} save: ` +
        `🎲 d20(${e.natural})${signed(e.total - e.natural)} = ${e.total} vs DC ${e.dc} — ${e.success ? 'success' : 'fail'}.`;
    case 'hideCheck':
      return `  ${nm(e.combatantId)} hides: d20(${e.natural}) = ${e.total} vs DC 15 — ${e.success ? 'hidden' : 'seen'}.`;
    case 'hiddenRevealed':
      return `  ${nm(e.observerId)} spots ${nm(e.combatantId)} (${e.passivePerception} beats ${e.hideCheck}).`;
    case 'conditionApplied':
      return `  ${nm(e.combatantId)} is ${e.condition}.`;
    case 'conditionRemoved':
      return `  ${nm(e.combatantId)} is no longer ${e.condition}.`;
    case 'concentrationBroken':
      return `${nm(e.combatantId)} loses concentration on ${SPELLS[e.spellId]?.name ?? e.spellId}.`;
    case 'equipped':
      return `${nm(e.combatantId)} draws ${WEAPONS[e.weaponId]?.name ?? e.weaponId}.`;
    case 'itemUsed': {
      const item = ITEMS[e.itemId]?.name ?? e.itemId;
      return e.targetId && e.targetId !== e.combatantId
        ? `${nm(e.combatantId)} uses ${item} on ${nm(e.targetId)}.`
        : `${nm(e.combatantId)} uses ${item}.`;
    }
    case 'dashed':
      return `${nm(e.combatantId)} dashes.`;
    case 'disengaged':
      return `${nm(e.combatantId)} disengages.`;
    case 'dodging':
      return `${nm(e.combatantId)} dodges.`;
    case 'died':
      return `*** ${nm(e.combatantId)} dies! ***`;
    case 'downed':
      return `*** ${nm(e.combatantId)} is down! (unconscious — heal them to revive) ***`;
    case 'revived':
      return `${nm(e.combatantId)} is back on their feet with ${e.hp} HP!`;
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
      const w = a.weaponId ? ` (${WEAPONS[a.weaponId]?.name ?? a.weaponId})` : '';
      const tg = a.targets.map((t) => 'combatantId' in t ? name(state, t.combatantId) : cellName(t.position)).join(', ');
      return `Cast ${s}${w} → ${tg}`;
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
    case 'hide': return 'Hide';
    case 'shakeAwake': return `Shake ${name(state, a.targetId)} awake`;
    case 'endTurn': return 'End turn';
  }
}
