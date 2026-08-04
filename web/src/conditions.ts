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

/*
 * EVERY LABEL CARRIES ITS OWN EXPLANATION, after an em dash.
 *
 * Seven of these were a bare word — "Prone", "Blessed" — from when the only way
 * to read one was to tap its badge, and the tap handler fell back to "A status
 * effect on this creature." when there was nothing after the dash. So the shrug
 * was already there; the badge just hid it. The chooser now prints these in
 * full, which made the gap visible.
 *
 * The wording states what THIS ENGINE does, not what the rulebook says. The
 * 5e frightened creature also cannot move closer to what scared it; this one
 * only attacks at disadvantage (see rules/attack.ts), and promising the rest
 * would be worse than saying less.
 */
export const CONDITION_META: Record<ConditionId, ConditionMeta> = {
  charmed:        { icon: '💗', label: 'Charmed — can’t attack whoever charmed it', kind: 'control' },
  lured:          { icon: '🎶', label: 'Lured — drawn toward the singer, and can’t act', kind: 'control', tint: 'fear' },
  fleeing:        { icon: '🏃', label: 'Fleeing — runs for the edge each turn, and is gone when it gets there', kind: 'control', tint: 'fear' },
  paralyzed:      { icon: '😵', label: 'Paralyzed — can’t move or act', kind: 'control', tint: 'frozen' },
  stunned:        { icon: '💫', label: 'Stunned — can’t move or act, and easier to hit', kind: 'control', tint: 'frozen' },
  unconscious:    { icon: '💤', label: 'Unconscious — attacks against it have advantage, and a melee hit is always a crit', kind: 'control' },
  restrained:     { icon: '⛓️', label: 'Restrained — speed 0, easier to hit', kind: 'control', tint: 'bound' },
  commanded:      { icon: '🫵', label: 'Commanded — loses its next action', kind: 'control' },
  incapacitated:  { icon: '💫', label: 'Incapacitated — can’t take actions', kind: 'control' },
  frightened:     { icon: '😱', label: 'Frightened — its own attacks have disadvantage', kind: 'debuff', tint: 'fear' },
  poisoned:       { icon: '🤢', label: 'Poisoned — disadvantage on attacks', kind: 'debuff', tint: 'poison' },
  blinded:        { icon: '🌫️', label: 'Blinded — its attacks have disadvantage, and attacks against it have advantage', kind: 'debuff' },
  prone:          { icon: '🔻', label: 'Prone — easier to hit up close, harder to hit at range, and its own attacks have disadvantage', kind: 'debuff' },
  slowed:         { icon: '🐌', label: 'Slowed — 10 feet slower until its next turn', kind: 'debuff' },
  sapped:         { icon: '😩', label: 'Sapped — disadvantage on next attack', kind: 'debuff' },
  guided:         { icon: '🎯', label: 'Marked — next attack against it has advantage', kind: 'debuff' },
  outlined:       { icon: '🔆', label: 'Outlined — easier to hit, can’t hide', kind: 'debuff' },
  // Reckless is a debuff badge on purpose even though the barbarian chose it:
  // what the board needs to show is that this creature is easier to hit, and
  // that is true whichever side of it you are on.
  reckless:       { icon: '💢', label: 'Reckless — hits harder, and is easier to hit', kind: 'debuff' },
  /*
   * VEX SITS ON THE ATTACKER, AND IT IS A BUFF.
   *
   * `rules/attack.ts` looks for a `vexed` whose `sourceId` is the creature
   * being attacked and grants ADVANTAGE to whoever holds it; `ai/evaluate.ts`
   * prices it at +0.04, under its "buffs" heading, beside `inspired`. This
   * entry said the opposite — "the next attack against it has advantage",
   * filed as a debuff — so a fighter who had just landed a vex hit wore a red
   * badge saying they were easier to kill, and the badge sorted ahead of
   * things that were actually happening to them.
   *
   * Called "Vex" rather than "Vexed" for the same reason: the past participle
   * reads as something done TO the wearer, which is exactly backwards.
   */
  vexed:          { icon: '🗡️', label: 'Vex — advantage on its next attack against the foe it just hit', kind: 'buff' },
  blessed:        { icon: '✨', label: 'Blessed — +1d4 on its attack rolls and saving throws', kind: 'buff' },
  inspiring:      { icon: '🎵', label: 'Bardic Inspiration — +1d6 on the next attack or save', kind: 'buff' },
  shillelagh:     { icon: '🌳', label: 'Shillelagh — the staff strikes on Wisdom, at a bigger die', kind: 'buff' },
  sanctuary:      { icon: '⛪', label: 'Sanctuary — attackers must save to target it', kind: 'buff' },
  protected:      { icon: '✝️', label: 'Protected — undead and fiends attack it at disadvantage', kind: 'buff' },
  bonded:         { icon: '🔗', label: 'Warding Bond — +1 AC and saves; the cleric takes half its damage', kind: 'buff' },
  energyWarded:   { icon: '🔥', label: 'Warded against one element — resistance to that damage', kind: 'buff' },
  cursed:         { icon: '☠️', label: 'Cursed — disadvantage on attacks and saves', kind: 'debuff' },
  baned:          { icon: '💀', label: 'Baned — -1d4 to attacks and saves', kind: 'debuff' },
  wounded:        { icon: '🩸', label: 'Wounded — cannot regain hit points', kind: 'debuff' },
  warded:         { icon: '🔰', label: 'Warded — +2 AC', kind: 'buff' },
  smiting:        { icon: '⚡', label: 'Smite ready — the next melee hit unleashes it', kind: 'buff' },
  burning:        { icon: '🔥', label: 'Burning — 1d6 fire each turn until it saves', kind: 'debuff' },
  hasted:         { icon: '🐇', label: 'Hasted — double speed, +2 AC, an extra attack', kind: 'buff' },
  raging:         { icon: '😤', label: 'Raging — bonus melee damage, and half damage from blades, arrows and clubs', kind: 'buff' },
  veiled:         { icon: '🫥', label: 'Invisible — can’t be targeted, and attacking doesn’t reveal it', kind: 'buff' },
  deathWarded:    { icon: '🕯️', label: 'Death Ward — the next blow that would drop it leaves it at 1 HP', kind: 'buff' },
  unbound:        { icon: '🌀', label: 'Freedom of Movement — webs, vines and paralysis can’t hold it', kind: 'buff' },
  innateSorcery:  { icon: '✨', label: 'Innate Sorcery — advantage on spell attacks, and +1 to its spell save DC', kind: 'buff' },
  silenced:       { icon: '🔇', label: 'Silenced — can’t cast anything with a spoken word', kind: 'debuff' },
  marked:         { icon: '🏹', label: 'Hunter’s Mark — takes extra damage from the hunter', kind: 'debuff' },
  hexed:          { icon: '👁️‍🗨️', label: 'Hexed — takes extra necrotic damage from the warlock', kind: 'debuff' },
  inspired:       { icon: '⭐', label: 'Inspired — advantage on next attack', kind: 'buff' },
  aiming:         { icon: '🎯', label: 'Steady Aim — advantage on next attack, speed 0', kind: 'buff' },
  confused:       { icon: '😵‍💫', label: 'Confused — may waste its turn, or strike whoever is nearest', kind: 'control', tint: 'fear' },
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

/**
 * What the token shows: the worst condition, and how many others there are.
 *
 * THE TOKEN USED TO SHOW UP TO FOUR STACKED BADGES.
 *
 * Measured on a 390px phone, where a token is 46x46: four badges came to
 * 14x59px — TALLER than the creature they belong to. They covered 29% of it,
 * they were the only `pointer-events: auto` thing in a layer that is otherwise
 * transparent to taps, and the fourth one's centre landed on a NEIGHBOURING
 * SQUARE. Nothing clipped it; both the slot and the token are `overflow:
 * visible`.
 *
 * So a webbed, prone, poisoned enemy — exactly the one worth attacking — was
 * the hardest one to attack, and missing meant a glossary card instead of a
 * swing.
 *
 * One chip is 14x14. The count keeps the information that something else is
 * going on; the chooser that opens when you tap the creature spells it out.
 */
export function conditionChip(ids: ConditionId[]): { meta: ConditionMeta; extra: number } | undefined {
  const all = conditionBadges(ids);
  const worst = all[0];
  return worst ? { meta: worst, extra: all.length - 1 } : undefined;
}

/**
 * Why this creature's turn has nothing in it, if that is the case.
 *
 * A paralyzed hero's turn used to arrive as an EMPTY ACTION BAR: every category
 * filtered to zero entries, the board offered no blue tiles and no red rings,
 * and nothing anywhere said why. The player is left looking at their own turn
 * wondering what they are supposed to tap.
 *
 * The caller decides WHETHER the turn is dead — by asking whether the engine
 * offered anything — and this only answers WHICH condition to blame. Deriving
 * "can they act" from the condition list here would be a second implementation
 * of a rule the engine already owns, free to disagree with it.
 *
 * The first match in `BLOCKING` wins, so a creature caught by two things names
 * the one that matters most.
 */
const BLOCKING: readonly ConditionId[] = [
  // Ordered by what a player most needs told. A creature that is both
  // paralyzed and restrained should hear about the paralysis.
  'unconscious', 'paralyzed', 'stunned', 'incapacitated',
  'commanded', 'confused', 'lured', 'fleeing', 'restrained',
];

/*
 * `restrained` earns its place at the bottom even though it never empties a
 * turn by itself — measured: a restrained level-5 hero still has four attacks.
 * It is the right words for the creature that is pinned AND has nothing in
 * reach, where "speed 0" is exactly what the player needs to hear.
 */

export function blockedReason(ids: ConditionId[]): ConditionMeta | undefined {
  const held = new Set(ids);
  const id = BLOCKING.find((k) => held.has(k));
  return id ? CONDITION_META[id] : undefined;
}
