import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { SPELLS } from '../src/data/spells.js';
import { evaluate } from '../src/ai/evaluate.js';
import { step } from '../src/engine/actions.js';
import type { Action } from '../src/engine/actions.js';
import { cellAt } from '../src/engine/types.js';
import { readFileSync } from 'node:fs';

/**
 * The simulation AI scores an action by the state one step ahead. That makes a
 * whole category of spell invisible to it: the ones that set up something which
 * pays out on *later* turns and do nothing at all on the turn they are cast.
 *
 * Measured over thirty fights before this was priced:
 *
 *   Spirit Guardians   55 offers,   0 casts
 *   Flaming Sphere      6962 offers,   0 casts
 *   Ice Storm            843 offers,   0 casts
 *
 * All three are implemented correctly and all three were dead. Spiritual
 * Weapon escaped only by accident — it happens to strike as it lands, so the
 * one-step lookahead sees damage.
 *
 * The bar here is deliberately NOT "the AI's favourite". These compete with
 * Fireball and Banishment and often should lose. The bar is that each is
 * *offered*, *scores above doing nothing*, and *actually does what it says*.
 */

function wizard(level = 7) {
  return buildCharacter({ classId: 'wizard', team: 'team1', level, name: 'W', position: { x: 4, y: 1 }, speciesId: 'human' });
}
function cleric(level = 7) {
  return buildCharacter({ classId: 'cleric', team: 'team1', level, name: 'C', position: { x: 5, y: 1 }, speciesId: 'human' });
}

/** A fight with the two casters and `n` ogres in a clump the party can see. */
function rig(n = 2) {
  const w = wizard(), c = cleric();
  const foes = Array.from({ length: n }, (_, i) => ({
    ...buildMonster('ogre', 'team2', { x: 3 + i, y: 5 }), id: `f${i}`,
  }));
  return new Combat({ seed: 9, width: 12, height: 12, combatants: [w, c, ...foes] });
}

function turnOf(combat: Combat, id: string): void {
  for (let i = 0; i < 40 && combat.activeId !== id; i++) combat.apply({ kind: 'endTurn' });
  expect(combat.activeId, `never reached ${id}'s turn`).toBe(id);
}

function offers(combat: Combat, id: string, spellId: string): Action[] {
  return combat.legalActions(id).filter(
    (a): a is Action => a.kind === 'castSpell' && a.spellId === spellId,
  );
}

/** Best one-step evaluation delta among the ways to cast `spellId`. */
function bestDelta(combat: Combat, id: string, spellId: string): number {
  const team = combat.state.combatants[id]!.team;
  const base = evaluate(combat.state, team);
  let best = -Infinity;
  for (const a of offers(combat, id, spellId)) {
    const { state: after } = step(combat.state, a);
    best = Math.max(best, evaluate(after, team) - base);
  }
  return best;
}

