import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Combat } from '../src/engine/combat.js';
import { MONSTERS, MONSTER_XP, buildMonster, monsterLevel } from '../src/data/monsters.js';
import { WEAPONS } from '../src/data/weapons.js';
import { FEATURES, BREATH_WEAPONS } from '../src/data/features.js';
import { ORIGINAL_CREATURE_IDS, ORIGINAL_MONSTERS, ORIGINAL_WEAPONS } from '../src/data/original-creatures.js';
import { ARENA_EXCLUDED, arenaRoster } from '../src/arena/encounter.js';
import { legalActions } from '../src/engine/actions.js';
import { resolveAttack, collectAttackSources, applyDamage, weaponAttackBonus, attackAbility } from '../src/engine/rules/attack.js';
import { startTurn } from '../src/engine/turn.js';
import { abilityMod, proficiencyBonus, type Combatant } from '../src/engine/types.js';
import { buildCharacter } from '../src/builder/character.js';

/**
 * The original creatures (src/data/original-creatures.ts, CC0): a role a famous
 * monster plays, in this game's own words and the SRD's own mechanics. The SRD
 * test cannot see them — they are in no SRD — so this holds them to their
 * challenge rating, and to being theirs.
 */

const XP_BY_CR: Record<number, number> = {
  0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
};

/** The challenge rating each stands at (CR <= 4 is omitted from the data, so it is listed here). */
const CR: Record<string, number> = {
  panopt: 12, 'gloomthicket-titan': 10, shimmerpard: 3, barrowwyrm: 15, 'vitriol-slug': 6, viperveil: 4,
  bramblekin: 0.5, 'bramblekin-warden': 2, 'midden-behemoth': 7, clatterkin: 3, whirligig: 1,
  emberhaunt: 11, 'hedge-mantis': 4, veilcat: 5,
  'kobold-chief': 1, 'orc-chieftain': 2, 'hobgoblin-sergeant': 1, 'ogre-chieftain': 3,
};

/** The DMG's "monster statistics by challenge rating" bands: hit points and armor class, each with a margin. */
const HP_BAND: Record<number, [number, number]> = {
  0.5: [14, 35], 1: [23, 80], 2: [40, 100], 3: [45, 120], 4: [60, 140], 5: [75, 160], 6: [90, 180],
  7: [105, 190], 10: [160, 240], 11: [170, 260], 12: [130, 270], 15: [200, 310],
};

const hero = (x: number, y: number): Combatant =>
  ({ ...buildCharacter({ classId: 'fighter', team: 'team1', position: { x, y }, level: 5 }), id: 'h', hp: 900, maxHp: 900 });

function duel(id: string, at = { x: 3, y: 4 }): Combat {
  const m = { ...buildMonster(id, 'team2', at), id: 'm' };
  const c = new Combat({ seed: 2, width: 10, height: 10, combatants: [hero(3, 3), m] });
  let guard = 0;
  while (c.activeId !== 'm' && guard++ < 10) c.apply({ kind: 'endTurn' });
  return c;
}

/** A turn's average damage if every attack in its best routine hits: dice, rider, and modifier. */
function avg(expr: string): number {
  const m = /^(\d+)d(\d+)/.exec(expr)!;
  return Number(m[1]) * (Number(m[2]) + 1) / 2;
}
function turnDamage(id: string): number {
  const m = MONSTERS[id]!;
  const c = buildMonster(id, 'team2', { x: 0, y: 0 });
  const one = (wid: string) => {
    const w = WEAPONS[wid]!;
    const mod = w.abilityDamage === false ? 0 : abilityMod(c.abilities[attackAbility(c, w)]);
    return avg(w.damage) + mod + (w.extraDamage ? avg(w.extraDamage.dice) : 0);
  };
  const n = m.attacksPerAction ?? 1;
  const routines = m.multiattack ?? [Array.from({ length: n }, (_, i) => m.weaponIds[i % m.weaponIds.length]!)];
  return Math.max(...routines.map((r) => r.reduce((s, wid) => s + one(wid), 0)));
}

