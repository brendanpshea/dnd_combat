/**
 * Conjured allies: a real combatant, brought onto the board mid-fight.
 *
 * Everything else the game calls a "summon" is a marker — a Spiritual Weapon
 * and a Flaming Sphere are entries in `Combatant.summons`, a position and a
 * kind, animated by `activateSummons` on the caster's turn. That is the right
 * shape for a floating hammer and the wrong shape for a snake: a snake has hit
 * points, an AC, a stat block, its own place in the initiative order, and can
 * be killed. It is a combatant, so it is built as one.
 *
 * THREE THINGS MAKE THIS SAFE, and each of them is a way it went wrong first.
 *
 * It does not decide the fight. `checkWinner` skips anything with `summonedBy`
 * set: a party face-down on the floor has lost even if its snake is up, and
 * counting one would hang the game exactly the way the both-sides-down case
 * used to.
 *
 * It acts on its own. The SRD lets you command it, and a per-combatant control
 * flag would mean a fifth character sheet on a phone screen for a creature
 * whose whole job is "bite the nearest thing". `actsOnItsOwn` marks it, and the
 * frontend runs the same AI over it that it runs over the monsters.
 *
 * It never reaches the campaign. A summon in a survivor list would be read back
 * into the party roster, and the arena would carry a snake between waves
 * forever. `livingParty` is the filter every boundary uses.
 */
import type { GameState, Combatant, Id, Position, TeamId } from '../types.js';
import type { GameEvent } from '../events.js';
import { cellAt } from '../types.js';
import { buildMonster } from '../../data/monsters.js';
import { blocksMovement } from '../grid.js';

/**
 * Does this creature run itself?
 *
 * True for conjured allies. The frontend ORs this with its own "is this team
 * played by the computer" test, so a summoned snake on the player's side is
 * driven by the AI while the player's own characters are not.
 */
export function actsOnItsOwn(c: Combatant): boolean {
  return c.summonedBy !== undefined;
}

/**
 * The combatants that count as a side's real roster — everything it brought,
 * and nothing it conjured. Used wherever a fight's survivors flow back into
 * something persistent.
 */
export function livingParty(state: GameState, team: TeamId): Combatant[] {
  return Object.values(state.combatants).filter((c) => c.team === team && !actsOnItsOwn(c));
}

/** The nearest unoccupied, walkable cell to `at`, searched outward. */
function freeCellNear(state: GameState, at: Position): Position | undefined {
  const { width, height } = state.grid;
  for (let r = 0; r <= Math.max(width, height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Only the ring at radius r, so nearer cells are always tried first.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const p = { x: at.x + dx, y: at.y + dy };
        if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
        const cell = cellAt(state.grid, p);
        if (!cell || cell.occupantId !== undefined || blocksMovement(cell.terrain)) continue;
        return p;
      }
    }
  }
  return undefined;
}

export interface SummonOptions {
  monsterId: Id;
  summonerId: Id;
  /** Where it wants to appear; the nearest free cell to this is used. */
  near: Position;
  /** Id prefix, so two snakes from one staff do not collide. */
  idHint?: string;
  /**
   * Which of a batch this is. Animate Objects conjures one object per point of
   * the caster's spellcasting modifier, all in the same round — and the id was
   * `${hint}-${summoner}-${round}`, with a guard that silently dropped a
   * duplicate. Three of four objects would simply never have appeared.
   */
  index?: number;
  /** The spell that made it, so concentration can end exactly these. */
  spellId?: Id;
  /**
   * Fields written over the stat block after it is built.
   *
   * Find Steed's steed is the reason: the SRD gives it AC 10 + the spell's
   * level and 5 + 10 hit points per spell level, so one stat block has to cover
   * every slot it can be cast from. Writing a second monster entry per slot
   * level would be four copies of one creature that drift.
   */
  patch?: Partial<Combatant>;
}

/**
 * Put a conjured creature on the board, in initiative, ready to act.
 *
 * It takes its turn immediately after its summoner, which is what the SRD means
 * by "shares your Initiative count" and is also the only insertion point that
 * needs no arithmetic on `turnIndex`: the summoner is by definition the current
 * turn, so inserting at `turnIndex + 1` cannot move the index.
 *
 * Returns no events if there is nowhere to put it — a creature that cannot be
 * placed simply is not summoned, rather than being dropped inside a wall.
 */
