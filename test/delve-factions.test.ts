/**
 * Who lives in a generated place: factions, their leaders, talking them down,
 * the history that names it, and the lair at the end.
 */
import { describe, it, expect } from 'vitest';
import { generateSpecDelve, checkSpec, DELVE_SHAPES, SPEC_THEMES, type DelveSpec } from '../src/adventure/delve-spec.js';
import { FACTIONS, factionsFor } from '../src/data/factions.js';

import { MONSTERS } from '../src/data/monsters.js';
import { avoidedFightXP, encounterFor } from '../src/data/encounters.js';
import { ARENA_EXCLUDED, generateEncounter } from '../src/arena/encounter.js';
import { evenBudgetFor, memberCapFor, maxCountFor } from '../src/arena/run.js';
import { seedRng } from '../src/engine/rng.js';
import { goalCost } from '../src/adventure/dungeon.js';
import { validateModule } from '../src/adventure/validate.js';
import {
  startAdventure, enterScene, choose, walkTo, parleyBattle, currentScene, dungeonProgress, dungeonExits,
} from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import type { Dungeon, Module, Scene } from '../src/adventure/types.js';
import { playDown } from './delve-play.js';

const floor = (m: Module, f = 1): Dungeon => {
  const s = m.scenes[f === 1 ? 'delve' : `delve-${f}`];
  if (s?.kind !== 'dungeon') throw new Error(`no floor ${f}`);
  return s.dungeon;
};
type Battle = Extract<Scene, { kind: 'battle' }>;
const battles = (m: Module): Battle[] => Object.values(m.scenes).filter((s): s is Battle => s.kind === 'battle');
const membersOf = (b: Battle) => encounterFor(b.encounterId)!.members;
const goalFightOf = (m: Module, f = 1) => floor(m, f).rooms.find((r) => r.goal)!.fight!;

