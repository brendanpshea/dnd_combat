import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildMonster } from '../src/data/monsters.js';
import { coverOf, coverLevel, COVER_BONUS } from '../src/engine/rules/cover.js';
import { resolveAttack } from '../src/engine/rules/attack.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { applyCondition } from '../src/engine/rules/conditions.js';
import { moveDestinations } from '../src/engine/rules/movement.js';
import { SPELLS } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { makeCombatant } from './helpers.js';
import type { GameState, Position } from '../src/engine/types.js';
import type { GameEvent } from '../src/engine/events.js';

/**
 * Cover as SRD 5.2.1 has it (Cover, line 713): half (+2 to AC and Dexterity
 * saves) from a barricade or a creature on the line, three-quarters (+5) from
 * high cover, total from a wall; the best one counts; no size gate.
 */

const MAP = (rows: string[]) => ({ id: 't', name: 't', theme: 'stone' as const, rows });
const OPEN = ['........', '........', '........', '........', '........', '........', '........', '........'];

function place(c: Combat, id: string, team: 'team1' | 'team2', at: Position) {
  c.state.combatants[id] = makeCombatant({ id, team, position: at });
  c.state.grid.cells[at.y * c.state.grid.width + at.x]!.occupantId = id;
  return c.state.combatants[id]!;
}

function fight(rows = OPEN) {
  const shooter = makeCombatant({ id: 'sh', team: 'team2', position: { x: 3, y: 6 }, equipped: { mainHand: 'shortbow' } });
  const target = makeCombatant({ id: 'tg', team: 'team1', position: { x: 3, y: 1 } });
  return new Combat({ seed: 1, map: MAP(rows), combatants: [shooter, target] });
}

const shot = (c: Combat) => {
  const roll = resolveAttack(c.state, 'sh', 'tg', 'shortbow').find((e) => e.type === 'attackRolled');
  if (roll?.type !== 'attackRolled') throw new Error('no attack');
  return roll;
};

describe('coverOf, the function a front end asks', () => {
  it('reads none, half, three-quarters and total off the board', () => {
    const at = (rows: string[]) => coverOf(fight(rows).state, 'sh', 'tg');
    expect(at(OPEN)).toBe('none');
    const row = (ch: string) => OPEN.map((r, i) => (i === 4 ? `...${ch}....` : r));   // y=3
    expect(at(row('+'))).toBe('half');
    expect(at(row('='))).toBe('three-quarters');
    expect(at(row('#'))).toBe('total');
    // From a point, too: where a Fireball goes off.
    expect(coverOf(fight(row('+')).state, { x: 3, y: 5 }, 'tg')).toBe('half');
  });

  it('takes the most protective, never the sum', () => {
    const c = fight(OPEN.map((r, i) => (i === 4 ? '...=....' : i === 5 ? '...+....' : r)));
    expect(coverOf(c.state, 'sh', 'tg')).toBe('three-quarters');
    expect(shot(c).targetAc - acOf(c.state.combatants['tg']!)).toBe(5);
  });
});

describe('a creature is cover (line 713: "whether that creature is an enemy or a friend")', () => {
  it('a body on the line gives half cover to the one behind it', () => {
    const c = fight();
    place(c, 'friend', 'team1', { x: 3, y: 3 });
    const roll = shot(c);
    expect(roll.cover).toBe(true);
    expect(roll.coverLevel).toBe('half');
    expect(roll.targetAc - acOf(c.state.combatants['tg']!)).toBe(COVER_BONUS.half);
    // The shooter's own side counts too.
    const d = fight();
    place(d, 'foe2', 'team2', { x: 3, y: 4 });
    expect(coverOf(d.state, 'sh', 'tg')).toBe('half');
  });

  it('one lying flat shelters nobody', () => {
    const c = fight();
    const body = place(c, 'friend', 'team1', { x: 3, y: 3 });
    applyCondition(c.state, body.id, { id: 'prone', sourceId: body.id }, { magical: false });
    expect(coverOf(c.state, 'sh', 'tg')).toBe('none');
    body.conditions = [];
    body.hp = 0;
    expect(coverOf(c.state, 'sh', 'tg')).toBe('none');
  });

  it('a melee swing at reach still goes over it, as it goes over a barricade', () => {
    const c = fight();
    place(c, 'friend', 'team1', { x: 3, y: 2 });
    c.state.combatants['sh']!.position = { x: 3, y: 3 };
    c.state.combatants['sh']!.featureIds.push('long-limbed');
    c.state.combatants['sh']!.equipped = { mainHand: 'longsword' };
    const roll = resolveAttack(c.state, 'sh', 'tg', 'longsword').find((e) => e.type === 'attackRolled');
    if (roll?.type !== 'attackRolled') throw new Error();
    expect(roll.cover).toBeUndefined();
  });
});

