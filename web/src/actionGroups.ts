/**
 * Groups the engine's flat legal-action list into what the UI paints:
 * board taps (moves, per-target attacks) and action-bar entries
 * (stances, features, self items, spells that need a targeting mode).
 */
import type { GameState, Id, Position, Combatant } from '../../src/engine/types.js';
import type { Action, Target } from '../../src/engine/actions.js';
import { SPELLS, validTarget } from '../../src/data/spells.js';
import { ITEMS } from '../../src/data/items.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { FEATURES } from '../../src/data/features.js';

export const posKey = (p: Position) => `${p.x},${p.y}`;

export interface TargetOption {
  label: string;
  action: Action;
}

export interface BarEntry {
  id: string;
  label: string;
  /** Immediate action, or enters a targeting mode. */
  action?: Action;
  cellTargets?: Map<string, Action>;   // area/teleport spells: tap a cell
  multi?: MultiTargetSpec;             // multi-creature spells: accumulate taps
}

export interface MultiTargetSpec {
  spellId: Id;
  slotLevel: number;
  maxTargets: number;
  allowRepeats: boolean;
  validIds: Set<Id>;
}

export interface Grouped {
  moves: Map<string, Action>;
  /** Per-combatant tap options (attacks, single-target spells, items, shake). */
  perTarget: Map<Id, TargetOption[]>;
  bar: BarEntry[];
}

export function describeShort(a: Action): string {
  switch (a.kind) {
    case 'attack': {
      const w = WEAPONS[a.weaponId]?.name ?? a.weaponId;
      return a.offhand ? `Off-hand ${w}` : w;
    }
    case 'castSpell': return SPELLS[a.spellId]?.name ?? a.spellId;
    case 'useItem': return ITEMS[a.itemId]?.name ?? a.itemId;
    case 'useFeature': return FEATURES[a.featureId]?.name ?? a.featureId;
    case 'shakeAwake': return 'Shake awake';
    case 'dash': return 'Dash';
    case 'disengage': return 'Disengage';
    case 'dodge': return 'Dodge';
    case 'hide': return 'Hide';
    case 'endTurn': return 'End turn';
    case 'move': return 'Move';
  }
}

export function groupActions(state: GameState, actorId: Id, actions: Action[]): Grouped {
  const moves = new Map<string, Action>();
  const perTarget = new Map<Id, TargetOption[]>();
  const bar: BarEntry[] = [];
  const cellSpells = new Map<string, Map<string, Action>>();
  const seenMulti = new Set<string>();

  const pushTarget = (id: Id, label: string, action: Action) => {
    const list = perTarget.get(id) ?? [];
    list.push({ label, action });
    perTarget.set(id, list);
  };

  for (const a of actions) {
    switch (a.kind) {
      case 'move':
        moves.set(posKey(a.to), a);
        break;
      case 'attack':
        pushTarget(a.targetId, describeShort(a), a);
        break;
      case 'shakeAwake':
        pushTarget(a.targetId, 'Shake awake', a);
        break;
      case 'castSpell': {
        const first = a.targets[0];
        if (first && 'position' in first) {
          const m = cellSpells.get(a.spellId) ?? new Map<string, Action>();
          m.set(posKey(first.position), a);
          cellSpells.set(a.spellId, m);
        } else if (a.targets.length === 1 && first && 'combatantId' in first) {
          pushTarget(first.combatantId, describeShort(a), a);
        } else if (!seenMulti.has(a.spellId)) {
          seenMulti.add(a.spellId);
          const spell = SPELLS[a.spellId]!;
          const t = spell.targeting;
          if (t.kind !== 'creature') break;
          const validIds = new Set(
            Object.values(state.combatants)
              .filter((c: Combatant) => c.alive && validTarget(state, actorId, spell, c.id))
              .map((c: Combatant) => c.id),
          );
          bar.push({
            id: `spell:${a.spellId}`,
            label: `${spell.name} 🎯`,
            multi: {
              spellId: a.spellId, slotLevel: a.slotLevel,
              maxTargets: t.count,
              allowRepeats: a.spellId === 'magic-missile' || a.spellId === 'scorching-ray',
              validIds,
            },
          });
        }
        break;
      }
      case 'useItem': {
        const first = a.targets?.[0];
        if (first && 'combatantId' in first && first.combatantId !== actorId) {
          pushTarget(first.combatantId, describeShort(a), a);
        } else if (!first) {
          bar.push({ id: `item:${a.itemId}:self`, label: describeShort(a), action: a });
        } else {
          // self-targeted with explicit id — treat as bar action
          bar.push({ id: `item:${a.itemId}:self2`, label: describeShort(a), action: a });
        }
        break;
      }
      case 'useFeature':
        bar.push({ id: `feat:${a.featureId}`, label: describeShort(a), action: a });
        break;
      case 'dash':
      case 'disengage':
      case 'dodge':
      case 'hide':
        bar.push({ id: a.kind, label: describeShort(a), action: a });
        break;
      case 'endTurn':
        break; // rendered separately
    }
  }

  for (const [spellId, cells] of cellSpells) {
    bar.push({
      id: `spell:${spellId}`,
      label: `${SPELLS[spellId]?.name ?? spellId} 🎯`,
      cellTargets: cells,
    });
  }

  return { moves, perTarget, bar };
}

export function buildMultiAction(spec: MultiTargetSpec, ids: Id[]): Action {
  const targets: Target[] = ids.map((combatantId) => ({ combatantId }));
  return { kind: 'castSpell', spellId: spec.spellId, slotLevel: spec.slotLevel, targets };
}
