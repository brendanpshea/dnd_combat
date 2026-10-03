/**
 * The balance table: a simulated win rate for every fight the trilogy's route
 * transcripts meet, at the level each route really meets it.
 *
 *   npm run balance               # write docs/balance.md (sharded over the cores)
 *   npm run balance -- --serial   # the same, in one process
 *
 * WHY
 *
 * Encounter comments carry hand-measured win rates ("73% at 4th"), each taken
 * once, at the level its author believed the chapter meets the fight, on
 * whatever party and seed count were to hand. Levels come from fights now, so
 * that belief drifts every time a roster or a chapter changes. This replays
 * the transcript routes (scripts/transcripts.ts, `routeBattles`) to read off
 * the level each route really carries to each door, and fights it out.
 *
 * HOW A FIGHT IS MEASURED
 *
 * A fresh `newCampaign(23)` party (starting gear, full resources, no
 * companions) at the level, against the encounter's roster, on the scene's
 * map, placed as the app places them (party on the top rank, foes on the
 * bottom one), with the scene's surprise. Greedy AI on both sides, battle
 * seeds 1..SEEDS; a fight that has not ended in MAX_STEPS actions counts as a
 * loss. A board drawn for a dungeon room is drawn again for each seed, so its
 * rate is over boards as well as dice. Each (encounter, board, level,
 * surprise) is fought once, however many routes meet it there.
 *
 * What it does not see: wounds and spent slots carried in from earlier fights,
 * companions, shopping and treasure, a player who plays better (or worse) than
 * greedy. So a row is "how hard is this fight for a rested party of this
 * level", which is the number the encounter comments have always quoted.
 */
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { routeBattles, type BattleMeeting } from './transcripts.js';
import { ROOM_MAP_REF, type Module } from '../src/adventure/types.js';
import { moduleById } from '../src/data/modules/index.js';
import { ENCOUNTERS, buildEncounter } from '../src/data/encounters.js';
import { MAPS, type MapData } from '../src/data/maps.js';
import { generateArenaMap } from '../src/arena/map.js';
import { newCampaign, buildCampaignParty, LEVEL_XP } from '../src/campaign/campaign.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { TeamId } from '../src/engine/types.js';

const SEEDS = 50;
const PARTY_SEED = 23;
const MAX_STEPS = 3000;
const LOW = 0.6;
const CHAPTERS = ['hollow-road', 'sunken-barrows', 'wyrmcalling'];
const OUT = fileURLToPath(new URL('../docs/balance.md', import.meta.url));

type Surprise = 'party' | 'enemies' | undefined;

/** One (encounter, board, level, surprise) to fight SEEDS times. */
interface Job {
  key: string;
  encounterId: string;
  level: number;
  surprise?: 'party' | 'enemies';
  /** One board for a named map; one per seed (index seed-1) for a room. */
  boards: MapData[];
}

interface Tally { key: string; wins: number; stalls: number; fights: number }

// --- Fighting ---------------------------------------------------------------

function fight(job: Job, seed: number): 'won' | 'lost' | 'stalled' {
  const board = job.boards.length === 1 ? job.boards[0]! : job.boards[seed - 1]!;
  const c = newCampaign(PARTY_SEED);
  c.xp = LEVEL_XP[job.level - 1]!;
  const combat = new Combat({
    seed,
    map: board,
    combatants: [...buildCampaignParty(c), ...buildEncounter(job.encounterId, 'team2', board.rows.length - 1)],
    ...(job.surprise ? { surprisedTeam: (job.surprise === 'enemies' ? 'team2' : 'team1') as TeamId } : {}),
  });
  let n = 0;
  while (!combat.isOver() && n++ < MAX_STEPS) combat.apply(chooseAction(combat.state, combat.activeId));
  if (!combat.isOver()) return 'stalled';
  return combat.winner() === 'team1' ? 'won' : 'lost';
}

/** Fight every job on the seeds this shard owns (seed s goes to shard (s-1) % of). */
function runShard(jobs: Job[], shard: number, of: number): Tally[] {
  return jobs.map((job) => {
    const t: Tally = { key: job.key, wins: 0, stalls: 0, fights: 0 };
    for (let s = 1 + shard; s <= SEEDS; s += of) {
      const r = fight(job, s);
      t.fights++;
      if (r === 'won') t.wins++;
      if (r === 'stalled') t.stalls++;
    }
    return t;
  });
}

