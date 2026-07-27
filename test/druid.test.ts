/**
 * Druid: Wild Shape.
 *
 * Wild Shape is the 2024 version, which keeps the druid's hit points and hands
 * it temporary ones — so these tests are mostly about the swap being complete
 * in one direction and exactly reversible in the other.
 */
import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster, MONSTERS } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES, WILD_SHAPE_FORMS } from '../src/data/features.js';
import { SPELLS, wearsMetal } from '../src/data/spells.js';
import { acOf } from '../src/data/armor.js';
import { legalActions } from '../src/engine/actions.js';
import {
  applyDamage, breakConcentration, collectAttackSources, isShillelaghed, shillelaghDamage,
  resolveAttack,
} from '../src/engine/rules/attack.js';
import { WEAPONS } from '../src/data/weapons.js';
import type { Combatant, Position } from '../src/engine/types.js';

const pc = (classId: string, level: number, position: Position, id: string): Combatant =>
  ({ ...buildCharacter({ classId, team: 'team1', position, speciesId: 'human', level }), id });
const foe = (monsterId: string, position: Position, id: string): Combatant =>
  ({ ...buildMonster(monsterId, 'team2', position), id });

const shape = (c: Combat, id = 'dru') => FEATURES['wild-shape']!.apply!({ state: c.state, actorId: id });

function board(level: number): Combat {
  return new Combat({
    seed: 1, width: 14, height: 10,
    combatants: [pc('druid', level, { x: 3, y: 3 }, 'dru'), foe('ogre', { x: 9, y: 3 }, 'ogre')],
  });
}

describe('Druid: the class', () => {
  it('is a Wisdom full caster in Warden kit', () => {
    const d = buildCharacter({ classId: 'druid', team: 'team1', position: { x: 1, y: 1 }, level: 5 });
    expect(d.spellcastingAbility).toBe('wis');
    expect(d.spellSlots.map((s) => s.max)).toEqual([4, 3, 2]);
    expect(CLASSES['druid']!.savingThrows).toEqual(['int', 'wis']);
    expect(CLASSES['druid']!.armorProfs).toEqual(['light', 'medium', 'shield']);
  });

  it('has no Wild Shape until level 2', () => {
    expect(pc('druid', 1, { x: 1, y: 1 }, 'a').featureIds).not.toContain('wild-shape');
    expect(pc('druid', 2, { x: 1, y: 1 }, 'a').featureIds).toContain('wild-shape');
  });

  it('every listed form is a real beast', () => {
    for (const f of WILD_SHAPE_FORMS) {
      const m = MONSTERS[f.monsterId];
      expect(m, `${f.monsterId} is not in the bestiary`).toBeDefined();
      expect(m!.creatureType, `${f.monsterId} is not a beast`).toBe('beast');
    }
  });
});

