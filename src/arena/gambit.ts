/**
 * One skill check before the fight, and whether you take it.
 *
 * The arena had two pre-fight checks and neither worked. The knowledge study
 * (lore.ts) cost nothing to fail, so it was a free button nobody had a reason
 * not to press. The creep-in (ambush.ts) was a real gamble on paper and worth
 * nothing in practice: surprise is the 2024 rule, disadvantage on one initiative
 * roll, and three separate runs put it at a swing of two points. Meanwhile
 * twelve of the game's eighteen skills did nothing here at all.
 *
 * So: ONE check, drawn from the ones this particular fight licenses, offered
 * once, take it or leave it. Success makes the fight easier and failure makes
 * it harder, by amounts that were measured rather than guessed.
 *
 * WHY ONE, AND WHY NOT TWO
 *
 * Two offers looks more generous and is worth less. A party optimises to its
 * best skill and takes that one every time, so breadth buys nothing and the
 * yes/no goes trivial as well — the better of two options nearly always clears
 * the odds. A single forced offer makes both decisions real, and it is the only
 * version where having a wide spread of proficiencies pays. Measured across
 * three party builds: a broad party holds a gamble worth taking 19-25 points
 * more often than a narrow one at levels 3 through 7.
 *
 * WHY THE DRAW IGNORES THE PARTY
 *
 * Weighting the draw toward what the party is good at is the tempting knob and
 * it undoes the whole thing — it hands them their best skill and we are back to
 * two-choice minus the choice. The pool comes from the roster and the ground
 * only.
 *
 * WHAT THE POOL IS BUILT FROM, AND WHAT IT IS NOT
 *
 * Creature type and size, because those are what actually vary between waves:
 * measured over 8,640 generated fights, every creature type lands between 5%
 * and 25%, and sizes between 13% and 85%. Terrain does not vary — 96.9% of
 * boards carry cover and 100% carry difficult ground — so any rule reading it
 * is a rule that fires always. Nor does Intelligence: 80% of waves field
 * something with Int 10 or better. The first draft of this table hung most of
 * its rules on terrain and Int and produced a pool eleven skills wide with five
 * of them eligible in every single fight, which is not "this fight licenses
 * these skills", it is "everything, always".
 *
 * With type and size the pool averages 4.8 skills, no skill appears in more
 * than 56% of fights or fewer than 15%, and 0.5% of fights license nothing at
 * all — which is a quiet no-offer, not a bug.
 */
import type { Id, Combatant, GridState, Position, TeamId, CreatureType, CreatureSize } from '../engine/types.js';
import { cellAt } from '../engine/types.js';
import { blocksMovement } from '../engine/grid.js';
import { MONSTERS, buildMonster } from '../data/monsters.js';
import type { SkillId } from '../data/classes.js';
import type { DayHalf } from './run.js';

/** What the fight looks like, for deciding which skills it licenses. */
export interface GambitContext {
  members: readonly Id[];
  types: Set<CreatureType>;
  sizes: Set<CreatureSize>;
  /** Cover squares on the board — the one terrain reading that discriminates. */
  cover: number;
  count: number;
  /** Is anyone in the party below full health? Medicine's whole premise. */
  hurt: boolean;
}

export function gambitContext(
  members: readonly Id[], grid: GridState, hurt: boolean,
): GambitContext {
  const types = new Set<CreatureType>();
  const sizes = new Set<CreatureSize>();
  for (const id of members) {
    const m = MONSTERS[id];
    if (!m) continue;
    types.add(m.creatureType);
    sizes.add(m.size);
  }
  return {
    members, types, sizes,
    cover: grid.cells.filter((c) => c.terrain === 'cover').length,
    count: members.length,
    hurt,
  };
}

/** Mutates the combatants before the fight starts. */
export type GambitEffect = (
  party: Combatant[], foes: Combatant[], grid: GridState, members: readonly Id[],
) => void;

