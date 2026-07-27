import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildParty } from '../src/builder/character.js';
import { buildMonster, MONSTERS, MONSTER_XP, canThreatenAtRange } from '../src/data/monsters.js';
import { SPELLS } from '../src/data/spells.js';
import { generateArenaMap } from '../src/arena/map.js';
import { deployFoes } from '../src/arena/deploy.js';
import { parseMap } from '../src/data/maps.js';
import { chooseActionSim, SIM_PRESETS } from '../src/ai/simulated.js';

const VARIANTS = ['goblin-hexer', 'kobold-emberling', 'skeleton-bonechanter', 'apprentice-mage'];

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
  it('the AI actually casts what these monsters were given', () => {
    // 30 seeds, not 12. A situational self-buff like False Life fires in about
    // one fight in eight, so a 12-fight sweep found it only sometimes and the
    // test flaked when unrelated weight changes made it slightly rarer. Sized
    // off the measured rate (6 casts in 50 fights) with room to spare.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const m = generateArenaMap({}, (seed * 2654435761) >>> 0);
      const grid = parseMap(m.value.map);
      const spots = deployFoes(grid, VARIANTS.length, seed);
      const foes = VARIANTS.map((id, i) => ({
        ...buildMonster(id, 'team2', spots.value.positions[i]!), id: `m${i}`,
      }));
      const c = new Combat({ seed, map: m.value.map, combatants: [...buildParty('team1', 0, 3), ...foes] });
      for (let i = 0; i < 1500 && !c.isOver(); i++) {
        const a = chooseActionSim(c.state, c.activeId, SIM_PRESETS.easy);
        if (a.kind === 'castSpell' && c.state.combatants[c.activeId]!.team === 'team2') seen.add(a.spellId);
        c.apply(a);
      }
    }
    const given = new Set(VARIANTS.flatMap((v) => MONSTERS[v]!.spellcasting!.spellIds));
    const never = [...given].filter((s) => !seen.has(s));
    expect(never, `given but never cast: ${never.join(', ')}`).toEqual([]);
  }, 30000);

  it('counts as ranged, so a wave built around one can punish standing still', () => {
    for (const v of VARIANTS) expect(canThreatenAtRange(v), v).toBe(true);
  });
});
