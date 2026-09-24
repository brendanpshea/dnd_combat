/**
 * Weapon data. Adding a weapon is an entry here — never an engine edit.
 */
import type { Id, DamageType, Ability, ConditionId, WeaponProfs, CreatureType, CreatureSize } from '../engine/types.js';

export type WeaponProperty = 'finesse' | 'light' | 'thrown' | 'two-handed' | 'versatile';
export type MasteryId = 'sap' | 'vex' | 'slow' | 'push' | 'topple' | 'graze' | 'nick' | 'cleave';

export interface WeaponData {
  id: Id;
  name: string;
  damage: string; // dice expr, e.g. '1d8'
  damageType: DamageType;
  properties: WeaponProperty[];
  /** Present for ranged/thrown weapons; feet. Absent = melee only, reach 5. */
  range?: { normal: number; long: number };
  /** Thrown weapons and pure melee weapons can attack in melee. */
  melee: boolean;
  mastery?: MasteryId;
  /** Extra damage dice when the attack roll had advantage (goblin scimitar). */
  bonusDiceOnAdvantage?: string;
  /**
   * Extra damage dice against a creature that changes shape — what silvering
   * is for. A bonus rather than a gate: the 2014 lycanthropes could not be hurt
   * at all without silver, and a monster you simply cannot damage is a wall
   * rather than a fight.
   */
  bonusDiceVsShapechanger?: string;
  /** Condition applied automatically on a hit (wolf bite → prone, T. rex tail → prone). */
  onHitCondition?: ConditionId;
  /**
   * "If the target is [size] or smaller, it has the Grappled condition (escape
   * DC n)" — the 2024 monster grapple, on a hit and with no save. `restrains`
   * adds "and has the Restrained condition until the grapple ends". The limb
   * then holds that one creature, and cannot attack another while it does
   * (rules/conditions.ts, canAttackWith).
   */
  onHitGrapple?: { dc: number; restrains?: boolean; maxSize?: CreatureSize };
  /**
   * On a hit, the target makes a save or gains a save-ends condition
   * (ghoul claws → paralyzed, giant spider bite → poisoned).
   */
  onHitSave?: { condition: ConditionId; ability: Ability; dc: number };
  /**
   * Extra damage of a second type on a hit (spider bite → poison).
   *
   * `save` makes it half on a successful save, which is how the SRD writes
   * nearly every big poison rider — and the difference is not the average, it
   * is whether the player has any say. A giant scorpion's sting landing 16
   * poison automatically kills a level-1 hero every time; the same sting with
   * a Constitution save kills them somewhat less than half the time, and that
   * is a fight rather than an execution.
   */
  extraDamage?: { dice: string; type: DamageType; save?: { ability: Ability; dc: number } };
  /**
   * A bane weapon: extra damage, but only against particular creature types.
   *
   * Separate from `extraDamage` because the point is the condition, not the
   * dice. A Dragon Slayer is not "a longsword that does more" — it is a
   * longsword you carry *because you looked at what is coming*, and that only
   * works if the game shows you the roster first, which the arena's gates now
   * do.
   *
   * It is also the player's answer to the widest variance in the game. Forcing
   * one creature type per fight and measuring the party's win rate spreads from
   * 4% against fey to 79% against undead (the table is in arena/gates.ts), and
   * that is currently something the game does *to* a player. A slayer weapon is
   * the lever that turns a bad matchup into a reason to have prepared.
   *
   * `damageType` omitted means the extra dice land as the weapon's own type,
   * which is how the SRD writes the two Slayers ("extra 3d6 damage of the
   * weapon's type"). The Sun Blade names radiant instead.
   */
  slays?: { types: CreatureType[]; dice: string; damageType?: DamageType };
  /**
   * Sword of Life Stealing: on a natural 20, extra necrotic damage that the
   * wielder gains as temporary hit points. Flat rather than dice, per the SRD,
   * and nothing to steal from a construct or the undead.
   */
  lifeSteal?: { amount: number; exempt: CreatureType[] };
  /**
   * Life Drain (wraith): on a hit the target makes this save or its hit point
   * *maximum* drops by the damage taken. The SRD says "until the creature
   * finishes a long rest", and that comes free here — a combatant is rebuilt
   * from the campaign roster for every fight, so the drain cannot outlive the
   * one it happened in.
   *
   * The point of it is that healing can't undo it. With no death saves in this
   * engine, a shrinking ceiling is the only pressure a cleric can't simply
   * out-heal, which is exactly the thing a wraith is for.
   */
  drainsMaxHp?: { ability: Ability; dc: number };
  /**
   * Corrosion (rust monster): a hit eats a point of AC off metal armour or a
   * shield, up to `max` points, for the rest of the fight. No effect on a
   * target wearing neither -- which is exactly the decision the monster is
   * for: the plate-wearers give ground and the leather-wearers step up.
   */
  corrodes?: { max: number };
  /** Store price in gp; absent for natural/monster weapons (not tradable). */
  cost?: number;
  /**
   * What holding this weapon gives you, beyond swinging it.
   *
   * The same shape a trinket's grant uses, folded by the same builder, because
   * a Berserker Axe that raises your hit point maximum is doing exactly what a
   * worn item does — it just happens to be held. Declaring it as data keeps the
   * builder the only place that knows how a grant becomes a combatant.
   */
  grants?: {
    featureIds?: Id[];
    /** Extra maximum hit points per character level (Berserker Axe). */
    hpPerLevel?: number;
  };
  /** Magic weapon bonuses (+1 sword: both are 1). */
  attackBonus?: number;
  damageBonus?: number;
  /**
   * Silvered: no attack or damage bonus, but its damage bypasses
   * resistance (were-creatures, certain elementals) — see the bypassResistance
   * option on applyDamage.
   */
  magic?: boolean;
}

/** Simple/martial split (5e). A new tradable weapon adds its base id to one of
 *  these sets; monster/natural weapons stay out (they have no category and are
 *  always proficient). Magic/silvered variants resolve to their base. */
const SIMPLE_WEAPONS = new Set<Id>([
  'dagger', 'mace', 'quarterstaff', 'javelin', 'handaxe', 'spear', 'sling', 'light-crossbow', 'shortbow',
]);
const MARTIAL_WEAPONS = new Set<Id>([
  'longsword', 'shortsword', 'greatsword', 'greataxe', 'longbow', 'warhammer',
  'battleaxe', 'morningstar', 'rapier', 'hand-crossbow',
]);

/**
 * Named magic weapons, and the mundane weapon each one *is*.
 *
 * `-plus1` and `silvered-` carry their base in the id and can be stripped;
 * a Sun Blade cannot. Without an entry here `weaponCategory` returns undefined,
 * which the proficiency check reads as "natural weapon, always proficient" —
 * so a wizard would pick up a Dragon Slayer and swing it at full proficiency.
 * A named weapon added without a line here fails silently and generously,
 * which is the worst way to fail; `test/slayers.test.ts` holds every magic
 * weapon to having a category.
 */
const NAMED_BASE: Record<Id, Id> = {
  'sword-of-wounding': 'longsword',
  'sword-of-life-stealing': 'longsword',
  'berserker-axe': 'battleaxe',
  'mace-of-terror': 'mace',
  'dragon-slayer': 'longsword',
  'giant-slayer': 'longsword',
  // The SRD lets Shortsword proficiency cover it too; longsword is the stricter
  // reading and the one the martial/finesse split already expresses.
  'sun-blade': 'longsword',
  'mace-of-disruption': 'mace',
  'mace-of-smiting': 'mace',
};

/** A weapon's base id, stripping magic/silvered flavor (a +1 longsword is a
 *  martial weapon like any longsword). */
export function baseWeaponId(id: Id): Id {
  const named = NAMED_BASE[id];
  if (named) return named;
  return id.replace(/-plus1$/, '').replace(/^vicious-/, '').replace(/^silvered-/, '') as Id;
}

/** simple / martial for tradable weapons; undefined for natural/monster ones. */
export function weaponCategory(id: Id): 'simple' | 'martial' | undefined {
  const base = baseWeaponId(id);
  if (SIMPLE_WEAPONS.has(base)) return 'simple';
  if (MARTIAL_WEAPONS.has(base)) return 'martial';
  return undefined;
}

