import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { acOf } from '../src/data/armor.js';
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

describe('Ray of Frost', () => {
  it('deals cold damage and slows the target on a hit', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('wizard', 1, { x: 1, y: 1 }, 'wiz'), foe('goblin-warrior', { x: 5, y: 1 }, 'gob')],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'ray-of-frost', slotLevel: 0, targets: [{ combatantId: 'gob' }] });
      if (!events.some((e) => e.type === 'damageDealt' && e.damageType === 'cold')) continue;
      expect(events.some((e) => e.type === 'conditionApplied' && e.condition === 'slowed')).toBe(true);
      until(c, 'gob');
      // Speed 30 - 10 = 20, but Slow already cleared by the time we can read
      // movementMax post-startTurn — check it was reduced from the base 30.
      expect(c.state.combatants['gob']!.turn.movementMax).toBe(20);
      return;
    }
    throw new Error('ray of frost never hit across 40 seeds');
  });
});

describe('Acid Splash', () => {
  it('damages enemies in the area on a failed save, spares allies', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          pc('wizard', 1, { x: 1, y: 1 }, 'wiz'),
          foe('goblin-warrior', { x: 5, y: 5 }, 'g1'),
          foe('goblin-warrior', { x: 6, y: 5 }, 'g2'),
        ],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'acid-splash', slotLevel: 0, targets: [{ position: { x: 5, y: 5 } }] });
      if (!events.some((e) => e.type === 'damageDealt' && e.damageType === 'acid')) continue;
      expect(events.some((e) => e.type === 'damageDealt' && e.targetId === 'wiz')).toBe(false);
      return;
    }
    throw new Error('acid splash never hit across 40 seeds');
  });
});

describe('Color Spray', () => {
  it('blinds enemies in the cone for one turn, self-clearing without a save', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('wizard', 1, { x: 3, y: 3 }, 'wiz'), foe('goblin-warrior', { x: 3, y: 4 }, 'gob')],
      });
      until(c, 'wiz');
      const events = c.apply({ kind: 'castSpell', spellId: 'color-spray', slotLevel: 1, targets: [{ position: { x: 3, y: 4 } }] });
      if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'blinded')) continue;
      const cond = c.state.combatants['gob']!.conditions.find((k) => k.id === 'blinded')!;
      expect(cond.repeatSave).toBeUndefined(); // fixed duration, not save-ends
      until(c, 'gob'); // goblin's own next turn clears it, no save needed
      expect(c.state.combatants['gob']!.conditions.some((k) => k.id === 'blinded')).toBe(false);
      return;
    }
    throw new Error('color spray never blinded anyone across 40 seeds');
  });
});

describe('Blindness', () => {
  it('blinds with a repeat save — distinct from Color Spray\'s fixed duration', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('cleric', 3, { x: 1, y: 1 }, 'clr'), foe('goblin-warrior', { x: 5, y: 5 }, 'gob')],
      });
      until(c, 'clr');
      const events = c.apply({ kind: 'castSpell', spellId: 'blindness', slotLevel: 2, targets: [{ combatantId: 'gob' }] });
      if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'blinded')) continue;
      const cond = c.state.combatants['gob']!.conditions.find((k) => k.id === 'blinded')!;
      expect(cond.repeatSave).toBeDefined();
      return;
    }
    throw new Error('blindness never landed across 60 seeds');
  });
});

describe('False Life', () => {
  it('grants temp HP that does not stack below what is already there', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('wizard', 1, { x: 1, y: 1 }, 'wiz'), foe('goblin-warrior', { x: 7, y: 7 }, 'gob')],
    });
    until(c, 'wiz');
    c.apply({ kind: 'castSpell', spellId: 'false-life', slotLevel: 1, targets: [] });
    const first = c.state.combatants['wiz']!.tempHp!;
    expect(first).toBeGreaterThanOrEqual(5); // 1d4+4, min 5
    c.state.combatants['wiz']!.tempHp = 999; // simulate already having more
    c.state.combatants['wiz']!.turn.actionUsed = false; // re-arm the action for a second cast
    c.apply({ kind: 'castSpell', spellId: 'false-life', slotLevel: 1, targets: [] });
    expect(c.state.combatants['wiz']!.tempHp).toBe(999); // unchanged — didn't stack down
  });
});

