/**
 * Delves to order: the generator with its parameters exposed.
 *
 * `generateDelve` (dungeon-gen.ts) is the classic delve — one floor, one
 * shape, authored fights — and its ids are frozen, because saved runs rebuild
 * from them. This is the generator a delve is DESCRIBED to:
 *
 *   shape    how the floor is wired (see SHAPES below)
 *   rooms    how many rooms a floor has, or `size` for the classic ranges
 *   floors   how deep it goes: each floor is its own dungeon scene, its goal
 *            room the stairs down, and only the last goal ends the delve
 *   fights   'authored' draws from the written encounters for the level;
 *            'generated' builds each fight to a budget, as the arena does
 *   require  rooms that must be there — a named room, a set fight, a find, a
 *            place to sleep — and roughly where
 *
 * The same pipeline as the classic: the graph, then what is in it, then the
 * module, then the validator's proofs as the acceptance test — a candidate
 * that fails is thrown away and the next one drawn. What a spec asks for that
 * NO candidate could ever satisfy (a required room on a floor that does not
 * exist, more required rooms than the floor has) is refused up front by
 * `checkSpec`, rather than burning forty rerolls to say the same thing.
 *
 * Ids carry the spec itself (`delve2-<seed>-<base64url json>`), so a saved run
 * rebuilds exactly what it was played on.
 */
import type { Id } from '../engine/types.js';
import { seedRng } from '../engine/rng.js';
import { avoidedFightXP, encounterFor, encounterXP, generatedEncounterId } from '../data/encounters.js';
import { ITEMS } from '../data/items.js';
import { generateEncounter, type EncounterBrief } from '../arena/encounter.js';
import { evenBudgetFor, memberCapFor, maxCountFor } from '../arena/run.js';
import { LEVEL_XP, levelForXp, MAX_LEVEL } from '../campaign/campaign.js';
import { ALARM_ROUSED, type Dungeon, type DungeonLink, type DungeonRoom, type Module, type Scene, type RoomSize, type Effect, type Requirement, type SceneRef } from './types.js';
import { goalCost } from './dungeon.js';
import { validateModule } from './validate.js';
import { Dice, ROOMS, SIZE_ROOMS, encounterPools, type DelveOptions } from './dungeon-gen.js';
import { PIECES, type FightRole, type PieceWhere } from './delve-pieces.js';
import { beastName, bossName, personName, styleFor } from './names.js';
import { FACTIONS, ROUSED, canHold, factionsFor, type Faction } from '../data/factions.js';
import { ARCHETYPES, type RoomRole, type RoleWhere } from '../data/archetypes.js';
import { drawHistory, type History } from './delve-history.js';
import { adjustedXp } from '../arena/encounter.js';
import { MONSTER_XP } from '../data/monsters.js';

export type SpecTheme = keyof typeof ROOMS;
export const SPEC_THEMES = Object.keys(ROOMS) as SpecTheme[];

/**
 * How a floor is wired.
 *   classic  a main path with a lock, the key to one side, a one-way loop back
 *   spine    a long main path and little else: a gauntlet
 *   hub      one central chamber with spokes off it; the goal behind one
 *   ring     two ways round to the lock, so a fight can be walked around
 *   keys     two locks in a row, a key for each
 */
export type DelveShape = 'classic' | 'spine' | 'hub' | 'ring' | 'keys';
export const DELVE_SHAPES: DelveShape[] = ['classic', 'spine', 'hub', 'ring', 'keys'];

/** `vault`: the room past the last floor's goal (DelveSpec.vault), reached
 *  only by dealing with whoever holds the goal: where a story keeps what the
 *  party came to fetch. */
export type RoomPlace = 'goal' | 'main' | 'side' | 'beforeLock' | 'afterLock' | 'vault';

/** A room the delve must have. Everything left out is rolled as usual. */
export interface RequiredRoom {
  name?: string;
  /** Shown the first time the party walks in. */
  text?: string;
  /** A set fight (an encounter id), or a generated one to a brief. On a goal
   *  room this replaces the boss. */
  fight?: Id | { brief?: EncounterBrief; boss?: boolean };
  /** Roughly where. Default: anywhere that is not the entrance or the goal. */
  where?: RoomPlace;
  /** Which floor, 1-based. Default 1 (or the last floor, for a goal). */
  floor?: number;
  rest?: 'short' | 'safe';
  /** What Search turns up: coin, or an item id. */
  loot?: 'gold' | Id;
  /**
   * In a story (Module.delves): a scene of the story's own that plays on
   * walking in, until `until` holds — a conversation, the story's own fight.
   * The story's flags in `until` stay the story's. On a goal room, it stands
   * in for the boss: the room is where the story takes over.
   */
  event?: { scene: SceneRef; until?: Requirement[]; when?: Array<{ if: Requirement[]; to: SceneRef }> };
  /** In a story: what Search here enters, a scene of the story's own. */
  search?: SceneRef;
  /**
   * Someone held here, to be got out: the generator builds the finding, the
   * freeing, the quest, and their being taken away (when the place is
   * roused, or when `takenWhen` holds — a story's deadline). The story names
   * the two flags it reads (`as`) and may give its own lines; nothing else.
   */
  hostage?: Hostage;
  /** In a story: a way out from here, into one of the story's scenes. */
  exit?: { to: SceneRef; label?: string };
}

/** Someone held in a required room (RequiredRoom.hostage). */
export interface Hostage {
  /** Who: "the carter and his granddaughter". */
  who: string;
  /** More than one of them (for the defaults' verbs). */
  many?: true;
  /** The story's names for its two flags: set when they are got out, and
   *  when they are taken away for good. */
  as: { freed: string; taken: string };
  /** What the party sees on finding them (default: a plain line about `who`). */
  found?: string[];
  /** What happens as they are got out (default: a plain line). */
  freed?: string[];
  /** What the party finds once they are gone (default: a plain line). */
  gone?: string[];
  /** The story's own effects of getting them out (a friend's regard). */
  onFreed?: Effect[];
  /**
   * Watched: they can be got out quietly (Sleight of Hand at `dc`), or by
   * force, which brings the watch (`fight`, an encounter id; default one
   * drawn for the holders) and rouses the place. Lost, they are taken.
   */
  guard?: { dc: number; fight?: Id };
  /**
   * The alarm level at which the holders move them for good (Dungeon.alarm):
   * by default, when the place is roused. `false`: never; only the story's
   * own `takenWhen` takes them.
   */
  movedAt?: number | false;
  /** The story's own words for the rest of it (each has a plain default). */
  lines?: {
    /** Choice labels: freeing them quietly, by force, and leaving them for now. */
    pick?: string; force?: string; later?: string;
    /** The watch's coming, its fall, and the party beaten by it. */
    watch?: string[]; won?: string[]; lost?: string[];
    /** What the party finds once the alarm moved them (`gone` is for being taken). */
    moved?: string[];
  };
  /** The quest to get them out, added when they are found. */
  quest?: { title: string; body: string };
  /** Besides the place being roused: they are taken once these hold. */
  takenWhen?: Requirement[];
}

/** A set piece to build in (see delve-pieces.ts), by its library id. */
export interface PiecePlacement {
  piece: Id;
  /** 1-based; default 1. */
  floor?: number;
  /** Default: the piece's own. */
  where?: PieceWhere;
  /** Built only this often (0–1); default always. */
  chance?: number;
  /** The piece's parameters: a prisoner's name, a warden's title. */
  bind?: Record<string, string>;
  /**
   * Story flags that decide whether it is built at all, when the delve sits
   * in a written story (Module.delves): each must be set, or with a leading
   * '!' must not be. A standalone delve has no story, so reads none set.
   */
  when?: string[];
}

export interface DelveSpec extends Omit<DelveOptions, 'theme'> {
  theme?: SpecTheme;
  shape?: DelveShape;
  /** Rooms per floor (5–16); overrides `size`. */
  rooms?: number;
  floors?: number;
  /** 'inhabitants': every fight is drawn from the factions that hold the
   *  place, its goal headed by one of their leaders. Implies a history. */
  fights?: 'authored' | 'generated' | 'inhabitants';
  /** Who holds it (1–2 faction ids). Default, with 'inhabitants': drawn for
   *  the theme. Two split each floor: the first before the lock, the second
   *  past it. */
  factions?: Id[];
  /**
   * In a story: the place as the story calls it. Its name and the line at its
   * door, and what stepping back out of it says and offers. A delve dressed
   * by its story draws no history of its own and searches only where there is
   * something to find.
   */
  dressing?: { name: string; door: string; outside: string; back: string; leave: string };
  /** At most this many of its rooms hold a fight of the generator's own
   *  (besides a key's guard and the goal): a story's place keeps its levels
   *  for the story's fights. */
  maxFights?: number;
  /**
   * In a story: the first floor's lock is the story's, opened by its own
   * flags (a ravine crossed, a trail read) — no key room. Rooms placed
   * `afterLock` lie beyond it.
   */
  lock?: { requires: Requirement[]; note: string };
  /** Draw a past for the place: its title, its story, traces in the rooms. */
  history?: boolean;
  /**
   * A room past the last floor's goal, reached only past its holder: the
   * holders' hoard (`true`), or someone they took (`'hostage'`, who is moved
   * if the place is roused before the party gets there). Default: a held
   * place has one half the time, unless a story dresses it; a required room
   * placed `where: 'vault'` asks for one.
   */
  vault?: boolean | 'hostage';
  /**
   * Lines of the place's past, for the rooms whose role keeps it (a held
   * floor's `find: 'lore'` rooms: a ledger, an oath stone). A story's own
   * lore goes here, so the place tells its chapter's story; each line is
   * used once, in order: the first lies nearest the goal.
   */
  lore?: string[];
  require?: RequiredRoom[];
  pieces?: PiecePlacement[];
}

