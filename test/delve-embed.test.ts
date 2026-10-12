/**
 * Generated dungeons inside written stories (adventure/embed.ts).
 */
import { describe, it, expect } from 'vitest';
import { DELVE_STORY_MODULE as STORY } from '../src/data/modules/delve-story.js';
import { expandModule, liveModule, rollDelves, validateLive } from '../src/adventure/embed.js';
import { validateModule } from '../src/adventure/validate.js';
import { serializeAdventure, parseAdventure } from '../src/adventure/save.js';
import { startAdventure, enterScene, choose, currentScene, walkTo, dungeonExits } from '../src/adventure/runtime.js';
import { runModule } from '../src/adventure/runner.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Dungeon, Module } from '../src/adventure/types.js';
import { playDown } from './delve-play.js';

const floorOf = (m: Module, id: string): Dungeon => {
  const s = m.scenes[id];
  if (s?.kind !== 'dungeon') throw new Error(`no dungeon '${id}'`);
  return s.dungeon;
};

describe('a written story with a generated dungeon in it', () => {
  it('passes every proof, for every seed tried and every flag the delve reads', () => {
    expect(validateLive(STORY)).toEqual([]);
  }, 30_000);

  it('cannot pass as written: the story links to scenes only a roll builds', () => {
    // What makes `validateLive` necessary, pinned so nobody "fixes" it by
    // pointing the module tests at the raw module.
    expect(validateModule(STORY).join('\n')).toMatch(/unknown scene 'cellar'/);
  });

  it('plays from the reeve\'s plea, through the cellar, to an ending that knows whether Mara came home', () => {
    let freed = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const live = expandModule(STORY, { seed, flags: [] });
      const r = playDown(live, seed);
      expect(r.ending, `seed ${seed}`).toBe('victory');
      // She is past the lock on the last floor, and a party can reach the
      // lair first and end it without her. Freed, her flag comes back under
      // the story's own name, and the story's ending reads it either way.
      const home = r.flags['mara-freed'] === true;
      expect(r.scene, `seed ${seed}`).toBe(home ? 'home-with-mara' : 'home-alone');
      expect(Object.keys(r.flags).some((f) => f.endsWith('-freed') && f !== 'mara-freed')).toBe(false);
      if (home) freed++;
    }
    expect(freed, 'she was never once brought home').toBeGreaterThan(0);
  }, 30_000);

  it('drives headless through the runner, which rolls the delves itself', () => {
    let n = 3;
    const r = runModule(newCampaign(3), STORY, {
      // Wander at random, but always go back in.
      pick: (count, tag) => {
        if (tag === 'choice:cellar/outside') return 0;
        n = (n * 1103515245 + 12345) % 2147483648;
        return Math.floor((n / 2147483648) * count);
      },
      battle: () => true,
    }, 40000);
    expect(r.ending).toBe('victory');
    expect(r.state.delveRoll).toBeDefined();
  });

  it('keeps the delve in its own namespace, and the story\'s scenes as written', () => {
    const live = expandModule(STORY, { seed: 2, flags: [] });
    for (const [id, s] of Object.entries(STORY.scenes)) expect(live.scenes[id], id).toEqual(s);
    const made = Object.keys(live.scenes).filter((id) => !STORY.scenes[id]);
    expect(made).toContain('cellar');
    for (const id of made) expect(id === 'cellar' || id.startsWith('cellar/'), id).toBe(true);
    // Its flags too, except the ones it reads from the story and hands back.
    const flags = [...JSON.stringify(Object.fromEntries(made.map((id) => [id, live.scenes[id]]))).matchAll(/"flag":"([^"]+)"/g)].map((m) => m[1]!);
    for (const f of flags) expect(f.startsWith('cellar/') || f === 'mara-freed' || STORY.delves!.cellar!.reads!.includes(f), f).toBe(true);
    // Nothing named twice: a flag the generator shares between scenes was
    // once renamed twice over, `cellar/cellar/delve-key-2`.
    for (const f of flags) expect(f.startsWith('cellar/cellar/'), f).toBe(false);
  });

  it('never captures a story scene that shares a name with one of the delve\'s own', () => {
    // A story with its own 'outside' (the delve has one too), where giving
    // up on the cellar is meant to land.
    const story: Module = structuredClone(STORY);
    story.scenes.outside = { id: 'outside', kind: 'ending', outcome: 'defeat', text: ['Out in the rain.'] };
    story.delves!.cellar!.onLeave = { to: 'outside' };
    const live = expandModule(story, { seed: 1, flags: [] });
    expect(live.scenes.outside).toEqual(story.scenes.outside);
    const quit = live.scenes['cellar/outside'];
    if (quit?.kind !== 'story') throw new Error('no delve outside');
    expect(quit.next.find((c) => c.id === 'quit')?.to).toBe('outside');
    expect(validateModule(live).filter((e) => !e.includes('abandoned'))).toEqual([]);
  });

  it('builds a piece only for a story that earned it', () => {
    const sanctum = (m: Module) => floorOf(m, 'cellar/delve-2').rooms.some((r) => r.name === 'Sanctum');
    for (let seed = 1; seed <= 6; seed++) {
      expect(sanctum(expandModule(STORY, { seed, flags: [] })), `seed ${seed}`).toBe(false);
      expect(sanctum(expandModule(STORY, { seed, flags: ['hollow-road:captives-freed'] })), `seed ${seed}`).toBe(true);
    }
  });
});