describe('Wild Shape', () => {
  it('takes on the beast’s body and keeps the druid’s hit points', () => {
    const c = board(5);
    const before = { ac: acOf(c.state.combatants['dru']!), hp: c.state.combatants['dru']!.hp };
    const events = shape(c);
    const d = c.state.combatants['dru']!;
    const beast = MONSTERS[d.wildShape!.formId]!;

    expect(events.some((e) => e.type === 'wildShaped')).toBe(true);
    expect(acOf(d), 'AC comes from the beast').toBe(beast.ac);
    expect(acOf(d)).not.toBe(before.ac);
    expect(d.speed).toBe(beast.speed);
    expect(d.abilities.str).toBe(beast.abilities.str);
    expect(d.equipped.mainHand, 'and its teeth are in hand').toBe(beast.weaponIds[0]);
    expect(d.hp, 'hit points are the druid’s own, untouched').toBe(before.hp);
    expect(d.tempHp, 'plus temporary hit points equal to druid level').toBe(d.level);
  });

  it('keeps the druid’s mind and class features, and gains the beast’s traits', () => {
    const c = board(5);
    shape(c);
    const d = c.state.combatants['dru']!;
    const beast = MONSTERS[d.wildShape!.formId]!;
    expect(d.abilities.wis, 'Wisdom is the druid’s own').toBe(pc('druid', 5, { x: 0, y: 0 }, 'x').abilities.wis);
    expect(d.featureIds, 'class features come along').toContain('wild-shape');
    for (const f of beast.featureIds ?? []) expect(d.featureIds, `beast trait ${f}`).toContain(f);
  });

  it('cannot cast a single spell while shaped', () => {
    const c = board(5);
    expect(legalActions(c.state, 'dru').some((a) => a.kind === 'castSpell')).toBe(true);
    shape(c);
    expect(legalActions(c.state, 'dru').some((a) => a.kind === 'castSpell'),
      'a wolf does not cast Cure Wounds').toBe(false);
  });

  it('reverts to exactly what it was, and the round trip costs one use', () => {
    const c = board(5);
    const d0 = c.state.combatants['dru']!;
    const snapshot = {
      ac: acOf(d0), speed: d0.speed, abilities: { ...d0.abilities },
      equipped: { ...d0.equipped }, features: [...d0.featureIds],
      attacks: d0.attacksPerAction,
    };
    const uses = d0.featureUses['wild-shape']!.current;

    shape(c);
    shape(c);   // and back again

    const d = c.state.combatants['dru']!;
    expect(d.wildShape).toBeUndefined();
    expect(acOf(d)).toBe(snapshot.ac);
    expect(d.speed).toBe(snapshot.speed);
    expect(d.abilities).toEqual(snapshot.abilities);
    expect(d.equipped).toEqual(snapshot.equipped);
    expect(d.featureIds).toEqual(snapshot.features);
    expect(d.attacksPerAction).toBe(snapshot.attacks);
    expect(d.tempHp, 'the beast’s temporary hit points go with the beast').toBeUndefined();
    expect(d.featureUses['wild-shape']!.current, 'shifting costs a use; shifting back is free')
      .toBe(uses - 1);
  });

  it('the temporary hit points actually soak damage before the druid’s own', () => {
    const c = board(5);
    shape(c);
    const d = c.state.combatants['dru']!;
    const hp = d.hp;
    const temp = d.tempHp!;
    applyDamage(c.state, 'dru', 'nobody', temp, 'slashing');
    expect(c.state.combatants['dru']!.hp, 'the beast’s hide took all of it').toBe(hp);
    expect(c.state.combatants['dru']!.tempHp ?? 0).toBe(0);
  });

  it('runs out after two shifts', () => {
    const c = board(5);
    for (let i = 0; i < 3; i++) { shape(c); shape(c); }
    const d = c.state.combatants['dru']!;
    expect(d.featureUses['wild-shape']!.current).toBe(0);
    expect(shape(c), 'a spent pool shifts nothing').toEqual([]);
    expect(d.wildShape).toBeUndefined();
  });
});


describe('Entangle', () => {
  it('vines catch on a Strength save, not a Dexterity one', () => {
    // A strong, clumsy target and a nimble, weak one: only the save differs.
    const brute = { ...pc('fighter', 5, { x: 6, y: 4 }, 'brute'), abilities: { str: 20, dex: 1, con: 10, int: 10, wis: 10, cha: 10 } };
    const acrobat = { ...pc('fighter', 5, { x: 6, y: 5 }, 'acro'), abilities: { str: 1, dex: 20, con: 10, int: 10, wis: 10, cha: 10 } };
    brute.team = 'team2'; acrobat.team = 'team2';
    let brutesCaught = 0, acrobatsCaught = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed, width: 14, height: 10,
        combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), { ...brute }, { ...acrobat }],
      });
      SPELLS['entangle']!.cast({
        state: c.state, casterId: 'dru', slotLevel: 1, targetIds: [], positions: [{ x: 6, y: 4 }],
      });
      if (c.state.combatants['brute']!.conditions.some((k) => k.id === 'restrained')) brutesCaught++;
      if (c.state.combatants['acro']!.conditions.some((k) => k.id === 'restrained')) acrobatsCaught++;
    }
    expect(acrobatsCaught, 'a Strength save is what gets you out of vines')
      .toBeGreaterThan(brutesCaught);
  });

  it('the vines linger and catch whoever walks in afterwards', () => {
    const c = new Combat({
      seed: 5, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('ogre', { x: 11, y: 4 }, 'ogre')],
    });
    SPELLS['entangle']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 1, targetIds: [], positions: [{ x: 7, y: 4 }],
    });
    const cell = c.state.grid.cells[4 * c.state.grid.width + 7]!;
    expect(cell.web, 'the ground should still be vined').toBeDefined();
    expect(cell.web!.ability, 'and it should ask for Strength').toBe('str');
    expect(cell.web!.kind).toBe('entangle');
  });

  it('a plain Web still asks for Dexterity', () => {
    const c = new Combat({
      seed: 5, width: 14, height: 10,
      combatants: [pc('wizard', 5, { x: 2, y: 4 }, 'wiz'), foe('ogre', { x: 11, y: 4 }, 'ogre')],
    });
    SPELLS['web']!.cast({
      state: c.state, casterId: 'wiz', slotLevel: 2, targetIds: [], positions: [{ x: 7, y: 4 }],
    });
    const cell = c.state.grid.cells[4 * c.state.grid.width + 7]!;
    expect(cell.web!.ability, 'absent means Dexterity — Web is unchanged').toBeUndefined();
  });
});

