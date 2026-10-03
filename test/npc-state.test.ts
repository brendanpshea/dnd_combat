/**
 * NPC state: what became of a character (one fate at a time) and whether the
 * party has met them, kept campaign-wide and changeable by any chapter.
 */
import { describe, it, expect } from 'vitest';
import { withNpcs, npcFateFlag, npcMetFlag, npcAttitudeFlag } from '../src/adventure/npcs.js';
import { startAdventure, enterScene, choose, carriedFlags, requirementMet, blockedReason } from '../src/adventure/runtime.js';
import { validateModule } from '../src/adventure/validate.js';
import { checkModuleReach } from '../src/adventure/reach.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module, NpcDef, Scene } from '../src/adventure/types.js';

const NPCS: Record<string, NpcDef> = {
  scout: { id: 'scout', name: 'Wren', fates: ['saved', 'left', 'dead'] },
};
const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Yes.'] };

// Part one: save the scout or leave her.
const partA = withNpcs({ id: 'na', title: 'A', blurb: '', start: 'a', sequel: 'nb', scenes: {
  a: { id: 'a', kind: 'story', text: ['A scout in a cage.'], noBack: true, next: [
    { id: 'save', label: 'Free her', to: 'won', effects: [{ kind: 'npc', npc: 'scout', met: true, fate: 'saved' }] },
    { id: 'leave', label: 'Walk on', to: 'won', effects: [{ kind: 'npc', npc: 'scout', fate: 'left' }] },
  ] },
  won,
} }, NPCS);
// Part two: a saved scout can still die here.
const partB = withNpcs({ id: 'nb', title: 'B', blurb: '', start: 'b', sequel: 'nc', scenes: {
  b: { id: 'b', kind: 'story', text: ['The ford.'], noBack: true, next: [
    { id: 'thanks', label: 'Wren waves', to: 'won', requires: [{ kind: 'npc', npc: 'scout', fate: 'saved' }] },
    { id: 'fall', label: 'Wren falls', to: 'won', requires: [{ kind: 'npc', npc: 'scout', fate: 'saved' }], effects: [{ kind: 'npc', npc: 'scout', fate: 'dead' }] },
    { id: 'alone', label: 'On alone', to: 'won', requires: [{ kind: 'npc', npc: 'scout', notFate: ['saved'] }] },
  ] },
  won,
} }, NPCS);
// Part three: reads what the scout's fate is by now.
const partC = (requires: NonNullable<Extract<Scene, { kind: 'story' }>['next'][number]['requires']>) => withNpcs({ id: 'nc', title: 'C', blurb: '', start: 'c', scenes: {
  c: { id: 'c', kind: 'story', text: ['The end.'], noBack: true, next: [
    { id: 'go', label: 'Go', to: 'won', requires },
  ] },
  won,
} }, NPCS);

