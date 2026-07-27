/**
 * Generic state evaluation for the simulation AI.
 *
 * V(state, team) reads only generic state fields (HP, conditions, resources,
 * positions, equipped kit) — never specific spell/feature/item ids. New
 * content is valued through what it *does* to the state, so the AI
 * generalizes to content that didn't exist when this file was written.
 */
import type { GameState, Combatant, TeamId, ConditionId } from '../engine/types.js';
import { abilityMod, isDown } from '../engine/types.js';
import { WEAPONS, type WeaponData } from '../data/weapons.js';
import { FEATURES } from '../data/features.js';
import { ITEMS } from '../data/items.js';
import { parseDice } from '../engine/dice.js';
import { distanceCells, hasLineOfSight } from '../engine/grid.js';
import { cellAt } from '../engine/types.js';
import { equippedWeapons, stowedWeapons } from '../engine/rules/equipment.js';
import { isHidden } from '../engine/rules/hide.js';

// Dice expressions are a tiny fixed vocabulary ('1d8', '2d6'...) coming from
// static content data, but re-parsing them with a regex on every evaluation put
// parseDice among the hottest functions in the profile. The average of a dice
// string never changes, so parse each one once.
const avgDiceCache = new Map<string, number>();
function avgDice(expr: string): number {
  let v = avgDiceCache.get(expr);
  if (v === undefined) {
    const d = parseDice(expr);
    v = d.count * (d.sides + 1) / 2 + d.bonus;
    avgDiceCache.set(expr, v);
  }
  return v;
}

function weaponDamage(c: Combatant, w: WeaponData): number {
  const ability = w.melee && !w.properties.includes('finesse') ? 'str' : 'dex';
  return avgDice(w.damage) + abilityMod(c.abilities[ability]) + (w.damageBonus ?? 0);
}

/**
 * Best output at melee reach and at range, over the unit's *whole* kit
 * (carried as well as drawn — a fighter with a stowed longsword is still a
 * melee fighter after it throws a javelin). Casters count their magic as
 * ranged: a wizard's staff is a last resort, not a reason to charge.
 */
/**
 * Cached per combatant *object*. A single `evaluate` calls damageProxy once per
 * unit plus once per unit-pair for the threat term — O(n²) recomputes of a kit
 * scan that can't change, since nothing mutates a state the AI is evaluating
 * (`step` clones, then mutates only its private draft). Keyed by identity, so a
 * combatant whose slots change is a different object and re-derives naturally.
 */
const profileCache = new WeakMap<Combatant, { melee: number; ranged: number }>();

function damageProfile(c: Combatant): { melee: number; ranged: number } {
  const hit = profileCache.get(c);
  if (hit) return hit;
  const computed = computeDamageProfile(c);
  profileCache.set(c, computed);
  return computed;
}

function computeDamageProfile(c: Combatant): { melee: number; ranged: number } {
  let melee = 2; // unarmed floor
  let ranged = 0;
  for (const wid of [...equippedWeapons(c), ...stowedWeapons(c)]) {
    const w = WEAPONS[wid];
    if (!w) continue;
    const dmg = weaponDamage(c, w);
    if (w.melee) melee = Math.max(melee, dmg);
    if (w.range !== undefined) ranged = Math.max(ranged, dmg);
  }
  if (c.spellIds.length > 0) {
    // Cantrips are unlimited ranged damage; slots add burst on top.
    const slotPower = c.spellSlots.reduce((s, pool, i) => s + pool.current * (i + 1), 0);
    ranged = Math.max(ranged, 5) + Math.min(6, slotPower);
  }
  return { melee, ranged };
}

/** Rough damage-per-round proxy from a unit's kit. Content-agnostic. */
export function damageProxy(c: Combatant): number {
  const { melee, ranged } = damageProfile(c);
  return Math.max(melee, ranged) * c.attacksPerAction;
}

/** How much losing this unit hurts. */
export function unitWorth(c: Combatant): number {
  return c.maxHp + 4 * c.level + 1.5 * damageProxy(c);
}

