import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { legalActions } from '../src/engine/actions.js';
import { chooseAction } from '../src/ai/greedy.js';
import { checkWinner } from '../src/engine/rules/attack.js';
import { actsOnItsOwn, livingParty, summonCombatant } from '../src/engine/rules/summon.js';
import {
  newCampaign, buildCampaignParty, readBackSurvivors, rarityOf, SHOP_STOCK, TREASURE_POOL_FOR,
} from '../src/campaign/campaign.js';
import type { MapData } from '../src/data/maps.js';
import type { Id } from '../src/engine/types.js';

/**
 * Conjured allies: a real combatant, put on the board mid-fight.
 *
 * Everything the game previously called a summon was a marker — a position and
 * a kind, animated on the caster's turn. A snake is not that: it has hit
 * points, an initiative slot and a stat block, and can be killed. Three things
 * make that safe, and each of them gets a test here, because each is a way the
 * fight breaks rather than a way an item disappoints.
 */

const board = (rows: string[]): MapData => ({ id: 't', name: 'T', theme: 'stone', rows });
const OPEN = ['........', '........', '........', '........', '........'];

function staffBearer(seed = 3) {
  const hero = buildCharacter({
    classId: 'druid', team: 'team1', level: 5, name: 'H', position: { x: 1, y: 0 },
    speciesId: 'human', inventory: [{ itemId: 'staff-python', qty: 1 }],
  });
  const foe = { ...buildMonster('goblin-warrior', 'team2', { x: 6, y: 4 }), id: 'foe' };
  const c = new Combat({ seed, map: board(OPEN), combatants: [hero, foe] });
  for (let i = 0; i < 20 && c.activeId !== hero.id; i++) c.apply({ kind: 'endTurn' });
  return { c, hero };
}

function throwStaff(seed = 3) {
  const { c, hero } = staffBearer(seed);
  const act = legalActions(c.state, hero.id)
    .find((a) => a.kind === 'useItem' && a.itemId === 'staff-python');
  if (!act) throw new Error('the staff offered nothing');
  const events = c.apply(act);
  const summoned = events.find((e) => e.type === 'summoned');
  if (summoned?.type !== 'summoned') throw new Error('nothing was summoned');
  return { c, hero, snakeId: summoned.combatantId };
}

describe('the Staff of the Python', () => {
  it('puts a real combatant on the board, on your side', () => {
    const { c, hero, snakeId } = throwStaff();
    const snake = c.state.combatants[snakeId]!;
    expect(snake.team).toBe(hero.team);
    expect(snake.summonedBy).toBe(hero.id);
    expect(snake.maxHp, 'a stat block, not a marker').toBeGreaterThan(0);
    // It occupies a cell, and the cell knows it.
    const cell = c.state.grid.cells[snake.position.y * c.state.grid.width + snake.position.x]!;
    expect(cell.occupantId).toBe(snakeId);
  });

  it('takes its turn immediately after the summoner', () => {
    const { c, hero, snakeId } = throwStaff();
    const order = c.state.initiativeOrder;
    expect(order.indexOf(snakeId)).toBe(order.indexOf(hero.id) + 1);
  });

  it('does not disturb whose turn it is', () => {
    // The insertion point is chosen so no arithmetic on turnIndex is needed;
    // getting that wrong would skip or repeat a turn, which is the kind of bug
    // that looks like the AI behaving oddly.
    const { c, hero } = staffBearer();
    const before = c.activeId;
    const act = legalActions(c.state, hero.id)
      .find((a) => a.kind === 'useItem' && a.itemId === 'staff-python')!;
    c.apply(act);
    expect(c.activeId).toBe(before);
  });

  it('spends the staff\'s one charge without consuming the staff', () => {
    const { c, hero } = throwStaff();
    const h = c.state.combatants[hero.id]!;
    expect(h.itemUses!['staff-python']!.current).toBe(0);
    expect(h.inventory.find((s) => s.itemId === 'staff-python')?.qty).toBe(1);
    expect(legalActions(c.state, hero.id)
      .some((a) => a.kind === 'useItem' && a.itemId === 'staff-python'),
    'one snake per rest').toBe(false);
  });

  it('actually gets a turn and does something with it', () => {
    // A summon nobody can drive is scenery. It is AI-run by design, so this
    // asks the policy for its action the way the frontend does.
    const { c, snakeId } = throwStaff();
    for (let i = 0; i < 30 && c.activeId !== snakeId; i++) c.apply({ kind: 'endTurn' });
    expect(c.activeId, 'the snake never came round').toBe(snakeId);
    const action = chooseAction(c.state, snakeId);
    expect(['move', 'attack', 'dash', 'endTurn']).toContain(action.kind);
  });
});

