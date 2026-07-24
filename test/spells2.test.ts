import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { webCell } from '../src/engine/grid.js';
import { breakConcentration } from '../src/engine/rules/attack.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id, ...over });
const foe = (monsterId: string, position: Position, id: string): Combatant =>
  ({ ...buildMonster(monsterId, 'team2', position), id });

function until(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 40) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe(id);
}

describe('Healing Word', () => {
  it('heals an ally at range as a bonus action', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        pc('cleric', 1, { x: 1, y: 1 }, 'clr'),
        pc('fighter', 1, { x: 5, y: 1 }, 'ally', { hp: 3 }),
        foe('goblin-warrior', { x: 7, y: 7 }, 'g'),
      ],
    });
    until(c, 'clr');
    const events = c.apply({ kind: 'castSpell', spellId: 'healing-word', slotLevel: 1, targets: [{ combatantId: 'ally' }] });
    expect(events.some((e) => e.type === 'healed')).toBe(true);
    expect(c.state.combatants['ally']!.hp).toBeGreaterThan(3);
    expect(c.state.combatants['clr']!.turn.bonusActionUsed).toBe(true);
  });
});

describe('Suggestion', () => {
  it('removes a humanoid from the fight on a failed Wisdom save', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('wizard', 3, { x: 2, y: 2 }, 'wiz'), foe('bandit', { x: 4, y: 2 }, 'b')],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'suggestion', slotLevel: 2, targets: [{ combatantId: 'b' }] });
      if (!events.some((e) => e.type === 'charmedAway')) continue;
      expect(c.state.combatants['b']!.alive).toBe(false); // out of the fight, not dead
      return;
    }
    throw new Error('bandit never failed the save across 40 seeds');
  });

  it('cannot target a non-humanoid (a beast)', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('wizard', 3, { x: 2, y: 2 }, 'wiz'), foe('wolf', { x: 4, y: 2 }, 'w')],
    });
    until(c, 'wiz');
    const suggestion = c.legalActions().filter((a) => a.kind === 'castSpell' && a.spellId === 'suggestion');
    expect(suggestion).toHaveLength(0); // wolf is a beast; no valid target
  });
});

describe('Command', () => {
  it('makes a humanoid grovel: prone and no actions on its next turn', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('cleric', 1, { x: 1, y: 1 }, 'clr'), foe('goblin-warrior', { x: 5, y: 5 }, 'gob')],
      });
      until(c, 'clr');
      const events = c.apply({ kind: 'castSpell', spellId: 'command', slotLevel: 1, targets: [{ combatantId: 'gob' }] });
      if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'commanded')) continue;
      until(c, 'gob');
      const g = c.state.combatants['gob']!;
      expect(g.conditions.some((k) => k.id === 'prone')).toBe(true);
      const kinds = new Set(c.legalActions().map((a) => a.kind));
      expect(kinds.has('attack')).toBe(false);
      expect(kinds.has('move')).toBe(false);
      // The command clears after the stolen turn.
      c.apply({ kind: 'endTurn' });
      expect(c.state.combatants['gob']!.conditions.some((k) => k.id === 'commanded')).toBe(false);
      return;
    }
    throw new Error('goblin never failed the Command save across 40 seeds');
  });
});