/** Fraction of a unit's effectiveness a condition removes (or adds). */
const CONDITION_WEIGHT: Partial<Record<ConditionId, number>> = {
  // loses actions entirely (and helpless conditions invite auto-crits)
  paralyzed: -0.55,
  unconscious: -0.55,
  incapacitated: -0.4,
  // impaired
  prone: -0.1,
  blinded: -0.2,
  poisoned: -0.12,
  frightened: -0.1,
  sapped: -0.06,
  guided: -0.08,       // the *bearer* is easier to hit
  'outlined': -0.14, // like guided but it lasts, and can't be hidden from
  // Restrained is the heaviest of the impaired set and was priced at nothing:
  // attacks against it get advantage, its own attacks get disadvantage, AND
  // turn.ts zeroes its speed outright. That is blinded's adv/dis pair plus
  // total immobility, so it sits above blinded. It went unpriced while five
  // separate things applied it — Web, Entangle, Ensnaring Strike, the giant
  // spider and the roper — so the AI could not see the point of any of them.
  restrained: -0.25,
  // Bestow Curse: disadvantage on every attack it makes, and it fails saves
  // more often (saves.ts). The same shape as blinded from the attacker's side.
  cursed: -0.2,
  // The two "your turn is simply gone" effects. `commanded` zeroes speed,
  // forces prone and blocks every action for the turn; `lured` blocks actions
  // outright and walks the victim toward the lurer. Both cost a whole turn, so
  // they are priced near incapacitated (-0.4) rather than among the
  // impairments — a touch under it because each lasts only one turn.
  commanded: -0.35,
  lured: -0.35,
  // Charmed is narrower than it looks: it only stops the victim attacking
  // whoever charmed it, not everyone.
  charmed: -0.15,
  marked: -0.06,       // Hunter's Mark: the bearer takes extra damage
  burning: -0.04,      // Searing Smite: 1d6 a turn until a Con save ends it
  slowed: -0.03,       // -10 ft of speed for one turn
  noReactions: -0.03,  // no opportunity attacks
  // buffs
  blessed: 0.08,
  // Haste is the biggest buff in the game as implemented: double speed, +2 AC
  // and a whole extra attack (actions.ts hasteBonus) — roughly half again as
  // much output for as long as it holds.
  hasted: 0.25,
  sacredWeapon: 0.1,   // a bonus to hit and to damage on every swing
  shielded: 0.08,      // Shield: +5 AC until the start of its next turn
  smiting: 0.06,       // a smite armed and waiting on the next melee hit
  inspired: 0.05,      // advantage on the next attack roll
  warded: 0.05,        // Shield of Faith: +2 AC
  vexed: 0.04,         // advantage against one specific target
  // Bane is Bless's mirror — a d4 off every attack roll and save — and it was
  // priced at nothing, so the AI read casting it as pure slot loss and never
  // did. Found while giving the goblin hexer Bane as its signature: the sim AI
  // cast it zero times in twelve fights. Same magnitude as blessed, opposite
  // sign, because it is literally the same die.
  baned: -0.08,
  // Dodging only pays off if something actually attacks you, and it costs the
  // action that could have been an attack. Weighted low so a real attack wins.
  dodging: 0.02,
  // DELIBERATELY UNPRICED. `sanctuary`, `protected`, `energyWarded` and
  // `bonded` all depend on what the *attacker* happens to be or to be doing —
  // a creature type, a damage type, whether anyone attacks at all — so a flat
  // share of the bearer's worth would misstate them in both directions. Those
  // want the threat term to understand them, not a constant here.
};

/**
 * Extra expected damage this unit gets from attacking with *advantage*: the
 * dice its kit unlocks (a rogue's Sneak Attack, a goblin's bonus dice — both
 * declared in data) plus the plain hit-rate gain, which is worth about a
 * quarter of a normal hit.
 */
