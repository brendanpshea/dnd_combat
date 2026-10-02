/**
 * A won fight pays once: however a party finds its way back into a fight it
 * has won, winning it again tells the story again but pays nothing.
 */
import { describe, it, expect } from 'vitest';
import { startAdventure, enterScene, resolveBattle, battleWonBefore } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import type { Module } from '../src/adventure/types.js';

const ENC = Object.keys(ENCOUNTERS)[0]!;
const mod: Module = { id: 'wo', title: 'W', blurb: '', start: 'fight', scenes: {
  fight: { id: 'fight', kind: 'battle', encounterId: ENC, mapId: 'open', intro: ['They come.'],
    onWin: { to: 'after', text: ['Won.'], effects: [{ kind: 'gold', amount: 200 }, { kind: 'setFlag', flag: 'beat-them' }, { kind: 'xp', amount: 50 }] } },
  after: { id: 'after', kind: 'story', text: ['After.'], next: [{ id: 'again', label: 'Go back', to: 'fight' }, { id: 'on', label: 'On', to: 'won' }] },
  won: { id: 'won', kind: 'ending', outcome: 'victory', text: ['Done.'] },
} };

describe('a won fight', () => {
  it('pays once, and keeps its story effects', () => {
    const s = startAdventure(newCampaign(1), mod);
    enterScene(s, mod, 'fight');
    const gold = s.campaign.gold, xp = s.campaign.xp;
    expect(battleWonBefore(s, 'fight')).toBe(false);
    resolveBattle(s, mod, true);
    expect(s.campaign.gold).toBe(gold + 200);
    expect(s.campaign.xp).toBe(xp + 50);
    expect(battleWonBefore(s, 'fight')).toBe(true);
    enterScene(s, mod, 'fight');
    s.flags['beat-them'] = false;
    const ev = resolveBattle(s, mod, true);
    expect(s.campaign.gold).toBe(gold + 200);
    expect(s.campaign.xp).toBe(xp + 50);
    expect(s.flags['beat-them']).toBe(true);
    expect(ev.find((e) => e.type === 'text')).toMatchObject({ paragraphs: ['Won.'] });
  });
});
