import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MONSTERS, MONSTER_XP } from '../src/data/monsters.js';

/**
 * Every monster stat block, checked against the SRD text vendored at
 * `SRD_CC_v5.2.1.txt`: AC, HP, speed, the six ability scores, CR, XP and
 * creature type.
 *
 * Thirty-one numbers were wrong when this was written, none of them visible
 * from inside the game — a bear with the wrong Strength still mauls people, and
 * a dragon that walks 30 ft instead of 40 just feels a bit sluggish. The
 * clusters are what give the cause away:
 *
 *   nine ground speeds all sitting at exactly 30, on creatures the SRD gives
 *   40 or 50 (both wyrmling-sized dragons, the hydra, the remorhaz, the ochre
 *   jelly, the mammoth) — a default that was never edited;
 *
 *   eighteen ability scores, one or two per creature, of the kind you get from
 *   typing a stat block out of memory;
 *
 *   Dust and Steam Mephit XP the wrong way round, because 50/100 looks like it
 *   ought to split evenly by element and the SRD does not.
 *
 * The parsing handles three stat-line layouts the SRD uses interchangeably;
 * see `statLine`.
 */

const SRD = fileURLToPath(new URL('../SRD_CC_v5.2.1.txt', import.meta.url));

interface Block {
  name: string; type: string;
  ac: number; hp: number; speed: number; speedFull: string;
  abilities: Record<string, number>;
  cr?: number; xp?: number;
}

/**
 * The stat line appears as "AC n HP n Speed n ft.", as "AC n  HP n (dice)
 * Speed n ft." and as "AC n  Initiative +n (n) HP n (dice) Speed n ft., Climb
 * n ft." — so match the three fields independently rather than assuming an
 * order or a single space.
 */
function statLine(l: string): Omit<Block, 'name' | 'type' | 'abilities'> | null {
  if (!l.startsWith('AC ')) return null;
  const ac = l.match(/\bAC (\d+)/), hp = l.match(/\bHP (\d+)/), sp = l.match(/\bSpeed (\d+) ft/);
  if (!ac || !hp || !sp) return null;
  return {
    ac: Number(ac[1]), hp: Number(hp[1]), speed: Number(sp[1]),
    speedFull: (l.match(/\bSpeed ([^;]*?)(?:\s{2,}|$)/)?.[1] ?? '').trim(),
  };
}

