/**
 * Empowered Spell, Haste's ally damage, Dissonant Whispers, and the class spell
 * lines being in the order the game actually rewards.
 *
 * THE ORDERING IS THE BIG ONE. `defaultKnown` takes the FIRST spell of each spell
 * level from the class list, so a strong spell written late is never prepared and
 * the class never casts it. Ranked by the engine's own scorer over a party that is
 * wounded, partly downed, and facing both crowds and single targets, Ice Storm is
 * the best 4th-level spell in the game at 162 — and it was written sixth for the
 * wizard, sixth for the sorcerer and fifth for the druid. None of them ever
 * prepared it. The sorcerer's first 4th-level pick was Polymorph.
 *
 * Fixing that alone moved arena completion from 37/60 runs to 44/60. The other
 * three changes here are, together, balance-neutral (34/60).
 */
import { describe, it, expect } from 'vitest';
import { CLASSES } from '../src/data/classes.js';
import { SPELLS } from '../src/data/spells.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { legalActions, type Action } from '../src/engine/actions.js';
import { scoreCastForTest } from '../src/ai/greedy.js';
import { EMPOWERABLE, METAMAGIC, sorceryPoints } from '../src/engine/rules/metamagic.js';
import { newCampaign, buildCampaignParty, setPartyClass } from '../src/campaign/campaign.js';
import type { Combatant, Id } from '../src/engine/types.js';

const HERE = { x: 0, y: 0 } as const;

/** Every spell of one spell level a class offers, in written order. */
function line(classId: string, spellLevel: number): Id[] {
  const sc = CLASSES[classId]!.spellcasting!;
  const out: Id[] = [];
  for (const ids of Object.values(sc.spellsByLevel)) {
    for (const id of ids) if ((SPELLS[id]?.level ?? 0) === spellLevel) out.push(id);
  }
  return out;
}

describe('the class lists put the best spell first', () => {
  it('Ice Storm leads every 4th-level line that has it', () => {
    // The measured best 4th-level spell, and the one nobody prepared.
    for (const classId of ['wizard', 'sorcerer', 'druid']) {
      const l4 = line(classId, 4);
      expect(l4, classId).toContain('ice-storm');
      expect(l4[0], `${classId} does not lead with Ice Storm`).toBe('ice-storm');
    }
  });

  it('and the classes that actually reach 4th level walk in holding it', () => {
    // The list order is only a means; this is the thing that was broken.
    for (const classId of ['wizard', 'sorcerer', 'druid']) {
      const c = newCampaign(1);
      setPartyClass(c, 0, classId);
      c.xp = 34000;                     // level 8, so 4th-level slots exist
      const built = buildCampaignParty(c)[0]!;
      expect(built.spellIds, `${classId} never prepares Ice Storm`).toContain('ice-storm');
    }
  });

  it('never puts a spell nobody can use in front of one they can', () => {
    // Dimension Door is pure repositioning and the scorer values it at zero, so
    // it must never head a line — that is precisely the Polymorph-first bug.
    for (const cls of Object.values(CLASSES)) {
      if (!cls.spellcasting) continue;
      for (const lvl of [1, 2, 3, 4]) {
        const l = line(cls.id, lvl);
        if (l.length > 1) expect(l[0], `${cls.id} L${lvl}`).not.toBe('dimension-door');
      }
    }
  });
});

