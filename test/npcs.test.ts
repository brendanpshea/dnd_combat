/**
 * The NPC registry: tokens resolve to names, speakers and companions come
 * from one record, and introductions feed the cast check.
 */
import { describe, it, expect } from 'vitest';
import { withNpcs, speaker, companionsFrom, unresolvedTokens } from '../src/adventure/npcs.js';
import { validateModule } from '../src/adventure/validate.js';
import { checkModuleReach } from '../src/adventure/reach.js';
import type { Module, NpcDef } from '../src/adventure/types.js';

const NPCS: Record<string, NpcDef> = {
  vargan: { id: 'vargan', name: 'Vargan', aka: ['the chief'], portraitId: 'npc-noble', introducedAt: { t: ['bandit'] } },
  wren: { id: 'wren', name: 'Wren', portraitId: 'npc-scout', emoji: '🏹', monsterId: 'scout', blurb: 'A scout.' },
};
const raw = (hall: string): Module => ({
  id: 't', title: 'T', blurb: '', start: 'road', scenes: {
    road: { id: 'road', kind: 'story', text: ['A road.'], noBack: true, next: [
      { id: 'talk', label: 'Ask about {vargan}', to: 'bandit' },
      { id: 'rush', label: 'Rush the hall', to: 'hall' },
    ] },
    bandit: { id: 'bandit', kind: 'dialogue', npc: speaker(NPCS.wren!, 'Chief of Scouts'), lines: ['"**{vargan}** runs the den."'], noBack: true, next: [{ id: 'on', label: 'On', to: 'hall' }] },
    hall: { id: 'hall', kind: 'story', text: [hall], noBack: true, next: [{ id: 'end', label: 'End it', to: 'won' }] },
    won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
  },
});

describe('the NPC registry', () => {
  it('resolves every token to the registry\'s name, and a rename is one line', () => {
    const m = withNpcs(raw('{vargan}\'s throne.'), NPCS);
    const hall = m.scenes.hall;
    if (hall?.kind !== 'story') throw new Error();
    expect(hall.text).toEqual(['Vargan\'s throne.']);
    const renamed = withNpcs(raw('{vargan}\'s throne.'), { ...NPCS, vargan: { ...NPCS.vargan!, name: 'Varga' } });
    expect(JSON.stringify(renamed.scenes)).not.toContain('Vargan');
    expect(JSON.stringify(renamed.scenes)).toContain('Varga\'s throne');
  });

  it('a misspelt token is an error at load, and an unresolved one fails validation', () => {
    expect(() => withNpcs(raw('{vragan} rises.'), NPCS)).toThrow(/unknown NPC token.*\{vragan\}/);
    expect(validateModule(raw('{vargan} rises.')).some((e) => e.includes('unresolved NPC token {vargan}'))).toBe(true);
    expect(unresolvedTokens(withNpcs(raw('Plain.'), NPCS))).toEqual([]);
  });

  it('speakers and companions come from the same record', () => {
    expect(speaker(NPCS.wren!, 'Chief of Scouts')).toEqual({ id: 'npc-wren', name: 'Wren, Chief of Scouts', portraitId: 'npc-scout', emoji: '🏹' });
    expect(companionsFrom(NPCS, ['wren']).wren).toMatchObject({ name: 'Wren', monsterId: 'scout', blurb: 'A scout.' });
    expect(() => companionsFrom(NPCS, ['vargan'])).toThrow(/can join/);
  });

  it('the registry\'s introductions feed the cast check', () => {
    // Rushing the hall shows his name before the bandit names him.
    const m = withNpcs(raw('{vargan} rises.'), NPCS);
    expect(checkModuleReach(m).errors.some((e) => e.includes('names Vargan before any introduction'))).toBe(true);
    // The road's own label names him too, before anything introduces him.
    expect(checkModuleReach(m).errors.some((e) => e.startsWith('[road]'))).toBe(true);
  });
});
