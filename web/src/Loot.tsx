/**
 * The reward screen after a won battle.
 *
 * It used to be a receipt — "+300 XP · 240 gold · Potion of Healing×2" on one
 * line — which threw away everything that makes a reward feel like one. The
 * numbers were all already computed; they just weren't *shown* anything.
 *
 * So: the XP bar actually fills toward the next level (progress you can see is
 * the whole point of XP), gold counts up, and treasure arrives one piece at a
 * time carrying its rarity. Nothing here gates you: Continue is live from the
 * first frame and the whole sequence is under a second, so the tenth victory
 * costs nothing.
 */
import { useEffect, useState } from 'react';
import type { CampaignState } from '../../src/campaign/campaign.js';
import type { ItemStack } from '../../src/engine/types.js';
import {
  itemName, itemIcon, itemPrice, rarityOf, partyLevelOf, LEVEL_XP,
} from '../../src/campaign/campaign.js';

export interface LootProps {
  campaign: CampaignState;
  gold: number;
  items: ItemStack[];
  xpGained: number;
  leveledTo?: number | undefined;
  onContinue(): void;
}

/** Count from `from` to `to` over `ms`, so gold lands rather than appears. */
function useCountUp(from: number, to: number, ms = 700): number {
  const [n, setN] = useState(from);
  useEffect(() => {
    if (from === to) { setN(to); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      // Ease out: fast, then settling — a linear counter reads like a spinner.
      setN(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms]);
  return n;
}

export function LootScreen({ campaign, gold, items, xpGained, leveledTo, onContinue }: LootProps) {
  const level = partyLevelOf(campaign);
  const floor = LEVEL_XP[level - 1] ?? 0;
  const next = LEVEL_XP[level] as number | undefined;   // undefined at max level

  const goldShown = useCountUp(campaign.gold - gold, campaign.gold);

  // Fill on the *second* frame: the bar has to be rendered at its old width for
  // the CSS transition to have something to move from. Levelling restarts the
  // bar at the new level's floor, which is what the level-up banner is saying.
  const startXp = leveledTo ? floor : campaign.xp - xpGained;
  const pct = (xp: number) =>
    next === undefined ? 100 : Math.max(0, Math.min(100, ((xp - floor) / (next - floor)) * 100));
  const [fill, setFill] = useState(pct(startXp));
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFill(pct(campaign.xp)));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.xp]);

  return (
    <div className="setup loot">
      <h1>🎉 Victory!</h1>

      {leveledTo && (
        <div className="levelup">⭐ Level up! The party is now level {leveledTo}</div>
      )}

      <div className="loot-panel">
        <div className="loot-line">
          <span>Experience</span>
          <b className="gain">+{xpGained} XP</b>
        </div>
        <div className="xpbar">
          <div className="xpfill" style={{ width: `${fill}%` }} />
        </div>
        <div className="loot-sub">
          {next === undefined
            ? `${campaign.xp} XP — max level`
            : `${campaign.xp} / ${next} XP to level ${level + 1}`}
        </div>

        <div className="loot-line gold-line">
          <span>💰 Gold</span>
          <b>{goldShown}</b>
          <span className="gain">+{gold}</span>
        </div>
      </div>

      {items.length > 0 && (
        <div className="loot-items">
          {items.map((s, i) => {
            const price = itemPrice(s.itemId);
            return (
              <div
                key={s.itemId}
                className={`loot-item r-${rarityOf(s.itemId)}`}
                // Staggered, but front-loaded: the whole run is done in ~0.8s.
                style={{ animationDelay: `${240 + i * 130}ms` }}
              >
                <span className="loot-ico">{itemIcon(s.itemId)}</span>
                <span className="loot-name">
                  {itemName(s.itemId)}{s.qty > 1 && <em> ×{s.qty}</em>}
                </span>
                <span className="loot-tags">
                  <span className="rarity">{rarityOf(s.itemId)}</span>
                  {price !== undefined && <span className="worth">{price * s.qty}g</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button className="primary" onClick={onContinue}>Continue</button>
    </div>
  );
}
