import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { FEATURES } from '../src/data/features.js';
import { cellAt } from '../src/engine/types.js';
import { executeMove } from '../src/engine/rules/movement.js';
import { applyCondition } from '../src/engine/rules/conditions.js';
import { makeCombatant } from './helpers.js';

/**
 * Every immunity is checked where conditions go on, so no source can skip one.
 * Each case here is a source that used to.
 */
describe('applyCondition', () => {
  it('turns fear aside from a raging barbarian, whatever frightens them', () => {
    // The mummy's Dreadful Glare pushed `frightened` without asking about
    // Mindless Rage, which five other fear sources did ask about.
    for (let seed = 1; seed <= 30; seed++) {
      const mummy = makeCombatant({ id: 'm', team: 'team2', position: { x: 0, y: 0 }, featureIds: ['dreadful-glare'] });
      const barb = makeCombatant({
        id: 'b', team: 'team1', position: { x: 2, y: 0 }, featureIds: ['mindless-rage'],
        conditions: [{ id: 'raging', sourceId: 'b' }],
      });
      const c = new Combat({ seed, mapId: 'open', combatants: [mummy, barb] });
      FEATURES['dreadful-glare']!.apply!({ state: c.state, actorId: 'm' });
      expect(c.state.combatants['b']!.conditions.some((k) => k.id === 'frightened'), `seed ${seed}`).toBe(false);
    }
  });

  it('keeps magical binding off a Ring of Free Action, and lets the wearer walk on through a web', () => {
    // The web reported "restrained" and stopped the wearer dead while the ring
    // quietly kept the condition off: the walk ended anyway.
    const spinner = makeCombatant({ id: 's', team: 'team2', position: { x: 7, y: 7 } });
    const walker = makeCombatant({ id: 'w', team: 'team1', position: { x: 0, y: 0 }, featureIds: ['free-action'] });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [spinner, walker] });
    cellAt(c.state.grid, { x: 1, y: 0 })!.web = { sourceId: 's', dc: 99 };
    const events = executeMove(c.state, 'w', { x: 3, y: 0 });
    const w = c.state.combatants['w']!;
    expect(w.conditions.some((k) => k.id === 'restrained')).toBe(false);
    expect(events.some((e) => e.type === 'conditionApplied')).toBe(false);
    expect(w.position).toEqual({ x: 3, y: 0 });
  });

  it('still lets a natural binding through the ring', () => {
    const w = makeCombatant({ id: 'w', team: 'team1', position: { x: 0, y: 0 }, featureIds: ['free-action'] });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [w] });
    expect(applyCondition(c.state, 'w', { id: 'restrained' }, { magical: false })).toHaveLength(1);
    expect(applyCondition(c.state, 'w', { id: 'paralyzed' }, { magical: true })).toHaveLength(0);
  });
});

describe('the applier is the only way on', () => {
  it('has no direct condition pushes left in the engine or the data', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = new URL('../src/', import.meta.url).pathname;
    // Built before a fight state exists: see the note in rules/conditions.ts.
    const allowed = new Set(['rules/conditions.ts', 'arena/gambit.ts', 'campaign/campaign.ts']);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) { walk(path); continue; }
        if (!path.endsWith('.ts')) continue;
        const rel = path.slice(root.length).replace(/^engine\//, '');
        if (allowed.has(rel)) continue;
        readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
          if (/\.conditions\.push\(/.test(line)) offenders.push(`${rel}:${i + 1}`);
        });
      }
    };
    walk(root);
    expect(offenders, 'push through applyCondition so every immunity is checked').toEqual([]);
  });
});

describe('conditions timed off a turn', () => {
  function duel() {
    const a = makeCombatant({ id: 'a', team: 'team1', position: { x: 0, y: 0 } });
    const b = makeCombatant({ id: 'b', team: 'team2', position: { x: 5, y: 5 } });
    const c = new Combat({ seed: 1, mapId: 'open', combatants: [a, b] });
    for (let g = 0; c.activeId !== 'a' && g < 4; g++) c.apply({ kind: 'endTurn' });
    return c;
  }
  const has = (c: Combat, who: string, id: string) =>
    c.state.combatants[who]!.conditions.some((k) => k.id === id);

  it('lifts Sap at the start of the attacker\'s next turn, used or not', () => {
    // It used to wait for the sapped creature's next attack, however long.
    const c = duel();
    applyCondition(c.state, 'b', { id: 'sapped', sourceId: 'a', endsAtTurnStartOf: 'a' }, { magical: false });
    c.apply({ kind: 'endTurn' });            // b's turn: still sapped
    expect(has(c, 'b', 'sapped')).toBe(true);
    c.apply({ kind: 'endTurn' });            // a's next turn starts
    expect(has(c, 'b', 'sapped')).toBe(false);
  });

  it('keeps "until the end of your next turn" through this turn and the next', () => {
    const c = duel();
    applyCondition(c.state, 'b', {
      id: 'guided', sourceId: 'a', endsAtTurnEndOf: { id: 'a', skip: true },
    }, { magical: true });
    c.apply({ kind: 'endTurn' });            // end of a's current turn: not "next"
    expect(has(c, 'b', 'guided')).toBe(true);
    c.apply({ kind: 'endTurn' });            // b's turn ends
    expect(has(c, 'b', 'guided')).toBe(true);
    c.apply({ kind: 'endTurn' });            // end of a's NEXT turn
    expect(has(c, 'b', 'guided')).toBe(false);
  });
});
