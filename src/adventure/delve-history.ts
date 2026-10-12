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

const BUILDERS: Record<SpecTheme, Builder[]> = {
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
};

const CALAMITIES: Record<SpecTheme, Calamity[]> = {
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
};

const PLACES: Record<SpecTheme, string[]> = {
  stone: ['Halls', 'Hold', 'Deeps', 'Keep'],
  graveyard: ['Crypts', 'Catacombs', 'Barrows', 'Charnel'],
  ember: ['Forges', 'Furnaces', 'Kilns', 'Deeps'],
  bog: ['Abbey', 'Cellars', 'Halls', 'Mere'],
  forest: ['Hollow', 'Lodge', 'Ruins', 'Grove'],
  village: ['Hamlet', 'Steading', 'Parish', 'Crossing'],
};

export interface History {
  title: string;
  /** The place's story, one paragraph, for the door and the menu. */
  story: string;
  /** First-visit lines for rooms that have none: the past showing through. */
  traces: string[];
}

/** One past for a place, ending in whoever holds it now. */
export function drawHistory(theme: SpecTheme, dice: Dice, holders: readonly Faction[]): History {
  const b = dice.pick(BUILDERS[theme]);
  const c = dice.pick(CALAMITIES[theme]);
  const title = `The ${c.adj} ${dice.pick(PLACES[theme])}`;
  const now = holders.length === 0 ? 'Nobody knows what lives there now.'
    : holders.length === 1 ? `Now ${dice.pick(holders[0]!.names)} hold it.`
    : `Now ${dice.pick(holders[0]!.names)} hold the upper halls, and ${dice.pick(holders[1]!.names)} the deeper ones.`;
  return {
    title,
    story: `Built by ${b.who}, until ${c.what}. ${now}`,
    traces: [...b.traces, ...c.traces],
  };
}
