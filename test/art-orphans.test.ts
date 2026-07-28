/**
 * Art may not outlive the thing it depicts.
 *
 * The registry is derived from the directory, which makes it impossible to
 * declare art that is not there — and completely blind to art for something
 * that no longer exists. Those two failures look nothing alike from inside the
 * app: a missing file shows the emoji, while a file nobody can reach shows
 * nothing at all and simply ships.
 *
 * It had happened. Mud Mephit, Smoke Mephit and Shadow Demon were removed in
 * "Drop the four things that are in neither SRD" because they appear in neither
 * the 2014 nor the 2024 SRD. Their stat blocks went; four portrait and token
 * files stayed, and so did their prompts — so a repo that vendors the SRD and
 * is careful about what it takes from it was shipping art for the exact
 * creatures it had decided it could not use, and offering to generate more.
 *
 * So every id with art has to belong to something: a monster, a class, or a
 * hero portrait. Anything else is either art for a deleted creature or a
 * filename typo, and both are silent.
 */
import { describe, it, expect } from 'vitest';
import { MONSTERS } from '../src/data/monsters.js';
import { CLASSES } from '../src/data/classes.js';
import { HAS_ART, HAS_NPC_ART } from '../web/src/art-registry.js';
import { PORTRAITS } from '../web/src/portraits.js';

describe('art with nothing to depict', () => {
  const owners = new Set<string>([
    ...Object.keys(MONSTERS),
    ...Object.keys(CLASSES),
    ...PORTRAITS.map((p) => p.id),
  ]);

  it('knows who could own a piece of art', () => {
    // Guards the guard: an empty owner set would pass nothing below.
    expect(owners.size).toBeGreaterThan(100);
  });

  it('has no combatant art for a creature that does not exist', () => {
    const strays = [...HAS_ART].filter((id) => !owners.has(id));
    expect(
      strays,
      'delete the files, or restore whatever they depict',
    ).toEqual([]);
  });

  it('counts the NPC archetypes separately, and they are all reachable', () => {
    // NPC portraits are keyed `npc-<archetype>` and have no stat block, so they
    // cannot be checked against MONSTERS — but they can be checked for shape,
    // which is what catches a file dropped in under the wrong prefix.
    for (const id of HAS_NPC_ART) expect(id, id).toMatch(/^npc-[a-z-]+$/);
  });
});
