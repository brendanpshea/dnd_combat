import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLASSES } from '../src/data/classes.js';
import { FEATURES } from '../src/data/features.js';

/**
 * Which class features arrive at which level, against the SRD.
 *
 * The features *table* in the SRD runs its columns together when the PDF is
 * flattened ("...Fast Movement Subclass feature Feral Instinct..."), so it is
 * not parseable. The prose is: every feature has a `Level N: Name` heading in
 * its class's section, which is unambiguous and is what this reads.
 *
 * Two things were wrong:
 *
 *   Disciple of Life was granted at cleric 1. It is a Life Domain feature and
 *   the SRD gives it at 3, which is when a cleric picks a domain at all — so
 *   the level-1 cleric was walking around with two levels of subclass early.
 *
 *   Assassinate was the rogue's level-3 feature. It is in neither the 2014 nor
 *   the 2024 SRD: the SRD's only rogue subclass is the Thief. Replaced with
 *   Fast Hands. The Assassin *monster* keeps the feature — that stat block is
 *   in SRD 5.2.1.
 *
 * The check is deliberately one-directional. "The SRD has a feature we do not"
 * is the normal state of a game that implements a subset — this is a combat
 * simulator with no exploration, no downtime and one subclass per class. What
 * it will not tolerate is the reverse: a feature we grant at a level the SRD
 * disagrees with, or one the SRD has never heard of.
 */

const SRD = fileURLToPath(new URL('../SRD_CC_v5.2.1.txt', import.meta.url));

/** class id -> level -> feature names, from the `Level N: Name` headings. */
function parseSrd(): Map<string, Map<number, string[]>> {
  const lines = readFileSync(SRD, 'utf8').split('\n');
  const starts: Array<[string, number]> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.trim().match(/^Core (\w+) Traits$/);
    if (m) starts.push([m[1]!.toLowerCase(), i]);
  }
  // The last class section runs to the Spells chapter, not to end of file.
  const last = starts[starts.length - 1]![1];
  const end = lines.findIndex((l, i) => i > last && l.trim() === 'Spells');

  const out = new Map<string, Map<number, string[]>>();
  for (let s = 0; s < starts.length; s++) {
    const [cls, from] = starts[s]!;
    const to = s + 1 < starts.length ? starts[s + 1]![1] : (end > 0 ? end : lines.length);
    const byLevel = new Map<number, string[]>();
    for (let i = from; i < to; i++) {
      const m = lines[i]!.trim().match(/^Level (\d+): (.+)$/);
      if (!m) continue;
      const list = byLevel.get(Number(m[1])) ?? [];
      if (!list.includes(m[2]!.trim())) list.push(m[2]!.trim());
      byLevel.set(Number(m[1]), list);
    }
    out.set(cls, byLevel);
  }
  return out;
}

/**
 * Features we grant that the SRD does not name at that level, each with the
 * reason. Two shapes recur:
 *
 *  - a 2024 feature that is a *choice* between named options, where we
 *    implement one option and name the feature after the option rather than
 *    the choice (Blessed Strikes -> Potent Spellcasting);
 *  - a feature the SRD names in the subclass section, which the heading scan
 *    attributes to the subclass rather than the class.
 */
const DELIBERATE: Record<string, string> = {
  'potent-spellcasting': "Cleric 7 Blessed Strikes and Druid 7 Elemental Fury are each a choice between two named options. This is the Potent Spellcasting option of both, and carries the option's name because that is what it does.",
  'escape-the-horde': 'Ranger 7 Defensive Tactics is a choice between two named options; this is the Escape the Horde one.',
  'divine-smite': "Paladin 2 is Paladin's Smite, which grants the Divine Smite spell always-prepared. The spell is the part with mechanical effect here, so it carries the name.",
  'flurry-of-blows': "Monk 2 is Monk's Focus, whose whole content is three named techniques sharing one pool. Each is a separate feature here because each is a separate button; the SRD writes them as sub-headings, so they have no `Level N:` line of their own.",
  'patient-defense': "As Flurry of Blows: one of Monk's Focus's three techniques.",
  'step-of-the-wind': "As Flurry of Blows: one of Monk's Focus's three techniques.",
  'monk-defense': 'Monk 1 Unarmored Defense. Its id differs from the barbarian feature of the same name because the two add different abilities and the monk forbids a shield.',
};

