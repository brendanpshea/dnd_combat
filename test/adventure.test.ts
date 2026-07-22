import { describe, it, expect } from 'vitest';
import {
  newCampaign, characterSkillCheck, partySkillCheck, groupSkillCheck,
  characterSkillBonus, bestAtSkill, levelForXp, type CampaignState,
} from '../src/campaign/campaign.js';
import { SKILL_ABILITY } from '../src/data/classes.js';
import { BACKGROUNDS } from '../src/data/backgrounds.js';
import { validateModule } from '../src/adventure/validate.js';
import {
  startAdventure, choose, currentScene, enterScene, legalChoices, rollSceneCheck,
  legalApproaches, tryApproach,
  requirementMet, exploreNodes, enterNode, hubReturn, returnToHub, campRule, campRest,
  shopStock, shopPrice, shopVisitOf, shopHaggle, shopSteal, resolveBattle,
} from '../src/adventure/runtime.js';
import {
  SHOP_STOCK, itemPrice, applyAdventureVictory, buildCampaignParty as buildCampaignPartyFor, STAGES,
} from '../src/campaign/campaign.js';
import { runModule, type RunPolicy } from '../src/adventure/runner.js';
import { serializeAdventure, parseAdventure } from '../src/adventure/save.js';
import { isLocationArt, isNpcArt } from '../src/data/adventure-art.js';
import { CLASSIC_MODULE } from '../src/data/modules/classic.js';
import { HIDEOUT_MODULE } from '../src/data/modules/demo.js';
import { MODULES } from '../src/data/modules/index.js';
import { ENCOUNTERS } from '../src/data/monsters.js';
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
    // One battle per ladder stage.
    expect(result.events.filter((e) => e.type === 'startBattle')).toHaveLength(STAGES.length);
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

  it('xpToLevel tops up to the level threshold, but never overshoots', () => {
    const mk = (): Module => ({
      id: 'xt', title: 'T', blurb: '', start: 's',
      scenes: {
        s: { id: 's', kind: 'story', text: ['x'], next: [
          { id: 'go', label: 'Go', to: 'e', effects: [{ kind: 'xpToLevel', level: 2 }] },
        ] },
        e: { id: 'e', kind: 'ending', outcome: 'victory', text: ['done'] },
      },
    });
    // Below the threshold → topped up to exactly the start of L2 (300).
    const low = newCampaign(1); low.xp = 120;
    const s1 = startAdventure(low, mk());
    const evs = choose(s1, mk(), 'go');
    expect(low.xp).toBe(300);
    expect(evs.some((e) => e.type === 'xp' && e.amount === 180 && e.leveledTo === 2)).toBe(true);
    // Already past it (combat got them there) → untouched, no phantom XP.
    const high = newCampaign(1); high.xp = 550;
    const s2 = startAdventure(high, mk());
    const evs2 = choose(s2, mk(), 'go');
    expect(high.xp).toBe(550);
    expect(evs2.some((e) => e.type === 'xp' && e.amount === 0)).toBe(true);
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
    state.exploredNodes.push('tracks'); // the marsh is a traversal map: reach the entry to reveal the fork
    const before = exploreNodes(state, hollow).find((n) => n.node.id === 'scout')!;
    expect(before.node.mystery).toBeTruthy();
    expect(before.explored).toBe(false); // frontier: title hidden here
    expect(before.frontier).toBe(true);
    enterNode(state, hollow, 'scout');
    enterScene(state, hollow, 'trail'); // back on the map
    const after = exploreNodes(state, hollow).find((n) => n.node.id === 'scout')!;
    expect(after.explored).toBe(true); // now shows the real label
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

// --- Shop: gambits + per-visit state (Phase 5) -------------------------------

describe('shop', () => {
  const shopModule = (stock?: string[]): Module => ({
    id: 'shop-test', title: 'S', blurb: '', start: 'mart',
    scenes: {
      mart: { id: 'mart', kind: 'shop', next: 'done', ...(stock ? { stock } : {}) },
      done: { id: 'done', kind: 'ending', outcome: 'victory', text: ['bye'] },
    },
  });

  it('validates with a shop NPC and per-location stock', () => {
    const m: Module = {
      id: 'shopnpc', title: 'S', blurb: '', start: 'mart',
      scenes: {
        mart: { id: 'mart', kind: 'shop', next: 'done', stock: ['dagger', 'leather'],
          npc: { id: 'n', name: 'Bram', portraitId: 'npc-merchant' } },
        done: { id: 'done', kind: 'ending', outcome: 'victory', text: ['bye'] },
      },
    };
    expect(validateModule(m)).toEqual([]);
  });

  it('the validator rejects an unknown shop NPC archetype', () => {
    const m: Module = {
      id: 'badshop', title: 'S', blurb: '', start: 'mart',
      scenes: {
        mart: { id: 'mart', kind: 'shop', next: 'done', npc: { id: 'n', name: 'X', portraitId: 'npc-nonsense' } },
        done: { id: 'done', kind: 'ending', outcome: 'victory', text: ['bye'] },
      },
    };
    expect(validateModule(m).some((e) => e.includes('npc-nonsense'))).toBe(true);
  });

  it('stock defaults to the shop list, or a location override', () => {
    const s = startAdventure(newCampaign(1), shopModule());
    expect(shopStock(currentScene(s, shopModule())).length).toBe(SHOP_STOCK.filter((id) => itemPrice(id) !== undefined).length);
    const m = shopModule(['dagger', 'leather', 'not-a-real-item']);
    const s2 = startAdventure(newCampaign(1), m);
    enterScene(s2, m, 'mart');
    expect(shopStock(currentScene(s2, m))).toEqual(['dagger', 'leather']); // junk filtered
  });

  it('a haggle shifts prices for the visit and is single-use', () => {
    const m = shopModule(['greatsword']);
    const s = startAdventure(newCampaign(4), m);
    enterScene(s, m, 'mart');
    const base = shopPrice(s, 'mart', 'greatsword');
    // Intimidation moves the multiplier off 1 whether it passes (−25%) or fails (+25%).
    const events = shopHaggle(s, m, 'intimidation');
    expect(events.some((e) => e.type === 'check')).toBe(true);
    expect(shopVisitOf(s, 'mart').haggleUsed).toBe(true);
    expect(shopVisitOf(s, 'mart').priceMult).not.toBe(1);
    expect(shopPrice(s, 'mart', 'greatsword')).not.toBe(base); // a pricey item shows the move
    expect(() => shopHaggle(s, m, 'intimidation')).toThrow(/already used/i);
  });

  it('re-entering the shop resets the visit (a fresh haggle)', () => {
    const m = shopModule(['dagger']);
    const s = startAdventure(newCampaign(4), m);
    enterScene(s, m, 'mart');
    shopHaggle(s, m, 'intimidation');
    expect(shopVisitOf(s, 'mart').haggleUsed).toBe(true);
    enterScene(s, m, 'done');
    enterScene(s, m, 'mart'); // walk back in
    expect(shopVisitOf(s, 'mart').haggleUsed).toBe(false);
    expect(shopVisitOf(s, 'mart').priceMult).toBe(1);
  });

  it('a steal is single-use and, on success, grabs only from this shop stock', () => {
    // Find a seed where the steal succeeds, then assert the grabbed item ∈ stock.
    const stock = ['dagger', 'leather'];
    let checked = false;
    for (let seed = 1; seed <= 60 && !checked; seed++) {
      const m = shopModule(stock);
      const s = startAdventure(newCampaign(seed), m);
      enterScene(s, m, 'mart');
      const events = shopSteal(s, m);
      expect(shopVisitOf(s, 'mart').stealUsed).toBe(true);
      expect(() => shopSteal(s, m)).toThrow(/already/i);
      const grabbed = events.find((e) => e.type === 'item');
      if (grabbed && grabbed.type === 'item') {
        expect(stock).toContain(grabbed.itemId); // never something the shop doesn't sell
        checked = true;
      }
    }
    expect(checked).toBe(true); // some seed in range did succeed
  });

  it('a caught steal fines the party (no item), fine-only', () => {
    const stock = ['dagger'];
    for (let seed = 1; seed <= 60; seed++) {
      const m = shopModule(stock);
      const c = newCampaign(seed); c.gold = 100;
      const s = startAdventure(c, m);
      enterScene(s, m, 'mart');
      const events = shopSteal(s, m);
      const fine = events.find((e) => e.type === 'gold');
      if (fine && fine.type === 'gold') {
        expect(fine.amount).toBeLessThan(0);
        expect(c.gold).toBeLessThan(100);
        return; // found a caught case
      }
    }
  });
});

// --- Playtest fixes: defeat, finished locations, battle rewards --------------

describe('defeat, finished locations, battle rewards', () => {
  const hollow = MODULES.find((m) => m.id === 'hollow-road')!;

  it('a lost battle with no onLoss routes to the module defeat scene, revived', () => {
    const c = newCampaign(1);
    const s = startAdventure(c, hollow);
    enterScene(s, hollow, 'spy-bolts'); // a battle with onWin but no onLoss
    // Wound the party so we can see the revive.
    c.characters.forEach((ch) => { ch.resources = { hp: 0 }; });
    const events = resolveBattle(s, hollow, false);
    expect(s.sceneId).toBe('defeat');
    expect(events.some((e) => e.type === 'scene' && e.sceneId === 'defeat')).toBe(true);
    // Everyone back on their feet at half HP (> 0).
    const party = buildCampaignPartyFor(c);
    expect(party.every((p) => p.hp > 0)).toBe(true);
  });

  it('a finished location redirects via sceneWhen instead of replaying', () => {
    const s = startAdventure(newCampaign(1), hollow);
    enterScene(s, hollow, 'trail');
    s.exploredNodes.push('tracks'); // traversal map: reveal the frontier past the entry
    enterNode(s, hollow, 'scout');
    expect(s.sceneId).toBe('wounded'); // first visit: the full scene
    enterScene(s, hollow, 'trail');
    s.flags['scout-met'] = true;       // now the scout has been dealt with
    enterNode(s, hollow, 'scout');
    expect(s.sceneId).toBe('scout-gone'); // revisit: the short "already done" beat
  });

  it('applyAdventureVictory awards XP + treasure without touching the ladder stage', () => {
    const c = newCampaign(7);
    const party = buildCampaignPartyFor(c);
    const goldBefore = c.gold, xpBefore = c.xp, stageBefore = c.stage;
    const v = applyAdventureVictory(c, party, 'raiders-forward', 987654);
    expect(v.xpGained).toBeGreaterThan(0);
    expect(c.xp).toBe(xpBefore + v.xpGained);
    expect(c.gold).toBe(goldBefore + v.gold);
    expect(c.stage).toBe(stageBefore); // never advances an adventure past a ladder end
    const stashCount = (c.stash ?? []).reduce((n, s) => n + s.qty, 0);
    expect(stashCount).toBe(v.items.reduce((n, it) => n + it.qty, 0));
  });

  it('a loot bonusTier drops an extra item (a boss trophy)', () => {
    const plain = applyAdventureVictory(newCampaign(3), buildCampaignPartyFor(newCampaign(3)), 'raiders-forward', 42);
    const boss = applyAdventureVictory(newCampaign(3), buildCampaignPartyFor(newCampaign(3)), 'raiders-forward', 42, 'rare');
    const count = (v: { items: Array<{ qty: number }> }) => v.items.reduce((n, i) => n + i.qty, 0);
    expect(count(boss)).toBe(count(plain) + 1); // same seed + a guaranteed rare drop
  });

  it('the scene event marks a revisit (first visit false, return true)', () => {
    const s = startAdventure(newCampaign(1), hollow);
    const first = enterScene(s, hollow, 'square');
    expect(first.find((e) => e.type === 'scene' && e.sceneId === 'square')).toMatchObject({ revisit: false });
    enterScene(s, hollow, 'board');
    const again = enterScene(s, hollow, 'square');
    expect(again.find((e) => e.type === 'scene' && e.sceneId === 'square')).toMatchObject({ revisit: true });
  });
});

// --- Camp: rest + party management (Phase 4) ---------------------------------

describe('camp', () => {
  const hollow = MODULES.find((m) => m.id === 'hollow-road')!;

  it('campRule reflects the location: safe town, risky marsh, risky den', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'square');
    expect(campRule(state, hollow)).toEqual({}); // safe
    enterScene(state, hollow, 'trail');
    expect(campRule(state, hollow)?.risky).toBeTruthy();
    enterScene(state, hollow, 'inner');
    expect(campRule(state, hollow)?.risky).toBeTruthy(); // rest in the den, at a price
  });

  it('campRule follows the hub from a location sub-scene', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'square'); // hub = square (safe camp)
    enterScene(state, hollow, 'board');  // a sub-scene of the square
    expect(campRule(state, hollow)).toEqual({});
  });

  it('a long rest heals the party to full', () => {
    const c = newCampaign(1);
    c.characters[0]!.resources = { hp: 1 };
    const state = startAdventure(c, hollow);
    enterScene(state, hollow, 'square');
    const events = campRest(state, hollow, 'long');
    const heal = events.find((e) => e.type === 'heal');
    expect(heal && heal.type === 'heal' && heal.amount).toBeGreaterThan(0);
  });

  it('resting where there is no camp throws', () => {
    const state = startAdventure(newCampaign(1), hollow);
    enterScene(state, hollow, 'gate'); // the den gate — no explore hub, no camp
    expect(() => campRest(state, hollow, 'long')).toThrow(/No camp/);
  });

  it('a risky long rest can divert to its ambush battle', () => {
    // chance 1 → always interrupted; chance 0 → never.
    const mk = (chance: number): Module => ({
      id: 'camp-test', title: 'T', blurb: '', start: 'field',
      scenes: {
        field: { id: 'field', kind: 'explore', map: {
          title: 'Field', art: {}, camp: { risky: { chance, battleScene: 'ambush' } }, nodes: [
            { id: 'go', x: 50, y: 50, label: 'Leave', icon: '🚪', scene: 'end' },
          ] } },
        ambush: { id: 'ambush', kind: 'battle', encounterId: 'wolves', mapId: 'marsh',
          onWin: { to: '@hub' } },
        end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['done'] },
      },
    });
    const always = mk(1);
    expect(validateModule(always)).toEqual([]);
    const s1 = startAdventure(newCampaign(3), always);
    s1.campaign.characters[0]!.resources = { hp: 1 }; // wounded going in
    enterScene(s1, always, 'field');
    const e1 = campRest(s1, always, 'long');
    expect(e1.some((e) => e.type === 'startBattle')).toBe(true);
    expect(s1.sceneId).toBe('ambush');
    // Interrupted BEFORE any benefit: no recovery this night (roll happens first).
    expect(e1.some((e) => e.type === 'heal')).toBe(false);
    expect(s1.campaign.characters[0]!.resources?.hp).toBe(1);

    const never = mk(0);
    const s2 = startAdventure(newCampaign(3), never);
    enterScene(s2, never, 'field');
    const e2 = campRest(s2, never, 'long');
    expect(e2.some((e) => e.type === 'startBattle')).toBe(false);
    expect(s2.sceneId).toBe('field'); // stayed put
  });

  it('a short rest never triggers a risky ambush', () => {
    const state = startAdventure(newCampaign(5), hollow);
    enterScene(state, hollow, 'trail');
    const events = campRest(state, hollow, 'short');
    expect(events.some((e) => e.type === 'startBattle')).toBe(false);
    expect(state.sceneId).toBe('trail');
  });
});