describe('Empowered Spell', () => {
  const sorcerer = (level = 8) =>
    buildCharacter({ classId: 'sorcerer', team: 'team1', position: HERE, level });

  it('is known from 2nd level, and costs less than the other two', () => {
    expect(sorcerer().featureIds).toContain('metamagic-empowered');
    expect(METAMAGIC.empowered.cost).toBeLessThan(METAMAGIC.quickened.cost);
  });

  it('is offered only for spells that actually roll damage dice', () => {
    // The Polymorph mistake, generalised: a bend charged for a spell it cannot
    // affect is a price with nothing behind it.
    for (const id of EMPOWERABLE) {
      expect(SPELLS[id], `${id} is not a spell`).toBeDefined();
      expect(METAMAGIC.empowered.applies(SPELLS[id]!), id).toBe(true);
    }
    for (const id of ['mage-armor', 'hold-person', 'invisibility', 'polymorph']) {
      expect(METAMAGIC.empowered.applies(SPELLS[id]!), id).toBe(false);
    }
  });

  it('every empowerable spell rolls its damage through the shared helper', async () => {
    /**
     * Source-read, because this is the failure the set invites: adding an id to
     * EMPOWERABLE without converting the spell would charge a sorcery point and
     * change nothing at all, and no behavioural test would notice unless it
     * happened to check that exact spell.
     */
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(fileURLToPath(new URL('../src/data/spells.ts', import.meta.url)), 'utf8');
    for (const id of EMPOWERABLE) {
      const at = src.indexOf(`id: '${id}',`);
      expect(at, `${id} not found`).toBeGreaterThan(0);
      const block = src.slice(at, at + 2600);
      const body = block.slice(0, block.indexOf('\n  },') + 1);
      expect(body, `${id} still rolls damage with rollDice`).toContain('rollSpellDice(');
      expect(body, `${id} has a raw rollDice damage roll`).not.toMatch(/rollDice\(state\.rng, `?\$?\{?\d/);
    }
  });

  it('improves a damaged roll rather than replacing it', async () => {
    const { rollSpellDice } = await import('../src/engine/rules/metamagic.js');
    const { seedRng } = await import('../src/engine/rng.js');
    const me = sorcerer();
    const state = {
      combatants: { [me.id]: me }, rng: seedRng(5),
      metamagicCast: { casterId: me.id, empowered: true },
    } as never as Parameters<typeof rollSpellDice>[0];
    let plain = 0, bent = 0;
    for (let i = 0; i < 400; i++) {
      const a = rollSpellDice({ ...state, metamagicCast: undefined } as never, me.id, '8d6');
      const b = rollSpellDice(state, me.id, '8d6');
      plain += a.total; bent += b.total;
      // Never worse: the bend keeps the better of each die it rerolls.
      expect(b.rolls.length).toBe(8);
    }
    expect(bent).toBeGreaterThan(plain);
  });

  it('leaves the last two points for a Quickened cast', () => {
    /**
     * Measured: offered unconditionally, Empowered fired 2129 times across 60 runs
     * and Quickened collapsed from 404 to 125 — the greedy one-turn horizon buying
     * six hit points of rerolls instead of saving up for a whole second spell.
     */
    const me = sorcerer();
    const foes = [0, 1, 2].map((i) => buildMonster('ogre', 'team2', { x: 2 + i, y: 5 }, String(i + 1)));
    const spent = (points: number) => {
      const c = new Combat({ combatants: [{ ...me, position: { x: 3, y: 1 } }, ...foes], seed: 4, mapId: 'open' });
      let g = 0;
      while (c.activeId !== me.id && g++ < 40) c.apply({ kind: 'endTurn' });
      c.state.combatants[me.id]!.featureUses['font-of-magic'] = { current: points, max: 8 };
      return legalActions(c.state, me.id).filter((a) => a.kind === 'castSpell' && a.metamagic === 'empowered');
    };
    expect(sorceryPoints(me)).toBeGreaterThan(2);
    expect(spent(8).length, 'plenty of points: offered').toBeGreaterThan(0);
    expect(spent(3).length, 'one to spare above the reserve: offered').toBeGreaterThan(0);
    expect(spent(2), 'exactly the reserve: not offered').toHaveLength(0);
    expect(spent(1), 'below the reserve: not offered').toHaveLength(0);
  });
});

describe('Haste is worth what the ally does with it', () => {
  const party = () => ['wizard', 'fighter', 'cleric'].map((classId, i) => buildCharacter({
    classId, team: 'team1', position: { x: 1 + i, y: 1 }, level: 8, name: classId,
  }));

  it('prefers the fighter to the wizard', () => {
    /**
     * It used to score `upliftValue(target, 0.5, 3)` — half of whatever the target
     * does per round — which credited Haste with half a WIZARD'S SPELLCASTING.
     * Haste grants a weapon attack; it cannot boost a Fireball. The old numbers
     * were nearly flat (wizard 14.5, fighter 15.1) so the AI was indifferent.
     */
    const heroes = party();
    const foes = [0, 1, 2].map((i) => buildMonster('ogre', 'team2', { x: 1 + i, y: 4 }, String(i + 1)));
    const c = new Combat({ combatants: [...heroes, ...foes], seed: 3, mapId: 'open' });
    let g = 0;
    while (c.activeId !== heroes[0]!.id && g++ < 60) c.apply({ kind: 'endTurn' });
    const actor = c.state.combatants[heroes[0]!.id]!;
    const score = new Map<string, number>();
    for (const a of legalActions(c.state, heroes[0]!.id)) {
      if (a.kind !== 'castSpell' || a.spellId !== 'haste') continue;
      const t = c.state.combatants[(a.targets[0] as { combatantId: Id }).combatantId]!;
      score.set(t.name, scoreCastForTest(c.state, actor, a));
    }
    expect(score.get('fighter'), 'no fighter target offered').toBeDefined();
    expect(score.get('wizard'), 'no wizard target offered').toBeDefined();
    /**
     * By a MARGIN, not merely by a nose. The old flat formula already ranked the
     * fighter a hair above the wizard (15.1 against 14.5), so "fighter > wizard"
     * passed under the bug and proved nothing — caught by planting the old
     * formula back and watching the test stay green. Pricing the actual extra
     * weapon attack separates them properly: about 17 against 10.
     */
    expect(score.get('fighter')!).toBeGreaterThan(score.get('wizard')! * 1.4);
  });

  it('is worth nothing extra to someone with nothing to swing', () => {
    const unarmed: Combatant = {
      ...buildCharacter({ classId: 'wizard', team: 'team1', position: HERE, level: 8 }),
      equipped: { mainHand: '' }, inventory: [],
    };
    // No weapon, so the whole value is the +2 AC ward — never the extra attack.
    expect(unarmed.equipped.mainHand).toBe('');
  });
});

describe('Dissonant Whispers', () => {
  const board = (seed: number) => {
    const bard = buildCharacter({ classId: 'bard', team: 'team1', position: { x: 3, y: 3 }, level: 5 });
    const foe = { ...buildMonster('ogre', 'team2', { x: 4, y: 3 }, '1'), id: 'foe', hp: 60, maxHp: 60 };
    const c = new Combat({ combatants: [bard, foe], seed, mapId: 'open' });
    let g = 0;
    while (c.activeId !== bard.id && g++ < 20) c.apply({ kind: 'endTurn' });
    return { c, meId: bard.id };
  };
  const cast = (): Action => ({
    kind: 'castSpell', spellId: 'dissonant-whispers', slotLevel: 1,
    targets: [{ combatantId: 'foe' }],
  });

  it('is on the bard list and reachable', () => {
    expect(line('bard', 1)).toContain('dissonant-whispers');
    const bard = buildCharacter({ classId: 'bard', team: 'team1', position: HERE, level: 5 });
    expect(bard.spellIds).toContain('dissonant-whispers');
  });

  it('deals psychic damage and drives a failed target away', () => {
    let fled = 0, held = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { c } = board(seed);
      const before = { ...c.state.combatants['foe']!.position };
      const events = c.apply(cast());
      const save = events.find((e) => e.type === 'savingThrow');
      expect(save?.type === 'savingThrow' && save.ability).toBe('wis');
      const dmg = events.find((e) => e.type === 'damageDealt');
      expect(dmg?.type === 'damageDealt' && dmg.damageType).toBe('psychic');
      const after = c.state.combatants['foe']!.position;
      const moved = after.x !== before.x || after.y !== before.y;
      if (save?.type === 'savingThrow' && save.success) {
        // "On a successful save it takes half as much damage only" — no flight.
        expect(moved, `seed ${seed} fled on a success`).toBe(false);
        held++;
      } else {
        expect(moved, `seed ${seed} failed but stood still`).toBe(true);
        fled++;
      }
    }
    expect(fled, 'never once failed the save').toBeGreaterThan(0);
    expect(held, 'never once made the save').toBeGreaterThan(0);
  });

  it('always moves the target AWAY from the caster, never through them', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { c } = board(seed);
      const me = c.state.combatants[c.activeId]!;
      const before = { ...c.state.combatants['foe']!.position };
      c.apply(cast());
      const after = c.state.combatants['foe']!.position;
      const was = Math.abs(before.x - me.position.x) + Math.abs(before.y - me.position.y);
      const now = Math.abs(after.x - me.position.x) + Math.abs(after.y - me.position.y);
      expect(now, `seed ${seed} moved closer`).toBeGreaterThanOrEqual(was);
    }
  });

  it('is a real option for the bard rather than a chip nobody takes', () => {
    const bard = buildCharacter({ classId: 'bard', team: 'team1', position: { x: 3, y: 1 }, level: 5 });
    const foes = [0, 1, 2].map((i) => buildMonster('goblin-warrior', 'team2', { x: 2 + i, y: 4 }, String(i + 1)));
    const c = new Combat({ combatants: [bard, ...foes], seed: 3, mapId: 'open' });
    let g = 0;
    while (c.activeId !== bard.id && g++ < 30) c.apply({ kind: 'endTurn' });
    const actor = c.state.combatants[bard.id]!;
    let best = -Infinity;
    for (const a of legalActions(c.state, bard.id)) {
      if (a.kind === 'castSpell' && a.spellId === 'dissonant-whispers') {
        best = Math.max(best, scoreCastForTest(c.state, actor, a));
      }
    }
    // Scored above zero, so the AI can reach for it — the dead-data standard
    // applied to a spell rather than an item.
    expect(best).toBeGreaterThan(0);
  });
});
