/**
 * What kind of place a faction makes of where it lives.
 *
 * A held floor used to be a list of rooms: a name drawn from a pool, and a
 * fight in about half of them. That reads as a list, not a place. An
 * archetype gives each room a ROLE — the gate, where they sleep, where they
 * eat, where they keep what they took — and the role decides the room's
 * name, what the party sees on walking in, and what it holds. The same role
 * list serves every faction of the kind, so a new faction needs one word
 * (`archetype`), not a hand-built dungeon.
 *
 * Text may say `$one` (one of them: "a goblin") and `$they` (all of them,
 * by name: "the Redfang goblins").
 */
import type { Id } from '../engine/types.js';

/** Where on the floor. `gate`: a room every way to the goal runs through
 *  (its sub-boss); `vault`: beyond the goal, reached only past its holder. */
export type RoleWhere = 'near' | 'mid' | 'deep' | 'side' | 'any' | 'gate' | 'vault';

export interface RoomRole {
  id: Id;
  /** Its name indoors, and out of doors (a camp's tents, not its barracks). */
  names: { in: string[]; out: string[] };
  /** What the party sees on walking in (one drawn). */
  text: string[];
  /** …when its fight is not had here (a story's place keeps its own
   *  fights): the room as its people left it. Needed by a role that fights. */
  quiet?: string[];
  /** Out of doors, where its lines speak of walls and doors: its own. */
  out?: { text: string[]; quiet?: string[] };
  /** Who is in it: a fight to the room budget, a harder one, or nobody. */
  fight?: 'room' | 'elite';
  /** What a search turns up. `lore`: a line from the place's past (the
   *  story's own, `DelveSpec.lore`, where it gave one). */
  find?: 'coin' | 'potion' | 'lore';
  /** Where on the floor: by the way in, midway, by the goal, or off the path. */
  where: RoleWhere;
  /** Carries the floor's key, where it has a lock of its own. */
  keeps?: true;
}

export interface Archetype {
  id: Id;
  roles: RoomRole[];
  /** Its locked door (the floor's first lock), indoors and out of doors. */
  lock: { in: string; out: string };
  /** What the keeper's fall turns up. */
  key: string;
  /**
   * A way round the lock that its people forgot or never knew: hidden (found
   * by searching), from a room before the lock to one past it. Never round a
   * story's own lock.
   */
  backWay: { in: string; out: string };
}

const role = (r: RoomRole) => r;