describe('a run\'s roll', () => {
  it('is made once, and the dungeon does not change under the party\'s feet', () => {
    const s = startAdventure(newCampaign(1), STORY);
    const first = liveModule(STORY, s, 99);
    expect(s.delveRoll).toEqual({ seed: 99, flags: [] });
    // The story sets a flag the delve reads, after the roll: same dungeon.
    s.flags['hollow-road:captives-freed'] = true;
    expect(liveModule(STORY, s)).toBe(first);
    rollDelves(STORY, s, 7);
    expect(s.delveRoll!.seed).toBe(99);
  });

  it('snapshots what the previous chapters carried in', () => {
    const s = startAdventure(newCampaign(1), STORY);
    s.flags = { 'hollow-road:captives-freed': true, unrelated: true };
    rollDelves(STORY, s, 5);
    expect(s.delveRoll).toEqual({ seed: 5, flags: ['hollow-road:captives-freed'] });
  });

  it('gives different runs different cellars', () => {
    const a = expandModule(STORY, { seed: 1, flags: [] });
    const b = expandModule(STORY, { seed: 2, flags: [] });
    expect(floorOf(a, 'cellar/delve')).not.toEqual(floorOf(b, 'cellar/delve'));
    expect(expandModule(STORY, { seed: 1, flags: [] })).toBe(a);
  });

  it('reloads a save made inside the dungeon, against the module as written', () => {
    const s = startAdventure(newCampaign(4), STORY);
    const live = liveModule(STORY, s, 1234);
    enterScene(s, live, live.start);
    choose(s, live, 'go');
    choose(s, live, 'in');
    expect(currentScene(s, live).kind).toBe('dungeon');
    const step = dungeonExits(s, live).find((x) => !x.blocked);
    if (step) walkTo(s, live, step.to);
    const back = parseAdventure(serializeAdventure(s), STORY);
    expect(back, 'a mid-dungeon save would not load').toBeDefined();
    expect(back!.sceneId).toBe(s.sceneId);
    expect(back!.delveRoll).toEqual({ seed: 1234, flags: [] });
    expect(liveModule(STORY, back!)).toBe(live);
  });
});

describe('what validateLive refuses', () => {
  const variant = (f: (m: Module) => void): Module => { const m = structuredClone(STORY); f(m); return m; };

  it('a piece built on a flag the delve never reads', () => {
    const m = variant((x) => { x.delves!.cellar!.reads = ['heard-of-mara']; });
    expect(validateLive(m).join('\n')).toMatch(/built on 'hollow-road:captives-freed', which the delve does not read/);
  });

  it('a story that starts inside a delve', () => {
    const m = variant((x) => { x.start = 'cellar'; });
    expect(validateLive(m).join('\n')).toMatch(/cannot start inside a generated place/);
  });

  it('more story flags than it can afford to prove', () => {
    const m = variant((x) => { x.delves!.cellar!.reads = ['a', 'b', 'c', 'd', 'e', 'hollow-road:captives-freed']; });
    expect(validateLive(m).join('\n')).toMatch(/read 6 story flags; at most 4/);
  });

  it('a delve named like a scene the story already has', () => {
    const m = variant((x) => { x.scenes.cellar = { id: 'cellar', kind: 'ending', outcome: 'victory', text: ['x'] }; });
    expect(validateLive(m).join('\n')).toMatch(/both a scene and a generated place/);
  });
});
