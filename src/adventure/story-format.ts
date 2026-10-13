/**
 * The `.story` format: a chapter's scenes as text an author can read
 * (docs/authoring-format-proposal.md). It compiles to the same scene data the
 * engine has always taken, so every proof runs on it unchanged.
 *
 *   # board
 *   art: 📜
 *   Here is the reeve's bounty in full, nailed up and gone grey at the edges.
 *   ? not spy-seen | A line shown only while that holds.
 *   again:
 *   The reeve's bounty still hangs on the board.
 *   > Take the reeve's retainer up front → square/city  #ok
 *     once
 *     do +bounty; gold {bounty-retainer}
 *
 * One paragraph per line. A scene is `# id`; its prose goes to its kind's own
 * field (a story's text, a dialogue's lines, a fight's intro) until a line
 * `again:` (or `text:`, `intro:`, `lines:`) switches. Choices are `> label →
 * to  #id`, with what they need (`?`), do (`do`), roll (`check skill dc →
 * failTo`) indented under them. Fights end in `won →` / `lost →`, rolls in
 * `success →` / `failure →`. `@NAME` is something from the chapter's
 * parts.ts; anything without a shorthand is written `@key: <JSON>`. A line
 * beginning `//` is a comment, and `\` at the start of a line keeps it prose.
 *
 * Parsing gives a tree with markers in it (a part, a fact's number); `resolve`
 * turns it into scenes, and `emitScenes` into TypeScript for the build.
 */
import type { Id } from '../engine/types.js';

// --- Markers ---------------------------------------------------------------

export type Marker =
  | { $ref: string }
  | { $call: string; args: string }
  | { $fact: string; neg?: true }
  | { $avoided: string; less?: string };
interface Spread { $spread: Marker }
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isMarker = (x: unknown): x is Marker => isObj(x) && ('$ref' in x || '$call' in x || '$fact' in x || '$avoided' in x);
const isSpread = (x: unknown): x is Spread => isObj(x) && '$spread' in x;

/** How the markers resolve: the chapter's parts, its facts, a fight's worth. */
export interface StoryEnv {
  part(name: string): unknown;
  call(name: string, args: string): unknown;
  fact(name: string): number;
  avoided(encounter: string): number;
}

export function resolve(x: unknown, env: StoryEnv): unknown {
  if (Array.isArray(x)) {
    const out: unknown[] = [];
    for (const v of x) {
      if (isSpread(v)) out.push(...([] as unknown[]).concat(resolve(v.$spread, env)));
      else out.push(resolve(v, env));
    }
    return out;
  }
  if (isMarker(x)) {
    if ('$ref' in x) return structuredClone(env.part(x.$ref));
    if ('$call' in x) return structuredClone(env.call(x.$call, x.args));
    if ('$fact' in x) return x.neg ? -env.fact(x.$fact) : env.fact(x.$fact);
    return env.avoided(x.$avoided) - (x.less ? env.avoided(x.less) : 0);
  }
  if (isObj(x)) return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, resolve(v, env)]));
  return x;
}

// --- Shorthands ------------------------------------------------------------

