/**
 * Greedy AI: scores every legal action by expected value and plays the best
 * one, ending its turn when nothing worthwhile remains. Pure function of
 * state — no engine backdoors, exactly the Action API the CLI uses.
 */
import type { GameState, Id, Combatant, Position } from '../engine/types.js';
import { isDown, isIncapacitated } from '../engine/types.js';
import { abilityMod, proficiencyBonus, cellAt } from '../engine/types.js';
import { parseDice } from '../engine/dice.js';
import { next } from '../engine/rng.js';
import { WEAPONS } from '../data/weapons.js';
import { SPELLS, spellDc, cantripDice, eldritchBeams, wearsMetal, canBePutToSleep } from '../data/spells.js';
import { heightenedTarget } from '../engine/rules/metamagic.js';
import { MONSTERS, monsterLevel } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { acOf } from '../data/armor.js';
import { attackableWeapons } from '../engine/rules/equipment.js';
import { isHidden } from '../engine/rules/hide.js';
import { FEATURES } from '../data/features.js';
import { distanceCells, distanceFeet, adjacent, sphere2x2, sphere5x5, cone15, cube15, line15 } from '../engine/grid.js';
import { directionFromDelta } from '../data/spells.js';
import { BREATH_WEAPONS, bestBreathDirection } from '../data/features.js';
import { attackAbility, collectAttackSources, smiteDice, PROTECTED_FROM, canAttackWith, shillelaghDamage } from '../engine/rules/attack.js';
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

/**
 * Heightened Spell, while the cast being scored is heightened.
 *
 * Set at the top of `scoreSpell` and cleared in its `finally`, so it is a stack
 * frame rather than state. It exists so that Heightened needs NO per-spell
 * scoring at all: every case already prices its effect through `saveFailProb`,
 * so bending that one function bends all of them, and the delta falls out as
 * the difference between the bent score and the plain one. A flat number for
 * "what disadvantage on a save is worth" would have been the seventh guess.
 */
let heightenedVictim: Id | undefined;

function saveFailProb(state: GameState, target: Combatant, ability: keyof Combatant['abilities'], dc: number): number {
  const bonus =
    abilityMod(target.abilities[ability]) +
    (target.savingThrowProfs.includes(ability) ? proficiencyBonus(target.level) : 0);
  // P(d20 + bonus < dc)
  const p = clampP((dc - bonus - 1) / 20);
  // Disadvantage: both dice must clear the DC, so the chance of failing is
  // 1 - (1 - p)^2 written the other way round.
  return target.id === heightenedVictim ? 1 - (1 - p) * (1 - p) : p;
}

/** Damage EV weighted up when it can kill. */
function damageValue(ev: number, target: Combatant): number {
  const killBonus = ev >= target.hp ? 4 + target.maxHp / 4 : 0;
  return ev + killBonus;
}

/**
 * How much of an ally's hit points a protective spell is actually saving.
 *
 * THE BUG THIS EXISTS FOR
 *
 * Damage spells are priced in hit points removed — `damageValue` returns an
 * expectation in the tens, and a Fireball across three orcs comes to about 80.
 * The defensive spells were priced on a hand-tuned 0-to-10 scale: Death Ward
 * peaked at 4, Freedom of Movement at 5, Greater Invisibility at 6, Polymorph
 * at 14. Nothing on the first scale can ever outbid anything on the second, so
 * the entire defensive half of the 4th-level tier was legal, prepared, scored,
 * and never once chosen. Measured: Polymorph was a legal action on 251 caster
 * turns across 60 level-8 runs and was picked zero times.
 *
 * The scales have to be the same currency or the comparison is meaningless.
 * These are hit points, weighted by how likely the ally is to actually lose
 * them — the same shape as `damageValue`, and deliberately so.
 *
 * The estimates are rough on purpose. What was wrong was the ORDER OF
 * MAGNITUDE, not the second decimal place, and a precise threat model would be
 * a lot of machinery pointed at a number that only has to land in the right
 * decade.
 */
function danger(state: GameState, ally: Combatant): number {
  // Nothing is at risk if nothing is near them.
  //
  // The first version used "within a turn's reach" (speed + 10 ft), which is
  // the correct idea and useless on this board: an orc moves 30 ft, the grid is
  // eight cells across, so every living enemy qualified from anywhere and the
  // term was always 1. Fifteen feet is close enough to mean something here —
  // it is the band where a creature is being fought rather than approached.
  const closing = Object.values(state.combatants).filter(
    (c) => c.alive && !isDown(c) && c.team !== ally.team &&
      distanceFeet(c.position, ally.position) <= 15,
  ).length;
  if (closing === 0) return 0;
  // Two enemies on somebody is roughly the point at which they are in real
  // trouble; beyond that it saturates rather than growing without bound.
  //
  // This gradation is TUNING, not a rule, and no unit test pins it: planting
  // `pressure = 1` changes no test outcome, because one attacker on a badly
  // hurt ally already clears every bar in the suite. Its effect shows only in
  // aggregate, in how often these spells fire across a run. The distance gate
  // above IS load-bearing and is tested.
  const pressure = Math.min(1, closing / 2);
  // And how much they have left to lose. A hero at full health is not being
  // rescued, however many things are looking at them.
  const hurt = 1 - ally.hp / Math.max(1, ally.maxHp);
  return pressure * (0.35 + 0.65 * hurt);
}

/** The giant ape's hit points — what Polymorph hands an ally. */
const APE_HP = MONSTERS['giant-ape']?.hp ?? 168;
/**
 * And what the ape DOES with a round, on the same scale `outputPerRound` uses.
 *
 * Two attacks of 3d10 + 6, discounted for hitting, which is about 27 — better
 * than most of the party. Polymorph was priced as a rescue and nothing else,
 * so this half of the spell was worth exactly zero to the scorer.
 */
/**
 * How long the ape is expected to matter.
 *
 * Polymorph runs an hour, so the fight is what ends it, not the clock. Three
 * rounds is the same horizon `denialValue` and the ward spells use — long
 * enough that the body means something, short enough that it cannot outbid
 * ending the fight outright.
 */
const POLYMORPH_ROUNDS = 3;
const APE_OUTPUT = (() => {
  const ape = MONSTERS['giant-ape'];
  const fist = ape ? WEAPONS[ape.weaponIds?.[0] ?? ''] : undefined;
  if (!ape || !fist) return 27;
  return (avgDice(fist.damage) + abilityMod(ape.abilities.str)) * (ape.attacksPerAction ?? 1) * 0.6;
})();

/**
 * Roughly what a creature does with a round, in hit points.
 *
 * The unit every non-damage spell should be priced in. A control spell is worth
 * the output it removes; a buff is worth the output it adds; a ward is worth
 * the output it stops arriving. All three were priced on hand-tuned 0-to-10
 * scales instead, against damage spells scored in the tens — Bless capped at
 * 15 for the whole party, Haste at about 6, Mirror Image at 9 — so a caster
 * with anything else on its list never chose them. Fourteen playable spells
 * were never cast once across sixty runs.
 *
 * Deliberately rough. What was wrong is the ORDER OF MAGNITUDE; a precise
 * threat model would be a lot of machinery pointed at a number that only has to
 * land in the right decade.
 */
function outputPerRound(c: Combatant): number {
  let best = 0;
  for (const id of attackableWeapons(c)) {
    const w = WEAPONS[id];
    if (!w) continue;
    const mod = abilityMod(c.abilities[attackAbility(c, w)]);
    best = Math.max(best, (avgDice(w.damage) + (w.damageBonus ?? 0) + mod) * c.attacksPerAction * 0.6);
  }
  // A caster's turn is a spell, not a swing, and its cantrip alone scales with
  // level — enough of a proxy to keep a wizard from reading as harmless.
  const magic = c.spellIds.length > 0 ? avgDice(cantripDice('1d10', c.level)) * 0.6 : 0;
  // A floor, so a creature with an odd kit is never priced at zero and made
  // invisible to every ward in the game.
  return Math.max(best, magic, 3 + c.level);
}

/**
 * What removing a creature's turns is worth: its output, for as long as the
 * effect plausibly lasts. `rounds` is the honest place to express how sticky
 * an effect is — a save-ends condition rarely runs its full duration.
 */
function denialValue(state: GameState, target: Combatant, failProb: number, rounds: number): number {
  void state;
  return failProb * outputPerRound(target) * rounds;
}

/** What raising an ally's output is worth: the same units, from the other side. */
function upliftValue(ally: Combatant, fraction: number, rounds: number): number {
  return outputPerRound(ally) * fraction * rounds;
}

/** Hit points kept on the board, in the same units `damageValue` deals in. */
function rescueValue(hpSaved: number, state: GameState, ally: Combatant): number {
  return hpSaved * danger(state, ally);
}

/**
 * What is actually being thrown at this creature, per round, in hit points.
 *
 * The quantity a ward is worth a share of. Pricing wards off the TARGET's hit
 * points instead — `hp * 0.5` and the like — was the second wrong answer here:
 * it makes a ward on a healthy wizard worth more than the same ward on a
 * bloodied one, which is backwards, and it has nothing to do with how hard the
 * room is hitting. Mirror Image eats three attacks; what those attacks are
 * worth depends entirely on who is swinging them.
 *
 * Counts anything that could reach the ally within a turn, since a ward is put
 * up as the line closes rather than after it lands.
 */
function incomingPerRound(state: GameState, ally: Combatant): number {
  let total = 0;
  let defenders = 0;
  for (const c of Object.values(state.combatants)) {
    if (!c.alive || isDown(c)) continue;
    if (c.team === ally.team) { defenders++; continue; }
    if (distanceFeet(c.position, ally.position) > c.speed + 10) continue;
    total += outputPerRound(c);
  }
  // Spread across whoever is standing.
  //
  // The first version returned the whole room's output as the value of a ward
  // on ONE creature, which in a four-on-four is four times too much: Greater
  // Invisibility priced at ninety outbid a Fireball, and casters spent every
  // turn warding instead of fighting. The arena's even-budget guard caught it
  // — a level-6 fight fell from an even match to 24% — which is exactly the
  // regression that test exists for.
  return total / Math.max(1, defenders);
}

/**
 * The same, for a ward put up BEFORE it is needed rather than as a rescue.
 *
 * `danger` asks whether something is within fifteen feet right now, which is
 * the right question for Death Ward or Polymorph — waiting until the ally is
 * actually in trouble is correct play for those. It is the wrong question for
 * Mage Armor, Mirror Image and False Life, which a caster puts up at the top of
 * a fight precisely because it is cheaper than needing them later. Priced
 * through `rescueValue` they scored zero while the enemy was still walking
 * over, and Mirror Image went from being cast twice in sixty runs to never.
 *
 * So: a floor while anything hostile is alive at all. Still scaled by real
 * pressure, so it rises as the fight closes.
 */
