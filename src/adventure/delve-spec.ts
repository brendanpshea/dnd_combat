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
import type { Dungeon, DungeonLink, DungeonRoom, Module, Scene, RoomSize, Effect } from './types.js';
import { goalCost } from './dungeon.js';
import { validateModule } from './validate.js';
import { Dice, ROOMS, SIZE_ROOMS, encounterPools, type DelveOptions } from './dungeon-gen.js';
import { PIECES, type FightRole, type PieceWhere } from './delve-pieces.js';
import { FACTIONS, canHold, factionsFor, type Faction } from '../data/factions.js';
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

export type RoomPlace = 'goal' | 'main' | 'side' | 'beforeLock' | 'afterLock';

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
  /** Draw a past for the place: its title, its story, traces in the rooms. */
  history?: boolean;
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
export const ROOM_SHARE = 0.3;
export const BOSS_SHARE = 0.65;
/** A set piece's named foe: between the two. NOT calibrated or measured — the
 *  midpoint, until whole delves are played through to say otherwise. */
export const ELITE_SHARE = 0.45;

/** Throws on a spec no candidate could satisfy; returns it with defaults. */
export function checkSpec(spec: DelveSpec): Required<Omit<DelveSpec, 'size'>> & { size?: DelveSpec['size'] } {
  const err = (m: string) => { throw new Error(`Bad delve spec: ${m}`); };
  const level = spec.level ?? 2;
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) err(`level ${level} is not 1–${MAX_LEVEL}`);
  const floors = spec.floors ?? 1;
  if (!Number.isInteger(floors) || floors < 1 || floors > MAX_FLOORS) err(`floors ${floors} is not 1–${MAX_FLOORS}`);
  if (spec.theme && !SPEC_THEMES.includes(spec.theme)) err(`no theme '${spec.theme}'`);
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
}

