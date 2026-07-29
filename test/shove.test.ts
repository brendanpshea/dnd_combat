/**
 * Shove — the Unarmed Strike option nothing in this game could do.
 *
 * `pushCreature` has been in the engine since Thunderwave, and forced movement
 * existed only as a rider on something else: the blast, the warlock's Repelling
 * Blast, the Push weapon mastery. Nobody could simply choose to shove.
 *
 *   "Shove. The target must succeed on a Strength or Dexterity saving throw (it
 *    chooses which), or you either push it 5 feet away or cause it to have the
 *    Prone condition. The DC ... equals 8 plus your Strength modifier and
 *    Proficiency Bonus. This shove is possible only if the target is no more
 *    than one size larger than you."
 */
import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { legalActions, isLegalAction, type Action } from '../src/engine/actions.js';
import { canShove, shoveDc } from '../src/engine/rules/shove.js';
import { skillMod } from '../src/engine/rules/skills.js';
import { chooseAction, scoreShoveForTest } from '../src/ai/greedy.js';
import { abilityMod, proficiencyBonus, cellAt } from '../src/engine/types.js';
import type { Combatant, Position } from '../src/engine/types.js';

function board(opts: { foeAt?: Position; foeId?: string; hazardAt?: Position; seed?: number } = {}) {
  const me: Combatant = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 3, y: 3 }, level: 5 });
  const foe = {
    ...buildMonster(opts.foeId ?? 'goblin-warrior', 'team2', opts.foeAt ?? { x: 4, y: 3 }),
    id: 'foe', hp: 40, maxHp: 40,
  };
  const c = new Combat({ combatants: [me, foe], seed: opts.seed ?? 4, mapId: 'open' });
  if (opts.hazardAt) {
    cellAt(c.state.grid, opts.hazardAt)!.terrain = 'hazard';
  }
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 30) c.apply({ kind: 'endTurn' });
  return { c, meId: me.id, me: c.state.combatants[me.id]!, foe: c.state.combatants['foe']! };
}

const shove = (targetId: string, mode: 'push' | 'prone'): Action => ({ kind: 'shove', targetId, mode });

/** What the scorer thinks one shove is worth, for the comparisons below. */
function scoreOf(c: Combat, meId: string, a: Action): number {
  return scoreShoveForTest(c.state, c.state.combatants[meId]!, a as Action & { kind: 'shove' });
}

describe('the rule', () => {
  it('is centred on the shover\'s Athletics, not a flat save DC', () => {
    // Shove is an opposed check now (see rules/shove.ts for why), so `shoveDc`
    // is the middle of the contest rather than a number to roll against: the
    // shover's Athletics modifier plus the mean of a d20.
    const { me } = board();
    expect(shoveDc(me)).toBe(11 + skillMod(me, 'athletics'));
    // And training is part of it — that is the entire point of the change.
    const trained = { ...me, skillProfs: ['athletics' as const] };
    const untrained = { ...me, skillProfs: [] };
    expect(shoveDc(trained)).toBeGreaterThan(shoveDc(untrained));
  });

  it('needs the target within reach', () => {
    const near = board({ foeAt: { x: 4, y: 3 } });
    const far = board({ foeAt: { x: 6, y: 3 } });
    expect(canShove(near.me, near.foe)).toBe(true);
    expect(canShove(far.me, far.foe)).toBe(false);
  });

  it('refuses anything more than one size larger', () => {
    // A medium hero can shove a Large ogre and cannot shove a Huge giant ape.
    const ogre = board({ foeId: 'ogre' });
    const ape = board({ foeId: 'giant-ape' });
    expect(ogre.foe.size).toBe('large');
    expect(ape.foe.size).toBe('huge');
    expect(canShove(ogre.me, ogre.foe), 'one size larger is allowed').toBe(true);
    expect(canShove(ape.me, ape.foe), 'two sizes larger is not').toBe(false);
  });

  it('lets the target resist with whichever skill it is better at', () => {
    /**
     * "It chooses which" — so a rational defender picks its better option:
     * Athletics if strong, Acrobatics if nimble. Rolling the shover against the
     * defender's WORSE option would make shove roughly twice as good as intended,
     * and would be invisible without checking which skill the contest names.
     */
    const { c } = board();
    const foe = c.state.combatants['foe']!;
    foe.abilities = { ...foe.abilities, str: 20, dex: 6 };
    const strong = c.apply(shove('foe', 'prone')).find((e) => e.type === 'shoved');
    expect(strong?.type === 'shoved' && strong.contest?.defenderSkill).toBe('athletics');

    const b = board();
    b.c.state.combatants['foe']!.abilities = { ...b.foe.abilities, str: 6, dex: 20 };
    const nimble = b.c.apply(shove('foe', 'prone')).find((e) => e.type === 'shoved');
    expect(nimble?.type === 'shoved' && nimble.contest?.defenderSkill).toBe('acrobatics');
  });

  it('reports both totals, so the log can say why it failed', () => {
    const { c } = board();
    const shoved = c.apply(shove('foe', 'prone')).find((e) => e.type === 'shoved');
    const detail = shoved?.type === 'shoved' ? shoved.contest : undefined;
    expect(detail).toBeDefined();
    expect(detail!.attackerTotal).toBeGreaterThan(0);
    expect(detail!.defenderTotal).toBeGreaterThan(0);
    // The winner and the reported totals must agree, or the log is a fiction.
    const won = shoved?.type === 'shoved' && shoved.success;
    expect(won).toBe(detail!.attackerTotal > detail!.defenderTotal);
  });

  it('gives ties to the defender', () => {
    // The contest rule, and the right default for something the attacker is
    // trying to make happen.
    const { c } = board();
    let ties = 0, tiesLost = 0;
    for (let i = 0; i < 300; i++) {
      const b = board({ seed: i + 1 });
      const e = b.c.apply(shove('foe', 'prone')).find((x) => x.type === 'shoved');
      if (e?.type !== 'shoved' || !e.contest) continue;
      if (e.contest.attackerTotal === e.contest.defenderTotal) {
        ties++;
        if (!e.success) tiesLost++;
      }
    }
    expect(c).toBeTruthy();
    expect(ties, 'no ties observed — the test proves nothing').toBeGreaterThan(0);
    expect(tiesLost).toBe(ties);
  });
});

