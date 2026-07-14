/**
 * Shared interactive battle runner used by the one-off CLI (main.ts) and the
 * campaign (campaign.ts). Human turns come from menus generated off
 * legalActions(); AI teams play via the greedy policy.
 */
import type * as readline from 'node:readline/promises';
import type { Combat } from '../../engine/combat.js';
import type { TeamId } from '../../engine/types.js';
import { acOf } from '../../data/armor.js';
import { chooseAction } from '../../ai/greedy.js';
import type { Action } from '../../engine/actions.js';
import { renderBoard, renderStatus, renderEvent, describeAction, cellName, parseCell } from './renderer.js';

export async function chooseFrom(rl: readline.Interface, prompt: string, options: string[]): Promise<number> {
  for (;;) {
    console.log();
    options.forEach((o, i) => console.log(`  ${String(i + 1).padStart(2)}) ${o}`));
    const ans = (await rl.question(`${prompt} `)).trim();
    const n = parseInt(ans, 10);
    if (n >= 1 && n <= options.length) return n - 1;
    console.log('Invalid choice.');
  }
}

/** Run a battle to completion. Returns the winning team. */
export async function runBattle(
  combat: Combat,
  aiTeams: Set<string>,
  rl: readline.Interface,
): Promise<TeamId> {
  for (const e of combat.log) {
    const line = renderEvent(combat.state, e);
    if (line) console.log(line);
  }

  while (!combat.isOver()) {
    const state = combat.state;
    const me = state.combatants[combat.activeId]!;

    if (aiTeams.has(me.team)) {
      const action = chooseAction(state, me.id);
      if (action.kind !== 'endTurn') {
        console.log(`\n[AI] ${me.name} (${me.team === 'team1' ? 'T1' : 'T2'}): ${describeAction(state, action)}`);
      }
      const events = combat.apply(action);
      for (const e of events) {
        const line = renderEvent(combat.state, e);
        if (line) console.log(line);
      }
      continue;
    }

    console.log('\n' + renderBoard(state));
    console.log(renderStatus(state));
    const t = me.turn;
    console.log(
      `\n${me.name} (${me.team === 'team1' ? 'Team 1' : 'Team 2'})  HP ${me.hp}/${me.maxHp}  AC ${acOf(me)}` +
      `  [${t.actionUsed ? ' ' : 'A'}${t.bonusActionUsed ? ' ' : 'B'}]  Move ${t.movementMax - t.movementUsed}ft`,
    );

    const actions = combat.legalActions();
    // Collapse the move flood into one menu entry.
    const moves = actions.filter((a): a is Action & { kind: 'move' } => a.kind === 'move');
    let rest = actions.filter((a) => a.kind !== 'move');

    // Collapse position-targeted spells with many variants (Misty Step) too.
    const posSpells = new Map<string, Array<Action & { kind: 'castSpell' }>>();
    for (const a of rest) {
      if (a.kind === 'castSpell' && a.targets.length === 1 && 'position' in a.targets[0]!) {
        const list = posSpells.get(a.spellId) ?? [];
        list.push(a);
        posSpells.set(a.spellId, list);
      }
    }
    const collapsed: Array<{ label: string; run: () => Promise<Action | undefined> }> = [];
    for (const [spellId, variants] of posSpells) {
      if (variants.length <= 4) continue;
      rest = rest.filter((a) => !(a.kind === 'castSpell' && a.spellId === spellId));
      const byCell = new Map(variants.map((v) => {
        const tg = v.targets[0]!;
        return [cellName((tg as { position: { x: number; y: number } }).position), v] as const;
      }));
      collapsed.push({
        label: `Cast ${spellId} (${variants.length} cells)`,
        run: async () => {
          for (;;) {
            const ans = (await rl.question(`Target cell (e.g. c4; ? lists; x cancels): `)).trim().toLowerCase();
            if (ans === 'x') return undefined;
            if (ans === '?') { console.log([...byCell.keys()].join(' ')); continue; }
            const v = byCell.get(ans);
            if (v) return v;
            console.log('Not a valid cell for this spell.');
          }
        },
      });
    }
    const menu: Array<{ label: string; run: () => Promise<Action | undefined> }> = [];

    if (moves.length > 0) {
      menu.push({
        label: `Move (${moves.length} cells in range)`,
        run: async () => {
          const valid = new Set(moves.map((m) => cellName(m.to)));
          for (;;) {
            const ans = (await rl.question(`Destination (e.g. c4; ? lists; x cancels): `)).trim().toLowerCase();
            if (ans === 'x') return undefined;
            if (ans === '?') { console.log([...valid].join(' ')); continue; }
            const pos = parseCell(ans);
            if (pos && valid.has(cellName(pos))) return { kind: 'move', to: pos };
            console.log('Not a reachable cell.');
          }
        },
      });
    }
    menu.push(...collapsed);
    for (const a of rest) {
      menu.push({ label: describeAction(state, a), run: async () => a });
    }

    const idx = await chooseFrom(rl, 'Action?', menu.map((m) => m.label));
    const action = await menu[idx]!.run();
    if (!action) continue;

    try {
      const events = combat.apply(action);
      console.log();
      for (const e of events) {
        const line = renderEvent(combat.state, e);
        if (line) console.log(line);
      }
    } catch (err) {
      console.log(`(${(err as Error).message})`);
    }
  }

  console.log('\nFinal state:');
  console.log(renderBoard(combat.state));
  console.log(renderStatus(combat.state));
  return combat.winner()!;
}

export function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function parseSeed(): number {
  const v = argValue('--seed');
  return v !== undefined ? Number(v) : Math.floor(Math.random() * 2 ** 31);
}
