/**
 * Behaviour probe: npx tsx scripts/probe.ts
 *
 * Tactical set-pieces with an obvious right answer, each asking the AI for ONE
 * decision and printing what it picked. Runs in about a second.
 *
 * This is the fast half of the AI feedback loop. The arena answers "is it
 * stronger?" — authoritative, but slow and noisy enough that a 50-game read
 * can't tell 45% from 55%. The probe answers "does it still do the sensible
 * thing here?", instantly and deterministically, which is the question most
 * small changes are actually about. Use the probe while iterating; use the
 * arena before committing. Neither replaces the other: the probe can't see a
 * strength regression, and the arena can't tell you *why*.
 *
 * A probe row is not a test — some rows are judgement calls, and `?` rows are
 * reported, not enforced. Add a row whenever a behaviour surprises you.
 */
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';
import { describeAction } from '../src/ui/cli/renderer.js';
import type { Combatant, Position, TeamId } from '../src/engine/types.js';
import type { Action } from '../src/engine/actions.js';

const FAST = SIM_PRESETS[(process.argv[2] ?? 'normal') as keyof typeof SIM_PRESETS] ?? SIM_PRESETS.normal;

function pc(classId: string, team: TeamId, position: Position, over: Partial<Combatant> = {}): Combatant {
  const c = buildCharacter({ classId, team, position, level: 3 });
  return { ...c, ...over, id: over.id ?? c.id };
}
function mon(id: string, team: TeamId, position: Position, over: Partial<Combatant> = {}): Combatant {
  const c = buildMonster(id, team, position);
  return { ...c, ...over, id: over.id ?? c.id };
}

interface Scenario {
  name: string;
  /**
   * What we want to see over the actor's WHOLE turn. Judge the turn, never the
   * first action: "attack then step aside" and "step aside then attack" spend
   * the same resources and score identically, so which comes first is decided
   * by sampling noise. A first-action assertion tests a coin flip.
   */
  want?: { label: string; ok: (turn: Action[], text: string, out: Outcome) => boolean };
  actorId: string;
  units: Combatant[];
  mapId?: string;
}

/** What the turn actually cost, read from events rather than guessed from labels. */
interface Outcome { provoked: number; oaDamage: number; alive: boolean; hp: number }

const attacked = (turn: Action[]) => turn.some((a) => a.kind === 'attack' || a.kind === 'castSpell');
const took = (turn: Action[], kind: Action['kind']) => turn.some((a) => a.kind === kind);