describe('NPC state', () => {
  it('compiles to campaign-wide flags, and a new fate replaces the old', () => {
    const b = partB.scenes.b;
    if (b?.kind !== 'story') throw new Error();
    expect(b.next[0]!.requires).toEqual([{ kind: 'flag', flag: npcFateFlag('scout', 'saved') }]);
    expect(b.next[1]!.effects).toEqual([
      { kind: 'clearFlag', flag: npcFateFlag('scout', 'saved') },
      { kind: 'clearFlag', flag: npcFateFlag('scout', 'left') },
      { kind: 'setFlag', flag: npcFateFlag('scout', 'dead') },
    ]);
    expect(JSON.stringify(partA)).not.toContain('"kind":"npc"');
  });

  it('carries into every later chapter under its own name, and a chapter may change it', () => {
    const s = startAdventure(newCampaign(1), partA);
    enterScene(s, partA, 'a');
    choose(s, partA, 'save');
    expect(s.flags[npcMetFlag('scout')]).toBe(true);
    const handed = carriedFlags(partA, s);
    expect(handed).toEqual({ [npcMetFlag('scout')]: true, [npcFateFlag('scout', 'saved')]: true });
    const t = startAdventure(newCampaign(1), partB);
    t.flags = handed;
    enterScene(t, partB, 'b');
    choose(t, partB, 'fall');
    expect(requirementMet(t, { kind: 'flag', flag: npcFateFlag('scout', 'dead') })).toBe(true);
    expect(requirementMet(t, { kind: 'flag', flag: npcFateFlag('scout', 'saved') })).toBe(false);
    expect(carriedFlags(partB, t)).toEqual({ [npcMetFlag('scout')]: true, [npcFateFlag('scout', 'dead')]: true });
  });

  it('throws on an NPC or a fate the registry does not know', () => {
    const bad = (eff: object): Module => ({ id: 'x', title: 'X', blurb: '', start: 'a', scenes: {
      a: { id: 'a', kind: 'story', text: ['A.'], next: [{ id: 'go', label: 'Go', to: 'won', effects: [eff as never] }] }, won,
    } });
    expect(() => withNpcs(bad({ kind: 'npc', npc: 'scout', fate: 'eaten' }), NPCS)).toThrow(/no fate 'eaten'/);
    expect(() => withNpcs(bad({ kind: 'npc', npc: 'hask', met: true }), NPCS)).toThrow(/unknown NPC 'hask'/);
    expect(validateModule(bad({ kind: 'npc', npc: 'scout', met: true })).some((e) => e.includes('withNpcs'))).toBe(true);
  });

  it('the validator wants NPC state set somewhere in the campaign', () => {
    expect(validateModule(partC([{ kind: 'npc', npc: 'scout', fate: 'dead' }])).some((e) => e.includes('no scene of this chapter or an earlier one sets it'))).toBe(true);
  });

  it('the search follows NPC state across chapters, as each one leaves it', () => {
    const chapters = (c: Module) => [partA, partB, c];
    // Only what a later chapter reads is handed on: nothing reads 'left'.
    expect(checkModuleReach(partA, chapters(partC([]))).carried).toEqual([[npcFateFlag('scout', 'saved')], []]);
    expect(checkModuleReach(partB, chapters(partC([]))).errors).toEqual([]);
    // By the third chapter the scout can be dead, because part two can change her fate...
    const grave = withNpcs({ id: 'nc', title: 'C', blurb: '', start: 'c', scenes: {
      c: { id: 'c', kind: 'story', text: ['The end.'], noBack: true, next: [
        { id: 'mourn', label: 'Visit her grave', to: 'grave', requires: [{ kind: 'npc', npc: 'scout', fate: 'dead' }] },
        { id: 'go', label: 'Go', to: 'won' },
      ] },
      grave: { id: 'grave', kind: 'story', text: ['A cairn.'], noBack: true, next: [{ id: 'on', label: 'On', to: 'won' }] },
      won,
    } }, NPCS);
    expect(checkModuleReach(grave, chapters(grave)).errors).toEqual([]);
    // ...and only because of it: a part two where no one dies leaves no grave to visit.
    const kindB = withNpcs({ ...partB, scenes: { ...partB.scenes, b: { id: 'b', kind: 'story', text: ['The ford.'], noBack: true, next: [
      { id: 'on', label: 'On', to: 'won', effects: [{ kind: 'npc', npc: 'scout', met: true }] },
    ] } } }, NPCS);
    expect(checkModuleReach(grave, [partA, kindB, grave]).errors.some((e) => e.startsWith('[grave] can never be reached'))).toBe(true);
  });

  it('attitude is a signed tally that starts at 0, carries, and gates by bounds', () => {
    const m = withNpcs({ id: 'att', title: 'A', blurb: '', start: 'a', scenes: {
      a: { id: 'a', kind: 'story', text: ['A.'], present: ['scout'], next: [
        { id: 'snub', label: 'Snub her', to: 'a', effects: [{ kind: 'npc', npc: 'scout', attitude: -2 }] },
        { id: 'help', label: 'Help her', to: 'a', effects: [{ kind: 'npc', npc: 'scout', attitude: 1 }] },
        { id: 'warm', label: 'She grins', to: 'won', requires: [{ kind: 'npc', npc: 'scout', attitude: { atLeast: 1 } }] },
        { id: 'cold', label: 'She looks away', to: 'won', requires: [{ kind: 'npc', npc: 'scout', attitude: { below: 0 } }] },
        { id: 'on', label: 'On', to: 'won' },
      ] },
      won,
    } }, NPCS);
    expect(validateModule(m)).toEqual([]);
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'a');
    const open = () => ['warm', 'cold'].filter((id) => !blockedReason(s, (m.scenes.a as Extract<Scene, { kind: 'story' }>).next.find((c) => c.id === id)!.requires));
    expect(open()).toEqual([]);
    choose(s, m, 'snub');
    expect(s.flags[npcAttitudeFlag('scout')]).toBe(-2);
    expect(open()).toEqual(['cold']);
    choose(s, m, 'help'); choose(s, m, 'help'); choose(s, m, 'help');
    expect(open()).toEqual(['warm']);
    expect(carriedFlags(m, s)).toEqual({ [npcAttitudeFlag('scout')]: 1 });
  });
});

describe('a save from before a flag was renamed', () => {
  it('loads with the flag under its new name', async () => {
    const { serializeAdventure, parseAdventure } = await import('../src/adventure/save.js');
    const s = startAdventure(newCampaign(1), partB);
    s.flags = { 'na:saved-scout': true, plain: 1 };
    const renamed = { ...partB, renamedFlags: { 'na:saved-scout': npcFateFlag('scout', 'saved') } };
    const back = parseAdventure(serializeAdventure(s), renamed)!;
    expect(back.flags).toEqual({ [npcFateFlag('scout', 'saved')]: true, plain: 1 });
  });
});
