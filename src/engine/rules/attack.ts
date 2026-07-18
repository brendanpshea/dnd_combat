/**
 * Attack resolution and damage application. All functions mutate the draft
 * state they are given — step() owns cloning, these own the rules.
 */
import type { GameState, Combatant, Id, DamageType, Ability } from '../types.js';
import { abilityMod, proficiencyBonus, cellAt, isDown } from '../types.js';
import { WEAPONS, WeaponData } from '../../data/weapons.js';
import { FEATURES } from '../../data/features.js';
import { acOf } from '../../data/armor.js';
import { rollD20, rollDice, resolveRollMode } from '../dice.js';
import { distanceFeet, adjacent, hasLineOfSight } from '../grid.js';
import { attackableWeapons } from './equipment.js';
import { savingThrow } from './saves.js';
import { endHide, isHidden } from './hide.js';
import { pushCreature } from './movement.js';
import { downCombatant } from './heal.js';
import { applyLucky } from './luck.js';
import type { GameEvent } from '../events.js';

/** Which ability powers an attack with this weapon. */
export function attackAbility(attacker: Combatant, weapon: WeaponData): 'str' | 'dex' {
  const finesse = weapon.properties.includes('finesse');
  if (!weapon.melee) return 'dex';
  if (finesse) return attacker.abilities.dex >= attacker.abilities.str ? 'dex' : 'str';
  return 'str'; // thrown non-finesse weapons also use str
}

/**
 * Can `actor` attack `targetId` with this weapon, right now?
 *
 * Lives here rather than in actions.ts because it is a rule about attacking,
 * and because True Strike needs it: the spell *is* a weapon attack, so its
 * legal targets are exactly the weapon's — which no static `range` on the spell
 * could ever express.
 */
export function canAttackWith(state: GameState, actor: Combatant, weaponId: Id, targetId: Id): boolean {
  const w = WEAPONS[weaponId];
  const t = state.combatants[targetId];
  if (!w || !t || !t.alive || t.team === actor.team) return false;
  if (isDown(t)) return false;   // already out of the fight; nothing to gain
  if (isHidden(t)) return false;
  if (!attackableWeapons(actor).includes(weaponId)) return false;
  const dist = distanceFeet(actor.position, t.position);
  const inMelee = w.melee && adjacent(actor.position, t.position);
  const inRange =
    w.range !== undefined && dist <= w.range.long &&
    hasLineOfSight(state.grid, actor.position, t.position);
  return inMelee || inRange;
}

export interface AttackContext {
  opportunity?: boolean;
  /** Off-hand (light weapon) attack: no ability modifier on damage. */
  offhand?: boolean;
  /**
   * Swing with a different ability than the weapon would normally use — True
   * Strike guiding a staff with Intelligence. Applies to the attack roll and
   * the damage, exactly as the usual modifier does.
   */
  abilityOverride?: Ability;
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
      if (c.alive && !isDown(c) && c.team !== attacker.team && adjacent(c.position, attacker.position)) {
        dis.push('enemy adjacent');
        break;
      }
    }
  }

  if (target.conditions.some((c) => c.id === 'dodging')) dis.push('target dodging');
  if (attacker.conditions.some((c) => c.id === 'sapped')) dis.push('sapped');
  if (attacker.conditions.some((c) => c.id === 'poisoned')) dis.push('poisoned');
  if (attacker.conditions.some((c) => c.id === 'blinded')) dis.push('blinded');
  if (attacker.conditions.some((c) => c.id === 'inspired')) adv.push('heroic inspiration');
  if (isHidden(attacker)) adv.push('hidden');
  if (attacker.familiar?.kind === 'owl' && attacker.familiar.helpedRound !== state.round) {
    adv.push('owl familiar');
  }
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
  if (target.conditions.some((c) => c.id === 'outlined')) {
    adv.push('faerie fire');   // outlined: stays until the light does, not one-shot
  }
  // Assassinate: the target hasn't taken a turn yet this combat.
  if (attacker.featureIds.includes('assassinate') && !target.hasActed) {
    adv.push('assassinate');
  }
  if (target.conditions.some((c) => c.id === 'prone')) {
    (isMeleeAttack ? adv : dis).push(isMeleeAttack ? 'target prone' : 'target prone (ranged)');
  }
  if (attacker.conditions.some((c) => c.id === 'prone')) dis.push('attacker prone');
  // Web restrains: attacks against the caught creature have advantage, its own
  // have disadvantage. Fear rattles: the frightened creature attacks at
  // disadvantage.
  if (target.conditions.some((c) => c.id === 'restrained')) adv.push('target restrained');
  if (attacker.conditions.some((c) => c.id === 'restrained')) dis.push('attacker restrained');
  if (attacker.conditions.some((c) => c.id === 'frightened')) dis.push('attacker frightened');

  return { adv, dis };
}