export const MAX_FLOORS = 3;
export const ROOM_RANGE: [number, number] = [5, 16];

/*
 * What a generated fight costs, as a share of the arena's EVEN budget (the
 * fight a fresh party wins about half the time). Calibrated against the
 * authored pools the classic delve draws from, adjusted XP over even budget,
 * levels 1–5: rooms 0.32 0.33 0.29 0.36 0.27, bosses 0.70 0.78 0.56 0.56
 * 0.77. So a generated delve is as hard as an authored one, room for room —
 * not a new difficulty decision. This is a match to the authored pools, NOT a
 * measurement of whole delves played through.
 */
/**
 * The shares, by role and party level (index = level - 1; past the end, the
 * last entry). Mutable so scripts/delve-sim.ts can sweep them; nothing in the
 * game writes to it.
 */
/*
 * MEASURED (scripts/delve-sim.ts): whole one-floor delves played through by a
 * careful player, every fight the real engine with the greedy AI on both
 * sides, HP and slots carried, resting by the dungeon's rules. The targets:
 * a room nearly always won, a named foe usually, a boss more often than not
 * at the first try (~75–85%), and a delve cleared ~85%+ of the time.
 *
 * The boss share started at a flat 0.65, matched to the authored pools. Played
 * through, that was far too easy at 1st level (97% first try) and too hard at
 * 3rd–4th (62–63%): a party's reserves, not its paper strength, decide a boss
 * at the end of a dungeon, and they scale differently by level. Swept per
 * level at n=40, then confirmed on 40 fresh seeds per cell — first-try boss
 * wins, generated / inhabitants:
 *   L1 83 / 83   L2 93 / 83   L3 82 / 75   L4 89 / 77   L5 84 / 83
 * Delves cleared 78–98%. Rooms 94–100% at 0.3, so they stay.
 * Elite (the warden, a rival company): 0.45 wins 83–95% — between room and
 * boss, as a named foe should; 0.35 won 93–100%, no harder than a room.
 * Levels past 5 use the last entry, and are NOT measured.
 */
// The budgets live on their own (delve-budget.ts), so the proofs can read
// them without loading the generator.
export { SHARES, shareFor, delveFightXpBound } from './delve-budget.js';
import { shareFor } from './delve-budget.js';

/** Throws on a spec no candidate could satisfy; returns it with defaults. */
export function checkSpec(spec: DelveSpec): Required<Omit<DelveSpec, 'size' | 'lock' | 'dressing' | 'maxFights' | 'lore' | 'vault'>> & Pick<DelveSpec, 'size' | 'lock' | 'dressing' | 'maxFights' | 'lore' | 'vault'> {
  const err = (m: string) => { throw new Error(`Bad delve spec: ${m}`); };
  const level = spec.level ?? 2;
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) err(`level ${level} is not 1–${MAX_LEVEL}`);
  const floors = spec.floors ?? 1;
  if (!Number.isInteger(floors) || floors < 1 || floors > MAX_FLOORS) err(`floors ${floors} is not 1–${MAX_FLOORS}`);
  if (spec.theme && !(spec.theme in ROOMS)) err(`no theme '${spec.theme}'`);
  if (spec.shape && !DELVE_SHAPES.includes(spec.shape)) err(`no shape '${spec.shape}'`);
  if (spec.rooms !== undefined && (!Number.isInteger(spec.rooms) || spec.rooms < ROOM_RANGE[0] || spec.rooms > ROOM_RANGE[1])) {
    err(`rooms ${spec.rooms} is not ${ROOM_RANGE[0]}–${ROOM_RANGE[1]}`);
  }
  const require = spec.require ?? [];
  const perFloor = new Map<number, number>();
  const goals = new Set<number>();
  for (const [i, r] of require.entries()) {
    const floor = r.floor ?? (r.where === 'goal' ? floors : 1);
    if (!Number.isInteger(floor) || floor < 1 || floor > floors) err(`required room ${i} is on floor ${floor} of ${floors}`);
    if (r.where === 'vault') {
      if (floor !== floors) err(`required room ${i}: a vault lies past the last floor's goal, not on floor ${floor}`);
      if (spec.vault === false) err(`required room ${i} is a vault, and the spec says the place has none`);
      if (require.filter((x) => x.where === 'vault').length > 1) err('two required vaults');
      if ((spec.pieces ?? []).some((pl) => PIECES[pl.piece]?.where === 'goal' && (pl.floor ?? floors) === floors)) err(`required room ${i} is a vault, and a goal piece ends the last floor`);
      continue;
    }
    if (r.where === 'goal') {
      if (goals.has(floor)) err(`two required goals on floor ${floor}`);
      goals.add(floor);
    } else perFloor.set(floor, (perFloor.get(floor) ?? 0) + 1);
    if (typeof r.fight === 'string' && !encounterFor(r.fight)) err(`required room ${i}: no encounter '${r.fight}'`);
    if (r.loot && r.loot !== 'gold' && !ITEMS[r.loot]) err(`required room ${i}: no item '${r.loot}'`);
  }
  const factions = spec.factions ?? [];
  if (factions.length > 2) err(`at most two factions hold a place, not ${factions.length}`);
  for (const id of factions) {
    if (!FACTIONS[id]) err(`no faction '${id}' (have ${Object.keys(FACTIONS).join(', ')})`);
    if (!canHold(FACTIONS[id]!, level)) err(`${id} cannot field a fight for a level ${level} party`);
  }
  if (new Set(factions).size !== factions.length) err('the same faction twice');
  if (factions.length && spec.fights && spec.fights !== 'inhabitants') err(`factions given, but fights are '${spec.fights}'`);
  const pieces = spec.pieces ?? [];
  const keyed = new Set<number>();
  const goalPieces = new Set<number>();
  for (const [i, pl] of pieces.entries()) {
    const piece = PIECES[pl.piece];
    if (!piece) err(`piece ${i}: no piece '${pl.piece}' (have ${Object.keys(PIECES).join(', ')})`);
    const floor = pl.floor ?? (piece?.where === 'goal' ? floors : 1);
    if (!Number.isInteger(floor) || floor < 1 || floor > floors) err(`piece ${i} is on floor ${floor} of ${floors}`);
    if (pl.chance !== undefined && !(pl.chance >= 0 && pl.chance <= 1)) err(`piece ${i}: chance ${pl.chance} is not 0–1`);
    const where = pl.where ?? piece!.where;
    if ((where === 'goal') !== (piece!.where === 'goal')) {
      err(piece!.where === 'goal' ? `piece ${i} (${pl.piece}) is a goal, and goes nowhere else` : `piece ${i} (${pl.piece}) cannot be a goal`);
    }
    if (where === 'goal') {
      const gf = pl.floor ?? floors;
      if (goalPieces.has(gf)) err(`two goal pieces on floor ${gf}`);
      if (require.some((r) => r.where === 'goal' && (r.floor ?? floors) === gf)) err(`floor ${gf} has a goal piece and a required goal room`);
      if (pl.chance !== undefined && pl.chance < 1) err(`piece ${i} (${pl.piece}) is a goal, so it cannot be left to chance`);
      goalPieces.add(gf);
    }
    if (piece!.gives?.includes('key')) {
      // A key must be reachable without itself, and there is one first lock.
      if ((pl.where ?? piece!.where) !== 'beforeLock') err(`piece ${i} (${pl.piece}) carries the key, so it must be beforeLock`);
      if (keyed.has(floor)) err(`two pieces carry the key on floor ${floor}`);
      if (pl.chance !== undefined && pl.chance < 1) err(`piece ${i} (${pl.piece}) carries the key, so it cannot be left to chance`);
      keyed.add(floor);
    }
    for (const name of Object.keys(pl.bind ?? {})) {
      if (!piece!.params?.[name]) err(`piece ${i} (${pl.piece}) has no parameter '${name}'`);
    }
  }
  // A floor's rooms minus the entrance, the goal and the key room(s).
  const minRooms = spec.rooms ?? (spec.size ? SIZE_ROOMS[spec.size][0] : SIZE_ROOMS.medium[0]);
  for (const [floor, n] of perFloor) {
    if (n > minRooms - 4) err(`${n} required rooms on floor ${floor}; a floor of ${minRooms} has room for ${minRooms - 4}`);
  }
  return {
    level, floors, require, pieces, factions, history: spec.history ?? false,
    theme: spec.theme ?? 'stone', shape: spec.shape ?? 'classic',
    rooms: spec.rooms ?? 0, fights: spec.fights ?? 'authored', rest: spec.rest ?? 'standard',
    ...(spec.size ? { size: spec.size } : {}),
    ...(spec.lock ? { lock: spec.lock } : {}),
    ...(spec.dressing ? { dressing: spec.dressing } : {}),
    ...(spec.maxFights !== undefined ? { maxFights: spec.maxFights } : {}),
    ...(spec.lore?.length ? { lore: spec.lore } : {}),
    ...(spec.vault !== undefined ? { vault: spec.vault } : {}),
  };
}

type Full = ReturnType<typeof checkSpec>;

