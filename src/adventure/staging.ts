/**
 * NPCs on a chapter's stage, woven into ordinary scenes (see NpcStaging).
 *
 * The point is coherence. A story that has to remember, at every place,
 * whether Wren is there, alive, friendly or already asked about the key is
 * a story that one day shows a dead woman at the bar. So the NPC carries it:
 * where they can be, what they say and when. The story moves them, changes
 * their fate or their mind — one effect — and every place they might be
 * shows "Talk to Wren" exactly while she is there to talk to.
 *
 * Woven before NPC state is compiled (withCanon): what this writes is NPC
 * requirements and effects, and those compile to their flags as ever.
 *
 * Each place gets its own copy of the conversation (`talk-wren@square`), so
 * taking your leave goes back where you were, with nothing to remember.
 */
import type { Id } from '../engine/types.js';
import type { Choice, ExploreNode, Module, NpcDef, NpcStaging, Para, Requirement, Scene } from './types.js';

export const talkScene = (npc: Id, place: Id) => `talk-${npc}@${place}`;
export const toldFlag = (npc: Id, topic: Id) => `told-${npc}-${topic}`;

/** The opposite of one requirement, where it has one. */
function negate(r: Requirement): Requirement {
  const flip = (b: { atLeast?: number; below?: number }) => {
    if ((b.atLeast === undefined) === (b.below === undefined)) throw new Error(`cannot turn round a range with two ends (${JSON.stringify(b)})`);
    return b.atLeast !== undefined ? { below: b.atLeast } : { atLeast: b.below! };
  };
  if (r.kind === 'flag') return { kind: 'notFlag', flag: r.flag };
  if (r.kind === 'notFlag') return { kind: 'flag', flag: r.flag };
  if (r.kind === 'npc' && r.fate !== undefined && Object.keys(r).length === 3) return { kind: 'npc', npc: r.npc, notFate: [r.fate] };
  if (r.kind === 'npc' && r.attitude && Object.keys(r).length === 3) return { kind: 'npc', npc: r.npc, attitude: flip(r.attitude) };
  if (r.kind === 'count') return { kind: 'count', flag: r.flag, ...flip(r) };
  if (r.kind === 'reputation' && (r.empathy ? 1 : 0) + (r.law ? 1 : 0) === 1) {
    return r.empathy ? { kind: 'reputation', empathy: flip(r.empathy) } : { kind: 'reputation', law: flip(r.law!) };
  }
  throw new Error(`cannot turn round ${JSON.stringify(r)}: use a flag, a fate, an attitude, a tally, or one reputation axis`);
}

/** The chapter with its staged NPCs woven in (unchanged if it has none). */
export function weaveStage(module: Module, npcs: Record<Id, NpcDef>): Module {
  if (!module.stage) return module;
  const scenes: Record<Id, Scene> = { ...module.scenes };
  for (const [id, st] of Object.entries(module.stage)) {
    const npc = npcs[id];
    if (!npc) throw new Error(`${module.id}: '${id}' is on the stage but not in the registry`);
    weave(scenes, module.id, npc, st);
  }
  const { stage: _, ...rest } = module;
  return { ...rest, scenes };
}