describe('Web', () => {
  it('restrains enemies in the area — speed 0 and easier to hit', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          pc('wizard', 3, { x: 1, y: 1 }, 'wiz'),
          foe('goblin-warrior', { x: 5, y: 5 }, 'g1'),
          foe('goblin-warrior', { x: 6, y: 5 }, 'g2'),
        ],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'web', slotLevel: 2, targets: [{ position: { x: 5, y: 5 } }] });
      const stuck = events.find((e) => e.type === 'conditionApplied' && e.condition === 'restrained');
      if (!stuck || stuck.type !== 'conditionApplied') continue;
      const gid = stuck.combatantId;
      expect(c.state.combatants['wiz']!.concentratingOn?.spellId).toBe('web');
      until(c, gid);
      expect(c.state.combatants[gid]!.turn.movementMax).toBe(0); // can't move
      return;
    }
    throw new Error('no goblin was ever webbed across 40 seeds');
  });

  it('the web lingers on the grid and clears when concentration drops', () => {
    const c = new Combat({
      seed: 7,
      combatants: [
        pc('wizard', 5, { x: 1, y: 1 }, 'wiz'),
        foe('goblin-warrior', { x: 5, y: 5 }, 'gob'),
      ],
    });
    until(c, 'wiz');
    const cast = c.apply({ kind: 'castSpell', spellId: 'web', slotLevel: 2, targets: [{ position: { x: 5, y: 5 } }] });
    expect(cast.some((e) => e.type === 'webSpun')).toBe(true);
    expect(c.state.grid.cells.filter((cell) => cell.web?.sourceId === 'wiz').length).toBeGreaterThan(0);
    // Concentration is held so the strands persist (even if the save was made).
    expect(c.state.combatants['wiz']!.concentratingOn?.spellId).toBe('web');

    // Dropping the caster's concentration (damage, a new spell, death) sweeps
    // the strands off the grid.
    const evs = breakConcentration(c.state, 'wiz');
    expect(evs.some((e) => e.type === 'webCleared')).toBe(true);
    expect(c.state.grid.cells.some((cell) => cell.web?.sourceId === 'wiz')).toBe(false);
    expect(c.state.combatants['wiz']!.concentratingOn).toBeUndefined();
  });

  it('walking into lingering strands forces a save, restrains, and stops the mover', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        pc('wizard', 8, { x: 0, y: 0 }, 'wiz'),         // high Web DC
        foe('goblin-warrior', { x: 6, y: 2 }, 'gob'),
      ],
    });
    // Lay strands across the goblin's approach lane (as a lingering web would),
    // held by the wizard's concentration.
    for (let x = 2; x <= 4; x++) webCell(c.state.grid, { x, y: 2 }, 'wiz', 25);
    c.state.combatants['wiz']!.concentratingOn = { spellId: 'web', targetIds: [] };

    until(c, 'gob');
    // The goblin advances toward the party and hits the strands at (4,2).
    const into = c.legalActions().find((a) => a.kind === 'move' && a.to.x === 4 && a.to.y === 2);
    expect(into, 'a move into the webbed lane should exist').toBeDefined();
    const ev = c.apply(into!);
    expect(ev.some((e) => e.type === 'savingThrow')).toBe(true);
    const gob = c.state.combatants['gob']!;
    expect(gob.conditions.some((k) => k.id === 'restrained')).toBe(true);
    // Caught on entry: it stops in the strands rather than walking on past them.
    expect(gob.position).toEqual({ x: 4, y: 2 });
  });
});

describe('Shield (autocast reaction)', () => {
  it('turns a would-be hit into a miss, spending a slot and the reaction', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const c = new Combat({
        seed,
        combatants: [foe('goblin-warrior', { x: 3, y: 3 }, 'gob'), pc('wizard', 1, { x: 4, y: 3 }, 'wiz')],
      });
      until(c, 'gob');
      const slotsBefore = c.state.combatants['wiz']!.spellSlots[0]!.current;
      const events = c.apply({ kind: 'attack', weaponId: 'goblin-scimitar', targetId: 'wiz' });
      if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'shielded')) continue;
      const roll = events.find((e) => e.type === 'attackRolled')!;
      if (roll.type !== 'attackRolled') throw new Error();
      expect(roll.hit).toBe(false); // shielded away
      expect(c.state.combatants['wiz']!.spellSlots[0]!.current).toBe(slotsBefore - 1);
      expect(c.state.combatants['wiz']!.turn.reactionUsed).toBe(true);
      return;
    }
    throw new Error('no attack ever fell in the Shield window across 80 seeds');
  });

  it('blocks Magic Missile entirely', () => {
    const c = new Combat({
      seed: 3,
      combatants: [pc('wizard', 3, { x: 1, y: 1 }, 'caster'), pc('wizard', 1, { x: 5, y: 1 }, 'target')],
    });
    // Make them enemies so Magic Missile can target the defender.
    c.state.combatants['target']!.team = 'team2';
    until(c, 'caster');
    const hpBefore = c.state.combatants['target']!.hp;
    const events = c.apply({
      kind: 'castSpell', spellId: 'magic-missile', slotLevel: 1,
      targets: [{ combatantId: 'target' }, { combatantId: 'target' }, { combatantId: 'target' }],
    });
    expect(events.some((e) => e.type === 'conditionApplied' && e.condition === 'shielded')).toBe(true);
    expect(events.some((e) => e.type === 'damageDealt')).toBe(false); // all darts blocked
    expect(c.state.combatants['target']!.hp).toBe(hpBefore);
  });
});

