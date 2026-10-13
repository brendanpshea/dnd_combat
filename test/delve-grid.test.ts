/**
 * Every faction, on every theme it can hold, at the levels it can field, in
 * two shapes: a held place must read as a place (archetypes.ts), not a list.
 * Its rooms are named once each, most of them say what they are for, its
 * fights are neither none nor all, and no text is left with a `$` in it.
 */
import { describe, it, expect } from 'vitest';
import { generateSpecDelve, type DelveShape } from '../src/adventure/delve-spec.js';
import { FACTIONS, canHold } from '../src/data/factions.js';
import { ARCHETYPES } from '../src/data/archetypes.js';
import type { Scene } from '../src/adventure/types.js';

const LEVELS = [1, 3, 5];
const SHAPES: DelveShape[] = ['classic', 'keys'];

const grid = Object.values(FACTIONS).flatMap((f) => f.themes.flatMap((theme) =>
  LEVELS.filter((level) => canHold(f, level)).flatMap((level) => SHAPES.map((shape) => ({ f, theme, level, shape })))));

describe('a held place, for every faction', () => {
  it('names an archetype that exists', () => {
    for (const f of Object.values(FACTIONS)) expect(ARCHETYPES[f.archetype], f.id).toBeDefined();
  });

  it.each(grid.map((g) => [`${g.f.id} in ${g.theme}, level ${g.level}, ${g.shape}`, g] as const))('%s', (_name, { f, theme, level, shape }) => {
    const { module } = generateSpecDelve(7, { theme, level, shape, fights: 'inhabitants', factions: [f.id] });
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

  it('words its locks as its holders would, and often hides a way round the first', () => {
    let locked = 0, round = 0;
    for (const { f, theme, level, shape } of grid) {
      const { module } = generateSpecDelve(7, { theme, level, shape, fights: 'inhabitants', factions: [f.id] });
      for (const sc of Object.values(module.scenes)) {
        if (sc.kind !== 'dungeon') continue;
        const kind = ARCHETYPES[f.archetype]!;
        const locks = sc.dungeon.links.filter((l) => l.door?.locked);
        if (!locks.length) continue;
        locked++;
        for (const l of locks) expect([kind.lock.in, kind.lock.out], `${f.id}: ${l.door!.note}`).toContain(l.door!.note);
        if (sc.dungeon.links.some((l) => l.door?.secret && l.door.note)) round++;
      }
    }
    expect(round / locked, `${round} of ${locked} locked floors have a back way`).toBeGreaterThan(0.3);
  });
});
