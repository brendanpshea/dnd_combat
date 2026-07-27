/**
 * Three things on a table, take one.
 *
 * The reward for a claimed bounty, and now the only way permanent magic enters
 * a party at all. What makes this worth a screen rather than a line of text is
 * the passing-over: two of these are going back in the crate, and choosing
 * which is the moment the reward stops being a number and starts being a
 * decision about what the party is for.
 *
 * Deliberately not skippable. The loot screen holds Continue until every offer
 * is resolved — an award you can walk past by mistake is worse than no award.
 */
import { useState } from 'react';
import type { Id } from '../../src/engine/types.js';
import { itemName, itemIcon, rarityOf, itemPrice } from '../../src/campaign/campaign.js';
import { spoilBlurb } from '../../src/arena/spoils.js';
import { infoFor } from './gameInfo.js';

export interface SpoilPickerProps {
  /** The bounty that paid for this — the player should know what earned it. */
  bounty: string;
  items: Id[];
  onTake(itemId: Id): void;
}

export function SpoilPicker({ bounty, items, onTake }: SpoilPickerProps) {
  const [focused, setFocused] = useState<Id | null>(null);

  return (
    <div className="loot-panel spoils">
      <div className="loot-line">
        <span>🏆 {bounty}</span>
        <b className="gain">take one</b>
      </div>

      <div className="spoil-cards">
        {items.map((id) => (
          <button
            key={id}
            className={`spoil r-${rarityOf(id)}${focused === id ? ' on' : ''}`}
            onClick={() => (focused === id ? onTake(id) : setFocused(id))}
            aria-pressed={focused === id}
          >
            <span className="spoil-ico">{itemIcon(id)}</span>
            <span className="spoil-name">{itemName(id)}</span>
            <span className="spoil-tags">
              <span className="rarity">{spoilBlurb(id)}</span>
              {itemPrice(id) !== undefined && <span className="worth">{itemPrice(id)}g</span>}
            </span>
          </button>
        ))}
      </div>

      {/* What the focused item actually does. Choosing between three names is a
          guess; choosing between three effects is a decision. */}
      {focused !== null && (
        <div className="spoil-detail">
          <p>{infoFor(focused)?.blurb ?? itemName(focused)}</p>
          <button className="primary" onClick={() => onTake(focused)}>
            Take the {itemName(focused)}
          </button>
        </div>
      )}
      {focused === null && (
        <div className="loot-sub">Tap one to see what it does. The other two go back in the crate.</div>
      )}
    </div>
  );
}
