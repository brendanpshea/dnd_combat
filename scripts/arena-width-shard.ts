/**
 * One worker for scripts/arena-width.ts: fights its slice of the seeds and
 * prints a bit per fight. See that file for what is being measured and why.
 */
import { generateArenaMap, type LayoutName } from '../src/arena/map.js';
import { generateEncounter, type EncounterBrief } from '../src/arena/encounter.js';
import { evenBudgetFor, memberCapFor, maxCountFor } from '../src/arena/run.js';
import { deployFoes, deployPositions, assignByRole, type DeployPattern } from '../src/arena/deploy.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, canThreatenAtRange } from '../src/data/monsters.js';
import { parseMap } from '../src/data/maps.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import { seedRng } from '../src/engine/rng.js';
import type { Combatant } from '../src/engine/types.js';

/*
 * Everything comes in on argv rather than by importing the parent. The parent
 * is a script with top-level work in it, so importing it from here would run
 * the whole sweep inside every worker — which is exactly what happened: the
 * first version printed its banner from each shard and then tried to parse
 * that banner as the shard's JSON.
 */
const nums = (s: string | undefined) => (s ?? '').split(',').filter(Boolean).map(Number);
const seeds = nums(process.argv[2]);
const widths = nums(process.argv[3]);
const LEVELS = nums(process.argv[4]);
const DEPTHS = nums(process.argv[5]);
const DEPLOY = process.argv[6] ?? 'mixed';
const BRIEF = (process.argv[7] ?? 'mixed') as EncounterBrief;
const LAYOUT = process.argv[8] ?? 'auto';
/** Deal the sheltered cells to the shooters (see `assignByRole`). */
const ROLES = process.argv[9] === 'roles';

/** The four the game opens with, which is what every other measurement uses. */
const CLASSES = ['fighter', 'wizard', 'cleric', 'rogue'] as const;
/**
 * The shipped formation, scaled.
 *
 * `buildCampaignParty` files them at 1, 2, 4 and 6 of eight. Spreading them
 * proportionally keeps the same shape on a wider board rather than leaving the
 * party huddled in the left quarter of it — which would make a wide board look
 * bad for a reason that is about this script, not about the board.
 */
const filesFor = (width: number) => [1, 2, 4, 6].map((f) => Math.min(width - 1, Math.round((f * width) / 8)));

function party(level: number, width: number): Combatant[] {
  const files = filesFor(width);
  return CLASSES.map((classId, i) => ({
    ...buildCharacter({ classId, team: 'team1', level, position: { x: files[i]!, y: 0 } }),
    id: `h${i}`,
  }));
}

/**
 * One fight, twice: played properly, and with the party unable to take a step.
 *
 * Both runs are built from the same seed, so they are the same map, the same
 * monsters in the same cells and the same dice — the only difference is
 * whether the party may move.
 */
export interface FightRead {
  won: boolean;
  /** Rounds the fight lasted — the walking cost shows up here before anywhere else. */
  rounds: number;
  /**
   * The round the LINES MEET — the first time anyone stands next to an enemy.
   *
   * Not the first attack: on a board 12 rows deep every shooter is in range
   * from its starting cell, so "first blow" is round 1 at every width and says
   * nothing. What a bigger board threatens to add is walking, and walking is
   * the gap between the first shot and the first sword.
   */
  contact: number;
}

function fight(seed: number, level: number, width: number, depth: number, standStill: boolean): FightRead {
  const rng = seedRng(seed * 2654435761 + level * 40503 + width * 2246822519 + depth * 374761393);
  const e = generateEncounter({
    budget: evenBudgetFor(level), maxMemberXp: memberCapFor(level),
    maxCount: maxCountFor(level), partyLevel: level, brief: BRIEF,
  }, rng);
  const m = generateArenaMap(
    LAYOUT === 'auto' ? { width, height: depth } : { width, height: depth, layout: LAYOUT as LayoutName },
    e.state);
  // Deploy against the same grid the combat will build, so the monsters stand
  // on the cells the map validator vouched for.
  const grid = parseMap(m.value.map);
  const deploySeed = (seed ^ (width * 2654435761)) >>> 0;
  const ranged = ROLES ? e.value.members.map(canThreatenAtRange) : undefined;
  const spots = DEPLOY === 'mixed'
    ? deployFoes(grid, e.value.members.length, deploySeed, ranged)
    : (() => {
        const raw = deployPositions(grid, e.value.members.length, DEPLOY as DeployPattern, deploySeed).value;
        return { value: { positions: ranged ? assignByRole(grid, raw, ranged) : raw } };
      })();
  const foes = e.value.members.map((id, i) =>
    buildMonster(id, 'team2', spots.value.positions[i] ?? { x: 0, y: grid.height - 1 }, String(i + 1)));

  const combat = new Combat({
    map: m.value.map,
    combatants: [...party(level, width), ...foes],
    seed: seed * 31 + level * 101 + width * 7 + depth * 13,
  });

  let steps = 0, rounds = 0, contact = 0;
  while (!combat.state.winner && steps++ < 600) {
    const id = combat.activeId!;
    const actor = combat.state.combatants[id]!;
    // Spend the movement before every decision, not once per turn: a Dash
    // would otherwise hand it straight back, and the party would step after all.
    if (standStill && actor.team === 'team1') actor.turn.movementUsed = actor.turn.movementMax;
    for (const ev of combat.apply(chooseAction(combat.state, id))) {
      if (ev.type === 'roundStarted') rounds++;
    }
    if (!contact) {
      const live = Object.values(combat.state.combatants).filter((c) => c.alive);
      const met = live.some((a) => a.team === 'team1' && live.some((b) => b.team !== 'team1'
        && Math.max(Math.abs(a.position.x - b.position.x), Math.abs(a.position.y - b.position.y)) <= 1));
      if (met) contact = Math.max(1, rounds);
    }
  }
  return { won: combat.state.winner === 'team1', rounds, contact: contact || rounds };
}

const out: Record<string, { plays: string; stands: string; rounds: number[]; contact: number[] }> = {};
for (const width of widths) {
  for (const depth of DEPTHS) {
    for (const level of LEVELS) {
      let plays = '', stands = '';
      const rounds: number[] = [], contact: number[] = [];
      for (const seed of seeds) {
        const a = fight(seed, level, width, depth, false);
        plays += a.won ? '1' : '0';
        rounds.push(a.rounds);
        contact.push(a.contact);
        stands += fight(seed, level, width, depth, true).won ? '1' : '0';
      }
      out[`${width}|${depth}|${level}`] = { plays, stands, rounds, contact };
    }
  }
}
process.stdout.write(JSON.stringify(out));