describe('cover on Dexterity saves', () => {
  const twin = (c: Combat) => [structuredClone(c.state), structuredClone(c.state)] as [GameState, GameState];
  const total = (e: GameEvent) => (e.type === 'savingThrow' ? e.total : NaN);

  it('adds +2 behind a barricade and +5 behind high cover, to Dexterity only', () => {
    for (const [ch, bonus] of [['+', 2], ['=', 5]] as const) {
      const c = fight(OPEN.map((r, i) => (i === 4 ? `...${ch}....` : r)));
      const [a, b] = twin(c);
      const from = { x: 3, y: 6 };
      const covered = savingThrow(a, 'tg', 'dex', 15, { magical: false, coverFrom: from }).event;
      const open = savingThrow(b, 'tg', 'dex', 15, { magical: false }).event;
      expect(total(covered) - total(open), ch).toBe(bonus);
      expect(covered.type === 'savingThrow' && covered.cover).toBe(bonus === 2 ? 'half' : 'three-quarters');
      const [x, y] = twin(c);
      expect(total(savingThrow(x, 'tg', 'con', 15, { magical: false, coverFrom: from }).event) -
        total(savingThrow(y, 'tg', 'con', 15, { magical: false }).event), 'not a Con save').toBe(0);
    }
  });

  it('a spell\'s save takes cover from its point of origin', () => {
    // Fireball at (3,4), a barricade at (3,3): the creature at (3,2) is in the
    // burst with the barricade between it and the point; the one at (5,4) is not.
    const rows = OPEN.map((r, i) => (i === 4 ? '...+....' : r));   // barricade at y=3
    const c = new Combat({ seed: 2, map: MAP(rows), combatants: [
      makeCombatant({ id: 'wiz', team: 'team1', position: { x: 0, y: 7 }, abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 8 } }),
      makeCombatant({ id: 'near', team: 'team2', position: { x: 3, y: 2 } }),
      makeCombatant({ id: 'open', team: 'team2', position: { x: 5, y: 4 } }),
    ] });
    const events = SPELLS['fireball']!.cast({ state: c.state, casterId: 'wiz', slotLevel: 3, targetIds: [], positions: [{ x: 3, y: 4 }] });
    const save = (id: string) => events.find((e) => e.type === 'savingThrow' && e.combatantId === id);
    const near = save('near');
    expect(near, 'the burst reached the one behind the barricade').toBeDefined();
    expect(near?.type === 'savingThrow' && near.cover).toBe('half');
    expect(save('open')?.type === 'savingThrow' && (save('open') as { cover?: string }).cover).toBeUndefined();
  });

  it('Sacred Flame ignores it, as the spell says', () => {
    const rows = OPEN.map((r, i) => (i === 4 ? '...+....' : r));
    const c = new Combat({ seed: 2, map: MAP(rows), combatants: [
      makeCombatant({ id: 'cl', team: 'team1', position: { x: 3, y: 1 } }),
      makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 6 } }),
    ] });
    const events = SPELLS['sacred-flame']!.cast({ state: c.state, casterId: 'cl', slotLevel: 0, targetIds: ['foe'], positions: [] });
    const save = events.find((e) => e.type === 'savingThrow');
    expect(save).toBeDefined();
    expect(save?.type === 'savingThrow' && save.cover).toBeUndefined();
  });

  it('a breath weapon takes cover from the mouth', () => {
    const rows = OPEN.map((r, i) => (i === 5 ? '..+.....' : r));   // a barricade at (2,2)
    const dragon = { ...buildMonster('young-red', 'team2', { x: 3, y: 3 }), id: 'dr' };
    const c = new Combat({ seed: 2, map: MAP(rows), combatants: [
      dragon, makeCombatant({ id: 'h', team: 'team1', position: { x: 1, y: 1 } }),
    ] });
    expect(coverLevel(c.state, { x: 3, y: 3 }, { x: 1, y: 1 })).toBe('half');
    const [a, b] = twin(c);
    const covered = savingThrow(a, 'h', 'dex', 15, { magical: false, coverFrom: { x: 3, y: 3 } }).event;
    const open = savingThrow(b, 'h', 'dex', 15, { magical: false }).event;
    expect(total(covered) - total(open)).toBe(2);
  });
});

