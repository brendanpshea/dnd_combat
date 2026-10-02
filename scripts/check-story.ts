/**
 * The adventure chapters' own checks, fast: validation (which runs the
 * reachability search) for every registered module, with its search size.
 * `npm run check:story` runs this between the typecheck and the story tests;
 * it is the loop to edit chapters against. The full `npm test` (arena
 * simulations included) runs once before a commit.
 */
import { MODULES } from '../src/data/modules/index.js';
import { validateModule } from '../src/adventure/validate.js';
import { checkModuleReach } from '../src/adventure/reach.js';
import { LEDGER_BUDGET, spend } from '../src/data/modules/ledger.js';

let failed = 0;
for (const m of MODULES) {
  const errors = validateModule(m);
  const reach = checkModuleReach(m);
  // The chapter's spend against its ledger budget (docs/state-ledger.md).
  const b = LEDGER_BUDGET[m.id];
  if (b && reach.states > b.states) errors.push(`reach walks ${reach.states.toLocaleString()} states, over its budget of ${b.states.toLocaleString()} (src/data/modules/ledger.ts)`);
  const sp = spend(m);
  const budget = b ? `  flags ${sp.flags}/${b.flags} · conditional ${sp.conditional}/${b.conditional} · states ${reach.states.toLocaleString()}/${b.states.toLocaleString()}` : `  (${reach.states.toLocaleString()} states)`;
  console.log(`${errors.length ? '✗' : '✓'} ${m.id}${budget}`);
  for (const e of errors) console.log(`    ${e}`);
  failed += errors.length;
}
if (failed) {
  console.error(`\n${failed} problem(s).`);
  process.exit(1);
}