describe('class features against the SRD', () => {
  const srd = parseSrd();

  it('finds a level heading for every class it should', () => {
    expect(srd.size, 'no class sections parsed').toBeGreaterThanOrEqual(12);
    expect(srd.get('cleric')?.get(3), 'cleric level 3').toContain('Cleric Subclass');
    expect(srd.get('rogue')?.get(1), 'rogue level 1').toContain('Sneak Attack');
    // The one that was wrong: Disciple of Life is a level-3 feature.
    expect(srd.get('cleric')?.get(3)).toContain('Disciple of Life');
    expect(srd.get('cleric')?.get(1) ?? []).not.toContain('Disciple of Life');
  });

  it('grants nothing at a level the SRD puts elsewhere, or does not have at all', () => {
    const wrong: string[] = [];
    for (const cls of Object.values(CLASSES)) {
      const byLevel = srd.get(cls.id);
      if (!byLevel) continue;   // a class this game invented would say so here
      // Every SRD name for this class, and the levels it appears at.
      const levelsOf = new Map<string, number[]>();
      for (const [lvl, names] of byLevel) {
        for (const n of names) levelsOf.set(n.toLowerCase(), [...(levelsOf.get(n.toLowerCase()) ?? []), lvl]);
      }
      for (const [lvlStr, ids] of Object.entries(cls.featuresByLevel)) {
        const lvl = Number(lvlStr);
        for (const id of ids) {
          if (DELIBERATE[id]) continue;
          const name = (FEATURES[id]?.name ?? id).toLowerCase();
          // Our names carry qualifiers the SRD's do not ("Channel Divinity:
          // Preserve Life" vs "Channel Divinity", "Sculpt Spells (Evoker)"),
          // so match on the parts — but take the MOST SPECIFIC candidate, not
          // the first. Taking the first matched "Channel Divinity: Preserve
          // Life" against plain "Channel Divinity" at level 2 and reported a
          // level error for a feature that is correctly at 3; and "Potent
          // Spellcasting" against plain "Spellcasting" at level 1.
          const bare = name.replace(/\s*\(.*\)$/, '');
          const tail = bare.includes(': ') ? bare.slice(bare.indexOf(': ') + 2) : bare;
          // Rank: the whole name, then the part after the colon, then the
          // part before it. "Channel Divinity: Preserve Life" must find
          // "Preserve Life" (level 3) ahead of bare "Channel Divinity"
          // (level 2), or a correct feature reads as a level error.
          const rank = ([n]: [string, number[]]): number =>
            n === bare ? 0 : n === tail ? 1 : bare.startsWith(`${n}:`) ? 2 : 99;
          const hit = [...levelsOf.entries()]
            .filter((e) => rank(e) < 99)
            .sort((a, b) => rank(a) - rank(b))[0];
          if (!hit) {
            wrong.push(`${cls.id} L${lvl}: "${FEATURES[id]?.name ?? id}" is not an SRD ${cls.id} feature at any level`);
          } else if (!hit[1].includes(lvl)) {
            wrong.push(`${cls.id} L${lvl}: "${FEATURES[id]?.name ?? id}" — SRD has it at ${hit[1].join('/')}`);
          }
        }
      }
    }
    expect(wrong, `class features that disagree with the SRD:\n${wrong.join('\n')}`).toEqual([]);
  });

  it('every declared deviation is still granted by some class, with a reason', () => {
    const granted = new Set(Object.values(CLASSES).flatMap((c) => Object.values(c.featuresByLevel).flat()));
    for (const [id, why] of Object.entries(DELIBERATE)) {
      expect(granted.has(id), `${id} is declared as a deviation but no class grants it`).toBe(true);
      expect(why.length, `${id} has no reason given`).toBeGreaterThan(30);
    }
  });
});
