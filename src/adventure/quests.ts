/**
 * Quests, compiled. A quest is an offer from someone, stages to get
 * through, and a reward for reporting back — and every part of it is
 * something the engine already has: two choices added to the giver's scene
 * (ask, and report), an offer scene, a thanks scene, a few flags, and a
 * journal entry that shows the stages ticking off.
 *
 * The flags, for a quest `q`:
 *   quest-q          taken
 *   quest-q-done     reported back, rewarded
 *   the spec's failsOn, if any: lost
 *
 * Why stages are requirements, not steps: a party that clears the barrow
 * before anyone asks it to has cleared the barrow. Reporting back needs only
 * that every stage holds, however it came to.
 */
import type { Id } from '../engine/types.js';
import type { Choice, Effect, Module, QuestSpec, Requirement, Scene } from './types.js';

export const taken = (q: Id) => `quest-${q}`;
export const done = (q: Id) => `quest-${q}-done`;

/** The module with its quests woven in (unchanged if it has none). */
export function compileQuests(module: Module): Module {
  if (!module.quests) return module;
  const wrong = questErrors(module);
  if (wrong.length) throw new Error(wrong.join('; '));
  const scenes: Record<Id, Scene> = { ...module.scenes };
  for (const [id, q] of Object.entries(module.quests)) weave(scenes, id, q);
  const { quests: _, ...rest } = module;
  return { ...rest, scenes };
}

/** What is wrong with a quest as written, before it is woven in. */
export function questErrors(module: Module): string[] {
  const errors: string[] = [];
  for (const [id, q] of Object.entries(module.quests ?? {})) {
    const at = (m: string) => errors.push(`quest '${id}': ${m}`);
    if (!/^[a-z][a-z0-9-]*$/.test(id)) at('an id is lower-case letters, digits and dashes');
    const giver = module.scenes[q.giver.scene];
    if (!giver) at(`its giver's scene '${q.giver.scene}' does not exist`);
    else if (giver.kind !== 'story' && giver.kind !== 'dialogue') at(`its giver's scene '${q.giver.scene}' is a ${giver.kind}, not a story or a dialogue`);
    else if (!giver.next.length) at(`its giver's scene '${q.giver.scene}' has no way out to put the quest before`);
    if (!q.stages.length) at('it has no stages');
    for (const g of q.gives ?? []) if (!q.objects?.[g]) at(`it gives '${g}', which is not one of its objects`);
    if (q.title.length > 40) at('its title is over 40 characters');
  }
  return errors;
}

function weave(scenes: Record<Id, Scene>, id: Id, q: QuestSpec): void {
  const giver = scenes[q.giver.scene];
  if (!giver || (giver.kind !== 'story' && giver.kind !== 'dialogue')) throw new Error(`quest '${id}': no giver scene '${q.giver.scene}'`);
  const T = taken(id), D = done(id);
  const offer = `quest-${id}`, thanks = `quest-${id}-thanks`;
  const open: Requirement[] = [{ kind: 'flag', flag: T }, { kind: 'notFlag', flag: D }, ...(q.failsOn ? [{ kind: 'notFlag', flag: q.failsOn } as const] : [])];
  const objects = Object.keys(q.objects ?? {});

  const ask: Choice = { id: `ask-${id}`, label: `Ask about work: ${q.title}`, to: offer, hideWhenBlocked: true,
    requires: [{ kind: 'notFlag', flag: T }, ...(q.offeredWhen ?? [])] };
  // Reporting back: every stage done, however and whenever it came to be.
  const report: Choice = { id: `report-${id}`, label: `Report back: ${q.title}`, to: thanks, hideWhenBlocked: true,
    requires: [...open, ...q.stages.flatMap((s) => s.done)],
    effects: [...q.reward, { kind: 'setFlag', flag: D }, ...objects.map((o): Effect => ({ kind: 'clearFlag', flag: o }))] };
  // Before the scene's last choice: its way out stays last.
  const next = [...giver.next];
  next.splice(next.length - 1, 0, ask, report);
  scenes[giver.id] = { ...giver, next };

  scenes[offer] = { id: offer, kind: 'story', noBack: true, text: q.offer, next: [
    { id: 'accept', label: 'Take it on', to: giver.id, effects: [
      { kind: 'setFlag', flag: T },
      { kind: 'journal', entry: {
        id: `quest-${id}`, kind: 'quest', title: q.title, body: q.summary, takenBy: T, resolvedBy: D,
        ...(q.failsOn ? { failedBy: q.failsOn } : {}), stages: q.stages, ...(q.objects ? { objects: q.objects } : {}),
      } },
      ...(q.gives ?? []).map((o): Effect => ({ kind: 'setFlag', flag: o })),
    ] },
    { id: 'decline', label: 'Not now', to: giver.id },
  ] };
  // Elsewhere: choices while the quest is in hand, before each scene's way
  // out; and what a battle's win now also does.
  for (const add of q.adds ?? []) {
    if ('choice' in add) {
      const sc = scenes[add.scene];
      if (!sc || (sc.kind !== 'story' && sc.kind !== 'dialogue')) throw new Error(`quest '${id}': no story or dialogue '${add.scene}' to add a choice to`);
      const more = [...sc.next];
      more.splice(Math.max(0, more.length - 1), 0, { ...add.choice, hideWhenBlocked: true, requires: [...open, ...(add.choice.requires ?? [])] });
      scenes[sc.id] = { ...sc, next: more };
    } else {
      const sc = scenes[add.battle];
      if (sc?.kind !== 'battle') throw new Error(`quest '${id}': no battle '${add.battle}' to add to`);
      scenes[sc.id] = { ...sc, onWin: { ...sc.onWin, effects: [...(sc.onWin.effects ?? []), ...add.effects] } };
    }
  }
  scenes[thanks] = { id: thanks, kind: 'story', noBack: true, text: q.thanks, next: [{ id: 'ok', label: 'Go on', to: giver.id }] };
}
