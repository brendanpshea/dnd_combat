/**
 * The XP ceiling (src/adventure/xp-reach.ts): over every route the search can
 * find, not just the seven replayed ones, no fight is met above its chapter's
 * level band, and no XP can be farmed.
 *
 * docs/design-decisions.md: levels come from fights, and Part 3 tops out at
 * 5th. Read as "no fight is met above 5th": a level gained on the trilogy's
 * last blow is allowed, so endings are reported, not held under a level.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODULES, moduleById } from '../src/data/modules/index.js';
import type { Module } from '../src/adventure/types.js';
import { maxXpReport, type XpReport } from '../src/adventure/xp-reach.js';
import { LEVEL_XP } from '../src/campaign/campaign.js';

const CHAPTERS = MODULES.filter((m) => m.levelBand);

/** The XP a party starts the level after `level` at: met at or past it, a fight is met above `level`. */
const ceiling = (level: number) => LEVEL_XP[level]!;
const over = (m: Module, r: XpReport) => r.battles.filter((b) => b.max >= ceiling(m.levelBand!.to));

describe('XP ceiling', () => {
  const reports = new Map<string, XpReport>();
  // Three reachability searches with every edge's XP; about 10 s together.
  beforeAll(() => { for (const m of CHAPTERS) reports.set(m.id, maxXpReport(m)); }, 60000);

  it('searches every chapter with a level band', () => {
    expect(CHAPTERS.map((m) => m.id)).toEqual(['hollow-road', 'sunken-barrows', 'wyrmcalling']);
    for (const m of CHAPTERS) {
      const r = reports.get(m.id)!;
      expect(r.skipped, m.id).toBeUndefined();
      expect(r.battles.length, m.id).toBeGreaterThan(0);
    }
  });

  it('no XP can be farmed', () => {
    for (const m of CHAPTERS) expect(reports.get(m.id)!.farmable, m.id).toEqual([]);
  });

  it('no fight is met above its chapter\'s level band', () => {
    for (const m of CHAPTERS) {
      const r = reports.get(m.id)!;
      const found = over(m, r).map((b) => `${b.scene}: met with up to ${b.max} XP (level ${b.level}, band ${m.levelBand!.from}–${m.levelBand!.to}). One way:\n  ${b.path.join('\n  ')}`);
      expect(found, `${m.id}: lower what the route there pays`).toEqual([]);
    }
  });

  it('each chapter starts where the one before can end', () => {
    expect(reports.get('hollow-road')!.startXp).toBe(0);
    expect(reports.get('sunken-barrows')!.startXp).toBe(reports.get('hollow-road')!.victoryMax);
    expect(reports.get('wyrmcalling')!.startXp).toBe(reports.get('sunken-barrows')!.victoryMax);
    // Reported, not held: the ending may level on the last blow.
    for (const m of CHAPTERS) {
      const r = reports.get(m.id)!;
      const end = r.endings.find((e) => e.outcome === 'victory')!;
      console.log(`${m.id}: most XP at a fight's door ${r.battles[0]!.max} (${r.battles[0]!.scene}), at the end ${end.max} (level ${end.level})`);
    }
  });

  // The bound is an upper bound: every route actually played must lie under
  // it. docs/balance.md lists each transcript route's XP at every fight's door.
  it('lies above every replayed route', () => {
    const doc = readFileSync('docs/balance.md', 'utf8');
    let checked = 0;
    for (const section of doc.split(/^## /m).slice(1)) {
      const id = /`([a-z-]+)`/.exec(section.split('\n')[0]!)?.[1];
      const r = id ? reports.get(id) : undefined;
      if (!r) continue;
      for (const m of section.matchAll(/^\| ([\w-]+) \| `([\w-]+)`[^\n]*?\| \d+ \((\d+) XP\) \|/gm)) {
        const b = r.battles.find((x) => x.scene === m[2]);
        expect(b, `${id}: ${m[2]} not found`).toBeDefined();
        expect(Number(m[3]), `${m[1]} meets ${m[2]} with more XP than the bound (or docs/balance.md is stale: npm run balance)`).toBeLessThanOrEqual(b!.max);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  // Before 3de2aed the cracked door's fight (seal-breach) paid its XP, and a
  // party that lost the rites met the sisters at 6th. The check catches that.
  it('would have caught the cracked door paying', () => {
    const sb = moduleById('sunken-barrows')!;
    const breach = sb.scenes['seal-breach']!;
    expect(breach.kind === 'battle' && breach.loot).toBe(false);
    const { loot: _paid, ...paying } = breach as Extract<typeof breach, { kind: 'battle' }>;
    const bad = maxXpReport({ ...sb, scenes: { ...sb.scenes, 'seal-breach': paying } });
    const wc = moduleById('wyrmcalling')!;
    const after = maxXpReport(wc, MODULES, { startXp: bad.victoryMax });
    expect(over(wc, after).map((b) => b.scene)).toContain('sisters-battle');
  }, 30000);
});
