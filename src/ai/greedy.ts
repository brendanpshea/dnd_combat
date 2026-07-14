/**
 * Greedy AI: scores every legal action by expected value and plays the best
 * one, ending its turn when nothing worthwhile remains. Pure function of
 * state — no engine backdoors, exactly the Action API the CLI uses.
 */
import type { GameState, Id, Combatant, Position } from '../engine/types.js';
import { abilityMod, proficiencyBonus, cellAt } from '../engine/types.js';
import { parseDice } from '../engine/dice.js';
import { WEAPONS } from '../data/weapons.js';
import { SPELLS, spellDc } from '../data/spells.js';
import { distanceCells, distanceFeet, adjacent, sphere2x2, cone15 } from '../engine/grid.js';
import { directionFromDelta } from '../data/spells.js';
import { attackAbility, collectAttackSources } from '../engine/rules/attack.js';
import { resolveRollMode } from '../engine/dice.js';
import { legalActions, Action } from '../engine/actions.js';

// --- probability / EV helpers ----------------------------------------------

function avgDice(expr: string): number {
  const d = parseDice(expr);
  return d.count * (d.sides + 1) / 2 + d.bonus;
}

function clampP(p: number): number {
  return Math.min(0.95, Math.max(0.05, p));
}

function hitProb(bonus: number, ac: number, mode: 'flat' | 'advantage' | 'disadvantage'): number {
  const p = clampP((21 + bonus - ac) / 20);
  if (mode === 'advantage') return 1 - (1 - p) * (1 - p);
  if (mode === 'disadvantage') return p * p;
  return p;
}

function saveFailProb(state: GameState, target: Combatant, ability: keyof Combatant['abilities'], dc: number): number {
  const bonus =
    abilityMod(target.abilities[ability]) +
    (target.savingThrowProfs.includes(ability) ? proficiencyBonus(target.level) : 0);
  // P(d20 + bonus < dc)
  return clampP((dc - bonus - 1) / 20);
}

/** Damage EV weighted up when it can kill. */
function damageValue(ev: number, target: Combatant): number {
  const killBonus = ev >= target.hp ? 4 + target.maxHp / 4 : 0;
  return ev + killBonus;
}

// --- action scoring ----------------------------------------------------------

function scoreAttack(state: GameState, actor: Combatant, a: Action & { kind: 'attack' }): number {
  const weapon = WEAPONS[a.weaponId]!;
  const target = state.combatants[a.targetId]!;
  const isMelee = adjacent(actor.position, target.position) && weapon.melee;
  const { adv, dis } = collectAttackSources(state, actor, target, weapon, isMelee);
  const mode = resolveRollMode(adv, dis);
  const ability = attackAbility(actor, weapon);
  const bonus = abilityMod(actor.abilities[ability]) + proficiencyBonus(actor.level);
  let dmg = avgDice(weapon.damage) + (a.offhand ? 0 : abilityMod(actor.abilities[ability]));
  if (actor.featureIds.includes('dueling') && isMelee && !weapon.properties.includes('two-handed')) dmg += 2;
  if (
    actor.featureIds.includes('sneak-attack') && !actor.turn.sneakAttackUsed &&
    (weapon.properties.includes('finesse') || !weapon.melee)
  ) {
    const allyAdjacent = Object.values(state.combatants).some(
      (c) => c.alive && c.id !== actor.id && c.team === actor.team && adjacent(c.position, target.position),
    );
    if (mode === 'advantage' || (allyAdjacent && mode !== 'disadvantage')) {
      dmg += avgDice(`${Math.ceil(actor.level / 2)}d6`);
    }
  }
  return damageValue(hitProb(bonus, target.ac, mode) * dmg, target);
}

