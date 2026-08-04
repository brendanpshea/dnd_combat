/**
 * Is "one random skill check before each fight" a real decision?
 *
 * Two questions, and the second is the one that decides the design.
 *
 * 1. HOW WIDE IS THE POOL? The gambit is meant to be one check drawn from the
 *    ones this particular fight licenses. If the roster and the ground usually
 *    license two, "random of one" is the two-choice design minus the choice. If
 *    they license fifteen, the draw is uniform over the whole skill list and the
 *    connection to the fiction — the thing that was supposed to stop the check
 *    feeling arbitrary — is decorative.
 *
 * 2. HOW OFTEN DOES A PARTY HAVE A LIVE GAMBLE? A single forced offer is only a
 *    decision if the answer varies. If a normal party clears half the offers it
 *    is a free lunch; if it clears a tenth, the feature is inert most of a run
 *    and the "reward skill variety" argument never gets to fire.
 *
 * The rules below are driven by CREATURE TYPE and SIZE, because
 * `gambit-features.ts` measured what actually varies between waves: every type
 * lands between 5% and 25%, and sizes between 13% and 85%. Terrain does not —
 * 96.9% of boards carry cover and 100% carry difficult ground, so any rule
 * reading them is a rule that fires always. Nor does Intelligence: 80% of waves
 * have something with Int 10 or better on the field.
 *
 * Run: npx tsx scripts/gambit-pool.ts
 */
import { buildWave } from '../src/arena/run.js';
import { MONSTERS } from '../src/data/monsters.js';
import { parseMap } from '../src/data/maps.js';
import { newCampaign, setPartyClass, bestAtSkill } from '../src/campaign/campaign.js';
import type { CampaignState } from '../src/campaign/campaign.js';
import type { SkillId } from '../src/data/classes.js';
import type { CreatureType, CreatureSize, Id } from '../src/engine/types.js';

interface Ctx {
  types: Set<CreatureType>;
  sizes: Set<CreatureSize>;
  cover: number;
  count: number;
}

const any = <K,>(s: Set<K>, ...ks: K[]) => ks.some((k) => s.has(k));

/**
 * A draft eligibility table, written against the measured distributions.
 *
 * The `why` is the line the card would print, and it is the test of whether a
 * rule earns its place: if the sentence would be true of almost any fight, the
 * rule is decoration.
 */
const RULES: Array<{ skill: SkillId; why: string; eligible(w: Ctx): boolean }> = [
  { skill: 'stealth', why: 'cover enough to creep behind', eligible: (w) => w.cover >= 6 },
  { skill: 'animal-handling', why: 'beasts that might be calmed', eligible: (w) => w.types.has('beast') },
  { skill: 'intimidation', why: 'something that can be cowed', eligible: (w) => any(w.types, 'humanoid', 'giant', 'fey') },
  { skill: 'persuasion', why: 'something that might be bought off', eligible: (w) => any(w.types, 'humanoid', 'celestial', 'fey') },
  { skill: 'deception', why: 'something that can be fooled', eligible: (w) => any(w.types, 'humanoid', 'fiend', 'fey') },
  { skill: 'insight', why: 'something with a plan to read', eligible: (w) => any(w.types, 'humanoid', 'fiend', 'dragon') },
  { skill: 'performance', why: 'something with ears', eligible: (w) => any(w.types, 'fey', 'humanoid') },
  { skill: 'sleight-of-hand', why: 'pockets worth picking', eligible: (w) => w.types.has('humanoid') },
  { skill: 'survival', why: 'a trail to read', eligible: (w) => any(w.types, 'beast', 'plant', 'monstrosity') },
  { skill: 'investigation', why: 'something made, with a flaw in it', eligible: (w) => any(w.types, 'construct', 'undead') },
  { skill: 'athletics', why: 'something big to put on its back', eligible: (w) => any(w.sizes, 'huge') || w.types.has('giant') },
  { skill: 'acrobatics', why: 'a crowd to slip through', eligible: (w) => w.count >= 5 },
  { skill: 'perception', why: 'open ground and long sightlines', eligible: (w) => w.cover <= 2 },
];

function ctxFor(members: readonly Id[], map: Parameters<typeof parseMap>[0]): Ctx {
  const grid = parseMap(map);
  const types = new Set<CreatureType>();
  const sizes = new Set<CreatureSize>();
  for (const id of members) {
    const m = MONSTERS[id];
    if (!m) continue;
    types.add(m.creatureType);
    sizes.add(m.size);
  }
  return {
    types, sizes,
    cover: grid.cells.filter((c) => c.terrain === 'cover').length,
    count: members.length,
  };
}

/**
 * The DC, on the rule argued for over level-scaling: it tracks the THREAT, not
 * the party, so a specialist can outgrow it. Same shape as `loreDc`.
 */
const maxCr = (members: readonly Id[]): number =>
  members.reduce((a, id) => Math.max(a, MONSTERS[id]?.cr ?? 0), 0);

const dcFor = (members: readonly Id[]): number =>
  Math.max(10, Math.min(20, 10 + Math.ceil(maxCr(members))));

/** The party's odds on a single d20, floored and capped by 1s and 20s. */
const odds = (bonus: number, dc: number): number =>
  Math.max(0.05, Math.min(0.95, (21 - (dc - bonus)) / 20));

const LEVELS = [1, 3, 5, 7];
const RUNS = 60;
const WAVES = 6;
const HALVES = ['morning', 'afternoon'] as const;
const DOORS = 3;

