/**
 * The exhaustive state search: every shipped module can always still be won,
 * and the two strandings it found stay fixed.
 */
import { describe, it, expect } from 'vitest';
import { checkModuleReach } from '../src/adventure/reach.js';
import { validateModule } from '../src/adventure/validate.js';
import { MODULES } from '../src/data/modules/index.js';
import type { Module, Scene } from '../src/adventure/types.js';

const byId = (id: string) => MODULES.find((m) => m.id === id)!;
const clone = (m: Module): Module => JSON.parse(JSON.stringify(m)) as Module;
/** A whole chapter takes a second or two to search, longer under a loaded
 *  test run; the default 5 s is too close. */
const SEARCH_TIMEOUT = 30_000;

describe('shipped modules', () => {
  for (const m of MODULES) {
    it(`${m.id}: every reachable state can still reach a victory`, () => {
      const r = checkModuleReach(m);
      expect(r.skipped).toBeUndefined();
      expect(r.errors).toEqual([]);
      expect(r.states).toBeGreaterThan(0);
    }, SEARCH_TIMEOUT);
  }
});

describe('what it catches', () => {
  it('the Hollow Road: walking back into the den after the chief is dead', () => {
    const m = clone(byId('hollow-road'));
    delete (m.scenes.aftermath as { noBack?: boolean }).noBack;
    const errors = checkModuleReach(m).errors;
    expect(errors.some((e) => e.includes('stranded') && e.includes('chief-dead'))).toBe(true);
  }, SEARCH_TIMEOUT);

  it('Wyrmcalling: losing the opening fight and never being briefed', () => {
    const m = clone(byId('wyrmcalling'));
    const camp = m.scenes.warcamp;
    if (camp?.kind !== 'explore') throw new Error();
    m.scenes.unbriefed = { id: 'unbriefed', kind: 'story', text: ['Vex waves you off.'], next: [{ id: 'ok', label: 'Leave', to: 'warcamp' }] };
    camp.map.nodes = camp.map.nodes.map((n) => (n.id === 'command' ? { ...n, scene: 'unbriefed' } : n));
    const errors = checkModuleReach(m).errors;
    const hit = errors.find((e) => e.includes('stranded'));
    expect(hit).toBeDefined();
    expect(hit).toContain('loses the fight'); // the way there is spelled out
  }, SEARCH_TIMEOUT);

  const tiny = (scenes: Record<string, Scene>): Module => ({ id: 'tiny', title: 'T', blurb: '', start: 'a', scenes });
  const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] };

  it('a scene behind a requirement that can never hold by then', () => {
    const m = tiny({
      a: { id: 'a', kind: 'story', text: ['A.'], next: [
        { id: 'x', label: 'Locked', to: 'b', requires: [{ kind: 'flag', flag: 'key' }] },
        { id: 'y', label: 'On', to: 'won' },
      ] },
      b: { id: 'b', kind: 'story', text: ['B.'], noBack: true, next: [{ id: 'k', label: 'Take key', to: 'won', effects: [{ kind: 'setFlag', flag: 'key' }] }] },
      won,
    });
    expect(validateModule(m).some((e) => e.startsWith('[b] can never be reached'))).toBe(true);
  });

  it('a failed check that leads nowhere it can come back from', () => {
    const m = tiny({
      a: { id: 'a', kind: 'check', skill: 'athletics', dc: 10, intro: ['Climb.'], success: { to: 'won' }, failure: { to: 'pit' } },
      pit: { id: 'pit', kind: 'story', text: ['Down.'], next: [{ id: 'z', label: 'Wait', to: 'pit' }] },
      won,
    });
    const errors = checkModuleReach(m).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('[pit]');
    expect(errors[0]).toContain('fails the check');
  });

  it('says so, rather than passing, when a module tracks too many facts', () => {
    const next = Array.from({ length: 33 }, (_, i) => ({ id: `c${i}`, label: `C${i}`, to: 'won', requires: [{ kind: 'flag' as const, flag: `f${i}` }] }));
    const m = tiny({ a: { id: 'a', kind: 'story', text: ['A.'], next }, won });
    expect(checkModuleReach(m).skipped).toMatch(/facts/);
  });
});