function advantageUpside(c: Combatant): number {
  let dice = 0;
  for (const fid of c.featureIds) {
    const roll = FEATURES[fid]?.advantageDice?.(c.level);
    if (roll) dice += avgDice(roll);
  }
  for (const wid of [...equippedWeapons(c), ...stowedWeapons(c)]) {
    const roll = WEAPONS[wid]?.bonusDiceOnAdvantage;
    if (roll) dice = Math.max(dice, avgDice(roll));
  }
  return dice + 0.25 * damageProxy(c);
}

/**
 * Hidden isn't a state worth having, it's a purchase: advantage on the next
 * attack. So it's priced at exactly what that advantage buys *this* kit — not
 * as a flat share of the unit's worth.
 *
 * Both halves of that matter. It must be paid up front because the search
 * cannot discover the payoff: hiding needs cover, cover blocks your own line
 * of sight, so the only winning line is hide -> move -> attack — three actions,
 * while the beam prunes on the prefix after one. Priced at 0.05 of `worth`
 * (~+1.2 for a rogue) hide lost to any step toward the enemy and was cut at
 * depth 1, and the AI never played the rogue's defining trick even at depth 3.
 *
 * But it must be priced off the *mechanic*, not the unit's size. A flat
 * 1.5x damage made hiding worth ~+12 to a cleric whose best cantrip gains ~4:
 * revealing itself was never worth it, so it sat invisible and untargetable
 * until the round limit — one hidden cleric, one blind wizard, a dead game.
 * Advantage genuinely is worth ~9 to a rogue (2d6 Sneak Attack) and ~2 to a
 * cleric (a hit-rate bump), and pricing the mechanic says so on its own.
 */
const HIDDEN_MULT = 1.2;

/**
 * Does this unit's kit want to be in melee? Decided by which range band it
 * actually hits harder from — NOT by whether it happens to be holding a melee
 * weapon, which is true of every character (a wizard carries a staff) and
 * would march the squishiest party member into melee.
 */
function prefersMelee(c: Combatant): boolean {
  const { melee, ranged } = damageProfile(c);
  return melee >= ranged;
}

/** Can `enemy` plausibly hurt `unit` soon? 1 = this turn, decaying with distance. */
function threatReach(enemy: Combatant, unit: Combatant): number {
  const dist = distanceCells(enemy.position, unit.position);
  const cellsPerTurn = enemy.speed / 5;
  const hasRanged = [...equippedWeapons(enemy), ...stowedWeapons(enemy)]
    .some((w) => WEAPONS[w]?.range !== undefined) || enemy.spellIds.length > 0;
  // Melee threat falls off smoothly beyond charge range; ranged threat is
  // wider but still prefers proximity (adjacency, better odds, fewer walls).
  const reachNow = hasRanged ? 8 : cellsPerTurn + 1;
  return 1 / (1 + Math.max(0, dist - reachNow) * (hasRanged ? 0.15 : 0.6));
}

/** Living, still-standing members of a team — the divisor for averaged terms. */
function livingOnTeam(state: GameState, team: TeamId): number {
  let n = 0;
  for (const c of Object.values(state.combatants)) {
    if (c.team === team && c.alive && !isDown(c)) n++;
  }
  return n;
}

