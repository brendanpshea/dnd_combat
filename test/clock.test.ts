/**
 * The chapter's clock: long rests end days, and the mornings a module names
 * play their text and change things. The reach search knows a night can pass.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, campRest, choose, dayOf, resolveShopOrRest } from '../src/adventure/runtime.js';
import { checkModuleReach } from '../src/adventure/reach.js';
import { validateModule } from '../src/adventure/validate.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module, Scene } from '../src/adventure/types.js';

const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] };

/** A camp with a door that shuts on the third morning, and a way round. */
const clocked = (wayRound: boolean): Module => ({
  id: 'clock', title: 'T', blurb: '', start: 'camp',
  dawns: [
    { day: 2, text: ['Rain.'] },
    { day: 3, text: ['The gate is barred.'], effects: [{ kind: 'setFlag', flag: 'gate-shut' }] },
  ],
  scenes: {
    camp: { id: 'camp', kind: 'explore', map: { title: 'Camp', art: {}, camp: {}, nodes: [
      { id: 'gate', x: 1, y: 1, label: 'Gate', icon: 'x', scene: 'gate', requires: [{ kind: 'notFlag', flag: 'gate-shut' }] },
      ...(wayRound ? [{ id: 'wall', x: 2, y: 2, label: 'Wall', icon: 'x', scene: 'won' }] : []),
    ] } },
    gate: { id: 'gate', kind: 'story', text: ['Through.'], next: [{ id: 'go', label: 'Go', to: 'won' }] },
    won,
  },
});

describe('the clock', () => {
  it('a long rest ends the day; the morning it names plays and changes things', () => {
    const m = clocked(true);
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'camp');
    expect(dayOf(s)).toBe(1);
    campRest(s, m, 'short');
    expect(dayOf(s)).toBe(1);
    let ev = campRest(s, m, 'long');
    expect(dayOf(s)).toBe(2);
    expect(ev).toContainEqual({ type: 'dawn', day: 2 });
    expect(ev).toContainEqual({ type: 'text', paragraphs: ['Rain.'] });
    expect(s.flags['gate-shut']).toBeUndefined();
    ev = campRest(s, m, 'long');
    expect(ev).toContainEqual({ type: 'text', paragraphs: ['The gate is barred.'] });
    expect(s.flags['gate-shut']).toBe(true);
  });

  it('a camp broken up by a fight is not a night slept', () => {
    const m = clocked(true);
    const camp = m.scenes.camp;
    if (camp?.kind !== 'explore') throw new Error();
    camp.map.camp = { risky: { chance: 1, battleScene: 'jumped' } };
    m.scenes.jumped = { id: 'jumped', kind: 'battle', encounterId: 'goblins', mapId: 'open', onWin: { to: '@hub' } };
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'camp');
    campRest(s, m, 'long');
    expect(dayOf(s)).toBe(1);
  });

  it('a long rest scene ends the day too', () => {
    const m: Module = { id: 'inn', title: 'T', blurb: '', start: 'a', dawns: [{ day: 2, text: ['Dawn.'] }], scenes: {
      a: { id: 'a', kind: 'story', text: ['A.'], next: [{ id: 'sleep', label: 'Sleep', to: 'bed' }] },
      bed: { id: 'bed', kind: 'rest', variant: 'long', next: 'won' },
      won,
    } };
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'a');
    choose(s, m, 'sleep');
    expect(s.sceneId).toBe('bed');
    resolveShopOrRest(s, m);
    expect(dayOf(s)).toBe(2);
    expect(s.sceneId).toBe('won');
  });

  it('the validator wants mornings in order, each with something to read', () => {
    const m = clocked(true);
    m.dawns = [{ day: 3, text: ['x'] }, { day: 2, text: [] }];
    const errors = validateModule(m);
    expect(errors.some((e) => e.includes('dawn of day 2 must be'))).toBe(true);
    expect(errors.some((e) => e.includes('dawn of day 2 has no text'))).toBe(true);
    // A flag set only by a dawn counts as set.
    expect(validateModule(clocked(true))).toEqual([]);
  });

  it('the reach search finds a party that slept past its only way through', () => {
    const shut = checkModuleReach(clocked(false)).errors;
    expect(shut.some((e) => e.includes('stranded') && e.includes('sleeps until the morning of day 3'))).toBe(true);
    expect(checkModuleReach(clocked(true)).errors).toEqual([]);
  });

  it('a dawn whose flag a scene can also set still counts as its own morning', () => {
    const m = clocked(false);
    const gate = m.scenes.gate;
    if (gate?.kind !== 'story') throw new Error();
    gate.next.push({ id: 'bar', label: 'Bar it behind you', to: 'won', effects: [{ kind: 'setFlag', flag: 'gate-shut' }] });
    expect(checkModuleReach(m).errors.some((e) => e.includes('sleeps until the morning of day 3'))).toBe(true);
  });
});

