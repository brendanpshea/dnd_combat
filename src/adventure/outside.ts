/**
 * A story's generated delves, as the story's proofs see them (proveApart).
 * Its own file: the validator and the reachability search use it on every
 * module, and neither may import the splicer that builds the delves.
 */
import type { Id } from '../engine/types.js';
import type { EmbeddedDelve, ExploreNode, Module, Requirement, Scene } from './types.js';

/**
 * The story with each `proveApart` delve as only what the story sees of it:
 * a door into a hub with one marker for each of the story's scenes in its
 * required rooms (shown until it has done what it waits on), and the ways
 * out. What lies between — rooms, keys, ambushes — the delve's own proof
 * covered when it was built.
 */
export function outsideOf(module: Module): Module {
  if (!Object.values(module.delves ?? {}).some((d) => d.proveApart)) return module;
  const scenes: Record<Id, Scene> = { ...module.scenes };
  const delves: Record<Id, EmbeddedDelve> = {};
  for (const [at, d] of Object.entries(module.delves ?? {})) {
    if (!d.proveApart) { delves[at] = d; continue; }
    const hub = `${at}/delve`;
    const nodes: ExploreNode[] = [];
    (d.spec.require ?? []).forEach((r, i) => {
      // Whether an optional room is done is the delve's own business: nothing
      // outside it asks, so its outside shows the event every time, and its
      // flags stay out of the chapter's proof. Only the path (main, goal) gates.
      const gates = r.where === 'main' || r.where === 'goal';
      const until = (gates ? r.event?.until ?? [] : []).flatMap((q): Requirement[] =>
        q.kind === 'flag' ? [{ kind: 'notFlag', flag: q.flag }] : q.kind === 'notFlag' ? [{ kind: 'flag', flag: q.flag }] : []);
      // Past a story's lock (the goal always is): only once the story opens it.
      const past = d.spec.lock && (r.where === 'goal' || r.where === 'afterLock') ? d.spec.lock.requires : [];
      const at_ = (scene: Id, k: string, requires: Requirement[] = [], when?: { if: Requirement[]; to: Id }[]) =>
        nodes.push({ id: `${k}${i}`, label: r.name ?? scene, icon: 'tok-mystery', scene, x: 10 + (nodes.length % 8) * 10, y: 20 + Math.floor(nodes.length / 8) * 20,
          ...([...past, ...requires].length ? { requires: [...past, ...requires], hideWhenBlocked: true } : {}),
          ...(when?.length ? { sceneWhen: when } : {}) });
      // The goal lies past the main path: reached only once each required
      // room on it has done what it waits on, as walking there would be.
      const before = r.where === 'goal'
        ? (d.spec.require ?? []).filter((x) => x.where === 'main').flatMap((x) => x.event?.until ?? []) : [];
      if (r.event) at_(r.event.scene, 'e', [...until, ...before], r.event.when);
      if (r.search) at_(r.search, 's');
      // A way out is past the room's event: walking in plays it until it is done.
      if (r.exit) at_(r.exit.to, 'x', [...before, ...(gates ? r.event?.until ?? [] : [])]);
    });
    nodes.push({ id: 'out', label: 'Out', icon: 'tok-gate', scene: d.onLeave.to, x: 90, y: 90 });
    scenes[at] = { id: at, kind: 'story', noBack: true, text: ['In.'], next: [{ id: 'in', label: 'In', to: hub }] };
    scenes[hub] = { id: hub, kind: 'explore', map: { title: d.title ?? 'Inside', art: { emoji: '🏚️' }, entry: ['out'], nodes } };
  }
  const { delves: _, ...rest } = module;
  return { ...rest, ...(Object.keys(delves).length ? { delves } : {}), scenes };
}

