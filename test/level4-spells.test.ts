import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';
import { cellAt, isDown } from '../src/engine/types.js';

const caster = (classId: string, level: number, pos: { x: number; y: number }, id: string) =>
  ({ ...buildCharacter({ classId, team: 'team1' as const, position: pos, level }), id });

/** A fight where `id` is about to act, with foes wherever you put them. */
function ready(classId: string, foes: Array<[string, { x: number; y: number }]>) {
  const c = new Combat({
    seed: 4, width: 10, height: 10,
    combatants: [
      caster(classId, 7, { x: 1, y: 1 }, 'me'),
      ...foes.map(([m, p], i) => ({ ...buildMonster(m, 'team2', p), id: `f${i}` })),
    ],
  });
  let guard = 0;
  while (c.activeId !== 'me' && guard++ < 40) c.apply({ kind: 'endTurn' });
  return c;
}

describe('4th-level spells', () => {
  /**
   * The tier exists because 7th level grants a 4th-level slot. Upcasting alone
   * makes the slot spendable but gives the tier no identity — these are what
   * make it a choice rather than a bigger Fireball.
   */
  it('a 7th-level caster is offered every 4th-level spell its class grants', () => {
    for (const [classId, ids] of Object.entries({
      wizard: ['blight', 'ice-storm', 'banishment', 'phantasmal-killer'],
      cleric: ['banishment'],
      druid: ['blight', 'ice-storm'],
      bard: ['phantasmal-killer'],
    })) {
      // Granted by the class table at 7th…
      const granted = CLASSES[classId]!.spellcasting!.spellsByLevel[7] ?? [];
      for (const id of ids) expect(granted, `${classId} should grant ${id}`).toContain(id);
      // …and actually offered in a fight, which is a different question: a
      // spell can be known, prepared and still never reach legalActions.
      const c = ready(classId, [['ogre', { x: 3, y: 3 }], ['orc', { x: 4, y: 3 }]]);
      const offered = new Set(c.legalActions('me')
        .filter((a) => a.kind === 'castSpell').map((a) => (a as { spellId: string }).spellId));
      const prepared = new Set(c.state.combatants['me']!.spellIds);
      for (const id of ids) {
        if (!prepared.has(id)) continue;   // not in this character's prepared set
        expect(offered, `${classId} prepared ${id} but was never offered it`).toContain(id);
      }
    }
  });

  it('all four are 4th level and cost a 4th-level slot', () => {
    for (const id of ['blight', 'ice-storm', 'banishment', 'phantasmal-killer']) {
      expect(SPELLS[id], `${id} missing`).toBeDefined();
      expect(SPELLS[id]!.level, id).toBe(4);
    }
  });

  it('Blight burns one target and the save halves it', () => {
    const c = ready('druid', [['ogre', { x: 2, y: 2 }]]);
    const me = c.state.combatants['me']!;
    me.spellIds = [...me.spellIds, 'blight'];
    const cast = c.legalActions('me').find((a) => a.kind === 'castSpell' && a.spellId === 'blight');
    expect(cast, 'Blight was not offered').toBeDefined();
    const events = c.apply(cast!);
    const save = events.find((e) => e.type === 'savingThrow');
    const dmg = events.find((e) => e.type === 'damageDealt');
    expect(save && 'ability' in save ? save.ability : undefined).toBe('con');
    expect(dmg && 'damageType' in dmg ? dmg.damageType : undefined).toBe('necrotic');
    expect(dmg && 'amount' in dmg ? dmg.amount : 0).toBeGreaterThan(0);
  });

  it('Ice Storm hits an area and leaves the ground difficult to cross', () => {
    const c = ready('wizard', [['orc', { x: 5, y: 5 }], ['orc', { x: 6, y: 5 }]]);
    const me = c.state.combatants['me']!;
    me.spellIds = [...me.spellIds, 'ice-storm'];
    const cast = c.legalActions('me')
      .find((a) => a.kind === 'castSpell' && a.spellId === 'ice-storm' &&
        a.targets.some((t) => 'position' in t && t.position.x === 5 && t.position.y === 5));
    expect(cast, 'Ice Storm was not offered at the orcs').toBeDefined();
    const events = c.apply(cast!);
    expect(events.filter((e) => e.type === 'damageDealt').length, 'caught nobody').toBeGreaterThan(1);
    // An OVERLAY, not a rewrite of the terrain: the first version overwrote it,
    // which made the ice permanent and ate whatever was underneath.
    expect(cellAt(c.state.grid, { x: 5, y: 5 })!.chilled).toBeDefined();
    expect(cellAt(c.state.grid, { x: 5, y: 5 })!.terrain).toBe('open');
  });

  it('Ice Storm leaves the ground underneath it intact', () => {
    // Walls are not frozen at all, and a hazard stays a hazard with ice on top
    // — the overlay never destroys what the map put there.
    const c = ready('wizard', [['orc', { x: 5, y: 5 }]]);
    cellAt(c.state.grid, { x: 6, y: 5 })!.terrain = 'wall';
    cellAt(c.state.grid, { x: 5, y: 6 })!.terrain = 'hazard';
    const me = c.state.combatants['me']!;
    me.spellIds = [...me.spellIds, 'ice-storm'];
    const cast = c.legalActions('me')
      .find((a) => a.kind === 'castSpell' && a.spellId === 'ice-storm' &&
        a.targets.some((t) => 'position' in t && t.position.x === 5 && t.position.y === 5));
    if (!cast) return;
    c.apply(cast);
    expect(cellAt(c.state.grid, { x: 6, y: 5 })!.terrain).toBe('wall');
    expect(cellAt(c.state.grid, { x: 6, y: 5 })!.chilled, 'a wall should not ice over').toBeUndefined();
    expect(cellAt(c.state.grid, { x: 5, y: 6 })!.terrain).toBe('hazard');
  });

  it('Banishment takes a creature out of the fight, not down to 0', () => {
    // charmAway, the same route Suggestion uses — so a banished creature takes
    // its summons and whatever it had charmed with it.
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed, width: 10, height: 10,
        combatants: [
          caster('wizard', 7, { x: 1, y: 1 }, 'me'),
          { ...buildMonster('orc', 'team2', { x: 3, y: 3 }), id: 'foe' },
          { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'foe2' },
        ],
      });
      let guard = 0;
      while (c.activeId !== 'me' && guard++ < 40) c.apply({ kind: 'endTurn' });
      const me = c.state.combatants['me']!;
      me.spellIds = [...me.spellIds, 'banishment'];
      const cast = c.legalActions('me')
        .find((a) => a.kind === 'castSpell' && a.spellId === 'banishment' &&
          a.targets.some((t) => 'combatantId' in t && t.combatantId === 'foe'));
      if (!cast) continue;
      const events = c.apply(cast);
      if (!events.some((e) => e.type === 'charmedAway')) continue;   // it saved
      // Removed, not killed: the distinction is the event, not the hit points
      // — charmAway zeroes those the same way a death does. What matters is
      // that nothing reports a kill, so nothing downstream treats it as one.
      expect(c.state.combatants['foe']!.alive, 'banished should be out of the fight').toBe(false);
      expect(events.some((e) => e.type === 'died'), 'banishment should not read as a kill').toBe(false);
      return;
    }
    throw new Error('the orc never failed a Banishment save across 40 seeds');
  });

  it('Phantasmal Killer hurts and frightens, and the fear is held by concentration', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed, width: 10, height: 10,
        combatants: [
          caster('bard', 7, { x: 1, y: 1 }, 'me'),
          // An ogre, not an orc: 4d10 psychic averages 22 and an orc has 15 hit
          // points, so the target dies before the fear can land and the spell
          // looks broken when it is simply lethal.
          { ...buildMonster('ogre', 'team2', { x: 4, y: 4 }), id: 'foe' },
        ],
      });
      let guard = 0;
      while (c.activeId !== 'me' && guard++ < 40) c.apply({ kind: 'endTurn' });
      const me = c.state.combatants['me']!;
      me.spellIds = [...me.spellIds, 'phantasmal-killer'];
      const cast = c.legalActions('me').find((a) => a.kind === 'castSpell' && a.spellId === 'phantasmal-killer');
      if (!cast) continue;
      const events = c.apply(cast);
      expect(events.some((e) => e.type === 'damageDealt'), 'no psychic damage').toBe(true);
      const foe = c.state.combatants['foe']!;
      if (!foe.conditions.some((k) => k.id === 'frightened')) continue;   // it saved
      expect(c.state.combatants['me']!.concentratingOn?.spellId).toBe('phantasmal-killer');
      expect(isDown(foe) || foe.alive).toBe(true);
      return;
    }
    throw new Error('the orc never failed a Phantasmal Killer save across 40 seeds');
  });
});

