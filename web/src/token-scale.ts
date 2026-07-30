/**
 * How big a token draws in its cell.
 *
 * Split out of `art.ts` because that module reads `import.meta.env`, which
 * means it cannot be imported outside Vite — and this is the part with a rule
 * in it worth testing. `art-registry.ts` was split off for the same reason.
 */
import type { CreatureSize } from '../../src/engine/types.js';
import { bandedScale } from '../../src/data/token-size.js';
import { TOKEN_FILL } from './token-fill.js';

/**
 * Board render scale, amplifying the size tiers the source framing only hints
 * at (so an ogre visibly towers over a kobold). 1 = default cell fit.
 */
const SCALE: Record<string, number> = {
  ogre: 1.3, 'brown-bear': 1.18, 'dire-wolf': 1.15, 'goblin-boss': 1.12,
  kobold: 0.82, 'giant-spider': 0.85, skeleton: 0.95,
  minotaur: 1.15, ettin: 1.3, 'ogre-mage': 1.3,
  bugbear: 1.15, gnoll: 1.1,
  'giant-badger': 0.95, 'giant-toad': 1.25, 'giant-hyena': 1.2, 'giant-boar': 1.25, 'giant-constrictor-snake': 1.3,
  gargoyle: 1.0, 'fire-elemental': 1.35, 'water-elemental': 1.35, 'earth-elemental': 1.4, 'air-elemental': 1.35,
  sprite: 0.8, satyr: 1.0, dryad: 1.0, 'green-hag': 1.15, unicorn: 1.35,
  cockatrice: 0.85, harpy: 1.0, manticore: 1.35, owlbear: 1.35, gorgon: 1.4,
  shadow: 0.95, specter: 1.0, 'will-o-wisp': 0.75, wight: 1.1, mummy: 1.1,
  'red-wyrmling': 1.15, 'white-wyrmling': 1.1, 'green-wyrmling': 1.1, 'blue-wyrmling': 1.15, 'black-wyrmling': 1.15,
  otyugh: 1.35, aboleth: 1.45,
  'dust-mephit': 0.8, 'ice-mephit': 0.8,
  'magma-mephit': 0.8, 'steam-mephit': 0.8,
  succubus: 1.0, 'bearded-devil': 1.1, 'night-hag': 1.05,
  'chain-devil': 1.15, hezrou: 1.3, glabrezu: 1.4, 'horned-devil': 1.35,
  worg: 1.1, 'rust-monster': 1.0, griffon: 1.25, ettercap: 1.05, basilisk: 1.15,
  'winter-wolf': 1.2, roper: 1.3, bulette: 1.4, remorhaz: 1.5, tyrannosaurus: 1.5,
  ghast: 1.0, banshee: 1.0, ghost: 1.0, wraith: 1.1, 'vampire-spawn': 1.05,
  'giant-scorpion': 1.2, elephant: 1.45, 'giant-crocodile': 1.35, mammoth: 1.5, 'giant-ape': 1.45,
  berserker: 1.05, veteran: 1.0, gladiator: 1.1, mage: 1.0, assassin: 1.0,
  scarecrow: 1.05, 'shield-guardian': 1.35, 'stone-golem': 1.45,
  magmin: 0.8, azer: 1.0, salamander: 1.25, 'invisible-stalker': 1.1,
  imp: 0.75, quasit: 0.75, dretch: 0.95, 'hell-hound': 1.1, 'barbed-devil': 1.15, vrock: 1.2,
  'gray-ooze': 0.95, 'ochre-jelly': 1.1, 'gelatinous-cube': 1.35, 'black-pudding': 1.2,
  'flying-sword': 0.9, 'rug-of-smothering': 1.1, 'flesh-golem': 1.2,
  // Huge creatures. They share one cell like everything else, so scale is the
  // only thing telling a player a fire giant isn't an ogre.
  troll: 1.3, 'hill-giant': 1.4, 'stone-giant': 1.45, 'frost-giant': 1.45, 'fire-giant': 1.5,
  chimera: 1.4, wyvern: 1.4, hydra: 1.5,
  'young-white': 1.45, 'young-black': 1.45, 'young-green': 1.45,
  'young-blue': 1.5, 'young-red': 1.5,
};

/**
 * The framing every token is corrected TOWARD, and how far a correction may go.
 *
 * A token's ink fills somewhere between 0.69 and 0.92 of its canvas depending on
 * which generation session drew it, and nothing downstream knew — so two
 * creatures of the same declared size rendered at visibly different sizes. The
 * four mephits are the clearest case: one declared size, one hand-tuned scale,
 * and fills of 0.78, 0.79, 0.88 and 0.90.
 *
 * The target is the measured median across the roster, so most art is already
 * at it and does not move. The clamp is what keeps this a correction rather than
 * a second scale system: art within ~12% of the house framing is left exactly
 * alone, and nothing is ever pushed further than that.
 */
const FILL_TARGET = 0.87;
const FILL_CLAMP = 0.12;

export function tokenScale(id: string, size?: CreatureSize): number {
  // The hand table above is an artist's tweak; `bandedScale` is the rule that
  // stops it drifting until size stops meaning anything. See data/token-size.ts.
  //
  // THE CORRECTION GOES AFTER THE BAND, and that ordering is the whole point.
  // Applied before, it does nothing at all: the band clamps the CSS scale into
  // a narrow range (small is 0.85-0.94), so whatever the correction did to the
  // input is flattened straight back out. Measured — all four mephits came out
  // bit-identical to before.
  //
  // The band is really a statement about APPARENT size, and apparent size is
  // `scale x fill`. Dividing the banded scale by the token's own fill is what
  // makes the band mean what it says: every small creature now occupies the
  // same fraction of its cell, whichever session drew it.
  const fill = TOKEN_FILL[id];
  const correction = fill
    ? Math.min(1 + FILL_CLAMP, Math.max(1 - FILL_CLAMP, FILL_TARGET / fill))
    : 1;
  return bandedScale(SCALE[id] ?? 1, size) * correction;
}
