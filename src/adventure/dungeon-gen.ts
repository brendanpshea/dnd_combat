/**
 * Generated dungeons, as playable modules.
 *
 * Three passes, in the order the "cyclic" school of dungeon generation uses
 * (Unexplored, Dormans): decide what the place is FOR before deciding what it
 * looks like.
 *
 *   1. The story of it, as a graph. A main path from the door to the goal, a
 *      locked door on it, and the key off to one side before the lock. A
 *      one-way shortcut from beyond the lock back towards the door — the
 *      loop that makes a place feel built rather than strung. Side rooms, one
 *      of them behind a secret door.
 *   2. What is in each room: fights, finds, the key-holder, the boss, drawn
 *      from the theme's tables and the encounters written for the level.
 *   3. The layout, by the same `layoutDungeon` a hand-written dungeon gets.
 *
 * The output is an ordinary Module, so nothing downstream knows it was
 * generated — and the validator's proofs (reachable, solvable, no traps, the
 * torch lasts, it draws) are the generator's acceptance test. A candidate that
 * fails any of them is thrown away and the next seed tried.
 */
import type { Id } from '../engine/types.js';
import type { MapTheme } from '../data/maps.js';
import { next, seedRng, type RngState } from '../engine/rng.js';
import { ENCOUNTERS } from '../data/encounters.js';
import type { Dungeon, DungeonLink, DungeonRoom, Module, Scene, RoomSize, RestPolicy } from './types.js';
import { goalCost } from './dungeon.js';
import { validateModule } from './validate.js';

export type DelveTheme = Extract<MapTheme, 'stone' | 'graveyard' | 'ember' | 'bog'>;
export const DELVE_THEMES: DelveTheme[] = ['stone', 'graveyard', 'ember', 'bog'];

export interface DelveOptions {
  /** Party level the fights are drawn for (default 2). */
  level?: number;
  theme?: DelveTheme;
  size?: 'small' | 'medium' | 'large';
  /** How the party may rest (see RestPolicy). Default 'standard'. */
  rest?: RestPolicy;
}

/** Out-of-doors themes: no torch, no cellar talk, a camp's own words. Never
 *  drawn by a classic delve (DELVE_THEMES), so its seeds build as before. */
