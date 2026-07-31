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

function fighterWithJavelin(): { c: CampaignState; f: number } {
  const c = newCampaign(3);
  c.partyReady = true;
  const f = c.characters.findIndex((x) => x.classId === 'fighter');
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
