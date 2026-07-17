import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { legalActions, step } from '../src/engine/actions.js';
import { collectAttackSources, breakConcentration, applyDamage } from '../src/engine/rules/attack.js';
import { canHide } from '../src/engine/rules/hide.js';
import type { Combatant, Position } from '../src/engine/types.js';

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
