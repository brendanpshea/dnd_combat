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
