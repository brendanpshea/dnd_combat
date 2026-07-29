/**
 * Everything observable is a GameEvent. The CLI renders these as English;
 * they are also the combat log and the replay narration.
 */
import type { Id, TeamId, Position, DamageType, ConditionId, Ability } from './types.js';
import type { RollMode } from './dice.js';

export type GameEvent =
  | { type: 'combatStarted'; order: Array<{ id: Id; initiative: number }> }
  /**
   * Alert's Initiative Swap fired: this character handed its place in the order
   * to an ally who could do more with it. Surfaced so the player can see the feat
   * they chose actually did something, rather than the order quietly differing.
   */
  | { type: 'initiativeSwapped'; combatantId: Id; allyId: Id; from: number; to: number }
  | { type: 'roundStarted'; round: number }
  | { type: 'turnStarted'; combatantId: Id; round: number }
  | { type: 'turnEnded'; combatantId: Id }
  | { type: 'moved'; combatantId: Id; path: Position[] }
  | {
      type: 'attackRolled';
      attackerId: Id; targetId: Id; weaponId: Id;
      natural: number; total: number; targetAc: number;
      mode: RollMode; advSources: string[]; disSources: string[];
      /** "Fated (4 → 17)" when a reroll changed the die — see rules/luck.ts. */
      luck?: string;
      hit: boolean; crit: boolean;
      opportunity: boolean;
      /** A barricade on the line of the shot: `targetAc` already includes the
       *  +2, and this is what lets the log say why. */
      cover?: boolean;
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
  /** A wraith's Life Drain: the victim's hit point *maximum* fell. Lasts until
   *  the next long rest, which here means until the fight is over — combatants
   *  are rebuilt from the campaign roster for each one. */
  | { type: 'maxHpDrained'; combatantId: Id; amount: number; maxHp: number }
  /** Call Lightning: a bolt comes down on these cells. */
  | { type: 'lightningStruck'; casterId: Id; cells: Position[] }
  /** A druid takes a beast's shape (and the temporary hit points with it). */
  | { type: 'wildShaped'; combatantId: Id; formId: Id; tempHp: number }
  /** …and steps back out of it. */
  | { type: 'wildShapeEnded'; combatantId: Id; formId: Id }
  /** Cutting Words: a bard talked an attacker's roll down. */
  | { type: 'cuttingWords'; bardId: Id; targetId: Id; amount: number }
  /** A Mirror Image duplicate took the blow and popped. */
  | { type: 'mirrorImageStruck'; combatantId: Id; left: number }
  /** A Counterspell stopped a spell before it happened. */
  | { type: 'counterspelled'; casterId: Id; byId: Id; spellId: Id }
  /** Confusion: what the d10 made this creature do with its turn. */
  | { type: 'confusedTurn'; combatantId: Id; roll: number; effect: 'nothing' | 'lashesOut' | 'normal'; targetId?: Id }
  /** Sanctuary turned an attack aside before it was ever rolled. */
  | { type: 'attackWarded'; attackerId: Id; targetId: Id }
  /** A rust monster ate a point of AC off someone's metal armour. */
  | { type: 'armorCorroded'; combatantId: Id; ac: number }
  /** Healed off 0 HP and back on their feet. */
  | { type: 'revived'; combatantId: Id; hp: number }
  | {
      type: 'savingThrow';
      combatantId: Id; ability: Ability; dc: number;
      natural: number; total: number; success: boolean;
      /** "Fated (4 → 17)" when a reroll changed the die — see rules/luck.ts. */
      luck?: string;
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
  /** An Unarmed Strike's Shove: pushed five feet, or knocked prone. `success`
   *  is false when the target made its save and nothing happened. */
  | {
      type: 'shoved'; shoverId: Id; targetId: Id; mode: 'push' | 'prone'; success: boolean;
      /**
       * The contest, when there was one: Athletics against the defender's better
       * of Athletics and Acrobatics. Optional so an older replay without it
       * still renders.
       */
      contest?: {
        attackerTotal: number; defenderTotal: number;
        defenderSkill: string;
        /** "Fated (4 → 17)" on either side, when a reroll changed the die. */
        luck?: string[];
      };
    }
  /** A sorcerer spent points to bend a spell. Emitted before `spellCast`, so a
   *  log reads "Quickened Spell (2 SP)" and then the cast it paid for. */
  | { type: 'metamagic'; casterId: Id; metamagicId: Id; spellId: Id; cost: number }
  | { type: 'disengaged'; combatantId: Id }
  | { type: 'dodging'; combatantId: Id }
  | { type: 'died'; combatantId: Id }
  /** Removed from the fight without dying — Animal Friendship charms a beast
   *  off the board. Shares kill()'s bookkeeping but is never a death. */
  | { type: 'charmedAway'; combatantId: Id }
  /** Turned or talked into running: left the board under its own legs, at the
   *  edge it was running for. `sourceId` is whoever put it to flight. */
  | { type: 'fled'; combatantId: Id; sourceId?: Id }
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
  /** A conjured ally arrived on the board and in the initiative order. */
  | { type: 'summoned'; combatantId: Id; summonerId: Id; position: Position }
  | { type: 'combatEnded'; winner: TeamId };
