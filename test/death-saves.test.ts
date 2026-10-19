import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter, buildParty } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { applyDamage, rollDeathSave, resolveAttack } from '../src/engine/rules/attack.js';
import { applyHealing } from '../src/engine/rules/heal.js';
import { legalActions, step } from '../src/engine/actions.js';
import { isDown, isDying } from '../src/engine/types.js';
import { seedRng } from '../src/engine/rng.js';
import { rollD20 } from '../src/engine/dice.js';
import { chooseAction } from '../src/ai/greedy.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';
import type { Combatant, Position, GameState } from '../src/engine/types.js';
import type { GameEvent } from '../src/engine/events.js';

/**
 * Death saving throws (SRD 5.2.1, "Dropping to 0 Hit Points", lines ~829-851),
 * the opt-in `rules.deathSaves`. Off, nothing changes: test/downed.test.ts.
 */

const pc = (classId: string, team: 'team1' | 'team2', position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team, position, level: 3 }), id });

const fight = (...units: Combatant[]) =>
  new Combat({ seed: 4, mapId: 'open', combatants: units, rules: { deathSaves: true } });

/** An RNG state whose next d20 is `natural`. */
function rngFor(natural: number): number {
  for (let seed = 1; seed < 100_000; seed++) {
    if (rollD20(seedRng(seed), 'flat').natural === natural) return seedRng(seed);
  }
  throw new Error(`no seed rolls ${natural}`);
}

function dropped(): Combat {
  const c = fight(
    pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'),
    pc('cleric', 'team1', { x: 4, y: 3 }, 'cle'),
    { ...buildMonster('ogre', 'team2', { x: 3, y: 4 }), id: 'ogre' },
  );
  const ftr = c.state.combatants['ftr']!;
  applyDamage(c.state, 'ftr', 'ogre', ftr.hp + 1, 'bludgeoning', [], { magical: false });
  return c;
}

const saveEvents = (events: GameEvent[]) => events.filter((e) => e.type === 'deathSave');

