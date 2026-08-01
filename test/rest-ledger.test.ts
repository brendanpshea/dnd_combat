/**
 * A rest shown as movement, and the two rests moving differently.
 *
 * The arena reported a rest as one party total — "+12 HP, 2 hit dice" — which
 * is right for a log line and wrong for a screen. A total cannot show whose bar
 * moved, and, more importantly, it cannot show that a LUNCH SPENDS something to
 * buy those hit points while a NIGHT simply hands everything back.
 *
 * That difference is the arena's whole day model, so it is the thing worth
 * testing: a lunch must debit, a night must not.
 */
import { describe, it, expect } from 'vitest';
import { newCampaign, buildCampaignParty, LEVEL_XP, type CampaignState } from '../src/campaign/campaign.js';
import { lunch, night, snapshotRest, restLedger, restLine } from '../src/arena/day.js';

/**
 * A party that has been through a fight: hurt, some dice and slots spent.
 *
 * `newCampaign`'s first argument is a SEED, not a level — the party is level 1
 * until it has XP, so a level-1 hero has one hit die and `level - 1` left it
 * with none to spend. The XP is what makes this a party with resources to lose.
 */
function bruised(level = 5): CampaignState {
  const c = newCampaign(1);
  c.xp = LEVEL_XP[level - 1] ?? 0;
  const party = buildCampaignParty(c);
  c.characters.forEach((ch, i) => {
    const built = party[i]!;
    ch.resources = {
      ...ch.resources,
      hp: Math.max(1, Math.floor(built.maxHp / 3)),
      hitDice: Math.max(0, built.level - 1),
      ...(built.spellSlots.length > 0
        ? { slots: built.spellSlots.map(() => 0) }
        : {}),
    };
  });
  return c;
}

describe('the rest ledger reports movement, not a total', () => {
  it('gives a row per hero with a before and an after', () => {
    const c = bruised();
    const before = snapshotRest(c);
    night(c, 1);
    const rows = restLedger(before, snapshotRest(c));
    expect(rows.length).toBe(c.characters.length);
    for (const r of rows) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.hp.max).toBeGreaterThan(0);
      expect(r.hp.to).toBeGreaterThanOrEqual(r.hp.from);
    }
  });

  it('survives a mismatched pair rather than throwing', () => {
    // Defensive: the two snapshots come from either side of a mutation, and a
    // screen going blank mid-rest would be worse than a row that did not move.
    const c = bruised();
    const before = snapshotRest(c);
    expect(() => restLedger(before, [])).not.toThrow();
    expect(restLedger(before, []).length).toBe(before.length);
  });
});

describe('a lunch spends to heal', () => {
  it('takes hit dice off somebody and puts hit points on', () => {
    const c = bruised();
    const before = snapshotRest(c);
    const rest = lunch(c);
    const rows = restLedger(before, snapshotRest(c));
    expect(rest.hitDiceSpent, 'a lunch reported no hit dice at all').toBeGreaterThan(0);
    expect(rows.some((r) => r.hitDice.to < r.hitDice.from),
      'nobody spent a hit die at lunch — the ledger cannot show a cost').toBe(true);
    expect(rows.some((r) => r.hp.to > r.hp.from), 'lunch healed nobody').toBe(true);
  });

  it('does not hand hit dice back', () => {
    // The debit is the point. If lunch restored dice it would be a long rest
    // with extra steps, and the day model would collapse.
    const c = bruised();
    const before = snapshotRest(c);
    lunch(c);
    const rows = restLedger(before, snapshotRest(c));
    expect(rows.every((r) => r.hitDice.to <= r.hitDice.from),
      'a lunch gave hit dice back').toBe(true);
  });

  it('leaves somebody short of full — it is a short rest', () => {
    const c = bruised();
    const before = snapshotRest(c);
    lunch(c);
    const rows = restLedger(before, snapshotRest(c));
    // Not a strict guarantee for every party, but a lunch that always topped
    // everyone to full would make the night pointless. At minimum it must not
    // restore spent SLOTS, which is the resource the afternoon runs on.
    const casters = rows.filter((r) => r.slots.from.length > 0);
    for (const r of casters) {
      const gained = r.slots.to.reduce((n, v, i) => n + v - (r.slots.from[i] ?? 0), 0);
      // Arcane / Natural Recovery may hand a couple back; a full refill is the
      // night's job.
      const full = r.slots.to.reduce((n, v) => n + v, 0);
      const capacity = buildCampaignParty(c)[rows.indexOf(r)]?.spellSlots.reduce((n, s) => n + s.max, 0) ?? 0;
      expect(gained, 'lunch refilled a caster completely').toBeLessThan(Math.max(1, capacity));
      expect(full).toBeLessThanOrEqual(capacity);
    }
  });
});

