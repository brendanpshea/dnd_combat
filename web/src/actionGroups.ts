/**
 * Groups the engine's flat legal-action list into what the UI paints:
 * board taps (moves, per-target attacks) and action-bar entries
 * (stances, features, self items, spells that need a targeting mode).
 */
import type { GameState, Id, Position, Combatant } from '../../src/engine/types.js';
import type { Action, Target } from '../../src/engine/actions.js';
import { SPELLS, validTarget, type SpellData } from '../../src/data/spells.js';
import { ITEMS } from '../../src/data/items.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { FEATURES } from '../../src/data/features.js';

export const posKey = (p: Position) => `${p.x},${p.y}`;

export interface TargetOption {
  label: string;
  /** Glyph, so a chooser of three weapon names says which is which at a glance. */
  icon?: string;
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
  icon?: string;
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

/**
 * How a spell is aimed, in words.
 *
 * Every targeted spell used to be labelled "Name 🎯" — the same glyph for *pick
 * an enemy*, *pick an ally*, *pick a cell for a 2x2 blast*, *pick a direction
 * for a cone*, and *pick three targets*. Five interactions, one marker, so the
 * label actively misled. The glyph was a compression artefact of the old flat
 * bar; the tray has room to just say it, and this is derivable from data rather
 * than declared per spell.
 */
export function targetingNote(spell: SpellData): string {
  const t = spell.targeting;
  switch (t.kind) {
    case 'creature': {
      const [one, many] =
        t.who === 'ally' ? ['ally', 'allies'] :
        t.who === 'enemy' ? ['enemy', 'enemies'] : ['target', 'targets'];
      return t.count > 1 ? `${t.count} ${many}` : `1 ${one}`;
    }
    case 'weaponAttack': return 'weapon';
    case 'sphere2x2': return '2×2 area';
    case 'cone15': return 'cone';
    case 'emptyCell': return 'teleport';
    case 'self': return 'burst';
  }
}

/** Level + aim: "L1 · 2×2 area". Cantrips cost no slot, so they show only aim. */
function spellNote(spell: SpellData): string {
  return [spell.level > 0 ? `L${spell.level}` : '', targetingNote(spell)].filter(Boolean).join(' · ');
}

/** Melee or ranged, for weapon attacks — the data already knows. */
const weaponIcon = (weaponId: Id): string => (WEAPONS[weaponId]?.melee ? '⚔️' : '🏹');

const VERB_ICON: Record<string, string> = {
  dash: '💨', disengage: '🚪', dodge: '🛡️', hide: '👁️',
};

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

  const pushTarget = (id: Id, label: string, action: Action, icon?: string) => {
    const list = perTarget.get(id) ?? [];
    list.push({ label, action, ...(icon ? { icon } : {}) });
    perTarget.set(id, list);
  };

  for (const a of actions) {
    switch (a.kind) {
      case 'move':
        moves.set(posKey(a.to), a);
        break;
      case 'attack':
        pushTarget(a.targetId, describeShort(a), a, weaponIcon(a.weaponId));
        break;
      case 'shakeAwake':
        pushTarget(a.targetId, 'Shake awake', a, '🫱');
        break;
      case 'castSpell': {
        const first = a.targets[0];
        const spell = SPELLS[a.spellId]!;
        const t = spell.targeting;
        if (first && 'position' in first) {
          const m = cellSpells.get(a.spellId) ?? new Map<string, Action>();
          m.set(posKey(first.position), a);
          cellSpells.set(a.spellId, m);
        } else if (t.kind === 'self') {
          if (!seenMulti.has(a.spellId)) {
            seenMulti.add(a.spellId);
            bar.push({
              id: `spell:${a.spellId}`,
              label: spell.name,
              icon: spell.icon,
              group: 'spell',
              note: spellNote(spell),
              action: a,
            });
          }
        } else if (t.kind === 'weaponAttack' && first && 'combatantId' in first) {
          // True Strike targets one enemy like Fire Bolt, and reaches wherever
          // the weapon does — but it carries no `count`, so it takes the plain
          // single-target route rather than the multi-tap spec.
          pushTarget(first.combatantId, describeShort(a), a, spell.icon);
          if (!seenMulti.has(a.spellId)) {
            seenMulti.add(a.spellId);
            const validIds = new Set(
              Object.values(state.combatants)
                .filter((cc: Combatant) => cc.alive && validTarget(state, actorId, spell, cc.id))
                .map((cc: Combatant) => cc.id),
            );
            bar.push({
              id: `spell:${a.spellId}`,
              label: spell.name,
              icon: spell.icon,
              group: 'spell',
              note: spellNote(spell),
              multi: { spellId: a.spellId, slotLevel: a.slotLevel, maxTargets: 1, allowRepeats: false, validIds },
            });
          }
        } else if (t.kind === 'creature' && first && 'combatantId' in first) {
          // Fast path: a single-target enemy spell also hangs off the enemy, so
          // attacking stays two taps (tap the goblin, tap Fire Bolt) rather than
          // three via the tray. It's the most common action in the game.
          if (t.who === 'enemy' && a.targets.length === 1) {
            pushTarget(first.combatantId, describeShort(a), a, spell.icon);
          }
          // ...and *every* creature-targeted spell gets a tray entry, because
          // opening "Spells" and finding only some of your spells is a lie. The
          // two paths answer different questions: what can I do, vs do it now.
          if (!seenMulti.has(a.spellId)) {
            seenMulti.add(a.spellId);
            const validIds = new Set(
              Object.values(state.combatants)
                .filter((c: Combatant) => c.alive && validTarget(state, actorId, spell, c.id))
                .map((c: Combatant) => c.id),
            );
            bar.push({
              id: `spell:${a.spellId}`,
              label: spell.name,
              icon: spell.icon,
              group: 'spell',
              note: spellNote(spell),
              multi: {
                spellId: a.spellId, slotLevel: a.slotLevel,
                maxTargets: t.count,
                allowRepeats: a.spellId === 'magic-missile' || a.spellId === 'scorching-ray',
                validIds,
              },
            });
          }
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
          ...(VERB_ICON[a.kind] ? { icon: VERB_ICON[a.kind]! } : {}),
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
      ...(VERB_ICON[verb] ? { icon: VERB_ICON[verb]! } : {}),
      group: 'basic',
      note: 'Bonus',
      action,
    });
  }

  for (const [spellId, cells] of cellSpells) {
    const spell = SPELLS[spellId];
    bar.push({
      id: `spell:${spellId}`,
      label: spell?.name ?? spellId,
      ...(spell ? { icon: spell.icon } : {}),
      group: 'spell',
      ...(spell ? { note: spellNote(spell) } : {}),
      cellTargets: cells,
    });
  }

  return { moves, perTarget, bar };
}

export function buildMultiAction(spec: MultiTargetSpec, ids: Id[]): Action {
  const targets: Target[] = ids.map((combatantId) => ({ combatantId }));
  return { kind: 'castSpell', spellId: spec.spellId, slotLevel: spec.slotLevel, targets };
}
