/**
 * Resting by room, the Baldur's Gate way.
 *
 * A dungeon with a `rest` policy decides rest per room: never with enemies
 * nearby, a short rest costs torch, a long rest only somewhere safe (under the
 * standard policy), and the odds of a night being broken up shrink as the
 * place is cleared. A dungeon without a policy keeps the old whole-camp rule,
 * so the story chapters are untouched.
 */
import { describe, it, expect } from 'vitest';
import { choose, startAdventure, restOptions, restsByRoom, campRest, walkTo, resolveBattle, dungeonProgress, currentScene, SHORT_REST_TORCH } from '../src/adventure/runtime.js';
import { generateDelve, delveFromId } from '../src/adventure/dungeon-gen.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MODULES } from '../src/data/modules/index.js';
import type { Dungeon, Module, RestPolicy, RoomRest, Scene } from '../src/adventure/types.js';
import { createHash } from 'node:crypto';

const ENC = Object.keys(ENCOUNTERS)[0]!;

/**
 * a (entry) — b (fight) — c (safe) — d (fight)
 *
 * Small enough that every rule can be seen: c is the safe room, and it is
 * next door to d, so it is not restful until d is beaten.
 */
function probe(policy: RestPolicy | undefined, cRest: RoomRest = 'safe', torch = 10): Module {
  const fight = (id: string): Scene => ({ id, kind: 'battle', encounterId: ENC, mapId: '@room', onWin: { to: '@hub' } });
  const dungeon: Dungeon = {
    title: 'Probe', theme: 'stone', entry: 'a',
    torch: { length: torch, out: 'out' },
    camp: { risky: { chance: 0.5, battleScene: 'night' } },
    ...(policy ? { rest: policy } : {}),
    rooms: [
      { id: 'a', name: 'Entry', exit: { to: 'out' } },
      { id: 'b', name: 'Guardroom', fight: 'fb' },
      { id: 'c', name: 'Shrine', rest: cRest },
      { id: 'd', name: 'Barracks', fight: 'fd', goal: true },
    ],
    links: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'd' }],
  };
  return {
    // Entered through a door scene, as every real module is. A module that
    // STARTS inside a dungeon has no hub recorded, so a won fight's '@hub'
    // walks the party back in from outside: entrance, fresh torch, fight not
    // yet won. The first version of this probe did that and read it as the
    // rest rules failing.
    id: 'probe', title: 'Probe', blurb: '', start: 'gate',
    scenes: {
      gate: { id: 'gate', kind: 'story', text: ['A door.'], next: [{ id: 'in', label: 'In', to: 'delve' }] },
      delve: { id: 'delve', kind: 'dungeon', dungeon },
      fb: fight('fb'), fd: fight('fd'),
      night: { ...fight('night'), loot: false } as Scene,
      out: { id: 'out', kind: 'ending', outcome: 'victory', text: ['Out.'] },
    },
  };
}

/** Walk to a room, winning whatever fight is waiting in it. */
function reach(state: ReturnType<typeof startAdventure>, m: Module, room: string) {
  walkTo(state, m, room);
  while (currentScene(state, m).kind === 'battle') resolveBattle(state, m, true);
}

const start = (m: Module) => {
  const s = startAdventure(newCampaign(1), m);
  choose(s, m, 'in');
  return s;
};
const torchOf = (state: ReturnType<typeof startAdventure>, m: Module) => {
  const s = m.scenes.delve as Extract<Scene, { kind: 'dungeon' }>;
  return dungeonProgress(state, 'delve', s.dungeon).torch!;
};

describe('enemies nearby', () => {
  it('forbids any rest beside an unbeaten fight, and allows it once beaten', () => {
    const m = probe('standard');
    const s = start(m);
    // At the entry, the guardroom next door is still occupied.
    expect(restOptions(s, m).short.ok).toBe(false);
    expect(restOptions(s, m).short.reason).toMatch(/enemies are nearby/);
    reach(s, m, 'b');   // beat the guardroom
    walkTo(s, m, 'a');
    expect(restOptions(s, m).short.ok, 'the entry should be restful once its neighbour is cleared').toBe(true);
  });

  it('counts the room next door, not just the one you are in', () => {
    // The shrine has no fight of its own, but the barracks beside it does.
    const m = probe('standard');
    const s = start(m);
    reach(s, m, 'b');
    reach(s, m, 'c');
    expect(restOptions(s, m).long.ok).toBe(false);
    expect(restOptions(s, m).long.reason).toMatch(/enemies are nearby/);
  });
});

