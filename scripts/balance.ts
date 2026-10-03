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
 * WEAR
 *
 * A fresh party overstates how easy chained fights are, so every fight is
 * fought three ways, by how much of the day the party has already spent:
 *
 * Fresh fights take seeds 1..SEEDS; worn ones 1..WORN_SEEDS (they are only
 * read against the fresh rate, and the run stays near a minute).
 *
 *   fresh   100% HP, every spell slot and rest-scoped feature use.
 *   light    80% HP, ⌊75%⌋ of each slot tier and each rest-scoped pool.
 *   heavy    60% HP, ⌊50%⌋ of each slot tier and each rest-scoped pool.
 *
 * Wear goes in through the campaign's own resources (`resources.hp`, `.slots`,
 * `.featureUses`), the path a saved, hurt party takes into a fight, so the
 * engine decides what each pool means (encounter-scoped pools still refill;
 * hit dice, wands and potions are left full). The table shows:
 *
 *   Fresh     the fresh rate (what the encounter comments have always quoted).
 *   Worn      the heavy rate — the same fight met late in a long day.
 *   Arrival   the route's own estimate: wear set from the fights the route has
 *             fought since its last long rest (camp, a rest scene, the start of
 *             a chapter) when it reaches the door — 0 → fresh, 1 → light,
 *             2+ → heavy (`BattleMeeting.fightsSinceRest`).
 *
 * TARGET
 *
 * A main-path fight (one a route actually fought) should win roughly 70–90%
 * fresh; a boss or finale (a scene with a bonus-trophy `loot`, or one whose win
 * leads straight to a victory ending) 60–80%. Then the worn column shows real
 * danger. Each chapter gets a count of its main-path fights below, in and
 * above the band, fresh, on arrival and worn.
 *
 * What it does not see: companions, shopping and treasure, a player who plays
 * better (or worse) than greedy, and the exact wounds a route carries (wear is
 * a model, not a replay).
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
/** Worn fights (light and heavy) take fewer seeds, to keep the run near a minute. */
const WORN_SEEDS = 30;
const PARTY_SEED = 23;
const MAX_STEPS = 3000;
const LOW = 0.6;
const EASY = 0.97;
const BAND = { fight: [0.7, 0.9], boss: [0.6, 0.8] } as const;
const CHAPTERS = ['hollow-road', 'sunken-barrows', 'wyrmcalling'];
const OUT = fileURLToPath(new URL('../docs/balance.md', import.meta.url));

type Surprise = 'party' | 'enemies' | undefined;

type Wear = 'fresh' | 'light' | 'heavy';
/** Fraction of max HP, and of each slot tier / rest-scoped pool, kept. */
const WEAR: Record<Wear, { hp: number; keep: number }> = {
  fresh: { hp: 1, keep: 1 },
  light: { hp: 0.8, keep: 0.75 },
  heavy: { hp: 0.6, keep: 0.5 },
};
const wearOnArrival = (fightsSinceRest: number): Wear => (fightsSinceRest <= 0 ? 'fresh' : fightsSinceRest === 1 ? 'light' : 'heavy');

/** One (encounter, board, level, surprise) to fight SEEDS times. */
interface Job {
  key: string;
  encounterId: string;
  level: number;
  surprise?: 'party' | 'enemies';
  wear: Wear;
  /** One board for a named map; one per seed (index seed-1) for a room. */
  boards: MapData[];
}

interface Tally { key: string; wins: number; stalls: number; fights: number }

// --- Fighting ---------------------------------------------------------------

