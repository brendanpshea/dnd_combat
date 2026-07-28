/**
 * The 4th-level tier, which barely existed.
 *
 * A level-7 party gets one 4th-level slot — the reward for reaching the level
 * cap. What it could put in that slot: the cleric had Banishment and nothing
 * else, ever; the bard had Phantasmal Killer and nothing else. Four spells in
 * the whole tier, against thirty in the SRD.
 *
 * Six more, chosen to reuse machinery that already existed rather than to add
 * systems: the veil rides the hide rules, the wall rides the Web's cell
 * overlay, Freedom of Movement rides the Ring of Free Action's own hook, and
 * Death Ward rides the single place every route to zero passes through.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import { dropToZero, resolveAttack } from '../src/engine/rules/attack.js';
import { endHide, isHidden } from '../src/engine/rules/hide.js';
import { cellAt, wardedAgainstMagicalBinding } from '../src/engine/types.js';
import type { Combatant, Position } from '../src/engine/types.js';

const NEW = ['greater-invisibility', 'dimension-door', 'wall-of-fire', 'confusion',
  'death-ward', 'freedom-of-movement'];

function caster(classId = 'wizard', level = 7, position: Position = { x: 1, y: 1 }): Combatant {
  return buildCharacter({ classId, team: 'team1', position, level });
}
const foe = (position: Position, id = 'd1'): Combatant =>
  ({ ...buildMonster('skeleton', 'team2', position), id, hp: 60, maxHp: 60 });

function fight(position: Position = { x: 4, y: 4 }) {
  const me = caster();
  const c = new Combat({ combatants: [me, foe(position)], seed: 9 });
  return { c, me, live: () => c.state.combatants[me.id]! };
}

describe('the 4th-level tier', () => {
  it('gives every caster something to put in the slot', () => {
    // THE defect. The cleric could cast exactly one 4th-level spell at the level
    // cap; a tier with one choice is not a tier.
    for (const [id, cls] of Object.entries(CLASSES)) {
      const sc = cls.spellcasting;
      if (!sc || (sc.slotsByLevel[6]?.length ?? 0) < 4) continue;   // no 4th slot
      const l4 = Object.values(sc.spellsByLevel).flat().filter((s) => SPELLS[s]?.level === 4);
      expect(l4.length, `${id} has ${l4.length} 4th-level spells`).toBeGreaterThanOrEqual(3);
    }
  });

  it('only gives a 4th-level list to classes that get a 4th-level slot', () => {
    // The other half: a half-caster with 4th-level spells it can never cast is
    // dead data of exactly the kind this codebase keeps finding.
    for (const [id, cls] of Object.entries(CLASSES)) {
      const sc = cls.spellcasting;
      if (!sc) continue;
      const hasSlot = (sc.slotsByLevel[6]?.length ?? 0) >= 4;
      const l4 = Object.values(sc.spellsByLevel).flat().filter((s) => SPELLS[s]?.level === 4);
      if (!hasSlot) expect(l4, `${id} cannot cast what it is given`).toEqual([]);
    }
  });

  it('is all really 4th level', () => {
    for (const id of NEW) expect(SPELLS[id]?.level, id).toBe(4);
  });
});

describe('Greater Invisibility', () => {
  it('does not lift when its bearer attacks, where plain Hide does', () => {
    // The entire difference between this and the 2nd-level spell.
    const { c, me, live } = fight({ x: 2, y: 1 });
    live().conditions.push({ id: 'hidden', sourceId: me.id });
    endHide(live());
    expect(isHidden(live()), 'a plain hide breaks').toBe(false);

    live().conditions.push({ id: 'hidden', sourceId: me.id }, { id: 'veiled', sourceId: me.id });
    resolveAttack(c.state, me.id, 'd1', 'dagger', {});
    expect(isHidden(live()), 'the veil holds through a swing').toBe(true);
  });
});

describe('Wall of Fire', () => {
  it('lights cells that stay lit, and burns whoever walks in', () => {
    const { c, me } = fight();
    SPELLS['wall-of-fire']!.cast({
      state: c.state, casterId: me.id, slotLevel: 4, targetIds: [], positions: [{ x: 4, y: 4 }],
    });
    const lit = cellAt(c.state.grid, { x: 4, y: 4 })!.fire;
    expect(lit, 'nothing caught').toBeDefined();
    expect(lit!.sourceId).toBe(me.id);
    // The occupant took it immediately rather than waiting to walk in again.
    expect(c.state.combatants['d1']!.hp).toBeLessThan(60);
  });

  it('goes out when the caster stops concentrating', () => {
    const { c, me } = fight();
    SPELLS['wall-of-fire']!.cast({
      state: c.state, casterId: me.id, slotLevel: 4, targetIds: [], positions: [{ x: 4, y: 4 }],
    });
    expect(cellAt(c.state.grid, { x: 4, y: 4 })!.fire).toBeDefined();
    // Dropping the caster drops the wall — the same rule that clears a Web.
    dropToZero(c.state, me.id);
    expect(cellAt(c.state.grid, { x: 4, y: 4 })!.fire,
      'a wall nobody is holding up would burn for the rest of the fight').toBeUndefined();
  });
});

describe('Death Ward', () => {
  it('turns the blow that would drop you into 1 hit point, once', () => {
    const { c, me, live } = fight();
    live().conditions.push({ id: 'deathWarded', sourceId: me.id });
    live().hp = 0;
    dropToZero(c.state, me.id);
    expect(live().hp, 'the ward did not catch it').toBe(1);
    expect(live().conditions.some((k) => k.id === 'deathWarded'), 'and is spent').toBe(false);

    // The second time there is nothing left to catch it.
    live().hp = 0;
    dropToZero(c.state, me.id);
    expect(live().hp).toBe(0);
  });

  it('catches anything that reaches zero, not just a weapon', () => {
    // Read in dropToZero rather than in the damage maths, so a failed save or a
    // hazard is caught too — which is what makes it worth planning around.
    const { c, me, live } = fight();
    live().conditions.push({ id: 'deathWarded', sourceId: me.id });
    live().hp = 0;
    dropToZero(c.state, me.id);
    expect(live().hp).toBe(1);
    expect(live().alive).toBe(true);
  });
});

describe('Freedom of Movement', () => {
  it('reads the same hook the Ring of Free Action already used', () => {
    const c = caster();
    expect(wardedAgainstMagicalBinding(c, 'restrained')).toBe(false);
    c.conditions.push({ id: 'unbound', sourceId: c.id });
    expect(wardedAgainstMagicalBinding(c, 'restrained')).toBe(true);
    expect(wardedAgainstMagicalBinding(c, 'paralyzed')).toBe(true);
    // And nothing else — it is not a general condition immunity.
    expect(wardedAgainstMagicalBinding(c, 'frightened')).toBe(false);
  });

  it('frees whatever already has hold of them', () => {
    const { c, me, live } = fight();
    live().conditions.push({ id: 'restrained', sourceId: 'd1' });
    SPELLS['freedom-of-movement']!.cast({
      state: c.state, casterId: me.id, slotLevel: 4, targetIds: [me.id], positions: [],
    });
    expect(live().conditions.some((k) => k.id === 'restrained')).toBe(false);
    expect(live().conditions.some((k) => k.id === 'unbound')).toBe(true);
  });
});

describe('Dimension Door', () => {
  it('takes an adjacent ally along', () => {
    // The passenger is the point: a teleport for one saves you, a teleport for
    // two gets the wizard out of the middle.
    const me = caster('wizard', 7, { x: 1, y: 1 });
    const friend = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 2, y: 1 }, level: 7 });
    const c = new Combat({ combatants: [me, friend, foe({ x: 6, y: 6 })], seed: 4 });
    SPELLS['dimension-door']!.cast({
      state: c.state, casterId: me.id, slotLevel: 4, targetIds: [], positions: [{ x: 5, y: 1 }],
    });
    expect(c.state.combatants[me.id]!.position).toEqual({ x: 5, y: 1 });
    expect(c.state.combatants[friend.id]!.position, 'the rider takes the caster\'s old cell')
      .toEqual({ x: 1, y: 1 });
    // And the grid agrees with both of them, or the next move walks through a ghost.
    expect(cellAt(c.state.grid, { x: 5, y: 1 })!.occupantId).toBe(me.id);
    expect(cellAt(c.state.grid, { x: 1, y: 1 })!.occupantId).toBe(friend.id);
  });
});
