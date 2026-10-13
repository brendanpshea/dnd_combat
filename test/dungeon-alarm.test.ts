/**
 * A dungeon's alarm (Dungeon.alarm): noise raises it, a roused place says so
 * once, and every step through a roused place may meet a patrol.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, walkTo, resolveBattle, choose, requirementMet, raiseAlarm } from '../src/adventure/runtime.js';
import { validateModule } from '../src/adventure/validate.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module } from '../src/adventure/types.js';

const ROUSED = 'A horn sounds. They know you are here.';
const camp = (patrolLoot?: boolean): Module => ({
  id: 'alarm-test', title: 'T', blurb: '', start: 'gate',
  scenes: {
    gate: { id: 'gate', kind: 'story', text: ['A camp.'], next: [
      { id: 'in', label: 'In', to: 'camp' },
      { id: 'horn', label: 'Blow a horn first', to: 'camp', effects: [{ kind: 'alarm', dungeon: 'camp', amount: 2 }] },
    ] },
    camp: { id: 'camp', kind: 'dungeon', dungeon: {
      title: 'Camp', theme: 'village', entry: 'a',
      alarm: { patrols: ['patrol'], rate: 0.5, roused: [ROUSED] },
      rooms: [
        { id: 'a', name: 'Gate' },
        { id: 'b', name: 'Tents', fight: 'tents' },
        { id: 'c', name: 'Fire' },
        { id: 'd', name: 'Hall', goal: true, exit: { to: 'won' } },
      ],
      links: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'd' }],
    } },
    tents: { id: 'tents', kind: 'battle', encounterId: 'wolves', mapId: '@room', onWin: { to: '@hub' } },
    patrol: { id: 'patrol', kind: 'battle', encounterId: 'wolves', mapId: '@room', onWin: { to: '@hub' }, ...(patrolLoot ? {} : { loot: false }) },
    won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
  },
});

const texts = (events: ReturnType<typeof walkTo>) => events.flatMap((e) => (e.type === 'text' ? e.paragraphs : []));

describe('a dungeon alarm', () => {
  it('validates, and a patrol that pays is refused', () => {
    expect(validateModule(camp())).toEqual([]);
    expect(validateModule(camp(true)).some((e) => e.includes('patrol') && e.includes('loot: false'))).toBe(true);
  });

  it('is raised by a room fight, and says so once when the place is roused', () => {
    const m = camp();
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'camp');
    const first = walkTo(s, m, 'b');
    expect(s.alarms?.camp).toBe(1);
    expect(s.sceneId).toBe('tents');
    expect(texts(first)).not.toContain(ROUSED);
    resolveBattle(s, m, true);
    const loud = [] as ReturnType<typeof walkTo>;
    raiseAlarm(s, m, 'camp', 1, loud);
    expect(texts(loud)).toEqual([ROUSED]);
    const again = [] as ReturnType<typeof walkTo>;
    raiseAlarm(s, m, 'camp', 1, again);
    expect(texts(again)).toEqual([]);
  });

  it('can be raised by the story before the party is inside, and read by it', () => {
    const m = camp();
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'gate');
    expect(requirementMet(s, { kind: 'alarm', dungeon: 'camp', below: 2 })).toBe(true);
    choose(s, m, 'horn');
    expect(s.alarms?.camp).toBe(2);
    expect(requirementMet(s, { kind: 'alarm', dungeon: 'camp', atLeast: 2 })).toBe(true);
  });

  it('sends patrols to a roused place, and none to a quiet one', () => {
    const met = (alarm: number) => {
      let patrols = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const m = camp();
        const s = startAdventure(newCampaign(seed), m);
        enterScene(s, m, 'camp');
        if (alarm) (s.alarms ??= {}).camp = alarm;
        // The first step: a patrol (if any) meets the party before the tents' fight.
        walkTo(s, m, 'b');
        if (s.sceneId === 'patrol') patrols++;
      }
      return patrols;
    };
    expect(met(0)).toBe(0);
    expect(met(1)).toBe(0);
    expect(met(4)).toBeGreaterThan(5);
  });
});
