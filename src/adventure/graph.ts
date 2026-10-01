/**
 * Walking a module's scenes: where each can route, what it changes, what it
 * asks for. Shared by the validator and the dungeon checks.
 */
import type { Id } from '../engine/types.js';
import type { Scene, Choice, Effect, Requirement, Outcome } from './types.js';

/** Collect every SceneRef a scene can route to. */
export function refsOf(scene: Scene): Id[] {
  const refs: Id[] = [];
  const fromChoice = (ch: Choice) => {
    refs.push(ch.to);
    if (ch.check) refs.push(ch.check.failTo);
  };
  const fromOutcome = (o: Outcome) => refs.push(o.to);
  switch (scene.kind) {
    case 'story': case 'dialogue': scene.next.forEach(fromChoice); break;
    case 'check': fromOutcome(scene.success); fromOutcome(scene.failure); break;
    case 'challenge':
      fromOutcome(scene.success); fromOutcome(scene.failure);
      scene.approaches.forEach((a) => { if (a.success) fromOutcome(a.success); if (a.failure) fromOutcome(a.failure); });
      break;
    case 'battle':
      fromOutcome(scene.onWin); if (scene.onLoss) fromOutcome(scene.onLoss);
      if (scene.parley) { fromOutcome(scene.parley.success); if (scene.parley.failure) fromOutcome(scene.parley.failure); }
      break;
    case 'shop': case 'rest': refs.push(scene.next); break;
    case 'explore':
      scene.map.nodes.forEach((n) => {
        refs.push(n.scene);
        if (n.wandering) refs.push(n.wandering.battleScene);
        n.sceneWhen?.forEach((w) => refs.push(w.to));
      });
      if (scene.map.camp?.risky) refs.push(scene.map.camp.risky.battleScene);
      break;
    case 'dungeon': {
      const d = scene.dungeon;
      for (const r of d.rooms) {
        if (r.fight) refs.push(r.fight);
        if (r.event) refs.push(r.event.scene);
        if (r.search) refs.push(r.search);
        if (r.exit) refs.push(r.exit.to);
      }
      for (const l of d.links) if (l.door?.ambush) refs.push(l.door.ambush.battle);
      if (d.torch) refs.push(d.torch.out);
      if (d.camp?.risky) refs.push(d.camp.risky.battleScene);
      break;
    }
    case 'ending': break;
  }
  return refs;
}

export function effectsOf(scene: Scene): Effect[] {
  const out: Effect[] = [];
  const fromChoice = (ch: Choice) => {
    out.push(...(ch.effects ?? []));
    out.push(...(ch.check?.failEffects ?? []));
  };
  switch (scene.kind) {
    case 'story': case 'dialogue': scene.next.forEach(fromChoice); break;
    case 'check': out.push(...(scene.success.effects ?? []), ...(scene.failure.effects ?? [])); break;
    case 'challenge':
      out.push(...(scene.success.effects ?? []), ...(scene.failure.effects ?? []));
      scene.approaches.forEach((a) => out.push(...(a.success?.effects ?? []), ...(a.failure?.effects ?? [])));
      break;
    case 'battle':
      out.push(...(scene.onWin.effects ?? []), ...(scene.onLoss?.effects ?? []),
        ...(scene.parley?.success.effects ?? []), ...(scene.parley?.failure?.effects ?? []));
      break;
    default: break;
  }
  return out;
}

export function requirementsOf(scene: Scene): Requirement[] {
  const out: Requirement[] = [];
  const fromChoice = (ch: Choice) => out.push(...(ch.requires ?? []));
  switch (scene.kind) {
    case 'story': case 'dialogue': scene.next.forEach(fromChoice); break;
    case 'challenge': scene.approaches.forEach((a) => out.push(...(a.requires ?? []))); break;
    case 'explore': scene.map.nodes.forEach((n) => {
      out.push(...(n.requires ?? []));
      n.sceneWhen?.forEach((w) => out.push(...w.if));
    }); break;
    case 'ending':
      for (const s of scene.slides ?? []) out.push(...s.if);
      break;
    case 'dungeon':
      for (const r of scene.dungeon.rooms) out.push(...(r.event?.until ?? []));
      for (const l of scene.dungeon.links) out.push(...(l.door?.locked ?? []));
      break;
    default: break;
  }
  return out;
}

export function skillsOf(scene: Scene): string[] {
  const out: string[] = [];
  const fromChoice = (ch: Choice) => { if (ch.check) out.push(ch.check.skill); };
  switch (scene.kind) {
    case 'story': case 'dialogue': scene.next.forEach(fromChoice); break;
    case 'check': out.push(scene.skill); break;
    case 'challenge': scene.approaches.forEach((a) => out.push(a.skill)); break;
    case 'dungeon':
      for (const l of scene.dungeon.links) if (l.door?.force) out.push(l.door.force.skill);
      break;
    default: break;
  }
  return out;
}

