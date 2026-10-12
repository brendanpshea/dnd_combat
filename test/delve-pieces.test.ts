/**
 * Set pieces: hand-written fragments built into a generated floor.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  generateSpecDelve, specDelveFromId, checkSpec, DELVE_SHAPES, SPEC_THEMES, type DelveSpec,
} from '../src/adventure/delve-spec.js';
import { PIECES } from '../src/adventure/delve-pieces.js';
import { validateModule } from '../src/adventure/validate.js';
import { goalCost } from '../src/adventure/dungeon.js';
import type { Dungeon, Module } from '../src/adventure/types.js';
import { playDown } from './delve-play.js';

const floor = (m: Module, f = 1): Dungeon => {
  const s = m.scenes[f === 1 ? 'delve' : `delve-${f}`];
  if (s?.kind !== 'dungeon') throw new Error(`no floor ${f}`);
  return s.dungeon;
};
/** The floor without its own locked doors (a piece's internal locks stay). */
const keyless = (d: Dungeon): Dungeon => ({
  ...d, links: d.links.filter((l) => !l.door?.locked?.some((r) => r.kind === 'flag' && r.flag.startsWith('delve-key'))),
});
/** Can the party stand in `room` with what the dungeon hands out? */
const reach = (m: Module, d: Dungeon, room: string) => goalCost(m, d, room) !== undefined;

describe('the piece library', () => {
  it.each(Object.keys(PIECES))('%s builds into every shape and floor, and passes every proof', (piece) => {
    let rerolls = 0, built = 0;
    for (const shape of DELVE_SHAPES) {
      for (let seed = 1; seed <= 6; seed++) {
        const r = generateSpecDelve(seed, {
          shape, floors: 2, theme: SPEC_THEMES[seed % SPEC_THEMES.length]!,
          fights: seed % 2 ? 'generated' : 'authored', pieces: [{ piece, floor: 1 + (seed % 2) }],
        });
        expect(validateModule(r.module), `${shape} seed ${seed}`).toEqual([]);
        // The piece is really there: some room of it on the floor it was asked for.
        expect(floor(r.module, 1 + (seed % 2)).rooms.some((x) => x.id.startsWith('p0-')), `${shape} seed ${seed}`).toBe(true);
        rerolls += r.rerolls; built++;
      }
    }
    expect(rerolls / built, 'a piece that only fits by rerolling').toBeLessThan(0.5);
  }, 60_000);

  it('all four on one floor still play through to the end', () => {
    for (const shape of DELVE_SHAPES) {
      for (let seed = 1; seed <= 4; seed++) {
        const { module } = generateSpecDelve(seed, { shape, floors: 2, pieces: Object.keys(PIECES).map((piece) => ({ piece })) });
        expect(playDown(module, seed).ending, `${shape} seed ${seed}`).toBe('victory');
      }
    }
  }, 60_000);
});

describe('what each piece promises', () => {
  it('the warden carries the key, and the generic key room stands down', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { module } = generateSpecDelve(seed, { pieces: [{ piece: 'warden' }] });
      const d = floor(module);
      // Reachable without the key it carries.
      expect(reach(module, keyless(d), 'p0-quarters'), `seed ${seed}`).toBe(true);
      // Exactly one thing on the floor sets the lock's flag, and it is the warden.
      const lockFlag = d.links.flatMap((l) => l.door?.locked ?? []).map((r) => (r.kind === 'flag' ? r.flag : ''))[0]!;
      const setters = Object.values(module.scenes).filter((s) => JSON.stringify(s).includes(`"flag":"${lockFlag}"`) && s.kind !== 'dungeon');
      expect(setters.map((s) => s.id), `seed ${seed}`).toEqual(['f1-p0-warden']);
      // And without him the goal is out of reach.
      const fight = module.scenes['f1-p0-warden'];
      if (fight?.kind !== 'battle') throw new Error();
      const stripped: Module = { ...module, scenes: { ...module.scenes, [fight.id]: { ...fight, onWin: { to: '@hub' } } } };
      expect(goalCost(stripped, d, d.rooms.find((r) => r.goal)!.id), `seed ${seed}`).toBeUndefined();
    }
  });

  it('the shrine is the floor\'s safe room, and you can reach it before the lock', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { module } = generateSpecDelve(seed, { pieces: [{ piece: 'shrine' }] });
      const d = floor(module);
      expect(d.rooms.filter((r) => r.rest === 'safe').map((r) => r.id), `seed ${seed}`).toEqual(['p0-sanctum']);
      expect(reach(module, keyless(d), 'p0-sanctum'), `seed ${seed}`).toBe(true);
    }
  });

  it('the vault behind the sluice opens only once the wheel is turned', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { module } = generateSpecDelve(seed, { pieces: [{ piece: 'valve', where: 'beforeLock' }] });
      const d = floor(module);
      expect(reach(module, keyless(d), 'p0-vault'), `seed ${seed}`).toBe(true);
      const wheel = module.scenes['f1-p0-wheel'];
      if (wheel?.kind !== 'story') throw new Error();
      const dry: Module = { ...module, scenes: { ...module.scenes, [wheel.id]: { ...wheel, next: wheel.next.map((c) => ({ ...c, effects: [] })) } } };
      expect(reach(dry, d, 'p0-vault'), `seed ${seed}: the vault opens without the wheel`).toBe(false);
    }
  });

  it('the prisoner is whoever the spec names, and freeing them is remembered', () => {
    const { module } = generateSpecDelve(3, { pieces: [{ piece: 'prisoner', bind: { name: 'Mara Vell' } }] });
    const talk = module.scenes['f1-p0-talk'];
    if (talk?.kind !== 'story') throw new Error();
    expect(talk.text.join(' ')).toContain('Mara Vell');
    expect(talk.noBack).toBe(true);
    expect(JSON.stringify(talk.next[0])).toContain('"flag":"f1-p0-freed"');
  });

  it.each(DELVE_SHAPES)('puts a piece past the lock when asked, on %s, without leaning on rerolls', (shape) => {
    /*
     * On a classic floor the lock is often the goal's own door, so the only
     * room past it is the goal. The first cut rerolled until the dice gave it
     * somewhere else — 3.4 rerolls a delve, seen first on the preview page.
     */
    let rerolls = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = generateSpecDelve(seed, { shape, pieces: [{ piece: 'prisoner', where: 'afterLock' }] });
      expect(reach(r.module, keyless(floor(r.module)), 'p0-cells'), `seed ${seed}`).toBe(false);
      rerolls += r.rerolls;
    }
    expect(rerolls / 20).toBeLessThan(0.5);
  });
});