const SCENARIOS: Scenario[] = [
  {
    name: 'wizard in melee, has slots',
    actorId: 'wiz',
    want: { label: 'act, not flee', ok: attacked },
    units: [pc('wizard', 'team1', { x: 3, y: 3 }, { id: 'wiz' }), mon('wolf', 'team2', { x: 3, y: 4 })],
  },
  {
    name: 'wizard in melee, no slots',
    actorId: 'wiz',
    // A scroll counts: the point is that it fights rather than flees.
    want: { label: 'act, not flee', ok: (t) => attacked(t) || took(t, 'useItem') },
    units: [
      pc('wizard', 'team1', { x: 3, y: 3 }, { id: 'wiz', spellSlots: [{ current: 0, max: 4 }, { current: 0, max: 2 }] }),
      mon('wolf', 'team2', { x: 3, y: 4 }),
    ],
  },
  {
    name: 'cleric in melee (save cantrip)',
    actorId: 'cle',
    want: { label: 'stand and cast, not disengage', ok: (t) => attacked(t) && !took(t, 'disengage') },
    units: [pc('cleric', 'team1', { x: 3, y: 3 }, { id: 'cle' }), mon('wolf', 'team2', { x: 3, y: 4 })],
  },
  {
    name: 'fighter adjacent to a 3hp wizard',
    actorId: 'ftr',
    want: { label: 'attack it', ok: attacked },
    units: [
      pc('fighter', 'team1', { x: 3, y: 3 }, { id: 'ftr' }),
      pc('wizard', 'team2', { x: 3, y: 4 }, { id: 'vic', hp: 3 }),
    ],
  },
  {
    name: 'rogue adjacent, ally engaging same target (sneak on)',
    actorId: 'rog',
    want: { label: 'attack', ok: attacked },
    units: [
      pc('rogue', 'team1', { x: 3, y: 3 }, { id: 'rog' }),
      pc('fighter', 'team1', { x: 4, y: 5 }, { id: 'ally' }),
      mon('ogre', 'team2', { x: 3, y: 4 }, { id: 'og' }),
    ],
  },
  {
    name: 'rogue at range, nothing adjacent',
    actorId: 'rog',
    want: { label: 'shoot, not dodge', ok: (t) => attacked(t) && !took(t, 'dodge') },
    units: [pc('rogue', 'team1', { x: 1, y: 1 }, { id: 'rog' }), mon('ogre', 'team2', { x: 5, y: 5 }, { id: 'og' })],
  },
  {
    name: 'melee fighter far from the enemy',
    actorId: 'ftr',
    want: { label: 'close the distance', ok: (t) => took(t, 'move') || took(t, 'dash') },
    units: [pc('fighter', 'team1', { x: 0, y: 0 }, { id: 'ftr' }), mon('ogre', 'team2', { x: 7, y: 7 }, { id: 'og' })],
  },
  {
    name: 'healthy fighter, no threat in reach',
    actorId: 'ftr',
    want: { label: 'not dodge (nothing to fear yet)', ok: (t) => !took(t, 'dodge') },
    units: [pc('fighter', 'team1', { x: 0, y: 0 }, { id: 'ftr' }), mon('kobold', 'team2', { x: 7, y: 7 }, { id: 'k' })],
  },
  {
    name: 'hurt kobold in reach, second target nearby',
    actorId: 'kob',
    // Your case 1 & 3: a kobold on its last legs walks out of a fighter's reach
    // and dies to the opportunity attack. Fleeing while healthy is fine — it is
    // worth 12 points of win rate — but no repositioning is worth the unit.
    // A fighter's longsword does 4-11; at 4hp any hit kills. Provoking here is
    // not a risk, it's a coin flip for the unit's life.
    want: { label: 'not provoke a certainly-lethal OA', ok: (_t, _x, out) => out.provoked === 0 },
    units: [
      mon('kobold', 'team2', { x: 3, y: 3 }, { id: 'kob', hp: 4 }),
      pc('fighter', 'team1', { x: 3, y: 4 }, { id: 'ftr' }),
      pc('wizard', 'team1', { x: 6, y: 3 }, { id: 'wiz' }),
    ],
  },
  {
    name: 'rogue behind a wall, ogre opposite (can Hide)',
    actorId: 'rog',
    // Hiding is the rogue's whole trick: a bonus action, off the wall's cover,
    // that buys advantage and so Sneak Attack on the next swing. Reported, not
    // enforced — whether it beats simply shooting is a judgement call, but
    // never hiding at all means the AI isn't playing the class.
    units: [
      pc('rogue', 'team1', { x: 1, y: 5 }, { id: 'rog' }),
      mon('ogre', 'team2', { x: 3, y: 5 }, { id: 'og' }),
    ],
    mapId: 'ruins',
  },
];

let pass = 0;
let fail = 0;
for (const s of SCENARIOS) {
  const c = new Combat({ seed: 7, mapId: s.mapId ?? 'open', combatants: s.units });
  let guard = 0;
  while (c.activeId !== s.actorId && guard++ < 30) c.apply({ kind: 'endTurn' });
  if (c.activeId !== s.actorId) {
    console.log(`  ??  ${s.name.padEnd(46)} (actor never got a turn)`);
    continue;
  }
  // Play the actor's whole turn, so the probe judges what it *did*, not which
  // half of an equal-scoring plan the sampler happened to order first.
  const turn: Action[] = [];
  const texts: string[] = [];
  const out: Outcome = { provoked: 0, oaDamage: 0, alive: true, hp: 0 };
  let steps = 0;
  while (c.activeId === s.actorId && !c.isOver() && steps++ < 8) {
    const a = chooseActionSim(c.state, s.actorId, FAST);
    turn.push(a);
    texts.push(describeAction(c.state, a));
    const evs = c.apply(a);
    for (const e of evs) {
      if (e.type === 'attackRolled' && e.opportunity && e.targetId === s.actorId) out.provoked++;
      if (e.type === 'damageDealt' && e.targetId === s.actorId) out.oaDamage += e.amount;
    }
  }
  const me = c.state.combatants[s.actorId]!;
  out.alive = me.alive;
  out.hp = me.hp;
  let text = texts.filter((t) => t !== 'End turn').join(' → ') || '(nothing)';
  if (out.provoked) text += `   [provoked ${out.provoked} OA, took ${out.oaDamage}${out.alive ? '' : ', DIED'}]`;
  if (!s.want) {
    console.log(`  ..  ${s.name.padEnd(44)} ${text}`);
    continue;
  }
  const ok = s.want.ok(turn, text, out);
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'ok' : 'XX'}  ${s.name.padEnd(44)} ${text}${ok ? '' : `\n      ^ want: ${s.want.label}`}`);
}
console.log(`\n${pass} ok, ${fail} off`);