describe('what it does', () => {
  it('knocks the target prone on a failed save', () => {
    const { c } = board();
    // A DC nothing can make, so the outcome is the rule rather than the die.
    c.state.combatants['foe']!.abilities = { ...c.state.combatants['foe']!.abilities, str: 1, dex: 1 };
    const events = c.apply(shove('foe', 'prone'));
    const shoved = events.find((e) => e.type === 'shoved');
    expect(shoved?.type === 'shoved' && shoved.success).toBe(true);
    expect(c.state.combatants['foe']!.conditions.some((k) => k.id === 'prone')).toBe(true);
  });

  it('pushes the target one square directly away', () => {
    const { c } = board({ foeAt: { x: 4, y: 3 } });
    c.state.combatants['foe']!.abilities = { ...c.state.combatants['foe']!.abilities, str: 1, dex: 1 };
    c.apply(shove('foe', 'push'));
    expect(c.state.combatants['foe']!.position).toEqual({ x: 5, y: 3 });
    expect(cellAt(c.state.grid, { x: 5, y: 3 })!.occupantId).toBe('foe');
    expect(cellAt(c.state.grid, { x: 4, y: 3 })!.occupantId).toBeUndefined();
  });

  it('burns whatever it shoves into a hazard', () => {
    // The reason push is worth having at all on this board. Enemies path around
    // fire on their own, so forcing them into it is most of how anything ever
    // ends up standing in one.
    const { c } = board({ foeAt: { x: 4, y: 3 }, hazardAt: { x: 5, y: 3 } });
    c.state.combatants['foe']!.abilities = { ...c.state.combatants['foe']!.abilities, str: 1, dex: 1 };
    const before = c.state.combatants['foe']!.hp;
    c.apply(shove('foe', 'push'));
    expect(c.state.combatants['foe']!.hp).toBeLessThan(before);
  });

  it('does nothing when the defender wins the contest', () => {
    const { c } = board();
    c.state.combatants['foe']!.abilities = { ...c.state.combatants['foe']!.abilities, str: 30, dex: 30 };
    c.state.combatants['foe']!.skillProfs = ['athletics', 'acrobatics'];
    const at = { ...c.state.combatants['foe']!.position };
    const events = c.apply(shove('foe', 'prone'));
    const shoved = events.find((e) => e.type === 'shoved');
    expect(shoved?.type === 'shoved' && shoved.success).toBe(false);
    expect(c.state.combatants['foe']!.conditions.some((k) => k.id === 'prone')).toBe(false);
    expect(c.state.combatants['foe']!.position).toEqual(at);
  });

  it('spends the action either way', () => {
    const { c, meId } = board();
    c.apply(shove('foe', 'prone'));
    expect(c.state.combatants[meId]!.turn.actionUsed).toBe(true);
  });
});

describe('what the board offers', () => {
  it('offers both modes against an adjacent enemy', () => {
    const { c, meId } = board();
    const modes = legalActions(c.state, meId)
      .flatMap((a) => (a.kind === 'shove' ? [a.mode] : [])).sort();
    expect(modes).toEqual(['prone', 'push']);
  });

  it('offers none against an ally, or at range', () => {
    const { c, meId } = board({ foeAt: { x: 6, y: 3 } });
    expect(legalActions(c.state, meId).some((a) => a.kind === 'shove')).toBe(false);
    // And an ally is never a target, however close they stand.
    const ally = { ...buildCharacter({ classId: 'cleric', team: 'team1', position: { x: 3, y: 4 }, level: 5 }), id: 'ally' };
    c.state.combatants['ally'] = ally;
    cellAt(c.state.grid, { x: 3, y: 4 })!.occupantId = 'ally';
    expect(isLegalAction(c.state, meId, shove('ally', 'prone'))).toBe(false);
  });
});

