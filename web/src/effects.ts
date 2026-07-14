/**
 * Maps engine events to transient visual effects (floating numbers, token
 * shakes, corpse fades) and sound effects. Purely presentational.
 */
import type { GameState, Id, DamageType } from '../../src/engine/types.js';
import type { GameEvent } from '../../src/engine/events.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { sfx, Sfx } from './sound.js';
import { posKey } from './actionGroups.js';

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

export interface EffectBatch {
  floats: FloatEffect[];
  corpses: CorpseEffect[];
  /** Token ids to shake briefly. */
  hits: Id[];
}

let nextId = 1;

const DMG_SFX: Record<DamageType, Sfx> = {
  slashing: 'melee', piercing: 'melee', bludgeoning: 'melee',
  fire: 'fire', lightning: 'lightning', thunder: 'thunder', cold: 'cold',
  acid: 'acid', poison: 'poison', radiant: 'radiant', necrotic: 'necrotic',
  force: 'force', psychic: 'psychic',
};

/**
 * Build effects for a batch of events. `state` is the post-apply state
 * (dead combatants keep their position). Sounds are scheduled with the same
 * stagger as their floats.
 */
export function effectsFor(state: GameState, events: GameEvent[]): EffectBatch {
  const floats: FloatEffect[] = [];
  const corpses: CorpseEffect[] = [];
  const hits: Id[] = [];
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
      case 'attackRolled': {
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
        if (cell) {
          floats.push({
            id: nextId++, cellKey: cell,
            text: `-${e.amount}`, cls: `dmg-${e.damageType}`, delayMs: stagger,
          });
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
          sound('heal', stagger);
          stagger += 150;
        }
        break;
      }
      case 'conditionApplied': {
        const cell = cellOf(e.combatantId);
        if (cell) {
          floats.push({ id: nextId++, cellKey: cell, text: e.condition, cls: 'cond', delayMs: stagger + 120 });
          sound('condition', stagger + 120);
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
      case 'combatEnded':
        sound('victory', stagger + 300);
        break;
      default:
        break;
    }
  }
  return { floats, corpses, hits };
}