describe('the original creatures', () => {
  it('are eighteen, all here, priced by their challenge rating, and out of the arena', () => {
    expect(ORIGINAL_CREATURE_IDS).toHaveLength(18);
    expect(Object.keys(ORIGINAL_MONSTERS).sort()).toEqual([...ORIGINAL_CREATURE_IDS].sort());
    for (const id of ORIGINAL_CREATURE_IDS) {
      expect(MONSTERS[id], id).toBeDefined();
      expect(MONSTER_XP[id], id).toBe(XP_BY_CR[CR[id]!]);
      expect(ARENA_EXCLUDED.has(id), id).toBe(true);
      // The data omits CR for the ones at or below 4, where PB +2 is already right.
      if (CR[id]! > 4) expect(MONSTERS[id]!.cr, id).toBe(CR[id]);
      else expect(MONSTERS[id]!.cr ?? 0, id).toBeLessThanOrEqual(4);
    }
    expect(arenaRoster().some((r) => (ORIGINAL_CREATURE_IDS as readonly string[]).includes(r.id))).toBe(false);
  });

  it('every one builds, attacks with weapons that exist, and has a shape the board can draw', () => {
    for (const id of ORIGINAL_CREATURE_IDS) {
      const m = MONSTERS[id]!;
      for (const w of m.weaponIds) expect(WEAPONS[w], `${id} ${w}`).toBeDefined();
      for (const f of m.featureIds ?? []) expect(FEATURES[f], `${id} ${f}`).toBeDefined();
      const c = duel(id, { x: 3, y: 4 });
      const swings = legalActions(c.state, 'm').filter((a) => a.kind === 'attack');
      expect(swings.length, id).toBeGreaterThan(0);
    }
  });

  it('hit points sit in the band for their challenge rating, and a turn of damage is neither feeble nor a massacre', () => {
    for (const id of ORIGINAL_CREATURE_IDS) {
      const cr = CR[id]!;
      const band = HP_BAND[cr];
      if (band) expect(MONSTERS[id]!.hp, `${id} hit points`).toBeGreaterThanOrEqual(band[0]);
      if (band) expect(MONSTERS[id]!.hp, `${id} hit points`).toBeLessThanOrEqual(band[1]);
      // The DMG's offensive CR runs from ~3 damage a round at CR 1/2 to ~85 at CR 15.
      const dmg = turnDamage(id);
      const floor = Math.max(4, cr * 4 - 4), ceiling = cr * 9 + 24;
      expect(dmg, `${id} damage a turn`).toBeGreaterThanOrEqual(floor);
      expect(dmg, `${id} damage a turn`).toBeLessThanOrEqual(ceiling);
    }
  });

  it('attack bonuses and save DCs land where a monster of that challenge rating has them', () => {
    for (const id of ORIGINAL_CREATURE_IDS) {
      const m = MONSTERS[id]!;
      const c = buildMonster(id, 'team2', { x: 0, y: 0 });
      const pb = proficiencyBonus(monsterLevel(m.cr));
      for (const wid of m.weaponIds) {
        const bonus = weaponAttackBonus(c, WEAPONS[wid]!);
        expect(bonus, `${id} ${wid} to-hit`).toBeGreaterThanOrEqual(pb + 1);
        expect(bonus, `${id} ${wid} to-hit`).toBeLessThanOrEqual(pb + 7);
        const w = WEAPONS[wid]!;
        for (const dc of [w.onHitSave?.dc, w.onHitGrapple?.dc]) {
          if (dc !== undefined) {
            expect(dc, `${id} ${wid} DC`).toBeGreaterThanOrEqual(8 + pb - 1);
            expect(dc, `${id} ${wid} DC`).toBeLessThanOrEqual(8 + pb + 6);
          }
        }
      }
    }
  });

  it('are theirs: no product-identity name, in an id, a name or the source', () => {
    const banned = /(beholder|mind.?flayer|illithid|displacer|dracolich|thri.?kreen|vegepygmy|carrion|quickling|rakshasa|moander|tyranthraxus|drow|dark elf|neo.?otyugh|margoyle|hook horror|umber hulk|githyanki)/i;
    const src = readFileSync(fileURLToPath(new URL('../src/data/original-creatures.ts', import.meta.url)), 'utf8');
    for (const id of ORIGINAL_CREATURE_IDS) {
      expect(id, id).not.toMatch(banned);
      expect(MONSTERS[id]!.name, id).not.toMatch(banned);
    }
    for (const w of Object.values(ORIGINAL_WEAPONS)) expect(w.name).not.toMatch(banned);
    expect(src.replace(/Not modelled[^\n]*|released to the public domain[^\n]*/g, '')).not.toMatch(banned);
    expect(src).toContain('CC0');
  });
});