describe('campaign bugs found by the second read-through', () => {
  it('the finale brood is exactly the wyrmlings whose dens were left standing', async () => {
    const { ENCOUNTERS } = await import('../src/data/encounters.js');
    const wc = byId('wyrmcalling');
    const gate = wc.scenes['calling-gate'];
    if (gate?.kind !== 'story') throw new Error();
    // Green cleared, blue and red left: the only choice on offer leads to a blue+red brood.
    const flags = new Set(['green-cleared']);
    const open = gate.next.filter((c) => (c.requires ?? []).every((r) =>
      r.kind === 'flag' ? flags.has(r.flag) : r.kind === 'notFlag' ? !flags.has(r.flag) : true));
    expect(open).toHaveLength(1);
    const fight = wc.scenes[open[0]!.to];
    if (fight?.kind !== 'battle') throw new Error();
    expect([...ENCOUNTERS[fight.encounterId]!.members].sort()).toEqual(['blue-wyrmling', 'red-wyrmling']);
  });

  it('camp ambushes pay nothing, so a risky camp cannot be farmed', () => {
    for (const [mod, ids] of [['hollow-road', ['camp-ambush', 'den-camp-ambush']], ['sunken-barrows', ['fen-night', 'crypt-night']], ['wyrmcalling', ['hills-night']]] as const) {
      for (const id of ids) {
        const s = byId(mod).scenes[id];
        expect(s?.kind === 'battle' && s.loot, `${mod}:${id}`).toBe(false);
      }
    }
  });

  it('the finale\'s level floor comes before the last fight, not after', () => {
    const wc = byId('wyrmcalling');
    const approach = wc.scenes['calling-approach'];
    const battle = wc.scenes['calling-battle'];
    if (approach?.kind !== 'story' || battle?.kind !== 'battle') throw new Error();
    expect(approach.next[0]!.effects).toContainEqual({ kind: 'xpToLevel', level: 5 });
    expect(battle.onWin.effects ?? []).not.toContainEqual({ kind: 'xpToLevel', level: 5 });
  });
});

describe('ending slides', () => {
  it('show only the lines whose requirements hold', async () => {
    const { startAdventure, enterScene, endingText } = await import('../src/adventure/runtime.js');
    const { newCampaign } = await import('../src/campaign/campaign.js');
    const end: Scene = { id: 'end', kind: 'ending', outcome: 'victory', text: ['Done.'],
      slides: [{ if: [{ kind: 'flag', flag: 'kind' }], text: 'You were kind.' }, { if: [{ kind: 'notFlag', flag: 'kind' }], text: 'You were not.' }] };
    const m: Module = { id: 'slides', title: 'T', blurb: '', start: 'a', scenes: {
      a: { id: 'a', kind: 'story', text: ['A.'], next: [{ id: 'k', label: 'Be kind', to: 'end', effects: [{ kind: 'setFlag', flag: 'kind' }] }, { id: 'n', label: 'Do not', to: 'end' }] },
      end } };
    const s = startAdventure(newCampaign(1), m);
    s.flags.kind = true;
    expect(endingText(s, end)).toEqual(['Done.', 'You were kind.']);
    const ev = enterScene(s, m, 'end');
    expect(ev.find((e) => e.type === 'text')).toMatchObject({ paragraphs: ['Done.', 'You were kind.'] });
    expect(validateModule(m)).toEqual([]);
  });
});

describe('one-way challenges', () => {
  it('flags a perApproach challenge with no way back that a party can return to', () => {
    const tinyMod = (back: boolean): Module => ({ id: 't', title: 'T', blurb: '', start: 'a', scenes: {
      a: { id: 'a', kind: 'challenge', intro: ['Climb.'], retry: 'perApproach', noBack: true,
        approaches: [{ id: 'x', label: 'Climb', skill: 'athletics', dc: 10 }],
        success: { to: 'fight' }, failure: { to: 'won' } },
      fight: { id: 'fight', kind: 'battle', encounterId: 'goblins', mapId: 'open', onWin: { to: 'won' },
        ...(back ? { onLoss: { to: 'a' } } : { onLoss: { to: 'won' } }) },
      won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] },
    } });
    expect(checkModuleReach(tinyMod(true)).errors.some((e) => e.startsWith('[a] a party can come back'))).toBe(true);
    expect(checkModuleReach(tinyMod(false)).errors).toEqual([]);
  });
});

describe('outcome scenes that could be left by the back door', () => {
  it('must be one-way when every choice carries an effect', () => {
    const m: Module = { id: 'o', title: 'T', blurb: '', start: 'map', scenes: {
      map: { id: 'map', kind: 'explore', map: { title: 'Map', art: {}, nodes: [{ id: 'n', x: 1, y: 1, label: 'Fight', icon: 'x', scene: 'fight' }] } },
      fight: { id: 'fight', kind: 'battle', encounterId: 'goblins', mapId: 'open', onWin: { to: 'spoils' } },
      spoils: { id: 'spoils', kind: 'story', text: ['Loot.'], next: [{ id: 't', label: 'Take it', to: 'won', effects: [{ kind: 'gold', amount: 5 }] }] },
      won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] },
    } };
    expect(validateModule(m).some((e) => e.startsWith('[spoils]') && e.includes('set noBack'))).toBe(true);
    (m.scenes.spoils as { noBack?: boolean }).noBack = true;
    expect(validateModule(m).filter((e) => e.includes('set noBack'))).toEqual([]);
  });
});