/** The wiring of one floor, before anything is put in the rooms. */
interface Graph {
  main: Id[];
  links: DungeonLink[];
  side: Id[];
  /** Rooms holding a key, and the flag each one sets. */
  keys: { room: Id; flag: string }[];
  /** Rooms only reachable past the first lock. */
  afterLock: Set<Id>;
  /** Rooms a set piece built: sealed, never re-rolled or re-used. */
  pieceRooms: Set<Id>;
  /** The room past the goal, where the floor has one. */
  vault?: Id;
}

/** `open`: no lock of the generator's own (a place a story dresses keeps only
 *  the story's locks; it has no gate key for a keeper to carry). */
function wire(shape: DelveShape, n: number, dice: Dice, floor: number, door: string, story?: DelveSpec['lock'], open = false): Graph {
  const flag = (k: number) => `delve-key-${floor}${k ? `-${k + 1}` : ''}`;
  const locked = (k: number): NonNullable<DungeonLink['door']> => (story && k === 0 ? { locked: story.requires, note: story.note } : {
    locked: [{ kind: 'flag', flag: flag(k) }], note: door,
    ...(dice.chance(0.5) ? { force: { skill: 'athletics' as const, dc: dice.int(14, 17) } } : {}),
  });
  const links: DungeonLink[] = [];
  const side: Id[] = [];
  const keys: Graph['keys'] = [];
  const afterLock = new Set<Id>();
  const chain = (ids: Id[], lockAt: number[]) => {
    for (let i = 1; i < ids.length; i++) {
      const k = lockAt.indexOf(i);
      links.push({ a: ids[i - 1]!, b: ids[i]!, ...(k >= 0 ? { door: locked(k) } : {}) });
    }
  };
  const hang = (anchor: Id, id: Id, extra: Partial<DungeonLink> = {}) => {
    links.push({ a: anchor, b: id, ...extra });
    side.push(id);
    if (afterLock.has(anchor)) afterLock.add(id);
  };

  let main: Id[];
  let lockAt: number[];
  if (shape === 'hub') {
    // Entrance, the hub, and the goal two rooms beyond it behind the lock.
    main = ['m0', 'm1', 'm2', 'm3'];
    lockAt = [2];
  } else {
    const share = shape === 'spine' ? 0.7 : 0.5;
    const len = Math.max(shape === 'keys' ? 5 : 4, Math.min(n - 2, Math.round(n * share)));
    main = Array.from({ length: len }, (_, i) => `m${i}`);
    if (shape === 'keys') {
      const a = dice.int(2, len - 2);
      lockAt = [a, dice.int(a + 1, len - 1)];
    } else if (shape === 'ring') {
      // The second way round rejoins just before the lock, so the lock still
      // guards everything past it.
      lockAt = [dice.int(2, len - 2)];
    } else {
      lockAt = [dice.int(2, len - 1)];
    }
  }
  if (open && !story) lockAt = [];
  chain(main, lockAt);
  main.forEach((id, i) => { if (i >= lockAt[0]!) afterLock.add(id); });
  const before = (k: number) => main.slice(0, lockAt[k]!).filter((_, i) => k === 0 || i >= lockAt[k - 1]!);

  // The keys: each hangs off the stretch before its own lock.
  lockAt.forEach((_, k) => {
    if (story && k === 0) return;   // the story holds this one's key
    const room = k ? `key${k + 1}` : 'key';
    const anchor = shape === 'hub' ? 'm1' : dice.pick(before(k));
    hang(anchor, room);
    keys.push({ room, flag: flag(k) });
  });

  // Shape-specific connections.
  if (shape === 'classic' && lockAt.length && lockAt[0]! <= main.length - 2 && dice.chance(0.7)) {
    const from = main[dice.int(lockAt[0]!, main.length - 2)]!;
    const to = main[dice.int(0, Math.max(0, lockAt[0]! - 2))]!;
    if (from !== to) links.push({ a: from, b: to, length: 2, door: { oneWay: true } });
  }
  if (shape === 'ring') {
    // A second way round, from just inside the door to the room before the lock.
    links.push({ a: 'm0', b: 'r1' }, { a: 'r1', b: 'r2' }, { a: 'r2', b: main[(lockAt[0] ?? main.length - 1) - 1]! });
    side.push('r1', 'r2');
  }

  // The rest: side rooms, the first a cache behind a secret door.
  const goal = main[main.length - 1]!;
  const extra = n - main.length - side.length;
  for (let i = 0; i < extra; i++) {
    const id = i === 0 ? 'cache' : `s${i}`;
    // A room is drawn on a grid and has four sides; one with three corridors
    // already has nowhere sensible left to put a fourth.
    const degree = (r: Id) => links.filter((l) => l.a === r || l.b === r).length;
    // Nothing hangs off the cache: a room behind a secret door is a room a
    // required one could land in and never be found.
    const all = [...main.filter((m) => m !== goal), ...side].filter((a) => a !== 'cache' && degree(a) < 3);
    const spine = shape === 'spine' ? all.filter((a) => !side.includes(a)) : all;
    const hub = shape === 'hub' ? spine.filter((a) => a === 'm1' || side.includes(a)) : spine;
    const anchors = hub.length ? hub : spine.length ? spine : all;
    if (anchors.length === 0) throw new Reroll(`floor ${floor}: nowhere left to hang a room`);
    hang(dice.pick(anchors), id, id === 'cache' ? { door: { secret: { dc: dice.int(12, 16) } } } : {});
  }
  return { main, links, side, keys, afterLock, pieceRooms: new Set() };
}

/** Where a required room may go, given the floor's graph. */
function placesFor(g: Graph, where: RoomPlace | undefined): Id[] {
  const goal = g.main[g.main.length - 1]!;
  const keyRooms = new Set(g.keys.map((k) => k.room));
  const plain = [...g.main.slice(1, -1), ...g.side].filter((id) => !keyRooms.has(id) && id !== 'cache' && !g.pieceRooms.has(id));
  switch (where) {
    case 'goal': return [goal];
    case 'vault': return g.vault ? [g.vault] : [];
    case 'main': return g.main.slice(1, -1);
    case 'side': return g.side.filter((id) => !keyRooms.has(id) && id !== 'cache' && !g.pieceRooms.has(id));
    case 'beforeLock': return plain.filter((id) => !g.afterLock.has(id));
    case 'afterLock': return plain.filter((id) => g.afterLock.has(id));
    default: return plain;
  }
}

/** The level a party is expected to be on reaching a floor, from the XP the
 *  room fights above hand out (each split four ways). A party that skips
 *  rooms arrives a little behind; ambushes and broken nights are not counted. */
function levelAfter(start: number, fightsXp: number): number {
  return Math.min(MAX_LEVEL, levelForXp((LEVEL_XP[start - 1] ?? 0) + fightsXp / 4));
}

class Reroll extends Error {}

type Win = Extract<Scene, { kind: 'battle' }>['onWin'];

const FIND_WORDS = {
  coin: ['A few coins, dropped and forgotten.', 'Coin, hidden where they thought nobody would look.',
    'A purse, pushed down where nobody would reach.', 'Coins, scattered as if someone left in a hurry.'],
  potion: ['A pack left behind, with a potion still in it.', 'A flask of something red, put by for a bad day.',
    'A healing draught, wrapped in a rag and tucked out of sight.', 'A stoppered bottle, its wax seal unbroken.'],
};

/**
 * The deepest room on the main path, at least halfway in, that every open way
 * from the entrance to the goal runs through (a secret way does not count: that is the way round
 * it), and that `ok` allows. Undefined where there is none.
 */
function cutRoom(g: Graph, goal: Id, ok: (id: Id) => boolean): Id | undefined {
  const entry = g.main[0]!;
  const reaches = (without: Id) => {
    const seen = new Set([entry]);
    for (let grew = true; grew;) {
      grew = false;
      for (const l of g.links) {
        if (l.door?.secret) continue;
        for (const [x, y] of [[l.a, l.b], [l.b, l.a]] as const) {
          if (seen.has(x) && !seen.has(y) && y !== without && !(l.door?.oneWay && x === l.b)) { seen.add(y); grew = true; }
        }
      }
    }
    return seen.has(goal);
  };
  // At least halfway in: a second by the front door is only a doorman.
  return [...g.main.slice(1, -1)].reverse().find((id) => g.main.indexOf(id) >= (g.main.length - 1) / 2 && ok(id) && !reaches(id));
}

/** A board for a fight a story scene starts (not a room's own, '@room'). */
const EVENT_MAP: Partial<Record<SpecTheme, string>> = {
  stone: 'ruins', graveyard: 'ruins', ember: 'firepit', bog: 'bog', forest: 'thicket', village: 'village', marsh: 'marsh', stockade: 'village',
};

const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** A held room's part in the place: its role (archetypes.ts), and its name. */
interface Cast { role?: RoomRole; faction: Faction; name?: string }

/**
 * Who does what on a held floor. The key room (if the floor has a lock of its
 * own) goes to the role that keeps things; then each role of the holders'
 * archetype takes one room where it belongs — the watch by the way in, the
 * trophies by the goal, the stores off the path — and, failing that, any
 * room left. Rooms past the roles are the holders' own (`Faction.rooms`).
 * The story's rooms, the goal and the safe room are not cast.
 */
