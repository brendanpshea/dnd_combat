import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { resolveAttack, canAttackWith } from '../src/engine/rules/attack.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { WEAPONS } from '../src/data/weapons.js';
import { FEATURES } from '../src/data/features.js';
import { makeCombatant } from './helpers.js';

/**
 * Monster grapples, SRD 5.2.1: "it has the Grappled condition (escape DC n)"
 * on a hit, with no save, and "the Restrained condition until the grapple
 * ends" where the stat block says so.
 */
function fight(monsterId: string, seed: number, targetSize: 'medium' | 'huge' = 'medium') {
  const m = { ...buildMonster(monsterId, 'team2', { x: 3, y: 4 }), id: 'm' };
  const pc = makeCombatant({
    id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000, acOverride: 5, size: targetSize,
  });
  return new Combat({ seed, mapId: 'open', combatants: [m, pc] });
}

/** First seed on which `weaponId` hits; the held state after it. */
function hitWith(monsterId: string, weaponId: string, targetSize: 'medium' | 'huge' = 'medium') {
  for (let seed = 1; seed <= 40; seed++) {
    const c = fight(monsterId, seed, targetSize);
    const events = resolveAttack(c.state, 'm', 'pc', weaponId);
    if (events.some((e) => e.type === 'damageDealt' && e.targetId === 'pc')) return c;
  }
  throw new Error(`${weaponId} never hit AC 5 in 40 seeds`);
}

describe('monster grapples (SRD 5.2.1)', () => {
  it('a giant crocodile bite grapples at escape DC 15 and restrains until the grapple ends', () => {
    const c = hitWith('giant-crocodile', 'crocodile-bite');
    const pc = c.state.combatants['pc']!;
    const g = pc.conditions.find((k) => k.id === 'grappled');
    expect(g?.sourceId).toBe('m');
    expect(g?.escape?.dc).toBe(15);
    expect(g?.grapple?.via).toBe('crocodile-bite');
    const r = pc.conditions.find((k) => k.id === 'restrained');
    expect(r?.whileGrappledBy).toBe('m');
    // No save: the old approximation rolled one every turn.
    expect(r?.repeatSave).toBeUndefined();
  });

  it('a glabrezu pincer grapples a Medium target (escape DC 15) without restraining it', () => {
    const c = hitWith('glabrezu', 'glabrezu-pincer');
    const pc = c.state.combatants['pc']!;
    expect(pc.conditions.find((k) => k.id === 'grappled')?.escape?.dc).toBe(15);
    expect(pc.conditions.some((k) => k.id === 'restrained')).toBe(false);
  });

  it('the size limit is honoured: a glabrezu cannot hold a Huge target', () => {
    const c = hitWith('glabrezu', 'glabrezu-pincer', 'huge');
    expect(c.state.combatants['pc']!.conditions.some((k) => k.id === 'grappled')).toBe(false);
  });

  it('the limb doing the holding cannot attack someone else', () => {
    const c = hitWith('giant-scorpion', 'scorpion-claw');
    c.state.combatants['other'] = { ...c.state.combatants['pc']!, id: 'other', position: { x: 4, y: 4 }, conditions: [] };
    expect(canAttackWith(c.state, c.state.combatants['m']!, 'scorpion-claw', 'other')).toBe(false);
    expect(canAttackWith(c.state, c.state.combatants['m']!, 'scorpion-sting', 'other')).toBe(true);
  });

  it('every converted attack carries the DC, size and restraint its stat block prints', () => {
    const expected: Record<string, { dc: number; restrains?: boolean; maxSize?: string }> = {
      'bugbear-grab': { dc: 12, maxSize: 'medium' },
      'toad-bite': { dc: 12, maxSize: 'medium' },
      'snake-constrict': { dc: 14, maxSize: 'large' },
      'chain-devil-chain': { dc: 14, restrains: true, maxSize: 'large' },
      'glabrezu-pincer': { dc: 15, maxSize: 'medium' },
      'griffon-rend': { dc: 14, maxSize: 'medium' },
      'roper-tendril': { dc: 14 },
      'remorhaz-bite': { dc: 17, restrains: true, maxSize: 'large' },
      'otyugh-tentacle': { dc: 13, maxSize: 'medium' },
      'aboleth-tentacle': { dc: 14, maxSize: 'large' },
      'trex-bite': { dc: 17, restrains: true, maxSize: 'large' },
      'spawn-claws': { dc: 13, maxSize: 'medium' },
      'scorpion-claw': { dc: 13, maxSize: 'large' },
      'crocodile-bite': { dc: 15, restrains: true, maxSize: 'large' },
      'barbed-devil-claw': { dc: 13, maxSize: 'large' },
      'rug-smother': { dc: 13, restrains: true, maxSize: 'medium' },
    };
    for (const [id, g] of Object.entries(expected)) {
      const w = WEAPONS[id]!;
      expect(w.onHitGrapple, id).toEqual(g);
      // The approximations these replace are gone.
      expect(w.onHitCondition, id).not.toBe('restrained');
      expect(w.onHitSave?.condition, id).not.toBe('restrained');
      // Monster-only: exactly one stat block carries it.
      expect(Object.values(MONSTERS).filter((m) => m.weaponIds.includes(id)).length, id).toBe(1);
    }
  });

  it('Whelm grapples (escape DC 14) and restrains on a failed save', () => {
    let seen = false;
    for (let seed = 1; seed <= 40 && !seen; seed++) {
      const c = fight('water-elemental', seed);
      FEATURES['whelm']!.apply!({ state: c.state, actorId: 'm' } as never);
      const pc = c.state.combatants['pc']!;
      const g = pc.conditions.find((k) => k.id === 'grappled');
      if (!g) continue;
      seen = true;
      expect(g.escape?.dc).toBe(14);
      expect(pc.conditions.find((k) => k.id === 'restrained')?.whileGrappledBy).toBe('m');
    }
    expect(seen, 'Whelm never landed in 40 seeds').toBe(true);
  });

  it('an engulfed creature escapes with a check, not a repeated save', () => {
    let seen = false;
    for (let seed = 1; seed <= 40 && !seen; seed++) {
      const c = fight('gelatinous-cube', seed);
      FEATURES['engulf']!.apply!({ state: c.state, actorId: 'm' } as never);
      const r = c.state.combatants['pc']!.conditions.find((k) => k.id === 'restrained');
      if (!r) continue;
      seen = true;
      expect(r.escape).toEqual({ dc: 12, skills: ['athletics'] });
      expect(r.repeatSave).toBeUndefined();
    }
    expect(seen, 'Engulf never landed in 40 seeds').toBe(true);
  });
});