describe('the factions', () => {
  it('field only monsters that exist and the arena may field', () => {
    for (const f of Object.values(FACTIONS)) {
      for (const m of [...f.members, ...f.leaders]) {
        expect(MONSTERS[m], `${f.id}: ${m}`).toBeDefined();
        expect(ARENA_EXCLUDED.has(m), `${f.id}: ${m}`).toBe(false);
      }
    }
  });

  it('give every theme a choice of holders at every level', () => {
    for (const theme of SPEC_THEMES) for (let level = 1; level <= 5; level++) {
      expect(factionsFor(theme, level).length, `${theme} L${level}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('a peopled floor', () => {
  it.each(Object.keys(FACTIONS))('%s fields only its own, at every level, led by one of its own', (id) => {
    /*
     * The failure this pins is silent: a faction the generator cannot field
     * falls back to the whole roster, and the floor is "the Laughing Pack"
     * in name and a bear and two cultists in fact. Gnolls at 1st level did
     * exactly that, on every fight, until the faction became one pool.
     */
    const f = FACTIONS[id]!;
    for (let level = 1; level <= 5; level++) {
      for (let seed = 1; seed <= 4; seed++) {
        const { module } = generateSpecDelve(seed, { theme: f.themes[0]!, level, fights: 'inhabitants', factions: [id] });
        const goal = goalFightOf(module);
        for (const b of battles(module)) {
          const foreign = membersOf(b).filter((m) => !f.members.includes(m) && !(b.id === goal && f.leaders.includes(m)));
          expect(foreign, `${id} L${level} seed ${seed} ${b.id}`).toEqual([]);
        }
      }
    }
  }, 60_000);

  it('puts a leader at the goal wherever one can be fielded', () => {
    for (const f of Object.values(FACTIONS)) {
      for (const level of [3, 4, 5]) {
        const { module } = generateSpecDelve(level, { theme: f.themes[0]!, level, fights: 'inhabitants', factions: [f.id] });
        const boss = module.scenes[goalFightOf(module)] as Battle;
        expect(membersOf(boss).some((m) => f.leaders.includes(m)), `${f.id} L${level}: ${membersOf(boss).join('+')}`).toBe(true);
      }
    }
  });

  it('splits a floor between two holders at the lock', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { module } = generateSpecDelve(seed, { theme: 'stone', level: 3, fights: 'inhabitants', factions: ['kobolds', 'cult'] });
      const d = floor(module);
      const keyless: Dungeon = { ...d, links: d.links.filter((l) => !l.door?.locked) };
      for (const r of d.rooms) {
        if (!r.fight || r.goal) continue;
        const before = goalCost(module, keyless, r.id) !== undefined;
        const want = FACTIONS[before ? 'kobolds' : 'cult']!.members;
        const got = membersOf(module.scenes[r.fight] as Battle);
        expect(got.every((m) => want.includes(m)), `seed ${seed} ${r.id} (${before ? 'before' : 'after'} the lock): ${got.join('+')}`).toBe(true);
      }
    }
  });

  it('draws its holders for the theme when none are named', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const { module } = generateSpecDelve(seed, { theme: 'graveyard', fights: 'inhabitants' });
      const ids = membersOf(module.scenes[floor(module).rooms.find((r) => r.fight && !r.goal)!.fight!] as Battle);
      const holder = Object.values(FACTIONS).find((f) => ids.every((m) => f.members.includes(m)) && f.themes.includes('graveyard'));
      expect(holder, `seed ${seed}: ${ids.join('+')}`).toBeDefined();
      seen.add(holder!.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('talking them down', () => {
  it('is offered on a talking faction\'s fights, pays the fight\'s XP, and still hands over the key', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { module } = generateSpecDelve(seed, { level: 2, fights: 'inhabitants', factions: ['goblins'], theme: 'forest' });
      const d = floor(module);
      const goal = goalFightOf(module);
      for (const r of d.rooms.filter((x) => x.fight && !x.id.startsWith('p'))) {
        const b = module.scenes[r.fight!] as Battle;
        if (b.id === goal) { expect(b.parley, 'the leader does not negotiate').toBeUndefined(); continue; }
        expect(b.parley?.label, b.id).toBe('Scare them off');
        expect(b.parley!.success.effects).toContainEqual({ kind: 'xp', amount: avoidedFightXP(b.encounterId) });
        if (r.id === 'key') expect(JSON.stringify(b.parley!.success.effects)).toContain('"kind":"setFlag"');
      }
    }
  });

  it('is never offered by the dead', () => {
    const { module } = generateSpecDelve(4, { theme: 'graveyard', fights: 'inhabitants', factions: ['restless-dead'] });
    expect(battles(module).filter((b) => b.parley && !b.id.includes('-p'))).toEqual([]);
  });

  it('settles the room: walking back in does not spring the fight again', () => {
    // Before this, a talk-down in a dungeon room left it uncleared, and the
    // same goblins jumped out every time the party came back through.
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 3; seed++) {
      const { module } = generateSpecDelve(seed, { level: 2, fights: 'inhabitants', factions: ['goblins'], theme: 'forest', shape: 'spine' });
      const s = startAdventure(newCampaign(seed), module);
      enterScene(s, module, module.start);
      choose(s, module, 'in');
      const d = floor(module);
      const next = dungeonExits(s, module).find((x) => !x.blocked && d.rooms.find((r) => r.id === x.to)?.fight);
      if (!next) continue;
      walkTo(s, module, next.to);
      if (currentScene(s, module).kind !== 'battle') continue;
      parleyBattle(s, module, 0);
      if (currentScene(s, module).kind === 'battle') continue;   // the talk failed; try another seed
      expect(dungeonProgress(s, 'delve', d).cleared, `seed ${seed}`).toContain(next.to);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('the encounter generator, restricted to a list', () => {
  it('draws only from the list', () => {
    for (let level = 1; level <= 5; level++) for (let s = 1; s <= 30; s++) {
      const list = FACTIONS.bandits!.members;
      const enc = generateEncounter({ budget: evenBudgetFor(level) * 0.3, maxMemberXp: memberCapFor(level), maxCount: maxCountFor(level), partyLevel: level, members: list }, seedRng(s)).value;
      expect(enc.members.every((m) => list.includes(m)), `L${level} seed ${s}: ${enc.members.join('+')}`).toBe(true);
    }
  });

  it('falls back to the whole roster rather than field nothing', () => {
    const enc = generateEncounter({ budget: 300, partyLevel: 1, maxMemberXp: 200, members: ['tyrannosaurus'] }, seedRng(1)).value;
    expect(enc.members.length).toBeGreaterThan(0);
    expect(enc.members).not.toContain('tyrannosaurus');
  });
});

describe('a history', () => {
  it('names the place and tells its story, ending with who holds it', () => {
    const { module } = generateSpecDelve(7, { theme: 'bog', fights: 'inhabitants', factions: ['lizardfolk'] });
    expect(module.blurb).toMatch(/^Built by .*\. Now .* hold it\.$/);
    expect(FACTIONS.lizardfolk!.names.some((n) => module.blurb.includes(n))).toBe(true);
    const start = module.scenes.start;
    expect(start?.kind === 'story' && start.text.join(' ')).toContain(module.blurb);
  });

  it('is drawn on request without factions, and leaves a plain spec alone', () => {
    const told = generateSpecDelve(3, { history: true }).module;
    expect(told.blurb).toMatch(/^Built by .*Nobody knows what lives there now\.$/);
    expect(generateSpecDelve(3, {}).module.blurb).toMatch(/^A generated delve/);
  });
});

describe('the lair', () => {
  it('is the floor\'s goal: behind the lock, and the end of the delve on the last floor', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { module } = generateSpecDelve(seed, { floors: 2, fights: 'inhabitants', theme: 'stone', pieces: [{ piece: 'lair' }] });
      const d = floor(module, 2);
      const goal = d.rooms.find((r) => r.goal)!;
      expect(goal.id, `seed ${seed}`).toBe('p0-hall');
      const keyless: Dungeon = { ...d, links: d.links.filter((l) => !l.door?.locked) };
      expect(goalCost(module, keyless, goal.id), `seed ${seed}: the lair is open without the key`).toBeUndefined();
      expect((module.scenes[goal.fight!] as Battle).onWin.to).toBe('won');
      // Exactly one goal on the floor: the generated one was never built.
      expect(d.rooms.filter((r) => r.goal)).toHaveLength(1);
    }
  });

  it('leads down the stairs when it is not the last floor', () => {
    const { module } = generateSpecDelve(5, { floors: 2, pieces: [{ piece: 'lair', floor: 1 }] });
    const hall = floor(module, 1).rooms.find((r) => r.goal)!;
    expect(hall.id).toBe('p0-hall');
    expect(hall.exit?.to).toBe('delve-2');
    expect((module.scenes[hall.fight!] as Battle).onWin.to).toBe('@hub');
  });

  it('plays through to victory, held by factions, in every shape', () => {
    for (const shape of DELVE_SHAPES) for (let seed = 1; seed <= 3; seed++) {
      const { module } = generateSpecDelve(seed, { shape, floors: 3, fights: 'inhabitants', pieces: [{ piece: 'lair' }, { piece: 'rivals', floor: 2 }] });
      expect(validateModule(module)).toEqual([]);
      expect(playDown(module, seed).ending, `${shape} seed ${seed}`).toBe('victory');
    }
  }, 60_000);
});

describe('refusing a spec at once', () => {
  it('names what is wrong', () => {
    const bad: [DelveSpec, RegExp][] = [
      [{ fights: 'inhabitants', factions: ['dragons'] }, /no faction 'dragons'/],
      [{ fights: 'inhabitants', factions: ['kobolds', 'cult', 'gnolls'] }, /at most two/],
      [{ fights: 'inhabitants', factions: ['kobolds', 'kobolds'] }, /same faction twice/],
      [{ fights: 'generated', factions: ['kobolds'] }, /factions given, but fights are 'generated'/],
      [{ pieces: [{ piece: 'lair', where: 'any' }] }, /is a goal, and goes nowhere else/],
      [{ pieces: [{ piece: 'prisoner', where: 'goal' }] }, /cannot be a goal/],
      [{ pieces: [{ piece: 'lair' }, { piece: 'lair' }] }, /two goal pieces/],
      [{ pieces: [{ piece: 'lair' }], require: [{ where: 'goal' }] }, /goal piece and a required goal/],
      [{ pieces: [{ piece: 'lair', chance: 0.5 }] }, /cannot be left to chance/],
    ];
    for (const [spec, why] of bad) expect(() => checkSpec(spec), JSON.stringify(spec)).toThrow(why);
  });
});
