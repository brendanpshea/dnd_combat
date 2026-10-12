/**
 * Generated dungeons inside written stories.
 *
 * A written module names a delve by the scene id its story links to
 * (`Module.delves`). Each run rolls once — a seed, and a snapshot of the story
 * flags the delves read — and `liveModule` expands the module from that roll:
 * every delve becomes ordinary scenes (dungeon floors, fights, finds, its way
 * in and its ways out), spliced in under a prefix. The runtime, the save and
 * the UI never see anything new.
 *
 * Why a roll in the save and not a seed in the module id: everything else —
 * the menu, completion, sequels, save slots — matches modules by id, and
 * would have to learn to strip a seed back off it. The save already belongs
 * to one run; the roll is just more of what that run is.
 *
 * Why a snapshot: the delve must not change under the party's feet. The
 * flags are read once, when the roll is made (the start of the run, so they
 * are what the previous chapters carried in). Flags the story sets later are
 * read in play: a delve's `reads` stay un-namespaced, so its scenes may
 * require them.
 */
import type { Id } from '../engine/types.js';
import type { EmbeddedDelve, EmbeddedTown, Module, Outcome, Scene } from './types.js';
import type { AdventureState } from './runtime.js';
import { generateSpecDelve } from './delve-spec.js';
import { generateCity } from './city-gen.js';
import { validateModule } from './validate.js';

/** Keys whose string value names a scene. */
const SCENE_REF_KEYS = new Set(['to', 'fight', 'search', 'scene', 'battle', 'battleScene', 'out', 'failTo', 'next']);

/** Keys whose string value names a flag. `resolvedBy` too: a journal lead
 *  closes on a flag, and left un-renamed it waits forever on a name the
 *  splice gave to something else. */
const FLAG_KEYS = new Set(['flag', 'resolvedBy']);

/** Rewrite, in place, every scene reference and every flag. */
function rewrite(x: unknown, scene: (id: string) => string, flag: (f: string) => string): void {
  if (Array.isArray(x)) { for (const v of x) rewrite(v, scene, flag); return; }
  if (!x || typeof x !== 'object') return;
  const o = x as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') {
      if (FLAG_KEYS.has(k)) o[k] = flag(v);
      else if (SCENE_REF_KEYS.has(k)) o[k] = scene(v);
    } else rewrite(v, scene, flag);
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A generated place's scenes, spliced into a story. `at` is the scene id the
 * story links to; the place's door (its `start`) becomes that scene, and
 * everything else lives under `at/`. `exits` are the place's own endings
 * (a delve's victory, a town's road out), rerouted to the story's scenes;
 * `loss` is where a beaten party comes to, inside the place.
 */
