import { describe, it, expect } from 'vitest';
import {
  newCampaign, characterSkillCheck, partySkillCheck, groupSkillCheck,
  characterSkillBonus, bestAtSkill, type CampaignState,
} from '../src/campaign/campaign.js';
import { SKILL_ABILITY } from '../src/data/classes.js';
import { BACKGROUNDS } from '../src/data/backgrounds.js';
import { validateModule } from '../src/adventure/validate.js';
import {
  startAdventure, choose, currentScene, enterScene, legalChoices, rollSceneCheck,
  requirementMet, exploreNodes, enterNode,
} from '../src/adventure/runtime.js';
import { runModule, type RunPolicy } from '../src/adventure/runner.js';
import { CLASSIC_MODULE } from '../src/data/modules/classic.js';
import type { Module } from '../src/adventure/types.js';

// --- M0: skills -------------------------------------------------------------

describe('skills (M0)', () => {
  it('SKILL_ABILITY covers the full 18-skill PHB list', () => {
    expect(Object.keys(SKILL_ABILITY)).toHaveLength(18);
    expect(SKILL_ABILITY.athletics).toBe('str');
    expect(SKILL_ABILITY.arcana).toBe('int');
    expect(SKILL_ABILITY.medicine).toBe('wis');
  });

  it('a background grants proficiency on its two skills', () => {
    const c = newCampaign(7);
    // The default sage (wizard) is proficient in arcana + history via background.
    const wizIdx = c.characters.findIndex((ch) => ch.classId === 'wizard');
    c.characters[wizIdx]!.backgroundId = 'sage';
    const withBg = characterSkillBonus(c, wizIdx, 'history');
    c.characters[wizIdx]!.backgroundId = undefined;
    const withoutBg = characterSkillBonus(c, wizIdx, 'history');
    expect(withBg).toBeGreaterThan(withoutBg);
    expect(withBg - withoutBg).toBe(2); // proficiency bonus at level 1
  });

  it('every background grants two real skills', () => {
    for (const bg of Object.values(BACKGROUNDS)) {
      expect(bg.skills).toHaveLength(2);
      for (const s of bg.skills) expect(SKILL_ABILITY[s]).toBeDefined();
    }
  });

  it('characterSkillCheck is deterministic on the campaign rng', () => {
    const a = characterSkillCheck(newCampaign(3), 0, 'athletics', 12);
    const b = characterSkillCheck(newCampaign(3), 0, 'athletics', 12);
    expect(a).toEqual(b);
  });

  it('a group check passes when at least half the party succeeds', () => {
    // DC 1 → everyone passes; DC 30 → nobody.
    expect(groupSkillCheck(newCampaign(1), 'stealth', 1).success).toBe(true);
    expect(groupSkillCheck(newCampaign(1), 'stealth', 30).success).toBe(false);
  });

  it('Guidance is suppressed by noGuidance', () => {
    // The default party has a cleric, so Guidance normally applies.
    const withG = partySkillCheck(newCampaign(5), 'persuasion', 12);
    const withoutG = partySkillCheck(newCampaign(5), 'persuasion', 12, { noGuidance: true });
    expect(withG.guidance).toBeGreaterThan(0);
    expect(withoutG.guidance).toBeUndefined();
  });
});

// --- The classic module -----------------------------------------------------

describe('classic module (M1)', () => {
  it('passes validation', () => {
    expect(validateModule(CLASSIC_MODULE)).toEqual([]);
  });

  it('runs start-to-victory when the party wins every fight', () => {
    const policy: RunPolicy = { pick: () => 0, battle: () => true };
    const result = runModule(newCampaign(1), CLASSIC_MODULE, policy);
    expect(result.ending).toBe('victory');
    // 14 battles happened.
    expect(result.events.filter((e) => e.type === 'startBattle')).toHaveLength(14);
  });

  it('a lost fight retries rather than dead-ending (story mode)', () => {
    let calls = 0;
    const policy: RunPolicy = {
      pick: () => 0,
      battle: () => { calls++; return calls > 3; }, // lose the first 3, then win out
    };
    const result = runModule(newCampaign(1), CLASSIC_MODULE, policy);
    expect(result.ending).toBe('victory');
    expect(calls).toBeGreaterThan(14); // extra attempts from the retries
  });
});

// --- A hand-authored module exercising every scene kind ---------------------

