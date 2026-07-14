/**
 * Attack resolution and damage application. All functions mutate the draft
 * state they are given — step() owns cloning, these own the rules.
 */
import type { GameState, Combatant, Id, DamageType } from '../types.js';
import { abilityMod, proficiencyBonus, cellAt } from '../types.js';
import { WEAPONS, WeaponData } from '../../data/weapons.js';
import { rollD20, rollDice, resolveRollMode } from '../dice.js';
import { distanceFeet, adjacent } from '../grid.js';
import type { GameEvent } from '../events.js';

/** Which ability powers an attack with this weapon. */
export function attackAbility(attacker: Combatant, weapon: WeaponData): 'str' | 'dex' {
  const finesse = weapon.properties.includes('finesse');
  if (!weapon.melee) return 'dex';
  if (finesse) return attacker.abilities.dex >= attacker.abilities.str ? 'dex' : 'str';
  return 'str'; // thrown non-finesse weapons also use str
}

export interface AttackContext {
  opportunity?: boolean;
  /** Flat damage bonus (e.g. Dueling), applied on hit, not doubled by crits. */
  flatDamageBonus?: number;
  /** Extra damage dice on hit (e.g. Sneak Attack), doubled by crits. */
  extraDice?: string;
}

/**
 * Collect advantage/disadvantage sources for an attack. Phase 3 features add
 * sources here; the cancellation rule in resolveRollMode does the rest.
 */
export function collectAttackSources(
  state: GameState,
  attacker: Combatant,
  target: Combatant,
  weapon: WeaponData,
  isMeleeAttack: boolean,
): { adv: string[]; dis: string[] } {
  const adv: string[] = [];
  const dis: string[] = [];
  const dist = distanceFeet(attacker.position, target.position);

  if (!isMeleeAttack) {
    if (weapon.range && dist > weapon.range.normal) dis.push('long range');
    // Ranged attack with any hostile adjacent to the attacker.
    for (const c of Object.values(state.combatants)) {
      if (c.alive && c.team !== attacker.team && adjacent(c.position, attacker.position)) {
        dis.push('enemy adjacent');
        break;
      }
    }
  }

  if (target.conditions.some((c) => c.id === 'dodging')) dis.push('target dodging');
  if (attacker.conditions.some((c) => c.id === 'sapped')) dis.push('sapped');
  if (attacker.conditions.some((c) => c.id === 'poisoned')) dis.push('poisoned');
  if (attacker.conditions.some((c) => c.id === 'blinded')) dis.push('blinded');
  if (target.conditions.some((c) => c.id === 'blinded')) adv.push('target blinded');
  if (attacker.conditions.some((c) => c.id === 'vexed' && c.sourceId === target.id)) {
    adv.push('vex');
  }
  if (target.conditions.some((c) => c.id === 'unconscious')) {
    adv.push('target unconscious');
  }
  if (target.conditions.some((c) => c.id === 'prone')) {
    (isMeleeAttack ? adv : dis).push(isMeleeAttack ? 'target prone' : 'target prone (ranged)');
  }
  if (attacker.conditions.some((c) => c.id === 'prone')) dis.push('attacker prone');

  return { adv, dis };
}

/** Remove one-shot roll markers after an attack roll is made. */
function consumeRollMarkers(attacker: Combatant, targetId: Id): void {
  attacker.conditions = attacker.conditions.filter(
    (c) => c.id !== 'sapped' && !(c.id === 'vexed' && c.sourceId === targetId),
  );
}

