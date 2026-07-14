/**
 * Hot-seat CLI. Renders the board, generates a menu straight from
 * legalActions(), applies the chosen action, prints the events.
 *
 * Usage: npm start [-- --seed 123]
 */
import * as readline from 'node:readline/promises';
import { Combat } from '../../engine/combat.js';
import { buildParty } from '../../builder/character.js';
import type { Action } from '../../engine/actions.js';
import { renderBoard, renderStatus, renderEvent, describeAction, cellName, parseCell } from './renderer.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function parseSeed(): number {
  const i = process.argv.indexOf('--seed');
  if (i >= 0 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  return Math.floor(Math.random() * 2 ** 31);
}

async function chooseFrom(prompt: string, options: string[]): Promise<number> {
  for (;;) {
    console.log();
    options.forEach((o, i) => console.log(`  ${String(i + 1).padStart(2)}) ${o}`));
    const ans = (await rl.question(`${prompt} `)).trim();
    const n = parseInt(ans, 10);
    if (n >= 1 && n <= options.length) return n - 1;
    console.log('Invalid choice.');
  }
}

async function main() {
  const seed = parseSeed();
  console.log(`\nD&D Grid Combat — hot-seat. Seed: ${seed}\n`);
  const combat = new Combat({
    seed,
    combatants: [...buildParty('team1', 0), ...buildParty('team2', 7)],
  });

  for (const e of combat.log) {
    const line = renderEvent(combat.state, e);
    if (line) console.log(line);
  }

  while (!combat.isOver()) {
    const state = combat.state;
    const me = state.combatants[combat.activeId]!;
    console.log('\n' + renderBoard(state));
    console.log(renderStatus(state));
    const t = me.turn;
    console.log(
      `\n${me.name} (${me.team === 'team1' ? 'Team 1' : 'Team 2'})  HP ${me.hp}/${me.maxHp}  AC ${me.ac}` +
      `  [${t.actionUsed ? ' ' : 'A'}${t.bonusActionUsed ? ' ' : 'B'}]  Move ${t.movementMax - t.movementUsed}ft`,
    );

    const actions = combat.legalActions();
    // Collapse the move flood into one menu entry.
    const moves = actions.filter((a): a is Action & { kind: 'move' } => a.kind === 'move');
    const rest = actions.filter((a) => a.kind !== 'move');
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
    for (const a of rest) {
      menu.push({ label: describeAction(state, a), run: async () => a });
    }

    const idx = await chooseFrom('Action?', menu.map((m) => m.label));
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
  rl.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