function wardValue(hpSaved: number, state: GameState, ally: Combatant): number {
  const anyFoe = Object.values(state.combatants).some(
    (c) => c.alive && !isDown(c) && c.team !== ally.team);
  if (!anyFoe) return 0;
  return hpSaved * Math.max(0.3, danger(state, ally));
}

/**
 * Does this creature cast at all? Silence is worth nothing over a creature with
 * no spells, and the difference between a hushed mage and a hushed ogre is the
 * whole spell.
 *
 * Cantrips count: Vicious Mockery and Fire Bolt are somebody's whole turn.
 */
function canCastAnything(c: Combatant): boolean {
  return c.spellIds.length > 0;
}

// --- action scoring ----------------------------------------------------------

function scoreAttack(state: GameState, actor: Combatant, a: Action & { kind: 'attack' }): number {
  const weapon = WEAPONS[a.weaponId]!;
  const target = state.combatants[a.targetId]!;
  const isMelee = adjacent(actor.position, target.position) && weapon.melee;
  const { adv, dis } = collectAttackSources(state, actor, target, weapon, isMelee);
  const mode = resolveRollMode(adv, dis);
  const ability = attackAbility(actor, weapon);
  // A magic weapon's bonuses were not priced here at all, which meant the AI
  // could not tell a +1 longsword from a longsword — and, once bane weapons
  // existed, could not tell that the Dragon Slayer in its off hand was the one
  // to swing at the dragon. All four terms below are read generically off the
  // weapon data, so no policy names a weapon (which `src/ai` may not do).
  const bonus = abilityMod(actor.abilities[ability]) + proficiencyBonus(actor.level) +
    (weapon.attackBonus ?? 0);
  let dmg = avgDice(weapon.damage) + (a.offhand ? 0 : abilityMod(actor.abilities[ability])) +
    (weapon.damageBonus ?? 0);
  if (weapon.extraDamage) {
    // A save halves it, so price the average of both outcomes rather than the
    // best case.
    dmg += avgDice(weapon.extraDamage.dice) * (weapon.extraDamage.save ? 0.75 : 1);
  }
  // The bane rider: only against the types it was made for, which is the whole
  // reason it is worth carrying and the whole reason it must be conditional
  // here too. Pricing it unconditionally would make a Dragon Slayer look like
  // the best weapon against everything.
  if (weapon.slays?.types.includes(target.creatureType ?? 'humanoid')) {
    dmg += avgDice(weapon.slays.dice);
  }
  if (actor.featureIds.includes('dueling') && isMelee && !weapon.properties.includes('two-handed')) dmg += 2;
  if (
    actor.featureIds.includes('sneak-attack') && !actor.turn.sneakAttackUsed &&
    (weapon.properties.includes('finesse') || !weapon.melee)
  ) {
    // Mirror the engine's enabling-ally test (attack.ts): a downed or
    // incapacitated ally doesn't distract anyone, so it mustn't be priced in.
    const allyAdjacent = Object.values(state.combatants).some(
      (c) => c.alive && !isDown(c) && c.id !== actor.id && c.team === actor.team &&
        adjacent(c.position, target.position) && !isIncapacitated(c),
    );
    if (mode === 'advantage' || (allyAdjacent && mode !== 'disadvantage')) {
      dmg += avgDice(`${Math.ceil(actor.level / 2)}d6`);
    }
  }
  if (target.conditions.some((c) => c.id === 'marked' && c.sourceId === actor.id)) dmg += avgDice('1d6');
  if (actor.featureIds.includes('colossus-slayer') && !actor.turn.colossusUsed && target.hp < target.maxHp) {
    dmg += avgDice('1d8');
  }
  // An armed smite is already paid for and discharges on this hit — full value.
  if (actor.armedSmite && isMelee) {
    dmg += avgDice(smiteDice(actor.armedSmite.spellId, actor.armedSmite.slotLevel));
  } else if (
    actor.featureIds.includes('divine-smite') && isMelee && !actor.turn.bonusActionUsed &&
    actor.spellSlots.some((s) => s.current > 0)
  ) {
    // The auto-smite is no longer a given: it fires on a crit (~5%, doubled
    // dice) or when it would finish the target. Pricing it at a flat 2d8 badly
    // over-valued every melee swing a paladin could make.
    dmg += 0.05 * avgDice('4d8');
    if (target.hp <= avgDice('2d8')) dmg += avgDice('2d8') * 0.5;
  }
  return damageValue(hitProb(bonus, acOf(target), mode) * dmg, target);
}

function scoreSpell(state: GameState, actor: Combatant, a: Action & { kind: 'castSpell' }): number {
  heightenedVictim = a.metamagic === 'heightened'
    ? heightenedTarget(a.targets as Array<{ combatantId?: Id }>)
    : undefined;
  try {
    return scoreSpellInner(state, actor, a);
  } finally {
    heightenedVictim = undefined;
  }
}

