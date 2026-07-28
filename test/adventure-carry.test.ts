/**
 * The company survives the end of a chapter.
 *
 * The three story modules are a chain — `hollow-road → sunken-barrows →
 * wyrmcalling` — and the same party is meant to walk the whole thing. What
 * actually happened is that the UI deleted the save the moment ANY ending scene
 * appeared, on the reasoning that "a finished run shouldn't offer Resume". True
 * of a run that is over; the end of chapter one is not that.
 *
 * From that moment the party existed only in one React component's state. The
 * victory screen offered "Continue the company", and the other button — the one
 * that reads like "not right now" — threw them away. Worse, the obvious
 * recovery made it silent: picking chapter two off the landing page calls
 * `newCampaign()`, so a level-1 party walked into a module written for level 3
 * and nothing anywhere said a word.
 *
 * None of that was reachable from a test, because all of it lived in a
 * `useEffect`. So the decision moved into the runtime, where it can be one, and
 * these are it.
 */
import { describe, it, expect } from 'vitest';
import {
  carryCompanyInto, endingDisposition, startAdventure, currentScene,
} from '../src/adventure/runtime.js';
import { newCampaign, addItem, partyStash } from '../src/campaign/campaign.js';
import { moduleById, MODULES } from '../src/data/modules/index.js';
import type { Module } from '../src/adventure/types.js';

const HOLLOW = moduleById('hollow-road')!;
const BARROWS = moduleById('sunken-barrows')!;
const WYRM = moduleById('wyrmcalling')!;

describe('what happens to the save at an ending', () => {
  it('carries the company on after a chapter that has a sequel', () => {
    const d = endingDisposition(HOLLOW, 'victory', moduleById);
    expect(d.kind).toBe('carry');
    if (d.kind === 'carry') expect(d.sequel.id).toBe('sunken-barrows');
  });

  it('clears after the last chapter — that one really is the end', () => {
    expect(WYRM.sequel, 'the chain has grown; this test needs a new tail').toBeUndefined();
    expect(endingDisposition(WYRM, 'victory', moduleById).kind).toBe('clear');
  });

  it('clears on a defeat, however many chapters remain', () => {
    // A defeat is the run ending, not a chapter ending. Carrying a wiped party
    // into the next module would be a stranger bug than the one this replaces.
    expect(endingDisposition(HOLLOW, 'defeat', moduleById).kind).toBe('clear');
  });

  it('does not throw a party away over a broken sequel link', () => {
    // A module naming a sequel that is not in the registry is a content bug.
    // There is nowhere to carry them to, but it must fail as "the story stops
    // here", not as an exception on the victory screen.
    const dangling = { ...HOLLOW, sequel: 'no-such-module' } as Module;
    expect(endingDisposition(dangling, 'victory', moduleById).kind).toBe('clear');
  });

  it('agrees with the module registry about who has a sequel', () => {
    // Guards against the chain being extended without this file noticing: every
    // module declaring a sequel must carry, every module without one must not.
    for (const m of MODULES) {
      const expected = m.sequel && moduleById(m.sequel) ? 'carry' : 'clear';
      expect(endingDisposition(m, 'victory', moduleById).kind, m.id).toBe(expected);
    }
  });
});

describe('walking into the next chapter', () => {
  function veteranCompany() {
    const c = newCampaign(7);
    c.xp = 900;                       // level 3, the band Sunken Barrows expects
    c.gold = 412;
    addItem(partyStash(c), 'potion-greater-healing', 2);
    return c;
  }

  it('keeps the party, its levels, its purse and its packs', () => {
    const c = veteranCompany();
    const namesBefore = c.characters.map((ch) => ch.name);
    const next = carryCompanyInto(c, BARROWS);

    expect(next.campaign.characters.map((ch) => ch.name)).toEqual(namesBefore);
    expect(next.campaign.xp).toBe(900);
    expect(next.campaign.gold).toBe(412);
    expect(partyStash(next.campaign).find((s) => s.itemId === 'potion-greater-healing')?.qty).toBe(2);
  });

  it('is a different party from the one a cold start would hand you', () => {
    // The failure this whole change exists to prevent, stated as a number: a
    // fresh campaign is level 1, and Sunken Barrows is written for level 3.
    const carried = carryCompanyInto(veteranCompany(), BARROWS);
    const cold = startAdventure(newCampaign(7), BARROWS);
    expect(carried.campaign.xp).toBeGreaterThan(cold.campaign.xp);
    expect(cold.campaign.xp).toBe(0);
  });

  it('opens at the sequel, not at the chapter just finished', () => {
    const next = carryCompanyInto(veteranCompany(), BARROWS);
    expect(next.moduleId).toBe('sunken-barrows');
    expect(next.sceneId).toBe(BARROWS.start);
    expect(() => currentScene(next, BARROWS)).not.toThrow();
  });

  it('leaves the finished chapter behind', () => {
    // Run-scoped state belongs to the chapter that is over. Carrying flags or
    // visited scenes forward would let chapter one's answers open chapter two's
    // doors — and `visited` in particular decides what reads as a revisit.
    const c = veteranCompany();
    const first = startAdventure(c, HOLLOW);
    first.flags['killed-the-chief'] = true;
    first.visited.push('square', 'market');
    first.exploredNodes.push('den');

    const next = carryCompanyInto(c, BARROWS);
    expect(next.flags).toEqual({});
    expect(next.exploredNodes).toEqual([]);
    // Only the sequel's own opening scene, entered just now.
    expect(next.visited).toEqual([BARROWS.start]);
  });

  it('arrives rested, because chapters are days apart', () => {
    const c = veteranCompany();
    c.characters[0]!.resources = { hp: 1 };
    const next = carryCompanyInto(c, BARROWS);
    // `fullRest` clears spent resources; absent means full.
    expect(next.campaign.characters[0]!.resources).toBeUndefined();
  });
});
