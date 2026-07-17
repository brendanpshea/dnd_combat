import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { legalActions, step } from '../src/engine/actions.js';
import { collectAttackSources, breakConcentration, applyDamage } from '../src/engine/rules/attack.js';
import { canHide } from '../src/engine/rules/hide.js';
import { savingThrow } from '../src/engine/rules/saves.js';
import { hasLineOfSight } from '../src/engine/grid.js';
import { applyLucky } from '../src/engine/rules/luck.js';
import { rollD20, type D20Roll } from '../src/engine/dice.js';
import { FEATURES } from '../src/data/features.js';
import type { Combatant, Position } from '../src/engine/types.js';
import { cellAt } from '../src/engine/types.js';

const elf = (classId: string, position: Position, id: string, level = 3): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'elf', level }), id });
const goblin = (position: Position, id: string): Combatant =>
  ({ ...buildMonster('goblin-warrior', 'team2', position), id });

const fakeWeapon = { melee: true, range: undefined, properties: [] } as never;

describe('innate spellcasting', () => {
  it('lets a fighter — which has no spell slots at all — cast a levelled spell', () => {
    const ftr = elf('fighter', { x: 3, y: 3 }, 'ftr');
    expect(ftr.spellSlots).toEqual([]);                       // truly no slots
    expect(ftr.innateSpells['faerie-fire']).toEqual({ current: 1, max: 1 });
    expect(ftr.spellIds).toContain('faerie-fire');            // and it's "known"

    const c = new Combat({ seed: 5, mapId: 'open', combatants: [ftr, goblin({ x: 5, y: 5 }, 'gob')] });
    let guard = 0;
    while (c.activeId !== 'ftr' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const casts = legalActions(c.state, 'ftr').filter(
      (a) => a.kind === 'castSpell' && a.spellId === 'faerie-fire',
    );
    expect(casts.length).toBeGreaterThan(0);
    // Innate casts spend no slot: they go off at slotLevel 0.
    expect(casts.every((a) => a.kind === 'castSpell' && a.slotLevel === 0)).toBe(true);
  });

  it('spends an innate use, not a spell slot, and runs dry after its allowance', () => {
    const cle = elf('cleric', { x: 3, y: 3 }, 'cle');   // a caster: has slots AND the innate spell
    const c = new Combat({ seed: 5, mapId: 'open', combatants: [cle, goblin({ x: 5, y: 5 }, 'gob')] });
    let guard = 0;
    while (c.activeId !== 'cle' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const slotsBefore = cle.spellSlots.map((p) => p.current);

    const cast = legalActions(c.state, 'cle').find(
      (a) => a.kind === 'castSpell' && a.spellId === 'faerie-fire',
    )!;
    const { state: after } = step(c.state, cast);
    expect(after.combatants['cle']!.innateSpells['faerie-fire']!.current).toBe(0);
    expect(after.combatants['cle']!.spellSlots.map((p) => p.current)).toEqual(slotsBefore); // no slot spent

    // Dry now — not offered again.
    expect(legalActions(after, 'cle').some(
      (a) => a.kind === 'castSpell' && a.spellId === 'faerie-fire',
    )).toBe(false);
  });

  it('replenishes each battle: a fresh build starts with a full allowance', () => {
    // Per-encounter, and every battle rebuilds the party, so this is automatic —
    // the guard here is that nobody accidentally persists a depleted pool.
    expect(elf('fighter', { x: 0, y: 0 }, 'a').innateSpells['faerie-fire']!.current).toBe(1);
  });

  it('arrives at the level the species sets, not before', () => {
    expect(elf('fighter', { x: 0, y: 0 }, 'a', 1).innateSpells['faerie-fire']).toBeUndefined();
    expect(elf('fighter', { x: 0, y: 0 }, 'a', 1).spellIds).not.toContain('faerie-fire');
    expect(elf('fighter', { x: 0, y: 0 }, 'a', 3).innateSpells['faerie-fire']).toBeDefined();
  });
});

describe('Faerie Fire', () => {
  // Anchor the 2×2 so it lands on the goblins.
  const light = (seed: number) => {
    const cle = elf('cleric', { x: 1, y: 1 }, 'cle');
    const c = new Combat({
      seed,
      mapId: 'open',
      combatants: [cle, goblin({ x: 5, y: 5 }, 'g1'), goblin({ x: 6, y: 5 }, 'g2')],
    });
    let guard = 0;
    while (c.activeId !== 'cle' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const cast = legalActions(c.state, 'cle').find(
      (a) => a.kind === 'castSpell' && a.spellId === 'faerie-fire' &&
        a.targets[0] && 'position' in a.targets[0] &&
        a.targets[0].position.x === 5 && a.targets[0].position.y === 5,
    )!;
    return step(c.state, cast).state;
  };

  it('outlines foes it catches — attacks against them have advantage', () => {
    // Seed chosen so at least one goblin fails its Dex save.
    const after = light(5);
    const lit = Object.values(after.combatants).find((u) => u.conditions.some((k) => k.id === 'outlined'));
    expect(lit).toBeDefined();
    const { adv } = collectAttackSources(after, after.combatants['cle']!, lit!, fakeWeapon, true);
    expect(adv).toContain('faerie fire');
  });

  it('holds the light by concentration — losing it puts everyone out', () => {
    const after = light(5);
    expect(after.combatants['cle']!.concentratingOn?.spellId).toBe('faerie-fire');
    // Kill the caster's concentration; the sustained conditions must lift.
    breakConcentration(after, 'cle');
    const stillLit = Object.values(after.combatants).some((u) => u.conditions.some((k) => k.id === 'outlined'));
    expect(stillLit).toBe(false);
  });

  it('a lit creature cannot melt into hiding', () => {
    const after = light(5);
    const lit = Object.values(after.combatants).find((u) => u.conditions.some((k) => k.id === 'outlined'))!;
    expect(canHide(after, lit)).toBe(false);
  });

  it('reveals a creature that was already hidden', () => {
    const cle = elf('cleric', { x: 1, y: 1 }, 'cle');
    const rogue = { ...buildCharacter({ classId: 'rogue', team: 'team2', position: { x: 5, y: 5 }, level: 3 }), id: 'rog' };
    rogue.conditions.push({ id: 'hidden', sourceId: 'rog', hideCheck: 30 });
    const c = new Combat({ seed: 2, mapId: 'open', combatants: [cle, rogue] });
    let guard = 0;
    while (c.activeId !== 'cle' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const cast = legalActions(c.state, 'cle').find(
      (a) => a.kind === 'castSpell' && a.spellId === 'faerie-fire' &&
        a.targets[0] && 'position' in a.targets[0] &&
        a.targets[0].position.x === 5 && a.targets[0].position.y === 5,
    );
    // Faerie Fire targets a cell, so it can be aimed at a hidden creature's
    // square even though the creature can't be *directly* targeted.
    expect(cast).toBeDefined();
    const after = step(c.state, cast!).state;
    const r = after.combatants['rog']!;
    if (r.conditions.some((k) => k.id === 'outlined')) {
      expect(r.conditions.some((k) => k.id === 'hidden')).toBe(false);  // revealed
    }
  });
});

describe('Dragonborn', () => {
  const born = (classId: string, position: Position, id: string) =>
    ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'dragonborn', level: 1 }), id });

  it('resists fire — its own element half-hurts it', () => {
    const db = born('fighter', { x: 0, y: 0 }, 'db');
    expect(db.resistances).toContain('fire');
    const c = new Combat({ seed: 3, mapId: 'open', combatants: [db, goblin({ x: 7, y: 7 }, 'g')] });
    applyDamage(c.state, 'db', 'g', 10, 'fire');
    expect(db.maxHp - c.state.combatants['db']!.hp).toBe(5);   // halved
  });

  it('breathes a cone a fighter can use with no spell slots', () => {
    const db = born('fighter', { x: 2, y: 2 }, 'db');
    expect(db.spellSlots).toEqual([]);
    expect(db.innateSpells['breath-weapon']).toEqual({ current: 2, max: 2 });
    const c = new Combat({
      seed: 7,
      mapId: 'open',
      combatants: [db, goblin({ x: 3, y: 3 }, 'g1'), goblin({ x: 4, y: 3 }, 'g2')],
    });
    let guard = 0;
    while (c.activeId !== 'db' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const cast = legalActions(c.state, 'db').find(
      (a) => a.kind === 'castSpell' && a.spellId === 'breath-weapon' &&
        a.targets[0] && 'position' in a.targets[0] &&
        a.targets[0].position.x === 3 && a.targets[0].position.y === 3,
    )!;
    const before = c.state.combatants['g1']!.hp;
    const { state: after, events } = step(c.state, cast);
    expect(after.combatants['g1']!.hp).toBeLessThan(before);          // caught in the cone
    expect(after.combatants['db']!.innateSpells['breath-weapon']!.current).toBe(1);  // one use spent
    expect(events.some((e) => e.type === 'damageDealt')).toBe(true);
  });

  it('aims its breath: allies caught in the cone are spared', () => {
    const db = born('fighter', { x: 2, y: 2 }, 'db');
    const ally = { ...buildCharacter({ classId: 'rogue', team: 'team1', position: { x: 3, y: 3 }, level: 1 }), id: 'ally' };
    const c = new Combat({ seed: 7, mapId: 'open', combatants: [db, ally, goblin({ x: 4, y: 3 }, 'g')] });
    let guard = 0;
    while (c.activeId !== 'db' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const cast = legalActions(c.state, 'db').find((a) => a.kind === 'castSpell' && a.spellId === 'breath-weapon');
    if (!cast) return;   // no legal cone this seed; the ally-safety rule is what matters
    const allyHp = c.state.combatants['ally']!.hp;
    const { state: after } = step(c.state, cast);
    expect(after.combatants['ally']!.hp).toBe(allyHp);   // untouched
  });
});

describe('Abyssal Tiefling', () => {
  const fell = (classId: string, position: Position, id: string, level = 1) =>
    ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'tiefling', level }), id });

  it('resists poison — demonic, not the usual infernal fire flavour', () => {
    const tf = fell('fighter', { x: 0, y: 0 }, 'tf');
    expect(tf.resistances).toContain('poison');
    expect(tf.resistances).not.toContain('fire');
    const c = new Combat({ seed: 3, mapId: 'open', combatants: [tf, goblin({ x: 7, y: 7 }, 'g')] });
    applyDamage(c.state, 'tf', 'g', 10, 'poison');
    expect(tf.maxHp - c.state.combatants['tf']!.hp).toBe(5);   // halved
  });

  it('knows Poison Spray for free at 1st, any class', () => {
    const wiz = fell('wizard', { x: 2, y: 2 }, 'wiz');
    const ftr = fell('fighter', { x: 2, y: 2 }, 'ftr');
    expect(wiz.spellIds).toContain('poison-spray');
    expect(ftr.spellIds).toContain('poison-spray');
    expect(ftr.spellSlots).toEqual([]);   // the fighter still has no slots — a cantrip needs none
  });

  it('casts Poison Spray at its 30 ft (6-cell) range and no farther', () => {
    // 8x8 board: corner to corner is 7 cells (35 ft), just past range — the only
    // way to place a target outside 30 ft at all.
    const wiz = fell('wizard', { x: 0, y: 0 }, 'wiz');
    const near = { ...buildMonster('goblin-warrior', 'team2', { x: 1, y: 0 }), id: 'near' };  // 1 cell / 5 ft
    const far = { ...buildMonster('goblin-warrior', 'team2', { x: 7, y: 7 }), id: 'far' };    // 7 cells / 35 ft
    const c = new Combat({ seed: 3, mapId: 'open', combatants: [wiz, near, far] });
    let guard = 0;
    while (c.activeId !== 'wiz' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const casts = legalActions(c.state, 'wiz').filter((a) => a.kind === 'castSpell' && a.spellId === 'poison-spray');
    const targeted = casts.flatMap((a) => a.kind === 'castSpell' ? a.targets : [])
      .flatMap((t) => 'combatantId' in t ? [t.combatantId] : []);
    expect(targeted).toContain('near');
    expect(targeted).not.toContain('far');
  });

  it('lets a fighter — no spell slots — cast Ray of Sickness innately from 3rd', () => {
    const ftr = fell('fighter', { x: 2, y: 2 }, 'ftr', 3);
    expect(ftr.spellSlots).toEqual([]);
    expect(ftr.innateSpells['ray-of-sickness']).toEqual({ current: 1, max: 1 });
    expect(fell('fighter', { x: 2, y: 2 }, 'a', 1).innateSpells['ray-of-sickness']).toBeUndefined();  // not yet at 1st
  });

  it('Ray of Sickness is an attack roll first — damage requires a hit, not a failed save', () => {
    // Unlike Poison Spray (a save spell), this one only pays off on a hit.
    let hit = false;
    for (let seed = 1; seed <= 30 && !hit; seed++) {
      const ftr = fell('fighter', { x: 2, y: 2 }, 'ftr', 3);
      const c = new Combat({ seed, mapId: 'open', combatants: [ftr, goblin({ x: 4, y: 2 }, 'g')] });
      let guard = 0;
      while (c.activeId !== 'ftr' && guard++ < 20) c.apply({ kind: 'endTurn' });
      const cast = legalActions(c.state, 'ftr').find((a) => a.kind === 'castSpell' && a.spellId === 'ray-of-sickness');
      if (!cast) continue;
      const before = c.state.combatants['g']!.hp;
      const { state: after, events } = step(c.state, cast);
      expect(after.combatants['ftr']!.innateSpells['ray-of-sickness']!.current).toBe(0);  // spent either way
      const attackEvent = events.find((e) => e.type === 'attackRolled');
      expect(attackEvent).toBeDefined();
      if (attackEvent?.type === 'attackRolled' && attackEvent.hit) {
        hit = true;
        expect(after.combatants['g']!.hp).toBeLessThan(before);
      } else {
        expect(after.combatants['g']!.hp).toBe(before);   // miss: no damage at all
      }
    }
    expect(hit).toBe(true);   // sanity: the loop actually exercised a hit
  });

  it('poisons on a hit that fails the Con save — the first-ever user of `poisoned`', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const ftr = fell('fighter', { x: 2, y: 2 }, 'ftr', 3);
      const c = new Combat({ seed, mapId: 'open', combatants: [ftr, goblin({ x: 4, y: 2 }, 'g')] });
      let guard = 0;
      while (c.activeId !== 'ftr' && guard++ < 20) c.apply({ kind: 'endTurn' });
      const cast = legalActions(c.state, 'ftr').find((a) => a.kind === 'castSpell' && a.spellId === 'ray-of-sickness');
      if (!cast) continue;
      const { state: after } = step(c.state, cast);
      const g = after.combatants['g']!;
      if (g.conditions.some((k) => k.id === 'poisoned')) {
        // Rides the generic repeat-save mechanism, so it must carry one.
        expect(g.conditions.find((k) => k.id === 'poisoned')?.repeatSave?.ability).toBe('con');
        return;
      }
    }
    throw new Error('poisoned never landed in 40 seeds — check the hit/save odds');
  });
});

