/**
 * Adversarial fuzz: npx tsx scripts/fuzz.ts [fights] [--seed N] [--verbose]
 *
 * Builds deliberately strange parties — four of the same class, a caster with
 * nothing but heals prepared, someone holding a weapon they are not trained
 * with, a wizard with an empty spell list, a hero with no weapon at all — puts
 * them against random encounters, and checks the engine's invariants after
 * *every single action*.
 *
 * The playtest asks "does a run hold together". This asks "can the engine be
 * broken", which is a different question and needs the ugly inputs a real
 * player would never produce on purpose but a forge full of options eventually
 * will.
 *
 * Every violation is printed with the seed and the action that caused it, so a
 * finding is reproducible before it is diagnosed.
 */
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import { legalActions, isLegalAction, type Action } from '../src/engine/actions.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS, MONSTER_XP } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ARMOR } from '../src/data/armor.js';
import { SPECIES } from '../src/data/species.js';
import { generateArenaMap } from '../src/arena/map.js';
import { parseMap } from '../src/data/maps.js';
import { cellAt, isDown, type Combatant, type GameState, type Id } from '../src/engine/types.js';

const FIGHTS = Number(process.argv[2] ?? 400);
const SEED0 = Number(process.argv[process.argv.indexOf('--seed') + 1]) || 1;
const VERBOSE = process.argv.includes('--verbose');
const MAX_DECISIONS = 3000;

// --- a tiny seeded RNG, so every finding is reproducible -------------------

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)]!;

// --- the strange things we do to a party ----------------------------------

const MUTATIONS = [
  'none',
  /** Prepared list emptied — can the AI find anything to do? */
  'no-spells',
  /** Only the spells that heal, so nothing offensive is ever an option. */
  'heals-only',
  /** Only cantrips: no slots to spend at all. */
  'cantrips-only',
  /** Nothing in either hand. */
  'unarmed',
  /** A weapon the class was never trained with. */
  'untrained-weapon',
  /** Heavy armour on whoever, trained or not. */
  'wrong-armour',
  /** Two-handed weapon *and* a shield, which no forge would offer. */
  'two-handed-and-shield',
  /** Every spell in the game, whether the class owns it or not. */
  'every-spell',
  /** A duplicate of another party member's exact kit. */
  'no-armour',
] as const;
type Mutation = typeof MUTATIONS[number];

const HEAL_SPELLS = new Set<Id>(['cure-wounds', 'healing-word', 'mass-healing-word', 'lesser-restoration']);

function mutate(c: Combatant, m: Mutation, r: () => number): void {
  switch (m) {
    case 'no-spells': c.spellIds = []; break;
    case 'heals-only': c.spellIds = c.spellIds.filter((s) => HEAL_SPELLS.has(s)); break;
    case 'cantrips-only':
      c.spellIds = c.spellIds.filter((s) => SPELLS[s]?.level === 0);
      c.spellSlots = c.spellSlots.map((s) => ({ ...s, current: 0 }));
      break;
    case 'unarmed': c.equipped = { ...c.equipped, mainHand: undefined, offHand: undefined }; break;
    case 'untrained-weapon': c.equipped = { ...c.equipped, mainHand: pick(r, Object.keys(WEAPONS)) }; break;
    case 'wrong-armour': c.equipped = { ...c.equipped, armor: pick(r, Object.keys(ARMOR)) }; break;
    case 'two-handed-and-shield':
      c.equipped = { ...c.equipped, mainHand: 'greatsword', offHand: 'shield' };
      break;
    case 'every-spell':
      c.spellIds = Object.keys(SPELLS).filter((s) => !SPELLS[s]?.outOfCombat);
      break;
    case 'no-armour': c.equipped = { ...c.equipped, armor: undefined, offHand: undefined }; break;
    case 'none': break;
  }
}

// --- invariants -----------------------------------------------------------

interface Violation { seed: number; rule: string; detail: string; action: string }
const violations: Violation[] = [];
const seenRules = new Map<string, number>();