describe('a short rest costs an hour of light', () => {
  it('burns torch', () => {
    const m = probe('standard');
    const s = start(m);
    reach(s, m, 'b');
    walkTo(s, m, 'a');
    const before = torchOf(s, m);
    expect(restOptions(s, m).short.torch).toBe(SHORT_REST_TORCH);
    campRest(s, m, 'short');
    expect(torchOf(s, m)).toBe(before - SHORT_REST_TORCH);
  });

  it('is refused when the torch would not last it', () => {
    // A short rest that ran the torch out would send the party outside mid-nap.
    const m = probe('standard', 'safe', 4);
    const s = start(m);
    reach(s, m, 'b');   // one step: 3 left
    walkTo(s, m, 'a');  // two: 2 left
    expect(torchOf(s, m)).toBeLessThanOrEqual(SHORT_REST_TORCH);
    expect(restOptions(s, m).short.ok).toBe(false);
    expect(restOptions(s, m).short.reason).toMatch(/torch/);
  });
});

describe('where a night is possible', () => {
  /** Everything cleared, standing in room `at`. */
  const cleared = (policy: RestPolicy, at: string, cRest: RoomRest = 'safe') => {
    const m = probe(policy, cRest);
    const s = start(m);
    reach(s, m, 'b'); reach(s, m, 'c'); reach(s, m, 'd');
    walkTo(s, m, at);
    return { m, s };
  };

  it('standard: only in a safe room', () => {
    expect(restOptions(cleared('standard', 'c').s, cleared('standard', 'c').m).long.ok).toBe(true);
    const { m, s } = cleared('standard', 'b');
    expect(restOptions(s, m).long.ok).toBe(false);
    expect(restOptions(s, m).long.reason).toMatch(/bar the door/);
    expect(restOptions(s, m).short.ok, 'a short rest is still fine there').toBe(true);
  });

  it('harsh: never', () => {
    const { m, s } = cleared('harsh', 'c');
    expect(restOptions(s, m).long.ok).toBe(false);
    expect(restOptions(s, m).short.ok).toBe(true);
  });

  it('forgiving: any room that allows a short rest', () => {
    const { m, s } = cleared('forgiving', 'b');
    expect(restOptions(s, m).long.ok).toBe(true);
  });

  it('nowhere in a room that allows none', () => {
    const { m, s } = cleared('forgiving', 'c', 'none');
    expect(restOptions(s, m).short.ok).toBe(false);
    expect(restOptions(s, m).long.ok).toBe(false);
  });
});

describe('the odds of a broken night', () => {
  it('shrink as the place is cleared', () => {
    /*
     * Forgiving, so the same room can be compared before and after. With half
     * the fights still standing a night in the guardroom is riskier than one
     * after the barracks too have been beaten. A dead dungeon is a quiet one.
     */
    const m = probe('forgiving', 'short');
    const s = start(m);
    reach(s, m, 'b');
    walkTo(s, m, 'a');
    const awake = restOptions(s, m).long.chance!;
    reach(s, m, 'b'); reach(s, m, 'c'); reach(s, m, 'd');
    walkTo(s, m, 'c'); walkTo(s, m, 'b');
    const quiet = restOptions(s, m).long.chance!;
    expect(quiet).toBeGreaterThan(0);
    expect(quiet).toBeLessThan(awake);
  });

  it('are lower in a safe room', () => {
    const shortRoom = probe('forgiving', 'short');
    const safeRoom = probe('forgiving', 'safe');
    const chanceAtC = (m: Module) => {
      const s = start(m);
      reach(s, m, 'b'); reach(s, m, 'c'); reach(s, m, 'd');
      walkTo(s, m, 'c');
      return restOptions(s, m).long.chance!;
    };
    expect(chanceAtC(safeRoom)).toBeLessThan(chanceAtC(shortRoom));
  });

  it('refuses a rest the rules forbid, rather than taking it anyway', () => {
    const m = probe('standard');
    const s = start(m);
    expect(() => campRest(s, m, 'short')).toThrow(/enemies are nearby/);
  });
});