describe('campaign bugs found by the fourth read-through', () => {
  const node = (mod: string, map: string, id: string) => {
    const s = byId(mod).scenes[map];
    if (s?.kind !== 'explore') throw new Error();
    return s.map.nodes.find((n) => n.id === id)!;
  };
  const needs = (mod: string, map: string, id: string, flag: string) =>
    expect(node(mod, map, id).requires ?? [], `${mod}:${id}`).toContainEqual({ kind: 'flag', flag });

  it('an obstacle cannot be stepped into and back out of to open the way past it', () => {
    needs('hollow-road', 'trail', 'approach', 'crossed-ravine');
    needs('hollow-road', 'trail', 'thicket', 'crossed-ravine');
    for (const id of ['blueden', 'onihold']) needs('wyrmcalling', 'hills', id, 'seam-cleared');
    for (const id of ['redden', 'gorgonvale', 'steading']) needs('wyrmcalling', 'hills', id, 'oni-cleared');
  });

  it('Marrow, talked round, does not fight in the fight that follows, and losing it keeps him talked round', async () => {
    const { ENCOUNTERS } = await import('../src/data/encounters.js');
    const doubt = byId('sunken-barrows').scenes['seal-doubt'];
    if (doubt?.kind !== 'battle') throw new Error();
    expect(ENCOUNTERS[doubt.encounterId]!.members).not.toContain('cult-fanatic');
    const lost = byId('sunken-barrows').scenes[doubt.onLoss!.to];
    expect(lost?.kind === 'rest' && lost.next).toBe('seal-doubt');
  });
});

describe('carried choices', () => {
  const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] };
  // Part one: the party picks x or y, never both, and carries the pick.
  const partA: Module = { id: 'pa', title: 'A', blurb: '', start: 'a', sequel: 'pb', carries: ['x', 'y'], scenes: {
    a: { id: 'a', kind: 'story', text: ['Pick.'], next: [
      { id: 'x', label: 'X', to: 'won', effects: [{ kind: 'setFlag', flag: 'x' }] },
      { id: 'y', label: 'Y', to: 'won', effects: [{ kind: 'setFlag', flag: 'y' }] },
    ] },
    won,
  } };
  // Part two: strands a party that carries both (no such party exists).
  const partB = (next: Module['scenes'][string]): Module => ({ id: 'pb', title: 'B', blurb: '', start: 'b', scenes: { b: next, won } });
  const both = partB({ id: 'b', kind: 'story', text: ['Go.'], next: [
    { id: 'p', label: 'P', to: 'won', requires: [{ kind: 'notFlag', flag: 'pa:x' }] },
    { id: 'q', label: 'Q', to: 'won', requires: [{ kind: 'notFlag', flag: 'pa:y' }] },
  ] });

  it('says what a victory hands on', () => {
    expect(checkModuleReach(partA, [partA, both]).carried).toEqual([['pa:x'], ['pa:y']]);
  });

  it('searches only the mixes the chapter before can hand on, plus a cold start', () => {
    expect(checkModuleReach(both, [partA, both]).errors).toEqual([]);
    // Alone, every mix is possible, and the impossible one strands.
    expect(checkModuleReach(both, [both]).errors.some((e) => e.includes('stranded') && e.includes('carried in: pa:x, pa:y'))).toBe(true);
  });

  it('always searches a cold start', () => {
    const coldStrands = partB({ id: 'b', kind: 'story', text: ['Go.'], next: [
      { id: 'p', label: 'P', to: 'won', requires: [{ kind: 'flag', flag: 'pa:x' }] },
      { id: 'q', label: 'Q', to: 'won', requires: [{ kind: 'flag', flag: 'pa:y' }] },
    ] });
    const errors = checkModuleReach(coldStrands, [partA, coldStrands]).errors;
    expect(errors.some((e) => e.startsWith('[b]') && e.includes('stranded') && !e.includes('carried in'))).toBe(true);
  });
});

describe('campaign bugs found by the fifth read-through', () => {
  const battle = (mod: string, id: string) => {
    const s = byId(mod).scenes[id];
    if (s?.kind !== 'battle') throw new Error(`${mod}:${id}`);
    return s;
  };

  it('a fight that cannot be come back to cannot be fled', () => {
    for (const [mod, id] of [['hollow-road', 'pens-alarm'], ['hollow-road', 'reedwife-fight'], ['hollow-road', 'reedwife-fight-alone'], ['sunken-barrows', 'seal-doubt']] as const) {
      expect(battle(mod, id).noFlee, `${mod}:${id}`).toBe(true);
    }
    // Losing the pens fight loses the captives, rather than leaving them in limbo.
    expect(battle('hollow-road', 'pens-alarm').onLoss?.effects).toContainEqual({ kind: 'setFlag', flag: 'captives-taken' });
  });

  it('Vex, once met, stays met', () => {
    const vex = byId('hollow-road').scenes['vex-parley'];
    expect(vex?.kind === 'dialogue' && vex.noBack).toBe(true);
  });

  it('the camp is only said to have fought its night if the Calling peaked', () => {
    const end = byId('wyrmcalling').scenes['wc-epilogue'];
    if (end?.kind !== 'ending') throw new Error();
    for (const sl of end.slides ?? []) {
      if (sl.text.includes('night of the Calling') || sl.text.includes('arrows nobody needed')) {
        expect(sl.if, sl.text).toContainEqual({ kind: 'flag', flag: 'calling-peaked' });
      }
    }
  });
});
