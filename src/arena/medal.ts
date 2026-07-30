/**
 * How an arena run ends, and what it was worth.
 *
 * Until now a run had no finish line. It ended when the player got bored or
 * went broke, which meant there was nothing to be good *at* — only a number to
 * push. A roguelike needs a terminus, and the terminus needs a grade, or the
 * player who solved every day cleanly and the player who ground the same
 * morning fight forty times walk away with the same nothing.
 *
 * THE FINISH LINE IS THE XP FOR LEVEL 8.
 *
 * Classes are implemented to level 7, so this is the threshold immediately past
 * the top of the content: the run ends exactly where the game runs out of
 * things to give you, and no eighth tier of features has to exist for it to
 * work. It is deliberately a long way — the day model lets a stuck party grind
 * mornings for experience, and a finish line you can stroll to would make that
 * escape valve the whole game.
 *
 * THE GRADE IS WIN RATE.
 *
 * Because that is the axis the day model actually creates a choice along. A
 * frozen day can be out-thought or out-levelled, and both are legitimate — but
 * they should not read the same at the end. Days taken is reported alongside as
 * the par number: it is unbounded under grinding, while win rate falls the more
 * you lean on it, so the two together say plainly which way a run was played.
 */
import { LEVEL_XP } from '../campaign/campaign.js';

/**
 * Experience that ends a run: one rung past the last level the classes reach.
 *
 * This was 34,000 — the level-8 threshold — while the classes stopped at 7. Now
 * that level 8 is implemented, 34,000 is a level the party actually reaches,
 * and leaving the finish line there would mean hitting level 8 and having the
 * run end in the same instant. The eighth level would exist and never be
 * played, which is the opposite of the reason it was added.
 *
 * So it moves to 5e's next rung — and then again, to 64,000, when level 9 made
 * 48,000 a level the party reaches. The same argument each time: the finish
 * line has to sit past the top of the ladder or the top rung is never played,
 * and level 9 is the 5th-level spell tier, which is the most worth playing.
 *
 * THIS LENGTHENS EVERY RUN, and the cost is real rather than notional — a run
 * now has to earn a third again as much experience inside the same 120 days.
 * The arena measurement in the change that raised it is the honest number, not
 * this comment.
 *
 * Deliberately not read from `LEVEL_XP`: this is the finish line, and it means
 * "past the end of the ladder" rather than "the next entry in it". The
 * assertion below is what keeps the two facts consistent — it is the reason
 * extending `LEVEL_XP` could not silently leave this behind.
 */
export const RUN_TARGET_XP = 64_000;

if (RUN_TARGET_XP <= (LEVEL_XP[LEVEL_XP.length - 1] ?? 0)) {
  throw new Error('the arena finish line must sit beyond the last implemented level');
}

export type MedalTier = 'gold' | 'silver' | 'bronze' | 'iron';

export interface RunSummary {
  /** Did the party reach the finish line, or did the run end some other way? */
  completed: boolean;
  /** Only set on a completed run: nothing is awarded for not finishing. */
  medal?: MedalTier;
  xp: number;
  days: number;
  fights: number;
  wins: number;
  /** Win rate as a percentage, 0–100. */
  winRate: number;
  clearedFirstTry: number;
}

/**
 * Win-rate cuts for each medal.
 *
 * Set from measurement rather than from taste. Across 30 simulated runs played
 * by a player who retries a lost day up to forty times — the grindiest way to
 * finish, and so the *floor* on win rate — the runs that reached the finish
 * line landed between 42% and 70%, median 57%.
 *
 * So the cuts sit at 75 / 65 / 55. Bronze is the median finisher, silver is the
 * top of the grinding range, and gold is deliberately above anything grinding
 * can produce: the only way to it is to actually solve days rather than
 * out-level them, which is the distinction the medal exists to draw.
 */
const CUTS: Array<[MedalTier, number]> = [
  ['gold', 75],
  ['silver', 65],
  ['bronze', 55],
];

export function medalFor(winRate: number): MedalTier {
  for (const [tier, cut] of CUTS) if (winRate >= cut) return tier;
  return 'iron';
}

export const MEDAL_LABEL: Record<MedalTier, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  iron: 'Iron',
};

export const MEDAL_ICON: Record<MedalTier, string> = {
  gold: '🥇', silver: '🥈', bronze: '🥉', iron: '🎖️',
};

/** Has this run reached the finish line? */
export function runComplete(xp: number): boolean {
  return xp >= RUN_TARGET_XP;
}

/**
 * Grade a run, finished or not.
 *
 * An unfinished run still gets a summary — the arena always ends on this
 * screen, whether the party walked out in triumph or could not pay the
 * healers. It simply gets no medal, because it did not finish.
 */
export function summarise(
  run: { fights: number; wins: number; cleared: number; clearedFirstTry: number; day?: number },
  xp: number,
): RunSummary {
  const winRate = run.fights === 0 ? 0 : Math.round((run.wins / run.fights) * 100);
  const completed = runComplete(xp);
  return {
    completed,
    ...(completed ? { medal: medalFor(winRate) } : {}),
    xp,
    days: Math.max(0, (run.day ?? 1) - 1),
    fights: run.fights,
    wins: run.wins,
    winRate,
    clearedFirstTry: run.clearedFirstTry,
  };
}
