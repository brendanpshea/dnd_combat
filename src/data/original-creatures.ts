/**
 * Original creatures: this game's own, released to the public domain (CC0 1.0,
 * https://creativecommons.org/publicdomain/zero/1.0/) — use them anywhere,
 * for anything, without asking or crediting.
 *
 * Each one fills a role a well-known monster plays in a module (a many-eyed
 * floating tyrant, a six-legged panther, a plant god's severed hand) without
 * being that monster: its own name, its own look, and a stat block built only
 * from rules the SRD 5.2.1 already has — attack rolls, saving throws,
 * conditions, damage types, recharge breath. Nothing here names, describes or
 * copies a product-identity creature or its special abilities.
 *
 * They sit in their own file so that what is CC0 and what is SRD-derived
 * (CC-BY-4.0, the other files in this folder) stays easy to tell apart. They
 * are merged into `MONSTERS`, `MONSTER_XP`, `WEAPONS` and `BREATH_WEAPONS` by
 * the modules that own those tables, and held out of the arena's roster
 * (`ARENA_EXCLUDED`), like the other creatures added for module authors.
 * `test/original-creatures.test.ts` holds each to its challenge rating.
 *
 * A Huge creature already reaches ten feet (the engine's rule), so none of the Huge ones'
 * attacks carry the `reach` property.
 *
 * Data only, and only type imports: this file must stay loadable from
 * monsters.ts, weapons.ts and features.ts without a cycle.
 */
import type { Id } from '../engine/types.js';
import type { MonsterData } from './monsters.js';
import type { WeaponData } from './weapons.js';
import type { BreathSpec } from './features.js';

/** Every original creature's id, in the order the docs list them. */
export const ORIGINAL_CREATURE_IDS = [
  'panopt', 'gloomthicket-titan', 'shimmerpard', 'barrowwyrm', 'vitriol-slug', 'viperveil',
  'bramblekin', 'bramblekin-warden', 'midden-behemoth', 'clatterkin', 'whirligig',
  'emberhaunt', 'hedge-mantis', 'veilcat',
] as const;

