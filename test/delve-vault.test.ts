/**
 * A held place's vault (DelveSpec.vault): past the goal, holding the way out.
 * A hostage in it is freed if the party gets there quietly, and moved if the
 * place is roused first (ALARM_ROUSED).
 */
import { describe, it, expect } from 'vitest';
import { generateSpecDelve } from '../src/adventure/delve-spec.js';
import { startAdventure, enterScene, requirementMet, choose } from '../src/adventure/runtime.js';
import { newCampaign } from '../src/campaign/campaign.js';
import { ALARM_ROUSED, type Scene } from '../src/adventure/types.js';

const held = (vault: true | 'hostage') => generateSpecDelve(3, { theme: 'stone', level: 3, fights: 'inhabitants', factions: ['goblins'], vault }).module;
const floor = (m: ReturnType<typeof held>) => Object.values(m.scenes).find((sc): sc is Extract<Scene, { kind: 'dungeon' }> => sc.kind === 'dungeon')!;

describe('a vault', () => {
  it('holds the hoard and the way out, past the goal', () => {
    const m = held(true);
    const vault = floor(m).dungeon.rooms.find((r) => r.id === 'vault')!;
    expect(vault.exit?.to).toBe('won');
    const find = m.scenes[vault.search!];
    expect(find?.kind === 'story' && find.next[0]!.effects?.some((e) => e.kind === 'gold')).toBe(true);
  });

  it('holds a hostage who is freed while the place is quiet, and moved once it is roused', () => {
    const m = held('hostage');
    const d = floor(m);
    const event = d.dungeon.rooms.find((r) => r.id === 'vault')!.event!;
    const roused = event.when![0]!.if;
    const s = startAdventure(newCampaign(1), m);
    expect(roused.every((r) => requirementMet(s, r))).toBe(false);
    (s.alarms ??= {})[d.id] = ALARM_ROUSED;
    expect(roused.every((r) => requirementMet(s, r))).toBe(true);
    // Quiet: the party gets them out, and the room is done with.
    const q = startAdventure(newCampaign(1), m);
    enterScene(q, m, event.scene);
    choose(q, m, 'free');
    expect(Object.keys(q.flags).some((f) => f.endsWith('hostage-freed'))).toBe(true);
    expect(event.until!.every((r) => requirementMet(q, r))).toBe(true);
    // Roused: they were moved, and the room is done with too.
    const r = startAdventure(newCampaign(1), m);
    enterScene(r, m, event.when![0]!.to);
    choose(r, m, 'on');
    expect(Object.keys(r.flags).some((f) => f.endsWith('hostage-gone'))).toBe(true);
    expect(event.until!.every((x) => requirementMet(r, x))).toBe(true);
  });

  it('can be asked for by a story, which keeps what is in it', () => {
    const m = generateSpecDelve(3, { theme: 'stone', level: 3, fights: 'inhabitants', factions: ['goblins'],
      require: [{ name: 'The Strongroom', where: 'vault', text: 'The carter, in chains.' }] }).module;
    const vault = floor(m).dungeon.rooms.find((r) => r.id === 'vault')!;
    expect(vault.name).toBe('The Strongroom');
    expect(vault.firstVisit).toEqual(['The carter, in chains.']);
    expect(() => generateSpecDelve(3, { floors: 2, require: [{ where: 'vault', floor: 1 }] })).toThrow(/vault/);
  });
});
