/**
 * A module as a map: its scenes grouped by the location they belong to, and
 * every way between them, labelled with what it takes.
 *
 * Pure extraction — no layout. `scripts/module-map.ts` lays it out and draws
 * it. Kept here so the grouping and the edges are tested like the rest.
 *
 * A scene belongs to the location (explore or dungeon scene) the party walks
 * in from: the first one a breadth-first walk from the start passes through
 * on the way to it. Scenes before the first location are the prologue.
 *
 * Two kinds of edge are left out on purpose, because every scene has them
 * and drawing them hides the ones that matter: the way back to the scene's
 * own location (`@hub`, the implicit "leave", or a choice naming it), which a
 * node carries as a flag instead; and a lost fight's fall to the module's
 * defeat scene.
 */
import type { Id } from '../engine/types.js';
import { HUB_REF, type Module, type Requirement, type Scene } from './types.js';
import { refsOf } from './graph.js';

export interface MapNode {
  id: Id;
  kind: Scene['kind'];
  /** What to call it on the map: a location's title, else the scene id. */
  label: string;
  /** The location it belongs to, or null in the prologue. */
  location: Id | null;
  /** Something in it leads back to the location (`@hub`, or a Leave button). */
  returns: boolean;
  outcome?: 'victory' | 'defeat';
}

export type EdgeKind = 'go' | 'pass' | 'fail' | 'win' | 'lose' | 'talk' | 'done' | 'danger';

export interface MapEdge {
  from: Id;
  to: Id;
  kind: EdgeKind;
  /** The choice, node or room it is, kept short. */
  label?: string;
  /** What it needs, when it needs something ("vex-turned", "!met-vex"). */
  needs?: string;
}

export interface ModuleMap {
  locations: Array<{ id: Id; title: string }>;
  nodes: MapNode[];
  edges: MapEdge[];
}

const isHub = (s: Scene | undefined) => s?.kind === 'explore' || s?.kind === 'dungeon';
const short = (t: string, n = 26) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** A requirement list in a few characters. */
export function needsOf(reqs: Requirement[] | undefined): string | undefined {
  if (!reqs?.length) return undefined;
  return reqs.map((r) => {
    switch (r.kind) {
      case 'flag': return r.value === undefined || r.value === true ? r.flag : `${r.flag}=${String(r.value)}`;
      case 'notFlag': return `!${r.flag}`;
      case 'item': return `🎒${r.itemId}`;
      case 'gold': return `💰${r.atLeast}`;
      case 'classInParty': return r.classId;
      case 'speciesInParty': return r.speciesId;
      case 'visited': return `seen ${r.scene}`;
      case 'companion': return `+${r.companion}`;
      case 'noCompanion': return `-${r.companion}`;
      case 'count': return `${r.flag}${r.atLeast !== undefined ? `≥${r.atLeast}` : ''}${r.below !== undefined ? `<${r.below}` : ''}`;
      case 'npc': return `${r.npc}${r.fate ? `:${r.fate}` : ''}`;
    }
  }).join(', ');
}

