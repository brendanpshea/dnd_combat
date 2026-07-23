/**
 * Maps engine events to transient visual effects (floating numbers, token
 * shakes, corpse fades) and sound effects. Purely presentational.
 */
import type { GameState, Id, DamageType } from '../../src/engine/types.js';
import type { GameEvent } from '../../src/engine/events.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { sfx, Sfx } from './sound.js';
import { posKey } from './actionGroups.js';
import { CONDITION_META } from './conditions.js';

export interface FloatEffect {
  id: number;
  cellKey: string;
  text: string;
  cls: string;      // css class suffix
  delayMs: number;
}

export interface CorpseEffect {
  id: number;
  cellKey: string;
  glyph: string;
}

export interface BurstEffect {
  id: number;
  cellKey: string;
  /** damage type, 'crit', or 'heal' — selects particle color/shape. */
  kind: string;
  delayMs: number;
}

/** A spell's area lighting up: every covered cell blooms in the effect colour. */
export interface AreaEffect {
  id: number;
  cellKeys: string[];
  /** The centre cell (the aim point) — gets an extra expanding ring. */
  centerKey?: string;
  kind: string;    // damage type, 'arcane', or 'heal' — selects colour
  delayMs: number;
}

/** A bolt travelling from caster to blast point before the detonation. */
export interface ProjectileEffect {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind: string;
  delayMs: number;
}

export interface EffectBatch {
  floats: FloatEffect[];
  corpses: CorpseEffect[];
  bursts: BurstEffect[];
  areas: AreaEffect[];
  projectiles: ProjectileEffect[];
  /** Token ids to shake briefly. */
  hits: Id[];
  /** Caster to pulse with a brief spell wind-up. */
  casterId?: Id;
  /** A crit landed this batch — trigger a brief screen flash. */
  critFlash: boolean;
}

let nextId = 1;

const DMG_SFX: Record<DamageType, Sfx> = {
  slashing: 'melee', piercing: 'melee', bludgeoning: 'melee',
  fire: 'fire', lightning: 'lightning', thunder: 'thunder', cold: 'cold',
  acid: 'acid', poison: 'poison', radiant: 'radiant', necrotic: 'necrotic',
  force: 'force', psychic: 'psychic',
};

/** Buff consumables whose effect is a silent stat change — floated on use so
 *  the drinker gets visible confirmation of what they gained. Items that
 *  already show a number (healing, thrown fire) are absent by design. */
const BUFF_ITEM_FLOAT: Record<string, string> = {
  'potion-giant-strength-hill': '💪 Giant Strength!',
  'potion-giant-strength-frost': '💪 Giant Strength!',
  'potion-fire-resistance': '🛡 Fire Resist',
  'potion-cold-resistance': '🛡 Cold Resist',
  'potion-poison-resistance': '🛡 Poison Resist',
  'potion-acid-resistance': '🛡 Acid Resist',
};

/**
 * Build effects for a batch of events. `state` is the post-apply state
 * (dead combatants keep their position). Sounds are scheduled with the same
 * stagger as their floats.
 */