function castRoles(
  g: Graph, goal: Id, placed: ReadonlyMap<Id, unknown>, safe: ReadonlySet<Id>, keyOf: ReadonlyMap<Id, string>,
  dice: Dice, facOf: (id: Id) => Faction, outdoor: boolean, gate?: Id,
): Map<Id, Cast> {
  const out = new Map<Id, Cast>();
  const free = [...g.main.slice(1, -1), ...g.side]
    .filter((id) => id !== goal && id !== gate && id !== 'cache' && !placed.has(id) && !safe.has(id) && !g.pieceRooms.has(id));
  const whereOf = (id: Id): RoleWhere => {
    const i = g.main.indexOf(id);
    if (i < 0) return 'side';
    const t = i / (g.main.length - 1);
    return t < 0.4 ? 'near' : t > 0.7 ? 'deep' : 'mid';
  };
  const names = new Set<string>();
  const used = new Set<string>();
  const give = (id: Id, faction: Faction, role?: RoomRole) => {
    const pool = role ? role.names[outdoor ? 'out' : 'in'] : faction.rooms;
    const name = dice.shuffle([...pool]).find((n) => !names.has(n));
    if (name) names.add(name);
    if (role) used.add(`${faction.id}/${role.id}`);
    out.set(id, { faction, ...(role ? { role } : {}), ...(name ? { name } : {}) });
  };
  const all = (f: Faction) => ARCHETYPES[f.archetype]?.roles ?? [];
  // The gate's and the vault's roles are theirs alone.
  const rolesOf = (f: Faction) => all(f).filter((r) => r.where !== 'gate' && r.where !== 'vault');
  if (gate) give(gate, facOf(gate), all(facOf(gate)).find((r) => r.where === 'gate'));
  if (g.vault && !placed.has(g.vault)) give(g.vault, facOf(goal), all(facOf(goal)).find((r) => r.where === 'vault'));
  // The first key with whoever keeps things; a second with another who fights.
  for (const id of free.filter((x) => keyOf.has(x))) {
    const f = facOf(id);
    const open = rolesOf(f).filter((r) => !used.has(`${f.id}/${r.id}`));
    give(id, f, open.find((r) => r.keeps) ?? open.find((r) => r.fight));
  }
  for (const exact of [true, false]) {
    for (const id of free) {
      if (out.has(id)) continue;
      const f = facOf(id);
      const fits = rolesOf(f).filter((r) => !used.has(`${f.id}/${r.id}`) && (!exact || r.where === 'any' || r.where === whereOf(id)));
      if (fits.length) give(id, f, dice.pick(fits));
    }
  }
  for (const id of free) if (!out.has(id)) give(id, facOf(id));
  return out;
}

/** A role's line in the holders' voice: `$one` is one of them, `$they` all. */
const voice = (text: string, f: Faction, dice: Dice) =>
  text.replace(/\$one/g, f.one).replace(/\$they/g, () => dice.pick(f.names));