export function moduleMap(module: Module): ModuleMap {
  const scenes = module.scenes;

  // --- Which location each scene belongs to ---------------------------------
  const location = new Map<Id, Id | null>();
  const queue: Array<[Id, Id | null]> = [[module.start, null]];
  while (queue.length) {
    const [id, from] = queue.shift()!;
    if (location.has(id) || !scenes[id]) continue;
    const here = isHub(scenes[id]) ? id : from;
    location.set(id, here);
    for (const ref of refsOf(scenes[id]!)) if (ref !== HUB_REF) queue.push([ref, here]);
  }
  for (const id of Object.keys(scenes)) if (!location.has(id)) location.set(id, null); // unreachable: the validator says so

  // --- The ways between them -------------------------------------------------
  const edges: MapEdge[] = [];
  const returns = new Set<Id>();
  const edge = (from: Id, to: Id, kind: EdgeKind, label?: string, needs?: Requirement[]) => {
    // Back to the location it belongs to — by `@hub` or by name, it is the
    // same way home, and drawn it would point every location at itself.
    if (to === HUB_REF || (to === location.get(from) && to !== from)) { returns.add(from); return; }
    const n = needsOf(needs);
    edges.push({ from, to, kind, ...(label ? { label: short(label) } : {}), ...(n ? { needs: n } : {}) });
  };
  for (const [id, s] of Object.entries(scenes)) {
    switch (s.kind) {
      case 'story': case 'dialogue':
        for (const c of s.next) {
          edge(id, c.to, c.check ? 'pass' : 'go', c.label, c.requires);
          if (c.check) edge(id, c.check.failTo, 'fail', c.label, c.requires);
        }
        if (!s.noBack) returns.add(id);
        break;
      case 'check':
        edge(id, s.success.to, 'pass', `${s.skill} ${s.dc}`);
        edge(id, s.failure.to, 'fail');
        break;
      case 'challenge':
        edge(id, s.success.to, 'pass'); edge(id, s.failure.to, 'fail');
        for (const a of s.approaches) {
          if (a.success) edge(id, a.success.to, 'pass', a.label, a.requires);
          if (a.failure && s.retry !== 'perApproach') edge(id, a.failure.to, 'fail', a.label, a.requires);
        }
        if (!s.noBack) returns.add(id);
        break;
      case 'battle':
        edge(id, s.onWin.to, 'win');
        if (s.onLoss) edge(id, s.onLoss.to, 'lose');
        if (s.parley) {
          edge(id, s.parley.success.to, 'talk', s.parley.label ?? 'parley');
          if (s.parley.failure) edge(id, s.parley.failure.to, 'fail', s.parley.label ?? 'parley');
        }
        if (!s.noFlee) returns.add(id);
        break;
      case 'shop': case 'rest': edge(id, s.next, 'go'); break;
      case 'explore':
        for (const n of s.map.nodes) {
          edge(id, n.scene, 'go', n.label, n.requires);
          for (const w of n.sceneWhen ?? []) edge(id, w.to, 'done', n.label, w.if);
          if (n.wandering) edge(id, n.wandering.battleScene, 'danger', n.label);
        }
        if (s.map.camp?.risky) edge(id, s.map.camp.risky.battleScene, 'danger', 'camp');
        break;
      case 'dungeon': {
        const d = s.dungeon;
        for (const r of d.rooms) {
          if (r.fight) edge(id, r.fight, 'go', r.name);
          if (r.event) edge(id, r.event.scene, 'go', r.name);
          if (r.search) edge(id, r.search, 'go', `${r.name} (search)`);
          if (r.exit) edge(id, r.exit.to, 'go', r.exit.label ?? r.name);
        }
        for (const l of d.links) if (l.door?.ambush) edge(id, l.door.ambush.battle, 'danger', 'ambush');
        if (d.torch) edge(id, d.torch.out, 'danger', 'torch out');
        if (d.camp?.risky) edge(id, d.camp.risky.battleScene, 'danger', 'camp');
        break;
      }
      case 'ending': break;
    }
  }

  // Many choices can lead the same way; one edge per (from, to, kind) is plenty.
  const seen = new Set<string>();
  const unique = edges.filter((e) => {
    const k = `${e.from}>${e.to}>${e.kind}>${e.needs ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const titleOf = (s: Scene) => (s.kind === 'explore' ? s.map.title : s.kind === 'dungeon' ? s.dungeon.title : s.id);
  const nodes: MapNode[] = Object.entries(scenes).map(([id, s]) => ({
    id, kind: s.kind, label: isHub(s) ? titleOf(s) : id, location: location.get(id) ?? null,
    returns: returns.has(id), ...(s.kind === 'ending' ? { outcome: s.outcome } : {}),
  }));
  const locations = Object.values(scenes).filter(isHub).map((s) => ({ id: s.id, title: titleOf(s) }));
  return { locations, nodes, edges: unique };
}