function fight(job: Job, seed: number): 'won' | 'lost' | 'stalled' {
  const board = job.boards.length === 1 ? job.boards[0]! : job.boards[seed - 1]!;
  const c = newCampaign(PARTY_SEED);
  c.xp = LEVEL_XP[job.level - 1]!;
  if (job.wear !== 'fresh') {
    // Build once fresh to read the maxima, then write the worn resources back
    // the way a saved party carries them, and build again.
    const { hp, keep } = WEAR[job.wear];
    buildCampaignParty(c).forEach((fresh, i) => {
      const ch = c.characters[i]!;
      const featureUses = Object.fromEntries(Object.entries(fresh.featureUses).map(([id, p]) => [id, Math.floor(p.max * keep)]));
      ch.resources = {
        ...ch.resources,
        hp: Math.max(1, Math.round(fresh.maxHp * hp)),
        ...(fresh.spellSlots.length ? { slots: fresh.spellSlots.map((p) => Math.floor(p.max * keep)) } : {}),
        ...(Object.keys(featureUses).length ? { featureUses } : {}),
      };
    });
  }
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
    const seeds = job.wear === 'fresh' ? SEEDS : WORN_SEEDS;
    for (let s = 1 + shard; s <= seeds; s += of) {
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
function jobFor(encounterId: string, board: Board, level: number, surprise: Surprise, wear: Wear = 'fresh'): string {
  const key = `${encounterId}|${board.key}|L${level}|${surprise ?? '-'}|${wear}`;
  if (!jobs.has(key)) {
    const named = !board.key.startsWith(ROOM_MAP_REF);
    jobs.set(key, {
      key, encounterId, level, wear, ...(surprise ? { surprise } : {}),
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
const bandOf = (boss: boolean): readonly [number, number] => (boss ? BAND.boss : BAND.fight);
const bandLabel = (b: readonly [number, number]): string => `${Math.round(b[0] * 100)}–${Math.round(b[1] * 100)}%`;
type Place = 'below' | 'in' | 'above';
function placeOf(t: Tally | undefined, boss: boolean): Place {
  const [lo, hi] = bandOf(boss), r = rate(t);
  return r < lo ? 'below' : r > hi ? 'above' : 'in';
}

/**
 * A boss or finale: a scene paying a bonus trophy (`loot.bonusTier`), or one
 * whose win reaches a victory ending through at most two non-battle scenes.
 */
function isBoss(module: Module, sceneId: string): boolean {
  const scene = module.scenes[sceneId];
  if (!scene || scene.kind !== 'battle') return false;
  if (scene.loot && scene.loot.bonusTier) return true;
  const tos = (sc: unknown): string[] => [...JSON.stringify(sc).matchAll(/"to":"([^"]+)"/g)].map((x) => x[1]!);
  let frontier = [scene.onWin.to];
  const seen = new Set<string>();
  for (let depth = 0; depth < 3; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      const sc = module.scenes[id];
      if (sc?.kind === 'ending' && sc.outcome === 'victory') return true;
      if (sc && sc.kind !== 'battle' && sc.kind !== 'ending') next.push(...tos(sc));
    }
    frontier = next;
  }
  return false;
}

/** `mainPath`: some route fought this fight (EASY is only read there). */
function flags(encounterId: string, level: number, t: Tally | undefined, mainPath: boolean): string[] {
  const out: string[] = [];
  if (t && rate(t) < LOW) out.push('**LOW**');
  if (t && mainPath && rate(t) >= EASY) out.push('**EASY**');
  const suggested = ENCOUNTERS[encounterId]?.suggestedLevel ?? 0;
  if (level < suggested - 1) out.push(`**UNDER** (sugg. ${suggested})`);
  if (suggested && level >= suggested + 2) out.push(`**OVER** (sugg. ${suggested})`);
  return out;
}
const isHard = (f: string[]): boolean => f.some((x) => x.startsWith('**LOW') || x.startsWith('**UNDER'));
const isSoft = (f: string[]): boolean => f.some((x) => x.startsWith('**EASY') || x.startsWith('**OVER'));

async function main(): Promise<void> {
  const t0 = Date.now();
  const serial = process.argv.includes('--serial');
  const { routes, meetings } = routeBattles();
  const routeOrder = new Map(routes.map((r, i) => [r.id, i]));
  const modules = new Map(CHAPTERS.map((id) => {
    const module = moduleById(id);
    if (!module) throw new Error(`Unknown module ${id}`);
    return [id, module] as const;
  }));
  const bossOf = (chapter: string, sceneId: string): boolean => isBoss(modules.get(chapter)!, sceneId);

  // Route rows: one per door each route stood at, fresh, worn and on arrival.
  const routeRows = meetings.map((m) => {
    const board = meetingBoard(m);
    const arrival = wearOnArrival(m.fightsSinceRest);
    return {
      m, board, boss: bossOf(m.chapterId, m.sceneId), arrival,
      key: jobFor(m.encounterId, board, m.level, m.surprise),
      wornKey: jobFor(m.encounterId, board, m.level, m.surprise, 'heavy'),
      arrKey: jobFor(m.encounterId, board, m.level, m.surprise, arrival),
    };
  });
  type RouteRow = typeof routeRows[number];

  // Likely-level rows: every battle scene of each chapter, grouped by what is
  // fought (encounter, board, surprise), at the lowest and highest level a
  // route meets that encounter in that chapter — or, for an encounter no
  // route meets, the levels the routes hold at their last fight of the chapter.
  interface Likely {
    chapter: string; scenes: string[]; encounterId: string; board: Board; surprise: Surprise;
    lo: number; hi: number; basis: string; loKey: string; hiKey: string; loWorn: string; hiWorn: string;
    mainPath: boolean; boss: boolean;
  }
  const likely: Likely[] = [];
  for (const chapter of CHAPTERS) {
    const module = modules.get(chapter)!;
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
      const fought = here.some((m) => m.sceneId === scene.id && m.how === 'fought');
      const boss = isBoss(module, scene.id);
      const board = scene.mapId !== ROOM_MAP_REF ? namedBoard(scene.mapId)
        : own ? meetingBoard(own)
        : (() => { const any = met.find((m) => m.mapId === ROOM_MAP_REF); return any ? meetingBoard(any) : unmetRoomBoard(module, scene.id); })();
      const levels = met.length ? met.map((m) => m.level) : lastLevels;
      const gk = `${scene.encounterId}|${board.key}|${scene.surprise ?? '-'}`;
      const g = groups.get(gk);
      if (g) { g.scenes.push(scene.id); g.mainPath ||= fought; g.boss ||= boss; continue; }
      const lo = Math.min(...levels), hi = Math.max(...levels);
      groups.set(gk, {
        chapter, scenes: [scene.id], encounterId: scene.encounterId, board, surprise: scene.surprise,
        lo, hi, basis: met.length ? `routes ${lo === hi ? lo : `${lo}–${hi}`}` : `not met; late chapter ${lo === hi ? lo : `${lo}–${hi}`}`,
        loKey: jobFor(scene.encounterId, board, lo, scene.surprise), hiKey: jobFor(scene.encounterId, board, hi, scene.surprise),
        loWorn: jobFor(scene.encounterId, board, lo, scene.surprise, 'heavy'), hiWorn: jobFor(scene.encounterId, board, hi, scene.surprise, 'heavy'),
        mainPath: fought, boss,
      });
    }
    likely.push(...groups.values());
  }

  const allJobs = [...jobs.values()];
  const byWear = (w: Wear): number => allJobs.filter((j) => j.wear === w).length;
  console.log(`${meetings.length} doors on ${routes.length} routes; ${allJobs.length} distinct fights (${byWear('fresh')} fresh, ${byWear('light')} light, ${byWear('heavy')} heavy) × ${SEEDS} seeds (worn ${WORN_SEEDS})${serial ? ' (serial)' : ''}...`);
  const tallies = await runJobs(allJobs, serial);

  // The main path, per chapter: each scene some route fought, read at the
  // lowest level any route fought it (the least-levelled route's fight).
  const mainPath = new Map<string, RouteRow[]>();
  for (const chapter of CHAPTERS) {
    const best = new Map<string, RouteRow>();
    for (const r of routeRows) {
      if (r.m.chapterId !== chapter || r.m.how !== 'fought') continue;
      const prev = best.get(r.m.sceneId);
      if (!prev || r.m.level < prev.m.level) best.set(r.m.sceneId, r);
    }
    mainPath.set(chapter, [...best.values()]);
  }
  const tally = (rows: RouteRow[], key: (r: RouteRow) => string): Record<Place, number> => {
    const n: Record<Place, number> = { below: 0, in: 0, above: 0 };
    for (const r of rows) n[placeOf(tallies.get(key(r)), r.boss)]++;
    return n;
  };
  const split = (n: Record<Place, number>): string => `${n.below} / ${n.in} / ${n.above}`;

  const out: string[] = [];
  out.push('# Balance table', '');
  out.push('> Generated by `npm run balance` (scripts/balance.ts). Do not edit by hand — regenerate when encounters or chapters change.', '');
  out.push('**Method.** The seven route transcripts (`scripts/transcripts.ts`) are replayed to read, for every fight a route stands at the door of, the party\'s XP and level on arrival, and how many fights it has fought since its last long rest. Each fight is then simulated for the party at that level: ' +
    `the \`newCampaign(${PARTY_SEED})\` company (starting gear, no companions), the encounter's roster, the scene's map and surprise, placed as the app places them, ` +
    `**greedy AI on both sides**, battle seeds **1–${SEEDS}** fresh and **1–${WORN_SEEDS}** worn (a fight still going after ${MAX_STEPS} actions counts as a loss and is listed as stalled). ` +
    'A board drawn for a dungeon room is drawn again for each seed. Each (encounter, board, level, surprise, wear) is fought once and shared by every row that meets it.', '');
  out.push('**Wear.** Each fight is fought by a party in one of three states, set through the campaign\'s own saved resources (so encounter-scoped pools still refill; hit dice, wands and potions stay full):', '');
  out.push('| Wear | HP | Spell slots (each tier) | Rest-scoped feature uses (each pool) |', '|---|---|---|---|');
  for (const w of ['fresh', 'light', 'heavy'] as const) out.push(`| ${w} | ${Math.round(WEAR[w].hp * 100)}% | ${w === 'fresh' ? 'all' : `⌊${Math.round(WEAR[w].keep * 100)}%⌋ of max`} | ${w === 'fresh' ? 'all' : `⌊${Math.round(WEAR[w].keep * 100)}%⌋ of max`} |`);
  out.push('');
  out.push('**Fresh** is a fully rested party (the number the encounter comments quote). **Worn** is the heavy state: the same fight met late in a long day. **Arrival** is the route\'s own estimate — wear set from the fights the route fought since its last long rest (camp, a rest scene, or the start of a chapter) when it reached the door: 0 → fresh, 1 → light, 2 or more → heavy; the count is shown beside it.', '');
  out.push(`**Target band.** A main-path fight (one a route fought) should win roughly **${bandLabel(BAND.fight)} fresh**; a **boss or finale** (★: a scene paying a bonus trophy, or one whose win leads straight to a victory ending) **${bandLabel(BAND.boss)}**. ` +
    'Fresh above the band means the worn column cannot show real danger. The summary counts each main-path scene once, at the lowest level any route fought it, against the same band fresh, on arrival and worn.', '');
  out.push(`**Flags.** **LOW**: under ${Math.round(LOW * 100)}% won fresh. **EASY**: ${Math.round(EASY * 100)}% or more won fresh, on a fight a route fought. **UNDER**: met more than one level below the encounter's \`suggestedLevel\`. **OVER**: met two or more levels above it. ` +
    `At ${SEEDS} seeds a rate is good to about ±${Math.round(100 * 1.96 * Math.sqrt(0.25 / SEEDS))} points (95%, worst case), at ${WORN_SEEDS} about ±${Math.round(100 * 1.96 * Math.sqrt(0.25 / WORN_SEEDS))}; read differences smaller than that as noise.`, '');
  out.push('**Not modelled:** companions, treasure and shopping, a player better or worse than greedy, the exact wounds a route carries (wear is a model, not a replay). ' +
    '**How** says what the route did at the door: fought it, talked it down (the rate is then the price of the parley failing), fell back and never returned, or passed it by another way ("not fought").', '');

  // Summary per chapter.
  out.push('## Against the target band', '');
  out.push('Main-path fights per chapter, counted **below / in / above** the band.', '');
  out.push('| Chapter | Main-path fights | Bosses | Fresh | Arrival | Worn | EASY | OVER |', '|---|---|---|---|---|---|---|---|');
  for (const chapter of CHAPTERS) {
    const rows = mainPath.get(chapter)!;
    const easy = rows.filter((r) => rate(tallies.get(r.key)) >= EASY).length;
    const over = rows.filter((r) => r.m.level >= (ENCOUNTERS[r.m.encounterId]?.suggestedLevel ?? 99) + 2).length;
    out.push(`| ${modules.get(chapter)!.title} | ${rows.length} | ${rows.filter((r) => r.boss).length} | ${split(tally(rows, (r) => r.key))} | ${split(tally(rows, (r) => r.arrKey))} | ${split(tally(rows, (r) => r.wornKey))} | ${easy} | ${over} |`);
  }
  out.push('');
  const over = (r: RouteRow): number => r.m.level - (ENCOUNTERS[r.m.encounterId]?.suggestedLevel ?? r.m.level);
  const easiest = [...mainPath.values()].flat()
    .map((r) => ({ r, gap: rate(tallies.get(r.key)) - bandOf(r.boss)[1], worn: rate(tallies.get(r.wornKey)) }))
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap || b.worn - a.worn || over(b.r) - over(a.r));
  out.push('### Furthest above the band', '');
  out.push('Main-path fights whose fresh rate clears the top of their band, easiest first (ties: by the worn rate, then by how far above \`suggestedLevel\` it is met).', '');
  out.push('| Chapter | Scene | Encounter | Map | Level (sugg.) | Fresh | Worn | Band |', '|---|---|---|---|---|---|---|---|');
  for (const { r } of easiest.slice(0, 20)) {
    out.push(`| ${r.m.chapterId} | \`${r.m.sceneId}\`${r.boss ? ' ★' : ''} | ${encName(r.m.encounterId)} \`${r.m.encounterId}\` | ${r.board.label} | ${r.m.level} (${ENCOUNTERS[r.m.encounterId]?.suggestedLevel ?? '?'}) | ${pct(tallies.get(r.key))} | ${pct(tallies.get(r.wornKey))} | ${bandLabel(bandOf(r.boss))} |`);
  }
  if (easiest.length > 20) out.push('', `…and ${easiest.length - 20} more (see the chapter tables).`);
  out.push('');

  // Everything flagged, up front: what is too hard (LOW, UNDER) in full; what
  // is too easy (EASY, OVER) as one line per fight.
  const hard = new Map<string, string>(), soft = new Map<string, string>();
  const note = (map: Map<string, string>, key: string, line: string): void => { if (!map.has(key)) map.set(key, line); };
  for (const r of routeRows) {
    const t = tallies.get(r.key);
    const f = flags(r.m.encounterId, r.m.level, t, r.m.how === 'fought');
    const where = `\`${r.m.encounterId}\` on ${r.board.label} at level ${r.m.level}${r.m.surprise ? `, ${surpriseLabel(r.m.surprise)}` : ''}`;
    const by = [...new Set(routeRows.filter((x) => x.key === r.key).map((x) => x.m.routeId))].join(', ');
    if (isHard(f)) note(hard, r.key, `- ${where}: ${pct(t)} fresh, ${pct(tallies.get(r.wornKey))} worn ${f.filter((x) => !isSoft([x])).join(' ')} — met by ${by}`);
    if (isSoft(f)) note(soft, r.key, `- ${where}: ${pct(t)} fresh, ${pct(tallies.get(r.wornKey))} worn ${f.filter((x) => isSoft([x])).join(' ')}`);
  }
  for (const l of likely) {
    for (const [lvl, key, worn] of [[l.lo, l.loKey, l.loWorn], [l.hi, l.hiKey, l.hiWorn]] as const) {
      const t = tallies.get(key);
      const f = flags(l.encounterId, lvl, t, l.mainPath);
      const where = `\`${l.encounterId}\` on ${l.board.label} at level ${lvl}${l.surprise ? `, ${surpriseLabel(l.surprise)}` : ''}`;
      if (isHard(f)) note(hard, key, `- ${where}: ${pct(t)} fresh, ${pct(tallies.get(worn))} worn ${f.filter((x) => !isSoft([x])).join(' ')} — ${l.basis} (${l.scenes.map((s) => `\`${s}\``).join(', ')})`);
      if (isSoft(f)) note(soft, key, `- ${where}: ${pct(t)} fresh, ${pct(tallies.get(worn))} worn ${f.filter((x) => isSoft([x])).join(' ')}`);
    }
  }
  out.push('## Flagged', '');
  out.push('### Too hard or under-levelled (LOW, UNDER)', '');
  out.push(...(hard.size ? [...hard.values()] : ['_Nothing flagged._']), '');
  out.push('### Too easy or over-levelled (EASY, OVER)', '');
  out.push(...(soft.size ? [...soft.values()] : ['_Nothing flagged._']), '');

  for (const chapter of CHAPTERS) {
    const module = modules.get(chapter)!;
    out.push(`## ${module.title} \`${chapter}\``, '');
    out.push('### Fights on the routes', '');
    out.push('★ boss or finale. **Arrival**: the rate at the wear the route carried to the door, with its fights since the last long rest.', '');
    out.push('| Route | Scene | Encounter | Map | Surprise | Arrives at | Sugg. | Fresh | Arrival | Worn | How | Flags |');
    out.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    const rows = routeRows.filter((r) => r.m.chapterId === chapter)
      .sort((a, b) => routeOrder.get(a.m.routeId)! - routeOrder.get(b.m.routeId)!);
    for (const { m, board, key, wornKey, arrKey, boss } of rows) {
      const t = tallies.get(key);
      const how = m.how === 'fought' && m.losses ? `fought (lost ${m.losses} first)` : m.how;
      out.push(`| ${m.routeId} | \`${m.sceneId}\`${boss ? ' ★' : ''} | ${encName(m.encounterId)} \`${m.encounterId}\` | ${board.label} | ${surpriseLabel(m.surprise)} | ${m.level} (${m.xp} XP) | ${ENCOUNTERS[m.encounterId]?.suggestedLevel ?? '?'} | ${pct(t)} | ${pct(tallies.get(arrKey))} (${m.fightsSinceRest}) | ${pct(tallies.get(wornKey))} | ${how} | ${flags(m.encounterId, m.level, t, m.how === 'fought').join(' ')} |`);
    }
    out.push('');
    out.push('### Every fight in the chapter, at the levels it is met', '');
    out.push('Low and high: the lowest and highest level any route arrives at this encounter in this chapter (an encounter no route meets: the levels the routes hold at their last fight here). Worn is the heavy state.', '');
    out.push('| Scene(s) | Encounter | Map | Surprise | Sugg. | Levels | Fresh at low | Worn at low | Fresh at high | Worn at high | Flags |');
    out.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const l of likely.filter((x) => x.chapter === chapter)) {
      const tLo = tallies.get(l.loKey), tHi = tallies.get(l.hiKey);
      const f = [...new Set([...flags(l.encounterId, l.lo, tLo, l.mainPath), ...flags(l.encounterId, l.hi, tHi, l.mainPath)])];
      const same = l.lo === l.hi;
      out.push(`| ${l.scenes.map((s) => `\`${s}\``).join(', ')}${l.boss ? ' ★' : ''} | ${encName(l.encounterId)} \`${l.encounterId}\` | ${l.board.label} | ${surpriseLabel(l.surprise)} | ${ENCOUNTERS[l.encounterId]?.suggestedLevel ?? '?'} | ${l.basis} | ${pct(tLo)} | ${pct(tallies.get(l.loWorn))} | ${same ? '″' : pct(tHi)} | ${same ? '″' : pct(tallies.get(l.hiWorn))} | ${f.join(' ')} |`);
    }
    out.push('');
  }

  writeFileSync(OUT, out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  console.log(`docs/balance.md: ${routeRows.length} route rows, ${likely.length} scene rows, ${hard.size} too hard, ${soft.size} too easy — ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const chapter of CHAPTERS) {
    const rows = mainPath.get(chapter)!;
    console.log(`  ${chapter}: ${rows.length} main-path fights, below/in/above — fresh ${split(tally(rows, (r) => r.key))}, arrival ${split(tally(rows, (r) => r.arrKey))}, worn ${split(tally(rows, (r) => r.wornKey))}`);
  }
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
