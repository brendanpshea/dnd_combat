/**
 * Arena bounties: two side-objectives named before a wave, paid in gold after
 * it.
 *
 * The arena's loop was "win, take the purse, buy something, win again". A
 * bounty gives the pre-wave screen something to plan around, which is the
 * difference between a queue of fights and a run.
 *
 * TWO RULES DECIDE WHAT BELONGS HERE.
 *
 * Reward the input, not the output. Placement, targeting, sequencing and what
 * you spend are decisions; whether the save failed is dice. So "catch three
 * enemies in one area spell" is a bounty and "stun three enemies" is not, and
 * a critical hit is never one — the crit is its own reward already.
 *
 * And it has to be something the Hint button would not simply tell you to do.
 * Paying a player for the move they were going to make anyway is paying for
 * compliance. Every bounty below is in some tension with just winning: holding
 * a smite for the right target, spending a turn behind a barricade, reaching
 * for a spell that is not your best one.
 *
 * The gold is not new income. `wavePurse` came down by exactly the average
 * bounty share (see run.ts), so a player who claims about one of the two on
 * offer earns what the old purse paid, one who ignores them earns a little
 * less, and one who chases both earns a little more. Otherwise this would be a
 * difficulty change wearing a content change's clothes.
 *
 * NONE OF THESE IS DEAD DATA — MEASURED, NOT ASSUMED. A bounty nobody can claim
 * is this codebase's recurring failure mode, so every entry was checked against
 * real fights: 30 level-3 arena waves driven by the simulating AI, counting how
 * often each was *earnable* rather than how often it happened to be offered.
 * Out of 23 wins, with nobody trying to claim anything: Something New 23,
 * Unbroken 10, Caught Together 8, Quick Work 6, Dug In 3, From the Shadows 3,
 * Into the Fire 1. (Wrath Held needs a paladin, which the measured party lacks.)
 *
 * From the Shadows read 0-for-6 on the offered/claimed columns first time round
 * and looked dead. It was not: the rogue hid and struck out of hiding in four
 * separate fights, and the seeded draw simply never offered the bounty in one
 * of them. Worth stating because the thin column was the misleading number and
 * the reachability count was the honest one.
 */
import type { Combatant, GameState, Id } from '../engine/types.js';
import type { GameEvent } from '../engine/events.js';
import { SPELLS } from '../data/spells.js';
import { MONSTERS } from '../data/monsters.js';
import { next, type RngState } from '../engine/rng.js';

export interface BountyContext {
  /** Everything that happened, in order. */
  events: GameEvent[];
  /** The board as the fight ended. */
  state: GameState;
  /** The party as it deployed — some of them may be down by now. */
  party: Combatant[];
  /** Spell ids anyone has already cast earlier in this run. */
  spellsUsedBefore: ReadonlySet<Id>;
  /** Rounds the fight lasted. */
  rounds: number;
  /** Enemies the wave started with. */
  foes: number;
}

export interface Bounty {
  id: Id;
  name: string;
  /** Shown before the fight — an instruction, not a riddle. */
  blurb: string;
  /**
   * Paid as a share of the wave's purse, not a flat number of coins. A flat 60
   * gold is the entire purse of a first wave and a ninth of a late one, so a
   * fixed table would make bounties the only thing that mattered early and
   * noise later. See `bountyGold`.
   */
  share: number;
  /**
   * Can this party earn it at all? A bounty nobody can claim is worse than no
   * bounty: it reads as a tax. The rogue and paladin ones are gated on the
   * class being present, and the terrain ones on the map actually having the
   * terrain.
   */
  eligible(party: Combatant[], state: GameState): boolean;
  earned(ctx: BountyContext): boolean;
}

const partyHas = (party: Combatant[], featureId: Id): boolean =>
  party.some((c) => c.featureIds.includes(featureId));

const hasTerrain = (state: GameState, t: string): boolean =>
  state.grid.cells.some((c) => c.terrain === t);

const isOurs = (ctx: BountyContext, id: Id | undefined): boolean =>
  id !== undefined && ctx.state.combatants[id]?.team === 'team1';

