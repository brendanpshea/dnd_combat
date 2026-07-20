/**
 * The module author's compiler: static checks a shipped module must pass
 * (enforced by a test over every module). Catches the dead ends, dangling
 * gotos, and typos that a scene graph makes easy to introduce.
 */
import type { Id } from '../engine/types.js';
import { CLASSES, SKILL_ABILITY, type SkillId } from '../data/classes.js';
import { ENCOUNTERS, MONSTERS } from '../data/monsters.js';
import { MAPS } from '../data/maps.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR } from '../data/armor.js';
import { TRINKETS } from '../data/trinkets.js';
import { isLocationArt, isNpcArt } from '../data/adventure-art.js';
import { HUB_REF, type Module, type Scene, type Choice, type Effect, type Requirement, type Outcome } from './types.js';

function itemExists(id: Id): boolean {
  return !!(ITEMS[id] || WEAPONS[id] || ARMOR[id] || TRINKETS[id]);
}
function skillExists(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(SKILL_ABILITY, id as SkillId);
}
function encounterExists(id: Id): boolean {
  return !!(ENCOUNTERS[id] || MONSTERS[id]);
}

/** Collect every SceneRef a scene can route to. */
function refsOf(scene: Scene): Id[] {
  const refs: Id[] = [];
  const fromChoice = (ch: Choice) => {
    refs.push(ch.to);
    if (ch.check) refs.push(ch.check.failTo);
  };
  const fromOutcome = (o: Outcome) => refs.push(o.to);
  switch (scene.kind) {
    case 'story': case 'dialogue': scene.next.forEach(fromChoice); break;
    case 'check': fromOutcome(scene.success); fromOutcome(scene.failure); break;
    case 'battle': fromOutcome(scene.onWin); if (scene.onLoss) fromOutcome(scene.onLoss); break;
    case 'shop': case 'rest': refs.push(scene.next); break;
    case 'explore':
      scene.map.nodes.forEach((n) => {
        refs.push(n.scene);
        if (n.wandering) refs.push(n.wandering.battleScene);
      });
      if (scene.map.camp?.risky) refs.push(scene.map.camp.risky.battleScene);
      break;
    case 'ending': break;
  }
  return refs;
}

function effectsOf(scene: Scene): Effect[] {
  const out: Effect[] = [];
  const fromChoice = (ch: Choice) => {
    out.push(...(ch.effects ?? []));
    out.push(...(ch.check?.failEffects ?? []));
  };
  switch (scene.kind) {
    case 'story': case 'dialogue': scene.next.forEach(fromChoice); break;
    case 'check': out.push(...(scene.success.effects ?? []), ...(scene.failure.effects ?? [])); break;
    case 'battle':
      out.push(...(scene.onWin.effects ?? []), ...(scene.onLoss?.effects ?? [])); break;
    default: break;
  }
  return out;
}

function requirementsOf(scene: Scene): Requirement[] {
  const out: Requirement[] = [];
  const fromChoice = (ch: Choice) => out.push(...(ch.requires ?? []));
  switch (scene.kind) {
    case 'story': case 'dialogue': scene.next.forEach(fromChoice); break;
    case 'explore': scene.map.nodes.forEach((n) => out.push(...(n.requires ?? []))); break;
    default: break;
  }
  return out;
}

function skillsOf(scene: Scene): string[] {
  const out: string[] = [];
  const fromChoice = (ch: Choice) => { if (ch.check) out.push(ch.check.skill); };
  switch (scene.kind) {
    case 'story': case 'dialogue': scene.next.forEach(fromChoice); break;
    case 'check': out.push(scene.skill); break;
    default: break;
  }
  return out;
}

