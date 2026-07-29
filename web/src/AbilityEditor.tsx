/**
 * The expert ability-score editor: 27 points, and the +2/+1 to place.
 *
 * Deliberately behind a `<details>`. The recommended spread is right for almost
 * everybody, and a beginner meeting six spinners before they have chosen a
 * class is a worse forge. Opening it should feel like turning over the sheet,
 * not like a step you skipped.
 *
 * Two things it shows that the rules do not spell out and a player would
 * otherwise have to know:
 *  - the modifier, in parentheses, because +3 is what the game actually uses
 *    and 16 vs 17 is nothing;
 *  - which ability the class's ability increases will go to, since those are
 *    fixed to the kit and are most of a character's stats by level 8.
 */
import {
  type CampaignState, setPartyStatBuild, clearPartyStatBuild, statBuildOf, statPriorityOf,
} from '../../src/campaign/campaign.js';
import {
  ABILITIES, POINT_BUY_BUDGET, POINT_BUY_MIN, POINT_BUY_MAX,
  pointsSpent, canRaise, canLower, resolveStatBuild,
  type StatBuild,
} from '../../src/builder/stats.js';
import { abilityMod, type Ability } from '../../src/engine/types.js';

const ABILITY_LABEL: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function AbilityEditor(
  { campaign: c, idx, mutate }: {
    campaign: CampaignState;
    idx: number;
    mutate: (fn: () => void) => void;
  },
) {
  const ch = c.characters[idx];
  if (!ch) return null;
  const build = statBuildOf(ch);
  const priority = statPriorityOf(ch);
  const total = resolveStatBuild(build);
  const spent = pointsSpent(build.base);
  const recommended = !ch.statBuild;
  const primary = priority[0]!;

  const set = (next: StatBuild) => mutate(() => { setPartyStatBuild(c, idx, next); });
  const bump = (ab: Ability, by: 1 | -1) =>
    set({ ...build, base: { ...build.base, [ab]: build.base[ab] + by } });
  /** Move a bonus onto `ab`. If the other bonus already sits there, they swap —
   *  otherwise clicking +2 on your +1 ability would be silently refused. */
  const place = (which: 'plus2' | 'plus1', ab: Ability) => {
    const other = which === 'plus2' ? 'plus1' : 'plus2';
    set({ ...build, [which]: ab, ...(build[other] === ab ? { [other]: build[which] } : {}) });
  };

  return (
    <details className="forge-field ability-editor">
      <summary>
        Ability Scores
        <small>{recommended ? 'Recommended' : `Custom · ${spent}/${POINT_BUY_BUDGET} points`}</small>
      </summary>

      <p className="ability-note">
        {POINT_BUY_BUDGET} points buy scores from {POINT_BUY_MIN} to {POINT_BUY_MAX};
        your background adds a +2 and a +1 wherever you like.
        Ability increases as you level go to <b>{ABILITY_LABEL[primary]}</b>.
      </p>

      <table className="ability-table">
        <thead>
          <tr>
            <th scope="col">Ability</th>
            <th scope="col">Buy</th>
            <th scope="col">+2</th>
            <th scope="col">+1</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {ABILITIES.map((ab) => (
            <tr key={ab} className={ab === primary ? 'primary' : undefined}>
              <th scope="row">{ABILITY_LABEL[ab]}</th>
              <td className="buy">
                <button
                  type="button" className="mini" disabled={!canLower(build.base, ab)}
                  aria-label={`Lower ${ABILITY_LABEL[ab]}`}
                  onClick={() => bump(ab, -1)}
                >−</button>
                <span className="bought">{build.base[ab]}</span>
                <button
                  type="button" className="mini" disabled={!canRaise(build.base, ab)}
                  aria-label={`Raise ${ABILITY_LABEL[ab]}`}
                  onClick={() => bump(ab, 1)}
                >+</button>
              </td>
              {(['plus2', 'plus1'] as const).map((which) => (
                <td key={which}>
                  <button
                    type="button"
                    className={build[which] === ab ? 'bonus-chip on' : 'bonus-chip'}
                    role="radio" aria-checked={build[which] === ab}
                    aria-label={`Put the ${which === 'plus2' ? '+2' : '+1'} in ${ABILITY_LABEL[ab]}`}
                    onClick={() => place(which, ab)}
                  >{which === 'plus2' ? '+2' : '+1'}</button>
                </td>
              ))}
              <td className="score">
                <b>{total[ab]}</b> <small>({signed(abilityMod(total[ab]))})</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ability-foot">
        <span className={spent === POINT_BUY_BUDGET ? 'points spent-all' : 'points'}>
          {POINT_BUY_BUDGET - spent} point{POINT_BUY_BUDGET - spent === 1 ? '' : 's'} left
        </span>
        <button
          type="button" className="mini"
          disabled={recommended}
          onClick={() => mutate(() => { clearPartyStatBuild(c, idx); })}
        >Reset to recommended</button>
      </div>
    </details>
  );
}
