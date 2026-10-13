/**
 * Who lives in a generated place.
 *
 * A delve whose fights are drawn independently fields kobolds, then a bear,
 * then cultists, and reads as a list of encounters rather than a place. A
 * faction is the answer the best generators give (Crawl's lairs, Qud's
 * factions, Unexplored's inhabitants): a floor is HELD by someone, and its
 * fights, its boss, its room names and whether it can be talked to all come
 * from who that is.
 *
 * Members are drawn by the arena's own generator, restricted to this list, so
 * a faction fight is budgeted exactly as any generated fight is.
 */
import type { Id } from '../engine/types.js';
import type { SkillId } from './classes.js';
import type { SpecTheme } from '../adventure/delve-spec.js';
import { adjustedXp, arenaRoster } from '../arena/encounter.js';
import { evenBudgetFor, maxCountFor, memberCapFor } from '../arena/run.js';
import { shareFor } from '../adventure/delve-spec.js';

export interface Faction {
  id: Id;
  /** What they are called, collectively: "the Redfang goblins". */
  names: string[];
  /** One of them, for prose: "a goblin". */
  one: string;
  themes: SpecTheme[];
  /** What kind of place it makes of where it lives (archetypes.ts): the
   *  roles its rooms play. */
  archetype: Id;
  /** What it fields in its rooms. */
  members: Id[];
  /** Who leads it: one of these heads the floor's goal fight. */
  leaders: Id[];
  /** Whether, and how hard, they can be talked down. */
  parley?: { skill?: SkillId; dc: number; label: string; success: string };
  /** Rooms they make their own. */
  rooms: string[];
  /** Beasts, not people: a leader named like a boar, not a baron. */
  beastly?: true;
  /** A line for the entrance: the first sign of them. */
  sign: string[];
  /** Lines to open one of their fights with, one drawn per fight. Without
   *  them a fight opens on nothing at all. */
  intros?: string[];
  /** How its patrol finds the party, once it is out looking (Dungeon.alarm). */
  patrol?: string[];
  /** What the party hears when the place is roused (Dungeon.alarm). Default:
   *  a horn for people, a howl for beasts. */
  roused?: string[];
}

/** What a roused place sounds like, when its holders say nothing of their own. */
export const ROUSED = {
  people: ['Somewhere ahead a horn sounds, and then another. They know you are here.', 'Feet running, doors banging, someone shouting orders. The whole place is awake now.'],
  beasts: ['A howl goes up somewhere ahead, and is answered, and answered again.', 'Everything in the place has gone quiet at once, and it is listening for you.'],
};