const WORD = /^[\w.:/'-]+$/;
const KEYWORDS = new Set(['alarm', 'not', 'gold', 'class', 'with', 'without', 'item', 'visited', 'at', 'npc', 'xp', 'drop', 'day', 'join', 'leave']);

/** Split a `;` list at the top level (not inside JSON, quotes or calls). */
function splitList(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = '', cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quote) { cur += c; if (c === '\\') { cur += s[++i] ?? ''; continue; } if (c === quote) quote = ''; continue; }
    if (c === '"' || c === '\'') { quote = c; cur += c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    if (c === '}' || c === ']' || c === ')') depth--;
    if (c === ';' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A number, or a fact's (`{name}`, `-{name}`), or a fight's worth (`avoided enc`). */
function parseNum(t: string, where: string): unknown {
  let m = /^(-?)\{([\w-]+)\}$/.exec(t);
  if (m) return m[1] ? { $fact: m[2]!, neg: true } : { $fact: m[2]! };
  m = /^avoided ([\w-]+)(?: - avoided ([\w-]+))?$/.exec(t);
  if (m) return m[2] ? { $avoided: m[1]!, less: m[2] } : { $avoided: m[1]! };
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  throw new Error(`${where}: '${t}' is not a number`);
}

function parseRef(t: string): Marker | undefined {
  const m = /^@([A-Za-z_]\w*)(?:\((.*)\))?$/s.exec(t);
  if (!m) return undefined;
  return m[2] !== undefined ? { $call: m[1]!, args: m[2] } : { $ref: m[1]! };
}

function parseReq(t: string, where: string): unknown {
  if (t.startsWith('{')) return JSON.parse(t);
  const ref = parseRef(t);
  if (ref) return { $spread: ref };
  let m: RegExpExecArray | null;
  if ((m = /^not ([\w.:/'-]+)$/.exec(t))) return { kind: 'notFlag', flag: m[1] };
  if ((m = /^alarm (\S+) (>=|<) (\d+)$/.exec(t))) return { kind: 'alarm', dungeon: m[1], ...(m[2] === '>=' ? { atLeast: Number(m[3]) } : { below: Number(m[3]) }) };
  if ((m = /^gold (.+)$/.exec(t))) return { kind: 'gold', atLeast: parseNum(m[1]!, where) };
  if ((m = /^class (\S+)$/.exec(t))) return { kind: 'classInParty', classId: m[1] };
  if ((m = /^with (\S+)$/.exec(t))) return { kind: 'companion', companion: m[1] };
  if ((m = /^without (\S+)$/.exec(t))) return { kind: 'noCompanion', companion: m[1] };
  if ((m = /^item (\S+)$/.exec(t))) return { kind: 'item', itemId: m[1] };
  if ((m = /^visited (\S+)$/.exec(t))) return { kind: 'visited', scene: m[1] };
  if ((m = /^at (\S+)$/.exec(t))) return { kind: 'at', hub: m[1] };
  if ((m = /^npc (\S+) (not )?met$/.exec(t))) return { kind: 'npc', npc: m[1], met: !m[2] };
  if ((m = /^npc (\S+) fate (\S+)$/.exec(t))) return { kind: 'npc', npc: m[1], fate: m[2] };
  if ((m = /^npc (\S+) not fate (\S+)$/.exec(t))) return { kind: 'npc', npc: m[1], notFate: m[2]!.split(',') };
  if (WORD.test(t) && !KEYWORDS.has(t)) return { kind: 'flag', flag: t };
  throw new Error(`${where}: cannot read the requirement '${t}'`);
}

function printReq(r: Record<string, unknown>): string {
  const keys = Object.keys(r).sort().join(',');
  const w = (v: unknown) => typeof v === 'string' && WORD.test(v) && !KEYWORDS.has(v);
  switch (r.kind) {
    case 'flag': if (keys === 'flag,kind' && w(r.flag)) return r.flag as string; break;
    case 'notFlag': if (keys === 'flag,kind' && w(r.flag)) return `not ${r.flag}`; break;
    case 'gold': if (keys === 'atLeast,kind') return `gold ${numTok(r.atLeast)}`; break;
    case 'classInParty': if (keys === 'classId,kind' && w(r.classId)) return `class ${r.classId}`; break;
    case 'companion': if (keys === 'companion,kind' && w(r.companion)) return `with ${r.companion}`; break;
    case 'noCompanion': if (keys === 'companion,kind' && w(r.companion)) return `without ${r.companion}`; break;
    case 'item': if (keys === 'itemId,kind' && w(r.itemId)) return `item ${r.itemId}`; break;
    case 'visited': if (keys === 'kind,scene' && w(r.scene)) return `visited ${r.scene}`; break;
    case 'at': if (keys === 'hub,kind' && w(r.hub)) return `at ${r.hub}`; break;
    case 'alarm':
      if (keys === 'atLeast,dungeon,kind' && w(r.dungeon)) return `alarm ${r.dungeon} >= ${r.atLeast}`;
      if (keys === 'below,dungeon,kind' && w(r.dungeon)) return `alarm ${r.dungeon} < ${r.below}`;
      break;
    case 'npc':
      if (keys === 'kind,met,npc' && w(r.npc) && typeof r.met === 'boolean') return `npc ${r.npc} ${r.met ? '' : 'not '}met`;
      if (keys === 'fate,kind,npc' && w(r.npc) && w(r.fate)) return `npc ${r.npc} fate ${r.fate}`;
      if (keys === 'kind,notFate,npc' && w(r.npc) && Array.isArray(r.notFate) && r.notFate.length && r.notFate.every(w)) return `npc ${r.npc} not fate ${(r.notFate as string[]).join(',')}`;
      break;
  }
  return JSON.stringify(r);
}

function parseEff(t: string, where: string): unknown {
  if (t.startsWith('{')) return JSON.parse(t);
  const ref = parseRef(t);
  if (ref) return { $spread: ref };
  let m: RegExpExecArray | null;
  if ((m = /^\+([\w.:/'-]+)$/.exec(t))) return { kind: 'setFlag', flag: m[1] };
  if ((m = /^-([\w.:/'-]+)$/.exec(t))) return { kind: 'clearFlag', flag: m[1] };
  if ((m = /^gold (.+)$/.exec(t))) return { kind: 'gold', amount: parseNum(m[1]!, where) };
  if ((m = /^xp (.+)$/.exec(t))) return { kind: 'xp', amount: parseNum(m[1]!, where) };
  if ((m = /^item (\S+)(?: x(\d+))?$/.exec(t))) return { kind: 'addItem', itemId: m[1], ...(m[2] ? { qty: Number(m[2]) } : {}) };
  if ((m = /^drop (\S+)(?: x(\d+))?$/.exec(t))) return { kind: 'removeItem', itemId: m[1], ...(m[2] ? { qty: Number(m[2]) } : {}) };
  if (t === 'day') return { kind: 'passDay' };
  if ((m = /^alarm (\S+) ([+-]\d+)$/.exec(t))) return { kind: 'alarm', dungeon: m[1], amount: Number(m[2]) };
  if ((m = /^join (\S+)$/.exec(t))) return { kind: 'joinParty', companion: m[1] };
  if ((m = /^leave (\S+)$/.exec(t))) return { kind: 'leaveParty', companion: m[1] };
  if ((m = /^npc (\S+)((?: met| fate \S+| attitude -?\d+)+)$/.exec(t))) {
    const e: Record<string, unknown> = { kind: 'npc', npc: m[1] };
    const parts = m[2]!.trim().split(' ');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'met') e.met = true;
      else if (parts[i] === 'fate') e.fate = parts[++i];
      else if (parts[i] === 'attitude') e.attitude = Number(parts[++i]);
    }
    return e;
  }
  throw new Error(`${where}: cannot read the effect '${t}'`);
}

function printEff(e: Record<string, unknown>): string {
  const keys = Object.keys(e).sort().join(',');
  const w = (v: unknown) => typeof v === 'string' && WORD.test(v);
  const q = typeof e.qty === 'number' ? ` x${e.qty}` : '';
  switch (e.kind) {
    case 'setFlag': if (keys === 'flag,kind' && w(e.flag)) return `+${e.flag}`; break;
    case 'clearFlag': if (keys === 'flag,kind' && w(e.flag)) return `-${e.flag}`; break;
    case 'gold': if (keys === 'amount,kind') return `gold ${numTok(e.amount)}`; break;
    case 'xp': if (keys === 'amount,kind') return `xp ${numTok(e.amount, true)}`; break;
    case 'addItem': if ((keys === 'itemId,kind' || keys === 'itemId,kind,qty') && w(e.itemId)) return `item ${e.itemId}${q}`; break;
    case 'removeItem': if ((keys === 'itemId,kind' || keys === 'itemId,kind,qty') && w(e.itemId)) return `drop ${e.itemId}${q}`; break;
    case 'passDay': if (keys === 'kind') return 'day'; break;
    case 'alarm': if (keys === 'amount,dungeon,kind' && w(e.dungeon) && Number.isInteger(e.amount)) return `alarm ${e.dungeon} ${(e.amount as number) >= 0 ? '+' : ''}${e.amount}`; break;
    case 'joinParty': if (keys === 'companion,kind' && w(e.companion)) return `join ${e.companion}`; break;
    case 'leaveParty': if (keys === 'companion,kind' && w(e.companion)) return `leave ${e.companion}`; break;
    case 'npc': {
      const extra = Object.keys(e).filter((k) => k !== 'kind' && k !== 'npc');
      const ok = w(e.npc) && extra.length > 0 && extra.every((k) => (k === 'met' && e.met === true) || (k === 'fate' && w(e.fate)) || (k === 'attitude' && Number.isInteger(e.attitude)));
      if (ok) return `npc ${e.npc}${e.met ? ' met' : ''}${e.fate ? ` fate ${e.fate}` : ''}${e.attitude !== undefined ? ` attitude ${e.attitude}` : ''}`;
      break;
    }
  }
  return JSON.stringify(e);
}

// --- Printing ----------------------------------------------------------------

/** What the printer may write by name instead of in full. */
export interface PrintNames {
  /** Parts by name (non-function values). */
  parts?: Record<string, unknown>;
  /** Calls the chapter makes, with the value each returns. */
  calls?: Array<{ name: string; args: string; value: unknown }>;
  /** A number standing for a fact (`{name}`) or a fight's worth (`avoided enc`). */
  num?: (n: number, xp: boolean) => string | undefined;
}
let names: PrintNames = {};
function numTok(n: unknown, xp = false): string {
  if (typeof n !== 'number') throw new Error(`not a number: ${JSON.stringify(n)}`);
  return names.num?.(n, xp) ?? String(n);
}

const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
/** The named things that could stand for `v` (a whole value). */
function nameFor(v: unknown): string | undefined {
  for (const c of names.calls ?? []) if (eq(c.value, v)) return `@${c.name}(${c.args})`;
  for (const [k, p] of Object.entries(names.parts ?? {})) if (eq(p, v)) return `@${k}`;
  return undefined;
}
/** Walk a list, naming the longest run of it that a part or call returns. */
function nameRuns<T>(list: readonly T[], minLen: number, print: (x: T) => string): string[] {
  const out: string[] = [];
  const cands = [
    ...(names.calls ?? []).map((c) => ({ tok: `@${c.name}(${c.args})`, v: c.value })),
    ...Object.entries(names.parts ?? {}).map(([k, v]) => ({ tok: `@${k}`, v })),
  ];
  for (let i = 0; i < list.length;) {
    let best: { tok: string; k: number } | undefined;
    for (const c of cands) {
      const arr = Array.isArray(c.v) ? c.v : [c.v];
      if (!arr.length || i + arr.length > list.length) continue;
      if (!eq(list.slice(i, i + arr.length), arr)) continue;
      const plain = list.slice(i, i + arr.length).map(print).join('; ');
      if (plain.length < minLen) continue;
      if (!best || arr.length > best.k) best = { tok: c.tok, k: arr.length };
    }
    if (best) { out.push(best.tok); i += best.k; } else { out.push(print(list[i]!)); i++; }
  }
  return out;
}
const reqList = (rs: unknown[]) => nameRuns(rs as Record<string, unknown>[], 40, printReq).join('; ');
const effList = (es: unknown[]) => nameRuns(es as Record<string, unknown>[], 30, printEff).join('; ');

const PROSE_OF: Record<string, string> = { story: 'text', ending: 'text', dialogue: 'lines', battle: 'intro', check: 'intro', challenge: 'intro', rest: 'intro', shop: 'intro' };
const PROSE = ['text', 'lines', 'intro', 'again'];
const OUTCOMES: Record<string, string> = { won: 'onWin', lost: 'onLoss', success: 'success', failure: 'failure' };
const SPECIAL = /^(#|>|\?|@|\\|\/\/)|^[A-Za-z][\w-]*:( |$)|^(won|lost|success|failure) → |^(parley|approach|once|hide|do|check|fail|journal|stage|taken|resolved|failed)( |:|$)/;

function scalarOk(v: unknown): boolean {
  if (typeof v === 'number' || typeof v === 'boolean') return true;
  if (typeof v !== 'string') return false;
  return v.length > 0 && v === v.trim() && !v.includes('\n') && !/^(-?\d+(\.\d+)?|true|false)$/.test(v) && !v.startsWith('@');
}
/** JSON broken only where a line would run long: a map's markers one to a line. */
function pretty(v: unknown, ind: string): string {
  const one = JSON.stringify(v);
  if (one.length + ind.length <= 110 || (!Array.isArray(v) && !isObj(v))) return one;
  if (Array.isArray(v)) return `[\n${v.map((x) => `${ind}  ${pretty(x, ind + '  ')}`).join(',\n')}\n${ind}]`;
  return `{\n${Object.entries(v as object).map(([k, x]) => `${ind}  ${JSON.stringify(k)}: ${pretty(x, ind + '  ')}`).join(',\n')}\n${ind}}`;
}
function json(key: string, v: unknown, ind: string): string[] {
  const one = JSON.stringify(v);
  if (one.length <= 100) return [`${ind}@${key}: ${one}`];
  return [`${ind}@${key}:`, ...pretty(v, '').split('\n').map((l) => `${ind}  ${l}`)];
}
/**
 * A journal entry as a block:
 *   journal quest q-main: Break the {ashfang}
 *     {mira} begged your help.            (the body)
 *     stage Find the den | visited gate
 *     taken: know-spy / resolved: spy-caught / failed: a, b
 */
function journalBlock(e: Record<string, unknown>, ind: string): string[] | undefined {
  const j = e.entry as Record<string, unknown> | undefined;
  if (e.kind !== 'journal' || Object.keys(e).length !== 2 || !isObj(j)) return undefined;
  const ok = (v: unknown) => typeof v === 'string' && v === v.trim() && !!v && !v.includes('\n');
  if (!ok(j.id) || !/^\S+$/.test(j.id as string) || !ok(j.kind) || !/^\w+$/.test(j.kind as string) || !ok(j.title) || !ok(j.body)) return undefined;
  if (Object.keys(j).some((k) => !['id', 'kind', 'title', 'body', 'stages', 'takenBy', 'resolvedBy', 'failedBy'].includes(k))) return undefined;
  const out = [`${ind}journal ${j.kind} ${j.id}: ${j.title}`, `${ind}  ${SPECIAL.test(j.body as string) ? '\\' : ''}${j.body}`];
  if (j.stages !== undefined) {
    if (!Array.isArray(j.stages)) return undefined;
    for (const st of j.stages as Record<string, unknown>[]) {
      if (!isObj(st) || !ok(st.text) || (st.text as string).includes(' | ') || !Array.isArray(st.done) || Object.keys(st).length !== 2) return undefined;
      out.push(`${ind}  stage ${st.text} | ${reqList(st.done)}`);
    }
  }
  for (const [k, w] of [['takenBy', 'taken'], ['resolvedBy', 'resolved']] as const) {
    if (j[k] === undefined) continue;
    if (!ok(j[k]) || !WORD.test(j[k] as string)) return undefined;
    out.push(`${ind}  ${w}: ${j[k]}`);
  }
  if (j.failedBy !== undefined) {
    const f = j.failedBy;
    if (typeof f === 'string' && WORD.test(f)) out.push(`${ind}  failed: ${f}`);
    else if (Array.isArray(f) && f.length > 1 && f.every((x) => typeof x === 'string' && WORD.test(x))) out.push(`${ind}  failed: ${f.join(', ')}`);
    else return undefined;
  }
  return out;
}
function parseJournal(l: Line, at: (l: Line) => string): unknown {
  const m = /^journal (\w+) (\S+): (.+)$/.exec(l.text);
  if (!m) throw new Error(`${at(l)}: a journal entry is 'journal kind id: title'`);
  const entry: Record<string, unknown> = { id: m[2], kind: m[1], title: m[3] };
  for (const k of l.kids) {
    let km: RegExpExecArray | null;
    if ((km = /^stage (.+?) \| (.+)$/.exec(k.text))) ((entry.stages ??= []) as unknown[]).push({ text: km[1], done: splitList(km[2]!).map((x) => parseReq(x, at(k))) });
    else if ((km = /^taken: (\S+)$/.exec(k.text))) entry.takenBy = km[1];
    else if ((km = /^resolved: (\S+)$/.exec(k.text))) entry.resolvedBy = km[1];
    else if ((km = /^failed: (.+)$/.exec(k.text))) { const f = km[1]!.split(', '); entry.failedBy = f.length > 1 ? f : f[0]; }
    else if (entry.body === undefined) entry.body = k.text.startsWith('\\') ? k.text.slice(1) : k.text;
    else throw new Error(`${at(k)}: what is '${k.text}' in a journal entry?`);
  }
  return { kind: 'journal', entry };
}

/** An effect list: the short ones on one `do` line, each long one a `do:` block. */
function doLines(word: string, es: unknown[], ind: string): string[] {
  const toks = nameRuns(es as Record<string, unknown>[], 30, printEff);
  const short = toks.filter((t) => !(t.startsWith('{') && t.length > 80));
  const long = toks.filter((t) => t.startsWith('{') && t.length > 80);
  // Order matters to an effect list: only split when the long ones come last.
  if (long.length && toks.slice(toks.length - long.length).every((t) => long.includes(t))) {
    return [...(short.length ? [`${ind}${word} ${short.join('; ')}`] : []),
      ...long.flatMap((t) => (word === 'do' ? journalBlock(JSON.parse(t), ind) : undefined)
        ?? [`${ind}${word}:`, ...pretty(JSON.parse(t), '').split('\n').map((l) => `${ind}  ${l}`)])];
  }
  return [`${ind}${word} ${toks.join('; ')}`];
}
function paras(list: readonly unknown[], ind: string): string[] {
  const out: string[] = [];
  const runs = nameRuns(list, 0, (p) => JSON.stringify(p));
  let i = 0;
  for (const tok of runs) {
    if (tok.startsWith('@')) {
      // A named run: how many paragraphs did it cover?
      const cand = [...(names.calls ?? []).map((c) => ({ t: `@${c.name}(${c.args})`, v: c.value })), ...Object.entries(names.parts ?? {}).map(([k, v]) => ({ t: `@${k}`, v }))].find((c) => c.t === tok)!;
      out.push(ind + tok); i += Array.isArray(cand.v) ? cand.v.length : 1; continue;
    }
    out.push(ind + para(list[i]!)); i++;
  }
  return out;
}
function para(p: unknown): string {
  if (typeof p === 'string') {
    if (p.includes('\n') || p !== p.trim() || !p) return `@json ${JSON.stringify(p)}`;
    return SPECIAL.test(p) ? `\\${p}` : p;
  }
  if (isObj(p) && typeof p.text === 'string' && !p.text.includes('\n') && p.text === p.text.trim() && p.text
      && Object.keys(p).every((k) => k === 'text' || k === 'if' || k === 'assumes') && (p.if || p.assumes)) {
    const head = [p.if ? `? ${reqList(p.if as unknown[])}` : '', p.assumes ? `?! ${reqList(p.assumes as unknown[])}` : ''].filter(Boolean).join(' ');
    return `${head} | ${p.text}`;
  }
  return `@json ${JSON.stringify(p)}`;
}
function outcome(word: string, o: Record<string, unknown>, ind: string): string[] {
  const out = [`${ind}${word} → ${o.to}`];
  for (const [k, v] of Object.entries(o)) {
    if (k === 'to') continue;
    if (k === 'effects' && Array.isArray(v)) out.push(...doLines('do', v, `${ind}  `));
    else if (k === 'text' && Array.isArray(v)) out.push(...paras(v, `${ind}  `));
    else out.push(...json(k, v, `${ind}  `));
  }
  return out;
}
function choice(c: Record<string, unknown>, ind: string): string[] {
  const label = c.label as string;
  const simple = typeof label === 'string' && !label.includes('\n') && !label.includes(' → ') && label === label.trim() && !label.startsWith('@');
  const to = c.to as string;
  if (!simple || typeof to !== 'string' || /\s/.test(to)) return json('choice', c, ind);
  const out = [`${ind}> ${label} → ${to}${c.id !== undefined ? `  #${c.id}` : ''}`];
  const flags = [c.once === true ? 'once' : '', c.hideWhenBlocked === true ? 'hide' : ''].filter(Boolean);
  if (flags.length) out.push(`${ind}  ${flags.join(' ')}`);
  for (const [k, v] of Object.entries(c)) {
    if (['id', 'label', 'to'].includes(k) || (k === 'once' && v === true) || (k === 'hideWhenBlocked' && v === true)) continue;
    if (k === 'requires' && Array.isArray(v)) out.push(`${ind}  ? ${reqList(v)}`);
    else if (k === 'effects' && Array.isArray(v)) out.push(...doLines('do', v, `${ind}  `));
    else if (k === 'check' && isObj(v) && typeof v.skill === 'string' && typeof v.dc === 'number' && typeof v.failTo === 'string'
      && Object.keys(v).every((x) => ['skill', 'dc', 'failTo', 'failEffects', 'roller'].includes(x))) {
      out.push(`${ind}  check ${v.skill} ${v.dc} → ${v.failTo}`);
      if (Array.isArray(v.failEffects)) out.push(...doLines('fail do', v.failEffects, `${ind}  `));
      if (typeof v.roller === 'string') out.push(`${ind}  check roller: ${v.roller}`);
    } else if ((k === 'attempt' || k === 'hint') && scalarOk(v) && typeof v === 'string') out.push(`${ind}  ${k}: ${v}`);
    else out.push(...json(k, v, `${ind}  `));
  }
  return out;
}

/** One scene as text. */
export function printScene(id: Id, sc: Record<string, unknown>, opts: PrintNames = {}): string {
  names = opts;
  try {
    const whole = nameFor(sc);
    if (whole) return `# ${id} = ${whole}`;
    const kind = sc.kind as string;
    const main = PROSE_OF[kind];
    const out = [`# ${id}`];
    if (sc.id !== id) out.push(...json('id', sc.id, ''));
    if (kind !== 'story') out.push(`kind: ${kind}`);
    const rest: string[] = [];
    const tail: string[] = [];
    for (const [k, v] of Object.entries(sc)) {
      if (k === 'id' || k === 'kind') continue;
      if (k === 'art' && isObj(v) && Object.keys(v).every((x) => x === 'imageId' || x === 'emoji')
        && (v.imageId === undefined || /^[a-z][a-z0-9-]*$/.test(v.imageId as string)) && (v.emoji === undefined || (typeof v.emoji === 'string' && !/\s/.test(v.emoji) && !/^[a-z]/.test(v.emoji))) && (v.imageId || v.emoji)) {
        out.push(`art: ${[v.imageId, v.emoji].filter(Boolean).join(' ')}`);
      } else if (k === 'assumes' && Array.isArray(v)) out.push(`assumes: ${reqList(v)}`);
      else if (PROSE.includes(k) && Array.isArray(v)) {
        if (k === main) rest.unshift(...paras(v, ''));
        else rest.push(`${k}:`, ...paras(v, ''));
      } else if (k === 'next' && Array.isArray(v)) {
        for (const c of nameRuns(v as Record<string, unknown>[], 0, (x) => JSON.stringify(x))) {
          if (c.startsWith('@')) tail.push(`> ${c}`);
          else tail.push(...choice(JSON.parse(c) as Record<string, unknown>, ''));
        }
      } else if (Object.values(OUTCOMES).includes(k) && isObj(v) && typeof v.to === 'string' && !/\s/.test(v.to)) {
        tail.push(...outcome(Object.keys(OUTCOMES).find((w) => OUTCOMES[w] === k)!, v, ''));
      } else if (k === 'parley' && isObj(v) && typeof v.skill === 'string' && typeof v.dc === 'number' && typeof v.label === 'string' && !nameFor(v)
        && Object.keys(v).every((x) => ['skill', 'dc', 'label', 'refused', 'success', 'failure', 'attempt'].includes(x))
        && (!v.refused || (Array.isArray(v.refused) && v.refused.every((r) => typeof r === 'string')))) {
        tail.push(`parley ${v.skill} ${v.dc} > ${v.label}`);
        if (typeof v.attempt === 'string') tail.push(`  attempt: ${v.attempt}`);
        for (const r of (v.refused as string[] | undefined) ?? []) tail.push(`  refused: ${r}`);
        if (isObj(v.success)) tail.push(...outcome('success', v.success, '  '));
        if (isObj(v.failure)) tail.push(...outcome('failure', v.failure, '  '));
      } else if (k === 'approaches' && Array.isArray(v)) {
        for (const a of v as Record<string, unknown>[]) {
          tail.push(`approach ${a.id} ${a.skill} ${a.dc} > ${a.label}`);
          for (const [ak, av] of Object.entries(a)) {
            if (['id', 'skill', 'dc', 'label'].includes(ak)) continue;
            if (ak === 'requires' && Array.isArray(av)) tail.push(`  ? ${reqList(av)}`);
            else if (ak === 'hideWhenBlocked' && av === true) tail.push('  hide');
            else if ((ak === 'success' || ak === 'failure') && isObj(av)) tail.push(...outcome(ak, av, '  '));
            else if ((ak === 'hint' || ak === 'roller') && typeof av === 'string' && scalarOk(av)) tail.push(`  ${ak}: ${av}`);
            else tail.push(...json(ak, av, '  '));
          }
        }
      } else if (scalarOk(v)) out.push(`${k}: ${v}`);
      else {
        const n = nameFor(v);
        out.push(...(n ? [`${k}: ${n}`] : json(k, v, '')));
      }
    }
    return [...out, ...rest, ...tail].join('\n');
  } finally { names = {}; }
}

/** A file of scenes. */
export function printStory(scenes: Record<Id, unknown>, opts: PrintNames = {}): string {
  return Object.entries(scenes).map(([id, sc]) => printScene(id, sc as Record<string, unknown>, opts)).join('\n\n') + '\n';
}

// --- Parsing -----------------------------------------------------------------

interface Line { text: string; ind: number; no: number; kids: Line[] }

function tree(lines: Array<{ text: string; no: number }>): Line[] {
  const root: Line = { text: '', ind: -1, no: 0, kids: [] };
  const stack = [root];
  for (const l of lines) {
    const ind = l.text.length - l.text.trimStart().length;
    const node: Line = { text: l.text.trim(), ind, no: l.no, kids: [] };
    while (stack.length > 1 && stack[stack.length - 1]!.ind >= ind) stack.pop();
    stack[stack.length - 1]!.kids.push(node);
    stack.push(node);
  }
  return root.kids;
}
const rawJson = (l: Line): string => [l.text, ...l.kids.map(rawJson)].join('\n');

/** Parse a `.story` file: scenes by id, with markers (see `resolve`). */
export function parseStory(text: string, file = 'story'): Record<Id, unknown> {
  const scenes: Record<Id, unknown> = {};
  let cur: { id: Id; lines: Array<{ text: string; no: number }>; head: string; no: number } | undefined;
  const flush = () => {
    if (!cur) return;
    if (cur.lines.some((l) => l.text.trim() === 'kind: rescue')) {
      for (const [id, lines] of expandRescue(cur.id, cur.lines, `${file}:${cur.no}`)) {
        if (scenes[id]) throw new Error(`${file}:${cur.no}: '${id}' twice`);
        scenes[id] = parseScene(id, '', lines, `${file}:${cur.no}`);
      }
    } else if (cur.lines.some((l) => l.text.trim() === 'kind: obstacle')) {
      for (const [id, lines] of expandObstacle(cur.id, cur.lines, `${file}:${cur.no}`)) {
        if (scenes[id]) throw new Error(`${file}:${cur.no}: '${id}' twice`);
        scenes[id] = parseScene(id, '', lines, `${file}:${cur.no}`);
      }
    } else scenes[cur.id] = parseScene(cur.id, cur.head, cur.lines, `${file}:${cur.no}`);
  };
  text.split('\n').forEach((raw, i) => {
    const no = i + 1;
    if (/^\s*\/\//.test(raw) || !raw.trim()) return;
    const h = /^# (\S+)(?: = (.+))?$/.exec(raw);
    if (h) {
      flush();
      if (scenes[h[1]!]) throw new Error(`${file}:${no}: '${h[1]}' twice`);
      cur = { id: h[1]!, lines: [], head: h[2] ?? '', no };
      return;
    }
    if (!cur) throw new Error(`${file}:${no}: text before the first scene`);
    cur.lines.push({ text: raw, no });
  });
  flush();
  return scenes;
}

/**
 * An obstacle (`kind: obstacle`): a threat or a barrier in the way, met by a
 * fight or by a skill, written as one block and read as the scenes it
 * always was.
 *
 *     # barrow
 *     kind: obstacle
 *     art: 🪦
 *     fight: barrow-haunt on corridor      the encounter and its board, if it has one
 *     done: barrow-cleared                 set by the fight won or any answer
 *     after: @hub                          where a way past goes (default @hub)
 *     return: Back to the trail            an answer's way on (default "Go on")
 *     leave: Leave the dead their peace  #leave
 *     as: dialogue                         the approach's kind, if not a story
 *     (the approach: prose, its own again:, and any choices of its own)
 *     answer religion 13 > Say the old words over the capstone  #settle
 *     (what that answer does: prose, and do lines; and, as it needs them:)
 *       ? <requirements>   to: <scene>   go: <label>  #id   tag: Rogue   attempt: <shared try>
 *       like: <another answer> (its outcomes, not its own)
 *       retry   roller: group   failed → <scene>   failed: (its own prose,
 *       do lines, and go: <label> → <scene>  #id)
 *     fight > Go down into the dark  #in   (and ? <requirements>)
 *     (the fight's own intro, again:, parley)
 *     won:
 *     (what winning does: prose, and do lines)
 *
 * It becomes `barrow` (the approach, its own choices first, then the rest
 * in the order written), `barrow-fight` (the battle), `barrow-settle` (each
 * answer's success: it sets `done`, and pays the fight's avoided XP) and,
 * where an answer has its own failure, `barrow-settle-failed`. A failed
 * answer otherwise leads into the fight.
 */
function expandObstacle(id: Id, lines: Array<{ text: string; no: number }>, where: string): Array<[Id, Array<{ text: string; no: number }>]> {
  type L = { text: string; no: number };
  const field = (k: string) => lines.find((l) => l.text.startsWith(`${k}: `))?.text.slice(k.length + 2);
  const fight = /^(\S+) on (\S+)$/.exec(field('fight') ?? '');
  const done = field('done');
  const after = field('after') ?? '@hub', ret = field('return') ?? 'Go on', leave = field('leave');
  const own = new Set(['kind', 'as', 'fight', 'done', 'after', 'return', 'leave']);
  const SECTION = /^(fight|answer (\S+) (\d+)) > (.+?)\s+#([\w-]+)$|^won:$|^failed:$/;
  type Answer = { id: string; label: string; skill: string; dc: string; lines: L[]; failed: L[]; failTo?: string };
  const approach: L[] = [], fightLines: L[] = [], won: L[] = [];
  const answers: Answer[] = [];
  const order: Array<{ kind: 'fight'; label: string; cid: string } | { kind: 'answer'; a: Answer }> = [];
  let into: L[] = approach;
  let cur: Answer | undefined;
  let fightReqs: string[] = [];
  for (const l of lines) {
    const k = /^(\w[\w-]*): /.exec(l.text)?.[1];
    if (into === approach && k && own.has(k)) continue;
    const m = SECTION.exec(l.text);
    if (!m) {
      const fail = /^failed → (\S+)$/.exec(l.text);
      if (cur && fail) { cur.failTo = fail[1]!; continue; }
      if (into === fightLines && /^\? [^|]+$/.test(l.text)) { fightReqs.push(l.text.slice(2)); continue; }
      into.push(l); continue;
    }
    if (l.text === 'won:') { into = won; cur = undefined; continue; }
    if (l.text === 'failed:') { if (!cur) throw new Error(`${where}: 'failed:' outside an answer`); into = cur.failed; continue; }
    if (m[1] === 'fight') {
      order.push({ kind: 'fight', label: m[4]!, cid: m[5]! });
      into = fightLines; cur = undefined;
    } else {
      cur = { id: m[5]!, label: m[4]!, skill: m[2]!, dc: m[3]!, lines: [], failed: [] };
      answers.push(cur); order.push({ kind: 'answer', a: cur });
      into = cur.lines;
    }
  }
  if (!fight && order.some((o) => o.kind === 'fight')) throw new Error(`${where}: an obstacle with a fight section needs 'fight: <encounter> on <map>'`);
  const at = lines[0]?.no ?? 0;
  const mk = (text: string): L => ({ text, no: at });
  const art = field('art');
  const opt = (ls: L[], k: string) => ls.find((l) => l.text.startsWith(`${k}: `))?.text.slice(k.length + 2);
  const flag = (ls: L[], k: string) => ls.some((l) => l.text === k);
  const OPTS = /^(\? [^|]+|to: .*|go: .*|tag: .*|attempt: .*|like: .*|retry|roller: .*|do .*)$/;
  const prose = (ls: L[]) => ls.filter((l) => !OPTS.test(l.text));
  const does = (ls: L[]) => ls.filter((l) => l.text.startsWith('do ')).map((l) => l.text.slice(3));
  const reqs = (ls: L[]) => ls.filter((l) => /^\? [^|]+$/.test(l.text)).map((l) => l.text.slice(2));
  const effects = (more: string[], avoided: boolean) => {
    const all = [...(done ? [`+${done}`] : []), ...(avoided && fight ? [`xp avoided ${fight[1]}`] : []), ...more];
    return all.length ? [`  do ${all.join('; ')}`] : [];
  };
  const skillName = (skill: string) => skill.split('-').map((w, i) => (i && ['of', 'and'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  const choices: string[] = [];
  for (const o of order) {
    if (o.kind === 'fight') {
      choices.push(`> ${o.label} → ${id}-fight  #${o.cid}`, ...(fightReqs.length ? ['  hide', `  ? ${fightReqs.join('; ')}`] : []));
      continue;
    }
    const a = o.a, tag = opt(a.lines, 'tag'), roller = opt(a.lines, 'roller');
    // `like: <answer>`: the same outcomes as another answer (a class's own
    // easier way to the same place).
    const like = opt(a.lines, 'like');
    const twin = like ? answers.find((x) => x.id === like) : undefined;
    if (like && !twin) throw new Error(`${where}: answer '${a.id}' is like '${like}', and there is no such answer`);
    const base = twin ?? a;
    const failTo = base.failTo ?? (base.failed.length ? `${id}-${base.id}-failed` : fight ? `${id}-fight` : undefined);
    if (!failTo) throw new Error(`${where}: answer '${a.id}' fails into nothing: give it 'failed:' or the obstacle a fight`);
    const r = reqs(a.lines);
    choices.push(`> [${tag ? `${tag} · ` : ''}${skillName(a.skill)} DC ${a.dc}] ${a.label} → ${id}-${base.id}  #${a.id}`,
      // A shared attempt is one try between them already: no `once` of its own.
      opt(a.lines, 'attempt') || flag(a.lines, 'retry') ? '  hide' : '  once hide', ...(r.length ? [`  ? ${r.join('; ')}`] : []),
      ...(opt(a.lines, 'attempt') ? [`  attempt: ${opt(a.lines, 'attempt')}`] : []),
      `  check ${a.skill} ${a.dc} → ${failTo}`, ...(roller ? [`  check roller: ${roller}`] : []));
  }
  if (leave) choices.push(`> ${leave.replace(/\s+#([\w-]+)$/, ` → ${after}  #$1`)}`);
  const goOf = (ls: L[], to: string, fallback: string) => {
    const go = opt(ls, 'go');
    if (!go) return `> ${fallback} → ${to}  #ok`;
    const m = /^(.+?)(?: → (\S+))?\s+#([\w-]+)$/.exec(go);
    if (!m) throw new Error(`${where}: 'go: ${go}' wants '<label>  #id' (or '<label> → <scene>  #id')`);
    return `> ${m[1]} → ${m[2] ?? to}  #${m[3]}`;
  };
  const out: Array<[Id, L[]]> = [[id, [...(field('as') ? [mk(`kind: ${field('as')}`)] : []), ...approach, ...choices.map(mk)]]];
  if (fight) {
    out.push([`${id}-fight`, [mk('kind: battle'), mk(`encounterId: ${fight[1]}`), mk(`mapId: ${fight[2]}`), ...fightLines,
      mk(`won → ${after}`), ...prose(won).map((l) => ({ ...l, text: `  ${l.text}` })), ...effects(does(won), false).map(mk)]]);
  }
  for (const a of answers) {
    if (opt(a.lines, 'like')) continue;
    out.push([`${id}-${a.id}`, [mk('noBack: true'), ...(art ? [mk(`art: ${art}`)] : []), ...prose(a.lines),
      mk(goOf(a.lines, opt(a.lines, 'to') ?? after, ret)), ...effects(does(a.lines), true).map(mk)]]);
    if (a.failed.length) {
      const f = does(a.failed);
      out.push([`${id}-${a.id}-failed`, [mk('noBack: true'), ...(art ? [mk(`art: ${art}`)] : []), ...prose(a.failed),
        mk(goOf(a.failed, id, 'Back')), ...(f.length ? [mk(`  do ${f.join('; ')}`)] : [])]]);
    }
  }
  return out;
}

/**
 * A rescue (`kind: rescue`): someone hurt on the road, written as one block.
 *
 *     # wounded
 *     kind: rescue
 *     npc: @SCOUT                          (the approach is a dialogue with them)
 *     who: wren                            their registry id
 *     walked: scout-walked-past            set when the party walks past
 *     saved do: @WREN_SAVED                what saving them does, either way
 *     (the approach's prose)
 *     heal item potion-healing > Give her a healing potion  #potion
 *     heal religion 9 paladin > Lay hands on the wound  #lay-hands
 *     heal medicine 12 > Ease her out and bind the leg  #medicine
 *     leave > Leave her and press on  #leave
 *     (what walking past is)
 *     saved:                               (prose; then)
 *     send > Send {wren} back to {thornwick}  #ok
 *     join > Ask {wren} to come with you  #come    (and ? <requirements>)
 *     joins:   failed:   passed:   dead:   gone:   along:   sent:
 *     (each: its prose, `do` lines, and `go: <label>  #id`)
 *
 * It becomes the approach (`wounded`) and `wounded-saved`, `-failed`,
 * `-left`, `-joins`, and the room's later visits (`-passed`, `-dead`,
 * `-gone`, `-along`, `-sent`; see `rescueWhen`). A heal by class is shown
 * only to that class; a check failed still saves them, slower (`failed`,
 * which costs the day).
 */
function expandRescue(id: Id, lines: Array<{ text: string; no: number }>, where: string): Array<[Id, Array<{ text: string; no: number }>]> {
  type L = { text: string; no: number };
  const field = (k: string) => lines.find((l) => l.text.startsWith(`${k}: `))?.text.slice(k.length + 2);
  const who = field('who'), walked = field('walked');
  if (!who || !walked) throw new Error(`${where}: a rescue needs 'who: <npc>' and 'walked: <flag>'`);
  const savedDo = field('saved do');
  const own = new Set(['kind', 'who', 'walked', 'saved do']);
  const SECTIONS = ['saved', 'joins', 'failed', 'passed', 'dead', 'gone', 'along', 'sent'];
  const sec: Record<string, L[]> = { approach: [], left: [] };
  const heals: string[] = [];
  let send = '', join: { label: string; reqs: string[] } | undefined;
  let into = 'approach';
  const skillName = (skill: string) => skill.split('-').map((w, i) => (i && ['of', 'and'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  let leave = '';
  for (const l of lines) {
    const t = l.text;
    const k = /^(\w[\w -]*?): /.exec(t)?.[1];
    if (into === 'approach' && k && own.has(k)) continue;
    let m: RegExpExecArray | null;
    if ((m = /^(\w+):$/.exec(t)) && SECTIONS.includes(m[1]!)) { into = m[1]!; (sec[into] ??= []); continue; }
    if ((m = /^heal item (\S+) > (.+?)\s+#([\w-]+)$/.exec(t))) {
      heals.push(`> ${m[2]} → ${id}-saved  #${m[3]}`, '  hide', `  ? item ${m[1]}`, `  do drop ${m[1]} x1`); continue;
    }
    if ((m = /^heal (\S+) (\d+)(?: (\w+))? > (.+?)\s+#([\w-]+)$/.exec(t))) {
      const [, skill, dc, cls, label, cid] = m;
      heals.push(`> [${cls ? `${cap(cls)} · ` : ''}${skillName(skill!)} DC ${dc}] ${label} → ${id}-saved  #${cid}`,
        ...(cls ? ['  hide', `  ? class ${cls}`] : []), `  attempt: ${id}-wound`, `  check ${skill} ${dc} → ${id}-failed`);
      continue;
    }
    if ((m = /^leave > (.+?)\s+#([\w-]+)$/.exec(t))) { leave = `> ${m[1]} → ${id}-left  #${m[2]}`; into = 'left'; continue; }
    if ((m = /^send > (.+?)\s+#([\w-]+)$/.exec(t))) { send = `${m[1]}|${m[2]}`; continue; }
    if ((m = /^join > (.+?)\s+#([\w-]+)$/.exec(t))) { join = { label: `${m[1]}|${m[2]}`, reqs: [] }; continue; }
    if (join && into === 'saved' && /^\? [^|]+$/.test(t)) { join.reqs.push(t.slice(2)); continue; }
    (sec[into] ??= []).push(l);
  }
  if (!heals.length || !leave || !send) throw new Error(`${where}: a rescue needs a 'heal', a 'leave' and a 'send'`);
  const at = lines[0]?.no ?? 0;
  const mk = (text: string): L => ({ text, no: at });
  const art = field('art');
  const OPT = /^(go: .*|do .*)$/;
  const body = (ls: L[]) => ls.filter((l) => !OPT.test(l.text));
  const does = (ls: L[]) => ls.filter((l) => l.text.startsWith('do ')).map((l) => l.text.slice(3));
  const go = (ls: L[], fallback: string) => {
    const g = ls.find((l) => l.text.startsWith('go: '))?.text.slice(4);
    const m = g ? /^(.+?)(?: → (\S+))?\s+#([\w-]+)$/.exec(g) : undefined;
    return m ? `> ${m[1]} → ${m[2] ?? '@hub'}  #${m[3]}` : `> ${fallback} → @hub  #ok`;
  };
  const scene = (sid: string, ls: L[], fallback: string, more: string[] = []): [Id, L[]] => {
    const d = [...more, ...does(ls)];
    return [sid, [mk('noBack: true'), ...(art ? [mk(`art: ${art}`)] : []), ...body(ls), mk(go(ls, fallback)), ...(d.length ? [mk(`  do ${d.join('; ')}`)] : [])]];
  };
  const saveDo = [...(savedDo ? [savedDo] : []), `npc ${who} attitude 1`];
  const [sendLabel, sendId] = send.split('|');
  const saved = sec.saved ?? [];
  const out: Array<[Id, L[]]> = [
    [id, [...lines.filter((l) => /^(npc|art|@npc): /.test(l.text)).map((l) => l), mk('kind: dialogue'), mk('noBack: true'),
      ...(sec.approach ?? []).filter((l) => !/^(npc|art|@npc): /.test(l.text)), ...heals.map(mk), mk(leave), mk(`  do +${walked}; npc ${who} attitude -2`)]],
    [`${id}-saved`, [mk('noBack: true'), ...(art ? [mk(`art: ${art}`)] : []), ...body(saved),
      mk(`> ${sendLabel} → @hub  #${sendId}`), mk(`  do ${saveDo.join('; ')}`),
      ...(join ? [mk(`> ${join.label.split('|')[0]} → ${id}-joins  #${join.label.split('|')[1]}`), mk('  hide'),
        ...(join.reqs.length ? [mk(`  ? ${join.reqs.join('; ')}`)] : []), mk(`  do ${saveDo.join('; ')}; join ${who}`)] : [])]],
    [`${id}-failed`, [mk('noBack: true'), ...(art ? [mk(`art: ${art}`)] : []), ...body(sec.failed ?? []),
      mk(go(sec.failed ?? [], `${sendLabel}`).replace(/#ok$/, `#${sendId}`)), mk(`  do ${[...(savedDo ? [savedDo] : []), 'day', ...does(sec.failed ?? [])].join('; ')}`)]],
    scene(`${id}-left`, sec.left ?? [], 'Keep walking'),
  ];
  if (join) out.push(scene(`${id}-joins`, sec.joins ?? [], 'Go on'));
  for (const k of ['passed', 'dead', 'gone', 'along', 'sent']) if (sec[k]) out.push(scene(`${id}-${k}`, sec[k]!, 'Go on'));
  return out;
}

function parseScene(id: Id, head: string, lines: Array<{ text: string; no: number }>, where: string): unknown {
  if (head) {
    const ref = parseRef(head);
    if (!ref) throw new Error(`${where}: '${head}' is not a part`);
    return ref;
  }
  const sc: Record<string, unknown> = { id };
  let field: string | undefined;
  const at = (l: Line) => `${where.replace(/:\d+$/, '')}:${l.no}`;
  const fieldFor = () => field ?? PROSE_OF[(sc.kind as string) ?? 'story'] ?? 'text';
  const push = (k: string, v: unknown) => { ((sc[k] ??= []) as unknown[]).push(v); };
  const nodes = tree(lines);
  // The kind first: it decides where prose goes.
  for (const l of nodes) { const m = /^kind: (\S+)$/.exec(l.text); if (m) sc.kind = m[1]; }
  sc.kind ??= 'story';
  // Keep `id`, `kind` first, as a scene is written.
  for (const l of nodes) {
    const t = l.text;
    let m: RegExpExecArray | null;
    if (/^kind: /.test(t)) continue;
    if ((m = /^@([\w]+):(?: (.*))?$/s.exec(t))) { sc[m[1]!] = JSON.parse(m[2] !== undefined ? m[2] : l.kids.map(rawJson).join('\n')); continue; }
    if ((m = /^(text|lines|intro|again):$/.exec(t))) { field = m[1]; continue; }
    if ((m = /^art: (.+)$/.exec(t))) {
      const art: Record<string, string> = {};
      for (const tok of m[1]!.split(' ')) { if (/^[a-z][a-z0-9-]*$/.test(tok)) art.imageId = tok; else art.emoji = tok; }
      sc.art = art; continue;
    }
    if ((m = /^assumes: (.+)$/.exec(t))) { sc.assumes = splitList(m[1]!).map((x) => parseReq(x, at(l))); continue; }
    if (t.startsWith('> ')) { push('next', parseChoice(l, at)); continue; }
    if ((m = /^(won|lost|success|failure) → (\S+)$/.exec(t))) { sc[OUTCOMES[m[1]!]!] = parseOutcome(l, m[2]!, at); continue; }
    if ((m = /^parley (\S+) (\d+) > (.+)$/.exec(t))) {
      const p: Record<string, unknown> = { skill: m[1], dc: Number(m[2]), label: m[3] };
      for (const k of l.kids) {
        let km: RegExpExecArray | null;
        if ((km = /^attempt: (.+)$/.exec(k.text))) p.attempt = km[1];
        else if ((km = /^refused: (.+)$/.exec(k.text))) ((p.refused ??= []) as unknown[]).push(km[1]);
        else if ((km = /^(success|failure) → (\S+)$/.exec(k.text))) p[km[1]!] = parseOutcome(k, km[2]!, at);
        else throw new Error(`${at(k)}: what is '${k.text}' in a parley?`);
      }
      sc.parley = p; continue;
    }
    if ((m = /^approach (\S+) (\S+) (\d+) > (.+)$/.exec(t))) {
      const a: Record<string, unknown> = { id: m[1], label: m[4], skill: m[2], dc: Number(m[3]) };
      for (const k of l.kids) {
        let km: RegExpExecArray | null;
        if ((km = /^\? (.+)$/.exec(k.text))) a.requires = splitList(km[1]!).map((x) => parseReq(x, at(k)));
        else if (k.text === 'hide') a.hideWhenBlocked = true;
        else if ((km = /^(success|failure) → (\S+)$/.exec(k.text))) a[km[1]!] = parseOutcome(k, km[2]!, at);
        else if ((km = /^(hint|roller): (.+)$/.exec(k.text))) a[km[1]!] = km[2];
        else if ((km = /^@(\w+):(?: (.*))?$/s.exec(k.text))) a[km[1]!] = JSON.parse(km[2] !== undefined ? km[2] : k.kids.map(rawJson).join('\n'));
        else throw new Error(`${at(k)}: what is '${k.text}' in an approach?`);
      }
      push('approaches', a); continue;
    }
    if ((m = /^([A-Za-z][\w-]*): (.+)$/.exec(t)) && !/^[?@\\]/.test(t)) {
      const v = m[2]!;
      sc[m[1]!] = v.startsWith('@') ? parseRef(v) : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v;
      continue;
    }
    push(fieldFor(), parsePara(t, at(l)));
  }
  return sc;
}

function parsePara(t: string, where: string): unknown {
  if (t.startsWith('\\')) return t.slice(1);
  if (t.startsWith('@json ')) return JSON.parse(t.slice(6));
  const ref = parseRef(t);
  if (ref) return { $spread: ref };
  const m = /^(\? (.+?))?\s?(\?! (.+?))? \| (.+)$/.exec(t);
  if (m && (m[2] || m[4])) {
    return { ...(m[2] ? { if: splitList(m[2]).map((x) => parseReq(x, where)) } : {}),
      ...(m[4] ? { assumes: splitList(m[4]).map((x) => parseReq(x, where)) } : {}), text: m[5] };
  }
  if (/^[?>#]/.test(t)) throw new Error(`${where}: cannot read '${t.slice(0, 40)}'`);
  return t;
}

function parseOutcome(l: Line, to: string, at: (l: Line) => string): unknown {
  const o: Record<string, unknown> = { to };
  for (const k of l.kids) {
    let m: RegExpExecArray | null;
    if ((m = /^do (.+)$/.exec(k.text))) o.effects = [...(o.effects as unknown[] ?? []), ...splitList(m[1]!).map((x) => parseEff(x, at(k)))];
    else if (k.text === 'do:') o.effects = [...(o.effects as unknown[] ?? []), JSON.parse(k.kids.map(rawJson).join('\n'))];
    else if (k.text.startsWith('journal ')) o.effects = [...(o.effects as unknown[] ?? []), parseJournal(k, at)];
    else if ((m = /^@(\w+):(?: (.*))?$/s.exec(k.text)) && m[1] !== 'json') o[m[1]!] = JSON.parse(m[2] !== undefined ? m[2] : k.kids.map(rawJson).join('\n'));
    else ((o.text ??= []) as unknown[]).push(parsePara(k.text, at(k)));
  }
  return o;
}

function parseChoice(l: Line, at: (l: Line) => string): unknown {
  const body = l.text.slice(2);
  const ref = parseRef(body);
  if (ref) return { $spread: ref };
  const m = /^(.*) → (\S+?)(?:\s+#(\S+))?$/.exec(body);
  if (!m) throw new Error(`${at(l)}: a choice is '> label → scene  #id'`);
  const c: Record<string, unknown> = { ...(m[3] !== undefined ? { id: m[3] } : {}), label: m[1], to: m[2] };
  for (const k of l.kids) {
    const t = k.text;
    let km: RegExpExecArray | null;
    if (/^(once|hide)( (once|hide))*$/.test(t)) { for (const w of t.split(' ')) c[w === 'once' ? 'once' : 'hideWhenBlocked'] = true; }
    else if ((km = /^\? (.+)$/.exec(t))) c.requires = splitList(km[1]!).map((x) => parseReq(x, at(k)));
    else if ((km = /^do (.+)$/.exec(t))) c.effects = [...(c.effects as unknown[] ?? []), ...splitList(km[1]!).map((x) => parseEff(x, at(k)))];
    else if (t === 'do:') c.effects = [...(c.effects as unknown[] ?? []), JSON.parse(k.kids.map(rawJson).join('\n'))];
    else if (t.startsWith('journal ')) c.effects = [...(c.effects as unknown[] ?? []), parseJournal(k, at)];
    else if ((km = /^check (\S+) (\d+) → (\S+)$/.exec(t))) c.check = { ...(c.check as object ?? {}), skill: km[1], dc: Number(km[2]), failTo: km[3] };
    else if ((km = /^fail do (.+)$/.exec(t))) { const ch = (c.check ?? {}) as Record<string, unknown>; c.check = { ...ch, failEffects: [...(ch.failEffects as unknown[] ?? []), ...splitList(km[1]!).map((x) => parseEff(x, at(k)))] }; }
    else if (t === 'fail do:') { const ch = (c.check ?? {}) as Record<string, unknown>; c.check = { ...ch, failEffects: [...(ch.failEffects as unknown[] ?? []), JSON.parse(k.kids.map(rawJson).join('\n'))] }; }
    else if ((km = /^check roller: (\S+)$/.exec(t))) c.check = { ...(c.check as object ?? {}), roller: km[1] };
    else if ((km = /^(attempt|hint): (.+)$/.exec(t))) c[km[1]!] = km[2];
    else if ((km = /^@(\w+):(?: (.*))?$/s.exec(t))) c[km[1]!] = JSON.parse(km[2] !== undefined ? km[2] : k.kids.map(rawJson).join('\n'));
    else throw new Error(`${at(k)}: what is '${t}' under a choice?`);
  }
  return c;
}

// --- TypeScript for the build ----------------------------------------------------

/** The scenes as TypeScript: markers become calls to the chapter's parts and facts. */
export function emitScenes(scenes: Record<Id, unknown>): { code: string; parts: string[] } {
  const used = new Set<string>();
  const ids = (s: string) => { for (const m of s.matchAll(/\b[A-Z][A-Z0-9_]+\b/g)) used.add(m[0]); };
  const em = (x: unknown, ind: string): string => {
    if (Array.isArray(x)) {
      if (!x.length) return '[]';
      const inner = x.map((v) => (isSpread(v) ? `...[${em(v.$spread, ind + '  ')}].flat()` : em(v, ind + '  ')));
      const one = `[${inner.join(', ')}]`;
      return one.length < 100 && !one.includes('\n') ? one : `[\n${inner.map((v) => `${ind}  ${v},`).join('\n')}\n${ind}]`;
    }
    if (isMarker(x)) {
      if ('$ref' in x) { used.add(x.$ref); return x.$ref; }
      if ('$call' in x) { used.add(x.$call); ids(x.args); return `${x.$call}(${x.args})`; }
      if ('$fact' in x) return `${x.neg ? '-' : ''}factValue(${JSON.stringify(x.$fact)})`;
      return `avoidedFightXP(${JSON.stringify(x.$avoided)})${x.less ? ` - avoidedFightXP(${JSON.stringify(x.less)})` : ''}`;
    }
    if (isObj(x)) {
      const inner = Object.entries(x).map(([k, v]) => `${/^[A-Za-z_]\w*$/.test(k) ? k : JSON.stringify(k)}: ${em(v, ind + '  ')}`);
      const one = `{ ${inner.join(', ')} }`;
      return one.length < 100 && !one.includes('\n') ? one : `{\n${inner.map((v) => `${ind}  ${v},`).join('\n')}\n${ind}}`;
    }
    return JSON.stringify(x);
  };
  const body = Object.entries(scenes).map(([id, sc]) => `  ${JSON.stringify(id)}: ${em(sc, '  ')},`).join('\n');
  return { code: body, parts: [...used].sort() };
}
