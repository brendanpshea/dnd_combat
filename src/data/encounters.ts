/**
 * Authored encounters: the hand-built fights the campaign ladder and the
 * adventure modules draw on, plus the XP and treasure arithmetic over a
 * roster of monsters.
 *
 * Split out of monsters.ts, which had grown to hold both the bestiary and
 * every fight built from it. The arena generates its rosters from MONSTERS
 * directly and never touches this file; `membersCoinXP` is the one piece it
 * borrows, because a generated fight needs the same "does this creature carry
 * a purse" rule an authored one does.
 */
import type { Combatant, TeamId, Id, CreatureType } from '../engine/types.js';
import { MONSTERS, MONSTER_XP, buildMonster } from './monsters.js';

export interface EncounterData {
  id: Id;
  name: string;
  members: Id[]; // monster ids; duplicates allowed
  suggestedLevel: number;
}

export const ENCOUNTERS: Record<Id, EncounterData> = {
  // Early-ladder sizes are tuned down: 5e's group multiplier (x2 for 5+
  // monsters) made these ~2x "deadly" for the level-1 party they front-load.
  goblins: {
    id: 'goblins', name: 'Goblin Warband', suggestedLevel: 1,
    members: ['goblin-boss', 'goblin-warrior', 'goblin-warrior'],
  },
  wolves: {
    id: 'wolves', name: 'Wolf Pack', suggestedLevel: 1,
    members: ['wolf', 'wolf', 'wolf'],
  },
  undead: {
    id: 'undead', name: 'Restless Dead', suggestedLevel: 2,
    members: ['skeleton', 'skeleton', 'zombie', 'zombie', 'zombie'],
  },
  ogre: {
    id: 'ogre', name: 'Ogre and Retinue', suggestedLevel: 3,
    members: ['ogre', 'goblin-warrior', 'goblin-warrior'],
  },
  bandits: {
    id: 'bandits', name: 'Bandit Camp', suggestedLevel: 2,
    members: ['bandit-captain', 'bandit', 'bandit', 'bandit', 'bandit'],
  },
  spiders: {
    id: 'spiders', name: 'Spider Nest', suggestedLevel: 2,
    members: ['giant-spider', 'giant-spider', 'giant-spider', 'giant-spider'],
  },
  crypt: {
    id: 'crypt', name: 'Crypt Crawlers', suggestedLevel: 3,
    members: ['acolyte', 'ghoul', 'ghoul', 'skeleton', 'skeleton'],
  },
  kobolds: {
    id: 'kobolds', name: 'Kobold Warren', suggestedLevel: 1,
    members: ['kobold', 'kobold', 'kobold', 'kobold', 'kobold', 'kobold'],
  },
  raiders: {
    id: 'raiders', name: 'Orc Raiders', suggestedLevel: 2,
    members: ['orc', 'orc', 'scout', 'scout', 'bandit'],
  },
  'raiders-forward': {
    // A forward scouting party — a level-1-appropriate first real fight (225 XP
    // vs the full warband's 425). One orc anchors two lighter humanoids.
    id: 'raiders-forward', name: 'Ashfang Outriders', suggestedLevel: 1,
    members: ['orc', 'scout', 'bandit'],
  },
  wilds: {
    id: 'wilds', name: 'Wild Hunt', suggestedLevel: 2,
    members: ['brown-bear', 'dire-wolf', 'wolf', 'wolf'],
  },
  cult: {
    id: 'cult', name: 'Cult of the Worm', suggestedLevel: 3,
    members: ['cult-fanatic', 'acolyte', 'ghoul', 'ghoul', 'animated-armor'],
  },
  // The Sunken Barrows' finale: the cult at the Warden's door, with an old
  // kings' soldier Marrow woke to keep it. The chapter's hardest fight, fought
  // at 4th level (the floor rides on the king). The ladder keeps `cult`.
  'cult-at-door': {
    id: 'cult-at-door', name: 'The Worm at the Door', suggestedLevel: 4,
    members: ['cult-fanatic', 'acolyte', 'ghast', 'ghoul', 'animated-armor', 'wight'],
  },
  // The Sunken Barrows: the cult once Marrow has stopped believing. He stands
  // aside, and so does the soldier he woke; his acolyte and the things he
  // raised do not. One of the two "ghouls" at the door is a ghast, here as
  // in `cult-at-door`.
  'cult-wavering': {
    id: 'cult-wavering', name: 'The Worm Without Its Shepherd', suggestedLevel: 4,
    members: ['acolyte', 'ghast', 'ghoul', 'animated-armor'],
  },
  knights: {
    id: 'knights', name: 'Knightly Order', suggestedLevel: 4,
    members: ['knight', 'scout', 'scout', 'bandit'],
  },
  labyrinth: {
    id: 'labyrinth', name: 'Labyrinth Terror', suggestedLevel: 4,
    members: ['minotaur', 'kobold', 'kobold', 'kobold'],
  },
  giants: {
    id: 'giants', name: 'Giant\'s Stronghold', suggestedLevel: 5,
    members: ['ettin', 'ogre', 'orc'],
  },
  // The same hall after the ogre-mage's warband raided it (the Wyrmcalling's
  // tricked-oni route): the ogre died in the yard, so it's lighter.
  'giants-raided': {
    id: 'giants-raided', name: 'The Raided Hall', suggestedLevel: 5,
    members: ['ettin', 'orc'],
  },
  temple: {
    id: 'temple', name: 'Corrupt Temple', suggestedLevel: 3,
    members: ['priest', 'acolyte', 'acolyte', 'skeleton', 'skeleton'],
  },
  oni: {
    id: 'oni', name: 'Oni\'s Warband', suggestedLevel: 5,
    members: ['ogre-mage', 'ogre', 'orc'],
  },
  watch: {
    id: 'watch', name: 'Town Watch', suggestedLevel: 1,
    members: ['guard', 'guard', 'guard', 'guard'],
  },
  ambush: {
    id: 'ambush', name: 'Bugbear Ambush', suggestedLevel: 2,
    members: ['bugbear', 'goblin-warrior', 'goblin-warrior'],
  },
  swamp: {
    id: 'swamp', name: 'Lizardfolk Tribe', suggestedLevel: 2,
    members: ['lizardfolk', 'lizardfolk', 'lizardfolk'],
  },
  pack: {
    id: 'pack', name: 'Gnoll Hunting Pack', suggestedLevel: 2,
    members: ['gnoll', 'gnoll', 'gnoll'],
  },
  syndicate: {
    id: 'syndicate', name: 'Shadow Syndicate', suggestedLevel: 3,
    members: ['spy', 'spy', 'bandit', 'bandit'],
  },
  'badger-den': {
    id: 'badger-den', name: 'Badger Den', suggestedLevel: 1,
    members: ['giant-badger', 'giant-badger', 'giant-badger'],
  },
  'toad-swamp': {
    id: 'toad-swamp', name: 'Festering Swamp', suggestedLevel: 2,
    members: ['giant-toad', 'giant-toad'],
  },
  'hyena-pack': {
    id: 'hyena-pack', name: 'Hyena Pack', suggestedLevel: 2,
    members: ['giant-hyena', 'giant-hyena', 'gnoll'],
  },
  'boar-stampede': {
    id: 'boar-stampede', name: 'Boar Stampede', suggestedLevel: 3,
    members: ['giant-boar', 'giant-boar'],
  },
  'snake-pit': {
    id: 'snake-pit', name: 'Viper Pit', suggestedLevel: 3,
    members: ['giant-constrictor-snake', 'giant-constrictor-snake'],
  },
  'gargoyle-perch': {
    id: 'gargoyle-perch', name: 'Gargoyle Perch', suggestedLevel: 3,
    members: ['gargoyle', 'gargoyle'],
  },
  'fire-nexus': {
    id: 'fire-nexus', name: 'Fire Nexus', suggestedLevel: 5,
    members: ['fire-elemental', 'cult-fanatic'],
  },
  'water-vortex': {
    id: 'water-vortex', name: 'Water Vortex', suggestedLevel: 5,
    members: ['water-elemental'],
  },
  'earth-tremor': {
    id: 'earth-tremor', name: 'Earth Tremor', suggestedLevel: 5,
    members: ['earth-elemental'],
  },
  'tempest-eye': {
    id: 'tempest-eye', name: 'Tempest Eye', suggestedLevel: 5,
    members: ['air-elemental'],
  },
  'elemental-cataclysm': {
    id: 'elemental-cataclysm', name: 'Elemental Cataclysm', suggestedLevel: 6,
    members: ['fire-elemental', 'earth-elemental'],
  },
  // The Wyrmcalling's finale when the party tears the sisters out of the
  // stone: they fight in person, with the one elemental the stone got out.
  'sisters-at-stone': {
    id: 'sisters-at-stone', name: 'The Sisters at the Stone', suggestedLevel: 5,
    members: ['green-hag', 'green-hag', 'fire-elemental'],
  },
  'sprite-glade': {
    id: 'sprite-glade', name: 'Sprite Glade', suggestedLevel: 1,
    members: ['sprite', 'sprite', 'sprite'],
  },
  'satyr-revelry': {
    id: 'satyr-revelry', name: 'Satyr Revelry', suggestedLevel: 2,
    members: ['satyr', 'satyr'],
  },
  'dryad-grove': {
    id: 'dryad-grove', name: 'Dryad Grove', suggestedLevel: 2,
    members: ['dryad', 'sprite', 'sprite'],
  },
  'hag-coven': {
    id: 'hag-coven', name: 'Hag Coven', suggestedLevel: 4,
    members: ['green-hag', 'bandit', 'bandit'],
  },
  'unicorn-sanctuary': {
    id: 'unicorn-sanctuary', name: 'Unicorn Sanctuary', suggestedLevel: 5,
    members: ['unicorn'],
  },
  'cockatrice-flock': {
    id: 'cockatrice-flock', name: 'Cockatrice Flock', suggestedLevel: 1,
    members: ['cockatrice', 'cockatrice'],
  },
  'harpy-roost': {
    id: 'harpy-roost', name: 'Harpy Roost', suggestedLevel: 2,
    members: ['harpy', 'harpy'],
  },
  'owlbear-den': {
    id: 'owlbear-den', name: 'Owlbear Den', suggestedLevel: 3,
    members: ['owlbear', 'brown-bear'],
  },
  'manticore-cliff': {
    id: 'manticore-cliff', name: 'Manticore Cliff', suggestedLevel: 3,
    members: ['manticore', 'goblin-warrior', 'goblin-warrior'],
  },
  'gorgon-maze': {
    id: 'gorgon-maze', name: 'Gorgon Lair', suggestedLevel: 5,
    members: ['gorgon'],
  },
  // The Sunken Barrows' cold open, fought at 3rd level: four shadows, not
  // two, so the churchyard pays its share of the road to 4th.
  'shadow-ambush': {
    id: 'shadow-ambush', name: 'Shadow Ambush', suggestedLevel: 2,
    members: ['shadow', 'shadow', 'shadow', 'shadow'],
  },
  'specter-haunt': {
    id: 'specter-haunt', name: 'Specter Haunt', suggestedLevel: 2,
    members: ['specter', 'specter'],
  },
  'wight-tomb': {
    id: 'wight-tomb', name: 'Wight Tomb', suggestedLevel: 3,
    members: ['wight', 'skeleton', 'skeleton'],
  },
  'mummy-crypt': {
    id: 'mummy-crypt', name: 'Mummy Crypt', suggestedLevel: 3,
    members: ['mummy', 'zombie', 'zombie'],
  },
  'wisp-bog': {
    id: 'wisp-bog', name: 'Wisp Bog', suggestedLevel: 4,
    members: ['will-o-wisp', 'will-o-wisp', 'specter'],
  },
  // Dragon wyrmlings — solo threats, some with kobold servitors. Breath is a
  // recharging AoE, so these hit hard for their tier; levels are set high.
  'black-dragon-den': {
    id: 'black-dragon-den', name: "Black Wyrmling's Bog", suggestedLevel: 2,
    members: ['black-wyrmling', 'kobold', 'kobold'],
  },
  // The Wyrmcalling's green and blue dens, met at 4th: two kobold
  // emberlings apiece tend the hoard beside the spearmen (still 100% at 4th).
  'green-dragon-den': {
    id: 'green-dragon-den', name: "Green Wyrmling's Thicket", suggestedLevel: 2,
    members: ['green-wyrmling', 'kobold', 'kobold', 'kobold-emberling', 'kobold-emberling'],
  },
  'white-dragon-den': {
    id: 'white-dragon-den', name: "White Wyrmling's Cave", suggestedLevel: 2,
    members: ['white-wyrmling', 'kobold', 'kobold'],
  },
  'blue-dragon-den': {
    id: 'blue-dragon-den', name: "Blue Wyrmling's Mesa", suggestedLevel: 3,
    members: ['blue-wyrmling', 'kobold', 'kobold', 'kobold', 'kobold-emberling', 'kobold-emberling'],
  },
  'red-dragon-den': {
    id: 'red-dragon-den', name: "Red Wyrmling's Forge", suggestedLevel: 4,
    members: ['red-wyrmling', 'kobold', 'kobold'],
  },
  'chromatic-clutch': {
    id: 'chromatic-clutch', name: 'Chromatic Clutch', suggestedLevel: 4,
    members: ['black-wyrmling', 'green-wyrmling', 'white-wyrmling'],
  },
  // The Wyrmcalling's brood on the rim: exactly the wyrmlings whose dens the
  // party left standing (g/b/r), so each den emptied is one fewer here.
  ...Object.fromEntries((['g', 'b', 'r', 'gb', 'gr', 'br', 'gbr'] as const).map((k) => [`den-clutch-${k}`, {
    id: `den-clutch-${k}`, name: 'The Brood on the Rim', suggestedLevel: 4,
    members: [...k].map((c) => ({ g: 'green-wyrmling', b: 'blue-wyrmling', r: 'red-wyrmling' })[c]!),
  }])),
  // A back-alley crew: a fixer (spy) and two hired knives — the muscle a town
  // informant keeps around. A first-real-fight step up from a bare street mug.
  cutpurses: {
    id: 'cutpurses', name: 'Cutpurse Crew', suggestedLevel: 1,
    members: ['spy', 'bandit', 'bandit'],
  },
  // The marsh keeps its dead. A pair of ghouls clawing up out of the black water
  // at night — a nastier camp-interruption than starving wolves.
  'marsh-dead': {
    id: 'marsh-dead', name: 'The Marsh Dead', suggestedLevel: 2,
    members: ['ghoul', 'ghoul'],
  },
  // The Ashfang's goblin outriders: a boss and his swarming pack. The road-out
  // climax of Act 1 — still the humanoid, hired-blade face of the band. Four
  // warriors, not three: with no milestone on the win, this fight carries more
  // of the road to 2nd level (88% won by a 1st-level party, greedy AI).
  'goblin-outriders': {
    id: 'goblin-outriders', name: 'Ashfang Outriders', suggestedLevel: 1,
    members: ['goblin-boss', 'goblin-warrior', 'goblin-warrior', 'goblin-warrior', 'goblin-warrior'],
  },
  // The marsh tribe in the green hag's thrall — lizardfolk driven to serve, herding
  // one of her monstrous toads. The Act 2 climax: first proof the raiders command
  // more than hired swords.
  'hag-thralls': {
    id: 'hag-thralls', name: 'The Hag\'s Thralls', suggestedLevel: 2,
    members: ['lizardfolk', 'lizardfolk', 'lizardfolk', 'giant-toad'],
  },
  // The den's gate: a bugbear enforcer and the gnolls the Ashfang let run their
  // perimeter for scraps.
  'den-gate': {
    id: 'den-gate', name: 'Gate Enforcers', suggestedLevel: 3,
    members: ['bugbear', 'gnoll', 'gnoll'],
  },
  // The chief and the power behind him: the Ashfang warlord flanked by the green
  // hag whose marsh he sold his own people to, and one last human blade.
  'ashfang-warlord': {
    id: 'ashfang-warlord', name: 'The Ashfang Chief', suggestedLevel: 3,
    members: ['bandit-captain', 'green-hag', 'bandit'],
  },
  // The Hollow Road's hall as it is fought: the chief, the hag, and Hask, the
  // guard who answers to Vex — a veteran, the hall's real muscle, so turning
  // Vex (who stands him down) is felt. (The ladder keeps `ashfang-warlord`.)
  'ashfang-hall': {
    id: 'ashfang-hall', name: 'The Ashfang Chief and His Guard', suggestedLevel: 3,
    members: ['bandit-captain', 'green-hag', 'veteran'],
  },
  // The hag after the chief turns on her, with his guard (Hask, the veteran)
  // and one raider at her whistle. With Vex turned, `hag-coven` instead.
  'hag-guarded': {
    id: 'hag-guarded', name: 'The Reedwife and the Chief\'s Guard', suggestedLevel: 3,
    members: ['green-hag', 'veteran', 'bandit'],
  },
  // The same fight after Vex turns: his guard stands down, so the chief and
  // the hag face the party alone — the parley's promised payoff.
  'ashfang-warlord-alone': {
    id: 'ashfang-warlord-alone', name: 'The Ashfang Chief, Unguarded', suggestedLevel: 3,
    members: ['bandit-captain', 'green-hag'],
  },
  // The Ashfang's kenneled hunting-beasts — two giant hyenas off their chains.
  'kennel-hyenas': {
    id: 'kennel-hyenas', name: 'The Kennels', suggestedLevel: 3,
    members: ['giant-hyena', 'giant-hyena'],
  },
  // The muster yard: a captured ogre the Ashfang keep chained as a pit-brute,
  // loosed on you by two orc goaders. A unique roster (the module's only ogre)
  // and the first thing you meet inside the palisade.
  'den-muster': {
    id: 'den-muster', name: 'The Pit-Brute', suggestedLevel: 3,
    members: ['ogre', 'orc', 'orc'],
  },
  // --- The trilogy's own spine fights, sized so fights carry the levels -----
  // (no milestone floors; see docs/module-writing-guide.md, "Levels come from
  // fights"). Each is the ladder roster it grew from, kept separate so the
  // classic ladder and the arena keep theirs. Win rates: a fresh party at the
  // level the chapter really meets it, greedy AI, 120 seeds.
  // The drowned chapel: Halden's flock, living and dead (`temple` + two
  // drowned parishioners). 92% at 3rd.
  'drowned-chapel': {
    id: 'drowned-chapel', name: 'The Drowned Chapel', suggestedLevel: 3,
    members: ['priest', 'acolyte', 'acolyte', 'ghoul', 'ghoul', 'skeleton', 'skeleton'],
  },
  // The fen's corpse-lights: three wisps and the drowned thing they feed.
  // 100% at 3rd, but it drains the party.
  'corpse-lights': {
    id: 'corpse-lights', name: 'The Corpse-Lights', suggestedLevel: 3,
    members: ['will-o-wisp', 'will-o-wisp', 'will-o-wisp', 'specter'],
  },
  // The embalmed king and his household dead, ghasts in their funeral best:
  // the Undercrypt's hardest room before the door. 91% at 3rd.
  'barrow-king': {
    id: 'barrow-king', name: 'The Embalmed King', suggestedLevel: 3,
    members: ['mummy', 'ghast', 'ghast'],
  },
  // The sister's hired swords at the war-camp: a knight, a veteran sellsword
  // and three archers. 96% at 4th.
  'hired-swords': {
    id: 'hired-swords', name: 'The Sister\'s Hired Swords', suggestedLevel: 4,
    members: ['knight', 'veteran', 'scout', 'scout', 'scout'],
  },
  // The ogre-mage's hold, met at 4th (the oni's own ladder roster wins 13% at
  // 4th in a corridor): its orcs march out with it onto open ground before
  // the gate. 73% at 4th.
  'oni-hold': {
    id: 'oni-hold', name: 'The Ogre-Mage\'s Hold', suggestedLevel: 4,
    members: ['ogre-mage', 'orc', 'orc'],
  },
  // The first thing on the high trail: a flight of griffons riding the
  // Calling's pull up the switchbacks. The hills' opening fight, on every road
  // up. 98% at 4th.
  'griffon-flight': {
    id: 'griffon-flight', name: 'Griffons on the Switchbacks', suggestedLevel: 4,
    members: ['griffon', 'griffon', 'griffon', 'griffon'],
  },
  // The flooded pass: the water elemental, and the ice-mephits that came
  // through the crack behind it. 95% at 4th.
  'flooded-seam': {
    id: 'flooded-seam', name: 'The Flooded Pass', suggestedLevel: 4,
    members: ['water-elemental', 'ice-mephit', 'ice-mephit', 'ice-mephit'],
  },
  // The giants' hall: the ettin, two ogres and a runner. 88% at 4th.
  'giants-hall': {
    id: 'giants-hall', name: 'The Giants\' Hall', suggestedLevel: 4,
    members: ['ettin', 'ogre', 'ogre', 'orc'],
  },
};