export const FACTIONS: Record<Id, Faction> = Object.fromEntries(([
  {
    id: 'kobolds', archetype: 'hive', names: ['the Ashclaw kobolds', 'the Scalebound', 'the Tunnel Kin'], one: 'a kobold',
    themes: ['stone', 'ember'],
    members: ['kobold', 'kobold-emberling', 'giant-badger', 'giant-spider', 'white-wyrmling'],
    leaders: ['white-wyrmling', 'black-wyrmling', 'green-wyrmling', 'red-wyrmling', 'young-white'],
    parley: { dc: 12, label: 'Offer them tribute', success: 'Coins change hands, a lot of bowing happens, and they let you by.' },
    rooms: ['Trap Workshop', 'Egg Chamber', 'Dragon Shrine', 'Kennels', 'Midden'],
    sign: ['Tiny footprints in the dust, hundreds of them, and a tripwire at ankle height.'],
  },
  {
    id: 'goblins', archetype: 'camp', names: ['the Redfang goblins', 'the Mudfoot tribe', 'the Grinning Knives'], one: 'a goblin',
    themes: ['stone', 'forest', 'village', 'stockade'],
    members: ['goblin-warrior', 'goblin-hexer', 'worg', 'bugbear', 'ogre'],
    leaders: ['goblin-boss', 'bugbear', 'ogre', 'ettin'],
    parley: { skill: 'intimidation', dc: 13, label: 'Scare them off', success: 'They decide, loudly, that this was never their room anyway.' },
    rooms: ['Wolf Pens', 'Loot Pile', 'Feast Hall', 'Lookout'],
    sign: ['Goblin marks scratched at eye height, and a bone tied to a string across the door.'],
  },
  {
    id: 'restless-dead', archetype: 'tomb', names: ['the restless dead', 'the Unquiet', 'the Hungry Dead'], one: 'a corpse',
    themes: ['graveyard', 'stone', 'bog'],
    members: ['skeleton', 'zombie', 'skeleton-bonechanter', 'ghoul', 'shadow', 'specter', 'ghast'],
    leaders: ['wight', 'mummy', 'ghast', 'wraith', 'vampire-spawn'],
    rooms: ['Open Graves', 'Bone Pit', 'Embalming Hall', 'Mourning Chapel'],
    sign: ['The smell reaches you first. Then a scrape, somewhere below, of something that should not be walking.'],
  },
  {
    id: 'cult', archetype: 'cult', names: ['the Cult of the Ashen Eye', 'the Hollow Choir', 'the Brothers of the Last Door'], one: 'a cultist',
    themes: ['stone', 'graveyard', 'village'],
    members: ['acolyte', 'guard', 'spy', 'imp', 'quasit', 'cult-fanatic'],
    leaders: ['cult-fanatic', 'priest', 'mage'],
    parley: { skill: 'deception', dc: 14, label: 'Claim to be one of them', success: 'The right words, said with the right face. They wave you on.' },
    rooms: ['Ritual Circle', 'Robing Room', 'Altar of Ash', 'Dormitory'],
    sign: ['Chanting, far off, and a sigil daubed fresh on the wall.'],
  },
  {
    id: 'bandits', archetype: 'camp', names: ['the Black Hand', 'Tamsin\'s Crew', 'the Gallows Boys'], one: 'a bandit',
    themes: ['forest', 'village', 'stone', 'stockade'],
    members: ['bandit', 'guard', 'scout', 'spy', 'berserker'],
    leaders: ['bandit-captain', 'veteran', 'gladiator', 'assassin'],
    parley: { dc: 13, label: 'Cut them in', success: 'A share of nothing yet found, promised loudly. Greed does the rest.' },
    rooms: ['Strongroom', 'Bunkroom', 'Dice Den', 'Stolen Goods'],
    sign: ['A cold campfire, a dropped dice cup, and boot prints going down.'],
  },
  {
    id: 'wild', archetype: 'lair', names: ['the beasts of the deep wood', 'the things in the brush', 'the pack'], one: 'a beast', beastly: true,
    themes: ['forest', 'bog'],
    members: ['wolf', 'giant-badger', 'giant-spider', 'dire-wolf', 'brown-bear', 'giant-boar', 'ettercap', 'owlbear'],
    leaders: ['giant-boar', 'ettercap', 'owlbear', 'giant-ape'],
    rooms: ['Den', 'Webbed Hollow', 'Gnawed Bones', 'Wallow'],
    sign: ['Claw marks on the stone, too deep for anything friendly.'],
  },
  {
    id: 'lizardfolk', archetype: 'hive', names: ['the Blackscale tribe', 'the Reed Hunters', 'the Silent Tongue'], one: 'a lizardfolk',
    themes: ['bog', 'marsh'],
    members: ['lizardfolk', 'giant-toad', 'giant-constrictor-snake', 'scout'],
    leaders: ['giant-constrictor-snake', 'lizardfolk', 'giant-crocodile'],
    parley: { skill: 'survival', dc: 13, label: 'Trade with them', success: 'Salt and a good knife, and a long, unblinking look. They let you pass.' },
    rooms: ['Hatchery', 'Smoking Racks', 'Shaman\'s Pool', 'Totem Hall'],
    sign: ['Fish bones arranged in a careful spiral on the threshold.'],
  },
  {
    id: 'fire-court', archetype: 'court', names: ['the Court of Cinders', 'the Ember Host', 'the Forgebound'], one: 'something burning',
    themes: ['ember'],
    members: ['magmin', 'magma-mephit', 'steam-mephit', 'azer', 'hell-hound'],
    leaders: ['azer-forgecaller', 'azer', 'hell-hound', 'salamander', 'fire-elemental'],
    parley: { skill: 'persuasion', dc: 15, label: 'Speak the forge-oath', success: 'The fire in them dims to a polite glow. You are, it seems, guests.' },
    rooms: ['Slag Throne', 'Bellows Shrine', 'Molten Pool', 'Anvil of Oaths'],
    sign: ['The air shimmers, and the stone underfoot is warm as a hearth.'],
  },
  {
    id: 'gnolls', archetype: 'lair', names: ['the Laughing Pack', 'the Bloodmaw gnolls', 'the Hungry Ones'], one: 'a gnoll',
    themes: ['forest', 'stone', 'stockade'],
    members: ['gnoll', 'giant-hyena', 'gnoll-packcaller'],
    leaders: ['gnoll-packcaller', 'ogre-mage'],
    rooms: ['Bone Heap', 'Feeding Pit', 'Howling Hall'],
    sign: ['Laughter, high and wrong, from somewhere ahead.'],
  },
  {
    id: 'hag-court', archetype: 'court', names: ['the Mire Coven', 'the Green Mother\'s brood', 'the Hollow Court'], one: 'something fey',
    themes: ['bog', 'forest', 'marsh'],
    members: ['sprite', 'satyr', 'dryad', 'giant-toad', 'worg', 'will-o-wisp'],
    leaders: ['green-hag', 'night-hag'],
    parley: { skill: 'persuasion', dc: 14, label: 'Strike a bargain', success: 'A bargain, sealed with a laugh you do not like. They let you by — for now.' },
    rooms: ['Cauldron Room', 'Bone Garden', 'Mirror Pool', 'Bower'],
    sign: ['Flowers growing out of the stone, in the dark, where nothing should grow.'],
  },
  // The out-of-doors themes' own (OUTDOOR_THEMES).
  {
    id: 'raiders', archetype: 'camp', names: ['the raiders', 'the raiders of the den'], one: 'a raider',
    themes: ['stockade'],
    // People, mostly: raiders with names and cook rotas, and a few dogs.
    members: ['bandit', 'scout', 'guard', 'orc', 'berserker', 'worg', 'giant-hyena'],
    leaders: ['bandit-captain', 'berserker', 'veteran'],
    parley: { skill: 'intimidation', dc: 13, label: 'Tell them the chief is finished', success: 'They look at each other, then at the gate. Nobody here was paid enough for this.' },
    rooms: ['Kennel Run', 'Plunder Tent', 'Bone Fire'],
    sign: ['A stolen cart stands just inside, its sides hacked with the raiders\' mark.'],
    roused: ['A horn brays from the watch platform, and the whole camp comes awake: shouting, running, torches along the tent lines.'],
    intros: [
      'A raider looks up from the fire with his mouth full, and shouts with it.',
      'Two of them come out of a tent still buckling on stolen mail.',
      'Something laughs behind the wood pile, high and wrong, and the raiders by it get up.',
      'They were throwing dice for a carter\'s boots. They stop.',
    ],
    patrol: [
      'Torches come round the tents, and a voice shouts that it has found you.',
      'A horn sounds close by, and the raiders who were hunting you stop hunting.',
    ],
  },
  {
    id: 'marsh-things', archetype: 'lair', names: ['the things in the marsh'], one: 'one of the marsh\'s things', beastly: true,
    themes: ['marsh'],
    // The Reedwife's creatures, and the drowned she keeps: no graveyard ghouls.
    members: ['giant-toad', 'lizardfolk', 'zombie', 'giant-constrictor-snake', 'will-o-wisp', 'giant-crocodile'],
    leaders: ['giant-constrictor-snake', 'lizardfolk', 'giant-crocodile'],
    rooms: ['Brand Stake', 'Cold Pool'],
    roused: ['Every frog in the marsh stops at once. In the silence, something big turns over in the water, and starts toward you.'],
    sign: ['A reed stake by the path, and something tied to it that used to be a hare.'],
    intros: [
      'The water is colder here than it should be, and it moves when you stop.',
      'A shape in the reeds stands up. It has been waiting a long time, and it does not breathe.',
      'Something heavy slides off a tussock into the water, and then the water comes for you.',
      'Every frog in the reeds goes quiet at once.',
    ],
    patrol: ['Something has followed your trail through the water, and it has caught up.'],
  },
] satisfies Faction[]).map((f) => [f.id, f]));

