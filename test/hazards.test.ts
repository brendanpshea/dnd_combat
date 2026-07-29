/**
 * A hazard is whatever the ground is, not one constant.
 *
 * `terrain: 'hazard'` used to mean 1d4 fire everywhere — in a volcano, a
 * graveyard, a market square and a bramble thicket alike. That was wrong about
 * D&D (lava is not a scratch) and wrong about the fiction the board had already
 * been given: five different hazards were drawn and all five burned you for the
 * same 1d4.
 *
 * It was also the reason a shove into fire never beat swinging a sword. The
 * honest conclusion from that measurement was that the HAZARD was too small,
 * not that shove was underpriced — so this is the fix for it.
 */
import { describe, it, expect } from 'vitest';
import { HAZARDS, hazardFor, DEFAULT_HAZARD } from '../src/data/hazards.js';
import { hazardMaxFor, enterHazard } from '../src/engine/rules/movement.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { MAPS, parseMap } from '../src/data/maps.js';
import { parseDice } from '../src/engine/dice.js';
import type { MapTheme } from '../src/data/maps.js';
import type { Combatant } from '../src/engine/types.js';

const THEMES: MapTheme[] = ['stone', 'forest', 'graveyard', 'ember', 'village', 'bog'];
const avg = (expr: string) => { const d = parseDice(expr); return d.count * (d.sides + 1) / 2 + d.bonus; };

function board(theme: MapTheme) {
  const me: Combatant = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
  const foe = { ...buildMonster('orc', 'team2', { x: 7, y: 7 }), id: 'foe' };
  const c = new Combat({ combatants: [me, foe], seed: 7, mapId: 'open' });
  c.state.grid.theme = theme;
  return { c, me: c.state.combatants[me.id]!, meId: me.id };
}

describe('every theme has its own hazard', () => {
  it('covers all six', () => {
    for (const t of THEMES) expect(HAZARDS[t], t).toBeDefined();
  });

  it('makes lava genuinely dangerous', () => {
    // The whole point. A hazard you can stroll through for two hit points is a
    // texture, not a hazard — and it was why shoving somebody into fire never
    // beat hitting them.
    const { c, me } = board('ember');
    expect(hazardMaxFor(me, c.state.grid)).toBeGreaterThanOrEqual(15);
  });

  it('keeps brambles cheap, and catching instead', () => {
    // "bramble shouldn't be deadly, but it might restrain" — the damage is a
    // scratch and the rider is the real cost.
    const thorns = HAZARDS.forest;
    expect(avg(thorns.damage)).toBeLessThan(avg(HAZARDS.ember.damage) / 3);
    expect(thorns.rider?.condition).toBe('restrained');
  });

  it('does not deal fire damage in a bramble thicket', () => {
    // Every hazard used to be fire, so a dragonborn shrugged off a thorn bush.
    expect(HAZARDS.forest.damageType).not.toBe('fire');
    expect(HAZARDS.bog.damageType).not.toBe('fire');
    expect(HAZARDS.graveyard.damageType).not.toBe('fire');
  });

  it('falls back to the molten default on a grid with no theme', () => {
    const c = new Combat({
      combatants: [
        buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 } }),
        { ...buildMonster('orc', 'team2', { x: 7, y: 7 }), id: 'foe' },
      ], seed: 1,
    });
    expect(c.state.grid.theme).toBeUndefined();
    expect(hazardFor(undefined)).toBe(DEFAULT_HAZARD);
  });
});

