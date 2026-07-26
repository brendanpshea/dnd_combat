/**
 * Player-facing names for conditions.
 *
 * The combat log used to print the raw id, which is fine for `paralyzed` and
 * gibberish for everything camel-cased: "Paladin is sacredWeapon.", "Druid is
 * shillelagh.", "Fighter is noReactions." A log is the only place most of the
 * rules are ever explained, so it cannot be reading out identifiers.
 *
 * Lives in `data/` rather than in the web app because the CLI renderer needs it
 * too, and that renderer is what the web log is built on — one map, both UIs.
 * The web's CONDITION_META keeps its longer explain-what-it-does labels for
 * badges and tooltips; these are the short names a sentence can use.
 */
import type { ConditionId } from '../engine/types.js';

export const CONDITION_NAME: Record<ConditionId, string> = {
  prone: 'prone',
  incapacitated: 'incapacitated',
  blinded: 'blinded',
  poisoned: 'poisoned',
  frightened: 'frightened',
  unconscious: 'unconscious',
  paralyzed: 'paralyzed',
  guided: 'marked by light',
  vexed: 'vexed',
  sapped: 'sapped',
  slowed: 'slowed',
  restrained: 'restrained',
  commanded: 'commanded',
  charmed: 'charmed',
  lured: 'spellbound',
  shielded: 'shielded',
  dodging: 'dodging',
  blessed: 'blessed',
  baned: 'baned',
  warded: 'warded',
  smiting: 'ready to smite',
  burning: 'burning',
  hasted: 'hasted',
  inspired: 'inspired',
  hidden: 'hidden',
  noReactions: 'unable to react',
  outlined: 'outlined in light',
  marked: "marked by the hunter",
  sacredWeapon: 'wielding a sacred weapon',
  sanctuary: 'under sanctuary',
  protected: 'protected from evil and good',
  bonded: 'warded by a bond',
  energyWarded: 'warded against an element',
  cursed: 'cursed',
  inspiring: 'holding an inspiration die',
  shillelagh: 'wielding a shillelagh',
};

export function conditionName(id: ConditionId): string {
  return CONDITION_NAME[id] ?? id;
}