/** Whether `profs` cover `weaponId` (natural weapons and absent profs = yes). */
export function isWeaponProficient(profs: WeaponProfs | undefined, weaponId: Id): boolean {
  const cat = weaponCategory(weaponId);
  if (!cat) return true;          // natural / monster weapon
  if (!profs) return true;        // unmigrated combatant — don't penalize
  if (cat === 'simple') return profs.simple;
  if (profs.martial) return true;
  if (profs.finesseLight) {
    const props = WEAPONS[baseWeaponId(weaponId)]?.properties ?? [];
    if (props.includes('finesse') || props.includes('light')) return true;
  }
  return profs.specific?.includes(baseWeaponId(weaponId)) ?? false;
}

export const WEAPONS: Record<Id, WeaponData> = {
  longsword: {
    id: 'longsword', name: 'Longsword', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'sap', cost: 15,
  },
  javelin: {
    id: 'javelin', name: 'Javelin', damage: '1d6', damageType: 'piercing',
    properties: ['thrown'], range: { normal: 30, long: 120 }, melee: true, mastery: 'slow', cost: 1,
  },
  mace: {
    id: 'mace', name: 'Mace', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, mastery: 'sap', cost: 5,
  },
  quarterstaff: {
    id: 'quarterstaff', name: 'Quarterstaff', damage: '1d6', damageType: 'bludgeoning',
    properties: ['versatile'], melee: true, mastery: 'topple', cost: 1,
  },
  shortsword: {
    id: 'shortsword', name: 'Shortsword', damage: '1d6', damageType: 'piercing',
    properties: ['finesse', 'light'], melee: true, mastery: 'vex', cost: 10,
  },
  shortbow: {
    id: 'shortbow', name: 'Shortbow', damage: '1d6', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false, mastery: 'vex', cost: 25,
  },
  dagger: {
    id: 'dagger', name: 'Dagger', damage: '1d4', damageType: 'piercing',
    properties: ['finesse', 'light', 'thrown'], range: { normal: 20, long: 60 }, melee: true, mastery: 'nick', cost: 2,
  },
  greatsword: {
    id: 'greatsword', name: 'Greatsword', damage: '2d6', damageType: 'slashing',
    properties: ['two-handed'], melee: true, mastery: 'graze', cost: 50,
  },
  longbow: {
    id: 'longbow', name: 'Longbow', damage: '1d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 150, long: 600 }, melee: false, mastery: 'slow', cost: 50,
  },


  // --- bane weapons (rare) ---------------------------------------------------
  //
  // Each is the SRD entry, unaltered. They exist as a set rather than as one
  // showpiece because the point is coverage: between them they answer dragons,
  // giants, undead, fiends and constructs, which is most of what an arena wave
  // can put in front of you. One slayer would be a lucky drop; five is a reason
  // to read the gate cards before you pick a door.
  //
  // Note what they are NOT: none of them is better than a +1 weapon of the same
  // kind against the wrong target. A Dragon Slayer swung at a goblin is a
  // longsword +1, and that is the whole design — the power is conditional, so
  // carrying one is a decision rather than an upgrade.
  //
  // MEASURED, because an item that changes nothing is dead data with a price
  // tag. Level 5, N=100 per cell, greedy on both sides, the fight forced to one
  // creature type (see forceTypes in arena/encounter.ts), the party's fighter
  // armed with the weapon and nothing else changed:
  //
  //   vs dragon     bare 32%   Dragon Slayer        43%   +11
  //   vs giant      bare 46%   Giant Slayer         60%   +14
  //   vs fiend      bare 38%   Mace of Disruption   53%   +15
  //   vs construct  bare 62%   Mace of Smiting      68%    +6
  //   vs undead     bare 86%   Sun Blade            90%    +4
  //
  // The Sun Blade reads small because the party already beats undead 86% of the
  // time — there are only 14 points left to win. It is the dearest of the five
  // on its +2/+2 alone.
  //
  // And the control, which is the number that says these are conditional rather
  // than strictly better: a Dragon Slayer carried against BEASTS measured 37%
  // against the bare party's 40%. Swapping off the fighter's greatsword for a
  // 1d8 sword costs more than a +1 pays back. That is the intended shape.
  'dragon-slayer': {
    id: 'dragon-slayer', name: 'Dragon Slayer', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'sap', cost: 1400,
    attackBonus: 1, damageBonus: 1, magic: true,
    slays: { types: ['dragon'], dice: '3d6' },
  },
  'giant-slayer': {
    id: 'giant-slayer', name: 'Giant Slayer', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'topple', cost: 1400,
    attackBonus: 1, damageBonus: 1, magic: true,
    slays: { types: ['giant'], dice: '3d6' },
  },
  'sun-blade': {
    // A longsword that gains Finesse, deals radiant instead of slashing, and
    // hits undead harder. +2/+2 rather than +1/+1, which is what makes it the
    // dearest of the five.
    id: 'sun-blade', name: 'Sun Blade', damage: '1d8', damageType: 'radiant',
    properties: ['finesse', 'versatile'], melee: true, mastery: 'sap', cost: 2000,
    attackBonus: 2, damageBonus: 2, magic: true,
    slays: { types: ['undead'], dice: '1d8', damageType: 'radiant' },
  },
  'mace-of-disruption': {
    id: 'mace-of-disruption', name: 'Mace of Disruption', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, mastery: 'sap', cost: 1400,
    attackBonus: 1, damageBonus: 1, magic: true,
    slays: { types: ['undead', 'fiend'], dice: '2d6', damageType: 'radiant' },
  },
  'mace-of-smiting': {
    // The odd one out, and deliberately kept: constructs are the second-
    // narrowest target in the bestiary (8 of 137, ahead of only oozes,
    // aberrations and the lone celestial), so this is the cheapest of the five.
    // It earns its place because a construct resists most of what a party owns,
    // which makes the narrow answer the valuable one.
    id: 'mace-of-smiting', name: 'Mace of Smiting', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, mastery: 'sap', cost: 1100,
    attackBonus: 1, damageBonus: 1, magic: true,
    slays: { types: ['construct'], dice: '2d6' },
  },

  // --- greater weapon variety (mundane, tradable) ---------------------------
  handaxe: {
    id: 'handaxe', name: 'Handaxe', damage: '1d6', damageType: 'slashing',
    properties: ['light', 'thrown'], range: { normal: 20, long: 60 }, melee: true, mastery: 'vex', cost: 5,
  },
  spear: {
    id: 'spear', name: 'Spear', damage: '1d6', damageType: 'piercing',
    properties: ['thrown', 'versatile'], range: { normal: 20, long: 60 }, melee: true, mastery: 'sap', cost: 1,
  },
  rapier: {
    id: 'rapier', name: 'Rapier', damage: '1d8', damageType: 'piercing',
    properties: ['finesse'], melee: true, mastery: 'vex', cost: 25,
  },
  warhammer: {
    id: 'warhammer', name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning',
    properties: ['versatile'], melee: true, mastery: 'push', cost: 15,
  },
  battleaxe: {
    id: 'battleaxe', name: 'Battleaxe', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'topple', cost: 10,
  },
  morningstar: {
    id: 'morningstar', name: 'Morningstar', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true, mastery: 'sap', cost: 15,
  },

  'lion-rend': {
    id: 'lion-rend', name: 'Rend', damage: '1d8', damageType: 'slashing',
    properties: [], melee: true,
  },

  // --- named rare weapons ----------------------------------------------------
  'sword-of-wounding': {
    // A wound that will not close. The extra 2d6 is the small half; the half
    // that matters is the Con save, because a cleric who cannot heal a hero is
    // a cleric with nothing to do — which is the same pressure a wraith's Life
    // Drain applies, and the only kind this engine has that out-healing cannot
    // simply answer.
    id: 'sword-of-wounding', name: 'Sword of Wounding', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'sap', cost: 1500, magic: true,
    extraDamage: { dice: '2d6', type: 'necrotic' },
    onHitSave: { condition: 'wounded', ability: 'con', dc: 15 },
  },
  'sword-of-life-stealing': {
    // Only on a natural 20, and the SRD's flat 15 rather than dice: this is a
    // spike, not a rider, and it comes back to the wielder as temporary hit
    // points. Constructs and the undead have nothing to steal.
    id: 'sword-of-life-stealing', name: 'Sword of Life Stealing', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'sap', cost: 1500, magic: true,
    lifeSteal: { amount: 15, exempt: ['construct', 'undead'] },
  },
  'berserker-axe': {
    // +1, and hit points equal to your level — a real defensive gain, which is
    // what pays for the curse. The curse kept here is "Disadvantage on attack
    // rolls with weapons other than this one": it costs you the bow on your
    // back and, more sharply, any bane weapon you were carrying for the wave
    // ahead. The berserk-rage half of the SRD curse is left out; taking control
    // of a player's character away for a round is a different kind of thing and
    // wants its own design pass, not a line in an item table.
    id: 'berserker-axe', name: 'Berserker Axe', damage: '1d8', damageType: 'slashing',
    properties: ['versatile'], melee: true, mastery: 'topple', cost: 1500,
    attackBonus: 1, damageBonus: 1, magic: true,
    grants: { featureIds: ['berserker-curse'], hpPerLevel: 1 },
  },
  'mace-of-terror': {
    // The wave of terror is a granted feature with its own uses, not a weapon
    // rider: it is an action you take while holding the mace, which is exactly
    // what `useFeature` already models.
    id: 'mace-of-terror', name: 'Mace of Terror', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, mastery: 'sap', cost: 1600, magic: true,
    grants: { featureIds: ['wave-of-terror'] },
  },

  // --- monster natural weapons and gear (SRD 5.2.1 stat blocks) ------------
  // --- lycanthrope natural weapons (SRD 5.2.1 stat blocks) ----------------
  'were-bite-rat': {
    id: 'were-bite-rat', name: 'Bite', damage: '2d4', damageType: 'piercing',
    properties: ['finesse'], melee: true,
  },
  'were-bite-wolf': {
    id: 'were-bite-wolf', name: 'Bite', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'were-bite-boar': {
    id: 'were-bite-boar', name: 'Gore', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'were-bite-tiger': {
    id: 'were-bite-tiger', name: 'Bite', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'were-bite-bear': {
    id: 'were-bite-bear', name: 'Bite', damage: '2d12', damageType: 'piercing',
    properties: [], melee: true,
  },
  'were-claw': {
    id: 'were-claw', name: 'Scratch', damage: '2d6', damageType: 'slashing',
    properties: ['finesse'], melee: true,
  },
  'were-rend': {
    id: 'were-rend', name: 'Rend', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true,
  },
  'goblin-scimitar': {
    id: 'goblin-scimitar', name: 'Scimitar', damage: '1d6', damageType: 'slashing',
    properties: ['finesse', 'light'], melee: true, bonusDiceOnAdvantage: '1d4',
  },
  'goblin-shortbow': {
    id: 'goblin-shortbow', name: 'Shortbow', damage: '1d6', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false,
    bonusDiceOnAdvantage: '1d4',
  },
  bite: {
    id: 'bite', name: 'Bite', damage: '1d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  // The giant badger's bite is bigger than the generic 1d6 one the gnoll and
  // the lizardfolk share.
  'giant-badger-bite': {
    id: 'giant-badger-bite', name: 'Bite', damage: '2d4', damageType: 'piercing',
    properties: [], melee: true,
  },
  'constrictor-bite': {
    id: 'constrictor-bite', name: 'Bite', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'wolf-bite': {
    // The wolf's trip: its bite knocks the target prone (this game's flavor of
    // Pack Tactics). A dedicated weapon so plain biters don't inherit the rider.
    id: 'wolf-bite', name: 'Bite', damage: '1d6', damageType: 'piercing',
    properties: [], melee: true, onHitCondition: 'prone',
  },
  // The ogre's club, not the SRD's 1d8 player Greatclub — SRD Ogre hits for
  // 2d8 + 4. Named for its owner the way `ogre-javelin` below is, so the bare
  // id cannot be mistaken for the equipment-table weapon it is twice the size
  // of. Nothing buys it; only the ogre swings it (the oni has its own claws).
  'ogre-greatclub': {
    id: 'ogre-greatclub', name: 'Greatclub', damage: '2d8', damageType: 'bludgeoning',
    properties: ['two-handed'], melee: true, mastery: 'push',
  },
  'oni-claw': {
    id: 'oni-claw', name: 'Claw', damage: '1d12', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '2d8', type: 'necrotic' },
  },
  'ogre-javelin': {
    id: 'ogre-javelin', name: 'Javelin', damage: '2d6', damageType: 'piercing',
    properties: ['thrown'], range: { normal: 30, long: 120 }, melee: true,
  },
  slam: {
    id: 'slam', name: 'Slam', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  // A zombie hits harder than the animated armor that shares `slam`.
  'zombie-slam': {
    id: 'zombie-slam', name: 'Slam', damage: '1d8', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  scimitar: {
    id: 'scimitar', name: 'Scimitar', damage: '1d6', damageType: 'slashing',
    properties: ['finesse', 'light'], melee: true, mastery: 'nick',
  },
  'light-crossbow': {
    id: 'light-crossbow', name: 'Light Crossbow', damage: '1d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false, mastery: 'slow',
  },
  'hand-crossbow': {
    id: 'hand-crossbow', name: 'Hand Crossbow', damage: '1d6', damageType: 'piercing',
    properties: ['light'], range: { normal: 30, long: 120 }, melee: false, mastery: 'vex', cost: 75, // 2024: Vex
  },
  // Monster copies of player weapons, for the stat blocks whose version carries
  // a rider (or bigger dice) the equipment-table weapon must not. Nothing buys
  // these; they have no mastery, no cost and no category.
  'acolyte-mace': {
    id: 'acolyte-mace', name: 'Mace', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '1d4', type: 'radiant' },
  },
  'priest-mace': {
    id: 'priest-mace', name: 'Mace', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '2d4', type: 'radiant' },
  },
  'knight-greatsword': {
    id: 'knight-greatsword', name: 'Greatsword', damage: '2d6', damageType: 'slashing',
    properties: ['two-handed'], melee: true, extraDamage: { dice: '1d8', type: 'radiant' },
  },
  'spy-shortsword': {
    id: 'spy-shortsword', name: 'Shortsword', damage: '1d6', damageType: 'piercing',
    properties: ['finesse', 'light'], melee: true, extraDamage: { dice: '2d6', type: 'poison' },
  },
  'spy-hand-crossbow': {
    id: 'spy-hand-crossbow', name: 'Hand Crossbow', damage: '1d6', damageType: 'piercing',
    properties: ['light'], range: { normal: 30, long: 120 }, melee: false,
    extraDamage: { dice: '2d6', type: 'poison' },
  },
  'assassin-shortsword': {
    id: 'assassin-shortsword', name: 'Shortsword', damage: '1d6', damageType: 'piercing',
    properties: ['finesse', 'light'], melee: true, extraDamage: { dice: '5d6', type: 'poison' },
  },
  'assassin-light-crossbow': {
    id: 'assassin-light-crossbow', name: 'Light Crossbow', damage: '1d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 80, long: 320 }, melee: false,
    extraDamage: { dice: '6d6', type: 'poison' },
  },
  'wereboar-javelin': {
    id: 'wereboar-javelin', name: 'Javelin', damage: '3d6', damageType: 'piercing',
    properties: ['thrown'], range: { normal: 30, long: 120 }, melee: true,
  },
  'were-longbow': {
    id: 'were-longbow', name: 'Longbow', damage: '2d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 150, long: 600 }, melee: false,
  },
  'dire-wolf-bite': {
    id: 'dire-wolf-bite', name: 'Bite', damage: '1d10', damageType: 'piercing',
    properties: ['finesse'], melee: true, onHitCondition: 'prone',
  },
  'ghoul-bite': {
    id: 'ghoul-bite', name: 'Bite', damage: '1d6', damageType: 'piercing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'necrotic' },
  },
  'ghoul-claws': {
    id: 'ghoul-claws', name: 'Claw', damage: '1d4', damageType: 'slashing',
    properties: ['finesse'], melee: true,
    onHitSave: { condition: 'paralyzed', ability: 'con', dc: 10 },
  },
  'spider-bite': {
    id: 'spider-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: ['finesse'], melee: true,
    extraDamage: { dice: '2d6', type: 'poison' },
  },
  sling: {
    id: 'sling', name: 'Sling', damage: '1d4', damageType: 'bludgeoning',
    properties: [], range: { normal: 30, long: 120 }, melee: false,
  },
  /**
   * The monk's fist.
   *
   * `finesse` rather than a new "use Dexterity" flag: Martial Arts says a monk
   * may swing on Dexterity, `attackAbility` already picks the better of the two
   * for a finesse weapon, and a monk's Dexterity is always the better one. One
   * existing property does the whole job.
   *
   * 1d6 is the level 1-4 Martial Arts die; the level-5 upgrade to 1d8 happens
   * in `resolveAttack`, the same way Shillelagh's does, because a die that
   * grows with the wielder cannot live on the weapon.
   */
  'unarmed-strike': {
    id: 'unarmed-strike', name: 'Unarmed Strike', damage: '1d6', damageType: 'bludgeoning',
    properties: ['finesse', 'light'], melee: true, cost: 0,
  },
  greataxe: {
    id: 'greataxe', name: 'Greataxe', damage: '1d12', damageType: 'slashing',
    properties: ['two-handed'], melee: true, mastery: 'cleave', cost: 30,
  },
  'bear-bite': {
    id: 'bear-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'bear-claws': {
    id: 'bear-claws', name: 'Claw', damage: '1d4', damageType: 'slashing',
    properties: [], melee: true, onHitCondition: 'prone',
  },
  'minotaur-abyssal-glaive': {
    id: 'minotaur-abyssal-glaive', name: 'Abyssal Glaive', damage: '1d12', damageType: 'slashing',
    properties: ['two-handed'], melee: true, extraDamage: { dice: '3d6', type: 'necrotic' },
  },
  'minotaur-gore': {
    id: 'minotaur-gore', name: 'Gore', damage: '4d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'ettin-battleaxe': {
    id: 'ettin-battleaxe', name: 'Battleaxe', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true, onHitCondition: 'prone',
  },
  'ettin-morningstar': {
    id: 'ettin-morningstar', name: 'Morningstar', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true, onHitCondition: 'sapped',
  },
  'toad-bite': {
    id: 'toad-bite', name: 'Bite', damage: '1d6', damageType: 'piercing',
    properties: [], melee: true,
    extraDamage: { dice: '2d4', type: 'poison' },
    // The bite grabs its prey. Swallow, which would follow, is not modelled.
    onHitGrapple: { dc: 12, maxSize: 'medium' },
  },
  'hyena-bite': {
    id: 'hyena-bite', name: 'Bite', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'boar-tusk': {
    id: 'boar-tusk', name: 'Gore', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'snake-constrict': {
    id: 'snake-constrict', name: 'Constrict', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true,
    // SRD 5.2.1 Constrict is a Strength save (DC 14) rather than an attack
    // roll; this engine delivers every monster weapon as an attack, so only
    // the grapple it leaves is taken from the 2024 text.
    onHitGrapple: { dc: 14, maxSize: 'large' },
  },
  'gargoyle-claws': {
    id: 'gargoyle-claws', name: 'Claw', damage: '2d4', damageType: 'slashing',
    properties: ['light'], melee: true,
  },
  'fire-touch': {
    id: 'fire-touch', name: 'Burn', damage: '2d6', damageType: 'fire',
    properties: [], melee: true,
  },
  'water-slam': {
    id: 'water-slam', name: 'Slam', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true, onHitCondition: 'prone',
  },
  'earth-slam': {
    id: 'earth-slam', name: 'Slam', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'air-slam': {
    id: 'air-slam', name: 'Thunderous Slam', damage: '2d8', damageType: 'thunder',
    properties: [], melee: true,
  },
  'sprite-shortbow': {
    id: 'sprite-shortbow', name: 'Shortbow', damage: '1d4', damageType: 'piercing',
    properties: [], range: { normal: 40, long: 160 }, melee: false,
    // Sleep-poison arrow: a Constitution save or poisoned (save-ends).
    onHitSave: { condition: 'poisoned', ability: 'con', dc: 10 },
  },
  'hag-claws': {
    id: 'hag-claws', name: 'Claw', damage: '1d8', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'poison' },
  },
  /**
   * The Otherworldly Steed's slam. Radiant because this game's steed is always
   * the Celestial one — see the `find-steed` spell for why the SRD's three-way
   * creature-type choice is settled rather than offered.
   *
   * The SRD's damage is "1d8 plus the spell's level", and the extra rides the
   * steed's Strength instead: an SRD steed hits for a flat bonus off the
   * caster, and a monster in this engine adds its own ability modifier. Str 18
   * gives +4, which is the 2nd-level steed's 1d8+2 rounded generously and the
   * 4th-level steed's 1d8+4 exactly.
   */
  /**
   * The Draconic Spirit's Rend. The SRD is "1d6 + 4 + the spell's level"; the
   * +4 arrives as the spirit's own Strength modifier the way every monster
   * attack does, and the +5 is the spell level — fixed rather than scaled
   * because a wizard in this game can only ever cast Summon Dragon from a
   * 5th-level slot (a level-9 wizard's table is [4,3,3,3,1] and stops there).
   */
  'draconic-rend': {
    id: 'draconic-rend', name: 'Rend', damage: '1d6', damageType: 'piercing',
    properties: [], melee: true, damageBonus: 5,
  },
  /** An Animated Object's Slam: 1d4 force, plus its Strength. */
  'object-slam': {
    id: 'object-slam', name: 'Slam', damage: '1d4', damageType: 'force',
    properties: [], melee: true,
  },
  'otherworldly-slam': {
    id: 'otherworldly-slam', name: 'Slam', damage: '1d8', damageType: 'radiant',
    properties: [], melee: true,
  },
  'unicorn-horn': {
    id: 'unicorn-horn', name: 'Radiant Horn', damage: '1d10', damageType: 'radiant',
    properties: [], melee: true,
  },
  'unicorn-hooves': {
    id: 'unicorn-hooves', name: 'Hooves', damage: '2d6', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'cockatrice-bite': {
    id: 'cockatrice-bite', name: 'Petrifying Bite', damage: '1d4', damageType: 'piercing',
    properties: [], melee: true,
    // Petrification, approximated as restrained (turning to stone) — Con save,
    // save-ends, so a hit isn't a permanent lockout.
    onHitSave: { condition: 'restrained', ability: 'con', dc: 11 },
  },
  'harpy-claws': {
    id: 'harpy-claws', name: 'Claw', damage: '2d4', damageType: 'slashing',
    properties: ['light'], melee: true,
  },
  'manticore-spike': {
    id: 'manticore-spike', name: 'Tail Spike', damage: '1d8', damageType: 'piercing',
    properties: [], range: { normal: 100, long: 200 }, melee: false,
  },
  'manticore-rend': {
    id: 'manticore-rend', name: 'Rend', damage: '1d8', damageType: 'slashing',
    properties: [], melee: true,
  },
  'owlbear-rend': {
    id: 'owlbear-rend', name: 'Rend', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true,
  },
  'gorgon-gore': {
    id: 'gorgon-gore', name: 'Gore', damage: '2d12', damageType: 'piercing',
    properties: [], melee: true,
  },
  'shadow-drain': {
    id: 'shadow-drain', name: 'Draining Swipe', damage: '1d6', damageType: 'necrotic',
    properties: [], melee: true,
    onHitSave: { dc: 10, ability: 'con', condition: 'sapped' },
  },
  'specter-drain': {
    id: 'specter-drain', name: 'Life Drain', damage: '2d6', damageType: 'necrotic',
    properties: [], melee: true,
    drainsMaxHp: { ability: 'con', dc: 10 },
  },
  'wisp-shock': {
    id: 'wisp-shock', name: 'Shock', damage: '2d8', damageType: 'lightning',
    properties: [], melee: true,
  },
  'wight-longsword': {
    id: 'wight-longsword', name: 'Necrotic Sword', damage: '1d8', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d8', type: 'necrotic' },
  },
  'wight-drain': {
    id: 'wight-drain', name: 'Life Drain', damage: '1d8', damageType: 'necrotic',
    properties: [], melee: true,
    drainsMaxHp: { ability: 'con', dc: 13 },
  },
  'mummy-fist': {
    id: 'mummy-fist', name: 'Rotting Fist', damage: '1d10', damageType: 'bludgeoning',
    properties: [], melee: true,
    extraDamage: { dice: '3d6', type: 'necrotic' }, onHitCondition: 'wounded',
  },
  // Chromatic wyrmling Rends (SRD 5.2.1): slashing plus a splash of the
  // dragon's element. The ids still say "bite" -- the 2014 blocks bit, the
  // 2024 ones rend -- and renaming them would be churn for no play change.
  'wyrmling-black-bite': {
    id: 'wyrmling-black-bite', name: 'Rend', damage: '1d6', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d4', type: 'acid' },
  },
  'wyrmling-blue-bite': {
    id: 'wyrmling-blue-bite', name: 'Rend', damage: '1d10', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'lightning' },
  },
  'wyrmling-green-bite': {
    id: 'wyrmling-green-bite', name: 'Rend', damage: '1d10', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'poison' },
  },
  'wyrmling-red-bite': {
    id: 'wyrmling-red-bite', name: 'Rend', damage: '1d10', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'fire' },
  },
  'wyrmling-white-bite': {
    id: 'wyrmling-white-bite', name: 'Rend', damage: '1d8', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d4', type: 'cold' },
  },

  // ---- CR 6-10 natural weapons ------------------------------------------
  // Giants throw as readily as they swing, so each carries a rock alongside
  // its melee weapon; the AI free-swaps to whichever the range allows.
  'giant-greatclub': {
    id: 'giant-greatclub', name: 'Tree Club', damage: '3d8', damageType: 'bludgeoning',
    properties: [], melee: true, onHitCondition: 'prone',
  },
  'giant-rock': {
    id: 'giant-rock', name: 'Trash Lob', damage: '2d10', damageType: 'bludgeoning',
    properties: [], melee: false, range: { normal: 60, long: 240 },
  },
  'stone-giant-club': {
    id: 'stone-giant-club', name: 'Stone Club', damage: '3d10', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'stone-giant-boulder': {
    id: 'stone-giant-boulder', name: 'Boulder', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: false, range: { normal: 60, long: 240 }, onHitCondition: 'prone',
  },
  // The frost giant's ranged attack is a bow, not a rock: ranged only.
  'frost-giant-great-bow': {
    id: 'frost-giant-great-bow', name: 'Great Bow', damage: '2d10', damageType: 'piercing',
    properties: ['two-handed'], melee: false, range: { normal: 150, long: 600 },
    extraDamage: { dice: '2d6', type: 'cold' }, onHitCondition: 'slowed',
  },
  'fire-giant-hammer-throw': {
    id: 'fire-giant-hammer-throw', name: 'Hammer Throw', damage: '3d10', damageType: 'bludgeoning',
    properties: [], melee: false, range: { normal: 60, long: 240 }, onHitCondition: 'sapped',
    extraDamage: { dice: '1d8', type: 'fire' },
  },
  'frost-giant-greataxe': {
    id: 'frost-giant-greataxe', name: 'Frost Axe', damage: '2d12', damageType: 'slashing',
    properties: ['two-handed'], melee: true, extraDamage: { dice: '2d8', type: 'cold' },
  },
  'fire-giant-greatsword': {
    id: 'fire-giant-greatsword', name: 'Flame Sword', damage: '4d6', damageType: 'slashing',
    properties: ['two-handed'], melee: true, extraDamage: { dice: '3d6', type: 'fire' },
  },
  // ---- mephits ----------------------------------------------------------
  // Small, and the elemental rider is most of what they do -- a mephit is a
  // damage type with legs.
  'mephit-claws-fire': {
    id: 'mephit-claws-fire', name: 'Claw', damage: '1d4', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d4', type: 'fire' },
  },
  'magma-mephit-claws': {
    id: 'magma-mephit-claws', name: 'Claw', damage: '1d4', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'fire' },
  },
  'mephit-claws-cold': {
    id: 'mephit-claws-cold', name: 'Claw', damage: '1d4', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d4', type: 'cold' },
  },
  'mephit-claws-dust': {
    id: 'mephit-claws-dust', name: 'Claw', damage: '1d4', damageType: 'slashing',
    properties: [], melee: true,
  },
  'mephit-claws-mud': {
    id: 'mephit-claws-mud', name: 'Fists', damage: '1d4', damageType: 'bludgeoning',
    properties: [], melee: true,
  },

  // ---- fiends, mid and top ----------------------------------------------
  'succubus-claws': {
    id: 'succubus-claws', name: 'Fiendish Touch', damage: '2d10', damageType: 'psychic',
    properties: ['finesse'], melee: true,
  },
  'bearded-devil-glaive': {
    id: 'bearded-devil-glaive', name: 'Infernal Glaive', damage: '1d10', damageType: 'slashing',
    properties: ['two-handed'], melee: true,
  },
  'bearded-devil-beard': {
    id: 'bearded-devil-beard', name: 'Beard', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
    onHitSave: { condition: 'poisoned', ability: 'con', dc: 12 },
  },
  'night-hag-claws': {
    id: 'night-hag-claws', name: 'Claw', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true,
  },
  // Chains, so it pins. That's the devil's whole gameplan.
  'chain-devil-chain': {
    id: 'chain-devil-chain', name: 'Chain', damage: '2d6', damageType: 'slashing',
    properties: [], melee: true, onHitGrapple: { dc: 14, restrains: true, maxSize: 'large' },
  },
  'hezrou-rend': {
    id: 'hezrou-rend', name: 'Rend', damage: '1d4', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '2d8', type: 'poison' },
  },
  'glabrezu-pincer': {
    id: 'glabrezu-pincer', name: 'Pincer', damage: '2d10', damageType: 'slashing',
    properties: [], melee: true, onHitGrapple: { dc: 15, maxSize: 'medium' },
  },
  'horned-devil-fork': {
    id: 'horned-devil-fork', name: 'Searing Fork', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true, extraDamage: { dice: '2d8', type: 'fire' },
  },

  // ---- monstrosities, mid and top ---------------------------------------
  'worg-bite': {
    id: 'worg-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true, onHitCondition: 'guided',
  },
  'rust-monster-antennae': {
    id: 'rust-monster-antennae', name: 'Antennae', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true, corrodes: { max: 3 },
  },
  'griffon-rend': {
    id: 'griffon-rend', name: 'Rend', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true, onHitGrapple: { dc: 14, maxSize: 'medium' },
  },
  'ettercap-bite': {
    id: 'ettercap-bite', name: 'Bite', damage: '1d6', damageType: 'piercing',
    properties: [], melee: true, extraDamage: { dice: '1d4', type: 'poison' },
    onHitSave: { condition: 'poisoned', ability: 'con', dc: 11 },
  },
  // The Snarecaller is this game's own caster variant, so it keeps the bite it
  // was balanced with rather than following the SRD ettercap's.
  'ettercap-snarecaller-bite': {
    id: 'ettercap-snarecaller-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
    onHitSave: { condition: 'poisoned', ability: 'con', dc: 11 },
  },
  'ettercap-claws': {
    id: 'ettercap-claws', name: 'Claws', damage: '2d4', damageType: 'slashing',
    properties: [], melee: true,
  },
  'basilisk-bite': {
    id: 'basilisk-bite', name: 'Bite', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true, extraDamage: { dice: '2d6', type: 'poison' },
  },
  'winter-wolf-bite': {
    id: 'winter-wolf-bite', name: 'Bite', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true, onHitCondition: 'prone',
  },
  // SRD 5.2.1 Tentacle: reach 60 ft, no damage, and Poisoned until the grapple
  // ends. The engine has no per-weapon reach and nothing but Restrained can
  // ride a grapple, so the tendril keeps a damage die and the plain grapple.
  'roper-tendril': {
    id: 'roper-tendril', name: 'Tendril', damage: '1d8', damageType: 'bludgeoning',
    properties: [], melee: true, onHitGrapple: { dc: 14 },
  },
  'roper-bite': {
    id: 'roper-bite', name: 'Bite', damage: '3d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'bulette-bite': {
    id: 'bulette-bite', name: 'Bite', damage: '2d12', damageType: 'piercing',
    properties: [], melee: true,
  },
  'remorhaz-bite': {
    id: 'remorhaz-bite', name: 'Bite', damage: '2d10', damageType: 'piercing',
    properties: [], melee: true, onHitGrapple: { dc: 17, restrains: true, maxSize: 'large' }, extraDamage: { dice: '4d6', type: 'fire' },
  },
  'otyugh-tentacle': {
    id: 'otyugh-tentacle', name: 'Tentacle', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true, onHitGrapple: { dc: 13, maxSize: 'medium' },
  },
  'otyugh-bite': {
    id: 'otyugh-bite', name: 'Bite', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true, onHitCondition: 'poisoned',
  },
  'aboleth-tentacle': {
    id: 'aboleth-tentacle', name: 'Tentacle', damage: '2d6', damageType: 'bludgeoning',
    properties: [], melee: true, onHitGrapple: { dc: 14, maxSize: 'large' },
  },
  'trex-bite': {
    id: 'trex-bite', name: 'Bite', damage: '4d12', damageType: 'piercing',
    properties: [], melee: true, onHitGrapple: { dc: 17, restrains: true, maxSize: 'large' },
  },
  'trex-tail': {
    id: 'trex-tail', name: 'Tail', damage: '4d8', damageType: 'bludgeoning',
    properties: [], melee: true, onHitCondition: 'prone',
  },

  // ---- undead top end ---------------------------------------------------
  'ghast-claws': {
    id: 'ghast-claws', name: 'Claw', damage: '2d6', damageType: 'slashing',
    properties: ['finesse'], melee: true,
    onHitSave: { condition: 'paralyzed', ability: 'con', dc: 10 },
  },
  'ghast-bite': {
    id: 'ghast-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
    extraDamage: { dice: '2d8', type: 'necrotic' },
  },
  'banshee-touch': {
    id: 'banshee-touch', name: 'Corrupting Touch', damage: '3d6', damageType: 'necrotic',
    properties: [], melee: true,
  },
  'ghost-touch': {
    id: 'ghost-touch', name: 'Withering Touch', damage: '3d10', damageType: 'necrotic',
    properties: [], melee: true,
  },
  'wraith-touch': {
    id: 'wraith-touch', name: 'Life Drain', damage: '4d8', damageType: 'necrotic',
    properties: [], melee: true, drainsMaxHp: { ability: 'con', dc: 14 },
  },
  'spawn-claws': {
    id: 'spawn-claws', name: 'Claw', damage: '2d4', damageType: 'slashing',
    properties: ['finesse'], melee: true, onHitGrapple: { dc: 13, maxSize: 'medium' },
  },
  'spawn-bite': {
    id: 'spawn-bite', name: 'Bite', damage: '1d4', damageType: 'piercing',
    properties: ['finesse'], melee: true, extraDamage: { dice: '3d6', type: 'necrotic' },
  },

  // ---- beast top end ----------------------------------------------------
  'scorpion-claw': {
    id: 'scorpion-claw', name: 'Claw', damage: '1d6', damageType: 'bludgeoning',
    properties: [], melee: true, onHitGrapple: { dc: 13, maxSize: 'large' },
  },
  'scorpion-sting': {
    id: 'scorpion-sting', name: 'Sting', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
    extraDamage: { dice: '2d10', type: 'poison', save: { ability: 'con', dc: 12 } },
  },
  'elephant-gore': {
    id: 'elephant-gore', name: 'Gore', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'crocodile-bite': {
    id: 'crocodile-bite', name: 'Bite', damage: '3d10', damageType: 'piercing',
    properties: [], melee: true, onHitGrapple: { dc: 15, restrains: true, maxSize: 'large' },
  },
  'mammoth-gore': {
    id: 'mammoth-gore', name: 'Gore', damage: '2d10', damageType: 'piercing',
    properties: [], melee: true,
  },
  'ape-fist': {
    id: 'ape-fist', name: 'Fist', damage: '3d10', damageType: 'bludgeoning',
    properties: [], melee: true,
  },

  // ---- construct top end ------------------------------------------------
  'scarecrow-claw': {
    id: 'scarecrow-claw', name: 'Claw', damage: '2d4', damageType: 'slashing',
    properties: [], melee: true,
    onHitSave: { condition: 'frightened', ability: 'wis', dc: 11 },
  },
  'guardian-fist': {
    id: 'guardian-fist', name: 'Fist', damage: '2d6', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '2d6', type: 'force' },
  },
  'stone-golem-slam': {
    id: 'stone-golem-slam', name: 'Slam', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '2d8', type: 'force' },
  },

  // ---- elemental spread -------------------------------------------------
  'magmin-touch': {
    id: 'magmin-touch', name: 'Touch', damage: '2d4', damageType: 'fire',
    properties: [], melee: true,
  },
  'azer-hammer': {
    id: 'azer-hammer', name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'fire' },
  },
  // The Azer Sentinel's; the Forgecaller (this game's caster variant) keeps
  // the warhammer above.
  'azer-burning-hammer': {
    id: 'azer-burning-hammer', name: 'Burning Hammer', damage: '1d10', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'fire' },
  },
  'salamander-spear': {
    id: 'salamander-spear', name: 'Flame Spear', damage: '2d8', damageType: 'piercing',
    properties: ['thrown'], melee: true, range: { normal: 20, long: 60 }, extraDamage: { dice: '2d6', type: 'fire' },
  },
  'stalker-slam': {
    id: 'stalker-slam', name: 'Wind Swipe', damage: '2d6', damageType: 'force',
    properties: [], melee: true,
  },

  // ---- humanoid top end -------------------------------------------------
  'gladiator-spear': {
    id: 'gladiator-spear', name: 'Spear', damage: '2d6', damageType: 'piercing',
    properties: ['thrown'], melee: true, range: { normal: 20, long: 60 },
  },

  // ---- fiends -----------------------------------------------------------
  'imp-sting': {
    id: 'imp-sting', name: 'Sting', damage: '1d6', damageType: 'piercing',
    properties: ['finesse'], melee: true,
    extraDamage: { dice: '2d6', type: 'poison', save: { ability: 'con', dc: 11 } },
  },
  'quasit-claw': {
    id: 'quasit-claw', name: 'Rend', damage: '1d4', damageType: 'slashing',
    properties: ['finesse'], melee: true,
    onHitSave: { condition: 'poisoned', ability: 'con', dc: 10 },
  },
  'hell-hound-bite': {
    id: 'hell-hound-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'fire' },
  },
  'barbed-devil-claw': {
    id: 'barbed-devil-claw', name: 'Claws', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true, onHitGrapple: { dc: 13, maxSize: 'large' },
  },
  'barbed-devil-tail': {
    id: 'barbed-devil-tail', name: 'Tail', damage: '2d10', damageType: 'slashing',
    properties: [], melee: true,
  },
  'vrock-shred': {
    id: 'vrock-shred', name: 'Shred', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true, extraDamage: { dice: '3d6', type: 'poison' },
  },

  // ---- oozes ------------------------------------------------------------
  // An ooze is its pseudopod: one slow, heavy, corrosive hit. The 2024 stat
  // blocks make it all acid, which is what makes armour a poor answer to them.
  'gray-ooze-pseudopod': {
    id: 'gray-ooze-pseudopod', name: 'Pseudopod', damage: '2d8', damageType: 'acid',
    properties: [], melee: true, corrodes: { max: 3 },
  },
  'ochre-jelly-pseudopod': {
    id: 'ochre-jelly-pseudopod', name: 'Pseudopod', damage: '3d6', damageType: 'acid',
    properties: [], melee: true,
  },
  'cube-pseudopod': {
    id: 'cube-pseudopod', name: 'Pseudopod', damage: '3d6', damageType: 'acid',
    properties: [], melee: true,
  },
  'black-pudding-pseudopod': {
    id: 'black-pudding-pseudopod', name: 'Dissolving Pseudopod', damage: '4d6', damageType: 'acid',
    properties: [], melee: true, corrodes: { max: 3 },
  },

  // ---- constructs -------------------------------------------------------
  'flying-sword-blade': {
    id: 'flying-sword-blade', name: 'Slash', damage: '1d8', damageType: 'slashing',
    properties: [], melee: true,
  },
  // The rug wins by pinning someone and holding them there; the damage is
  // almost beside the point. SRD 5.2.1 gives the grapple *instead of* the
  // damage and adds Blinded; this engine's on-hit grapple rides on a damaging
  // hit and carries Restrained only.
  'rug-smother': {
    id: 'rug-smother', name: 'Smother', damage: '2d6', damageType: 'bludgeoning',
    properties: [], melee: true, onHitGrapple: { dc: 13, restrains: true, maxSize: 'medium' },
  },
  'golem-slam': {
    id: 'golem-slam', name: 'Slam', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '1d8', type: 'lightning' },
  },

  'troll-rend': {
    id: 'troll-rend', name: 'Rend', damage: '2d6', damageType: 'slashing',
    properties: [], melee: true,
  },
  'chimera-bite': {
    id: 'chimera-bite', name: 'Bite', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true, bonusDiceOnAdvantage: '2d6',
  },
  'chimera-horns': {
    id: 'chimera-horns', name: 'Ram', damage: '1d12', damageType: 'bludgeoning',
    properties: [], melee: true, onHitCondition: 'prone',
  },
  'chimera-claws': {
    id: 'chimera-claws', name: 'Claw', damage: '1d6', damageType: 'slashing',
    properties: [], melee: true,
  },
  'wyvern-bite': {
    id: 'wyvern-bite', name: 'Bite', damage: '2d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  // The sting is the wyvern: a hit that lands poison damage *and* the
  // condition is what makes it worth fearing over its bite.
  'wyvern-sting': {
    id: 'wyvern-sting', name: 'Stinger', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true,
    extraDamage: { dice: '7d6', type: 'poison' },
    onHitSave: { condition: 'poisoned', ability: 'con', dc: 15 },
  },
  'hydra-bite': {
    id: 'hydra-bite', name: 'Bite', damage: '1d10', damageType: 'piercing',
    properties: [], melee: true,
  },
  // ---- SRD 5.2.1 attacks the bestiary was missing -----------------------
  // Each is a stat-block attack as printed. Ranged "spell-like" attacks
  // (Radiant Flame, Verdant Wisp, Force Bolt, Hurl Flame) are ranged weapons
  // here, which is how every monster attack in this engine is delivered.
  'bandit-captain-pistol': {
    id: 'bandit-captain-pistol', name: 'Pistol', damage: '1d10', damageType: 'piercing',
    properties: [], range: { normal: 30, long: 90 }, melee: false,
  },
  'acolyte-radiant-flame': {
    id: 'acolyte-radiant-flame', name: 'Radiant Flame', damage: '2d6', damageType: 'radiant',
    properties: [], range: { normal: 60, long: 60 }, melee: false,
  },
  'priest-radiant-flame': {
    id: 'priest-radiant-flame', name: 'Radiant Flame', damage: '2d10', damageType: 'radiant',
    properties: [], range: { normal: 60, long: 60 }, melee: false,
  },
  'cultist-pact-blade': {
    id: 'cultist-pact-blade', name: 'Pact Blade', damage: '1d8', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '2d6', type: 'necrotic' },
  },
  'knight-heavy-crossbow': {
    id: 'knight-heavy-crossbow', name: 'Heavy Crossbow', damage: '2d10', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 100, long: 400 }, melee: false,
    extraDamage: { dice: '1d8', type: 'radiant' },
  },
  'veteran-heavy-crossbow': {
    id: 'veteran-heavy-crossbow', name: 'Heavy Crossbow', damage: '2d10', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 100, long: 400 }, melee: false,
  },
  'oni-nightmare-ray': {
    id: 'oni-nightmare-ray', name: 'Nightmare Ray', damage: '2d6', damageType: 'psychic',
    properties: [], range: { normal: 60, long: 60 }, melee: false,
  },
  'bugbear-grab': {
    id: 'bugbear-grab', name: 'Grab', damage: '2d6', damageType: 'bludgeoning',
    properties: [], melee: true, onHitGrapple: { dc: 12, maxSize: 'medium' },
  },
  'bugbear-light-hammer': {
    id: 'bugbear-light-hammer', name: 'Light Hammer', damage: '3d4', damageType: 'bludgeoning',
    properties: ['thrown'], range: { normal: 20, long: 60 }, melee: true,
  },
  'wererat-scratch': {
    id: 'wererat-scratch', name: 'Scratch', damage: '1d6', damageType: 'slashing',
    properties: ['finesse'], melee: true,
  },
  'wereboar-tusk': {
    id: 'wereboar-tusk', name: 'Tusk', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'werebear-handaxe': {
    id: 'werebear-handaxe', name: 'Handaxe', damage: '3d6', damageType: 'slashing',
    properties: ['thrown'], range: { normal: 20, long: 60 }, melee: true,
  },
  'gnoll-rend': {
    id: 'gnoll-rend', name: 'Rend', damage: '1d6', damageType: 'piercing',
    properties: [], melee: true,
  },
  'gnoll-bone-bow': {
    id: 'gnoll-bone-bow', name: 'Bone Bow', damage: '1d10', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 150, long: 600 }, melee: false,
  },
  'earth-rock-launch': {
    id: 'earth-rock-launch', name: 'Rock Launch', damage: '1d6', damageType: 'bludgeoning',
    properties: [], range: { normal: 60, long: 60 }, melee: false, onHitCondition: 'prone',
  },
  'sprite-needle-sword': {
    id: 'sprite-needle-sword', name: 'Needle Sword', damage: '1d4', damageType: 'piercing',
    properties: ['finesse'], melee: true,
  },
  'satyr-hooves': {
    id: 'satyr-hooves', name: 'Hooves', damage: '1d4', damageType: 'bludgeoning',
    properties: ['finesse'], melee: true,
  },
  'dryad-vine-lash': {
    id: 'dryad-vine-lash', name: 'Vine Lash', damage: '1d8', damageType: 'slashing',
    properties: ['finesse'], melee: true,
  },
  'dryad-thorn-burst': {
    id: 'dryad-thorn-burst', name: 'Thorn Burst', damage: '1d6', damageType: 'piercing',
    properties: [], range: { normal: 60, long: 60 }, melee: false,
  },
  'rust-monster-bite': {
    id: 'rust-monster-bite', name: 'Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'horned-devil-hurl-flame': {
    id: 'horned-devil-hurl-flame', name: 'Hurl Flame', damage: '5d8', damageType: 'fire',
    properties: [], range: { normal: 150, long: 150 }, melee: false,
  },
  'barbed-devil-hurl-flame': {
    id: 'barbed-devil-hurl-flame', name: 'Hurl Flame', damage: '5d6', damageType: 'fire',
    properties: [], range: { normal: 150, long: 150 }, melee: false,
  },
  'crocodile-tail': {
    id: 'crocodile-tail', name: 'Tail', damage: '3d8', damageType: 'bludgeoning',
    properties: [], melee: true, onHitCondition: 'prone',
  },
  'druid-vine-staff': {
    id: 'druid-vine-staff', name: 'Vine Staff', damage: '1d8', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '1d4', type: 'poison' },
  },
  'druid-verdant-wisp': {
    id: 'druid-verdant-wisp', name: 'Verdant Wisp', damage: '3d6', damageType: 'radiant',
    properties: [], range: { normal: 90, long: 90 }, melee: false,
  },
  // "Melee or Ranged Attack Roll ... reach 5 ft. or range 120 ft." Finesse so it
  // runs off the mage's Dexterity rather than its Strength 9.
  'mage-arcane-burst': {
    id: 'mage-arcane-burst', name: 'Arcane Burst', damage: '3d8', damageType: 'force',
    properties: ['finesse'], range: { normal: 120, long: 120 }, melee: true,
  },
  'stone-golem-force-bolt': {
    id: 'stone-golem-force-bolt', name: 'Force Bolt', damage: '4d10', damageType: 'force',
    properties: [], range: { normal: 120, long: 120 }, melee: false,
  },
  'wight-necrotic-bow': {
    id: 'wight-necrotic-bow', name: 'Necrotic Bow', damage: '1d8', damageType: 'piercing',
    properties: ['two-handed'], range: { normal: 150, long: 600 }, melee: false,
    extraDamage: { dice: '1d8', type: 'necrotic' },
  },
  'dretch-rend': {
    id: 'dretch-rend', name: 'Rend', damage: '1d6', damageType: 'slashing',
    properties: [], melee: true,
  },
  // Young chromatic dragons (SRD 5.2.1): three Rends a turn, each slashing plus
  // the dragon's element. Ids keep "bite" for the same reason the wyrmlings' do.
  'young-black-bite': {
    id: 'young-black-bite', name: 'Rend', damage: '2d4', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'acid' },
  },
  'young-blue-bite': {
    id: 'young-blue-bite', name: 'Rend', damage: '2d6', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d10', type: 'lightning' },
  },
  'young-green-bite': {
    id: 'young-green-bite', name: 'Rend', damage: '2d6', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '2d6', type: 'poison' },
  },
  'young-red-bite': {
    id: 'young-red-bite', name: 'Rend', damage: '2d6', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'fire' },
  },
  'young-white-bite': {
    id: 'young-white-bite', name: 'Rend', damage: '2d4', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d4', type: 'cold' },
  },
};

