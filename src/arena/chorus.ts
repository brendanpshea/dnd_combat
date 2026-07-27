/**
 * The quasit in the rafters: the arena's one recurring voice.
 *
 * The arena has always been a pile of good mechanics with no reason to exist.
 * You fight two fights, you lose, you come back tomorrow to the same two
 * fights, the dead get up again and somebody charges you for it — every one of
 * those is a deliberate design decision and not one of them is explained.
 *
 * The framing costs nothing and answers all of them at once. You are dead. This
 * is a proving ground, the powers that be are watching, and the whole point is
 * to show them what you are worth. Of course you fight the same day twice. Of
 * course losing only means tomorrow. Of course the healers want paying.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT
 *
 * It is a teacher wearing a costume. Every line below is pinned to a moment the
 * game already detects, and the ones that matter say something true about the
 * rules: that the afternoon is the same fight against a tireder party, that
 * hit dice are the day's only healing, that a day you keep losing can be
 * out-levelled instead. A player who learns the day model from a bored demon
 * has learned it better than one who read a tooltip, and much better than one
 * who lost four times working it out.
 *
 * It is NOT ambient chatter. Every line fires at most once per run, on the
 * first occasion of the thing it is about, and there is a hard cap of one per
 * day. The tenth run must not have to sit through the first run's jokes, so
 * `heard` rides along in the run state and the whole thing can be switched off.
 */
import type { Id } from '../engine/types.js';

/**
 * Occasions the quasit has something to say about. Every one of these is a
 * state the arena already computes — nothing is tracked for the voice's sake.
 */
export type ChorusCue =
  | 'arrival'          // the very first gate of a run
  | 'firstGate'        // the first time a door is actually chosen
  | 'firstAfternoon'   // walking into the second fight of a day
  | 'firstLunch'       // the first short rest between fights
  | 'firstHitDice'     // the first time lunch spends dice to raise the fallen
  | 'noHitDice'        // a lunch with nothing left to spend
  | 'firstDefeat'      // the first day lost — and the free revival
  | 'firstBill'        // the first defeat that actually costs money
  | 'soldToPay'        // something had to be sold to cover it
  | 'nearlyBroke'      // the bill took most of what was left
  | 'firstClear'       // the first day cleared outright
  | 'levelled'         // the party gained a level mid-run
  | 'grinding'         // the same day lost three times over
  | 'homeStretch'      // most of the way to the finish line
  | 'finished'         // the run completed
  | 'brokeOff';        // the run ended unpaid

export interface ChorusLine {
  cue: ChorusCue;
  text: string;
}

/**
 * What the quasit says, and when.
 *
 * Written to be readable in any order, because a player will meet these in
 * whatever order their run happens to produce — nothing here refers back to a
 * line that may never have fired.
 */
export const CHORUS: Record<ChorusCue, string> = {
  arrival:
    'Oh good, another one. Listen — you are dead, this is where they decide ' +
    'what you were worth, and I have to watch. Two fights a day. Try to be ' +
    'interesting about it.',

  firstGate:
    'Three doors, and they tell you what is behind them. That is not mercy, ' +
    'that is the wager. Pick the nasty one and they pay you more for it.',

  firstAfternoon:
    'Same fight as this morning. Exactly the same. The difference is you — ' +
    'half your spells gone and a hole in your side. That is the whole trick ' +
    'of this place, and you just walked into it.',

  firstLunch:
    'Eat something. Bind what is bleeding. Whatever you do not fix now, you ' +
    'carry into the afternoon, and the afternoon does not care.',

  firstHitDice:
    'That one you scraped off the sand? Costs you. Somebody spends part of ' +
    'themselves to get them upright, and there is only so much of that to go ' +
    'around before evening.',

  noHitDice:
    'Nothing left to give each other. You go in tired and you go in thin. ' +
    'I have seen how this ends, and I am not going to spoil it.',

  firstDefeat:
    'Dead again. Do not look so stricken — that is rather the arrangement ' +
    'here. Tomorrow you get the same two fights, exactly as they were. Same ' +
    'monsters, same ground. Whatever you learned today, you keep.',

  firstBill:
    'The healers are not a charity. Putting four corpses back together is ' +
    'work, and work has a price. The first one was on the house. Do enjoy ' +
    'the memory.',

  soldToPay:
    'Short. So they took it out of your pack instead. Everything here can be ' +
    'sold, in the end, including you.',

  nearlyBroke:
    'That is very nearly the last of it. When you cannot pay, they stop ' +
    'putting you back together, and then it is properly over. Do bear that ' +
    'in mind before the next clever plan.',

  firstClear:
    'A whole day. Both fights. Somebody upstairs made a note — I saw the ' +
    'quill move. Do not let it go to your head, it goes up from here.',

  levelled:
    'You are getting harder to kill. That matters more than you think: the ' +
    'day you are stuck on does not grow with you. Beat your head against it ' +
    'long enough and one morning you will simply be too big for it.',

  grinding:
    'Third time on the same day. You could keep doing this, you know — the ' +
    'fight is frozen and you are not. But every failure costs, and they are ' +
    'counting the losses as well as the wins.',

  homeStretch:
    'They have very nearly seen enough of you. Whatever you have been proving, ' +
    'you are close to having proved it.',

  finished:
    'Well. That is that. The gates are open and nobody is moving to stop you, ' +
    'which almost never happens. Go on. I will find someone else to watch.',

  brokeOff:
    'No coin, no healers, no tomorrow. It is not the worst ending I have ' +
    'watched from up here. It is not one of the good ones either.',
};

/** The face and name of the voice — SRD, and already in the bestiary. */
export const CHORUS_SPEAKER = { name: 'The Quasit', portraitId: 'quasit' as Id };

/**
 * Pick the line for a cue, unless it has already been heard.
 *
 * The caller owns `heard` and is expected to persist it, which is what makes
 * "the first time" survive closing the tab. Returns undefined when there is
 * nothing to say — the common case by far, and the one that keeps this from
 * becoming chatter.
 */
export function chorusLine(cue: ChorusCue, heard: readonly string[] = []): string | undefined {
  return heard.includes(cue) ? undefined : CHORUS[cue];
}

/**
 * The first unheard cue from a list, in priority order.
 *
 * Several things can become true at the same moment — a defeat that is also
 * the first bill that also nearly empties the purse — and the quasit gets one
 * of them. Order the list most-interesting-first at the call site.
 */
export function firstUnheard(
  cues: readonly ChorusCue[], heard: readonly string[] = [],
): ChorusCue | undefined {
  return cues.find((cue) => !heard.includes(cue));
}
