/**
 * Every combat spell a player class can reach has to be worth a number.
 *
 * THE FAILURE THIS EXISTS FOR
 *
 * `scoreSpell` is a switch. A spell with no case falls through to `return 0`,
 * which is below the end-turn threshold — so the AI never casts it. Not rarely:
 * never, in any fight, for any caster, forever. The spell still appears on the
 * character sheet, still occupies a slot in the class list, still shows up in
 * the reference docs. It is dead data that looks alive.
 *
 * This is not hypothetical. Faerie Fire went 40 runs without being cast once.
 * Ensnaring Strike was armed 24 times and fired zero. Both were found by
 * counting casts after the fact, which only works if somebody thinks to count.
 *
 * So: derive the covered set from the source, compare it against the spells the
 * classes actually hand out, and make anything left over a deliberate decision
 * with a reason next to it rather than an oversight.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPELLS } from '../src/data/spells.js';
import { CLASSES } from '../src/data/classes.js';
import { buildCharacter } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { Combat } from '../src/engine/combat.js';
import { chooseAction } from '../src/ai/greedy.js';
import type { Combatant, Position } from '../src/engine/types.js';

const GREEDY = fileURLToPath(new URL('../src/ai/greedy.ts', import.meta.url));

/**
 * Spells that score 0 on purpose. Each one needs a reason, because "nobody got
 * round to it" and "this cannot be priced" look identical from the outside.
 */
const DELIBERATELY_UNSCORED: Record<string, string> = {
  // Reactions. `tryCounterspell` and the Shield hook fire these; they are never
  // chosen from the action list, so a score would be read by nothing.
  shield: 'reaction, autocast',
  counterspell: 'reaction, autocast',
  // Valuing a teleport means valuing a POSITION, and every cheap proxy makes a
  // caster that runs from fights it was winning.
  'dimension-door': 'cannot price a position',
  // Same problem: the value of a fake noise in an empty square is entirely in
  // what a human opponent believes about it, and this AI believes nothing.
  'minor-illusion': 'value is in the deception, which nothing here models',
};

/** Every spell any player class can reach, that a fight can actually use. */
function playableCombatSpells(): string[] {
  const out = new Set<string>();
  for (const cls of Object.values(CLASSES)) {
    const sc = cls.spellcasting;
    if (!sc) continue;
    for (const id of Object.values(sc.spellsByLevel).flat()) {
      if (SPELLS[id] && !SPELLS[id]!.outOfCombat) out.add(id);
    }
  }
  return [...out].sort();
}

/** The spell ids `scoreSpell` has a case for, read off the switch itself. */
function scoredSpells(): Set<string> {
  const src = readFileSync(GREEDY, 'utf8');
  const body = src.slice(src.indexOf('function scoreSpell'));
  return new Set([...body.matchAll(/case '([a-z0-9-]+)':/g)].map((m) => m[1]!));
}

describe('spell scoring coverage', () => {
  it('scores every combat spell a class can reach', () => {
    const scored = scoredSpells();
    const missing = playableCombatSpells()
      .filter((id) => !scored.has(id) && !(id in DELIBERATELY_UNSCORED));
    // A spell here is one the AI will hold in its hand for the whole campaign.
    expect(missing, 'unscored spells the AI will never cast').toEqual([]);
  });

  it('keeps the exemption list honest', () => {
    // An exemption for a spell that no longer exists, or that has since been
    // given a case, is a comment that has stopped being true.
    const scored = scoredSpells();
    for (const [id, why] of Object.entries(DELIBERATELY_UNSCORED)) {
      expect(SPELLS[id], `${id} is exempted but does not exist`).toBeDefined();
      expect(why.length, `${id} needs a reason`).toBeGreaterThan(0);
      const reaction = SPELLS[id]!.castingTime === 'reaction';
      if (!reaction) expect(scored.has(id), `${id} is exempted but scored`).toBe(false);
    }
  });
});

// --- the cases actually fire ------------------------------------------------
//
// Coverage above proves a case EXISTS. It does not prove the case returns
// something big enough to beat a plain attack, which is the difference between
// a spell that gets cast and a spell that does not.