describe('placing pieces', () => {
  it('keeps two copies of one piece apart', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { module } = generateSpecDelve(seed, { floors: 2, pieces: [{ piece: 'prisoner' }, { piece: 'prisoner' }, { piece: 'prisoner', floor: 2 }] });
      const ids = [1, 2].flatMap((f) => floor(module, f).rooms.map((r) => `${f}:${r.id}`));
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of ['f1-p0-talk', 'f1-p1-talk', 'f2-p2-talk']) expect(module.scenes[s], s).toBeDefined();
    }
  });

  it('never hangs a piece off the goal, where the delve ends before you could walk in', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { module } = generateSpecDelve(seed, { rooms: 6, pieces: Object.values(PIECES).filter((p) => p.id !== 'warden' && p.where !== 'goal').map((p) => ({ piece: p.id })) });
      const d = floor(module);
      const goal = d.rooms.find((r) => r.goal)!.id;
      const ports = d.links.filter((l) => l.a === goal || l.b === goal).flatMap((l) => [l.a, l.b]);
      expect(ports.filter((id) => id.startsWith('p')), `seed ${seed}`).toEqual([]);
    }
  });

  it('builds a chance piece only sometimes, and the same way every time', () => {
    let built = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const spec: DelveSpec = { pieces: [{ piece: 'shrine', chance: 0.5 }] };
      const { module } = generateSpecDelve(seed, spec);
      if (floor(module).rooms.some((r) => r.id === 'p0-sanctum')) built++;
      expect(specDelveFromId(module.id)).toEqual(module);
    }
    expect(built).toBeGreaterThan(8);
    expect(built).toBeLessThan(32);
  });

  it('refuses what no floor could hold, at once', () => {
    const bad: [DelveSpec, RegExp][] = [
      [{ pieces: [{ piece: 'dragon' }] }, /no piece 'dragon'/],
      [{ pieces: [{ piece: 'warden', where: 'afterLock' }] }, /must be beforeLock/],
      [{ pieces: [{ piece: 'warden' }, { piece: 'warden' }] }, /two pieces carry the key/],
      [{ pieces: [{ piece: 'warden', chance: 0.5 }] }, /cannot be left to chance/],
      [{ pieces: [{ piece: 'prisoner', bind: { colour: 'red' } }] }, /no parameter 'colour'/],
      [{ pieces: [{ piece: 'shrine', floor: 2 }] }, /floor 2 of 1/],
      [{ pieces: [{ piece: 'shrine', chance: 2 }] }, /chance/],
    ];
    for (const [spec, why] of bad) expect(() => checkSpec(spec), JSON.stringify(spec)).toThrow(why);
    expect(() => checkSpec({ floors: 2, pieces: [{ piece: 'warden' }, { piece: 'warden', floor: 2 }] })).not.toThrow();
  });
});

describe('delves without pieces', () => {
  it('build exactly what they built before pieces existed', () => {
    // A saved spec delve rebuilds from its id; pieces must not move a single
    // roll for a spec that has none. Hash taken on main before this change.
    const h = createHash('sha256');
    for (const shape of DELVE_SHAPES) for (const floors of [1, 2, 3]) for (const fights of ['authored', 'generated'] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        h.update(JSON.stringify(generateSpecDelve(seed, {
          shape, floors, fights, theme: SPEC_THEMES[seed % 6]!, level: 1 + (seed % 4),
          ...(seed % 2 ? { require: [{ name: 'X', where: 'beforeLock' as const, rest: 'safe' as const }] } : {}),
        })));
      }
    }
    // Changed once, on purpose: a safe room on the goal's doorstep could never
    // be slept in, and moving it changed exactly the delves that had one
    // (15 of 200 compared one by one against the old build; no other moved).
    expect(h.digest('hex').slice(0, 16)).toBe('bcdf407510bb9406');
  }, 60_000);
});
