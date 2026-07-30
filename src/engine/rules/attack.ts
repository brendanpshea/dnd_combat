/**
 * Attack resolution and damage application. All functions mutate the draft
 * state they are given — step() owns cloning, these own the rules.
 */
import type { GameState, Combatant, Id, DamageType, Ability, CreatureType } from '../types.js';
import { abilityMod, proficiencyBonus, cellAt, isDown, isIncapacitated, ignoresHalfCover } from '../types.js';
import { WEAPONS, WeaponData, isWeaponProficient } from '../../data/weapons.js';
import { FEATURES, revertShape } from '../../data/features.js';
import { acOf, ARMOR, isShield, shieldRangedBonus } from '../../data/armor.js';
import { rollD20, rollDice, resolveRollMode, parseDice } from '../dice.js';
import { distanceFeet, distanceCells, adjacent, hasLineOfSight, clearWebBySource, clearFireBySource, clearSilenceBySource, coverBetween } from '../grid.js';
import { withinReach, reachesCell } from './reach.js';
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
  // Charm's actual rule: you cannot attack whoever charmed you. Everyone else
  // is still fair game — which is what makes it a redirection rather than a
  // removal, and why it does not need to end the fight to be worth casting.
  if (actor.conditions.some((k) => (k.id === 'charmed' || k.id === 'lured') && k.sourceId === targetId)) {
    return false;
  }
  if (!attackableWeapons(actor).includes(weaponId)) return false;
  const dist = distanceFeet(actor.position, t.position);
  const inMelee = w.melee && withinReach(actor, t);
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
  /** Internal guard: a Rampage bonus attack must not itself trigger Rampage. */
  noRampage?: boolean;
}

/**
 * Collect advantage/disadvantage sources for an attack. Phase 3 features add
 * sources here; the cancellation rule in resolveRollMode does the rest.
 */
