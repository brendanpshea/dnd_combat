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

describe('shipped modules', () => {
  for (const m of MODULES) {
    it(`${m.id}: every reachable state can still reach a victory`, () => {
      const r = checkModuleReach(m);
      expect(r.skipped).toBeUndefined();
      expect(r.errors).toEqual([]);
      expect(r.states).toBeGreaterThan(0);
    });
  }
});

describe('what it catches', () => {
  it('the Hollow Road: walking back into the den after the chief is dead', () => {
    const m = clone(byId('hollow-road'));
    delete (m.scenes.aftermath as { noBack?: boolean }).noBack;
    const errors = checkModuleReach(m).errors;
    expect(errors.some((e) => e.includes('stranded') && e.includes('chief-dead'))).toBe(true);
  });

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
  });

  const tiny = (scenes: Record<string, Scene>): Module => ({ id: 'tiny', title: 'T', blurb: '', start: 'a', scenes });
  const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] };

  it('a scene behind a requirement that can never hold by then', () => {
    const m = tiny({
      a: { id: 'a', kind: 'story', text: ['A.'], next: [
        { id: 'x', label: 'Locked', to: 'b', requires: [{ kind: 'flag', flag: 'key' }] },
        { id: 'y', label: 'On', to: 'won' },
      ] },
      b: { id: 'b', kind: 'story', text: ['B.'], next: [{ id: 'k', label: 'Take key', to: 'won', effects: [{ kind: 'setFlag', flag: 'key' }] }] },
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
