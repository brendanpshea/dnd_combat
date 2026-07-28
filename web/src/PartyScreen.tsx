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
import { InfoDot } from './InfoCard.js';
import { infoFor, spellSheet } from './gameInfo.js';
import { hasArt } from './art.js';

function label(itemId: string): string {
  return itemId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

type Pick =
  | { kind: 'pack'; charIdx: number; itemId: string }
  | { kind: 'stash'; itemId: string }
  | { kind: 'equipped'; charIdx: number; slot: EquipSlot; itemId: string }
  | { kind: 'spell'; charIdx: number; spellId: string }
  | null;

/** The party screen: gear management is always available (you can rummage your
 *  packs anywhere); Rest only appears where the location is campable (`camp`).
 *  Tap an item, then choose what to do with it — the same verb-after-noun flow
 *  as the campaign's between-battle screen, reusing the same state helpers. */
export function PartyScreen(
  { campaign, camp, onRest, onChange, onClose, notice: opening }: {
    campaign: CampaignState;
    camp: CampRule | null;
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
  const party = buildCampaignParty(campaign);
  const stash = partyStash(campaign).filter((s) => s.qty > 0);

  const act = (fn: () => boolean | void, msg: string) => {
    fn();
    setPicked(null);
    if (msg) setNotice(msg); // '' lets fn set its own notice (e.g. heal amounts)
    onChange();
  };

  return (
    <div className="adv-camp-scrim" onClick={onClose}>
      <div className="adv-camp" onClick={(e) => e.stopPropagation()}>
        <div className="adv-camp-head">
          <h2>🎒 Party</h2>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        {/* Rest — only where you can safely (or riskily) make camp. */}
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
                <span className="muted"> · HP {party[idx]!.hp}/{party[idx]!.maxHp} · 🛡 {acOf(party[idx]!)}</span>
                {/* Hit dice left to spend on a short rest — a die per level,
                    refreshed (half) by a long rest. A short rest auto-spends
                    them to heal. */}
                <span className="muted adv-camp-hd" title="Hit dice — spent on a short rest to heal, half restored by a long rest">
                  {' '}· 🎲 {hitDiceLeft(campaign, idx)}/{hitDiceMax(campaign)} HD
                </span>
                {/* Active camp-drunk buff potions (until the next rest), so a
                    drink you took before the fight visibly stuck. */}
                {(() => {
                  const eff = ch.resources?.effects;
                  const chips: string[] = [];
                  if (eff?.giantStrength) chips.push(`💪 Str ${eff.giantStrength}`);
                  for (const r of eff?.resistances ?? []) chips.push(`🛡 ${r} resist`);
                  return chips.length ? (
                    <span className="muted adv-camp-buffs" title="Camp buff — lasts until the next short or long rest">
                      {' · '}{chips.join(' · ')}
                    </span>
                  ) : null;
                })()}
                {/* Spell slots remaining, per level (renders nothing for a
                    non-caster) — so a wizard down to 1 of 2 first-level slots
                    reads at a glance, and "rest to recover" has a visible meter. */}
                <div className="adv-camp-slots"><SlotPips spellSlots={party[idx]!.spellSlots} /></div>
              </div>
            </div>

            <div className="adv-camp-gear">
              {EQUIP_SLOTS.map((slot) => {
                const held = ch.equipped[slot];
                if (!held) return null;
                const sel = picked?.kind === 'equipped' && picked.charIdx === idx && picked.slot === slot;
                return (
                  <button
                    key={slot}
                    className={`adv-item gear ${sel ? 'sel' : ''}`}
                    onClick={() => setPicked(sel ? null : { kind: 'equipped', charIdx: idx, slot, itemId: held })}
                  >
                    {itemIcon(held)} {itemName(held)}
                  </button>
                );
              })}
            </div>
            {picked?.kind === 'equipped' && picked.charIdx === idx && (
              <div className="adv-item-acts">
                <InfoDot sheet={infoFor(picked.itemId)} />
                <button onClick={() => act(() => unequipSlot(campaign, idx, picked.slot), `${ch.name} stows ${itemName(picked.itemId)}`)}>Unequip</button>
              </div>
            )}

            <div className="adv-camp-items">
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

            {/* Camp spellcasting: Cure Wounds, Mage Armor, Find Familiar, … —
                the same out-of-combat casts as the old between-battle store. */}
            {(() => {
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
      </div>

      {sheetIdx !== null && campaign.characters[sheetIdx] && party[sheetIdx] && (
        <CharacterSheet
          c={party[sheetIdx]!}
          subtitle={`${label(campaign.characters[sheetIdx]!.classId)} · Level ${levelForXp(campaign.xp)}`}
          skills={characterSkills(campaign, sheetIdx)}
          onClose={() => setSheetIdx(null)}
        />
      )}
    </div>
  );
}
