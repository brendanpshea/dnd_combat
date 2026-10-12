/**
 * NPCs on the stage: wherever they are, there to talk to; nowhere they are
 * not; never after they are gone; and the fight, once they have turned.
 */
import { describe, it, expect } from 'vitest';
import { withCanon } from '../src/adventure/npcs.js';
import { validateModule } from '../src/adventure/validate.js';
import { startAdventure, enterScene, choose, legalChoices, exploreNodes } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Module, NpcDef } from '../src/adventure/types.js';

const NPCS: Record<string, NpcDef> = { wren: { id: 'wren', name: 'Wren', emoji: '🏹', fates: ['dead', 'angry'] } };

/** A square (a map), a well and a jail; Wren at home in the square. */
function chapter(over: Partial<Module> = {}): Module {
  return withCanon({ ...chapterSource(), ...over } as Module, { npcs: NPCS });
}
function chapterSource(): Module {
  return ({
    id: 'stage-test', title: 'T', blurb: 'b', start: 'square',
    scenes: {
      square: { id: 'square', kind: 'explore', map: { title: 'Square', art: { emoji: '⛲' }, entry: ['well'], nodes: [
        { id: 'well', label: 'Well', icon: 'tok-well', scene: 'well', x: 30, y: 30 },
        { id: 'jail', label: 'Jail', icon: 'tok-house', scene: 'jail', x: 60, y: 60 },
        { id: 'road', label: 'Road', icon: 'tok-gate', scene: 'end', x: 80, y: 80 },
      ] } },
      well: { id: 'well', kind: 'story', noBack: true, text: ['An old well.'], next: [
        { id: 'send', label: 'Send for {wren}', to: 'square', effects: [{ kind: 'npc', npc: 'wren', at: 'well' }] },
        { id: 'insult', label: 'Insult her', to: 'square', effects: [{ kind: 'npc', npc: 'wren', fate: 'angry' }] },
        { id: 'kill', label: 'Leave her to the wolves', to: 'square', effects: [{ kind: 'npc', npc: 'wren', fate: 'dead' }] },
        { id: 'lock', label: 'Have her locked up', to: 'square', effects: [{ kind: 'npc', npc: 'wren', at: 'jail' }] },
        { id: 'leave', label: 'Back', to: 'square' },
      ] },
      jail: { id: 'jail', kind: 'story', noBack: true, text: ['Cells.'], next: [{ id: 'leave', label: 'Back', to: 'square' }] },
      fight: { id: 'fight', kind: 'battle', encounterId: 'raiders-forward', mapId: 'open', onWin: { to: 'square' } },
      end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['Done.'] },
    },
    stage: { wren: {
      places: [{ scene: 'square', x: 50, y: 20 }, { scene: 'well' }, { scene: 'jail' }],
      gone: ['dead'],
      greet: [
        { text: '"You again." She does not look up.', if: [{ kind: 'flag', flag: 'told-wren-key' }] },
        { text: '{wren} nods. "Scout\'s business. Make it quick."' },
      ],
      topics: [
        { id: 'key', label: 'Ask about the key', lines: ['"The reeve has it. Ask him nicely."'] },
        { id: 'road', label: 'Ask about the road', lines: ['"Wolves."'], repeat: true },
      ],
      hostile: { when: { kind: 'npc', npc: 'wren', fate: 'angry' }, to: 'fight', label: 'Face {wren}' },
    } },
  } as Module);
}
const m = chapter();
const play = () => { const s = startAdventure(newCampaign(1), m); enterScene(s, m, 'square'); return s; };
const nodes = (s: ReturnType<typeof play>) => exploreNodes(s, m).map((n) => n.node.id);
const choices = (s: ReturnType<typeof play>) => legalChoices(s, m).filter((c) => !c.blocked).map((c) => c.choice.id);

describe('an NPC on the stage', () => {
  it('passes the proofs', () => {
    expect(validateModule(m)).toEqual([]);
  });

  it('is caught by the proofs at a place nothing ever sends them', () => {
    const m2 = withCanon({ ...chapterSource(), scenes: { ...chapterSource().scenes,
      well: { ...(chapterSource().scenes.well as Extract<Module['scenes'][string], { kind: 'story' }>), next: (chapterSource().scenes.well as Extract<Module['scenes'][string], { kind: 'story' }>).next.filter((c) => c.id !== 'lock') } } }, { npcs: NPCS });
    expect(validateModule(m2).some((e) => e.startsWith('[talk-wren@jail] can never be reached'))).toBe(true);
  });

  it('is there to talk to at home, and nowhere else', () => {
    const s = play();
    expect(nodes(s)).toContain('npc-wren');
    enterScene(s, m, 'well');
    expect(choices(s)).not.toContain('talk-wren');
  });

  it('goes where the story sends them, and is found there', () => {
    const s = play();
    enterScene(s, m, 'well'); choose(s, m, 'send');
    expect(nodes(s)).not.toContain('npc-wren');
    enterScene(s, m, 'well');
    expect(choices(s)).toContain('talk-wren');
    choose(s, m, 'talk-wren');
    expect(s.sceneId).toBe('talk-wren@well');
  });

  it('talks of each thing once (unless it bears repeating), and greets by how things stand', () => {
    const s = play();
    enterScene(s, m, 'talk-wren@square');
    expect(choices(s)).toEqual(['topic-key', 'topic-road', 'leave']);
    choose(s, m, 'topic-key'); choose(s, m, 'ok');
    expect(choices(s)).toEqual(['topic-road', 'leave']);
    const greet = m.scenes['talk-wren@square'];
    expect(greet?.kind === 'dialogue' && greet.lines.length).toBe(2);
    choose(s, m, 'leave');
    expect(s.sceneId).toBe('square');                    // back where they were
  });

  it('is never there once gone', () => {
    const s = play();
    enterScene(s, m, 'well'); choose(s, m, 'send');
    enterScene(s, m, 'well'); choose(s, m, 'kill');
    enterScene(s, m, 'well');
    expect(choices(s)).not.toContain('talk-wren');
    expect(choices(s)).not.toContain('confront-wren');
  });

  it('is the fight, once turned', () => {
    const s = play();
    enterScene(s, m, 'well'); choose(s, m, 'insult');
    const node = (m.scenes.square as { map: { nodes: Array<{ id: string; sceneWhen?: unknown }> } }).map.nodes.find((n) => n.id === 'npc-wren');
    expect(node?.sceneWhen).toBeTruthy();
    enterScene(s, m, 'well'); choose(s, m, 'send');
    enterScene(s, m, 'well');
    expect(choices(s)).toContain('confront-wren');
    expect(choices(s)).not.toContain('talk-wren');
  });

  it('turns away a stage written wrong, saying why', () => {
    expect(() => chapter({ stage: { wren: { places: [{ scene: 'square' }], greet: [{ text: 'x' }], topics: [] } } })).toThrow(/needs x and y/);
    expect(() => chapter({ stage: { wren: { places: [{ scene: 'well' }], greet: [{ text: 'x', if: [] }], topics: [] } } })).toThrow(/last greeting must have no `if`/);
  });
});

