/**
 * Where a generated place came from.
 *
 * Dwarf Fortress and Caves of Qud generate a place's past, and the prose
 * stops feeling random because every line is drawn from ONE story: who built
 * it, what went wrong, who holds it now. That last part is the floor's
 * inhabitants (factions.ts), so the history and the fights are one draw.
 */
import type { Faction } from '../data/factions.js';
import type { Dice } from './dungeon-gen.js';
import type { SpecTheme } from './delve-spec.js';

interface Builder { who: string; traces: string[] }
interface Calamity { adj: string; what: string; traces: string[] }

const BUILDERS: Partial<Record<SpecTheme, Builder[]>> = {
  stone: [
    { who: 'dwarven miners', traces: ['Dwarven runes over the arch, worn almost smooth.', 'Tool marks in the rock, neat as handwriting.'] },
    { who: 'a forgotten king\'s jailers', traces: ['Iron rings set into the wall, at the height of a man\'s wrists.', 'A tally scratched into the stone: hundreds of days.'] },
    { who: 'wizards of the old college', traces: ['A circle inlaid in silver on the floor, most of the silver pried out.', 'Scorch marks on the ceiling in a careful spiral.'] },
  ],
  graveyard: [
    { who: 'the monks of the Grey Rest', traces: ['Niches in the wall, each with a name, most of the names chipped away.', 'A prayer carved in the lintel: may they sleep.'] },
    { who: 'a noble house, for its dead', traces: ['A family crest on every tomb: a heron, its head struck off.', 'Gilt on the coffin lids, long since gone green.'] },
  ],
  ember: [
    { who: 'fire-priests of a dead god', traces: ['Soot-black murals of a god with a burning crown.', 'A brazier taller than a man, cold for a century.'] },
    { who: 'dwarven smiths', traces: ['Anvils sunk into the floor, each stamped with a maker\'s mark.', 'Channels in the floor for something molten.'] },
  ],
  bog: [
    { who: 'river-folk who worshipped the water', traces: ['Carved fish on every pillar, their eyes inlaid with shell.', 'Offerings left on a ledge: coins, rotted bread, a child\'s shoe.'] },
    { who: 'an abbey that stood on dry ground', traces: ['The top of a chapel window, just above the waterline.', 'Hymn numbers on a board, still legible under the slime.'] },
  ],
  forest: [
    { who: 'elves, long before the trees grew back', traces: ['Stonework grown through with root, carved with leaves that are not quite leaves.', 'An archway shaped like two trees bowing.'] },
    { who: 'a hunting lodge\'s keepers', traces: ['Antlers nailed above the door, dozens of them.', 'A gamekeeper\'s ledger, swollen shut with rain.'] },
  ],
  village: [
    { who: 'honest farming folk', traces: ['A child\'s chalk drawing of a sun on the wall.', 'A harvest wreath over the door, gone brown.'] },
    { who: 'a lord who taxed it to the bone', traces: ['The tithe barn, its door broken outwards, not in.', 'A gibbet on the green, rope still on it.'] },
  ],
  marsh: [
    { who: 'reed-cutters, stake by stake', traces: ['Old stakes in a line across the water, each one notched by a different knife.', 'A reed-cutter\'s sickle, rusted to the shape of a question mark.', 'Bundles of cut reed, stacked to dry a season ago and left to rot.'] },
    { who: 'drovers taking cattle to market', traces: ['A gate standing alone in the reeds, with no fence either side of it.', 'Hoofprints set hard in an old mud bank.', 'A drover\'s horn hanging from a willow, green with age.'] },
    { who: 'eel-fishers, for the abbey\'s Fridays', traces: ['Wicker traps, split and empty, piled on the bank.', 'A smoking-rack with nothing on it but a heron\'s feather.'] },
  ],
  stockade: [
    { who: 'a miller, whose wheel still turns in the race', traces: ['A millstone, split in two and used for a table.', 'Flour in the cracks of the floorboards, years of it.'] },
    { who: 'drovers, for a cattle fair', traces: ['A fair-booth sign, painted over with something cruder.', 'Cattle pens, the rails mended with stolen cart-wheels.'] },
    { who: 'woodcutters, round their charcoal clamps', traces: ['A charcoal clamp gone cold, a sooty dome of earth.', 'Axe-marks on every stump, and the axes long gone.'] },
  ],
};