describe('Inflict Wounds', () => {
  it('is a melee spell attack dealing necrotic damage', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('cleric', 1, { x: 3, y: 3 }, 'clr'), foe('goblin-warrior', { x: 4, y: 3 }, 'gob')],
      });
      until(c, 'clr');
      const events = c.apply({ kind: 'castSpell', spellId: 'inflict-wounds', slotLevel: 1, targets: [{ combatantId: 'gob' }] });
      const dmg = events.find((e) => e.type === 'damageDealt');
      if (!dmg) continue;
      expect(dmg.type === 'damageDealt' && dmg.damageType).toBe('necrotic');
      return;
    }
    throw new Error('inflict wounds never hit across 40 seeds');
  });
});

describe('Invisibility', () => {
  it('grants hidden that only ends when the target attacks or casts', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('wizard', 3, { x: 1, y: 1 }, 'wiz'), pc('fighter', 3, { x: 2, y: 1 }, 'ftr'), foe('goblin-warrior', { x: 7, y: 7 }, 'gob')],
    });
    until(c, 'wiz');
    const events = c.apply({ kind: 'castSpell', spellId: 'invisibility', slotLevel: 2, targets: [{ combatantId: 'ftr' }] });
    expect(events.some((e) => e.type === 'conditionApplied' && e.condition === 'hidden')).toBe(true);
    expect(c.state.combatants['ftr']!.conditions.find((k) => k.id === 'hidden')!.hideCheck).toBeUndefined();
    expect(c.state.combatants['wiz']!.concentratingOn?.spellId).toBe('invisibility');

    until(c, 'ftr');
    c.apply({ kind: 'move', to: { x: 6, y: 7 } });
    c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'gob' });
    expect(c.state.combatants['ftr']!.conditions.some((k) => k.id === 'hidden')).toBe(false);
  });
});

describe('Lesser Restoration', () => {
  it('removes a curable condition from an ally', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('cleric', 3, { x: 1, y: 1 }, 'clr'), pc('fighter', 3, { x: 1, y: 2 }, 'ftr'), foe('goblin-warrior', { x: 7, y: 7 }, 'gob')],
    });
    c.state.combatants['ftr']!.conditions.push({ id: 'poisoned', sourceId: 'gob' });
    until(c, 'clr');
    const events = c.apply({ kind: 'castSpell', spellId: 'lesser-restoration', slotLevel: 2, targets: [{ combatantId: 'ftr' }] });
    expect(events.some((e) => e.type === 'conditionRemoved' && e.condition === 'poisoned')).toBe(true);
    expect(c.state.combatants['ftr']!.conditions.some((k) => k.id === 'poisoned')).toBe(false);
  });

  it('does nothing (and no error) if the target has no curable condition', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('cleric', 3, { x: 1, y: 1 }, 'clr'), pc('fighter', 3, { x: 1, y: 2 }, 'ftr'), foe('goblin-warrior', { x: 7, y: 7 }, 'gob')],
    });
    until(c, 'clr');
    const events = c.apply({ kind: 'castSpell', spellId: 'lesser-restoration', slotLevel: 2, targets: [{ combatantId: 'ftr' }] });
    expect(events.filter((e) => e.type === 'conditionRemoved')).toHaveLength(0);
  });
});