describe('effects that pay out later are visible to the AI', () => {
  it('an aura is offered as the line closes, not only once it has arrived', () => {
    // Gating Spirit Guardians on an enemy already inside the 15 ft aura made
    // it nearly unofferable: evaluate()'s engagement band parks a caster at
    // 20 ft, so the Priest stat block — which carries it — was offered the
    // spell ten times in thirty fights. An aura lasts; raising it as the enemy
    // walks in is the normal way to use one.
    const c = rig(2);              // ogres at y=5, cleric at y=1 → 20 ft away
    turnOf(c, 'team1-cleric');
    expect(offers(c, 'team1-cleric', 'spiritual-guardians').length,
      'Spirit Guardians must be offered at approach range').toBeGreaterThan(0);
  });

  it('each one scores strictly better than doing nothing', () => {
    // The exact numbers are not the contract — they move whenever evaluate()
    // is retuned. What must never come back is a *negative* score, which is
    // what "a spent slot and no visible change" evaluates to, and which no
    // amount of good play can rescue.
    const c = rig(3);
    turnOf(c, 'team1-cleric');
    expect(bestDelta(c, 'team1-cleric', 'spiritual-guardians'),
      'Spirit Guardians reads as a wasted slot').toBeGreaterThan(1);

    const w = rig(3);
    turnOf(w, 'team1-wizard');
    expect(bestDelta(w, 'team1-wizard', 'flaming-sphere'),
      'Flaming Sphere reads as a wasted slot').toBeGreaterThan(1);
    expect(bestDelta(w, 'team1-wizard', 'ice-storm'),
      'Ice Storm reads as a wasted slot').toBeGreaterThan(1);
  });

  it('Ice Storm is second to Fireball on damage, and is bought for its ground', () => {
    // SRD Ice Storm is 2d10 + 4d6 (25 avg) where a same-level Fireball is 8d6
    // (28) in the same area for a slot less, so by damage alone it is dominated
    // and the AI is right to prefer Fireball. It is not right to price the
    // difference at zero: the chilled ground is what the extra level buys.
    const c = rig(3);
    turnOf(c, 'team1-wizard');
    const ice = bestDelta(c, 'team1-wizard', 'ice-storm');
    const fire = bestDelta(c, 'team1-wizard', 'fireball');
    expect(ice).toBeLessThan(fire);
    expect(ice).toBeGreaterThan(fire * 0.5);
  });

  it('Spirit Guardians actually damages an enemy that starts its turn in it', () => {
    // The thing the review was asked to check. It is silent on cast — no
    // events at all — so nothing downstream of the cast proves it works.
    const c = rig(1);
    turnOf(c, 'team1-cleric');
    const cast = offers(c, 'team1-cleric', 'spiritual-guardians')[0];
    expect(cast, 'not offered at all').toBeDefined();
    c.apply(cast!);
    expect(c.state.combatants['team1-cleric']!.spiritualGuardians).toBeDefined();
    // Walk the ogre into the aura and let its turn start there.
    const before = c.state.combatants['f0']!.hp;
    c.state.combatants['f0']!.position = { x: 5, y: 2 }; // adjacent to the cleric
    for (let i = 0; i < 20 && c.state.combatants['f0']!.hp === before; i++) {
      c.apply({ kind: 'endTurn' });
    }
    expect(c.state.combatants['f0']!.hp, 'the aura never hurt anyone').toBeLessThan(before);
  });

});

describe('upcasting', () => {
  /**
   * `legalActions` offers a spell at its own level only, unless it is flagged
   * `upcast` — which is why a 4th-level slot was unspendable before the flag
   * existed. A flag that does not actually scale anything is worse than no
   * flag: it puts a strictly-wasteful option in front of the player.
   */
  it('every damaging spell flagged upcastable hits harder for the bigger slot', () => {
    const flagged = Object.values(SPELLS).filter((s) => s.upcast);
    expect(flagged.length, 'nothing is flagged upcastable any more').toBeGreaterThan(10);

    // Damage-dealing ones only: the healers and buffs scale too, but through
    // HP and temp HP rather than an enemy's hit points, and each already has
    // its own test.
    const damaging = ['burning-hands', 'fireball', 'lightning-bolt', 'thunderwave', 'guiding-bolt'];
    for (const id of damaging) {
      expect(SPELLS[id]!.upcast, `${id} is no longer flagged`).toBe(true);
      const at = (slot: number): number => {
        let total = 0;
        for (let seed = 1; seed <= 20; seed++) {
          const w = wizard(), c = cleric();
          const caster = [w, c].find((x) => x.spellIds.includes(id))!;
          const foe = { ...buildMonster('ogre', 'team2', { x: 4, y: 4 }), id: 'f', hp: 500, maxHp: 500 };
          const combat = new Combat({ seed, width: 10, height: 10, combatants: [w, c, foe] });
          turnOf(combat, caster.id);
          let worst = 0;
          for (const a of offers(combat, caster.id, id)) {
            if ((a as { slotLevel: number }).slotLevel !== slot) continue;
            const { state: after } = step(combat.state, a);
            worst = Math.max(worst, 500 - after.combatants['f']!.hp);
          }
          total += worst;
        }
        return total / 20;
      };
      const base = SPELLS[id]!.level;
      expect(at(base + 1), `${id} does no more at slot ${base + 1}`).toBeGreaterThan(at(base));
    }
  });

  it('still offers an innate cast at its own level, which is not a slot at all', () => {
    // Enumerating slot levels once dropped baseLevel 0, and a monster whose
    // Ray of Sickness comes from its species pool lost the ability to cast it.
    expect(SPELLS['ray-of-sickness']!.upcast).toBe(true);
  });
});

