/**
 * The module author's compiler: static checks a shipped module must pass
 * (enforced by a test over every module). Catches the dead ends, dangling
 * gotos, and typos that a scene graph makes easy to introduce.
 */
import type { Id } from '../engine/types.js';
import { CLASSES, SKILL_ABILITY, type SkillId } from '../data/classes.js';
import { MONSTERS } from '../data/monsters.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { MAPS } from '../data/maps.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR } from '../data/armor.js';
import { TRINKETS } from '../data/trinkets.js';
import { isLocationArt, isNpcArt, isNodeToken } from '../data/adventure-art.js';
import { HUB_REF, ROOM_MAP_REF, alwaysShown, type Module, type Requirement } from './types.js';
import { refsOf, effectsOf, requirementsOf, skillsOf, parasOf, flagsWritten } from './graph.js';
import { unresolvedTokens, isNpcFlag, hasUncompiledNpcState } from './npcs.js';
import { checkDungeon } from './dungeon.js';
import { checkModuleReach } from './reach.js';
import { MODULES } from '../data/modules/index.js';

function itemExists(id: Id): boolean {
  return !!(ITEMS[id] || WEAPONS[id] || ARMOR[id] || TRINKETS[id]);
}
function skillExists(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(SKILL_ABILITY, id as SkillId);
}
function encounterExists(id: Id): boolean {
  return !!(ENCOUNTERS[id] || MONSTERS[id]);
}

