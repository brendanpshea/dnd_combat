/**
 * The adventure shop: commerce with the visual language of the rest of the
 * adventure (a shopkeeper you can see, item icons, a bottom panel over the
 * location backdrop) and the mechanics of the old campaign store (buy to a
 * chosen hero at haggled prices, sell from packs and the shared stash, scribe
 * scrolls into a wizard's book, and two gambits — Haggle and Steal — that roll
 * through the same dice ritual as any scene check).
 *
 * Buy/sell/scribe mutate the campaign in place (then onChange). The gambits are
 * runtime calls that return `check` events; onRoll hands them to the player's
 * event pump, so the dice modal reveals them for free.
 */
import { useState } from 'react';
import {
  buyItem, sellItem, itemName, itemIcon, itemPrice, itemCategory,
  partyStash, claimFromStash, scrollLearnable, learnSpellFromScroll, equipBlocked,
  type CampaignState, type ItemCategory, type EquipSlot,
} from '../../src/campaign/campaign.js';
import {
  shopStock, shopPrice, shopVisitOf, shopHaggle, shopSteal, type HaggleSkill,
  type AdventureState, type AdventureEvent,
} from '../../src/adventure/runtime.js';
import type { Module, Scene } from '../../src/adventure/types.js';
import { isWeaponProficient } from '../../src/data/weapons.js';
import { CLASSES } from '../../src/data/classes.js';
import { Portrait } from './Portrait.js';
import { ItemInfoDot } from './InfoCard.js';
import { hasArt } from './art.js';
import { artEmoji } from '../../src/data/adventure-art.js';

type ShopScene = Extract<Scene, { kind: 'shop' }>;

const CAT_META: Record<ItemCategory, { icon: string; label: string }> = {
  weapon: { icon: '⚔️', label: 'Weapons' },
  armor: { icon: '🛡️', label: 'Armor' },
  potion: { icon: '🧪', label: 'Potions' },
  scroll: { icon: '📜', label: 'Scrolls' },
  trinket: { icon: '💍', label: 'Trinkets' },
  other: { icon: '📦', label: 'Other' },
};
const CAT_ORDER: ItemCategory[] = ['weapon', 'armor', 'potion', 'scroll', 'trinket', 'other'];
const EQUIP_SLOTS: EquipSlot[] = ['mainHand', 'offHand', 'armor', 'trinket'];

/** For a focused hero, how an equippable item suits them — drives the buy-row
 *  hint. `fits` = wear/wield with full benefit; `noprof` = can wield but adds no
 *  proficiency bonus (a wizard's greatsword); `noequip` = can't equip at all (a
 *  wizard's plate). Consumables (no slot) return null. */
function fitFor(campaign: CampaignState, heroIdx: number, itemId: string): 'fits' | 'noprof' | 'noequip' | null {
  const cat = itemCategory(itemId);
  if (cat !== 'weapon' && cat !== 'armor' && cat !== 'trinket') return null;
  const ch = campaign.characters[heroIdx];
  if (!ch) return null;
  // equipBlocked wants the item in inventory; probe a shallow clone.
  const probe = { ...campaign, characters: campaign.characters.map((c, i) =>
    i === heroIdx ? { ...c, inventory: [...c.inventory, { itemId, qty: 1 }] } : c) };
  const canEquip = EQUIP_SLOTS.some((slot) => equipBlocked(probe, heroIdx, itemId, slot) === undefined);
  if (!canEquip) return 'noequip';
  // A weapon equips freely but may add no proficiency bonus for this class.
  if (cat === 'weapon' && !isWeaponProficient(CLASSES[ch.classId]?.weaponProfs, itemId)) return 'noprof';
  return 'fits';
}

