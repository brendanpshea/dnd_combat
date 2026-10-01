/**
 * At a fight's door: parley, sneak up, fall back — and retreating mid-fight —
 * plus the adventure save slots.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  startAdventure, enterScene, currentScene, battleOptions, parleyBattle, sneakBattle,
  fleeBattle, battleSurpriseOf, resolveBattle, sneakDc,
} from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { HOLLOW_ROAD_MODULE as HOLLOW } from '../src/data/modules/hollow-road.js';
import { validateModule } from '../src/adventure/validate.js';
import { partingBlows } from '../src/engine/rules/movement.js';
import { Combat } from '../src/engine/combat.js';
import { makeCombatant } from './helpers.js';

/** A party at `sceneId`, having walked in from Thornwick Square. */
function at(sceneId: string, seed = 7) {
  const state = startAdventure(newCampaign(seed), HOLLOW);
  enterScene(state, HOLLOW, 'square');
  enterScene(state, HOLLOW, sceneId);
  return state;
}

describe('the choices at a fight\'s door', () => {
  it('offers parley where the module wrote one, sneaking, and the way back', () => {
    const s = at('road-out');
    const o = battleOptions(s, HOLLOW);
    expect(o.parley?.label).toBe('Stare down the goblin boss');
    expect(o.sneak?.dc).toBe(sneakDc('goblin-outriders'));
    expect(o.fallBack?.title).toBeTruthy();
  });

  it('offers no sneaking at a fight that is already an ambush', () => {
    expect(battleOptions(at('spy-ambush'), HOLLOW).sneak).toBeUndefined();
  });

  it('a parley that lands goes round the fight, milestone and all', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = at('road-out', seed);
      const xp = s.campaign.xp;
      parleyBattle(s, HOLLOW);
      if (s.sceneId !== 'trail') continue;
      expect(s.campaign.xp).toBeGreaterThan(xp);
      return;
    }
    throw new Error('no seed talked them down');
  });

  it('a parley that fails leaves the fight, and cannot be tried again', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = at('road-out', seed);
      parleyBattle(s, HOLLOW);
      if (s.sceneId !== 'road-out') continue;
      expect(battleOptions(s, HOLLOW).parley).toBeUndefined();
      expect(() => parleyBattle(s, HOLLOW)).toThrow();
      return;
    }
    throw new Error('no seed failed the parley');
  });

  it('sneaking decides who is surprised, once', () => {
    const s = at('road-out');
    sneakBattle(s, HOLLOW);
    expect(['party', 'enemies']).toContain(battleSurpriseOf(s, HOLLOW));
    expect(battleOptions(s, HOLLOW).sneak).toBeUndefined();
    resolveBattle(s, HOLLOW, true);
    expect(s.battleSurprise).toBeUndefined();
  });

  it('falling back returns to the hub and leaves the fight standing', () => {
    const s = at('road-out');
    fleeBattle(s, HOLLOW, false);
    expect(currentScene(s, HOLLOW).kind).toBe('explore');
    expect(s.battleAttempts?.['road-out']).toBeUndefined();
  });

  it('a retreat counts as an attempt, so a second go rolls fresh dice', () => {
    const s = at('road-out');
    fleeBattle(s, HOLLOW, true);
    expect(s.battleAttempts?.['road-out']).toBe(1);
  });

  it('refuses to fall back from a fight marked noFlee', () => {
    const s = at('road-out');
    const scene = HOLLOW.scenes['road-out']!;
    if (scene.kind !== 'battle') throw new Error();
    scene.noFlee = true;
    try {
      expect(battleOptions(s, HOLLOW).fallBack).toBeUndefined();
      expect(() => fleeBattle(s, HOLLOW, false)).toThrow();
    } finally {
      delete scene.noFlee;
    }
  });

  it('the modules with parleys still validate', () => {
    expect(validateModule(HOLLOW)).toEqual([]);
  });
});

describe('retreating mid-fight', () => {
  it('every enemy with a hero in reach takes one parting blow', () => {
    const hero = makeCombatant({ id: 'h', team: 'team1', position: { x: 3, y: 3 }, hp: 50, maxHp: 50 });
    const near = makeCombatant({ id: 'n', team: 'team2', position: { x: 4, y: 3 } });
    const far = makeCombatant({ id: 'f', team: 'team2', position: { x: 7, y: 7 } });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [hero, near, far] });
    const events = partingBlows(c.state, 'team1');
    const swings = events.filter((e) => e.type === 'attackRolled');
    expect(swings.length).toBe(1);
    expect(swings[0]!.type === 'attackRolled' && swings[0]!.attackerId).toBe('n');
    expect(c.state.combatants.n!.turn.reactionUsed).toBe(true);
  });
});

describe('adventure save slots', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
  });

  it('keeps three companies apart', async () => {
    const S = await import('../web/src/adventureStorage.js');
    const a = at('road-out', 1);
    const b = startAdventure(newCampaign(2), HOLLOW);
    S.saveAdventureWeb(a, 0);
    S.saveAdventureWeb(b, 1);
    expect(S.loadAdventureWeb(HOLLOW, 0)?.sceneId).toBe('road-out');
    expect(S.loadAdventureWeb(HOLLOW, 1)?.sceneId).toBe(HOLLOW.start);
    expect(S.slotMeta(2)).toBeUndefined();
    S.deleteAdventureWeb(0);
    expect(S.loadAdventureWeb(HOLLOW, 0)).toBeUndefined();
    expect(S.loadAdventureWeb(HOLLOW, 1)).toBeDefined();
  });

  it('moves the old single save into the first slot', async () => {
    const S = await import('../web/src/adventureStorage.js');
    const { serializeAdventure } = await import('../src/adventure/save.js');
    store.set('dnd-adventure-save', serializeAdventure(at('road-out')));
    expect(S.activeSlot()).toBe(0);
    expect(S.loadAdventureWeb(HOLLOW, 0)?.sceneId).toBe('road-out');
    expect(store.has('dnd-adventure-save')).toBe(false);
  });

  it('holds a checkpoint from the door of the last fight', async () => {
    const S = await import('../web/src/adventureStorage.js');
    const door = at('road-out');
    S.saveCheckpointWeb(door, 'Goblin Outriders', 0);
    const later = at('road-out');
    fleeBattle(later, HOLLOW, true);
    S.saveAdventureWeb(later, 0);
    expect(S.loadCheckpointWeb(HOLLOW, 0)?.sceneId).toBe('road-out');
    expect(S.slotMeta(0)?.checkpointLabel).toBe('Goblin Outriders');
  });
});

describe('a lost fight with its own loss beat', () => {
  it('still picks the party up, as the defeat scene does', () => {
    const s = startAdventure(newCampaign(3), HOLLOW);
    enterScene(s, HOLLOW, 'road-ambush');
    for (const ch of s.campaign.characters) ch.resources = { ...ch.resources, hp: 0 };
    resolveBattle(s, HOLLOW, false);
    expect(s.sceneId).toBe('road-carter');
    expect(s.campaign.characters.every((ch) => (ch.resources?.hp ?? 1) > 0)).toBe(true);
  });
});