export const OUTDOOR_THEMES = ['marsh', 'stockade'] as const;
export const ROOMS: Record<DelveTheme | 'forest' | 'village' | typeof OUTDOOR_THEMES[number], {
  title: string[]; rooms: string[]; goal: string; door: string; enter: string; safe: [string, string];
  /** The board its fights are drawn on, where that is not its own name. */
  board?: MapTheme;
  /** Out of doors: the first room's name, what stepping back out says, and
   *  what a search that finds nothing turns up. No torch. */
  outdoor?: { entry: string; outside: string; empty: string[]; fights: string[] };
}> = {
  stone: {
    title: ['Broken Keep', 'Old Cistern', 'Warden\'s Hold', 'Sunless Mine'],
    rooms: ['Guardroom', 'Cistern', 'Collapsed Hall', 'Armory', 'Well Chamber', 'Barracks', 'Storeroom', 'Gallery', 'Cells', 'Pillared Hall', 'Stair Hall', 'Kitchens'],
    safe: ['Barred Storeroom', 'A storeroom whose door still bars from the inside. Somewhere you could sleep.'],
    goal: 'Throne Room', door: 'An iron door, locked.', enter: 'Cold air breathes out of the dark, and your torch finds worked stone.',
  },
  graveyard: {
    title: ['Hollow Crypt', 'Bone Chapel', 'Weeping Barrow', 'Lantern Catacombs'],
    rooms: ['Ossuary', 'Charnel Pit', 'Chapel', 'Catacomb', 'Embalming Room', 'Bone Gallery', 'Reliquary', 'Mourners\' Hall', 'Niche Walk', 'Bell Crypt', 'Sexton\'s Room', 'Cairn Hall'],
    safe: ['Quiet Shrine', 'A small shrine, its candles long out. Nothing that walks here comes in. You could rest.'],
    goal: 'Sepulchre', door: 'A grave-gate, chained shut.', enter: 'The steps go down past the dead, and the dead do not stay quiet.',
  },
  ember: {
    title: ['Cinder Forge', 'Ashen Deep', 'Slag Halls', 'Bellows Keep'],
    rooms: ['Forge', 'Slag Pit', 'Bellows Hall', 'Cinder Vault', 'Smelter', 'Ash Gallery', 'Quench Room', 'Ore Store', 'Coal Chute', 'Anvil Hall', 'Mould Room', 'Flue'],
    safe: ['Cooling Room', 'A stone room off the heat, with a door that shuts tight. A place to sleep, if you dare.'],
    goal: 'Great Forge', door: 'A furnace door, barred and hot to the touch.', enter: 'Heat rolls up the passage. Somewhere below, something is still burning.',
  },
  bog: {
    title: ['Drowned Hall', 'Reedmire Cellars', 'Sinking Abbey', 'Mudroot Caves'],
    rooms: ['Sunken Hall', 'Reed Chamber', 'Drowned Crypt', 'Mud Cellar', 'Root Cave', 'Frog Pools', 'Silt Gallery', 'Leech Pit', 'Peat Store', 'Moss Hall', 'Eel Run', 'Weir Room'],
    safe: ['Dry Loft', 'A loft above the waterline, reached by one ladder you can pull up. Dry enough to sleep.'],
    goal: 'Drowned Altar', door: 'A swollen door, locked and slick with weed.', enter: 'Black water stands in the doorway. The walls sweat.',
  },
  // Spec-only themes: not in DELVE_THEMES, so a classic delve never draws
  // them and every classic seed still builds the dungeon it always did.
  forest: {
    title: ['Thornwood Hollow', 'Greenmarch Ruin', 'Wolfwater Glade', 'Briar Barrow'],
    rooms: ['Clearing', 'Bramble Path', 'Hollow Oak', 'Fern Gully', 'Ruined Lodge', 'Mossy Ring', 'Old Shrine', 'Deadfall', 'Stream Ford', 'Woodcutter\'s Camp', 'Badger Sett', 'Bone Glade'],
    safe: ['Hunter\'s Blind', 'A blind of woven branches, high in an oak. Nothing below will see a fire this small.'],
    goal: 'Heart Tree', door: 'A wall of thorn, too thick to walk through.', enter: 'The trees close overhead, and the path goes on without the daylight.',
  },
  village: {
    title: ['Hollowmere', 'Ashby Green', 'Lantern Row', 'Crowfield'],
    rooms: ['Market Square', 'Smithy', 'Inn Common Room', 'Mill', 'Granary', 'Chapel', 'Well Yard', 'Tannery', 'Cooper\'s Shed', 'Reeve\'s House', 'Stable', 'Bakehouse'],
    safe: ['Locked Cellar', 'A cellar with a stout door and a bar for it. You could sleep here, in turns.'],
    goal: 'Manor Hall', door: 'The manor gate, chained.', enter: 'The village is shuttered and silent. Every door is shut, and something is watching.',
  },
  // Out of doors (OUTDOOR_THEMES): a road through the reeds…
  marsh: {
    title: ['Reed Cut', 'Blackwater Causeway', 'Heron Fen', 'Drowned Lanes', 'Eelmere', 'Sedge Road'],
    rooms: ['Reed Bed', 'Causeway', 'Sinkhole', 'Heron Rookery', 'Drowned Hut', 'Eel Weir', 'Peat Bank', 'Willow Island', 'Black Pool', 'Cut Reeds', 'Rush Flats', 'Old Ford',
      'Plank Walk', 'Sedge Meadow', 'Frog Shallows', 'Bog Oak', 'Leech Ditch', 'Mist Hollow', 'Fowler\'s Blind', 'Sunk Cart', 'Wisp Pool', 'Stake Line', 'Otter Bank', 'Reedcutter\'s Hut'],
    safe: ['Dry Hummock', 'A hump of firm ground, high enough above the water for a fire. You could camp here.'],
    goal: 'The Hollow', door: 'The reeds close in over black water, too deep to wade.', enter: 'Planks and tussocks lead off into the reeds. Behind you, the last fence-post leans in the mud.',
    board: 'bog',
    outdoor: {
      entry: 'Trailhead', outside: 'The reeds open, and firm ground runs dry under your boots.',
      empty: ['Mud, and the bones of something small.', 'A boot, with nobody\'s foot in it.', 'Water seeps into every hole you make.', 'Reeds, and more reeds. Nothing in them but frogs.'],
      fights: ['The water is colder here than it should be, and it moves when you stop.', 'Something heavy slides off a tussock into the water, and then the water comes for you.',
        'Every frog in the reeds goes quiet at once.', 'The mist ahead thickens into shapes, and the shapes come on.'],
    },
  },
  // …and a camp behind a wall of stakes.
  stockade: {
    title: ['Burnt Mill Camp', 'Raiders\' Stockade', 'Ditch Camp', 'Gallows Camp', 'Black Fair', 'Stake Wall'],
    rooms: ['Tents', 'Cook Fire', 'Stolen Carts', 'Watch Platform', 'Horse Lines', 'Drying Racks', 'Dice Fire', 'Midden', 'Armourer\'s Tent', 'Smoke Hut', 'Water Butts', 'Wood Pile',
      'Latrine Ditch', 'Plunder Heap', 'Branding Post', 'Rope Store', 'Grain Sacks', 'Butcher\'s Block', 'Slave Pen', 'Ale Barrels', 'Sharpening Wheel', 'Sentry Gap', 'Stockade Corner', 'Burnt Wagon'],
    safe: ['Empty Tent', 'A tent nobody has slept in for a while, at the dark end of the lines. Quiet enough to rest in, in turns.'],
    goal: 'Chief\'s Hall', door: 'A gate of lashed timber, barred from the far side.', enter: 'Tents and cook-smoke inside a wall of stakes. Somewhere a dog, or something like one, is laughing.',
    board: 'village',
    outdoor: {
      entry: 'Gate', outside: 'You slip back out past the stakes, and the camp\'s noise drops behind you.',
      empty: ['Fleas, and a blanket you would not wish on an enemy.', 'Gnawed bones and empty bottles.', 'Someone\'s stash, already found by someone else.', 'Ashes, and a spoon.'],
      fights: ['Two of them come out of a tent still buckling on stolen mail.', 'A raider looks up from the fire with his mouth full, and shouts with it.',
        'They were throwing dice for a carter\'s boots. They stop.', 'A sentry on the platform yells, and the whole lines wake up.'],
    },
  },
};

