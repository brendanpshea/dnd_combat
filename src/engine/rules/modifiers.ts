/**
 * Story boons and banes: modifiers a fight's setup carries for the whole fight
 * (`CombatSetup.modifiers`, `FightModifier` in types.ts).
 *
 * The lamp that keeps the dead down should matter in the fight with the dead.
 * A story earns or suffers these, and the fight applies them through the
 * machinery it already has rather than through special cases:
 *
 *   - advantage and disadvantage are named sources on the roll, read where
 *     every other source is read (collectAttackSources, savingThrow,
 *     rollSkill), so they cancel against the rest the usual way and the log
 *     says why;
 *   - a starting condition goes on through applyCondition, so immunities hold;
 *   - suppressed resistances, immunities and regeneration are taken off the
 *     creature's own lists at the start (and off anything conjured later),
 *     so the damage rules need no new branch;
 *   - extra damage is a rider on a weapon hit, as a bane weapon's is;
 *   - sunlight and running water switch on the weaknesses a stat block carries
 *     (`Combatant.weaknesses`): disadvantage read here, the damage they do in
 *     rules/boons.ts.
 *
 * This module is the pure half — who a modifier reaches, what it adds to a
 * roll, and the log line — and imports nothing but types, so the attack and
 * save rules can read it without a cycle. Putting the starting effects on is
 * rules/boons.ts.
 */
import type { Ability, Combatant, CreatureType, DamageType, FightModifier, GameState, ModifierTarget } from '../types.js';
import { cellAt } from '../types.js';

/** Whether `target` reaches `c`: every field given must match. */
export function reaches(target: ModifierTarget, c: Combatant): boolean {
  if (target.team !== undefined && c.team !== target.team) return false;
  if (target.id !== undefined && c.id !== target.id) return false;
  if (target.monster !== undefined && c.classId !== target.monster) return false;
  if (target.creatureType !== undefined) {
    const types = Array.isArray(target.creatureType) ? target.creatureType : [target.creatureType];
    if (c.creatureType === undefined || !types.includes(c.creatureType)) return false;
  }
  return true;
}

/** The fight says `c` stands in sunlight (a 'sunlight' modifier reaches it). */
export function inSunlight(state: GameState, c: Combatant): boolean {
  return (state.modifiers ?? []).some((m) => m.effect.kind === 'sunlight' && reaches(m.target, c));
}

/** `c` stands in the board's water, and the fight says that water runs. */
export function inRunningWater(state: GameState, c: Combatant): boolean {
  return cellAt(state.grid, c.position)?.water === true &&
    (state.modifiers ?? []).some((m) => m.effect.kind === 'runningWater' && reaches(m.target, c));
}

/** The rolls a modifier can tilt: `c`'s attack rolls, attack rolls against `c`,
 *  `c`'s saving throws and its ability checks. */
export type ModifiedRoll = 'attack' | 'attacked' | 'save' | 'check';

/**
 * Advantage and disadvantage the fight's modifiers give one roll, each named
 * by its source ("the vigil lamp") for the log. `ability` is the save's or the
 * check's, for a modifier that names one.
 */
export function modifierSources(
  state: GameState, c: Combatant, on: ModifiedRoll, ability?: Ability,
): { adv: string[]; dis: string[] } {
  const adv: string[] = [];
  const dis: string[] = [];
  for (const m of state.modifiers ?? []) {
    const e = m.effect;
    if ((e.kind !== 'advantage' && e.kind !== 'disadvantage') || e.on !== on) continue;
    if (e.ability !== undefined && e.ability !== ability) continue;
    if (!reaches(m.target, c)) continue;
    (e.kind === 'advantage' ? adv : dis).push(m.source);
  }
  // A sunlight weakness, in the sun: disadvantage on attack rolls and ability
  // checks (Sunlight Sensitivity), and on saving throws too where it is every
  // D20 Test (the shadow's Sunlight Weakness).
  const sun = c.weaknesses?.sunlight;
  if (sun && on !== 'attacked' && (on !== 'save' || sun.disadvantage === 'd20Tests') && inSunlight(state, c)) {
    dis.push('sunlight');
  }
  return { adv, dis };
}

/** Extra damage the fight's modifiers add to `attacker`'s weapon hit on `target`. */
export function extraDamageOn(
  state: GameState, attacker: Combatant, target: Combatant,
): Array<{ dice: string; type: DamageType; source: string }> {
  const out: Array<{ dice: string; type: DamageType; source: string }> = [];
  for (const m of state.modifiers ?? []) {
    const e = m.effect;
    if (e.kind !== 'extraDamage' || !reaches(m.target, target)) continue;
    // From `by`, or from the target's enemies: the blessing is on the party's
    // blades, not on a confused ogre's club swinging at its own side.
    if (e.by ? !reaches(e.by, attacker) : attacker.team === target.team) continue;
    out.push({ dice: e.dice, type: e.type, source: m.source });
  }
  return out;
}