export const ARCHETYPES: Record<Id, Archetype> = Object.fromEntries(([
  {
    // Goblins, bandits, raiders: people who sleep in shifts and keep a watch.
    id: 'camp',
    lock: { in: 'A gate of lashed timber, barred from the far side.', out: 'A gate of lashed timber, barred from the far side.' },
    key: 'The keeper wore the gate key on a thong round his neck.',
    backWay: { in: 'A gap behind the stores, where the wall has rotted. Someone has been using it.', out: 'A gap in the stakes behind the midden, just wide enough to squeeze through.' },
    roles: [
      role({ id: 'lieutenant', where: 'gate', fight: 'elite', names: { in: ['Inner Gate', 'Captain\'s Post'], out: ['Inner Stockade', 'Lieutenant\'s Fire'] },
        text: ['The chief\'s second holds the only way on, and has picked the best of them to help.', 'Someone has to keep the way to the chief. This one wants the job.'],
        quiet: ['A stool across the only way on, and nobody on it now.'] }),
      role({ id: 'plunder', where: 'vault', find: 'coin', names: { in: ['Strongroom', 'Chief\'s Hoard'], out: ['Plunder Tent', 'Chief\'s Wagon'] },
        text: ['Everything worth keeping, kept where only the chief could reach it.', 'Chests, sacks, and a cage. What they took, and who.'] }),
      role({ id: 'watch', where: 'near', fight: 'room', names: { in: ['Guardroom', 'Gatehouse'], out: ['Watch Platform', 'Sentry Gap'] },
        text: ['A stool, a dice cup, and a view of the way you came in.', 'Someone was meant to be watching this door.'], quiet: ['An empty stool and a cold brazier. Whoever kept watch here has gone.'] , out: { text: ['A plank on two barrels, a dice cup, and a view of the way you came in.', 'Someone was meant to be watching the gap in the stakes.'], quiet: ['An empty platform and a cold brazier. Whoever kept watch here has gone.'] } }),
      role({ id: 'bunks', where: 'mid', fight: 'room', names: { in: ['Barracks', 'Bunkroom'], out: ['Tents', 'Bedrolls'] },
        text: ['Bedrolls in rows, still warm. Not everyone here was asleep.', 'It smells of sweat and wet wool. Boots stand by every bed.'], quiet: ['Bedrolls in rows, all empty. Boots stand by some of them.'] }),
      role({ id: 'mess', where: 'mid', find: 'coin', names: { in: ['Mess Hall', 'Kitchens'], out: ['Cook Fire', 'Butcher\'s Block'] },
        text: ['A pot on the fire, and bowls set out for more than you would like to meet.', 'Gnawed bones, spilled ale, and a knife stuck in the table.'] }),
      role({ id: 'stores', where: 'side', fight: 'elite', keeps: true, find: 'potion', names: { in: ['Armory', 'Quartermaster\'s Store'], out: ['Plunder Heap', 'Stolen Carts'] },
        text: ['Everything they took is piled here, and someone big sits on top of it.', 'Racks of blades, sacks of grain, and a keeper who does not want to share.'], quiet: ['Everything they took is piled here, sorted by someone careful.'] }),
      role({ id: 'pens', where: 'side', names: { in: ['Cells', 'Kennels'], out: ['Horse Lines', 'Dog Pens'] },
        text: ['Chains on the wall, and straw that needs changing.', 'Something on a chain growls at you, then lies down again.'] , out: { text: ['Stakes and rope, and straw that needs changing.', 'Something on a tether growls at you, then lies down again.'] } }),
      role({ id: 'trophies', where: 'deep', find: 'lore', names: { in: ['Trophy Hall', 'Map Room'], out: ['Branding Post', 'Trophy Pole'] },
        text: ['Things taken from people who said no, hung up where everyone can see.', 'A rough map is pinned to the wall, with every farm on it marked.'] , out: { text: ['Things taken from people who said no, hung on a pole where everyone can see.', 'A rough map is scratched on a hide, with every farm on it marked.'] } }),
    ],
  },
  {
    // Beasts and things that hunt: no doors, no watch, just a den.
    id: 'lair',
    lock: { in: 'A rockfall chokes the way on. Something has piled it there on purpose.', out: 'A wall of thorn and deadwood, dragged into place.' },
    key: 'Under the biggest of them, a gnawed bone with a key still tied to it.',
    backWay: { in: 'A crawlway, scraped smooth by something that uses it often.', out: 'A tunnel under the roots, scraped smooth by something that uses it often.' },
    roles: [
      role({ id: 'mate', where: 'gate', fight: 'elite', names: { in: ['Narrows', 'Guarded Hollow'], out: ['Narrow Run', 'Thorn Gap'] },
        text: ['The way on narrows to one track, and something big lies across it.', 'The great one\'s mate keeps the way to its den, and does not move aside.'],
        quiet: ['The way on narrows to one track, flattened by something big that sleeps here.'] }),
      role({ id: 'hoard', where: 'vault', find: 'coin', names: { in: ['Back of the Den', 'Bone Hoard'], out: ['Hollow Under the Roots', 'Bone Hoard'] },
        text: ['Behind where it sleeps: everything it dragged home, and everyone it carried off.', 'Bones, packs and torn cloth. Some of it was carried here alive.'] }),
      role({ id: 'trail', where: 'near', names: { in: ['Scratched Passage', 'Claw Run'], out: ['Game Trail', 'Trampled Reeds'] },
        text: ['The walls are scored with claw marks, low down.', 'Something big comes this way often. The ground is worn smooth.'] , out: { text: ['The reeds are snapped flat in a wide path, low down.', 'Something big comes this way often. The ground is worn smooth.'] } }),
      role({ id: 'den', where: 'mid', fight: 'room', names: { in: ['Den', 'Sleeping Hollow'], out: ['Wallow', 'Flattened Nest'] },
        text: ['A nest of bones and hair, and the things that made it.', 'It is warm in here, and it is not empty.'], quiet: ['A nest of bones and hair. Whatever sleeps here is out.'] }),
      role({ id: 'larder', where: 'side', find: 'coin', names: { in: ['Larder', 'Bone Pit'], out: ['Gnawed Bones', 'Carcass Heap'] },
        text: ['What is left of their meals. Some of it had purses.', 'Bones, cracked for the marrow. A ring still on one finger.'] }),
      role({ id: 'young', where: 'side', fight: 'room', names: { in: ['Nursery', 'Brood Chamber'], out: ['Nest', 'Brood Hollow'] },
        text: ['The young are here, and so is their mother.', 'Small things squeal and scatter, and something larger rises.'], quiet: ['A nest of small bones and down, with nothing in it now.'] }),
      role({ id: 'water', where: 'mid', find: 'potion', names: { in: ['Drinking Pool', 'Seep'], out: ['Black Pool', 'Cold Spring'] },
        text: ['Water drips into a pool. Tracks of every size come down to drink.', 'The water is clear and very cold. Something lost a pack at the edge.'] }),
      role({ id: 'marked', where: 'deep', fight: 'elite', keeps: true, find: 'lore', names: { in: ['Marked Cave', 'Old Kill'], out: ['Brand Stake', 'Old Kill'] },
        text: ['The biggest of them sleeps here, on what is left of the last one who came looking.', 'Old blood, old bones, and a sign that this place belongs to someone.'], quiet: ['Old blood, old bones, and a sign that this place belongs to someone.'] }),
    ],
  },
  {
    // The dead, and what was buried with them.
    id: 'tomb',
    lock: { in: 'A grave-gate, chained shut.', out: 'A lych gate, chained shut.' },
    key: 'Round its neck on a chain: the key to the grave-gate.',
    backWay: { in: 'A wall where the old graves have fallen in. There is a way through the bones.', out: 'A grave fallen in on itself, opening into the vault beyond.' },
    roles: [
      role({ id: 'warden', where: 'gate', fight: 'elite', names: { in: ['Warden\'s Arch', 'Sealed Stair'], out: ['Lych Arch', 'Sealed Gate'] },
        text: ['A warden of the dead stands in the arch, as it has stood for a hundred years.', 'The way down is held by one who was buried to hold it.'],
        quiet: ['An arch, and an empty niche beside it where something used to stand.'] }),
      role({ id: 'reliquary', where: 'vault', find: 'coin', names: { in: ['Sealed Reliquary', 'Inner Tomb'], out: ['Sealed Vault', 'Founder\'s Tomb'] },
        text: ['The tomb behind the tomb. Whatever the dead were guarding, it is here.', 'A sealed room, opened now. Grave-gold, and other things put away down here.'] }),
      role({ id: 'antechamber', where: 'near', names: { in: ['Antechamber', 'Mourners\' Hall'], out: ['Lych Gate', 'Grave Row'] },
        text: ['Names cut in the wall, most of them worn away.', 'Dust lies thick on everything except the floor.'] , out: { text: ['Names cut in the headstones, most of them worn away.', 'The grass grows thick on everything except the path.'] } }),
      role({ id: 'ossuary', where: 'mid', fight: 'room', names: { in: ['Ossuary', 'Bone Gallery'], out: ['Charnel Pit', 'Open Graves'] },
        text: ['Skulls stacked to the ceiling. Some of them turn to watch you.', 'Bones in neat piles, and one pile that is not neat at all.'], quiet: ['Skulls stacked to the ceiling, every one of them still.'] , out: { text: ['Bones heaped in an open pit. Some of the skulls turn to watch you.', 'Bones in neat piles, and one pile that is not neat at all.'], quiet: ['Bones heaped in an open pit, every one of them still.'] } }),
      role({ id: 'niches', where: 'mid', fight: 'room', names: { in: ['Niche Walk', 'Catacomb'], out: ['Grave Rows', 'Sunken Plots'] },
        text: ['A hand comes out of a niche as you pass.', 'The shelves of the dead run on into the dark. Not all of them are full.'], quiet: ['The shelves of the dead run on into the dark, full and quiet.'] , out: { text: ['A hand comes up out of the earth as you pass.', 'The graves run on in rows into the mist. Not all of them are full.'], quiet: ['The graves run on in rows into the mist, all of them quiet.'] } }),
      role({ id: 'chapel', where: 'side', find: 'potion', names: { in: ['Chapel', 'Shrine'], out: ['Chapel', 'Wayside Shrine'] },
        text: ['A small altar, its candles long out. Someone left an offering.', 'Faded saints look down from the walls. One has had its eyes scratched out.'] , out: { text: ['A small altar under a roof of slates, its candles long out. Someone left an offering.', 'A wooden saint stands by the path. Someone has scratched out its eyes.'] } }),
      role({ id: 'grave-goods', where: 'side', fight: 'elite', keeps: true, find: 'coin', names: { in: ['Reliquary', 'Treasury of the Dead'], out: ['Rich Man\'s Tomb', 'Family Vault'] },
        text: ['The rich were buried here with their money, and one of them stayed to guard it.', 'Gold glints in a stone box, and the lid is already open.'], quiet: ['The rich were buried here with their money. The lids are all shut.'] }),
      role({ id: 'epitaph', where: 'deep', find: 'lore', names: { in: ['Embalming Room', 'Record Hall'], out: ['Sexton\'s Hut', 'Bell Tower'] },
        text: ['Tools for the dead, laid out in order, and a book of who was buried where.', 'A ledger of burials. The last page was written much later than the rest.'] }),
    ],
  },
  {
    // A cult: people who meet in secret, and what they meet for.
    id: 'cult',
    lock: { in: 'A door carved with their sign, and locked.', out: 'A ring of stakes hung with charms, and a gate in it, locked.' },
    key: 'A key on a cord, warm from its keeper\'s hand.',
    backWay: { in: 'A priest\'s hole behind a hanging, for leaving in a hurry.', out: 'A path behind the woodshed that the faithful are told not to use.' },
    roles: [
      role({ id: 'deacon', where: 'gate', fight: 'elite', names: { in: ['Deacon\'s Door', 'Veiled Arch'], out: ['Inner Ring', 'Veiled Path'] },
        text: ['The high priest\'s right hand bars the inner way, and the faithful stand with them.', 'Only the chosen pass here. The one who chooses is waiting.'],
        quiet: ['A veil across the inner way, and a stool for whoever keeps it.'] }),
      role({ id: 'sanctum', where: 'vault', find: 'coin', names: { in: ['Hidden Sanctum', 'Reliquary'], out: ['Hidden Grove', 'Offering Pit'] },
        text: ['What they prayed over, and who they meant to give it.', 'The cult\'s true treasure, and the ones they were saving for the last night.'] }),
      role({ id: 'front', where: 'near', fight: 'room', names: { in: ['Robing Room', 'Doorkeeper\'s Cell'], out: ['Woodshed', 'Lantern Post'] },
        text: ['Robes on hooks, one hook empty. Whoever wore it is close.', 'A bell on a string over the door. You have already rung it.'], quiet: ['Robes on hooks, and a bell on a string over the door.'] , out: { text: ['Robes hung on a branch, one branch bare. Whoever wore it is close.', 'A bell on a string across the path. You have already rung it.'], quiet: ['Robes hung on a branch, and a bell on a string across the path.'] } }),
      role({ id: 'dorm', where: 'mid', fight: 'room', names: { in: ['Dormitory', 'Cells'], out: ['Huts', 'Pilgrims\' Tents'] },
        text: ['Hard beds, and a holy sign scratched over each one.', 'They sleep in rows here, and pray before they do. They are not sleeping now.'], quiet: ['Hard beds, and a holy sign scratched over each one.'] }),
      role({ id: 'scriptorium', where: 'side', find: 'lore', names: { in: ['Scriptorium', 'Library'], out: ['Reading Tent', 'Copyist\'s Shed'] },
        text: ['Books copied by hand, the same few pages over and over.', 'Ink, quills, and a sermon half written. The last line is underlined twice.'] }),
      role({ id: 'offerings', where: 'side', find: 'coin', names: { in: ['Offering Room', 'Tithe Store'], out: ['Offering Pile', 'Tithe Cart'] },
        text: ['What the faithful gave. Some of them gave everything.', 'Coins, rings, and a child\'s toy, all heaped before a shut door.'] , out: { text: ['What the faithful gave. Some of them gave everything.', 'Coins, rings, and a child\'s toy, heaped at the foot of a stake.'] } }),
      role({ id: 'circle', where: 'deep', fight: 'elite', keeps: true, find: 'potion', names: { in: ['Ritual Circle', 'Inner Sanctum'], out: ['Standing Stones', 'Ash Ring'] },
        text: ['A circle on the floor, still smoking. The one who drew it is still here.', 'Chanting stops as you come in. Everyone turns.'], quiet: ['A circle on the floor, cold now, and ash in the middle.'] }),
    ],
  },
  {
    // A court: something proud that rules and is served.
    id: 'court',
    lock: { in: 'A gilded door that will not open for the uninvited.', out: 'A gate of living thorn that will not part for the uninvited.' },
    key: 'A key of gold, small and fine, that was never meant for a guest.',
    backWay: { in: 'A servants\' passage behind a panel, for coming and going unseen.', out: 'A servants\' path through the hedge, for coming and going unseen.' },
    roles: [
      role({ id: 'champion', where: 'gate', fight: 'elite', names: { in: ['Champion\'s Hall', 'Guarded Door'], out: ['Champion\'s Ring', 'Thorn Door'] },
        text: ['The court\'s champion stands at the inner door, and asks your names with a smile.', 'No one sees the throne without passing its champion first.'],
        quiet: ['A gilded door, and an empty place beside it where a champion stood.'] }),
      role({ id: 'treasury', where: 'vault', find: 'coin', names: { in: ['Private Treasury', 'Gilded Cage'], out: ['Hidden Bower', 'Gilded Cage'] },
        text: ['The court\'s best things, kept behind its ruler. Some of them can talk.', 'Gold, and gifts, and a cage hung with silk.'] }),
      role({ id: 'threshold', where: 'near', names: { in: ['Threshold', 'Hall of Petitions'], out: ['Gate of Thorns', 'First Ring'] },
        text: ['Everything here is made to make you feel small.', 'A space to wait in, and to be watched while you wait.'] }),
      role({ id: 'courtiers', where: 'mid', fight: 'room', names: { in: ['Gallery', 'Audience Hall'], out: ['Revel Ground', 'Dancing Ring'] },
        text: ['The court is gathered, and it is bored, and you are new.', 'They were laughing at something. Now they are looking at you.'], quiet: ['A grand room, set for a feast nobody came to.'] }),
      role({ id: 'servants', where: 'side', find: 'potion', names: { in: ['Servants\' Stair', 'Scullery'], out: ['Servants\' Fire', 'Woodpile'] },
        text: ['The servants\' way: plain, narrow, and empty for now.', 'Someone works here, and has run off and left the fire.'] }),
      role({ id: 'vault', where: 'side', fight: 'elite', keeps: true, find: 'coin', names: { in: ['Vault', 'Treasure Room'], out: ['Gilded Bower', 'Tribute Pile'] },
        text: ['Gifts from everyone who ever begged a favour here, and a guard who counts them.', 'Treasure, and something that sleeps on treasure.'], quiet: ['Gifts from everyone who ever begged a favour here, piled high.'] }),
      role({ id: 'archive', where: 'deep', find: 'lore', names: { in: ['Hall of Oaths', 'Archive'], out: ['Oath Stone', 'Bargain Tree'] },
        text: ['Promises carved in the wall, each with a name and a price.', 'A list of bargains struck, and what each one cost.'] , out: { text: ['Promises cut into a standing stone, each with a name and a price.', 'A list of bargains struck, and what each one cost.'] } }),
    ],
  },
  {
    // A hive: many small things, busy, and a great deal of them.
    id: 'hive',
    lock: { in: 'A door of woven reeds, barred with bone.', out: 'A wall of woven reeds, barred with bone.' },
    key: 'A bone key, carved with their god\'s face.',
    backWay: { in: 'A tunnel too low for them to bother guarding.', out: 'A ditch under the reed wall, too low for them to bother guarding.' },
    roles: [
      role({ id: 'brood-guard', where: 'gate', fight: 'elite', names: { in: ['Royal Tunnel', 'Guard Chamber'], out: ['Royal Mound', 'Guard Ring'] },
        text: ['The biggest of them stand shoulder to shoulder in the only way on.', 'A tunnel to the heart of the place, and its best guards in it.'],
        quiet: ['A wide tunnel to the heart of the place, scraped smooth by many feet.'] }),
      role({ id: 'heart', where: 'vault', find: 'coin', names: { in: ['Heart Chamber', 'Hoard Pit'], out: ['Heart Mound', 'Hoard Pit'] },
        text: ['The heart of the hive: everything they gathered, and everyone they took.', 'They bring their best finds here. Some of the finds are still alive.'] }),
      role({ id: 'traps', where: 'near', names: { in: ['Trap Workshop', 'Snare Run'], out: ['Snare Line', 'Pit Field'] },
        text: ['Tripwires, deadfalls, and a pile of springs. Mind your feet.', 'Little traps everywhere, most of them already sprung.'] }),
      role({ id: 'warren', where: 'mid', fight: 'room', names: { in: ['Warren', 'Burrows'], out: ['Mud Huts', 'Reed Huts'] },
        text: ['Tunnels too small for you, and far too many of them.', 'Dozens of eyes in the dark, and then all of them at once.'], quiet: ['Tunnels too small for you, and far too many of them.'] , out: { text: ['Huts too small for you, and far too many of them.', 'Dozens of eyes in the reeds, and then all of them at once.'], quiet: ['Huts too small for you, and far too many of them.'] } }),
      role({ id: 'eggs', where: 'side', fight: 'room', names: { in: ['Egg Chamber', 'Hatchery'], out: ['Hatchery', 'Nest Mound'] },
        text: ['Eggs, warm and carefully turned. The ones who turn them are close.', 'A nursery, fiercely kept.'], quiet: ['Eggshells, broken from the inside, and nothing else.'] }),
      role({ id: 'midden', where: 'side', find: 'coin', names: { in: ['Midden', 'Dump'], out: ['Midden', 'Refuse Heap'] },
        text: ['Everything they threw away. Some of it is worth having.', 'It stinks, but something shines in the heap.'] }),
      role({ id: 'shrine', where: 'deep', fight: 'elite', keeps: true, find: 'lore', names: { in: ['Shrine', 'Totem Hall'], out: ['Totem Ring', 'Shaman\'s Pool'] },
        text: ['A crude shrine to something much bigger than they are.', 'Their god is painted on the wall, and their priest is in front of it.'], quiet: ['A crude shrine to something much bigger than they are.'] , out: { text: ['A crude totem to something much bigger than they are.', 'Their god is painted on a pole, and their priest is in front of it.'], quiet: ['A crude totem to something much bigger than they are.'] } }),
    ],
  },
] satisfies Archetype[]).map((a) => [a.id, a]));