export function resolveAttack(
  state: GameState,
  attackerId: Id,
  targetId: Id,
  weaponId: Id,
  ctx: AttackContext = {},
): GameEvent[] {
  const events: GameEvent[] = [];
  const attacker = state.combatants[attackerId]!;
  const target = state.combatants[targetId]!;
  const weapon = WEAPONS[weaponId]!;
  const isMeleeAttack = adjacent(attacker.position, target.position) && weapon.melee;

  const { adv, dis } = collectAttackSources(state, attacker, target, weapon, isMeleeAttack);
  const mode = resolveRollMode(adv, dis);
  const d20 = rollD20(state.rng, mode);
  state.rng = d20.state;

  const ability = attackAbility(attacker, weapon);
  const mod = abilityMod(attacker.abilities[ability]);
  const prof = proficiencyBonus(attacker.level); // v1: proficient with all carried weapons
  const total = d20.natural + mod + prof;

  // Auto-crit on hitting an unconscious target from melee range.
  const unconsciousAdjacent =
    target.conditions.some((c) => c.id === 'unconscious') && isMeleeAttack;
  const crit = d20.natural === 20 || unconsciousAdjacent;
  const hit = d20.natural !== 1 && (d20.natural === 20 || total >= target.ac);

  consumeRollMarkers(attacker, targetId);

  events.push({
    type: 'attackRolled',
    attackerId, targetId, weaponId,
    natural: d20.natural, total, targetAc: target.ac,
    mode, advSources: adv, disSources: dis,
    hit, crit: hit && crit,
    opportunity: ctx.opportunity ?? false,
  });

  if (!hit) return events;

  const dmg = rollDice(state.rng, weapon.damage, crit);
  state.rng = dmg.state;
  let amount = dmg.total + mod + (ctx.flatDamageBonus ?? 0);
  let rolls = dmg.rolls;
  if (ctx.extraDice) {
    const extra = rollDice(state.rng, ctx.extraDice, crit);
    state.rng = extra.state;
    amount += extra.total;
    rolls = [...rolls, ...extra.rolls];
  }
  amount = Math.max(1, amount);

  events.push(...applyDamage(state, targetId, attackerId, amount, weapon.damageType, rolls));

  // Weapon mastery riders (Sap/Vex) hook in here in Phase 3.
  return events;
}

/**
 * Apply damage: HP, concentration save, waking the unconscious, death,
 * win check.
 */
export function applyDamage(
  state: GameState,
  targetId: Id,
  sourceId: Id,
  amount: number,
  damageType: DamageType,
  rolls: number[] = [],
): GameEvent[] {
  const events: GameEvent[] = [];
  const target = state.combatants[targetId]!;

  target.hp = Math.max(0, target.hp - amount);
  events.push({ type: 'damageDealt', targetId, sourceId, amount, damageType, rolls });

  // Damage wakes the unconscious.
  if (target.hp > 0 && target.conditions.some((c) => c.id === 'unconscious')) {
    target.conditions = target.conditions.filter((c) => c.id !== 'unconscious');
    events.push({ type: 'conditionRemoved', combatantId: targetId, condition: 'unconscious' });
  }

  // Concentration save: DC max(10, floor(damage/2)).
  if (target.hp > 0 && target.concentratingOn) {
    const dc = Math.max(10, Math.floor(amount / 2));
    const d20 = rollD20(state.rng, 'flat');
    state.rng = d20.state;
    const mod = abilityMod(target.abilities.con);
    const prof = target.savingThrowProfs.includes('con') ? proficiencyBonus(target.level) : 0;
    const total = d20.natural + mod + prof;
    const success = total >= dc;
    events.push({
      type: 'savingThrow', combatantId: targetId, ability: 'con', dc,
      natural: d20.natural, total, success,
    });
    if (!success) {
      events.push(...breakConcentration(state, targetId));
    }
  }

  if (target.hp === 0) {
    events.push(...kill(state, targetId));
  }
  return events;
}

export function breakConcentration(state: GameState, combatantId: Id): GameEvent[] {
  const c = state.combatants[combatantId]!;
  if (!c.concentratingOn) return [];
  const { spellId, targetIds } = c.concentratingOn;
  delete c.concentratingOn;
  const events: GameEvent[] = [{ type: 'concentrationBroken', combatantId, spellId }];
  // Remove conditions this concentration was sustaining on its targets.
  for (const tid of targetIds) {
    const t = state.combatants[tid];
    if (!t) continue;
    const before = t.conditions.length;
    t.conditions = t.conditions.filter((cond) => cond.sourceId !== combatantId);
    if (t.conditions.length < before) {
      // Event granularity: one removal notice per target is enough for v1 logs.
    }
  }
  return events;
}

export function kill(state: GameState, combatantId: Id): GameEvent[] {
  const c = state.combatants[combatantId]!;
  c.alive = false;
  c.hp = 0;
  c.conditions = [];
  const cell = cellAt(state.grid, c.position);
  if (cell && cell.occupantId === combatantId) delete cell.occupantId;
  const events: GameEvent[] = [
    { type: 'died', combatantId },
    ...breakConcentration(state, combatantId),
  ];
  const winner = checkWinner(state);
  if (winner) {
    state.winner = winner;
    events.push({ type: 'combatEnded', winner });
  }
  return events;
}

export function checkWinner(state: GameState): 'team1' | 'team2' | null {
  const alive = Object.values(state.combatants).filter((c) => c.alive);
  const t1 = alive.some((c) => c.team === 'team1');
  const t2 = alive.some((c) => c.team === 'team2');
  if (t1 && !t2) return 'team1';
  if (t2 && !t1) return 'team2';
  return null;
}
