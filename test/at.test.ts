/**
 * `at`: where the party is (the map or dungeon it last entered). A defeat
 * scene or a dawn is read somewhere, and a line can say where.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, requirementMet } from '../src/adventure/runtime.js';
import { validateModule } from '../src/adventure/validate.js';
import { checkModuleReach } from '../src/adventure/reach.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module, Scene } from '../src/adventure/types.js';

const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] };
const map = (id: string, to: string, label: string): Scene => ({ id, kind: 'explore', map: { title: id, art: {}, nodes: [
  { id: 'go', x: 1, y: 1, label, icon: '🚪', scene: to },
] } } as Scene);
const mod = (wake: Scene['kind'] extends never ? never : string): Module => ({ id: 'at', title: 'A', blurb: '', start: 'town', scenes: {
  town: map('town', 'road', 'To the fen'),
  road: { id: 'road', kind: 'story', text: ['The road.'], next: [{ id: 'fen', label: 'Into the fen', to: 'fen' }, { id: 'rest', label: 'Rest', to: 'wake' }] },
  fen: map('fen', 'wake', 'Sleep'),
  wake: { id: 'wake', kind: 'story', noBack: true, text: ['You wake.', { assumes: [{ kind: 'at', hub: wake }], text: 'Reeds all round you.' }],
    next: [{ id: 'on', label: 'On', to: 'won' }] },
  won,
} });

describe('where the party is', () => {
  it('the runtime reads it from the last map or dungeon entered', () => {
    const m = mod('fen');
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'town');
    expect(requirementMet(s, { kind: 'at', hub: 'town' })).toBe(true);
    enterScene(s, m, 'fen');
    expect(requirementMet(s, { kind: 'at', hub: 'fen' })).toBe(true);
    expect(requirementMet(s, { kind: 'at', hub: 'town' })).toBe(false);
  });

  it('the search proves a line that assumes a place, or shows the way it breaks', () => {
    const errors = checkModuleReach(mod('fen'), [mod('fen')]).errors;
    // Waking from the road (still at the town) breaks the fen's line.
    expect(errors.some((e) => e.startsWith('[wake]') && e.includes('assumes at fen'))).toBe(true);
  });

  it('the validator wants a real place', () => {
    expect(validateModule(mod('road')).some((e) => e.includes("requires being at 'road', which is not a map or a dungeon"))).toBe(true);
  });
});