describe('Spiritual Weapon', () => {
  it('conjures a roaming hammer: placed beside a foe it strikes at once, then acts by itself', () => {
    const c = new Combat({
      seed: 3,
      combatants: [pc('cleric', 3, { x: 3, y: 3 }, 'clr'), foe('goblin-warrior', { x: 5, y: 3 }, 'gob')],
    });
    until(c, 'clr');
    const slotsBefore = c.state.combatants['clr']!.spellSlots[1]!.current;
    // Place the hammer next to the goblin: it appears and bonks immediately.
    const events = c.apply({ kind: 'castSpell', spellId: 'spiritual-weapon', slotLevel: 2, targets: [{ position: { x: 4, y: 3 } }] });
    expect(events.some((e) => e.type === 'summonPlaced')).toBe(true);
    expect(events.some((e) => e.type === 'attackRolled')).toBe(true);
    expect(c.state.combatants['clr']!.summons?.[0]).toMatchObject({ kind: 'spiritual-weapon', position: { x: 4, y: 3 } });
    expect(c.state.combatants['clr']!.spellSlots[1]!.current).toBe(slotsBefore - 1);
    expect(c.state.combatants['clr']!.turn.bonusActionUsed).toBe(true);

    // Back around to the cleric: the hammer attacks again ON ITS OWN — no
    // action from the caster, no free-recast entry in the action list.
    c.apply({ kind: 'endTurn' });
    let startEvents: typeof events = [];
    while (c.activeId !== 'clr') startEvents = c.apply({ kind: 'endTurn' });
    expect(startEvents.some((e) => e.type === 'attackRolled' && e.attackerId === 'clr')).toBe(true);
    expect(c.legalActions().some((a) => a.kind === 'castSpell' && a.spellId === 'spiritual-weapon' && a.slotLevel === 0)).toBe(false);
  });

  it('the hammer chases: it glides toward the nearest enemy at the start of each turn', () => {
    const c = new Combat({
      seed: 4,
      combatants: [pc('cleric', 3, { x: 0, y: 0 }, 'clr'), foe('skeleton', { x: 7, y: 7 }, 'sk')],
    });
    until(c, 'clr');
    // Place it far from the skeleton so it must travel.
    c.apply({ kind: 'castSpell', spellId: 'spiritual-weapon', slotLevel: 2, targets: [{ position: { x: 1, y: 1 } }] });
    c.apply({ kind: 'endTurn' });
    let startEvents: ReturnType<typeof c.apply> = [];
    while (c.activeId !== 'clr') startEvents = c.apply({ kind: 'endTurn' });
    const moved = startEvents.find((e) => e.type === 'summonMoved');
    expect(moved).toBeDefined();
    if (moved?.type !== 'summonMoved') throw new Error();
    // 20 ft = 4 cells of chase, closing on the prey.
    const before = Math.max(Math.abs(1 - 7), Math.abs(1 - 7));
    const pos = c.state.combatants['clr']!.summons![0]!.position;
    const after = Math.max(Math.abs(pos.x - 7), Math.abs(pos.y - 7));
    expect(after).toBe(before - 4);
  });

  it('expires after its duration runs out', () => {
    const c = new Combat({
      seed: 5,
      combatants: [pc('cleric', 3, { x: 0, y: 0 }, 'clr'), foe('skeleton', { x: 7, y: 7 }, 'sk', )],
    });
    until(c, 'clr');
    c.apply({ kind: 'castSpell', spellId: 'spiritual-weapon', slotLevel: 2, targets: [{ position: { x: 1, y: 1 } }] });
    // Force the clock forward past the expiry and cycle to the cleric's turn.
    c.state.combatants['clr']!.summons![0]!.expiresAtRound = 0;
    c.apply({ kind: 'endTurn' });
    let startEvents: ReturnType<typeof c.apply> = [];
    while (c.activeId !== 'clr') startEvents = c.apply({ kind: 'endTurn' });
    expect(startEvents.some((e) => e.type === 'summonExpired')).toBe(true);
    expect(c.state.combatants['clr']!.summons ?? []).toHaveLength(0);
  });
});

