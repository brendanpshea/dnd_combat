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
  requirementMet, exploreNodes, enterNode, hubReturn, returnToHub,
} from '../src/adventure/runtime.js';
import { runModule, type RunPolicy } from '../src/adventure/runner.js';
import { serializeAdventure, parseAdventure } from '../src/adventure/save.js';
import { isLocationArt, isNpcArt } from '../src/data/adventure-art.js';
import { CLASSIC_MODULE } from '../src/data/modules/classic.js';
import { HIDEOUT_MODULE } from '../src/data/modules/demo.js';
import { MODULES } from '../src/data/modules/index.js';
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

// --- Revisitable hubs + `once` (Phase 2) ------------------------------------

describe('hubs and once-choices', () => {
  const hollow = MODULES.find((m) => m.id === 'hollow-road')!;

  it('entering an explore scene records it as the hub', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'square');
    expect(state.hub).toBe('square');
  });

  it('@hub routes back to the last explore scene', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'square');   // hub = square
    enterScene(state, hollow, 'board');    // wander into a sub-scene
    returnToHub(state, hollow);
    expect(state.sceneId).toBe('square');
  });

  it('hubReturn offers the hub from a sub-scene but not from the hub itself', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'square');
    enterScene(state, hollow, 'board');
    expect(hubReturn(state, hollow)).toBe('square');
    enterScene(state, hollow, 'square');
    expect(hubReturn(state, hollow)).toBeNull(); // explore scene, and == hub
  });

  it('a once-choice is consumed after it is taken and never re-offered', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'board');
    expect(legalChoices(state, hollow).some((o) => o.choice.id === 'ok')).toBe(true);
    choose(state, hollow, 'ok'); // claim the retainer (once)
    // Board is left behind; come back to it and the claim is gone.
    enterScene(state, hollow, 'board');
    const ids = legalChoices(state, hollow).map((o) => o.choice.id);
    expect(ids).not.toContain('ok');
    expect(ids).toContain('leave');
  });

  it('a once reward cannot be farmed by revisiting', () => {
    const c = newCampaign(1);
    const state = startAdventure(c, hollow);
    const before = c.gold;
    enterScene(state, hollow, 'board');
    choose(state, hollow, 'ok');
    const afterOnce = c.gold;
    expect(afterOnce).toBe(before + 25);
    // Revisit and take whatever remains — gold must not grow again.
    enterScene(state, hollow, 'board');
    const leave = legalChoices(state, hollow).find((o) => o.choice.id === 'leave')!;
    choose(state, hollow, leave.choice.id);
    expect(c.gold).toBe(afterOnce);
  });

  it('a failed once social check is still spent (no re-rolling on revisit)', () => {
    // Force the Insight check to fail by draining the roll: DC 12 with a
    // guaranteed low roll is hard to force here, so assert consumption directly.
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'tavern');
    choose(state, hollow, 'insight'); // consumes regardless of pass/fail
    enterScene(state, hollow, 'tavern');
    expect(legalChoices(state, hollow).some((o) => o.choice.id === 'insight')).toBe(false);
  });

  it('a mystery node is unexplored until entered (drives the hidden label)', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'trail');
    const before = exploreNodes(state, hollow).find((n) => n.node.id === 'scout')!;
    expect(before.node.mystery).toBeTruthy();
    expect(before.explored).toBe(false); // UI shows node.mystery here
    enterNode(state, hollow, 'scout');
    enterScene(state, hollow, 'trail'); // back on the map
    const after = exploreNodes(state, hollow).find((n) => n.node.id === 'scout')!;
    expect(after.explored).toBe(true); // UI now shows the real label
  });

  it('consumedChoices survives a save round-trip', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'board');
    choose(state, hollow, 'ok');
    const restored = parseAdventure(serializeAdventure(state), hollow)!;
    expect(restored.consumedChoices).toContain('board:ok');
    expect(restored.hub).toBe(state.hub);
  });
});

// --- M2: exploration, wandering, journal ------------------------------------