function wire(shape: DelveShape, n: number, dice: Dice, floor: number, door: string): Graph {
  const flag = (k: number) => `delve-key-${floor}${k ? `-${k + 1}` : ''}`;
  const locked = (k: number): NonNullable<DungeonLink['door']> => ({
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
  chain(main, lockAt);
  main.forEach((id, i) => { if (i >= lockAt[0]!) afterLock.add(id); });
  const before = (k: number) => main.slice(0, lockAt[k]!).filter((_, i) => k === 0 || i >= lockAt[k - 1]!);

  // The keys: each hangs off the stretch before its own lock.
  lockAt.forEach((_, k) => {
    const room = k ? `key${k + 1}` : 'key';
    const anchor = shape === 'hub' ? 'm1' : dice.pick(before(k));
    hang(anchor, room);
    keys.push({ room, flag: flag(k) });
  });

  // Shape-specific connections.
  if (shape === 'classic' && lockAt[0]! <= main.length - 2 && dice.chance(0.7)) {
    const from = main[dice.int(lockAt[0]!, main.length - 2)]!;
    const to = main[dice.int(0, Math.max(0, lockAt[0]! - 2))]!;
    if (from !== to) links.push({ a: from, b: to, length: 2, door: { oneWay: true } });
  }
  if (shape === 'ring') {
    // A second way round, from just inside the door to the room before the lock.
    links.push({ a: 'm0', b: 'r1' }, { a: 'r1', b: 'r2' }, { a: 'r2', b: main[lockAt[0]! - 1]! });
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
  if (peopled || spec.history) {
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
  // The torch is set once the module exists, so its proof sees every scene.
  const goals: [Dungeon, Id, Id][] = [];

  /** A faction's leader and an escort, to the boss budget. */
  const leaderFight = (lvl: number, fac: Faction): Id | undefined => {
    const budget = Math.round(evenBudgetFor(lvl) * BOSS_SHARE);
    const cap = Math.min(memberCapFor(lvl), budget * 0.75);
    const fits = fac.leaders.filter((m) => (MONSTER_XP[m] ?? Infinity) <= cap);
    // Too low a level for any of its leaders: the biggest of its own that
    // fits leads instead, so the goal is still THEM and not a stranger.
    const stand = [...fac.members].filter((m) => (MONSTER_XP[m] ?? Infinity) <= cap)
      .sort((a, b) => (MONSTER_XP[b] ?? 0) - (MONSTER_XP[a] ?? 0)).slice(0, 1);
    const pool = fits.length ? fits : stand;
    if (pool.length === 0) return undefined;
    const leader = dice.pick(pool);
    const escort = generateEncounter({
      budget: Math.max(1, budget - (MONSTER_XP[leader] ?? 0) * 1.5), maxMemberXp: Math.min(memberCapFor(lvl), MONSTER_XP[leader] ?? 0),
      maxCount: Math.max(1, maxCountFor(lvl) - 1), partyLevel: lvl, members: fac.members,
    }, seedRng(Math.floor(dice.float() * 2 ** 31))).value.members;
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
    const share = role === 'boss' ? BOSS_SHARE : role === 'elite' ? ELITE_SHARE : ROOM_SHARE;
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
    const g = wire(spec.shape, n, dice, f, T.door);
    let goal = g.main[g.main.length - 1]!;
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
      scenes[id] = { id, kind: 'battle', encounterId: enc, mapId: '@room', onWin: win, ...talk };
      floorXp += encounterXP(enc);
      return id;
    };
    const find = (roomId: Id, text: string, effects: Effect[]): Id => {
      const id = `${pre}find-${roomId}`;
      scenes[id] = { id, kind: 'story', text: [text], next: [{ id: 'take', label: 'Take it', to: '@hub', effects }] };
      return id;
    };

    const goalOutcome = (): Win => (last
      ? { to: 'won', text: ['The last of them falls, and the place is yours.'], effects: [{ kind: 'gold', amount: 60 + 20 * level }] }
      : { to: '@hub', text: ['Past them, a stair goes down into the dark.'], effects: [{ kind: 'gold', amount: 20 + 10 * level }] });

    // Set pieces first: they bring rooms of their own, and the most demanding
    // claims go before anything else can take the corridors they need.
    let pieceGivesRest = false;
    const pieceLinks = new Set<DungeonLink>();
    const pieceRooms: DungeonRoom[] = [];
    // The first lock's flag, kept before a key piece can take over the key.
    const lockFlag = g.keys[0]?.flag;
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
      if (open.length === 0 && where === 'afterLock' && lockFlag) {
        open.push(...[...g.main.slice(0, -1), ...g.side]
          .filter((id) => id !== 'cache' && !g.pieceRooms.has(id) && !g.afterLock.has(id) && degree(id) < 3));
        portDoor = { locked: [{ kind: 'flag', flag: lockFlag }], note: T.door };
      }
      if (open.length === 0) throw new Reroll(`no ${where} corridor left on floor ${f} for ${piece.name}`);
      const anchor = dice.pick(open);
      const local = `p${i}`;
      const isKey = !!piece.gives?.includes('key');
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

    // Ambushes on a corridor or two (never through a lock).
    for (const l of dice.shuffle(g.links.filter((x) => !x.door && !pieceLinks.has(x))).slice(0, dice.int(1, 2))) {
      const id = `${pre}ambush-${l.a}-${l.b}`;
      l.door = { ambush: { chance: 0.4, battle: id } };
      scenes[id] = { id, kind: 'battle', encounterId: fightOf(level, false, undefined, factionOf(l.a)), mapId: '@room',
        intro: ['Something moves in the dark ahead of the torchlight.'], onWin: { to: '@hub' } };
    }

    const safe = new Set<Id>();
    const beforeLock = g.main.slice(1, -1).filter((id) => !g.afterLock.has(id) && !placed.has(id));
    if (beforeLock.length && !pieceGivesRest) safe.add(dice.pick(beforeLock));
    const keyOf = new Map(g.keys.map((k) => [k.room, k.flag]));
    const rooms: DungeonRoom[] = [];

    const contents = (id: Id): DungeonRoom => {
      const req = placed.get(id);
      const isGoal = id === goal;
      const room: DungeonRoom = { id, name: req?.name ?? (isGoal ? T.goal : id === 'cache' ? 'Hidden Cache' : nextName()),
        size: isGoal ? 'large' : id === 'cache' ? 'small' : sizeOf() };
      if (req?.text) room.firstVisit = [req.text];
      const key = keyOf.get(id);
      const goalWin = goalOutcome();
      const win: Win = key
        ? { to: '@hub', text: ['One of them carried a heavy key.'], effects: [{ kind: 'setFlag', flag: key }] }
        : isGoal ? goalWin : { to: '@hub' };
      // A key room and a goal always fight; a required room fights if it says so.
      const reqFight = req?.fight;
      const must = !!key || isGoal;
      if (typeof reqFight === 'string') room.fight = fight(id, reqFight, win);
      else if (reqFight) room.fight = fight(id, fightOf(level, reqFight.boss ?? isGoal, reqFight.brief, factionOf(id)), win);
      else if (must) room.fight = fight(id, fightOf(level, isGoal, undefined, factionOf(id)), win);
      else if (!req && id !== 'cache' && dice.chance(0.55)) room.fight = fight(id, fightOf(level, false, undefined, factionOf(id)), win);
      if (isGoal) {
        room.goal = true;
        if (!last) room.exit = { to: `delve-${f + 1}`, label: 'Down the stairs' };
      }
      if (req?.rest) room.rest = req.rest;
      else if (safe.has(id)) Object.assign(room, { name: T.safe[0], rest: 'safe', firstVisit: [T.safe[1]] });
      if (req?.loot) {
        room.search = find(id, req.loot === 'gold' ? 'A purse, heavier than it looks.' : `Tucked away here: ${ITEMS[req.loot]!.name}.`,
          req.loot === 'gold' ? [{ kind: 'gold', amount: 30 + 10 * level }] : [{ kind: 'addItem', itemId: req.loot }]);
      } else if (id === 'cache') {
        room.search = find(id, 'Someone hid their best here: coin, and a flask of something red.',
          [{ kind: 'gold', amount: 40 + 15 * level }, { kind: 'addItem', itemId: 'potion-greater-healing' }]);
      } else if (!req && !room.fight && !isGoal) {
        room.search = find(id, 'A pack left behind, with a potion still in it.', [{ kind: 'addItem', itemId: 'potion-healing' }]);
      } else if (!req && !isGoal && dice.chance(0.3)) {
        room.search = find(id, 'A few coins, dropped and forgotten.', [{ kind: 'gold', amount: 10 + 5 * level }]);
      }
      return room;
    };

    g.main.forEach((id, i) => {
      if (i === 0) {
        rooms.push({ id, name: f === 1 ? 'Entrance' : 'Stair Foot', size: 'small',
          firstVisit: [f === 1 ? T.enter : 'The stair ends, and the dark is deeper here.',
            // The first sign of whoever holds this floor.
            ...(factionOf(goal) ? [dice.pick(factionOf(goal)!.sign)] : [])],
          exit: f === 1 ? { to: 'outside', label: 'Back outside' } : { to: f === 2 ? 'delve' : `delve-${f - 1}`, label: 'Back up the stairs' } });
      } else if (id !== replacedGoal) rooms.push(contents(id));
    });
    for (const id of g.side) rooms.push(contents(id));
    // The past showing through, in rooms that have nothing else to say.
    if (history) {
      for (const r of rooms) if (!r.firstVisit && r.id !== g.main[0] && dice.chance(0.35)) r.firstVisit = [dice.pick(history.traces)];
    }
    rooms.push(...pieceRooms);

    const campId = `${pre}camp-fight`;
    scenes[campId] = {
      id: campId, kind: 'battle', encounterId: fightOf(level, false, undefined, holders[0]), mapId: '@room', loot: false,
      intro: ['Your fire draws them out of the dark.'], onWin: { to: '@hub' },
    };
    // On a deeper floor a dead torch is not the end of the trip: you feel
    // your way back to the stair and light another, as you would at the door.
    const out = f === 1 ? 'dark' : `${pre}dark`;
    if (f > 1) {
      scenes[out] = { id: out, kind: 'story', noBack: true,
        text: ['The torch gutters and dies. You feel your way back to the foot of the stair and strike a new one.'],
        next: [{ id: 'on', label: 'Go on', to: sceneId }] };
    }
    const dungeon: Dungeon = {
      title: f === 1 ? title : `${title}, Level ${f}`, theme: spec.theme, entry: g.main[0]!,
      camp: { risky: { chance: 0.5, battleScene: campId } }, rest: spec.rest, rooms, links: g.links,
    };
    scenes[sceneId] = { id: sceneId, kind: 'dungeon', dungeon };
    goals.push([dungeon, goal, out]);
    level = levelAfter(level, floorXp);
  }

  Object.assign(scenes, {
    start: { id: 'start', kind: 'story', text: [`The way into ${title} stands open.`, ...(history ? [history.story] : [])], next: [{ id: 'in', label: 'Go in', to: 'delve',
      effects: [{ kind: 'xpToLevel', level: spec.level }] }] },
    outside: { id: 'outside', kind: 'story', text: ['Daylight, and air that does not smell of the deep.'], noBack: true,
      next: [{ id: 'in', label: 'Go back in', to: 'delve' }, { id: 'quit', label: 'Leave it for someone else', to: 'gave-up' }] },
    dark: { id: 'dark', kind: 'story', text: ['The torch gutters and dies. You feel your way back along the wall to the light.'], noBack: true,
      next: [{ id: 'out', label: 'Out', to: 'outside' }] },
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
  for (const [d, goal, out] of goals) {
    const cost = goalCost(module, d, goal);
    if (cost !== undefined) d.torch = { length: cost + Math.max(4, Math.ceil(cost * 0.6)), out };
  }
  return module;
}

// base64url by hand: the browser has no Buffer.
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => new TextDecoder().decode(
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

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
    last = validateModule(module);
    if (last.length === 0) return { module: { ...module, id: specDelveId(seed, spec) }, rerolls: attempt };
  }
  throw new Error(`No valid delve for seed ${seed}: ${last.join('; ')}`);
}