describe('walking into one', () => {
  it('always deals its damage', () => {
    const { c, meId } = board('ember');
    const before = c.state.combatants[meId]!.hp;
    enterHazard(c.state, meId);
    expect(c.state.combatants[meId]!.hp).toBeLessThan(before);
  });

  it('applies the rider on a failed save, and only the rider is saveable', () => {
    /**
     * One rule to hold: you always get burned, you might get caught.
     *
     * Looped over seeds rather than rigged to auto-fail, because it cannot be
     * rigged — the save is a d20 and a proficient level-5 fighter clears DC 12
     * often enough that a single seed proves nothing either way. The damage
     * assertion runs on every iteration; the rider assertion only needs to land
     * once.
     */
    let caught = false;
    for (let seed = 1; seed <= 40 && !caught; seed++) {
      const me: Combatant = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 }, level: 5 });
      const c = new Combat({
        combatants: [me, { ...buildMonster('orc', 'team2', { x: 7, y: 7 }), id: 'foe' }],
        seed, mapId: 'open',
      });
      c.state.grid.theme = 'forest';
      const live = c.state.combatants[me.id]!;
      const before = live.hp;
      const events = enterHazard(c.state, me.id);
      expect(live.hp, 'damage is never saveable').toBeLessThan(before);
      expect(events.some((e) => e.type === 'savingThrow'), 'the rider is rolled for').toBe(true);
      if (live.conditions.some((k) => k.id === 'restrained')) caught = true;
    }
    expect(caught, 'brambles never caught anybody in 40 seeds — check the DC').toBe(true);
  });

  it('leaves no rider where the hazard has none', () => {
    const { c, meId } = board('ember');
    const events = enterHazard(c.state, meId);
    expect(events.some((e) => e.type === 'savingThrow')).toBe(false);
  });
});

describe('the map generator actually places them', () => {
  it('gives every theme a hazard rate above zero', async () => {
    /**
     * Four of the six were zero. Defensible while every hazard was the same 1d4
     * of fire — a lava tile in a graveyard is nonsense — and dead data the
     * moment each theme got its own: brambles, grave gas and burning wreckage
     * were written, drawn, and generated exactly never.
     */
    const { THEME_SCATTER } = await import('../src/arena/map.js') as unknown as
      { THEME_SCATTER: Record<MapTheme, { hazard: number }> };
    for (const t of THEMES) {
      expect(THEME_SCATTER[t].hazard, `${t} never spawns the hazard it has art and rules for`)
        .toBeGreaterThan(0);
    }
  });
});

describe('the simulation harnesses fight on the real board', () => {
  it('passes the wave map to Combat', async () => {
    /**
     * THE HARNESS BUG THIS EXISTS FOR.
     *
     * `startCombat` falls back to `makeGrid(8, 8)` when given no map — a bare
     * grid with no walls, no cover, no difficult ground and no hazards. Both
     * arena scripts omitted it, so every fight either of them ever simulated
     * was fought on an empty box while the generated board sat unused beside
     * it. The web arena passes it, so the GAME was always fine; the
     * measurements were of somewhere else.
     *
     * It hid everything terrain-shaped: cover, the map generator, hazards, and
     * the creep check that reads `canCreepIn(wave.map)` for a board nobody then
     * fought on. Read as source, because running a whole arena run inside a unit
     * test to observe a grid is not a trade worth making.
     */
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    for (const script of ['arena-eda.ts', 'arena-run.ts']) {
      const src = readFileSync(fileURLToPath(new URL(`../scripts/${script}`, import.meta.url)), 'utf8');
      const setup = src.slice(src.indexOf('new Combat({'), src.indexOf('new Combat({') + 900);
      expect(setup, `${script} fights on a bare grid, not the wave's map`).toContain('map: wave.map');
    }
  });

  it('and the real maps are deeper than the box it used to assume', () => {
    // The other half: the foes were dropped on a hardcoded rank 6, which is a
    // sensible back rank on an 8x8 box and the MIDDLE of a real arena board.
    const anyArena = parseMap(MAPS.firepit ?? Object.values(MAPS)[0]!);
    expect(anyArena.height).toBeGreaterThan(0);
    // A hand-authored map carries its theme through, which is what lets a
    // hazard know what it is.
    expect(parseMap(MAPS.firepit!).theme).toBe('ember');
  });
});
