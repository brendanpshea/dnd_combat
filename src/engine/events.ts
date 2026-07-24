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
      /** A conjuration swung this, not the caster's own arm — the summon's kind
       *  ('spiritual-weapon'). Everything mechanical still hangs off
       *  `attackerId` (it is the caster's spell attack); this only re-labels who
       *  the log says is swinging, and tells the board which token to flash. */
      via?: string;
    }
  | {
      type: 'damageDealt';
      targetId: Id; sourceId: Id; amount: number; damageType: DamageType;
      rolls: number[];
      /** Named contributors (e.g. 'Sneak Attack', 'Dueling') for the log/toasts. */
      tags?: string[];
      /** Dealt by the caster's summon rather than the caster (see
       *  `attackRolled.via`). The Flaming Sphere has no attack roll, so this is
       *  the only place its ram is attributed. */
      via?: string;
    }
  | { type: 'healed'; targetId: Id; sourceId: Id; amount: number }
  /** A hero hit 0 HP: unconscious, still on the board, revivable. Not death. */
  | { type: 'downed'; combatantId: Id }
  /** Healed off 0 HP and back on their feet. */
  | { type: 'revived'; combatantId: Id; hp: number }
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
  | { type: 'recharged'; combatantId: Id; featureId: Id }
  | { type: 'disengaged'; combatantId: Id }
  | { type: 'dodging'; combatantId: Id }
  | { type: 'died'; combatantId: Id }
  /** Removed from the fight without dying — Animal Friendship charms a beast
   *  off the board. Shares kill()'s bookkeeping but is never a death. */
  | { type: 'charmedAway'; combatantId: Id }
  | { type: 'turnedUndead'; combatantId: Id; dc: number }
  /** A spell goes off: its caster, id, origin, and the cells its effect covers
   *  — purely so a frontend can telegraph the cast and detonate the area before
   *  the per-target results (saves, damage, conditions) land. */
  | { type: 'spellCast'; casterId: Id; spellId: Id; origin: Position; cells: Position[] }
  /** A gnome's Minor Illusion takes shape on a cell. */
  | { type: 'illusionCast'; position: Position; sourceId: Id }
  /** Revealed — walked through, or simply expired. */
  | { type: 'illusionPopped'; position: Position }
  /** A conjured summon (Spiritual Weapon, Flaming Sphere) appears on a cell. */
  /** A smite discharged into a melee hit — its own event so the log can shout
   *  it and the UI can flash. The damage arrives separately as `damageDealt`. */
  | { type: 'smited'; attackerId: Id; targetId: Id; spellId: Id; slotLevel: number; amount: number; crit: boolean }
  | { type: 'summonPlaced'; casterId: Id; kind: string; position: Position }
  /** …glides across the board chasing its prey (start of the caster's turn). */
  | { type: 'summonMoved'; casterId: Id; kind: string; from: Position; to: Position }
  /** …winks out — duration up, or its caster's concentration broke. */
  | { type: 'summonExpired'; casterId: Id; kind: string; position: Position }
  /** A Web's strands take hold across these cells (and linger there). */
  | { type: 'webSpun'; sourceId: Id; cells: Position[] }
  /** The strands clear when the caster's concentration drops. */
  | { type: 'webCleared'; sourceId: Id; cells: Position[] }
  | { type: 'combatEnded'; winner: TeamId };
