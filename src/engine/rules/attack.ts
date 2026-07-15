/**
 * Attack resolution and damage application. All functions mutate the draft
 * state they are given — step() owns cloning, these own the rules.
 */
import type { GameState, Combatant, Id, DamageType } from '../types.js';
import { abilityMod, proficiencyBonus, cellAt } from '../types.js';
import { WEAPONS, WeaponData } from '../../data/weapons.js';
import { acOf } from '../../data/armor.js';
import { rollD20, rollDice, resolveRollMode } from '../dice.js';
import { distanceFeet, adjacent } from '../grid.js';
import { savingThrow } from './saves.js';
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
  /** Off-hand (light weapon) attack: no ability modifier on damage. */
  offhand?: boolean;
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
  // Pack Tactics: an un-incapacitated ally of the attacker adjacent to the target.
  if (attacker.featureIds.includes('pack-tactics')) {
    const packed = Object.values(state.combatants).some(
      (c) => c.alive && c.id !== attacker.id && c.team === attacker.team &&
             adjacent(c.position, target.position) &&
             !c.conditions.some((k) => k.id === 'incapacitated' || k.id === 'unconscious'),
    );
    if (packed) adv.push('pack tactics');
  }
  if (target.conditions.some((c) => c.id === 'unconscious')) {
    adv.push('target unconscious');
  }
  if (target.conditions.some((c) => c.id === 'paralyzed')) {
    adv.push('target paralyzed');
  }
  if (target.conditions.some((c) => c.id === 'guided')) {
    adv.push('guiding bolt');
  }
  // Assassinate: the target hasn't taken a turn yet this combat.
  if (attacker.featureIds.includes('assassinate') && !target.hasActed) {
    adv.push('assassinate');
  }
  if (target.conditions.some((c) => c.id === 'prone')) {
    (isMeleeAttack ? adv : dis).push(isMeleeAttack ? 'target prone' : 'target prone (ranged)');
  }
  if (attacker.conditions.some((c) => c.id === 'prone')) dis.push('attacker prone');

  return { adv, dis };
}

/** Remove one-shot roll markers after an attack roll is made. */
function consumeRollMarkers(attacker: Combatant, target: Combatant): void {
  attacker.conditions = attacker.conditions.filter(
    (c) => c.id !== 'sapped' && !(c.id === 'vexed' && c.sourceId === target.id),
  );
  // Guiding Bolt's advantage is spent by whoever attacks the target next.
  target.conditions = target.conditions.filter((c) => c.id !== 'guided');
}

