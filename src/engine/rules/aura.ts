/**
 * Monster auras (SRD 5.2.1): the emanations a stat block carries all the time.
 *
 * Two hooks, one per shape of aura (see `MonsterAura`): `ownerTurnEndAuras`
 * runs from endTurn as the owner's turn closes, and `turnStartAuras` from
 * startTurn as each creature's turn opens, beside Spirit Guardians — which is
 * the same rule cast as a spell.
 *
 * Not modelled: the fire elemental setting creatures alight (there is no
 * burning condition to put on them), and the aboleth's Mucus Cloud, which only
 * works underwater and whose curse is about breathing.
 */
import type { Combatant, GameState, Id, MonsterAura } from '../types.js';
import { isDown, isIncapacitated } from '../types.js';
import { distanceFeet } from '../grid.js';
import { rollDice } from '../dice.js';
import type { GameEvent } from '../events.js';
import { savingThrow } from './saves.js';
import { applyDamage } from './attack.js';
import { applyCondition } from './conditions.js';

/** Whether `owner`'s `aura` reaches `target` right now. */
function inAura(owner: Combatant, aura: MonsterAura, target: Combatant): boolean {
  if (target.id === owner.id || !target.alive || isDown(target)) return false;
  if (aura.choice && target.team === owner.team) return false;
  return distanceFeet(owner.position, target.position) <= aura.radius;
}

/** Whether `owner`'s auras are live: it is up, and not stopped by incapacitation. */
function auraLive(owner: Combatant, aura: MonsterAura): boolean {
  if (!owner.alive || isDown(owner)) return false;
  return !(aura.stopsWhenIncapacitated && isIncapacitated(owner));
}

/** One creature's turn in `aura`: the save, if any, then damage and condition. */
function suffer(state: GameState, owner: Combatant, aura: MonsterAura, target: Combatant): GameEvent[] {
  const events: GameEvent[] = [];
  let failed = true;
  if (aura.save) {
    const save = savingThrow(state, target.id, aura.save.ability, aura.save.dc, { magical: false });
    events.push(save.event);
    failed = !save.success;
    if (save.success && aura.immuneOnSuccess) {
      target.auraImmuneTo = [...(target.auraImmuneTo ?? []), owner.id];
    }
  }
  if (aura.damage && failed) {
    const dmg = rollDice(state.rng, aura.damage.dice);
    state.rng = dmg.state;
    events.push(...applyDamage(state, target.id, owner.id, dmg.total, aura.damage.type, dmg.rolls,
      { magical: false }));
  }
  if (aura.condition && failed && target.alive) {
    events.push(...applyCondition(state, target.id, {
      id: aura.condition, sourceId: owner.id, endsAtTurnStartOf: target.id,
    }, { magical: false }));
  }
  return events;
}

/** The auras that burn as their owner's turn ends (Fire Aura, Heat Aura). */
export function ownerTurnEndAuras(state: GameState, ownerId: Id): GameEvent[] {
  const owner = state.combatants[ownerId];
  if (!owner?.auras) return [];
  const events: GameEvent[] = [];
  for (const aura of owner.auras) {
    if (aura.when !== 'ownerTurnEnd' || !auraLive(owner, aura)) continue;
    for (const target of Object.values(state.combatants)) {
      if (inAura(owner, aura, target)) events.push(...suffer(state, owner, aura, target));
    }
  }
  return events;
}

/** The auras that bite a creature starting its turn near their owner (Stench). */
export function turnStartAuras(state: GameState, targetId: Id): GameEvent[] {
  const target = state.combatants[targetId];
  if (!target) return [];
  const events: GameEvent[] = [];
  for (const owner of Object.values(state.combatants)) {
    if (!owner.auras || target.auraImmuneTo?.includes(owner.id)) continue;
    for (const aura of owner.auras) {
      if (aura.when !== 'targetTurnStart' || !auraLive(owner, aura)) continue;
      if (inAura(owner, aura, target)) events.push(...suffer(state, owner, aura, target));
      if (!target.alive) return events;
    }
  }
  return events;
}
