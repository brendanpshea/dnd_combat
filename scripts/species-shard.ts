/**
 * One cell of the species harness: a party of `speciesId` vs `encounterId` over
 * `games` seeds, printing a JSON tally. Spawned by scripts/species.ts.
 */
import { Combat } from '../src/engine/combat.js';
import { buildParty } from '../src/builder/character.js';
import { buildEncounter } from '../src/data/monsters.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';
import { chooseAction as greedy } from '../src/ai/greedy.js';

const [speciesId, encounterId, gamesArg, watchSpell] = process.argv.slice(2);
const games = Number(gamesArg);

let wins = 0;
let casts = 0;
let downs = 0;   // heroes that fell across all games — the balance signal
for (let seed = 1; seed <= games; seed++) {
  // Three heroes vs a full encounter — outnumbered on purpose, so fights bite
  // and heroes actually fall, giving the downs metric something to measure.
  const party = buildParty('team1', 0, 3, undefined, Array(4).fill(speciesId)).slice(0, 3);
  const combat = new Combat({ seed, mapId: 'ruins', combatants: [...party, ...buildEncounter(encounterId!, 'team2', 7)] });
  let steps = 0;
  while (!combat.isOver() && steps++ < 4000) {
    const actor = combat.activeId;
    const onParty = combat.state.combatants[actor]!.team === 'team1';
    const a = onParty ? chooseActionSim(combat.state, actor, SIM_PRESETS.normal) : greedy(combat.state, actor);
    if (watchSpell && a.kind === 'castSpell' && a.spellId === watchSpell) casts++;
    combat.apply(a);
  }
  if (combat.winner() === 'team1') wins++;
  // A hero that isn't standing at the end fell during the fight (down or dead).
  downs += Object.values(combat.state.combatants)
    .filter((u) => u.team === 'team1' && !(u.alive && u.hp > 0)).length;
}
process.stdout.write(JSON.stringify({ wins, casts, downs, games }));