export interface GambitDef {
  skill: SkillId;
  /** Overrides the skill's own name on the button, where a verb reads better. */
  label?: string;
  /**
   * What the player is being offered, in the DM's voice.
   *
   * It must be true of EVERY wave that passes the gate, because it is shown
   * before the roll and the wave is generated. No species, no counts, no
   * uniforms — the gate promises "a beast is present", so the line can say
   * "there are animals out there" and nothing more specific. And it has to read
   * as an opportunity rather than an event, because declining is a real move.
   */
  setup: string;
  won: string;
  lost: string;
  eligible(w: GambitContext): boolean;
  onSuccess: GambitEffect;
  onFailure: GambitEffect;
}

const any = <K,>(s: Set<K>, ...ks: K[]) => ks.some((k) => s.has(k));
const cond = (c: Combatant, id: Combatant['conditions'][number]['id']) => c.conditions.push({ id });
const weakest = (foes: Combatant[], n: number) =>
  [...foes].sort((a, b) => a.maxHp - b.maxHp).slice(0, n);
const champion = (foes: Combatant[]) => [...foes].sort((a, b) => b.maxHp - a.maxHp).slice(0, 1);
const half = (foes: Combatant[]) => weakest(foes, Math.max(1, Math.ceil(foes.length / 2)));

/** A fifth of everyone's health, never fatal. */
const bleed: GambitEffect = (p) => {
  for (const c of p) c.hp = Math.max(1, c.hp - Math.floor(c.maxHp * 0.2));
};
/** A fifth of maximum, as temporary hit points. */
const dose: GambitEffect = (p) => {
  for (const c of p) c.tempHp = (c.tempHp ?? 0) + Math.floor(c.maxHp * 0.2);
};

/**
 * A free, walkable square on or near one of `rows`, avoiding everyone placed.
 *
 * `startCombat` throws on a combatant standing in a wall OR a barricade —
 * `cover` blocks movement exactly as a wall does — and the wave picks its own
 * board, so the spot has to be found rather than assumed.
 */
function freeCell(grid: GridState, taken: Combatant[], rows: number[]): Position | undefined {
  for (const y of rows) {
    if (y < 0 || y >= grid.height) continue;
    for (let x = 0; x < grid.width; x++) {
      const cell = cellAt(grid, { x, y });
      if (!cell || blocksMovement(cell.terrain)) continue;
      if (taken.some((c) => c.position.x === x && c.position.y === y)) continue;
      return { x, y };
    }
  }
  return undefined;
}

/**
 * The creature that could have gone either way.
 *
 * The WEAKEST thing in the wave, scaled to the fight by definition. Copying the
 * median member instead swung 47 points — half an encounter — where the weakest
 * swings 22, which is the top of the usable band and no more.
 *
 * Success puts a copy on your side, failure adds one to theirs. That is the
 * only honestly symmetric form of "it fights for you or against you" — the same
 * creature either way — and it is why this is the evenest pair in the table
 * while everything else had to be tuned.
 *
 * IT ARRIVES FRIGHTENED, AND THAT IS THE ONLY DIAL THIS OUTCOME HAS.
 *
 * At full strength the pair swung 22 points, the loudest entry in a table whose
 * next-largest is 16 — and three skills use it. There is no smaller creature
 * than the weakest, so size is not available. Two ways down were measured:
 *
 *   success REMOVES one of theirs      +11 / -11, swing 22 — no smaller at all.
 *                                      Losing an enemy is worth exactly what
 *                                      gaining an ally is, which is not what I
 *                                      expected and is why it was measured.
 *   the newcomer arrives frightened     +9 /  -9, swing 18, tilt 0.
 *
 * So it comes over, and it attacks at disadvantage until it settles. Which is
 * also the better story: nobody changes sides mid-battle with their whole heart
 * in it.
 */