export const ORIGINAL_MONSTERS: Record<Id, MonsterData> = {
  // Panopt: a floating cage of bronze rings with loose eyes circling it, each eye a different ray.
  // The three rays it fires each turn cut, still and unmake; it shrugs off spells.
  panopt: {
    id: 'panopt', fly: true, name: 'Panopt',
    ac: 17, cr: 12, hp: 135, speed: 0, flySpeed: 20,
    creatureType: 'aberration',
    size: 'large',
    abilities: { str: 10, dex: 14, con: 18, int: 17, wis: 15, cha: 17 },
    savingThrowProfs: ['int', 'wis', 'cha'],
    conditionImmunities: ['prone'],
    featureIds: ['magic-resistance', 'legendary-resistance'],
    weaponIds: ['panopt-wither-ray', 'panopt-still-ray', 'panopt-unmake-ray'],
    attacksPerAction: 3,
    multiattack: [['panopt-wither-ray', 'panopt-still-ray', 'panopt-unmake-ray']],
  },
  // Gloomthicket Titan: a drowned thicket that learned to walk, a heap of
  // rotting vine, root and bloom. It crushes and holds, and knits itself back
  // together unless fire or acid has got at it.
  'gloomthicket-titan': {
    id: 'gloomthicket-titan', name: 'Gloomthicket Titan',
    ac: 15, cr: 10, hp: 175, speed: 20,
    creatureType: 'plant',
    size: 'huge',
    abilities: { str: 24, dex: 6, con: 20, int: 3, wis: 10, cha: 4 },
    conditionImmunities: ['charmed'],
    weaponIds: ['titan-bough'],
    attacksPerAction: 2,
    resistances: ['cold'],
    immunities: ['lightning'],
    regeneration: { amount: 10, stoppedBy: ['fire', 'acid'] },
  },
  // Shimmerpard: a lean grey cat whose outline swims, so every blow lands a
  // hand's breadth from where it seems to be. Hit it once and the haze breaks
  // until its next turn.
  shimmerpard: {
    id: 'shimmerpard', name: 'Shimmerpard',
    ac: 13, cr: 3, hp: 60, speed: 40,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 17, dex: 15, con: 14, int: 5, wis: 12, cha: 6 },
    featureIds: ['shimmer-hide'],
    weaponIds: ['shimmerpard-claw', 'shimmerpard-bite'],
    attacksPerAction: 2,
    multiattack: [['shimmerpard-claw', 'shimmerpard-bite']],
  },
  // Barrowwyrm: a great wyrm long dead and not at rest. Its breath is a
  // grave-chill that stills the living where they stand.
  barrowwyrm: {
    id: 'barrowwyrm', fly: true, name: 'Barrowwyrm',
    ac: 19, cr: 15, hp: 230, speed: 40, flySpeed: 80,
    creatureType: 'undead',
    size: 'huge',
    abilities: { str: 25, dex: 10, con: 22, int: 18, wis: 15, cha: 20 },
    savingThrowProfs: ['con', 'wis', 'cha'],
    conditionImmunities: ['charmed', 'frightened', 'paralyzed', 'poisoned'],
    featureIds: ['legendary-resistance', 'breath-grave-chill'],
    weaponIds: ['barrowwyrm-rend', 'barrowwyrm-tail'],
    attacksPerAction: 3,
    multiattack: [['barrowwyrm-rend', 'barrowwyrm-rend', 'barrowwyrm-tail']],
    immunities: ['cold', 'necrotic', 'poison'],
  },
  // Vitriol Slug: a house-sized slug that rasps with a tongue of teeth and
  // spits a stinging brew.
  'vitriol-slug': {
    id: 'vitriol-slug', name: 'Vitriol Slug',
    ac: 9, cr: 6, hp: 126, speed: 20,
    creatureType: 'ooze',
    size: 'huge',
    abilities: { str: 19, dex: 6, con: 18, int: 1, wis: 8, cha: 3 },
    weaponIds: ['slug-rasp', 'slug-spit'],
    attacksPerAction: 2,
    multiattack: [['slug-rasp', 'slug-rasp'], ['slug-spit', 'slug-spit']],
    immunities: ['acid'],
  },
  // Viperveil: a hooded, cobra-necked woman of the marsh. Meet her eyes and
  // you stop where you stand.
  viperveil: {
    id: 'viperveil', name: 'Viperveil',
    ac: 15, cr: 4, hp: 78, speed: 30,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 10, dex: 16, con: 14, int: 12, wis: 14, cha: 16 },
    conditionImmunities: ['poisoned'],
    featureIds: ['lulling-gaze'],
    weaponIds: ['viperveil-fang', 'viperveil-coil'],
    attacksPerAction: 2,
    multiattack: [['viperveil-fang', 'viperveil-coil']],
    resistances: ['poison'],
  },
  // Bramblekin: knee-high thorn-folk, a tangle of bark and bramble that tends
  // to its own hedge. They swarm, and lightning slides off them.
  bramblekin: {
    id: 'bramblekin', name: 'Bramblekin',
    ac: 13, hp: 18, speed: 30,
    creatureType: 'plant',
    size: 'small',
    abilities: { str: 10, dex: 14, con: 12, int: 6, wis: 10, cha: 5 },
    conditionImmunities: ['charmed', 'paralyzed'],
    featureIds: ['pack-tactics'],
    weaponIds: ['bramblekin-jab', 'bramblekin-flick'],
    resistances: ['lightning'],
  },
  // Bramblekin Warden: a grown bramblekin, man-high and gnarled, who leads the hedge.
  'bramblekin-warden': {
    id: 'bramblekin-warden', name: 'Bramblekin Warden',
    ac: 14, hp: 45, speed: 30,
    creatureType: 'plant',
    size: 'medium',
    abilities: { str: 14, dex: 12, con: 16, int: 7, wis: 12, cha: 6 },
    conditionImmunities: ['charmed', 'paralyzed'],
    featureIds: ['pack-tactics'],
    weaponIds: ['warden-cudgel', 'bramblekin-flick'],
    attacksPerAction: 2,
    multiattack: [['warden-cudgel', 'warden-cudgel'], ['bramblekin-flick', 'bramblekin-flick']],
    resistances: ['lightning'],
  },
  // Midden Behemoth: a hill of fused refuse, bone and sludge with four ropy
  // arms and a ring of teeth. It lives where the city throws things away.
  'midden-behemoth': {
    id: 'midden-behemoth', name: 'Midden Behemoth',
    ac: 15, cr: 7, hp: 150, speed: 20,
    creatureType: 'aberration',
    size: 'huge',
    abilities: { str: 21, dex: 8, con: 20, int: 5, wis: 11, cha: 4 },
    savingThrowProfs: ['con'],
    weaponIds: ['midden-arm', 'midden-maw'],
    attacksPerAction: 3,
    multiattack: [['midden-arm', 'midden-arm', 'midden-maw']],
  },
  // Clatterkin: four-armed, chitin-clad desert raiders that click when they
  // talk. A scratch from the sting numbs.
  clatterkin: {
    id: 'clatterkin', name: 'Clatterkin',
    ac: 15, cr: 3, hp: 52, speed: 40,
    creatureType: 'monstrosity',
    size: 'medium',
    abilities: { str: 14, dex: 17, con: 14, int: 8, wis: 13, cha: 6 },
    weaponIds: ['clatterkin-hook', 'clatterkin-sting'],
    attacksPerAction: 3,
    multiattack: [['clatterkin-hook', 'clatterkin-hook', 'clatterkin-sting']],
  },
  // Whirligig: a hand-high fey that spins through a fight faster than the eye,
  // a pinprick at a time.
  whirligig: {
    id: 'whirligig', name: 'Whirligig',
    ac: 16, hp: 28, speed: 50,
    creatureType: 'fey',
    size: 'small',
    abilities: { str: 4, dex: 18, con: 12, int: 10, wis: 12, cha: 10 },
    featureIds: ['nimble-escape'],
    weaponIds: ['whirligig-prick'],
    attacksPerAction: 2,
  },
  // Emberhaunt: a spirit of cinder and static that wears a body like a cloak.
  // It hurls embers and loosens a crackling arc.
  emberhaunt: {
    id: 'emberhaunt', fly: true, name: 'Emberhaunt',
    ac: 17, cr: 11, hp: 170, speed: 0, flySpeed: 40,
    creatureType: 'elemental',
    size: 'medium',
    abilities: { str: 12, dex: 16, con: 16, int: 12, wis: 12, cha: 20 },
    savingThrowProfs: ['con', 'cha'],
    conditionImmunities: ['charmed', 'poisoned'],
    featureIds: ['magic-resistance', 'breath-arc-surge'],
    weaponIds: ['emberhaunt-grasp', 'emberhaunt-cinder'],
    attacksPerAction: 2,
    multiattack: [['emberhaunt-grasp', 'emberhaunt-grasp'], ['emberhaunt-cinder', 'emberhaunt-cinder']],
    resistances: ['cold'],
    immunities: ['fire', 'poison'],
  },
  // Hedge Mantis: a pony-sized mantis that waits in the leaves, still as a twig.
  'hedge-mantis': {
    id: 'hedge-mantis', name: 'Hedge Mantis',
    ac: 14, cr: 4, hp: 68, speed: 40,
    creatureType: 'beast',
    size: 'large',
    abilities: { str: 18, dex: 14, con: 14, int: 1, wis: 12, cha: 4 },
    weaponIds: ['mantis-foreleg', 'mantis-bite'],
    attacksPerAction: 2,
    multiattack: [['mantis-foreleg', 'mantis-bite'], ['mantis-foreleg', 'mantis-foreleg']],
  },
  // Veilcat: a tiger-faced trickster that wears illusions like clothes. Only
  // magic or a very good eye gets past them; it claws, and it whispers.
  veilcat: {
    id: 'veilcat', name: 'Veilcat',
    ac: 16, cr: 5, hp: 88, speed: 40,
    creatureType: 'fiend',
    size: 'medium',
    abilities: { str: 14, dex: 17, con: 16, int: 14, wis: 14, cha: 18 },
    savingThrowProfs: ['dex', 'wis', 'cha'],
    conditionImmunities: ['charmed', 'frightened'],
    featureIds: ['magic-resistance'],
    weaponIds: ['veilcat-claw', 'veilcat-murmur'],
    attacksPerAction: 2,
    multiattack: [['veilcat-claw', 'veilcat-claw'], ['veilcat-murmur', 'veilcat-murmur']],
    resistNonmagical: ['bludgeoning', 'piercing', 'slashing'],
  },
};