/** Returns a list of problems; empty means the module is well-formed. */
export function validateModule(module: Module): string[] {
  const errors: string[] = [];
  const ids = new Set(Object.keys(module.scenes));
  const at = (id: Id, msg: string) => errors.push(`[${id}] ${msg}`);

  if (!module.scenes[module.start]) errors.push(`start scene '${module.start}' does not exist`);

  // Flag hygiene: every flag read somewhere must be written somewhere.
  const written = new Set<string>();
  const read = new Set<string>();

  for (const [id, scene] of Object.entries(module.scenes)) {
    if (scene.id !== id) at(id, `scene.id '${scene.id}' does not match its key`);

    for (const ref of refsOf(scene)) {
      if (ref !== HUB_REF && !ids.has(ref)) at(id, `routes to unknown scene '${ref}'`);
    }
    for (const eff of effectsOf(scene)) {
      if (eff.kind === 'addItem' || eff.kind === 'removeItem') {
        if (!itemExists(eff.itemId)) at(id, `effect references unknown item '${eff.itemId}'`);
      }
      if (eff.kind === 'setFlag') written.add(eff.flag);
      if (eff.kind === 'clearFlag') written.add(eff.flag);
    }
    for (const req of requirementsOf(scene)) {
      if (req.kind === 'flag' || req.kind === 'notFlag') read.add(req.flag);
      if (req.kind === 'item' && !itemExists(req.itemId)) at(id, `requires unknown item '${req.itemId}'`);
      if (req.kind === 'classInParty' && !CLASSES[req.classId]) at(id, `requires unknown class '${req.classId}'`);
      if (req.kind === 'visited' && !ids.has(req.scene)) at(id, `requires visiting unknown scene '${req.scene}'`);
    }
    for (const skill of skillsOf(scene)) {
      if (!skillExists(skill)) at(id, `uses unknown skill '${skill}'`);
    }
    if (scene.kind === 'check' && (scene.dc < 1 || scene.dc > 30)) {
      at(id, `check DC ${scene.dc} out of sane range (1–30)`);
    }
    // Art vocabulary: location backdrops and NPC portraits must name a shared
    // reusable id (src/data/adventure-art.ts) so the generated set stays
    // curated and every module is art-complete for free.
    const artId = 'art' in scene ? scene.art?.imageId : undefined;
    if (artId && !isLocationArt(artId)) at(id, `art.imageId '${artId}' is not a known location (see adventure-art.ts)`);
    if (scene.kind === 'explore' && scene.map.art?.imageId && !isLocationArt(scene.map.art.imageId)) {
      at(id, `explore map art '${scene.map.art.imageId}' is not a known location`);
    }
    if (scene.kind === 'dialogue' && scene.npc.portraitId && !isNpcArt(scene.npc.portraitId)) {
      at(id, `NPC portraitId '${scene.npc.portraitId}' is not a known archetype`);
    }
    if (scene.kind === 'shop' && scene.npc?.portraitId && !isNpcArt(scene.npc.portraitId)) {
      at(id, `shop NPC portraitId '${scene.npc.portraitId}' is not a known archetype`);
    }
    if (scene.kind === 'battle') {
      if (!encounterExists(scene.encounterId)) at(id, `unknown encounter '${scene.encounterId}'`);
      if (!MAPS[scene.mapId]) at(id, `unknown map '${scene.mapId}'`);
    }
  }

  for (const flag of read) {
    if (!written.has(flag)) errors.push(`flag '${flag}' is read but never set by any scene`);
  }

  // Reachability: BFS from start over unconditional-ish refs (we treat every
  // ref as potentially reachable — gating is a runtime concern, not a dead end).
  const seen = new Set<Id>([module.start]);
  const queue = [module.start];
  while (queue.length) {
    const scene = module.scenes[queue.shift()!];
    if (!scene) continue;
    for (const ref of refsOf(scene)) {
      if (!seen.has(ref) && ids.has(ref)) { seen.add(ref); queue.push(ref); }
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) at(id, 'is unreachable from the start scene');
  }

  // At least one ending must be reachable.
  const reachesEnding = [...seen].some((id) => module.scenes[id]?.kind === 'ending');
  if (!reachesEnding) errors.push('no ending scene is reachable from the start');

  // No non-terminal scene should be a dead end (zero routes out).
  for (const [id, scene] of Object.entries(module.scenes)) {
    if (scene.kind === 'ending') continue;
    if (refsOf(scene).length === 0) at(id, 'is a dead end (no routes out and not an ending)');
  }

  return errors;
}