/** An owl familiar can Help with the caster's first attack roll each round. */
export function consumeFamiliarHelp(state: GameState, attacker: Combatant): void {
  if (attacker.familiar?.kind === 'owl' && attacker.familiar.helpedRound !== state.round) {
    attacker.familiar.helpedRound = state.round;
  }
}

/** Remove one-shot roll markers after an attack roll is made. */
function consumeRollMarkers(attacker: Combatant, target: Combatant): void {
  attacker.conditions = attacker.conditions.filter(
    (c) => c.id !== 'sapped' && c.id !== 'inspired' && !(c.id === 'vexed' && c.sourceId === target.id),
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
  const d20 = applyLucky(state, attackerId, rollD20(state.rng, mode), mode);
  state.rng = d20.state;
  consumeFamiliarHelp(state, attacker);

  const ability = ctx.abilityOverride ?? attackAbility(attacker, weapon);
  const mod = abilityMod(attacker.abilities[ability]);
  const prof = proficiencyBonus(attacker.level); // v1: proficient with all carried weapons
  let total = d20.natural + mod + prof + (weapon.attackBonus ?? 0);
  // Fighting Style: Archery — +2 to attack rolls with ranged weapons.
  if (attacker.featureIds.includes('archery') && !weapon.melee) total += 2;
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
  let hit = d20.natural !== 1 && (d20.natural === 20 || total >= targetAc);

  // Shield reaction (autocast): a would-be hit that +5 AC turns into a miss, if
  // the defender can react. A natural 20 lands regardless.
  if (hit && d20.natural !== 20 && total < targetAc + 5 && tryAutoShield(state, targetId)) {
    hit = false;
    events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'shielded', sourceId: targetId });
  }

  consumeRollMarkers(attacker, target);

  events.push({
    type: 'attackRolled',
    attackerId, targetId, weaponId,
    natural: d20.natural, total, targetAc,
    mode, advSources: adv, disSources: dis,
    hit, crit: hit && crit,
    opportunity: ctx.opportunity ?? false,
  });
  events.push(...endHide(attacker));

  if (!hit) {
    // Graze mastery: a miss still deals the attacker's ability modifier in
    // damage (no dice), for a trained wielder.
    if (weapon.mastery === 'graze' && attacker.weaponMasteries.includes(weaponId) &&
        target.alive && mod > 0) {
      events.push(...applyDamage(state, attackerId, targetId, mod, weapon.damageType, []));
    }
    return events;
  }

  const dmg = rollDice(state.rng, weapon.damage, crit);
  state.rng = dmg.state;
  let rolls = dmg.rolls;
  // Which named bonuses actually fired — surfaced in the log and as toasts so
  // players can see (and debug) that Sneak Attack, Dueling, etc. are working.
  const tags: string[] = [];
  if (crit) tags.push('Critical Hit');

  // Fighting Style: Great Weapon Fighting — reroll each 1 or 2 on a two-handed
  // melee weapon's damage dice once, keeping the new roll.
  if (
    attacker.featureIds.includes('great-weapon-fighting') &&
    isMeleeAttack &&
    weapon.properties.includes('two-handed')
  ) {
    const faces = weapon.damage.match(/d(\d+)/)?.[1];
    if (faces) {
      rolls = rolls.map((r) => {
        if (r > 2) return r;
        const rr = rollDice(state.rng, `1d${faces}`);
        state.rng = rr.state;
        return rr.total;
      });
      tags.push('Great Weapon Fighting');
    }
  }

  // Off-hand attacks add no ability modifier to damage (RAW default) — unless
  // the Two-Weapon Fighting style restores it.
  const offhandMod = ctx.offhand && !attacker.featureIds.includes('two-weapon-fighting') ? 0 : mod;
  let amount = rolls.reduce((s, r) => s + r, 0) + offhandMod + (weapon.damageBonus ?? 0);
  if (ctx.offhand && offhandMod !== 0) tags.push('Two-Weapon Fighting');

  // Fighting Style: Dueling — one-handed melee weapon, no weapon in the
  // other hand (a shield is fine): +2.
  if (
    attacker.featureIds.includes('dueling') &&
    isMeleeAttack &&
    !weapon.properties.includes('two-handed') &&
    (attacker.equipped.offHand === undefined || attacker.equipped.offHand === 'shield')
  ) {
    amount += 2;
    tags.push('Dueling');
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
      // The dice live in the feature's data, so the AI can price what advantage
      // buys this kit off the same declaration the rule fires from.
      const sneakDice = FEATURES['sneak-attack']!.advantageDice!(attacker.level);
      const extra = rollDice(state.rng, sneakDice, crit);
      state.rng = extra.state;
      amount += extra.total;
      rolls = [...rolls, ...extra.rolls];
      attacker.turn.sneakAttackUsed = true;
      tags.push('Sneak Attack');
    }
  }

  // Goblin-style rider: extra dice when the roll had advantage.
  if (weapon.bonusDiceOnAdvantage && mode === 'advantage') {
    const extra = rollDice(state.rng, weapon.bonusDiceOnAdvantage, crit);
    state.rng = extra.state;
    amount += extra.total;
    rolls = [...rolls, ...extra.rolls];
  }

  // Uncanny Dodge: the first hit against the rogue each round has its damage
  // halved (a reaction in 5e; a once-per-round passive here). Scoped to weapon
  // attacks — it doesn't blunt Fireball and other save-based damage.
  if (target.featureIds.includes('uncanny-dodge') && target.uncannyDodgeRound !== state.round) {
    amount = Math.floor(amount / 2);
    target.uncannyDodgeRound = state.round;
    tags.push('Uncanny Dodge');
  }

  amount = Math.max(1, amount);

  events.push(...applyDamage(state, targetId, attackerId, amount, weapon.damageType, rolls, { crit, tags, bypassResistance: !!weapon.magic }));

  // Secondary damage of a different type (giant spider poison).
  if (weapon.extraDamage && target.alive) {
    const extra = rollDice(state.rng, weapon.extraDamage.dice, crit);
    state.rng = extra.state;
    events.push(...applyDamage(state, targetId, attackerId, extra.total, weapon.extraDamage.type, extra.rolls, { crit }));
  }

  if (weapon.onHitCondition && target.alive &&
      !target.conditions.some((c) => c.id === weapon.onHitCondition)) {
    target.conditions.push({ id: weapon.onHitCondition, sourceId: attackerId });
    events.push({ type: 'conditionApplied', combatantId: targetId, condition: weapon.onHitCondition, sourceId: attackerId });
  }

  // Save-or-suffer rider (ghoul paralysis, spider poison): save-ends, so it
  // repeats at the end of the victim's turns via runEndOfTurnSaves.
  if (weapon.onHitSave && target.alive &&
      !target.conditions.some((c) => c.id === weapon.onHitSave!.condition)) {
    const { condition, ability, dc } = weapon.onHitSave;
    const save = savingThrow(state, targetId, ability, dc);
    events.push(save.event);
    if (!save.success) {
      target.conditions.push({ id: condition, sourceId: attackerId, repeatSave: { ability, dc } });
      events.push({ type: 'conditionApplied', combatantId: targetId, condition, sourceId: attackerId });
    }
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
    } else if (weapon.mastery === 'slow' && !target.conditions.some((c) => c.id === 'slowed')) {
      target.conditions.push({ id: 'slowed', sourceId: attackerId });
      events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'slowed', sourceId: attackerId });
    } else if (weapon.mastery === 'push') {
      // Shove the target 10 ft (2 cells) straight away from the attacker.
      const dir = {
        x: Math.sign(target.position.x - attacker.position.x),
        y: Math.sign(target.position.y - attacker.position.y),
      };
      if (dir.x !== 0 || dir.y !== 0) events.push(...pushCreature(state, targetId, dir, 2));
    } else if (weapon.mastery === 'topple' && !target.conditions.some((c) => c.id === 'prone')) {
      // Con save vs the attacker's weapon DC or fall prone.
      const dc = 8 + proficiencyBonus(attacker.level) + mod;
      const save = savingThrow(state, targetId, 'con', dc);
      events.push(save.event);
      if (!save.success) {
        target.conditions.push({ id: 'prone', sourceId: attackerId });
        events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'prone', sourceId: attackerId });
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
  opts: { crit?: boolean; tags?: string[]; bypassResistance?: boolean } = {},
): GameEvent[] {
  const events: GameEvent[] = [];
  const target = state.combatants[targetId]!;
  // Ask *before* the damage lands: were they already out? Nothing about the
  // state afterwards can answer it, because a slept hero is also `unconscious`
  // at whatever HP it has left.
  const wasDown = isDown(target);

  // Moon-touched (silvered) weapons: no attack/damage bonus, but their hits
  // bypass resistance — immunity and vulnerability are untouched.
  if (target.immunities.includes(damageType)) amount = 0;
  else if (target.resistances.includes(damageType) && !opts.bypassResistance) amount = Math.floor(amount / 2);
  else if (target.vulnerabilities.includes(damageType)) amount *= 2;

  const absorbed = Math.min(target.tempHp ?? 0, amount);
  if (absorbed > 0) target.tempHp = (target.tempHp ?? 0) - absorbed;
  target.hp = Math.max(0, target.hp - (amount - absorbed));
  events.push({
    type: 'damageDealt', targetId, sourceId, amount, damageType, rolls,
    ...(opts.tags && opts.tags.length > 0 ? { tags: opts.tags } : {}),
  });

  // Undead Fortitude: unless radiant or a crit, Con save DC 5 + damage to
  // drop to 1 HP instead of 0.
  if (
    target.hp === 0 && target.featureIds.includes('relentless-endurance') &&
    target.featureUses['relentless-endurance']?.current
  ) {
    target.hp = 1;
    target.featureUses['relentless-endurance']!.current -= 1;
  } else if (
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
    // Heroes drop; monsters die. A downed hero can't be finished off — further
    // damage finds it already at 0 and changes nothing — so the fight's stake
    // is losing its sword until someone reaches it, not losing it for good.
    if (target.unconsciousAtZero && target.alive) {
      if (!wasDown) events.push(...dropToZero(state, targetId));
    } else {
      events.push(...kill(state, targetId));
    }
  }
  return events;
}