function scoreSpellInner(state: GameState, actor: Combatant, a: Action & { kind: 'castSpell' }): number {
  const spell = SPELLS[a.spellId]!;
  const dc = spellDc(state, actor.id);
  const castMod = abilityMod(actor.abilities[actor.spellcastingAbility ?? 'int']);
  const spellAtkBonus = castMod + proficiencyBonus(actor.level);
  // Preserve limited slots a little: leveled spells carry a small cost.
  const slotCost = spell.level >= 1 ? 2 : 0;

  switch (a.spellId) {
    /**
     * Eldritch Blast: the warlock's every turn.
     *
     * Priced per BEAM, because the beam count is the whole progression — a
     * cantrip case that priced one beam would quietly halve the class from
     * level 5 on, which is exactly the "cantrip cases still use their level-1
     * dice" trap noted on Vicious Mockery.
     *
     * The targets arrive one per beam (Magic Missile's shape), so the score is
     * summed over the entries rather than multiplied by a count.
     */
    case 'eldritch-blast': {
      const agonizing = actor.featureIds.includes('eldritch-invocations')
        ? Math.max(0, abilityMod(actor.abilities.cha)) : 0;
      const beams = eldritchBeams(actor.level);
      let v = 0;
      for (const entry of a.targets.slice(0, beams)) {
        const t = state.combatants[(entry as { combatantId: Id }).combatantId];
        if (!t?.alive || isDown(t)) continue;
        v += damageValue(hitProb(spellAtkBonus, acOf(t), 'flat') * (avgDice('1d10') + agonizing), t);
      }
      return v;
    }
    case 'fire-bolt': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(hitProb(spellAtkBonus, acOf(t), 'flat') * avgDice('1d10'), t);
    }
    case 'shocking-grasp': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(hitProb(spellAtkBonus, acOf(t), 'flat') * avgDice('1d8'), t) + 1; // reaction denial
    }
    // Entangle: value each enemy the patch would catch, weighted by its odds of
    // failing the Strength save — the same shape as Web, whose vines these are.
    case 'entangle': {
      const anchor = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere5x5(anchor)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || isDown(t)) continue;
        // Vines do not pick sides once they are down; never plant them on allies.
        if (t.team === actor.team) return 0;
        if (t.conditions.some((k) => k.id === 'restrained')) continue;
        // Restrained: speed 0 and disadvantage on its attacks, until it
        // breaks out. Roughly half of what the creature was going to do, for
        // a couple of rounds.
        v += denialValue(state, t, saveFailProb(state, t, 'str', dc), 2) * 0.5;
      }
      return v - slotCost;
    }
    // Heat Metal: worth nothing at all against anyone without metal on them,
    // which is the whole character of the spell.
    case 'heat-metal': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (!wearsMetal(t)) return 0;
      const dmg = avgDice(`${2 + Math.max(0, a.slotLevel - 2)}d8`);
      // No attack roll and no save on the damage: all of it lands.
      return damageValue(dmg, t) + saveFailProb(state, t, 'con', dc) * 2 - slotCost;
    }
    // Moonbeam: an area that keeps burning, so it is priced like Call Lightning
    // — everyone it covers now, plus a fair expectation of one more tick.
    case 'moonbeam': {
      if (actor.concentratingOn) return 0;
      const anchor = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(anchor)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || isDown(t)) continue;
        if (t.team === actor.team) return 0;
        const fail = saveFailProb(state, t, 'con', dc);
        const dmg = avgDice(`${2 + Math.max(0, a.slotLevel - 2)}d10`) * (fail + (1 - fail) * 0.5);
        v += damageValue(dmg, t);
      }
      return v * 1.4 - slotCost;
    }
    // Call Lightning: the first bolt plus a fair expectation of one more, since
    // the cloud fires again on the caster's next turn if concentration holds.
    case 'call-lightning': {
      if (actor.concentratingOn) return 0;
      const anchor = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(anchor)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || isDown(t)) continue;
        if (t.team === actor.team) return 0;
        const fail = saveFailProb(state, t, 'dex', dc);
        const dmg = avgDice(`${3 + Math.max(0, a.slotLevel - 3)}d10`) * (fail + (1 - fail) * 0.5);
        v += damageValue(dmg, t);
      }
      return v * 1.5 - slotCost;   // ×1.5 for the bolts still to come
    }
    case 'vicious-mockery': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      // Priced off the *scaled* dice. The older cantrip cases here still use
      // their level-1 dice, which quietly undersells every cantrip from level 5
      // on; fixing those changes long-settled caster behaviour and belongs in
      // its own change, but a new cantrip should at least start out honest.
      const fail = saveFailProb(state, t, 'wis', dc);
      const dmg = avgDice(cantripDice('1d6', actor.level));
      return damageValue(fail * dmg, t) + fail * 1.5;  // + the disadvantage it leaves
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
      // +1d4 on every attack and save, for the whole fight, for everyone it
      // touches. Was a flat 3 a head, so a cleric with anything else on its
      // list never opened with it.
      let v = 0;
      for (const entry of a.targets) {
        const t = state.combatants[(entry as { combatantId: Id }).combatantId];
        if (!t?.alive || isDown(t)) continue;
        // +1d4 to hit is worth about a tenth of a creature's output.
        v += upliftValue(t, 0.1, state.round <= 2 ? 4 : 2);
      }
      return v - slotCost;
    }
    case 'divine-smite':
    case 'searing-smite':
    case 'shining-smite':
    case 'ensnaring-strike': {
      // Only worth arming if there is something to hit this turn — the slot is
      // spent at cast time, so loading up with no enemy in reach throws it away.
      //
      // "In reach" is not the same as "adjacent": Ensnaring Strike discharges on
      // any weapon hit, and a ranger fires it from sixty feet. Gating it on an
      // adjacent foe (which the paladin's smites correctly need) meant a bow
      // ranger never armed it at all — 24 runs holding it, zero casts.
      const anyWeapon = a.spellId === 'ensnaring-strike';
      const foe = Object.values(state.combatants)
        .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
          (anyWeapon
            ? attackableWeapons(actor).some((w) => canAttackWith(state, actor, w, c.id))
            : adjacent(actor.position, c.position)))
        .sort((x, y) => x.hp - y.hp)[0];
      // Mirrors isLegalAction's attack gate: an attack must still be possible
      // this turn, or the slot is spent on a swing that never comes.
      const canStillAttack = !actor.turn.actionUsed || actor.turn.attacksLeft > 0;
      if (!foe || !canStillAttack) return 0;
      // The dice are hit points; the riders below are priced against them.
      let v = damageValue(avgDice(smiteDice(a.spellId, a.slotLevel)), foe);
      // Riders are worth about a slot's cost again on a target that will live
      // long enough to suffer them; on something nearly dead, raw damage wins.
      const durable = foe.hp > avgDice('2d8') * 1.5;
      if (durable && a.spellId === 'searing-smite') v += 3;
      if (durable && a.spellId === 'shining-smite') v += 4;      // advantage for the whole party
      if (durable && a.spellId === 'ensnaring-strike') v += 4;   // restrained, and it ticks
      return v - slotCost;
    }
    // Faerie Fire: outlines everything in the patch, so every attack the party
    // makes against them has advantage until the light goes out. Had no case at
    // all, so a druid or bard holding it never cast it once in 40 runs.
    case 'faerie-fire': {
      if (actor.concentratingOn) return 0;
      const anchor = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(anchor)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || isDown(t)) continue;
        if (t.team === actor.team) return 0;          // never light up your own side
        if (t.conditions.some((k) => k.id === 'outlined')) continue;
        // Worth roughly what advantage is worth to everyone who will swing at
        // it: a fifth of a hit per attacker per round, for a while.
        // Advantage for everyone who swings at it, for as long as the light
        // holds — about a fifth more output from the whole party, aimed here.
        v += upliftValue(actor, 0.2, 3);
      }
      return v - slotCost;
    }
    // Dragonborn Breath Weapon: a cone, aimed the way a dragon's is. This is a
    // species feature that fired exactly never, because nothing scored it.
    case 'breath-weapon': {
      const dir = (a.targets[0] as { position: Position } | undefined)?.position;
      if (!dir) return 0;
      let v = 0;
      for (const pos of cone15(actor.position, directionFromDelta(actor.position, dir))) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || isDown(t)) continue;
        if (t.team === actor.team) return 0;
        const fail = saveFailProb(state, t, 'dex', 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.con));
        const dmg = avgDice(cantripDice('1d10', actor.level)) * (fail + (1 - fail) * 0.5);
        v += damageValue(dmg, t);
      }
      return v;   // innate, costs no slot
    }
    // Animal Friendship: takes a beast out of the fight outright. Only ever
    // worth anything against a beast, which is why it needs its own case rather
    // than falling through to the charm pricing.
    case 'animal-friendship': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.creatureType !== 'beast') return 0;
      // A beast talked out of the fight entirely — removal, so the whole of
      // what it was going to do.
      return denialValue(state, t, saveFailProb(state, t, 'wis', dc), 4) - slotCost;
    }
    // True Strike: a weapon attack powered by the caster's spellcasting ability.
    // Worth it exactly when that modifier beats the one the weapon would use.
    case 'true-strike': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const w = a.weaponId ? WEAPONS[a.weaponId] : undefined;
      if (!w) return 0;
      const normal = abilityMod(actor.abilities[attackAbility(actor, w)]);
      if (castMod <= normal) return 0;    // the plain swing is as good or better
      const bonus = castMod + proficiencyBonus(actor.level);
      return damageValue(hitProb(bonus, acOf(t), 'flat') * (avgDice(w.damage) + castMod), t);
    }
    case 'sleep': {
      const anchor = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(anchor)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || !canBePutToSleep(t)) continue;
        const p = saveFailProb(state, t, 'wis', dc);
        // Asleep is out of the fight until something wakes it: the whole of
        // what it was going to do. Catching an ALLY is the same quantity with
        // the sign flipped, and then some — it is your own front line on the
        // floor.
        v += t.team === actor.team
          ? -denialValue(state, t, p, 3) * 1.5
          : denialValue(state, t, p, 3);
      }
      return v - slotCost;
    }
    case 'guiding-bolt': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const p = hitProb(spellAtkBonus, acOf(t), 'flat');
      return damageValue(p * avgDice('4d6'), t) + p * 2 - slotCost; // rider bonus
    }
    /**
     * Ray of Sickness: a spell attack for (2+slot)d8 poison, then a Con save or
     * Poisoned.
     *
     * Unscored until the sorcerer arrived, because the only way to reach it
     * before was a tiefling's innate casting or a wizard's `learnableExtra` —
     * both rare enough that nobody noticed the AI holding it. It is on the
     * sorcerer's list outright, so it needs a price.
     *
     * Poisoned is disadvantage on attacks, which is a fraction of the target's
     * output rather than a flat number — `denialValue` already knows how to
     * price that, so the rider costs no new currency.
     */
    case 'ray-of-sickness': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const hit = hitProb(spellAtkBonus, acOf(t), 'flat');
      const dmg = damageValue(hit * avgDice(`${1 + a.slotLevel}d8`), t);
      // The rider lands whenever the ray does — there is no save — and lasts
      // one round. Disadvantage is worth roughly a quarter of what it is
      // rolling for, so this is a quarter of a round of the target's output.
      return dmg + denialValue(state, t, hit * 0.25, 1) - slotCost;
    }
    case 'scorching-ray': {
      let v = 0;
      for (const tg of a.targets) {
        const t = state.combatants[(tg as { combatantId: Id }).combatantId]!;
        v += hitProb(spellAtkBonus, acOf(t), 'flat') * avgDice('2d6');
      }
      const first = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(v, first) - slotCost;
    }
    case 'thunderwave': {
      const dir = directionFromDelta(actor.position, (a.targets[0] as { position: Position }).position);
      const sculpt = actor.featureIds.includes('sculpt-spells');
      let v = 0;
      for (const pos of cube15(actor.position, dir)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ || occ === actor.id) continue;
        const c = state.combatants[occ]!;
        if (!c.alive) continue;
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
      // Paralysed: no actions at all, and every melee hit against it crits.
      // Four rounds is optimistic for a save-ends effect, which is why the
      // fail probability multiplies it.
      return denialValue(state, t, saveFailProb(state, t, 'wis', dc), 4) - slotCost;
    }
    case 'aid': {
      // +5 maximum and current hit points each, which is hit points on the
      // board however the fight goes — priced as exactly that rather than as
      // 2.5 a head.
      if (state.round > 2) return 0;
      return a.targets.length * 5 * 0.8 - slotCost;
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
    case 'fireball': {
      const center = (a.targets[0] as { position: Position }).position;
      const sculpt = actor.featureIds.includes('sculpt-spells');
      let v = 0;
      for (const pos of sphere5x5(center)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive) continue;
        if (sculpt && t.team === actor.team) continue;
        const pFail = saveFailProb(state, t, 'dex', dc);
        const ev = avgDice('8d6') * (pFail + (1 - pFail) * 0.5);
        // Allies caught in the blast are a heavy penalty (unless Sculpt spared them).
        v += t.team === actor.team ? -2 * ev : damageValue(ev, t);
      }
      return v - slotCost;
    }
    case 'mass-healing-word': {
      let v = 0;
      for (const tg of a.targets) {
        const t = state.combatants[(tg as { combatantId: Id }).combatantId]!;
        const missing = t.maxHp - t.hp;
        if (missing <= 0) continue;
        const heal = Math.min(avgDice('1d4') + castMod, missing);
        v += heal * (missing >= t.maxHp / 2 ? 1.4 : 0.4);
      }
      return v - slotCost;
    }
    case 'healing-word': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const missing = t.maxHp - t.hp;
      if (missing <= 0) return -slotCost;
      const heal = Math.min(avgDice('2d4') + castMod, missing);
      return heal * (missing >= t.maxHp / 2 ? 1.4 : 0.4) - slotCost;
    }
    case 'suggestion': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      // Removing an enemy from the fight is worth roughly killing it.
      return saveFailProb(state, t, 'wis', dc) * damageValue(t.hp, t) - slotCost;
    }
    case 'command': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      // Stealing one turn (grovel prone) is worth a slice of the target's threat.
      // One turn, and only one — Command is the cheapest control in the game
      // and should read as exactly a turn's worth.
      return denialValue(state, t, saveFailProb(state, t, 'wis', dc), 1) - slotCost;
    }
    case 'web': {
      if (actor.concentratingOn) return 0;
      const center = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere5x5(center)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || t.team === actor.team) continue;
        // The same restraint as Entangle, and it keeps catching whoever
        // walks in — which is why the strands are worth a round more.
        v += denialValue(state, t, saveFailProb(state, t, 'dex', dc), 3) * 0.5;
      }
      return v - slotCost;
    }
    case 'spiritual-weapon': {
      // One hammer at a time; recasting the same summon buys nothing.
      if (actor.summons?.some((s) => s.kind === 'spiritual-weapon')) return 0;
      // Placed beside an enemy it strikes immediately, then keeps attacking on
      // its own every turn — the future value is what makes the slot worth it.
      const pos = (a.targets[0] as { position: Position }).position;
      const t = Object.values(state.combatants)
        .find((c) => c.alive && !isDown(c) && c.team !== actor.team && adjacent(pos, c.position));
      if (!t) return 0; // only value a placement that bonks someone now
      const dmg = hitProb(spellAtkBonus, acOf(t), 'flat') * (avgDice('1d8') + castMod);
      return damageValue(dmg, t) + 6 - slotCost; // +6 ≈ the free attacks to come
    }
    case 'flaming-sphere': {
      if (actor.concentratingOn) return 0;
      const pos = (a.targets[0] as { position: Position }).position;
      const t = Object.values(state.combatants)
        .find((c) => c.alive && !isDown(c) && c.team !== actor.team && adjacent(pos, c.position));
      if (!t) return 0;
      const pFail = saveFailProb(state, t, 'dex', dc);
      const ev = avgDice('2d6') * (pFail + (1 - pFail) * 0.5);
      return damageValue(ev, t) + 5 - slotCost; // +5 ≈ the rolling re-rams
    }
    case 'spiritual-guardians': {
      if (actor.concentratingOn) return 0;
      let v = 0;
      for (const e of Object.values(state.combatants)) {
        if (!e.alive || e.team === actor.team) continue;
        if (distanceFeet(e.position, actor.position) > 15) continue;
        // Real damage, every round anything stands in it.
        v += damageValue(saveFailProb(state, e, 'wis', dc) * avgDice('3d8') * 0.6, e);
      }
      return v - slotCost;
    }
    case 'lightning-bolt': {
      const dir = directionFromDelta(actor.position, (a.targets[0] as { position: Position }).position);
      const sculpt = actor.featureIds.includes('sculpt-spells');
      let v = 0;
      for (const pos of line15(actor.position, dir)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive) continue;
        if (sculpt && t.team === actor.team) continue;
        const pFail = saveFailProb(state, t, 'dex', dc);
        const ev = avgDice('8d6') * (pFail + (1 - pFail) * 0.5);
        v += t.team === actor.team ? -2 * ev : damageValue(ev, t);
      }
      return v - slotCost;
    }
    /**
     * Hex: priced exactly like Hunter's Mark, because it is the same bargain —
     * a bonus action and the caster's concentration for a die on every hit
     * from here on. The one difference is who is casting it: a warlock's beams
     * carry the rider once EACH, so the same spell is worth more in its hands
     * than a single-attack caster's.
     */
    case 'hex': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (!t.alive || isDown(t) || t.conditions.some((k) => k.id === 'hexed')) return 0;
      // Rough expectation of hits still to come: more when the quarry is
      // healthy enough to be hit several times, and nothing at all on something
      // about to die, where the bonus action is better spent elsewhere.
      const hits = Math.min(4, Math.max(1, Math.round(t.hp / 12)));
      const perHit = avgDice('1d6') * eldritchBeams(actor.level);
      const gain = hits * perHit * 0.5 - slotCost;
      if (gain <= 0) return 0;
      // Priced as an ORDERING, exactly like Steady Aim: this is a BONUS action
      // and the spell it improves costs the action, so they are not rivals —
      // but `chooseAction` compares them as if they were. Priced as the bare
      // gain, the warlock blasted first every turn and never got round to the
      // Hex, which is the whole plan of the class.
      let bestOther = 0;
      for (const other of legalActions(state, actor.id)) {
        if (other.kind === 'castSpell' && other.spellId !== 'hex') {
          bestOther = Math.max(bestOther, scoreSpell(state, actor, other));
        } else if (other.kind === 'attack') {
          bestOther = Math.max(bestOther, scoreAttack(state, actor, other));
        }
      }
      return bestOther + gain;
    }
    case 'hunters-mark': {
      if (actor.concentratingOn) return 0;
      // Roughly two rounds of attacks' worth of extra 1d6 hits, discounted for
      // the chance the target dies or the mark breaks before then.
      const expectedHits = actor.attacksPerAction * 2;
      // Through `damageValue` like any other damage: the rider is extra hit
      // points off a specific creature, and the kill bonus applies to it for
      // the same reason it applies to a Fire Bolt.
      const quarry = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId];
      if (!quarry?.alive || isDown(quarry)) return 0;
      return damageValue(avgDice('1d6') * expectedHits * 0.6, quarry) - slotCost;
    }
    case 'fear': {
      if (actor.concentratingOn) return 0;
      const dir = directionFromDelta(actor.position, (a.targets[0] as { position: Position }).position);
      let v = 0;
      for (const pos of cone15(actor.position, dir)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || isDown(t) || t.team === actor.team) continue;
        if (t.conditions.some((k) => k.id === 'frightened')) continue;
        // Priced in hit points, like everything else, rather than on a flat
        // 3.5-per-head scale that no damage spell could ever lose to.
        //
        // Fear does not merely impose disadvantage: a creature caught by it
        // RUNS, and one that reaches the edge is gone. So it is priced closer
        // to Suggestion's outright removal than to Confusion's lost turn —
        // discounted because a save every turn often ends the flight before
        // anybody reaches a door, and because a cone catches several at once,
        // which multiplies whatever this is worth.
        v += saveFailProb(state, t, 'wis', dc) * damageValue(t.hp, t) * 0.45;
      }
      return v - slotCost;
    }
    case 'ray-of-frost': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const p = hitProb(spellAtkBonus, acOf(t), 'flat');
      // Small kiting bonus: slowing a melee-only target buys the caster
      // another turn of distance before it can close again.
      const kiteBonus = t.equipped.mainHand && WEAPONS[t.equipped.mainHand]?.melee !== false ? 1 : 0.3;
      return damageValue(p * avgDice('1d8'), t) + p * kiteBonus;
    }
    // Poison Spray had no case at all, so every caster holding it treated it as
    // worth nothing — a wizard or druid would sooner swing a staff. It is a
    // plain spell-attack cantrip, priced like Ray of Frost without the kiting.
    case 'poison-spray': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const p = hitProb(spellAtkBonus, acOf(t), 'flat');
      return damageValue(p * avgDice(cantripDice('1d12', actor.level)), t);
    }
    // Starry Wisp: a spell-attack cantrip that also lights the target up, so
    // every attack after it lands has advantage.
    case 'starry-wisp': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const p = hitProb(spellAtkBonus, acOf(t), 'flat');
      const lit = t.conditions.some((k) => k.id === 'outlined') ? 0 : 2;
      return damageValue(p * avgDice(cantripDice('1d8', actor.level)), t) + p * lit;
    }
    // Shillelagh: worth a bonus action exactly when the spellcasting ability
    // beats the one the stick would otherwise use — which for a druid (Strength
    // 8, Wisdom 18) is most of the reason it can fight at all.
    case 'shillelagh': {
      if (actor.conditions.some((k) => k.id === 'shillelagh')) return 0;
      const id = actor.equipped.mainHand;
      const w = id ? WEAPONS[id] : undefined;
      if (!w || !(id === 'club' || id === 'quarterstaff')) return 0;
      const normal = abilityMod(actor.abilities[attackAbility(actor, w)]);
      if (castMod <= normal) return 0;
      // Roughly a round's worth of the improvement it buys, so it beats a plain
      // swing on the turn it is cast but never beats an actual heal.
      const gain = (castMod - normal) + (avgDice(shillelaghDamage(actor.level)) - avgDice(w.damage));
      return gain;
    }
    // Find Familiar (wizard ritual, and the druid's Wild Companion): the owl's
    // Help gives advantage on an attack every round it lives. Had no case, so a
    // wizard never conjured one -- the familiar existed only if a player did it.
    case 'find-familiar': {
      if (actor.familiar) return 0;
      const foes = Object.values(state.combatants).filter((c) => c.alive && !isDown(c) && c.team !== actor.team);
      return foes.length > 0 ? 3 : 0;
    }
    case 'acid-splash': {
      const anchor = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(anchor)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || t.team === actor.team) continue;
        v += damageValue(saveFailProb(state, t, 'dex', dc) * avgDice('1d6'), t);
      }
      return v;
    }
    case 'color-spray': {
      const dir = directionFromDelta(actor.position, (a.targets[0] as { position: Position }).position);
      let v = 0;
      for (const pos of cone15(actor.position, dir)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || t.team === actor.team || t.conditions.some((c) => c.id === 'blinded')) continue;
        // Blinded for a turn: it swings at disadvantage and everything swings
        // back at advantage.
        v += denialValue(state, t, saveFailProb(state, t, 'con', dc), 1) * 0.6;
      }
      return v - slotCost;
    }
    case 'false-life': {
      const current = actor.tempHp ?? 0;
      const amount = avgDice('1d4') + 4;
      if (current >= amount) return 0; // wouldn't improve on what's already there
      // A defensive pick, most worth it before the caster has taken a hit.
      // Temporary hit points are hit points: priced as the ward they are,
      // rather than at 40% of face value.
      return (amount - current) * (incomingPerRound(state, actor) > 0 ? 1 : 0) - slotCost;
    }
    case 'inflict-wounds': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(hitProb(spellAtkBonus, acOf(t), 'flat') * avgDice('2d10'), t) - slotCost;
    }
    case 'blindness': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      // Blinded is real but milder than paralysis (no auto-crit): weight below hold-person.
      // Blind: attacks at disadvantage, and everything swings back at
      // advantage. Not a lost turn, so a share of one, for a few of them.
      return denialValue(state, t, saveFailProb(state, t, 'con', dc), 3) * 0.5 - slotCost;
    }
    case 'invisibility': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'hidden')) return 0;
      // Most valuable on a squishy caster who isn't already safe.
      const exposed = nearestEnemyDist(state, t.position, t.team) <= 3;
      // Untargetable while it holds. Worth what would otherwise be coming at
      // them, which is what `rescueValue` measures.
      return incomingPerRound(state, t) * 0.6 * 2 + (exposed ? 2 : 0) - slotCost;
    }
    case 'lesser-restoration': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const WEIGHT: Partial<Record<Id, number>> = { paralyzed: 9, blinded: 4, poisoned: 3 };
      const curable = t.conditions.filter((c) => c.id in WEIGHT);
      if (curable.length === 0) return -slotCost;
      return curable.reduce((s, c) => s + (WEIGHT[c.id] ?? 0), 0) - slotCost;
    }
    case 'dispel-magic': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.team === actor.team) {
        // Freeing an ally from an enemy's concentration debuff.
        const held = t.conditions.filter((c) => c.concentration);
        return held.length > 0 ? held.length * 4 - slotCost : -slotCost;
      }
      // Ending an enemy caster's ongoing spell (Bless, Web, Fear, ...).
      return t.concentratingOn ? 5 - slotCost : -slotCost;
    }
    case 'bane': {
      if (actor.concentratingOn) return 0;
      let v = 0;
      for (const tg of a.targets) {
        const t = state.combatants[(tg as { combatantId: Id }).combatantId]!;
        // -1d4 on every attack and save: about a tenth off what the creature
        // manages, mirroring how Bless is priced from the other side.
        v += denialValue(state, t, saveFailProb(state, t, 'cha', dc), 3) * 0.1;
      }
      return v - slotCost;
    }
    case 'shield-of-faith': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'warded')) return 0;
      // Worth more on a target enemies are already reaching for.
      const threatened = nearestEnemyDist(state, t.position, t.team) <= 2;
      // +2 AC is roughly a tenth of the attacks against them missing instead.
      return incomingPerRound(state, t) * 0.10 * 3 - slotCost;
    }
    // Sanctuary: worth a slot only on someone actually being swung at, and
    // worth nothing on a melee ally who is going to break it themselves on
    // their very next turn.
    case 'sanctuary': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'sanctuary')) return 0;
      const threatened = nearestEnemyDist(state, t.position, t.team) <= 2;
      if (!threatened) return 0;
      const selfBreaking = isMeleeFighter(t) && t.id !== actor.id;
      const hurt = t.hp < t.maxHp / 2 ? 3 : 0;
      return (selfBreaking ? 1 : 5) + hurt - slotCost;
    }
    // Protection from Evil and Good: priced off how much of the damage aimed at
    // this ally actually comes from the six warded types. Against a party of
    // bandits it is worth nothing and should score nothing.
    case 'protection-from-evil-and-good': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'protected')) return 0;
      let warded = 0;
      let total = 0;
      for (const c of Object.values(state.combatants)) {
        if (!c.alive || isDown(c) || c.team === t.team) continue;
        if (distanceFeet(c.position, t.position) > 60) continue;
        total += 1;
        if (c.creatureType !== undefined && PROTECTED_FROM.includes(c.creatureType)) warded += 1;
      }
      if (total === 0 || warded === 0) return 0;
      const threatened = nearestEnemyDist(state, t.position, t.team) <= 2 ? 1.5 : 0.7;
      return 6 * (warded / total) * threatened - slotCost;
    }
    // Warding Bond: the cleric buys the ally's survival with its own hit points,
    // so it is only a good trade while the cleric has more to spare than the
    // ally does. Scored as the ally's halved intake, discounted by how much of
    // the cleric's own cushion it eats.
    case 'warding-bond': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.id === actor.id || t.conditions.some((c) => c.id === 'bonded')) return 0;
      if (actor.hp < actor.maxHp / 2) return 0;      // no cushion left to lend
      if (t.hp > t.maxHp * 0.8 && nearestEnemyDist(state, t.position, t.team) > 2) return 0;
      const frailer = t.hp / t.maxHp < actor.hp / actor.maxHp;
      // Half of everything they take moves to the cleric, plus +1 AC and
      // saves. Priced off what is actually coming at them.
      return incomingPerRound(state, t) * 0.4 * 2 + (frailer ? 3 : 0) - slotCost;
    }
    // Protection from Energy: only worth a 3rd-level slot when something on the
    // board actually deals the element it picks — the spell chooses by reading
    // the room, so the AI asks the same question the spell does.
    case 'protection-from-energy': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'energyWarded')) return 0;
      // Priced off the dice it would actually halve, not a flat guess: one
      // young dragon's cone is worth more than four mephits' puffs, and the
      // spell should only beat Bless when that is true.
      let breath = 0;
      for (const c of Object.values(state.combatants)) {
        if (!c.alive || isDown(c) || c.team === t.team) continue;
        for (const f of c.featureIds) {
          const spec = BREATH_WEAPONS[f];
          if (spec) breath += avgDice(spec.dice);
        }
      }
      if (breath === 0) return 0;   // the fallback element is a guess; don't pay 3rd-level for it
      // Halved, then halved again for the save that already cuts it, and again
      // for the chance this particular ally is in the cone.
      return breath * 0.25 - slotCost;
    }
    // Bestow Curse: a whole-party debuff on one creature, so it is worth most
    // on whatever the party is going to spend several rounds fighting anyway.
    case 'bestow-curse': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'cursed')) return 0;
      const fail = saveFailProb(state, t, 'wis', dc);
      // Scaled by how long they're likely to be around to suffer it.
      // Disadvantage on attacks and saves for the fight: about a quarter of
      // what the creature was going to manage.
      return denialValue(state, t, fail, 4) * 0.25 - slotCost;
    }
    case 'haste': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'hasted')) return 0;
      // Best on a melee ally who can turn the extra attack into real damage;
      // still solid on anyone as +2 AC and a mobility boost.
      const w = t.equipped.mainHand ? WEAPONS[t.equipped.mainHand] : undefined;
      const meleeBonus = w?.melee ? avgDice(w.damage) : 0;
      // Double speed, +2 AC and an extra attack for the rest of the fight.
      // Was a flat 4, which is less than a cantrip.
      void meleeBonus;
      return upliftValue(t, 0.5, 3) - slotCost;
    }
    // --- 4th level ---------------------------------------------------------
    // The tier was unscored entirely, which meant a party's own hints never
    // suggested the best spell it owned. Ice Storm, Banishment and Blight are
    // still unscored — they predate this and are a separate job.
    case 'wall-of-fire': {
      const center = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(center)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive) continue;
        const pFail = saveFailProb(state, t, 'dex', dc);
        const ev = avgDice('5d8') * (pFail + (1 - pFail) * 0.5);
        // The wall burns everyone, so an ally standing in it is a real cost —
        // heavier than Fireball's, because the wall stays there.
        v += t.team === actor.team ? -3 * ev : damageValue(ev, t);
      }
      return v - slotCost;
    }
    case 'confusion': {
      const center = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(center)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || t.team === actor.team) continue;
        if (t.conditions.some((k) => k.id === 'confused')) continue;
        // Confusion is worth more than a turn taken off an enemy, because a
        // confused creature is not merely absent: on 6 of 10 it does nothing,
        // on 2 of 10 it swings at whatever is next to it — and what is next to
        // a creature in a 2x2 patch is usually one of ITS OWN. The 0.35 here
        // was priced against the old implementation, which only ever
        // incapacitated; the extra term is the friendly fire.
        const fail = saveFailProb(state, t, 'wis', dc);
        const friends = Object.values(state.combatants).filter(
          (o) => o.id !== t.id && o.alive && !isDown(o) && o.team === t.team &&
            distanceCells(o.position, t.position) <= 1,
        ).length;
        // 0.2 is the 7-8 slice of the d10, and it is only worth anything when
        // there is somebody in reach to hit — a lone straggler just stands there.
        v += fail * damageValue(t.hp, t) * (0.35 + (friends > 0 ? 0.2 : 0));
      }
      return v - slotCost;
    }
    case 'greater-invisibility': {
      // Worth it on whoever is going to swing next and is in reach of something
      // — advantage on every attack, and nothing can target them back.
      const tid = (a.targets[0] as { combatantId: Id }).combatantId;
      const t = state.combatants[tid]!;
      if (!t.alive || t.conditions.some((k) => k.id === 'veiled')) return 0;
      if (isDown(t)) return 0;
      // Untargetable is worth roughly the damage that would otherwise go into
      // them, bounded by what they have left — saving more hit points than a
      // creature owns is not a thing. Advantage on their own swings is worth
      // about a fifth of a hit each, over a few rounds.
      const shielded = incomingPerRound(state, t) * 0.6 * 3;
      const offence = t.team === actor.team ? t.attacksPerAction * 4 : 0;
      return shielded + offence - slotCost;
    }
    case 'death-ward': {
      // Insurance, and only worth a slot on somebody the fight is actually
      // threatening — on a full-health hero at the back it is a wasted 4th.
      const tid = (a.targets[0] as { combatantId: Id }).combatantId;
      const t = state.combatants[tid]!;
      if (!t.alive || isDown(t) || t.conditions.some((k) => k.id === 'deathWarded')) return 0;
      // What it saves is the whole blow that would have dropped them, plus the
      // turns they would have spent on the floor.
      return rescueValue(t.hp + t.maxHp * 0.25, state, t) - slotCost;
    }
    case 'freedom-of-movement': {
      const tid = (a.targets[0] as { combatantId: Id }).combatantId;
      const t = state.combatants[tid]!;
      if (!t.alive || t.conditions.some((k) => k.id === 'unbound')) return 0;
      // Reactive: it is worth a slot when something is holding them, and
      // nothing much when it is not — this game has no way to know a Web is
      // coming.
      const held = t.conditions.some((k) => k.id === 'restrained' || k.id === 'paralyzed');
      if (!held) return 0;
      // Paralysis is far worse than a web: every melee hit against them crits
      // automatically, so freeing them saves a share of their health rather
      // than a couple of wasted turns.
      const paralyzed = t.conditions.some((k) => k.id === 'paralyzed');
      return rescueValue(paralyzed ? t.hp : t.maxHp * 0.3, state, t) - slotCost;
    }
    // Ice Storm: Fireball's shape one tier up, and the same ally arithmetic.
    // The hail is 2d10 + 4d6 on a Dex save for half; the ice it leaves behind is
    // worth a little on top, but only a little — chilled ground slows whoever
    // walks it, and both sides walk it.
    case 'ice-storm': {
      const center = (a.targets[0] as { position: Position }).position;
      const sculpt = actor.featureIds.includes('sculpt-spells');
      const dice = avgDice(`${2 + Math.max(0, a.slotLevel - 4)}d10`) + avgDice('4d6');
      let v = 0;
      let caught = 0;
      for (const pos of sphere5x5(center)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive) continue;
        if (sculpt && t.team === actor.team) continue;
        const pFail = saveFailProb(state, t, 'dex', dc);
        const ev = dice * (pFail + (1 - pFail) * 0.5);
        if (t.team === actor.team) { v -= 2 * ev; continue; }
        v += damageValue(ev, t);
        caught++;
      }
      return (caught > 0 ? v + 1.5 : v) - slotCost;
    }
    // Shatter: the 2nd-level tier's only area damage, so a caster that cannot
    // score it holds the one spell that answers a clump of goblins.
    case 'shatter': {
      const center = (a.targets[0] as { position: Position }).position;
      const sculpt = actor.featureIds.includes('sculpt-spells');
      const dice = avgDice(`${3 + Math.max(0, a.slotLevel - 2)}d8`);
      let v = 0;
      for (const pos of sphere2x2(center)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive) continue;
        if (sculpt && t.team === actor.team) continue;
        const pFail = saveFailProb(state, t, 'con', dc);
        const ev = dice * (pFail + (1 - pFail) * 0.5);
        v += t.team === actor.team ? -2 * ev : damageValue(ev, t);
      }
      return v - slotCost;
    }
    // Blight: a single enormous save-for-half hit, and no concentration to hold.
    // Worth its slot on something big; wasted on the last two hit points of a
    // goblin, which `damageValue` capping at the target's HP already handles.
    case 'blight': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const pFail = saveFailProb(state, t, 'con', dc);
      const ev = avgDice(`${8 + Math.max(0, a.slotLevel - 4)}d8`) * (pFail + (1 - pFail) * 0.5);
      return damageValue(ev, t) - slotCost;
    }
    // Banishment: Suggestion's shape — a creature removed from the fight is
    // worth roughly what killing it is — but on a Charisma save, and it holds
    // concentration, so it is never worth breaking something else for.
    case 'banishment': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return saveFailProb(state, t, 'cha', dc) * damageValue(t.hp, t) - slotCost;
    }
    // Phantasmal Killer: the damage lands whether or not the save is made, and
    // the fear is the rider. That makes it the 4th-level answer to a single
    // durable target — but it takes concentration for a spell whose main value
    // is damage, so it loses to Blight while something else is already up.
    case 'phantasmal-killer': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const dmg = avgDice(`${4 + Math.max(0, a.slotLevel - 4)}d10`);
      const fear = t.conditions.some((k) => k.id === 'frightened')
        ? 0 : saveFailProb(state, t, 'wis', dc) * 4;
      return damageValue(dmg, t) + fear - slotCost;
    }
    // Mirror Image: three illusions that eat attacks. Only worth an action when
    // something is close enough to swing, and never worth re-casting on top of
    // images that are still standing.
    case 'mirror-image': {
      if ((actor.mirrorImages ?? 0) > 0) return 0;
      const threats = Object.values(state.combatants).filter(
        (c) => c.alive && !isDown(c) && c.team !== actor.team &&
          distanceCells(c.position, actor.position) <= 2,
      ).length;
      if (threats === 0) return 0;
      // Three illusions, each eating an attack outright. Worth roughly three
      // attacks' worth of whatever is standing there.
      return incomingPerRound(state, actor) * 1.0 + threats * 2 - slotCost;
    }
    // Silence: worth exactly as much as the casting it stops, so it is priced
    // off the enemy casters standing in it — and refuses outright if it would
    // gag one of your own. A patch dropped on a pack of goblins with no spells
    // between them is an action and a slot for nothing.
    case 'silence': {
      if (actor.concentratingOn) return 0;
      const center = (a.targets[0] as { position: Position }).position;
      let v = 0;
      for (const pos of sphere2x2(center)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || isDown(t)) continue;
        if (t.team === actor.team) return 0;      // never gag your own casters
        if (!canCastAnything(t)) continue;        // a silenced brute is unbothered
        // A caster that cannot cast is a caster doing nothing much. Priced
        // off its own output rather than a flat six, so gagging an archmage is
        // worth more than gagging a goblin hexer — which is the whole judgement
        // the spell asks for.
        v += denialValue(state, t, 1, 2) * 0.7;
      }
      return v - slotCost;
    }
    // Mage Armor: normally a prep-screen button, but a wizard who skipped it can
    // still spend a 1st-level slot on +3 AC for the fight. Nothing if it is
    // already up, or if there is armour on to begin with — the spell does not
    // stack with either.
    case 'mage-armor': {
      if (actor.mageArmor || actor.equipped.armor !== undefined) return 0;
      // +3 AC for the whole fight, on somebody with no armour at all.
      return incomingPerRound(state, actor) * 0.15 * 3 - slotCost;
    }
    /**
     * Polymorph: priced as what it actually is — a large temporary hit point
     * pool on somebody who is about to lose theirs.
     *
     * The ape's hit points are its own, and when they run out the ally comes
     * back with what they had. So the spell is worth roughly "the ally does not
     * die this fight", and it is worth that most on whoever is closest to
     * dying. On a healthy fighter it is a 4th-level slot to swap a good
     * statblock for a different good statblock.
     */
    case 'polymorph': {
      if (actor.concentratingOn) return 0;
      const tid = (a.targets[0] as { combatantId: Id }).combatantId;
      const t = state.combatants[tid]!;
      // Never on somebody already wearing a body (a druid mid-Wild Shape), and
      // never on a creature that is already down — it is a rescue, not a raise.
      if (!t.alive || isDown(t) || t.wildShape) return 0;
      const hurt = 1 - t.hp / Math.max(1, t.maxHp);
      if (hurt < 0.4) return 0;                 // still healthy: not worth the slot
      /**
       * TWO things, and the first version priced only one of them.
       *
       * The body. `revertShape` puts the original back "with the hit points it
       * had", so the ape's 168 are a whole extra health bar on top of the
       * ally's own — not a replacement for it. Capping the pool at the ally's
       * OWN maximum was therefore wrong twice over: wrong about the rule, and
       * wrong about the quantity (a level-8 fighter's 76). What actually bounds
       * it is how much the room can still deal, so that is the cap.
       *
       * The ape. Two attacks of 3d10 + 6 is about 27 a round on this scale,
       * better than most of the party — and it was worth zero here. Polymorph
       * is not a ward, it is a ward that also hits people, and the second half
       * is most of why anyone casts it.
       *
       * Measured before this: on a board where a Fireball catches three orcs,
       * Polymorph scored 49 on a half-dead fighter and 64 on a nearly-dead one
       * against the Fireball's 69 — so it lost at EVERY hit-point level and was
       * cast 11 times in 20,578 arena fights.
       */
      const incoming = incomingPerRound(state, t);
      const soak = Math.min(APE_HP, incoming * POLYMORPH_ROUNDS);
      /**
       * What the ally would have contributed WITHOUT the spell — which is
       * nothing at all if the next round takes them off the board.
       *
       * This is the term that makes Polymorph a rescue rather than a buff. On a
       * fighter one hit from dropping, the ape is not worth "27 a round minus
       * what the fighter was already doing"; it is worth the whole 27, because
       * the alternative is a body on the floor. Pricing it as the difference in
       * output — which is what a plain uplift does — quietly assumes the ally
       * lives either way, and that assumption is exactly wrong in the situation
       * the spell exists for.
       */
      const wouldSurvive = t.hp > incoming;
      const without = wouldSurvive ? outputPerRound(t) : 0;
      const gain = Math.max(0, APE_OUTPUT - without) * POLYMORPH_ROUNDS;
      return rescueValue(soak, state, t) + gain - slotCost;
    }
    /**
     * Conjure Animals: the pack lands where you put it, then hunts by itself.
     *
     * Priced like Call Lightning and Moonbeam — everything it catches now, plus
     * a fair expectation of the rounds still to come — because that is what it
     * is: a thing that keeps happening while concentration holds. The multiplier
     * is higher than either of theirs because the pack CHASES; a beam or a
     * cloud only hits what walks back into it, while the animals go and find
     * somebody, so a placement that catches nothing this turn is still worth
     * something next turn.
     *
     * The save avoids the damage entirely rather than halving it, so the whole
     * expectation is `pFail * dice` with no floor under it. That is what makes
     * it worth less against nimble things than the raw dice suggest.
     */
    case 'conjure-animals': {
      if (actor.concentratingOn) return 0;
      const anchor = (a.targets[0] as { position: Position }).position;
      const dice = avgDice(`${3 + Math.max(0, a.slotLevel - 3)}d10`);
      let v = 0;
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || isDown(t)) continue;
        if (distanceFeet(anchor, t.position) > 10) continue;
        // Real animals, and they do not pick sides once they are loose — but
        // the pack only ever mauls the caster's enemies, so an ally standing
        // in the landing zone costs nothing and is not counted either way.
        if (t.team === actor.team) continue;
        v += damageValue(saveFailProb(state, t, 'dex', dc) * dice, t);
      }
      // Even a pack that lands on nobody will run somebody down next turn, so
      // it is never worth zero while there is anything left to hunt.
      const anyPrey = Object.values(state.combatants).some(
        (t) => t.alive && !isDown(t) && t.team !== actor.team);
      if (!anyPrey) return 0;
      return Math.max(v * 1.6, dice * 0.4) - slotCost;
    }
    // Dimension Door is deliberately unscored. Valuing a teleport means valuing
    // a POSITION, and every cheap proxy ("get away from things") makes a caster
    // that runs from fights it was winning. A player can see the board; this
    // cannot, yet.

    default:
      return 0;
  }
}