function draftSpec(seed: number, spec: Full, story: ReadonlySet<string>): Module {
  const dice = new Dice(seedRng(seed));
  const T = ROOMS[spec.theme];
  const scenes: Record<Id, Scene> = {};
  /*
   * Who holds it, and where it came from. Drawn only when asked for, so a
   * spec without them rolls exactly as it always did (the first roll of a
   * plain spec delve is its title).
   */
  const peopled = spec.fights === 'inhabitants';
  let holders: Faction[] = spec.factions.map((id) => FACTIONS[id]!);
  let history: History | undefined;
  let title: string;
  const dress = spec.dressing;
  if (dress) {
    title = dress.name;
  } else if (peopled || spec.history) {
    if (peopled && holders.length === 0) {
      const fit = dice.shuffle([...factionsFor(spec.theme, spec.level)]);
      holders = fit.slice(0, dice.chance(0.4) && fit.length > 1 ? 2 : 1);
    }
    history = drawHistory(spec.theme, dice, holders);
    title = history.title;
  } else {
    title = `The ${dice.pick(T.title)}`;
  }
  let level = spec.level;
  /** The story's lore, each line once, in a drawn order (DelveSpec.lore). */
  // In the author's order: the first line lies nearest the goal.
  const lore = spec.lore ? [...spec.lore] : [];
  // The torch is set once the module exists, so its proof sees every scene.
  const goals: [Dungeon, Id, Id][] = [];

  /** A faction's leader and an escort, to the boss budget. */
  const leaderFight = (lvl: number, fac: Faction): Id | undefined => {
    const budget = Math.round(evenBudgetFor(lvl) * shareFor('boss', lvl));
    const cap = Math.min(memberCapFor(lvl), budget * 0.75);
    const all = fac.leaders.filter((m) => (MONSTER_XP[m] ?? Infinity) <= cap);
    // A leader worth a real share of the fight, where the faction has one:
    // a goblin boss heading a 12,000 XP fight is an escort with a hat on.
    const worthy = all.filter((m) => (MONSTER_XP[m] ?? 0) >= budget * 0.12);
    const fits = worthy.length ? worthy : all.sort((a, b) => (MONSTER_XP[b] ?? 0) - (MONSTER_XP[a] ?? 0)).slice(0, 1);
    // Too low a level for any of its leaders: the biggest of its own that
    // fits leads instead, so the goal is still THEM and not a stranger.
    const stand = [...fac.members].filter((m) => (MONSTER_XP[m] ?? Infinity) <= cap)
      .sort((a, b) => (MONSTER_XP[b] ?? 0) - (MONSTER_XP[a] ?? 0)).slice(0, 1);
    const pool = fits.length ? fits : stand;
    if (pool.length === 0) return undefined;
    const leader = dice.pick(pool);
    // A leader big enough to be most of the fight on its own fights alone:
    // asking the generator for an escort out of nothing crashed it.
    const left = budget - (MONSTER_XP[leader] ?? 0) * 1.5;
    const escortSeed = Math.floor(dice.float() * 2 ** 31);
    // ...and so does one that leaves less than its cheapest follower costs:
    // asked to spend 50 XP on wild beasts, the generator falls back to the
    // whole roster and a kobold joins the giant ape.
    const cheapest = Math.min(...fac.members.map((m) => MONSTER_XP[m] ?? Infinity));
    // (The generator spends at most three quarters of a budget on one body.)
    const escort = left * 0.75 < cheapest ? [] : generateEncounter({
      budget: left, maxMemberXp: Math.min(memberCapFor(lvl), MONSTER_XP[leader] ?? 0),
      maxCount: Math.max(1, maxCountFor(lvl) - 1), partyLevel: lvl, members: fac.members,
    }, seedRng(escortSeed)).value.members;
    // Trim the escort until the whole fight is inside the boss budget.
    const out = [leader, ...escort];
    while (out.length > 1 && adjustedXp(out) > budget * 1.1) out.pop();
    return generatedEncounterId(out);
  };

  const fightOf = (lvl: number, boss: boolean | FightRole, brief?: EncounterBrief, fac?: Faction, only?: readonly Id[]): Id => {
    const role: FightRole = boss === true ? 'boss' : boss === false ? 'room' : boss;
    if (fac && role === 'boss' && !only) {
      const led = leaderFight(lvl, fac);
      if (led) return led;
    }
    const members = only ?? fac?.members;
    // An elite has no authored pool of its own; it is built to its budget.
    if (spec.fights === 'authored' && !brief && role !== 'elite' && !members) {
      const pools = encounterPools(lvl);
      return dice.pick(role === 'boss' ? pools.boss : pools.room);
    }
    const share = shareFor(role, lvl);
    const budget = Math.round(evenBudgetFor(lvl) * share);
    const enc = generateEncounter({
      budget, maxMemberXp: memberCapFor(lvl), maxCount: maxCountFor(lvl), partyLevel: lvl, ...(brief ? { brief } : {}),
      ...(members ? { members } : {}),
    }, seedRng(Math.floor(dice.float() * 2 ** 31))).value;
    return generatedEncounterId(enc.members);
  };

  for (let f = 1; f <= spec.floors; f++) {
    const sceneId = f === 1 ? 'delve' : `delve-${f}`;
    const last = f === spec.floors;
    const n = spec.rooms || dice.int(...SIZE_ROOMS[spec.size ?? 'medium']);
    // A held floor's lock is its holders' own (a gate of lashed timber, a grave-gate).
    const kind = holders[0] ? ARCHETYPES[holders[0].archetype] : undefined;
    const g = wire(spec.shape, n, dice, f, kind ? kind.lock[T.outdoor ? 'out' : 'in'] : T.door, f === 1 ? spec.lock : undefined, !!dress);
    let goal = g.main[g.main.length - 1]!;
    // The vault (DelveSpec.vault): past the last floor's goal.
    const askedVault = spec.require.some((r) => r.where === 'vault');
    // (A goal piece brings its own goal, and its own end: no vault past it.)
    const goalPiece = spec.pieces.some((pl) => PIECES[pl.piece]!.where === 'goal' && (pl.floor ?? spec.floors) === spec.floors);
    const vaultKind = goalPiece ? false : askedVault ? true : spec.vault ?? (holders.length && !dress ? (dice.chance(0.5) ? true : false) : false);
    if (last && vaultKind) {
      g.vault = 'vault';
      g.links.push({ a: goal, b: 'vault' });
      if (g.afterLock.has(goal)) g.afterLock.add('vault');
    }
    /** A goal piece's floor keeps the generated goal in its graph (so every
     *  "the last main room" reading stays right) but never builds it. */
    let replacedGoal: Id | undefined;
    const names = dice.shuffle([...holders.flatMap((h) => h.rooms), ...T.rooms]);
    let nameIdx = 0;
    const nextName = () => names[nameIdx++ % names.length]!;
    const sizeOf = (): RoomSize => dice.pick(['small', 'medium', 'medium', 'large'] as const);
    const pre = `f${f}-`;
    let floorXp = 0;
    // Two holders split the floor at the lock; one holds all of it.
    const factionOf = (roomId: Id): Faction | undefined =>
      holders.length === 0 ? undefined : holders[holders.length > 1 && g.afterLock.has(roomId) ? 1 : 0];
    /** A faction that talks offers it on its fights — never on the goal's. */
    const parleyFor = (fac: Faction | undefined, win: Win, enc: Id) => fac?.parley ? { parley: {
      ...(fac.parley.skill ? { skill: fac.parley.skill } : {}), dc: fac.parley.dc, label: fac.parley.label,
      // Talked down, they hand over what they carried (a key) and the party
      // is owed the fight's XP, as for every way past a fight
      // (avoidedFightXP) — but no gold and no loot.
      success: { to: '@hub', text: [fac.parley.success], effects: [
        ...(win.effects ?? []).filter((e) => e.kind === 'setFlag'), { kind: 'xp' as const, amount: avoidedFightXP(enc) }] },
    } } : {};
    const fight = (roomId: Id, enc: Id, win: Win): Id => {
      const id = `${pre}fight-${roomId}`;
      const talk = roomId === goal ? {} : parleyFor(factionOf(roomId), win, enc);
      const opens = roomId === goal ? undefined : factionOf(roomId)?.intros ?? T.outdoor?.fights;
      scenes[id] = { id, kind: 'battle', encounterId: enc, mapId: '@room', onWin: win, ...talk, ...(opens ? { intro: [dice.pick(opens)] } : {}) };
      floorXp += encounterXP(enc);
      return id;
    };
    /** What a search finds, in words not yet used on this floor (one road
     *  should not turn up the same potion three times). */
    const told = { coin: 0, potion: 0 };
    // (A floor nobody holds says what it always said: its seeds build as before.)
    const said = (k: keyof typeof FIND_WORDS) => FIND_WORDS[k][held ? told[k]++ % FIND_WORDS[k].length : 0]!;
    /**
     * Someone the holders took, kept in the vault: freed if the party reaches
     * them while the place is quiet; moved, and gone, if it is roused first
     * (ALARM_ROUSED). Its flags are the place's own, for a story to export.
     */
    const hostage = (roomId: Id, h?: Hostage): NonNullable<DungeonRoom['event']> => {
      const rng = () => dice.float();
      const who = h?.who ?? personName(styleFor('delve', spec.theme, rng), dice.chance(0.5) ? 'female' : 'male', rng).first;
      const freed = h?.as.freed ?? `${pre}${roomId}-freed`, gone = h?.as.taken ?? `${pre}${roomId}-gone`;
      const here = `${pre}${roomId}-held`, out = `${pre}${roomId}-out`, moved = `${pre}${roomId}-moved`, taken = `${pre}${roomId}-taken`;
      const L = h?.lines ?? {};
      const Who = capFirst(who);
      const v = (one: string, more: string) => (h?.many ? more : one);
      // The quest is taken when they are found (not before: a party that never
      // finds them has nothing to finish).
      const found = `${pre}${roomId}-found`;
      const quest: Effect[] = h?.quest ? [{ kind: 'setFlag', flag: found }, { kind: 'journal', entry: { id: `${pre}${roomId}-quest`, kind: 'quest', title: h.quest.title, body: h.quest.body,
        takenBy: found, resolvedBy: freed, failedBy: gone, stages: [{ text: `Get ${who} out`, done: [{ kind: 'flag', flag: freed }] }] } }] : [];
      const free: Effect[] = [{ kind: 'setFlag', flag: freed }, { kind: 'xp', amount: 50 * level }, ...(h?.onFreed ?? [])];
      // Watched: quietly, or by force against the watch.
      const watch = `${pre}${roomId}-watch`;
      if (h?.guard) {
        scenes[watch] = { id: watch, kind: 'battle', encounterId: h.guard.fight ?? fightOf(level, false, undefined, holders[0]), mapId: EVENT_MAP[spec.theme] ?? 'ruins', loot: false, noFlee: true,
          intro: L.watch ?? ['The noise carries, and their watch comes running.'],
          onWin: { to: out, text: L.won ?? ['The last of the watch goes down, and behind it the alarm goes up.'], effects: [{ kind: 'alarm', dungeon: sceneId, amount: ALARM_ROUSED }] },
          onLoss: { to: '@hub', text: L.lost ?? [`You come to on the ground where ${who} ${v('was', 'were')} held. ${Who} ${v('is', 'are')} gone.`], effects: [{ kind: 'setFlag', flag: gone }, { kind: 'alarm', dungeon: sceneId, amount: ALARM_ROUSED }] } };
      }
      scenes[here] = { id: here, kind: 'story', noBack: true,
        text: h?.found ?? [`${Who} ${v('looks', 'look')} up from where ${'they are'} held, as if you might be one more trick.`],
        next: h?.guard ? [
          // (A check's effects land pass or fail: the freeing is on the way out.)
          { id: 'pick', label: `[Sleight of Hand DC ${h.guard.dc}] ${L.pick ?? `Get ${who} out quietly`}`, to: out, once: true, effects: quest,
            check: { skill: 'sleight-of-hand', dc: h.guard.dc, failTo: watch } },
          { id: 'force', label: L.force ?? `Break ${who} out, and never mind the noise`, to: watch, effects: quest },
          ...(h.quest ? [{ id: 'later', label: L.later ?? 'Not yet', to: '@hub', effects: quest }] : []),
        ] : [
          { id: 'free', label: `Get ${who} out`, to: out, effects: [...quest, ...free] },
          ...(h?.quest ? [{ id: 'later', label: L.later ?? 'Not yet', to: '@hub', effects: quest }] : []),
        ] };
      scenes[out] = { id: out, kind: 'story', noBack: true,
        text: h?.freed ?? [`${Who} ${v('slips', 'slip')} out past you toward the daylight, with a promise to repay it.`],
        next: [{ id: 'on', label: 'Go on', to: '@hub', effects: h?.guard ? free : [] }] };
      // (Unguarded, getting them out sets it all; guarded, there are two ways
      // there, so it is set on the way out.)
      // Taken (the story's deadline, or lost to the watch), and moved (the
      // alarm): two ways to an empty room, each in its own words.
      scenes[taken] = { id: taken, kind: 'story', noBack: true,
        text: h?.gone ?? [`There is nobody here now. Whoever held ${who} has taken ${v('them', 'them all')} away.`],
        next: [{ id: 'on', label: 'Go on', to: '@hub', effects: [{ kind: 'setFlag', flag: gone }] }] };
      // (A vault lies past the goal, three fights in: it is moved from only when
      // the place is well past roused.)
      const at = h ? h.movedAt ?? ALARM_ROUSED : ALARM_ROUSED + 2;
      if (at !== false) {
        scenes[moved] = { id: moved, kind: 'story', noBack: true,
          text: L.moved ?? [`There is nobody here now. They heard you coming, and moved ${who} somewhere you will not find.`],
          next: [{ id: 'on', label: 'Go on', to: '@hub', effects: [{ kind: 'setFlag', flag: gone }] }] };
      }
      return { scene: here, until: [{ kind: 'flag', flag: freed }],
        when: [
          // Gone is gone: the empty room, every time.
          { if: [{ kind: 'flag', flag: gone }], to: taken },
          ...(h?.takenWhen?.length ? [{ if: h.takenWhen, to: taken }] : []),
          ...(at !== false ? [{ if: [{ kind: 'alarm' as const, dungeon: sceneId, atLeast: at }], to: moved }] : []),
        ] };
    };
    const read = (roomId: Id, text: string): Id => {
      const id = `${pre}read-${roomId}`;
      scenes[id] = { id, kind: 'story', text: [text], next: [{ id: 'on', label: 'Go on', to: '@hub' }] };
      return id;
    };
    const find = (roomId: Id, text: string, effects: Effect[]): Id => {
      const id = `${pre}find-${roomId}`;
      scenes[id] = { id, kind: 'story', text: [text], next: [{ id: 'take', label: 'Take it', to: '@hub', effects }] };
      return id;
    };

    const goalOutcome = (): Win => (last && g.vault
      ? { to: '@hub', text: ['The last of them falls. Behind them, the way into their hoard stands open.'], effects: [{ kind: 'gold', amount: 20 + 10 * level }] }
      : last
      ? { to: 'won', text: ['The last of them falls, and the place is yours.'], effects: [{ kind: 'gold', amount: 60 + 20 * level }] }
      : { to: '@hub', text: ['Past them, a stair goes down into the dark.'], effects: [{ kind: 'gold', amount: 20 + 10 * level }] });

    // Set pieces first: they bring rooms of their own, and the most demanding
    // claims go before anything else can take the corridors they need.
    let pieceGivesRest = false;
    const pieceLinks = new Set<DungeonLink>();
    const pieceRooms: DungeonRoom[] = [];
    // The first lock's flag, kept before a key piece can take over the key.
    // (In a story the first lock is the story's: no key flag, its own door.)
    const storyLock = f === 1 ? spec.lock : undefined;
    const lockFlag = storyLock ? undefined : g.keys[0]?.flag;
    const onFloor = spec.pieces.map((pl, i) => ({ pl, i }))
      .filter(({ pl }) => (pl.floor ?? (PIECES[pl.piece]!.where === 'goal' ? spec.floors : 1)) === f);
    // The goal first, then the key, then the rest.
    const rank = (id: Id) => (PIECES[id]!.where === 'goal' ? 2 : PIECES[id]!.gives?.includes('key') ? 1 : 0);
    onFloor.sort((a, b) => rank(b.pl.piece) - rank(a.pl.piece));
    for (const { pl, i } of onFloor) {
      // Decided by the story before any dice: an unbuilt piece rolls nothing.
      if (pl.when && !pl.when.every((w) => (w.startsWith('!') ? !story.has(w.slice(1)) : story.has(w)))) continue;
      if (pl.chance !== undefined && !dice.chance(pl.chance)) continue;
      const piece = PIECES[pl.piece]!;
      const where = pl.where ?? piece.where;
      if (where === 'goal') {
        const local = `p${i}`;
        const old = goal;
        const built = piece.build({
          floor: f, level, theme: spec.theme, dice, ...(factionOf(old) ? { faction: factionOf(old)! } : {}),
          room: (r) => `${local}-${r}`, scene: (sc) => `${pre}${local}-${sc}`, flag: (fl) => `${pre}${local}-${fl}`,
          fight: (role, brief, only) => fightOf(level, role, brief, factionOf(old), only),
          param: (name, fallback) => pl.bind?.[name] ?? fallback,
          goal: { win: goalOutcome() },
        });
        if (!built.goal || built.port.door) throw new Error(`goal piece '${piece.id}' must name its goal room and bring no door of its own`);
        // Every corridor that led to the old goal now leads to the piece's
        // door, locks and all.
        for (const l of g.links) {
          if (l.a === old) l.a = built.port.room;
          if (l.b === old) l.b = built.port.room;
        }
        for (const l of built.links) { g.links.push(l); pieceLinks.add(l); }
        for (const r of built.rooms) {
          g.pieceRooms.add(r.id);
          if (g.afterLock.has(old)) g.afterLock.add(r.id);
          if (r.id === built.goal) {
            r.goal = true;
            if (!last) r.exit = { to: `delve-${f + 1}`, label: 'Down the stairs' };
          }
          pieceRooms.push(r);
        }
        for (const sc of built.scenes) {
          if (scenes[sc.id]) throw new Error(`piece '${piece.id}' reuses scene id '${sc.id}'`);
          scenes[sc.id] = sc;
          if (sc.kind === 'battle' && sc.loot !== false) floorXp += encounterXP(sc.encounterId);
        }
        replacedGoal = old;
        goal = built.goal;
        continue;
      }
      const degree = (r: Id) => g.links.filter((l) => l.a === r || l.b === r).length;
      const open = [...g.main.slice(0, -1), ...g.side].filter((id) => id !== 'cache' && !g.pieceRooms.has(id) && degree(id) < 3)
        .filter((id) => where === 'beforeLock' ? !g.afterLock.has(id)
          : where === 'afterLock' ? g.afterLock.has(id)
          : where === 'main' ? g.main.includes(id)
          : where === 'side' ? g.side.includes(id) : true);
      /*
       * Past the lock is often nothing but the goal (a classic floor whose lock
       * is on the goal's own door), and a piece cannot hang off the goal. Then
       * it hangs off a room before the lock, behind a door the SAME key opens:
       * what `afterLock` promises is "needs the key", and this keeps it.
       */
      let portDoor: DungeonLink['door'];
      if (open.length === 0 && where === 'afterLock' && (lockFlag || storyLock)) {
        open.push(...[...g.main.slice(0, -1), ...g.side]
          .filter((id) => id !== 'cache' && !g.pieceRooms.has(id) && !g.afterLock.has(id) && degree(id) < 3));
        portDoor = storyLock ? { locked: storyLock.requires, note: storyLock.note } : { locked: [{ kind: 'flag', flag: lockFlag! }], note: T.door };
      }
      if (open.length === 0) throw new Reroll(`no ${where} corridor left on floor ${f} for ${piece.name}`);
      const anchor = dice.pick(open);
      const local = `p${i}`;
      const isKey = !!piece.gives?.includes('key');
      if (isKey && storyLock) throw new Error(`${piece.name} would carry a key, but the story holds the first floor's lock`);
      const built = piece.build({
        floor: f, level, theme: spec.theme, dice,
        room: (r) => `${local}-${r}`, scene: (sc) => `${pre}${local}-${sc}`, flag: (fl) => `${pre}${local}-${fl}`,
        ...(factionOf(anchor) ? { faction: factionOf(anchor)! } : {}),
        fight: (role, brief, only) => fightOf(level, role, brief, factionOf(anchor), only),
        param: (name, fallback) => pl.bind?.[name] ?? fallback,
        ...(isKey ? { keyFlag: g.keys[0]!.flag } : {}),
      });
      // The generic key room stands down: the piece carries the key now.
      if (isKey) g.keys = g.keys.slice(1);
      if (piece.gives?.includes('rest')) pieceGivesRest = true;
      if (portDoor && built.port.door) throw new Reroll(`${piece.name} has a door of its own and needs the floor's lock too`);
      const door = portDoor ?? built.port.door;
      const port: DungeonLink = { a: anchor, b: built.port.room, ...(door ? { door } : {}) };
      for (const l of [port, ...built.links]) { g.links.push(l); pieceLinks.add(l); }
      for (const r of built.rooms) {
        g.pieceRooms.add(r.id);
        if (g.afterLock.has(anchor) || portDoor) g.afterLock.add(r.id);
        pieceRooms.push(r);
      }
      for (const sc of built.scenes) {
        if (scenes[sc.id]) throw new Error(`piece '${piece.id}' reuses scene id '${sc.id}'`);
        scenes[sc.id] = sc;
        if (sc.kind === 'battle' && sc.loot !== false) floorXp += encounterXP(sc.encounterId);
      }
    }

    // Required rooms first, so the rolls cannot take their places.
    const placed = new Map<Id, RequiredRoom>();
    for (const r of spec.require) {
      const floor = r.floor ?? (r.where === 'goal' ? spec.floors : 1);
      if (floor !== f) continue;
      const open = placesFor(g, r.where).filter((id) => !placed.has(id));
      if (open.length === 0) throw new Reroll(`no ${r.where ?? 'free'} room left on floor ${f} for '${r.name ?? 'a required room'}'`);
      placed.set(dice.pick(open), r);
    }

    // Ambushes on a corridor or two (never through a lock). Not on a held
    // floor: its holders come looking when it is roused (Dungeon.alarm).
    const held = holders.length > 0;
    for (const l of held ? [] : dice.shuffle(g.links.filter((x) => !x.door && !pieceLinks.has(x))).slice(0, dice.int(1, 2))) {
      const id = `${pre}ambush-${l.a}-${l.b}`;
      l.door = { ambush: { chance: 0.4, battle: id } };
      // Where the story caps the place's fights, a corridor ambush is a setback, not a payday.
      const capped = spec.maxFights !== undefined;
      const opens = factionOf(l.a)?.intros ?? T.outdoor?.fights;
      scenes[id] = { id, kind: 'battle', encounterId: fightOf(level, false, undefined, factionOf(l.a)), mapId: '@room',
        intro: [(capped || T.outdoor) && opens ? dice.pick(opens) : 'Something moves in the dark ahead of the torchlight.'], onWin: { to: '@hub' },
        ...(capped ? { loot: false as const } : {}) };
    }

    /*
     * A back way round the first lock, on a held floor whose lock is its own:
     * hidden, found by sharp eyes or a search, from a room before the lock to
     * the one just past it. A second answer to the locked door, besides its
     * keeper and forcing it. Never round a story's lock: that is the story's.
     */
    const firstLock = g.links.find((l) => l.door?.locked && !storyLock && g.keys[0] && l.door.locked.some((q) => q.kind === 'flag' && q.flag === g.keys[0]!.flag));
    if (held && kind && firstLock && dice.chance(0.6)) {
      const degree = (r: Id) => g.links.filter((l) => l.a === r || l.b === r).length;
      // Anywhere past the first lock and short of any other (the goal too: a
      // back way into the hall still meets whoever holds it). A room has four
      // sides, so one with three corridors has one left.
      const reach = new Set([firstLock.b]);
      for (let grew = true; grew;) {
        grew = false;
        for (const l of g.links) {
          if (l.door?.locked || l.door?.secret) continue;
          for (const [x, y] of [[l.a, l.b], [l.b, l.a]] as const) if (reach.has(x) && !reach.has(y) && g.afterLock.has(y)) { reach.add(y); grew = true; }
        }
      }
      // Never into a room the story keeps (its goal above all): the story
      // decides who may walk in on its hall.
      const to = [...reach].filter((id) => id !== g.vault && degree(id) < 4 && !placed.has(id) && !(id === goal && spec.require.some((r) => r.where === 'goal')));
      const from = g.main.filter((id) => !g.afterLock.has(id) && degree(id) < 4);
      if (from.length && to.length) {
        g.links.push({ a: dice.pick(from), b: dice.pick(to), length: 2, door: { secret: { dc: dice.int(12, 15) }, note: kind.backWay[T.outdoor ? 'out' : 'in'] } });
      }
    }

    const safe = new Set<Id>();
    const beforeLock = g.main.slice(1, -1).filter((id) => !g.afterLock.has(id) && !placed.has(id));
    // No safe bed inside a camp of people who know you are there: a place a
    // story dresses, held by people (not beasts), keeps its rest to the story.
    const hostile = !!dress && holders.some((h) => !h.beastly);
    if (beforeLock.length && !pieceGivesRest && !hostile) {
      /*
       * Never next to the goal. Resting is refused beside a room whose fight
       * is still to be had, and the goal's is had last — so a safe room on
       * the goal's doorstep could never once be slept in. Measured: whole
       * delves played through lost their boss fight far more often than a
       * fresh party does, because the party could not sleep before it, nor
       * after a wipe. Substituted without another roll, so a delve whose safe
       * room was already usable is built exactly as before.
       */
      const byGoal = (id: Id) => g.links.some((l) => (l.a === id && l.b === goal) || (l.b === id && l.a === goal));
      const pick = dice.pick(beforeLock);
      safe.add(byGoal(pick) ? beforeLock.find((x) => !byGoal(x)) ?? pick : pick);
    }
    const keyOf = new Map(g.keys.map((k) => [k.room, k.flag]));
    let filler = 0;
    // A held floor's pace: about half its cast rooms hold a fight. The roles
    // that fight come first, and rooms with no role make up the rest.
    const castable = [...g.main.slice(1, -1), ...g.side].filter((id) => id !== goal && id !== 'cache' && !placed.has(id) && !g.pieceRooms.has(id));
    const target = Math.round(castable.length * 0.5);
    /*
     * The gatekeeper: on a held floor (not one a story dresses), the deepest
     * room every open way to the goal runs through, held by the holders'
     * second. A back way may slip round it; nothing else does.
     */
    const gate = held && !dress ? cutRoom(g, goal, (id) => !placed.has(id) && !keyOf.has(id) && !safe.has(id) && !g.pieceRooms.has(id)) : undefined;
    const roleOf = held ? castRoles(g, goal, placed, safe, keyOf, dice, (id) => factionOf(id) ?? holders[0]!, !!T.outdoor, gate) : new Map<Id, Cast>();
    const rooms: DungeonRoom[] = [];

    const contents = (id: Id): DungeonRoom => {
      const req = placed.get(id);
      const isGoal = id === goal;
      const cast = roleOf.get(id);
      const room: DungeonRoom = { id, name: req?.name ?? (isGoal ? T.goal : id === 'cache' ? 'Hidden Cache' : cast?.name ?? nextName()),
        size: isGoal ? 'large' : id === 'cache' ? 'small' : sizeOf() };
      if (req?.text) room.firstVisit = [req.text];

      const key = keyOf.get(id);
      const goalWin = goalOutcome();
      const win: Win = key
        ? { to: '@hub', text: [cast ? ARCHETYPES[cast.faction.archetype]?.key ?? 'One of them carried a heavy key.' : 'One of them carried a heavy key.'], effects: [{ kind: 'setFlag', flag: key }] }
        : isGoal ? goalWin : { to: '@hub' };
      // A key room and a goal always fight; a required room fights if it says so.
      const reqFight = req?.fight;
      // A goal the story takes over (its own scene on walking in) is not
      // also a generated boss.
      const must = !!key || (isGoal && !req?.event);
      // With a gatekeeper on the floor, it is the floor's elite: the rest fight as rooms.
      const roleFight = cast?.role?.fight === 'elite' && gate && id !== gate ? 'room' : cast?.role?.fight;
      if (typeof reqFight === 'string') room.fight = fight(id, reqFight, win);
      else if (reqFight) room.fight = fight(id, fightOf(level, reqFight.boss ?? isGoal, reqFight.brief, factionOf(id)), win);
      else if (must) room.fight = fight(id, fightOf(level, isGoal ? true : roleFight ?? 'room', undefined, factionOf(id)), win);
      // A held floor's rooms fight as their role says (and a room with no
      // role, of the holders' own naming, half the time); any other floor's,
      // about half of them.
      else if (!req && id !== 'cache' && id !== g.vault && (cast ? (cast.role ? !!cast.role.fight : filler < target) : dice.chance(0.55)) && (filler < (spec.maxFights ?? Infinity) || id === gate)) {
        filler++;
        room.fight = fight(id, fightOf(level, roleFight ?? 'room', undefined, factionOf(id)), win);
      }
      // A role's line, once its fight is settled: who is here, or how they left it.
      if (!req?.text && cast?.role) {
        const own = T.outdoor && cast.role.out ? { text: cast.role.out.text, quiet: cast.role.out.quiet ?? cast.role.quiet } : cast.role;
        const lines = cast.role.fight && !room.fight ? own.quiet ?? [] : own.text;
        if (lines.length) room.firstVisit = [voice(dice.pick(lines), cast.faction, dice)];
      }
      if (isGoal) {
        room.goal = true;
        if (!last) room.exit = { to: `delve-${f + 1}`, label: 'Down the stairs' };
        // Held by someone: their leader has a name. Only then — a plain delve
        // rolls exactly as it always did.
        const fac = factionOf(id);
        const goalFight = room.fight ? scenes[room.fight] : undefined;
        if (fac && goalFight?.kind === 'battle' && !goalFight.intro) {
          const rng = () => dice.float();
          const lord = fac.beastly ? beastName(rng) : bossName(styleFor('delve', spec.theme, rng), dice.chance(0.5) ? 'female' : 'male', rng);
          goalFight.intro = [`${lord}, who leads ${dice.pick(fac.names)}, is waiting for you.`];
        }
      }
      if (req?.event) room.event = req.event;
      else if (req?.hostage) room.event = hostage(id, req.hostage);
      if (req?.exit) room.exit = req.exit;
      if (req?.rest) room.rest = req.rest;
      else if (safe.has(id)) Object.assign(room, { name: T.safe[0], rest: 'safe', firstVisit: [T.safe[1]] });
      const finds = cast?.role?.find;
      if (id === g.vault) {
        // The way out is past what the party came for.
        if (!req?.exit) room.exit = { to: 'won', label: 'Leave with what you came for' };
        if (!req && vaultKind === 'hostage') room.event = hostage(id);
      }
      if (req?.search) {
        room.search = req.search;
      } else if (id === g.vault && !req) {
        room.search = find(id, 'The best of everything they took: coin by the sackful, and a flask of something that glows.',
          [{ kind: 'gold', amount: 60 + 20 * level }, { kind: 'addItem', itemId: 'potion-greater-healing' }]);
      } else if (finds === 'lore') {
        const line = lore.shift() ?? (history ? dice.pick(history.traces) : undefined);
        if (line) room.search = read(id, line);
      } else if (finds === 'coin') {
        room.search = find(id, said('coin'), [{ kind: 'gold', amount: 15 + 10 * level }]);
      } else if (finds === 'potion' && dress) {
        // A place a story dresses hands out what its story does: no stray
        // potions on every shelf.
      } else if (finds === 'potion') {
        room.search = find(id, said('potion'), [{ kind: 'addItem', itemId: 'potion-healing' }]);
      } else if (req?.loot) {
        room.search = find(id, req.loot === 'gold' ? 'A purse, heavier than it looks.' : `Tucked away here: ${ITEMS[req.loot]!.name}.`,
          req.loot === 'gold' ? [{ kind: 'gold', amount: 30 + 10 * level }] : [{ kind: 'addItem', itemId: req.loot }]);
      } else if (id === 'cache' && dress) {
        // (A story's place: somebody's own stash, and no potion.)
        room.search = find(id, `Somebody's stash, wrapped in oilcloth: ${holders.length && !holders[0]!.beastly ? `the savings of ${dice.pick(holders[0]!.names.length ? [holders[0]!.one] : ['someone'])} who meant to run` : 'a purse nobody came back for'}.`,
          [{ kind: 'gold', amount: 20 + 10 * level }]);
      } else if (id === 'cache') {
        room.search = find(id, 'Someone hid their best here: coin, and a flask of something red.',
          [{ kind: 'gold', amount: 40 + 15 * level }, { kind: 'addItem', itemId: 'potion-greater-healing' }]);
      } else if (!req && !room.fight && !isGoal && !dress) {
        room.search = find(id, said('potion'), [{ kind: 'addItem', itemId: 'potion-healing' }]);
      } else if (!req && !isGoal && dice.chance(0.3)) {
        room.search = find(id, said('coin'), [{ kind: 'gold', amount: 10 + 5 * level }]);
      }
      return room;
    };

    g.main.forEach((id, i) => {
      if (i === 0) {
        rooms.push({ id, name: f === 1 ? T.outdoor?.entry ?? 'Entrance' : 'Stair Foot', size: 'small',
          firstVisit: [f === 1 ? T.enter : 'The stair ends, and the dark is deeper here.',
            // The first sign of whoever holds this floor.
            ...(factionOf(goal) ? [dice.pick(factionOf(goal)!.sign)] : [])],
          exit: f === 1 ? { to: 'outside', label: 'Back outside' } : { to: f === 2 ? 'delve' : `delve-${f - 1}`, label: 'Back up the stairs' } });
      } else if (id !== replacedGoal) rooms.push(contents(id));
    });
    for (const id of g.side) rooms.push(contents(id));
    if (g.vault) rooms.push(contents(g.vault));
    // The past showing through, in rooms that have nothing else to say.
    if (history) {
      for (const r of rooms) if (!r.firstVisit && r.id !== g.main[0] && dice.chance(0.35)) r.firstVisit = [dice.pick(history.traces)];
    }
    rooms.push(...pieceRooms);
    // The story's lore not yet told: in rooms with nothing else to search,
    // those on the way to the goal first (a party in a hurry walks past the
    // rest), nearest the goal first: its last line is the one read last.
    const onPath = (id: Id) => { const i = g.main.indexOf(id); return i < 0 ? -1 : i; };
    for (const r of lore.length ? rooms.filter((x) => !x.search && !x.goal && x.id !== g.main[0]).sort((a, b) => onPath(b.id) - onPath(a.id)) : []) {
      const line = lore.shift();
      if (!line) break;
      r.search = read(r.id, line);
    }

    // Held by someone: the place can be roused (Dungeon.alarm), and sends a
    // patrol of its own. Drawn after everything else, so a floor's rooms are
    // what they were before it had one.
    const holder = holders[0];
    let alarm: Dungeon['alarm'];
    if (holder) {
      const pid = `${pre}patrol`;
      const opens = holder.intros ?? T.outdoor?.fights;
      // A patrol is who they send when they mean it: an elite fight, drawn a
      // level up, since it finds a party that has fought its way in.
      scenes[pid] = { id: pid, kind: 'battle', encounterId: fightOf(Math.min(MAX_LEVEL, level + 1), 'elite', undefined, holder), mapId: '@room', loot: false,
        intro: [opens ? dice.pick(opens) : 'Someone has come looking for you.'], onWin: { to: '@hub' } };
      alarm = { patrols: [pid], rate: holder.beastly ? 0.05 : 0.1, roused: holder.roused ?? (holder.beastly ? ROUSED.beasts : ROUSED.people) };
    }

    const campId = `${pre}camp-fight`;
    scenes[campId] = {
      id: campId, kind: 'battle', encounterId: fightOf(level, false, undefined, holders[0]), mapId: '@room', loot: false,
      intro: ['Your fire draws them out of the dark.'], onWin: { to: '@hub' },
    };
    // On a deeper floor a dead torch is not the end of the trip: you feel
    // your way back to the stair and light another, as you would at the door.
    const out = f === 1 ? 'dark' : `${pre}dark`;
    if (f > 1 && !T.outdoor) {
      scenes[out] = { id: out, kind: 'story', noBack: true,
        text: ['The torch gutters and dies. You feel your way back to the foot of the stair and strike a new one.'],
        next: [{ id: 'on', label: 'Go on', to: sceneId }] };
    }
    const dungeon: Dungeon = {
      title: f === 1 ? title : `${title}, Level ${f}`, theme: T.board ?? (spec.theme as Dungeon['theme']), entry: g.main[0]!,
      camp: { risky: { chance: 0.5, battleScene: campId } }, rest: spec.rest, rooms, links: g.links,
      ...(dress ? { searchWhereFound: true as const } : {}),
      ...(T.outdoor ? { emptySearches: T.outdoor.empty } : {}),
      ...(alarm ? { alarm } : {}),
    };
    scenes[sceneId] = { id: sceneId, kind: 'dungeon', dungeon };
    goals.push([dungeon, goal, out]);
    level = levelAfter(level, floorXp);
  }

  Object.assign(scenes, {
    start: { id: 'start', kind: 'story', text: dress ? [dress.door] : [`The way into ${title} stands open.`, ...(history ? [history.story] : [])], next: [{ id: 'in', label: 'Go in', to: 'delve',
      effects: [{ kind: 'xpToLevel', level: spec.level }] }] },
    outside: { id: 'outside', kind: 'story', text: [dress?.outside ?? T.outdoor?.outside ?? 'Daylight, and air that does not smell of the deep.'], noBack: true,
      next: [{ id: 'in', label: dress?.back ?? 'Go back in', to: 'delve' }, { id: 'quit', label: dress?.leave ?? 'Leave it for someone else', to: 'gave-up' }] },
    // (Out of doors there is no torch to die.)
    ...(T.outdoor ? {} : { dark: { id: 'dark', kind: 'story', text: ['The torch gutters and dies. You feel your way back along the wall to the light.'], noBack: true,
      next: [{ id: 'out', label: 'Out', to: 'outside' }] } }),
    fallen: { id: 'fallen', kind: 'story', text: ['You come to outside, dragged clear by whoever was still standing.'], noBack: true,
      next: [{ id: 'up', label: 'Get up', to: 'outside' }] },
    won: { id: 'won', kind: 'ending', outcome: 'victory', text: [`${title} is quiet at last.`] },
    'gave-up': { id: 'gave-up', kind: 'ending', outcome: 'defeat', text: [`${title} keeps its secrets.`] },
  } satisfies Record<Id, Scene>);

  const module: Module = {
    id: `delve2-${seed}`, title,
    blurb: history ? history.story : `A generated delve (${spec.theme}, ${spec.shape}, ${spec.floors} floor${spec.floors > 1 ? 's' : ''}, level ${spec.level}).`,
    start: 'start', scenes, defeatScene: 'fallen', levelBand: { from: spec.level, to: Math.max(spec.level, level) },
  };
  // Walked with the story's scenes stood in: a story's lock opens only through them.
  const walked = withStandIns(module, spec.require);
  for (const [d, goal, out] of goals) {
    const cost = goalCost(walked, d, goal);
    if (cost !== undefined && !T.outdoor) d.torch = { length: cost + Math.max(4, Math.ceil(cost * 0.6)), out };
  }
  return module;
}

