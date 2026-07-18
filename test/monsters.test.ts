import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildMonster, buildEncounter, ENCOUNTERS, MONSTERS } from '../src/data/monsters.js';
import { buildParty } from '../src/builder/character.js';
import { chooseAction } from '../src/ai/greedy.js';
import { applyDamage } from '../src/engine/rules/attack.js';
import { makeCombatant } from './helpers.js';
import { proficiencyBonus, abilityMod } from '../src/engine/types.js';

describe('stat blocks', () => {
  it('derived attack bonuses match the SRD printed values (PB +2)', () => {
    // goblin scimitar (finesse, dex 15): +2 +2 = +4; ogre greatclub (str 19): +4 +2 = +6
    const goblin = MONSTERS['goblin-warrior']!;
    expect(abilityMod(goblin.abilities.dex) + proficiencyBonus(1)).toBe(4);
    const ogre = MONSTERS['ogre']!;
    expect(abilityMod(ogre.abilities.str) + proficiencyBonus(1)).toBe(6);
    const skeleton = MONSTERS['skeleton']!;
    expect(abilityMod(skeleton.abilities.dex) + proficiencyBonus(1)).toBe(5);
  });

  it('the new caster stat blocks build with their spell kits', () => {
    const priest = buildMonster('priest', 'team2', { x: 0, y: 0 });
    expect(priest.spellcastingAbility).toBe('wis');
    expect(priest.spellIds).toEqual(expect.arrayContaining(['spiritual-guardians', 'command', 'healing-word']));
    expect(priest.spellSlots.map((s) => s.max)).toEqual([4, 3, 2]);

    const oni = buildMonster('ogre-mage', 'team2', { x: 0, y: 0 });
    expect(oni.spellcastingAbility).toBe('int');
    expect(oni.spellIds).toEqual(expect.arrayContaining(['fireball', 'web', 'magic-missile', 'fire-bolt']));
    expect(oni.acOverride).toBe(15); // Mage Armor precast
  });

  it('encounters build with unique ids and legal placement', () => {
    for (const id of Object.keys(ENCOUNTERS)) {
      const mob = buildEncounter(id, 'team2', 7);
      expect(new Set(mob.map((m) => m.id)).size).toBe(mob.length);
      const c = new Combat({ seed: 1, combatants: [...buildParty('team1', 0), ...mob] });
      expect(c.state.initiativeOrder.length).toBe(4 + mob.length);
    }
  });
});

