/**
 * One-time things can't be spent by walking away from them.
 */
import { describe, it, expect } from 'vitest';
import { validateModule } from '../src/adventure/validate.js';
import type { Module, Scene } from '../src/adventure/types.js';

const won: Scene = { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] };

describe('the validator guards one-time things', () => {
  it('a challenge reached by a one-try choice must be one-way', () => {
    const m = (noBack: boolean): Module => ({ id: 'o', title: 'O', blurb: '', start: 'map', scenes: {
      map: { id: 'map', kind: 'explore', map: { title: 'M', nodes: [{ id: 'n', x: 1, y: 1, label: 'Statues', icon: '🗿', scene: 'vale' }] } } as Scene,
      vale: { id: 'vale', kind: 'story', text: ['Statues.'], next: [
        { id: 'rob', label: 'Rob them', to: 'sneak', once: true },
        { id: 'go', label: 'Go on', to: 'won' },
      ] },
      sneak: { id: 'sneak', kind: 'challenge', intro: ['Quietly.'], ...(noBack ? { noBack: true } : {}),
        approaches: [{ id: 'creep', label: 'Creep in', skill: 'stealth', dc: 10 }],
        success: { to: 'won' }, failure: { to: 'won' } },
      won,
    } });
    expect(validateModule(m(false)).some((e) => String(e).startsWith('[sneak]') && String(e).includes('one-try choice'))).toBe(true);
    expect(validateModule(m(true)).some((e) => e.includes('one-try choice'))).toBe(false);
  });
});

describe('a camp with a night limit', () => {
  it('lets the party sleep there that many nights, then short rests only', async () => {
    const { startAdventure, enterScene, campRest, nightsLeft } = await import('../src/adventure/runtime.js');
    const { newCampaign } = await import('../src/campaign/campaign.js');
    const m: Module = { id: 'cn', title: 'C', blurb: '', start: 'map', scenes: {
      map: { id: 'map', kind: 'explore', map: { title: 'M', camp: { nights: 2 }, nodes: [{ id: 'n', x: 1, y: 1, label: 'Out', icon: '🚪', scene: 'won' }] } } as Scene,
      won,
    } };
    expect(validateModule(m)).toEqual([]);
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'map');
    expect(nightsLeft(s, m)).toBe(2);
    campRest(s, m, 'long');
    campRest(s, m, 'long');
    expect(nightsLeft(s, m)).toBe(0);
    expect(() => campRest(s, m, 'long')).toThrow(/No nights left/);
    expect(() => campRest(s, m, 'short')).not.toThrow();
    const bad = { ...m, scenes: { ...m.scenes, map: { ...m.scenes.map!, map: { ...(m.scenes.map as Extract<Scene, { kind: 'explore' }>).map, camp: { nights: 0 } } } as Scene } };
    expect(validateModule(bad).some((e) => e.includes('camp nights'))).toBe(true);
  });
});

describe('the validator holds the guide\'s money and XP rules', () => {
  const enc = 'cutpurses';
  const base = (parleyEffects: Module['scenes'][string] extends never ? never : unknown[], lossText: string): Module => ({
    id: 'mx', title: 'M', blurb: '', start: 'a', scenes: {
      a: { id: 'a', kind: 'story', text: ['A.'], noBack: true, next: [
        { id: 'rob', label: 'Get robbed', to: 'robbed', effects: [{ kind: 'gold', amount: -15 }] },
        { id: 'fight', label: 'Fight', to: 'f' },
      ] },
      robbed: { id: 'robbed', kind: 'story', text: [lossText], noBack: true, next: [{ id: 'on', label: 'On', to: 'f' }] },
      f: { id: 'f', kind: 'battle', encounterId: enc, mapId: 'open', onWin: { to: 'won' },
        parley: { dc: 10, success: { to: 'won', effects: parleyEffects as never } } },
      won,
    },
  });
  it('a talk-down must pay XP', () => {
    expect(validateModule(base([], 'Your purse is gone.')).some((e) => e.includes('parley succeeds without paying XP'))).toBe(true);
    expect(validateModule(base([{ kind: 'xp', amount: 10 }], 'Your purse is gone.')).some((e) => e.includes('parley'))).toBe(false);
  });
  it('a loss of gold is not narrated as a sum', () => {
    expect(validateModule(base([{ kind: 'xp', amount: 10 }], 'Fifteen gold went with him.')).some((e) => e.includes('names a sum'))).toBe(true);
  });
});

describe('a scene reached as an outcome says whether it can be walked away from', () => {
  it('is an error to leave it undeclared', () => {
    const m = (decl: object): Module => ({ id: 'bk', title: 'B', blurb: '', start: 'map', scenes: {
      map: { id: 'map', kind: 'explore', map: { title: 'M', nodes: [{ id: 'n', x: 1, y: 1, label: 'Hall', icon: '🚪', scene: 'hall' }] } } as Scene,
      hall: { id: 'hall', kind: 'story', text: ['A hall.'], next: [{ id: 'win', label: 'Win', to: 'won-hall' }] },
      'won-hall': { id: 'won-hall', kind: 'story', text: ['You won.'], ...decl, next: [{ id: 'on', label: 'On', to: 'won' }] } as Scene,
      won,
    } });
    expect(validateModule(m({})).some((e) => e.startsWith('[won-hall]') && e.includes('declare noBack'))).toBe(true);
    expect(validateModule(m({ noBack: true })).some((e) => e.includes('declare noBack'))).toBe(false);
    expect(validateModule(m({ back: true })).some((e) => e.includes('declare noBack'))).toBe(false);
  });
});

