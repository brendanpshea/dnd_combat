/**
 * One try shared across a group (`attempt`), and return-visit text (`again`).
 */
import { describe, it, expect } from 'vitest';
import {
  startAdventure, enterScene, choose, legalChoices, legalApproaches, tryApproach,
  battleOptions, parleyBattle, sceneParagraphs,
} from '../src/adventure/runtime.js';
import { validateModule } from '../src/adventure/validate.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module, Scene } from '../src/adventure/types.js';

const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] };
const map: Scene = { id: 'map', kind: 'explore', map: { title: 'Map', art: {}, nodes: [
  { id: 'cliff', x: 1, y: 1, label: 'Cliff', icon: 'x', scene: 'cliff' },
  { id: 'wall', x: 2, y: 2, label: 'Wall', icon: 'x', scene: 'wall' },
  { id: 'gate', x: 3, y: 3, label: 'Gate', icon: 'x', scene: 'gate' },
] } };
// The same bargain three ways: a choice, a challenge approach, a parley.
const m: Module = { id: 'att', title: 'T', blurb: '', start: 'map', scenes: {
  map, won,
  cliff: { id: 'cliff', kind: 'story', text: ['A manticore.'], again: ['The manticore again.'], next: [
    { id: 'notes', label: 'Bargain (with the notes)', to: 'map', attempt: 'toll', check: { skill: 'persuasion', dc: 30, failTo: 'map' } },
    { id: 'plain', label: 'Bargain', to: 'map', attempt: 'toll', check: { skill: 'persuasion', dc: 30, failTo: 'map' } },
    { id: 'leave', label: 'Leave', to: 'map' },
  ] },
  wall: { id: 'wall', kind: 'challenge', intro: ['A wall.'], retry: 'perApproach',
    approaches: [
      { id: 'talk', label: 'Talk', skill: 'persuasion', dc: 30, attempt: 'toll' },
      { id: 'climb', label: 'Climb', skill: 'athletics', dc: 30 },
    ],
    success: { to: 'won' }, failure: { to: 'map' } },
  gate: { id: 'gate', kind: 'battle', encounterId: 'goblins', mapId: 'open', onWin: { to: 'won' },
    parley: { dc: 30, success: { to: 'won' }, attempt: 'toll' } },
} };

describe('attempt groups', () => {
  it('one try at the bargain, whichever form it takes', () => {
    expect(validateModule(m)).toEqual([]);
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'cliff');
    expect(legalChoices(s, m).map((c) => c.choice.id)).toEqual(['notes', 'plain', 'leave']);
    choose(s, m, 'notes'); // fails (DC 30), back to the map
    enterScene(s, m, 'cliff');
    expect(legalChoices(s, m).map((c) => c.choice.id)).toEqual(['leave']);
    expect(() => choose(s, m, 'plain')).toThrow(/already tried/);
    enterScene(s, m, 'wall');
    expect(legalApproaches(s, m).find((a) => a.approach.id === 'talk')!.spent).toBe(true);
    expect(legalApproaches(s, m).find((a) => a.approach.id === 'climb')!.spent).toBe(false);
    expect(() => tryApproach(s, m, 'talk')).toThrow(/already tried/);
    enterScene(s, m, 'gate');
    expect(battleOptions(s, m).parley).toBeUndefined();
  });

  it('a parley spends it for the choices too', () => {
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'gate');
    parleyBattle(s, m);
    enterScene(s, m, 'cliff');
    expect(legalChoices(s, m).map((c) => c.choice.id)).toEqual(['leave']);
  });
});

describe('return visits', () => {
  it('a scene with `again` says it on every visit after the first', () => {
    const s = startAdventure(newCampaign(1), m);
    const first = enterScene(s, m, 'cliff');
    expect(first.find((e) => e.type === 'text')).toMatchObject({ paragraphs: ['A manticore.'] });
    choose(s, m, 'leave');
    const again = enterScene(s, m, 'cliff');
    expect(again.find((e) => e.type === 'text')).toMatchObject({ paragraphs: ['The manticore again.'] });
    const cliff = m.scenes.cliff;
    if (cliff?.kind !== 'story') throw new Error();
    expect(sceneParagraphs(s, cliff)).toEqual(['The manticore again.']);
  });

  it('`again` must always say something', () => {
    const bad: Module = JSON.parse(JSON.stringify(m)) as Module;
    const cliff = bad.scenes.cliff;
    if (cliff?.kind !== 'story') throw new Error();
    cliff.again = [{ if: [{ kind: 'flag', flag: 'x' }], text: 'Maybe.' }];
    expect(validateModule(bad).some((e) => e.startsWith('[cliff]') && e.includes('always shows'))).toBe(true);
  });
});
