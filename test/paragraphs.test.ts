/**
 * Conditional paragraphs: one scene serves routes that differ in a line.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, paragraphsFor } from '../src/adventure/runtime.js';
import { validateModule } from '../src/adventure/validate.js';
import { checkModuleReach } from '../src/adventure/reach.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module } from '../src/adventure/types.js';

const mod = (text: Module['scenes'][string]): Module => ({
  id: 'p', title: 'T', blurb: '', start: 'a', companions: { wren: { id: 'wren', name: 'Wren', monsterId: 'scout', blurb: 'A scout.' } },
  scenes: { a: text, won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] } },
});
const camp = mod({ id: 'a', kind: 'story', next: [{ id: 'on', label: 'On', to: 'won' }], text: [
  'The camp cheers.',
  { if: [{ kind: 'companion', companion: 'wren' }], text: 'Wren, still at your shoulder, lowers her bow.' },
  { if: [{ kind: 'noCompanion', companion: 'wren' }], text: 'Wren waves from the scouts\' fire.' },
] });

describe('conditional paragraphs', () => {
  it('show only the lines whose requirements hold', () => {
    const s = startAdventure(newCampaign(1), camp);
    const scene = camp.scenes.a!;
    if (scene.kind !== 'story') throw new Error();
    expect(paragraphsFor(s, scene.text)).toEqual(['The camp cheers.', 'Wren waves from the scouts\' fire.']);
    s.companions = [{ id: 'wren' }];
    const ev = enterScene(s, camp, 'a');
    expect(ev.find((e) => e.type === 'text')).toMatchObject({ paragraphs: ['The camp cheers.', 'Wren, still at your shoulder, lowers her bow.'] });
  });

  it('are checked by the validator, and a scene must say something whatever holds', () => {
    expect(validateModule(camp)).toEqual([]);
    const bad = mod({ id: 'a', kind: 'dialogue', npc: { id: 'n', name: 'N' }, next: [{ id: 'on', label: 'On', to: 'won' }], lines: [
      { if: [{ kind: 'companion', companion: 'hask' }], text: 'Hask nods.' },
    ] });
    const errors = validateModule(bad);
    expect(errors.some((e) => e.includes('unknown companion \'hask\''))).toBe(true);
    expect(errors.some((e) => e.includes('every paragraph is conditional'))).toBe(true);
  });

  it('cost the reach search nothing: text never changes where a party can go', () => {
    const flagged = mod({ id: 'a', kind: 'story', next: [{ id: 'on', label: 'On', to: 'won' }], text: [
      'Plain.', { if: [{ kind: 'flag', flag: 'seen' }], text: 'You have been here.' },
    ] });
    expect(checkModuleReach(flagged).states).toBe(checkModuleReach(mod({ id: 'a', kind: 'story', text: ['Plain.'], next: [{ id: 'on', label: 'On', to: 'won' }] })).states);
  });
});
