import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildParty } from '../src/builder/character.js';
import { buildMonster, MONSTERS, MONSTER_XP, canThreatenAtRange } from '../src/data/monsters.js';
import { SPELLS } from '../src/data/spells.js';
import { generateArenaMap } from '../src/arena/map.js';
import { deployFoes } from '../src/arena/deploy.js';
import { parseMap } from '../src/data/maps.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';

const TIER1 = ['goblin-hexer', 'kobold-emberling', 'skeleton-bonechanter', 'apprentice-mage'];
const TIER2 = ['gnoll-packcaller', 'ettercap-snarecaller', 'azer-forgecaller', 'druid'];
const VARIANTS = [...TIER1, ...TIER2];

describe('caster variants', () => {
  it('each one is a variant of a base monster that exists, and shares its type', () => {
    // The generator picks 1-2 creature types and fills from them, so a variant
    // only ever reaches the board through its base's kin. A goblin hexer that
    // was not fey would simply never appear alongside goblins.
    // `dearer` is the direction of the relationship, and it is not always the
    // same one: bolting magic onto a mundane goblin makes it cost more, while
    // an Apprentice Mage is the *junior* version of the 2,300 XP Mage and has
    // to cost less or a level-1 party could never meet one.
    const bases: Array<[string, string, 'dearer' | 'cheaper']> = [
      ['goblin-hexer', 'goblin-warrior', 'dearer'],
      ['kobold-emberling', 'kobold', 'dearer'],
      ['skeleton-bonechanter', 'skeleton', 'dearer'],
      ['apprentice-mage', 'mage', 'cheaper'],
      ['gnoll-packcaller', 'gnoll', 'dearer'],
      ['ettercap-snarecaller', 'ettercap', 'dearer'],
      ['azer-forgecaller', 'azer', 'dearer'],
    ];
    for (const [variant, base, direction] of bases) {
      const v = MONSTERS[variant];
      const b = MONSTERS[base];
      expect(v, `${variant} missing`).toBeDefined();
      expect(b, `${base} missing`).toBeDefined();
      expect(v!.creatureType, `${variant} must share ${base}'s type`).toBe(b!.creatureType);
      expect(v!.spellcasting, `${variant} must actually cast`).toBeDefined();
      expect(MONSTER_XP[variant], `${variant} needs an XP value`).toBeGreaterThan(0);
      if (direction === 'dearer') {
        expect(MONSTER_XP[variant]!, `${variant} vs ${base}`).toBeGreaterThan(MONSTER_XP[base]!);
      } else {
        expect(MONSTER_XP[variant]!, `${variant} vs ${base}`).toBeLessThan(MONSTER_XP[base]!);
      }
    }
  });

  /**
   * A caster whose whole kit is leveled slots does nothing once they run dry
   * but walk toward the party. Five casters were in that state — both new
   * variants plus the dryad, the night hag and the aboleth, none of which had a
   * single cantrip between them.
   */
  it('every spellcasting monster carries an attack cantrip', () => {
    const naked: string[] = [];
    for (const m of Object.values(MONSTERS)) {
      if (!m.spellcasting) continue;
      const hasAttackCantrip = m.spellcasting.spellIds.some((id) => {
        const s = SPELLS[id];
        if (!s || s.level !== 0) return false;
        // Something it can point at an enemy — not Guidance or Shillelagh.
        const kind = String(s.targeting.kind);
        return kind.includes('cone') || kind.includes('sphere') ||
          (s.targeting.kind === 'creature' && (s.targeting as { who?: string }).who === 'enemy');
      });
      if (!hasAttackCantrip) naked.push(m.id);
    }
    expect(naked, `casters with no attack cantrip: ${naked.join(', ')}`).toEqual([]);
  });

  /**
   * The whole point of a stat block is that it gets played. A spell the AI never
   * chooses is dead data, and it fails silently — the monster just does
   * something else and nobody notices the kit was never used.
   *
   * This caught a real one: Bane was priced at nothing by evaluate(), so the sim
   * AI read casting it as pure slot loss and the hexer never used its signature.
   */
  // Run per tier rather than all eight at once: four casters in one fight get
  // four times the turns each, so the same coverage costs a third of the time.
  for (const [tier, cast] of [['tier 1', TIER1], ['tier 2', TIER2]] as const) {
    it(`the AI actually casts what ${tier} was given`, () => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 16; seed++) {
        const m = generateArenaMap({}, (seed * 2654435761) >>> 0);
        const grid = parseMap(m.value.map);
        const spots = deployFoes(grid, cast.length, seed);
        const foes = cast.map((id, i) => ({
          ...buildMonster(id, 'team2', spots.value.positions[i]!), id: `m${i}`,
        }));
        const c = new Combat({ seed, map: m.value.map, combatants: [...buildParty('team1', 0, 4), ...foes] });
        for (let i = 0; i < 1000 && !c.isOver(); i++) {
          const a = chooseActionSim(c.state, c.activeId, SIM_PRESETS.easy);
          if (a.kind === 'castSpell' && c.state.combatants[c.activeId]!.team === 'team2') seen.add(a.spellId);
          c.apply(a);
        }
      }
      // LEVELED spells only. A cantrip is the fallback for when the slots run
      // dry, so on a caster with three ranks of them it can legitimately go a
      // whole sweep uncast — asserting otherwise measures fight length, not
      // whether the kit works. The leveled spells ARE the kit, and this catches
      // the real failure: Bestow Curse on the snarecaller was cast zero times
      // in thirty fights, because a 3rd-level debuff loses to a 1st-level
      // lockdown in the same kit every time.
      const given = new Set(cast.flatMap((v) => MONSTERS[v]!.spellcasting!.spellIds));
      const never = [...given].filter((id) => SPELLS[id]!.level >= 1 && !seen.has(id));
      expect(never, `leveled spells given but never cast: ${never.join(', ')}`).toEqual([]);
    }, 40000);
  }

  /**
   * Shocking Grasp is an attack cantrip with range 0 — a touch. Handed to the
   * Gnoll Packcaller, a back-line caster that never closes, it was cast zero
   * times in thirty fights: a cantrip it could hold but never reach with.
   * Having *an* attack cantrip is not enough; it has to be one this monster can
   * use from where it actually fights.
   */
  it('no caster carries a cantrip it can never reach with', () => {
    const stranded: string[] = [];
    for (const m of Object.values(MONSTERS)) {
      if (!m.spellcasting) continue;
      const reach = m.spellcasting.spellIds
        .map((id) => SPELLS[id])
        .filter((s) => s && s.level === 0)
        .map((s) => ('range' in s!.targeting ? (s!.targeting as { range: number }).range : 30));
      if (reach.length > 0 && Math.max(...reach) < 30) stranded.push(m.id);
    }
    expect(stranded, `casters whose only cantrip is a touch: ${stranded.join(', ')}`).toEqual([]);
  });

  it('counts as ranged, so a wave built around one can punish standing still', () => {
    for (const v of VARIANTS) expect(canThreatenAtRange(v), v).toBe(true);
  });
});