describe('Heat Metal', () => {
  it('knows what is actually made of metal', () => {
    const metal = ['orc', 'knight', 'skeleton'];      // greataxe, mail + greatsword, shortsword
    const notMetal = ['ogre', 'wolf', 'gargoyle'];    // greatclub, and two sets of teeth
    for (const m of metal) expect(wearsMetal(buildMonster(m, 'team2', { x: 1, y: 1 })), m).toBe(true);
    for (const m of notMetal) expect(wearsMetal(buildMonster(m, 'team2', { x: 1, y: 1 })), m).toBe(false);
  });

  it('burns a knight and does nothing at all to a wolf', () => {
    const c = new Combat({
      seed: 6, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('knight', { x: 6, y: 4 }, 'k'), foe('wolf', { x: 6, y: 6 }, 'w')],
    });
    const kHp = c.state.combatants['k']!.hp;
    const wHp = c.state.combatants['w']!.hp;
    const hit = SPELLS['heat-metal']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 2, targetIds: ['k'], positions: [],
    });
    expect(hit.some((e) => e.type === 'damageDealt' && e.damageType === 'fire')).toBe(true);
    expect(c.state.combatants['k']!.hp).toBeLessThan(kHp);

    const miss = SPELLS['heat-metal']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 2, targetIds: ['w'], positions: [],
    });
    expect(miss, 'there is nothing on a wolf to heat').toEqual([]);
    expect(c.state.combatants['w']!.hp).toBe(wHp);
  });

  it('needs no attack roll and no save to deal its damage', () => {
    const c = new Combat({
      seed: 6, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('knight', { x: 6, y: 4 }, 'k')],
    });
    const events = SPELLS['heat-metal']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 2, targetIds: ['k'], positions: [],
    });
    expect(events.some((e) => e.type === 'attackRolled')).toBe(false);
    const dmg = events.find((e) => e.type === 'damageDealt');
    const save = events.find((e) => e.type === 'savingThrow');
    // The save exists, but it is only for the fumble rider — the fire lands first.
    expect(events.indexOf(dmg!)).toBeLessThan(events.indexOf(save!));
  });
});

describe('Call Lightning', () => {
  it('strikes on the turn it is cast, and again each turn the storm holds', () => {
    const c = new Combat({
      seed: 7, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('ogre', { x: 9, y: 4 }, 'ogre')],
    });
    const first = SPELLS['call-lightning']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 3, targetIds: [], positions: [{ x: 9, y: 4 }],
    });
    expect(first.some((e) => e.type === 'lightningStruck')).toBe(true);
    expect(c.state.combatants['dru']!.stormCloud).toBeDefined();

    const hp = c.state.combatants['ogre']!.hp;
    let struck = false;
    do {
      const ev = c.apply({ kind: 'endTurn' });
      if (ev.some((e) => e.type === 'lightningStruck')) struck = true;
    } while (c.activeId !== 'dru');
    expect(struck, 'the cloud should fire again on the druid’s turn').toBe(true);
    expect(c.state.combatants['ogre']!.hp, 'and it should hurt').toBeLessThan(hp);
  });

  it('never drops a bolt on the druid’s own side', () => {
    const c = new Combat({
      seed: 7, width: 14, height: 10,
      combatants: [
        pc('druid', 5, { x: 2, y: 4 }, 'dru'), pc('fighter', 5, { x: 8, y: 4 }, 'fig'),
        foe('ogre', { x: 9, y: 4 }, 'ogre'),
      ],
    });
    c.state.combatants['dru']!.stormCloud = { dice: '3d10', dc: 15 };
    const figHp = c.state.combatants['fig']!.hp;
    for (let i = 0; i < 20; i++) {
      do { c.apply({ kind: 'endTurn' }); } while (c.activeId !== 'dru' && !c.winner());
      if (c.winner()) break;
    }
    expect(c.state.combatants['fig']!.hp, 'the fighter is standing next to the target').toBe(figHp);
  });

  it('the storm blows out when concentration breaks', () => {
    const c = new Combat({
      seed: 7, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('ogre', { x: 9, y: 4 }, 'ogre')],
    });
    SPELLS['call-lightning']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 3, targetIds: [], positions: [{ x: 9, y: 4 }],
    });
    breakConcentration(c.state, 'dru');
    expect(c.state.combatants['dru']!.stormCloud).toBeUndefined();
  });
});

