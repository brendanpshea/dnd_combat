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
  'orc': 'SRD 5.2.1 carries Orc only as a player species. Presented here as an Orc Raider — a soldier who happens to be an orc, the way the 2024 books name their stat blocks.',
  'cult-fanatic': 'A 2014 stat block that SRD 5.2.1 does not carry.',
  'lizardfolk': 'A 2014 stat block that SRD 5.2.1 does not carry. Presented as a Lizardfolk Skirmisher, after the SRD\'s own Merfolk Skirmisher.',
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

/**
 * The equipment tables. Both were clean apart from one entry, and that one is
 * the interesting kind: `greatclub` was 2d8 — the *ogre's* club (SRD Ogre hits
 * for 2d8 + 4) sitting on the bare id, beside a correctly-named `ogre-javelin`.
 * Nothing bought it and nothing was wrong in play; it just meant the id that
 * looks like the equipment-table Greatclub was twice its size.
 *
 * Only base ids are compared. A dozen monster weapons are *named* after a
 * player weapon while being scaled up, which is fine — an ettin's battleaxe
 * should hit harder than one off the rack.
 */
describe('weapons and armor against the SRD', () => {
  const lines = readFileSync(SRD, 'utf8').split('\n');

  it('matches the SRD weapon table on damage and damage type', async () => {
    const { WEAPONS } = await import('../src/data/weapons.js');
    const region = lines.slice(9120, 9345).map((l) => l.trim()).filter(Boolean);
    const dmg = /^(\d+d\d+|\d+) (Bludgeoning|Piercing|Slashing)$/;
    const srd = new Map<string, { dice: string; type: string }>();
    for (let i = 0; i < region.length; i++) {
      // Rows land on one line ("Light Hammer 1d4 Bludgeoning") or two.
      const one = region[i]!.match(/^(.+?) (\d+d\d+|\d+) (Bludgeoning|Piercing|Slashing)$/);
      if (one) { srd.set(one[1]!.toLowerCase(), { dice: one[2]!, type: one[3]!.toLowerCase() }); continue; }
      const d = region[i]!.match(dmg);
      if (d && i > 0 && /^[A-Z][A-Za-z ]+$/.test(region[i - 1]!)) {
        srd.set(region[i - 1]!.toLowerCase(), { dice: d[1]!, type: d[2]!.toLowerCase() });
      }
    }
    expect(srd.size, 'the weapon table did not parse').toBeGreaterThan(30);
    expect(srd.get('longbow')).toEqual({ dice: '1d8', type: 'piercing' });

    const wrong: string[] = [];
    for (const w of Object.values(WEAPONS)) {
      const r = srd.get(w.id.replace(/-/g, ' '));
      if (!r) continue;   // natural attacks, magic variants, monster-scaled gear
      if (r.dice !== w.damage) wrong.push(`${w.id}: damage ${w.damage}, SRD ${r.dice}`);
      if (r.type !== w.damageType) wrong.push(`${w.id}: type ${w.damageType}, SRD ${r.type}`);
    }
    expect(wrong, `weapons that disagree with the SRD:\n${wrong.join('\n')}`).toEqual([]);
  });

  it('matches the SRD armor table on base AC and Dex cap', async () => {
    const { ARMOR } = await import('../src/data/armor.js');
    const region = lines.slice(9335, 9410).map((l) => l.trim()).filter(Boolean);
    const srd = new Map<string, { base: number; cap: 'full' | 'none' | number }>();
    const read = (name: string, ac: string, max: string | undefined, dex: boolean) => {
      if (!/^[A-Z][A-Za-z ]+$/.test(name)) return;
      srd.set(name.toLowerCase(), { base: Number(ac), cap: dex ? (max ? Number(max) : 'full') : 'none' });
    };
    for (let i = 0; i < region.length; i++) {
      const dex = /Dex modifier/.test(region[i]!);
      const alone = region[i]!.match(/^(\d+)(?: \+ Dex modifier(?: \(max (\d+)\))?)?$/);
      if (alone) { if (i > 0) read(region[i - 1]!, alone[1]!, alone[2], dex); continue; }
      const one = region[i]!.match(/^(.+?) (\d+)(?: \+ Dex modifier(?: \(max (\d+)\))?)?$/);
      if (one) read(one[1]!, one[2]!, one[3], dex);
    }
    expect(srd.size, 'the armor table did not parse').toBeGreaterThan(10);
    expect(srd.get('plate armor')).toEqual({ base: 18, cap: 'none' });

    const wrong: string[] = [];
    for (const a of Object.values(ARMOR)) {
      // "Leather" here, "Leather Armor" in the table.
      const r = srd.get(a.name.toLowerCase()) ?? srd.get(`${a.name.toLowerCase()} armor`);
      if (!r) continue;   // +1 and adamantine variants
      if (r.base !== a.base) wrong.push(`${a.id}: base ${a.base}, SRD ${r.base}`);
      if (String(r.cap) !== String(a.dexCap)) wrong.push(`${a.id}: dexCap ${a.dexCap}, SRD ${r.cap}`);
    }
    expect(wrong, `armor that disagrees with the SRD:\n${wrong.join('\n')}`).toEqual([]);
  });
});