/** Does this combatant prefer to fight up close? */
function isMeleeFighter(c: Combatant): boolean {
  if (c.classId === 'fighter' || c.classId === 'rogue' || c.classId === 'cleric' || c.classId === 'paladin') return true;
  if (c.classId === 'wizard' || c.classId === 'ranger' || c.classId === 'bard') return false;
  // A druid fights up close when it has a body or a stick for it: Wild Shape
  // puts it in a beast, and Shillelagh turns its staff into the best weapon it
  // owns (Wisdom to hit, a d10 by level 5). Without one of those it is a caster
  // and stays back — which is why Shillelagh did nothing at first: the spell
  // landed and the AI still kept its distance, so the staff was never swung.
  if (c.classId === 'druid') {
    return c.wildShape !== undefined || c.conditions.some((k) => k.id === 'shillelagh');
  }
  // Monsters: charge if they carry any pure-melee weapon (no ranged profile).
  return attackableWeapons(c).some((w) => {
    const weapon = WEAPONS[w];
    return !!weapon && weapon.melee && weapon.range === undefined;
  });
}

function nearestEnemyDist(state: GameState, from: Position, team: Combatant['team']): number {
  let best = Infinity;
  for (const c of Object.values(state.combatants)) {
    // Skipping the downed matters: standing next to a body otherwise reads as
    // "already engaged", so there's no gradient toward the enemy still fighting
    // and the unit paces on the spot until the round limit.
    if (c.alive && !isDown(c) && c.team !== team) best = Math.min(best, distanceCells(from, c.position));
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
      (c) => c.alive && !isDown(c) && c.team !== actor.team && adjacent(c.position, actor.position),
    ) ? 5 : 0;
  }
  if (a.featureId === 'rage') {
    // Rage is worth a bonus action the moment a fight is actually happening,
    // and worth nothing at all otherwise: it lasts the whole encounter, so
    // entering it a round early costs a turn of nothing and entering it late
    // costs every swing in between. "An enemy is within a turn's reach" is the
    // line — and the pool is the day's, so an AI that rages at shadows spends
    // its whole day in the first fight.
    if (actor.conditions.some((c) => c.id === 'raging')) return 0;
    const reach = actor.speed / 5 + 1;
    const near = Object.values(state.combatants).some(
      (c) => c.alive && !isDown(c) && c.team !== actor.team &&
             distanceCells(actor.position, c.position) <= reach,
    );
    return near ? 6 : 0;
  }
  if (a.featureId === 'reckless-attack') {
    // Free, and pure upside on the turns you are going to swing anyway — the
    // cost is landing on the enemy team's turn, which is worth paying while
    // healthy and not worth it while nearly down. Rage's damage resistance
    // moves that line, which is why the threshold reads off `raging`.
    if (actor.conditions.some((c) => c.id === 'reckless')) return 0;
    const adjacent = Object.values(state.combatants).some(
      (c) => c.alive && !isDown(c) && c.team !== actor.team &&
             distanceCells(actor.position, c.position) <= 1,
    );
    if (!adjacent) return 0;
    const floor = actor.conditions.some((c) => c.id === 'raging') ? 0.3 : 0.5;
    return actor.hp > actor.maxHp * floor ? 3 : 0;
  }
  // The monk's three techniques, all drawing on one pool — so the scores are
  // relative to each other, not just to zero. Without these an auto-played monk
  // never spends a focus point, and the pool IS the class.
  if (a.featureId === 'flurry-of-blows') {
    // Two unarmed strikes: worth roughly what the bonus-action attack it
    // replaces is worth, twice, and only if something is in reach to hit.
    const foe = Object.values(state.combatants).find(
      (c) => c.alive && !isDown(c) && c.team !== actor.team && adjacent(c.position, actor.position),
    );
    if (!foe) return 0;
    return 2 * (avgDice(actor.level >= 5 ? '1d8' : '1d6') + abilityMod(actor.abilities.dex));
  }
  if (a.featureId === 'stunning-strike') {
    // Taking a turn off a live enemy is worth more than damage, and worth most
    // against the biggest thing still standing — but only when it might fail,
    // which is what stops it being spent on a kobold with two hit points.
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.wis);
    const best = Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
        adjacent(c.position, actor.position) && !c.conditions.some((k) => k.id === 'stunned'))
      .sort((x, y) => y.hp - x.hp)[0];
    if (!best || best.hp < 8) return 0;
    return saveFailProb(state, best, 'con', dc) * damageValue(best.hp, best) * 0.5;
  }
  if (a.featureId === 'patient-defense') {
    // Defensive, so only when it is buying something: hurt, and in reach of
    // something that will swing back.
    if (actor.hp > actor.maxHp * 0.5) return 0;
    const threatened = Object.values(state.combatants).some(
      (c) => c.alive && !isDown(c) && c.team !== actor.team && adjacent(c.position, actor.position),
    );
    return threatened ? 3 : 0;
  }
  if (a.featureId === 'step-of-the-wind') {
    // Closing ground, and only when there is ground to close.
    return nearestEnemyDist(state, actor.position, actor.team) > 3 ? 1.5 : 0;
  }
  if (a.featureId === 'cunning-disengage') {
    // Escape melee before repositioning; mirrors the disengage-action logic.
    return nearestEnemyDist(state, actor.position, actor.team) === 1 && actor.hp < actor.maxHp / 2 ? 1.5 : 0;
  }
  if (a.featureId === 'cunning-dash') {
    return nearestEnemyDist(state, actor.position, actor.team) > 7 ? 0.8 : 0;
  }
  /**
   * Steady Aim: worth taking exactly when it turns Sneak Attack on.
   *
   * It is not a generic "+advantage is nice" buff — it costs the rogue its
   * movement, so a rogue that still needs to close is worse off for taking it.
   * The value is the Sneak Attack dice it unlocks, and it unlocks nothing when
   * an ally is already adjacent to the target (that qualifies on its own) or
   * when the rogue has already sneak-attacked this turn.
   */
  if (a.featureId === 'steady-aim') {
    if (actor.turn.sneakAttackUsed || actor.turn.movementUsed > 0) return 0;
    // Something has to be shootable from where the rogue already stands, or the
    // bonus action is spent standing still for nothing.
    const shootable = attackableWeapons(actor).some((w) =>
      Object.values(state.combatants).some(
        (t) => t.alive && !isDown(t) && t.team !== actor.team && canAttackWith(state, actor, w, t.id),
      ));
    if (!shootable) return 0;
    // Already advantaged from somewhere else (hidden, a prone target, Faerie
    // Fire) — Steady Aim would buy nothing and cost the movement anyway.
    const alreadyAdvantaged = isHidden(actor) ||
      actor.conditions.some((k) => k.id === 'inspired' || k.id === 'aiming');
    if (alreadyAdvantaged) return 0;
    // Priced as an ORDERING, not as an alternative.
    //
    // `chooseAction` picks one best action at a time and re-evaluates, so it
    // weighs this bonus action against the attack — but they are not rivals:
    // Steady Aim costs a bonus action and the attack costs the action, and
    // taking the two in that order is strictly better than the attack alone.
    // Priced as the bare gain, the AI shot first every time and then found
    // Steady Aim worthless (Sneak Attack already spent), so the feature fired
    // literally never. So the score is "the best attack available, plus what
    // aiming adds to it" — which is what the pair is actually worth, and beats
    // the attack on its own by exactly the margin aiming provides.
    const gain = avgDice(FEATURES['sneak-attack']!.advantageDice!(actor.level)) * 0.5;
    let bestAttack = 0;
    for (const w of attackableWeapons(actor)) {
      for (const t of Object.values(state.combatants)) {
        if (!t.alive || isDown(t) || t.team === actor.team) continue;
        if (!canAttackWith(state, actor, w, t.id)) continue;
        bestAttack = Math.max(bestAttack, scoreAttack(state, actor, { kind: 'attack', weaponId: w, targetId: t.id }));
      }
    }
    return bestAttack + gain;
  }
  if (a.featureId === 'cunning-hide' || a.featureId === 'nimble-hide') {
    return actor.turn.actionUsed ? 1.2 : 0.8;
  }
  if (a.featureId === 'turn-undead') {
    // Removing an undead outright is worth more than killing it — full unit
    // gone, no HP left to chew through — so value each in-range undead like a
    // lethal hit (remaining HP + kill bonus), weighted by its Wis-save odds.
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.wis);
    return Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
        c.creatureType === 'undead' && distanceFeet(actor.position, c.position) <= 30)
      .reduce((s, c) => s + saveFailProb(state, c, 'wis', dc) * damageValue(c.hp, c), 0);
  }
  if (a.featureId === 'preserve-life') {
    const pool = 5 * actor.level;
    const healable = Object.values(state.combatants)
      .filter((c) => c.alive && c.team === actor.team && c.hp < Math.floor(c.maxHp / 2))
      .reduce((s, c) => s + Math.min(Math.floor(c.maxHp / 2) - c.hp, pool), 0);
    return Math.min(healable, pool) * 1.2;
  }
  // Area restrain-on-failed-save (water elemental Whelm, gorgon Petrifying
  // Breath): value each unrestrained enemy in range like a soft lockdown,
  // weighted by its odds of failing.
  if (a.featureId === 'whelm' || a.featureId === 'petrifying-breath') {
    const ability = a.featureId === 'whelm' ? 'str' : 'con';
    const range = a.featureId === 'whelm' ? 5 : 15;
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities[ability]);
    return Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
        distanceFeet(actor.position, c.position) <= range &&
        !c.conditions.some((k) => k.id === 'restrained'))
      .reduce((s, c) => s + saveFailProb(state, c, ability, dc) * 3, 0);
  }
  // Whirlwind (air elemental): 3d8 to each adjacent enemy, half on a save.
  if (a.featureId === 'whirlwind') {
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.str);
    const dmg = avgDice('3d8');
    return Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
        distanceFeet(actor.position, c.position) <= 5)
      .reduce((s, c) => {
        const fail = saveFailProb(state, c, 'str', dc);
        return s + fail * dmg + (1 - fail) * dmg / 2;
      }, 0);
  }
  // Charms (dryad Fey Charm — nearest foe; harpy Luring Song — all in 30 ft).
  // Worth a *share* of the target's remaining hit points, not all of it: these
  // no longer remove anyone. A charmed hero still fights everyone but the
  // charmer, and a lured one is walking toward the singer with a fresh save
  // every turn. Pricing them as kills had the AI spend a once-per-fight action
  // on an effect the target can shrug off next turn.
  if (a.featureId === 'fey-charm' || a.featureId === 'luring-song' || a.featureId === 'charm') {
    const worth = a.featureId === 'luring-song' ? 0.5 : 0.35;
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.cha);
    let foes = Object.values(state.combatants).filter(
      (c) => c.alive && !isDown(c) && c.team !== actor.team &&
        distanceFeet(actor.position, c.position) <= 30,
    );
    if (a.featureId === 'fey-charm') {
      foes = foes.sort((x, y) => distanceFeet(actor.position, x.position) - distanceFeet(actor.position, y.position)).slice(0, 1);
    }
    return foes.reduce((s, c) => s + saveFailProb(state, c, 'wis', dc) * damageValue(c.hp, c) * worth, 0);
  }
  // Fey Invisibility (sprite/green hag): turn hidden for the attack bonus.
  if (a.featureId === 'fey-invisibility') {
    return actor.conditions.some((c) => c.id === 'hidden') ? 0 : 1.5;
  }
  // Dragon breath: aim the cone/line the feature would, and value the damage
  // (half on a save) summed over the enemies it catches — a big AoE the AI
  // should spend eagerly whenever it lands on someone.
  const breath = BREATH_WEAPONS[a.featureId];
  if (breath) {
    const dir = bestBreathDirection(state, actor, a.featureId);
    if (!dir) return 0;
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.con);
    const cells = breath.shape === 'line' ? line15(actor.position, dir, breath.length) : cone15(actor.position, dir);
    let v = 0;
    for (const pos of cells) {
      const occ = cellAt(state.grid, pos)?.occupantId;
      if (!occ) continue;
      const t = state.combatants[occ]!;
      if (!t.alive || isDown(t) || t.team === actor.team) continue;
      const pFail = saveFailProb(state, t, breath.save, dc);
      const ev = avgDice(breath.dice) * (pFail + (1 - pFail) * 0.5);
      v += damageValue(ev, t);
    }
    return v;
  }
  // Consume Life (will-o'-wisp): drain the nearest adjacent enemy — 3d8 necrotic
  // (half on a save) plus a self-heal of the damage dealt. Worth more when the
  // wisp is hurt, since the heal is then real rather than wasted overflow.
  if (a.featureId === 'consume-life') {
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.con);
    const target = Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team && distanceFeet(actor.position, c.position) <= 5)
      .sort((x, y) => distanceFeet(actor.position, x.position) - distanceFeet(actor.position, y.position))[0];
    if (!target) return 0;
    const fail = saveFailProb(state, target, 'con', dc);
    const dmg = avgDice('3d8') * (fail + (1 - fail) * 0.5);
    const heal = Math.min(dmg, actor.maxHp - actor.hp);
    return damageValue(dmg, target) + heal;
  }
  // Dreadful Glare (mummy): frighten the nearest enemy (paralyze on a big fail),
  // save-ends. Value it like a soft lockdown weighted by fail odds and the
  // target's threat — a little richer than Fear, since it can escalate.
  if (a.featureId === 'dreadful-glare') {
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.cha);
    const target = Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
        distanceFeet(actor.position, c.position) <= 60 &&
        !c.conditions.some((k) => k.id === 'frightened' || k.id === 'paralyzed'))
      .sort((x, y) => distanceFeet(actor.position, x.position) - distanceFeet(actor.position, y.position))[0];
    if (!target) return 0;
    return saveFailProb(state, target, 'wis', dc) * (5 + target.hp / 4);
  }
  // Engulf (gelatinous cube): swallow one adjacent enemy — 3d6 acid now and
  // again every turn it holds them. Priced as the immediate damage plus a
  // turn's worth of digestion on top, which is the honest floor: it holds for
  // at least one tick unless the very first repeat save gets them out.
  if (a.featureId === 'engulf') {
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.str);
    const target = Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
        distanceFeet(actor.position, c.position) <= 5 &&
        !c.conditions.some((k) => k.id === 'restrained'))
      .sort((x, y) => x.hp - y.hp)[0];
    if (!target) return 0;
    return saveFailProb(state, target, 'dex', dc) * (damageValue(avgDice('3d6') * 2, target) + 3);
  }
  // Wild Shape: worth most when there is nothing left to cast. A druid with
  // slots in hand is a better caster than it is a wolf, so the shape is priced
  // as what you do when the spells run out — or when something is already on
  // top of you and casting is the worse option anyway.
  if (a.featureId === 'wild-shape') {
    if (actor.wildShape) return 0;          // stepping back out is the player's call
    const foes = Object.values(state.combatants).filter(
      (c) => c.alive && !isDown(c) && c.team !== actor.team,
    );
    if (foes.length === 0) return 0;
    const slots = actor.spellSlots.reduce((sum, p) => sum + p.current, 0);
    const cornered = nearestEnemyDist(state, actor.position, actor.team) <= 1;
    if (slots > 0 && !cornered) return 0;
    return actor.level + (cornered ? 2 : 0);
  }
  // Bardic Inspiration: a d6 for an ally, worth roughly what a d6 is worth on
  // a roll that matters — more when there is someone in the fight to spend it.
  // Priced modestly so it never beats an actual heal on a dying ally.
  if (a.featureId === 'bardic-inspiration') {
    const takers = Object.values(state.combatants).filter(
      (c) => c.alive && !isDown(c) && c.team === actor.team && c.id !== actor.id &&
        distanceFeet(actor.position, c.position) <= 60 &&
        !c.conditions.some((k) => k.id === 'inspiring'),
    );
    if (takers.length === 0) return 0;
    // Worth more while there is still a fight left to spend it in.
    const foes = Object.values(state.combatants).filter((c) => c.alive && !isDown(c) && c.team !== actor.team);
    return foes.length > 0 ? 3 : 0;
  }
  // Horrifying Visage (banshee): frighten everyone within 60 ft, save-ends.
  // Same soft-lockdown pricing as Dreadful Glare, summed over the whole room.
  if (a.featureId === 'horrifying-visage') {
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.cha);
    return Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
        distanceFeet(actor.position, c.position) <= 60 &&
        !c.conditions.some((k) => k.id === 'frightened'))
      .reduce((s, c) => s + saveFailProb(state, c, 'wis', dc) * (4 + c.hp / 6), 0);
  }
  // Wail (banshee): a failed Constitution save inside 30 ft takes that creature
  // out of the fight entirely, so a failure is worth its whole remaining HP; a
  // success is just 3d6 psychic. One use, so it should fire when it catches the
  // most people — which summing over targets in range already encourages.
  if (a.featureId === 'wail') {
    const dc = 8 + proficiencyBonus(actor.level) + abilityMod(actor.abilities.cha);
    return Object.values(state.combatants)
      .filter((c) => c.alive && !isDown(c) && c.team !== actor.team &&
        c.creatureType !== 'construct' && c.creatureType !== 'undead' &&
        distanceFeet(actor.position, c.position) <= 30)
      .reduce((s, c) => {
        const fail = saveFailProb(state, c, 'con', dc);
        return s + fail * c.hp + (1 - fail) * damageValue(avgDice('3d6'), c);
      }, 0);
  }
  if (a.featureId === 'lay-on-hands') {
    const pool = actor.featureUses['lay-on-hands']?.current ?? 0;
    if (pool <= 0) return 0;
    const target = Object.values(state.combatants)
      .filter((c) => c.alive && c.team === actor.team && c.hp < c.maxHp &&
        (c.id === actor.id || adjacent(actor.position, c.position)))
      .sort((a2, b2) => a2.hp / a2.maxHp - b2.hp / b2.maxHp)[0];
    if (!target) return 0;
    const missing = target.maxHp - target.hp;
    const heal = Math.min(pool, missing);
    return heal * (missing >= target.maxHp / 2 ? 1.4 : 0.6);
  }
  if (a.featureId === 'sacred-weapon') return 3;
  return 0;
}