/**
 * Vicious weapons: "an extra 2d6 damage to any creature it hits", and no
 * attack or damage bonus at all.
 *
 * The interesting contrast is with a bane weapon. A Dragon Slayer is +1 always
 * and +3d6 sometimes; a Vicious Weapon is +0 always and +2d6 always. So the
 * slayer is the pick when you know what is coming — which the gate cards tell
 * you — and the vicious one is the pick when you do not. That is a real choice
 * between two rare weapons rather than a strictly-better ladder, which is the
 * whole reason to have both.
 *
 * Derived like the +1s, and for the same reason.
 */
const VICIOUS_COST: Record<Id, number> = {
  greatsword: 1600, greataxe: 1600, longsword: 1300,
  rapier: 1300, warhammer: 1300, longbow: 1600, dagger: 1100, mace: 1200,
};

/** The vicious variant of a base weapon: no bonus, an extra 2d6 on every hit. */
function vicious(baseId: Id, cost: number): WeaponData {
  const base = WEAPONS[baseId];
  if (!base) throw new Error(`VICIOUS_COST names a weapon that does not exist: ${baseId}`);
  return {
    ...base, id: `vicious-${baseId}`, name: `Vicious ${base.name}`, cost, magic: true,
    extraDamage: { dice: '2d6', type: base.damageType },
  };
}

