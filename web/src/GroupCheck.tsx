import { useEffect, useState } from 'react';
import type { GroupCheckResult, CampaignState } from '../../src/campaign/campaign.js';
import { SKILL_LABEL, type SkillId } from '../../src/data/classes.js';
import { groupThreshold } from './odds.js';
import { sfx, haptic } from './sound.js';

/**
 * Four dice, not one.
 *
 * `DiceCheck` shows a single d20 with a single roller's name, which is right
 * for a check one hero makes. The arena's creep-in is a 5e group check — every
 * hero rolls, half must pass — and it was being shown through `DiceCheck`
 * anyway, with the best roll on a success and the worst on a failure.
 *
 * That misattributes the outcome, and specifically misattributes BLAME. A group
 * check fails because fewer than half got through; naming the single worst
 * roller tells the player that one hero blew it, when the cause is distributed
 * and the fix is usually somebody else's armour. Showing all four rolls and the
 * count is the whole correction: "2 of 4 got through" is the result, and the
 * row of names is why.
 *
 * No tumbling animation. Four dice rolling in sequence is four times the wait
 * for a screen the player will see before every fight, and the thing worth
 * dwelling on here is the tally, not the theatre — which is `DiceCheck`'s job
 * on the one-hero checks that earn it.
 */
export function GroupCheck({
  result, campaign, skill, dc, onDone,
}: {
  result: GroupCheckResult;
  campaign: CampaignState;
  skill: SkillId;
  dc: number;
  onDone(): void;
}) {
  const [landed, setLanded] = useState(false);
  const passed = result.rolls.filter((r) => r.success).length;
  const need = groupThreshold(result.rolls.length);

  useEffect(() => {
    sfx('dice');
    const t = setTimeout(() => setLanded(true), 380);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!landed) return;
    sfx(result.success ? 'check-pass' : 'check-fail');
    haptic(result.success ? 14 : [20, 40, 20]);
  }, [landed, result.success]);

  return (
    <div className="dicecheck groupcheck" onClick={landed ? onDone : () => setLanded(true)}>
      <div className="dc-roller">The whole party · {SKILL_LABEL[skill]}</div>

      <div className="gc-rolls">
        {result.rolls.map((r, i) => (
          <div key={i} className={`gc-row${landed ? (r.success ? ' ok' : ' fail') : ''}`}>
            <span className="gc-name">{campaign.characters[r.by]?.name ?? `Hero ${i + 1}`}</span>
            <span className="gc-die">{landed ? r.natural : '·'}</span>
            <span className="gc-total">{landed ? r.total : '—'}</span>
            <span className="gc-mark">{landed ? (r.success ? '✓' : '✗') : ''}</span>
          </div>
        ))}
      </div>

      {landed && (
        <>
          {/* The tally IS the result. It is stated before the stamp because it
              is the part a player can act on: two of four means the two who
              failed are the ones to re-equip. */}
          <div className="gc-tally">
            <b>{passed} of {result.rolls.length}</b> got through · needed {need} · DC {dc}
          </div>
          <div className={`dc-stamp ${result.success ? 'ok' : 'fail'}`}>
            {result.success ? 'SUCCESS' : 'FAILURE'}
          </div>
        </>
      )}

      <div className="dc-hint">{landed ? 'Tap to continue' : 'Tap to skip'}</div>
    </div>
  );
}