export const BOUNTIES: Bounty[] = [
  {
    /**
     * The one that fixes a structural problem rather than adding flavour.
     * Both players and the AI converge on a single good spell and leave whole
     * tiers unused — Ice Storm was offered 843 times across thirty measured
     * fights and cast zero. Paying for breadth is the cheapest correction
     * available, and it costs the player a turn of worse damage to claim.
     */
    id: 'something-new',
    name: 'Something New',
    blurb: 'Cast a spell nobody has used this run.',
    share: 0.45,
    eligible: (party) => party.some((c) => c.spellIds.some((s) => (SPELLS[s]?.level ?? 0) >= 1)),
    earned: (ctx) => ctx.events.some((e) =>
      e.type === 'spellCast' && isOurs(ctx, e.casterId) &&
      (SPELLS[e.spellId]?.level ?? 0) >= 1 && !ctx.spellsUsedBefore.has(e.spellId)),
  },
  {
    /**
     * Positioning, paid directly. `attackRolled.cover` is set when the shot
     * crossed a barricade, so this is "an enemy took a shot at you and the
     * barricade made it worse for them" — which is the whole argument for
     * spending a turn getting behind one.
     */
    id: 'dug-in',
    name: 'Dug In',
    blurb: 'Make an enemy shoot at one of you from across a barricade.',
    share: 0.3,
    eligible: (_party, state) => hasTerrain(state, 'cover'),
    earned: (ctx) => ctx.events.some((e) =>
      e.type === 'attackRolled' && e.cover === true && isOurs(ctx, e.targetId)),
  },
  {
    /**
     * The rogue's actual loop — Hide, then strike out of it — rather than
     * "deal Sneak Attack damage", which happens by accident whenever an ally
     * stands nearby.
     *
     * Gated on the feature AND on the board having a barricade, because hiding
     * requires nothing having line of sight to you and a bare board offers
     * nowhere to do it. Offering this on an open field would be asking for
     * something the map does not allow.
     */
    id: 'from-the-shadows',
    name: 'From the Shadows',
    blurb: 'Land a Sneak Attack from hiding.',
    share: 0.5,
    eligible: (party, state) => partyHas(party, 'sneak-attack') && hasTerrain(state, 'cover'),
    earned: (ctx) => {
      // A hide that landed, then a Sneak Attack afterwards by the same rogue.
      const hidden = new Set<Id>();
      for (const e of ctx.events) {
        if (e.type === 'hideCheck' && e.success) hidden.add(e.combatantId);
        if (e.type === 'hiddenRevealed') hidden.delete(e.combatantId);
        if (e.type === 'damageDealt' && e.tags?.includes('Sneak Attack') && hidden.has(e.sourceId)) {
          return true;
        }
      }
      return false;
    },
  },
  {
    /**
     * A paladin's smite is a slot, and the interesting question is never
     * whether to use it but when. Fiends and undead are what a paladin is for,
     * so holding it for one — through a goblin, through a wolf — is the
     * decision this pays for.
     */
    id: 'wrath-held',
    name: 'Wrath Held',
    blurb: 'Smite a fiend or the undead.',
    share: 0.45,
    eligible: (party, state) => partyHas(party, 'divine-smite') &&
      Object.values(state.combatants).some(
        (c) => c.team === 'team2' && (c.creatureType === 'fiend' || c.creatureType === 'undead')),
    earned: (ctx) => ctx.events.some((e) => {
      if (e.type !== 'smited') return false;
      const t = ctx.state.combatants[e.targetId];
      return t?.creatureType === 'fiend' || t?.creatureType === 'undead';
    }),
  },
  {
    /**
     * Area placement, with the dice taken out: it counts how many enemies were
     * *in* the burst, not how many failed the save. Catching three is a
     * decision about where to stand and when to fire, which is the part worth
     * paying for.
     */
    id: 'caught-together',
    name: 'Caught Together',
    blurb: 'Catch three enemies in one spell.',
    share: 0.4,
    eligible: (party) => party.some((c) => c.spellIds.some((s) => {
      const kind = SPELLS[s]?.targeting.kind;
      return kind === 'sphere2x2' || kind === 'sphere5x5' || kind === 'cone15' ||
        kind === 'cube15' || kind === 'line15';
    })),
    earned: (ctx) => {
      // Enemies damaged in the window between one spellCast and the next.
      let casting = false;
      let hit = new Set<Id>();
      for (const e of ctx.events) {
        if (e.type === 'spellCast') {
          if (hit.size >= 3) return true;
          casting = isOurs(ctx, e.casterId);
          hit = new Set();
        } else if (casting && e.type === 'damageDealt' && !isOurs(ctx, e.targetId)) {
          hit.add(e.targetId);
        }
      }
      return hit.size >= 3;
    },
  },
  {
    /**
     * The floor of the table, and the only one every party is always offered.
     * Everything else here is gated on a class, a spell or a piece of terrain,
     * and a lone fighter on a bare board would otherwise be shown one bounty —
     * or none — which reads as the game having nothing to say to them.
     *
     * It earns its place on its own terms though. Winning is already the goal;
     * winning without anyone going down is a different fight, played by pulling
     * a wounded hero back rather than trading one more round of damage, and the
     * greedy thing to do is almost never the thing that claims it.
     */
    id: 'unbroken',
    name: 'Unbroken',
    blurb: 'Win without anyone going down.',
    share: 0.4,
    eligible: () => true,
    earned: (ctx) => !ctx.events.some((e) =>
      (e.type === 'downed' || e.type === 'died') && isOurs(ctx, e.combatantId)),
  },
  {
    /**
     * Urgency, and the counterweight to everything else here. Without a clock
     * the optimal way to claim a careful bounty is to take the fight slowly,
     * and a slow fight is the least interesting one the arena can produce.
     * Scaled by headcount so a six-body wave is not simply impossible.
     */
    id: 'quick-work',
    name: 'Quick Work',
    blurb: 'Win it fast.',
    share: 0.35,
    eligible: () => true,
    earned: (ctx) => ctx.rounds <= roundsAllowed(ctx.foes),
  },
  {
    /**
     * The reason to fight where the fire is. Enemies path around hazards, so
     * this is not something that happens on its own — it takes a push, a
     * Thunderwave, or a Command that walks them into it.
     */
    id: 'into-the-fire',
    name: 'Into the Fire',
    blurb: 'Make an enemy take hazard damage.',
    share: 0.45,
    eligible: (_party, state) => hasTerrain(state, 'hazard'),
    earned: (ctx) => ctx.events.some((e) =>
      e.type === 'damageDealt' && e.tags?.includes('Hazard') === true && !isOurs(ctx, e.targetId)),
  },
];