describe('Druid: Wild Companion, Shillelagh, and the storm', () => {
  it('gets a familiar at level 2, and it is a ritual so it costs no slot', () => {
    expect(pc('druid', 1, { x: 1, y: 1 }, 'a').spellIds).not.toContain('find-familiar');
    const d = pc('druid', 2, { x: 1, y: 1 }, 'a');
    expect(d.spellIds, 'Wild Companion arrives with Wild Shape').toContain('find-familiar');
    expect(SPELLS['find-familiar']!.ritual, 'a ritual, so it never eats a prepared slot').toBe(true);
  });

  it('the owl gives the same advantage a wizard familiar does', () => {
    const c = board(5);
    SPELLS['find-familiar']!.cast({ state: c.state, casterId: 'dru', slotLevel: 1, targetIds: [], positions: [] });
    expect(c.state.combatants['dru']!.familiar?.kind).toBe('owl');
    const { adv } = collectAttackSources(
      c.state, c.state.combatants['dru']!, c.state.combatants['ogre']!,
      WEAPONS['quarterstaff']!, false,
    );
    expect(adv).toContain('owl familiar');
  });

  it('Shillelagh swings the staff on Wisdom, at a bigger die', () => {
    const c = board(5);
    const d = c.state.combatants['dru']!;
    expect(d.abilities.wis, 'the whole point is that Wisdom beats Strength here')
      .toBeGreaterThan(d.abilities.str);
    const plain = resolveAttack(c.state, 'dru', 'ogre', 'quarterstaff')
      .find((e) => e.type === 'attackRolled');
    SPELLS['shillelagh']!.cast({ state: c.state, casterId: 'dru', slotLevel: 0, targetIds: [], positions: [] });
    const armed = resolveAttack(c.state, 'dru', 'ogre', 'quarterstaff')
      .find((e) => e.type === 'attackRolled');
    const mod = (e: typeof plain) => (e?.type === 'attackRolled' ? e.total - e.natural : NaN);
    expect(mod(armed), 'Wisdom instead of Strength on the attack roll').toBeGreaterThan(mod(plain));
    // d10 at level 5 rather than the staff's d6.
    expect(shillelaghDamage(5)).toBe('1d10');
    expect(shillelaghDamage(1)).toBe('1d8');
  });

  it('Shillelagh imbues the druid, not every quarterstaff on the board', () => {
    const c = new Combat({
      seed: 2, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 3, y: 3 }, 'dru'), foe('scout', { x: 6, y: 3 }, 'sc')],
    });
    SPELLS['shillelagh']!.cast({ state: c.state, casterId: 'dru', slotLevel: 0, targetIds: [], positions: [] });
    // WEAPONS entries are shared data — the staff itself must be untouched.
    expect(WEAPONS['quarterstaff']!.damage).toBe('1d6');
    expect(isShillelaghed(c.state.combatants['sc']!, WEAPONS['quarterstaff']!)).toBe(false);
    expect(isShillelaghed(c.state.combatants['dru']!, WEAPONS['quarterstaff']!)).toBe(true);
    // …and only a club or staff, not whatever else is in hand.
    expect(isShillelaghed(c.state.combatants['dru']!, WEAPONS['dagger']!)).toBe(false);
  });

  it('the storm keeps dropping a bolt every druid turn, not just the first', () => {
    const c = new Combat({
      seed: 3, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'),
        ...[0, 1].map((i) => ({ ...buildMonster('ogre', 'team2', { x: 9, y: 3 + i }), id: `o${i}`, maxHp: 900, hp: 900 }))],
    });
    SPELLS['call-lightning']!.cast({
      state: c.state, casterId: 'dru', slotLevel: 3, targetIds: [], positions: [{ x: 9, y: 4 }],
    });
    let bolts = 0;
    for (let round = 0; round < 4; round++) {
      do {
        const ev = c.apply({ kind: 'endTurn' });
        bolts += ev.filter((e) => e.type === 'lightningStruck').length;
      } while (c.activeId !== 'dru' && !c.winner());
    }
    expect(bolts, 'four more druid turns should be four more bolts').toBeGreaterThanOrEqual(4);
  });

  it('the druid still has Flaming Sphere, and prepares it', () => {
    expect(CLASSES['druid']!.spellcasting!.spellsByLevel[3]).toContain('flaming-sphere');
    expect(pc('druid', 5, { x: 1, y: 1 }, 'a').spellIds).toContain('flaming-sphere');
  });
});

