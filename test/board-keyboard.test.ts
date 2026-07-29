/**
 * The board has to be playable without a pointer.
 *
 * WHAT WAS WRONG
 *
 * Measured in a browser: a battle offered thirteen focusable controls — the
 * whole action bar — and ZERO focusable cells. A keyboard user could open the
 * spell tray and read their hit points, and could never move, never attack and
 * never target anything. The game was unfinishable without a mouse, and nothing
 * in the test suite could tell, because a `<div onClick>` is not broken in any
 * way a DOM-free test can see.
 *
 * WHY THESE TESTS LOOK LIKE THIS
 *
 * Every web test in this repo runs without a DOM, so this cannot press a key
 * and watch a token move — that part was verified by driving the real app. What
 * it CAN do is hold the source to the three decisions that make the feature
 * work, each of which was got wrong or nearly wrong on the way in:
 *
 *   1. A ROVING tabindex, not eighty tab stops. Eighty cells in the tab order
 *      would mean eighty presses to cross the board and would bury the action
 *      bar behind them.
 *   2. Up is +y. The cell loop draws `y = height - 1` first, so rank 1 is at the
 *      BOTTOM — the chessboard convention the game labels squares with. Mapping
 *      ArrowUp to -y reads as obviously correct and does nothing at all on the
 *      back rank, which is where every hero starts and therefore the first key
 *      a keyboard player would ever press. That is precisely how it shipped in
 *      the first draft of this feature, and how it was caught.
 *   3. A label on every cell, or a screen reader reads a grid of nothing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BOARD = readFileSync(fileURLToPath(new URL('../web/src/Board.tsx', import.meta.url)), 'utf8');
const CSS = readFileSync(fileURLToPath(new URL('../web/src/styles.css', import.meta.url)), 'utf8');

describe('the board is reachable from the keyboard', () => {
  it('makes cells focusable and gives the grid its roles', () => {
    expect(BOARD, 'cells need a tabIndex or Tab cannot reach the board').toMatch(/tabIndex=\{/);
    expect(BOARD, 'the grid needs a role for assistive tech').toContain('role="grid"');
    expect(BOARD, 'cells need a role for assistive tech').toContain('role="gridcell"');
    expect(BOARD, 'no key handler means no keyboard play').toContain('onKeyDown');
  });

  it('uses ONE tab stop, not one per cell', () => {
    // The roving tabindex. `tabIndex={0}` on every cell would be eighty tab
    // stops between the player and the End Turn button.
    expect(BOARD).toMatch(/tabIndex=\{posKey\(tabPos\) === key \? 0 : -1\}/);
  });

  it('maps ArrowUp to increasing y, because rank 1 is drawn at the bottom', () => {
    // The bug this feature shipped with for one test run. Read the mapping out
    // of the source rather than trusting the comment beside it.
    const step = BOARD.slice(BOARD.indexOf('const step: Record<string, [number, number]>'));
    const up = step.match(/ArrowUp: \[(-?\d+), (-?\d+)\]/);
    const down = step.match(/ArrowDown: \[(-?\d+), (-?\d+)\]/);
    expect(up, 'ArrowUp must be mapped').toBeTruthy();
    expect(Number(up![2]), 'ArrowUp must increase y — the board draws rank 1 at the bottom').toBeGreaterThan(0);
    expect(Number(down![2]), 'ArrowDown must decrease y').toBeLessThan(0);
    // And the loop that makes that true, so a later change to the draw order
    // fails here rather than silently inverting the controls.
    expect(BOARD, 'the cell loop draws the top rank first').toContain('for (let y = height - 1; y >= 0; y--)');
  });

  it('acts on Enter and Space', () => {
    expect(BOARD).toMatch(/e\.key === 'Enter' \|\| e\.key === ' '/);
  });

  it('labels every cell for a screen reader', () => {
    expect(BOARD).toContain('aria-label={cellLabel(');
    // Coordinates, who is there, and what can be done — a grid read aloud
    // without coordinates is a maze.
    const fn = BOARD.slice(BOARD.indexOf('function cellLabel('));
    expect(fn).toContain('String.fromCharCode(97 + pos.x)');
    expect(fn).toMatch(/hit points/);
    expect(fn).toMatch(/can move here/);
  });

  it('draws a focus ring that survives every board theme', () => {
    // `outline` is painted over by the neighbouring cell's background at this
    // density, so the ring is inset. Without a visible ring, a roving tabindex
    // is a cursor the player cannot see.
    const rule = CSS.slice(CSS.indexOf('.board .cell:focus-visible'));
    expect(CSS).toContain('.board .cell:focus-visible');
    expect(rule.slice(0, 200)).toContain('inset');
  });
});