/**
 * Every weapon that comes in a +1 flavour, and what the enchanted one costs.
 *
 * DERIVED, NOT DUPLICATED. The six +1 weapons that used to live in the table
 * above were hand-copied from their bases — same dice, same properties, same
 * mastery, written out twice. They happened to be in sync, but nothing held
 * them there: retune a longsword's mastery and the +1 longsword keeps the old
 * one, and the only symptom is that the expensive sword is quietly the worse
 * weapon. Building them from the base makes that impossible.
 *
 * The list is also the fix for a real gap. All six were MARTIAL, and cleric,
 * wizard and bard are simple-only — so three of the eight classes had no
 * enchanted weapon available to them at any price, at any level. Seven of the
 * eleven added here are simple.
 *
 * Prices preserve what the original six charged (500/500/800/800/1000/1000) and
 * extend the same shape: roughly by damage die, with reach and versatility
 * costing a little more.
 */
const PLUS_ONE_COST: Record<Id, number> = {
  // simple — the classes that could not buy magic before
  dagger: 400, quarterstaff: 400, javelin: 400,
  mace: 450, spear: 450, handaxe: 450, shortbow: 600,
  // martial
  shortsword: 500, longsword: 500,
  rapier: 800, warhammer: 800, battleaxe: 800, morningstar: 800, 'hand-crossbow': 800,
  greatsword: 1000, longbow: 1000, greataxe: 1000,
};