/** Returns a list of problems; empty means the module is well-formed. */
export function validateModule(module: Module): string[] {
  const errors: string[] = [];
  const ids = new Set(Object.keys(module.scenes));
  const at = (id: Id, msg: string) => errors.push(`[${id}] ${msg}`);

  if (!module.scenes[module.start]) errors.push(`start scene '${module.start}' does not exist`);
  if (module.defeatScene && !ids.has(module.defeatScene)) {
    errors.push(`defeatScene '${module.defeatScene}' does not exist`);
  }
  // The fast-travel home must be a real explore hub (that's where its map lives).
  if (module.town) {
    const townScene = module.scenes[module.town];
    if (!townScene) errors.push(`town '${module.town}' does not exist`);
    else if (townScene.kind !== 'explore') errors.push(`town '${module.town}' must be an explore scene, not ${townScene.kind}`);
  }

  // Companions fight with a real stat block, keyed by their own id.
  for (const [cid, def] of Object.entries(module.companions ?? {})) {
    if (def.id !== cid) errors.push(`companion '${cid}' has id '${def.id}'`);
    if (!MONSTERS[def.monsterId]) errors.push(`companion '${cid}' uses unknown stat block '${def.monsterId}'`);
  }

  // Flag hygiene: every flag read somewhere must be written somewhere.
  const written = new Set<string>();
  const read = new Set<string>();
  // A journal lead resolves when its `resolvedBy` flag fires — track where each
  // is opened so a lead that can never close is caught as an authoring error.
  const leadResolvers = new Map<string, Id>();

  // The battles fought where a dungeon room's board can be drawn.
  const roomFights = new Set<Id>();
  for (const scene of Object.values(module.scenes)) {
    if (scene.kind !== 'dungeon') continue;
    for (const r of scene.dungeon.rooms) if (r.fight) roomFights.add(r.fight);
    for (const l of scene.dungeon.links) if (l.door?.ambush) roomFights.add(l.door.ambush.battle);
    if (scene.dungeon.camp?.risky) roomFights.add(scene.dungeon.camp.risky.battleScene);
  }

  for (const [id, scene] of Object.entries(module.scenes)) {
    if (scene.id !== id) at(id, `scene.id '${scene.id}' does not match its key`);

    for (const ref of refsOf(scene)) {
      if (ref !== HUB_REF && !ids.has(ref)) at(id, `routes to unknown scene '${ref}'`);
    }
    for (const eff of effectsOf(scene)) {
      if (eff.kind === 'addItem' || eff.kind === 'removeItem') {
        if (!itemExists(eff.itemId)) at(id, `effect references unknown item '${eff.itemId}'`);
      }
      if ((eff.kind === 'joinParty' || eff.kind === 'leaveParty') && !module.companions?.[eff.companion]) {
        at(id, `effect names unknown companion '${eff.companion}'`);
      }
      if (eff.kind === 'setFlag') written.add(eff.flag);
      if (eff.kind === 'clearFlag') written.add(eff.flag);
      if (eff.kind === 'copyFlag') { written.add(eff.to); read.add(eff.from); }
      if (eff.kind === 'journal' && eff.entry.kind === 'lead' && eff.entry.resolvedBy) {
        leadResolvers.set(eff.entry.resolvedBy, id);
      }
    }
    // Conditional paragraphs (see `Para`): their requirements are checked like
    // any other, and a scene always has something to say whatever holds.
    const textConds: Requirement[] = [];
    for (const { where, paras } of parasOf(scene)) {
      textConds.push(...paras.flatMap((p) => (typeof p === 'string' ? [] : [...(p.if ?? []), ...(p.assumes ?? [])])));
      // The text a scene stands on must always say something; an intro or a
      // result may be wholly conditional (it can add a line, or none).
      if ((where === 'text' || where === 'lines' || where === 'again') && !paras.some(alwaysShown)) {
        at(id, 'every paragraph is conditional: give it at least one that always shows');
      }
    }
    const sceneAssumes = 'assumes' in scene ? scene.assumes ?? [] : [];
    for (const req of [...requirementsOf(scene), ...textConds, ...sceneAssumes]) {
      if (req.kind === 'flag' || req.kind === 'notFlag') read.add(req.flag);
      if (req.kind === 'item' && !itemExists(req.itemId)) at(id, `requires unknown item '${req.itemId}'`);
      if (req.kind === 'classInParty' && !CLASSES[req.classId]) at(id, `requires unknown class '${req.classId}'`);
      if (req.kind === 'visited' && !ids.has(req.scene)) at(id, `requires visiting unknown scene '${req.scene}'`);
      if ((req.kind === 'companion' || req.kind === 'noCompanion') && !module.companions?.[req.companion]) {
        at(id, `requires unknown companion '${req.companion}'`);
      }
    }
    for (const skill of skillsOf(scene)) {
      if (!skillExists(skill)) at(id, `uses unknown skill '${skill}'`);
    }
    if (scene.kind === 'check' && (scene.dc < 1 || scene.dc > 30)) {
      at(id, `check DC ${scene.dc} out of sane range (1–30)`);
    }
    if (scene.kind === 'challenge') {
      if (scene.approaches.length === 0) at(id, 'challenge has no approaches');
      for (const a of scene.approaches) {
        if (a.dc < 1 || a.dc > 30) at(id, `approach '${a.id}' DC ${a.dc} out of sane range (1–30)`);
      }
      // At least one approach must never be gated, or the party can arrive at a
      // challenge with nothing to try (a soft-lock the leave affordance may not
      // cover on a `noBack` obstacle).
      if (!scene.approaches.some((a) => !a.requires || a.requires.length === 0)) {
        at(id, 'challenge needs at least one always-available approach (an ungated line of attack)');
      }
    }
    // Art vocabulary: location backdrops and NPC portraits must name a shared
    // reusable id (src/data/adventure-art.ts) so the generated set stays
    // curated and every module is art-complete for free.
    const artId = 'art' in scene ? scene.art?.imageId : undefined;
    if (artId && !isLocationArt(artId)) at(id, `art.imageId '${artId}' is not a known location (see adventure-art.ts)`);
    if (scene.kind === 'explore' && scene.map.art?.imageId && !isLocationArt(scene.map.art.imageId)) {
      at(id, `explore map art '${scene.map.art.imageId}' is not a known location`);
    }
    if (scene.kind === 'explore') {
      const nodeIds = new Set(scene.map.nodes.map((n) => n.id));
      // A `tok-` icon must name a real token; a raw emoji is fine (back-compat).
      for (const n of scene.map.nodes) {
        if (n.icon.startsWith('tok-') && !isNodeToken(n.icon)) {
          at(id, `node '${n.id}' icon '${n.icon}' is not a known token (see adventure-art.ts)`);
        }
      }
      // Traversal map: edges and entries must reference real nodes, an entry is
      // required, and every node must be reachable from an entry along paths.
      const { paths, entry } = scene.map;
      if (paths) {
        for (const [a, b] of paths) {
          if (!nodeIds.has(a)) at(id, `path edge references unknown node '${a}'`);
          if (!nodeIds.has(b)) at(id, `path edge references unknown node '${b}'`);
        }
        if (!entry || entry.length === 0) at(id, 'a traversal map (with paths) needs at least one entry node');
        for (const e of entry ?? []) if (!nodeIds.has(e)) at(id, `entry references unknown node '${e}'`);
        const seenN = new Set<Id>(entry ?? []);
        const q = [...seenN];
        while (q.length) {
          const cur = q.shift()!;
          for (const [a, b] of paths) {
            const nb = a === cur ? b : b === cur ? a : undefined;
            if (nb && !seenN.has(nb)) { seenN.add(nb); q.push(nb); }
          }
        }
        for (const n of scene.map.nodes) {
          if (!seenN.has(n.id)) at(id, `node '${n.id}' is unreachable from any entry along paths`);
        }
      } else if (entry?.length) {
        // Free-roam entry is legal now: it's where the party pawn stands on
        // first arrival. It still has to name a real node.
        for (const e of entry) if (!nodeIds.has(e)) at(id, `entry references unknown node '${e}'`);
      }
      // Visual roads (free-roam overworld look) must reference real nodes too.
      for (const [a, b] of scene.map.roads ?? []) {
        if (!nodeIds.has(a)) at(id, `road references unknown node '${a}'`);
        if (!nodeIds.has(b)) at(id, `road references unknown node '${b}'`);
      }
    }
    if (scene.kind === 'dialogue' && scene.npc.portraitId && !isNpcArt(scene.npc.portraitId)) {
      at(id, `NPC portraitId '${scene.npc.portraitId}' is not a known archetype`);
    }
    if (scene.kind === 'shop' && scene.npc?.portraitId && !isNpcArt(scene.npc.portraitId)) {
      at(id, `shop NPC portraitId '${scene.npc.portraitId}' is not a known archetype`);
    }
    if (scene.kind === 'battle') {
      if (!encounterExists(scene.encounterId)) at(id, `unknown encounter '${scene.encounterId}'`);
      if (scene.mapId === ROOM_MAP_REF) {
        // A board drawn for the room — so the fight has to happen in one.
        if (!roomFights.has(id)) at(id, `map '${ROOM_MAP_REF}' is only for a fight in a dungeon room or corridor`);
      } else if (!MAPS[scene.mapId]) at(id, `unknown map '${scene.mapId}'`);
    }
    if (scene.kind === 'dungeon') {
      errors.push(...checkDungeon(module, id, scene.dungeon));
      if (scene.dungeon.art?.imageId && !isLocationArt(scene.dungeon.art.imageId)) {
        at(id, `dungeon art '${scene.dungeon.art.imageId}' is not a known location`);
      }
    }
  }

  // NPC tokens are all resolved (see npcs.ts), and the registry's
  // introductions for this chapter name real scenes.
  for (const t of unresolvedTokens(module)) errors.push(`unresolved NPC token ${t}: build the module with withNpcs, or fix the token`);
  for (const npc of Object.values(module.npcs ?? {})) {
    for (const sid of npc.introducedAt?.[module.id] ?? []) if (!ids.has(sid)) errors.push(`NPC ${npc.id} is introduced at unknown scene '${sid}'`);
  }

  // The cast: every introducing scene exists.
  for (const member of module.cast ?? []) {
    if (!member.introducedAt.length) errors.push(`cast ${member.name} has no introducing scene`);
    for (const sid of member.introducedAt) if (!ids.has(sid)) errors.push(`cast ${member.name} is introduced at unknown scene '${sid}'`);
  }

  // The chapter's clock: mornings in order, after the first day.
  let lastDawn = 1;
  for (const d of module.dawns ?? []) {
    if (!Number.isInteger(d.day) || d.day <= lastDawn) errors.push(`dawn of day ${d.day} must be a whole day after ${lastDawn}, in order`);
    lastDawn = Math.max(lastDawn, d.day);
    if (!d.text.length) errors.push(`dawn of day ${d.day} has no text: a player must see the morning that changed things`);
    for (const eff of d.effects ?? []) {
      if (eff.kind === 'setFlag' || eff.kind === 'clearFlag') written.add(eff.flag);
      if (eff.kind === 'copyFlag') { written.add(eff.to); read.add(eff.from); }
      if ((eff.kind === 'addItem' || eff.kind === 'removeItem') && !itemExists(eff.itemId)) errors.push(`dawn of day ${d.day} references unknown item '${eff.itemId}'`);
      if ((eff.kind === 'joinParty' || eff.kind === 'leaveParty') && !module.companions?.[eff.companion]) errors.push(`dawn of day ${d.day} names unknown companion '${eff.companion}'`);
      if (eff.kind === 'passDay') errors.push(`dawn of day ${d.day} loses a day: a morning cannot pass another`);
    }
  }

  // A carried flag (`module:flag`) is set by an earlier chapter of the same
  // campaign, which must declare it in its `carries`.
  const ancestors: Module[] = [];
  for (let id: string | undefined = module.id; ;) {
    const prev = MODULES.find((m) => m.sequel === id && !ancestors.includes(m));
    if (!prev) break;
    ancestors.push(prev);
    id = prev.id;
  }
  for (const flag of read) {
    if (flag.includes(':')) {
      const [origin, name] = [flag.slice(0, flag.indexOf(':')), flag.slice(flag.indexOf(':') + 1)];
      const from = ancestors.find((m) => m.id === origin);
      if (!from) errors.push(`flag '${flag}' is carried from '${origin}', which is not an earlier chapter of this campaign`);
      else if (!from.carries?.includes(name)) errors.push(`flag '${flag}' is not in ${origin}'s carries`);
      continue;
    }
    if (isNpcFlag(flag)) {
      // NPC state is campaign-wide: this chapter or any before it may set it.
      if (!written.has(flag) && !ancestors.some((m) => flagsWritten(m).has(flag))) errors.push(`NPC state '${flag}' is read but no scene of this chapter or an earlier one sets it`);
      continue;
    }
    if (!written.has(flag)) errors.push(`flag '${flag}' is read but never set by any scene`);
  }
  if (hasUncompiledNpcState([module.scenes, module.dawns ?? []])) {
    errors.push('has NPC requirements or effects left uncompiled: build the module with withNpcs');
  }
  for (const flag of module.carries ?? []) {
    if (!written.has(flag)) errors.push(`carries '${flag}', which no scene sets`);
  }
  for (const [flag, id] of leadResolvers) {
    if (!written.has(flag)) at(id, `journal lead's resolvedBy flag '${flag}' is never set, so the lead can never close`);
  }

  // Reachability: BFS from start over unconditional-ish refs (we treat every
  // ref as potentially reachable — gating is a runtime concern, not a dead end).
  const roots = [module.start, ...(module.defeatScene ? [module.defeatScene] : [])];
  const seen = new Set<Id>(roots);
  const queue = [...roots];
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

  // Scenes the party opens from a map (a marker, a dungeon room, the start)
  // can be walked away from: they play again next time. A scene reached as
  // the OUTCOME of something (a check, a fight, a choice) is different: if it
  // offers "Back to <location>" while every one of its choices carries an
  // effect, leaving skips the effects for good (a death undone, a deal
  // re-rolled, a fight re-farmed). Such a scene must be one-way.
  const entries = new Set<Id>([module.start, ...(module.defeatScene ? [module.defeatScene] : [])]);
  for (const sc of Object.values(module.scenes)) {
    if (sc.kind === 'explore') {
      for (const n of sc.map.nodes) {
        entries.add(n.scene);
        for (const w of n.sceneWhen ?? []) entries.add(w.to);
        if (n.wandering) entries.add(n.wandering.battleScene);
      }
    }
    if (sc.kind === 'dungeon') {
      for (const r of sc.dungeon.rooms) {
        for (const t of [r.fight, r.event?.scene, r.search, r.exit?.to]) if (t) entries.add(t);
      }
    }
  }
  for (const [id, sc] of Object.entries(module.scenes)) {
    if (entries.has(id) || (sc.kind !== 'story' && sc.kind !== 'dialogue') || sc.noBack || sc.next.length === 0) continue;
    if (sc.next.every((c) => (c.effects?.length ?? 0) > 0 || !!c.check)) {
      at(id, 'is reached as an outcome and every choice carries an effect, but it offers a way back that skips them all: set noBack');
    }
  }

  // With the shape sound, walk every state a party can get the module into:
  // scenes gated shut for good, and states with no way left to a victory.
  if (errors.length === 0) {
    const reach = checkModuleReach(module);
    if (reach.skipped) errors.push(`the reachability search could not run: ${reach.skipped}`);
    errors.push(...reach.errors);
  }

  return errors;
}