describe('their abilities', () => {
  it("a Kobold Chief has a ranger's ways: two shots or two blades a turn, and more for one already hurt", () => {
    expect(MONSTERS['kobold-chief']).toMatchObject({ attacksPerAction: 2, creatureType: 'dragon', size: 'small' });
    expect(MONSTERS['kobold-chief']!.featureIds).toEqual(expect.arrayContaining(['colossus-slayer', 'pack-tactics']));
    expect(MONSTERS['kobold-chief']!.multiattack).toEqual([['shortsword', 'shortsword'], ['shortbow', 'shortbow']]);
  });

  it('a Panopt fires its three rays in a turn, and the stilling one paralyses on a hit that fails the save', () => {
    const c = duel('panopt', { x: 3, y: 6 });
    const m = c.state.combatants['m']!;
    expect(m.attacksPerAction).toBe(3);
    expect(WEAPONS['panopt-still-ray']!.onHitSave).toMatchObject({ condition: 'paralyzed', ability: 'con' });
    let paralysed = false;
    for (let seed = 1; seed <= 60 && !paralysed; seed++) {
      const s = structuredClone(c.state);
      s.rng = seed as unknown as typeof s.rng;
      resolveAttack(s, 'm', 'h', 'panopt-still-ray');
      paralysed = s.combatants['h']!.conditions.some((k) => k.id === 'paralyzed');
    }
    expect(paralysed).toBe(true);
    // And it flies, so the board lets it hover over the party's front rank.
    expect(m.flying).toBe(true);
  });

  it('a Shimmerpard is hard to hit until something connects, then plain again from its next turn', () => {
    const c = duel('shimmerpard', { x: 3, y: 4 });
    const m = c.state.combatants['m']!;
    const h = c.state.combatants['h']!;
    const sources = () => collectAttackSources(c.state, h, m, WEAPONS['longsword']!, true).dis;
    expect(sources()).toContain('displacement');
    applyDamage(c.state, 'm', 'h', 3, 'slashing', [], { magical: false });
    expect(sources()).not.toContain('displacement');
    // Its own turn starting puts the haze back.
    startTurn(c.state);
    expect(sources()).toContain('displacement');
  });

  it('a Viperveil\'s gaze stills everyone within thirty feet who fails the save, and recharges', () => {
    expect(FEATURES['lulling-gaze']).toMatchObject({ trigger: 'bonus', recharge: 5 });
    const c = duel('viperveil', { x: 3, y: 5 });
    let stilled = false, spared = false;
    for (let seed = 1; seed <= 80 && !(stilled && spared); seed++) {
      const s = structuredClone(c.state);
      s.rng = seed as unknown as typeof s.rng;
      FEATURES['lulling-gaze']!.apply!({ state: s, actorId: 'm' });
      if (s.combatants['h']!.conditions.some((k) => k.id === 'paralyzed')) stilled = true; else spared = true;
    }
    expect(stilled && spared, 'a Constitution save, so some fail and some do not').toBe(true);
    const far = duel('viperveil', { x: 3, y: 9 });
    far.state.combatants['h']!.position = { x: 0, y: 0 };
    FEATURES['lulling-gaze']!.apply!({ state: far.state, actorId: 'm' });
    expect(far.state.combatants['h']!.conditions.some((k) => k.id === 'paralyzed')).toBe(false);
  });

  it('a Barrowwyrm\'s grave-chill breath burns in a cone and stills whoever fails the save', () => {
    expect(BREATH_WEAPONS['breath-grave-chill']).toMatchObject({ shape: 'cone', save: 'con', damageType: 'cold', onFail: { condition: 'paralyzed' } });
    expect(FEATURES['breath-grave-chill']!.recharge).toBe(5);
    const c = duel('barrowwyrm', { x: 3, y: 5 });
    let stilled = false;
    for (let seed = 1; seed <= 80 && !stilled; seed++) {
      const s = structuredClone(c.state);
      s.rng = seed as unknown as typeof s.rng;
      const before = s.combatants['h']!.hp;
      FEATURES['breath-grave-chill']!.apply!({ state: s, actorId: 'm' });
      expect(s.combatants['h']!.hp, 'the breath hurts either way').toBeLessThan(before);
      stilled = s.combatants['h']!.conditions.some((k) => k.id === 'paralyzed');
    }
    expect(stilled).toBe(true);
  });

  it('an Emberhaunt breathes a line of lightning and is immune to fire', () => {
    expect(BREATH_WEAPONS['breath-arc-surge']).toMatchObject({ shape: 'line', save: 'dex', damageType: 'lightning' });
    expect(MONSTERS['emberhaunt']!.immunities).toContain('fire');
  });

  it('a Gloomthicket Titan grows back, unless fire or acid has touched it', () => {
    const m = MONSTERS['gloomthicket-titan']!;
    expect(m.regeneration).toEqual({ amount: 10, stoppedBy: ['fire', 'acid'] });
    expect(m.immunities).toContain('lightning');
    expect(WEAPONS['titan-bough']!.onHitGrapple).toMatchObject({ restrains: true });
  });

  it('a Veilcat shrugs off ordinary weapons and its whisper frightens', () => {
    const m = MONSTERS['veilcat']!;
    expect(m.resistNonmagical).toEqual(['bludgeoning', 'piercing', 'slashing']);
    expect(m.featureIds).toContain('magic-resistance');
    expect(WEAPONS['veilcat-murmur']!.onHitSave).toMatchObject({ condition: 'frightened' });
  });

  it('the rest keep their promises: clatterkin numb, mantises seize, bramblekin swarm, slugs spit, behemoths hold', () => {
    expect(WEAPONS['clatterkin-sting']!.onHitSave).toMatchObject({ condition: 'paralyzed' });
    expect(WEAPONS['mantis-foreleg']!.onHitGrapple).toBeDefined();
    expect(MONSTERS['bramblekin']!.featureIds).toContain('pack-tactics');
    expect(WEAPONS['slug-spit']!.range).toBeDefined();
    expect(WEAPONS['midden-arm']!.onHitGrapple).toMatchObject({ restrains: true });
    expect(MONSTERS['whirligig']!.speed).toBeGreaterThanOrEqual(50);
  });
});