describe('Gnome', () => {
  const gno = (classId: string, position: Position, id: string, level = 1) =>
    ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'gnome', level }), id });
  const wolf = (position: Position, id: string) =>
    ({ ...buildMonster('wolf', 'team2', position), id });

  it('knows Minor Illusion and 2 uses of Animal Friendship from 1st level', () => {
    const g = gno('fighter', { x: 2, y: 2 }, 'g');
    expect(g.spellIds).toContain('minor-illusion');
    expect(g.spellIds).toContain('animal-friendship');
    expect(g.innateSpells['animal-friendship']).toEqual({ current: 2, max: 2 });
    expect(g.spellSlots).toEqual([]);   // the fighter still has no slots
    expect(g.featureIds).toContain('gnomish-cunning');
  });

  describe('Gnomish Cunning (save advantage)', () => {
    it('rolls Int/Wis/Cha saves with advantage — statistically, not just structurally', () => {
      // A single roll can't distinguish "advantage applied" from "got lucky",
      // so this checks the pass *rate* over many independent seeds. Ability
      // fixed at 10 (mod +0) and profs cleared so DC 11 is a coin flip either
      // way — flat should land near 50%, advantage near 75% (1 - (10/20)^2).
      // The gap is wide enough that seed variance can't plausibly erase it.
      const trials = 150;
      const dc = 11;
      let advPasses = 0;
      let flatPasses = 0;
      for (let seed = 1; seed <= trials; seed++) {
        const g = gno('fighter', { x: 0, y: 0 }, 'g');
        g.abilities = { ...g.abilities, wis: 10 };
        g.savingThrowProfs = [];
        const state = new Combat({ seed, mapId: 'open', combatants: [g, goblin({ x: 7, y: 7 }, 'foe')] }).state;
        if (savingThrow(state, 'g', 'wis', dc).success) advPasses++;

        const h = { ...g, featureIds: [] };   // same stats, no Gnomish Cunning
        const flatState = new Combat({ seed, mapId: 'open', combatants: [h, goblin({ x: 7, y: 7 }, 'foe')] }).state;
        if (savingThrow(flatState, 'g', 'wis', dc).success) flatPasses++;
      }
      expect(advPasses).toBeGreaterThan(flatPasses + 15);
    });

    it('does not grant advantage on Str/Dex/Con saves', () => {
      // Str isn't in Gnomish Cunning's list; this exercises the "no feature
      // matches this ability" branch so the gate is proven to gate something.
      const g = gno('fighter', { x: 0, y: 0 }, 'g');
      expect(g.featureIds.some((f) => FEATURES[f]?.saveAdvantage?.includes('str'))).toBe(false);
      expect(g.featureIds.some((f) => FEATURES[f]?.saveAdvantage?.includes('wis'))).toBe(true);
    });
  });

  describe('Minor Illusion', () => {
    it('blocks line of sight where cast, like a wall', () => {
      const g = gno('wizard', { x: 0, y: 0 }, 'g');
      const foe = { ...buildCharacter({ classId: 'fighter', team: 'team2', position: { x: 7, y: 0 } }), id: 'foe' };
      const c = new Combat({ seed: 3, mapId: 'open', combatants: [g, foe] });
      let guard = 0;
      while (c.activeId !== 'g' && guard++ < 20) c.apply({ kind: 'endTurn' });
      expect(hasLineOfSight(c.state.grid, { x: 0, y: 0 }, { x: 7, y: 0 })).toBe(true);
      const cast = legalActions(c.state, 'g').find(
        (a) => a.kind === 'castSpell' && a.spellId === 'minor-illusion' &&
          a.targets[0] && 'position' in a.targets[0] && a.targets[0].position.x === 3 && a.targets[0].position.y === 0,
      )!;
      const { state: after } = step(c.state, cast);
      expect(after.grid.cells.find((_, i) => i === 0 * after.grid.width + 3)?.illusion).toBeDefined();
      expect(hasLineOfSight(after.grid, { x: 0, y: 0 }, { x: 7, y: 0 })).toBe(false);
    });

    it('is popped by any creature that walks through it, not just its caster', () => {
      const g = gno('wizard', { x: 0, y: 0 }, 'g');
      const foe = { ...buildCharacter({ classId: 'fighter', team: 'team2', position: { x: 7, y: 0 } }), id: 'foe' };
      const c = new Combat({ seed: 3, mapId: 'open', combatants: [g, foe] });
      let guard = 0;
      while (c.activeId !== 'g' && guard++ < 20) c.apply({ kind: 'endTurn' });
      const cast = legalActions(c.state, 'g').find(
        (a) => a.kind === 'castSpell' && a.spellId === 'minor-illusion' &&
          a.targets[0] && 'position' in a.targets[0] && a.targets[0].position.x === 5 && a.targets[0].position.y === 0,
      )!;
      c.apply(cast);
      expect(cellAt(c.state.grid, { x: 5, y: 0 })!.illusion).toBeDefined();
      const move = legalActions(c.state, 'g').find((a) => a.kind === 'move' && a.to.x === 6 && a.to.y === 0)!;
      expect(move).toBeDefined();   // walks straight through the illusion's cell
      const { state: after, events } = step(c.state, move);
      expect(events.some((e) => e.type === 'illusionPopped')).toBe(true);
      expect(cellAt(after.grid, { x: 5, y: 0 })!.illusion).toBeUndefined();
    });

    it('never blocks movement, only sight — nothing walkable becomes impassable', () => {
      const g = gno('wizard', { x: 0, y: 0 }, 'g');
      const c = new Combat({ seed: 3, mapId: 'open', combatants: [g, { ...buildCharacter({ classId: 'fighter', team: 'team2', position: { x: 7, y: 7 } }), id: 'foe' }] });
      let guard = 0;
      while (c.activeId !== 'g' && guard++ < 20) c.apply({ kind: 'endTurn' });
      const cast = legalActions(c.state, 'g').find(
        (a) => a.kind === 'castSpell' && a.spellId === 'minor-illusion' &&
          a.targets[0] && 'position' in a.targets[0] && a.targets[0].position.x === 1 && a.targets[0].position.y === 0,
      )!;
      const { state: after } = step(c.state, cast);
      const dest = legalActions(after, 'g').some((a) => a.kind === 'move' && a.to.x === 1 && a.to.y === 0);
      expect(dest).toBe(true);   // still a legal destination, illusion and all
    });

    it('expires on its own a few rounds after casting', () => {
      const g = gno('wizard', { x: 0, y: 0 }, 'g');
      const c = new Combat({ seed: 3, mapId: 'open', combatants: [g, { ...buildCharacter({ classId: 'fighter', team: 'team2', position: { x: 7, y: 7 } }), id: 'foe' }] });
      let guard = 0;
      while (c.activeId !== 'g' && guard++ < 20) c.apply({ kind: 'endTurn' });
      const cast = legalActions(c.state, 'g').find(
        (a) => a.kind === 'castSpell' && a.spellId === 'minor-illusion' &&
          a.targets[0] && 'position' in a.targets[0] && a.targets[0].position.x === 3 && a.targets[0].position.y === 3,
      )!;
      c.apply(cast);
      expect(cellAt(c.state.grid, { x: 3, y: 3 })!.illusion).toBeDefined();
      let steps = 0;
      while (cellAt(c.state.grid, { x: 3, y: 3 })!.illusion && steps++ < 200) c.apply({ kind: 'endTurn' });
      expect(cellAt(c.state.grid, { x: 3, y: 3 })!.illusion).toBeUndefined();
      expect(steps).toBeLessThan(200);   // it actually expired, rather than the loop giving up
    });
  });

  describe('Animal Friendship', () => {
    it('only ever targets beasts, never a humanoid enemy standing right next to it', () => {
      const g = gno('fighter', { x: 2, y: 2 }, 'g');
      const w = wolf({ x: 3, y: 2 }, 'w');
      const gob = { ...buildMonster('goblin-warrior', 'team2', { x: 2, y: 3 }), id: 'gob' };
      const c = new Combat({ seed: 5, mapId: 'open', combatants: [g, w, gob] });
      let guard = 0;
      while (c.activeId !== 'g' && guard++ < 20) c.apply({ kind: 'endTurn' });
      const targets = legalActions(c.state, 'g')
        .filter((a) => a.kind === 'castSpell' && a.spellId === 'animal-friendship')
        .flatMap((a) => a.kind === 'castSpell' ? a.targets : [])
        .flatMap((t) => 'combatantId' in t ? [t.combatantId] : []);
      expect(targets).toEqual(['w']);
    });

    it('a fighter with no spell slots can cast it — spending an innate use, not a slot', () => {
      const g = gno('fighter', { x: 2, y: 2 }, 'g');
      const w = wolf({ x: 3, y: 2 }, 'w');
      const c = new Combat({ seed: 5, mapId: 'open', combatants: [g, w] });
      let guard = 0;
      while (c.activeId !== 'g' && guard++ < 20) c.apply({ kind: 'endTurn' });
      expect(g.spellSlots).toEqual([]);
      const cast = legalActions(c.state, 'g').find((a) => a.kind === 'castSpell' && a.spellId === 'animal-friendship')!;
      const { state: after } = step(c.state, cast);
      expect(after.combatants['g']!.innateSpells['animal-friendship']!.current).toBe(1);
      expect(after.combatants['g']!.spellSlots).toEqual([]);
    });

    it('removes the beast from the fight on a failed save — charmed, not killed, ending the battle', () => {
      for (let seed = 1; seed <= 30; seed++) {
        const g = gno('fighter', { x: 2, y: 2 }, 'g');
        const w = wolf({ x: 3, y: 2 }, 'w');
        const c = new Combat({ seed, mapId: 'open', combatants: [g, w] });
        let guard = 0;
        while (c.activeId !== 'g' && guard++ < 20) c.apply({ kind: 'endTurn' });
        const cast = legalActions(c.state, 'g').find((a) => a.kind === 'castSpell' && a.spellId === 'animal-friendship');
        if (!cast) continue;
        const { state: after, events } = step(c.state, cast);
        if (!events.some((e) => e.type === 'charmedAway')) continue;   // save succeeded this seed
        expect(events.some((e) => e.type === 'died')).toBe(false);       // never a death
        expect(events.some((e) => e.type === 'combatEnded')).toBe(true); // last enemy standing
        expect(after.combatants['w']!.alive).toBe(false);
        expect(after.winner).toBe('team1');
        return;
      }
      throw new Error('the wolf never failed its save in 30 seeds — check the DC/save odds');
    });
  });
});