describe('a night broken up by an ambush', () => {
  it('does not count against the camp\'s nights', async () => {
    const { startAdventure, enterScene, campRest, nightsLeft } = await import('../src/adventure/runtime.js');
    const { newCampaign } = await import('../src/campaign/campaign.js');
    const m: Module = { id: 'cz', title: 'C', blurb: '', start: 'map', scenes: {
      map: { id: 'map', kind: 'explore', map: { title: 'M', camp: { nights: 1, risky: { chance: 1, battleScene: 'ambush' } }, nodes: [{ id: 'n', x: 1, y: 1, label: 'Out', icon: '🚪', scene: 'won' }] } } as Scene,
      ambush: { id: 'ambush', kind: 'battle', encounterId: 'cutpurses', mapId: 'open', onWin: { to: '@hub' } },
      won,
    } };
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'map');
    campRest(s, m, 'long');
    expect(s.sceneId).toBe('ambush');
    expect(s.campNights?.map ?? 0).toBe(0);
    void nightsLeft;
  });

  it('lost, is not a night slept: the way out of it is no long rest', () => {
    const m = (lost: Scene): Module => ({ id: 'cl', title: 'C', blurb: '', start: 'map', scenes: {
      map: { id: 'map', kind: 'explore', map: { title: 'M', camp: { risky: { chance: 1, battleScene: 'ambush' } }, nodes: [{ id: 'n', x: 1, y: 1, label: 'Out', icon: '🚪', scene: 'won' }] } } as Scene,
      ambush: { id: 'ambush', kind: 'battle', encounterId: 'cutpurses', mapId: 'open', onWin: { to: '@hub' }, onLoss: { to: 'lost' } },
      lost,
      won,
    } });
    const flagged = (lost: Scene) => validateModule(m(lost)).some((e) => e.startsWith('[ambush]') && e.includes('must not be a rest'));
    expect(flagged({ id: 'lost', kind: 'rest', variant: 'long', next: 'map' })).toBe(true);
    expect(flagged({ id: 'lost', kind: 'story', noBack: true, text: ['Cold.'], next: [{ id: 'up', label: 'Up', to: 'map', effects: [{ kind: 'heal', amount: 'full' }] }] })).toBe(true);
    expect(flagged({ id: 'lost', kind: 'story', noBack: true, text: ['Cold.'], next: [{ id: 'up', label: 'Up', to: 'map' }] })).toBe(false);
  });
});

describe('a fight with no way out', () => {
  it('may not lose into a short rest straight back into it', () => {
    const m = (variant: 'short' | 'long'): Module => ({ id: 'lo', title: 'L', blurb: '', start: 'boss', scenes: {
      boss: { id: 'boss', kind: 'battle', encounterId: 'cutpurses', mapId: 'open', noFlee: true, onWin: { to: 'won' }, onLoss: { to: 'lost' } },
      lost: { id: 'lost', kind: 'rest', variant, next: 'boss' },
      won,
    } });
    const flagged = (v: 'short' | 'long') => validateModule(m(v)).some((e) => e.startsWith('[boss]') && e.includes('make it a long rest'));
    expect(flagged('short')).toBe(true);
    expect(flagged('long')).toBe(false);
  });
});

describe('a rest straight back into a fight', () => {
  it('heals in full without a night when it is sameDay, and the validator asks for it', async () => {
    const { startAdventure, enterScene, resolveShopOrRest, dayOf } = await import('../src/adventure/runtime.js');
    const { newCampaign } = await import('../src/campaign/campaign.js');
    const m = (sameDay: boolean): Module => ({ id: 'sd', title: 'S', blurb: '', start: 'lost', scenes: {
      boss: { id: 'boss', kind: 'battle', encounterId: 'cutpurses', mapId: 'open', onWin: { to: 'won' }, onLoss: { to: 'lost' } },
      lost: { id: 'lost', kind: 'rest', variant: 'long', ...(sameDay ? { sameDay: true as const } : {}), next: 'boss' },
      won,
    } });
    const s = startAdventure(newCampaign(1), m(true));
    enterScene(s, m(true), 'lost');
    resolveShopOrRest(s, m(true));
    expect(dayOf(s)).toBe(1);
    expect(s.sceneId).toBe('boss');
    expect(validateModule(m(false)).some((e) => e.includes('give it sameDay'))).toBe(true);
    expect(validateModule(m(true)).some((e) => e.includes('give it sameDay'))).toBe(false);
  });
});

describe('regard follows what an NPC saw', () => {
  it('wants an attitude change guarded on the NPC being there, or marked hearsay', async () => {
    const { withNpcs } = await import('../src/adventure/npcs.js');
    const NPCS = { scout: { id: 'scout', name: 'Wren', fates: ['saved'] } };
    const m = (choice: object, present?: string[]): Module => withNpcs({ id: 'rg', title: 'R', blurb: '', start: 'a', scenes: {
      a: { id: 'a', kind: 'story', text: ['A.'], noBack: true, ...(present ? { present } : {}), next: [{ id: 'go', label: 'Go', to: 'won', ...choice }] } as Scene,
      won,
    } }, NPCS);
    const flagged = (mod: Module) => validateModule(mod).some((e) => e.includes("scout's regard"));
    const att = { kind: 'npc', npc: 'scout', attitude: 1 };
    expect(flagged(m({ effects: [att] }))).toBe(true);
    expect(flagged(m({ effects: [att], requires: [{ kind: 'npc', npc: 'scout', met: true }] }))).toBe(false);
    expect(flagged(m({ effects: [{ ...att, met: true }] }))).toBe(false);
    expect(flagged(m({ effects: [att] }, ['scout']))).toBe(false);
    expect(flagged(m({ effects: [{ ...att, hearsay: true }] }))).toBe(false);
  });
});
