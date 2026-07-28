/**
 * One presentation for every visible skill check in the arena.
 *
 * Three moments, and each answers a different question:
 *
 *   before   who would roll this, with what, against what — printed on the
 *            button, so the decision is made with the numbers in view rather
 *            than after them. It is also the only thing in the arena that makes
 *            a party's skills legible at all.
 *   during   the dice ritual: d20, the bonus broken into chips, a DC bar, a
 *            stamp. `DiceCheck` has done this for adventure scenes since the
 *            beginning; its own header note says "the shop tomorrow", and
 *            tomorrow took a while.
 *   after    whatever was learned, left on screen. A result you dismiss is no
 *            use to a choice you make afterwards.
 *
 * The first is the part games usually skip, and the part a player who knows the
 * rules most wants: "Yelena +5 vs DC 13" tells them their odds, that Arcana is
 * Intelligence, and who their thinker is, without a word of tutorial.
 */
import { useState } from 'react';
import type { SkillRoll, GroupCheckResult, CampaignState } from '../../src/campaign/campaign.js';
import { characterSkillBonus, characterSkillProficient, bestAtSkill, skillDisadvantage } from '../../src/campaign/campaign.js';
import { SKILL_LABEL, SKILL_ABILITY, type SkillId } from '../../src/data/classes.js';
import { DiceCheck } from './DiceCheck.js';
import { GroupCheck } from './GroupCheck.js';
import { checkOdds, groupOdds, groupPassChance, groupThreshold } from './odds.js';

const ABILITY_LABEL: Record<string, string> = {
  str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha',
};

export interface SkillGambitProps {
  campaign: CampaignState;
  skill: SkillId;
  dc: number;
  /** Overrides the skill's own name — "Persuade" rather than "Persuasion". */
  label?: string;
  /** A word on what it buys, or what it risks. */
  note?: string;
  disabled?: boolean;
  disabledReason?: string;
  /**
   * A 5e GROUP check: everyone rolls and half must pass.
   *
   * Worth its own mode rather than a note, because every number on the button
   * changes. The arena's creep-in was a group check being sold with the single
   * best hero's bonus — "Cedric +6 vs 14" for a roll all four make — so the
   * line described a different check from the one happening, took no account of
   * the two paladins in plate who are the actual reason the party gets heard,
   * and did not move when the party's armour did. The note underneath said
   * "half the party must pass", and players read the number, not the note.
   */
  group?: boolean;
  /**
   * Roll it. Returns the roll to show; the caller has already applied it.
   * Required unless this is a group check, which rolls through `onRollGroup`.
   */
  onRoll?(): SkillRoll;
  /** Group mode: the whole party's rolls, for the same reason. */
  onRollGroup?(): GroupCheckResult;
  /** Called once the player has watched the dice land. */
  onResolved?(roll: SkillRoll): void;
}

export function SkillGambit({
  campaign, skill, dc, label, note, disabled, disabledReason, group,
  onRoll, onRollGroup, onResolved,
}: SkillGambitProps) {
  const [showing, setShowing] = useState<SkillRoll | null>(null);
  const [showingGroup, setShowingGroup] = useState<GroupCheckResult | null>(null);

  const { idx } = bestAtSkill(campaign, skill);
  const hero = campaign.characters[idx];
  const bonus = characterSkillBonus(campaign, idx, skill);
  const proficient = characterSkillProficient(campaign, idx, skill);
  // Bonus AND armour: a paladin in plate rolls Stealth at disadvantage, which
  // costs the party far more than their flat +0 suggests and is invisible in a
  // bonus. This is the number the old button could not have shown.
  const rollers = campaign.characters.map((_, i) => ({
    bonus: characterSkillBonus(campaign, i, skill),
    disadvantage: skillDisadvantage(campaign, i, skill),
  }));
  const need = groupThreshold(rollers.length);
  const chance = Math.round(groupPassChance(rollers, dc) * 100);
  const odds = group ? groupOdds(rollers, dc) : checkOdds(bonus, dc);

  // Everything that is not a number goes in the tooltip. The check has to be
  // legible without being loud: a rules-literate player wants the odds, and
  // everyone else wants the screen back. An earlier cut gave each one a
  // portrait, a title, a maths line and a row of chips — four lines of
  // furniture for one d20, repeated up to four times across the gate screen.
  const why = [
    SKILL_LABEL[skill],
    ABILITY_LABEL[SKILL_ABILITY[skill]],
    // In group mode the tooltip is where every hero's number lives: the button
    // has room for the party's odds or for four names, not both, and the odds
    // are the thing the decision is made on.
    group
      ? campaign.characters
          .map((ch, i) => `${ch.name} ${fmt(rollers[i]?.bonus ?? 0)}${rollers[i]?.disadvantage ? ' (armour)' : ''}`)
          .join(' · ')
      : proficient ? 'proficient' : null,
    odds === 'certain' ? 'cannot fail' : odds === 'impossible' ? 'cannot succeed' : null,
    note,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <button
        className={`skill-gambit${disabled ? ' spent' : ''} odds-${odds}`}
        disabled={disabled}
        title={disabled ? disabledReason : why}
      onClick={() => {
          if (group && onRollGroup) setShowingGroup(onRollGroup());
          else if (onRoll) setShowing(onRoll());
        }}
      >
        <span className="sg-title">{label ?? SKILL_LABEL[skill]}</span>
        <span className="sg-math">
          {group ? (
            <>the party · <b>{need} of {rollers.length}</b> vs {dc} · {chance}%</>
          ) : (
            <>{hero?.name ?? '—'} <b>{fmt(bonus)}</b> vs {dc}</>
          )}
        </span>
      </button>

      {showing && (
        <div className="adv-dice-scrim">
          <DiceCheck
            roll={showing}
            rollerName={campaign.characters[showing.by]?.name ?? 'Someone'}
            onDone={() => { const r = showing; setShowing(null); onResolved?.(r); }}
          />
        </div>
      )}

      {showingGroup && (
        <div className="adv-dice-scrim">
          <GroupCheck
            result={showingGroup}
            campaign={campaign}
            skill={skill}
            dc={dc}
            onDone={() => {
              const g = showingGroup;
              setShowingGroup(null);
              // Hand back the roll the caller stored, so nothing downstream has
              // to learn about group checks to keep working.
              const shown = g.success
                ? g.rolls.reduce((a, b) => (b.total > a.total ? b : a))
                : g.rolls.reduce((a, b) => (b.total < a.total ? b : a));
              onResolved?.(shown);
            }}
          />
        </div>
      )}
    </>
  );
}

const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
