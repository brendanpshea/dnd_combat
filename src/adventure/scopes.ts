/**
 * Places: a chapter's locations, each answering to a few flags of its own
 * rather than to the whole chapter (Module.places).
 *
 * A place is a location as the module map groups it: its hub and the scenes
 * the party walks into from there. It declares what it `reads` from the rest
 * of the chapter and what it `exports` back. Everything else it sets is its
 * own: local, read nowhere outside it. The budget caps how much a place
 * answers to (reads plus its own flags), so state grows by place, not by
 * chapter. NPC state is the campaign's and is never counted.
 *
 * A generated delve proved apart is a place by construction: its rooms'
 * flags are its own, and the chapter sees only its outside (outside.ts).
 */
import type { Id } from '../engine/types.js';
import type { Module, Para, Requirement } from './types.js';
import { moduleMap } from './module-map.js';
import { effectsOf, parasOf, requirementsOf } from './graph.js';
import { isNpcFlag } from './npcs.js';
import { outsideOf } from './outside.js';

/** A place answers to at most this many flags unless it says otherwise. */
export const PLACE_BUDGET = 8;

const reqFlags = (rs: readonly Requirement[]): string[] =>
  rs.flatMap((r) => (r.kind === 'flag' || r.kind === 'notFlag' || r.kind === 'count' ? [r.flag] : []));
const paraFlags = (ps: readonly Para[]): string[] => ps.flatMap((p) => (typeof p === 'string' ? [] : reqFlags([...(p.if ?? []), ...(p.assumes ?? [])])));

export interface PlaceSpend { id: Id; scenes: number; reads: string[]; local: string[]; exports: string[]; budget: number }

/** What each declared place reads, keeps and hands on, and what breaks its declaration. */
export function checkPlaces(whole: Module): { spend: PlaceSpend[]; errors: string[] } {
  const errors: string[] = [];
  const spend: PlaceSpend[] = [];
  if (!whole.places) return { spend, errors };
  const module = outsideOf(whole);
  const map = moduleMap(module);
  const where = new Map(map.nodes.map((n) => [n.id, n.location]));
  const readsOf = (id: Id): string[] => {
    const s = module.scenes[id]!;
    return [...reqFlags(requirementsOf(s)), ...reqFlags('assumes' in s ? s.assumes ?? [] : []), ...parasOf(s).flatMap((p) => paraFlags(p.paras))];
  };
  const writesOf = (id: Id): string[] => effectsOf(module.scenes[id]!).flatMap((e) =>
    e.kind === 'setFlag' || e.kind === 'clearFlag' || e.kind === 'addFlag' ? [e.flag] : e.kind === 'copyFlag' ? [e.to] : []);
  const story = (f: string) => !isNpcFlag(f);
  // Read anywhere outside a place: its scenes, the dawns, the endings' slides.
  const dawnReads = (module.dawns ?? []).flatMap((d) => paraFlags(d.text));

  for (const [id, decl] of Object.entries(whole.places)) {
    const err = (m: string) => errors.push(`[place ${id}] ${m}`);
    if (!module.scenes[id]) { err('is not a scene'); continue; }
    const inside = [...where].filter(([, loc]) => loc === id).map(([s]) => s);
    const reads = new Set(inside.flatMap(readsOf).filter(story));
    const writes = new Set(inside.flatMap(writesOf).filter(story));
    const outsideReads = new Set([...where].filter(([, loc]) => loc !== id).flatMap(([s]) => readsOf(s)).concat(dawnReads));
    const exports = new Set(decl.exports ?? []);
    const declared = new Set(decl.reads);
    for (const f of reads) if (!writes.has(f) && !declared.has(f)) err(`reads '${f}', which it neither sets nor declares in reads`);
    for (const f of declared) if (!reads.has(f)) err(`declares it reads '${f}', and nothing in it does`);
    for (const f of exports) if (!writes.has(f)) err(`exports '${f}', which it never sets`);
    for (const f of writes) if (!exports.has(f) && outsideReads.has(f)) err(`'${f}' is read outside it: export it, or keep it in`);
    const local = [...writes].filter((f) => !exports.has(f)).sort();
    const budget = decl.budget ?? PLACE_BUDGET;
    const answers = new Set([...declared, ...writes]);
    if (answers.size > budget) err(`answers to ${answers.size} flags (${[...answers].sort().join(', ')}), over its budget of ${budget}`);
    spend.push({ id, scenes: inside.length, reads: [...declared].sort(), local, exports: [...exports].sort(), budget });
  }
  return { spend, errors };
}
