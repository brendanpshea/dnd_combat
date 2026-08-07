/**
 * The gate screen, and the check that sits between it and the board.
 *
 * These read the component source rather than rendering it: every web test in
 * this repo runs without a DOM, and what is worth defending here is structural
 * — what the doors screen no longer carries, when the check is offered, and the
 * order in which it commits its result.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const ARENA = read('web/src/Arena.tsx');
const CSS = read('web/src/styles.css');

/** The source between two markers, so a rule can be scoped to one screen. */
function section(from: string, to: string): string {
  const a = ARENA.indexOf(from);
  expect(a, `marker not found: ${from}`).toBeGreaterThan(-1);
  const b = ARENA.indexOf(to, a);
  expect(b, `end marker not found: ${to}`).toBeGreaterThan(a);
  return ARENA.slice(a, b);
}

/*
 * The doors screen ONLY. A first version ran to the end of the scroll area,
 * which swallowed the stall panel — and the stall's haggle and pickpocket
 * controls are SkillGambits too, so "the check is not on the doors screen"
 * failed against a completely unrelated one.
 */
const doorsScreen = () => section("<div className={panel === 'none' ? '' : 'hidden'}>", "{panel === 'gear' && (");
const checkScreen = () => section("if (phase.p === 'check') {", "if (phase.p === 'summary') {");