function teamScore(state: GameState, team: TeamId, isPov: boolean): number {
  let score = 0;
  // Hoisted: evaluate is the AI's hot path, and this is constant across the loop.
  const share = isPov ? 1 : Math.max(1, livingOnTeam(state, team));
  for (const c of Object.values(state.combatants)) {
    if (c.team !== team || !c.alive) continue;
    const worth = unitWorth(c);

    // Alive matters a lot; remaining HP matters proportionally.
    let unit = worth * (0.35 + 0.65 * (c.hp / c.maxHp));
    // A generic buffer against the next damage instance, regardless of source.
    unit += Math.min(c.tempHp ?? 0, c.maxHp) * 0.8;

    if (isHidden(c)) unit += HIDDEN_MULT * advantageUpside(c);

    for (const cond of c.conditions) {
      unit += worth * (CONDITION_WEIGHT[cond.id] ?? 0);
    }

    // Resources not yet spent retain option value.
    unit += c.spellSlots.reduce((s, pool, i) => s + pool.current * (i + 1) * 0.7, 0);
    unit += Object.values(c.featureUses).reduce((s, u) => s + u.current * 0.5, 0);
    // Innate spells are a resource too — a once-per-fight cast worth saving for
    // the right cluster, not burning on one straggler.
    unit += Object.values(c.innateSpells).reduce((s, u) => s + u.current * 0.7, 0);
    // Consumables too (valued by their data cost) — so the AI doesn't burn
    // a potion at full HP just because it scores no worse than passing.
    unit += c.inventory.reduce((s, stack) => {
      const item = ITEMS[stack.itemId];
      return item ? s + stack.qty * Math.min(2, item.cost / 100) : s;
    }, 0);

    // Standing in a hazard is bad; more so with low HP.
    const cell = cellAt(state.grid, c.position);
    if (cell?.terrain === 'hazard') unit -= 2 + 4 * (1 - c.hp / c.maxHp);
    // Standing on ground that costs double is half your movement gone, so it
    // is priced just above `slowed` (-0.03, which is only -10 ft of 30). This
    // is the whole point of the spells that *make* ground difficult: Ice Storm
    // is 2d10+4d6 where a same-level Fireball is 8d6, so by damage alone it is
    // strictly dominated, and it was offered 843 times in thirty fights and
    // cast none. Terrain, not damage, is what it is for.
    if (cell && (cell.terrain === 'difficult' || cell.chilled !== undefined)) unit -= worth * 0.05;

    // Engagement: a unit contributes nothing from across the board. Melee
    // kits want to be adjacent; ranged kits want a comfortable middle band.
    const melee = prefersMelee(c);
    let nearest = Infinity;
    let seesAnyEnemy = false;
    // Enemies inside a 15 ft aura, counted here so the aura term below costs no
    // second sweep of the roster. Only meaningful when this unit has one.
    let enemiesInAura = 0;
    for (const e of Object.values(state.combatants)) {
      if (!e.alive || isDown(e) || e.team === team) continue;
      const d = distanceCells(e.position, c.position);
      nearest = Math.min(nearest, d);
      // In the aura now, or one move from walking into it. The approaching
      // half is what makes raising the aura *before* contact worth anything.
      if (d <= 3) enemiesInAura += 1;
      else if (d <= 7) enemiesInAura += 0.35;
      // "See" means *can act on*, not merely a clear geometric line: a hidden
      // enemy can't be targeted, so a unit whose foes are all hidden is blind
      // and should go looking. Counting a hidden enemy as seen let two hidden
      // units stare through each other at their ideal range forever, neither
      // able to attack and neither with any reason to move.
      if (!seesAnyEnemy && !isHidden(e) && hasLineOfSight(state.grid, c.position, e.position)) {
        seesAnyEnemy = true;
      }
    }
    // A shooter that can see nobody can threaten nobody, so give it a reason to
    // find a sightline rather than idle behind a wall. Only for ranged kits:
    // penalising a melee unit for lacking line of sight would pin it to a
    // sniping spot it can't use instead of letting it close.
    //
    // POV-asymmetric for the same reason the engagement band is: sight is
    // *mutual*, so a symmetric weight cancels out of V = mine - theirs — the
    // 1.2 I gain by stepping into a sightline is exactly the 1.2 my target
    // gains by being seen. Weighted evenly, two shooters behind opposite walls
    // both score standing still as optimal and the game never ends.
    if (!melee && Number.isFinite(nearest) && !seesAnyEnemy) unit -= isPov ? 1.2 : 0.4;
    // Distance is mutual, so a symmetric weight would cancel out of
    // V = mine - theirs and leave movement gradient-free. The POV team
    // cares more about its own engagement: that asymmetry is what makes
    // closing (or kiting) worth something to the mover.
    if (Number.isFinite(nearest)) {
      // A band you can't shoot from is not a band: with no sightline — including
      // when every enemy is hidden, and so untargetable — a unit closes, because
      // closing is how you find one.
      const preferred = melee || !seesAnyEnemy ? 1 : 4;
      // The non-POV side is averaged over its living members, not summed.
      //
      // The asymmetry is what gives movement a gradient at all, but as a plain
      // per-unit sum it only survives one-on-one. V = mine - theirs, so a mover
      // closing one cell gains 0.9 for itself and hands back 0.3 to *every*
      // enemy whose nearest foe it now is. Against a party of four that is
      // 4 x 0.3 = 1.2 against 0.9: every step toward the enemy scores worse than
      // standing still, and an outnumbered melee unit correctly refuses to
      // approach. Measured on a stalled arena wave, the flying sword's options
      // were 0.00 for a sideways shuffle and -0.33, -0.66, -1.36 for each step
      // closer — the gradient pointed backwards, all the way home.
      //
      // Averaging makes the term headcount-invariant, so the mover's own 0.9
      // stays decisive no matter how badly outnumbered it is. Keeping distance
      // is still argued for, but by the threat term below, which is where
      // "don't stand where they can hit you" belongs.
      unit -= (isPov ? 0.9 : 0.3 / share) * Math.abs(nearest - preferred);
    }

    // Persistent effects that pay out on *later* turns and produce nothing at
    // all on the turn they are created. The simulation AI scores an action by
    // the state one step ahead, so an aura or a summon is indistinguishable
    // from a burnt slot unless its future income is visible on the board.
    // Measured before this term, over thirty level-6 fights: Spiritual
    // Guardians cast 0 times from 55 offers, Flaming Sphere 0 from 6962.
    // Spiritual Weapon escaped only because it happens to strike as it lands.
    //
    // Keyed off the generic state fields, not spell ids: a future aura that
    // sets `spiritualGuardians`, or a summon of a new `kind`, is priced here
    // with no edit. The weights are per *turn of income*, discounted for the
    // fight ending first. The scale is one turn of income, conservatively: an
    // aura is 3d8 on a Wisdom save for half, so ~9 expected damage per enemy
    // standing in it, and a summon's ram is 2d6 for ~5. An aura with nobody in
    // it is worth nothing, which is what keeps it from being raised early.
    if (c.spiritualGuardians) unit += 9 * enemiesInAura;
    for (const s of c.summons ?? []) {
      let near = Infinity;
      for (const e of Object.values(state.combatants)) {
        if (!e.alive || isDown(e) || e.team === team) continue;
        near = Math.min(near, distanceCells(e.position, s.position));
      }
      // Flat worth for having one at all, plus the strike it makes when it is
      // actually next to something. Both sphere and weapon move on their own,
      // so being far away is a delay rather than a loss.
      unit += 2.5 + (near <= 1 ? 2.5 : near <= 4 ? 1 : 0);
    }

    // Incoming threat: fragile units should not sit where enemies can reach.
    let threat = 0;
    for (const e of Object.values(state.combatants)) {
      if (!e.alive || isDown(e) || e.team === team) continue;
      threat += threatReach(e, c) * damageProxy(e);
    }
    // Threat matters more the closer it comes to killing you — and the POV
    // team weighs its own exposure more (see engagement note above).
    unit -= (isPov ? 0.25 : 0.12) * Math.min(threat, c.hp * 1.5) * (1.3 - c.hp / c.maxHp);

    score += unit;
  }
  return score;
}

/** Positive is good for `team`. */
export function evaluate(state: GameState, team: TeamId): number {
  const other: TeamId = team === 'team1' ? 'team2' : 'team1';
  if (state.winner === team) return 1e6;
  if (state.winner === other) return -1e6;
  return teamScore(state, team, true) - teamScore(state, other, false);
}