const CALAMITIES: Partial<Record<SpecTheme, Calamity[]>> = {
  stone: [
    { adj: 'Sealed', what: 'they dug too deep, and sealed the lower halls behind them', traces: ['A wall of newer stone across an older passage, mortared in a hurry.'] },
    { adj: 'Broken', what: 'an earthquake split it and they never came back', traces: ['A crack across the floor wide enough to lose a boot in.'] },
  ],
  graveyard: [
    { adj: 'Restless', what: 'a plague filled it faster than the monks could pray', traces: ['Bodies stacked three to a niche, wrapped in haste.'] },
    { adj: 'Cursed', what: 'a necromancer was buried here, and did not stay buried', traces: ['A sarcophagus, its lid on the floor, its inside scratched.'] },
  ],
  ember: [
    { adj: 'Burning', what: 'the fires got loose and never went out', traces: ['Stone run like wax and set again.'] },
    { adj: 'Ashen', what: 'something answered their prayers', traces: ['Ash on everything, in drifts, warm underneath.'] },
  ],
  bog: [
    { adj: 'Drowned', what: 'the river rose and took it', traces: ['A tide-line on the walls, higher than your head.'] },
    { adj: 'Sunken', what: 'the ground gave way under it, a little every year', traces: ['Floors tilted like a ship\'s deck, all sloping one way.'] },
  ],
  forest: [
    { adj: 'Overgrown', what: 'the wood took it back', traces: ['A tree growing straight up through the middle of the floor.'] },
    { adj: 'Hollow', what: 'something in the wood began taking people', traces: ['Packs and boots left in a heap, as if their owners walked out of them.'] },
  ],
  village: [
    { adj: 'Silent', what: 'a sickness emptied it in one winter', traces: ['Doors marked with a red cross, the paint flaking.'] },
    { adj: 'Burned', what: 'raiders came at harvest', traces: ['Black timbers, and a well filled in with stones.'] },
  ],
  marsh: [
    { adj: 'Drowned', what: 'the water rose one spring and never went back down', traces: ['The roof of a hut, just above the water, a heron standing on it.'] },
    { adj: 'Sunken', what: 'the ground under it began to drink', traces: ['A cart, sunk to its axles and then to its bed, and then to its rails.'] },
    { adj: 'Blackwater', what: 'the fishing failed and the lights in the reeds began', traces: ['A lantern on a pole, its glass smashed from the inside.'] },
  ],
  stockade: [
    { adj: 'Burnt', what: 'raiders came, and stayed', traces: ['Scorch marks on every older timber, and new wood lashed over them.'] },
    { adj: 'Taken', what: 'outlaws fenced it in and called it theirs', traces: ['A wall of stakes, sharpened outward, still sticky with sap.'] },
    { adj: 'Gallows', what: 'the reeve hanged a man here, and his friends came back for it', traces: ['A gibbet at the gate, empty, its rope cut.'] },
  ],
};

const PLACES: Partial<Record<SpecTheme, string[]>> = {
  stone: ['Halls', 'Hold', 'Deeps', 'Keep'],
  graveyard: ['Crypts', 'Catacombs', 'Barrows', 'Charnel'],
  ember: ['Forges', 'Furnaces', 'Kilns', 'Deeps'],
  bog: ['Abbey', 'Cellars', 'Halls', 'Mere'],
  forest: ['Hollow', 'Lodge', 'Ruins', 'Grove'],
  village: ['Hamlet', 'Steading', 'Parish', 'Crossing'],
  marsh: ['Causeway', 'Fen', 'Reed Cut', 'Mere'],
  stockade: ['Camp', 'Stockade', 'Mill', 'Fairground'],
};

/** As dungeon-gen's OUTDOOR_THEMES (not imported: the generator imports this). */
const OUT_OF_DOORS: readonly string[] = ['marsh', 'stockade'];

export interface History {
  title: string;
  /** The place's story, one paragraph, for the door and the menu. */
  story: string;
  /** First-visit lines for rooms that have none: the past showing through. */
  traces: string[];
}

/** One past for a place, ending in whoever holds it now. */
export function drawHistory(theme: SpecTheme, dice: Dice, holders: readonly Faction[]): History {
  const t = BUILDERS[theme] ? theme : 'stone';
  const b = dice.pick(BUILDERS[t]!);
  const c = dice.pick(CALAMITIES[t]!);
  const title = `The ${c.adj} ${dice.pick(PLACES[t]!)}`;
  const now = holders.length === 0 ? 'Nobody knows what lives there now.'
    : holders.length === 1 ? `Now ${dice.pick(holders[0]!.names)} hold it.`
    // (Out of doors there are no halls to go down into.)
    : OUT_OF_DOORS.includes(theme) ? `Now ${dice.pick(holders[0]!.names)} hold the near end, and ${dice.pick(holders[1]!.names)} the far end.`
    : `Now ${dice.pick(holders[0]!.names)} hold the upper halls, and ${dice.pick(holders[1]!.names)} the deeper ones.`;
  return {
    title,
    story: `Built by ${b.who}, until ${c.what}. ${now}`,
    traces: [...b.traces, ...c.traces],
  };
}