function splice(
  at: Id, built: Record<Id, Scene>, exits: Record<Id, Outcome>, loss: Id | undefined,
  reads: readonly string[] = [], exports: Record<string, string> = {},
): Record<Id, Scene> {
  // Through JSON, not structuredClone: the generator shares effect objects
  // between scenes (a parley hands over the same key its fight does), a
  // structured clone keeps the sharing, and the rewrite below then renamed
  // one flag twice — `cellar/cellar/delve-key-2`, a key nothing ever set.
  const scenes = JSON.parse(JSON.stringify(built)) as Record<Id, Scene>;
  // The way in: the place's own door, without its "bring a fresh party up to
  // level" — in a story, the story's fights carry the levels.
  const door = scenes.start;
  // Reached from the story as an outcome: no implicit way back to a hub.
  if (door?.kind === 'story') door.noBack = true;
  if (door?.kind === 'story') door.next = door.next.map(({ effects, ...c }) => ({ ...c, ...(effects?.some((e) => e.kind !== 'xpToLevel') ? { effects: effects.filter((e) => e.kind !== 'xpToLevel') } : {}) }));
  // Beaten inside, the party comes to inside the place, not wherever the
  // story's own defeat scene is.
  if (loss) for (const s of Object.values(scenes)) if (s.kind === 'battle' && !s.onLoss) s.onLoss = { to: loss };

  const own = new Set(Object.keys(scenes));
  const keep = new Set(reads);
  const name = (id: Id) => (id === 'start' ? at : own.has(id) ? `${at}/${id}` : id);
  const out = Object.values(scenes);
  rewrite(out, name, (f) => exports[f] ?? (keep.has(f) ? f : `${at}/${f}`));
  for (const sc of out) sc.id = name(sc.id);
  /*
   * The ways out, back to the story. Not scenes of their own: every route
   * that led to one now leads straight to the story's scene, carrying the
   * story's effects. An in-between scene would be a page with one button —
   * and, for giving up, a place the validator rightly calls a dead end.
   *
   * After the rewrite, because these destinations and effects are the
   * STORY's: a story scene that happens to share a name with one of the
   * place's own ("outside") must not be dragged into its namespace.
   */
  const ways: Record<Id, Outcome> = Object.fromEntries(Object.entries(exits).map(([k, v]) => [`${at}/${k}`, v]));
  const reroute = (x: unknown): void => {
    if (Array.isArray(x)) { for (const v of x) reroute(v); return; }
    if (!x || typeof x !== 'object') return;
    const o = x as { to?: unknown; effects?: unknown[] };
    const exit = typeof o.to === 'string' ? ways[o.to] : undefined;
    if (exit) {
      o.to = exit.to;
      if (exit.effects?.length) o.effects = [...(o.effects ?? []), ...structuredClone(exit.effects)];
    }
    for (const v of Object.values(o)) reroute(v);
  };
  const kept = out.filter((sc) => !(sc.id in ways));
  reroute(kept);
  return Object.fromEntries(kept.map((sc) => [sc.id, sc]));
}

/** One delve, as scenes for the host (see `splice`). */
export function expandDelve(at: Id, delve: EmbeddedDelve, seed: number, story: ReadonlySet<string>): Record<Id, Scene> {
  const built = generateSpecDelve(seed, delve.spec, story).module;
  return splice(at, built.scenes, { won: delve.onWin, 'gave-up': delve.onLeave }, 'fallen', delve.reads, delve.exports);
}

/** One town, as scenes for the host (see `splice`). */
export function expandTown(at: Id, town: EmbeddedTown, seed: number): Record<Id, Scene> {
  const built = generateCity(seed, town.spec, { story: true }).module;
  return splice(at, built.scenes, { left: town.onLeave }, built.scenes.beaten ? 'beaten' : undefined, town.reads, town.exports);
}

/** Every generated place a module names, by the scene the story links to. */
const placesOf = (m: Module): { at: Id; reads: string[] }[] => [
  ...Object.entries(m.delves ?? {}).map(([at, d]) => ({ at, reads: d.reads ?? [] })),
  ...Object.entries(m.towns ?? {}).map(([at, t]) => ({ at, reads: t.reads ?? [] })),
];
const generates = (m: Module) => !!(m.delves || m.towns);

/** The roll a run makes for its module's delves, made once and kept in the save. */
export function rollDelves(module: Module, state: AdventureState, seed: number): void {
  if (!generates(module) || state.delveRoll) return;
  const reads = [...new Set(placesOf(module).flatMap((p) => p.reads))];
  const set = (f: string) => { const v = state.flags[f]; return v === true || (typeof v === 'number' && v > 0); };
  state.delveRoll = { seed: seed >>> 0, flags: reads.filter(set).sort() };
}

const cache = new WeakMap<Module, Map<string, Module>>();