/**
 * Take what the fight's `suppress` modifiers switch off from `c`'s own lists:
 * its resistances (both kinds), immunities, regeneration. Run on everyone at
 * the start, and on anything conjured mid-fight (summonCombatant), so a ghoul
 * called up by a lair action under the lamp is under the lamp too.
 *
 * Only the stat block's own: Rage's resistance and Protection from Energy are
 * conditions, and a story that wants those gone wants something else.
 */
export function applySuppression(state: GameState, c: Combatant): void {
  for (const m of state.modifiers ?? []) {
    const e = m.effect;
    if (e.kind !== 'suppress' || !reaches(m.target, c)) continue;
    const keep = (t: DamageType) => e.types !== undefined && !e.types.includes(t);
    if (e.what === 'resistance') {
      c.resistances = c.resistances.filter(keep);
      if (c.resistNonmagical) c.resistNonmagical = c.resistNonmagical.filter(keep);
    } else if (e.what === 'immunity') {
      c.immunities = c.immunities.filter(keep);
    } else {
      delete c.regeneration;
    }
  }
}

// --- The log line ------------------------------------------------------------

const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const TYPE_PLURALS: Record<CreatureType, string> = {
  humanoid: 'humanoids', beast: 'beasts', undead: 'undead', giant: 'giants', construct: 'constructs',
  fiend: 'fiends', dragon: 'dragons', elemental: 'elementals', fey: 'fey', monstrosity: 'monstrosities',
  ooze: 'oozes', aberration: 'aberrations', celestial: 'celestials', plant: 'plants',
};

function list(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** Who a target names, and whether it reads as one ("the party has") or many. */
function whoOf(state: GameState, t: ModifierTarget): { who: string; one: boolean } {
  if (t.id !== undefined) return { who: state.combatants[t.id]?.name ?? t.id, one: true };
  if (t.monster !== undefined) return { who: `the ${t.monster.replace(/-/g, ' ')}s`, one: false };
  if (t.creatureType !== undefined) {
    const types = Array.isArray(t.creatureType) ? t.creatureType : [t.creatureType];
    return { who: `the ${list(types.map((k) => TYPE_PLURALS[k]))}`, one: false };
  }
  if (t.team !== undefined) return t.team === 'team1' ? { who: 'the party', one: true } : { who: 'the foes', one: false };
  return { who: 'everyone', one: true };
}

/**
 * The line a modifier is logged with when the story gives none:
 * "The vigil lamp: the undead have disadvantage on attack rolls."
 */
export function describeModifier(state: GameState, m: FightModifier): string {
  const { who, one } = whoOf(state, m.target);
  const verb = (singular: string, plural: string) => (one ? singular : plural);
  const e = m.effect;
  let what: string;
  switch (e.kind) {
    case 'advantage':
    case 'disadvantage':
      if (e.on === 'attacked') {
        what = `attack rolls against ${who} have ${e.kind}`;
        break;
      }
      what = `${who} ${verb('has', 'have')} ${e.kind} on ${
        e.on === 'attack' ? 'attack rolls'
          : e.on === 'save' ? `${e.ability ? `${ABILITY_NAMES[e.ability]} ` : ''}saving throws`
            : `${e.ability ? `${ABILITY_NAMES[e.ability]} ` : ''}ability checks`}`;
      break;
    case 'condition': {
      const start = `start${one ? 's' : ''} the fight ${e.condition}`;
      what = e.save
        ? `${who} must make a DC ${e.save.dc} ${ABILITY_NAMES[e.save.ability]} saving throw or ${start.replace(/^starts/, 'start')}`
        : `${who} ${start}`;
      break;
    }
    case 'suppress': {
      const noun = e.what === 'resistance'
        ? (e.types ? 'resistance' : 'resistances')
        : (e.types ? 'immunity' : 'immunities');
      what = e.what === 'regeneration'
        ? `${who} cannot regenerate`
        : `${who} ${verb('loses', 'lose')} ${verb('its', 'their')} ${noun}${e.types ? ` to ${list(e.types)}` : ''}`;
      break;
    }
    case 'extraDamage':
      what = `weapon hits on ${who} deal an extra ${e.dice} ${e.type} damage`;
      break;
    case 'tempHp':
      what = `${who} ${verb('gains', 'gain')} ${e.amount} temporary hit points`;
      break;
    case 'sunlight':
      what = Object.keys(m.target).length === 0 ? 'the fight is in sunlight' : `${who} ${verb('stands', 'stand')} in sunlight`;
      break;
    case 'runningWater':
      what = 'the water here runs';
      break;
  }
  const source = m.source.charAt(0).toUpperCase() + m.source.slice(1);
  return `${source}: ${what}.`;
}
