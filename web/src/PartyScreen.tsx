/**
 * The party screen: packs, worn gear, camp buffs, camp spellcasting.
 *
 * Lifted out of Adventure.tsx unchanged, because the arena had none of it. You
 * could buy a Mace +1 there and never wield it: nothing in the arena could
 * equip an item, hand one to another hero, drink a potion between fights or
 * cast Mage Armor before walking through the gate. All of that already existed
 * — it was simply locked inside the adventure screen.
 *
 * `camp` is the only thing that differs between the two callers. An adventure
 * passes a CampRule where the location allows resting; the arena passes null,
 * because its rests are not a choice — lunch and the night happen to you.
 * Rummaging your own pack, on the other hand, you can do anywhere.
 */
import { useState } from 'react';
import {
  buildCampaignParty, partyStash, claimFromStash, stashItem, giveItem,
  equipItem, equipBlocked, unequipSlot, itemName, itemIcon, levelForXp,
  isCampBuffPotion, drinkCampBuffPotion, useStoreHealing, isStoreHealingSource,
  hitDiceLeft, hitDiceMax, characterSkills, cantripLimit,
  preparedSpells, preparedLimit, storeSpellActions, useStoreSpell,
  EQUIP_SLOTS, type CampaignState, type EquipSlot,
} from '../../src/campaign/campaign.js';
import type { CampRule } from '../../src/adventure/types.js';
import { SPELLS } from '../../src/data/spells.js';
import { acOf } from '../../src/data/armor.js';
import { Portrait } from './Portrait.js';
import { CharacterSheet } from './CharacterSheet.js';
import { SlotPips } from './SlotPips.js';
import { FeaturePips } from './FeaturePips.js';
import { InfoDot } from './InfoCard.js';
import { infoFor, spellSheet } from './gameInfo.js';
import { hasArt } from './art.js';
import { ItemIcon } from './ItemIcon.js';

