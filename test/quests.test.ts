/**
 * Quests: woven into ordinary scenes, done early is done, objects that are
 * flags (nothing to sell), and a proof that a quest taken can always still
 * be finished — unless the story chose to lose it.
 */
import { describe, it, expect } from 'vitest';
import { compileQuests, questErrors, taken, done } from '../src/adventure/quests.js';
import { validateLive, expandModule } from '../src/adventure/embed.js';
import { startAdventure, enterScene, choose, legalChoices } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module, QuestSpec } from '../src/adventure/types.js';

const RING: QuestSpec = {
  title: 'The Reeve\'s Ring', summary: 'The reeve wants his ring back from the barrow.',
  giver: { scene: 'square', name: 'the reeve' },
  offer: [`"My father's ring is in the barrow. Bring it back, and you'll not be sorry."`],
  stages: [{ text: 'Find the ring in the barrow', done: [{ kind: 'flag', flag: 'has-ring' }] }],
  objects: { 'has-ring': 'the reeve\'s ring' },
  reward: [{ kind: 'gold', amount: 50 }],
  thanks: ['The reeve turns the ring over in his hands, and pays.'],
};

/** A square with the reeve, a barrow with the ring, and a river by the road. */
function story(extra: Partial<Module> = {}, river: 'none' | 'lose' | 'fail' = 'none', q: QuestSpec = RING): Module {
  return {
    id: 'ring', title: 'Ring', blurb: 'b', start: 'square', quests: { ring: q },
    scenes: {
      square: { id: 'square', kind: 'story', text: ['The village square.'], next: [
        { id: 'barrow', label: 'To the barrow', to: 'barrow' },
        ...(river !== 'none' ? [{ id: 'river', label: 'To the river', to: 'river' }] : []),
        { id: 'leave', label: 'Leave', to: 'end' },
      ] },
      barrow: { id: 'barrow', kind: 'story', noBack: true, text: ['Old bones.'], next: [
        // Gated by a flag, not \`once\`: the proofs track flags (a spent once is
        // taken as still open), and the ring is only there to take once.
        { id: 'take', label: 'Take the ring', to: 'square', requires: [{ kind: 'notFlag', flag: 'ring-taken' }],
          effects: [{ kind: 'setFlag', flag: 'has-ring' }, { kind: 'setFlag', flag: 'ring-taken' }] },
        { id: 'back', label: 'Back', to: 'square' },
      ] },
      ...(river !== 'none' ? { river: { id: 'river', kind: 'story', noBack: true, text: ['A fast river.'], next: [
        { id: 'throw', label: 'Throw the ring in', to: 'square', requires: [{ kind: 'flag', flag: 'has-ring' }],
          effects: [{ kind: 'clearFlag', flag: 'has-ring' }, ...(river === 'fail' ? [{ kind: 'setFlag', flag: 'ring-lost' } as const] : [])] },
        { id: 'back', label: 'Back', to: 'square' },
      ] } } : {}),
      end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['Done.'] },
    },
    ...extra,
  } as Module;
}
const ids = (s: ReturnType<typeof startAdventure>, m: Module) => legalChoices(s, m).filter((c) => !c.blocked).map((c) => c.choice.id);

describe('a quest', () => {
  const m = compileQuests(story());

  it('is offered by its giver, before the way out', () => {
    const square = m.scenes.square;
    if (square?.kind !== 'story') throw new Error();
    expect(square.next.map((c) => c.id)).toEqual(['barrow', 'ask-ring', 'report-ring', 'leave']);
  });

  it('is taken, noted with its stages, and reported back for its reward', () => {
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'square');
    expect(ids(s, m)).toContain('ask-ring');
    choose(s, m, 'ask-ring'); choose(s, m, 'accept');
    expect(s.flags[taken('ring')]).toBe(true);
    expect(s.journal.find((j) => j.id === 'quest-ring')).toMatchObject({ kind: 'quest', stages: RING.stages, takenBy: taken('ring') });
    expect(ids(s, m)).not.toContain('ask-ring');
    expect(ids(s, m)).not.toContain('report-ring');      // not yet
    choose(s, m, 'barrow'); choose(s, m, 'take');
    const gold = s.campaign.gold;
    choose(s, m, 'report-ring');
    expect(s.campaign.gold - gold).toBe(50);
    expect(s.flags[done('ring')]).toBe(true);
    expect(s.flags['has-ring']).toBeFalsy();             // handed over
    choose(s, m, 'ok');
    expect(ids(s, m)).not.toContain('report-ring');      // once
  });

  it('counts what was done before anyone asked', () => {
    const s = startAdventure(newCampaign(2), m);
    enterScene(s, m, 'square');
    choose(s, m, 'barrow'); choose(s, m, 'take');      // the ring, unasked
    choose(s, m, 'ask-ring'); choose(s, m, 'accept');
    expect(ids(s, m)).toContain('report-ring');          // straight back with it
  });
});

describe('the proofs', () => {
  it('pass a quest that can always be finished', () => {
    expect(validateLive(story())).toEqual([]);
  });

  it('catch a quest that can be stranded — the ring thrown away for good', () => {
    const errs = validateLive(story({}, 'lose'));
    expect(errs.some((e) => e.includes("the quest 'The Reeve's Ring' is taken but can no longer be finished"))).toBe(true);
  });

  it('let a quest rest that the story chose to lose', () => {
    const lost = { ...RING, failsOn: 'ring-lost' };
    expect(validateLive(story({}, 'fail', lost))).toEqual([]);
    expect(expandModule(story({}, 'fail', lost), { seed: 1, flags: [] }).scenes['quest-ring']).toBeTruthy();
  });

  it('turn away a quest written wrong, saying why', () => {
    const bad = story({}, 'none', { ...RING, giver: { scene: 'nowhere', name: 'x' }, gives: ['parcel'], stages: [] });
    expect(questErrors(bad)).toEqual([
      "quest 'ring': its giver's scene 'nowhere' does not exist",
      "quest 'ring': it has no stages",
      "quest 'ring': it gives 'parcel', which is not one of its objects",
    ]);
  });
});