describe('the shipped clocks', () => {
  it('the Hollow Road: the captives are gone after the sixth night', async () => {
    const { MODULES } = await import('../src/data/modules/index.js');
    const m = MODULES.find((x) => x.id === 'hollow-road')!;
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'square');
    for (let n = 0; n < 5; n++) campRest(s, m, 'long');
    expect(s.flags['captives-taken']).toBeUndefined();
    campRest(s, m, 'long');
    expect(dayOf(s)).toBe(7);
    expect(s.flags['captives-taken']).toBe(true);
  });

  it('the Wyrmcalling: after the peak, a den left standing is empty', async () => {
    const { MODULES } = await import('../src/data/modules/index.js');
    const m = MODULES.find((x) => x.id === 'wyrmcalling')!;
    const hills = m.scenes.hills;
    if (hills?.kind !== 'explore') throw new Error();
    for (const id of ['greenden', 'blueden', 'redden']) {
      const when = hills.map.nodes.find((n) => n.id === id)!.sceneWhen!;
      expect(when.at(-1)).toEqual({ if: [{ kind: 'flag', flag: 'calling-peaked' }], to: 'den-flown' });
    }
    expect(m.dawns!.find((d) => d.effects?.length)!.effects).toEqual([{ kind: 'setFlag', flag: 'calling-peaked' }]);
  });
});

describe('losing a day', () => {
  it('moves the clock without a rest, and plays the morning it brings', () => {
    const m = clocked(true);
    m.scenes.lost = { id: 'lost', kind: 'story', text: ['Lost.'], noBack: true, next: [{ id: 'on', label: 'Trudge back', to: 'camp', effects: [{ kind: 'passDay' }, { kind: 'passDay' }] }] };
    const camp = m.scenes.camp;
    if (camp?.kind !== 'explore') throw new Error();
    camp.map.nodes.push({ id: 'bog', x: 3, y: 3, label: 'Bog', icon: 'x', scene: 'lost' });
    expect(validateModule(m)).toEqual([]);
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'lost');
    const hp = s.campaign.characters.map((c) => c.hp);
    const ev = choose(s, m, 'on');
    expect(dayOf(s)).toBe(3);
    expect(s.flags['gate-shut']).toBe(true);
    expect(ev).toContainEqual({ type: 'text', paragraphs: ['The gate is barred.'] });
    expect(s.campaign.characters.map((c) => c.hp)).toEqual(hp);
  });

  it('the reach search knows a lost day can shut a door', () => {
    const m = clocked(false);
    const gate = m.scenes.gate;
    if (gate?.kind !== 'story') throw new Error();
    m.scenes.lost = { id: 'lost', kind: 'story', text: ['Lost.'], noBack: true, next: [{ id: 'on', label: 'Trudge back', to: 'camp', effects: [{ kind: 'passDay' }] }] };
    const camp = m.scenes.camp;
    if (camp?.kind !== 'explore') throw new Error();
    camp.map.camp = undefined; // no sleeping here: only the lost day moves the clock
    camp.map.nodes.push({ id: 'bog', x: 3, y: 3, label: 'Bog', icon: 'x', scene: 'lost' });
    expect(checkModuleReach(m).errors.some((e) => e.includes('loses a day to the morning of day 3'))).toBe(true);
  });

  it('a dawn cannot lose a day', () => {
    const m = clocked(true);
    m.dawns = [{ day: 2, text: ['x'], effects: [{ kind: 'passDay' }] }];
    expect(validateModule(m).some((e) => e.includes('cannot pass another'))).toBe(true);
  });
});