// base64url by hand: the browser has no Buffer.
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => new TextDecoder().decode(
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** A spec, as an id-safe string (and back): what a saved run rebuilds from. */
export const encodeSpec = (spec: unknown): string => b64(JSON.stringify(spec));
export const decodeSpec = (s: string): unknown => JSON.parse(unb64(s));

/** A spec delve's id: everything it was made from. */
export function specDelveId(seed: number, spec: DelveSpec): string {
  return `delve2-${seed}-${b64(JSON.stringify(spec))}`;
}

/** The spec delve an id names, rebuilt; undefined if it is not one. */
export function specDelveFromId(id: string): Module | undefined {
  const m = /^delve2-(\d+)-([A-Za-z0-9_-]+)$/.exec(id);
  if (!m) return undefined;
  try {
    return generateSpecDelve(Number(m[1]), JSON.parse(unb64(m[2]!)) as DelveSpec).module;
  } catch {
    return undefined;
  }
}

/**
 * A playable, validated delve built to `spec`. Deterministic in the seed and
 * the spec. Throws at once on a spec that cannot be met; otherwise tries
 * candidates until one passes every proof.
 */
/**
 * A delve proved on its own, before a story takes it in: the story's own
 * scenes its required rooms name are not here yet, so each stands in as the
 * simplest thing it could be — an event that does what it waits on and goes
 * back into the dark, a search that finds nothing, a way out that ends it.
 * The story's proofs see the real ones, spliced.
 */
function withStandIns(module: Module, require: readonly RequiredRoom[]): Module {
  const scenes: Record<Id, Scene> = { ...module.scenes };
  const stand = (id: Id, sc: Scene) => { if (!scenes[id]) scenes[id] = sc; };
  // Where the story takes over (its goal), whoever is still held is the
  // story's to settle: stood in as taken, so a quest to free them ends.
  const settle: Effect[] = require.flatMap((r) => (r.hostage ? [{ kind: 'setFlag' as const, flag: r.hostage.as.taken }] : []));
  for (const r of require) {
    for (const w of r.event?.when ?? []) {
      stand(w.to, { id: w.to, kind: 'story', noBack: true, text: ['(The story\'s own scene.)'], next: [{ id: 'on', label: 'On', to: '@hub' }] });
    }
    if (r.event) {
      const sets: Effect[] = [...(r.event.until ?? []).flatMap((q) => (q.kind === 'flag' ? [{ kind: 'setFlag' as const, flag: q.flag }] : [])),
        ...(r.where === 'goal' ? settle : [])];
      stand(r.event.scene, { id: r.event.scene, kind: 'story', noBack: true, text: ['(The story\'s own scene.)'],
        // A goal the story takes over is where the delve is won.
        next: [{ id: 'on', label: 'On', to: r.where === 'goal' ? 'won' : '@hub', ...(sets.length ? { effects: sets } : {}) }] });
    }
    if (r.search) stand(r.search, { id: r.search, kind: 'story', noBack: true, text: ['(The story\'s own search.)'], next: [{ id: 'on', label: 'On', to: '@hub' }] });
    if (r.exit) stand(r.exit.to, { id: r.exit.to, kind: 'ending', outcome: 'victory', text: ['(The story goes on.)'] });
  }
  return { ...module, scenes };
}

export function generateSpecDelve(
  seed: number, spec: DelveSpec = {}, story: ReadonlySet<string> = new Set(),
): { module: Module; rerolls: number } {
  const full = checkSpec(spec);
  let last: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    let module: Module;
    try {
      module = draftSpec(seed * 41 + attempt, full, story);
    } catch (e) {
      if (!(e instanceof Reroll)) throw e;
      last = [e.message];
      continue;
    }
    last = validateModule(withStandIns(module, full.require));
    if (last.length === 0) return { module: { ...module, id: specDelveId(seed, spec) }, rerolls: attempt };
  }
  throw new Error(`No valid delve for seed ${seed}: ${last.join('; ')}`);
}
