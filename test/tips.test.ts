import { describe, it, expect } from 'vitest';
import { detectTips } from '../web/src/tips.js';
import type { GameEvent } from '../src/engine/events.js';
import type { GameState } from '../src/engine/types.js';

// A skeletal state is enough — detectTips reads teams off combatants and, for a
// couple of tips, the spell registry. Positions/HP are irrelevant here.
function stateWith(teams: Record<string, 'team1' | 'team2'>): GameState {
  const combatants: GameState['combatants'] = {} as GameState['combatants'];
  for (const [id, team] of Object.entries(teams)) {
    combatants[id] = { id, team } as GameState['combatants'][string];
  }
  return { combatants } as GameState;
}

// team1 is the player throughout.
const isPlayer = (s: GameState) => (id: string) => s.combatants[id]?.team === 'team1';

describe('learning tips', () => {
  it('fires the downed-ally tip only for a player-team hero', () => {
    const s = stateWith({ hero: 'team1', foe: 'team2' });
    const heroDown: GameEvent[] = [{ type: 'downed', combatantId: 'hero' }];
    const foeDown: GameEvent[] = [{ type: 'downed', combatantId: 'foe' }];
    expect(detectTips(heroDown, s, isPlayer(s)).some((t) => t.id === 'downed-ally')).toBe(true);
    expect(detectTips(foeDown, s, isPlayer(s)).some((t) => t.id === 'downed-ally')).toBe(false);
  });

  it('fires the opportunity tip on any provoked attack, either side', () => {
    const s = stateWith({ hero: 'team1', foe: 'team2' });
    const oa: GameEvent[] = [{
      type: 'attackRolled', attackerId: 'foe', targetId: 'hero', weaponId: 'w',
      natural: 10, total: 15, targetAc: 14, mode: 'normal', advSources: [], disSources: [],
      hit: true, crit: false, opportunity: true,
    }];
    expect(detectTips(oa, s, isPlayer(s)).some((t) => t.id === 'opportunity')).toBe(true);
  });

  it('fires the concentration tip for a player casting a concentration spell', () => {
    const s = stateWith({ wiz: 'team1', foe: 'team2' });
    // bless is a concentration spell in the registry.
    const cast: GameEvent[] = [{ type: 'spellCast', casterId: 'wiz', spellId: 'bless', origin: { x: 0, y: 0 }, cells: [] }];
    const ids = detectTips(cast, s, isPlayer(s)).map((t) => t.id);
    expect(ids).toContain('concentration');
    expect(ids).toContain('slot'); // bless is leveled, so the slot tip also applies
  });

  it('does not fire the slot tip for a cantrip', () => {
    const s = stateWith({ wiz: 'team1', foe: 'team2' });
    const cantrip: GameEvent[] = [{ type: 'spellCast', casterId: 'wiz', spellId: 'fire-bolt', origin: { x: 0, y: 0 }, cells: [] }];
    expect(detectTips(cantrip, s, isPlayer(s)).some((t) => t.id === 'slot')).toBe(false);
  });

  it('orders the most-urgent tip first when several fire together', () => {
    const s = stateWith({ hero: 'team1', foe: 'team2' });
    const both: GameEvent[] = [
      { type: 'attackRolled', attackerId: 'hero', targetId: 'foe', weaponId: 'w', natural: 20, total: 30, targetAc: 14, mode: 'normal', advSources: [], disSources: [], hit: true, crit: true, opportunity: false },
      { type: 'downed', combatantId: 'hero' },
    ];
    // downed-ally outranks crit in the priority order.
    expect(detectTips(both, s, isPlayer(s))[0]!.id).toBe('downed-ally');
  });

  it('fires the mastery tip only when a player is the source', () => {
    const s = stateWith({ hero: 'team1', foe: 'team2' });
    const sap: GameEvent[] = [{ type: 'conditionApplied', combatantId: 'foe', condition: 'sapped', sourceId: 'hero' }];
    const enemySap: GameEvent[] = [{ type: 'conditionApplied', combatantId: 'hero', condition: 'sapped', sourceId: 'foe' }];
    expect(detectTips(sap, s, isPlayer(s)).some((t) => t.id === 'mastery')).toBe(true);
    expect(detectTips(enemySap, s, isPlayer(s)).some((t) => t.id === 'mastery')).toBe(false);
  });
});