const HAGGLE_OPTS: Array<{ skill: HaggleSkill; label: string; note: string }> = [
  { skill: 'persuasion', label: '🤝 Persuade', note: 'safe · 20% off' },
  { skill: 'deception', label: '🎭 Deceive', note: '15% off / 15% up' },
  { skill: 'intimidation', label: '😠 Intimidate', note: 'risky · 25% off / 25% up' },
];

interface Props {
  campaign: CampaignState;
  state: AdventureState;
  module: Module;
  scene: ShopScene;
  /** Whose wares we're looking at — the whole party, one hero (chosen from the
   *  party strip below), or the shared loot. Lifted to the player so the strip
   *  is the hero selector; the shop only adds the All / Loot alternatives. */
  focus: number | 'all' | 'stash';
  setFocus: (f: number | 'all' | 'stash') => void;
  onRoll: (events: AdventureEvent[]) => void;
  onChange: () => void;
  onLeave: () => void;
}

export function AdventureShop({ campaign, state, module, scene, focus, setFocus, onRoll, onChange, onLeave }: Props) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [pickBuy, setPickBuy] = useState<string | null>(null);
  const [pickSell, setPickSell] = useState<string | null>(null); // sell row key awaiting confirm
  const [haggling, setHaggling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cat, setCat] = useState<ItemCategory | 'all'>('all');

  const visit = shopVisitOf(state, scene.id);
  const npc = scene.npc;
  const portraitId = npc?.portraitId ?? 'npc-merchant';
  const stock = shopStock(scene);
  const priceOf = (id: string) => shopPrice(state, scene.id, id);
  // Which shelves this shop actually stocks, and the buy list filtered to the
  // chosen one (a single shelf shows no filter — nothing to narrow).
  const cats = CAT_ORDER.filter((k) => stock.some((id) => itemCategory(id) === k));
  const shownStock = cat === 'all' ? stock : stock.filter((id) => itemCategory(id) === cat);

  // Every distinct item any hero holds, plus the shared stash, for the Sell tab.
  const sellable: Array<{ itemId: string; charIdx: number | 'stash'; label: string }> = [];
  campaign.characters.forEach((ch, charIdx) => {
    for (const s of ch.inventory) if (s.qty > 0) sellable.push({ itemId: s.itemId, charIdx, label: ch.name });
  });
  for (const s of partyStash(campaign)) if (s.qty > 0) sellable.push({ itemId: s.itemId, charIdx: 'stash', label: 'party loot' });

  // Focused view filters the sell list; 'stash' focus targets party loot only.
  const shownSellable = sellable.filter(({ charIdx }) =>
    focus === 'all' ? true : focus === 'stash' ? charIdx === 'stash' : charIdx === focus);

  const say = (msg: string) => { setNotice(msg); onChange(); };

  const doHaggle = (skill: HaggleSkill) => {
    setHaggling(false);
    onRoll(shopHaggle(state, module, skill));
  };
  const doSteal = () => onRoll(shopSteal(state, module));

  const greeting = npc
    ? (scene.intro?.[0] ?? '"Something catch your eye?"')
    : (scene.intro?.[0] ?? 'A wary quartermaster looks up from the counter.');

  return (
    <div className="adv-scene bottom">
      <div className="adv-panel adv-shop">
        <div className="adv-shop-controls">
        <div className="adv-shop-head">
          <div className="adv-npc compact">
            {hasArt(portraitId)
              ? <Portrait id={portraitId} team="team1" big />
              : <span className="adv-npc-emoji">{npc?.emoji ?? artEmoji(portraitId) ?? '🧑‍🌾'}</span>}
            <span className="adv-npc-name">{npc?.name ?? scene.title ?? 'Quartermaster'}</span>
          </div>
          <span className="adv-gold">💰 {campaign.gold}</span>
        </div>
        <p className="adv-text shop-greeting">{greeting}</p>
        {visit.priceMult !== 1 && (
          <p className="adv-shop-deal">
            {visit.priceMult < 1
              ? `Haggled — ${Math.round((1 - visit.priceMult) * 100)}% off this visit.`
              : `Prices are up ${Math.round((visit.priceMult - 1) * 100)}% — you soured the mood.`}
          </p>
        )}
        {notice && <p className="adv-camp-notice">{notice}</p>}

        <div className="shop-tabs">
          <button className={tab === 'buy' ? 'on' : ''} onClick={() => { setTab('buy'); setPickBuy(null); }}>Buy</button>
          <button className={tab === 'sell' ? 'on' : ''} onClick={() => { setTab('sell'); setPickBuy(null); }}>Sell</button>
        </div>

        {/* Hero selection lives in the party strip below (tap a portrait); the
            shop only offers the whole-party and party-loot alternatives. */}
        <div className="shop-focus">
          <button className={`shop-focus-chip ${focus === 'all' ? 'on' : ''}`}
            onClick={() => { setFocus('all'); setPickBuy(null); }}>👥 Party</button>
          <button className={`shop-focus-chip ${focus === 'stash' ? 'on' : ''}`}
            onClick={() => { setFocus('stash'); setTab('sell'); setPickBuy(null); }}>🎁 Loot</button>
          <span className="shop-focus-hint">
            {typeof focus === 'number' ? '' : 'tap a hero below to shop for them'}
          </span>
        </div>

        {/* Shelf filter: narrow the buy list by kind (only when there's more
            than one kind on the shelves). */}
        {tab === 'buy' && cats.length > 1 && (
          <div className="shop-focus shop-cats">
            <button className={`shop-focus-chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All</button>
            {cats.map((k) => (
              <button key={k} className={`shop-focus-chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>
                {CAT_META[k].icon} {CAT_META[k].label}
              </button>
            ))}
          </div>
        )}

        {tab === 'buy' && typeof focus === 'number' && (
          <p className="adv-shop-buyfor">Buying for {campaign.characters[focus]?.name}.</p>
        )}
        </div>

        <div className="shop-list">
          {tab === 'buy' ? shownStock.map((id) => {
            const price = priceOf(id);
            const afford = campaign.gold >= price;
            const picking = pickBuy === id;
            return (
              <div key={id} className="shop-item">
                <div className="shop-row-head">
                <button
                  className="shop-row" disabled={!afford}
                  onClick={() => {
                    if (typeof focus === 'number') {
                      // A hero is in focus — buy straight to them, one tap.
                      if (buyItem(campaign, focus, id, price)) say(`${campaign.characters[focus]?.name} buys ${itemName(id)}.`);
                    } else {
                      setPickBuy(picking ? null : id);
                    }
                  }}
                >
                  <span>
                    {itemIcon(id)} {itemName(id)}
                    {/* Equip hint for the focused hero: ✓ fits, ⚠ can't use. */}
                    {typeof focus === 'number' && (() => {
                      const fit = fitFor(campaign, focus, id);
                      if (fit === null) return null;
                      if (fit === 'fits') return <span className="shop-fit ok">✓ fits</span>;
                      if (fit === 'noprof') return <span className="shop-fit warn">⚠ not proficient</span>;
                      return <span className="shop-fit no">⚠ can't use</span>;
                    })()}
                  </span>
                  <span className={`shop-price ${afford ? '' : 'poor'}`}>💰 {price}</span>
                </button>
                <ItemInfoDot itemId={id} />
                </div>
                {picking && typeof focus !== 'number' && (
                  <div className="adv-item-acts adv-buyfor">
                    <span className="muted">Buy for:</span>
                    {campaign.characters.map((ch, i) => {
                      // Each recipient carries a proficiency badge, so you see
                      // who the item suits right where you pick who gets it.
                      const fit = fitFor(campaign, i, id);
                      const mark = fit === 'fits' ? '✓' : fit === 'noprof' ? '⚠' : fit === 'noequip' ? '✕' : '';
                      const cls = fit === 'fits' ? 'ok' : fit === 'noprof' ? 'warn' : fit === 'noequip' ? 'no' : '';
                      const title = fit === 'noprof' ? 'Can wield, but adds no proficiency bonus'
                        : fit === 'noequip' ? "Can't equip this" : undefined;
                      return (
                        <button key={i} className="adv-recip" disabled={!afford}
                          {...(title ? { title } : {})}
                          onClick={() => {
                            if (buyItem(campaign, i, id, price)) say(`${ch.name} buys ${itemName(id)}.`);
                            setPickBuy(null);
                          }}>
                          {ch.name.split(' ')[0]}{mark && <span className={`recip-fit ${cls}`}>{mark}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }) : shownSellable.length === 0 ? (
            <p className="adv-text">{focus === 'stash' ? 'No party loot to sell.' : 'Nothing to sell here.'}</p>
          ) : shownSellable.map(({ itemId, charIdx, label }, i) => {
            const resale = Math.floor((itemPrice(itemId) ?? 0) / 2);
            const key = `${itemId}-${charIdx}-${i}`;
            const confirming = pickSell === key;
            const doSell = () => {
              if (charIdx === 'stash') {
                if (claimFromStash(campaign, 0, itemId)) { sellItem(campaign, 0, itemId); say(`Sold ${itemName(itemId)} (+${resale}g).`); }
              } else if (sellItem(campaign, charIdx, itemId)) {
                say(`Sold ${itemName(itemId)} (+${resale}g).`);
              }
              setPickSell(null);
            };
            // Scribing is offered on a scroll the holding wizard can learn.
            const scribe = charIdx !== 'stash'
              ? scrollLearnable(campaign, charIdx, itemId)
              : undefined;
            return (
              <div key={key} className="shop-item">
                <div className="shop-row-head">
                <button className={`shop-row ${confirming ? 'confirming' : ''}`}
                  onClick={() => setPickSell(confirming ? null : key)}>
                  <span>{itemIcon(itemId)} {itemName(itemId)} <em className="shop-owner">· {label}</em></span>
                  <span className="shop-price sell">+💰 {resale}</span>
                </button>
                <ItemInfoDot itemId={itemId} />
                </div>
                {confirming && (
                  <div className="adv-item-acts">
                    <button onClick={doSell}>Sell for +{resale}g</button>
                    <button className="ghost" onClick={() => setPickSell(null)}>Keep</button>
                  </div>
                )}
                {scribe && charIdx !== 'stash' && (
                  <div className="adv-item-acts">
                    <button
                      disabled={campaign.gold < scribe.fee}
                      title={campaign.gold < scribe.fee ? `Needs ${scribe.fee}g` : undefined}
                      onClick={() => {
                        if (learnSpellFromScroll(campaign, charIdx, itemId)) say(`${campaign.characters[charIdx]?.name} scribes ${itemName(itemId)} into their spellbook (−${scribe.fee}g).`);
                      }}>
                      📖 Scribe (−{scribe.fee}g)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="adv-shop-foot">
        {/* Gambits — each a once-per-visit skill check through the dice ritual. */}
        <div className="adv-shop-gambits">
          {!visit.haggleUsed && !haggling && (
            <button className="shop-gambit" onClick={() => setHaggling(true)}>💬 Haggle</button>
          )}
          {haggling && HAGGLE_OPTS.map((o) => (
            <button key={o.skill} className="shop-gambit" onClick={() => doHaggle(o.skill)}>
              {o.label}<span className="muted"> · {o.note}</span>
            </button>
          ))}
          {!visit.stealUsed && stock.length > 0 && (
            <button className="shop-gambit risky" onClick={doSteal}>🕵️ Steal</button>
          )}
          {visit.haggleUsed && visit.stealUsed && <span className="muted">No gambits left this visit.</span>}
        </div>

        <button className="primary" onClick={onLeave}>Leave</button>
        </div>
      </div>
    </div>
  );
}
