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
    // The Hollow Road's first fight (the road ambush): a forward scouting
    // party, two orcs, two archers and two bandits. Sized to bite at 1st level
    // (the party still at 1st, greedy AI: ~88% won fresh), not to be a
    // walk-over; losing it wakes the party on the carter's wagon.
    id: 'raiders-forward', name: 'Ashfang Outriders', suggestedLevel: 1,
    members: ['orc', 'orc', 'scout', 'scout', 'bandit', 'bandit'],
  },
  wilds: {
    id: 'wilds', name: 'Wild Hunt', suggestedLevel: 2,
    members: ['brown-bear', 'dire-wolf', 'wolf', 'wolf'],
  },
  cult: {
    id: 'cult', name: 'Cult of the Worm', suggestedLevel: 3,
    members: ['cult-fanatic', 'acolyte', 'ghoul', 'ghoul', 'animated-armor'],
  },
  // The Sunken Barrows' finale: the cult at the Warden's door, with the two
  // old kings' soldiers Marrow woke to keep it. The chapter's hardest fight,
  // fought at 4th level: ~82% fresh, and a lost fight wakes by the shaft for
  // a retry. The ladder keeps `cult`.
  'cult-at-door': {
    id: 'cult-at-door', name: 'The Worm at the Door', suggestedLevel: 4,
    members: ['cult-fanatic', 'acolyte', 'ghast', 'ghoul', 'animated-armor', 'wight', 'wight'],
  },
  // The Sunken Barrows: the cult once Marrow has stopped believing. He stands
  // aside; his acolyte and the things he raised do not. At the acolyte's
  // scream one of the two bronze soldiers at the door rises (the other waits
  // for Marrow's order, which never comes), and two of the kneelers rise to
  // fight beside it (priests: Marrow himself is the `cult-fanatic`, and he
  // does not fight here). One of the two "ghouls" at the door is a ghast,
  // here as in `cult-at-door`. ~80% at 4th (the bare four won 100%; with the
  // soldier alone still 100%; three priests ~31%). Its XP (2,500) is a little
  // under `cult-at-door`'s; `seal-doubt-words` pays the difference.
  'cult-wavering': {
    id: 'cult-wavering', name: 'The Worm Without Its Shepherd', suggestedLevel: 4,
    members: ['acolyte', 'ghast', 'ghoul', 'animated-armor', 'wight', 'priest', 'priest'],
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
    id: 'snake-pit', name: 'The Serpent Pool', suggestedLevel: 3,
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
    // The finale, met at 5th on every route (docs/balance.md): with the air
    // elemental it wins about 68% fresh (never surprised: a cracked door costs
    // only the sisters' fight), so a party that climbed to it spent feels the
    // stone (it won 98% as two elementals).
    members: ['fire-elemental', 'earth-elemental', 'air-elemental'],
  },
  // The Wyrmcalling's finale when the party tears the sisters out of the
  // stone: they fight in person, beside the last two things the stone got
  // out, a fire elemental and an azer (the "brass thing").
  'sisters-at-stone': {
    id: 'sisters-at-stone', name: 'The Sisters at the Stone', suggestedLevel: 5,
    // With the two magma mephits that scuttle out at the azer's heels: about
    // 76% fresh at 5th, 70% caught by the grey hands (84% without them).
    members: ['green-hag', 'green-hag', 'fire-elemental', 'azer-forgecaller', 'magma-mephit', 'magma-mephit'],
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
    id: 'hag-coven', name: 'Green Hag and Hired Blades', suggestedLevel: 4,
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
  // The Wyrmcalling's broken east line on the night of the peak (met at
  // 4th–5th; no XP): four harpies and the drake that flies with them.
  'harpy-roost': {
    id: 'harpy-roost', name: 'Harpy Roost', suggestedLevel: 4,
    members: ['harpy', 'harpy', 'harpy', 'harpy', 'wyvern'],
  },
  // The Wyrmcalling's risky camp in the hills (met at 4th–5th; no XP): three
  // harpies off the crags and a wyvern behind them. ~72% at 4th.
  'crag-harpies': {
    id: 'crag-harpies', name: 'Harpies of the Crags', suggestedLevel: 4,
    members: ['harpy', 'harpy', 'harpy', 'wyvern'],
  },
  // The manticore's toll-cliff (the ladder keeps `manticore-cliff`): the
  // manticore and the wyvern that roosts above its ledge (its goblins stay
  // in the rocks). ~84% at 4th, ~75% stung first.
  'manticore-toll': {
    id: 'manticore-toll', name: 'The Toll-Cliff', suggestedLevel: 4,
    members: ['manticore', 'wyvern'],
  },
  // The boar-runs (the ladder keeps `boar-stampede`): the three leaders of
  // the herd. Met at 5th; no number of boars troubles a 5th-level party.
  'boar-runs': {
    id: 'boar-runs', name: 'The Boar-Runs', suggestedLevel: 4,
    members: ['giant-boar', 'giant-boar', 'giant-boar'],
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
  // The Wyrmcalling's valley of statues (the ladder keeps `gorgon-maze`): the
  // old bull, a younger one grazing out of sight among the statues, and two
  // gargoyles posing as statues. Met at 5th on every route: ~86% fresh, ~10%
  // worn (the gorgon alone, or two, won 100%; three gorgons ~70%, but paid
  // enough XP to lift the most thorough route to 6th).
  'gorgon-vale': {
    id: 'gorgon-vale', name: 'The Valley of Statues', suggestedLevel: 5,
    members: ['gorgon', 'gorgon', 'gargoyle', 'gargoyle'],
  },
  // The Sunken Barrows' cold open, fought at 3rd level: four shadows, the
  // churchyard's ghost, and two of the newly buried clawing out of their
  // graves (a ghast and a ghoul). ~90% at 3rd.
  'shadow-ambush': {
    id: 'shadow-ambush', name: 'Shadow Ambush', suggestedLevel: 3,
    members: ['shadow', 'shadow', 'shadow', 'shadow', 'ghost', 'ghast', 'ghoul'],
  },
  'specter-haunt': {
    id: 'specter-haunt', name: 'Specter Haunt', suggestedLevel: 2,
    members: ['specter', 'specter'],
  },
  // The crypt's painted dead: two of the old kings' painted soldiers, peeled
  // off the wall (the Undercrypt's risky camp, met at 4th; no XP).
  'painted-dead': {
    id: 'painted-dead', name: 'The Painted Dead', suggestedLevel: 4,
    members: ['wight', 'wight'],
  },
  // The Warden's stair at night (the Sunken Barrows' last risky camp; no XP):
  // two cold grey shapes, and a soldier of the old kings behind them.
  'stair-haunt': {
    id: 'stair-haunt', name: 'The Stair Haunt', suggestedLevel: 4,
    members: ['specter', 'specter', 'wight'],
  },
  // The fen's dead at night (the Sunken Barrows' risky camp on the causeway,
  // met at 4th; no XP): four ghouls and two ghasts. 100% fresh, ~70% worn at
  // 4th; a night ambush meets a party that camped because it was spent, so
  // the worn rate is the one to hold (a bronze soldier with them: 0% worn).
  // Part 1's marsh camp keeps `marsh-dead`.
  'fen-dead': {
    id: 'fen-dead', name: 'The Fen Dead', suggestedLevel: 3,
    members: ['ghoul', 'ghoul', 'ghoul', 'ghoul', 'ghast', 'ghast'],
  },
  // The Undercrypt's diggers (the ladder keeps `undead`): two skeletons,
  // three fresh dead and two ghouls. Met at 4th, and only by a company that
  // spends every way past (`diggers-roused`). Slipping past pays
  // `avoidedFightXP` of this roster (DIGGERS_SLIPPED), so its XP sets what
  // every route through the cut is paid, fought or not.
  diggers: {
    id: 'diggers', name: 'The Diggers', suggestedLevel: 3,
    members: ['skeleton', 'skeleton', 'zombie', 'zombie', 'zombie', 'ghoul', 'ghoul'],
  },
  // The Warden's own dead, through a cracked door (the Sunken Barrows' failed
  // rites; the ladder keeps `undead`): bones in barrow-bronze, fen-dead, and
  // two of the kings' soldiers. ~96% at 4th.
  'warden-dead': {
    id: 'warden-dead', name: 'The Warden\'s Dead', suggestedLevel: 4,
    members: ['skeleton', 'skeleton', 'skeleton', 'zombie', 'zombie', 'zombie', 'wight', 'wight'],
  },
  // The serpent pool (the ladder keeps `snake-pit`): three fen-serpents.
  // ~82% at 3rd, ~86% drawn off by Wren.
  'serpent-pool': {
    id: 'serpent-pool', name: 'The Serpent Pool', suggestedLevel: 3,
    members: ['giant-constrictor-snake', 'giant-constrictor-snake', 'giant-constrictor-snake'],
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
  // The Wyrmcalling's green den, met at 4th: the wyrmling, the two ettercaps
  // that spin its briar, their two giant spiders and two kobolds. ~92% at 4th.
  'green-dragon-den': {
    id: 'green-dragon-den', name: "Green Wyrmling's Thicket", suggestedLevel: 4,
    members: ['green-wyrmling', 'ettercap', 'ettercap', 'giant-spider', 'giant-spider', 'kobold', 'kobold'],
  },
  'white-dragon-den': {
    id: 'white-dragon-den', name: "White Wyrmling's Cave", suggestedLevel: 2,
    members: ['white-wyrmling', 'kobold', 'kobold'],
  },
  // The Wyrmcalling's blue den, met at 5th on every route: two kobold
  // spearmen and two emberlings tend the hoard, a whirlwind the stone's song
  // has torn loose spins between the lightning-rods, and two gargoyles keep
  // the watchtower. ~90–96% fresh, ~20% worn at 5th (the kobolds alone won
  // 100%). Two whirlwinds and one gargoyle won ~74%, but paid enough XP to
  // lift the most thorough route to 6th on the sisters' fall: Part 3 tops
  // out at 5th (docs/design-decisions.md).
  'blue-dragon-den': {
    id: 'blue-dragon-den', name: "Blue Wyrmling's Mesa", suggestedLevel: 5,
    members: ['blue-wyrmling', 'kobold', 'kobold', 'kobold-emberling', 'kobold-emberling', 'air-elemental', 'gargoyle', 'gargoyle'],
  },
  'red-dragon-den': {
    id: 'red-dragon-den', name: "Red Wyrmling's Forge", suggestedLevel: 4,
    members: ['red-wyrmling', 'kobold', 'kobold'],
  },
  // The Wyrmcalling's red den (the ladder keeps `red-dragon-den`), met at 5th
  // on every route: the wyrmling, its two kobolds, and the three smoking
  // hounds that sleep among its heaps. ~74% at 5th (the bare den won 100%).
  'red-forge': {
    id: 'red-forge', name: "Red Wyrmling's Forge", suggestedLevel: 5,
    members: ['red-wyrmling', 'kobold', 'kobold', 'hell-hound', 'hell-hound', 'hell-hound'],
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
  // A back-alley crew: a fixer (spy), two hired knives and three crossbowmen
  // on the stalls — the muscle a town informant keeps around. Met at 1st: ~78%
  // won fresh whether the party reads the ambush first or not.
  cutpurses: {
    id: 'cutpurses', name: 'Cutpurse Crew', suggestedLevel: 1,
    members: ['spy', 'scout', 'scout', 'scout', 'bandit', 'bandit'],
  },
  // The marsh keeps its dead: the Hollow Road's risky camp on the marsh road,
  // met at 2nd. Four ghouls clawing up out of the black water at night, and
  // the ghast that leads them (no XP: a night attack is a setback).
  'marsh-dead': {
    id: 'marsh-dead', name: 'The Marsh Dead', suggestedLevel: 2,
    members: ['ghoul', 'ghoul', 'ghoul', 'ghoul', 'ghast'],
  },
  // The Ashfang's goblin outriders: a boss, his worg and his swarming pack. The
  // road-out climax of Act 1 — still the humanoid, hired-blade face of the
  // band. With no milestone on the win, this fight carries more of the road to
  // 2nd level (~78% won by a 1st-level party, greedy AI).
  'goblin-outriders': {
    id: 'goblin-outriders', name: 'Goblin Outriders', suggestedLevel: 1,
    members: ['goblin-boss', 'worg', 'goblin-warrior', 'goblin-warrior', 'goblin-warrior', 'goblin-warrior'],
  },
  // The marsh tribe in the green hag's thrall — lizardfolk driven to serve, herding
  // one of her monstrous toads. The Act 2 climax: first proof the raiders command
  // more than hired swords.
  // Met at 2nd: ~90% won with the drop on them, ~78% caught in the reeds.
  'hag-thralls': {
    id: 'hag-thralls', name: 'The Hag\'s Thralls', suggestedLevel: 2,
    members: ['lizardfolk', 'lizardfolk', 'lizardfolk', 'lizardfolk', 'lizardfolk', 'giant-toad', 'giant-toad'],
  },
  // The den's gate: a bugbear enforcer and the gnoll pack the Ashfang let run
  // their perimeter for scraps, with the bone-hung packcaller that keeps them
  // and the giant hyena they run with. Fought or slipped (a slip pays
  // `avoidedFightXP`), it carries a share of the road to 3rd before the
  // chief's hall. Met at 2nd: ~82% (greedy AI, corridor), caught on the wall
  // about the same.
  'den-gate': {
    id: 'den-gate', name: 'Gate Enforcers', suggestedLevel: 2,
    members: ['bugbear', 'gnoll-packcaller', 'gnoll', 'gnoll', 'gnoll', 'giant-hyena'],
  },
  // The chief and the power behind him: the Ashfang warlord flanked by the green
  // hag whose marsh he sold his own people to, and one last human blade.
  'ashfang-warlord': {
    id: 'ashfang-warlord', name: 'The Ashfang Chief', suggestedLevel: 3,
    members: ['bandit-captain', 'green-hag', 'bandit'],
  },
  // The Hollow Road's hall as it is fought: the chief, the hag, and Hask, the
  // guard who answers to Vex — a veteran, the hall's real muscle, so turning
  // Vex (who stands him down) is felt — and a raider at the door. Met at 3rd:
  // ~70% won fresh, ~80% with the brand named. (The ladder keeps
  // `ashfang-warlord`.)
  'ashfang-hall': {
    id: 'ashfang-hall', name: 'The Ashfang Chief and His Guard', suggestedLevel: 3,
    members: ['bandit-captain', 'green-hag', 'veteran', 'bandit'],
  },
  // The hag after the chief turns on her, with his guard (Hask, the veteran)
  // and four raiders at her whistle. ~77% at 3rd. With Vex turned,
  // `hag-whistled` instead.
  'hag-guarded': {
    id: 'hag-guarded', name: 'The Reedwife and the Chief\'s Guard', suggestedLevel: 3,
    members: ['green-hag', 'veteran', 'orc', 'orc', 'orc', 'scout'],
  },
  // The same fight after Vex turns: his guard stands down, so the chief and
  // the hag face the party without him — the parley's promised payoff. What
  // answers her whistle instead is her own: a great marsh snake, with one
  // raider who stayed. ~80% at 3rd.
  'ashfang-warlord-alone': {
    id: 'ashfang-warlord-alone', name: 'The Ashfang Chief, Unguarded', suggestedLevel: 3,
    members: ['bandit-captain', 'green-hag', 'giant-constrictor-snake', 'bandit'],
  },
  // The Reedwife after Vargan turns, with Vex turned (Hask gone): her marsh
  // snake and the two raiders who come in from the yard at her whistle.
  // (The ladder keeps `hag-coven`.)
  'hag-whistled': {
    id: 'hag-whistled', name: 'The Reedwife at Bay', suggestedLevel: 3,
    members: ['green-hag', 'giant-constrictor-snake', 'orc', 'scout'],
  },
  // The Ashfang's kenneled hunting-beasts: three giant hyenas and three worgs
  // off their chains. ~90% at 3rd, in a room of the den.
  'kennel-hyenas': {
    id: 'kennel-hyenas', name: 'The Kennels', suggestedLevel: 3,
    members: ['giant-hyena', 'giant-hyena', 'giant-hyena', 'worg', 'worg', 'worg'],
  },
  // The den's night watch (the Hollow Road's risky camp in the den, met at
  // 3rd): an orc, two archers and the patrol's five worgs. No XP.
  'den-watch': {
    id: 'den-watch', name: 'The Night Watch', suggestedLevel: 3,
    members: ['orc', 'scout', 'scout', 'worg', 'worg', 'worg', 'worg', 'worg'],
  },
  // The watch at the pen, when the lock is broken loud (no XP: the price of
  // the captives): two axe-men, four archers and an orc. ~86% at 3rd.
  'pen-watch': {
    id: 'pen-watch', name: 'The Watch at the Pen', suggestedLevel: 3,
    members: ['berserker', 'berserker', 'scout', 'scout', 'scout', 'scout', 'orc'],
  },
  // The barrow off the marsh road (the Hollow Road's side fight, met at 2nd):
  // a specter and the barrow-wight it serves. ~78% at 2nd.
  'barrow-haunt': {
    id: 'barrow-haunt', name: 'The Barrow Haunt', suggestedLevel: 2,
    members: ['specter', 'wight'],
  },
  // The Hollow Road's bog toads (the ladder keeps `toad-swamp`): four of them.
  'bog-toads': {
    id: 'bog-toads', name: 'The Bog Toads', suggestedLevel: 2,
    members: ['giant-toad', 'giant-toad', 'giant-toad', 'giant-toad'],
  },
  // The muster yard: a captured ogre the Ashfang keep chained as a pit-brute,
  // loosed on you by two orc goaders. Fought on the classic ladder; The Hollow
  // Road fights `den-pit`, which grew from it.
  'den-muster': {
    id: 'den-muster', name: 'The Pit-Brute', suggestedLevel: 3,
    members: ['ogre', 'orc', 'orc'],
  },
  // The Hollow Road's pit as it is fought: the chained ogre and its two orc
  // goaders, with the berserker who is the pit's champion. A unique roster
  // (the module's only ogre) and the forced fight on the den's spine, so it
  // carries the rest of the road to 3rd before the chief's hall. Met at 2nd:
  // 86% on its own map (greedy AI, ruins, 200 seeds).
  'den-pit': {
    id: 'den-pit', name: 'The Pit-Brute and Its Champion', suggestedLevel: 2,
    members: ['ogre', 'berserker', 'orc', 'orc'],
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
  // The fen's corpse-lights: four wisps and the two drowned things they feed.
  // 100% at 3rd, but it drains the party. (Two ghasts more only bring it to
  // ~94%, for 225 XP a head that pushes the chapter's routes into 4th early.)
  'corpse-lights': {
    id: 'corpse-lights', name: 'The Corpse-Lights', suggestedLevel: 3,
    members: ['will-o-wisp', 'will-o-wisp', 'will-o-wisp', 'will-o-wisp', 'specter', 'specter'],
  },
  // The Barrow Gate: the ladder's `gargoyle-perch` and a suit of the old
  // kings' green bronze standing in the gateway below them. 93% at 3rd,
  // 100% at 4th.
  'barrow-watchers': {
    id: 'barrow-watchers', name: 'The Watchers at the Barrow Gate', suggestedLevel: 3,
    members: ['gargoyle', 'gargoyle', 'animated-armor'],
  },
  // The embalmed king, his household dead (ghasts in their funeral best) and
  // the soldier who keeps his chamber: the Undercrypt's hardest room before
  // the door. ~90% at 4th.
  'barrow-king': {
    id: 'barrow-king', name: 'The Embalmed King', suggestedLevel: 4,
    members: ['mummy', 'ghast', 'ghast', 'wight'],
  },
  // The sister's hired swords at the war-camp: a knight, a veteran sellsword,
  // three archers and two cutthroats. ~92% at 4th.
  'hired-swords': {
    id: 'hired-swords', name: 'The Sister\'s Hired Swords', suggestedLevel: 4,
    members: ['knight', 'veteran', 'scout', 'scout', 'scout', 'bandit', 'bandit'],
  },
  // The ogre-mage's hold, met at 4th (the oni's own ladder roster wins 13% at
  // 4th in a corridor): its orcs march out with it onto open ground before
  // the gate, three of them now. ~90% at 4th.
  'oni-hold': {
    id: 'oni-hold', name: 'The Ogre-Mage\'s Hold', suggestedLevel: 4,
    members: ['ogre-mage', 'orc', 'orc', 'orc'],
  },
  // The first thing on the high trail: a flight of griffons riding the
  // Calling's pull up the switchbacks. The hills' opening fight, on every road
  // up: five of them. ~88% at 4th.
  'griffon-flight': {
    id: 'griffon-flight', name: 'Griffons on the Switchbacks', suggestedLevel: 4,
    members: ['griffon', 'griffon', 'griffon', 'griffon', 'griffon'],
  },
  // The flooded pass: the water elemental, and the ice-mephits and the winter
  // wolf that came through the crack behind it. ~74% at 4th.
  'flooded-seam': {
    id: 'flooded-seam', name: 'The Flooded Pass', suggestedLevel: 4,
    members: ['water-elemental', 'ice-mephit', 'ice-mephit', 'ice-mephit', 'winter-wolf'],
  },
  // The giants' hall: the ettin, two ogres and two runners. ~88% at 4th.
  'giants-hall': {
    id: 'giants-hall', name: 'The Giants\' Hall', suggestedLevel: 4,
    members: ['ettin', 'ogre', 'ogre', 'orc', 'orc'],
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