function spawnShard(jobs: Job[], shard: number, of: number): Promise<Tally[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', fileURLToPath(import.meta.url), '--shard', String(shard), String(of)],
      { stdio: ['pipe', 'pipe', 'inherit'] },
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(JSON.parse(out) as Tally[]) : reject(new Error(`shard ${shard} exited ${code}`))));
    child.stdin.end(JSON.stringify(jobs));
  });
}

async function runJobs(jobs: Job[], serial: boolean): Promise<Map<string, Tally>> {
  const of = serial ? 1 : Math.max(1, Math.min(cpus().length, SEEDS));
  const parts = of === 1 ? [runShard(jobs, 0, 1)] : await Promise.all(Array.from({ length: of }, (_, i) => spawnShard(jobs, i, of)));
  const total = new Map<string, Tally>();
  for (const part of parts) {
    for (const t of part) {
      const acc = total.get(t.key) ?? { key: t.key, wins: 0, stalls: 0, fights: 0 };
      acc.wins += t.wins; acc.stalls += t.stalls; acc.fights += t.fights;
      total.set(t.key, acc);
    }
  }
  return total;
}

// --- What to fight ------------------------------------------------------------

/** A scene's board, as a key plus a seed → board function. */
interface Board { key: string; label: string; draw: (seed: number) => MapData }

function namedBoard(mapId: string): Board {
  const map = MAPS[mapId];
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  return { key: mapId, label: `\`${mapId}\``, draw: () => map };
}

function meetingBoard(m: BattleMeeting): Board {
  if (m.mapId !== ROOM_MAP_REF) return namedBoard(m.mapId);
  const first = m.board(1);
  return { key: `${ROOM_MAP_REF}:${first.name}:${first.rows.length}`, label: `room (${first.name})`, draw: m.board };
}

/**
 * A room board for a fight no route meets: drawn as `battleMap` draws one for
 * a party standing in a room (not a corridor) of the dungeon that names the
 * fight — the closest the table can get without a party standing there.
 */
function unmetRoomBoard(module: Module, sceneId: string): Board {
  const dungeons = Object.values(module.scenes).filter((s) => s.kind === 'dungeon');
  const home = dungeons.find((s) => JSON.stringify(s).includes(`"${sceneId}"`)) ?? dungeons[0];
  if (!home || home.kind !== 'dungeon') throw new Error(`No dungeon for room fight '${sceneId}'`);
  const d = home.dungeon;
  return {
    key: `${ROOM_MAP_REF}:${d.title}:10`, label: `room (${d.title})`,
    draw: (seed) => ({ ...generateArenaMap({ theme: d.theme ?? 'stone', height: 10 }, seed).value.map, id: `room-${sceneId}`, name: d.title }),
  };
}

const jobs = new Map<string, Job>();
function jobFor(encounterId: string, board: Board, level: number, surprise: Surprise): string {
  const key = `${encounterId}|${board.key}|L${level}|${surprise ?? '-'}`;
  if (!jobs.has(key)) {
    const named = !board.key.startsWith(ROOM_MAP_REF);
    jobs.set(key, {
      key, encounterId, level, ...(surprise ? { surprise } : {}),
      boards: named ? [board.draw(1)] : Array.from({ length: SEEDS }, (_, i) => board.draw(i + 1)),
    });
  }
  return key;
}

// --- The table ----------------------------------------------------------------

const pct = (t: Tally | undefined): string => (t ? `${Math.round((100 * t.wins) / t.fights)}%${t.stalls ? ` (${t.stalls} stalled)` : ''}` : '—');
const rate = (t: Tally | undefined): number => (t ? t.wins / t.fights : 1);
const encName = (id: string): string => ENCOUNTERS[id]?.name ?? id;
const surpriseLabel = (s: Surprise): string => (s === 'party' ? 'party surprised' : s === 'enemies' ? 'foes surprised' : '—');