const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(1)}%`;

function histogram(sizes: number[]): string {
  const counts = new Array(Math.max(...sizes) + 1).fill(0);
  for (const s of sizes) counts[s]++;
  return counts.map((n, i) => (n ? `${i}:${pct(n, sizes.length)}` : null)).filter(Boolean).join('  ');
}

function partyOf(classes: Id[], level: number): CampaignState {
  const c = newCampaign(7);
  classes.forEach((cl, i) => setPartyClass(c, i, cl));
  // partyLevelOf reads XP; the arena levels the party with the waves, and the
  // proficiency bonus is what matters here.
  (c as { xp: number }).xp = [0, 0, 900, 2700, 6500, 14000, 23000, 34000][level] ?? 0;
  return c;
}

const PARTIES: Array<{ name: string; classes: Id[] }> = [
  { name: 'default (fighter/wizard/cleric/rogue)', classes: ['fighter', 'wizard', 'cleric', 'rogue'] },
  { name: 'broad  (bard/ranger/rogue/druid)', classes: ['bard', 'ranger', 'rogue', 'druid'] },
  { name: 'narrow (fighter/barbarian/paladin/wizard)', classes: ['fighter', 'barbarian', 'paladin', 'wizard'] },
];

// ---- 1. pool width -----------------------------------------------------

console.log('=== how many skills a fight licenses ===');
const allSizes: number[] = [];
const freq = new Map<SkillId, number>();
let fights = 0;
const drawn: Array<{ skill: SkillId; members: readonly Id[]; level: number }> = [];

for (const level of LEVELS) {
  const sizes: number[] = [];
  for (let seed = 1; seed <= RUNS; seed++) {
    for (let wave = 1; wave <= WAVES; wave++) {
      for (const half of HALVES) {
        for (let door = 0; door < DOORS; door++) {
          const w = buildWave(seed, level, wave, undefined, door, half);
          const ctx = ctxFor(w.encounter.members, w.map);
          const pool = RULES.filter((r) => r.eligible(ctx));
          sizes.push(pool.length);
          for (const r of pool) freq.set(r.skill, (freq.get(r.skill) ?? 0) + 1);
          // The offer: one drawn from the pool, seeded off the fight so it is
          // stable across doors and retries. Deterministic mixing, not rng.
          if (pool.length) {
            const pick = (seed * 2654435761 + wave * 40503 + door * 97 + (half === 'afternoon' ? 7919 : 0)) >>> 0;
            drawn.push({ skill: pool[pick % pool.length]!.skill, members: w.encounter.members, level });
          }
          fights++;
        }
      }
    }
  }
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  console.log(`L${level}  mean ${mean.toFixed(2)}  min ${Math.min(...sizes)}  max ${Math.max(...sizes)}   ${histogram(sizes)}`);
  allSizes.push(...sizes);
}
console.log(`ALL  mean ${(allSizes.reduce((a, b) => a + b, 0) / allSizes.length).toFixed(2)}   ${histogram(allSizes)}`);
console.log('\n  how often each skill is in the pool:');
for (const [skill, n] of [...freq.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${skill.padEnd(18)} ${pct(n, fights).padStart(6)}`);
}
const never = RULES.filter((r) => !freq.has(r.skill)).map((r) => r.skill);
if (never.length) console.log(`    NEVER ELIGIBLE: ${never.join(', ')}`);

// ---- 2. does the party have a live gamble? -----------------------------

console.log('\n=== what a party is offered, and whether it is worth taking ===');
console.log('   (a "live" gamble is one the party clears more often than not:');
console.log('    success and failure are priced to match, so 50% is the line)\n');

/**
 * Candidate DC rules.
 *
 * `threat` is the one argued for over level-scaling, on the `loreDc` precedent:
 * scale with the monster, so a specialist can outgrow it. The measurement below
 * is what happens to that argument.
 */
const DC_RULES: Array<{ name: string; dc(members: readonly Id[], level: number): number }> = [
  { name: 'threat  10+CR      (cap 20)', dc: (m) => dcFor(m) },
  { name: 'flat    13', dc: () => 13 },
  { name: 'level   11+lvl/2', dc: (_m, l) => 11 + Math.floor(l / 2) },
  { name: 'threat  12+CR/2    (cap 18)', dc: (m) => Math.min(18, 12 + Math.ceil(maxCr(m) / 2)) },
  { name: 'threat  13+CR/3    (cap 17)', dc: (m) => Math.min(17, 13 + Math.ceil(maxCr(m) / 3)) },
  { name: 'mixed   12+lvl/2+CR/3 (cap 18)', dc: (m, l) => Math.min(18, 12 + Math.floor(l / 2) + Math.ceil(maxCr(m) / 3)) },
];

for (const rule of DC_RULES) {
  console.log(`  DC = ${rule.name}`);
  for (const { name, classes } of PARTIES) {
    const byLevel: string[] = [];
    for (const level of LEVELS) {
      const c = partyOf(classes, level);
      const mine = drawn.filter((d) => d.level === level);
      let live = 0;
      for (const d of mine) {
        if (odds(bestAtSkill(c, d.skill).bonus, rule.dc(d.members, level)) > 0.5) live++;
      }
      byLevel.push(`L${level} ${pct(live, mine.length).padStart(6)}`);
    }
    console.log(`    ${name.padEnd(42)} ${byLevel.join('  ')}`);
  }
  // The whole point of one forced offer: breadth should buy something.
  const gap = LEVELS.map((level) => {
    const rate = (classes: Id[]) => {
      const c = partyOf(classes, level);
      const mine = drawn.filter((d) => d.level === level);
      return mine.filter((d) => odds(bestAtSkill(c, d.skill).bonus, rule.dc(d.members, level)) > 0.5).length / mine.length;
    };
    return `L${level} +${(100 * (rate(PARTIES[1]!.classes) - rate(PARTIES[2]!.classes))).toFixed(0)}pt`;
  });
  console.log(`    ${'BREADTH PREMIUM (broad − narrow)'.padEnd(42)} ${gap.join('  ')}\n`);
}