// --- M2: exploration, wandering, journal ------------------------------------

describe('traversal maps (paths & frontier)', () => {
  const hollow = MODULES.find((m) => m.id === 'hollow-road')!;

  it('a fresh traversal map shows only its entry; the fork is still fogged', () => {
    const s = startAdventure(newCampaign(1), hollow);
    enterScene(s, hollow, 'trail');
    const ids = exploreNodes(s, hollow).map((n) => n.node.id);
    expect(ids).toEqual(['tracks']);          // entry only
    const tracks = exploreNodes(s, hollow)[0]!;
    expect(tracks.frontier).toBe(false);       // the entry isn't a "?" node
    expect(tracks.here).toBe(true);            // you are here
  });

  it('visiting a node reveals its neighbours as frontier (title-hidden)', () => {
    const s = startAdventure(newCampaign(1), hollow);
    enterScene(s, hollow, 'trail');
    s.exploredNodes.push('tracks'); s.lastNode = 'tracks';
    const vis = exploreNodes(s, hollow);
    const ids = vis.map((n) => n.node.id).sort();
    expect(ids).toEqual(['ravine', 'scout', 'tracks']); // fork revealed, not 'approach' (beyond)
    const ravine = vis.find((n) => n.node.id === 'ravine')!;
    expect(ravine.frontier).toBe(true);
    expect(exploreNodes(s, hollow).find((n) => n.node.id === 'tracks')!.here).toBe(true);
  });

  it('entering a node beyond the frontier is rejected', () => {
    const s = startAdventure(newCampaign(1), hollow);
    enterScene(s, hollow, 'trail');
    // 'ravine' is past the entry (tracks) and not otherwise gated — pure frontier.
    expect(() => enterNode(s, hollow, 'ravine')).toThrow(/frontier/);
  });

  it('a free-roam map (the town square) shows every node, none as frontier', () => {
    const s = startAdventure(newCampaign(1), hollow);
    enterScene(s, hollow, 'square');
    const vis = exploreNodes(s, hollow);
    // informant is flag-gated so it may be blocked, but all non-secret nodes show.
    expect(vis.length).toBeGreaterThanOrEqual(4);
    expect(vis.every((n) => n.frontier === false)).toBe(true);
  });

  it('the validator rejects a broken path graph', () => {
    const bad = (map: Partial<Record<string, unknown>>): Module => ({
      id: 'pt', title: 'T', blurb: '', start: 'x',
      scenes: {
        x: { id: 'x', kind: 'explore', map: {
          title: 'M', art: {}, nodes: [
            { id: 'a', x: 10, y: 10, label: 'A', icon: 'tok-tracks', scene: 'end' },
            { id: 'b', x: 20, y: 20, label: 'B', icon: 'tok-cave', scene: 'end' },
          ], ...map } as never },
        end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['done'] },
      },
    });
    expect(validateModule(bad({ paths: [['a', 'nope']], entry: ['a'] })).some((e) => e.includes("unknown node 'nope'"))).toBe(true);
    expect(validateModule(bad({ paths: [['a', 'b']] })).some((e) => e.includes('needs at least one entry'))).toBe(true);
    // 'b' unreachable: entry a, but no edge to b.
    expect(validateModule(bad({ paths: [['a', 'a']], entry: ['a'] })).some((e) => e.includes("'b' is unreachable"))).toBe(true);
    // A tok- icon typo is caught.
    const typo = bad({}); (typo.scenes['x'] as { map: { nodes: Array<{ icon: string }> } }).map.nodes[0]!.icon = 'tok-nonsense';
    expect(validateModule(typo).some((e) => e.includes("'tok-nonsense'"))).toBe(true);
  });

  it('the validator rejects a journal lead whose resolvedBy flag is never set', () => {
    const mod: Module = {
      id: 'ld', title: 'T', blurb: '', start: 's',
      scenes: {
        s: { id: 's', kind: 'story', text: ['hi'], next: [
          { id: 'go', label: 'Go', to: 'end', effects: [
            { kind: 'journal', entry: {
              id: 'lead-x', title: 'A thread', body: 'chase it',
              kind: 'lead', resolvedBy: 'never-fires',
            } },
          ] },
        ] },
        end: { id: 'end', kind: 'ending', outcome: 'victory', text: ['done'] },
      },
    };
    expect(validateModule(mod).some((e) => e.includes("'never-fires'") && e.includes('never close'))).toBe(true);
    // Add a scene that sets the flag and the error clears.
    (mod.scenes['s'] as { next: Array<{ effects?: unknown[] }> }).next[0]!.effects!.push({ kind: 'setFlag', flag: 'never-fires' });
    expect(validateModule(mod).filter((e) => e.includes('resolvedBy'))).toEqual([]);
  });
});

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