describe('dropping to 0 under the death-save rule', () => {
  it('is dying, with a fresh tally', () => {
    const c = dropped();
    const ftr = c.state.combatants['ftr']!;
    expect(isDown(ftr)).toBe(true);
    expect(isDying(c.state, ftr)).toBe(true);
    expect(ftr.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it('dies outright when the damage left over is at least its hit point maximum (Massive Damage)', () => {
    const c = fight(pc('fighter', 'team1', { x: 0, y: 0 }, 'ftr'), pc('wizard', 'team2', { x: 7, y: 7 }, 'foe'));
    const ftr = c.state.combatants['ftr']!;
    ftr.hp = 5;
    applyDamage(c.state, 'ftr', 'foe', 5 + ftr.maxHp, 'slashing', [], { magical: false });
    expect(ftr.alive).toBe(false);
    expect(ftr.deathSaves?.failures).toBe(3);
  });

  it('only drops when the remainder is a point short', () => {
    const c = fight(pc('fighter', 'team1', { x: 0, y: 0 }, 'ftr'), pc('wizard', 'team2', { x: 7, y: 7 }, 'foe'));
    const ftr = c.state.combatants['ftr']!;
    ftr.hp = 5;
    applyDamage(c.state, 'ftr', 'foe', 5 + ftr.maxHp - 1, 'slashing', [], { magical: false });
    expect(ftr.alive).toBe(true);
    expect(isDown(ftr)).toBe(true);
  });

  it('Relentless Endurance does not save a creature killed outright', () => {
    const orc = { ...buildCharacter({ classId: 'fighter', speciesId: 'orc', team: 'team1', position: { x: 0, y: 0 }, level: 3 }), id: 'orc' };
    const c = fight(orc, pc('wizard', 'team2', { x: 7, y: 7 }, 'foe'));
    const o = c.state.combatants['orc']!;
    expect(o.featureUses['relentless-endurance']?.current).toBe(1);
    applyDamage(c.state, 'orc', 'foe', o.hp + o.maxHp, 'slashing', [], { magical: false });
    expect(o.alive).toBe(false);
  });

  it('a monster still simply dies', () => {
    const c = dropped();
    applyDamage(c.state, 'ogre', 'ftr', 999, 'slashing', [], { magical: false });
    expect(c.state.combatants['ogre']!.alive).toBe(false);
  });
});

describe('damage while dying', () => {
  it('is one failure, two from a critical hit, death at three', () => {
    const c = dropped();
    const ftr = c.state.combatants['ftr']!;
    applyDamage(c.state, 'ftr', 'ogre', 3, 'bludgeoning', [], { magical: false });
    expect(ftr.deathSaves?.failures).toBe(1);
    applyDamage(c.state, 'ftr', 'ogre', 3, 'bludgeoning', [], { magical: false, crit: true });
    expect(ftr.alive).toBe(false);
    expect(ftr.deathSaves?.failures).toBe(3);
  });

  it('kills outright when it equals the hit point maximum', () => {
    const c = dropped();
    const ftr = c.state.combatants['ftr']!;
    applyDamage(c.state, 'ftr', 'ogre', ftr.maxHp, 'bludgeoning', [], { magical: false });
    expect(ftr.alive).toBe(false);
  });

  it('one hit is one failure, however many damage types it carries', () => {
    const c = dropped();
    const ftr = c.state.combatants['ftr']!;
    applyDamage(c.state, 'ftr', 'ogre', 2, 'piercing', [], { magical: false });
    applyDamage(c.state, 'ftr', 'ogre', 2, 'poison', [], { magical: false, rider: true });
    expect(ftr.deathSaves?.failures).toBe(1);
  });

  it('a melee hit on the body is a critical hit, and two failures', () => {
    const c = dropped();
    const ogre = c.state.combatants['ogre']!;
    ogre.abilities.str = 30;   // cannot miss but on a 1
    let rolled = false;
    for (let seed = 1; seed < 50 && !rolled; seed++) {
      const s: GameState = structuredClone(c.state);
      s.rng = seedRng(seed);
      const events = resolveAttack(s, 'ogre', 'ftr', 'ogre-greatclub');
      const roll = events.find((e) => e.type === 'attackRolled');
      if (roll?.type !== 'attackRolled' || !roll.hit) continue;
      rolled = true;
      expect(roll.crit).toBe(true);
      expect(s.combatants['ftr']!.deathSaves?.failures).toBe(2);
    }
    expect(rolled).toBe(true);
  });

  it('ends Stable', () => {
    const c = dropped();
    const ftr = c.state.combatants['ftr']!;
    ftr.deathSaves = { successes: 0, failures: 0, stable: true };
    expect(isDying(c.state, ftr)).toBe(false);
    applyDamage(c.state, 'ftr', 'ogre', 1, 'bludgeoning', [], { magical: false });
    expect(ftr.deathSaves).toEqual({ successes: 0, failures: 1 });
    expect(isDying(c.state, ftr)).toBe(true);
  });
});

describe('the death saving throw', () => {
  const rollWith = (natural: number, before?: { successes: number; failures: number }) => {
    const c = dropped();
    if (before) c.state.combatants['ftr']!.deathSaves = { ...before };
    c.state.rng = rngFor(natural);
    const events = rollDeathSave(c.state, 'ftr');
    return { c, ftr: c.state.combatants['ftr']!, events };
  };

  it('10 or higher is a success; three make it Stable, with the tally reset', () => {
    const { ftr, events } = rollWith(14, { successes: 2, failures: 1 });
    expect(events.some((e) => e.type === 'stabilized')).toBe(true);
    expect(ftr.deathSaves).toEqual({ successes: 0, failures: 0, stable: true });
    expect(isDown(ftr)).toBe(true);
  });

  it('below 10 is a failure, a 1 is two, and the third kills', () => {
    expect(rollWith(9).ftr.deathSaves?.failures).toBe(1);
    expect(rollWith(1).ftr.deathSaves?.failures).toBe(2);
    const { ftr, events } = rollWith(1, { successes: 2, failures: 1 });
    expect(ftr.alive).toBe(false);
    expect(events.some((e) => e.type === 'died')).toBe(true);
  });

  it('a 20 brings it round with 1 HP, still prone, the tally gone', () => {
    const { ftr } = rollWith(20, { successes: 1, failures: 2 });
    expect(ftr.hp).toBe(1);
    expect(ftr.deathSaves).toBeUndefined();
    const ids = ftr.conditions.map((k) => k.id);
    expect(ids).not.toContain('unconscious');
    expect(ids).toContain('prone');
  });
});

describe('a dying hero in the turn order', () => {
  const turnOf = (c: Combat, id: string) => {
    let guard = 0;
    while (c.activeId !== id && !c.isOver() && guard++ < 20) c.apply({ kind: 'endTurn' });
  };

  it('rolls as its turn comes round, without being handed an empty turn', () => {
    const c = dropped();
    let saves = 0;
    for (let i = 0; i < 9 && !c.isOver(); i++) {
      const events = c.apply({ kind: 'endTurn' });
      saves += saveEvents(events).length;
      // Only a natural 20 hands it a turn, and then it is no longer down.
      if (events.some((e) => e.type === 'turnStarted' && e.combatantId === 'ftr')) {
        expect(isDown(c.state.combatants['ftr']!)).toBe(false);
      }
      if (!c.state.combatants['ftr']!.alive || !isDying(c.state, c.state.combatants['ftr']!)) break;
    }
    expect(saves).toBeGreaterThan(0);
  });

  it('rolls once a round', () => {
    const c = dropped();
    c.state.combatants['ftr']!.deathSaves = { successes: 0, failures: 0 };
    const start = c.state.round;
    let saves = 0;
    while (c.state.round < start + 2 && !c.isOver()) {
      const ftr = c.state.combatants['ftr']!;
      if (!isDying(c.state, ftr)) break;
      saves += saveEvents(c.apply({ kind: 'endTurn' })).length;
    }
    expect(saves).toBeLessThanOrEqual(2);
    expect(saves).toBeGreaterThanOrEqual(1);
  });

  it('can be attacked; off the rule it cannot', () => {
    const c = dropped();
    turnOf(c, 'ogre');
    const at = (state: GameState) => legalActions(state, 'ogre')
      .filter((a) => a.kind === 'attack').map((a) => (a as { targetId: string }).targetId);
    expect(at(c.state)).toContain('ftr');
    const off: GameState = { ...structuredClone(c.state) };
    delete off.rules;
    expect(at(off)).not.toContain('ftr');
  });
});

describe('stabilising', () => {
  it('an ally next to it can try a DC 10 Medicine check, as an action', () => {
    const c = dropped();
    let guard = 0;
    while (c.activeId !== 'cle' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const aid = legalActions(c.state, 'cle').find((a) => a.kind === 'stabilize');
    expect(aid).toEqual({ kind: 'stabilize', targetId: 'ftr' });
    let stable = false;
    for (let seed = 1; seed < 40 && !stable; seed++) {
      const s: GameState = structuredClone(c.state);
      s.rng = seedRng(seed);
      const r = step(s, aid!);
      const check = r.events.find((e) => e.type === 'firstAid');
      expect(check).toBeDefined();
      if (check?.type === 'firstAid' && check.success) {
        stable = true;
        expect(r.state.combatants['ftr']!.deathSaves?.stable).toBe(true);
        expect(r.state.combatants['cle']!.turn.actionUsed).toBe(true);
      }
    }
    expect(stable).toBe(true);
  });

  it('Spare the Dying makes it Stable — and is only offered for the dying', () => {
    const c = dropped();
    let guard = 0;
    while (c.activeId !== 'cle' && guard++ < 20) c.apply({ kind: 'endTurn' });
    const spare = legalActions(c.state, 'cle').find((a) => a.kind === 'castSpell' && a.spellId === 'spare-the-dying');
    expect(spare).toBeDefined();
    const r = step(c.state, spare!);
    expect(r.state.combatants['ftr']!.deathSaves?.stable).toBe(true);
    expect(legalActions(r.state, 'cle').some((a) => a.kind === 'castSpell' && a.spellId === 'spare-the-dying')).toBe(false);
  });

  it('healing resets the tally and wakes it, but leaves it prone', () => {
    const c = dropped();
    const ftr = c.state.combatants['ftr']!;
    ftr.deathSaves = { successes: 1, failures: 2 };
    applyHealing(c.state, 'ftr', 'cle', 5);
    expect(ftr.deathSaves).toBeUndefined();
    expect(ftr.conditions.map((k) => k.id)).toEqual(['prone']);
  });
});

describe('the AI and the dying', () => {
  it('greedy goes for a creature still standing before a body', () => {
    const c = fight(
      pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'),
      pc('fighter', 'team1', { x: 4, y: 4 }, 'mate'),
      { ...buildMonster('ogre', 'team2', { x: 4, y: 3 }), id: 'ogre' },
    );
    applyDamage(c.state, 'ftr', 'ogre', c.state.combatants['ftr']!.hp, 'bludgeoning', [], { magical: false });
    let guard = 0;
    while (c.activeId !== 'ogre' && guard++ < 20) c.apply({ kind: 'endTurn' });
    if (!isDown(c.state.combatants['ftr']!)) return;   // a natural 20 on the way round
    const a = chooseAction(c.state, 'ogre');
    expect(a.kind === 'attack' ? a.targetId : a.kind).toBe('mate');
  });

  it('greedy finishes a body when nobody standing is in reach', () => {
    const c = fight(
      pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'),
      pc('wizard', 'team1', { x: 0, y: 7 }, 'wiz'),
      { ...buildMonster('ogre', 'team2', { x: 4, y: 3 }), id: 'ogre' },
    );
    const ftr = c.state.combatants['ftr']!;
    applyDamage(c.state, 'ftr', 'ogre', ftr.hp, 'bludgeoning', [], { magical: false });
    let guard = 0;
    while (c.activeId !== 'ogre' && guard++ < 20) c.apply({ kind: 'endTurn' });
    if (!isDown(c.state.combatants['ftr']!)) return;
    const ogre = c.state.combatants['ogre']!;
    ogre.turn.movementMax = 0;   // pinned, and with nothing to throw: the body is all it can reach
    ogre.inventory = [];
    ogre.equipped = { mainHand: 'ogre-greatclub' };
    const a = chooseAction(c.state, 'ogre');
    expect(a.kind === 'attack' ? a.targetId : a.kind).toBe('ftr');
  });

  it('whole fights still end, under both AIs', () => {
    for (const seed of [1, 2, 3]) {
      for (const sim of [false, true]) {
        const c = new Combat({
          seed, mapId: 'open', rules: { deathSaves: true },
          combatants: [...buildParty('team1', 0), ...buildParty('team2', 7)],
        });
        let steps = 0;
        while (!c.isOver() && steps++ < 4000) {
          c.apply(sim ? chooseActionSim(c.state, c.activeId, SIM_PRESETS.easy) : chooseAction(c.state, c.activeId));
        }
        expect(c.isOver(), `seed ${seed} ${sim ? 'sim' : 'greedy'} never finished`).toBe(true);
      }
    }
  }, 60000);
});

describe('when the dead stay dead (rules.deathIsFinal)', () => {
  /** A fighter dying beside its mate, an ogre beside them both; the mate to move. Null if the fighter rolled back up. */
  function beside(final: boolean): Combat | null {
    const c = new Combat({
      seed: 4, mapId: 'open',
      rules: { deathSaves: true, ...(final ? { deathIsFinal: 'team1' as const } : {}) },
      combatants: [
        pc('fighter', 'team1', { x: 3, y: 3 }, 'ftr'),
        pc('fighter', 'team1', { x: 4, y: 4 }, 'mate'),
        { ...buildMonster('ogre', 'team2', { x: 4, y: 3 }), id: 'ogre' },
      ],
    });
    applyDamage(c.state, 'ftr', 'ogre', c.state.combatants['ftr']!.hp, 'bludgeoning', [], { magical: false });
    let guard = 0;
    while (c.activeId !== 'mate' && guard++ < 20) c.apply({ kind: 'endTurn' });
    return isDying(c.state, c.state.combatants['ftr']!) ? c : null;
  }

  /** Whom an action helps up: the Medicine check's patient, or a potion's. */
  const tends = (a: ReturnType<typeof chooseAction>) =>
    a.kind === 'stabilize' ? a.targetId : a.kind === 'useItem' && a.targets?.[0] && 'combatantId' in a.targets[0] ? a.targets[0].combatantId : a.kind;

  it('its side gets a dying friend up, or stable, before it fights on, under both AIs', () => {
    const c = beside(true);
    if (!c) return;
    expect(tends(chooseAction(c.state, 'mate'))).toBe('ftr');
    // The look-ahead player may swing first and give the potion with its bonus action: by the turn's end, it's up.
    let turn: GameState = structuredClone(c.state);
    for (let i = 0; i < 10; i++) {
      const a = chooseActionSim(turn, 'mate', SIM_PRESETS.normal);
      if (a.kind === 'endTurn') break;
      turn = step(turn, a).state;
    }
    expect(turn.combatants['ftr']!.hp).toBeGreaterThan(0);
    // With nothing to give, the Medicine check.
    c.state.combatants['mate']!.inventory = [];
    expect(chooseAction(c.state, 'mate')).toEqual({ kind: 'stabilize', targetId: 'ftr' });
    expect(chooseActionSim(c.state, 'mate', SIM_PRESETS.normal)).toEqual({ kind: 'stabilize', targetId: 'ftr' });
  });

  it('where the dead come back, the same friend fights on', () => {
    const c = beside(false);
    if (!c) return;
    c.state.combatants['mate']!.inventory = [];
    expect(chooseAction(c.state, 'mate').kind).not.toBe('stabilize');
  });

  it('the other side is not drawn to the fallen by it', () => {
    for (const final of [false, true]) {
      const c = beside(final);
      if (!c) return;
      c.apply({ kind: 'endTurn' });
      let guard = 0;
      while (c.activeId !== 'ogre' && guard++ < 20) c.apply({ kind: 'endTurn' });
      if (!isDying(c.state, c.state.combatants['ftr']!)) return;
      const a = chooseAction(c.state, 'ogre');
      const s = chooseActionSim(c.state, 'ogre', SIM_PRESETS.normal);
      expect([a, s].map((x) => (x.kind === 'attack' ? x.targetId : x.kind)), String(final)).toEqual(['mate', 'mate']);
    }
  });
});
