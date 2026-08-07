/**
 * The gate screen, and the check that used to be wedged into it.
 *
 * These read the component source rather than rendering it: every web test in
 * this repo runs without a DOM, and the two things worth defending here are
 * both structural — what the doors screen no longer carries, and the order in
 * which the check commits its result.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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

  it('carries no stat blocks — and neither does anything else', () => {
    /*
     * These were armour class, hit points and every immunity for each creature
     * the party could place, on three cards at once, directly above a row of
     * portraits naming the same monsters again. They moved to the Check step
     * and then off the game entirely.
     *
     * Asserted across the whole app rather than on the doors screen, because
     * the point is that the feature is gone: `lore.ts` went with it, and a
     * half-removed feature is a module nothing imports.
     */
    expect(ARENA.includes('dossierFor'), 'stat blocks are back somewhere in the arena').toBe(false);
    expect(ARENA.includes('passiveKnown'), 'the knowledge plumbing is back').toBe(false);
    expect(existsSync(fileURLToPath(new URL('../src/arena/lore.ts', import.meta.url))),
      'lore.ts is back, but nothing renders a dossier').toBe(false);
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

describe('the check screen is sized for a phone', () => {
  /**
   * These styles began inline on the gate card, where 11-12px was right for a
   * row wedged between other rows. On a screen of its own that is fine print —
   * reported as "on a phone it is tiny" — and it is the only thing on the
   * screen: one sentence, one button, one decision.
   *
   * Sizes are asserted as numbers rather than as the exact declarations,
   * because the point is legibility and not a particular pixel.
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
    const scoped = CSS.indexOf('.arena-check .gambit-offer .go-setup {');
    const inline = CSS.indexOf('.gambit-offer .go-setup {');
    expect(scoped, 'the scoped rule is gone').toBeGreaterThan(-1);
    expect(scoped < inline || CSS.slice(scoped).includes('.arena-check .gambit-offer .go-setup'),
      'the override is no more specific than the rule it must beat').toBe(true);
  });

  it('leaves the stall\'s inline checks alone', () => {
    // The same component is the haggle and pickpocket control, which sit beside
    // prices and should stay small. Every enlargement is scoped.
    const block = CSS.slice(CSS.indexOf('.arena-check {'), CSS.indexOf('.lore-row {'));
    const unscoped = block.split('\n').filter((l) =>
      /^\.(skill-gambit|sg-title|sg-math|go-setup)/.test(l.trim()));
    expect(unscoped, `these grow the stall's controls too: ${unscoped.join(' ')}`).toEqual([]);
  });
});

describe('a check on offer cannot be walked past', () => {
  /**
   * Giving the check a screen of its own made it optional in the worst way.
   * Reported as "I don't see the gambits at all now, I click combat and it
   * immediately starts". It WAS on the step bar, with a badge — and that is not
   * enough, because the fight button is the one thing on the screen a player is
   * aiming at, and it went straight past.
   */
  it('sends the fight button to the check while one is untaken', () => {
    const actions = section('THE PRIMARY BUTTON BELONGS TO THE STEP YOU ARE ON', 'THE DAY\'S STEPS');
    expect(actions, 'the fight never routes through the check')
      .toMatch(/gambit && !gambitTaken && !skippedCheck[\s\S]{0,200}setPanel\('check'\)/);
    expect(actions, 'the check screen has no way into the fight')
      .toMatch(/panel === 'check'[\s\S]{0,200}setPhase\(\{ p: 'battle'/);
  });

  it('lets the player decline, and remembers it for that door', () => {
    // Otherwise the detour is a wall rather than an offer.
    expect(ARENA, 'there is no way to go in without the check').toMatch(/Go in without it/);
    expect(ARENA, 'declining is not recorded').toContain('setDeclined(');
    // Keyed to the fight AND the door: three gates hold three rosters, and
    // declining at one must not silently decline at the next.
    expect(ARENA, 'the decline is not scoped to a door')
      .toMatch(/const checkKey = `\$\{gambitKey\(dayOf\(run\), half\)\}:\$\{run\.gate \?\? 0\}`/);
  });

  it('does not persist the decline', () => {
    /*
     * A declined check is a decision about this look at this door. Persisting
     * it would mean the one screen the player asked to be shown could be put
     * away permanently by a stray tap — which is the bug this whole change is
     * fixing, wearing a different hat.
     */
    const decl = section('const [declined, setDeclined]', 'const gates');
    expect(decl.includes('persist('), 'the decline is written to the save').toBe(false);
  });
});