function label(itemId: string): string {
  return itemId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * The strip's fixed order and its empty-state marks.
 *
 * Order is armour outward: what you are wearing, what is in each hand, what you
 * keep for range, then the two worn trinkets. Labels are short because the slot
 * is 50-63px wide on a phone — position does most of the telling, and the
 * picker names the slot in full when you open it.
 */
const SLOT_LABEL: Record<EquipSlot, string> = {
  armor: 'Armor', mainHand: 'Main', offHand: 'Off', ranged: 'Ranged',
  trinket: 'Trinket', ring: 'Ring',
};
/** Shown when a slot is empty: the shape of the thing that goes there. */
const SLOT_GLYPH: Record<EquipSlot, string> = {
  armor: '🥋', mainHand: '⚔️', offHand: '🛡️', ranged: '🏹',
  trinket: '🧿', ring: '💍',
};

type Pick =
  | { kind: 'pack'; charIdx: number; itemId: string }
  | { kind: 'stash'; itemId: string }
  | { kind: 'equipped'; charIdx: number; slot: EquipSlot; itemId: string }
  /** A slot tapped on the strip — filled or empty. Empty is the useful case:
   *  it is what prompts a player to put the javelin somewhere. */
  | { kind: 'slot'; charIdx: number; slot: EquipSlot }
  | { kind: 'spell'; charIdx: number; spellId: string }
  | null;

/** The party screen: gear management is always available (you can rummage your
 *  packs anywhere); Rest only appears where the location is campable (`camp`).
 *  Tap an item, then choose what to do with it — the same verb-after-noun flow
 *  as the campaign's between-battle screen, reusing the same state helpers. */
export function PartyScreen(
  { campaign, camp, onRest, onChange, onClose, notice: opening, frame = 'modal' }: {
    campaign: CampaignState;
    camp: CampRule | null;
    /**
     * How this screen is framed.
     *
     * `modal` — a scrim with an ✕ over the current scene. Right for an
     * adventure, which has no step bar to belong to.
     *
     * `panel` — bare content, for the arena to drop into its gate panel as the
     * Gear step. Reported as "camp screen is a mess, completely unlike other
     * tabs, no bottom navigation": every other tab kept the step bar, the Fight
     * button and the party strip, and this one replaced the whole screen with a
     * modal whose only exit was a ✕ in the corner.
     *
     * The guts are identical either way — only the frame differs.
     */
    frame?: 'modal' | 'panel';
    onRest: (variant: 'short' | 'long') => void;
    onChange: () => void;
    onClose: () => void;
    /**
     * Why the screen opened, when it opened itself. The arena's morning review
     * uses it to say what it found — "a breastplate is in their pack" — which
     * is the entire reason for opening: a panel that appears with no
     * explanation reads as a misfire.
     */
    notice?: string;
  },
) {
  const [picked, setPicked] = useState<Pick>(null);
  const [notice, setNotice] = useState<string | null>(opening ?? null);
  const [sheetIdx, setSheetIdx] = useState<number | null>(null);
  /** Which character's pack is open — at most one, so the screen stays short. */
  const [openPack, setOpenPack] = useState<number | null>(null);
  const party = buildCampaignParty(campaign);
  const stash = partyStash(campaign).filter((s) => s.qty > 0);

  const act = (fn: () => boolean | void, msg: string) => {
    fn();
    setPicked(null);
    if (msg) setNotice(msg); // '' lets fn set its own notice (e.g. heal amounts)
    onChange();
  };

  const body = (
    <>
        {frame === 'modal' && (
          <div className="adv-camp-head">
            <h2>🎒 Party</h2>
            <button className="ghost" onClick={onClose}>✕</button>
          </div>
        )}

        {/* Rest — only where you can safely (or riskily) make camp, and only in
            the modal frame at all. The arena rests on its own clock, so the
            panel there was opening with "No safe place to rest here" every
            single time: a line that is always true and never actionable. */}
        {(camp || frame === 'modal') && (
        <div className="adv-camp-rest">
          {camp ? (
            <>
              <div className="adv-rest-btns">
                <button className="primary" onClick={() => onRest('short')}>🌤 Short rest</button>
                <button className="primary" onClick={() => onRest('long')}>🌙 Long rest</button>
              </div>
              {camp.risky && (
                <p className="adv-rest-warn">⚠ This is open country — a long rest here may be interrupted.</p>
              )}
            </>
          ) : (
            <p className="adv-rest-warn muted">No safe place to rest here. You can still sort your gear.</p>
          )}
        </div>
        )}

        {notice && <p className="adv-camp-notice">{notice}</p>}

        {/* Party loot: claim shared items to a chosen hero. */}
        {stash.length > 0 && (
          <div className="adv-camp-stash">
            <span className="adv-camp-label">🎁 Party Loot</span>
            <div className="adv-camp-items">
              {stash.map((s) => (
                <button
                  key={s.itemId}
                  className={`adv-item ${picked?.kind === 'stash' && picked.itemId === s.itemId ? 'sel' : ''}`}
                  onClick={() => setPicked(picked?.kind === 'stash' && picked.itemId === s.itemId ? null : { kind: 'stash', itemId: s.itemId })}
                >
                  {itemIcon(s.itemId)} {itemName(s.itemId)}{s.qty > 1 ? ` ×${s.qty}` : ''}
                </button>
              ))}
            </div>
            {picked?.kind === 'stash' && (
              <div className="adv-item-acts">
                <InfoDot sheet={infoFor(picked.itemId)} />
                <span className="muted">Give to:</span>
                {campaign.characters.map((ch, i) => (
                  <button key={i} onClick={() => act(() => claimFromStash(campaign, i, picked.itemId), `${ch.name} takes ${itemName(picked.itemId)}`)}>
                    {ch.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Each hero: worn gear (tap to unequip) + pack (tap for equip/give/stash). */}
        {campaign.characters.map((ch, idx) => (
          <div key={idx} className="adv-camp-char">
            <div
              className="adv-camp-charhead adv-camp-charhead-tap"
              role="button"
              tabIndex={0}
              title="Tap for full character sheet"
              onClick={() => setSheetIdx(idx)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheetIdx(idx); } }}
            >
              {hasArt(ch.portraitId ?? ch.classId)
                ? <Portrait id={ch.portraitId ?? ch.classId} team="team1" />
                : <span className="adv-party-emoji">🧑</span>}
              <div>
                <strong>{ch.name} <span className="adv-camp-sheethint">ⓘ</span></strong>
                {/* A wrapping flex row, not a run of spans each opening with a
                    "·". Those separators are fine until the line wraps, and on a
                    430px phone with a long name it always does — leaving the
                    second line starting "· 🎲 3/3 HD", which reads as a bullet
                    list that lost its first item. Spacing separates them now, so
                    there is nothing to strand. */}
                <div className="adv-camp-stats muted">
                  <span>HP {party[idx]!.hp}/{party[idx]!.maxHp}</span>
                  <span>🛡 {acOf(party[idx]!)}</span>
                  {/* Hit dice left to spend on a short rest — a die per level,
                      refreshed (half) by a long rest. A short rest auto-spends
                      them to heal. */}
                  <span className="adv-camp-hd" title="Hit dice — spent on a short rest to heal, half restored by a long rest">
                    🎲 {hitDiceLeft(campaign, idx)}/{hitDiceMax(campaign)} HD
                  </span>
                  {/* Active camp-drunk buff potions (until the next rest), so a
                      drink you took before the fight visibly stuck. */}
                  {(() => {
                    const eff = ch.resources?.effects;
                    const chips: string[] = [];
                    if (eff?.giantStrength) chips.push(`💪 Str ${eff.giantStrength}`);
                    for (const r of eff?.resistances ?? []) chips.push(`🛡 ${r} resist`);
                    return chips.map((chip) => (
                      <span key={chip} className="adv-camp-buffs" title="Camp buff — lasts until the next short or long rest">
                        {chip}
                      </span>
                    ));
                  })()}
                </div>
                {/* Spell slots remaining, per level (renders nothing for a
                    non-caster) — so a wizard down to 1 of 2 first-level slots
                    reads at a glance, and "rest to recover" has a visible meter. */}
                <div className="adv-camp-slots">
                  <SlotPips spellSlots={party[idx]!.spellSlots} />
                  {/* And the pools that now outlive a fight — a paladin who has
                      spent Lay on Hands has to be able to see that here rather
                      than discover it when the button is missing mid-wave. */}
                  <FeaturePips featureUses={party[idx]!.featureUses} />
                </div>
              </div>
            </div>

            {/*
              SIX SLOTS, ALWAYS, FOR EVERY CHARACTER.

              This was a flex row of the FILLED slots only, rendered as chips
              that looked all but identical to the pack chips below them — so a
              worn Splint and a packed Adamantine Scale Mail were the same
              object on screen, and nothing said which sword was in hand.

              Fixed positions are what make it scannable: slot four is always
              ranged, so an empty one reads without being read. And empty is the
              useful state — an empty ranged slot on the fighter is exactly what
              gets the javelin marked. Showing only what is filled hides the one
              thing worth acting on.

              No slot is ever unavailable to a class, either. A wizard's off
              hand takes a dagger; it just cannot take a shield. What is blocked
              is always an ITEM in a slot, never the slot — and `equipBlocked`
              already returns the sentence that says why, which the picker shows
              rather than silently omitting the option.
            */}
            <div className="gear-slots">
              {EQUIP_SLOTS.map((slot) => {
                const held = ch.equipped[slot];
                const sel = picked?.kind === 'slot' && picked.charIdx === idx && picked.slot === slot;
                return (
                  <button
                    key={slot}
                    className={`gear-slot${held ? ' filled' : ''}${sel ? ' sel' : ''}`}
                    title={held ? itemName(held) : `${SLOT_LABEL[slot]} — empty`}
                    onClick={() => setPicked(sel ? null : { kind: 'slot', charIdx: idx, slot })}
                  >
                    <span className="gear-slot-icon">
                      {held
                        ? <ItemIcon itemId={held} fallback={itemIcon(held)} size={36} />
                        : SLOT_GLYPH[slot]}
                    </span>
                    <small>{SLOT_LABEL[slot]}</small>
                  </button>
                );
              })}
            </div>
            {picked?.kind === 'slot' && picked.charIdx === idx && (() => {
              const slot = picked.slot;
              const held = ch.equipped[slot];
              // Everything this character could put here — their own pack and
              // the party's loot — with the blocked ones kept and explained.
              const candidates = [
                ...ch.inventory.filter((st) => st.qty > 0).map((st) => st.itemId),
                ...stash.map((st) => st.itemId),
              ].filter((id, i, all) => all.indexOf(id) === i && id !== held);
              // Keep the near-misses and explain them — a wizard should see the
              // shield and be told why it cannot go there. But "explain
              // everything" listed every potion in the pack against the ranged
              // slot as "not a weapon", which is noise, not teaching: a potion
              // is not a near-miss for anything. `equipBlocked` opens exactly
              // those with "not a …", so that is the line.
              const wrongKind = (why?: string) => !!why && /^not a(rmor)?\b/.test(why);
              const fits = candidates
                .map((id) => ({ id, why: equipBlocked(campaign, idx, id, slot) }))
                .filter(({ id, why }) => !wrongKind(why)
                  && (why === undefined || ch.inventory.some((st) => st.itemId === id)));
              return (
                <div className="gear-picker">
                  <b>{SLOT_LABEL[slot]}{held ? ` — ${itemName(held)}` : ''}</b>
                  {held && (
                    <div className="adv-item-acts">
                      <InfoDot sheet={infoFor(held)} />
                      <button onClick={() => act(() => unequipSlot(campaign, idx, slot), `${ch.name} ${slot === 'ranged' ? 'stops keeping' : 'stows'} ${itemName(held)}`)}>
                        {slot === 'ranged' ? 'Clear' : 'Unequip'}
                      </button>
                    </div>
                  )}
                  {fits.length === 0 && <span className="muted">Nothing here fits this slot.</span>}
                  {fits.map(({ id, why }) => (
                    <button
                      key={id}
                      className={`gear-cand${why ? ' blocked' : ''}`}
                      disabled={!!why}
                      title={why ?? undefined}
                      onClick={() => act(
                        () => equipItem(campaign, idx, id, slot),
                        `${ch.name} ${slot === 'ranged' ? 'keeps' : 'equips'} ${itemName(id)}`,
                      )}
                    >
                      <span><ItemIcon itemId={id} fallback={itemIcon(id)} size={26} /> {itemName(id)}</span>
                      {why && <small>{why}</small>}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* The pack, folded away. Four characters' worth of open chip lists
                is the reason you could not see the party's loadout at a glance
                — which is the one thing this screen is for. Shut, all four fit
                on one screen; open, it is the list it always was. */}
            <button
              className="pack-toggle"
              onClick={() => setOpenPack(openPack === idx ? null : idx)}
            >
              🎒 Pack · {ch.inventory.reduce((n, st) => n + Math.max(0, st.qty), 0)}
              <span>{openPack === idx ? '▾' : '▸'}</span>
            </button>
            <div className={`adv-camp-items${openPack === idx ? '' : ' hidden'}`}>
              {ch.inventory.filter((s) => s.qty > 0).map((s) => {
                const sel = picked?.kind === 'pack' && picked.charIdx === idx && picked.itemId === s.itemId;
                return (
                  <button
                    key={s.itemId}
                    className={`adv-item ${sel ? 'sel' : ''}`}
                    onClick={() => setPicked(sel ? null : { kind: 'pack', charIdx: idx, itemId: s.itemId })}
                  >
                    {itemIcon(s.itemId)} {itemName(s.itemId)}{s.qty > 1 ? ` ×${s.qty}` : ''}
                  </button>
                );
              })}
              {ch.inventory.every((s) => s.qty <= 0) && <span className="muted">(pack empty)</span>}
            </div>
            {picked?.kind === 'pack' && picked.charIdx === idx && (
              <div className="adv-item-acts">
                <InfoDot sheet={infoFor(picked.itemId)} />
                {EQUIP_SLOTS.filter((slot) => equipBlocked(campaign, idx, picked.itemId, slot) === undefined).map((slot) => (
                  <button key={slot} onClick={() => act(() => equipItem(campaign, idx, picked.itemId, slot), `${ch.name} equips ${itemName(picked.itemId)}`)}>
                    Equip{slot === 'offHand' ? ' (off-hand)' : slot === 'mainHand' ? ' (main)' : ''}
                  </button>
                ))}
                {isStoreHealingSource(picked.itemId) && campaign.characters.map((target, t) => (
                  <button key={`h${t}`} onClick={() => act(() => {
                    const r = useStoreHealing(campaign, idx, t, picked.itemId as Parameters<typeof useStoreHealing>[3]);
                    setNotice(r ? `${ch.name} heals ${target.name} for ${r.healed} HP.` : 'Nothing to heal.');
                  }, '')}>
                    💚 {target.name}
                  </button>
                ))}
                {isCampBuffPotion(picked.itemId) && (
                  <button onClick={() => act(() => {
                    const msg = drinkCampBuffPotion(campaign, idx, picked.itemId);
                    if (msg) setNotice(msg);
                  }, '')}>
                    🧪 Drink now
                  </button>
                )}
                {campaign.characters.map((other, j) => j === idx ? null : (
                  <button key={j} onClick={() => act(() => giveItem(campaign, idx, j, picked.itemId), `${other.name} takes ${itemName(picked.itemId)}`)}>
                    → {other.name}
                  </button>
                ))}
                <button onClick={() => act(() => stashItem(campaign, idx, picked.itemId), `${itemName(picked.itemId)} to party loot`)}>Stash</button>
              </div>
            )}

            {/*
              Camp spellcasting — in the modal frame only.

              "Spells are here but belong in spells." They do, and worse, this
              had become a duplicate: the arena's Spells step now offers the
              same casts WITH the slot cost on the button, so Mage Armor was
              appearing twice in one mode, priced in one place and free-looking
              in the other. An adventure has no Spells step to move them to, so
              there they stay.
            */}
            {frame === 'modal' && (() => {
              const spells = storeSpellActions(party[idx]!);
              const canPrepare = cantripLimit(campaign, idx) > 0;
              if (spells.length === 0 && !canPrepare) return null;
              return (
                <>
                  <div className="adv-camp-items">
                    {canPrepare && (
                      // Re-preparing is a long-rest activity (camp or inn), not a
                      // free swap — so this is a read-out, not a button.
                      <span className="adv-item muted" title="Prepared spells change when you take a long rest">
                        📖 Prepared {preparedSpells(campaign, idx).length}/{preparedLimit(campaign, idx)} · rest to change
                      </span>
                    )}
                    {spells.map((sp) => {
                      const sel = picked?.kind === 'spell' && picked.charIdx === idx && picked.spellId === sp.spellId;
                      const slotIdx = (SPELLS[sp.spellId]?.level ?? 1) - 1;
                      const outOfSlots = !sp.ritual && (party[idx]!.spellSlots[slotIdx]?.current ?? 0) <= 0;
                      return (
                        <button
                          key={sp.spellId}
                          className={`adv-item ${sel ? 'sel' : ''}`}
                          disabled={outOfSlots}
                          title={outOfSlots ? 'No spell slots left — rest to recover them' : undefined}
                          onClick={() => setPicked(sel ? null : { kind: 'spell', charIdx: idx, spellId: sp.spellId })}
                        >
                          {sp.icon} {sp.name}
                        </button>
                      );
                    })}
                  </div>
                  {picked?.kind === 'spell' && picked.charIdx === idx && (() => {
                    const sp = spells.find((s) => s.spellId === picked.spellId)!;
                    return (
                      <div className="adv-item-acts">
                        <InfoDot sheet={spellSheet(sp.spellId)} />
                        {sp.targeting === 'self' && (
                          <button onClick={() => act(() => {
                            useStoreSpell(campaign, idx, sp.spellId);
                          }, `${ch.name} ${sp.castNotice ?? `casts ${sp.name}`}.`)}>
                            {sp.castLabel ?? 'Cast'}
                          </button>
                        )}
                        {isStoreHealingSource(sp.spellId) && campaign.characters.map((target, t) => (
                          <button key={t} onClick={() => act(() => {
                            const r = useStoreHealing(campaign, idx, t, sp.spellId as Parameters<typeof useStoreHealing>[3]);
                            setNotice(r ? `${ch.name} heals ${target.name} for ${r.healed} HP.` : 'No slots left.');
                          }, '')}>
                            💚 {target.name}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        ))}
    </>
  );

  const sheet = sheetIdx !== null && campaign.characters[sheetIdx] && party[sheetIdx] ? (
    <CharacterSheet
      c={party[sheetIdx]!}
      subtitle={`${label(campaign.characters[sheetIdx]!.classId)} · Level ${levelForXp(campaign.xp)}`}
      skills={characterSkills(campaign, sheetIdx)}
      onClose={() => setSheetIdx(null)}
    />
  ) : null;

  // Bare, for the arena to place inside its own panel under its own step bar.
  if (frame === 'panel') return <>{body}{sheet}</>;

  return (
    <div className="adv-camp-scrim" onClick={onClose}>
      <div className="adv-camp" onClick={(e) => e.stopPropagation()}>
        {body}
      </div>
      {sheet}
    </div>
  );
}
