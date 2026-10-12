/**
 * Delves to order: shapes, floors, required rooms, generated fights.
 */
import { describe, it, expect } from 'vitest';
import {
  generateSpecDelve, specDelveFromId, checkSpec, DELVE_SHAPES, SPEC_THEMES, ROOM_SHARE, BOSS_SHARE,
  type DelveSpec,
} from '../src/adventure/delve-spec.js';
import { validateModule } from '../src/adventure/validate.js';
import { goalCost } from '../src/adventure/dungeon.js';
import {
  startAdventure, enterScene, currentScene, legalChoices, choose, resolveBattle, battleWonBefore,
  dungeonExits, walkTo, forceDoor, canSearch, searchRoom, dungeonExitHere, leaveDungeon,
} from '../src/adventure/runtime.js';
import { newCampaign, xpAward, levelForXp } from '../src/campaign/campaign.js';
import { encounterFor } from '../src/data/encounters.js';
import { adjustedXp } from '../src/arena/encounter.js';
import { evenBudgetFor } from '../src/arena/run.js';
import type { Dungeon, Module } from '../src/adventure/types.js';

const floorsOf = (m: Module): [string, Dungeon][] =>
  Object.values(m.scenes).flatMap((s) => (s.kind === 'dungeon' ? [[s.id, s.dungeon] as [string, Dungeon]] : []));
const battles = (m: Module) => Object.values(m.scenes).flatMap((s) => (s.kind === 'battle' ? [s] : []));

/**
 * A player who means to get to the bottom: takes the stairs down whenever it
 * stands on them, never the way back up or out, and otherwise wanders. A
 * purely random walker wanders three floors for tens of thousands of steps,
 * because the stair up is one choice in four on every stair foot.
 */
function playDown(module: Module, seed: number): { ending: string; xp: number } {
  const state = startAdventure(newCampaign(seed), module);
  enterScene(state, module, module.start);
  let n = seed;
  const roll = (k: number) => { n = (n * 1103515245 + 12345) % 2147483648; return Math.floor((n / 2147483648) * k); };
  for (let step = 0; step < 20000; step++) {
    const scene = currentScene(state, module);
    if (scene.kind === 'ending') return { ending: scene.outcome, xp: state.campaign.xp };
    if (scene.kind === 'battle') {
      if (scene.loot !== false && !battleWonBefore(state, scene.id)) state.campaign.xp += xpAward(scene.encounterId, state.campaign.characters.length);
      resolveBattle(state, module, true);
    } else if (scene.kind === 'dungeon') {
      const exit = dungeonExitHere(state, module);
      if (exit && /^delve-\d$/.test(exit.to) && exit.label === 'Down the stairs') { leaveDungeon(state, module); continue; }
      if (canSearch(state, module)) { searchRoom(state, module); continue; }
      const doors = dungeonExits(state, module);
      const open = doors.filter((x) => !x.blocked);
      const forcible = doors.filter((x) => x.blocked && x.force);
      if (open.length) walkTo(state, module, open[roll(open.length)]!.to);
      else if (forcible.length) forceDoor(state, module, forcible[0]!.link);
      else if (exit) leaveDungeon(state, module);
      else throw new Error(`stuck in ${scene.id}`);
    } else {
      const options = legalChoices(state, module).filter((o) => !o.blocked);
      const back = options.find((o) => o.choice.id === 'in' || o.choice.id === 'on');
      choose(state, module, (back ?? options[0]!).choice.id);
    }
  }
  throw new Error(`${module.id} did not end`);
}

