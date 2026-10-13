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
    const roused = event.when!.find((w) => w.if.some((r) => r.kind === 'alarm'))!;
    const s = startAdventure(newCampaign(1), m);
    expect(roused.if.every((r) => requirementMet(s, r))).toBe(false);
    // Past the goal, three fights in: roused is not enough to move them.
    (s.alarms ??= {})[d.id] = ALARM_ROUSED;
    expect(roused.if.every((r) => requirementMet(s, r))).toBe(false);
    s.alarms[d.id] = ALARM_ROUSED + 2;
    expect(roused.if.every((r) => requirementMet(s, r))).toBe(true);
    // Quiet: the party gets them out, and the room is done with.
    const q = startAdventure(newCampaign(1), m);
    enterScene(q, m, event.scene);
    choose(q, m, 'free');
    expect(Object.keys(q.flags).some((f) => f.endsWith('-freed'))).toBe(true);
    expect(event.until!.every((r) => requirementMet(q, r))).toBe(true);
    // Roused: they were moved; the cage stays empty after.
    const r = startAdventure(newCampaign(1), m);
    enterScene(r, m, roused.to);
    choose(r, m, 'on');
    expect(Object.keys(r.flags).some((f) => f.endsWith('-gone'))).toBe(true);
    expect(event.when![0]!.if.every((x) => requirementMet(r, x))).toBe(true);
  });

  it('holds whoever a story names, with its own flags, lines and quest', () => {
    const m = generateSpecDelve(3, { theme: 'stone', level: 3, fights: 'inhabitants', factions: ['goblins'], require: [{ name: 'The Pens', where: 'side',
      hostage: { who: 'the carter', as: { freed: 'carter-freed', taken: 'carter-taken' }, freed: ['He is out.'], quest: { title: 'Bring Him Home', body: 'He is in the pens.' },
        takenWhen: [{ kind: 'flag', flag: 'moon-dark' }] } }] }).module;
    const room = floor(m).dungeon.rooms.find((r) => r.name === 'The Pens')!;
    const held = m.scenes[room.event!.scene];
    expect(held?.kind === 'story' && held.next.find((c) => c.id === 'free')!.effects!.some((e) => e.kind === 'journal' && e.entry.kind === 'quest' && e.entry.resolvedBy === 'carter-freed')).toBe(true);
    expect(room.event!.until).toEqual([{ kind: 'flag', flag: 'carter-freed' }]);
    expect(room.event!.when!.some((w) => w.if.some((r) => r.kind === 'flag' && r.flag === 'moon-dark'))).toBe(true);
  });

  it('is not moved by the alarm where the story says so, and says so in its own words where it is', () => {
    const quiet = generateSpecDelve(3, { theme: 'stone', level: 3, fights: 'inhabitants', factions: ['goblins'], require: [{ name: 'The Pens', where: 'side',
      hostage: { who: 'the captives', many: true, as: { freed: 'f', taken: 't' }, movedAt: false } }] }).module;
    const room = floor(quiet).dungeon.rooms.find((r) => r.name === 'The Pens')!;
    expect(room.event!.when!.some((w) => w.if.some((r) => r.kind === 'alarm'))).toBe(false);
    // No cage, no "the place": the defaults speak of where they are held.
    const text = JSON.stringify(Object.values(quiet.scenes).filter((sc) => sc.id.includes(room.id)));
    expect(text).not.toMatch(/\bcage\b|the place/);
  });

  it('watched, is got out quietly or by force; the watch cannot be fled, and beaten by it the party loses them', () => {
    const m = generateSpecDelve(3, { theme: 'stone', level: 3, fights: 'inhabitants', factions: ['goblins'], require: [{ name: 'The Pens', where: 'side',
      hostage: { who: 'the carter', as: { freed: 'carter-freed', taken: 'carter-taken' }, guard: { dc: 13 } } }] }).module;
    const room = floor(m).dungeon.rooms.find((r) => r.name === 'The Pens')!;
    const held = m.scenes[room.event!.scene] as Extract<Scene, { kind: 'story' }>;
    const pick = held.next.find((c) => c.id === 'pick')!;
    expect(pick.check?.skill).toBe('sleight-of-hand');
    expect(pick.effects?.some((e) => e.kind === 'setFlag')).toBeFalsy();
    const watch = m.scenes[pick.check!.failTo!];
    expect(watch?.kind === 'battle' && watch.noFlee).toBe(true);
    expect(watch?.kind === 'battle' && watch.onLoss?.effects).toContainEqual({ kind: 'setFlag', flag: 'carter-taken' });
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