export const SIZE_ROOMS: Record<NonNullable<DelveOptions['size']>, [number, number]> = {
  small: [6, 7], medium: [8, 10], large: [11, 13],
};

/** A little rng helper that threads the state. */
export class Dice {
  constructor(public state: RngState) {}
  float(): number { const r = next(this.state); this.state = r.state; return r.value; }
  int(lo: number, hi: number): number { return lo + Math.floor(this.float() * (hi - lo + 1)); }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.float() * xs.length)]!; }
  chance(p: number): boolean { return this.float() < p; }
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(this.float() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; }
    return xs;
  }
}

/** Encounters fit for a room, and for the boss, at `level`. */
export function encounterPools(level: number): { room: Id[]; boss: Id[] } {
  const all = Object.values(ENCOUNTERS);
  const room = all.filter((e) => e.suggestedLevel >= Math.max(1, level - 1) && e.suggestedLevel <= level).map((e) => e.id);
  const bossLevel = Math.min(level + 1, Math.max(...all.map((e) => e.suggestedLevel)));
  const boss = all.filter((e) => e.suggestedLevel === bossLevel).map((e) => e.id);
  return {
    room: room.length ? room : all.filter((e) => e.suggestedLevel <= level + 1).map((e) => e.id),
    boss: boss.length ? boss : all.map((e) => e.id),
  };
}

/** One candidate: the graph, its contents, and the scenes around it. */
/**
 * `legacy` rebuilds a delve saved before rest-by-room existed, exactly: none of
 * the safe-room rolls (they would shift every roll after them and hand the save
 * a different dungeon than the one its progress was recorded against), the old
 * whole-dungeon camp, and the old interruption odds.
 */