function board(
  spellId: string,
  foes: Position[],
  opts: { classId?: string; level?: number; monster?: string; allies?: Position[] } = {},
) {
  const me: Combatant = buildCharacter({
    classId: opts.classId ?? 'wizard', team: 'team1', position: { x: 0, y: 3 }, level: opts.level ?? 7,
  });
  // Two spells only: the one under test, and a cantrip. The question is never
  // "is this the best spell a level-7 wizard owns" — Fireball wins that on any
  // board wide enough to matter — but "does this beat doing the free thing",
  // which is the bar a case has to clear to ever be picked at all.
  me.spellIds = [spellId, 'fire-bolt'];
  // Starting scrolls are scored through `scoreSpell` too and outbid a buff, so
  // an inventory left in place tests the scroll rather than the spell.
  me.inventory = [];
  const enemies = foes.map((p, i) => ({
    ...buildMonster(opts.monster ?? 'orc', 'team2', p), id: `e${i}`, hp: 40, maxHp: 40,
  }));
  const allies = (opts.allies ?? []).map((p, i) => ({
    ...buildCharacter({ classId: 'fighter', team: 'team1', position: p, level: 5 }), id: `a${i}`,
  }));
  const c = new Combat({ combatants: [me, ...enemies, ...allies], seed: 4 });
  // chooseAction only ever offers actions to whoever's turn it is.
  let guard = 0;
  while (c.activeId !== me.id && guard++ < 20) c.apply({ kind: 'endTurn' });
  return { c, meId: me.id };
}

/** Does the greedy AI reach for this spell, given a board that suits it? */
function picks(
  spellId: string,
  foes: Position[],
  opts?: { classId?: string; level?: number; monster?: string; allies?: Position[] },
): boolean {
  const { c, meId } = board(spellId, foes, opts);
  const a = chooseAction(c.state, meId);
  return a.kind === 'castSpell' && a.spellId === spellId;
}

const CLUMP: Position[] = [{ x: 5, y: 2 }, { x: 6, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 3 }];

describe('the newly scored spells get cast', () => {
  it('drops Ice Storm on a clump', () => {
    expect(picks('ice-storm', [...CLUMP, { x: 5, y: 4 }])).toBe(true);
  });

  it('will not drop Ice Storm on a clump with a friend standing in it', () => {
    // The other half of scoring: a case that never says no is not a score.
    // An ally in the blast is priced at twice the damage, which is what stops a
    // druid hailing on its own front line. A druid rather than a wizard on
    // purpose: an evoker has Sculpt Spells from level 6 and is genuinely
    // allowed to drop it on a melee, so the wizard proves nothing here.
    expect(picks('ice-storm', [{ x: 5, y: 3 }], {
      classId: 'druid', allies: [{ x: 4, y: 3 }, { x: 6, y: 3 }],
    })).toBe(false);
  });

  it('drops Shatter on a clump', () => {
    expect(picks('shatter', CLUMP, { level: 5 })).toBe(true);
  });

  it('spends a 4th-level slot on Blight, Banishment and Phantasmal Killer', () => {
    // Three spells that existed in the class lists and had no case at all: held
    // for the whole campaign, cast zero times.
    for (const id of ['blight', 'banishment', 'phantasmal-killer']) {
      expect(picks(id, [{ x: 2, y: 3 }]), id).toBe(true);
    }
  });

  it('casts Mirror Image only when something is in reach', () => {
    // Priced off how many things can swing, so it takes a real threat to beat
    // just stabbing someone — which is the intended shape: one orc in reach is
    // not worth an action, three is.
    expect(picks('mirror-image', [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }], { level: 5 })).toBe(true);
    expect(picks('mirror-image', [{ x: 7, y: 7 }], { level: 5 })).toBe(false);
  });

  it('never casts Mirror Image on top of images already standing', () => {
    const { c, meId } = board('mirror-image', [{ x: 1, y: 3 }], { level: 5 });
    c.state.combatants[meId]!.mirrorImages = 3;
    const a = chooseAction(c.state, meId);
    expect(a.kind === 'castSpell' && a.spellId === 'mirror-image').toBe(false);
  });

  it('silences casters and nobody else', () => {
    // Silence over a pack of orcs is an action and a 2nd-level slot spent to
    // stop nothing, which is the whole reason the case counts spell lists
    // rather than bodies.
    expect(picks('silence', [{ x: 5, y: 2 }, { x: 5, y: 3 }], { monster: 'cult-fanatic' })).toBe(true);
    expect(picks('silence', [{ x: 5, y: 2 }, { x: 5, y: 3 }], { monster: 'orc' })).toBe(false);
  });
});
