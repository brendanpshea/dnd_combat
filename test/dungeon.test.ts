/**
 * Dungeons as graphs: the layout, the proofs the validator runs, and the
 * runtime that walks a party through one.
 */
import { describe, it, expect } from 'vitest';
import type { Module, Dungeon, Scene } from '../src/adventure/types.js';
import { layoutDungeon, checkDungeon, linkKey, roomGrants } from '../src/adventure/dungeon.js';
import { validateModule } from '../src/adventure/validate.js';
import {
  startAdventure, enterScene, currentScene, resolveBattle, fleeBattle, dungeonProgress, dungeonExits,
  walkTo, searchRoom, canSearch, forceDoor, leaveDungeon, dungeonExitHere, battleMap, choose,
  dungeonRoute, travelDestinations, campRule, hubReturn,
  type AdventureEvent,
} from '../src/adventure/runtime.js';
import { runModule } from '../src/adventure/runner.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { parseMap } from '../src/data/maps.js';

const KEY_FLAG = 'kennel-key';

function den(over: Partial<Dungeon> = {}): Dungeon {
  return {
    title: 'The Den', theme: 'ember', entry: 'gate',
    camp: {},
    rooms: [
      { id: 'gate', name: 'Gate', exit: { to: 'outside', label: 'Out to the road' } },
      { id: 'yard', name: 'Muster Yard', size: 'large', firstVisit: ['Mud and smoke.'] },
      { id: 'kennel', name: 'Kennels', fight: 'kennel-fight' },
      { id: 'store', name: 'Store hut', size: 'small', search: 'store-loot' },
      { id: 'pit', name: 'The Pit', fight: 'pit-fight' },
      { id: 'vex', name: 'Vex\'s Fire', event: { scene: 'vex-talk', until: [{ kind: 'flag', flag: 'met-vex' }] } },
      { id: 'hall', name: 'The Hall', goal: true, event: { scene: 'boss-door' } },
      { id: 'cellar', name: 'Cellar' },
    ],
    links: [
      { a: 'gate', b: 'yard' },
      { a: 'yard', b: 'kennel' },
      { a: 'yard', b: 'store', door: { locked: [{ kind: 'flag', flag: KEY_FLAG }], note: 'Barred from inside.', force: { skill: 'athletics', dc: 14 } } },
      { a: 'yard', b: 'pit', length: 2 },
      { a: 'pit', b: 'vex' },
      { a: 'vex', b: 'hall' },
      { a: 'store', b: 'cellar', door: { secret: { dc: 30 } } },
    ],
    ...over,
  };
}

function moduleWith(d: Dungeon, extra: Record<string, Scene> = {}): Module {
  const scenes: Record<string, Scene> = {
    start: { id: 'start', kind: 'story', text: ['Go.'], next: [{ id: 'in', label: 'In', to: 'den' }] },
    den: { id: 'den', kind: 'dungeon', dungeon: d },
    outside: { id: 'outside', kind: 'story', text: ['The road.'], next: [{ id: 'back', label: 'Back in', to: 'den' }] },
    'kennel-fight': {
      id: 'kennel-fight', kind: 'battle', encounterId: 'kennel-hyenas', mapId: '@room',
      onWin: { to: '@hub', effects: [{ kind: 'setFlag', flag: KEY_FLAG }] },
    },
    'pit-fight': { id: 'pit-fight', kind: 'battle', encounterId: 'den-muster', mapId: 'ruins', onWin: { to: '@hub' } },
    'store-loot': { id: 'store-loot', kind: 'story', text: ['Coin.'], next: [{ id: 'ok', label: 'Take it', to: '@hub', effects: [{ kind: 'gold', amount: 10 }] }] },
    'vex-talk': {
      id: 'vex-talk', kind: 'story', text: ['Vex.'], next: [
        { id: 'deal', label: 'Deal', to: '@hub', effects: [{ kind: 'setFlag', flag: 'met-vex' }] },
        { id: 'walk', label: 'Walk on', to: '@hub' },
      ],
    },
    'boss-door': { id: 'boss-door', kind: 'story', text: ['The chief.'], next: [{ id: 'end', label: 'End it', to: 'won' }] },
    won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
    ...extra,
  };
  return { id: 'test-den', title: 'Test', blurb: '', start: 'start', scenes };
}