describe('Wand of the War Mage ignores half cover, not three-quarters', () => {
  it('reads the wand against both degrees', () => {
    for (const [ch, extra] of [['+', 0], ['=', 5]] as const) {
      const rows = OPEN.map((r, i) => (i === 4 ? `...${ch}....` : r));
      const c = new Combat({ seed: 3, map: MAP(rows), combatants: [
        makeCombatant({ id: 'wiz', team: 'team1', position: { x: 3, y: 1 }, featureIds: ['war-mage-1'] }),
        makeCombatant({ id: 'foe', team: 'team2', position: { x: 3, y: 6 } }),
      ] });
      const events = SPELLS['fire-bolt']!.cast({ state: c.state, casterId: 'wiz', slotLevel: 0, targetIds: ['foe'], positions: [] });
      const roll = events.find((e) => e.type === 'attackRolled');
      if (roll?.type !== 'attackRolled') throw new Error('no bolt');
      expect(roll.targetAc - acOf(c.state.combatants['foe']!), ch).toBe(extra);
    }
  });
});

describe('deep water (a swimmer crosses it at its ordinary cost)', () => {
  it('is difficult ground to a walker and open water to a swimmer', () => {
    // Water from x=1 to x=5 the whole height of the board: no way round.
    const rows = Array.from({ length: 8 }, () => '.wwwww..');
    const mk = (swim: boolean) => {
      const c = new Combat({ seed: 1, map: MAP(rows), combatants: [
        makeCombatant({ id: 'm', team: 'team1', position: { x: 0, y: 0 }, ...(swim ? { swimSpeed: 30 } : {}) }),
        makeCombatant({ id: 'far', team: 'team2', position: { x: 7, y: 7 } }),
      ] });
      const m = c.state.combatants['m']!;
      m.turn.movementMax = 30; m.turn.movementUsed = 0;
      return moveDestinations(c.state, m);
    };
    expect(mk(false).some((p) => p.x === 6 && p.y === 0), 'a walker wades: 5 water squares at 10 ft').toBe(false);
    expect(mk(true).some((p) => p.x === 6 && p.y === 0), 'a swimmer swims straight across').toBe(true);
    expect(buildMonster('giant-frog', 'team2', { x: 0, y: 0 }).swimSpeed).toBe(30);
  });
});

describe('against an area, creatures are not cover', () => {
  it('the front rank does not shelter the back from a breath', () => {
    const c = fight();
    place(c, 'friend', 'team1', { x: 3, y: 3 });
    expect(coverOf(c.state, 'sh', 'tg'), 'against an arrow, yes').toBe('half');
    const a = structuredClone(c.state), b = structuredClone(c.state);
    const t = (e: GameEvent) => (e.type === 'savingThrow' ? e.total : NaN);
    expect(t(savingThrow(a, 'tg', 'dex', 15, { magical: false, coverFrom: { x: 3, y: 6 } }).event) -
      t(savingThrow(b, 'tg', 'dex', 15, { magical: false }).event)).toBe(0);
  });
});