function parseSrd(): Map<string, Block> {
  const lines = readFileSync(SRD, 'utf8').split('\n');
  const out = new Map<string, Block>();
  const ability = /(Str|Dex|Con|Int|Wis|Cha) (\d+) [+-]\d+ [+-]\d+/g;
  const kind = /^(Tiny|Small|Medium|Large|Huge|Gargantuan)(?: or \w+)? ([A-Za-z]+)/;

  for (let i = 0; i < lines.length; i++) {
    const stat = statLine(lines[i]!.trim());
    if (!stat) continue;
    // Above the stat line: the size/type/alignment line, and above that the
    // name (sometimes with blank lines or a form feed between).
    let k = i - 1, kindLine = '';
    while (k > i - 6 && k >= 0) {
      if (kind.test(lines[k]!.trim())) { kindLine = lines[k]!.trim(); break; }
      k--;
    }
    if (!kindLine) continue;
    let n = k - 1;
    while (n >= 0 && lines[n]!.trim() === '') n--;
    const name = (lines[n] ?? '').trim();
    if (!name || name.length > 44 || /[.:;]/.test(name)) continue;

    const abilities: Record<string, number> = {};
    for (let j = i; j < i + 14 && j < lines.length; j++) {
      for (const a of lines[j]!.matchAll(ability)) abilities[a[1]!.toLowerCase()] = Number(a[2]);
    }
    let cr: number | undefined, xp: number | undefined;
    for (let j = i; j < i + 20 && j < lines.length; j++) {
      const c = lines[j]!.match(/CR ([\d/]+) \(XP ([\d,]+)/);
      if (c) {
        const [a, b] = c[1]!.split('/');
        cr = b ? Number(a) / Number(b) : Number(a);
        xp = Number(c[2]!.replace(/,/g, ''));
        break;
      }
    }
    const key = name.toLowerCase();
    if (out.has(key)) continue;   // first block wins
    out.set(key, { name, type: kindLine.match(kind)![2]!.toLowerCase(), ...stat, abilities, cr, xp });
  }
  return out;
}

/**
 * Monsters SRD 5.2.1 does not carry under that name. Most are 2014 stat blocks
 * the 2024 SRD dropped; the rest are this game's own caster variants, which are
 * *meant* to be new (see caster-variants.test.ts for what holds them honest).
 */
const NOT_IN_SRD: Record<string, string> = {
  'goblin-hexer': "This game's own caster variant of the goblin.",
  'skeleton-bonechanter': "This game's own caster variant of the skeleton.",
  'kobold-emberling': "This game's own caster variant of the kobold.",
  'gnoll-packcaller': "This game's own caster variant of the gnoll.",
  'ettercap-snarecaller': "This game's own caster variant of the ettercap.",
  'azer-forgecaller': "This game's own caster variant of the azer.",
  'apprentice-mage': 'A junior Mage — this game\'s own, so a level-1 party has a caster it can survive.',
  'acolyte': 'A 2014 stat block. SRD 5.2.1 has "Priest Acolyte"; only the background keeps the bare name.',
  'orc': 'SRD 5.2.1 carries Orc only as a player species, not as a stat block.',
  'cult-fanatic': 'A 2014 stat block that SRD 5.2.1 does not carry.',
  'lizardfolk': 'A 2014 stat block that SRD 5.2.1 does not carry.',
  'banshee': 'A 2014 stat block that SRD 5.2.1 does not carry.',
  'mud-mephit': 'A 2014 stat block that SRD 5.2.1 does not carry.',
  'smoke-mephit': 'A 2014 stat block that SRD 5.2.1 does not carry.',
  'shadow-demon': 'A 2014 stat block that SRD 5.2.1 does not carry.',
  'scarecrow': 'A 2014 stat block that SRD 5.2.1 does not carry.',
};

/**
 * Fields that deliberately differ, with the reason. The big class is flight:
 * this engine has no third dimension, so a hovering creature with a 5 ft walk
 * and a 40 ft fly would shuffle one cell a turn. Those get one speed that
 * stands for how fast the thing actually moves around a battlefield.
 */
const DELIBERATE: Record<string, string> = {
  'air-elemental': 'Flier: SRD walks 10 and flies 90 (hover). No flight here, so one speed stands for both.',
  'ghost': 'Flier: SRD walks 5 and flies 40 (hover). No flight here, so one speed stands for both.',
  'wraith': 'Flier: SRD walks 5 and flies 60 (hover). No flight here, so one speed stands for both.',
  'flying-sword': 'Flier: SRD walks 5 and flies 50 (hover). No flight here, so one speed stands for both.',
  'specter': 'Flier: SRD walks 30 and flies 50 (hover). No flight here, so it moves at its fly speed.',
  'will-o-wisp': 'Flier: SRD walks 5 and flies 50 (hover). No flight here, so it moves at its fly speed.',
  'druid': 'Priced by what it plays like, not by its CR: 3rd-level slots on spells that re-fire every round for free are worth a great deal more than a CR 2 body. See the note on the stat block.',
};

describe('monster stat blocks against the SRD', () => {
  const srd = parseSrd();

  it('parses the stat blocks out of the vendored SRD', () => {
    // A layout change would make every assertion below pass vacuously.
    expect(srd.size, 'the parser found almost nothing — has the file changed shape?').toBeGreaterThan(300);
    expect(srd.get('ogre')).toMatchObject({ ac: 11, hp: 68, speed: 40, cr: 2, xp: 450, type: 'giant' });
    expect(srd.get('skeleton')).toMatchObject({ ac: 14, hp: 13, speed: 30 });
  });

  it('every monster is in the SRD, or is declared as not being', () => {
    const missing = Object.values(MONSTERS)
      .filter((m) => !srd.has(m.name.toLowerCase()) && !NOT_IN_SRD[m.id])
      .map((m) => `${m.id} ("${m.name}")`);
    expect(missing, `no SRD block under that name — a typo, or add it to NOT_IN_SRD with a reason: ${missing.join(', ')}`).toEqual([]);
  });

  it('every declared deviation still refers to a real monster, with a reason', () => {
    for (const [id, why] of Object.entries({ ...NOT_IN_SRD, ...DELIBERATE })) {
      expect(MONSTERS[id], `${id} is declared as a deviation but is not a monster any more`).toBeDefined();
      expect(why.length, `${id} has no reason given`).toBeGreaterThan(30);
    }
  });

  it('matches the SRD on AC, HP, speed, abilities, CR, XP and type', () => {
    const wrong: string[] = [];
    for (const m of Object.values(MONSTERS)) {
      const r = srd.get(m.name.toLowerCase());
      if (!r || DELIBERATE[m.id]) continue;
      const say = (s: string) => wrong.push(`${m.name}: ${s}`);

      if (r.ac !== m.ac) say(`AC ${m.ac}, SRD ${r.ac}`);
      if (r.hp !== m.hp) say(`HP ${m.hp}, SRD ${r.hp}`);
      if (r.speed !== m.speed) say(`speed ${m.speed}, SRD "${r.speedFull}"`);
      if (r.type !== m.creatureType) say(`type ${m.creatureType}, SRD ${r.type}`);
      for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
        if (r.abilities[a] !== undefined && r.abilities[a] !== m.abilities[a]) {
          say(`${a.toUpperCase()} ${m.abilities[a]}, SRD ${r.abilities[a]}`);
        }
      }
      // `cr` is omitted for CR <= 4, where the default PB of +2 is already right.
      if (r.cr !== undefined && (m.cr ?? 0) !== r.cr && !(m.cr === undefined && r.cr <= 4)) {
        say(`CR ${m.cr ?? '(omitted)'}, SRD ${r.cr}`);
      }
      if (r.xp !== undefined && MONSTER_XP[m.id] !== r.xp) say(`XP ${MONSTER_XP[m.id]}, SRD ${r.xp}`);
    }
    expect(wrong, `stat blocks that disagree with the SRD:\n${wrong.join('\n')}`).toEqual([]);
  });
});