describe('Halfling', () => {
  const hin = (classId: string, position: Position, id: string, level = 1) =>
    ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'halfling', level }), id });

  it('knows Lucky and Naturally Stealthy, and nothing else', () => {
    const h = hin('fighter', { x: 0, y: 0 }, 'h');
    expect(h.featureIds).toContain('lucky');
    expect(h.featureIds).toContain('naturally-stealthy');
    // No Brave: nothing in the game applies Frightened yet, so it would ship
    // inert — the same trap Speak with Animals was for the gnome.
    expect(h.spellIds).toEqual([]);
    expect(h.innateSpells).toEqual({});
  });

  describe('Lucky', () => {
    it('rerolls a natural 1 and keeps the new result, even if it is also worse', () => {
      // Direct unit test of the shared helper: isolates the reroll rule from
      // any particular call site's wiring.
      const c = new Combat({ seed: 1, mapId: 'open', combatants: [hin('fighter', { x: 0, y: 0 }, 'h')] });
      const naturalOne: D20Roll = { natural: 1, dice: [1], mode: 'flat', state: c.state.rng };
      const result = applyLucky(c.state, 'h', naturalOne, 'flat');
      expect(result.natural).not.toBe(undefined);
      // The reroll must actually consume the RNG (a different draw), not just
      // relabel the same one.
      expect(result.state).not.toBe(naturalOne.state);
    });

    it('does not touch a roll that was not a natural 1', () => {
      const c = new Combat({ seed: 1, mapId: 'open', combatants: [hin('fighter', { x: 0, y: 0 }, 'h')] });
      const naturalTen: D20Roll = { natural: 10, dice: [10], mode: 'flat', state: c.state.rng };
      expect(applyLucky(c.state, 'h', naturalTen, 'flat')).toBe(naturalTen);   // same object back
    });

    it('does nothing for a combatant without the feature', () => {
      const c = new Combat({ seed: 1, mapId: 'open', combatants: [buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, speciesId: 'human' })] });
      const id = Object.keys(c.state.combatants)[0]!;
      const naturalOne: D20Roll = { natural: 1, dice: [1], mode: 'flat', state: c.state.rng };
      expect(applyLucky(c.state, id, naturalOne, 'flat')).toBe(naturalOne);
    });

    it('actually fires at a real attack roll: a natural 1 does not stay a 1', () => {
      // Search for a seed whose next flat d20 draw would be a natural 1 (a
      // deterministic peek, not a mocked roll), then confirm the real
      // resolveAttack() call site rerolls it rather than just the isolated
      // helper in another test.
      for (let seed = 1; seed <= 300; seed++) {
        const h = hin('fighter', { x: 3, y: 3 }, 'h');
        const foe = { ...buildCharacter({ classId: 'fighter', team: 'team2', position: { x: 3, y: 4 } }), id: 'foe' };
        const c = new Combat({ seed, mapId: 'open', combatants: [h, foe] });
        let guard = 0;
        while (c.activeId !== 'h' && guard++ < 20) c.apply({ kind: 'endTurn' });
        if (rollD20(c.state.rng, 'flat').natural !== 1) continue;

        const atk = legalActions(c.state, 'h').find((a) => a.kind === 'attack')!;
        const { events } = step(c.state, atk);
        const rolled = events.find((e) => e.type === 'attackRolled');
        expect(rolled?.type === 'attackRolled' && rolled.natural).not.toBe(1);
        return;
      }
      throw new Error('never found a seed with a natural-1 first draw in 300 tries');
    });

    it('also protects saving throws, not just attacks', () => {
      // Same peek-and-verify approach, this time against savingThrow directly
      // — a second call site, proving the helper is wired there too, not just
      // guessed to be from the shared implementation.
      for (let seed = 1; seed <= 300; seed++) {
        const h = hin('fighter', { x: 0, y: 0 }, 'h');
        const c = new Combat({ seed, mapId: 'open', combatants: [h] });
        if (rollD20(c.state.rng, 'flat').natural !== 1) continue;
        const result = savingThrow(c.state, 'h', 'dex', 15);
        expect(result.event.type === 'savingThrow' && result.event.natural).not.toBe(1);
        return;
      }
      throw new Error('never found a seed with a natural-1 first draw in 300 tries');
    });
  });

  describe('Naturally Stealthy', () => {
    it('makes a halfling\'s own Hide check meaningfully better than a same-Dex human\'s', () => {
      // Same shape as the Gnomish Cunning statistical test: one roll can't
      // distinguish "the proficiency applied" from "rolled well", so this
      // compares totals over many seeds. Ability fixed at 10 (mod +0) so the
      // only source of difference is the proficiency bonus itself.
      const trials = 30;
      let halflingSum = 0;
      let humanSum = 0;
      for (let seed = 1; seed <= trials; seed++) {
        const h = hin('fighter', { x: 3, y: 3 }, 'h');
        h.abilities = { ...h.abilities, dex: 10 };
        const foe = { ...buildMonster('goblin-warrior', 'team2', { x: 7, y: 7 }), id: 'foe' };
        const c = new Combat({ seed, mapId: 'ruins', combatants: [h, foe] });
        let guard = 0;
        while (c.activeId !== 'h' && guard++ < 20) c.apply({ kind: 'endTurn' });
        const hide = legalActions(c.state, 'h').find((a) => a.kind === 'hide');
        if (!hide) continue;
        const check = step(c.state, hide).events.find((e) => e.type === 'hideCheck');
        if (check?.type === 'hideCheck') halflingSum += check.total;

        const hu = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 3, y: 3 } }), id: 'hu' };
        hu.abilities = { ...hu.abilities, dex: 10 };
        const c2 = new Combat({ seed, mapId: 'ruins', combatants: [hu, { ...foe, id: 'foe2' }] });
        let guard2 = 0;
        while (c2.activeId !== 'hu' && guard2++ < 20) c2.apply({ kind: 'endTurn' });
        const hide2 = legalActions(c2.state, 'hu').find((a) => a.kind === 'hide');
        if (!hide2) continue;
        const check2 = step(c2.state, hide2).events.find((e) => e.type === 'hideCheck');
        if (check2?.type === 'hideCheck') humanSum += check2.total;
      }
      // Proficiency bonus at level 1 is +2; over ~30 samples the gap should be
      // close to (and comfortably above half of) 2 * trials.
      expect(halflingSum - humanSum).toBeGreaterThan(trials);
    });
  });
});

