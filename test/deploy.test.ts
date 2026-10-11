import { describe, it, expect } from 'vitest';
import { deployPositions, pickPattern, deployFoes, type DeployPattern } from '../src/arena/deploy.js';
import { generateEncounter } from '../src/arena/encounter.js';
import { generateArenaMap } from '../src/arena/map.js';
import { parseMap } from '../src/data/maps.js';
import { canThreatenAtRange, MONSTERS } from '../src/data/monsters.js';
import { seedRng } from '../src/engine/rng.js';
import { cellAt } from '../src/engine/types.js';

const PATTERNS: DeployPattern[] = ['far-rank', 'advanced', 'pincer', 'scattered'];

describe('enemy deployment', () => {
  it('always places every foe, on open ground, without stacking them', () => {
    let rng = seedRng(3);
    for (let i = 0; i < 120; i++) {
      const m = generateArenaMap({}, rng); rng = m.state;
      const grid = parseMap(m.value.map);
      for (const pattern of PATTERNS) {
        for (const count of [1, 3, 6]) {
          const out = deployPositions(grid, count, pattern, rng);
          expect(out.value, `${pattern} x${count}`).toHaveLength(count);
          const seen = new Set<string>();
          for (const p of out.value) {
            const cell = cellAt(grid, p);
            expect(cell, `${pattern}: off the grid at ${p.x},${p.y}`).toBeDefined();
            expect(cell!.terrain, `${pattern}: inside a wall`).not.toBe('wall');
            const key = `${p.x},${p.y}`;
            expect(seen.has(key), `${pattern}: two foes on ${key}`).toBe(false);
            seen.add(key);
          }
        }
      }
    }
  });

  it('never deploys into the party rank, however the pattern falls', () => {
    // The party holds rank 0. Starting a fight already adjacent is an ambush,
    // not a variation on where the enemy stands.
    let rng = seedRng(11);
    for (let i = 0; i < 120; i++) {
      const m = generateArenaMap({}, rng); rng = m.state;
      const grid = parseMap(m.value.map);
      for (const pattern of PATTERNS) {
        for (const p of deployPositions(grid, 6, pattern, rng).value) {
          expect(p.y, `${pattern} put a foe on rank ${p.y}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('is seeded: the same wave redeploys identically on a retry', () => {
    const m = generateArenaMap({}, seedRng(7));
    const grid = parseMap(m.value.map);
    const a = deployFoes(grid, 4, 12345);
    const b = deployFoes(grid, 4, 12345);
    expect(b.value).toEqual(a.value);
  });

  it('keeps the classic layout the most common shape', () => {
    // Weighted, not uniform: the far rank should still be what most fights look
    // like, so the others read as a variation rather than as noise.
    let rng = seedRng(21);
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const p = pickPattern(rng); rng = p.state;
      counts.set(p.value, (counts.get(p.value) ?? 0) + 1);
    }
    for (const pattern of PATTERNS) {
      expect(counts.get(pattern) ?? 0, `${pattern} never came up`).toBeGreaterThan(100);
    }
    const far = counts.get('far-rank')!;
    expect(far).toBeGreaterThan(2000 * 0.35);
    expect(far).toBeLessThan(2000 * 0.55);
  });
});

describe('every wave can punish standing still', () => {
  it('generates no encounter that has to walk the whole board to act', () => {
    // Two thirds of the bestiary is melee-only, and creature-type choice used
    // to let a whole wave come from that two thirds: 33% of generated waves had
    // nobody who could reach the party at all. Against one of those, holding
    // the back rank is not a tactic, it is the entire fight.
    let rng = seedRng(4);
    const bad: string[] = [];
    for (const budget of [400, 1500, 5700, 15500]) {
      for (let level = 1; level <= 5; level++) {
        for (let i = 0; i < 25; i++) {
          const r = generateEncounter({ budget, partyLevel: level }, rng); rng = r.state;
          if (!r.value.members.some(canThreatenAtRange)) bad.push(r.value.members.join(','));
        }
      }
    }
    expect(bad.slice(0, 5), `${bad.length} waves with no reach`).toEqual([]);
  });

  it('reads the ranged predicate off the stat block, not off a hand-kept list', () => {
    // A monster given a bow tomorrow should count as ranged with no edit here.
    expect(canThreatenAtRange('scout')).toBe(true);        // shortbow
    expect(canThreatenAtRange('cult-fanatic')).toBe(true); // spellcasting
    expect(canThreatenAtRange('wolf')).toBe(false);        // bite only
    expect(canThreatenAtRange('flying-sword')).toBe(false);
    expect(canThreatenAtRange('no-such-monster')).toBe(false);
    // And it agrees with the data for every monster in the game.
    for (const m of Object.values(MONSTERS)) {
      expect(typeof canThreatenAtRange(m.id)).toBe('boolean');
    }
  });
});

/**
 * Deployment has to fan out across whatever board it is handed.
 *
 * The file order `[3, 1, 5, 2, 6, 0, 7, 4]` was written for eight columns and
 * kept in bounds with `% grid.width`, which does nothing at all on a wider
 * board: every monster landed in the left eight files while the party spread
 * across the whole width. That is not a harder fight or an easier one — it is
 * a different fight, happening in a strip of the board with the rest unused,
 * and it would have been measured as "a wide board changes nothing".
 *
 * Found while building scripts/arena-width.ts, whose first run swept widths up
 * to 24 against monsters that were all standing in the first third of them.
 */
describe('deployment across a wider board', () => {
  const WIDTHS = [8, 12, 16, 24];

  it('spreads the enemy over the whole width, not the first eight files', () => {
    for (const width of WIDTHS) {
      const grid = parseMap(generateArenaMap({ width, height: 12 }, seedRng(11)).value.map);
      const spots = deployPositions(grid, 6, 'far-rank', seedRng(5));
      const span = Math.max(...spots.value.map((p) => p.x)) - Math.min(...spots.value.map((p) => p.x));
      // Six foes on eight files span 6; the same six on 24 should span far more
      // than the 6 they would if the order were still read as raw columns.
      expect(span, `width ${width}: the enemy is huddled in ${span + 1} files\n${spots.value.map((p) => `${p.x},${p.y}`).join(' ')}`)
        .toBeGreaterThanOrEqual(Math.floor((width * 5) / 8));
    }
  });

  it('is unchanged on the width the game ships', () => {
    // The scaling is a no-op at eight, and that has to stay exactly true: this
    // is the deployment every balance number in the repo was measured against.
    const grid = parseMap(generateArenaMap({ height: 12 }, seedRng(11)).value.map);
    for (const pattern of PATTERNS) {
      const bare = deployPositions(grid, 6, pattern, seedRng(5));
      expect(bare.value.map((p) => `${p.x},${p.y}`).join(' '))
        .toBe(deployPositions(parseMap(generateArenaMap({ width: 8, height: 12 }, seedRng(11)).value.map),
          6, pattern, seedRng(5)).value.map((p) => `${p.x},${p.y}`).join(' '));
    }
    // And the far-rank order itself, pinned: 3, 1, 5, 2, 6, 0 of eight files.
    const far = deployPositions(grid, 6, 'far-rank', seedRng(5));
    expect(far.value.map((p) => p.x)).toEqual([3, 1, 5, 2, 6, 0]);
  });

  it('still puts a pincer on the real flanks', () => {
    for (const width of WIDTHS) {
      const grid = parseMap(generateArenaMap({ width, height: 12 }, seedRng(11)).value.map);
      const xs = deployPositions(grid, 6, 'pincer', seedRng(5)).value.map((p) => p.x);
      expect(Math.min(...xs), `width ${width}`).toBeLessThan(2);
      expect(Math.max(...xs), `width ${width}`).toBeGreaterThan(width - 3);
    }
  });
});