describe('a night restores', () => {
  it('fills hit points, hit dice and slots', () => {
    const c = bruised();
    const before = snapshotRest(c);
    night(c, 1);
    const rows = restLedger(before, snapshotRest(c));
    for (const r of rows) {
      expect(r.hp.to, `${r.name} did not wake at full hit points`).toBe(r.hp.max);
      expect(r.hitDice.to, `${r.name} did not get their hit dice back`).toBe(r.hitDice.max);
      const slotsBack = r.slots.to.reduce((n, v) => n + v, 0);
      const slotsBefore = r.slots.from.reduce((n, v) => n + v, 0);
      expect(slotsBack, `${r.name} woke with fewer slots than they went to bed with`)
        .toBeGreaterThanOrEqual(slotsBefore);
    }
  });

  it('shows the slots coming back, not just their final value', () => {
    // `bruised` empties every caster, so a night MUST show movement. Reporting
    // the after-value as the before-value would draw a full bar that never
    // filled — right number, no event.
    const c = bruised();
    const before = snapshotRest(c);
    night(c, 1);
    const rows = restLedger(before, snapshotRest(c));
    const casters = rows.filter((r) => r.slots.to.length > 0);
    expect(casters.length, 'no casters in the party — the fixture tests nothing').toBeGreaterThan(0);
    for (const r of casters) {
      expect(r.slots.from.reduce((n, v) => n + v, 0), `${r.name} started the night with slots`).toBe(0);
      expect(r.slots.to.reduce((n, v) => n + v, 0), `${r.name} gained no slots overnight`).toBeGreaterThan(0);
    }
  });

  it('debits nothing', () => {
    const c = bruised();
    const before = snapshotRest(c);
    night(c, 1);
    const rows = restLedger(before, snapshotRest(c));
    expect(rows.every((r) => r.hitDice.to >= r.hitDice.from), 'the night charged a hit die').toBe(true);
    expect(rows.every((r) => r.hp.to >= r.hp.from), 'the night cost somebody hit points').toBe(true);
  });
});

describe('the one line says what happened', () => {
  it('differs between a lunch and a night on the same party', () => {
    const a = bruised();
    const beforeA = snapshotRest(a);
    const lunchRest = lunch(a);
    const lunchLine = restLine('morning', restLedger(beforeA, snapshotRest(a)), lunchRest);

    const b = bruised();
    const beforeB = snapshotRest(b);
    const nightRest = night(b, 1);
    const nightLine = restLine('night', restLedger(beforeB, snapshotRest(b)), nightRest);

    expect(lunchLine).not.toBe(nightLine);
    for (const line of [lunchLine, nightLine]) {
      expect(line.length, 'an empty line is worse than none').toBeGreaterThan(10);
      expect(line.length, 'this is read ten times a run — keep it to one line').toBeLessThan(120);
    }
  });

  it('depends on which rest it was, not only on what happened', () => {
    // The same ledger and the same result, asked twice. If the kind is ignored
    // the two come back identical — which is what a shared line would be.
    const c = bruised();
    const before = snapshotRest(c);
    const rest = lunch(c);
    const rows = restLedger(before, snapshotRest(c));
    expect(restLine('night', rows, rest), 'the line ignores which rest it describes')
      .not.toBe(restLine('morning', rows, rest));
  });

  it('never comes back empty, whatever the party looks like', () => {
    // Every branch, including the plain fallback: a rest that says nothing is
    // worse than one that says something obvious.
    const shapes: Array<(c: CampaignState) => void> = [
      () => {},                                              // hurt, dice left
      (c) => { c.characters[0]!.resources = { ...c.characters[0]!.resources, hp: 0 }; },
      (c) => c.characters.forEach((ch, i) => {
        // Spread `hp` explicitly: `ch.resources` is optional, so spreading it
        // alone can produce an object without the required field.
        ch.resources = { hp: buildCampaignParty(c)[i]!.hp, ...ch.resources, hitDice: 0 };
      }),
      (c) => c.characters.forEach((ch, i) => {
        ch.resources = { ...ch.resources, hp: buildCampaignParty(c)[i]!.maxHp };
      }),
      // Hurt, plenty of dice, and slots already FULL — so nobody is raised,
      // nobody runs dry, and Arcane Recovery has nothing to hand back. That is
      // the only way to reach the plain fallback line, and without it every
      // earlier branch fires first and the fallback is never exercised.
      (c) => c.characters.forEach((ch, i) => {
        const built = buildCampaignParty(c)[i]!;
        ch.resources = {
          ...ch.resources,
          hp: Math.max(1, built.maxHp - 6),
          hitDice: built.level,
          ...(built.spellSlots.length > 0
            ? { slots: built.spellSlots.map((slot) => slot.max) }
            : {}),
        };
      }),
    ];
    for (const [i, shape] of shapes.entries()) {
      for (const kind of ['morning', 'night'] as const) {
        const c = bruised();
        shape(c);
        const before = snapshotRest(c);
        const rest = kind === 'night' ? night(c, 1) : lunch(c);
        const line = restLine(kind, restLedger(before, snapshotRest(c)), rest);
        expect(line.trim().length, `shape ${i} / ${kind} produced no line`).toBeGreaterThan(10);
      }
    }
  });

  it('names the hero it raised', () => {
    // The branch that carries the most information: somebody was at 0.
    const c = bruised();
    const party = buildCampaignParty(c);
    c.characters[0]!.resources = { ...c.characters[0]!.resources, hp: 0 };
    const name = party[0]!.name;
    const before = snapshotRest(c);
    const rest = lunch(c);
    const line = restLine('morning', restLedger(before, snapshotRest(c)), rest);
    if ((rest.revived ?? 0) > 0) {
      expect(line, 'the line did not name the hero it raised').toContain(name);
    }
  });

  it('is never empty for any rest it might be handed', () => {
    for (const kind of ['morning', 'afternoon', 'night'] as const) {
      const c = bruised();
      const before = snapshotRest(c);
      const rest = kind === 'night' ? night(c, 1) : lunch(c);
      const line = restLine(kind, restLedger(before, snapshotRest(c)), rest);
      expect(line.trim().length, `${kind} produced no line`).toBeGreaterThan(0);
    }
  });
});
