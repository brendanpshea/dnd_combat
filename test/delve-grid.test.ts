/**
 * Every faction, on every theme it can hold, at the levels it can field, in
 * two shapes: a held place must read as a place (archetypes.ts), not a list.
 * Its rooms are named once each, most of them say what they are for, its
 * fights are neither none nor all, and no text is left with a `$` in it.
 */
import { describe, it, expect } from 'vitest';
import { generateSpecDelve, DELVE_SHAPES } from '../src/adventure/delve-spec.js';
import { FACTIONS, canHold } from '../src/data/factions.js';
import { ARCHETYPES } from '../src/data/archetypes.js';
import type { Scene } from '../src/adventure/types.js';

const LEVELS = [1, 3, 5];
const SHAPES = DELVE_SHAPES;
const SEEDS = [7, 19, 42];

const grid = Object.values(FACTIONS).flatMap((f) => f.themes.flatMap((theme) =>
  LEVELS.filter((level) => canHold(f, level)).flatMap((level) => SHAPES.flatMap((shape) => SEEDS.map((seed) => ({ f, theme, level, shape, seed }))))));

/** Each place built once, for both checks. */
const built = new Map<string, ReturnType<typeof generateSpecDelve>['module']>();
const build = (g: typeof grid[number]) => {
  const k = `${g.f.id}|${g.theme}|${g.level}|${g.shape}|${g.seed}`;
  if (!built.has(k)) built.set(k, generateSpecDelve(g.seed, { theme: g.theme, level: g.level, shape: g.shape, fights: 'inhabitants', factions: [g.f.id] }).module);
  return built.get(k)!;
};

describe('a held place, for every faction', () => {
  it('names an archetype that exists', () => {
    for (const f of Object.values(FACTIONS)) expect(ARCHETYPES[f.archetype], f.id).toBeDefined();
  });

  it.each(grid.map((g) => [`${g.f.id} in ${g.theme}, level ${g.level}, ${g.shape}, seed ${g.seed}`, g] as const))('%s', (_name, g) => {
    const module = build(g);
    const floors = Object.values(module.scenes).filter((sc): sc is Extract<Scene, { kind: 'dungeon' }> => sc.kind === 'dungeon');
    for (const { dungeon } of floors) {
      const names = dungeon.rooms.map((r) => r.name);
      expect(new Set(names).size, `names on ${dungeon.title}: ${names.join(', ')}`).toBe(names.length);
      expect(dungeon.links.some((l) => l.door?.ambush), 'a held floor sends patrols, not ambushes').toBe(false);
      const inner = dungeon.rooms.filter((r) => !r.goal && r.id !== dungeon.entry && !r.rest && r.id !== 'cache');
      const said = inner.filter((r) => r.firstVisit?.length);
      expect(said.length / inner.length, `rooms that say what they are: ${said.length} of ${inner.length}`).toBeGreaterThanOrEqual(0.6);
      const fights = inner.filter((r) => r.fight).length;
      expect(fights, 'fights besides the goal').toBeGreaterThanOrEqual(2);
      expect(fights, 'fights besides the goal').toBeLessThan(inner.length);
    }
    expect(JSON.stringify(module).includes('$one') || JSON.stringify(module).includes('$they')).toBe(false);
  });

  it('words its locks as its holders would, and often hides a way round the first, for every archetype', () => {
    let locked = 0, round = 0;
    const byKind = new Map<string, number>();
    for (const g of grid) {
      const { f } = g;
      const module = build(g);
      for (const sc of Object.values(module.scenes)) {
        if (sc.kind !== 'dungeon') continue;
        const kind = ARCHETYPES[f.archetype]!;
        const locks = sc.dungeon.links.filter((l) => l.door?.locked);
        if (!locks.length) continue;
        locked++;
        for (const l of locks) expect([kind.lock.in, kind.lock.out], `${f.id}: ${l.door!.note}`).toContain(l.door!.note);
        if (sc.dungeon.links.some((l) => l.door?.secret && l.door.note)) { round++; byKind.set(f.archetype, (byKind.get(f.archetype) ?? 0) + 1); }
      }
    }
    expect(round / locked, `${round} of ${locked} locked floors have a back way`).toBeGreaterThan(0.3);
    for (const id of Object.keys(ARCHETYPES)) expect(byKind.get(id) ?? 0, `back ways in a ${id}`).toBeGreaterThan(0);
  }, 60_000);
});