/**
 * Whether a faction can field its own fights for a party of this level. Some
 * cannot: every gnoll is kept from a 1st-level party, and a faction whose
 * members are all out of reach would quietly field strangers under its name.
 */
export function canHold(f: Faction, level: number): boolean {
  const cap = memberCapFor(level);
  const own = arenaRoster(level).filter((m) => f.members.includes(m.id) && m.xp <= cap);
  // Two, because a pool of one cannot be drawn from (see `affordableTypes`).
  if (own.length < 2) return false;
  /*
   * And enough of a fight in them. Kobolds at 5th level are a crowd of 25 XP
   * bodies that cannot spend a tenth of a room's budget: measured, a
   * kobold-held 5th-level delve was a walk, its boss fights at 0.23 of even.
   * Its strongest member, as many times as a fight may field, must reach
   * most of a room fight.
   */
  const dearest = own.reduce((a, m) => (m.xp > a.xp ? m : a));
  const crowd = Array.from({ length: maxCountFor(level) }, () => dearest.id);
  return adjustedXp(crowd) >= 0.6 * evenBudgetFor(level) * shareFor('room', level);
}

/** The factions that can hold a place of this theme, at this level. */
export function factionsFor(theme: SpecTheme, level: number): Faction[] {
  return Object.values(FACTIONS).filter((f) => f.themes.includes(theme) && canHold(f, level));
}