function draft(seed: number, opts: Required<DelveOptions>, legacy = false): Module {
  const dice = new Dice(seedRng(seed));
  const T = ROOMS[opts.theme];
  const [lo, hi] = SIZE_ROOMS[opts.size];
  const n = dice.int(lo, hi);
  const names = dice.shuffle([...T.rooms]);
  const pools = encounterPools(opts.level);
  const scenes: Record<Id, Scene> = {};
  const rooms: DungeonRoom[] = [];
  const links: DungeonLink[] = [];
  const KEY = 'delve-key';

  // 1. The story: the main path, the lock on it, the key before it.
  const mainLen = Math.max(4, Math.round(n * 0.5));
  const main = Array.from({ length: mainLen }, (_, i) => `m${i}`);
  const lockAt = dice.int(2, mainLen - 1);              // the link main[lockAt-1] → main[lockAt]
  for (let i = 1; i < mainLen; i++) {
    const link: DungeonLink = { a: main[i - 1]!, b: main[i]! };
    if (i === lockAt) {
      link.door = {
        locked: [{ kind: 'flag', flag: KEY }], note: T.door,
        ...(dice.chance(0.5) ? { force: { skill: 'athletics' as const, dc: dice.int(14, 17) } } : {}),
      };
    }
    links.push(link);
  }
  const side: Id[] = [];
  const keyRoom = 'key';
  links.push({ a: main[dice.int(0, lockAt - 1)]!, b: keyRoom });
  side.push(keyRoom);
  // The loop: a one-way way back from beyond the lock towards the door.
  // (Only where there is a room beyond the lock that is not the goal.)
  if (lockAt <= mainLen - 2 && dice.chance(0.7)) {
    const from = main[dice.int(lockAt, mainLen - 2)]!;
    const to = main[dice.int(0, Math.max(0, lockAt - 2))]!;
    if (from !== to) links.push({ a: from, b: to, length: 2, door: { oneWay: true } });
  }
  // Side rooms hang off anything already built, the treasure room behind a secret door.
  const treasure = 'cache';
  const extra = n - mainLen - 1;
  for (let i = 0; i < extra; i++) {
    const id = i === 0 ? treasure : `s${i}`;
    const anchor = dice.pick([...main.slice(0, mainLen - 1), ...side]);
    links.push({ a: anchor, b: id, ...(id === treasure ? { door: { secret: { dc: dice.int(12, 16) } } } : {}) });
    side.push(id);
  }
  // Something in the dark along a corridor or two.
  const walkable = links.filter((l) => !l.door);
  for (const l of dice.shuffle([...walkable]).slice(0, dice.int(1, 2))) {
    const id = `ambush-${l.a}-${l.b}`;
    l.door = { ambush: { chance: 0.4, battle: id } };
    scenes[id] = {
      id, kind: 'battle', encounterId: dice.pick(pools.room), mapId: '@room',
      intro: ['Something moves in the dark ahead of the torchlight.'],
      onWin: { to: '@hub' },
    };
  }

  // 2. What is in the rooms.
  let nameIdx = 0;
  const nextName = () => names[nameIdx++ % names.length]!;
  const sizeOf = (): RoomSize => dice.pick(['small', 'medium', 'medium', 'large'] as const);
  const fight = (roomId: Id, enc: Id, win: Extract<Scene, { kind: 'battle' }>['onWin']): Id => {
    const id = `fight-${roomId}`;
    scenes[id] = { id, kind: 'battle', encounterId: enc, mapId: '@room', onWin: win };
    return id;
  };
  const find = (roomId: Id, text: string, effects: NonNullable<Extract<Scene, { kind: 'story' }>['next'][number]['effects']>): Id => {
    const id = `find-${roomId}`;
    scenes[id] = { id, kind: 'story', text: [text], next: [{ id: 'take', label: 'Take it', to: '@hub', effects }] };
    return id;
  };

  /*
   * Where a night's sleep is possible (standard policy). One before the lock,
   * so a party can always reach it, and sometimes a second past it as a
   * reward for getting through. Never the entrance or the goal: the entrance
   * is the way out (rest outside is free), and the goal is the end.
   */
  const safe = new Set<Id>();
  if (!legacy) {
    // Never on the goal's doorstep (main[mainLen - 2]): resting is refused
    // beside a fight still to be had, and the goal's is had last, so a safe
    // room there could never be slept in. One step back instead, with no
    // extra roll, so every other delve is built exactly as before.
    const off = (i: number, lo: number) => (i === mainLen - 2 && i - 1 >= lo ? i - 1 : i === mainLen - 2 ? -1 : i);
    const first = off(dice.int(1, lockAt - 1), 1);
    if (first >= 0) safe.add(main[first]!);
    if (lockAt < mainLen - 1 && dice.chance(0.5)) {
      const second = off(dice.int(lockAt, mainLen - 2), lockAt);
      if (second >= 0) safe.add(main[second]!);
    }
  }
  const safeName = (id: Id) => (safe.has(id) ? { name: T.safe[0], rest: 'safe' as const, firstVisit: [T.safe[1]] } : {});

  main.forEach((id, i) => {
    if (i === 0) {
      rooms.push({ id, name: 'Entrance', size: 'small', firstVisit: [T.enter], exit: { to: 'outside', label: 'Back outside' } });
    } else if (i === mainLen - 1) {
      rooms.push({ id, name: T.goal, size: 'large', goal: true,
        fight: fight(id, dice.pick(pools.boss), { to: 'won', text: ['The last of them falls, and the place is yours.'], effects: [{ kind: 'gold', amount: 60 + 20 * opts.level }] }) });
    } else {
      rooms.push({ id, name: nextName(), size: sizeOf(),
        ...(dice.chance(0.6) ? { fight: fight(id, dice.pick(pools.room), { to: '@hub' }) } : {}),
        ...safeName(id),
        ...(dice.chance(0.3) ? { search: find(id, 'A few coins, dropped and forgotten.', [{ kind: 'gold', amount: 10 + 5 * opts.level }]) } : {}) });
    }
  });
  for (const id of side) {
    if (id === keyRoom) {
      rooms.push({ id, name: nextName(), size: sizeOf(),
        fight: fight(id, dice.pick(pools.room), { to: '@hub', text: ['One of them carried a heavy key.'], effects: [{ kind: 'setFlag', flag: KEY }] }) });
    } else if (id === treasure) {
      rooms.push({ id, name: 'Hidden Cache', size: 'small',
        search: find(id, 'Someone hid their best here: coin, and a flask of something red.',
          [{ kind: 'gold', amount: 40 + 15 * opts.level }, { kind: 'addItem', itemId: 'potion-greater-healing' }]) });
    } else if (dice.chance(0.5)) {
      rooms.push({ id, name: nextName(), size: sizeOf(), fight: fight(id, dice.pick(pools.room), { to: '@hub' }) });
    } else {
      rooms.push({ id, name: nextName(), size: sizeOf(),
        search: find(id, 'A pack left behind, with a potion still in it.', [{ kind: 'addItem', itemId: 'potion-healing' }]) });
    }
  }

  const title = `The ${dice.pick(T.title)}`;
  const dungeon: Dungeon = {
    title, theme: opts.theme, entry: main[0]!,
    // The base chance a night is broken up; the room and how much of the place
    // is still awake scale it down (see `restOptions`).
    camp: { risky: { chance: legacy ? 0.3 : 0.5, battleScene: 'camp-fight' } },
    ...(legacy ? {} : { rest: opts.rest }),
    rooms, links,
  };
  scenes['camp-fight'] = {
    // A broken night is a setback, not a payday: no XP, no loot, or resting
    // becomes the way to farm the place.
    id: 'camp-fight', kind: 'battle', encounterId: dice.pick(pools.room), mapId: '@room', ...(legacy ? {} : { loot: false as const }),
    intro: ['Your fire draws them out of the dark.'], onWin: { to: '@hub' },
  };
  Object.assign(scenes, {
    start: { id: 'start', kind: 'story', text: [`The way into ${title} stands open.`], next: [{ id: 'in', label: 'Go in', to: 'delve',
      // A party fresh from the setup screen is brought up to the delve's level.
      effects: [{ kind: 'xpToLevel', level: opts.level }] }] },
    delve: { id: 'delve', kind: 'dungeon', dungeon },
    outside: { id: 'outside', kind: 'story', text: ['Daylight, and air that does not smell of the deep.'], noBack: true,
      next: [{ id: 'in', label: 'Go back in', to: 'delve' }, { id: 'quit', label: 'Leave it for someone else', to: 'gave-up' }] },
    dark: { id: 'dark', kind: 'story', text: ['The torch gutters and dies. You feel your way back along the wall to the light.'], noBack: true,
      next: [{ id: 'out', label: 'Out', to: 'outside' }] },
    fallen: { id: 'fallen', kind: 'story', text: ['You come to outside, dragged clear by whoever was still standing.'], noBack: true,
      next: [{ id: 'up', label: 'Get up', to: 'outside' }] },
    won: { id: 'won', kind: 'ending', outcome: 'victory', text: [`${title} is quiet at last.`] },
    'gave-up': { id: 'gave-up', kind: 'ending', outcome: 'defeat', text: [`${title} keeps its secrets.`] },
  } satisfies Record<Id, Scene>);

  // The torch: enough for the proven route to the goal, and some to spare.
  const module: Module = {
    id: `delve-${seed}`, title, blurb: `A generated delve (${opts.theme}, level ${opts.level}).`,
    start: 'start', scenes, defeatScene: 'fallen', levelBand: { from: opts.level, to: opts.level },
  };
  const cost = goalCost(module, dungeon, main[mainLen - 1]!);
  if (cost !== undefined) dungeon.torch = { length: cost + Math.max(4, Math.ceil(cost * 0.6)), out: 'dark' };
  return module;
}