import { companionsFrom, npcAttitudeFlag, reputationFlag } from '../src/adventure/npcs.js';

describe('a company\'s name', () => {
  const CAST: Record<string, NpcDef> = {
    wren: { id: 'wren', name: 'Wren', monsterId: 'scout', blurb: 'A scout.', values: { empathy: 1 } },
    vex: { id: 'vex', name: 'Vex', values: { empathy: -1, law: -1 } },
  };
  const m = withCanon({
    id: 'rep-test', title: 'T', blurb: 'b', start: 'yard', companions: companionsFrom(CAST, ['wren']),
    scenes: {
      yard: { id: 'yard', kind: 'story', noBack: true, text: ['A yard, and a prisoner.'], next: [
        { id: 'spare', label: 'Spare him', to: 'yard', effects: [{ kind: 'deed', empathy: 1 }] },
        { id: 'hang', label: 'Hang him', to: 'yard', effects: [{ kind: 'deed', empathy: -2, law: -1 }] },
        { id: 'help', label: 'Help {wren} with her horse', to: 'yard', effects: [{ kind: 'npc', npc: 'wren', attitude: 3, hearsay: true }] },
        { id: 'end', label: 'Go', to: 'end' },
      ] },
      end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['Done.'] },
    },
    stage: { wren: {
      places: [{ scene: 'yard' }],
      greet: [
        { text: '"I saw what you did to him." She will not meet your eye.', if: [{ kind: 'reputation', empathy: { below: 0 } }] },
        { text: '"Scout\'s business."' },
      ],
      topics: [],
      join: { companion: 'wren', when: [{ kind: 'npc', npc: 'wren', attitude: { atLeast: 1 } }, { kind: 'reputation', empathy: { atLeast: 0 } }],
        yes: ['"Aye. I\'ll come."'], refuse: [['"I don\'t know you well enough."'], ['"Not with the likes of you. Not after the yard."']] },
    } },
  } as Module, { npcs: CAST });
  const play = () => { const s = startAdventure(newCampaign(2), m); enterScene(s, m, 'yard'); return s; };
  const ids = (s: ReturnType<typeof play>) => legalChoices(s, m).filter((c) => !c.blocked).map((c) => c.choice.id);

  it('passes the proofs', () => {
    expect(validateModule(m)).toEqual([]);
  });

  it('is made by deeds, and moves everyone who cares, each their own way — once they know you', () => {
    const s = play();
    choose(s, m, 'hang');
    expect(s.flags[npcAttitudeFlag('wren')]).toBeUndefined();   // strangers: nobody to think worse of
    s.flags['npc.wren.met'] = true; s.flags['npc.vex.met'] = true;
    s.flags[reputationFlag('empathy')] = 0; s.flags[reputationFlag('law')] = 0;
    choose(s, m, 'hang');
    expect(s.flags[reputationFlag('empathy')]).toBe(-2);
    expect(s.flags[reputationFlag('law')]).toBe(-1);
    expect(s.flags[npcAttitudeFlag('wren')]).toBe(-2);   // she minds
    expect(s.flags[npcAttitudeFlag('vex')]).toBe(3);     // he approves, twice over
  });

  it('is remarked on', () => {
    const s = play();
    choose(s, m, 'hang');
    choose(s, m, 'talk-wren');
    const said = JSON.stringify(m.scenes['talk-wren@yard']);
    expect(said).toContain('I saw what you did to him');
    expect(ids(s)).toContain('topic-join-no-0');         // she does not know you yet
  });

  it('decides who will travel with you, and says why not', () => {
    const kind = play();
    choose(kind, m, 'talk-wren'); choose(kind, m, 'leave');   // met
    choose(kind, m, 'spare');
    choose(kind, m, 'talk-wren');
    expect(ids(kind)).toEqual(['topic-join', 'leave']);
    choose(kind, m, 'topic-join');
    expect(kind.companions?.map((c) => c.id)).toEqual(['wren']);
    choose(kind, m, 'ok');
    expect(ids(kind)).not.toContain('talk-wren');        // she is with you now

    const cruel = play();
    choose(cruel, m, 'talk-wren'); choose(cruel, m, 'leave');
    choose(cruel, m, 'help'); choose(cruel, m, 'hang');   // liked (3 − 2), but not with that name (−2)
    choose(cruel, m, 'talk-wren');
    expect(ids(cruel)).toEqual(['topic-join-no-1', 'leave']);
  });
});
