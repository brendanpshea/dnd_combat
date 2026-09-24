/**
 * Fixes from a mock playtest of the arena on a phone-sized screen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describeShort } from '../web/src/actionGroups.js';
import { GAMBITS } from '../src/arena/gambit.js';
import { FEATURES } from '../src/data/features.js';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const APP = read('web/src/App.tsx');
const ARENA = read('web/src/Arena.tsx');
const CSS = read('web/src/styles.css');

describe('learning tips never block play', () => {
  it('lets taps through to what is underneath, except on its ✕', () => {
    expect(CSS).toMatch(/\.tip-toast \{ pointer-events: none; \}/);
    expect(CSS).toMatch(/\.tip-toast \.tip-close \{ pointer-events: auto; \}/);
  });
  it('goes away on the player\'s next move', () => {
    const apply = APP.slice(APP.indexOf('function apply(action: Action)'));
    expect(apply.slice(0, 600)).toContain('setTip(null)');
  });
});

describe('the Hint names what is on the bar, and can do it', () => {
  it('calls a bonus-action verb by the verb the bar shows', () => {
    const verbs = Object.values(FEATURES).filter((f) => f.bonusVerb);
    expect(verbs.length).toBeGreaterThan(0);
    for (const f of verbs) {
      expect(describeShort({ kind: 'useFeature', featureId: f.id }), f.id)
        .toBe(describeShort({ kind: f.bonusVerb! } as never));
    }
  });
  it('offers to take the suggestion', () => {
    const banner = APP.slice(APP.indexOf('className="hint-banner"'), APP.indexOf('className="hint-banner"') + 900);
    expect(banner).toContain('Do it');
    expect(banner).toContain('apply(a)');
  });
});

describe('the pre-fight check says what is at stake', () => {
  it('every check has both outcomes written down', () => {
    for (const g of GAMBITS) {
      expect(g.stakes.win.length, g.skill).toBeGreaterThan(5);
      expect(g.stakes.lose.length, g.skill).toBeGreaterThan(5);
    }
  });
  it('shows them beside the roll', () => {
    expect(ARENA).toContain('gambit.stakes.win');
    expect(ARENA).toContain('gambit.stakes.lose');
  });
});