function scoreItem(state: GameState, actor: Combatant, a: Action & { kind: 'useItem' }): number {
  const item = ITEMS[a.itemId];
  if (!item) return 0;
  const targets = a.targets ?? [];
  // A conjuration is worth roughly the body it puts on the board: hit points
  // that soak, and a turn's damage every round. Read off the summoned
  // creature's own stats rather than the item's name, so the next summoning
  // item is priced without touching this.
  if (item.summons) {
    const beast = MONSTERS[item.summons];
    if (!beast) return 0;
    // Discounted hard: an ally that arrives mid-fight has fewer rounds left to
    // spend than one that started, and it cannot be healed or repositioned by
    // anything the policy plans.
    return (beast.hp + 4 * monsterLevel(beast.cr)) * 0.35;
  }
  switch (item.targeting.kind) {
    case 'ally':
    case 'self': {
      // Healing potions: value by urgency, like Cure Wounds.
      const tid = targets[0] && 'combatantId' in targets[0] ? targets[0].combatantId : actor.id;
      const t = state.combatants[tid]!;
      const missing = t.maxHp - t.hp;
      if (missing < t.maxHp / 2) return 0;
      const heal = Math.min(avgDice(a.itemId === 'potion-greater-healing' ? '4d4+4' : '2d4+2'), missing);
      return heal * 1.2;
    }
    case 'thrown': {
      const tid = targets[0] && 'combatantId' in targets[0] ? targets[0].combatantId : undefined;
      if (!tid) return 0;
      const t = state.combatants[tid]!;
      const bonus = abilityMod(actor.abilities.dex) + proficiencyBonus(actor.level);
      // Consumable: only worth throwing when a real weapon isn't clearly better.
      return damageValue(hitProb(bonus, acOf(t), 'flat') * avgDice('1d4'), t) - 1;
    }
    case 'spell': {
      // Score the scroll as if casting the spell (no slot cost — it's the item).
      const pseudo: Action = {
        kind: 'castSpell', spellId: item.targeting.spellId,
        slotLevel: SPELLS[item.targeting.spellId]!.level, targets,
      };
      if (pseudo.kind !== 'castSpell') return 0;
      return scoreSpell(state, actor, pseudo) - 1; // consumables are precious
    }
  }
}