/** The +1 variant of a base weapon: identical but for the bonus, name and price. */
function plusOne(baseId: Id, cost: number): WeaponData {
  const base = WEAPONS[baseId];
  if (!base) throw new Error(`PLUS_ONE_COST names a weapon that does not exist: ${baseId}`);
  return { ...base, id: `${baseId}-plus1`, name: `${base.name} +1`, cost, attackBonus: 1, damageBonus: 1 };
}

for (const [baseId, cost] of Object.entries(PLUS_ONE_COST)) {
  WEAPONS[`${baseId}-plus1`] = plusOne(baseId, cost);
}

for (const [baseId, cost] of Object.entries(VICIOUS_COST)) {
  WEAPONS[`vicious-${baseId}`] = vicious(baseId, cost);
}

/** Base weapons that have a +1 version, for the loot tables and the shop. */
export const PLUS_ONE_WEAPONS: Id[] = Object.keys(PLUS_ONE_COST).map((id) => `${id}-plus1`);

/** The vicious weapons, for the loot tables and the shop. */
export const VICIOUS_WEAPONS: Id[] = Object.keys(VICIOUS_COST).map((id) => `vicious-${id}`);

/**
 * Silvered weapons, one per melee weapon a player can buy.
 *
 * There were two: a shortsword and a warhammer, hand-written. Which meant the
 * answer to "something here shrugs off my sword" was open to a rogue and a
 * cleric and nobody else — a greatsword fighter or an axe-carrying barbarian
 * had no silvered weapon to reach for at all, and buying the shortsword meant
 * giving up their whole build to hit the thing.
 *
 * Fifteen monsters already halve nonmagical damage — every elemental and most
 * of the undead — and `isMagicWeapon` already lets silver through. The mechanic
 * worked; there was just nothing to buy.
 *
 * Silvering costs a flat fee over the base rather than scaling: it is a coating,
 * not a better weapon, and a silvered dagger and a silvered greatsword take the
 * same amount of silver. That also keeps it the cheap answer — it does nothing
 * to hit or damage, so anyone paying for it is buying the ability to hurt one
 * kind of enemy at all.
 *
 * NOT IN THE 2024 SRD, DELIBERATELY
 *
 * SRD 5.2.1 dropped silver entirely — the word does not appear in it once, and
 * its lycanthropes have no damage immunity of any kind. `resistNonmagical` is
 * this game's own field and always was. Keeping silver is a house rule, kept
 * because it is the answer players reach for and because it gives a martial
 * something to buy that a caster cannot simply out-spell.
 */
