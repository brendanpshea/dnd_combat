/**
 * The world bible (docs/canon.md) holds the facts the prose relies on: the
 * seasons, which road, which shoe, who was where on each ledger value. This
 * test bans the phrasings that contradict it, across every string the three
 * chapters are built with (scene text, conditional paragraphs, choice labels
 * and hints, journal entries, dawns), after canon tokens are resolved.
 *
 * Each row names the banned regex, the canon fact it contradicts, and
 * optionally where it does not apply: `allow` (scene ids, `chapter:scene`,
 * where the phrase is legitimately different), `in` (only these chapters), and
 * `when` (only text whose conditions, the `if`/`assumes`/`requires` around it,
 * match this regex as JSON).
 *
 * KNOWN holds the contradictions found when this check was written, as
 * `row @ chapter:scene`. They are reported as warnings, so the test passes now
 * and fails on a new one. The list may only shrink: a KNOWN entry that no
 * longer matches fails too, so it gets struck off once fixed.
 */
import { describe, it, expect } from 'vitest';
import { HOLLOW_ROAD_MODULE } from '../src/data/modules/hollow-road.js';
import { SUNKEN_BARROWS_MODULE } from '../src/data/modules/sunken-barrows.js';
import { WYRMCALLING_MODULE } from '../src/data/modules/wyrmcalling.js';
import type { Module } from '../src/adventure/types.js';

interface Row {
  id: string;
  banned: RegExp;
  /** The fact in docs/canon.md the phrasing contradicts. */
  canon: string;
  allow?: string[];
  in?: string[];
  when?: RegExp;
}