/**
 * A delve's id carries everything it was made from, so a saved run can be
 * rebuilt exactly: `delve-<seed>-<theme>-<size>-<level>`.
 */
export function delveId(seed: number, o: Required<DelveOptions>): string {
  return `delve-${seed}-${o.theme}-${o.size}-${o.level}-${o.rest}`;
}

/** The delve an id names, rebuilt; undefined if it is not a delve id. */
export function delveFromId(id: string): Module | undefined {
  // The rest policy was added later; an id without one is a delve saved before
  // it, and is rebuilt the way it was generated then — rest anywhere.
  const m = /^delve-(\d+)-(stone|graveyard|ember|bog)-(small|medium|large)-(\d+)(?:-(harsh|standard|forgiving))?$/.exec(id);
  if (!m) return undefined;
  const opts: DelveOptions = { theme: m[2] as DelveTheme, size: m[3] as NonNullable<DelveOptions['size']>, level: Number(m[4]) };
  if (m[5]) return generateDelve(Number(m[1]), { ...opts, rest: m[5] as RestPolicy }).module;
  return legacyDelve(Number(m[1]), opts);
}

/**
 * A playable, validated delve. Deterministic in `seed` and the options; tries
 * successive candidates until one passes every proof.
 */
export function generateDelve(seed: number, opts: DelveOptions = {}): { module: Module; rerolls: number } {
  return build(seed, opts, false);
}

/** A delve saved before rest-by-room, rebuilt as it was generated then. */
function legacyDelve(seed: number, opts: DelveOptions): Module {
  return build(seed, opts, true).module;
}

function build(seed: number, opts: DelveOptions, legacy: boolean): { module: Module; rerolls: number } {
  const dice = new Dice(seedRng(seed ^ 0x5eed));
  const full: Required<DelveOptions> = {
    level: opts.level ?? 2,
    theme: opts.theme ?? dice.pick(DELVE_THEMES),
    size: opts.size ?? dice.pick(['small', 'medium', 'large'] as const),
    rest: opts.rest ?? 'standard',
  };
  let last: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const module = draft(seed * 41 + attempt, full, legacy);
    last = validateModule(module);
    if (last.length === 0) {
      const id = legacy ? `delve-${seed}-${full.theme}-${full.size}-${full.level}` : delveId(seed, full);
      return { module: { ...module, id }, rerolls: attempt };
    }
  }
  throw new Error(`No valid delve for seed ${seed}: ${last.join('; ')}`);
}