/**
 * Shield, cast as a reaction (autocast for now). If the defender knows Shield,
 * has a slot and its reaction, and isn't already shielded, it spends both and
 * gains +5 AC (and Magic Missile immunity) until the start of its next turn.
 */
export function tryAutoShield(state: GameState, targetId: Id): boolean {
  const t = state.combatants[targetId];
  if (!t || !t.alive || !t.spellIds.includes('shield')) return false;
  if (t.turn.reactionUsed || t.conditions.some((c) => c.id === 'shielded')) return false;
  const slot = t.spellSlots.find((s) => s.current > 0);
  if (!slot) return false;
  slot.current -= 1;
  t.turn.reactionUsed = true;
  t.conditions.push({ id: 'shielded', sourceId: targetId });
  return true;
}

export function breakConcentration(state: GameState, combatantId: Id): GameEvent[] {
  const c = state.combatants[combatantId]!;
  if (!c.concentratingOn) return [];
  const { spellId, targetIds } = c.concentratingOn;
  delete c.concentratingOn;
  if (spellId === 'spiritual-guardians') delete c.spiritualGuardians; // dispel the aura
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

/**
 * Drop a hero to 0: unconscious, out of the fight, and possibly the last one
 * standing — so the winner check runs here exactly as it does for a death.
 *
 * Caller decides whether this is the *first* time (see `wasDown`). An earlier
 * version asked the state instead — "already unconscious at 0?" — which a slept
 * hero also satisfies the instant it's damaged to 0. It returned early, skipped
 * the winner check, and a party could be wiped out with the battle grinding on
 * forever.
 */
function dropToZero(state: GameState, combatantId: Id): GameEvent[] {
  const events = [...downCombatant(state, combatantId), ...breakConcentration(state, combatantId)];
  const winner = checkWinner(state);
  if (winner) {
    state.winner = winner;
    events.push({ type: 'combatEnded', winner });
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

/**
 * Remove a creature from the fight without killing it — Animal Friendship
 * charming a beast away. Shares kill()'s bookkeeping (clear the cell, break
 * concentration, check the winner) so it participates correctly in every rule
 * keyed off `alive` — pathing, targeting, the win check — but it is never a
 * death: no `unconsciousAtZero` down-path, no "dies" in the log.
 */
export function charmAway(state: GameState, combatantId: Id): GameEvent[] {
  const c = state.combatants[combatantId]!;
  c.alive = false;
  c.hp = 0;
  c.conditions = [];
  const cell = cellAt(state.grid, c.position);
  if (cell && cell.occupantId === combatantId) delete cell.occupantId;
  const events: GameEvent[] = [
    { type: 'charmedAway', combatantId },
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
  // Standing, not merely alive: a downed hero is alive at 0 HP and out of the
  // fight, so a party that is all down has lost. Deliberately *not* "conscious"
  // — a slept party is above 0 and still counts, or Sleep would win the game
  // outright.
  const standing = Object.values(state.combatants).filter((c) => c.alive && c.hp > 0);
  const t1 = standing.some((c) => c.team === 'team1');
  const t2 = standing.some((c) => c.team === 'team2');
  if (t1 && !t2) return 'team1';
  if (t2 && !t1) return 'team2';
  return null;
}