function flags(encounterId: string, level: number, t: Tally | undefined): string[] {
  const out: string[] = [];
  if (t && rate(t) < LOW) out.push('**LOW**');
  const suggested = ENCOUNTERS[encounterId]?.suggestedLevel ?? 0;
  if (level < suggested - 1) out.push(`**UNDER** (sugg. ${suggested})`);
  return out;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const serial = process.argv.includes('--serial');
  const { routes, meetings } = routeBattles();
  const routeOrder = new Map(routes.map((r, i) => [r.id, i]));

  // Route rows: one per door each route stood at.
  const routeRows = meetings.map((m) => {
    const board = meetingBoard(m);
    return { m, board, key: jobFor(m.encounterId, board, m.level, m.surprise) };
  });

  // Likely-level rows: every battle scene of each chapter, grouped by what is
  // fought (encounter, board, surprise), at the lowest and highest level a
  // route meets that encounter in that chapter — or, for an encounter no
  // route meets, the levels the routes hold at their last fight of the chapter.
  interface Likely {
    chapter: string; scenes: string[]; encounterId: string; board: Board; surprise: Surprise;
    lo: number; hi: number; basis: string; loKey: string; hiKey: string;
  }
  const likely: Likely[] = [];
  for (const chapter of CHAPTERS) {
    const module = moduleById(chapter);
    if (!module) throw new Error(`Unknown module ${chapter}`);
    const here = meetings.filter((m) => m.chapterId === chapter);
    const lastLevels = routes.flatMap((r) => {
      const mine = here.filter((m) => m.routeId === r.id);
      return mine.length ? [mine[mine.length - 1]!.level] : [];
    });
    const groups = new Map<string, Likely>();
    for (const scene of Object.values(module.scenes)) {
      if (scene.kind !== 'battle') continue;
      const met = here.filter((m) => m.encounterId === scene.encounterId);
      const own = here.find((m) => m.sceneId === scene.id);
      const board = scene.mapId !== ROOM_MAP_REF ? namedBoard(scene.mapId)
        : own ? meetingBoard(own)
        : (() => { const any = met.find((m) => m.mapId === ROOM_MAP_REF); return any ? meetingBoard(any) : unmetRoomBoard(module, scene.id); })();
      const levels = met.length ? met.map((m) => m.level) : lastLevels;
      const gk = `${scene.encounterId}|${board.key}|${scene.surprise ?? '-'}`;
      const g = groups.get(gk);
      if (g) { g.scenes.push(scene.id); continue; }
      const lo = Math.min(...levels), hi = Math.max(...levels);
      groups.set(gk, {
        chapter, scenes: [scene.id], encounterId: scene.encounterId, board, surprise: scene.surprise,
        lo, hi, basis: met.length ? `routes ${lo === hi ? lo : `${lo}–${hi}`}` : `not met; late chapter ${lo === hi ? lo : `${lo}–${hi}`}`,
        loKey: jobFor(scene.encounterId, board, lo, scene.surprise), hiKey: jobFor(scene.encounterId, board, hi, scene.surprise),
      });
    }
    likely.push(...groups.values());
  }

  const allJobs = [...jobs.values()];
  console.log(`${meetings.length} doors on ${routes.length} routes; ${allJobs.length} distinct fights × ${SEEDS} seeds${serial ? ' (serial)' : ''}...`);
  const tallies = await runJobs(allJobs, serial);

  const out: string[] = [];
  out.push('# Balance table', '');
  out.push('> Generated by `npm run balance` (scripts/balance.ts). Do not edit by hand — regenerate when encounters or chapters change.', '');
  out.push('**Method.** The seven route transcripts (`scripts/transcripts.ts`) are replayed to read, for every fight a route stands at the door of, the party\'s XP and level on arrival. Each fight is then simulated for a **fresh party at that level**: ' +
    `the \`newCampaign(${PARTY_SEED})\` company (starting gear, full hit points and slots, no companions), the encounter's roster, the scene's map and surprise, placed as the app places them, ` +
    `**greedy AI on both sides**, battle seeds **1–${SEEDS}** (a fight still going after ${MAX_STEPS} actions counts as a loss and is listed as stalled). ` +
    'A board drawn for a dungeon room is drawn again for each seed. Each (encounter, board, level, surprise) is fought once and shared by every row that meets it.', '');
  out.push(`**Flags.** **LOW**: under ${Math.round(LOW * 100)}% won. **UNDER**: met more than one level below the encounter's \`suggestedLevel\`. ` +
    `At ${SEEDS} seeds a rate is good to about ±${Math.round(100 * 1.96 * Math.sqrt(0.25 / SEEDS))} points (95%, worst case); read differences smaller than that as noise.`, '');
  out.push('**Not modelled:** wounds and spent resources carried in from earlier fights, companions, treasure and shopping, a player better or worse than greedy. ' +
    '**How** says what the route did at the door: fought it, talked it down (the rate is then the price of the parley failing), fell back and never returned, or passed it by another way ("not fought").', '');

  // Everything flagged, up front.
  const flagged = new Map<string, string>();
  for (const r of routeRows) {
    const f = flags(r.m.encounterId, r.m.level, tallies.get(r.key));
    if (f.length) flagged.set(r.key, `- \`${r.m.encounterId}\` on ${r.board.label} at level ${r.m.level}${r.m.surprise ? `, ${surpriseLabel(r.m.surprise)}` : ''}: ${pct(tallies.get(r.key))} ${f.join(' ')} — met by ${[...new Set(routeRows.filter((x) => x.key === r.key).map((x) => x.m.routeId))].join(', ')}`);
  }
  for (const l of likely) {
    for (const [lvl, key] of [[l.lo, l.loKey], [l.hi, l.hiKey]] as const) {
      const f = flags(l.encounterId, lvl, tallies.get(key));
      if (f.length && !flagged.has(key)) flagged.set(key, `- \`${l.encounterId}\` on ${l.board.label} at level ${lvl}${l.surprise ? `, ${surpriseLabel(l.surprise)}` : ''}: ${pct(tallies.get(key))} ${f.join(' ')} — ${l.basis} (${l.scenes.map((s) => `\`${s}\``).join(', ')})`);
    }
  }
  out.push('## Flagged', '');
  out.push(...(flagged.size ? [...flagged.values()] : ['_Nothing flagged._']), '');

  for (const chapter of CHAPTERS) {
    const module = moduleById(chapter)!;
    out.push(`## ${module.title} \`${chapter}\``, '');
    out.push('### Fights on the routes', '');
    out.push('| Route | Scene | Encounter | Map | Surprise | Arrives at | Sugg. | Won | How | Flags |');
    out.push('|---|---|---|---|---|---|---|---|---|---|');
    const rows = routeRows.filter((r) => r.m.chapterId === chapter)
      .sort((a, b) => routeOrder.get(a.m.routeId)! - routeOrder.get(b.m.routeId)!);
    for (const { m, board, key } of rows) {
      const t = tallies.get(key);
      const how = m.how === 'fought' && m.losses ? `fought (lost ${m.losses} first)` : m.how;
      out.push(`| ${m.routeId} | \`${m.sceneId}\` | ${encName(m.encounterId)} \`${m.encounterId}\` | ${board.label} | ${surpriseLabel(m.surprise)} | ${m.level} (${m.xp} XP) | ${ENCOUNTERS[m.encounterId]?.suggestedLevel ?? '?'} | ${pct(t)} | ${how} | ${flags(m.encounterId, m.level, t).join(' ')} |`);
    }
    out.push('');
    out.push('### Every fight in the chapter, at the levels it is met', '');
    out.push('Low and high: the lowest and highest level any route arrives at this encounter in this chapter (an encounter no route meets: the levels the routes hold at their last fight here).', '');
    out.push('| Scene(s) | Encounter | Map | Surprise | Sugg. | Levels | Won at low | Won at high | Flags |');
    out.push('|---|---|---|---|---|---|---|---|---|');
    for (const l of likely.filter((x) => x.chapter === chapter)) {
      const tLo = tallies.get(l.loKey), tHi = tallies.get(l.hiKey);
      const f = [...new Set([...flags(l.encounterId, l.lo, tLo), ...flags(l.encounterId, l.hi, tHi)])];
      out.push(`| ${l.scenes.map((s) => `\`${s}\``).join(', ')} | ${encName(l.encounterId)} \`${l.encounterId}\` | ${l.board.label} | ${surpriseLabel(l.surprise)} | ${ENCOUNTERS[l.encounterId]?.suggestedLevel ?? '?'} | ${l.basis} | ${pct(tLo)} | ${l.lo === l.hi ? '″' : pct(tHi)} | ${f.join(' ')} |`);
    }
    out.push('');
  }

  writeFileSync(OUT, out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  console.log(`docs/balance.md: ${routeRows.length} route rows, ${likely.length} scene rows, ${flagged.size} flagged — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

async function shardMain(): Promise<void> {
  const i = process.argv.indexOf('--shard');
  const shard = Number(process.argv[i + 1]), of = Number(process.argv[i + 2]);
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  process.stdout.write(JSON.stringify(runShard(JSON.parse(input) as Job[], shard, of)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await (process.argv.includes('--shard') ? shardMain() : main());
}