/** Paralyzed/unconscious targets crit automatically when hit from melee range. */
export function isHelpless(target: Combatant): boolean {
  return target.conditions.some((c) => c.id === 'unconscious' || c.id === 'paralyzed');
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
  let total = d20.natural + mod + prof + (weapon.attackBonus ?? 0);
  if (attacker.conditions.some((c) => c.id === 'blessed')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total += d4.total;
  }

  // Champion widens the crit range to 19-20.
  const critFloor = attacker.featureIds.includes('improved-critical') ? 19 : 20;
  const natCrit = d20.natural >= critFloor;
  // Auto-crit on hitting a helpless (unconscious/paralyzed) target from melee.
  const crit = natCrit || (isHelpless(target) && isMeleeAttack);
  const targetAc = acOf(target);
  // Only a natural 20 hits regardless of AC; a Champion's 19 still needs to hit.
  const hit = d20.natural !== 1 && (d20.natural === 20 || total >= targetAc);

  consumeRollMarkers(attacker, target);

  events.push({
    type: 'attackRolled',
    attackerId, targetId, weaponId,
    natural: d20.natural, total, targetAc,
    mode, advSources: adv, disSources: dis,
    hit, crit: hit && crit,
    opportunity: ctx.opportunity ?? false,
  });

  if (!hit) return events;

  const dmg = rollDice(state.rng, weapon.damage, crit);
  state.rng = dmg.state;
  let amount = dmg.total + (ctx.offhand ? 0 : mod) + (weapon.damageBonus ?? 0);
  let rolls = dmg.rolls;

  // Fighting Style: Dueling — one-handed melee weapon, no weapon in the
  // other hand (a shield is fine): +2.
  if (
    attacker.featureIds.includes('dueling') &&
    isMeleeAttack &&
    !weapon.properties.includes('two-handed') &&
    (attacker.equipped.offHand === undefined || attacker.equipped.offHand === 'shield')
  ) {
    amount += 2;
  }

  // Sneak Attack: once per turn, finesse/ranged weapon, and either advantage
  // or an ally adjacent to the target — never while at disadvantage.
  if (
    attacker.featureIds.includes('sneak-attack') &&
    !attacker.turn.sneakAttackUsed &&
    (weapon.properties.includes('finesse') || !weapon.melee)
  ) {
    const allyAdjacent = Object.values(state.combatants).some(
      (c) => c.alive && c.id !== attackerId && c.team === attacker.team &&
             adjacent(c.position, target.position),
    );
    const qualifies = mode === 'advantage' || (allyAdjacent && mode !== 'disadvantage');
    if (qualifies) {
      const sneakDice = `${Math.ceil(attacker.level / 2)}d6`;
      const extra = rollDice(state.rng, sneakDice, crit);
      state.rng = extra.state;
      amount += extra.total;
      rolls = [...rolls, ...extra.rolls];
      attacker.turn.sneakAttackUsed = true;
    }
  }

  // Goblin-style rider: extra dice when the roll had advantage.
  if (weapon.bonusDiceOnAdvantage && mode === 'advantage') {
    const extra = rollDice(state.rng, weapon.bonusDiceOnAdvantage, crit);
    state.rng = extra.state;
    amount += extra.total;
    rolls = [...rolls, ...extra.rolls];
  }

  amount = Math.max(1, amount);

  events.push(...applyDamage(state, targetId, attackerId, amount, weapon.damageType, rolls, { crit }));

  if (weapon.onHitCondition && target.alive &&
      !target.conditions.some((c) => c.id === weapon.onHitCondition)) {
    target.conditions.push({ id: weapon.onHitCondition, sourceId: attackerId });
    events.push({ type: 'conditionApplied', combatantId: targetId, condition: weapon.onHitCondition, sourceId: attackerId });
  }

  // Weapon mastery riders, only for wielders trained in this weapon's mastery.
  if (weapon.mastery && attacker.weaponMasteries.includes(weapon.id) && target.alive) {
    if (weapon.mastery === 'sap' && !target.conditions.some((c) => c.id === 'sapped')) {
      target.conditions.push({ id: 'sapped', sourceId: attackerId });
      events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'sapped', sourceId: attackerId });
    } else if (weapon.mastery === 'vex') {
      if (!attacker.conditions.some((c) => c.id === 'vexed' && c.sourceId === targetId)) {
        attacker.conditions.push({ id: 'vexed', sourceId: targetId });
        events.push({ type: 'conditionApplied', combatantId: attackerId, condition: 'vexed', sourceId: targetId });
      }
    }
  }
  return events;
}

/**
 * Apply damage: resist/vuln/immune adjustment, HP, Undead Fortitude,
 * concentration save, waking the unconscious, death, win check.
 */
export function applyDamage(
  state: GameState,
  targetId: Id,
  sourceId: Id,
  amount: number,
  damageType: DamageType,
  rolls: number[] = [],
  opts: { crit?: boolean } = {},
): GameEvent[] {
  const events: GameEvent[] = [];
  const target = state.combatants[targetId]!;

  if (target.immunities.includes(damageType)) amount = 0;
  else if (target.resistances.includes(damageType)) amount = Math.floor(amount / 2);
  else if (target.vulnerabilities.includes(damageType)) amount *= 2;

  target.hp = Math.max(0, target.hp - amount);
  events.push({ type: 'damageDealt', targetId, sourceId, amount, damageType, rolls });

  // Undead Fortitude: unless radiant or a crit, Con save DC 5 + damage to
  // drop to 1 HP instead of 0.
  if (
    target.hp === 0 && target.featureIds.includes('undead-fortitude') &&
    damageType !== 'radiant' && !opts.crit
  ) {
    const save = savingThrow(state, targetId, 'con', 5 + amount);
    events.push(save.event);
    if (save.success) target.hp = 1;
  }

  // Damage ends the Sleep effect at either stage: the stage-1 magical
  // Incapacitated (identified by its repeat save) and the escalated
  // Unconscious both wake on any damage.
  if (target.hp > 0) {
    const asleep = (c: (typeof target.conditions)[number]) =>
      c.id === 'unconscious' || (c.id === 'incapacitated' && c.repeatSave !== undefined);
    for (const c of target.conditions) {
      if (asleep(c)) events.push({ type: 'conditionRemoved', combatantId: targetId, condition: c.id });
    }
    target.conditions = target.conditions.filter((c) => !asleep(c));
  }

  // Concentration save: DC max(10, floor(damage/2)).
  if (target.hp > 0 && target.concentratingOn) {
    const dc = Math.max(10, Math.floor(amount / 2));
    const save = savingThrow(state, targetId, 'con', dc);
    events.push(save.event);
    if (!save.success) {
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
    for (const cond of t.conditions) {
      if (cond.sourceId === combatantId && cond.concentration) {
        events.push({ type: 'conditionRemoved', combatantId: tid, condition: cond.id });
      }
    }
    t.conditions = t.conditions.filter(
      (cond) => !(cond.sourceId === combatantId && cond.concentration),
    );
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