/** The creature types Protection from Evil and Good actually wards against. */
export const PROTECTED_FROM: CreatureType[] =
  ['aberration', 'celestial', 'elemental', 'fey', 'fiend', 'undead'];

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
    // A hostile close enough to swing at the shooter. Its REACH, not plain
    // adjacency: a giant looming from ten feet is exactly as distracting as an
    // ogre at five, and that is the whole point of it having reach.
    for (const c of Object.values(state.combatants)) {
      if (c.alive && !isDown(c) && c.team !== attacker.team && reachesCell(c, attacker.position)) {
        dis.push('enemy adjacent');
        break;
      }
    }
  }

  if (target.conditions.some((c) => c.id === 'dodging')) dis.push('target dodging');
  // Cloak of Displacement: the wearer never seems to be quite where it is —
  // until something connects, which switches the illusion off until its next
  // turn. Suppressed at Speed 0 per the SRD: an illusion of being a step to the
  // left is no use to something that cannot take the step.
  if (target.featureIds.includes('cloak-displacement') && !target.displacementBroken &&
      target.speed > 0) {
    dis.push('displacement');
  }
  // Bestow Curse: the cursed creature swings badly at everything.
  if (attacker.conditions.some((c) => c.id === 'cursed')) dis.push('cursed');
  // Berserker Axe: everything except the axe itself swings badly. This is what
  // the axe costs — the bow on your back, and any bane weapon you were carrying
  // for the wave ahead.
  if (attacker.featureIds.includes('berserker-curse') && weapon.id !== 'berserker-axe') {
    dis.push("berserker's grip");
  }
  // Protection from Evil and Good: only the six listed kinds are put off by it.
  if (target.conditions.some((c) => c.id === 'protected') &&
      attacker.creatureType !== undefined && PROTECTED_FROM.includes(attacker.creatureType)) {
    dis.push('protection from evil and good');
  }
  if (attacker.conditions.some((c) => c.id === 'sapped')) dis.push('sapped');
  if (attacker.conditions.some((c) => c.id === 'poisoned')) dis.push('poisoned');
  if (attacker.conditions.some((c) => c.id === 'blinded')) dis.push('blinded');
  if (attacker.conditions.some((c) => c.id === 'inspired')) adv.push('heroic inspiration');
  if (attacker.conditions.some((c) => c.id === 'aiming')) adv.push('steady aim');
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
      (c) => c.alive && !isDown(c) && c.id !== attacker.id && c.team === attacker.team &&
             adjacent(c.position, target.position) && !isIncapacitated(c),
    );
    if (packed) adv.push('pack tactics');
  }
  if (target.conditions.some((c) => c.id === 'unconscious')) {
    adv.push('target unconscious');
  }
  if (target.conditions.some((c) => c.id === 'paralyzed')) {
    adv.push('target paralyzed');
  }
  if (target.conditions.some((c) => c.id === 'stunned')) {
    adv.push('target stunned');
  }
  if (target.conditions.some((c) => c.id === 'guided')) {
    adv.push('guiding bolt');
  }
  if (target.conditions.some((c) => c.id === 'outlined')) {
    adv.push('faerie fire');   // outlined: stays until the light does, not one-shot
  }
  // Reckless Attack, both halves. The barbarian swings with advantage, and
  // everything swings back with advantage — one condition, read from both
  // ends, so the two can never come apart.
  if (attacker.conditions.some((c) => c.id === 'reckless') && isMeleeAttack) {
    adv.push('reckless');
  }
  if (target.conditions.some((c) => c.id === 'reckless')) {
    adv.push('target reckless');
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

/**
 * Rage's bonus damage by level. The SRD table is +2 through 8th, so this is a
 * function of one value today — written as a function anyway because the level
 * is the thing that will change, and a caller reading `rageDamage(level)` will
 * not have to be corrected when it does.
 */
export function rageDamage(level: number): number {
  return level >= 9 ? 3 : 2;
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
    (c) => c.id !== 'sapped' && c.id !== 'inspired' && c.id !== 'aiming' &&
      !(c.id === 'vexed' && c.sourceId === target.id),
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
  // Reach: Long-Limbed, or simply being Huge. See rules/reach.ts — one answer,
  // so hitting at reach and threatening at reach can never disagree again.
  const isMeleeAttack = withinReach(attacker, target) && weapon.melee;

  // Sanctuary: before anything else, the attacker must steel itself. A failed
  // Wisdom save means it cannot bring itself to strike this target at all and
  // the attack is simply gone -- no roll, no damage, no rider. This is the one
  // effect in the game that takes an action away by changing what the *enemy*
  // is allowed to do, which is why it is checked ahead of the roll rather than
  // folded into advantage.
  const ward = target.conditions.find((c) => c.id === 'sanctuary');
  if (ward && ward.sourceId !== attackerId) {
    const save = savingThrow(state, attackerId, 'wis', ward.dc ?? 13, { magical: true });
    if (!save.success) {
      return [save.event, { type: 'attackWarded', attackerId, targetId }];
    }
    events.push(save.event);
  }
  // Attacking is what breaks your own Sanctuary. The SRD ends it on a harmful
  // spell too; this engine has no other way to be aggressive, so an attack is
  // the whole of it.
  attacker.conditions = attacker.conditions.filter((c) => c.id !== 'sanctuary');

  const { adv, dis } = collectAttackSources(state, attacker, target, weapon, isMeleeAttack);
  // Escape the Horde (Hunter, Ranger 7). Read here rather than inside
  // collectAttackSources, which is not told whether this is an opportunity
  // attack — that fact only exists at this level.
  if (ctx.opportunity && target.featureIds.includes('escape-the-horde')) {
    dis.push('escape the horde');
  }
  const mode = resolveRollMode(adv, dis);
  const d20 = applyLucky(state, attackerId, rollD20(state.rng, mode), mode);
  state.rng = d20.state;
  consumeFamiliarHelp(state, attacker);

  // Shillelagh: a club or quarterstaff in a druid's hands swings on the
  // spellcasting ability and hits with a bigger die. Read off the wielder, not
  // the weapon — WEAPONS entries are shared data, so imbuing the weapon itself
  // would arm every enemy holding a quarterstaff.
  const shillelagh = isShillelaghed(attacker, weapon);
  const ability = ctx.abilityOverride ??
    (shillelagh ? attacker.spellcastingAbility ?? 'wis' : attackAbility(attacker, weapon));
  const mod = abilityMod(attacker.abilities[ability]);
  // Proficiency bonus only if trained with the weapon (2024: a wizard can swing
  // a greatsword, they just don't add proficiency). Natural/monster weapons and
  // un-migrated combatants are always proficient.
  const prof = isWeaponProficient(attacker.weaponProfs, weapon.id) ? proficiencyBonus(attacker.level) : 0;
  let total = d20.natural + mod + prof + (weapon.attackBonus ?? 0);
  // Fighting Style: Archery — +2 to attack rolls with ranged weapons.
  if (attacker.featureIds.includes('archery') && !weapon.melee) total += 2;
  // Sacred Weapon (Devotion Channel Divinity): +Cha to the paladin's own
  // attack rolls for the rest of the encounter, once activated.
  if (attacker.conditions.some((c) => c.id === 'sacredWeapon')) {
    total += abilityMod(attacker.abilities.cha);
  }
  if (attacker.conditions.some((c) => c.id === 'blessed')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total += d4.total;
  }
  if (attacker.conditions.some((c) => c.id === 'baned')) {
    const d4 = rollDice(state.rng, '1d4');
    state.rng = d4.state;
    total -= d4.total;
  }
  // Bardic Inspiration: one d6, on the first attack roll or save that wants it,
  // and then it is gone. Unlike Bless it is not an aura the bard sustains — it
  // is a single gift, which is why it is consumed here rather than merely read.
  if (attacker.conditions.some((c) => c.id === 'inspiring')) {
    const d6 = rollDice(state.rng, '1d6');
    state.rng = d6.state;
    total += d6.total;
    attacker.conditions = attacker.conditions.filter((c) => c.id !== 'inspiring');
    events.push({ type: 'conditionRemoved', combatantId: attackerId, condition: 'inspiring' });
  }

  // Champion widens the crit range to 19-20.
  const critFloor = attacker.featureIds.includes('improved-critical') ? 19 : 20;
  const natCrit = d20.natural >= critFloor;
  // Adamantine armor: any crit against the wearer is downgraded to a normal hit.
  const targetNoCrit = target.equipped.armor !== undefined && (ARMOR[target.equipped.armor]?.noCrit ?? false);
  // Auto-crit on hitting a helpless (unconscious/paralyzed) target from melee.
  let crit = !targetNoCrit && (natCrit || (isHelpless(target) && isMeleeAttack));
  // Half cover: +2 AC when a barricade sits on the line of the shot. The
  // barricade does not block sight, so this is the whole of its effect on an
  // attack — and it is why *where* you shoot from is now a question. Melee
  // reaches over it, so only a ranged attack is affected.
  // Size gates it: a barricade is chest-high to a person, so a kobold ducks
  // behind it and an ogre just stands there. Same terrain, different board,
  // depending on what is standing on it — which is most of the point of having
  // terrain at all.
  const behindCover = !isMeleeAttack &&
    !ignoresHalfCover(target.size ?? 'medium') &&
    coverBetween(state.grid, attacker.position, target.position);
  const targetAc = acOf(target) + (behindCover ? 2 : 0) +
    (isMeleeAttack ? 0 : shieldRangedBonus(target.equipped.offHand));
  // Only a natural 20 hits regardless of AC; a Champion's 19 still needs to hit.
  let hit = d20.natural !== 1 && (d20.natural === 20 || total >= targetAc);

  // Mirror Image: the blow finds a duplicate instead of the caster.
  //
  // Rolled before Shield, because an image costs nothing where Shield costs a
  // slot and a reaction — spending the cheap defence first is what a player
  // would do, and doing it in the other order would quietly waste slots.
  // A natural 20 finds the real one; so does an attacker that cannot see.
  if (hit && d20.natural !== 20 && (target.mirrorImages ?? 0) > 0) {
    const images = target.mirrorImages!;
    // 3 images: 6+ on a d20 hits an image. 2: 8+. 1: 11+. (SRD's own ladder.)
    const need = images >= 3 ? 6 : images === 2 ? 8 : 11;
    const roll = rollDice(state.rng, '1d20');
    state.rng = roll.state;
    if (roll.total >= need) {
      target.mirrorImages = images - 1;
      if (target.mirrorImages === 0) delete target.mirrorImages;
      hit = false;
      events.push({ type: 'mirrorImageStruck', combatantId: targetId, left: target.mirrorImages ?? 0 });
    }
  }

  // Shield reaction (autocast): a would-be hit that +5 AC turns into a miss, if
  // the defender can react. A natural 20 lands regardless.
  if (hit && d20.natural !== 20 && total < targetAc + 5 && tryAutoShield(state, targetId)) {
    hit = false;
    events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'shielded', sourceId: targetId });
  }

  // Cutting Words: a bard on the target's side spends a Bardic Inspiration die
  // to talk the attacker out of a hit that was about to land. Auto-fired here
  // rather than offered as an action, exactly like the Shield spell above:
  // it is a reaction to someone else's roll, and there is no turn of the bard's
  // on which it could be declared.
  //
  // Only tried on a hit that a d6 could plausibly undo, so the die is never
  // burned turning a hit into a slightly smaller hit.
  if (hit && d20.natural !== 20 && total - targetAc < 6) {
    const cut = tryCuttingWords(state, target, total - targetAc);
    if (cut) {
      total -= cut.amount;
      events.push(cut.event);
      if (total < targetAc) { hit = false; crit = false; }
    }
  }

  consumeRollMarkers(attacker, target);

  events.push({
    type: 'attackRolled',
    attackerId, targetId, weaponId,
    natural: d20.natural, total, targetAc,
    mode, advSources: adv, disSources: dis,
    // Its own field rather than folded into `advSources`: a reroll is not
    // advantage, and — the reason this matters — the log only prints the
    // adv/dis bracket when the mode is not 'flat'. A Fated reroll on an
    // ordinary roll would have rendered nothing at all.
    ...(d20.luck ? { luck: d20.luck } : {}),
    hit, crit: hit && crit,
    opportunity: ctx.opportunity ?? false,
    ...(behindCover ? { cover: true } : {}),
  });
  events.push(...endHide(attacker));

  if (!hit) {
    // Graze mastery: a miss still deals the attacker's ability modifier in
    // damage (no dice), for a trained wielder. Cleave is modeled with the same
    // mechanic (the heavy blade carries through even on a glancing swing).
    // `applyDamage` takes (target, source) in that order. This read
    // (attacker, target), so for as long as the mastery has existed a miss has
    // damaged the WIELDER for their own ability modifier. Nothing caught it
    // because no player class carried a graze or cleave weapon until the
    // barbarian's greataxe — and the first thing rage did was halve the
    // self-damage, which is what made it visible.
    if ((weapon.mastery === 'graze' || weapon.mastery === 'cleave') &&
        attacker.weaponMasteries.includes(weaponId) &&
        target.alive && mod > 0) {
      events.push(...applyDamage(state, targetId, attackerId, mod, weapon.damageType, []));
    }
    return events;
  }

  const dmg = rollDice(state.rng,
    shillelagh ? shillelaghDamage(attacker.level)
      : martialArtsDie(attacker, weapon) ?? weapon.damage, crit);
  state.rng = dmg.state;
  let rolls = dmg.rolls;
  // Which named bonuses actually fired — surfaced in the log and as toasts so
  // players can see (and debug) that Sneak Attack, Dueling, etc. are working.
  const tags: string[] = [];
  if (crit) tags.push('Critical Hit');
  // Remarkable Athlete (Champion 3): a critical hit buys half your Speed of
  // movement that nobody gets to swing at. Granted as movement plus the same
  // disengage flag a Disengage action sets, because "does not provoke" is
  // exactly what that flag already means to executeMove.
  if (crit && attacker.featureIds.includes('remarkable-athlete') && attacker.alive) {
    attacker.turn.movementMax += Math.floor(attacker.speed / 2);
    attacker.turn.disengaged = true;
  }

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

  /**
   * Savage Attacker (origin feat): once per turn, reroll the weapon's damage
   * dice and use either total.
   *
   * "Either total", not "either die" — so it is one decision about the whole
   * roll, which is the SRD wording and also what makes it worth a feat: it
   * rescues the swing that rolled two 1s rather than shaving a point off an
   * average one. Rerolled only when the first roll is below its own average, so
   * the AI does not burn the turn's one use on a roll that was already good.
   *
   * Deliberately before the flat adders below (Dueling, Rage, Bracers): those
   * are not dice and rerolling them would be rerolling nothing.
   */
  if (
    attacker.featureIds.includes('savage-attacker') &&
    !attacker.turn.savageUsed &&
    rolls.length > 0
  ) {
    const faces = Number(weapon.damage.match(/d(\d+)/)?.[1] ?? 0);
    const first = rolls.reduce((s, r) => s + r, 0);
    const average = rolls.length * (faces + 1) / 2;
    if (faces > 0 && first < average) {
      attacker.turn.savageUsed = true;
      const again = rollDice(state.rng, `${rolls.length}d${faces}`);
      state.rng = again.state;
      if (again.total > first) {
        rolls = again.rolls ?? rolls;
        tags.push('Savage Attacker');
      }
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
    (attacker.equipped.offHand === undefined || isShield(attacker.equipped.offHand))
  ) {
    amount += 2;
    tags.push('Dueling');
  }
  // Bracers of Archery (trinket): +2 damage with ranged weapons.
  if (attacker.featureIds.includes('bracers-archery') && !weapon.melee) {
    amount += 2;
    tags.push('Bracers of Archery');
  }

  // Rage: bonus damage on Strength-based melee attacks. Flat rather than dice,
  // which is the SRD shape and also the right feel — rage is a floor under
  // every swing, not another thing to roll. A finesse weapon swung on Dex is
  // deliberately excluded: the barbarian's whole bargain is Strength.
  if (attacker.conditions.some((k) => k.id === 'raging') && isMeleeAttack &&
      attackAbility(attacker, weapon) === 'str') {
    amount += rageDamage(attacker.level);
    tags.push('Rage');
  }

  // Brute (Bugbear): a melee hit deals one extra weapon damage die.
  if (attacker.featureIds.includes('brute') && isMeleeAttack) {
    const faces = weapon.damage.match(/d(\d+)/)?.[1];
    if (faces) {
      const extra = rollDice(state.rng, `1d${faces}`, crit);
      state.rng = extra.state;
      amount += extra.total;
      rolls = [...rolls, ...extra.rolls];
      tags.push('Brute');
    }
  }

  // Charge (Boar/Unicorn/Gorgon): moving at least 15 ft before a melee hit
  // adds an extra weapon damage die. The unicorn's horn and the gorgon's
  // trampling gore use the same lunge.
  const charged =
    isMeleeAttack &&
    attacker.turn.movementUsed >= 15 &&
    (attacker.featureIds.includes('charge') ||
      attacker.featureIds.includes('unicorn-charge') ||
      attacker.featureIds.includes('trampling-charge'));
  if (charged) {
    const faces = weapon.damage.match(/d(\d+)/)?.[1];
    if (faces) {
      const extra = rollDice(state.rng, `1d${faces}`, crit);
      state.rng = extra.state;
      amount += extra.total;
      rolls = [...rolls, ...extra.rolls];
      tags.push('Charge');
    }
  }

  // Sneak Attack: once per turn, finesse/ranged weapon, and either advantage
  // or an ally adjacent to the target — never while at disadvantage.
  if (
    attacker.featureIds.includes('sneak-attack') &&
    !attacker.turn.sneakAttackUsed &&
    (weapon.properties.includes('finesse') || !weapon.melee)
  ) {
    const allyAdjacent = Object.values(state.combatants).some(
      (c) => c.alive && !isDown(c) && c.id !== attackerId && c.team === attacker.team &&
             adjacent(c.position, target.position) &&
             // 2024: the enabling ally must not be Incapacitated.
             !isIncapacitated(c),
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

  // Hunter's Mark: +1d6 force per hit against the marked target, only for
  // whoever cast the mark — every hit, not once per turn, which is what makes
  // the bonus action and concentration worth spending.
  if (target.conditions.some((c) => c.id === 'marked' && c.sourceId === attackerId)) {
    const mark = rollDice(state.rng, '1d6', crit);
    state.rng = mark.state;
    amount += mark.total;
    rolls = [...rolls, ...mark.rolls];
    tags.push("Hunter's Mark");
  }

  // Hex, on a weapon swing. Spell attacks do not come through here, so the
  // roll itself lives in `hexBonus` and Eldritch Blast calls it too — see the
  // note there.
  const hexed = hexBonus(state, attackerId, targetId, crit);
  if (hexed) {
    amount += hexed.total;
    rolls = [...rolls, ...hexed.rolls];
    tags.push('Hex');
  }

  // Colossus Slayer (Hunter's Prey): once per turn, +1d8 on a hit against a
  // target below its HP max.
  if (
    attacker.featureIds.includes('colossus-slayer') &&
    !attacker.turn.colossusUsed &&
    target.hp < target.maxHp
  ) {
    const extra = rollDice(state.rng, '1d8', crit);
    state.rng = extra.state;
    amount += extra.total;
    rolls = [...rolls, ...extra.rolls];
    attacker.turn.colossusUsed = true;
    tags.push('Colossus Slayer');
  }

  // Silver, against something that changes shape. This is the whole of what
  // silvering does beyond counting as magical — and it is a bonus, not a gate:
  // nothing in the game is immune to ordinary steel for want of it.
  if (weapon.bonusDiceVsShapechanger && target.shapechanger) {
    const extra = rollDice(state.rng, weapon.bonusDiceVsShapechanger, crit);
    state.rng = extra.state;
    amount += extra.total;
    rolls = [...rolls, ...extra.rolls];
    tags.push('Silvered');
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

  // Empowered Strikes (Monk 6): the fists themselves count as magical, which
  // is what stops a monk falling off a cliff the moment the bestiary starts
  // shrugging off nonmagical weapons.
  const empowered = weapon.id === 'unarmed-strike' && attacker.featureIds.includes('empowered-strikes');
  events.push(...applyDamage(state, targetId, attackerId, amount, weapon.damageType, rolls,
    { crit, tags, magical: isMagicWeapon(weapon) || empowered, melee: isMeleeAttack }));

  // Secondary damage of a different type (giant spider poison). A rider with a
  // `save` is halved on a success — the SRD shape for the big poison stings,
  // and the difference between a fight and an execution when the rider alone
  // outdamages a low-level hero's whole hit point total.
  if (weapon.extraDamage && target.alive) {
    const extra = rollDice(state.rng, weapon.extraDamage.dice, crit);
    state.rng = extra.state;
    let amount = extra.total;
    const rider = weapon.extraDamage.save;
    if (rider) {
      const save = savingThrow(state, targetId, rider.ability, rider.dc);
      events.push(save.event);
      if (save.success) amount = Math.floor(amount / 2);
    }
    events.push(...applyDamage(state, targetId, attackerId, amount, weapon.extraDamage.type, extra.rolls, { crit }));
  }

  // Sword of Life Stealing: a natural 20 tears something loose. Flat 15 per the
  // SRD rather than dice, nothing to take from a construct or the undead, and
  // what it takes the wielder keeps as temporary hit points.
  if (weapon.lifeSteal && crit && target.alive &&
      !weapon.lifeSteal.exempt.includes(target.creatureType ?? 'humanoid')) {
    const before = target.hp;
    events.push(...applyDamage(
      state, targetId, attackerId, weapon.lifeSteal.amount, 'necrotic', [],
      { tags: [weapon.name], magical: true },
    ));
    const stolen = Math.max(0, before - target.hp);
    if (stolen > 0) {
      // Temporary hit points do not stack; the larger pool wins, as everywhere.
      attacker.tempHp = Math.max(attacker.tempHp ?? 0, stolen);
    }
  }

  // A bane weapon (Dragon Slayer, Sun Blade): extra dice, but only against the
  // creature types it was made for. Tagged with the weapon's own name so the
  // log says *why* the number was suddenly large — the whole value of carrying
  // one is knowing it paid off, and an untagged 3d6 just reads as a good roll.
  if (weapon.slays && target.alive && weapon.slays.types.includes(target.creatureType ?? 'humanoid')) {
    const bane = rollDice(state.rng, weapon.slays.dice, crit);
    state.rng = bane.state;
    events.push(...applyDamage(
      state, targetId, attackerId, bane.total,
      weapon.slays.damageType ?? weapon.damageType, bane.rolls,
      { crit, tags: [weapon.name], magical: isMagicWeapon(weapon) },
    ));
  }

  // Corrosion (rust monster): a hit pits metal armour or a shield, one point of
  // AC at a time up to the weapon's cap, for the rest of the fight. Nothing to
  // eat means nothing happens — an unarmoured target is simply immune, which is
  // the whole point of the monster.
  if (weapon.corrodes && target.alive && !isDown(target)) {
    const armor = target.equipped.armor !== undefined ? ARMOR[target.equipped.armor] : undefined;
    const hasMetal = (armor?.metal ?? false) || isShield(target.equipped.offHand);
    if (hasMetal && (target.corroded ?? 0) < weapon.corrodes.max) {
      target.corroded = (target.corroded ?? 0) + 1;
      events.push({ type: 'armorCorroded', combatantId: targetId, ac: acOf(target) });
    }
  }

  // Life Drain (wraith): a failed Constitution save cuts the victim's hit point
  // maximum by the damage it just took. Measured off what actually landed, so
  // resistance and immunity blunt the drain exactly as they blunt the damage.
  //
  // A ceiling of 0 is death in the SRD; here it routes through the same down/
  // kill split as everything else, so a hero is out of the fight rather than
  // gone. The kill path checks the winner, the down path does not — hence the
  // explicit check.
  // Skip a target the blow just dropped: they are out of the fight already, and
  // grinding a downed hero's ceiling away is a punishment for being unlucky
  // rather than a decision anyone gets to make.
  if (weapon.drainsMaxHp && target.alive && !isDown(target)) {
    const dealt = events.reduce(
      (s, e) => s + (e.type === 'damageDealt' && e.targetId === targetId ? e.amount : 0), 0,
    );
    if (dealt > 0) {
      const { ability, dc } = weapon.drainsMaxHp;
      const save = savingThrow(state, targetId, ability, dc);
      events.push(save.event);
      if (!save.success) {
        const before = target.maxHp;
        // Floored at 1 rather than 0. The SRD kills a creature whose maximum
        // reaches 0, but that branch cannot be reached here: the blow that
        // would drop the ceiling that far always deals at least as much damage
        // first, so the victim is already down (or dead) before the drain is
        // even rolled for. A floor keeps the invariant honest instead of
        // carrying an unreachable death path.
        target.maxHp = Math.max(1, target.maxHp - dealt);
        target.hp = Math.min(target.hp, target.maxHp);
        const lost = before - target.maxHp;
        if (lost > 0) {
          events.push({ type: 'maxHpDrained', combatantId: targetId, amount: lost, maxHp: target.maxHp });
        }
      }
    }
  }

  // Smites, in priority order: an armed one always discharges (the slot is
  // already spent, so holding it back would just lose it), otherwise the
  // Divine Smite *feature* may fire on its own.
  // Divine Smite and the paladin smites are melee-only; Ensnaring Strike is
  // "the next time you hit with a weapon attack", which for a ranger usually
  // means the bow. The spec says which, so the rule doesn't have to know the
  // spell by name.
  const armedSpec = attacker.armedSmite ? SMITE_SPECS[attacker.armedSmite.spellId] : undefined;
  const smiteReaches = isMeleeAttack || (armedSpec?.anyWeapon ?? false);
  if (target.alive && smiteReaches) {
    if (attacker.armedSmite) {
      events.push(...dischargeSmite(state, attackerId, targetId, crit));
    } else if (
      target.hp > 0 &&
      attacker.featureIds.includes('divine-smite') &&
      !attacker.turn.bonusActionUsed
    ) {
      // Auto-fire on the two moments a paladin would never *not* smite:
      //
      //  - a crit, because the dice double and this is the swing the whole
      //    class fantasy is about. The old code fired on expected kills only,
      //    which meant it pointedly never triggered on a natural 20 against a
      //    healthy boss — the exact moment players are waiting for.
      //  - a finisher, when the radiant is expected to drop the target
      //    (average ≥ remaining HP), so a slot is never burned on a healthy foe.
      //
      // `target.hp` here is already post-weapon-damage, so the finisher test is
      // exactly "would this kill them". Takes the smallest slot that qualifies;
      // on a crit that is simply the smallest slot available.
      const critMult = crit ? 2 : 1;
      const slotIdx = attacker.spellSlots.findIndex(
        (s, i) => s.current > 0 && (crit || (2 + i) * 4.5 * critMult >= target.hp),
      );
      if (slotIdx >= 0) {
        attacker.spellSlots[slotIdx]!.current -= 1;
        attacker.turn.bonusActionUsed = true;
        attacker.armedSmite = { spellId: 'divine-smite', slotLevel: slotIdx + 1 };
        events.push(...dischargeSmite(state, attackerId, targetId, crit));
      }
    }
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
    } else if (weapon.mastery === 'vex' || weapon.mastery === 'nick') {
      // Nick is modeled with Vex's mechanic (a quick nick opens the follow-up).
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

  // Trampling Charge (Gorgon): a charging gore knocks the target prone on a
  // failed Strength save.
  if (charged && attacker.featureIds.includes('trampling-charge') && target.alive &&
      !target.conditions.some((c) => c.id === 'prone')) {
    const dc = 8 + proficiencyBonus(attacker.level) + abilityMod(attacker.abilities.str);
    const save = savingThrow(state, targetId, 'str', dc);
    events.push(save.event);
    if (!save.success) {
      target.conditions.push({ id: 'prone', sourceId: attackerId });
      events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'prone', sourceId: attackerId });
    }
  }

  // Fire Form (Fire Elemental): a creature that hits it in melee takes fire
  // damage in return.
  if (target.alive && target.featureIds.includes('fire-form') && isMeleeAttack && attacker.alive) {
    const burn = rollDice(state.rng, '1d10');
    state.rng = burn.state;
    events.push(...applyDamage(state, attackerId, targetId, burn.total, 'fire', burn.rolls, { tags: ['Fire Form'] }));
  }

  // Rampage (Gnoll/Giant Hyena): dropping a foe with a melee hit grants one
  // immediate bonus melee attack against another adjacent enemy.
  if (!ctx.noRampage && attacker.featureIds.includes('rampage') && isMeleeAttack &&
      target.hp === 0 && attacker.alive) {
    const next = Object.values(state.combatants).find(
      (c) => c.alive && !isDown(c) && c.team !== attacker.team && c.id !== targetId &&
             withinReach(attacker, c),
    );
    if (next) {
      events.push(...resolveAttack(state, attackerId, next.id, weaponId, { noRampage: true }));
    }
  }

  return events;
}

/**
 * Apply damage: resist/vuln/immune adjustment, HP, Undead Fortitude,
 * concentration save, waking the unconscious, death, win check.
 */
/**
 * The smite table: what each smite spell does when it lands. Dice are for a
 * 1st-level slot; `perLevel` is added for each slot level above that.
 *
 * Smite damage is applied as its own `applyDamage` call rather than folded into
 * the weapon's total, so resistance and vulnerability are checked against the
 * *smite's* type — a fire-immune target should shrug off Searing Smite while
 * still feeling the sword.
 */
export const SMITE_SPECS: Record<string, {
  name: string;
  dice: string;
  perLevel: string;
  damageType: DamageType;
  /** Extra effect on the target after the damage lands. */
  rider?: (state: GameState, attackerId: Id, targetId: Id, dc: number) => GameEvent[];
  riderText?: string;
  /** The strike itself adds no damage — all of its effect is in the rider
   *  (Ensnaring Strike). */
  damageless?: boolean;
  /** Discharges on any weapon hit, not only a melee one (Ensnaring Strike).
   *  The paladin's smites are melee-only and leave this unset. */
  anyWeapon?: boolean;
}> = {
  'divine-smite': {
    name: 'Divine Smite', dice: '2d8', perLevel: '1d8', damageType: 'radiant',
  },
  'searing-smite': {
    name: 'Searing Smite', dice: '1d6', perLevel: '1d6', damageType: 'fire',
    riderText: 'and sets them alight',
    rider(state, attackerId, targetId, dc) {
      const t = state.combatants[targetId]!;
      if (!t.alive || t.conditions.some((k) => k.id === 'burning')) return [];
      t.conditions.push({ id: 'burning', sourceId: attackerId, repeatSave: { ability: 'con', dc } });
      return [{ type: 'conditionApplied', combatantId: targetId, condition: 'burning', sourceId: attackerId }];
    },
  },
  /**
   * Shining Smite (SRD 5.2, 2nd level): radiant damage, and the target is
   * outlined in light — attacks against it have advantage and it cannot hide.
   * `outlined` already means exactly that, so the rider is one push.
   */
  'shining-smite': {
    name: 'Shining Smite', dice: '2d6', perLevel: '1d6', damageType: 'radiant',
    riderText: 'and leaves them glowing',
    rider(state, attackerId, targetId) {
      const t = state.combatants[targetId]!;
      if (!t.alive || t.conditions.some((k) => k.id === 'outlined')) return [];
      t.conditions.push({ id: 'outlined', sourceId: attackerId });
      return [{ type: 'conditionApplied', combatantId: targetId, condition: 'outlined', sourceId: attackerId }];
    },
  },
  /**
   * Ensnaring Strike (SRD 5.2, ranger 1st level): no damage of its own — a
   * Strength save or Restrained, and 1d6 a round while the vines hold. The
   * ongoing damage is the ranger's `holdDamage`, which ticks for anyone they
   * have restrained and stops the moment the restraint does.
   */
  'ensnaring-strike': {
    name: 'Ensnaring Strike', dice: '0d6', perLevel: '1d6', damageType: 'piercing',
    damageless: true, anyWeapon: true,
    riderText: 'and vines drag them down',
    rider(state, attackerId, targetId, dc) {
      const t = state.combatants[targetId]!;
      if (!t.alive || t.conditions.some((k) => k.id === 'restrained')) return [];
      const events: GameEvent[] = [];
      const save = savingThrow(state, targetId, 'str', dc);
      events.push(save.event);
      if (save.success) return events;
      t.conditions.push({ id: 'restrained', sourceId: attackerId, repeatSave: { ability: 'str', dc } });
      events.push({ type: 'conditionApplied', combatantId: targetId, condition: 'restrained', sourceId: attackerId });
      state.combatants[attackerId]!.holdDamage = { dice: '1d6', type: 'piercing' };
      return events;
    },
  },
};

/** Dice for a smite at a given slot level: base, plus `perLevel` per step up. */
export function smiteDice(spellId: string, slotLevel: number): string {
  const spec = SMITE_SPECS[spellId];
  if (!spec) return '0d6';
  const base = parseDice(spec.dice);
  const up = parseDice(spec.perLevel);
  const steps = Math.max(0, slotLevel - 1);
  return `${base.count + up.count * steps}d${base.sides}`;
}

/**
 * Spend the armed smite on a hit that just landed. Clears the armed state
 * whether or not the rider fires, because the slot is gone either way.
 */
export function dischargeSmite(state: GameState, attackerId: Id, targetId: Id, crit: boolean): GameEvent[] {
  const attacker = state.combatants[attackerId]!;
  const armed = attacker.armedSmite;
  if (!armed) return [];
  delete attacker.armedSmite;
  attacker.conditions = attacker.conditions.filter((k) => k.id !== 'smiting');
  const spec = SMITE_SPECS[armed.spellId];
  if (!spec) return [];

  const roll = spec.damageless
    ? { total: 0, rolls: [] as number[], state: state.rng }
    : rollDice(state.rng, smiteDice(armed.spellId, armed.slotLevel), crit);
  state.rng = roll.state;
  // Shout first: "X is no longer smiting" ahead of the smite itself reads like
  // the spell fizzled.
  const events: GameEvent[] = [{
    type: 'smited',
    attackerId, targetId, spellId: armed.spellId,
    slotLevel: armed.slotLevel, amount: roll.total, crit,
  }, { type: 'conditionRemoved', combatantId: attackerId, condition: 'smiting' }];
  if (!spec.damageless) {
    events.push(...applyDamage(state, targetId, attackerId, roll.total, spec.damageType, roll.rolls,
      { crit, tags: [spec.name] }));
  }
  if (spec.rider) {
    events.push(...spec.rider(state, attackerId, targetId, 8 + proficiencyBonus(attacker.level) +
      abilityMod(attacker.abilities[attacker.spellcastingAbility ?? 'cha'])));
  }
  return events;
}

/** Weapons Shillelagh can imbue, per the SRD: a club or a quarterstaff. */
const SHILLELAGH_WEAPONS = new Set<Id>(['club', 'quarterstaff']);

/** Is this attacker swinging a Shillelagh'd stick right now? */
export function isShillelaghed(attacker: Combatant, weapon: WeaponData): boolean {
  return SHILLELAGH_WEAPONS.has(weapon.id) &&
    attacker.conditions.some((k) => k.id === 'shillelagh');
}

/** The die a Shillelagh'd weapon rolls: d8, growing to d10 at level 5 (and the
 *  SRD's d12/2d6 tiers, which this game's level cap never reaches). */
/**
 * The Martial Arts die, when a monk is the one punching.
 *
 * Undefined for everyone else — an ordinary character's fist is still 1d6, and
 * the weapon carries that. A die that grows with its wielder cannot live on the
 * weapon, which is why this reads like Shillelagh's below.
 */
export function martialArtsDie(attacker: Combatant, weapon: WeaponData): string | undefined {
  if (weapon.id !== 'unarmed-strike' || !attacker.featureIds.includes('martial-arts')) return undefined;
  return attacker.level >= 5 ? '1d8' : '1d6';
}

export function shillelaghDamage(level: number): string {
  return level >= 17 ? '2d6' : level >= 11 ? '1d12' : level >= 5 ? '1d10' : '1d8';
}

/** A weapon counts as magical if it is enchanted (+N) or silvered. Both
 *  get through the SRD's "nonmagical attacks" clause; only the +N kind also
 *  carries a bonus to hit and damage. */
export function isMagicWeapon(w: { magic?: boolean; attackBonus?: number; damageBonus?: number } | undefined): boolean {
  return !!w && (!!w.magic || !!w.attackBonus || !!w.damageBonus);
}

export function applyDamage(
  state: GameState,
  targetId: Id,
  sourceId: Id,
  amount: number,
  damageType: DamageType,
  rolls: number[] = [],
  opts: {
    crit?: boolean; tags?: string[]; magical?: boolean; via?: string; shared?: boolean;
    /** A weapon swing in reach — the only thing Deflect Attacks can catch. */
    melee?: boolean;
  } = {},
): GameEvent[] {
  const events: GameEvent[] = [];
  const target = state.combatants[targetId]!;
  // Ask *before* the damage lands: were they already out? Nothing about the
  // state afterwards can answer it, because a slept hero is also `unconscious`
  // at whatever HP it has left.
  const wasDown = isDown(target);

  // Two kinds of resistance. The unconditional list always halves; the
  // qualified one halves only nonmagical damage, which is what the SRD's
  // physical resistances actually say and what makes a magic weapon worth
  // buying. Immunity and vulnerability are untouched by either.
  const energyWard = target.conditions.some(
    (k) => k.id === 'energyWarded' && k.damageType === damageType,
  );
  let deflected = false;
  // Deflect Attacks (Monk 3): a reaction that catches a melee blow and halves
  // it. Here rather than in resolveAttack because this is the only place that
  // sees the number before it lands — and gated on the reaction, so it is once
  // a round and competes with everything else a monk might react with.
  if (opts.melee && target.featureIds.includes('deflect-attacks') &&
      !target.turn.reactionUsed && !isIncapacitated(target) && amount > 0) {
    target.turn.reactionUsed = true;
    amount = Math.ceil(amount / 2);
    deflected = true;
  }

  // Rage halves blades, arrows and clubs — and unlike a monster's physical
  // resistance it is NOT waived by a magic weapon. That is the SRD rule and it
  // is also what keeps rage worth using in the levels where the enemies start
  // carrying magic: a barbarian's toughness is their own, not a property of
  // what is being swung at them.
  const raging = target.conditions.some((k) => k.id === 'raging') &&
    (damageType === 'slashing' || damageType === 'piercing' || damageType === 'bludgeoning');
  if (target.immunities.includes(damageType)) amount = 0;
  else if (target.resistances.includes(damageType) || energyWard || raging) amount = Math.floor(amount / 2);
  else if (!opts.magical && (target.resistNonmagical ?? []).includes(damageType)) amount = Math.floor(amount / 2);
  else if (target.vulnerabilities.includes(damageType)) amount *= 2;

  // Warding Bond: the ward halves what reaches the target, and the other half
  // goes to the cleric who cast it. The party's total hit points are unchanged
  // -- they have simply been moved onto the person who chose to carry them,
  // which is the entire spell.
  //
  // `shared` suppresses the bond on the mirrored hit, so a pair of bonded
  // clerics cannot bounce one blow between them forever.
  // Checked before the split, not after: a cleric who is dead or down stops
  // carrying anyone, and the ally should feel the whole blow on that hit rather
  // than have half of it quietly vanish.
  let bond = opts.shared ? undefined : target.conditions.find((k) => k.id === 'bonded');
  if (bond) {
    const caster = bond.sourceId !== undefined ? state.combatants[bond.sourceId] : undefined;
    if (!caster || !caster.alive || isDown(caster)) {
      target.conditions = target.conditions.filter((k) => k !== bond);
      events.push({ type: 'conditionRemoved', combatantId: targetId, condition: 'bonded' });
      bond = undefined;
    }
  }
  let mirrored = 0;
  if (bond) {
    const half = Math.floor(amount / 2);
    mirrored = amount - half;
    amount = half;
  }

  // Cloak of Displacement goes down the moment something lands, and stays down
  // until the wearer's next turn comes round. Set before the hit point maths so
  // it fires even on a blow that is entirely soaked by temporary hit points —
  // the SRD's trigger is taking damage, not losing hit points.
  if (amount > 0 && target.featureIds.includes('cloak-displacement')) {
    target.displacementBroken = true;
  }

  // Regeneration is stopped by the right damage type, and it's the *type* that
  // matters rather than how much got through — a fire hit soaked by temp HP or
  // halved by resistance still burns the troll.
  if (target.regeneration?.stoppedBy.includes(damageType)) {
    target.regeneration.suppressed = true;
  }

  const absorbed = Math.min(target.tempHp ?? 0, amount);
  if (absorbed > 0) target.tempHp = (target.tempHp ?? 0) - absorbed;
  target.hp = Math.max(0, target.hp - (amount - absorbed));
  events.push({
    type: 'damageDealt', targetId, sourceId, amount, damageType, rolls,
    ...(() => {
      const tags = [...(opts.tags ?? []), ...(deflected ? ['Deflected'] : [])];
      return tags.length > 0 ? { tags } : {};
    })(),
    ...(opts.via ? { via: opts.via } : {}),
  });

  if (bond?.sourceId && mirrored > 0) {
    events.push(...applyDamage(state, bond.sourceId, sourceId, mirrored, damageType, [], {
      tags: ['Warding Bond'], shared: true,
    }));
  }

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

  if (target.hp === 0 && !wasDown && sourceId !== targetId) {
    // Dark One's Blessing: the warlock is fed by what it kills. Here rather
    // than in `kill`, because this is the one place that knows BOTH that a
    // creature reached zero and who put it there — `kill` takes only the body.
    const killer = state.combatants[sourceId];
    if (killer?.alive && killer.featureIds.includes('dark-ones-blessing') && killer.team !== target.team) {
      const temp = Math.max(1, abilityMod(killer.abilities.cha)) + killer.level;
      // Temporary hit points do not stack: the larger pool wins.
      killer.tempHp = Math.max(killer.tempHp ?? 0, temp);
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
/**
 * A College of Lore bard within 60 ft of the target spends one Bardic
 * Inspiration die to cut an attacker's roll down. Returns the amount rolled,
 * or undefined if nobody could (or would) pay for it.
 *
 * The bard will not spend a die on a roll it cannot actually save: `margin` is
 * how far the attack cleared the AC, and a d6 that cannot reach it is a wasted
 * resource rather than a flourish.
 */
export function tryCuttingWords(
  state: GameState, target: Combatant, margin: number,
): { amount: number; event: GameEvent } | undefined {
  if (margin > 5) return undefined;
  const bard = Object.values(state.combatants).find(
    (c) => c.alive && !isDown(c) && c.team === target.team &&
      c.featureIds.includes('cutting-words') && !c.turn.reactionUsed &&
      (c.featureUses['bardic-inspiration']?.current ?? 0) > 0 &&
      distanceFeet(c.position, target.position) <= 60,
  );
  if (!bard) return undefined;
  bard.featureUses['bardic-inspiration']!.current -= 1;
  bard.turn.reactionUsed = true;
  const d6 = rollDice(state.rng, '1d6');
  state.rng = d6.state;
  return {
    amount: d6.total,
    event: { type: 'cuttingWords', bardId: bard.id, targetId: target.id, amount: d6.total },
  };
}

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

/**
 * Counterspell: somebody stops the spell before it happens.
 *
 * AUTOCAST, like every other reaction in this game — Shield, Cutting Words and
 * the monk's Deflect Attacks all fire on their own. There is no interrupt
 * prompt in the turn loop and inventing one for a single spell would be a lot
 * of machinery pointed at one button.
 *
 * The interesting part is not the plumbing, it is the GATE. Shield's gate is
 * objective ("would +5 turn this hit into a miss?") and needs no judgement.
 * Counterspell's does: countering a Vicious Mockery with a 3rd-level slot is
 * a waste, and countering a Fireball is the whole reason to hold the slot.
 *
 * So the bar is the incoming spell's level. Cantrips and 1st-level spells go
 * through; 2nd and above are stopped while a 3rd-level slot remains. Measured
 * against the sixteen enemy casters actually in the game, that means Fireball,
 * Lightning Bolt, Fear, Spirit Guardians, Hold Person and Web get answered, and
 * a goblin hexer's Vicious Mockery never burns anything.
 */
export function tryCounterspell(state: GameState, casterId: Id, spellLevel: number): Id | undefined {
  if (spellLevel < 2) return undefined;
  const caster = state.combatants[casterId];
  if (!caster) return undefined;
  for (const c of Object.values(state.combatants)) {
    if (c.team === caster.team || !c.alive || isDown(c) || isIncapacitated(c)) continue;
    if (!c.spellIds.includes('counterspell') || c.turn.reactionUsed) continue;
    // 60 feet and line of sight: you cannot stop what you cannot see.
    if (distanceFeet(c.position, caster.position) > 60) continue;
    if (!hasLineOfSight(state.grid, c.position, caster.position)) continue;
    const slot = c.spellSlots[2];   // a 3rd-level slot, which is what it costs
    if (!slot || slot.current <= 0) continue;
    slot.current -= 1;
    c.turn.reactionUsed = true;
    return c.id;
  }
  return undefined;
}

export function breakConcentration(state: GameState, combatantId: Id): GameEvent[] {
  const c = state.combatants[combatantId]!;
  if (!c.concentratingOn) return [];
  const { spellId, targetIds } = c.concentratingOn;
  delete c.concentratingOn;
  if (spellId === 'spiritual-guardians') delete c.spiritualGuardians; // dispel the aura
  if (spellId === 'call-lightning') delete c.stormCloud;      // the storm blows out
  if (spellId === 'moonbeam') delete c.moonbeam;              // the beam winks out
  const events: GameEvent[] = [{ type: 'concentrationBroken', combatantId, spellId }];
  // Polymorph: the shape was being held by this mind, so it ends with the
  // concentration — the ape's remaining hit points simply vanish, which is what
  // makes the spell breakable rather than a free 168-point buffer.
  if (spellId === 'polymorph') {
    for (const tid of targetIds) {
      const t = state.combatants[tid];
      if (t?.wildShape?.original.hp !== undefined) events.push(...revertShape(t));
    }
  }

  /**
   * A concentration-held summon: sweep it off the board.
   *
   * Conjure Elemental's grip needs NOTHING here, which was worth finding out.
   * The spirit restrains a third party, and this change first added an explicit
   * release for it on the theory that concentration only sweeps conditions
   * listed in the caster's own `concentratingOn.targetIds`. That theory was
   * wrong: the Web/Entangle fix further down already frees anyone restrained
   * with `sourceId === this caster && concentration`, keyed off the CASTER
   * rather than the spell — written that way, in its own words, so "the next
   * strand spell is covered before it is written". It was.
   */
  // A concentration-held summon: sweep it off the board. A summon's `kind` is
  // the id of the spell that made it (see Combatant.summons), so this is the
  // general rule rather than a list — which is what it used to be, naming only
  // Flaming Sphere. Spiritual Weapon is concentration in the 2024 rules too,
  // and would otherwise have outlived the concentration that held it.
  if (c.summons) {
    const held = c.summons.filter((x) => x.kind === spellId);
    for (const s of held) {
      events.push({ type: 'summonExpired', casterId: combatantId, kind: s.kind, position: { ...s.position } });
    }
    if (held.length > 0) c.summons = c.summons.filter((x) => x.kind !== spellId);
  }
  // Lingering strands — Web, Entangle, anything else that lays them: clear them
  // from the grid, and free everyone they still hold. Not only the `targetIds`
  // caught at cast time, but any creature that wandered in afterwards (matched
  // by source + concentration).
  //
  // This used to test `spellId === 'web'`, which left Entangle out even though
  // it lays its vines through the very same webCell machinery. Drop the
  // concentration and the vines stayed on the grid for the rest of the fight,
  // with anyone who had walked into them restrained permanently — no save, no
  // source, nothing left to end it. Keyed off the caster rather than the spell
  // id now, so the next strand spell is covered before it is written.
  {
    const cleared = clearWebBySource(state.grid, combatantId);
    // The wall goes out with the same breath — it rides the same "keyed off the
    // caster, not the spell id" rule, so it was covered before it was written.
    const burnt = clearFireBySource(state.grid, combatantId);
    const hushed = clearSilenceBySource(state.grid, combatantId);
    if (cleared.length + burnt.length + hushed.length > 0) {
      events.push({ type: 'webCleared', sourceId: combatantId, cells: [...cleared, ...burnt, ...hushed] });
    }
    for (const other of Object.values(state.combatants)) {
      const held = other.conditions.some((k) => k.sourceId === combatantId && k.concentration && k.id === 'restrained');
      if (held) {
        events.push({ type: 'conditionRemoved', combatantId: other.id, condition: 'restrained' });
        other.conditions = other.conditions.filter((k) => !(k.sourceId === combatantId && k.concentration && k.id === 'restrained'));
      }
    }
  }
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
/**
 * Hunter's Mark auto-transfer: when the marked quarry falls, the mark leaps to
 * the nearest of the caster's living enemies — concentration holds, no re-cast
 * needed. This is the 2024 "move the mark when the target drops" made free and
 * automatic: without it, a dead mark quietly zeroed the ranger's bonus damage
 * unless the player remembered (and spent a fresh slot) to re-cast. Call this
 * BEFORE the fallen combatant's conditions are cleared, or the mark to move is
 * already gone.
 */
function transferHuntersMark(state: GameState, fallenId: Id): GameEvent[] {
  const fallen = state.combatants[fallenId]!;
  const events: GameEvent[] = [];
  // Hex moves the same way and for the same reason — the SRD lets the caster
  // shift it to a new quarry when the old one drops, and a rider that died with
  // its target would make the bonus action and the concentration a worse deal
  // than they read as. Both riders, one loop, so neither can be forgotten.
  const RIDERS: Array<{ condition: 'marked' | 'hexed'; spellId: Id }> = [
    { condition: 'marked', spellId: 'hunters-mark' },
    { condition: 'hexed', spellId: 'hex' },
  ];
  for (const rider of RIDERS) {
  for (const cond of fallen.conditions.filter((k) => k.id === rider.condition && k.sourceId)) {
    const caster = state.combatants[cond.sourceId!];
    if (!caster?.alive || caster.concentratingOn?.spellId !== rider.spellId) continue;
    // Nearest living enemy of the caster; id as a deterministic tiebreak.
    const next = Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.id !== fallenId && c.team !== caster.team)
      .sort((a, b) =>
        distanceFeet(caster.position, a.position) - distanceFeet(caster.position, b.position) ||
        a.id.localeCompare(b.id))[0];
    if (!next) continue; // no quarry left — the fight is over anyway
    // Lift the mark off the fallen (a killed body loses all conditions anyway,
    // but a *downed* hero keeps his — without this the stale mark lingers there).
    fallen.conditions = fallen.conditions.filter((k) => !(k.id === rider.condition && k.sourceId === caster.id));
    if (!next.conditions.some((k) => k.id === rider.condition && k.sourceId === caster.id)) {
      next.conditions.push({ id: rider.condition, sourceId: caster.id, concentration: true });
      events.push({ type: 'conditionApplied', combatantId: next.id, condition: rider.condition, sourceId: caster.id });
    }
    caster.concentratingOn = { spellId: rider.spellId, targetIds: [next.id] };
  }
  }
  return events;
}

/**
 * The full "a hero hits 0 HP" path: hand off Hunter's Mark, go down, drop
 * whatever they were concentrating on, and check whether that ended the fight.
 *
 * Exported because it kept being reimplemented. The banshee's Wail had its own
 * copy that called downCombatant and checkWinner but not breakConcentration,
 * so a wizard wailed unconscious kept a Hold Person running off their sleeping
 * body — the ogre stayed paralysed, the aura stayed up, the sphere kept
 * burning. Nothing about that stops a fight, so it survived every sweep that
 * only asked whether fights finish. One path, so the next caller cannot
 * forget a step.
 */
export function dropToZero(state: GameState, combatantId: Id): GameEvent[] {
  // Death Ward: one reprieve, spent the moment it is needed. Here rather than
  // in the damage maths because this is the single place every route to zero
  // passes through — a blow, a failed save, a hazard — and a ward that only
  // caught swords would be a ward nobody could rely on.
  const ward = state.combatants[combatantId]?.conditions.find((k) => k.id === 'deathWarded');
  if (ward) {
    const c = state.combatants[combatantId]!;
    c.conditions = c.conditions.filter((k) => k !== ward);
    c.hp = 1;
    return [
      { type: 'conditionRemoved', combatantId, condition: 'deathWarded' },
      { type: 'healed', targetId: combatantId, sourceId: ward.sourceId ?? combatantId, amount: 1 },
    ];
  }
  // Gift of the Protectors: a warlock's ward on the whole party. An ally who
  // would drop is left standing on 1 instead, once per short rest.
  //
  // Here beside Death Ward because this is the single place every route to zero
  // passes through, and because the two are the same promise made by different
  // classes — a ward that only caught swords would be a ward nobody could rely
  // on. Death Ward is checked first: it is on the victim and costs a 4th-level
  // slot, so it should be the one spent before somebody else's invocation.
  const falling = state.combatants[combatantId];
  if (falling?.alive) {
    const protector = Object.values(state.combatants).find(
      (c) => c.alive && !isDown(c) && c.id !== combatantId && c.team === falling.team &&
        c.featureIds.includes('gift-of-the-protectors') &&
        (c.featureUses['gift-of-the-protectors']?.current ?? 0) > 0,
    );
    if (protector) {
      protector.featureUses['gift-of-the-protectors']!.current -= 1;
      falling.hp = 1;
      return [
        { type: 'healed', targetId: combatantId, sourceId: protector.id, amount: 1 },
      ];
    }
  }

  // Polymorph: the ape's hit points running out ends the form, it does not
  // drop the hero. They come back with exactly the hit points they had.
  //
  // Here, alongside Death Ward, because this is the single place every route to
  // zero passes through — a blow, a failed save, a hazard. The excess damage is
  // deliberately NOT carried over: the SRD does carry it, but the ape has 168
  // hit points and the hero often has 40, so one big hit at the end would
  // reliably drop them the instant they reverted, which reads as the spell
  // killing the person it was cast to protect.
  const shaped = state.combatants[combatantId];
  if (shaped?.wildShape?.original.hp !== undefined) {
    const back = revertShape(shaped);
    const holder = Object.values(state.combatants).find(
      (x) => x.concentratingOn?.spellId === 'polymorph' && x.concentratingOn.targetIds.includes(combatantId),
    );
    return [...back, ...(holder ? breakConcentration(state, holder.id) : [])];
  }
  const events = [
    ...transferHuntersMark(state, combatantId),
    ...downCombatant(state, combatantId),
    ...breakConcentration(state, combatantId),
  ];
  const winner = checkWinner(state);
  if (winner) {
    state.winner = winner;
    events.push({ type: 'combatEnded', winner });
  }
  return events;
}

/** A dead (or removed) caster's summons wink out — the will animating them is gone. */
function expireSummonsOf(state: GameState, casterId: Id): GameEvent[] {
  const c = state.combatants[casterId]!;
  if (!c.summons?.length) return [];
  const events: GameEvent[] = c.summons.map((s) => (
    { type: 'summonExpired', casterId, kind: s.kind, position: { ...s.position } } as GameEvent
  ));
  delete c.summons;
  return events;
}

/**
 * Hex's rider: +1d6 necrotic on a hit against the hexed creature, for the
 * warlock who hexed it and nobody else. Returns undefined when it does not
 * apply.
 *
 * WHY THIS IS A FUNCTION AND NOT A BLOCK IN resolveAttack
 *
 * It started as one, sitting beside Hunter's Mark — and did nothing at all,
 * because `resolveAttack` handles WEAPON attacks and Eldritch Blast rolls its
 * own spell attack and calls `applyDamage` directly. Hex would have added
 * precisely zero damage to the one spell it exists to pair with, and the class
 * would have looked weak rather than the rider looking broken. Hunter's Mark
 * has never shown the same gap only because a ranger swings a bow.
 *
 * So both callers share this, and a third attack path that wants it has one
 * obvious thing to call.
 */
export function hexBonus(
  state: GameState, attackerId: Id, targetId: Id, crit: boolean,
): { total: number; rolls: number[] } | undefined {
  const target = state.combatants[targetId];
  if (!target?.conditions.some((c) => c.id === 'hexed' && c.sourceId === attackerId)) return undefined;
  const hex = rollDice(state.rng, '1d6', crit);
  state.rng = hex.state;
  return { total: hex.total, rolls: hex.rolls };
}

export function kill(state: GameState, combatantId: Id): GameEvent[] {
  const c = state.combatants[combatantId]!;
  const events: GameEvent[] = [
    ...transferHuntersMark(state, combatantId),
    ...expireSummonsOf(state, combatantId),
    ...releaseCharmedBy(state, combatantId),
    // Before the body is cleared off the grid, so the blast measures from
    // where it actually stood.
    ...deathBurst(state, c),
  ];
  c.alive = false;
  c.hp = 0;
  c.conditions = [];
  const cell = cellAt(state.grid, c.position);
  if (cell && cell.occupantId === combatantId) delete cell.occupantId;
  events.push(
    { type: 'died', combatantId },
    ...breakConcentration(state, combatantId),
  );
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
/**
 * Death Burst: a magmin or mephit goes off when it dies, hurting everyone near
 * it — friend and foe alike, which is the point. Killing one in the middle of
 * the huddle is a mistake the player gets to make and to avoid.
 *
 * Fired from `kill` rather than from the damage that caused it, so it happens
 * however the creature died. It cannot chain: a burst that kills a second
 * mephit resolves that one's death through the same path, and the recursion
 * is bounded by the number of creatures on the board.
 */
export function deathBurst(state: GameState, c: Combatant): GameEvent[] {
  const burst = c.deathBurst;
  if (!burst) return [];
  const events: GameEvent[] = [];
  const caught = Object.values(state.combatants).filter(
    (t) => t.alive && !isDown(t) && t.id !== c.id &&
      distanceFeet(c.position, t.position) <= burst.radius,
  );
  if (caught.length === 0) return events;
  const roll = rollDice(state.rng, burst.dice);
  state.rng = roll.state;
  for (const t of caught) {
    const save = savingThrow(state, t.id, burst.save.ability, burst.save.dc);
    events.push(save.event);
    const amount = save.success ? Math.floor(roll.total / 2) : roll.total;
    if (amount > 0) events.push(...applyDamage(state, t.id, c.id, amount, burst.type, roll.rolls, { tags: ['Death Burst'] }));
  }
  return events;
}

/** Free everyone this creature had charmed — the song stops when the singer
 *  does. Called from kill and charmAway, so a harpy shot out of the air
 *  releases the party rather than holding them from beyond the grave. */
export function releaseCharmedBy(state: GameState, sourceId: Id): GameEvent[] {
  const events: GameEvent[] = [];
  for (const c of Object.values(state.combatants)) {
    const held = c.conditions.filter((k) => (k.id === 'charmed' || k.id === 'lured') && k.sourceId === sourceId);
    if (held.length === 0) continue;
    c.conditions = c.conditions.filter((k) => !held.includes(k));
    for (const k of held) events.push({ type: 'conditionRemoved', combatantId: c.id, condition: k.id });
  }
  return events;
}

/**
 * Take a creature out of the fight without killing it: Banishment, Animal
 * Friendship, or reaching the edge of the board while fleeing.
 *
 * `exit` chooses which event says so, because the log should name the reason —
 * "wanders off" and "flees the field" are different things to watch, and
 * emitting both (a `fled` followed by a `charmedAway`) narrated one departure
 * twice.
 */
export function charmAway(state: GameState, combatantId: Id, exit: 'charmed' | 'fled' = 'charmed', sourceId?: Id): GameEvent[] {
  const c = state.combatants[combatantId]!;
  const events: GameEvent[] = [
    ...transferHuntersMark(state, combatantId),
    ...expireSummonsOf(state, combatantId),
    ...releaseCharmedBy(state, combatantId),
  ];
  c.alive = false;
  c.hp = 0;
  c.conditions = [];
  const cell = cellAt(state.grid, c.position);
  if (cell && cell.occupantId === combatantId) delete cell.occupantId;
  events.push(
    exit === 'fled'
      ? { type: 'fled', combatantId, ...(sourceId ? { sourceId } : {}) }
      : { type: 'charmedAway', combatantId },
    ...breakConcentration(state, combatantId),
  );
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
  // Summons are excluded: they fight, but they do not decide the fight. A party
  // face-down on the floor has lost even if its snake is still standing, and
  // leaving one in would hang exactly the way the both-sides-down case used to.
  const standing = Object.values(state.combatants)
    .filter((c) => c.alive && c.hp > 0 && c.summonedBy === undefined);
  const t1 = standing.some((c) => c.team === 'team1');
  const t2 = standing.some((c) => c.team === 'team2');
  if (t1 && !t2) return 'team1';
  if (t2 && !t1) return 'team2';
  if (t1 || t2) return null;   // both sides still have someone up: fight on

  // NEITHER side is standing. Returning null here hung the game outright: the
  // last hero dropping in the same exchange that killed the last monster left
  // nobody able to take a turn, and the turn scan skips anyone who is down — so
  // the round counter froze and even the MAX_ROUNDS backstop could never fire.
  // The fuzzer found it twice in 3,000 fights, and the fights did not end after
  // twenty thousand decisions.
  //
  // Standing beats down beats dead. A party unconscious among corpses has won:
  // heroes drop rather than die here, every enemy is gone, and there is nothing
  // left to stop them coming round. Only a board with no living creature at all
  // falls through to team2, matching what the round-limit backstop does with a
  // tie — a campaign party retries rather than takes an unearned pass.
  const living = Object.values(state.combatants).filter((c) => c.alive);
  const a1 = living.some((c) => c.team === 'team1');
  const a2 = living.some((c) => c.team === 'team2');
  if (a1 && !a2) return 'team1';
  if (a2 && !a1) return 'team2';
  return 'team2';
}