function check(state: GameState, seed: number, action: string): void {
  const report = (rule: string, detail: string) => {
    seenRules.set(rule, (seenRules.get(rule) ?? 0) + 1);
    if (violations.length < 400) violations.push({ seed, rule, detail, action });
  };

  const byCell = new Map<string, Id[]>();
  for (const c of Object.values(state.combatants)) {
    if (c.hp < 0) report('hp below zero', `${c.id} at ${c.hp}`);
    if (c.hp > c.maxHp) report('hp above maximum', `${c.id} at ${c.hp}/${c.maxHp}`);
    if (c.maxHp < 0) report('negative maximum hp', `${c.id} at ${c.maxHp}`);
    if ((c.tempHp ?? 0) < 0) report('negative temp hp', `${c.id} at ${c.tempHp}`);
    if (c.alive && c.hp === 0 && !c.unconsciousAtZero) report('a monster alive at 0 hp', c.id);
    for (const s of c.spellSlots) {
      if (s.current < 0) report('negative spell slots', `${c.id}`);
      if (s.current > s.max) report('spell slots above maximum', `${c.id} ${s.current}/${s.max}`);
    }
    for (const [fid, pool] of Object.entries(c.featureUses)) {
      if (pool.current < 0) report('negative feature uses', `${c.id} ${fid}`);
      if (pool.current > pool.max) report('feature uses above maximum', `${c.id} ${fid} ${pool.current}/${pool.max}`);
    }
    for (const k of c.conditions) {
      if (k.sourceId !== undefined && !state.combatants[k.sourceId]) {
        report('condition from a source that does not exist', `${c.id} ${k.id} <- ${k.sourceId}`);
      }
    }
    // Everyone still in the fight holds exactly the cell they think they are on.
    if (c.alive) {
      const key = `${c.position.x},${c.position.y}`;
      byCell.set(key, [...(byCell.get(key) ?? []), c.id]);
      const cell = cellAt(state.grid, c.position);
      if (!cell) report('standing off the grid', `${c.id} at ${key}`);
      else if (cell.occupantId !== c.id) {
        report('grid disagrees about who is standing there', `${c.id} at ${key}, cell says ${cell.occupantId ?? 'nobody'}`);
      }
      if (cell?.terrain === 'wall') report('standing inside a wall', `${c.id} at ${key}`);
    } else {
      const cell = cellAt(state.grid, c.position);
      if (cell?.occupantId === c.id) report('a body still holding its cell', c.id);
    }
  }
  for (const [key, ids] of byCell) {
    if (ids.length > 1) report('two creatures on one cell', `${key}: ${ids.join(' + ')}`);
  }

  // --- what a caster leaves behind ---------------------------------------
  //
  // The grid and resource checks above cannot see any of this, and it is
  // exactly the class of bug a player notices and the AI never will: a sphere
  // still burning for a druid who is face-down, an aura around a corpse, a
  // condition sustained by a concentration that ended. None of it stops the
  // fight, so a harness that only asks "did this finish" reports all clear.
  for (const c of Object.values(state.combatants)) {
    const gone = !c.alive || isDown(c);
    if (gone && c.concentratingOn) {
      report('concentrating while down or dead', `${c.id} on ${c.concentratingOn.spellId}`);
    }
    if (gone && (c.summons?.length ?? 0) > 0) {
      report('summons outliving their caster', `${c.id} still has ${c.summons!.map((x) => x.kind).join(', ')}`);
    }
    if (gone && c.spiritualGuardians) report('an aura around a body', c.id);
    if (gone && c.stormCloud) report('a storm cloud with no caster', c.id);
    if (gone && c.moonbeam) report('a moonbeam with no caster', c.id);
    for (const sm of c.summons ?? []) {
      // A summon with neither a clock nor a concentration holding it is
      // orphaned: nothing will ever clear it.
      if (sm.expiresAtRound === undefined && !c.concentratingOn) {
        report('a summon nothing can ever clear', `${c.id} ${sm.kind}`);
      }
      if (sm.expiresAtRound !== undefined && sm.expiresAtRound < state.round) {
        report('a summon past its expiry still on the board', `${c.id} ${sm.kind} expired round ${sm.expiresAtRound}`);
      }
    }
    // A condition held by concentration needs a source still concentrating.
    for (const k of c.conditions) {
      if (!k.concentration || k.sourceId === undefined) continue;
      const src = state.combatants[k.sourceId];
      if (src && !src.concentratingOn) {
        report('a concentration condition whose source stopped concentrating', `${c.id} ${k.id} <- ${src.id}`);
      }
    }
  }
  // Terrain effects keyed to a caster who has left the fight.
  for (const cell of state.grid.cells) {
    const src = cell.web?.sourceId ? state.combatants[cell.web.sourceId] : undefined;
    if (src && !src.alive) report('a web spun by a corpse', src.id);
  }
  if (!state.combatants[state.initiativeOrder[state.turnIndex] ?? '']) {
    report('turn index points at nobody', `index ${state.turnIndex} of ${state.initiativeOrder.length}`);
  }
}

// --- one fight ------------------------------------------------------------

const CLASS_IDS = Object.keys(CLASSES);
const SPECIES_IDS = Object.keys(SPECIES);
const ROSTER = Object.keys(MONSTERS).filter((m) => (MONSTER_XP[m] ?? 0) <= 1800);

