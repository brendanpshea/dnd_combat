/**
 * Presentational metadata for conditions: the icon, plain-language label, and
 * (for a few heavy ones) a token tint. Pure data — no DOM, no engine — so the
 * board, the applied-flourish, and any future legend all read one source.
 *
 * `kind` orders which badges win the limited corner space when a creature
 * carries several: control effects (it can barely act) before other debuffs
 * before buffs.
 */
import type { ConditionId } from '../../src/engine/types.js';

export type ConditionKind = 'control' | 'debuff' | 'buff';

export interface ConditionMeta {
  icon: string;
  label: string;
  kind: ConditionKind;
  /** Token-wide colour wash for the most legible, longest-lasting effects. */
  tint?: 'poison' | 'fear' | 'frozen' | 'bound';
  /** Mechanically invisible or already shown another way — no corner badge. */
  hidden?: boolean;
}

export const CONDITION_META: Record<ConditionId, ConditionMeta> = {
  paralyzed:      { icon: '😵', label: 'Paralyzed — can’t move or act', kind: 'control', tint: 'frozen' },
  unconscious:    { icon: '💤', label: 'Unconscious', kind: 'control' },
  restrained:     { icon: '⛓️', label: 'Restrained — speed 0, easier to hit', kind: 'control', tint: 'bound' },
  commanded:      { icon: '🫵', label: 'Commanded — loses its next action', kind: 'control' },
  incapacitated:  { icon: '💫', label: 'Incapacitated — can’t take actions', kind: 'control' },
  frightened:     { icon: '😱', label: 'Frightened', kind: 'debuff', tint: 'fear' },
  poisoned:       { icon: '🤢', label: 'Poisoned — disadvantage on attacks', kind: 'debuff', tint: 'poison' },
  blinded:        { icon: '🌫️', label: 'Blinded', kind: 'debuff' },
  prone:          { icon: '🔻', label: 'Prone', kind: 'debuff' },
  slowed:         { icon: '🐌', label: 'Slowed', kind: 'debuff' },
  sapped:         { icon: '😩', label: 'Sapped — disadvantage on next attack', kind: 'debuff' },
  guided:         { icon: '🎯', label: 'Marked — next attack against it has advantage', kind: 'debuff' },
  outlined:       { icon: '🔆', label: 'Outlined — easier to hit, can’t hide', kind: 'debuff' },
  vexed:          { icon: '❗', label: 'Vexed', kind: 'debuff' },
  blessed:        { icon: '✨', label: 'Blessed', kind: 'buff' },
  baned:          { icon: '💀', label: 'Baned — -1d4 to attacks and saves', kind: 'debuff' },
  warded:         { icon: '🔰', label: 'Warded — +2 AC', kind: 'buff' },
  hasted:         { icon: '🐇', label: 'Hasted — double speed, +2 AC, an extra attack', kind: 'buff' },
  marked:         { icon: '🏹', label: 'Hunter’s Mark — takes extra damage from the hunter', kind: 'debuff' },
  inspired:       { icon: '⭐', label: 'Inspired — advantage on next attack', kind: 'buff' },
  shielded:       { icon: '🛡️', label: 'Shielded — +5 AC', kind: 'buff' },
  dodging:        { icon: '💨', label: 'Dodging — attacks against it have disadvantage', kind: 'buff' },
  sacredWeapon:   { icon: '⚔️', label: 'Sacred Weapon — +Cha to attack rolls', kind: 'buff' },
  // Shown by the token's own dimming, or purely internal — no badge.
  hidden:         { icon: '👻', label: 'Hidden', kind: 'buff', hidden: true },
  noReactions:    { icon: '', label: 'No reactions', kind: 'debuff', hidden: true },
};

const KIND_ORDER: Record<ConditionKind, number> = { control: 0, debuff: 1, buff: 2 };

/** Badge metadata for a creature's conditions, most-significant first. */
export function conditionBadges(ids: ConditionId[]): ConditionMeta[] {
  const seen = new Set<ConditionId>();
  const metas: ConditionMeta[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const m = CONDITION_META[id];
    if (m && !m.hidden) metas.push(m);
  }
  return metas.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/** The tint that should wash the token, if any — first by badge priority. */
export function conditionTint(ids: ConditionId[]): ConditionMeta['tint'] | undefined {
  return conditionBadges(ids).find((m) => m.tint)?.tint;
}