describe('damage breaks concentration', () => {
  /**
   * "A creature takes damage while concentrating: Constitution save, DC 10 or
   * half the damage, whichever is higher." Implemented in applyDamage — but a
   * rule that fires on a path nothing exercises is indistinguishable from one
   * that does not exist, and until Spiritual Weapon and friends were corrected
   * to take concentration at all, there was very little holding it to test.
   *
   * Measured over 40 generated level-7 fights: 57 damage instances landed on a
   * concentrating creature, every one of them either rolled the save or dropped
   * the target outright, and 12 concentrations were lost to damage.
   */
  it('scales the DC with the damage, so a big hit is far harder to hold through', async () => {
    const { Combat } = await import('../src/engine/combat.js');
    const { buildCharacter } = await import('../src/builder/character.js');
    const { buildMonster } = await import('../src/data/monsters.js');
    const { applyDamage } = await import('../src/engine/rules/attack.js');

    const brokeAt = (damage: number): number => {
      let broke = 0;
      const N = 200;
      for (let seed = 1; seed <= N; seed++) {
        const cl = buildCharacter({
          classId: 'cleric', team: 'team1', level: 7, name: 'C', position: { x: 1, y: 1 }, speciesId: 'human',
        });
        const foe = { ...buildMonster('ogre', 'team2', { x: 5, y: 5 }), id: 'f' };
        const c = new Combat({ seed, width: 8, height: 8, combatants: [cl, foe] });
        const me = c.state.combatants[cl.id]!;
        me.concentratingOn = { spellId: 'bless', targetIds: [] };
        // Well clear of 0, so this measures the save and not the drop.
        me.hp = 500; me.maxHp = 500;
        applyDamage(c.state, cl.id, 'f', damage, 'slashing', []);
        if (!c.state.combatants[cl.id]!.concentratingOn) broke++;
      }
      return broke / N;
    };

    // DC 10 either way — a scratch and a solid hit are the same save.
    const light = brokeAt(4);
    expect(light, 'a light hit must sometimes break concentration').toBeGreaterThan(0.1);
    expect(light, 'a light hit must usually NOT break concentration').toBeLessThan(0.6);
    expect(brokeAt(20), 'DC is 10 until the damage passes 20').toBeCloseTo(light, 1);
    // DC 30: nothing a 7th-level cleric rolls saves this.
    expect(brokeAt(60), 'a 60-damage hit is DC 30 and must always break it').toBe(1);
  }, 30000);

  it('rolls the save whenever a concentrating creature is damaged and survives', async () => {
    const { Combat } = await import('../src/engine/combat.js');
    const { buildCharacter } = await import('../src/builder/character.js');
    const { buildMonster } = await import('../src/data/monsters.js');

    const cl = buildCharacter({
      classId: 'cleric', team: 'team1', level: 7, name: 'C', position: { x: 1, y: 1 }, speciesId: 'human',
    });
    const foe = { ...buildMonster('ogre', 'team2', { x: 2, y: 1 }), id: 'f' };
    const c = new Combat({ seed: 3, width: 8, height: 8, combatants: [cl, foe] });
    c.state.combatants[cl.id]!.concentratingOn = { spellId: 'bless', targetIds: [] };
    c.state.combatants[cl.id]!.hp = 400;
    c.state.combatants[cl.id]!.maxHp = 400;

    let damaged = 0, saves = 0;
    for (let round = 0; round < 60 && !c.isOver(); round++) {
      // Keep it concentrating so every hit is a fresh test.
      c.state.combatants[cl.id]!.concentratingOn ??= { spellId: 'bless', targetIds: [] };
      const hit = c.legalActions('f').find((a) => a.kind === 'attack' && a.targetId === cl.id);
      const events = c.apply(hit ?? { kind: 'endTurn' });
      events.forEach((e, i) => {
        if (e.type !== 'damageDealt' || e.targetId !== cl.id || e.amount <= 0) return;
        damaged++;
        if (events.slice(i + 1, i + 4).some((n) => n.type === 'savingThrow' && n.ability === 'con')) saves++;
      });
    }
    expect(damaged, 'the ogre never landed a hit — the test proves nothing').toBeGreaterThan(3);
    expect(saves, 'every damaging hit on a concentrating creature must call for a save').toBe(damaged);
  });
});