/** The module as this roll builds it: delves expanded, everything else as written. */
export function expandModule(module: Module, roll: { seed: number; flags: readonly string[] }): Module {
  if (!generates(module)) return module;
  const key = `${roll.seed}|${roll.flags.join(',')}`;
  const mine = cache.get(module) ?? new Map<string, Module>();
  cache.set(module, mine);
  const hit = mine.get(key);
  if (hit) return hit;
  const story = new Set(roll.flags);
  const scenes: Record<Id, Scene> = { ...module.scenes };
  const add = (at: Id, made: Record<Id, Scene>) => {
    for (const [id, s] of Object.entries(made)) {
      if (scenes[id]) throw new Error(`'${at}' makes scene '${id}', which the story already has`);
      scenes[id] = s;
    }
  };
  for (const [at, delve] of Object.entries(module.delves ?? {})) add(at, expandDelve(at, delve, (roll.seed ^ hash(at)) >>> 0, story));
  for (const [at, town] of Object.entries(module.towns ?? {})) add(at, expandTown(at, town, (roll.seed ^ hash(at)) >>> 0));
  const { delves: _, towns: __, ...rest } = module;
  const live: Module = { ...rest, scenes };
  mine.set(key, live);
  return live;
}

/**
 * The module this run plays. Rolls the delves on first use — with `seed`, or
 * one drawn from the run itself — so a caller that forgot to roll still gets
 * the same dungeon every time it asks.
 */
export function liveModule(module: Module, state: AdventureState, seed?: number): Module {
  if (!generates(module)) return module;
  rollDelves(module, state, seed ?? hash(`${module.id}|${state.campaign.characters.map((c) => c.name).join(',')}`));
  return expandModule(module, state.delveRoll!);
}

/** Most story flags one module's delves may read at generation: each read
 *  doubles the rolls `validateLive` has to prove. */
export const MAX_READS = 4;

/**
 * The proofs for a module with delves. The written module alone cannot pass
 * `validateModule` — its story links to scenes that only exist once a delve
 * is expanded — so this proves the modules a run can actually get: several
 * seeds, under every combination of the story flags the delves read.
 */
export function validateLive(module: Module, seeds: readonly number[] = [1, 2, 3]): string[] {
  if (!generates(module)) return validateModule(module);
  const errors: string[] = [];
  for (const { at } of placesOf(module)) {
    if (module.scenes[at]) errors.push(`[${at}] is both a scene and a generated place`);
    if (module.start === at) errors.push(`[${at}] a module cannot start inside a generated place: a run rolls them after it starts`);
  }
  for (const [at, t] of Object.entries(module.towns ?? {})) {
    // A town's own flags are its own; a story flag it reads must be declared,
    // or the splice renames it into the town and it is never set.
    const own = new Set((t.spec.places ?? []).flatMap((pl) => (pl.sets ? [pl.sets] : [])));
    const reads = new Set(t.reads ?? []);
    for (const w of [...(t.spec.people ?? []).flatMap((p) => p.when ?? []), ...(t.spec.places ?? []).flatMap((pl) => pl.when ?? [])]) {
      const f = w.replace(/^!/, '');
      if (!own.has(f) && !reads.has(f)) errors.push(`[${at}] '${w}' reads the flag '${f}', which neither the town sets nor the town reads from the story`);
    }
  }
  for (const [at, d] of Object.entries(module.delves ?? {})) {
    const reads = new Set(d.reads ?? []);
    for (const pl of d.spec.pieces ?? []) {
      for (const w of pl.when ?? []) {
        const f = w.replace(/^!/, '');
        if (!reads.has(f)) errors.push(`[${at}] piece '${pl.piece}' is built on '${f}', which the delve does not read — it would never be set`);
      }
    }
  }
  const reads = [...new Set(placesOf(module).flatMap((p) => p.reads))];
  if (reads.length > MAX_READS) errors.push(`the generated places read ${reads.length} story flags; at most ${MAX_READS}`);
  if (errors.length) return errors;
  for (let mask = 0; mask < 1 << reads.length; mask++) {
    const flags = reads.filter((_, i) => mask & (1 << i)).sort();
    for (const seed of seeds) {
      let live: Module;
      try {
        live = expandModule(module, { seed, flags });
      } catch (e) {
        errors.push(`[seed ${seed}${flags.length ? `, ${flags.join('+')}` : ''}] ${(e as Error).message}`);
        continue;
      }
      for (const err of validateModule(live)) errors.push(`[seed ${seed}${flags.length ? `, ${flags.join('+')}` : ''}] ${err}`);
    }
  }
  return [...new Set(errors)];
}