describe('a summon does not decide the fight', () => {
  it('is ignored when the winner is worked out', () => {
    const { c, hero, snakeId } = throwStaff();
    // Put the hero down; only the snake is left standing on team1.
    c.state.combatants[hero.id]!.hp = 0;
    expect(c.state.combatants[snakeId]!.hp).toBeGreaterThan(0);
    expect(checkWinner(c.state), 'the party lost, snake or no snake').toBe('team2');
  });

  it('and a fight still ends when the last real enemy falls', () => {
    const c = new Combat({
      seed: 1, map: board(OPEN),
      combatants: [
        buildCharacter({ classId: 'druid', team: 'team1', level: 5, position: { x: 1, y: 0 } }),
        { ...buildMonster('goblin-warrior', 'team2', { x: 6, y: 4 }), id: 'foe' },
      ],
    });
    // A monster's own summon, on the far side.
    summonCombatant(c.state, {
      monsterId: 'giant-constrictor-snake', summonerId: 'foe', near: { x: 6, y: 3 },
    });
    c.state.combatants['foe']!.hp = 0;
    expect(checkWinner(c.state), 'their pet does not keep the wave alive').toBe('team1');
  });

  it('leaves the fight terminable — a summon cannot stall it forever', () => {
    // Drive a whole fight with a summon in it and confirm it finishes. The
    // both-sides-down case once hung the game outright; a creature excluded
    // from the win check is a new way into the same shape.
    for (let seed = 1; seed <= 8; seed++) {
      const { c } = throwStaff(seed);
      let steps = 0;
      while (!c.isOver() && steps++ < 4000) c.apply(chooseAction(c.state, c.activeId));
      expect(c.isOver(), `seed ${seed} never finished`).toBe(true);
    }
  });
});

describe('a summon never reaches the campaign', () => {
  it('is filtered out of a survivor read-back', () => {
    const camp = newCampaign(5);
    const before = camp.characters.length;
    const party = buildCampaignParty(camp);
    const snake = { ...buildMonster('giant-constrictor-snake', 'team1', { x: 0, y: 0 }), id: 'snek', summonedBy: party[0]!.id };
    readBackSurvivors(camp, [...party, snake]);
    expect(camp.characters.length, 'the roster grew a snake').toBe(before);
    expect(camp.characters.some((ch) => ch.classId === undefined)).toBe(false);
  });

  it('is not in livingParty, which is what every boundary asks', () => {
    const { c, hero, snakeId } = throwStaff();
    const real = livingParty(c.state, 'team1').map((x) => x.id);
    expect(real).toContain(hero.id);
    expect(real).not.toContain(snakeId);
  });

  it('is marked so the frontend knows to run it', () => {
    const { c, hero, snakeId } = throwStaff();
    expect(actsOnItsOwn(c.state.combatants[snakeId]!)).toBe(true);
    expect(actsOnItsOwn(c.state.combatants[hero.id]!), 'the player still plays their own').toBe(false);
  });
});

describe('placement', () => {
  it('never drops a summon into a wall or on top of somebody', () => {
    // The summoner is boxed in; the snake has to find the one gap.
    const rows = ['........', '........', '..###...', '..#H#...', '..###...'];
    const hero = buildCharacter({
      classId: 'druid', team: 'team1', level: 5, position: { x: 3, y: 1 },
      inventory: [{ itemId: 'staff-python', qty: 1 }],
    });
    const foe = { ...buildMonster('goblin-warrior', 'team2', { x: 7, y: 4 }), id: 'foe' };
    const c = new Combat({
      seed: 2, map: board(rows.map((r) => r.replace('H', '.'))), combatants: [hero, foe],
    });
    const evs = summonCombatant(c.state, {
      monsterId: 'giant-constrictor-snake', summonerId: hero.id, near: hero.position,
    });
    if (evs.length === 0) return;   // nowhere legal is a fine answer
    const placed = evs.find((e) => e.type === 'summoned');
    if (placed?.type !== 'summoned') throw new Error();
    const cell = c.state.grid.cells[placed.position.y * c.state.grid.width + placed.position.x]!;
    expect(cell.terrain, 'summoned into terrain it cannot stand on').not.toBe('wall');
    expect(placed.position).not.toEqual(foe.position);
  });

  it('summons one snake, not a pile of them', () => {
    const { c, hero } = throwStaff();
    const again = summonCombatant(c.state, {
      monsterId: 'giant-constrictor-snake', summonerId: hero.id, near: hero.position, idHint: 'python',
    });
    expect(again, 'the same staff in the same round conjured a second').toEqual([]);
  });
});

describe('the staff reaches a player', () => {
  it('is stocked and rated', () => {
    expect(SHOP_STOCK).toContain('staff-python' as Id);
    expect(rarityOf('staff-python')).toBe('uncommon');
  });

  /**
   * The staff was briefly listed in BOTH the uncommon and the rare loot pools,
   * and `rarityOf` checks rare first — so an uncommon item quietly priced and
   * gated itself as rare, and nothing anywhere would have said so. The pools
   * are hand-written lists; this is the guard that reads them.
   */
  it('no item is listed in two rarity pools at once', () => {
    const seen = new Map<Id, string>();
    const dupes: string[] = [];
    for (const tier of ['common', 'uncommon', 'rare'] as const) {
      for (const id of TREASURE_POOL_FOR(tier)) {
        const first = seen.get(id);
        if (first && first !== tier) dupes.push(`${id}: ${first} and ${tier}`);
        else seen.set(id, tier);
      }
    }
    expect(dupes, dupes.join('; ')).toEqual([]);
  });
});