describe('the check is offered between the door and the board', () => {
  /**
   * It had a step of its own, which made it optional in the worst way —
   * reported as "I don't see the gambits at all now, I click combat and it
   * immediately starts". It also let a player browse the three doors to see
   * which check each would offer and pick a door for its check: the offer is
   * drawn per door BECAUSE it is about that roster, so showing it before you
   * commit turned that into a shopping trip.
   */
  it('is a phase, not a step', () => {
    expect(ARENA, 'no check phase').toContain("p: 'check'");
    expect(ARENA.includes("setPanel('check')"), 'the check is a browsable step again').toBe(false);
    expect(ARENA.includes('🎲<small>Check</small>'), 'the Check tab is back in the step bar').toBe(false);
  });

  it('is reached by pressing the fight, and only while one is untaken', () => {
    const actions = section('THE CHECK SITS BETWEEN THE DOOR AND THE BOARD', "THE DAY'S STEPS");
    expect(actions, 'the fight does not route through the check')
      .toMatch(/gambit && !gambitTaken\s*\?\s*setPhase\(\{ p: 'check' \}\)/);
    expect(actions, 'there is no way into the fight at all')
      .toMatch(/setPhase\(\{ p: 'battle', combat: makeCombat/);
  });

  it('is silent when the fight licenses nothing', () => {
    // 0.5% of waves offer no skill. An interstitial saying so is a tap for
    // nothing, so the same button goes straight to the board.
    const actions = section('THE CHECK SITS BETWEEN THE DOOR AND THE BOARD', "THE DAY'S STEPS");
    expect(actions, 'a wave with no eligible check still stops the player')
      .toMatch(/:\s*setPhase\(\{ p: 'battle'/);
  });

  it('does not ask again on a retry', () => {
    /*
     * `attemptFor` is keyed to the day and half, and a defeat keeps `run.gambit`
     * while `gateLocked` pins the door — so the recorded attempt is still
     * live and `gambitTaken` is truthy. That is what stops a player rerolling a
     * bad check by losing the fight, and it is the same rule the wave itself
     * follows: a lost wave is a tactical problem, not a slot machine.
     */
    expect(ARENA, 'the attempt is no longer read back for this fight')
      .toContain('attemptFor(run.gambit, dayOf(run), half)');
  });

  it('carries its own way past, and its own way in', () => {
    const screen = checkScreen();
    expect(screen, 'no way to decline').toContain('Go in without it');
    expect(screen, 'no way into the fight from the check').toContain('makeCombat(c, run, wave)');
    // The decline bookkeeping the step version needed is gone with it: if the
    // check appears ON the fight press, declining simply starts the fight.
    expect(ARENA.includes('setDeclined('), 'the declined-set bookkeeping is back').toBe(false);
  });
});

describe('the dice are watched before the result is kept', () => {
  /**
   * Recording the attempt inside `onRoll` set `run.gambit`, which made
   * `gambitTaken` truthy, which swapped the branch for the one-line result —
   * unmounting SkillGambit and with it the DiceCheck overlay it had just
   * opened. The d20 was rolled, resolved and applied without ever being shown.
   * Measured in a browser: the scrim rendered zero times before the fix.
   */
  it('does not persist the run while rolling', () => {
    const rolling = section('onRoll={() => {', 'onResolved={');
    expect(rolling.includes('setRun('), 'onRoll commits the run and unmounts its own dice').toBe(false);
    expect(rolling.includes('persist('), 'onRoll persists and unmounts its own dice').toBe(false);
    expect(rolling, 'the roll is not being held anywhere').toContain('pendingGambit.current =');
  });

  it('persists once the player has seen it land', () => {
    const resolved = section('onResolved={() => {', '/>');
    expect(resolved, 'onResolved never commits the attempt').toContain('setRun(nextRun)');
    expect(resolved, 'the attempt is not persisted').toContain('persist(c, nextRun)');
    expect(resolved, 'the held roll is never cleared, so a second check reuses it')
      .toContain('pendingGambit.current = null');
  });

  it('does not launch the fight in the same tick as the roll', () => {
    /*
     * The attempt is committed in `onResolved` and `makeCombat` reads it back
     * through `applyGambit`. React state is async, so launching automatically
     * would build the combat from the pre-commit `run` and the outcome would
     * silently do nothing. The tap is also the beat that lets the player read
     * what happened.
     */
    const resolved = section('onResolved={() => {', '/>');
    expect(resolved.includes("p: 'battle'"), 'the fight launches inside onResolved').toBe(false);
    expect(checkScreen(), 'nothing takes the player onward after the dice')
      .toMatch(/<button className="primary" onClick=\{goIn\}/);
  });

  it('uses the same dice ritual the adventure does', () => {
    const sg = read('web/src/SkillGambit.tsx');
    expect(sg, 'SkillGambit no longer shows DiceCheck').toContain('<DiceCheck');
    expect(sg, 'the overlay it renders into is gone').toContain('adv-dice-scrim');
  });
});

describe('the doors screen is for choosing a door', () => {
  it('carries no stat blocks — and neither does anything else', () => {
    /*
     * Armour class, hit points and every immunity for each creature the party
     * could place, on three cards at once, above a row of portraits naming the
     * same monsters again. Asserted across the whole app rather than on one
     * screen, because the point is that the feature is gone: `lore.ts` went
     * with it, and a half-removed feature is a module nothing imports.
     */
    expect(ARENA.includes('dossierFor'), 'stat blocks are back somewhere in the arena').toBe(false);
    expect(ARENA.includes('passiveKnown'), 'the knowledge plumbing is back').toBe(false);
    expect(existsSync(fileURLToPath(new URL('../src/arena/lore.ts', import.meta.url))),
      'lore.ts is back, but nothing renders a dossier').toBe(false);
  });

  it('still shows who is behind the selected door', () => {
    // Decluttering must not take the faces and names with it — that is the one
    // thing on the screen that changes when you pick a different door.
    expect(doorsScreen(), 'the foe portraits are gone').toContain('arena-foes');
    expect(doorsScreen(), 'the foes are no longer named').toContain('MONSTERS[id]?.name');
  });

  it('does not print the size of the board', () => {
    // 8x10 is 8x10 whichever door you take, and it was on screen every visit.
    expect(doorsScreen().includes('grid.width'), 'the board dimensions are back').toBe(false);
    expect(doorsScreen(), 'the map theme went with them').toContain('wave.map.theme');
  });

  it('says the day has two fights once, not twice', () => {
    const twice = ARENA.split('what you spend now is gone').length - 1;
    expect(twice, 'the two-fights reminder is duplicated').toBeLessThanOrEqual(1);
  });

  it('does not show the check before the door is committed', () => {
    // The shopping trip: three doors, three offers, pick the door whose check
    // your party happens to be good at.
    expect(doorsScreen().includes('SkillGambit'), 'the check is browsable from the doors again').toBe(false);
    expect(doorsScreen().includes('go-setup'), 'the offer is being previewed on the doors screen').toBe(false);
  });
});

describe('the check screen is sized for a phone', () => {
  /**
   * These styles began inline on the gate card, where 11-12px was right for a
   * row wedged between other rows. On a screen of its own that is fine print —
   * reported as "on a phone it is tiny" — and it is the only thing on the
   * screen: one sentence, one button, one decision.
   */
  const sizeOf = (selector: string): number => {
    const i = CSS.indexOf(`\n${selector} {`);
    expect(i, `no rule for ${selector}`).toBeGreaterThan(-1);
    const body = CSS.slice(i, CSS.indexOf('}', i));
    const m = /font-size:\s*(\d+)px/.exec(body);
    expect(m, `${selector} sets no font-size`).not.toBeNull();
    return Number(m![1]);
  };

  it('gives the setup line and the button real type', () => {
    expect(sizeOf('.arena-check .gambit-offer .go-setup'),
      'the sentence the whole screen exists to ask is still fine print').toBeGreaterThanOrEqual(17);
    expect(sizeOf('.arena-check .gambit-offer .sg-title'),
      'the skill being rolled is still a chip label').toBeGreaterThanOrEqual(17);
  });

  it('beats the inline rules it has to override', () => {
    /*
     * `.gambit-offer .go-setup` carries two classes and sits later in the file,
     * so `.arena-check .go-setup` — equally specific — lost silently. Measured
     * in a browser: the button grew and the text stayed at 12px.
     */
    expect(CSS, 'the override is no more specific than the rule it must beat')
      .toContain('.arena-check .gambit-offer .go-setup {');
  });

  it("leaves the stall's inline checks alone", () => {
    // The same component is the haggle and pickpocket control, which sit beside
    // prices and should stay small. Every enlargement is scoped.
    const block = CSS.slice(CSS.indexOf('.arena-check {'), CSS.indexOf('.lore-row {'));
    const unscoped = block.split('\n').filter((l) =>
      /^\.(skill-gambit|sg-title|sg-math|go-setup)/.test(l.trim()));
    expect(unscoped, `these grow the stall's controls too: ${unscoped.join(' ')}`).toEqual([]);
  });
});