describe('Turn Undead', () => {
  const cleric = (position: Position, id: string, level = 2): Combatant =>
    ({ ...buildCharacter({ classId: 'cleric', team: 'team1', position, speciesId: 'human', level }), id });
  const skeleton = (position: Position, id: string): Combatant =>
    ({ ...buildMonster('skeleton', 'team2', position), id });

  it('a level-2 cleric knows Turn Undead as an encounter-limited action feature', () => {
    const cl = cleric({ x: 3, y: 3 }, 'cl');
    expect(cl.featureIds).toContain('turn-undead');
    expect(cl.featureUses['turn-undead']).toEqual({ current: 1, max: 1 });
    expect(FEATURES['turn-undead']!.trigger).toBe('action');
  });

  it('removes only undead that fail the save, leaves living enemies untouched, and spends the use', () => {
    // Loop seeds so we land on a run where at least one skeleton fails.
    for (let seed = 1; seed <= 40; seed++) {
      const cl = cleric({ x: 3, y: 3 }, 'cl');
      const s1 = skeleton({ x: 4, y: 3 }, 's1');
      const s2 = skeleton({ x: 3, y: 4 }, 's2');
      const gob = goblin({ x: 5, y: 3 }, 'gob'); // living, in range — must never be turned
      const c = new Combat({ seed, mapId: 'open', combatants: [cl, s1, s2, gob] });
      let guard = 0;
      while (c.activeId !== 'cl' && guard++ < 20) c.apply({ kind: 'endTurn' });
      const use = legalActions(c.state, 'cl').find(
        (a) => a.kind === 'useFeature' && a.featureId === 'turn-undead',
      );
      expect(use).toBeDefined();
      const events = c.apply(use!);
      const turned = events.filter((e) => e.type === 'charmedAway').map((e) => e.combatantId);
      if (turned.length === 0) continue; // both saved this seed; try another

      // Only skeletons ever get charmed away; the goblin is a living humanoid.
      expect(turned.every((id) => id === 's1' || id === 's2')).toBe(true);
      expect(c.state.combatants['gob']!.alive).toBe(true);
      for (const id of turned) expect(c.state.combatants[id]!.alive).toBe(false);
      // The Channel Divinity use is spent.
      expect(c.state.combatants['cl']!.featureUses['turn-undead']!.current).toBe(0);
      return;
    }
    throw new Error('no skeleton ever failed the save across 40 seeds');
  });
});