function runFight(seed: number): { mutations: string; stalled: boolean; error?: string } {
  const r = rng(seed);
  const level = 1 + Math.floor(r() * 5);
  // Deliberately allow duplicates: four druids is a party the forge will not
  // build and the engine must survive anyway.
  const classes = Array.from({ length: 1 + Math.floor(r() * 4) }, () => pick(r, CLASS_IDS));
  const mutations: Mutation[] = classes.map(() => pick(r, MUTATIONS));
  const party = classes.map((classId, i) => {
    const c = {
      ...buildCharacter({ classId, team: 'team1' as const, position: { x: 1, y: 1 + i }, speciesId: pick(r, SPECIES_IDS), level }),
      id: `hero${i}`,
    };
    mutate(c, mutations[i]!, r);
    return c;
  });
  const m = generateArenaMap({}, (seed * 2654435761) >>> 0);
  const grid = parseMap(m.value.map);
  // Open cells only, and each used once. Dropping a creature into a wall is a
  // harness bug that reads exactly like an engine one.
  const openCells = (fromLeft: boolean) => {
    const out: Array<{ x: number; y: number }> = [];
    const xs = [...Array(grid.width).keys()];
    for (const x of fromLeft ? xs : xs.reverse()) {
      for (let y = 0; y < grid.height; y++) {
        if (cellAt(grid, { x, y })?.terrain === 'open') out.push({ x, y });
      }
    }
    return out;
  };
  const left = openCells(true);
  const right = openCells(false);
  party.forEach((p, i) => { if (left[i]) p.position = left[i]!; });
  const foeCount = Math.min(1 + Math.floor(r() * 4), right.length);
  const foes = Array.from({ length: foeCount }, (_, i) =>
    buildMonster(pick(r, ROSTER), 'team2', right[i]!, String(i)));
  if (left.length < party.length || right.length < foeCount) {
    return { mutations: classes.join(','), stalled: false };   // map too cramped; skip
  }

  const label = classes.map((cl, i) => `${cl}:${mutations[i]}`).join(' ');
  let combat: Combat;
  try {
    combat = new Combat({ seed, map: m.value.map, combatants: [...party, ...foes] });
  } catch (err) {
    return { mutations: label, stalled: false, error: `construction: ${String(err)}` };
  }
  check(combat.state, seed, 'start of combat');

  let decisions = 0;
  while (!combat.winner() && decisions++ < MAX_DECISIONS) {
    const id = combat.activeId!;
    let action: Action;
    try {
      action = chooseAction(combat.state, id) ?? { kind: 'endTurn' };
    } catch (err) {
      return { mutations: label, stalled: false, error: `chooseAction for ${id}: ${String(err)}` };
    }
    // The AI must only ever return something the engine would accept.
    if (!isLegalAction(combat.state, id, action)) {
      violations.push({
        seed, rule: 'the AI chose an illegal action', action: JSON.stringify(action),
        detail: `${id} (${combat.state.combatants[id]?.classId})`,
      });
      seenRules.set('the AI chose an illegal action', (seenRules.get('the AI chose an illegal action') ?? 0) + 1);
      break;
    }
    try {
      combat.apply(action);
    } catch (err) {
      return { mutations: label, stalled: false, error: `apply ${JSON.stringify(action)}: ${String(err)}` };
    }
    check(combat.state, seed, JSON.stringify(action));
  }
  return { mutations: label, stalled: !combat.winner() };
}

// --- run ------------------------------------------------------------------

console.log(`Fuzzing ${FIGHTS} fights from seed ${SEED0}…\n`);
const errors: Array<{ seed: number; error: string; mutations: string }> = [];
const stalls: Array<{ seed: number; mutations: string }> = [];
for (let i = 0; i < FIGHTS; i++) {
  const seed = SEED0 + i;
  const out = runFight(seed);
  if (out.error) errors.push({ seed, error: out.error, mutations: out.mutations });
  if (out.stalled) stalls.push({ seed, mutations: out.mutations });
  if (VERBOSE) console.log(`  seed ${seed}: ${out.mutations}${out.error ? ' — ERROR' : out.stalled ? ' — STALLED' : ''}`);
}

console.log(`=== ${FIGHTS} fights ===`);
if (errors.length) {
  console.log(`\n⚠ ${errors.length} threw:`);
  const byMsg = new Map<string, { seed: number; mutations: string }>();
  for (const e of errors) {
    const key = e.error.slice(0, 120);
    if (!byMsg.has(key)) byMsg.set(key, { seed: e.seed, mutations: e.mutations });
  }
  for (const [msg, where] of byMsg) {
    console.log(`   seed ${where.seed}  ${msg}`);
    console.log(`      party: ${where.mutations}`);
  }
}
if (stalls.length) {
  console.log(`\n⚠ ${stalls.length} never ended (${MAX_DECISIONS} decisions):`);
  for (const s of stalls.slice(0, 5)) console.log(`   seed ${s.seed}  ${s.mutations}`);
}
if (seenRules.size) {
  console.log(`\n⚠ invariants broken:`);
  for (const [rule, n] of [...seenRules.entries()].sort((a, b) => b[1] - a[1])) {
    const first = violations.find((v) => v.rule === rule)!;
    console.log(`   ${String(n).padStart(6)}×  ${rule}`);
    console.log(`            first: seed ${first.seed}, ${first.detail}`);
    console.log(`            after: ${first.action.slice(0, 110)}`);
  }
}
if (!errors.length && !stalls.length && !seenRules.size) console.log('\nno exceptions, no stalls, no invariant broken.');