/**
 * What a bounty pays on a wave whose purse is `purse`.
 *
 * Rounded to five so the pre-wave screen shows a number a player can add up,
 * and floored at 10 so a first wave's bounties are still worth crossing the
 * board for.
 */
export function bountyGold(b: Bounty, purse: number): number {
  return Math.max(10, Math.round(b.share * purse / 5) * 5);
}

/** The round limit for Quick Work: three rounds, plus one per two enemies. */
export function roundsAllowed(foes: number): number {
  return 3 + Math.floor(foes / 2);
}

/**
 * The two bounties offered for a wave.
 *
 * Seeded off the run and wave the same way the wave itself is, so a retry
 * offers the same two — a wave you failed is a tactical problem to solve, not
 * a slot machine to reroll until the bounties are easy.
 */
export function bountiesFor(
  runSeed: number, wave: number, party: Combatant[], state: GameState,
): Bounty[] {
  const pool = BOUNTIES.filter((b) => b.eligible(party, state));
  let rng: RngState = (runSeed * 2654435761 + wave * 2246822519) >>> 0;
  const picked: Bounty[] = [];
  const rest = [...pool];
  while (picked.length < 2 && rest.length > 0) {
    const r = next(rng); rng = r.state;
    picked.push(...rest.splice(Math.floor(r.value * rest.length), 1));
  }
  return picked;
}

/** Which of the offered bounties the party actually claimed. */
export function claimedBounties(offered: Bounty[], ctx: BountyContext): Bounty[] {
  return offered.filter((b) => b.earned(ctx));
}

/** Every leveled spell cast by the party in a fight, for the run's record. */
export function spellsCastBy(events: GameEvent[], state: GameState): Id[] {
  const out = new Set<Id>();
  for (const e of events) {
    if (e.type !== 'spellCast') continue;
    if (state.combatants[e.casterId]?.team !== 'team1') continue;
    if ((SPELLS[e.spellId]?.level ?? 0) >= 1) out.add(e.spellId);
  }
  return [...out];
}

/** Monster ids in a wave that are fiends or undead — for the pre-wave hint. */
export function unholyIn(members: Id[]): boolean {
  return members.some((id) => {
    const t = MONSTERS[id]?.creatureType;
    return t === 'fiend' || t === 'undead';
  });
}
