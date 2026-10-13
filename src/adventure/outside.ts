/**
 * A story's generated delves, as the story's proofs see them (proveApart).
 * Its own file: the validator and the reachability search use it on every
 * module, and neither may import the splicer that builds the delves.
 */
import type { Id } from '../engine/types.js';
import type { EmbeddedDelve, EmbeddedTown, ExploreNode, Module, Requirement, Scene } from './types.js';
import { refsOf, requirementsOf } from './graph.js';
import { delveFightXpBound } from './delve-budget.js';

/**
 * The story with each `proveApart` delve as only what the story sees of it:
 * a door into a hub with one marker for each of the story's scenes in its
 * required rooms (shown until it has done what it waits on), and the ways
 * out. What lies between — rooms, keys, ambushes — the delve's own proof
 * covered when it was built.
 */
/** Every flag the chapter's paths read (not an ending's slides). */
const askedOf = (module: Module): Set<string> => new Set([
  ...Object.values(module.scenes).filter((sc) => sc.kind !== 'ending').flatMap(requirementsOf),
  ...Object.values(module.delves ?? {}).flatMap((d) => [...(d.spec.lock?.requires ?? []), ...(d.spec.require ?? []).flatMap((r) => (r.event?.when ?? []).flatMap((w) => w.if))]),
  ...Object.values(module.towns ?? {}).flatMap((t) => (t.spec.places ?? []).flatMap((pl) => (pl.event?.when ?? []).flatMap((w) => w.if))),
].flatMap((r) => (r.kind === 'flag' || r.kind === 'notFlag' ? [r.flag] : [])));

/** A place's marker once its story is done: back to the map, and nothing else. */
const doneScene = (hub: Id) => `${hub}-done`;
const doneBeat = (hub: Id): Scene => ({ id: doneScene(hub), kind: 'story', text: ['(Done.)'], next: [{ id: 'ok', label: 'Back', to: hub }] });

