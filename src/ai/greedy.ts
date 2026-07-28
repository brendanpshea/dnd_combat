/**
 * Greedy AI: scores every legal action by expected value and plays the best
 * one, ending its turn when nothing worthwhile remains. Pure function of
 * state — no engine backdoors, exactly the Action API the CLI uses.
 */
import type { GameState, Id, Combatant, Position } from '../engine/types.js';
import { isDown, isIncapacitated } from '../engine/types.js';
import { abilityMod, proficiencyBonus, cellAt } from '../engine/types.js';
import { parseDice } from '../engine/dice.js';
import { WEAPONS } from '../data/weapons.js';
import { SPELLS, spellDc, cantripDice, wearsMetal, canBePutToSleep } from '../data/spells.js';
import { MONSTERS, monsterLevel } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { acOf } from '../data/armor.js';
import { attackableWeapons } from '../engine/rules/equipment.js';
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
  const spell = SPELLS[a.spellId]!;
  const dc = spellDc(state, actor.id);
  const castMod = abilityMod(actor.abilities[actor.spellcastingAbility ?? 'int']);
  const spellAtkBonus = castMod + proficiencyBonus(actor.level);
  // Preserve limited slots a little: leveled spells carry a small cost.
  const slotCost = spell.level >= 1 ? 2 : 0;

  switch (a.spellId) {
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
        v += saveFailProb(state, t, 'str', dc) * 4;
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
      return 3 * a.targets.length + (state.round <= 2 ? 3 : 0) - slotCost;
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
      let v = avgDice(smiteDice(a.spellId, a.slotLevel));
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
        v += 4 + t.hp / 10;
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
      return saveFailProb(state, t, 'wis', dc) * (6 + t.hp / 2) - slotCost;
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
        v += t.team === actor.team ? -8 * p : p * (6 + t.maxHp / 3);
      }
      return v - slotCost;
    }
    case 'guiding-bolt': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      const p = hitProb(spellAtkBonus, acOf(t), 'flat');
      return damageValue(p * avgDice('4d6'), t) + p * 2 - slotCost; // rider bonus
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
      return saveFailProb(state, t, 'wis', dc) * (5 + t.hp / 4) - slotCost;
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
        v += saveFailProb(state, t, 'dex', dc) * 5; // restrain value per enemy
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
        v += saveFailProb(state, e, 'wis', dc) * avgDice('3d8') * 0.6; // damage over the next turns
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
    case 'hunters-mark': {
      if (actor.concentratingOn) return 0;
      // Roughly two rounds of attacks' worth of extra 1d6 hits, discounted for
      // the chance the target dies or the mark breaks before then.
      const expectedHits = actor.attacksPerAction * 2;
      return avgDice('1d6') * expectedHits * 0.6 - slotCost;
    }
    case 'fear': {
      if (actor.concentratingOn) return 0;
      const dir = directionFromDelta(actor.position, (a.targets[0] as { position: Position }).position);
      let v = 0;
      for (const pos of cone15(actor.position, dir)) {
        const occ = cellAt(state.grid, pos)?.occupantId;
        if (!occ) continue;
        const t = state.combatants[occ]!;
        if (!t.alive || t.team === actor.team) continue;
        v += saveFailProb(state, t, 'wis', dc) * 3.5;
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
        v += saveFailProb(state, t, 'con', dc) * 4; // one turn of disadvantage-out/advantage-in
      }
      return v - slotCost;
    }
    case 'false-life': {
      const current = actor.tempHp ?? 0;
      const amount = avgDice('1d4') + 4;
      if (current >= amount) return 0; // wouldn't improve on what's already there
      // A defensive pick, most worth it before the caster has taken a hit.
      return (amount - current) * 0.4 - slotCost;
    }
    case 'inflict-wounds': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      return damageValue(hitProb(spellAtkBonus, acOf(t), 'flat') * avgDice('2d10'), t) - slotCost;
    }
    case 'blindness': {
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      // Blinded is real but milder than paralysis (no auto-crit): weight below hold-person.
      return saveFailProb(state, t, 'con', dc) * (5 + t.hp / 5) - slotCost;
    }
    case 'invisibility': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'hidden')) return 0;
      // Most valuable on a squishy caster who isn't already safe.
      const exposed = nearestEnemyDist(state, t.position, t.team) <= 3;
      return (exposed ? 5 : 2.5) - slotCost;
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
        v += saveFailProb(state, t, 'cha', dc) * 3;
      }
      return v - slotCost;
    }
    case 'shield-of-faith': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'warded')) return 0;
      // Worth more on a target enemies are already reaching for.
      const threatened = nearestEnemyDist(state, t.position, t.team) <= 2;
      return (threatened ? 3.5 : 1.5) - slotCost;
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
      return (frailer ? 6 : 2.5) + (isMeleeFighter(t) ? 2 : 0) - slotCost;
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
      return fail * (4 + t.hp / 8) - slotCost;
    }
    case 'haste': {
      if (actor.concentratingOn) return 0;
      const t = state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      if (t.conditions.some((c) => c.id === 'hasted')) return 0;
      // Best on a melee ally who can turn the extra attack into real damage;
      // still solid on anyone as +2 AC and a mobility boost.
      const w = t.equipped.mainHand ? WEAPONS[t.equipped.mainHand] : undefined;
      const meleeBonus = w?.melee ? avgDice(w.damage) : 0;
      return 4 + meleeBonus - slotCost;
    }
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
  if (a.featureId === 'cunning-disengage') {
    // Escape melee before repositioning; mirrors the disengage-action logic.
    return nearestEnemyDist(state, actor.position, actor.team) === 1 && actor.hp < actor.maxHp / 2 ? 1.5 : 0;
  }
  if (a.featureId === 'cunning-dash') {
    return nearestEnemyDist(state, actor.position, actor.team) > 7 ? 0.8 : 0;
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

/** Pick the best action for the current combatant. Returns endTurn when done. */
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

  for (const a of actions) {
    let s = 0;
    switch (a.kind) {
      case 'attack': s = scoreAttack(state, actor, a); break;
      case 'castSpell': s = scoreSpell(state, actor, a); break;
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
  if (best.kind === 'endTurn' && fallbackMove) return fallbackMove;
  return best;
}