describe('monster mechanics', () => {
  it('skeleton takes double damage from bludgeoning, none from poison', () => {
    const c = new Combat({
      seed: 3,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 3, y: 3 } }),
        buildMonster('skeleton', 'team2', { x: 7, y: 7 }),
      ],
    });
    const draft = structuredClone(c.state);
    const skel = Object.values(draft.combatants).find((x) => x.classId === 'skeleton')!;
    const hp = skel.hp;
    applyDamage(draft, skel.id, 'a', 4, 'bludgeoning');
    expect(skel.hp).toBe(hp - 8);
    applyDamage(draft, skel.id, 'a', 4, 'poison');
    expect(skel.hp).toBe(hp - 8); // unchanged
  });

  it('zombie undead fortitude can survive at 1 hp; radiant bypasses it', () => {
    // DC 5+2=7 vs the zombie's +3 con mod: should succeed most of the time.
    let survived = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          makeCombatant({ id: 'a', team: 'team1', position: { x: 0, y: 0 } }),
          buildMonster('zombie', 'team2', { x: 7, y: 7 }),
        ],
      });
      const draft = structuredClone(c.state);
      const z = Object.values(draft.combatants).find((x) => x.classId === 'zombie')!;
      z.hp = 1;
      const events = applyDamage(draft, z.id, 'a', 2, 'slashing');
      if (z.alive && z.hp === 1) {
        survived++;
        expect(events.some((e) => e.type === 'savingThrow' && e.success)).toBe(true);
      }
    }
    expect(survived).toBeGreaterThan(5); // DC 7 vs +3: succeeds often

    // Radiant damage never triggers the save.
    const c = new Combat({
      seed: 1,
      combatants: [
        makeCombatant({ id: 'a', team: 'team1', position: { x: 0, y: 0 } }),
        buildMonster('zombie', 'team2', { x: 7, y: 7 }),
      ],
    });
    const draft = structuredClone(c.state);
    const z = Object.values(draft.combatants).find((x) => x.classId === 'zombie')!;
    z.hp = 1;
    const events = applyDamage(draft, z.id, 'a', 2, 'radiant');
    expect(z.alive).toBe(false);
    expect(events.some((e) => e.type === 'savingThrow')).toBe(false);
  });

  it('goblin boss multiattack: two attacks in one action', () => {
    const c = new Combat({
      seed: 8,
      combatants: [
        buildMonster('goblin-boss', 'team2', { x: 3, y: 4 }),
        makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000 }),
      ],
    });
    const boss = Object.values(c.state.combatants).find((x) => x.classId === 'goblin-boss')!;
    let guard = 0;
    while (c.activeId !== boss.id && guard++ < 10) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'attack', weaponId: 'goblin-scimitar', targetId: 'pc' });
    expect(c.state.combatants[boss.id]!.turn.attacksLeft).toBe(1);
    // Second main-hand attack still legal though the action is used.
    expect(c.legalActions().some((a) => a.kind === 'attack' && !a.offhand)).toBe(true);
    c.apply({ kind: 'attack', weaponId: 'goblin-scimitar', targetId: 'pc' });
    expect(c.state.combatants[boss.id]!.turn.attacksLeft).toBe(0);
    expect(c.legalActions().some((a) => a.kind === 'attack' && !a.offhand)).toBe(false);
  });

  it('wolf pack tactics grants advantage and bite knocks prone; prone costs half speed to stand', () => {
    const c = new Combat({
      seed: 9,
      combatants: [
        buildMonster('wolf', 'team2', { x: 3, y: 4 }, '1'),
        buildMonster('wolf', 'team2', { x: 4, y: 4 }, '2'),
        makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000 }),
      ],
    });
    const wolves = Object.values(c.state.combatants).filter((x) => x.classId === 'wolf').map((w) => w.id);
    let bit = false;
    let guard = 0;
    while (!bit && guard++ < 40) {
      if (wolves.includes(c.activeId)) {
        const events = c.apply({ kind: 'attack', weaponId: 'bite', targetId: 'pc' });
        const roll = events.find((e) => e.type === 'attackRolled')!;
        if (roll.type !== 'attackRolled') throw new Error();
        expect(roll.advSources).toContain('pack tactics');
        if (roll.hit) {
          expect(c.state.combatants['pc']!.conditions.some((k) => k.id === 'prone')).toBe(true);
          bit = true;
        }
      }
      if (!c.isOver()) c.apply({ kind: 'endTurn' });
    }
    expect(bit).toBe(true);
    // PC's next turn: stands automatically, half movement.
    guard = 0;
    while (c.activeId !== 'pc' && guard++ < 10) c.apply({ kind: 'endTurn' });
    expect(c.state.combatants['pc']!.conditions.some((k) => k.id === 'prone')).toBe(false);
    expect(c.state.combatants['pc']!.turn.movementMax).toBe(15);
  });

  it('goblin scimitar adds 1d4 when it has advantage', () => {
    // A prone PC grants melee advantage; the window closes once the PC stands,
    // so try fresh games until the goblin acts first and lands a non-crit hit.
    let verified = false;
    for (let seed = 1; seed <= 80 && !verified; seed++) {
      const c = new Combat({
        seed,
        combatants: [
          buildMonster('goblin-warrior', 'team2', { x: 3, y: 4 }),
          makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 }, hp: 1000, maxHp: 1000, conditions: [{ id: 'prone' }] }),
        ],
      });
      const gob = Object.values(c.state.combatants).find((x) => x.classId === 'goblin-warrior')!;
      if (c.activeId !== gob.id) continue;
      const events = c.apply({ kind: 'attack', weaponId: 'goblin-scimitar', targetId: 'pc' });
      const roll = events.find((e) => e.type === 'attackRolled')!;
      const dmg = events.find((e) => e.type === 'damageDealt');
      if (roll.type !== 'attackRolled') throw new Error();
      expect(roll.mode).toBe('advantage');
      expect(roll.advSources).toContain('target prone');
      if (roll.hit && !roll.crit && dmg?.type === 'damageDealt') {
        expect(dmg.rolls.length).toBe(2); // 1d6 + 1d4
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  it('nimble escape: goblin disengages as a bonus action', () => {
    const c = new Combat({
      seed: 2,
      combatants: [
        buildMonster('goblin-warrior', 'team2', { x: 3, y: 4 }),
        makeCombatant({ id: 'pc', team: 'team1', position: { x: 3, y: 3 } }),
      ],
    });
    const gob = Object.values(c.state.combatants).find((x) => x.classId === 'goblin-warrior')!;
    let guard = 0;
    while (c.activeId !== gob.id && guard++ < 10) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'useFeature', featureId: 'nimble-escape' });
    expect(c.state.combatants[gob.id]!.turn.disengaged).toBe(true);
    expect(c.state.combatants[gob.id]!.turn.bonusActionUsed).toBe(true);
    // Walking away provokes nothing.
    const events = c.apply({ kind: 'move', to: { x: 3, y: 7 } });
    expect(events.some((e) => e.type === 'attackRolled')).toBe(false);
  });
});

describe('encounter battles', () => {
  it('party vs every encounter completes under AI on both sides', () => {
    for (const encId of Object.keys(ENCOUNTERS)) {
      const c = new Combat({
        seed: 5,
        mapId: 'ruins',
        combatants: [...buildParty('team1', 0), ...buildEncounter(encId, 'team2', 7)],
      });
      let steps = 0;
      while (!c.isOver() && steps++ < 6000) {
        c.apply(chooseAction(c.state, c.activeId));
      }
      expect(c.isOver()).toBe(true);
    }
  }, 60000);
});
