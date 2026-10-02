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
import type { Module, NpcDef, NpcRef, CompanionDef, Requirement, Effect } from './types.js';

/**
 * NPC state lives in campaign-wide flags under `npc.`: they carry, unprefixed,
 * into every later chapter, and any chapter may change them.
 */
export const NPC_FLAG_PREFIX = 'npc.';
export const npcMetFlag = (id: Id) => `${NPC_FLAG_PREFIX}${id}.met`;
export const npcFateFlag = (id: Id, fate: string) => `${NPC_FLAG_PREFIX}${id}.fate.${fate}`;
/** How a character feels about the company: a signed tally, 0 to begin. */
export const npcAttitudeFlag = (id: Id) => `${NPC_FLAG_PREFIX}${id}.attitude`;
export const isNpcFlag = (flag: string) => flag.startsWith(NPC_FLAG_PREFIX);

/** A chapter's renamed flags (`renamedFlags`), as a later chapter inherited
 *  them: `module:flag` → the same new name. */
export function carriedRenames(moduleId: Id, renamed: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(renamed).map(([from, to]) => [`${moduleId}:${from}`, to]));
}

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

/** Arrays holding requirements, and arrays holding effects, by their key. */
const REQUIREMENT_LISTS = new Set(['requires', 'if', 'assumes', 'until', 'locked']);
const EFFECT_LISTS = new Set(['effects', 'failEffects']);

/**
 * NPC requirements and effects, compiled to the flags they stand for. Throws
 * on an NPC the registry doesn't know, or a fate it doesn't declare.
 */
function compileNpcState<T>(value: T, npcs: Record<Id, NpcDef>, where: string, key = ''): T {
  const npcOf = (id: Id, fate?: string) => {
    const npc = npcs[id];
    if (!npc) throw new Error(`${where}: unknown NPC '${id}'`);
    if (fate !== undefined && !npc.fates?.includes(fate)) throw new Error(`${where}: '${id}' has no fate '${fate}' (declare it in NpcDef.fates)`);
    return npc;
  };
  if (Array.isArray(value)) {
    const items = value.map((v) => compileNpcState(v, npcs, where));
    if (REQUIREMENT_LISTS.has(key)) {
      return items.flatMap((r: Requirement): Requirement[] => {
        if (r?.kind !== 'npc') return [r];
        npcOf(r.npc, r.fate);
        for (const f of r.notFate ?? []) npcOf(r.npc, f);
        return [
          ...(r.fate !== undefined ? [{ kind: 'flag' as const, flag: npcFateFlag(r.npc, r.fate) }] : []),
          ...(r.notFate ?? []).map((f) => ({ kind: 'notFlag' as const, flag: npcFateFlag(r.npc, f) })),
          ...(r.met === true ? [{ kind: 'flag' as const, flag: npcMetFlag(r.npc) }] : []),
          ...(r.met === false ? [{ kind: 'notFlag' as const, flag: npcMetFlag(r.npc) }] : []),
          ...(r.attitude ? [{ kind: 'count' as const, flag: npcAttitudeFlag(r.npc), ...r.attitude }] : []),
        ];
      }) as T;
    }
    if (EFFECT_LISTS.has(key)) {
      return items.flatMap((e: Effect): Effect[] => {
        if (e?.kind !== 'npc') return [e];
        const npc = npcOf(e.npc, e.fate);
        return [
          ...(e.met ? [{ kind: 'setFlag' as const, flag: npcMetFlag(e.npc) }] : []),
          ...(e.attitude ? [{ kind: 'addFlag' as const, flag: npcAttitudeFlag(e.npc), amount: e.attitude }] : []),
          // A new fate replaces the old: one at a time.
          ...(e.fate !== undefined ? [
            ...(npc.fates ?? []).filter((f) => f !== e.fate).map((f) => ({ kind: 'clearFlag' as const, flag: npcFateFlag(e.npc, f) })),
            { kind: 'setFlag' as const, flag: npcFateFlag(e.npc, e.fate) },
          ] : []),
        ];
      }) as T;
    }
    return items as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = compileNpcState(v, npcs, where, k);
    return out as T;
  }
  return value;
}

/**
 * The module with every `{id}` token resolved to that NPC's name, every NPC
 * requirement and effect compiled to its flags, and the registry attached.
 * Throws on a token, NPC or fate the registry doesn't know.
 */
export function withNpcs(module: Module, npcs: Record<Id, NpcDef>): Module {
  const unknown = new Set<string>();
  const resolved = mapStrings(module, (s) => s.replace(TOKEN, (whole, id: string) => {
    const npc = npcs[id];
    if (!npc) { unknown.add(id); return whole; }
    return npc.name;
  }));
  if (unknown.size) throw new Error(`${module.id}: unknown NPC token(s) ${[...unknown].map((u) => `{${u}}`).join(', ')}`);
  const compiled = compileNpcState(resolved, npcs, module.id);
  return { ...compiled, npcs };
}

/** Whether NPC requirements or effects are left in a module (one built
 *  without `withNpcs`). */
export function hasUncompiledNpcState(value: unknown, key = ''): boolean {
  if (Array.isArray(value)) {
    if ((REQUIREMENT_LISTS.has(key) || EFFECT_LISTS.has(key)) && value.some((v) => v?.kind === 'npc')) return true;
    return value.some((v) => hasUncompiledNpcState(v));
  }
  if (value && typeof value === 'object') return Object.entries(value).some(([k, v]) => hasUncompiledNpcState(v, k));
  return false;
}

/** Tokens left in a module (one built without `withNpcs`, or a bad token). */
export function unresolvedTokens(module: Module): string[] {
  const found = new Set<string>();
  mapStrings(module.scenes, (s) => { for (const m of s.matchAll(TOKEN)) found.add(m[0]); return s; });
  return [...found];
}

/** A dialogue speaker from the registry: the name, the name with a title
 *  for this chapter (`speaker(NPCS.wren, 'Chief of Scouts')` → "Wren, Chief
 *  of Scouts"), or a label of its own where the scene wants one ("{mira} the
 *  Innkeeper", or "Wounded Scout" before she gives her name), with the
 *  portrait or emoji overridden if need be. */
export function speaker(npc: NpcDef, title?: string | { label?: string; portraitId?: string; emoji?: string }): NpcRef {
  const o = typeof title === 'object' ? title : {};
  const name = typeof title === 'string' ? `${npc.name}, ${title}` : o.label ?? npc.name;
  const portraitId = o.portraitId ?? npc.portraitId;
  const emoji = o.emoji ?? npc.emoji;
  return { id: `npc-${npc.id}`, name, ...(portraitId ? { portraitId } : {}), ...(emoji ? { emoji } : {}) };
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
