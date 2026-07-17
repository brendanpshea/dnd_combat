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

/**
 * Which shelf an entry belongs on. The bar shows one control per *category*,
 * not per action, so it stays the same size at level 3 and level 20 — roughly
 * two thirds of every spell in the game is bar-bound (only single-target enemy
 * spells attach to a tapped enemy), so a flat bar grows without limit.
 */
export type BarGroup = 'spell' | 'item' | 'skill' | 'basic';

export interface BarEntry {
  id: string;
  label: string;
  group: BarGroup;
  /** Short qualifier shown beside the label: 'L2', 'Bonus', '×3'. */
  note?: string;
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

  // Cunning Action / Nimble Escape do exactly what Dash, Disengage and Hide do,
  // only as a bonus action — so a rogue was offered each verb twice, with no
  // way to tell the buttons apart. Offer one, and spend the bonus action, which
  // is the reason the feature exists: it keeps the action free for an attack.
  // (If the bonus is already spent the feature isn't legal, so the plain verb
  // surfaces on its own and the entry quietly costs the action instead.)
  const bonusVerbs = new Map<string, Action>();
  const emittedVerbs = new Set<string>();
  for (const a of actions) {
    if (a.kind !== 'useFeature') continue;
    const verb = FEATURES[a.featureId]?.bonusVerb;
    if (verb) bonusVerbs.set(verb, a);
  }

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
        const spell = SPELLS[a.spellId]!;
        const t = spell.targeting;
        if (first && 'position' in first) {
          const m = cellSpells.get(a.spellId) ?? new Map<string, Action>();
          m.set(posKey(first.position), a);
          cellSpells.set(a.spellId, m);
        } else if (
          t.kind === 'creature' && t.who === 'enemy' &&
          a.targets.length === 1 && first && 'combatantId' in first
        ) {
          // Single-target enemy spells (Fire Bolt, Hold Person) tap the enemy,
          // like weapon attacks — red target ring.
          pushTarget(first.combatantId, describeShort(a), a);
        } else if (t.kind === 'creature' && !seenMulti.has(a.spellId)) {
          // Ally spells (Cure Wounds, Bless) and multi-target spells (Magic
          // Missile) go to the action bar → a targeting mode, so allies light
          // up green only when you're actively casting on them.
          seenMulti.add(a.spellId);
          const validIds = new Set(
            Object.values(state.combatants)
              .filter((c: Combatant) => c.alive && validTarget(state, actorId, spell, c.id))
              .map((c: Combatant) => c.id),
          );
          bar.push({
            id: `spell:${a.spellId}`,
            label: `${spell.name} 🎯`,
            group: 'spell',
            ...(spell.level > 0 ? { note: `L${spell.level}` } : {}),
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
        const qty = state.combatants[actorId]?.inventory
          .find((s) => s.itemId === a.itemId)?.qty ?? 0;
        const note = qty > 1 ? { note: `×${qty}` } : {};
        if (first && 'combatantId' in first && first.combatantId !== actorId) {
          pushTarget(first.combatantId, describeShort(a), a);
        } else if (!first) {
          bar.push({ id: `item:${a.itemId}:self`, label: describeShort(a), group: 'item', ...note, action: a });
        } else {
          // self-targeted with explicit id — treat as bar action
          bar.push({ id: `item:${a.itemId}:self2`, label: describeShort(a), group: 'item', ...note, action: a });
        }
        break;
      }
      case 'useFeature': {
        const verb = FEATURES[a.featureId]?.bonusVerb;
        // Merged below into the single entry for its verb.
        if (verb) break;
        bar.push({
          id: `feat:${a.featureId}`, label: describeShort(a), group: 'skill',
          ...(FEATURES[a.featureId]?.trigger === 'bonus' ? { note: 'Bonus' } : {}),
          action: a,
        });
        break;
      }
      case 'dash':
      case 'disengage':
      case 'dodge':
      case 'hide': {
        const bonus = bonusVerbs.get(a.kind);
        emittedVerbs.add(a.kind);
        bar.push({
          id: a.kind,
          label: describeShort(a),
          group: 'basic',
          ...(bonus ? { note: 'Bonus' } : {}),
          action: bonus ?? a,
        });
        break;
      }
      case 'endTurn':
        break; // rendered separately
    }
  }

  // A bonus verb whose plain form isn't legal — the action is already spent, so
  // only Cunning Action can still Dash — would otherwise vanish with its
  // duplicate. Surface it under the verb's own name.
  for (const [verb, action] of bonusVerbs) {
    if (emittedVerbs.has(verb)) continue;
    bar.push({
      id: verb,
      label: describeShort({ kind: verb } as Action),
      group: 'basic',
      note: 'Bonus',
      action,
    });
  }

  for (const [spellId, cells] of cellSpells) {
    const spell = SPELLS[spellId];
    bar.push({
      id: `spell:${spellId}`,
      label: `${spell?.name ?? spellId} 🎯`,
      group: 'spell',
      ...(spell && spell.level > 0 ? { note: `L${spell.level}` } : {}),
      cellTargets: cells,
    });
  }

  return { moves, perTarget, bar };
}

export function buildMultiAction(spec: MultiTargetSpec, ids: Id[]): Action {
  const targets: Target[] = ids.map((combatantId) => ({ combatantId }));
  return { kind: 'castSpell', spellId: spec.spellId, slotLevel: spec.slotLevel, targets };
}
