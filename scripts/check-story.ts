/**
 * The adventure chapters' own checks, fast: validation (which runs the
 * reachability search) for every registered module, with its search size.
 * `npm run check:story` runs this between the typecheck and the story tests;
 * it is the loop to edit chapters against. The full `npm test` (arena
 * simulations included) runs once before a commit.
 *
 * For a chapter with a level band, also its XP ceiling (src/adventure/xp-reach.ts):
 * the most XP any route can reach a fight's door with, and end the chapter
 * with, the level that is, and how far below the next level it stays. A fight
 * met above the band, or XP that can be farmed, is a problem like any other.
 */
import { MODULES } from '../src/data/modules/index.js';
import { validateModule } from '../src/adventure/validate.js';
import { checkModuleReach } from '../src/adventure/reach.js';
import { maxXpReport, type XpAt } from '../src/adventure/xp-reach.js';
import { LEVEL_XP } from '../src/campaign/campaign.js';
import { LEDGER_BUDGET, spend, wideConditions, MAX_CONDITION_FLAGS } from '../src/data/modules/ledger.js';

const nth = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const xpAt = (x: XpAt) => `${x.max.toLocaleString()} XP (${nth(x.level)}, ${Number.isFinite(x.headroom) ? `${x.headroom.toLocaleString()} short of ${nth(x.level + 1)}` : 'the top level'})`;

let failed = 0;
for (const m of MODULES) {
  // First, so the search it runs is the one validation then reads (cached).
  const xp = m.levelBand ? maxXpReport(m) : null;
  const errors = validateModule(m);
  const reach = checkModuleReach(m);
  // The chapter's spend against its ledger budget (docs/state-ledger.md).
  const b = LEDGER_BUDGET[m.id];
  if (b && reach.states > b.states) errors.push(`reach walks ${reach.states.toLocaleString()} states, over its budget of ${b.states.toLocaleString()} (src/data/modules/ledger.ts)`);
  const sp = spend(m);
  const wide = wideConditions(m);
  if (wide.length > (b?.wide ?? 0)) errors.push(`${wide.length} conditions test more than ${MAX_CONDITION_FLAGS} story flags (allowed ${b?.wide ?? 0}):\n      ${wide.join('\n      ')}`);
  const budget = b ? `  flags ${sp.flags}/${b.flags} · conditional ${sp.conditional}/${b.conditional} · states ${reach.states.toLocaleString()}/${b.states.toLocaleString()}` : `  (${reach.states.toLocaleString()} states)`;
  const lines: string[] = [];
  if (xp && m.levelBand) {
    const band = m.levelBand;
    if (xp.skipped) errors.push(`XP ceiling not searched: ${xp.skipped}`);
    errors.push(...xp.farmable);
    for (const f of xp.battles.filter((x) => x.max >= LEVEL_XP[band.to]!)) {
      errors.push(`[${f.scene}] can be met with ${xpAt(f)}, above the chapter's band (${band.from}–${band.to}). One way:\n      ${f.path.join('\n      ')}`);
    }
    /*
     * THE RICHEST DOOR, NOT THE LAST FIGHT.
     *
     * `battles` is sorted by how much XP its door can be reached with, so
     * `battles[0]` is the fight a party can arrive at carrying the most — which
     * is systematically NOT the chapter's last fight. A fight that pays nothing
     * is one you can reach with everything else already banked, so this line
     * named `camp-ambush` for the Hollow Road and `seal-breach` for the
     * Barrows: the risky-camp night attack and the cracked door, both
     * `loot: false` by design, neither of them the chapter's climax (that is
     * `boss` and the sisters). Calling them "the last fight" sent whoever was
     * tuning the chapter to the wrong scene.
     *
     * The number is still the one the band check cares about. Only the name
     * for it was wrong.
     */
    const richest = xp.battles[0];
    const end = xp.endings.find((e) => e.outcome === 'victory');
    if (richest && end) lines.push(`    XP ceiling (band ${band.from}–${band.to}, from ${xp.startXp.toLocaleString()}): richest door [${richest.scene}] ${xpAt(richest)} · end ${xpAt(end)}`);
  }
  console.log(`${errors.length ? '✗' : '✓'} ${m.id}${budget}`);
  for (const l of lines) console.log(l);
  for (const e of errors) console.log(`    ${e}`);
  failed += errors.length;
}
if (failed) {
  console.error(`\n${failed} problem(s).`);
  process.exit(1);
}