describe('Dispel Magic', () => {
  it('frees an ally from an enemy concentration effect (Web)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          pc('cleric', 5, { x: 0, y: 0 }, 'clr'),
          pc('fighter', 5, { x: 5, y: 5 }, 'ftr'),
          foe('goblin-warrior', { x: 1, y: 0 }, 'gob'),
        ],
      });
      c.state.combatants['ftr']!.conditions.push({
        id: 'restrained', sourceId: 'gob', concentration: true, repeatSave: { ability: 'dex', dc: 20 },
      });
      c.state.combatants['gob']!.concentratingOn = { spellId: 'web', targetIds: ['ftr'] };
      until(c, 'clr');
      const events = c.apply({ kind: 'castSpell', spellId: 'dispel-magic', slotLevel: 3, targets: [{ combatantId: 'ftr' }] });
      expect(events.some((e) => e.type === 'conditionRemoved' && e.condition === 'restrained')).toBe(true);
      expect(c.state.combatants['ftr']!.conditions.some((k) => k.id === 'restrained')).toBe(false);
      return;
    }
  });

  it('ends an enemy caster\'s concentration when targeted directly', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('wizard', 5, { x: 0, y: 0 }, 'wiz'), foe('cult-fanatic', { x: 7, y: 7 }, 'cf')],
    });
    c.state.combatants['cf']!.concentratingOn = { spellId: 'bless', targetIds: [] };
    until(c, 'wiz');
    const events = c.apply({ kind: 'castSpell', spellId: 'dispel-magic', slotLevel: 3, targets: [{ combatantId: 'cf' }] });
    expect(events.some((e) => e.type === 'concentrationBroken')).toBe(true);
    expect(c.state.combatants['cf']!.concentratingOn).toBeUndefined();
  });
});

describe('Bane', () => {
  it('applies baned (save-ends analog via concentration) to enemies on a failed save', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = new Combat({
        seed,
        combatants: [pc('cleric', 1, { x: 1, y: 1 }, 'clr'), foe('goblin-warrior', { x: 3, y: 1 }, 'gob')],
      });
      until(c, 'clr');
      const events = c.apply({ kind: 'castSpell', spellId: 'bane', slotLevel: 1, targets: [{ combatantId: 'gob' }] });
      if (!events.some((e) => e.type === 'conditionApplied' && e.condition === 'baned')) continue;
      expect(c.state.combatants['clr']!.concentratingOn?.spellId).toBe('bane');
      return;
    }
    throw new Error('bane never landed across 40 seeds');
  });
});

describe('Shield of Faith', () => {
  it('grants +2 AC as a bonus action', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('cleric', 1, { x: 1, y: 1 }, 'clr'), pc('fighter', 1, { x: 1, y: 2 }, 'ftr'), foe('goblin-warrior', { x: 7, y: 7 }, 'gob')],
    });
    until(c, 'clr');
    const before = acOf(c.state.combatants['ftr']!);
    c.apply({ kind: 'castSpell', spellId: 'shield-of-faith', slotLevel: 1, targets: [{ combatantId: 'ftr' }] });
    expect(acOf(c.state.combatants['ftr']!)).toBe(before + 2);
    expect(c.state.combatants['clr']!.turn.bonusActionUsed).toBe(true);
    expect(c.state.combatants['clr']!.concentratingOn?.spellId).toBe('shield-of-faith');
  });
});

describe('Haste', () => {
  it('doubles speed, adds +2 AC, and banks one extra attack', () => {
    const c = new Combat({
      seed: 1,
      combatants: [pc('wizard', 5, { x: 1, y: 1 }, 'wiz'), pc('fighter', 5, { x: 1, y: 2 }, 'ftr'), foe('goblin-warrior', { x: 2, y: 2 }, 'gob')],
    });
    until(c, 'wiz');
    const acBefore = acOf(c.state.combatants['ftr']!);
    c.apply({ kind: 'castSpell', spellId: 'haste', slotLevel: 3, targets: [{ combatantId: 'ftr' }] });
    expect(acOf(c.state.combatants['ftr']!)).toBe(acBefore + 2);

    until(c, 'ftr');
    expect(c.state.combatants['ftr']!.turn.movementMax).toBe(60); // 30 -> 60

    c.apply({ kind: 'attack', weaponId: 'longsword', targetId: 'gob' });
    // A level-5 fighter already has Extra Attack (attacksPerAction 2, so 1
    // follow-up banked); Haste stacks one more on top of that.
    expect(c.state.combatants['ftr']!.turn.attacksLeft).toBe(2);
  });
});
