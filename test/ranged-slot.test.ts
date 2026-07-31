/**
 * The ranged slot is PRESENTATION. It must not change a single legal action.
 *
 * Asked for as "a fighter can equip javelin to ranged slot", to give the camp
 * screen a consistent set of slots and the combat bar something to group by —
 * explicitly without touching the rules or the AI.
 *
 * That is not free, because equipping normally MOVES an item: `equipItem`
 * decrements the stack and `equipped[slot]` holds it. Doing that here would
 * have been a rules change of the worst kind, and a silent one. `equippedWeapons`
 * reads only the two hands, so a javelin moved into `ranged` would sit in
 * neither `equippedWeapons` nor `stowedWeapons` — and would quietly stop being
 * attackable at all. The player would have disarmed themselves by tidying up.
 *
 * So `ranged` records which carried weapon to surface first and leaves it in
 * the pack. This file pins both halves of that, because a later reader who
 * spots the inconsistency and "fixes" it into a container will pass a
 * typecheck, pass every other test, and break the game quietly.
 */
import { describe, it, expect } from 'vitest';
import {
  newCampaign, addItem, equipItem, unequipSlot, equipBlocked, buildCampaignParty,
  EQUIP_SLOTS, type CampaignState,
} from '../src/campaign/campaign.js';
import { attackableWeapons, equippedWeapons, stowedWeapons } from '../src/engine/rules/equipment.js';
import { groupActions } from '../web/src/actionGroups.js';

function fighterWithJavelin(): { c: CampaignState; f: number } {
  const c = newCampaign(3);
  c.partyReady = true;
  const f = c.characters.findIndex((x) => x.classId === 'fighter');
  // EXACTLY ONE. The fighter's kit already carries javelins, and with a stack
  // of three the equality test below passed even when `equipItem` was wrongly
  // consuming one — two were left in the pack, so `stowedWeapons` never
  // noticed. Found by planting the container behaviour back and watching the
  // test that exists to catch it stay green.
  c.characters[f]!.inventory = c.characters[f]!.inventory.filter((s) => s.itemId !== 'javelin');
  addItem(c.characters[f]!.inventory, 'javelin');
  return { c, f };
}

describe('marking a weapon ready at range', () => {
  it('leaves it in the pack', () => {
    const { c, f } = fighterWithJavelin();
    expect(equipItem(c, f, 'javelin', 'ranged')).toBe(true);
    expect(c.characters[f]!.equipped.ranged).toBe('javelin');
    expect(
      c.characters[f]!.inventory.some((s) => s.itemId === 'javelin' && s.qty > 0),
      'the javelin left the pack — it is now in no list the engine reads',
    ).toBe(true);
  });

  it('changes nothing about what may be attacked with', () => {
    // The whole promise, stated as an equality. If this ever fails, the AI and
    // every balance number moved with it.
    const { c, f } = fighterWithJavelin();
    const before = attackableWeapons(buildCampaignParty(c)[f]!).slice().sort();
    equipItem(c, f, 'javelin', 'ranged');
    const after = attackableWeapons(buildCampaignParty(c)[f]!).slice().sort();
    expect(after, 'the ranged marker changed the legal attack set').toEqual(before);
  });

  it('is invisible to the two lists legality is built from', () => {
    const { c, f } = fighterWithJavelin();
    equipItem(c, f, 'javelin', 'ranged');
    const me = buildCampaignParty(c)[f]!;
    expect(equippedWeapons(me), 'a marker must never count as in hand').not.toContain('javelin');
    expect(stowedWeapons(me), 'a marker must stay stowed').toContain('javelin');
  });

  it('clears without handing back a second copy', () => {
    // The bug this prevents: `unequipSlot` normally returns the item to the
    // pack, which for a marker would duplicate it.
    const { c, f } = fighterWithJavelin();
    const count = () => c.characters[f]!.inventory.find((s) => s.itemId === 'javelin')?.qty ?? 0;
    const held = count();
    equipItem(c, f, 'javelin', 'ranged');
    expect(unequipSlot(c, f, 'ranged')).toBe(true);
    expect(c.characters[f]!.equipped.ranged).toBeUndefined();
    expect(count(), 'clearing the marker duplicated the javelin').toBe(held);
  });

  it('takes anything with a range, and nothing without', () => {
    const { c, f } = fighterWithJavelin();
    addItem(c.characters[f]!.inventory, 'longsword');
    expect(equipBlocked(c, f, 'javelin', 'ranged'),
      'a thrown weapon has a range and belongs here').toBeUndefined();
    expect(equipBlocked(c, f, 'longsword', 'ranged'),
      'a longsword has no range').toBeDefined();
  });

  it('is one of the slots the screen lays out', () => {
    // All six, for every character — the layout is fixed so position carries
    // the meaning and an empty slot reads as an opportunity.
    expect(EQUIP_SLOTS).toContain('ranged');
    expect(EQUIP_SLOTS).toHaveLength(6);
  });
});

/**
 * …and what the marker is FOR: the attack chooser.
 *
 * `attackableWeapons` includes every stowed weapon while the free interaction
 * is unspent, so tapping one goblin offered a fighter Longsword, Javelin,
 * Silvered Spear and Silvered Javelin — reported as "combat screen becomes
 * unwieldy with characters who have lots of weapons in pack".
 *
 * The options are TAGGED, not filtered. Dropping the pack weapons here would be
 * a rules change for the human, because the AI would keep options the player
 * could not reach; the UI folds them behind one control instead.
 */
describe('what the chooser calls ready', () => {
  it('tags pack weapons apart from the ones in hand', () => {
    const { c, f } = fighterWithJavelin();
    const party = buildCampaignParty(c);
    const me = party[f]!;
    const state = { combatants: Object.fromEntries(party.map((p) => [p.id, p])) } as never;
    const opts = [
      { kind: 'attack' as const, weaponId: me.equipped.mainHand!, targetId: 'x' },
      { kind: 'attack' as const, weaponId: 'javelin' as const, targetId: 'x' },
    ];
    const g = groupActions(state, me.id, opts);
    const list = g.perTarget.get('x' as never) ?? [];
    expect(list, 'both attacks should be offered').toHaveLength(2);
    expect(list[0]!.stowed, 'the weapon in hand is not a draw').toBeFalsy();
    expect(list[1]!.stowed, 'a pack weapon should be marked as a draw').toBe(true);
  });

  it('counts a marked ranged weapon as ready', () => {
    const { c, f } = fighterWithJavelin();
    equipItem(c, f, 'javelin', 'ranged');
    const party = buildCampaignParty(c);
    const me = party[f]!;
    const state = { combatants: Object.fromEntries(party.map((p) => [p.id, p])) } as never;
    const g = groupActions(state, me.id, [{ kind: 'attack', weaponId: 'javelin', targetId: 'x' }]);
    expect(g.perTarget.get('x' as never)![0]!.stowed,
      'the whole point of the marker: this one is ready, not buried').toBeFalsy();
  });
});
