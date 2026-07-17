import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { renderEvent } from '../src/ui/cli/renderer.js';
import { logLinesFor } from '../web/src/log.js';
import type { GameEvent } from '../src/engine/events.js';

const c = new Combat({
  seed: 1,
  combatants: [
    { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 } }), id: 'a', name: 'Sir Arthur' },
    { ...buildCharacter({ classId: 'wizard', team: 'team2', position: { x: 1, y: 0 } }), id: 'b', name: 'Kobold 5' },
  ],
});

describe('combat log rendering', () => {
  const hit: GameEvent = {
    type: 'attackRolled', attackerId: 'a', targetId: 'b', weaponId: 'longsword',
    natural: 14, total: 18, targetAc: 15, mode: 'flat', advSources: [], disSources: [],
    hit: true, crit: false, opportunity: false,
  };

  it('keeps the (T1)/(T2) tags for the terminal, which has no colour', () => {
    expect(renderEvent(c.state, hit)).toContain('Sir Arthur(T1)');
    expect(renderEvent(c.state, hit)).toContain('Kobold 5(T2)');
  });

  it('drops them for the web, where colour carries the side', () => {
    const [line] = logLinesFor(c.state, [hit]);
    expect(line!.text).toContain('Sir Arthur');
    expect(line!.text).not.toContain('(T1)');
    expect(line!.text).not.toContain('(T2)');
  });

  it('tags each line with what happened and whose it is, so it can be styled', () => {
    const dmg: GameEvent = { type: 'damageDealt', targetId: 'b', sourceId: 'a', amount: 6, damageType: 'slashing', rolls: [3], tags: ['Critical Hit'] };
    const lines = logLinesFor(c.state, [
      { type: 'turnStarted', combatantId: 'a', round: 1 },
      hit,
      dmg,
      { type: 'died', combatantId: 'b' },
    ]);
    expect(lines.map((l) => l.kind)).toEqual(['turn', 'hit', 'dmg crit', 'died']);
    // The turn header carries the actor's colour; damage carries the victim's.
    expect(lines[0]!.team).toBe('team1');
    expect(lines[3]!.team).toBe('team2');
  });
});