export function summonCombatant(state: GameState, opts: SummonOptions): GameEvent[] {
  const summoner = state.combatants[opts.summonerId];
  if (!summoner) return [];
  const spot = freeCellNear(state, opts.near);
  if (!spot) return [];

  const suffix = opts.index === undefined ? '' : `-${opts.index}`;
  const id = `${opts.idHint ?? opts.monsterId}-${opts.summonerId}-${state.round}${suffix}`;
  if (state.combatants[id]) return [];   // already out; one at a time

  const beast: Combatant = {
    ...buildMonster(opts.monsterId, summoner.team, spot),
    ...(opts.patch ?? {}),
    // AFTER the patch, never before: these four are what make it a summon
    // rather than a party member, and a patch that overwrote `summonedBy`
    // would put a conjured creature into the win check and the campaign roster
    // with nothing to catch it.
    id,
    summonedBy: opts.summonerId,
    ...(opts.spellId ? { summonSpell: opts.spellId } : {}),
    position: spot,
    team: summoner.team,
  };
  state.combatants[id] = beast;
  const cell = cellAt(state.grid, spot);
  if (cell) cell.occupantId = id;

  // Straight after its summoner. Anywhere else and the index maths matters.
  const at = state.initiativeOrder.indexOf(opts.summonerId);
  if (at < 0) state.initiativeOrder.push(id);
  else state.initiativeOrder.splice(at + 1, 0, id);

  return [{ type: 'summoned', combatantId: id, summonerId: opts.summonerId, position: spot }];
}

/**
 * A conjurer died: everything it called up goes with it.
 *
 * Find Steed says so in as many words — "the steed disappears if it drops to 0
 * Hit Points or if you die" — and this is the DIE half. The drops-to-0 half is
 * ordinary death for the steed itself.
 *
 * Deliberately keyed on death and not on being DOWNED. A hero at 0 hit points
 * in this game is unconscious and comes back the moment anything heals them, so
 * a steed that vanished then would vanish at exactly the moment its paladin
 * most needed something standing over the body.
 *
 * General rather than per-spell: a conjured creature outliving the mind that
 * conjured it is strange in every case. The only other summoner in the game is
 * the Staff of the Python, whose snake now goes the same way.
 */
export function dismissSummonedBy(state: GameState, summonerId: Id): GameEvent[] {
  const events: GameEvent[] = [];
  for (const [id, c] of Object.entries(state.combatants)) {
    if (c.summonedBy !== summonerId) continue;
    const cell = cellAt(state.grid, c.position);
    if (cell?.occupantId === id) delete cell.occupantId;
    delete state.combatants[id];
    state.initiativeOrder = state.initiativeOrder.filter((x) => x !== id);
    events.push({ type: 'summonExpired', casterId: summonerId, kind: c.classId, position: { ...c.position } });
  }
  return events;
}

/**
 * A concentration-held summon ends with the concentration.
 *
 * Scoped to the SPELL and not merely the caster, which is the whole reason
 * `summonSpell` exists: Summon Dragon and Animate Objects end when the caster's
 * mind wanders, and Find Steed does not. Sweeping by caster alone would make a
 * wizard's broken Fireball concentration dismiss a paladin's horse.
 */
export function dismissSummonsOfSpell(state: GameState, summonerId: Id, spellId: Id): GameEvent[] {
  const events: GameEvent[] = [];
  for (const [id, c] of Object.entries(state.combatants)) {
    if (c.summonedBy !== summonerId || c.summonSpell !== spellId) continue;
    const cell = cellAt(state.grid, c.position);
    if (cell?.occupantId === id) delete cell.occupantId;
    delete state.combatants[id];
    state.initiativeOrder = state.initiativeOrder.filter((x) => x !== id);
    events.push({ type: 'summonExpired', casterId: summonerId, kind: c.classId, position: { ...c.position } });
  }
  return events;
}
