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
import { METAMAGIC, type MetamagicId } from '../../src/engine/rules/metamagic.js';

export const posKey = (p: Position) => `${p.x},${p.y}`;

export interface TargetOption {
  label: string;
  /** Glyph, so a chooser of three weapon names says which is which at a glance. */
  icon?: string;
  action: Action;
  /** Multi-target enemy spells (Scorching Ray, Magic Missile) also hang off a
   *  tapped enemy — but tapping this option *starts* the accumulate-taps flow
   *  with that enemy pre-picked, rather than firing `action` immediately. */
  multi?: MultiTargetSpec;
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
  /** Carried through the accumulate-taps flow so `buildMultiAction` rebuilds
   *  the *bent* cast rather than a plain one — otherwise picking targets for a
   *  quickened Magic Missile silently spends the action instead of the points. */
  metamagic?: MetamagicId;
  maxTargets: number;
  allowRepeats: boolean;
  validIds: Set<Id>;
  /** When set, the accumulated targets resolve as *using this item* (a spell
   *  scroll) rather than casting from a slot — so a Scroll of Magic Missile
   *  gets the same accumulate-taps flow as the spell. */
  itemId?: Id;
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
    case 'castSpell': {
      const name = SPELLS[a.spellId]?.name ?? a.spellId;
      // Weapon-attack spells carry which weapon; showing it is the whole point
      // of offering one per weapon (crossbow to shoot, mace to bonk).
      const bent = bentName(name, a.metamagic);
      return a.weaponId ? `${bent} (${WEAPONS[a.weaponId]?.name ?? a.weaponId})` : bent;
    }
    case 'shove': return a.mode === 'prone' ? 'Shove prone' : 'Shove back';
    case 'useItem': return ITEMS[a.itemId]?.name ?? a.itemId;
    case 'useFeature':
      // Drop the "Channel Divinity: " / "Fighting Style: " prefixes so a class
      // power fits a bar button ("Turn Undead", not the full ritual name).
      return (FEATURES[a.featureId]?.name ?? a.featureId)
        .replace(/^Channel Divinity: /, '').replace(/^Fighting Style: /, '');
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
    case 'sphere5x5': return '5×5 blast';
    case 'cone15': return 'cone';
    case 'cube15': return '3×3 blast';
    case 'line15': return 'line';
    case 'emptyCell': return 'teleport';
    case 'self': return 'self';
  }
}

/** Level + aim: "L1 · 2×2 area". Cantrips cost no slot, so they show only aim.
 *  `castLevel` overrides the spell's own level for an upcast (a smite paid for
 *  with a bigger slot), so the note reports the slot actually being spent. */
function spellNote(spell: SpellData, innateUsesLeft?: number, castLevel?: number, metamagic?: MetamagicId): string {
  const level = castLevel ?? spell.level;
  const cost = innateUsesLeft !== undefined ? `${innateUsesLeft} left`
    : level > 0 ? `L${level}` : '';
  // The point cost goes in the note, not the label: it is the thing a player
  // needs before pressing, and a button that spends a resource without saying
  // which one is how a sorcerer arrives at the second fight of the day empty.
  const sp = metamagic ? `${METAMAGIC[metamagic].cost} SP` : '';
  return [cost, sp, targetingNote(spell)].filter(Boolean).join(' · ');
}

/**
 * How a bent cast is labelled, and how its entry is keyed.
 *
 * A separate entry per Metamagic option — the same shape upcasting already
 * uses ("Fireball (L4)"). That works while there is ONE option and it is only
 * offered once the action is spent, so a bent entry never sits next to its own
 * plain version. It stops working the moment a second option arrives that
 * applies to an ordinary action cast: then the tray doubles, and the chip-row
 * design (arm an option, filter the list) is what replaces this.
 */
function bentName(name: string, metamagic?: MetamagicId): string {
  return metamagic ? `${name} (${METAMAGIC[metamagic].name.replace(' Spell', '')})` : name;
}
const bentKey = (id: string, metamagic?: MetamagicId): string => (metamagic ? `${id}#${metamagic}` : id);

/** Remaining innate casts of a spell for the actor, or undefined if not innate. */
function innateLeft(actor: Combatant, spellId: Id): number | undefined {
  return actor.innateSpells[spellId]?.current;
}

/** Melee or ranged, for weapon attacks — the data already knows. */
const weaponIcon = (weaponId: Id): string => (WEAPONS[weaponId]?.melee ? '⚔️' : '🏹');

const VERB_ICON: Record<string, string> = {
  dash: '💨', disengage: '🚪', dodge: '🛡️', hide: '👁️',
};