const DEMO: Module = {
  id: 'demo', title: 'Demo', blurb: 'exercises the vocabulary', start: 'intro',
  scenes: {
    intro: {
      id: 'intro', kind: 'story', text: ['A door.'],
      next: [
        { id: 'talk', label: 'Approach openly, flashing a guild sigil', to: 'guard',
          effects: [{ kind: 'setFlag', flag: 'has-sigil' }] },
        { id: 'sneak', label: '[Stealth] Slip past', to: 'inside',
          check: { skill: 'stealth', dc: 1, failTo: 'caught' } },
      ],
    },
    guard: {
      id: 'guard', kind: 'dialogue', npc: { id: 'grix', name: 'Grix' },
      lines: ['"Password?"'],
      next: [
        { id: 'bribe', label: 'Offer 10 gold', to: 'inside',
          effects: [{ kind: 'gold', amount: -10 }, { kind: 'setFlag', flag: 'bribed' }] },
        { id: 'gated', label: 'Show the sigil', to: 'inside',
          requires: [{ kind: 'flag', flag: 'has-sigil' }] },
      ],
    },
    caught: {
      id: 'caught', kind: 'check', skill: 'persuasion', dc: 1,
      intro: ['Caught! Talk your way out.'],
      success: { to: 'inside', text: ['They wave you in.'] },
      failure: { to: 'lose', text: ['Blades come out.'] },
    },
    inside: {
      id: 'inside', kind: 'explore',
      map: {
        art: { emoji: '🏚️' }, title: 'The Hideout',
        nodes: [
          { id: 'exit', x: 50, y: 90, label: 'Leave', icon: '🚪', scene: 'win' },
          { id: 'vault', x: 20, y: 20, label: 'Vault', icon: '💰', scene: 'win',
            hidden: { dc: 1 } },
        ],
      },
    },
    win: { id: 'win', kind: 'ending', outcome: 'victory', text: ['Done.'] },
    lose: { id: 'lose', kind: 'ending', outcome: 'defeat', text: ['Dead.'] },
  },
};

describe('adventure runtime vocabulary', () => {
  it('the demo module validates', () => {
    expect(validateModule(DEMO)).toEqual([]);
  });

  it('effects mutate campaign state and set flags', () => {
    const c = newCampaign(1);
    const goldBefore = c.gold;
    const state = startAdventure(c, DEMO);
    enterScene(state, DEMO, 'guard');
    choose(state, DEMO, 'bribe');
    expect(c.gold).toBe(goldBefore - 10);
    expect(state.flags['bribed']).toBe(true);
    expect(state.sceneId).toBe('inside');
  });

  it('requirements block a choice until its flag is set', () => {
    const c = newCampaign(1);
    const state = startAdventure(c, DEMO);
    enterScene(state, DEMO, 'guard');
    // The sigil choice is blocked (flag unset) and greyed, not offered clean.
    const options = legalChoices(state, DEMO);
    const gated = options.find((o) => o.choice.id === 'gated')!;
    expect(gated.blocked).toBeTruthy();
    expect(() => choose(state, DEMO, 'gated')).toThrow(/blocked/);
    state.flags['has-sigil'] = true;
    expect(requirementMet(state, { kind: 'flag', flag: 'has-sigil' })).toBe(true);
    expect(legalChoices(state, DEMO).find((o) => o.choice.id === 'gated')!.blocked).toBeNull();
  });

  it('an inline skill check routes success vs failure by the roll', () => {
    // DC 1 auto-succeeds → lands inside.
    const c = newCampaign(2);
    const state = startAdventure(c, DEMO);
    const events = choose(state, DEMO, 'sneak');
    expect(events.some((e) => e.type === 'check' && e.success)).toBe(true);
    expect(state.sceneId).toBe('inside');
  });

  it('a secret explore node is revealed when passive Perception meets its DC', () => {
    const c = newCampaign(1);
    const state = startAdventure(c, DEMO);
    enterScene(state, DEMO, 'inside');
    const nodes = exploreNodes(state, DEMO);
    // DC-1 secret is always revealed; both nodes visible.
    expect(nodes.map((n) => n.node.id).sort()).toEqual(['exit', 'vault']);
    const events = enterNode(state, DEMO, 'vault');
    expect(events.some((e) => e.type === 'ending')).toBe(true);
  });
});

// --- Auto-player fuzz --------------------------------------------------------

describe('auto-player', () => {
  it('reaches an ending across 100 seeded random runs with no dead ends', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let n = seed;
      const rand = () => (n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const policy: RunPolicy = {
        pick: (count) => Math.floor(rand() * count),
        battle: () => rand() > 0.3, // sometimes lose → exercises retries
      };
      const result = runModule(newCampaign(seed), DEMO, policy, 2000);
      expect(['victory', 'defeat']).toContain(result.ending);
    }
  });
});
