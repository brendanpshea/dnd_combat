/**
 * Two engine rules that let a story stop writing twins: a fight that picks
 * its enemies by how things stand, and an ending told one thread at a time,
 * first case that holds.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, choose, battleEncounter, endingText } from '../src/adventure/runtime.js';
import { validateModule } from '../src/adventure/validate.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module, Scene } from '../src/adventure/types.js';

const hall = (): Module => ({
  id: 'hall', title: 'T', blurb: 'b', start: 'door',
  scenes: {
    door: { id: 'door', kind: 'story', text: ['A hall.'], next: [
      { id: 'turn', label: 'Turn the guard', to: 'door', requires: [{ kind: 'notFlag', flag: 'turned' }], effects: [{ kind: 'setFlag', flag: 'turned' }] },
      { id: 'in', label: 'Go in', to: 'boss' },
    ] },
    boss: { id: 'boss', kind: 'battle', encounterId: 'raiders-forward', mapId: 'firepit',
      encounterWhen: [{ if: [{ kind: 'flag', flag: 'turned' }], encounterId: 'cockatrice-flock' }],
      intro: [{ if: [{ kind: 'flag', flag: 'turned' }], text: 'The guard steps aside.' }, 'The chief rises.'],
      onWin: { to: 'end' } },
    end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['Done.'], slides: [
      { thread: 'guard', cases: [
        { if: [{ kind: 'flag', flag: 'turned' }], text: 'The guard walks free.' },
        { text: 'The guard dies at his post.' },
      ] },
      { if: [], text: 'The hall burns.' },
    ] },
  },
});

describe('a fight', () => {
  it('picks its enemies by how things stand', () => {
    const m = hall();
    const boss = m.scenes.boss as Extract<Scene, { kind: 'battle' }>;
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 'door');
    expect(battleEncounter(s, boss)).toBe('raiders-forward');
    choose(s, m, 'turn');
    expect(battleEncounter(s, boss)).toBe('cockatrice-flock');
    const events = enterScene(s, m, 'boss');
    expect(events.find((e) => e.type === 'startBattle')).toMatchObject({ encounterId: 'cockatrice-flock' });
  });

  it('has every variant proved to exist', () => {
    const m = hall();
    (m.scenes.boss as Extract<Scene, { kind: 'battle' }>).encounterWhen![0]!.encounterId = 'no-such-fight';
    expect(validateModule(m)).toContain("[boss] unknown encounter 'no-such-fight'");
  });
});

describe('an outcome card', () => {
  const end = hall().scenes.end as Extract<Scene, { kind: 'ending' }>;

  it('tells one line of its thread: the first case that holds', () => {
    const m = hall();
    const s = startAdventure(newCampaign(1), m);
    expect(endingText(s, end)).toEqual(['Done.', 'The guard dies at his post.', 'The hall burns.']);
    s.flags.turned = true;
    expect(endingText(s, end)).toEqual(['Done.', 'The guard walks free.', 'The hall burns.']);
  });

  it('passes the proofs, and is turned away with a case it could never reach', () => {
    expect(validateModule(hall())).toEqual([]);
    const m = hall();
    const card = (m.scenes.end as Extract<Scene, { kind: 'ending' }>).slides![0] as { cases: Array<{ if?: unknown; text: string }> };
    card.cases.reverse();
    expect(validateModule(m)).toContain("[end] the 'guard' card's case 2 can never show: case 1 always holds");
  });
});