describe('Ice Storm thaws', () => {
  it('the ice is gone a round later, and the map is unchanged', () => {
    const wiz = { ...buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 1, y: 1 }, level: 7 }), id: 'me' };
    const c = new Combat({
      seed: 4, width: 10, height: 10,
      combatants: [wiz,
        { ...buildMonster('troll', 'team2', { x: 5, y: 5 }), id: 'f0' },
        { ...buildMonster('troll', 'team2', { x: 6, y: 5 }), id: 'f1' }],
    });
    let guard = 0;
    while (c.activeId !== 'me' && guard++ < 40) c.apply({ kind: 'endTurn' });
    c.state.combatants['me']!.spellIds = [...c.state.combatants['me']!.spellIds, 'ice-storm'];
    const cast = c.legalActions('me').find((a) => a.kind === 'castSpell' && a.spellId === 'ice-storm' &&
      a.targets.some((t) => 'position' in t && t.position.x === 5 && t.position.y === 5));
    expect(cast).toBeDefined();
    c.apply(cast!);
    const at = () => cellAt(c.state.grid, { x: 5, y: 5 })!;
    expect(at().chilled).toBeDefined();
    const start = c.state.round;
    for (let i = 0; i < 600 && c.state.round <= start + 3 && !c.isOver(); i++) c.apply({ kind: 'endTurn' });
    expect(at().chilled, 'the ice never melted').toBeUndefined();
    expect(at().terrain, 'the ground under it was destroyed').toBe('open');
  });
});