describe('Druid: area spells and the Warden order', () => {
  const block = (spellId: string) => {
    const foes = [[8, 4], [9, 4], [8, 5], [9, 5]].map(([x, y], i) =>
      ({ ...buildMonster('ogre', 'team2', { x: x!, y: y! }), id: `o${i}`, maxHp: 500, hp: 500 }));
    const c = new Combat({
      seed: 5, width: 14, height: 10,
      combatants: [pc('druid', 5, { x: 2, y: 2 }, 'dru'), ...foes],
    });
    const before = foes.map((f) => c.state.combatants[f.id]!.hp);
    SPELLS[spellId]!.cast({
      state: c.state, casterId: 'dru', slotLevel: SPELLS[spellId]!.level,
      targetIds: [], positions: [{ x: 8, y: 4 }],
    });
    return { c, foes, hurt: foes.filter((f, i) => c.state.combatants[f.id]!.hp < before[i]!).length };
  };

  it('Moonbeam burns everyone in the patch, not one of them', () => {
    expect(block('moonbeam').hurt).toBe(4);
  });

  it('Call Lightning strikes everyone in the patch too', () => {
    expect(block('call-lightning').hurt).toBe(4);
  });

  it('Moonbeam keeps burning whoever starts a turn in it', () => {
    const { c, foes } = block('moonbeam');
    const hp = foes.map((f) => c.state.combatants[f.id]!.hp);
    // Round the order back to the druid: every ogre begins a turn in the beam.
    do { c.apply({ kind: 'endTurn' }); } while (c.activeId !== 'dru' && !c.winner());
    const burnedAgain = foes.filter((f, i) => c.state.combatants[f.id]!.hp < hp[i]!).length;
    expect(burnedAgain, 'standing in it should cost them again').toBeGreaterThan(0);
  });

  it('the beam winks out when concentration drops', () => {
    const { c } = block('moonbeam');
    expect(c.state.combatants['dru']!.moonbeam).toBeDefined();
    breakConcentration(c.state, 'dru');
    expect(c.state.combatants['dru']!.moonbeam).toBeUndefined();
  });

  it('Shillelagh is cast once and lasts the fight', () => {
    const c = board(5);
    SPELLS['shillelagh']!.cast({ state: c.state, casterId: 'dru', slotLevel: 0, targetIds: [], positions: [] });
    // Recasting is a no-op rather than a second condition.
    expect(SPELLS['shillelagh']!.cast({ state: c.state, casterId: 'dru', slotLevel: 0, targetIds: [], positions: [] }))
      .toEqual([]);
    for (let i = 0; i < 20; i++) c.apply({ kind: 'endTurn' });
    expect(c.state.combatants['dru']!.conditions.filter((k) => k.id === 'shillelagh'),
      'no duration, no concentration — it holds until the staff leaves your hands').toHaveLength(1);
  });

  it('takes the Warden primal order: medium armour and martial weapons', () => {
    expect(CLASSES['druid']!.armorProfs).toContain('medium');
    expect(CLASSES['druid']!.weaponProfs.martial).toBe(true);
    const d = pc('druid', 1, { x: 1, y: 1 }, 'a');
    expect(acOf(d), 'scale mail and a shield, not leather').toBeGreaterThanOrEqual(16);
  });

  it('knows Starry Wisp, and it lights the target up on a hit', () => {
    expect(pc('druid', 1, { x: 1, y: 1 }, 'a').spellIds).toContain('starry-wisp');
    for (let seed = 1; seed <= 60; seed++) {
      const c = new Combat({
        seed, width: 14, height: 10,
        combatants: [pc('druid', 5, { x: 2, y: 4 }, 'dru'), foe('ogre', { x: 7, y: 4 }, 'ogre')],
      });
      const events = SPELLS['starry-wisp']!.cast({
        state: c.state, casterId: 'dru', slotLevel: 0, targetIds: ['ogre'], positions: [],
      });
      const atk = events.find((e) => e.type === 'attackRolled');
      if (atk?.type !== 'attackRolled' || !atk.hit) continue;
      expect(events.some((e) => e.type === 'damageDealt' && e.damageType === 'radiant')).toBe(true);
      expect(c.state.combatants['ogre']!.conditions.some((k) => k.id === 'outlined')).toBe(true);
      return;
    }
    throw new Error('starry wisp never hit across 60 seeds');
  });
});