function recruitOnto(
  team: TeamId, party: Combatant[], foes: Combatant[], grid: GridState, members: readonly Id[],
): Combatant | undefined {
  const sorted = [...foes].sort((a, b) => a.maxHp - b.maxHp);
  const pick = sorted[0];
  if (!pick) return undefined;
  const monsterId = members[foes.indexOf(pick)];
  if (!monsterId) return undefined;
  const rows = team === 'team1' ? [1, 2, 0, 3] : [grid.height - 3, grid.height - 2, grid.height - 4];
  const at = freeCell(grid, [...party, ...foes], rows);
  if (!at) return undefined;
  const c = buildMonster(monsterId, team, at, `gambit-${team}`);
  cond(c, 'frightened');
  return c;
}

const RECRUIT_US: GambitEffect = (p, f, grid, m) => {
  const r = recruitOnto('team1', p, f, grid, m);
  if (r) p.push(r);
};
const RECRUIT_THEM: GambitEffect = (p, f, grid, m) => {
  const r = recruitOnto('team2', p, f, grid, m);
  if (r) f.push(r);
};

/**
 * The table. Every number in the comments is a measured win-rate delta at
 * n=400 per level, paired against the same fights without the effect, across
 * levels 3, 5 and 7 — see scripts/gambit-price.ts.
 *
 * TWO RULES THE MEASUREMENTS FORCED
 *
 * Defensive outcomes must cover the WHOLE party; offensive ones may be partial.
 * Warding all four heroes is worth +8 and warding two is worth +1, because the
 * AI simply attacks whoever is softest and routes around a partial guard.
 * Frightening half the enemy is still worth the full amount, because you have
 * to kill all of them regardless.
 *
 * And a pair is never priced by mirroring it. Every symmetric-looking pair
 * measured differently in each direction — `outlined` is +6 on them and -14 on
 * you, `blessed` is +7 on you and -17 on them — so both halves of every entry
 * below were measured separately.
 */