/** Icons for active class powers promoted to their own bar button. */
const FEATURE_ICON: Record<string, string> = {
  'turn-undead': '☀️', 'preserve-life': '💚', 'lay-on-hands': '🙌',
  'sacred-weapon': '⚔️', 'second-wind': '🌬️', 'action-surge': '⚡',
  'heroic-inspiration': '✨', 'adrenaline-rush': '🩸',
};

export function groupActions(state: GameState, actorId: Id, actions: Action[]): Grouped {
  const moves = new Map<string, Action>();
  const perTarget = new Map<Id, TargetOption[]>();
  const bar: BarEntry[] = [];
  const cellSpells = new Map<string, Map<string, Action>>();
  // Area/teleport scrolls (a Fireball scroll aims at a cell) collapse into one
  // "pick a cell" tray entry, exactly like the spell they cast — otherwise
  // legalActions' one-useItem-per-target-cell floods the Items tray with dozens
  // of identical buttons.
  const cellItems = new Map<string, Map<string, Action>>();
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
      // Hangs off the tapped enemy, like an attack: it is a thing you do TO
      // somebody standing next to you, and the tray is for things that need a
      // target picked.
      case 'shove':
        pushTarget(a.targetId, describeShort(a), a, a.mode === 'prone' ? '🤸' : '🫸');
        break;
      case 'castSpell': {
        const first = a.targets[0];
        const spell = SPELLS[a.spellId]!;
        const t = spell.targeting;
        if (first && 'position' in first) {
          const cellKey = bentKey(a.spellId, a.metamagic);
          const m = cellSpells.get(cellKey) ?? new Map<string, Action>();
          m.set(posKey(first.position), a);
          cellSpells.set(cellKey, m);
        } else if (t.kind === 'self') {
          // Smites are offered at every slot level the caster can pay for, so
          // the key has to carry the level too — otherwise "Divine Smite L1"
          // and "L2" collide into one entry.
          const key = bentKey(`${a.spellId}@${a.slotLevel}`, a.metamagic);
          if (!seenMulti.has(key)) {
            seenMulti.add(key);
            // Only an upcast carries the level in its id, so the base entry
            // keeps the stable `spell:<id>` every other lookup expects.
            const upcast = a.slotLevel > spell.level;
            bar.push({
              id: `spell:${bentKey(upcast ? `${a.spellId}@${a.slotLevel}` : a.spellId, a.metamagic)}`,
              label: bentName(upcast ? `${spell.name} (L${a.slotLevel})` : spell.name, a.metamagic),
              icon: spell.icon,
              group: 'spell',
              note: spellNote(spell, undefined, a.slotLevel, a.metamagic),
              action: a,
            });
          }
        } else if (t.kind === 'weaponAttack' && first && 'combatantId' in first) {
          // True Strike targets one enemy like Fire Bolt, and reaches wherever
          // the weapon does — but it carries no `count`, so it takes the plain
          // single-target route rather than the multi-tap spec.
          pushTarget(first.combatantId, describeShort(a), a, spell.icon);
          if (!seenMulti.has(bentKey(a.spellId, a.metamagic))) {
            seenMulti.add(bentKey(a.spellId, a.metamagic));
            const validIds = new Set(
              Object.values(state.combatants)
                .filter((cc: Combatant) => cc.alive && validTarget(state, actorId, spell, cc.id))
                .map((cc: Combatant) => cc.id),
            );
            bar.push({
              id: `spell:${bentKey(a.spellId, a.metamagic)}`,
              label: bentName(spell.name, a.metamagic),
              icon: spell.icon,
              group: 'spell',
              note: spellNote(spell, undefined, undefined, a.metamagic),
              multi: { spellId: a.spellId, slotLevel: a.slotLevel, maxTargets: 1, allowRepeats: false, validIds, ...(a.metamagic ? { metamagic: a.metamagic } : {}) },
            });
          }
        } else if (t.kind === 'creature' && first && 'combatantId' in first) {
          // Fast path: a single-target enemy spell also hangs off the enemy, so
          // attacking stays two taps (tap the goblin, tap Fire Bolt) rather than
          // three via the tray. It's the most common action in the game. Guard
          // on `t.count === 1`, not the built action's length — a lone enemy
          // makes Scorching Ray's default set one target too, and firing that
          // single ray was the bug (it should fling all its rays like Magic
          // Missile). Multi-count spells take the accumulate-taps path below.
          if (t.who === 'enemy' && t.count === 1 && a.targets.length === 1) {
            pushTarget(first.combatantId, describeShort(a), a, spell.icon);
          }
          // ...and *every* creature-targeted spell gets a tray entry, because
          // opening "Spells" and finding only some of your spells is a lie. The
          // two paths answer different questions: what can I do, vs do it now.
          if (!seenMulti.has(bentKey(a.spellId, a.metamagic))) {
            seenMulti.add(bentKey(a.spellId, a.metamagic));
            const validIds = new Set(
              Object.values(state.combatants)
                .filter((c: Combatant) => c.alive && validTarget(state, actorId, spell, c.id))
                .map((c: Combatant) => c.id),
            );
            const multi: MultiTargetSpec = {
              spellId: a.spellId, slotLevel: a.slotLevel,
              maxTargets: t.count,
              allowRepeats: a.spellId === 'magic-missile' || a.spellId === 'scorching-ray',
              validIds,
              ...(a.metamagic ? { metamagic: a.metamagic } : {}),
            };
            bar.push({
              id: `spell:${bentKey(a.spellId, a.metamagic)}`,
              label: bentName(spell.name, a.metamagic),
              icon: spell.icon,
              group: 'spell',
              note: spellNote(spell, undefined, undefined, a.metamagic),
              multi,
            });
            // A multi-target enemy spell (Scorching Ray, Magic Missile) also
            // hangs off each enemy you can tap — so the natural "tap the goblin,
            // pick the spell" gesture works for it too, not only the 🔮 tray.
            // Tapping the option *starts* the accumulate-taps flow with that
            // enemy pre-picked (its first ray/dart), then you pick the rest.
            if (t.who === 'enemy' && t.count > 1) {
              const unit = a.spellId === 'scorching-ray' ? 'rays' : a.spellId === 'magic-missile' ? 'darts' : 'hits';
              for (const id of validIds) {
                // Anchor the flow on the tapped enemy (its first ray/dart), then
                // pick the rest; falls back to a single-target cast if applied.
                const firstAction: Action = { kind: 'castSpell', spellId: a.spellId, slotLevel: a.slotLevel, targets: [{ combatantId: id }], ...(a.metamagic ? { metamagic: a.metamagic } : {}) };
                const list = perTarget.get(id) ?? [];
                list.push({ label: `${bentName(spell.name, a.metamagic)} (${t.count} ${unit})`, icon: spell.icon, action: firstAction, multi });
                perTarget.set(id, list);
              }
            }
          }
        }
        break;
      }
      case 'useItem': {
        const first = a.targets?.[0];
        const qty = state.combatants[actorId]?.inventory
          .find((s) => s.itemId === a.itemId)?.qty ?? 0;
        const note = qty > 1 ? { note: `×${qty}` } : {};
        // A spell-scroll for a multi-target spell (Magic Missile's darts) goes
        // through the accumulate-taps tray like the spell — not the tapped-enemy
        // menu, which can't express "three darts, split how you like".
        const itemTargeting = ITEMS[a.itemId]?.targeting;
        const scrollSpell = itemTargeting?.kind === 'spell' ? SPELLS[itemTargeting.spellId] : undefined;
        const st = scrollSpell?.targeting;
        if (scrollSpell && st?.kind === 'creature' && st.count > 1) {
          if (!seenMulti.has(a.itemId)) {
            seenMulti.add(a.itemId);
            const validIds = new Set(
              Object.values(state.combatants)
                .filter((c: Combatant) => c.alive && validTarget(state, actorId, scrollSpell, c.id))
                .map((c: Combatant) => c.id),
            );
            bar.push({
              id: `item:${a.itemId}`, label: describeShort(a), group: 'item', ...note,
              icon: scrollSpell.icon,
              multi: {
                spellId: scrollSpell.id, slotLevel: scrollSpell.level, itemId: a.itemId,
                maxTargets: st.count,
                allowRepeats: scrollSpell.id === 'magic-missile' || scrollSpell.id === 'scorching-ray',
                validIds,
              },
            });
          }
          break;
        }
        // An area/teleport scroll aims at a cell: gather one entry per aim
        // point into a single pick-a-cell tray (like the area-spell path).
        if (first && 'position' in first) {
          const m = cellItems.get(a.itemId) ?? new Map<string, Action>();
          m.set(posKey(first.position), a);
          cellItems.set(a.itemId, m);
          break;
        }
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
          ...(FEATURE_ICON[a.featureId] ? { icon: FEATURE_ICON[a.featureId]! } : {}),
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

  const me = state.combatants[actorId]!;
  for (const [key, cells] of cellSpells) {
    const [spellId, metamagic] = key.split('#') as [Id, MetamagicId | undefined];
    const spell = SPELLS[spellId];
    bar.push({
      id: `spell:${key}`,
      label: bentName(spell?.name ?? spellId, metamagic),
      ...(spell ? { icon: spell.icon } : {}),
      group: 'spell',
      ...(spell ? { note: spellNote(spell, innateLeft(me, spellId), undefined, metamagic) } : {}),
      cellTargets: cells,
    });
  }
  // One pick-a-cell entry per area/teleport scroll (the spell it casts supplies
  // the icon), with a ×qty note when the pack holds more than one.
  for (const [itemId, cells] of cellItems) {
    const it = ITEMS[itemId];
    const scrollSpell = it?.targeting.kind === 'spell' ? SPELLS[it.targeting.spellId] : undefined;
    const qty = me.inventory.find((s) => s.itemId === itemId)?.qty ?? 0;
    bar.push({
      id: `item:${itemId}`,
      label: it?.name ?? itemId,
      group: 'item',
      ...(scrollSpell ? { icon: scrollSpell.icon } : {}),
      ...(qty > 1 ? { note: `×${qty}` } : {}),
      cellTargets: cells,
    });
  }

  return { moves, perTarget, bar };
}

export function buildMultiAction(spec: MultiTargetSpec, ids: Id[]): Action {
  const targets: Target[] = ids.map((combatantId) => ({ combatantId }));
  if (spec.itemId) return { kind: 'useItem', itemId: spec.itemId, targets };
  return {
    kind: 'castSpell', spellId: spec.spellId, slotLevel: spec.slotLevel, targets,
    ...(spec.metamagic ? { metamagic: spec.metamagic } : {}),
  };
}


/**
 * A tray entry with a Metamagic option applied, or `undefined` if the option
 * cannot bend it.
 *
 * THE CHIP ROW, AND WHY IT EXISTS NOW
 *
 * While Quickened was the only option, a bent cast was its own tray entry —
 * the shape upcasting already uses. That worked because Quickened is offered
 * only once the action is spent, so a bent entry never sat beside its own plain
 * version. Heightened breaks it in two ways: it applies to an ordinary action
 * cast, so every affected spell would appear twice; and it is not enumerated at
 * ALL (see legalActions — the AI measured it as not worth its points), so there
 * is no entry to duplicate in the first place.
 *
 * So the player arms an option and the tray re-reads through this. `armed`
 * lives in the UI, the bending lives here, and the engine stays the authority:
 * every action this produces is validated by `isLegalAction` before it is
 * applied, exactly like an unbent one.
 *
 * Pure on purpose. Every web test in this repo runs without a DOM, so the
 * decision "which spells can this option touch, and what does the button do
 * when pressed" has to be testable on its own — otherwise the whole chip row
 * would ship unverified.
 */
export function bendEntry(entry: BarEntry, metamagic: MetamagicId): BarEntry | undefined {
  const meta = METAMAGIC[metamagic];
  const spellId = entry.multi?.spellId
    ?? (entry.action?.kind === 'castSpell' ? entry.action.spellId : undefined)
    ?? (entry.id.startsWith('spell:') ? entry.id.slice(6).split(/[@#]/)[0] : undefined);
  const spell = spellId ? SPELLS[spellId] : undefined;
  // Items are never bendable: a scroll is not the sorcerer's own casting.
  if (!spell || entry.group !== 'spell' || !meta.applies(spell)) return undefined;
  const bend = (a: Action): Action =>
    (a.kind === 'castSpell' ? { ...a, metamagic } : a);
  return {
    ...entry,
    id: `${entry.id}#${metamagic}`,
    /**
     * The LABEL is left alone, deliberately.
     *
     * `bentName` suffixes the option — "Fireball (Quickened)" — and that is
     * right for the entries `legalActions` enumerates, which sit in an ordinary
     * tray beside unbent ones and have to say what they are. It is wrong here:
     * with a chip armed, EVERY row in the tray is bent, so the suffix is on all
     * of them and says nothing. Read in a browser, it also wrapped every label
     * to two lines and squeezed the note down to "L2 -" — clipping the sorcery
     * point cost, which is the one thing the note exists to show.
     *
     * The armed chip is the label. The rows just say what they cost.
     */
    note: [entry.note, `${meta.cost} SP`].filter(Boolean).join(' · '),
    ...(entry.action ? { action: bend(entry.action) } : {}),
    ...(entry.cellTargets
      ? { cellTargets: new Map([...entry.cellTargets].map(([k, a]) => [k, bend(a)])) }
      : {}),
    ...(entry.multi ? { multi: { ...entry.multi, metamagic } } : {}),
  };
}

/**
 * The spell tray as it looks with `armed` held down: only what the option can
 * touch, each entry bent. `armed === null` gives the ordinary tray back.
 */
export function bendTray(bar: BarEntry[], armed: MetamagicId | null): BarEntry[] {
  if (!armed) return bar;
  return bar.flatMap((b) => {
    const bent = bendEntry(b, armed);
    return bent ? [bent] : [];
  });
}