const END_TURN_THRESHOLD = 0.5;

/**
 * How much worse than the best spell another spell may be and still get picked.
 *
 * THE PROBLEM THIS SOLVES
 *
 * `chooseAction` is a hard argmax, so a caster in a given situation casts the
 * same spell every single time. Over 40,000 casts the histogram is a very short
 * head and a very long thin tail: five spells account for most of it, and a
 * dozen playable ones are never chosen at all — not because they are bad, but
 * because something else out-scores them by a fraction in every situation the
 * arena generates.
 *
 * WHY A BAND AND NOT A TEMPERATURE
 *
 * A softmax over all scores would sometimes pick a spell the scorer thinks is
 * genuinely bad, and this codebase already has evidence that costs win rate:
 * the sim AI's common-random-numbers variant "measurably weakened play in the
 * arena" and was reverted. Randomness is only free where the scores are CLOSE.
 * So: gather the spells within a margin of the best and choose among them
 * uniformly. A spell scoring half as much is never chosen, however many times
 * the dice are rolled.
 *
 * The margin is FRACTIONAL, not absolute. Scores here range from about 3 for a
 * cantrip to over 100 for a Fireball on a packed room, so "within 2 points"
 * means "anything at all" at the top and "nothing" at the bottom.
 *
 * Applies to spells only. That is what varies interestingly; a random *move* is
 * just a worse move.
 */