describe('the AI prices it as a delta, not as a habit', () => {
  it('values a shove into fire above one onto bare ground', () => {
    /**
     * The honest comparison, and NOT "push beats attacking". The first draft of
     * this test asserted that, and it was a fantasy: the hazard is 1d4, so
     * shoving a healthy 40-hit-point goblin into it trades a whole action for
     * about two expected hit points and correctly loses to a longsword. A test
     * that demanded otherwise would have been pressure to inflate the price of
     * a shove until it beat attacking everywhere — which is the modifier
     * mistake this file's siblings document six times over.
     *
     * What must be true is that the scorer can tell the two squares apart.
     */
    const fire = board({ foeAt: { x: 4, y: 3 }, hazardAt: { x: 5, y: 3 } });
    const bare = board({ foeAt: { x: 4, y: 3 } });
    for (const b of [fire, bare]) {
      const f = b.c.state.combatants['foe']!;
      f.abilities = { ...f.abilities, str: 4, dex: 4 };
    }
    const push = (b: ReturnType<typeof board>) =>
      scoreOf(b.c, b.meId, shove('foe', 'push'));
    expect(push(fire)).toBeGreaterThan(push(bare));
  });

  it('prices the fire higher when it would actually finish the job', () => {
    /**
     * The kill bonus reaching the shove — and the SECOND fantasy this test had
     * to give up. It first demanded the AI prefer a shove into fire over a
     * longsword against a two-hit-point goblin. It should not: the sword hits
     * about three times in four and kills outright, while the shove needs a
     * failed save AND a 1d4 that rolls high enough, which is about even odds.
     * The AI was right twice and the test was wrong twice.
     *
     * A 1d4 hazard is simply too small to buy an action from a martial
     * character. That is a fact about the hazard, not about shove, and pushing
     * the price up until the assertion passed would have been exactly the
     * modifier mistake this codebase has made six times.
     */
    const healthy = board({ foeAt: { x: 4, y: 3 }, hazardAt: { x: 5, y: 3 } });
    const dying = board({ foeAt: { x: 4, y: 3 }, hazardAt: { x: 5, y: 3 } });
    for (const b of [healthy, dying]) {
      const f = b.c.state.combatants['foe']!;
      f.abilities = { ...f.abilities, str: 4, dex: 4 };
    }
    dying.c.state.combatants['foe']!.hp = 2;
    expect(scoreOf(dying.c, dying.meId, shove('foe', 'push')))
      .toBeGreaterThan(scoreOf(healthy.c, healthy.meId, shove('foe', 'push')));
  });

  it('will not shove a lone enemy prone when it could just hit it', () => {
    /**
     * MEASURED. The first version of the scorer counted every adjacent ally as
     * a beneficiary of Prone — ignoring that the rule gives melee attackers
     * advantage and ranged attackers DISADVANTAGE, and that an ally who has
     * already swung gets nothing. Across 4,339 arena fights that produced 7,719
     * shoves, only 209 of them by the party: packs of monsters spent their
     * turns knocking heroes over instead of hitting them, and the arena's
     * even-budget guard caught it as the party winning 67% of a fight designed
     * to be a coin flip.
     *
     * With nobody else in reach there is no uplift to buy, so hitting it wins.
     */
    const { c, meId } = board({ foeAt: { x: 4, y: 3 } });
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'shove' && a.mode === 'prone').toBe(false);
  });

  it('counts melee allies as beneficiaries of Prone, and not archers', () => {
    /**
     * The rule has two halves and the scorer needs both: prone gives a MELEE
     * attacker advantage and a RANGED attacker DISADVANTAGE. Counting every
     * adjacent ally scored an archer standing beside the target as a reason to
     * knock it down, which is backwards.
     *
     * Asserted as "archers add NOTHING" rather than "swords beat bows". The
     * first version compared a barbarian line against a ranger line, and could
     * not see the filter at all: with it removed both lines count, and a
     * barbarian still out-damages a ranger, so the comparison came out the same
     * way either way. The only assertion that isolates the rule is the one that
     * pins the archers' contribution to zero.
     */
    const withHelpers = (classId: string | undefined) => {
      const b = board({ foeAt: { x: 4, y: 3 } });
      if (classId) {
        const spots: Position[] = [{ x: 4, y: 2 }, { x: 4, y: 4 }, { x: 5, y: 3 }];
        spots.forEach((p, i) => {
          const ally = { ...buildCharacter({ classId, team: 'team1', position: p, level: 5 }), id: `a${i}` };
          b.c.state.combatants[ally.id] = ally;
          cellAt(b.c.state.grid, p)!.occupantId = ally.id;
        });
      }
      return scoreOf(b.c, b.meId, shove('foe', 'prone'));
    };
    const alone = withHelpers(undefined);
    expect(withHelpers('ranger'), 'three archers buy nothing').toBeCloseTo(alone, 5);
    expect(withHelpers('barbarian'), 'three axes buy something').toBeGreaterThan(alone);
  });

  it('never shoves into a wall, where nothing would move', () => {
    const { c, meId } = board({ foeAt: { x: 4, y: 3 } });
    cellAt(c.state.grid, { x: 5, y: 3 })!.terrain = 'wall';
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'shove' && a.mode === 'push').toBe(false);
  });
});
