import { describe, it, expect } from 'vitest';
import {
  BOUNTIES, bountiesFor, bountyGold, claimedBounties, spellsCastBy, roundsAllowed, unholyIn,
  type BountyContext,
} from '../src/arena/bounties.js';
import { buildParty, buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import type { MapData } from '../src/data/maps.js';
import { wavePurse, buildWave, newArenaRun, recordResult } from '../src/arena/run.js';
import type { GameEvent } from '../src/engine/events.js';
import type { Combatant, GameState } from '../src/engine/types.js';

/**
 * Bounties: two side-objectives named before a wave, paid in gold after it.
 *
 * The two properties worth defending in a test are the ones a player would
 * notice being broken and nothing else would catch:
 *
 *  - eligibility, because a bounty a party structurally cannot claim reads as a
 *    tax rather than an objective, and
 *  - stability across a retry, because a wave you lost is a tactical problem
 *    and rerolling the bounties would turn it into a slot machine.
 *
 * The `earned` predicates are checked against hand-built event logs. That is
 * deliberate: driving a real fight until a rogue happens to sneak-attack from
 * hiding measures the AI, not the predicate, and it would go quiet the first
 * time the AI's taste changed.
 */

const board = (rows: string[]): MapData => ({ id: 't', name: 'T', theme: 'stone', rows });

/** A state with a party and the given foes, on the given board. */
function scene(rows: string[], party: Combatant[], foeIds: string[]): GameState {
  const foes = foeIds.map((id, i) => ({ ...buildMonster(id, 'team2', { x: 5 + i, y: 4 }), id: `f${i}` }));
  return new Combat({ seed: 1, map: board(rows), combatants: [...party, ...foes] }).state;
}

const OPEN = ['........', '........', '........', '........', '........'];
const COVERED = ['........', '........', '...+....', '........', '........'];
const FIERY = ['........', '........', '..^^....', '........', '........'];

const byId = (id: string) => {
  const b = BOUNTIES.find((x) => x.id === id);
  if (!b) throw new Error(`no bounty ${id}`);
  return b;
};

/** A context whose only interesting content is the event log. */
function ctx(events: GameEvent[], state: GameState, over: Partial<BountyContext> = {}): BountyContext {
  return {
    events, state,
    party: Object.values(state.combatants).filter((c) => c.team === 'team1'),
    spellsUsedBefore: new Set(),
    rounds: 99,
    foes: 3,
    ...over,
  };
}

describe('bounty eligibility', () => {
  const party = buildParty('team1', 1, 3);

  it('offers the rogue bounty only to a party with a rogue, on a board with cover', () => {
    const rogueful = scene(COVERED, party, ['goblin-warrior']);
    expect(byId('from-the-shadows').eligible(
      Object.values(rogueful.combatants).filter((c) => c.team === 'team1'), rogueful)).toBe(true);

    // A rogue on a bare field has nowhere to hide, so this would be a bounty
    // the map forbids.
    const bare = scene(OPEN, party, ['goblin-warrior']);
    expect(byId('from-the-shadows').eligible(
      Object.values(bare.combatants).filter((c) => c.team === 'team1'), bare)).toBe(false);

    const noRogue = [
      buildCharacter({ classId: 'fighter', team: 'team1', level: 3, name: 'A', position: { x: 1, y: 1 }, speciesId: 'human' }),
      buildCharacter({ classId: 'wizard', team: 'team1', level: 3, name: 'B', position: { x: 2, y: 1 }, speciesId: 'human' }),
    ];
    const s = scene(OPEN, noRogue, ['goblin-warrior']);
    expect(byId('from-the-shadows').eligible(noRogue, s)).toBe(false);
  });

  it('offers the smite bounty only with a paladin AND something worth smiting', () => {
    const pal = [buildCharacter({ classId: 'paladin', team: 'team1', level: 3, name: 'P', position: { x: 1, y: 1 }, speciesId: 'human' })];
    expect(pal[0]!.featureIds).toContain('divine-smite');

    const undead = scene(OPEN, pal, ['skeleton']);
    expect(byId('wrath-held').eligible(pal, undead), 'a paladin, and a skeleton').toBe(true);
    const beasts = scene(OPEN, pal, ['wolf']);
    expect(byId('wrath-held').eligible(pal, beasts), 'nothing unholy on the board').toBe(false);
    const noPal = scene(OPEN, party, ['skeleton']);
    expect(byId('wrath-held').eligible(
      Object.values(noPal.combatants).filter((c) => c.team === 'team1'), noPal), 'no paladin').toBe(false);
  });

  it('offers the terrain bounties only when the board has the terrain', () => {
    expect(byId('dug-in').eligible(party, scene(COVERED, party, ['goblin-warrior']))).toBe(true);
    expect(byId('dug-in').eligible(party, scene(OPEN, party, ['goblin-warrior']))).toBe(false);
    expect(byId('into-the-fire').eligible(party, scene(FIERY, party, ['goblin-warrior']))).toBe(true);
    expect(byId('into-the-fire').eligible(party, scene(OPEN, party, ['goblin-warrior']))).toBe(false);
  });

  it('always has at least two to offer, whatever the party', () => {
    // A wave that offers one bounty (or none) is a screen with a hole in it.
    const runSeed = 7;
    for (let wave = 1; wave <= 25; wave++) {
      for (const p of [party, [buildCharacter({ classId: 'fighter', team: 'team1', level: 1, name: 'X', position: { x: 1, y: 1 }, speciesId: 'human' })]]) {
        const s = scene(OPEN, p, ['goblin-warrior']);
        const members = Object.values(s.combatants).filter((c) => c.team === 'team1');
        expect(bountiesFor(runSeed, wave, members, s).length, `wave ${wave}`).toBe(2);
      }
    }
  });
});

describe('bounty selection', () => {
  const party = buildParty('team1', 1, 3);

  it('is the same two on a retry — a failed wave is not a reroll', () => {
    const s = scene(COVERED, party, ['skeleton', 'goblin-warrior']);
    const members = Object.values(s.combatants).filter((c) => c.team === 'team1');
    const first = bountiesFor(3, 5, members, s).map((b) => b.id);
    const again = bountiesFor(3, 5, members, s).map((b) => b.id);
    expect(again).toEqual(first);
  });

  it('is not the same two every wave', () => {
    const s = scene(COVERED, party, ['skeleton', 'goblin-warrior']);
    const members = Object.values(s.combatants).filter((c) => c.team === 'team1');
    const seen = new Set<string>();
    for (let w = 1; w <= 12; w++) seen.add(bountiesFor(3, w, members, s).map((b) => b.id).sort().join('|'));
    expect(seen.size, 'every wave offered the same pair').toBeGreaterThan(3);
  });

  it('never offers the same bounty twice in one wave', () => {
    const s = scene(COVERED, party, ['skeleton']);
    const members = Object.values(s.combatants).filter((c) => c.team === 'team1');
    for (let w = 1; w <= 40; w++) {
      const [a, b] = bountiesFor(w, w, members, s);
      expect(a!.id).not.toBe(b!.id);
    }
  });
});

describe('what counts as earning one', () => {
  const party = buildParty('team1', 1, 3);
  const wiz = party[1]!.id;
  const rog = party[3]!.id;

  it('Something New wants a spell nobody has cast this run', () => {
    const s = scene(OPEN, party, ['goblin-warrior']);
    const cast = (spellId: string): GameEvent =>
      ({ type: 'spellCast', casterId: wiz, spellId, slotLevel: 1, targets: [] } as unknown as GameEvent);
    expect(byId('something-new').earned(ctx([cast('magic-missile')], s))).toBe(true);
    expect(byId('something-new').earned(
      ctx([cast('magic-missile')], s, { spellsUsedBefore: new Set(['magic-missile']) }),
    ), 'already used this run').toBe(false);
    // A cantrip is not a decision — Fire Bolt is what a wizard does anyway.
    expect(byId('something-new').earned(ctx([cast('fire-bolt')], s)), 'cantrip').toBe(false);
  });

  it('Caught Together counts bodies in the burst, not failed saves', () => {
    const s = scene(OPEN, party, ['goblin-warrior', 'goblin-warrior', 'goblin-warrior']);
    const hit = (targetId: string): GameEvent =>
      ({ type: 'damageDealt', targetId, sourceId: wiz, amount: 5, damageType: 'fire', rolls: [5] } as GameEvent);
    const spell = { type: 'spellCast', casterId: wiz, spellId: 'burning-hands', slotLevel: 1, targets: [] } as unknown as GameEvent;
    expect(byId('caught-together').earned(ctx([spell, hit('f0'), hit('f1'), hit('f2')], s))).toBe(true);
    expect(byId('caught-together').earned(ctx([spell, hit('f0'), hit('f1')], s)), 'only two').toBe(false);
    // Three across two casts is three single-target hits, not an area spell.
    expect(byId('caught-together').earned(
      ctx([spell, hit('f0'), hit('f1'), spell, hit('f2')], s)), 'split over two casts').toBe(false);
    // Damage to our own does not count toward catching enemies.
    expect(byId('caught-together').earned(
      ctx([spell, hit('f0'), hit('f1'), hit(party[0]!.id)], s)), 'friendly fire').toBe(false);
  });

  it('From the Shadows wants the hide first, and does not pay a plain Sneak Attack', () => {
    const s = scene(COVERED, party, ['goblin-warrior']);
    const hide = { type: 'hideCheck', combatantId: rog, natural: 15, total: 20, success: true } as GameEvent;
    const blown = { type: 'hiddenRevealed', combatantId: rog, observerId: 'f0', passivePerception: 12, hideCheck: 20 } as GameEvent;
    const sneak = {
      type: 'damageDealt', targetId: 'f0', sourceId: rog, amount: 9,
      damageType: 'piercing', rolls: [4, 5], tags: ['Sneak Attack'],
    } as GameEvent;
    expect(byId('from-the-shadows').earned(ctx([hide, sneak], s))).toBe(true);
    expect(byId('from-the-shadows').earned(ctx([sneak], s)), 'no hide').toBe(false);
    expect(byId('from-the-shadows').earned(ctx([hide, blown, sneak], s)), 'spotted first').toBe(false);
    const failed = { ...hide, success: false } as GameEvent;
    expect(byId('from-the-shadows').earned(ctx([failed, sneak], s)), 'the hide failed').toBe(false);
  });

  it('Wrath Held pays for the target, not the smite', () => {
    const pal = [buildCharacter({ classId: 'paladin', team: 'team1', level: 3, name: 'P', position: { x: 1, y: 1 }, speciesId: 'human' })];
    const s = scene(OPEN, pal, ['skeleton', 'wolf']);
    const smite = (targetId: string): GameEvent =>
      ({ type: 'smited', attackerId: pal[0]!.id, targetId, spellId: 'divine-smite', slotLevel: 1, amount: 9, crit: false } as GameEvent);
    expect(byId('wrath-held').earned(ctx([smite('f0')], s)), 'the skeleton').toBe(true);
    expect(byId('wrath-held').earned(ctx([smite('f1')], s)), 'the wolf').toBe(false);
  });

  it('Dug In wants the enemy shooting into cover, not us', () => {
    const s = scene(COVERED, party, ['scout']);
    const shot = (targetId: string, cover: boolean): GameEvent => ({
      type: 'attackRolled', attackerId: 'f0', targetId, weaponId: 'shortbow',
      natural: 10, total: 14, targetAc: 16, mode: 'flat', advSources: [], disSources: [],
      hit: false, crit: false, opportunity: false, ...(cover ? { cover: true } : {}),
    });
    expect(byId('dug-in').earned(ctx([shot(party[0]!.id, true)], s))).toBe(true);
    expect(byId('dug-in').earned(ctx([shot(party[0]!.id, false)], s)), 'no barricade on the line').toBe(false);
    expect(byId('dug-in').earned(ctx([shot('f0', true)], s)), 'us shooting them').toBe(false);
  });

  it('Into the Fire wants an enemy in it, and hazard damage is tagged so it can tell', () => {
    const s = scene(FIERY, party, ['goblin-warrior']);
    const burn = (targetId: string, tagged: boolean): GameEvent => ({
      type: 'damageDealt', targetId, sourceId: targetId, amount: 3, damageType: 'fire',
      rolls: [3], ...(tagged ? { tags: ['Hazard'] } : {}),
    } as GameEvent);
    expect(byId('into-the-fire').earned(ctx([burn('f0', true)], s))).toBe(true);
    expect(byId('into-the-fire').earned(ctx([burn('f0', false)], s)), 'ordinary fire damage').toBe(false);
    expect(byId('into-the-fire').earned(ctx([burn(party[0]!.id, true)], s)), 'we walked into it').toBe(false);
  });

  it('Quick Work scales its clock with the headcount', () => {
    const s = scene(OPEN, party, ['goblin-warrior']);
    expect(roundsAllowed(2)).toBe(4);
    expect(roundsAllowed(6)).toBe(6);
    expect(byId('quick-work').earned(ctx([], s, { rounds: 4, foes: 2 }))).toBe(true);
    expect(byId('quick-work').earned(ctx([], s, { rounds: 5, foes: 2 }))).toBe(false);
    expect(byId('quick-work').earned(ctx([], s, { rounds: 5, foes: 6 })), 'more bodies, more rope').toBe(true);
  });

  it('Unbroken is lost the moment a hero drops, and is not about the enemy', () => {
    const s = scene(OPEN, party, ['goblin-warrior']);
    const down = (combatantId: string): GameEvent => ({ type: 'downed', combatantId } as GameEvent);
    expect(byId('unbroken').earned(ctx([], s)), 'nobody fell').toBe(true);
    expect(byId('unbroken').earned(ctx([down('f0')], s)), 'a goblin fell').toBe(true);
    expect(byId('unbroken').earned(ctx([down(party[0]!.id)], s))).toBe(false);
    expect(byId('unbroken').earned(
      ctx([{ type: 'died', combatantId: party[0]!.id } as GameEvent], s))).toBe(false);
  });

  it('is offered to any party at all, so nobody sees an empty board', () => {
    const lone = [buildCharacter({ classId: 'fighter', team: 'team1', level: 1, name: 'X', position: { x: 1, y: 1 }, speciesId: 'human' })];
    const s = scene(OPEN, lone, ['goblin-warrior']);
    const always = BOUNTIES.filter((b) => b.eligible(lone, s)).map((b) => b.id);
    expect(always.sort()).toEqual(['quick-work', 'unbroken']);
  });

  it('claimedBounties only pays what was offered', () => {
    const s = scene(OPEN, party, ['goblin-warrior']);
    const c = ctx([], s, { rounds: 1, foes: 2 });
    expect(claimedBounties([byId('quick-work')], c).map((b) => b.id)).toEqual(['quick-work']);
    expect(claimedBounties([byId('dug-in')], c), 'earned but not offered').toEqual([]);
  });
});

describe('the run remembers what was cast', () => {
  const party = buildParty('team1', 1, 3);

  it('records leveled party spells and ignores cantrips and the enemy', () => {
    const s = scene(OPEN, party, ['goblin-warrior']);
    const events = [
      { type: 'spellCast', casterId: party[1]!.id, spellId: 'magic-missile', slotLevel: 1, targets: [] },
      { type: 'spellCast', casterId: party[1]!.id, spellId: 'fire-bolt', slotLevel: 0, targets: [] },
      { type: 'spellCast', casterId: 'f0', spellId: 'magic-missile', slotLevel: 1, targets: [] },
    ] as unknown as GameEvent[];
    expect(spellsCastBy(events, s)).toEqual(['magic-missile']);
  });

  it('accumulates across a lost fight too, so a retry cannot re-claim it', () => {
    let run = newArenaRun(1);
    run = recordResult(run, false, 0, { spellsUsed: ['web'], bounties: 0 });
    expect(run.spellsUsed).toEqual(['web']);
    run = recordResult(run, true, 50, { spellsUsed: ['web', 'sleep'], bounties: 2 });
    expect(run.spellsUsed.sort()).toEqual(['sleep', 'web']);
    expect(run.bounties).toBe(2);
  });

  it('spots fiends and undead in a wave roster, for the pre-wave hint', () => {
    expect(unholyIn(['skeleton', 'wolf'])).toBe(true);
    expect(unholyIn(['wolf', 'goblin-warrior'])).toBe(false);
  });
});

/**
 * Bounties are not new income — that would be a difficulty change wearing a
 * content change's clothes. `wavePurse` came down to pay for them, so a player
 * who claims about one bounty a wave earns what the old purse paid.
 */
describe('gold is redistributed, not added', () => {
  const OLD = (level: number, wave: number) =>
    Math.round(40 + buildWave(1, level, wave).budget * 0.02);
  /** What a player claiming one of the two offered gets, on average. */
  const meanShare = BOUNTIES.reduce((g, b) => g + b.share, 0) / BOUNTIES.length;

  it('pays one claimed bounty a wave about what the old flat purse paid', () => {
    for (const level of [1, 3, 5, 7]) {
      for (const wave of [1, 6, 12, 18]) {
        const now = wavePurse(level, wave) * (1 + meanShare);
        const then = OLD(level, wave);
        expect(Math.abs(now - then) / then, `L${level} wave ${wave}: ${then} -> ${Math.round(now)}`)
          .toBeLessThan(0.12);
      }
    }
  });

  it('makes ignoring bounties poorer and claiming both richer, at every tier', () => {
    for (const level of [1, 3, 5, 7]) {
      for (const wave of [1, 10, 20]) {
        const purse = wavePurse(level, wave);
        const old = OLD(level, wave);
        expect(purse, `L${level} wave ${wave}`).toBeLessThan(old);
        // The two cheapest bounties in the table, claimed together.
        const cheapest = [...BOUNTIES].sort((a, b) => a.share - b.share).slice(0, 2);
        const both = purse + cheapest.reduce((g, b) => g + bountyGold(b, purse), 0);
        expect(both, `L${level} wave ${wave}`).toBeGreaterThan(old);
      }
    }
  });

  /**
   * The reason payouts are a share rather than a table of coins: a flat 60 gold
   * is the entire purse of a first wave and a ninth of a late one.
   */
  it('keeps a bounty worth a similar slice of the purse at every tier', () => {
    const b = BOUNTIES[0]!;
    const early = bountyGold(b, wavePurse(1, 1)) / wavePurse(1, 1);
    const late = bountyGold(b, wavePurse(7, 20)) / wavePurse(7, 20);
    expect(Math.abs(early - late), `${early} vs ${late}`).toBeLessThan(0.06);
  });

  it('never pays a bounty less than it costs to walk over to it', () => {
    for (const b of BOUNTIES) expect(bountyGold(b, wavePurse(1, 1)), b.id).toBeGreaterThanOrEqual(10);
  });
});

describe('every bounty is well-formed', () => {
  it('has a unique id, a blurb that instructs, and gold in band', () => {
    const ids = BOUNTIES.map((b) => b.id);
    expect(new Set(ids).size, 'duplicate bounty id').toBe(ids.length);
    for (const b of BOUNTIES) {
      expect(b.name.length, b.id).toBeGreaterThan(2);
      expect(b.blurb.endsWith('.'), `${b.id}: "${b.blurb}"`).toBe(true);
      // Wide enough to differentiate, narrow enough that none dominates a wave.
      expect(b.share, b.id).toBeGreaterThanOrEqual(0.25);
      expect(b.share, b.id).toBeLessThanOrEqual(0.55);
    }
  });

  it('names nothing the dice decide — no crits, no saves', () => {
    // The standard this table is held to, asserted where it can be: the blurbs
    // describe inputs (cast, catch, hide, smite, win fast), never outcomes.
    for (const b of BOUNTIES) {
      expect(/crit|save|miss|luck/i.test(b.blurb), `${b.id}: "${b.blurb}"`).toBe(false);
    }
  });
});