const M = moduleWith(den());

function inDen(seed = 3) {
  const s = startAdventure(newCampaign(seed), M);
  enterScene(s, M, 'start');
  choose(s, M, 'in');
  return s;
}
const at = (s: ReturnType<typeof inDen>) => dungeonProgress(s, 'den', den()).at;

describe('layout', () => {
  it('puts every room on its own cell and routes every link', () => {
    const l = layoutDungeon(den());
    expect(l.faults).toEqual([]);
    const cells = Object.values(l.cells).map(([c, r]) => `${c},${r}`);
    expect(new Set(cells).size).toBe(den().rooms.length);
    for (const link of den().links) {
      const p = l.corridors[linkKey(link)]!;
      expect(p[0]).toEqual(l.cells[link.a]);
      expect(p[p.length - 1]).toEqual(l.cells[link.b]);
    }
  });

  it('never runs two corridors through one cell, or a corridor through a room', () => {
    const l = layoutDungeon(den());
    const rooms = new Set(Object.values(l.cells).map(([c, r]) => `${c},${r}`));
    const used = new Set<string>();
    for (const p of Object.values(l.corridors)) {
      for (const [c, r] of p.slice(1, -1)) {
        const k = `${c},${r}`;
        expect(rooms.has(k)).toBe(false);
        expect(used.has(k)).toBe(false);
        used.add(k);
      }
    }
  });

  it('is the same every time, and honours pins', () => {
    expect(layoutDungeon(den())).toEqual(layoutDungeon(den()));
    const pinned = den({ rooms: den().rooms.map((r) => (r.id === 'hall' ? { ...r, at: [9, 9] as [number, number] } : r)) });
    const l = layoutDungeon(pinned);
    const hall = l.cells.hall!, gate = l.cells.gate!;
    expect([hall[0] - gate[0], hall[1] - gate[1]]).not.toEqual([0, 0]);
  });

  it('reports two rooms pinned to one cell', () => {
    const d = den({ rooms: den().rooms.map((r) => (r.id === 'hall' || r.id === 'gate' ? { ...r, at: [0, 0] as [number, number] } : r)) });
    expect(layoutDungeon(d).faults.some((f) => f.includes('pinned to the same cell'))).toBe(true);
  });
});