function scoreSpell(state: GameState, actor: Combatant, a: Action & { kind: 'castSpell' }): number {
  const spell = SPELLS[a.spellId]!;
  const dc = spellDc(state, actor.id);
  const castMod = abilityMod(actor.abilities[actor.spellcastingAbility ?? 'int']);
  const spellAtkBonus = castMod + proficiencyBonus(actor.level);
  // Preserve limited slots a little: leveled spells carry a small cost.
  const slotCost = spell.level >= 1 ? 2 : 0;

  switch (a.spellId) {
    case 'fire-bolt': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(hitProb(spellAtkBonus, t.ac, 'flat') * avgDice('1d10'), t);
    }
    case 'shocking-grasp': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(hitProb(spellAtkBonus, t.ac, 'flat') * avgDice('1d8'), t) + 1; // reaction denial
    }
    case 'sacred-flame': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(saveFailProb(state, t, 'dex', dc) * avgDice('1d8'), t);
    }
    case 'magic-missile': {
      const v = a.targets.length * avgDice('1d4+1');
      const first = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(v, first) - slotCost;
    }
    case 'cure-wounds': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const missing = t.maxHp - t.hp;
      const heal = Math.min(avgDice('2d8') + castMod + (actor.featureIds.includes('disciple-of-life') ? 3 : 0), missing);
      // Healing matters most when the ally is badly hurt.
      const urgency = missing >= t.maxHp / 2 ? 1.4 : 0.5;
      return heal * urgency - slotCost;
    }
    case 'bless': {
      if (actor.concentratingOn) return 0;
      return 3 * a.targets.length + (state.round <= 2 ? 3 : 0) - slotCost;
    }
    case 'sleep': {
      const anchor = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(anchor)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive) continue;
        const p = saveFailProb(state, t, 'wis', dc);
        v += t.team === actor.team ? -8 * p : p * (6 + t.maxHp / 3);
      }
      return v - slotCost;
    }
    case 'guiding-bolt': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const p = hitProb(spellAtkBonus, t.ac, 'flat');
      return damageValue(p * avgDice('4d6'), t) + p * 2 - slotCost; // rider bonus
    }
    case 'scorching-ray': {
      let v = 0;
      for (const tg of a.targets) {
        const t = state.combatants[(tg as { combatantId: Id }).combatantId]!;
        v += hitProb(spellAtkBonus, t.ac, 'flat') * avgDice('2d6');
      }
      const first = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(v, first) - slotCost;
    }
    case 'thunderwave': {
      let v = 0;
      const sculpt = actor.featureIds.includes('sculpt-spells');
      for (const c of Object.values(state.combatants)) {
        if (!c.alive || c.id === actor.id || !adjacent(c.position, actor.position)) continue;
        if (sculpt && c.team === actor.team) continue;
        const pFail = saveFailProb(state, c, 'con', dc);
        const ev = avgDice('2d8') * (pFail + (1 - pFail) * 0.5) + pFail * 2; // push value
        v += c.team === actor.team ? -1.5 * ev : damageValue(ev, c);
      }
      return v - slotCost;
    }
    case 'misty-step': {
      // Escape hatch: valuable when stuck in melee; teleport beats disengage+walk.
      const near = nearestEnemyDist(state, actor.position, actor.team);
      if (near > 1) return 0;
      const to = (a.targets[0] as { position: Position }).position;
      const after = nearestEnemyDist(state, to, actor.team);
      return after >= 3 && after <= 8 ? 4 : 0;
    }
    case 'hold-person': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      // Paralysis is near-lethal: allies auto-crit. Weight by save-fail odds and target beefiness.
      return saveFailProb(state, t, 'wis', dc) * (8 + t.hp / 3) - slotCost;
    }
    case 'aid': {
      return state.round <= 2 ? 2.5 * a.targets.length - slotCost : 0;
    }
    case 'burning-hands': {
      const caster = actor;
      const dir = directionFromDelta(caster.position, (a.targets[0] as { position: Position }).position);
      let v = 0;
      for (const pos of cone15(caster.position, dir)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive) continue;
        const pFail = saveFailProb(state, t, 'dex', dc);
        const ev = avgDice('3d6') * (pFail + (1 - pFail) * 0.5);
        v += t.team === actor.team ? -1.5 * ev : damageValue(ev, t);
      }
      return v - slotCost;
    }
    default:
      return 0;
  }
}

/** Does this combatant prefer to fight up close? */
function isMeleeFighter(c: Combatant): boolean {
  if (c.classId === 'fighter' || c.classId === 'rogue' || c.classId === 'cleric') return true;
  if (c.classId === 'wizard') return false;
  // Monsters: charge if they carry any pure-melee weapon (no ranged profile).
  return c.weaponIds.some((w) => {
    const weapon = WEAPONS[w];
    return !!weapon && weapon.melee && weapon.range === undefined;
  });
}