export function effectsFor(state: GameState, events: GameEvent[]): EffectBatch {
  const floats: FloatEffect[] = [];
  const corpses: CorpseEffect[] = [];
  const bursts: BurstEffect[] = [];
  const areas: AreaEffect[] = [];
  const projectiles: ProjectileEffect[] = [];
  const hits: Id[] = [];
  let casterId: Id | undefined;
  let critFlash = false;
  // One cast per action, so the batch's damage type (if any) colours its
  // detonation; a control/utility spell falls back to an arcane wash.
  const batchDamageType = events.find((e) => e.type === 'damageDealt') as
    { damageType: DamageType } | undefined;
  const batchHeals = events.some((e) => e.type === 'healed');
  // The attack roll immediately precedes its damage; remember if it crit so
  // the damage float and burst can be upgraded.
  let pendingCrit = false;
  let stagger = 0;

  const cellOf = (id: Id): string | undefined => {
    const c = state.combatants[id];
    return c ? posKey(c.position) : undefined;
  };
  const sound = (kind: Sfx, delayMs: number) => {
    if (delayMs <= 0) sfx(kind);
    else setTimeout(() => sfx(kind), delayMs);
  };

  for (const e of events) {
    switch (e.type) {
      case 'spellCast': {
        casterId = e.casterId;
        sound('cast', stagger);
        if (e.cells.length > 0) {
          const kind = batchDamageType?.damageType ?? (batchHeals ? 'heal' : 'arcane');
          const center = e.cells[Math.floor(e.cells.length / 2)]!;
          // A bolt flies to the blast point first, unless the burst is centred
          // on the caster (Thunderwave) — then it just goes off underfoot.
          const isSelfCentred = e.cells.some((p) => p.x === e.origin.x && p.y === e.origin.y) &&
            Math.abs(center.x - e.origin.x) <= 1 && Math.abs(center.y - e.origin.y) <= 1;
          const travel = isSelfCentred ? 0 : 220;
          if (travel > 0) {
            projectiles.push({ id: nextId++, from: e.origin, to: center, kind, delayMs: stagger });
          }
          areas.push({
            id: nextId++,
            cellKeys: e.cells.map((p) => posKey(p)),
            centerKey: posKey(center),
            kind, delayMs: stagger + travel,
          });
          // Detonation, then let it read before the first number lands.
          stagger += travel + 150;
        }
        break;
      }
      case 'attackRolled': {
        pendingCrit = e.hit && e.crit;
        if (!e.hit) {
          const cell = cellOf(e.targetId);
          if (cell) floats.push({ id: nextId++, cellKey: cell, text: 'miss', cls: 'miss', delayMs: stagger });
          sound('miss', stagger);
          stagger += 150;
        } else if (e.weaponId !== 'spell' && WEAPONS[e.weaponId]?.melee === false) {
          sound('ranged', stagger);
        }
        break;
      }
      case 'damageDealt': {
        const cell = cellOf(e.targetId);
        const crit = pendingCrit;
        pendingCrit = false;
        if (cell) {
          floats.push({
            id: nextId++, cellKey: cell,
            text: crit ? `CRIT ${e.amount}!` : `-${e.amount}`,
            cls: `dmg-${e.damageType}${crit ? ' crit' : ''}`, delayMs: stagger,
          });
          bursts.push({ id: nextId++, cellKey: cell, kind: crit ? 'crit' : e.damageType, delayMs: stagger });
        }
        if (crit) critFlash = true;
        // Name the bonuses that fired ("Sneak Attack!") so players can see
        // their features working, the same way damage numbers are surfaced.
        for (const tag of e.tags ?? []) {
          if (tag === 'Critical Hit') continue; // already shouted by the CRIT float
          if (cell) floats.push({ id: nextId++, cellKey: cell, text: `${tag}!`, cls: 'tag', delayMs: stagger + 90 });
        }
        hits.push(e.targetId);
        sound(DMG_SFX[e.damageType], stagger);
        stagger += 150;
        break;
      }
      case 'healed': {
        const cell = cellOf(e.targetId);
        if (cell && e.amount > 0) {
          floats.push({ id: nextId++, cellKey: cell, text: `+${e.amount}`, cls: 'heal', delayMs: stagger });
          bursts.push({ id: nextId++, cellKey: cell, kind: 'heal', delayMs: stagger });
          sound('heal', stagger);
          stagger += 150;
        }
        break;
      }
      case 'savingThrow': {
        const cell = cellOf(e.combatantId);
        if (cell) {
          floats.push({
            id: nextId++, cellKey: cell,
            text: e.success ? 'Saved!' : 'Failed!',
            cls: e.success ? 'saved' : 'failed', delayMs: stagger,
          });
        }
        stagger += 120;
        break;
      }
      case 'conditionApplied': {
        const cell = cellOf(e.combatantId);
        const meta = CONDITION_META[e.condition];
        // Skip the mechanically-invisible markers (noReactions) — no float for
        // something the player can't see the effect of.
        if (cell && meta && !(meta.hidden && !meta.icon)) {
          const word = e.condition.charAt(0).toUpperCase() + e.condition.slice(1);
          floats.push({ id: nextId++, cellKey: cell, text: `${meta.icon} ${word}`.trim(), cls: 'cond', delayMs: stagger + 120 });
          bursts.push({ id: nextId++, cellKey: cell, kind: 'cond', delayMs: stagger + 120 });
          sound('condition', stagger + 120);
        }
        break;
      }
      case 'itemUsed': {
        // Buff potions (giant strength, resistances) change stats silently —
        // no damage or heal number lands — so shout what they did over the
        // drinker. Items that already show their own effect (healing → a heal
        // float, alchemist's fire → damage) get no extra label.
        const label = BUFF_ITEM_FLOAT[e.itemId];
        if (label) {
          const cell = cellOf(e.targetId ?? e.combatantId);
          if (cell) {
            floats.push({ id: nextId++, cellKey: cell, text: label, cls: 'cond', delayMs: stagger + 60 });
            bursts.push({ id: nextId++, cellKey: cell, kind: 'heal', delayMs: stagger + 60 });
            sound('condition', stagger + 60);
            stagger += 150;
          }
        }
        break;
      }
      case 'died': {
        const cell = cellOf(e.combatantId);
        if (cell) corpses.push({ id: nextId++, cellKey: cell, glyph: '💀' });
        sound('death', stagger);
        stagger += 200;
        break;
      }
      case 'charmedAway': {
        // No corpse — it walked away, nothing is left on the square.
        const cell = cellOf(e.combatantId);
        if (cell) floats.push({ id: nextId++, cellKey: cell, text: 'charmed!', cls: 'cond', delayMs: stagger });
        sound('condition', stagger);
        stagger += 200;
        break;
      }
      case 'combatEnded':
        sound('victory', stagger + 300);
        break;
      default:
        break;
    }
  }
  return { floats, corpses, bursts, areas, projectiles, hits, critFlash, ...(casterId !== undefined ? { casterId } : {}) };
}