describe('generated delves', () => {
  it('default to the standard policy, with a safe room reachable before the lock', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { module } = generateDelve(seed);
      const d = (module.scenes.delve as Extract<Scene, { kind: 'dungeon' }>).dungeon;
      expect(d.rest).toBe('standard');
      const safe = d.rooms.filter((r) => r.rest === 'safe').map((r) => r.id);
      expect(safe.length, `seed ${seed}: nowhere to sleep`).toBeGreaterThan(0);
      // Walk from the entry without opening anything locked or secret.
      const open = new Set([d.entry]);
      for (let changed = true; changed;) {
        changed = false;
        for (const l of d.links) {
          if (l.door?.locked || l.door?.secret) continue;
          for (const [x, y] of [[l.a, l.b], ...(l.door?.oneWay ? [] : [[l.b, l.a]])] as const) {
            if (open.has(x) && !open.has(y)) { open.add(y); changed = true; }
          }
        }
      }
      expect(safe.some((id) => open.has(id)), `seed ${seed}: the only safe room is behind the lock`).toBe(true);
    }
  });

  it('pay nothing for a broken night', () => {
    // Otherwise resting is how you farm the place.
    for (let seed = 1; seed <= 20; seed++) {
      const camp = generateDelve(seed).module.scenes['camp-fight'];
      expect(camp?.kind === 'battle' && camp.loot).toBe(false);
    }
  });

  it('honour the policy they were asked for', () => {
    for (const rest of ['harsh', 'standard', 'forgiving'] as const) {
      const { module } = generateDelve(9, { rest });
      expect((module.scenes.delve as Extract<Scene, { kind: 'dungeon' }>).dungeon.rest).toBe(rest);
      expect(delveFromId(module.id), `${rest}: the id does not rebuild it`).toEqual(module);
    }
  });
});

describe('saved delves from before rest-by-room', () => {
  /*
   * A delve is rebuilt from its id when a save is loaded, and the save's
   * progress names rooms. The safe-room rolls shift every roll after them, so a
   * pre-change id rebuilt by the new generator would be a DIFFERENT dungeon
   * with someone else's progress in it. These hashes were taken from the
   * generator as it stood before the change; the legacy path must still produce
   * exactly those modules.
   */
  const GOLDEN: Array<[string, string]> = [
    ['delve-1-stone-medium-2', '75d1222fb0b1a0bf'],
    ['delve-7-graveyard-medium-2', 'a170db1cadbc212a'],
    ['delve-42-ember-medium-2', '4ad1cfcc7c5c315d'],
    ['delve-99-bog-medium-2', '5047d0ba5971fffc'],
  ];
  it.each(GOLDEN)('%s rebuilds exactly as it was', (id, hash) => {
    const m = delveFromId(id)!;
    expect(createHash('sha256').update(JSON.stringify(m)).digest('hex').slice(0, 16)).toBe(hash);
    expect((m.scenes.delve as Extract<Scene, { kind: 'dungeon' }>).dungeon.rest).toBeUndefined();
  });
});

describe('the story chapters', () => {
  it('keep the old whole-camp rule', () => {
    // No hand-written dungeon has a policy, so their rest panels are as they were.
    for (const m of MODULES) {
      for (const s of Object.values(m.scenes)) {
        if (s.kind === 'dungeon') expect(s.dungeon.rest, `${m.id}/${s.id}`).toBeUndefined();
      }
    }
    const m = probe(undefined);
    const s = start(m);
    expect(restsByRoom(s, m)).toBe(false);
    // Old rule: rest anywhere the camp is, enemies or not.
    expect(restOptions(s, m).short.ok).toBe(true);
    expect(restOptions(s, m).long).toEqual({ ok: true, chance: 0.5 });
  });
});

describe('a safe room you can actually sleep in', () => {
  it('is never on the goal\'s doorstep, in a classic delve or a spec one', async () => {
    /*
     * Resting is refused beside a room whose fight is still to be had, and
     * the goal's is had last. A safe room next to it could never be slept
     * in — so the party could not rest before the boss, nor after a wipe.
     * Whole delves played through found it: 74 classic delves in 200 had one.
     */
    const { generateDelve } = await import('../src/adventure/dungeon-gen.js');
    const { generateSpecDelve, DELVE_SHAPES } = await import('../src/adventure/delve-spec.js');
    const modules = [
      ...Array.from({ length: 120 }, (_, i) => generateDelve(i + 1).module),
      ...DELVE_SHAPES.flatMap((shape) => Array.from({ length: 12 }, (_, i) => generateSpecDelve(i + 1, { shape, floors: 2 }).module)),
    ];
    for (const m of modules) {
      for (const s of Object.values(m.scenes)) {
        if (s.kind !== 'dungeon') continue;
        const d = s.dungeon;
        const goal = d.rooms.find((r) => r.goal)!.id;
        for (const r of d.rooms.filter((x) => x.rest === 'safe')) {
          const byGoal = d.links.some((l) => (l.a === r.id && l.b === goal) || (l.b === r.id && l.a === goal));
          expect(byGoal, `${m.id} ${s.id}: safe room ${r.id} is next to the goal`).toBe(false);
        }
      }
    }
  }, 30_000);
});