let spellVarietyMargin = 0.15;

/** For measurement: set 0 to restore the old hard argmax. */
export function setSpellVariety(fraction: number): void {
  spellVarietyMargin = Math.max(0, fraction);
}
export function spellVariety(): number {
  return spellVarietyMargin;
}

/**
 * A deterministic roll that does NOT consume the game's RNG stream.
 *
 * `chooseAction` is a pure chooser — the caller applies the action afterwards —
 * and it can legitimately be called twice on the same state (a UI preview, a
 * re-render). Advancing `state.rng` here would make the second call differ from
 * the first and would desynchronise replays. Deriving a value from the current
 * state instead means the same board always produces the same choice, which is
 * what a seeded game requires, while still differing between boards.
 */
function stableRoll(state: GameState, actorId: Id, salt: number): number {
  let h = (state.rng ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < actorId.length; i++) h = (Math.imul(h, 33) ^ actorId.charCodeAt(i)) >>> 0;
  h = (Math.imul(h ^ state.round, 2654435761) ^ salt) >>> 0;
  return next(h).value;
}

/** Pick the best action for the current combatant. Returns endTurn when done. */
/**
 * What this scorer thinks one cast is worth, in hit points.
 *
 * Exported for tests only — nothing in the game calls it, because the AI always
 * scores a whole legal-action list rather than one action. It exists so that a
 * Metamagic option that is deliberately NOT enumerated (Heightened) can still
 * be shown to price higher than the plain cast: without it, the one line in
 * `saveFailProb` that makes the bend real would be unverifiable.
 */
