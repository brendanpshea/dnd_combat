/**
 * Combat log lines with enough structure to style.
 *
 * The log is a wall of identical grey text: every line the same weight, the
 * same colour, the turns and rounds no easier to find than a movement step. The
 * fix isn't a bigger font, it's letting the eye skip — round and turn headers
 * become anchors, and outcomes carry their meaning in colour, so "miss" and
 * "12 damage" don't have to be *read* to be told apart.
 *
 * Kept as (text, kind, team) rather than rich markup: the strings still come
 * from the one renderer the CLI uses, so the two can't drift.
 */
import type { GameState, TeamId } from '../../src/engine/types.js';
import type { GameEvent } from '../../src/engine/events.js';
import { renderEvent } from '../../src/ui/cli/renderer.js';

export interface LogLine {
  text: string;
  /** Styling hook — what kind of thing happened. */
  kind: string;
  /** Whose line it is, for the team colour. */
  team?: TeamId;
}

/** What sort of event this is, for colour and weight. */
function kindOf(e: GameEvent): string {
  switch (e.type) {
    case 'roundStarted': return 'round';
    case 'turnStarted': return 'turn';
    case 'died': return 'died';
    case 'charmedAway': return 'downed';   // a removal, not a kill — same visual weight as downed
    case 'turnedUndead': return 'cond';
    case 'downed': return 'downed';
    case 'revived':
    case 'healed': return 'heal';
    case 'damageDealt': return e.tags?.includes('Critical Hit') ? 'dmg crit' : 'dmg';
    case 'attackRolled': return e.hit ? 'hit' : 'miss';
    case 'savingThrow': return e.success ? 'saved' : 'failed';
    case 'conditionApplied':
    case 'conditionRemoved':
    case 'concentrationBroken': return 'cond';
    case 'moved': return 'move';
    default: return 'misc';
  }
}

/** The combatant a line is about, so it can be tinted by side. */
function subjectOf(e: GameEvent): string | undefined {
  switch (e.type) {
    case 'turnStarted':
    case 'moved':
    case 'died':
    case 'charmedAway':
    case 'downed':
    case 'revived':
    case 'dashed':
    case 'disengaged':
    case 'dodging':
    case 'conditionApplied':
    case 'conditionRemoved':
    case 'concentrationBroken':
    case 'hideCheck': return e.combatantId;
    case 'attackRolled': return e.attackerId;
    case 'savingThrow': return e.combatantId;
    case 'damageDealt':
    case 'healed': return e.targetId;
    case 'illusionCast': return e.sourceId;
    default: return undefined;
  }
}

export function logLinesFor(state: GameState, events: GameEvent[]): LogLine[] {
  const out: LogLine[] = [];
  for (const e of events) {
    // Team tags off: names are unique now (rivals and monsters each get their
    // own), so "(T1)" was just noise the colour already carries.
    const text = renderEvent(state, e, { tagTeams: false });
    if (!text) continue;
    const team = subjectOf(e) ? state.combatants[subjectOf(e)!]?.team : undefined;
    out.push({ text: text.trim(), kind: kindOf(e), ...(team ? { team } : {}) });
  }
  return out;
}