export const GAMBITS: GambitDef[] = [
  {
    skill: 'persuasion',
    setup: 'Not everyone out there looks committed to this. You could try talking to one of them before the shouting starts.',
    won: 'One of them takes the offer and comes over, looking far from happy about it.',
    lost: 'Word gets passed along, and someone else is sent over to see what you are up to.',
    eligible: (w) => any(w.types, 'humanoid', 'celestial'),
    onSuccess: RECRUIT_US,     // +10
    onFailure: RECRUIT_THEM,   // -11
  },
  {
    skill: 'animal-handling', label: 'Animal Handling',
    setup: 'There are animals out there, and animals can sometimes be talked round. You could try, if you know how.',
    won: 'One of them comes over to your side, wary of everyone including you.',
    lost: 'You get its attention, and it brings company.',
    eligible: (w) => w.types.has('beast'),
    onSuccess: RECRUIT_US,
    onFailure: RECRUIT_THEM,
  },
  {
    skill: 'performance', label: 'Perform',
    setup: 'Some of them out there have ears and nothing to listen to. You could give them something.',
    won: 'One drifts over to hear the rest of it, and stays — though its heart is not in the fight.',
    lost: 'The noise carries, and something else comes to find out what is making it.',
    eligible: (w) => any(w.types, 'fey', 'humanoid'),
    onSuccess: RECRUIT_US,
    onFailure: RECRUIT_THEM,
  },
  {
    skill: 'intimidation', label: 'Intimidate',
    setup: 'They can hear you from here. You could explain, in detail, what a bad idea this is.',
    won: 'It lands. Several of them fight like people looking for the exit.',
    lost: 'It does not. Several of them fight like people with something to prove.',
    eligible: (w) => any(w.types, 'humanoid', 'giant', 'fey'),
    onSuccess: (_p, f) => half(f).forEach((c) => cond(c, 'frightened')),   // +10
    onFailure: (_p, f) => half(f).forEach((c) => cond(c, 'blessed')),      // -6
  },
  {
    skill: 'religion',
    setup: 'Whatever is out there answers to something older than itself. You could try addressing that instead.',
    won: 'You get the words right, and something takes your side of it.',
    lost: 'You get the words wrong, and something takes theirs.',
    eligible: (w) => any(w.types, 'undead', 'fiend', 'celestial', 'fey'),
    onSuccess: (p) => p.forEach((c) => cond(c, 'blessed')),   // +7
    onFailure: (p) => p.forEach((c) => cond(c, 'baned')),     // -7
  },
  {
    skill: 'deception',
    setup: 'They do not know what you look like yet. You could arrive as something other than an enemy.',
    won: 'It holds long enough. The nearest of them hesitate.',
    lost: 'It does not. The biggest one is expecting you now.',
    eligible: (w) => any(w.types, 'humanoid', 'fiend', 'fey'),
    onSuccess: (_p, f) => weakest(f, 2).forEach((c) => cond(c, 'frightened')),   // +6
    onFailure: (_p, f) => champion(f).forEach((c) => cond(c, 'blessed')),        // -8
  },
  {
    skill: 'investigation',
    setup: 'Whatever is animating those was made, or raised, by somebody. You could take a few minutes and work out how.',
    won: 'You find the seams, and where it is safest to stand.',
    lost: 'You learn nothing useful, and they spend the time getting ready.',
    eligible: (w) => any(w.types, 'construct', 'undead'),
    // +8 / -5. Both halves of this were reading zero on the enemy side until
    // acOf was fixed to let a stat block's armour class change at all.
    onSuccess: (p) => p.forEach((c) => cond(c, 'warded')),
    onFailure: (_p, f) => f.forEach((c) => cond(c, 'warded')),
  },
  {
    skill: 'athletics',
    setup: 'Something out there is far too big for the ground it has to cross. You could make that ground worse.',
    won: 'You get it set in time and dig in behind it.',
    lost: 'It goes wrong, and you take the weight of it.',
    eligible: (w) => w.sizes.has('huge') || w.types.has('giant'),
    onSuccess: (p) => p.forEach((c) => { c.tempHp = (c.tempHp ?? 0) + 10; }),   // +9
    onFailure: bleed,                                                          // -5
  },
  {
    skill: 'medicine',
    setup: 'Some of you are in worse shape than you would like. There is time to do something about that, if you trust whoever is doing it.',
    won: 'It works. Everyone starts steadier than they would have.',
    lost: 'It does not. Everyone starts worse off.',
    eligible: (w) => w.hurt,
    onSuccess: dose,     // +7
    onFailure: bleed,    // -5
  },
  {
    skill: 'acrobatics',
    setup: 'There are more of them than there is space. You could pick your route through now, while there still is one.',
    won: 'You come through the gap, and the nearest of them flinch.',
    lost: 'You misjudge it and finish up surrounded.',
    eligible: (w) => w.count >= 5,
    onSuccess: (_p, f) => weakest(f, 2).forEach((c) => cond(c, 'frightened')),   // +6
    onFailure: bleed,                                                           // -5
  },
  {
    skill: 'survival',
    setup: 'Something came through here ahead of you, and it left signs. You could read them.',
    won: 'You read them right and meet it on your terms.',
    lost: 'You read them wrong and spend the time getting nowhere.',
    // Plant was in this gate and is cut: a creeping vine leaves no trail, and
    // the line above has to be true of every wave that reaches it.
    eligible: (w) => any(w.types, 'beast', 'monstrosity'),
    onSuccess: (_p, f) => f.forEach((c) => cond(c, 'sapped')),   // +5
    onFailure: bleed,                                           // -5
  },
  {
    skill: 'perception',
    setup: 'There is very little cover out here, which cuts both ways. You could take a proper look before committing.',
    won: 'You see them coming, and their first swings arrive telegraphed.',
    lost: 'You call it wrong twice, and nobody trusts the third time.',
    eligible: (w) => w.cover <= 2,
    /*
     * `outlined` was the obvious fit and had to go: measured +8 / +9 / +2 across
     * levels 3, 5 and 7, so it faded to nothing exactly where the rest of the
     * table holds flat, and it dragged both this and Acrobatics down with it.
     * Two same-sized replacements were measured and both hold: `sapped` at
     * +8 / +4 / +4 and two-weakest-frightened at +8 / +7 / +5. Split between
     * the two skills by which one the fiction actually describes.
     */
    onSuccess: (_p, f) => f.forEach((c) => cond(c, 'sapped')),   // +5
    onFailure: (p) => p.forEach((c) => cond(c, 'sapped')),       // -4
  },
];