/** What each is worth, by challenge rating (the SRD's table). */
export const ORIGINAL_XP: Record<Id, number> = {
  panopt: 8400, 'gloomthicket-titan': 5900, shimmerpard: 700, barrowwyrm: 13000, 'vitriol-slug': 2300,
  viperveil: 1100, bramblekin: 100, 'bramblekin-warden': 450, 'midden-behemoth': 2900, clatterkin: 700,
  whirligig: 200, emberhaunt: 7200, 'hedge-mantis': 1100, veilcat: 1800,
};

/** Their attacks. */
export const ORIGINAL_WEAPONS: Record<Id, WeaponData> = {
  // Panopt: three rays a turn, one each of cut, still and unmake.
  'panopt-wither-ray': {
    id: 'panopt-wither-ray', name: 'Withering Ray', damage: '5d8', damageType: 'necrotic',
    attackAbility: 'cha', abilityDamage: false, properties: [], range: { normal: 120, long: 120 }, melee: false,
  },
  'panopt-still-ray': {
    id: 'panopt-still-ray', name: 'Stilling Ray', damage: '3d6', damageType: 'cold',
    attackAbility: 'cha', abilityDamage: false, properties: [], range: { normal: 120, long: 120 }, melee: false,
    onHitSave: { condition: 'paralyzed', ability: 'con', dc: 15 },
  },
  'panopt-unmake-ray': {
    id: 'panopt-unmake-ray', name: 'Unmaking Ray', damage: '6d8', damageType: 'force',
    attackAbility: 'cha', abilityDamage: false, properties: [], range: { normal: 120, long: 120 }, melee: false,
  },
  'titan-bough': {
    id: 'titan-bough', name: 'Crushing Bough', damage: '3d10', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '2d6', type: 'poison' },
    onHitGrapple: { dc: 18, restrains: true, maxSize: 'large' },
  },
  'shimmerpard-claw': {
    id: 'shimmerpard-claw', name: 'Claw', damage: '2d4', damageType: 'slashing',
    properties: [], melee: true,
  },
  'shimmerpard-bite': {
    id: 'shimmerpard-bite', name: 'Bite', damage: '1d10', damageType: 'piercing',
    properties: [], melee: true,
  },
  'barrowwyrm-rend': {
    id: 'barrowwyrm-rend', name: 'Rend', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d8', type: 'necrotic' },
  },
  'barrowwyrm-tail': {
    id: 'barrowwyrm-tail', name: 'Tail Sweep', damage: '2d10', damageType: 'bludgeoning',
    properties: [], melee: true,
  },
  'slug-rasp': {
    id: 'slug-rasp', name: 'Rasp', damage: '2d8', damageType: 'slashing',
    properties: [], melee: true, extraDamage: { dice: '1d8', type: 'acid' },
  },
  'slug-spit': {
    id: 'slug-spit', name: 'Vitriol Spit', damage: '4d6', damageType: 'acid',
    attackAbility: 'con', abilityDamage: false, properties: [], range: { normal: 30, long: 60 }, melee: false,
  },
  'viperveil-fang': {
    id: 'viperveil-fang', name: 'Fang', damage: '1d6', damageType: 'piercing',
    properties: ['finesse'], melee: true, extraDamage: { dice: '2d6', type: 'poison' },
  },
  'viperveil-coil': {
    id: 'viperveil-coil', name: 'Coil Lash', damage: '1d8', damageType: 'bludgeoning',
    properties: ['finesse'], melee: true, onHitGrapple: { dc: 13, maxSize: 'medium' },
  },
  'bramblekin-jab': {
    id: 'bramblekin-jab', name: 'Thorn Jab', damage: '1d6', damageType: 'piercing',
    properties: ['finesse'], melee: true, extraDamage: { dice: '1d4', type: 'poison' },
  },
  'bramblekin-flick': {
    id: 'bramblekin-flick', name: 'Thorn Flick', damage: '1d4', damageType: 'piercing',
    properties: [], range: { normal: 30, long: 90 }, melee: false,
  },
  'warden-cudgel': {
    id: 'warden-cudgel', name: 'Knotted Cudgel', damage: '1d8', damageType: 'bludgeoning',
    properties: [], melee: true, extraDamage: { dice: '1d6', type: 'poison' },
  },
  'midden-arm': {
    id: 'midden-arm', name: 'Grasping Arm', damage: '2d8', damageType: 'bludgeoning',
    properties: [], melee: true, onHitGrapple: { dc: 16, restrains: true, maxSize: 'large' },
  },
  'midden-maw': {
    id: 'midden-maw', name: 'Ring Maw', damage: '2d6', damageType: 'piercing',
    properties: [], melee: true, onHitSave: { condition: 'poisoned', ability: 'con', dc: 15 },
  },
  'clatterkin-hook': {
    id: 'clatterkin-hook', name: 'Hook Arm', damage: '1d6', damageType: 'slashing',
    properties: ['finesse'], melee: true,
  },
  'clatterkin-sting': {
    id: 'clatterkin-sting', name: 'Numbing Sting', damage: '1d4', damageType: 'piercing',
    properties: ['finesse'], melee: true, onHitSave: { condition: 'paralyzed', ability: 'con', dc: 13 },
  },
  'whirligig-prick': {
    id: 'whirligig-prick', name: 'Prick', damage: '1d4', damageType: 'piercing',
    properties: ['finesse'], melee: true,
  },
  'emberhaunt-grasp': {
    id: 'emberhaunt-grasp', name: 'Searing Grasp', damage: '2d8', damageType: 'fire',
    properties: ['finesse'], melee: true,
  },
  'emberhaunt-cinder': {
    id: 'emberhaunt-cinder', name: 'Cinder Bolt', damage: '6d6', damageType: 'fire',
    attackAbility: 'cha', abilityDamage: false, properties: [], range: { normal: 120, long: 120 }, melee: false,
  },
  'mantis-foreleg': {
    id: 'mantis-foreleg', name: 'Snatching Foreleg', damage: '2d6', damageType: 'piercing',
    properties: ['reach'], melee: true, onHitGrapple: { dc: 14, maxSize: 'medium' },
  },
  'mantis-bite': {
    id: 'mantis-bite', name: 'Chewing Bite', damage: '1d8', damageType: 'piercing',
    properties: [], melee: true,
  },
  'veilcat-claw': {
    id: 'veilcat-claw', name: 'Rending Claw', damage: '2d6', damageType: 'slashing',
    properties: ['finesse'], melee: true, extraDamage: { dice: '1d8', type: 'necrotic' },
  },
  'veilcat-murmur': {
    id: 'veilcat-murmur', name: 'Mocking Murmur', damage: '3d8', damageType: 'psychic',
    attackAbility: 'cha', abilityDamage: false, properties: [], range: { normal: 60, long: 60 }, melee: false,
    onHitSave: { condition: 'frightened', ability: 'wis', dc: 14 },
  },
};

/** Their breath: a cone or line of damage, half on a save. */
export const ORIGINAL_BREATH: Record<Id, BreathSpec> = {
  // The barrowwyrm's: a cone of grave-chill; whoever fails is stilled (paralysed, save ends).
  'breath-grave-chill': { shape: 'cone', save: 'con', damageType: 'cold', dice: '10d8', onFail: { condition: 'paralyzed' } },
  // The emberhaunt's: a crackling line of static.
  'breath-arc-surge': { shape: 'line', length: 12, save: 'dex', damageType: 'lightning', dice: '8d6' },
};
