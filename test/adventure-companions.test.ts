/**
 * NPC companions: an NPC who travels with the party, fights beside it under
 * the AI, and comes and goes by the module's say.
 */
import { describe, it, expect } from 'vitest';
import {
  startAdventure, enterScene, choose, legalChoices, requirementMet, companionCombatants,
  readBackCompanions, restCompanions, resolveBattle,
} from '../src/adventure/runtime.js';
import { validateModule } from '../src/adventure/validate.js';
import { npcFateFlag } from '../src/adventure/npcs.js';
import { newCampaign, buildCampaignParty } from '../src/campaign/campaign.js';
import { HOLLOW_ROAD_MODULE as HOLLOW } from '../src/data/modules/hollow-road.js';
import { MAPS, parseMap } from '../src/data/maps.js';
import { MONSTERS, buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { actsOnItsOwn } from '../src/engine/rules/summon.js';
import { checkWinner } from '../src/engine/rules/attack.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { Module } from '../src/adventure/types.js';

const SCOUT_HP = MONSTERS.scout!.hp;

function withWren() {
  const state = startAdventure(newCampaign(3), HOLLOW);
  enterScene(state, HOLLOW, 'scout-saved');
  choose(state, HOLLOW, 'come');
  return state;
}

describe('joining and leaving', () => {
  it('Wren can be asked along after the rescue', () => {
    const s = withWren();
    expect(s.companions?.map((x) => x.id)).toEqual(['wren']);
    expect(requirementMet(s, { kind: 'companion', companion: 'wren' })).toBe(true);
    expect(s.flags[npcFateFlag('wren', 'saved')]).toBe(true);   // the same story beat either way
  });

  it('sending her home leaves the party as it was', () => {
    const s = startAdventure(newCampaign(3), HOLLOW);
    enterScene(s, HOLLOW, 'scout-saved');
    choose(s, HOLLOW, 'ok');
    expect(s.companions ?? []).toEqual([]);
    expect(s.flags[npcFateFlag('wren', 'saved')]).toBe(true);
  });

  it('she parts at the den, whichever way the party comes up to it', () => {
    for (const from of ['hollow-won', 'hollow-quiet']) {
      const s = withWren();
      enterScene(s, HOLLOW, from);
      const offered = legalChoices(s, HOLLOW).filter((c) => !c.blocked);
      expect(offered.map((c) => c.choice.to), from).toEqual(['wren-parts']);
      choose(s, HOLLOW, offered[0]!.choice.id);
      choose(s, HOLLOW, 'go');
      expect(s.companions ?? [], from).toEqual([]);
      expect(s.sceneId).toBe('gate');
    }
  });

  it('the validator knows who the companions are', () => {
    expect(validateModule(HOLLOW)).toEqual([]);
    const broken: Module = {
      ...HOLLOW,
      scenes: { ...HOLLOW.scenes, 'wren-joins': { ...HOLLOW.scenes['wren-joins']!, kind: 'story', text: ['x'],
        next: [{ id: 'x', label: 'x', to: 'trail', effects: [{ kind: 'joinParty', companion: 'nobody' }] }] } as never },
    };
    expect(validateModule(broken).some((e) => e.includes("unknown companion 'nobody'"))).toBe(true);
  }, 30_000);
});

describe('in a fight', () => {
  const fightWith = (s = withWren()) => {
    const grid = parseMap(MAPS.open!);
    const heroes = buildCampaignParty(s.campaign);
    const allies = companionCombatants(s, HOLLOW, grid, heroes.map((h) => h.position));
    return { s, heroes, allies };
  };

  it('stands behind the front rank with her own stat block, run by the AI', () => {
    const { heroes, allies } = fightWith();
    expect(allies).toHaveLength(1);
    const wren = allies[0]!;
    expect(wren.name).toBe('Wren');
    expect(wren.team).toBe('team1');
    expect(wren.maxHp).toBe(SCOUT_HP);
    expect(actsOnItsOwn(wren)).toBe(true);
    expect(wren.unconsciousAtZero).toBe(true);
    expect(heroes.some((h) => h.position.x === wren.position.x && h.position.y === wren.position.y)).toBe(false);
  });

  it('does not decide the fight: a party face-down has lost even with her standing', () => {
    const { heroes, allies } = fightWith();
    const foe = buildMonster('goblin-warrior', 'team2', { x: 4, y: 6 });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [...heroes, ...allies, foe] });
    for (const h of heroes) { const x = c.state.combatants[h.id]!; x.hp = 0; }
    expect(checkWinner(c.state)).toBe('team2');
  });

  it('a whole fight plays through with her in it', () => {
    const { heroes, allies } = fightWith();
    const foes = ['goblin-warrior', 'goblin-warrior'].map((id, i) => ({ ...buildMonster(id, 'team2', { x: 3 + i, y: 7 }), id: `g${i}` }));
    const c = new Combat({ seed: 4, mapId: 'open', combatants: [...heroes, ...allies, ...foes] });
    let steps = 0;
    while (!c.isOver() && steps++ < 800) c.apply(chooseAction(c.state, c.activeId));
    expect(c.isOver()).toBe(true);
  });

  it('carries her wounds out of the fight, never below 1, and rest mends them', () => {
    const { s, allies } = fightWith();
    readBackCompanions(s, [{ ...allies[0]!, hp: 0 }]);
    expect(s.companions![0]!.hp).toBe(1);
    restCompanions(s, 'short', HOLLOW);
    expect(s.companions![0]!.hp).toBe(Math.min(SCOUT_HP, 1 + Math.ceil(SCOUT_HP / 2)));
    restCompanions(s, 'full');
    expect(s.companions![0]!.hp).toBeUndefined();
  });

  it('is picked up at half strength with the party after a lost fight', () => {
    const s = withWren();
    s.companions![0]!.hp = 1;
    enterScene(s, HOLLOW, 'road-out');
    resolveBattle(s, HOLLOW, false);
    expect(s.companions![0]!.hp).toBe(Math.ceil(SCOUT_HP / 2));
  });
});