const SILVERING_FEE = 100;

/** Melee weapons a player can buy, which is what there is any point silvering. */
/**
 * Every melee weapon a player can actually buy — the set silvering applies to.
 *
 * Exported because the test for it used to restate the rule, and a restated
 * rule drifts: when the monk's unarmed strike arrived (melee, cost 0) the
 * generator and the test disagreed about whether a Silvered Unarmed Strike
 * should exist, and both were confident.
 *
 * `cost > 0`, not `cost !== undefined`. A fist is a real melee weapon that
 * costs nothing, and you cannot silver it.
 */
export function silverableWeapons(): Id[] {
  return Object.values(WEAPONS)
    .filter((w) => w.melee && (w.cost ?? 0) > 0 && !w.magic
      && !/-plus1$|^vicious-|^silvered-/.test(w.id))
    .map((w) => w.id);
}

function silverable(): Id[] {
  return silverableWeapons();
}

for (const baseId of silverable()) {
  const base = WEAPONS[baseId]!;
  WEAPONS[`silvered-${baseId}`] = {
    ...base,
    id: `silvered-${baseId}`,
    name: `Silvered ${base.name}`,
    cost: (base.cost ?? 0) + SILVERING_FEE,
    // Common magic — an alchemical treatment of the metal, not a plating. Two
    // effects, and no third: it counts as magical, and it bites a shapechanger
    // harder. Nothing about it is tracked separately from `magic`.
    magic: true,
    bonusDiceVsShapechanger: '1d6',
  };
}

/** The silvered weapons, for the loot tables and the shop. */
export const SILVERED_WEAPONS: Id[] = silverable().map((id) => `silvered-${id}`);