const ROWS: Row[] = [
  // ── Timeline ──────────────────────────────────────────────────────────────
  { id: 'season-part1', in: ['hollow-road'], banned: /\bthis (summer|autumn|winter)\b/i,
    canon: 'Timeline: Part 1 happens in spring.' },
  { id: 'season-part2', in: ['sunken-barrows'], banned: /\bthis (spring|autumn|winter)\b/i,
    canon: 'Timeline: Part 2 happens in summer, a season after Part 1.' },
  { id: 'season-part3', in: ['wyrmcalling'], banned: /\b(this|the|through the|all) summer\b|\bthis (spring|winter)\b/i,
    canon: 'Timeline: Part 3 happens in autumn, two seasons after Part 1.' },
  { id: 'last-year', in: ['sunken-barrows', 'wyrmcalling'], banned: /\b(last|a) year('s)? ago\b|\blast year\b/i,
    canon: 'Timeline: about a season between chapters; all three wars fall in one year.' },
  // ── Places ────────────────────────────────────────────────────────────────
  { id: 'north-road', banned: /\bnorth road\b/i,
    canon: 'Places: the carter was taken off the marsh road; there is no north road.' },
  { id: 'den-scorch', banned: /\bscorched scales\b/i, allow: ['wyrmcalling:redden'],
    canon: 'Places: only the red den is fire; the green is a briar tunnel, the blue a ruined watchtower.' },
  // ── People and objects ────────────────────────────────────────────────────
  { id: 'shoe-held', banned: /\b(holding|holds|clutching|clutches) her (one )?shoe\b|\bshoe in (both|her) hands?\b/i,
    canon: 'People: the girl wears her one shoe, on her right foot.' },
  { id: 'shoe-side', banned: /\bright shoe\b|\bon her left foot\b/i,
    canon: 'People: her right shoe is on her foot; the left hangs in the chief\'s hall.' },
  { id: 'carter-girl', banned: /\ba girl of about seven on my back\b/i,
    canon: 'People: the carter calls her his granddaughter.' },
  { id: 'wren-the-girl', banned: /\blooks at the girl\b/i, in: ['sunken-barrows', 'wyrmcalling'],
    canon: 'People: in narration "the girl" is the carter\'s granddaughter; Wren is never "the girl".' },
  // ── Who was where ─────────────────────────────────────────────────────────
  { id: 'wren-underground', in: ['wyrmcalling'],
    banned: /\blast time it was the barrows\b|\b(down|under) the barrows with (you|them)\b|\bbarrow stair with (you|them)\b/i,
    canon: 'Who was where: Wren held the Barrow Gate in Part 2 unless warm and asked; Part 3 may not assume she went underground.' },
  { id: 'hask-fought', in: ['wyrmcalling'], banned: /\blet (him|the chief's guard|hask) fight you\b/i,
    canon: 'Who was where: with the Reedwife bound, Hask walked out after her; he fought only where she was killed (Vex not turned).' },
  { id: 'bound-at-door', banned: /\bat that door still\b|\btied her back to that door\b/i,
    canon: 'Who was where: bound, the Reedwife keeps the price, not the watch: she sits by her pool, and nobody sits by the Warden\'s door.' },
  // In built text an NPC's fate reads as a flag (`npc.wren.fate.saved`).
  { id: 'unfreed-came-home', in: ['hollow-road'],
    when: /"notFlag","flag":"(npc\.wren\.fate\.saved|captives-freed)"/,
    banned: /\bthe carter (is alive|carries the girl out)\b|\b(carter|girl) walk(s|ed)? home\b|\bwaiting for the dark of the moon\b/i,
    canon: 'Who was where: a pen not freed (left or never opened, no Wren to send the reeve\'s men) was found empty; the captives never came home.' },
];

/** Contradictions in the text when this check was written. Strike each off
 *  as the fix round corrects it. */
const KNOWN = new Set<string>([
]);

interface Line { chapter: string; scene: string; text: string; cond: string }

/** Every prose string in a module, with the scene it sits in and the
 *  conditions around it (an ancestor's `if`, `assumes` or `requires`). */
function lines(m: Module): Line[] {
  const out: Line[] = [];
  const walk = (v: unknown, scene: string, cond: string): void => {
    if (typeof v === 'string') { if (/\s/.test(v)) out.push({ chapter: m.id, scene, text: v, cond }); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, scene, cond); return; }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    const here = ['if', 'assumes', 'requires'].filter((k) => Array.isArray(o[k])).map((k) => JSON.stringify(o[k])).join(' ');
    const c = here ? `${cond} ${here}` : cond;
    for (const [k, x] of Object.entries(o)) if (k !== 'if' && k !== 'assumes' && k !== 'requires') walk(x, scene, c);
  };
  for (const [id, s] of Object.entries(m.scenes)) walk(s, id, '');
  for (const d of m.dawns ?? []) walk(d, `dawn-${d.day}`, '');
  const { scenes: _s, dawns: _d, npcs: _n, facts: _f, renamedFlags: _r, ...rest } = m as Module & Record<string, unknown>;
  walk(rest, '(module)', '');
  return out;
}

const CHAPTERS = [HOLLOW_ROAD_MODULE, SUNKEN_BARROWS_MODULE, WYRMCALLING_MODULE];
const LINES = CHAPTERS.flatMap(lines);

/** Every hit, as `row @ chapter:scene` → the first offending text. */
function hits(): Map<string, string> {
  const found = new Map<string, string>();
  for (const row of ROWS) {
    for (const l of LINES) {
      const where = `${l.chapter}:${l.scene}`;
      if (row.in && !row.in.includes(l.chapter)) continue;
      if (row.allow?.includes(where)) continue;
      if (row.when && !row.when.test(l.cond)) continue;
      const m = row.banned.exec(l.text);
      if (!m) continue;
      const key = `${row.id} @ ${where}`;
      if (!found.has(key)) {
        const at = Math.max(0, m.index - 50);
        found.set(key, `${at ? '…' : ''}${l.text.slice(at, m.index + m[0].length + 50)}…`);
      }
    }
  }
  return found;
}

describe('the chapters say nothing docs/canon.md contradicts', () => {
  const found = hits();
  const canonOf = (key: string) => ROWS.find((r) => r.id === key.split(' @ ')[0])!.canon;

  it('reads every chapter', () => {
    expect(LINES.length).toBeGreaterThan(2000);
    for (const m of CHAPTERS) expect(LINES.some((l) => l.chapter === m.id && l.scene.startsWith('dawn-'))).toBe(true);
  });

  it('no new contradiction', () => {
    const known = [...found].filter(([k]) => KNOWN.has(k));
    if (known.length) {
      console.warn(`canon: ${known.length} known contradiction(s) still in the text (docs/canon.md lists them):\n`
        + known.map(([k, t]) => `  ${k}: "${t}"\n    ↳ ${canonOf(k)}`).join('\n'));
    }
    const fresh = [...found].filter(([k]) => !KNOWN.has(k)).map(([k, t]) => `${k}: "${t}" — contradicts ${canonOf(k)}`);
    expect(fresh).toEqual([]);
  });

  it('every known contradiction is still there (strike off the fixed ones)', () => {
    expect([...KNOWN].filter((k) => !found.has(k))).toEqual([]);
  });

  it('every row and every KNOWN entry names a real row', () => {
    expect(new Set(ROWS.map((r) => r.id)).size).toBe(ROWS.length);
    for (const k of KNOWN) expect(ROWS.map((r) => r.id)).toContain(k.split(' @ ')[0]);
  });
});