describe('a delve built to a spec', () => {
  it('passes every proof in every shape, depth and theme, without leaning on rerolls', () => {
    let rerolls = 0, built = 0;
    for (const shape of DELVE_SHAPES) for (const floors of [1, 2, 3]) {
      for (let seed = 1; seed <= 8; seed++) {
        const r = generateSpecDelve(seed, { shape, floors, theme: SPEC_THEMES[seed % SPEC_THEMES.length]!, level: 1 + (seed % 4) });
        expect(validateModule(r.module), `${shape} ${floors} seed ${seed}`).toEqual([]);
        expect(floorsOf(r.module)).toHaveLength(floors);
        rerolls += r.rerolls; built++;
      }
    }
    // A shape that only works by rerolling is a shape that is quietly broken
    // most of the time — the first cut of `hub` piled every room on the hub
    // and failed layout on a third of its seeds.
    expect(rerolls / built).toBeLessThan(0.25);
  }, 60_000);

  it.each(DELVE_SHAPES)('plays down three floors of %s to victory', (shape) => {
    for (let seed = 1; seed <= 6; seed++) {
      const { module } = generateSpecDelve(seed, { shape, floors: 3, fights: 'generated', level: 2 });
      expect(playDown(module, seed).ending, `seed ${seed}`).toBe('victory');
    }
  }, 60_000);

  it('only ends the delve at the last floor\'s goal', () => {
    const { module } = generateSpecDelve(4, { floors: 3 });
    const fl = floorsOf(module);
    expect(fl.map(([id]) => id)).toEqual(['delve', 'delve-2', 'delve-3']);
    for (const [i, [id, d]] of fl.entries()) {
      const goal = d.rooms.find((r) => r.goal)!;
      const fight = module.scenes[goal.fight!];
      if (fight?.kind !== 'battle') throw new Error('goal without a fight');
      expect(fight.onWin.to, id).toBe(i === fl.length - 1 ? 'won' : '@hub');
      expect(goal.exit?.to, id).toBe(i === fl.length - 1 ? undefined : fl[i + 1]![0]);
      const entry = d.rooms.find((r) => r.id === d.entry)!;
      expect(entry.exit?.to, id).toBe(i === 0 ? 'outside' : fl[i - 1]![0]);
      // Its own camp, and its own torch to the goal.
      expect(d.camp?.risky?.battleScene).toBe(i === 0 ? 'f1-camp-fight' : `f${i + 1}-camp-fight`);
      expect(d.torch!.length).toBeGreaterThanOrEqual(goalCost(module, d, goal.id)! + 4);
    }
  });

  it('draws deeper floors for the party the floors above will have made', () => {
    const { module } = generateSpecDelve(2, { floors: 3, level: 1, fights: 'generated' });
    expect(module.levelBand!.to).toBeGreaterThan(module.levelBand!.from);
    // And that is what a party actually reaches, near enough: it is not a
    // number made up for the label.
    const { xp } = playDown(module, 2);
    expect(levelForXp(xp)).toBeGreaterThanOrEqual(module.levelBand!.to);
  });

  it('is the same for the same seed and spec, and rebuilds from its id', () => {
    const spec: DelveSpec = { shape: 'ring', floors: 2, theme: 'forest', fights: 'generated',
      require: [{ name: 'The Wolf Den', fight: { brief: 'volley' }, where: 'afterLock' }] };
    const a = generateSpecDelve(31, spec);
    expect(generateSpecDelve(31, spec)).toEqual(a);
    expect(a.module.id).toMatch(/^delve2-31-/);
    expect(specDelveFromId(a.module.id)).toEqual(a.module);
    expect(specDelveFromId('delve-31-stone-medium-2-standard')).toBeUndefined();
    expect(specDelveFromId('delve2-31-!!!')).toBeUndefined();
    expect(generateSpecDelve(32, spec).module).not.toEqual(a.module);
  });
});