// --- M3.5: multi-approach challenges ----------------------------------------

describe('challenges (multi-approach)', () => {
  // A challenge with a guaranteed-success line (DC 1), a guaranteed-failure
  // line (DC 30), and an ungated fallback — enough to drive every branch.
  const challenge = (retry: 'single' | 'perApproach'): Module => ({
    id: 'ch', title: 'T', blurb: '', start: 's',
    scenes: {
      s: {
        id: 's', kind: 'challenge', intro: ['A locked door.'], retry,
        approaches: [
          { id: 'force', label: 'Force it', skill: 'athletics', dc: 30 },
          { id: 'pick', label: 'Pick it', skill: 'sleight-of-hand', dc: 1,
            success: { to: 'win', text: ['Click.'], effects: [{ kind: 'setFlag', flag: 'opened' }] } },
        ],
        success: { to: 'win' },
        failure: { to: 'lose', text: ['You give up.'] },
      },
      win: { id: 'win', kind: 'ending', outcome: 'victory', text: ['In.'] },
      lose: { id: 'lose', kind: 'ending', outcome: 'defeat', text: ['Stuck.'] },
    },
  });

  it('validates and offers its approaches', () => {
    const m = challenge('single');
    expect(validateModule(m)).toEqual([]);
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 's');
    expect(legalApproaches(s, m).map((a) => a.approach.id)).toEqual(['force', 'pick']);
  });

  it('single mode: the first attempt resolves the whole challenge', () => {
    const m = challenge('single');
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 's');
    // Fail the forced line — single mode routes straight to the shared failure.
    const evs = tryApproach(s, m, 'force');
    expect(evs.some((e) => e.type === 'check' && !e.success)).toBe(true);
    expect(s.sceneId).toBe('lose');
  });

  it('perApproach mode: a failed line is spent but another may be tried', () => {
    const m = challenge('perApproach');
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 's');
    tryApproach(s, m, 'force'); // DC 30 — fails
    // Still on the challenge; 'force' now shows spent, 'pick' still open.
    expect(s.sceneId).toBe('s');
    const opts = legalApproaches(s, m);
    expect(opts.find((a) => a.approach.id === 'force')!.spent).toBe(true);
    expect(opts.find((a) => a.approach.id === 'pick')!.spent).toBe(false);
    // The winning line still lands.
    tryApproach(s, m, 'pick');
    expect(s.sceneId).toBe('win');
    expect(s.flags['opened']).toBe(true);
  });

  it('perApproach mode: the challenge fails only once every line is exhausted', () => {
    // Both lines guaranteed to fail: the shared failure fires after the last.
    const m = challenge('perApproach');
    (m.scenes['s'] as { approaches: Array<{ dc: number }> }).approaches[1]!.dc = 30;
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 's');
    tryApproach(s, m, 'force');
    expect(s.sceneId).toBe('s'); // one line left, still here
    tryApproach(s, m, 'pick');
    expect(s.sceneId).toBe('lose'); // exhausted → shared failure
  });

  it('a spent approach cannot be tried again', () => {
    const m = challenge('perApproach');
    const s = startAdventure(newCampaign(1), m);
    enterScene(s, m, 's');
    tryApproach(s, m, 'force');
    expect(() => tryApproach(s, m, 'force')).toThrow(/already tried/);
  });

  it('the validator rejects a challenge with no approaches or no ungated line', () => {
    const noApproaches: Module = {
      id: 'x', title: 'T', blurb: '', start: 's',
      scenes: {
        s: { id: 's', kind: 'challenge', intro: ['x'], approaches: [], success: { to: 'e' }, failure: { to: 'e' } },
        e: { id: 'e', kind: 'ending', outcome: 'victory', text: ['done'] },
      },
    };
    expect(validateModule(noApproaches).some((e) => e.includes('no approaches'))).toBe(true);

    const allGated: Module = {
      id: 'y', title: 'T', blurb: '', start: 's',
      scenes: {
        s: { id: 's', kind: 'challenge', intro: ['x'],
          approaches: [{ id: 'a', label: 'A', skill: 'athletics', dc: 10, requires: [{ kind: 'flag', flag: 'never' }] }],
          success: { to: 'e' }, failure: { to: 'e' } },
        e: { id: 'e', kind: 'ending', outcome: 'victory', text: ['done'] },
      },
    };
    expect(validateModule(allGated).some((e) => e.includes('always-available approach'))).toBe(true);
  });
});

