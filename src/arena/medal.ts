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
 * Experience that ends a run: the level-8 threshold, one step past the level-7
 * ceiling the classes are built to.
 *
 * Not read from `LEVEL_XP` — that table stops at level 7 by design, and adding
 * an eighth entry to it would tell the whole campaign that level 8 exists.
 * This is 5e's own next rung, kept here where it means "the finish line" and
 * nowhere else. The assertion below is what keeps the two facts consistent.
 */
export const RUN_TARGET_XP = 34_000;

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
