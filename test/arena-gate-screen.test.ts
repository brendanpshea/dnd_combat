/**
 * The gate screen, and the check that used to be wedged into it.
 *
 * These read the component source rather than rendering it: every web test in
 * this repo runs without a DOM, and the two things worth defending here are
 * both structural — what the doors screen no longer carries, and the order in
 * which the check commits its result.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const ARENA = read('web/src/Arena.tsx');
const CSS = read('web/src/styles.css');

/** The JSX between two markers, so a rule can be scoped to one screen. */
function section(from: string, to: string): string {
  const a = ARENA.indexOf(from);
  expect(a, `marker not found: ${from}`).toBeGreaterThan(-1);
  const b = ARENA.indexOf(to, a);
  expect(b, `end marker not found: ${to}`).toBeGreaterThan(a);
  return ARENA.slice(a, b);
}

describe('the check has a screen of its own', () => {
  it('is a step, with a badge while the offer is still open', () => {
    expect(ARENA, 'no Check step in the step bar').toContain("setPanel('check')");
    expect(ARENA, 'the step never tells you an offer is waiting')
      .toMatch(/!gambitTaken && gambit && \(\s*<span className="prep-badge"/);
    expect(CSS, '.arena-check has no rule').toContain('\n.arena-check {');
  });

  it('does not leave the check on the doors screen as well', () => {
    // The whole point of the move. Two copies would both be live, and taking
    // one would silently change the other.
    const doors = section("<div className={panel === 'none' ? '' : 'hidden'}>", "{panel === 'check' &&");
    expect(doors.includes('SkillGambit'), 'the doors screen still carries the check').toBe(false);
  });
});

describe('the doors screen is for choosing a door', () => {
  const doors = () => section("<div className={panel === 'none' ? '' : 'hidden'}>", "{panel === 'check' &&");

  it('carries no stat blocks', () => {
    // Armour class, hit points and every immunity for each creature, on three
    // cards at once, above a row of portraits naming the same monsters again.
    expect(doors().includes('dossierFor'), 'the door cards still print stat blocks').toBe(false);
  });

  it('still shows who is behind the selected door', () => {
    // Decluttering must not take the faces and names with it — that is the one
    // thing on the screen that changes when you pick a different door.
    expect(doors(), 'the foe portraits are gone').toContain('arena-foes');
    expect(doors(), 'the foes are no longer named').toContain('MONSTERS[id]?.name');
  });

  it('does not print the size of the board', () => {
    // 8x10 is 8x10 whichever door you take, and it was on screen every visit.
    expect(doors().includes('grid.width'), 'the board dimensions are back').toBe(false);
    expect(doors(), 'the map theme went with them').toContain('wave.map.theme');
  });

  it('says the day has two fights once, not twice', () => {
    const twice = ARENA.split('what you spend now is gone').length - 1;
    expect(twice, 'the two-fights reminder is duplicated').toBeLessThanOrEqual(1);
  });
});

describe('the dice are watched before the result is kept', () => {
  /**
   * THE BUG THIS EXISTS FOR.
   *
   * Recording the attempt inside `onRoll` set `run.gambit`, which made
   * `gambitTaken` truthy, which swapped the whole branch for the one-line
   * result — unmounting SkillGambit and with it the DiceCheck overlay it had
   * just opened. The d20 was rolled, resolved and applied without ever being
   * shown. Measured in a browser at 390px: the scrim rendered zero times before
   * the fix and once after.
   */
  const gambitProps = () => section('onRoll={() => {\n                    const dc = gambitDc', 'onResolved={');

  it('does not persist the run while rolling', () => {
    const rolling = gambitProps();
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

  it('uses the same dice ritual the adventure does', () => {
    // Not a bespoke arena animation: DiceCheck is what adventure scenes have
    // used since they were written, and a d20 should look the same everywhere.
    const sg = read('web/src/SkillGambit.tsx');
    expect(sg, 'SkillGambit no longer shows DiceCheck').toContain('<DiceCheck');
    expect(sg, 'the overlay it renders into is gone').toContain('adv-dice-scrim');
  });
});