describe('the proofs', () => {
  it('a sound dungeon passes, and the module validates', () => {
    expect(checkDungeon(M, 'den', den())).toEqual([]);
    expect(validateModule(M)).toEqual([]);
  });

  it('reads keys off the rooms that give them', () => {
    expect(roomGrants(M, den().rooms.find((r) => r.id === 'kennel')!).has(`flag:${KEY_FLAG}`)).toBe(true);
  });

  it('catches a room nothing leads to', () => {
    const d = den({ links: den().links.filter((l) => l.b !== 'cellar') });
    expect(checkDungeon(M, 'den', d).some((e) => e.includes("'cellar' cannot be reached"))).toBe(true);
  });

  it('catches a goal behind a secret door, or behind a key nobody hands out', () => {
    const secret = den({ links: den().links.map((l) => (l.b === 'hall' ? { ...l, door: { secret: { dc: 12 } } } : l)) });
    expect(checkDungeon(M, 'den', secret).some((e) => e.includes("goal 'hall' cannot be reached"))).toBe(true);
    const lost = den({ links: den().links.map((l) => (l.b === 'hall' ? { ...l, door: { locked: [{ kind: 'flag', flag: 'nowhere' }] } } : l)) });
    expect(checkDungeon(M, 'den', lost).some((e) => e.includes("goal 'hall' cannot be reached"))).toBe(true);
  });

  it('a key found in the dungeon opens the way to the goal', () => {
    const d = den({ links: den().links.map((l) => (l.b === 'hall' ? { ...l, door: { locked: [{ kind: 'flag', flag: KEY_FLAG }] } } : l)) });
    expect(checkDungeon(M, 'den', d)).toEqual([]);
  });

  it('catches a one-way drop into a dead end', () => {
    const d = den({
      rooms: [...den().rooms, { id: 'oubliette', name: 'Oubliette' }],
      links: [...den().links, { a: 'pit', b: 'oubliette', door: { oneWay: true } }],
    });
    expect(checkDungeon(M, 'den', d).some((e) => e.includes("'oubliette' can be left with no way on"))).toBe(true);
  });

  it('catches a torch too short for the walk', () => {
    const d = den({ torch: { length: 3, out: 'outside' } });
    expect(checkDungeon(M, 'den', d).some((e) => e.includes('torch (3) runs out'))).toBe(true);
    expect(checkDungeon(M, 'den', den({ torch: { length: 12, out: 'outside' } }))).toEqual([]);
  });

  it('catches a dungeon with no goal and no way out, and a forceable door with no lock', () => {
    const d = den({ rooms: den().rooms.map(({ goal: _g, exit: _e, ...r }) => r) });
    expect(checkDungeon(M, 'den', d).some((e) => e.includes('neither a goal room nor an exit'))).toBe(true);
    const f = den({ links: [...den().links.slice(0, -1), { a: 'store', b: 'cellar', door: { force: { skill: 'athletics', dc: 10 } } }] });
    expect(checkDungeon(M, 'den', f).some((e) => e.includes('can be forced but is not locked'))).toBe(true);
  });

  it("keeps '@room' boards to fights that happen in a dungeon", () => {
    const stray = moduleWith(den(), {
      stray: { id: 'stray', kind: 'battle', encounterId: 'kennel-hyenas', mapId: '@room', onWin: { to: 'won' } },
      start: { id: 'start', kind: 'story', text: ['Go.'], next: [{ id: 'in', label: 'In', to: 'den' }, { id: 's', label: 'S', to: 'stray' }] },
    });
    expect(validateModule(stray).some((e) => e.includes("'@room' is only for a fight"))).toBe(true);
  });
});