describe('Flaming Sphere', () => {
  it('rolls after the nearest enemy and rams — 2d6 fire, Dex save for half — until concentration drops', () => {
    const wiz = pc('wizard', 3, { x: 0, y: 0 }, 'wiz');
    wiz.spellIds = [...wiz.spellIds, 'flaming-sphere'];
    const c = new Combat({
      seed: 6,
      combatants: [wiz, foe('skeleton', { x: 4, y: 0 }, 'sk')],
    });
    until(c, 'wiz');
    const hpBefore = c.state.combatants['sk']!.hp;
    // Cast beside the skeleton: it appears and rams immediately (save + fire).
    const events = c.apply({ kind: 'castSpell', spellId: 'flaming-sphere', slotLevel: 2, targets: [{ position: { x: 3, y: 0 } }] });
    expect(events.some((e) => e.type === 'summonPlaced')).toBe(true);
    expect(events.some((e) => e.type === 'savingThrow' && e.combatantId === 'sk')).toBe(true);
    expect(c.state.combatants['sk']!.hp).toBeLessThan(hpBefore); // 2d6, min 1 even on a save
    expect(c.state.combatants['wiz']!.concentratingOn?.spellId).toBe('flaming-sphere');

    // Concentration drops → the sphere gutters out.
    const evs = breakConcentration(c.state, 'wiz');
    expect(evs.some((e) => e.type === 'summonExpired')).toBe(true);
    expect(c.state.combatants['wiz']!.summons ?? []).toHaveLength(0);
  });

  it('a physical sphere is stopped by walls; the spectral hammer is not', () => {
    // The corridor map has interior walls to test against — but simpler: park
    // both kinds against a wall cell and step them by activation.
    const wiz = pc('wizard', 3, { x: 0, y: 0 }, 'wiz');
    wiz.spellIds = [...wiz.spellIds, 'flaming-sphere'];
    const c = new Combat({
      seed: 7, mapId: 'ruins',
      combatants: [wiz, foe('skeleton', { x: 4, y: 4 }, 'sk')],
    });
    // Ruins has walls at (2,y) columns per its ASCII; place summons directly.
    c.state.combatants['wiz']!.summons = [
      { kind: 'spiritual-weapon', position: { x: 1, y: 5 }, expiresAtRound: 99 },
      { kind: 'flaming-sphere', position: { x: 1, y: 3 } },
    ];
    c.state.combatants['wiz']!.concentratingOn = { spellId: 'flaming-sphere', targetIds: [] };
    until(c, 'wiz');
    // Both moved (or tried): neither may stand ON a wall cell.
    for (const s of c.state.combatants['wiz']!.summons!) {
      const cell = c.state.grid.cells[s.position.y * c.state.grid.width + s.position.x]!;
      expect(cell.terrain === 'wall' && s.kind === 'flaming-sphere').toBe(false);
    }
  });
});

describe('Spiritual Guardians', () => {
  it('damages an enemy that starts its turn in the aura, and the aura ends with concentration', () => {
    const c = new Combat({
      seed: 2,
      combatants: [pc('cleric', 5, { x: 3, y: 3 }, 'clr'), foe('goblin-warrior', { x: 4, y: 3 }, 'gob')],
    });
    until(c, 'clr');
    c.apply({ kind: 'castSpell', spellId: 'spiritual-guardians', slotLevel: 3, targets: [] });
    expect(c.state.combatants['clr']!.spiritualGuardians).toBeDefined();
    expect(c.state.combatants['clr']!.concentratingOn?.spellId).toBe('spiritual-guardians');
    const hpBefore = c.state.combatants['gob']!.hp;
    const events = c.apply({ kind: 'endTurn' }); // goblin's turn starts inside the aura
    expect(events.some((e) => e.type === 'damageDealt' && e.damageType === 'radiant')).toBe(true);
    expect(c.state.combatants['gob']!.hp).toBeLessThan(hpBefore);
  });
});

describe('Lightning Bolt', () => {
  it('strikes every creature along the line, but not off it', () => {
    const c = new Combat({
      seed: 4,
      combatants: [
        pc('wizard', 5, { x: 0, y: 3 }, 'wiz'),
        foe('ogre', { x: 3, y: 3 }, 'on1'),  // on the eastward line
        foe('ogre', { x: 5, y: 3 }, 'on2'),  // further along the line
        foe('ogre', { x: 3, y: 5 }, 'off'),  // off the line
      ],
    });
    until(c, 'wiz');
    const events = c.apply({ kind: 'castSpell', spellId: 'lightning-bolt', slotLevel: 3, targets: [{ position: { x: 1, y: 3 } }] });
    const hurt = new Set(events.filter((e) => e.type === 'damageDealt').map((e) => e.type === 'damageDealt' && e.targetId));
    expect(hurt.has('on1')).toBe(true);
    expect(hurt.has('on2')).toBe(true);
    expect(hurt.has('off')).toBe(false);
  });
});

describe('Fear', () => {
  it('frightens enemies in the cone so they attack at disadvantage', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('wizard', 5, { x: 3, y: 3 }, 'wiz'), foe('goblin-warrior', { x: 3, y: 4 }, 'gob')],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'fear', slotLevel: 3, targets: [{ position: { x: 3, y: 4 } }] });
      if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'frightened')) continue;
      until(c, 'gob');
      const swing = c.apply({ kind: 'attack', weaponId: 'goblin-scimitar', targetId: 'wiz' });
      const roll = swing.find((e) => e.type === 'attackRolled')!;
      if (roll.type !== 'attackRolled') throw new Error();
      expect(roll.disSources).toContain('attacker frightened');
      return;
    }
    throw new Error('goblin never got frightened across 40 seeds');
  });
});
