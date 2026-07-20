/**
 * A compact shop for adventure `shop` scenes: buy from the location's stock,
 * sell from the party's packs. Reuses the campaign's buy/sell/price functions,
 * so prices, gold, and half-price sell-back match the main shop exactly.
 * (Equip/give/haggle/steal stay in the full campaign shop for now.)
 */
import { useState } from 'react';
import {
  buyItem, sellItem, itemPrice, itemName, SHOP_STOCK, type CampaignState,
} from '../../src/campaign/campaign.js';

interface Props {
  campaign: CampaignState;
  stock?: string[];
  title?: string;
  onLeave(): void;
}

export function AdventureShop({ campaign, stock, title, onLeave }: Props) {
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');

  const forSale = (stock ?? SHOP_STOCK).filter((id) => itemPrice(id) !== undefined);
  // Every distinct item any hero is carrying, with who holds it.
  const owned: Array<{ itemId: string; charIdx: number }> = [];
  campaign.characters.forEach((ch, charIdx) => {
    for (const s of ch.inventory) if (s.qty > 0) owned.push({ itemId: s.itemId, charIdx });
  });

  return (
    <div className="adv-shop">
      <div className="shop-head">
        <h2>{title ?? 'Wayside Market'}</h2>
        <span className="adv-gold">💰 {campaign.gold}</span>
      </div>

      <div className="shop-tabs">
        <button className={tab === 'buy' ? 'on' : ''} onClick={() => setTab('buy')}>Buy</button>
        <button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}>Sell</button>
      </div>

      <div className="shop-list">
        {tab === 'buy' ? (
          forSale.map((id) => {
            const price = itemPrice(id)!;
            const afford = campaign.gold >= price;
            return (
              <button
                key={id} className="shop-row" disabled={!afford}
                onClick={() => { if (buyItem(campaign, 0, id)) rerender(); }}
              >
                <span>{itemName(id)}</span>
                <span className={`shop-price ${afford ? '' : 'poor'}`}>💰 {price}</span>
              </button>
            );
          })
        ) : owned.length === 0 ? (
          <p className="adv-text">The party's packs are empty.</p>
        ) : (
          owned.map(({ itemId, charIdx }, i) => (
            <button
              key={`${itemId}-${charIdx}-${i}`} className="shop-row"
              onClick={() => { if (sellItem(campaign, charIdx, itemId)) rerender(); }}
            >
              <span>{itemName(itemId)} <em className="shop-owner">· {campaign.characters[charIdx]?.name}</em></span>
              <span className="shop-price sell">+💰 {Math.floor((itemPrice(itemId) ?? 0) / 2)}</span>
            </button>
          ))
        )}
      </div>

      <button className="primary" onClick={onLeave}>Leave the market</button>
    </div>
  );
}