describe('walking a dungeon', () => {
  it('walks in at the entry and shows a room its prose once', () => {
    const s = inDen();
    expect(currentScene(s, M).kind).toBe('dungeon');
    expect(at(s)).toBe('gate');
    const ev = walkTo(s, M, 'yard');
    expect(ev.find((e) => e.type === 'room')).toMatchObject({ roomId: 'yard', firstVisit: ['Mud and smoke.'] });
    walkTo(s, M, 'gate');
    const again = walkTo(s, M, 'yard').find((e): e is Extract<AdventureEvent, { type: 'room' }> => e.type === 'room');
    expect(again?.firstVisit).toBeUndefined();
  });

  it('a room with a fight springs it until won; winning clears it and hands over its key', () => {
    const s = inDen();
    walkTo(s, M, 'yard');
    const store = () => dungeonExits(s, M).find((x) => x.to === 'store')!;
    expect(store().blocked).toBe('Barred from inside.');
    walkTo(s, M, 'kennel');
    expect(s.sceneId).toBe('kennel-fight');
    resolveBattle(s, M, true);
    expect(s.sceneId).toBe('den');
    expect(at(s)).toBe('kennel');
    expect(dungeonProgress(s, 'den', den()).cleared).toContain('kennel');
    walkTo(s, M, 'yard');
    expect(store().blocked).toBeNull();
    walkTo(s, M, 'store');
    expect(at(s)).toBe('store');
    walkTo(s, M, 'kennel'); // through the yard; the kennel stays quiet
    expect(s.sceneId).toBe('den');
    expect(at(s)).toBe('kennel');
  });

  it('falling back from a room\'s fight returns to the room before it', () => {
    const s = inDen();
    walkTo(s, M, 'yard');
    walkTo(s, M, 'pit');
    expect(s.sceneId).toBe('pit-fight');
    fleeBattle(s, M, false);
    expect(s.sceneId).toBe('den');
    expect(at(s)).toBe('yard');
    walkTo(s, M, 'pit');
    expect(s.sceneId).toBe('pit-fight'); // still there
  });

  it('a forced door stays open; the attempt is one try', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = inDen(seed);
      walkTo(s, M, 'yard');
      const link = dungeonExits(s, M).find((x) => x.to === 'store')!.link;
      forceDoor(s, M, link);
      const after = dungeonExits(s, M).find((x) => x.to === 'store')!;
      expect(after.force).toBeUndefined();
      if (after.blocked === null) { walkTo(s, M, 'store'); expect(at(s)).toBe('store'); return; }
      expect(() => forceDoor(s, M, link)).toThrow();
    }
    throw new Error('no seed forced the door');
  });

  it('an event plays on each entry until it is settled', () => {
    const s = inDen();
    s.flags['met-vex'] = false;
    walkTo(s, M, 'yard'); walkTo(s, M, 'pit'); resolveBattle(s, M, true);
    walkTo(s, M, 'vex');
    expect(s.sceneId).toBe('vex-talk');
    choose(s, M, 'walk');
    walkTo(s, M, 'pit');
    walkTo(s, M, 'vex');
    expect(s.sceneId).toBe('vex-talk');
    choose(s, M, 'deal');
    walkTo(s, M, 'pit');
    walkTo(s, M, 'vex');
    expect(s.sceneId).toBe('den');
  });

  it('an unsettled event is still waiting when a beaten party comes back into its room', () => {
    const m = moduleWith(den(), {
      'vex-talk': { id: 'vex-talk', kind: 'story', text: ['Vex.'], next: [
        { id: 'deal', label: 'Deal', to: '@hub', effects: [{ kind: 'setFlag', flag: 'met-vex' }] },
        { id: 'fight', label: 'Fight', to: 'vex-fight' },
      ] },
      'vex-fight': { id: 'vex-fight', kind: 'battle', encounterId: 'den-muster', mapId: 'ruins', onWin: { to: '@hub' }, onLoss: { to: 'outside' } },
    });
    const s = startAdventure(newCampaign(3), m);
    enterScene(s, m, 'start'); choose(s, m, 'in');
    walkTo(s, m, 'yard'); walkTo(s, m, 'pit'); resolveBattle(s, m, true);
    walkTo(s, m, 'vex');
    expect(s.sceneId).toBe('vex-talk');
    // No backing out of a confrontation into the room it stands in.
    expect(hubReturn(s, m)).toBeNull();
    choose(s, m, 'fight');
    resolveBattle(s, m, false);
    // Beaten, dragged off, and straight back in: Vex is still at the fire.
    choose(s, m, 'back');
    expect(dungeonProgress(s, 'den', den()).at).toBe('vex');
    expect(s.sceneId).toBe('vex-talk');
  });

  it('search finds a secret door and the room\'s own find, once', () => {
    const d = den({ links: den().links.map((l) => (l.b === 'cellar' ? { ...l, door: { secret: { dc: 1 } } } : l)) });
    const m = moduleWith(d);
    const s = startAdventure(newCampaign(3), m);
    enterScene(s, m, 'den');
    s.flags[KEY_FLAG] = true;
    walkTo(s, m, 'yard'); walkTo(s, m, 'store');
    // A DC 1 secret is caught on the way in by any passive Perception.
    expect(dungeonProgress(s, 'den', d).revealed).toContain('store~cellar');
    const ev = searchRoom(s, m);
    expect(s.sceneId).toBe('store-loot');
    expect(ev.some((e) => e.type === 'scene')).toBe(true);
    choose(s, m, 'ok');
    expect(canSearch(s, m)).toBe(false);
    expect(dungeonExits(s, m).some((x) => x.to === 'cellar')).toBe(true);
  });

  it('search rolls for a secret door passive Perception missed', () => {
    const d = den({ links: den().links.map((l) => (l.b === 'cellar' ? { ...l, door: { secret: { dc: 25 } } } : l)) });
    const m = moduleWith(d);
    const s = startAdventure(newCampaign(3), m);
    enterScene(s, m, 'den');
    s.flags[KEY_FLAG] = true;
    walkTo(s, m, 'yard'); walkTo(s, m, 'store');
    expect(dungeonExits(s, m).some((x) => x.to === 'cellar')).toBe(false);
    const ev = searchRoom(s, m);
    expect(ev.some((e) => e.type === 'check')).toBe(true);
  });

  it('an ambush in a corridor is a fight on a narrow board; winning it walks on in', () => {
    const d = den({ links: den().links.map((l) => (l.b === 'kennel' ? { ...l, door: { ambush: { chance: 1, battle: 'pit-fight' } } } : l)) });
    const m = moduleWith(d, {
      'pit-fight': { id: 'pit-fight', kind: 'battle', encounterId: 'den-muster', mapId: '@room', onWin: { to: '@hub' } },
    });
    const s = startAdventure(newCampaign(3), m);
    enterScene(s, m, 'den');
    walkTo(s, m, 'yard');
    walkTo(s, m, 'kennel');
    expect(s.sceneId).toBe('pit-fight');
    expect(battleMap(s, m).name).toBe('The Den, in a corridor');
    resolveBattle(s, m, true);
    // The kennel's own fight is next.
    expect(s.sceneId).toBe('kennel-fight');
    const board = battleMap(s, m);
    expect(board.theme).toBe('ember');
    expect(board.name).toBe('The Den');
    expect(board.rows.length).toBe(10);
    expect(() => parseMap(board)).not.toThrow();
  });

  it('the torch burns by the step; out of light, the party is sent out', () => {
    const d = den({ torch: { length: 3, out: 'outside' } });
    const m = moduleWith(d);
    const s = startAdventure(newCampaign(3), m);
    enterScene(s, m, 'den');
    walkTo(s, m, 'yard');
    expect(dungeonProgress(s, 'den', d).torch).toBe(2);
    walkTo(s, m, 'pit'); // length 2
    expect(s.sceneId).toBe('outside');
    choose(s, m, 'back');
    // Back in from outside: at the door, with a fresh torch.
    expect(dungeonProgress(s, 'den', d).torch).toBe(3);
    expect(dungeonProgress(s, 'den', d).at).toBe('gate');
  });

  it('crosses rooms already seen in one tap, and only through them', () => {
    const s = inDen();
    expect(dungeonRoute(s, M, 'pit')).toBeNull();
    walkTo(s, M, 'yard');
    expect(dungeonRoute(s, M, 'gate')).toEqual(['gate']);
    walkTo(s, M, 'gate');
    expect(dungeonRoute(s, M, 'kennel')).toEqual(['yard', 'kennel']);
    walkTo(s, M, 'kennel');
    expect(s.sceneId).toBe('kennel-fight');
  });

  it('leaves only by a room with a way out, and camps where the dungeon allows', () => {
    const s = inDen();
    expect(campRule(s, M)).toEqual({});
    expect(dungeonExitHere(s, M)?.label).toBe('Out to the road');
    walkTo(s, M, 'yard');
    expect(dungeonExitHere(s, M)).toBeNull();
    expect(travelDestinations(s, M)).toEqual([]);
    walkTo(s, M, 'gate');
    leaveDungeon(s, M);
    expect(s.sceneId).toBe('outside');
  });

  it('a headless party can play it to the end', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let n = seed;
      const r = runModule(newCampaign(seed), M, {
        pick: (count) => { n = (n * 1103515245 + 12345) % 2147483648; return Math.floor((n / 2147483648) * count); },
        battle: () => true,
      }, 3000);
      expect(r.ending).toBe('victory');
    }
  });
});