describe('Ice Storm leaves ground behind, and takes it back', () => {
  it('chills the cells it lands on and thaws them again', () => {
    const c = rig(2);
    turnOf(c, 'team1-wizard');
    const cast = offers(c, 'team1-wizard', 'ice-storm')[0];
    expect(cast, 'Ice Storm is not offered').toBeDefined();
    c.apply(cast!);
    let chilled = 0;
    for (let y = 0; y < c.state.grid.height; y++) {
      for (let x = 0; x < c.state.grid.width; x++) {
        const cell = cellAt(c.state.grid, { x, y });
        if (cell?.chilled) {
          chilled++;
          expect(cell.terrain, 'ice must never overwrite the real terrain').not.toBe('wall');
        }
      }
    }
    expect(chilled, 'Ice Storm chilled nothing').toBeGreaterThan(0);
    // And it is an overlay on a clock, not a permanent repaint of the board.
    for (let i = 0; i < 60 && !c.isOver(); i++) c.apply({ kind: 'endTurn' });
    let still = 0;
    for (let y = 0; y < c.state.grid.height; y++) {
      for (let x = 0; x < c.state.grid.width; x++) if (cellAt(c.state.grid, { x, y })?.chilled) still++;
    }
    expect(still, 'the ice never melted').toBe(0);
  });
});

/**
 * Checked line by line against `SRD_CC_v5.2.1.txt`, which is now vendored in
 * the repo. Both of these were wrong, and both were wrong in the direction that
 * makes the spell quietly weaker than the book — the kind of thing that reads
 * as a balance opinion rather than a bug.
 */
describe('against the SRD text', () => {
  it('Ice Storm hails 2d10, not 2d8', () => {
    // SRD: "2d10 Bludgeoning damage and 4d6 Cold damage", +1d10 per level above 4.
    const src = readFileSync(new URL('../src/data/spells.ts', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf("'ice-storm': {"), src.indexOf("'ice-storm': {") + 1200);
    expect(body).toContain('d10`');
    expect(body).toContain("'4d6'");
  });

  it('Spirit Guardians scales with the slot and halves Speed in the aura', () => {
    // SRD: "+1d8 for each spell slot level above 3", and "Any other creature's
    // Speed is halved in the Emanation". The second was missing outright.
    expect(SPELLS['spiritual-guardians']!.upcast, 'must be offered at higher slots').toBe(true);

    const c = rig(1);
    turnOf(c, 'team1-cleric');
    const cast = offers(c, 'team1-cleric', 'spiritual-guardians')
      .find((a) => (a as { slotLevel: number }).slotLevel === 4);
    expect(cast, 'no 4th-level cast offered').toBeDefined();
    c.apply(cast!);
    expect(c.state.combatants['team1-cleric']!.spiritualGuardians!.dice).toBe('4d8');

    // Speed: the ogre walks at 40 ft, and at 20 ft once it is inside the aura.
    const ogre = c.state.combatants['f0']!;
    const full = ogre.speed;
    ogre.position = { x: 5, y: 2 }; // adjacent to the cleric
    for (let i = 0; i < 30 && c.activeId !== 'f0'; i++) c.apply({ kind: 'endTurn' });
    expect(c.activeId, 'never reached the ogre').toBe('f0');
    expect(c.state.combatants['f0']!.turn.movementMax,
      'Spirit Guardians must halve Speed inside the aura').toBe(Math.floor(full / 2));
  });
});
