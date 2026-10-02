/**
 * Coming back to a fight, a check or a challenge: its `again` intro, not the
 * first meeting replayed. And a talk-down that fails can say why.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, parleyBattle } from '../src/adventure/runtime.js';
import { validateModule } from '../src/adventure/validate.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module } from '../src/adventure/types.js';
import { ENCOUNTERS } from '../src/data/encounters.js';

const ENC = Object.keys(ENCOUNTERS)[0]!;

const mod: Module = { id: 'ri', title: 'R', blurb: '', start: 'gate', scenes: {
  gate: { id: 'gate', kind: 'battle', encounterId: ENC, mapId: 'open',
    intro: ['Three goblins jump out of the ditch.'],
    again: ['The goblins are still in the ditch, and they are ready for you now.'],
    parley: { dc: 30, success: { to: 'won' }, refused: ['The boss spits. "You talk like a toll-man."'] },
    onWin: { to: 'won' } },
  won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
} };
const text = (ev: ReturnType<typeof enterScene>) => ev.filter((e) => e.type === 'text').flatMap((e) => ('paragraphs' in e ? e.paragraphs : []));

describe('return intros', () => {
  it('a fight come back to says so, instead of replaying how it began', () => {
    expect(validateModule(mod)).toEqual([]);
    const s = startAdventure(newCampaign(1), mod);
    expect(text(enterScene(s, mod, 'gate'))).toEqual(['Three goblins jump out of the ditch.']);
    expect(text(enterScene(s, mod, 'gate'))).toEqual(['The goblins are still in the ditch, and they are ready for you now.']);
  });

  it('a failed talk-down can say why the fight goes on', () => {
    const s = startAdventure(newCampaign(1), mod);
    enterScene(s, mod, 'gate');
    expect(text(parleyBattle(s, mod))).toContain('The boss spits. "You talk like a toll-man."');
  });

  it('a return intro must say something whatever holds', () => {
    const bad: Module = { ...mod, scenes: { ...mod.scenes, gate: { ...mod.scenes.gate!, again: [{ if: [{ kind: 'flag', flag: 'x' }], text: 'Maybe.' }] } as Module['scenes'][string] } };
    expect(validateModule(bad).some((e) => e.includes('every paragraph is conditional'))).toBe(true);
  });
});