function nearestEnemyDist(state: GameState, from: Position, team: Combatant['team']): number {
  let best = Infinity;
  for (const c of Object.values(state.combatants)) {
    if (c.alive && c.team !== team) best = Math.min(best, distanceCells(from, c.position));
  }
  return best;
}

function scoreMove(state: GameState, actor: Combatant, to: Position): number {
  const now = nearestEnemyDist(state, actor.position, actor.team);
  const after = nearestEnemyDist(state, to, actor.team);
  if (isMeleeFighter(actor)) {
    // Close distance; reaching adjacency this turn is what makes attacks possible.
    const closing = (now - after) * 0.4;
    const reach = after === 1 && !actor.turn.actionUsed ? 1.5 : 0;
    return closing + reach;
  }
  // Ranged casters kite: stay 3-8 cells away, never adjacent.
  const comfort = (d: number) => (d <= 1 ? -3 : d >= 3 && d <= 8 ? 1 : 0);
  let s = comfort(after) - comfort(now) + 0.01 * (after - now);
  // Walking out of melee without Disengage eats an opportunity attack.
  if (now === 1 && after > 1 && !actor.turn.disengaged) s -= 4;
  return s;
}

function scoreFeature(state: GameState, actor: Combatant, a: Action & { kind: 'useFeature' }): number {
  if (a.featureId === 'second-wind') {
    const missing = actor.maxHp - actor.hp;
    return missing >= actor.maxHp / 2 ? Math.min(avgDice(`1d10+${actor.level}`), missing) : 0;
  }
  if (a.featureId === 'action-surge') {
    // Worth it when a follow-up attack is possible, i.e. an enemy is adjacent.
    return Object.values(state.combatants).some(
      (c) => c.alive && c.team !== actor.team && adjacent(c.position, actor.position),
    ) ? 5 : 0;
  }
  if (a.featureId === 'cunning-disengage') {
    // Escape melee before repositioning; mirrors the disengage-action logic.
    return nearestEnemyDist(state, actor.position, actor.team) === 1 && actor.hp < actor.maxHp / 2 ? 1.5 : 0;
  }
  if (a.featureId === 'cunning-dash') {
    return nearestEnemyDist(state, actor.position, actor.team) > 7 ? 0.8 : 0;
  }
  if (a.featureId === 'preserve-life') {
    const pool = 5 * actor.level;
    const healable = Object.values(state.combatants)
      .filter((c) => c.alive && c.team === actor.team && c.hp < Math.floor(c.maxHp / 2))
      .reduce((s, c) => s + Math.min(Math.floor(c.maxHp / 2) - c.hp, pool), 0);
    return Math.min(healable, pool) * 1.2;
  }
  return 0;
}

const END_TURN_THRESHOLD = 0.5;

/** Pick the best action for the current combatant. Returns endTurn when done. */
export function chooseAction(state: GameState, actorId: Id): Action {
  const actor = state.combatants[actorId]!;
  const actions = legalActions(state, actorId);
  let best: Action = { kind: 'endTurn' };
  let bestScore = END_TURN_THRESHOLD;

  for (const a of actions) {
    let s = 0;
    switch (a.kind) {
      case 'attack': s = scoreAttack(state, actor, a); break;
      case 'castSpell': s = scoreSpell(state, actor, a); break;
      case 'move': s = scoreMove(state, actor, a.to); break;
      case 'useFeature': s = scoreFeature(state, actor, a); break;
      case 'dash':
        // Dash only when melee, nothing to attack, and still far away.
        s = isMeleeFighter(actor) && nearestEnemyDist(state, actor.position, actor.team) > 7 &&
            !actions.some((x) => x.kind === 'attack')
          ? 0.6 : 0;
        break;
      case 'disengage':
        // Casters stuck in melee disengage before kiting away.
        s = !isMeleeFighter(actor) &&
            nearestEnemyDist(state, actor.position, actor.team) === 1 &&
            !actor.conditions.some((c) => c.id === 'noReactions')
          ? 0.8 : 0;
        break;
      case 'dodge': s = 0; break;
      case 'shakeAwake': s = 2; break;
      case 'endTurn': continue;
    }
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  return best;
}