describe('the Ashfang Den', () => {
  it('offers no way back into the den once the chief is dead (it would strand the ending)', async () => {
    const { HOLLOW_ROAD_MODULE: H } = await import('../src/data/modules/hollow-road.js');
    const { hubReturn } = await import('../src/adventure/runtime.js');
    const s = startAdventure(newCampaign(1), H);
    enterScene(s, H, 'inner');
    enterScene(s, H, 'boss');
    resolveBattle(s, H, true);
    expect(s.sceneId).toBe('vargan-beaten');
    expect(hubReturn(s, H)).toBeNull();
  });
});

describe('falling back', () => {
  // Vex's talk can turn into a fight: one started by the room's event, not
  // the room's own fight.
  const M2 = moduleWith(den(), {
    'vex-talk': { id: 'vex-talk', kind: 'story', text: ['Vex.'], next: [
      { id: 'deal', label: 'Deal', to: '@hub', effects: [{ kind: 'setFlag', flag: 'met-vex' }] },
      { id: 'draw', label: 'Draw steel', to: 'vex-fight' },
    ] },
    'vex-fight': { id: 'vex-fight', kind: 'battle', encounterId: 'den-muster', mapId: '@room', onWin: { to: '@hub', effects: [{ kind: 'setFlag', flag: 'met-vex' }] } },
    'caught': { id: 'caught', kind: 'battle', encounterId: 'den-muster', mapId: 'ruins', surprise: 'party', onWin: { to: '@hub' } },
  });

  it('from a fight a room\'s event started, steps back to the room the party came from', () => {
    const s = startAdventure(newCampaign(3), M2);
    enterScene(s, M2, 'start'); choose(s, M2, 'in');
    walkTo(s, M2, 'yard'); walkTo(s, M2, 'pit'); resolveBattle(s, M2, true);
    walkTo(s, M2, 'vex');
    choose(s, M2, 'draw');
    expect(currentScene(s, M2).id).toBe('vex-fight');
    fleeBattle(s, M2, false);
    expect(dungeonProgress(s, 'den', den()).at).toBe('pit');
    // Walking back in plays the event again: the fight is still there.
    expect(walkTo(s, M2, 'vex').some((e) => e.type === 'scene' && e.sceneId === 'vex-talk')).toBe(true);
  });

  it('is not offered when the party is caught out', async () => {
    const { battleOptions } = await import('../src/adventure/runtime.js');
    const s = startAdventure(newCampaign(3), M2);
    enterScene(s, M2, 'start'); choose(s, M2, 'in');
    enterScene(s, M2, 'caught');
    expect(battleOptions(s, M2).fallBack).toBeUndefined();
    // Nor when the sneak-up rolled at a fight's door went against the party.
    enterScene(s, M2, 'pit-fight');
    s.battleSurprise = { sceneId: 'pit-fight', side: 'party' };
    expect(battleOptions(s, M2).fallBack).toBeUndefined();
    s.battleSurprise = { sceneId: 'pit-fight', side: 'enemies' };
    expect(battleOptions(s, M2).fallBack).toBeDefined();
  });
});

describe('a locked map marker', () => {
  it('says why in the world\'s words, when it has a note', async () => {
    const { exploreNodes } = await import('../src/adventure/runtime.js');
    const m: Module = { id: 'n', title: 'T', blurb: '', start: 'map', scenes: {
      map: { id: 'map', kind: 'explore', map: { title: 'Map', art: {}, nodes: [
        { id: 'a', x: 1, y: 1, label: 'A', icon: 'x', scene: 'won', requires: [{ kind: 'flag', flag: 'k' }], note: 'The ravine cuts the trail.' },
        { id: 'b', x: 2, y: 2, label: 'B', icon: 'x', scene: 'won', requires: [{ kind: 'flag', flag: 'k' }] },
      ] } },
      won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] },
    } };
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'map');
    const nodes = exploreNodes(s, m);
    expect(nodes.find((n) => n.node.id === 'a')!.blocked).toBe('The ravine cuts the trail.');
    expect(nodes.find((n) => n.node.id === 'b')!.blocked).toMatch(/haven't done/);
    s.flags.k = true;
    expect(exploreNodes(s, m).find((n) => n.node.id === 'a')!.blocked).toBeNull();
  });
});
