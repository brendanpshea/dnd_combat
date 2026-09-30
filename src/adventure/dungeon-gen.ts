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
import type { Dungeon, DungeonLink, DungeonRoom, Module, Scene, RoomSize } from './types.js';
import { goalCost } from './dungeon.js';
import { validateModule } from './validate.js';

export type DelveTheme = Extract<MapTheme, 'stone' | 'graveyard' | 'ember' | 'bog'>;
export const DELVE_THEMES: DelveTheme[] = ['stone', 'graveyard', 'ember', 'bog'];

export interface DelveOptions {
  /** Party level the fights are drawn for (default 2). */
  level?: number;
  theme?: DelveTheme;
  size?: 'small' | 'medium' | 'large';
}

const ROOMS: Record<DelveTheme, { title: string[]; rooms: string[]; goal: string; door: string; enter: string }> = {
  stone: {
    title: ['Broken Keep', 'Old Cistern', 'Warden\'s Hold', 'Sunless Mine'],
    rooms: ['Guardroom', 'Cistern', 'Collapsed Hall', 'Armory', 'Well Chamber', 'Barracks', 'Storeroom', 'Gallery', 'Cells', 'Pillared Hall', 'Stair Hall', 'Kitchens'],
    goal: 'Throne Room', door: 'An iron door, locked.', enter: 'Cold air breathes out of the dark, and your torch finds worked stone.',
  },
  graveyard: {
    title: ['Hollow Crypt', 'Bone Chapel', 'Weeping Barrow', 'Lantern Catacombs'],
    rooms: ['Ossuary', 'Charnel Pit', 'Chapel', 'Catacomb', 'Embalming Room', 'Bone Gallery', 'Reliquary', 'Mourners\' Hall', 'Niche Walk', 'Bell Crypt', 'Sexton\'s Room', 'Cairn Hall'],
    goal: 'Sepulchre', door: 'A grave-gate, chained shut.', enter: 'The steps go down past the dead, and the dead do not stay quiet.',
  },
  ember: {
    title: ['Cinder Forge', 'Ashen Deep', 'Slag Halls', 'Bellows Keep'],
    rooms: ['Forge', 'Slag Pit', 'Bellows Hall', 'Cinder Vault', 'Smelter', 'Ash Gallery', 'Quench Room', 'Ore Store', 'Coal Chute', 'Anvil Hall', 'Mould Room', 'Flue'],
    goal: 'Great Forge', door: 'A furnace door, barred and hot to the touch.', enter: 'Heat rolls up the passage. Somewhere below, something is still burning.',
  },
  bog: {
    title: ['Drowned Hall', 'Reedmire Cellars', 'Sinking Abbey', 'Mudroot Caves'],
    rooms: ['Sunken Hall', 'Reed Chamber', 'Drowned Crypt', 'Mud Cellar', 'Root Cave', 'Frog Pools', 'Silt Gallery', 'Leech Pit', 'Peat Store', 'Moss Hall', 'Eel Run', 'Weir Room'],
    goal: 'Drowned Altar', door: 'A swollen door, locked and slick with weed.', enter: 'Black water stands in the doorway. The walls sweat.',
  },
};

const SIZE_ROOMS: Record<NonNullable<DelveOptions['size']>, [number, number]> = {
  small: [6, 7], medium: [8, 10], large: [11, 13],
};

/** A little rng helper that threads the state. */
class Dice {
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
function encounterPools(level: number): { room: Id[]; boss: Id[] } {
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
function draft(seed: number, opts: Required<DelveOptions>): Module {
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

  main.forEach((id, i) => {
    if (i === 0) {
      rooms.push({ id, name: 'Entrance', size: 'small', firstVisit: [T.enter], exit: { to: 'outside', label: 'Back outside' } });
    } else if (i === mainLen - 1) {
      rooms.push({ id, name: T.goal, size: 'large', goal: true,
        fight: fight(id, dice.pick(pools.boss), { to: 'won', text: ['The last of them falls, and the place is yours.'], effects: [{ kind: 'gold', amount: 60 + 20 * opts.level }] }) });
    } else {
      rooms.push({ id, name: nextName(), size: sizeOf(),
        ...(dice.chance(0.6) ? { fight: fight(id, dice.pick(pools.room), { to: '@hub' }) } : {}),
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
    camp: { risky: { chance: 0.3, battleScene: 'camp-fight' } },
    rooms, links,
  };
  scenes['camp-fight'] = {
    id: 'camp-fight', kind: 'battle', encounterId: dice.pick(pools.room), mapId: '@room',
    intro: ['Your fire draws them out of the dark.'], onWin: { to: '@hub' },
  };
  Object.assign(scenes, {
    start: { id: 'start', kind: 'story', text: [`The way into ${title} stands open.`], next: [{ id: 'in', label: 'Go in', to: 'delve' }] },
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
 * A playable, validated delve. Deterministic in `seed` and the options; tries
 * successive candidates until one passes every proof.
 */
export function generateDelve(seed: number, opts: DelveOptions = {}): { module: Module; rerolls: number } {
  const dice = new Dice(seedRng(seed ^ 0x5eed));
  const full: Required<DelveOptions> = {
    level: opts.level ?? 2,
    theme: opts.theme ?? dice.pick(DELVE_THEMES),
    size: opts.size ?? dice.pick(['small', 'medium', 'large'] as const),
  };
  let last: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const module = draft(seed * 41 + attempt, full);
    last = validateModule(module);
    if (last.length === 0) return { module: { ...module, id: `delve-${seed}` }, rerolls: attempt };
  }
  throw new Error(`No valid delve for seed ${seed}: ${last.join('; ')}`);
}
