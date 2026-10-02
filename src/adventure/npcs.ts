/**
 * The NPC registry: one record per named character for a whole campaign.
 *
 * Prose names a character by token — `'{vargan} rises from a throne of
 * lashed spears.'` — and `withNpcs` resolves every token to the registry's
 * name when the module is built. A rename is one line; a misspelt token is an
 * error at load, not a stray name in the game. Dialogue speakers (`speaker`)
 * and companions (`companionsFrom`) come from the same records, and each
 * record's `introducedAt` feeds the reachability search's cast check.
 */
import type { Id } from '../engine/types.js';
import type { Module, NpcDef, NpcRef, CompanionDef } from './types.js';

/** A token: `{id}`, the id in lower case with hyphens. */
const TOKEN = /\{([a-z][a-z0-9-]*)\}/g;

/** Every string in `value`, deeply, with `f` applied (a fresh copy). */
function mapStrings<T>(value: T, f: (s: string) => string): T {
  if (typeof value === 'string') return f(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, f)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, f);
    return out as T;
  }
  return value;
}

/**
 * The module with every `{id}` token resolved to that NPC's name, and the
 * registry attached. Throws on a token the registry doesn't know.
 */
export function withNpcs(module: Module, npcs: Record<Id, NpcDef>): Module {
  const unknown = new Set<string>();
  const resolved = mapStrings(module, (s) => s.replace(TOKEN, (whole, id: string) => {
    const npc = npcs[id];
    if (!npc) { unknown.add(id); return whole; }
    return npc.name;
  }));
  if (unknown.size) throw new Error(`${module.id}: unknown NPC token(s) ${[...unknown].map((u) => `{${u}}`).join(', ')}`);
  return { ...resolved, npcs };
}

/** Tokens left in a module (one built without `withNpcs`, or a bad token). */
export function unresolvedTokens(module: Module): string[] {
  const found = new Set<string>();
  mapStrings(module.scenes, (s) => { for (const m of s.matchAll(TOKEN)) found.add(m[0]); return s; });
  return [...found];
}

/** A dialogue speaker from the registry: the name, or the name with a title
 *  for this chapter ("Wren, Chief of Scouts"). */
export function speaker(npc: NpcDef, title?: string): NpcRef {
  return {
    id: `npc-${npc.id}`, name: title ? `${npc.name}, ${title}` : npc.name,
    ...(npc.portraitId ? { portraitId: npc.portraitId } : {}), ...(npc.emoji ? { emoji: npc.emoji } : {}),
  };
}

/** Companions (Module.companions) from the registry, for the NPCs who can
 *  join the party in this chapter. A blurb for this chapter may override. */
export function companionsFrom(npcs: Record<Id, NpcDef>, ids: Array<Id | { id: Id; blurb: string }>): Record<Id, CompanionDef> {
  const out: Record<Id, CompanionDef> = {};
  for (const entry of ids) {
    const id = typeof entry === 'string' ? entry : entry.id;
    const npc = npcs[id];
    if (!npc?.monsterId) throw new Error(`companionsFrom: '${id}' is not an NPC who can join the party`);
    out[id] = {
      id, name: npc.name, monsterId: npc.monsterId,
      ...(npc.portraitId ? { portraitId: npc.portraitId } : {}), ...(npc.emoji ? { emoji: npc.emoji } : {}),
      blurb: typeof entry === 'string' ? npc.blurb ?? '' : entry.blurb,
    };
  }
  return out;
}
