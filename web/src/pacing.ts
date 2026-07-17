/**
 * Turn pacing and narration: how long the board holds still after an action,
 * and the one-line, plain-language account of what happened.
 *
 * Deliberately free of browser APIs (no audio, no DOM) — these are pure
 * functions of engine events, so they can be unit-tested in Node like any other
 * rule. effects.ts, which reaches for AudioContext at import, cannot be.
 */
import type { GameState, Id } from '../../src/engine/types.js';
import type { GameEvent } from '../../src/engine/events.js';

/**
 * How long to hold the board still *after* an action, so its result can be read.
 *
 * The beat belongs to the event, not the action. The old pacing waited *before*
 * each action, sized by the action about to happen — so it bought anticipation
 * of a swing and no dwell on its result. Worse, the pause after an attack was
 * whatever the *next* action asked for, and that is almost always endTurn, the
 * shortest delay in the system. The moment of impact got the least screen time
 * of anything, while the damage number was still floating as the next unit
 * started moving.
 *
 * So: only things that actually happen to a character earn a beat. Movement
 * gets just its slide, and turn hand-offs stay snappy — otherwise a four-enemy
 * round becomes a screensaver.
 */
export function beatFor(events: GameEvent[]): number {
  let beat = 0;
  const hold = (ms: number) => { if (ms > beat) beat = ms; };
  for (const e of events) {
    switch (e.type) {
      case 'died': hold(950); break;
      case 'downed': hold(950); break;
      case 'revived': hold(800); break;
      case 'damageDealt': hold(700); break;
      case 'healed': hold(650); break;
      case 'savingThrow': hold(550); break;
      case 'conditionApplied': hold(550); break;
      case 'hideCheck': case 'hiddenRevealed': hold(500); break;
      // A miss needs its own beat — nothing else marks it. A hit doesn't: its
      // damageDealt lands in the same batch and holds longer.
      case 'attackRolled': hold(e.hit ? 300 : 550); break;
      // Matches the token's path animation (85ms/cell, capped) — the slide is
      // the beat; adding to it just makes walking feel like wading.
      case 'moved': hold(Math.min(650, 85 * (e.path.length - 1)) + 60); break;
      default: hold(120);
    }
  }
  return beat;
}

/**
 * One short, plain-language line for the narration bar — "Grix hits Sir Arthur
 * for 6!" A float is easy to miss: it renders over a token the player may not
 * be watching and is legible for well under a second. A sentence in a fixed
 * place needs no spatial attention and can simply be read, which is the whole
 * point for younger players.
 *
 * Deliberately not the combat log's line: the log is a Roll20-style audit trail
 * ("d20(14)+4 = 18 vs AC 16 — hit") and is doing a different job.
 */
export function narrate(state: GameState, events: GameEvent[]): string | undefined {
  const name = (id: Id) => state.combatants[id]?.name ?? id;
  let line: string | undefined;
  let attack: { attacker: Id; target: Id } | undefined;

  for (const e of events) {
    switch (e.type) {
      case 'attackRolled':
        attack = { attacker: e.attackerId, target: e.targetId };
        if (!e.hit) line = `${name(e.attackerId)} misses ${name(e.targetId)}.`;
        break;
      case 'damageDealt': {
        const tag = e.tags?.includes('Critical Hit') ? 'CRITS' : 'hits';
        const extra = e.tags?.includes('Sneak Attack') ? ' Sneak Attack!' : '';
        line = attack && attack.target === e.targetId
          ? `${name(attack.attacker)} ${tag} ${name(e.targetId)} for ${e.amount}!${extra}`
          : `${name(e.targetId)} takes ${e.amount} ${e.damageType}.`;
        break;
      }
      case 'healed':
        line = `${name(e.sourceId)} heals ${name(e.targetId)} for ${e.amount}.`;
        break;
      case 'savingThrow':
        if (!line) line = e.success ? `${name(e.combatantId)} resists!` : `${name(e.combatantId)} fails the save!`;
        break;
      case 'conditionApplied':
        line = `${name(e.combatantId)} is ${e.condition}!`;
        break;
      // Last word, whatever else happened: someone going down is the headline.
      case 'died':
        return `☠ ${name(e.combatantId)} is slain!`;
      case 'downed':
        return `💤 ${name(e.combatantId)} is down — heal them to get them up!`;
      case 'revived':
        return `✨ ${name(e.combatantId)} is back on their feet!`;
      default:
        break;
    }
  }
  return line;
}