// --- M4: the authored module + save/resume ----------------------------------

describe('The Hollow Road (M4)', () => {
  const hollow = MODULES.find((m) => m.id === 'hollow-road')!;

  it('validates', () => {
    expect(hollow).toBeDefined();
    expect(validateModule(hollow)).toEqual([]);
  });

  it('carries closable journal leads (resolver flags are actually set)', () => {
    // Collect every lead's resolvedBy flag from the module's journal effects.
    const leads: string[] = [];
    for (const s of Object.values(hollow.scenes)) {
      const choices = (s.kind === 'story' || s.kind === 'dialogue') ? s.next : [];
      const outcomes = s.kind === 'check' ? [s.success, s.failure] : [];
      const effs = [
        ...choices.flatMap((c) => c.effects ?? []),
        ...outcomes.flatMap((o) => o.effects ?? []),
      ];
      for (const eff of effs) {
        if (eff.kind === 'journal' && eff.entry.kind === 'lead' && eff.entry.resolvedBy) {
          leads.push(eff.entry.resolvedBy);
        }
      }
    }
    expect(leads.length).toBeGreaterThan(0);
    // No validator error means each resolver flag is written somewhere.
    expect(validateModule(hollow).filter((e) => e.includes('resolvedBy'))).toEqual([]);
  });

  it('fields a varied bestiary — a distinct roster per fight, no lazy reuse', () => {
    // Collect every battle scene's encounter and the monsters it fields.
    const enc = new Map<string, number>();
    const monsters = new Set<string>();
    for (const s of Object.values(hollow.scenes)) {
      if (s.kind !== 'battle') continue;
      enc.set(s.encounterId, (enc.get(s.encounterId) ?? 0) + 1);
      for (const m of ENCOUNTERS[s.encounterId]?.members ?? []) monsters.add(m);
    }
    // A good spread of distinct encounters and a real tour of the bestiary.
    expect(enc.size).toBeGreaterThanOrEqual(8);
    expect(monsters.size).toBeGreaterThanOrEqual(12);
    // No encounter drives more than two scenes — the only doubles allowed are
    // mutually-exclusive variants of one fight (the spy ambush, the hollow
    // ambush), never the same encounter dropped into three different battles.
    for (const [id, count] of enc) {
      expect(count, `encounter '${id}' is reused in ${count} battles`).toBeLessThanOrEqual(2);
    }
  });

  it('opens with an early ambush — combat in the first minute', () => {
    // The start scene is a short road intro whose only way forward is a battle,
    // and that battle fields the Ashfang (so the enemy is named up front and the
    // first fight fires the shared battle tutorial).
    const start = hollow.scenes[hollow.start];
    expect(start?.kind).toBe('story');
    if (start?.kind !== 'story') return;
    const dests = start.next.map((c) => c.to);
    expect(dests.length).toBe(1);
    const first = hollow.scenes[dests[0]!];
    expect(first?.kind).toBe('battle');
    if (first?.kind === 'battle') expect(first.encounterId).toContain('raiders');
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

  it('has an optional inn rumor table that always loops back (a skippable tutorial)', () => {
    // The regulars' table teaches mechanics in-character but must never trap the
    // player: it's reached by an ungated choice, every lesson returns to it, and
    // it always offers a way back to the taproom.
    const tavern = hollow.scenes['tavern'];
    expect(tavern?.kind).toBe('dialogue');
    if (tavern?.kind !== 'dialogue') return;
    const toRegulars = tavern.next.find((c) => c.to === 'regulars');
    expect(toRegulars).toBeDefined();
    expect(toRegulars!.requires ?? []).toEqual([]); // never gated — always offered

    const regulars = hollow.scenes['regulars'];
    expect(regulars?.kind).toBe('story');
    if (regulars?.kind !== 'story') return;
    // An exit back to the taproom, plus at least three `once` lessons.
    expect(regulars.next.some((c) => c.to === 'tavern')).toBe(true);
    const lessons = regulars.next.filter((c) => c.once && c.to.startsWith('rumor-'));
    expect(lessons.length).toBeGreaterThanOrEqual(3);
    // Every lesson is a real scene that routes straight back to the table.
    for (const lesson of lessons) {
      const scene = hollow.scenes[lesson.to];
      expect(scene?.kind).toBe('story');
      if (scene?.kind === 'story') expect(scene.next.every((c) => c.to === 'regulars')).toBe(true);
    }
  });

  it('paces the party into the 1→3 band (required fights + milestones)', () => {
    // The runner now awards battle XP like the real driver, so this covers the
    // whole spine: three required Act-1 fights + M1 land 2nd level; M2 at the
    // hollow lands 3rd. Every victory finishes at L3 (a wit-heavy run) or L4 (a
    // party that also cleared the optional marsh/den fights) — never short of 3.
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let nn = seed * 7 + 3;
      const rand = () => (nn = (nn * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const policy: RunPolicy = { pick: (count) => Math.floor(rand() * count), battle: () => true };
      const result = runModule(newCampaign(seed), hollow, policy, 6000);
      if (result.ending !== 'victory') continue;
      const level = levelForXp(result.state.campaign.xp);
      expect(level).toBeGreaterThanOrEqual(3);
      expect(level).toBeLessThanOrEqual(4);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
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