function weave(scenes: Record<Id, Scene>, where: string, npc: NpcDef, st: NpcStaging): void {
  const err = (m: string) => { throw new Error(`${where}: ${npc.id} on stage: ${m}`); };
  if (!st.places.length) err('nowhere to be');
  if (!st.greet.length || st.greet[st.greet.length - 1]!.if) err('the last greeting must have no `if`: something is always said');
  const who = { id: `npc-${npc.id}`, name: npc.name, ...(npc.portraitId ? { portraitId: npc.portraitId } : {}), ...(npc.emoji ? { emoji: npc.emoji } : {}) };
  const lines: Para[] = st.greet.map((g) => (g.if ? { text: g.text, if: g.if } : g.text));

  for (const place of st.places) {
    const P = place.scene;
    const host = scenes[P];
    if (!host) err(`no scene '${P}'`);
    // Here, and not gone.
    const here: Requirement[] = [{ kind: 'npc', npc: npc.id, at: P }, ...(st.gone?.length ? [{ kind: 'npc', npc: npc.id, notFate: st.gone } as const] : []),
      // With the company now: not standing about waiting to be talked to.
      ...(st.join ? [{ kind: 'noCompanion', companion: st.join.companion } as const] : [])];
    const talk = talkScene(npc.id, P);
    // Their conversation, from this place: the greeting, then the topics.
    // Joining: yes when everything holds; else the first thing that does not
    // says why — one "Ask them to join" offered, whichever it is.
    const j = st.join;
    const joinTopics: NpcStaging['topics'] = !j ? [] : [
      { id: 'join', label: j.label ?? `Ask ${npc.name} to join you`, lines: j.yes, requires: j.when, repeat: true,
        effects: [{ kind: 'joinParty', companion: j.companion }], to: P },
      ...j.when.map((w, i) => ({ id: `join-no-${i}`, label: j.label ?? `Ask ${npc.name} to join you`, lines: j.refuse[i]!, repeat: true as const,
        requires: [...j.when.slice(0, i), negate(w)] })),
    ];
    if (j && j.refuse.length !== j.when.length) err('join needs one refusal for each of its conditions');
    const topics = [...st.topics, ...joinTopics];
    scenes[talk] = { id: talk, kind: 'dialogue', npc: who, noBack: true, lines: [...lines], next: [
      ...topics.map((t): Choice => ({
        id: `topic-${t.id}`, label: t.label, to: `${talk}/${t.id}`, hideWhenBlocked: true,
        requires: [...(t.requires ?? []), ...(t.repeat ? [] : [{ kind: 'notFlag', flag: toldFlag(npc.id, t.id) } as const])],
        effects: [...(t.repeat ? [] : [{ kind: 'setFlag', flag: toldFlag(npc.id, t.id) } as const]), ...(t.effects ?? [])],
      })),
      { id: 'leave', label: 'Take your leave', to: P },
    ] };
    for (const t of topics) {
      scenes[`${talk}/${t.id}`] = { id: `${talk}/${t.id}`, kind: 'dialogue', npc: who, noBack: true, lines: t.lines,
        next: [{ id: 'ok', label: t.to ? 'Go on' : 'Go on talking', to: t.to ?? talk }] };
    }
    if (host!.kind === 'explore') {
      if (place.x === undefined || place.y === undefined) err(`a map ('${P}') needs x and y for their marker`);
      const node: ExploreNode = { id: `npc-${npc.id}`, label: npc.name, icon: 'tok-person', scene: talk, x: place.x!, y: place.y!,
        requires: here, hideWhenBlocked: true,
        ...(st.hostile ? { sceneWhen: [{ if: [st.hostile.when], to: st.hostile.to }] } : {}) };
      scenes[P] = { ...host!, map: { ...host!.map, nodes: [...host!.map.nodes, node] } };
    } else if (host!.kind === 'story' || host!.kind === 'dialogue') {
      const add: Choice[] = [
        { id: `talk-${npc.id}`, label: `Talk to ${npc.name}`, to: talk, hideWhenBlocked: true,
          requires: [...here, ...(st.hostile ? [negate(st.hostile.when)] : [])] },
        ...(st.hostile ? [{ id: `confront-${npc.id}`, label: st.hostile.label ?? `Confront ${npc.name}`, to: st.hostile.to, hideWhenBlocked: true,
          requires: [...here, st.hostile.when] }] : []),
      ];
      const next = [...host!.next];
      next.splice(Math.max(0, next.length - 1), 0, ...add);
      scenes[P] = { ...host!, next };
    } else err(`'${P}' is a ${host!.kind}: a place is a map, a story or a dialogue`);
  }
}
