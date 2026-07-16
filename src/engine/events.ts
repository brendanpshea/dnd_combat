/**
 * Everything observable is a GameEvent. The CLI renders these as English;
 * they are also the combat log and the replay narration.
 */
import type { Id, TeamId, Position, DamageType, ConditionId, Ability } from './types.js';
import type { RollMode } from './dice.js';

export type GameEvent =
  | { type: 'combatStarted'; order: Array<{ id: Id; initiative: number }> }
  | { type: 'roundStarted'; round: number }
  | { type: 'turnStarted'; combatantId: Id; round: number }
  | { type: 'turnEnded'; combatantId: Id }
  | { type: 'moved'; combatantId: Id; path: Position[] }
  | {
      type: 'attackRolled';
      attackerId: Id; targetId: Id; weaponId: Id;
      natural: number; total: number; targetAc: number;
      mode: RollMode; advSources: string[]; disSources: string[];
      hit: boolean; crit: boolean;
      opportunity: boolean;
    }
  | {
      type: 'damageDealt';
      targetId: Id; sourceId: Id; amount: number; damageType: DamageType;
      rolls: number[];
      /** Named contributors (e.g. 'Sneak Attack', 'Dueling') for the log/toasts. */
      tags?: string[];
    }
  | { type: 'healed'; targetId: Id; sourceId: Id; amount: number }
  | {
      type: 'savingThrow';
      combatantId: Id; ability: Ability; dc: number;
      natural: number; total: number; success: boolean;
    }
  | { type: 'hideCheck'; combatantId: Id; natural: number; total: number; success: boolean }
  | { type: 'hiddenRevealed'; combatantId: Id; observerId: Id; passivePerception: number; hideCheck: number }
  | { type: 'conditionApplied'; combatantId: Id; condition: ConditionId; sourceId?: Id }
  | { type: 'conditionRemoved'; combatantId: Id; condition: ConditionId }
  | { type: 'concentrationBroken'; combatantId: Id; spellId: Id }
  | { type: 'equipped'; combatantId: Id; weaponId: Id }
  | { type: 'itemUsed'; combatantId: Id; itemId: Id; targetId?: Id }
  | { type: 'dashed'; combatantId: Id }
  | { type: 'disengaged'; combatantId: Id }
  | { type: 'dodging'; combatantId: Id }
  | { type: 'died'; combatantId: Id }
  | { type: 'combatEnded'; winner: TeamId };