describe('shapes', () => {
  const links = (d: Dungeon, id: string) => d.links.filter((l) => l.a === id || l.b === id);

  it.each(DELVE_SHAPES)('%s keeps its goal behind its lock', (shape) => {
    // The first cut of `ring` rejoined the main path past the lock, and the
    // second way round walked straight to the goal with no key at all.
    for (let seed = 1; seed <= 20; seed++) {
      const { module } = generateSpecDelve(seed, { shape });
      const [, d] = floorsOf(module)[0]!;
      const keyless: Dungeon = { ...d, links: d.links.filter((l) => !l.door?.locked) };
      expect(goalCost(module, keyless, d.rooms.find((r) => r.goal)!.id), `seed ${seed}`).toBeUndefined();
    }
  });

  it('keys puts two locks between the door and the goal, each with its own key', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const [, d] = floorsOf(generateSpecDelve(seed, { shape: 'keys' }).module)[0]!;
      const flags = d.links.flatMap((l) => l.door?.locked ?? []).map((r) => (r.kind === 'flag' ? r.flag : ''));
      expect(new Set(flags).size, `seed ${seed}`).toBe(2);
    }
  });

  it('hub hangs most of the floor off one chamber', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const [, d] = floorsOf(generateSpecDelve(seed, { shape: 'hub', rooms: 9 }).module)[0]!;
      expect(links(d, 'm1').length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('ring gives two ways to the lock', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { module } = generateSpecDelve(seed, { shape: 'ring' });
      const [, d] = floorsOf(module)[0]!;
      const goal = d.rooms.find((r) => r.goal)!.id;
      // Cut one way round and the goal is still reachable by the other.
      for (const cut of [['m0', 'm1'], ['m0', 'r1']]) {
        const cutD: Dungeon = { ...d, links: d.links.filter((l) => !(l.a === cut[0] && l.b === cut[1])) };
        expect(goalCost(module, cutD, goal), `seed ${seed} without ${cut.join('-')}`).toBeDefined();
      }
    }
  });

  it('spine keeps the side rooms off one another', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const [, d] = floorsOf(generateSpecDelve(seed, { shape: 'spine', rooms: 10 }).module)[0]!;
      const main = new Set(d.rooms.filter((r) => /^m\d+$/.test(r.id)).map((r) => r.id));
      expect(main.size, `seed ${seed}`).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('required rooms', () => {
  it('puts each one where it was asked for, with what it was asked to hold', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { module } = generateSpecDelve(seed, {
        floors: 2, level: 2,
        require: [
          { name: 'Shrine of Pelor', rest: 'safe', where: 'beforeLock', text: 'Warm light.' },
          { name: 'Goblin Warren', fight: 'goblin-outriders', floor: 2, where: 'afterLock' },
          { name: 'Dragon\'s Hoard', where: 'goal', fight: { boss: true }, loot: 'potion-greater-healing' },
        ],
      });
      const [[, f1], [, f2]] = floorsOf(module) as [[string, Dungeon], [string, Dungeon]];
      const shrine = f1.rooms.find((r) => r.name === 'Shrine of Pelor')!;
      expect(shrine.rest).toBe('safe');
      expect(shrine.firstVisit).toEqual(['Warm light.']);
      // Before the lock: reachable with no key at all.
      const keyless = { ...f1, links: f1.links.filter((l) => !l.door?.locked) };
      expect(goalCost(module, keyless, shrine.id), `seed ${seed}: shrine behind the lock`).toBeDefined();

      const warren = f2.rooms.find((r) => r.name === 'Goblin Warren')!;
      const fight = module.scenes[warren.fight!];
      expect(fight?.kind === 'battle' && fight.encounterId).toBe('goblin-outriders');
      const keyless2 = { ...f2, links: f2.links.filter((l) => !l.door?.locked) };
      expect(goalCost(module, keyless2, warren.id), `seed ${seed}: warren before the lock`).toBeUndefined();

      // The goal is on the last floor by default.
      const hoard = f2.rooms.find((r) => r.goal)!;
      expect(hoard.name).toBe('Dragon\'s Hoard');
      const loot = module.scenes[hoard.search!];
      expect(JSON.stringify(loot)).toContain('potion-greater-healing');
      expect(f1.rooms.some((r) => r.name === 'Dragon\'s Hoard')).toBe(false);
    }
  });

  it('refuses a spec no dungeon could meet, at once', () => {
    const bad: [DelveSpec, RegExp][] = [
      [{ floors: 4 }, /floors/],
      [{ rooms: 3 }, /rooms/],
      [{ require: [{ floor: 2 }] }, /floor 2 of 1/],
      [{ require: [{ where: 'goal' }, { where: 'goal' }] }, /two required goals/],
      [{ require: [{ fight: 'no-such-fight' }] }, /no encounter/],
      [{ require: [{ loot: 'no-such-item' }] }, /no item/],
      [{ rooms: 6, require: Array.from({ length: 3 }, () => ({})) }, /room for 2/],
    ];
    for (const [spec, why] of bad) {
      expect(() => checkSpec(spec), JSON.stringify(spec)).toThrow(why);
      expect(() => generateSpecDelve(1, spec)).toThrow(why);
    }
    expect(() => checkSpec({ rooms: 6, require: [{}, {}] })).not.toThrow();
  });
});

describe('generated fights', () => {
  it('are built to a share of the even budget, and resolve by id', () => {
    const ratios: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const level = 1 + (seed % 4);
      const { module } = generateSpecDelve(seed, { fights: 'generated', level });
      const first = new Set(floorsOf(module)[0]![1].rooms.flatMap((r) => (r.fight ? [r.fight] : [])));
      for (const b of battles(module).filter((s) => first.has(s.id))) {
        expect(b.encounterId).toMatch(/^gen:/);
        const enc = encounterFor(b.encounterId)!;
        expect(enc, b.encounterId).toBeDefined();
        const isBoss = floorsOf(module)[0]![1].rooms.find((r) => r.fight === b.id)!.goal;
        const budget = evenBudgetFor(level) * (isBoss ? BOSS_SHARE : ROOM_SHARE);
        // The generator is best-effort and lands a little either side.
        expect(adjustedXp(enc.members), `${b.id} L${level}`).toBeLessThanOrEqual(budget * 1.5);
        ratios.push(adjustedXp(enc.members) / budget);
      }
    }
    const mean = ratios.reduce((a, r) => a + r, 0) / ratios.length;
    expect(mean).toBeGreaterThan(0.8);
    expect(mean).toBeLessThan(1.1);
  });

  it('leave authored fights alone when asked for them', () => {
    const { module } = generateSpecDelve(3, { fights: 'authored' });
    expect(battles(module).some((b) => b.encounterId.startsWith('gen:'))).toBe(false);
  });

  it('pay no XP for a broken night on any floor', () => {
    const { module } = generateSpecDelve(5, { floors: 3 });
    for (const [, d] of floorsOf(module)) {
      const camp = module.scenes[d.camp!.risky!.battleScene];
      expect(camp?.kind === 'battle' && camp.loot).toBe(false);
    }
  });
});

describe('the delve slot', () => {
  it('keeps a spec delve out of a company\'s slot', async () => {
    const { slotFor, DELVE_SLOT } = await import('../web/src/adventureStorage.js');
    expect(slotFor(generateSpecDelve(1, {}).module.id)).toBe(DELVE_SLOT);
  });
});