/**
 * SRD XP by CR, used to drive treasure and campaign leveling. Kept as a map
 * (not per-stat-block) so it stays in one readable place; a test asserts every
 * monster has an entry so the two can't drift.
 */

/** Total XP an encounter is worth (sum of member XP). */
export function encounterXP(encounterId: Id): number {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) return 0;
  return enc.members.reduce((sum, mid) => sum + (MONSTER_XP[mid] ?? 0), 0);
}

/**
 * What a fight is worth to each of a party of four: the XP owed to a company
 * that talks, sneaks or pays its way past it, so cleverness never leaves it
 * behind a company that fought (docs/module-writing-guide.md, "Levels come
 * from fights"). Reads the roster, so the reward follows any retuning.
 */
export function avoidedFightXP(encounterId: Id): number {
  return Math.round(encounterXP(encounterId) / 4);
}

/** Creature types that carry no coin or valuables — a wolf pack has no purse and
 *  hoards no gems. Everything else (humanoids, giants, dragons, fiends, fey) is
 *  assumed to bear or guard loot. Undead/constructs/monstrosities keep loot too,
 *  since they usually stand over a grave-hoard or a lair. */
const NO_TREASURE_TYPES = new Set<CreatureType>(['beast', 'elemental']);

/** The share of an encounter's XP that comes from loot-bearing creatures — the
 *  basis for coin and valuables. An all-beast fight yields 0 (XP only). */
export function encounterCoinXP(encounterId: Id): number {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) return 0;
  return membersCoinXP(enc.members);
}

/** As `encounterCoinXP`, for a roster with no encounter id — the arena builds
 *  its fights on the fly, and a generated wolf pack has no purse either. */
export function membersCoinXP(members: readonly Id[]): number {
  return members.reduce((sum, mid) => {
    const type = MONSTERS[mid]?.creatureType;
    const bears = !type || !NO_TREASURE_TYPES.has(type);
    return sum + (bears ? (MONSTER_XP[mid] ?? 0) : 0);
  }, 0);
}

/** Place an encounter on a rank, spread across the files. */
export function buildEncounter(encounterId: Id, team: TeamId, rank: number): Combatant[] {
  const enc = ENCOUNTERS[encounterId];
  if (!enc) throw new Error(`Unknown encounter: ${encounterId}`);
  const files = [3, 1, 5, 2, 6, 0, 7, 4];
  return enc.members.map((mid, i) =>
    buildMonster(mid, team, { x: files[i]!, y: rank }, enc.members.length > 1 ? String(i + 1) : ''),
  );
}
