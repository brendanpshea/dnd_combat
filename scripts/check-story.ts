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

let failed = 0;
for (const m of MODULES) {
  const errors = validateModule(m);
  const reach = checkModuleReach(m);
  console.log(`${errors.length ? '✗' : '✓'} ${m.id}  (${reach.states.toLocaleString()} states)`);
  for (const e of errors) console.log(`    ${e}`);
  failed += errors.length;
}
if (failed) {
  console.error(`\n${failed} problem(s).`);
  process.exit(1);
}