/**
 * How hard this fight is to talk to, sneak up on or read.
 *
 * Scales with the THREAT, not the party level — but gently, and capped, which
 * is the part that took measuring. Three rules were tried against three party
 * builds at levels 1 to 7:
 *
 *   10 + CR (the loreDc shape)   98% of offers worth taking at level 1, 21% at
 *                                level 7. Arena threat outruns proficiency, the
 *                                DC pins to its cap and the feature goes dead.
 *   flat 13                      86% worth taking everywhere, and the advantage
 *                                for a BROAD party goes NEGATIVE — at a low DC
 *                                everyone clears on raw ability scores and being
 *                                proficient never decides anything.
 *   13 + CR/3, cap 17            43-75% worth taking across the range, with a
 *                                19-25 point advantage for the broad party.
 *
 * The lesson is not "threat versus level". It is that the DC has to sit in the
 * band where PROFICIENCY is what clears it, or the check stops asking anything
 * about the party you built.
 */
export function gambitDc(members: readonly Id[]): number {
  const cr = members.reduce((a, id) => Math.max(a, MONSTERS[id]?.cr ?? 0), 0);
  return Math.min(17, 13 + Math.ceil(cr / 3));
}

/** Every gambit this fight licenses, in table order. */
export function eligibleGambits(w: GambitContext): GambitDef[] {
  return GAMBITS.filter((g) => g.eligible(w));
}

/**
 * The one gambit on offer, drawn uniformly from the eligible pool.
 *
 * Seeded off the run, the day, the half AND the door, because the offer
 * describes the roster behind that door. The attempt is then recorded with its
 * door (see `GambitAttempt`), which is what stops the player opening each gate
 * in turn to shop for a skill they are good at — the same rule the creep-in
 * used, for the same reason.
 */
export function drawGambit(
  runSeed: number, day: number, half: DayHalf, door: number, w: GambitContext,
): GambitDef | undefined {
  const pool = eligibleGambits(w);
  if (pool.length === 0) return undefined;
  const mix = (runSeed * 2654435761 + day * 40503 + door * 2246822519 +
    (half === 'afternoon' ? 1013904223 : 0)) >>> 0;
  return pool[mix % pool.length];
}

/** The one attempt made for this fight, recorded so it cannot be repeated. */
export interface GambitAttempt {
  /** Day and half, so it belongs to exactly one fight. */
  key: string;
  /** The door it was taken at — it only applies if you fight that one. */
  door: number;
  skill: SkillId;
  by: number;
  natural: number;
  total: number;
  dc: number;
  success: boolean;
}

export function gambitKey(day: number, half: DayHalf): string {
  return `${day}:${half}`;
}

/** The attempt made for this fight, or undefined if nobody has tried. */
export function attemptFor(
  stored: GambitAttempt | undefined, day: number, half: DayHalf,
): GambitAttempt | undefined {
  return stored && stored.key === gambitKey(day, half) ? stored : undefined;
}

/**
 * Apply a settled gambit to the combatants, before the fight starts.
 *
 * Does nothing unless the attempt belongs to this fight AND to the door being
 * fought — change your mind about the door and the check was for the other
 * gate, exactly as the creep-in behaved.
 */
export function applyGambit(
  attempt: GambitAttempt | undefined, door: number,
  party: Combatant[], foes: Combatant[], grid: GridState, members: readonly Id[],
): void {
  if (!attempt || attempt.door !== door) return;
  const def = GAMBITS.find((g) => g.skill === attempt.skill);
  if (!def) return;
  (attempt.success ? def.onSuccess : def.onFailure)(party, foes, grid, members);
}