export function outsideOf(module: Module): Module {
  if (!Object.values(module.delves ?? {}).some((d) => d.proveApart) && !Object.values(module.towns ?? {}).some((t) => t.proveApart)) return module;
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
      // …unless something outside it asks the same flag (the story's own
      // lock does): then a room done is done for the chapter too.
      const gates = r.where === 'main' || r.where === 'goal'
        || (r.event?.until ?? []).some((q) => (q.kind === 'flag' || q.kind === 'notFlag') && askedOf(module).has(q.flag));
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
      // A room done but ungated shows only itself once done: a cosmetic beat,
      // which keeps its flag out of the proof and its pay to once (XP ceiling).
      const doneIf = (r.event?.until ?? []).filter((q) => q.kind === 'flag');
      const done = !gates && doneIf.length ? [{ if: doneIf, to: doneScene(hub) }] : [];
      if (r.event) at_(r.event.scene, 'e', [...until, ...before], [...done, ...(r.event.when ?? [])]);
      // Someone held there (RequiredRoom.hostage): what the chapter sees is
      // its two flags. Got out (with what that pays and the story's own
      // effects), until either is set; taken, by whatever the story says.
      if (r.hostage) {
        const h = r.hostage, stub = `${hub}-held${i}`;
        scenes[stub] = { id: stub, kind: 'story', text: [`(${h.who}.)`], next: [
          { id: 'free', label: 'Get them out', to: hub, effects: [{ kind: 'setFlag', flag: h.as.freed }, { kind: 'xp', amount: 50 * (d.spec.level ?? 2) }, ...(h.onFreed ?? [])] },
          { id: 'later', label: 'Not yet', to: hub }] };
        at_(stub, 'h', [...before, { kind: 'notFlag', flag: h.as.freed }, { kind: 'notFlag', flag: h.as.taken }, ...(h.takenWhen ?? []).flatMap((q): Requirement[] =>
          q.kind === 'flag' ? [{ kind: 'notFlag', flag: q.flag }] : [])]);
      }
      if (r.search) at_(r.search, 's');
      // A way out is past the room's event: walking in plays it until it is done.
      if (r.exit) at_(r.exit.to, 'x', [...before, ...(gates ? r.event?.until ?? [] : [])]);
    });
    nodes.push({ id: 'out', label: 'Out', icon: 'tok-gate', scene: d.onLeave.to, x: 90, y: 90 });
    // What its own fights could pay, once: the XP ceiling counts it, where
    // the chapter cannot see the fights themselves (delveFightXpBound).
    const fights = `${at}/fights`;
    scenes[fights] = { id: fights, kind: 'story', text: ['(The place\'s own fights.)'],
      next: [{ id: 'won', label: 'Fight through', to: hub, once: true, effects: [{ kind: 'xp', amount: delveFightXpBound(d.spec) }] }] };
    nodes.push({ id: 'fights', label: 'Its own fights', icon: 'tok-mystery', scene: fights, x: 90, y: 70 });
    scenes[at] = { id: at, kind: 'story', noBack: true, text: ['In.'], next: [{ id: 'in', label: 'In', to: hub }] };
    scenes[hub] = { id: hub, kind: 'explore', map: { title: d.title ?? 'Inside', art: { emoji: '🏚️' }, entry: ['out'], nodes } };
    scenes[doneScene(hub)] = doneBeat(hub);
  }
  /*
   * A town the same way: a map with a marker for each of the story's places
   * in it (shown until done, as walking up to it would play it), its ways on,
   * and the road out unless the story keeps the gate. Its shops, streets and
   * people are the town's own business.
   */
  const towns: Record<Id, EmbeddedTown> = {};
  for (const [at, t] of Object.entries(module.towns ?? {})) {
    if (!t.proveApart) { towns[at] = t; continue; }
    const hub = `${at}/city`;
    const nodes: ExploreNode[] = [];
    const pin = (id: string, label: string, scene: Id, extra: Partial<ExploreNode> = {}) =>
      nodes.push({ id, label, icon: 'tok-mystery', scene, x: 10 + (nodes.length % 8) * 10, y: 20 + Math.floor(nodes.length / 8) * 20, ...extra });
    // A place done is only its text: whether it is done matters to the
    // chapter only where something else on its paths asks the same flag.
    const asked = new Set([...Object.values(module.scenes).filter((sc) => sc.kind !== 'ending').flatMap(requirementsOf),
      ...(t.spec.places ?? []).flatMap((pl) => (pl.event?.when ?? []).flatMap((w) => w.if))]
      .flatMap((r) => (r.kind === 'flag' || r.kind === 'notFlag' ? [r.flag] : [])));
    (t.spec.places ?? []).forEach((pl, i) => {
      if (pl.event) {
        const until = (pl.event.until ?? []).flatMap((q): Requirement[] =>
          q.kind === 'flag' && asked.has(q.flag) ? [{ kind: 'notFlag', flag: q.flag }] : q.kind === 'notFlag' && asked.has(q.flag) ? [{ kind: 'flag', flag: q.flag }] : []);
        const doneIf = (pl.event.until ?? []).filter((q) => q.kind === 'flag' && !asked.has(q.flag));
        const when = [...(doneIf.length ? [{ if: doneIf, to: doneScene(hub) }] : []), ...(pl.event.when ?? [])];
        pin(`e${i}`, pl.label, pl.event.scene, {
          ...(until.length ? { requires: until, hideWhenBlocked: true } : {}),
          ...(when.length ? { sceneWhen: when } : {}) });
      }
      if (pl.way) pin(`w${i}`, pl.label, pl.way.to);
    });
    if (!(t.spec.places ?? []).some((pl) => pl.replaces === 'gate')) pin('out', 'Out', t.onLeave.to);
    // The door, if the story walks in by it rather than straight onto the map.
    if (Object.values(module.scenes).some((sc) => refsOf(sc).includes(at))) {
      scenes[at] = { id: at, kind: 'story', noBack: true, text: ['In.'], next: [{ id: 'in', label: 'In', to: hub }] };
    }
    scenes[hub] = { id: hub, kind: 'explore', map: { title: t.title ?? 'Town', art: { emoji: '🏘️' }, entry: [nodes[0]!.id], nodes, ...(t.spec.camp ? { camp: {} } : {}) } };
    scenes[doneScene(hub)] = doneBeat(hub);
  }
  const { delves: _, towns: __, ...rest } = module;
  return { ...rest, ...(Object.keys(delves).length ? { delves } : {}), ...(Object.keys(towns).length ? { towns } : {}), scenes };
}

