/**
 * Just-in-time coaching. A small set of one-time tips keyed to *engine events*
 * — an opportunity attack provoked, an ally downed, a slot spent — so they fire
 * the first time a new player meets each mechanic, in any battle: skirmish,
 * campaign, or any adventure module. Nothing here references a module or a
 * piece of content; every trigger is a thing the rules do.
 *
 * The flow: App hands each turn's events to `detectTips`, which returns the
 * tips whose triggers fired (most-important first). App shows the first one the
 * player hasn't seen yet and records it. Seen-state + an off switch persist in
 * localStorage, so a mechanic is taught once, ever, and veterans can mute it.
 */
import type { GameEvent } from '../../src/engine/events.js';
import type { GameState, Id } from '../../src/engine/types.js';
import { SPELLS } from '../../src/data/spells.js';
import { CONDITION_META } from './conditions.js';

export interface Tip {
  id: string;
  icon: string;
  title: string;
  body: string;
}

interface TipDef extends Tip {
  /** Did this turn's events trigger the tip? `isPlayer` is true for a
   *  human-controlled combatant (the tip is written from that side's POV). */
  test: (events: GameEvent[], state: GameState, isPlayer: (id: Id) => boolean) => boolean;
}

/** Ordered most- to least-urgent: when several fire on one action, the most
 *  teachable moment wins the single toast slot. */
const TIPS: TipDef[] = [
  {
    id: 'downed-ally', icon: '❤️‍🩹', title: 'Down, not dead',
    body: 'A hero at 0 HP is unconscious, not dead — still on the board, and back on their feet the instant any healing reaches them. Get a potion or a Cure Wounds to them before the enemy moves on.',
    test: (e, s, isP) => e.some((x) => x.type === 'downed' && isP(x.combatantId)),
  },
  {
    id: 'control', icon: '⛓️', title: 'Held in place',
    body: 'One of your heroes is under a control effect — tap the badge on their token to see exactly what it stops. Many of these let you retry a saving throw at the end of each turn to shake free.',
    test: (e, s, isP) => e.some((x) => x.type === 'conditionApplied' && isP(x.combatantId)
      && CONDITION_META[x.condition]?.kind === 'control'),
  },
  {
    id: 'opportunity', icon: '⚔️', title: 'Mind the reach',
    body: 'Stepping straight out of an enemy\'s reach provokes a free "opportunity" attack. To leave safely, use Disengage (in the ⋯ menu); to just get somewhere fast, Dash doubles your movement.',
    test: (e) => e.some((x) => x.type === 'attackRolled' && x.opportunity),
  },
  {
    id: 'concentration', icon: '🌀', title: 'Hold your focus',
    body: 'That spell needs concentration to keep going — if the caster takes damage they must save or lose it, and they can only concentrate on one spell at a time. Guard your caster while it\'s up.',
    test: (e, s, isP) => e.some((x) => x.type === 'spellCast' && isP(x.casterId) && !!SPELLS[x.spellId]?.concentration),
  },
  {
    id: 'slot', icon: '🔮', title: 'Spend slots wisely',
    body: 'Leveled spells burn a spell slot, and you have only a few — the pips beside a caster\'s HP show what\'s left, and they come back on a long rest. Cantrips cost nothing, so lean on them between the big moments.',
    test: (e, s, isP) => e.some((x) => x.type === 'spellCast' && isP(x.casterId) && (SPELLS[x.spellId]?.level ?? 0) >= 1),
  },
  {
    id: 'hidden', icon: '👻', title: 'Out of sight',
    body: 'Hidden: enemies can\'t target you directly, and your next attack lands with advantage. Attacking or casting gives you away — so line up something worth the reveal.',
    test: (e, s, isP) => e.some((x) => x.type === 'hideCheck' && x.success && isP(x.combatantId)),
  },
  {
    id: 'mastery', icon: '🎯', title: 'Weapon masteries',
    body: 'That extra effect on your hit is a weapon mastery — each weapon has its own trick (Sap, Vex, Topple, and more) that fires when you connect. Tap a weapon\'s ⓘ to see what it does.',
    test: (e, s, isP) => e.some((x) => x.type === 'conditionApplied' && !!x.sourceId && isP(x.sourceId)
      && (x.condition === 'sapped' || x.condition === 'vexed' || x.condition === 'slowed')),
  },
  {
    id: 'crit', icon: '💥', title: 'Critical hit',
    body: 'A natural 20 always hits and *crits* — you roll your damage dice twice. Champions crit on 19 too. Downed and paralyzed targets hand you a crit on any melee hit.',
    test: (e, s, isP) => e.some((x) => x.type === 'attackRolled' && x.crit && isP(x.attackerId)),
  },
];

/** Public list, for a "what have I been taught?" reference if ever wanted. */
export const ALL_TIPS: Tip[] = TIPS.map(({ test: _t, ...tip }) => tip);

/** The tips this turn's events triggered, most-urgent first. App filters these
 *  against the seen-set and shows the first new one. */
export function detectTips(events: GameEvent[], state: GameState, isPlayer: (id: Id) => boolean): Tip[] {
  return TIPS.filter((t) => {
    try { return t.test(events, state, isPlayer); } catch { return false; }
  }).map(({ test: _t, ...tip }) => tip);
}

// --- persistence ------------------------------------------------------------

const SEEN_KEY = 'dnd-tips-seen';
const OFF_KEY = 'dnd-tips-off';

export function tipsOff(): boolean {
  try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
}
export function setTipsOff(off: boolean): void {
  try { off ? localStorage.setItem(OFF_KEY, '1') : localStorage.removeItem(OFF_KEY); } catch { /* private mode */ }
}
export function seenTips(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')); } catch { return new Set(); }
}
export function markTipSeen(id: string): void {
  try {
    const seen = seenTips(); seen.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch { /* private mode */ }
}
