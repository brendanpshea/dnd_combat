import { describe, it, expect } from 'vitest';
import { Combat } from '../src/engine/combat.js';
import { buildCharacter, buildParty } from '../src/builder/character.js';
import { buildMonster } from '../src/data/monsters.js';
import { buildEncounter } from '../src/data/encounters.js';
import { groupActions, buildMultiAction, bendTray, bendEntry, posKey } from '../web/src/actionGroups.js';
import { affordableMetamagic, SORCERY_POINTS } from '../src/engine/rules/metamagic.js';
import { SPELLS } from '../src/data/spells.js';
import { isLegalAction } from '../src/engine/actions.js';
import type { Combatant, Position } from '../src/engine/types.js';

function place(classId: string, team: 'team1' | 'team2', position: Position, over: Partial<Combatant> = {}): Combatant {
  const c = buildCharacter({ classId, team, position, level: 3 });
  return { ...c, ...over, id: over.id ?? c.id };
}

function until(c: Combat, id: string) {
  let guard = 0;
  while (c.activeId !== id && guard++ < 60) c.apply({ kind: 'endTurn' });
  expect(c.activeId).toBe(id);
}

describe('web action grouping', () => {
  it('splits moves, per-target taps, and bar entries; everything applies legally', () => {
    const c = new Combat({
      seed: 4,
      combatants: [
        place('wizard', 'team1', { x: 3, y: 3 }, { id: 'wiz' }),
        place('fighter', 'team1', { x: 4, y: 3 }, { id: 'ally' }),
        place('fighter', 'team2', { x: 3, y: 4 }, { id: 'foe', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const grouped = groupActions(c.state, 'wiz', c.legalActions());

    // Moves exist and are keyed by cell.
    expect(grouped.moves.size).toBeGreaterThan(0);
    for (const [k, a] of grouped.moves) {
      expect(a.kind).toBe('move');
      if (a.kind === 'move') expect(posKey(a.to)).toBe(k);
    }

    // The adjacent foe is tappable with several options (staff, cantrips...).
    const foeOptions = grouped.perTarget.get('foe')!;
    expect(foeOptions.length).toBeGreaterThanOrEqual(3);
    expect(foeOptions.every((o) => 'action' in o)).toBe(true);

    // Bar contains stances, area spells with cell targets, and multi-target spells.
    const ids = grouped.bar.map((b) => b.id);
    expect(ids).toContain('dash');
    expect(ids).toContain('spell:sleep');
    const sleep = grouped.bar.find((b) => b.id === 'spell:sleep')!;
    expect(sleep.cellTargets!.size).toBeGreaterThan(0);
    const mm = grouped.bar.find((b) => b.id === 'spell:magic-missile')!;
    expect(mm.multi).toBeDefined();
    expect(mm.multi!.maxTargets).toBe(3);
    expect(mm.multi!.allowRepeats).toBe(true);
    expect(mm.multi!.validIds.has('foe')).toBe(true);
    expect(mm.multi!.validIds.has('ally')).toBe(false);

    // A built multi-action is accepted by the engine.
    const events = c.apply(buildMultiAction(mm.multi!, ['foe', 'foe', 'foe']));
    expect(events.filter((e) => e.type === 'damageDealt')).toHaveLength(3);
  });

  it('a multi-target enemy spell also hangs off a tapped enemy, anchored on it', () => {
    // A fresh fight per spell so a spent action/slot never confounds the next.
    for (const spellId of ['magic-missile', 'scorching-ray']) {
      // Two foes on the board, so the multi spell carries >1 target (its default
      // action would otherwise skip the tapped-enemy fast path).
      const wiz = place('wizard', 'team1', { x: 3, y: 3 }, { id: 'wiz' });
      wiz.spellIds = [...wiz.spellIds, 'scorching-ray'];
      const c = new Combat({
        seed: 4,
        combatants: [
          wiz,
          place('fighter', 'team2', { x: 6, y: 6 }, { id: 'foeA', hp: 1000, maxHp: 1000 }),
          place('fighter', 'team2', { x: 7, y: 6 }, { id: 'foeB', hp: 1000, maxHp: 1000 }),
        ],
      });
      until(c, 'wiz');
      const grouped = groupActions(c.state, 'wiz', c.legalActions());

      const opt = (grouped.perTarget.get('foeA') ?? []).find((o) => o.multi?.spellId === spellId);
      expect(opt, `${spellId} should be tappable off an enemy`).toBeDefined();
      expect(opt!.multi!.maxTargets).toBe(3);
      // Anchored on the tapped enemy: starting with it pre-picked and adding the
      // other foe casts a spread the engine accepts.
      const built = buildMultiAction(opt!.multi!, ['foeA', 'foeB', 'foeB']);
      expect(built.kind).toBe('castSpell');
      const events = c.apply(built);
      expect(events.filter((e) => e.type === 'damageDealt').length).toBeGreaterThan(0);
    }
  });

  it('a multi-target spell scroll routes through the accumulate-taps tray, not the tapped-enemy menu', () => {
    // A wizard (Magic Missile is on the arcane list) holding a scroll of it.
    const c = new Combat({
      seed: 4,
      combatants: [
        place('wizard', 'team1', { x: 3, y: 3 }, { id: 'wiz',
          inventory: [{ itemId: 'scroll-magic-missile', qty: 1 }] }),
        place('fighter', 'team2', { x: 3, y: 4 }, { id: 'foe', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const grouped = groupActions(c.state, 'wiz', c.legalActions());
    // The scroll is a tray/bar entry with a multi spec (3 darts), NOT a per-target tap.
    const scroll = grouped.bar.find((b) => b.id === 'item:scroll-magic-missile');
    expect(scroll?.multi).toBeDefined();
    expect(scroll!.multi!.maxTargets).toBe(3);
    expect(scroll!.multi!.itemId).toBe('scroll-magic-missile');
    // The foe's tap menu should NOT carry the scroll (that was the bug).
    const foeOpts = grouped.perTarget.get('foe') ?? [];
    expect(foeOpts.some((o) => o.action.kind === 'useItem' && o.action.itemId === 'scroll-magic-missile')).toBe(false);
    // The built action uses the item (not a slot) and hits thrice.
    const built = buildMultiAction(scroll!.multi!, ['foe', 'foe', 'foe']);
    expect(built.kind).toBe('useItem');
    const events = c.apply(built);
    expect(events.filter((e) => e.type === 'damageDealt')).toHaveLength(3);
  });

  it('an area spell scroll collapses to ONE pick-a-cell entry, not one per aim cell', () => {
    // A level-5 wizard (Fireball is on the arcane list) holding one scroll.
    const c = new Combat({
      seed: 4,
      combatants: [
        place('wizard', 'team1', { x: 3, y: 3 }, { id: 'wiz', level: 5,
          inventory: [{ itemId: 'scroll-fireball', qty: 1 }] }),
        place('fighter', 'team2', { x: 5, y: 5 }, { id: 'foe', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const grouped = groupActions(c.state, 'wiz', c.legalActions());
    // Exactly one bar entry for the scroll (the bug rendered dozens), and it's a
    // pick-a-cell tray, not an auto-firing button.
    const scrolls = grouped.bar.filter((b) => b.id === 'item:scroll-fireball');
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0]!.cellTargets).toBeDefined();
    expect(scrolls[0]!.cellTargets!.size).toBeGreaterThan(1); // many aim cells, one entry
    expect(scrolls[0]!.action).toBeUndefined();               // never a one-tap auto-cast
    // Casting the scroll at a cell telegraphs a spellCast (so the blast animates)
    // and deals fire damage to the foe in the blast.
    const aim = [...scrolls[0]!.cellTargets!.values()].find((a) =>
      a.kind === 'useItem' && a.targets?.some((t) => 'position' in t && t.position.x === 5 && t.position.y === 5))!;
    const events = c.apply(aim);
    expect(events.some((e) => e.type === 'spellCast' && e.spellId === 'fireball')).toBe(true);
    expect(events.some((e) => e.type === 'damageDealt' && e.damageType === 'fire')).toBe(true);
  });

  it('a non-caster cannot use a spell scroll (fighter can\'t read a wizard scroll)', () => {
    const c = new Combat({
      seed: 4,
      combatants: [
        place('fighter', 'team1', { x: 3, y: 3 }, { id: 'ftr',
          inventory: [{ itemId: 'scroll-magic-missile', qty: 1 }] }),
        place('fighter', 'team2', { x: 3, y: 4 }, { id: 'foe', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'ftr');
    const legal = c.legalActions();
    expect(legal.some((a) => a.kind === 'useItem' && a.itemId === 'scroll-magic-missile')).toBe(false);
  });

  it('area cell targets apply legally (sleep anchor)', () => {
    const c = new Combat({
      seed: 6,
      combatants: [
        place('wizard', 'team1', { x: 0, y: 0 }, { id: 'wiz' }),
        place('fighter', 'team2', { x: 5, y: 5 }, { id: 'foe' }),
      ],
    });
    until(c, 'wiz');
    const grouped = groupActions(c.state, 'wiz', c.legalActions());
    const sleep = grouped.bar.find((b) => b.id === 'spell:sleep')!;
    const [, action] = [...sleep.cellTargets!][0]!;
    const events = c.apply(action);
    expect(events.some((e) => e.type === 'savingThrow')).toBe(true);
  });

  it('ally-target spells go to the action bar (targeting mode), not ally taps', () => {
    const c = new Combat({
      seed: 8,
      combatants: [
        place('cleric', 'team1', { x: 0, y: 0 }, { id: 'clr' }),
        place('fighter', 'team1', { x: 1, y: 0 }, { id: 'ally', hp: 2 }),
        place('rogue', 'team2', { x: 7, y: 7 }, { id: 'foe' }),
      ],
    });
    until(c, 'clr');
    const grouped = groupActions(c.state, 'clr', c.legalActions());
    // Cure Wounds is now a bar entry with an ally-targeting mode (so allies
    // light up only when actively casting), not a pre-highlighted ally tap.
    const cure = grouped.bar.find((b) => b.id === 'spell:cure-wounds');
    expect(cure?.multi).toBeDefined();
    expect(cure!.multi!.validIds.has('ally')).toBe(true);
    // Potions administered to an adjacent ally remain a direct tap.
    const allyOptions = grouped.perTarget.get('ally') ?? [];
    expect(allyOptions.map((o) => o.label)).toContain('Potion of Healing');
    // Enemy single-target spells still tap the enemy directly.
    expect(grouped.perTarget.has('foe')).toBe(true);
  });
});

describe('the bar does not grow with the character', () => {
  const partyBar = (level: number, classId: string) => {
    const c = new Combat({
      seed: 3,
      mapId: 'ruins',
      combatants: [...buildParty('team1', 0, level), ...buildEncounter('goblins', 'team2', 7)],
    });
    const me = Object.values(c.state.combatants).find((u) => u.team === 'team1' && u.classId === classId)!;
    let guard = 0;
    while (c.activeId !== me.id && guard++ < 40) c.apply({ kind: 'endTurn' });
    return groupActions(c.state, me.id, c.legalActions()).bar;
  };

  it('offers each verb once, not once per action economy', () => {
    // A rogue has Cunning Action: Dash/Disengage/Hide *and* the plain verbs, so
    // its bar listed all three twice — six of nine entries — with no way to tell
    // the buttons apart. One entry each now, spending the bonus action, which is
    // the whole reason the feature exists.
    const labels = partyBar(3, 'rogue').map((b) => b.label);
    for (const verb of ['Dash', 'Disengage', 'Hide']) {
      expect(labels.filter((l) => l === verb), `${verb} should appear exactly once`).toHaveLength(1);
    }
    expect(labels).not.toContain('Cunning Action: Dash');
  });

  it('spends the bonus action for a verb when the feature offers it', () => {
    const hide = partyBar(3, 'rogue').find((b) => b.label === 'Hide')!;
    expect(hide.note).toBe('Bonus');
    // The action it actually plays is Cunning Action, not the action-costing Hide.
    expect(hide.action).toMatchObject({ kind: 'useFeature', featureId: 'cunning-hide' });
  });

  it('every entry lands in a category, so nothing can go missing from the bar', () => {
    for (const classId of ['fighter', 'wizard', 'cleric', 'rogue']) {
      for (const b of partyBar(3, classId)) {
        expect(['spell', 'item', 'skill', 'basic'], `${classId}: ${b.label}`).toContain(b.group);
      }
    }
  });

  it('keeps the bar at a handful of controls regardless of level', () => {
    // The point of categories: ~2/3 of every spell in the game is bar-bound, so
    // a flat bar grows without limit. One control per non-empty category can't.
    const groups = ['spell', 'item', 'skill', 'basic'] as const;
    for (const level of [1, 2, 3]) {
      for (const classId of ['fighter', 'wizard', 'cleric', 'rogue']) {
        const bar = partyBar(level, classId);
        const controls = groups.filter((g) => bar.some((b) => b.group === g)).length;
        expect(controls, `${classId} L${level}`).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe('the Spells tray shows every spell', () => {
  const wizardBar = () => {
    const c = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [...buildParty('team1', 0, 3), ...buildEncounter('goblins', 'team2', 1)],
    });
    const me = Object.values(c.state.combatants).find((u) => u.team === 'team1' && u.classId === 'wizard')!;
    let guard = 0;
    while (c.activeId !== me.id && guard++ < 40) c.apply({ kind: 'endTurn' });
    return { bar: groupActions(c.state, me.id, c.legalActions()), me, c };
  };

  it('lists every castable spell, including self-targeted ones', () => {
    // Thunderwave targets {kind:'self'} and so carries no target at all. Every
    // branch here wanted a position or a creature, so it matched none of them:
    // the wizard knew the spell, the engine offered it, and the UI had nowhere
    // to put it — uncastable in the browser since the day it was added.
    const { bar, me } = wizardBar();
    const tray = bar.bar.filter((b) => b.group === 'spell').map((b) => b.id);
    for (const spellId of me.spellIds) {
      // Shield is a reaction the engine autocasts — never offered as an action.
      if (SPELLS[spellId]?.castingTime === 'reaction') continue;
      // Find Familiar and other out-of-combat rituals never appear in a fight.
      if (SPELLS[spellId]?.outOfCombat) continue;
      expect(tray, `${spellId} missing from the Spells tray`).toContain(`spell:${spellId}`);
    }
  });

  it('keeps single-target spells on the enemy tap too — two taps, not three', () => {
    // Browsing and acting are different questions; the tray answers "what can I
    // do?", tapping the goblin answers "burn that one". Moving the spell into
    // the tray alone would tax the commonest action in the game.
    const { bar, c } = wizardBar();
    const goblin = Object.values(c.state.combatants).find((u) => u.team === 'team2')!;
    const labels = bar.perTarget.get(goblin.id)!.map((o) => o.label);
    expect(labels).toContain('Fire Bolt');
    expect(bar.bar.map((b) => b.id)).toContain('spell:fire-bolt');
  });

  it('says how a spell is aimed, in words rather than one 🎯 for five things', () => {
    const { bar } = wizardBar();
    const note = (id: string) => bar.bar.find((b) => b.id === `spell:${id}`)?.note;
    expect(note('fire-bolt')).toBe('1 enemy');          // cantrip: no slot to mention
    expect(note('magic-missile')).toBe('L1 · 3 enemies');
    expect(note('sleep')).toBe('L1 · 2×2 area');
    expect(note('burning-hands')).toBe('L1 · cone');
    expect(note('misty-step')).toBe('L2 · teleport');
    expect(note('thunderwave')).toBe('L1 · 3×3 blast');
    expect(bar.bar.every((b) => !b.label.includes('🎯'))).toBe(true);
  });

  it('marks melee and ranged attacks apart in the chooser', () => {
    const c = new Combat({
      seed: 3,
      mapId: 'open',
      combatants: [...buildParty('team1', 0, 3), ...buildEncounter('goblins', 'team2', 1)],
    });
    const rogue = Object.values(c.state.combatants).find((u) => u.team === 'team1' && u.classId === 'rogue')!;
    let guard = 0;
    while (c.activeId !== rogue.id && guard++ < 40) c.apply({ kind: 'endTurn' });
    const g = groupActions(c.state, rogue.id, c.legalActions());
    const opts = [...g.perTarget.values()].flat();
    expect(opts.find((o) => o.label === 'Shortsword')?.icon).toBe('⚔️');
    expect(opts.find((o) => o.label === 'Shortbow')?.icon).toBe('🏹');
  });

  // The paladin's smites are the one place the tray offers the same spell at
  // more than one slot level — "how much do I spend on this swing" is the
  // decision the class is built around.
  it('offers every smite in the tray, at each slot level the paladin can pay for', () => {
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 5 }), id: 'pal' };
    const foe = { ...buildMonster('ogre', 'team2', { x: 3, y: 4 }), id: 'og' };
    const c = new Combat({ seed: 5, mapId: 'open', combatants: [pal, foe] });
    let guard = 0;
    while (c.activeId !== 'pal' && guard++ < 40) c.apply({ kind: 'endTurn' });
    const g = groupActions(c.state, 'pal', c.legalActions());
    const ids = g.bar.filter((b) => b.group === 'spell').map((b) => b.id);

    for (const id of ['divine-smite', 'searing-smite']) {
      expect(ids, `${id} missing from the tray`).toContain(`spell:${id}`);
      // A level-5 paladin has 2nd-level slots, so each smite also offers an upcast.
      expect(ids, `${id} upcast missing`).toContain(`spell:${id}@2`);
    }
    // Shining Smite is 2nd level to begin with, so it has no 1st-level entry to
    // upcast from — it appears once.
    expect(ids, 'shining smite missing from the tray').toContain('spell:shining-smite');
    const upcast = g.bar.find((b) => b.id === 'spell:divine-smite@2')!;
    expect(upcast.label).toBe('Divine Smite (L2)');
    expect(upcast.note).toBe('L2 · self');
  });

  it('drops the smite entries once one is armed', () => {
    const pal = { ...buildCharacter({ classId: 'paladin', team: 'team1', position: { x: 3, y: 3 }, level: 5 }), id: 'pal' };
    const foe = { ...buildMonster('ogre', 'team2', { x: 3, y: 4 }), id: 'og' };
    const c = new Combat({ seed: 5, mapId: 'open', combatants: [pal, foe] });
    let guard = 0;
    while (c.activeId !== 'pal' && guard++ < 40) c.apply({ kind: 'endTurn' });
    c.apply({ kind: 'castSpell', spellId: 'divine-smite', slotLevel: 1, targets: [] });
    const g = groupActions(c.state, 'pal', c.legalActions());
    expect(g.bar.some((b) => b.id.includes('smite'))).toBe(false);
  });
});

/**
 * The tray for a bent cast.
 *
 * A quickened cast is a separate bar entry, the same shape upcasting already
 * uses. The thing that must not break is the *note*: a button that spends two
 * sorcery points without saying so is how a sorcerer arrives at the second
 * fight of the day empty and cannot tell why. And `buildMultiAction` has to
 * carry the modifier through the accumulate-taps flow — dropping it there
 * builds a plain cast, which spends the ACTION the player already used, so the
 * apply silently fails and the button does nothing.
 */
describe('quickened casts in the tray', () => {
  function sorcererMidTurn(spellIds: string[]) {
    const me = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 3 }, level: 8 });
    me.spellIds = spellIds;
    const c = new Combat({
      seed: 4,
      combatants: [me, { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e0', hp: 60, maxHp: 60 }],
    });
    until(c, me.id);
    // Spend the action on a cantrip: the state in which Quickened is offered.
    c.apply({ kind: 'castSpell', spellId: 'fire-bolt', slotLevel: 0, targets: [{ combatantId: 'e0' }] });
    return { c, meId: me.id };
  }

  it('labels the entry and shows what it costs', () => {
    const { c, meId } = sorcererMidTurn(['fireball', 'fire-bolt']);
    const grouped = groupActions(c.state, meId, c.legalActions());
    const entry = grouped.bar.find((b) => b.label.includes('Fireball'));
    expect(entry, 'a quickened Fireball should be in the tray').toBeDefined();
    expect(entry!.label).toContain('Quickened');
    expect(entry!.note, 'the sorcery-point cost has to be visible').toContain('2 SP');
  });

  it('carries the modifier through the accumulate-taps flow', () => {
    const { c, meId } = sorcererMidTurn(['magic-missile', 'fire-bolt']);
    const grouped = groupActions(c.state, meId, c.legalActions());
    const entry = grouped.bar.find((b) => b.multi && b.label.includes('Magic Missile'));
    expect(entry?.multi?.metamagic).toBe('quickened');
    const built = buildMultiAction(entry!.multi!, ['e0', 'e0', 'e0']);
    expect(built.kind === 'castSpell' && built.metamagic).toBe('quickened');
    // And it is actually playable — the whole point of threading it.
    expect(isLegalAction(c.state, meId, built)).toBe(true);
  });

  it('leaves every other class tray exactly as it was', () => {
    const c = new Combat({
      seed: 4,
      combatants: [
        place('wizard', 'team1', { x: 3, y: 3 }, { id: 'wiz' }),
        place('fighter', 'team2', { x: 3, y: 4 }, { id: 'foe', hp: 1000, maxHp: 1000 }),
      ],
    });
    until(c, 'wiz');
    const bar = groupActions(c.state, 'wiz', c.legalActions()).bar;
    expect(bar.filter((b) => b.label.includes('(') && b.label.includes('Quickened'))).toEqual([]);
    expect(bar.filter((b) => (b.note ?? '').includes('SP'))).toEqual([]);
  });
});

/**
 * The Metamagic chip row.
 *
 * WHY THIS IS TESTED HERE AND NOT IN THE APP
 *
 * Every web test in this repo runs without a DOM. So the chip row is split: the
 * *decision* — which spells an armed option can touch, and what the button does
 * when pressed — lives in `bendTray`/`bendEntry` as pure functions, and
 * `App.tsx` holds only the `armed` state and the markup. Written the other way
 * round, the whole feature would ship unverified.
 *
 * The row exists because the second Metamagic option broke the shape the first
 * one used. While Quickened stood alone, a bent cast was its own tray entry
 * (like an upcast) and never sat beside its plain version, because it is only
 * offered once the action is spent. Heightened applies to an ordinary action
 * cast — so every affected spell would appear twice — and is not enumerated at
 * all, so there is no entry to duplicate in the first place.
 */
describe('the metamagic chip row', () => {
  function sorcerer(spellIds: string[]) {
    const me = buildCharacter({ classId: 'sorcerer', team: 'team1', position: { x: 0, y: 3 }, level: 8 });
    me.spellIds = spellIds;
    const c = new Combat({
      seed: 4,
      combatants: [me, { ...buildMonster('orc', 'team2', { x: 4, y: 3 }), id: 'e0', hp: 60, maxHp: 60 }],
    });
    until(c, me.id);
    return { c, meId: me.id };
  }

  it('reaches a spell the AI is never offered, and builds a legal action', () => {
    // The whole point of arming an option: Heightened has no entry in
    // `legalActions` at all, so without this the player could not cast it.
    const { c, meId } = sorcerer(['hold-person', 'fire-bolt']);
    const bar = groupActions(c.state, meId, c.legalActions()).bar.filter((b) => b.group === 'spell');
    const bent = bendTray(bar, 'heightened');
    const entry = bent.find((b) => b.label.includes('Hold Person'));
    expect(entry, 'Hold Person should be reachable with Heightened armed').toBeDefined();
    // The label is NOT suffixed with the option: with a chip armed every row is
    // bent, so the suffix would be on all of them and say nothing — and read in
    // a browser it wrapped each label to two lines and clipped the note down to
    // "L2 -", hiding the sorcery-point cost. The armed chip is the label; the
    // note is what each row costs.
    expect(entry!.label).toBe('Hold Person');
    expect(entry!.note, 'the cost has to survive on the row').toContain('2 SP');
    const action = entry!.action ?? buildMultiAction(entry!.multi!, ['e0']);
    expect(action.kind === 'castSpell' && action.metamagic).toBe('heightened');
    expect(isLegalAction(c.state, meId, action)).toBe(true);
  });

  it('hides everything the armed option cannot touch', () => {
    // The reason it is a filter and not a decoration. A row of spells that
    // silently ignore the armed option is worse than not offering it.
    const { c, meId } = sorcerer(['hold-person', 'fireball', 'fire-bolt']);
    const bar = groupActions(c.state, meId, c.legalActions()).bar.filter((b) => b.group === 'spell');
    const bent = bendTray(bar, 'heightened');
    expect(bar.some((b) => b.label.includes('Fireball'))).toBe(true);
    expect(bent.some((b) => b.label.includes('Fireball'))).toBe(false);
  });

  it('gives the ordinary tray back when nothing is armed', () => {
    const { c, meId } = sorcerer(['hold-person', 'fireball', 'fire-bolt']);
    const bar = groupActions(c.state, meId, c.legalActions()).bar;
    expect(bendTray(bar, null)).toBe(bar);
  });

  it('never bends an item — a scroll is not the sorcerer casting', () => {
    const { c, meId } = sorcerer(['hold-person', 'fire-bolt']);
    const bar = groupActions(c.state, meId, c.legalActions()).bar;
    for (const b of bar.filter((x) => x.group !== 'spell')) {
      expect(bendEntry(b, 'heightened'), b.id).toBeUndefined();
    }
  });

  it('offers a chip only to a sorcerer with points left', () => {
    const { c, meId } = sorcerer(['hold-person', 'fire-bolt']);
    expect(affordableMetamagic(c.state.combatants[meId]!).map((m) => m.id))
      .toEqual(['quickened', 'heightened']);
    c.state.combatants[meId]!.featureUses[SORCERY_POINTS]!.current = 0;
    expect(affordableMetamagic(c.state.combatants[meId]!)).toEqual([]);
    // And no other class ever sees the row.
    const wiz = buildCharacter({ classId: 'wizard', team: 'team1', position: { x: 0, y: 0 }, level: 8 });
    expect(affordableMetamagic(wiz)).toEqual([]);
  });
});