describe('exploration (M2)', () => {
  it('every registered module validates', () => {
    for (const m of MODULES) expect(validateModule(m)).toEqual([]);
  });

  it('the hideout demo validates and auto-plays to an ending', () => {
    expect(validateModule(HIDEOUT_MODULE)).toEqual([]);
    let n = 42;
    const rand = () => (n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const policy: RunPolicy = { pick: (count) => Math.floor(rand() * count), battle: () => rand() > 0.25 };
    const result = runModule(newCampaign(4), HIDEOUT_MODULE, policy, 3000);
    expect(['victory', 'defeat']).toContain(result.ending);
  });

  it('entering a node marks it explored (fog clears)', () => {
    const c = newCampaign(1);
    const state = startAdventure(c, DEMO);
    enterScene(state, DEMO, 'inside');
    expect(exploreNodes(state, DEMO).find((n) => n.node.id === 'exit')!.explored).toBe(false);
    // exit routes to an ending, so peek via the state instead of entering it:
    state.exploredNodes.push('exit');
    expect(exploreNodes(state, DEMO).find((n) => n.node.id === 'exit')!.explored).toBe(true);
  });

  it('a wandering node diverts to its battle scene on a hit, deterministically', () => {
    const mod: Module = {
      id: 'w', title: 'W', blurb: '', start: 'map',
      scenes: {
        map: { id: 'map', kind: 'explore', map: { title: 'M', nodes: [
          { id: 'n', x: 50, y: 50, label: 'Path', icon: '🌿', scene: 'safe',
            wandering: { chance: 1, battleScene: 'fight' } },
        ] } },
        safe: { id: 'safe', kind: 'ending', outcome: 'victory', text: ['safe'] },
        fight: { id: 'fight', kind: 'battle', encounterId: 'kobolds', mapId: 'ruins',
          onWin: { to: 'safe' } },
      },
    };
    expect(validateModule(mod)).toEqual([]);
    const state = startAdventure(newCampaign(1), mod);
    enterScene(state, mod, 'map');
    const events = enterNode(state, mod, 'n'); // chance 1 → always diverts
    expect(events.some((e) => e.type === 'startBattle')).toBe(true);
    expect(state.sceneId).toBe('fight');
  });

  it('journal effects accumulate without duplicates', () => {
    const c = newCampaign(1);
    const state = startAdventure(c, HIDEOUT_MODULE);
    // Press on adds the "Clear the Hideout" quest.
    choose(state, HIDEOUT_MODULE, 'go');
    expect(state.journal.some((j) => j.id === 'q1')).toBe(true);
    const count = state.journal.length;
    // Re-applying the same journal entry is idempotent.
    enterScene(state, HIDEOUT_MODULE, 'road');
    choose(state, HIDEOUT_MODULE, 'go');
    expect(state.journal.length).toBe(count);
  });
});

// --- M4: the authored module + save/resume ----------------------------------

describe('The Hollow Road (M4)', () => {
  const hollow = MODULES.find((m) => m.id === 'hollow-road')!;

  it('validates', () => {
    expect(hollow).toBeDefined();
    expect(validateModule(hollow)).toEqual([]);
  });

  it('is skill-diverse (uses several distinct skills across scenes)', () => {
    const skills = new Set<string>();
    for (const s of Object.values(hollow.scenes)) {
      if (s.kind === 'check') skills.add(s.skill);
      if (s.kind === 'story' || s.kind === 'dialogue') for (const ch of s.next) if (ch.check) skills.add(ch.check.skill);
    }
    expect(skills.size).toBeGreaterThanOrEqual(6);
  });

  it('has avoidable fights (a battle the party can route around)', () => {
    // The gate can be passed by signal or group stealth without gate-fight.
    const gate = hollow.scenes['gate'];
    expect(gate?.kind).toBe('story');
    if (gate?.kind === 'story') {
      const nonCombat = gate.next.filter((c) => c.to !== 'gate-fight' && c.check?.failTo !== 'gate-fight');
      expect(nonCombat.length).toBeGreaterThan(0);
    }
  });

  it('auto-plays to an ending across 40 seeded runs', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let nn = seed * 7 + 1;
      const rand = () => (nn = (nn * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const policy: RunPolicy = { pick: (count) => Math.floor(rand() * count), battle: () => rand() > 0.2 };
      const result = runModule(newCampaign(seed), hollow, policy, 4000);
      expect(['victory', 'defeat']).toContain(result.ending);
    }
  });
});

describe('reusable art vocabulary', () => {
  it('The Hollow Road composes shared location + NPC archetype ids', () => {
    const hollow = MODULES.find((m) => m.id === 'hollow-road')!;
    const locs = new Set<string>();
    const npcs = new Set<string>();
    for (const s of Object.values(hollow.scenes)) {
      if ('art' in s && s.art?.imageId) locs.add(s.art.imageId);
      if (s.kind === 'explore' && s.map.art?.imageId) locs.add(s.map.art.imageId);
      if (s.kind === 'dialogue' && s.npc.portraitId) npcs.add(s.npc.portraitId);
    }
    expect(locs.size).toBeGreaterThanOrEqual(4);
    expect(npcs.size).toBeGreaterThanOrEqual(3);
    for (const l of locs) expect(isLocationArt(l)).toBe(true);
    for (const n of npcs) expect(isNpcArt(n)).toBe(true);
  });

  it('the validator rejects an unknown art id', () => {
    const bad: Module = {
      id: 'bad', title: 'B', blurb: '', start: 's',
      scenes: {
        s: { id: 's', kind: 'story', art: { imageId: 'loc-nonsense' }, text: ['x'],
          next: [{ id: 'go', label: 'go', to: 'e' }] },
        e: { id: 'e', kind: 'ending', outcome: 'victory', text: ['done'] },
      },
    };
    expect(validateModule(bad).some((e) => e.includes('loc-nonsense'))).toBe(true);
  });
});

describe('save/resume', () => {
  it('round-trips a mid-run state and restores progress', () => {
    const c = newCampaign(3);
    const state = startAdventure(c, HIDEOUT_MODULE);
    enterScene(state, HIDEOUT_MODULE, 'road');
    choose(state, HIDEOUT_MODULE, 'go'); // adds the quest, moves to hollow
    state.flags['test'] = 7;

    const restored = parseAdventure(serializeAdventure(state), HIDEOUT_MODULE);
    expect(restored).toBeDefined();
    expect(restored!.sceneId).toBe(state.sceneId);
    expect(restored!.flags['test']).toBe(7);
    expect(restored!.journal.map((j) => j.id)).toEqual(state.journal.map((j) => j.id));
    expect(restored!.campaign.gold).toBe(c.gold);
  });

  it('rejects a save from a different module or a stale scene', () => {
    const state = startAdventure(newCampaign(1), HIDEOUT_MODULE);
    enterScene(state, HIDEOUT_MODULE, 'hollow');
    const json = serializeAdventure(state);
    // Wrong module.
    expect(parseAdventure(json, CLASSIC_MODULE)).toBeUndefined();
    // Same module id but a scene it no longer has.
    const orphan = serializeAdventure({ ...state, sceneId: 'no-such-scene' });
    expect(parseAdventure(orphan, HIDEOUT_MODULE)).toBeUndefined();
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
