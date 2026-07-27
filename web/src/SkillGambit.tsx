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
import type { SkillRoll, CampaignState } from '../../src/campaign/campaign.js';
import { characterSkillBonus, characterSkillProficient, bestAtSkill } from '../../src/campaign/campaign.js';
import { SKILL_LABEL, SKILL_ABILITY, type SkillId } from '../../src/data/classes.js';
import { DiceCheck } from './DiceCheck.js';
import { Portrait } from './Portrait.js';
import { checkOdds } from './odds.js';

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
  /** Roll it. Returns the roll to show; the caller has already applied it. */
  onRoll(): SkillRoll;
  /** Called once the player has watched the dice land. */
  onResolved?(roll: SkillRoll): void;
}

export function SkillGambit({
  campaign, skill, dc, label, note, disabled, disabledReason, onRoll, onResolved,
}: SkillGambitProps) {
  const [showing, setShowing] = useState<SkillRoll | null>(null);

  const { idx } = bestAtSkill(campaign, skill);
  const hero = campaign.characters[idx];
  const bonus = characterSkillBonus(campaign, idx, skill);
  const proficient = characterSkillProficient(campaign, idx, skill);
  const odds = checkOdds(bonus, dc);

  return (
    <>
      <button
        className={`skill-gambit${disabled ? ' spent' : ''} odds-${odds}`}
        disabled={disabled}
        title={disabled ? disabledReason : `${SKILL_LABEL[skill]} · ${ABILITY_LABEL[SKILL_ABILITY[skill]]}`}
        onClick={() => {
          const roll = onRoll();
          setShowing(roll);
        }}
      >
        <span className="sg-head">
          {hero && <Portrait id={hero.portraitId ?? hero.classId} team="team1" />}
          <span className="sg-title">{label ?? SKILL_LABEL[skill]}</span>
        </span>
        <span className="sg-math">
          {hero?.name ?? '—'}
          {' '}<b>{bonus >= 0 ? '+' : ''}{bonus}</b>
          {' vs DC '}{dc}
        </span>
        <span className="sg-sub">
          {proficient && <i className="sg-prof">proficient</i>}
          <i>{ABILITY_LABEL[SKILL_ABILITY[skill]]}</i>
          {/* The honest bit: when the dice cannot change the answer, say so. */}
          {odds === 'certain' && <i className="sg-sure">cannot fail</i>}
          {odds === 'impossible' && <i className="sg-hopeless">cannot succeed</i>}
          {note && <i>{note}</i>}
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
    </>
  );
}
