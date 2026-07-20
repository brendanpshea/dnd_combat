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
  buyItem, sellItem, itemName, itemIcon, itemPrice,
  partyStash, claimFromStash, scrollLearnable, learnSpellFromScroll,
  type CampaignState,
} from '../../src/campaign/campaign.js';
import {
  shopStock, shopPrice, shopVisitOf, shopHaggle, shopSteal, type HaggleSkill,
  type AdventureState, type AdventureEvent,
} from '../../src/adventure/runtime.js';
import type { Module, Scene } from '../../src/adventure/types.js';
import { Portrait } from './Portrait.js';
import { hasArt } from './art.js';
import { artEmoji } from '../../src/data/adventure-art.js';

type ShopScene = Extract<Scene, { kind: 'shop' }>;

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
  onRoll: (events: AdventureEvent[]) => void;
  onChange: () => void;
  onLeave: () => void;
}

export function AdventureShop({ campaign, state, module, scene, onRoll, onChange, onLeave }: Props) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [pickBuy, setPickBuy] = useState<string | null>(null);
  const [haggling, setHaggling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const visit = shopVisitOf(state, scene.id);
  const npc = scene.npc;
  const portraitId = npc?.portraitId ?? 'npc-merchant';
  const stock = shopStock(scene);
  const priceOf = (id: string) => shopPrice(state, scene.id, id);

  // Every distinct item any hero holds, plus the shared stash, for the Sell tab.
  const sellable: Array<{ itemId: string; charIdx: number | 'stash'; label: string }> = [];
  campaign.characters.forEach((ch, charIdx) => {
    for (const s of ch.inventory) if (s.qty > 0) sellable.push({ itemId: s.itemId, charIdx, label: ch.name });
  });
  for (const s of partyStash(campaign)) if (s.qty > 0) sellable.push({ itemId: s.itemId, charIdx: 'stash', label: 'party loot' });

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

        <div className="shop-list">
          {tab === 'buy' ? stock.map((id) => {
            const price = priceOf(id);
            const afford = campaign.gold >= price;
            const picking = pickBuy === id;
            return (
              <div key={id} className="shop-item">
                <button
                  className="shop-row" disabled={!afford && !picking}
                  onClick={() => setPickBuy(picking ? null : id)}
                >
                  <span>{itemIcon(id)} {itemName(id)}</span>
                  <span className={`shop-price ${afford ? '' : 'poor'}`}>💰 {price}</span>
                </button>
                {picking && (
                  <div className="adv-item-acts">
                    <span className="muted">Buy for:</span>
                    {campaign.characters.map((ch, i) => (
                      <button key={i} disabled={!afford} onClick={() => {
                        if (buyItem(campaign, i, id, price)) say(`${ch.name} buys ${itemName(id)}.`);
                        setPickBuy(null);
                      }}>{ch.name}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          }) : sellable.length === 0 ? (
            <p className="adv-text">The party's packs are empty.</p>
          ) : sellable.map(({ itemId, charIdx, label }, i) => {
            const resale = Math.floor((itemPrice(itemId) ?? 0) / 2);
            // Scribing is offered on a scroll the holding wizard can learn.
            const scribe = charIdx !== 'stash'
              ? scrollLearnable(campaign, charIdx, itemId)
              : undefined;
            return (
              <div key={`${itemId}-${i}`} className="shop-item">
                <button className="shop-row" onClick={() => {
                  if (charIdx === 'stash') {
                    if (claimFromStash(campaign, 0, itemId)) { sellItem(campaign, 0, itemId); say(`Sold ${itemName(itemId)} (+${resale}g).`); }
                  } else if (sellItem(campaign, charIdx, itemId)) {
                    say(`Sold ${itemName(itemId)} (+${resale}g).`);
                  }
                }}>
                  <span>{itemIcon(itemId)} {itemName(itemId)} <em className="shop-owner">· {label}</em></span>
                  <span className="shop-price sell">+💰 {resale}</span>
                </button>
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
  );
}
