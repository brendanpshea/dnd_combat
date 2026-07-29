/**
 * What a hazard tile actually does, per theme.
 *
 * WHY THIS EXISTS
 *
 * `terrain: 'hazard'` used to mean exactly one thing everywhere: 1d4 fire on
 * entry, from a single constant. That was wrong twice over.
 *
 * It was wrong about D&D. Lava is not a scratch; the SRD's is 10d10, and a
 * hazard you can stroll through for two hit points is not a hazard, it is a
 * texture. It was also the reason a shove into fire never beat swinging a
 * sword — measured, and the honest conclusion was that the HAZARD was too
 * small, not that shove was underpriced.
 *
 * And it was wrong about the fiction. The board now draws five different
 * hazards — molten rock, burning wreckage, necrotic gas, a bramble thicket,
 * bubbling muck — and all five burned you for the same 1d4 of fire. Brambles
 * that deal fire damage are a bramble-shaped lava pool.
 *
 * A HAZARD IS NOT ALWAYS DAMAGE
 *
 * Brambles should barely hurt and should CATCH you, which is a different kind
 * of dangerous and the more interesting one on a grid. Restrained-with-a-save
 * is exactly the Web model, which the engine already has, so the thicket
 * borrows it rather than inventing anything.
 *
 * WHY LAVA IS 3d6 AND NOT 10d10
 *
 * The Fire Pit map is twelve tiles of it. At 10d10 nothing below about level 12
 * survives a single step, which does not make the map dangerous — it makes it
 * unplayable, and a hazard that always kills stops being a decision. 3d6 is
 * about half a mid-level hero: enough that the risk badge shouts, enough that
 * shoving somebody in is a real play, survivable enough to gamble on.
 */
import type { DamageType, ConditionId, Ability } from '../engine/types.js';
import type { MapTheme } from './maps.js';

export interface HazardKind {
  /** Shown in logs and tooltips: "the lava", "the brambles". */
  name: string;
  /** Rolled on entry. Always applies — no save avoids the damage itself. */
  damage: string;
  damageType: DamageType;
  /**
   * A rider the victim can save against, if this hazard has one.
   *
   * The save is only ever for the CONDITION, never for the damage. One rule to
   * hold in your head — you always get burned, you might get caught — and it
   * keeps the existing "damage on entry" model intact.
   */
  rider?: {
    condition: ConditionId;
    ability: Ability;
    dc: number;
  };
}

export const HAZARDS: Record<MapTheme, HazardKind> = {
  // Molten rock. The dangerous one, and the reason the others need to differ
  // from it rather than the other way round.
  ember: { name: 'lava', damage: '3d6', damageType: 'fire' },
  // A ruin's hazard is a seam of the same stuff, opened up by whatever wrecked
  // the place.
  stone: { name: 'lava', damage: '3d6', damageType: 'fire' },
  // A sacked village burns, but it is burning timber rather than open lava.
  village: { name: 'burning wreckage', damage: '2d6', damageType: 'fire' },
  // Necrotic gas off an open grave: less damage than fire, and a type almost
  // nothing in the game resists.
  graveyard: { name: 'grave gas', damage: '2d4', damageType: 'necrotic' },
  /**
   * Brambles. Barely hurt, and CATCH — which is the whole point of them and
   * the reason a hazard is not simply a damage number.
   *
   * DC 12 is deliberately below the spell DCs in this game: a thicket is an
   * obstacle, not a save-or-lose. Restrained ends on a save at the end of the
   * victim's turn, exactly as a Web does.
   */
  forest: {
    name: 'brambles', damage: '1d4', damageType: 'piercing',
    rider: { condition: 'restrained', ability: 'str', dc: 12 },
  },
  // Bubbling muck: the swamp's own poison, sickening rather than searing.
  bog: {
    name: 'bubbling muck', damage: '1d4', damageType: 'poison',
    rider: { condition: 'poisoned', ability: 'con', dc: 12 },
  },
};

/** The default when a grid has no theme — the old behaviour, near enough. */
export const DEFAULT_HAZARD: HazardKind = HAZARDS.stone;

export function hazardFor(theme: MapTheme | undefined): HazardKind {
  return (theme && HAZARDS[theme]) || DEFAULT_HAZARD;
}
