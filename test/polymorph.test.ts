/**
 * Polymorph: an ally becomes a giant ape.
 *
 * WHY ALLY ONLY
 *
 * Cast on an enemy it is strictly worse than two spells the same caster already
 * has. Banishment and Suggestion both route through `charmAway`, which takes a
 * creature off the board for good — a fight here is shorter than the minute
 * those spells last, so in practice they are permanent removal. Polymorph is
 * *reverting* removal: turn the ogre into a frog, somebody pops the frog, and
 * the ogre is back at full health. It opens no new save axis either, since
 * Suggestion is already a Wisdom save. An enemy-target version would be a trap
 * for the player and would never be chosen by the AI.
 *
 * On an ally it is something this game has no other version of: a large
 * temporary hit point pool wrapped around a fresh statblock.
 *
 * THE THREE WAYS IT ENDS
 *
 * The ape's hit points running out, the caster losing concentration, and the
 * fight ending. Each restores the original body, and the first two are the ones
 * that can be got wrong — a form that outlives its concentration is a free
 * 168-point buffer.
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import { breakConcentration, dropToZero } from '../src/engine/rules/attack.js';
import { legalActions } from '../src/engine/actions.js';
import { renderEvent } from '../src/ui/cli/renderer.js';
import type { Combatant } from '../src/engine/types.js';

const APE = MONSTERS['giant-ape']!;

function fight() {
  const caster: Combatant = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 7 });
  const ally: Combatant = { ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 1, y: 0 }, level: 7 }), id: 'ally' };
  const foe = { ...buildMonster('orc', 'team2', { x: 6, y: 6 }), id: 'foe' };
  const c = new Combat({ combatants: [caster, ally, foe], seed: 5 });
  let guard = 0;
  while (c.activeId !== caster.id && guard++ < 30) c.apply({ kind: 'endTurn' });
  return { c, casterId: caster.id, allyId: 'ally' };
}

function cast(c: Combat, casterId: string, allyId: string) {
  return c.apply({ kind: 'castSpell', spellId: 'polymorph', slotLevel: 4, targets: [{ combatantId: allyId }] });
}

describe('Polymorph targets allies only', () => {
  it('is an ally-targeting spell', () => {
    const t = SPELLS.polymorph!.targeting as { who?: string };
    expect(t.who).toBe('ally');
  });

  it('is on the wizard and druid 4th-level lists', () => {
    for (const id of ['wizard', 'druid']) {
      const l7 = CLASSES[id]!.spellcasting!.spellsByLevel[7] ?? [];
      expect(l7, id).toContain('polymorph');
    }
  });
});

describe('becoming the ape', () => {
  it('takes the ape\'s statblock and the ape\'s hit points', () => {
    const { c, casterId, allyId } = fight();
    const before = c.state.combatants[allyId]!.maxHp;
    cast(c, casterId, allyId);
    const ape = c.state.combatants[allyId]!;
    expect(ape.maxHp).toBe(APE.hp);
    expect(ape.hp).toBe(APE.hp);
    expect(ape.attacksPerAction).toBe(APE.attacksPerAction ?? 1);
    expect(ape.speed).toBe(APE.speed);
    expect(ape.abilities.str).toBe(APE.abilities.str);
    expect(ape.equipped.mainHand).toBe(APE.weaponIds[0]);
    // The pool is the beast's OWN, not a bonus on top — the difference between
    // Polymorph and a big heal.
    expect(ape.maxHp).not.toBe(before);
    expect(ape.wildShape?.original.hp).toBe(before > 0 ? c.state.combatants[allyId]!.wildShape!.original.hp : 0);
  });

  it('costs the caster its concentration', () => {
    const { c, casterId, allyId } = fight();
    cast(c, casterId, allyId);
    expect(c.state.combatants[casterId]!.concentratingOn?.spellId).toBe('polymorph');
  });

  it('leaves the player swinging as the ape, not casting as a fighter', () => {
    // "Play as the ape" is the request, and an ape casts nothing. Without this
    // the player keeps every button they had and merely gains 168 hit points.
    const { c, casterId, allyId } = fight();
    cast(c, casterId, allyId);
    expect(c.state.combatants[allyId]!.spellIds).toEqual([]);
    // Walk the turn round to the ape and check what it is offered.
    let guard = 0;
    while (c.activeId !== allyId && guard++ < 30) c.apply({ kind: 'endTurn' });
    const actions = legalActions(c.state, allyId);
    expect(actions.some((a) => a.kind === 'castSpell')).toBe(false);
    const weapons = new Set(actions.flatMap((a) => (a.kind === 'attack' ? [a.weaponId] : [])));
    // Whatever it can reach, it reaches with fists.
    for (const w of weapons) expect(w).toBe(APE.weaponIds[0]);
  });

  it('refuses to stack on a body already being worn', () => {
    // A second cast must not re-snapshot the APE as the "original" body, which
    // would strand the fighter as an ape permanently — reverting would hand
    // back the ape's own statblock.
    //
    // Driven through the spell's `cast` rather than through `Combat.apply`,
    // because the action economy stops a second cast on the same turn and would
    // make this pass without ever reaching the guard.
    const { c, casterId, allyId } = fight();
    cast(c, casterId, allyId);
    const fighterHp = c.state.combatants[allyId]!.wildShape!.original.maxHp;
    c.state.combatants[allyId]!.hp = 20;      // hurt the ape
    SPELLS.polymorph!.cast!({
      state: c.state, casterId, slotLevel: 4, targetIds: [allyId], positions: [],
    });
    expect(c.state.combatants[allyId]!.wildShape!.original.maxHp).toBe(fighterHp);
    expect(c.state.combatants[allyId]!.hp, 'a second cast must not top the ape up').toBe(20);
  });
});

describe('the three ways it ends', () => {
  it('reverts when the ape runs out of hit points, without downing the hero', () => {
    // The whole spell. If this dropped the hero it would be a 4th-level slot
    // spent to kill your own fighter.
    const { c, casterId, allyId } = fight();
    const originalHp = c.state.combatants[allyId]!.hp;
    cast(c, casterId, allyId);
    c.state.combatants[allyId]!.hp = 0;
    dropToZero(c.state, allyId);
    const back = c.state.combatants[allyId]!;
    expect(back.wildShape).toBeUndefined();
    expect(back.hp).toBe(originalHp);
    expect(back.alive).toBe(true);
    expect(back.conditions.some((k) => k.id === 'unconscious')).toBe(false);
    // …and the caster is no longer holding it.
    expect(c.state.combatants[casterId]!.concentratingOn).toBeUndefined();
  });

  it('reverts when the caster loses concentration', () => {
    // Otherwise the form is a free 168-point buffer that nothing can remove,
    // which is the version of this spell nobody should ship.
    const { c, casterId, allyId } = fight();
    const originalHp = c.state.combatants[allyId]!.hp;
    cast(c, casterId, allyId);
    breakConcentration(c.state, casterId);
    const back = c.state.combatants[allyId]!;
    expect(back.wildShape).toBeUndefined();
    expect(back.hp).toBe(originalHp);
    expect(back.maxHp).not.toBe(APE.hp);
  });

  it('gives the character back everything it took', () => {
    const { c, casterId, allyId } = fight();
    const before = c.state.combatants[allyId]!;
    const snapshot = {
      speed: before.speed, str: before.abilities.str, mainHand: before.equipped.mainHand,
      attacks: before.attacksPerAction, spells: [...before.spellIds], maxHp: before.maxHp,
    };
    cast(c, casterId, allyId);
    breakConcentration(c.state, casterId);
    const after = c.state.combatants[allyId]!;
    expect(after.speed).toBe(snapshot.speed);
    expect(after.abilities.str).toBe(snapshot.str);
    expect(after.equipped.mainHand).toBe(snapshot.mainHand);
    expect(after.attacksPerAction).toBe(snapshot.attacks);
    expect(after.spellIds).toEqual(snapshot.spells);
    expect(after.maxHp).toBe(snapshot.maxHp);
  });
});

/**
 * What the log SAYS about a Polymorph, which is not what it used to say.
 *
 * Found by playing the game rather than by a test: the combat log read
 *
 *     Vivian the Cold shifts into the shape of a giant ape! (+0 temp HP)
 *     Vivian the Cold is shielded.
 *
 * Neither line was true. Wild Shape hands a druid the beast's hit points as
 * TEMPORARY ones and the line is right for it; Polymorph replaces the creature
 * outright (`t.maxHp = beast.hp`), so its event carries `tempHp: 0` and the
 * line announced a 168-point health bar as nothing at all. And the `shielded`
 * condition was emitted as an event but never pushed onto the target, so the
 * log promised +5 AC that no roll ever saw.
 *
 * A log line that reports an effect the game does not have is worse than no
 * line, because a player plans around it.
 */
describe('the log tells the truth about a Polymorph', () => {
  it('does not claim a shield nobody gets', () => {
    const { c, casterId, allyId } = fight();
    const events = cast(c, casterId, allyId);
    expect(events.some((e) => e.type === 'conditionApplied' && e.condition === 'shielded')).toBe(false);
    expect(c.state.combatants[allyId]!.conditions.some((k) => k.id === 'shielded')).toBe(false);
  });

  it('reads as a transformation rather than "+0 temp HP"', () => {
    const { c, casterId, allyId } = fight();
    const events = cast(c, casterId, allyId);
    const shaped = events.find((e) => e.type === 'wildShaped')!;
    const line = renderEvent(c.state, shaped, { tagTeams: false });
    expect(line).not.toContain('temp HP');
    expect(line).toContain('giant ape');
    // And the body really is there, which is what the line is describing.
    expect(c.state.combatants[allyId]!.maxHp).toBe(APE.hp);
  });
});