export function scoreCastForTest(state: GameState, actor: Combatant, a: Action & { kind: 'castSpell' }): number {
  return scoreSpell(state, actor, a);
}

export function chooseAction(state: GameState, actorId: Id): Action {
  const actor = state.combatants[actorId]!;
  const actions = legalActions(state, actorId);
  let best: Action = { kind: 'endTurn' };
  let bestScore = END_TURN_THRESHOLD;
  // Stalemate breaker: a unit boxed in by walls/allies may only be able to
  // shave the gap to the nearest enemy by a single cell per move — scoreMove
  // rates that ~0.4, under the 0.5 end-turn bar, so without this it just
  // stands still forever (two such units can deadlock a whole battle). Track
  // the best strictly-positive closing/repositioning move on the side, and
  // fall back to it only when nothing else — attack, spell, feature, dash,
  // anything — cleared the normal bar either.
  let fallbackMove: Action | undefined;
  let fallbackMoveScore = 0;
  // Kept so a near-best spell can be chosen instead of the single best one.
  const spellScores: Array<{ action: Action; score: number }> = [];

  for (const a of actions) {
    let s = 0;
    switch (a.kind) {
      case 'attack': s = scoreAttack(state, actor, a); break;
      case 'castSpell':
        s = scoreSpell(state, actor, a);
        if (s > END_TURN_THRESHOLD) spellScores.push({ action: a, score: s });
        break;
      case 'move':
        s = scoreMove(state, actor, a.to);
        if (s > fallbackMoveScore) { fallbackMoveScore = s; fallbackMove = a; }
        break;
      case 'useFeature': s = scoreFeature(state, actor, a); break;
      case 'useItem': s = scoreItem(state, actor, a); break;
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
      case 'hide':
        s = !actions.some((x) => x.kind === 'attack' || x.kind === 'castSpell') ? 0.7 : 0;
        break;
      case 'shakeAwake': s = 2; break;
      case 'endTurn': continue;
    }
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  // Spell variety: when the chosen action is a spell, pick uniformly among the
  // spells that scored within the margin of it rather than always the maximum.
  // Only ever swaps one spell for another spell — never for a move, an attack
  // or ending the turn — so the shape of the turn is unchanged.
  if (best.kind === 'castSpell' && spellVarietyMargin > 0 && spellScores.length > 1) {
    const cutoff = bestScore - Math.abs(bestScore) * spellVarietyMargin;
    const near = spellScores.filter((x) => x.score >= cutoff);
    if (near.length > 1) {
      const r = stableRoll(state, actorId, near.length);
      return near[Math.min(near.length - 1, Math.floor(r * near.length))]!.action;
    }
  }
  if (best.kind === 'endTurn' && fallbackMove) return fallbackMove;
  return best;
}
